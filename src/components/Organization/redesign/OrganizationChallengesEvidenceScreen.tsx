/**
 * „Wyzwania i dowody" — PIĄTY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Wyzwań (mapa konsolidacji
 * §2, pozycje #9 „Zadeklarowane wyzwania" + #12 „Dowody"). Dwie sekcje ekranu
 * = dwie pigułki Menu 2: Zadeklarowane wyzwania · Dowody.
 *
 * DANE SĄ REALNE PO OBU STRONACH (FAZA 2, DEC-2026-08-24-15) — ten sam
 * magazyn co stary `ChallengeMapModule`:
 *   `useContextBuilderStore().challenges` (`declaredChallenges`/`evidence`)
 *   jako bufor roboczy edycji + „Zapisz zmiany" → `contextSync.saveNow()`
 *   (prop z `OrganizationView`, JEDYNY pisarz do `/organization-context-store`
 *   — patrz `useOrgContextStoreSection.ts`), dzieli klucz `challenges` z
 *   ekranem „Przyczyny i blockery" przez ten sam współdzielony hak.
 *
 * `ContextDocUploader` (wspólny komponent `views/ContextBuilder/shared/`)
 * wraca w sekcji „Dowody" — DEC-2026-08-24-15 warunek (b). Komponent NIE był
 * modyfikowany (współdzielony z innymi miejscami wywołania); jego wewnętrzne
 * `primary-*` to zastany dług wspólnego pliku, nie nowe naruszenie kanonu tego
 * ekranu — otoczony `OrgSectionCard`, więc rama sekcji zostaje kanoniczna.
 */

import { FileSearch, ShieldAlert } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { ContextDocUploader } from '../../../views/ContextBuilder/shared/ContextDocUploader';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { OrgRecordList, OrgSectionCard } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';
import {
  type OrgContextSyncHandle,
  useOrgContextStoreSection,
} from './useOrgContextStoreSection';

export type ChallengesEvidenceSection = 'challenges' | 'evidence';

export const CHALLENGES_EVIDENCE_SECTIONS: Array<{ id: ChallengesEvidenceSection; label: string }> = [
  { id: 'challenges', label: 'Zadeklarowane wyzwania' },
  { id: 'evidence', label: 'Dowody' },
];

const SEVERITY_OPTIONS = [
  { value: 'Critical', label: 'Krytyczna' },
  { value: 'High', label: 'Wysoka' },
  { value: 'Medium', label: 'Średnia' },
  { value: 'Low', label: 'Niska' },
];

export interface ChallengesEvidenceRenderArgs {
  sections: StandardModuleTab[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  chips: StandardCounterChip[];
  activeChip: string;
  onChipChange: (id: string) => void;
  statePanel: OrganizationStatePanelProps;
  content: React.ReactNode;
}

export const OrganizationChallengesEvidenceScreen: React.FC<{
  /** Jedyny pisarz do `/organization-context-store` — patrz `OrganizationView`. */
  contextSync?: OrgContextSyncHandle;
  children: (args: ChallengesEvidenceRenderArgs) => React.ReactNode;
}> = ({ contextSync, children }) => {
  const { challenges, updateChallengesList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<ChallengesEvidenceSection>('challenges');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection(contextSync);

  const challengeHandlers = useMemo(
    () => ({
      onAdd: () =>
        updateChallengesList('declaredChallenges', [
          ...challenges.declaredChallenges,
          { id: Math.random().toString(36).slice(2, 11), challenge: '', area: '', severity: '', notes: '' },
        ]),
      onUpdate: (id: string, key: string, value: string) =>
        updateChallengesList(
          'declaredChallenges',
          challenges.declaredChallenges.map((item) => (item.id === id ? { ...item, [key]: value } : item))
        ),
      onRemove: (id: string) =>
        updateChallengesList(
          'declaredChallenges',
          challenges.declaredChallenges.filter((item) => item.id !== id)
        ),
    }),
    [challenges.declaredChallenges, updateChallengesList]
  );

  const evidenceHandlers = useMemo(
    () => ({
      onAdd: () =>
        updateChallengesList('evidence', [
          ...challenges.evidence,
          { id: Math.random().toString(36).slice(2, 11), metric: '', symptom: '', source: '', link: '' },
        ]),
      onUpdate: (id: string, key: string, value: string) =>
        updateChallengesList(
          'evidence',
          challenges.evidence.map((item) => (item.id === id ? { ...item, [key]: value } : item))
        ),
      onRemove: (id: string) =>
        updateChallengesList('evidence', challenges.evidence.filter((item) => item.id !== id)),
    }),
    [challenges.evidence, updateChallengesList]
  );

  const fieldFlags = useMemo(
    () => ({
      declaredChallenges: challenges.declaredChallenges.length > 0,
      evidence: challenges.evidence.length > 0,
    }),
    [challenges]
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

  const sections: StandardModuleTab[] = CHALLENGES_EVIDENCE_SECTIONS.map((section) => ({
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
      {showField('declaredChallenges') && (
        <OrgSectionCard
          id="challenges"
          title="Zadeklarowane wyzwania"
          icon={ShieldAlert}
          lead="Oficjalne problemy zgłoszone przez klienta (symptomy)."
        >
          <OrgRecordList
            columns={[
              { key: 'challenge', label: 'Wyzwanie / objaw', placeholder: 'np. Wysoki wskaźnik braków' },
              { key: 'area', label: 'Obszar', placeholder: 'np. Jakość' },
              { key: 'severity', label: 'Waga', type: 'select', options: SEVERITY_OPTIONS },
              { key: 'notes', label: 'Notatka', placeholder: 'Dodatkowy kontekst…' },
            ]}
            items={
              challenges.declaredChallenges as unknown as Array<Record<string, string> & { id: string }>
            }
            onAdd={challengeHandlers.onAdd}
            onUpdate={challengeHandlers.onUpdate}
            onRemove={challengeHandlers.onRemove}
            addLabel="Dodaj wyzwanie"
          />
        </OrgSectionCard>
      )}

      {showField('evidence') && (
        <OrgSectionCard
          id="evidence"
          title="Dowody"
          icon={FileSearch}
          lead="Twarde fakty, metryki lub logi potwierdzające istnienie wyzwań."
        >
          <div className="mb-4">
            <ContextDocUploader
              tabName="Dowody"
              suggestions={[
                'Eksport surowych danych',
                'Dashboard KPI',
                'Logi systemowe',
                'Raporty finansowe',
              ]}
            />
          </div>
          <OrgRecordList
            columns={[
              { key: 'metric', label: 'Metryka / dana', placeholder: 'np. Braki 12%' },
              { key: 'symptom', label: 'Objaw / obserwacja', placeholder: 'np. Przestój co godzinę' },
              { key: 'source', label: 'System / dokument źródłowy', placeholder: 'np. Raport SAP' },
              { key: 'link', label: 'Link / odniesienie', placeholder: 'np. Strona 12' },
            ]}
            items={challenges.evidence as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={evidenceHandlers.onAdd}
            onUpdate={evidenceHandlers.onUpdate}
            onRemove={evidenceHandlers.onRemove}
            addLabel="Dodaj dowód"
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
        onSectionChange: (id) => setActiveSection(id as ChallengesEvidenceSection),
        chips,
        activeChip,
        onChipChange: setActiveChip,
        statePanel,
        content,
      })}
    </>
  );
};

export default OrganizationChallengesEvidenceScreen;
