import { useState, useEffect, useRef, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  RotateCcw,
  Languages,
  Sparkles,
  Shield,
  User,
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  Send,
  VolumeX,
  Smartphone,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { GlassCard, PressButton } from "@/components/ui/glass";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPPORTED_LANGUAGES,
  type DialogueEntry,
  type SpeakerRole,
  type SpeechRecognitionLike,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionErrorEventLike,
} from "@/lib/translation.types";

export const Route = createFileRoute("/_authenticated/app/translate")({
  component: VoiceTranslatorScreen,
});

// Quick emergency phrase suggestions
const QUICK_PHRASES: Record<SpeakerRole, string[]> = {
  tourist: [
    "I need medical assistance immediately.",
    "I lost my passport and travel bag.",
    "Where is the nearest police station?",
    "Can you please help me contact my embassy?",
  ],
  officer: [
    "Please stay calm, you are safe here.",
    "Show me your Digital ID or passport.",
    "Can you describe what happened?",
    "An emergency response unit is on the way.",
  ],
};

function VoiceTranslatorScreen() {
  const [touristLang, setTouristLang] = useState<string>("en");
  const [officerLang, setOfficerLang] = useState<string>("ta");

  const [touristTranscript, setTouristTranscript] = useState<string>("");
  const [officerTranscript, setOfficerTranscript] = useState<string>("");

  const [touristTranslated, setTouristTranslated] = useState<string>("");
  const [officerTranslated, setOfficerTranslated] = useState<string>("");

  const [activeSpeaker, setActiveSpeaker] = useState<SpeakerRole | null>(null);
  const [isTranslating, setIsTranslating] = useState<SpeakerRole | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<string | null>(null);

  const [speechSupported, setSpeechSupported] = useState<boolean>(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [isFaceToFaceRotated, setIsFaceToFaceRotated] = useState<boolean>(true);
  const [history, setHistory] = useState<DialogueEntry[]>([]);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Check speech recognition support and microphone availability on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSpeech = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
      setSpeechSupported(Boolean(hasSpeech));

      // Warm up SpeechSynthesis voices for iOS Safari / Chrome
      if ("speechSynthesis" in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.getVoices();
        };
      }
    }
  }, []);

  // Text-to-Speech function that works reliably across all devices
  const speakText = useCallback((text: string, langCode: string, entryId?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      console.warn("SpeechSynthesis not supported on this browser.");
      return;
    }

    try {
      window.speechSynthesis.cancel();

      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      const speechCode = langConfig?.speechCode || langCode;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechCode;
      utterance.rate = 0.92;
      utterance.pitch = 1.0;

      // Assign matching voice if available
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        const matchingVoice =
          voices.find((v) => v.lang === speechCode) ||
          voices.find((v) => v.lang.startsWith(langCode)) ||
          voices.find((v) => v.lang.toLowerCase().includes(langCode.toLowerCase()));
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        }
      }

      if (entryId) setIsPlayingAudio(entryId);

      utterance.onend = () => {
        setIsPlayingAudio(null);
      };

      utterance.onerror = (e) => {
        console.warn("TTS utterance error:", e);
        setIsPlayingAudio(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Failed to execute TTS:", err);
      setIsPlayingAudio(null);
    }
  }, []);

  // Perform translation call via Supabase Edge Function with resilient fallback
  const handleTranslate = useCallback(
    async (text: string, speaker: SpeakerRole) => {
      if (!text.trim()) return;

      const sourceLang = speaker === "tourist" ? touristLang : officerLang;
      const targetLang = speaker === "tourist" ? officerLang : touristLang;

      setIsTranslating(speaker);

      try {
        let resultText = "";

        // 1. Try Supabase Edge Function first
        try {
          const { data, error } = await supabase.functions.invoke("translate-text", {
            body: {
              text: text.trim(),
              source_lang: sourceLang,
              target_lang: targetLang,
            },
          });

          if (!error && (data as { translated_text?: string })?.translated_text) {
            resultText = (data as { translated_text: string }).translated_text;
          }
        } catch {
          // Edge function call failed or not deployed yet, proceed to client fallback
        }

        // 2. Direct fallback to free translation API if edge function is unavailable
        if (!resultText) {
          const src = sourceLang.toLowerCase().split("-")[0];
          const tgt = targetLang.toLowerCase().split("-")[0];
          if (src === tgt) {
            resultText = text.trim();
          } else {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${src}|${tgt}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const json = await res.json();
              if (json?.responseData?.translatedText) {
                resultText = json.responseData.translatedText
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"');
              }
            }
          }
        }

        if (!resultText) {
          resultText = text.trim();
        }

        if (speaker === "tourist") {
          setOfficerTranslated(resultText);
        } else {
          setTouristTranslated(resultText);
        }

        const newEntry: DialogueEntry = {
          id: Math.random().toString(36).slice(2, 9),
          speaker,
          originalText: text.trim(),
          translatedText: resultText,
          sourceLang,
          targetLang,
          timestamp: new Date(),
        };

        setHistory((prev) => [newEntry, ...prev]);

        // Automatically speak aloud in the target speaker's panel for all input sources
        speakText(resultText, targetLang, newEntry.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        console.error("Translation error:", err);
        toast.error(`Translation failed: ${message}`);
      } finally {
        setIsTranslating(null);
      }
    },
    [touristLang, officerLang, speakText],
  );

  // Stop active speech recognition
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
      recognitionRef.current = null;
    }
    setActiveSpeaker(null);
  }, []);

  // Start speech recognition for a specific role
  const startListening = useCallback(
    (speaker: SpeakerRole) => {
      if (typeof window === "undefined") return;

      const speechConstructor =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

      if (!speechConstructor) {
        toast.error("Voice input is not supported in this browser. Please type below.");
        return;
      }

      // Stop any existing session
      stopListening();

      const langCode = speaker === "tourist" ? touristLang : officerLang;
      const langConfig = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
      const speechCode = langConfig?.speechCode || "en-US";

      try {
        const recognition = new speechConstructor();
        recognition.lang = speechCode;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        let finalTranscript = "";

        recognition.onstart = () => {
          setActiveSpeaker(speaker);
          setMicPermissionDenied(false);
          if (speaker === "tourist") {
            setTouristTranscript("");
          } else {
            setOfficerTranscript("");
          }
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i]![0]!.transcript;
            if (event.results[i]!.isFinal) {
              finalTranscript += transcript;
            } else {
              interim += transcript;
            }
          }

          const currentText = finalTranscript || interim;
          if (speaker === "tourist") {
            setTouristTranscript(currentText);
          } else {
            setOfficerTranscript(currentText);
          }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
          console.warn("Speech recognition error:", event.error);
          if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            setMicPermissionDenied(true);
            toast.error("Microphone permission was denied. Please allow microphone access in site settings.");
          } else if (event.error !== "no-speech") {
            toast.error(`Microphone notice: ${event.error}`);
          }
          stopListening();
        };

        recognition.onend = () => {
          setActiveSpeaker(null);
          const completedText =
            speaker === "tourist" ? touristTranscript || finalTranscript : officerTranscript || finalTranscript;

          if (completedText && completedText.trim()) {
            void handleTranslate(completedText.trim(), speaker);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Microphone unavailable";
        console.error("Failed to start speech recognition:", err);
        setMicPermissionDenied(true);
        toast.error(`Could not start microphone: ${message}`);
        setActiveSpeaker(null);
      }
    },
    [touristLang, officerLang, stopListening, handleTranslate, touristTranscript, officerTranscript],
  );

  // Toggle mic for a speaker
  const toggleListening = (speaker: SpeakerRole) => {
    if (!speechSupported) {
      toast.info("Voice input is not supported on this browser. Type your message below.");
      return;
    }
    if (activeSpeaker === speaker) {
      stopListening();
    } else {
      startListening(speaker);
    }
  };

  // Swap tourist & officer languages
  const swapLanguages = () => {
    const temp = touristLang;
    setTouristLang(officerLang);
    setOfficerLang(temp);
    toast.success("Languages swapped");
  };

  // Clear all states
  const clearConversation = () => {
    stopListening();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setTouristTranscript("");
    setOfficerTranscript("");
    setTouristTranslated("");
    setOfficerTranslated("");
    setHistory([]);
    toast.success("Conversation cleared");
  };

  const touristConfig = SUPPORTED_LANGUAGES.find((l) => l.code === touristLang)!;
  const officerConfig = SUPPORTED_LANGUAGES.find((l) => l.code === officerLang)!;

  // Reusable panel render function
  const renderPanel = (role: SpeakerRole, isRotated: boolean = false) => {
    const isTourist = role === "tourist";
    const currentLang = isTourist ? touristLang : officerLang;
    const setLang = isTourist ? setTouristLang : setOfficerLang;
    const config = isTourist ? touristConfig : officerConfig;
    const otherConfig = isTourist ? officerConfig : touristConfig;
    const transcript = isTourist ? touristTranscript : officerTranscript;
    const setTranscript = isTourist ? setTouristTranscript : setOfficerTranscript;
    const translatedText = isTourist ? touristTranslated : officerTranslated;
    const otherRole: SpeakerRole = isTourist ? "officer" : "tourist";
    const isCurrentActive = activeSpeaker === role;
    const isCurrentTranslating = isTranslating === otherRole;

    return (
      <GlassCard
        className={`p-4 sm:p-5 flex flex-col justify-between relative overflow-hidden transition-transform duration-300 ${
          isRotated ? "rotate-180 shadow-2xl" : ""
        } ${
          isTourist
            ? "border-2 border-primary/25 bg-white/45"
            : "border-2 border-[var(--sand)]/45 bg-white/45"
        }`}
      >
        <div className="space-y-3.5">
          {/* Panel Header */}
          <div className="flex items-center justify-between gap-2 border-b border-black/5 pb-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                  isTourist ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-700"
                }`}
              >
                {isTourist ? <User className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              </span>
              <div>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isTourist ? "text-primary" : "text-amber-800"
                  }`}
                >
                  {isTourist ? "Tourist Speaker" : "Police Officer"}
                </span>
                <p className="text-[10px] text-muted-foreground">
                  {isTourist ? "Speaks visitor language" : "Speaks local official language"}
                </p>
              </div>
            </div>

            {/* Language Selector Dropdown */}
            <div className="relative">
              <select
                value={currentLang}
                onChange={(e) => setLang(e.target.value)}
                className={`rounded-xl border border-white/70 bg-white/85 px-2 py-1 text-xs font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 cursor-pointer appearance-none pr-6 backdrop-blur-md ${
                  isTourist ? "focus:ring-primary/40" : "focus:ring-amber-500/40"
                }`}
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.nativeName})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[9px]">
                ▼
              </div>
            </div>
          </div>

          {/* Translated Content Received from the Other Speaker */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
              <span className="flex items-center gap-1">
                <Sparkles
                  className={`h-3.5 w-3.5 ${isTourist ? "text-emerald-600" : "text-primary"}`}
                />
                <span>
                  Translated from {isTourist ? "Officer" : "Tourist"} ({config.name}):
                </span>
              </span>
              {translatedText && (
                <button
                  onClick={() => speakText(translatedText, currentLang, `${role}-translated`)}
                  className="flex items-center gap-1 rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-foreground hover:bg-white shadow-xs cursor-pointer border border-white/70"
                >
                  <Volume2 className="h-3 w-3 text-primary" />
                  <span>Play Audio</span>
                </button>
              )}
            </div>

            <div
              className={`min-h-[75px] w-full rounded-2xl p-3 text-xs sm:text-sm font-medium shadow-inner backdrop-blur-md flex items-center justify-center ${
                isTourist
                  ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-950"
                  : "border border-primary/25 bg-primary/10 text-foreground"
              }`}
            >
              {isCurrentTranslating ? (
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Translating incoming speech…</span>
                </div>
              ) : translatedText ? (
                <p className="text-sm font-semibold leading-relaxed text-left w-full">
                  {translatedText}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic text-center">
                  Translation will appear here with voice audio.
                </p>
              )}
            </div>
          </div>

          {/* Spoken / Typed Input for this Speaker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <span>{isTourist ? "Tourist Says" : "Officer Response"}</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  ({config.name})
                </span>
              </label>
              {isCurrentActive && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-rose-600" />
                  Listening…
                </span>
              )}
            </div>

            <div className="min-h-[75px] w-full rounded-2xl border border-white/60 bg-white/65 p-2.5 text-xs text-foreground shadow-inner backdrop-blur-md flex flex-col justify-between">
              <p
                className={
                  transcript
                    ? "text-foreground leading-relaxed font-medium"
                    : "text-muted-foreground/60 italic text-[11px]"
                }
              >
                {transcript || (speechSupported ? `Tap mic below or type in ${config.name}…` : `Type your message in ${config.name}…`)}
              </p>

              {/* Manual Input Bar */}
              <div className="mt-2 flex items-center gap-1 pt-1.5 border-t border-black/5">
                <input
                  type="text"
                  placeholder={`Type in ${config.name}…`}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && transcript.trim()) {
                      void handleTranslate(transcript, role);
                    }
                  }}
                  className="h-8 flex-1 rounded-xl bg-white/90 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary border border-white/80"
                />
                <button
                  onClick={() => {
                    if (transcript.trim()) {
                      void handleTranslate(transcript, role);
                    }
                  }}
                  disabled={!transcript.trim() || isTranslating === role}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm disabled:opacity-40 cursor-pointer ${
                    isTourist ? "bg-primary" : "bg-amber-700"
                  }`}
                  title="Translate and Speak"
                >
                  {isTranslating === role ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Phrases */}
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Quick {isTourist ? "Tourist" : "Police"} Phrases:
            </span>
            <div className="flex flex-wrap gap-1">
              {QUICK_PHRASES[role].map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => {
                    setTranscript(phrase);
                    void handleTranslate(phrase, role);
                  }}
                  className="rounded-lg border border-white/70 bg-white/60 px-2 py-0.5 text-[10px] text-foreground hover:bg-white transition-colors cursor-pointer text-left shadow-xs"
                >
                  {phrase}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mic / Voice Button Area */}
        <div className="pt-4 flex flex-col items-center justify-center">
          {speechSupported ? (
            <>
              <div className="relative flex items-center justify-center">
                {isCurrentActive && (
                  <>
                    <span className="absolute h-16 w-16 rounded-full bg-rose-500/20 animate-ping" />
                    <span className="absolute h-20 w-20 rounded-full bg-rose-500/10 animate-pulse" />
                  </>
                )}
                <button
                  onClick={() => toggleListening(role)}
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 cursor-pointer ${
                    isCurrentActive
                      ? "bg-rose-600 text-white scale-110 shadow-rose-600/40"
                      : isTourist
                        ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-primary/30"
                        : "bg-amber-700 text-white hover:scale-105 active:scale-95 shadow-amber-700/30"
                  }`}
                  title={isCurrentActive ? "Stop Listening" : `Speak in ${config.name}`}
                >
                  {isCurrentActive ? (
                    <MicOff className="h-6 w-6 animate-pulse" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-foreground">
                {isCurrentActive
                  ? "Tap to Finish Speaking"
                  : `${isTourist ? "Tourist" : "Officer"}: Tap to Speak (${config.name})`}
              </p>
            </>
          ) : (
            <div className="rounded-xl bg-black/5 px-3 py-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Type your message above to translate & hear audio</span>
            </div>
          )}
        </div>
      </GlassCard>
    );
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-12">
      {/* Top Header & Toolbar */}
      <GlassCard className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Face-to-Face Voice Translator
              </h2>
              <p className="text-xs text-muted-foreground">
                Live two-way translation with auto voice output for Tourists and Police Officers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Mobile Face-to-Face 180° Flip Toggle */}
            <button
              onClick={() => setIsFaceToFaceRotated((prev) => !prev)}
              className={`md:hidden flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                isFaceToFaceRotated
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-900"
                  : "border-white/60 bg-white/70 text-foreground"
              }`}
              title="Toggle 180° Face-to-Face Table Mode"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>{isFaceToFaceRotated ? "180° Table Mode ON" : "Normal Stacked"}</span>
            </button>

            <PressButton
              variant="ghost"
              className="h-9 px-3 text-xs gap-1.5"
              onClick={swapLanguages}
              title="Swap Languages"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Swap</span>
            </PressButton>

            <PressButton
              variant="ghost"
              className="h-9 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={clearConversation}
              title="Clear all transcripts"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear</span>
            </PressButton>
          </div>
        </div>

        {/* Speech Support Warning Notice */}
        {!speechSupported && (
          <div className="mt-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground flex items-start gap-2.5 backdrop-blur-md">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-950">
                Voice input isn't supported in this browser.
              </p>
              <p className="text-amber-900/80 mt-0.5">
                Please use Chrome on Android for live microphone recognition, or type your message in the text box below. Audio translation will still play aloud automatically.
              </p>
            </div>
          </div>
        )}

        {/* Mic Permission Denied Banner */}
        {micPermissionDenied && (
          <div className="mt-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-950 flex items-start gap-2.5 backdrop-blur-md">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Microphone permission is blocked</p>
              <p className="text-rose-900/80 mt-0.5">
                Please allow microphone access in your browser site permissions to speak. You can still type in the text box below to translate.
              </p>
            </div>
          </div>
        )}
      </GlassCard>

      {/* ================= MOBILE SAMSUNG LIVE-TRANSLATE SPLIT SCREEN (< md) ================= */}
      <div className="flex flex-col gap-4 md:hidden">
        {/* Table Mode Notice */}
        {isFaceToFaceRotated && (
          <div className="text-center text-[11px] font-semibold text-muted-foreground px-2 py-0.5 bg-black/5 rounded-lg">
            🔄 Top panel is rotated 180° for officer sitting opposite across table
          </div>
        )}

        {/* Top Half: Police Officer Panel (Rotated 180° on mobile table mode) */}
        {renderPanel("officer", isFaceToFaceRotated)}

        {/* Center Divider Bar */}
        <div className="flex items-center justify-center gap-2 py-1">
          <div className="h-[1px] flex-1 bg-black/10" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 bg-white/40 rounded-full border border-white/60">
            Face-to-Face Split Screen
          </span>
          <div className="h-[1px] flex-1 bg-black/10" />
        </div>

        {/* Bottom Half: Tourist Panel (Normal 0° orientation) */}
        {renderPanel("tourist", false)}
      </div>

      {/* ================= DESKTOP SIDE-BY-SIDE TWO-COLUMN GRID (>= md) ================= */}
      <div className="hidden md:grid md:grid-cols-2 gap-5">
        {renderPanel("tourist", false)}
        {renderPanel("officer", false)}
      </div>

      {/* Conversation Dialogue Timeline */}
      {history.length > 0 && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-black/5 pb-2.5">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Languages className="h-4 w-4 text-primary" />
              <span>Conversation Transcript ({history.length} exchanges)</span>
            </h3>
            <span className="text-[11px] text-muted-foreground">Auto-saved for incident log</span>
          </div>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {history.map((entry) => {
                const isTourist = entry.speaker === "tourist";
                const isAudioPlaying = isPlayingAudio === entry.id;

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl p-3.5 border flex flex-col gap-2 ${
                      isTourist
                        ? "bg-primary/5 border-primary/20 ml-0 mr-2 sm:mr-10"
                        : "bg-amber-500/5 border-amber-500/20 mr-0 ml-2 sm:ml-10"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5 text-foreground">
                        {isTourist ? (
                          <>
                            <User className="h-3.5 w-3.5 text-primary" />
                            Tourist
                          </>
                        ) : (
                          <>
                            <Shield className="h-3.5 w-3.5 text-amber-700" />
                            Officer
                          </>
                        )}
                        <span className="text-[10px] font-normal text-muted-foreground uppercase">
                          ({entry.sourceLang} → {entry.targetLang})
                        </span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {entry.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-xl bg-white/75 p-2.5 border border-white/80">
                        <span className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                          Original ({entry.sourceLang.toUpperCase()}):
                        </span>
                        <p className="text-foreground">{entry.originalText}</p>
                      </div>

                      <div className="rounded-xl bg-primary/10 p-2.5 border border-primary/20 flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] font-semibold text-primary block mb-0.5">
                            Translation ({entry.targetLang.toUpperCase()}):
                          </span>
                          <p className="font-semibold text-foreground">{entry.translatedText}</p>
                        </div>
                        <div className="mt-2 self-end">
                          <button
                            onClick={() =>
                              speakText(entry.translatedText, entry.targetLang, entry.id)
                            }
                            className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            {isAudioPlaying ? (
                              <>
                                <VolumeX className="h-3 w-3 animate-pulse" />
                                <span>Playing…</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="h-3 w-3" />
                                <span>Replay Audio</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
