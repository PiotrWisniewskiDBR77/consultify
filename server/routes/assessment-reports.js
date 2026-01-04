/**
 * Assessment Reports API Routes
 * 
 * Provides endpoints for the ReportsTable component and DRD Audit Report Builder:
 * - GET /api/assessment-reports - List reports
 * - POST /api/assessment-reports - Create a new report
 * - GET /api/assessment-reports/:id - Get report details
 * - GET /api/assessment-reports/:id/full - Get full report with sections
 * - POST /api/assessment-reports/:id/generate - Generate full report with AI
 * - GET /api/assessment-reports/:id/sections - List sections
 * - POST /api/assessment-reports/:id/sections - Add section
 * - PUT /api/assessment-reports/:id/sections/:sectionId - Update section
 * - DELETE /api/assessment-reports/:id/sections/:sectionId - Delete section
 * - POST /api/assessment-reports/:id/sections/:sectionId/ai - AI action on section
 * - PUT /api/assessment-reports/:id/sections/reorder - Reorder sections
 * - POST /api/assessment-reports/:id/ai-edit - AI edit via chat
 * - POST /api/assessment-reports/:id/finalize - Finalize a report
 */

import express from 'express';
const router = express.Router();
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyToken from '../middleware/authMiddleware.js';
import * as AssessmentOverviewServiceModule from '../services/assessmentOverviewService.js';
const AssessmentOverviewService = AssessmentOverviewServiceModule.default || AssessmentOverviewServiceModule;
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../src/database/Database.js';
import PDFDocument from 'pdfkit';
import XLSX from 'xlsx';
const db = getDatabase();

// Multer configuration for report imports
const importStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/imports');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `import_${uuidv4()}${path.extname(file.originalname)}`);
    }
});

const importUpload = multer({
    storage: importStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|xlsx|xls|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF, Excel, and TXT files are allowed'));
        }
    }
});

// DRD Axis Configuration
const DRD_AXES = {
    processes: { id: 'processes', name: 'Digital Processes', order: 1 },
    digitalProducts: { id: 'digitalProducts', name: 'Digital Products', order: 2 },
    businessModels: { id: 'businessModels', name: 'Digital Business Models', order: 3 },
    dataManagement: { id: 'dataManagement', name: 'Data Management', order: 4 },
    culture: { id: 'culture', name: 'Culture of Transformation', order: 5 },
    cybersecurity: { id: 'cybersecurity', name: 'Cybersecurity', order: 6 },
    aiMaturity: { id: 'aiMaturity', name: 'AI Maturity', order: 7 }
};

// Section type configuration
const SECTION_TYPES = {
    cover_page: { title: 'Cover Page', hasData: false },
    executive_summary: { title: 'Executive Summary', hasData: true },
    methodology: { title: 'DRD Methodology', hasData: false },
    maturity_overview: { title: 'Maturity Overview', hasData: true },
    axis_detail: { title: 'Axis Detail', hasData: true },
    area_detail: { title: 'Area Detail', hasData: true },
    gap_analysis: { title: 'Gap Analysis', hasData: true },
    initiatives: { title: 'Recommended Initiatives', hasData: true },
    roadmap: { title: 'Transformation Roadmap', hasData: true },
    appendix: { title: 'Appendix', hasData: true },
    custom: { title: 'Custom Section', hasData: false }
};

// ============================================================================
// ASSESSMENT REPORTS (for ReportsTable component)
// ============================================================================

/**
 * GET /api/assessment-reports
 * Get list of reports for the ReportsTable component
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const reports = await AssessmentOverviewService.getReportsList(
            organizationId,
            projectId || null
        );

        res.json({ reports, total: reports.length });
    } catch (error) {
        console.error('[Assessment Reports API] Error listing reports:', error);
        res.status(500).json({ error: 'Failed to list reports' });
    }
});

/**
 * POST /api/assessment-reports
 * Create a new report from an assessment
 */
router.post('/', verifyToken, async (req, res) => {
    try {
        const { assessmentId, name, projectId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!assessmentId) {
            return res.status(400).json({ error: 'Assessment ID required' });
        }

        const reportId = uuidv4();
        const now = new Date().toISOString();
        const reportName = name || `Report - ${new Date().toLocaleDateString()}`;

        const sql = `
            INSERT INTO assessment_reports (id, assessment_id, organization_id, name, status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?)
        `;

        db.run(sql, [reportId, assessmentId, organizationId, reportName, userId, now, now], function (err) {
            if (err) {
                // Table might not exist
                if (err.message && err.message.includes('no such table')) {
                    return res.status(500).json({
                        error: 'Reports table not initialized. Run database migrations.',
                        details: 'assessment_reports table does not exist'
                    });
                }
                console.error('[Assessment Reports API] Create error:', err);
                return res.status(500).json({ error: 'Failed to create report' });
            }

            res.status(201).json({
                id: reportId,
                name: reportName,
                assessmentId,
                status: 'DRAFT',
                createdAt: now
            });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Create error:', error);
        res.status(500).json({ error: 'Failed to create report' });
    }
});

/**
 * POST /api/assessment-reports/import
 * Import an external report (PDF/Excel) and extract assessment data
 */
router.post('/import', verifyToken, importUpload.single('reportFile'), async (req, res) => {
    try {
        const { projectId, reportName } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'Report file is required' });
        }

        // Dynamically import ReportParserService to avoid circular dependency
        const ReportParserServiceModule = await import('../ai/reportParserService.js');
        const ReportParserService = ReportParserServiceModule.default || ReportParserServiceModule;

        // Parse the uploaded file
        const parsedData = await ReportParserService.parseReport({
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            organizationId,
            userId
        });

        // Create report from imported data
        const report = await ReportParserService.createReportFromImport({
            parsedData,
            projectId,
            organizationId,
            userId,
            reportName: reportName || `Imported: ${req.file.originalname}`
        });

        // Clean up uploaded file after processing (optional)
        // fs.unlinkSync(req.file.path);

        res.status(201).json({
            id: report.id,
            status: 'IMPORTED',
            createdAt: report.createdAt,
            extractedData: {
                reportType: parsedData.extractedData.reportType,
                dimensionCount: parsedData.extractedData.dimensions?.length || 0,
                confidence: parsedData.metadata.confidence
            },
            drdMapping: Object.entries(parsedData.drdMapping).reduce((acc, [axis, data]) => {
                if (data.estimatedActual) {
                    acc[axis] = {
                        actual: data.estimatedActual,
                        confidence: data.confidence
                    };
                }
                return acc;
            }, {}),
            message: 'Report imported successfully. Review and adjust mapped scores as needed.'
        });
    } catch (error) {
        console.error('[Assessment Reports API] Import error:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: 'Failed to import report',
            details: error.message 
        });
    }
});

