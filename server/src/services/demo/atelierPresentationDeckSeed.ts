/**
 * Canonical, idempotent materializer for the Atelier Toys demo decks.
 *
 * CONTRACT
 * --------
 * 0. ATOMICITY IS REPORTED, NOT ASSUMED. Every result carries `atomicity`:
 *    `'pinned-pg'` means the three writes really did run inside ONE
 *    `BEGIN ... COMMIT` on ONE pinned client, behind a per-tenant advisory lock,
 *    with a compare-and-swap re-read after the lock was taken.
 *    `'batched-fallback'` means no PostgreSQL pool was reachable (the SQLite
 *    test seam) and the run went through `DbPromise.transaction`, which on
 *    PostgreSQL is NOT one transaction. Read `atomicity` before believing any
 *    all-or-nothing claim about a given run.
 * 1. `slide_count` is DERIVED from canonical content — it is never an
 *    independent integer. The single source is
 *    `deckDocumentFromUnifiedJson(...).cards.length`, which is also what
 *    `normalizeDeckDocument()` hands the builder on canonical GET. A deck this
 *    seed writes therefore cannot advertise a count it cannot render.
 * 2. Both persisted content columns are written together: `deck_json` (builder
 *    model) AND `unified_json` (renderer model). Writing only one is what makes
 *    export and edit diverge (see the block comment in
 *    `presentationDeckDocumentService.ts`).
 * 3. Idempotent: re-running with the same organization and anchor date produces
 *    byte-identical rows. Nothing here reads the wall clock — all timestamps are
 *    derived from the anchor — so a second run is a NO-OP: an `unchanged` deck
 *    issues no statement at all, so `version` cannot drift.
 * 4. Tenant-scoped: every statement filters/writes `organization_id`. The upsert
 *    key is the deterministic id `${organizationId}--deck--${slug}`, and the
 *    `ON CONFLICT` arm refuses to touch a row that belongs to another tenant.
 *
 * ★ WHY THIS IS NOT A NAIVE UPSERT (MAT-006B round 2)
 * ---------------------------------------------------
 * The first cut of this module ran three independent
 * `INSERT ... ON CONFLICT DO UPDATE` statements with `{ fallback: true }`. Three
 * things were wrong with that, all of them the "silent success" family:
 *
 *   a) It OVERWROTE whatever was in the row. A demo tenant is a live tenant —
 *      a presenter who edits the Line 3 deck at 09:00 would find their work
 *      silently replaced by the next session seed. The seed now only writes a
 *      row it can PROVE it still owns (persisted fingerprint marker) or that is
 *      empty; anything else is `skipped` and needs the operator flag `force`.
 *   b) It was not atomic. Deck 1 could land and deck 3 be rejected, leaving the
 *      Materials list half-canonical. On PostgreSQL all writes now go through
 *      ONE `BEGIN ... COMMIT` on ONE PINNED client (`pinnedPgTransaction.ts`) —
 *      all three or none, and the result says so via `atomicity: 'pinned-pg'`.
 *      Where no pool exists the run degrades to `DbPromise.transaction`, which
 *      does NOT provide that guarantee, and reports `'batched-fallback'`
 *      instead of claiming one.
 *   c) It trusted its own inputs. Nothing read the rows back, so a write that
 *      the database accepted but that landed under a different tenant, or with a
 *      `slide_count` its content cannot back, still reported success. Every
 *      applied run now re-reads the three rows and verifies tenant, status,
 *      content, derived card count === persisted `slide_count`, and fingerprint.
 *
 * SEED OWNERSHIP MARKER
 * ---------------------
 * `deckDocument.seed = { source: 'atelier-canonical', fingerprint }` is persisted
 * INSIDE `deck_json`, so no migration and no extra column is needed.
 * `fingerprintDeckContent()` EXCLUDES that marker from the hash, which is what
 * makes it self-consistent: the fingerprint recomputed from a persisted row
 * equals the fingerprint the seed stamped into it, unless somebody changed the
 * content. Any edit — by a human in the builder, by an autosave, by another
 * service — breaks the equality, the seed reports `skipped`, and the content
 * survives.
 *
 * ★ TIME-OF-CHECK / TIME-OF-USE (MAT-006B round 3)
 * ------------------------------------------------
 * The plan is computed from rows read BEFORE any lock is held, so a presenter
 * who saves the Line 3 deck in that window would have their edit overwritten by
 * a plan that no longer describes reality. On the pinned path the seed therefore
 * takes `pg_advisory_xact_lock(<tenant>)` INSIDE the transaction, RE-READS the
 * three rows, and compare-and-swaps on `version` + `updated_at` + the recomputed
 * content fingerprint. Any drift aborts the WHOLE transaction — nothing is
 * written, and the operator is told which deck moved. The lock also serialises
 * two concurrent demo-session seeds against each other.
 */
import { createHash } from 'node:crypto';

import * as DbPromise from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  advisoryLockKey,
  type PinnedPgClient,
  pinnedPgUnavailableReason,
  type PinnedTxState,
  withFreshPgConnection,
  withPinnedPgTransaction,
} from '../../utils/pinnedPgTransaction.js';
import {
  type DeckDocument,
  deckDocumentFromUnifiedJson,
  resolveDeckContentCoherence,
} from '../presentationDeckDocumentService.js';
import type { UnifiedReportJSON } from '../report/pptx/types.js';
import {
  type AtelierDeckTemplate,
  getAtelierPresentationDecks,
  isDbWritableDeckStatus,
} from './atelierPresentationDeckTemplate.js';
import { getDemoAnchorDate } from './demoRelativeDate.js';

/** The three canonical Atelier decks, in seed order. */
export const ATELIER_DECK_SLUGS = [
  'forward-board-readout',
  'line3-steering',
  'connected-play-growth',
] as const;

/** Value stamped into `deck_json.seed.source` for rows this module owns. */
export const ATELIER_DECK_SEED_SOURCE = 'atelier-canonical';

export interface SeedAtelierPresentationDecksInput {
  organizationId: string;
  anchorDate?: Date | string | null;
  /** Demo user map (`slug -> { id }`) produced by the canonical Atelier seed. */
  userMap?: Record<string, { id: string }>;
  /** Initiative map (`slug -> id`) produced by the canonical Atelier seed. */
  initiativeMap?: Record<string, string>;
  /**
   * OPERATOR-ONLY escape hatch. Overwrite content this seed does not own.
   * Never set from demo-session entry — it destroys presenter edits.
   */
  force?: boolean;
  /** Compute the plan and write NOTHING. */
  dryRun?: boolean;
  /**
   * ★ THE RECOVERY ANCHOR, MADE DURABLE **BEFORE** THE COMMIT.
   *
   * Called INSIDE the transaction, on the pinned client's thread of control,
   * after the post-state has been computed under the advisory lock and after
   * the read-back proved the rows — and BEFORE `COMMIT`. It must durably
   * persist the signed manifest carrying that post-state.
   *
   * ★ WHY THE ORDER IS NOT NEGOTIABLE. The previous cut committed first and
   * re-signed the manifest afterwards. A process death in that window left the
   * worst possible triple: a CHANGED database, a manifest with no post-state,
   * and an automatic rollback that (correctly) refuses to run without a
   * compare-and-swap target — i.e. a change nobody could safely undo. Writing
   * the anchor first inverts the failure: a death before COMMIT leaves an anchor
   * describing a transaction that never landed, and the rollback's CAS refuses
   * it because the rows are still in their pre-state. That refusal is free; the
   * other one costs a manual database repair.
   *
   * A THROW ABORTS THE TRANSACTION. No recovery anchor, no write.
   */
  persistRecoveryAnchor?: (postState: AtelierDeckPostState[]) => Promise<void>;
}

export interface MaterializedAtelierDeck {
  deckId: string;
  template: AtelierDeckTemplate;
  document: DeckDocument;
  unifiedJson: UnifiedReportJSON;
  /** Derived — always `document.cards.length`. */
  slideCount: number;
}

export type AtelierDeckOutcome = 'inserted' | 'updated' | 'unchanged' | 'skipped' | 'failed';

export interface AtelierDeckPlanEntry {
  slug: string;
  deckId: string;
  outcome: AtelierDeckOutcome;
  /** Human-readable justification. Always set for 'skipped' and 'failed'. */
  reason: string | null;
  currentVersion: number | null;
  /** Version the row carries AFTER this run; null when nothing will be written. */
  nextVersion: number | null;
  currentSlideCount: number | null;
  desiredSlideCount: number;
  /** Fingerprint recomputed from the row's persisted content, or null when empty. */
  currentFingerprint: string | null;
  /** Fingerprint of the content this seed would write. */
  desiredFingerprint: string;
  /** True when the persisted row still carries the fingerprint the seed last wrote. */
  ownedBySeed: boolean;
  hasExistingContent: boolean;
  /** Set when a row with this id exists under a DIFFERENT `organization_id`. */
  foreignTenant: string | null;
}

export interface SeedAtelierPresentationDeckFailure {
  deckId: string;
  reason: string;
}

/**
 * What actually protected a run.
 *
 * - `'pinned-pg'`: ONE `BEGIN ... COMMIT` on ONE checked-out client, behind a
 *   per-tenant advisory lock, with a post-lock CAS re-read. All-or-nothing holds.
 * - `'batched-fallback'`: no PostgreSQL pool was reachable, so the writes went
 *   through `DbPromise.transaction`, which on PostgreSQL is a sequence of
 *   autocommitting statements on arbitrary pooled clients. Convergence (every
 *   statement is a deterministic idempotent upsert, and the next run repairs a
 *   partial batch) is the only protection — NOT rollback.
 *
 * Runs that write nothing at all (dry run, a plan aborted before any statement,
 * an unexpected error) report `'batched-fallback'`: it is the conservative
 * value, and it never over-claims a guarantee that was not in force.
 */
export type AtelierDeckAtomicity = 'pinned-pg' | 'batched-fallback';

/**
 * What one canonical row looked like AFTER a materialization — the compare-and-swap
 * target a later rollback swaps against.
 *
 * ★ WHY THIS EXISTS. A rollback restores the PRE-state (the backup). To do that
 * safely it must first prove that the row it is about to overwrite is still the
 * row the seed left behind, and not a presenter's later save. Without a recorded
 * post-state the rollback can only check "does a row exist" — which is true both
 * for the seed's row and for the edit that replaced it. This is the fingerprint
 * that tells them apart.
 */
export interface AtelierDeckPostState {
  deckId: string;
  /** 'exists' — the write produced/kept a row; 'absent' — there is no row. */
  state: 'exists' | 'absent';
  organizationId: string | null;
  version: number | null;
  /**
   * ★ THE DATABASE'S OWN TEXT RENDERING (`CAST(updated_at AS TEXT)`), never a JS
   * `Date`. `updated_at` is `timestamp WITHOUT time zone` on the live database,
   * so every `Date` round-trip re-interprets the value in the process timezone
   * and shifts it by the local UTC offset — which would make this CAS compare
   * two different renderings of the same instant and refuse every rollback off
   * UTC. It already bit this packet once.
   */
  updatedAt: string | null;
  /** `fingerprintDeckContent(deck_json, unified_json)`; null when the row is absent. */
  contentFingerprint: string | null;
  slideCount: number | null;
  status: string | null;
}

export interface SeedAtelierPresentationDecksResult {
  /** Rows actually written (inserted + updated). 0 on a dry run or aborted transaction. */
  decks: number;
  slides: number;
  deckIds: string[];
  unchanged: number;
  skipped: number;
  failures: SeedAtelierPresentationDeckFailure[];
  plan: AtelierDeckPlanEntry[];
  /**
   * True only when the writes are KNOWN to have landed. False for a dry run,
   * for a rolled-back transaction — AND for an INDETERMINATE one, where it means
   * "not known to have landed", NOT "nothing changed". Read `commitState` to
   * tell those two apart before saying anything to an operator.
   */
  applied: boolean;
  /** What actually protected this run. Never assume — read it. */
  atomicity: AtelierDeckAtomicity;
  /**
   * ★ HOW THE TRANSACTION ENDED, INCLUDING "WE DO NOT KNOW".
   *
   * - `'committed'`      — the server acknowledged the COMMIT.
   * - `'rolled_back'`    — there is evidence the writes did not take effect.
   * - `'indeterminate'`  — the COMMIT was sent and no answer came back. The
   *   database MAY carry these rows. A caller that prints "nothing was changed"
   *   on this value is lying; re-read the rows on a fresh connection instead.
   * - `null`             — no single real transaction carried this run (dry run,
   *   a plan aborted before any statement, or the batched fallback, which is not
   *   a transaction at all on PostgreSQL).
   */
  commitState: PinnedTxState | null;
  /**
   * What the three rows looked like immediately after this run — the CAS target
   * a rollback manifest must carry. EMPTY on a dry run, on an aborted run, and
   * for any deck whose post-read FAILED (an omitted entry makes a later rollback
   * refuse, which is the fail-closed direction: inventing `absent` for a row we
   * could not read is how a rollback learns to DELETE something it never wrote).
   *
   * ★ On the pinned path this is captured INSIDE the transaction, under the
   * advisory lock, before COMMIT — so it describes exactly what was committed
   * and no editor can slip between the write and the fingerprint.
   */
  postState: AtelierDeckPostState[];
}

