import { evaluateResearchLedgerContract } from '../src/services/ai/evalHarnessService.js';

const responseText = `
The European industrial AI market is consolidating around a smaller set of platform vendors [1].
Adoption risk remains highest where data residency requirements block default cloud routing [2].
Organizations with mixed provider policies usually need an explicit fallback model strategy [3].
`;

const expectedClaims = [
  'The European industrial AI market is consolidating around a smaller set of platform vendors.',
  'Adoption risk remains highest where data residency requirements block default cloud routing.',
  'Organizations with mixed provider policies usually need an explicit fallback model strategy.',
];

const passResult = evaluateResearchLedgerContract({
  responseText,
  expectedClaims,
  unsupportedClaimThreshold: 0,
});

const failingResult = evaluateResearchLedgerContract({
  responseText: `
The European industrial AI market is consolidating around a smaller set of platform vendors.
Adoption risk remains highest where data residency requirements block default cloud routing [2].
Organizations with mixed provider policies usually need an explicit fallback model strategy [3].
`,
  expectedClaims,
  unsupportedClaimThreshold: 0.2,
});

if (!passResult.passes || passResult.citationCoverage !== 1 || passResult.claimCount !== 3) {
  console.error('[smoke:ai:research-ledger] failed passing-case contract', passResult);
  process.exit(1);
}

if (failingResult.passes || failingResult.unsupportedClaimRate <= 0.2) {
  console.error('[smoke:ai:research-ledger] failed negative-case contract', failingResult);
  process.exit(1);
}

console.log('[smoke:ai:research-ledger] passed', { passResult, failingResult });
