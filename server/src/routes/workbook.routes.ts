/**
 * Workbook Routes — P23 extension: intelligent multi-sheet Excel generation.
 *
 * POST /api/workbook/generate — LLM generates WorkbookSchema → ExcelJS builds .xlsx
 * GET  /api/workbook/:id/download — download a previously generated workbook
 * POST /api/workbook/generate-and-download — one-shot: generate + immediate download
 * POST /api/workbook/:id/clone — CLONE: duplicate an existing workbook's schema into
 *      a new generated_workbooks row (editable starting point)
 */

import { createHash } from 'crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

import { withPgTransaction } from '../database/PostgresDatabase.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { demoContextMiddleware } from '../middleware/demoGuard.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../middleware/rbac.middleware.js';
import { requireAudit } from '../middleware/requireAudit.middleware.js';
import { buildOrgContextSourcePack } from '../services/documentStudio/documentOrgContextSourcePack.js';
// MAT-010 — canonical artifact lineage. `created` hooks use the `...Safe`
// variant: lineage recording must never alter this frozen MAT-05/06 flow.
// Every OTHER event type uses `...Tracked` (Codex review, second round) —
// see `respondIfLineageLost` below for why those sites CAN'T stay fire-open.
import {
  deriveCreatedEventIdempotencyKey,
  recordLineageEventSafe,
  recordLineageEventTracked,
} from '../services/lineage/artifactLineageService.js';
import { createP23Error } from '../services/v8/exceleCanon.js';
import {
  CustomWorkbookTemplateInvalidError,
  materializeCustomWorkbookSchema,
  resolveCustomWorkbookTemplate,
} from '../services/workbook/customWorkbookTemplateService.js';
import {
  buildWorkbookCsv,
  WorkbookCsvExportError,
} from '../services/workbook/workbookCsvExport.js';
import type { WorkbookQualityReport } from '../services/workbook/workbookQualityGate.js';
import { critiqueWorkbook } from '../services/workbook/workbookQualityGate.js';
import {
  ChartImageSchema,
  ConditionalFormattingBlockSchema,
  type WorkbookSchema,
  WorkbookSchemaValidator,
} from '../services/workbook/WorkbookSchema.js';
import { importWorkbookBuffer } from '../services/workbook/workbookImport.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import { retryWithBackoff } from '../utils/retryWithBackoff.js';

const router = Router();
const workbookImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /\.(xlsx|csv)$/i.test(file.originalname)),
});

// ---------------------------------------------------------------------------
// MAT-006 (2026-08-02) — public share reader. MUST be registered before
// `router.use(verifyToken)` below (mirrors presentations.routes.ts's
// `GET /shared/:token`, registered before that router's own
// `router.use(verifyToken)`) — this router is mounted at the SCOPED path
// `/api/workbook` (Gateway.ts), and registered before every bare-`/api`
// router in Gateway.ts, so a request to `/api/workbook/shared/:token`
// resolves here directly and never reaches any later bare-`/api` router's
// own `verifyToken` middleware. See workbook.routes.ts discovery notes
// (MAT-006 report) for the full audit of this bug class (found + fixed
// elsewhere for `workstreams.routes.ts` in MAT-007/009).
//
// Deny-list mirrors presentations' `PUBLIC_DECK_DENY_FIELDS` — strips every
// tenant/internal/actor field before the row ever leaves this process.
// ---------------------------------------------------------------------------
const WORKBOOK_PUBLIC_DENY_FIELDS = new Set([
  'organization_id',
  'created_by',
  'share_token',
  'share_created_by',
  'share_expires_at',
  'prompt',
  'pipeline_log',
  'validation_errors',
  'action_contract_json',
  'source_pack_json',
  'evidence_refs_json',
]);

function toPublicWorkbookRow(row: Record<string, unknown>) {
  const schemaJson = typeof row.schema_json === 'string' ? JSON.parse(row.schema_json) : null;
  const filtered = Object.fromEntries(
    Object.entries(row).filter(([k]) => !WORKBOOK_PUBLIC_DENY_FIELDS.has(k))
  );
  return {
    ...filtered,
    schema_json: undefined,
    sheets: Array.isArray(schemaJson?.sheets) ? schemaJson.sheets : [],
    title: (row.title as string) || schemaJson?.title || null,
    description: (row.description as string) || schemaJson?.description || null,
  };
}

const publicWorkbookViewerLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

/**
 * GET /api/workbook/shared/:token
 * Unauthenticated public reader for a shared workbook. Single 404 surface for
 * missing / revoked (token nulled by DELETE .../share) / expired — anti-
 * enumeration, matches presentations' `/shared/:token` design exactly.
 */
router.get(
  '/shared/:token',
  publicWorkbookViewerLimiter,
  asyncHandler(async (req, res) => {
    const row = await queryHelpers.queryOne<Record<string, unknown>>(
      // MAT-010: `organization_id` added to the projection ONLY to scope the
      // lineage hook below. The public payload is unchanged — `organization_id`
      // is the first entry in `WORKBOOK_PUBLIC_DENY_FIELDS`, so
      // `toPublicWorkbookRow()` strips it before the row leaves this process.
      `SELECT id, organization_id, title, description, schema_json, sheet_count, file_name, created_at, share_expires_at
       FROM generated_workbooks
       WHERE share_token = ? AND (share_expires_at IS NULL OR share_expires_at > CURRENT_TIMESTAMP)`,
      [req.params.token]
    );
    if (!row) {
      res.status(404).json({ error: 'Shared workbook not found' });
      return;
    }

    // MAT-010 lineage hook (fail-open). This request is UNAUTHENTICATED: the
    // tenant is derived server-side from the matched row, never from the
    // request, and there is no actor to attribute (`actorUserId: null`).
    // Recorded AFTER the row matched, so a revoked/expired/unknown token —
    // which returned 404 above — never produces a lineage entry.
    await recordLineageEventSafe({
      organizationId: String(row.organization_id),
      artifactKind: 'workbook',
      sourceRecordId: String(row.id),
      eventType: 'public_open',
      actorUserId: null,
      detail: { via: 'public_share_link' },
    });

    res.json({ data: toPublicWorkbookRow(row) });
  })
);

/**
 * Składa jeden czytelny string groundingu dla WorkbookGeneratorService z
 * wszystkich dostępnych źródeł (naprawa 2026-07-22, Fala A/A3). Wcześniej
 * `sourcePack`/`evidenceRefs` trafiały tylko do DB, a obiekt w `researchContext`
 * dawał „[object Object]" w prompcie. Preferuje kształt ContextPack
 * (key_points/data_points), inaczej bezpieczny JSON. Zwraca undefined gdy brak
 * czegokolwiek (model wtedy jawnie oznacza założenia). Cap 6000 znaków.
 */
function buildWorkbookGrounding(input: {
  researchContext?: unknown;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
}): string | undefined {
  const parts: string[] = [];
  const { researchContext, sourcePack, evidenceRefs } = input;

  if (typeof researchContext === 'string' && researchContext.trim()) {
    parts.push(researchContext.trim());
  } else if (researchContext && typeof researchContext === 'object') {
    try {
      parts.push(JSON.stringify(researchContext));
    } catch {
      /* ignore non-serializable */
    }
  }

  if (sourcePack && typeof sourcePack === 'object') {
    const sp = sourcePack as {
      key_points?: unknown;
      data_points?: unknown;
    };
    const keyPoints = Array.isArray(sp.key_points) ? sp.key_points.map(String) : [];
    const dataPoints = Array.isArray(sp.data_points)
      ? (sp.data_points as Array<{ label?: unknown; value?: unknown; unit?: unknown }>).map((d) =>
          `${String(d?.label ?? '')}: ${String(d?.value ?? '')}${d?.unit ? ` ${String(d.unit)}` : ''}`.trim()
        )
      : [];
    const lines = [...keyPoints, ...dataPoints].map((l) => l.trim()).filter(Boolean);
    if (lines.length) {
      parts.push(`Fakty ze źródeł (podstawa liczb — nie zaprzeczaj im):\n- ${lines.join('\n- ')}`);
    } else {
      try {
        parts.push(JSON.stringify(sourcePack));
      } catch {
        /* ignore */
      }
    }
  }

  if (Array.isArray(evidenceRefs) && evidenceRefs.length) {
    const refs = evidenceRefs
      .map((e) =>
        typeof e === 'string'
          ? e
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return '';
              }
            })()
      )
      .filter(Boolean);
    if (refs.length) parts.push(`Dowody: ${refs.join('; ')}`);
  }

  const text = parts.join('\n\n').trim();
  return text ? text.slice(0, 6000) : undefined;
}

/**
 * N2 (noc 2026-07-27/28) — Excel org-context grounding.
 *
 * PROBLEM (verified): `grep -r "factBook|spine|financialEngine" server/src/services/workbook/`
 * = 0 hits. The Excel generator is completely cut off from the organization's
 * context and fact book — the same project described in a deck/report and in a
 * workbook can show contradictory numbers (`_DOKTRYNA_TRESCI_EXCEL_2026-07-27.md`
 * §7/§10 L8, CTO decision D-5: "tak"). This closes the FIRST layer of that gap —
 * org identity + active projects/initiatives as ASSUMPTIONS-layer (A1) grounding,
 * not fabricated results. Full fact-book/spine wiring (§7 doctrine, producer side)
 * is explicitly OUT of scope here — deferred to a dedicated fala.
 *
 * REUSES `documentOrgContextSourcePack.buildOrgContextSourcePack` byte-for-byte —
 * the exact same function Document Studio's P0 URODZINOWE fix uses (org name/
 * industry via `AIContextBuilder._buildOrganizationContext` + active projects/
 * initiatives SQL). No second builder was written; the function is already fully
 * generic (takes only `organizationId`, returns plain data — no document-specific
 * shape leaks except the `sourceRef` field, which this caller simply ignores).
 *
 * DIFFERENCE vs Document Studio's `applyOrgContextGrounding`: there, auto-
 * grounding is SKIPPED whenever the caller supplied any `sourceRefs`, because an
 * explicit, curator-picked source pack must never be silently mixed with the
 * auto-built one (it drives a Sources QA gate). Workbook generation has no
 * equivalent curation/QA concept for `researchContext`/`sourcePack`/`evidenceRefs`
 * — those carry TOPIC-specific facts for the numbers, while org identity (who the
 * model is for, what else the org has live) is orthogonal. So here the org-context
 * summary is MERGED ONTO (prepended to) whatever grounding already exists, instead
 * of being skipped when other grounding is present.
 *
 * Fail-open: returns `null` on any lookup failure or empty/brand-new organization
 * — generation proceeds exactly as before, zero regression.
 */