/**
 * Every column the upsert overwrites, plus the two key columns.
 *
 * ★ The backup is only as good as its narrowest column. An earlier cut captured
 * ten of them, so a rollback restored `deck_json` and `slide_count` while
 * leaving `audience`, `theme`, `template_id` and `created_at` as the seed had
 * rewritten them — a "restore" that silently kept part of the overwrite. If the
 * upsert touches a column, this row carries it.
 *
 * `id` and `organization_id` are KEYS: captured so a manifest can be verified
 * and tenant-guarded, never restored as values.
 */
export interface AtelierDeckBackupRow {
  id: string;
  organization_id: string | null;
  title: string | null;
  description: string | null;
  template_id: string | null;
  deck_type: string | null;
  audience: string | null;
  goal: string | null;
  language: string | null;
  confidentiality: string | null;
  theme: string | null;
  presentation_mode: string | null;
  source_type: string | null;
  source_id: string | null;
  source_artifacts: string | null;
  outline_json: string | null;
  unified_json: string | null;
  deck_json: string | null;
  source_refs_json: string | null;
  slide_count: number | null;
  status: string | null;
  generated_by: string | null;
  created_by: string | null;
  /** ISO-8601. node-pg hands back a JS `Date` for `timestamptz`; normalized here. */
  created_at: string | null;
  /** ISO-8601. See `created_at`. */
  updated_at: string | null;
  version: number | null;
}

/**
 * ★ ABSENCE MUST BE PROVEN. `'verified_absent'` means a SELECT SUCCEEDED and
 * returned no row. A SELECT that threw is `'unknown'` — and `'unknown'` may
 * never become a DELETE in a rollback manifest, because "I could not read it"
 * and "it was not there" are the same shape and opposite facts.
 */
export type AtelierDeckBackupState = 'exists' | 'verified_absent' | 'unknown';

export interface AtelierDeckBackupEntry {
  deckId: string;
  state: AtelierDeckBackupState;
  row: AtelierDeckBackupRow | null;
  error: string | null;
}

export interface AtelierDeckBackup {
  organizationId: string;
  /** Exactly 3, in `ATELIER_DECK_SLUGS` order. */
  entries: AtelierDeckBackupEntry[];
  /** True only when every entry is 'exists' or 'verified_absent'. */
  complete: boolean;
}

export function atelierDeckId(organizationId: string, slug: string): string {
  return `${organizationId}--deck--${slug}`;
}

/**
 * ★ ONE LOCK KEY, ONE DEFINITION.
 *
 * The seed write path and the rollback executor MUST serialise against each
 * other and against every other writer of these three rows. Two call sites that
 * each spell out `advisoryLockKey('atelier-presentation-decks:' + org)` are two
 * places to get it wrong — and a rollback that takes a DIFFERENT key from the
 * write takes no useful lock at all while looking exactly like one that does.
 * So the seed (`applyOnPinnedClient`) and the rollback
 * (`rollbackAtelierDecksOnPinnedClient`) both call THIS function, and a test
 * asserts they cannot diverge.
 */
export function atelierDeckLockKey(organizationId: string): string {
  return advisoryLockKey(`atelier-presentation-decks:${organizationId}`);
}

/**
 * Deterministic JSON serialization: object keys sorted, so two structurally
 * equal documents hash identically regardless of insertion order. Without this
 * a harmless key reorder anywhere upstream would read as "a human edited it".
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function parseJson(raw: string | null | undefined): unknown {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isBlank(raw: string | null | undefined): boolean {
  return typeof raw !== 'string' || raw.trim() === '' || raw.trim() === 'null';
}

/**
 * sha256 hex of the canonical content the seed would write, EXCLUDING the seed
 * marker itself. Excluding the marker is what makes the fingerprint
 * self-consistent — hashing a document that carries `seed.fingerprint` would
 * otherwise be a hash of its own hash and could never be reproduced.
 */
export function fingerprintDeckContent(deckJson: string, unifiedJson: string): string {
  const deck = parseJson(deckJson);
  let deckCanonical: string;
  if (deck && typeof deck === 'object' && !Array.isArray(deck)) {
    const copy: Record<string, unknown> = { ...(deck as Record<string, unknown>) };
    delete copy.seed;
    deckCanonical = stableStringify(copy);
  } else {
    // Unparseable / non-object content still has to hash to something stable so
    // a corrupt row is reported as "not ours" rather than crashing the seed.
    deckCanonical = deck === null ? `raw:${String(deckJson ?? '')}` : stableStringify(deck);
  }

  const unified = parseJson(unifiedJson);
  const unifiedCanonical =
    unified === null ? `raw:${String(unifiedJson ?? '')}` : stableStringify(unified);

  return createHash('sha256').update(`${deckCanonical}\0${unifiedCanonical}`).digest('hex');
}

/**
 * Build the canonical deck document for one template. Pure — no DB, no clock.
 * Exported so tests can assert the count/content invariant without a database.
 *
 * The returned document does NOT carry the seed marker; the marker is stamped
 * on at persistence time by `buildDeckPayload`, using the fingerprint of exactly
 * this content.
 */
