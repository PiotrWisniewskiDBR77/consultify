/**
 * „Przyczyny i blockery" — SZÓSTY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Wyzwań (mapa konsolidacji
 * §2, pozycje #10 „Przyczyny źródłowe" + #11 „Blockery celów"). Dwie sekcje
 * ekranu = dwie pigułki Menu 2: Przyczyny źródłowe · Blockery.
 *
 * DANE SĄ REALNE — ten sam magazyn co stary `ChallengeMapModule`:
 *   `useContextBuilderStore().challenges` (`rootCauseAnswers`/`activeBlockers`).
 *   Cztery pytania diagnostyczne to ten sam tekst co w starym ekranie
 *   (`ROOT_CAUSE_QUESTIONS`) — realne pytania, nie atrapa.
 *
 * ŚWIADOMIE UPROSZCZONE względem starego `ChallengeMapModule`:
 *   - galeria „Suggested Obstacles" (biblioteka 4 gotowych blockerów do
 *     jednego kliknięcia) — funkcjonalnie realna, ale to skrót UX, nie dana;
 *     tu blockery dodaje się bezpośrednio przez `OrgRecordList` (spójne z
 *     resztą ekranów etapu B). Do decyzji, czy galeria wraca jako osobna karta.
 *   - flaga `status: 'detected'` (AI) na blockerze nie jest dziś nigdzie
 *     ustawiana przez realny kod (zawsze `'confirmed'`/`'manual'` z UI) —
 *     pominięta jako martwy stan, nie usunięta dana.
 */

import { Activity, Lock } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { OrgRecordList, OrgSectionCard, OrgTextField } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';

export type RootCausesBlockersSection = 'rootcause' | 'blockers';

export const ROOT_CAUSES_BLOCKERS_SECTIONS: Array<{ id: RootCausesBlockersSection; label: string }> = [
  { id: 'rootcause', label: 'Przyczyny źródłowe' },
  { id: 'blockers', label: 'Blockery' },
];

const ROOT_CAUSE_QUESTIONS = [
  { q: 'Gdzie utykają decyzje?', h: 'np. Obawa kadry średniego szczebla, brak danych…' },
  { q: 'Gdzie jest najsilniejszy opór wobec zmian?', h: 'np. Hala produkcyjna, konkretny dział…' },
  { q: 'Jakie inicjatywy zawiodły w przeszłości i dlaczego?', h: 'np. Wdrożenie Lean bez kontynuacji…' },
  {
    q: 'Czy jest rozbieżność między widokiem zarządu a rzeczywistością?',
    h: 'np. CEO myśli, że ERP działa, użytkownicy używają Excela…',
  },
];

const BLOCKER_TYPE_OPTIONS = [
  { value: 'Culture', label: 'Kultura' },
  { value: 'Process', label: 'Proces' },
  { value: 'Technology', label: 'Technologia' },
  { value: 'Strategy', label: 'Strategia' },
  { value: 'People', label: 'Ludzie' },
];

export interface RootCausesBlockersRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationRootCausesBlockersScreen: React.FC<{
  children: (args: RootCausesBlockersRenderArgs) => React.ReactNode;
}> = ({ children }) => {
  const { challenges, setChallenges } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<RootCausesBlockersSection>('rootcause');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);

  const blockerHandlers = useMemo(
    () => ({
      onAdd: () =>
        setChallenges({
          activeBlockers: [
            ...challenges.activeBlockers,
            {
              id: Math.random().toString(36).slice(2, 11),
              type: 'Process',
              title: '',
              desc: '',
              status: 'confirmed' as const,
              confidence: 'Manual',
            },
          ],
        }),
      onUpdate: (id: string, key: string, value: string) =>
        setChallenges({
          activeBlockers: challenges.activeBlockers.map((blocker) =>
            blocker.id === id ? { ...blocker, [key]: value } : blocker
          ),
        }),
      onRemove: (id: string) =>
        setChallenges({ activeBlockers: challenges.activeBlockers.filter((blocker) => blocker.id !== id) }),
    }),
    [challenges.activeBlockers, setChallenges]
  );

  const answeredCount = useMemo(
    () => ROOT_CAUSE_QUESTIONS.filter((_, index) => (challenges.rootCauseAnswers[index] || '').trim().length > 0)
      .length,
    [challenges.rootCauseAnswers]
  );

  const fieldFlags = useMemo(
    () => ({
      rootCauseAnswers: answeredCount > 0,
      activeBlockers: challenges.activeBlockers.length > 0,
    }),
    [answeredCount, challenges.activeBlockers.length]
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

  const sections: StandardModuleTab[] = ROOT_CAUSES_BLOCKERS_SECTIONS.map((section) => ({
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
      {showField('rootCauseAnswers') && (
        <OrgSectionCard
          id="rootcause"
          title="Przyczyny źródłowe"
          icon={Activity}
          lead="Odpowiedzi pomagają zidentyfikować ukryte przyczyny za zadeklarowanymi wyzwaniami."
        >
          <div className="space-y-4">
            {ROOT_CAUSE_QUESTIONS.map((item, index) => (
              <OrgTextField
                key={index}
                id={`root-cause-${index}`}
                label={item.q}
                multiline
                value={challenges.rootCauseAnswers[index] || ''}
                placeholder={item.h}
                onChange={(value) =>
                  setChallenges({
                    rootCauseAnswers: { ...challenges.rootCauseAnswers, [index]: value },
                  })
                }
              />
            ))}
          </div>
        </OrgSectionCard>
      )}

      {showField('activeBlockers') && (
        <OrgSectionCard id="blockers" title="Blockery" icon={Lock}>
          <OrgRecordList
            columns={[
              { key: 'title', label: 'Nazwa blockera', placeholder: 'np. Lęk przed porażką' },
              { key: 'type', label: 'Typ', type: 'select', options: BLOCKER_TYPE_OPTIONS },
              { key: 'desc', label: 'Opis i wpływ', type: 'textarea', placeholder: 'Opisz przeszkodę i jej wpływ…' },
            ]}
            items={challenges.activeBlockers as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={blockerHandlers.onAdd}
            onUpdate={blockerHandlers.onUpdate}
            onRemove={blockerHandlers.onRemove}
            addLabel="Dodaj blocker"
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
        onSectionChange: (id) => setActiveSection(id as RootCausesBlockersSection),
        chips,
        activeChip,
        onChipChange: setActiveChip,
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationRootCausesBlockersScreen;
