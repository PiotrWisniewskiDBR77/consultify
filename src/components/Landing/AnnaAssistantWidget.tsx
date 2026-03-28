import type { LiveServerMessage, Session } from '@google/genai';
import { GoogleGenAI, Modality } from '@google/genai';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Loader2, MessageCircle, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { normalizeLanguageCode } from '../../i18n';
import { ROUTES } from '../../routes/routeConfig';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import { postPublicAnnaFunnelEvent } from '../../services/publicAnnaAnalytics';

type AnnaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';

type AnnaCopy = {
  title: string;
  subtitle: string;
  intro: string;
  placeholder: string;
  send: string;
  open: string;
  loading: string;
  suggestionsLabel: string;
  privacyBadge: string;
  suggestions: string[];
  error: string;
  voiceReady: string;
  voiceConnecting: string;
  voiceListening: string;
  voiceUnavailable: string;
  voiceError: string;
  voiceStart: string;
  voiceStop: string;
  handoffLabel: string;
  demoCta: string;
  trialCta: string;
  contactCta: string;
};

type AnnaWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const LIVE_VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const LIVE_VOICE_NAME = 'Kore';
const FRONTEND_GEMINI_KEY =
  process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;

const COPY: Record<'en' | 'pl' | 'es' | 'de' | 'jp' | 'ar', AnnaCopy> = {
  en: {
    title: 'Anna',
    subtitle: 'Public product assistant',
    intro:
      'I can explain Consultify, DBR77 Vector, digital transformation, demo, trial, and public security topics. I do not have access to client or project data.',
    placeholder: 'Ask Anna about the product...',
    send: 'Send',
    open: 'Ask Anna',
    loading: 'Anna is thinking...',
    suggestionsLabel: 'Try asking:',
    privacyBadge: 'Public knowledge only',
    suggestions: [
      'What is Consultify?',
      'How does DBR77 Vector fit into Consultify?',
      'Who is Consultify for?',
      'Why start with a demo or trial?',
    ],
    error:
      'Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.',
    voiceReady: 'Tap the microphone to start a live voice conversation.',
    voiceConnecting: 'Connecting voice mode...',
    voiceListening: 'Anna is listening live. Start typing anytime to switch back to text.',
    voiceUnavailable: 'Live voice is currently unavailable. You can still chat with Anna by text.',
    voiceError: 'Live voice ran into an issue. You can continue with Anna by text.',
    voiceStart: 'Start voice conversation',
    voiceStop: 'Stop voice conversation',
    handoffLabel: 'Quick next steps',
    demoCta: 'Try Demo',
    trialCta: 'Start Trial',
    contactCta: 'Contact',
  },
  pl: {
    title: 'Anna',
    subtitle: 'Publiczna asystentka produktowa',
    intro:
      'Moge wyjasnic Consultify, DBR77 Vector, transformacje cyfrowa, demo, trial i publiczne kwestie bezpieczenstwa. Nie mam dostepu do danych klienta ani projektow.',
    placeholder: 'Zapytaj Anne o produkt...',
    send: 'Wyslij',
    open: 'Zapytaj Anne',
    loading: 'Anna analizuje...',
    suggestionsLabel: 'Mozesz zapytac:',
    privacyBadge: 'Tylko wiedza publiczna',
    suggestions: [
      'Czym jest Consultify?',
      'Jak DBR77 Vector wspiera Consultify?',
      'Dla kogo jest Consultify?',
      'Dlaczego warto zaczac od demo lub triala?',
    ],
    error:
      'Nasz asystent AI jest tymczasowo niedostepny. Przejrzyj prosze strone lub skontaktuj sie z nami bezposrednio.',
    voiceReady: 'Kliknij mikrofon, aby uruchomic rozmowe glosowa na zywo.',
    voiceConnecting: 'Lacze tryb glosowy...',
    voiceListening: 'Anna slucha na zywo. Zacznij pisac w dowolnym momencie, aby wrocic do tekstu.',
    voiceUnavailable: 'Tryb glosowy jest tymczasowo niedostepny. Nadal mozesz pisac z Anna.',
    voiceError: 'Wystapil problem z trybem glosowym. Mozesz kontynuowac rozmowe w tekscie.',
    voiceStart: 'Uruchom rozmowe glosowa',
    voiceStop: 'Zatrzymaj rozmowe glosowa',
    handoffLabel: 'Szybkie kolejne kroki',
    demoCta: 'Wyprobuj demo',
    trialCta: 'Rozpocznij trial',
    contactCta: 'Kontakt',
  },
  es: {
    title: 'Anna',
    subtitle: 'Asistente publica de producto',
    intro:
      'Puedo explicar Consultify, DBR77 Vector, transformacion digital, demo, trial y temas publicos de seguridad. No tengo acceso a datos de clientes ni de proyectos.',
    placeholder: 'Preguntale a Anna sobre el producto...',
    send: 'Enviar',
    open: 'Preguntale a Anna',
    loading: 'Anna esta pensando...',
    suggestionsLabel: 'Puedes preguntar:',
    privacyBadge: 'Solo conocimiento publico',
    suggestions: [
      'Que es Consultify?',
      'Como encaja DBR77 Vector en Consultify?',
      'Para quien es Consultify?',
      'Por que empezar con un demo o un trial?',
    ],
    error:
      'Nuestro asistente AI no esta disponible temporalmente. Explora la pagina o contactanos directamente.',
    voiceReady: 'Toca el microfono para iniciar una conversacion de voz en vivo.',
    voiceConnecting: 'Conectando modo de voz...',
    voiceListening:
      'Anna esta escuchando en vivo. Empieza a escribir en cualquier momento para volver al texto.',
    voiceUnavailable: 'La voz en vivo no esta disponible temporalmente. Aun puedes chatear por texto.',
    voiceError: 'La voz en vivo tuvo un problema. Puedes continuar por texto.',
    voiceStart: 'Iniciar conversacion de voz',
    voiceStop: 'Detener conversacion de voz',
    handoffLabel: 'Siguientes pasos rapidos',
    demoCta: 'Probar demo',
    trialCta: 'Iniciar trial',
    contactCta: 'Contacto',
  },
  de: {
    title: 'Anna',
    subtitle: 'Offentliche Produktassistentin',
    intro:
      'Ich kann Consultify, DBR77 Vector, digitale Transformation, Demo, Trial und offentliche Sicherheitsthemen erklaren. Ich habe keinen Zugriff auf Kunden- oder Projektdaten.',
    placeholder: 'Frage Anna zum Produkt...',
    send: 'Senden',
    open: 'Frag Anna',
    loading: 'Anna denkt nach...',
    suggestionsLabel: 'Du kannst fragen:',
    privacyBadge: 'Nur offentliches Wissen',
    suggestions: [
      'Was ist Consultify?',
      'Wie passt DBR77 Vector zu Consultify?',
      'Fur wen ist Consultify gedacht?',
      'Warum mit einem Demo oder Trial starten?',
    ],
    error:
      'Unser AI-Assistent ist vorubergehend nicht verfugbar. Schau dir bitte die Seite an oder kontaktiere uns direkt.',
    voiceReady: 'Tippe auf das Mikrofon, um ein Live-Sprachgesprach zu starten.',
    voiceConnecting: 'Sprachmodus wird verbunden...',
    voiceListening: 'Anna hort live zu. Du kannst jederzeit tippen, um zum Text zuruckzukehren.',
    voiceUnavailable: 'Live-Sprachmodus ist vorubergehend nicht verfugbar. Du kannst weiter tippen.',
    voiceError: 'Live-Sprachmodus hatte ein Problem. Du kannst per Text fortfahren.',
    voiceStart: 'Sprachgesprach starten',
    voiceStop: 'Sprachgesprach stoppen',
    handoffLabel: 'Schnelle nachste Schritte',
    demoCta: 'Demo testen',
    trialCta: 'Trial starten',
    contactCta: 'Kontakt',
  },
  jp: {
    title: 'Anna',
    subtitle: '公開プロダクトアシスタント',
    intro:
      'Consultify、DBR77 Vector、デジタルトランスフォーメーション、デモ、トライアル、公開されているセキュリティ情報について説明できます。顧客データやプロジェクトデータにはアクセスできません。',
    placeholder: 'Annaに製品について質問してください...',
    send: '送信',
    open: 'Annaに聞く',
    loading: 'Annaが考えています...',
    suggestionsLabel: '例えば次のように聞けます:',
    privacyBadge: '公開情報のみ',
    suggestions: [
      'Consultifyとは何ですか？',
      'DBR77 VectorはConsultifyにどう関係しますか？',
      'Consultifyは誰のためのものですか？',
      'なぜデモやトライアルから始めるべきですか？',
    ],
    error:
      'AIアシスタントは現在一時的に利用できません。ページをご覧いただくか、直接お問い合わせください。',
    voiceReady: 'マイクをタップするとライブ音声会話を開始できます。',
    voiceConnecting: '音声モードに接続中...',
    voiceListening: 'Annaがライブで聞いています。いつでも入力してテキストに戻れます。',
    voiceUnavailable: 'ライブ音声は現在利用できません。テキストでチャットできます。',
    voiceError: 'ライブ音声で問題が発生しました。テキストで続けられます。',
    voiceStart: '音声会話を開始',
    voiceStop: '音声会話を停止',
    handoffLabel: '次のおすすめステップ',
    demoCta: 'デモを試す',
    trialCta: 'トライアルを開始',
    contactCta: 'お問い合わせ',
  },
  ar: {
    title: 'Anna',
    subtitle: 'مساعدة المنتجات العامة',
    intro:
      'يمكنني شرح Consultify وDBR77 Vector والتحول الرقمي والعرض التجريبي والنسخة التجريبية وموضوعات الأمان العامة. لا أملك وصولا إلى بيانات العملاء أو المشاريع.',
    placeholder: 'اسأل Anna عن المنتج...',
    send: 'إرسال',
    open: 'اسأل Anna',
    loading: 'Anna تفكر...',
    suggestionsLabel: 'يمكنك أن تسأل:',
    privacyBadge: 'معرفة عامة فقط',
    suggestions: [
      'ما هو Consultify؟',
      'كيف ينسجم DBR77 Vector مع Consultify؟',
      'لمن صمم Consultify؟',
      'لماذا أبدأ بعرض تجريبي أو نسخة تجريبية؟',
    ],
    error:
      'مساعد الذكاء الاصطناعي غير متاح مؤقتا حاليا. يرجى استكشاف الصفحة أو التواصل معنا مباشرة.',
    voiceReady: 'اضغط على الميكروفون لبدء محادثة صوتية مباشرة.',
    voiceConnecting: 'جار الاتصال بوضع الصوت...',
    voiceListening: 'Anna تستمع الآن مباشرة. يمكنك البدء بالكتابة في أي وقت للعودة إلى النص.',
    voiceUnavailable: 'المحادثة الصوتية المباشرة غير متاحة حاليا. يمكنك المتابعة بالكتابة.',
    voiceError: 'حدثت مشكلة في المحادثة الصوتية. يمكنك المتابعة بالكتابة.',
    voiceStart: 'بدء المحادثة الصوتية',
    voiceStop: 'إيقاف المحادثة الصوتية',
    handoffLabel: 'الخطوات التالية السريعة',
    demoCta: 'تجربة العرض',
    trialCta: 'بدء النسخة التجريبية',
    contactCta: 'تواصل معنا',
  },
};

