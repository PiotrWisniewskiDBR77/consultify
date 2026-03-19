import type { Locale } from "@/i18n/config";

export type VoicePageId =
  | "overview"
  | "training"
  | "deployment"
  | "products"
  | "security";

export type VoiceMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type VoiceResponse = {
  answer: string;
  topicId: string;
  suggestions: string[];
  confidence: "high" | "medium" | "low";
};

type VoiceTopic = {
  id: string;
  triggers: string[];
  answers: Record<Locale, string>;
  details?: Record<Locale, string>;
  nextSuggestions?: Record<Locale, string[]>;
};

type VoicePageConfig = {
  title: Record<Locale, string>;
  intro: Record<Locale, string>;
  suggestions: Record<Locale, string[]>;
  scope: Record<Locale, string[]>;
  topics: VoiceTopic[];
};

export const voiceUi = {
  en: {
    title: "Vector Voice Test",
    subtitle:
      "Read-only test conversation for DBR77 Vector. I explain the product with the scope of the current page.",
    statusReady: "Ready",
    statusListening: "Listening...",
    statusThinking: "Thinking...",
    statusSpeaking: "Speaking...",
    statusUnsupported:
      "Voice recognition is not supported in this browser. You can still type your question below.",
    start: "Start conversation",
    stop: "End conversation",
    placeholder: "Type your question...",
    send: "Send",
    suggestions: "Suggested questions",
    startHint: "The conversation always starts in the language of the current page.",
    testMode: "Test mode",
    readOnly: "Read only",
    scopeTitle: "Current scope",
    transcriptTitle: "Conversation",
    transcriptEmptyTitle: "This is a page-aware voice explainer.",
    transcriptEmptyBody:
      "Ask about the model, training, deployment, products, or security. The assistant stays within the scope of this landing page.",
  },
  pl: {
    title: "Vector Voice Test",
    subtitle:
      "Testowa rozmowa read-only dla DBR77 Vector. Wyjasniam produkt w zakresie aktualnej strony.",
    statusReady: "Gotowy",
    statusListening: "Slucham...",
    statusThinking: "Analizuje...",
    statusSpeaking: "Mowie...",
    statusUnsupported:
      "Rozpoznawanie mowy nie jest dostepne w tej przegladarce. Nadal mozesz wpisac pytanie ponizej.",
    start: "Rozpocznij rozmowe",
    stop: "Zakoncz rozmowe",
    placeholder: "Wpisz pytanie...",
    send: "Wyslij",
    suggestions: "Proponowane pytania",
    startHint: "Rozmowa zawsze zaczyna sie w jezyku aktualnej strony.",
    testMode: "Tryb testowy",
    readOnly: "Tylko odczyt",
    scopeTitle: "Aktualny zakres",
    transcriptTitle: "Rozmowa",
    transcriptEmptyTitle: "To jest voice explainer zalezny od strony.",
    transcriptEmptyBody:
      "Pytaj o model, trening, deployment, produkty albo bezpieczenstwo. Asystent pozostaje w zakresie tego landing page'a.",
  },
  de: {
    title: "Vector Voice Test",
    subtitle:
      "Read-only Testgespraech fuer DBR77 Vector. Ich erklaere das Produkt im Rahmen der aktuellen Seite.",
    statusReady: "Bereit",
    statusListening: "Ich hoere zu...",
    statusThinking: "Ich analysiere...",
    statusSpeaking: "Ich spreche...",
    statusUnsupported:
      "Spracherkennung wird in diesem Browser nicht unterstuetzt. Sie koennen Ihre Frage unten trotzdem eingeben.",
    start: "Gespraech starten",
    stop: "Gespraech beenden",
    placeholder: "Frage eingeben...",
    send: "Senden",
    suggestions: "Beispielfragen",
    startHint: "Das Gespraech beginnt immer in der Sprache der aktuellen Seite.",
    testMode: "Testmodus",
    readOnly: "Read only",
    scopeTitle: "Aktueller Umfang",
    transcriptTitle: "Gespraech",
    transcriptEmptyTitle: "Dies ist ein seitenbezogener Voice Explainer.",
    transcriptEmptyBody:
      "Fragen Sie zum Modell, zum Training, zum Deployment, zu Produkten oder zur Sicherheit. Der Assistent bleibt im Rahmen dieser Landing Page.",
  },
  ja: {
    title: "Vector Voice テスト",
    subtitle:
      "DBR77 Vectorの読み取り専用テスト会話です。現在のページの範囲内で製品をご説明いたします。",
    statusReady: "準備完了",
    statusListening: "聞いています...",
    statusThinking: "分析中...",
    statusSpeaking: "お話ししています...",
    statusUnsupported:
      "このブラウザでは音声認識がサポートされていません。下のテキストボックスにご質問を入力いただけます。",
    start: "会話を開始",
    stop: "会話を終了",
    placeholder: "ご質問を入力してください...",
    send: "送信",
    suggestions: "おすすめの質問",
    startHint: "会話は常に現在のページの言語で開始されます。",
    testMode: "テストモード",
    readOnly: "読み取り専用",
    scopeTitle: "現在のスコープ",
    transcriptTitle: "会話",
    transcriptEmptyTitle: "ページ対応型の音声エクスプレイナーです。",
    transcriptEmptyBody:
      "モデル、トレーニング、デプロイメント、製品、またはセキュリティについてお尋ねください。アシスタントはこのランディングページの範囲内でお答えいたします。",
  },
  ar: {
    title: "اختبار Vector الصوتي",
    subtitle:
      "محادثة اختبارية للقراءة فقط لـ DBR77 Vector. أشرح المنتج ضمن نطاق الصفحة الحالية.",
    statusReady: "جاهز",
    statusListening: "أستمع...",
    statusThinking: "أحلل...",
    statusSpeaking: "أتحدث...",
    statusUnsupported:
      "التعرف على الصوت غير مدعوم في هذا المتصفح. لا يزال بإمكانك كتابة سؤالك أدناه.",
    start: "بدء المحادثة",
    stop: "إنهاء المحادثة",
    placeholder: "اكتب سؤالك...",
    send: "إرسال",
    suggestions: "أسئلة مقترحة",
    startHint: "تبدأ المحادثة دائمًا بلغة الصفحة الحالية.",
    testMode: "وضع الاختبار",
    readOnly: "للقراءة فقط",
    scopeTitle: "النطاق الحالي",
    transcriptTitle: "المحادثة",
    transcriptEmptyTitle: "هذا شارح صوتي مرتبط بالصفحة.",
    transcriptEmptyBody:
      "اسأل عن النموذج أو التدريب أو النشر أو المنتجات أو الأمان. يبقى المساعد ضمن نطاق هذه الصفحة.",
  },
  es: {
    title: "Vector Voice Test",
    subtitle:
      "Conversación de prueba de solo lectura para DBR77 Vector. Explico el producto dentro del alcance de la página actual.",
    statusReady: "Listo",
    statusListening: "Escuchando...",
    statusThinking: "Analizando...",
    statusSpeaking: "Hablando...",
    statusUnsupported:
      "El reconocimiento de voz no es compatible con este navegador. Aún puede escribir su pregunta a continuación.",
    start: "Iniciar conversación",
    stop: "Finalizar conversación",
    placeholder: "Escriba su pregunta...",
    send: "Enviar",
    suggestions: "Preguntas sugeridas",
    startHint: "La conversación siempre comienza en el idioma de la página actual.",
    testMode: "Modo de prueba",
    readOnly: "Solo lectura",
    scopeTitle: "Alcance actual",
    transcriptTitle: "Conversación",
    transcriptEmptyTitle: "Este es un explicador de voz adaptado a la página.",
    transcriptEmptyBody:
      "Pregunte sobre el modelo, el entrenamiento, el despliegue, los productos o la seguridad. El asistente se mantiene dentro del alcance de esta página.",
  },
} as const;

function localized(
  en: string,
  pl: string,
  de: string,
  ja: string,
  ar: string,
  es: string
): Record<Locale, string> {
  return { en, pl, de, ja, ar, es };
}

const followUpPatterns = [
  "what about that",
  "what about this",
  "tell me more",
  "go deeper",
  "and that",
  "and this",
  "more detail",
  "a co z tym",
  "powiedz wiecej",
  "rozwin to",
  "a co dalej",
  "und was ist damit",
  "erzahl mehr",
  "geh tiefer",
  "mehr details",
  "もっと教えて",
  "詳しく",
  "それについて",
  "続けて",
  "أخبرني المزيد",
  "المزيد من التفاصيل",
  "وماذا عن ذلك",
  "استمر",
  "cuéntame más",
  "más detalles",
  "y eso",
  "continúa",
];