async function buildWorkbookOrgContext(
  organizationId: string
): Promise<{ summaryPl: string; organizationName?: string } | null> {
  try {
    const pack = await buildOrgContextSourcePack(organizationId);
    if (!pack) return null;
    return {
      summaryPl: pack.contextSummaryPl,
      organizationName: pack.organizationName || undefined,
    };
  } catch (err) {
    logger.warn('[WorkbookRoutes] org-context grounding failed (fail-open, no regression)', {
      organizationId,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * A2 fix (2026-07-22): the dedicated artifact-run path (ExceleView /
 * useKimiArtifactPipeline.ts) only sends `artifactRunId` — which elsewhere in this
 * route is used SOLELY to adopt the Outputs Library card (see adoptRunArtifactForWorkbook
 * below) — so `buildWorkbookGrounding` above got nothing and the LLM prompt was silently
 * ungrounded on that path. When no explicit sourcePack/evidenceRefs/researchContext made
 * it into the request, hydrate a grounding string server-side from the run's own record:
 *   v8_artifact_runs (artifactRegistryService.getArtifactRun) → execution_run_id
 *   → v8_execution_runs (executionSpineService.getRun) → free-text `goal` (the brief
 *     that was captured when the run was planned from chat, see createArtifactRunFromChat).
 * FAIL-SOFT: any missing record or thrown error → undefined, logged as a warning —
 * generation must proceed ungrounded rather than fail.
 */
async function hydrateGroundingFromRun(params: {
  artifactRunId: string;
  organizationId: string;
}): Promise<string | undefined> {
  try {
    const { getArtifactRun } = await import('../services/v8/artifactRegistryService.js');
    const run = await getArtifactRun(params.artifactRunId, params.organizationId);
    if (!run) return undefined;

    const { getRun: getExecutionRun } = await import('../services/v8/executionSpineService.js');
    const executionRun = await getExecutionRun(run.executionRunId, params.organizationId);
    const goal = typeof executionRun?.goal === 'string' ? executionRun.goal.trim() : '';
    if (!goal) return undefined;

    const titleHint = typeof run.plan?.titleHint === 'string' ? run.plan.titleHint.trim() : '';
    const heading = titleHint
      ? `Brief z sesji (${titleHint}) — podstawa liczb, nie zaprzeczaj mu:`
      : 'Brief z sesji — podstawa liczb, nie zaprzeczaj mu:';
    return `${heading}\n${goal}`.slice(0, 6000);
  } catch (err) {
    logger.warn(
      `[WorkbookRoutes] hydrateGroundingFromRun failed for run ${params.artifactRunId}, continuing without grounding:`,
      err
    );
    return undefined;
  }
}

router.use(apiAuthRateLimiter);
router.use(verifyToken);
router.use(requireOrgAccess());
router.use(demoContextMiddleware);

// In-memory cache for recent workbooks (bounded to 50 entries)
//
// MAT-010 SECURITY FIX (2026-08-02) — TENANT SCOPING.
// -------------------------------------------------------------------------
// This cache used to be keyed by workbook id ALONE, with no organization on
// the entry, and was consulted by `GET /:id/download` and `GET /:id/schema`
// BEFORE any ownership check. `requireOrgAccess()` only proves the CALLER has
// a well-formed org — it does not scope the requested RESOURCE. A user in
// org B who knew or guessed an org A workbook id therefore read org A's
// cached title, schema and .xlsx bytes. Confirmed by executed test, not by
// code reading.
//
// The fix: every entry now carries its owning `organizationId`, and the ONLY
// way to read the cache is `getOwnedCachedWorkbook()`, which requires the
// caller's session org and returns undefined on mismatch. A cross-tenant
// request therefore falls through to the DB branch, whose
// `WHERE ... AND organization_id = ?` produces the SAME 404 body as an
// unknown id — no existence oracle. The legitimate owner's fast path is
// untouched.
//
// Chosen over composite keying (`${org}:${id}`) because the two eviction
// sites (`workbookCache.delete(id)` after a cell edit and after a restore)
// stay correct as-is: ids are UUIDs, so at most one entry can ever exist per
// id, and deleting by id can never strand another tenant's entry.
interface CachedWorkbook {
  buffer: Buffer;
  fileName: string;
  schema: any;
  createdAt: string;
  /** Owning tenant. Required — the cache is never readable without matching it. */
  organizationId: string;
}
const workbookCache = new Map<string, CachedWorkbook>();
const MAX_CACHE = 50;

/**
 * The ONLY sanctioned read of `workbookCache`. Grep for this name to audit
 * every cache-served response: a bare `workbookCache.get(...)` in a request
 * path is a tenant-isolation defect by construction.
 *
 * Returns the entry only when it exists AND belongs to the caller's org.
 */
function getOwnedCachedWorkbook(
  id: string,
  organizationId: string | null | undefined
): CachedWorkbook | undefined {
  if (!organizationId) return undefined;
  const entry = workbookCache.get(id);
  if (!entry) return undefined;
  if (entry.organizationId !== organizationId) return undefined;
  return entry;
}

function pruneCache() {
  if (workbookCache.size <= MAX_CACHE) return;
  const entries = [...workbookCache.entries()].sort((a, b) =>
    a[1].createdAt.localeCompare(b[1].createdAt)
  );
  while (workbookCache.size > MAX_CACHE) {
    workbookCache.delete(entries.shift()![0]);
  }
}

/**
 * MAT-010 (Codex review, second round) — the closing half of the durability
 * fix. `recordLineageEventTracked` tells the truth about whether an event's
 * intent survived ANYWHERE (direct write or the durable pending/outbox
 * fallback). When it did not — a genuine double failure — the calling route
 * must not report unconditional success (the business mutation already
 * committed and is NOT rolled back; only the HTTP response is honest about
 * the audit trail). Returns `true` when the caller should send this 500 and
 * stop; `false` when the caller should proceed with its normal response.
 *
 * Client-retry safety after this 500 is verified per event type at each call
 * site's own comment, not assumed uniformly — see
 * `recordLineageEventTracked`'s doc comment in artifactLineageService.ts for
 * the full reasoning (CAS guards on version/restore/checkpoint; single-column
 * overwrite, not accumulation, on share_minted; already-idempotent
 * share_revoked; no persisted side effect on export).
 */
function respondIfLineageLost(
  res: import('express').Response,
  outcome: { durable: boolean }
): boolean {
  if (outcome.durable) return false;
  res.status(500).json({
    success: false,
    error: 'Lineage could not be durably recorded for this operation',
    code: 'LINEAGE_RECOVERY_REQUIRED',
  });
  return true;
}

// Ensure storage table exists
async function ensureWorkbookSchema() {
  try {
    await queryHelpers.queryRun(`
      CREATE TABLE IF NOT EXISTS generated_workbooks (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        prompt TEXT,
        schema_json TEXT,
        sheet_count INTEGER DEFAULT 1,
        file_name TEXT,
        file_size INTEGER,
        validation_errors TEXT,
        quality_score REAL,
        pipeline_log TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Keep the additive migration portable. SQLite does not support
    // `ADD COLUMN IF NOT EXISTS`; wrapping the entire migration in one `try`
    // meant its first syntax error silently skipped every following column.
    // Adding each column independently is safe on SQLite and Postgres: an
    // already-existing column is the only expected failure and must not stop
    // later migrations.
    const additiveColumns = [
      `action_contract_json TEXT DEFAULT '{}'`,
      `source_pack_json TEXT DEFAULT '{}'`,
      `evidence_refs_json TEXT DEFAULT '[]'`,
      `classification TEXT DEFAULT 'internal'`,
      `lifecycle_status TEXT DEFAULT 'draft'`,
      `approval_current INTEGER DEFAULT 0`,
      `quality_report_json TEXT DEFAULT '{}'`,
      `version INTEGER DEFAULT 0`,
      `last_mutation_key TEXT`,
    ];
    for (const columnDefinition of additiveColumns) {
      try {
        await queryHelpers.queryRun(
          `ALTER TABLE generated_workbooks ADD COLUMN ${columnDefinition}`
        );
      } catch {
        // Column already exists. Other migration statements still have to run.
      }
    }
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_workbooks_org ON generated_workbooks(organization_id)`
    );
    // MAT-006 (2026-08-02) — lifecycle columns/table. Same runtime
    // self-healing idiom as the 3 columns above; the sanctioned migration
    // counterpart is `server/migrations/20260802_mat006_workbook_lifecycle.sql`.
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_token TEXT`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_created_by TEXT`
    );
    await queryHelpers.queryRun(
      `ALTER TABLE generated_workbooks ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP`
    );
    await queryHelpers.queryRun(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_workbooks_share_token ON generated_workbooks(share_token) WHERE share_token IS NOT NULL`
    );
    await queryHelpers.queryRun(`
      CREATE TABLE IF NOT EXISTS generated_workbook_versions (
        id TEXT PRIMARY KEY,
        workbook_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        schema_json_snapshot TEXT NOT NULL,
        sheet_count INTEGER DEFAULT 0,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryHelpers.queryRun(
      `CREATE INDEX IF NOT EXISTS idx_gwv_workbook_version ON generated_workbook_versions(workbook_id, version DESC)`
    );
  } catch {
    /* table may already exist */
  }
}

function ensureStableSheetIds(schema: WorkbookSchema): boolean {
  let changed = false;
  for (const sheet of schema.sheets || []) {
    if (!sheet.id) {
      sheet.id = uuidv4();
      changed = true;
    }
  }
  return changed;
}

function isValidRangeRef(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:[A-Z]{1,3}[1-9]\d*)(?::(?:[A-Z]{1,3}[1-9]\d*))?$/.test(value.trim().toUpperCase())
  );
}

type WorkbookCellMutation = {
  type: 'setCell' | 'clearCell';
  sheetIndex: number;
  rowIndex: number;
  columnKey: string;
  value?: string | number | boolean | null;
  formula?: string;
};

type WorkbookSheetMutation =
  | { type: 'addSheet'; name?: string; afterIndex?: number; sheetId?: string }
  | { type: 'renameSheet'; sheetId: string; name: string }
  | { type: 'duplicateSheet'; sheetId: string; name?: string; newSheetId?: string }
  | { type: 'deleteSheet'; sheetId: string }
  | { type: 'reorderSheet'; sheetId: string; targetIndex: number }
  | { type: 'setSheetHidden'; sheetId: string; hidden: boolean };

type WorkbookAxisMutation =
  | { type: 'insertRows' | 'deleteRows'; sheetIndex: number; atIndex: number; count: number }
  | { type: 'insertColumns' | 'deleteColumns'; sheetIndex: number; atIndex: number; count: number };

type WorkbookCellStyleMutation = {
  type: 'setCellStyle';
  sheetIndex: number;
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  patch: Partial<CellStyle>;
};

type WorkbookMutation =
  | WorkbookCellMutation
  | WorkbookSheetMutation
  | WorkbookAxisMutation
  | WorkbookCellStyleMutation;

type WorkbookAnchorTransform = WorkbookAxisMutation & { sheetId: string };

const WORKBOOK_SHEET_NAME_FORBIDDEN = /[\[\]:*?/\\]/;

function normalizedSheetName(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid sheet name');
  const name = value.trim();
  if (!name || name.length > 31 || WORKBOOK_SHEET_NAME_FORBIDDEN.test(name)) {
    throw new Error('Invalid sheet name');
  }
  return name;
}

function uniqueSheetName(schema: WorkbookSchema, requested: string, excludeId?: string): string {
  const base = normalizedSheetName(requested);
  const occupied = new Set(
    schema.sheets
      .filter((sheet) => sheet.id !== excludeId)
      .map((sheet) => sheet.name.toLocaleLowerCase())
  );
  if (!occupied.has(base.toLocaleLowerCase())) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const suffixText = ` (${suffix})`;
    const candidate = `${base.slice(0, 31 - suffixText.length)}${suffixText}`;
    if (!occupied.has(candidate.toLocaleLowerCase())) return candidate;
  }
  throw new Error('Unable to create unique sheet name');
}

function mutationSheetId(value?: string): string {
  if (value === undefined) return uuidv4();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('Invalid sheet id');
  }
  return value;
}

function createBlankSheet(name: string, sheetId?: string): WorkbookSchema['sheets'][number] {
  const columns = Array.from({ length: 12 }, (_, index) => {
    let current = index + 1;
    let key = '';
    while (current > 0) {
      key = String.fromCharCode(65 + ((current - 1) % 26)) + key;
      current = Math.floor((current - 1) / 26);
    }
    return { key, header: key };
  });
  return {
    id: mutationSheetId(sheetId),
    name,
    columns,
    rows: Array.from({ length: 30 }, () => ({ cells: {} })),
  };
}

function applyWorkbookSheetMutation(
  schema: WorkbookSchema,
  operation: WorkbookSheetMutation
): { orphanedSheetId?: string } {
  const findIndex = (sheetId: string) => schema.sheets.findIndex((sheet) => sheet.id === sheetId);

  if (operation.type === 'addSheet') {
    const name = uniqueSheetName(schema, operation.name || 'Arkusz');
    const requestedIndex =
      operation.afterIndex === undefined ? schema.sheets.length : operation.afterIndex + 1;
    if (
      !Number.isInteger(requestedIndex) ||
      requestedIndex < 0 ||
      requestedIndex > schema.sheets.length
    ) {
      throw new Error('Invalid sheet insertion index');
    }
    const id = mutationSheetId(operation.sheetId);
    if (schema.sheets.some((sheet) => sheet.id === id)) throw new Error('Duplicate sheet id');
    schema.sheets.splice(requestedIndex, 0, createBlankSheet(name, id));
    return {};
  }

  const sheetIndex = findIndex(operation.sheetId);
  if (sheetIndex < 0) throw new Error('Unknown sheetId');
  const sheet = schema.sheets[sheetIndex];

  if (operation.type === 'renameSheet') {
    sheet.name = uniqueSheetName(schema, operation.name, sheet.id);
  } else if (operation.type === 'duplicateSheet') {
    const clone = JSON.parse(JSON.stringify(sheet)) as typeof sheet;
    clone.id = mutationSheetId(operation.newSheetId);
    if (schema.sheets.some((existing) => existing.id === clone.id)) {
      throw new Error('Duplicate sheet id');
    }
    clone.name = uniqueSheetName(schema, operation.name || `${sheet.name} kopia`);
    clone.hidden = false;
    schema.sheets.splice(sheetIndex + 1, 0, clone);
  } else if (operation.type === 'deleteSheet') {
    if (schema.sheets.length === 1) throw new Error('Cannot delete the last sheet');
    schema.sheets.splice(sheetIndex, 1);
    return { orphanedSheetId: operation.sheetId };
  } else if (operation.type === 'reorderSheet') {
    if (
      !Number.isInteger(operation.targetIndex) ||
      operation.targetIndex < 0 ||
      operation.targetIndex >= schema.sheets.length
    ) {
      throw new Error('Invalid targetIndex');
    }
    schema.sheets.splice(sheetIndex, 1);
    schema.sheets.splice(operation.targetIndex, 0, sheet);
  } else if (operation.type === 'setSheetHidden') {
    if (operation.hidden && !sheet.hidden) {
      const visibleCount = schema.sheets.filter((candidate) => !candidate.hidden).length;
      if (visibleCount <= 1) throw new Error('Cannot hide the last visible sheet');
    }
    sheet.hidden = operation.hidden;
  }
  return {};
}

function applyWorkbookCellMutation(schema: WorkbookSchema, operation: WorkbookCellMutation): void {
  const { sheetIndex, rowIndex, columnKey } = operation;
  if (!Number.isInteger(sheetIndex) || sheetIndex < 0) throw new Error('Invalid sheetIndex');
  if (!Number.isInteger(rowIndex) || rowIndex < 0) throw new Error('Invalid rowIndex');
  if (typeof columnKey !== 'string' || !columnKey.trim()) throw new Error('Invalid columnKey');
  if (operation.formula !== undefined && typeof operation.formula !== 'string') {
    throw new Error('Invalid formula');
  }
  if (
    operation.value !== undefined &&
    operation.value !== null &&
    !['string', 'number', 'boolean'].includes(typeof operation.value)
  ) {
    throw new Error('Invalid value');
  }

  const sheet = schema.sheets?.[sheetIndex];
  if (!sheet?.rows || !sheet.columns) throw new Error(`Unknown sheetIndex ${sheetIndex}`);
  if (rowIndex >= sheet.rows.length) throw new Error(`Unknown rowIndex ${rowIndex}`);
  if (!sheet.columns.some((column) => column.key === columnKey)) {
    throw new Error(`Unknown columnKey ${columnKey}`);
  }

  const targetRow = sheet.rows[rowIndex];
  if (!targetRow.cells) targetRow.cells = {};
  const oldCell = targetRow.cells[columnKey] ?? {};
  const nextCell: Record<string, unknown> = {
    style: oldCell.style,
    comment: oldCell.comment,
    validation: oldCell.validation,
  };
  if (operation.type === 'setCell') {
    const formula = operation.formula?.trim().replace(/^=+/, '');
    if (formula) nextCell.formula = formula;
    else if (operation.value !== undefined) nextCell.value = operation.value;
  }
  targetRow.cells[columnKey] = nextCell as (typeof targetRow.cells)[string];
}

const WORKBOOK_STYLE_KEYS = new Set([
  'bold',
  'italic',
  'fontColor',
  'bgColor',
  'numberFormat',
  'alignment',
  'wrapText',
  'border',
]);

function applyWorkbookCellStyleMutation(
  schema: WorkbookSchema,
  operation: WorkbookCellStyleMutation
): void {
  const { sheetIndex, startRow, endRow, startColumn, endColumn, patch } = operation;
  if (![sheetIndex, startRow, endRow, startColumn, endColumn].every(Number.isInteger)) {
    throw new Error('Invalid cell style range');
  }
  if (
    sheetIndex < 0 ||
    startRow < 0 ||
    startColumn < 0 ||
    endRow < startRow ||
    endColumn < startColumn
  ) {
    throw new Error('Invalid cell style range');
  }
  if (
    !patch ||
    typeof patch !== 'object' ||
    Array.isArray(patch) ||
    Object.keys(patch).length === 0
  ) {
    throw new Error('Cell style patch must not be empty');
  }
  if (Object.keys(patch).some((key) => !WORKBOOK_STYLE_KEYS.has(key))) {
    throw new Error('Unsupported cell style property');
  }
  const sheet = schema.sheets?.[sheetIndex];
  if (!sheet || endRow >= sheet.rows.length || endColumn >= sheet.columns.length) {
    throw new Error('Unknown cell style range');
  }
  const cellCount = (endRow - startRow + 1) * (endColumn - startColumn + 1);
  if (cellCount > 10_000) throw new Error('Cell style range is too large');

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = sheet.rows[rowIndex];
    if (!row.cells) row.cells = {};
    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      const columnKey = sheet.columns[columnIndex].key;
      const cell = row.cells[columnKey] ?? {};
      cell.style = { ...(cell.style ?? {}), ...patch };
      row.cells[columnKey] = cell;
    }
  }
}

function columnLettersToIndex(value: string): number {
  return (
    value
      .replace(/\$/g, '')
      .split('')
      .reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
  );
}

function columnIndexToLetters(index: number): string {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function shiftAxisIndex(
  value: number,
  operation: WorkbookAxisMutation,
  axis: 'row' | 'column'
): number | null {
  const relevant =
    axis === 'row'
      ? operation.type === 'insertRows' || operation.type === 'deleteRows'
      : operation.type === 'insertColumns' || operation.type === 'deleteColumns';
  if (!relevant) return value;
  const inserting = operation.type === 'insertRows' || operation.type === 'insertColumns';
  if (inserting) return value >= operation.atIndex ? value + operation.count : value;
  if (value < operation.atIndex) return value;
  if (value >= operation.atIndex + operation.count) return value - operation.count;
  return null;
}

function transformCellReference(reference: string, operation: WorkbookAxisMutation): string {
  const match = /^(\$?)([A-Z]{1,3})(\$?)([1-9]\d*)$/.exec(reference.toUpperCase());
  if (!match) return reference;
  const column = shiftAxisIndex(columnLettersToIndex(match[2]), operation, 'column');
  // Workbook row index 0 is Excel row 2 because row 1 contains schema column headers.
  const row = shiftAxisIndex(Number(match[4]) - 2, operation, 'row');
  if (column === null || row === null || row < -1) return '#REF!';
  return `${match[1]}${columnIndexToLetters(column)}${match[3]}${row + 2}`;
}

function transformFormulaReferences(
  formula: string,
  formulaSheetName: string,
  targetSheetName: string,
  operation: WorkbookAxisMutation
): string {
  const referencePattern =
    /(?:(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_. ]*))!)?(\$?[A-Z]{1,3}\$?[1-9]\d*)/g;
  return formula.replace(referencePattern, (whole, quotedSheet, plainSheet, reference) => {
    const explicitSheet = quotedSheet ? String(quotedSheet).replace(/''/g, "'") : plainSheet;
    const pointsToTarget = explicitSheet
      ? explicitSheet.toLocaleLowerCase() === targetSheetName.toLocaleLowerCase()
      : formulaSheetName.toLocaleLowerCase() === targetSheetName.toLocaleLowerCase();
    if (!pointsToTarget) return whole;
    const prefix = whole.slice(0, whole.length - reference.length);
    return `${prefix}${transformCellReference(reference, operation)}`;
  });
}

function transformRangeRef(rangeRef: string, operation: WorkbookAxisMutation): string | null {
  const parts = rangeRef.trim().toUpperCase().split(':');
  const transformed = parts.map((part) => transformCellReference(part, operation));
  if (transformed.every((part) => part === '#REF!')) return null;
  if (transformed.some((part) => part === '#REF!')) return null;
  return transformed.join(':');
}

