const express = require('express');
const router = express.Router();
const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const verifyToken = require('../middleware/authMiddleware');

router.use(verifyToken);

// GET SESSION
router.get('/:userId', (req, res) => {
    // SECURITY: Use ID from token, but allow admin/system override if needed in future.
    // For now, strictly enforce that users can only get THEIR OWN session unless they are admin (logic omitted for brevity, assuming self-access).
    const requestedUserId = req.params.userId;
    const tokenUserId = req.user.id;

    if (requestedUserId !== tokenUserId) {
        console.warn(`[Sessions] Unauthorized access atttempt. TokenUser: ${tokenUserId}, Requested: ${requestedUserId}`);
        return res.status(403).json({ error: 'Unauthorized access to this session.' });
    }

    const { type, projectId } = req.query; // 'FREE' or 'FULL', optional projectId

    console.log(`[Sessions] GET request for user: ${tokenUserId}, type: ${type}, project: ${projectId || 'NULL'}`);

    let sql = 'SELECT data FROM sessions WHERE user_id = ? AND type = ?';
    let params = [tokenUserId, type];

    if (projectId) {
        sql += ' AND project_id = ?';
        params.push(projectId);
    } else {
        sql += ' AND project_id IS NULL';
    }

    db.get(sql, params, (err, row) => {
        if (err) {
            console.error('[Sessions] DB Error during GET:', err.message);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.log('[Sessions] No session found, returning null.');
            return res.json({ data: null });
        }

        try {
            const parsedData = JSON.parse(row.data);
            console.log(`[Sessions] Session found. Keys: ${Object.keys(parsedData).join(', ')}`);
            res.json({ data: parsedData });
        } catch (e) {
            console.error('[Sessions] JSON Parse Error:', e.message);
            res.json({ data: null });
        }
    });
});

