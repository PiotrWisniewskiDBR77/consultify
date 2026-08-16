/**
 * Finance v3 canonical adapter — Export / Import surface,
 * `/api/v8/finance-v2/{export,import}/*`.
 *
 * `financeExportService.ts` (AP-02, ~297 lines: Statement Pack -> `.xlsx`
 * with a Manifest sheet carrying version/unit/source provenance) and
 * `financeImportService.ts` (AP-02, ~1085 lines: parse -> preview diff ->
 * transactional apply, reusing AP-00's `Operation.batch` contract) had ZERO
 * HTTP routes and ZERO callers. This router wires the three-stage pipeline
 * `financeImportService.ts`'s own header documents (parse / preview / apply)
 * plus the export writer — no new domain logic.
 *
 * Both `.xlsx` and `.csv` are accepted at `/import/parse`. CSV deliberately
 * carries no embedded manifest; preview/apply still require the original
 * export manifest and validate its organization/artifact/version against the
 * authenticated tenant before returning taxonomy or diff details.
 */

import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import type { FinanceExcelManifest } from '../../../services/finance/canonical/financeExcelShared.js';
import { exportFinanceStatementPack } from '../../../services/finance/canonical/financeExportService.js';
import {
  applyFinanceImport,
  type ApplyFinanceImportReopenParams,
  parseFinanceExcelBuffer,
  previewFinanceImport,
  type RawImportRow,
} from '../../../services/finance/canonical/financeImportService.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import {
  financeV2Meta,
  mapOrgRoleToFinanceRole,
  readIdempotencyKey,
  sendError,
} from './_shared.js';

const router = Router();

const financeImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — generous for a 5k x 60 statement pack (AP-02 size target)
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const xlsx =
      name.endsWith('.xlsx') &&
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const csv =
      name.endsWith('.csv') &&
      ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(
        file.mimetype
      );
    cb(null, xlsx || csv);
  },
});

// ---------------------------------------------------------------------------
// GET /export/statement-pack/:artifactId/:businessVersionId — .xlsx download
// ---------------------------------------------------------------------------

router.get(
  '/export/statement-pack/:artifactId/:businessVersionId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId } = getV8Context(req);
    const result = await exportFinanceStatementPack({
      organizationId,
      artifactId: String(req.params.artifactId || ''),
      businessVersionId: String(req.params.businessVersionId || ''),
      requestedBy: userId,
    });
    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400;
      return sendError(res, status, result.code, result.message);
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.manifest.artifactId}-v${result.manifest.businessVersionNo}.xlsx"`
    );
    res.setHeader('X-Finance-Export-Manifest', JSON.stringify(result.manifest));
    return res.status(200).send(result.workbookBuffer);
  })
);

// ---------------------------------------------------------------------------
// POST /import/parse — multipart .xlsx/.csv upload -> { manifest, manifestIssues, rows }
// ---------------------------------------------------------------------------

router.post(
  '/import/parse',
  financeImportUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return sendError(
        res,
        400,
        'INVALID_BODY',
        'multipart field "file" (.xlsx or .csv) is required'
      );
    }
    const parsed = await parseFinanceExcelBuffer(file.buffer, file.originalname);
    return res.status(200).json({ data: parsed, meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// POST /import/preview — read-only diff. body: { artifactId, businessVersionId, manifest, rows }
// ---------------------------------------------------------------------------

router.post(
  '/import/preview',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.artifactId !== 'string' || !body.artifactId) {
      return sendError(res, 400, 'INVALID_BODY', 'artifactId is required');
    }
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }

    // Gate E FIX-B (proof-gaps pass, 2026-08-12) — LUKA 3: ownership checked BEFORE the remaining
    // body-shape checks (manifest/rows) and BEFORE any diff computation. Previously this route had
    // NO ownership check at all — `previewFinanceImport()` always returned 200, with
    // `manifestCheck`/`rowErrors` the only signal something was wrong (a cross-tenant
    // businessVersionId behaved identically to a genuinely-nonexistent one: both left every
    // taxonomy lookup empty). That is a weak, inconsistent response shape compared to every other
    // tenant-scoped denial in this surface (uniform 404) — no leak, no write (both confirmed by the
    // pre-existing CROSS-TENANT test this fix updates), but a needless exception to the pattern.
    // Scoped to (business_version_id, organization_id, artifact_id) together — the same three-way
    // check `applyFinanceImport()` already does for the SAME two ids (`financeImportService.ts`'s
    // `currentBv` lookup) — so a well-formed body whose artifactId and businessVersionId belong to
    // DIFFERENT artifacts (even both under the caller's own org) is also correctly rejected, not
    // just a straightforward cross-org attempt.
    const businessVersion = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ business_version_id: string }>(
        `SELECT business_version_id FROM finance_business_versions WHERE business_version_id = ? AND organization_id = ? AND artifact_id = ?`,
        [body.businessVersionId, organizationId, body.artifactId]
      )
    );
    if (!businessVersion) {
      return sendError(
        res,
        404,
        'NOT_FOUND',
        'Artifact or business version not found in this organization'
      );
    }

    if (typeof body.manifest !== 'object' || body.manifest === null) {
      return sendError(
        res,
        400,
        'INVALID_BODY',
        'manifest is required (from a prior POST /import/parse call)'
      );
    }
    if (!Array.isArray(body.rows)) {
      return sendError(
        res,
        400,
        'INVALID_BODY',
        'rows must be an array (from a prior POST /import/parse call)'
      );
    }

    const result = await previewFinanceImport({
      organizationId,
      artifactId: body.artifactId,
      businessVersionId: body.businessVersionId,
      manifest: body.manifest as FinanceExcelManifest,
      rows: body.rows as RawImportRow[],
    });
    return res.status(200).json({ data: result, meta: financeV2Meta() });
  })
);

