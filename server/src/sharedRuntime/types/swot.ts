/** GENERATED server-safe structural SWOT types used by shared runtime mirrors. */
export type ProposalStatus = 'ai-proposed' | 'accepted' | 'rejected' | 'rethinking';
export type SWOTCardStatus = 'draft' | 'accepted' | 'rejected';
export type SWOTEvidenceType = 'fact' | 'observation' | 'hypothesis';

export interface SWOTItem {
  id: string;
  text: string;
  impact: 'high' | 'medium' | 'low';
  quadrant: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
  status?: SWOTCardStatus;
  linkedSignalIds?: string[];
  proposalStatus?: ProposalStatus;
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
  evidenceNote?: string;
  evidenceType?: SWOTEvidenceType;
}

export interface SWOTTension {
  id: string;
  title: string;
  type: 'attack' | 'repair' | 'defend' | 'protect';
  linkedCorrelationIds: string[];
  linkedItemIds: string[];
  insight: string;
  whyNow?: string;
  confidence?: number;
  proposalStatus?: ProposalStatus;
  userComment?: string;
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
