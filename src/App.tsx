import { useCallback, useEffect, useRef, useState } from "react";
import { ImageWorkspace } from "./components/ImageWorkspace";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { QAPanel } from "./components/QAPanel";
import { TopBar } from "./components/TopBar";
import { SAMPLE_SCENES, SUPPORTED_LANGUAGES } from "./data/languages";
import {
  ActiveImage,
  FocusBox,
  LanguageOption,
  SampleScene,
  VQAMode,
  VQATurn,
  VoiceName,
} from "./types/vqa";

const PREFS_KEY = "prismvoice.prefs.v1";

function loadSavedPrefs(): {
  langCode?: string;
  voice?: VoiceName;
  autoRead?: boolean;
} {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readImageDimensions(
  src: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [savedPrefs] = useState(loadSavedPrefs);
  const [activeImage, setActiveImage] = useState<ActiveImage | null>(null);
  const [activeSample, setActiveSample] = useState<SampleScene | null>(null);
  const [focusBox, setFocusBox] = useState<FocusBox | null>(null);
  const [question, setQuestion] = useState("");
  const [selectedMode, setSelectedMode] = useState<VQAMode>("general");
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(
    () =>
      SUPPORTED_LANGUAGES.find((l) => l.code === savedPrefs.langCode) ??
      SUPPORTED_LANGUAGES[0]
  );
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>(
    () => savedPrefs.voice ?? "Kore"
  );
  const [autoReadAloud, setAutoReadAloud] = useState<boolean>(
    () => savedPrefs.autoRead ?? true
  );
  const [turns, setTurns] = useState<VQATurn[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          langCode: selectedLanguage.code,
          voice: selectedVoice,
          autoRead: autoReadAloud,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedLanguage, selectedVoice, autoReadAloud]);

  const loadSampleScene = useCallback(async (scene: SampleScene) => {
    setErrorMsg(null);
    setActiveSample(scene);
    setFocusBox(null);
    setTurns([]);
    try {
      const response = await fetch(scene.imageUrl);
      if (!response.ok) {
        throw new Error("Could not load sample image.");
      }
      const blob = await response.blob();
      const dataUrl = await blobToBase64(blob);
      const dims = await readImageDimensions(dataUrl);
      setActiveImage({
        name: `${scene.id}.jpg`,
        src: dataUrl,
        base64: dataUrl,
        mimeType: scene.mimeType,
        width: dims.width,
        height: dims.height,
        sizeBytes: blob.size,
      });
    } catch {
      setErrorMsg("Failed to load sample scene. Try uploading your own image.");
    }
  }, []);

  useEffect(() => {
    loadSampleScene(SAMPLE_SCENES[0]);
  }, [loadSampleScene]);

  const handleFileSelected = async (file: File) => {
    setErrorMsg(null);
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg(
        "Unsupported file type. Please choose a PNG, JPEG, WEBP, or GIF image."
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Image exceeds 10 MB. Please select a smaller file.");
      return;
    }

    try {
      const dataUrl = await blobToBase64(file);
      const dims = await readImageDimensions(dataUrl);
      setActiveSample(null);
      setFocusBox(null);
      setTurns([]);
      setActiveImage({
        name: file.name,
        src: dataUrl,
        base64: dataUrl,
        mimeType: file.type,
        width: dims.width,
        height: dims.height,
        sizeBytes: file.size,
      });
    } catch {
      setErrorMsg("Unable to read the selected image file.");
    }
  };

  const handleCameraCaptured = async (dataUrl: string) => {
    setErrorMsg(null);
    const dims = await readImageDimensions(dataUrl);
    setActiveSample(null);
    setFocusBox(null);
    setTurns([]);
    setActiveImage({
      name: `camera-capture-${new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}.jpg`,
      src: dataUrl,
      base64: dataUrl,
      mimeType: "image/jpeg",
      width: dims.width,
      height: dims.height,
      sizeBytes: Math.round((dataUrl.length * 3) / 4),
    });
  };

  const handleClearImage = () => {
    setActiveImage(null);
    setActiveSample(null);
    setFocusBox(null);
    setTurns([]);
    setQuestion("");
    setErrorMsg(null);
  };

  const synthesizeSpeechForTurn = useCallback(
    async (
      turnId: string,
      text: string,
      languageName: string,
      voice: VoiceName
    ) => {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, isSynthesizingAudio: true, audioError: undefined }
            : t
        )
      );

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            language: languageName,
            voiceName: voice,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Speech generation failed.");
        }

        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  audioBase64: data.audioBase64,
                  voiceUsed: voice,
                  isSynthesizingAudio: false,
                }
              : t
          )
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Speech synthesis failed.";
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, isSynthesizingAudio: false, audioError: msg }
              : t
          )
        );
      }
    },
    []
  );

  const handleSubmitQuestion = async (overridePrompt?: string) => {
    const promptText = (overridePrompt ?? question).trim();
    if (!activeImage || !promptText || isAsking) return;

    setErrorMsg(null);
    setIsAsking(true);
    if (!overridePrompt) {
      setQuestion("");
    }

    const historyPayload = turns
      .slice(0, 6)
      .reverse()
      .map((t) => ({
        question: t.question,
        englishAnswer: t.englishAnswer,
      }));

    try {
      const res = await fetch("/api/vqa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: activeImage.base64,
          mimeType: activeImage.mimeType,
          question: promptText,
          targetLanguage: selectedLanguage.name,
          mode: selectedMode,
          focusBox,
          history: historyPayload,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze the image.");
      }

      const newTurnId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newTurn: VQATurn = {
        id: newTurnId,
        question: promptText,
        mode: selectedMode,
        hasFocusRegion: Boolean(focusBox),
        targetLanguage: selectedLanguage,
        detectedInputLanguage: data.detectedInputLanguage || "English",
        englishAnswer: data.englishAnswer,
        translatedAnswer: data.translatedAnswer,
        visualEvidence: data.visualEvidence,
        suggestedFollowUps: Array.isArray(data.suggestedFollowUps)
          ? data.suggestedFollowUps
          : [],
        voiceUsed: selectedVoice,
        isSynthesizingAudio: autoReadAloud,
        createdAt: Date.now(),
      };

      setTurns((prev) => [newTurn, ...prev]);

      if (autoReadAloud && data.translatedAnswer) {
        void synthesizeSpeechForTurn(
          newTurnId,
          data.translatedAnswer,
          selectedLanguage.name,
          selectedVoice
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to answer question."
      );
      if (!overridePrompt) {
        setQuestion(promptText);
      }
    } finally {
      setIsAsking(false);
    }
  };

  const handleRetranslateTurn = async (
    turnId: string,
    newLang: LanguageOption
  ) => {
    const targetTurn = turns.find((t) => t.id === turnId);
    if (!targetTurn) return;

    setTurns((prev) =>
      prev.map((t) =>
        t.id === turnId
          ? {
              ...t,
              targetLanguage: newLang,
              isTranslating: true,
              audioBase64: undefined,
              audioError: undefined,
            }
          : t
      )
    );

    try {
      let nextTranslated = targetTurn.englishAnswer;
      if (newLang.code !== "en") {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceText: targetTurn.englishAnswer,
            targetLanguage: newLang.name,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Translation failed.");
        }
        nextTranslated = data.translatedAnswer || targetTurn.englishAnswer;
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                targetLanguage: newLang,
                translatedAnswer: nextTranslated,
                isTranslating: false,
              }
            : t
        )
      );

      if (autoReadAloud && nextTranslated) {
        void synthesizeSpeechForTurn(
          turnId,
          nextTranslated,
          newLang.name,
          selectedVoice
        );
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not re-translate answer."
      );
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, isTranslating: false } : t
        )
      );
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setQuestion(prompt);
    void handleSubmitQuestion(prompt);
  };

  const handleGenerateSpeechForTurn = (turnId: string) => {
    const targetTurn = turns.find((t) => t.id === turnId);
    if (!targetTurn) return;
    void synthesizeSpeechForTurn(
      turnId,
      targetTurn.translatedAnswer,
      targetTurn.targetLanguage.name,
      selectedVoice
    );
  };

  const handleExportTranscript = () => {
    if (turns.length === 0) return;
    const lines = [
      `PrismVoice VQA Notes — ${activeImage?.name ?? "Image"}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      ...turns
        .slice()
        .reverse()
        .flatMap((t, idx) => [
          `Turn ${idx + 1} (${t.mode} · ${t.targetLanguage.name})`,
          `Question: ${t.question}`,
          `Translated Answer: ${t.translatedAnswer}`,
          ...(t.targetLanguage.code !== "en"
            ? [`English Reference: ${t.englishAnswer}`]
            : []),
          `Visual Evidence: ${t.visualEvidence}`,
          "---",
          "",
        ]),
    ];

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prismvoice-vqa-notes.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F12] text-slate-100">
      <TopBar
        onUploadClick={() => fileInputRef.current?.click()}
        hasTurns={turns.length > 0}
        onExportTranscript={handleExportTranscript}
      />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Intro Header */}
        <section
          id="workspace"
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
        >
          <div className="max-w-3xl">
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-100 text-balance">
              Visual Question Answering &amp; Spoken Translation Studio
            </h1>
            <p className="mt-2.5 text-base text-slate-400 leading-relaxed">
              Upload or capture an image, highlight a region of interest, run
              focused OCR or accessibility modes across 16 languages, and listen
              to natural neural speech.
            </p>
          </div>
          <div className="shrink-0">
            <PWAInstallButton />
          </div>
        </section>

        {/* Two-Column Interactive Workbench */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5">
            <ImageWorkspace
              activeImage={activeImage}
              activeSample={activeSample}
              focusBox={focusBox}
              onFocusBoxChange={setFocusBox}
              onFileSelected={handleFileSelected}
              onCameraCaptured={handleCameraCaptured}
              onSelectSample={loadSampleScene}
              onClearImage={handleClearImage}
              onQuickPrompt={handleQuickPrompt}
              fileInputRef={fileInputRef}
            />
          </div>

          <div className="lg:col-span-7">
            <QAPanel
              hasImage={Boolean(activeImage)}
              hasFocusRegion={Boolean(focusBox)}
              question={question}
              onQuestionChange={setQuestion}
              selectedMode={selectedMode}
              onModeChange={setSelectedMode}
              selectedLanguage={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
              autoReadAloud={autoReadAloud}
              onAutoReadChange={setAutoReadAloud}
              isAsking={isAsking}
              errorMsg={errorMsg}
              onDismissError={() => setErrorMsg(null)}
              turns={turns}
              onSubmitQuestion={handleSubmitQuestion}
              onClearTurns={() => setTurns([])}
              onGenerateSpeechForTurn={handleGenerateSpeechForTurn}
              onRetranslateTurn={handleRetranslateTurn}
            />
          </div>
        </section>

        {/* Capability Comparison Matrix */}
        <section
          id="compare"
          className="pt-8 border-t border-[#232D35] space-y-4"
        >
          <div className="max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-slate-100">
              How PrismVoice Compares
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Combining targeted visual focus, structured accessibility modes,
              instant re-translation, and neural speech in one workspace.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#232D35] bg-[#13191D]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#232D35] text-slate-400">
                  <th className="py-3 px-4 font-medium">Capability</th>
                  <th className="py-3 px-4 font-semibold text-emerald-300">
                    PrismVoice
                  </th>
                  <th className="py-3 px-4 font-medium">
                    Standard Image Translators
                  </th>
                  <th className="py-3 px-4 font-medium">
                    Generic Vision Chatbots
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232D35] text-slate-300">
                <tr className="hover:bg-[#192127]/60">
                  <td className="py-3 px-4 font-medium text-slate-100">
                    Region-of-Interest Drag Focus
                  </td>
                  <td className="py-3 px-4 text-emerald-300">
                    Interactive bounding box
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Auto-box OCR only
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Full image only
                  </td>
                </tr>
                <tr className="hover:bg-[#192127]/60">
                  <td className="py-3 px-4 font-medium text-slate-100">
                    Instant Answer Re-Translation
                  </td>
                  <td className="py-3 px-4 text-emerald-300">
                    1-click per turn (16 languages)
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    No Q&amp;A reasoning
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Requires new prompt turn
                  </td>
                </tr>
                <tr className="hover:bg-[#192127]/60">
                  <td className="py-3 px-4 font-medium text-slate-100">
                    Dedicated OCR &amp; Accessibility Modes
                  </td>
                  <td className="py-3 px-4 text-emerald-300">
                    4 tailored modes + evidence note
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Text overlay only
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Manual prompt engineering
                  </td>
                </tr>
                <tr className="hover:bg-[#192127]/60">
                  <td className="py-3 px-4 font-medium text-slate-100">
                    Neural Read-Aloud &amp; WAV Export
                  </td>
                  <td className="py-3 px-4 text-emerald-300">
                    5 voices · speed control · .wav download
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    Basic OS speech only
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    No downloadable WAV per answer
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#232D35] bg-[#0B0F12]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>PrismVoice</span>
          <span>
            Region-Focused VQA · Multilingual Translation · Neural Speech
          </span>
        </div>
      </footer>

      <OfflineIndicator />
    </div>
  );
}
