/**
 * NMode Completeness — Barrel exports
 *
 * @see V3-K01: N-mode required sections/fields + completeness + AI assist
 */

export { AIFillDialog } from './AIFillDialog';
export { getCompletenessConfig } from './completenessConfigs';
export { CompletenessPill } from './CompletenessPill';
export { MissingItemsList } from './MissingItemsList';
export type {
  AIFillProposal,
  ArtifactType,
  CompletenessConfig,
  CompletenessResult,
  CompletionStatus,
  MissingItem,
  RequiredField,
  RequiredSection,
} from './types';
export type { UseCompletenessOptions } from './useCompleteness';
export { useCompleteness } from './useCompleteness';
