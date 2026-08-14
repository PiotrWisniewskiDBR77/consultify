/**
 * Teresa capability wiring — client-side, public surface (S4, 2026-08-13).
 *
 * Domain-agnostic (DRD/SIRI both read it): capability metadata, intent
 * building and matrix-cell resolution for the Intent → Preview → Commit
 * cycle defined in `src/method-core/contracts/teresa.ts`. Does not itself
 * call the network — `src/method-core/api/methodCoreApi.ts` owns that; this
 * module supplies the capability-shaped inputs to it.
 */
export {
  TERESA_CAPABILITY_REGISTRY,
  getTeresaCapability,
  listTeresaCapabilities,
  isKnownTeresaCapability,
} from './capabilities';
export type { TeresaCapabilityUiDefinition, TeresaCapabilityParamSchema } from './capabilities';

export { buildTeresaIntent, TeresaIntentError } from './intent';
export type { TeresaIntentInput } from './intent';

export { resolveTeresaCellRef, formatCellRef, formatPreviewCellRef } from './cellRef';
export type { TeresaCellRef } from './cellRef';
