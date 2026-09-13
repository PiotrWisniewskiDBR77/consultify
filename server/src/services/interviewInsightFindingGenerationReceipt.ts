import { createHash } from 'node:crypto';

export const FINDING_GENERATION_RECEIPT_VERSION = 1 as const;
export const FINDING_GENERATION_RECEIPT_TYPE = 'finding_generation_binding' as const;
export const FINDING_GENERATION_RECEIPT_ENTITY_TYPE = 'finding_generation_receipt' as const;
export const FINDING_GENERATION_RECEIPT_ACTION = 'finding_generation_bound_v1' as const;
export const FINDING_GENERATION_INVALIDATION_ACTION = 'finding_generation_invalidated_v1' as const;

type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface FindingGenerationSnapshotFinding {
  id: string;
  organization_id: string;
  insight_id: string;
  source_section_type: string;
  source_section_index?: number | null;
  source_key?: string | null;
  finding_statement: string;
  confidence_level: string;
  limits_text: string;
  limits_json: string;
  next_action_text: string;
  next_action_json: string;
  created_by?: string | null;
  created_at: string | Date;
}

export interface FindingGenerationSnapshotPointer {
  id: string;
  organization_id: string;
  insight_id: string;
  finding_id: string;
  pointer_type: string;
  source_ref: string;
  source_fingerprint: string;
  captured_excerpt?: string | null;
  captured_at: string | Date;
  pointer_state: string;
  removal_reason?: string | null;
  removed_at?: string | Date | null;
  duplicate_observed_count: number;
  metadata_json: string;
  created_by?: string | null;
  created_at: string | Date;
}

export interface FindingGenerationSnapshotInput {
  finding: FindingGenerationSnapshotFinding;
  pointers: FindingGenerationSnapshotPointer[];
}

export interface FindingGenerationReceiptPayload {
  version: typeof FINDING_GENERATION_RECEIPT_VERSION;
  receiptType: typeof FINDING_GENERATION_RECEIPT_TYPE;
  organizationId: string;
  insightId: string;
  findingId: string;
  generationRunId: string;
  generationStartedAt: string;
  generationCompletedAt: string;
  generationContextSha256: string;
  findingCreatedAt: string;
  findingSnapshotSha256: string;
}

export interface FindingGenerationReceiptRow {
  id: string;
  organization_id: string;
  insight_id: string;
  finding_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  detail_json: string;
  created_at: string | Date;
}

export interface CurrentInsightGenerationRow {
  id: string;
  organization_id: string;
  status: string;
  error_message?: string | null;
  generation_context_json: string;
  updated_at: string | Date;
}

export type FindingGenerationReceiptValidationReason =
  | 'receipt_count'
  | 'receipt_malformed'
  | 'receipt_identity_mismatch'
  | 'foreign_identity'
  | 'generation_not_current_completed'
  | 'generation_run_mismatch'
  | 'generation_context_mismatch'
  | 'finding_snapshot_mismatch'
  | 'time_invalid'
  | 'time_mismatch'
  | 'receipt_after_cutoff';

export type FindingGenerationReceiptValidation =
  | {
      valid: true;
      receiptId: string;
      generationRunId: string;
      payload: FindingGenerationReceiptPayload;
    }
  | { valid: false; reason: FindingGenerationReceiptValidationReason };

export interface ValidateFindingGenerationReceiptInput extends FindingGenerationSnapshotInput {
  insight: CurrentInsightGenerationRow;
  receipts: FindingGenerationReceiptRow[];
  handoffCutoff?: string | Date;
}

export interface CreateFindingGenerationReceiptPayloadInput extends FindingGenerationSnapshotInput {
  organizationId: string;
  insightId: string;
  findingId: string;
  generationRunId: string;
  generationStartedAt: string | Date;
  generationCompletedAt: string | Date;
  generationContextJson: string;
}

