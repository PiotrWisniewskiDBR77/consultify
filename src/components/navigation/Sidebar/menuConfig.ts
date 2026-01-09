/**
 * Sidebar Menu Configuration - Apple HIG Design System
 *
 * Centralized menu structure configuration.
 */

import {
    Activity,
    Bell,
    BookOpen,
    Brain,
    Briefcase,
    Building2,
    Calculator,
    CheckCircle2,
    ClipboardList,
    Cpu,
    CreditCard,
    Database,
    Factory,
    Globe,
    Home,
    Layers,
    LayoutDashboard,
    Lightbulb,
    Link,
    Lock,
    Map,
    MessageSquare,
    Palette,
    Rocket,
    Scale,
    Settings,
    Shield,
    Sparkles,
    Target,
    TrendingUp,
    UserCircle,
    Users,
    Workflow,
    Wrench,
    Zap,
} from 'lucide-react';
import React from 'react';

import { AppView, UserRole } from '../../../types';
import { MenuItem } from './types';

type TranslationFn = (key: string, options?: any) => any;

export function getMenuStructure(t: TranslationFn, journeyState?: string): MenuItem[] {
    return [
        {
            id: 'AI_CHAT',
            label: t('sidebar.aiChat', 'AI Chat'),
            icon: React.createElement(MessageSquare, { size: 20 }),
            viewId: AppView.AI_CHAT,
        },
        {
            id: 'MY_WORK',
            label: t('myWork.title', 'My Work'),
            icon: React.createElement(Briefcase, { size: 20 }),
            viewId: AppView.MY_WORK,
        },
        {
            id: 'PROJECT_INTELLIGENCE',
            label: t('sidebar.projectIntelligence', 'Project Intelligence'),
            icon: React.createElement(Brain, { size: 20 }),
            viewId: AppView.PROJECT_INTELLIGENCE,
            badge: 'beta',
        },
        // Ecosystem affiliate dashboard (Phase G)
        ...(journeyState === 'ECOSYSTEM_NODE'
            ? [
                {
                    id: 'AFFILIATE_DASHBOARD',
                    label: t('sidebar.affiliateDashboard', 'Ecosystem Impact'),
                    icon: React.createElement(TrendingUp, { size: 20 }),
                    viewId: AppView.AFFILIATE_DASHBOARD,
                },
            ]
            : []),
        {
            id: 'MODULE_2',
            label: t('sidebar.assessment'),
            icon: React.createElement(CheckCircle2, { size: 20 }),
            subItems: [
                {
                    id: 'M2_DRD',
                    label: t('sidebar.assessmentDRD'),
                    viewId: AppView.ASSESSMENT_DRD,
                    icon: React.createElement(Activity, { size: 16 }),
                },
                {
                    id: 'M2_SIRI',
                    label: t('sidebar.assessmentSIRI'),
                    viewId: AppView.ASSESSMENT_SIRI,
                    icon: React.createElement(Cpu, { size: 16 }),
                },
                {
                    id: 'M2_ADMA',
                    label: t('sidebar.assessmentADMA'),
                    viewId: AppView.ASSESSMENT_ADMA,
                    icon: React.createElement(Database, { size: 16 }),
                },
                {
                    id: 'M2_CMMI',
                    label: t('sidebar.assessmentCMMI'),
                    viewId: AppView.ASSESSMENT_CMMI,
                    icon: React.createElement(Layers, { size: 16 }),
                },
                {
                    id: 'M2_LEAN',
                    label: t('sidebar.assessmentLean'),
                    viewId: AppView.ASSESSMENT_LEAN,
                    icon: React.createElement(Workflow, { size: 16 }),
                },
            ],
        },
        {
            id: 'MODULE_PORTFOLIO',
            label: t('sidebar.portfolioRoadmap', 'Initiatives'),
            icon: React.createElement(Lightbulb, { size: 20 }),
            viewId: AppView.PORTFOLIO_ROADMAP,
            requiresView: AppView.FULL_STEP1_ASSESSMENT,
        },
        {
            id: 'MODULE_4',
            label: t('sidebar.implementation'),
            icon: React.createElement(Rocket, { size: 20 }),
            viewId: AppView.IMPLEMENTATION,
            requiresView: AppView.PORTFOLIO_ROADMAP,
        },
        {
            id: 'MODULE_BENEFITS',
            label: t('sidebar.benefitsRealization'),
            icon: React.createElement(Map, { size: 20 }),
            viewId: AppView.BENEFITS_REALIZATION,
            requiresView: AppView.IMPLEMENTATION,
        },
        {
            id: 'MODULE_ECONOMICS',
            label: t('sidebar.economics'),
            icon: React.createElement(Calculator, { size: 20 }),
            viewId: AppView.ECONOMICS,
            requiresView: AppView.FULL_STEP5_EXECUTION,
        },
        {
            id: 'MODULE_7',
            label: t('sidebar.module7'),
            icon: React.createElement(BookOpen, { size: 20 }),
            viewId: AppView.FULL_STEP6_REPORTS,
            requiresView: AppView.FULL_STEP5_EXECUTION,
            badge: 'beta',
        },
        {
            id: 'MODULE_TOOLS',
            label: t('sidebar.tools'),
            icon: React.createElement(Wrench, { size: 20 }),
            badge: 'beta',
            subItems: [
                {
                    id: 'TOOLS_AI_ADVISOR',
                    label: t('sidebar.aiAdvisor', 'AI Advisor'),
                    viewId: AppView.AI_ACTION_PROPOSALS,
                    requiresView: AppView.MY_WORK,
                    icon: React.createElement(Sparkles, { size: 16 }),
                },
                {
                    id: 'TOOLS_AUTOMATION',
                    label: t('sidebar.automationScheme', 'Schemat automatyzacji'),
                    viewId: AppView.KPI_OKR_DASHBOARD,
                    requiresView: AppView.MY_WORK,
                    icon: React.createElement(Workflow, { size: 16 }),
                },
                {
                    id: 'TOOLS_STUDIO',
                    label: t('sidebar.studio', 'Studio'),
                    viewId: AppView.STUDIO,
                    requiresView: AppView.MY_WORK,
                    icon: React.createElement(Palette, { size: 16 }),
                },
            ],
        },
    ];
}

