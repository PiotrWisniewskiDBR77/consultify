/**
 * CV Matching Routes (T067)
 * API endpoints for CV ingestion, competency mapping, and candidate matching.
 */

import { Request, Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/fileUpload.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import * as cvService from '../services/cvMatchingService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

router.use(apiAuthRateLimiter);
router.use(verifyToken);

// ---- Candidate Profiles ----

router.get(
  '/candidates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const candidates = await cvService.getCandidates(orgId);
    res.json(candidates);
  })
);

router.post(
  '/candidates',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { displayName, email, candidateType, userId, notes } = req.body;
    if (!displayName) return res.status(400).json({ error: 'displayName is required' });
    const id = await cvService.createCandidate({
      organizationId: orgId,
      displayName,
      email,
      candidateType,
      userId,
      notes,
      createdBy: req.user!.id,
    });
    res.status(201).json({ success: true, id });
  })
);

router.get(
  '/candidates/:candidateId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const candidate = await cvService.getCandidate(req.params.candidateId, orgId);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
    res.json(candidate);
  })
);

// ---- CV Upload & Extraction ----

router.post(
  '/candidates/:candidateId/upload',
  upload.single('cv'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const ext = req.file.originalname.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      return res.status(400).json({ error: 'Only PDF, DOCX, TXT files are supported' });
    }

    const docId = await cvService.uploadCV({
      candidateId: req.params.candidateId,
      organizationId: orgId,
      originalFilename: req.file.originalname,
      storedPath: req.file.path,
      fileType: ext as 'pdf' | 'docx' | 'txt',
      fileSizeBytes: req.file.size,
      uploadedBy: req.user!.id,
    });

    try {
      await cvService.extractCV(docId, orgId);
    } catch (err) {
      logger.warn(
        '[CVRoutes] Extraction failed, document saved with error status:',
        (err as Error).message
      );
    }

    res.status(201).json({ success: true, documentId: docId });
  })
);

router.get(
  '/candidates/:candidateId/documents',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const docs = await cvService.getCandidateDocuments(req.params.candidateId, orgId);
    res.json(docs);
  })
);

// ---- Competency Mapping ----

router.post(
  '/documents/:documentId/map',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const signals = await cvService.mapCompetencies(req.params.documentId, orgId);
    res.json({ success: true, signals });
  })
);

router.get(
  '/candidates/:candidateId/signals',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const signals = await cvService.getCandidateSignals(req.params.candidateId, orgId);
    res.json(signals);
  })
);

router.put(
  '/signals/:signalId/approve',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { overrideLevel } = req.body;
    await cvService.approveSignal(req.params.signalId, orgId, req.user!.id, overrideLevel);
    res.json({ success: true });
  })
);

router.delete(
  '/signals/:signalId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    await cvService.rejectSignal(req.params.signalId, orgId);
    res.json({ success: true });
  })
);

// ---- Matching ----

router.post(
  '/match/:initiativeId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const results = await cvService.matchCandidatesToRequirements(orgId, req.params.initiativeId);
    res.json(results);
  })
);

// ---- Apply to user profile ----

router.post(
  '/candidates/:candidateId/apply-to-profile',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const applied = await cvService.applyToUserProfile(
      req.params.candidateId,
      orgId,
      userId,
      req.user!.id
    );
    res.json({ success: true, applied });
  })
);

// ---- Delete CV (right to be forgotten) ----

router.delete(
  '/documents/:documentId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });
    await cvService.deleteCV(req.params.documentId, orgId, req.user!.id);
    res.json({ success: true });
  })
);

export default router;
