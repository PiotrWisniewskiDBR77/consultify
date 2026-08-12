import type { LiveServerMessage, Session } from '@google/genai';
import { GoogleGenAI, Modality } from '@google/genai';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MessageCircle, Mic, Send, Sparkles, Square, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { KNOWLEDGE_BASE_SITE, type KnowledgeBaseSiteKey } from '../../config/knowledgeBaseSite';
import { buildProductHelpDigest } from '../../config/productHelpDigest';
import { normalizeLanguageCode } from '../../i18n';
import { ROUTES } from '../../routes/routeConfig';
import { persistAnnaLpCtaContext } from '../../services/annaLpCtaContext';
import { trackFunnelEvent } from '../../services/funnelAnalytics';
import type {
  AnnaLpChannel,
  AnnaLpCtaType,
  AnnaLpSourceIntent,
} from '../../services/publicAnnaAnalytics';
import { postPublicAnnaFunnelEvent } from '../../services/publicAnnaAnalytics';
import TeresaMark from '../shared/TeresaMark';
type AnnaMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type AnnaSurfaceContext = {
  surface: 'knowledge_article';
  articleTitle: string;
  articleSummary?: string;
  categoryName?: string;
  currentSection?: string;
  articleUrl?: string;
};

type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';
type AnnaUiLanguage = 'en' | 'pl' | 'es' | 'de' | 'ja' | 'ar';

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