const ISO_WITH_ZONE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|([+-])(\d{2}):(\d{2}))$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be a string or null`);
  return value;
}

function canonicalUtcTimestamp(value: unknown, label: string): string {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error(`${label} must be a valid timestamp`);
    return value.toISOString();
  }
  if (typeof value !== 'string') {
    throw new Error(`${label} must be an ISO timestamp with an explicit timezone`);
  }
  const match = ISO_WITH_ZONE.exec(value);
  if (!match) {
    throw new Error(`${label} must be an ISO timestamp with an explicit timezone`);
  }
  const [, year, month, day, hour, minute, second, , offsetHour = '00', offsetMinute = '00'] =
    match;
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysInMonth =
    monthNumber >= 1 && monthNumber <= 12
      ? new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate()
      : 0;
  if (
    dayNumber < 1 ||
    dayNumber > daysInMonth ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59 ||
    Number(offsetHour) > 23 ||
    Number(offsetMinute) > 59
  ) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`${label} must be a valid timestamp`);
  return new Date(millis).toISOString();
}

function jsonSafe(value: unknown, path: string, seen: WeakSet<object>): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain only finite JSON numbers`);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') {
    throw new Error(`${path} must contain only JSON-safe values`);
  }
  if (seen.has(value)) throw new Error(`${path} must not contain circular JSON values`);
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => jsonSafe(item, `${path}[${index}]`, seen));
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} must contain only plain JSON objects`);
    }
    const source = value as Record<string, unknown>;
    // A normal object would invoke Object.prototype.__proto__'s setter for a
    // valid JSON own key named "__proto__", silently dropping evidence from
    // the canonical value and its hash.
    const result = Object.create(null) as Record<string, JsonValue>;
    for (const key of Object.keys(source).sort()) {
      result[key] = jsonSafe(source[key], `${path}.${key}`, seen);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(jsonSafe(value, 'value', new WeakSet<object>()));
}

export function hashCanonicalJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** Hashes the exact TEXT bytes used by the generation CAS, not a parsed/reordered equivalent. */
export function hashGenerationContextJson(value: string): string {
  if (typeof value !== 'string') throw new Error('generationContextJson must be a string');
  JSON.parse(value);
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function parseJsonColumn(value: unknown, label: string): JsonValue {
  if (typeof value !== 'string') throw new Error(`${label} must be persisted JSON text`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${label} must contain valid JSON`);
  }
  return jsonSafe(parsed, label, new WeakSet<object>());
}

function assertSnapshotIdentity(input: FindingGenerationSnapshotInput): void {
  const { finding, pointers } = input;
  requiredText(finding.id, 'finding.id');
  requiredText(finding.organization_id, 'finding.organization_id');
  requiredText(finding.insight_id, 'finding.insight_id');
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const pointer of pointers) {
    requiredText(pointer.id, 'pointer.id');
    if (
      pointer.organization_id !== finding.organization_id ||
      pointer.insight_id !== finding.insight_id ||
      pointer.finding_id !== finding.id
    ) {
      throw new Error('pointer identity must match its Finding');
    }
    if (ids.has(pointer.id)) throw new Error(`duplicate pointer id: ${pointer.id}`);
    ids.add(pointer.id);
    const sourceIdentity = `${pointer.source_ref}\u0000${pointer.source_fingerprint}`;
    if (sources.has(sourceIdentity)) {
      throw new Error('duplicate pointer source_ref/source_fingerprint identity');
    }
    sources.add(sourceIdentity);
  }
}

