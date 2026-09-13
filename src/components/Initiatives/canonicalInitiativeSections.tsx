import React from 'react';
import { FileText } from 'lucide-react';
import { INITIATIVE_CARD_KEYS, INITIATIVE_CARD_REGISTRY, type InitiativeCardKey } from '@/contracts/initiatives-execution/cardRegistry';
import type { NModeSection } from '@/components/shared/NModeLayout/types';
import { DEFINITION_CONTENT_CARD_KEYS } from './DefinitionCardContent';

/** Presentation bridge only: canonical card identity remains in the shared registry. */
const nativeSection: Partial<Record<InitiativeCardKey, string[]>> = {
  'summary-scope': ['initiative-definition'], 'success-criteria': ['target-state-scope'],
  'outcomes-benefits': ['target-state-scope'], kpi: ['kpi'],
  'financial-analysis': ['financial-analysis'], 'financial-impact': ['financial-impact'],
  'people-team': ['team'], 'roles-raci': ['raci'], stakeholders: ['raci'],
  'resources-capacity': ['resources'], dependencies: ['dependencies'], 'risk-raid': ['risk-raid'],
  milestones: ['milestones'], timeline: ['timeline'], tasks: ['tasks'], decisions: ['decisions'],
  'gates-approvals': ['gates'], 'feasibility-completeness': ['gates'],
  'capabilities-training': ['competencies'], 'attachments-materials': ['attachments-links'],
  'comments-activity-history': ['comments', 'activity-log'],
};
export function canonicalInitiativeSections(
  native: NModeSection[],
  renderDefinition: (key: InitiativeCardKey) => React.ReactNode,
  translate: (key: string, fallback: string) => string
): NModeSection[] {
  const byId = new Map(native.map(section => [section.id, section]));
  const consumed = new Set(Object.values(nativeSection).flat());
  const sections = INITIATIVE_CARD_KEYS.map((key): NModeSection => {
    const card = INITIATIVE_CARD_REGISTRY[key];
    const sourceSections = (nativeSection[key] || []).map(id => byId.get(id)).filter((item): item is NModeSection => Boolean(item));
    // Definition content has separate canonical versions, even where the old renderer shared a section.
    // Milestones and quality reference their existing source section instead of copying its state.
    const source = sourceSections[0];
    return { id: key, icon: source?.icon || FileText,
      label: { en: card.label, pl: translate(`initiatives.cards.${key}`, card.label) },
      group: translate(`initiatives.cardGroups.${card.group}`, card.group), alwaysShow: true,
      component: DEFINITION_CONTENT_CARD_KEYS.includes(key) ? renderDefinition(key)
        : sourceSections.length ? <>{sourceSections.map(section => <React.Fragment key={section.id}>{section.component}</React.Fragment>)}</>
          : <div className="space-y-3 text-c-text"><h2 className="text-lg font-semibold">{translate(`initiatives.cards.${key}`, card.label)}</h2><p>{translate('initiatives.cards.noContent', 'No published content is available for this card. Requiredness and readiness are determined by the active profile.')}</p></div>,
    };
  });
  // Preserve utilities and legacy-only helpers explicitly; they are not extra business cards.
  return [...sections, ...native.filter(section => !consumed.has(section.id) && !INITIATIVE_CARD_KEYS.some(key => key === section.id)).map(section => ({ ...section, group: translate('initiatives.cardGroups.workspace', 'Workspace tools') }))];
}
