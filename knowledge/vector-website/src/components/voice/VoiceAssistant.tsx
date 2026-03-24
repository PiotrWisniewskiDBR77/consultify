"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { Mic, MicOff, Square, Send, X, RefreshCw, Loader2 } from "lucide-react";
import { GoogleGenAI, Modality } from "@google/genai";
import type { LiveServerMessage, Session } from "@google/genai";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/config";
import { getVoicePageId, voiceUi } from "@/data/voice";

type VoiceStatus = "idle" | "connecting" | "live" | "error";

const annaName: Record<Locale, string> = {
  en: "Anna — DBR77 Assistant",
  pl: "Anna — Asystentka DBR77",
  de: "Anna — DBR77 Assistentin",
  ja: "Anna — DBR77 アシスタント",
  ar: "Anna — مساعدة DBR77",
  es: "Anna — Asistente DBR77",
};

const statusLabel: Record<Locale, Record<VoiceStatus, string>> = {
  en: {
    idle: "Click the microphone to start",
    connecting: "Connecting...",
    live: "Listening — speak freely",
    error: "Connection error",
  },
  pl: {
    idle: "Kliknij mikrofon, aby rozpoczac",
    connecting: "Laczenie...",
    live: "Slucham — mow swobodnie",
    error: "Blad polaczenia",
  },
  de: {
    idle: "Klicken Sie auf das Mikrofon",
    connecting: "Verbindung wird hergestellt...",
    live: "Ich hoere zu — sprechen Sie frei",
    error: "Verbindungsfehler",
  },
  ja: {
    idle: "マイクをクリックして開始",
    connecting: "接続中...",
    live: "聞いています — 自由にお話しください",
    error: "接続エラー",
  },
  ar: {
    idle: "انقر على الميكروفون للبدء",
    connecting: "جارٍ الاتصال...",
    live: "أستمع — تحدث بحرية",
    error: "خطأ في الاتصال",
  },
  es: {
    idle: "Haga clic en el micrófono para comenzar",
    connecting: "Conectando...",
    live: "Escuchando — hable libremente",
    error: "Error de conexión",
  },
};

const mutedLabel: Record<Locale, string> = {
  en: "Microphone muted",
  pl: "Mikrofon wyciszony",
  de: "Mikrofon stummgeschaltet",
  ja: "マイクがミュートされています",
  ar: "الميكروفون مكتوم",
  es: "Micrófono silenciado",
};

