/**
 * „Cele i mierniki" — TRZECI realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Celów (mapa konsolidacji
 * §2, pozycje #5 „Intencja strategiczna" + #6 „Mierniki sukcesu"). Dwie sekcje
 * ekranu = dwie pigułki Menu 2: Intencja strategiczna · Mierniki sukcesu (KPI).
 *
 * DANE SĄ REALNE PO OBU STRONACH (FAZA 2, DEC-2026-08-24-15):
 *   - edycja pola → `useContextBuilderStore().goals` (`setGoals`/`updateGoalsList`,
 *     nadal persist → localStorage — teraz to WYŁĄCZNIE bufor roboczy),
 *   - „Zapisz zmiany" → `contextSync.saveNow()` (prop z `OrganizationView`,
 *     hak `useOrgContextSync` — JEDYNY pisarz do `/organization-context-store`,
 *     patrz komentarz w `useOrgContextStoreSection.ts` o wyścigu, który
 *     wykrył live-runtime dowód końcowy tego kroku),
 *   - hydratacja ze servera dzieje się RAZ, globalnie, w `OrganizationView`
 *     (ten sam `useOrgContextSync`) — ekran jej nie duplikuje.
 *
 * Lista KPI używa `OrgRecordList` (nowy prymityw etapu B) zamiast starego
 * `DynamicList` — `DynamicList` miało 8 użyć `primary-*` (crimson, zakazane
 * poza semantyką — CLAUDE.md „Pułapka nr 1"), `OrgRecordList` ma zero.
 *
 * ŚWIADOMIE POMINIĘTE (zero atrap, brak w mapie 11 ekranów):
 *   - baner "AI Suggested Addition" — była to atrapa lokalnego stanu UI, nie
 *     rzeczywista sugestia AI (komentarz w starym pliku: „Mock State").
 */

import { Goal, LineChart } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../lib/utils';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import {
  ORG_L1,
  OrgFieldColumn,
  OrgFieldGrid,
  OrgRecordList,
  OrgSectionCard,
  OrgTextField,
} from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';
import {
  type OrgContextSyncHandle,
  useOrgContextStoreSection,
} from './useOrgContextStoreSection';

export type GoalsMetricsSection = 'intent' | 'metrics';

export const GOALS_METRICS_SECTIONS: Array<{ id: GoalsMetricsSection; labelKey: string; en: string }> = [
  { id: 'intent', labelKey: 'organization.redesign.goalsMetrics.sections.intent', en: 'Strategic intent' },
  { id: 'metrics', labelKey: 'organization.redesign.goalsMetrics.sections.metrics', en: 'Success metrics' },
];

const TOP_PRIORITIES: Array<{ id: string; labelKey: string; en: string }> = [
  { id: 'eff', labelKey: 'organization.redesign.goalsMetrics.priority.eff', en: 'Efficiency / cost reduction' },
  { id: 'growth', labelKey: 'organization.redesign.goalsMetrics.priority.growth', en: 'Growth / higher sales' },
  { id: 'inv', labelKey: 'organization.redesign.goalsMetrics.priority.inv', en: 'Innovation / new products' },
  { id: 'qual', labelKey: 'organization.redesign.goalsMetrics.priority.qual', en: 'Quality / compliance' },
  { id: 'speed', labelKey: 'organization.redesign.goalsMetrics.priority.speed', en: 'Speed / agility' },
  { id: 'cust', labelKey: 'organization.redesign.goalsMetrics.priority.cust', en: 'Customer experience' },
];

/** Horyzont = enum zapisywany w kontekście → słownik kluczy, nie polski literał. */
const TIMEFRAME_KEYS: Array<{ value: string; labelKey: string; en: string }> = [
  { value: '3m', labelKey: 'organization.redesign.goalsMetrics.timeframe.3m', en: '3 months' },
  { value: '6m', labelKey: 'organization.redesign.goalsMetrics.timeframe.6m', en: '6 months' },
  { value: '12m', labelKey: 'organization.redesign.goalsMetrics.timeframe.12m', en: '12 months' },
];

