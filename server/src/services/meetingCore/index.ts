/**
 * index.ts — barrel export for Meeting Core (Wave 2).
 */

export * from './errors.js';
export * from './lifecycle.js';
export * from './meetingCoreService.js';
export {
  approveOutput,
  materializeOutput,
  proposeOutput,
  reconcileMaterializingOutput,
  rejectOutput,
} from './outputs.js';
export type {
  CreateDecisionTargetInput,
  CreateTaskTargetInput,
  MaterializedTarget,
  OutputTargetMaterializer,
} from './outputsMaterializer.js';
export { createProductionMaterializer, MEETING_OUTPUT_SOURCE_TYPE } from './outputsMaterializer.js';
export * from './types.js';