function buildSystemInstruction(locale: string, pageId: string): string {
  const pageContext: Record<string, string> = {
    training:
      "The user is on the TRAINING page. Focus on how Vector was trained, the 1400+ cases, competencies.",
    deployment:
      "The user is on the DEPLOYMENT page. Focus on three deployment models, isolation, control.",
    products:
      "The user is on the PRODUCTS page. Focus on how Vector works inside Consultify, Digital Twin, IoT, Marketplace.",
    security:
      "The user is on the SECURITY page. Focus on anonymization, deployment isolation, governance.",
  };
  const ctx =
    pageContext[pageId] ||
    "The user is on the HOMEPAGE. Give balanced overview answers about the full DBR77 ecosystem.";

  return `You are Anna, the DBR77 voice assistant. Your voice is warm, calm, professional, and feminine. You sound like a senior industrial AI strategist — not a chatbot, not a salesperson.

Your name is Anna. You introduce yourself naturally at the start of the conversation. You represent the entire DBR77 ecosystem.

Intro examples by language:
- English: "Hi, I'm Anna, the DBR77 assistant."
- Polish: "Cześć, jestem Anna, asystentka DBR77."
- German: "Hallo, ich bin Anna, die DBR77-Assistentin."
- Japanese: "こんにちは、Anna、DBR77アシスタントです。"
- Arabic: "مرحبًا، أنا Anna، مساعدة DBR77."
- Spanish: "Hola, soy Anna, la asistente de DBR77."

COMPANY KNOWLEDGE:

DBR77 is a comprehensive platform for digital transformation of industry. Mission: enable people to perform fulfilling work and help businesses succeed. DBR77 integrates IoT, Digital Twin, AI, and automation into one ecosystem. Philosophy: Measure, Optimize, Automate — in that order.

Three steps: 1) IoT (Measure) — real-time data from every production facility object. 2) Digital Twin (Optimize) — 3D virtual model for simulation and optimization. 3) Marketplace (Automate) — B2B platform connecting manufacturers with technology providers.

Key differentiators: all-in-one platform, 3D Digital Twin, Marketplace, proprietary LLM, strategic partner of Saudi Ministry of Industry (Vision 2030), global deployment (Tokyo, Charlotte, Riyadh, Berlin, Warsaw), built by former automotive CEOs, Nvidia engineers, Harvard alumni. Trusted by Fanuc, Wielton, Yaskawa, Kuka, Hitachi.

DBR77 Vector — proprietary LLM trained on 1400+ real factory transformation cases. Covers plant optimization, greenfield layout, production flow, process improvement, shop-floor automation. Anonymized, governed, continuously refined. Six competency areas: factory diagnosis, transformation roadmap, production decision support, ROI reasoning, automation strategy, Lean excellence. Three deployment models: On-Premise (zero data leaves), Private Dedicated API (single-tenant), Shared API (fast start).

Consultify (consultify.ai) — AI-powered strategic consulting platform. Strategic AI Advisor, Financial Modeling, Initiative Management, Report Builder, AI Expert Interview, Impact Tracking. Enterprise security: ISO 27001, SOC2, GDPR, AES-256. Free trial available.

Digital Twin — 3D virtual facility model. Simulation, layout optimization, what-if scenarios.
IoT — real-time sensor data, PLC connectivity, Wi-Fi, LoRaWAN, LTE.
Marketplace — two-sided B2B platform, automation selection, technology matching.

Security: client data NEVER trains the model, queries not stored beyond session, deployment isolation, human approval in the loop, SOC2, GDPR, air-gapped compatible.

RULES:
1. Language: ALWAYS respond in the same language as the user. Supported languages: English, Polish, German, Japanese, Arabic, Spanish. Match their language automatically.
2. Scope: Only discuss DBR77 and its products. If asked about unrelated topics, politely redirect.
3. Tone: Professional, calm, precise, confident. Like a senior strategist explaining to a C-level executive.
4. Length: Keep answers concise — 2-4 sentences for simple questions, up to 6 for complex ones. This is a voice conversation.
5. No hallucination: Only state facts from the knowledge above.
6. No capability claims: You explain the products. The products do the work.
7. Proactive guidance: After answering, briefly suggest what else you can explain.
8. When relevant, mention Consultify free trial and demo scheduling.

CURRENT CONTEXT: ${ctx}
The page locale is ${locale}, but always match the user's spoken language.`;
}

