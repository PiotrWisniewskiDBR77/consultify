/**
 * PDF Import Routes
 * 
 * Endpoints for importing external assessment reports (SIRI, ADMA, CMMI)
 * with AI-powered framework detection and score extraction.
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import authMiddleware from '../middleware/authMiddleware.js';
import * as pdfParserServiceModule from '../services/pdfParserService.js';
const pdfParserService = pdfParserServiceModule.default || pdfParserServiceModule;

const router = express.Router();

// Configure multer for PDF uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/pdf-imports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

/**
 * POST /api/pdf-import/detect-framework
 * 
 * Detect the assessment framework from uploaded PDF
 */
router.post('/detect-framework', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = req.file.path;
        
        // Use AI to detect framework
        const result = await pdfParserService.detectFramework(filePath);
        
        res.json({
            success: true,
            framework: result.framework,
            confidence: result.confidence,
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Framework detection error:', error);
        res.status(500).json({ 
            error: 'Failed to detect framework',
            message: error.message 
        });
    }
});

/**
 * POST /api/pdf-import/extract-scores
 * 
 * Extract assessment scores from PDF using AI
 */
router.post('/extract-scores', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { framework } = req.body;
        if (!framework || !['SIRI', 'ADMA', 'CMMI'].includes(framework)) {
            return res.status(400).json({ error: 'Valid framework required (SIRI, ADMA, CMMI)' });
        }

        const filePath = req.file.path;
        
        // Use AI to extract scores
        const result = await pdfParserService.extractScores(filePath, framework);
        
        res.json({
            success: true,
            framework,
            scores: result.scores,
            rawText: result.rawText?.substring(0, 1000), // First 1000 chars for reference
            metadata: result.metadata
        });
    } catch (error) {
        console.error('Score extraction error:', error);
        res.status(500).json({ 
            error: 'Failed to extract scores',
            message: error.message 
        });
    }
});

/**
 * POST /api/pdf-import/confirm
 * 
 * Confirm and save the imported assessment
 */
