export interface VideoTutorial {
  id: string;
  moduleId: string;
  title: string;
  titlePl?: string;
  titleDe?: string;
  titleAr?: string;
  titleJa?: string;
  titleEs?: string;
  description: string;
  descriptionPl?: string;
  descriptionDe?: string;
  descriptionAr?: string;
  descriptionJa?: string;
  descriptionEs?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  duration?: string;
  durationSeconds?: number;
  tags?: string[];
}

export function getLocalizedVideoTitle(video: VideoTutorial, lang: string): string {
  if (lang === 'pl' && video.titlePl) return video.titlePl;
  if (lang === 'de' && video.titleDe) return video.titleDe;
  if (lang === 'ar' && video.titleAr) return video.titleAr;
  if (lang === 'ja' && video.titleJa) return video.titleJa;
  if (lang === 'es' && video.titleEs) return video.titleEs;
  return video.title;
}

export function getLocalizedVideoDescription(video: VideoTutorial, lang: string): string {
  if (lang === 'pl' && video.descriptionPl) return video.descriptionPl;
  if (lang === 'de' && video.descriptionDe) return video.descriptionDe;
  if (lang === 'ar' && video.descriptionAr) return video.descriptionAr;
  if (lang === 'ja' && video.descriptionJa) return video.descriptionJa;
  if (lang === 'es' && video.descriptionEs) return video.descriptionEs;
  return video.description;
}

/**
 * Video registry: moduleId -> tutorial video metadata.
 * Videos are shown once per user per module on first visit.
 * To add a new module video, append an entry here.
 */