const outOfScopePatterns = [
  "weather",
  "joke",
  "politics",
  "legal advice",
  "medical",
  "programming",
  "pogoda",
  "zart",
  "polityka",
  "porada prawna",
  "medyczne",
  "kodowanie",
  "wetter",
  "witz",
  "politik",
  "rechtsberatung",
  "medizin",
  "programmierung",
  "天気",
  "冗談",
  "政治",
  "法律相談",
  "医療",
  "プログラミング",
  "طقس",
  "نكتة",
  "سياسة",
  "استشارة قانونية",
  "طبي",
  "برمجة",
  "clima",
  "chiste",
  "política",
  "asesoría legal",
  "médico",
  "programación",
];

const globalTopics: VoiceTopic[] = [
  {
    id: "what-is-vector",
    triggers: [
      "what is vector",
      "what is dbr77 vector",
      "what exactly is this",
      "language model",
      "llm",
      "co to jest",
      "czym jest vector",
      "czym jest dbr77 vector",
      "model jezykowy",
      "was ist vector",
      "was ist dbr77 vector",
      "sprachmodell",
      "vectorとは",
      "dbr77 vectorとは",
      "言語モデル",
      "ما هو vector",
      "ما هو dbr77 vector",
      "نموذج لغوي",
      "qué es vector",
      "qué es dbr77 vector",
      "modelo de lenguaje",
    ],
    answers: localized(
      "DBR77 Vector is a proprietary Large Language Model built for industrial operations. It was trained on more than 1,400 real factory transformation cases, so it can explain bottlenecks, layouts, production flow, automation priorities, and deployment options with domain depth rather than generic internet knowledge.",
      "DBR77 Vector to wlasny model jezykowy klasy Large Language Model zbudowany dla zastosowan przemyslowych. Zostal wytrenowany na ponad 1400 realnych case'ach transformacji fabryk, dlatego potrafi wyjasniac bottlenecks, layouty, flow produkcji, priorytety automatyzacji i modele wdrozenia z glebia domenowa, a nie ogolna wiedza internetowa.",
      "DBR77 Vector ist ein proprietaeres Large Language Model fuer industrielle Anwendungen. Es wurde auf mehr als 1.400 realen Transformationsfaellen aus Fabriken trainiert und kann daher Engpaesse, Layouts, Produktionsfluesse, Automatisierungsprioritaeten und Deployment-Modelle mit echter Domaenentiefe erklaeren statt mit generischem Internetwissen.",
      "DBR77 Vectorは、産業オペレーション向けに構築された独自のLarge Language Modelです。1,400件以上の実際の工場変革事例でトレーニングされており、ボトルネック、レイアウト、生産フロー、自動化の優先順位、デプロイメントオプションを、一般的なインターネット知識ではなく、深い専門知識で説明することができます。",
      "DBR77 Vector هو نموذج لغوي كبير (LLM) خاص مصمم للعمليات الصناعية. تم تدريبه على أكثر من 1,400 حالة تحول حقيقية في المصانع، مما يمكّنه من شرح الاختناقات والتخطيطات وتدفق الإنتاج وأولويات الأتمتة وخيارات النشر بعمق متخصص بدلاً من المعرفة العامة من الإنترنت.",
      "DBR77 Vector es un Large Language Model propietario diseñado para operaciones industriales. Fue entrenado con más de 1.400 casos reales de transformación de fábricas, por lo que puede explicar cuellos de botella, layouts, flujo de producción, prioridades de automatización y opciones de despliegue con profundidad de dominio en lugar de conocimiento genérico de internet."
    ),
    details: localized(
      "At the homepage level, the simplest definition is this: Vector is the decision intelligence layer of the DBR77 ecosystem. It combines LLM-style language understanding with industrial reasoning learned from transformation work, not just public text.",
      "Na poziomie strony glownej najprostsza definicja jest taka: Vector to warstwa inteligencji decyzyjnej ekosystemu DBR77. Laczy rozumienie jezyka w stylu LLM z przemyslowym reasoningiem wyuczonym na pracy transformacyjnej, a nie tylko na publicznym tekscie.",
      "Auf Ebene der Startseite ist die einfachste Definition: Vector ist die Entscheidungsintelligenz des DBR77-Oekosystems. Es verbindet LLM-artiges Sprachverstaendnis mit industrieller Logik, die aus realer Transformationsarbeit gelernt wurde und nicht nur aus oeffentlichem Text.",
      "ホームページレベルでの最もシンプルな定義はこちらです。VectorはDBR77エコシステムの意思決定インテリジェンス層です。LLMスタイルの言語理解と、公開テキストだけでなく変革業務から学んだ産業推論を組み合わせています。",
      "على مستوى الصفحة الرئيسية، أبسط تعريف هو: Vector هو طبقة ذكاء القرار في منظومة DBR77. يجمع بين فهم اللغة بأسلوب LLM والاستدلال الصناعي المستفاد من أعمال التحول، وليس فقط من النصوص العامة.",
      "A nivel de la página principal, la definición más simple es esta: Vector es la capa de inteligencia de decisión del ecosistema DBR77. Combina la comprensión lingüística estilo LLM con razonamiento industrial aprendido del trabajo de transformación, no solo de texto público."
    ),
    nextSuggestions: {
      en: ["How was it trained?", "How can it be deployed?", "Where is it used in DBR77 products?"],
      pl: ["Jak byl trenowany?", "Jak moze byc wdrazany?", "W ktorych produktach DBR77 jest uzywany?"],
      de: ["Wie wurde es trainiert?", "Wie kann es bereitgestellt werden?", "In welchen DBR77-Produkten wird es genutzt?"],
      ja: ["どのようにトレーニングされましたか？", "どのようにデプロイできますか？", "DBR77のどの製品で使用されていますか？"],
      ar: ["كيف تم تدريبه؟", "كيف يمكن نشره؟", "في أي منتجات DBR77 يُستخدم؟"],
      es: ["¿Cómo fue entrenado?", "¿Cómo puede desplegarse?", "¿En qué productos de DBR77 se utiliza?"],
    },
  },
  {
    id: "training",
    triggers: [
      "training",
      "how was it trained",
      "cases",
      "production cases",
      "trained on",
      "trening",
      "jak byl trenowany",
      "na czym trenowany",
      "przypadki",
      "wie trainiert",
      "auf welchen fallen",
      "falle",
      "トレーニング",
      "どのように訓練",
      "事例",
      "تدريب",
      "كيف تم تدريبه",
      "حالات",
      "entrenamiento",
      "cómo fue entrenado",
      "casos",
    ],
    answers: localized(
      "Vector was trained on more than 1,400 real industrial transformation cases. The corpus includes factory diagnosis, layout design, production flow analysis, Lean improvement programs, ROI framing, and automation rollout decisions. The model learns patterns from anonymized industrial experience, not from public internet text alone.",
      "Vector byl trenowany na ponad 1400 realnych przypadkach transformacji przemyslowych. Ten korpus obejmuje diagnostyke fabryk, projektowanie layoutow, analize flow produkcji, programy Lean, modelowanie ROI i decyzje dotyczace rolloutow automatyzacji. Model uczy sie wzorcow z anonimizowanego doswiadczenia przemyslowego, a nie wylacznie z publicznego internetu.",
      "Vector wurde auf mehr als 1.400 realen industriellen Transformationsfaellen trainiert. Der Korpus umfasst Fabrikdiagnosen, Layout-Design, Produktionsflussanalyse, Lean-Programme, ROI-Bewertung und Entscheidungen zu Automatisierungs-Rollouts. Das Modell lernt Muster aus anonymisierter industrieller Erfahrung, nicht nur aus oeffentlichem Internettext.",
      "Vectorは1,400件以上の実際の産業変革事例でトレーニングされました。コーパスには工場診断、レイアウト設計、生産フロー分析、Lean改善プログラム、ROIフレーミング、自動化ロールアウトの意思決定が含まれています。モデルは匿名化された産業経験からパターンを学習しており、公開インターネットテキストだけに依存していません。",
      "تم تدريب Vector على أكثر من 1,400 حالة تحول صناعي حقيقية. يشمل المحتوى التدريبي تشخيص المصانع وتصميم التخطيطات وتحليل تدفق الإنتاج وبرامج Lean وتأطير ROI وقرارات طرح الأتمتة. يتعلم النموذج الأنماط من الخبرة الصناعية المجهولة الهوية، وليس من نصوص الإنترنت العامة فقط.",
      "Vector fue entrenado con más de 1.400 casos reales de transformación industrial. El corpus incluye diagnóstico de fábricas, diseño de layouts, análisis de flujo de producción, programas de mejora Lean, modelado de ROI y decisiones de despliegue de automatización. El modelo aprende patrones de experiencia industrial anonimizada, no solo de texto público de internet."
    ),
    details: localized(
      "The important point is not only the number of cases. The important point is the structure of those cases: plant optimization, greenfield layout design, process improvement, production flow analysis, and shop-floor automation. That gives Vector a much stronger operational pattern library than a generic model.",
      "Najwazniejsza nie jest tylko liczba case'ow. Kluczowa jest ich struktura: optymalizacja zakladow, greenfield layout design, process improvement, analiza flow produkcji i shop-floor automation. To daje Vectorowi znacznie mocniejsza biblioteke wzorcow operacyjnych niz model generyczny.",
      "Entscheidend ist nicht nur die Anzahl der Faelle. Entscheidend ist ihre Struktur: Optimierung von Werken, Greenfield-Layout-Design, Prozessverbesserung, Produktionsflussanalyse und Shop-Floor-Automatisierung. Dadurch erhaelt Vector eine deutlich staerkere operative Musterbibliothek als ein generisches Modell.",
      "重要なのは事例の数だけではありません。重要なのはそれらの事例の構造です。工場最適化、グリーンフィールドレイアウト設計、プロセス改善、生産フロー分析、ショップフロア自動化。これにより、Vectorは汎用モデルよりもはるかに強力なオペレーションパターンライブラリを持っています。",
      "النقطة المهمة ليست عدد الحالات فحسب. النقطة المهمة هي بنية تلك الحالات: تحسين المصانع وتصميم التخطيطات الجديدة وتحسين العمليات وتحليل تدفق الإنتاج وأتمتة أرضية المصنع. هذا يمنح Vector مكتبة أنماط تشغيلية أقوى بكثير من النموذج العام.",
      "Lo importante no es solo el número de casos. Lo importante es la estructura de esos casos: optimización de plantas, diseño de layouts greenfield, mejora de procesos, análisis de flujo de producción y automatización de planta. Esto le da a Vector una biblioteca de patrones operativos mucho más sólida que un modelo genérico."
    ),
    nextSuggestions: {
      en: ["What competencies did the model develop?", "Why is this different from internet-trained AI?", "How is client data handled?"],
      pl: ["Jakie kompetencje rozwinął model?", "Dlaczego to się różni od AI trenowanego na internecie?", "Jak traktowane są dane klienta?"],
      de: ["Welche Kompetenzen hat das Modell entwickelt?", "Warum unterscheidet sich das von internettrainierter KI?", "Wie werden Kundendaten behandelt?"],
      ja: ["モデルはどのような能力を開発しましたか？", "インターネットで訓練されたAIとどう違いますか？", "クライアントデータはどのように扱われますか？"],
      ar: ["ما الكفاءات التي طورها النموذج؟", "لماذا يختلف هذا عن الذكاء الاصطناعي المدرب على الإنترنت؟", "كيف تتم معالجة بيانات العملاء؟"],
      es: ["¿Qué competencias desarrolló el modelo?", "¿Por qué es diferente de la IA entrenada en internet?", "¿Cómo se manejan los datos del cliente?"],
    },
  },
  {
    id: "deployment",
    triggers: [
      "deployment",
      "on premise",
      "on prem",
      "private api",
      "shared api",
      "security deployment",
      "wdrozenie",
      "modele wdrozenia",
      "bereitstellung",
      "デプロイメント",
      "オンプレミス",
      "展開",
      "نشر",
      "نماذج النشر",
      "despliegue",
      "modelos de despliegue",
    ],
    answers: localized(
      "DBR77 Vector supports three deployment models: on-premise for maximum control, private dedicated API for isolated managed infrastructure, and shared API for fast pilots. The intelligence is the same in every model; the difference is where it runs, who manages the environment, and how strict the isolation needs to be.",
      "DBR77 Vector wspiera trzy modele wdrożenia: on-premise dla maksymalnej kontroli, private dedicated API dla izolowanego zarządzanego środowiska oraz shared API dla szybkich pilotaży. Inteligencja modelu jest taka sama w każdym wariancie; różni się to, gdzie model działa, kto zarządza środowiskiem i jak rygorystyczna musi być izolacja.",
      "DBR77 Vector unterstuetzt drei Deployment-Modelle: On-Premise fuer maximale Kontrolle, Private Dedicated API fuer isolierte gemanagte Infrastruktur und Shared API fuer schnelle Pilotprojekte. Die Intelligenz ist in jedem Modell gleich; der Unterschied liegt darin, wo es laeuft, wer die Umgebung verwaltet und wie strikt die Isolation sein muss.",
      "DBR77 Vectorは3つのデプロイメントモデルをサポートしています。最大限の制御のためのオンプレミス、隔離されたマネージドインフラのためのprivate dedicated API、迅速なパイロットのためのshared APIです。どのモデルでもインテリジェンスは同じです。違いは、どこで実行されるか、誰が環境を管理するか、どの程度厳格な隔離が必要かという点です。",
      "يدعم DBR77 Vector ثلاثة نماذج نشر: on-premise للتحكم الأقصى، وprivate dedicated API للبنية التحتية المُدارة المعزولة، وshared API للتجارب السريعة. الذكاء هو نفسه في كل نموذج؛ الفرق هو أين يعمل، ومن يدير البيئة، ومدى صرامة العزل المطلوب.",
      "DBR77 Vector admite tres modelos de despliegue: on-premise para máximo control, private dedicated API para infraestructura gestionada aislada, y shared API para pilotos rápidos. La inteligencia es la misma en cada modelo; la diferencia radica en dónde se ejecuta, quién gestiona el entorno y cuán estricto debe ser el aislamiento."
    ),
    details: localized(
      "If you want the cleanest summary: on-premise maximizes sovereignty, private dedicated API balances isolation and speed, and shared API minimizes friction for evaluation. The business logic remains the same; the operating model changes.",
      "Jesli chcesz najkrotsze podsumowanie: on-premise maksymalizuje suwerennosc, private dedicated API rownowazy izolacje i szybkosc, a shared API minimalizuje prog wejscia dla ewaluacji. Logika biznesowa pozostaje taka sama, zmienia sie model operacyjny.",
      "Wenn Sie die kuerzeste Zusammenfassung moechten: On-Premise maximiert Souveraenitaet, Private Dedicated API balanciert Isolation und Geschwindigkeit, und Shared API minimiert die Eintrittsbarriere fuer Evaluation. Die Geschaeftslogik bleibt gleich, das Betriebsmodell aendert sich.",
      "最も簡潔にまとめると、オンプレミスは主権を最大化し、private dedicated APIは隔離と速度のバランスを取り、shared APIは評価のための障壁を最小化します。ビジネスロジックは同じままで、運用モデルが変わります。",
      "إذا أردت أوضح ملخص: on-premise يزيد السيادة إلى أقصى حد، وprivate dedicated API يوازن بين العزل والسرعة، وshared API يقلل العوائق أمام التقييم. منطق الأعمال يبقى كما هو؛ نموذج التشغيل هو الذي يتغير.",
      "Si desea el resumen más claro: on-premise maximiza la soberanía, private dedicated API equilibra aislamiento y velocidad, y shared API minimiza la fricción para la evaluación. La lógica de negocio permanece igual; el modelo operativo cambia."
    ),
    nextSuggestions: {
      en: ["Which model is best for pilots?", "How secure is shared API?", "Why is deployment isolation important?"],
      pl: ["Ktory model jest najlepszy dla pilotazu?", "Jak bezpieczny jest shared API?", "Dlaczego izolacja wdrozenia jest wazna?"],
      de: ["Welches Modell ist am besten fuer Pilotprojekte?", "Wie sicher ist die Shared API?", "Warum ist Deployment-Isolation wichtig?"],
      ja: ["パイロットに最適なモデルはどれですか？", "shared APIはどの程度安全ですか？", "デプロイメントの隔離はなぜ重要ですか？"],
      ar: ["أي نموذج هو الأفضل للتجارب؟", "ما مدى أمان shared API؟", "لماذا يُعد عزل النشر مهمًا؟"],
      es: ["¿Qué modelo es mejor para pilotos?", "¿Qué tan segura es la shared API?", "¿Por qué es importante el aislamiento del despliegue?"],
    },
  },
  {
    id: "products",
    triggers: [
      "products",
      "consultify",
      "digital twin",
      "iot",
      "marketplace",
      "produkty",
      "produkte",
      "製品",
      "プロダクト",
      "منتجات",
      "productos",
    ],
    answers: localized(
      "Vector is embedded across the DBR77 ecosystem. In Consultify it acts as a transformation consultant, in Digital Twin it explains scenarios and trade-offs, in IoT it interprets anomalies and operational signals, and in Marketplace it supports automation and supplier matching decisions.",
      "Vector jest osadzony w calym ekosystemie DBR77. W Consultify dziala jak konsultant transformacyjny, w Digital Twin wyjasnia scenariusze i trade-offy, w IoT interpretuje anomalie i sygnaly operacyjne, a w Marketplace wspiera decyzje o automatyzacji i dopasowaniu dostawcow.",
      "Vector ist im gesamten DBR77-Oekosystem eingebettet. In Consultify agiert es als Transformationsberater, im Digital Twin erklaert es Szenarien und Trade-offs, im IoT interpretiert es Anomalien und operative Signale, und im Marketplace unterstuetzt es Entscheidungen zu Automatisierung und Lieferantenauswahl.",
      "VectorはDBR77エコシステム全体に組み込まれています。Consultifyでは変革コンサルタントとして機能し、Digital Twinではシナリオとトレードオフを説明し、IoTでは異常とオペレーション信号を解釈し、Marketplaceでは自動化とサプライヤーマッチングの意思決定を支援します。",
      "Vector مدمج في منظومة DBR77 بأكملها. في Consultify يعمل كمستشار تحول، وفي Digital Twin يشرح السيناريوهات والمقايضات، وفي IoT يفسر الشذوذ والإشارات التشغيلية، وفي Marketplace يدعم قرارات الأتمتة ومطابقة الموردين.",
      "Vector está integrado en todo el ecosistema DBR77. En Consultify actúa como consultor de transformación, en Digital Twin explica escenarios y trade-offs, en IoT interpreta anomalías y señales operativas, y en Marketplace apoya las decisiones de automatización y selección de proveedores."
    ),
    details: localized(
      "The key homepage message is that Vector is not a side feature. It is the intelligence heart of the DBR77 ecosystem, and the products are the main way clients experience its value in practice.",
      "Kluczowy przekaz strony glownej jest taki, ze Vector nie jest dodatkiem. To intelligence heart of the DBR77 ecosystem, a produkty sa glownym sposobem, w jaki klienci realnie doswiadczaja jego wartosci.",
      "Die zentrale Botschaft der Startseite ist, dass Vector kein Zusatzfeature ist. Es ist das intelligence heart of the DBR77 ecosystem, und die Produkte sind der Hauptweg, ueber den Kunden seinen Wert praktisch erleben.",
      "ホームページの重要なメッセージは、Vectorが付随的な機能ではないということです。DBR77エコシステムのインテリジェンスの中核であり、製品はクライアントがその価値を実際に体験する主要な手段です。",
      "الرسالة الرئيسية للصفحة الرئيسية هي أن Vector ليس ميزة جانبية. إنه قلب الذكاء في منظومة DBR77، والمنتجات هي الطريقة الرئيسية التي يختبر بها العملاء قيمته عمليًا.",
      "El mensaje clave de la página principal es que Vector no es una función secundaria. Es el corazón de inteligencia del ecosistema DBR77, y los productos son la forma principal en que los clientes experimentan su valor en la práctica."
    ),
    nextSuggestions: {
      en: ["What does Vector do in Consultify?", "How does Vector support Digital Twin?", "How is Vector used in IoT and Marketplace?"],
      pl: ["Co Vector robi w Consultify?", "Jak Vector wspiera Digital Twin?", "Jak Vector jest uzywany w IoT i Marketplace?"],
      de: ["Was macht Vector in Consultify?", "Wie unterstuetzt Vector den Digital Twin?", "Wie wird Vector in IoT und Marketplace eingesetzt?"],
      ja: ["VectorはConsultifyで何をしますか？", "VectorはDigital Twinをどのようにサポートしますか？", "VectorはIoTとMarketplaceでどのように使用されますか？"],
      ar: ["ماذا يفعل Vector في Consultify؟", "كيف يدعم Vector الـ Digital Twin؟", "كيف يُستخدم Vector في IoT وMarketplace؟"],
      es: ["¿Qué hace Vector en Consultify?", "¿Cómo apoya Vector al Digital Twin?", "¿Cómo se usa Vector en IoT y Marketplace?"],
    },
  },
  {
    id: "security",
    triggers: [
      "security",
      "is it secure",
      "safe",
      "data",
      "training data",
      "bezpieczenstwo",
      "czy to bezpieczne",
      "dane",
      "anonimizowane",
      "sicherheit",
      "ist es sicher",
      "daten",
      "anonymisiert",
      "セキュリティ",
      "安全",
      "データ",
      "أمان",
      "هل هو آمن",
      "بيانات",
      "seguridad",
      "es seguro",
      "datos",
    ],
    answers: localized(
      "The security model is based on anonymized training cases, deployment isolation, human approval, and enterprise governance. Vector can run on-premise, through a private dedicated API, or through a shared model with policy controls. The design goal is industrial-grade trust, not consumer AI convenience.",
      "Model bezpieczenstwa opiera sie na anonimizowanych case'ach treningowych, izolacji wdrozenia, human approval i enterprise governance. Vector moze dzialac on-premise, przez private dedicated API albo przez wspoldzielony model z kontrola polityk. Celem projektu jest zaufanie klasy przemyslowej, a nie wygoda typowa dla konsumenckiego AI.",
      "Das Sicherheitsmodell basiert auf anonymisierten Trainingsfaellen, Deployment-Isolation, Human Approval und Enterprise Governance. Vector kann On-Premise, ueber eine Private Dedicated API oder in einem geteilten Modell mit Richtlinienkontrolle betrieben werden. Das Designziel ist industrietaugliches Vertrauen, nicht der Komfort von Consumer-AI.",
      "セキュリティモデルは、匿名化されたトレーニング事例、デプロイメントの隔離、人間による承認、エンタープライズガバナンスに基づいています。Vectorはオンプレミス、private dedicated API、またはポリシー制御付きのsharedモデルで実行できます。設計目標は産業グレードの信頼性であり、消費者向けAIの利便性ではありません。",
      "يعتمد نموذج الأمان على حالات تدريب مجهولة الهوية وعزل النشر والموافقة البشرية وحوكمة المؤسسات. يمكن تشغيل Vector على on-premise أو من خلال private dedicated API أو من خلال نموذج مشترك مع ضوابط السياسات. هدف التصميم هو الثقة على المستوى الصناعي، وليس راحة الذكاء الاصطناعي الاستهلاكي.",
      "El modelo de seguridad se basa en casos de entrenamiento anonimizados, aislamiento de despliegue, aprobación humana y gobernanza empresarial. Vector puede ejecutarse on-premise, a través de una private dedicated API o a través de un modelo compartido con controles de políticas. El objetivo de diseño es la confianza de grado industrial, no la conveniencia del AI de consumo."
    ),
    details: localized(
      "The page-level message is not that security is a marketing add-on. The message is that industrial AI requires a stricter operating model: anonymization, isolation, auditability, and human approval built into the system design.",
      "Przekaz tej strony nie jest taki, ze bezpieczenstwo jest marketingowym dodatkiem. Przekaz jest taki, ze industrial AI wymaga ostrzejszego modelu operacyjnego: anonimizacji, izolacji, auditability i human approval wbudowanych w projekt systemu.",
      "Die Botschaft dieser Seite ist nicht, dass Sicherheit ein Marketing-Zusatz ist. Die Botschaft ist, dass Industrial AI ein strengeres Betriebsmodell braucht: Anonymisierung, Isolation, Auditierbarkeit und Human Approval als Teil des Systemdesigns.",
      "このページのメッセージは、セキュリティがマーケティングの付加物であるということではありません。メッセージは、産業AIにはより厳格な運用モデルが必要であるということです。匿名化、隔離、監査可能性、人間による承認がシステム設計に組み込まれています。",
      "رسالة هذه الصفحة ليست أن الأمان إضافة تسويقية. الرسالة هي أن الذكاء الاصطناعي الصناعي يتطلب نموذج تشغيل أكثر صرامة: إخفاء الهوية والعزل وقابلية التدقيق والموافقة البشرية مدمجة في تصميم النظام.",
      "El mensaje a nivel de página no es que la seguridad sea un complemento de marketing. El mensaje es que la IA industrial requiere un modelo operativo más estricto: anonimización, aislamiento, auditabilidad y aprobación humana integrados en el diseño del sistema."
    ),
    nextSuggestions: {
      en: ["Does client data train the model?", "How is deployment isolated?", "Why is Vector safer than public LLMs?"],
      pl: ["Czy dane klienta trenują model?", "Jak działa izolacja wdrożenia?", "Dlaczego Vector jest bezpieczniejszy niż publiczne LLM-y?"],
      de: ["Trainieren Kundendaten das Modell?", "Wie funktioniert die Deployment-Isolation?", "Warum ist Vector sicherer als oeffentliche LLMs?"],
      ja: ["クライアントデータはモデルのトレーニングに使用されますか？", "デプロイメントの隔離はどのように機能しますか？", "Vectorが公開LLMより安全な理由は？"],
      ar: ["هل تُدرّب بيانات العملاء النموذج؟", "كيف يتم عزل النشر؟", "لماذا Vector أكثر أمانًا من LLM العامة؟"],
      es: ["¿Los datos del cliente entrenan el modelo?", "¿Cómo se aísla el despliegue?", "¿Por qué Vector es más seguro que los LLM públicos?"],
    },
  },
];

