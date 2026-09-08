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
import { useTranslation } from 'react-i18next';

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

export const SCOPE_COLLABORATION_SECTIONS: Array<{
  id: ScopeCollaborationSection;
  labelKey: string;
  en: string;
}> = [
  { id: 'scope', labelKey: 'organization.redesign.scope.sections.scope', en: 'Scope' },
  { id: 'collaboration', labelKey: 'organization.redesign.scope.sections.collaboration', en: 'Ways of working' },
];

/** Wszystkie trzy listy to ENUMY kontekstu → słowniki kluczy (PLAN §2 pkt 6). */
const ARCHETYPE_KEYS = [
  { value: 'fast', labelKey: 'organization.redesign.scope.archetype.fast', en: 'Pilot and scale (agile)' },
  { value: 'deep', labelKey: 'organization.redesign.scope.archetype.deep', en: 'Core transformation (waterfall)' },
  { value: 'targeted', labelKey: 'organization.redesign.scope.archetype.targeted', en: 'By value / use case' },
];
const AI_ROLE_KEYS = [
  { value: 'advisor', labelKey: 'organization.redesign.scope.aiRole.advisor', en: 'Strategic advisor' },
  { value: 'partner', labelKey: 'organization.redesign.scope.aiRole.partner', en: 'Co-pilot' },
  { value: 'agent', labelKey: 'organization.redesign.scope.aiRole.agent', en: 'Autonomous agent' },
];
const CADENCE_KEYS = [
  { value: 'weekly', labelKey: 'organization.redesign.scope.cadence.weekly', en: 'Weekly SteerCo' },
  { value: 'monthly', labelKey: 'organization.redesign.scope.cadence.monthly', en: 'Monthly review' },
  { value: 'daily', labelKey: 'organization.redesign.scope.cadence.daily', en: 'Daily stand-up' },
  { value: 'milestone', labelKey: 'organization.redesign.scope.cadence.milestone', en: 'At milestones' },
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
  const { t } = useTranslation();
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
    label: t(section.labelKey, section.en),
  }));
  const przetlumacz = (lista: Array<{ value: string; labelKey: string; en: string }>) =>
    lista.map((item) => ({ value: item.value, label: t(item.labelKey, item.en) }));
  const archetypeOptions = przetlumacz(ARCHETYPE_KEYS);
  const aiRoleOptions = przetlumacz(AI_ROLE_KEYS);
  const cadenceOptions = przetlumacz(CADENCE_KEYS);
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
      {(showField('inScope') || showField('outScope')) && (
        <OrgSectionCard id="scope" title={t('organization.redesign.scope.sections.scope', 'Scope')} icon={Scale}>
          <OrgFieldGrid>
            <OrgFieldColumn>
              {showField('inScope') && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                    {t('organization.redesign.scope.inScope', 'In scope')}
                  </p>
                  <OrgRecordList
                    columns={[
                      {
                        key: 'item',
                        label: t('organization.redesign.scope.col.area', 'Area'),
                        placeholder: t('organization.redesign.scope.col.areaInPh', 'e.g. Plant A'),
                      },
                      {
                        key: 'notes',
                        label: t('organization.redesign.scope.col.notes', 'Note'),
                        placeholder: t('organization.redesign.scope.col.notesPh', 'e.g. Full audit'),
                      },
                    ]}
                    items={goals.inScope as unknown as Array<Record<string, string> & { id: string }>}
                    onAdd={inScopeHandlers.onAdd}
                    onUpdate={inScopeHandlers.onUpdate}
                    onRemove={inScopeHandlers.onRemove}
                    addLabel={t('organization.redesign.scope.addArea', 'Add area')}
                  />
                </>
              )}
            </OrgFieldColumn>
            <OrgFieldColumn>
              {showField('outScope') && (
                <>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                    {t('organization.redesign.scope.outScope', 'Out of scope')}
                  </p>
                  <OrgRecordList
                    columns={[
                      {
                        key: 'item',
                        label: t('organization.redesign.scope.col.area', 'Area'),
                        placeholder: t('organization.redesign.scope.col.areaOutPh', 'e.g. Logistics'),
                      },
                      {
                        key: 'notes',
                        label: t('organization.redesign.scope.col.reason', 'Reason'),
                        placeholder: t('organization.redesign.scope.col.reasonPh', 'e.g. Already optimised'),
                      },
                    ]}
                    items={goals.outScope as unknown as Array<Record<string, string> & { id: string }>}
                    onAdd={outScopeHandlers.onAdd}
                    onUpdate={outScopeHandlers.onUpdate}
                    onRemove={outScopeHandlers.onRemove}
                    addLabel={t('organization.redesign.scope.addExclusion', 'Add exclusion')}
                  />
                </>
              )}
            </OrgFieldColumn>
          </OrgFieldGrid>
        </OrgSectionCard>
      )}

      {(showField('transformationArchetype') || showField('aiRole') || showField('steeringCadence')) && (
        <OrgSectionCard
          id="collaboration"
          title={t('organization.redesign.scope.sections.collaboration', 'Ways of working')}
          icon={Handshake}
        >
          <div className="space-y-4">
            {showField('transformationArchetype') && (
              <OrgChoiceSegment
                label={t('organization.redesign.scope.archetypeLabel', 'Transformation archetype')}
                value={goals.transformationArchetype}
                options={archetypeOptions}
                onChange={(value) => setGoals({ transformationArchetype: value })}
              />
            )}
            {showField('aiRole') && (
              <OrgChoiceSegment
                label={t('organization.redesign.scope.aiRoleLabel', 'Role of AI')}
                value={goals.aiRole}
                options={aiRoleOptions}
                onChange={(value) => setGoals({ aiRole: value })}
              />
            )}
            {showField('steeringCadence') && (
              <OrgChoiceSegment
                label={t('organization.redesign.scope.cadenceLabel', 'Steering cadence')}
                value={goals.steeringCadence}
                options={cadenceOptions}
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
