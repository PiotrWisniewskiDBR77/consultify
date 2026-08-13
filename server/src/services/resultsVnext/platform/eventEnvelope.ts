/**
 * RN-G1 Platform Foundation — event envelope type.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §A.1.
 * Mirrors `rvn_platform_events` (see
 * server/migrations/20260809_rvn_platform_events_outbox.sql) column-for-column.
 * TS fields are camelCase; the trailing comment on each field is the exact
 * snake_case DB column it maps to. This type is the envelope shape a caller
 * builds before the atomic-write helper (design §A.4, NOT_IMPLEMENTED here —
 * see README.md) inserts it.
 */

import type { RvnResourceType } from './resourceTypes.js';

export interface PlatformEventEnvelope {
  /** event_id — UUID PK, DB-generated (gen_random_uuid()) on insert. */
  eventId: string;
  /** sequence — BIGINT identity, DB-generated; global replay order (§A.6). */
  sequence: number;
  /** schema_version — SMALLINT, defaults to 1. */
  schemaVersion: number;
  /** event_type */
  eventType: string;
  /**
   * aggregate_type — MUST be a value from RVN_RESOURCE_TYPES (resourceTypes.ts,
   * the SSOT per §C.3). No DB CHECK constraint enforces this (see the
   * migration's header comment) — validation is the caller's responsibility.
   */
  aggregateType: RvnResourceType;
  /** aggregate_id */
  aggregateId: string;
  /** organization_id */
  organizationId: string;
  /** actor_user_id — nullable (system-originated events). */
  actorUserId: string | null;
  /** actor_effective_role */
  actorEffectiveRole: string;
  /** command_id — UUID, correlates the command that produced this event. */
  commandId: string;
  /** correlation_id — UUID, correlates a whole business flow. */
  correlationId: string;
  /** causation_id — UUID, nullable; the event/command that directly caused this one. */
  causationId: string | null;
  /** occurred_at — ISO 8601 timestamp; when the business fact happened. */
  occurredAt: string;
  /** recorded_at — ISO 8601 timestamp; when this row was written. */
  recordedAt: string;
  /** policy_version — visibility/ABAC policy version in effect at write time. */
  policyVersion: string;
  /** before_state — JSONB, nullable. */
  beforeState: Record<string, unknown> | null;
  /** after_state — JSONB, nullable. */
  afterState: Record<string, unknown> | null;
  /** state_hash — integrity hash of after_state (or before+after), not null. */
  stateHash: string;
  /** reason — nullable free-text rationale. */
  reason: string | null;
  /** evidence_refs — JSONB array, defaults to []. */
  evidenceRefs: unknown[];
  /** source — origin system/surface of the write. */
  source: string;
  /** idempotency_key — unique per (organization_id, idempotency_key). */
  idempotencyKey: string;
  /** expected_version — nullable; optimistic-concurrency precondition. */
  expectedVersion: number | null;
  /** resulting_version — not null; the aggregate version after this event. */
  resultingVersion: number;
  /** payload — JSONB, defaults to {}. */
  payload: Record<string, unknown>;
}
