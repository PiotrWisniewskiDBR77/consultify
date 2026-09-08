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
import { useTranslation } from 'react-i18next';

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

export const ROOT_CAUSES_BLOCKERS_SECTIONS: Array<{
  id: RootCausesBlockersSection;
  labelKey: string;
  en: string;
}> = [
  { id: 'rootcause', labelKey: 'organization.redesign.rootCauses.sections.rootcause', en: 'Root causes' },
  { id: 'blockers', labelKey: 'organization.redesign.rootCauses.sections.blockers', en: 'Blockers' },
];

const ROOT_CAUSE_QUESTIONS = [
  { qKey: 'organization.redesign.rootCauses.q1', enQ: 'Where do decisions get stuck?', hKey: 'organization.redesign.rootCauses.q1h', enH: 'e.g. Middle management hesitation, missing data…' },
  { qKey: 'organization.redesign.rootCauses.q2', enQ: 'Where is resistance to change strongest?', hKey: 'organization.redesign.rootCauses.q2h', enH: 'e.g. The shop floor, one specific department…' },
  { qKey: 'organization.redesign.rootCauses.q3', enQ: 'Which past initiatives failed, and why?', hKey: 'organization.redesign.rootCauses.q3h', enH: 'e.g. A Lean rollout with no follow-through…' },
  { qKey: 'organization.redesign.rootCauses.q4', enQ: 'Is there a gap between the board\'s view and reality?', hKey: 'organization.redesign.rootCauses.q4h', enH: 'e.g. The CEO believes the ERP works, users work in Excel…' },
];

/** Typ blokera = enum zapisywany w kontekście → słownik kluczy (PLAN §2 pkt 6). */
const BLOCKER_TYPE_KEYS: Array<{ value: string; labelKey: string; en: string }> = [
  { value: 'Culture', labelKey: 'organization.redesign.blockerType.Culture', en: 'Culture' },
  { value: 'Process', labelKey: 'organization.redesign.blockerType.Process', en: 'Process' },
  { value: 'Technology', labelKey: 'organization.redesign.blockerType.Technology', en: 'Technology' },
  { value: 'Strategy', labelKey: 'organization.redesign.blockerType.Strategy', en: 'Strategy' },
  { value: 'People', labelKey: 'organization.redesign.blockerType.People', en: 'People' },
];

/**
 * Galeria gotowych blockerów — treści 1:1 ze starego `ChallengeMapModule.commonBlockers`,
 * ale przez klucze: użytkownik EN dodaje angielski bloker, użytkownik PL polski.
 */
const COMMON_BLOCKERS: Array<{ id: string; type: string; titleKey: string; enTitle: string; descKey: string; enDesc: string }> = [
  { id: 'c1', type: 'Culture', titleKey: 'organization.redesign.rootCauses.preset.c1.title', enTitle: 'Fear of failure', descKey: 'organization.redesign.rootCauses.preset.c1.desc', enDesc: 'People hide mistakes instead of reporting them.' },
  { id: 'c2', type: 'Process', titleKey: 'organization.redesign.rootCauses.preset.c2.title', enTitle: 'Too many meetings', descKey: 'organization.redesign.rootCauses.preset.c2.desc', enDesc: 'Productivity is lost to excessive coordination meetings.' },
  { id: 'c3', type: 'Strategy', titleKey: 'organization.redesign.rootCauses.preset.c3.title', enTitle: 'Change fatigue', descKey: 'organization.redesign.rootCauses.preset.c3.desc', enDesc: 'Teams are burnt out by too many initiatives at once.' },
  { id: 'c4', type: 'Technology', titleKey: 'organization.redesign.rootCauses.preset.c4.title', enTitle: 'Fragmented data', descKey: 'organization.redesign.rootCauses.preset.c4.desc', enDesc: 'Key KPIs are collected by hand in Excel.' },
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
  const { t } = useTranslation();
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
      // `title`/`desc` przychodzą już PRZETŁUMACZONE (patrz miejsce wywołania) —
      // do danych trafia tekst w języku, w którym użytkownik pracuje.
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
    label: t(section.labelKey, section.en),
  }));
  const blockerTypeOptions = BLOCKER_TYPE_KEYS.map((item) => ({
    value: item.value,
    label: t(item.labelKey, item.en),
  }));
  const blockerTypeLabel = (value: string): string => {
    const found = BLOCKER_TYPE_KEYS.find((item) => item.value === value);
    return found ? t(found.labelKey, found.en) : value;
  };
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
      {showField('rootCauseAnswers') && (
        <OrgSectionCard
          id="rootcause"
          title={t('organization.redesign.rootCauses.sections.rootcause', 'Root causes')}
          icon={Activity}
          lead={t('organization.redesign.rootCauses.lead', 'These answers help surface the hidden causes behind the declared challenges.')}
        >
          <div className="space-y-4">
            {ROOT_CAUSE_QUESTIONS.map((item, index) => (
              <OrgTextField
                key={index}
                id={`root-cause-${index}`}
                label={t(item.qKey, item.enQ)}
                multiline
                value={challenges.rootCauseAnswers[index] || ''}
                placeholder={t(item.hKey, item.enH)}
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
        <OrgSectionCard id="blockers" title={t('organization.redesign.rootCauses.sections.blockers', 'Blockers')} icon={Lock}>
          <div className="mb-4 rounded-xl border border-c-border-subtle bg-c-surface-raised p-3">
            <p className={cn(ORG_L1, 'mb-2')}>{t('organization.redesign.rootCauses.gallery.heading', 'Ready-made blockers — add with one click')}</p>
            <div
              data-testid="org-blocker-gallery"
              role="group"
              aria-label={t('organization.redesign.rootCauses.gallery.aria', 'Ready-made blockers')}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4"
            >
              {COMMON_BLOCKERS.map((preset) => {
                const presetTitle = t(preset.titleKey, preset.enTitle);
                const isAdded = challenges.activeBlockers.some(
                  (blocker) => blocker.title === presetTitle
                );
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isAdded}
                    onClick={() =>
                      !isAdded &&
                      addFromGallery({
                        id: preset.id,
                        type: preset.type,
                        title: presetTitle,
                        desc: t(preset.descKey, preset.enDesc),
                      })
                    }
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
                        {blockerTypeLabel(preset.type)}
                      </span>
                      {isAdded ? (
                        <Check aria-hidden="true" className="h-3.5 w-3.5 text-c-text-muted" />
                      ) : (
                        <Plus aria-hidden="true" className="h-3.5 w-3.5 text-c-text-muted" />
                      )}
                    </span>
                    <span className="font-medium text-c-text">{presetTitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <OrgRecordList
            columns={[
              {
                key: 'title',
                label: t('organization.redesign.rootCauses.col.title', 'Blocker name'),
                placeholder: t('organization.redesign.rootCauses.col.titlePh', 'e.g. Fear of failure'),
              },
              {
                key: 'type',
                label: t('organization.redesign.rootCauses.col.type', 'Type'),
                type: 'select',
                options: blockerTypeOptions,
              },
              {
                key: 'desc',
                label: t('organization.redesign.rootCauses.col.desc', 'Description and impact'),
                type: 'textarea',
                placeholder: t('organization.redesign.rootCauses.col.descPh', 'Describe the obstacle and its impact…'),
              },
            ]}
            items={challenges.activeBlockers as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={blockerHandlers.onAdd}
            onUpdate={blockerHandlers.onUpdate}
            onRemove={blockerHandlers.onRemove}
            addLabel={t('organization.redesign.rootCauses.addBlocker', 'Add blocker')}
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
