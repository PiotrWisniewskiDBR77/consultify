/**
 * Management Reports Analytics API Routes
 * 
 * Endpoints for report usage analytics and metrics.
 * 
 * PMO Standards: Performance Measurement
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const db = require('../database');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * GET /api/management-reports/analytics/usage
 * Get report generation statistics
 */
router.get('/usage', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const { fromDate, toDate } = req.query;

        let dateFilter = '';
        const params = [orgId];

        if (fromDate) {
            dateFilter += ' AND created_at >= ?';
            params.push(fromDate);
        }
        if (toDate) {
            dateFilter += ' AND created_at <= ?';
            params.push(toDate);
        }

        // Total reports
        const totalStats = await dbGet(`
            SELECT 
                COUNT(*) as total_reports,
                COUNT(CASE WHEN status = 'FINAL' THEN 1 END) as finalized_reports,
                COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft_reports,
                COUNT(CASE WHEN pdf_path IS NOT NULL THEN 1 END) as pdf_exports,
                COUNT(CASE WHEN pptx_path IS NOT NULL THEN 1 END) as pptx_exports
            FROM management_reports
            WHERE organization_id = ?${dateFilter}
        `, params);

        // Reports by day (last 30 days)
        const dailyStats = await dbAll(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM management_reports
            WHERE organization_id = ? AND created_at >= DATE('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `, [orgId]);

        // Average time to finalize
        const avgFinalize = await dbGet(`
            SELECT 
                AVG(JULIANDAY(finalized_at) - JULIANDAY(created_at)) * 24 as avg_hours
            FROM management_reports
            WHERE organization_id = ? AND finalized_at IS NOT NULL${dateFilter}
        `, params);

        res.json({
            totalReports: totalStats?.total_reports || 0,
            finalizedReports: totalStats?.finalized_reports || 0,
            draftReports: totalStats?.draft_reports || 0,
            pdfExports: totalStats?.pdf_exports || 0,
            pptxExports: totalStats?.pptx_exports || 0,
            avgHoursToFinalize: avgFinalize?.avg_hours ? Math.round(avgFinalize.avg_hours) : null,
            dailyStats
        });

    } catch (error) {
        console.error('[ReportAnalytics] Usage error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/management-reports/analytics/types
 * Get report type breakdown
 */
router.get('/types', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;

        const typeStats = await dbAll(`
            SELECT 
                report_type,
                scope,
                COUNT(*) as count,
                COUNT(CASE WHEN status = 'FINAL' THEN 1 END) as finalized
            FROM management_reports
            WHERE organization_id = ?
            GROUP BY report_type, scope
            ORDER BY count DESC
        `, [orgId]);

        res.json({
            types: typeStats.map(t => ({
                reportType: t.report_type,
                scope: t.scope,
                count: t.count,
                finalizedCount: t.finalized
            }))
        });

    } catch (error) {
        console.error('[ReportAnalytics] Types error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/management-reports/analytics/users
 * Get top report generators
 */
router.get('/users', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;
        const { limit = 10 } = req.query;

        const userStats = await dbAll(`
            SELECT 
                mr.generated_by,
                u.first_name || ' ' || u.last_name as name,
                u.email,
                COUNT(*) as reports_generated,
                COUNT(CASE WHEN mr.status = 'FINAL' THEN 1 END) as finalized
            FROM management_reports mr
            LEFT JOIN users u ON mr.generated_by = u.id
            WHERE mr.organization_id = ?
            GROUP BY mr.generated_by
            ORDER BY reports_generated DESC
            LIMIT ?
        `, [orgId, parseInt(limit)]);

        res.json({
            users: userStats.map(u => ({
                userId: u.generated_by,
                name: u.name || u.email,
                reportsGenerated: u.reports_generated,
                finalizedCount: u.finalized
            }))
        });

    } catch (error) {
        console.error('[ReportAnalytics] Users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/management-reports/analytics/shares
 * Get share link analytics
 */
router.get('/shares', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;

        // Reports with share links
        const shareStats = await dbGet(`
            SELECT 
                COUNT(DISTINCT mr.id) as reports_shared,
                SUM(mrr.view_count) as total_views
            FROM management_reports mr
            JOIN management_report_recipients mrr ON mr.id = mrr.report_id
            WHERE mr.organization_id = ? AND mrr.share_token IS NOT NULL
        `, [orgId]);

        // Most viewed reports
        const topViewed = await dbAll(`
            SELECT 
                mr.id,
                mr.title,
                mr.report_type,
                SUM(mrr.view_count) as views,
                MAX(mrr.last_viewed_at) as last_viewed
            FROM management_reports mr
            JOIN management_report_recipients mrr ON mr.id = mrr.report_id
            WHERE mr.organization_id = ? AND mrr.share_token IS NOT NULL
            GROUP BY mr.id
            ORDER BY views DESC
            LIMIT 10
        `, [orgId]);

        res.json({
            totalReportsShared: shareStats?.reports_shared || 0,
            totalViews: shareStats?.total_views || 0,
            topViewed: topViewed.map(r => ({
                id: r.id,
                title: r.title,
                reportType: r.report_type,
                views: r.views,
                lastViewed: r.last_viewed
            }))
        });

    } catch (error) {
        console.error('[ReportAnalytics] Shares error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/management-reports/analytics/approval
 * Get approval workflow analytics
 */
router.get('/approval', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;

        // Approval stats
        const approvalStats = await dbGet(`
            SELECT 
                COUNT(DISTINCT mr.id) as reports_with_approval,
                COUNT(CASE WHEN mr.approval_status = 'APPROVED' THEN 1 END) as approved,
                COUNT(CASE WHEN mr.approval_status = 'REJECTED' THEN 1 END) as rejected,
                COUNT(CASE WHEN mr.approval_status = 'PENDING' THEN 1 END) as pending
            FROM management_reports mr
            WHERE mr.organization_id = ? AND mr.requires_approval = 1
        `, [orgId]);

        // Average approval time
        const avgApprovalTime = await dbGet(`
            SELECT 
                AVG(
                    JULIANDAY(
                        (SELECT MAX(decided_at) FROM management_report_approvals WHERE report_id = mr.id AND status = 'APPROVED')
                    ) - JULIANDAY(
                        (SELECT MIN(created_at) FROM management_report_approvals WHERE report_id = mr.id)
                    )
                ) * 24 as avg_hours
            FROM management_reports mr
            WHERE mr.organization_id = ? AND mr.approval_status = 'APPROVED'
        `, [orgId]);

        // Pending by level
        const pendingByLevel = await dbAll(`
            SELECT 
                mra.approval_level,
                mra.required_role,
                COUNT(*) as count
            FROM management_report_approvals mra
            JOIN management_reports mr ON mra.report_id = mr.id
            WHERE mr.organization_id = ? AND mra.status = 'PENDING'
            GROUP BY mra.approval_level, mra.required_role
            ORDER BY mra.approval_level
        `, [orgId]);

        res.json({
            reportsWithApproval: approvalStats?.reports_with_approval || 0,
            approved: approvalStats?.approved || 0,
            rejected: approvalStats?.rejected || 0,
            pending: approvalStats?.pending || 0,
            avgApprovalHours: avgApprovalTime?.avg_hours ? Math.round(avgApprovalTime.avg_hours) : null,
            pendingByLevel
        });

    } catch (error) {
        console.error('[ReportAnalytics] Approval error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/management-reports/analytics/projects
 * Get reports by project
 */
router.get('/projects', authMiddleware, async (req, res) => {
    try {
        const orgId = req.user.organization_id;

        const projectStats = await dbAll(`
            SELECT 
                mr.project_id,
                p.name as project_name,
                COUNT(*) as report_count,
                MAX(mr.created_at) as last_report
            FROM management_reports mr
            LEFT JOIN projects p ON mr.project_id = p.id
            WHERE mr.organization_id = ?
            GROUP BY mr.project_id
            ORDER BY report_count DESC
        `, [orgId]);

        res.json({
            projects: projectStats.map(p => ({
                projectId: p.project_id,
                projectName: p.project_name || 'Portfolio Reports',
                reportCount: p.report_count,
                lastReport: p.last_report
            }))
        });

    } catch (error) {
        console.error('[ReportAnalytics] Projects error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;



