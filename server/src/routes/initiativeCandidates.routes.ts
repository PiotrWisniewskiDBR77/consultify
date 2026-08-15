/**
 * Initiative Candidates Routes — F2 SKRZYNKA KANDYDATÓW (D5/D8).
 *
 * Standalone Express router for the AI candidate inbox: artefakty rozpoznania
 * (insights / assessments / audits) → proponowane inicjatywy → akcept/odrzuć.
 *
 * Mount (WIRING — owner of the routes index does this):
 *   import initiativeCandidatesRouter from './routes/initiativeCandidates.routes.js';
 *   app.use('/api/initiatives', initiativeCandidatesRouter);
 *
 * Endpoints (relative to mount point '/api/initiatives'):
 *   GET    /candidates            — lista (opcjonalny ?status=pending|accepted|dismissed)
 *   POST   /candidates/scan       — ręczny skan rozpoznania → nowi kandydaci
 *   POST   /candidates/:id/accept — accept → payload do uruchomienia generatora F1
 *   POST   /candidates/:id/dismiss— odrzuć kandydata
 *
 * Auth via standardowe middleware (verifyToken). Org-scoped przez req.user.
 * Brak feature-flagi — pozostałe routery inicjatyw też jej nie używają.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import {
  acceptCandidate,
  type CandidateStatus,
  dismissCandidate,
  listCandidates,
  scanForCandidates,
} from '../services/initiative/initiativeCandidateService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();
const requireCandidateManage = requirePermission('INITIATIVE_CANDIDATE_MANAGE');

const VALID_STATUSES: ReadonlyArray<CandidateStatus> = ['pending', 'accepted', 'dismissed'];

// ==================== LIST ====================
/**
 * GET /api/initiatives/candidates
 * Lista kandydatów org (opcjonalny filtr ?status=).
 */
router.get(
  '/candidates',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status =
      statusRaw && VALID_STATUSES.includes(statusRaw as CandidateStatus)
        ? (statusRaw as CandidateStatus)
        : undefined;

    try {
      const candidates = await listCandidates(undefined, orgId, status);
      return res.json({ candidates, total: candidates.length });
    } catch (err: unknown) {
      logger.error('[InitiativeCandidates] List error:', err);
      return res.status(500).json({ error: 'Failed to list candidates' });
    }
  })
);

// ==================== SCAN ====================
/**
 * POST /api/initiatives/candidates/scan
 * Ręczny skan rozpoznania → generuje nowych kandydatów (pending).
 */
router.post(
  '/candidates/scan',
  verifyToken,
  requireCandidateManage,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const created = await scanForCandidates(undefined, orgId, {
        createdBy: req.user?.id,
      });
      return res.json({ created, total: created.length });
    } catch (err: unknown) {
      logger.error('[InitiativeCandidates] Scan error:', err);
      return res.status(500).json({ error: 'Failed to scan for candidates' });
    }
  })
);

// ==================== ACCEPT ====================
/**
 * POST /api/initiatives/candidates/:id/accept
 * Akceptuje kandydata → tworzy DRAFT inicjatywę (kanoniczny lejek) z liniażem
 * z kandydata i (domyślnie) uruchamia generator F1, który wypełnia karty.
 * Zwraca `initiativeId`, do którego FE nawiguje (nie tworzy DRAFTU sam).
 *
 * Body (opcjonalny): { fill?: boolean } — domyślnie true; fill=false tworzy
 * sam DRAFT bez wypełniania (np. szybkie przyjęcie do edycji ręcznej).
 */
router.post(
  '/candidates/:id/accept',
  verifyToken,
  requireCandidateManage,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const fill = req.body?.fill !== false; // default true

    try {
      const payload = await acceptCandidate(undefined, id, {
        orgId,
        userId: req.user?.id,
        fill,
      });
      if (!payload) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      // M05-FIX-01 — `accepted` now reports the DURABLE outcome, not merely that the
      // handler ran. A candidate is accepted only once its receipt exists (status
      // 'accepted' + initiative_id). Previously this was a hardcoded `true`, so a
      // database missing the receipt columns still answered 200/accepted while the
      // candidate stayed pending — the handoff looked complete and was not.
      return res.json({
        accepted: payload.receiptPersisted === true,
        receiptPersisted: payload.receiptPersisted === true,
        initiativeId: payload.initiativeId,
        filled: payload.filled,
        payload,
      });
    } catch (err: unknown) {
      logger.error('[InitiativeCandidates] Accept error:', err);
      const known = err as { code?: unknown; message?: unknown; statusCode?: unknown };
      if (known.statusCode === 409 && known.code === 'CANDIDATE_DISMISSED') {
        return res.status(409).json({
          error: typeof known.message === 'string' ? known.message : 'Candidate was dismissed',
          code: known.code,
        });
      }
      return res.status(500).json({ error: 'Failed to accept candidate' });
    }
  })
);

// ==================== DISMISS ====================
/**
 * POST /api/initiatives/candidates/:id/dismiss
 * Odrzuca kandydata.
 */
router.post(
  '/candidates/:id/dismiss',
  verifyToken,
  requireCandidateManage,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;

    try {
      const dismissed = await dismissCandidate(undefined, id, orgId);
      if (!dismissed) {
        return res.status(404).json({ error: 'Candidate not found' });
      }
      return res.json({ dismissed: true });
    } catch (err: unknown) {
      logger.error('[InitiativeCandidates] Dismiss error:', err);
      return res.status(500).json({ error: 'Failed to dismiss candidate' });
    }
  })
);

export default router;
