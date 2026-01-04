/**
 * Module Help Content
 *
 * Contains comprehensive documentation for all application modules.
 * Used by HelpSidePanel to display module overviews in the "Przegląd" tab.
 */

import { HelpModuleId } from './viewToModuleMapping';
export type { HelpModuleId };

export interface ModuleHelp {
    id: HelpModuleId;
    icon: string; // Lucide icon name
    targetAudience: ('user' | 'admin' | 'superadmin')[];
    relatedModules: HelpModuleId[];
    translationKey: string;
    name?: { en: string; pl: string };
    description?: { en: string; pl: string };
}

export const MODULE_HELP_CONTENT: Record<HelpModuleId, ModuleHelp> = {
    // ==========================================
    // DASHBOARD MODULE
    // ==========================================
    dashboard: {
        id: 'dashboard',
        icon: 'LayoutDashboard',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'initiatives', 'mywork'],
        translationKey: 'help.sidePanel.modules.dashboard',
        name: { en: 'Dashboard', pl: 'Panel' },
        description: {
            en: 'Overview of key metrics and navigation',
            pl: 'Przegląd najważniejszych wskaźników i nawigacji',
        },
    },

    // ==========================================
    // ASSESSMENT MODULE
    // ==========================================
    assessment: {
        id: 'assessment',
        icon: 'CheckCircle2',
        targetAudience: ['user', 'admin'],
        relatedModules: ['initiatives', 'reports', 'organization'],
        translationKey: 'help.sidePanel.modules.assessment',
        name: { en: 'Assessment', pl: 'Ocena' },
        description: { en: 'Assess current state and identify gaps', pl: 'Ocena aktualnego stanu i identyfikacja luk' },
    },

    // ==========================================
    // INITIATIVES MODULE
    // ==========================================
    initiatives: {
        id: 'initiatives',
        icon: 'Lightbulb',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'roadmap', 'implementation'],
        translationKey: 'help.sidePanel.modules.initiatives',
        name: { en: 'Initiatives', pl: 'Inicjatywy' },
        description: {
            en: 'Manage strategic initiatives and their progress',
            pl: 'Zarządzanie strategicznymi inicjatywami i ich postępem',
        },
    },

    // ==========================================
    // ROADMAP MODULE
    // ==========================================
    roadmap: {
        id: 'roadmap',
        icon: 'Calendar',
        targetAudience: ['user', 'admin'],
        relatedModules: ['initiatives', 'implementation', 'reports'],
        translationKey: 'help.sidePanel.modules.roadmap',
        name: { en: 'Roadmap', pl: 'Plan' },
        description: {
            en: 'Plan and schedule transformation steps',
            pl: 'Planowanie i harmonogramowanie kroków transformacji',
        },
    },

    // ==========================================
    // IMPLEMENTATION MODULE
    // ==========================================
    implementation: {
        id: 'implementation',
        icon: 'Rocket',
        targetAudience: ['user', 'admin'],
        relatedModules: ['roadmap', 'reports', 'mywork'],
        translationKey: 'help.sidePanel.modules.implementation',
        name: { en: 'Implementation', pl: 'Wdrożenie' },
        description: { en: 'Execute initiatives and track results', pl: 'Wykonywanie inicjatyw i śledzenie wyników' },
    },

    // ==========================================
    // REPORTS MODULE
    // ==========================================
    reports: {
        id: 'reports',
        icon: 'FileText',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'implementation', 'dashboard'],
        translationKey: 'help.sidePanel.modules.reports',
        name: { en: 'Reports', pl: 'Raporty' },
        description: {
            en: 'Generate and view transformation reports',
            pl: 'Generowanie i przegląd raportów transformacji',
        },
    },

    // ==========================================
    // MY WORK MODULE
    // ==========================================
    mywork: {
        id: 'mywork',
        icon: 'Briefcase',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'implementation'],
        translationKey: 'help.sidePanel.modules.mywork',
        name: { en: 'My Work', pl: 'Moja Praca' },
        description: { en: 'Personal workspace and tasks', pl: 'Osobista przestrzeń robocza i zadania' },
    },

    // ==========================================
    // ORGANIZATION MODULE
    // ==========================================
    organization: {
        id: 'organization',
        icon: 'Building2',
        targetAudience: ['admin'],
        relatedModules: ['assessment', 'initiatives', 'dashboard'],
        translationKey: 'help.sidePanel.modules.organization',
        name: { en: 'Organization', pl: 'Organizacja' },
        description: {
            en: 'Manage organization settings and users',
            pl: 'Zarządzanie ustawieniami organizacji i użytkownikami',
        },
    },

    // ==========================================
    // SETTINGS MODULE
    // ==========================================
    settings: {
        id: 'settings',
        icon: 'Settings',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'mywork'],
        translationKey: 'help.sidePanel.modules.settings',
        name: { en: 'Settings', pl: 'Ustawienia' },
        description: { en: 'Configure personal preferences', pl: 'Konfiguracja preferencji osobistych' },
    },

    // ==========================================
    // ADMIN MODULE
    // ==========================================
    admin: {
        id: 'admin',
        icon: 'Shield',
        targetAudience: ['admin'],
        relatedModules: ['superadmin', 'settings', 'organization'],
        translationKey: 'help.sidePanel.modules.admin',
        name: { en: 'Admin', pl: 'Administrator' },
        description: { en: 'Administrative tools and controls', pl: 'Narzędzia i kontrolki administracyjne' },
    },

    // ==========================================
    // SUPERADMIN MODULE
    // ==========================================
    superadmin: {
        id: 'superadmin',
        icon: 'Crown',
        targetAudience: ['superadmin'],
        relatedModules: ['admin'],
        translationKey: 'help.sidePanel.modules.superadmin',
        name: { en: 'Super Admin', pl: 'Super Administrator' },
        description: { en: 'High‑level system management', pl: 'Zarządzanie na wysokim poziomie' },
    },

    // ==========================================
    // AI TOOLS MODULE
    // ==========================================
    'ai-tools': {
        id: 'ai-tools',
        icon: 'Sparkles',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'initiatives', 'implementation'],
        translationKey: 'help.sidePanel.modules.ai-tools',
        name: { en: 'AI Tools', pl: 'Narzędzia AI' },
        description: { en: 'AI‑assisted functionalities', pl: 'Funkcje wspomagane AI' },
    },

    // ==========================================
    // KNOWLEDGE MODULE
    // ==========================================
    knowledge: {
        id: 'knowledge',
        icon: 'BookOpen',
        targetAudience: ['user'],
        relatedModules: ['assessment', 'ai-tools'],
        translationKey: 'help.sidePanel.modules.knowledge',
        name: { en: 'Knowledge', pl: 'Wiedza' },
        description: { en: 'Access help articles and tutorials', pl: 'Dostęp do artykułów pomocy i tutoriali' },
    },

    // ==========================================
    // ONBOARDING MODULE (New)
    // ==========================================
    onboarding: {
        id: 'onboarding',
        icon: 'Flag',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'settings'],
        translationKey: 'help.sidePanel.modules.onboarding',
        name: { en: 'Onboarding', pl: 'Wprowadzenie' },
        description: { en: 'Guided start for new users', pl: 'Prowadzony start dla nowych użytkowników' },
    },

    // ==========================================
    // CONSULTANT MODULE (New)
    // ==========================================
    consultant: {
        id: 'consultant',
        icon: 'Users',
        targetAudience: ['admin', 'superadmin'],
        relatedModules: ['ecosystem'],
        translationKey: 'help.sidePanel.modules.consultant',
        name: { en: 'Consultant', pl: 'Konsultant' },
        description: { en: 'Consultant management tools', pl: 'Narzędzia zarządzania konsultantami' },
    },

    // ==========================================
    // ECOSYSTEM MODULE (New)
    // ==========================================
    ecosystem: {
        id: 'ecosystem',
        icon: 'Globe',
        targetAudience: ['admin'],
        relatedModules: ['consultant'],
        translationKey: 'help.sidePanel.modules.ecosystem',
        name: { en: 'Ecosystem', pl: 'Ekosystem' },
        description: { en: 'Ecosystem overview and settings', pl: 'Przegląd i ustawienia ekosystemu' },
    },
    // ==========================================
    // PLAYBOOK TEMPLATES MODULE (New)
    // ==========================================
    'playbook-templates': {
        id: 'playbook-templates',
        icon: 'Layers',
        targetAudience: ['superadmin'],
        relatedModules: ['superadmin'],
        translationKey: 'help.sidePanel.modules.playbookTemplates',
        name: { en: 'Playbook Templates', pl: 'Szablony Playbook' },
        description: { en: 'Templates for creating playbooks', pl: 'Szablony do tworzenia playbooków' },
    },
};

/**
 * Get help content for a specific module
 */
export function getModuleHelp(moduleId: HelpModuleId): ModuleHelp | undefined {
    return MODULE_HELP_CONTENT[moduleId];
}

export default MODULE_HELP_CONTENT;
