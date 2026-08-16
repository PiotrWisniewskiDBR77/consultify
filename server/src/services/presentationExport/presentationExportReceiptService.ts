/**
 * Lane C (closure) — presentation-specific wiring on top of the governed
 * export-receipt spine (`../artifactHandoff/handoffSpineService.ts`).
 *
 * WHY THIS FILE EXISTS: `presentations.routes.ts` has THREE export paths
 * (PPTX download, PDF export, PNG/zip export) that each independently wrote
 * only to `presentation_export_records` — a table with NO output hash and NO
 * idempotency key (see `MAT-MVP-PPT-001` brief / this repo's
 * `20260912_claude_c_handoff_spine.sql` header, gap "Materials export").
 * Every export retried by a client (network blip, double-click) produced a
 * SECOND row with no way to tell it apart from a genuinely new export.
 *
 * This module does NOT reinvent that guarantee — it derives the
 * presentation-specific inputs (deck content hash, deck version, a stable
 * idempotency key, the real engine's `provider_key`) and calls straight
 * through to the ALREADY-BUILT, ALREADY-TESTED spine functions
 * (`recordExportReceipt` / `completeExportReceipt` / `failExportReceipt` /
 * `markExportUnavailable`). All concurrency-safety (the unique index on
 * `(organization_id, idempotency_key)`, the DB check constraint that makes a
 * false 'succeeded' status structurally impossible) lives there — see
 * `handoffSpineService.ts` for that reasoning; nothing here needs to repeat
 * it.
 *
 * ── Idempotency key design ──────────────────────────────────────────────
 * A caller MAY send an `Idempotency-Key` header (the established pattern —
 * see `document-studio.routes.ts`'s `idempotency-key` header reads). When it
 * does, the key is scoped to `presentation:<deckId>:<format>:req:<key>` so
 * the same header value used for a different deck or format can never
 * collide with this one.
 *
 * When the caller sends NO header (the common case — a plain "Download"
 * click), the key defaults to `presentation:<deckId>:<format>:v<version>`.
 * That is a DELIBERATE choice, not an oversight: an export is a
 * deterministic function of (deck content at a pinned version, format) — two
 * requests for the SAME already-rendered version produce byte-identical
 * output, so they collapse into exactly ONE governed receipt rather than
 * minting a new "distinct export event" every time a user re-downloads the
 * same unchanged deck. A later edit bumps `presentation_decks.version`,
 * which changes the derived key and therefore starts a fresh receipt for the
 * new content — the dedup window is per-version, not global.
 */
import { createHash } from 'crypto';

import {
  canonicalSourceHash,
  completeExportReceipt,
  type ExportReceipt,
  failExportReceipt,
  markExportUnavailable,
  recordExportReceipt,
} from '../artifactHandoff/handoffSpineService.js';

export type PresentationExportFormat = 'pptx' | 'pdf' | 'png';

/**
 * Real engine confirmed installed + MIT for each format (per the P00
 * inventory in the worker brief): pptxgenjs 4.0.1 for PPTX, pdfkit 0.17.2
 * for PDF. PNG export is NOT a visual render of the deck either — it
 * rasterizes a hand-built SVG card per slide via `sharp`, a materially
 * different pipeline from PPTX/PDF's shared layout engine. Recording the
 * true engine key here (rather than a generic 'native' label) is what makes
 * that difference visible in the data, per finding #4 of the brief — no
 * code change to unify the renderers is in scope here.
 */
export const PRESENTATION_EXPORT_PROVIDER_KEYS: Record<PresentationExportFormat, string> = {
  pptx: 'native:pptxgenjs',
  pdf: 'native:pdfkit',
  png: 'native:sharp-svg',
};

export interface DeckForExportHash {
  id: string;
  deck_json?: string | null;
  unified_json?: string | null;
  version?: number | string | null;
}

/**
 * sha256 of the canonicalized deck content this export is pinned to. Prefers
 * `deck_json` (the canonical, edited/autosaved projection every mutation
 * path writes to — see `presentations.routes.ts`'s autosave/agent-edit
 * doc comments); falls back to `unified_json` for legacy decks that predate
 * `deck_json`. Falls back to `{ id }` only when NEITHER parses, so the hash
 * is always well-defined rather than throwing mid-export.
 */
