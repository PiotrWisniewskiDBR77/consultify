/**
 * Supersession — ASSESSMENT_OUTPUT_AND_PROVENANCE_CONTRACT.md §6:
 * "Reopen nie modyfikuje starego Outputu. Nowy freeze tworzy nową wersję, a
 * wcześniejsze Deliverables/Drafts dostają status `superseded/source
 * updated`, bez cichego przepisania treści."
 *
 * `markRecordSuperseded` never touches `content` — it returns a NEW wrapper
 * object that keeps the exact same `content` reference and only changes the
 * status/pointer fields. In the server repository this maps to a
 * single-column `UPDATE ... SET status = ?` that never touches the content
 * columns (see server/src/method-core/outputs/MethodReportSnapshotService.ts
 * and MethodInitiativeDraftService.ts).
 */

import type { DeliverableRecord, SupersedenceStatus } from './types';

export function wrapAsCurrent<T>(content: T): DeliverableRecord<T> {
  return {
    content,
    status: 'current',
    supersededAt: null,
    supersededByOutputId: null,
  };
}

/**
 * Returns a NEW record with the same `content` reference (bit-for-bit
 * unchanged — verified in tests via `===` identity, not deep-equality) and
 * an updated status. The input record is not mutated.
 */
export function markRecordSuperseded<T>(
  record: DeliverableRecord<T>,
  reason: Extract<SupersedenceStatus, 'superseded' | 'source_updated'>,
  supersededByOutputId: string,
  supersededAt: string
): DeliverableRecord<T> {
  return {
    content: record.content,
    status: reason,
    supersededAt,
    supersededByOutputId,
  };
}