router.post('/confirm', authMiddleware, async (req, res) => {
    try {
        const { 
            framework, 
            scores, 
            projectId, 
            organizationId,
            fileName,
            mapToDRD 
        } = req.body;

        if (!framework || !scores || !projectId) {
            return res.status(400).json({ 
                error: 'framework, scores, and projectId are required' 
            });
        }

        const userId = req.user.id;
        const assessmentId = uuidv4();
        
        // Build assessment data based on framework
        let assessmentData;
        
        if (framework === 'SIRI') {
            assessmentData = {
                buildingBlocks: {
                    PROCESS: { score: 0, dimensionScores: {} },
                    TECHNOLOGY: { score: 0, dimensionScores: {} },
                    ORGANIZATION: { score: 0, dimensionScores: {} },
                },
                dimensions: {},
                prioritisationMatrix: {},
                overallScore: 0,
                metadata: {
                    assessmentDate: new Date().toISOString(),
                    version: '2.0',
                    source: 'imported',
                    fileName,
                },
            };
            
            scores.forEach(score => {
                assessmentData.dimensions[score.dimensionId] = {
                    current: score.score,
                    target: Math.min(score.score + 1, 5),
                    gap: Math.max(0, Math.min(score.score + 1, 5) - score.score),
                };
            });
            
            assessmentData.overallScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        } else if (framework === 'ADMA') {
            assessmentData = {
                pillars: {
                    strategy: { current: 0, target: 0, gap: 0, dimensionScores: {} },
                    smart_products: { current: 0, target: 0, gap: 0, dimensionScores: {} },
                    smart_operations: { current: 0, target: 0, gap: 0, dimensionScores: {} },
                    smart_supply: { current: 0, target: 0, gap: 0, dimensionScores: {} },
                    data_driven: { current: 0, target: 0, gap: 0, dimensionScores: {} },
                },
                dimensions: {},
                overallMaturity: 0,
                metadata: {
                    assessmentDate: new Date().toISOString(),
                    version: '2.0',
                    source: 'imported',
                    fileName,
                },
            };
            
            scores.forEach(score => {
                assessmentData.dimensions[score.dimensionId] = {
                    current: score.score,
                    target: Math.min(score.score + 1, 5),
                    gap: Math.max(0, Math.min(score.score + 1, 5) - score.score),
                };
            });
            
            assessmentData.overallMaturity = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        } else if (framework === 'CMMI') {
            assessmentData = {
                maturityLevel: Math.min(...scores.map(s => s.score)),
                practiceAreas: {},
                categories: {
                    DOING: { averageLevel: 0, practiceAreaScores: {} },
                    MANAGING: { averageLevel: 0, practiceAreaScores: {} },
                    ENABLING: { averageLevel: 0, practiceAreaScores: {} },
                },
                overallScore: 0,
                metadata: {
                    assessmentDate: new Date().toISOString(),
                    version: '2.0',
                    source: 'imported',
                    model: 'DEV',
                    fileName,
                },
            };
            
            scores.forEach(score => {
                assessmentData.practiceAreas[score.dimensionId] = {
                    level: score.score,
                };
            });
            
            assessmentData.overallScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
        }

        // Save to database
        const { getDatabase } = await import('../src/database/Database.js');
const db = getDatabase();
        const { calculateFrameworkScore   } = await import('../services/frameworkScoreCalculators.js');
        const multiFrameworkAuditServiceModule = await import('../services/multiFrameworkAuditService.js');
        const multiFrameworkAuditService = multiFrameworkAuditServiceModule.default || multiFrameworkAuditServiceModule;
        
        // Calculate scores
        let overallScore = null;
        let categoryScores = {};
        try {
            const scoreResult = calculateFrameworkScore(framework, assessmentData);
            overallScore = scoreResult.overall;
            categoryScores = scoreResult.categories;
        } catch (scoreError) {
            console.warn('[PDF Import] Score calculation warning:', scoreError.message);
        }
        
        // Insert into database
        await db.query(`
            INSERT INTO multi_framework_assessments (
                id, project_id, organization_id, framework, name, data,
                overall_score, category_scores, import_source,
                created_by, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        `, [
            assessmentId,
            projectId,
            organizationId,
            framework,
            `${framework} Import - ${new Date().toLocaleDateString()}`,
            JSON.stringify(assessmentData),
            overallScore,
            JSON.stringify(categoryScores),
            JSON.stringify({
                fileName,
                confidence: scores[0]?.confidence || 0.5,
                importedAt: new Date().toISOString(),
            }),
            userId,
        ]);
        
        // Log audit entry
        await multiFrameworkAuditService.logPDFImport(
            assessmentId,
            framework,
            userId,
            fileName,
            scores[0]?.confidence || 0.5
        );

        res.json({
            success: true,
            assessmentId,
            framework,
            overallScore,
            categoryScores,
            data: assessmentData,
            message: 'Assessment imported and saved successfully'
        });
    } catch (error) {
        console.error('Import confirmation error:', error);
        res.status(500).json({ 
            error: 'Failed to save imported assessment',
            message: error.message 
        });
    }
});

/**
 * GET /api/pdf-import/supported-frameworks
 * 
 * Get list of supported frameworks for import
 */
router.get('/supported-frameworks', authMiddleware, (req, res) => {
    res.json({
        frameworks: [
            {
                id: 'SIRI',
                name: 'Smart Industry Readiness Index',
                organization: 'Singapore EDB / TÜV SÜD',
                scale: '0-5',
                dimensions: 8,
                supported: true
            },
            {
                id: 'ADMA',
                name: 'Advanced Digital Maturity Assessment',
                organization: 'European Commission / DIH',
                scale: '1-5',
                dimensions: 12,
                supported: true
            },
            {
                id: 'CMMI',
                name: 'Capability Maturity Model Integration',
                organization: 'ISACA',
                scale: '1-5',
                practiceAreas: 20,
                supported: true
            }
        ]
    });
});

export default router;