function applyWorkbookAxisMutation(
  schema: WorkbookSchema,
  operation: WorkbookAxisMutation
): WorkbookAnchorTransform {
  if (!Number.isInteger(operation.sheetIndex) || operation.sheetIndex < 0)
    throw new Error('Invalid sheetIndex');
  if (!Number.isInteger(operation.atIndex) || operation.atIndex < 0)
    throw new Error('Invalid axis index');
  if (!Number.isInteger(operation.count) || operation.count < 1 || operation.count > 100) {
    throw new Error('Axis mutation count must be between 1 and 100');
  }
  const sheet = schema.sheets[operation.sheetIndex];
  if (!sheet?.id) throw new Error('Unknown sheetIndex');

  if (operation.type === 'insertRows') {
    if (operation.atIndex > sheet.rows.length) throw new Error('Invalid row insertion index');
    sheet.rows.splice(
      operation.atIndex,
      0,
      ...Array.from({ length: operation.count }, () => ({ cells: {} }))
    );
  } else if (operation.type === 'deleteRows') {
    if (operation.atIndex + operation.count > sheet.rows.length)
      throw new Error('Invalid row deletion range');
    if (operation.count >= sheet.rows.length) throw new Error('Cannot delete all rows');
    sheet.rows.splice(operation.atIndex, operation.count);
  } else if (operation.type === 'insertColumns') {
    if (operation.atIndex > sheet.columns.length) throw new Error('Invalid column insertion index');
    const inserted = Array.from({ length: operation.count }, (_, offset) => ({
      key: `col_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
      header: columnIndexToLetters(operation.atIndex + offset),
    }));
    sheet.columns.splice(operation.atIndex, 0, ...inserted);
  } else {
    if (operation.atIndex + operation.count > sheet.columns.length)
      throw new Error('Invalid column deletion range');
    if (operation.count >= sheet.columns.length) throw new Error('Cannot delete all columns');
    const removedKeys = new Set(
      sheet.columns
        .slice(operation.atIndex, operation.atIndex + operation.count)
        .map((column) => column.key)
    );
    sheet.columns.splice(operation.atIndex, operation.count);
    for (const row of sheet.rows) {
      for (const key of removedKeys) delete row.cells[key];
    }
  }

  for (const formulaSheet of schema.sheets) {
    for (const row of formulaSheet.rows || []) {
      for (const cell of Object.values(row.cells || {})) {
        if (typeof cell.formula === 'string') {
          cell.formula = transformFormulaReferences(
            cell.formula,
            formulaSheet.name,
            sheet.name,
            operation
          );
        }
      }
    }
  }
  return { ...operation, sheetId: sheet.id };
}

function asExportMode(value: unknown): ArtifactExportMode {
  return value === 'final' ? 'final' : 'draft';
}

function asClassification(value: unknown): ArtifactClassification {
  return value === 'public' || value === 'confidential' ? value : 'internal';
}

function countCriticalQaFindings(value: string | null | undefined): number {
  if (!value) return 0;
  try {
    const report = JSON.parse(value) as { issues?: Array<{ severity?: string }> };
    return Array.isArray(report.issues)
      ? report.issues.filter((issue) => issue?.severity === 'critical').length
      : 0;
  } catch {
    // A malformed governance snapshot cannot be treated as a clean report.
    return 1;
  }
}

function draftFileName(fileName: string): string {
  const normalized = fileName || 'workbook.xlsx';
  return /\.xlsx$/i.test(normalized)
    ? normalized.replace(/\.xlsx$/i, '-DRAFT.xlsx')
    : `${normalized}-DRAFT.xlsx`;
}

/**
 * Shared tail for any produced workbook (free-form `/generate` OR parametric
 * `/templates/:id/build`): cache the buffer for download, persist metadata, and
 * register/adopt the Outputs Library artifact — then return the JSON response
 * payload. Persistence is fail-hard: no cache, registry entry or success response
 * may exist unless the canonical generated_workbooks row was durably inserted.
 * Artifact registration remains best-effort after that durable boundary.
 */
async function finalizeGeneratedWorkbook(params: {
  result: {
    id: string;
    schema: any;
    buffer: Buffer;
    fileName: string;
    validationErrors: string[];
    classifiedErrors?: unknown;
    qualityScore: number | null;
    /** Deterministyczny krytyk jakości (critiqueWorkbook) — score 0-100 + issues[].
     *  Addytywne pole (2026-07-23): liczone już wcześniej (template-path i free-form),
     *  tu tylko dołączane do odpowiedzi, żeby FE mógł pokazać nieblokujący badge. */
    qualityReport?: WorkbookQualityReport | null;
    pipelineLog: unknown;
    generatedAt: string;
  };
  user: { id: string; organizationId: string };
  /** Stored in the `prompt` column (free-form prompt, or a template descriptor). */
  promptText: string;
  source: string;
  projectId?: string | null;
  sourceInitiativeId?: string | null;
  conversationId?: string | null;
  actionContract?: unknown;
  sourcePack?: unknown;
  evidenceRefs?: unknown;
  artifactRunId?: string | null;
}): Promise<Record<string, unknown>> {
  const { result, user } = params;

  // Persist metadata
  const persistResult = await queryHelpers.queryRun(
    `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      user.organizationId,
      result.schema.title,
      result.schema.description || null,
      params.promptText,
      JSON.stringify(result.schema),
      result.schema.sheets.length,
      result.fileName,
      result.buffer.length,
      result.validationErrors.length > 0 ? JSON.stringify(result.validationErrors) : null,
      result.qualityScore,
      JSON.stringify(result.pipelineLog),
      JSON.stringify(
        params.actionContract && typeof params.actionContract === 'object'
          ? params.actionContract
          : {}
      ),
      JSON.stringify(
        params.sourcePack && typeof params.sourcePack === 'object' ? params.sourcePack : {}
      ),
      JSON.stringify(Array.isArray(params.evidenceRefs) ? params.evidenceRefs : []),
      user.id,
      result.generatedAt,
    ]
  );
  if (!persistResult || persistResult.changes !== 1) {
    throw new Error(`Workbook persistence did not insert exactly one row (${result.id})`);
  }

  // Cache only after durable persistence succeeds.
  workbookCache.set(result.id, {
    buffer: result.buffer,
    fileName: result.fileName,
    schema: result.schema,
    createdAt: result.generatedAt,
    organizationId: user.organizationId,
  });
  pruneCache();

  // Register in V8 artifact registry (P19 Outputs Library integration)
  let artifactId: string | null = null;
  try {
    const { registerArtifactOrigin, adoptRunArtifactForWorkbook } =
      await import('../services/v8/artifactRegistryService.js');

    const originSummary = {
      title: result.schema.title,
      description: result.schema.description || null,
      sheetCount: result.schema.sheets.length,
      exportFormat: 'xlsx',
      source: params.source,
      qualityScore: result.qualityScore,
      sourceRefs: {
        conversationId: params.conversationId || null,
        initiativeId: params.sourceInitiativeId || null,
        projectId: params.projectId || null,
      },
    };

    // P-2 split-brain fix (excele lane): adopt an existing run's single artifact
    // rather than minting a second Outputs card. One click = one card.
    if (typeof params.artifactRunId === 'string' && params.artifactRunId.trim()) {
      artifactId = await adoptRunArtifactForWorkbook({
        runId: params.artifactRunId.trim(),
        organizationId: user.organizationId,
        workbookId: result.id,
        title: result.schema.title || 'Untitled workbook',
        originSummary,
      });
      if (artifactId) {
        logger.info(
          `[WorkbookRoutes] Adopted run ${params.artifactRunId} artifact ${artifactId} onto workbook ${result.id} (no duplicate card)`
        );
      }
    }

    // Fallback: standalone workbook (no run) OR the run had no adoptable artifact.
    // Fala sprzątania 1b (2026-07-27) — this used to be a single unretried
    // attempt logged at `warn` with no workbook/artifact id in the
    // structured fields (rejestr: "dokument może powstać i nigdy nie
    // pojawić się w bibliotece", same defect class as the Document Studio
    // path in document-studio.routes.ts). `registerArtifactOrigin` is
    // idempotent (checks the existing origin link before inserting), so
    // retrying after a transient failure is always safe.
    if (!artifactId) {
      const registered = await retryWithBackoff(
        () =>
          registerArtifactOrigin({
            organizationId: user.organizationId,
            outputType: 'sheet',
            artifactFamily: 'sheet',
            originRuntime: 'sheet',
            originRecordId: result.id,
            titleSnapshot: result.schema.title || 'Untitled workbook',
            ownerUserId: user.id,
            createdBy: user.id,
            deliveryState: 'ready',
            visibilityScope: 'organization',
            projectId: params.projectId || null,
            sourceInitiativeId: params.sourceInitiativeId || null,
            originSummary,
          }),
        {
          onAttemptFailed: (attempt, attempts, attemptErr) => {
            logger.warn('[WorkbookRoutes] Register artifact attempt failed (will retry)', {
              workbookId: result.id,
              organizationId: user.organizationId,
              attempt,
              attempts,
              message: attemptErr instanceof Error ? attemptErr.message : String(attemptErr),
            });
          },
        }
      );
      artifactId = registered?.artifactId ?? null;
      if (artifactId) {
        logger.info(`[WorkbookRoutes] Registered artifact ${artifactId} for workbook ${result.id}`);
      }
    }
  } catch (err) {
    logger.error(
      '[WorkbookRoutes] Failed to register workbook in artifact registry after retries',
      {
        workbookId: result.id,
        organizationId: user.organizationId,
        artifactId,
        message: err instanceof Error ? err.message : String(err),
      }
    );
  }

  // MAT-010 lineage hook (fail-open) — head of the lineage chain. Placed in
  // this SHARED tail so both `/generate` and `/templates/:id/build` are covered
  // by one insertion, and after the registry attempt above so the canonical
  // artifact id resolves immediately in the normal case.
  await recordLineageEventSafe({
    organizationId: user.organizationId,
    artifactKind: 'workbook',
    sourceRecordId: result.id,
    eventType: 'created',
    actorUserId: user.id,
    titleSnapshot: result.schema?.title ?? null,
    // Deterministic key — closes a real race against the backfill scan's
    // deterministic-rebuild path (both derive the SAME key for the SAME
    // artifact), so whichever writes second dedups instead of duplicating.
    idempotencyKey: deriveCreatedEventIdempotencyKey({
      artifactKind: 'workbook',
      sourceRecordId: result.id,
    }),
    sourceContext: {
      source: params.source,
      projectId: params.projectId ?? null,
      sourceInitiativeId: params.sourceInitiativeId ?? null,
      conversationId: params.conversationId ?? null,
      artifactRunId: params.artifactRunId ?? null,
      sheetCount: Array.isArray(result.schema?.sheets) ? result.schema.sheets.length : null,
    },
    detail: { artifactId },
  });

  return {
    id: result.id,
    title: result.schema.title,
    description: result.schema.description,
    sheets: result.schema.sheets.map((s: any) => ({
      name: s.name,
      purpose: s.purpose,
      columnCount: s.columns.length,
      rowCount: s.rows.length,
    })),
    fileName: result.fileName,
    fileSize: result.buffer.length,
    validationErrors: result.validationErrors,
    classifiedErrors: result.classifiedErrors,
    qualityScore: result.qualityScore,
    qualityReport: result.qualityReport ?? null,
    pipelineLog: result.pipelineLog,
    artifactId,
    downloadUrl: `/api/workbook/${result.id}/download`,
    generatedAt: result.generatedAt,
  };
}

/**
 * POST /api/workbook/generate
 * Body: { prompt, researchContext?, language? }
 * Returns: { id, title, sheets, fileName, validationErrors }
 */
router.post(
  '/generate',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      prompt,
      researchContext,
      language,
      projectId,
      sourceInitiativeId,
      conversationId,
      actionContract,
      sourcePack,
      evidenceRefs,
      artifactRunId,
    } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
      res.status(400).json({ error: 'prompt is required (min 5 chars)' });
      return;
    }

    await ensureWorkbookSchema();

    const { default: WorkbookGeneratorService } =
      await import('../services/workbook/WorkbookGeneratorService.js');

    // Grounding (naprawa 2026-07-22, Fala A/A3): sourcePack/evidenceRefs były
    // przyjmowane, ale przekazywane TYLKO do DB — nigdy do promptu LLM; a obiekt
    // w researchContext dawał „[object Object]". Składamy jeden czytelny string ze
    // wszystkich dostępnych źródeł, żeby liczby modelu miały podstawę, nie były
    // zmyślane. WorkbookGeneratorService.generate przyjmuje researchContext:string.
    let groundingText = buildWorkbookGrounding({ researchContext, sourcePack, evidenceRefs });

    // A2 fix (2026-07-22): no explicit source in the body but an artifactRunId was
    // passed (dedicated ExceleView / artifact-run generation path) — hydrate grounding
    // from the run itself instead of leaving the prompt bare. See hydrateGroundingFromRun
    // above for the FAIL-SOFT lookup chain and rationale.
    if (!groundingText && typeof artifactRunId === 'string' && artifactRunId.trim()) {
      groundingText = await hydrateGroundingFromRun({
        artifactRunId: artifactRunId.trim(),
        organizationId: user.organizationId,
      });
      if (groundingText) {
        logger.info(
          `[WorkbookRoutes] Hydrated grounding from artifactRun ${artifactRunId.trim()} (${groundingText.length} chars)`
        );
      }
    }

    // N2 (noc 2026-07-27/28) — org-context grounding (see buildWorkbookOrgContext
    // above): always attempted, merged onto (never replacing) whatever grounding
    // was already assembled above. Fail-open — a `null` pack (empty/new org, or a
    // lookup failure) leaves `groundingText`/`organizationName` untouched, so a
    // brand-new organization sees byte-identical behaviour to before this change.
    const orgContext = await buildWorkbookOrgContext(user.organizationId);
    if (orgContext) {
      groundingText = groundingText
        ? `${orgContext.summaryPl}\n\n${groundingText}`
        : orgContext.summaryPl;
      logger.debug('[WorkbookRoutes] auto-grounded workbook generation from org context', {
        organizationId: user.organizationId,
        organizationName: orgContext.organizationName,
      });
    }

    // N3 fix (naprawa 2026-07-28, "Excel od tygodni nie działa"): this call was
    // NOT wrapped in try/catch — unlike `/templates/:id/build` and `/:id/clone`
    // below, which already classify thrown errors via createP23Error and
    // respond directly. A thrown error here fell through to the generic
    // Express error middleware, which in production replies with a bare
    // "Something went very wrong!" (see server/src/utils/ErrorHandler.ts) —
    // discarding the real reason (e.g. a bad model route, an exhausted AI
    // budget, or a genuinely invalid LLM schema) before it ever reached the
    // client. The excele lane's `Api.generateWorkbook` catch then had nothing
    // useful to show and silently fell back to a relabeled CSV table. Mirror
    // the same classify-and-respond pattern used by the sibling routes so the
    // real detail survives all the way to the user-facing failure banner.
    let result;
    try {
      result = await WorkbookGeneratorService.generate({
        prompt: prompt.trim(),
        userId: user.id,
        organizationId: user.organizationId,
        projectId: projectId || null,
        researchContext: groundingText,
        organizationName: orgContext?.organizationName,
        language: language || req.headers['accept-language']?.split(',')[0],
      });
    } catch (err) {
      logger.error('[WorkbookRoutes] Workbook generation failed:', err);
      res.status(502).json({
        error: 'Failed to generate workbook',
        classified: createP23Error(
          'export_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

    const payload = await finalizeGeneratedWorkbook({
      result,
      user,
      promptText: prompt.trim(),
      source: 'workbook_generator_p23d',
      projectId: projectId || null,
      sourceInitiativeId: sourceInitiativeId || null,
      conversationId: conversationId || null,
      actionContract,
      sourcePack,
      evidenceRefs,
      artifactRunId: artifactRunId || null,
    });

    res.json(payload);
  })
);

/**
 * GET /api/workbook/templates
 * Lists the registered PARAMETRIC model templates (live-formula workbooks) with
 * their self-describing parameter descriptors, so a FE can render a form. C3.
 */
router.get(
  '/templates',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { listWorkbookTemplates } = await import('../services/workbook/templates/index.js');
    const { listCustomWorkbookTemplates } =
      await import('../services/workbook/customWorkbookTemplateService.js');
    const registered = listWorkbookTemplates().map((t) => ({
      id: t.id,
      name: t.title,
      description: t.description,
      params: t.params,
      kind: 'parametric' as const,
    }));
    const custom = (await listCustomWorkbookTemplates(user.organizationId, user.id)).map((t) => ({
      ...t,
      description: t.description ?? '',
      params: [],
      kind: 'custom' as const,
    }));

    res.json({ templates: [...custom, ...registered] });
  })
);

/**
 * POST /api/workbook/templates/:id/build
 * Body: { params?: Record<string, unknown>, language?, projectId?, ... }
 * Validates the flat params against the template's zod schema, builds the .xlsx
 * DETERMINISTICALLY from the registered template (no LLM), then caches + persists
 * + registers the artifact through the SAME path as /generate. C3.
 */
