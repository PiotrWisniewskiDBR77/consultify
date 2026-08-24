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
 *   - „Zapisz zmiany" → `PUT /organization-context-store` (`{ goals }`) +
 *     READBACK (`useOrgContextStoreSection`, wzorzec 1:1 z zapisem profilu
 *     w „Tożsamość i model działania" — `PUT /organization-profiles/:orgId`),
 *   - przy montowaniu ekran POBIERA `GET /organization-context-store` i
 *     hydratuje lokalny store danymi z serwera (jeśli tam są) — server jest
 *     źródłem prawdy, local-storage tylko przyspiesza wpisywanie.
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
import { useOrgContextStoreSection } from './useOrgContextStoreSection';

export type GoalsMetricsSection = 'intent' | 'metrics';

export const GOALS_METRICS_SECTIONS: Array<{ id: GoalsMetricsSection; label: string }> = [
  { id: 'intent', label: 'Intencja strategiczna' },
  { id: 'metrics', label: 'Mierniki sukcesu' },
];

const TOP_PRIORITIES: Array<{ id: string; label: string }> = [
  { id: 'eff', label: 'Efektywność / redukcja kosztów' },
  { id: 'growth', label: 'Wzrost / zwiększenie sprzedaży' },
  { id: 'inv', label: 'Innowacje / nowe produkty' },
  { id: 'qual', label: 'Jakość / zgodność' },
  { id: 'speed', label: 'Szybkość / zwinność' },
  { id: 'cust', label: 'Doświadczenie klienta' },
];

const TIMEFRAME_OPTIONS = [
  { value: '3m', label: '3 miesiące' },
  { value: '6m', label: '6 miesięcy' },
  { value: '12m', label: '12 miesięcy' },
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
  children: (args: GoalsMetricsRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { goals, setGoals, updateGoalsList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<GoalsMetricsSection>('intent');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection('goals', goals, setGoals);

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
    label: section.label,
  }));
  const chips: StandardCounterChip[] = [
    { id: 'all', label: 'Wszystkie', count: counts.all },
    { id: 'filled', label: 'Uzupełnione', count: counts.filled },
    { id: 'missing', label: 'Do uzupełnienia', count: counts.missing },
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
    saveLabel: saved ? 'Zapisano' : 'Zapisz zmiany',
  };

  const content = (
    <>
      {(showField('primaryObjective') || showField('secondaryObjectives') || showField('topPriorities')) && (
        <OrgSectionCard id="intent" title="Intencja strategiczna" icon={Goal}>
          <OrgFieldGrid className="mb-4">
            <OrgFieldColumn>
              {showField('primaryObjective') && (
                <OrgTextField
                  id="goals-primary-objective"
                  label="Cel nadrzędny"
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
                  label="Cele drugorzędne"
                  multiline
                  value={goals.secondaryObjectives}
                  onChange={(value) => setGoals({ secondaryObjectives: value })}
                />
              )}
            </OrgFieldColumn>
          </OrgFieldGrid>
          {showField('topPriorities') && (
            <div>
              <p className={cn(ORG_L1, 'mb-2')}>Priorytety (maks. 3)</p>
              <div role="group" aria-label="Priorytety" className="flex flex-wrap gap-2">
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
                      {priority.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </OrgSectionCard>
      )}

      {showField('kpis') && (
        <OrgSectionCard id="metrics" title="Mierniki sukcesu (KPI)" icon={LineChart}>
          <OrgRecordList
            columns={[
              { key: 'name', label: 'Nazwa KPI', placeholder: 'np. OEE' },
              { key: 'baseline', label: 'Wartość bazowa', placeholder: 'np. 60%' },
              { key: 'target', label: 'Cel', placeholder: 'np. 85%' },
              { key: 'timeframe', label: 'Horyzont', type: 'select', options: TIMEFRAME_OPTIONS },
            ]}
            items={goals.kpis as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={kpiHandlers.onAdd}
            onUpdate={kpiHandlers.onUpdate}
            onRemove={kpiHandlers.onRemove}
            addLabel="Dodaj miernik"
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
