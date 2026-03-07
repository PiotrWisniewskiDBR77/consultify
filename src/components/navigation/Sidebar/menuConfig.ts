/**
 * Sidebar Menu Configuration - Apple HIG Design System
 *
 * Centralized menu structure configuration for main application modules.
 *
 * @see docs/modules/MODULE_ROUTING_ARCHITECTURE.md - Źródło prawdy dla routingu modułów
 * @see src/routes/routeConfig.ts - Mapowanie AppView → Route
 * @see src/routes/AppRoutes.tsx - Definicje Route z komponentami
 */

import {
  BookOpen,
  Brain,
  Briefcase,
  Calculator,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Factory,
  LayoutDashboard,
  Lightbulb,
  Map,
  MessageSquare,
  Package,
  Presentation,
  Rocket,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import React from 'react';

import { AppView, UserRole } from '../../../types';
import { MenuItem } from './types';

type TranslationFn = (key: string, options?: any) => any;

export function getMenuStructure(t: TranslationFn, journeyState?: string): MenuItem[] {
  return [
    // 1. Czat - podstawowa rozmowa z AI
    {
      id: 'AI_CHAT',
      label: t('sidebar.aiChat', 'Chat'),
      icon: React.createElement(MessageSquare, { size: 20 }),
      viewId: AppView.AI_CHAT,
    },
    // 2. My Work - moja praca, zadania, inbox
    {
      id: 'MY_WORK',
      label: t('myWork.title', 'My Work'),
      icon: React.createElement(Briefcase, { size: 20 }),
      viewId: AppView.MY_WORK,
    },
    // 3. Wywiad - ustrukturyzowana rozmowa z AI konsultantem (Discovery Consultant)
    {
      id: 'INTERVIEW',
      label: t('sidebar.interview', 'Interview'),
      icon: React.createElement(ClipboardList, { size: 20 }),
      viewId: AppView.DISCOVERY_CONSULTANT,
    },
    // 3. Narzędzia (v3): jeden obszar Tools (Discovery + Assessments)
    {
      id: 'TOOLS',
      label: t('sidebar.tools', 'Tools'),
      icon: React.createElement(Wrench, { size: 20 }),
      viewId: AppView.DISCOVERY_TOOLS,
      subItems: [
        {
          id: 'TOOLS_LIBRARY',
          label: t('sidebar.toolsLibrary', 'Library'),
          icon: React.createElement(BookOpen, { size: 16 }),
          viewId: AppView.DISCOVERY_TOOLS,
        },
        {
          id: 'TOOLS_ASSESSMENT',
          label: t('sidebar.assessment', 'Assessment'),
          icon: React.createElement(CheckCircle2, { size: 16 }),
          viewId: AppView.ASSESSMENT_OVERVIEW,
        },
      ],
    },
    // 5. Inicjatywy - zarządzanie inicjatywami
    {
      id: 'MODULE_INITIATIVES',
      label: t('sidebar.initiatives', 'Initiatives'),
      icon: React.createElement(Lightbulb, { size: 20 }),
      viewId: AppView.PORTFOLIO_ROADMAP,
    },
    // 6. Wdrożenie - realizacja zatwierdzonych inicjatyw
    {
      id: 'MODULE_EXECUTION',
      label: t('sidebar.execution', 'Execution'),
      icon: React.createElement(Rocket, { size: 20 }),
      viewId: AppView.IMPLEMENTATION,
    },
    // 7. Resultaty - śledzenie efektów (KPI/ROI) zrealizowanych inicjatyw
    {
      id: 'MODULE_BENEFITS',
      label: t('sidebar.results', 'Results'),
      icon: React.createElement(TrendingUp, { size: 20 }),
      viewId: AppView.BENEFITS_REALIZATION,
    },
    // 8. Finanse - Financial Analysis v3
    {
      id: 'MODULE_ECONOMICS',
      label: t('sidebar.economics', 'Finance'),
      icon: React.createElement(Calculator, { size: 20 }),
      viewId: AppView.ECONOMICS,
    },
    // 9. Prezentacje (V3 unified hub contains reports & templates)
    {
      id: 'MODULE_PRESENTATIONS',
      label: t('sidebar.presentations', 'Presentations'),
      icon: React.createElement(Presentation, { size: 20 }),
      viewId: AppView.PRESENTATIONS,
    },
    {
      id: 'MODULE_MEETING',
      label: t('sidebar.meeting', 'Meeting'),
      icon: React.createElement(Users, { size: 20 }),
      viewId: AppView.MEETING,
    },
    {
      id: 'MCP_IRIS',
      label: t('sidebar.mcpIris', 'MCP IRIS'),
      icon: React.createElement(Brain, { size: 20 }),
      viewId: AppView.MCP_IRIS_COMING_SOON,
      badge: 'soon',
    },
    {
      id: 'MCP_MARKETPLACE',
      label: t('sidebar.mcpMarketplace', 'MCP Marketplace'),
      icon: React.createElement(Package, { size: 20 }),
      viewId: AppView.MCP_MARKETPLACE_COMING_SOON,
      badge: 'soon',
    },
    // Ecosystem affiliate dashboard (Phase G - conditional)
    ...(journeyState === 'ECOSYSTEM_NODE'
      ? [
          {
            id: 'AFFILIATE_DASHBOARD',
            label: t('sidebar.affiliateDashboard', 'Ecosystem Impact'),
            icon: React.createElement(Map, { size: 20 }),
            viewId: AppView.AFFILIATE_DASHBOARD,
          },
        ]
      : []),
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
    viewId: AppView.ORGANIZATION_PROFILE,
    // No subItems - organization module has its own internal navigation (like Settings)
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
    [AppView.ASSESSMENT_OVERVIEW]: t('licensedTools.moduleName', 'Licensed Tools'),
    [AppView.FULL_STEP2_INITIATIVES]: t('sidebar.module3_1'),
    [AppView.PORTFOLIO_ROADMAP]: t('sidebar.portfolioRoadmap', 'Portfolio & Roadmap'),
    [AppView.FULL_STEP5_EXECUTION]: t('sidebar.realization'),
    [AppView.MY_WORK]: t('myWork.title', 'My Work'),
    [AppView.MCP_IRIS_COMING_SOON]: t('sidebar.mcpIris', 'MCP IRIS'),
    [AppView.MCP_MARKETPLACE_COMING_SOON]: t('sidebar.mcpMarketplace', 'MCP Marketplace'),
  };
  return viewNames[view] || t('common.previousStep');
}