export function VoiceAssistant() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const pageId = getVoicePageId(pathname);
  const ui = voiceUi[locale];
  const { theme } = useThemeContext();
  const isLight = theme === "light";

  const [isOpen, setIsOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");

  const mutedRef = useRef(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const connect = useCallback(async () => {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setErrorMsg("Gemini API key not configured");
      setVoiceStatus("error");
      return;
    }

    setVoiceStatus("connecting");
    setErrorMsg(null);

    try {
      const ai = new GoogleGenAI({ apiKey });

      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      nextPlayTimeRef.current = audioContextRef.current.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        4096,
        1,
        1
      );
      processorRef.current = processor;

      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Kore" },
            },
          },
          systemInstruction: buildSystemInstruction(locale, pageId),
        },
        callbacks: {
          onopen: () => {
            setVoiceStatus("live");

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);
              if (mutedRef.current) {
                pcm16.fill(0);
              } else {
                for (let i = 0; i < inputData.length; i++) {
                  const s = Math.max(-1, Math.min(1, inputData[i]));
                  pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }
              }

              const buffer = new ArrayBuffer(pcm16.length * 2);
              const view = new DataView(buffer);
              for (let i = 0; i < pcm16.length; i++) {
                view.setInt16(i * 2, pcm16[i], true);
              }

              let binary = "";
              const bytes = new Uint8Array(buffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64 = btoa(binary);

              sessionPromise.then((session) => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: "audio/pcm;rate=16000",
                    data: base64,
                  },
                });
              });
            };

            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((src) => {
                try {
                  src.stop();
                } catch {
                  /* already stopped */
                }
              });
              activeSourcesRef.current = [];
              if (audioContextRef.current) {
                nextPlayTimeRef.current = audioContextRef.current.currentTime;
              }
            }

            const parts = message.serverContent?.modelTurn?.parts;
            const base64Audio = parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
              const binaryString = atob(base64Audio);
              const len = binaryString.length;
              const bytesArr = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytesArr[i] = binaryString.charCodeAt(i);
              }
              const pcm16 = new Int16Array(bytesArr.buffer);
              const audioBuffer = audioContextRef.current.createBuffer(
                1,
                pcm16.length,
                24000
              );
              const channelData = audioBuffer.getChannelData(0);
              for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
              }

              const playSource =
                audioContextRef.current.createBufferSource();
              playSource.buffer = audioBuffer;
              playSource.connect(audioContextRef.current.destination);

              const startTime = Math.max(
                nextPlayTimeRef.current,
                audioContextRef.current.currentTime
              );
              playSource.start(startTime);
              nextPlayTimeRef.current = startTime + audioBuffer.duration;

              activeSourcesRef.current.push(playSource);
              playSource.onended = () => {
                activeSourcesRef.current =
                  activeSourcesRef.current.filter((s) => s !== playSource);
              };
            }
          },
          onclose: () => {
            disconnect();
          },
          onerror: (err: unknown) => {
            console.error("Gemini Live error:", err);
            const onerrorMessages: Record<Locale, string> = {
              en: "Connection error with the assistant.",
              pl: "Blad polaczenia z asystentem.",
              de: "Verbindungsfehler mit dem Assistenten.",
              ja: "アシスタントとの接続エラーが発生しました。",
              ar: "خطأ في الاتصال بالمساعد.",
              es: "Error de conexión con el asistente.",
            };
            setErrorMsg(onerrorMessages[locale]);
            disconnect();
            setVoiceStatus("error");
          },
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Connection error:", err);
      const catchMessages: Record<Locale, string> = {
        en: "Could not access microphone or connect to assistant.",
        pl: "Nie udalo sie uzyskac dostepu do mikrofonu lub polaczyc z asystentem.",
        de: "Mikrofon- oder Verbindungsfehler.",
        ja: "マイクへのアクセスまたはアシスタントへの接続に失敗しました。",
        ar: "تعذر الوصول إلى الميكروفون أو الاتصال بالمساعد.",
        es: "No se pudo acceder al micrófono o conectar con el asistente.",
      };
      setErrorMsg(catchMessages[locale]);
      setVoiceStatus("error");
      disconnect();
    }
  }, [locale, pageId]);

  const disconnect = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        /* already closed */
      }
      sessionRef.current = null;
    }
    activeSourcesRef.current = [];
    setVoiceStatus("idle");
    setIsMuted(false);
    mutedRef.current = false;
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      return next;
    });
  }, []);

  const sendText = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    setTextInput("");

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          locale,
          pageId,
          history: [],
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.answer) return;

      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.answer, locale }),
      });
      if (!ttsRes.ok) return;
      const blob = await ttsRes.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      /* silent fail for text fallback */
    }
  }, [locale, pageId, textInput]);

  const isLive = voiceStatus === "live";

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {isOpen && (
        <div
          className={cn(
            "flex w-[360px] max-w-full flex-col overflow-hidden rounded-2xl border shadow-2xl sm:w-[400px]",
            isLight
              ? "border-black/[0.08] bg-white shadow-black/10"
              : "border-white/[0.08] bg-navy-950 shadow-black/40"
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              isLight
                ? "border-b border-black/[0.06] bg-slate-50"
                : "border-b border-white/[0.06] bg-navy-900"
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF751F] text-sm font-bold text-white">
              A
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-semibold",
                  isLight ? "text-slate-900" : "text-white"
                )}
              >
                {annaName[locale]}
              </p>
              <p
                className={cn(
                  "truncate text-xs",
                  isLight ? "text-slate-500" : "text-slate-400"
                )}
              >
                {isLive && isMuted
                  ? mutedLabel[locale]
                  : statusLabel[locale][voiceStatus]}
              </p>
            </div>
            {isLive && (
              <button
                type="button"
                onClick={() => {
                  disconnect();
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                  isLight
                    ? "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                    : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
                )}
                aria-label="Reset"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                disconnect();
                setIsOpen(false);
              }}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                isLight
                  ? "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                  : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
              )}
              aria-label="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Main area */}
          <div
            className={cn(
              "flex flex-col items-center justify-center px-6 py-8",
              isLight ? "bg-white" : "bg-navy-950"
            )}
            style={{ minHeight: 280 }}
          >
            <p
              className={cn(
                "mb-8 text-center text-sm leading-relaxed",
                isLight ? "text-slate-500" : "text-slate-400"
              )}
            >
              {ui.transcriptEmptyBody}
            </p>

            {errorMsg && (
              <div
                className={cn(
                  "mb-6 w-full rounded-lg border px-4 py-3 text-xs",
                  isLight
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-red-900/30 bg-red-950/20 text-red-400"
                )}
              >
                {errorMsg}
              </div>
            )}

            {/* Mic / connect / disconnect */}
            {voiceStatus === "idle" || voiceStatus === "error" ? (
              <button
                type="button"
                onClick={connect}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FF751F] text-white shadow-lg transition-all hover:scale-105 hover:bg-[#FF751F]/90"
                aria-label="Start conversation"
              >
                <Mic className="h-7 w-7" />
              </button>
            ) : voiceStatus === "connecting" ? (
              <button
                type="button"
                disabled
                className="flex h-16 w-16 cursor-not-allowed items-center justify-center rounded-full bg-amber-500 text-white opacity-70"
                aria-label="Connecting"
              >
                <Loader2 className="h-7 w-7 animate-spin" />
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={toggleMute}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-all hover:scale-105",
                    isMuted
                      ? "bg-amber-500 text-white"
                      : isLight
                        ? "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        : "bg-white/[0.08] text-slate-300 hover:bg-white/[0.12]"
                  )}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={disconnect}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all hover:scale-105 hover:bg-red-600"
                  aria-label="Stop conversation"
                >
                  <Square className="h-6 w-6" />
                </button>
              </div>
            )}

            {/* Audio visualizer when live */}
            {isLive && (
              <div className="mt-6 flex items-center justify-center gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-1.5 rounded-full",
                      isMuted ? "bg-amber-500" : "bg-[#FF751F]"
                    )}
                    style={
                      isMuted
                        ? { height: 6 }
                        : {
                            animation: "voicePulse 1s ease-in-out infinite",
                            animationDelay: `${delay}s`,
                            height: 6,
                          }
                    }
                  />
                ))}
              </div>
            )}

            <p
              className={cn(
                "mt-4 text-xs",
                isLight ? "text-slate-400" : "text-slate-500"
              )}
            >
              {isLive && isMuted
                ? mutedLabel[locale]
                : statusLabel[locale][voiceStatus]}
            </p>
          </div>

          {/* Text input fallback */}
          <div
            className={cn(
              "flex items-center gap-2 px-3 pb-3",
              isLight
                ? "border-t border-black/[0.06]"
                : "border-t border-white/[0.06]"
            )}
            style={{ paddingTop: 12 }}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder={ui.placeholder}
              className={cn(
                "flex-1 rounded-full border px-3 py-2 text-xs outline-none transition-colors",
                isLight
                  ? "border-black/[0.08] bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-[#FF751F]/40"
                  : "border-white/[0.08] bg-navy-900 text-white placeholder:text-slate-500 focus:border-[#FF751F]/40"
              )}
            />
            <button
              type="button"
              onClick={sendText}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF751F] text-white transition-colors hover:bg-[#FF751F]/80"
              aria-label={ui.send}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          isOpen
            ? isLight
              ? "bg-slate-200 text-slate-600"
              : "bg-navy-800 text-slate-300"
            : isLive
              ? "animate-pulse bg-[#FF751F] text-white ring-4 ring-[#FF751F]/30"
              : "bg-[#FF751F] text-white hover:scale-105"
        )}
        aria-label="Voice assistant"
      >
        {isOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>

      {/* Keyframe for audio bars */}
      <style jsx global>{`
        @keyframes voicePulse {
          0%,
          100% {
            height: 6px;
          }
          50% {
            height: 20px;
          }
        }
      `}</style>
    </div>
  );
}
