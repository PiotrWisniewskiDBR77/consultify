import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarRange,
  CheckCircle2,
  Compass,
  FileCheck2,
  FileStack,
  Goal,
  Lightbulb,
  Network,
  Route,
  Scale,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import DomainNavigation, { type DomainNavigationModule } from '../settings/shared/DomainNavigation';

export type OrganizationModule =
  | 'profile'
  | 'goals'
  | 'challenges'
  | 'strategy'
  | 'sources'
  | 'readiness';
// Compatibility for the legacy OrganizationAdminPanel, which remains the
// implementation behind redirects to the canonical Admin workspace.
export type OrganizationSection =
  | 'members'
  | 'competencies'
  | 'billing'
  | 'limits'
  | 'domains'
  | 'branding';
export type OrganizationScreen =
  | 'identity-scale'
  | 'operating-model'
  | 'position-direction'
  | 'technology-culture-constraints'
  | 'strategic-intent'
  | 'success-metrics'
  | 'scope-boundaries'
  | 'stakeholder-expectations'
  | 'declared-challenges'
  | 'root-causes'
  | 'goal-blockers'
  | 'evidence'
  | 'risks-opportunities'
  | 'scenarios'
  | 'recommendation'
  | 'executive-brief'
  | 'files'
  | 'claims-sources'
  | 'source-conflicts'
  | 'knowledge-graph'
  | 'summary'
  | 'gaps-freshness'
  | 'decisions-conflicts'
  | 'versions-publication';

export interface OrganizationLocation {
  module: OrganizationModule;
  screen: OrganizationScreen;
}

interface OrganizationSidebarProps {
  activeLocation: OrganizationLocation;
  onLocationChange: (location: OrganizationLocation) => void;
  className?: string;
  onBack?: () => void;
  /**
   * Nadpisanie informacji-architektury (redesign v1, flaga `orgRedesignV1`).
   * Pominięte ⇒ kanoniczne 21 ekranów, zachowanie bajt w bajt jak dotąd.
   */
  modules?: DomainNavigationModule<OrganizationModule, OrganizationScreen>[];
}

export const ORGANIZATION_MODULES: DomainNavigationModule<
  OrganizationModule,
  OrganizationScreen
>[] = [
  {
    id: 'profile',
    label: 'Profil organizacji',
    children: [
      { id: 'identity-scale', label: 'Tożsamość i skala', icon: Building2 },
      { id: 'operating-model', label: 'Model działania', icon: BriefcaseBusiness },
      { id: 'position-direction', label: 'Pozycja i kierunek', icon: Compass },
      {
        id: 'technology-culture-constraints',
        label: 'Technologia, kultura i ograniczenia',
        icon: Sparkles,
      },
    ],
  },
  {
    id: 'goals',
    label: 'Cele i oczekiwania',
    children: [
      { id: 'strategic-intent', label: 'Intencja strategiczna', icon: Goal },
      { id: 'success-metrics', label: 'Mierniki sukcesu', icon: BarChart3 },
      { id: 'scope-boundaries', label: 'Zakres i granice', icon: Scale },
      { id: 'stakeholder-expectations', label: 'Oczekiwania interesariuszy', icon: Users },
    ],
  },
  {
    id: 'challenges',
    label: 'Wyzwania',
    children: [
      { id: 'declared-challenges', label: 'Zadeklarowane wyzwania', icon: ShieldAlert },
      { id: 'root-causes', label: 'Przyczyny źródłowe', icon: Route },
      { id: 'goal-blockers', label: 'Blockery celów', icon: AlertTriangle },
      { id: 'evidence', label: 'Dowody', icon: FileCheck2 },
    ],
  },
  {
    id: 'strategy',
    label: 'Synteza strategiczna',
    children: [
      { id: 'risks-opportunities', label: 'Ryzyka i szanse', icon: Lightbulb },
      { id: 'scenarios', label: 'Scenariusze', icon: CalendarRange },
      { id: 'recommendation', label: 'Rekomendacja', icon: Target },
      { id: 'executive-brief', label: 'Executive brief', icon: BookOpen },
    ],
  },
  {
    id: 'sources',
    label: 'Źródła i wiedza',
    children: [
      { id: 'files', label: 'Pliki', icon: FileStack },
      { id: 'claims-sources', label: 'Twierdzenia i źródła', icon: FileCheck2 },
      { id: 'source-conflicts', label: 'Konflikty źródeł', icon: AlertTriangle },
      { id: 'knowledge-graph', label: 'Graf wiedzy', icon: Network },
    ],
  },
  {
    id: 'readiness',
    label: 'Gotowość i nadzór',
    children: [{ id: 'summary', label: 'Gotowość organizacji', icon: CheckCircle2 }],
  },
];

