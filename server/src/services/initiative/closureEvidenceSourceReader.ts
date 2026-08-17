/**
 * FLOW-MEETING-NOTEBOOK-INITIATIVE-EVIDENCE-001 — exact-version reader for the
 * document-backed closure evidence sources.
 *
 * SCOPE, DELIBERATELY NARROW
 * --------------------------
 * This module answers exactly one question, inside a caller-supplied
 * transaction: *given an explicitly named initiative, does this source row
 * belong to it, is it in a state that qualifies as evidence, and what is the
 * exact content it holds right now?* It reads; it never writes, never decides
 * policy, and never picks an initiative. The single evidence writer remains
 * `initiativeClosureService.addEvidence`.
 *
 * WHY THE INITIATIVE IS AN INPUT AND NEVER AN INFERENCE
 * ----------------------------------------------------
 * The obvious shortcut — "the source and the initiative share a project, so
 * they belong together" — is wrong in both directions: a project holds many
 * initiatives, so a shared project proves nothing about which one a note
 * evidences, and it would silently let any note in the project be attached
 * anywhere in it. The proposer names the initiative; this module then verifies
 * organization, initiative, project agreement, source ownership and source
 * state independently. A mismatch anywhere is reported the same way.
 *
 * WHY EVERYTHING FAILS AS A UNIFORM 404
 * -------------------------------------
 * "This meeting note exists but belongs to another initiative" and "this
 * notebook page is in another tenant" are both existence disclosures. The
 * caller who is not entitled to a row learns exactly what it would learn about
 * a row that was never created.
 */
import { createHash } from 'node:crypto';

import { computeOutputHash } from '../../sharedRuntime/toolOutputs/outputLifecycle.js';
import type { PgTransactionClient } from '../../utils/queryHelpers.js';

/**
 * Sources whose content must be PINNED at attach time, in two families.
 *
 * HASH-COMPUTED — the row has no identity of its own, so this module computes a
 * canonical sha256 over the fields that constitute its content. These sources
 * stay editable after becoming eligible, which is precisely why the pin exists.
 *
 * HASH-BEARING — the row already carries a content hash produced by the system
 * that froze it. Recomputing one here would invent a second, competing identity
 * for the same artefact, so the declared hash is adopted verbatim and the
 * eligibility check is "was this actually frozen/approved", not "does my hash
 * match". These sources are append-only or superseded-not-edited by design.
 */
export type HashComputedEvidenceType = 'meeting_note' | 'meeting_follow_up' | 'notebook_page';
export type HashBearingEvidenceType = 'tool_output' | 'method_output';
export type PinnedEvidenceType = HashComputedEvidenceType | HashBearingEvidenceType;

export const PINNED_EVIDENCE_TYPES: readonly PinnedEvidenceType[] = [
  'meeting_note',
  'meeting_follow_up',
  'notebook_page',
  'tool_output',
  'method_output',
];

export function isPinnedEvidenceType(value: string): value is PinnedEvidenceType {
  return (PINNED_EVIDENCE_TYPES as readonly string[]).includes(value);
}

export interface ResolvedEvidenceSource {
  /** sha256 over the canonical content that was attached. */
  sourceHash: string;
  /** Real immutable version row id where the source has version history. */
  sourceVersionId: string | null;
  /** The source's own last-modified instant, as observed at attach time. */
  sourceCapturedAt: Date;
  /**
   * Canonical MINIMAL snapshot of exactly the bytes `sourceHash` was computed
   * over, for the computed-hash family only.
   *
   * Without it the ledger stores a hash and a reference but no content, so once
   * the source is edited or deleted nobody can verify what the hash attested
   * to — the evidence becomes an unfalsifiable claim. Hash-bearing sources keep
   * `null` here: their own tables are the system of record for their frozen
   * payload, and copying it would duplicate that record rather than protect it.
   */
  snapshot: Record<string, string | null> | null;
}

/** Outcome of a resolution attempt. `null` means "uniform 404" for every cause. */
export type SourceResolution =
  | { ok: true; source: ResolvedEvidenceSource }
  | { ok: false; reason: 'NOT_FOUND' }
  | { ok: false; reason: 'NOT_ELIGIBLE'; state: string };

/** A sha256 hex digest and nothing else. */
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Hashes the content that matters AND returns the exact object it hashed, as
 * one value.
 *
 * Returning the pair is the point: a caller cannot store a snapshot that
 * disagrees with the hash, because there is no way to obtain one without the
 * other. Keys are named explicitly rather than spreading a row, so `updated_at`
 * cannot silently enter the digest and make every attach of an untouched
 * document look like a new version.
 */