export function buildFindingGenerationSnapshot(input: FindingGenerationSnapshotInput): JsonValue {
  assertSnapshotIdentity(input);
  const { finding } = input;
  const sourceSectionIndex = finding.source_section_index ?? null;
  if (sourceSectionIndex !== null && !Number.isInteger(sourceSectionIndex)) {
    throw new Error('finding.source_section_index must be an integer or null');
  }

  const pointers = input.pointers
    .map((pointer) => {
      if (
        !Number.isInteger(pointer.duplicate_observed_count) ||
        pointer.duplicate_observed_count < 0
      ) {
        throw new Error('pointer.duplicate_observed_count must be a non-negative integer');
      }
      return {
        pointerId: requiredText(pointer.id, 'pointer.id'),
        organizationId: requiredText(pointer.organization_id, 'pointer.organization_id'),
        insightId: requiredText(pointer.insight_id, 'pointer.insight_id'),
        findingId: requiredText(pointer.finding_id, 'pointer.finding_id'),
        pointerType: requiredText(pointer.pointer_type, 'pointer.pointer_type'),
        sourceRef: requiredText(pointer.source_ref, 'pointer.source_ref'),
        sourceFingerprint: requiredText(pointer.source_fingerprint, 'pointer.source_fingerprint'),
        capturedExcerpt: optionalText(pointer.captured_excerpt, 'pointer.captured_excerpt'),
        capturedAt: canonicalUtcTimestamp(pointer.captured_at, 'pointer.captured_at'),
        pointerState: requiredText(pointer.pointer_state, 'pointer.pointer_state'),
        removalReason: optionalText(pointer.removal_reason, 'pointer.removal_reason'),
        removedAt:
          pointer.removed_at === null || pointer.removed_at === undefined
            ? null
            : canonicalUtcTimestamp(pointer.removed_at, 'pointer.removed_at'),
        duplicateObservedCount: pointer.duplicate_observed_count,
        metadata: parseJsonColumn(pointer.metadata_json, 'pointer.metadata_json'),
        createdBy: optionalText(pointer.created_by, 'pointer.created_by'),
        createdAt: canonicalUtcTimestamp(pointer.created_at, 'pointer.created_at'),
      };
    })
    // Relational string comparison follows ECMAScript UTF-16 code-unit order
    // and is independent of the host's locale/ICU configuration.
    .sort((left, right) =>
      left.pointerId < right.pointerId ? -1 : left.pointerId > right.pointerId ? 1 : 0
    );

  return jsonSafe(
    {
      version: 1,
      finding: {
        findingId: requiredText(finding.id, 'finding.id'),
        organizationId: requiredText(finding.organization_id, 'finding.organization_id'),
        insightId: requiredText(finding.insight_id, 'finding.insight_id'),
        sourceSectionType: requiredText(finding.source_section_type, 'finding.source_section_type'),
        sourceSectionIndex,
        sourceKey: optionalText(finding.source_key, 'finding.source_key'),
        findingStatement: requiredText(finding.finding_statement, 'finding.finding_statement'),
        confidenceLevel: requiredText(finding.confidence_level, 'finding.confidence_level'),
        limitsText: requiredText(finding.limits_text, 'finding.limits_text'),
        limits: parseJsonColumn(finding.limits_json, 'finding.limits_json'),
        nextActionText: requiredText(finding.next_action_text, 'finding.next_action_text'),
        nextAction: parseJsonColumn(finding.next_action_json, 'finding.next_action_json'),
        createdBy: optionalText(finding.created_by, 'finding.created_by'),
        createdAt: canonicalUtcTimestamp(finding.created_at, 'finding.created_at'),
      },
      pointers,
    },
    'snapshot',
    new WeakSet<object>()
  );
}

export function hashFindingGenerationSnapshot(input: FindingGenerationSnapshotInput): string {
  return hashCanonicalJson(buildFindingGenerationSnapshot(input));
}

interface ParsedGenerationRun {
  runId: string;
  startedAt: string;
  completedAt: string;
}

function ownObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseCompletedGenerationContext(contextJson: string): ParsedGenerationRun {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contextJson);
  } catch {
    throw new Error('generation context must contain valid JSON');
  }
  const context = ownObject(parsed);
  const generationRun = ownObject(context?.generationRun);
  if (
    !context ||
    !generationRun ||
    generationRun.version !== 1 ||
    generationRun.status !== 'completed'
  ) {
    throw new Error('generation context must contain a completed v1 run');
  }
  const runId = requiredText(generationRun.runId, 'generationRun.runId');
  const startedAt = canonicalUtcTimestamp(generationRun.startedAt, 'generationRun.startedAt');
  const completedAt = canonicalUtcTimestamp(generationRun.completedAt, 'generationRun.completedAt');
  const contextCreatedAt = canonicalUtcTimestamp(context.createdAt, 'generationContext.createdAt');
  if (contextCreatedAt !== startedAt || Date.parse(startedAt) > Date.parse(completedAt)) {
    throw new Error('generation run timestamps are inconsistent');
  }
  return { runId, startedAt, completedAt };
}

