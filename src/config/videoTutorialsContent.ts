export interface VideoTutorial {
  id: string;
  moduleId: string;
  title: string;
  titlePl?: string;
  description: string;
  descriptionPl?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  duration?: string;
  durationSeconds?: number;
  tags?: string[];
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
