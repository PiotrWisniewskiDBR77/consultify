/**
 * Case Workspace — module capability adapters (Strumień C).
 *
 * Barrel + a single bootstrap entry point for all SEVEN adapters.
 *
 * ⚠ STILL NOT WIRED INTO PROCESS BOOT — verified 2026-08-12 by the
 * coordinator: `grep -rn registerBuiltinCapabilityAdapters server/src`
 * outside this file returns ONLY test files. Nothing in production calls it.
 * This is the same defect class as the outbox worker, which sat with zero
 * callers while its write side looked correct (now wired at
 * server/src/index.ts:1864). Until this is wired, EVERY capability below is
 * dead code in a real deployment, and no adapter may be recorded as
 * IMPLEMENTED_AND_PROVEN on the strength of its own passing test alone.
 *
 * WHY it was never wired (the real obstacle, not an oversight):
 * `registerCapabilityWithAdapter` COUPLES two things with different
 * lifetimes — a PERSISTENT registry row (UNIQUE on
 * (capability_id, capability_version), see capabilityRegistryService.ts:496)
 * and an IN-MEMORY adapter binding that must be re-established on every
 * boot. So the second boot against the same database throws
 * `capability_already_registered`, and `registerCapability` additionally
 * demands a real ADMIN actor via `requireOrgRole` — an identity a fresh
 * process does not necessarily have. Wiring this correctly means separating
 * binding re-registration (every boot, idempotent) from row creation (once),
 * WITHOUT weakening the ADMIN authorization check.
 *
 * Until that lands, every capability below is reachable in-process
 * (`executeCapability({ capabilityId: DECISION_CREATE_CAPABILITY_ID, ... })`)
 * only by a caller that first calls `registerBuiltinCapabilityAdapters`
 * itself (as every adapter's own `*.pg.test.ts` suite does in its
 * `beforeAll`) — which is precisely why those tests pass while production
 * has no access to any of it.
 */

export * from './decisionAdapter.js';
export * from './initiativeAdapter.js';
export * from './kpiAdapter.js';
export * from './financeAdapter.js';
export * from './assessmentAdapter.js';
export * from './resultsAdapter.js';
export * from './documentsAdapter.js';

import { registerDecisionCreateCapability } from './decisionAdapter.js';
import { registerInitiativeCreateCapability } from './initiativeAdapter.js';
import { registerKpiCreateCapability } from './kpiAdapter.js';
import { registerFinanceModelCreateCapability } from './financeAdapter.js';
import { registerAssessmentCreateCapability } from './assessmentAdapter.js';
import { registerResultsScorecardCreateCapability } from './resultsAdapter.js';
import { registerDocumentsAndPresentationCapabilities } from './documentsAdapter.js';

/**
 * Registers all four Golden Case adapters (registry row + binding, coupled
 * — see capabilityAdapterService.registerCapabilityWithAdapter) under a
 * single platform-admin actor/org. Throws `capability_already_registered`
 * (from capabilityRegistryService.registerCapability) on a second call for
 * the same org — callers that need idempotent boot should catch and ignore
 * that specific error, matching the same "already registered = safe replay"
 * posture capabilityRegistryService.ts's own header documents for the
 * (capabilityId, capabilityVersion) pair.
 */
export async function registerBuiltinCapabilityAdapters(params: {
  createdByActorId: string;
  callerOrganizationId: string;
}): Promise<void> {
  await registerDecisionCreateCapability(params);
  await registerInitiativeCreateCapability(params);
  await registerKpiCreateCapability(params);
  await registerFinanceModelCreateCapability(params);
  await registerAssessmentCreateCapability(params);
  await registerResultsScorecardCreateCapability(params);
  await registerDocumentsAndPresentationCapabilities(params);
}