const COPY: Record<AnnaUiLanguage, AnnaCopy> = {
  en: {
    title: 'Anna',
    subtitle: 'Guided product entry assistant',
    intro:
      'I can explain Consultify, the partner program, and help you choose the right next step: demo, trial, partner application, or contact. I do not have access to client or project data.',
    placeholder: 'Ask Anna about the product...',
    send: 'Send',
    open: 'Ask Anna first',
    loading: 'Anna is thinking...',
    suggestionsLabel: 'Try asking:',
    privacyBadge: 'Public knowledge only',
    suggestions: [
      'What is Consultify?',
      'How does the Consultify partner program work?',
      'Who is Consultify for?',
      'What does partner certification include?',
    ],
    error:
      'Our AI assistant is temporarily unavailable. Please explore the page or contact us directly.',
    voiceReady: 'Tap the microphone to start a live voice conversation.',
    voiceConnecting: 'Connecting voice mode...',
    voiceListening: 'Anna is listening live.',
    voiceUnavailable: 'Live voice is currently unavailable. You can still chat with Anna by text.',
    voiceError: 'Live voice ran into an issue. You can continue with Anna by text.',
    voiceStart: 'Start voice conversation',
    voiceStop: 'Stop voice conversation',
    handoffLabel: 'Choose your next step',
    demoCta: 'Try demo',
    trialCta: 'Start trial',
    contactCta: 'Contact',
  },
  pl: {
    title: 'Anna',
    subtitle: 'Asystentka wejścia produktowego',
    intro:
      'Moge wyjasnic Consultify, program partnerski i pomóc wybrać właściwy kolejny krok: demo, trial, aplikacje partnerska albo kontakt. Nie mam dostepu do danych klienta ani projektow.',
    placeholder: 'Zapytaj Annę o produkt...',
    send: 'Wyslij',
    open: 'Zapytaj Annę najpierw',
    loading: 'Anna analizuje...',
    suggestionsLabel: 'Mozesz zapytac:',
    privacyBadge: 'Tylko wiedza publiczna',
    suggestions: [
      'Czym jest Consultify?',
      'Jak działa program partnerski Consultify?',
      'Dla kogo jest Consultify?',
      'Co obejmuje certyfikacja partnera?',
    ],
    error:
      'Nasz asystent AI jest tymczasowo niedostepny. Przejrzyj prosze strone lub skontaktuj sie z nami bezposrednio.',
    voiceReady: 'Kliknij mikrofon, aby uruchomic rozmowe glosowa na zywo.',
    voiceConnecting: 'Lacze tryb glosowy...',
    voiceListening: 'Anna slucha na zywo.',
    voiceUnavailable: 'Tryb glosowy jest tymczasowo niedostepny. Nadal mozesz pisac z Anna.',
    voiceError: 'Wystapil problem z trybem glosowym. Mozesz kontynuowac rozmowe w tekscie.',
    voiceStart: 'Uruchom rozmowe glosowa',
    voiceStop: 'Zatrzymaj rozmowe glosowa',
    handoffLabel: 'Wybierz kolejny krok',
    demoCta: 'Wypróbuj demo',
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
    voiceListening: 'Anna esta escuchando en vivo.',
    voiceUnavailable:
      'La voz en vivo no esta disponible temporalmente. Aun puedes chatear por texto.',
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
    voiceListening: 'Anna hort live zu.',
    voiceUnavailable:
      'Live-Sprachmodus ist vorubergehend nicht verfugbar. Du kannst weiter tippen.',
    voiceError: 'Live-Sprachmodus hatte ein Problem. Du kannst per Text fortfahren.',
    voiceStart: 'Sprachgesprach starten',
    voiceStop: 'Sprachgesprach stoppen',
    handoffLabel: 'Schnelle nachste Schritte',
    demoCta: 'Demo testen',
    trialCta: 'Trial starten',
    contactCta: 'Kontakt',
  },
  ja: {
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
    voiceListening: 'Annaがライブで聞いています。',
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
    voiceListening: 'Anna تستمع الآن مباشرة.',
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

const ANNA_SITE_OVERRIDES: Record<
  KnowledgeBaseSiteKey,
  {
    introEn: string;
    introPl: string;
    suggestionsEn: string[];
    suggestionsPl: string[];
    voiceFocusEn: string;
    voiceFocusPl: string;
  }
> = {
  consultify: {
    introEn:
      'I can explain Consultify, the partner program, and help you choose the right next step: demo, trial, partner application, or contact. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic Consultify, program partnerski i pomóc wybrać właściwy kolejny krok: demo, trial, aplikacje partnerska albo kontakt. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is Consultify?',
      'How does the Consultify partner program work?',
      'Who is Consultify for?',
      'What does partner certification include?',
    ],
    suggestionsPl: [
      'Czym jest Consultify?',
      'Jak działa program partnerski Consultify?',
      'Dla kogo jest Consultify?',
      'Co obejmuje certyfikacja partnera?',
    ],
    voiceFocusEn:
      'Consultify is the structured transformation decision layer. Prioritize Consultify first, then use other DBR77 products only when they genuinely clarify value or cross-sell logic.',
    voiceFocusPl:
      'Consultify jest warstwa uporzadkowanych decyzji transformacyjnych. Priorytetowo omawiaj Consultify, a pozostale produkty DBR77 pokazuj tylko wtedy, gdy realnie dopelniaja wartosc lub cross-sell.',
  },
  iot: {
    introEn:
      'I can explain DBR77 IoT, machine visibility, pilot rollout, ROI, and how it connects with IRIS, Digital Twin, Vector, and Consultify. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic DBR77 IoT, widocznosc maszyn, pilotaż, rollout, ROI oraz to, jak laczy sie z IRIS, Digital Twin, Vector i Consultify. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is DBR77 IoT?',
      'How do you start an IoT pilot without disrupting production?',
      'How does IoT connect with IRIS or Digital Twin?',
      'What is the right next step after this page?',
    ],
    suggestionsPl: [
      'Czym jest DBR77 IoT?',
      'Jak zaczac pilotaż IoT bez ryzyka dla produkcji?',
      'Jak IoT laczy sie z IRIS albo Digital Twin?',
      'Jaki kolejny krok ma sens po tej stronie?',
    ],
    voiceFocusEn:
      'DBR77 IoT is the visibility and signal layer for machine data, downtime, rollout, and edge logic. Start with IoT, then connect to IRIS, Digital Twin, Vector, Marketplace, or Consultify when useful.',
    voiceFocusPl:
      'DBR77 IoT jest warstwa widocznosci i sygnalow dla danych maszynowych, przestojow, rolloutow i edge logic. Zaczynaj od IoT, a potem lacz z IRIS, Digital Twin, Vector, Marketplace lub Consultify, gdy to pomaga.',
  },
  iris: {
    introEn:
      'I can explain DBR77 IRIS, AI-assisted plant operations, execution closure, governance, ROI, and how it connects with IoT, Digital Twin, Vector, and Consultify. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic DBR77 IRIS, AI-assisted plant operations, domkniecie egzekucji, governance, ROI oraz to, jak laczy sie z IoT, Digital Twin, Vector i Consultify. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is DBR77 IRIS?',
      'How does IRIS connect AI with execution on the plant floor?',
      'When does IRIS need IoT or Digital Twin around it?',
      'What is the best next step after this page?',
    ],
    suggestionsPl: [
      'Czym jest DBR77 IRIS?',
      'Jak IRIS laczy AI z egzekucja na hali?',
      'Kiedy IRIS potrzebuje wokol siebie IoT albo Digital Twin?',
      'Jaki kolejny krok ma sens po tej stronie?',
    ],
    voiceFocusEn:
      'DBR77 IRIS is the plant operating system and AI-assisted execution layer. Start with IRIS, then connect to IoT, Digital Twin, Vector, Marketplace, or Consultify when useful.',
    voiceFocusPl:
      'DBR77 IRIS jest plant operating system i warstwa AI-assisted execution. Zaczynaj od IRIS, a potem lacz z IoT, Digital Twin, Vector, Marketplace lub Consultify, gdy to pomaga.',
  },
  dt: {
    introEn:
      'I can explain DBR77 Digital Twin, scenario planning, flow and layout simulation, CAPEX decisions, and how it connects with IoT, IRIS, Vector, Marketplace, and Consultify. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic DBR77 Digital Twin, planowanie scenariuszy, symulacje flow i layoutu, decyzje CAPEX oraz to, jak laczy sie z IoT, IRIS, Vector, Marketplace i Consultify. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is DBR77 Digital Twin?',
      'What decisions should be simulated before live change?',
      'How does Digital Twin connect with IoT or IRIS?',
      'What is the right next step after this page?',
    ],
    suggestionsPl: [
      'Czym jest DBR77 Digital Twin?',
      'Jakie decyzje warto zasymulowac przed zmiana na zywo?',
      'Jak Digital Twin laczy sie z IoT albo IRIS?',
      'Jaki kolejny krok ma sens po tej stronie?',
    ],
    voiceFocusEn:
      'DBR77 Digital Twin is the simulation and scenario layer for layout, flow, automation, and CAPEX decisions. Start with Digital Twin, then connect to IoT, IRIS, Vector, Marketplace, or Consultify when useful.',
    voiceFocusPl:
      'DBR77 Digital Twin jest warstwa symulacji i scenariuszy dla decyzji layout, flow, automatyzacji i CAPEX. Zaczynaj od Digital Twin, a potem lacz z IoT, IRIS, Vector, Marketplace lub Consultify, gdy to pomaga.',
  },
  marketplace: {
    introEn:
      'I can explain DBR77 Marketplace, supplier matching, automation buying logic, offer comparison, and how it connects with Consultify, Vector, IoT, Digital Twin, and IRIS. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic DBR77 Marketplace, matching dostawcow, logike zakupu automatyzacji, porownanie ofert oraz to, jak laczy sie z Consultify, Vector, IoT, Digital Twin i IRIS. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is DBR77 Marketplace?',
      'How do you compare suppliers and offers on Marketplace?',
      'How does Marketplace connect with Consultify or Vector?',
      'What is the right next step after this page?',
    ],
    suggestionsPl: [
      'Czym jest DBR77 Marketplace?',
      'Jak porownywac dostawcow i oferty w Marketplace?',
      'Jak Marketplace laczy sie z Consultify albo Vector?',
      'Jaki kolejny krok ma sens po tej stronie?',
    ],
    voiceFocusEn:
      'DBR77 Marketplace is the sourcing and buying coordination layer for industrial automation. Start with Marketplace, then connect to Consultify, Vector, IoT, Digital Twin, or IRIS when useful.',
    voiceFocusPl:
      'DBR77 Marketplace jest warstwa sourcingu i koordynacji zakupu automatyzacji przemyslowej. Zaczynaj od Marketplace, a potem lacz z Consultify, Vector, IoT, Digital Twin lub IRIS, gdy to pomaga.',
  },
  vector: {
    introEn:
      'I can explain DBR77 Vector, industrial AI reasoning, governance, deployment control, and how it connects with Consultify, IRIS, Digital Twin, IoT, and Marketplace. I do not have access to client or project data.',
    introPl:
      'Moge wyjasnic DBR77 Vector, industrial AI reasoning, governance, deployment control oraz to, jak laczy sie z Consultify, IRIS, Digital Twin, IoT i Marketplace. Nie mam dostepu do danych klienta ani projektow.',
    suggestionsEn: [
      'What is DBR77 Vector?',
      'How does Vector strengthen Consultify or IRIS?',
      'How should AI governance work around Vector?',
      'What is the right next step after this page?',
    ],
    suggestionsPl: [
      'Czym jest DBR77 Vector?',
      'Jak Vector wzmacnia Consultify albo IRIS?',
      'Jak powinien wygladac AI governance wokol Vectora?',
      'Jaki kolejny krok ma sens po tej stronie?',
    ],
    voiceFocusEn:
      'DBR77 Vector is the industrial reasoning and AI layer. Start with Vector, then connect to Consultify, IRIS, Digital Twin, IoT, or Marketplace when useful.',
    voiceFocusPl:
      'DBR77 Vector jest przemyslowa warstwa reasoningowa i AI. Zaczynaj od Vectora, a potem lacz z Consultify, IRIS, Digital Twin, IoT lub Marketplace, gdy to pomaga.',
  },
};

