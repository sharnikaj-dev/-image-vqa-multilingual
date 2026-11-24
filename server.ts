import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ALLOWED_IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
]);
const ALLOWED_VOICES = new Set(["Kore", "Puck", "Charon", "Fenrir", "Zephyr"]);
const ALLOWED_MODES = new Set(["general", "ocr", "accessibility", "objects"]);

const MODE_INSTRUCTIONS: Record<string, string> = {
  general:
    "Answer the user's visual question clearly and concisely (2-4 sentences), grounded strictly in observable details.",
  ocr:
    "Focus on Optical Character Recognition and translation. Read all relevant visible text, signs, labels, or headlines verbatim, identify their original language, and provide their meaning cleanly in the target output language.",
  accessibility:
    "Provide a clear, natural spoken-friendly spatial description from foreground to background, noting key subjects, lighting, layout, and any text or obstacles helpful for a low-vision listener.",
  objects:
    "Identify and list the primary objects, quantities, colors, and spatial positions visible in the scene in clean, scannable prose.",
};

// Lightweight per-IP sliding window rate limiter for public hosting protection
const RATE_WINDOW_MS = 5 * 60 * 1000;
const RATE_MAX_REQUESTS = 60;
const ipHits = new Map<string, number[]>();

function apiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const clientIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";
  const now = Date.now();
  const timestamps = (ipHits.get(clientIp) ?? []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (timestamps.length >= RATE_MAX_REQUESTS) {
    res.status(429).json({
      error: "Too many requests from this network. Please wait a few minutes.",
    });
    return;
  }
  timestamps.push(now);
  ipHits.set(clientIp, timestamps);
  next();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function formatApiError(err: unknown): { status: number; message: string } {
  const rawMessage =
    err instanceof Error ? err.message : "An unexpected error occurred.";
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("api_key_invalid") ||
    lower.includes("permission_denied") ||
    lower.includes("api key not valid") ||
    lower.includes("403")
  ) {
    return {
      status: 403,
      message:
        "Gemini API key is invalid or missing permissions. Please verify GEMINI_API_KEY in the server environment.",
    };
  }
  if (lower.includes("resource_exhausted") || lower.includes("429")) {
    return {
      status: 429,
      message:
        "Rate limit reached on the Gemini API. Please wait a moment and try again.",
    };
  }
  if (lower.includes("not_found") || lower.includes("404")) {
    return {
      status: 404,
      message: "Requested Gemini model is unavailable. Please retry shortly.",
    };
  }
  return {
    status: 500,
    message: rawMessage,
  };
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(express.json({ limit: "15mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    });
  });

  app.post("/api/vqa", apiRateLimiter, async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured on the server.",
      });
      return;
    }

    const {
      imageBase64,
      mimeType,
      question,
      targetLanguage,
      mode,
      focusBox,
      history,
    } = req.body ?? {};

    if (typeof imageBase64 !== "string" || imageBase64.trim().length === 0) {
      res.status(400).json({ error: "A valid image payload is required." });
      return;
    }
    if (imageBase64.length > 14_000_000) {
      res
        .status(400)
        .json({ error: "Image is too large. Please upload an image under 10 MB." });
      return;
    }

    const normalizedMime =
      typeof mimeType === "string"
        ? mimeType.toLowerCase().split(";")[0].trim()
        : "";
    if (!ALLOWED_IMAGE_MIMES.has(normalizedMime)) {
      res.status(400).json({
        error:
          "Unsupported image format. Please use PNG, JPEG, WEBP, or GIF.",
      });
      return;
    }

    if (
      typeof question !== "string" ||
      question.trim().length === 0 ||
      question.trim().length > 2000
    ) {
      res.status(400).json({
        error: "Question must be between 1 and 2,000 characters.",
      });
      return;
    }

    const cleanTargetLang =
      typeof targetLanguage === "string" && targetLanguage.trim().length > 0
        ? targetLanguage.trim().slice(0, 80)
        : "English";

    const cleanMode =
      typeof mode === "string" && ALLOWED_MODES.has(mode) ? mode : "general";

    let focusNote = "";
    if (
      focusBox &&
      typeof focusBox.x === "number" &&
      typeof focusBox.y === "number" &&
      typeof focusBox.width === "number" &&
      typeof focusBox.height === "number" &&
      focusBox.width > 0.01 &&
      focusBox.height > 0.01
    ) {
      const leftPct = Math.round(Math.max(0, Math.min(1, focusBox.x)) * 100);
      const topPct = Math.round(Math.max(0, Math.min(1, focusBox.y)) * 100);
      const rightPct = Math.round(
        Math.max(0, Math.min(1, focusBox.x + focusBox.width)) * 100
      );
      const bottomPct = Math.round(
        Math.max(0, Math.min(1, focusBox.y + focusBox.height)) * 100
      );
      focusNote = `\nIMPORTANT FOCUS REGION: The user highlighted a specific region of the image (x: ${leftPct}%–${rightPct}%, y: ${topPct}%–${bottomPct}% from top-left). Concentrate your primary answer on what appears inside this highlighted box while using surrounding context only if needed.`;
    }

    const cleanHistory = Array.isArray(history)
      ? history
          .slice(-8)
          .filter(
            (item): item is { question: string; englishAnswer: string } =>
              Boolean(item) &&
              typeof item.question === "string" &&
              typeof item.englishAnswer === "string"
          )
      : [];

    const historyContext =
      cleanHistory.length > 0
        ? `\n\nPrevious questions and answers about this same image:\n${cleanHistory
            .map(
              (h, idx) =>
                `Turn ${idx + 1} Q: ${h.question.slice(0, 400)}\nTurn ${idx + 1} A: ${h.englishAnswer.slice(0, 600)}`
            )
            .join("\n")}`
        : "";

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    const effectiveMime =
      normalizedMime === "image/jpg" ? "image/jpeg" : normalizedMime;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: effectiveMime,
                data: cleanBase64,
              },
            },
            {
              text: `Analysis mode: ${cleanMode}\nUser question: "${question.trim()}"\nTarget output language: ${cleanTargetLang}${focusNote}${historyContext}`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `You are PrismVoice, a precise multilingual Visual Question Answering (VQA) assistant. ${MODE_INSTRUCTIONS[cleanMode]} Answer strictly from visual evidence in the image; if something cannot be verified visually, state that clearly instead of guessing. Return: (1) an accurate English reference answer, (2) a natural, idiomatic translation of that answer in the target output language, (3) the detected language name of the user's question, (4) a concise one-sentence visual evidence note citing the observed region or text, and (5) 3 short follow-up questions about the image written in the target output language.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              englishAnswer: {
                type: Type.STRING,
                description: "Clear, factual visual answer in English.",
              },
              translatedAnswer: {
                type: Type.STRING,
                description:
                  "Natural, idiomatic translation of the answer in the requested target language. If target language is English, match englishAnswer.",
              },
              detectedInputLanguage: {
                type: Type.STRING,
                description:
                  "The language name of the user's question (e.g., English, Spanish, Tamil, Japanese).",
              },
              visualEvidence: {
                type: Type.STRING,
                description:
                  "One concise sentence in English describing the exact visual details or text seen in the image.",
              },
              suggestedFollowUps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  "3 short follow-up questions about the image written in the requested target language.",
              },
            },
            required: [
              "englishAnswer",
              "translatedAnswer",
              "detectedInputLanguage",
              "visualEvidence",
              "suggestedFollowUps",
            ],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json({
        englishAnswer: String(parsed.englishAnswer ?? ""),
        translatedAnswer: String(parsed.translatedAnswer ?? ""),
        detectedInputLanguage: String(parsed.detectedInputLanguage ?? "Unknown"),
        visualEvidence: String(parsed.visualEvidence ?? ""),
        suggestedFollowUps: Array.isArray(parsed.suggestedFollowUps)
          ? parsed.suggestedFollowUps.slice(0, 3).map(String)
          : [],
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post(
    "/api/translate",
    apiRateLimiter,
    async (req: Request, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "GEMINI_API_KEY is not configured on the server.",
        });
        return;
      }

      const { sourceText, targetLanguage } = req.body ?? {};
      if (
        typeof sourceText !== "string" ||
        sourceText.trim().length === 0 ||
        sourceText.trim().length > 4000
      ) {
        res.status(400).json({ error: "Source text is required." });
        return;
      }
      if (
        typeof targetLanguage !== "string" ||
        targetLanguage.trim().length === 0 ||
        targetLanguage.trim().length > 80
      ) {
        res.status(400).json({ error: "Target language is required." });
        return;
      }

      try {
        const response = await ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: `Translate the following visual Q&A answer accurately and naturally into ${targetLanguage.trim()}. Preserve any quoted foreign signage or numbers cleanly. Return only the translated text.\n\nText:\n${sourceText.trim()}`,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        res.json({
          translatedAnswer: (response.text ?? "").trim(),
        });
      } catch (err) {
        const formatted = formatApiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  );

  app.post("/api/tts", apiRateLimiter, async (req: Request, res: Response) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured on the server.",
      });
      return;
    }

    const { text, language, voiceName } = req.body ?? {};
    if (
      typeof text !== "string" ||
      text.trim().length === 0 ||
      text.trim().length > 3000
    ) {
      res.status(400).json({
        error: "Text to synthesize must be between 1 and 3,000 characters.",
      });
      return;
    }

    const chosenVoice =
      typeof voiceName === "string" && ALLOWED_VOICES.has(voiceName)
        ? voiceName
        : "Kore";
    const cleanLanguage =
      typeof language === "string" && language.trim().length > 0
        ? language.trim().slice(0, 60)
        : "English";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: `Clear, warm, natural pronunciation in ${cleanLanguage}`,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: chosenVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res
          .status(502)
          .json({ error: "Speech synthesis returned no audio data." });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: "audio/wav",
      });
    } catch (err) {
      const formatted = formatApiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post(
    "/api/transcribe",
    apiRateLimiter,
    async (req: Request, res: Response) => {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            "GEMINI_API_KEY is not configured on the server.",
        });
        return;
      }

      const { audioBase64, mimeType } = req.body ?? {};
      if (typeof audioBase64 !== "string" || audioBase64.trim().length === 0) {
        res.status(400).json({ error: "Audio payload is required." });
        return;
      }
      if (audioBase64.length > 10_000_000) {
        res.status(400).json({ error: "Audio clip is too large." });
        return;
      }

      const normalizedMime =
        typeof mimeType === "string"
          ? mimeType.toLowerCase().split(";")[0].trim()
          : "audio/webm";
      if (!ALLOWED_AUDIO_MIMES.has(normalizedMime)) {
        res.status(400).json({ error: "Unsupported audio MIME type." });
        return;
      }

      const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-transcribe",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: cleanBase64,
                },
              },
              {
                text: "Transcribe this spoken question accurately in its original language. Return only the transcribed question text without quotes or commentary.",
              },
            ],
          },
        });

        res.json({
          transcript: (response.text ?? "").trim(),
        });
      } catch (err) {
        const formatted = formatApiError(err);
        res.status(formatted.status).json({ error: formatted.message });
      }
    }
  );

  if (process.env.NODE_ENV === "production") {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req: Request, res: Response) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build.");
      }
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PrismVoice server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