export const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: 'vid-dashboard-intro',
    moduleId: 'dashboard',
    title: 'Getting Started with Dashboard',
    titlePl: 'Wprowadzenie do Dashboardu',
    description:
      'Quick overview of your transformation command center — KPIs, insights, and shortcuts.',
    descriptionPl: 'Szybki przegląd centrum dowodzenia transformacją — KPI, wglądy i skróty.',
    videoUrl: '/videos/tutorials/dashboard-intro.mp4',
    duration: '2:15',
    durationSeconds: 135,
    tags: ['dashboard', 'overview', 'getting-started'],
  },
  {
    id: 'vid-assessment-intro',
    moduleId: 'assessment',
    title: 'Running Your First Assessment',
    titlePl: 'Przeprowadzanie pierwszej oceny',
    description: 'Learn how to start a maturity assessment using CMMI, LEAN, or custom frameworks.',
    descriptionPl:
      'Dowiedz się, jak rozpocząć ocenę dojrzałości z użyciem CMMI, LEAN lub własnych ram.',
    videoUrl: '/videos/tutorials/assessment-intro.mp4',
    duration: '3:00',
    durationSeconds: 180,
    tags: ['assessment', 'maturity', 'frameworks'],
  },
  {
    id: 'vid-initiatives-intro',
    moduleId: 'initiatives',
    title: 'Creating and Managing Initiatives',
    titlePl: 'Tworzenie i zarządzanie inicjatywami',
    description:
      'Create transformation initiatives, set milestones, and track progress through stage gates.',
    descriptionPl: 'Tworzenie inicjatyw transformacyjnych, kamienie milowe i śledzenie postępów.',
    videoUrl: '/videos/tutorials/initiatives-intro.mp4',
    duration: '2:45',
    durationSeconds: 165,
    tags: ['initiatives', 'project-management', 'stage-gate'],
  },
  {
    id: 'vid-roadmap-intro',
    moduleId: 'roadmap',
    title: 'Planning with the Roadmap',
    titlePl: 'Planowanie z Roadmapą',
    description:
      'Visual timeline for scheduling initiatives, managing dependencies, and tracking milestones.',
    descriptionPl:
      'Wizualna oś czasu do planowania inicjatyw, zarządzania zależnościami i śledzenia kamieni milowych.',
    videoUrl: '/videos/tutorials/roadmap-intro.mp4',
    duration: '2:30',
    durationSeconds: 150,
    tags: ['roadmap', 'timeline', 'planning'],
  },
  {
    id: 'vid-reports-intro',
    moduleId: 'reports',
    title: 'Generating Reports',
    titlePl: 'Generowanie raportów',
    description: 'Create executive reports, status updates, and export to PDF or PowerPoint.',
    descriptionPl:
      'Tworzenie raportów zarządczych, aktualizacji statusu i eksport do PDF lub PowerPoint.',
    videoUrl: '/videos/tutorials/reports-intro.mp4',
    duration: '1:45',
    durationSeconds: 105,
    tags: ['reports', 'export', 'executive'],
  },
  {
    id: 'vid-ai-chat-intro',
    moduleId: 'ai_chat',
    title: 'Using the AI Assistant',
    titlePl: 'Korzystanie z Asystenta AI',
    description: 'Ask questions about your data, get recommendations, and automate tasks with AI.',
    descriptionPl: 'Zadawaj pytania o dane, otrzymuj rekomendacje i automatyzuj zadania z AI.',
    videoUrl: '/videos/tutorials/ai-chat-intro.mp4',
    duration: '2:00',
    durationSeconds: 120,
    tags: ['ai', 'chat', 'assistant'],
  },
  {
    id: 'vid-execution-intro',
    moduleId: 'execution',
    title: 'Execution Center Overview',
    titlePl: 'Przegląd Centrum Realizacji',
    description: 'Track task execution, monitor KPIs, and manage your team workload.',
    descriptionPl:
      'Śledzenie realizacji zadań, monitorowanie KPI i zarządzanie obciążeniem zespołu.',
    videoUrl: '/videos/tutorials/execution-intro.mp4',
    duration: '2:30',
    durationSeconds: 150,
    tags: ['execution', 'tasks', 'kpi'],
  },
  {
    id: 'vid-portfolio-intro',
    moduleId: 'portfolio',
    title: 'Portfolio Management',
    titlePl: 'Zarządzanie portfelem',
    description: 'View and prioritize your initiative portfolio with strategic alignment analysis.',
    descriptionPl:
      'Przeglądaj i priorytetyzuj portfel inicjatyw z analizą dopasowania strategicznego.',
    videoUrl: '/videos/tutorials/portfolio-intro.mp4',
    duration: '2:00',
    durationSeconds: 120,
    tags: ['portfolio', 'strategy', 'prioritization'],
  },
  {
    id: 'vid-interview-intro',
    moduleId: 'interview',
    title: 'Discovery Interviews',
    titlePl: 'Wywiady odkrywcze',
    description: 'Conduct AI-assisted stakeholder interviews and extract structured insights.',
    descriptionPl:
      'Przeprowadzaj wywiady z interesariuszami wspierane AI i wyciągaj ustrukturyzowane wnioski.',
    videoUrl: '/videos/tutorials/interview-intro.mp4',
    duration: '2:45',
    durationSeconds: 165,
    tags: ['interview', 'discovery', 'stakeholders'],
  },
  {
    id: 'vid-my-work-intro',
    moduleId: 'my-work',
    title: 'My Work Dashboard',
    titlePl: 'Moja praca — dashboard',
    description: 'Your personal command center — tasks, decisions, notifications, and focus mode.',
    descriptionPl:
      'Twoje osobiste centrum dowodzenia — zadania, decyzje, powiadomienia i tryb skupienia.',
    videoUrl: '/videos/tutorials/my-work-intro.mp4',
    duration: '1:30',
    durationSeconds: 90,
    tags: ['my-work', 'personal', 'tasks'],
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Education / Knowledge library (T074–T085) — V2 content registry
  //
  // NOTE:
  // - KnowledgeBaseView renders "video" items as an educational card.
  // - Playback hosting can be wired later; V2 closeout focuses on canonical metadata + i18n.
  // ────────────────────────────────────────────────────────────────────────────

  // T074 — Platform Fundamentals (min 5)
  {
    id: 'edu-fundamentals-01-navigation',
    moduleId: 'knowledge',
    title: 'Platform Fundamentals: Navigation and modules map',
    titlePl: 'Fundamenty platformy: nawigacja i mapa modułów',
    description:
      'A fast orientation: how the modules connect and where to start depending on your goal.',
    descriptionPl: 'Szybka orientacja: jak łączą się moduły i gdzie zacząć w zależności od celu.',
    videoUrl: '#',
    duration: '3:00',
    durationSeconds: 180,
    tags: ['education', 'fundamentals', 'navigation', 'T074'],
  },
  {
    id: 'edu-fundamentals-02-tools-to-outputs',
    moduleId: 'knowledge',
    title: 'Platform Fundamentals: Tools → outputs → initiatives',
    titlePl: 'Fundamenty platformy: narzędzia → outputy → inicjatywy',
    description:
      'How to go from frameworks to concrete outputs and turn them into an initiative portfolio.',
    descriptionPl:
      'Jak przejść od frameworków do konkretnych outputów i zamienić je w portfel inicjatyw.',
    videoUrl: '#',
    duration: '3:30',
    durationSeconds: 210,
    tags: ['education', 'fundamentals', 'tools', 'initiatives', 'T074'],
  },
  {
    id: 'edu-fundamentals-03-execution-basics',
    moduleId: 'knowledge',
    title: 'Platform Fundamentals: Initiatives and execution basics',
    titlePl: 'Fundamenty platformy: inicjatywy i podstawy realizacji',
    description:
      'Governance, milestones, and daily execution — the minimum discipline to deliver outcomes.',
    descriptionPl:
      'Governance, kamienie milowe i codzienna realizacja — minimalna dyscyplina dowożenia wyników.',
    videoUrl: '#',
    duration: '4:00',
    durationSeconds: 240,
    tags: ['education', 'fundamentals', 'execution', 'T074'],
  },
  {
    id: 'edu-fundamentals-04-reports-and-presentations',
    moduleId: 'knowledge',
    title: 'Platform Fundamentals: Reports and presentations',
    titlePl: 'Fundamenty platformy: raporty i prezentacje',
    description: 'How to produce sponsor-grade reports and decks from your work artifacts.',
    descriptionPl: 'Jak tworzyć sponsor-grade raporty i decki na bazie artefaktów pracy.',
    videoUrl: '#',
    duration: '3:45',
    durationSeconds: 225,
    tags: ['education', 'fundamentals', 'reports', 'presentations', 'T074'],
  },
  {
    id: 'edu-fundamentals-05-admin-basics',
    moduleId: 'knowledge',
    title: 'Platform Fundamentals: Organization and admin basics',
    titlePl: 'Fundamenty platformy: organizacja i podstawy admina',
    description: 'Roles, access, and team setup — keep governance tight without slowing execution.',
    descriptionPl: 'Role, dostęp i konfiguracja zespołu — governance bez spowalniania realizacji.',
    videoUrl: '#',
    duration: '3:15',
    durationSeconds: 195,
    tags: ['education', 'fundamentals', 'admin', 'T074'],
  },

  // T075 — Change Management Foundations
  {
    id: 'edu-change-01-foundations',
    moduleId: 'knowledge',
    title: 'Change Foundations: roles, governance, cadence',
    titlePl: 'Fundamenty zmiany: role, governance, rytm',
    description:
      'A consulting-grade baseline for running change: who owns what, how decisions flow, and how often you review.',
    descriptionPl:
      'Consulting-grade baseline prowadzenia zmiany: odpowiedzialności, przepływ decyzji i rytm przeglądów.',
    videoUrl: '#',
    duration: '5:00',
    durationSeconds: 300,
    tags: ['education', 'change', 'governance', 'T075'],
  },

  // T076 — Prompt Engineering & Advanced AI Usage
  {
    id: 'edu-prompting-01-context-first',
    moduleId: 'knowledge',
    title: 'Prompting: Context first (artifacts, citations, and constraints)',
    titlePl: 'Promptowanie: kontekst najpierw (artefakty, cytowania, ograniczenia)',
    description:
      'How to ask better questions in Consultify: reference artifacts, request structure, and demand grounding.',
    descriptionPl:
      'Jak zadawać lepsze pytania w Consultify: odwołuj się do artefaktów, proś o strukturę i wymuszaj grounding.',
    videoUrl: '#',
    duration: '6:00',
    durationSeconds: 360,
    tags: ['education', 'ai', 'prompting', 'recipes', 'T076'],
  },

  // T077 — Core Consulting Tools Library
  {
    id: 'edu-tools-01-core-consulting-library',
    moduleId: 'knowledge',
    title: 'Core consulting tools: how to pick the right framework',
    titlePl: 'Narzędzia consultingowe: jak dobrać właściwy framework',
    description:
      'A practical guide to choosing tools based on the decision you need to make and the outcome you must deliver.',
    descriptionPl:
      'Praktyczny przewodnik doboru narzędzi na podstawie decyzji i wyniku, który musisz dowieźć.',
    videoUrl: '#',
    duration: '5:30',
    durationSeconds: 330,
    tags: ['education', 'tools', 'library', 'T077'],
  },

  // T078 — Licensed Assessment Tools Library
  {
    id: 'edu-tools-02-licensed-assessments',
    moduleId: 'knowledge',
    title: 'Licensed assessments: DRD / SIRI / ADMA (trust + integration)',
    titlePl: 'Licencjonowane oceny: DRD / SIRI / ADMA (zaufanie + integracja)',
    description:
      'What each assessment is for, what data you need, and how to interpret the outputs responsibly.',
    descriptionPl:
      'Do czego służą poszczególne oceny, jakich danych potrzebujesz i jak odpowiedzialnie interpretować wyniki.',
    videoUrl: '#',
    duration: '6:30',
    durationSeconds: 390,
    tags: ['education', 'assessment', 'licensed', 'T078'],
  },

  // T079 — Managing Initiatives in Transformation
  {
    id: 'edu-initiatives-01-lifecycle-governance',
    moduleId: 'knowledge',
    title: 'Managing initiatives: lifecycle, gates, and execution discipline',
    titlePl: 'Zarządzanie inicjatywami: cykl życia, bramki i dyscyplina realizacji',
    description:
      'How to run an initiative end-to-end with governance that helps — not hurts — delivery.',
    descriptionPl:
      'Jak prowadzić inicjatywę end-to-end z governance, który pomaga, a nie przeszkadza w dowiezieniu.',
    videoUrl: '#',
    duration: '6:00',
    durationSeconds: 360,
    tags: ['education', 'initiatives', 'execution', 'T079'],
  },

  // T080 — Financial Analysis and Modeling
  {
    id: 'edu-finance-01-analysis-and-modeling',
    moduleId: 'knowledge',
    title: 'Financial analysis: reading outputs and validating assumptions',
    titlePl: 'Analiza finansowa: czytanie outputów i walidacja założeń',
    description:
      'Sponsor-grade financial thinking: what the numbers mean, what can be trusted, and what must be checked.',
    descriptionPl:
      'Sponsor-grade myślenie finansowe: co znaczą liczby, czemu ufać i co trzeba sprawdzić.',
    videoUrl: '#',
    duration: '6:30',
    durationSeconds: 390,
    tags: ['education', 'finance', 'assumptions', 'T080'],
  },

  // T081 — Budgeting and Financial Planning
  {
    id: 'edu-finance-02-budgeting',
    moduleId: 'knowledge',
    title: 'Budgeting: forecasting discipline and scenario thinking',
    titlePl: 'Budżetowanie: dyscyplina prognoz i scenariusze',
    description:
      'A practical budgeting baseline: forecasts, scenarios, and how to avoid false precision.',
    descriptionPl:
      'Praktyczny baseline budżetowania: prognozy, scenariusze i jak unikać fałszywej precyzji.',
    videoUrl: '#',
    duration: '6:00',
    durationSeconds: 360,
    tags: ['education', 'finance', 'budgeting', 'T081'],
  },

  // T082 — ROI Analysis and Investment Evaluation
  {
    id: 'edu-finance-03-roi-literacy',
    moduleId: 'knowledge',
    title: 'ROI literacy: investment evaluation and decision discipline',
    titlePl: 'ROI: ocena inwestycji i dyscyplina decyzyjna',
    description:
      'How to think about ROI without self-deception: value drivers, costs, timing, and uncertainty.',
    descriptionPl:
      'Jak myśleć o ROI bez samooszukiwania: drivery wartości, koszty, timing i niepewność.',
    videoUrl: '#',
    duration: '6:15',
    durationSeconds: 375,
    tags: ['education', 'roi', 'finance', 'T082'],
  },

  // T083 — KPI System Design and Performance Architecture
  {
    id: 'edu-kpi-01-cause-effect-architecture',
    moduleId: 'knowledge',
    title: 'KPI architecture: cause → effect, initiatives, and performance loops',
    titlePl: 'Architektura KPI: przyczyna → skutek, inicjatywy i pętle wyników',
    description:
      'Design KPIs that drive behavior and outcomes — connect initiatives to measurable performance.',
    descriptionPl:
      'Projektuj KPI, które zmieniają zachowania i dowożą wyniki — powiąż inicjatywy z mierzalną efektywnością.',
    videoUrl: '#',
    duration: '7:00',
    durationSeconds: 420,
    tags: ['education', 'kpi', 'performance', 'T083'],
  },

  // T084 — Building Presentations in the Platform
  {
    id: 'edu-presentations-01-walkthrough',
    moduleId: 'knowledge',
    title: 'Presentations: building a Gamma-style deck in Consultify',
    titlePl: 'Prezentacje: Gamma-style deck w Consultify',
    description:
      'A step-by-step walkthrough of building a crisp presentation from reports, KPIs, and initiatives.',
    descriptionPl:
      'Krok po kroku: jak zbudować zwięzłą prezentację na bazie raportów, KPI i inicjatyw.',
    videoUrl: '#',
    duration: '5:45',
    durationSeconds: 345,
    tags: ['education', 'presentations', 'reports', 'T084'],
  },

  // T085 — Report Template Design and Usage
  {
    id: 'edu-reports-01-templates',
    moduleId: 'knowledge',
    title: 'Reports: sponsor-ready templates and how to use them',
    titlePl: 'Raporty: sponsor-ready szablony i jak z nich korzystać',
    description:
      'How to generate consistent, sponsor-grade reports and avoid common pitfalls in narrative and evidence.',
    descriptionPl:
      'Jak generować spójne, sponsor-grade raporty i unikać typowych pułapek w narracji i evidence.',
    videoUrl: '#',
    duration: '6:00',
    durationSeconds: 360,
    tags: ['education', 'reports', 'templates', 'T085'],
  },
];

export function getVideosForModule(id: string): VideoTutorial[] {
  return VIDEO_TUTORIALS.filter((video) => video.moduleId === id);
}

export function getVideoById(videoId: string): VideoTutorial | undefined {
  return VIDEO_TUTORIALS.find((v) => v.id === videoId);
}

export function getAllModulesWithVideos(): string[] {
  return [...new Set(VIDEO_TUTORIALS.map((v) => v.moduleId))];
}
