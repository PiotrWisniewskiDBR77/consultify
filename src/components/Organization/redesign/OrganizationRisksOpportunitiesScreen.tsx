/**
 * „Ryzyka i szanse" — SIÓDMY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Syntezy (mapa konsolidacji
 * §2, pozycje #13 „Ryzyka i szanse" + #15 „Rekomendacja"). Dwie sekcje ekranu
 * = dwie pigułki Menu 2: Ryzyka · Szanse (mocne strony) — bliźniacze tabele
 * o tej samej strukturze, dokładnie jak w uzasadnieniu §3 dokumentu
 * konsolidacji.
 *
 * DANE SĄ REALNE — ten sam magazyn co stary `StrategicSynthesisModule`:
 *   `useContextBuilderStore().synthesis` (`risks`/`strengths`).
 *
 * ŚWIADOMIE POMINIĘTE (zero atrap):
 *   - modal ze szczegółami ryzyka/szansy po kliknięciu wiersza — pokazywał
 *     TE SAME pola (risk/why/severity/mitigation), więc jego usunięcie nie
 *     traci danych; edycja inline w `OrgRecordList` daje dostęp do tych
 *     samych pól bez dodatkowego kroku,
 *   - plakietka „AI Suggested" (`isAiSuggested`) — dziś nic w kodzie jej nie
 *     ustawia (brak realnego generatora AI podłączonego do tego ekranu),
 *     więc pole zawsze było puste; pominięta jako martwy stan.
 */

import { AlertTriangle, TrendingUp } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { OrgRecordList, OrgSectionCard } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';

export type RisksOpportunitiesSection = 'risks' | 'strengths';

export const RISKS_OPPORTUNITIES_SECTIONS: Array<{ id: RisksOpportunitiesSection; label: string }> = [
  { id: 'risks', label: 'Ryzyka' },
  { id: 'strengths', label: 'Szanse' },
];

const SEVERITY_OPTIONS = [
  { value: 'Critical', label: 'Krytyczna' },
  { value: 'High', label: 'Wysoka' },
  { value: 'Medium', label: 'Średnia' },
  { value: 'Low', label: 'Niska' },
];

export interface RisksOpportunitiesRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationRisksOpportunitiesScreen: React.FC<{
  children: (args: RisksOpportunitiesRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { synthesis, updateSynthesisList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<RisksOpportunitiesSection>('risks');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);

  const riskHandlers = useMemo(
    () => ({
      onAdd: () =>
        updateSynthesisList('risks', [
          ...synthesis.risks,
          { id: Math.random().toString(36).slice(2, 11), risk: '', why: '', severity: '', mitigation: '' },
        ]),
      onUpdate: (id: string, key: string, value: string) =>
        updateSynthesisList(
          'risks',
          synthesis.risks.map((item) => (item.id === id ? { ...item, [key]: value } : item))
        ),
      onRemove: (id: string) => updateSynthesisList('risks', synthesis.risks.filter((item) => item.id !== id)),
    }),
    [synthesis.risks, updateSynthesisList]
  );

  const strengthHandlers = useMemo(
    () => ({
      onAdd: () =>
        updateSynthesisList('strengths', [
          ...synthesis.strengths,
          { id: Math.random().toString(36).slice(2, 11), enabler: '', seen: '', leverage: '' },
        ]),
      onUpdate: (id: string, key: string, value: string) =>
        updateSynthesisList(
          'strengths',
          synthesis.strengths.map((item) => (item.id === id ? { ...item, [key]: value } : item))
        ),
      onRemove: (id: string) =>
        updateSynthesisList('strengths', synthesis.strengths.filter((item) => item.id !== id)),
    }),
    [synthesis.strengths, updateSynthesisList]
  );

  const fieldFlags = useMemo(
    () => ({
      risks: synthesis.risks.length > 0,
      strengths: synthesis.strengths.length > 0,
    }),
    [synthesis]
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

  const sections: StandardModuleTab[] = RISKS_OPPORTUNITIES_SECTIONS.map((section) => ({
    id: section.id,
    label: section.label,
  }));
  const chips: StandardCounterChip[] = [
    { id: 'all', label: 'Wszystkie', count: counts.all },
    { id: 'filled', label: 'Uzupełnione', count: counts.filled },
    { id: 'missing', label: 'Do uzupełnienia', count: counts.missing },
  ];

  const handleSave = useCallback(() => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }, []);

  const statePanel: OrganizationStatePanelProps = {
    filledFields: counts.filled,
    totalFields: counts.all,
    completenessNote: 'Dane zapisywane są lokalnie na bieżąco — przycisk potwierdza stan.',
    onSave: handleSave,
    saveLabel: saved ? 'Zapisano' : 'Zapisz zmiany',
  };

  const content = (
    <>
      {showField('risks') && (
        <OrgSectionCard
          id="risks"
          title="Ryzyka"
          icon={AlertTriangle}
          lead="Co mogłoby wykoleić tę transformację?"
        >
          <OrgRecordList
            columns={[
              { key: 'risk', label: 'Ryzyko / zagrożenie', placeholder: 'np. Opór kadry średniej' },
              { key: 'why', label: 'Dlaczego (przyczyna)', placeholder: 'np. Obawa o redukcję etatów' },
              { key: 'severity', label: 'Waga', type: 'select', options: SEVERITY_OPTIONS },
              { key: 'mitigation', label: 'Strategia mitygacji', placeholder: 'np. Program zarządzania zmianą' },
            ]}
            items={synthesis.risks as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={riskHandlers.onAdd}
            onUpdate={riskHandlers.onUpdate}
            onRemove={riskHandlers.onRemove}
            addLabel="Dodaj ryzyko"
          />
        </OrgSectionCard>
      )}

      {showField('strengths') && (
        <OrgSectionCard
          id="strengths"
          title="Szanse"
          icon={TrendingUp}
          lead="Jakie mocne strony można wykorzystać?"
        >
          <OrgRecordList
            columns={[
              { key: 'enabler', label: 'Mocna strona / szansa', placeholder: 'np. Silny zespół inżynierski' },
              { key: 'seen', label: 'Dowód / gdzie widoczne', placeholder: 'np. Wyniki R&D' },
              { key: 'leverage', label: 'Jak wykorzystać', placeholder: 'np. Jako pilotażowych liderów' },
            ]}
            items={synthesis.strengths as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={strengthHandlers.onAdd}
            onUpdate={strengthHandlers.onUpdate}
            onRemove={strengthHandlers.onRemove}
            addLabel="Dodaj szansę"
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
        onSectionChange: (id) => setActiveSection(id as RisksOpportunitiesSection),
        chips,
        activeChip,
        onChipChange: setActiveChip,
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationRisksOpportunitiesScreen;
