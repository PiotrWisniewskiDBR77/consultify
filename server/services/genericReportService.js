/**
 * Generic Report Service
 * 
 * Manages generic assessment report uploads (ISO, Consulting, Compliance).
 * Handles file storage, text extraction, AI summarization, and full-text search.
 */

const db = require('../database');
const { v4: uuidv4 } = require('uuid');
const PDFParserService = require('./pdfParserService');

class GenericReportService {
    /**
     * Upload generic report
     * @param {Object} params - Upload parameters
     * @returns {Promise<Object>} Created report with AI summary
     */
    static async uploadReport({
        organizationId,
        projectId,
        reportType,
        title,
        consultantName,
        reportDate,
        filePath,
        fileName,
        fileSize,
        fileType,
        tags,
        userId
    }) {
        try {
            const reportId = uuidv4();

            // Insert report record
            const sql = `
                INSERT INTO generic_assessment_reports (
                    id, organization_id, project_id,
                    report_type, title, consultant_name, report_date,
                    file_path, file_name, file_size, file_type,
                    tags_json, processing_status,
                    uploaded_by, uploaded_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
            `;

            await new Promise((resolve, reject) => {
                db.run(sql, [
                    reportId,
                    organizationId,
                    projectId || null,
                    reportType,
                    title,
                    consultantName || null,
                    reportDate || null,
                    filePath,
                    fileName,
                    fileSize,
                    fileType,
                    JSON.stringify(tags || []),
                    userId
                ], function (err) {
                    if (err) return reject(err);
                    resolve();
                });
            });

            // Start async processing
            this.processReport(reportId, filePath, fileType).catch(err => {
                console.error('[GenericReport] Processing error:', err.message);
                this.updateProcessingStatus(reportId, 'error', err.message);
            });

            return {
                id: reportId,
                processing_status: 'pending'
            };
        } catch (error) {
            console.error('[GenericReport] Upload error:', error);
            throw error;
        }
    }

    /**
     * Process report file (extract text, generate summary)
     * @param {string} reportId - Report ID
     * @param {string} filePath - File path
     * @param {string} fileType - File type
     */
    static async processReport(reportId, filePath, fileType) {
        try {
            await this.updateProcessingStatus(reportId, 'processing');

            // Extract text based on file type
            let extractedText = '';
            if (fileType.toLowerCase().includes('pdf')) {
                extractedText = await PDFParserService.extractText(filePath);
            } else {
                // TODO: Add DOCX/XLSX parsers
                extractedText = 'Text extraction not yet supported for this file type';
            }

            // Parse generic findings
            const parsed = PDFParserService.parseGenericReport(extractedText);

            // Generate AI summary (simple for now, can integrate with aiService later)
            const aiSummary = this.generateSimpleSummary(extractedText);

            // Suggest tags
            const suggestedTags = this.suggestTags(extractedText);

            // Update database
            await this.updateReportContent(reportId, {
                ocrText: extractedText.substring(0, 10000), // Limit to 10k chars
                aiSummary,
                keyFindings: parsed.findings,
                suggestedTags
            });

            console.log(`[GenericReport] Processing complete: ${reportId}`);
        } catch (error) {
            console.error('[GenericReport] Processing error:', error.message);
            await this.updateProcessingStatus(reportId, 'error', error.message); throw error;
        }
    }

    /**
     * Generate simple AI summary (placeholder)
     * TODO: Integrate with aiService for GPT-powered summaries
     * @param {string} text - Extracted text
     * @returns {string} Summary
     */
    static generateSimpleSummary(text) {
        // Extract first 3-5 sentences as summary
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const summary = sentences.slice(0, 3).join('. ') + '.';
        return summary.substring(0, 500);
    }

