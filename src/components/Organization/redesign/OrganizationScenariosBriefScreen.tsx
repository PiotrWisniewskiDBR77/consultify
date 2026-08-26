/**
 * „Scenariusze i brief" — ÓSMY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Syntezy (mapa konsolidacji
 * §2, pozycje #14 „Scenariusze" + #16 „Executive brief"). Dwie sekcje ekranu
 * = dwie pigułki Menu 2: Scenariusze transformacji · Executive brief. Wybór
 * scenariusza i jego streszczenie to jedna decyzja i jej podsumowanie —
 * uzasadnienie §3 dokumentu konsolidacji.
 *
 * DANE SĄ REALNE — te same źródła co stary `StrategicSynthesisModule` /
 * `TransformationScenarios` / `SynthesisSummary`:
 *   `SCENARIOS` (`src/data/transformationScenarios.ts`) — sześć skatalogowanych
 *   archetypów transformacji (nie atrapa: ten sam katalog co dziś),
 *   `useContextBuilderStore().synthesis.selectedScenarioId` — wybór zapisany
 *   w tym samym polu co stary ekran,
 *   `useContextBuilderStore()` (`goals`, `challenges`, `synthesis`,
 *   `companyProfile`) — te same liczniki co `SynthesisSummary`.
 *
 * NAPRAWIONE PRZY OKAZJI (§5.4/§5.5 dokumentu konsolidacji — obowiązują na
 * WSZYSTKICH 11 ekranach, bez wyjątków):
 *   - emoji jako ikony scenariuszy (`SCENARIOS[].icon` — 🏗️🎯⚡🤖💡📊) →
 *     zamienione na ikony liniowe `lucide-react` (mapa po `id`, bo to jedyne
 *     stabilne pole — emoji w danych źródłowych zostaje nietknięte, użyte
 *     tylko do wyboru ikony),
 *   - crimson jako kolor UI (pigułka „RECOMMENDED" na `dawnym crimson tle`, ciemny
 *     pas hero `dawnym crimson gradiencie` w „AI Strategic
 *     Recommendations") → usunięte; oznaczenie rekomendacji to teraz cichy
 *     `OrgStatusChip`, tak jak status pola na każdym innym ekranie.
 *
 * ŚWIADOMIE POMINIĘTE (zero atrap):
 *   - blok „AI Strategic Recommendations" ze starego `SynthesisSummary" —
 *     to był tekst wygenerowany szablonowo z tych samych danych, które już
 *     są pokazane w kartach powyżej (żadna dodatkowa informacja), bez
 *     realnego wywołania AI za nim,
 *   - modal „Deep Dive" po kliknięciu karty scenariusza — pokazuje te same
 *     pola co karta (`focusAreas`, `recommendedFor`, `typicalDuration`); do
 *     decyzji, czy wraca jako rozwijana sekcja w kolejnym kroku.
 */

