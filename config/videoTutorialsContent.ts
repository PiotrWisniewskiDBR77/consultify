/**
 * Video Tutorials Content
 *
 * Video tutorial entries for all modules with HeyGen script references.
 * URLs should be updated when actual videos are available.
 * Used by HelpSidePanel in the "Video" tab.
 *
 * Script files are located in: docs/videos/scripts/
 * See docs/videos/README.md for production workflow.
 */

import { HelpModuleId } from './viewToModuleMapping';

export interface VideoTutorial {
    id: string;
    title: string;
    titlePl: string;
    description: string;
    descriptionPl: string;
    duration: string; // Format: "MM:SS" or "HH:MM:SS"
    url: string; // YouTube, Vimeo, or internal video URL
    thumbnail?: string; // Thumbnail image URL
    moduleId: HelpModuleId;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    tags: string[];
    /** Path to HeyGen script file (relative to docs/videos/scripts/) */
    scriptPath?: string;
    /** Target filename for the produced video */
    filename?: string;
}

export const VIDEO_TUTORIALS: VideoTutorial[] = [
    // ==========================================
    // ONBOARDING VIDEOS
    // ==========================================
    {
        id: 'onboarding-welcome',
        title: 'Welcome to Consultify',
        titlePl: 'Witamy w Consultify',
        description: 'An introduction to the Consultify platform and its key features for digital transformation.',
        descriptionPl: 'Wprowadzenie do platformy Consultify i jej kluczowych funkcji dla transformacji cyfrowej.',
        duration: '05:30',
        url: '#', // Update with actual video URL after production
        moduleId: 'onboarding',
        difficulty: 'beginner',
        tags: ['introduction', 'overview', 'getting-started'],
        scriptPath: '01-consultify-welcome.md',
        filename: '01-consultify-welcome.mp4',
    },
    {
        id: 'onboarding-first-steps',
        title: 'First Steps: Setting Up Your Profile',
        titlePl: 'Pierwsze Kroki: Konfiguracja Profilu',
        description: 'Complete your profile setup and configure essential settings to get started.',
        descriptionPl: 'Wypełnij konfigurację profilu i skonfiguruj podstawowe ustawienia, aby rozpocząć.',
        duration: '03:45',
        url: '#',
        moduleId: 'onboarding',
        difficulty: 'beginner',
        tags: ['profile', 'setup', 'first-steps'],
        scriptPath: '02-first-steps-profile.md',
        filename: '02-first-steps-profile.mp4',
    },
    {
        id: 'onboarding-navigation',
        title: 'Navigating the Platform',
        titlePl: 'Nawigacja po Platformie',
        description: 'Learn how to navigate through different modules and find what you need quickly.',
        descriptionPl: 'Naucz się nawigować przez różne moduły i szybko znajdować to, czego potrzebujesz.',
        duration: '04:15',
        url: '#',
        moduleId: 'onboarding',
        difficulty: 'beginner',
        tags: ['navigation', 'modules', 'interface'],
        scriptPath: '03-platform-navigation.md',
        filename: '03-platform-navigation.mp4',
    },

    // ==========================================
    // DASHBOARD VIDEOS
    // ==========================================
    {
        id: 'dashboard-overview',
        title: 'Understanding Your Dashboard',
        titlePl: 'Zrozumienie Twojego Dashboardu',
        description: 'A complete tour of the dashboard, explaining each widget and metric.',
        descriptionPl: 'Kompletna wycieczka po dashboardzie, wyjaśniająca każdy widżet i metrykę.',
        duration: '06:00',
        url: '#',
        moduleId: 'dashboard',
        difficulty: 'beginner',
        tags: ['dashboard', 'widgets', 'metrics'],
        scriptPath: '04-dashboard-overview.md',
        filename: '04-dashboard-overview.mp4',
    },
    {
        id: 'dashboard-customization',
        title: 'Customizing Your Dashboard',
        titlePl: 'Dostosowywanie Twojego Dashboardu',
        description: 'Learn how to personalize your dashboard with widgets that matter to you.',
        descriptionPl: 'Naucz się personalizować dashboard z widżetami, które są dla Ciebie ważne.',
        duration: '04:30',
        url: '#',
        moduleId: 'dashboard',
        difficulty: 'intermediate',
        tags: ['customization', 'widgets', 'personalization'],
        scriptPath: '05-dashboard-customization.md',
        filename: '05-dashboard-customization.mp4',
    },

    // ==========================================
    // ASSESSMENT VIDEOS
    // ==========================================
    {
        id: 'assessment-intro',
        title: 'Introduction to Digital Maturity Assessment',
        titlePl: 'Wprowadzenie do Oceny Dojrzałości Cyfrowej',
        description: 'Understand the purpose of assessments and how they drive your transformation journey.',
        descriptionPl: 'Zrozum cel ocen i jak napędzają Twoją podróż transformacyjną.',
        duration: '08:00',
        url: '#',
        moduleId: 'assessment',
        difficulty: 'beginner',
        tags: ['assessment', 'maturity', 'introduction'],
        scriptPath: '06-assessment-intro.md',
        filename: '06-assessment-intro.mp4',
    },
    {
        id: 'assessment-drd-walkthrough',
        title: 'DRD Assessment Complete Walkthrough',
        titlePl: 'Kompletna Prezentacja Oceny DRD',
        description: 'Step-by-step guide through the DRD (Digital Readiness Diagnostic) assessment process.',
        descriptionPl: 'Przewodnik krok po kroku przez proces oceny DRD (Digital Readiness Diagnostic).',
        duration: '15:00',
        url: '#',
        moduleId: 'assessment',
        difficulty: 'intermediate',
        tags: ['DRD', 'walkthrough', 'step-by-step'],
        scriptPath: '07-drd-walkthrough.md',
        filename: '07-drd-walkthrough.mp4',
    },
    {
        id: 'assessment-evidence',
        title: 'Uploading and Managing Evidence',
        titlePl: 'Przesyłanie i Zarządzanie Dowodami',
        description: 'How to effectively upload, organize, and link evidence documents to your assessments.',
        descriptionPl: 'Jak efektywnie przesyłać, organizować i łączyć dokumenty dowodowe z ocenami.',
        duration: '05:30',
        url: '#',
        moduleId: 'assessment',
        difficulty: 'beginner',
        tags: ['evidence', 'documents', 'upload'],
        scriptPath: '08-assessment-evidence.md',
        filename: '08-assessment-evidence.mp4',
    },
    {
        id: 'assessment-gap-analysis',
        title: 'Understanding Gap Analysis',
        titlePl: 'Zrozumienie Analizy Luk',
        description: 'How to interpret gap analysis results and use them for planning improvements.',
        descriptionPl: 'Jak interpretować wyniki analizy luk i używać ich do planowania ulepszeń.',
        duration: '07:15',
        url: '#',
        moduleId: 'assessment',
        difficulty: 'intermediate',
        tags: ['gap-analysis', 'interpretation', 'planning'],
        scriptPath: '09-gap-analysis.md',
        filename: '09-gap-analysis.mp4',
    },

    // ==========================================
    // INITIATIVES VIDEOS
    // ==========================================
    {
        id: 'initiatives-generation',
        title: 'Generating Initiatives from Assessment Gaps',
        titlePl: 'Generowanie Inicjatyw z Luk Oceny',
        description: 'Use AI to transform assessment gaps into actionable improvement initiatives.',
        descriptionPl: 'Użyj AI, aby przekształcić luki z oceny w praktyczne inicjatywy poprawy.',
        duration: '06:45',
        url: '#',
        moduleId: 'initiatives',
        difficulty: 'beginner',
        tags: ['AI', 'generation', 'initiatives'],
        scriptPath: '10-initiative-generation.md',
        filename: '10-initiative-generation.mp4',
    },
    {
        id: 'initiatives-prioritization',
        title: 'Prioritizing Initiatives with Impact/Effort Matrix',
        titlePl: 'Priorytetyzacja Inicjatyw z Macierzą Wpływ/Wysiłek',
        description: 'Learn the art of prioritizing competing initiatives using the impact vs effort framework.',
        descriptionPl: 'Naucz się sztuki priorytetyzacji konkurujących inicjatyw używając frameworku wpływ vs wysiłek.',
        duration: '05:30',
        url: '#',
        moduleId: 'initiatives',
        difficulty: 'intermediate',
        tags: ['prioritization', 'matrix', 'impact'],
        scriptPath: '11-prioritization-matrix.md',
        filename: '11-prioritization-matrix.mp4',
    },
    {
        id: 'initiatives-business-case',
        title: 'Building a Compelling Business Case',
        titlePl: 'Budowanie Przekonującego Business Case',
        description: 'Create business cases that secure stakeholder buy-in and funding for your initiatives.',
        descriptionPl:
            'Twórz business case, które zapewniają poparcie interesariuszy i finansowanie dla Twoich inicjatyw.',
        duration: '08:00',
        url: '#',
        moduleId: 'initiatives',
        difficulty: 'advanced',
        tags: ['business-case', 'stakeholders', 'funding'],
        scriptPath: '12-business-case.md',
        filename: '12-business-case.mp4',
    },

    // ==========================================
    // ROADMAP VIDEOS
    // ==========================================
    {
        id: 'roadmap-creation',
        title: 'Creating Your Transformation Roadmap',
        titlePl: 'Tworzenie Twojej Mapy Drogowej Transformacji',
        description: 'Build a strategic roadmap that organizes initiatives into actionable phases.',
        descriptionPl: 'Zbuduj strategiczną mapę drogową, która organizuje inicjatywy w praktyczne fazy.',
        duration: '09:00',
        url: '#',
        moduleId: 'roadmap',
        difficulty: 'intermediate',
        tags: ['roadmap', 'phases', 'planning'],
        scriptPath: '13-roadmap-creation.md',
        filename: '13-roadmap-creation.mp4',
    },
    {
        id: 'roadmap-dependencies',
        title: 'Managing Dependencies and Resources',
        titlePl: 'Zarządzanie Zależnościami i Zasobami',
        description: 'Handle complex initiative dependencies and resource allocation in your roadmap.',
        descriptionPl: 'Obsługuj złożone zależności inicjatyw i alokację zasobów w mapie drogowej.',
        duration: '07:30',
        url: '#',
        moduleId: 'roadmap',
        difficulty: 'advanced',
        tags: ['dependencies', 'resources', 'capacity'],
        scriptPath: '14-dependencies-resources.md',
        filename: '14-dependencies-resources.mp4',
    },

    // ==========================================
    // IMPLEMENTATION VIDEOS
    // ==========================================
    {
        id: 'implementation-pilot',
        title: 'Running an Effective Pilot Program',
        titlePl: 'Prowadzenie Efektywnego Programu Pilotażowego',
        description: 'Best practices for designing, executing, and evaluating pilot programs.',
        descriptionPl: 'Najlepsze praktyki projektowania, realizacji i oceny programów pilotażowych.',
        duration: '10:00',
        url: '#',
        moduleId: 'implementation',
        difficulty: 'intermediate',
        tags: ['pilot', 'execution', 'evaluation'],
        scriptPath: '15-pilot-program.md',
        filename: '15-pilot-program.mp4',
    },
    {
        id: 'implementation-stage-gate',
        title: 'Stage-Gate Process Explained',
        titlePl: 'Wyjaśnienie Procesu Stage-Gate',
        description: 'How to use stage-gate methodology for controlled implementation.',
        descriptionPl: 'Jak używać metodologii stage-gate dla kontrolowanej implementacji.',
        duration: '06:30',
        url: '#',
        moduleId: 'implementation',
        difficulty: 'intermediate',
        tags: ['stage-gate', 'gates', 'methodology'],
        scriptPath: '16-stage-gate-process.md',
        filename: '16-stage-gate-process.mp4',
    },
    {
        id: 'implementation-change-management',
        title: 'Change Management with ADKAR',
        titlePl: 'Zarządzanie Zmianą z ADKAR',
        description: 'Apply the ADKAR model to ensure successful change adoption.',
        descriptionPl: 'Zastosuj model ADKAR, aby zapewnić udaną adopcję zmiany.',
        duration: '08:45',
        url: '#',
        moduleId: 'implementation',
        difficulty: 'advanced',
        tags: ['ADKAR', 'change-management', 'adoption'],
        scriptPath: '17-adkar-change-management.md',
        filename: '17-adkar-change-management.mp4',
    },

    // ==========================================
    // REPORTS VIDEOS
    // ==========================================
    {
        id: 'reports-roi',
        title: 'Calculating ROI for Transformation Initiatives',
        titlePl: 'Obliczanie ROI dla Inicjatyw Transformacyjnych',
        description: 'Master the ROI calculator to demonstrate transformation value.',
        descriptionPl: 'Opanuj kalkulator ROI, aby pokazać wartość transformacji.',
        duration: '07:00',
        url: '#',
        moduleId: 'reports',
        difficulty: 'intermediate',
        tags: ['ROI', 'calculator', 'value'],
        scriptPath: '18-roi-calculation.md',
        filename: '18-roi-calculation.mp4',
    },
    {
        id: 'reports-executive',
        title: 'Creating Executive Summary Reports',
        titlePl: 'Tworzenie Raportów Podsumowań dla Kadry Zarządzającej',
        description: 'Generate professional reports for board meetings and stakeholder updates.',
        descriptionPl: 'Generuj profesjonalne raporty na spotkania zarządu i aktualizacje dla interesariuszy.',
        duration: '05:15',
        url: '#',
        moduleId: 'reports',
        difficulty: 'beginner',
        tags: ['executive', 'reports', 'stakeholders'],
        scriptPath: '19-executive-reports.md',
        filename: '19-executive-reports.mp4',
    },

    // ==========================================
    // MY WORK VIDEOS
    // ==========================================
    {
        id: 'mywork-productivity',
        title: 'Maximizing Productivity with My Work',
        titlePl: 'Maksymalizacja Produktywności z Moja Praca',
        description: 'Tips and tricks for managing your tasks and staying productive.',
        descriptionPl: 'Porady i sztuczki do zarządzania zadaniami i utrzymania produktywności.',
        duration: '04:30',
        url: '#',
        moduleId: 'mywork',
        difficulty: 'beginner',
        tags: ['productivity', 'tasks', 'tips'],
    },
    {
        id: 'mywork-focus',
        title: 'Using Focus Mode for Deep Work',
        titlePl: 'Używanie Trybu Skupienia do Głębokiej Pracy',
        description: 'Master focus mode to complete complex tasks without distractions.',
        descriptionPl: 'Opanuj tryb skupienia, aby ukończyć złożone zadania bez rozpraszaczy.',
        duration: '03:45',
        url: '#',
        moduleId: 'mywork',
        difficulty: 'beginner',
        tags: ['focus', 'deep-work', 'distractions'],
    },

    // ==========================================
    // ORGANIZATION VIDEOS
    // ==========================================
    {
        id: 'organization-context',
        title: 'Setting Up Organization Context',
        titlePl: 'Konfiguracja Kontekstu Organizacji',
        description: 'Configure your organization context to enable tailored AI recommendations.',
        descriptionPl: 'Skonfiguruj kontekst organizacji, aby włączyć dopasowane rekomendacje AI.',
        duration: '08:30',
        url: '#',
        moduleId: 'organization',
        difficulty: 'intermediate',
        tags: ['context', 'AI', 'setup'],
    },
    {
        id: 'organization-strategy',
        title: 'Defining Strategic Goals and Challenges',
        titlePl: 'Definiowanie Celów Strategicznych i Wyzwań',
        description: 'How to articulate your strategic direction for better AI assistance.',
        descriptionPl: 'Jak wyrażać swój kierunek strategiczny dla lepszej pomocy AI.',
        duration: '06:15',
        url: '#',
        moduleId: 'organization',
        difficulty: 'intermediate',
        tags: ['strategy', 'goals', 'challenges'],
    },

    // ==========================================
    // SETTINGS VIDEOS
    // ==========================================
    {
        id: 'settings-security',
        title: 'Securing Your Account with 2FA',
        titlePl: 'Zabezpieczanie Konta z 2FA',
        description: 'Enable and manage two-factor authentication for enhanced security.',
        descriptionPl: 'Włącz i zarządzaj uwierzytelnianiem dwuskładnikowym dla zwiększonego bezpieczeństwa.',
        duration: '03:00',
        url: '#',
        moduleId: 'settings',
        difficulty: 'beginner',
        tags: ['2FA', 'security', 'authentication'],
    },
    {
        id: 'settings-notifications',
        title: 'Configuring Notification Preferences',
        titlePl: 'Konfiguracja Preferencji Powiadomień',
        description: 'Set up notifications to stay informed without being overwhelmed.',
        descriptionPl: 'Skonfiguruj powiadomienia, aby być na bieżąco bez przytłoczenia.',
        duration: '04:00',
        url: '#',
        moduleId: 'settings',
        difficulty: 'beginner',
        tags: ['notifications', 'preferences', 'email'],
    },
    {
        id: 'settings-integrations',
        title: 'Connecting Integrations (Slack, etc.)',
        titlePl: 'Łączenie Integracji (Slack, itp.)',
        description: 'Connect Consultify with your existing tools for seamless workflow.',
        descriptionPl: 'Połącz Consultify z istniejącymi narzędziami dla płynnego workflow.',
        duration: '05:30',
        url: '#',
        moduleId: 'settings',
        difficulty: 'beginner',
        tags: ['integrations', 'Slack', 'connections'],
    },

    // ==========================================
    // ADMIN VIDEOS
    // ==========================================
    {
        id: 'admin-user-management',
        title: 'Managing Users and Permissions',
        titlePl: 'Zarządzanie Użytkownikami i Uprawnieniami',
        description: 'Admin guide to inviting users, assigning roles, and managing access.',
        descriptionPl:
            'Przewodnik administratora do zapraszania użytkowników, przypisywania ról i zarządzania dostępem.',
        duration: '07:00',
        url: '#',
        moduleId: 'admin',
        difficulty: 'intermediate',
        tags: ['users', 'permissions', 'roles'],
    },
    {
        id: 'admin-ai-config',
        title: 'Configuring AI for Your Organization',
        titlePl: 'Konfiguracja AI dla Twojej Organizacji',
        description: 'Set up AI providers, usage limits, and model preferences.',
        descriptionPl: 'Skonfiguruj dostawców AI, limity użycia i preferencje modeli.',
        duration: '08:00',
        url: '#',
        moduleId: 'admin',
        difficulty: 'advanced',
        tags: ['AI', 'configuration', 'limits'],
    },
    {
        id: 'admin-knowledge-base',
        title: 'Managing the Organization Knowledge Base',
        titlePl: 'Zarządzanie Bazą Wiedzy Organizacji',
        description: 'Upload and organize documents to enhance AI capabilities.',
        descriptionPl: 'Przesyłaj i organizuj dokumenty, aby wzmocnić możliwości AI.',
        duration: '06:00',
        url: '#',
        moduleId: 'admin',
        difficulty: 'intermediate',
        tags: ['knowledge', 'documents', 'upload'],
    },

    // ==========================================
    // SUPERADMIN VIDEOS
    // ==========================================
    {
        id: 'superadmin-org-management',
        title: 'Multi-Organization Management',
        titlePl: 'Zarządzanie Wieloma Organizacjami',
        description: 'Platform-level guide to creating and managing multiple organizations.',
        descriptionPl: 'Przewodnik na poziomie platformy do tworzenia i zarządzania wieloma organizacjami.',
        duration: '10:00',
        url: '#',
        moduleId: 'superadmin',
        difficulty: 'advanced',
        tags: ['organizations', 'multi-tenant', 'management'],
    },
    {
        id: 'superadmin-sso',
        title: 'Configuring Enterprise SSO/SAML',
        titlePl: 'Konfiguracja Enterprise SSO/SAML',
        description: 'Complete guide to setting up SSO/SAML authentication for enterprises.',
        descriptionPl: 'Kompletny przewodnik konfiguracji uwierzytelniania SSO/SAML dla enterprise.',
        duration: '12:00',
        url: '#',
        moduleId: 'superadmin',
        difficulty: 'advanced',
        tags: ['SSO', 'SAML', 'enterprise'],
    },
    {
        id: 'superadmin-whitelabel',
        title: 'White-label Studio Complete Guide',
        titlePl: 'Kompletny Przewodnik Studio White-label',
        description: 'Customize branding, colors, logos, and domain for your clients.',
        descriptionPl: 'Dostosuj branding, kolory, logo i domenę dla swoich klientów.',
        duration: '09:30',
        url: '#',
        moduleId: 'superadmin',
        difficulty: 'advanced',
        tags: ['whitelabel', 'branding', 'customization'],
    },
    {
        id: 'superadmin-billing',
        title: 'Platform Billing and Subscription Management',
        titlePl: 'Zarządzanie Rozliczeniami i Subskrypcjami Platformy',
        description: 'Manage subscriptions, invoices, and billing across all organizations.',
        descriptionPl: 'Zarządzaj subskrypcjami, fakturami i rozliczeniami we wszystkich organizacjach.',
        duration: '08:00',
        url: '#',
        moduleId: 'superadmin',
        difficulty: 'advanced',
        tags: ['billing', 'subscriptions', 'invoices'],
    },

    // ==========================================
    // AI TOOLS VIDEOS
    // ==========================================
    {
        id: 'ai-tools-advisor',
        title: 'Using the AI Action Advisor',
        titlePl: 'Używanie Doradcy Akcji AI',
        description: 'How to interpret and act on AI-generated recommendations.',
        descriptionPl: 'Jak interpretować i działać na podstawie rekomendacji generowanych przez AI.',
        duration: '06:30',
        url: '#',
        moduleId: 'ai-tools',
        difficulty: 'beginner',
        tags: ['AI', 'advisor', 'recommendations'],
    },
    {
        id: 'ai-tools-scenarios',
        title: 'AI-Powered What-If Analysis',
        titlePl: 'Analiza What-If Napędzana AI',
        description: 'Use AI to explore different scenarios and their potential outcomes.',
        descriptionPl: 'Użyj AI do eksploracji różnych scenariuszy i ich potencjalnych rezultatów.',
        duration: '07:15',
        url: '#',
        moduleId: 'ai-tools',
        difficulty: 'intermediate',
        tags: ['scenarios', 'what-if', 'analysis'],
    },

    // ==========================================
    // KNOWLEDGE VIDEOS
    // ==========================================
    {
        id: 'knowledge-masterclass-intro',
        title: 'Introduction to Masterclass Library',
        titlePl: 'Wprowadzenie do Biblioteki Masterclass',
        description: 'Overview of available masterclass content and learning paths.',
        descriptionPl: 'Przegląd dostępnej treści masterclass i ścieżek nauki.',
        duration: '04:00',
        url: '#',
        moduleId: 'knowledge',
        difficulty: 'beginner',
        tags: ['masterclass', 'learning', 'overview'],
    },
    {
        id: 'knowledge-templates',
        title: 'Using Templates Effectively',
        titlePl: 'Efektywne Używanie Szablonów',
        description: 'How to download, customize, and apply templates in your work.',
        descriptionPl: 'Jak pobierać, dostosowywać i stosować szablony w swojej pracy.',
        duration: '05:00',
        url: '#',
        moduleId: 'knowledge',
        difficulty: 'beginner',
        tags: ['templates', 'download', 'customization'],
    },
];

