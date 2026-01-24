/**
 * Release Notes Configuration
 */

export interface ReleaseFeature {
  id: string;
  title: { en: string; pl: string };
  description: { en: string; pl: string };
  icon?: string;
  videoUrl?: string;
  videoId?: string;
  isHighlight?: boolean;
}

export interface ReleaseNote {
  version: string;
  date: string;
  title: { en: string; pl: string };
  type: 'major' | 'minor' | 'patch';
  summary: { en: string; pl: string };
  highlights: string[];
  highlightsPl?: string[];
  features: ReleaseFeature[];
  improvements: Array<{
    description: { en: string; pl: string };
  }>;
  fixes: Array<{
    description: { en: string; pl: string };
  }>;
  changes: Array<{
    type: 'feature' | 'fix' | 'improvement' | 'breaking';
    description: { en: string; pl: string };
  }>;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.0.0',
    date: '2026-01-01',
    title: {
      en: 'Major Update - AI Intelligence',
      pl: 'Duża aktualizacja - Inteligencja AI',
    },
    type: 'major',
    summary: {
      en: 'Introducing new AI-powered analytics and enhanced PMO features.',
      pl: 'Wprowadzamy nową analitykę opartą na AI i ulepszone funkcje PMO.',
    },
    highlights: [
      'New AI-powered analytics',
      'Enhanced PMO features',
      'Improved collaboration tools',
    ],
    highlightsPl: [
      'Nowa analityka oparta na AI',
      'Ulepszone funkcje PMO',
      'Poprawione narzędzia współpracy',
    ],
    features: [
      {
        id: 'ai-center',
        title: {
          en: 'AI Strategic Center',
          pl: 'Centrum Strategiczne AI',
        },
        description: {
          en: 'New AI-powered strategic planning and analysis tools.',
          pl: 'Nowe narzędzia planowania strategicznego i analizy oparte na AI.',
        },
        icon: 'Brain',
        isHighlight: true,
      },
      {
        id: 'pmo-dashboard',
        title: {
          en: 'PMO Dashboard',
          pl: 'Dashboard PMO',
        },
        description: {
          en: 'Comprehensive PMO dashboard with real-time metrics.',
          pl: 'Kompleksowy dashboard PMO z metrykami w czasie rzeczywistym.',
        },
        icon: 'LayoutDashboard',
      },
    ],
    improvements: [
      {
        description: {
          en: 'Performance optimizations',
          pl: 'Optymalizacje wydajności',
        },
      },
      {
        description: {
          en: 'Better dark mode support',
          pl: 'Lepsze wsparcie dla trybu ciemnego',
        },
      },
    ],
    fixes: [
      {
        description: {
          en: 'Fixed navigation issues',
          pl: 'Naprawiono problemy z nawigacją',
        },
      },
    ],
    changes: [
      {
        type: 'feature',
        description: {
          en: 'AI Strategic Center',
          pl: 'Centrum Strategiczne AI',
        },
      },
      {
        type: 'improvement',
        description: {
          en: 'Performance optimizations',
          pl: 'Optymalizacje wydajności',
        },
      },
    ],
  },
];

const CURRENT_VERSION = '2.0.0';

export const getReleaseNotes = () => RELEASE_NOTES;
export const getLatestRelease = () => RELEASE_NOTES[0];
export const hasNewRelease = (lastSeenVersion?: string): boolean => {
  if (!lastSeenVersion) return true;
  return lastSeenVersion !== CURRENT_VERSION;
};