export interface GoalsMetricsRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationGoalsMetricsScreen: React.FC<{
  /** Jedyny pisarz do `/organization-context-store` — patrz `OrganizationView`. */
  contextSync?: OrgContextSyncHandle;
  children: (args: GoalsMetricsRenderArgs) => React.ReactNode;
}> = ({ contextSync, children }) => {
  const { t } = useTranslation();
  const { goals, setGoals, updateGoalsList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<GoalsMetricsSection>('intent');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection(contextSync);

  const kpiHandlers = useMemo(
    () => ({
      onAdd: () =>
        updateGoalsList('kpis', [
          ...goals.kpis,
          { id: Math.random().toString(36).slice(2, 11), name: '', baseline: '', target: '', timeframe: '' },
        ]),
      onUpdate: (id: string, key: string, value: string) =>
        updateGoalsList(
          'kpis',
          goals.kpis.map((item) => (item.id === id ? { ...item, [key]: value } : item))
        ),
      onRemove: (id: string) => updateGoalsList('kpis', goals.kpis.filter((item) => item.id !== id)),
    }),
    [goals.kpis, updateGoalsList]
  );

  const fieldFlags = useMemo(
    () => ({
      primaryObjective: goals.primaryObjective.trim().length > 0,
      secondaryObjectives: goals.secondaryObjectives.trim().length > 0,
      topPriorities: goals.topPriorities.length > 0,
      kpis: goals.kpis.length > 0,
    }),
    [goals]
  );
  const counts = useMemo(() => {
    const values = Object.values(fieldFlags);
    const filled = values.filter(Boolean).length;
    return { all: values.length, filled, missing: values.length - filled };
  }, [fieldFlags]);

  const showField = useCallback(
    (id: keyof typeof fieldFlags) => {
      if (activeChip === 'filled') return fieldFlags[id];
      if (activeChip === 'missing') return !fieldFlags[id];
      return true;
    },
    [activeChip, fieldFlags]
  );

  const sections: StandardModuleTab[] = GOALS_METRICS_SECTIONS.map((section) => ({
    id: section.id,
    label: t(section.labelKey, section.en),
  }));
  const timeframeOptions = TIMEFRAME_KEYS.map((item) => ({
    value: item.value,
    label: t(item.labelKey, item.en),
  }));
  const chips: StandardCounterChip[] = [
    { id: 'all', label: t('organization.redesign.chips.all', 'All'), count: counts.all },
    { id: 'filled', label: t('organization.redesign.chips.filled', 'Filled in'), count: counts.filled },
    { id: 'missing', label: t('organization.redesign.chips.missing', 'To fill in'), count: counts.missing },
  ];

  const handleSave = useCallback(async () => {
    const ok = await contextStore.handleSave();
    if (!ok) return;
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }, [contextStore]);

  const statePanel: OrganizationStatePanelProps = {
    filledFields: counts.filled,
    totalFields: counts.all,
    completenessNote: contextStore.completenessNote,
    onSave: handleSave,
    saving: contextStore.saving,
    saveLabel: saved
      ? t('organization.redesign.panel.saved', 'Saved')
      : t('organization.redesign.panel.save', 'Save changes'),
  };

  const content = (
    <>
      {(showField('primaryObjective') || showField('secondaryObjectives') || showField('topPriorities')) && (
        <OrgSectionCard id="intent" title={t('organization.redesign.goalsMetrics.sections.intent', 'Strategic intent')} icon={Goal}>
          <OrgFieldGrid className="mb-4">
            <OrgFieldColumn>
              {showField('primaryObjective') && (
                <OrgTextField
                  id="goals-primary-objective"
                  label={t('organization.redesign.goalsMetrics.primaryObjective', 'Primary objective')}
                  multiline
                  value={goals.primaryObjective}
                  onChange={(value) => setGoals({ primaryObjective: value })}
                />
              )}
            </OrgFieldColumn>
            <OrgFieldColumn>
              {showField('secondaryObjectives') && (
                <OrgTextField
                  id="goals-secondary-objectives"
                  label={t('organization.redesign.goalsMetrics.secondaryObjectives', 'Secondary objectives')}
                  multiline
                  value={goals.secondaryObjectives}
                  onChange={(value) => setGoals({ secondaryObjectives: value })}
                />
              )}
            </OrgFieldColumn>
          </OrgFieldGrid>
          {showField('topPriorities') && (
            <div>
              <p className={cn(ORG_L1, 'mb-2')}>{t('organization.redesign.goalsMetrics.prioritiesHeading', 'Priorities (max. 3)')}</p>
              <div
                role="group"
                aria-label={t('organization.redesign.goalsMetrics.prioritiesAria', 'Priorities')}
                className="flex flex-wrap gap-2"
              >
                {TOP_PRIORITIES.map((priority) => {
                  const active = goals.topPriorities.includes(priority.id);
                  return (
                    <button
                      key={priority.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setGoals({
                          topPriorities: active
                            ? goals.topPriorities.filter((id) => id !== priority.id)
                            : [...goals.topPriorities, priority.id],
                        })
                      }
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
                        active
                          ? 'border-c-border-strong bg-state-selected font-medium text-c-text'
                          : 'border-c-border-subtle bg-c-surface-raised text-c-text-secondary hover:border-c-border'
                      )}
                    >
                      {t(priority.labelKey, priority.en)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </OrgSectionCard>
      )}

      {showField('kpis') && (
        <OrgSectionCard id="metrics" title={t('organization.redesign.goalsMetrics.metricsTitle', 'Success metrics (KPIs)')} icon={LineChart}>
          <OrgRecordList
            columns={[
              {
                key: 'name',
                label: t('organization.redesign.goalsMetrics.col.name', 'KPI name'),
                placeholder: t('organization.redesign.goalsMetrics.col.namePh', 'e.g. OEE'),
              },
              {
                key: 'baseline',
                label: t('organization.redesign.goalsMetrics.col.baseline', 'Baseline value'),
                placeholder: t('organization.redesign.goalsMetrics.col.baselinePh', 'e.g. 60%'),
              },
              {
                key: 'target',
                label: t('organization.redesign.goalsMetrics.col.target', 'Target'),
                placeholder: t('organization.redesign.goalsMetrics.col.targetPh', 'e.g. 85%'),
              },
              {
                key: 'timeframe',
                label: t('organization.redesign.goalsMetrics.col.timeframe', 'Horizon'),
                type: 'select',
                options: timeframeOptions,
              },
            ]}
            items={goals.kpis as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={kpiHandlers.onAdd}
            onUpdate={kpiHandlers.onUpdate}
            onRemove={kpiHandlers.onRemove}
            addLabel={t('organization.redesign.goalsMetrics.addMetric', 'Add metric')}
          />
        </OrgSectionCard>
      )}
    </>
  );

  return (
    <>
      {children({
        sections,
        activeSection,
        onSectionChange: (id) => setActiveSection(id as GoalsMetricsSection),
        chips,
        activeChip,
        onChipChange: setActiveChip,
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationGoalsMetricsScreen;