router.post(
  '/templates/:id/build',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { params: rawParams, projectId, sourceInitiativeId, conversationId } = req.body || {};

    const { getWorkbookTemplate, buildTemplateParamsSchema } =
      await import('../services/workbook/templates/index.js');
    const entry = getWorkbookTemplate(id);
    let customTemplate = null;
    if (!entry) {
      try {
        customTemplate = await resolveCustomWorkbookTemplate(id, user.organizationId, user.id);
      } catch (err) {
        if (err instanceof CustomWorkbookTemplateInvalidError) {
          res.status(422).json({
            error: err.message,
            classified: createP23Error('validation_failed', err.message),
          });
          return;
        }
        throw err;
      }
      if (!customTemplate) {
        res.status(404).json({
          error: `Unknown workbook template: "${id}"`,
          classified: createP23Error('validation_failed', `No registered template with id "${id}"`),
        });
        return;
      }
    }

    // Validate the flat param map against the template's descriptor-derived zod
    // schema (unknown keys stripped, out-of-range/typed values rejected at the edge).
    const rawParamMap = rawParams && typeof rawParams === 'object' ? rawParams : {};
    const schemaZod = entry ? buildTemplateParamsSchema(entry) : null;
    const parsed = schemaZod
      ? schemaZod.safeParse(rawParamMap)
      : { success: true as const, data: rawParamMap as Record<string, unknown> };
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid template parameters',
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
        classified: createP23Error('validation_failed', 'Template parameter validation failed'),
      });
      return;
    }

    await ensureWorkbookSchema();

    const { default: WorkbookGeneratorService } =
      await import('../services/workbook/WorkbookGeneratorService.js');

    // N2 — no LLM prompt on the template path (deterministic build), so there is
    // no `researchContext` to enrich; still resolve the org name so the Info
    // sheet shows it (see buildWorkbookOrgContext above). Fail-open: null → the
    // template build proceeds exactly as before.
    const orgContextForTemplate = await buildWorkbookOrgContext(user.organizationId);

    let result;
    try {
      if (entry) {
        result = await WorkbookGeneratorService.generateFromTemplate({
          templateId: id,
          flatParams: parsed.data as Record<string, unknown>,
          organizationName: orgContextForTemplate?.organizationName,
        });
      } else {
        const schema = materializeCustomWorkbookSchema(
          customTemplate!,
          parsed.data as Record<string, unknown>
        );
        const { buildWorkbookBuffer, validateWorkbookSchema } =
          await import('../services/workbook/WorkbookBuilder.js');
        const structural = validateWorkbookSchema(schema);
        if (!structural.valid) {
          res.status(422).json({
            error: 'Custom workbook template failed structural validation',
            issues: structural.errors,
          });
          return;
        }
        const qualityReport = critiqueWorkbook(schema);
        const buffer = await buildWorkbookBuffer(schema, {
          meta: {
            organizationName: orgContextForTemplate?.organizationName,
            source: 'Consultify — custom workbook template',
            generatedAt: new Date().toISOString().slice(0, 10),
          },
        });
        result = {
          id: uuidv4(),
          schema,
          buffer,
          fileName: `${
            schema.title
              .replace(/[^a-zA-Z0-9_\- ]/g, '')
              .trim()
              .replace(/\s+/g, '_') || 'Workbook'
          }.xlsx`,
          validationErrors: [],
          classifiedErrors: qualityReport.issues.map((issue) =>
            createP23Error(issue.canonCode, `${issue.code} [${issue.sheet}] ${issue.message}`)
          ),
          qualityScore: null,
          qualityReport,
          pipelineLog: [
            {
              phase: 'custom_template_resolve',
              status: qualityReport.passed ? 'ok' : 'warning',
              durationMs: 0,
              detail: `Built from organization template "${id}".`,
            },
          ],
          generatedAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      logger.error('[WorkbookRoutes] Template build failed:', err);
      res.status(500).json({
        error: 'Failed to build workbook from template',
        classified: createP23Error(
          'export_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

    const payload = await finalizeGeneratedWorkbook({
      result,
      user,
      promptText: `[template:${id}] ${result.schema.title}`,
      source: 'workbook_template_c3',
      projectId: projectId || null,
      sourceInitiativeId: sourceInitiativeId || null,
      conversationId: conversationId || null,
    });

    res.json(payload);
  })
);

/**
 * POST /api/workbook/blank
 * Roboty tri-tryby (D3, tryb ①CZYSTO): tworzy MINIMALNY pusty skoroszyt
 * (1 arkusz, puste komórki) BEZ pipeline'u AI. Reużywa istniejącego kanału:
 * ten sam builder (buildWorkbookBuffer), ta sama tabela `generated_workbooks`,
 * ten sam cache i rejestr artefaktów co `/generate` — różni się tylko tym, że
 * schema jest deterministyczna i pusta zamiast generowana przez LLM.
 * Zwraca kształt zgodny z `/generate` (id + downloadUrl), więc ExceleView
 * może od razu pokazać podgląd/pobranie tą samą ścieżką.
 */
router.post(
  '/blank',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await ensureWorkbookSchema();

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = rawTitle || 'Pusty arkusz';

    // Naprawa 2026-07-28 ("jeden Excel na każdej ścieżce"): 0 kolumn/0 wierszy
    // dawało JSON-poprawną, ale bezużyteczną WorkbookSchema — EditableSpreadsheetGrid
    // (src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx) renderuje
    // `null` gdy `columns.length === 0` (nie ma czego kliknąć), a stary
    // tylko-do-odczytu fallback w KimiWorkspaceShell pokazywał zastępczy obrazek
    // "Spreadsheet preview" zamiast siatki. Prawdziwa pusta siatka = stały
    // szkielet kolumn/wierszy z PUSTYMI komórkami (cells: {}), żeby dwuklik w
    // dowolną komórkę od razu otwierał edycję — dokładnie jak w Excelu/Sheets
    // po "New spreadsheet".
    const BLANK_GRID_COLUMNS = 12; // A..L
    const BLANK_GRID_ROWS = 30;
    const colLetter = (index: number): string => {
      let n = index + 1;
      let out = '';
      while (n > 0) {
        const rem = (n - 1) % 26;
        out = String.fromCharCode(65 + rem) + out;
        n = Math.floor((n - 1) / 26);
      }
      return out;
    };
    const blankColumns = Array.from({ length: BLANK_GRID_COLUMNS }, (_, i) => ({
      key: colLetter(i),
      header: colLetter(i),
    }));
    const blankRows = Array.from({ length: BLANK_GRID_ROWS }, () => ({ cells: {} }));

    const schema: WorkbookSchema = {
      title,
      sheets: [{ name: 'Arkusz1', columns: blankColumns, rows: blankRows }],
    };

    const { buildWorkbookBuffer } = await import('../services/workbook/WorkbookBuilder.js');

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      logger.error('[WorkbookRoutes] Failed to build blank workbook:', err);
      res.status(500).json({ error: 'Failed to build blank workbook' });
      return;
    }

    const id = uuidv4();
    const fileName = `${title.replace(/\s+/g, '_')}.xlsx`;
    const generatedAt = new Date().toISOString();

    // A blank workbook is an authored object, not a transient preview.  Do not
    // acknowledge creation until PostgreSQL confirms the durable row.  The old
    // fail-soft path returned 201 and served the file from process memory even
    // when INSERT failed, so the workbook disappeared after a restart.
    try {
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbooks (id, organization_id, title, description, prompt, schema_json, sheet_count, file_name, file_size, validation_errors, quality_score, pipeline_log, action_contract_json, source_pack_json, evidence_refs_json, quality_report_json, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.organizationId,
          title,
          null,
          '(pusty arkusz — tryb Czysto)',
          JSON.stringify(schema),
          schema.sheets.length,
          fileName,
          buffer.length,
          null,
          null,
          JSON.stringify([]),
          JSON.stringify({}),
          JSON.stringify({}),
          JSON.stringify([]),
          JSON.stringify({}),
          user.id,
          generatedAt,
        ]
      );
    } catch (err) {
      logger.error('[WorkbookRoutes] Failed to persist blank workbook metadata:', err);
      res.status(500).json({
        error: 'Failed to persist blank workbook',
        classified: createP23Error(
          'persistence_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

    // Cache only after durable persistence. A process restart may now rebuild
    // the exact same XLSX from schema_json instead of losing the object.
    workbookCache.set(id, {
      buffer,
      fileName,
      schema,
      createdAt: generatedAt,
      organizationId: user.organizationId,
    });
    pruneCache();

    // Register in V8 artifact registry (Outputs Library), jak w `/generate`.
    let artifactId: string | null = null;
    try {
      const { registerArtifactOrigin } = await import('../services/v8/artifactRegistryService.js');
      const registered = await registerArtifactOrigin({
        organizationId: user.organizationId,
        outputType: 'sheet',
        artifactFamily: 'sheet',
        originRuntime: 'sheet',
        originRecordId: id,
        titleSnapshot: title,
        ownerUserId: user.id,
        createdBy: user.id,
        deliveryState: 'ready',
        visibilityScope: 'organization',
        projectId: null,
        sourceInitiativeId: null,
        originSummary: {
          title,
          description: null,
          sheetCount: schema.sheets.length,
          exportFormat: 'xlsx',
          source: 'workbook_blank_manual',
        },
      });
      artifactId = registered?.artifactId ?? null;
    } catch (err) {
      logger.warn('[WorkbookRoutes] Failed to register blank workbook in artifact registry:', err);
    }

    // MAT-010 lineage hook (fail-open) — head of the lineage chain. Runs after
    // the registry attempt so `canonicalArtifactId` resolves on the first try
    // in the normal case; the receipt is still created (and the canonical id
    // backfilled later) when the registry attempt above failed.
    await recordLineageEventSafe({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'created',
      actorUserId: user.id,
      titleSnapshot: title,
      idempotencyKey: deriveCreatedEventIdempotencyKey({
        artifactKind: 'workbook',
        sourceRecordId: id,
      }),
      sourceContext: { source: 'workbook_blank_manual', sheetCount: schema.sheets.length },
      detail: { artifactId },
    });

    res.status(201).json({
      id,
      title,
      description: null,
      sheets: schema.sheets.map((s) => ({
        name: s.name,
        purpose: undefined,
        columnCount: s.columns.length,
        rowCount: s.rows.length,
      })),
      fileName,
      fileSize: buffer.length,
      validationErrors: [],
      artifactId,
      downloadUrl: `/api/workbook/${id}/download`,
      generatedAt,
    });
  })
);

/**
 * GET /api/workbook/:id/download
 * Returns the .xlsx file as a download
 */
router.get(
  '/:id/download',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    // MAT-010: tenant-scoped cache read. Before this fix the lookup was
    // `workbookCache.get(id)` — no org — and served another tenant's .xlsx
    // bytes on a cache hit. A cross-tenant caller now misses and falls
    // through to the DB branch below, which 404s identically to an unknown id.
    const cached = getOwnedCachedWorkbook(id, user.organizationId);

    if (mode === 'draft' && cached?.organizationId === user.organizationId) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${cached.fileName}"`);

      // MAT-010 lineage hook. Now that the cache entry is proven to belong to
      // `user.organizationId`, the earlier reason for skipping this branch —
      // that an export could be filed under the WRONG tenant — no longer
      // applies, so cache-served downloads are no longer a gap in the
      // lineage. Recorded before `res.send` for the same reason as the DB
      // branch: the response is the observable side effect. `...Tracked` +
      // `respondIfLineageLost` (Codex review, second round): re-running an
      // export has no persisted side effect to duplicate, so declining
      // success on a genuine double failure is retry-safe.
      const exportOutcome = await recordLineageEventTracked({
        organizationId: user.organizationId,
        artifactKind: 'workbook',
        sourceRecordId: id,
        eventType: 'export',
        actorUserId: user.id,
        detail: { format: 'xlsx', fileName: cached.fileName, servedFrom: 'cache' },
      });
      if (respondIfLineageLost(res, exportOutcome)) return;

      res.send(cached.buffer);
      return;
    }

    // Try to regenerate from stored schema
    await ensureWorkbookSchema();
    const row = await queryHelpers.queryOne<{
      schema_json: string;
      file_name: string;
      classification: string | null;
      approval_current: number | boolean | null;
      quality_report_json: string | null;
    }>(
      `SELECT schema_json, file_name, classification, approval_current, quality_report_json
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    const policy = evaluateArtifactExportPolicy({
      mode,
      channel: 'download',
      classification: asClassification(row.classification),
      criticalQaFindings: countCriticalQaFindings(row.quality_report_json),
      approvalCurrentForVersion: row.approval_current === true || row.approval_current === 1,
    });
    if (!policy.allowed) {
      res.status(409).json({
        error: 'Artifact export is blocked by governance policy',
        code: 'ARTIFACT_EXPORT_BLOCKED',
        mode,
        blocks: policy.blocks,
      });
      return;
    }

    const { buildWorkbookBuffer, classifyBuildError } =
      await import('../services/workbook/WorkbookBuilder.js');
    const schema = JSON.parse(row.schema_json);

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      const classified = classifyBuildError(err);
      logger.error(`[WorkbookRoutes] Rebuild from schema failed: ${classified.code}`, err);
      res.status(500).json({
        error: 'Failed to rebuild workbook from stored schema',
        classified,
      });
      return;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('X-Artifact-Export-Mode', mode);
    res.setHeader('X-Artifact-Draft', policy.draftMarkingRequired ? 'true' : 'false');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${
        policy.draftMarkingRequired
          ? draftFileName(row.file_name || 'workbook.xlsx')
          : row.file_name || 'workbook.xlsx'
      }"`
    );

    // MAT-010 lineage hook. This database-backed branch proves ownership via
    // its `WHERE ... AND organization_id = ?` above.
    //
    // HISTORY: this hook was originally attached ONLY here, because the
    // `workbookCache` fast-path at the top of this handler was keyed by
    // workbook id alone with no tenant check — recording from it could have
    // filed an export under the wrong organization. That cache is now
    // tenant-scoped (`getOwnedCachedWorkbook`), so the fast path carries its
    // own hook too and cache-served downloads are no longer a lineage gap.
    const exportOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'export',
      actorUserId: user.id,
      detail: { format: 'xlsx', fileName: row.file_name || 'workbook.xlsx' },
    });
    if (respondIfLineageLost(res, exportOutcome)) return;

    res.send(buffer);
  })
);

/**
 * GET /api/workbook/list
 * List recent workbooks for the organization
 */
router.get(
  '/list',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await ensureWorkbookSchema();

    const rows = await queryHelpers.queryAll(
      `SELECT id, title, description, sheet_count, file_name, file_size, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at
     FROM generated_workbooks WHERE organization_id = ?
     ORDER BY created_at DESC LIMIT 50`,
      [user.organizationId]
    );

    res.json({
      workbooks: (rows || []).map((row: any) => ({
        ...row,
        actionContract: row.action_contract_json ? JSON.parse(row.action_contract_json) : {},
        sourcePack: row.source_pack_json ? JSON.parse(row.source_pack_json) : {},
        evidenceRefs: row.evidence_refs_json ? JSON.parse(row.evidence_refs_json) : [],
      })),
    });
  })
);

/**
 * GET /api/workbook/:id/schema
 * B3 fix (2026-07-22, workstream Excel): the in-app spreadsheet preview used to
 * show ONLY sheet metadata (name/columnCount/rowCount) — a user had to download
 * the .xlsx to see a single cell. This returns the FULL WorkbookSchema (sheets →
 * rows → cells, each cell carrying its display value and, when present, its
 * formula as a plain string e.g. "SUM(B2:B10)") so the frontend can render a
 * real read-only grid without downloading anything. Org-scoped; 404 when the
 * workbook is unknown or belongs to another organization.
 *
 * Checks the in-memory `workbookCache` first (freshly generated workbook, not
 * necessarily persisted yet) before falling back to the `generated_workbooks`
 * table. Registered ABOVE the generic GET /:id below — Express tries routes in
 * registration order, and /:id/schema is the more specific pattern.
 */
router.get(
  '/:id/schema',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // MAT-010: tenant-scoped cache read (was `workbookCache.get(id)` — no org,
    // consulted before any ownership check, so org B could read org A's
    // schema and title). Cross-tenant now misses and 404s via the DB branch.
    const cached = getOwnedCachedWorkbook(id, user.organizationId);
    if (cached?.schema) {
      res.json({
        id,
        title: cached.schema.title,
        description: cached.schema.description ?? null,
        sheets: Array.isArray(cached.schema.sheets) ? cached.schema.sheets : [],
      });
      return;
    }

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null }>(
      `SELECT schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    let schema: WorkbookSchema | null = null;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    if (schema && ensureStableSheetIds(schema)) {
      await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET schema_json = ? WHERE id = ? AND organization_id = ?`,
        [JSON.stringify(schema), id, user.organizationId]
      );
      workbookCache.delete(id);
    }

    res.json({
      id,
      title: schema?.title ?? null,
      description: schema?.description ?? null,
      sheets: Array.isArray(schema?.sheets) ? schema!.sheets : [],
    });
  })
);

/**
 * POST /api/workbook/:id/clone
 *
 * CLONE mode — brief §1/§10, "Komplet od razu". Duplicates an existing
 * workbook's schema into a NEW `generated_workbooks` row (fresh id, fresh
 * .xlsx buffer) as an editable starting point — the Excel counterpart of
 * Deck's `POST /templates/:id/clone` and WORD's
 * `POST /document-studio/templates/from-artifact/:artifactId`. Reuses the
 * exact same build/persist/register tail (`finalizeGeneratedWorkbook`) as
 * `/generate`, `/blank` and `/templates/:id/build` — one card per clone,
 * no duplicated persistence logic.
 *
 * Body: { title? } — optional override; defaults to "<source title> (Copy)".
 * Returns: same payload shape as `/generate` (201).
 * Errors: 404 when the source workbook doesn't exist for this organization.
 */
router.post(
  '/:id/clone',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    await ensureWorkbookSchema();

    const source = await queryHelpers.queryOne<{
      title: string;
      description: string | null;
      schema_json: string | null;
    }>(
      `SELECT title, description, schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!source?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    let sourceSchema: WorkbookSchema;
    try {
      sourceSchema = JSON.parse(source.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const title = rawTitle || `${sourceSchema.title || source.title || 'Untitled workbook'} (Copy)`;
    const schema: WorkbookSchema = { ...sourceSchema, title };

    const { buildWorkbookBuffer } = await import('../services/workbook/WorkbookBuilder.js');

    let buffer: Buffer;
    try {
      buffer = await buildWorkbookBuffer(schema);
    } catch (err) {
      logger.error('[WorkbookRoutes] Failed to build cloned workbook:', err);
      res.status(500).json({
        error: 'Failed to build cloned workbook',
        classified: createP23Error(
          'export_failed',
          err instanceof Error ? err.message : String(err)
        ),
      });
      return;
    }

    const newId = uuidv4();
    const fileName = `${title.replace(/\s+/g, '_')}.xlsx`;
    const generatedAt = new Date().toISOString();

    const payload = await finalizeGeneratedWorkbook({
      result: {
        id: newId,
        schema,
        buffer,
        fileName,
        validationErrors: [],
        qualityScore: null,
        pipelineLog: [`cloned from workbook ${id}`],
        generatedAt,
      },
      user,
      promptText: `(klon skoroszytu ${id})`,
      source: 'workbook_clone',
    });

    res.status(201).json({ ...payload, clonedFrom: id });
  })
);

/**
 * POST /api/workbook/:id/commands
 *
 * Atomowy pakiet mutacji komórek dla Spreadsheet Studio. Cały pakiet jest
 * walidowany i nakładany na kopię schema_json przed pojedynczym warunkowym
 * UPDATE. `baseVersion` chroni przed cichym nadpisaniem, a `idempotencyKey`
 * przed powtórzeniem zaakceptowanego pakietu po retry transportowym.
 */
router.post(
  '/:id/commands',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { commandId, baseVersion, idempotencyKey, operations } = req.body || {};
    if (typeof commandId !== 'string' || !commandId.trim()) {
      res.status(400).json({ error: 'commandId must be a non-empty string' });
      return;
    }
    if (!Number.isInteger(baseVersion) || baseVersion < 0) {
      res.status(400).json({ error: 'baseVersion must be a non-negative integer' });
      return;
    }
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      res.status(400).json({ error: 'idempotencyKey must be a non-empty string' });
      return;
    }
    if (!Array.isArray(operations) || operations.length === 0 || operations.length > 1000) {
      res.status(400).json({ error: 'operations must contain between 1 and 1000 items' });
      return;
    }

    try {
      await ensureWorkbookSchema();
      const result = await applyWorkbookCommand({
        workbookId: id,
        organizationId: user.organizationId,
        userId: user.id,
        commandId,
        baseVersion,
        idempotencyKey,
        operations,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof WorkbookCommandError) {
        res
          .status(error.statusCode)
          .json({ error: error.message, code: error.code, ...error.details });
      } else {
        throw error;
      }
    }
  })
);

router.get(
  '/:id/revisions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const rows = await queryHelpers.queryAll<{
      id: string;
      version: number;
      command_id: string;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, version, command_id, created_by, created_at
       FROM generated_workbook_revisions
       WHERE workbook_id = ? AND organization_id = ?
       ORDER BY version DESC`,
      [req.params.id, user.organizationId]
    );
    res.json({ revisions: rows });
  })
);

router.post(
  '/:id/revisions/:version/undo',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const commandVersion = Number(req.params.version);
    const baseVersion = Number(req.body?.baseVersion);
    if (!Number.isInteger(commandVersion) || !Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'command and base versions must be integers' });
      return;
    }
    try {
      const result = await undoWorkbookCommand({
        workbookId: req.params.id,
        organizationId: user.organizationId,
        userId: user.id,
        commandVersion,
        baseVersion,
        idempotencyKey:
          typeof req.body?.idempotencyKey === 'string'
            ? req.body.idempotencyKey
            : `undo:${commandVersion}:${uuidv4()}`,
      });
      res.json({ ok: true, ...result });
    } catch (error) {
      if (error instanceof WorkbookCommandError) {
        res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          ...(error.details || {}),
        });
        return;
      }
      throw error;
    }
  })
);