import {
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  Construction,
  FileText,
  Lightbulb,
  Target,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { recommendScenario, SCENARIOS } from '../../../data/transformationScenarios';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { OrgSectionCard, OrgStatusChip } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';

export type ScenariosBriefSection = 'scenarios' | 'brief';

export const SCENARIOS_BRIEF_SECTIONS: Array<{ id: ScenariosBriefSection; label: string }> = [
  { id: 'scenarios', label: 'Scenariusze transformacji' },
  { id: 'brief', label: 'Executive brief' },
];

const SCENARIO_ICONS: Record<string, LucideIcon> = {
  'digital-foundation': Construction,
  'customer-experience': Target,
  'operational-excellence': Zap,
  'ai-powered': Bot,
  'business-model-innovation': Lightbulb,
  'data-driven': BarChart3,
};

export interface ScenariosBriefRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationScenariosBriefScreen: React.FC<{
  children: (args: ScenariosBriefRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { synthesis, setSynthesis, challenges, goals, companyProfile } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<ScenariosBriefSection>('scenarios');
  const [saved, setSaved] = useState(false);

  const recommended = useMemo(
    () => recommendScenario(challenges.declaredChallenges, companyProfile),
    [challenges.declaredChallenges, companyProfile]
  );
  const selectedScenario = useMemo(
    () => SCENARIOS.find((scenario) => scenario.id === synthesis.selectedScenarioId),
    [synthesis.selectedScenarioId]
  );

  const criticalRisks = useMemo(
    () => synthesis.risks.filter((r) => r.severity === 'Critical' || r.severity === 'High'),
    [synthesis.risks]
  );

  const chips: StandardCounterChip[] = [
    { id: 'scenario', label: 'Scenariusz wybrany', count: selectedScenario ? 1 : 0 },
    { id: 'risks', label: 'Ryzyka krytyczne/wysokie', count: criticalRisks.length },
    { id: 'challenges', label: 'Wyzwania zadeklarowane', count: challenges.declaredChallenges.length },
  ];

  const handleSave = useCallback(() => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }, []);

  const statePanel: OrganizationStatePanelProps = {
    completenessNote: 'Wybór scenariusza zapisywany jest lokalnie na bieżąco — przycisk potwierdza stan.',
    onSave: handleSave,
    saveLabel: saved ? 'Zapisano' : 'Zapisz zmiany',
  };

  const sections: StandardModuleTab[] = SCENARIOS_BRIEF_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
  }));

  const content = (
    <>
      <OrgSectionCard
        id="scenarios"
        title="Scenariusze transformacji"
        lead={`Na podstawie ${challenges.declaredChallenges.length} zadeklarowanych wyzwań rekomendowany kierunek to „${recommended.name}".`}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((scenario) => {
            const Icon = SCENARIO_ICONS[scenario.id] ?? Target;
            const isSelected = scenario.id === synthesis.selectedScenarioId;
            const isRecommended = scenario.id === recommended.id;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => setSynthesis({ ...synthesis, selectedScenarioId: scenario.id })}
                aria-pressed={isSelected}
                className={
                  'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ' +
                  (isSelected
                    ? 'border-c-border-strong bg-state-selected'
                    : 'border-c-border-subtle bg-c-surface-raised hover:border-c-border')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-c-text-muted" />
                  {isRecommended && <OrgStatusChip tone="info">Rekomendowany</OrgStatusChip>}
                </div>
                <p className="text-[13px] font-semibold text-c-text">{scenario.name}</p>
                <p className="text-[12px] text-c-text-secondary">{scenario.description}</p>
                <p className="text-[11px] text-c-text-muted">
                  {scenario.typicalDuration} · złożoność {scenario.complexity}
                </p>
              </button>
            );
          })}
        </div>
      </OrgSectionCard>

      <OrgSectionCard id="brief" title="Executive brief" icon={FileText}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Profil organizacji
            </p>
            <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-c-text">
              <Building2 aria-hidden="true" className="h-4 w-4 text-c-text-muted" />
              {companyProfile.companyName || '—'}
            </p>
            <p className="mt-1 text-[12px] text-c-text-secondary">
              {companyProfile.industry || '—'} · {companyProfile.employees || '—'} osób ·{' '}
              {companyProfile.revenue || '—'} przychodu
            </p>
          </div>
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Dojrzałość
            </p>
            <p className="mt-1 text-[13px] text-c-text">
              Dziś: <span className="font-semibold">{companyProfile.currentMaturityLevel || '—'}</span>
            </p>
            <p className="text-[13px] text-c-text">
              Cel: <span className="font-semibold">{companyProfile.targetMaturityLevel || '—'}</span>
            </p>
          </div>
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Wybrany scenariusz
            </p>
            <p className="mt-1 text-[13px] font-semibold text-c-text">{selectedScenario?.name || '—'}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">Ryzyka</p>
            <p className="mt-1 text-2xl font-semibold text-c-text">{synthesis.risks.length}</p>
            <p className="text-[11px] text-c-text-muted">{criticalRisks.length} krytyczne/wysokie</p>
          </div>
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">Szanse</p>
            <p className="mt-1 text-2xl font-semibold text-c-text">{synthesis.strengths.length}</p>
          </div>
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Wyzwania
            </p>
            <p className="mt-1 text-2xl font-semibold text-c-text">{challenges.declaredChallenges.length}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Cele strategiczne
            </p>
            {goals.strategicGoals.length === 0 ? (
              <p className="text-[13px] text-c-text-muted">—</p>
            ) : (
              <ul className="space-y-1.5">
                {goals.strategicGoals.map((goal) => (
                  <li key={goal.id} className="flex items-start gap-2 text-[13px] text-c-text">
                    <CheckCircle2
                      aria-hidden="true"
                      className={
                        'mt-0.5 h-3.5 w-3.5 shrink-0 ' +
                        (goal.status === 'Achieved' ? 'text-c-success' : 'text-c-border-strong')
                      }
                    />
                    {(goal.goal as string) || (goal.name as string)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
              Mierniki sukcesu
            </p>
            {goals.successMetrics.length === 0 ? (
              <p className="text-[13px] text-c-text-muted">—</p>
            ) : (
              <ul className="space-y-1.5">
                {goals.successMetrics.map((metric) => (
                  <li key={metric.id} className="text-[13px] text-c-text">
                    {(metric.metric as string) || (metric.name as string)}:{' '}
                    <span className="font-semibold">{(metric.target as string) || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </OrgSectionCard>
    </>
  );

  return (
    <>
      {children({
        sections,
        activeSection,
        onSectionChange: (id) => setActiveSection(id as ScenariosBriefSection),
        chips,
        activeChip: '',
        onChipChange: () => {},
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationScenariosBriefScreen;
