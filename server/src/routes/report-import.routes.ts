/**
 * Report Import Routes
 *
 * API endpoints for importing external assessment reports (DRD, SIRI, ADMA).
 * Handles file upload, AI-powered detection, extraction, and mapping.
 */

import { Request, Response, Router } from 'express';
import multer from 'multer';

import { getDatabase } from '../database/index.js';
import { verifyToken as authenticateToken } from '../middleware/auth.middleware.js';
import ReportImportService from '../services/reportImportService.js';
import logger from '../utils/Logger.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/json',
      'text/csv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Service instance
const reportImportService = new ReportImportService();

function isNotFoundError(error: any) {
  const message = String(error?.message || '');
  return message === 'Import not found' || message === 'Source file not found';
}

function notFoundMessage(error: any) {
  const message = String(error?.message || '');
  if (message === 'Import not found') return 'Import not found';
  if (message === 'Source file not found') return 'Source file not found';
  return 'Not found';
}

// ============================================
// MIDDLEWARE: Inject dependencies
// ============================================

router.use((req: any, res, next) => {
  reportImportService.setDependencies({
    db: req.db || getDatabase(),
    aiService: req.aiService,
  });
  next();
});

// ============================================
// GET /api/report-import/supported-formats
// Get list of supported file formats
// ============================================

router.get('/supported-formats', authenticateToken, (req: Request, res: Response) => {
  try {
    const formats = reportImportService.getSupportedFormats();
    res.json({
      success: true,
      data: formats,
    });
  } catch (error: any) {
    logger.error('[ReportImport] Error getting supported formats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load supported formats',
    });
  }
});

// ============================================
// GET /api/report-import/supported-frameworks
// Get list of supported assessment frameworks
// ============================================

router.get('/supported-frameworks', authenticateToken, (req: Request, res: Response) => {
  try {
    const frameworks = reportImportService.getSupportedFrameworks();
    res.json({
      success: true,
      data: frameworks,
    });
  } catch (error: any) {
    logger.error('[ReportImport] Error getting supported frameworks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load supported frameworks',
    });
  }
});

// ============================================
// POST /api/report-import/upload
// Upload file for import
// ============================================

router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req: any, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;
      const projectId = req.body.projectId;

      if (!organizationId || !userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      const importRecord = await reportImportService.uploadFile(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        organizationId,
        userId,
        projectId
      );

      res.status(201).json({
        success: true,
        data: importRecord,
      });
    } catch (error: any) {
      logger.error('[ReportImport] Upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload report',
      });
    }
  }
);

// ============================================
// POST /api/report-import/:id/detect
// Detect framework and extract scores
// ============================================

router.post('/detect/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const extractedData = await reportImportService.processImport(id, organizationId);

    res.json({
      success: true,
      data: extractedData,
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Detection error:', error);
    res.status(500).json({ success: false, error: 'Failed to detect report format' });
  }
});

// ============================================
// GET /api/report-import/:id/preview
// Get preview of extracted data
// ============================================

router.get('/preview/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const importRecord = await reportImportService.getImport(id, organizationId);

    if (!importRecord.extractedData) {
      return res.status(400).json({
        success: false,
        error: 'Import has not been processed yet. Call /detect first.',
      });
    }

    // Generate preview for both target types
    const assessmentPreview = reportImportService.mapToAssessment(
      importRecord.extractedData.scores,
      importRecord.extractedData.framework,
      importRecord.extractedData.metadata
    );

    const reportPreview = reportImportService.mapToReport(
      importRecord.extractedData.scores,
      importRecord.extractedData.framework,
      importRecord.extractedData.metadata
    );

    res.json({
      success: true,
      data: {
        import: importRecord,
        previews: {
          assessment: assessmentPreview,
          report: reportPreview,
        },
        validation: reportImportService.validateExtraction(
          importRecord.extractedData.scores,
          importRecord.extractedData.framework
        ),
      },
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Preview error:', error);
    res.status(500).json({ success: false, error: 'Failed to preview extraction' });
  }
});