export function deriveDeckSourceHash(deck: DeckForExportHash): string {
  let parsed: unknown = null;
  if (deck.deck_json) {
    try {
      parsed = JSON.parse(String(deck.deck_json));
    } catch {
      parsed = null;
    }
  }
  if (parsed === null && deck.unified_json) {
    try {
      parsed = JSON.parse(String(deck.unified_json));
    } catch {
      parsed = null;
    }
  }
  return canonicalSourceHash(parsed !== null ? parsed : { id: deck.id });
}

/** `presentation_decks.version` is `INTEGER NOT NULL DEFAULT 1` — this only
 * guards against a malformed/non-numeric value ever reaching the spine's
 * `sourceVersion >= 1` integer check. */
export function deriveDeckSourceVersion(deck: DeckForExportHash): number {
  const value = Number(deck.version);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export function derivePresentationExportIdempotencyKey(input: {
  deckId: string;
  sourceVersion: number;
  format: PresentationExportFormat;
  requestKey?: string | null;
}): string {
  const scope = `presentation:${input.deckId}:${input.format}`;
  const trimmedRequestKey =
    typeof input.requestKey === 'string' && input.requestKey.trim() !== ''
      ? input.requestKey.trim()
      : null;
  return trimmedRequestKey
    ? `${scope}:req:${trimmedRequestKey}`
    : `${scope}:v${input.sourceVersion}`;
}

/** Plain sha256 hex of raw bytes — deliberately NOT `canonicalSourceHash`
 * (that hashes canonicalized JSON; exported bytes are an opaque binary
 * blob, not JSON to be key-sorted). This is what a caller re-hashing the
 * downloaded buffer independently must reproduce bit-for-bit. */
export function hashBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export interface BeginPresentationExportInput {
  organizationId: string;
  deckId: string;
  deck: DeckForExportHash;
  format: PresentationExportFormat;
  createdBy: string;
  /** Raw `Idempotency-Key` header value, if the caller sent one. */
  requestIdempotencyKey?: string | null;
}

export interface BeginPresentationExportResult {
  receipt: ExportReceipt;
  replayed: boolean;
  sourceContentHash: string;
  sourceVersion: number;
  idempotencyKey: string;
}

/**
 * Freezes + hashes the source BEFORE any rendering happens, and opens (or
 * replays) the governed 'pending' receipt. Call this immediately before the
 * actual render call in each export route; call `completePresentationExport`
 * or `failPresentationExport` in every subsequent branch (success AND
 * error) so the receipt never sits in 'pending' forever.
 */
export async function beginPresentationExport(
  input: BeginPresentationExportInput
): Promise<BeginPresentationExportResult> {
  const sourceContentHash = deriveDeckSourceHash(input.deck);
  const sourceVersion = deriveDeckSourceVersion(input.deck);
  const idempotencyKey = derivePresentationExportIdempotencyKey({
    deckId: input.deckId,
    sourceVersion,
    format: input.format,
    requestKey: input.requestIdempotencyKey,
  });

  const { receipt, replayed } = await recordExportReceipt({
    organizationId: input.organizationId,
    artifactKind: 'presentation',
    sourceRecordId: input.deckId,
    sourceVersion,
    sourceContentHash,
    outputFormat: input.format,
    providerKey: PRESENTATION_EXPORT_PROVIDER_KEYS[input.format],
    createdBy: input.createdBy,
    idempotencyKey,
  });

  return { receipt, replayed, sourceContentHash, sourceVersion, idempotencyKey };
}

export async function completePresentationExport(params: {
  organizationId: string;
  exportReceiptId: string;
  buffer: Buffer;
}): Promise<ExportReceipt> {
  return completeExportReceipt({
    organizationId: params.organizationId,
    exportReceiptId: params.exportReceiptId,
    outputContentHash: hashBuffer(params.buffer),
    outputByteSize: params.buffer.length,
  });
}

export async function failPresentationExport(params: {
  organizationId: string;
  exportReceiptId: string;
  failureCode: string;
}): Promise<ExportReceipt> {
  return failExportReceipt(params);
}

/** MAT-POL-001 fail-closed path — not currently reachable from the three
 * presentation export routes (PPTX/PDF/PNG all have real, approved, MIT
 * engines installed today), but kept as a first-class exported function so a
 * FUTURE provider that is not yet approved has an explicit place to land
 * rather than a silent mock/downgrade. Exercised directly in this module's
 * own test suite. */
export async function markPresentationExportUnavailable(params: {
  organizationId: string;
  exportReceiptId: string;
  failureCode: string;
}): Promise<ExportReceipt> {
  return markExportUnavailable(params);
}
