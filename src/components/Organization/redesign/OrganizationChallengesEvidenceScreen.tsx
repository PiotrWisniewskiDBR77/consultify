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
import { useTranslation } from 'react-i18next';

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

export const CHALLENGES_EVIDENCE_SECTIONS: Array<{
  id: ChallengesEvidenceSection;
  labelKey: string;
  en: string;
}> = [
  { id: 'challenges', labelKey: 'organization.redesign.challenges.sections.challenges', en: 'Declared challenges' },
  { id: 'evidence', labelKey: 'organization.redesign.challenges.sections.evidence', en: 'Evidence' },
];

/** Waga wyzwania = enum bazy → słownik kluczy (PLAN §2 pkt 6), nie polski literał. */
const SEVERITY_KEYS: Array<{ value: string; labelKey: string; en: string }> = [
  { value: 'Critical', labelKey: 'organization.redesign.severity.critical', en: 'Critical' },
  { value: 'High', labelKey: 'organization.redesign.severity.high', en: 'High' },
  { value: 'Medium', labelKey: 'organization.redesign.severity.medium', en: 'Medium' },
  { value: 'Low', labelKey: 'organization.redesign.severity.low', en: 'Low' },
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
  const { t } = useTranslation();
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

  const severityOptions = useMemo(
    () => SEVERITY_KEYS.map((item) => ({ value: item.value, label: t(item.labelKey, item.en) })),
    [t]
  );
  const sections: StandardModuleTab[] = CHALLENGES_EVIDENCE_SECTIONS.map((section) => ({
    id: section.id,
    label: t(section.labelKey, section.en),
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
      {showField('declaredChallenges') && (
        <OrgSectionCard
          id="challenges"
          title={t('organization.redesign.challenges.sections.challenges', 'Declared challenges')}
          icon={ShieldAlert}
          lead={t('organization.redesign.challenges.challengesLead', 'Official problems reported by the client (symptoms).')}
        >
          <OrgRecordList
            columns={[
              {
                key: 'challenge',
                label: t('organization.redesign.challenges.col.challenge', 'Challenge / symptom'),
                placeholder: t('organization.redesign.challenges.col.challengePh', 'e.g. High defect rate'),
              },
              {
                key: 'area',
                label: t('organization.redesign.challenges.col.area', 'Area'),
                placeholder: t('organization.redesign.challenges.col.areaPh', 'e.g. Quality'),
              },
              {
                key: 'severity',
                label: t('organization.redesign.challenges.col.severity', 'Severity'),
                type: 'select',
                options: severityOptions,
              },
              {
                key: 'notes',
                label: t('organization.redesign.challenges.col.notes', 'Note'),
                placeholder: t('organization.redesign.challenges.col.notesPh', 'Extra context…'),
              },
            ]}
            items={
              challenges.declaredChallenges as unknown as Array<Record<string, string> & { id: string }>
            }
            onAdd={challengeHandlers.onAdd}
            onUpdate={challengeHandlers.onUpdate}
            onRemove={challengeHandlers.onRemove}
            addLabel={t('organization.redesign.challenges.addChallenge', 'Add challenge')}
          />
        </OrgSectionCard>
      )}

      {showField('evidence') && (
        <OrgSectionCard
          id="evidence"
          title={t('organization.redesign.challenges.sections.evidence', 'Evidence')}
          icon={FileSearch}
          lead={t('organization.redesign.challenges.evidenceLead', 'Hard facts, metrics or logs that confirm the challenges are real.')}
        >
          <div className="mb-4">
            <ContextDocUploader
              tabName={t('organization.redesign.challenges.sections.evidence', 'Evidence')}
              suggestions={[
                t('organization.redesign.challenges.upload.rawExport', 'Raw data export'),
                t('organization.redesign.challenges.upload.kpiDashboard', 'KPI dashboard'),
                t('organization.redesign.challenges.upload.systemLogs', 'System logs'),
                t('organization.redesign.challenges.upload.financialReports', 'Financial reports'),
              ]}
            />
          </div>
          <OrgRecordList
            columns={[
              {
                key: 'metric',
                label: t('organization.redesign.challenges.col.metric', 'Metric / data point'),
                placeholder: t('organization.redesign.challenges.col.metricPh', 'e.g. Defects 12%'),
              },
              {
                key: 'symptom',
                label: t('organization.redesign.challenges.col.symptom', 'Symptom / observation'),
                placeholder: t('organization.redesign.challenges.col.symptomPh', 'e.g. Stoppage every hour'),
              },
              {
                key: 'source',
                label: t('organization.redesign.challenges.col.source', 'System / source document'),
                placeholder: t('organization.redesign.challenges.col.sourcePh', 'e.g. SAP report'),
              },
              {
                key: 'link',
                label: t('organization.redesign.challenges.col.link', 'Link / reference'),
                placeholder: t('organization.redesign.challenges.col.linkPh', 'e.g. Page 12'),
              },
            ]}
            items={challenges.evidence as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={evidenceHandlers.onAdd}
            onUpdate={evidenceHandlers.onUpdate}
            onRemove={evidenceHandlers.onRemove}
            addLabel={t('organization.redesign.challenges.addEvidence', 'Add evidence')}
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
