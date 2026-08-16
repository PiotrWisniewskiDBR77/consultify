#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targetRoot = path.join(root, 'server/src/sharedRuntime');
const checkOnly = process.argv.includes('--check');
const emit = (target, content) => {
  if (checkOnly) {
    const current = readFileSync(target, 'utf8');
    if (current !== content) throw new Error(`Runtime mirror drift: ${path.relative(root, target)}`);
    return;
  }
  writeFileSync(target, content);
};
const sources = [
  'src/config/swot/dynamicSwotQuestionBank.ts',
  'src/config/swot/swotAcceptGate.ts',
  'src/config/swot/swotTensionEngine.ts',
  'src/toolOutputs/contentHash.ts',
  'src/toolOutputs/types.ts',
  'src/toolOutputs/outputLifecycle.ts',
  'src/toolOutputs/buildSwotOutput.ts',
  'src/toolOutputs/renderReport.ts',
];

const addEsmExtensions = (source) =>
  source.replace(/from\s+(['"])(\.{1,2}\/[^'"]+?)(?<!\.js)\1/g, 'from $1$2.js$1');

for (const sourcePath of sources) {
  let source = readFileSync(path.join(root, sourcePath), 'utf8');
  source = source
    .replaceAll("@/store/useToolStore", '../../types/swot.js')
    .replaceAll("../store/useToolStore", '../types/swot.js');
  source = addEsmExtensions(source);
  const relative = sourcePath.replace(/^src\//, '');
  const target = path.join(targetRoot, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  emit(
    target,
    `/** GENERATED MIRROR — run scripts/cleanup/sync-server-runtime-mirrors.mjs; do not edit directly. */\n${source}`
  );
}

const swotTypes = `/** GENERATED server-safe structural SWOT types used by shared runtime mirrors. */
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
`;
mkdirSync(path.join(targetRoot, 'types'), { recursive: true });
emit(path.join(targetRoot, 'types/swot.ts'), swotTypes);

console.log(`${checkOnly ? 'Verified' : 'Synchronized'} ${sources.length + 1} server runtime mirror files.`);
