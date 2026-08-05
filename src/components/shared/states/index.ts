/**
 * Shared state components (VEGAS V7.1 systemic standard).
 *
 * Canonical empty / error / loading placeholders. Prefer these over ad-hoc
 * "Loading…" text and bespoke empty screens. See
 * docs/ui-standards/02-components/empty-loading-states.md
 *
 * `LoadingState` (list/card/panel) covers SPEC-L list surfaces.
 * `SkeletonState` (table/record/canvas/deck) covers SPEC-A artifact
 * archetypes — see Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §3.
 * `StreamingState` composes `SkeletonState` for Teresa's AI generation flow.
 *
 * NOT YET wired into any screen — this is the library only (Vegas Fala 0,
 * VF0-10). Rollout into existing screens is a separate, later step.
 */
export {
  EmptyState,
  type EmptyStateActionSpec,
  type EmptyStateProps,
  type EmptyStateVariant,
} from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { LoadingState, type LoadingStateProps, type LoadingTemplate } from './LoadingState';
export {
  ConflictBanner,
  type ConflictBannerProps,
  SaveStateIndicator,
  type SaveStateIndicatorProps,
  type SaveStatus,
} from './SaveState';
export { SkeletonState, type SkeletonStateProps, type SkeletonVariant } from './SkeletonState';
export { StreamingState, type StreamingStateProps } from './StreamingState';