// SAVE SESSION
router.post('/', (req, res) => {
    const { userId, type, data, projectId } = req.body;
    const tokenUserId = req.user.id;

    // Consistency Check
    if (userId && userId !== tokenUserId) {
        console.warn(`[Sessions] UserID mismatch on SAVE. Token: ${tokenUserId}, Body: ${userId}`);
        return res.status(403).json({ error: 'User ID mismatch.' });
    }

    const targetUserId = tokenUserId;
    console.log(`[Sessions] SAVE Request for user: ${targetUserId}, type: ${type}, project: ${projectId || 'NULL'}`);

    // Safety check for data
    if (!data) {
        console.error('[Sessions] Attempted to save empty/null data.');
        return res.status(400).json({ error: 'No data provided.' });
    }

    const dataStr = JSON.stringify(data);

    let checkSql = 'SELECT id FROM sessions WHERE user_id = ? AND type = ?';
    let checkParams = [targetUserId, type];

    if (projectId) {
        checkSql += ' AND project_id = ?';
        checkParams.push(projectId);
    } else {
        checkSql += ' AND project_id IS NULL';
    }

    // Check if exists
    db.get(checkSql, checkParams, (err, row) => {
        if (err) {
            console.error('[Sessions] DB Error during Check:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (row) {
            // Update
            console.log(`[Sessions] Updating existing session ${row.id}`);
            db.run('UPDATE sessions SET data = ?, updated_at = datetime("now") WHERE id = ?', [dataStr, row.id], (err) => {
                if (err) {
                    console.error('[Sessions] DB Update Error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, mode: 'updated' });
            });
        } else {
            // Insert
            const id = uuidv4();
            console.log(`[Sessions] Creating new session ${id}`);
            db.run('INSERT INTO sessions (id, user_id, project_id, type, data) VALUES (?, ?, ?, ?, ?)', [id, targetUserId, projectId || null, type, dataStr], (err) => {
                if (err) {
                    console.error('[Sessions] DB Insert Error:', err.message);
                    return res.status(500).json({ error: err.message });
                }
                res.json({ success: true, mode: 'created' });
            });
        }
    });
});

// ==========================================
// ASSESSMENT REPORTS API
// ==========================================

// GENERATE ASSESSMENT REPORT
router.post('/:projectId/reports', (req, res) => {
    const { projectId } = req.params;
    const userId = req.user.id;
    const orgId = req.user.organizationId;

    console.log(`[Reports] Generating report for project: ${projectId}`);

    // Get current assessment data from session
    const sql = 'SELECT data FROM sessions WHERE project_id = ? AND type = ?';
    db.get(sql, [projectId, 'FULL'], (err, row) => {
        if (err) {
            console.error('[Reports] Error fetching session:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: 'No assessment data found' });
        }

        try {
            const sessionData = JSON.parse(row.data);
            const assessment = sessionData.assessment || {};

            // Calculate metrics
            const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];
            let totalActual = 0;
            let totalTarget = 0;
            let count = 0;

            axes.forEach(axis => {
                if (assessment[axis]) {
                    totalActual += assessment[axis].actual || 0;
                    totalTarget += assessment[axis].target || 0;
                    count++;
                }
            });

            const avgActual = count > 0 ? totalActual / count : 0;
            const avgTarget = count > 0 ? totalTarget / count : 0;
            const gapPoints = Math.round((avgTarget - avgActual) * 10);

            // Create report
            const reportId = uuidv4();
            const title = `DRD Assessment - ${new Date().toLocaleDateString()}`;
            const snapshot = JSON.stringify(assessment);

            const insertSql = `INSERT INTO assessment_reports 
                (id, project_id, organization_id, title, assessment_snapshot, avg_actual, avg_target, gap_points, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            db.run(insertSql, [reportId, projectId, orgId, title, snapshot, avgActual, avgTarget, gapPoints, userId], (err) => {
                if (err) {
                    console.error('[Reports] Error creating report:', err.message);
                    return res.status(500).json({ error: err.message });
                }

                console.log(`[Reports] Report created: ${reportId}`);
                res.json({
                    id: reportId,
                    title,
                    generated_at: new Date().toISOString(),
                    avg_actual: avgActual,
                    avg_target: avgTarget,
                    gap_points: gapPoints
                });
            });
        } catch (e) {
            console.error('[Reports] JSON Parse Error:', e.message);
            return res.status(500).json({ error: 'Invalid session data' });
        }
    });
});

// LIST ASSESSMENT REPORTS
router.get('/:projectId/reports', (req, res) => {
    const { projectId } = req.params;
    const orgId = req.user.organizationId;

    console.log(`[Reports] Listing reports for project: ${projectId}`);

    const sql = `SELECT id, title, generated_at, avg_actual, avg_target, gap_points 
                 FROM assessment_reports 
                 WHERE project_id = ? AND organization_id = ? 
                 ORDER BY generated_at DESC`;

    db.all(sql, [projectId, orgId], (err, rows) => {
        if (err) {
            console.error('[Reports] Error listing reports:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ reports: rows || [] });
    });
});

// GET SINGLE ASSESSMENT REPORT
router.get('/reports/:reportId', (req, res) => {
    const { reportId } = req.params;
    const orgId = req.user.organizationId;

    console.log(`[Reports] Getting report: ${reportId}`);

    const sql = `SELECT * FROM assessment_reports 
                 WHERE id = ? AND organization_id = ?`;

    db.get(sql, [reportId, orgId], (err, row) => {
        if (err) {
            console.error('[Reports] Error getting report:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!row) {
            return res.status(404).json({ error: 'Report not found' });
        }

        try {
            row.assessment_snapshot = JSON.parse(row.assessment_snapshot);
        } catch (e) {
            console.error('[Reports] JSON Parse Error:', e.message);
        }

        res.json({ report: row });
    });
});

// EXPORT REPORT TO PDF
router.post('/reports/:reportId/export-pdf', async (req, res) => {
    const { reportId } = req.params;
    const orgId = req.user.organizationId;
    const { branding, includeCharts = true, includeSummary = true } = req.body;

    console.log(`[Reports] Exporting report to PDF: ${reportId}`);

    try {
        // Get report
        const reportSql = `SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ?`;
        db.get(reportSql, [reportId, orgId], async (err, report) => {
            if (err) {
                console.error('[Reports] Error fetching report:', err.message);
                return res.status(500).json({ error: err.message });
            }

            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            try {
                // Parse assessment snapshot
                report.assessment_snapshot = JSON.parse(report.assessment_snapshot);

                // Generate PDF
                const PdfGeneratorService = require('../services/pdfGeneratorService');
                const pdfUrl = await PdfGeneratorService.generateReportPDF(report, {
                    includeCharts,
                    includeSummary,
                    branding: branding || {}
                });

                // Update report with PDF URL
                const updateSql = `UPDATE assessment_reports SET pdf_url = ? WHERE id = ?`;
                db.run(updateSql, [pdfUrl, reportId], (err) => {
                    if (err) {
                        console.error('[Reports] Error updating PDF URL:', err.message);
                    }
                });

                res.json({ pdfUrl, message: 'PDF generated successfully' });
            } catch (error) {
                console.error('[Reports] PDF generation error:', error);
                res.status(500).json({ error: 'Failed to generate PDF' });
            }
        });
    } catch (error) {
        console.error('[Reports] Export PDF error:', error);
        res.status(500).json({ error: error.message });
    }
});

// EXPORT REPORT TO EXCEL
router.post('/reports/:reportId/export-excel', async (req, res) => {
    const { reportId } = req.params;
    const orgId = req.user.organizationId;
    const { includeCharts = false, includeRawData = true } = req.body;

    console.log(`[Reports] Exporting report to Excel: ${reportId}`);

    try {
        // Get report
        const reportSql = `SELECT * FROM assessment_reports WHERE id = ? AND organization_id = ?`;
        db.get(reportSql, [reportId, orgId], async (err, report) => {
            if (err) {
                console.error('[Reports] Error fetching report:', err.message);
                return res.status(500).json({ error: err.message });
            }

            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            try {
                // Parse assessment snapshot
                report.assessment_snapshot = JSON.parse(report.assessment_snapshot);

                // Generate Excel
                const ExcelExportService = require('../services/excelExportService');
                const excelUrl = await ExcelExportService.exportReportToExcel(report, {
                    includeCharts,
                    includeRawData
                });

                // Update report with Excel URL
                const updateSql = `UPDATE assessment_reports SET excel_url = ? WHERE id = ?`;
                db.run(updateSql, [excelUrl, reportId], (err) => {
                    if (err) {
                        console.error('[Reports] Error updating Excel URL:', err.message);
                    }
                });

                res.json({ excelUrl, message: 'Excel file generated successfully' });
            } catch (error) {
                console.error('[Reports] Excel generation error:', error);
                res.status(500).json({ error: 'Failed to generate Excel file' });
            }
        });
    } catch (error) {
        console.error('[Reports] Export Excel error:', error);
        res.status(500).json({ error: error.message });
    }
});

// COMPARE MULTIPLE REPORTS
router.post('/reports/compare', (req, res) => {
    const { reportIds, saveName } = req.body;
    const orgId = req.user.organizationId;
    const userId = req.user.id;

    if (!reportIds || reportIds.length < 2) {
        return res.status(400).json({ error: 'At least 2 reports required for comparison' });
    }

    console.log(`[Reports] Comparing ${reportIds.length} reports`);

    // Get all reports
    const placeholders = reportIds.map(() => '?').join(',');
    const sql = `SELECT * FROM assessment_reports 
                 WHERE id IN (${placeholders}) AND organization_id = ?
                 ORDER BY generated_at ASC`;

    db.all(sql, [...reportIds, orgId], (err, reports) => {
        if (err) {
            console.error('[Reports] Error fetching reports for comparison:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (reports.length !== reportIds.length) {
            return res.status(404).json({ error: 'One or more reports not found' });
        }

        try {
            // Parse assessment snapshots
            reports.forEach(r => {
                r.assessment_snapshot = JSON.parse(r.assessment_snapshot);
            });

            // Calculate comparison data
            const comparisonData = calculateComparisonData(reports);

            // Save comparison if name provided
            if (saveName) {
                const { v4: uuidv4 } = require('uuid');
                const comparisonId = uuidv4();
                const insertSql = `INSERT INTO report_comparisons 
                    (id, organization_id, project_id, name, report_ids, comparison_data, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`;

                db.run(insertSql, [
                    comparisonId,
                    orgId,
                    reports[0].project_id,
                    saveName,
                    JSON.stringify(reportIds),
                    JSON.stringify(comparisonData),
                    userId
                ], (err) => {
                    if (err) {
                        console.error('[Reports] Error saving comparison:', err.message);
                    }
                });
            }

            res.json({ reports, comparisonData });
        } catch (error) {
            console.error('[Reports] Comparison calculation error:', error);
            res.status(500).json({ error: 'Failed to calculate comparison' });
        }
    });
});

// ARCHIVE/UNARCHIVE REPORT
router.put('/reports/:reportId/archive', (req, res) => {
    const { reportId } = req.params;
    const { archive } = req.body; // true to archive, false to unarchive
    const orgId = req.user.organizationId;

    const sql = `UPDATE assessment_reports 
                 SET is_archived = ?, archived_at = ?
                 WHERE id = ? AND organization_id = ?`;

    const archivedAt = archive ? new Date().toISOString() : null;

    db.run(sql, [archive ? 1 : 0, archivedAt, reportId, orgId], function (err) {
        if (err) {
            console.error('[Reports] Error archiving report:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        res.json({ message: archive ? 'Report archived' : 'Report unarchived' });
    });
});

// ADD ANNOTATION TO REPORT
router.post('/reports/:reportId/annotations', (req, res) => {
    const { reportId } = req.params;
    const { annotationType, section, content, positionData } = req.body;
    const userId = req.user.id;
    const { v4: uuidv4 } = require('uuid');

    const annotationId = uuidv4();
    const sql = `INSERT INTO report_annotations 
                 (id, report_id, user_id, annotation_type, section, content, position_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
        annotationId,
        reportId,
        userId,
        annotationType || 'comment',
        section,
        content,
        positionData ? JSON.stringify(positionData) : null
    ], (err) => {
        if (err) {
            console.error('[Reports] Error adding annotation:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ id: annotationId, message: 'Annotation added' });
    });
});

// GET REPORT ANNOTATIONS
router.get('/reports/:reportId/annotations', (req, res) => {
    const { reportId } = req.params;

    const sql = `SELECT a.*, u.name as user_name, u.avatar_url 
                 FROM report_annotations a
                 LEFT JOIN users u ON a.user_id = u.id
                 WHERE a.report_id = ?
                 ORDER BY a.created_at DESC`;

    db.all(sql, [reportId], (err, annotations) => {
        if (err) {
            console.error('[Reports] Error fetching annotations:', err.message);
            return res.status(500).json({ error: err.message });
        }

        res.json({ annotations: annotations || [] });
    });
});

// CREATE SHARE LINK
router.post('/reports/:reportId/share', (req, res) => {
    const { reportId } = req.params;
    const { expiresIn, maxAccessCount } = req.body; // expiresIn in hours
    const userId = req.user.id;
    const orgId = req.user.organizationId;
    const { v4: uuidv4 } = require('uuid');

    // Verify report exists and belongs to org
    const verifySql = `SELECT id FROM assessment_reports WHERE id = ? AND organization_id = ?`;
    db.get(verifySql, [reportId, orgId], (err, report) => {
        if (err) {
            console.error('[Reports] Error verifying report:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const shareId = uuidv4();
        const shareToken = uuidv4().replace(/-/g, '');
        const expiresAt = expiresIn
            ? new Date(Date.now() + expiresIn * 60 * 60 * 1000).toISOString()
            : null;

        const sql = `INSERT INTO report_shares 
                     (id, report_id, share_token, created_by, expires_at, max_access_count)
                     VALUES (?, ?, ?, ?, ?, ?)`;

        db.run(sql, [shareId, reportId, shareToken, userId, expiresAt, maxAccessCount || null], (err) => {
            if (err) {
                console.error('[Reports] Error creating share link:', err.message);
                return res.status(500).json({ error: err.message });
            }

            const shareUrl = `/shared-report/${shareToken}`;
            res.json({
                shareToken,
                shareUrl,
                expiresAt,
                message: 'Share link created successfully'
            });
        });
    });
});

// ACCESS SHARED REPORT (PUBLIC ENDPOINT - NO AUTH REQUIRED)
router.get('/reports/shared/:shareToken', (req, res) => {
    const { shareToken } = req.params;

    // Get share info
    const shareSql = `SELECT * FROM report_shares WHERE share_token = ? AND is_active = 1`;
    db.get(shareSql, [shareToken], (err, share) => {
        if (err) {
            console.error('[Reports] Error fetching share:', err.message);
            return res.status(500).json({ error: err.message });
        }

        if (!share) {
            return res.status(404).json({ error: 'Share link not found or expired' });
        }

        // Check expiration
        if (share.expires_at && new Date(share.expires_at) < new Date()) {
            return res.status(410).json({ error: 'Share link has expired' });
        }

        // Check max access count
        if (share.max_access_count && share.access_count >= share.max_access_count) {
            return res.status(410).json({ error: 'Share link access limit reached' });
        }

        // Get report
        const reportSql = `SELECT * FROM assessment_reports WHERE id = ?`;
        db.get(reportSql, [share.report_id], (err, report) => {
            if (err) {
                console.error('[Reports] Error fetching shared report:', err.message);
                return res.status(500).json({ error: err.message });
            }

            if (!report) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Update access count
            const updateSql = `UPDATE report_shares 
                              SET access_count = access_count + 1,
                                  last_accessed_at = CURRENT_TIMESTAMP
                              WHERE id = ?`;
            db.run(updateSql, [share.id], (err) => {
                if (err) {
                    console.error('[Reports] Error updating access count:', err.message);
                }
            });

            try {
                report.assessment_snapshot = JSON.parse(report.assessment_snapshot);
            } catch (e) {
                console.error('[Reports] JSON Parse Error:', e.message);
            }

            res.json({ report });
        });
    });
});

// Helper function to calculate comparison data
function calculateComparisonData(reports) {
    const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];
    const comparison = {
        timeline: reports.map(r => ({
            date: r.generated_at,
            avgActual: r.avg_actual,
            avgTarget: r.avg_target,
            gapPoints: r.gap_points
        })),
        axisTrends: {}
    };

    axes.forEach(axis => {
        const trend = reports.map(r => {
            const data = r.assessment_snapshot[axis];
            return {
                date: r.generated_at,
                actual: data?.actual || 0,
                target: data?.target || 0,
                gap: (data?.target || 0) - (data?.actual || 0)
            };
        });

        comparison.axisTrends[axis] = {
            trend,
            totalChange: trend[trend.length - 1].actual - trend[0].actual,
            avgChange: trend.reduce((sum, t) => sum + t.gap, 0) / trend.length
        };
    });

    return comparison;
}

// ==========================================
// ASSESSMENT OVERVIEW API (Multi-Framework Dashboard)
// ==========================================

/**
 * GET ASSESSMENT OVERVIEW - Unified dashboard data
 * GET /api/sessions/:projectId/assessment-overview
 */
router.get('/:projectId/assessment-overview', async (req, res) => {
    const { projectId } = req.params;
    const orgId = req.user.organizationId;

    console.log(`[AssessmentOverview] Fetching overview for project: ${projectId}, org: ${orgId}`);

    try {
        const AssessmentOverviewService = require('../services/assessmentOverviewService');
        const overview = await AssessmentOverviewService.getAssessmentOverview(orgId, projectId);
        res.json(overview);
    } catch (error) {
        console.error('[AssessmentOverview] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;


