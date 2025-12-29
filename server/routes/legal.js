/**
 * Legal Routes
 * API endpoints for legal document management and acceptance.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const LegalService = require('../services/legalService');
const ActivityService = require('../services/activityService');

// ==========================================
// PUBLIC ROUTES (No Authentication Required)
// ==========================================

/**
 * GET /api/legal/document/:docType
 * Get public legal document by type (no auth required)
 * Used for legal pages that need to be accessible before login
 */
router.get('/document/:docType', async (req, res) => {
    try {
        const { docType } = req.params;
        const validTypes = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA', 'SLA', 'REFUND', 'SECURITY', 'SUBPROCESSORS', 'SUBSCRIPTION', 'CUSTOMER_SECURITY'];

        if (!validTypes.includes(docType.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid document type' });
        }

        const document = await LegalService.getActiveDocument(docType.toUpperCase());

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ document });
    } catch (err) {
        console.error('[Legal] Error fetching public document:', err);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

/**
 * GET /api/legal/documents
 * List all public legal documents (metadata only, no auth required)
 */
router.get('/documents', async (req, res) => {
    try {
        const documents = await LegalService.getActiveDocuments();
        res.json({ 
            documents: documents.map(doc => ({
                doc_type: doc.doc_type,
                title: doc.title,
                version: doc.version,
                effective_from: doc.effective_from
            }))
        });
    } catch (err) {
        console.error('[Legal] Error fetching documents list:', err);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// ==========================================
// AUTHENTICATED ROUTES
// ==========================================

// All routes below require authentication
router.use(authMiddleware);

/**
 * GET /api/legal/active
 * List all active legal documents (metadata only)
 */
router.get('/active', async (req, res) => {
    try {
        const documents = await LegalService.getActiveDocuments();
        res.json(documents);
    } catch (err) {
        console.error('[Legal] Error fetching active documents:', err);
        res.status(500).json({ error: 'Failed to fetch legal documents' });
    }
});

/**
 * GET /api/legal/active/:docType
 * Get specific active document with full content
 */
router.get('/active/:docType', async (req, res) => {
    try {
        const { docType } = req.params;
        const validTypes = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA', 'SLA', 'REFUND', 'SECURITY', 'SUBPROCESSORS', 'SUBSCRIPTION', 'CUSTOMER_SECURITY'];

        if (!validTypes.includes(docType.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid document type' });
        }

        const document = await LegalService.getActiveDocument(docType.toUpperCase());

        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json(document);
    } catch (err) {
        console.error('[Legal] Error fetching document:', err);
        res.status(500).json({ error: 'Failed to fetch document' });
    }
});

/**
 * GET /api/legal/pending
 * Check pending acceptances for current user
 */
router.get('/pending', async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId;
        const userRole = req.user.role;

        const pending = await LegalService.checkPendingAcceptances(userId, orgId, userRole);
        res.json(pending);
    } catch (err) {
        console.error('[Legal] Error checking pending:', err);
        res.status(500).json({ error: 'Failed to check pending acceptances' });
    }
});

/**
 * GET /api/legal/my-acceptances
 * Get current user's acceptance history
 */
router.get('/my-acceptances', async (req, res) => {
    try {
        const userId = req.user.id;
        const orgId = req.user.organizationId;

        const acceptances = await LegalService.getUserAcceptances(userId, orgId);
        res.json(acceptances);
    } catch (err) {
        console.error('[Legal] Error fetching acceptances:', err);
        res.status(500).json({ error: 'Failed to fetch acceptances' });
    }
});

/**
 * POST /api/legal/accept
 * Accept one or more legal documents
 * Body: { docTypes: ['TOS', 'PRIVACY'], scope?: 'USER' | 'ORG_ADMIN' }
 */
router.post('/accept', async (req, res) => {
    try {
        const { docTypes, scope = 'USER' } = req.body;

        if (!docTypes || !Array.isArray(docTypes) || docTypes.length === 0) {
            return res.status(400).json({ error: 'docTypes array is required' });
        }

        const validTypes = ['TOS', 'PRIVACY', 'COOKIES', 'AUP', 'AI_POLICY', 'DPA', 'SLA', 'REFUND', 'SECURITY', 'SUBPROCESSORS', 'SUBSCRIPTION', 'CUSTOMER_SECURITY'];
        const invalidTypes = docTypes.filter(t => !validTypes.includes(t.toUpperCase()));
        if (invalidTypes.length > 0) {
            return res.status(400).json({ error: `Invalid document types: ${invalidTypes.join(', ')}` });
        }

        const normalizedTypes = docTypes.map(t => t.toUpperCase());

        const result = await LegalService.acceptDocuments({
            userId: req.user.id,
            orgId: req.user.organizationId,
            docTypes: normalizedTypes,
            scope,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent'),
            userRole: req.user.role
        });

        // Log acceptance events
        for (const accepted of result.created) {
            ActivityService.log({
                organizationId: req.user.organizationId,
                userId: req.user.id,
                action: 'legal_acceptance',
                entityType: 'legal_document',
                entityId: accepted.id,
                entityName: accepted.docType,
                newValue: {
                    docType: accepted.docType,
                    version: accepted.version,
                    scope: accepted.scope
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });
        }

        res.json(result);
    } catch (err) {
        console.error('[Legal] Accept error:', err);

        if (err.message.includes('Only organization admins')) {
            return res.status(403).json({ error: err.message });
        }

        res.status(500).json({ error: 'Failed to accept documents' });
    }
});

/**
 * GET /api/legal/admin/acceptance-status/organization/:orgId
 * Get acceptance status for all users in an organization (Admin only)
 */
router.get('/admin/acceptance-status/organization/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userRole = req.user.role;
        const userOrgId = req.user.organizationId;

        // Validate access - must be admin/owner of the org or superadmin
        if (userRole !== 'SUPERADMIN' && userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const status = await LegalService.getOrgAcceptanceStatus(orgId);
        res.json(status);
    } catch (err) {
        console.error('[Legal] Admin status error:', err);
        res.status(500).json({ error: 'Failed to fetch acceptance status' });
    }
});

// ==========================================
// ENTERPRISE+ COMPLIANCE EXPORT ENDPOINTS
// ==========================================

const LegalExportService = require('../services/legalExportService');

/**
 * GET /api/legal/export/acceptances
 * Export acceptance records (Admin/SuperAdmin only)
 * Query params: organizationId, userId, docType, dateFrom, dateTo, format (csv|json)
 */
router.get('/export/acceptances', async (req, res) => {
    try {
        const userRole = req.user.role;
        const userOrgId = req.user.organizationId;

        // Only admins can export
        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { organizationId, userId, docType, dateFrom, dateTo, format } = req.query;

        // Non-superadmins can only export their own org
        if (userRole !== 'SUPERADMIN' && organizationId && organizationId !== userOrgId) {
            return res.status(403).json({ error: 'Access denied to other organizations' });
        }

        const result = await LegalExportService.exportAcceptances({
            organizationId: organizationId || (userRole !== 'SUPERADMIN' ? userOrgId : null),
            userId,
            docType,
            dateFrom,
            dateTo,
            format: format || 'json'
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="legal-acceptances-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.send(result.data);
        }

        res.json(result);
    } catch (err) {
        console.error('[Legal] Export error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

/**
 * GET /api/legal/export/audit-log
 * Export legal events audit log (Admin/SuperAdmin only)
 * Query params: organizationId, userId, documentId, eventTypes (comma-separated), dateFrom, dateTo, format
 */
router.get('/export/audit-log', async (req, res) => {
    try {
        const userRole = req.user.role;
        const userOrgId = req.user.organizationId;

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { organizationId, userId, documentId, eventTypes, dateFrom, dateTo, format } = req.query;

        // Non-superadmins can only export their own org
        if (userRole !== 'SUPERADMIN' && organizationId && organizationId !== userOrgId) {
            return res.status(403).json({ error: 'Access denied to other organizations' });
        }

        const result = await LegalExportService.exportAuditLog({
            organizationId: organizationId || (userRole !== 'SUPERADMIN' ? userOrgId : null),
            userId,
            documentId,
            eventTypes: eventTypes ? eventTypes.split(',') : null,
            dateFrom,
            dateTo,
            format: format || 'json'
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="legal-audit-log-${new Date().toISOString().split('T')[0]}.csv"`);
            return res.send(result.data);
        }

        res.json(result);
    } catch (err) {
        console.error('[Legal] Audit export error:', err);
        res.status(500).json({ error: 'Export failed' });
    }
});

/**
 * GET /api/legal/compliance-summary
 * Get compliance summary for organization (Admin only)
 */
router.get('/compliance-summary', async (req, res) => {
    try {
        const userRole = req.user.role;
        const userOrgId = req.user.organizationId;

        if (!['ADMIN', 'OWNER', 'SUPERADMIN'].includes(userRole)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const orgId = req.query.organizationId || userOrgId;

        // Non-superadmins can only view their own org
        if (userRole !== 'SUPERADMIN' && orgId !== userOrgId) {
            return res.status(403).json({ error: 'Access denied to other organizations' });
        }

        const summary = await LegalExportService.getComplianceSummary(orgId);
        res.json(summary);
    } catch (err) {
        console.error('[Legal] Compliance summary error:', err);
        res.status(500).json({ error: 'Failed to get compliance summary' });
    }
});

// ==========================================
// CONTACT FORM
// ==========================================

const EmailService = require('../services/emailService');

/**
 * POST /api/legal/contact
 * Submit contact form (public endpoint, no auth required)
 */
router.post('/contact', async (req, res) => {
    try {
        const { name, email, company, subject, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'Name, email, and message are required' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Send email notification to support
        try {
            await EmailService.sendEmail({
                to: process.env.SUPPORT_EMAIL || 'support@consultinity.com',
                subject: `[Contact Form] ${subject || 'General Inquiry'} from ${name}`,
                text: `
Contact Form Submission
=======================
Name: ${name}
Email: ${email}
Company: ${company || 'Not provided'}
Subject: ${subject || 'General Inquiry'}

Message:
${message}

---
This message was sent from the Consultify contact form.
                `,
                html: `
<h2>Contact Form Submission</h2>
<table style="border-collapse: collapse;">
    <tr><td style="padding: 5px; font-weight: bold;">Name:</td><td style="padding: 5px;">${name}</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Email:</td><td style="padding: 5px;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Company:</td><td style="padding: 5px;">${company || 'Not provided'}</td></tr>
    <tr><td style="padding: 5px; font-weight: bold;">Subject:</td><td style="padding: 5px;">${subject || 'General Inquiry'}</td></tr>
</table>
<h3>Message:</h3>
<p style="white-space: pre-wrap;">${message}</p>
<hr>
<p style="color: #666; font-size: 12px;">This message was sent from the Consultify contact form.</p>
                `
            });
        } catch (emailError) {
            console.error('[Contact] Email send failed:', emailError);
            // Don't fail the request if email fails - we still want to log it
        }

        // Log the contact submission
        console.log('[Contact] Form submitted:', { name, email, company, subject });

        res.json({ success: true, message: 'Thank you for contacting us. We will get back to you soon.' });
    } catch (err) {
        console.error('[Contact] Error:', err);
        res.status(500).json({ error: 'Failed to submit contact form' });
    }
});

module.exports = router;

