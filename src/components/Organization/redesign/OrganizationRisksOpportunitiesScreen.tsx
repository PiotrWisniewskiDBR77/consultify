/**
 * „Ryzyka i szanse" — SIÓDMY realny ekran redesignu v1 (etap B).
 *
 * Powstaje z połączenia dwóch dzisiejszych ekranów Syntezy (mapa konsolidacji
 * §2, pozycje #13 „Ryzyka i szanse" + #15 „Rekomendacja"). Dwie sekcje ekranu
 * = dwie pigułki Menu 2: Ryzyka · Szanse (mocne strony) — bliźniacze tabele
 * o tej samej strukturze, dokładnie jak w uzasadnieniu §3 dokumentu
 * konsolidacji.
 *
 * DANE SĄ REALNE PO OBU STRONACH (FAZA 2, DEC-2026-08-24-15) — ten sam
 * magazyn co stary `StrategicSynthesisModule`:
 *   `useContextBuilderStore().synthesis` (`risks`/`strengths`) jako bufor
 *   roboczy edycji + „Zapisz zmiany" → `contextSync.saveNow()` (prop z
 *   `OrganizationView`, JEDYNY pisarz do `/organization-context-store` —
 *   patrz `useOrgContextStoreSection.ts`).
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
import { useTranslation } from 'react-i18next';

import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import type { StandardCounterChip, StandardModuleTab } from '../../standard/StandardModuleBar';
import { OrgRecordList, OrgSectionCard } from './OrganizationCardPrimitives';
import type { OrganizationStatePanelProps } from './OrganizationStatePanel';
import {
  type OrgContextSyncHandle,
  useOrgContextStoreSection,
} from './useOrgContextStoreSection';

export type RisksOpportunitiesSection = 'risks' | 'strengths';

export const RISKS_OPPORTUNITIES_SECTIONS: Array<{
  id: RisksOpportunitiesSection;
  labelKey: string;
  en: string;
}> = [
  { id: 'risks', labelKey: 'organization.redesign.risks.sections.risks', en: 'Risks' },
  { id: 'strengths', labelKey: 'organization.redesign.risks.sections.strengths', en: 'Opportunities' },
];

/** Waga ryzyka = enum → słownik kluczy (PLAN §2 pkt 6), nie polski literał. */
const SEVERITY_KEYS: Array<{ value: string; labelKey: string; en: string }> = [
  { value: 'Critical', labelKey: 'organization.redesign.severity.critical', en: 'Critical' },
  { value: 'High', labelKey: 'organization.redesign.severity.high', en: 'High' },
  { value: 'Medium', labelKey: 'organization.redesign.severity.medium', en: 'Medium' },
  { value: 'Low', labelKey: 'organization.redesign.severity.low', en: 'Low' },
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
  /** Jedyny pisarz do `/organization-context-store` — patrz `OrganizationView`. */
  contextSync?: OrgContextSyncHandle;
  children: (args: RisksOpportunitiesRenderArgs) => React.ReactNode;
}> = ({ contextSync, children }) => {
  const { t } = useTranslation();
  const { synthesis, updateSynthesisList } = useContextBuilderStore();
  const [activeSection, setActiveSection] = useState<RisksOpportunitiesSection>('risks');
  const [activeChip, setActiveChip] = useState<string>('all');
  const [saved, setSaved] = useState(false);
  const contextStore = useOrgContextStoreSection(contextSync);

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
    label: t(section.labelKey, section.en),
  }));
  const severityOptions = SEVERITY_KEYS.map((item) => ({
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
      {showField('risks') && (
        <OrgSectionCard
          id="risks"
          title={t('organization.redesign.risks.sections.risks', 'Risks')}
          icon={AlertTriangle}
          lead={t('organization.redesign.risks.risksLead', 'What could derail this transformation?')}
        >
          <OrgRecordList
            columns={[
              {
                key: 'risk',
                label: t('organization.redesign.risks.col.risk', 'Risk / threat'),
                placeholder: t('organization.redesign.risks.col.riskPh', 'e.g. Middle management resistance'),
              },
              {
                key: 'why',
                label: t('organization.redesign.risks.col.why', 'Why (root cause)'),
                placeholder: t('organization.redesign.risks.col.whyPh', 'e.g. Fear of job cuts'),
              },
              {
                key: 'severity',
                label: t('organization.redesign.risks.col.severity', 'Severity'),
                type: 'select',
                options: severityOptions,
              },
              {
                key: 'mitigation',
                label: t('organization.redesign.risks.col.mitigation', 'Mitigation strategy'),
                placeholder: t('organization.redesign.risks.col.mitigationPh', 'e.g. Change management programme'),
              },
            ]}
            items={synthesis.risks as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={riskHandlers.onAdd}
            onUpdate={riskHandlers.onUpdate}
            onRemove={riskHandlers.onRemove}
            addLabel={t('organization.redesign.risks.addRisk', 'Add risk')}
          />
        </OrgSectionCard>
      )}

      {showField('strengths') && (
        <OrgSectionCard
          id="strengths"
          title={t('organization.redesign.risks.sections.strengths', 'Opportunities')}
          icon={TrendingUp}
          lead={t('organization.redesign.risks.strengthsLead', 'Which strengths can we build on?')}
        >
          <OrgRecordList
            columns={[
              {
                key: 'enabler',
                label: t('organization.redesign.risks.col.enabler', 'Strength / opportunity'),
                placeholder: t('organization.redesign.risks.col.enablerPh', 'e.g. Strong engineering team'),
              },
              {
                key: 'seen',
                label: t('organization.redesign.risks.col.seen', 'Evidence / where it shows'),
                placeholder: t('organization.redesign.risks.col.seenPh', 'e.g. R&D results'),
              },
              {
                key: 'leverage',
                label: t('organization.redesign.risks.col.leverage', 'How to use it'),
                placeholder: t('organization.redesign.risks.col.leveragePh', 'e.g. As pilot champions'),
              },
            ]}
            items={synthesis.strengths as unknown as Array<Record<string, string> & { id: string }>}
            onAdd={strengthHandlers.onAdd}
            onUpdate={strengthHandlers.onUpdate}
            onRemove={strengthHandlers.onRemove}
            addLabel={t('organization.redesign.risks.addOpportunity', 'Add opportunity')}
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
