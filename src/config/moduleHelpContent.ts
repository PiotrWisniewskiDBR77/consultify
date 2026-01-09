/**
 * Module Help Content Configuration
 *
 * Contains help documentation for all application modules.
 * Used by HelpSidePanel to show contextual help.
 */

export type HelpModuleId = string;

export interface ModuleHelp {
    id: HelpModuleId;
    name?: string | { pl?: string; en?: string };
    title: string;
    description: string;
    content: string;
    icon?: string;
    translationKey?: string;
    relatedModules?: string[];
    targetAudience?: string[];
}

export const MODULE_HELP_CONTENT: Record<HelpModuleId, ModuleHelp> = {
    welcome: {
        id: 'welcome',
        title: 'Welcome',
        description: 'Welcome to Consultinity',
        content: 'Welcome to Consultinity help center.',
        icon: 'Home',
        translationKey: 'help.sidePanel.modules.welcome',
    },
    dashboard: {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'Your central command center for monitoring digital transformation progress.',
        content:
            'The dashboard provides a real-time overview of assessments, initiatives, and key metrics across your organization.',
        icon: 'LayoutDashboard',
        translationKey: 'help.sidePanel.modules.dashboard',
        relatedModules: ['assessment', 'initiatives', 'reports'],
        targetAudience: ['all'],
    },
    assessment: {
        id: 'assessment',
        title: 'Assessment Hub',
        description: 'AI-powered digital maturity assessments using industry frameworks.',
        content:
            'Run comprehensive assessments using CMMI, LEAN 4.0, and other frameworks to understand your digital readiness.',
        icon: 'ClipboardCheck',
        translationKey: 'help.sidePanel.modules.assessment',
        relatedModules: ['dashboard', 'initiatives', 'roadmap'],
        targetAudience: ['consultant', 'manager', 'executive'],
    },
    initiatives: {
        id: 'initiatives',
        title: 'Initiatives',
        description: 'Create and manage digital transformation initiatives.',
        content:
            'Full lifecycle management for transformation projects with stage-gate workflows, resource allocation, and risk management.',
        icon: 'Rocket',
        translationKey: 'help.sidePanel.modules.initiatives',
        relatedModules: ['assessment', 'roadmap', 'reports'],
        targetAudience: ['manager', 'executive'],
    },
    roadmap: {
        id: 'roadmap',
        title: 'Roadmap',
        description: 'Strategic planning timeline for your transformation journey.',
        content:
            'Visualize and plan your transformation timeline with dependencies, milestones, and resource allocation.',
        icon: 'Map',
        translationKey: 'help.sidePanel.modules.roadmap',
        relatedModules: ['initiatives', 'assessment'],
        targetAudience: ['executive', 'manager'],
    },
    reports: {
        id: 'reports',
        title: 'Reports',
        description: 'Generate comprehensive management reports and status updates.',
        content:
            'Create executive summaries, progress reports, and stakeholder presentations with AI-powered insights.',
        icon: 'FileText',
        translationKey: 'help.sidePanel.modules.reports',
        relatedModules: ['dashboard', 'initiatives'],
        targetAudience: ['executive', 'manager'],
    },
    ai_chat: {
        id: 'ai_chat',
        title: 'AI Chat',
        description: 'Interactive AI assistant for data analysis and recommendations.',
        content:
            'Ask questions about your data, get recommendations, and automate tasks with our AI-powered assistant.',
        icon: 'Bot',
        translationKey: 'help.sidePanel.modules.aiChat',
        relatedModules: ['dashboard', 'assessment', 'initiatives'],
        targetAudience: ['all'],
    },
    settings: {
        id: 'settings',
        title: 'Settings',
        description: 'Configure your profile and organization settings.',
        content: 'Manage your profile, organization settings, billing, security, and preferences.',
        icon: 'Settings',
        translationKey: 'help.sidePanel.modules.settings',
        relatedModules: [],
        targetAudience: ['all'],
    },
    admin: {
        id: 'admin',
        title: 'Admin Panel',
        description: 'Organization administration and team management.',
        content: 'Manage team members, roles, permissions, and organization-wide settings.',
        icon: 'Users',
        translationKey: 'help.sidePanel.modules.admin',
        relatedModules: ['settings'],
        targetAudience: ['admin', 'owner'],
    },
    superadmin: {
        id: 'superadmin',
        title: 'Super Admin',
        description: 'Platform administration and system monitoring.',
        content:
            'Monitor platform health, manage organizations, view analytics, and configure system-wide settings.',
        icon: 'Shield',
        translationKey: 'help.sidePanel.modules.superadmin',
        relatedModules: [],
        targetAudience: ['superadmin'],
    },
    knowledge: {
        id: 'knowledge',
        title: 'Knowledge Base',
        description: 'Browse resources, templates, and best practices.',
        content:
            'Access a library of transformation templates, best practices, case studies, and educational content.',
        icon: 'BookOpen',
        translationKey: 'help.sidePanel.modules.knowledge',
        relatedModules: ['assessment', 'initiatives'],
        targetAudience: ['all'],
    },
    mywork: {
        id: 'mywork',
        title: 'My Work',
        description: 'Your personal task inbox and focus view.',
        content: 'Track your assigned tasks, notifications, and personal workflow in one place.',
        icon: 'CheckSquare',
        translationKey: 'help.sidePanel.modules.mywork',
        relatedModules: ['initiatives', 'dashboard'],
        targetAudience: ['all'],
    },
    partner: {
        id: 'partner',
        title: 'Partner Portal',
        description: 'Partner and affiliate program management.',
        content: 'Access partner resources, track referrals, and manage affiliate relationships.',
        icon: 'Handshake',
        translationKey: 'help.sidePanel.modules.partner',
        relatedModules: [],
        targetAudience: ['partner'],
    },
    onboarding: {
        id: 'onboarding',
        title: 'Onboarding',
        description: 'Guided introduction to the platform.',
        content:
            'Step-by-step tutorials and setup assistance to help you get started with Consultinity.',
        icon: 'GraduationCap',
        translationKey: 'help.sidePanel.modules.onboarding',
        relatedModules: ['dashboard', 'assessment'],
        targetAudience: ['new_user'],
    },
};

export function getModuleHelp(id: HelpModuleId): ModuleHelp | null {
    return MODULE_HELP_CONTENT[id] || null;
}

export function getModuleHelpByTranslationKey(key: string): ModuleHelp | null {
    const entry = Object.values(MODULE_HELP_CONTENT).find((m) => m.translationKey === key);
    return entry || null;
}

export function getAllModuleIds(): HelpModuleId[] {
    return Object.keys(MODULE_HELP_CONTENT);
}

export function getRelatedModules(id: HelpModuleId): ModuleHelp[] {
    const module = MODULE_HELP_CONTENT[id];
    if (!module?.relatedModules) return [];
    return module.relatedModules
        .map((relId) => MODULE_HELP_CONTENT[relId])
        .filter((m): m is ModuleHelp => !!m);
}