export const voicePages: Record<VoicePageId, VoicePageConfig> = {
  overview: {
    title: localized("Homepage", "Strona glowna", "Startseite", "ホームページ", "الصفحة الرئيسية", "Página principal"),
    intro: localized(
      "Hello, I can explain what DBR77 Vector is, how it was trained, how it can be deployed, and where it is used across the DBR77 ecosystem.",
      "Dzien dobry, moge wyjasnic czym jest DBR77 Vector, jak byl trenowany, jak moze byc wdrazany i gdzie jest uzywany w ekosystemie DBR77.",
      "Guten Tag, ich kann erklaeren, was DBR77 Vector ist, wie es trainiert wurde, wie es bereitgestellt werden kann und wo es im DBR77-Oekosystem eingesetzt wird.",
      "こんにちは。DBR77 Vectorとは何か、どのようにトレーニングされたか、どのようにデプロイできるか、DBR77エコシステムのどこで使用されているかをご説明いたします。",
      "مرحبًا، يمكنني شرح ما هو DBR77 Vector وكيف تم تدريبه وكيف يمكن نشره وأين يُستخدم في منظومة DBR77.",
      "Buenos días, puedo explicar qué es DBR77 Vector, cómo fue entrenado, cómo puede desplegarse y dónde se utiliza en el ecosistema DBR77."
    ),
    suggestions: {
      en: ["What exactly is DBR77 Vector?", "How was it trained?", "Where is it used in DBR77 products?"],
      pl: ["Czym dokladnie jest DBR77 Vector?", "Jak byl trenowany?", "W ktorych produktach DBR77 jest uzywany?"],
      de: ["Was genau ist DBR77 Vector?", "Wie wurde es trainiert?", "In welchen DBR77-Produkten wird es genutzt?"],
      ja: ["DBR77 Vectorとは正確には何ですか？", "どのようにトレーニングされましたか？", "DBR77のどの製品で使用されていますか？"],
      ar: ["ما هو DBR77 Vector بالضبط؟", "كيف تم تدريبه؟", "في أي منتجات DBR77 يُستخدم؟"],
      es: ["¿Qué es exactamente DBR77 Vector?", "¿Cómo fue entrenado?", "¿En qué productos de DBR77 se utiliza?"],
    },
    scope: {
      en: ["Model overview", "Training base", "Deployment models", "Products", "Security"],
      pl: ["Opis modelu", "Baza treningowa", "Modele wdrozenia", "Produkty", "Bezpieczenstwo"],
      de: ["Modellueberblick", "Trainingsbasis", "Deployment-Modelle", "Produkte", "Sicherheit"],
      ja: ["モデル概要", "トレーニングベース", "デプロイメントモデル", "製品", "セキュリティ"],
      ar: ["نظرة عامة على النموذج", "قاعدة التدريب", "نماذج النشر", "المنتجات", "الأمان"],
      es: ["Descripción del modelo", "Base de entrenamiento", "Modelos de despliegue", "Productos", "Seguridad"],
    },
    topics: globalTopics,
  },
  training: {
    title: localized("Training", "Training", "Training", "トレーニング", "التدريب", "Entrenamiento"),
    intro: localized(
      "Hello, I can explain how DBR77 Vector was trained and which operational competencies it learned from real transformation cases.",
      "Dzien dobry, moge wyjasnic jak DBR77 Vector byl trenowany i jakie kompetencje operacyjne rozwinąl na podstawie realnych case'ow transformacyjnych.",
      "Guten Tag, ich kann erklaeren, wie DBR77 Vector trainiert wurde und welche operativen Kompetenzen es aus realen Transformationsfaellen gelernt hat.",
      "こんにちは。DBR77 Vectorがどのようにトレーニングされ、実際の変革事例からどのようなオペレーション能力を学んだかをご説明いたします。",
      "مرحبًا، يمكنني شرح كيف تم تدريب DBR77 Vector وما الكفاءات التشغيلية التي تعلمها من حالات التحول الحقيقية.",
      "Buenos días, puedo explicar cómo fue entrenado DBR77 Vector y qué competencias operativas aprendió de casos reales de transformación."
    ),
    suggestions: {
      en: ["What cases were included in training?", "What competencies did the model develop?", "Why is this different from internet-trained AI?"],
      pl: ["Jakie case'y byly uwzglednione w treningu?", "Jakie kompetencje rozwinąl model?", "Dlaczego to sie rozni od AI trenowanego na internecie?"],
      de: ["Welche Faelle wurden im Training verwendet?", "Welche Kompetenzen hat das Modell entwickelt?", "Warum unterscheidet sich das von internettrainierter KI?"],
      ja: ["トレーニングにはどのような事例が含まれていましたか？", "モデルはどのような能力を開発しましたか？", "インターネットで訓練されたAIとどう違いますか？"],
      ar: ["ما الحالات التي تم تضمينها في التدريب؟", "ما الكفاءات التي طورها النموذج؟", "لماذا يختلف هذا عن الذكاء الاصطناعي المدرب على الإنترنت؟"],
      es: ["¿Qué casos se incluyeron en el entrenamiento?", "¿Qué competencias desarrolló el modelo?", "¿Por qué es diferente de la IA entrenada en internet?"],
    },
    scope: {
      en: ["Real transformation cases", "Operational competencies", "Lean reasoning", "Factory intelligence"],
      pl: ["Realne case'y transformacyjne", "Kompetencje operacyjne", "Lean reasoning", "Factory intelligence"],
      de: ["Reale Transformationsfaelle", "Operative Kompetenzen", "Lean-Reasoning", "Factory Intelligence"],
      ja: ["実際の変革事例", "オペレーション能力", "Lean推論", "Factory Intelligence"],
      ar: ["حالات تحول حقيقية", "كفاءات تشغيلية", "استدلال Lean", "ذكاء المصنع"],
      es: ["Casos reales de transformación", "Competencias operativas", "Razonamiento Lean", "Factory Intelligence"],
    },
    topics: [
      ...globalTopics,
      {
        id: "competencies",
        triggers: [
          "competencies",
          "skills",
          "lean",
          "roi",
          "layout",
          "flow",
          "automation",
          "kompetencje",
          "umiejetnosci",
          "automatyzacja",
          "kompetenzen",
          "fahigkeiten",
          "automatisierung",
          "能力",
          "スキル",
          "自動化",
          "كفاءات",
          "مهارات",
          "أتمتة",
          "competencias",
          "habilidades",
          "automatización",
        ],
        answers: localized(
          "The training base developed six major competency areas: factory diagnosis, transformation roadmap design, production decision support, ROI reasoning, automation strategy, and Lean operational excellence. In practical terms, Vector reasons about bottlenecks, waste, sequencing, investment logic, and rollout risk.",
          "Baza treningowa rozwinela szesc glownych obszarow kompetencji: diagnostyke fabryki, projektowanie roadmap transformacji, wsparcie decyzji produkcyjnych, rozumowanie ROI, strategie automatyzacji oraz Lean operational excellence. W praktyce Vector rozumuje o bottleneckach, marnotrawstwie, sekwencjonowaniu dzialan, logice inwestycji i ryzyku rolloutow.",
          "Die Trainingsbasis hat sechs wesentliche Kompetenzfelder entwickelt: Fabrikdiagnose, Gestaltung von Transformations-Roadmaps, Unterstuetzung von Produktionsentscheidungen, ROI-Bewertung, Automatisierungsstrategie und Lean Operational Excellence. Praktisch bedeutet das, dass Vector ueber Engpaesse, Verschwendung, Sequenzierung, Investitionslogik und Rollout-Risiken argumentieren kann.",
          "トレーニングベースは6つの主要な能力領域を開発しました。工場診断、変革ロードマップ設計、生産意思決定支援、ROI推論、自動化戦略、Lean Operational Excellenceです。実務的には、Vectorはボトルネック、ムダ、シーケンシング、投資ロジック、ロールアウトリスクについて推論します。",
          "طورت قاعدة التدريب ست مجالات كفاءة رئيسية: تشخيص المصنع وتصميم خارطة طريق التحول ودعم قرارات الإنتاج واستدلال ROI واستراتيجية الأتمتة وتميز Lean التشغيلي. عمليًا، يستدل Vector حول الاختناقات والهدر والتسلسل ومنطق الاستثمار ومخاطر الطرح.",
          "La base de entrenamiento desarrolló seis áreas principales de competencia: diagnóstico de fábrica, diseño de hojas de ruta de transformación, soporte de decisiones de producción, razonamiento de ROI, estrategia de automatización y Lean Operational Excellence. En términos prácticos, Vector razona sobre cuellos de botella, desperdicios, secuenciación, lógica de inversión y riesgo de despliegue."
        ),
        details: localized(
          "Those competencies are not abstract labels. They map directly to real industrial work: identifying constraints, reasoning about layout and material flow, framing CAPEX and ROI, sequencing initiatives, and planning automation with lower rollout risk.",
          "Te kompetencje nie sa abstrakcyjnymi etykietami. Bezposrednio mapuja sie na realna prace przemyslowa: identyfikacje ograniczen, rozumowanie o layoutach i material flow, porzadkowanie CAPEX i ROI, sekwencjonowanie inicjatyw oraz planowanie automatyzacji z nizszym ryzykiem rolloutow.",
          "Diese Kompetenzen sind keine abstrakten Etiketten. Sie bilden reale industrielle Arbeit ab: Engpaesse identifizieren, ueber Layouts und Materialfluss argumentieren, CAPEX und ROI strukturieren, Initiativen sequenzieren und Automatisierung mit geringerem Rollout-Risiko planen.",
          "これらの能力は抽象的なラベルではありません。実際の産業業務に直接対応しています。制約の特定、レイアウトとマテリアルフローに関する推論、CAPEXとROIのフレーミング、イニシアチブのシーケンシング、より低いロールアウトリスクでの自動化計画です。",
          "هذه الكفاءات ليست تسميات مجردة. إنها تتوافق مباشرة مع العمل الصناعي الحقيقي: تحديد القيود والاستدلال حول التخطيط وتدفق المواد وتأطير CAPEX وROI وتسلسل المبادرات وتخطيط الأتمتة بمخاطر طرح أقل.",
          "Esas competencias no son etiquetas abstractas. Se corresponden directamente con el trabajo industrial real: identificar restricciones, razonar sobre layout y flujo de materiales, estructurar CAPEX y ROI, secuenciar iniciativas y planificar la automatización con menor riesgo de despliegue."
        ),
      },
    ],
  },
  deployment: {
    title: localized("Deployment", "Deployment", "Deployment", "デプロイメント", "النشر", "Despliegue"),
    intro: localized(
      "Hello, I can explain the deployment models for DBR77 Vector and how they differ in control, isolation, and operational responsibility.",
      "Dzien dobry, moge wyjasnic modele wdrozenia DBR77 Vector i pokazac czym roznia sie pod wzgledem kontroli, izolacji i odpowiedzialnosci operacyjnej.",
      "Guten Tag, ich kann die Deployment-Modelle fuer DBR77 Vector erklaeren und zeigen, wie sie sich in Kontrolle, Isolation und operativer Verantwortung unterscheiden.",
      "こんにちは。DBR77 Vectorのデプロイメントモデルと、制御、隔離、運用責任の面でどのように異なるかをご説明いたします。",
      "مرحبًا، يمكنني شرح نماذج نشر DBR77 Vector وكيف تختلف في التحكم والعزل والمسؤولية التشغيلية.",
      "Buenos días, puedo explicar los modelos de despliegue de DBR77 Vector y cómo difieren en control, aislamiento y responsabilidad operativa."
    ),
    suggestions: {
      en: ["What is the difference between on-premise and private API?", "Which model is best for pilots?", "How secure is shared API?"],
      pl: ["Jaka jest roznica miedzy on-premise a private API?", "Ktory model jest najlepszy dla pilotazu?", "Jak bezpieczny jest shared API?"],
      de: ["Was ist der Unterschied zwischen On-Premise und Private API?", "Welches Modell ist am besten fuer Pilotprojekte?", "Wie sicher ist die Shared API?"],
      ja: ["オンプレミスとprivate APIの違いは何ですか？", "パイロットに最適なモデルはどれですか？", "shared APIはどの程度安全ですか？"],
      ar: ["ما الفرق بين on-premise وprivate API؟", "أي نموذج هو الأفضل للتجارب؟", "ما مدى أمان shared API؟"],
      es: ["¿Cuál es la diferencia entre on-premise y private API?", "¿Qué modelo es mejor para pilotos?", "¿Qué tan segura es la shared API?"],
    },
    scope: {
      en: ["On-premise", "Private dedicated API", "Shared API", "Isolation", "Control"],
      pl: ["On-premise", "Private dedicated API", "Shared API", "Izolacja", "Kontrola"],
      de: ["On-Premise", "Private Dedicated API", "Shared API", "Isolation", "Kontrolle"],
      ja: ["オンプレミス", "Private dedicated API", "Shared API", "隔離", "制御"],
      ar: ["On-premise", "Private dedicated API", "Shared API", "العزل", "التحكم"],
      es: ["On-premise", "Private dedicated API", "Shared API", "Aislamiento", "Control"],
    },
    topics: [
      ...globalTopics,
      {
        id: "best-model",
        triggers: [
          "best model",
          "which model",
          "pilot",
          "ktory model",
          "najlepszy model",
          "pilotaz",
          "welches modell",
          "bestes modell",
          "最適なモデル",
          "パイロット",
          "أفضل نموذج",
          "تجربة",
          "mejor modelo",
          "piloto",
        ],
        answers: localized(
          "On-premise is best when sovereignty and internal control are critical. Private dedicated API fits companies that want strong isolation without running the infrastructure themselves. Shared API is best for fast pilots, workshops, and lower-friction testing.",
          "On-premise jest najlepszy, gdy kluczowe sa suwerennosc i pelna kontrola wewnetrzna. Private dedicated API pasuje firmom, ktore chca silnej izolacji bez samodzielnego utrzymywania infrastruktury. Shared API najlepiej sprawdza sie w szybkich pilotazach, warsztatach i testach o niskim progu wejscia.",
          "On-Premise ist am besten, wenn Souveraenitaet und interne Kontrolle entscheidend sind. Eine Private Dedicated API passt zu Unternehmen, die starke Isolation wollen, ohne die Infrastruktur selbst zu betreiben. Shared API eignet sich am besten fuer schnelle Pilotprojekte, Workshops und Tests mit geringer Einstiegshuerde.",
          "オンプレミスは、主権と内部制御が重要な場合に最適です。Private dedicated APIは、インフラを自社で運用せずに強力な隔離を求める企業に適しています。Shared APIは、迅速なパイロット、ワークショップ、低障壁のテストに最適です。",
          "On-premise هو الأفضل عندما تكون السيادة والتحكم الداخلي أمرًا بالغ الأهمية. Private dedicated API يناسب الشركات التي تريد عزلًا قويًا دون تشغيل البنية التحتية بنفسها. Shared API هو الأفضل للتجارب السريعة وورش العمل والاختبارات منخفضة العوائق.",
          "On-premise es mejor cuando la soberanía y el control interno son críticos. Private dedicated API se adapta a empresas que desean un fuerte aislamiento sin gestionar la infraestructura por sí mismas. Shared API es mejor para pilotos rápidos, talleres y pruebas de baja fricción."
        ),
      },
    ],
  },
  products: {
    title: localized("Products", "Produkty", "Produkte", "製品", "المنتجات", "Productos"),
    intro: localized(
      "Hello, I can explain how DBR77 Vector works inside Consultify, Digital Twin, IoT, and Marketplace.",
      "Dzien dobry, moge wyjasnic jak DBR77 Vector dziala wewnatrz Consultify, Digital Twin, IoT i Marketplace.",
      "Guten Tag, ich kann erklaeren, wie DBR77 Vector innerhalb von Consultify, Digital Twin, IoT und Marketplace arbeitet.",
      "こんにちは。DBR77 VectorがConsultify、Digital Twin、IoT、Marketplaceの中でどのように機能するかをご説明いたします。",
      "مرحبًا، يمكنني شرح كيف يعمل DBR77 Vector داخل Consultify وDigital Twin وIoT وMarketplace.",
      "Buenos días, puedo explicar cómo funciona DBR77 Vector dentro de Consultify, Digital Twin, IoT y Marketplace."
    ),
    suggestions: {
      en: ["What does Vector do in Consultify?", "How does Vector support Digital Twin?", "How is Vector used in IoT and Marketplace?"],
      pl: ["Co Vector robi w Consultify?", "Jak Vector wspiera Digital Twin?", "Jak Vector jest uzywany w IoT i Marketplace?"],
      de: ["Was macht Vector in Consultify?", "Wie unterstuetzt Vector den Digital Twin?", "Wie wird Vector in IoT und Marketplace eingesetzt?"],
      ja: ["VectorはConsultifyで何をしますか？", "VectorはDigital Twinをどのようにサポートしますか？", "VectorはIoTとMarketplaceでどのように使用されますか？"],
      ar: ["ماذا يفعل Vector في Consultify؟", "كيف يدعم Vector الـ Digital Twin؟", "كيف يُستخدم Vector في IoT وMarketplace؟"],
      es: ["¿Qué hace Vector en Consultify?", "¿Cómo apoya Vector al Digital Twin?", "¿Cómo se usa Vector en IoT y Marketplace?"],
    },
    scope: {
      en: ["Consultify", "Digital Twin", "IoT", "Marketplace", "Ecosystem role"],
      pl: ["Consultify", "Digital Twin", "IoT", "Marketplace", "Rola w ekosystemie"],
      de: ["Consultify", "Digital Twin", "IoT", "Marketplace", "Rolle im Oekosystem"],
      ja: ["Consultify", "Digital Twin", "IoT", "Marketplace", "エコシステムでの役割"],
      ar: ["Consultify", "Digital Twin", "IoT", "Marketplace", "الدور في المنظومة"],
      es: ["Consultify", "Digital Twin", "IoT", "Marketplace", "Rol en el ecosistema"],
    },
    topics: [
      ...globalTopics,
      {
        id: "consultify",
        triggers: [
          "consultify",
          "コンサルティファイ",
          "استشارات",
        ],
        answers: localized(
          "In Consultify, Vector acts as an AI transformation consultant. It helps diagnose organizations, generate roadmaps, structure CAPEX logic, model ROI, and support execution with much higher speed than a traditional consulting workflow.",
          "W Consultify Vector dziala jak AI transformation consultant. Pomaga diagnozowac organizacje, generowac roadmapy, porzadkowac logike CAPEX, modelowac ROI i wspierac egzekucje znacznie szybciej niz tradycyjny workflow konsultingowy.",
          "In Consultify agiert Vector als KI-Transformationsberater. Es unterstuetzt bei der Diagnose von Organisationen, der Erstellung von Roadmaps, der Strukturierung von CAPEX-Logik, der ROI-Modellierung und der Umsetzungsunterstuetzung deutlich schneller als ein traditioneller Beratungsworkflow.",
          "Consultifyでは、VectorはAI変革コンサルタントとして機能します。組織の診断、ロードマップの生成、CAPEXロジックの構造化、ROIモデリング、実行支援を、従来のコンサルティングワークフローよりもはるかに高速に行います。",
          "في Consultify، يعمل Vector كمستشار تحول بالذكاء الاصطناعي. يساعد في تشخيص المؤسسات وإنشاء خرائط الطريق وهيكلة منطق CAPEX ونمذجة ROI ودعم التنفيذ بسرعة أعلى بكثير من سير عمل الاستشارات التقليدي.",
          "En Consultify, Vector actúa como consultor de transformación con IA. Ayuda a diagnosticar organizaciones, generar hojas de ruta, estructurar la lógica de CAPEX, modelar ROI y apoyar la ejecución con una velocidad mucho mayor que un flujo de trabajo de consultoría tradicional."
        ),
      },
      {
        id: "digital-twin",
        triggers: [
          "digital twin",
          "simulation",
          "scenario",
          "デジタルツイン",
          "シミュレーション",
          "توأم رقمي",
          "محاكاة",
          "gemelo digital",
          "simulación",
        ],
        answers: localized(
          "In Digital Twin, Vector interprets simulation outputs and helps teams understand scenarios, layout decisions, bottlenecks, and operational trade-offs before they change the real factory.",
          "W Digital Twin Vector interpretuje wyniki symulacji i pomaga zespolom zrozumiec scenariusze, decyzje layoutowe, bottlenecks i trade-offy operacyjne zanim zmienia realna fabryke.",
          "Im Digital Twin interpretiert Vector Simulationsergebnisse und hilft Teams, Szenarien, Layout-Entscheidungen, Engpaesse und operative Trade-offs zu verstehen, bevor die reale Fabrik veraendert wird.",
          "Digital Twinでは、Vectorはシミュレーション出力を解釈し、チームが実際の工場を変更する前にシナリオ、レイアウトの決定、ボトルネック、オペレーション上のトレードオフを理解するのを支援します。",
          "في Digital Twin، يفسر Vector مخرجات المحاكاة ويساعد الفرق على فهم السيناريوهات وقرارات التخطيط والاختناقات والمقايضات التشغيلية قبل تغيير المصنع الحقيقي.",
          "En Digital Twin, Vector interpreta los resultados de simulación y ayuda a los equipos a comprender escenarios, decisiones de layout, cuellos de botella y trade-offs operativos antes de modificar la fábrica real."
        ),
      },
      {
        id: "iot-marketplace",
        triggers: [
          "iot",
          "marketplace",
          "マーケットプレイス",
          "سوق",
          "mercado",
        ],
        answers: localized(
          "In IoT, Vector interprets operational signals and anomalies in real time. In Marketplace, it helps with automation reasoning, supplier matching, and technology fit. Together, those products show that Vector is not only analytical, but also operationally useful.",
          "W IoT Vector interpretuje sygnaly operacyjne i anomalie w czasie rzeczywistym. W Marketplace pomaga w rozumowaniu automatyzacji, dopasowaniu dostawcow i ocenie technology fit. Razem te produkty pokazuja, ze Vector jest nie tylko analityczny, ale tez operacyjnie uzyteczny.",
          "Im IoT interpretiert Vector operative Signale und Anomalien in Echtzeit. Im Marketplace hilft es bei Automatisierungslogik, Lieferantenauswahl und der Bewertung des Technology Fit. Zusammen zeigen diese Produkte, dass Vector nicht nur analytisch, sondern auch operativ nuetzlich ist.",
          "IoTでは、Vectorはオペレーション信号と異常をリアルタイムで解釈します。Marketplaceでは、自動化推論、サプライヤーマッチング、テクノロジーフィットを支援します。これらの製品を合わせると、Vectorが分析的であるだけでなく、オペレーション上も有用であることがわかります。",
          "في IoT، يفسر Vector الإشارات التشغيلية والشذوذ في الوقت الفعلي. في Marketplace، يساعد في استدلال الأتمتة ومطابقة الموردين وملاءمة التكنولوجيا. معًا، تُظهر هذه المنتجات أن Vector ليس تحليليًا فحسب، بل مفيد تشغيليًا أيضًا.",
          "En IoT, Vector interpreta señales operativas y anomalías en tiempo real. En Marketplace, ayuda con el razonamiento de automatización, la selección de proveedores y la adecuación tecnológica. Juntos, estos productos demuestran que Vector no solo es analítico, sino también operativamente útil."
        ),
      },
    ],
  },
  security: {
    title: localized("Security", "Bezpieczenstwo", "Sicherheit", "セキュリティ", "الأمان", "Seguridad"),
    intro: localized(
      "Hello, I can explain how DBR77 Vector approaches security, governance, deployment isolation, and protection of industrial data.",
      "Dzien dobry, moge wyjasnic jak DBR77 Vector podchodzi do bezpieczenstwa, governance, izolacji wdrozenia i ochrony danych przemyslowych.",
      "Guten Tag, ich kann erklaeren, wie DBR77 Vector Sicherheit, Governance, Deployment-Isolation und den Schutz industrieller Daten umsetzt.",
      "こんにちは。DBR77 Vectorがセキュリティ、ガバナンス、デプロイメントの隔離、産業データの保護にどのようにアプローチしているかをご説明いたします。",
      "مرحبًا، يمكنني شرح كيف يتعامل DBR77 Vector مع الأمان والحوكمة وعزل النشر وحماية البيانات الصناعية.",
      "Buenos días, puedo explicar cómo DBR77 Vector aborda la seguridad, la gobernanza, el aislamiento del despliegue y la protección de datos industriales."
    ),
    suggestions: {
      en: ["Does client data train the model?", "How is deployment isolated?", "Why is Vector safer than public LLMs?"],
      pl: ["Czy dane klienta trenuja model?", "Jak dziala izolacja wdrozenia?", "Dlaczego Vector jest bezpieczniejszy niz publiczne LLM-y?"],
      de: ["Trainieren Kundendaten das Modell?", "Wie funktioniert die Deployment-Isolation?", "Warum ist Vector sicherer als oeffentliche LLMs?"],
      ja: ["クライアントデータはモデルのトレーニングに使用されますか？", "デプロイメントの隔離はどのように機能しますか？", "Vectorが公開LLMより安全な理由は？"],
      ar: ["هل تُدرّب بيانات العملاء النموذج؟", "كيف يتم عزل النشر؟", "لماذا Vector أكثر أمانًا من LLM العامة؟"],
      es: ["¿Los datos del cliente entrenan el modelo?", "¿Cómo se aísla el despliegue?", "¿Por qué Vector es más seguro que los LLM públicos?"],
    },
    scope: {
      en: ["Anonymization", "Deployment isolation", "Governance", "Human approval", "Public LLM comparison"],
      pl: ["Anonimizacja", "Izolacja wdrozenia", "Governance", "Human approval", "Porownanie z publicznymi LLM-ami"],
      de: ["Anonymisierung", "Deployment-Isolation", "Governance", "Human Approval", "Vergleich mit oeffentlichen LLMs"],
      ja: ["匿名化", "デプロイメント隔離", "ガバナンス", "人間による承認", "公開LLMとの比較"],
      ar: ["إخفاء الهوية", "عزل النشر", "الحوكمة", "الموافقة البشرية", "مقارنة مع LLM العامة"],
      es: ["Anonimización", "Aislamiento de despliegue", "Gobernanza", "Aprobación humana", "Comparación con LLM públicos"],
    },
    topics: [
      ...globalTopics,
      {
        id: "public-vs-vector",
        triggers: [
          "public llm",
          "consumer ai",
          "safer",
          "why safer",
          "publiczne llm",
          "konsumenckie ai",
          "bezpieczniejszy",
          "offentliche llm",
          "oeffentliche llm",
          "sicherer",
          "公開LLM",
          "消費者AI",
          "より安全",
          "llm عامة",
          "ذكاء اصطناعي استهلاكي",
          "أكثر أمانًا",
          "llm público",
          "ia de consumo",
          "más seguro",
        ],
        answers: localized(
          "Vector is safer for industrial use because it was designed for enterprise deployment choices, governance, auditability, and human approval. Public LLMs optimize for broad convenience, while Vector is positioned for controlled industrial environments.",
          "Vector jest bezpieczniejszy dla zastosowan przemyslowych, poniewaz zostal zaprojektowany pod enterprise deployment choices, governance, auditability i human approval. Publiczne LLM-y optymalizuja szeroka wygode uzycia, a Vector jest pozycjonowany dla kontrolowanych srodowisk przemyslowych.",
          "Vector ist fuer industrielle Nutzung sicherer, weil es fuer Enterprise-Deployment, Governance, Auditierbarkeit und Human Approval konzipiert wurde. Oeffentliche LLMs optimieren auf breite Bequemlichkeit, waehrend Vector fuer kontrollierte industrielle Umgebungen positioniert ist.",
          "Vectorは、エンタープライズデプロイメントの選択肢、ガバナンス、監査可能性、人間による承認を前提に設計されているため、産業用途においてより安全です。公開LLMは幅広い利便性を最適化していますが、Vectorは制御された産業環境向けに位置付けられています。",
          "Vector أكثر أمانًا للاستخدام الصناعي لأنه صُمم لخيارات النشر المؤسسي والحوكمة وقابلية التدقيق والموافقة البشرية. تُحسّن LLM العامة للراحة الواسعة، بينما Vector موجه للبيئات الصناعية المتحكم بها.",
          "Vector es más seguro para uso industrial porque fue diseñado para opciones de despliegue empresarial, gobernanza, auditabilidad y aprobación humana. Los LLM públicos optimizan para conveniencia amplia, mientras que Vector está posicionado para entornos industriales controlados."
        ),
      },
    ],
  },
};