// ============================================
// POST /api/report-import/:id/confirm
// Confirm import and create target entity
// ============================================

router.post('/confirm/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { targetType, projectId, overrides } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!targetType || !['assessment', 'report'].includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid targetType. Must be "assessment" or "report".',
      });
    }

    const result = await reportImportService.confirmImport(
      id,
      organizationId,
      targetType,
      userId,
      projectId,
      overrides
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Confirm error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm extraction' });
  }
});

// ============================================
// GET /api/report-import
// List all imports for organization
// ============================================

router.get('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { status, framework, limit, offset } = req.query;

    const imports = await reportImportService.listImports(organizationId, {
      status: status as any,
      framework: framework as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: imports,
    });
  } catch (error: any) {
    logger.error('[ReportImport] List error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list imports',
    });
  }
});

// ============================================
// GET /api/report-import/:id
// Get single import details
// ============================================

router.get('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const importRecord = await reportImportService.getImport(id, organizationId);

    res.json({
      success: true,
      data: importRecord,
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Get error:', error);
    res.status(500).json({ success: false, error: 'Failed to load import' });
  }
});

// ============================================
// DELETE /api/report-import/:id
// Delete import
// ============================================

router.delete('/:id', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    await reportImportService.deleteImport(id, organizationId);

    res.json({
      success: true,
      message: 'Import deleted successfully',
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete import' });
  }
});

// ============================================
// POST /api/report-import/:id/create-assessment
// Create assessment from imported report
// ============================================

router.post('/:id/create-assessment', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const result = await reportImportService.createAssessmentFromImport(
      id,
      organizationId,
      userId,
      projectId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Create assessment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create assessment' });
  }
});

// ============================================
// POST /api/report-import/:id/create-initiatives
// Create initiatives from imported report
// ============================================

router.post('/:id/create-initiatives', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { projectId } = req.body;
    const organizationId = req.user?.organizationId;
    const userId = req.user?.id;

    if (!organizationId || !userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const result = await reportImportService.createInitiativesFromImport(
      id,
      organizationId,
      userId,
      projectId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Create initiatives error:', error);
    res.status(500).json({ success: false, error: 'Failed to create initiatives' });
  }
});

// ============================================
// GET /api/report-import/:id/download
// Download the original PDF file
// ============================================

router.get('/:id/download', authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const importRecord = await reportImportService.getImport(id, organizationId);

    if (!importRecord.sourceFilePath) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      });
    }

    const fs = await import('fs');
    if (!fs.existsSync(importRecord.sourceFilePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on disk',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${importRecord.sourceFileName}"`);
    const stream = fs.createReadStream(importRecord.sourceFilePath);
    stream.pipe(res);
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Download error:', error);
    res.status(500).json({ success: false, error: 'Failed to download source file' });
  }
});

// ============================================
// PUT /api/report-import/:id/scores
// Update extracted scores (manual corrections)
// ============================================

router.put('/:id/scores', authenticateToken, async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { scores } = req.body;
    const organizationId = req.user?.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const importRecord = await reportImportService.getImport(id, organizationId);

    if (!importRecord.extractedData) {
      return res.status(400).json({
        success: false,
        error: 'Import has not been processed yet',
      });
    }

    // Merge updated scores with existing
    const updatedExtractedData = {
      ...importRecord.extractedData,
      scores: {
        ...importRecord.extractedData.scores,
        ...scores,
      },
    };

    // Validate updated scores
    const validation = reportImportService.validateExtraction(
      updatedExtractedData.scores,
      updatedExtractedData.framework
    );

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scores',
        validation,
      });
    }

    // Note: In a full implementation, we would update the database here
    // For now, return the validated data

    res.json({
      success: true,
      data: {
        extractedData: updatedExtractedData,
        validation,
      },
    });
  } catch (error: any) {
    if (isNotFoundError(error)) {
      return res.status(404).json({ success: false, error: notFoundMessage(error) });
    }
    logger.error('[ReportImport] Update scores error:', error);
    res.status(500).json({ success: false, error: 'Failed to update scores' });
  }
});

export default router;
