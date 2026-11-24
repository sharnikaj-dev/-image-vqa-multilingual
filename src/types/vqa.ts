export type VoiceName = "Kore" | "Puck" | "Charon" | "Fenrir" | "Zephyr";

export type VQAMode = "general" | "ocr" | "accessibility" | "objects";

export interface FocusBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  bcp47: string;
  rtl?: boolean;
}

export interface VoiceOption {
  id: VoiceName;
  label: string;
  tone: string;
}

export interface VQAModeOption {
  id: VQAMode;
  label: string;
  description: string;
  defaultPrompt: string;
}

export interface SampleScene {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  mimeType: string;
  suggestedPrompts: string[];
}

export interface ActiveImage {
  name: string;
  src: string;
  base64: string;
  mimeType: string;
  width?: number;
  height?: number;
  sizeBytes?: number;
}

export interface VQATurn {
  id: string;
  question: string;
  mode: VQAMode;
  hasFocusRegion: boolean;
  targetLanguage: LanguageOption;
  detectedInputLanguage: string;
  englishAnswer: string;
  translatedAnswer: string;
  visualEvidence: string;
  suggestedFollowUps: string[];
  voiceUsed: VoiceName;
  audioBase64?: string;
  audioError?: string;
  isSynthesizingAudio?: boolean;
  isTranslating?: boolean;
  createdAt: number;
}