export function createFindingGenerationReceiptPayload(
  input: CreateFindingGenerationReceiptPayloadInput
): FindingGenerationReceiptPayload {
  const organizationId = requiredText(input.organizationId, 'organizationId');
  const insightId = requiredText(input.insightId, 'insightId');
  const findingId = requiredText(input.findingId, 'findingId');
  const generationRunId = requiredText(input.generationRunId, 'generationRunId');
  if (
    input.finding.organization_id !== organizationId ||
    input.finding.insight_id !== insightId ||
    input.finding.id !== findingId
  ) {
    throw new Error('receipt identity must match its Finding');
  }
  const run = parseCompletedGenerationContext(input.generationContextJson);
  const generationStartedAt = canonicalUtcTimestamp(
    input.generationStartedAt,
    'generationStartedAt'
  );
  const generationCompletedAt = canonicalUtcTimestamp(
    input.generationCompletedAt,
    'generationCompletedAt'
  );
  if (
    run.runId !== generationRunId ||
    run.startedAt !== generationStartedAt ||
    run.completedAt !== generationCompletedAt
  ) {
    throw new Error('receipt run identity must match the persisted generation context');
  }
  const findingCreatedAt = canonicalUtcTimestamp(input.finding.created_at, 'finding.created_at');
  if (Date.parse(generationCompletedAt) > Date.parse(findingCreatedAt)) {
    throw new Error('Finding cannot predate generation completion');
  }
  return {
    version: FINDING_GENERATION_RECEIPT_VERSION,
    receiptType: FINDING_GENERATION_RECEIPT_TYPE,
    organizationId,
    insightId,
    findingId,
    generationRunId,
    generationStartedAt,
    generationCompletedAt,
    generationContextSha256: hashGenerationContextJson(input.generationContextJson),
    findingCreatedAt,
    findingSnapshotSha256: hashFindingGenerationSnapshot(input),
  };
}

export function findingGenerationReceiptId(findingId: string): string {
  return `finding-generation-v1:${requiredText(findingId, 'findingId')}`;
}

export function findingGenerationInvalidationId(findingId: string): string {
  return `finding-generation-invalidated-v1:${requiredText(findingId, 'findingId')}`;
}

const RECEIPT_KEYS = [
  'version',
  'receiptType',
  'organizationId',
  'insightId',
  'findingId',
  'generationRunId',
  'generationStartedAt',
  'generationCompletedAt',
  'generationContextSha256',
  'findingCreatedAt',
  'findingSnapshotSha256',
] as const;

function parseReceiptPayload(value: string): FindingGenerationReceiptPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const object = ownObject(parsed);
  if (
    !object ||
    Object.keys(object).sort().join('\u0000') !== [...RECEIPT_KEYS].sort().join('\u0000')
  ) {
    return null;
  }
  if (
    object.version !== FINDING_GENERATION_RECEIPT_VERSION ||
    object.receiptType !== FINDING_GENERATION_RECEIPT_TYPE
  ) {
    return null;
  }
  for (const key of [
    'organizationId',
    'insightId',
    'findingId',
    'generationRunId',
    'generationStartedAt',
    'generationCompletedAt',
    'generationContextSha256',
    'findingCreatedAt',
    'findingSnapshotSha256',
  ] as const) {
    if (typeof object[key] !== 'string' || object[key].length === 0) return null;
  }
  if (
    !SHA256_HEX.test(object.generationContextSha256 as string) ||
    !SHA256_HEX.test(object.findingSnapshotSha256 as string)
  ) {
    return null;
  }
  try {
    canonicalUtcTimestamp(object.generationStartedAt, 'generationStartedAt');
    canonicalUtcTimestamp(object.generationCompletedAt, 'generationCompletedAt');
    canonicalUtcTimestamp(object.findingCreatedAt, 'findingCreatedAt');
  } catch {
    return null;
  }
  return object as unknown as FindingGenerationReceiptPayload;
}

const invalid = (
  reason: FindingGenerationReceiptValidationReason
): FindingGenerationReceiptValidation => ({ valid: false, reason });

