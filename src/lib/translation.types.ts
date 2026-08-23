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

// Asynchronously loads available voices, waiting for the voiceschanged event if initially empty
export async function getLoadedVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return [];
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) return voices;

  return new Promise((resolve) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(window.speechSynthesis.getVoices());
      }
    }, 600);

    const onVoices = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        resolve(window.speechSynthesis.getVoices());
      }
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
  });
}

// Finds an exact, prefix, or named matching voice for a language code
export function findMatchingVoice(
  voices: SpeechSynthesisVoice[],
  langCode: string,
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  const speechCode = (langConfig?.speechCode || langCode).toLowerCase().replace("_", "-");
  const baseCode = langCode.toLowerCase().split("-")[0];
  const langName = langConfig?.name.toLowerCase() || "";
  const nativeName = langConfig?.nativeName.toLowerCase() || "";

  // 1. Exact match (e.g. "ta-in" === "ta-in")
  let match = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === speechCode);
  if (match) return match;

  // 2. Prefix match (e.g. "ta-lk", "ta-sg", "ta")
  match = voices.find((v) => {
    const vLang = v.lang.toLowerCase().replace("_", "-");
    return vLang.startsWith(baseCode + "-") || vLang === baseCode;
  });
  if (match) return match;

  // 3. Name match in voice name (e.g. "Google Tamil", "Microsoft Valluvar")
  match = voices.find((v) => {
    const vName = v.name.toLowerCase();
    return (
      (langName && vName.includes(langName)) ||
      (nativeName && vName.includes(nativeName))
    );
  });
  if (match) return match;

  return null;
}