/**
 * GET /api/assessment-reports/:id
 * Get full report details with assessment data
 */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const sql = `
            SELECT 
                r.*,
                p.name as project_name
            FROM assessment_reports r
            LEFT JOIN projects p ON r.project_id = p.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(sql, [id, organizationId], (err, row) => {
            if (err) {
                console.error('[Assessment Reports API] Get error:', err);
                return res.status(500).json({ error: 'Failed to get report' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Parse JSON fields - assessment_snapshot contains axis scores
            let content = {};
            let axisData = {};
            let assessmentSnapshot = {};
            try {
                content = row.report_content ? JSON.parse(row.report_content) : {};
                assessmentSnapshot = row.assessment_snapshot ? JSON.parse(row.assessment_snapshot) : {};
                // Extract axisScores from assessment_snapshot
                axisData = assessmentSnapshot.axisScores || {};
            } catch (e) {
                console.warn('[Assessment Reports API] JSON parse warning:', e);
            }

            res.json({
                id: row.id,
                name: row.title,
                status: row.report_status,
                assessmentId: row.project_id,
                assessmentName: row.project_name || 'DRD Assessment',
                content: {
                    executiveSummary: content.executiveSummary || row.summary || '',
                    keyFindings: content.keyFindings || [],
                    recommendations: content.recommendations || [],
                    notes: content.notes || row.notes || ''
                },
                axisData,
                progress: row.avg_actual ? Math.round((row.avg_actual / 7) * 100) : 0,
                isComplete: row.report_status === 'FINAL',
                createdAt: row.generated_at,
                updatedAt: row.generated_at,
                createdBy: row.created_by
            });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Get error:', error);
        res.status(500).json({ error: 'Failed to get report' });
    }
});

/**
 * PUT /api/assessment-reports/:id
 * Update report content
 */
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, content } = req.body;
        const organizationId = req.user.organizationId;
        const now = new Date().toISOString();

        // Validate content structure
        const contentJson = JSON.stringify({
            executiveSummary: content?.executiveSummary || '',
            keyFindings: content?.keyFindings || [],
            recommendations: content?.recommendations || [],
            notes: content?.notes || ''
        });

        const sql = `
            UPDATE assessment_reports 
            SET title = COALESCE(?, title), 
                report_content = ?,
                summary = ?,
                notes = ?
            WHERE id = ? AND organization_id = ? AND report_status = 'DRAFT'
        `;

        db.run(sql, [name, contentJson, content?.executiveSummary || '', content?.notes || '', id, organizationId], function (err) {
            if (err) {
                console.error('[Assessment Reports API] Update error:', err);
                return res.status(500).json({ error: 'Failed to update report' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Report not found or already finalized' });
            }

            res.json({ 
                success: true, 
                id,
                updatedAt: now 
            });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Update error:', error);
        res.status(500).json({ error: 'Failed to update report' });
    }
});

/**
 * POST /api/assessment-reports/:id/finalize
 * Finalize a report (DRAFT -> FINAL)
 */
router.post('/:id/finalize', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;
        const now = new Date().toISOString();

        const sql = `
            UPDATE assessment_reports 
            SET report_status = 'FINAL', finalized_at = ?
            WHERE id = ? AND organization_id = ?
        `;

        db.run(sql, [now, id, organizationId], function (err) {
            if (err) {
                console.error('[Assessment Reports API] Finalize error:', err);
                return res.status(500).json({ error: 'Failed to finalize report' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            res.json({ success: true, id, status: 'FINAL' });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Finalize error:', error);
        res.status(500).json({ error: 'Failed to finalize report' });
    }
});

/**
 * GET /api/assessment-reports/:id/export/pdf
 * Export report as PDF with full sections and embedded matrices
 * Enhanced for area-based enterprise reports (130+ pages)
 */
router.get('/:id/export/pdf', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Get report with assessment data and sections
        const reportSql = `
            SELECT 
                r.*,
                p.name as project_name,
                o.name as organization_name,
                ma.id as assessment_id
            FROM assessment_reports r
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN organizations o ON r.organization_id = o.id
            LEFT JOIN maturity_assessments ma ON ma.project_id = r.project_id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(reportSql, [id, organizationId], async (err, row) => {
            if (err) {
                console.error('[Assessment Reports API] Export PDF error:', err);
                return res.status(500).json({ error: 'Failed to export PDF' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Get report sections
            const sectionsSql = 'SELECT * FROM report_sections WHERE report_id = ? ORDER BY order_index';
            db.all(sectionsSql, [id], async (err, sections) => {
                if (err) sections = [];

                // Get area assessments for enterprise reports
                let areaAssessments = [];
                if (row.assessment_id) {
                    try {
                        const areaSql = 'SELECT * FROM area_assessments WHERE assessment_id = ?';
                        areaAssessments = await new Promise((resolve, reject) => {
                            db.all(areaSql, [row.assessment_id], (err, rows) => {
                                if (err) reject(err);
                                else resolve(rows || []);
                            });
                        });
                    } catch (e) {
                        console.warn('[Assessment Reports API] Area assessments not found:', e.message);
                    }
                }

                // Group area assessments by axis
                const areasByAxis = {};
                areaAssessments.forEach(area => {
                    if (!areasByAxis[area.axis_id]) {
                        areasByAxis[area.axis_id] = [];
                    }
                    areasByAxis[area.axis_id].push(area);
                });

                // Parse content - assessment_snapshot contains axis scores
                let axisData = {};
                let assessmentSnapshot = {};
                try {
                    assessmentSnapshot = row.assessment_snapshot ? JSON.parse(row.assessment_snapshot) : {};
                    axisData = assessmentSnapshot.axisScores || {};
                } catch (e) {
                    console.warn('[Assessment Reports API] JSON parse warning:', e);
                }

                // Generate PDF with full sections

                const doc = new PDFDocument({ 
                    margin: 50,
                    size: 'A4',
                    bufferPages: true,
                    info: {
                        Title: row.title || 'DRD Report',
                        Author: 'DRD Assessment System',
                        Subject: 'Digital Readiness Diagnosis Report - Enterprise Edition',
                        Creator: 'Consultify Platform',
                        Keywords: 'DRD, Digital Transformation, Assessment, Maturity, Enterprise'
                    }
                });

                // Set response headers
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${(row.title || 'DRD_Report').replace(/[^a-z0-9]/gi, '_')}_DRD_Report.pdf"`);

                doc.pipe(res);

                // Helper function for markdown-to-text conversion (simple)
                const markdownToText = (md) => {
                    if (!md) return '';
                    return md
                        .replace(/#{1,6}\s/g, '') // Remove headers
                        .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
                        .replace(/\*([^*]+)\*/g, '$1') // Italic
                        .replace(/`([^`]+)`/g, '$1') // Code
                        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
                        .replace(/^\s*[-*]\s/gm, '• ') // Bullets
                        .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
                        .trim();
                };

                // Helper for drawing tables
                const drawMatrixTable = (data, headers, startX, startY) => {
                    const cellWidth = (doc.page.width - 100) / headers.length;
                    const cellHeight = 20;
                    let y = startY;

                    // Header row
                    doc.font('Helvetica-Bold').fontSize(9);
                    headers.forEach((header, i) => {
                        doc.rect(startX + i * cellWidth, y, cellWidth, cellHeight)
                            .fillAndStroke('#f1f5f9', '#e2e8f0');
                        doc.fillColor('#1e293b')
                            .text(header, startX + i * cellWidth + 4, y + 6, { width: cellWidth - 8 });
                    });
                    y += cellHeight;

                    // Data rows
                    doc.font('Helvetica').fontSize(9);
                    data.forEach((row, rowIndex) => {
                        const bgColor = rowIndex % 2 === 0 ? '#ffffff' : '#f8fafc';
                        row.forEach((cell, i) => {
                            doc.rect(startX + i * cellWidth, y, cellWidth, cellHeight)
                                .fillAndStroke(bgColor, '#e2e8f0');
                            doc.fillColor('#334155')
                                .text(String(cell), startX + i * cellWidth + 4, y + 6, { width: cellWidth - 8 });
                        });
                        y += cellHeight;
                    });

                    return y + 10;
                };

                // Constants for area-based reports
                const BUSINESS_AREAS = {
                    sales: { name: 'Sales', namePl: 'Sprzedaż', icon: '💰' },
                    marketing: { name: 'Marketing', namePl: 'Marketing', icon: '📣' },
                    technology: { name: 'Technology', namePl: 'Technologia', icon: '🔬' },
                    purchasing: { name: 'Purchasing', namePl: 'Zakupy', icon: '🛒' },
                    logistics: { name: 'Logistics', namePl: 'Logistyka', icon: '🚚' },
                    production: { name: 'Production', namePl: 'Produkcja', icon: '🏭' },
                    quality: { name: 'Quality', namePl: 'Jakość', icon: '✅' },
                    finance: { name: 'Finance', namePl: 'Finanse', icon: '💵' },
                    hr: { name: 'HR', namePl: 'HR', icon: '👥' }
                };

                // Draw 9-area matrix for axis
                const drawAreaMatrix = (axisAreas, startX, startY) => {
                    const colWidth = 48;
                    const headerWidth = 100;
                    const rowHeight = 18;
                    const maturityLevels = ['7.Auto', '6.AI', '5.Opt', '4.Zaut', '3.Zint', '2.Dig', '1.Pod'];
                    const areaKeys = Object.keys(BUSINESS_AREAS);
                    
                    let y = startY;
                    let x = startX;

                    // Check if page break needed
                    if (y > doc.page.height - 250) {
                        doc.addPage();
                        y = 50;
                    }

                    // Header row with area names
                    doc.font('Helvetica-Bold').fontSize(7);
                    doc.rect(x, y, headerWidth, rowHeight).fillAndStroke('#1e3a5f', '#1e3a5f');
                    doc.fillColor('#ffffff').text('Poziom', x + 4, y + 5, { width: headerWidth - 8 });
                    x += headerWidth;

                    areaKeys.forEach(areaId => {
                        const area = BUSINESS_AREAS[areaId];
                        doc.rect(x, y, colWidth, rowHeight).fillAndStroke('#1e3a5f', '#1e3a5f');
                        doc.fillColor('#ffffff').text(area.namePl.substring(0, 6), x + 2, y + 5, { width: colWidth - 4, align: 'center' });
                        x += colWidth;
                    });
                    y += rowHeight;

                    // Maturity level rows (7 to 1)
                    for (let level = 7; level >= 1; level--) {
                        x = startX;
                        const bgColor = level % 2 === 0 ? '#ffffff' : '#f8fafc';
                        
                        doc.rect(x, y, headerWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');
                        doc.font('Helvetica').fontSize(7).fillColor('#334155')
                            .text(maturityLevels[7 - level], x + 4, y + 5, { width: headerWidth - 8 });
                        x += headerWidth;

                        areaKeys.forEach(areaId => {
                            const areaData = axisAreas.find(a => a.area_id === areaId);
                            const current = areaData?.current_level || 0;
                            const target = areaData?.target_level || 0;
                            
                            doc.rect(x, y, colWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');
                            
                            // Draw markers
                            if (current === level) {
                                doc.circle(x + colWidth/2, y + rowHeight/2, 5).fill('#3b82f6'); // Current - blue
                            }
                            if (target === level) {
                                doc.circle(x + colWidth/2, y + rowHeight/2, 5).strokeColor('#10b981').lineWidth(2).stroke(); // Target - green outline
                            }
                            
                            x += colWidth;
                        });
                        y += rowHeight;
                    }

                    // Summary rows
                    const summaryRows = [
                        { label: 'Aktualny', getValue: (a) => a?.current_level || 0, color: '#3b82f6' },
                        { label: 'Docelowy', getValue: (a) => a?.target_level || 0, color: '#10b981' },
                        { label: 'Luka', getValue: (a) => (a?.target_level || 0) - (a?.current_level || 0), color: '#f59e0b' }
                    ];

                    summaryRows.forEach((sumRow, i) => {
                        x = startX;
                        const bgColor = i % 2 === 0 ? '#e0f2fe' : '#dcfce7';
                        
                        doc.rect(x, y, headerWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');
                        doc.font('Helvetica-Bold').fontSize(7).fillColor('#334155')
                            .text(sumRow.label, x + 4, y + 5, { width: headerWidth - 8 });
                        x += headerWidth;

                        areaKeys.forEach(areaId => {
                            const areaData = axisAreas.find(a => a.area_id === areaId);
                            const value = sumRow.getValue(areaData);
                            
                            doc.rect(x, y, colWidth, rowHeight).fillAndStroke(bgColor, '#e2e8f0');
                            doc.font('Helvetica-Bold').fontSize(8).fillColor(sumRow.color)
                                .text(value > 0 && sumRow.label === 'Luka' ? `+${value}` : String(value), x + 2, y + 5, { width: colWidth - 4, align: 'center' });
                            x += colWidth;
                        });
                        y += rowHeight;
                    });

                    return y + 15;
                };

                // Draw detailed area card
                const drawAreaCard = (areaData, areaId, startY) => {
                    const area = BUSINESS_AREAS[areaId];
                    if (!area) return startY;

                    let y = startY;
                    const pageWidth = doc.page.width;
                    const marginX = 50;
                    const contentWidth = pageWidth - 2 * marginX;

                    // Check if page break needed
                    if (y > doc.page.height - 300) {
                        doc.addPage();
                        y = 50;
                    }

                    // Area header with icon
                    doc.font('Helvetica-Bold').fontSize(14).fillColor('#1e3a5f')
                        .text(`${area.icon} ${area.namePl}`, marginX, y);
                    y += 20;

                    // Maturity badges
                    const current = areaData?.current_level || 0;
                    const target = areaData?.target_level || 0;
                    const gap = target - current;
                    const priority = gap >= 3 ? 'WYSOKI' : gap >= 2 ? 'ŚREDNI' : gap > 0 ? 'NISKI' : 'OK';
                    const priorityColor = gap >= 3 ? '#ef4444' : gap >= 2 ? '#f59e0b' : gap > 0 ? '#10b981' : '#64748b';

                    doc.font('Helvetica').fontSize(10).fillColor('#64748b')
                        .text(`Aktualny: ${current}  →  Docelowy: ${target}  |  Luka: +${gap}  |  Priorytet: `, marginX, y, { continued: true });
                    doc.fillColor(priorityColor).text(priority);
                    y += 20;

                    // Current state description
                    let currentStateDesc = areaData?.current_state_description || '';
                    if (currentStateDesc) {
                        doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text('Opis stanu aktualnego:', marginX, y);
                        y += 14;
                        doc.font('Helvetica').fontSize(9).fillColor('#475569')
                            .text(currentStateDesc, marginX, y, { width: contentWidth, align: 'justify' });
                        y = doc.y + 10;
                    }

                    // Interview notes
                    let interviewNotes = [];
                    try {
                        interviewNotes = areaData?.interview_notes ? JSON.parse(areaData.interview_notes) : [];
                    } catch (e) {}
                    
                    if (interviewNotes.length > 0) {
                        doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text('Notatki z wywiadu:', marginX, y);
                        y += 14;
                        interviewNotes.forEach(note => {
                            doc.font('Helvetica-Oblique').fontSize(9).fillColor('#64748b')
                                .text(`"${note.quote || note}"`, marginX + 10, y, { width: contentWidth - 20 });
                            y = doc.y + 5;
                        });
                        y += 5;
                    }

                    // Recommendations
                    let recommendations = [];
                    try {
                        recommendations = areaData?.recommendations ? JSON.parse(areaData.recommendations) : [];
                    } catch (e) {}
                    
                    if (recommendations.length > 0) {
                        doc.font('Helvetica-Bold').fontSize(10).fillColor('#334155').text('Rekomendacje rozwojowe:', marginX, y);
                        y += 14;
                        recommendations.slice(0, 3).forEach((rec, i) => {
                            const recText = typeof rec === 'string' ? rec : rec.action || rec.title || '';
                            const time = typeof rec === 'object' ? rec.time || rec.timeline : '';
                            const budget = typeof rec === 'object' ? rec.budget : '';
                            
                            doc.font('Helvetica').fontSize(9).fillColor('#334155')
                                .text(`${i + 1}. ${recText}`, marginX + 10, y, { width: contentWidth - 20 });
                            y = doc.y + 2;
                            if (time || budget) {
                                doc.font('Helvetica').fontSize(8).fillColor('#64748b')
                                    .text(`   ${time ? `⏰ ${time}` : ''} ${budget ? `💰 ${budget}` : ''}`, marginX + 10, y);
                                y = doc.y + 3;
                            }
                        });
                        y += 5;
                    }

                    // Risks
                    let risks = [];
                    try {
                        risks = areaData?.risks ? JSON.parse(areaData.risks) : [];
                    } catch (e) {}
                    
                    if (risks.length > 0) {
                        doc.font('Helvetica-Bold').fontSize(10).fillColor('#ef4444').text('Ryzyka:', marginX, y);
                        y += 14;
                        risks.slice(0, 3).forEach((risk, i) => {
                            const riskText = typeof risk === 'string' ? risk : risk.description || risk.title || '';
                            doc.font('Helvetica').fontSize(9).fillColor('#475569')
                                .text(`⚠️ ${riskText}`, marginX + 10, y, { width: contentWidth - 20 });
                            y = doc.y + 3;
                        });
                        y += 5;
                    }

                    // KPIs
                    let kpis = [];
                    try {
                        kpis = areaData?.kpis ? JSON.parse(areaData.kpis) : [];
                    } catch (e) {}
                    
                    if (kpis.length > 0) {
                        doc.font('Helvetica-Bold').fontSize(10).fillColor('#10b981').text('KPI do monitorowania:', marginX, y);
                        y += 14;
                        kpis.slice(0, 4).forEach((kpi, i) => {
                            const kpiName = typeof kpi === 'string' ? kpi : kpi.name || kpi.metric || '';
                            const kpiTarget = typeof kpi === 'object' ? kpi.target : '';
                            doc.font('Helvetica').fontSize(9).fillColor('#334155')
                                .text(`📊 ${kpiName}${kpiTarget ? ` (Cel: ${kpiTarget})` : ''}`, marginX + 10, y, { width: contentWidth - 20 });
                            y = doc.y + 3;
                        });
                    }

                    // Separator line
                    y += 10;
                    doc.moveTo(marginX, y).lineTo(pageWidth - marginX, y).strokeColor('#e2e8f0').stroke();
                    y += 15;

                    return y;
                };

                // If we have sections, render them
                if (sections && sections.length > 0) {
                    for (let i = 0; i < sections.length; i++) {
                        const section = sections[i];
                        
                        // Add page break for each major section (except cover page)
                        if (i > 0 && ['executive_summary', 'methodology', 'maturity_overview', 'gap_analysis', 'initiatives', 'roadmap', 'appendix'].includes(section.section_type)) {
                            doc.addPage();
                        }

                        // Section title
                        if (section.section_type === 'cover_page') {
                            // Cover page styling
                            doc.moveDown(5);
                            doc.fontSize(28).font('Helvetica-Bold').fillColor('#1e3a5f')
                                .text(row.title || 'DRD Audit Report', { align: 'center' });
                            doc.moveDown(2);
                            doc.fontSize(16).font('Helvetica').fillColor('#64748b')
                                .text(row.organization_name || '', { align: 'center' });
                            doc.moveDown(1);
                            doc.fontSize(12)
                                .text(`Assessment: ${row.project_name || 'DRD Assessment'}`, { align: 'center' });
                            doc.moveDown(0.5);
                            doc.fontSize(10)
                                .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
                            doc.moveDown(0.5);
                            doc.text(`Status: ${row.report_status}`, { align: 'center' });
                            continue;
                        }

                        // Regular section header
                        doc.fontSize(18).font('Helvetica-Bold').fillColor('#1e3a5f')
                            .text(section.title);
                        doc.moveDown(0.5);

                        // Add matrix table for data sections
                        if (['maturity_overview', 'gap_analysis'].includes(section.section_type) && Object.keys(axisData).length > 0) {
                            const axisLabels = {
                                processes: 'Digital Processes',
                                digitalProducts: 'Digital Products',
                                businessModels: 'Business Models',
                                dataManagement: 'Data Management',
                                culture: 'Culture',
                                cybersecurity: 'Cybersecurity',
                                aiMaturity: 'AI Maturity'
                            };

                            const tableData = Object.entries(axisData).map(([axis, data]) => {
                                const gap = (data?.target || 0) - (data?.actual || 0);
                                const priority = gap >= 3 ? 'HIGH' : gap >= 2 ? 'MEDIUM' : gap > 0 ? 'LOW' : 'OK';
                                return [axisLabels[axis] || axis, data?.actual || '-', data?.target || '-', gap, priority];
                            });

                            const headers = ['Axis', 'Current', 'Target', 'Gap', 'Priority'];
                            const currentY = drawMatrixTable(tableData, headers, 50, doc.y + 10);
                            doc.y = currentY;
                        }

                        // Axis detail with area-based structure (Enterprise)
                        if (section.section_type === 'axis_detail' && section.axis_id) {
                            const axisId = section.axis_id;
                            const axisAreas = areasByAxis[axisId] || [];
                            
                            // If we have area assessments, render the full enterprise structure
                            if (axisAreas.length > 0) {
                                // Axis summary header
                                const axis = axisData[axisId];
                                if (axis) {
                                    const gap = (axis.target || 0) - (axis.actual || 0);
                                    doc.fontSize(11).font('Helvetica').fillColor('#334155');
                                    doc.text(`Średni poziom osi: Aktualny ${axis.actual || 0} → Docelowy ${axis.target || 0} | Luka: +${gap}`);
                                    doc.moveDown(0.5);
                                }

                                // Draw 9-area matrix
                                doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e3a5f')
                                    .text('Macierz Dojrzałości Obszarów');
                                doc.moveDown(0.3);
                                
                                const matrixEndY = drawAreaMatrix(axisAreas, 50, doc.y);
                                doc.y = matrixEndY;
                                doc.moveDown(1);

                                // Draw detailed area cards for each of 9 areas
                                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e3a5f')
                                    .text('Szczegółowa Analiza Obszarów');
                                doc.moveDown(0.5);

                                const areaOrder = ['sales', 'marketing', 'technology', 'purchasing', 'logistics', 'production', 'quality', 'finance', 'hr'];
                                
                                // Sort areas by gap (highest priority first)
                                const sortedAreas = areaOrder.map(areaId => {
                                    return axisAreas.find(a => a.area_id === areaId) || { area_id: areaId, current_level: 0, target_level: 0 };
                                }).sort((a, b) => {
                                    const gapA = (a.target_level || 0) - (a.current_level || 0);
                                    const gapB = (b.target_level || 0) - (b.current_level || 0);
                                    return gapB - gapA;
                                });

                                for (const areaData of sortedAreas) {
                                    doc.y = drawAreaCard(areaData, areaData.area_id, doc.y);
                                }
                            } else {
                                // Fallback to simple axis view
                                const axis = axisData[axisId];
                                if (axis) {
                                    const gap = (axis.target || 0) - (axis.actual || 0);
                                    doc.fontSize(11).font('Helvetica').fillColor('#334155');
                                    doc.text(`Current Level: ${axis.actual || '-'} / Target: ${axis.target || '-'} / Gap: ${gap}`);
                                    doc.moveDown(0.5);
                                }
                            }
                        }

                        // Section content (markdown to plain text)
                        const plainContent = markdownToText(section.content);
                        if (plainContent) {
                            doc.fontSize(11).font('Helvetica').fillColor('#334155')
                                .text(plainContent, { 
                                    align: 'justify',
                                    lineGap: 3
                                });
                        }

                        doc.moveDown(1);
                    }
                } else {
                    // Fallback: render old-style content if no sections
                    // Title
                    doc.fontSize(24).font('Helvetica-Bold').text(row.title || 'DRD Report', { align: 'center' });
                    doc.moveDown();
                    doc.fontSize(12).font('Helvetica').text(`Assessment: ${row.project_name || 'DRD Assessment'}`, { align: 'center' });
                    doc.fontSize(10).text(`Status: ${row.report_status} | Created: ${new Date(row.generated_at).toLocaleDateString()}`, { align: 'center' });
                    doc.moveDown(2);

                    // Parse old content format
                    let content = {};
                    try {
                        content = row.report_content ? JSON.parse(row.report_content) : {};
                    } catch (e) {}

                    // Executive Summary
                    if (content.executiveSummary) {
                        doc.fontSize(16).font('Helvetica-Bold').text('Executive Summary');
                        doc.moveDown(0.5);
                        doc.fontSize(11).font('Helvetica').text(content.executiveSummary);
                        doc.moveDown(1.5);
                    }

                    // Key Findings
                    if (content.keyFindings && content.keyFindings.length > 0) {
                        doc.fontSize(16).font('Helvetica-Bold').text('Key Findings');
                        doc.moveDown(0.5);
                        content.keyFindings.forEach((finding, i) => {
                            doc.fontSize(11).font('Helvetica').text(`${i + 1}. ${finding}`);
                            doc.moveDown(0.3);
                        });
                        doc.moveDown(1);
                    }

                    // Gap Analysis table
                    if (Object.keys(axisData).length > 0) {
                        doc.addPage();
                        doc.fontSize(16).font('Helvetica-Bold').text('Gap Analysis Summary');
                        doc.moveDown(0.5);
                
                        const axisLabels = {
                            processes: 'Processes',
                            digitalProducts: 'Digital Products',
                            businessModels: 'Business Models',
                            dataManagement: 'Data Management',
                            culture: 'Culture',
                            cybersecurity: 'Cybersecurity',
                            aiMaturity: 'AI Maturity'
                        };

                        Object.entries(axisData).forEach(([axis, data]) => {
                            if (data && (data.actual || data.target)) {
                                const label = axisLabels[axis] || axis;
                                const gap = (data.target || 0) - (data.actual || 0);
                                doc.fontSize(11).font('Helvetica')
                                    .text(`${label}: Current ${data.actual || 0} → Target ${data.target || 0} (Gap: ${gap})`);
                                doc.moveDown(0.3);
                            }
                        });
                    }
                }

                // Footer on each page
                const pageCount = doc.bufferedPageRange().count;
                for (let i = 0; i < pageCount; i++) {
                    doc.switchToPage(i);
                    doc.fontSize(8).fillColor('#94a3b8')
                        .text(
                            `DRD Assessment Report - ${row.organization_name || ''} - Page ${i + 1}`,
                            50, doc.page.height - 40,
                            { align: 'center', width: doc.page.width - 100 }
                        );
                }

                doc.end();
            });
        });
    } catch (error) {
        console.error('[Assessment Reports API] Export PDF error:', error);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
});

/**
 * GET /api/assessment-reports/:id/export/excel
 * Export report as Excel
 */
router.get('/:id/export/excel', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Get report with assessment data
        const sql = `
            SELECT 
                r.*,
                p.name as project_name
            FROM assessment_reports r
            LEFT JOIN projects p ON r.project_id = p.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(sql, [id, organizationId], async (err, row) => {
            if (err) {
                console.error('[Assessment Reports API] Export Excel error:', err);
                return res.status(500).json({ error: 'Failed to export Excel' });
            }

            if (!row) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Parse content - assessment_snapshot contains axis scores
            let content = {};
            let axisData = {};
            let assessmentSnapshot = {};
            try {
                content = row.report_content ? JSON.parse(row.report_content) : {};
                assessmentSnapshot = row.assessment_snapshot ? JSON.parse(row.assessment_snapshot) : {};
                axisData = assessmentSnapshot.axisScores || {};
            } catch (e) {
                console.warn('[Assessment Reports API] JSON parse warning:', e);
            }

            // Generate Excel using xlsx library

            const workbook = XLSX.utils.book_new();

            // Summary sheet
            const summaryData = [
                ['Report Name', row.title],
                ['Assessment', row.project_name || 'DRD Assessment'],
                ['Status', row.report_status],
                ['Created', new Date(row.generated_at).toLocaleDateString()],
                [],
                ['Executive Summary'],
                [content.executiveSummary || row.summary || '']
            ];
            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

            // Key Findings sheet
            if (content.keyFindings && content.keyFindings.length > 0) {
                const findingsData = [['#', 'Finding']];
                content.keyFindings.forEach((f, i) => findingsData.push([i + 1, f]));
                const findingsSheet = XLSX.utils.aoa_to_sheet(findingsData);
                XLSX.utils.book_append_sheet(workbook, findingsSheet, 'Key Findings');
            }

            // Recommendations sheet
            if (content.recommendations && content.recommendations.length > 0) {
                const recsData = [['#', 'Recommendation']];
                content.recommendations.forEach((r, i) => recsData.push([i + 1, r]));
                const recsSheet = XLSX.utils.aoa_to_sheet(recsData);
                XLSX.utils.book_append_sheet(workbook, recsSheet, 'Recommendations');
            }

            // Gap Analysis sheet
            const axisLabels = {
                processes: 'Processes',
                digitalProducts: 'Digital Products',
                businessModels: 'Business Models',
                dataManagement: 'Data Management',
                culture: 'Culture',
                cybersecurity: 'Cybersecurity',
                aiMaturity: 'AI Maturity'
            };

            const gapData = [['Axis', 'Current Level', 'Target Level', 'Gap']];
            Object.entries(axisData).forEach(([axis, data]) => {
                if (data && (data.actual || data.target)) {
                    const gap = (data.target || 0) - (data.actual || 0);
                    gapData.push([axisLabels[axis] || axis, data.actual || 0, data.target || 0, gap]);
                }
            });
            
            if (gapData.length > 1) {
                const gapSheet = XLSX.utils.aoa_to_sheet(gapData);
                XLSX.utils.book_append_sheet(workbook, gapSheet, 'Gap Analysis');
            }

            // Generate buffer
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // Set response headers
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${(row.title || 'DRD_Report').replace(/[^a-z0-9]/gi, '_')}_Report.xlsx"`);
            res.send(buffer);
        });
    } catch (error) {
        console.error('[Assessment Reports API] Export Excel error:', error);
        res.status(500).json({ error: 'Failed to export Excel' });
    }
});

// ============================================================================
// DRD AUDIT REPORT BUILDER - SECTION MANAGEMENT
// ============================================================================

/**
 * GET /api/assessment-reports/:id/full
 * Get full report with all sections for the Report Builder
 */
router.get('/:id/full', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Get report with assessment data
        const reportSql = `
            SELECT 
                r.*,
                p.name as project_name,
                o.name as organization_name
            FROM assessment_reports r
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN organizations o ON r.organization_id = o.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(reportSql, [id, organizationId], (err, report) => {
            if (err) {
                console.error('[Report Builder API] Get full report error:', err);
                return res.status(500).json({ error: 'Failed to get report' });
            }

            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Get all sections for this report
            const sectionsSql = `
                SELECT * FROM report_sections 
                WHERE report_id = ?
                ORDER BY order_index ASC
            `;

            db.all(sectionsSql, [id], (err, sections) => {
                if (err) {
                    console.error('[Report Builder API] Get sections error:', err);
                    // Return report without sections if table doesn't exist
                    sections = [];
                }

                // Parse JSON fields - assessment_snapshot contains axis scores
                let axisData = {};
                let content = {};
                let assessmentSnapshot = {};
                try {
                    assessmentSnapshot = report.assessment_snapshot ? JSON.parse(report.assessment_snapshot) : {};
                    axisData = assessmentSnapshot.axisScores || {};
                    content = report.report_content ? JSON.parse(report.report_content) : {};
                } catch (e) {
                    console.warn('[Report Builder API] JSON parse warning:', e);
                }

                // Parse section data
                const parsedSections = (sections || []).map(s => {
                    let dataSnapshot = {};
                    try {
                        dataSnapshot = s.data_snapshot ? JSON.parse(s.data_snapshot) : {};
                    } catch (e) {}
                    return {
                        ...s,
                        dataSnapshot,
                        isAiGenerated: s.is_ai_generated === 1
                    };
                });

                res.json({
                    id: report.id,
                    name: report.title,
                    status: report.report_status,
                    assessmentId: report.project_id,
                    assessmentName: report.project_name || 'DRD Assessment',
                    projectName: report.project_name,
                    organizationName: report.organization_name,
                    axisData,
                    content,
                    sections: parsedSections,
                    progress: report.avg_actual ? Math.round((report.avg_actual / 7) * 100) : 0,
                    isComplete: report.report_status === 'FINAL',
                    templateId: report.template_id,
                    createdAt: report.generated_at,
                    updatedAt: report.generated_at,
                    createdBy: report.created_by
                });
            });
        });
    } catch (error) {
        console.error('[Report Builder API] Get full report error:', error);
        res.status(500).json({ error: 'Failed to get report' });
    }
});

/**
 * POST /api/assessment-reports/:id/generate
 * Generate full report with all sections based on template
 */
router.post('/:id/generate', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { templateId, language = 'pl' } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        // Get report and assessment data
        const reportSql = `
            SELECT 
                r.*,
                a.name as assessment_name,
                a.axis_data,
                p.name as project_name,
                o.name as organization_name,
                o.transformation_context
            FROM assessment_reports r
            LEFT JOIN assessments a ON r.assessment_id = a.id
            LEFT JOIN projects p ON r.project_id = p.id
            LEFT JOIN organizations o ON r.organization_id = o.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(reportSql, [id, organizationId], async (err, report) => {
            if (err || !report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Get template (use default if not specified)
            const effectiveTemplateId = templateId || 'default-drd-report';
            
            db.get('SELECT * FROM report_templates WHERE id = ?', [effectiveTemplateId], async (err, template) => {
                let sectionConfig;
                try {
                    sectionConfig = template ? JSON.parse(template.section_config) : getDefaultSectionConfig();
                } catch (e) {
                    sectionConfig = getDefaultSectionConfig();
                }

                // Parse assessment data
                let axisData = {};
                let transformationContext = {};
                try {
                    axisData = report.axis_data ? JSON.parse(report.axis_data) : {};
                    transformationContext = report.transformation_context ? JSON.parse(report.transformation_context) : {};
                } catch (e) {}

                // Delete existing sections
                db.run('DELETE FROM report_sections WHERE report_id = ?', [id], async (err) => {
                    if (err) {
                        console.error('[Report Builder API] Delete sections error:', err);
                    }

                    // Generate sections based on template
                    const now = new Date().toISOString();
                    const insertPromises = sectionConfig.map((config, index) => {
                        return new Promise((resolve, reject) => {
                            const sectionId = uuidv4();
                            const title = config.title || SECTION_TYPES[config.type]?.title || 'Section';
                            
                            // Create data snapshot for this section
                            const dataSnapshot = createSectionDataSnapshot(
                                config.type,
                                config.axisId,
                                axisData,
                                transformationContext
                            );

                            // Generate initial content
                            const content = generateInitialSectionContent(
                                config.type,
                                config.axisId,
                                {
                                    organizationName: report.organization_name,
                                    projectName: report.project_name,
                                    assessmentName: report.assessment_name,
                                    axisData,
                                    transformationContext
                                },
                                language
                            );

                            const sql = `
                                INSERT INTO report_sections 
                                (id, report_id, section_type, axis_id, title, content, data_snapshot, order_index, is_ai_generated, last_edited_by, created_at, updated_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
                            `;

                            db.run(sql, [
                                sectionId,
                                id,
                                config.type,
                                config.axisId || null,
                                title,
                                content,
                                JSON.stringify(dataSnapshot),
                                index,
                                userId,
                                now,
                                now
                            ], (err) => {
                                if (err) reject(err);
                                else resolve({ id: sectionId, type: config.type, title });
                            });
                        });
                    });

                    try {
                        const generatedSections = await Promise.all(insertPromises);

                        // Update report with template reference
                        db.run(
                            'UPDATE assessment_reports SET template_id = ?, updated_at = ? WHERE id = ?',
                            [effectiveTemplateId, now, id]
                        );

                        res.json({
                            success: true,
                            reportId: id,
                            templateId: effectiveTemplateId,
                            sectionsGenerated: generatedSections.length,
                            sections: generatedSections
                        });
                    } catch (error) {
                        console.error('[Report Builder API] Generate sections error:', error);
                        res.status(500).json({ error: 'Failed to generate report sections' });
                    }
                });
            });
        });
    } catch (error) {
        console.error('[Report Builder API] Generate report error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

/**
 * POST /api/assessment-reports/:id/generate-comprehensive
 * Generate a comprehensive AI-powered report with web research
 */
router.post('/:id/generate-comprehensive', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { language = 'pl', includeResearch = true, stakeholderRole = 'CEO' } = req.body;
        const organizationId = req.user.organizationId;

        // Verify report belongs to organization
        const reportSql = `
            SELECT r.*, a.id as assessment_id
            FROM assessment_reports r
            LEFT JOIN assessments a ON r.assessment_id = a.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(reportSql, [id, organizationId], async (err, report) => {
            if (err || !report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            if (!report.assessment_id) {
                return res.status(400).json({ error: 'No assessment linked to this report' });
            }

            try {
                // Import comprehensive report generator
                const { comprehensiveReportGenerator   } = await import('../ai/comprehensiveReportGenerator.js');
                
                // Generate comprehensive report
                const result = await comprehensiveReportGenerator.generateReport(
                    report.assessment_id,
                    { language, includeResearch, stakeholderRole }
                );

                if (!result.success) {
                    return res.status(500).json({ 
                        error: 'Report generation failed', 
                        details: result.error 
                    });
                }

                // Store generated sections in database
                const now = new Date().toISOString();
                const userId = req.user.id;

                // Delete existing sections
                await new Promise((resolve, reject) => {
                    db.run('DELETE FROM report_sections WHERE report_id = ?', [id], (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Insert new sections
                let orderIndex = 0;
                for (const section of result.sections) {
                    const sectionId = uuidv4();
                    const sectionType = section.type || 'custom';
                    const title = section.axisName || getSectionTitle(sectionType);
                    const content = typeof section.content === 'object' 
                        ? JSON.stringify(section.content, null, 2)
                        : section.content || '';

                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT INTO report_sections 
                             (id, report_id, section_type, axis_id, title, content, data_snapshot, order_index, is_ai_generated, ai_model_used, last_edited_by, created_at, updated_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'gemini-1.5-pro', ?, ?, ?)`,
                            [
                                sectionId,
                                id,
                                sectionType,
                                section.axisId || null,
                                title,
                                content,
                                JSON.stringify({ generatedAt: now, metadata: result.metadata }),
                                orderIndex++,
                                userId,
                                now,
                                now
                            ],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                }

                // Update report status
                db.run(
                    `UPDATE assessment_reports SET 
                     report_status = 'AI_GENERATED',
                     updated_at = ?,
                     ai_generated_at = ?
                     WHERE id = ?`,
                    [now, now, id]
                );

                res.json({
                    success: true,
                    reportId: id,
                    sectionsGenerated: result.sections.length,
                    metadata: result.metadata,
                    duration: result.duration,
                    message: `Comprehensive report generated with ${result.sections.length} sections`
                });

            } catch (genError) {
                console.error('[Assessment Reports API] Comprehensive generation error:', genError);
                res.status(500).json({ 
                    error: 'Failed to generate comprehensive report',
                    details: genError.message
                });
            }
        });
    } catch (error) {
        console.error('[Assessment Reports API] Comprehensive report error:', error);
        res.status(500).json({ error: 'Failed to generate comprehensive report' });
    }
});

function getSectionTitle(sectionType) {
    const titles = {
        coverPage: 'Strona Tytułowa',
        executiveSummary: 'Streszczenie Wykonawcze',
        methodology: 'Metodologia DRD',
        maturityOverview: 'Przegląd Dojrzałości',
        axisAnalysis: 'Analiza Osi',
        gapAnalysis: 'Analiza Luk',
        initiatives: 'Inicjatywy Transformacyjne',
        roadmap: 'Roadmapa Transformacji',
        riskRegister: 'Rejestr Ryzyk',
        appendix: 'Załączniki'
    };
    return titles[sectionType] || sectionType;
}

/**
 * GET /api/assessment-reports/:id/sections
 * Get all sections for a report
 */
router.get('/:id/sections', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Verify report belongs to organization
        db.get(
            'SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?',
            [id, organizationId],
            (err, report) => {
                if (err || !report) {
                    return res.status(404).json({ error: 'Report not found' });
                }

                const sql = `
                    SELECT * FROM report_sections 
                    WHERE report_id = ?
                    ORDER BY order_index ASC
                `;

                db.all(sql, [id], (err, sections) => {
                    if (err) {
                        console.error('[Report Builder API] Get sections error:', err);
                        return res.status(500).json({ error: 'Failed to get sections' });
                    }

                    const parsedSections = (sections || []).map(s => {
                        let dataSnapshot = {};
                        try {
                            dataSnapshot = s.data_snapshot ? JSON.parse(s.data_snapshot) : {};
                        } catch (e) {}
                        return {
                            id: s.id,
                            reportId: s.report_id,
                            sectionType: s.section_type,
                            axisId: s.axis_id,
                            areaId: s.area_id,
                            title: s.title,
                            content: s.content,
                            dataSnapshot,
                            orderIndex: s.order_index,
                            isAiGenerated: s.is_ai_generated === 1,
                            version: s.version,
                            updatedAt: s.updated_at
                        };
                    });

                    res.json({ sections: parsedSections });
                });
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Get sections error:', error);
        res.status(500).json({ error: 'Failed to get sections' });
    }
});

/**
 * POST /api/assessment-reports/:id/sections
 * Add a new section to the report
 */
router.post('/:id/sections', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionType, axisId, areaId, title, content, orderIndex } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!sectionType) {
            return res.status(400).json({ error: 'Section type is required' });
        }

        // Verify report belongs to organization and is editable
        db.get(
            'SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ?',
            [id, organizationId],
            (err, report) => {
                if (err || !report) {
                    return res.status(404).json({ error: 'Report not found' });
                }

                if (report.report_status === 'FINAL') {
                    return res.status(400).json({ error: 'Cannot modify finalized report' });
                }

                const sectionId = uuidv4();
                const now = new Date().toISOString();
                const sectionTitle = title || SECTION_TYPES[sectionType]?.title || 'New Section';

                // If no order index specified, add to end
                const effectiveOrderIndex = orderIndex !== undefined ? orderIndex : 999;

                const sql = `
                    INSERT INTO report_sections 
                    (id, report_id, section_type, axis_id, area_id, title, content, order_index, is_ai_generated, last_edited_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
                `;

                db.run(sql, [
                    sectionId,
                    id,
                    sectionType,
                    axisId || null,
                    areaId || null,
                    sectionTitle,
                    content || '',
                    effectiveOrderIndex,
                    userId,
                    now,
                    now
                ], function(err) {
                    if (err) {
                        console.error('[Report Builder API] Add section error:', err);
                        return res.status(500).json({ error: 'Failed to add section' });
                    }

                    res.status(201).json({
                        id: sectionId,
                        reportId: id,
                        sectionType,
                        axisId,
                        areaId,
                        title: sectionTitle,
                        content: content || '',
                        orderIndex: effectiveOrderIndex,
                        createdAt: now
                    });
                });
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Add section error:', error);
        res.status(500).json({ error: 'Failed to add section' });
    }
});

