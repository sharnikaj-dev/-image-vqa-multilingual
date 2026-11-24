import React, { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Loader2,
  Mic,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  VOICE_OPTIONS,
  VQA_MODES,
} from "../data/languages";
import { LanguageOption, VQAMode, VQATurn, VoiceName } from "../types/vqa";
import { AudioPlayerBar } from "./AudioPlayerBar";

interface QAPanelProps {
  hasImage: boolean;
  hasFocusRegion: boolean;
  question: string;
  onQuestionChange: (val: string) => void;
  selectedMode: VQAMode;
  onModeChange: (mode: VQAMode) => void;
  selectedLanguage: LanguageOption;
  onLanguageChange: (lang: LanguageOption) => void;
  selectedVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  autoReadAloud: boolean;
  onAutoReadChange: (val: boolean) => void;
  isAsking: boolean;
  errorMsg: string | null;
  onDismissError: () => void;
  turns: VQATurn[];
  onSubmitQuestion: (overridePrompt?: string) => void;
  onClearTurns: () => void;
  onGenerateSpeechForTurn: (turnId: string) => void;
  onRetranslateTurn: (turnId: string, newLang: LanguageOption) => void;
}

export const QAPanel: React.FC<QAPanelProps> = ({
  hasImage,
  hasFocusRegion,
  question,
  onQuestionChange,
  selectedMode,
  onModeChange,
  selectedLanguage,
  onLanguageChange,
  selectedVoice,
  onVoiceChange,
  autoReadAloud,
  onAutoReadChange,
  isAsking,
  errorMsg,
  onDismissError,
  turns,
  onSubmitQuestion,
  onClearTurns,
  onGenerateSpeechForTurn,
  onRetranslateTurn,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedEvidence, setExpandedEvidence] = useState<
    Record<string, boolean>
  >({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const activeModeMeta =
    VQA_MODES.find((m) => m.id === selectedMode) ?? VQA_MODES[0];

  const handleCopy = async (turn: VQATurn) => {
    try {
      await navigator.clipboard.writeText(turn.translatedAnswer);
      setCopiedId(turn.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const toggleEvidence = (turnId: string) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [turnId]: !prev[turnId],
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitQuestion();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmitQuestion();
    }
  };

  const startOrStopRecording = async () => {
    setMicError(null);

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setMicError("Microphone recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const base64: string = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result ?? ""));
            reader.onerror = () => reject(new Error("Failed to read audio."));
            reader.readAsDataURL(blob);
          });

          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audioBase64: base64, mimeType }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Transcription failed.");
          }
          if (data.transcript) {
            onQuestionChange(
              question.trim()
                ? `${question.trim()} ${data.transcript}`
                : data.transcript
            );
          }
        } catch (err) {
          setMicError(
            err instanceof Error ? err.message : "Could not transcribe audio."
          );
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError(
        "Microphone access was denied. You can still type questions in any language."
      );
      setIsRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Configuration & Question Composer */}
      <div className="bg-[#13191D] border border-[#232D35] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232D35]">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Multilingual Q&amp;A Studio
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Choose an inspection mode, target language, and voice output
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoReadAloud}
              onChange={(e) => onAutoReadChange(e.target.checked)}
              className="w-4 h-4 rounded border-[#2A3640] bg-[#0B0F12] accent-emerald-500 cursor-pointer"
            />
            <span>Auto-read aloud</span>
          </label>
        </div>

        {/* VQA Mode Segmented Control */}
        <div className="mt-4">
          <span className="block text-xs font-medium text-slate-300 mb-1.5">
            Analysis Mode
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-lg bg-[#0B0F12] border border-[#232D35]">
            {VQA_MODES.map((m) => {
              const isActive = m.id === selectedMode;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onModeChange(m.id)}
                  className={`px-2.5 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap truncate cursor-pointer ${
                    isActive
                      ? "bg-[#047857] text-white"
                      : "text-slate-400 hover:text-slate-100 hover:bg-[#192127]"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>{activeModeMeta.description}</span>
            <button
              type="button"
              disabled={!hasImage || isAsking}
              onClick={() => onSubmitQuestion(activeModeMeta.defaultPrompt)}
              className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
            >
              Run {activeModeMeta.label}
            </button>
          </div>
        </div>

        {/* Language & Voice Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label
              htmlFor="target-language"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Output Language
            </label>
            <div className="relative">
              <Globe
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <select
                id="target-language"
                value={selectedLanguage.code}
                onChange={(e) => {
                  const found = SUPPORTED_LANGUAGES.find(
                    (l) => l.code === e.target.value
                  );
                  if (found) onLanguageChange(found);
                }}
                className="w-full h-10 pl-9 pr-8 rounded-lg border border-[#2A3640] bg-[#0B0F12] text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="tts-voice"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Read-Aloud Voice
            </label>
            <select
              id="tts-voice"
              value={selectedVoice}
              onChange={(e) => onVoiceChange(e.target.value as VoiceName)}
              className="w-full h-10 px-3 rounded-lg border border-[#2A3640] bg-[#0B0F12] text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.tone}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Question Form */}
        <form onSubmit={handleFormSubmit} className="mt-4">
          <label htmlFor="vqa-question" className="sr-only">
            Ask a question about the image
          </label>
          <div className="rounded-lg border border-[#2A3640] bg-[#0B0F12] focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-shadow">
            <textarea
              id="vqa-question"
              rows={3}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hasImage || isAsking}
              placeholder={
                hasImage
                  ? hasFocusRegion
                    ? `Ask about the highlighted region (answer in ${selectedLanguage.name})...`
                    : `Ask anything about the image (answer will be translated to ${selectedLanguage.name})...`
                  : "Upload, capture, or select a sample image on the left first..."
              }
              className="w-full px-3.5 pt-3 pb-2 text-sm text-slate-100 placeholder:text-slate-500 bg-transparent resize-none focus:outline-none disabled:text-slate-500"
            />

            <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-[#1D252C] bg-[#0F1418] rounded-b-lg">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startOrStopRecording}
                  disabled={!hasImage || isAsking || isTranscribing}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "border border-[#2A3640] bg-[#13191D] text-slate-200 hover:bg-[#192127]"
                  }`}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transcribing...</span>
                    </>
                  ) : isRecording ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop Recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Speak Question</span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-500 hidden sm:inline font-mono tabular-nums">
                  {question.length}/2000
                </span>
              </div>

              <button
                type="submit"
                disabled={!hasImage || !question.trim() || isAsking}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#047857] text-white text-xs font-semibold hover:bg-[#059669] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAsking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask Question</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {micError && (
            <p className="mt-2 text-xs text-amber-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{micError}</span>
            </p>
          )}
        </form>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-950/50 border border-red-800/70 flex items-start justify-between gap-3 text-xs text-red-200"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={onDismissError}
              className="text-red-300 font-medium hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Answers & Read-Aloud History */}
      <section
        id="conversation"
        className="bg-[#13191D] border border-[#232D35] rounded-xl p-5"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-baseline gap-2.5">
            <h2 className="font-display text-base font-semibold text-slate-100">
              Translated Answers
            </h2>
            {turns.length > 0 && (
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                {turns.length} {turns.length === 1 ? "turn" : "turns"}
              </span>
            )}
          </div>

          {turns.length > 0 && (
            <button
              type="button"
              onClick={onClearTurns}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Thread</span>
            </button>
          )}
        </div>

        {/* Loading Skeleton */}
        {isAsking && (
          <div className="py-5 border-t border-[#232D35] animate-pulse space-y-3">
            <div className="h-3 w-48 bg-[#232D35] rounded" />
            <div className="h-4 w-3/4 bg-[#232D35] rounded" />
            <div className="h-16 w-full bg-[#192127] rounded-lg" />
            <div className="h-9 w-full bg-[#192127] rounded-lg" />
          </div>
        )}

        {/* Empty State */}
        {!isAsking && turns.length === 0 && (
          <div className="py-10 px-4 border-t border-[#232D35] text-center">
            <p className="text-sm font-medium text-slate-200">
              No questions asked yet
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1.5 leading-relaxed">
              {hasImage
                ? `Type a question, click "Run ${activeModeMeta.label}", or select a suggested prompt to receive a translated answer in ${selectedLanguage.name} with spoken audio.`
                : "Upload a photo, capture from your camera, or select one of the sample scenes to start."}
            </p>
          </div>
        )}

        {/* Populated Turns */}
        <div className="divide-y divide-[#232D35]">
          {turns.map((turn, index) => {
            const turnNum = turns.length - index;
            const timeStr = new Date(turn.createdAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            });
            const isEvidenceOpen = Boolean(expandedEvidence[turn.id]);
            const modeLabel =
              VQA_MODES.find((m) => m.id === turn.mode)?.label ?? "General Q&A";

            return (
              <article
                key={turn.id}
                className="py-5 first:pt-2 last:pb-1 space-y-3.5"
              >
                {/* Unboxed Metadata Header + Instant Re-Translate */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums font-medium text-slate-200">
                      Turn {turnNum}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{modeLabel}</span>
                    {turn.hasFocusRegion && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-400">Region Focus</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>Input: {turn.detectedInputLanguage}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{timeStr}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label
                      htmlFor={`retranslate-${turn.id}`}
                      className="text-[11px] text-slate-400"
                    >
                      Language:
                    </label>
                    <select
                      id={`retranslate-${turn.id}`}
                      value={turn.targetLanguage.code}
                      disabled={turn.isTranslating}
                      onChange={(e) => {
                        const nextLang = SUPPORTED_LANGUAGES.find(
                          (l) => l.code === e.target.value
                        );
                        if (nextLang && nextLang.code !== turn.targetLanguage.code) {
                          onRetranslateTurn(turn.id, nextLang);
                        }
                      }}
                      className="h-7 px-2 rounded border border-[#2A3640] bg-[#0B0F12] text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* User Question */}
                <p className="text-sm font-semibold text-slate-100">
                  {turn.question}
                </p>

                {/* Primary Translated Answer */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    {turn.isTranslating ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-300 py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>
                          Translating answer to {turn.targetLanguage.name}...
                        </span>
                      </div>
                    ) : (
                      <p
                        dir={turn.targetLanguage.rtl ? "rtl" : "ltr"}
                        className="text-[15px] leading-relaxed text-slate-200 flex-1"
                      >
                        {turn.translatedAnswer}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopy(turn)}
                      aria-label="Copy translated answer"
                      className="p-1.5 rounded-md border border-[#2A3640] bg-[#0B0F12] text-slate-300 hover:text-white hover:bg-[#192127] transition-colors shrink-0 cursor-pointer"
                      title="Copy answer"
                    >
                      {copiedId === turn.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Audio Player */}
                  <AudioPlayerBar
                    audioBase64={turn.audioBase64}
                    isSynthesizing={turn.isSynthesizingAudio}
                    audioError={turn.audioError}
                    voiceUsed={turn.voiceUsed}
                    languageName={turn.targetLanguage.name}
                    bcp47={turn.targetLanguage.bcp47}
                    textToSpeak={turn.translatedAnswer}
                    autoPlay={index === 0 && autoReadAloud}
                    onGenerateSpeech={() => onGenerateSpeechForTurn(turn.id)}
                  />
                </div>

                {/* English Reference & Visual Grounding */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(turn.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {isEvidenceOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {turn.targetLanguage.code !== "en"
                        ? "English reference & visual evidence"
                        : "Visual evidence"}
                    </span>
                  </button>

                  {isEvidenceOpen && (
                    <div className="mt-2.5 pt-2.5 border-t border-[#232D35] space-y-2 text-xs text-slate-300 leading-relaxed">
                      {turn.targetLanguage.code !== "en" && (
                        <div>
                          <span className="font-semibold text-slate-200">
                            English reference:{" "}
                          </span>
                          <span>{turn.englishAnswer}</span>
                        </div>
                      )}
                      {turn.visualEvidence && (
                        <div>
                          <span className="font-semibold text-slate-200">
                            Visual evidence:{" "}
                          </span>
                          <span>{turn.visualEvidence}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Follow-up Prompts */}
                {turn.suggestedFollowUps.length > 0 && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {turn.suggestedFollowUps.map((followUp) => (
                      <button
                        key={followUp}
                        type="button"
                        disabled={isAsking}
                        onClick={() => onSubmitQuestion(followUp)}
                        className="text-left text-xs text-slate-300 hover:text-emerald-300 bg-[#0B0F12] hover:bg-emerald-500/10 border border-[#232D35] hover:border-emerald-500/40 px-3 py-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {followUp}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