function buildGenericSiteIntro(lang: AnnaUiLanguage, brandName: string): string {
  if (lang === 'es') {
    return `Puedo explicar ${brandName}, como encaja en el ecosistema DBR77 y cual es el mejor siguiente paso. No tengo acceso a datos de clientes ni de proyectos.`;
  }
  if (lang === 'de') {
    return `Ich kann ${brandName}, seine Rolle im DBR77-Okosystem und den besten nachsten Schritt erklaren. Ich habe keinen Zugriff auf Kunden- oder Projektdaten.`;
  }
  if (lang === 'ja') {
    return `${brandName}、そのDBR77エコシステム内での役割、そして適切な次のステップを説明できます。顧客データやプロジェクトデータにはアクセスできません。`;
  }
  if (lang === 'ar') {
    return `يمكنني شرح ${brandName} ودوره داخل منظومة DBR77 وما هي الخطوة التالية المناسبة. لا أملك وصولا إلى بيانات العملاء أو المشاريع.`;
  }
  return `I can explain ${brandName}, how it fits in the DBR77 ecosystem, and what the right next step is. I do not have access to client or project data.`;
}

function buildGenericSiteSuggestions(lang: AnnaUiLanguage, brandName: string): string[] {
  if (lang === 'es') {
    return [
      `Que es ${brandName}?`,
      `Para quien es ${brandName}?`,
      `Como encaja ${brandName} en DBR77?`,
      'Cual es el siguiente paso correcto?',
    ];
  }
  if (lang === 'de') {
    return [
      `Was ist ${brandName}?`,
      `Fur wen ist ${brandName} gedacht?`,
      `Wie passt ${brandName} zu DBR77?`,
      'Was ist der richtige nachste Schritt?',
    ];
  }
  if (lang === 'ja') {
    return [
      `${brandName}とは何ですか？`,
      `${brandName}は誰のためのものですか？`,
      `${brandName}はDBR77の中でどう位置づけられますか？`,
      '次の適切なステップは何ですか？',
    ];
  }
  if (lang === 'ar') {
    return [
      `ما هو ${brandName}؟`,
      `لمن صمم ${brandName}؟`,
      `كيف ينسجم ${brandName} مع DBR77؟`,
      'ما هي الخطوة التالية المناسبة؟',
    ];
  }
  return [
    `What is ${brandName}?`,
    `Who is ${brandName} for?`,
    `How does ${brandName} fit into DBR77?`,
    'What is the right next step?',
  ];
}