/**
 * PUT /api/assessment-reports/:id/sections/:sectionId
 * Update a section's content
 */
router.put('/:id/sections/:sectionId', verifyToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { title, content, saveHistory = true } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        // Verify report belongs to organization
        db.get(
            'SELECT r.*, s.content as old_content, s.version as current_version, s.data_snapshot FROM assessment_reports r JOIN report_sections s ON s.report_id = r.id WHERE r.id = ? AND r.organization_id = ? AND s.id = ?',
            [id, organizationId, sectionId],
            (err, result) => {
                if (err || !result) {
                    return res.status(404).json({ error: 'Section not found' });
                }

                if (result.report_status === 'FINAL') {
                    return res.status(400).json({ error: 'Cannot modify finalized report' });
                }

                const now = new Date().toISOString();
                const newVersion = (result.current_version || 1) + 1;

                // Save to history if requested
                if (saveHistory && result.old_content) {
                    const historyId = uuidv4();
                    db.run(
                        `INSERT INTO report_section_history (id, section_id, version, content, data_snapshot, edited_by, edit_source, created_at)
                         VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)`,
                        [historyId, sectionId, result.current_version, result.old_content, result.data_snapshot, userId, now]
                    );
                }

                // Update section
                const sql = `
                    UPDATE report_sections 
                    SET title = COALESCE(?, title),
                        content = ?,
                        version = ?,
                        is_ai_generated = 0,
                        last_edited_by = ?,
                        updated_at = ?
                    WHERE id = ?
                `;

                db.run(sql, [title, content, newVersion, userId, now, sectionId], function(err) {
                    if (err) {
                        console.error('[Report Builder API] Update section error:', err);
                        return res.status(500).json({ error: 'Failed to update section' });
                    }

                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Section not found' });
                    }

                    // Update report timestamp
                    db.run('UPDATE assessment_reports SET updated_at = ? WHERE id = ?', [now, id]);

                    res.json({
                        success: true,
                        sectionId,
                        version: newVersion,
                        updatedAt: now
                    });
                });
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Update section error:', error);
        res.status(500).json({ error: 'Failed to update section' });
    }
});