router.post(
  '/:id/revisions/:version/restore',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sourceVersion = Number(req.params.version);
    const baseVersion = Number(req.body?.baseVersion);
    if (!Number.isInteger(sourceVersion) || !Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'source and base versions must be integers' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, COALESCE(version, 0) AS version
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (head.version !== baseVersion) {
      res.status(409).json({
        error: 'Workbook version conflict',
        code: 'WORKBOOK_VERSION_CONFLICT',
        expectedVersion: baseVersion,
        currentVersion: head.version,
      });
      return;
    }
    const source = await queryHelpers.queryOne<{ schema_json: string }>(
      `SELECT schema_json FROM generated_workbook_revisions
       WHERE workbook_id = ? AND organization_id = ? AND version = ?`,
      [req.params.id, user.organizationId, sourceVersion]
    );
    if (!source) {
      res.status(404).json({ error: 'Workbook revision not found' });
      return;
    }
    let headSchema: WorkbookSchema;
    let targetSchema: WorkbookSchema;
    try {
      headSchema = JSON.parse(head.schema_json) as WorkbookSchema;
      targetSchema = JSON.parse(source.schema_json) as WorkbookSchema;
    } catch {
      res.status(422).json({ error: 'Workbook revision contains invalid schema JSON' });
      return;
    }
    const headSheetIds = new Set(
      (headSchema.sheets || []).map((sheet) => sheet.id).filter(Boolean)
    );
    const targetSheetIds = new Set(
      (targetSchema.sheets || []).map((sheet) => sheet.id).filter(Boolean)
    );
    const restoredSheetIds = [...targetSheetIds].filter((sheetId) => !headSheetIds.has(sheetId));
    const removedSheetIds = [...headSheetIds].filter((sheetId) => !targetSheetIds.has(sheetId));
    const nextVersion = head.version + 1;
    const mutationKey = `restore:${sourceVersion}:${uuidv4()}`;
    const persisted = await queryHelpers.transaction(async () => {
      const result = await queryHelpers.queryRun(
        `UPDATE generated_workbooks
         SET schema_json = ?, version = ?, last_mutation_key = ?, approval_current = 0
         WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
        [
          source.schema_json,
          nextVersion,
          mutationKey,
          req.params.id,
          user.organizationId,
          head.version,
        ]
      );
      if (!result.changes) return false;
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_revisions
         (id, workbook_id, organization_id, version, command_id, idempotency_key,
          base_schema_json, schema_json, operations_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          nextVersion,
          'xlsx.versions.restore',
          mutationKey,
          head.schema_json,
          source.schema_json,
          JSON.stringify([{ sourceVersion }]),
          user.id,
        ]
      );
      for (const sheetId of restoredSheetIds) {
        await queryHelpers.queryRun(
          `UPDATE generated_workbook_comments
           SET anchor_state = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?
             AND deleted_at IS NULL`,
          [req.params.id, user.organizationId, sheetId]
        );
        await queryHelpers.queryRun(
          `UPDATE generated_workbook_source_bindings
           SET anchor_state = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
          [req.params.id, user.organizationId, sheetId]
        );
      }
      for (const sheetId of removedSheetIds) {
        await queryHelpers.queryRun(
          `UPDATE generated_workbook_comments
           SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
           WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?
             AND deleted_at IS NULL`,
          [req.params.id, user.organizationId, sheetId]
        );
        await queryHelpers.queryRun(
          `UPDATE generated_workbook_source_bindings
           SET anchor_state = 'orphaned', updated_at = CURRENT_TIMESTAMP
           WHERE workbook_id = ? AND organization_id = ? AND sheet_id = ?`,
          [req.params.id, user.organizationId, sheetId]
        );
      }
      return true;
    });
    if (!persisted) {
      res
        .status(409)
        .json({ error: 'Workbook version conflict', code: 'WORKBOOK_VERSION_CONFLICT' });
      return;
    }
    workbookCache.delete(req.params.id);
    res.json({
      ok: true,
      sourceVersion,
      version: nextVersion,
      restoredCommentSheetIds: restoredSheetIds,
      orphanedCommentSheetIds: removedSheetIds,
      restoredSourceSheetIds: restoredSheetIds,
      orphanedSourceSheetIds: removedSheetIds,
    });
  })
);

router.get(
  '/:id/sources',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const workbook = await queryHelpers.queryOne<{ schema_json: string }>(
      `SELECT schema_json FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!workbook?.schema_json) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(workbook.schema_json) as WorkbookSchema;
    } catch {
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }
    const sheetNames = new Map(
      (schema.sheets || []).filter((sheet) => sheet.id).map((sheet) => [sheet.id!, sheet.name])
    );
    const bindings = await queryHelpers.queryAll<{
      id: string;
      sheet_id: string;
      range_ref: string;
      label: string;
      source_ref: string | null;
      source_type: string | null;
      anchored_version: number;
      anchor_state: 'active' | 'orphaned';
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, sheet_id, range_ref, label, source_ref, source_type,
              anchored_version, anchor_state, created_by, created_at
       FROM generated_workbook_source_bindings
       WHERE workbook_id = ? AND organization_id = ?
       ORDER BY created_at ASC`,
      [req.params.id, user.organizationId]
    );
    res.json({
      bindings: (bindings || []).map((binding) => ({
        id: binding.id,
        sheetId: binding.sheet_id,
        sheet: sheetNames.get(binding.sheet_id) || null,
        range: binding.range_ref,
        label: binding.label,
        sourceRef: binding.source_ref,
        sourceType: binding.source_type,
        anchoredVersion: binding.anchored_version,
        anchorState: binding.anchor_state,
        createdBy: binding.created_by,
        createdAt: binding.created_at,
      })),
    });
  })
);

router.post(
  '/:id/sources',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : '';
    const sourceRef = typeof req.body?.sourceRef === 'string' ? req.body.sourceRef.trim() : null;
    const sourceType =
      typeof req.body?.sourceType === 'string' ? req.body.sourceType.trim() : null;
    const sheetId = typeof req.body?.sheetId === 'string' ? req.body.sheetId : '';
    const rangeRef =
      typeof req.body?.range === 'string' ? req.body.range.trim().toUpperCase() : '';
    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    const baseVersion = Number(req.body?.baseVersion);
    if (!label || label.length > 500) {
      res.status(400).json({ error: 'label must contain between 1 and 500 characters' });
      return;
    }
    if (!sheetId || !isValidRangeRef(rangeRef)) {
      res.status(400).json({ error: 'A valid sheetId and range are required' });
      return;
    }
    if (!idempotencyKey || !Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'idempotencyKey and integer baseVersion are required' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, COALESCE(version, 0) AS version
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head?.schema_json) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM generated_workbook_source_bindings
       WHERE workbook_id = ? AND organization_id = ? AND idempotency_key = ?`,
      [req.params.id, user.organizationId, idempotencyKey]
    );
    if (existing) {
      res.status(200).json({ id: existing.id, duplicate: true, version: head.version });
      return;
    }
    if (head.version !== baseVersion) {
      res.status(409).json({
        error: 'Workbook version conflict',
        code: 'WORKBOOK_VERSION_CONFLICT',
        expectedVersion: baseVersion,
        currentVersion: head.version,
      });
      return;
    }
    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(head.schema_json) as WorkbookSchema;
    } catch {
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }
    if (!(schema.sheets || []).some((sheet) => sheet.id === sheetId)) {
      res.status(400).json({ error: 'Unknown sheetId' });
      return;
    }
    const bindingId = uuidv4();
    const nextVersion = head.version + 1;
    const persisted = await queryHelpers.transaction(async () => {
      const updated = await queryHelpers.queryRun(
        `UPDATE generated_workbooks
         SET version = ?, last_mutation_key = ?, approval_current = 0
         WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
        [nextVersion, idempotencyKey, req.params.id, user.organizationId, head.version]
      );
      if (!updated.changes) return false;
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_source_bindings
         (id, workbook_id, organization_id, sheet_id, range_ref, label, source_ref,
          source_type, anchored_version, idempotency_key, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          bindingId,
          req.params.id,
          user.organizationId,
          sheetId,
          rangeRef,
          label,
          sourceRef,
          sourceType,
          nextVersion,
          idempotencyKey,
          user.id,
        ]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_revisions
         (id, workbook_id, organization_id, version, command_id, idempotency_key,
          base_schema_json, schema_json, operations_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          nextVersion,
          'xlsx.sources.bind',
          idempotencyKey,
          head.schema_json,
          head.schema_json,
          JSON.stringify([{ bindingId, sheetId, range: rangeRef, label, sourceRef, sourceType }]),
          user.id,
        ]
      );
      return true;
    });
    if (!persisted) {
      res.status(409).json({ error: 'Workbook version conflict', code: 'WORKBOOK_VERSION_CONFLICT' });
      return;
    }
    workbookCache.delete(req.params.id);
    res.status(201).json({
      id: bindingId,
      duplicate: false,
      version: nextVersion,
      binding: { sheetId, range: rangeRef, label, sourceRef, sourceType },
    });
  })
);

router.delete(
  '/:id/sources/:bindingId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const baseVersion = Number(req.body?.baseVersion);
    if (!Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'baseVersion must be an integer' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, COALESCE(version, 0) AS version
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (head.version !== baseVersion) {
      res.status(409).json({ error: 'Workbook version conflict', code: 'WORKBOOK_VERSION_CONFLICT' });
      return;
    }
    const binding = await queryHelpers.queryOne<{
      id: string;
      sheet_id: string;
      range_ref: string;
      label: string;
      source_ref: string | null;
      source_type: string | null;
    }>(
      `SELECT id, sheet_id, range_ref, label, source_ref, source_type
       FROM generated_workbook_source_bindings
       WHERE id = ? AND workbook_id = ? AND organization_id = ?`,
      [req.params.bindingId, req.params.id, user.organizationId]
    );
    if (!binding) {
      res.status(404).json({ error: 'Source binding not found' });
      return;
    }
    const nextVersion = head.version + 1;
    const mutationKey = `source-unbind:${req.params.bindingId}:${uuidv4()}`;
    const persisted = await queryHelpers.transaction(async () => {
      const updated = await queryHelpers.queryRun(
        `UPDATE generated_workbooks
         SET version = ?, last_mutation_key = ?, approval_current = 0
         WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
        [nextVersion, mutationKey, req.params.id, user.organizationId, head.version]
      );
      if (!updated.changes) return false;
      await queryHelpers.queryRun(
        `DELETE FROM generated_workbook_source_bindings
         WHERE id = ? AND workbook_id = ? AND organization_id = ?`,
        [binding.id, req.params.id, user.organizationId]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_revisions
         (id, workbook_id, organization_id, version, command_id, idempotency_key,
          base_schema_json, schema_json, operations_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          nextVersion,
          'xlsx.sources.unbind',
          mutationKey,
          head.schema_json,
          head.schema_json,
          JSON.stringify([{ bindingId: binding.id, ...binding }]),
          user.id,
        ]
      );
      return true;
    });
    if (!persisted) {
      res.status(409).json({ error: 'Workbook version conflict', code: 'WORKBOOK_VERSION_CONFLICT' });
      return;
    }
    workbookCache.delete(req.params.id);
    res.json({ ok: true, id: binding.id, version: nextVersion });
  })
);

router.get(
  '/:id/comments',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const workbook = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!workbook) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const requestedStatus = String(req.query.status || 'open');
    if (!['open', 'resolved', 'all'].includes(requestedStatus)) {
      res.status(400).json({ error: 'status must be open, resolved or all' });
      return;
    }
    const params: unknown[] = [req.params.id, user.organizationId];
    let filters = `workbook_id = ? AND organization_id = ? AND deleted_at IS NULL`;
    if (requestedStatus !== 'all') {
      filters += ` AND status = ?`;
      params.push(requestedStatus);
    }
    if (typeof req.query.sheetId === 'string' && req.query.sheetId) {
      filters += ` AND sheet_id = ?`;
      params.push(req.query.sheetId);
    }
    const comments = await queryHelpers.queryAll(
      `SELECT id, workbook_id, sheet_id, range_ref, anchored_version,
              parent_comment_id, body, status, anchor_state, created_by,
              resolved_by, resolved_at, created_at, updated_at
       FROM generated_workbook_comments
       WHERE ${filters}
       ORDER BY created_at ASC`,
      params
    );
    res.json({ comments: comments || [] });
  })
);

router.post(
  '/:id/comments',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
    const idempotencyKey =
      typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
    const parentCommentId =
      typeof req.body?.parentCommentId === 'string' ? req.body.parentCommentId : null;
    if (!body || body.length > 10_000) {
      res.status(400).json({ error: 'body must contain between 1 and 10000 characters' });
      return;
    }
    if (!idempotencyKey) {
      res.status(400).json({ error: 'idempotencyKey must be a non-empty string' });
      return;
    }
    await ensureWorkbookSchema();
    const workbook = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, COALESCE(version, 0) AS version
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!workbook?.schema_json) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(workbook.schema_json);
    } catch {
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }
    const idsAdded = ensureStableSheetIds(schema);
    const anchor: { sheetId?: unknown; range?: unknown } =
      req.body?.anchor && typeof req.body.anchor === 'object' ? req.body.anchor : {};
    let sheetId = typeof anchor.sheetId === 'string' ? anchor.sheetId : null;
    let rangeRef = typeof anchor.range === 'string' ? anchor.range.trim().toUpperCase() : null;
    if (sheetId && !schema.sheets.some((sheet) => sheet.id === sheetId)) {
      res.status(400).json({ error: 'Unknown sheetId' });
      return;
    }
    if (rangeRef && (!sheetId || !isValidRangeRef(rangeRef))) {
      res.status(400).json({ error: 'A valid range requires a sheetId' });
      return;
    }
    if (parentCommentId) {
      const parent = await queryHelpers.queryOne<{
        sheet_id: string | null;
        range_ref: string | null;
      }>(
        `SELECT sheet_id, range_ref FROM generated_workbook_comments
         WHERE id = ? AND workbook_id = ? AND organization_id = ? AND deleted_at IS NULL`,
        [parentCommentId, req.params.id, user.organizationId]
      );
      if (!parent) {
        res.status(404).json({ error: 'Parent comment not found' });
        return;
      }
      sheetId = parent.sheet_id;
      rangeRef = parent.range_ref;
    }
    const existing = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM generated_workbook_comments
       WHERE workbook_id = ? AND organization_id = ? AND idempotency_key = ?`,
      [req.params.id, user.organizationId, idempotencyKey]
    );
    if (existing) {
      res.status(200).json({ id: existing.id, duplicate: true });
      return;
    }
    const commentId = uuidv4();
    await queryHelpers.transaction(async () => {
      if (idsAdded) {
        await queryHelpers.queryRun(
          `UPDATE generated_workbooks SET schema_json = ? WHERE id = ? AND organization_id = ?`,
          [JSON.stringify(schema), req.params.id, user.organizationId]
        );
      }
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_comments
         (id, workbook_id, organization_id, sheet_id, range_ref, anchored_version,
          parent_comment_id, body, idempotency_key, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          commentId,
          req.params.id,
          user.organizationId,
          sheetId,
          rangeRef,
          workbook.version,
          parentCommentId,
          body,
          idempotencyKey,
          user.id,
        ]
      );
    });
    res.status(201).json({
      id: commentId,
      duplicate: false,
      anchor: { sheetId, range: rangeRef, version: workbook.version },
    });
  })
);

router.patch(
  '/:id/comments/:commentId/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const status = req.body?.status;
    if (!['open', 'resolved'].includes(status)) {
      res.status(400).json({ error: 'status must be open or resolved' });
      return;
    }
    await ensureWorkbookSchema();
    const result = await queryHelpers.queryRun(
      `UPDATE generated_workbook_comments
       SET status = ?, resolved_by = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND workbook_id = ? AND organization_id = ? AND deleted_at IS NULL`,
      [
        status,
        status === 'resolved' ? user.id : null,
        status === 'resolved' ? new Date().toISOString() : null,
        req.params.commentId,
        req.params.id,
        user.organizationId,
      ]
    );
    if (!result.changes) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }
    res.json({ ok: true, id: req.params.commentId, status });
  })
);

