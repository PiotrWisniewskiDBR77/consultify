/**
 * PDF Import Routes — upload → detect → extract → map → confirm
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/fileUpload.middleware.js';
import PDFParserService from '../services/pdfParserService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();
interface AuthRequest extends Request {
  user?: { id: string; organizationId: string };
}

// Framework mapping schemas
interface FrameworkMappingSchema {
  frameworkId: string;
  dimensionPatterns: Record<string, string[]>;
  scaleRange: [number, number];
}

const MAPPING_SCHEMAS: Record<string, FrameworkMappingSchema> = {
  SIRI: {
    frameworkId: 'SIRI',
    dimensionPatterns: {
      'Operations Visibility': ['operations', 'visibility'],
      'Operations Performance': ['operations performance'],
      Automation: ['automation', 'autonomous'],
      'Workforce Learning': ['workforce', 'learning'],
      'Workforce Lifecycle': ['workforce lifecycle', 'talent'],
      Connectivity: ['connectivity', 'integration'],
      Intelligence: ['intelligence', 'analytics'],
      'Process Digitalization': ['process', 'digitalization'],
    },
    scaleRange: [0, 5],
  },
  ADMA: {
    frameworkId: 'ADMA',
    dimensionPatterns: {
      'Strategy & Goals': ['strategy', 'goals'],
      'Leadership & Culture': ['leadership', 'culture'],
      'People & Skills': ['people', 'skills'],
      'Digital Readiness': ['digital readiness'],
      'Smart Products': ['smart products'],
      'Smart Services': ['smart services'],
      'Smart Production': ['smart production', 'manufacturing'],
      'Smart Supply Chain': ['supply chain'],
      'Data & Analytics': ['data', 'analytics'],
      'Technology Infrastructure': ['technology', 'infrastructure'],
      Cybersecurity: ['cybersecurity', 'security'],
      Sustainability: ['sustainability'],
    },
    scaleRange: [1, 5],
  },
  DRD: {
    frameworkId: 'DRD',
    dimensionPatterns: {
      'Strategy & Governance': ['strategy', 'governance'],
      'Organization & Culture': ['organization', 'culture'],
      'Technology & Infrastructure': ['technology', 'infrastructure'],
      'Data & Analytics': ['data', 'analytics'],
      'Operations & Processes': ['operations', 'processes'],
      'Products & Services': ['products', 'services'],
      'People & Skills': ['people', 'skills'],
    },
    scaleRange: [1, 7],
  },
};

function detectFramework(text: string): { framework: string; confidence: number } {
  const lower = text.toLowerCase();
  const s: Record<string, number> = { SIRI: 0, ADMA: 0, DRD: 0, CMMI: 0 };
  if (lower.includes('smart industry readiness index') || lower.includes('siri')) s.SIRI += 5;
  if (lower.includes('building block') && lower.includes('dimension')) s.SIRI += 3;
  if (lower.includes('adma') || lower.includes('advanced digital maturity')) s.ADMA += 5;
  if (lower.includes('digital innovation hub')) s.ADMA += 4;
  if (lower.includes('digital readiness diagnosis') || lower.includes('drd')) s.DRD += 5;
  if (lower.includes('cmmi') || lower.includes('capability maturity model')) s.CMMI += 5;
  const sorted = Object.entries(s).sort((a, b) => b[1] - a[1]);
  const [best, score] = sorted[0];
  if (score === 0) return { framework: 'UNKNOWN', confidence: 0 };
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return { framework: best, confidence: Math.round((score / Math.max(total, 1)) * 100) / 100 };
}

function extractScores(text: string, fwId: string) {
  const schema = MAPPING_SCHEMAS[fwId];
  const scores: Record<string, { value: number; confidence: number }> = {};
  const unmapped: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    const m = line.match(/^(.{3,80}?)[\s:–-]+\s*(\d(?:\.\d)?)\s*$/);
    if (!m) continue;
    const key = m[1].trim(),
      value = Number(m[2]);
    if (!key || !Number.isFinite(value) || value < 0 || value > 10) continue;
    let matched = false;
    if (schema) {
      for (const [dim, patterns] of Object.entries(schema.dimensionPatterns)) {
        if (patterns.some((p) => key.toLowerCase().includes(p))) {
          const [min, max] = schema.scaleRange;
          scores[dim] = { value, confidence: value >= min && value <= max ? 0.8 : 0.4 };
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      unmapped.push(key);
      scores[key] = { value, confidence: 0.3 };
    }
  }
  return { scores, unmapped };
}

// === ROUTES ===

router.post(
  '/',
  verifyToken,
  isAuthenticated,
  upload.single('file'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id,
      orgId = req.user?.organizationId;
    const file = req.file;
    const filename = file?.originalname || req.body.filename;
    if (!filename) return res.status(400).json({ error: 'File or filename required' });
    const id = uuidv4();
    await dbRun(
      `INSERT INTO pdf_imports (id, organization_id, user_id, filename, target_type, project_id, status, file_path, created_at) VALUES (?, ?, ?, ?, ?, ?, 'uploaded', ?, datetime('now'))`,
      [
        id,
        orgId,
        userId,
        filename,
        req.body.targetType || 'assessment',
        req.body.projectId,
        file?.path || null,
      ]
    );
    logger.info(`[PDFImport] Uploaded ${filename} id=${id}`);
    res.status(201).json({ success: true, id, status: 'uploaded', filename });
  })
);

router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    res.json(
      (await dbAll(
        `SELECT id, filename, target_type, status, page_count, detected_framework, confidence, created_at FROM pdf_imports WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50`,
        [req.user?.organizationId]
      )) || []
    );
  })
);

router.get(
  '/:id/status',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await dbAll(
      `SELECT id, filename, status, page_count, error_message, detected_framework, confidence, parsed_data, mapping_data FROM pdf_imports WHERE id = ?`,
      [req.params.id]
    );
    if (!r?.length) return res.status(404).json({ error: 'Import not found' });
    const row = r[0] as any;
    res.json({
      ...row,
      parsed_data: row.parsed_data ? JSON.parse(row.parsed_data) : null,
      mapping_data: row.mapping_data ? JSON.parse(row.mapping_data) : null,
    });
  })
);

router.post(
  '/:id/detect-framework',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const records = await dbAll(`SELECT * FROM pdf_imports WHERE id = ?`, [req.params.id]);
    if (!records?.length) return res.status(404).json({ error: 'Import not found' });
    const rec = records[0] as any;
    if (!rec.file_path) return res.status(400).json({ error: 'No file uploaded' });
    let text: string;
    try {
      text = await PDFParserService.extractText(rec.file_path);
    } catch (e: any) {
      return res.status(422).json({ error: 'Text extraction failed', detail: e?.message });
    }
    const pageCount = (text.match(/\f/g) || []).length + 1;
    const { framework, confidence } = detectFramework(text);
    await dbRun(
      `UPDATE pdf_imports SET status='detected', detected_framework=?, confidence=?, page_count=?, extracted_text=? WHERE id=?`,
      [framework, confidence, pageCount, text.substring(0, 50000), req.params.id]
    );
    res.json({
      id: req.params.id,
      detectedFramework: framework,
      confidence,
      pageCount,
      textLength: text.length,
      supportedFrameworks: Object.keys(MAPPING_SCHEMAS),
    });
  })
);

router.post(
  '/:id/extract-scores',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const records = await dbAll(
      `SELECT id, detected_framework, extracted_text, status FROM pdf_imports WHERE id = ?`,
      [req.params.id]
    );
    if (!records?.length) return res.status(404).json({ error: 'Import not found' });
    const rec = records[0] as any;
    if (!rec.extracted_text) return res.status(400).json({ error: 'Call detect-framework first' });
    const fwId = req.body.framework || rec.detected_framework;
    if (!fwId || fwId === 'UNKNOWN')
      return res.status(400).json({ error: 'Framework not detected' });
    const { scores, unmapped } = extractScores(rec.extracted_text, fwId);
    const avg =
      Object.values(scores).length > 0
        ? Object.values(scores).reduce((s, v) => s + v.confidence, 0) / Object.values(scores).length
        : 0;
    const parsed = { framework: fwId, scores, unmapped, avgConfidence: avg };
    await dbRun(`UPDATE pdf_imports SET status='extracted', parsed_data=? WHERE id=?`, [
      JSON.stringify(parsed),
      req.params.id,
    ]);
    res.json({
      id: req.params.id,
      framework: fwId,
      scores,
      unmapped,
      avgConfidence: Math.round(avg * 100) / 100,
      totalFields: Object.keys(scores).length,
    });
  })
);

router.post(
  '/:id/confirm-mapping',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { mappedScores, framework, projectId } = req.body;
    if (!mappedScores || !framework)
      return res.status(400).json({ error: 'mappedScores and framework required' });
    const records = await dbAll(`SELECT * FROM pdf_imports WHERE id = ?`, [req.params.id]);
    if (!records?.length) return res.status(404).json({ error: 'Import not found' });
    const mapping = {
      framework,
      confirmedScores: mappedScores,
      confirmedAt: new Date().toISOString(),
      confirmedBy: req.user?.id,
    };
    await dbRun(
      `UPDATE pdf_imports SET status='confirmed', mapping_data=?, project_id=COALESCE(?, project_id) WHERE id=?`,
      [JSON.stringify(mapping), projectId, req.params.id]
    );
    res.json({
      success: true,
      id: req.params.id,
      status: 'confirmed',
      framework,
      fieldCount: Object.keys(mappedScores).length,
    });
  })
);

router.get(
  '/supported-frameworks',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    res.json({
      frameworks: Object.entries(MAPPING_SCHEMAS).map(([id, s]) => ({
        id,
        dimensionCount: Object.keys(s.dimensionPatterns).length,
        scaleRange: s.scaleRange,
      })),
    });
  })
);

export default router;