export function getAdminMenuItem(t: TranslationFn): MenuItem {
    return {
        id: 'ADMIN',
        label: t('sidebar.adminPanel'),
        icon: React.createElement(Shield, { size: 20 }),
        viewId: AppView.ADMIN_DASHBOARD,
        // No subItems - admin panel has its own internal navigation
    };
}

export function getOrganizationMenuItem(t: TranslationFn): MenuItem {
    return {
        id: 'ORGANIZATION',
        label: t('sidebar.organization'),
        icon: React.createElement(Factory, { size: 20 }),
        subItems: [
            {
                id: 'CTX_1',
                label: t('sidebar.context.profile'),
                viewId: AppView.CONTEXT_BUILDER_PROFILE,
                icon: React.createElement(Target, { size: 16 }),
            },
            {
                id: 'CTX_2',
                label: t('sidebar.context.goals'),
                viewId: AppView.CONTEXT_BUILDER_GOALS,
                icon: React.createElement(Target, { size: 16 }),
            },
            {
                id: 'CTX_3',
                label: t('sidebar.context.challenges'),
                viewId: AppView.CONTEXT_BUILDER_CHALLENGES,
                icon: React.createElement(Scale, { size: 16 }),
            },
            {
                id: 'CTX_4',
                label: t('sidebar.context.megatrends'),
                viewId: AppView.CONTEXT_BUILDER_MEGATRENDS,
                icon: React.createElement(Globe, { size: 16 }),
            },
            {
                id: 'CTX_5',
                label: t('sidebar.context.strategy'),
                viewId: AppView.CONTEXT_BUILDER_STRATEGY,
                icon: React.createElement(Zap, { size: 16 }),
            },
        ],
    };
}

export function getSettingsMenuItem(t: TranslationFn): MenuItem {
    return {
        id: 'SETTINGS',
        label: t('sidebar.settings'),
        icon: React.createElement(Settings, { size: 20 }),
        viewId: AppView.SETTINGS_PROFILE_MODULE,
        // No subItems - settings panel has its own internal navigation
    };
}

export function getPartnerMenuItem(t: TranslationFn): MenuItem {
    return {
        id: 'PARTNER_PORTAL',
        label: t('sidebar.partnerPortal', 'Partner Portal'),
        icon: React.createElement(Users, { size: 20 }),
        viewId: AppView.PARTNER_LANDING,
    };
}

export function getSuperAdminMenuItem(t: TranslationFn): MenuItem {
    return {
        id: 'SUPERADMIN',
        label: t('sidebar.superAdmin', 'SuperAdmin'),
        icon: React.createElement(Shield, { size: 20 }),
        subItems: [
            {
                id: 'SUPERADMIN_OVERVIEW',
                label: t('superadmin.overview', 'Overview'),
                viewId: AppView.SUPERADMIN_OVERVIEW,
                icon: React.createElement(LayoutDashboard, { size: 16 }),
            },
            {
                id: 'SUPERADMIN_CUSTOMERS',
                label: t('superadmin.customers', 'Customers'),
                viewId: AppView.SUPERADMIN_CUSTOMERS,
                icon: React.createElement(Users, { size: 16 }),
            },
            {
                id: 'SUPERADMIN_AI_PLATFORM',
                label: t('superadmin.aiPlatform', 'AI Platform'),
                viewId: AppView.SUPERADMIN_AI_PLATFORM,
                icon: React.createElement(Brain, { size: 16 }),
            },
            {
                id: 'SUPERADMIN_REVENUE',
                label: t('superadmin.revenue', 'Revenue'),
                viewId: AppView.SUPERADMIN_REVENUE,
                icon: React.createElement(CreditCard, { size: 16 }),
            },
            {
                id: 'SUPERADMIN_SYSTEM',
                label: t('superadmin.system', 'System'),
                viewId: AppView.SUPERADMIN_SYSTEM,
                icon: React.createElement(Settings, { size: 16 }),
            },
        ],
    };
}

export function getViewName(view: AppView, t: TranslationFn): string {
    const viewNames: Record<string, string> = {
        [AppView.FULL_STEP1_ASSESSMENT]: t('sidebar.assessmentDRD'),
        [AppView.FULL_STEP2_INITIATIVES]: t('sidebar.module3_1'),
        [AppView.PORTFOLIO_ROADMAP]: t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap'),
        [AppView.FULL_STEP5_EXECUTION]: t('sidebar.realization'),
        [AppView.MY_WORK]: t('myWork.title', 'My Work'),
    };
    return viewNames[view] || t('common.previousStep');
}
