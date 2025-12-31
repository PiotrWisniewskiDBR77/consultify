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
        translationKey: 'help.sidePanel.modules.dashboard'
    },

    // ==========================================
    // ASSESSMENT MODULE
    // ==========================================
    assessment: {
        id: 'assessment',
        icon: 'CheckCircle2',
        targetAudience: ['user', 'admin'],
        relatedModules: ['initiatives', 'reports', 'organization'],
        translationKey: 'help.sidePanel.modules.assessment'
    },

    // ==========================================
    // INITIATIVES MODULE
    // ==========================================
    initiatives: {
        id: 'initiatives',
        icon: 'Lightbulb',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'roadmap', 'implementation'],
        translationKey: 'help.sidePanel.modules.initiatives'
    },

    // ==========================================
    // ROADMAP MODULE
    // ==========================================
    roadmap: {
        id: 'roadmap',
        icon: 'Calendar',
        targetAudience: ['user', 'admin'],
        relatedModules: ['initiatives', 'implementation', 'reports'],
        translationKey: 'help.sidePanel.modules.roadmap'
    },

    // ==========================================
    // IMPLEMENTATION MODULE
    // ==========================================
    implementation: {
        id: 'implementation',
        icon: 'Rocket',
        targetAudience: ['user', 'admin'],
        relatedModules: ['roadmap', 'reports', 'mywork'],
        translationKey: 'help.sidePanel.modules.implementation'
    },

    // ==========================================
    // REPORTS MODULE
    // ==========================================
    reports: {
        id: 'reports',
        icon: 'FileText',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'implementation', 'dashboard'],
        translationKey: 'help.sidePanel.modules.reports'
    },

    // ==========================================
    // MY WORK MODULE
    // ==========================================
    mywork: {
        id: 'mywork',
        icon: 'Briefcase',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'implementation'],
        translationKey: 'help.sidePanel.modules.mywork'
    },

    // ==========================================
    // ORGANIZATION MODULE
    // ==========================================
    organization: {
        id: 'organization',
        icon: 'Building2',
        targetAudience: ['admin'],
        relatedModules: ['assessment', 'initiatives', 'dashboard'],
        translationKey: 'help.sidePanel.modules.organization'
    },

    // ==========================================
    // SETTINGS MODULE
    // ==========================================
    settings: {
        id: 'settings',
        icon: 'Settings',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'mywork'],
        translationKey: 'help.sidePanel.modules.settings'
    },

    // ==========================================
    // ADMIN MODULE
    // ==========================================
    admin: {
        id: 'admin',
        icon: 'Shield',
        targetAudience: ['admin'],
        relatedModules: ['superadmin', 'settings', 'organization'],
        translationKey: 'help.sidePanel.modules.admin'
    },

    // ==========================================
    // SUPERADMIN MODULE
    // ==========================================
    superadmin: {
        id: 'superadmin',
        icon: 'Crown',
        targetAudience: ['superadmin'],
        relatedModules: ['admin'],
        translationKey: 'help.sidePanel.modules.superadmin'
    },

    // ==========================================
    // AI TOOLS MODULE
    // ==========================================
    'ai-tools': {
        id: 'ai-tools',
        icon: 'Sparkles',
        targetAudience: ['user', 'admin'],
        relatedModules: ['assessment', 'initiatives', 'implementation'],
        translationKey: 'help.sidePanel.modules.ai-tools'
    },

    // ==========================================
    // KNOWLEDGE MODULE
    // ==========================================
    knowledge: {
        id: 'knowledge',
        icon: 'BookOpen',
        targetAudience: ['user'],
        relatedModules: ['assessment', 'ai-tools'],
        translationKey: 'help.sidePanel.modules.knowledge'
    },

    // ==========================================
    // ONBOARDING MODULE (New)
    // ==========================================
    onboarding: {
        id: 'onboarding',
        icon: 'Flag',
        targetAudience: ['user'],
        relatedModules: ['dashboard', 'settings'],
        translationKey: 'help.sidePanel.modules.onboarding'
    },

    // ==========================================
    // CONSULTANT MODULE (New)
    // ==========================================
    consultant: {
        id: 'consultant',
        icon: 'Users',
        targetAudience: ['admin', 'superadmin'],
        relatedModules: ['ecosystem'],
        translationKey: 'help.sidePanel.modules.consultant'
    },

    // ==========================================
    // ECOSYSTEM MODULE (New)
    // ==========================================
    ecosystem: {
        id: 'ecosystem',
        icon: 'Globe',
        targetAudience: ['admin'],
        relatedModules: ['consultant'],
        translationKey: 'help.sidePanel.modules.ecosystem'
    },
    // ==========================================
    // PLAYBOOK TEMPLATES MODULE (New)
    // ==========================================
    'playbook-templates': {
        id: 'playbook-templates',
        icon: 'Layers',
        targetAudience: ['superadmin'],
        relatedModules: ['superadmin'],
        translationKey: 'help.sidePanel.modules.playbookTemplates'
    }
};

/**
 * Get help content for a specific module
 */
export function getModuleHelp(moduleId: HelpModuleId): ModuleHelp | undefined {
    return MODULE_HELP_CONTENT[moduleId];
}

export default MODULE_HELP_CONTENT;
