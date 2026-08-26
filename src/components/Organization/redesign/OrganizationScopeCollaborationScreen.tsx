/**
 * „Zakres i tryb współpracy" — CZWARTY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Celów (mapa konsolidacji
 * §2, pozycje #7 „Zakres i granice" + #8 „Oczekiwania interesariuszy"). Dwie
 * sekcje ekranu = dwie pigułki Menu 2: Zakres · Tryb współpracy.
 *
 * DANE SĄ REALNE PO OBU STRONACH (FAZA 2, DEC-2026-08-24-15) — ten sam
 * magazyn co stary `GoalsExpectationsModule`:
 *   `useContextBuilderStore().goals` (`inScope`/`outScope`/`transformationArchetype`
 *   /`aiRole`/`steeringCadence`) jako bufor roboczy edycji + „Zapisz zmiany"
 *   → `contextSync.saveNow()` (prop z `OrganizationView`, JEDYNY pisarz do
 *   `/organization-context-store` — patrz `useOrgContextStoreSection.ts`),
 *   dokładnie jak w „Cele i mierniki" (współdzielą klucz `goals` w jednym
 *   wierszu, ale zapis idzie przez WSPÓLNY hak, nie dwa niezależne).
 *
 * ŚWIADOMIE POMINIĘTE (poza mapą 11 ekranów — patrz `org-konsolidacja-propozycja.md`):
 *   - zakładka „No-Go Zone" (`goals.noGo`) — nie ma dziś trasy w `ORGANIZATION_MODULES`
 *     (21 ekranów), więc nie była dostępna z nawigacji przed redesignem; nie jest
 *     to regresja tego kroku. Do decyzji, czy dodać jako trzecią sekcję.
 */

import { Handshake, Scale } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import {
  OrgChoiceSegment,
  OrgFieldColumn,
  OrgFieldGrid,
  OrgRecordList,
  OrgSectionCard,
} from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';
import {
  type OrgContextSyncHandle,
  useOrgContextStoreSection,
} from './useOrgContextStoreSection';

export type ScopeCollaborationSection = 'scope' | 'collaboration';

export const SCOPE_COLLABORATION_SECTIONS: Array<{ id: ScopeCollaborationSection; label: string }> = [
  { id: 'scope', label: 'Zakres' },
  { id: 'collaboration', label: 'Tryb współpracy' },
];

const ARCHETYPE_OPTIONS = [
  { value: 'fast', label: 'Pilotaż i skalowanie (zwinnie)' },
  { value: 'deep', label: 'Transformacja rdzenia (kaskadowo)' },
  { value: 'targeted', label: 'Wg wartości / przypadków użycia' },
];
const AI_ROLE_OPTIONS = [
  { value: 'advisor', label: 'Doradca strategiczny' },
  { value: 'partner', label: 'Współpilot' },
  { value: 'agent', label: 'Autonomiczny agent' },
];
const CADENCE_OPTIONS = [
  { value: 'weekly', label: 'Cotygodniowy SteerCo' },
  { value: 'monthly', label: 'Miesięczny przegląd' },
  { value: 'daily', label: 'Codzienny standup' },
  { value: 'milestone', label: 'Wg kamieni milowych' },
];