/**
 * Get video tutorials for a specific module
 */
export function getVideosForModule(moduleId: HelpModuleId): VideoTutorial[] {
    return VIDEO_TUTORIALS.filter((video) => video.moduleId === moduleId);
}

/**
 * Get videos by difficulty level
 */
export function getVideosByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): VideoTutorial[] {
    return VIDEO_TUTORIALS.filter((video) => video.difficulty === difficulty);
}

/**
 * Search videos by query
 */
export function searchVideos(query: string, language: 'en' | 'pl' = 'en'): VideoTutorial[] {
    const lowerQuery = query.toLowerCase();
    return VIDEO_TUTORIALS.filter((video) => {
        const title = language === 'pl' ? video.titlePl : video.title;
        const description = language === 'pl' ? video.descriptionPl : video.description;
        return (
            title.toLowerCase().includes(lowerQuery) ||
            description.toLowerCase().includes(lowerQuery) ||
            video.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
        );
    });
}

/**
 * Get all unique tags from videos
 */
export function getAllVideoTags(): string[] {
    const tags = new Set<string>();
    VIDEO_TUTORIALS.forEach((video) => video.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
}

/**
 * Get total duration of videos for a module
 */
export function getTotalDurationForModule(moduleId: HelpModuleId): string {
    const videos = getVideosForModule(moduleId);
    let totalSeconds = 0;

    videos.forEach((video) => {
        const parts = video.duration.split(':');
        if (parts.length === 2) {
            totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else if (parts.length === 3) {
            totalSeconds += parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        }
    });

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