function hashContent(parts: Record<string, string | null>): {
  hash: string;
  snapshot: Record<string, string | null>;
} {
  const snapshot = Object.keys(parts)
    .sort()
    .reduce<Record<string, string | null>>((acc, k) => {
      acc[k] = parts[k] ?? null;
      return acc;
    }, {});
  const canonical = Object.keys(snapshot)
    .map((k) => `${k}\0${snapshot[k] ?? ''}`)
    .join('\x01');
  return { hash: createHash('sha256').update(canonical).digest('hex'), snapshot };
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value ?? ''));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * `meeting_notes` carries the governed minutes. Eligible state is `approved`,
 * which only `meetingBoundaryService.decideMeetingNote` sets, after a human
 * decision — this module does not re-derive or relax that rule.
 *
 * Neither organization nor project live on the note; both come from its parent
 * meeting, which is also where the project agreement with the initiative is
 * checked.
 */
async function resolveMeetingNote(
  tx: PgTransactionClient,
  orgId: string,
  initiativeId: string,
  refId: string
): Promise<SourceResolution> {
  const result = await tx.query<{
    status: string | null;
    summary: string | null;
    key_points_json: string | null;
    decisions_json: string | null;
    action_items_json: string | null;
    transcript_hash: string | null;
    updated_at: Date | string | null;
  }>(
    `SELECT n.status, n.summary, n.key_points_json, n.decisions_json,
            n.action_items_json, n.transcript_hash, n.updated_at
       FROM meeting_notes n
       JOIN meetings m
         ON m.id = n.meeting_id
        AND m.organization_id = n.organization_id
       JOIN initiatives i
         ON i.id = CAST(? AS text)
        AND i.organization_id = n.organization_id
      WHERE n.id = CAST(? AS text)
        AND n.organization_id = CAST(? AS text)
        AND m.project_id IS NOT NULL
        AND i.project_id IS NOT NULL
        AND m.project_id = i.project_id`,
    [initiativeId, refId, orgId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };

  const state = String(row.status ?? '').toLowerCase();
  if (state !== 'approved') return { ok: false, reason: 'NOT_ELIGIBLE', state: state || 'unknown' };

  const { hash, snapshot } = hashContent({
    summary: row.summary,
    keyPoints: row.key_points_json,
    decisions: row.decisions_json,
    actionItems: row.action_items_json,
    transcriptHash: row.transcript_hash,
  });
  return {
    ok: true,
    source: {
      sourceHash: hash,
      sourceVersionId: null,
      sourceCapturedAt: toDate(row.updated_at),
      snapshot,
    },
  };
}

/**
 * `meeting_follow_ups` has neither `organization_id` nor `project_id` of its
 * own — both are reached only through the parent meeting, which is why the
 * tenant guard here is a join and not a WHERE on the row itself. A follow-up
 * qualifies once it is no longer open.
 */
async function resolveMeetingFollowUp(
  tx: PgTransactionClient,
  orgId: string,
  initiativeId: string,
  refId: string
): Promise<SourceResolution> {
  const result = await tx.query<{
    status: string | null;
    title: string | null;
    owner: string | null;
    updated_at: string | null;
    meeting_id: string;
  }>(
    `SELECT f.status, f.title, f.owner, f.updated_at, f.meeting_id
       FROM meeting_follow_ups f
       JOIN meetings m
         ON m.id = f.meeting_id
        AND m.organization_id = CAST(? AS text)
       JOIN initiatives i
         ON i.id = CAST(? AS text)
        AND i.organization_id = m.organization_id
      WHERE f.id = CAST(? AS text)
        AND m.project_id IS NOT NULL
        AND i.project_id IS NOT NULL
        AND m.project_id = i.project_id`,
    [orgId, initiativeId, refId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };

  // Domain is exactly open|done (`meeting.routes.ts:242`). Matching 'done'
  // positively rather than "anything that is not open" means an unexpected
  // future state fails closed instead of silently qualifying as evidence.
  const state = String(row.status ?? 'open').toLowerCase();
  if (state !== 'done') return { ok: false, reason: 'NOT_ELIGIBLE', state };

  const { hash, snapshot } = hashContent({
    title: row.title,
    owner: row.owner,
    status: state,
    meetingId: row.meeting_id,
  });
  return {
    ok: true,
    source: {
      sourceHash: hash,
      sourceVersionId: null,
      sourceCapturedAt: toDate(row.updated_at),
      snapshot,
    },
  };
}

/**
 * `notebook_pages` is the one source with real version history
 * (`notebook_page_versions`), so its evidence pins an actual immutable version
 * row id alongside the content hash.
 *
 * Eligibility is `verification_status = 'verified'` on an active page, not
 * `maturity`. Maturity (seed → growing → mature → evergreen) describes how
 * developed a note is; verification status (unverified | verified | disputed,
 * `my-work.routes.ts:1522`) is the only field that carries an actual claim
 * about the content being checked, which is what closure evidence asserts.
 */
async function resolveNotebookPage(
  tx: PgTransactionClient,
  orgId: string,
  initiativeId: string,
  refId: string
): Promise<SourceResolution> {
  const result = await tx.query<{
    status: string | null;
    verification_status: string | null;
    title: string | null;
    content_json: string | null;
    content_text: string | null;
    updated_at: Date | string | null;
  }>(
    `SELECT p.status, p.verification_status, p.title, p.content_json, p.content_text, p.updated_at
       FROM notebook_pages p
       JOIN initiatives i
         ON i.id = CAST(? AS text)
        AND i.organization_id = p.organization_id
      WHERE p.id = CAST(? AS text)
        AND p.organization_id = CAST(? AS text)
        AND p.project_id IS NOT NULL
        AND i.project_id IS NOT NULL
        AND p.project_id = i.project_id`,
    [initiativeId, refId, orgId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };

  const status = String(row.status ?? 'active').toLowerCase();
  const verification = String(row.verification_status ?? 'unverified').toLowerCase();
  if (status !== 'active' || verification !== 'verified') {
    return { ok: false, reason: 'NOT_ELIGIBLE', state: `${status}/${verification}` };
  }

  // THE PINNED VERSION AND THE HASHED BYTES MUST BE THE SAME THING.
  //
  // The first implementation pinned the newest `notebook_page_versions.id` but
  // hashed the CURRENT `notebook_pages` content. Those are two different
  // documents the moment anyone edits the page without cutting a version, so
  // the evidence claimed "version V, hash H" where H did not describe V. Both
  // values now come from the same row, selected once.
  //
  // Ordered by created_at then id so "newest" is deterministic even when two
  // versions share a timestamp — an unordered "latest" is how a hash stops
  // being reproducible.
  const version = await tx.query<{
    id: string;
    title: string | null;
    content_json: string | null;
    content_text: string | null;
    created_at: Date | string | null;
  }>(
    `SELECT id, title, content_json, content_text, created_at
       FROM notebook_page_versions
      WHERE page_id = CAST(? AS text) AND organization_id = CAST(? AS text)
      ORDER BY created_at DESC, id DESC
      LIMIT 1`,
    [refId, orgId]
  );
  const pinned = version.rows[0];

  // No version row means there is no immutable content to point at. Pinning the
  // live page instead would be inventing a version identity the schema does not
  // have, so this fails closed: cut a version first, then attach it.
  if (!pinned) return { ok: false, reason: 'NOT_ELIGIBLE', state: 'no_immutable_version' };

  const { hash, snapshot } = hashContent({
    title: pinned.title,
    contentJson: pinned.content_json,
    contentText: pinned.content_text,
  });

  return {
    ok: true,
    source: {
      sourceHash: hash,
      sourceVersionId: pinned.id,
      // The version's own creation instant, not the page's `updated_at`: the
      // evidence describes when that content came into existence, and a later
      // page edit must not appear to move it.
      sourceCapturedAt: toDate(pinned.created_at),
      snapshot,
    },
  };
}

/**
 * WITHDRAWN CANDIDATE — `initiative_lifecycle_gate_decisions`.
 *
 * On paper it is the strongest source in the repository: a direct
 * `initiative_id`, its own regex-enforced sha256 `source_digest`, a monotonic
 * version and full database-level immutability. It is deliberately NOT offered
 * as closure evidence, for three independent reasons:
 *
 *  1. CIRCULARITY. Its `pmo_domain` includes CLOSURE, and a CLOSURE decision IS
 *     the closure authority — offering it as evidence supporting a closure
 *     request lets the request justify itself. Only the other two domains would
 *     be admissible, which reduces the source to a narrow slice of itself.
 *  2. OWNERSHIP. The table is a declared `ownerTable` of three other packages
 *     (`FLOW-TRANSFORM-MVP-001`, `INI-MVP-GATE-001`, `INI-BVP-001`). Building a
 *     dependency on its status/domain semantics while three owners are actively
 *     changing it invites a silent break.
 *  3. COST OF PROOF. A single decision row cannot exist without a
 *     transformation case and the full A05 proposal chain, and the row is
 *     immutable and UNIQUE per initiative — so a fixture cannot be corrected,
 *     only versioned, and every semantic change strands the previous rows
 *     permanently.
 *
 * Recorded here rather than silently omitted, because "the best-protected row
 * in the schema is not admissible evidence" is exactly the kind of conclusion a
 * later reader would otherwise re-derive from scratch.
 */

/**
 * `tool_outputs` is a frozen snapshot of a consulting tool: it carries its own
 * `content_hash`, a monotonic `version`, a `supersedes_id` chain and a
 * `project_id` of its own, so project agreement is a direct comparison.
 *
 * Eligibility is `frozen_at IS NOT NULL` rather than a status string. The status
 * column only distinguishes `draft` from `superseded`
 * (`toolOutputSnapshotService.ts`), so it cannot express "this was frozen";
 * `frozen_at` is the field that actually records the freeze, and a superseded
 * snapshot remains legitimate historical evidence of what was true then.
 */
async function resolveToolOutput(
  tx: PgTransactionClient,
  orgId: string,
  initiativeId: string,
  refId: string
): Promise<SourceResolution> {
  const result = await tx.query<{
    content_hash: string | null;
    frozen_at: Date | string | null;
    id: string;
    tool_type: string | null;
    method_pack_version: string | null;
    payload_json: unknown;
  }>(
    `SELECT o.id, o.content_hash, o.frozen_at, o.tool_type, o.method_pack_version, o.payload_json
       FROM tool_outputs o
       JOIN initiatives i
         ON i.id = CAST(? AS text)
        AND i.organization_id = o.organization_id
      WHERE o.id = CAST(? AS text)
        AND o.organization_id = CAST(? AS text)
        AND o.project_id IS NOT NULL
        AND i.project_id IS NOT NULL
        AND o.project_id = i.project_id`,
    [initiativeId, refId, orgId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };

  if (!row.frozen_at) return { ok: false, reason: 'NOT_ELIGIBLE', state: 'not_frozen' };

  // WHAT `tool_outputs.content_hash` ACTUALLY IS.
  //
  // This source was first classified as "hash-bearing", i.e. carrying its own
  // frozen cryptographic identity that the ledger could simply cite. It does
  // not. `computeOutputHash` is FNV-1a over 64 BITS — sixteen hex characters,
  // documented in `sharedRuntime/toolOutputs/contentHash.ts` as non-cryptographic
  // and intended for change detection. Requiring a sha256 shape here therefore
  // rejected every genuine tool output, which is how the misclassification
  // surfaced: the only fixtures that had ever passed carried an invented
  // 64-character string next to a payload that did not produce it.
  //
  // So tool_output belongs to the COMPUTED-hash family, not the hash-bearing
  // one. The producer's digest is still checked — it must agree with the stored
  // payload — but it is used as what it is, a change detector, and the identity
  // written into the ledger is a sha256 this function computes over a snapshot
  // it also stores. A 64-bit digest has roughly a one-in-four-billion collision
  // point; that is fine for noticing an edit and not something to hang the
  // record of why an initiative was closed on.
  const declared = String(row.content_hash ?? '').trim();
  if (!declared) {
    return { ok: false, reason: 'NOT_ELIGIBLE', state: 'content_hash_missing' };
  }

  // INDEPENDENT VERIFICATION — MANDATORY, never conditional.
  //
  // The first version recomputed only when items/tensions/conclusions all
  // happened to be arrays, and otherwise accepted the declared hash because it
  // "looked like a sha256". There is no fallback now: a payload that cannot be
  // verified is not evidence, whatever it has written next to it.
  const payload = row.payload_json;
  const toolType = String(row.tool_type ?? '').trim();
  const packVersion = String(row.method_pack_version ?? '').trim();

  if (!toolType || !packVersion) {
    return { ok: false, reason: 'NOT_ELIGIBLE', state: 'tool_output_identity_incomplete' };
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'NOT_ELIGIBLE', state: 'payload_not_an_object' };
  }

  const p = payload as Record<string, unknown>;
  const missing = (['items', 'tensions', 'conclusions'] as const).filter(
    (k) => !Array.isArray(p[k])
  );
  if (missing.length > 0) {
    // Named individually so a malformed payload is diagnosable rather than a
    // blanket "not eligible".
    return {
      ok: false,
      reason: 'NOT_ELIGIBLE',
      state: `payload_missing_or_malformed:${missing.join('+')}`,
    };
  }

  const recomputed = computeOutputHash({
    toolType,
    methodPackVersion: packVersion,
    items: p.items,
    tensions: p.tensions,
    conclusions: p.conclusions,
  } as Parameters<typeof computeOutputHash>[0]);

  if (recomputed !== declared) {
    // A stored digest that disagrees with the stored payload means one of them
    // was tampered with, and neither can be trusted as evidence.
    return { ok: false, reason: 'NOT_ELIGIBLE', state: 'content_hash_mismatch' };
  }

  // The ledger's own identity: sha256 over the same fields, stored alongside the
  // snapshot that produced it, so the attachment stays verifiable even after the
  // tool output is superseded or deleted.
  const { hash, snapshot } = hashContent({
    toolType,
    methodPackVersion: packVersion,
    producerDigest: declared,
    items: JSON.stringify(p.items),
    tensions: JSON.stringify(p.tensions),
    conclusions: JSON.stringify(p.conclusions),
  });

  return {
    ok: true,
    source: {
      sourceHash: hash,
      sourceVersionId: row.id,
      sourceCapturedAt: toDate(row.frozen_at),
      snapshot,
    },
  };
}

async function resolveMethodOutput(
  tx: PgTransactionClient,
  orgId: string,
  initiativeId: string,
  refId: string
): Promise<SourceResolution> {
  const result = await tx.query<{
    content_hash: string | null;
    frozen_at: Date | string | null;
    id: string;
  }>(
    `SELECT o.id, o.content_hash, o.frozen_at
       FROM method_outputs o
       JOIN method_sessions s
         ON s.id = o.session_id
        AND s.organization_id = o.organization_id
       JOIN initiatives i
         ON i.id = CAST(? AS text)
        AND i.organization_id = o.organization_id
      WHERE o.id = CAST(? AS text)
        AND o.organization_id = CAST(? AS text)
        AND s.project_id IS NOT NULL
        AND i.project_id IS NOT NULL
        AND s.project_id = i.project_id`,
    [initiativeId, refId, orgId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: 'NOT_FOUND' };

  // Defensive only, and deliberately kept: `method_outputs.frozen_at` and
  // `content_hash` are both NOT NULL (frozen_at additionally defaults to
  // CURRENT_TIMESTAMP), so every row is frozen and hashed by construction and
  // neither branch can fire against the current schema. That is precisely why
  // this source qualifies — it has no draft state to attach by mistake — and
  // the guards stay so a future nullable column cannot quietly produce evidence
  // with no identity. Asserted in the suite, not assumed.
  if (!row.frozen_at) return { ok: false, reason: 'NOT_ELIGIBLE', state: 'not_frozen' };

  // A declared hash is only evidence if it is actually a hash. Any other
  // non-empty string is a claim, and accepting claims is what this ledger
  // exists to stop.
  const declared = String(row.content_hash ?? '');
  if (!SHA256_HEX.test(declared)) {
    return { ok: false, reason: 'NOT_ELIGIBLE', state: 'content_hash_not_sha256' };
  }


  // NOT independently recomputed, and this is a limitation worth naming rather
  // than papering over. `method_outputs.content_hash` is produced by
  // `MethodOutputService` over `buildHashableOutputContent`, whose input
  // includes the session's FINDINGS — rows in a separate table — plus
  // producer-specific sorting and score rounding. Recomputing it here would mean
  // reimplementing that assembly, i.e. a second definition of the same truth
  // that drifts the moment the producer changes. Format is enforced above;
  // content verification belongs to the producing service.

  return {
    ok: true,
    source: {
      sourceHash: declared,
      sourceVersionId: row.id,
      sourceCapturedAt: toDate(row.frozen_at),
      snapshot: null,
    },
  };
}

/**
 * Resolves any pinned evidence source. Every query is parameterised on the
 * EXPLICIT `initiativeId` supplied by the proposer and on the organization taken
 * from the authenticated session — never from the request body.
 */
export async function resolvePinnedEvidenceSource(
  tx: PgTransactionClient,
  evidenceType: PinnedEvidenceType,
  orgId: string,
  initiativeId: string,
  evidenceRefId: string
): Promise<SourceResolution> {
  switch (evidenceType) {
    case 'meeting_note':
      return resolveMeetingNote(tx, orgId, initiativeId, evidenceRefId);
    case 'meeting_follow_up':
      return resolveMeetingFollowUp(tx, orgId, initiativeId, evidenceRefId);
    case 'notebook_page':
      return resolveNotebookPage(tx, orgId, initiativeId, evidenceRefId);
    case 'tool_output':
      return resolveToolOutput(tx, orgId, initiativeId, evidenceRefId);
    case 'method_output':
      return resolveMethodOutput(tx, orgId, initiativeId, evidenceRefId);
  }
}
