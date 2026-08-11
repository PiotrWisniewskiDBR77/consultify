/**
 * Case Workspace — module capability adapters (Strumień C).
 *
 * Barrel + a single bootstrap entry point. THIS FILE IS NOT WIRED INTO
 * PROCESS BOOT — `server/src/routes/caseWorkspace/index.ts` is out of this
 * packet's allowlist (see the task brief's ZAKAZANE list), so nothing in
 * this codebase calls `registerBuiltinCapabilityAdapters` yet. A future
 * packet that owns process bootstrap should call it once, with a real
 * platform-admin actor/org, at server startup — exactly the same shape the
 * generic `capabilityAdapterService.pg.test.ts` suite already exercises per
 * capability, just done once for all four at boot instead of per-test.
 *
 * Until that wiring lands, every capability below is reachable in-process
 * (`executeCapability({ capabilityId: DECISION_CREATE_CAPABILITY_ID, ... })`)
 * by any caller that first calls `registerBuiltinCapabilityAdapters` itself
 * (as every adapter's own `*.pg.test.ts` suite does in its `beforeAll`).
 */

export * from './decisionAdapter.js';
export * from './initiativeAdapter.js';
export * from './kpiAdapter.js';
export * from './financeAdapter.js';

import { registerDecisionCreateCapability } from './decisionAdapter.js';
import { registerInitiativeCreateCapability } from './initiativeAdapter.js';
import { registerKpiCreateCapability } from './kpiAdapter.js';
import { registerFinanceModelCreateCapability } from './financeAdapter.js';

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
}