const outOfScopeAnswer = {
  en: "In this test mode I stay within DBR77 Vector topics only: what the model is, how it was trained, how it can be deployed, where it is used, and how security is handled. If you want, I can continue with one of those areas.",
  pl: "W tym trybie testowym pozostaje tylko w zakresie tematow DBR77 Vector: czym jest model, jak byl trenowany, jak moze byc wdrazany, gdzie jest uzywany i jak obslugiwane jest bezpieczenstwo. Jesli chcesz, moge kontynuowac w jednym z tych obszarow.",
  de: "In diesem Testmodus bleibe ich nur innerhalb der Themen von DBR77 Vector: was das Modell ist, wie es trainiert wurde, wie es bereitgestellt werden kann, wo es eingesetzt wird und wie Sicherheit umgesetzt wird. Wenn Sie moechten, kann ich mit einem dieser Bereiche fortfahren.",
  ja: "このテストモードでは、DBR77 Vectorのトピックのみに限定しております。モデルとは何か、どのようにトレーニングされたか、どのようにデプロイできるか、どこで使用されているか、セキュリティはどのように処理されているかです。よろしければ、これらの分野のいずれかで続けることができます。",
  ar: "في وضع الاختبار هذا، أبقى ضمن مواضيع DBR77 Vector فقط: ما هو النموذج، وكيف تم تدريبه، وكيف يمكن نشره، وأين يُستخدم، وكيف يتم التعامل مع الأمان. إذا أردت، يمكنني المتابعة في أحد هذه المجالات.",
  es: "En este modo de prueba me mantengo únicamente dentro de los temas de DBR77 Vector: qué es el modelo, cómo fue entrenado, cómo puede desplegarse, dónde se utiliza y cómo se gestiona la seguridad. Si lo desea, puedo continuar con una de esas áreas.",
} satisfies Record<Locale, string>;