router.patch(
  '/:id/title',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const baseVersion = Number(req.body?.baseVersion);
    if (!title || title.length > 240) {
      res.status(400).json({ error: 'Workbook title must contain 1-240 characters' });
      return;
    }
    if (!Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'baseVersion must be an integer' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, COALESCE(version, 0) AS version
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (head.version !== baseVersion) {
      res.status(409).json({
        error: 'Workbook version conflict',
        code: 'WORKBOOK_VERSION_CONFLICT',
        expectedVersion: baseVersion,
        currentVersion: head.version,
      });
      return;
    }
    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(head.schema_json) as WorkbookSchema;
    } catch {
      res.status(422).json({ error: 'Workbook contains invalid schema JSON' });
      return;
    }
    if (schema.title === title) {
      res.json({ ok: true, title, version: head.version, unchanged: true });
      return;
    }
    const nextSchema = { ...schema, title };
    const nextSchemaJson = JSON.stringify(nextSchema);
    const nextVersion = head.version + 1;
    const mutationKey = `title:${uuidv4()}`;
    const persisted = await queryHelpers.transaction(async () => {
      const result = await queryHelpers.queryRun(
        `UPDATE generated_workbooks
         SET title = ?, schema_json = ?, version = ?, last_mutation_key = ?, approval_current = 0
         WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
        [
          title,
          nextSchemaJson,
          nextVersion,
          mutationKey,
          req.params.id,
          user.organizationId,
          head.version,
        ]
      );
      if (!result.changes) return false;
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_revisions
         (id, workbook_id, organization_id, version, command_id, idempotency_key,
          base_schema_json, schema_json, operations_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          nextVersion,
          'xlsx.workbook.rename',
          mutationKey,
          head.schema_json,
          nextSchemaJson,
          JSON.stringify([{ title }]),
          user.id,
        ]
      );
      return true;
    });
    if (!persisted) {
      res
        .status(409)
        .json({ error: 'Workbook version conflict', code: 'WORKBOOK_VERSION_CONFLICT' });
      return;
    }
    workbookCache.delete(req.params.id);
    res.json({ ok: true, title, version: nextVersion, unchanged: false });
  })
);

router.patch(
  '/:id/governance',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const field = req.body?.field;
    const value = req.body?.value;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const baseVersion = Number(req.body?.baseVersion);
    const classifications = ['public', 'internal', 'confidential'] as const;
    const lifecycleStatuses = ['draft', 'in_review', 'approved', 'final'] as const;
    if (field !== 'classification' && field !== 'lifecycleStatus') {
      res.status(400).json({ error: 'field must be classification or lifecycleStatus' });
      return;
    }
    if (!Number.isInteger(baseVersion)) {
      res.status(400).json({ error: 'baseVersion must be an integer' });
      return;
    }
    if (
      (field === 'classification' && !classifications.includes(value)) ||
      (field === 'lifecycleStatus' && !lifecycleStatuses.includes(value))
    ) {
      res.status(400).json({ error: 'Unsupported governance value' });
      return;
    }

    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{
      version: number;
      classification: string | null;
      lifecycle_status: string | null;
      approval_current: number | boolean | null;
      quality_report_json: string | null;
    }>(
      `SELECT COALESCE(version, 0) AS version, classification, lifecycle_status,
              approval_current, quality_report_json
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (head.version !== baseVersion) {
      res.status(409).json({
        error: 'Workbook version conflict',
        code: 'WORKBOOK_VERSION_CONFLICT',
        expectedVersion: baseVersion,
        currentVersion: head.version,
      });
      return;
    }

    const previousValue =
      field === 'classification'
        ? asClassification(head.classification)
        : lifecycleStatuses.includes(head.lifecycle_status as (typeof lifecycleStatuses)[number])
          ? head.lifecycle_status!
          : 'draft';
    if (previousValue === value) {
      res.json({
        ok: true,
        classification: asClassification(head.classification),
        lifecycleStatus: head.lifecycle_status || 'draft',
        approvalCurrent: head.approval_current === true || head.approval_current === 1,
        version: head.version,
        unchanged: true,
      });
      return;
    }

    if (field === 'classification') {
      const rank = { public: 0, internal: 1, confidential: 2 } as const;
      if (rank[value as keyof typeof rank] < rank[previousValue as keyof typeof rank] && !reason) {
        res.status(422).json({
          error: 'A reason is required to lower workbook classification',
          code: 'CLASSIFICATION_DOWNGRADE_REASON_REQUIRED',
        });
        return;
      }
    } else if (value === 'in_review') {
      res.status(409).json({
        error: 'A reviewer assignment is required to submit a workbook for review',
        code: 'WORKBOOK_REVIEW_ASSIGNMENT_REQUIRED',
      });
      return;
    } else if (value === 'approved' || value === 'final') {
      const approvalCurrent = head.approval_current === true || head.approval_current === 1;
      if (!approvalCurrent) {
        res.status(409).json({
          error: 'Current approval is required for this lifecycle transition',
          code: 'WORKBOOK_APPROVAL_REQUIRED',
        });
        return;
      }
      if (value === 'final' && countCriticalQaFindings(head.quality_report_json) > 0) {
        res.status(409).json({
          error: 'Critical QA findings block final lifecycle status',
          code: 'WORKBOOK_QA_BLOCKED',
        });
        return;
      }
    }

    const column = field === 'classification' ? 'classification' : 'lifecycle_status';
    await queryHelpers.transaction(async () => {
      await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET ${column} = ?${field === 'classification' ? ', approval_current = 0' : ''}
         WHERE id = ? AND organization_id = ? AND COALESCE(version, 0) = ?`,
        [value, req.params.id, user.organizationId, head.version]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_governance_events
         (id, workbook_id, organization_id, event_type, previous_value, next_value,
          reason, workbook_version, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          field === 'classification' ? 'classification.changed' : 'lifecycle.changed',
          previousValue,
          value,
          reason || null,
          head.version,
          user.id,
        ]
      );
    });
    res.json({
      ok: true,
      classification: field === 'classification' ? value : asClassification(head.classification),
      lifecycleStatus: field === 'lifecycleStatus' ? value : head.lifecycle_status || 'draft',
      approvalCurrent:
        field === 'classification'
          ? false
          : head.approval_current === true || head.approval_current === 1,
      version: head.version,
      unchanged: false,
    });
  })
);

router.get(
  '/:id/governance-events',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const workbook = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!workbook) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const events = await queryHelpers.queryAll<{
      id: string;
      event_type: string;
      previous_value: string | null;
      next_value: string | null;
      reason: string | null;
      workbook_version: number;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, event_type, previous_value, next_value, reason,
              workbook_version, created_by, created_at
       FROM generated_workbook_governance_events
       WHERE workbook_id = ? AND organization_id = ?
       ORDER BY created_at DESC LIMIT 200`,
      [req.params.id, user.organizationId]
    );
    res.json({
      events: events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        previousValue: event.previous_value,
        nextValue: event.next_value,
        reason: event.reason,
        workbookVersion: event.workbook_version,
        createdBy: event.created_by,
        createdAt: event.created_at,
      })),
    });
  })
);

router.get(
  '/:id/approval-state',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{
      version: number;
      approval_current: number | boolean | null;
    }>(
      `SELECT COALESCE(version, 0) AS version, approval_current
       FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const approval = await ArtifactApprovalService.getArtifactApprovalStatus(
      user.organizationId,
      'workbook',
      req.params.id
    );
    res.json({
      ...approval,
      workbookVersion: head.version,
      currentForVersion: head.approval_current === true || head.approval_current === 1,
    });
  })
);

router.post(
  '/:id/approval/submit',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const assignedToUserId = String(req.body?.assignedToUserId || '').trim();
    if (!assignedToUserId) {
      res.status(400).json({ error: 'assignedToUserId is required' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ version: number }>(
      `SELECT COALESCE(version, 0) AS version FROM generated_workbooks
       WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const assignment = await ArtifactApprovalService.submitForReview({
      orgId: user.organizationId,
      artifactType: 'workbook',
      artifactId: req.params.id,
      assignedToUserId,
      submittedBy: user.id,
    });
    await queryHelpers.transaction(async () => {
      await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET lifecycle_status = 'in_review', approval_current = 0
         WHERE id = ? AND organization_id = ?`,
        [req.params.id, user.organizationId]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_governance_events
         (id, workbook_id, organization_id, event_type, previous_value, next_value,
          reason, workbook_version, created_by)
         VALUES (?, ?, ?, 'approval.submitted', 'draft', 'in_review', ?, ?, ?)`,
        [
          uuidv4(),
          req.params.id,
          user.organizationId,
          `Assigned reviewer: ${assignedToUserId}`,
          head.version,
          user.id,
        ]
      );
    });
    res.status(201).json({
      assignment,
      state: 'review',
      currentForVersion: false,
      workbookVersion: head.version,
    });
  })
);