/**
 * DELETE /api/assessment-reports/:id/sections/:sectionId
 * Delete a section from the report
 */
router.delete('/:id/sections/:sectionId', verifyToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const organizationId = req.user.organizationId;

        // Verify report belongs to organization and is editable
        db.get(
            'SELECT report_status FROM assessment_reports WHERE id = ? AND organization_id = ?',
            [id, organizationId],
            (err, report) => {
                if (err || !report) {
                    return res.status(404).json({ error: 'Report not found' });
                }

                if (report.report_status === 'FINAL') {
                    return res.status(400).json({ error: 'Cannot modify finalized report' });
                }

                db.run(
                    'DELETE FROM report_sections WHERE id = ? AND report_id = ?',
                    [sectionId, id],
                    function(err) {
                        if (err) {
                            console.error('[Report Builder API] Delete section error:', err);
                            return res.status(500).json({ error: 'Failed to delete section' });
                        }

                        if (this.changes === 0) {
                            return res.status(404).json({ error: 'Section not found' });
                        }

                        // Update report timestamp
                        db.run('UPDATE assessment_reports SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);

                        res.json({ success: true, deleted: sectionId });
                    }
                );
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Delete section error:', error);
        res.status(500).json({ error: 'Failed to delete section' });
    }
});

/**
 * POST /api/assessment-reports/:id/sections/:sectionId/ai
 * AI action on a specific section (expand, summarize, improve, translate)
 */
router.post('/:id/sections/:sectionId/ai', verifyToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const { action, language = 'pl', customPrompt } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        const validActions = ['expand', 'summarize', 'improve', 'translate', 'regenerate'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ error: `Invalid action. Valid: ${validActions.join(', ')}` });
        }

        // Get section with report context
        const sql = `
            SELECT s.*, r.report_status, r.assessment_snapshot, o.name as organization_name
            FROM report_sections s
            JOIN assessment_reports r ON s.report_id = r.id
            LEFT JOIN organizations o ON r.organization_id = o.id
            WHERE s.id = ? AND r.id = ? AND r.organization_id = ?
        `;

        db.get(sql, [sectionId, id, organizationId], async (err, section) => {
            if (err || !section) {
                return res.status(404).json({ error: 'Section not found' });
            }

            if (section.report_status === 'FINAL') {
                return res.status(400).json({ error: 'Cannot modify finalized report' });
            }

            // Parse context - assessment_snapshot contains axis scores
            let axisData = {};
            let dataSnapshot = {};
            let assessmentSnapshot = {};
            try {
                assessmentSnapshot = section.assessment_snapshot ? JSON.parse(section.assessment_snapshot) : {};
                axisData = assessmentSnapshot.axisScores || {};
                dataSnapshot = section.data_snapshot ? JSON.parse(section.data_snapshot) : {};
            } catch (e) {}

            // Generate AI content based on action
            const aiContent = await generateAISectionContent(
                action,
                section.content,
                {
                    sectionType: section.section_type,
                    axisId: section.axis_id,
                    title: section.title,
                    axisData,
                    dataSnapshot,
                    organizationName: section.organization_name,
                    language,
                    customPrompt
                }
            );

            const now = new Date().toISOString();
            const newVersion = (section.version || 1) + 1;

            // Save current version to history
            const historyId = uuidv4();
            db.run(
                `INSERT INTO report_section_history (id, section_id, version, content, data_snapshot, edited_by, edit_source, ai_prompt, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'ai_action', ?, ?)`,
                [historyId, sectionId, section.version, section.content, section.data_snapshot, userId, `${action}${customPrompt ? ': ' + customPrompt : ''}`, now]
            );

            // Update section with AI content
            db.run(
                `UPDATE report_sections SET content = ?, version = ?, is_ai_generated = 1, ai_model_used = ?, last_edited_by = ?, updated_at = ? WHERE id = ?`,
                [aiContent, newVersion, 'gemini-1.5-flash', userId, now, sectionId],
                function(err) {
                    if (err) {
                        console.error('[Report Builder API] AI section update error:', err);
                        return res.status(500).json({ error: 'Failed to update section' });
                    }

                    res.json({
                        success: true,
                        sectionId,
                        action,
                        content: aiContent,
                        version: newVersion,
                        updatedAt: now
                    });
                }
            );
        });
    } catch (error) {
        console.error('[Report Builder API] AI section action error:', error);
        res.status(500).json({ error: 'Failed to perform AI action' });
    }
});

