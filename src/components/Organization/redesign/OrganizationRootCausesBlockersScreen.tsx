/**
 * „Przyczyny i blockery" — SZÓSTY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Wyzwań (mapa konsolidacji
 * §2, pozycje #10 „Przyczyny źródłowe" + #11 „Blockery celów"). Dwie sekcje
 * ekranu = dwie pigułki Menu 2: Przyczyny źródłowe · Blockery.
 *
 * DANE SĄ REALNE PO OBU STRONACH (FAZA 2, DEC-2026-08-24-15) — ten sam
 * magazyn co stary `ChallengeMapModule`:
 *   `useContextBuilderStore().challenges` (`rootCauseAnswers`/`activeBlockers`)
 *   jako bufor roboczy edycji + „Zapisz zmiany" → `contextSync.saveNow()`
 *   (prop z `OrganizationView`, JEDYNY pisarz do `/organization-context-store`
 *   — patrz `useOrgContextStoreSection.ts`), dzieli klucz `challenges` z
 *   ekranem „Wyzwania i dowody" przez ten sam współdzielony hak.
 *   Cztery pytania diagnostyczne to ten sam tekst co w starym ekranie
 *   (`ROOT_CAUSE_QUESTIONS`) — realne pytania, nie atrapa.
 *
 * Galeria „Gotowe blockery" (warunek (c), DEC-2026-08-24-15) WRACA — te same
 * cztery treści co w starym `commonBlockers` (`ChallengeMapModule.tsx`),
 * przeniesione 1:1: Lęk przed porażką / Nadmiar spotkań / Zmęczenie zmianą /
 * Fragmentacja danych. Styl — kanon (`c-*`, zero `primary-*`), nie kopia
 * starych klas Tailwind.
 *
 * ŚWIADOMIE POMINIĘTE względem starego `ChallengeMapModule`:
 *   - flaga `status: 'detected'` (AI) na blockerze nie jest dziś nigdzie
 *     ustawiana przez realny kod (zawsze `'confirmed'`/`'manual'` z UI) —
 *     pominięta jako martwy stan, nie usunięta dana.
 */

import { Activity, Check, Lock, Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

import { cn } from '../../../lib/utils';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { ORG_L1, OrgRecordList, OrgSectionCard, OrgTextField } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';
import {
  type OrgContextSyncHandle,
  useOrgContextStoreSection,
} from './useOrgContextStoreSection';

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

const BLOCKER_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  BLOCKER_TYPE_OPTIONS.map((option) => [option.value, option.label])
);

/** Galeria gotowych blockerów — treści 1:1 ze starego `ChallengeMapModule.commonBlockers`. */
const COMMON_BLOCKERS: Array<{ id: string; type: string; title: string; desc: string }> = [
  {
    id: 'c1',
    type: 'Culture',
    title: 'Lęk przed porażką',
    desc: 'Pracownicy ukrywają błędy zamiast je zgłaszać.',
  },
  {
    id: 'c2',
    type: 'Process',
    title: 'Nadmiar spotkań',
    desc: 'Produktywność traci na nadmiernych spotkaniach koordynacyjnych.',
  },
  {
    id: 'c3',
    type: 'Strategy',
    title: 'Zmęczenie zmianą',
    desc: 'Zespoły są wypalone nadmiarem inicjatyw.',
  },
  {
    id: 'c4',
    type: 'Technology',
    title: 'Fragmentacja danych',
    desc: 'Kluczowe KPI są ręcznie zbierane w Excelu.',
  },
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
  /** Jedyny pisarz do `/organization-context-store` — patrz `OrganizationView`. */
  contextSync?: OrgContextSyncHandle;
  children: (args: RootCausesBlockersRenderArgs) => React.ReactNode;
}> = ({ contextSync, children }) => {
  const { challenges, setChallenges } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<RootCausesBlockersSection>('rootcause');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection(contextSync);

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

  const addFromGallery = useCallback(
    (preset: { id: string; type: string; title: string; desc: string }) => {
      setChallenges({
        activeBlockers: [
          ...challenges.activeBlockers,
          {
            id: Math.random().toString(36).slice(2, 11),
            type: preset.type,
            title: preset.title,
            desc: preset.desc,
            status: 'confirmed' as const,
            confidence: 'Manual',
          },
        ],
      });
    },
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
          <div className="mb-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
            <p className={cn(ORG_L1, 'mb-2')}>Gotowe blockery — dodaj jednym kliknięciem</p>
            <div
              data-testid="org-blocker-gallery"
              role="group"
              aria-label="Gotowe blockery"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4"
            >
              {COMMON_BLOCKERS.map((preset) => {
                const isAdded = challenges.activeBlockers.some(
                  (blocker) => blocker.title === preset.title
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isAdded}
                    onClick={() => !isAdded && addFromGallery(preset)}
                    aria-pressed={isAdded}
                    className={cn(
                      'flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left text-[12px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]',
                      isAdded
                        ? 'cursor-default border-c-border-strong bg-state-selected opacity-70'
                        : 'border-c-border-subtle bg-c-surface hover:border-c-border-strong'
                    )}
                  >
                    <span className="flex w-full items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                        {BLOCKER_TYPE_LABEL[preset.type] ?? preset.type}
                      </span>
                      {isAdded ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 text-c-text-muted" />
                      ) : (
                        <Plus aria-hidden="true" className="h-3.5 w-3.5 text-c-text-muted" />
                      )}
                    </span>
                    <span className="font-medium text-c-text">{preset.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
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
