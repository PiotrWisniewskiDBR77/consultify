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
 * SCOPE NARROWING (documented, not silent): only `.xlsx` uploads are
 * accepted at `/import/parse`. `parseFinanceExcelBuffer`'s own doc comment
 * says a `.csv` upload "carries only the Values-equivalent sheet — the
 * caller must supply the original manifest separately", which would require
 * this router to accept a client-supplied manifest object with no file-
 * embedded provenance to check it against. `checkManifestCompatibility`
 * (called inside `previewFinanceImport`) already validates
 * `manifest.organizationId`/`artifactId` against the caller's real,
 * authenticated context — so an XLSX's file-embedded manifest is safe to
 * trust for that comparison, but accepting an arbitrary client-typed JSON
 * manifest for a CSV upload would need its own review this package's time
 * budget does not cover. `.csv` import is therefore out of scope for this
 * pass — reported, not silently dropped.
 */

import type { Response } from 'express';
import { Router } from 'express';
import multer from 'multer';

import type { AuthRequest } from '../../../middleware/auth.middleware.js';
import { getV8Context } from '../../../middleware/v8Auth.middleware.js';
import { exportFinanceStatementPack } from '../../../services/finance/canonical/financeExportService.js';
import {
  applyFinanceImport,
  parseFinanceExcelBuffer,
  previewFinanceImport,
  type ApplyFinanceImportReopenParams,
  type RawImportRow,
} from '../../../services/finance/canonical/financeImportService.js';
import type { FinanceExcelManifest } from '../../../services/finance/canonical/financeExcelShared.js';
import { asyncHandler } from '../../../utils/asyncHandler.js';
import { financeV2Meta, mapOrgRoleToFinanceRole, readIdempotencyKey, sendError } from './_shared.js';

const router = Router();

const xlsxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — generous for a 5k x 60 statement pack (AP-02 size target)
  fileFilter: (_req, file, cb) => {
    const okMime = file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const okExt = file.originalname.toLowerCase().endsWith('.xlsx');
    cb(null, okMime || okExt);
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
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.manifest.artifactId}-v${result.manifest.businessVersionNo}.xlsx"`);
    res.setHeader('X-Finance-Export-Manifest', JSON.stringify(result.manifest));
    return res.status(200).send(result.workbookBuffer);
  })
);

// ---------------------------------------------------------------------------
// POST /import/parse — multipart .xlsx upload -> { manifest, manifestIssues, rows }
// ---------------------------------------------------------------------------

router.post(
  '/import/parse',
  xlsxUpload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const file = (req as AuthRequest & { file?: Express.Multer.File }).file;
    if (!file) {
      return sendError(res, 400, 'INVALID_BODY', 'multipart field "file" (.xlsx) is required');
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
    if (typeof body.manifest !== 'object' || body.manifest === null) {
      return sendError(res, 400, 'INVALID_BODY', 'manifest is required (from a prior POST /import/parse call)');
    }
    if (!Array.isArray(body.rows)) {
      return sendError(res, 400, 'INVALID_BODY', 'rows must be an array (from a prior POST /import/parse call)');
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
    const batchIdempotencyKey = readIdempotencyKey(req) ?? (typeof body.batchIdempotencyKey === 'string' ? body.batchIdempotencyKey : undefined);
    if (!batchIdempotencyKey) {
      return sendError(res, 400, 'INVALID_BODY', 'batchIdempotencyKey (or Idempotency-Key header) is required');
    }

    let reopen: ApplyFinanceImportReopenParams | undefined;
    if (body.reopen !== undefined && body.reopen !== null) {
      if (typeof body.reopen.reason !== 'string' || !body.reopen.reason || typeof body.reopen.expectedVersion !== 'number') {
        return sendError(res, 400, 'INVALID_BODY', 'reopen.reason (string) and reopen.expectedVersion (number) are required when reopen is supplied');
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
      return sendError(res, httpStatusForApplyImportError(result.code), result.code, result.message, {
        ...(result.reopenRequired !== undefined ? { reopenRequired: result.reopenRequired } : {}),
        ...(result.rowErrors !== undefined ? { rowErrors: result.rowErrors } : {}),
        ...(result.currentWorkingRevisionId !== undefined ? { currentWorkingRevisionId: result.currentWorkingRevisionId } : {}),
      });
    }

    return res.status(200).json({
      data: {
        businessVersionId: result.businessVersionId,
        newWorkingRevisionId: result.newWorkingRevisionId,
        newRevisionSeq: result.newRevisionSeq,
        appliedCount: result.appliedCount,
        idempotentReplay: result.idempotentReplay,
        reopened: result.reopened,
      },
      meta: financeV2Meta(),
    });
  })
);

export default router;