function buildAnnaCopy(
  lang: AnnaUiLanguage,
  siteKey: KnowledgeBaseSiteKey,
  brandName: string
): AnnaCopy {
  const base = COPY[lang];
  const override = ANNA_SITE_OVERRIDES[siteKey];
  if (!override) return base;

  return {
    ...base,
    intro:
      lang === 'pl'
        ? override.introPl
        : lang === 'en'
          ? override.introEn
          : buildGenericSiteIntro(lang, brandName),
    suggestions:
      lang === 'pl'
        ? override.suggestionsPl
        : lang === 'en'
          ? override.suggestionsEn
          : buildGenericSiteSuggestions(lang, brandName),
  };
}

function inferAnnaLpSourceIntent(input: string): AnnaLpSourceIntent {
  const text = String(input || '').toLowerCase();
  if (!text.trim()) return 'unknown';
  if (/\b(price|pricing|cost|cena|koszt|plan|subscription|sla)\b/.test(text)) return 'pricing';
  if (/\b(security|compliance|gdpr|soc|iso|bezpieczen|bezpieczeń|cert)\b/.test(text))
    return 'security_compliance';
  if (/\b(demo|trial|start|sign up|register|get started|zaczac|zacząć)\b/.test(text))
    return 'get_started';
  if (/\b(contact|sales|call|talk|konsultant|kontakt|sprzed)\b/.test(text)) return 'talk_to_human';
  if (/\b(fit|for who|dla kogo|use case|cases|industry|branza|branża)\b/.test(text))
    return 'evaluate_fit';
  return 'learn';
}

function resolveAnnaLpChannel(voiceStatus: VoiceStatus): AnnaLpChannel {
  return voiceStatus === 'live' ? 'voice' : 'text';
}