const fallbackAnswer = {
  en: "I am not fully confident which Vector topic you mean. I can best help with the model overview, training basis, deployment options, product integrations, and security. Try one of the suggested follow-up questions.",
  pl: "Nie mam pelnej pewnosci, ktory temat zwiazany z Vector masz na mysli. Najlepiej pomagam w obszarze opisu modelu, bazy treningowej, opcji wdrozenia, integracji produktowych i bezpieczenstwa. Sprobuj jednego z proponowanych pytan uzupelniajacych.",
  de: "Ich bin nicht ganz sicher, welches Vector-Thema Sie meinen. Am besten helfe ich beim Modellueberblick, bei der Trainingsbasis, bei Deployment-Optionen, bei Produktintegrationen und bei Sicherheit. Versuchen Sie eine der vorgeschlagenen Anschlussfragen.",
  ja: "どのVectorのトピックをお尋ねか、完全には把握できておりません。モデル概要、トレーニングベース、デプロイメントオプション、製品統合、セキュリティについて最もお力になれます。おすすめの質問をお試しください。",
  ar: "لست متأكدًا تمامًا من موضوع Vector الذي تقصده. يمكنني المساعدة بشكل أفضل في نظرة عامة على النموذج وأساس التدريب وخيارات النشر وتكاملات المنتجات والأمان. جرّب أحد الأسئلة المقترحة.",
  es: "No estoy completamente seguro de a qué tema de Vector se refiere. Puedo ayudar mejor con la descripción del modelo, la base de entrenamiento, las opciones de despliegue, las integraciones de productos y la seguridad. Pruebe una de las preguntas de seguimiento sugeridas.",
} satisfies Record<Locale, string>;