    /**
     * Suggest tags based on content
     * @param {string} text - Extracted text
     * @returns {Array} Suggested tags
     */
    static suggestTags(text) {
        const tagKeywords = {
            'ISO': ['ISO 9001', 'ISO 27001', 'ISO certification'],
            'Digital Transformation': ['digital', 'transformation', 'digitalization'],
            'Lean': ['lean', 'kaizen', 'waste', 'value stream'],
            'Security': ['security', 'cybersecurity', 'risk', 'compliance'],
            'Data': ['data management', 'data governance', 'analytics'],
            'Process': ['process improvement', 'workflow', 'efficiency']
        };

        const tags = [];
        const lowerText = text.toLowerCase();

        Object.keys(tagKeywords).forEach(tag => {
            const keywords = tagKeywords[tag];
            if (keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))) {
                tags.push(tag);
            }
        });

        return tags;
    }

    /**
     * Update processing status
     * @param {string} reportId - Report ID
     * @param {string} status - New status
     * @param {string} error - Error message (optional)
     */
    static async updateProcessingStatus(reportId, status, error = null) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE generic_assessment_reports
                SET processing_status = ?, processing_error = ?
                WHERE id = ?
            `;

            db.run(sql, [status, error, reportId], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Update report content after processing
     * @param {string} reportId - Report ID
     * @param {Object} data - Content data
     */
    static async updateReportContent(reportId, { ocrText, aiSummary, keyFindings, suggestedTags }) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE generic_assessment_reports
                SET ocr_text = ?,
                    ai_summary = ?,
                    ai_key_findings = ?,
                    tags_json = ?,
                    processing_status = 'completed'
                WHERE id = ?
            `;

            db.run(sql, [
                ocrText,
                aiSummary,
                JSON.stringify(keyFindings),
                JSON.stringify(suggestedTags),
                reportId
            ], function (err) {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    /**
     * Get report by ID
     * @param {string} reportId - Report ID
     * @param {string} organizationId - Organization ID
     * @returns {Promise<Object>} Report data
     */
    static async getReport(reportId, organizationId) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT * FROM generic_assessment_reports WHERE id = ? AND organization_id = ?`;

            db.get(sql, [reportId, organizationId], (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Report not found'));

                // Parse JSON fields
                row.tags_json = JSON.parse(row.tags_json || '[]');
                row.ai_key_findings = JSON.parse(row.ai_key_findings || '[]');
                row.linked_initiatives = JSON.parse(row.linked_initiatives || '[]');

                resolve(row);
            });
        });
    }

    /**
     * Search reports
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Search results
     */
    static async searchReports({ organizationId, query, reportType, sortBy = 'uploaded_at' }) {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT id, title, report_type, consultant_name, report_date,
                       file_name, file_size, processing_status, uploaded_at
                FROM generic_assessment_reports
                WHERE organization_id = ?
            `;

            const params = [organizationId];

            if (query) {
                sql += ` AND (title LIKE ? OR ocr_text LIKE ? OR ai_summary LIKE ?)`;
                const searchTerm = `%${query}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            if (reportType && reportType !== 'ALL') {
                sql += ` AND report_type = ?`;
                params.push(reportType);
            }

            sql += ` ORDER BY ${sortBy} DESC LIMIT 50`;

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    }

    /**
     * Link report to initiative
     * @param {string} reportId - Report ID
     * @param {string} initiativeId - Initiative ID
     * @param {string} organizationId - Organization ID
     */
    static async linkToInitiative(reportId, initiativeId, organizationId) {
        try {
            const report = await this.getReport(reportId, organizationId);
            const linkedInitiatives = report.linked_initiatives || [];

            if (!linkedInitiatives.includes(initiativeId)) {
                linkedInitiatives.push(initiativeId);

                return new Promise((resolve, reject) => {
                    const sql = `
                        UPDATE generic_assessment_reports
                        SET linked_initiatives = ?
                        WHERE id = ? AND organization_id = ?
                    `;

                    db.run(sql, [JSON.stringify(linkedInitiatives), reportId, organizationId], function (err) {
                        if (err) return reject(err);
                        resolve({ success: true });
                    });
                });
            }

            return { success: true, message: 'Already linked' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = GenericReportService;
