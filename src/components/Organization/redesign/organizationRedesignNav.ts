/**
 * M01 Organization redesign v1 — nawigacja po konsolidacji 21 → 11 ekranów.
 *
 * ŹRÓDŁO WIĄŻĄCE: `org-konsolidacja-propozycja.md` (2026-08-24, zaakceptowane
 * przez właściciela). Zasada nadrzędna: **6 grup menu zostaje bez zmian**
 * (karta zamrożenia) — konsolidujemy wyłącznie ekrany WEWNĄTRZ grup.
 *
 * KLUCZOWA DECYZJA IMPLEMENTACYJNA: skonsolidowany ekran DZIEDZICZY id ekranu
 * bazowego („ZOSTAJE" w mapie), więc:
 *   - trasy `/organization/<moduł>/<ekran>` nie zmieniają się dla ekranów
 *     pozostających,
 *   - istniejące linki do ekranów wchłoniętych da się przekierować bez migracji
 *     danych (`REDESIGN_SCREEN_REDIRECTS`),
 *   - typ `OrganizationScreen` nie wymaga nowych wariantów.
 *
 * Ten moduł NIE decyduje o widoczności — o tym decyduje `isOrgRedesignV1Enabled()`.
 */

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Compass,
  FileCheck2,
  Goal,
  Lightbulb,
  Network,
  Route,
  Scale,
  ShieldAlert,
} from 'lucide-react';

import type { DomainNavigationModule } from '../../settings/shared/DomainNavigation';
import type { OrganizationModule, OrganizationScreen } from '../OrganizationSidebar';

export type OrganizationRedesignModules = DomainNavigationModule<
  OrganizationModule,
  OrganizationScreen
>[];

/** 6 grup × 11 ekranów — dokładnie mapa §4 dokumentu konsolidacji. */
export const ORGANIZATION_REDESIGN_MODULES: OrganizationRedesignModules = [
  {
    id: 'profile',
    label: 'Profil organizacji',
    children: [
      // #1 Tożsamość i skala + #2 Model działania
      { id: 'identity-scale', label: 'Tożsamość i model działania', icon: Building2 },
      // #3 Pozycja i kierunek + #4 Technologia, kultura i ograniczenia
      { id: 'position-direction', label: 'Kierunek i ograniczenia', icon: Compass },
    ],
  },
  {
    id: 'goals',
    label: 'Cele i oczekiwania',
    children: [
      // #5 Intencja strategiczna + #6 Mierniki sukcesu
      { id: 'strategic-intent', label: 'Cele i mierniki', icon: Goal },
      // #7 Zakres i granice + #8 Oczekiwania interesariuszy
      { id: 'stakeholder-expectations', label: 'Zakres i tryb współpracy', icon: Scale },
    ],
  },
  {
    id: 'challenges',
    label: 'Wyzwania',
    children: [
      // #9 Zadeklarowane wyzwania + #12 Dowody
      { id: 'declared-challenges', label: 'Wyzwania i dowody', icon: ShieldAlert },
      // #10 Przyczyny źródłowe + #11 Blockery celów
      { id: 'root-causes', label: 'Przyczyny i blockery', icon: Route },
    ],
  },
  {
    id: 'strategy',
    label: 'Synteza strategiczna',
    children: [
      // #13 Ryzyka i szanse + #15 Rekomendacja
      { id: 'risks-opportunities', label: 'Ryzyka i szanse', icon: Lightbulb },
      // #14 Scenariusze + #16 Executive brief
      { id: 'executive-brief', label: 'Scenariusze i brief', icon: FileCheck2 },
    ],
  },
  {
    id: 'sources',
    label: 'Źródła i wiedza',
    children: [
      // #17 Pliki + #18 Twierdzenia i źródła + #19 Konflikty źródeł
      { id: 'claims-sources', label: 'Źródła i twierdzenia', icon: AlertTriangle },
      // #20 Graf wiedzy — zostaje samodzielnie
      { id: 'knowledge-graph', label: 'Graf wiedzy', icon: Network },
    ],
  },
  {
    id: 'readiness',
    label: 'Gotowość i nadzór',
    children: [
      // #21 Gotowość organizacji — zostaje samodzielnie
      { id: 'summary', label: 'Gotowość organizacji', icon: CheckCircle2 },
    ],
  },
];

const ORGANIZATION_REDESIGN_MODULE_EN: Record<OrganizationModule, string> = {
  profile: 'Organization Profile',
  goals: 'Goals & Expectations',
  challenges: 'Challenges',
  strategy: 'Strategic Synthesis',
  sources: 'Sources & Knowledge',
  readiness: 'Readiness & Governance',
};

const ORGANIZATION_REDESIGN_SCREEN_EN: Partial<Record<OrganizationScreen, string>> = {
  'identity-scale': 'Identity & Operating Model',
  'position-direction': 'Direction & Constraints',
  'strategic-intent': 'Goals & Metrics',
  'stakeholder-expectations': 'Scope & Ways of Working',
  'declared-challenges': 'Challenges & Evidence',
  'root-causes': 'Root Causes & Blockers',
  'risks-opportunities': 'Risks & Opportunities',
  'executive-brief': 'Scenarios & Brief',
  'claims-sources': 'Sources & Claims',
  'knowledge-graph': 'Knowledge Graph',
  summary: 'Organization Readiness',
};

/**
 * Ekrany wchłonięte → ekran, który przejmuje ich treść. Pozwala trzymać stare
 * linki żywe pod flagą ON, bez migracji i bez 404.
 */
export const REDESIGN_SCREEN_REDIRECTS: Partial<Record<OrganizationScreen, OrganizationScreen>> = {
  'operating-model': 'identity-scale',
  'technology-culture-constraints': 'position-direction',
  'success-metrics': 'strategic-intent',
  'scope-boundaries': 'stakeholder-expectations',
  evidence: 'declared-challenges',
  'goal-blockers': 'root-causes',
  recommendation: 'risks-opportunities',
  scenarios: 'executive-brief',
  files: 'claims-sources',
  'source-conflicts': 'claims-sources',
  'gaps-freshness': 'summary',
  'decisions-conflicts': 'summary',
  'versions-publication': 'summary',
};

export function getOrganizationRedesignModules(language?: string): OrganizationRedesignModules {
  if (language?.toLowerCase().startsWith('pl')) return ORGANIZATION_REDESIGN_MODULES;
  return ORGANIZATION_REDESIGN_MODULES.map((module) => ({
    ...module,
    label: ORGANIZATION_REDESIGN_MODULE_EN[module.id],
    children: module.children.map((screen) => ({
      ...screen,
      label: ORGANIZATION_REDESIGN_SCREEN_EN[screen.id] ?? screen.label,
    })),
  }));
}

/** Ekran docelowy pod flagą ON (sam siebie, gdy ekran zostaje). */
export function resolveRedesignScreen(screen: OrganizationScreen): OrganizationScreen {
  return REDESIGN_SCREEN_REDIRECTS[screen] ?? screen;
}

/** Liczba ekranów po konsolidacji — czytana przez testy, nie zapisana ręcznie. */
export const ORGANIZATION_REDESIGN_SCREEN_COUNT = ORGANIZATION_REDESIGN_MODULES.reduce(
  (total, module) => total + module.children.length,
  0
);
