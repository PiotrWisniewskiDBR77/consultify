import { Pool, type PoolConfig } from 'pg';

import databaseConfig from '../../config/DatabaseConfig.js';
import logger from '../../utils/Logger.js';
import {
  MaterialCommandConflictError,
  MaterialCommandRuleError,
  MaterialCommandValidationError,
} from './materialCommand.js';
import { PostgresGovernancePolicyResolver } from './postgresGovernancePolicyResolver.js';
import { PostgresMaterialCommandUnitOfWork } from './postgresMaterialCommandUnitOfWork.js';
import { registerInitiative } from './registerInitiative.js';
import { submitSourceProposal } from './submitSourceProposal.js';

/**
 * E7 [ODMROZENIE 05_INITIATIVES DEC-453] — the demo-session seed
 * (`demoSeedService.ts:2295`) used to write ONLY to the legacy `initiatives`
 * table. Every seeded demo organization therefore had 22 legacy initiatives
 * and 0 canonical aggregates (`ie_aggregate_state`) — measured by the C2
 * acceptance review (96_ODBIOR_C2_E3_E5.md, "7. pisarz legacy"). This writer
 * runs the SAME two commands the UI registration flow uses
 * (`POST source-proposals` -> `POST registrations`), calling the domain
 * services directly (no HTTP hop, no Express auth/eligibility gates — the
 * seed runs with system authority, not as an impersonated actor).
 *
 * Idempotency contract (deterministic ids, required for re-seed = 0 new rows):
 *  - `aggregateId` for BOTH the source_proposal and the initiative aggregate
 *    are derived from the SAME `initiativeId` the legacy `INSERT INTO
 *    initiatives` already uses (`makeId(organizationId, 'initiative', slug)`)
 *    so `initiativeUnifiedReader` collapses legacy+canon into ONE row on id
 *    collision (status from legacy, rest from canon — C1-FIX-1 contract).
 *  - `clientRequestId` for both commands is deterministic (derived from the
 *    same aggregate ids). `executeMaterialCommand` looks up the stored
 *    receipt by `clientRequestId` BEFORE it does anything else — a matching
 *    receipt short-circuits to `status: 'REPLAYED'` and never touches
 *    `ie_aggregate_state` / `ie_audit_events` / `ie_outbox_events` /
 *    `ie_aggregate_relations` / `initiative_candidates` again. A second seed
 *    run is therefore a no-op for the canonical store, same as it already is
 *    for the legacy `ON CONFLICT(id) DO UPDATE`.
 */

export interface SeedCanonicalInitiativeInput {
  organizationId: string;
  /** Same id as the legacy `initiatives.id` row (see module doc above). */
  initiativeId: string;
  projectId: string;
  title: string;
  problem: string;
  priority: 'low' | 'medium' | 'high' | 'critical' | string;
  initiativeOwnerId: string | null | undefined;
  /** ISO timestamp; the seed's own anchor date works fine here. */
  capturedAt: string;
}

export type SeedCanonicalInitiativeStatus = 'APPLIED' | 'REPLAYED';

export interface SeedCanonicalInitiativeResult {
  proposalStatus: SeedCanonicalInitiativeStatus;
  registerStatus: SeedCanonicalInitiativeStatus;
}

const PRIORITY_MAP: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

function resolveSeedPriority(priority: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  return PRIORITY_MAP[priority.toLowerCase()] || 'MEDIUM';
}

// Lazy singleton: a Pool must NOT open on module import (this file is reached
// transitively by any test that merely imports demoSeedService.ts). Built on
// first real write, using the exact same `databaseConfig.postgres` every
// other runtime-v1 caller uses (see
// `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`).
let seedCanonicalPool: Pool | null = null;
function getSeedCanonicalPool(): Pool {
  if (!seedCanonicalPool) {
    seedCanonicalPool = new Pool(databaseConfig.postgres as PoolConfig);
  }
  return seedCanonicalPool;
}