router.post(
  '/:id/approval/approve',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ version: number }>(
      `SELECT COALESCE(version, 0) AS version FROM generated_workbooks
       WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const assignment = await ArtifactApprovalService.approveArtifact({
      orgId: user.organizationId,
      artifactType: 'workbook',
      artifactId: req.params.id,
      approvedByUserId: user.id,
    });
    await queryHelpers.transaction(async () => {
      await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET lifecycle_status = 'approved', approval_current = 1
         WHERE id = ? AND organization_id = ?`,
        [req.params.id, user.organizationId]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_governance_events
         (id, workbook_id, organization_id, event_type, previous_value, next_value,
          reason, workbook_version, created_by)
         VALUES (?, ?, ?, 'approval.approved', 'in_review', 'approved', NULL, ?, ?)`,
        [uuidv4(), req.params.id, user.organizationId, head.version, user.id]
      );
    });
    res.json({ assignment, state: 'approved', currentForVersion: true });
  })
);

router.post(
  '/:id/approval/reject',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!reason) {
      res.status(422).json({ error: 'A rejection reason is required' });
      return;
    }
    await ensureWorkbookSchema();
    const head = await queryHelpers.queryOne<{ version: number }>(
      `SELECT COALESCE(version, 0) AS version FROM generated_workbooks
       WHERE id = ? AND organization_id = ?`,
      [req.params.id, user.organizationId]
    );
    if (!head) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    const assignment = await ArtifactApprovalService.rejectArtifact({
      orgId: user.organizationId,
      artifactType: 'workbook',
      artifactId: req.params.id,
      rejectedByUserId: user.id,
      reason,
    });
    await queryHelpers.transaction(async () => {
      await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET lifecycle_status = 'draft', approval_current = 0
         WHERE id = ? AND organization_id = ?`,
        [req.params.id, user.organizationId]
      );
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_governance_events
         (id, workbook_id, organization_id, event_type, previous_value, next_value,
          reason, workbook_version, created_by)
         VALUES (?, ?, ?, 'approval.rejected', 'in_review', 'draft', ?, ?, ?)`,
        [uuidv4(), req.params.id, user.organizationId, reason, head.version, user.id]
      );
    });
    res.json({ assignment, state: 'rejected', currentForVersion: false });
  })
);

/**
 * PATCH /api/workbook/:id/cell
 *
 * "Najmniejszy arkusz, który jest naprawdę arkuszem" (2026-07-28) — trwałość
 * dla `EditableSpreadsheetGrid` (src/components/AIChat/KimiWorkspace). Zanim
 * ten endpoint powstał, `PATCH`/`PUT` NIE ISTNIAŁ dla `generated_workbooks` —
 * grep potwierdza, że jedyne mutacje to `/generate`, `/blank`,
 * `/templates/:id/build`, `/:id/clone` (zawsze NOWY wiersz); żadna trasa nie
 * aktualizowała istniejący `schema_json`. Bez tego edycja komórki w
 * przeglądarce nie przeżywa odświeżenia strony — a to jest CAŁY sens zadania.
 *
 * Caller produkcyjny: `EditableSpreadsheetGrid.tsx` → `Api.updateWorkbookCell`
 * (src/services/api.ts) — wołany po każdym zatwierdzeniu edycji komórki
 * (Enter/Tab/blur), za flagą `ff_excele_edit` (domyślnie OFF, patrz
 * src/utils/exceleEditFlag.ts).
 *
 * Body: { sheetIndex: number, rowIndex: number, columnKey: string,
 *         value?: string|number|boolean|null, formula?: string }
 * — `formula` wygrywa nad `value` gdy oba obecne (formuła zapisywana BEZ
 * wiodącego "=", zgodnie z konwencją całego schematu — patrz
 * WorkbookBuilder.ts "Formulas are emitted WITHOUT a leading '='"). Podanie
 * ani `value` ani `formula` czyści komórkę (usuwa jej zawartość, zachowuje
 * styl/walidację jeśli były).
 *
 * Org-scoped (jak każda inna trasa tego routera). Invaliduje `workbookCache`
 * dla tego id, żeby `GET /:id/download` odbudował plik ZE ŚWIEŻEGO
 * `schema_json` zamiast serwować stary bufor (patrz istniejący fallback
 * "Try to regenerate from stored schema" w `GET /:id/download` poniżej —
 * reużyty, nie duplikowany).
 *
 * MAT-006 (2026-08-02): every cell edit now (a) snapshots the PRE-edit
 * `schema_json` into `generated_workbook_versions` at its current version
 * (immutable history, never mutated in place — mirrors
 * `presentation_deck_versions`'s autosave pattern) and (b) applies the
 * `UPDATE` as a compare-and-swap keyed on that same version
 * (`WHERE version = ?`), so two concurrent edits reading the same starting
 * version can no longer both silently win — the loser's `changes` comes back
 * 0 and gets a 409 `VERSION_CONFLICT`, exactly like presentations' autosave.
 * `expectedVersion` in the body is OPTIONAL (backward-compatible with the
 * existing fire-and-forget caller in `EditableSpreadsheetGrid.tsx`): when
 * present it is checked for a stale read BEFORE the write is even attempted;
 * when absent the CAS still runs against the version this request just read.
 */
router.patch(
  '/:id/cell',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { sheetIndex, rowIndex, columnKey, value, formula, expectedVersion } = req.body || {};

    if (
      expectedVersion !== undefined &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    ) {
      res.status(400).json({
        error: 'expectedVersion must be a positive integer when present',
        classified: createP23Error('validation_failed', 'Invalid expectedVersion'),
      });
      return;
    }

    if (typeof sheetIndex !== 'number' || !Number.isInteger(sheetIndex) || sheetIndex < 0) {
      res.status(400).json({
        error: 'sheetIndex must be a non-negative integer',
        classified: createP23Error('validation_failed', 'Invalid sheetIndex'),
      });
      return;
    }
    if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex) || rowIndex < 0) {
      res.status(400).json({
        error: 'rowIndex must be a non-negative integer',
        classified: createP23Error('validation_failed', 'Invalid rowIndex'),
      });
      return;
    }
    if (typeof columnKey !== 'string' || !columnKey.trim()) {
      res.status(400).json({
        error: 'columnKey must be a non-empty string',
        classified: createP23Error('validation_failed', 'Invalid columnKey'),
      });
      return;
    }
    if (formula !== undefined && typeof formula !== 'string') {
      res.status(400).json({
        error: 'formula must be a string when present',
        classified: createP23Error('validation_failed', 'Invalid formula'),
      });
      return;
    }
    if (
      value !== undefined &&
      value !== null &&
      !['string', 'number', 'boolean'].includes(typeof value)
    ) {
      res.status(400).json({
        error: 'value must be string, number, boolean or null',
        classified: createP23Error('validation_failed', 'Invalid value'),
      });
      return;
    }

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; version: number }>(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row?.schema_json) {
      res.status(404).json({
        error: 'Workbook not found or expired',
        classified: createP23Error(
          'access_denied',
          `Workbook ${id} not found for this organization`
        ),
      });
      return;
    }

    const currentVersion = Number(row.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      res.status(409).json({
        error: 'Version conflict: workbook was modified by another session. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: currentVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    const sheet = schema?.sheets?.[sheetIndex];
    if (!sheet || !Array.isArray(sheet.rows) || !Array.isArray(sheet.columns)) {
      res.status(400).json({
        error: `Unknown sheetIndex ${sheetIndex}`,
        classified: createP23Error('validation_failed', 'sheetIndex out of range'),
      });
      return;
    }
    if (rowIndex >= sheet.rows.length) {
      res.status(400).json({
        error: `Unknown rowIndex ${rowIndex} for sheet "${sheet.name}"`,
        classified: createP23Error('validation_failed', 'rowIndex out of range'),
      });
      return;
    }
    if (!sheet.columns.some((c) => c.key === columnKey)) {
      res.status(400).json({
        error: `Unknown columnKey "${columnKey}" for sheet "${sheet.name}"`,
        classified: createP23Error('validation_failed', 'columnKey not found'),
      });
      return;
    }

    const targetRow = sheet.rows[rowIndex];
    if (!targetRow.cells) targetRow.cells = {};
    const oldCell = targetRow.cells[columnKey] ?? {};

    // Formuła wygrywa nad wartością; brak obu = wyczyszczenie komórki. Styl/
    // komentarz/walidacja z istniejącej komórki są zachowane (edycja treści
    // nie ma prawa zjeść formatowania ani reguł walidacji wejścia).
    const trimmedFormula = typeof formula === 'string' ? formula.trim().replace(/^=+/, '') : '';
    const nextCell: Record<string, unknown> = {
      style: oldCell.style,
      comment: oldCell.comment,
      validation: oldCell.validation,
    };
    if (trimmedFormula) {
      nextCell.formula = trimmedFormula;
    } else if (value !== undefined) {
      nextCell.value = value;
    }
    // Undefined fields are dropped by JSON.stringify — no explicit delete needed.
    targetRow.cells[columnKey] = nextCell as (typeof sheet.rows)[number]['cells'][string];

    // Snapshot the PRE-edit state into immutable history at its current
    // version BEFORE overwriting — mirrors presentations' autosave. Best-
    // effort: a history-write failure must never block the actual edit
    // (matches this file's existing fail-soft posture elsewhere).
    try {
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
          uuidv4(),
          id,
          currentVersion,
          row.schema_json,
          Array.isArray(schema?.sheets) ? schema.sheets.length : 0,
          user.id,
        ]
      );
    } catch (err) {
      logger.warn(`[WorkbookRoutes] Could not snapshot version history for ${id}:`, err);
    }

    const nextVersion = currentVersion + 1;
    const updateResult = await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET schema_json = ?, version = ? WHERE id = ? AND organization_id = ? AND version = ?`,
      [JSON.stringify(schema), nextVersion, id, user.organizationId, currentVersion]
    );

    if (!updateResult?.changes) {
      const latest = await queryHelpers.queryOne<{ version: number }>(
        `SELECT version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      );
      res.status(409).json({
        error: 'Version conflict: workbook changed during save. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(latest?.version) || currentVersion,
        clientVersion: currentVersion,
      });
      return;
    }
    // Invaliduje bufor .xlsx w pamięci — następny GET /:id/download odbuduje
    // plik ZE ŚWIEŻEGO schema_json (istniejąca ścieżka "Try to regenerate from
    // stored schema" poniżej), zamiast serwować stary, przed-edycją bufor.
    workbookCache.delete(id);

    // MAT-010 lineage hook. Recorded only past the CAS guard above, so a
    // 409-losing write never appears in the lineage. `...Tracked` +
    // `respondIfLineageLost` (Codex review, second round): retry-safe because
    // the CAS guard above rejects a retried PATCH once the mutation has
    // actually applied (stale `expectedVersion` -> 409, never a double-apply).
    const versionOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'version',
      actorUserId: user.id,
      detail: {
        version: nextVersion,
        previousVersion: currentVersion,
        sheetIndex,
        rowIndex,
        columnKey,
      },
    });
    if (respondIfLineageLost(res, versionOutcome)) return;

    res.json({
      ok: true,
      sheetIndex,
      rowIndex,
      columnKey,
      cell: targetRow.cells[columnKey],
      version: nextVersion,
    });
  })
);

/**
 * POST /api/workbook/:id/import
 *
 * Parses a real XLSX/CSV file with ExcelJS and replaces the workbook's
 * canonical schema. The previous schema is retained in version history.
 */
router.post(
  '/:id/import',
  workbookImportUpload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) return void res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return void res.status(400).json({ error: 'XLSX or CSV file is required' });
    const { id } = req.params;
    await ensureWorkbookSchema();
    const row = await queryHelpers.queryOne<{ schema_json: string; version: number }>(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) return void res.status(404).json({ error: 'Workbook not found' });
    try {
      const parsed = WorkbookSchemaValidator.parse(
        await importWorkbookBuffer(req.file.buffer, req.file.originalname)
      );
      const currentVersion = Number(row.version) || 1;
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json, sheet_count, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          id,
          currentVersion,
          row.schema_json,
          JSON.parse(row.schema_json).sheets?.length || 0,
          user.id,
        ]
      );
      const nextVersion = currentVersion + 1;
      const updated = await queryHelpers.queryRun(
        `UPDATE generated_workbooks SET title = ?, schema_json = ?, version = ?
         WHERE id = ? AND organization_id = ? AND version = ?`,
        [parsed.title, JSON.stringify(parsed), nextVersion, id, user.organizationId, currentVersion]
      );
      if (!updated?.changes)
        return void res.status(409).json({ error: 'Version conflict', code: 'VERSION_CONFLICT' });
      workbookCache.delete(id);
      res.json({ ok: true, schema: parsed, version: nextVersion });
    } catch (error) {
      res
        .status(422)
        .json({ error: error instanceof Error ? error.message : 'Workbook import failed' });
    }
  })
);

/**
 * PATCH /api/workbook/:id/schema-command
 *
 * Canonical structural editor command. Unlike replacing schema_json from the
 * browser, commands are validated and applied to the latest org-scoped schema,
 * snapshot the pre-change version and use CAS for conflict-safe persistence.
 */
router.patch(
  '/:id/schema-command',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) return void res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { command, expectedVersion } = req.body || {};
    if (!command || typeof command.type !== 'string') {
      return void res.status(400).json({ error: 'command.type is required' });
    }
    await ensureWorkbookSchema();
    const row = await queryHelpers.queryOne<{
      schema_json: string;
      version: number;
      title: string;
    }>(
      `SELECT schema_json, version, title FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) return void res.status(404).json({ error: 'Workbook not found' });
    const currentVersion = Number(row.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return void res
        .status(409)
        .json({
          error: 'Version conflict',
          code: 'VERSION_CONFLICT',
          serverVersion: currentVersion,
        });
    }
    const schema = JSON.parse(row.schema_json) as WorkbookSchema;
    const sheetIndex = Number(command.sheetIndex ?? 0);
    const sheet = schema.sheets[sheetIndex];
    const requireSheet = () => {
      if (!Number.isInteger(sheetIndex) || !sheet) throw new Error('Unknown sheetIndex');
      return sheet;
    };
    try {
      switch (command.type) {
        case 'renameWorkbook': {
          const title = String(command.title || '').trim();
          if (!title) throw new Error('Workbook title is required');
          schema.title = title.slice(0, 160);
          break;
        }
        case 'addSheet': {
          const base = String(command.name || `Sheet ${schema.sheets.length + 1}`).trim();
          const names = new Set(schema.sheets.map((s) => s.name.toLowerCase()));
          let name = base || `Sheet ${schema.sheets.length + 1}`;
          let suffix = 2;
          while (names.has(name.toLowerCase())) name = `${base} ${suffix++}`;
          schema.sheets.push({
            name,
            columns: [{ key: 'A', header: 'Column A' }],
            rows: [{ cells: { A: { value: null } } }],
          });
          break;
        }
        case 'renameSheet': {
          const target = requireSheet();
          const name = String(command.name || '').trim();
          if (!name) throw new Error('Sheet name is required');
          if (
            schema.sheets.some(
              (s, i) => i !== sheetIndex && s.name.toLowerCase() === name.toLowerCase()
            )
          )
            throw new Error('Sheet name must be unique');
          target.name = name.slice(0, 80);
          break;
        }
        case 'duplicateSheet': {
          const target = requireSheet();
          const clone = JSON.parse(JSON.stringify(target));
          clone.name = `${target.name} copy`;
          schema.sheets.splice(sheetIndex + 1, 0, clone);
          break;
        }
        case 'deleteSheet': {
          requireSheet();
          if (schema.sheets.length <= 1) throw new Error('Workbook must keep at least one sheet');
          schema.sheets.splice(sheetIndex, 1);
          break;
        }
        case 'moveSheet': {
          requireSheet();
          const toIndex = Number(command.toIndex);
          if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= schema.sheets.length)
            throw new Error('Invalid toIndex');
          const [moved] = schema.sheets.splice(sheetIndex, 1);
          schema.sheets.splice(toIndex, 0, moved);
          break;
        }
        case 'insertRow': {
          const target = requireSheet();
          const rowIndex = Math.max(
            0,
            Math.min(Number(command.rowIndex ?? target.rows.length), target.rows.length)
          );
          target.rows.splice(rowIndex, 0, {
            cells: Object.fromEntries(target.columns.map((c) => [c.key, { value: null }])),
          });
          break;
        }
        case 'deleteRow': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= target.rows.length)
            throw new Error('Invalid rowIndex');
          target.rows.splice(rowIndex, 1);
          break;
        }
        case 'insertColumn': {
          const target = requireSheet();
          const colIndex = Math.max(
            0,
            Math.min(Number(command.colIndex ?? target.columns.length), target.columns.length)
          );
          let key = String(command.key || `column_${Date.now()}`).replace(/[^A-Za-z0-9_]/g, '_');
          while (target.columns.some((c) => c.key === key)) key += '_2';
          target.columns.splice(colIndex, 0, {
            key,
            header: String(command.header || 'New column'),
            width: 16,
          });
          target.rows.forEach((r) => {
            r.cells[key] = { value: null };
          });
          break;
        }
        case 'deleteColumn': {
          const target = requireSheet();
          const colIndex = Number(command.colIndex);
          if (!Number.isInteger(colIndex) || colIndex < 0 || colIndex >= target.columns.length)
            throw new Error('Invalid colIndex');
          if (target.columns.length <= 1) throw new Error('Sheet must keep at least one column');
          const [removed] = target.columns.splice(colIndex, 1);
          target.rows.forEach((r) => {
            delete r.cells[removed.key];
          });
          break;
        }
        case 'resizeColumn': {
          const target = requireSheet();
          const colIndex = Number(command.colIndex);
          const width = Number(command.width);
          if (!target.columns[colIndex] || !Number.isFinite(width) || width < 4 || width > 80)
            throw new Error('Invalid column width');
          target.columns[colIndex].width = width;
          break;
        }
        case 'resizeRow': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          const height = Number(command.height);
          if (!target.rows[rowIndex] || !Number.isFinite(height) || height < 10 || height > 200)
            throw new Error('Invalid row height');
          target.rows[rowIndex].height = height;
          break;
        }
        case 'resizeRowAndColumn': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          const colIndex = Number(command.colIndex);
          const height = Number(command.height);
          const width = Number(command.width);
          if (
            !target.rows[rowIndex] ||
            !target.columns[colIndex] ||
            !Number.isFinite(height) ||
            !Number.isFinite(width) ||
            height < 10 ||
            height > 200 ||
            width < 4 ||
            width > 80
          )
            throw new Error('Invalid row or column size');
          target.rows[rowIndex].height = height;
          target.columns[colIndex].width = width;
          break;
        }
        case 'setRowHidden': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          if (!target.rows[rowIndex]) throw new Error('Invalid rowIndex');
          target.rows[rowIndex].hidden = Boolean(command.hidden);
          break;
        }
        case 'setColumnHidden': {
          const target = requireSheet();
          const colIndex = Number(command.colIndex);
          if (!target.columns[colIndex]) throw new Error('Invalid colIndex');
          target.columns[colIndex].hidden = Boolean(command.hidden);
          break;
        }
        case 'unhideAll': {
          const target = requireSheet();
          target.rows.forEach((rowValue) => {
            rowValue.hidden = false;
          });
          target.columns.forEach((column) => {
            column.hidden = false;
          });
          break;
        }
        case 'mergeCells': {
          const target = requireSheet();
          const range = String(command.range || '').toUpperCase();
          if (!/^\$?[A-Z]+\$?\d+:\$?[A-Z]+\$?\d+$/.test(range))
            throw new Error('Invalid merge range');
          const [start, end] = range.split(':');
          target.merges = [
            ...(target.merges || []).filter((item) => `${item.start}:${item.end}` !== range),
            { start, end },
          ];
          break;
        }
        case 'unmergeCells': {
          const target = requireSheet();
          const range = String(command.range || '').toUpperCase();
          target.merges = (target.merges || []).filter(
            (item) => `${item.start}:${item.end}`.toUpperCase() !== range
          );
          break;
        }
        case 'addConditionalFormat': {
          const target = requireSheet();
          const block = command.block;
          const parsed = ConditionalFormattingBlockSchema.parse(block);
          target.conditionalFormatting = [...(target.conditionalFormatting || []), parsed];
          break;
        }
        case 'clearConditionalFormats': {
          const target = requireSheet();
          target.conditionalFormatting = [];
          break;
        }
        case 'formatCells': {
          const target = requireSheet();
          const rowIndexes = Array.isArray(command.rowIndexes) ? command.rowIndexes : [];
          const colIndexes = Array.isArray(command.colIndexes) ? command.colIndexes : [];
          const style = command.style && typeof command.style === 'object' ? command.style : {};
          rowIndexes.forEach((ri: number) =>
            colIndexes.forEach((ci: number) => {
              const col = target.columns[ci];
              const targetRow = target.rows[ri];
              if (!col || !targetRow) return;
              targetRow.cells[col.key] = {
                ...(targetRow.cells[col.key] || {}),
                style: { ...(targetRow.cells[col.key]?.style || {}), ...style },
              };
            })
          );
          break;
        }
        case 'sortRows': {
          const target = requireSheet();
          const colIndex = Number(command.colIndex);
          const col = target.columns[colIndex];
          if (!col) throw new Error('Invalid colIndex');
          const direction = command.direction === 'desc' ? -1 : 1;
          const scalar = (row: (typeof target.rows)[number]) => row.cells[col.key]?.value ?? '';
          const sorted = target.rows
            .map((rowValue, oldIndex) => ({ rowValue, oldIndex }))
            .sort(
              (a, b) =>
                String(scalar(a.rowValue)).localeCompare(String(scalar(b.rowValue)), undefined, {
                  numeric: true,
                }) * direction
            );
          target.rows = sorted.map(({ rowValue, oldIndex }, newIndex) => {
            const delta = newIndex - oldIndex;
            if (!delta) return rowValue;
            const clone = JSON.parse(JSON.stringify(rowValue)) as typeof rowValue;
            Object.values(clone.cells).forEach((cell) => {
              if (typeof cell?.formula !== 'string') return;
              cell.formula = cell.formula.replace(
                /(\$?[A-Z]+)(\$?)(\d+)/g,
                (_match, letters: string, absoluteRow: string, rowNumber: string) =>
                  `${letters}${absoluteRow}${absoluteRow ? rowNumber : Math.max(1, Number(rowNumber) + delta)}`
              );
            });
            return clone;
          });
          break;
        }
        case 'setFreeze': {
          const target = requireSheet();
          const freezeRow = Number(command.freezeRow ?? 0);
          const freezeCol = Number(command.freezeCol ?? 0);
          if (
            !Number.isInteger(freezeRow) ||
            !Number.isInteger(freezeCol) ||
            freezeRow < 0 ||
            freezeCol < 0
          )
            throw new Error('Invalid freeze panes');
          target.freezeRow = freezeRow;
          target.freezeCol = freezeCol;
          break;
        }
        case 'setAutoFilter': {
          const target = requireSheet();
          target.autoFilter = Boolean(command.enabled);
          break;
        }
        case 'setValidation': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          const colIndex = Number(command.colIndex);
          const col = target.columns[colIndex];
          const targetRow = target.rows[rowIndex];
          if (!col || !targetRow) throw new Error('Invalid cell');
          const current = targetRow.cells[col.key] || {};
          targetRow.cells[col.key] = { ...current, validation: command.validation || undefined };
          break;
        }
        case 'upsertChartImage': {
          const target = requireSheet();
          const chart = ChartImageSchema.parse(command.chart);
          const charts = target.chartImages || [];
          const existingIndex = chart.id ? charts.findIndex((item) => item.id === chart.id) : -1;
          if (existingIndex >= 0) charts[existingIndex] = chart;
          else charts.push({ ...chart, id: chart.id || uuidv4() });
          target.chartImages = charts;
          break;
        }
        case 'deleteChartImage': {
          const target = requireSheet();
          const chartId = String(command.chartId || '');
          target.chartImages = (target.chartImages || []).filter((chart) => chart.id !== chartId);
          break;
        }
        case 'setComment': {
          const target = requireSheet();
          const rowIndex = Number(command.rowIndex);
          const colIndex = Number(command.colIndex);
          const col = target.columns[colIndex];
          const targetRow = target.rows[rowIndex];
          if (!col || !targetRow) throw new Error('Invalid cell');
          const current = targetRow.cells[col.key] || {};
          targetRow.cells[col.key] = {
            ...current,
            comment: String(command.comment || '').trim() || undefined,
          };
          break;
        }
        case 'findReplace': {
          const find = String(command.find || '');
          const replacement = String(command.replacement ?? '');
          if (!find) throw new Error('Find text is required');
          const matchCase = Boolean(command.matchCase);
          const normalize = (value: string) => (matchCase ? value : value.toLocaleLowerCase());
          let replacements = 0;
          schema.sheets.forEach((target) =>
            target.rows.forEach((targetRow) =>
              Object.values(targetRow.cells).forEach((cell) => {
                if (typeof cell.value !== 'string') return;
                const source = cell.value;
                const sourceComparable = normalize(source);
                const findComparable = normalize(find);
                if (!sourceComparable.includes(findComparable)) return;
                if (matchCase) cell.value = source.split(find).join(replacement);
                else {
                  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  cell.value = source.replace(new RegExp(escaped, 'gi'), replacement);
                }
                replacements += 1;
              })
            )
          );
          (schema.metadata ||= {}).lastFindReplaceCount = replacements;
          break;
        }
        default:
          throw new Error(`Unsupported command ${command.type}`);
      }
    } catch (error) {
      return void res
        .status(400)
        .json({ error: error instanceof Error ? error.message : 'Invalid command' });
    }
    const parsed = WorkbookSchemaValidator.safeParse(schema);
    if (!parsed.success)
      return void res
        .status(400)
        .json({ error: 'Command produced invalid workbook schema', issues: parsed.error.issues });
    try {
      await queryHelpers.queryRun(
        `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuidv4(), id, currentVersion, row.schema_json, schema.sheets.length, user.id]
      );
    } catch (error) {
      logger.warn(`[WorkbookRoutes] Could not snapshot schema command for ${id}:`, error);
    }
    const nextVersion = currentVersion + 1;
    const nextFileName = `${parsed.data.title.replace(/[^a-zA-Z0-9._-]+/g, '_') || 'workbook'}.xlsx`;
    const result = await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET schema_json = ?, title = ?, file_name = ?, sheet_count = ?, version = ? WHERE id = ? AND organization_id = ? AND version = ?`,
      [
        JSON.stringify(parsed.data),
        parsed.data.title,
        nextFileName,
        parsed.data.sheets.length,
        nextVersion,
        id,
        user.organizationId,
        currentVersion,
      ]
    );
    if (!result?.changes)
      return void res.status(409).json({ error: 'Version conflict', code: 'VERSION_CONFLICT' });
    workbookCache.delete(id);
    res.json({ ok: true, schema: parsed.data, version: nextVersion });
  })
);

/**
 * GET /api/workbook/:id
 * Returns workbook metadata (for reopen/preview without downloading binary).
 * Must be registered after all specific GET paths (/list, /:id/download,
 * /:id/schema) to avoid the wildcard param matching them.
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{
      id: string;
      title: string;
      description: string | null;
      schema_json: string;
      sheet_count: number;
      file_name: string;
      file_size: number;
      quality_score: number | null;
      version: number;
      action_contract_json?: string | null;
      source_pack_json?: string | null;
      evidence_refs_json?: string | null;
      quality_report_json?: string | null;
      classification: string | null;
      lifecycle_status: string | null;
      approval_current: number | boolean | null;
      created_by: string;
      created_at: string;
      version?: number;
      share_token?: string | null;
      share_expires_at?: string | null;
    }>(
      `SELECT id, title, description, schema_json, sheet_count, file_name, file_size, quality_score, action_contract_json, source_pack_json, evidence_refs_json, created_by, created_at, version, share_token, share_expires_at
     FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    if (!row) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const schemaJson = row.schema_json ? JSON.parse(row.schema_json) : null;
    // critiqueWorkbook is deterministic over the persisted canonical schema.
    // Recompute it on reopen so a cold reload restores the same QA badge even
    // though older generated_workbooks rows predate a quality-report column.
    const qualityReport = schemaJson ? critiqueWorkbook(schemaJson as WorkbookSchema) : null;
    res.json({
      id: row.id,
      title: row.title || schemaJson?.title,
      description: row.description || schemaJson?.description,
      schema_json: schemaJson,
      sheet_count: row.sheet_count,
      file_name: row.file_name,
      file_size: row.file_size,
      quality_score: row.quality_score,
      qualityReport,
      actionContract: row.action_contract_json ? JSON.parse(row.action_contract_json) : {},
      sourcePack: row.source_pack_json ? JSON.parse(row.source_pack_json) : {},
      evidenceRefs: row.evidence_refs_json ? JSON.parse(row.evidence_refs_json) : [],
      qualityReport: row.quality_report_json ? JSON.parse(row.quality_report_json) : null,
      classification: asClassification(row.classification),
      lifecycleStatus: row.lifecycle_status || 'draft',
      approvalCurrent: row.approval_current === true || row.approval_current === 1,
      created_by: row.created_by,
      created_at: row.created_at,
      downloadUrl: `/api/workbook/${row.id}/download`,
      // MAT-006: CAS version + share status (never the raw token — presence
      // only, so the UI can render "Shared" without ever holding the secret).
      version: Number(row.version) || 1,
      isShared: Boolean(row.share_token),
      shareExpiresAt: row.share_expires_at || null,
    });
  })
);

// =============================================================================
// MAT-006 (2026-08-02) — Workbook lifecycle: versions, checkpoint, restore,
// share/revoke, CSV export. All routes below are authenticated + org-scoped
// (this router's `router.use(verifyToken)` / `requireOrgAccess()` above
// already gate everything past the public `/shared/:token` reader at the top
// of this file). Patterned directly on presentations.routes.ts's deck
// version/restore/share (see MAT-006 report for the side-by-side diff of
// what was reused vs. deliberately improved — real transaction for restore,
// hashed token in audit trail).
// =============================================================================

const workbookShareRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many share operations, slow down.' },
});

function hashShareToken(token: string): string {
  // Never persist/log the raw token — a short one-way hash is enough to
  // correlate audit events without reconstructing the secret.
  //
  // NOTE: presentations.routes.ts's analogous `hashIp()` uses
  // `require('crypto')` inline and that pattern was copied here initially —
  // but this router runs as genuine ESM under `tsx` (confirmed via a live
  // browser proof: `ReferenceError: require is not defined` at this exact
  // line), so a top-level `import { createHash } from 'crypto'` is used
  // instead. `presentations.routes.ts` is out of MAT-006's boundaries
  // (frozen, Presentation Studio) so it is deliberately NOT touched here —
  // noting this as a pre-existing latent bug there for the record only.
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

/**
 * GET /api/workbook/:id/versions
 * Version history, newest first. Registered as its own path segment so it
 * can never collide with the generic `GET /:id` above (Express matches by
 * segment count, not just prefix).
 */
