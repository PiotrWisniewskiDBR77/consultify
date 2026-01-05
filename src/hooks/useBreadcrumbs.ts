import { useTranslation } from 'react-i18next';

import { useAppStore } from '../store/useAppStore';
import { AppView } from '../types';

export const useBreadcrumbs = () => {
    const { t } = useTranslation();
    const { currentView } = useAppStore();

    const sidebarT = t('sidebar', { returnObjects: true }) as Record<string, any>;

    const step1T = t('step1', { returnObjects: true }) as Record<string, any>;

    // Default values
    let section = sidebarT.dashboard || 'Dashboard';
    let sub = '';

    const viewParts = currentView.split('_');

    // My Work View
    if (currentView === AppView.MY_WORK) {
        section = t('sidebar.dashboard');
        sub = t('myWork.title');
    }
    // Assessment Module Views
    else if (currentView === AppView.ASSESSMENT_DRD) {
        section = t('sidebar.assessment');
        sub = t('sidebar.assessmentDRD');
    } else if (currentView === AppView.ASSESSMENT_SIRI) {
        section = t('sidebar.assessment');
        sub = t('sidebar.assessmentSIRI');
    } else if (currentView === AppView.ASSESSMENT_ADMA) {
        section = t('sidebar.assessment');
        sub = t('sidebar.assessmentADMA');
    } else if (currentView === AppView.ASSESSMENT_CMMI) {
        section = t('sidebar.assessment');
        sub = t('sidebar.assessmentCMMI');
    } else if (currentView === AppView.ASSESSMENT_LEAN || currentView === AppView.ASSESSMENT_LEAN_EXTERNAL) {
        section = t('sidebar.assessment');
        sub = t('sidebar.assessmentLean');
    } else if (currentView === AppView.ASSESSMENT_SUMMARY || currentView === AppView.ASSESSMENT_OVERVIEW) {
        section = t('sidebar.assessment');
        sub = t('assessment.workspace.dashboardHeader');
    } else if (currentView === AppView.ASSESSMENT_AUDITS) {
        section = t('sidebar.assessment');
        sub = t('sidebar.otherAssessments');
    }
    // Context Builder Views
    else if (currentView.startsWith('CONTEXT_BUILDER')) {
        section = t('sidebar.module1');
        if (currentView === AppView.CONTEXT_BUILDER_PROFILE) {
            sub = t('sidebar.context.profile');
        } else if (currentView === AppView.CONTEXT_BUILDER_GOALS) {
            sub = t('sidebar.context.goals');
        } else if (currentView === AppView.CONTEXT_BUILDER_CHALLENGES) {
            sub = t('sidebar.context.challenges');
        } else if (currentView === AppView.CONTEXT_BUILDER_MEGATRENDS) {
            sub = t('sidebar.context.megatrends');
        } else if (currentView === AppView.CONTEXT_BUILDER_STRATEGY) {
            sub = t('sidebar.context.strategy');
        } else {
            sub = t('sidebar.context.profile');
        }
    }
    // Full Transformation Views
    else if (currentView === AppView.FULL_STEP1_CONTEXT) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.module1');
    } else if (currentView === AppView.FULL_STEP1_ASSESSMENT || currentView.startsWith('FULL_STEP1_')) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullStep1');
    } else if (currentView === AppView.FULL_STEP2_INITIATIVES) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullStep2');
    } else if (currentView === AppView.FULL_STEP3_ROADMAP) {
        // Legacy - redirect to Portfolio
        section = t('sidebar.fullProject');
        sub = t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap');
    } else if (currentView === AppView.PORTFOLIO_ROADMAP) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap');
    } else if (currentView === AppView.FULL_STEP4_ROI) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullStep4');
    } else if (currentView === AppView.ECONOMICS) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.economics');
    } else if (currentView === AppView.FULL_STEP5_EXECUTION) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullStep5');
    } else if (currentView === AppView.IMPLEMENTATION) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.implementation');
    } else if (currentView === AppView.FULL_ROLLOUT) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullImplementation');
    } else if (currentView === AppView.FULL_STEP6_REPORTS) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.fullStep6');
    } else if (currentView === AppView.KPI_OKR_DASHBOARD) {
        section = t('sidebar.fullProject');
        sub = t('sidebar.kpiOkr');
    } else if (currentView === AppView.STUDIO) {
        section = t('sidebar.tools');
        sub = t('sidebar.studio', 'Studio');
    }
    // Quick Assessment Views
    else if (viewParts.includes('QUICK')) {
        section = sidebarT.quickAssessment || 'Szybka Diagnoza';
        const stepNum = viewParts[1]?.replace('STEP', '') || '1';
        sub = `${step1T.subtitle || 'Krok'} ${stepNum}`;
    }
    // Admin Views
    else if (viewParts.includes('ADMIN')) {
        section = t('sidebar.adminPanel');
        if (currentView === AppView.ADMIN_USERS) sub = t('sidebar.adminUsers');
        else if (currentView === AppView.ADMIN_PROJECTS) sub = t('sidebar.adminProjects');
        else if (currentView === AppView.ADMIN_LLM) sub = t('sidebar.adminLLM');
        else if (currentView === AppView.ADMIN_KNOWLEDGE) sub = t('sidebar.adminKnowledge');
        else if (currentView === AppView.ADMIN_FEEDBACK) sub = t('sidebar.adminFeedback');
        else if (currentView === AppView.ADMIN_BILLING) sub = t('admin.billing.title');
        else if (currentView === AppView.ADMIN_ANALYTICS) sub = t('admin.analytics.title');
        else sub = t('sidebar.dashboard');
    }
    // Settings Views
    else if (viewParts.includes('SETTINGS')) {
        section = t('sidebar.settings');
        if (currentView === AppView.SETTINGS_PROFILE) sub = t('settings.menu.myProfile');
        else if (currentView === AppView.SETTINGS_BILLING) sub = t('settings.menu.billing');
        else if (currentView === AppView.SETTINGS_AI) sub = t('settings.menu.aiConfig');
        else if (currentView === AppView.SETTINGS_NOTIFICATIONS) sub = t('settings.menu.notifications');
        else if (currentView === AppView.SETTINGS_INTEGRATIONS) sub = t('settings.menu.integrations');
        else if (currentView === AppView.SETTINGS_ORGANIZATION) sub = t('settings.menu.organization');
        else if (currentView === AppView.SETTINGS_WORK_PREFERENCES) sub = t('settings.menu.workPreferences');
        else if (currentView === AppView.SETTINGS_DASHBOARD_PREFERENCES) sub = t('settings.menu.dashboardPreferences');
        else if (currentView === AppView.SETTINGS_ACCESSIBILITY) sub = t('settings.menu.accessibility');
        else if (currentView === AppView.SETTINGS_PRIVACY) sub = t('settings.menu.privacy');
        else sub = t('settings.menu.myProfile');
    }
    // Consultant Views
    else if (currentView === AppView.CONSULTANT_PANEL) {
        section = t('consultant.section');
        sub = t('consultant.panel');
    } else if (currentView === AppView.CONSULTANT_INVITES) {
        section = t('consultant.section');
        sub = t('consultant.invites');
    }
    // AI Chat View
    else if (currentView === AppView.AI_CHAT) {
        section = 'AI';
        sub = t('sidebar.aiChat', 'Chat');
    }
    // MyWork Views (unified Dashboard + My Work)
    else if (
        currentView === AppView.USER_DASHBOARD ||
        currentView === AppView.DASHBOARD ||
        currentView === AppView.DASHBOARD_OVERVIEW ||
        currentView === AppView.DASHBOARD_SNAPSHOT ||
        (currentView as any) === AppView.MY_WORK
    ) {
        section = t('myWork.title', 'My Work');
        sub = '';
    }
    // Affiliate Dashboard
    else if (currentView === AppView.AFFILIATE_DASHBOARD) {
        section = t('sidebar.dashboard');
        sub = t('sidebar.affiliateDashboard');
    }

    return [section, sub];
};
