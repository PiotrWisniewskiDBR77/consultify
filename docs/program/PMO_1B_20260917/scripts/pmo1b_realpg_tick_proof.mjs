/**
 * PMO-1b local RealPG proof helper.
 * Requires a restored local copy of staging dump and env:
 *   DB_TYPE=postgres MOCK_DB=false RUN_DB_TESTS=1 DB_MANAGED_SCHEMA=off \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6458/consultify_pmo1b \
 *   POSTGRES_SKIP_INIT_IN_TEST=1 NODE_ENV=test node docs/program/PMO_1B_20260917/scripts/pmo1b_realpg_tick_proof.mjs
 */
const { runInitiativeStageSlaEscalationTick } = await import(
  '../../../server/src/services/pmo/initiativeStageSlaService.ts'
);

const organizationId = process.env.PMO1B_PROOF_ORG_ID || 'a3e05d4a-5397-419d-b486-8e44366c0063';
const now = new Date(process.env.PMO1B_PROOF_NOW || '2026-09-17T21:15:00.000Z');
const dry = await runInitiativeStageSlaEscalationTick({ dryRun: true, organizationId, now });
console.log(JSON.stringify({ dryRun: dry.dryRun, candidates: dry.candidates.length, first: dry.candidates[0] }, null, 2));
const run = await runInitiativeStageSlaEscalationTick({ dryRun: false, organizationId, now });
console.log(JSON.stringify({ dryRun: run.dryRun, escalated: run.escalated, errors: run.errors, first: run.candidates[0] }, null, 2));
if (run.escalated !== 1 || run.errors !== 0) process.exit(1);