// ---------------------------------------------------------------------------
// POST /import/apply — one transactional Operation.batch, all-or-nothing.
// body: { artifactId, businessVersionId, expectedWorkingRevisionId, manifest, rows,
//         batchIdempotencyKey?, reopen? }
// ---------------------------------------------------------------------------

function httpStatusForApplyImportError(code: string): number {
  switch (code) {
    case 'NOT_FOUND':
      return 404;
    case 'MANIFEST_MISMATCH':
      return 400;
    case 'VALIDATION_FAILED':
      return 422;
    case 'STATE_PRECONDITION_FAILED':
    case 'WORKING_REVISION_CONFLICT':
    case 'IDEMPOTENCY_PAYLOAD_COLLISION':
    case 'REOPEN_FAILED':
      return 409;
    default:
      return 400;
  }
}

router.post(
  '/import/apply',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { organizationId, userId, userRole } = getV8Context(req);
    const body = req.body ?? {};
    if (typeof body.artifactId !== 'string' || !body.artifactId) {
      return sendError(res, 400, 'INVALID_BODY', 'artifactId is required');
    }
    if (typeof body.businessVersionId !== 'string' || !body.businessVersionId) {
      return sendError(res, 400, 'INVALID_BODY', 'businessVersionId is required');
    }
    if (typeof body.expectedWorkingRevisionId !== 'string' || !body.expectedWorkingRevisionId) {
      return sendError(res, 400, 'INVALID_BODY', 'expectedWorkingRevisionId is required (CAS pin)');
    }
    if (typeof body.manifest !== 'object' || body.manifest === null) {
      return sendError(res, 400, 'INVALID_BODY', 'manifest is required');
    }
    if (!Array.isArray(body.rows)) {
      return sendError(res, 400, 'INVALID_BODY', 'rows must be an array');
    }
    const batchIdempotencyKey =
      readIdempotencyKey(req) ??
      (typeof body.batchIdempotencyKey === 'string' ? body.batchIdempotencyKey : undefined);
    if (!batchIdempotencyKey) {
      return sendError(
        res,
        400,
        'INVALID_BODY',
        'batchIdempotencyKey (or Idempotency-Key header) is required'
      );
    }

    let reopen: ApplyFinanceImportReopenParams | undefined;
    if (body.reopen !== undefined && body.reopen !== null) {
      if (
        typeof body.reopen.reason !== 'string' ||
        !body.reopen.reason ||
        typeof body.reopen.expectedVersion !== 'number'
      ) {
        return sendError(
          res,
          400,
          'INVALID_BODY',
          'reopen.reason (string) and reopen.expectedVersion (number) are required when reopen is supplied'
        );
      }
      reopen = {
        reason: body.reopen.reason,
        expectedVersion: body.reopen.expectedVersion,
        versionKind: body.reopen.versionKind,
        restatementReason: body.reopen.restatementReason,
        restatementClass: body.reopen.restatementClass,
      };
    }

    const result = await applyFinanceImport({
      organizationId,
      artifactId: body.artifactId,
      businessVersionId: body.businessVersionId,
      expectedWorkingRevisionId: body.expectedWorkingRevisionId,
      actorId: userId,
      actorRole: mapOrgRoleToFinanceRole(userRole),
      manifest: body.manifest as FinanceExcelManifest,
      rows: body.rows as RawImportRow[],
      batchIdempotencyKey,
      reopen,
    });

    if (!result.ok) {
      return sendError(
        res,
        httpStatusForApplyImportError(result.code),
        result.code,
        result.message,
        {
          ...(result.reopenRequired !== undefined ? { reopenRequired: result.reopenRequired } : {}),
          ...(result.rowErrors !== undefined ? { rowErrors: result.rowErrors } : {}),
          ...(result.currentWorkingRevisionId !== undefined
            ? { currentWorkingRevisionId: result.currentWorkingRevisionId }
            : {}),
        }
      );
    }

    return res.status(200).json({
      data: {
        businessVersionId: result.businessVersionId,
        newWorkingRevisionId: result.newWorkingRevisionId,
        newRevisionSeq: result.newRevisionSeq,
        appliedCount: result.appliedCount,
        idempotentReplay: result.idempotentReplay,
        reopened: result.reopened,
        receiptId: result.receiptId,
        requestHash: result.requestHash,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