export function validateFindingGenerationReceipt(
  input: ValidateFindingGenerationReceiptInput
): FindingGenerationReceiptValidation {
  if (!Array.isArray(input.receipts) || input.receipts.length !== 1) {
    return invalid('receipt_count');
  }
  const receipt = input.receipts[0];
  if (typeof receipt.detail_json !== 'string') return invalid('receipt_malformed');
  const payload = parseReceiptPayload(receipt.detail_json);
  if (!payload) return invalid('receipt_malformed');

  const expectedReceiptId = findingGenerationReceiptId(input.finding.id);
  if (
    receipt.id !== expectedReceiptId ||
    receipt.entity_type !== FINDING_GENERATION_RECEIPT_ENTITY_TYPE ||
    receipt.entity_id !== input.finding.id ||
    receipt.action !== FINDING_GENERATION_RECEIPT_ACTION
  ) {
    return invalid('receipt_identity_mismatch');
  }
  if (
    input.finding.organization_id !== input.insight.organization_id ||
    input.finding.insight_id !== input.insight.id ||
    receipt.organization_id !== input.insight.organization_id ||
    receipt.insight_id !== input.insight.id ||
    receipt.finding_id !== input.finding.id ||
    payload.organizationId !== input.insight.organization_id ||
    payload.insightId !== input.insight.id ||
    payload.findingId !== input.finding.id ||
    input.pointers.some(
      (pointer) =>
        pointer.organization_id !== input.insight.organization_id ||
        pointer.insight_id !== input.insight.id ||
        pointer.finding_id !== input.finding.id
    )
  ) {
    return invalid('foreign_identity');
  }
  if (
    input.insight.status !== 'completed' ||
    (typeof input.insight.error_message === 'string' && input.insight.error_message.trim() !== '')
  ) {
    return invalid('generation_not_current_completed');
  }

  let currentRun: ParsedGenerationRun;
  try {
    currentRun = parseCompletedGenerationContext(input.insight.generation_context_json);
  } catch (error) {
    return /timestamp|time/i.test(error instanceof Error ? error.message : '')
      ? invalid('time_invalid')
      : invalid('generation_not_current_completed');
  }
  if (
    currentRun.runId !== payload.generationRunId ||
    currentRun.startedAt !== payload.generationStartedAt ||
    currentRun.completedAt !== payload.generationCompletedAt
  ) {
    return invalid('generation_run_mismatch');
  }
  if (
    hashGenerationContextJson(input.insight.generation_context_json) !==
    payload.generationContextSha256
  ) {
    return invalid('generation_context_mismatch');
  }

  let insightUpdatedAt: string;
  let findingCreatedAt: string;
  let receiptCreatedAt: string;
  let cutoff: string | null = null;
  try {
    insightUpdatedAt = canonicalUtcTimestamp(input.insight.updated_at, 'insight.updated_at');
    findingCreatedAt = canonicalUtcTimestamp(input.finding.created_at, 'finding.created_at');
    receiptCreatedAt = canonicalUtcTimestamp(receipt.created_at, 'receipt.created_at');
    cutoff =
      input.handoffCutoff === undefined
        ? null
        : canonicalUtcTimestamp(input.handoffCutoff, 'handoffCutoff');
  } catch {
    return invalid('time_invalid');
  }
  if (insightUpdatedAt !== currentRun.completedAt) {
    return invalid('generation_not_current_completed');
  }
  if (
    Date.parse(currentRun.startedAt) > Date.parse(currentRun.completedAt) ||
    Date.parse(currentRun.completedAt) > Date.parse(findingCreatedAt)
  ) {
    return invalid('time_invalid');
  }
  if (payload.findingCreatedAt !== findingCreatedAt || receiptCreatedAt !== findingCreatedAt) {
    return invalid('time_mismatch');
  }
  if (cutoff !== null && Date.parse(receiptCreatedAt) > Date.parse(cutoff)) {
    return invalid('receipt_after_cutoff');
  }

  let snapshotHash: string;
  try {
    snapshotHash = hashFindingGenerationSnapshot({
      finding: input.finding,
      pointers: input.pointers,
    });
  } catch (error) {
    return /identity|duplicate pointer/i.test(error instanceof Error ? error.message : '')
      ? invalid('foreign_identity')
      : invalid('finding_snapshot_mismatch');
  }
  if (snapshotHash !== payload.findingSnapshotSha256) {
    return invalid('finding_snapshot_mismatch');
  }
  return {
    valid: true,
    receiptId: receipt.id,
    generationRunId: payload.generationRunId,
    payload,
  };
}