const ORGANIZATION_MODULE_EN: Record<OrganizationModule, string> = {
  profile: 'Organization Profile',
  goals: 'Goals & Expectations',
  challenges: 'Challenges',
  strategy: 'Strategic Synthesis',
  sources: 'Sources & Knowledge',
  readiness: 'Readiness & Governance',
};

const ORGANIZATION_SCREEN_EN: Record<OrganizationScreen, string> = {
  'identity-scale': 'Identity & Scale',
  'operating-model': 'Operating Model',
  'position-direction': 'Position & Direction',
  'technology-culture-constraints': 'Technology, Culture & Constraints',
  'strategic-intent': 'Strategic Intent',
  'success-metrics': 'Success Metrics',
  'scope-boundaries': 'Scope & Boundaries',
  'stakeholder-expectations': 'Stakeholder Expectations',
  'declared-challenges': 'Declared Challenges',
  'root-causes': 'Root Causes',
  'goal-blockers': 'Goal Blockers',
  evidence: 'Evidence',
  'risks-opportunities': 'Risks & Opportunities',
  scenarios: 'Scenarios',
  recommendation: 'Recommendation',
  'executive-brief': 'Executive Brief',
  files: 'Files',
  'claims-sources': 'Claims & Sources',
  'source-conflicts': 'Source Conflicts',
  'knowledge-graph': 'Knowledge Graph',
  summary: 'Organization Readiness',
  'gaps-freshness': 'Gaps & Freshness',
  'decisions-conflicts': 'Decisions & Conflicts',
  'versions-publication': 'Versions & Publication',
};

export function getOrganizationModules(language?: string) {
  if (language?.toLowerCase().startsWith('pl')) return ORGANIZATION_MODULES;
  return ORGANIZATION_MODULES.map((module) => ({
    ...module,
    label: ORGANIZATION_MODULE_EN[module.id],
    children: module.children.map((screen) => ({
      ...screen,
      label: ORGANIZATION_SCREEN_EN[screen.id],
    })),
  }));
}

export const OrganizationSidebar: React.FC<OrganizationSidebarProps> = ({
  activeLocation,
  onLocationChange,
  className,
  onBack,
  modules,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n?.resolvedLanguage || i18n?.language || 'pl';
  const isPolish = language.toLowerCase().startsWith('pl');
  return (
    <DomainNavigation
      title={t('organization.sidebar.title', isPolish ? 'ORGANIZACJA' : 'ORGANIZATION')}
      description={t(
        'organization.sidebar.description',
        isPolish
          ? 'Kontekst biznesowy, źródła i gotowość decyzyjna'
          : 'Business context, sources, and decision readiness'
      )}
      navigationLabel={t(
        'organization.sidebar.navigation',
        isPolish ? 'Nawigacja Organizacji' : 'Organization navigation'
      )}
      modules={modules ?? getOrganizationModules(language)}
      // Redesign (flaga ON) podaje własne `modules` — wtedy nawigacja jest
      // płaską listą 11 ekranów, jak w zaakceptowanym prototypie.
      defaultExpandAll={!!modules}
      activeModule={activeLocation.module}
      activeChild={activeLocation.screen}
      onChildChange={(module, screen) => onLocationChange({ module, screen })}
      onBack={onBack}
      backLabel={t('organization.sidebar.back', isPolish ? 'Wróć do pulpitu' : 'Back to Dashboard')}
      className={className}
    />
  );
};

export default OrganizationSidebar;