router.get(
  '/:id/versions',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    await ensureWorkbookSchema();

    const wb = await queryHelpers.queryOne<{ id: string; version: number }>(
      `SELECT id, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!wb) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const versions = await queryHelpers.queryAll<{
      id: string;
      version: number;
      sheet_count: number;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, version, sheet_count, created_by, created_at
       FROM generated_workbook_versions
       WHERE workbook_id = ?
       ORDER BY version DESC
       LIMIT 50`,
      [id]
    );

    res.json({ data: versions || [], currentVersion: Number(wb.version) || 1 });
  })
);

/**
 * POST /api/workbook/:id/checkpoint
 * Explicit, user-initiated snapshot — distinct from the implicit per-edit
 * versioning `PATCH /:id/cell` already does. Snapshots the CURRENT
 * `schema_json` into history (no content change) and bumps `version`, so a
 * checkpoint is a real, restorable, named point in the timeline. CAS'd via
 * optional `expectedVersion` exactly like the cell PATCH above.
 */
router.post(
  '/:id/checkpoint',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const expectedVersion = req.body?.expectedVersion;
    if (
      expectedVersion !== undefined &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)
    ) {
      res.status(400).json({ error: 'expectedVersion must be a positive integer when present' });
      return;
    }
    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; version: number }>(
      `SELECT schema_json, version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) {
      res.status(404).json({ error: 'Workbook not found or expired' });
      return;
    }

    const currentVersion = Number(row.version) || 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      res.status(409).json({
        error: 'Version conflict: workbook was modified. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: currentVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    let sheetCount = 0;
    try {
      const parsed = JSON.parse(row.schema_json);
      sheetCount = Array.isArray(parsed?.sheets) ? parsed.sheets.length : 0;
    } catch {
      /* keep 0 */
    }

    await queryHelpers.queryRun(
      `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), id, currentVersion, row.schema_json, sheetCount, user.id]
    );

    const nextVersion = currentVersion + 1;
    const updateResult = await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET version = ? WHERE id = ? AND organization_id = ? AND version = ?`,
      [nextVersion, id, user.organizationId, currentVersion]
    );

    if (!updateResult?.changes) {
      const latest = await queryHelpers.queryOne<{ version: number }>(
        `SELECT version FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
        [id, user.organizationId]
      );
      res.status(409).json({
        error: 'Version conflict: workbook changed during checkpoint. Please refresh.',
        code: 'VERSION_CONFLICT',
        serverVersion: Number(latest?.version) || currentVersion,
        clientVersion: currentVersion,
      });
      return;
    }

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'checkpoint',
      resourceType: 'generated_workbook',
      resourceId: id,
      metadata: {
        organizationId: user.organizationId,
        checkpointedFromVersion: currentVersion,
        newVersion: nextVersion,
      },
    });

    // MAT-010 lineage hook. `...Tracked` + `respondIfLineageLost` (Codex
    // review, second round): retry-safe, same CAS guard as version/PATCH
    // above.
    const checkpointOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'checkpoint',
      actorUserId: user.id,
      detail: { version: nextVersion, checkpointedFromVersion: currentVersion },
    });
    if (respondIfLineageLost(res, checkpointOutcome)) return;

    res.json({ ok: true, version: nextVersion, checkpointedFromVersion: currentVersion });
  })
);

/**
 * POST /api/workbook/:id/versions/:versionId/restore
 *
 * Real, single-connection transaction (`withPgTransaction` —
 * `server/src/database/PostgresDatabase.ts`) with a `SELECT ... FOR UPDATE`
 * row lock, so a second concurrent restore/edit genuinely BLOCKS until the
 * first commits (not just a CAS race that might both read the same stale
 * version) — then re-checks `expectedVersion` against the post-lock row, so
 * it always sees accurate data and correctly reports 409 instead of racing.
 * The pre-restore state is snapshotted into history FIRST (inside the same
 * transaction) — restore is a NEW forward version, never a rewrite of past
 * history, and the artifact id never changes (same `generated_workbooks`
 * row, only `schema_json`/`version` move).
 *
 * Test-only fault injection: when `NODE_ENV === 'test'` AND the request
 * carries `x-mat006-force-restore-fault: 1`, a deliberately-invalid INSERT
 * is issued AFTER the legitimate pre-restore snapshot INSERT but BEFORE the
 * final UPDATE, to prove the whole transaction (including that earlier,
 * individually-successful INSERT) rolls back atomically — never reachable
 * outside test mode.
 */
router.post(
  '/:id/versions/:versionId/restore',
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id, versionId } = req.params;
    const expectedVersion = Number(req.body?.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      res.status(400).json({
        error: 'expectedVersion is required',
        code: 'EXPECTED_VERSION_REQUIRED',
      });
      return;
    }
    await ensureWorkbookSchema();

    const forceFault =
      process.env.NODE_ENV === 'test' && req.headers['x-mat006-force-restore-fault'] === '1';

    type RestoreOutcome =
      | { status: 'not_found' }
      | { status: 'version_not_found' }
      | { status: 'conflict'; serverVersion: number }
      | { status: 'ok'; newVersion: number; restoredFromVersion: number };

    let outcome: RestoreOutcome;
    try {
      outcome = await withPgTransaction<RestoreOutcome>(async (query) => {
        const wbRows = await query<{
          id: string;
          organization_id: string;
          version: number;
          schema_json: string;
        }>(
          `SELECT id, organization_id, version, schema_json FROM generated_workbooks WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
          [id, user.organizationId]
        );
        const wb = wbRows.rows[0];
        if (!wb) return { status: 'not_found' };

        const liveVersion = Number(wb.version) || 1;
        if (liveVersion !== expectedVersion) {
          return { status: 'conflict', serverVersion: liveVersion };
        }

        const versionRows = await query<{
          id: string;
          version: number;
          schema_json_snapshot: string;
          sheet_count: number;
        }>(
          `SELECT id, version, schema_json_snapshot, sheet_count FROM generated_workbook_versions WHERE id = $1 AND workbook_id = $2`,
          [versionId, id]
        );
        const versionRow = versionRows.rows[0];
        if (!versionRow) return { status: 'version_not_found' };

        let preRestoreSheetCount = 0;
        try {
          const parsed = JSON.parse(wb.schema_json || '{}');
          preRestoreSheetCount = Array.isArray(parsed?.sheets) ? parsed.sheets.length : 0;
        } catch {
          /* keep 0 */
        }

        // Snapshot the CURRENT (pre-restore) state into history BEFORE
        // overwriting — immutable history, never rewritten.
        await query(
          `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot, sheet_count, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [uuidv4(), id, liveVersion, wb.schema_json, preRestoreSheetCount, user.id]
        );

        if (forceFault) {
          // Deliberate constraint violation (NOT NULL primary key) — proves
          // the transaction, INCLUDING the INSERT immediately above, rolls
          // back atomically rather than leaving a partial/corrupt state.
          await query(
            `INSERT INTO generated_workbook_versions (id, workbook_id, version, schema_json_snapshot) VALUES (NULL, $1, $2, $3)`,
            [id, liveVersion + 1, '{}']
          );
        }

        const newVersion = liveVersion + 1;
        const updateRes = await query(
          `UPDATE generated_workbooks SET schema_json = $1, version = $2 WHERE id = $3 AND organization_id = $4 AND version = $5`,
          [versionRow.schema_json_snapshot, newVersion, id, user.organizationId, liveVersion]
        );
        if (!updateRes.rowCount) {
          // Unreachable in practice given the FOR UPDATE lock above, but a
          // thrown error here still rolls back the transaction correctly.
          throw new Error('RESTORE_CAS_LOST');
        }

        return { status: 'ok', newVersion, restoredFromVersion: versionRow.version };
      });
    } catch (err) {
      logger.error(`[WorkbookRoutes] Restore transaction failed for ${id}:`, err);
      res.status(500).json({ error: 'Restore failed', code: 'RESTORE_TRANSACTION_FAILED' });
      return;
    }

    if (outcome.status === 'not_found') {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }
    if (outcome.status === 'version_not_found') {
      res.status(404).json({ error: 'Version not found' });
      return;
    }
    if (outcome.status === 'conflict') {
      res.status(409).json({
        error: 'Version conflict: workbook was modified before restore.',
        code: 'VERSION_CONFLICT',
        serverVersion: outcome.serverVersion,
        clientVersion: expectedVersion,
      });
      return;
    }

    // Invalidate the in-memory .xlsx buffer so GET /:id/download rebuilds
    // from the just-restored schema_json instead of serving a stale buffer.
    workbookCache.delete(id);

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'restore',
      resourceType: 'generated_workbook',
      resourceId: id,
      metadata: {
        organizationId: user.organizationId,
        restoredFromVersion: outcome.restoredFromVersion,
        newVersion: outcome.newVersion,
      },
    });

    // MAT-010 lineage hook. Restore is a NEW forward version, and the lineage
    // reflects that: an appended `restore` event, never a rewrite of the
    // earlier lineage — same receipt, same artifact id. `...Tracked` +
    // `respondIfLineageLost` (Codex review, second round): retry-safe, same
    // CAS guard (`outcome.status === 'conflict'`) as above.
    const restoreOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'restore',
      actorUserId: user.id,
      detail: {
        version: outcome.newVersion,
        restoredFromVersion: outcome.restoredFromVersion,
      },
    });
    if (respondIfLineageLost(res, restoreOutcome)) return;

    res.json({
      ok: true,
      version: outcome.newVersion,
      restoredFromVersion: outcome.restoredFromVersion,
    });
  })
);

/**
 * POST /api/workbook/:id/share
 * Mints a durable, crypto-random share token (uuid v4 x2, 244 bits of CSPRNG
 * entropy — not sequential/guessable). Default 7-day expiry, overridable via
 * `expiresInDays`. The raw token is returned to the caller ONCE in this
 * response and NEVER written to logs or the audit trail (only a short sha256
 * prefix is persisted in the audit metadata, for correlation only).
 */
router.post(
  '/:id/share',
  workbookShareRateLimiter,
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const expiresInDaysRaw = req.body?.expiresInDays;
    const expiresInDays =
      typeof expiresInDaysRaw === 'number' && expiresInDaysRaw > 0 && expiresInDaysRaw <= 365
        ? expiresInDaysRaw
        : 7;
    await ensureWorkbookSchema();

    const before = await queryHelpers.queryOne<{
      id: string;
      title: string;
      share_token: string | null;
    }>(
      `SELECT id, title, share_token FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!before) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    const token = `${uuidv4()}${uuidv4()}`.replace(/-/g, '');
    const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();

    await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET share_token = ?, share_created_by = ?, share_expires_at = ? WHERE id = ? AND organization_id = ?`,
      [token, user.id, expiresAt, id, user.organizationId]
    );

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'share',
      resourceType: 'generated_workbook',
      resourceId: id,
      before: { hadShareToken: Boolean(before.share_token) },
      after: { shareTokenHash: hashShareToken(token), shareExpiresAt: expiresAt },
      metadata: { organizationId: user.organizationId, title: before.title },
    });

    // MAT-010 lineage hook. Only the token HASH is recorded, never the raw
    // token. `...Tracked` + `respondIfLineageLost` (Codex review, second
    // round): the business write above is `UPDATE ... SET share_token = ?`,
    // a single-column overwrite, not an append — a retry mints a NEW token
    // that REPLACES this one; there is still exactly one valid token
    // afterward, never an accumulation. The residual cost of declining
    // success here is the previous (already-minted) token becoming invalid
    // sooner than expected, not data corruption or an accumulation of live
    // credentials.
    const shareOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'share_minted',
      actorUserId: user.id,
      titleSnapshot: before.title,
      detail: { shareTokenHash: hashShareToken(token), expiresAt },
    });
    if (respondIfLineageLost(res, shareOutcome)) return;

    // `shareUrl` is the FRONTEND page (`SharedWorkbookView`, AppRoutes.tsx)
    // that a human opens; it fetches the JSON API (`/api/workbook/shared/:token`)
    // itself. Relative path — caller (browser) resolves it against its own origin.
    res.json({ shareToken: token, expiresAt, shareUrl: `/excele/shared/${token}` });
  })
);

/**
 * DELETE /api/workbook/:id/share
 * Atomically nulls `share_token` (single UPDATE — no read-modify-write gap),
 * so `/shared/:token` (`WHERE share_token = ?`) stops matching immediately.
 * Idempotent: revoking an already-revoked/never-shared workbook still
 * returns 200 `{ revoked: true }` — there is no "un-revoke via retry" path
 * because the UPDATE always sets NULL unconditionally, never conditionally
 * restores a previous value.
 */
router.delete(
  '/:id/share',
  workbookShareRateLimiter,
  requireAudit,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    await ensureWorkbookSchema();

    const before = await queryHelpers.queryOne<{
      id: string;
      title: string;
      share_token: string | null;
    }>(
      `SELECT id, title, share_token FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!before) {
      res.status(404).json({ error: 'Workbook not found' });
      return;
    }

    await queryHelpers.queryRun(
      `UPDATE generated_workbooks SET share_token = NULL, share_created_by = NULL, share_expires_at = NULL WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );

    await req.emitAuditEvent?.({
      actorType: 'USER',
      action: 'share_revoke',
      resourceType: 'generated_workbook',
      resourceId: id,
      before: { hadShareToken: Boolean(before.share_token) },
      after: { hadShareToken: false },
      metadata: { organizationId: user.organizationId, title: before.title },
    });

    // MAT-010 lineage hook. `...Tracked` + `respondIfLineageLost` (Codex
    // review, second round): retry-safe — this route's own doc comment
    // above already establishes it is idempotent (nulling an already-null
    // token is a no-op), so a retried revoke cannot double-apply anything.
    const revokeOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'share_revoked',
      actorUserId: user.id,
      titleSnapshot: before.title,
      detail: { hadShareToken: Boolean(before.share_token) },
    });
    if (respondIfLineageLost(res, revokeOutcome)) return;

    res.json({ revoked: true });
  })
);

/**
 * GET /api/workbook/:id/export/csv?sheetIndex=N
 * Single-sheet CSV export — see `workbookCsvExport.ts` header for the full,
 * explicit contract (one sheet, UTF-8, formulas as inert text, no styling).
 * The same contract is echoed in `X-Consultify-Csv-Scope` /
 * `X-Consultify-Csv-Limitation` response headers, not just in code comments.
 */
router.get(
  '/:id/export/csv',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { id } = req.params;
    const sheetIndexRaw = req.query.sheetIndex;
    const sheetIndex = sheetIndexRaw !== undefined ? Number(sheetIndexRaw) : 0;
    if (!Number.isInteger(sheetIndex) || sheetIndex < 0) {
      res.status(400).json({ error: 'sheetIndex must be a non-negative integer' });
      return;
    }
    await ensureWorkbookSchema();

    const row = await queryHelpers.queryOne<{ schema_json: string | null; title: string | null }>(
      `SELECT schema_json, title FROM generated_workbooks WHERE id = ? AND organization_id = ?`,
      [id, user.organizationId]
    );
    if (!row?.schema_json) {
      res.status(404).json({ error: 'Workbook not found or expired' });
      return;
    }

    let schema: WorkbookSchema;
    try {
      schema = JSON.parse(row.schema_json);
    } catch (err) {
      logger.error(`[WorkbookRoutes] Stored schema for ${id} is not valid JSON:`, err);
      res.status(500).json({ error: 'Stored workbook schema is corrupted' });
      return;
    }

    let result;
    try {
      result = buildWorkbookCsv(schema, sheetIndex);
    } catch (err) {
      if (err instanceof WorkbookCsvExportError) {
        res.status(400).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }

    const safeSheetName = result.sheetName.replace(/[^a-zA-Z0-9_-]+/g, '_') || 'Sheet';
    const safeTitle = (row.title || 'workbook').replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_${safeSheetName}.csv"`
    );
    // Explicit, machine-readable contract limitation — not only in docs.
    res.setHeader(
      'X-Consultify-Csv-Scope',
      `sheet ${result.sheetIndex + 1} of ${result.totalSheets} ("${result.sheetName}")`
    );
    // NOTE: header VALUES must stay ASCII/Latin1-safe (Node's raw HTTP header
    // validation throws "Invalid character in header content" on e.g. an
    // em-dash) — plain hyphen here, unlike the prose docs/comments above.
    res.setHeader(
      'X-Consultify-Csv-Limitation',
      'CSV covers exactly one sheet; formulas are exported as inert source text (not computed values); styling/formatting/merges/other sheets are not preserved - use the XLSX export for those.'
    );

    // MAT-010 lineage hook. Recorded only once the CSV actually built — a 400
    // (bad sheetIndex) or 404 above never yields an export event. `...Tracked`
    // + `respondIfLineageLost` (Codex review, second round): re-running an
    // export has no persisted side effect to duplicate.
    const csvExportOutcome = await recordLineageEventTracked({
      organizationId: user.organizationId,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'export',
      actorUserId: user.id,
      titleSnapshot: row.title,
      detail: {
        format: 'csv',
        sheetIndex: result.sheetIndex,
        sheetName: result.sheetName,
        totalSheets: result.totalSheets,
      },
    });
    if (respondIfLineageLost(res, csvExportOutcome)) return;

    res.send(result.csv);
  })
);

export default router;