export function getVoicePageId(pathname: string): VoicePageId {
  switch (pathname) {
    case "/training":
      return "training";
    case "/deployment":
      return "deployment";
    case "/products":
      return "products";
    case "/security-vector":
      return "security";
    default:
      return "overview";
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTopic(question: string, topic: VoiceTopic) {
  return topic.triggers.reduce((score, trigger) => {
    const normalizedTrigger = normalize(trigger);
    if (!normalizedTrigger) return score;
    if (question.includes(normalizedTrigger)) {
      return score + Math.max(2, normalizedTrigger.split(" ").length * 2);
    }
    return score;
  }, 0);
}

function isFollowUp(question: string) {
  return followUpPatterns.some((pattern) => question.includes(normalize(pattern)));
}

function isOutOfScope(question: string) {
  return outOfScopePatterns.some((pattern) => question.includes(normalize(pattern)));
}

export function getVoiceGreeting(locale: Locale, pageId: VoicePageId) {
  return voicePages[pageId].intro[locale];
}

export function getVoiceSuggestions(locale: Locale, pageId: VoicePageId) {
  return voicePages[pageId].suggestions[locale];
}

export function getVoiceScope(locale: Locale, pageId: VoicePageId) {
  return voicePages[pageId].scope[locale];
}

export function getVoicePageTitle(locale: Locale, pageId: VoicePageId) {
  return voicePages[pageId].title[locale];
}

export function getVoiceResponse(
  question: string,
  locale: Locale,
  pageId: VoicePageId,
  recentTopicIds: string[] = []
): VoiceResponse {
  const normalizedQuestion = normalize(question);
  const page = voicePages[pageId];
  const lastTopicId = recentTopicIds[recentTopicIds.length - 1];
  const topics = page.topics;

  if (isOutOfScope(normalizedQuestion)) {
    return {
      answer: outOfScopeAnswer[locale],
      topicId: "out-of-scope",
      suggestions: page.suggestions[locale],
      confidence: "high",
    };
  }

  const scoredTopics = topics
    .map((topic) => ({ topic, score: scoreTopic(normalizedQuestion, topic) }))
    .sort((a, b) => b.score - a.score);

  const best = scoredTopics[0];
  const followUp = isFollowUp(normalizedQuestion);

  if (best && best.score > 0) {
    const answer =
      followUp && best.topic.details
        ? best.topic.details[locale]
        : best.topic.answers[locale];

    return {
      answer,
      topicId: best.topic.id,
      suggestions: best.topic.nextSuggestions?.[locale] ?? page.suggestions[locale],
      confidence: best.score >= 4 ? "high" : "medium",
    };
  }

  if (followUp && lastTopicId) {
    const previousTopic = topics.find((topic) => topic.id === lastTopicId);
    if (previousTopic) {
      return {
        answer: previousTopic.details?.[locale] ?? previousTopic.answers[locale],
        topicId: previousTopic.id,
        suggestions: previousTopic.nextSuggestions?.[locale] ?? page.suggestions[locale],
        confidence: "medium",
      };
    }
  }

  return {
    answer: fallbackAnswer[locale],
    topicId: "unclear",
    suggestions: page.suggestions[locale],
    confidence: "low",
  };
}