function buildVoiceSystemInstruction(
  lang: 'en' | 'pl' | 'es' | 'de' | 'jp' | 'ar',
  knowledgeContext?: string
): string {
  if (lang === 'pl') {
    return `Jestes Anna, publiczna asystentka glosowa Consultify i DBR77 Vector.

Twoj glos ma byc cieply, spokojny, profesjonalny i kobiecy. Brzmisz jak doswiadczona strategiczna konsultantka AI, a nie chatbot ani agresywny handlowiec.

Zasady:
- Odpowiadaj zawsze w jezyku uzytkownika.
- Priorytetem jest Consultify. O innych produktach DBR mow dopiero wtedy, gdy uzytkownik pyta wprost albo gdy to pomaga wyjasnic role Consultify.
- Odpowiedzi maja byc krotkie, naturalne i mowione: zwykle 2-4 zdania.
- Nie wymyslaj faktow i nie obiecuj funkcji, ktorych nie opisano publicznie.
- Gdy to pasuje, wspomnij o demo lub trialu.

Publiczna wiedza:
Consultify to platforma AI do doradztwa strategicznego. DBR77 Vector to wyspecjalizowany model dla transformacji przemyslu i operacji. Mozesz wyjasniac produkt, wartosc biznesowa, wdrozenia, bezpieczenstwo i kolejne kroki rozmowy, ale nie masz dostepu do danych klienta ani projektow.

Kontekst wiedzy:
${String(knowledgeContext || 'Brak dodatkowego kontekstu produktowego. Pozostan przy ostroznych, publicznych faktach.')}`;
  }

  if (lang === 'es') {
    return `Eres Anna, la asistente publica de voz para Consultify y DBR77 Vector.

Tu voz debe ser calida, tranquila, profesional y femenina. Suenas como una consultora senior de estrategia AI, no como un chatbot ni una vendedora agresiva.

Reglas:
- Responde siempre en el idioma del usuario.
- Da prioridad a Consultify por defecto. Habla de otros productos DBR solo cuando el usuario lo pida de forma explicita o cuando eso ayude a explicar el papel de Consultify.
- Mantén las respuestas cortas, naturales y faciles de escuchar: normalmente 2-4 frases.
- No inventes hechos ni prometas capacidades que no sean publicas.
- Cuando ayude, menciona el demo o el trial.

Conocimiento publico:
Consultify es una plataforma de consultoria estrategica impulsada por AI. DBR77 Vector es un modelo especializado para transformacion industrial y operaciones. Puedes explicar valor del producto, opciones de despliegue, seguridad y siguientes pasos, pero no tienes acceso a datos de clientes ni de proyectos.

Contexto de conocimiento:
${String(knowledgeContext || 'No se cargo contexto adicional del producto. Manten solo hechos publicos verificados.')}`;
  }

  if (lang === 'de') {
    return `Du bist Anna, die offentliche Sprachassistentin fur Consultify und DBR77 Vector.

Deine Stimme soll warm, ruhig, professionell und weiblich wirken. Du klingst wie eine erfahrene Senior-Beraterin fur AI-Strategie, nicht wie ein Chatbot oder eine aufdringliche Verkauferin.

Regeln:
- Antworte immer in der Sprache des Nutzers.
- Priorisiere standardmassig Consultify. Sprich uber andere DBR-Produkte nur, wenn der Nutzer direkt danach fragt oder wenn es hilft, die Rolle von Consultify zu erklaren.
- Halte Antworten kurz, naturlich und gut sprechbar: normalerweise 2-4 Satze.
- Erfinde keine Fakten und verspreche keine Funktionen, die nicht offentlich beschrieben sind.
- Wenn es passt, erwahne Demo oder Trial.

Offentliches Wissen:
Consultify ist eine AI-gestutzte Plattform fur strategische Beratung. DBR77 Vector ist ein spezialisiertes Modell fur industrielle Transformation und Operations. Du kannst Produktwert, Bereitstellungsoptionen, Sicherheit und nachste Schritte erklaren, hast aber keinen Zugriff auf Kunden- oder Projektdaten.

Wissenskontext:
${String(knowledgeContext || 'Es wurde kein zusatzlicher Produktkontext geladen. Bleibe bei verifizierten offentlichen Fakten.')}`;
  }

  if (lang === 'jp') {
    return `あなたはConsultifyとDBR77 Vectorの公開向け音声アシスタントAnnaです。

声は温かく、落ち着いていて、プロフェッショナルで、女性らしい印象にしてください。チャットボットや押しの強い営業ではなく、経験豊富なAI戦略コンサルタントのように話します。

ルール:
- いつもユーザーの言語で答えてください。
- 基本的にはConsultifyを優先してください。他のDBR製品については、ユーザーが明示的に尋ねた場合や、Consultifyの役割を説明するのに必要な場合だけ触れてください。
- 回答は短く自然で、音声向きにしてください。通常は2〜4文です。
- 公開されていない事実や機能を作り上げないでください。
- 必要ならデモやトライアルに触れてください。

公開情報:
ConsultifyはAIを活用した戦略コンサルティングプラットフォームです。DBR77 Vectorは産業変革とオペレーション向けの特化モデルです。製品価値、導入オプション、セキュリティ、次のステップは説明できますが、顧客データやプロジェクトデータにはアクセスできません。

知識コンテキスト:
${String(knowledgeContext || '追加の製品コンテキストは読み込まれていません。公開された検証済みの事実だけを使ってください。')}`;
  }

  if (lang === 'ar') {
    return `أنت Anna، المساعدة الصوتية العامة لـ Consultify وDBR77 Vector.

يجب أن يكون صوتك دافئا وهادئا ومهنيا وأنثويا. تبدين مثل مستشارة استراتيجية ذكاء اصطناعي خبيرة، لا مثل روبوت محادثة أو بائعة ضاغطة.

القواعد:
- أجيبي دائما بلغة المستخدم.
- أعطي الأولوية لـ Consultify بشكل افتراضي. اذكري منتجات DBR الأخرى فقط عندما يطلب المستخدم ذلك صراحة أو عندما يساعد ذلك في شرح دور Consultify.
- اجعلي الإجابات قصيرة وطبيعية وسهلة الاستماع، عادة من جملتين إلى أربع جمل.
- لا تختلقي حقائق ولا تعدي بقدرات غير معلنة علنا.
- عندما يكون ذلك مفيدا، اذكري العرض التجريبي أو النسخة التجريبية.

المعرفة العامة:
Consultify منصة استشارات استراتيجية مدعومة بالذكاء الاصطناعي. وDBR77 Vector نموذج متخصص للتحول الصناعي والعمليات. يمكنك شرح قيمة المنتج وخيارات النشر والأمان والخطوات التالية، لكنك لا تملكين وصولا إلى بيانات العملاء أو المشاريع.

سياق المعرفة:
${String(knowledgeContext || 'لم يتم تحميل سياق إضافي للمنتج. التزمي فقط بالحقائق العامة المتحقق منها.')}`;
  }

  return `You are Anna, the public voice assistant for Consultify and DBR77 Vector.

Your voice is warm, calm, professional, and feminine. You sound like a senior AI strategy consultant, not a chatbot or a pushy salesperson.

Rules:
- Always respond in the user's language.
- Prioritize Consultify by default. Discuss other DBR products only when the user explicitly asks or when they clarify how Consultify fits the wider DBR system.
- Keep answers short, natural, and voice-friendly: usually 2-4 sentences.
- Do not invent facts or promise capabilities that are not public.
- When helpful, mention the demo or free trial path.

Public knowledge:
Consultify is an AI-powered strategic consulting platform. DBR77 Vector is a specialized model for industrial transformation and operations. You can explain product value, deployment options, security, and next steps, but you do not have access to any client or project data.

Knowledge context:
${String(knowledgeContext || 'No additional product context was loaded. Stay conservative and use only verified public facts.')}`;
}