function buildVoiceSystemInstruction(
  lang: AnnaUiLanguage,
  siteKey: KnowledgeBaseSiteKey,
  brandName: string,
  knowledgeContext?: string
): string {
  const override = ANNA_SITE_OVERRIDES[siteKey];
  const voiceFocusEn =
    override?.voiceFocusEn ||
    `${brandName} is the primary landing-page product. Start with ${brandName} first, then use other DBR77 products only when they genuinely improve clarity or cross-sell logic.`;
  const voiceFocusPl =
    override?.voiceFocusPl ||
    `${brandName} jest glownym produktem tej strony. Zaczynaj od ${brandName}, a pozostale produkty DBR77 pokazuj tylko wtedy, gdy realnie pomagaja doprecyzowac odpowiedz albo cross-sell.`;

  if (lang === 'pl') {
    return `Jestes Anna, publiczna asystentka glosowa ${brandName}.

Twoj glos ma byc cieply, spokojny, profesjonalny i kobiecy. Brzmisz jak doswiadczona strategiczna konsultantka AI, a nie chatbot ani agresywny handlowiec.

Zasady:
- ZACZNIJ OD ODPOWIEDZI: pierwsze zdanie to bezposrednia odpowiedz. Zero rozgrzewki, powtarzania pytania, "swietne pytanie".
- Odpowiadaj zawsze w jezyku uzytkownika.
- Priorytetem jest produkt aktualnej strony: ${brandName}.
- Krotko i naturalnie: zwykle 2-3 zdania, jeden watek. Bez lania wody i dygresji.
- Nie wymyslaj faktow i nie obiecuj funkcji, ktorych nie opisano publicznie.
- Gdy to pasuje, zakoncz jednym konkretnym kolejnym krokiem (demo lub trial).

Publiczna wiedza:
${voiceFocusPl} Mozesz wyjasniac produkt, wartosc biznesowa, wdrozenia, bezpieczenstwo i kolejne kroki rozmowy, ale nie masz dostepu do danych klienta ani projektow.

Kontekst wiedzy:
${String(knowledgeContext || 'Brak dodatkowego kontekstu produktowego. Pozostan przy ostroznych, publicznych faktach.')}`;
  }

  if (lang === 'es') {
    return `Eres Anna, la asistente publica de voz para ${brandName}.

Tu voz debe ser calida, tranquila, profesional y femenina. Suenas como una consultora senior de estrategia AI, no como un chatbot ni una vendedora agresiva.

Reglas:
- RESPONDE PRIMERO: la primera frase es la respuesta directa. Sin preambulos, sin repetir la pregunta. Breve, 2-3 frases, sin relleno.
- Responde siempre en el idioma del usuario.
- Da prioridad al producto actual de la pagina: ${brandName}.
- Mantén las respuestas cortas, naturales y faciles de escuchar: normalmente 2-4 frases.
- No inventes hechos ni prometas capacidades que no sean publicas.
- Cuando ayude, menciona el demo o el trial.

Conocimiento publico:
${brandName} es el producto principal de esta pagina. Empieza por ${brandName} y menciona otros productos DBR77 solo cuando ayuden a aclarar valor, encaje o siguiente paso. Puedes explicar valor del producto, opciones de despliegue, seguridad y siguientes pasos, pero no tienes acceso a datos de clientes ni de proyectos.

Contexto de conocimiento:
${String(knowledgeContext || 'No se cargo contexto adicional del producto. Manten solo hechos publicos verificados.')}`;
  }

  if (lang === 'de') {
    return `Du bist Anna, die offentliche Sprachassistentin fur ${brandName}.

Deine Stimme soll warm, ruhig, professionell und weiblich wirken. Du klingst wie eine erfahrene Senior-Beraterin fur AI-Strategie, nicht wie ein Chatbot oder eine aufdringliche Verkauferin.

Regeln:
- ANTWORTE ZUERST: Der erste Satz ist die direkte Antwort. Kein Aufwarmen, keine Wiederholung der Frage. Kurz, 2-3 Satze, kein Fullmaterial.
- Antworte immer in der Sprache des Nutzers.
- Priorisiere das aktuelle Seitenprodukt: ${brandName}.
- Halte Antworten kurz, naturlich und gut sprechbar: normalerweise 2-4 Satze.
- Erfinde keine Fakten und verspreche keine Funktionen, die nicht offentlich beschrieben sind.
- Wenn es passt, erwahne Demo oder Trial.

Offentliches Wissen:
${brandName} ist das primare Produkt dieser Seite. Beginne mit ${brandName} und nenne andere DBR77-Produkte nur dann, wenn sie Wert, Einsatz oder den nachsten Schritt klarer machen. Du kannst Produktwert, Bereitstellungsoptionen, Sicherheit und nachste Schritte erklaren, hast aber keinen Zugriff auf Kunden- oder Projektdaten.

Wissenskontext:
${String(knowledgeContext || 'Es wurde kein zusatzlicher Produktkontext geladen. Bleibe bei verifizierten offentlichen Fakten.')}`;
  }

  if (lang === 'ja') {
    return `あなたは${brandName}の公開向け音声アシスタントAnnaです。

声は温かく、落ち着いていて、プロフェッショナルで、女性らしい印象にしてください。チャットボットや押しの強い営業ではなく、経験豊富なAI戦略コンサルタントのように話します。

ルール:
- 最初に結論を述べてください: 最初の文が直接の答えです。前置きや質問の繰り返しはせず、2〜3文で簡潔に、余計な言葉なしで。
- いつもユーザーの言語で答えてください。
- 現在のページの製品である${brandName}を優先してください。
- 回答は短く自然で、音声向きにしてください。通常は2〜4文です。
- 公開されていない事実や機能を作り上げないでください。
- 必要ならデモやトライアルに触れてください。

公開情報:
${brandName}がこのページの主役です。まず${brandName}を説明し、他のDBR77製品は価値や次のステップを明確にする場合にのみ補足してください。製品価値、導入オプション、セキュリティ、次のステップは説明できますが、顧客データやプロジェクトデータにはアクセスできません。

知識コンテキスト:
${String(knowledgeContext || '追加の製品コンテキストは読み込まれていません。公開された検証済みの事実だけを使ってください。')}`;
  }

  if (lang === 'ar') {
    return `أنت Anna، المساعدة الصوتية العامة لـ ${brandName}.

يجب أن يكون صوتك دافئا وهادئا ومهنيا وأنثويا. تبدين مثل مستشارة استراتيجية ذكاء اصطناعي خبيرة، لا مثل روبوت محادثة أو بائعة ضاغطة.

القواعد:
- ابدئي بالإجابة: الجملة الأولى هي الإجابة المباشرة، بدون مقدمات أو إعادة صياغة السؤال. اجعليها قصيرة من جملتين إلى ثلاث جمل بلا حشو.
- أجيبي دائما بلغة المستخدم.
- أعطي الأولوية للمنتج الحالي في الصفحة: ${brandName}.
- اجعلي الإجابات قصيرة وطبيعية وسهلة الاستماع، عادة من جملتين إلى أربع جمل.
- لا تختلقي حقائق ولا تعدي بقدرات غير معلنة علنا.
- عندما يكون ذلك مفيدا، اذكري العرض التجريبي أو النسخة التجريبية.

المعرفة العامة:
${brandName} هو المنتج الرئيسي في هذه الصفحة. ابدئي بشرح ${brandName} واذكري منتجات DBR77 الاخرى فقط عندما تساعد على توضيح القيمة او الخطوة التالية. يمكنك شرح قيمة المنتج وخيارات النشر والأمان والخطوات التالية، لكنك لا تملكين وصولا إلى بيانات العملاء أو المشاريع.

سياق المعرفة:
${String(knowledgeContext || 'لم يتم تحميل سياق إضافي للمنتج. التزمي فقط بالحقائق العامة المتحقق منها.')}`;
  }

  return `You are Anna, the public voice assistant for ${brandName}.

Your voice is warm, calm, professional, and feminine. You sound like a senior AI strategy consultant, not a chatbot or a pushy salesperson.

Rules:
- ANSWER FIRST: the first sentence is the direct answer. No warm-up, no restating the question, no "great question".
- Always respond in the user's language.
- Prioritize the current landing-page product: ${brandName}.
- Keep answers short, natural, and voice-friendly: usually 2-3 sentences, one thread. No filler, no digressions.
- Do not invent facts or promise capabilities that are not public.
- When it fits, end with one concrete next step (demo or free trial).

Public knowledge:
${voiceFocusEn} You can explain product value, deployment options, security, and next steps, but you do not have access to any client or project data.

Knowledge context:
${String(knowledgeContext || 'No additional product context was loaded. Stay conservative and use only verified public facts.')}`;
}