/**
 * Registers one seed initiative in the canonical store (runtime-v1). Returns
 * `null` (and logs a warning) when the seed template is missing data the
 * canonical writer requires (`initiativeOwnerId`) — this must never happen
 * for the shipped Atelier Toys fixture, but a demo seed must not crash the
 * rest of the dataset over a template gap, so this fails soft, not closed.
 * Any OTHER failure (governance / domain rule rejection) is a genuine STOP
 * and is re-thrown to the caller.
 */
export async function writeSeedInitiativeToCanon(
  input: SeedCanonicalInitiativeInput
): Promise<SeedCanonicalInitiativeResult | null> {
  if (!input.initiativeOwnerId) {
    logger.warn(
      '[seedCanonicalInitiativeWriter] initiativeOwnerId missing in seed template — skipping canonical write for this initiative',
      { organizationId: input.organizationId, initiativeId: input.initiativeId }
    );
    return null;
  }

  const pool = getSeedCanonicalPool();
  const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);
  const policyResolver = new PostgresGovernancePolicyResolver(pool);
  const priority = resolveSeedPriority(input.priority);
  const proposalId = `${input.initiativeId}--source-proposal`;
  const proposalClientRequestId = `${proposalId}--submit`;
  const registerClientRequestId = `${input.initiativeId}--register`;

  const policy = await policyResolver.resolve(input.organizationId, input.projectId);

  const proposalResult = await submitSourceProposal(unitOfWork, {
    organizationId: input.organizationId,
    actorId: 'system-demo-seed',
    aggregateType: 'source_proposal',
    aggregateId: proposalId,
    expectedVersion: 0,
    clientRequestId: proposalClientRequestId,
    correlationId: `demo-seed--${proposalClientRequestId}`,
    policyId: policy.policyId,
    policyVersion: policy.version,
    commandType: 'source-proposal.submit',
    createIfMissing: true,
    payload: {
      sourceType: 'demo_seed_initiative',
      sourceId: input.initiativeId,
      sourceVersion: 1,
      provenance: {
        system: 'demo-seed',
        recordType: 'atelier_toys_initiative',
        capturedAt: input.capturedAt,
        evidenceRefs: [`demo-seed:${input.initiativeId}`],
      },
      title: input.title,
      problem: input.problem,
      proposedOutcome: null,
      priority,
      projectId: input.projectId,
      initiativeOwnerId: input.initiativeOwnerId,
      visibility: 'PROJECT',
    },
  });

  const registerResult = await registerInitiative(unitOfWork, {
    organizationId: input.organizationId,
    actorId: 'system-demo-seed',
    aggregateType: 'initiative',
    aggregateId: input.initiativeId,
    expectedVersion: 0,
    clientRequestId: registerClientRequestId,
    correlationId: `demo-seed--${registerClientRequestId}`,
    policyId: policy.policyId,
    policyVersion: policy.version,
    commandType: 'initiative.register',
    createIfMissing: true,
    payload: {
      proposalId,
      proposalVersion: 1,
      sourceType: 'demo_seed_initiative',
      sourceId: input.initiativeId,
      sourceVersion: 1,
      title: input.title,
      problem: input.problem,
      proposedOutcome: null,
      priority,
      projectId: input.projectId,
      visibility: 'PROJECT',
      initiativeOwnerId: input.initiativeOwnerId,
      validatorCapability: 'INITIATIVE_REGISTER',
    },
  });

  return { proposalStatus: proposalResult.status, registerStatus: registerResult.status };
}

export function isSeedCanonicalDomainError(
  error: unknown
): error is MaterialCommandValidationError | MaterialCommandConflictError | MaterialCommandRuleError {
  return (
    error instanceof MaterialCommandValidationError ||
    error instanceof MaterialCommandConflictError ||
    error instanceof MaterialCommandRuleError
  );
}