/**
 * PUT /api/assessment-reports/:id/sections/reorder
 * Reorder sections by updating their order_index
 */
router.put('/:id/sections/reorder', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionOrder } = req.body; // Array of { id, orderIndex }
        const organizationId = req.user.organizationId;

        if (!Array.isArray(sectionOrder)) {
            return res.status(400).json({ error: 'sectionOrder must be an array' });
        }

        // Verify report belongs to organization
        db.get(
            'SELECT report_status FROM assessment_reports WHERE id = ? AND organization_id = ?',
            [id, organizationId],
            (err, report) => {
                if (err || !report) {
                    return res.status(404).json({ error: 'Report not found' });
                }

                if (report.report_status === 'FINAL') {
                    return res.status(400).json({ error: 'Cannot modify finalized report' });
                }

                const now = new Date().toISOString();
                const updatePromises = sectionOrder.map(({ id: sectionId, orderIndex }) => {
                    return new Promise((resolve, reject) => {
                        db.run(
                            'UPDATE report_sections SET order_index = ?, updated_at = ? WHERE id = ? AND report_id = ?',
                            [orderIndex, now, sectionId, id],
                            function(err) {
                                if (err) reject(err);
                                else resolve(this.changes);
                            }
                        );
                    });
                });

                Promise.all(updatePromises)
                    .then(() => {
                        db.run('UPDATE assessment_reports SET updated_at = ? WHERE id = ?', [now, id]);
                        res.json({ success: true, updatedAt: now });
                    })
                    .catch(err => {
                        console.error('[Report Builder API] Reorder error:', err);
                        res.status(500).json({ error: 'Failed to reorder sections' });
                    });
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Reorder sections error:', error);
        res.status(500).json({ error: 'Failed to reorder sections' });
    }
});

