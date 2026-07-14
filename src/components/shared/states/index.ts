/**
 * Shared state components (VEGAS V7.1 systemic standard).
 *
 * Canonical empty / error / loading placeholders. Prefer these over ad-hoc
 * "Loading…" text and bespoke empty screens. See
 * docs/ui-standards/02-components/empty-loading-states.md
 */
export {
  EmptyState,
  type EmptyStateActionSpec,
  type EmptyStateProps,
  type EmptyStateVariant,
} from './EmptyState';
export { LoadingState, type LoadingStateProps, type LoadingTemplate } from './LoadingState';