interface AnnaAssistantWidgetProps {
  onDemoClick?: () => void;
  onTrialClick?: () => void;
  onContactClick?: () => void;
}

export const AnnaAssistantWidget: React.FC<AnnaAssistantWidgetProps> = ({
  onDemoClick,
  onTrialClick,
  onContactClick,
}) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  const shouldShowSources =
    !isTestEnv &&
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('stage.'));
  const resolvedLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const lang: 'en' | 'pl' | 'es' | 'de' | 'jp' | 'ar' =
    resolvedLanguage === 'pl' ||
    resolvedLanguage === 'es' ||
    resolvedLanguage === 'de' ||
    resolvedLanguage === 'jp' ||
    resolvedLanguage === 'ar'
      ? resolvedLanguage
      : 'en';
  const copy = COPY[lang];
  const isRtl = lang === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceApiKey, setVoiceApiKey] = useState<string | null>(FRONTEND_GEMINI_KEY || null);
  const [voiceName, setVoiceName] = useState(LIVE_VOICE_NAME);
  const [messages, setMessages] = useState<AnnaMessage[]>(() => [
    {
      id: 'anna-welcome',
      role: 'assistant',
      content: copy.intro,
    },
  ]);

  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const voiceStartRef = useRef<number>(0);
  const hasLiveVoiceSessionRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextPlayTimeRef = useRef(0);
  const visibleSessionRef = useRef(0);
  const voiceAttemptRef = useRef(0);
  const voiceUserDraftRef = useRef<{ id: string | null; text: string }>({ id: null, text: '' });
  const voiceAssistantDraftRef = useRef<{ id: string | null; text: string }>({
    id: null,
    text: '',
  });

  const resetVoiceTranscriptDrafts = useCallback(() => {
    voiceUserDraftRef.current = { id: null, text: '' };
    voiceAssistantDraftRef.current = { id: null, text: '' };
  }, []);

  const upsertVoiceTranscriptMessage = useCallback(
    (
      role: AnnaMessage['role'],
      content: string,
      draftRef: React.MutableRefObject<{ id: string | null; text: string }>
    ) => {
      const trimmedContent = content.trim();
      if (!trimmedContent) return;

      const messageId =
        draftRef.current.id || `voice-${role}-${visibleSessionRef.current}-${Date.now()}`;

      if (draftRef.current.id === messageId && draftRef.current.text === trimmedContent) {
        return;
      }

      draftRef.current = {
        id: messageId,
        text: trimmedContent,
      };

      setMessages((prev) => {
        const existingIndex = prev.findIndex((message) => message.id === messageId);
        if (existingIndex >= 0) {
          if (prev[existingIndex]?.content === trimmedContent) {
            return prev;
          }

          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            content: trimmedContent,
          };
          return next;
        }

        return [
          ...prev,
          {
            id: messageId,
            role,
            content: trimmedContent,
          },
        ];
      });
    },
    []
  );

  const openWidget = useCallback(() => {
    if (isOpen) return;
    visibleSessionRef.current += 1;
    setError(null);
    setInput('');
    setIsOpen(true);
    trackFunnelEvent('landing_anna_widget_opened', {
      locale: lang,
    });
    void postPublicAnnaFunnelEvent('landing_anna_widget_opened', {
      sessionId: sessionIdRef.current,
      locale: lang,
    });
  }, [isOpen, lang]);

  const closeWidget = useCallback(() => {
    visibleSessionRef.current += 1;
    resetVoiceTranscriptDrafts();
    setIsLoading(false);
    setIsOpen(false);
  }, [resetVoiceTranscriptDrafts]);

  useEffect(() => {
    resetVoiceTranscriptDrafts();
    setMessages([
      {
        id: 'anna-welcome',
        role: 'assistant',
        content: copy.intro,
      },
    ]);
  }, [copy.intro, resetVoiceTranscriptDrafts]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const browserWindow = window as AnnaWindow;
    const hasAudioContext = Boolean(window.AudioContext || browserWindow.webkitAudioContext);
    const hasMicrophone = Boolean(navigator.mediaDevices?.getUserMedia);
    let cancelled = false;

    const applyVoiceConfig = (config: {
      apiKey: string | null;
      voiceName?: string | null;
      enabled?: boolean;
    }) => {
      if (cancelled) return;
      const nextApiKey = config.apiKey;
      const nextVoiceName = String(config.voiceName || '').trim() || LIVE_VOICE_NAME;
      const nextEnabled = config.enabled !== false;
      setVoiceApiKey(nextApiKey);
      setVoiceName(nextVoiceName);
      setVoiceAvailable(Boolean(nextApiKey && nextEnabled && hasAudioContext && hasMicrophone));
    };

    if (FRONTEND_GEMINI_KEY) {
      applyVoiceConfig({
        apiKey: FRONTEND_GEMINI_KEY,
        voiceName: LIVE_VOICE_NAME,
        enabled: true,
      });
    }

    fetch('/api/public/anna/voice-config')
      .then(async (response) => {
        if (!response.ok) {
          return {
            apiKey: FRONTEND_GEMINI_KEY || null,
            voiceName: LIVE_VOICE_NAME,
            enabled: true,
          };
        }
        const data = await response.json();
        return {
          apiKey:
            typeof data?.apiKey === 'string' && data.apiKey.trim()
              ? data.apiKey.trim()
              : FRONTEND_GEMINI_KEY || null,
          voiceName: typeof data?.voiceName === 'string' ? data.voiceName.trim() : LIVE_VOICE_NAME,
          enabled: data?.enabled !== false,
        };
      })
      .then((config) => applyVoiceConfig(config))
      .catch(() =>
        applyVoiceConfig({
          apiKey: FRONTEND_GEMINI_KEY || null,
          voiceName: LIVE_VOICE_NAME,
          enabled: true,
        })
      );

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const teardownVoice = useCallback(async () => {
    processorRef.current?.disconnect();
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
    }
    processorRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source may already be finished.
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;

    if (sessionRef.current) {
      try {
        sessionRef.current.close();
      } catch {
        // Session may already be closed.
      }
      sessionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        await audioContextRef.current.close();
      } catch {
        // Audio context may already be closing.
      }
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    const openAnna = () => openWidget();
    window.addEventListener('anna:open', openAnna);
    return () => window.removeEventListener('anna:open', openAnna);
  }, [openWidget]);

  useEffect(() => {
    return () => {
      void teardownVoice();
    };
  }, [teardownVoice]);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'anna-welcome')
        .slice(-8)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages]
  );

  const voiceHistoryTurns = useMemo(
    () =>
      history
        .filter((message) => message.content.trim())
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content.trim() }],
        })),
    [history]
  );

  const startVoiceConversation = useCallback(async () => {
    if (isLoading) return;
    const voiceAttemptToken = voiceAttemptRef.current + 1;
    voiceAttemptRef.current = voiceAttemptToken;
    voiceStartRef.current = 0;
    hasLiveVoiceSessionRef.current = false;

    if (!voiceAvailable || !voiceApiKey || typeof window === 'undefined') {
      setVoiceStatus('error');
      setVoiceError(copy.voiceUnavailable);
      return;
    }

    setError(null);
    setVoiceError(null);
    setVoiceStatus('connecting');
    resetVoiceTranscriptDrafts();
    await teardownVoice();

    const browserWindow = window as AnnaWindow;
    const AudioContextCtor = window.AudioContext || browserWindow.webkitAudioContext;

    try {
      const voiceSessionLang =
        normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || lang;
      let voiceKnowledgeContext = '';
      try {
        const contextResponse = await fetch(
          `/api/public/anna/voice-context?locale=${encodeURIComponent(voiceSessionLang)}`
        );
        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          if (typeof contextData?.context === 'string') {
            voiceKnowledgeContext = contextData.context.trim();
          }
        }
      } catch (contextError) {
        console.warn('[AnnaAssistantWidget] Voice context bootstrap failed', contextError);
      }

      if (!AudioContextCtor) {
        throw new Error('AudioContext unavailable');
      }

      const ai = new GoogleGenAI({ apiKey: voiceApiKey });
      const audioContext = new AudioContextCtor({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      nextPlayTimeRef.current = audioContext.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const sessionPromise = ai.live.connect({
        model: LIVE_VOICE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction: buildVoiceSystemInstruction(voiceSessionLang, voiceKnowledgeContext),
        },
        callbacks: {
          onopen: () => {
            if (voiceAttemptRef.current !== voiceAttemptToken) {
              return;
            }
            voiceStartRef.current = Date.now();
            hasLiveVoiceSessionRef.current = true;
            setVoiceStatus('live');

            processor.onaudioprocess = (event) => {
              const inputData = event.inputBuffer.getChannelData(0);
              const pcm16 = new Int16Array(inputData.length);

              for (let index = 0; index < inputData.length; index += 1) {
                const sample = Math.max(-1, Math.min(1, inputData[index]));
                pcm16[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
              }

              const bytes = new Uint8Array(pcm16.buffer);
              let binary = '';
              for (let index = 0; index < bytes.length; index += 1) {
                binary += String.fromCharCode(bytes[index]);
              }

              sessionRef.current?.sendRealtimeInput({
                media: {
                  mimeType: 'audio/pcm;rate=16000',
                  data: btoa(binary),
                },
              });
            };

            source.connect(processor);
            processor.connect(audioContext.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (voiceAttemptRef.current !== voiceAttemptToken) {
              return;
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach((activeSource) => {
                try {
                  activeSource.stop();
                } catch {
                  // Source may already be finished.
                }
              });
              activeSourcesRef.current = [];
              nextPlayTimeRef.current = audioContext.currentTime;
            }

            const inputTranscript = message.serverContent?.inputTranscription?.text?.trim();
            if (inputTranscript) {
              voiceAssistantDraftRef.current = { id: null, text: '' };
              upsertVoiceTranscriptMessage('user', inputTranscript, voiceUserDraftRef);
            }

            const outputTranscript = message.serverContent?.outputTranscription?.text?.trim();
            if (outputTranscript) {
              voiceUserDraftRef.current = { id: null, text: '' };
              upsertVoiceTranscriptMessage('assistant', outputTranscript, voiceAssistantDraftRef);
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.find(
              (part) => part.inlineData
            )?.inlineData?.data;
            if (!base64Audio) return;

            const binaryString = atob(base64Audio);
            const bytesArray = new Uint8Array(binaryString.length);
            for (let index = 0; index < binaryString.length; index += 1) {
              bytesArray[index] = binaryString.charCodeAt(index);
            }

            const pcm16 = new Int16Array(bytesArray.buffer);
            const audioBuffer = audioContext.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            for (let index = 0; index < pcm16.length; index += 1) {
              channelData[index] = pcm16[index] / 32768;
            }

            const playSource = audioContext.createBufferSource();
            playSource.buffer = audioBuffer;
            playSource.connect(audioContext.destination);

            const startAt = Math.max(nextPlayTimeRef.current, audioContext.currentTime);
            playSource.start(startAt);
            nextPlayTimeRef.current = startAt + audioBuffer.duration;

            activeSourcesRef.current.push(playSource);
            playSource.onended = () => {
              activeSourcesRef.current = activeSourcesRef.current.filter(
                (candidate) => candidate !== playSource
              );
            };
          },
          onclose: () => {
            if (voiceAttemptRef.current !== voiceAttemptToken) {
              return;
            }
            hasLiveVoiceSessionRef.current = false;
            voiceStartRef.current = 0;
            void teardownVoice();
            setVoiceStatus('idle');
          },
          onerror: (liveError: unknown) => {
            if (voiceAttemptRef.current !== voiceAttemptToken) {
              return;
            }
            console.error('[AnnaAssistantWidget] Live voice failed', liveError);
            hasLiveVoiceSessionRef.current = false;
            voiceStartRef.current = 0;
            setVoiceStatus('error');
            setVoiceError(copy.voiceError);
            void teardownVoice();
          },
        },
      });

      const session = await sessionPromise;
      if (voiceAttemptRef.current !== voiceAttemptToken) {
        try {
          session.close();
        } catch {
          // Session may already be closed.
        }
        return;
      }

      if (voiceHistoryTurns.length > 0 && typeof session.sendClientContent === 'function') {
        await Promise.resolve(
          session.sendClientContent({
            turns: voiceHistoryTurns,
            turnComplete: false,
          })
        );
      }

      sessionRef.current = session;
    } catch (liveError) {
      if (voiceAttemptRef.current !== voiceAttemptToken) {
        return;
      }
      console.error('[AnnaAssistantWidget] Voice session failed to start', liveError);
      hasLiveVoiceSessionRef.current = false;
      voiceStartRef.current = 0;
      setVoiceStatus('error');
      setVoiceError(copy.voiceError);
      await teardownVoice();
    }
  }, [
    copy.voiceError,
    copy.voiceUnavailable,
    i18n.language,
    i18n.resolvedLanguage,
    isLoading,
    lang,
    resetVoiceTranscriptDrafts,
    teardownVoice,
    upsertVoiceTranscriptMessage,
    voiceHistoryTurns,
    voiceApiKey,
    voiceAvailable,
    voiceName,
  ]);

  const stopVoiceConversation = useCallback(async () => {
    voiceAttemptRef.current += 1;
    const shouldReportVoiceEvent = hasLiveVoiceSessionRef.current && voiceStartRef.current > 0;
    const voiceStartedAt = voiceStartRef.current;

    hasLiveVoiceSessionRef.current = false;
    setVoiceError(null);
    setVoiceStatus('idle');
    await teardownVoice();

    voiceStartRef.current = 0;

    if (shouldReportVoiceEvent) {
      const durationSeconds = Math.round((Date.now() - voiceStartedAt) / 1000);
      fetch('/api/public/anna/voice-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          durationSeconds,
          locale: lang,
        }),
      }).catch(() => {});
    }
  }, [teardownVoice, lang]);

  const sendMessage = async (preset?: string) => {
    const content = (preset || input).trim();
    if (!content || isLoading) return;
    const visibleSessionToken = visibleSessionRef.current;

    const userMessage: AnnaMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError(null);
    setIsLoading(true);
    trackFunnelEvent('landing_anna_message_sent', {
      locale: lang,
      source: preset ? 'suggestion' : 'typed',
      messageLength: content.length,
      historyLength: history.length,
    });
    void postPublicAnnaFunnelEvent('landing_anna_message_sent', {
      sessionId: sessionIdRef.current,
      locale: lang,
      source: preset ? 'suggestion' : 'typed',
      messageLength: content.length,
      historyLength: history.length,
    });

    try {
      const response = await fetch('/api/public/anna/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          locale: i18n.resolvedLanguage || i18n.language || lang,
          sessionId: sessionIdRef.current,
          history,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 429) {
          const answer = typeof data?.message === 'string' ? data.message.trim() : '';
          if (answer) {
            if (visibleSessionRef.current !== visibleSessionToken) {
              return;
            }
            trackFunnelEvent('landing_anna_fallback_shown', {
              locale: lang,
              fallbackReason: 'rate_limit',
            });
            void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
              sessionId: sessionIdRef.current,
              locale: lang,
              fallbackReason: 'rate_limit',
            });
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: answer,
              },
            ]);
            return;
          }
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const answer = typeof data?.message === 'string' ? data.message.trim() : '';
      if (!answer) {
        throw new Error('Empty response');
      }

      const sources =
        Array.isArray(data?.knowledgeSources) && data.knowledgeSources.every((s: unknown) => typeof s === 'string')
          ? (data.knowledgeSources as string[]).map((s) => s.trim()).filter(Boolean)
          : [];

      if (visibleSessionRef.current !== visibleSessionToken) {
        return;
      }

      if (typeof data?.fallbackReason === 'string' && data.fallbackReason.trim()) {
        trackFunnelEvent('landing_anna_fallback_shown', {
          locale: lang,
          fallbackReason: data.fallbackReason.trim(),
        });
        void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
          sessionId: sessionIdRef.current,
          locale: lang,
          fallbackReason: data.fallbackReason.trim(),
        });
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            shouldShowSources && sources.length > 0
              ? `${answer}\n\n${lang === 'pl' ? 'Źródła' : 'Sources'}: ${sources.join(', ')}`
              : answer,
        },
      ]);
    } catch (err) {
      if (visibleSessionRef.current !== visibleSessionToken) {
        return;
      }
      console.error('[AnnaAssistantWidget] Request failed', err);
      trackFunnelEvent('landing_anna_fallback_shown', {
        locale: lang,
        fallbackReason: 'service_unavailable',
      });
      void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
        sessionId: sessionIdRef.current,
        locale: lang,
        fallbackReason: 'service_unavailable',
      });
      setError(copy.error);
    } finally {
      if (visibleSessionRef.current === visibleSessionToken) {
        setIsLoading(false);
      }
    }
  };

  const trimmedInput = input.trim();
  const triggerHandoff = useCallback(
    (target: 'demo' | 'trial' | 'contact') => {
      void stopVoiceConversation();
      trackFunnelEvent('landing_anna_handoff_clicked', {
        locale: lang,
        target,
        voiceStatus,
      });
      void postPublicAnnaFunnelEvent('landing_anna_handoff_clicked', {
        sessionId: sessionIdRef.current,
        locale: lang,
        target,
        voiceStatus,
      });
      closeWidget();

      if (target === 'demo') {
        if (onDemoClick) {
          onDemoClick();
          return;
        }
        navigate('/demo');
        return;
      }

      if (target === 'trial') {
        if (onTrialClick) {
          onTrialClick();
          return;
        }
        navigate(ROUTES.TRIAL_ENTRY);
        return;
      }

      if (onContactClick) {
        onContactClick();
        return;
      }
      navigate(ROUTES.LEGAL.CONTACT);
    },
    [
      closeWidget,
      lang,
      navigate,
      onContactClick,
      onDemoClick,
      onTrialClick,
      stopVoiceConversation,
      voiceStatus,
    ]
  );
  const voiceHint =
    voiceStatus === 'live'
      ? copy.voiceListening
      : voiceStatus === 'connecting'
        ? copy.voiceConnecting
        : voiceError
          ? voiceError
          : voiceAvailable
            ? copy.voiceReady
            : copy.voiceUnavailable;

  const isVoiceModeVisible = !trimmedInput;
  const actionMode = trimmedInput
    ? 'send'
    : voiceStatus === 'connecting'
      ? 'connecting'
      : voiceStatus === 'live'
        ? 'stop'
        : 'mic';

  return (
    <div className="fixed right-5 bottom-5 z-[180] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-3">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            dir={isRtl ? 'rtl' : 'ltr'}
            className="w-[380px] max-w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0E0A25]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">{copy.title}</p>
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      {copy.privacyBadge}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/55">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeWidget();
                  void stopVoiceConversation();
                }}
                className="rounded-full p-1.5 text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                aria-label="Close Anna"
              >
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[430px] overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-violet-600 text-white'
                          : 'bg-white/[0.06] text-white/85'
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm text-white/70">
                      <Loader2 size={15} className="animate-spin" />
                      <span>{copy.loading}</span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {isVoiceModeVisible && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      voiceStatus === 'error' || !voiceAvailable
                        ? 'border-amber-300/15 bg-amber-500/10 text-amber-100'
                        : 'border-cyan-300/15 bg-cyan-500/10 text-cyan-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {voiceStatus === 'connecting' ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : voiceStatus === 'live' ? (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                      ) : (
                        <Mic size={15} />
                      )}
                      <span>{voiceHint}</span>
                    </div>
                  </div>
                )}

                {messages.length <= 1 && !isLoading && (
                  <div className="pt-1">
                    <p className="mb-2 text-xs font-medium text-white/45">
                      {copy.suggestionsLabel}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {copy.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void sendMessage(suggestion)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-white/45">{copy.handoffLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => triggerHandoff('demo')}
                      className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition-colors hover:bg-cyan-500/20"
                    >
                      {copy.demoCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerHandoff('trial')}
                      className="rounded-full border border-violet-300/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition-colors hover:bg-violet-500/20"
                    >
                      {copy.trialCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerHandoff('contact')}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/75 transition-colors hover:bg-white/[0.09] hover:text-white"
                    >
                      {copy.contactCta}
                    </button>
                  </div>
                </div>

                <div ref={scrollRef} />
              </div>
            </div>

            <div className="border-t border-white/8 px-4 py-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => {
                    if (voiceStatus === 'live' || voiceStatus === 'connecting') {
                      void stopVoiceConversation();
                    }
                    setVoiceError(null);
                    setInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder={copy.placeholder}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/40"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (actionMode === 'send') {
                      void sendMessage();
                      return;
                    }

                    if (actionMode === 'stop') {
                      void stopVoiceConversation();
                      return;
                    }

                    if (actionMode === 'mic') {
                      void startVoiceConversation();
                    }
                  }}
                  disabled={
                    isLoading ||
                    actionMode === 'connecting' ||
                    (actionMode === 'mic' && !voiceAvailable)
                  }
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 ${
                    actionMode === 'stop'
                      ? 'bg-rose-500 shadow-[0_0_28px_rgba(244,63,94,0.45)] hover:bg-rose-400'
                      : actionMode === 'mic'
                        ? 'bg-cyan-500 shadow-[0_0_28px_rgba(6,182,212,0.45)] hover:bg-cyan-400'
                        : 'bg-violet-600 hover:bg-violet-500'
                  }`}
                  aria-label={
                    actionMode === 'send'
                      ? copy.send
                      : actionMode === 'stop'
                        ? copy.voiceStop
                        : copy.voiceStart
                  }
                  title={
                    actionMode === 'mic' && !voiceAvailable ? copy.voiceUnavailable : undefined
                  }
                >
                  {actionMode === 'connecting' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : actionMode === 'stop' ? (
                    <Square size={16} />
                  ) : actionMode === 'mic' ? (
                    <Mic size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            closeWidget();
            void stopVoiceConversation();
            return;
          }
          openWidget();
        }}
        aria-label={copy.open}
        className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#140D31]/95 px-4 py-3 text-white shadow-[0_16px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all hover:bg-[#19123A]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_30px_rgba(168,85,247,0.35)]">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </div>
        <div className="hidden text-left sm:block">
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>{copy.open}</span>
            <Sparkles size={13} className="text-violet-300" />
          </p>
          <p className="text-[11px] text-white/45">{copy.privacyBadge}</p>
        </div>
      </button>
    </div>
  );
};

export default AnnaAssistantWidget;