/**
 * POST /api/assessment-reports/:id/ai-edit
 * AI edit via chat - process natural language edit requests
 */
router.post('/:id/ai-edit', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { message, focusSectionId } = req.body;
        const organizationId = req.user.organizationId;
        const userId = req.user.id;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Get full report context
        const reportSql = `
            SELECT r.*, o.name as organization_name, o.transformation_context
            FROM assessment_reports r
            LEFT JOIN organizations o ON r.organization_id = o.id
            WHERE r.id = ? AND r.organization_id = ?
        `;

        db.get(reportSql, [id, organizationId], async (err, report) => {
            if (err || !report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            if (report.report_status === 'FINAL') {
                return res.status(400).json({ error: 'Cannot modify finalized report' });
            }

            // Get all sections
            db.all('SELECT * FROM report_sections WHERE report_id = ? ORDER BY order_index', [id], async (err, sections) => {
                if (err) sections = [];

                // Parse context - assessment_snapshot contains axis scores
                let axisData = {};
                let transformationContext = {};
                let assessmentSnapshot = {};
                try {
                    assessmentSnapshot = report.assessment_snapshot ? JSON.parse(report.assessment_snapshot) : {};
                    axisData = assessmentSnapshot.axisScores || {};
                    transformationContext = report.transformation_context ? JSON.parse(report.transformation_context) : {};
                } catch (e) {}

                // Process AI edit request
                const result = await processAIEditRequest(
                    message,
                    {
                        reportId: id,
                        reportName: report.title,
                        organizationName: report.organization_name,
                        sections: sections.map(s => ({
                            id: s.id,
                            type: s.section_type,
                            title: s.title,
                            content: s.content,
                            axisId: s.axis_id
                        })),
                        axisData,
                        transformationContext,
                        focusSectionId
                    },
                    userId
                );

                res.json(result);
            });
        });
    } catch (error) {
        console.error('[Report Builder API] AI edit error:', error);
        res.status(500).json({ error: 'Failed to process AI edit request' });
    }
});

/**
 * GET /api/assessment-reports/:id/sections/:sectionId/history
 * Get version history for a section
 */
