import { evaluateResearchLedgerContract } from '../src/services/ai/evalHarnessService.js';

const responseText = `
The European industrial AI market is consolidating around a smaller set of platform vendors [1].
Adoption risk remains highest where data residency requirements block default cloud routing [2].
Organizations with mixed provider policies usually need an explicit fallback model strategy [3].
`;

const result = evaluateResearchLedgerContract({
  responseText,
  unsupportedClaimThreshold: 0.2,
});

if (!result.passes) {
  console.error('[smoke:ai:research-ledger] failed', result);
  process.exit(1);
}

console.log('[smoke:ai:research-ledger] passed', result);
