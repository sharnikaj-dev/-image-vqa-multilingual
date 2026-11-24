import {
  LanguageOption,
  SampleScene,
  VQAModeOption,
  VoiceOption,
} from "../types/vqa";

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", name: "English", nativeName: "English", bcp47: "en-US" },
  { code: "es", name: "Spanish", nativeName: "Español", bcp47: "es-ES" },
  { code: "fr", name: "French", nativeName: "Français", bcp47: "fr-FR" },
  { code: "de", name: "German", nativeName: "Deutsch", bcp47: "de-DE" },
  { code: "ja", name: "Japanese", nativeName: "日本語", bcp47: "ja-JP" },
  { code: "ko", name: "Korean", nativeName: "한국어", bcp47: "ko-KR" },
  { code: "zh", name: "Mandarin Chinese", nativeName: "中文", bcp47: "zh-CN" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", bcp47: "hi-IN" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", bcp47: "ta-IN" },
  { code: "ar", name: "Arabic", nativeName: "العربية", bcp47: "ar-SA", rtl: true },
  { code: "pt", name: "Portuguese", nativeName: "Português", bcp47: "pt-BR" },
  { code: "it", name: "Italian", nativeName: "Italiano", bcp47: "it-IT" },
  { code: "ru", name: "Russian", nativeName: "Русский", bcp47: "ru-RU" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", bcp47: "tr-TR" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", bcp47: "vi-VN" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", bcp47: "id-ID" },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  { id: "Kore", label: "Kore", tone: "Warm & balanced" },
  { id: "Puck", label: "Puck", tone: "Bright & conversational" },
  { id: "Charon", label: "Charon", tone: "Deep & steady" },
  { id: "Fenrir", label: "Fenrir", tone: "Crisp & expressive" },
  { id: "Zephyr", label: "Zephyr", tone: "Calm & clear" },
];

export const VQA_MODES: VQAModeOption[] = [
  {
    id: "general",
    label: "General Q&A",
    description: "Ask any question about what is happening in the scene.",
    defaultPrompt: "What is happening in this scene and what stands out most?",
  },
  {
    id: "ocr",
    label: "Read & Translate Text",
    description: "Extract visible signage, labels, or headlines and translate them.",
    defaultPrompt: "Read all visible signs, labels, or text and translate them.",
  },
  {
    id: "accessibility",
    label: "Scene Accessibility",
    description: "Spatial foreground-to-background narration tailored for audio.",
    defaultPrompt: "Describe the layout from foreground to background for a listener.",
  },
  {
    id: "objects",
    label: "Object Breakdown",
    description: "List distinct items, quantities, colors, and materials observed.",
    defaultPrompt: "List the key objects visible in this image with counts and locations.",
  },
];

export const SAMPLE_SCENES: SampleScene[] = [
  {
    id: "tokyo-alley",
    title: "Tokyo Market Alley",
    subtitle: "Kanji signage · Fresh produce · Evening lanterns",
    imageUrl: "/src/assets/images/sample_tokyo_alley_1795495131155.jpg",
    mimeType: "image/jpeg",
    suggestedPrompts: [
      "What do the wooden signs and hanging lanterns say?",
      "What fruits and vegetables are displayed in the crates?",
      "What is the weather like in this scene?",
    ],
  },
  {
    id: "apothecary-desk",
    title: "Botanical Apothecary",
    subtitle: "Handwritten ledger · Tincture labels · Brass scale",
    imageUrl: "/src/assets/images/sample_apothecary_desk_1795495130962.jpg",
    mimeType: "image/jpeg",
    suggestedPrompts: [
      "List the bottle labels visible on the left wooden rack.",
      "What herbs are hanging above the workbench?",
      "Describe what is resting on the brass balance scale.",
    ],
  },
  {
    id: "cafe-terrace",
    title: "Positano Cafe Terrace",
    subtitle: "Italian newspaper · Espresso · Coastal archways",
    imageUrl: "/src/assets/images/sample_cafe_terrace_1795495130860.jpg",
    mimeType: "image/jpeg",
    suggestedPrompts: [
      "Translate the Italian newspaper headline on the table.",
      "How many cups and croissants are served on the table?",
      "Describe the setting and background scenery.",
    ],
  },
];