router.get('/:id/sections/:sectionId/history', verifyToken, async (req, res) => {
    try {
        const { id, sectionId } = req.params;
        const organizationId = req.user.organizationId;

        // Verify access
        db.get(
            'SELECT 1 FROM assessment_reports r JOIN report_sections s ON s.report_id = r.id WHERE r.id = ? AND r.organization_id = ? AND s.id = ?',
            [id, organizationId, sectionId],
            (err, result) => {
                if (err || !result) {
                    return res.status(404).json({ error: 'Section not found' });
                }

                db.all(
                    `SELECT h.*, u.name as editor_name 
                     FROM report_section_history h 
                     LEFT JOIN users u ON h.edited_by = u.id
                     WHERE h.section_id = ? 
                     ORDER BY h.version DESC`,
                    [sectionId],
                    (err, history) => {
                        if (err) {
                            console.error('[Report Builder API] Get history error:', err);
                            return res.status(500).json({ error: 'Failed to get history' });
                        }

                        res.json({ history: history || [] });
                    }
                );
            }
        );
    } catch (error) {
        console.error('[Report Builder API] Get section history error:', error);
        res.status(500).json({ error: 'Failed to get section history' });
    }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDefaultSectionConfig() {
    return [
        { type: 'cover_page', title: 'Cover Page' },
        { type: 'executive_summary', title: 'Executive Summary' },
        { type: 'methodology', title: 'DRD Methodology' },
        { type: 'maturity_overview', title: 'Maturity Overview' },
        { type: 'axis_detail', axisId: 'processes', title: 'Axis 1: Digital Processes' },
        { type: 'axis_detail', axisId: 'digitalProducts', title: 'Axis 2: Digital Products' },
        { type: 'axis_detail', axisId: 'businessModels', title: 'Axis 3: Digital Business Models' },
        { type: 'axis_detail', axisId: 'dataManagement', title: 'Axis 4: Data Management' },
        { type: 'axis_detail', axisId: 'culture', title: 'Axis 5: Culture of Transformation' },
        { type: 'axis_detail', axisId: 'cybersecurity', title: 'Axis 6: Cybersecurity' },
        { type: 'axis_detail', axisId: 'aiMaturity', title: 'Axis 7: AI Maturity' },
        { type: 'gap_analysis', title: 'Gap Analysis' },
        { type: 'initiatives', title: 'Recommended Initiatives' },
        { type: 'roadmap', title: 'Transformation Roadmap' },
        { type: 'appendix', title: 'Appendix' }
    ];
}

function createSectionDataSnapshot(sectionType, axisId, axisData, transformationContext) {
    const snapshot = {
        generatedAt: new Date().toISOString()
    };

    if (sectionType === 'maturity_overview' || sectionType === 'gap_analysis') {
        snapshot.axes = Object.entries(axisData).map(([id, data]) => ({
            id,
            name: DRD_AXES[id]?.name || id,
            actual: data?.actual || 0,
            target: data?.target || 0,
            gap: (data?.target || 0) - (data?.actual || 0)
        }));
    }

    if (sectionType === 'axis_detail' && axisId) {
        const axis = axisData[axisId];
        snapshot.axis = {
            id: axisId,
            name: DRD_AXES[axisId]?.name || axisId,
            actual: axis?.actual || 0,
            target: axis?.target || 0,
            gap: (axis?.target || 0) - (axis?.actual || 0),
            justification: axis?.justification || '',
            areaScores: axis?.areaScores || {}
        };
    }

    if (sectionType === 'executive_summary') {
        let totalActual = 0, totalTarget = 0, count = 0;
        Object.values(axisData).forEach(data => {
            if (data?.actual) {
                totalActual += data.actual;
                totalTarget += data.target || 0;
                count++;
            }
        });
        snapshot.overallMetrics = {
            averageActual: count > 0 ? (totalActual / count).toFixed(1) : 0,
            averageTarget: count > 0 ? (totalTarget / count).toFixed(1) : 0,
            averageGap: count > 0 ? ((totalTarget - totalActual) / count).toFixed(1) : 0,
            axesAssessed: count
        };
        snapshot.context = transformationContext;
    }

    return snapshot;
}

function generateInitialSectionContent(sectionType, axisId, context, language) {
    const { organizationName, projectName, assessmentName, axisData, transformationContext } = context;
    const isPolish = language === 'pl';

    switch (sectionType) {
        case 'cover_page':
            return `# ${isPolish ? 'Raport z Audytu DRD' : 'DRD Audit Report'}

## ${organizationName || (isPolish ? 'Nazwa Organizacji' : 'Organization Name')}

**${isPolish ? 'Projekt' : 'Project'}:** ${projectName || assessmentName || '-'}

**${isPolish ? 'Data raportu' : 'Report Date'}:** ${new Date().toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')}

**${isPolish ? 'Status' : 'Status'}:** ${isPolish ? 'Wersja robocza' : 'Draft'}

---

*${isPolish ? 'Raport z diagnozy gotowości cyfrowej (Digital Readiness Diagnosis)' : 'Digital Readiness Diagnosis Report'}*`;

        case 'executive_summary':
            const metrics = calculateOverallMetrics(axisData);
            return `## ${isPolish ? 'Podsumowanie Wykonawcze' : 'Executive Summary'}

### ${isPolish ? 'Kontekst' : 'Context'}
${organizationName || (isPolish ? 'Organizacja' : 'Organization')} ${isPolish ? 'przeprowadziła diagnozę dojrzałości cyfrowej (DRD) obejmującą 7 osi transformacji.' : 'conducted a Digital Readiness Diagnosis (DRD) covering 7 transformation axes.'}

### ${isPolish ? 'Kluczowe wyniki' : 'Key Results'}
- **${isPolish ? 'Ogólny poziom dojrzałości' : 'Overall Maturity Level'}:** ${metrics.averageActual} / 7
- **${isPolish ? 'Poziom docelowy' : 'Target Level'}:** ${metrics.averageTarget} / 7
- **${isPolish ? 'Średnia luka' : 'Average Gap'}:** ${metrics.averageGap} ${isPolish ? 'poziomów' : 'levels'}

### ${isPolish ? 'Mocne strony' : 'Strengths'}
*${isPolish ? 'Do uzupełnienia na podstawie analizy...' : 'To be completed based on analysis...'}*

### ${isPolish ? 'Obszary priorytetowe' : 'Priority Areas'}
*${isPolish ? 'Do uzupełnienia na podstawie analizy...' : 'To be completed based on analysis...'}*

### ${isPolish ? 'Rekomendacja strategiczna' : 'Strategic Recommendation'}
*${isPolish ? 'Do uzupełnienia...' : 'To be completed...'}*`;

        case 'methodology':
            return `## ${isPolish ? 'Metodologia DRD' : 'DRD Methodology'}

### ${isPolish ? 'Czym jest DRD?' : 'What is DRD?'}
${isPolish 
    ? 'Digital Readiness Diagnosis (DRD) to kompleksowa metodologia oceny dojrzałości cyfrowej organizacji, opracowana na bazie wieloletniego doświadczenia w transformacji przedsiębiorstw produkcyjnych i usługowych.'
    : 'Digital Readiness Diagnosis (DRD) is a comprehensive methodology for assessing organizational digital maturity, developed based on years of experience in transforming manufacturing and service enterprises.'}

### ${isPolish ? '7 Osi Transformacji' : '7 Transformation Axes'}
1. **${isPolish ? 'Procesy Cyfrowe' : 'Digital Processes'}** - ${isPolish ? 'Digitalizacja procesów operacyjnych' : 'Digitization of operational processes'}
2. **${isPolish ? 'Produkty Cyfrowe' : 'Digital Products'}** - ${isPolish ? 'Produkty i usługi w formie elektronicznej' : 'Electronic products and services'}
3. **${isPolish ? 'Modele Biznesowe' : 'Business Models'}** - ${isPolish ? 'Cyfrowe modele generowania wartości' : 'Digital value generation models'}
4. **${isPolish ? 'Zarządzanie Danymi' : 'Data Management'}** - ${isPolish ? 'Big Data i analityka' : 'Big Data and analytics'}
5. **${isPolish ? 'Kultura Transformacji' : 'Culture of Transformation'}** - ${isPolish ? 'Gotowość organizacyjna' : 'Organizational readiness'}
6. **${isPolish ? 'Cyberbezpieczeństwo' : 'Cybersecurity'}** - ${isPolish ? 'Ochrona zasobów cyfrowych' : 'Digital asset protection'}
7. **${isPolish ? 'Dojrzałość AI' : 'AI Maturity'}** - ${isPolish ? 'Wykorzystanie sztucznej inteligencji' : 'Artificial intelligence utilization'}

### ${isPolish ? 'Skala Oceny' : 'Assessment Scale'}
${isPolish ? 'Każda oś oceniana jest w skali 1-7:' : 'Each axis is assessed on a 1-7 scale:'}
- **1** - ${isPolish ? 'Podstawowy' : 'Basic'}
- **2-3** - ${isPolish ? 'Rozwijający się' : 'Developing'}
- **4-5** - ${isPolish ? 'Zdefiniowany/Zarządzany' : 'Defined/Managed'}
- **6-7** - ${isPolish ? 'Zaawansowany/Światowej klasy' : 'Advanced/World-class'}`;

        case 'maturity_overview':
            return `## ${isPolish ? 'Przegląd Dojrzałości' : 'Maturity Overview'}

### ${isPolish ? 'Podsumowanie 7 Osi' : '7 Axes Summary'}

| ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Aktualny' : 'Current'} | ${isPolish ? 'Docelowy' : 'Target'} | ${isPolish ? 'Luka' : 'Gap'} |
|------|----------|---------|-----|
${Object.entries(DRD_AXES).map(([id, config]) => {
    const data = axisData[id] || {};
    return `| ${config.name} | ${data.actual || '-'} | ${data.target || '-'} | ${(data.target || 0) - (data.actual || 0)} |`;
}).join('\n')}

*${isPolish ? 'Wykres radarowy zostanie wygenerowany automatycznie w eksporcie PDF.' : 'Radar chart will be automatically generated in PDF export.'}*`;

        case 'axis_detail':
            const axisConfig = DRD_AXES[axisId];
            const axis = axisData[axisId] || {};
            return `## ${axisConfig?.name || axisId}

### ${isPolish ? 'Ocena Zbiorcza' : 'Summary Assessment'}
| ${isPolish ? 'Metryka' : 'Metric'} | ${isPolish ? 'Wartość' : 'Value'} |
|---------|---------|
| ${isPolish ? 'Poziom aktualny' : 'Current Level'} | ${axis.actual || '-'} |
| ${isPolish ? 'Poziom docelowy' : 'Target Level'} | ${axis.target || '-'} |
| ${isPolish ? 'Luka' : 'Gap'} | ${(axis.target || 0) - (axis.actual || 0)} |

### ${isPolish ? 'Uzasadnienie Oceny' : 'Assessment Justification'}
${axis.justification || (isPolish ? '*Brak uzasadnienia*' : '*No justification provided*')}

### ${isPolish ? 'Szczegóły Obszarów' : 'Area Details'}
*${isPolish ? 'Tabela obszarów zostanie wygenerowana automatycznie.' : 'Area table will be generated automatically.'}*

### ${isPolish ? 'Ścieżka Dojścia' : 'Pathway'}
*${isPolish ? 'Do uzupełnienia - kroki od poziomu aktualnego do docelowego.' : 'To be completed - steps from current to target level.'}*`;

        case 'gap_analysis':
            return `## ${isPolish ? 'Analiza Luk' : 'Gap Analysis'}

### ${isPolish ? 'Priorytety Transformacji' : 'Transformation Priorities'}

| ${isPolish ? 'Oś' : 'Axis'} | ${isPolish ? 'Luka' : 'Gap'} | ${isPolish ? 'Priorytet' : 'Priority'} | ${isPolish ? 'Szacowany czas' : 'Est. Time'} |
|------|-----|----------|------------|
${Object.entries(DRD_AXES).map(([id, config]) => {
    const data = axisData[id] || {};
    const gap = (data.target || 0) - (data.actual || 0);
    const priority = gap >= 3 ? (isPolish ? 'WYSOKI' : 'HIGH') : gap >= 2 ? (isPolish ? 'ŚREDNI' : 'MEDIUM') : gap > 0 ? (isPolish ? 'NISKI' : 'LOW') : '-';
    return `| ${config.name} | ${gap} | ${priority} | ${gap > 0 ? `${gap * 3}-${gap * 4} ${isPolish ? 'mies.' : 'mo.'}` : '-'} |`;
}).join('\n')}

### ${isPolish ? 'Analiza Priorytetów' : 'Priority Analysis'}
*${isPolish ? 'Do uzupełnienia...' : 'To be completed...'}*`;

        case 'initiatives':
            return `## ${isPolish ? 'Rekomendowane Inicjatywy' : 'Recommended Initiatives'}

### ${isPolish ? 'Inicjatywy Quick Win' : 'Quick Win Initiatives'}
*${isPolish ? 'Inicjatywy o niskim nakładzie i szybkim efekcie...' : 'Low effort, quick impact initiatives...'}*

### ${isPolish ? 'Inicjatywy Strategiczne' : 'Strategic Initiatives'}
*${isPolish ? 'Inicjatywy wymagające większych nakładów...' : 'Initiatives requiring larger investments...'}*

### ${isPolish ? 'Matryca Priorytetyzacji' : 'Prioritization Matrix'}
*${isPolish ? 'Do uzupełnienia na podstawie analizy ROI.' : 'To be completed based on ROI analysis.'}*`;

        case 'roadmap':
            return `## ${isPolish ? 'Roadmapa Transformacji' : 'Transformation Roadmap'}

### ${isPolish ? 'Fazy Transformacji' : 'Transformation Phases'}

| ${isPolish ? 'Faza' : 'Phase'} | ${isPolish ? 'Okres' : 'Period'} | ${isPolish ? 'Fokus' : 'Focus'} |
|------|--------|-------|
| 1. ${isPolish ? 'Fundamenty' : 'Foundation'} | 0-6 ${isPolish ? 'mies.' : 'mo.'} | ${isPolish ? 'Dane, governance' : 'Data, governance'} |
| 2. Quick Wins | 3-9 ${isPolish ? 'mies.' : 'mo.'} | ${isPolish ? 'Procesy, automatyzacja' : 'Processes, automation'} |
| 3. ${isPolish ? 'Strategiczne' : 'Strategic'} | 6-18 ${isPolish ? 'mies.' : 'mo.'} | ${isPolish ? 'Produkty, modele' : 'Products, models'} |
| 4. AI | 12-24 ${isPolish ? 'mies.' : 'mo.'} | ${isPolish ? 'Integracja AI' : 'AI integration'} |

### ${isPolish ? 'Timeline' : 'Timeline'}
*${isPolish ? 'Diagram Gantta zostanie wygenerowany automatycznie.' : 'Gantt chart will be generated automatically.'}*`;

        case 'appendix':
            return `## ${isPolish ? 'Załączniki' : 'Appendix'}

### A. ${isPolish ? 'Pełne Macierze Ocen' : 'Full Assessment Matrices'}
*${isPolish ? 'Szczegółowe tabele dla każdej osi i obszaru.' : 'Detailed tables for each axis and area.'}*

### B. ${isPolish ? 'Lista Wywiadów' : 'Interview List'}
*${isPolish ? 'Osoby uczestniczące w audycie.' : 'Individuals participating in the audit.'}*

### C. ${isPolish ? 'Przeanalizowane Dokumenty' : 'Analyzed Documents'}
*${isPolish ? 'Lista dokumentów źródłowych.' : 'List of source documents.'}*

### D. ${isPolish ? 'Słownik Pojęć' : 'Glossary'}
*${isPolish ? 'Definicje kluczowych terminów DRD.' : 'Definitions of key DRD terms.'}*`;

        default:
            return `## ${isPolish ? 'Nowa Sekcja' : 'New Section'}

*${isPolish ? 'Treść do uzupełnienia...' : 'Content to be completed...'}*`;
    }
}

function calculateOverallMetrics(axisData) {
    let totalActual = 0, totalTarget = 0, count = 0;
    Object.values(axisData || {}).forEach(data => {
        if (data?.actual) {
            totalActual += data.actual;
            totalTarget += data.target || 0;
            count++;
        }
    });
    return {
        averageActual: count > 0 ? (totalActual / count).toFixed(1) : '0',
        averageTarget: count > 0 ? (totalTarget / count).toFixed(1) : '0',
        averageGap: count > 0 ? ((totalTarget - totalActual) / count).toFixed(1) : '0'
    };
}

async function generateAISectionContent(action, currentContent, context) {
    // Simplified AI content generation - in production, use actual AI service
    const { sectionType, title, language, customPrompt } = context;
    const isPolish = language === 'pl';

    switch (action) {
        case 'expand':
            return currentContent + `\n\n### ${isPolish ? 'Dodatkowe szczegóły' : 'Additional Details'}\n*${isPolish ? 'Rozszerzona treść wygenerowana przez AI...' : 'Expanded content generated by AI...'}*`;
        
        case 'summarize':
            return `## ${title}\n\n**${isPolish ? 'Podsumowanie' : 'Summary'}:**\n${isPolish ? 'Skrócona wersja treści...' : 'Condensed version of content...'}`;
        
        case 'improve':
            return `${currentContent}\n\n---\n*${isPolish ? 'Treść została ulepszona przez AI.' : 'Content has been improved by AI.'}*`;
        
        case 'translate':
            return `## ${title}\n\n*${isPolish ? 'Treść przetłumaczona...' : 'Translated content...'}*\n\n${currentContent}`;
        
        case 'regenerate':
            return generateInitialSectionContent(sectionType, context.axisId, context, language);
        
        default:
            return currentContent;
    }
}

async function processAIEditRequest(message, context, userId) {
    // Parse user intent and identify target section
    const { sections, focusSectionId } = context;
    
    // Simple intent detection (in production, use actual NLP/AI)
    const lowerMessage = message.toLowerCase();
    let targetSection = focusSectionId ? sections.find(s => s.id === focusSectionId) : null;
    let action = 'improve';
    
    if (lowerMessage.includes('rozwiń') || lowerMessage.includes('expand')) {
        action = 'expand';
    } else if (lowerMessage.includes('skróć') || lowerMessage.includes('summar')) {
        action = 'summarize';
    } else if (lowerMessage.includes('tłumacz') || lowerMessage.includes('translat')) {
        action = 'translate';
    } else if (lowerMessage.includes('regeneruj') || lowerMessage.includes('regenerate')) {
        action = 'regenerate';
    }

    // Try to identify target section from message if not focused
    if (!targetSection) {
        for (const section of sections) {
            if (lowerMessage.includes(section.title.toLowerCase()) || 
                lowerMessage.includes(section.type.replace('_', ' '))) {
                targetSection = section;
                break;
            }
        }
    }

    return {
        success: true,
        interpretation: {
            action,
            targetSection: targetSection?.id || null,
            targetSectionTitle: targetSection?.title || null
        },
        message: targetSection 
            ? `Rozpoznano intencję: ${action} dla sekcji "${targetSection.title}". Użyj endpointu /sections/${targetSection.id}/ai z akcją "${action}" aby zastosować zmianę.`
            : 'Nie udało się zidentyfikować sekcji do edycji. Proszę sprecyzować, którą sekcję chcesz zmodyfikować.',
        suggestedEndpoint: targetSection ? `/api/assessment-reports/${context.reportId}/sections/${targetSection.id}/ai` : null,
        suggestedPayload: targetSection ? { action, customPrompt: message } : null
    };
}

// ============================================================================
// ENTERPRISE AI CONSULTING ENDPOINTS
// ============================================================================

// Lazy-load enterprise services
let ReportPipeline = null;
let IndustryIntelligenceService = null;
let StrategicRecommendationService = null;

function getEnterpriseServices() {
    if (!ReportPipeline) {
        try {
            ReportPipeline = import('../services/ai/pipeline/reportPipeline.js');
            IndustryIntelligenceService = import('../services/ai/intelligence/industryIntelligenceService.js');
            StrategicRecommendationService = import('../services/ai/frameworks/strategicRecommendationService.js');
        } catch (e) {
            console.warn('[Enterprise] Services not available:', e.message);
        }
    }
    return { ReportPipeline, IndustryIntelligenceService, StrategicRecommendationService };
}

/**
 * POST /api/assessment-reports/:id/generate-enterprise
 * Generate enterprise-grade report using multi-agent pipeline
 */
router.post('/:id/generate-enterprise', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;
        const { options = {} } = req.body;

        // Get report and assessment data
        const report = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ?',
                [id, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Get assessment data
        const assessment = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM maturity_assessments WHERE id = ?',
                [report.assessment_id],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!assessment) {
            return res.status(404).json({ error: 'Assessment not found' });
        }

        // Parse assessment scores
        let scores = {};
        let gaps = [];
        try {
            scores = JSON.parse(assessment.scores_json || '{}');
            gaps = JSON.parse(assessment.gaps_json || '[]');
        } catch (e) {
            console.warn('[Enterprise] Parse error:', e.message);
        }

        // Get organization profile
        const orgProfile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        // Parse organization profile JSON fields
        let parsedProfile = orgProfile;
        if (orgProfile) {
            try {
                const jsonFields = ['strategic_priorities', 'technology_stack', 'primary_markets', 'customer_segments', 'key_competitors', 'regulatory_environment'];
                parsedProfile = { ...orgProfile };
                jsonFields.forEach(field => {
                    if (parsedProfile[field]) {
                        parsedProfile[field] = typeof parsedProfile[field] === 'string' 
                            ? JSON.parse(parsedProfile[field]) 
                            : parsedProfile[field];
                    }
                });
            } catch (e) {
                console.warn('[Enterprise] Profile parse error:', e.message);
            }
        }

        // Get enterprise services
        const { ReportPipeline: Pipeline } = getEnterpriseServices();
        if (!Pipeline) {
            return res.status(503).json({ error: 'Enterprise report generation not available' });
        }

        // Start generation (streaming would be better but keeping simple for now)
        const assessmentData = {
            id: assessment.id,
            report_id: id,
            organization_id: organizationId,
            overall_score: assessment.overall_score,
            scores,
            gaps,
            type: assessment.type || 'MATURITY'
        };

        // Run pipeline
        const generator = Pipeline.generateReport(assessmentData, parsedProfile, options);
        let lastResult = null;
        
        for await (const progress of generator) {
            lastResult = progress;
            // Could emit via WebSocket here for real-time updates
            console.log(`[Enterprise] Progress: ${progress.phase} - ${progress.progress}%`);
        }

        // Return final result
        if (lastResult && lastResult.phase === 'COMPLETED') {
            return res.json({
                success: true,
                generationId: lastResult.generationId || uuidv4(),
                report: lastResult.report,
                metadata: lastResult.pipelineMetadata
            });
        } else {
            return res.status(500).json({ 
                error: 'Generation incomplete',
                lastPhase: lastResult?.phase 
            });
        }

    } catch (error) {
        console.error('[Enterprise Report] Generation error:', error);
        res.status(500).json({ error: 'Enterprise report generation failed', details: error.message });
    }
});

