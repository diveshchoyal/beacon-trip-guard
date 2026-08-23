export interface LanguageOption {
  code: string; // ISO 639-1 code for translation
  speechCode: string; // BCP 47 code for Web Speech API
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", speechCode: "en-US", name: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "ta", speechCode: "ta-IN", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "hi", speechCode: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "fr", speechCode: "fr-FR", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "es", speechCode: "es-ES", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "de", speechCode: "de-DE", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "zh", speechCode: "zh-CN", name: "Mandarin", nativeName: "中文", flag: "🇨🇳" },
  { code: "ja", speechCode: "ja-JP", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
];

export interface DialogueEntry {
  id: string;
  speaker: "tourist" | "officer";
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
}

export type SpeakerRole = "tourist" | "officer";

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: {
        transcript: string;
      };
    };
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