interface AnnaAssistantWidgetProps {
  onDemoClick?: () => void;
  onTrialClick?: () => void;
  onContactClick?: () => void;
}

type AnnaOpenEventDetail = {
  prompt?: string;
  context?: AnnaSurfaceContext | null;
};

type AnnaContextEventDetail = {
  context?: AnnaSurfaceContext | null;
};

function buildSurfaceContextInstruction(context?: AnnaSurfaceContext | null): string {
  if (!context || context.surface !== 'knowledge_article') return '';

  const lines = ['Current public article context:', `- Article title: ${context.articleTitle}`];

  if (context.categoryName) {
    lines.push(`- Category: ${context.categoryName}`);
  }
  if (context.currentSection) {
    lines.push(`- Current section in view: ${context.currentSection}`);
  }
  if (context.articleSummary) {
    lines.push(`- Article summary: ${context.articleSummary}`);
  }
  if (context.articleUrl) {
    lines.push(`- Article URL: ${context.articleUrl}`);
  }

  lines.push(
    '- Treat this article as the starting topic unless the user clearly changes the subject.'
  );

  return lines.join('\n');
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
      window.location.hostname.startsWith('stage.') ||
      window.location.hostname.startsWith('staging.'));
  const resolvedLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const lang: AnnaUiLanguage =
    resolvedLanguage === 'pl' ||
    resolvedLanguage === 'es' ||
    resolvedLanguage === 'de' ||
    resolvedLanguage === 'ja' ||
    resolvedLanguage === 'ar'
      ? resolvedLanguage
      : 'en';
  const copy = buildAnnaCopy(lang, KNOWLEDGE_BASE_SITE.key, KNOWLEDGE_BASE_SITE.brandName);
  const isRtl = lang === 'ar';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [voiceApiKey, setVoiceApiKey] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState(LIVE_VOICE_NAME);
  const [surfaceContext, setSurfaceContext] = useState<AnnaSurfaceContext | null>(null);
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

  const openWidget = useCallback(
    (draftPrompt?: string, draftContext?: AnnaSurfaceContext | null) => {
      setError(null);
      setInput(draftPrompt ?? '');
      if (draftContext !== undefined) {
        setSurfaceContext(draftContext);
      }

      if (isOpen) return;

      visibleSessionRef.current += 1;
      setIsOpen(true);
      trackFunnelEvent('landing_anna_widget_opened', {
        locale: lang,
      });
      void postPublicAnnaFunnelEvent('landing_anna_widget_opened', {
        session_id: sessionIdRef.current,
        sessionId: sessionIdRef.current,
        locale: lang,
      });

      const channel = resolveAnnaLpChannel(voiceStatus);
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
      const lastUserContent = String(lastUserMessage?.content || draftPrompt || '');
      const source_intent = inferAnnaLpSourceIntent(lastUserContent);
      const turn_id = String(lastUserMessage?.id || 'anna-welcome');

      (['demo', 'trial', 'contact'] as const satisfies readonly AnnaLpCtaType[]).forEach(
        (cta_type) => {
          void postPublicAnnaFunnelEvent('anna_lp.cta.impression', {
            session_id: sessionIdRef.current,
            cta_type,
            language: lang,
            channel,
            turn_id,
            source_intent,
          });
        }
      );
    },
    [isOpen, lang, messages, voiceStatus]
  );

  const closeWidget = useCallback(() => {
    visibleSessionRef.current += 1;
    setIsLoading(false);
    setIsOpen(false);
  }, []);

  useEffect(() => {
    const welcomeMessage: AnnaMessage = {
      id: 'anna-welcome',
      role: 'assistant',
      content: copy.intro,
    };

    setMessages((prev) => {
      if (prev.length === 0) {
        return [welcomeMessage];
      }
      if (prev.length === 1 && prev[0]?.id === 'anna-welcome') {
        return [welcomeMessage];
      }
      return prev;
    });
  }, [copy.intro]);

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

    fetch('/api/public/anna/voice-config')
      .then(async (response) => {
        if (!response.ok) {
          return {
            apiKey: null,
            voiceName: LIVE_VOICE_NAME,
            enabled: false,
          };
        }
        const data = await response.json();
        const clientToken =
          typeof data?.session?.clientToken === 'string' && data.session.clientToken.trim()
            ? data.session.clientToken.trim()
            : null;
        return {
          apiKey: clientToken,
          voiceName: typeof data?.voiceName === 'string' ? data.voiceName.trim() : LIVE_VOICE_NAME,
          enabled: data?.enabled === true && Boolean(clientToken),
        };
      })
      .then((config) => applyVoiceConfig(config))
      .catch(() =>
        applyVoiceConfig({
          apiKey: null,
          voiceName: LIVE_VOICE_NAME,
          enabled: false,
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
    const openAnna = (event: Event) => {
      const customEvent = event as CustomEvent<AnnaOpenEventDetail>;
      openWidget(customEvent.detail?.prompt, customEvent.detail?.context);
    };
    window.addEventListener('anna:open', openAnna);
    return () => window.removeEventListener('anna:open', openAnna);
  }, [openWidget]);

  useEffect(() => {
    const syncAnnaContext = (event: Event) => {
      const customEvent = event as CustomEvent<AnnaContextEventDetail>;
      setSurfaceContext(customEvent.detail?.context || null);
    };

    window.addEventListener('anna:context', syncAnnaContext);
    return () => window.removeEventListener('anna:context', syncAnnaContext);
  }, []);

  useEffect(() => {
    return () => {
      void teardownVoice();
    };
  }, [teardownVoice]);

  const history = useMemo(
    () =>
      messages
        .filter((message) => message.id !== 'anna-welcome')
        .slice(-12)
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
      trackFunnelEvent('landing_anna_fallback_shown', {
        locale: lang,
        fallbackReason: 'voice_unavailable',
      });
      void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
        session_id: sessionIdRef.current,
        sessionId: sessionIdRef.current,
        locale: lang,
        fallbackReason: 'voice_unavailable',
        voiceStatus: 'error',
      });
      return;
    }

    setError(null);
    setVoiceError(null);
    setVoiceStatus('connecting');
    await teardownVoice();

    const browserWindow = window as AnnaWindow;
    const AudioContextCtor = window.AudioContext || browserWindow.webkitAudioContext;

    try {
      const voiceSessionLang =
        normalizeLanguageCode(i18n.resolvedLanguage || i18n.language) || lang;
      let voiceKnowledgeContext = '';
      try {
        const contextResponse = await fetch(
          `/api/public/anna/voice-context?locale=${encodeURIComponent(voiceSessionLang)}&siteKey=${encodeURIComponent(KNOWLEDGE_BASE_SITE.key)}&sessionId=${encodeURIComponent(sessionIdRef.current)}`
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

      const surfaceInstruction = buildSurfaceContextInstruction(surfaceContext);
      // On the Consultify site, give Anna the in-app product module digest so she
      // can answer "what does Consultify do / what modules are there" questions.
      const productHelpDigest =
        KNOWLEDGE_BASE_SITE.key === 'consultify'
          ? buildProductHelpDigest(voiceSessionLang === 'pl' ? 'pl' : 'en')
          : '';
      const mergedVoiceKnowledgeContext = [
        voiceKnowledgeContext,
        productHelpDigest,
        surfaceInstruction,
      ]
        .filter((item) => Boolean(String(item || '').trim()))
        .join('\n\n');

      if (!AudioContextCtor) {
        throw new Error('AudioContext unavailable');
      }

      const ai = new GoogleGenAI({
        apiKey: voiceApiKey,
        httpOptions: { apiVersion: 'v1alpha' },
      });
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
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction: buildVoiceSystemInstruction(
            voiceSessionLang,
            KNOWLEDGE_BASE_SITE.key,
            KNOWLEDGE_BASE_SITE.brandName,
            mergedVoiceKnowledgeContext
          ),
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
            trackFunnelEvent('landing_anna_fallback_shown', {
              locale: lang,
              fallbackReason: 'voice_error',
            });
            void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
              session_id: sessionIdRef.current,
              sessionId: sessionIdRef.current,
              locale: lang,
              fallbackReason: 'voice_error',
              voiceStatus: 'error',
            });
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
      trackFunnelEvent('landing_anna_fallback_shown', {
        locale: lang,
        fallbackReason: 'voice_error',
      });
      void postPublicAnnaFunnelEvent('landing_anna_fallback_shown', {
        session_id: sessionIdRef.current,
        sessionId: sessionIdRef.current,
        locale: lang,
        fallbackReason: 'voice_error',
        voiceStatus: 'error',
      });
      await teardownVoice();
    }
  }, [
    copy.voiceError,
    copy.voiceUnavailable,
    i18n.language,
    i18n.resolvedLanguage,
    isLoading,
    lang,
    teardownVoice,
    voiceHistoryTurns,
    voiceApiKey,
    voiceAvailable,
    voiceName,
    surfaceContext,
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
      session_id: sessionIdRef.current,
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
          siteKey: KNOWLEDGE_BASE_SITE.key,
          sessionId: sessionIdRef.current,
          history,
          surfaceContext,
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
              session_id: sessionIdRef.current,
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
        Array.isArray(data?.knowledgeSources) &&
        data.knowledgeSources.every((s: unknown) => typeof s === 'string')
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
          session_id: sessionIdRef.current,
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
        session_id: sessionIdRef.current,
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

      const channel = resolveAnnaLpChannel(voiceStatus);
      const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user');
      const lastUserContent = String(lastUserMessage?.content || '');
      const source_intent = inferAnnaLpSourceIntent(lastUserContent);
      const turn_id = String(lastUserMessage?.id || 'anna-welcome');

      void postPublicAnnaFunnelEvent('anna_lp.cta.click', {
        session_id: sessionIdRef.current,
        cta_type: target,
        language: lang,
        channel,
        turn_id,
        source_intent,
      });

      persistAnnaLpCtaContext({
        session_id: sessionIdRef.current,
        cta_type: target,
        language: lang,
        channel,
        turn_id,
        source_intent,
      });

      trackFunnelEvent('landing_anna_handoff_clicked', {
        locale: lang,
        target,
        voiceStatus,
      });
      void postPublicAnnaFunnelEvent('landing_anna_handoff_clicked', {
        session_id: sessionIdRef.current,
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
      messages,
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-c-accent text-white">
                  <TeresaMark size={18} />
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
                          ? 'bg-c-accent text-white'
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
                  <div className="rounded-2xl border border-danger-400/15 bg-danger-500/10 px-4 py-3 text-sm text-danger-200">
                    {error}
                  </div>
                )}

                {isVoiceModeVisible && (
                  <div
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      voiceStatus === 'error' || !voiceAvailable
                        ? 'border-amber-300/15 bg-amber-500/10 text-amber-100'
                        : 'border-blue-300/15 bg-blue-500/10 text-blue-100'
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
                      onClick={() => triggerHandoff('trial')}
                      className="rounded-full border border-c-accent/20 bg-c-accent-soft px-3 py-1.5 text-xs font-medium text-c-accent transition-colors hover:bg-c-accent/20"
                    >
                      {copy.trialCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerHandoff('demo')}
                      className="rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-100 transition-colors hover:bg-blue-500/20"
                    >
                      {copy.demoCta}
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
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-c-accent/40"
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
                  disabled={isLoading || actionMode === 'connecting'}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-white transition-all disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 ${
                    actionMode === 'stop'
                      ? 'bg-danger-500 shadow-[0_0_28px_rgba(244,63,94,0.45)] hover:bg-danger-400'
                      : actionMode === 'mic'
                        ? 'bg-blue-500 shadow-[0_0_28px_rgba(6,182,212,0.45)] hover:bg-blue-400'
                        : 'bg-c-text hover:opacity-90'
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-c-accent text-white shadow-[0_0_30px_rgba(165,28,48,0.35)]">
          {isOpen ? <X size={18} /> : <MessageCircle size={18} />}
        </div>
        <div className="hidden text-left sm:block">
          <p className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>{copy.open}</span>
            <Sparkles size={13} className="text-c-accent" />
          </p>
          <p className="text-[11px] text-white/45">{copy.privacyBadge}</p>
        </div>
      </button>
    </div>
  );
};

export default AnnaAssistantWidget;