export function materializeAtelierDeck(params: {
  organizationId: string;
  template: AtelierDeckTemplate;
  anchorDate: Date;
  createdBy?: string | null;
}): MaterializedAtelierDeck {
  const { organizationId, template, anchorDate } = params;
  const deckId = atelierDeckId(organizationId, template.slug);
  const timestamp = anchorDate.toISOString();

  const unifiedJson: UnifiedReportJSON = {
    meta: {
      client: 'Atelier Toys',
      project: template.title,
      date: timestamp.slice(0, 10),
      author: 'Consultify',
      confidentiality: 'internal',
      language: 'en',
      template: 'corporate',
      sourceType: template.sourceType,
    },
    slides: template.slides,
  };

  const document = deckDocumentFromUnifiedJson({
    deckId,
    organizationId,
    title: template.title,
    unifiedJson,
    outline: template.slides.map((slide, index) => ({
      index,
      intent: slide.intent,
      key_message: slide.key_message,
    })),
    setup: {
      theme: template.theme,
      presentationMode: template.presentationMode,
      communicationRegister: 'professional',
      imageStylePreset: 'minimal_no_images',
      colorSetId: 'brand_kit',
      cardSize: '16:9',
      textMode: 'preserve',
      contentDepth: 'standard',
      audience: template.audience,
      goal: template.goal,
      language: 'en',
      imageSource: 'none',
      deckType: template.deckType,
      confidentiality: 'internal',
    },
    sourceArtifacts: template.sourceRefs,
    sourceRefs: template.sourceRefs,
    status: template.status,
    warnings: [],
    createdBy: params.createdBy || 'system',
    // Deterministic timestamps — this is what makes the seed idempotent.
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // The invariant, asserted at construction rather than trusted: the document we
  // are about to persist must carry exactly one card per declared slide.
  if (document.cards.length !== template.slides.length) {
    throw new Error(
      `[atelierPresentationDeckSeed] materialization dropped cards for ${deckId}: ` +
        `${document.cards.length} cards from ${template.slides.length} slides`
    );
  }

  return {
    deckId,
    template,
    document,
    unifiedJson,
    slideCount: document.cards.length,
  };
}

interface DeckPayload {
  deckId: string;
  slug: string;
  template: AtelierDeckTemplate;
  slideCount: number;
  /** `deck_json` as it will be persisted — WITH the seed marker. */
  deckJson: string;
  unifiedJson: string;
  outlineJson: string;
  sourceRefsJson: string;
  fingerprint: string;
  createdBy: string | null;
  sourceId: string | null;
}

function buildDeckPayload(params: {
  organizationId: string;
  template: AtelierDeckTemplate;
  anchorDate: Date;
  createdBy: string | null;
  sourceId: string | null;
}): DeckPayload {
  const materialized = materializeAtelierDeck({
    organizationId: params.organizationId,
    template: params.template,
    anchorDate: params.anchorDate,
    createdBy: params.createdBy,
  });

  const bareDeckJson = JSON.stringify(materialized.document);
  const unifiedJson = JSON.stringify(materialized.unifiedJson);
  const fingerprint = fingerprintDeckContent(bareDeckJson, unifiedJson);

  return {
    deckId: materialized.deckId,
    slug: params.template.slug,
    template: params.template,
    slideCount: materialized.slideCount,
    deckJson: JSON.stringify({
      ...materialized.document,
      seed: { source: ATELIER_DECK_SEED_SOURCE, fingerprint },
    }),
    unifiedJson,
    outlineJson: JSON.stringify(materialized.document.generation.outline),
    sourceRefsJson: JSON.stringify(params.template.sourceRefs),
    fingerprint,
    createdBy: params.createdBy,
    sourceId: params.sourceId,
  };
}

interface DeckRowSnapshot {
  id: string;
  organization_id: string | null;
  status: string | null;
  slide_count: number | null;
  version: number | null;
  deck_json: string | null;
  unified_json: string | null;
  updated_at?: unknown;
}

const SNAPSHOT_COLUMNS =
  'id, organization_id, status, slide_count, version, deck_json, unified_json, updated_at';

/**
 * The exact facts the CAS compares. Captured at PLAN time (no lock held) and
 * re-captured after the advisory lock is taken; any difference means somebody
 * else wrote to a seed-owned row in between.
 */
interface ObservedRow {
  exists: boolean;
  organizationId: string | null;
  version: number | null;
  slideCount: number | null;
  fingerprint: string | null;
  updatedAt: string | null;
}

const ABSENT_ROW: ObservedRow = {
  exists: false,
  organizationId: null,
  version: null,
  slideCount: null,
  fingerprint: null,
  updatedAt: null,
};

/**
 * `timestamptz` arrives as a JS `Date` from node-pg and as a string from SQLite.
 * Normalizing both to ISO-8601 is what makes a CAS comparison meaningful across
 * two reads of the same row through two different drivers.
 */
function normalizeTimestamp(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString();
}

function observeRow(row: DeckRowSnapshot | null): ObservedRow {
  if (!row) return ABSENT_ROW;
  const hasContent = !isBlank(row.deck_json) || !isBlank(row.unified_json);
  return {
    exists: true,
    organizationId: row.organization_id == null ? null : String(row.organization_id),
    version: Number.isFinite(Number(row.version)) ? Number(row.version) : null,
    slideCount: Number.isFinite(Number(row.slide_count)) ? Number(row.slide_count) : null,
    fingerprint: hasContent
      ? fingerprintDeckContent(row.deck_json || '', row.unified_json || '')
      : null,
    updatedAt: normalizeTimestamp(row.updated_at),
  };
}

/**
 * Compare-and-swap. Returns a human-readable description of the FIRST drift, or
 * `null` when the row is byte-for-byte the one the plan was built from.
 */
function describeDrift(planned: ObservedRow, current: ObservedRow): string | null {
  if (planned.exists !== current.exists) {
    return current.exists
      ? 'a row appeared after the plan was built (it did not exist at plan time)'
      : 'the row was deleted after the plan was built';
  }
  if (!planned.exists) return null;
  if (planned.organizationId !== current.organizationId) {
    return `organization_id changed from '${planned.organizationId ?? 'NULL'}' to '${current.organizationId ?? 'NULL'}'`;
  }
  if (planned.version !== current.version) {
    return `version changed from ${planned.version ?? 'NULL'} to ${current.version ?? 'NULL'}`;
  }
  if (planned.updatedAt !== current.updatedAt) {
    return `updated_at changed from '${planned.updatedAt ?? 'NULL'}' to '${current.updatedAt ?? 'NULL'}'`;
  }
  if (planned.fingerprint !== current.fingerprint) {
    return 'content fingerprint changed (the row was edited after the plan was built)';
  }
  if (planned.slideCount !== current.slideCount) {
    return `slide_count changed from ${planned.slideCount ?? 'NULL'} to ${current.slideCount ?? 'NULL'}`;
  }
  return null;
}

/**
 * Does `presentation_decks` exist? Distinguishes "no" from "the probe blew up":
 * both are failures, but the reason must say which, and NEITHER may be reported
 * as a healthy empty run.
 */
async function probePresentationDecksTable(): Promise<{ ok: boolean; reason: string }> {
  try {
    const row = await DbPromise.get<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      ['presentation_decks'],
      { fallback: false }
    );
    if (row && Boolean(row.exists)) return { ok: true, reason: '' };
    return { ok: false, reason: 'table presentation_decks does not exist' };
  } catch (error) {
    return {
      ok: false,
      reason: `table presentation_decks probe failed: ${(error as Error)?.message || 'unknown error'}`,
    };
  }
}

function upsertStatement(params: {
  organizationId: string;
  payload: DeckPayload;
  version: number;
  timestamp: string;
}): { sql: string; params: unknown[] } {
  const { organizationId, payload, version, timestamp } = params;
  return {
    sql: `INSERT INTO presentation_decks (
         id, organization_id, title, description, template_id, deck_type, audience, goal,
         language, confidentiality, theme, presentation_mode, source_type, source_id,
         source_artifacts, outline_json, unified_json, deck_json, source_refs_json,
         slide_count, status, generated_by, created_by, version, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title=excluded.title,
         description=excluded.description,
         template_id=excluded.template_id,
         deck_type=excluded.deck_type,
         audience=excluded.audience,
         goal=excluded.goal,
         language=excluded.language,
         confidentiality=excluded.confidentiality,
         theme=excluded.theme,
         presentation_mode=excluded.presentation_mode,
         source_type=excluded.source_type,
         source_id=excluded.source_id,
         source_artifacts=excluded.source_artifacts,
         outline_json=excluded.outline_json,
         unified_json=excluded.unified_json,
         deck_json=excluded.deck_json,
         source_refs_json=excluded.source_refs_json,
         slide_count=excluded.slide_count,
         status=excluded.status,
         generated_by=excluded.generated_by,
         created_by=excluded.created_by,
         version=excluded.version,
         updated_at=excluded.updated_at
       WHERE presentation_decks.organization_id = excluded.organization_id`,
    params: [
      payload.deckId,
      organizationId,
      payload.template.title,
      payload.template.description,
      payload.template.templateId,
      payload.template.deckType,
      payload.template.audience,
      payload.template.goal,
      'en',
      'internal',
      payload.template.theme,
      payload.template.presentationMode,
      payload.template.sourceType,
      payload.sourceId,
      payload.sourceRefsJson,
      payload.outlineJson,
      payload.unifiedJson,
      payload.deckJson,
      payload.sourceRefsJson,
      // DERIVED, never declared.
      payload.slideCount,
      payload.template.status,
      payload.createdBy,
      payload.createdBy,
      version,
      timestamp,
      timestamp,
    ],
  };
}

function emptyResult(): SeedAtelierPresentationDecksResult {
  return {
    decks: 0,
    slides: 0,
    deckIds: [],
    unchanged: 0,
    skipped: 0,
    failures: [],
    plan: [],
    applied: false,
    // Conservative default: nothing has been protected yet.
    atomicity: 'batched-fallback',
    // No real transaction has ended, so there is nothing to report about one.
    commitState: null,
    // Nothing was written, so there is no post-state to swap against.
    postState: [],
  };
}

function failedEntry(params: {
  slug: string;
  deckId: string;
  reason: string;
  desiredSlideCount: number;
  desiredFingerprint: string;
}): AtelierDeckPlanEntry {
  return {
    slug: params.slug,
    deckId: params.deckId,
    outcome: 'failed',
    reason: params.reason,
    currentVersion: null,
    nextVersion: null,
    currentSlideCount: null,
    desiredSlideCount: params.desiredSlideCount,
    currentFingerprint: null,
    desiredFingerprint: params.desiredFingerprint,
    ownedBySeed: false,
    hasExistingContent: false,
    foreignTenant: null,
  };
}

interface PlannedDeck {
  entry: AtelierDeckPlanEntry;
  payload: DeckPayload | null;
  /**
   * What the row looked like when the plan was decided — the "check" half of
   * check-then-act. `null` when the plan never got as far as reading the row
   * (bad status, unreadable table); such a plan is a failure anyway.
   */
  observed: ObservedRow | null;
}

function summarize(
  planned: PlannedDeck[],
  applied: boolean,
  atomicity: AtelierDeckAtomicity,
  postState: AtelierDeckPostState[] = [],
  commitState: PinnedTxState | null = null
): SeedAtelierPresentationDecksResult {
  const result = emptyResult();
  result.applied = applied;
  result.atomicity = atomicity;
  result.commitState = commitState;
  result.postState = postState;
  for (const { entry, payload } of planned) {
    result.plan.push(entry);
    if (entry.outcome === 'unchanged') result.unchanged += 1;
    if (entry.outcome === 'skipped') result.skipped += 1;
    if (entry.outcome === 'failed') {
      result.failures.push({ deckId: entry.deckId, reason: entry.reason || 'unknown failure' });
    }
    if (applied && (entry.outcome === 'inserted' || entry.outcome === 'updated')) {
      result.decks += 1;
      result.slides += payload?.slideCount ?? entry.desiredSlideCount;
      result.deckIds.push(entry.deckId);
    }
  }
  return result;
}

/**
 * Read the three canonical rows and decide, per deck, what would happen.
 * READ-ONLY: never writes, never opens a transaction, never throws.
 */
export async function planAtelierPresentationDecks(
  input: SeedAtelierPresentationDecksInput
): Promise<SeedAtelierPresentationDecksResult> {
  const planned = await buildPlan(input);
  // A plan is a read; nothing was written, so nothing was protected.
  return summarize(planned, false, 'batched-fallback');
}

async function buildPlan(input: SeedAtelierPresentationDecksInput): Promise<PlannedDeck[]> {
  const organizationId = input.organizationId;
  const templates = getAtelierPresentationDecks();
  const anchorDate = getDemoAnchorDate(input.anchorDate);

  // Payloads are pure, so they can be built before any DB access — which means
  // even a totally dead database still yields a full, honest plan.
  const payloads: DeckPayload[] = templates.map((template) =>
    buildDeckPayload({
      organizationId,
      template,
      anchorDate,
      createdBy:
        input.userMap?.[template.createdBySlug]?.id ||
        input.userMap?.['antoine-laurent']?.id ||
        null,
      sourceId: input.initiativeMap?.[template.sourceInitiativeSlug] || null,
    })
  );

  if (!organizationId) {
    return payloads.map((payload) => ({
      entry: failedEntry({
        slug: payload.slug,
        deckId: payload.deckId,
        reason: 'organizationId is required',
        desiredSlideCount: payload.slideCount,
        desiredFingerprint: payload.fingerprint,
      }),
      payload: null,
      observed: null,
    }));
  }

  // ★ A missing (or unprobeable) table is a FAILURE, not an empty success. The
  // previous shape returned `{ decks: 0, failures: [] }` here, which reads
  // downstream as "nothing to do" — the exact silent-failure mode that let three
  // content-less decks sit on `demo` unnoticed.
  const table = await probePresentationDecksTable();
  if (!table.ok) {
    logger.error(`[atelierPresentationDeckSeed] ${organizationId}: ${table.reason}`);
    return payloads.map((payload) => ({
      entry: failedEntry({
        slug: payload.slug,
        deckId: payload.deckId,
        reason: table.reason,
        desiredSlideCount: payload.slideCount,
        desiredFingerprint: payload.fingerprint,
      }),
      payload: null,
      observed: null,
    }));
  }

  const planned: PlannedDeck[] = [];
  for (const payload of payloads) {
    planned.push(await planOne({ organizationId, payload, force: Boolean(input.force) }));
  }
  return planned;
}

async function planOne(params: {
  organizationId: string;
  payload: DeckPayload;
  force: boolean;
}): Promise<PlannedDeck> {
  const { organizationId, payload, force } = params;
  const base = {
    slug: payload.slug,
    deckId: payload.deckId,
    desiredSlideCount: payload.slideCount,
    desiredFingerprint: payload.fingerprint,
  };

  // Pre-flight the one constraint the TypeScript type system cannot see: the
  // DB's `status` CHECK is narrower than the `DeckStatus` union.
  if (!isDbWritableDeckStatus(payload.template.status)) {
    const reason = `status '${payload.template.status}' is not accepted by presentation_decks_status_check`;
    logger.error(`[atelierPresentationDeckSeed] ${payload.deckId}: ${reason}`);
    return { entry: failedEntry({ ...base, reason }), payload: null, observed: null };
  }

  let row: DeckRowSnapshot | null;
  try {
    // ★ `fallback: false` on purpose. With `fallback: true` a failed read
    // RESOLVES null, which is indistinguishable from "no row" — and "no row"
    // means INSERT, i.e. we would overwrite content we never managed to read.
    row = await DbPromise.get<DeckRowSnapshot>(
      `SELECT ${SNAPSHOT_COLUMNS} FROM presentation_decks WHERE id = ?`,
      [payload.deckId],
      { fallback: false }
    );
  } catch (error) {
    const reason = `pre-write read failed: ${(error as Error)?.message || 'unknown error'}`;
    logger.error(`[atelierPresentationDeckSeed] ${payload.deckId}: ${reason}`);
    return { entry: failedEntry({ ...base, reason }), payload: null, observed: null };
  }

  // ★ The "check" half of check-then-act, frozen for the CAS that runs after the
  // advisory lock is taken. Everything below decides against THIS observation.
  const observed = observeRow(row);

  if (!row) {
    return {
      entry: {
        ...base,
        outcome: 'inserted',
        reason: null,
        currentVersion: null,
        nextVersion: 1,
        currentSlideCount: null,
        currentFingerprint: null,
        ownedBySeed: false,
        hasExistingContent: false,
        foreignTenant: null,
      },
      payload,
      observed,
    };
  }

  const currentVersion = Number.isFinite(Number(row.version)) ? Number(row.version) : 1;
  const currentSlideCount = Number.isFinite(Number(row.slide_count))
    ? Number(row.slide_count)
    : null;
  const rowOrg = row.organization_id == null ? null : String(row.organization_id);

  // ★ CROSS-TENANT COLLISION. A row with our id under somebody else's
  // organization is never written — not with `force`, not ever. Writing it would
  // hand one tenant's deck to another; refusing is the only safe outcome.
  if (rowOrg !== organizationId) {
    const reason =
      `id collision: row already exists under organization_id '${rowOrg ?? 'NULL'}' ` +
      `(seeding '${organizationId}') — refusing to write across tenants`;
    logger.error(`[atelierPresentationDeckSeed] ${payload.deckId}: ${reason}`);
    return {
      entry: {
        ...base,
        outcome: 'failed',
        reason,
        currentVersion,
        nextVersion: null,
        currentSlideCount,
        currentFingerprint: null,
        ownedBySeed: false,
        hasExistingContent: !isBlank(row.deck_json) || !isBlank(row.unified_json),
        foreignTenant: rowOrg,
      },
      payload: null,
      observed,
    };
  }

  const hasExistingContent = !isBlank(row.deck_json) || !isBlank(row.unified_json);
  const currentFingerprint = hasExistingContent
    ? fingerprintDeckContent(row.deck_json || '', row.unified_json || '')
    : null;

  const persistedMarker = (() => {
    const parsed = parseJson(row.deck_json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const marker = (parsed as Record<string, unknown>).seed;
    if (!marker || typeof marker !== 'object') return null;
    return marker as { source?: unknown; fingerprint?: unknown };
  })();

  // Ownership is PROVEN, not assumed: the row must carry our marker AND the
  // content must still hash to what the marker claims. Any edit breaks it.
  const ownedBySeed =
    persistedMarker?.source === ATELIER_DECK_SEED_SOURCE &&
    typeof persistedMarker?.fingerprint === 'string' &&
    persistedMarker.fingerprint === currentFingerprint;

  const common = {
    ...base,
    currentVersion,
    currentSlideCount,
    currentFingerprint,
    ownedBySeed,
    hasExistingContent,
    foreignTenant: null,
  };

  if (!hasExistingContent) {
    // The metadata-only orphan shape from the staging blocker: a declared count
    // with nothing behind it. Nothing to destroy, so converge it.
    return {
      entry: { ...common, outcome: 'updated', reason: null, nextVersion: currentVersion + 1 },
      payload,
      observed,
    };
  }

  if (
    ownedBySeed &&
    currentFingerprint === payload.fingerprint &&
    currentSlideCount === payload.slideCount
  ) {
    // ★ THE IDEMPOTENCY GUARANTEE. No statement is issued at all, so `version`,
    // `updated_at` and the bytes stay exactly as they are.
    return {
      entry: { ...common, outcome: 'unchanged', reason: null, nextVersion: currentVersion },
      payload: null,
      observed,
    };
  }

  if (ownedBySeed && currentFingerprint === payload.fingerprint) {
    // ★ CONTENT MATCHES BUT THE COUNTER DOES NOT — repair it.
    //
    // `slide_count` has writers that do not touch content. The PPTX download
    // path (`presentations.routes.ts`, `UPDATE ... SET slide_count = ?,
    // exported_at = ?, updated_at = updated_at`) stamps the RENDERER's tally,
    // which counts the appended closing slide, so one export turns a coherent
    // 11 into 12 while `deck_json` — and therefore the fingerprint — is
    // untouched. Deciding on the fingerprint alone would classify that row as
    // `unchanged` forever and the drift would be permanent, which is exactly
    // the "declared count with nothing behind it" defect this module exists to
    // remove. The count is part of what the seed owns, so a drifted counter is
    // a real change and must be written back.
    return {
      entry: {
        ...common,
        outcome: 'updated',
        reason: `slide_count drifted to ${currentSlideCount} (content still canonical at ${payload.slideCount})`,
        nextVersion: currentVersion + 1,
      },
      payload,
      observed,
    };
  }

  if (ownedBySeed) {
    return {
      entry: {
        ...common,
        outcome: 'updated',
        reason: 'seed-owned row is stale (template changed)',
        nextVersion: currentVersion + 1,
      },
      payload,
      observed,
    };
  }

  if (!force) {
    return {
      entry: {
        ...common,
        outcome: 'skipped',
        reason:
          'row carries content this seed does not own (edited outside the seed); ' +
          're-run with force: true to overwrite',
        nextVersion: currentVersion,
      },
      payload: null,
      observed,
    };
  }

  return {
    entry: {
      ...common,
      outcome: 'updated',
      reason: 'force: overwriting content the seed does not own',
      nextVersion: currentVersion + 1,
    },
    payload,
    observed,
  };
}

/**
 * Plan, then apply every write in ONE all-or-nothing transaction, then read the
 * rows back and verify them.
 *
 * ★ NEVER THROWS. Demo-session entry depends on this call; a thrown error there
 * turns a partially-seeded demo into a 503. Every failure is reported in
 * `failures` instead, and the read path is fail-closed anyway (a deck that did
 * not seed reports 0 slides / `missing` rather than a count it cannot back).
 */
export async function seedAtelierPresentationDecks(
  input: SeedAtelierPresentationDecksInput
): Promise<SeedAtelierPresentationDecksResult> {
  try {
    return await runSeed(input);
  } catch (error) {
    const reason = `unexpected seed error: ${(error as Error)?.message || 'unknown error'}`;
    logger.error(`[atelierPresentationDeckSeed] ${input.organizationId}: ${reason}`);
    const result = emptyResult();
    for (const slug of ATELIER_DECK_SLUGS) {
      const deckId = atelierDeckId(input.organizationId, slug);
      result.failures.push({ deckId, reason });
    }
    return result;
  }
}

async function runSeed(
  input: SeedAtelierPresentationDecksInput
): Promise<SeedAtelierPresentationDecksResult> {
  const organizationId = input.organizationId;
  const planned = await buildPlan(input);
  const anchorDate = getDemoAnchorDate(input.anchorDate);
  const timestamp = anchorDate.toISOString();

  if (input.dryRun) {
    return summarize(planned, false, 'batched-fallback');
  }

  // ★ STRICT ALL-OR-NOTHING ACROSS THE THREE DECKS.
  //
  // A deck can fail at PLAN time — a cross-tenant squatter on our id, a status
  // the DB CHECK rejects, an unreadable row. Writing the other two anyway would
  // leave the Materials list half-canonical, which is precisely the state this
  // packet exists to eliminate, and the read-back could never confirm 3/3.
  // So a single planning failure aborts the batch before any statement runs.
  //
  // `skipped` and `unchanged` are NOT failures — they are the CAS protection
  // and the idempotency guarantee doing their job, and they leave a coherent
  // row behind. Only `failed` aborts.
  const planFailures = planned.filter((p) => p.entry.outcome === 'failed');
  if (planFailures.length > 0) {
    logger.error(
      `[atelierPresentationDeckSeed] ${organizationId}: aborting the batch before any write — ` +
        planFailures.map((p) => `${p.entry.deckId} (${p.entry.reason})`).join('; ')
    );
    for (const item of planned) {
      if (item.entry.outcome === 'inserted' || item.entry.outcome === 'updated') {
        item.entry.outcome = 'failed';
        item.entry.reason = 'batch aborted: another deck in the same run could not be planned';
        item.entry.nextVersion = null;
      }
    }
    return summarize(planned, false, 'batched-fallback');
  }

  const writes = planned.filter(
    (p) => p.payload && (p.entry.outcome === 'inserted' || p.entry.outcome === 'updated')
  );

  // ★ PREFERRED PATH — a REAL transaction on ONE pinned client.
  const pinned = await applyOnPinnedClient({
    organizationId,
    planned,
    writes,
    timestamp,
    persistRecoveryAnchor: input.persistRecoveryAnchor,
  });
  if (pinned) return pinned;

  // ---------------------------------------------------------------------
  // ★ DEGRADED PATH — and it says so.
  //
  // `DbPromise.transaction` issues BEGIN / statements / COMMIT as SEPARATE
  // `run()` calls, and `PostgresDatabase.executeWithLogging` sends each one via
  // `pool.query()` — which checks out an ARBITRARY idle client per call. So on
  // PostgreSQL these statements are NOT one transaction: each upsert autocommits
  // on whichever client it lands, and the trailing ROLLBACK rolls back nothing.
  // On SQLite (the test seam, one connection) it IS transactional, which is the
  // same dialect-divergence class as the status CHECK.
  //
  // This path is therefore protected by CONVERGENCE, not by rollback: every
  // statement is a deterministic idempotent upsert, the post-write read-back
  // reports any row that did not land, and the next run re-plans from the
  // persisted state and repairs it. A partially applied batch is self-healing,
  // not permanent — but it is REAL, and the result says `atomicity:
  // 'batched-fallback'` so nobody downstream can mistake it for all-or-nothing.
  // ---------------------------------------------------------------------

  if (writes.length === 0) {
    // Nothing to write: everything is already canonical or skipped. Still verify
    // — reporting `applied: true` for rows nobody looked at would be the same
    // "trust the return value" mistake this module was rewritten to remove. An
    // `unchanged` verdict is a CLAIM about the persisted row, so it has to be
    // checked against the persisted row.
    await verifyReadBack(organizationId, planned);
    const anySurvivor = planned.some((p) => p.entry.outcome !== 'failed');
    const postState = anySurvivor ? await readAtelierDeckPostState(organizationId) : [];
    await anchorOnDegradedPath({ organizationId, planned, postState, input });
    return summarize(planned, anySurvivor, 'batched-fallback', postState);
  }

  const statements = writes.map(({ entry, payload }) =>
    upsertStatement({
      organizationId,
      payload: payload as DeckPayload,
      version: entry.nextVersion ?? 1,
      timestamp,
    })
  );

  let txOk = false;
  let txError = 'unknown transaction error';
  try {
    const tx = await DbPromise.transaction(statements);
    txOk = Boolean(tx?.success);
    if (!txOk) txError = tx?.error || txError;
  } catch (error) {
    txOk = false;
    txError = (error as Error)?.message || txError;
  }

  if (!txOk) {
    logger.error(
      `[atelierPresentationDeckSeed] ${organizationId}: transaction rolled back — ${txError}`
    );
    for (const write of writes) {
      write.entry.outcome = 'failed';
      write.entry.reason = `transaction rolled back: ${txError}`;
      write.entry.nextVersion = null;
    }
    return summarize(planned, false, 'batched-fallback');
  }

  await verifyReadBack(organizationId, planned);
  // ★ WEAKER THAN THE PINNED PATH, ON PURPOSE-AND-SAID-SO. This read happens
  // after the statements already autocommitted, so an editor could in principle
  // land between the write and this fingerprint. That is inherent to a path with
  // no transaction to hide inside; the operator write gate refuses this
  // atomicity value, so a manifest built here never reaches a live database.
  const postState = await readAtelierDeckPostState(organizationId);
  await anchorOnDegradedPath({ organizationId, planned, postState, input });
  return summarize(planned, true, 'batched-fallback', postState);
}

/**
 * The recovery anchor on the DEGRADED path — where it can only ever be written
 * AFTER the statements autocommitted, because there is no COMMIT to precede.
 *
 * ★ SAID PLAINLY RATHER THAN QUIETLY SKIPPED. This path cannot offer the
 * before-COMMIT guarantee; calling the callback here is still worth doing (the
 * operator gets a manifest that at least matches what landed), but a FAILURE to
 * write it is fatal to the run's honesty: the rows are already committed and
 * this tool would have no way back. So every deck that claims persisted state is
 * downgraded to `failed` and says exactly that.
 */
async function anchorOnDegradedPath(params: {
  organizationId: string;
  planned: PlannedDeck[];
  postState: AtelierDeckPostState[];
  input: SeedAtelierPresentationDecksInput;
}): Promise<void> {
  const { organizationId, planned, postState, input } = params;
  if (!input.persistRecoveryAnchor) return;
  try {
    await input.persistRecoveryAnchor(postState);
  } catch (error) {
    const message = (error as Error)?.message || 'unknown error';
    logger.error(
      `[atelierPresentationDeckSeed] ${organizationId}: the recovery anchor could NOT be ` +
        `persisted (${message}) on the non-transactional path, and the statements have ` +
        'already autocommitted — there is no way back through this tool'
    );
    for (const item of planned) {
      if (!claimsPersistedState(item.entry.outcome)) continue;
      fail(
        item.entry,
        `the rows are written but the recovery anchor could not be persisted: ${message}`
      );
    }
  }
}

/**
 * Carries the deck that caused an abort out of the transaction closure, so the
 * operator is told WHICH row moved rather than just "something did".
 */
interface PinnedAbort {
  deckId: string | null;
}

/**
 * ★ THE REAL TRANSACTION.
 *
 *   connect
 *     BEGIN
 *     pg_advisory_xact_lock(<tenant>)   -- serialise every seeder of these rows
 *     RE-READ the three rows            -- the plan was built BEFORE the lock
 *     CAS on version + updated_at + fingerprint
 *     upserts
 *     read-back, verified BEFORE COMMIT
 *     post-state computed, recovery anchor made DURABLE   -- still before COMMIT
 *   COMMIT                              -- any throw: ROLLBACK on the same client
 *
 * Returns `null` — NOT a result — when no PostgreSQL pool is reachable, so the
 * caller falls back and reports `atomicity: 'batched-fallback'`.
 *
 * ★ The read-back runs INSIDE the transaction on purpose. Verifying after COMMIT
 * can only ever complain; verifying before it can still refuse. A divergence
 * that the write itself did not report now takes the rows with it.
 */
async function applyOnPinnedClient(params: {
  organizationId: string;
  planned: PlannedDeck[];
  writes: PlannedDeck[];
  timestamp: string;
  persistRecoveryAnchor?: (postState: AtelierDeckPostState[]) => Promise<void>;
}): Promise<SeedAtelierPresentationDecksResult | null> {
  const { organizationId, planned, writes, timestamp, persistRecoveryAnchor } = params;

  const unavailable = pinnedPgUnavailableReason();
  if (unavailable) {
    logger.warn(
      `[atelierPresentationDeckSeed] ${organizationId}: no pinned PostgreSQL transaction ` +
        `(${unavailable}); falling back to a batched, NON-atomic apply`
    );
    return null;
  }

  const deckIds = planned.map((item) => item.entry.deckId);
  const abort: PinnedAbort = { deckId: null };
  const stop = (deckId: string | null, message: string): never => {
    abort.deckId = deckId;
    throw new Error(message);
  };
  // ★ The post-state has to survive the closure even when the COMMIT's outcome
  // does not. On an INDETERMINATE commit there is no `value` to return, yet this
  // is exactly the array an operator needs to reconcile with — and the same one
  // the recovery anchor already carries on disk.
  const captured: { postState: AtelierDeckPostState[] } = { postState: [] };

  const outcome = await withPinnedPgTransaction<AtelierDeckPostState[]>(async (client) => {
    // 1. Serialise against every other writer of these three rows. Transaction
    //    scoped: it is released by COMMIT or ROLLBACK, never leaked.
    //    ★ SAME KEY as `rollbackAtelierDecksOnPinnedClient` — one definition.
    await client.query('SELECT pg_advisory_xact_lock(?::bigint)', [
      atelierDeckLockKey(organizationId),
    ]);

    // 2. ★ CLOSE THE TOCTOU WINDOW. The plan above was decided from rows read
    //    with no lock held. Re-read them now and compare-and-swap; a presenter
    //    who saved a deck in that window must not have their work overwritten by
    //    a plan that no longer describes reality.
    const beforeWrite = await readSnapshotsOnClient(client, deckIds);
    for (const item of planned) {
      if (!item.observed) {
        stop(item.entry.deckId, 'no pre-write observation to compare against');
        continue;
      }
      const drift = describeDrift(
        item.observed,
        observeRow(beforeWrite.get(item.entry.deckId) ?? null)
      );
      if (drift) {
        stop(
          item.entry.deckId,
          `concurrent modification detected under the lock: ${drift} — nothing was written`
        );
      }
    }

    // 3. The writes themselves.
    for (const item of writes) {
      const statement = upsertStatement({
        organizationId,
        payload: item.payload as DeckPayload,
        version: item.entry.nextVersion ?? 1,
        timestamp,
      });
      const result = await client.query(statement.sql, statement.params);
      if (result.rowCount === 0) {
        // The `ON CONFLICT ... WHERE organization_id = excluded.organization_id`
        // arm refused it. A silently-zero upsert is exactly the "accepted but
        // not written" shape this module exists to catch.
        stop(item.entry.deckId, 'the upsert matched no row (the tenant guard refused it)');
      }
    }

    // 4. Read the rows back and prove them, still inside the transaction.
    const afterWrite = await readSnapshotsOnClient(client, deckIds);
    for (const item of planned) {
      if (!claimsPersistedState(item.entry.outcome)) continue;
      const problem = describePersistedRowProblem({
        organizationId,
        entry: item.entry,
        payload: item.payload,
        row: afterWrite.get(item.entry.deckId) ?? null,
      });
      if (problem) stop(item.entry.deckId, problem);
    }

    // 5. ★ CAPTURE THE POST-STATE UNDER THE LOCK, BEFORE COMMIT.
    //    Read after COMMIT and a presenter's first save could land in between —
    //    the manifest would then record THEIR row as the seed's own, and a later
    //    rollback would compare-and-swap successfully against their work and
    //    destroy it. Here nothing can slip in: the lock is still held and the
    //    rows are the ones this transaction is about to commit.
    const postState = await readPostStateOnClient(client, deckIds);
    captured.postState = postState;

    // 6. ★ THE RECOVERY ANCHOR, DURABLE BEFORE THE COMMIT.
    //    See `SeedAtelierPresentationDecksInput.persistRecoveryAnchor`. The
    //    ordering is the whole point: after this line returns, EVERY subsequent
    //    outcome — commit, rollback, a process death, a lost acknowledgement —
    //    is one an operator can reconcile, because the description of what this
    //    transaction was about to do is already on disk. A throw here takes the
    //    transaction with it, so "changed database, no anchor" has no window
    //    left to happen in.
    if (persistRecoveryAnchor) {
      try {
        await persistRecoveryAnchor(postState);
      } catch (error) {
        stop(
          null,
          'the recovery anchor could not be made durable before COMMIT: ' +
            `${(error as Error)?.message || 'unknown error'} — refusing to commit a change ` +
            'this tool would then be unable to undo'
        );
      }
    }

    return postState;
  });

  if (outcome.available === false) {
    logger.warn(
      `[atelierPresentationDeckSeed] ${organizationId}: pinned transaction unavailable ` +
        `(${outcome.reason}); falling back to a batched, NON-atomic apply`
    );
    return null;
  }

  if (outcome.state === 'rolled_back') {
    const cause = outcome.error;
    logger.error(
      `[atelierPresentationDeckSeed] ${organizationId}: pinned transaction rolled back — ${cause}`
    );
    for (const item of planned) {
      const { entry } = item;
      if (entry.outcome === 'failed') continue;
      // A `skipped` deck's claim ("we deliberately left it alone") survives a
      // rollback, so it stays skipped — unless it is the deck that aborted the
      // run, which the operator must see.
      if (entry.deckId === abort.deckId) {
        fail(entry, cause);
        entry.nextVersion = null;
        continue;
      }
      if (!claimsPersistedState(entry.outcome)) continue;
      fail(entry, `pinned transaction rolled back: ${cause}`);
      entry.nextVersion = null;
    }
    return summarize(planned, false, 'pinned-pg', [], 'rolled_back');
  }

  if (outcome.state === 'indeterminate') {
    // ★ NOT "ROLLED BACK". The COMMIT was sent and never answered, so these rows
    // may well be in the database. Every word here is chosen so that nobody
    // downstream can read it as "nothing changed".
    const cause = outcome.error;
    logger.error(
      `[atelierPresentationDeckSeed] ${organizationId}: the COMMIT outcome is INDETERMINATE — ` +
        `${cause} The recovery anchor written BEFORE this COMMIT describes exactly what the ` +
        'transaction was about to persist; reconcile the live rows against it. Do NOT re-run blind.'
    );
    for (const item of planned) {
      const { entry } = item;
      if (entry.outcome === 'failed') continue;
      if (!claimsPersistedState(entry.outcome)) continue;
      fail(
        entry,
        'the COMMIT outcome is INDETERMINATE: this row may or may not carry the seeded ' +
          `content — re-read it before assuming either. ${cause}`
      );
      entry.nextVersion = null;
    }
    // The post-state IS returned: it is the only description of what may now be
    // in the database, and it is byte-for-byte what the durable anchor carries.
    return summarize(planned, false, 'pinned-pg', captured.postState, 'indeterminate');
  }

  // ★ NO post-commit re-verification here on purpose. The read-back already ran
  // under the lock, inside the transaction, against the rows that were about to
  // be committed. Re-reading after COMMIT would race a legitimate editor and
  // turn their first save into a false "the seed failed".
  return summarize(planned, true, 'pinned-pg', outcome.value, 'committed');
}

/** Outcomes that assert something about the row as it now sits in the database. */
function claimsPersistedState(outcome: AtelierDeckOutcome): boolean {
  return outcome === 'inserted' || outcome === 'updated' || outcome === 'unchanged';
}

async function readSnapshotsOnClient(
  client: PinnedPgClient,
  deckIds: string[]
): Promise<Map<string, DeckRowSnapshot & { title?: string | null }>> {
  const result = await client.query<DeckRowSnapshot & { title?: string | null }>(
    `SELECT ${SNAPSHOT_COLUMNS}, title FROM presentation_decks WHERE id = ANY(?::text[])`,
    [deckIds]
  );
  return new Map(result.rows.map((row) => [String(row.id), row]));
}

/**
 * ★ TRUST THE DATABASE, NOT THE RETURN VALUE. Given the row as the database
 * actually holds it, prove: right tenant, DB-legal status, both content columns
 * present, derived card count === persisted `slide_count`, the fingerprint we
 * intended, and the version we planned. Returns the FIRST problem, or `null`.
 *
 * Pure, so the pinned path can use it to ABORT before COMMIT and the fallback
 * path can use it to DOWNGRADE after one — the same checks either way.
 */
function describePersistedRowProblem(params: {
  organizationId: string;
  entry: AtelierDeckPlanEntry;
  payload: DeckPayload | null;
  row: (DeckRowSnapshot & { title?: string | null }) | null;
}): string | null {
  const { organizationId, entry, payload, row } = params;

  if (!row) return 'read-back found no row after a write the database accepted';
  if (String(row.organization_id ?? '') !== organizationId) {
    return `read-back tenant mismatch: row belongs to '${row.organization_id ?? 'NULL'}', expected '${organizationId}'`;
  }
  if (!isDbWritableDeckStatus(String(row.status ?? ''))) {
    return `read-back status '${row.status ?? 'NULL'}' is not DB-writable`;
  }
  if (isBlank(row.deck_json) || isBlank(row.unified_json)) {
    return 'read-back found a row without both content columns';
  }

  const coherence = resolveDeckContentCoherence(row);
  if (coherence.cardCount !== entry.desiredSlideCount || !coherence.coherent) {
    return (
      `read-back count/content divergence: ${coherence.cardCount} cards vs slide_count ` +
      `${coherence.declaredSlideCount} (expected ${entry.desiredSlideCount})`
    );
  }

  const persisted = fingerprintDeckContent(row.deck_json || '', row.unified_json || '');
  const expected = payload?.fingerprint ?? entry.desiredFingerprint;
  if (persisted !== expected) {
    return 'read-back fingerprint mismatch: persisted content is not what the seed wrote';
  }

  const persistedVersion = Number.isFinite(Number(row.version)) ? Number(row.version) : null;
  if (entry.nextVersion != null && persistedVersion !== entry.nextVersion) {
    return `read-back version mismatch: persisted ${persistedVersion ?? 'NULL'}, expected ${entry.nextVersion}`;
  }

  return null;
}

/**
 * Post-commit read-back for the DEGRADED path only. The write is already
 * committed and cannot be undone, so a mismatch can only be REPORTED: the entry
 * is downgraded to `failed` and nothing downstream may count it as healthy.
 */
async function verifyReadBack(organizationId: string, planned: PlannedDeck[]): Promise<void> {
  for (const item of planned) {
    const { entry, payload } = item;
    if (!claimsPersistedState(entry.outcome)) continue;

    let row: (DeckRowSnapshot & { title?: string | null }) | null;
    try {
      row = await DbPromise.get<DeckRowSnapshot & { title?: string | null }>(
        `SELECT ${SNAPSHOT_COLUMNS}, title FROM presentation_decks WHERE id = ?`,
        [entry.deckId],
        { fallback: false }
      );
    } catch (error) {
      fail(entry, `read-back failed: ${(error as Error)?.message || 'unknown error'}`);
      continue;
    }

    const problem = describePersistedRowProblem({ organizationId, entry, payload, row });
    if (problem) fail(entry, problem);
  }
}

function fail(entry: AtelierDeckPlanEntry, reason: string): void {
  logger.error(`[atelierPresentationDeckSeed] ${entry.deckId}: ${reason}`);
  entry.outcome = 'failed';
  entry.reason = reason;
}

// ---------------------------------------------------------------------------
// BACKUP + ROLLBACK
// ---------------------------------------------------------------------------

/** Every column the upsert overwrites, plus the two keys. Order is the row order. */
const BACKUP_COLUMNS = [
  'id',
  'organization_id',
  'title',
  'description',
  'template_id',
  'deck_type',
  'audience',
  'goal',
  'language',
  'confidentiality',
  'theme',
  'presentation_mode',
  'source_type',
  'source_id',
  'source_artifacts',
  'outline_json',
  'unified_json',
  'deck_json',
  'source_refs_json',
  'slide_count',
  'status',
  'generated_by',
  'created_by',
  'created_at',
  'updated_at',
  'version',
] as const;

/**
 * The 24 columns a rollback restores: everything the upsert overwrites. `id` and
 * `organization_id` are excluded — they are the identity of the row, used to
 * TARGET the restore, never restored as values.
 */
const ROLLBACK_COLUMNS = BACKUP_COLUMNS.filter(
  (column) => column !== 'id' && column !== 'organization_id'
);

/**
 * ★ READ THE TIMESTAMPS AS TEXT, NEVER AS A `Date`.
 *
 * Verified read-only against the Railway `demo` PostgreSQL on 2026-08-01:
 * `presentation_decks.created_at` and `.updated_at` are
 * `timestamp WITHOUT time zone` (migrations 568 / 20260314 declare them that
 * way). For such a column node-pg builds a JS `Date` by interpreting the value
 * in the PROCESS timezone — so `toISOString()` then shifts it by the local UTC
 * offset, and a rollback that claims to restore the pre-state byte-identically
 * would silently move both timestamps on any host where `TZ !== UTC`.
 *
 * Casting in SQL removes the round-trip entirely: PostgreSQL renders the stored
 * value, we store that string, and the rollback writes the same string back.
 * `CAST(x AS TEXT)` is valid in SQLite too, so the test seam stays honest.
 */
const TEXT_CAST_COLUMNS = new Set<string>(['created_at', 'updated_at']);

const BACKUP_SELECT_LIST = BACKUP_COLUMNS.map((column) =>
  TEXT_CAST_COLUMNS.has(column) ? `CAST(${column} AS TEXT) AS ${column}` : column
).join(', ');

function toNullableText(value: unknown): string | null {
  if (value == null) return null;
  return String(value);
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBackupRow(raw: Record<string, unknown>): AtelierDeckBackupRow {
  return {
    id: String(raw.id),
    organization_id: toNullableText(raw.organization_id),
    title: toNullableText(raw.title),
    description: toNullableText(raw.description),
    template_id: toNullableText(raw.template_id),
    deck_type: toNullableText(raw.deck_type),
    audience: toNullableText(raw.audience),
    goal: toNullableText(raw.goal),
    language: toNullableText(raw.language),
    confidentiality: toNullableText(raw.confidentiality),
    theme: toNullableText(raw.theme),
    presentation_mode: toNullableText(raw.presentation_mode),
    source_type: toNullableText(raw.source_type),
    source_id: toNullableText(raw.source_id),
    source_artifacts: toNullableText(raw.source_artifacts),
    outline_json: toNullableText(raw.outline_json),
    unified_json: toNullableText(raw.unified_json),
    deck_json: toNullableText(raw.deck_json),
    source_refs_json: toNullableText(raw.source_refs_json),
    slide_count: toNullableNumber(raw.slide_count),
    status: toNullableText(raw.status),
    generated_by: toNullableText(raw.generated_by),
    created_by: toNullableText(raw.created_by),
    // ★ PASS THE TIMESTAMPS THROUGH UNTOUCHED — the SELECT already cast them to
    // TEXT (see BACKUP_SELECT_LIST), so this is the database's own rendering of
    // the stored value and the rollback writes that exact string back.
    //
    // Do NOT re-normalize them. These columns are `timestamp WITHOUT time zone`
    // on the live demo database, so every JS `Date` round-trip re-interprets the
    // value in the process timezone: `new Date('2026-05-01 08:00:00')` is LOCAL,
    // and `.toISOString()` then subtracts the offset. A real-PostgreSQL rollback
    // test on a UTC+2 host caught exactly that — the restored rows came back two
    // hours early, so "byte-identical" was false everywhere except UTC.
    created_at: toNullableText(raw.created_at),
    updated_at: toNullableText(raw.updated_at),
    version: toNullableNumber(raw.version),
  };
}

/**
 * Read-only snapshot of the three canonical rows, for a rollback manifest.
 *
 * Queries BY ID (not by organization) so a cross-tenant collision shows up in
 * the backup too — that row is exactly the one an operator must inspect.
 *
 * ★ Each id gets an EXPLICIT state. A SELECT that succeeded and returned nothing
 * is `'verified_absent'`; a SELECT that FAILED is `'unknown'` and makes the whole
 * backup incomplete. Collapsing those two into "no row" is how a rollback script
 * learns to DELETE a row it merely failed to read.
 */
export async function readAtelierDeckBackup(organizationId: string): Promise<AtelierDeckBackup> {
  const entries: AtelierDeckBackupEntry[] = [];

  for (const slug of ATELIER_DECK_SLUGS) {
    const deckId = organizationId ? atelierDeckId(organizationId, slug) : `--deck--${slug}`;
    if (!organizationId) {
      entries.push({
        deckId,
        state: 'unknown',
        row: null,
        error: 'organizationId is required — nothing was read, so nothing can be asserted',
      });
      continue;
    }
    try {
      const row = await DbPromise.get<Record<string, unknown>>(
        `SELECT ${BACKUP_SELECT_LIST} FROM presentation_decks WHERE id = ?`,
        [deckId],
        { fallback: false }
      );
      if (row) {
        entries.push({ deckId, state: 'exists', row: normalizeBackupRow(row), error: null });
      } else {
        entries.push({ deckId, state: 'verified_absent', row: null, error: null });
      }
    } catch (error) {
      const message = (error as Error)?.message || 'unknown error';
      logger.error(`[atelierPresentationDeckSeed] backup read failed for ${deckId}: ${message}`);
      entries.push({ deckId, state: 'unknown', row: null, error: message });
    }
  }

  return {
    organizationId,
    entries,
    complete: entries.every((entry) => entry.state !== 'unknown'),
  };
}

function dollarQuote(text: string): string {
  let tag = 'rb';
  let suffix = 0;
  while (text.includes(`$${tag}$`)) {
    suffix += 1;
    tag = `rb${suffix}`;
  }
  return `$${tag}$${text}$${tag}$`;
}

/**
 * A PostgreSQL literal for a captured value.
 *
 * JSON columns are full of quotes and backslashes, so anything that is not a
 * plain string is dollar-quoted: no escaping rules, no dependence on
 * `standard_conforming_strings`.
 */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`refusing to emit a non-finite number in rollback SQL: ${value}`);
    }
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return 'NULL';
    return `'${value.toISOString()}'`;
  }
  const text = String(value);
  if (text.includes('\0')) {
    throw new Error('refusing to emit a NUL byte in rollback SQL');
  }
  if (!/['\\$]/.test(text)) return `'${text}'`;
  return dollarQuote(text);
}

/**
 * The exact SQL that puts the three rows back the way they were.
 *
 *  - `'exists'`         -> UPDATE restoring all 24 overwritten columns, tenant-guarded;
 *  - `'verified_absent'`-> DELETE (the seed would have INSERTed it);
 *  - `'unknown'`        -> nothing is emitted at all, because the backup is
 *                          incomplete and this function throws first.
 *
 * ★ THROWS on an incomplete backup. Half a rollback is worse than none: it would
 * restore two decks and silently leave the third as the seed rewrote it, while
 * the operator reads "rollback applied". And a DELETE for an id whose SELECT
 * merely FAILED would destroy a row that was never touched.
 */
export function buildRollbackSql(backup: AtelierDeckBackup): string {
  const unreadable = backup.entries.filter((entry) => entry.state === 'unknown');
  if (!backup.complete || unreadable.length > 0) {
    throw new Error(
      '[atelierPresentationDeckSeed] refusing to build rollback SQL from an incomplete backup: ' +
        unreadable
          .map((entry) => `${entry.deckId} (${entry.error || 'state unknown'})`)
          .join('; ') +
        ' — re-run the snapshot before writing anything'
    );
  }

  const lines: string[] = [
    '-- Rollback manifest — canonical Atelier presentation decks (MAT-006B).',
    `-- organization: ${backup.organizationId}`,
    `-- decks: ${backup.entries.length}`,
    '-- Restores every column the seed upsert overwrites. PostgreSQL dialect.',
    'BEGIN;',
  ];

  for (const entry of backup.entries) {
    if (entry.state === 'verified_absent') {
      lines.push(
        `-- ${entry.deckId}: VERIFIED ABSENT before the run -> remove it to restore the pre-state.`,
        `DELETE FROM presentation_decks WHERE id = ${sqlLiteral(entry.deckId)} ` +
          `AND organization_id = ${sqlLiteral(backup.organizationId)};`
      );
      continue;
    }

    const row = entry.row;
    if (!row) {
      // Unreachable given the guard above; kept because a future edit to the
      // state machine must not be able to emit a silently empty manifest.
      throw new Error(
        `[atelierPresentationDeckSeed] backup entry ${entry.deckId} claims 'exists' with no row`
      );
    }

    const assignments = ROLLBACK_COLUMNS.map(
      (column) => `  ${column} = ${sqlLiteral(row[column])}`
    ).join(',\n');
    lines.push(
      `-- ${entry.deckId}: existed before the run -> restore all ${ROLLBACK_COLUMNS.length} overwritten columns.`,
      `UPDATE presentation_decks SET\n${assignments}\nWHERE id = ${sqlLiteral(entry.deckId)} ` +
        `AND organization_id = ${sqlLiteral(row.organization_id ?? backup.organizationId)};`
    );
  }

  lines.push('COMMIT;', '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// POST-STATE (the rollback's compare-and-swap target)
// ---------------------------------------------------------------------------

/**
 * ★ `updated_at` AS TEXT, exactly like the backup. Both sides of the CAS must be
 * the DATABASE's rendering of the value or the comparison compares two different
 * renderings of the same instant and refuses every rollback on a non-UTC host.
 */
const POST_STATE_SELECT_LIST =
  'id, organization_id, version, CAST(updated_at AS TEXT) AS updated_at, ' +
  'deck_json, unified_json, slide_count, status';

function absentPostState(deckId: string): AtelierDeckPostState {
  return {
    deckId,
    state: 'absent',
    organizationId: null,
    version: null,
    updatedAt: null,
    contentFingerprint: null,
    slideCount: null,
    status: null,
  };
}

function postStateFromRow(
  deckId: string,
  raw: Record<string, unknown> | null
): AtelierDeckPostState {
  if (!raw) return absentPostState(deckId);
  return {
    deckId,
    state: 'exists',
    organizationId: toNullableText(raw.organization_id),
    version: toNullableNumber(raw.version),
    // Straight through: the SELECT already cast it to TEXT. No `Date`, ever.
    updatedAt: toNullableText(raw.updated_at),
    contentFingerprint: fingerprintDeckContent(
      toNullableText(raw.deck_json) || '',
      toNullableText(raw.unified_json) || ''
    ),
    slideCount: toNullableNumber(raw.slide_count),
    status: toNullableText(raw.status),
  };
}

/**
 * Post-state of every id, read on a PINNED client (inside the transaction).
 *
 * ★ `forUpdate` closes the last window the advisory lock cannot. The lock only
 * serialises writers that ASK for it — the seed and this rollback. A presenter's
 * ordinary save does not, so without a row lock it could commit between the CAS
 * re-read and the restore, and PostgreSQL's READ COMMITTED re-check would still
 * let our UPDATE overwrite it (the id and tenant in the WHERE clause do not
 * change when somebody edits the content). `FOR UPDATE` makes the re-read block
 * on any such in-flight save and then read the version that actually won — so
 * the CAS judges the row the restore is really about to touch.
 */
async function readPostStateOnClient(
  client: PinnedPgClient,
  deckIds: string[],
  forUpdate = false
): Promise<AtelierDeckPostState[]> {
  const result = await client.query<Record<string, unknown>>(
    `SELECT ${POST_STATE_SELECT_LIST} FROM presentation_decks WHERE id = ANY($1::text[])` +
      (forUpdate ? ' FOR UPDATE' : ''),
    [deckIds]
  );
  const byId = new Map(result.rows.map((row) => [String(row.id), row]));
  return deckIds.map((deckId) => postStateFromRow(deckId, byId.get(deckId) ?? null));
}

/**
 * Read-only fingerprint of the three canonical rows AS THEY NOW ARE. Captured
 * immediately after a successful materialization and stored in the signed
 * manifest, so a later rollback can prove it is overwriting the seed's own row
 * and not somebody's later edit.
 *
 * ★ A deck whose read FAILED is OMITTED, never reported as `absent`. The
 * rollback requires an entry per backup id and refuses when one is missing, so
 * an unreadable row costs an operator a re-snapshot — while a fabricated
 * `absent` would tell the rollback to DELETE a row nobody could even read.
 */
export async function readAtelierDeckPostState(
  organizationId: string
): Promise<AtelierDeckPostState[]> {
  if (!organizationId) return [];

  const states: AtelierDeckPostState[] = [];
  for (const slug of ATELIER_DECK_SLUGS) {
    const deckId = atelierDeckId(organizationId, slug);
    try {
      const raw = await DbPromise.get<Record<string, unknown>>(
        `SELECT ${POST_STATE_SELECT_LIST} FROM presentation_decks WHERE id = ?`,
        [deckId],
        { fallback: false }
      );
      states.push(postStateFromRow(deckId, raw ?? null));
    } catch (error) {
      logger.error(
        `[atelierPresentationDeckSeed] post-state read failed for ${deckId}: ` +
          `${(error as Error)?.message || 'unknown error'} — the entry is OMITTED, ` +
          'so any rollback built from this manifest will refuse rather than guess'
      );
    }
  }
  return states;
}

// ---------------------------------------------------------------------------
// TRANSACTIONAL ROLLBACK EXECUTOR
// ---------------------------------------------------------------------------

export interface RollbackAtelierDecksInput {
  organizationId: string;
  /** The pre-state to restore — all 24 overwritten columns plus the two keys. */
  backup: AtelierDeckBackup;
  /** CAS target: what the manifest recorded right after the materialization. */
  expectedPostState: AtelierDeckPostState[];
}

export type RollbackStage = 'unavailable' | 'lock' | 'cas' | 'write' | 'readback' | 'indeterminate';

/** Every stage EXCEPT the one that means "we do not know what the database holds". */
export type RollbackFailureStage = Exclude<RollbackStage, 'indeterminate'>;

/** What a FRESH connection saw for one deck after an ambiguous COMMIT. */
export interface RollbackObservation {
  deckId: string;
  matches: 'pre-state' | 'post-state' | 'neither' | 'unreadable';
}

/**
 * What the reconciliation established after an ambiguous COMMIT. It is NOT a
 * stage: the stage stays `'indeterminate'` for every one of these, because the
 * COMMIT was dispatched and never answered in all of them.
 *
 * - `'not-applied'` — every deck still carries the post-materialization state,
 *   so the restore did not take effect. Evidence, but NOT the same claim as a
 *   determinate stage: nobody may say the executor rolled its own transaction
 *   back, because it never got to decide.
 * - `'mixed'`      — the rows were read and disagree with each other.
 * - `'unreadable'` — nothing was established at all (the read failed, or the
 *   in-doubt transaction has not ended yet).
 */
export type RollbackIndeterminateVerdict = 'not-applied' | 'mixed' | 'unreadable';

/**
 * ★ THE HONEST DEAD END.
 *
 * The rollback's COMMIT got no answer, and the fresh re-read did not license a
 * `restored: true`. There is nothing safe to retry automatically, so this says
 * so and names what was seen, per deck. `needsOperator` is `true` and never
 * anything else.
 *
 * ★ WHY IT DOES NOT REUSE A DETERMINATE STAGE. An earlier cut returned
 * `stage: 'write'` for the "every deck is still at the post-state" case. That
 * routes into the runner's determinate wording — *"The executor rolled its own
 * transaction back, so nothing was changed"* — which is false here twice over:
 * the executor rolled nothing back (it dispatched a COMMIT and lost the answer),
 * and "nothing was changed" is a claim about a database whose state we only
 * INFERRED from a read taken afterwards. The discriminator below lets a runner
 * word each case precisely without ever borrowing determinate language.
 */
export interface RollbackIndeterminate {
  ok: false;
  restored: false;
  stage: 'indeterminate';
  needsOperator: true;
  /** Which of the three indeterminate pictures this is. */
  verdict: RollbackIndeterminateVerdict;
  /** What a FRESH connection saw, per deck id, after the ambiguous COMMIT. */
  observed: RollbackObservation[];
  reason: string;
}

export type RollbackOutcome =
  | { ok: false; reason: string; stage: RollbackFailureStage; restored: false }
  | RollbackIndeterminate
  /** Every row read back after the restore, all 24 columns, byte-identical to the backup. */
  | { ok: true; restored: true; rows: AtelierDeckBackupRow[] };

function refuseRollback(stage: RollbackFailureStage, reason: string): RollbackOutcome {
  logger.error(`[atelierPresentationDeckSeed] rollback refused at ${stage}: ${reason}`);
  return { ok: false, restored: false, stage, reason };
}

/** First difference between the recorded post-state and the row under the lock. */
function describePostStateDrift(
  expected: AtelierDeckPostState,
  current: AtelierDeckPostState
): string | null {
  if (expected.state !== current.state) {
    return `the row is now '${current.state}' but the manifest recorded '${expected.state}'`;
  }
  if (current.state === 'absent') return null;
  if (expected.organizationId !== current.organizationId) {
    return `organization_id is '${current.organizationId ?? 'NULL'}', manifest recorded '${expected.organizationId ?? 'NULL'}'`;
  }
  if (expected.version !== current.version) {
    return `version is ${current.version ?? 'NULL'}, manifest recorded ${expected.version ?? 'NULL'}`;
  }
  if (expected.updatedAt !== current.updatedAt) {
    return `updated_at is '${current.updatedAt ?? 'NULL'}', manifest recorded '${expected.updatedAt ?? 'NULL'}'`;
  }
  if (expected.contentFingerprint !== current.contentFingerprint) {
    return 'content fingerprint changed — the row was edited after the materialization';
  }
  if (expected.slideCount !== current.slideCount) {
    return `slide_count is ${current.slideCount ?? 'NULL'}, manifest recorded ${expected.slideCount ?? 'NULL'}`;
  }
  if (expected.status !== current.status) {
    return `status is '${current.status ?? 'NULL'}', manifest recorded '${expected.status ?? 'NULL'}'`;
  }
  return null;
}

/** First of the 24 restored columns that did not come back byte-identical. */
function describeBackupRowMismatch(
  expected: AtelierDeckBackupRow,
  actual: AtelierDeckBackupRow
): string | null {
  if (expected.id !== actual.id) {
    return `read-back id '${actual.id}' is not the row that was restored ('${expected.id}')`;
  }
  for (const column of ROLLBACK_COLUMNS) {
    const want = expected[column] ?? null;
    const got = actual[column] ?? null;
    if (want !== got) {
      return `column '${column}' read back as ${JSON.stringify(got)}, backup holds ${JSON.stringify(want)}`;
    }
  }
  return null;
}

/** Verdict of a reconciliation read: what the three rows COLLECTIVELY say. */
export interface AtelierRollbackReconciliation {
  /**
   * - `'pre-state'`  — every deck is back where the backup found it: the
   *   rollback's transaction DID commit.
   * - `'post-state'` — every deck still carries what the materialization left:
   *   the rollback did NOT take effect.
   * - `'mixed'`      — the rows were read and disagree with each other.
   *   There is no verdict; an operator has to look.
   * - `'unreadable'` — NOTHING WAS ESTABLISHED: the fresh connection could not
   *   read (so no row is evidence of anything), or the in-doubt transaction is
   *   still holding the advisory lock, i.e. it has not decided YET and any read
   *   would be a snapshot taken before the answer exists.
   */
  verdict: 'pre-state' | 'post-state' | 'mixed' | 'unreadable';
  observed: RollbackObservation[];
  /** The freshly-read rows for every backup entry that existed. */
  rows: AtelierDeckBackupRow[];
  /** Per-deck detail, for the operator. Never a verdict on its own. */
  detail: string;
}

/**
 * ★ WHAT THE DATABASE ACTUALLY HOLDS, ASKED ON A CONNECTION THAT WAS NOT THERE.
 *
 * The only correct response to an ambiguous COMMIT: stop reasoning about the
 * transaction, open a FRESH connection, and read all 24 columns of all three
 * rows. Each row is compared against BOTH candidate realities — the backup
 * (pre-state) and the manifest post-state — and gets a label. The verdict is a
 * function of the labels, never of the failed transaction's error message.
 *
 * A deck can legitimately match BOTH (it was absent before the run and the run
 * left it absent, so there was nothing to undo). Those decks are counted as
 * satisfying either candidate, which is why the decision uses two independent
 * flags per deck rather than a single label: labelling such a deck 'pre-state'
 * and then demanding "every deck matches post-state" would manufacture a false
 * `mixed` on a perfectly ordinary rollback that simply did not run.
 *
 * ★ IT FIRST PROVES THE IN-DOUBT TRANSACTION HAS ENDED — AND THAT IS THE POINT.
 * A plain MVCC `SELECT` cannot tell "did not commit" from "has not committed
 * YET". The only way this code ever saw ambiguity in a test was by KILLING the
 * backend, and a dead backend has always already settled; but the case that
 * actually happens in production is a network partition or a proxy timeout,
 * which leaves the backend alive, inside `CommitTransaction`, milliseconds from
 * writing its commit record. Reading then and reporting "the restore did not
 * take effect" states as a fact something that is about to become false.
 *
 * The in-doubt transaction still holds `pg_advisory_xact_lock(<tenant key>)` —
 * the executor takes it as its first statement and PostgreSQL only releases it
 * when the transaction ENDS. So the fresh connection takes the SAME key with
 * `pg_try_advisory_xact_lock` before it reads anything:
 *   - NOT acquired  -> the transaction is still undecided. There is no verdict,
 *                      and this returns `'unreadable'` rather than inventing one.
 *   - acquired      -> the transaction has ended, one way or the other, and the
 *                      read that follows is authoritative.
 * Holding it across the read also keeps a concurrent rollback attempt from
 * moving the rows underneath the observation.
 *
 * Read-only: it issues no write, and a caller must still re-run preflight + lock
 * + CAS before touching anything.
 */
export async function reconcileAtelierDeckRollback(input: {
  organizationId: string;
  backup: AtelierDeckBackup;
  expectedPostState: AtelierDeckPostState[];
}): Promise<AtelierRollbackReconciliation> {
  const { organizationId, backup, expectedPostState } = input;
  const deckIds = backup.entries.map((entry) => entry.deckId);
  const expectedById = new Map(expectedPostState.map((state) => [state.deckId, state]));

  const unreadable = (detail: string): AtelierRollbackReconciliation => ({
    verdict: 'unreadable',
    observed: deckIds.map((deckId) => ({ deckId, matches: 'unreadable' as const })),
    rows: [],
    detail,
  });

  const read = await withFreshPgConnection(async (client) => {
    // An explicit transaction is what makes `pg_try_advisory_xact_lock` mean
    // anything: outside one, every statement is its own transaction and the lock
    // would be released before the SELECT that depends on it ran.
    await client.query('BEGIN');
    try {
      const lock = await client.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired',
        [atelierDeckLockKey(organizationId)]
      );
      if (lock.rows[0]?.acquired !== true) {
        return { settled: false as const, rows: [] as Array<Record<string, unknown>> };
      }
      const result = await client.query<Record<string, unknown>>(
        `SELECT ${BACKUP_SELECT_LIST} FROM presentation_decks WHERE id = ANY($1::text[])`,
        [deckIds]
      );
      return { settled: true as const, rows: result.rows };
    } finally {
      // Read-only, so either end is correct; COMMIT is the one that does not log
      // a scary line on the server for a transaction that did nothing wrong.
      try {
        await client.query('COMMIT');
      } catch {
        /* the connection is being closed either way */
      }
    }
  });

  if (read.available === false || read.ok === false) {
    const reason = read.available === false ? read.reason : read.error;
    // ★ NOT `pre-state`, and not `post-state` either. A read that did not happen
    // is evidence of NOTHING; the previous cut's instinct to fall back to a
    // "probably fine" label is exactly how a failed reconciliation becomes a
    // reported `restored: true`.
    return unreadable(`no row could be re-read on a fresh connection: ${reason}`);
  }

  if (read.value.settled === false) {
    return unreadable(
      `the in-doubt transaction still holds the tenant advisory lock for '${organizationId}', ` +
        'so it has NOT decided yet — any read now would be taken before the answer exists. ' +
        'Nothing can be concluded about these rows until that backend ends.'
    );
  }

  // A duplicate id (a botched migration drops the primary key) means the row is
  // not one thing, so it can equal neither candidate.
  const byId = new Map<string, Record<string, unknown> | 'duplicate'>();
  for (const raw of read.value.rows) {
    const id = String(raw.id);
    byId.set(id, byId.has(id) ? 'duplicate' : raw);
  }

  const observed: RollbackObservation[] = [];
  const rows: AtelierDeckBackupRow[] = [];
  const details: string[] = [];
  let everyPre = true;
  let everyPost = true;

  for (const entry of backup.entries) {
    const found = byId.get(entry.deckId) ?? null;
    const raw = found === 'duplicate' ? null : found;
    const duplicated = found === 'duplicate';
    const actual = raw ? normalizeBackupRow(raw) : null;
    if (actual) rows.push(actual);

    let matchesPre: boolean;
    if (duplicated) {
      matchesPre = false;
    } else if (entry.state === 'verified_absent') {
      matchesPre = actual === null;
    } else {
      const expectedRow = entry.row as AtelierDeckBackupRow;
      const guardTenant = expectedRow.organization_id ?? organizationId;
      matchesPre =
        actual !== null &&
        String(actual.organization_id ?? '') === String(guardTenant) &&
        describeBackupRowMismatch(expectedRow, actual) === null;
    }

    const expectedPost = expectedById.get(entry.deckId) ?? null;
    const matchesPost =
      !duplicated &&
      expectedPost !== null &&
      describePostStateDrift(expectedPost, postStateFromRow(entry.deckId, raw)) === null;

    everyPre = everyPre && matchesPre;
    everyPost = everyPost && matchesPost;

    const label: RollbackObservation['matches'] = matchesPre
      ? 'pre-state'
      : matchesPost
        ? 'post-state'
        : 'neither';
    observed.push({ deckId: entry.deckId, matches: label });
    details.push(
      `${entry.deckId}=${label}${duplicated ? ' (MORE THAN ONE ROW carries this id)' : ''}`
    );
  }

  const verdict = everyPre ? 'pre-state' : everyPost ? 'post-state' : 'mixed';
  return { verdict, observed, rows, detail: details.join('; ') };
}

/**
 * ★ THE ONLY SAFE WAY TO UNDO A MATERIALIZATION.
 *
 * The signed SQL manifest is a good AUDIT artifact and a terrible EXECUTION
 * plan: run through a plain write seam it takes no lock, so a presenter's save
 * can land between the preflight ("are any editors active?") and the restore;
 * it never inspects `rowCount`, so an UPDATE that matched ZERO rows is
 * indistinguishable from one that restored the row; and it never reads anything
 * back, so "RESTORED" is a claim about the statement, not about the database.
 *
 * This executor closes all three, in this order, on ONE pinned client:
 *
 *   connect → BEGIN
 *     → pg_advisory_xact_lock(<the SAME key the seed write takes>)
 *     → RE-READ the three rows AFTER the lock
 *     → CAS every one of them against the recorded post-state
 *     → restore: UPDATE (backup 'exists') / DELETE (backup 'verified_absent'),
 *       tenant-guarded, each requiring rowCount === 1 — 0 or >1 aborts
 *     → READ BACK all 24 columns and compare EXACTLY to the backup
 *   → COMMIT only when every check passed
 *
 * Any deviation ROLLBACKs on that same client and returns `ok: false` with the
 * stage. It never throws, and it never returns `restored: true` unless the rows
 * were read back and matched.
 *
 * ★ AND IF THE COMMIT ITSELF GETS NO ANSWER, it does not guess. It waits for the
 * in-doubt transaction to release the tenant advisory lock and then re-reads all
 * three rows on a FRESH connection (`reconcileAtelierDeckRollback`), comparing
 * all 24 columns against BOTH the backup and the manifest post-state. Every deck
 * back at the pre-state means the restore committed and only the acknowledgement
 * was lost (`restored: true`). EVERY OTHER OUTCOME stays on
 * `stage: 'indeterminate'` with `needsOperator: true`, the per-deck observation,
 * and a `verdict` that says which picture it is — `'not-applied'` (every deck
 * still at the post-state; re-run from the top, preflight, lock and CAS
 * included, NEVER the write alone), `'mixed'`, or `'unreadable'`. It never
 * returns a determinate stage there: a determinate stage licenses the sentence
 * "the executor rolled its own transaction back", and the executor never learned
 * what its transaction did. Where there is no PostgreSQL pool it returns
 * `stage: 'unavailable'` — there is NO fallback for a rollback, because a
 * "rollback" that is really a sequence of autocommitting statements on random
 * pooled clients is the defect, not a degraded version of the fix.
 */
export async function rollbackAtelierDecksOnPinnedClient(
  input: RollbackAtelierDecksInput
): Promise<RollbackOutcome> {
  // The whole body is guarded: a rollback executor that throws would strand the
  // caller with no stage and no verdict.
  try {
    const { organizationId, backup, expectedPostState } =
      input || ({} as RollbackAtelierDecksInput);

    // ---- REFUSALS BEFORE `BEGIN` -----------------------------------------
    if (!organizationId) {
      return refuseRollback('cas', 'organizationId is required — nothing can be tenant-guarded');
    }
    if (!backup || !Array.isArray(backup.entries)) {
      return refuseRollback('cas', 'no backup was supplied');
    }
    if (backup.organizationId !== organizationId) {
      return refuseRollback(
        'cas',
        `backup belongs to '${backup.organizationId}', not to '${organizationId}'`
      );
    }
    if (backup.entries.length !== ATELIER_DECK_SLUGS.length) {
      return refuseRollback(
        'cas',
        `backup carries ${backup.entries.length} entries, expected ${ATELIER_DECK_SLUGS.length}`
      );
    }
    const unreadable = backup.entries.filter((entry) => entry.state === 'unknown');
    if (backup.complete !== true || unreadable.length > 0) {
      // Same rule as `buildRollbackSql`: "I could not read it" may never become
      // "it was not there".
      return refuseRollback(
        'cas',
        'refusing an INCOMPLETE backup: ' +
          (unreadable.map((e) => `${e.deckId} (${e.error || 'state unknown'})`).join('; ') ||
            'complete=false') +
          ' — re-run the snapshot'
      );
    }
    for (const entry of backup.entries) {
      if (entry.state === 'exists' && !entry.row) {
        return refuseRollback('cas', `backup entry ${entry.deckId} claims 'exists' with no row`);
      }
    }

    const expectedById = new Map<string, AtelierDeckPostState>();
    for (const state of expectedPostState || []) {
      if (expectedById.has(state.deckId)) {
        return refuseRollback('cas', `post-state carries ${state.deckId} twice`);
      }
      expectedById.set(state.deckId, state);
    }
    const missing = backup.entries
      .filter((entry) => !expectedById.has(entry.deckId))
      .map((entry) => entry.deckId);
    if (missing.length > 0) {
      return refuseRollback(
        'cas',
        `no recorded post-state for ${missing.join(', ')} — there is nothing to compare-and-swap against`
      );
    }

    const unavailable = pinnedPgUnavailableReason();
    if (unavailable) {
      return refuseRollback(
        'unavailable',
        `${unavailable} — a rollback has NO non-transactional fallback`
      );
    }

    const deckIds = backup.entries.map((entry) => entry.deckId);
    const failure: { stage: RollbackFailureStage } = { stage: 'lock' };
    const abort = (stage: RollbackFailureStage, message: string): never => {
      failure.stage = stage;
      throw new Error(message);
    };

    const outcome = await withPinnedPgTransaction<AtelierDeckBackupRow[]>(async (client) => {
      // 1. ★ THE SAME LOCK THE SEED WRITE TAKES — one definition, one key. An
      //    editor's save either landed before this line or waits behind it.
      await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [
        atelierDeckLockKey(organizationId),
      ]);

      // 2. ★ RE-READ UNDER THE LOCK. Everything the operator's preflight saw was
      //    seen without one, and is therefore only a rumour by now.
      failure.stage = 'cas';
      const current = await readPostStateOnClient(client, deckIds, true);
      const currentById = new Map(current.map((state) => [state.deckId, state]));

      for (const entry of backup.entries) {
        const expected = expectedById.get(entry.deckId) as AtelierDeckPostState;
        const now = currentById.get(entry.deckId) ?? absentPostState(entry.deckId);
        const drift = describePostStateDrift(expected, now);
        if (drift) {
          abort(
            'cas',
            `${entry.deckId} moved after the materialization: ${drift} — nothing was restored`
          );
        }
      }

      // 3. Restore. Every statement must match EXACTLY ONE row: a rollback that
      //    changed nothing and a rollback that worked have the same shape unless
      //    somebody counts.
      failure.stage = 'write';
      for (const entry of backup.entries) {
        if (entry.state === 'verified_absent') {
          const expected = expectedById.get(entry.deckId) as AtelierDeckPostState;

          // ★ NOTHING WAS CREATED, SO THERE IS NOTHING TO UNDO.
          //
          // The row was absent before the run AND the materialization left it
          // absent (the seed skipped or failed that deck). Issuing a DELETE here
          // would match zero rows and, under the exactly-one rule below, abort a
          // rollback in which every deck is already in its target state. The CAS
          // above has ALREADY proved the row is still absent under the lock, so
          // skipping is not an assumption — it is the verified case. The
          // read-back still asserts absence, so a row appearing later is caught.
          if (expected.state === 'absent') continue;

          // Otherwise the run DID create the row, and it must go. The DELETE
          // targets the ROW THE CAS JUST APPROVED, not merely "the row with this
          // id". `FOR UPDATE` cannot lock a row that does not exist yet, so an
          // INSERT of this exact deck id landing between the re-read and here
          // would otherwise be deleted as if it were the seed's own work.
          // Guarding on the recorded version + updated_at makes such a row match
          // nothing, and rowCount 0 aborts the whole rollback.
          const deleted = await client.query(
            'DELETE FROM presentation_decks WHERE id = $1 AND organization_id = $2 ' +
              'AND version IS NOT DISTINCT FROM $3::int ' +
              'AND CAST(updated_at AS TEXT) IS NOT DISTINCT FROM $4::text',
            [entry.deckId, organizationId, expected.version, expected.updatedAt]
          );
          if (deleted.rowCount !== 1) {
            abort(
              'write',
              `DELETE of ${entry.deckId} matched ${deleted.rowCount} rows, expected exactly 1`
            );
          }
          continue;
        }

        const row = entry.row as AtelierDeckBackupRow;
        const guardTenant = row.organization_id ?? organizationId;
        const assignments = ROLLBACK_COLUMNS.map(
          (column, index) => `${column} = $${index + 1}`
        ).join(', ');
        const updated = await client.query(
          `UPDATE presentation_decks SET ${assignments} ` +
            `WHERE id = $${ROLLBACK_COLUMNS.length + 1} ` +
            `AND organization_id = $${ROLLBACK_COLUMNS.length + 2}`,
          [...ROLLBACK_COLUMNS.map((column) => row[column]), entry.deckId, guardTenant]
        );
        if (updated.rowCount !== 1) {
          abort(
            'write',
            `UPDATE of ${entry.deckId} matched ${updated.rowCount} rows, expected exactly 1 ` +
              '(the tenant guard refused it, or the row is gone)'
          );
        }
      }

      // 4. ★ PROVE IT, STILL INSIDE THE TRANSACTION. Verifying after COMMIT can
      //    only ever complain; verifying before it can still refuse.
      failure.stage = 'readback';
      const readBack = await client.query<Record<string, unknown>>(
        `SELECT ${BACKUP_SELECT_LIST} FROM presentation_decks WHERE id = ANY($1::text[])`,
        [deckIds]
      );
      const rawById = new Map(readBack.rows.map((raw) => [String(raw.id), raw]));

      const restoredRows: AtelierDeckBackupRow[] = [];
      for (const entry of backup.entries) {
        const raw = rawById.get(entry.deckId) ?? null;
        if (entry.state === 'verified_absent') {
          if (raw) {
            abort(
              'readback',
              `${entry.deckId} is still present after a DELETE that reported 1 row`
            );
          }
          continue;
        }
        if (!raw) {
          abort('readback', `${entry.deckId} read back as ABSENT after a restore of that row`);
        }
        const actual = normalizeBackupRow(raw as Record<string, unknown>);
        const expectedRow = entry.row as AtelierDeckBackupRow;
        const guardTenant = expectedRow.organization_id ?? organizationId;
        if (String(actual.organization_id ?? '') !== String(guardTenant)) {
          abort(
            'readback',
            `${entry.deckId} read back under tenant '${actual.organization_id ?? 'NULL'}', expected '${guardTenant}'`
          );
        }
        const mismatch = describeBackupRowMismatch(expectedRow, actual);
        if (mismatch) abort('readback', `${entry.deckId}: ${mismatch}`);
        restoredRows.push(actual);
      }

      // Everything agreed; from here only the COMMIT itself can fail. A COMMIT
      // the SERVER refused is a failed write and lands on this stage; a COMMIT
      // that got NO answer never reaches it — that outcome is `indeterminate`
      // and is settled by re-reading the database, not by a stage label.
      failure.stage = 'write';
      return restoredRows;
    });

    if (outcome.available === false) {
      return refuseRollback('unavailable', outcome.reason);
    }
    if (outcome.state === 'rolled_back') {
      // ROLLBACK already ran on that same client, or the server itself refused
      // the COMMIT. Nothing was restored, and this is the ONLY place a caller
      // could have been told otherwise.
      return refuseRollback(failure.stage as RollbackFailureStage, outcome.error);
    }

    if (outcome.state === 'indeterminate') {
      // ★ THE COMMIT WAS SENT AND NEVER ANSWERED. Reasoning stops here; the only
      // thing that can settle it is the database itself, asked on a connection
      // that had nothing to do with the transaction in doubt.
      logger.error(
        `[atelierPresentationDeckSeed] rollback COMMIT outcome is INDETERMINATE (${outcome.error})` +
          ' — re-reading all three rows on a FRESH connection to find out what is true'
      );
      const reconciliation = await reconcileAtelierDeckRollback({
        organizationId,
        backup,
        expectedPostState: expectedPostState || [],
      });

      if (reconciliation.verdict === 'pre-state') {
        // Every deck is byte-identical to the backup on a connection that never
        // saw the transaction. The restore DID commit; only its acknowledgement
        // was lost.
        logger.warn(
          '[atelierPresentationDeckSeed] the ambiguous rollback DID commit: a fresh read shows ' +
            `every deck byte-identical to the backup (${reconciliation.detail})`
        );
        return { ok: true, restored: true, rows: reconciliation.rows };
      }

      // ★ EVERY REMAINING CASE STAYS ON `stage: 'indeterminate'`. The COMMIT was
      // dispatched and never answered; no read taken afterwards turns that into
      // a determinate stage, and borrowing one would let a runner say "the
      // executor rolled its own transaction back" about a transaction whose
      // outcome the executor never learned. The `verdict` below is what a runner
      // words the difference from.
      const verdict: RollbackIndeterminateVerdict =
        reconciliation.verdict === 'post-state'
          ? 'not-applied'
          : reconciliation.verdict === 'unreadable'
            ? 'unreadable'
            : 'mixed';

      const reason =
        verdict === 'not-applied'
          ? `the rollback COMMIT got no answer (${outcome.error}) and a fresh re-read, taken once ` +
            `the in-doubt transaction had ended, shows every deck still carrying the ` +
            `post-materialization state (${reconciliation.detail}) — so the restore is not in ` +
            'the database. Re-run the rollback from the top — preflight, lock and ' +
            'compare-and-swap included. Never retry the write alone.'
          : verdict === 'unreadable'
            ? `the rollback COMMIT got no answer (${outcome.error}) and the state of the rows ` +
              `could NOT be established: ${reconciliation.detail}. Nothing is known about what ` +
              'the database now holds; read the rows named above against the manifest by hand ' +
              'before any further write.'
            : `the rollback COMMIT got no answer (${outcome.error}) and a fresh re-read of all ` +
              `three rows agrees with NEITHER the backup nor the manifest post-state: ` +
              `${reconciliation.detail}. This tool will not guess and will not retry: inspect ` +
              'the rows named above against the manifest before any further write.';

      const indeterminate: RollbackIndeterminate = {
        ok: false,
        restored: false,
        stage: 'indeterminate',
        needsOperator: true,
        verdict,
        observed: reconciliation.observed,
        reason,
      };
      logger.error(
        `[atelierPresentationDeckSeed] rollback INDETERMINATE (${verdict}): ${indeterminate.reason}`
      );
      return indeterminate;
    }

    return { ok: true, restored: true, rows: outcome.value };
  } catch (error) {
    return refuseRollback(
      'write',
      `unexpected rollback error: ${(error as Error)?.message || 'unknown error'}`
    );
  }
}
