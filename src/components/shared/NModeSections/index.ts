/**
 * NModeSections — Reusable canvas section components for N-mode detail views
 *
 * These are GENERIC sections that can be used in any artifact detail view
 * (Decision, Task, Notification, Initiative, etc.).
 *
 * Each component follows the N BLOCKS KIT design language:
 * flat, quiet UI with typography + whitespace, NOT frames.
 *
 * Usage:
 * ```tsx
 * import { ActivityLogCanvas, CommentsCanvas, AttachmentsLinksCanvas } from '@/components/shared/NModeSections';
 * ```
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5.3
 */

// ── Generic canvas sections ─────────────────────────────────────────────────

export type { ActivityLogEntry, ActivityStats, ActivityTypeMeta } from './ActivityLogCanvas';
export { ActivityLogCanvas } from './ActivityLogCanvas';
export { AttachmentsLinksCanvas } from './AttachmentsLinksCanvas';
export type { CommentItem, CommentPriority, DateFilter, SortOrder } from './CommentsCanvas';
export { CommentsCanvas } from './CommentsCanvas';
export type {
  CoreDeliveryChannel,
  DeliveryConfig,
  EscalationMode,
  EscalationRuleWithConfig,
  GovernanceCanvasProps,
  GovernanceUser,
  IntegrationChannel,
  ReminderRuleWithDelivery,
} from './GovernanceCanvas';
export { GovernanceCanvas } from './GovernanceCanvas';
export type {
  RaidItem as NModeRaidItem,
  RaidCanvasProps,
  RaidLevel,
  RaidStatus,
  RaidType,
  RaidTypeFilter,
  RiskResponseStrategy,
} from './RaidCanvas';
export { getRaidScore, RaidCanvas } from './RaidCanvas';
export type {
  RiskItem as NModeRiskItem,
  RiskCanvasProps,
  RiskCategory,
  RiskLevel,
} from './RiskCanvas';
export { getRiskScore, RiskCanvas } from './RiskCanvas';
