import type { FAQItem } from './faqContent';
import type { ViewHelpMapping } from './viewToModuleMapping';

export type SupportedHelpLanguage = 'en' | 'pl' | 'de' | 'ar' | 'ja' | 'es';

export interface LocalizedText {
  en: string;
  pl: string;
  de?: string;
  ar?: string;
  ja?: string;
  es?: string;
}

export type HelpExperienceKind = 'journey' | 'support' | 'system';

export type HelpJourneyStageId =
  | 'interview'
  | 'tools_assessments'
  | 'initiatives'
  | 'execution'
  | 'results';

export type HelpSupportModuleId = 'my_work' | 'ideas' | 'finance' | 'presentations';

export interface HelpAskAiAction {
  label: LocalizedText;
  prompt: LocalizedText;
}

export interface HelpVideoSlot {
  label: LocalizedText;
  durationLabel: LocalizedText;
}

export interface HelpQuickGuide {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  articleSlug?: string;
  targetModuleId?: string;
}

export interface HelpDocument {
  id: string;
  moduleId: string;
  kind: HelpExperienceKind;
  icon: string;
  title: LocalizedText;
  shortLabel: LocalizedText;
  summary: LocalizedText;
  whatThisIs: LocalizedText;
  whyItMatters: LocalizedText;
  whatYouDoHere: LocalizedText[];
  howAiHelpsHere: LocalizedText[];
  whatComesNext: LocalizedText;
  askAiNow: HelpAskAiAction;
  quickGuides: HelpQuickGuide[];
  faqs: FAQItem[];
  nextStepId?: string;
  stageId?: HelpJourneyStageId;
  supportModuleId?: HelpSupportModuleId;
  relatedKnowledgeModuleId?: string;
  video?: HelpVideoSlot;
}

export interface HelpMaintenancePack {
  id:
    | 'journey-pack'
    | 'support-module-pack'
    | 'faq-refresh-pack'
    | 'video-pack'
    | 'ai-prompt-pack'
    | 'new-module-pack';
  title: LocalizedText;
  description: LocalizedText;
  includes: string[];
}

interface HelpOverviewCard {
  id: string;
  icon: string;
  title: LocalizedText;
  description: LocalizedText;
}

const text = (en: string, pl: string): LocalizedText => ({ en, pl });

const faq = (
  id: string,
  moduleId: string,
  question: LocalizedText,
  answer: LocalizedText,
  tags: string[]
): FAQItem => ({
  id,
  moduleId,
  question: question.en,
  questionPl: question.pl,
  answer: answer.en,
  answerPl: answer.pl,
  tags,
});

const makeGuide = (
  id: string,
  titleValue: LocalizedText,
  descriptionValue: LocalizedText,
  options: Pick<HelpQuickGuide, 'articleSlug' | 'targetModuleId'> = {}
): HelpQuickGuide => ({
  id,
  title: titleValue,
  description: descriptionValue,
  ...options,
});

interface SystemDocInput {
  id: string;
  moduleId: string;
  icon: string;
  title: LocalizedText;
  shortLabel?: LocalizedText;
  summary: LocalizedText;
  whatThisIs: LocalizedText;
  whyItMatters: LocalizedText;
  whatYouDoHere: LocalizedText[];
  howAiHelpsHere: LocalizedText[];
  whatComesNext: LocalizedText;
  askAiNow: HelpAskAiAction;
  quickGuides?: HelpQuickGuide[];
  faqs?: FAQItem[];
  relatedKnowledgeModuleId?: string;
  nextStepId?: string;
}

const createSystemDoc = (input: SystemDocInput): HelpDocument => ({
  kind: 'system',
  shortLabel: input.shortLabel ?? text('Super Admin', 'Super Admin'),
  quickGuides: input.quickGuides ?? [],
  faqs: input.faqs ?? [],
  video: HELP_SYSTEM_OVERVIEW.video,
  ...input,
});

const createSuperAdminFAQs = (
  id: string,
  moduleId: string,
  titleValue: LocalizedText
): FAQItem[] => [
  faq(
    `${id}-safe-change`,
    moduleId,
    text(
      `How should I manage ${titleValue.en} safely?`,
      `Jak bezpiecznie zarządzać ekranem ${titleValue.pl}?`
    ),
    text(
      'Review the current state first, change one thing at a time, and verify the operational impact before moving to the next adjustment.',
      'Najpierw sprawdź stan obecny, zmieniaj jedną rzecz naraz i potwierdź wpływ operacyjny zanim przejdziesz dalej.'
    ),
    ['superadmin', 'operations']
  ),
  faq(
    `${id}-ai`,
    moduleId,
    text(
      `How should AI help on ${titleValue.en}?`,
      `Jak AI powinno pomagać na ekranie ${titleValue.pl}?`
    ),
    text(
      'Use AI to summarize data, highlight anomalies, and draft next actions. Keep approval and risky production changes in human hands.',
      'Używaj AI do podsumowań, wskazywania anomalii i szkicowania kolejnych działań. Akceptację i ryzykowne zmiany produkcyjne zostawiaj po stronie człowieka.'
    ),
    ['superadmin', 'ai']
  ),
];

export const HELP_SYSTEM_OVERVIEW = {
  title: text('Consultify work map', 'Mapa pracy w Consultify'),
  summary: text(
    'Help explains the work. AI helps you do the work in the exact place where you are.',
    'Help wyjaśnia pracę. AI pomaga ją wykonać dokładnie tam, gdzie jesteś.'
  ),
  intro: text(
    'Consultify guides users through a consulting journey from understanding the current state to measuring business results.',
    'Consultify prowadzi użytkownika przez podróż konsultingową od zrozumienia stanu obecnego do pomiaru efektów biznesowych.'
  ),
  journeyCards: [
    {
      id: 'interview',
      icon: 'MessagesSquare',
      title: text('Interview', 'Interview'),
      description: text(
        'Gather facts, context, and evidence about how the organization works today.',
        'Zbieraj fakty, kontekst i dowody o tym, jak organizacja działa dzisiaj.'
      ),
    },
    {
      id: 'tools_assessments',
      icon: 'ClipboardList',
      title: text('Tools + Assessments', 'Tools + Assessments'),
      description: text(
        'Use frameworks and tools to define how the future state should look.',
        'Używaj frameworków i narzędzi, aby określić, jak ma wyglądać stan docelowy.'
      ),
    },
    {
      id: 'initiatives',
      icon: 'Flag',
      title: text('Initiatives', 'Initiatives'),
      description: text(
        'Turn diagnosis into a concrete path of change and prioritized initiatives.',
        'Zamieniaj diagnozę w konkretną drogę zmiany i priorytetowe inicjatywy.'
      ),
    },
    {
      id: 'execution',
      icon: 'PlayCircle',
      title: text('Execution', 'Execution'),
      description: text(
        'Move from planning to delivery, ownership, and operational follow-through.',
        'Przechodź z planowania do realizacji, odpowiedzialności i codziennego dowożenia zmian.'
      ),
    },
    {
      id: 'results',
      icon: 'BarChart3',
      title: text('Results', 'Results'),
      description: text(
        'Check whether the transformation produced the expected business impact.',
        'Sprawdzaj, czy transformacja przyniosła oczekiwany efekt biznesowy.'
      ),
    },
  ] satisfies HelpOverviewCard[],
  supportCards: [
    {
      id: 'my_work',
      icon: 'ListTodo',
      title: text('My Work', 'My Work'),
      description: text(
        'Run tasks and decisions that fall out of every initiative.',
        'Prowadź zadania i decyzje wynikające z każdej inicjatywy.'
      ),
    },
    {
      id: 'ideas',
      icon: 'Lightbulb',
      title: text('Ideas / Workplace / Notes', 'Ideas / Workplace / Notes'),
      description: text(
        'Capture raw observations, workshop output, and emerging ideas.',
        'Zbieraj surowe obserwacje, wyniki warsztatów i nowe pomysły.'
      ),
    },
    {
      id: 'finance',
      icon: 'Wallet',
      title: text('Finance', 'Finance'),
      description: text(
        'Validate value, ROI, and financial trade-offs behind the change.',
        'Waliduj wartość, ROI i finansowe kompromisy stojące za zmianą.'
      ),
    },
    {
      id: 'presentations',
      icon: 'Presentation',
      title: text('Reports / Presentations', 'Reports / Presentations'),
      description: text(
        'Turn work into decisions, updates, and stakeholder communication.',
        'Zamieniaj pracę w decyzje, statusy i komunikację do interesariuszy.'
      ),
    },
  ] satisfies HelpOverviewCard[],
  video: {
    label: text('Watch 45 sec intro', 'Zobacz intro 45 s'),
    durationLabel: text('slot ready for micro-video', 'miejsce gotowe pod micro-video'),
  },
};

const SHARED_GUIDES = {
  overview: makeGuide(
    'system-overview',
    text('How the journey works', 'Jak działa podróż'),
    text(
      'See how Interview, Tools, Initiatives, Execution, and Results connect.',
      'Zobacz, jak łączą się Interview, Tools, Initiatives, Execution i Results.'
    )
  ),
  askAi: makeGuide(
    'ask-ai',
    text('Ask AI from this panel', 'Zapytaj AI z tego panelu'),
    text(
      'Open the main AI chat with the current screen and a ready-to-send prompt.',
      'Otwórz główny chat AI z bieżącym ekranem i gotowym promptem.'
    )
  ),
  kb: makeGuide(
    'kb',
    text('Open long-form knowledge', 'Otwórz dłuższą wiedzę'),
    text(
      'Use Knowledge Base for deeper articles, examples, and references.',
      'Użyj Knowledge Base do dłuższych artykułów, przykładów i odniesień.'
    )
  ),
};

