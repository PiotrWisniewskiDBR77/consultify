/**
 * Server-owned structural mirror of the Dynamic SWOT domain records consumed
 * by deterministic Tool Output and Teresa services. Keep this narrow: the
 * server must not import the Zustand store (and its browser-only dependency
 * graph) into the production Node build.
 */
export type ProposalStatus = 'ai-proposed' | 'accepted' | 'rejected' | 'rethinking';

export interface SWOTItem {
  id: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  status?: 'accepted' | 'proposed';
  linkedSignalIds?: string[];
  proposalStatus?: ProposalStatus;
  staircase?: { fact: string; factRefs: string[]; interpretation: string; implication: string };
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
  evidenceNote?: string;
  evidenceType?: 'fact' | 'observation' | 'hypothesis';
  classification?: 'core-competency' | 'niche-strength' | 'claimed-strength' | 'table-stakes';
}

export interface SWOTTension {
  id: string;
  title: string;
  type: 'attack' | 'repair' | 'defend' | 'protect';
  linkedCorrelationIds: string[];
  linkedItemIds: string[];
  insight: string;
  whyNow?: string;
  proposalStatus?: ProposalStatus;
}

export interface SWOTMove {
  id: string;
  title: string;
  category: 'quick-win' | 'big-bet' | 'defensive-move' | 'capability-build';
  rationale: string;
  linkedTensionIds: string[];
  linkedItemIds: string[];
  expectedImpact: 'high' | 'medium' | 'low';
  estimatedEffort: 'high' | 'medium' | 'low';
  firstStep?: string;
  proposalStatus?: ProposalStatus;
  tradeoff?: { chosen: string; deferred: string; cost: string };
  rejectedAlternative?: { option: string; reason: string };
  ownerRole?: string;
}
