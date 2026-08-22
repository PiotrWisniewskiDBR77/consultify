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
  Bot,
  Brain,
  Briefcase,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  Factory,
  FileText,
  FolderOutput,
  GitBranch,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  Presentation,
  Rocket,
  Settings,
  Shield,
  Table,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import React from 'react';

import { AppView, UserRole } from '../../../types';
import { MenuItem } from './types';

type TranslationFn = (key: string, options?: any) => any;

export function getMenuStructure(t: TranslationFn, _journeyState?: string): MenuItem[] {
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
    // Client Vault (HP-22) i Run agent (HP-4 F3) — USUNIĘTE z menu głównego
    // (VLT-004/AGT-003, relokacja 2026-07-23): obie powierzchnie żyją teraz
    // jako zakładki w My Work ('vault'/'agent', MyWorkHub.tsx). Stare route'y
    // (/vault, /agent-plan) przekierowują na `#my-work?tab=...` — patrz
    // AppRoutes.tsx. Sama relokacja, funkcjonalność bez zmian.
    // 3. Wywiad - ustrukturyzowana rozmowa z AI konsultantem (Discovery Consultant)
    {
      id: 'INTERVIEW',
      label: t('sidebar.interview', 'Interview'),
      icon: React.createElement(ClipboardList, { size: 20 }),
      viewId: AppView.DISCOVERY_CONSULTANT,
    },
    // 3. Narzędzia (DECYZJA-D2): Tools i Assessment jako DWA równorzędne
    // top-level wpisy sidebara (nie flyout submenu pod „Tools"). Routing
    // /assessment (ASSESSMENT_OVERVIEW) istnieje niezależnie od /discovery-tools —
    // to zmiana struktury nav, nie nowy routing.
    {
      id: 'TOOLS',
      label: t('sidebar.tools', 'Tools'),
      icon: React.createElement(Wrench, { size: 20 }),
      viewId: AppView.DISCOVERY_TOOLS,
    },
    {
      id: 'TOOLS_ASSESSMENT',
      label: t('sidebar.assessment', 'Assessment'),
      icon: React.createElement(CheckCircle2, { size: 20 }),
      viewId: AppView.ASSESSMENT_OVERVIEW,
    },
    // 5. Inicjatywy - zarządzanie inicjatywami
    {
      id: 'MODULE_INITIATIVES',
      label: t('sidebar.initiatives', 'Initiatives'),
      icon: React.createElement(Lightbulb, { size: 20 }),
      // Spine-nav fix (BL-1): point to the canonical InitiativesHub at
      // /initiatives. Previously AppView.PORTFOLIO_ROADMAP routed to the legacy
      // /portfolio view, breaking the hub-and-spoke flow.
      viewId: AppView.FULL_STEP2_INITIATIVES,
    },
    // 6. Wdrożenie - realizacja zatwierdzonych inicjatyw
    {
      id: 'MODULE_EXECUTION',
      label: t('sidebar.execution', 'Execution'),
      icon: React.createElement(Rocket, { size: 20 }),
      viewId: AppView.FULL_STEP5_EXECUTION,
    },
    // 7. Resultaty - śledzenie efektów (KPI/ROI) zrealizowanych inicjatyw
    {
      id: 'MODULE_BENEFITS',
      label: t('sidebar.results', 'Results'),
      icon: React.createElement(TrendingUp, { size: 20 }),
      viewId: AppView.BENEFITS_REALIZATION,
      badge: 'beta',
    },
    // 7.5 Wnioski (Conclusions) — HIDDEN from sidebar (owner decision 2026-07-04:
    // added without consent). Route/AppView.CONCLUSIONS stays wired; only the nav
    // entry is removed so there is zero trace in the sidebar. Restore by
    // un-commenting when the owner explicitly approves the module.
    // {
    //   id: 'MODULE_CONCLUSIONS',
    //   label: t('sidebar.conclusions', 'Conclusions'),
    //   icon: React.createElement(Gavel, { size: 20 }),
    //   viewId: AppView.CONCLUSIONS,
    //   badge: 'beta',
    // },
    // 8. Finanse - Financial Analysis v3
    {
      id: 'MODULE_ECONOMICS',
      label: t('sidebar.economics', 'Finance'),
      icon: React.createElement(Calculator, { size: 20 }),
      viewId: AppView.ECONOMICS,
      badge: 'beta',
    },
    // 9. Materiały — ONE unified module: library (table) of all created materials
    // (decks, reports, tables, templates) + "Nowy" creation. Consolidates the former
    // four sidebar entries (Outputs / Document Studio / Presentation Studio / Table
    // Studio) into one. The studio routes (/document-studio, /prezentacje, /tabele)
    // still exist and are reached via "Nowy" + format choice — they are simply no
    // longer separate sidebar items. id kept as MODULE_PRESENTATIONS so beta-access
    // / route gates stay intact.
    {
      id: 'MODULE_PRESENTATIONS',
      label: t('sidebar.materialy', 'Materials'),
      icon: React.createElement(FolderOutput, { size: 20 }),
      viewId: AppView.PRESENTATIONS,
      badge: 'beta',
    },
    // 9.1 Excel — kanon 2026-07-26 (docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md
    // §3): osobna pozycja "Excel" w sidebarze była DUPLIKATEM Materiały→Arkusze
    // i znika z głównej nawigacji NIEZALEŻNIE od stanu isExceleEngineEnabled()
    // (funkcja pozostaje w pełni dostępna: Materiały → zakładka "Arkusze").
    // Trasa /excele (AppView.EXCELE) zostaje w routingu (AppRoutes.tsx) dla
    // zgodności wstecznej z deep linkami — usunięty jest TYLKO klikalny wpis
    // menu, nie sama trasa/funkcja.
    // 9.5 Audyty - Audit Orchestrator hub (DRD/SIRI/ADMA/Lean program runner).
    // The functional hub lives at /audit-programs (AppRoutes), reached via the
    // canonical audits AppView so it inherits the authenticated app shell.
    // Positioned under Materials (Reports/Materials group) per owner instruction (#85).
    // H6.8 (2026-07-18): betaAccess.ts flipped MODULE_AUDITS 'closed' -> 'open' on
    // 07-16 (Piotr's own acceptance commit dfb83212dc — "816 linii + backend,
    // demo-ready"), but this badge was left at 'soon' ("Wkrótce"), which lies to
    // users: the module is fully clickable and functional, not upcoming. Badge
    // corrected to 'beta' to match the other GA-per-D-A modules (Results/Finance/
    // Materials) that are also 'open' in BETA_MENU_STATUS yet still carry a beta
    // badge (access is unrestricted; badge is informational only).
    {
      id: 'MODULE_AUDITS',
      label: t('sidebar.audits', 'Audits'),
      icon: React.createElement(ClipboardCheck, { size: 20 }),
      viewId: AppView.ASSESSMENT_AUDITS,
      badge: 'beta',
    },
    {
      id: 'MODULE_MEETING',
      label: t('sidebar.meeting', 'Meeting'),
      icon: React.createElement(Users, { size: 20 }),
      viewId: AppView.MEETING,
      badge: 'beta',
    },
    // MCP IRIS (14) and MCP Marketplace (15) removed from navigation per decision
    // D7 (placeholder-only modules dropped). Their routes now redirect to /chat.
    // Ecosystem affiliate dashboard dropped per decision #1 (Harvard): the dashboard
    // was UI-complete but backend-stubbed (always 503/zeros). Route redirects to /chat;
    // DB + backend kept as dormant foundations. Re-add this item when it ships real.
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

export function getInternalToolsMenuItem(t: TranslationFn): MenuItem {
  return {
    id: 'INTERNAL_TOOLS',
    label: t('sidebar.internalTools', 'Internal Tools'),
    icon: React.createElement(Brain, { size: 20 }),
    viewId: AppView.AI_OS_HOME,
    badge: 'beta',
    subItems: [
      {
        id: 'AI_OS_HOME',
        label: t('sidebar.aiOs', 'AI OS'),
        icon: React.createElement(Brain, { size: 16 }),
        viewId: AppView.AI_OS_HOME,
      },
      {
        id: 'AI_OS_ACTIONS',
        label: t('sidebar.aiActions', 'AI Actions'),
        icon: React.createElement(Zap, { size: 16 }),
        viewId: AppView.AI_OS_ACTION_CENTER,
      },
      {
        id: 'AI_OS_RESEARCH',
        label: t('sidebar.aiResearch', 'Research Sessions'),
        icon: React.createElement(BookOpen, { size: 16 }),
        viewId: AppView.AI_OS_RESEARCH,
      },
      {
        id: 'AI_OS_ARTIFACTS',
        label: t('sidebar.aiArtifacts', 'Artifacts'),
        icon: React.createElement(FileText, { size: 16 }),
        viewId: AppView.AI_OS_ARTIFACTS,
      },
      {
        id: 'AI_OS_MEMORY',
        label: t('sidebar.aiMemory', 'Memory & Scope'),
        icon: React.createElement(Database, { size: 16 }),
        viewId: AppView.AI_OS_CONTEXT_MEMORY,
      },
      {
        id: 'AI_OS_CONNECTORS',
        label: t('sidebar.aiConnectors', 'Connectors'),
        icon: React.createElement(GitBranch, { size: 16 }),
        viewId: AppView.AI_OS_CONNECTORS,
      },
      {
        id: 'AI_OS_AGENTS',
        label: t('sidebar.aiAgents', 'Agents'),
        icon: React.createElement(Bot, { size: 16 }),
        viewId: AppView.AI_OS_AGENTS,
      },
      {
        id: 'AI_OS_OUTCOMES',
        label: t('sidebar.aiOutcomes', 'KPI/ROI & AI Ops'),
        icon: React.createElement(TrendingUp, { size: 16 }),
        viewId: AppView.AI_OS_OUTCOMES,
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
    viewId: AppView.SUPERADMIN_CUSTOMERS,
    // Superadmin owns a dedicated internal shell; the global sidebar acts only
    // as the launcher into that control plane to avoid duplicated IA.
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
    [AppView.CLIENT_VAULT]: t('sidebar.clientVault', 'Client Vault'),
    [AppView.AGENT_PLAN]: t('sidebar.agentPlan', 'Run agent'),
    [AppView.MCP_IRIS_COMING_SOON]: t('sidebar.mcpIris', 'MCP IRIS'),
    [AppView.MCP_MARKETPLACE_COMING_SOON]: t('sidebar.mcpMarketplace', 'MCP Marketplace'),
    [AppView.CONCLUSIONS]: t('sidebar.conclusions', 'Conclusions'),
    [AppView.PRESENTATIONS]: t('sidebar.materialy', 'Materials'),
    [AppView.PREZENTACJE_GEN]: t('sidebar.prezentacje', 'Presentation Studio'),
    [AppView.WORDY]: t('sidebar.wordy', 'Documents'),
    [AppView.EXCELE]: t('sidebar.excele', 'Excel'),
    [AppView.TABELE]: t('sidebar.tabele', 'Table Studio'),
  };
  return viewNames[view] || t('common.previousStep');
}