export const HELP_DOCUMENTS: Record<string, HelpDocument> = {
  interview: {
    id: 'interview',
    moduleId: 'interview',
    kind: 'journey',
    icon: 'MessagesSquare',
    title: text('Interview', 'Interview'),
    shortLabel: text('How it is', 'How it is'),
    summary: text(
      'This step gathers facts about the organization, its constraints, and the reality of work today.',
      'Ten etap zbiera fakty o organizacji, jej ograniczeniach i o tym, jak wygląda praca dzisiaj.'
    ),
    whatThisIs: text(
      'Interview is the discovery stage where you collect context, inputs, and evidence.',
      'Interview to etap discovery, w którym zbierasz kontekst, dane wejściowe i dowody.'
    ),
    whyItMatters: text(
      'A weak diagnosis creates weak recommendations. This step anchors everything that follows.',
      'Słaba diagnoza tworzy słabe rekomendacje. Ten etap ustawia jakość wszystkiego, co przyjdzie później.'
    ),
    whatYouDoHere: [
      text(
        'As an assignee: work from Inbox, complete the interview template, and submit answers for review.',
        'Jako wykonawca: pracujesz z Inbox, uzupełniasz szablon wywiadu i wysyłasz odpowiedzi do review.'
      ),
      text(
        'As a manager: use Sessions as your main cockpit to track in-progress, submitted, sent-back, and approved interview work.',
        'Jako manager: używasz Sessions jako głównego cockpit view do śledzenia wywiadów w statusach in progress, submitted, sent back i approved.'
      ),
      text(
        'Capture process, data, capability, and constraint signals, then turn raw input into a shared starting point for the client team.',
        'Zbierasz sygnały o procesach, danych, kompetencjach i ograniczeniach, a potem zamieniasz surowe wejście we wspólny punkt startowy dla zespołu klienta.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarize interview notes into clear themes.',
        'Podsumowuje notatki z wywiadów w jasne tematy.'
      ),
      text(
        'Spot missing context, contradictions, and follow-up questions.',
        'Wychwytuje braki, sprzeczności i pytania uzupełniające.'
      ),
      text(
        'Prepare a structured brief for the next assessment step.',
        'Przygotowuje uporządkowany brief do kolejnego etapu oceny.'
      ),
    ],
    whatComesNext: text(
      'Next you move into tools and assessments to define how the target state should look.',
      'Potem przechodzisz do tools i assessments, aby określić, jak ma wyglądać stan docelowy.'
    ),
    askAiNow: {
      label: text('Ask AI to structure this discovery', 'Zapytaj AI, aby uporządkować discovery'),
      prompt: text(
        'You are helping me in the Interview stage. Summarize the current-state context from this workspace, list missing information, and propose the best next questions.',
        'Pomagasz mi w etapie Interview. Podsumuj kontekst stanu obecnego z tego workspace, wskaż brakujące informacje i zaproponuj najlepsze kolejne pytania.'
      ),
    },
    quickGuides: [
      SHARED_GUIDES.askAi,
      makeGuide(
        'interview-output',
        text('What a good interview output looks like', 'Jak wygląda dobry output z interview'),
        text(
          'Focus on facts, constraints, and reusable context for the next step.',
          'Skup się na faktach, ograniczeniach i kontekście do wykorzystania dalej.'
        )
      ),
      makeGuide(
        'interview-manager-cockpit',
        text('How managers should work in Sessions', 'Jak manager pracuje w Sessions'),
        text(
          'Use Sessions as the primary review cockpit, and use Assigned only for assignment administration.',
          'Używaj Sessions jako głównego cockpit view do review, a Assigned tylko do administracji przypisaniami.'
        )
      ),
      makeGuide(
        'interview-to-insight-flow',
        text('From interview to insight', 'Od wywiadu do wniosku'),
        text(
          'The flow is questions → assignment → insights → initiatives: collect answers, then synthesize them into Insight (Wniosek) cards that feed initiatives.',
          'Przepływ to pytania → przypisanie → insighty → inicjatywy: zbierasz odpowiedzi, a potem syntetyzujesz je w karty Wniosku, które zasilają inicjatywy.'
        )
      ),
      makeGuide(
        'insight-card-anatomy',
        text('Anatomy of an Insight (Wniosek) card', 'Anatomia karty Wniosku'),
        text(
          'A graded insight is answer-first and evidence-grounded: title, executive summary, ≥3 themes, ≥2 issues, an evidence map (lineage), missing data, and material quality — with an Observation → Mechanism → Evidence → Impact → Divergence → Recommendation write-up.',
          'Oceniona karta Wniosku jest answer-first i ugruntowana w dowodach: tytuł, podsumowanie, ≥3 motywy, ≥2 problemy, mapa dowodów (lineage), braki danych i jakość materiału — z opisem Obserwacja → Mechanizm → Dowody → Wpływ → Rozjazdy → Rekomendacja.'
        )
      ),
      SHARED_GUIDES.kb,
    ],
    faqs: [
      faq(
        'journey-interview-1',
        'interview',
        text('When is the interview stage done?', 'Kiedy etap interview jest zakończony?'),
        text(
          'It is done when you have enough evidence to explain the current state, its main blockers, and what still needs verification.',
          'Jest zakończony, gdy masz dość dowodów, aby wyjaśnić stan obecny, główne blokery i to, co jeszcze wymaga potwierdzenia.'
        ),
        ['interview', 'discovery']
      ),
      faq(
        'journey-interview-2',
        'interview',
        text('Should AI replace the interview?', 'Czy AI ma zastąpić interview?'),
        text(
          'No. AI accelerates synthesis and helps prepare better questions, but the source input still comes from people, evidence, and observed work.',
          'Nie. AI przyspiesza syntezę i pomaga przygotować lepsze pytania, ale źródłem danych nadal są ludzie, dowody i obserwowana praca.'
        ),
        ['interview', 'ai']
      ),
      faq(
        'journey-interview-insight-1',
        'interview',
        text(
          'How is an insight from interviews documented?',
          'Jak dokumentuje się wniosek z wywiadów?'
        ),
        text(
          'Each Insight (Wniosek) card follows one standard: a conclusion-first summary, themes and issues, and an evidence map that links every claim back to its source (a session, document, or data point). Unsupported claims are marked as hypotheses with a confidence level.',
          'Każda karta Wniosku trzyma jeden standard: podsumowanie zaczynające się od konkluzji, motywy i problemy oraz mapę dowodów, która wiąże każdą tezę z jej źródłem (sesją, dokumentem lub danymi). Tezy bez dowodu są oznaczone jako hipotezy z poziomem pewności.'
        ),
        ['interview', 'insight', 'wniosek', 'documentation']
      ),
      faq(
        'journey-interview-insight-2',
        'interview',
        text('What makes a good insight card?', 'Co czyni kartę Wniosku dobrą?'),
        text(
          'It is answer-first (the first sentence carries the conclusion), grounded in evidence, concrete (numbers, roles, processes instead of generalities), honest about uncertainty and disagreements, and MECE — no overlaps and no gaps. Empty optional fields must carry a one-line reason.',
          'Jest answer-first (pierwsze zdanie niesie konkluzję), ugruntowana w dowodach, konkretna (liczby, role, procesy zamiast ogólników), uczciwa wobec niepewności i rozjazdów oraz MECE — bez nakładania i luk. Puste pola opcjonalne muszą nosić jednozdaniowe uzasadnienie.'
        ),
        ['interview', 'insight', 'wniosek', 'quality']
      ),
    ],
    nextStepId: 'tools_assessments',
    stageId: 'interview',
    relatedKnowledgeModuleId: 'assessment',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  tools_assessments: {
    id: 'tools_assessments',
    moduleId: 'assessment',
    kind: 'journey',
    icon: 'ClipboardList',
    title: text('Tools + Assessments', 'Tools + Assessments'),
    shortLabel: text('How it should be', 'How it should be'),
    summary: text(
      'This step uses consulting tools and assessment frameworks to shape the target future state.',
      'Ten etap wykorzystuje narzędzia consultingowe i frameworki assessmentowe do zbudowania stanu docelowego.'
    ),
    whatThisIs: text(
      'This is the diagnosis and target-state design layer of the journey.',
      'To warstwa diagnozy i projektowania stanu docelowego w całej podróży.'
    ),
    whyItMatters: text(
      'Without a shared target state, initiatives become disconnected activities instead of a coherent transformation.',
      'Bez wspólnego obrazu stanu docelowego inicjatywy stają się luźnymi aktywnościami zamiast spójnej transformacji.'
    ),
    whatYouDoHere: [
      text(
        'Run assessments and use discovery tools with the client team.',
        'Prowadzisz assessmenty i pracujesz z discovery tools razem z klientem.'
      ),
      text(
        'Translate evidence into maturity gaps, priorities, and target capabilities.',
        'Przekładasz dowody na luki dojrzałości, priorytety i zdolności docelowe.'
      ),
      text(
        'Build a practical picture of what better should look like.',
        'Budujesz praktyczny obraz tego, jak powinno wyglądać lepiej.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Suggest scores, patterns, and cross-area gaps from uploaded evidence.',
        'Sugeruje oceny, wzorce i luki między obszarami na podstawie dowodów.'
      ),
      text(
        'Compare findings and translate them into future-state language.',
        'Porównuje wnioski i przekłada je na język stanu docelowego.'
      ),
      text(
        'Generate structured recommendations ready for initiatives.',
        'Generuje uporządkowane rekomendacje gotowe do przełożenia na inicjatywy.'
      ),
    ],
    whatComesNext: text(
      'Next you decide which initiatives will close the most important gaps and create the path of change.',
      'Potem decydujesz, które inicjatywy domkną najważniejsze luki i zbudują drogę zmiany.'
    ),
    askAiNow: {
      label: text('Ask AI to shape the target state', 'Zapytaj AI, aby zbudować stan docelowy'),
      prompt: text(
        'You are helping me in the Tools and Assessments stage. Review the current findings, define the target state, and recommend the most important capability gaps to address next.',
        'Pomagasz mi w etapie Tools i Assessments. Przejrzyj aktualne wnioski, zdefiniuj stan docelowy i wskaż najważniejsze luki kompetencyjne do zaadresowania dalej.'
      ),
    },
    quickGuides: [
      makeGuide(
        'choose-framework',
        text('Choose the right framework', 'Wybierz właściwy framework'),
        text(
          'Match the tool to the client context and the decision you need to support.',
          'Dobierz narzędzie do kontekstu klienta i decyzji, którą chcesz wesprzeć.'
        )
      ),
      makeGuide(
        'future-state',
        text('Turn findings into future state', 'Zamień wnioski w stan docelowy'),
        text(
          'Use the same evidence to define both gaps and the desired direction.',
          'Użyj tych samych dowodów, aby zdefiniować zarówno luki, jak i pożądany kierunek.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'journey-tools-1',
        'assessment',
        text('What is the output of this step?', 'Jaki jest output tego etapu?'),
        text(
          'A prioritized view of the current state, the desired future state, and the biggest gaps between them.',
          'Priorytetyzowany obraz stanu obecnego, stanu docelowego i największych luk między nimi.'
        ),
        ['assessment', 'output']
      ),
      faq(
        'journey-tools-2',
        'assessment',
        text('Should I use one tool or several?', 'Czy używać jednego narzędzia czy kilku?'),
        text(
          'Use the smallest set that helps the client make a decision. More tools only help when they add a new angle, not repeated noise.',
          'Użyj najmniejszego zestawu, który pomaga klientowi podjąć decyzję. Więcej narzędzi pomaga tylko wtedy, gdy dodaje nową perspektywę, a nie powiela szum.'
        ),
        ['assessment', 'tools']
      ),
    ],
    nextStepId: 'initiatives',
    stageId: 'tools_assessments',
    relatedKnowledgeModuleId: 'assessment',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  initiatives: {
    id: 'initiatives',
    moduleId: 'initiatives',
    kind: 'journey',
    icon: 'Flag',
    title: text('Initiatives', 'Initiatives'),
    shortLabel: text('Path of change', 'Droga zmiany'),
    summary: text(
      'This step turns diagnosis into a practical portfolio of initiatives that moves the organization forward.',
      'Ten etap zamienia diagnozę w praktyczne portfolio inicjatyw, które przesuwa organizację do przodu.'
    ),
    whatThisIs: text(
      'Initiatives define what must be done, in what order, and why it matters.',
      'Initiatives określają, co trzeba zrobić, w jakiej kolejności i dlaczego to ma znaczenie.'
    ),
    whyItMatters: text(
      'This is where strategy becomes a roadmap of real change instead of a slide deck.',
      'To miejsce, w którym strategia staje się mapą realnej zmiany zamiast slajdami.'
    ),
    whatYouDoHere: [
      text(
        'Prioritize initiatives and clarify the value each one should unlock.',
        'Priorytetyzujesz inicjatywy i doprecyzowujesz wartość, którą każda ma odblokować.'
      ),
      text(
        'Define scope, owners, dependencies, and expected outcomes.',
        'Definiujesz zakres, właścicieli, zależności i oczekiwane wyniki.'
      ),
      text(
        'Build a path from current gaps to the target future state.',
        'Budujesz drogę od obecnych luk do stanu docelowego.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Cluster findings into candidate initiatives.',
        'Grupuje wnioski w kandydatów na inicjatywy.'
      ),
      text(
        'Suggest priority logic, dependencies, and sequencing risks.',
        'Sugeruje logikę priorytetów, zależności i ryzyka sekwencji.'
      ),
      text(
        'Draft concise initiative briefs and expected outcomes.',
        'Tworzy zwięzłe briefy inicjatyw i oczekiwane wyniki.'
      ),
    ],
    whatComesNext: text(
      'Next you move into execution and turn initiative plans into delivered work, tasks, and ownership.',
      'Następnie przechodzisz do execution i zamieniasz plan inicjatyw w realną pracę, taski i odpowiedzialności.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to frame the initiative portfolio',
        'Zapytaj AI, aby ułożyć portfolio inicjatyw'
      ),
      prompt: text(
        'You are helping me in the Initiatives stage. Propose the strongest initiative portfolio from the current findings, explain priorities, and identify dependencies or sequencing risks.',
        'Pomagasz mi w etapie Initiatives. Zaproponuj najmocniejsze portfolio inicjatyw na podstawie aktualnych wniosków, wyjaśnij priorytety i wskaż zależności lub ryzyka sekwencji.'
      ),
    },
    quickGuides: [
      makeGuide(
        'initiative-brief',
        text('Write a strong initiative brief', 'Napisz mocny brief inicjatywy'),
        text(
          'Keep the problem, value, and ownership visible from the start.',
          'Od początku trzymaj widoczne problem, wartość i odpowiedzialność.'
        )
      ),
      makeGuide(
        'portfolio-priority',
        text('Prioritize the portfolio', 'Ustal priorytet portfolio'),
        text(
          'Sequence work by impact, feasibility, and dependencies.',
          'Układaj prace według wpływu, wykonalności i zależności.'
        )
      ),
      makeGuide(
        'initiative-charter-anatomy',
        text('Charter-lite vs full charter', 'Charter-lite vs pełny charter'),
        text(
          'An initiative starts as a charter-lite: a falsifiable thesis ("if X then Y because Z"), one owner, impact × effort, at least one KPI (baseline → target), and a source link. The full charter (scope, RACI, RAID, milestones, finance…) is filled in progressively as it passes gates — not in the wizard.',
          'Inicjatywa startuje jako charter-lite: falsyfikowalna teza („jeśli X to Y bo Z"), jeden owner, impact × effort, co najmniej jeden KPI (baseline → target) i powiązanie ze źródłem. Pełny charter (zakres, RACI, RAID, kamienie milowe, finanse…) uzupełniasz progresywnie w miarę przechodzenia bramek — nie w kreatorze.'
        )
      ),
      makeGuide(
        'initiative-lineage-gates',
        text('Lineage and gates', 'Lineage i bramki'),
        text(
          'Every initiative carries a lineage (source type + source id) so it is never an orphan, and moves through one funnel of gates: DRAFT → review → approved → executing → done → tracking → archived. A consultant can only submit for review; promotion is a deliberate gate.',
          'Każda inicjatywa nosi lineage (typ + id źródła), więc nigdy nie jest sierotą, i przechodzi jednym lejkiem bramek: DRAFT → review → approved → executing → done → tracking → archived. Konsultant może tylko zgłosić do review; promocja to świadoma bramka.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'journey-initiatives-1',
        'initiatives',
        text('How many initiatives should I create?', 'Ile inicjatyw powinienem utworzyć?'),
        text(
          'Create only as many as the organization can realistically own. The right number is the smallest set that can move the key gaps.',
          'Twórz tylko tyle inicjatyw, ile organizacja jest w stanie realnie udźwignąć. Dobra liczba to najmniejszy zestaw, który przesuwa kluczowe luki.'
        ),
        ['initiatives', 'portfolio']
      ),
      faq(
        'journey-initiatives-2',
        'initiatives',
        text(
          'When is an initiative ready for execution?',
          'Kiedy inicjatywa jest gotowa do execution?'
        ),
        text(
          'When its owner, scope, expected outcome, and key dependencies are clear enough to hand off into active work.',
          'Gdy jej właściciel, zakres, oczekiwany wynik i kluczowe zależności są na tyle jasne, że można przekazać ją do aktywnej realizacji.'
        ),
        ['initiatives', 'execution']
      ),
      faq(
        'journey-initiatives-doc-1',
        'initiatives',
        text('What must an initiative card contain?', 'Co musi zawierać karta inicjatywy?'),
        text(
          'At minimum (to exist as a draft): a falsifiable thesis, one owner, impact × effort, at least one KPI with baseline → target, and a source link. The full charter adds problem statement, business case, scope in/out, deliverables, success criteria, kill criteria, milestones, RAID, and RACI — completed progressively.',
          'Minimum (żeby istnieć jako draft): falsyfikowalna teza, jeden owner, impact × effort, co najmniej jeden KPI z baseline → target i powiązanie ze źródłem. Pełny charter dokłada opis problemu, business case, zakres in/out, rezultaty, kryteria sukcesu, kryteria zatrzymania, kamienie milowe, RAID i RACI — uzupełniane progresywnie.'
        ),
        ['initiatives', 'charter', 'documentation']
      ),
      faq(
        'journey-initiatives-doc-2',
        'initiatives',
        text('Where do initiatives come from (lineage)?', 'Skąd biorą się inicjatywy (lineage)?'),
        text(
          'From a traced source: an interview insight, a tool/assessment gap, a financial analysis, an idea, a note, or the AI canvas — each pre-fills the same wizard. Lineage (source type + id) is mandatory, or the initiative is explicitly marked manual with a reason. Generating a portfolio is a reconciliation with the live grid, so "zero new initiatives" is not a failure.',
          'Z udokumentowanego źródła: wniosku z wywiadu, luki z tool/assessment, analizy finansowej, idei, notatki lub kanwy AI — każde pre-filluje ten sam kreator. Lineage (typ + id źródła) jest obowiązkowy, albo inicjatywa jest jawnie oznaczona jako manual z uzasadnieniem. Generacja portfela to rekoncyliacja z żywą siatką, więc „zero nowych inicjatyw" to nie porażka.'
        ),
        ['initiatives', 'lineage', 'source']
      ),
    ],
    nextStepId: 'execution',
    stageId: 'initiatives',
    relatedKnowledgeModuleId: 'initiatives',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  execution: {
    id: 'execution',
    moduleId: 'execution',
    kind: 'journey',
    icon: 'PlayCircle',
    title: text('Execution', 'Execution'),
    shortLabel: text('Make the change real', 'Zrealizuj zmianę'),
    summary: text(
      'This step is about delivery, not planning. Work moves through owners, tasks, and real-world constraints.',
      'Ten etap dotyczy dowożenia, a nie planowania. Praca przechodzi przez właścicieli, taski i realne ograniczenia.'
    ),
    whatThisIs: text(
      'Execution is the operational path where initiatives become actual change.',
      'Execution to operacyjna ścieżka, na której inicjatywy stają się realną zmianą.'
    ),
    whyItMatters: text(
      'A good initiative only matters if the organization can carry it through to completion and adoption.',
      'Dobra inicjatywa ma znaczenie tylko wtedy, gdy organizacja potrafi dowieźć ją do końca i wdrożenia.'
    ),
    whatYouDoHere: [
      text(
        'Break initiatives into accountable work and milestones.',
        'Rozbijasz inicjatywy na pracę z odpowiedzialnością i kamienie milowe.'
      ),
      text(
        'Track blockers, decisions, and execution risk in real time.',
        'Śledzisz blokery, decyzje i ryzyko realizacji w czasie rzeczywistym.'
      ),
      text(
        'Keep momentum between the plan and the actual work.',
        'Utrzymujesz ciągłość między planem a realnym dowożeniem pracy.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Turn initiative scope into actionable task bundles.',
        'Zamienia zakres inicjatywy w konkretne pakiety zadań.'
      ),
      text(
        'Highlight blockers, drift, and hidden execution risk.',
        'Wskazuje blokery, dryf i ukryte ryzyka realizacji.'
      ),
      text(
        'Prepare status summaries for owners and stakeholders.',
        'Przygotowuje podsumowania statusu dla właścicieli i interesariuszy.'
      ),
    ],
    whatComesNext: text(
      'Once work has landed, you move into results to validate whether the transformation actually delivered value.',
      'Gdy praca zostanie dowieziona, przechodzisz do results, aby sprawdzić, czy transformacja rzeczywiście dostarczyła wartość.'
    ),
    askAiNow: {
      label: text('Ask AI to unblock execution', 'Zapytaj AI, aby odblokować execution'),
      prompt: text(
        'You are helping me in the Execution stage. Review the current work context, surface the main blockers and risks, and suggest the most effective next actions for delivery.',
        'Pomagasz mi w etapie Execution. Przejrzyj bieżący kontekst pracy, wskaż główne blokery i ryzyka oraz zaproponuj najskuteczniejsze kolejne działania dowozowe.'
      ),
    },
    quickGuides: [
      makeGuide(
        'from-plan-to-work',
        text('Turn a plan into active work', 'Zamień plan w aktywną pracę'),
        text(
          'Use owners, milestones, and decisions to keep work moving.',
          'Używaj właścicieli, kamieni milowych i decyzji, aby utrzymać ruch pracy.'
        )
      ),
      makeGuide(
        'execution-check',
        text('Run a weekly execution check', 'Zrób tygodniowy przegląd execution'),
        text(
          'Focus on blockers, slippage, and decisions needed now.',
          'Skup się na blokerach, poślizgach i decyzjach potrzebnych teraz.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'journey-execution-1',
        'execution',
        text(
          'What belongs in Execution versus Initiatives?',
          'Co należy do Execution, a co do Initiatives?'
        ),
        text(
          'Initiatives define the path. Execution is where that path turns into assigned work, progress, and issue management.',
          'Initiatives definiują drogę. Execution to miejsce, gdzie ta droga zamienia się w przypisaną pracę, postęp i obsługę problemów.'
        ),
        ['execution', 'initiatives']
      ),
      faq(
        'journey-execution-2',
        'execution',
        text('How should AI help here?', 'Jak AI powinno pomagać tutaj?'),
        text(
          'AI should shorten reporting cycles, surface risks early, and help teams decide what to do next when progress stalls.',
          'AI powinno skracać cykle raportowania, wcześnie wychwytywać ryzyka i pomagać zespołom zdecydować, co robić dalej, gdy postęp staje.'
        ),
        ['execution', 'ai']
      ),
    ],
    nextStepId: 'results',
    stageId: 'execution',
    relatedKnowledgeModuleId: 'execution',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  results: {
    id: 'results',
    moduleId: 'results',
    kind: 'journey',
    icon: 'BarChart3',
    title: text('Results', 'Results'),
    shortLabel: text('Did it work?', 'Czy to zadziałało?'),
    summary: text(
      'This step checks whether the transformation delivered the expected operational and business outcomes.',
      'Ten etap sprawdza, czy transformacja dostarczyła oczekiwane efekty operacyjne i biznesowe.'
    ),
    whatThisIs: text(
      'Results is the validation layer after change has been delivered.',
      'Results to warstwa walidacji po dostarczeniu zmiany.'
    ),
    whyItMatters: text(
      'A transformation is only complete when its impact can be seen, discussed, and improved.',
      'Transformacja jest pełna dopiero wtedy, gdy jej efekt można zobaczyć, omówić i ulepszać.'
    ),
    whatYouDoHere: [
      text(
        'Measure outcomes against the intended business value.',
        'Mierzysz wyniki względem zakładanej wartości biznesowej.'
      ),
      text(
        'Review what worked, what did not, and what should be adjusted.',
        'Przeglądasz, co zadziałało, co nie i co trzeba skorygować.'
      ),
      text(
        'Turn evidence into decisions about next investments or corrections.',
        'Zamieniasz dowody w decyzje o kolejnych inwestycjach lub korektach.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarize outcome signals across execution data.',
        'Podsumowuje sygnały wyniku z danych wykonawczych.'
      ),
      text(
        'Compare expected versus observed impact.',
        'Porównuje oczekiwany i zaobserwowany efekt.'
      ),
      text(
        'Suggest corrective actions or the next wave of change.',
        'Proponuje działania korygujące albo kolejną falę zmiany.'
      ),
    ],
    whatComesNext: text(
      'Validated results feed the next consulting cycle, better decisions, and stronger storytelling to stakeholders.',
      'Zweryfikowane wyniki zasilają kolejny cykl consultingowy, lepsze decyzje i mocniejszą narrację dla interesariuszy.'
    ),
    askAiNow: {
      label: text('Ask AI to evaluate the outcome', 'Zapytaj AI, aby ocenić wynik'),
      prompt: text(
        'You are helping me in the Results stage. Compare expected outcomes with the current evidence, explain what changed, and recommend the most important follow-up actions.',
        'Pomagasz mi w etapie Results. Porównaj oczekiwane wyniki z bieżącymi dowodami, wyjaśnij co się zmieniło i zaproponuj najważniejsze działania następcze.'
      ),
    },
    quickGuides: [
      makeGuide(
        'measure-impact',
        text('Measure transformation impact', 'Zmierz wpływ transformacji'),
        text(
          'Look for business and operating signals, not only project completion.',
          'Szukaj sygnałów biznesowych i operacyjnych, a nie tylko ukończenia projektu.'
        )
      ),
      makeGuide(
        'results-story',
        text('Prepare the results story', 'Przygotuj narrację wyników'),
        text(
          'Show what changed, how much, and what should happen next.',
          'Pokaż, co się zmieniło, o ile i co powinno wydarzyć się dalej.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'journey-results-1',
        'results',
        text('What if the outcome is mixed?', 'Co jeśli wynik jest mieszany?'),
        text(
          'Mixed outcomes are normal. Use this step to separate what delivered value, what underperformed, and what needs a different intervention.',
          'Mieszane wyniki są normalne. Użyj tego etapu, aby oddzielić to, co dało wartość, od tego, co nie dowiozło i wymaga innej interwencji.'
        ),
        ['results', 'impact']
      ),
      faq(
        'journey-results-2',
        'results',
        text('Is this only for reporting?', 'Czy to etap tylko do raportowania?'),
        text(
          'No. Reporting is only the visible layer. The real goal is to decide what to sustain, fix, or launch next.',
          'Nie. Raportowanie to tylko warstwa widoczna. Prawdziwym celem jest decyzja, co utrzymać, naprawić lub uruchomić dalej.'
        ),
        ['results', 'reporting']
      ),
    ],
    stageId: 'results',
    relatedKnowledgeModuleId: 'reports',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  my_work: {
    id: 'my_work',
    moduleId: 'mywork',
    kind: 'support',
    icon: 'ListTodo',
    title: text('My Work', 'My Work'),
    shortLabel: text('Task and decision engine', 'Silnik zadań i decyzji'),
    summary: text(
      'My Work supports every stage by turning initiatives into accountable tasks, decisions, and daily follow-through.',
      'My Work wspiera każdy etap, zamieniając inicjatywy w zadania, decyzje i codzienną realizację.'
    ),
    whatThisIs: text(
      'This module is your operational inbox for work that comes out of the consulting journey.',
      'Ten moduł to operacyjna skrzynka dla pracy wynikającej z całej podróży consultingowej.'
    ),
    whyItMatters: text(
      'Without a work engine, initiatives stay conceptual and execution loses ownership.',
      'Bez silnika pracy inicjatywy pozostają konceptem, a execution traci odpowiedzialność.'
    ),
    whatYouDoHere: [
      text(
        'Run tasks, priorities, and decisions across active initiatives.',
        'Prowadzisz zadania, priorytety i decyzje dla aktywnych inicjatyw.'
      ),
      text('Keep focus on what must move now.', 'Utrzymujesz fokus na tym, co musi ruszyć teraz.'),
      text(
        'Use it standalone when you need a personal or team work cockpit.',
        'Używasz go standalone, gdy potrzebujesz osobistego lub zespołowego kokpitu pracy.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Prioritize work and draft next actions.',
        'Pomaga priorytetyzować pracę i szkicować kolejne działania.'
      ),
      text(
        'Summarize decisions and execution updates.',
        'Podsumowuje decyzje i update’y wykonawcze.'
      ),
      text(
        'Spot overload, stale work, and dependency drift.',
        'Wychwytuje przeciążenie, zalegającą pracę i dryf zależności.'
      ),
    ],
    whatComesNext: text(
      'Use My Work to keep execution healthy while feeding evidence back into results and future planning.',
      'Używaj My Work, aby utrzymać execution w zdrowiu i zasilać results oraz przyszłe planowanie.'
    ),
    askAiNow: {
      label: text('Ask AI to prioritize my work', 'Zapytaj AI, aby ustawić priorytety pracy'),
      prompt: text(
        'You are helping me in My Work. Review the current workload, identify what matters most right now, and suggest a clear next-action order.',
        'Pomagasz mi w My Work. Przejrzyj bieżące obciążenie pracą, wskaż co jest teraz najważniejsze i zaproponuj jasną kolejność kolejnych działań.'
      ),
    },
    quickGuides: [
      makeGuide(
        'triage',
        text('Triage tasks fast', 'Szybko triaguj zadania'),
        text(
          'Separate urgent blockers from everything that can wait.',
          'Oddziel pilne blokery od wszystkiego, co może poczekać.'
        )
      ),
      makeGuide(
        'decision-loop',
        text('Keep a decision loop', 'Utrzymuj pętlę decyzji'),
        text(
          'Track decisions next to work so execution does not stall.',
          'Trzymaj decyzje obok pracy, aby execution nie stawało.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-mywork-1',
        'mywork',
        text(
          'Is My Work only for initiative tasks?',
          'Czy My Work jest tylko do tasków z inicjatyw?'
        ),
        text(
          'No. It supports the main journey, but it can also work as a standalone task and decision module for day-to-day operational control.',
          'Nie. Wspiera główną podróż, ale może też działać standalone jako moduł zadań i decyzji do codziennej kontroli operacyjnej.'
        ),
        ['mywork', 'standalone']
      ),
    ],
    supportModuleId: 'my_work',
    relatedKnowledgeModuleId: 'mywork',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  ideas: {
    id: 'ideas',
    moduleId: 'knowledge',
    kind: 'support',
    icon: 'Lightbulb',
    title: text('Ideas / Workplace / Notes', 'Ideas / Workplace / Notes'),
    shortLabel: text('Capture and shape thinking', 'Zbieraj i kształtuj myślenie'),
    summary: text(
      'This support layer captures observations, workshop output, and early ideas before they become structured work.',
      'Ta warstwa wspierająca zbiera obserwacje, wyniki warsztatów i wczesne pomysły zanim staną się uporządkowaną pracą.'
    ),
    whatThisIs: text(
      'Use it as a workspace for raw thinking, facilitation artifacts, and reusable knowledge.',
      'Używaj go jako workspace do surowego myślenia, artefaktów facylitacyjnych i wiedzy do ponownego użycia.'
    ),
    whyItMatters: text(
      'Good transformations need a safe place for ideas before they are mature enough for initiatives or tasks.',
      'Dobre transformacje potrzebują bezpiecznego miejsca na pomysły, zanim dojrzeją do inicjatyw lub tasków.'
    ),
    whatYouDoHere: [
      text(
        'Collect workshop notes, thoughts, and emerging opportunities.',
        'Zbierasz notatki warsztatowe, myśli i pojawiające się szanse.'
      ),
      text(
        'Develop rough ideas into sharper options.',
        'Rozwijasz surowe pomysły w bardziej konkretne opcje.'
      ),
      text(
        'Use it standalone as a knowledge and ideation space.',
        'Używasz go standalone jako przestrzeni wiedzy i ideacji.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Turn messy notes into themes and hypotheses.',
        'Zamienia chaotyczne notatki w tematy i hipotezy.'
      ),
      text(
        'Suggest idea clusters and stronger framing.',
        'Sugeruje klastry pomysłów i mocniejsze sformułowanie.'
      ),
      text(
        'Prepare idea summaries for review or conversion into work.',
        'Przygotowuje podsumowania pomysłów do przeglądu lub konwersji w pracę.'
      ),
    ],
    whatComesNext: text(
      'The best ideas can move into interview follow-up, initiatives, or direct execution work.',
      'Najlepsze pomysły mogą przejść do uzupełnień interview, inicjatyw albo bezpośrednio do execution.'
    ),
    askAiNow: {
      label: text('Ask AI to sharpen these ideas', 'Zapytaj AI, aby wyostrzyć pomysły'),
      prompt: text(
        'You are helping me in Ideas and Notes. Review the current notes, group them into clear themes, and suggest which ideas deserve further validation or conversion into initiatives.',
        'Pomagasz mi w obszarze Ideas i Notes. Przejrzyj bieżące notatki, pogrupuj je w jasne tematy i zaproponuj, które pomysły zasługują na dalszą walidację lub konwersję w inicjatywy.'
      ),
    },
    quickGuides: [
      makeGuide(
        'capture-fast',
        text('Capture ideas without friction', 'Zbieraj pomysły bez tarcia'),
        text(
          'Store raw observations first, structure them later.',
          'Najpierw zapisuj surowe obserwacje, a strukturę nadaj później.'
        )
      ),
      makeGuide(
        'convert-idea',
        text('Convert an idea into work', 'Zamień pomysł w pracę'),
        text(
          'Move from note to validated option, then to initiative or task.',
          'Przejdź od notatki do zwalidowanej opcji, a potem do inicjatywy lub taska.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-ideas-1',
        'knowledge',
        text('Is this part of the main journey?', 'Czy to część głównej podróży?'),
        text(
          'It supports the journey, but it also works standalone whenever a team needs a place to think, collect notes, and develop ideas.',
          'To wsparcie podróży, ale działa też standalone wszędzie tam, gdzie zespół potrzebuje miejsca do myślenia, notatek i rozwijania pomysłów.'
        ),
        ['ideas', 'standalone']
      ),
    ],
    supportModuleId: 'ideas',
    relatedKnowledgeModuleId: 'knowledge',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  finance: {
    id: 'finance',
    moduleId: 'economics',
    kind: 'support',
    icon: 'Wallet',
    title: text('Finance', 'Finance'),
    shortLabel: text('Value and economics', 'Wartość i ekonomika'),
    summary: text(
      'Finance supports the journey by checking value, ROI, and economic consequences of change.',
      'Finance wspiera podróż, sprawdzając wartość, ROI i ekonomiczne konsekwencje zmiany.'
    ),
    whatThisIs: text(
      'This module links transformation work with business value and financial logic.',
      'Ten moduł łączy pracę transformacyjną z wartością biznesową i logiką finansową.'
    ),
    whyItMatters: text(
      'A transformation needs value proof, not only activity proof.',
      'Transformacja potrzebuje dowodu wartości, a nie tylko dowodu aktywności.'
    ),
    whatYouDoHere: [
      text(
        'Estimate value, ROI, payback, and trade-offs.',
        'Szacujesz wartość, ROI, payback i kompromisy.'
      ),
      text(
        'Use finance to support prioritization and result validation.',
        'Używasz finansów do wsparcia priorytetyzacji i walidacji wyników.'
      ),
      text(
        'Run it standalone when you need economics without the full consulting flow.',
        'Uruchamiasz go standalone, gdy potrzebujesz ekonomiki bez pełnego flow consultingowego.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarize value assumptions and financial dependencies.',
        'Podsumowuje założenia wartości i zależności finansowe.'
      ),
      text(
        'Stress-test ROI logic and highlight weak assumptions.',
        'Testuje logikę ROI i wskazuje słabe założenia.'
      ),
      text(
        'Prepare concise value narratives for decision makers.',
        'Przygotowuje zwięzłe narracje wartości dla decydentów.'
      ),
    ],
    whatComesNext: text(
      'Finance evidence strengthens initiative choices, execution prioritization, and final result storytelling.',
      'Dowody finansowe wzmacniają wybór inicjatyw, priorytety execution i końcową narrację wyników.'
    ),
    askAiNow: {
      label: text('Ask AI to review the value logic', 'Zapytaj AI, aby przejrzeć logikę wartości'),
      prompt: text(
        'You are helping me in Finance. Review the current value assumptions, point out weak spots in the ROI logic, and suggest the strongest decision-ready summary.',
        'Pomagasz mi w obszarze Finance. Przejrzyj aktualne założenia wartości, wskaż słabe miejsca w logice ROI i zaproponuj najmocniejsze podsumowanie gotowe do decyzji.'
      ),
    },
    quickGuides: [
      makeGuide(
        'roi-basics',
        text('Build a practical ROI view', 'Zbuduj praktyczny widok ROI'),
        text(
          'Keep the model simple enough to support decisions, not just spreadsheets.',
          'Utrzymuj model na tyle prosty, aby wspierał decyzje, a nie tylko arkusze.'
        )
      ),
      makeGuide(
        'value-story',
        text('Explain value to stakeholders', 'Wyjaśnij wartość interesariuszom'),
        text(
          'Link financial logic with operational outcomes.',
          'Połącz logikę finansową z wynikami operacyjnymi.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-finance-1',
        'economics',
        text('When should I use Finance?', 'Kiedy używać Finance?'),
        text(
          'Use it when initiative choices, execution trade-offs, or result validation need a clear value lens.',
          'Używaj go, gdy wybór inicjatyw, kompromisy execution lub walidacja wyników wymagają jasnej perspektywy wartości.'
        ),
        ['finance', 'roi']
      ),
    ],
    supportModuleId: 'finance',
    relatedKnowledgeModuleId: 'economics',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  presentations: {
    id: 'presentations',
    moduleId: 'reports',
    kind: 'support',
    icon: 'Presentation',
    title: text('Reports / Presentations', 'Reports / Presentations'),
    shortLabel: text('Tell the story', 'Opowiedz historię'),
    summary: text(
      'This support layer turns work into communication for leaders, clients, and stakeholders.',
      'Ta warstwa wspierająca zamienia pracę w komunikację do liderów, klientów i interesariuszy.'
    ),
    whatThisIs: text(
      'Use it to present the current state, proposed change, execution progress, or measured results.',
      'Używaj go do prezentowania stanu obecnego, proponowanej zmiany, postępu execution albo zmierzonych wyników.'
    ),
    whyItMatters: text(
      'Good transformation work needs clear communication to get decisions, alignment, and adoption.',
      'Dobra praca transformacyjna potrzebuje jasnej komunikacji, aby zdobywać decyzje, alignment i adopcję.'
    ),
    whatYouDoHere: [
      text(
        'Build reports and stakeholder-ready presentations.',
        'Budujesz raporty i prezentacje gotowe dla interesariuszy.'
      ),
      text(
        'Translate evidence into executive language and narrative.',
        'Przekładasz dowody na język executive i spójną narrację.'
      ),
      text(
        'Use it standalone when you only need reporting or storytelling.',
        'Używasz go standalone, gdy potrzebujesz tylko raportowania lub storytellingu.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Draft clear summaries for different stakeholder groups.',
        'Tworzy jasne podsumowania dla różnych grup interesariuszy.'
      ),
      text(
        'Turn detailed work into board-ready slides or reports.',
        'Zamienia szczegółową pracę w slajdy lub raporty gotowe na zarząd.'
      ),
      text(
        'Highlight what changed, why it matters, and what is next.',
        'Podkreśla co się zmieniło, dlaczego to ważne i co dalej.'
      ),
    ],
    whatComesNext: text(
      'Communication closes the loop by helping teams decide, align, and start the next cycle with confidence.',
      'Komunikacja domyka pętlę, pomagając zespołom podejmować decyzje, łapać alignment i zaczynać kolejny cykl z pewnością.'
    ),
    askAiNow: {
      label: text('Ask AI to prepare the story', 'Zapytaj AI, aby przygotować narrację'),
      prompt: text(
        'You are helping me in Reports and Presentations. Turn the current work context into a concise stakeholder-ready story with key messages, evidence, and recommended next actions.',
        'Pomagasz mi w Reports i Presentations. Zamień bieżący kontekst pracy w zwięzłą narrację gotową dla interesariuszy z kluczowymi komunikatami, dowodami i rekomendowanymi dalszymi działaniami.'
      ),
    },
    quickGuides: [
      makeGuide(
        'stakeholder-story',
        text('Build a stakeholder story', 'Zbuduj narrację dla interesariuszy'),
        text(
          'Lead with change, impact, and the next decision to make.',
          'Zacznij od zmiany, wpływu i kolejnej decyzji do podjęcia.'
        )
      ),
      makeGuide(
        'report-fast',
        text('Create a fast status report', 'Stwórz szybki status report'),
        text('Compress the signal, not the meaning.', 'Kompresuj sygnał, a nie sens.')
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-presentations-1',
        'reports',
        text(
          'What is the difference between reports and presentations?',
          'Jaka jest różnica między reports a presentations?'
        ),
        text(
          'Reports preserve detail and traceability. Presentations compress that detail into a decision-ready story for a specific audience.',
          'Reports zachowują szczegół i ścieżkę dowodową. Presentations kompresują ten szczegół do narracji gotowej pod decyzję dla konkretnej grupy odbiorców.'
        ),
        ['reports', 'presentations']
      ),
    ],
    supportModuleId: 'presentations',
    relatedKnowledgeModuleId: 'reports',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  chat: {
    id: 'chat',
    moduleId: 'ai_chat',
    kind: 'support',
    icon: 'MessagesSquare',
    title: text('Chat', 'Chat'),
    shortLabel: text('Talk to Teresa', 'Rozmawiaj z Teresą'),
    summary: text(
      'Chat is your always-on workspace with Teresa, the AI consultant who knows your organization context.',
      'Chat to Twoja zawsze dostępna przestrzeń z Teresą — konsultantką AI, która zna kontekst Twojej organizacji.'
    ),
    whatThisIs: text(
      'A conversational entry point to the whole platform: ask questions, draft work, and trigger actions across modules.',
      'Konwersacyjny punkt wejścia do całej platformy: zadawaj pytania, twórz robocze materiały i uruchamiaj akcje w modułach.'
    ),
    whyItMatters: text(
      'Most work starts as a question. Chat turns that question into structured output instead of a dead end.',
      'Większość pracy zaczyna się od pytania. Chat zamienia to pytanie w uporządkowany wynik, a nie w ślepy zaułek.'
    ),
    whatYouDoHere: [
      text(
        'Ask about any module, workflow, or your own data and get grounded, context-aware answers.',
        'Pytasz o dowolny moduł, proces lub własne dane i dostajesz osadzone w kontekście odpowiedzi.'
      ),
      text(
        'Draft artifacts — summaries, tables, plans, messages — directly in the conversation.',
        'Tworzysz artefakty — podsumowania, tabele, plany, wiadomości — bezpośrednio w rozmowie.'
      ),
      text(
        'Hand off context to other modules instead of re-explaining it each time.',
        'Przekazujesz kontekst do innych modułów zamiast tłumaczyć go za każdym razem od nowa.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Teresa reasons over your organization, project, and screen context, not just the raw message.',
        'Teresa wnioskuje na podstawie kontekstu organizacji, projektu i ekranu, nie tylko surowej wiadomości.'
      ),
      text(
        'She challenges weak assumptions and proposes the strongest next step.',
        'Kwestionuje słabe założenia i proponuje najmocniejszy kolejny krok.'
      ),
      text(
        'She cites product documentation when explaining how features work.',
        'Cytuje dokumentację produktu, gdy wyjaśnia, jak działają funkcje.'
      ),
    ],
    whatComesNext: text(
      'Use Chat to scope the work, then continue in the dedicated module where the real artifacts live.',
      'Użyj Chatu, aby określić zakres pracy, a potem kontynuuj w dedykowanym module, gdzie powstają właściwe artefakty.'
    ),
    askAiNow: {
      label: text('Ask Teresa to plan my next step', 'Poproś Teresę o plan kolejnego kroku'),
      prompt: text(
        'You are Teresa in the main Chat. Based on my current context, propose the single most useful next step and the exact module where I should do it.',
        'Jesteś Teresą w głównym Chacie. Na podstawie mojego kontekstu zaproponuj jeden najbardziej użyteczny kolejny krok i dokładny moduł, w którym powinienem go wykonać.'
      ),
    },
    quickGuides: [
      makeGuide(
        'chat-context',
        text('Give Teresa the right context', 'Daj Teresie właściwy kontekst'),
        text(
          'Name the module, goal, and constraints so the answer is decision-ready.',
          'Nazwij moduł, cel i ograniczenia, aby odpowiedź była gotowa pod decyzję.'
        )
      ),
      SHARED_GUIDES.overview,
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-chat-1',
        'ai_chat',
        text('What does Teresa know about my organization?', 'Co Teresa wie o mojej organizacji?'),
        text(
          'She uses your organization profile, active project, screen context, and product documentation — never another organization data.',
          'Korzysta z profilu organizacji, aktywnego projektu, kontekstu ekranu i dokumentacji produktu — nigdy z danych innej organizacji.'
        ),
        ['chat', 'teresa', 'ai']
      ),
    ],
    relatedKnowledgeModuleId: 'ai_chat',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  audits: {
    id: 'audits',
    moduleId: 'assessment',
    kind: 'support',
    icon: 'ClipboardCheck',
    title: text('Audits', 'Audyty'),
    shortLabel: text('Run a structured audit', 'Przeprowadź ustrukturyzowany audyt'),
    summary: text(
      'Audits orchestrate structured maturity programs — DRD, SIRI, ADMA, Lean — into a single comparable assessment.',
      'Audyty orkiestrują ustrukturyzowane programy dojrzałości — DRD, SIRI, ADMA, Lean — w jeden porównywalny pomiar.'
    ),
    whatThisIs: text(
      'A guided way to score the current state against a recognized framework and produce defensible evidence.',
      'Prowadzony sposób oceny stanu obecnego względem uznanego frameworka i wytworzenia obronnych dowodów.'
    ),
    whyItMatters: text(
      'A consistent framework makes gaps comparable across teams, sites, and time — not just opinions.',
      'Spójny framework sprawia, że luki są porównywalne między zespołami, zakładami i w czasie — to nie są tylko opinie.'
    ),
    whatYouDoHere: [
      text(
        'Pick a framework, run the questionnaire, and capture evidence for each dimension.',
        'Wybierasz framework, przeprowadzasz kwestionariusz i zbierasz dowody dla każdego wymiaru.'
      ),
      text(
        'Turn scores into a gap map that feeds the diagnosis and the target state.',
        'Zamieniasz wyniki w mapę luk, która zasila diagnozę i stan docelowy.'
      ),
      text(
        'Compare results across audits to track maturity progress over time.',
        'Porównujesz wyniki między audytami, aby śledzić postęp dojrzałości w czasie.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Suggests scores from your evidence and flags inconsistent answers.',
        'Proponuje oceny na podstawie dowodów i wskazuje niespójne odpowiedzi.'
      ),
      text(
        'Summarizes the biggest gaps and their likely business impact.',
        'Podsumowuje największe luki i ich prawdopodobny wpływ biznesowy.'
      ),
      text(
        'Drafts the audit narrative ready for the client report.',
        'Tworzy narrację audytu gotową do raportu dla klienta.'
      ),
    ],
    whatComesNext: text(
      'Audit results sharpen the assessment and become the backbone of prioritized initiatives.',
      'Wyniki audytu wyostrzają ocenę i stają się szkieletem priorytetyzowanych inicjatyw.'
    ),
    askAiNow: {
      label: text('Ask AI to read the audit gaps', 'Poproś AI o odczytanie luk audytu'),
      prompt: text(
        'You are helping me in Audits. Review the current scores and evidence, identify the most material gaps, and propose where they should turn into initiatives.',
        'Pomagasz mi w module Audyty. Przejrzyj aktualne wyniki i dowody, wskaż najbardziej istotne luki i zaproponuj, gdzie powinny zamienić się w inicjatywy.'
      ),
    },
    quickGuides: [
      makeGuide(
        'audit-framework',
        text('Choose the right framework', 'Wybierz właściwy framework'),
        text(
          'Match the framework to the question you must answer for the client.',
          'Dopasuj framework do pytania, na które musisz odpowiedzieć klientowi.'
        )
      ),
      makeGuide(
        'audit-evidence',
        text('Capture defensible evidence', 'Zbieraj obronne dowody'),
        text(
          'Tie every score to a fact so the result survives challenge.',
          'Powiąż każdą ocenę z faktem, aby wynik przetrwał kwestionowanie.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-audits-1',
        'assessment',
        text('How is Audits different from Tools?', 'Czym Audyty różnią się od Tools?'),
        text(
          'Tools cover broad discovery and assessments. Audits run a single recognized framework end to end with comparable scoring.',
          'Tools obejmują szerokie discovery i oceny. Audyty przeprowadzają jeden uznany framework od początku do końca z porównywalnym scoringiem.'
        ),
        ['audits', 'assessment', 'maturity']
      ),
    ],
    relatedKnowledgeModuleId: 'assessment',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  meeting: {
    id: 'meeting',
    moduleId: 'meeting',
    kind: 'support',
    icon: 'Video',
    title: text('Meeting', 'Spotkanie'),
    shortLabel: text('Capture the meeting', 'Uchwyć spotkanie'),
    summary: text(
      'Meeting turns live conversations into structured notes, decisions, and follow-up work.',
      'Spotkanie zamienia rozmowy na żywo w uporządkowane notatki, decyzje i zadania do wykonania.'
    ),
    whatThisIs: text(
      'A workspace to run or record a session and convert it into shared, actionable output.',
      'Przestrzeń do prowadzenia lub nagrania sesji i zamiany jej we wspólny, wykonalny wynik.'
    ),
    whyItMatters: text(
      'Decisions made in meetings are lost without a clean record. This keeps the signal.',
      'Decyzje podjęte na spotkaniach giną bez czystego zapisu. To zachowuje sygnał.'
    ),
    whatYouDoHere: [
      text(
        'Capture the agenda, discussion, and decisions in one place.',
        'Zapisujesz agendę, dyskusję i decyzje w jednym miejscu.'
      ),
      text(
        'Convert outcomes into tasks, initiatives, or notes without re-typing.',
        'Zamieniasz ustalenia w zadania, inicjatywy lub notatki bez przepisywania.'
      ),
      text(
        'Share a concise recap with people who were not in the room.',
        'Udostępniasz zwięzłe podsumowanie osobom, których nie było na spotkaniu.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes the conversation into themes, decisions, and open questions.',
        'Podsumowuje rozmowę w tematy, decyzje i otwarte pytania.'
      ),
      text(
        'Extracts action items with owners and due dates.',
        'Wyciąga zadania z właścicielami i terminami.'
      ),
      text(
        'Drafts the follow-up message for participants.',
        'Tworzy wiadomość podsumowującą dla uczestników.'
      ),
    ],
    whatComesNext: text(
      'Meeting outcomes flow into My Work, Initiatives, and Notes so nothing stalls after the call.',
      'Ustalenia ze spotkania trafiają do My Work, Initiatives i Notatek, aby nic nie utknęło po rozmowie.'
    ),
    askAiNow: {
      label: text('Ask AI to recap this meeting', 'Poproś AI o podsumowanie spotkania'),
      prompt: text(
        'You are helping me in Meeting. Summarize the discussion into decisions, action items with owners, and a short recap I can send to participants.',
        'Pomagasz mi w module Spotkanie. Podsumuj dyskusję w decyzje, zadania z właścicielami oraz krótki recap, który mogę wysłać uczestnikom.'
      ),
    },
    quickGuides: [
      makeGuide(
        'meeting-decisions',
        text('Separate decisions from discussion', 'Oddziel decyzje od dyskusji'),
        text(
          'Record what was decided distinctly from what was debated.',
          'Zapisuj to, co zostało zdecydowane, oddzielnie od tego, co było dyskutowane.'
        )
      ),
      makeGuide(
        'meeting-actions',
        text('Turn talk into action items', 'Zamień rozmowę w zadania'),
        text(
          'Every decision needs an owner and a next step.',
          'Każda decyzja potrzebuje właściciela i kolejnego kroku.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-meeting-1',
        'meeting',
        text('What happens to meeting outcomes?', 'Co dzieje się z ustaleniami ze spotkania?'),
        text(
          'They can be promoted into tasks, initiatives, or notes so the work continues in the right module.',
          'Można je przekształcić w zadania, inicjatywy lub notatki, aby praca trwała we właściwym module.'
        ),
        ['meeting', 'notes', 'tasks']
      ),
    ],
    relatedKnowledgeModuleId: 'knowledge',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  document_studio: {
    id: 'document_studio',
    moduleId: 'document_studio',
    kind: 'support',
    icon: 'FileText',
    title: text('Document Studio', 'Document Studio'),
    shortLabel: text('Write documents', 'Twórz dokumenty'),
    summary: text(
      'Document Studio is an AI-assisted workspace for writing long-form, structured documents.',
      'Document Studio to wspierana przez AI przestrzeń do pisania długich, ustrukturyzowanych dokumentów.'
    ),
    whatThisIs: text(
      'A focused editor where you draft, structure, and refine documents with AI alongside you.',
      'Skoncentrowany edytor, w którym tworzysz, strukturyzujesz i dopracowujesz dokumenty z AI u boku.'
    ),
    whyItMatters: text(
      'Consulting output lives in documents. A good editor turns scattered work into a finished deliverable.',
      'Wynik konsultingu żyje w dokumentach. Dobry edytor zamienia rozproszoną pracę w gotowy deliverable.'
    ),
    whatYouDoHere: [
      text(
        'Generate a first draft from a brief, your data, or an outline.',
        'Generujesz pierwszą wersję z briefu, swoich danych lub konspektu.'
      ),
      text(
        'Edit with structure — headings, sections, tables — and AI rewriting in place.',
        'Edytujesz ze strukturą — nagłówki, sekcje, tabele — z przepisywaniem AI w miejscu.'
      ),
      text(
        'Export or hand the finished document into Outputs and presentations.',
        'Eksportujesz lub przekazujesz gotowy dokument do Outputs i prezentacji.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Drafts and restructures sections from a short instruction.',
        'Tworzy i przebudowuje sekcje na podstawie krótkiej instrukcji.'
      ),
      text(
        'Tightens tone, length, and clarity for the target reader.',
        'Dostraja ton, długość i jasność pod docelowego czytelnika.'
      ),
      text(
        'Pulls in evidence from your project so the document stays grounded.',
        'Wciąga dowody z Twojego projektu, aby dokument pozostał osadzony w faktach.'
      ),
    ],
    whatComesNext: text(
      'A finished document becomes an output you can present, share, or attach to an initiative.',
      'Gotowy dokument staje się wynikiem, który możesz zaprezentować, udostępnić lub dołączyć do inicjatywy.'
    ),
    askAiNow: {
      label: text('Ask AI to draft this document', 'Poproś AI o szkic dokumentu'),
      prompt: text(
        'You are helping me in Document Studio. Draft a clear, well-structured document from my current context, with sections, headings, and a concise executive summary.',
        'Pomagasz mi w Document Studio. Stwórz jasny, dobrze ustrukturyzowany dokument z mojego kontekstu, z sekcjami, nagłówkami i zwięzłym podsumowaniem executive.'
      ),
    },
    quickGuides: [
      makeGuide(
        'doc-outline',
        text('Start from an outline', 'Zacznij od konspektu'),
        text(
          'Agree the structure first, then let AI fill each section.',
          'Najpierw ustal strukturę, potem pozwól AI uzupełnić każdą sekcję.'
        )
      ),
      makeGuide(
        'doc-rewrite',
        text('Rewrite in place', 'Przepisuj w miejscu'),
        text(
          'Select text and ask AI to tighten, expand, or change the tone.',
          'Zaznacz tekst i poproś AI o skrócenie, rozwinięcie lub zmianę tonu.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-document-studio-1',
        'document_studio',
        text(
          'When do I use Document Studio vs Presentation Studio?',
          'Kiedy używać Document Studio, a kiedy Presentation Studio?'
        ),
        text(
          'Use Document Studio for written, detailed deliverables. Use Presentation Studio when the output is a slide deck.',
          'Używaj Document Studio do pisanych, szczegółowych deliverables. Używaj Presentation Studio, gdy wynikiem jest prezentacja.'
        ),
        ['document', 'studio', 'writing']
      ),
    ],
    relatedKnowledgeModuleId: 'reports',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  presentation_studio: {
    id: 'presentation_studio',
    moduleId: 'presentation_studio',
    kind: 'support',
    icon: 'Presentation',
    title: text('Presentation Studio', 'Presentation Studio'),
    shortLabel: text('Generate decks', 'Generuj prezentacje'),
    summary: text(
      'Presentation Studio generates and edits slide decks from your content, fast.',
      'Presentation Studio generuje i edytuje prezentacje z Twoich treści — szybko.'
    ),
    whatThisIs: text(
      'An AI deck builder that turns a brief, document, or data into a structured, on-brand presentation.',
      'Kreator prezentacji AI, który zamienia brief, dokument lub dane w ustrukturyzowaną, spójną z marką prezentację.'
    ),
    whyItMatters: text(
      'Decisions often happen in the deck. Building it fast keeps momentum without losing quality.',
      'Decyzje często zapadają przy prezentacji. Szybkie jej zbudowanie utrzymuje tempo bez utraty jakości.'
    ),
    whatYouDoHere: [
      text(
        'Generate a full deck from a prompt, outline, or existing document.',
        'Generujesz całą prezentację z promptu, konspektu lub istniejącego dokumentu.'
      ),
      text(
        'Edit slides, structure, and visuals, then refine with AI.',
        'Edytujesz slajdy, strukturę i grafiki, a potem dopracowujesz z AI.'
      ),
      text(
        'Export or push the deck into Outputs for sharing.',
        'Eksportujesz lub przekazujesz prezentację do Outputs do udostępnienia.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Builds a logical slide flow with a clear narrative arc.',
        'Buduje logiczny przepływ slajdów z czytelnym łukiem narracyjnym.'
      ),
      text(
        'Writes concise slide copy aimed at the decision to be made.',
        'Pisze zwięzłe teksty slajdów nakierowane na decyzję do podjęcia.'
      ),
      text(
        'Reworks a deck for a different audience or time slot.',
        'Przerabia prezentację pod inną grupę odbiorców lub krótszy czas.'
      ),
    ],
    whatComesNext: text(
      'The finished deck becomes an output you present to stakeholders and store with the project.',
      'Gotowa prezentacja staje się wynikiem, który prezentujesz interesariuszom i zapisujesz przy projekcie.'
    ),
    askAiNow: {
      label: text('Ask AI to build the deck', 'Poproś AI o zbudowanie prezentacji'),
      prompt: text(
        'You are helping me in Presentation Studio. Build a concise, decision-ready slide deck from my current context, with a clear narrative and one key message per slide.',
        'Pomagasz mi w Presentation Studio. Zbuduj zwięzłą, gotową pod decyzję prezentację z mojego kontekstu, z jasną narracją i jednym kluczowym komunikatem na slajd.'
      ),
    },
    quickGuides: [
      makeGuide(
        'deck-narrative',
        text('Lead with the narrative', 'Zacznij od narracji'),
        text(
          'Decide the story first; slides serve the story, not the other way round.',
          'Najpierw zdecyduj historię; slajdy służą historii, nie odwrotnie.'
        )
      ),
      makeGuide(
        'deck-one-message',
        text('One message per slide', 'Jeden komunikat na slajd'),
        text('If a slide says two things, split it.', 'Jeśli slajd mówi dwie rzeczy, podziel go.')
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-presentation-studio-1',
        'presentation_studio',
        text(
          'Can I start from an existing document?',
          'Czy mogę zacząć od istniejącego dokumentu?'
        ),
        text(
          'Yes — Presentation Studio can turn a Document Studio document or any content into a structured deck.',
          'Tak — Presentation Studio potrafi zamienić dokument z Document Studio lub dowolną treść w ustrukturyzowaną prezentację.'
        ),
        ['presentation', 'studio', 'deck']
      ),
    ],
    relatedKnowledgeModuleId: 'reports',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  table_studio: {
    id: 'table_studio',
    moduleId: 'table_studio',
    kind: 'support',
    icon: 'Table',
    title: text('Table Studio', 'Table Studio'),
    shortLabel: text('Work with tables', 'Pracuj na tabelach'),
    summary: text(
      'Table Studio is an AI-assisted workspace for building and reasoning over operational tables.',
      'Table Studio to wspierana przez AI przestrzeń do budowania i analizowania tabel operacyjnych.'
    ),
    whatThisIs: text(
      'A spreadsheet-style surface where you structure data and let AI compute, fill, and explain it.',
      'Powierzchnia w stylu arkusza, gdzie strukturyzujesz dane, a AI je liczy, uzupełnia i wyjaśnia.'
    ),
    whyItMatters: text(
      'Much transformation work is tabular — plans, registers, scorecards. This makes that work fast and consistent.',
      'Duża część pracy transformacyjnej jest tabelaryczna — plany, rejestry, scorecardy. To czyni ją szybką i spójną.'
    ),
    whatYouDoHere: [
      text(
        'Create tables from a prompt, paste, or import and structure columns quickly.',
        'Tworzysz tabele z promptu, wklejki lub importu i szybko strukturyzujesz kolumny.'
      ),
      text(
        'Ask AI to fill, transform, or summarize rows without manual formulas.',
        'Prosisz AI o uzupełnienie, przekształcenie lub podsumowanie wierszy bez ręcznych formuł.'
      ),
      text(
        'Use tables as registers (RAID, actions, KPIs) that feed other modules.',
        'Używasz tabel jako rejestrów (RAID, działania, KPI), które zasilają inne moduły.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Generates and structures columns from a plain-language description.',
        'Generuje i strukturyzuje kolumny z opisu w języku naturalnym.'
      ),
      text(
        'Fills, classifies, or computes cells and explains its reasoning.',
        'Uzupełnia, klasyfikuje lub liczy komórki i wyjaśnia swoje rozumowanie.'
      ),
      text(
        'Summarizes a table into the few facts that matter for a decision.',
        'Podsumowuje tabelę do kilku faktów istotnych dla decyzji.'
      ),
    ],
    whatComesNext: text(
      'A finished table becomes a reusable register or an output you attach to initiatives and reports.',
      'Gotowa tabela staje się wielokrotnego użytku rejestrem lub wynikiem, który dołączasz do inicjatyw i raportów.'
    ),
    askAiNow: {
      label: text('Ask AI to build the table', 'Poproś AI o zbudowanie tabeli'),
      prompt: text(
        'You are helping me in Table Studio. Build a well-structured table for my current need, propose the columns, and fill what you can infer from my context.',
        'Pomagasz mi w Table Studio. Zbuduj dobrze ustrukturyzowaną tabelę pod moją potrzebę, zaproponuj kolumny i uzupełnij to, co możesz wywnioskować z mojego kontekstu.'
      ),
    },
    quickGuides: [
      makeGuide(
        'table-columns',
        text('Get the columns right first', 'Najpierw ustaw właściwe kolumny'),
        text(
          'Good columns make every later row and formula easier.',
          'Dobre kolumny ułatwiają każdy późniejszy wiersz i formułę.'
        )
      ),
      makeGuide(
        'table-ai-fill',
        text('Let AI fill and summarize', 'Pozwól AI uzupełniać i podsumowywać'),
        text(
          'Describe the result you want instead of writing formulas.',
          'Opisz oczekiwany wynik zamiast pisać formuły.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-table-studio-1',
        'table_studio',
        text('Is Table Studio just a spreadsheet?', 'Czy Table Studio to tylko arkusz?'),
        text(
          'It works like one, but AI can structure, fill, and explain the data, and tables can feed other modules as registers.',
          'Działa jak arkusz, ale AI potrafi strukturyzować, uzupełniać i wyjaśniać dane, a tabele mogą zasilać inne moduły jako rejestry.'
        ),
        ['table', 'studio', 'data']
      ),
    ],
    relatedKnowledgeModuleId: 'reports',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  settings: {
    id: 'settings',
    moduleId: 'settings',
    kind: 'system',
    icon: 'Settings',
    title: text('Settings', 'Ustawienia'),
    shortLabel: text('Configure your account', 'Skonfiguruj konto'),
    summary: text(
      'Settings is where you control your profile, preferences, AI behavior, security, and integrations.',
      'Ustawienia to miejsce, gdzie kontrolujesz profil, preferencje, zachowanie AI, bezpieczeństwo i integracje.'
    ),
    whatThisIs: text(
      'A central place to make the platform work the way you and your organization expect.',
      'Centralne miejsce, aby platforma działała tak, jak oczekujesz Ty i Twoja organizacja.'
    ),
    whyItMatters: text(
      'Good defaults save time on every screen; the wrong ones quietly slow you down.',
      'Dobre ustawienia domyślne oszczędzają czas na każdym ekranie; złe po cichu spowalniają.'
    ),
    whatYouDoHere: [
      text(
        'Manage your profile, language, appearance, and accessibility.',
        'Zarządzasz profilem, językiem, wyglądem i dostępnością.'
      ),
      text(
        'Tune AI response style, tone, and proactivity, plus your custom instructions.',
        'Dostrajasz styl odpowiedzi AI, ton i proaktywność oraz własne instrukcje.'
      ),
      text(
        'Control security, data controls, notifications, and connected apps.',
        'Kontrolujesz bezpieczeństwo, ustawienia danych, powiadomienia i połączone aplikacje.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains what each setting changes and recommends sensible defaults.',
        'Wyjaśnia, co zmienia każde ustawienie i rekomenduje rozsądne wartości domyślne.'
      ),
      text(
        'Applies your AI preferences consistently across every module.',
        'Stosuje Twoje preferencje AI spójnie w każdym module.'
      ),
      text(
        'Helps you write custom instructions that improve every answer.',
        'Pomaga napisać własne instrukcje, które poprawiają każdą odpowiedź.'
      ),
    ],
    whatComesNext: text(
      'With settings tuned, the rest of the platform behaves the way you want by default.',
      'Po dostrojeniu ustawień reszta platformy domyślnie zachowuje się tak, jak chcesz.'
    ),
    askAiNow: {
      label: text('Ask AI about a setting', 'Zapytaj AI o ustawienie'),
      prompt: text(
        'You are helping me in Settings. Explain what the relevant settings do for my situation and recommend the configuration that fits how I work.',
        'Pomagasz mi w Ustawieniach. Wyjaśnij, co robią istotne ustawienia w mojej sytuacji, i zarekomenduj konfigurację dopasowaną do tego, jak pracuję.'
      ),
    },
    quickGuides: [
      makeGuide(
        'settings-ai',
        text('Tune how AI responds', 'Dostrój sposób odpowiedzi AI'),
        text(
          'Set tone, length, and proactivity once; it applies everywhere.',
          'Ustaw ton, długość i proaktywność raz; działa wszędzie.'
        )
      ),
      makeGuide(
        'settings-security',
        text('Review security and data', 'Przejrzyj bezpieczeństwo i dane'),
        text(
          'Check security, data controls, and connected apps periodically.',
          'Okresowo sprawdzaj bezpieczeństwo, ustawienia danych i połączone aplikacje.'
        )
      ),
      SHARED_GUIDES.askAi,
    ],
    faqs: [
      faq(
        'support-settings-1',
        'settings',
        text('Do my AI settings apply everywhere?', 'Czy moje ustawienia AI działają wszędzie?'),
        text(
          'Yes — response style, tone, and custom instructions are applied across all modules where AI helps.',
          'Tak — styl odpowiedzi, ton i własne instrukcje są stosowane we wszystkich modułach, w których pomaga AI.'
        ),
        ['settings', 'ai', 'preferences']
      ),
    ],
    relatedKnowledgeModuleId: 'settings',
    video: HELP_SYSTEM_OVERVIEW.video,
  },
  superadmin_overview: createSystemDoc({
    id: 'superadmin_overview',
    moduleId: 'superadmin',
    icon: 'Shield',
    title: text('Super Admin Overview', 'Super Admin Overview'),
    summary: text(
      'This is the command layer for platform-wide visibility, critical signals, and navigation into operational domains.',
      'To warstwa dowodzenia dla widoczności całej platformy, krytycznych sygnałów i wejścia do domen operacyjnych.'
    ),
    whatThisIs: text(
      'Use this screen to understand platform health, adoption, AI activity, and where intervention is needed first.',
      'Używaj tego ekranu, aby rozumieć zdrowie platformy, adopcję, aktywność AI i to, gdzie najpierw potrzebna jest interwencja.'
    ),
    whyItMatters: text(
      'Super Admin teams need one place to spot risk early, prioritize response, and route work to the right module.',
      'Zespół Super Admin potrzebuje jednego miejsca do wczesnego wykrywania ryzyk, ustawiania priorytetów i kierowania pracy do właściwego modułu.'
    ),
    whatYouDoHere: [
      text(
        'Check key platform metrics, live signals, and recent activity.',
        'Sprawdzasz kluczowe metryki platformy, sygnały live i ostatnią aktywność.'
      ),
      text(
        'Use quick actions to move into customers, revenue, and AI operations.',
        'Używasz szybkich akcji, aby przechodzić do customers, revenue i AI operations.'
      ),
      text(
        'Treat this screen as triage, not as the place for detailed execution.',
        'Traktujesz ten ekran jako triage, a nie miejsce szczegółowej realizacji działań.'
      ),
      text(
        'Review anomalies before they become customer-impacting incidents.',
        'Przeglądasz anomalie zanim staną się incydentami wpływającymi na klientów.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes platform health into an executive snapshot.',
        'Podsumowuje zdrowie platformy do formy executive snapshot.'
      ),
      text(
        'Highlights unusual patterns across usage, cost, and support signals.',
        'Wskazuje nietypowe wzorce w usage, kosztach i sygnałach supportowych.'
      ),
      text(
        'Suggests where to investigate first and which team should own the response.',
        'Sugeruje od czego zacząć analizę i który zespół powinien przejąć reakcję.'
      ),
    ],
    whatComesNext: text(
      'Move into the module that owns the issue: customers, AI, security, revenue, system, or configuration.',
      'Przejdź do modułu, który powinien obsłużyć problem: customers, AI, security, revenue, system albo configuration.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to summarize platform status',
        'Zapytaj AI o podsumowanie statusu platformy'
      ),
      prompt: text(
        'You are assisting a Super Admin on the overview screen. Summarize the current platform situation, highlight risks, and recommend the most urgent follow-up actions.',
        'Pomagasz Super Adminowi na ekranie overview. Podsumuj bieżącą sytuację platformy, wskaż ryzyka i zaproponuj najpilniejsze dalsze działania.'
      ),
    },
    quickGuides: [
      makeGuide(
        'sa-overview-1',
        text('Use the dashboard as triage', 'Używaj dashboardu jako triage'),
        text(
          'Start from signals and route work to the owning module.',
          'Zaczynaj od sygnałów i kieruj pracę do modułu właściciela.'
        )
      ),
      makeGuide(
        'sa-overview-2',
        text('Escalate with context', 'Eskaluj z kontekstem'),
        text(
          'When escalating, include customer impact, severity, and suspected owner.',
          'Przy eskalacji dołącz wpływ na klienta, severity i przypuszczalnego właściciela.'
        )
      ),
    ],
    faqs: createSuperAdminFAQs(
      'superadmin-overview',
      'superadmin',
      text('Super Admin Overview', 'Super Admin Overview')
    ),
  }),
  superadmin_customers: createSystemDoc({
    id: 'superadmin_customers',
    moduleId: 'superadmin',
    icon: 'Building2',
    title: text('Customers Module', 'Customers Module'),
    summary: text(
      'This area manages organizations, user access, feedback, and customer-side operations.',
      'Ten obszar służy do zarządzania organizacjami, dostępami użytkowników, feedbackiem i operacjami po stronie klientów.'
    ),
    whatThisIs: text(
      'Use this module when you need to inspect tenants, unblock access, review customer feedback, or run controlled bulk actions.',
      'Używaj tego modułu, gdy chcesz sprawdzić tenanty, odblokować dostęp, przejrzeć feedback klientów albo uruchomić kontrolowane operacje zbiorcze.'
    ),
    whyItMatters: text(
      'Customer administration directly affects trust, access continuity, and operational stability across organizations.',
      'Administracja klientami bezpośrednio wpływa na zaufanie, ciągłość dostępu i stabilność operacyjną organizacji.'
    ),
    whatYouDoHere: [
      text(
        'Inspect organizations, plans, states, and operational health.',
        'Przeglądasz organizacje, plany, statusy i zdrowie operacyjne.'
      ),
      text(
        'Manage user access paths, pending requests, and code-based entry flows.',
        'Zarządzasz ścieżkami dostępu użytkowników, oczekującymi wnioskami i wejściem przez kody.'
      ),
      text(
        'Review feedback and bulk actions with explicit operational care.',
        'Przeglądasz feedback i operacje zbiorcze z pełną ostrożnością operacyjną.'
      ),
      text(
        'Prefer targeted actions first; use broad actions only with clear rollback logic.',
        'Najpierw wybierasz działania punktowe; działania szerokie tylko z jasną logiką rollbacku.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes account issues and noisy customer feedback into themes.',
        'Podsumowuje problemy kont i głośny feedback klientów do spójnych tematów.'
      ),
      text(
        'Flags patterns across org status, access friction, and support pain.',
        'Wskazuje wzorce między stanem organizacji, tarciem dostępowym i bólem supportowym.'
      ),
      text(
        'Drafts safe action plans before you touch multiple customer records.',
        'Tworzy bezpieczny plan działania zanim dotkniesz wielu rekordów klientów.'
      ),
    ],
    whatComesNext: text(
      'From here you can go deeper into organizations, users, feedback, or bulk operations depending on the problem.',
      'Stąd możesz wejść głębiej w organizations, users, feedback albo bulk operations zależnie od problemu.'
    ),
    askAiNow: {
      label: text('Ask AI to assess customer operations', 'Zapytaj AI o ocenę operacji customer'),
      prompt: text(
        'You are assisting a Super Admin in the Customers module. Summarize the current operational picture, identify risky accounts or access issues, and suggest the safest next actions.',
        'Pomagasz Super Adminowi w module Customers. Podsumuj bieżący obraz operacyjny, wskaż ryzykowne konta lub problemy dostępowe i zaproponuj najbezpieczniejsze kolejne działania.'
      ),
    },
    quickGuides: [
      makeGuide(
        'sa-customers-1',
        text('Start with the affected tenant', 'Zaczynaj od tenantu dotkniętego problemem'),
        text(
          'Avoid broad action until you understand which organization is actually impacted.',
          'Nie rób szerokich zmian, dopóki nie wiesz dokładnie, która organizacja jest dotknięta problemem.'
        )
      ),
      makeGuide(
        'sa-customers-2',
        text('Prefer reversible operations', 'Preferuj działania odwracalne'),
        text(
          'If an action touches many customer records, prepare rollback logic first.',
          'Jeśli działanie dotyka wielu rekordów klientów, najpierw przygotuj logikę rollbacku.'
        )
      ),
    ],
    faqs: createSuperAdminFAQs(
      'superadmin-customers',
      'superadmin',
      text('Customers Module', 'Customers Module')
    ),
  }),
  superadmin_organizations: createSystemDoc({
    id: 'superadmin_organizations',
    moduleId: 'superadmin',
    icon: 'Building2',
    title: text('Organizations', 'Organizations'),
    summary: text(
      'This screen is used to manage tenant-level state, plan, status, and access posture.',
      'Ten ekran służy do zarządzania stanem tenantów, planem, statusem i postawą dostępową.'
    ),
    whatThisIs: text(
      'Treat this as the primary record of customer organizations in the platform.',
      'Traktuj to jako główny rejestr organizacji-klientów w platformie.'
    ),
    whyItMatters: text(
      'A bad change here can affect billing, login, usage, and support for an entire organization.',
      'Błędna zmiana tutaj może wpłynąć na billing, logowanie, usage i support całej organizacji.'
    ),
    whatYouDoHere: [
      text(
        'Review organization identity, commercial plan, status, and operational metadata.',
        'Przeglądasz tożsamość organizacji, plan komercyjny, status i metadane operacyjne.'
      ),
      text(
        'Apply controlled plan or status updates with awareness of downstream impact.',
        'Wprowadzasz kontrolowane zmiany planu lub statusu ze świadomością wpływu downstream.'
      ),
      text(
        'Use search and filters to isolate the exact tenant before editing.',
        'Używasz searcha i filtrów, aby przed edycją odizolować dokładny tenant.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains the likely impact of changing org status or plan.',
        'Wyjaśnia prawdopodobny wpływ zmiany statusu lub planu organizacji.'
      ),
      text(
        'Summarizes customer context before an intervention.',
        'Podsumowuje kontekst klienta przed interwencją.'
      ),
      text(
        'Drafts a safe change checklist for the selected tenant.',
        'Tworzy checklistę bezpiecznej zmiany dla wybranego tenantu.'
      ),
    ],
    whatComesNext: text(
      'If the issue is not tenant-wide, go next into users, billing, security, or support-specific screens.',
      'Jeśli problem nie jest tenant-wide, przejdź dalej do users, billing, security albo ekranów stricte supportowych.'
    ),
    askAiNow: {
      label: text('Ask AI to review this tenant', 'Zapytaj AI o przegląd tenantu'),
      prompt: text(
        'You are assisting a Super Admin on the Organizations screen. Review the selected organization context, explain likely risk areas, and suggest the safest change path.',
        'Pomagasz Super Adminowi na ekranie Organizations. Przejrzyj kontekst wybranej organizacji, wyjaśnij prawdopodobne obszary ryzyka i zaproponuj najbezpieczniejszą ścieżkę zmiany.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-organizations',
      'superadmin',
      text('Organizations', 'Organizations')
    ),
  }),
  superadmin_users: createSystemDoc({
    id: 'superadmin_users',
    moduleId: 'superadmin',
    icon: 'Users',
    title: text('Users', 'Users'),
    summary: text(
      'This screen manages user-level access, identity friction, and platform entry issues.',
      'Ten ekran służy do zarządzania dostępem użytkowników, tarciem tożsamościowym i problemami wejścia do platformy.'
    ),
    whatThisIs: text(
      'Use it when a problem is tied to a person, not to the whole tenant.',
      'Używaj go, gdy problem dotyczy konkretnej osoby, a nie całego tenantu.'
    ),
    whyItMatters: text(
      'User-level admin actions affect trust, compliance, and day-to-day continuity of work.',
      'Działania administracyjne na poziomie użytkownika wpływają na zaufanie, compliance i codzienną ciągłość pracy.'
    ),
    whatYouDoHere: [
      text(
        'Inspect user access state, role issues, invitation friction, and account anomalies.',
        'Sprawdzasz stan dostępu użytkownika, problemy ról, tarcie zaproszeń i anomalie konta.'
      ),
      text(
        'Differentiate between identity issues, permissions issues, and tenant issues.',
        'Rozróżniasz problemy tożsamościowe, permission issues i tenant issues.'
      ),
      text(
        'Take the minimum admin action required to restore access safely.',
        'Podejmujesz minimalne działanie administracyjne potrzebne do bezpiecznego przywrócenia dostępu.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes what type of access problem you are looking at.',
        'Podsumowuje, z jakim typem problemu dostępowego masz do czynienia.'
      ),
      text(
        'Suggests the smallest safe intervention first.',
        'Sugeruje najpierw najmniejszą bezpieczną interwencję.'
      ),
      text(
        'Drafts the communication back to the affected user or team.',
        'Przygotowuje komunikację zwrotną do dotkniętego użytkownika lub zespołu.'
      ),
    ],
    whatComesNext: text(
      'If the issue is systemic, continue in organizations, security, or SSO instead of forcing a user-level fix.',
      'Jeśli problem jest systemowy, przejdź dalej do organizations, security albo SSO zamiast wymuszać fix na poziomie użytkownika.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to diagnose access friction',
        'Zapytaj AI o diagnozę problemu dostępowego'
      ),
      prompt: text(
        'You are assisting a Super Admin on the Users screen. Diagnose the likely access issue, explain whether it is user-level or systemic, and recommend the safest next action.',
        'Pomagasz Super Adminowi na ekranie Users. Zdiagnozuj prawdopodobny problem dostępu, wyjaśnij czy jest user-level czy systemic i wskaż najbezpieczniejsze kolejne działanie.'
      ),
    },
    faqs: createSuperAdminFAQs('superadmin-users', 'superadmin', text('Users', 'Users')),
  }),
  superadmin_feedback: createSystemDoc({
    id: 'superadmin_feedback',
    moduleId: 'superadmin',
    icon: 'MessageSquareWarning',
    title: text('Feedback', 'Feedback'),
    summary: text(
      'This screen consolidates platform feedback into an operational backlog for review and routing.',
      'Ten ekran konsoliduje feedback platformowy w operacyjny backlog do przeglądu i routingu.'
    ),
    whatThisIs: text(
      'Use it to classify product pain, recurring support issues, and signals worth escalation.',
      'Używaj go do klasyfikowania bólu produktowego, powracających problemów supportowych i sygnałów wartych eskalacji.'
    ),
    whyItMatters: text(
      'Good feedback management reduces noise and helps separate one-off complaints from real product patterns.',
      'Dobre zarządzanie feedbackiem redukuje szum i pomaga oddzielić jednorazowe skargi od realnych wzorców produktowych.'
    ),
    whatYouDoHere: [
      text(
        'Review incoming feedback by severity, topic, and customer impact.',
        'Przeglądasz feedback według severity, tematu i wpływu na klienta.'
      ),
      text(
        'Route issues to the right owner instead of treating every item as a platform incident.',
        'Kierujesz zgłoszenia do właściwego właściciela zamiast traktować każde jako incydent platformowy.'
      ),
      text(
        'Look for repetition before escalating to engineering or product.',
        'Szukasz powtarzalności zanim eskalujesz do engineeringu lub produktu.'
      ),
    ],
    howAiHelpsHere: [
      text('Clusters noisy feedback into themes.', 'Grupuje szum feedbackowy w spójne tematy.'),
      text(
        'Flags repeated pain points and likely root causes.',
        'Wskazuje powtarzalne punkty bólu i prawdopodobne root cause.'
      ),
      text('Drafts concise escalation summaries.', 'Tworzy zwięzłe podsumowania do eskalacji.'),
    ],
    whatComesNext: text(
      'Escalate validated themes into the owning superadmin domain: customers, AI, security, system, or content.',
      'Eskaluj zwalidowane tematy do odpowiedniej domeny superadmin: customers, AI, security, system albo content.'
    ),
    askAiNow: {
      label: text('Ask AI to cluster feedback', 'Zapytaj AI o klastrowanie feedbacku'),
      prompt: text(
        'You are assisting a Super Admin on the Feedback screen. Cluster the current feedback, identify the loudest themes, and suggest the correct owner for each.',
        'Pomagasz Super Adminowi na ekranie Feedback. Pogrupuj bieżący feedback, wskaż najgłośniejsze tematy i zaproponuj właściwego właściciela dla każdego z nich.'
      ),
    },
    faqs: createSuperAdminFAQs('superadmin-feedback', 'superadmin', text('Feedback', 'Feedback')),
  }),
  superadmin_bulk_operations: createSystemDoc({
    id: 'superadmin_bulk_operations',
    moduleId: 'superadmin',
    icon: 'Layers3',
    title: text('Bulk Operations', 'Bulk Operations'),
    summary: text(
      'This screen is for high-leverage actions that can touch many records or many tenants at once.',
      'Ten ekran służy do działań o dużej dźwigni, które mogą dotknąć wielu rekordów lub tenantów jednocześnie.'
    ),
    whatThisIs: text(
      'Use it only when targeted actions are too slow and the operational pattern is already understood.',
      'Używaj go tylko wtedy, gdy działania punktowe są zbyt wolne, a wzorzec operacyjny jest już dobrze zrozumiany.'
    ),
    whyItMatters: text(
      'Bulk actions save time but amplify mistakes. Safety and validation matter more here than speed.',
      'Operacje zbiorcze oszczędzają czas, ale wzmacniają błędy. Tutaj bezpieczeństwo i walidacja są ważniejsze niż szybkość.'
    ),
    whatYouDoHere: [
      text(
        'Define exact scope before any batch action.',
        'Definiujesz dokładny zakres przed każdą akcją batchową.'
      ),
      text(
        'Use dry-run logic or preview whenever possible.',
        'Używasz dry-run albo preview wszędzie, gdzie to możliwe.'
      ),
      text(
        'Run changes in controlled waves and verify results after each one.',
        'Uruchamiasz zmiany w kontrolowanych falach i weryfikujesz wyniki po każdej z nich.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes scope and likely downstream impact.',
        'Podsumowuje zakres i prawdopodobny wpływ downstream.'
      ),
      text(
        'Points out risky segments inside the batch.',
        'Wskazuje ryzykowne segmenty wewnątrz batcha.'
      ),
      text(
        'Drafts a pre-flight checklist and rollback considerations.',
        'Tworzy checklistę pre-flight i uwagi do rollbacku.'
      ),
    ],
    whatComesNext: text(
      'After a batch action, validate outcomes in the owning operational module and review customer-facing impact.',
      'Po batchu zwaliduj wyniki w module właściciela operacyjnego i sprawdź wpływ customer-facing.'
    ),
    askAiNow: {
      label: text('Ask AI to review this batch action', 'Zapytaj AI o przegląd batch action'),
      prompt: text(
        'You are assisting a Super Admin on the Bulk Operations screen. Review the planned scope, identify the riskiest parts, and produce a safe execution checklist.',
        'Pomagasz Super Adminowi na ekranie Bulk Operations. Przejrzyj planowany zakres, wskaż najbardziej ryzykowne elementy i przygotuj bezpieczną checklistę wykonania.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-bulk-ops',
      'superadmin',
      text('Bulk Operations', 'Bulk Operations')
    ),
  }),
  superadmin_ai_configuration: createSystemDoc({
    id: 'superadmin_ai_configuration',
    moduleId: 'superadmin_ai_infrastructure',
    icon: 'Cpu',
    title: text('AI Configuration', 'AI Configuration'),
    summary: text(
      'This screen defines how the platform selects models, tiers, routes, limits, and global AI behavior.',
      'Ten ekran definiuje sposób wyboru modeli, tierów, routingu, limitów i globalnego zachowania AI na platformie.'
    ),
    whatThisIs: text(
      'Treat this as the control surface for production AI architecture.',
      'Traktuj to jako powierzchnię sterowania architekturą AI na produkcji.'
    ),
    whyItMatters: text(
      'Changes here affect quality, cost, latency, resilience, and compliance across the whole platform.',
      'Zmiany tutaj wpływają na jakość, koszt, opóźnienie, odporność i compliance w całej platformie.'
    ),
    whatYouDoHere: [
      text(
        'Manage providers, model tiers, routing rules, and global defaults.',
        'Zarządzasz providerami, model tiers, routing rules i globalnymi domyślnymi ustawieniami.'
      ),
      text(
        'Validate fallback chains and avoid accidental quality regressions.',
        'Walidujesz fallback chains i unikasz przypadkowych regresji jakości.'
      ),
      text(
        'Change one dimension at a time: provider, tier, route, or policy.',
        'Zmieniasz jedną warstwę naraz: provider, tier, route albo policy.'
      ),
      text(
        'Document why a change was made, not only what changed.',
        'Dokumentujesz nie tylko co się zmieniło, ale też dlaczego.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains trade-offs between quality, cost, and latency.',
        'Wyjaśnia kompromisy między jakością, kosztem i opóźnieniem.'
      ),
      text(
        'Summarizes routing complexity into clear recommendations.',
        'Podsumowuje złożoność routingu w jasne rekomendacje.'
      ),
      text(
        'Helps draft rollback and verification steps before a production change.',
        'Pomaga przygotować rollback i kroki weryfikacji przed zmianą produkcyjną.'
      ),
    ],
    whatComesNext: text(
      'After changing configuration, validate impact in AI operations and AI analytics before broad rollout.',
      'Po zmianie konfiguracji zweryfikuj wpływ w AI operations i AI analytics zanim zrobisz szeroki rollout.'
    ),
    askAiNow: {
      label: text('Ask AI to review AI configuration', 'Zapytaj AI o przegląd konfiguracji AI'),
      prompt: text(
        'You are assisting a Super Admin on the AI Configuration screen. Review the current AI setup, explain the main trade-offs, and recommend the safest next optimization or correction.',
        'Pomagasz Super Adminowi na ekranie AI Configuration. Przejrzyj bieżący setup AI, wyjaśnij główne kompromisy i zaproponuj najbezpieczniejszą kolejną optymalizację lub korektę.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-ai-config',
      'superadmin_ai_infrastructure',
      text('AI Configuration', 'AI Configuration')
    ),
  }),
  superadmin_ai_development: createSystemDoc({
    id: 'superadmin_ai_development',
    moduleId: 'superadmin_ai_development',
    icon: 'Sparkles',
    title: text('AI Development', 'AI Development'),
    summary: text(
      'This area governs prompts, experiments, model registry, and the way AI behavior evolves safely.',
      'Ten obszar odpowiada za prompty, eksperymenty, model registry i sposób bezpiecznej ewolucji zachowania AI.'
    ),
    whatThisIs: text(
      'Use it to shape AI behavior deliberately instead of letting changes drift through the system.',
      'Używaj go do świadomego kształtowania zachowania AI zamiast pozwalania na dryf zmian w systemie.'
    ),
    whyItMatters: text(
      'Prompt and model changes can silently alter product behavior. Governance here protects quality and trust.',
      'Zmiany promptów i modeli mogą cicho zmieniać zachowanie produktu. Governance w tym miejscu chroni jakość i zaufanie.'
    ),
    whatYouDoHere: [
      text(
        'Manage prompts, experiments, model registry, and AI intelligence tooling.',
        'Zarządzasz promptami, eksperymentami, model registry i narzędziami AI intelligence.'
      ),
      text(
        'Introduce changes through comparison, not intuition only.',
        'Wprowadzasz zmiany przez porównanie, a nie tylko intuicję.'
      ),
      text(
        'Track intent, expected effect, and rollback path for each change.',
        'Śledzisz intencję, oczekiwany efekt i rollback path dla każdej zmiany.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Compares prompt variants and identifies likely behavior drift.',
        'Porównuje warianty promptów i wskazuje prawdopodobny behavior drift.'
      ),
      text(
        'Summarizes experiment outcomes and unexpected side effects.',
        'Podsumowuje wyniki eksperymentów i nieoczekiwane skutki uboczne.'
      ),
      text(
        'Drafts cleaner prompt instructions and evaluation criteria.',
        'Przygotowuje czystsze instrukcje promptowe i kryteria oceny.'
      ),
    ],
    whatComesNext: text(
      'After development changes, validate them in AI operations and analytics before treating them as production-safe.',
      'Po zmianach rozwojowych zweryfikuj je w AI operations i analytics zanim uznasz je za production-safe.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review prompt and model changes',
        'Zapytaj AI o przegląd zmian promptów i modeli'
      ),
      prompt: text(
        'You are assisting a Super Admin in AI Development. Review the current prompt or model changes, explain likely impact, and recommend the safest validation path.',
        'Pomagasz Super Adminowi w AI Development. Przejrzyj bieżące zmiany promptów lub modeli, wyjaśnij prawdopodobny wpływ i zaproponuj najbezpieczniejszą ścieżkę walidacji.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-ai-development',
      'superadmin_ai_development',
      text('AI Development', 'AI Development')
    ),
  }),
  superadmin_ai_operations: createSystemDoc({
    id: 'superadmin_ai_operations',
    moduleId: 'superadmin_ai_operations',
    icon: 'Activity',
    title: text('AI Operations', 'AI Operations'),
    summary: text(
      'This screen is for uptime, incidents, provider health, performance, costs, and operational AI stability.',
      'Ten ekran służy do uptime, incydentów, zdrowia providerów, wydajności, kosztów i stabilności operacyjnej AI.'
    ),
    whatThisIs: text(
      'Use it as the mission control for live AI behavior in production.',
      'Używaj go jako mission control dla żywego zachowania AI na produkcji.'
    ),
    whyItMatters: text(
      'When AI degrades, customers feel it quickly. Fast detection and controlled response are critical.',
      'Gdy AI degraduje, klienci czują to szybko. Krytyczne są szybkie wykrycie i kontrolowana reakcja.'
    ),
    whatYouDoHere: [
      text(
        'Monitor health, performance, error patterns, and spend.',
        'Monitorujesz health, performance, wzorce błędów i wydatki.'
      ),
      text(
        'Differentiate temporary provider noise from structural platform risk.',
        'Rozróżniasz chwilowy szum providera od strukturalnego ryzyka platformy.'
      ),
      text(
        'Use operations data to validate recent config or prompt changes.',
        'Używasz danych operacyjnych do walidacji ostatnich zmian konfiguracji albo promptów.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Detects abnormal patterns in latency, failures, or spend.',
        'Wykrywa nietypowe wzorce w opóźnieniach, błędach albo kosztach.'
      ),
      text(
        'Summarizes incidents into likely root causes.',
        'Podsumowuje incydenty do prawdopodobnych root cause.'
      ),
      text(
        'Suggests the most targeted mitigation first.',
        'Sugeruje najpierw najbardziej punktową formę mitigacji.'
      ),
    ],
    whatComesNext: text(
      'Use the signal here to decide whether to intervene in configuration, development, security, or customer operations.',
      'Użyj sygnałów stąd, aby zdecydować czy interweniować w configuration, development, security albo customer operations.'
    ),
    askAiNow: {
      label: text('Ask AI to diagnose AI operations', 'Zapytaj AI o diagnozę AI operations'),
      prompt: text(
        'You are assisting a Super Admin in AI Operations. Review the current health and incident signals, identify the likeliest root causes, and recommend the safest mitigation path.',
        'Pomagasz Super Adminowi w AI Operations. Przejrzyj bieżące sygnały health i incident, wskaż najbardziej prawdopodobne root cause i zaproponuj najbezpieczniejszą ścieżkę mitigacji.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-ai-operations',
      'superadmin_ai_operations',
      text('AI Operations', 'AI Operations')
    ),
  }),
  superadmin_ai_knowledge: createSystemDoc({
    id: 'superadmin_ai_knowledge',
    moduleId: 'superadmin_ai_development',
    icon: 'BookOpen',
    title: text('AI Knowledge', 'AI Knowledge'),
    summary: text(
      'This area manages what knowledge AI can see, trust, and use across the platform.',
      'Ten obszar zarządza tym, jaką wiedzę AI może widzieć, ufać jej i używać w całej platformie.'
    ),
    whatThisIs: text(
      'Use it to curate knowledge sources, documents, and strategic guidance used by AI systems.',
      'Używaj go do kuracji źródeł wiedzy, dokumentów i strategic guidance używanych przez systemy AI.'
    ),
    whyItMatters: text(
      'Poor knowledge hygiene creates hallucination risk, stale answers, and low operator trust.',
      'Słaba higiena wiedzy zwiększa ryzyko halucynacji, przestarzałych odpowiedzi i spadku zaufania operatorów.'
    ),
    whatYouDoHere: [
      text(
        'Review source quality, freshness, and scope.',
        'Przeglądasz jakość, świeżość i zakres źródeł.'
      ),
      text(
        'Separate strategic knowledge from noisy or low-trust documents.',
        'Oddzielasz wiedzę strategiczną od szumu i dokumentów o niskim zaufaniu.'
      ),
      text(
        'Treat knowledge changes as behavioral changes for AI.',
        'Traktujesz zmiany wiedzy jako zmiany zachowania AI.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes gaps and duplication inside the knowledge base.',
        'Podsumowuje luki i duplikację w knowledge base.'
      ),
      text(
        'Flags stale documents and low-value sources.',
        'Wskazuje przestarzałe dokumenty i źródła o niskiej wartości.'
      ),
      text(
        'Drafts curation priorities for knowledge cleanup.',
        'Przygotowuje priorytety kuracji do cleanupu wiedzy.'
      ),
    ],
    whatComesNext: text(
      'After a knowledge update, validate impact on AI answer quality and downstream usage patterns.',
      'Po aktualizacji wiedzy zweryfikuj wpływ na jakość odpowiedzi AI i downstream usage patterns.'
    ),
    askAiNow: {
      label: text('Ask AI to review knowledge quality', 'Zapytaj AI o przegląd jakości wiedzy'),
      prompt: text(
        'You are assisting a Super Admin in AI Knowledge. Review the current knowledge sources, identify quality risks or duplication, and recommend the highest-value cleanup actions.',
        'Pomagasz Super Adminowi w AI Knowledge. Przejrzyj bieżące źródła wiedzy, wskaż ryzyka jakości lub duplikację i zaproponuj działania cleanupowe o najwyższej wartości.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-ai-knowledge',
      'superadmin_ai_development',
      text('AI Knowledge', 'AI Knowledge')
    ),
  }),
  superadmin_system: createSystemDoc({
    id: 'superadmin_system',
    moduleId: 'superadmin',
    icon: 'ServerCog',
    title: text('System Module', 'System Module'),
    summary: text(
      'This module is for platform infrastructure health, internal controls, and operational backbone settings.',
      'Ten moduł służy do zdrowia infrastruktury platformy, kontroli wewnętrznych i ustawień szkieletu operacyjnego.'
    ),
    whatThisIs: text(
      'Use it when the issue is platform-wide and not tied only to customers, billing, or AI logic.',
      'Używaj go, gdy problem jest platform-wide i nie dotyczy wyłącznie customers, billingu albo logiki AI.'
    ),
    whyItMatters: text(
      'System-level mistakes can create invisible instability that later shows up as support pain or product incidents.',
      'Błędy na poziomie systemowym mogą tworzyć niewidoczną niestabilność, która później objawi się jako ból supportowy albo incydenty produktowe.'
    ),
    whatYouDoHere: [
      text(
        'Monitor system health and configuration-level controls.',
        'Monitorujesz system health i kontrolki konfiguracyjne wysokiego poziomu.'
      ),
      text(
        'Use auditability and observability before changing internals.',
        'Korzystasz z auditability i observability zanim zmienisz internals.'
      ),
      text(
        'Coordinate with owning teams when the issue crosses domains.',
        'Koordynujesz się z zespołami właścicielskimi, gdy problem przekracza domeny.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes operational system signals into probable failure zones.',
        'Podsumowuje sygnały systemowe do prawdopodobnych stref awarii.'
      ),
      text('Suggests where to verify first.', 'Sugeruje od czego zacząć weryfikację.'),
      text(
        'Drafts an investigation sequence instead of random checks.',
        'Tworzy sekwencję dochodzenia zamiast losowych sprawdzeń.'
      ),
    ],
    whatComesNext: text(
      'Validate whether the signal belongs to system, AI, security, or customer operations before making a change.',
      'Zweryfikuj czy sygnał należy do system, AI, security czy customer operations zanim wykonasz zmianę.'
    ),
    askAiNow: {
      label: text('Ask AI to review system risk', 'Zapytaj AI o przegląd ryzyka systemowego'),
      prompt: text(
        'You are assisting a Super Admin in the System module. Summarize the current system-level risks and recommend the most efficient investigation path.',
        'Pomagasz Super Adminowi w module System. Podsumuj bieżące ryzyka systemowe i zaproponuj najefektywniejszą ścieżkę dochodzenia.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-system',
      'superadmin',
      text('System Module', 'System Module')
    ),
  }),
  superadmin_content: createSystemDoc({
    id: 'superadmin_content',
    moduleId: 'superadmin',
    icon: 'Files',
    title: text('Content Module', 'Content Module'),
    summary: text(
      'This module manages reusable platform content such as playbooks and templates.',
      'Ten moduł zarządza wielokrotnego użytku treściami platformowymi, takimi jak playbooki i template’y.'
    ),
    whatThisIs: text(
      'Use it to keep guidance content consistent, current, and operationally safe.',
      'Używaj go do utrzymania guidance content jako spójnego, aktualnego i bezpiecznego operacyjnie.'
    ),
    whyItMatters: text(
      'Bad platform content scales mistakes fast because many users consume it at once.',
      'Zła treść platformowa skaluje błędy bardzo szybko, bo wielu użytkowników konsumuje ją jednocześnie.'
    ),
    whatYouDoHere: [
      text(
        'Manage playbooks, templates, and communication content.',
        'Zarządzasz playbookami, template’ami i treściami komunikacyjnymi.'
      ),
      text(
        'Check consistency before publishing changes widely.',
        'Sprawdzasz spójność zanim szeroko opublikujesz zmiany.'
      ),
      text(
        'Treat content updates as product updates with operational impact.',
        'Traktujesz aktualizacje treści jak zmiany produktowe o wpływie operacyjnym.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes where content is inconsistent or outdated.',
        'Podsumowuje miejsca niespójności i przestarzałych treści.'
      ),
      text(
        'Drafts clearer operator-facing instructions.',
        'Tworzy jaśniejsze instrukcje dla operatorów.'
      ),
      text(
        'Suggests safer wording for production guidance.',
        'Sugeruje bezpieczniejsze sformułowania dla guidance produkcyjnego.'
      ),
    ],
    whatComesNext: text(
      'After a content update, validate affected flows in help, onboarding, or operator training.',
      'Po aktualizacji treści zweryfikuj dotknięte flow w helpie, onboardingu albo szkoleniu operatorów.'
    ),
    askAiNow: {
      label: text('Ask AI to review content quality', 'Zapytaj AI o przegląd jakości treści'),
      prompt: text(
        'You are assisting a Super Admin in the Content module. Review the current content setup, identify outdated or risky guidance, and recommend the most important updates.',
        'Pomagasz Super Adminowi w module Content. Przejrzyj bieżący układ treści, wskaż przestarzałe lub ryzykowne guidance i zaproponuj najważniejsze aktualizacje.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-content',
      'superadmin',
      text('Content Module', 'Content Module')
    ),
  }),
  superadmin_playbook_templates: createSystemDoc({
    id: 'superadmin_playbook_templates',
    moduleId: 'superadmin',
    icon: 'ListChecks',
    title: text('Playbook Templates', 'Playbook Templates'),
    summary: text(
      'This screen manages reusable operational playbooks used for onboarding, guidance, or structured execution.',
      'Ten ekran zarządza wielokrotnego użytku playbookami operacyjnymi wykorzystywanymi w onboardingu, guidance albo uporządkowanej realizacji.'
    ),
    whatThisIs: text(
      'Use it as the library of approved patterns, not as a place for ad-hoc experiments.',
      'Używaj go jako biblioteki zatwierdzonych wzorców, a nie miejsca na ad-hoc eksperymenty.'
    ),
    whyItMatters: text(
      'Playbooks encode how people work. Weak templates scale weak operational behavior.',
      'Playbooki kodują sposób pracy ludzi. Słabe template’y skalują słabe zachowania operacyjne.'
    ),
    whatYouDoHere: [
      text(
        'Review template quality and target audience fit.',
        'Przeglądasz jakość template’ów i dopasowanie do grupy odbiorców.'
      ),
      text(
        'Keep naming, scope, and outcome definition consistent.',
        'Utrzymujesz spójne nazewnictwo, zakres i definicję wyniku.'
      ),
      text(
        'Prefer versioning and review instead of silent edits.',
        'Preferujesz wersjonowanie i review zamiast cichych zmian.'
      ),
    ],
    howAiHelpsHere: [
      text('Summarizes overlap between templates.', 'Podsumowuje nakładanie się template’ów.'),
      text(
        'Suggests simplification where playbooks are too long or noisy.',
        'Sugeruje uproszczenia tam, gdzie playbooki są zbyt długie albo głośne.'
      ),
      text('Drafts concise operator instructions.', 'Tworzy zwięzłe instrukcje dla operatorów.'),
    ],
    whatComesNext: text(
      'When a template needs structural change, continue into the editor and validate the flow before publishing.',
      'Gdy template wymaga zmiany strukturalnej, przejdź do edytora i zwaliduj flow przed publikacją.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review this playbook library',
        'Zapytaj AI o przegląd biblioteki playbooków'
      ),
      prompt: text(
        'You are assisting a Super Admin on the Playbook Templates screen. Review the template set, identify duplication or weak flows, and suggest the highest-value cleanup actions.',
        'Pomagasz Super Adminowi na ekranie Playbook Templates. Przejrzyj zestaw template’ów, wskaż duplikację albo słabe flow i zaproponuj działania cleanupowe o najwyższej wartości.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-playbook-templates',
      'superadmin',
      text('Playbook Templates', 'Playbook Templates')
    ),
  }),
  superadmin_playbook_editor: createSystemDoc({
    id: 'superadmin_playbook_editor',
    moduleId: 'superadmin',
    icon: 'FilePenLine',
    title: text('Playbook Editor', 'Playbook Editor'),
    summary: text(
      'This screen is for editing a playbook structure, steps, guidance, and expected operator path.',
      'Ten ekran służy do edycji struktury playbooka, kroków, guidance i oczekiwanej ścieżki operatora.'
    ),
    whatThisIs: text(
      'Treat the editor as workflow design, not just content editing.',
      'Traktuj edytor jako projektowanie workflow, a nie tylko edycję tekstu.'
    ),
    whyItMatters: text(
      'If a playbook is structurally unclear, operators will either ignore it or execute it inconsistently.',
      'Jeśli playbook jest strukturalnie niejasny, operatorzy albo go zignorują, albo wykonają niespójnie.'
    ),
    whatYouDoHere: [
      text(
        'Edit sequence, logic, wording, and expected operator actions.',
        'Edytujesz sekwencję, logikę, wording i oczekiwane działania operatora.'
      ),
      text(
        'Keep each step short, specific, and outcome-driven.',
        'Utrzymujesz każdy krok jako krótki, konkretny i zorientowany na wynik.'
      ),
      text(
        'Validate usability before publishing to live users.',
        'Walidujesz użyteczność zanim opublikujesz do live users.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Rewrites verbose steps into clearer operator language.',
        'Przepisuje rozwlekłe kroki na jaśniejszy język operatora.'
      ),
      text(
        'Spots missing transitions or confusing sequences.',
        'Wychwytuje brakujące przejścia albo mylące sekwencje.'
      ),
      text(
        'Suggests cleaner CTA wording and safer action framing.',
        'Sugeruje czystsze CTA i bezpieczniejsze ramowanie akcji.'
      ),
    ],
    whatComesNext: text(
      'After editing, verify the playbook in the template list and in the real operator flow it is supposed to support.',
      'Po edycji zweryfikuj playbook na liście template’ów i w realnym flow operatora, który ma wspierać.'
    ),
    askAiNow: {
      label: text('Ask AI to review this playbook flow', 'Zapytaj AI o przegląd flow playbooka'),
      prompt: text(
        'You are assisting a Super Admin in the Playbook Editor. Review this playbook structure, identify unclear steps or transitions, and suggest a cleaner operator flow.',
        'Pomagasz Super Adminowi w Playbook Editor. Przejrzyj strukturę playbooka, wskaż niejasne kroki lub przejścia i zaproponuj czystszy flow operatora.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-playbook-editor',
      'superadmin',
      text('Playbook Editor', 'Playbook Editor')
    ),
  }),
  superadmin_revenue: createSystemDoc({
    id: 'superadmin_revenue',
    moduleId: 'superadmin',
    icon: 'BadgeDollarSign',
    title: text('Revenue Module', 'Revenue Module'),
    summary: text(
      'This module manages commercial performance, billing flows, invoices, and revenue-side visibility.',
      'Ten moduł służy do zarządzania wynikami komercyjnymi, billing flows, fakturami i widocznością po stronie revenue.'
    ),
    whatThisIs: text(
      'Use it when the issue is tied to money flow, plans, invoices, or subscription behavior.',
      'Używaj go, gdy problem dotyczy przepływu pieniędzy, planów, faktur albo zachowania subskrypcji.'
    ),
    whyItMatters: text(
      'Revenue-side errors affect finance, trust, and commercial continuity across customers.',
      'Błędy po stronie revenue wpływają na finanse, zaufanie i ciągłość komercyjną klientów.'
    ),
    whatYouDoHere: [
      text(
        'Inspect billing state, invoice flow, plan transitions, and commercial anomalies.',
        'Sprawdzasz billing state, invoice flow, zmiany planów i anomalie komercyjne.'
      ),
      text(
        'Separate reporting issues from actual financial state issues.',
        'Oddzielasz problemy raportowe od realnych problemów stanu finansowego.'
      ),
      text(
        'Verify customer impact before changing financial state.',
        'Przed zmianą stanu finansowego weryfikujesz wpływ na klienta.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes commercial anomalies and likely causes.',
        'Podsumowuje anomalie komercyjne i prawdopodobne przyczyny.'
      ),
      text(
        'Highlights risky accounts, transitions, or invoice inconsistencies.',
        'Wskazuje ryzykowne konta, zmiany planów albo niespójności faktur.'
      ),
      text(
        'Drafts investigation notes for finance or operations teams.',
        'Tworzy notatki dochodzeniowe dla zespołów finance albo operations.'
      ),
    ],
    whatComesNext: text(
      'Go deeper into billing or invoices depending on whether the issue is subscription-state or document-state.',
      'Wejdź głębiej w billing albo invoices zależnie od tego, czy problem dotyczy stanu subskrypcji czy dokumentów.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review revenue operations',
        'Zapytaj AI o przegląd revenue operations'
      ),
      prompt: text(
        'You are assisting a Super Admin in the Revenue module. Review the current commercial state, identify suspicious patterns, and recommend the safest next checks or corrections.',
        'Pomagasz Super Adminowi w module Revenue. Przejrzyj bieżący stan komercyjny, wskaż podejrzane wzorce i zaproponuj najbezpieczniejsze kolejne kontrole lub korekty.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-revenue',
      'superadmin',
      text('Revenue Module', 'Revenue Module')
    ),
  }),
  superadmin_billing: createSystemDoc({
    id: 'superadmin_billing',
    moduleId: 'superadmin',
    icon: 'CreditCard',
    title: text('Billing', 'Billing'),
    summary: text(
      'This screen manages subscription and billing state for customers and plans.',
      'Ten ekran służy do zarządzania stanem subskrypcji i billingu klientów oraz planów.'
    ),
    whatThisIs: text(
      'Use it when you need to understand or correct the financial status tied to a customer account.',
      'Używaj go, gdy chcesz zrozumieć albo skorygować stan finansowy powiązany z kontem klienta.'
    ),
    whyItMatters: text(
      'Billing changes can impact access, trust, and revenue recognition at once.',
      'Zmiany billingowe mogą jednocześnie wpływać na dostęp, zaufanie i rozpoznanie przychodu.'
    ),
    whatYouDoHere: [
      text(
        'Inspect current billing state before making any change.',
        'Przed zmianą sprawdzasz aktualny stan billingu.'
      ),
      text(
        'Verify whether the issue is configuration, plan state, or downstream payment handling.',
        'Weryfikujesz, czy problem dotyczy konfiguracji, stanu planu czy downstream payment handling.'
      ),
      text(
        'Apply corrections with clear auditability.',
        'Wprowadzasz korekty z pełną audytowalnością.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains the likely billing state issue in plain language.',
        'Wyjaśnia prawdopodobny problem billingowy prostym językiem.'
      ),
      text(
        'Summarizes inconsistencies between plan, usage, and payments.',
        'Podsumowuje niespójności między planem, usage i płatnościami.'
      ),
      text(
        'Suggests the lowest-risk correction path.',
        'Sugeruje ścieżkę korekty o najniższym ryzyku.'
      ),
    ],
    whatComesNext: text(
      'If the issue is document-specific, continue into invoices; if systemic, validate broader revenue and customer state.',
      'Jeśli problem dotyczy dokumentów, przejdź dalej do invoices; jeśli jest systemowy, zweryfikuj szerszy stan revenue i customers.'
    ),
    askAiNow: {
      label: text('Ask AI to review billing state', 'Zapytaj AI o przegląd billing state'),
      prompt: text(
        'You are assisting a Super Admin on the Billing screen. Review the current billing state, explain inconsistencies, and recommend the safest next correction path.',
        'Pomagasz Super Adminowi na ekranie Billing. Przejrzyj bieżący billing state, wyjaśnij niespójności i zaproponuj najbezpieczniejszą ścieżkę korekty.'
      ),
    },
    faqs: createSuperAdminFAQs('superadmin-billing', 'superadmin', text('Billing', 'Billing')),
  }),
  superadmin_invoices: createSystemDoc({
    id: 'superadmin_invoices',
    moduleId: 'superadmin',
    icon: 'ReceiptText',
    title: text('Invoices', 'Invoices'),
    summary: text(
      'This screen manages invoice records, document correctness, and finance-facing communication artifacts.',
      'Ten ekran służy do zarządzania rekordami faktur, poprawnością dokumentów i artefaktami komunikacji dla finansów.'
    ),
    whatThisIs: text(
      'Use it when the issue is tied to the document itself, its lifecycle, or its financial traceability.',
      'Używaj go, gdy problem dotyczy samego dokumentu, jego cyklu życia albo ścieżki finansowej.'
    ),
    whyItMatters: text(
      'Invoice mistakes create trust and compliance issues quickly, even if the underlying billing logic is correct.',
      'Błędy faktur szybko tworzą problemy zaufania i compliance, nawet jeśli logika billingu jest poprawna.'
    ),
    whatYouDoHere: [
      text(
        'Review invoice data, state transitions, and traceability.',
        'Przeglądasz dane faktury, przejścia stanu i traceability.'
      ),
      text(
        'Check whether the issue is generation, correction, or delivery.',
        'Sprawdzasz czy problem dotyczy generacji, korekty czy dostarczenia.'
      ),
      text(
        'Keep finance-grade accuracy over speed.',
        'Stawiasz dokładność klasy finansowej ponad szybkość.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes what is inconsistent in the invoice flow.',
        'Podsumowuje co jest niespójne w invoice flow.'
      ),
      text(
        'Distinguishes likely document error from billing-state error.',
        'Rozróżnia prawdopodobny błąd dokumentu od błędu billing-state.'
      ),
      text(
        'Prepares a clean issue summary for finance follow-up.',
        'Przygotowuje czyste podsumowanie problemu do dalszej pracy finansowej.'
      ),
    ],
    whatComesNext: text(
      'Validate whether the correction belongs only to invoices or also requires billing or customer-state updates.',
      'Zweryfikuj, czy korekta dotyczy tylko invoices, czy wymaga też aktualizacji billing lub customer-state.'
    ),
    askAiNow: {
      label: text('Ask AI to review invoice issues', 'Zapytaj AI o przegląd problemów z fakturą'),
      prompt: text(
        'You are assisting a Super Admin on the Invoices screen. Review the current invoice issue, identify whether the problem is document or billing related, and recommend the safest next action.',
        'Pomagasz Super Adminowi na ekranie Invoices. Przejrzyj bieżący problem faktury, wskaż czy dotyczy dokumentu czy billingu i zaproponuj najbezpieczniejsze kolejne działanie.'
      ),
    },
    faqs: createSuperAdminFAQs('superadmin-invoices', 'superadmin', text('Invoices', 'Invoices')),
  }),
  superadmin_security: createSystemDoc({
    id: 'superadmin_security',
    moduleId: 'superadmin',
    icon: 'ShieldCheck',
    title: text('Security Module', 'Security Module'),
    summary: text(
      'This module governs identity, API access, policies, and compliance-related controls.',
      'Ten moduł odpowiada za tożsamość, dostęp API, polityki i kontrolki związane z compliance.'
    ),
    whatThisIs: text(
      'Use it when a platform issue affects trust boundaries, policy enforcement, or access control posture.',
      'Używaj go, gdy problem platformowy dotyczy granic zaufania, egzekwowania polityk albo postawy kontroli dostępu.'
    ),
    whyItMatters: text(
      'Security work protects customers and the platform itself, so false certainty is dangerous here.',
      'Praca security chroni klientów i samą platformę, więc fałszywa pewność jest tutaj szczególnie niebezpieczna.'
    ),
    whatYouDoHere: [
      text(
        'Manage identity entry points, policies, API surface, and compliance follow-up.',
        'Zarządzasz punktami wejścia tożsamości, politykami, powierzchnią API i follow-upem compliance.'
      ),
      text('Prefer evidence before intervention.', 'Przed interwencją preferujesz dowody.'),
      text(
        'Keep a clear audit trail for any material change.',
        'Dla każdej istotnej zmiany utrzymujesz jasny audit trail.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes risk signals and likely control gaps.',
        'Podsumowuje sygnały ryzyka i prawdopodobne luki kontrolne.'
      ),
      text(
        'Helps classify whether the issue is identity, policy, API, or compliance.',
        'Pomaga sklasyfikować czy problem dotyczy identity, policy, API czy compliance.'
      ),
      text(
        'Drafts safer review checklists before a change is made.',
        'Tworzy bezpieczniejsze checklisty review zanim wprowadzisz zmianę.'
      ),
    ],
    whatComesNext: text(
      'Go deeper into SSO, policies, API management, or compliance depending on the exact control surface involved.',
      'Wejdź głębiej w SSO, policies, API management albo compliance zależnie od dokładnej surface kontroli.'
    ),
    askAiNow: {
      label: text('Ask AI to review security posture', 'Zapytaj AI o przegląd security posture'),
      prompt: text(
        'You are assisting a Super Admin in the Security module. Review the current security context, classify the control area involved, and recommend the safest next verification path.',
        'Pomagasz Super Adminowi w module Security. Przejrzyj bieżący kontekst bezpieczeństwa, sklasyfikuj obszar kontroli i zaproponuj najbezpieczniejszą kolejną ścieżkę weryfikacji.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-security',
      'superadmin',
      text('Security Module', 'Security Module')
    ),
  }),
  superadmin_sso: createSystemDoc({
    id: 'superadmin_sso',
    moduleId: 'superadmin',
    icon: 'KeyRound',
    title: text('SSO Configuration', 'SSO Configuration'),
    summary: text(
      'This screen manages SSO entry configuration and identity trust setup for organizations.',
      'Ten ekran zarządza konfiguracją wejścia SSO i ustawieniem zaufania tożsamości dla organizacji.'
    ),
    whatThisIs: text(
      'Use it to configure how external identity providers connect to platform access.',
      'Używaj go do konfiguracji sposobu, w jaki zewnętrzni dostawcy tożsamości łączą się z dostępem do platformy.'
    ),
    whyItMatters: text(
      'SSO mistakes can lock people out or over-permit access, so changes need slow, verified handling.',
      'Błędy SSO mogą zablokować ludziom dostęp albo nadmiernie go otworzyć, więc zmiany wymagają spokojnego i zweryfikowanego działania.'
    ),
    whatYouDoHere: [
      text(
        'Review provider configuration and trust assumptions carefully.',
        'Uważnie przeglądasz konfigurację providera i założenia zaufania.'
      ),
      text(
        'Validate mapping and entry behavior before rollout.',
        'Walidujesz mapping i zachowanie wejścia przed rolloutem.'
      ),
      text(
        'Change authentication settings with an explicit fallback plan.',
        'Zmieniasz ustawienia uwierzytelniania z jawnym planem awaryjnym.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains likely SSO misconfiguration patterns.',
        'Wyjaśnia typowe wzorce błędnej konfiguracji SSO.'
      ),
      text(
        'Suggests the most likely source of login friction.',
        'Sugeruje najbardziej prawdopodobne źródło tarcia logowania.'
      ),
      text(
        'Drafts a step-by-step validation checklist.',
        'Przygotowuje checklistę walidacji krok po kroku.'
      ),
    ],
    whatComesNext: text(
      'After SSO changes, verify user login behavior and adjacent policy controls before closing the task.',
      'Po zmianach SSO zweryfikuj zachowanie logowania użytkowników i sąsiednie kontrolki polityk zanim zamkniesz temat.'
    ),
    askAiNow: {
      label: text('Ask AI to review SSO setup', 'Zapytaj AI o przegląd setupu SSO'),
      prompt: text(
        'You are assisting a Super Admin on the SSO Configuration screen. Review the current SSO setup, identify likely trust or mapping risks, and provide a safe verification sequence.',
        'Pomagasz Super Adminowi na ekranie SSO Configuration. Przejrzyj bieżący setup SSO, wskaż ryzyka zaufania lub mapowania i podaj bezpieczną sekwencję weryfikacji.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-sso',
      'superadmin',
      text('SSO Configuration', 'SSO Configuration')
    ),
  }),
  superadmin_security_policies: createSystemDoc({
    id: 'superadmin_security_policies',
    moduleId: 'superadmin',
    icon: 'ScrollText',
    title: text('Security Policies', 'Security Policies'),
    summary: text(
      'This screen defines and governs how security rules are expressed and enforced across the platform.',
      'Ten ekran definiuje i nadzoruje sposób wyrażania oraz egzekwowania reguł bezpieczeństwa w całej platformie.'
    ),
    whatThisIs: text(
      'Use it to manage policy intent, not to make reactive changes under pressure.',
      'Używaj go do zarządzania intencją polityk, a nie do reaktywnych zmian pod presją.'
    ),
    whyItMatters: text(
      'Policy drift creates invisible risk. Stable, reviewable policy logic protects platform consistency.',
      'Dryf polityk tworzy niewidoczne ryzyko. Stabilna i przeglądalna logika polityk chroni spójność platformy.'
    ),
    whatYouDoHere: [
      text(
        'Review current rule intent and enforcement expectations.',
        'Przeglądasz intencję aktualnych reguł i oczekiwania egzekucji.'
      ),
      text(
        'Avoid broad policy changes without testing the blast radius.',
        'Unikasz szerokich zmian polityk bez testu blast radius.'
      ),
      text(
        'Tie policy updates to a clear risk rationale.',
        'Łączysz aktualizacje polityk z jasnym uzasadnieniem ryzyka.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Explains policy overlap and conflict risk.',
        'Wyjaśnia nakładanie się polityk i ryzyko konfliktów.'
      ),
      text(
        'Summarizes the practical impact of a rule change.',
        'Podsumowuje praktyczny wpływ zmiany reguły.'
      ),
      text(
        'Drafts a review checklist before enforcement changes.',
        'Przygotowuje checklistę review przed zmianą egzekucji.'
      ),
    ],
    whatComesNext: text(
      'After a policy update, validate identity, API, and compliance outcomes in the connected security screens.',
      'Po aktualizacji polityki zwaliduj skutki identity, API i compliance na połączonych ekranach security.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review security policies',
        'Zapytaj AI o przegląd polityk bezpieczeństwa'
      ),
      prompt: text(
        'You are assisting a Super Admin on the Security Policies screen. Review the current policy logic, identify overlap or conflict risk, and recommend the safest next change path.',
        'Pomagasz Super Adminowi na ekranie Security Policies. Przejrzyj bieżącą logikę polityk, wskaż ryzyko nakładania lub konfliktów i zaproponuj najbezpieczniejszą ścieżkę kolejnej zmiany.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-policies',
      'superadmin',
      text('Security Policies', 'Security Policies')
    ),
  }),
  superadmin_api_management: createSystemDoc({
    id: 'superadmin_api_management',
    moduleId: 'superadmin',
    icon: 'KeySquare',
    title: text('API Management', 'API Management'),
    summary: text(
      'This screen manages API access surfaces, keys, usage control, and exposure posture.',
      'Ten ekran służy do zarządzania powierzchnią dostępu API, kluczami, kontrolą użycia i postawą ekspozycji.'
    ),
    whatThisIs: text(
      'Use it to control who can call the platform, how much, and under what rules.',
      'Używaj go do kontroli tego, kto może wywoływać platformę, w jakiej skali i na jakich zasadach.'
    ),
    whyItMatters: text(
      'API mistakes can become security incidents, billing anomalies, or platform abuse very quickly.',
      'Błędy API mogą bardzo szybko stać się incydentami bezpieczeństwa, anomaliami billingowymi albo nadużyciem platformy.'
    ),
    whatYouDoHere: [
      text(
        'Inspect key state, permissions, usage, and suspicious patterns.',
        'Sprawdzasz stan kluczy, uprawnienia, usage i podejrzane wzorce.'
      ),
      text(
        'Differentiate between valid growth and abuse or leakage.',
        'Rozróżniasz prawidłowy wzrost od nadużycia lub wycieku.'
      ),
      text(
        'Rotate or restrict access with clear communication and audit trail.',
        'Rotujesz albo ograniczasz dostęp z jasną komunikacją i audit trail.'
      ),
    ],
    howAiHelpsHere: [
      text('Highlights suspicious API usage patterns.', 'Wskazuje podejrzane wzorce użycia API.'),
      text(
        'Summarizes whether the issue is security, usage, or configuration related.',
        'Podsumowuje czy problem dotyczy security, usage czy konfiguracji.'
      ),
      text(
        'Prepares a safe intervention plan before key changes.',
        'Przygotowuje bezpieczny plan interwencji przed zmianami kluczy.'
      ),
    ],
    whatComesNext: text(
      'After a key or access change, verify downstream usage, customer impact, and adjacent compliance controls.',
      'Po zmianie klucza albo dostępu zweryfikuj downstream usage, wpływ na klientów i sąsiednie kontrolki compliance.'
    ),
    askAiNow: {
      label: text('Ask AI to review API risk', 'Zapytaj AI o przegląd ryzyka API'),
      prompt: text(
        'You are assisting a Super Admin on the API Management screen. Review the current API access picture, identify suspicious or risky patterns, and recommend the safest next intervention.',
        'Pomagasz Super Adminowi na ekranie API Management. Przejrzyj bieżący obraz dostępu API, wskaż podejrzane lub ryzykowne wzorce i zaproponuj najbezpieczniejszą kolejną interwencję.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-api-management',
      'superadmin',
      text('API Management', 'API Management')
    ),
  }),
  superadmin_compliance: createSystemDoc({
    id: 'superadmin_compliance',
    moduleId: 'superadmin',
    icon: 'Scale',
    title: text('Compliance Center', 'Compliance Center'),
    summary: text(
      'This screen manages regulated obligations, evidence trails, and compliance workflow across the platform.',
      'Ten ekran służy do zarządzania obowiązkami regulacyjnymi, ścieżkami dowodowymi i workflow compliance w całej platformie.'
    ),
    whatThisIs: text(
      'Use it to control compliance operations that require traceability, evidence, and structured handling.',
      'Używaj go do kontroli operacji compliance wymagających traceability, dowodów i ustrukturyzowanej obsługi.'
    ),
    whyItMatters: text(
      'Compliance work fails when evidence is fragmented or response paths are improvised.',
      'Praca compliance zawodzi wtedy, gdy dowody są rozproszone albo ścieżki odpowiedzi improwizowane.'
    ),
    whatYouDoHere: [
      text(
        'Track requests, evidence, and formal follow-up actions.',
        'Śledzisz requesty, dowody i formalne działania follow-up.'
      ),
      text(
        'Preserve auditability at every meaningful step.',
        'Zachowujesz audytowalność na każdym istotnym kroku.'
      ),
      text(
        'Coordinate legal, security, and operational stakeholders around the same record.',
        'Koordynujesz interesariuszy legal, security i operations wokół tego samego rekordu.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes large evidence sets into actionable reviews.',
        'Podsumowuje duże zestawy dowodów do formy actionable review.'
      ),
      text(
        'Highlights missing evidence or weak response logic.',
        'Wskazuje brakujące dowody albo słabą logikę odpowiedzi.'
      ),
      text(
        'Drafts concise issue and response summaries.',
        'Tworzy zwięzłe podsumowania problemu i odpowiedzi.'
      ),
    ],
    whatComesNext: text(
      'After a compliance action, validate whether follow-up is needed in security, API management, or customer operations.',
      'Po akcji compliance zweryfikuj czy potrzebny jest follow-up w security, API management albo customer operations.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review compliance workflow',
        'Zapytaj AI o przegląd workflow compliance'
      ),
      prompt: text(
        'You are assisting a Super Admin in the Compliance Center. Review the current compliance context, identify missing evidence or risky gaps, and recommend the most defensible next actions.',
        'Pomagasz Super Adminowi w Compliance Center. Przejrzyj bieżący kontekst compliance, wskaż brakujące dowody albo ryzykowne luki i zaproponuj najbardziej defensywne kolejne działania.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-compliance',
      'superadmin',
      text('Compliance Center', 'Compliance Center')
    ),
  }),
  superadmin_configuration: createSystemDoc({
    id: 'superadmin_configuration',
    moduleId: 'superadmin',
    icon: 'SlidersHorizontal',
    title: text('Configuration Module', 'Configuration Module'),
    summary: text(
      'This module manages platform-level settings, white-labeling, and environment-facing configuration.',
      'Ten moduł zarządza ustawieniami platformowymi, white-labelingiem i konfiguracją skierowaną na środowisko.'
    ),
    whatThisIs: text(
      'Use it for global settings that shape how the platform looks, behaves, and is presented externally.',
      'Używaj go do globalnych ustawień, które kształtują wygląd, zachowanie i zewnętrzną prezentację platformy.'
    ),
    whyItMatters: text(
      'Configuration changes are often silent but user-facing. Precision matters more than speed.',
      'Zmiany konfiguracyjne często są ciche, ale user-facing. Precyzja jest ważniejsza niż szybkość.'
    ),
    whatYouDoHere: [
      text(
        'Manage high-level settings and outward-facing behavior.',
        'Zarządzasz ustawieniami wysokiego poziomu i zachowaniem widocznym na zewnątrz.'
      ),
      text(
        'Separate cosmetic changes from operationally meaningful ones.',
        'Oddzielasz zmiany kosmetyczne od zmian istotnych operacyjnie.'
      ),
      text(
        'Validate downstream branding and behavior after every significant update.',
        'Po każdej istotnej aktualizacji weryfikujesz branding i downstream behavior.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes which settings are likely to have real user impact.',
        'Podsumowuje które ustawienia prawdopodobnie mają realny wpływ na użytkownika.'
      ),
      text(
        'Flags changes that may require broader validation.',
        'Wskazuje zmiany, które mogą wymagać szerszej walidacji.'
      ),
      text(
        'Drafts a simple release note or operator note for the change.',
        'Przygotowuje prosty release note albo notatkę operatorską do zmiany.'
      ),
    ],
    whatComesNext: text(
      'If the change touches branding deeply, continue into Whitelabel; if it changes trust posture, continue into Security.',
      'Jeśli zmiana mocno dotyka brandingu, przejdź dalej do Whitelabel; jeśli zmienia postawę zaufania, przejdź do Security.'
    ),
    askAiNow: {
      label: text(
        'Ask AI to review platform configuration',
        'Zapytaj AI o przegląd konfiguracji platformy'
      ),
      prompt: text(
        'You are assisting a Super Admin in the Configuration module. Review the current configuration area, explain likely user-facing impact, and recommend the safest validation path.',
        'Pomagasz Super Adminowi w module Configuration. Przejrzyj bieżący obszar konfiguracji, wyjaśnij prawdopodobny wpływ user-facing i zaproponuj najbezpieczniejszą ścieżkę walidacji.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-configuration',
      'superadmin',
      text('Configuration Module', 'Configuration Module')
    ),
  }),
  superadmin_whitelabel: createSystemDoc({
    id: 'superadmin_whitelabel',
    moduleId: 'superadmin',
    icon: 'Palette',
    title: text('Whitelabel Studio', 'Whitelabel Studio'),
    summary: text(
      'This screen controls branding and client-facing presentation of the platform for different tenants or environments.',
      'Ten ekran kontroluje branding i client-facing presentation platformy dla różnych tenantów albo środowisk.'
    ),
    whatThisIs: text(
      'Use it to manage how the platform appears externally without breaking the product shell or trust cues.',
      'Używaj go do zarządzania zewnętrznym wyglądem platformy bez psucia shella produktu albo sygnałów zaufania.'
    ),
    whyItMatters: text(
      'Branding is visible immediately. Small mistakes here can damage credibility fast.',
      'Branding jest widoczny natychmiast. Małe błędy w tym miejscu mogą szybko uszkodzić wiarygodność.'
    ),
    whatYouDoHere: [
      text(
        'Manage logos, colors, and outward-facing identity assets.',
        'Zarządzasz logo, kolorami i assetami tożsamości widocznymi na zewnątrz.'
      ),
      text(
        'Check consistency across key user journeys.',
        'Sprawdzasz spójność na kluczowych user journey.'
      ),
      text(
        'Validate contrast, readability, and trust cues before publishing.',
        'Przed publikacją weryfikujesz kontrast, czytelność i sygnały zaufania.'
      ),
    ],
    howAiHelpsHere: [
      text(
        'Summarizes likely UX risk in branding changes.',
        'Podsumowuje prawdopodobne ryzyko UX w zmianach brandingu.'
      ),
      text('Highlights inconsistent brand usage.', 'Wskazuje niespójne użycie brandu.'),
      text(
        'Drafts a concise review checklist for final QA.',
        'Tworzy zwięzłą checklistę review do finalnego QA.'
      ),
    ],
    whatComesNext: text(
      'After a whitelabel change, validate entry pages, auth surfaces, and core navigation before release.',
      'Po zmianie whitelabel zweryfikuj entry pages, auth surfaces i core navigation przed wydaniem.'
    ),
    askAiNow: {
      label: text('Ask AI to review branding risk', 'Zapytaj AI o przegląd ryzyka brandingowego'),
      prompt: text(
        'You are assisting a Super Admin in Whitelabel Studio. Review the planned branding changes, identify UX or trust risks, and recommend the most important validation checks.',
        'Pomagasz Super Adminowi w Whitelabel Studio. Przejrzyj planowane zmiany brandingowe, wskaż ryzyka UX lub zaufania i zaproponuj najważniejsze testy walidacyjne.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-whitelabel',
      'superadmin',
      text('Whitelabel Studio', 'Whitelabel Studio')
    ),
  }),
  superadmin_analytics: createSystemDoc({
    id: 'superadmin_analytics',
    moduleId: 'superadmin',
    icon: 'ChartNoAxesCombined',
    title: text('Analytics Module', 'Analytics Module'),
    summary: text(
      'This module turns platform activity into signals for management, forecasting, and operational decisions.',
      'Ten moduł zamienia aktywność platformy w sygnały do zarządzania, prognozowania i decyzji operacyjnych.'
    ),
    whatThisIs: text(
      'Use it to understand platform behavior at scale, not to manage single incidents.',
      'Używaj go do rozumienia zachowania platformy w skali, a nie do zarządzania pojedynczym incydentem.'
    ),
    whyItMatters: text(
      'Analytics is where patterns become decisions. Weak reading here leads to bad priorities elsewhere.',
      'Analytics to miejsce, gdzie wzorce stają się decyzjami. Słaby odczyt tutaj prowadzi do złych priorytetów gdzie indziej.'
    ),
    whatYouDoHere: [
      text(
        'Review metrics, trends, and performance patterns.',
        'Przeglądasz metryki, trendy i wzorce wydajności.'
      ),
      text(
        'Distinguish real change from reporting noise.',
        'Rozróżniasz realną zmianę od szumu raportowego.'
      ),
      text(
        'Use analytics to inform action in other superadmin modules.',
        'Używasz analytics do kierowania działaniem w innych modułach superadmin.'
      ),
    ],
    howAiHelpsHere: [
      text('Summarizes trend movement and anomalies.', 'Podsumowuje ruch trendów i anomalie.'),
      text(
        'Explains what likely matters now versus what is just noise.',
        'Wyjaśnia co prawdopodobnie ma teraz znaczenie, a co jest tylko szumem.'
      ),
      text(
        'Prepares decision-ready summaries for leadership.',
        'Przygotowuje podsumowania gotowe pod decyzję dla leadershipu.'
      ),
    ],
    whatComesNext: text(
      'Move from analytics into the owning module once a pattern becomes actionable.',
      'Przejdź z analytics do modułu właściciela, gdy wzorzec stanie się actionable.'
    ),
    askAiNow: {
      label: text('Ask AI to interpret analytics', 'Zapytaj AI o interpretację analytics'),
      prompt: text(
        'You are assisting a Super Admin in the Analytics module. Review the current metrics and trends, separate signal from noise, and recommend the most actionable follow-up decisions.',
        'Pomagasz Super Adminowi w module Analytics. Przejrzyj bieżące metryki i trendy, oddziel sygnał od szumu i zaproponuj najbardziej actionable kolejne decyzje.'
      ),
    },
    faqs: createSuperAdminFAQs(
      'superadmin-analytics',
      'superadmin',
      text('Analytics Module', 'Analytics Module')
    ),
  }),
};

export const HELP_OVERVIEW_GUIDES: HelpQuickGuide[] = [
  SHARED_GUIDES.overview,
  SHARED_GUIDES.askAi,
  SHARED_GUIDES.kb,
  makeGuide(
    'video-pack',
    text('Micro-video ready', 'Gotowe pod micro-video'),
    text(
      'Every step already has a reserved intro slot for a 45-second video.',
      'Każdy etap ma już zarezerwowane miejsce na intro wideo 45 s.'
    )
  ),
];

export const HELP_MAINTENANCE_PACKS: HelpMaintenancePack[] = [
  {
    id: 'journey-pack',
    title: text('Journey pack', 'Pakiet podróży'),
    description: text(
      'Update the 5 core journey steps and their handoffs.',
      'Aktualizuje 5 głównych etapów podróży i przejścia między nimi.'
    ),
    includes: ['interview', 'tools_assessments', 'initiatives', 'execution', 'results'],
  },
  {
    id: 'support-module-pack',
    title: text('Support module pack', 'Pakiet modułów wspierających'),
    description: text(
      'Update supporting modules and their standalone/process framing.',
      'Aktualizuje moduły wspierające oraz ich framing standalone/procesowy.'
    ),
    includes: ['my_work', 'ideas', 'finance', 'presentations'],
  },
  {
    id: 'faq-refresh-pack',
    title: text('FAQ refresh pack', 'Pakiet odświeżenia FAQ'),
    description: text(
      'Refresh short operational questions without rewriting the full help model.',
      'Odświeża krótkie pytania operacyjne bez przepisywania całego modelu helpa.'
    ),
    includes: ['faq'],
  },
  {
    id: 'video-pack',
    title: text('Video pack', 'Pakiet wideo'),
    description: text(
      'Add or update micro-video teasers for help blocks.',
      'Dodaje lub aktualizuje teasery micro-video dla bloków helpa.'
    ),
    includes: ['video'],
  },
  {
    id: 'ai-prompt-pack',
    title: text('AI prompt pack', 'Pakiet promptów AI'),
    description: text(
      'Adjust Ask AI handoffs and prompt wording per module or stage.',
      'Dostosowuje handoffy Ask AI i treść promptów per moduł lub etap.'
    ),
    includes: ['prompt-library'],
  },
  {
    id: 'new-module-pack',
    title: text('New module pack', 'Pakiet nowego modułu'),
    description: text(
      'Add help for a new module using the same short-form contract.',
      'Dodaje help dla nowego modułu przy użyciu tego samego krótkiego kontraktu.'
    ),
    includes: ['what-this-is', 'why-it-matters', 'how-ai-helps', 'what-comes-next', 'ask-ai'],
  },
];

type TabDocSeed = {
  id: string;
  moduleId?: string;
  icon?: string;
  titleEn: string;
  titlePl: string;
  summaryEn: string;
  summaryPl: string;
  actionsEn: string[];
  actionsPl: string[];
  aiLabelEn?: string;
  aiLabelPl?: string;
  aiPromptEn: string;
  aiPromptPl: string;
  nextEn: string;
  nextPl: string;
};

const createTabDoc = (seed: TabDocSeed): HelpDocument =>
  createSystemDoc({
    id: seed.id,
    moduleId: seed.moduleId ?? 'superadmin',
    icon: seed.icon ?? 'Shield',
    title: text(seed.titleEn, seed.titlePl),
    summary: text(seed.summaryEn, seed.summaryPl),
    whatThisIs: text(seed.summaryEn, seed.summaryPl),
    whyItMatters: text(
      `${seed.titleEn} should be managed deliberately because mistakes here can create fast downstream impact.`,
      `Ekran ${seed.titlePl} trzeba prowadzić świadomie, bo błędy tutaj mogą szybko wywołać skutki downstream.`
    ),
    whatYouDoHere: seed.actionsEn.map((action, index) =>
      text(action, seed.actionsPl[index] || seed.actionsPl[0] || action)
    ),
    howAiHelpsHere: [
      text(
        `Summarizes the current state of ${seed.titleEn} into the most important operational signals.`,
        `Podsumowuje bieżący stan obszaru ${seed.titlePl} do najważniejszych sygnałów operacyjnych.`
      ),
      text(
        `Highlights anomalies, drift, and the safest next checks before a change.`,
        `Wskazuje anomalie, dryf i najbezpieczniejsze kolejne kontrole przed zmianą.`
      ),
      text(
        `Drafts a short action plan for the operator handling this screen.`,
        `Tworzy krótki plan działania dla operatora obsługującego ten ekran.`
      ),
    ],
    whatComesNext: text(seed.nextEn, seed.nextPl),
    askAiNow: {
      label: text(
        seed.aiLabelEn || `Ask AI to review ${seed.titleEn}`,
        seed.aiLabelPl || `Zapytaj AI o przegląd ${seed.titlePl}`
      ),
      prompt: text(seed.aiPromptEn, seed.aiPromptPl),
    },
    faqs: createSuperAdminFAQs(
      seed.id,
      seed.moduleId ?? 'superadmin',
      text(seed.titleEn, seed.titlePl)
    ),
  });

const SUPERADMIN_RUNTIME_DOCUMENTS: Record<string, HelpDocument> = Object.fromEntries(
  [
    {
      id: 'superadmin_overview_dashboard',
      icon: 'LayoutDashboard',
      titleEn: 'Overview Dashboard',
      titlePl: 'Overview Dashboard',
      summaryEn:
        'The dashboard is the live command view for platform status, activity, and fast routing into the right domain.',
      summaryPl:
        'Dashboard to żywy widok dowodzenia dla statusu platformy, aktywności i szybkiego routingu do właściwej domeny.',
      actionsEn: [
        'Review platform-wide metrics and recent activity.',
        'Use quick actions to jump into customers, users, or revenue.',
        'Treat the dashboard as triage, not detailed execution.',
      ],
      actionsPl: [
        'Przeglądasz metryki całej platformy i ostatnią aktywność.',
        'Używasz szybkich akcji do wejścia w customers, users albo revenue.',
        'Traktujesz dashboard jako triage, a nie miejsce szczegółowej realizacji.',
      ],
      aiPromptEn:
        'You are assisting a Super Admin on the overview dashboard. Summarize the current platform situation and suggest the most urgent next checks.',
      aiPromptPl:
        'Pomagasz Super Adminowi na overview dashboard. Podsumuj bieżącą sytuację platformy i wskaż najpilniejsze kolejne kontrole.',
      nextEn: 'Move into the owning domain once the signal becomes specific enough.',
      nextPl: 'Przejdź do domeny właściciela, gdy sygnał stanie się wystarczająco konkretny.',
    },
    {
      id: 'superadmin_overview_metrics',
      icon: 'BarChart3',
      titleEn: 'Overview Metrics',
      titlePl: 'Overview Metrics',
      summaryEn: 'This tab tracks measurable platform performance and adoption signals over time.',
      summaryPl: 'Ta zakładka śledzi mierzalne sygnały wydajności platformy i adopcji w czasie.',
      actionsEn: [
        'Read trend changes, not only absolute values.',
        'Separate temporary spikes from structural movement.',
        'Use metrics to support decisions in other admin modules.',
      ],
      actionsPl: [
        'Czytasz zmiany trendów, a nie tylko wartości absolutne.',
        'Oddzielasz chwilowe skoki od ruchu strukturalnego.',
        'Używasz metryk do wsparcia decyzji w innych modułach administracyjnych.',
      ],
      aiPromptEn:
        'You are assisting on the overview metrics tab. Interpret the current trend picture and explain what really requires attention.',
      aiPromptPl:
        'Pomagasz na zakładce overview metrics. Zinterpretuj bieżący obraz trendów i wyjaśnij, co naprawdę wymaga uwagi.',
      nextEn: 'Escalate only the signals that are durable and actionable.',
      nextPl: 'Eskaluj tylko te sygnały, które są trwałe i actionable.',
    },
    {
      id: 'superadmin_overview_signals',
      icon: 'Radio',
      titleEn: 'Overview Signals',
      titlePl: 'Overview Signals',
      summaryEn: 'Signals are high-sensitivity events worth watching before they become incidents.',
      summaryPl:
        'Signals to zdarzenia o wysokiej czułości, które warto obserwować zanim staną się incydentami.',
      actionsEn: [
        'Review anomalies and weak signals early.',
        'Correlate signals with customer, AI, or security domains.',
        'Promote only validated issues into incident workflows.',
      ],
      actionsPl: [
        'Wcześnie przeglądasz anomalie i słabe sygnały.',
        'Korelujesz sygnały z domenami customer, AI albo security.',
        'Tylko zwalidowane problemy przenosisz do workflow incydentów.',
      ],
      aiPromptEn:
        'You are assisting on the overview signals tab. Cluster the current signals and recommend which ones deserve escalation first.',
      aiPromptPl:
        'Pomagasz na zakładce overview signals. Pogrupuj bieżące sygnały i wskaż, które zasługują na pierwszą eskalację.',
      nextEn: 'Move validated signals into the correct operational queue.',
      nextPl: 'Przenieś zwalidowane sygnały do właściwej kolejki operacyjnej.',
    },
    {
      id: 'superadmin_customers_organizations',
      icon: 'Building2',
      titleEn: 'Customer Organizations',
      titlePl: 'Organizacje klientów',
      summaryEn: 'This tab is for tenant-level inspection and safe organization management.',
      summaryPl:
        'Ta zakładka służy do inspekcji tenantów i bezpiecznego zarządzania organizacjami.',
      actionsEn: [
        'Inspect plan, status, and tenant identity before editing.',
        'Change only the tenant that is actually affected.',
        'Validate customer impact after any status or plan update.',
      ],
      actionsPl: [
        'Przed edycją sprawdzasz plan, status i tożsamość tenantu.',
        'Zmieniasz tylko tenant faktycznie dotknięty problemem.',
        'Po każdej zmianie statusu lub planu walidujesz wpływ na klienta.',
      ],
      aiPromptEn:
        'Review the selected customer organizations and recommend the safest tenant-level action path.',
      aiPromptPl:
        'Przejrzyj wybrane organizacje klientów i zaproponuj najbezpieczniejszą ścieżkę działania na poziomie tenantu.',
      nextEn:
        'Go into users, contracts, billing, or security if the issue is more specific than tenant state.',
      nextPl:
        'Przejdź do users, contracts, billing albo security, jeśli problem jest bardziej szczegółowy niż sam stan tenantu.',
    },
    {
      id: 'superadmin_customers_users',
      icon: 'Users',
      titleEn: 'Customer Users',
      titlePl: 'Użytkownicy klientów',
      summaryEn:
        'This tab manages user-level access and identity friction across customer organizations.',
      summaryPl:
        'Ta zakładka zarządza dostępem użytkowników i tarciem tożsamościowym w organizacjach klientów.',
      actionsEn: [
        'Differentiate user-level issues from tenant-level problems.',
        'Take the smallest safe admin action first.',
        'Preserve auditability for sensitive access changes.',
      ],
      actionsPl: [
        'Rozróżniasz problemy user-level od tenant-level.',
        'Najpierw wykonujesz najmniejsze bezpieczne działanie administracyjne.',
        'Dla wrażliwych zmian dostępowych zachowujesz audytowalność.',
      ],
      aiPromptEn:
        'Review current customer user issues and identify whether the problem is identity, permissions, or broader tenant state.',
      aiPromptPl:
        'Przejrzyj bieżące problemy użytkowników klientów i wskaż, czy problem dotyczy tożsamości, uprawnień czy szerszego stanu tenantu.',
      nextEn:
        'Escalate to security or organizations only if the issue is broader than a single user.',
      nextPl:
        'Eskaluj do security albo organizations tylko wtedy, gdy problem jest szerszy niż pojedynczy użytkownik.',
    },
    {
      id: 'superadmin_customers_lifecycle',
      icon: 'RefreshCw',
      titleEn: 'Customer Lifecycle',
      titlePl: 'Cykl życia klienta',
      summaryEn:
        'This tab shows how customers move through onboarding, adoption, risk, and maturity states.',
      summaryPl:
        'Ta zakładka pokazuje, jak klienci przechodzą przez onboarding, adopcję, ryzyko i stany dojrzałości.',
      actionsEn: [
        'Use lifecycle state to understand customer posture.',
        'Look for stalled transitions and at-risk accounts.',
        'Coordinate action with support, revenue, or customer success.',
      ],
      actionsPl: [
        'Używasz stanu lifecycle do rozumienia postawy klienta.',
        'Szukasz zatrzymanych przejść i kont zagrożonych.',
        'Koordynujesz działanie z supportem, revenue albo customer success.',
      ],
      aiPromptEn:
        'Analyze customer lifecycle movement and identify which accounts require intervention first.',
      aiPromptPl:
        'Przeanalizuj ruch w customer lifecycle i wskaż, które konta wymagają interwencji jako pierwsze.',
      nextEn:
        'Follow the customer into support, playbooks, analytics, or contracts depending on the risk.',
      nextPl:
        'Podążaj za klientem do support, playbooks, analytics albo contracts zależnie od ryzyka.',
    },
    {
      id: 'superadmin_customers_playbooks',
      icon: 'BookOpen',
      titleEn: 'Customer Playbooks',
      titlePl: 'Playbooki klientów',
      summaryEn: 'This tab manages customer-facing playbook flows and reusable success motions.',
      summaryPl:
        'Ta zakładka zarządza flow playbooków dla klientów i powtarzalnymi motionami success.',
      actionsEn: [
        'Review whether playbooks match the current customer stage.',
        'Keep the operator path short and outcome-based.',
        'Change playbooks through review, not silent drift.',
      ],
      actionsPl: [
        'Sprawdzasz, czy playbooki pasują do bieżącego etapu klienta.',
        'Utrzymujesz ścieżkę operatora krótką i opartą o wynik.',
        'Zmieniasz playbooki przez review, a nie cichy dryf.',
      ],
      aiPromptEn:
        'Review the customer playbook set and identify which flows are weak, duplicated, or outdated.',
      aiPromptPl:
        'Przejrzyj zestaw playbooków klientów i wskaż flow słabe, zdublowane albo przestarzałe.',
      nextEn: 'If a template itself is weak, continue into content playbooks or playbook editor.',
      nextPl:
        'Jeśli sam template jest słaby, przejdź dalej do content playbooks albo playbook editor.',
    },
    {
      id: 'superadmin_customers_contracts',
      icon: 'FileText',
      titleEn: 'Contracts',
      titlePl: 'Kontrakty',
      summaryEn: 'This tab helps manage contract state and customer-commercial obligations.',
      summaryPl:
        'Ta zakładka pomaga zarządzać stanem kontraktów i zobowiązaniami komercyjnymi wobec klientów.',
      actionsEn: [
        'Review the contract state before changing commercial settings.',
        'Link contract issues with lifecycle and billing context.',
        'Protect traceability around exceptions and custom terms.',
      ],
      actionsPl: [
        'Przed zmianą ustawień komercyjnych sprawdzasz stan kontraktu.',
        'Łączysz problemy kontraktowe z kontekstem lifecycle i billingu.',
        'Chronisz traceability wokół wyjątków i niestandardowych warunków.',
      ],
      aiPromptEn:
        'Review current contract signals and explain which customer-commercial risks matter most now.',
      aiPromptPl:
        'Przejrzyj bieżące sygnały kontraktowe i wyjaśnij, które ryzyka customer-commercial są teraz najważniejsze.',
      nextEn: 'Move into revenue or lifecycle if the issue spreads beyond the contract record.',
      nextPl:
        'Przejdź do revenue albo lifecycle, jeśli problem wykracza poza sam rekord kontraktu.',
    },
    {
      id: 'superadmin_customers_security',
      icon: 'Shield',
      titleEn: 'Customer Security',
      titlePl: 'Security klientów',
      summaryEn: 'This tab groups customer-facing security posture and access risk.',
      summaryPl: 'Ta zakładka grupuje bezpieczeństwo customer-facing i ryzyko dostępu.',
      actionsEn: [
        'Review whether a security issue is isolated or tenant-wide.',
        'Tie access findings back to users and org state.',
        'Escalate only with clear evidence.',
      ],
      actionsPl: [
        'Sprawdzasz, czy problem bezpieczeństwa jest izolowany czy tenant-wide.',
        'Łączysz findings dostępowe z users i stanem organizacji.',
        'Eskalujesz tylko z jasnym materiałem dowodowym.',
      ],
      aiPromptEn: 'Review the customer security context and recommend the safest follow-up path.',
      aiPromptPl:
        'Przejrzyj kontekst bezpieczeństwa klientów i zaproponuj najbezpieczniejszą dalszą ścieżkę działania.',
      nextEn: 'Go deeper into the security module if stronger controls are involved.',
      nextPl: 'Wejdź głębiej do modułu security, jeśli problem dotyczy mocniejszych kontrolek.',
    },
    {
      id: 'superadmin_customers_support',
      icon: 'Headphones',
      titleEn: 'Support & Customer Success',
      titlePl: 'Support i Customer Success',
      summaryEn: 'This tab manages active customer support and success operations.',
      summaryPl:
        'Ta zakładka służy do zarządzania aktywnym supportem klientów i operacjami customer success.',
      actionsEn: [
        'Review the active problem, owner, and customer impact.',
        'Separate operational support from product issues.',
        'Keep context complete before handoff.',
      ],
      actionsPl: [
        'Przeglądasz aktywny problem, właściciela i wpływ na klienta.',
        'Oddzielasz support operacyjny od problemów produktowych.',
        'Przed handoffem utrzymujesz pełny kontekst.',
      ],
      aiPromptEn:
        'Summarize the current support and CS context and identify the most urgent customer follow-up.',
      aiPromptPl:
        'Podsumuj bieżący kontekst supportu i customer success oraz wskaż najpilniejszy follow-up wobec klienta.',
      nextEn: 'Continue into feedback, compliance, or customer health when the issue expands.',
      nextPl:
        'Przejdź dalej do feedback, compliance albo customer health, gdy problem się rozszerza.',
    },
    {
      id: 'superadmin_customers_feedback',
      icon: 'MessageSquare',
      titleEn: 'Customer Feedback',
      titlePl: 'Feedback klientów',
      summaryEn: 'This tab is for live review of customer feedback as incoming operational signal.',
      summaryPl:
        'Ta zakładka służy do bieżącego przeglądu feedbacku klientów jako sygnału operacyjnego.',
      actionsEn: [
        'Cluster feedback before escalating.',
        'Separate urgency from loudness.',
        'Route validated themes to the right owner.',
      ],
      actionsPl: [
        'Grupujesz feedback zanim go eskalujesz.',
        'Oddzielasz pilność od głośności.',
        'Walidowane tematy kierujesz do właściwego właściciela.',
      ],
      aiPromptEn:
        'Cluster current customer feedback and identify the themes that require action first.',
      aiPromptPl:
        'Pogrupuj bieżący feedback klientów i wskaż tematy, które wymagają działania jako pierwsze.',
      nextEn: 'Move durable patterns into backlog, product, or support operations.',
      nextPl: 'Przenoś trwałe wzorce do backlogu, produktu albo operacji supportowych.',
    },
    {
      id: 'superadmin_customers_feedback_backlog',
      icon: 'ListTodo',
      titleEn: 'Feedback Backlog',
      titlePl: 'Backlog feedbacku',
      summaryEn: 'This tab turns feedback into a managed backlog instead of a noisy inbox.',
      summaryPl: 'Ta zakładka zamienia feedback w zarządzany backlog zamiast hałaśliwej skrzynki.',
      actionsEn: [
        'Prioritize validated themes.',
        'Track owner and status, not only volume.',
        'Keep backlog clean and reviewable.',
      ],
      actionsPl: [
        'Priorytetyzujesz zwalidowane tematy.',
        'Śledzisz właściciela i status, a nie tylko wolumen.',
        'Utrzymujesz backlog jako czysty i przeglądalny.',
      ],
      aiPromptEn:
        'Review the current feedback backlog and recommend the highest-value next priorities.',
      aiPromptPl:
        'Przejrzyj bieżący backlog feedbacku i zaproponuj kolejne priorytety o najwyższej wartości.',
      nextEn: 'Convert repeated patterns into product, content, or customer-operation changes.',
      nextPl:
        'Zamieniaj powtarzalne wzorce w zmiany produktowe, contentowe albo customer-operations.',
    },
    {
      id: 'superadmin_customers_analytics',
      icon: 'BarChart3',
      titleEn: 'Customer Analytics',
      titlePl: 'Analityka klientów',
      summaryEn:
        'This tab reveals customer patterns, usage health, and risk signals at portfolio level.',
      summaryPl:
        'Ta zakładka pokazuje wzorce klientów, zdrowie usage i sygnały ryzyka na poziomie portfolio.',
      actionsEn: [
        'Read patterns across customer groups, not only single accounts.',
        'Use analytics to guide intervention, not replace judgment.',
        'Validate whether movement is real or reporting noise.',
      ],
      actionsPl: [
        'Czytasz wzorce między grupami klientów, a nie tylko pojedynczymi kontami.',
        'Używasz analytics do kierowania interwencją, a nie zamiast osądu.',
        'Walidujesz czy ruch jest realny czy tylko szumem raportowym.',
      ],
      aiPromptEn:
        'Interpret the current customer analytics and identify which customer segments require the fastest intervention.',
      aiPromptPl:
        'Zinterpretuj bieżącą analitykę klientów i wskaż, które segmenty wymagają najszybszej interwencji.',
      nextEn: 'Take action in lifecycle, support, revenue, or contracts depending on the signal.',
      nextPl:
        'Podejmij działanie w lifecycle, support, revenue albo contracts zależnie od sygnału.',
    },
    {
      id: 'superadmin_customers_compliance',
      icon: 'FileCheck',
      titleEn: 'Customer Compliance',
      titlePl: 'Compliance klientów',
      summaryEn:
        'This tab tracks customer compliance posture and obligations tied to customer operations.',
      summaryPl:
        'Ta zakładka śledzi postawę compliance klientów oraz obowiązki powiązane z ich obsługą.',
      actionsEn: [
        'Keep evidence linked to the customer record.',
        'Differentiate between internal and customer-facing compliance risk.',
        'Escalate with clear evidence and ownership.',
      ],
      actionsPl: [
        'Trzymasz dowody powiązane z rekordem klienta.',
        'Rozróżniasz compliance risk wewnętrzne i customer-facing.',
        'Eskalujesz z jasnym materiałem dowodowym i właścicielem.',
      ],
      aiPromptEn: 'Review customer compliance signals and identify the riskiest open gaps.',
      aiPromptPl:
        'Przejrzyj sygnały compliance klientów i wskaż najbardziej ryzykowne otwarte luki.',
      nextEn: 'Move into the central compliance module when the issue becomes platform-level.',
      nextPl: 'Przejdź do centralnego modułu compliance, gdy problem staje się platform-level.',
    },
    {
      id: 'superadmin_customers_automation',
      icon: 'Zap',
      titleEn: 'Customer Automation',
      titlePl: 'Automatyzacja klientów',
      summaryEn:
        'This tab manages automation touching customer-facing processes and lifecycle motion.',
      summaryPl:
        'Ta zakładka zarządza automatyzacją dotykającą customer-facing procesów i ruchu lifecycle.',
      actionsEn: [
        'Understand the workflow before changing automation logic.',
        'Protect customers from unintended triggers.',
        'Validate automation on realistic edge cases.',
      ],
      actionsPl: [
        'Przed zmianą logiki rozumiesz cały workflow.',
        'Chronisz klientów przed niezamierzonymi triggerami.',
        'Walidujesz automatyzację na realistycznych edge case’ach.',
      ],
      aiPromptEn:
        'Review the current customer automation setup and identify the riskiest workflow gaps or trigger issues.',
      aiPromptPl:
        'Przejrzyj bieżący setup automatyzacji klientów i wskaż najbardziej ryzykowne luki workflow albo problemy triggerów.',
      nextEn: 'After automation changes, review support, lifecycle, and communication impact.',
      nextPl: 'Po zmianach automatyzacji przejrzyj wpływ na support, lifecycle i communication.',
    },
    {
      id: 'superadmin_customers_communication',
      icon: 'Mail',
      titleEn: 'Customer Communication',
      titlePl: 'Komunikacja z klientem',
      summaryEn: 'This tab manages outbound communication quality, timing, and audience fit.',
      summaryPl:
        'Ta zakładka zarządza jakością komunikacji wychodzącej, timingiem i dopasowaniem do odbiorcy.',
      actionsEn: [
        'Keep communication aligned with actual state.',
        'Avoid sending broad messages from weak evidence.',
        'Match the message to the customer’s maturity and urgency.',
      ],
      actionsPl: [
        'Utrzymujesz komunikację zgodną z realnym stanem.',
        'Nie wysyłasz szerokich komunikatów na podstawie słabych dowodów.',
        'Dopasowujesz przekaz do dojrzałości i pilności po stronie klienta.',
      ],
      aiPromptEn:
        'Review the current customer communication context and draft the clearest next operator message.',
      aiPromptPl:
        'Przejrzyj bieżący kontekst komunikacji z klientem i przygotuj najjaśniejszy kolejny komunikat operatorski.',
      nextEn: 'Validate feedback and support impact after major communication changes.',
      nextPl: 'Po większych zmianach komunikacji zweryfikuj wpływ na feedback i support.',
    },
    {
      id: 'superadmin_customers_bulk_ops',
      icon: 'Upload',
      titleEn: 'Customer Bulk Operations',
      titlePl: 'Bulk Operations klientów',
      summaryEn:
        'This tab executes customer-affecting batch actions and must be handled with strict scope control.',
      summaryPl:
        'Ta zakładka wykonuje batchowe operacje dotykające klientów i wymaga ścisłej kontroli zakresu.',
      actionsEn: [
        'Define exact scope before execution.',
        'Prefer preview or dry-run logic.',
        'Verify downstream impact after every wave.',
      ],
      actionsPl: [
        'Przed wykonaniem definiujesz dokładny zakres.',
        'Preferujesz preview albo dry-run.',
        'Po każdej fali weryfikujesz downstream impact.',
      ],
      aiPromptEn:
        'Review the planned customer bulk action and prepare the safest pre-flight checklist.',
      aiPromptPl:
        'Przejrzyj planowaną operację bulk wobec klientów i przygotuj najbezpieczniejszą checklistę pre-flight.',
      nextEn: 'Validate outcomes in organizations, users, or support after the batch completes.',
      nextPl: 'Po zakończeniu batcha zwaliduj wyniki w organizations, users albo support.',
    },
    {
      id: 'superadmin_revenue_usage',
      icon: 'BarChart3',
      titleEn: 'Revenue Usage',
      titlePl: 'Usage revenue',
      summaryEn: 'This tab shows usage-linked commercial signal across accounts and plans.',
      summaryPl: 'Ta zakładka pokazuje sygnał komercyjny powiązany z usage w kontach i planach.',
      actionsEn: [
        'Read usage as a commercial signal, not only an activity metric.',
        'Watch for sudden drops, spikes, and plan mismatch.',
        'Use usage data to validate billing logic.',
      ],
      actionsPl: [
        'Czytasz usage jako sygnał komercyjny, a nie tylko metrykę aktywności.',
        'Obserwujesz nagłe spadki, skoki i niedopasowanie planów.',
        'Używasz danych usage do walidacji logiki billingowej.',
      ],
      aiPromptEn:
        'Interpret the current usage-linked revenue picture and highlight suspicious account patterns.',
      aiPromptPl:
        'Zinterpretuj bieżący obraz revenue powiązany z usage i wskaż podejrzane wzorce na kontach.',
      nextEn:
        'Go deeper into billing, subscriptions, or pricing if the pattern requires intervention.',
      nextPl:
        'Wejdź głębiej w billing, subscriptions albo pricing, jeśli wzorzec wymaga interwencji.',
    },
    {
      id: 'superadmin_revenue_pricing',
      icon: 'Layers',
      titleEn: 'Pricing Plans',
      titlePl: 'Plany cenowe',
      summaryEn: 'This tab controls the structure and commercial logic of pricing plans.',
      summaryPl: 'Ta zakładka kontroluje strukturę i logikę komercyjną planów cenowych.',
      actionsEn: [
        'Change pricing logic deliberately, not reactively.',
        'Check plan clarity and downstream billing impact.',
        'Validate positioning before rollout.',
      ],
      actionsPl: [
        'Zmieniasz logikę cen świadomie, a nie reaktywnie.',
        'Sprawdzasz czytelność planów i downstream billing impact.',
        'Przed rolloutem walidujesz pozycjonowanie.',
      ],
      aiPromptEn:
        'Review the current pricing setup and identify the most important clarity or risk issues.',
      aiPromptPl:
        'Przejrzyj bieżący setup cenowy i wskaż najważniejsze problemy czytelności albo ryzyka.',
      nextEn: 'Verify billing, subscriptions, and revenue recognition after pricing changes.',
      nextPl: 'Po zmianach cen zweryfikuj billing, subscriptions i revenue recognition.',
    },
    {
      id: 'superadmin_revenue_subscriptions',
      icon: 'RefreshCw',
      titleEn: 'Subscriptions',
      titlePl: 'Subskrypcje',
      summaryEn:
        'This tab tracks subscription state changes, upgrades, downgrades, and churn motion.',
      summaryPl: 'Ta zakładka śledzi zmiany stanu subskrypcji, upgrady, downgready i ruch churnu.',
      actionsEn: [
        'Review transition logic before intervention.',
        'Link subscription changes to billing and customer lifecycle.',
        'Separate valid movement from broken state.',
      ],
      actionsPl: [
        'Przed interwencją sprawdzasz logikę przejść.',
        'Łączysz zmiany subskrypcji z billingiem i customer lifecycle.',
        'Oddzielasz prawidłowy ruch od uszkodzonego stanu.',
      ],
      aiPromptEn:
        'Review current subscription changes and identify which transitions look risky or inconsistent.',
      aiPromptPl:
        'Przejrzyj bieżące zmiany subskrypcji i wskaż, które przejścia wyglądają ryzykownie albo niespójnie.',
      nextEn:
        'Go into billing or lifecycle if a subscription state is invalid or customer-impacting.',
      nextPl:
        'Przejdź do billingu albo lifecycle, jeśli stan subskrypcji jest nieprawidłowy albo wpływa na klienta.',
    },
    {
      id: 'superadmin_revenue_recognition',
      icon: 'Calculator',
      titleEn: 'Revenue Recognition',
      titlePl: 'Rozpoznanie przychodu',
      summaryEn: 'This tab manages how revenue is recognized and tracked over time.',
      summaryPl: 'Ta zakładka zarządza sposobem rozpoznawania i śledzenia przychodu w czasie.',
      actionsEn: [
        'Protect accounting correctness over speed.',
        'Review the event chain behind the number.',
        'Keep traceability for every correction.',
      ],
      actionsPl: [
        'Chronisz poprawność księgową ponad szybkość.',
        'Przeglądasz łańcuch zdarzeń stojący za liczbą.',
        'Dla każdej korekty utrzymujesz traceability.',
      ],
      aiPromptEn:
        'Review the current revenue recognition context and explain which inconsistencies need investigation first.',
      aiPromptPl:
        'Przejrzyj bieżący kontekst revenue recognition i wyjaśnij, które niespójności trzeba zbadać najpierw.',
      nextEn: 'Coordinate with billing, invoices, and finance owners when the issue spans records.',
      nextPl:
        'Koordynuj się z właścicielami billingu, faktur i finansów, gdy problem obejmuje wiele rekordów.',
    },
    {
      id: 'superadmin_revenue_forecasts',
      icon: 'TrendingUp',
      titleEn: 'Revenue Forecasts',
      titlePl: 'Prognozy revenue',
      summaryEn: 'This tab projects likely future revenue movement and risk scenarios.',
      summaryPl: 'Ta zakładka prognozuje prawdopodobny ruch revenue i scenariusze ryzyka.',
      actionsEn: [
        'Use forecasts for directional decisions, not false certainty.',
        'Read assumptions before trusting the projection.',
        'Compare forecast movement with real account signals.',
      ],
      actionsPl: [
        'Używasz prognoz do decyzji kierunkowych, a nie do fałszywej pewności.',
        'Zanim zaufasz projekcji, czytasz jej założenia.',
        'Porównujesz ruch forecastu z realnymi sygnałami na kontach.',
      ],
      aiPromptEn:
        'Interpret the current revenue forecast and explain which assumptions are the most fragile.',
      aiPromptPl:
        'Zinterpretuj bieżącą prognozę revenue i wyjaśnij, które założenia są najbardziej kruche.',
      nextEn: 'Validate forecast signals against subscriptions, pricing, and customer lifecycle.',
      nextPl: 'Zwaliduj sygnały forecastu wobec subscriptions, pricing i customer lifecycle.',
    },
    {
      id: 'superadmin_revenue_payments',
      icon: 'Wallet',
      titleEn: 'Payment Methods',
      titlePl: 'Metody płatności',
      summaryEn: 'This tab manages payment rails and their health in the commercial flow.',
      summaryPl: 'Ta zakładka zarządza metodami płatności i ich zdrowiem w przepływie komercyjnym.',
      actionsEn: [
        'Inspect failures and friction before changing payment setup.',
        'Separate payment-provider issues from billing logic.',
        'Protect continuity for active customers.',
      ],
      actionsPl: [
        'Przed zmianą setupu płatności sprawdzasz awarie i tarcie.',
        'Oddzielasz problemy payment providera od logiki billingu.',
        'Chronisz ciągłość dla aktywnych klientów.',
      ],
      aiPromptEn:
        'Review the current payment-method context and identify the most likely source of payment friction.',
      aiPromptPl:
        'Przejrzyj bieżący kontekst metod płatności i wskaż najbardziej prawdopodobne źródło tarcia płatniczego.',
      nextEn: 'If the issue spreads, validate invoices, billing, and customer account state.',
      nextPl: 'Jeśli problem się rozszerza, zweryfikuj faktury, billing i stan konta klienta.',
    },
    {
      id: 'superadmin_content_email_templates',
      icon: 'Mail',
      titleEn: 'Email Templates',
      titlePl: 'Szablony email',
      summaryEn: 'This tab manages reusable outbound email content used by the platform.',
      summaryPl:
        'Ta zakładka zarządza wielokrotnego użytku treściami email wysyłanymi przez platformę.',
      actionsEn: [
        'Keep language consistent with the platform state.',
        'Avoid sending risky or outdated guidance.',
        'Review triggers and audience fit before publishing.',
      ],
      actionsPl: [
        'Utrzymujesz język zgodny ze stanem platformy.',
        'Unikasz wysyłania ryzykownych albo przestarzałych instrukcji.',
        'Przed publikacją sprawdzasz triggery i dopasowanie do odbiorcy.',
      ],
      aiPromptEn:
        'Review the current email templates and identify which ones are inconsistent, outdated, or risky.',
      aiPromptPl:
        'Przejrzyj bieżące szablony email i wskaż, które są niespójne, przestarzałe albo ryzykowne.',
      nextEn: 'Validate major wording changes against communication and support flows.',
      nextPl: 'Po większych zmianach wordingowych zweryfikuj communication i support flows.',
    },
    {
      id: 'superadmin_content_partner_outreach',
      icon: 'Megaphone',
      titleEn: 'Partner Outreach',
      titlePl: 'Partner Outreach',
      summaryEn: 'This tab manages partner-facing outreach content and operational messaging.',
      summaryPl: 'Ta zakładka zarządza partner-facing outreach content i komunikacją operacyjną.',
      actionsEn: [
        'Match messaging to the current partner state.',
        'Review audience, timing, and consequence before sending.',
        'Keep outbound sequences operationally aligned.',
      ],
      actionsPl: [
        'Dopasowujesz przekaz do bieżącego stanu partnera.',
        'Przed wysyłką sprawdzasz odbiorcę, timing i konsekwencje.',
        'Utrzymujesz zgodność sekwencji outbound z operacją.',
      ],
      aiPromptEn:
        'Review the current partner outreach setup and suggest the clearest, safest next messaging actions.',
      aiPromptPl:
        'Przejrzyj bieżący setup partner outreach i zaproponuj najjaśniejsze oraz najbezpieczniejsze kolejne działania komunikacyjne.',
      nextEn:
        'Validate partner response and customer-facing consequences after major outreach changes.',
      nextPl:
        'Po większych zmianach outreach zweryfikuj reakcję partnerów i konsekwencje customer-facing.',
    },
    {
      id: 'superadmin_configuration_settings',
      icon: 'Settings',
      titleEn: 'Platform Settings',
      titlePl: 'Ustawienia platformy',
      summaryEn: 'This tab manages platform-wide settings and environment-level behavior.',
      summaryPl:
        'Ta zakładka zarządza ustawieniami całej platformy i zachowaniem na poziomie środowiska.',
      actionsEn: [
        'Review impact before changing defaults.',
        'Separate cosmetic settings from operational settings.',
        'Validate behavior after every material update.',
      ],
      actionsPl: [
        'Przed zmianą defaultów sprawdzasz wpływ.',
        'Oddzielasz ustawienia kosmetyczne od operacyjnych.',
        'Po każdej istotnej aktualizacji walidujesz zachowanie.',
      ],
      aiPromptEn:
        'Review current platform settings and identify the changes most likely to affect users or operators.',
      aiPromptPl:
        'Przejrzyj bieżące ustawienia platformy i wskaż zmiany, które najpewniej wpłyną na użytkowników albo operatorów.',
      nextEn:
        'If branding is involved, continue into white-label; if trust is involved, continue into security.',
      nextPl:
        'Jeśli chodzi o branding, przejdź do white-label; jeśli o zaufanie, przejdź do security.',
    },
    {
      id: 'superadmin_configuration_legal',
      icon: 'Scale',
      titleEn: 'Legal',
      titlePl: 'Legal',
      summaryEn: 'This tab manages legal content and regulated wording shown by the platform.',
      summaryPl:
        'Ta zakładka zarządza treściami prawnymi i regulowanym wordingiem widocznym na platformie.',
      actionsEn: [
        'Keep legal wording versioned and reviewable.',
        'Avoid silent changes to regulated content.',
        'Coordinate with compliance when legal text changes materially.',
      ],
      actionsPl: [
        'Utrzymujesz wersjonowanie i review dla wordingów prawnych.',
        'Unikasz cichych zmian treści regulowanych.',
        'Przy istotnych zmianach tekstu koordynujesz się z compliance.',
      ],
      aiPromptEn:
        'Review the current legal content setup and identify which areas need the most careful human review.',
      aiPromptPl:
        'Przejrzyj bieżący układ treści prawnych i wskaż obszary wymagające najbardziej uważnego ludzkiego review.',
      nextEn: 'Validate affected screens and compliance workflows after legal updates.',
      nextPl: 'Po aktualizacji treści prawnych zweryfikuj dotknięte ekrany i workflow compliance.',
    },
    {
      id: 'superadmin_analytics_dashboards',
      icon: 'LayoutDashboard',
      titleEn: 'Dashboard Builder',
      titlePl: 'Dashboard Builder',
      summaryEn: 'This tab manages analytics dashboards and how decision-makers see platform data.',
      summaryPl:
        'Ta zakładka zarządza dashboardami analytics i tym, jak decydenci widzą dane platformy.',
      actionsEn: [
        'Design dashboards around decisions, not just data volume.',
        'Keep signal hierarchy clear.',
        'Validate whether the board still matches actual operator needs.',
      ],
      actionsPl: [
        'Projektujesz dashboardy wokół decyzji, a nie tylko wolumenu danych.',
        'Utrzymujesz jasną hierarchię sygnałów.',
        'Walidujesz czy tablica nadal odpowiada realnym potrzebom operatorów.',
      ],
      aiPromptEn:
        'Review the current dashboard design and identify the clearest improvements for signal quality and decision support.',
      aiPromptPl:
        'Przejrzyj bieżący projekt dashboardu i wskaż najczytelniejsze usprawnienia jakości sygnału oraz wsparcia decyzji.',
      nextEn:
        'Check reports, metrics, or predictive views if the issue is analytical rather than layout-related.',
      nextPl:
        'Sprawdź reports, metrics albo predictive views, jeśli problem jest analityczny, a nie layoutowy.',
    },
    {
      id: 'superadmin_analytics_demo_trial',
      icon: 'FlaskConical',
      titleEn: 'Demo & Trial Analytics',
      titlePl: 'Analityka demo i trial',
      summaryEn:
        'This tab tracks acquisition and trial motion before accounts become long-term customers.',
      summaryPl:
        'Ta zakładka śledzi ruch pozyskania i trial zanim konta staną się klientami długoterminowymi.',
      actionsEn: [
        'Read conversion signal in context, not only top-line counts.',
        'Look for friction before blaming channel quality.',
        'Compare trial behavior with later customer outcomes.',
      ],
      actionsPl: [
        'Czytasz sygnał konwersji w kontekście, a nie tylko z top-line counts.',
        'Szukasz tarcia zanim obwinisz jakość kanału.',
        'Porównujesz zachowanie trial z późniejszymi wynikami klientów.',
      ],
      aiPromptEn:
        'Interpret the current demo and trial analytics and point out the biggest conversion risks.',
      aiPromptPl:
        'Zinterpretuj bieżącą analitykę demo i trial oraz wskaż największe ryzyka konwersji.',
      nextEn: 'Take action in communication, lifecycle, or product onboarding if needed.',
      nextPl:
        'W razie potrzeby podejmij działanie w communication, lifecycle albo product onboarding.',
    },
    {
      id: 'superadmin_analytics_reports',
      icon: 'FileText',
      titleEn: 'Saved Reports',
      titlePl: 'Zapisane raporty',
      summaryEn: 'This tab manages analytics reporting assets and reusable decision outputs.',
      summaryPl:
        'Ta zakładka zarządza assetami raportowymi analytics i wielokrotnego użytku outputami decyzyjnymi.',
      actionsEn: [
        'Keep reports current and decision-oriented.',
        'Retire stale reporting views when they stop creating value.',
        'Protect consistency between source metrics and reported output.',
      ],
      actionsPl: [
        'Utrzymujesz raporty jako aktualne i zorientowane na decyzję.',
        'Wycofujesz przestarzałe widoki raportowe, gdy przestają dawać wartość.',
        'Chronisz spójność między source metrics a raportowanym outputem.',
      ],
      aiPromptEn:
        'Review saved reports and identify which ones are stale, noisy, or high-value for leadership.',
      aiPromptPl:
        'Przejrzyj zapisane raporty i wskaż, które są przestarzałe, zbyt głośne albo najbardziej wartościowe dla leadershipu.',
      nextEn:
        'Continue into dashboards or metrics if the issue lives in source design rather than report packaging.',
      nextPl:
        'Przejdź do dashboards albo metrics, jeśli problem leży w źródłowym projekcie, a nie w opakowaniu raportu.',
    },
    {
      id: 'superadmin_analytics_metrics',
      icon: 'BarChart3',
      titleEn: 'Business Metrics',
      titlePl: 'Business Metrics',
      summaryEn:
        'This tab tracks business-facing metrics used for strategic steering of the platform.',
      summaryPl:
        'Ta zakładka śledzi business-facing metryki używane do strategicznego sterowania platformą.',
      actionsEn: [
        'Watch relationships between metrics, not isolated charts.',
        'Validate whether a shift is meaningful for the business.',
        'Use metrics to guide priorities in revenue, customers, and AI.',
      ],
      actionsPl: [
        'Obserwujesz relacje między metrykami, a nie pojedyncze wykresy.',
        'Walidujesz czy zmiana ma realne znaczenie biznesowe.',
        'Używasz metryk do ustawiania priorytetów w revenue, customers i AI.',
      ],
      aiPromptEn:
        'Interpret the current business metrics and explain which changes matter most for platform strategy.',
      aiPromptPl:
        'Zinterpretuj bieżące business metrics i wyjaśnij, które zmiany mają największe znaczenie dla strategii platformy.',
      nextEn:
        'Take action in the owning operational module once a metric pattern becomes actionable.',
      nextPl:
        'Podejmij działanie w module właścicielskim, gdy wzorzec metryki stanie się actionable.',
    },
    {
      id: 'superadmin_analytics_predictive',
      icon: 'Brain',
      titleEn: 'Predictive Analytics',
      titlePl: 'Predictive Analytics',
      summaryEn:
        'This tab uses predictive signal to look ahead at likely risk and opportunity zones.',
      summaryPl:
        'Ta zakładka wykorzystuje sygnał predykcyjny do spojrzenia wprzód na prawdopodobne strefy ryzyka i szans.',
      actionsEn: [
        'Treat predictive outputs as directional support, not certainty.',
        'Read assumptions before reacting.',
        'Validate predictions against live signals.',
      ],
      actionsPl: [
        'Traktujesz output predykcyjny jako wsparcie kierunkowe, a nie pewność.',
        'Przed reakcją czytasz założenia.',
        'Walidujesz predykcje względem sygnałów live.',
      ],
      aiPromptEn:
        'Review the current predictive analytics outputs and explain which predicted risks deserve early action.',
      aiPromptPl:
        'Przejrzyj bieżące outputy predictive analytics i wyjaśnij, które prognozowane ryzyka zasługują na wczesne działanie.',
      nextEn: 'Confirm predicted issues in live operations before escalating broadly.',
      nextPl: 'Potwierdź prognozowane problemy w live operations zanim zrobisz szeroką eskalację.',
    },
    {
      id: 'superadmin_ai_configuration_llm_providers',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Cpu',
      titleEn: 'LLM Providers',
      titlePl: 'LLM Providers',
      summaryEn: 'This tab manages enabled AI providers and their production readiness posture.',
      summaryPl: 'Ta zakładka zarządza aktywnymi providerami AI i ich gotowością produkcyjną.',
      actionsEn: [
        'Review provider health and role before changing availability.',
        'Know why a provider exists in the stack.',
        'Validate fallback impact after any provider change.',
      ],
      actionsPl: [
        'Przed zmianą dostępności sprawdzasz zdrowie providera i jego rolę.',
        'Wiesz, dlaczego provider istnieje w stacku.',
        'Po każdej zmianie providera walidujesz wpływ na fallback.',
      ],
      aiPromptEn:
        'Review the current provider setup and recommend the safest next provider-level change.',
      aiPromptPl:
        'Przejrzyj bieżący setup providerów i zaproponuj najbezpieczniejszą kolejną zmianę na poziomie providerów.',
      nextEn: 'Validate routing and health behavior after provider changes.',
      nextPl: 'Po zmianach providerów zwaliduj routing i health behavior.',
    },
    {
      id: 'superadmin_ai_configuration_model_tiers',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Layers',
      titleEn: 'Model Tiers',
      titlePl: 'Model Tiers',
      summaryEn: 'This tab defines which models are assigned to each operational tier.',
      summaryPl:
        'Ta zakładka definiuje, które modele są przypisane do poszczególnych tierów operacyjnych.',
      actionsEn: [
        'Keep tier intent clear.',
        'Balance quality, latency, and cost per tier.',
        'Validate tier changes against real workloads.',
      ],
      actionsPl: [
        'Utrzymujesz jasną intencję każdego tieru.',
        'Równoważysz jakość, opóźnienie i koszt per tier.',
        'Walidujesz zmiany tierów na realnych workloadach.',
      ],
      aiPromptEn:
        'Review current model-tier assignments and identify the highest-risk or highest-value optimization.',
      aiPromptPl:
        'Przejrzyj bieżące przypisania model-tier i wskaż optymalizację o najwyższym ryzyku albo najwyższej wartości.',
      nextEn: 'Check routing and performance after tier updates.',
      nextPl: 'Po aktualizacji tierów sprawdź routing i performance.',
    },
    {
      id: 'superadmin_ai_configuration_routing_rules',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Route',
      titleEn: 'Routing Rules',
      titlePl: 'Routing Rules',
      summaryEn: 'This tab controls how traffic is routed across models and providers.',
      summaryPl: 'Ta zakładka kontroluje sposób routingu ruchu między modelami i providerami.',
      actionsEn: [
        'Change one rule dimension at a time.',
        'Keep fallback logic explicit.',
        'Validate routing on real capability paths.',
      ],
      actionsPl: [
        'Zmieniasz jedną warstwę reguł naraz.',
        'Utrzymujesz jawną logikę fallbacku.',
        'Walidujesz routing na realnych ścieżkach capability.',
      ],
      aiPromptEn: 'Review the current routing rules and recommend the safest next adjustment.',
      aiPromptPl:
        'Przejrzyj bieżące routing rules i zaproponuj najbezpieczniejszą kolejną korektę.',
      nextEn: 'Watch health, latency, and failure patterns after routing changes.',
      nextPl: 'Po zmianach routingu obserwuj health, latency i failure patterns.',
    },
    {
      id: 'superadmin_ai_configuration_purposes_assignments',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Target',
      titleEn: 'Purposes & Assignments',
      titlePl: 'Purposes & Assignments',
      summaryEn:
        'This tab connects model purpose, capability, and ownership logic across the AI platform.',
      summaryPl:
        'Ta zakładka łączy logikę celu modelu, capability i ownershipu w całej platformie AI.',
      actionsEn: [
        'Keep purpose boundaries explicit.',
        'Review whether ownership matches actual use.',
        'Avoid ambiguous assignments that create routing confusion.',
      ],
      actionsPl: [
        'Utrzymujesz jawne granice purpose.',
        'Sprawdzasz czy ownership odpowiada realnemu użyciu.',
        'Unikasz niejednoznacznych przypisań tworzących zamieszanie w routingu.',
      ],
      aiPromptEn:
        'Review purposes and assignments and identify which mappings are unclear or risky.',
      aiPromptPl: 'Przejrzyj purposes i assignments oraz wskaż mapowania niejasne albo ryzykowne.',
      nextEn: 'Re-check governance and routing after assignment changes.',
      nextPl: 'Po zmianach przypisań ponownie sprawdź governance i routing.',
    },
    {
      id: 'superadmin_ai_configuration_org_policy',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Globe',
      titleEn: 'Org AI Policy',
      titlePl: 'Org AI Policy',
      summaryEn: 'This tab defines organization-facing AI constraints and policy shape.',
      summaryPl:
        'Ta zakładka definiuje ograniczenia AI skierowane do organizacji i kształt polityki.',
      actionsEn: [
        'Review policy intent before settings.',
        'Keep customer-facing constraints understandable.',
        'Validate policy behavior against real org scenarios.',
      ],
      actionsPl: [
        'Przed ustawieniami sprawdzasz intencję polityki.',
        'Utrzymujesz zrozumiałość customer-facing constraints.',
        'Walidujesz zachowanie polityki na realnych scenariuszach organizacji.',
      ],
      aiPromptEn:
        'Review the current org AI policy setup and identify the strongest risk or clarity gaps.',
      aiPromptPl:
        'Przejrzyj bieżący setup org AI policy i wskaż największe luki ryzyka albo czytelności.',
      nextEn: 'Validate effects in customers, security, and AI behavior after policy changes.',
      nextPl: 'Po zmianach polityki zwaliduj efekty w customers, security i zachowaniu AI.',
    },
    {
      id: 'superadmin_ai_configuration_governance',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Shield',
      titleEn: 'AI Governance',
      titlePl: 'AI Governance',
      summaryEn: 'This tab governs the rules and guardrails around AI behavior at platform level.',
      summaryPl:
        'Ta zakładka zarządza regułami i guardrailami zachowania AI na poziomie platformy.',
      actionsEn: [
        'Treat governance changes as production-risk changes.',
        'Link every control to a clear reason.',
        'Validate unintended restrictions or gaps.',
      ],
      actionsPl: [
        'Traktujesz zmiany governance jak zmiany ryzyka produkcyjnego.',
        'Każdą kontrolkę łączysz z jasnym uzasadnieniem.',
        'Walidujesz niezamierzone restrykcje albo luki.',
      ],
      aiPromptEn:
        'Review the current AI governance setup and identify the most important control gaps or overlaps.',
      aiPromptPl:
        'Przejrzyj bieżący setup AI governance i wskaż najważniejsze luki albo nakładanie się kontrolek.',
      nextEn: 'Watch compliance and operations after governance updates.',
      nextPl: 'Po aktualizacji governance obserwuj compliance i operations.',
    },
    {
      id: 'superadmin_ai_configuration_global_settings',
      moduleId: 'superadmin_ai_infrastructure',
      icon: 'Settings',
      titleEn: 'AI Global Settings',
      titlePl: 'AI Global Settings',
      summaryEn: 'This tab sets global defaults that shape broad AI behavior platform-wide.',
      summaryPl:
        'Ta zakładka ustawia globalne defaulty kształtujące szerokie zachowanie AI w całej platformie.',
      actionsEn: [
        'Use slow, explicit change management.',
        'Check what inherits from the global layer.',
        'Validate downstream modules after updates.',
      ],
      actionsPl: [
        'Używasz powolnego, jawnego zarządzania zmianą.',
        'Sprawdzasz co dziedziczy z warstwy globalnej.',
        'Po aktualizacji walidujesz moduły downstream.',
      ],
      aiPromptEn:
        'Review the current AI global settings and explain which defaults are the most sensitive.',
      aiPromptPl:
        'Przejrzyj bieżące AI global settings i wyjaśnij, które defaulty są najbardziej wrażliwe.',
      nextEn: 'Verify downstream behavior in development and operations.',
      nextPl: 'Zweryfikuj zachowanie downstream w development i operations.',
    },
    {
      id: 'superadmin_ai_development_prompts_library',
      moduleId: 'superadmin_ai_development',
      icon: 'FileText',
      titleEn: 'Prompts Library',
      titlePl: 'Prompts Library',
      summaryEn: 'This tab manages the approved prompt inventory used across AI flows.',
      summaryPl: 'Ta zakładka zarządza zatwierdzonym inventory promptów używanych w flow AI.',
      actionsEn: [
        'Keep prompts named clearly and scoped intentionally.',
        'Review reuse before creating new prompts.',
        'Track why a prompt exists, not only its text.',
      ],
      actionsPl: [
        'Utrzymujesz czytelne nazwy promptów i świadomy zakres ich użycia.',
        'Przed tworzeniem nowych promptów sprawdzasz reuse.',
        'Śledzisz dlaczego prompt istnieje, a nie tylko jego tekst.',
      ],
      aiPromptEn:
        'Review the prompt library and identify duplication, stale prompts, or weak naming.',
      aiPromptPl:
        'Przejrzyj bibliotekę promptów i wskaż duplikację, przestarzałe prompty albo słabe nazewnictwo.',
      nextEn: 'Go into prompt builder or experiments if a prompt needs structural change.',
      nextPl:
        'Przejdź do prompt builder albo experiments, jeśli prompt wymaga zmiany strukturalnej.',
    },
    {
      id: 'superadmin_ai_development_prompt_builder',
      moduleId: 'superadmin_ai_development',
      icon: 'Code',
      titleEn: 'Prompt Builder',
      titlePl: 'Prompt Builder',
      summaryEn: 'This tab is for designing or refining a prompt before broader rollout.',
      summaryPl:
        'Ta zakładka służy do projektowania albo dopracowywania promptu przed szerszym rolloutem.',
      actionsEn: [
        'Edit prompts as behavior design, not copywriting only.',
        'Keep instructions testable.',
        'Validate expected outcome before release.',
      ],
      actionsPl: [
        'Edytujesz prompty jak projektowanie zachowania, a nie tylko copywriting.',
        'Utrzymujesz instrukcje jako testowalne.',
        'Przed wydaniem walidujesz oczekiwany rezultat.',
      ],
      aiPromptEn:
        'Review the current prompt draft and suggest the clearest improvements for reliability and intent.',
      aiPromptPl:
        'Przejrzyj bieżący draft promptu i zaproponuj najczytelniejsze ulepszenia dla reliability i intent.',
      nextEn: 'Run experiments or compare outputs before publishing broad changes.',
      nextPl: 'Przed szeroką publikacją uruchom eksperymenty albo porównanie outputów.',
    },
    {
      id: 'superadmin_ai_development_experiments',
      moduleId: 'superadmin_ai_development',
      icon: 'FlaskConical',
      titleEn: 'Experiments',
      titlePl: 'Experiments',
      summaryEn:
        'This tab compares prompt, model, or configuration changes under controlled conditions.',
      summaryPl:
        'Ta zakładka porównuje zmiany promptów, modeli albo konfiguracji w warunkach kontrolowanych.',
      actionsEn: [
        'Define success before reading the result.',
        'Compare variants on the same evaluation frame.',
        'Watch for side effects, not only wins.',
      ],
      actionsPl: [
        'Przed odczytem wyniku definiujesz sukces.',
        'Porównujesz warianty w tym samym frame oceny.',
        'Obserwujesz nie tylko wygrane, ale też skutki uboczne.',
      ],
      aiPromptEn:
        'Review current experiment results and identify the most trustworthy learning and the biggest risk.',
      aiPromptPl:
        'Przejrzyj bieżące wyniki eksperymentów i wskaż najbardziej wiarygodny wniosek oraz największe ryzyko.',
      nextEn: 'Validate promising changes in operations before treating them as production-safe.',
      nextPl: 'Obiecujące zmiany zweryfikuj w operations zanim uznasz je za production-safe.',
    },
    {
      id: 'superadmin_ai_development_model_registry',
      moduleId: 'superadmin_ai_development',
      icon: 'Database',
      titleEn: 'Model Registry',
      titlePl: 'Model Registry',
      summaryEn: 'This tab governs the approved inventory of models and their metadata.',
      summaryPl: 'Ta zakładka zarządza zatwierdzonym inventory modeli i ich metadanymi.',
      actionsEn: [
        'Review capability metadata and lifecycle status.',
        'Keep model records aligned with actual availability.',
        'Treat registry accuracy as operational hygiene.',
      ],
      actionsPl: [
        'Przeglądasz capability metadata i status lifecycle.',
        'Utrzymujesz rekordy modeli zgodne z realną dostępnością.',
        'Traktujesz dokładność rejestru jako higienę operacyjną.',
      ],
      aiPromptEn:
        'Review the current model registry and identify stale, risky, or unclear model records.',
      aiPromptPl:
        'Przejrzyj bieżący model registry i wskaż przestarzałe, ryzykowne albo niejasne rekordy modeli.',
      nextEn: 'Re-check configuration and routing after registry changes.',
      nextPl: 'Po zmianach rejestru ponownie sprawdź configuration i routing.',
    },
    {
      id: 'superadmin_ai_operations_mission_control',
      moduleId: 'superadmin_ai_operations',
      icon: 'Radar',
      titleEn: 'Mission Control',
      titlePl: 'Mission Control',
      summaryEn: 'This tab is the live incident and watch-floor for AI production behavior.',
      summaryPl:
        'Ta zakładka to żywy watch-floor i warstwa incydentowa dla zachowania AI na produkcji.',
      actionsEn: [
        'Watch live failures and instability first.',
        'Separate temporary provider noise from meaningful incident signal.',
        'Coordinate response with configuration and development.',
      ],
      actionsPl: [
        'Najpierw obserwujesz live failures i niestabilność.',
        'Oddzielasz chwilowy szum providera od realnego sygnału incydentu.',
        'Koordynujesz reakcję z configuration i development.',
      ],
      aiPromptEn:
        'Review mission control and identify which live AI issues need immediate operator attention.',
      aiPromptPl:
        'Przejrzyj mission control i wskaż, które live problemy AI wymagają natychmiastowej uwagi operatora.',
      nextEn: 'Move into health, performance, or configuration depending on the root signal.',
      nextPl: 'Przejdź do health, performance albo configuration zależnie od sygnału root.',
    },
    {
      id: 'superadmin_ai_operations_health',
      moduleId: 'superadmin_ai_operations',
      icon: 'HeartPulse',
      titleEn: 'Health Monitoring',
      titlePl: 'Health Monitoring',
      summaryEn: 'This tab tracks provider and service health across the AI stack.',
      summaryPl: 'Ta zakładka śledzi zdrowie providerów i usług w całym stacku AI.',
      actionsEn: [
        'Read health in context of traffic and incidents.',
        'Differentiate transient degradation from real breakage.',
        'Check fallback readiness before acting.',
      ],
      actionsPl: [
        'Czytasz health w kontekście ruchu i incydentów.',
        'Rozróżniasz przejściową degradację od realnego uszkodzenia.',
        'Przed działaniem sprawdzasz gotowość fallbacku.',
      ],
      aiPromptEn:
        'Review AI health monitoring and explain the most likely weak spots in the current stack.',
      aiPromptPl:
        'Przejrzyj AI health monitoring i wyjaśnij najbardziej prawdopodobne słabe punkty w bieżącym stacku.',
      nextEn: 'If health drift persists, investigate routing, providers, or incident patterns.',
      nextPl: 'Jeśli dryf health się utrzymuje, zbadaj routing, providerów albo wzorce incydentów.',
    },
    {
      id: 'superadmin_ai_operations_performance',
      moduleId: 'superadmin_ai_operations',
      icon: 'Activity',
      titleEn: 'Performance Dashboard',
      titlePl: 'Performance Dashboard',
      summaryEn: 'This tab shows latency and throughput behavior of the AI stack.',
      summaryPl: 'Ta zakładka pokazuje zachowanie latency i throughput w stacku AI.',
      actionsEn: [
        'Watch distribution, not only averages.',
        'Tie performance changes to traffic or config shifts.',
        'Separate UX pain from pure infrastructure metrics.',
      ],
      actionsPl: [
        'Obserwujesz rozkład, a nie tylko średnie.',
        'Łączysz zmiany wydajności z ruchem albo shiftami konfiguracji.',
        'Oddzielasz ból UX od czystych metryk infrastrukturalnych.',
      ],
      aiPromptEn:
        'Interpret the current AI performance dashboard and identify which performance changes are operationally meaningful.',
      aiPromptPl:
        'Zinterpretuj bieżący AI performance dashboard i wskaż, które zmiany wydajności są operacyjnie istotne.',
      nextEn:
        'Follow up in routing, providers, or mission control if performance degradation persists.',
      nextPl:
        'Kontynuuj w routing, providers albo mission control, jeśli degradacja wydajności się utrzymuje.',
    },
    {
      id: 'superadmin_ai_operations_sla',
      moduleId: 'superadmin_ai_operations',
      icon: 'Shield',
      titleEn: 'SLA Management',
      titlePl: 'SLA Management',
      summaryEn: 'This tab measures AI operations against service expectations and commitments.',
      summaryPl: 'Ta zakładka mierzy operacje AI względem oczekiwań i zobowiązań usługowych.',
      actionsEn: [
        'Read SLA against business context, not only raw uptime.',
        'Track repeated breaches, not isolated noise.',
        'Use SLA to drive corrective action.',
      ],
      actionsPl: [
        'Czytasz SLA w kontekście biznesowym, a nie tylko surowego uptime.',
        'Śledzisz powtarzalne naruszenia, a nie pojedynczy szum.',
        'Używasz SLA do uruchamiania działań korygujących.',
      ],
      aiPromptEn: 'Review SLA management and identify the commitments most at risk right now.',
      aiPromptPl:
        'Przejrzyj SLA management i wskaż zobowiązania najbardziej zagrożone w tym momencie.',
      nextEn: 'Push validated SLA issues into operations or configuration remediation.',
      nextPl: 'Potwierdzone problemy SLA przesuń do remediation w operations albo configuration.',
    },
    {
      id: 'superadmin_ai_operations_market_inbox',
      moduleId: 'superadmin_ai_operations',
      icon: 'Database',
      titleEn: 'Market Inbox',
      titlePl: 'Market Inbox',
      summaryEn:
        'This tab collects external or market-side signals entering the AI operations layer.',
      summaryPl:
        'Ta zakładka zbiera zewnętrzne albo market-side sygnały wchodzące do warstwy AI operations.',
      actionsEn: [
        'Review incoming signals before escalating.',
        'Separate signal quality from urgency.',
        'Route external pressure into the correct internal owner.',
      ],
      actionsPl: [
        'Przeglądasz sygnały przychodzące zanim je eskalujesz.',
        'Oddzielasz jakość sygnału od pilności.',
        'Kierujesz zewnętrzną presję do właściwego właściciela wewnętrznego.',
      ],
      aiPromptEn:
        'Review the current market inbox and identify which external signals deserve operational action.',
      aiPromptPl:
        'Przejrzyj bieżący market inbox i wskaż, które zewnętrzne sygnały zasługują na działanie operacyjne.',
      nextEn: 'Send validated issues into mission control, analytics, or development.',
      nextPl: 'Przekaż zwalidowane tematy do mission control, analytics albo development.',
    },
    {
      id: 'superadmin_ai_analytics_usage',
      moduleId: 'superadmin_ai_operations',
      icon: 'TrendingUp',
      titleEn: 'Usage Analytics',
      titlePl: 'Usage Analytics',
      summaryEn: 'This tab shows how AI is actually used across the platform and by whom.',
      summaryPl: 'Ta zakładka pokazuje jak AI jest realnie używane w platformie i przez kogo.',
      actionsEn: [
        'Read usage by pattern and cohort.',
        'Separate growth from misuse.',
        'Use usage to validate model and prompt strategy.',
      ],
      actionsPl: [
        'Czytasz usage przez wzorce i kohorty.',
        'Oddzielasz wzrost od nadużycia.',
        'Używasz usage do walidacji strategii modeli i promptów.',
      ],
      aiPromptEn:
        'Interpret AI usage analytics and identify the most important operational or product insights.',
      aiPromptPl:
        'Zinterpretuj AI usage analytics i wskaż najważniejsze insighty operacyjne albo produktowe.',
      nextEn: 'Feed meaningful patterns into development, pricing, or governance.',
      nextPl: 'Ważne wzorce przekazuj do development, pricing albo governance.',
    },
    {
      id: 'superadmin_ai_analytics_cost',
      moduleId: 'superadmin_ai_operations',
      icon: 'DollarSign',
      titleEn: 'Cost Analytics',
      titlePl: 'Cost Analytics',
      summaryEn: 'This tab tracks cost behavior of AI workloads and provider mix.',
      summaryPl: 'Ta zakładka śledzi zachowanie kosztowe workloadów AI i miksu providerów.',
      actionsEn: [
        'Watch cost in relation to value and usage.',
        'Separate expected cost growth from waste.',
        'Validate routing and tier choices against spend.',
      ],
      actionsPl: [
        'Obserwujesz koszt w relacji do wartości i usage.',
        'Oddzielasz oczekiwany wzrost kosztu od marnotrawstwa.',
        'Walidujesz routing i wybór tierów względem spendu.',
      ],
      aiPromptEn:
        'Review AI cost analytics and identify the clearest opportunities to reduce waste without harming quality.',
      aiPromptPl:
        'Przejrzyj AI cost analytics i wskaż najczytelniejsze możliwości ograniczenia marnotrawstwa bez szkody dla jakości.',
      nextEn: 'Carry validated changes into tiers, routing, or governance.',
      nextPl: 'Przenieś potwierdzone zmiany do tiers, routingu albo governance.',
    },
    {
      id: 'superadmin_ai_analytics_pricing_registry',
      moduleId: 'superadmin_ai_operations',
      icon: 'DollarSign',
      titleEn: 'Pricing Registry',
      titlePl: 'Pricing Registry',
      summaryEn:
        'This tab maintains pricing references and economic assumptions for AI consumption.',
      summaryPl:
        'Ta zakładka utrzymuje referencje cenowe i założenia ekonomiczne dla konsumpcji AI.',
      actionsEn: [
        'Keep registry data current.',
        'Check whether prices still match provider reality.',
        'Use it as reference, not blind truth.',
      ],
      actionsPl: [
        'Utrzymujesz aktualność danych rejestru.',
        'Sprawdzasz czy ceny nadal odpowiadają realiom providerów.',
        'Używasz go jako referencji, a nie ślepej prawdy.',
      ],
      aiPromptEn: 'Review the pricing registry and identify stale or suspicious cost assumptions.',
      aiPromptPl:
        'Przejrzyj pricing registry i wskaż przestarzałe albo podejrzane założenia kosztowe.',
      nextEn: 'Update cost analytics and governance if core pricing assumptions shift.',
      nextPl: 'Jeśli główne założenia cenowe się zmienią, zaktualizuj cost analytics i governance.',
    },
    {
      id: 'superadmin_ai_analytics_performance_metrics',
      moduleId: 'superadmin_ai_operations',
      icon: 'Gauge',
      titleEn: 'Performance Metrics',
      titlePl: 'Performance Metrics',
      summaryEn:
        'This tab converts raw AI performance into metric views for management and tuning.',
      summaryPl:
        'Ta zakładka zamienia surową wydajność AI w widoki metryczne dla zarządzania i tuningu.',
      actionsEn: [
        'Use metric relationships, not isolated numbers.',
        'Compare metrics against recent config or model changes.',
        'Watch for drift, not only spikes.',
      ],
      actionsPl: [
        'Używasz relacji między metrykami, a nie pojedynczych liczb.',
        'Porównujesz metryki z ostatnimi zmianami konfiguracji albo modeli.',
        'Obserwujesz dryf, a nie tylko skoki.',
      ],
      aiPromptEn:
        'Interpret the current performance metrics and identify the trends that should drive tuning decisions.',
      aiPromptPl:
        'Zinterpretuj bieżące performance metrics i wskaż trendy, które powinny kierować decyzjami tuningowymi.',
      nextEn: 'Feed meaningful patterns into routing, models, and operations.',
      nextPl: 'Ważne wzorce przekazuj do routingu, modeli i operations.',
    },
    {
      id: 'superadmin_ai_analytics_custom_reports',
      moduleId: 'superadmin_ai_operations',
      icon: 'FileBarChart',
      titleEn: 'Custom Reports',
      titlePl: 'Custom Reports',
      summaryEn: 'This tab builds tailored reporting views for AI operations and management.',
      summaryPl: 'Ta zakładka buduje dopasowane widoki raportowe dla AI operations i zarządzania.',
      actionsEn: [
        'Build reports around decisions and owners.',
        'Avoid high-noise reports with weak outcomes.',
        'Keep custom logic aligned with trusted source metrics.',
      ],
      actionsPl: [
        'Budujesz raporty wokół decyzji i właścicieli.',
        'Unikasz raportów o wysokim szumie i słabym outcome.',
        'Utrzymujesz logikę custom zgodną z zaufanymi source metrics.',
      ],
      aiPromptEn:
        'Review current custom reports and identify where report design should be simplified or sharpened.',
      aiPromptPl:
        'Przejrzyj bieżące custom reports i wskaż, gdzie projekt raportu trzeba uprościć albo wyostrzyć.',
      nextEn:
        'Adjust upstream metrics or dashboards if custom reports keep compensating for source problems.',
      nextPl:
        'Dostosuj upstream metrics albo dashboards, jeśli custom reports ciągle kompensują problemy źródłowe.',
    },
    {
      id: 'superadmin_ai_security_api_keys',
      moduleId: 'superadmin_ai_operations',
      icon: 'Key',
      titleEn: 'AI API Keys',
      titlePl: 'AI API Keys',
      summaryEn: 'This tab manages API keys inside the AI platform area and their access posture.',
      summaryPl:
        'Ta zakładka zarządza kluczami API wewnątrz obszaru AI Platform i ich postawą dostępową.',
      actionsEn: [
        'Review key exposure before editing.',
        'Rotate or revoke deliberately.',
        'Validate downstream impact after key changes.',
      ],
      actionsPl: [
        'Przed edycją sprawdzasz ekspozycję klucza.',
        'Rotujesz albo cofasz klucze świadomie.',
        'Po zmianie klucza walidujesz downstream impact.',
      ],
      aiPromptEn: 'Review the current AI API key posture and identify the riskiest access issues.',
      aiPromptPl:
        'Przejrzyj bieżącą postawę AI API key i wskaż najbardziej ryzykowne problemy dostępu.',
      nextEn: 'Validate operations and compliance after key interventions.',
      nextPl: 'Po interwencji na kluczach zwaliduj operations i compliance.',
    },
    {
      id: 'superadmin_ai_security_access_control',
      moduleId: 'superadmin_ai_operations',
      icon: 'Lock',
      titleEn: 'AI Access Control',
      titlePl: 'AI Access Control',
      summaryEn: 'This tab manages who can change, view, or operate AI platform areas.',
      summaryPl:
        'Ta zakładka zarządza tym, kto może zmieniać, oglądać albo obsługiwać obszary AI platformy.',
      actionsEn: [
        'Review access boundaries before broadening permissions.',
        'Keep sensitive controls owned clearly.',
        'Prefer least privilege over convenience.',
      ],
      actionsPl: [
        'Przed poszerzeniem uprawnień sprawdzasz granice dostępu.',
        'Wrażliwe kontrolki mają mieć jasnego właściciela.',
        'Preferujesz least privilege ponad wygodę.',
      ],
      aiPromptEn: 'Review AI access control and identify the most sensitive permission risks.',
      aiPromptPl: 'Przejrzyj AI access control i wskaż najbardziej wrażliwe ryzyka uprawnień.',
      nextEn: 'Validate audit logs and governance after permission changes.',
      nextPl: 'Po zmianie uprawnień zwaliduj audit logs i governance.',
    },
    {
      id: 'superadmin_ai_security_audit_logs',
      moduleId: 'superadmin_ai_operations',
      icon: 'FileSearch',
      titleEn: 'AI Audit Logs',
      titlePl: 'AI Audit Logs',
      summaryEn: 'This tab tracks who changed what inside the AI platform area.',
      summaryPl: 'Ta zakładka śledzi kto zmienił co wewnątrz obszaru AI platformy.',
      actionsEn: [
        'Use logs to reconstruct change intent and sequence.',
        'Check suspicious change clusters, not only isolated events.',
        'Tie logs to rollout and incident windows.',
      ],
      actionsPl: [
        'Używasz logów do odtworzenia intencji i sekwencji zmian.',
        'Sprawdzasz podejrzane klastry zmian, a nie tylko pojedyncze zdarzenia.',
        'Łączysz logi z rolloutami i oknami incydentów.',
      ],
      aiPromptEn:
        'Review the current AI audit logs and summarize the most relevant change sequence.',
      aiPromptPl: 'Przejrzyj bieżące AI audit logs i podsumuj najważniejszą sekwencję zmian.',
      nextEn: 'Use log findings to verify operations, governance, or access control.',
      nextPl:
        'Wykorzystaj findings z logów do weryfikacji operations, governance albo access control.',
    },
    {
      id: 'superadmin_ai_security_compliance',
      moduleId: 'superadmin_ai_operations',
      icon: 'ShieldCheck',
      titleEn: 'AI Compliance',
      titlePl: 'AI Compliance',
      summaryEn: 'This tab manages compliance posture specific to the AI platform domain.',
      summaryPl: 'Ta zakładka zarządza postawą compliance specyficzną dla domeny AI platformy.',
      actionsEn: [
        'Keep evidence and policy intent connected.',
        'Review AI-specific control gaps explicitly.',
        'Coordinate with broader compliance when needed.',
      ],
      actionsPl: [
        'Utrzymujesz powiązanie dowodów z intencją polityk.',
        'Jawnie przeglądasz luki kontrolne specyficzne dla AI.',
        'W razie potrzeby koordynujesz się z szerszym compliance.',
      ],
      aiPromptEn:
        'Review current AI compliance posture and identify the most important evidence or control gaps.',
      aiPromptPl:
        'Przejrzyj bieżącą postawę AI compliance i wskaż najważniejsze luki dowodowe albo kontrolne.',
      nextEn: 'Align findings with governance, security, and central compliance handling.',
      nextPl: 'Uzgodnij findings z governance, security i centralną obsługą compliance.',
    },
    {
      id: 'superadmin_ai_knowledge_base',
      moduleId: 'superadmin_ai_development',
      icon: 'BookOpen',
      titleEn: 'Knowledge Base',
      titlePl: 'Knowledge Base',
      summaryEn: 'This tab manages curated knowledge sources available to AI systems.',
      summaryPl: 'Ta zakładka zarządza kuratowanymi źródłami wiedzy dostępnymi dla systemów AI.',
      actionsEn: [
        'Review source freshness and trust.',
        'Remove noisy or duplicated content.',
        'Keep knowledge aligned with production truth.',
      ],
      actionsPl: [
        'Przeglądasz świeżość i zaufanie źródeł.',
        'Usuwasz szum i duplikację treści.',
        'Utrzymujesz wiedzę zgodną z prawdą produkcyjną.',
      ],
      aiPromptEn:
        'Review the AI knowledge base and identify the highest-value cleanup or curation work.',
      aiPromptPl: 'Przejrzyj AI knowledge base i wskaż cleanup albo kurację o najwyższej wartości.',
      nextEn: 'Validate answer quality and retrieval behavior after changes.',
      nextPl: 'Po zmianach zwaliduj jakość odpowiedzi i zachowanie retrieval.',
    },
    {
      id: 'superadmin_ai_knowledge_documents_rag',
      moduleId: 'superadmin_ai_development',
      icon: 'FileText',
      titleEn: 'Documents (RAG)',
      titlePl: 'Documents (RAG)',
      summaryEn: 'This tab manages document ingestion and RAG-facing knowledge assets.',
      summaryPl: 'Ta zakładka zarządza ingestem dokumentów i assetami wiedzy skierowanymi do RAG.',
      actionsEn: [
        'Review document quality before ingest.',
        'Watch for stale or misleading files.',
        'Treat ingestion changes as answer-quality changes.',
      ],
      actionsPl: [
        'Przed ingestem sprawdzasz jakość dokumentu.',
        'Obserwujesz pliki przestarzałe albo mylące.',
        'Traktujesz zmiany ingestionu jak zmiany jakości odpowiedzi.',
      ],
      aiPromptEn:
        'Review the current RAG document setup and identify the biggest source-quality risks.',
      aiPromptPl:
        'Przejrzyj bieżący setup dokumentów RAG i wskaż największe ryzyka jakości źródeł.',
      nextEn: 'Validate retrieval quality and source freshness after updates.',
      nextPl: 'Po aktualizacjach zwaliduj jakość retrieval i świeżość źródeł.',
    },
    {
      id: 'superadmin_ai_knowledge_strategic_directions',
      moduleId: 'superadmin_ai_development',
      icon: 'Target',
      titleEn: 'Strategic Directions',
      titlePl: 'Strategic Directions',
      summaryEn:
        'This tab manages higher-order guidance that shapes long-range AI behavior and priorities.',
      summaryPl:
        'Ta zakładka zarządza wyższego rzędu guidance, które kształtuje długofalowe zachowanie i priorytety AI.',
      actionsEn: [
        'Keep strategy guidance explicit and stable.',
        'Avoid mixing long-term direction with short-term incidents.',
        'Revisit strategic logic only with clear reason.',
      ],
      actionsPl: [
        'Utrzymujesz strategic guidance jako jawne i stabilne.',
        'Nie mieszasz kierunku długoterminowego z krótkoterminowymi incydentami.',
        'Wracasz do logiki strategicznej tylko z jasnym powodem.',
      ],
      aiPromptEn:
        'Review the current strategic directions and identify where the guidance is unclear, outdated, or misaligned.',
      aiPromptPl:
        'Przejrzyj bieżące strategic directions i wskaż miejsca, gdzie guidance jest niejasne, przestarzałe albo niedopasowane.',
      nextEn: 'Align development, governance, and knowledge work after strategic updates.',
      nextPl:
        'Po aktualizacjach strategicznych uzgodnij development, governance i prace knowledge.',
    },
    {
      id: 'superadmin_security_scim',
      icon: 'Link2',
      titleEn: 'SCIM Provisioning',
      titlePl: 'SCIM Provisioning',
      summaryEn:
        'This tab manages automated identity provisioning between external systems and the platform.',
      summaryPl:
        'Ta zakładka zarządza automatycznym provisioningiem tożsamości między systemami zewnętrznymi a platformą.',
      actionsEn: [
        'Validate sync direction and ownership.',
        'Watch for destructive provisioning drift.',
        'Test mapping behavior before broad rollout.',
      ],
      actionsPl: [
        'Walidujesz kierunek synchronizacji i ownership.',
        'Obserwujesz destrukcyjny dryf provisioningu.',
        'Przed szerokim rolloutem testujesz zachowanie mapowania.',
      ],
      aiPromptEn:
        'Review the current SCIM provisioning setup and identify the riskiest sync or mapping issues.',
      aiPromptPl:
        'Przejrzyj bieżący setup SCIM provisioning i wskaż najbardziej ryzykowne problemy synchronizacji albo mapowania.',
      nextEn: 'Validate users, SSO, and audit logs after SCIM changes.',
      nextPl: 'Po zmianach SCIM zwaliduj users, SSO i audit logs.',
    },
    {
      id: 'superadmin_security_roles',
      icon: 'Shield',
      titleEn: 'Custom Roles',
      titlePl: 'Custom Roles',
      summaryEn: 'This tab manages role design and responsibility boundaries in the platform.',
      summaryPl:
        'Ta zakładka zarządza projektowaniem ról i granic odpowiedzialności na platformie.',
      actionsEn: [
        'Design roles around job reality, not only permission lists.',
        'Avoid role sprawl.',
        'Review impact before publishing role changes.',
      ],
      actionsPl: [
        'Projektujesz role wokół realiów pracy, a nie tylko listy uprawnień.',
        'Unikasz rozrostu ról.',
        'Przed publikacją zmian ról sprawdzasz ich wpływ.',
      ],
      aiPromptEn:
        'Review the current role setup and identify where role design is unclear, duplicated, or risky.',
      aiPromptPl:
        'Przejrzyj bieżący setup ról i wskaż miejsca, gdzie projekt ról jest niejasny, zdublowany albo ryzykowny.',
      nextEn: 'Validate permissions, workflows, and sessions after role changes.',
      nextPl: 'Po zmianie ról zwaliduj permissions, workflows i sessions.',
    },
    {
      id: 'superadmin_security_permissions',
      icon: 'KeyRound',
      titleEn: 'Permissions Matrix',
      titlePl: 'Permissions Matrix',
      summaryEn: 'This tab shows the effective permission structure across roles and capabilities.',
      summaryPl: 'Ta zakładka pokazuje efektywną strukturę uprawnień między rolami i capability.',
      actionsEn: [
        'Use it to reason about access structure, not only isolated toggles.',
        'Check for over-permission and conflict.',
        'Validate the matrix after role or policy changes.',
      ],
      actionsPl: [
        'Używasz jej do rozumienia struktury dostępu, a nie tylko pojedynczych toggle’i.',
        'Sprawdzasz nadmierne uprawnienia i konflikty.',
        'Po zmianach ról albo polityk walidujesz macierz.',
      ],
      aiPromptEn:
        'Review the current permissions matrix and identify the clearest over-permission or conflict risks.',
      aiPromptPl:
        'Przejrzyj bieżącą permissions matrix i wskaż najbardziej czytelne ryzyka over-permission albo konfliktów.',
      nextEn: 'Adjust roles or policies if matrix conflicts persist.',
      nextPl: 'Jeśli konflikty w macierzy się utrzymują, dostosuj role albo polityki.',
    },
    {
      id: 'superadmin_security_sessions',
      icon: 'UserCog',
      titleEn: 'Admin Sessions',
      titlePl: 'Admin Sessions',
      summaryEn: 'This tab tracks active admin sessions and privileged activity presence.',
      summaryPl:
        'Ta zakładka śledzi aktywne sesje administracyjne i obecność uprzywilejowanej aktywności.',
      actionsEn: [
        'Watch for unusual session behavior.',
        'Treat session response as trust-boundary work.',
        'Coordinate with audit and incidents when necessary.',
      ],
      actionsPl: [
        'Obserwujesz nietypowe zachowanie sesji.',
        'Traktujesz reakcję na sesję jako pracę na granicy zaufania.',
        'W razie potrzeby koordynujesz się z audit i incidents.',
      ],
      aiPromptEn:
        'Review current admin sessions and identify which ones deserve security follow-up first.',
      aiPromptPl:
        'Przejrzyj bieżące sesje administracyjne i wskaż, które zasługują na security follow-up jako pierwsze.',
      nextEn: 'Use audit logs and incidents if the session pattern looks suspicious.',
      nextPl: 'Jeśli wzorzec sesji wygląda podejrzanie, użyj audit logs i incidents.',
    },
    {
      id: 'superadmin_security_audit',
      icon: 'History',
      titleEn: 'Security Audit Logs',
      titlePl: 'Security Audit Logs',
      summaryEn: 'This tab is the trace layer for security-relevant administrative changes.',
      summaryPl:
        'Ta zakładka to warstwa śladu dla zmian administracyjnych istotnych z punktu widzenia bezpieczeństwa.',
      actionsEn: [
        'Read sequence and intent, not only isolated events.',
        'Correlate logs with incidents or permission changes.',
        'Preserve audit quality by avoiding silent admin actions.',
      ],
      actionsPl: [
        'Czytasz sekwencję i intencję, a nie tylko pojedyncze zdarzenia.',
        'Korelujesz logi z incydentami albo zmianami uprawnień.',
        'Chronisz jakość audytu, unikając cichych działań administracyjnych.',
      ],
      aiPromptEn:
        'Review the current security audit logs and summarize the most relevant change or incident sequence.',
      aiPromptPl:
        'Przejrzyj bieżące security audit logs i podsumuj najważniejszą sekwencję zmiany albo incydentu.',
      nextEn: 'Use findings to validate sessions, roles, or incident response.',
      nextPl: 'Użyj findings do walidacji sessions, roles albo incident response.',
    },
    {
      id: 'superadmin_security_workflows',
      icon: 'GitBranch',
      titleEn: 'Approval Workflows',
      titlePl: 'Approval Workflows',
      summaryEn: 'This tab manages structured approval paths for sensitive actions.',
      summaryPl:
        'Ta zakładka zarządza ustrukturyzowanymi ścieżkami akceptacji dla wrażliwych działań.',
      actionsEn: [
        'Keep approvals tied to real risk.',
        'Avoid unnecessary friction on low-risk paths.',
        'Validate owner clarity at every step.',
      ],
      actionsPl: [
        'Utrzymujesz akceptacje powiązane z realnym ryzykiem.',
        'Unikasz zbędnego tarcia na ścieżkach niskiego ryzyka.',
        'Na każdym kroku walidujesz jasność ownershipu.',
      ],
      aiPromptEn:
        'Review the current approval workflows and identify where approval logic is too weak or too heavy.',
      aiPromptPl:
        'Przejrzyj bieżące approval workflows i wskaż miejsca, gdzie logika akceptacji jest zbyt słaba albo zbyt ciężka.',
      nextEn: 'Check roles, permissions, and auditability after workflow changes.',
      nextPl: 'Po zmianach workflow sprawdź roles, permissions i audytowalność.',
    },
    {
      id: 'superadmin_security_incidents',
      icon: 'AlertTriangle',
      titleEn: 'Security Incidents',
      titlePl: 'Incydenty bezpieczeństwa',
      summaryEn: 'This tab manages active security incidents and their operational handling.',
      summaryPl:
        'Ta zakładka zarządza aktywnymi incydentami bezpieczeństwa i ich obsługą operacyjną.',
      actionsEn: [
        'Separate suspected incidents from validated ones.',
        'Preserve evidence and timeline integrity.',
        'Coordinate response without creating more risk.',
      ],
      actionsPl: [
        'Oddzielasz podejrzane incydenty od zwalidowanych.',
        'Chronisz integralność dowodów i timeline’u.',
        'Koordynujesz reakcję bez tworzenia dodatkowego ryzyka.',
      ],
      aiPromptEn:
        'Review the current security incidents and recommend the clearest next-response priorities.',
      aiPromptPl:
        'Przejrzyj bieżące incydenty bezpieczeństwa i zaproponuj najczytelniejsze priorytety dalszej reakcji.',
      nextEn: 'Use audit, sessions, and threat views to deepen validated incidents.',
      nextPl: 'Użyj audit, sessions i threat views do pogłębienia zwalidowanych incydentów.',
    },
    {
      id: 'superadmin_security_threats',
      icon: 'Radar',
      titleEn: 'Threat Intelligence',
      titlePl: 'Threat Intelligence',
      summaryEn:
        'This tab surfaces threat patterns and external risk signals relevant to the platform.',
      summaryPl:
        'Ta zakładka pokazuje wzorce zagrożeń i zewnętrzne sygnały ryzyka istotne dla platformy.',
      actionsEn: [
        'Treat threat signals as context, not automatic truth.',
        'Look for corroboration before escalating broadly.',
        'Use threat view to improve preventive posture.',
      ],
      actionsPl: [
        'Traktujesz sygnały zagrożeń jako kontekst, a nie automatyczną prawdę.',
        'Przed szeroką eskalacją szukasz potwierdzenia.',
        'Używasz widoku threat do poprawy postawy prewencyjnej.',
      ],
      aiPromptEn:
        'Review the current threat intelligence signals and identify which ones deserve the strongest attention.',
      aiPromptPl:
        'Przejrzyj bieżące sygnały threat intelligence i wskaż, które zasługują na największą uwagę.',
      nextEn:
        'Escalate only the threat patterns that align with observed incidents or control gaps.',
      nextPl:
        'Eskaluj tylko te wzorce zagrożeń, które pokrywają się z obserwowanymi incydentami albo lukami kontrolnymi.',
    },
    {
      id: 'superadmin_security_dlp',
      icon: 'ShieldAlert',
      titleEn: 'DLP',
      titlePl: 'DLP',
      summaryEn:
        'This tab manages data-loss prevention posture and sensitive data handling controls.',
      summaryPl: 'Ta zakładka zarządza postawą DLP i kontrolkami obsługi danych wrażliwych.',
      actionsEn: [
        'Review what data is protected and how.',
        'Avoid blanket controls that damage operations without real gain.',
        'Validate how DLP rules behave in real workflows.',
      ],
      actionsPl: [
        'Sprawdzasz jakie dane są chronione i w jaki sposób.',
        'Unikasz blanket controls, które psują operację bez realnego zysku.',
        'Walidujesz zachowanie reguł DLP na realnych workflow.',
      ],
      aiPromptEn: 'Review the current DLP setup and identify the highest-risk gaps or overreaches.',
      aiPromptPl:
        'Przejrzyj bieżący setup DLP i wskaż luki o najwyższym ryzyku albo nadmierne restrykcje.',
      nextEn: 'Re-check compliance and operational impact after DLP changes.',
      nextPl: 'Po zmianach DLP ponownie sprawdź compliance i wpływ operacyjny.',
    },
    {
      id: 'superadmin_security_ai_budgets',
      icon: 'DollarSign',
      titleEn: 'AI Budgets',
      titlePl: 'Budżety AI',
      summaryEn: 'This tab governs AI-spend guardrails and budget visibility.',
      summaryPl: 'Ta zakładka zarządza guardrailami wydatków AI i widocznością budżetową.',
      actionsEn: [
        'Review spend against intent and value.',
        'Differentiate expected growth from runaway cost.',
        'Use budgets to guide platform-safe correction.',
      ],
      actionsPl: [
        'Przeglądasz wydatki względem intencji i wartości.',
        'Oddzielasz oczekiwany wzrost od runaway cost.',
        'Używasz budżetów do kierowania platform-safe correction.',
      ],
      aiPromptEn:
        'Review current AI budgets and identify the riskiest spend patterns or weakest guardrails.',
      aiPromptPl:
        'Przejrzyj bieżące budżety AI i wskaż najbardziej ryzykowne wzorce wydatków albo najsłabsze guardraile.',
      nextEn:
        'Coordinate with AI analytics, routing, and governance when budget pressure increases.',
      nextPl: 'Przy rosnącej presji budżetowej koordynuj się z AI analytics, routing i governance.',
    },
    {
      id: 'superadmin_support',
      icon: 'Headphones',
      titleEn: 'Support & Customer Success',
      titlePl: 'Support i Customer Success',
      summaryEn:
        'This area manages active support operations, customer notes, and health-based follow-up.',
      summaryPl:
        'Ten obszar zarządza aktywnym supportem, notatkami customer success i działaniami opartymi o health.',
      actionsEn: [
        'Use this module to coordinate active customer issues.',
        'Keep support context, notes, and health signals connected.',
        'Treat this area as operational follow-through, not only reporting.',
      ],
      actionsPl: [
        'Używasz tego modułu do koordynacji aktywnych problemów klientów.',
        'Łączysz kontekst supportowy, notatki i sygnały health.',
        'Traktujesz ten obszar jako operacyjne domykanie spraw, a nie tylko raportowanie.',
      ],
      aiPromptEn:
        'Review the current support and customer success context and suggest the clearest next operational priorities.',
      aiPromptPl:
        'Przejrzyj bieżący kontekst supportu i customer success oraz zaproponuj najczytelniejsze kolejne priorytety operacyjne.',
      nextEn: 'Go deeper into tickets, CS notes, or customer health depending on the signal.',
      nextPl: 'Zejdź głębiej do tickets, CS notes albo customer health zależnie od sygnału.',
    },
    {
      id: 'superadmin_support_tickets',
      icon: 'Headphones',
      titleEn: 'Support Tickets',
      titlePl: 'Support Tickets',
      summaryEn:
        'This tab is the operational queue for active support tickets and customer-facing problem handling.',
      summaryPl:
        'Ta zakładka jest kolejką operacyjną dla aktywnych ticketów supportowych i obsługi problemów customer-facing.',
      actionsEn: [
        'Prioritize tickets by real customer impact.',
        'Differentiate incidents, questions, and configuration issues.',
        'Keep the owner, status, and next action explicit.',
      ],
      actionsPl: [
        'Priorytetyzujesz tickety według realnego wpływu na klienta.',
        'Rozróżniasz incydenty, pytania i problemy konfiguracyjne.',
        'Utrzymujesz jawnie ownera, status i kolejne działanie.',
      ],
      aiPromptEn:
        'Review the current support tickets and identify the cases that need the fastest, most concrete operator action.',
      aiPromptPl:
        'Przejrzyj bieżące support tickets i wskaż sprawy, które wymagają najszybszego oraz najbardziej konkretnego działania operatora.',
      nextEn:
        'Use notes and customer health to understand broader customer context before escalating.',
      nextPl:
        'Użyj notes i customer health, aby zrozumieć szerszy kontekst klienta przed eskalacją.',
    },
    {
      id: 'superadmin_support_cs_notes',
      icon: 'FileText',
      titleEn: 'Customer Success Notes',
      titlePl: 'CS Notes',
      summaryEn:
        'This tab preserves customer context, internal observations, and continuity for customer success work.',
      summaryPl:
        'Ta zakładka utrwala kontekst klienta, obserwacje wewnętrzne i ciągłość pracy customer success.',
      actionsEn: [
        'Write notes that help the next operator act faster.',
        'Capture signal, context, and implication instead of raw chatter.',
        'Use notes to bridge support and lifecycle work.',
      ],
      actionsPl: [
        'Piszesz notatki, które pomagają kolejnemu operatorowi działać szybciej.',
        'Zapisujesz sygnał, kontekst i implikację zamiast surowego chatteru.',
        'Używasz notatek do łączenia supportu z pracą lifecycle.',
      ],
      aiPromptEn:
        'Review the current CS notes and summarize the most important customer context for the next operator.',
      aiPromptPl:
        'Przejrzyj bieżące CS notes i podsumuj najważniejszy kontekst klienta dla kolejnego operatora.',
      nextEn: 'Validate the notes against live tickets and health signals before acting broadly.',
      nextPl:
        'Przed szerszym działaniem zweryfikuj notatki względem live ticketów i sygnałów health.',
    },
    {
      id: 'superadmin_support_health',
      icon: 'Activity',
      titleEn: 'Customer Health',
      titlePl: 'Customer Health',
      summaryEn:
        'This tab tracks customer health signals used to detect risk, drift, and intervention needs.',
      summaryPl:
        'Ta zakładka śledzi sygnały zdrowia klienta używane do wykrywania ryzyka, dryfu i potrzeby interwencji.',
      actionsEn: [
        'Treat health as an early-warning layer, not a verdict.',
        'Look for movement and deterioration patterns.',
        'Use health to decide where support or CS should intervene first.',
      ],
      actionsPl: [
        'Traktujesz health jako warstwę wczesnego ostrzegania, a nie wyrok.',
        'Szukasz wzorców ruchu i pogorszenia.',
        'Używasz health do decyzji, gdzie support albo CS powinny interweniować najpierw.',
      ],
      aiPromptEn:
        'Interpret the current customer health signals and identify which accounts need the earliest intervention.',
      aiPromptPl:
        'Zinterpretuj bieżące sygnały customer health i wskaż, które konta potrzebują najwcześniejszej interwencji.',
      nextEn: 'Carry the strongest signals into tickets, lifecycle, or customer communication.',
      nextPl: 'Najmocniejsze sygnały przenieś do tickets, lifecycle albo customer communication.',
    },
    {
      id: 'superadmin_system_health',
      icon: 'Activity',
      titleEn: 'System Health',
      titlePl: 'System Health',
      summaryEn:
        'This tab monitors core platform health, service availability, and infrastructure stability.',
      summaryPl:
        'Ta zakładka monitoruje zdrowie rdzenia platformy, dostępność usług i stabilność infrastruktury.',
      actionsEn: [
        'Start with current health before changing anything else.',
        'Differentiate temporary degradation from structural failure.',
        'Use health as the operational entrypoint into deeper system work.',
      ],
      actionsPl: [
        'Zanim zmienisz cokolwiek innego, zaczynasz od bieżącego health.',
        'Rozróżniasz chwilową degradację od strukturalnej awarii.',
        'Używasz health jako wejścia operacyjnego do głębszej pracy systemowej.',
      ],
      aiPromptEn:
        'Review the current system health and identify the most urgent stability checks the operator should run next.',
      aiPromptPl:
        'Przejrzyj bieżący system health i wskaż najpilniejsze kontrole stabilności, które operator powinien wykonać dalej.',
      nextEn:
        'Move into audit, integrations, security, or configuration based on the failing signal.',
      nextPl:
        'Przejdź do audit, integrations, security albo configuration zależnie od sygnału awarii.',
    },
    {
      id: 'superadmin_system_audit',
      icon: 'Shield',
      titleEn: 'System Audit Log',
      titlePl: 'System Audit Log',
      summaryEn: 'This tab reconstructs critical system changes and operator actions over time.',
      summaryPl: 'Ta zakładka odtwarza krytyczne zmiany systemowe i działania operatorów w czasie.',
      actionsEn: [
        'Use audit to reconstruct sequence, ownership, and timing.',
        'Correlate changes with incidents or regressions.',
        'Treat audit quality as a trust boundary.',
      ],
      actionsPl: [
        'Używasz audytu do odtworzenia sekwencji, ownershipu i timingu.',
        'Korelujesz zmiany z incydentami albo regresjami.',
        'Traktujesz jakość audytu jak granicę zaufania.',
      ],
      aiPromptEn:
        'Review the current system audit trail and summarize the change sequence most relevant to today’s operational picture.',
      aiPromptPl:
        'Przejrzyj bieżący system audit trail i podsumuj sekwencję zmian najbardziej istotną dla dzisiejszego obrazu operacyjnego.',
      nextEn: 'Use findings to validate security, configuration, or recovery actions.',
      nextPl: 'Użyj findings do walidacji działań security, configuration albo recovery.',
    },
    {
      id: 'superadmin_system_flags',
      icon: 'Flag',
      titleEn: 'Feature Flags',
      titlePl: 'Feature Flags',
      summaryEn: 'This tab controls rollout switches and behavior gates across the platform.',
      summaryPl: 'Ta zakładka kontroluje przełączniki rolloutów i bramki zachowania na platformie.',
      actionsEn: [
        'Treat flags as production controls, not shortcuts.',
        'Review audience, scope, and rollback path before enabling.',
        'Keep flag inventory readable and intentional.',
      ],
      actionsPl: [
        'Traktujesz flagi jak kontrolki produkcyjne, a nie skróty.',
        'Przed włączeniem sprawdzasz odbiorcę, zakres i rollback path.',
        'Utrzymujesz inventory flag jako czytelne i świadome.',
      ],
      aiPromptEn:
        'Review the current feature flag setup and identify the riskiest toggles, drift, or cleanup opportunities.',
      aiPromptPl:
        'Przejrzyj bieżący setup feature flags i wskaż najbardziej ryzykowne toggles, dryf albo okazje do cleanupu.',
      nextEn: 'Validate downstream behavior and rollback readiness after flag changes.',
      nextPl: 'Po zmianach flag zwaliduj zachowanie downstream i gotowość rollbacku.',
    },
    {
      id: 'superadmin_system_integrations',
      icon: 'Webhook',
      titleEn: 'System Integrations',
      titlePl: 'Integracje systemowe',
      summaryEn: 'This tab manages connectors, webhooks, and other system-to-system paths.',
      summaryPl:
        'Ta zakładka zarządza connectorami, webhookami i innymi ścieżkami system-to-system.',
      actionsEn: [
        'Review data flow before changing an integration.',
        'Check dependencies and downstream consumers.',
        'Treat integration changes as cross-system risk.',
      ],
      actionsPl: [
        'Przed zmianą integracji sprawdzasz przepływ danych.',
        'Kontrolujesz zależności i downstream consumers.',
        'Traktujesz zmiany integracji jak ryzyko cross-system.',
      ],
      aiPromptEn:
        'Review the current integration landscape and identify the connectors or webhooks most likely to create operational risk.',
      aiPromptPl:
        'Przejrzyj bieżący krajobraz integracji i wskaż connectory albo webhooki najbardziej narażone na ryzyko operacyjne.',
      nextEn: 'Validate audit, health, and retry behavior after integration changes.',
      nextPl: 'Po zmianach integracji zwaliduj audit, health i retry behavior.',
    },
    {
      id: 'superadmin_system_security',
      icon: 'Shield',
      titleEn: 'System Security',
      titlePl: 'System Security',
      summaryEn: 'This tab manages security posture specific to platform-level system operations.',
      summaryPl:
        'Ta zakładka zarządza postawą bezpieczeństwa specyficzną dla platform-level system operations.',
      actionsEn: [
        'Review system-level exposure before making security changes.',
        'Separate tenant issues from platform-wide security concerns.',
        'Coordinate tightly with audit and incident handling.',
      ],
      actionsPl: [
        'Przed zmianami security sprawdzasz ekspozycję na poziomie systemowym.',
        'Oddzielasz problemy tenantowe od platform-wide security concerns.',
        'Ściśle koordynujesz się z audytem i obsługą incydentów.',
      ],
      aiPromptEn:
        'Review current system security posture and identify the highest-priority platform risks.',
      aiPromptPl:
        'Przejrzyj bieżącą postawę system security i wskaż najwyżej priorytetyzowane ryzyka platformowe.',
      nextEn: 'Cross-check with audit, health, and API key governance before acting broadly.',
      nextPl: 'Przed szerszym działaniem sprawdź zgodność z audit, health i governance kluczy API.',
    },
    {
      id: 'superadmin_system_configuration',
      icon: 'Settings',
      titleEn: 'System Configuration',
      titlePl: 'Konfiguracja systemu',
      summaryEn:
        'This tab manages platform-level configuration that shapes broad operational behavior.',
      summaryPl:
        'Ta zakładka zarządza konfiguracją platformową kształtującą szerokie zachowanie operacyjne.',
      actionsEn: [
        'Change defaults deliberately and with impact awareness.',
        'Separate local tuning from global configuration shifts.',
        'Validate live behavior after each material update.',
      ],
      actionsPl: [
        'Zmieniasz defaulty świadomie i z pełną świadomością wpływu.',
        'Oddzielasz lokalny tuning od globalnych zmian konfiguracji.',
        'Po każdej istotnej aktualizacji walidujesz zachowanie live.',
      ],
      aiPromptEn:
        'Review the current system configuration and identify the most sensitive settings that deserve extra verification.',
      aiPromptPl:
        'Przejrzyj bieżącą konfigurację systemu i wskaż najbardziej wrażliwe ustawienia wymagające dodatkowej weryfikacji.',
      nextEn: 'Watch health, analytics, and audit signals after configuration changes.',
      nextPl: 'Po zmianach konfiguracji obserwuj sygnały health, analytics i audit.',
    },
    {
      id: 'superadmin_system_analytics',
      icon: 'BarChart3',
      titleEn: 'System Analytics',
      titlePl: 'Analityka systemowa',
      summaryEn:
        'This tab reveals system-wide operational patterns and platform-level reporting signals.',
      summaryPl:
        'Ta zakładka pokazuje system-wide wzorce operacyjne i platform-level sygnały raportowe.',
      actionsEn: [
        'Use analytics to detect pattern, not just volume.',
        'Read trends across system domains.',
        'Turn analytical signals into operational priorities.',
      ],
      actionsPl: [
        'Używasz analytics do wykrywania wzorców, a nie tylko wolumenu.',
        'Czytasz trendy pomiędzy domenami systemowymi.',
        'Zamieniasz sygnały analityczne w priorytety operacyjne.',
      ],
      aiPromptEn:
        'Interpret current system analytics and identify the patterns that deserve the fastest operational follow-up.',
      aiPromptPl:
        'Zinterpretuj bieżącą analitykę systemową i wskaż wzorce wymagające najszybszego operacyjnego follow-upu.',
      nextEn: 'Push validated patterns into health, integrations, or configuration work.',
      nextPl: 'Potwierdzone wzorce przekazuj do prac w health, integrations albo configuration.',
    },
    {
      id: 'superadmin_system_backup',
      icon: 'HardDrive',
      titleEn: 'Backup & Recovery',
      titlePl: 'Backup i Recovery',
      summaryEn:
        'This tab manages backup posture, restore readiness, and disaster recovery discipline.',
      summaryPl:
        'Ta zakładka zarządza postawą backupową, gotowością do restore i dyscypliną disaster recovery.',
      actionsEn: [
        'Review restore readiness, not only backup existence.',
        'Treat backup status as operational resilience evidence.',
        'Validate recovery paths before an incident forces you to.',
      ],
      actionsPl: [
        'Sprawdzasz gotowość restore, a nie tylko istnienie backupu.',
        'Traktujesz status backupów jako dowód odporności operacyjnej.',
        'Walidujesz ścieżki recovery zanim zmusi Cię do tego incydent.',
      ],
      aiPromptEn:
        'Review current backup and recovery posture and explain the most important resilience gaps.',
      aiPromptPl:
        'Przejrzyj bieżącą postawę backup i recovery oraz wyjaśnij najważniejsze luki odporności.',
      nextEn: 'Coordinate with health, audit, and configuration after resilience changes.',
      nextPl: 'Po zmianach odporności koordynuj się z health, audit i configuration.',
    },
    {
      id: 'superadmin_system_api_keys',
      icon: 'Key',
      titleEn: 'System API Keys',
      titlePl: 'System API Keys',
      summaryEn: 'This tab manages platform-level API keys and their trust boundaries.',
      summaryPl: 'Ta zakładka zarządza platformowymi kluczami API i granicami ich zaufania.',
      actionsEn: [
        'Review exposure and ownership before rotating or revoking keys.',
        'Use the minimum necessary scope.',
        'Validate downstream consumers after key changes.',
      ],
      actionsPl: [
        'Przed rotacją albo cofnięciem kluczy sprawdzasz ekspozycję i ownership.',
        'Używasz minimalnego koniecznego zakresu.',
        'Po zmianach kluczy walidujesz downstream consumers.',
      ],
      aiPromptEn:
        'Review the current system API key posture and identify the most sensitive trust or exposure risks.',
      aiPromptPl:
        'Przejrzyj bieżącą postawę system API keys i wskaż najbardziej wrażliwe ryzyka zaufania albo ekspozycji.',
      nextEn: 'Coordinate with security, audit, and integrations after key changes.',
      nextPl: 'Po zmianach kluczy koordynuj się z security, audit i integrations.',
    },
  ].map((seed) => [seed.id, createTabDoc(seed as TabDocSeed)])
);

Object.assign(HELP_DOCUMENTS, SUPERADMIN_RUNTIME_DOCUMENTS);

export function getMaintenancePacks(language: SupportedHelpLanguage) {
  return HELP_MAINTENANCE_PACKS.map((pack) => ({
    ...pack,
    title: getLocalizedText(pack.title, language),
    description: getLocalizedText(pack.description, language),
  }));
}

export function getHelpDocumentsByKind(kind: HelpExperienceKind): HelpDocument[] {
  return Object.values(HELP_DOCUMENTS).filter((document) => document.kind === kind);
}

export function getPromptLibrary() {
  return Object.values(HELP_DOCUMENTS).reduce<Record<string, HelpAskAiAction>>((acc, document) => {
    acc[document.id] = document.askAiNow;
    return acc;
  }, {});
}

export function getPromptAction(promptKey: string | undefined | null): HelpAskAiAction | null {
  if (!promptKey) return null;
  const library = getPromptLibrary();
  return library[promptKey] ?? null;
}

export function getHelpDocument(documentId: string | undefined | null): HelpDocument | null {
  if (!documentId) return null;
  return HELP_DOCUMENTS[documentId] ?? null;
}

export function getLocalizedText(value: LocalizedText, language: SupportedHelpLanguage): string {
  const resolved = value[language];
  if (resolved) return resolved;
  return value.en;
}

function getDocumentIdFromMapping(mapping: ViewHelpMapping): string {
  if (mapping.documentId) return mapping.documentId;
  if (mapping.supportModule) return mapping.supportModule;
  if (mapping.stage) return mapping.stage;
  return 'interview';
}

export function getHelpDocumentForMapping(mapping: ViewHelpMapping): HelpDocument {
  return HELP_DOCUMENTS[getDocumentIdFromMapping(mapping)] ?? HELP_DOCUMENTS.interview;
}

export function getNextHelpDocument(document: HelpDocument): HelpDocument | null {
  return document.nextStepId ? getHelpDocument(document.nextStepId) : null;
}

export function getOverviewCards(language: SupportedHelpLanguage) {
  return {
    journey: HELP_SYSTEM_OVERVIEW.journeyCards.map((card) => ({
      ...card,
      title: getLocalizedText(card.title, language),
      description: getLocalizedText(card.description, language),
    })),
    support: HELP_SYSTEM_OVERVIEW.supportCards.map((card) => ({
      ...card,
      title: getLocalizedText(card.title, language),
      description: getLocalizedText(card.description, language),
    })),
  };
}

export function getOverviewGuides(language: SupportedHelpLanguage) {
  return HELP_OVERVIEW_GUIDES.map((guide) => ({
    ...guide,
    title: getLocalizedText(guide.title, language),
    description: getLocalizedText(guide.description, language),
  }));
}