export interface ScopeCollaborationRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationScopeCollaborationScreen: React.FC<{
  /** Jedyny pisarz do `/organization-context-store` — patrz `OrganizationView`. */
  contextSync?: OrgContextSyncHandle;
  children: (args: ScopeCollaborationRenderArgs) => React.ReactNode;
}> = ({ contextSync, children }) => {
  const { goals, setGoals, updateGoalsList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<ScopeCollaborationSection>('scope');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection(contextSync);

  const listHandlers = (listName: 'inScope' | 'outScope', items: typeof goals.inScope) => ({
    onAdd: () =>
      updateGoalsList(listName, [
        ...items,
        { id: Math.random().toString(36).slice(2, 11), item: '', notes: '' },
      ]),
    onUpdate: (id: string, key: string, value: string) =>
      updateGoalsList(
        listName,
        items.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry))
      ),
    onRemove: (id: string) => updateGoalsList(listName, items.filter((entry) => entry.id !== id)),
  });
  const inScopeHandlers = listHandlers('inScope', goals.inScope);
  const outScopeHandlers = listHandlers('outScope', goals.outScope);

  const fieldFlags = useMemo(
    () => ({
      inScope: goals.inScope.length > 0,
      outScope: goals.outScope.length > 0,
      transformationArchetype: goals.transformationArchetype.trim().length > 0,
      aiRole: goals.aiRole.trim().length > 0,
      steeringCadence: goals.steeringCadence.trim().length > 0,
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

  const sections: StandardModuleTab[] = SCOPE_COLLABORATION_SECTIONS.map((section) => ({
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
      {(showField('inScope') || showField('outScope')) && (
        <OrgSectionCard id="scope" title="Zakres" icon={Scale}>
          <OrgFieldGrid>
            <OrgFieldColumn>
              {showField('inScope') && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                    W zakresie
                  </p>
                  <OrgRecordList
                    columns={[
                      { key: 'item', label: 'Obszar', placeholder: 'np. Zakład A' },
                      { key: 'notes', label: 'Notatka', placeholder: 'np. Pełny audyt' },
                    ]}
                    items={goals.inScope as unknown as Array<Record<string, string> & { id: string }>}
                    onAdd={inScopeHandlers.onAdd}
                    onUpdate={inScopeHandlers.onUpdate}
                    onRemove={inScopeHandlers.onRemove}
                    addLabel="Dodaj obszar"
                  />
                </>
              )}
            </OrgFieldColumn>
            <OrgFieldColumn>
              {showField('outScope') && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                    Poza zakresem
                  </p>
                  <OrgRecordList
                    columns={[
                      { key: 'item', label: 'Obszar', placeholder: 'np. Logistyka' },
                      { key: 'notes', label: 'Powód', placeholder: 'np. Już zoptymalizowane' },
                    ]}
                    items={goals.outScope as unknown as Array<Record<string, string> & { id: string }>}
                    onAdd={outScopeHandlers.onAdd}
                    onUpdate={outScopeHandlers.onUpdate}
                    onRemove={outScopeHandlers.onRemove}
                    addLabel="Dodaj wyłączenie"
                  />
                </>
              )}
            </OrgFieldColumn>
          </OrgFieldGrid>
        </OrgSectionCard>
      )}

      {(showField('transformationArchetype') || showField('aiRole') || showField('steeringCadence')) && (
        <OrgSectionCard id="collaboration" title="Tryb współpracy" icon={Handshake}>
          <div className="space-y-4">
            {showField('transformationArchetype') && (
              <OrgChoiceSegment
                label="Archetyp transformacji"
                value={goals.transformationArchetype}
                options={ARCHETYPE_OPTIONS}
                onChange={(value) => setGoals({ transformationArchetype: value })}
              />
            )}
            {showField('aiRole') && (
              <OrgChoiceSegment
                label="Rola AI"
                value={goals.aiRole}
                options={AI_ROLE_OPTIONS}
                onChange={(value) => setGoals({ aiRole: value })}
              />
            )}
            {showField('steeringCadence') && (
              <OrgChoiceSegment
                label="Rytm nadzoru"
                value={goals.steeringCadence}
                options={CADENCE_OPTIONS}
                onChange={(value) => setGoals({ steeringCadence: value })}
              />
            )}
          </div>
        </OrgSectionCard>
      )}
    </>
  );

  return (
    <>
      {children({
        sections,
        activeSection,
        onSectionChange: (id) => setActiveSection(id as ScopeCollaborationSection),
        chips,
        activeChip,
        onChipChange: setActiveChip,
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationScopeCollaborationScreen;
