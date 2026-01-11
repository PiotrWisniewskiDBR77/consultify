/**
 * Release Notes Configuration
 *
 * Stores changelog and release notes for What's New modal
 * and changelog view.
 */

export interface ReleaseFeature {
  title: { en: string; pl: string };
  description: { en: string; pl: string };
  icon?: string;
  videoId?: string;
  module?: string;
}

export interface ReleaseFix {
  en: string;
  pl: string;
}

export interface ReleaseNote {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  title: { en: string; pl: string };
  summary?: { en: string; pl: string };
  features: ReleaseFeature[];
  improvements: ReleaseFix[];
  fixes: ReleaseFix[];
  breaking?: ReleaseFix[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '2.6.0',
    date: '2024-12-28',
    type: 'minor',
    title: {
      en: 'Admin & Settings Restructure',
      pl: 'Restrukturyzacja Admin i Ustawień',
    },
    summary: {
      en: 'Complete restructure of Admin Panel (5 modules) and User Settings (6 modules) following SuperAdmin pattern.',
      pl: 'Pełna restrukturyzacja Panelu Admin (5 modułów) i Ustawień Użytkownika (6 modułów) według wzoru SuperAdmin.',
    },
    features: [
      {
        title: { en: 'Admin 5-Module Structure', pl: 'Admin - Struktura 5 Modułów' },
        description: {
          en: 'Overview, Team, Workspace, AI, and Settings modules with tab-based navigation.',
          pl: 'Moduły Przegląd, Zespół, Przestrzeń Robocza, AI i Ustawienia z nawigacją zakładkową.',
        },
        icon: 'Shield',
        module: 'admin',
      },
      {
        title: { en: 'Settings 6-Module Structure', pl: 'Ustawienia - Struktura 6 Modułów' },
        description: {
          en: 'Profile, AI Preferences, Notifications, Security, Integrations, and Appearance modules.',
          pl: 'Moduły Profil, Preferencje AI, Powiadomienia, Bezpieczeństwo, Integracje i Wygląd.',
        },
        icon: 'Settings',
        module: 'settings',
      },
      {
        title: { en: 'AI Memory Management', pl: 'Zarządzanie Pamięcią AI' },
        description: {
          en: 'Control AI memory, clear stored context, and manage chat history.',
          pl: 'Kontroluj pamięć AI, wyczyść zapisany kontekst i zarządzaj historią czatu.',
        },
        icon: 'Brain',
        module: 'settings',
      },
      {
        title: { en: 'Security Dashboard', pl: 'Panel Bezpieczeństwa' },
        description: {
          en: 'View active sessions, login history, and manage data controls.',
          pl: 'Przeglądaj aktywne sesje, historię logowań i zarządzaj kontrolą danych.',
        },
        icon: 'Shield',
        module: 'settings',
      },
      {
        title: { en: 'GDPR Data Controls', pl: 'Kontrola Danych GDPR' },
        description: {
          en: 'Training opt-out, data retention settings, and full data export.',
          pl: 'Rezygnacja z treningu, ustawienia retencji danych i pełny eksport danych.',
        },
        icon: 'Database',
        module: 'settings',
      },
      {
        title: { en: 'Calendar Sync', pl: 'Synchronizacja Kalendarza' },
        description: {
          en: 'Connect Google Calendar or Outlook for task synchronization.',
          pl: 'Połącz Kalendarz Google lub Outlook do synchronizacji zadań.',
        },
        icon: 'Calendar',
        module: 'settings',
      },
    ],
    improvements: [
      {
        en: 'Reduced sidebar menu items for cleaner navigation',
        pl: 'Zmniejszona liczba pozycji menu dla czystszej nawigacji',
      },
      {
        en: 'Consistent module pattern across Admin, Settings, and SuperAdmin',
        pl: 'Spójny wzorzec modułów w Admin, Ustawieniach i SuperAdmin',
      },
      {
        en: 'Better organization of AI-related settings',
        pl: 'Lepsza organizacja ustawień związanych z AI',
      },
    ],
    fixes: [
      {
        en: 'Fixed navigation between Admin and Settings modules',
        pl: 'Naprawiono nawigację między modułami Admin i Ustawień',
      },
      {
        en: 'Resolved sidebar state persistence issues',
        pl: 'Rozwiązano problemy z trwałością stanu paska bocznego',
      },
    ],
  },
  {
    version: '2.5.0',
    date: '2024-12-28',
    type: 'minor',
    title: {
      en: 'Enterprise Help System',
      pl: 'System Pomocy Enterprise',
    },
    summary: {
      en: 'Complete help system with contextual documentation, video tutorials, and intelligent search.',
      pl: 'Kompletny system pomocy z dokumentacją kontekstową, tutorialami wideo i inteligentnym wyszukiwaniem.',
    },
    features: [
      {
        title: { en: 'Global Search (Cmd+K)', pl: 'Globalne Wyszukiwanie (Cmd+K)' },
        description: {
          en: 'Search across all help content instantly with keyboard shortcuts.',
          pl: 'Przeszukuj całą treść pomocy natychmiast za pomocą skrótów klawiszowych.',
        },
        icon: 'Search',
        module: 'help',
      },
      {
        title: { en: 'Contextual Help Panel', pl: 'Kontekstowy Panel Pomocy' },
        description: {
          en: 'Help content adapts to your current screen for relevant guidance.',
          pl: 'Treść pomocy dostosowuje się do aktualnego ekranu dla odpowiednich wskazówek.',
        },
        icon: 'HelpCircle',
        module: 'help',
      },
      {
        title: { en: 'Video Tutorials', pl: 'Tutoriale Wideo' },
        description: {
          en: 'Watch step-by-step video guides for all major features.',
          pl: 'Oglądaj przewodniki wideo krok po kroku dla wszystkich głównych funkcji.',
        },
        icon: 'Video',
        module: 'help',
      },
      {
        title: { en: 'Interactive Tours', pl: 'Interaktywne Przewodniki' },
        description: {
          en: 'Guided walkthroughs for assessments, initiatives, and more.',
          pl: 'Przewodniki krok po kroku dla ocen, inicjatyw i więcej.',
        },
        icon: 'MapPin',
        module: 'onboarding',
      },
    ],
    improvements: [
      {
        en: 'Improved documentation coverage for all modules',
        pl: 'Poprawione pokrycie dokumentacji dla wszystkich modułów',
      },
      {
        en: 'Better bilingual support (EN/PL) throughout help system',
        pl: 'Lepsze wsparcie dwujęzyczne (EN/PL) w całym systemie pomocy',
      },
      {
        en: 'Enhanced FAQ search with tag-based filtering',
        pl: 'Ulepszone wyszukiwanie FAQ z filtrowaniem tagów',
      },
    ],
    fixes: [
      {
        en: 'Fixed help panel animation on mobile devices',
        pl: 'Naprawiono animację panelu pomocy na urządzeniach mobilnych',
      },
      {
        en: 'Resolved video playback issues in Safari',
        pl: 'Rozwiązano problemy z odtwarzaniem wideo w Safari',
      },
    ],
  },
  {
    version: '2.4.0',
    date: '2024-12-20',
    type: 'minor',
    title: {
      en: 'Work Dimensions System',
      pl: 'System Wymiarów Pracy',
    },
    summary: {
      en: 'Flexible organization structure with locations, projects, and PMO-aligned roles.',
      pl: 'Elastyczna struktura organizacji z lokalizacjami, projektami i rolami zgodnymi z PMO.',
    },
    features: [
      {
        title: { en: 'Work Mode Configuration', pl: 'Konfiguracja Trybu Pracy' },
        description: {
          en: 'Configure your organization to work by locations, projects, or both.',
          pl: 'Skonfiguruj swoją organizację do pracy według lokalizacji, projektów lub obu.',
        },
        icon: 'Settings',
        module: 'admin',
      },
      {
        title: { en: 'PMO Role Assignments', pl: 'Przypisania Ról PMO' },
        description: {
          en: 'Assign PRINCE2/PMBOK-aligned roles to project team members.',
          pl: 'Przypisuj role zgodne z PRINCE2/PMBOK członkom zespołu projektowego.',
        },
        icon: 'Users',
        module: 'admin',
      },
      {
        title: { en: 'User Facility Assignments', pl: 'Przypisania Użytkowników do Lokalizacji' },
        description: {
          en: 'Assign users to specific locations with role-based capabilities.',
          pl: 'Przypisuj użytkowników do konkretnych lokalizacji z uprawnieniami opartymi na rolach.',
        },
        icon: 'MapPin',
        module: 'admin',
      },
    ],
    improvements: [
      {
        en: 'Task filtering now respects user assignments',
        pl: 'Filtrowanie zadań teraz uwzględnia przypisania użytkowników',
      },
      {
        en: 'Project team board shows PMO hierarchy',
        pl: 'Tablica zespołu projektowego pokazuje hierarchię PMO',
      },
    ],
    fixes: [
      {
        en: 'Fixed capability resolution for multi-assigned users',
        pl: 'Naprawiono rozwiązywanie uprawnień dla użytkowników z wieloma przypisaniami',
      },
    ],
  },
  {
    version: '2.3.0',
    date: '2024-12-15',
    type: 'minor',
    title: {
      en: 'Enhanced Authentication',
      pl: 'Ulepszone Uwierzytelnianie',
    },
    features: [
      {
        title: { en: 'Google OAuth Login', pl: 'Logowanie Google OAuth' },
        description: {
          en: 'Sign in with your Google account for faster access.',
          pl: 'Zaloguj się kontem Google dla szybszego dostępu.',
        },
        icon: 'LogIn',
      },
      {
        title: { en: 'LinkedIn OAuth Login', pl: 'Logowanie LinkedIn OAuth' },
        description: {
          en: 'Sign in with LinkedIn for professional authentication.',
          pl: 'Zaloguj się przez LinkedIn dla profesjonalnego uwierzytelniania.',
        },
        icon: 'Linkedin',
      },
      {
        title: { en: 'Invitation System', pl: 'System Zaproszeń' },
        description: {
          en: 'Accept organization invitations via secure token links.',
          pl: 'Akceptuj zaproszenia do organizacji przez bezpieczne linki z tokenami.',
        },
        icon: 'Mail',
      },
    ],
    improvements: [
      {
        en: 'Consolidated login UI with cleaner design',
        pl: 'Skonsolidowany interfejs logowania z czystszym designem',
      },
      {
        en: 'Better error messages for authentication failures',
        pl: 'Lepsze komunikaty błędów dla niepowodzeń uwierzytelniania',
      },
    ],
    fixes: [
      {
        en: 'Fixed redirect loop after OAuth callback',
        pl: 'Naprawiono pętlę przekierowań po wywołaniu OAuth',
      },
      { en: 'Resolved session persistence issues', pl: 'Rozwiązano problemy z trwałością sesji' },
    ],
  },
  {
    version: '2.2.0',
    date: '2024-12-01',
    type: 'minor',
    title: {
      en: 'Assessment Improvements',
      pl: 'Ulepszenia Ocen',
    },
    features: [
      {
        title: { en: 'ADMA Framework', pl: 'Rama ADMA' },
        description: {
          en: 'New Advanced Manufacturing Assessment framework.',
          pl: 'Nowa rama oceny Advanced Manufacturing Assessment.',
        },
        icon: 'Factory',
      },
      {
        title: { en: 'Gap Map Visualization', pl: 'Wizualizacja Mapy Luk' },
        description: {
          en: 'Interactive visualization of assessment gaps and priorities.',
          pl: 'Interaktywna wizualizacja luk z oceny i priorytetów.',
        },
        icon: 'Map',
      },
    ],
    improvements: [
      { en: 'Faster assessment loading', pl: 'Szybsze ładowanie ocen' },
      {
        en: 'Better mobile assessment experience',
        pl: 'Lepsze doświadczenie oceny na urządzeniach mobilnych',
      },
    ],
    fixes: [],
  },
  {
    version: '2.1.0',
    date: '2024-11-15',
    type: 'minor',
    title: {
      en: 'Dashboard & Reports',
      pl: 'Dashboard i Raporty',
    },
    features: [
      {
        title: { en: 'Executive Dashboard', pl: 'Dashboard Kierownictwa' },
        description: {
          en: 'One-page transformation summary for leadership.',
          pl: 'Jednostronicowe podsumowanie transformacji dla kierownictwa.',
        },
        icon: 'LayoutDashboard',
      },
      {
        title: { en: 'ROI Calculator', pl: 'Kalkulator ROI' },
        description: {
          en: 'Calculate NPV, payback period, and IRR for initiatives.',
          pl: 'Obliczaj NPV, okres zwrotu i IRR dla inicjatyw.',
        },
        icon: 'Calculator',
      },
    ],
    improvements: [
      { en: 'Report PDF export quality improved', pl: 'Poprawiona jakość eksportu PDF raportów' },
    ],
    fixes: [],
  },
  {
    version: '2.0.0',
    date: '2024-10-01',
    type: 'major',
    title: {
      en: 'Consultinity 2.0',
      pl: 'Consultinity 2.0',
    },
    summary: {
      en: 'Complete platform redesign with new features and improved performance.',
      pl: 'Całkowite przeprojektowanie platformy z nowymi funkcjami i poprawioną wydajnością.',
    },
    features: [
      {
        title: { en: 'New Modern UI', pl: 'Nowy Nowoczesny Interfejs' },
        description: {
          en: 'Completely redesigned user interface with dark mode support.',
          pl: 'Całkowicie przeprojektowany interfejs użytkownika z obsługą trybu ciemnego.',
        },
        icon: 'Palette',
      },
      {
        title: { en: 'AI-Powered Recommendations', pl: 'Rekomendacje Napędzane AI' },
        description: {
          en: 'Intelligent suggestions for assessments and initiatives.',
          pl: 'Inteligentne sugestie dla ocen i inicjatyw.',
        },
        icon: 'Sparkles',
      },
      {
        title: { en: 'Multi-Organization Support', pl: 'Wsparcie Wielu Organizacji' },
        description: {
          en: 'Manage multiple organizations from a single account.',
          pl: 'Zarządzaj wieloma organizacjami z jednego konta.',
        },
        icon: 'Building2',
      },
    ],
    improvements: [
      { en: 'Performance improvements up to 3x faster', pl: 'Poprawa wydajności do 3x szybciej' },
      { en: 'Accessibility compliance (WCAG 2.1 AA)', pl: 'Zgodność z dostępnością (WCAG 2.1 AA)' },
    ],
    fixes: [],
    breaking: [
      { en: 'API v1 deprecated - migrate to v2', pl: 'API v1 wycofane - migruj do v2' },
      {
        en: 'Legacy assessment exports no longer supported',
        pl: 'Eksporty starszych ocen nie są już wspierane',
      },
    ],
  },
];

// Get latest release
export function getLatestRelease(): ReleaseNote {
  return RELEASE_NOTES[0];
}

// Get releases by type
export function getReleasesByType(type: 'major' | 'minor' | 'patch'): ReleaseNote[] {
  return RELEASE_NOTES.filter((r) => r.type === type);
}

// Get recent releases (last N)
export function getRecentReleases(count: number = 5): ReleaseNote[] {
  return RELEASE_NOTES.slice(0, count);
}

// Check if there's a new release since last seen
export function hasNewRelease(lastSeenVersion: string): boolean {
  const latest = getLatestRelease();
  return latest.version !== lastSeenVersion;
}

// Get release by version
export function getReleaseByVersion(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find((r) => r.version === version);
}