/**
 * GET /api/assessment-reports/:id/generation-status
 * Get status of enterprise report generation
 */
router.get('/:id/generation-status', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { generationId } = req.query;
        const organizationId = req.user.organizationId;

        // Query for generation status
        const generation = await new Promise((resolve, reject) => {
            const sql = generationId
                ? 'SELECT * FROM enterprise_report_generations WHERE id = ? AND organization_id = ?'
                : 'SELECT * FROM enterprise_report_generations WHERE report_id = ? AND organization_id = ? ORDER BY started_at DESC LIMIT 1';
            
            db.get(sql, [generationId || id, organizationId], (err, row) => {
                err ? reject(err) : resolve(row);
            });
        });

        if (!generation) {
            return res.status(404).json({ error: 'Generation not found' });
        }

        res.json({
            generationId: generation.id,
            reportId: generation.report_id,
            status: generation.pipeline_status,
            progress: generation.progress_percent,
            currentAgent: generation.current_agent,
            startedAt: generation.started_at,
            completedAt: generation.completed_at,
            duration: generation.duration_ms,
            confidence: generation.overall_confidence,
            error: generation.error_message
        });

    } catch (error) {
        console.error('[Enterprise Report] Status error:', error);
        res.status(500).json({ error: 'Failed to get generation status' });
    }
});

/**
 * POST /api/assessment-reports/:reportId/generate-initiatives
 * Generate initiatives from enterprise report
 */
router.post('/:reportId/generate-initiatives', verifyToken, async (req, res) => {
    try {
        const { reportId } = req.params;
        const userId = req.user.id;
        const organizationId = req.user.organizationId;
        const { maxInitiatives = 5, priorityThreshold = 'MEDIUM' } = req.body;

        // Get report
        const report = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ?',
                [reportId, organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // Get latest enterprise generation for this report
        const generation = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM enterprise_report_generations 
                 WHERE report_id = ? AND pipeline_status = 'COMPLETED'
                 ORDER BY completed_at DESC LIMIT 1`,
                [reportId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        if (!generation) {
            return res.status(400).json({ 
                error: 'No completed enterprise report found. Generate enterprise report first.' 
            });
        }

        // Parse strategist output for recommendations
        let recommendations = [];
        try {
            const strategistOutput = JSON.parse(generation.strategist_output || '{}');
            recommendations = strategistOutput.recommendations || [];
        } catch (e) {
            console.warn('[Enterprise] Parse strategist output error:', e.message);
        }

        if (recommendations.length === 0) {
            return res.json({
                success: true,
                initiativesCreated: 0,
                message: 'No recommendations found in enterprise report'
            });
        }

        // Filter by priority threshold
        const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        const thresholdScore = priorityOrder[priorityThreshold] || 2;
        
        const filteredRecs = recommendations
            .filter(r => (priorityOrder[r.impact] || 2) >= thresholdScore)
            .slice(0, maxInitiatives);

        // Create initiatives
        const createdInitiatives = [];
        for (const rec of filteredRecs) {
            const initiativeId = uuidv4();
            const now = new Date().toISOString();

            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO initiatives 
                    (id, organization_id, project_id, name, description, status, priority,
                     estimated_budget, strategic_intent, source_report_id, ai_generated,
                     created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, 1, ?, ?, ?)
                `, [
                    initiativeId,
                    organizationId,
                    report.project_id,
                    rec.title,
                    rec.description || rec.rationale,
                    rec.impact === 'HIGH' ? 1 : rec.impact === 'MEDIUM' ? 2 : 3,
                    rec.estimatedBudget || null,
                    rec.investmentThesis || null,
                    reportId,
                    userId,
                    now, now
                ], (err) => err ? reject(err) : resolve());
            });

            createdInitiatives.push({
                id: initiativeId,
                name: rec.title,
                impact: rec.impact,
                budget: rec.estimatedBudget
            });
        }

        res.json({
            success: true,
            initiativesCreated: createdInitiatives.length,
            initiatives: createdInitiatives,
            sourceReportId: reportId,
            sourceGenerationId: generation.id
        });

    } catch (error) {
        console.error('[Enterprise Report] Generate initiatives error:', error);
        res.status(500).json({ error: 'Failed to generate initiatives' });
    }
});

/**
 * GET /api/assessment-reports/:id/industry-context
 * Get industry intelligence for a report
 */
router.get('/:id/industry-context', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        // Get organization profile
        const orgProfile = await new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM organization_profiles WHERE organization_id = ?',
                [organizationId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        const industry = orgProfile?.industry || req.query.industry || 'Technology';
        const subSector = orgProfile?.industry_subsector || req.query.subSector || null;

        const { IndustryIntelligenceService: IntelService } = getEnterpriseServices();
        if (!IntelService) {
            return res.status(503).json({ error: 'Industry intelligence service not available' });
        }

        const context = await IntelService.getIndustryContext(industry, subSector);

        res.json({
            reportId: id,
            industryContext: context,
            organizationProfile: orgProfile ? {
                industry: orgProfile.industry,
                subSector: orgProfile.industry_subsector,
                competitivePosition: orgProfile.competitive_position,
                companySize: orgProfile.company_size
            } : null
        });

    } catch (error) {
        console.error('[Enterprise Report] Industry context error:', error);
        res.status(500).json({ error: 'Failed to get industry context' });
    }
});

export default router;
