import { v4 as uuidv4 } from 'uuid';

import DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import PDFParserService from './pdfParserService.js';

/**
 * Generic Report Service
 *
 * Manages generic assessment report uploads (ISO, Consulting, Compliance).
 * Handles file storage, text extraction, AI summarization, and full-text search.
 */
class GenericReportService {
  private db: any;

  setDependencies(deps: { db: any }) {
    this.db = deps.db;
  }

  /**
   * Upload generic report
   */
  async uploadReport({
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
    userId,
  }: any) {
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

      await DbPromise.run(this.db, sql, [
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
        userId,
      ]);

      // Start async processing
      this.processReport(reportId, filePath, fileType).catch((err: any) => {
        const msg = err?.message || String(err);
        logger.error('[GenericReport] Processing error:', msg);
        this.updateProcessingStatus(reportId, 'error', msg);
      });

      return {
        id: reportId,
        processing_status: 'pending',
      };
    } catch (error) {
      logger.error('[GenericReport] Upload error:', error);
      throw error;
    }
  }

  /**
   * Process report file (extract text, generate summary)
   */
  async processReport(reportId: string, filePath: string, fileType: string) {
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
      const parsed = await PDFParserService.parseGenericReport(extractedText);

      // Generate AI summary (simple for now, can integrate with aiService later)
      const aiSummary = GenericReportService.generateSimpleSummary(extractedText);

      // Suggest tags
      const suggestedTags = GenericReportService.suggestTags(extractedText);

      // Update database
      await this.updateReportContent(reportId, {
        ocrText: extractedText.substring(0, 10000), // Limit to 10k chars
        aiSummary,
        keyFindings: parsed.findings,
        suggestedTags,
      });

      logger.info(`[GenericReport] Processing complete: ${reportId}`);
    } catch (error: any) {
      logger.error('[GenericReport] Processing error:', error.message);
      await this.updateProcessingStatus(reportId, 'error', error.message);
      throw error;
    }
  }

  /**
   * Generate simple AI summary (placeholder)
   */
  static generateSimpleSummary(text: string) {
    // Extract first 3-5 sentences as summary
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ') + '.';
    return summary.substring(0, 500);
  }

  /**
   * Suggest tags based on content
   */
  static suggestTags(text: string) {
    const tagKeywords: Record<string, string[]> = {
      ISO: ['ISO 9001', 'ISO 27001', 'ISO certification'],
      'Digital Transformation': ['digital', 'transformation', 'digitalization'],
      Lean: ['lean', 'kaizen', 'waste', 'value stream'],
      Security: ['security', 'cybersecurity', 'risk', 'compliance'],
      Data: ['data management', 'data governance', 'analytics'],
      Process: ['process improvement', 'workflow', 'efficiency'],
    };

    const tags: string[] = [];
    const lowerText = text.toLowerCase();

    Object.keys(tagKeywords).forEach((tag) => {
      const keywords = tagKeywords[tag];
      if (keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * Update processing status
   */
  async updateProcessingStatus(reportId: string, status: string, error: string | null = null) {
    const sql = `
            UPDATE generic_assessment_reports
            SET processing_status = ?, processing_error = ?
            WHERE id = ?
        `;
    await DbPromise.run(this.db, sql, [status, error, reportId]);
  }

  /**
   * Update report content after processing
   */
  async updateReportContent(
    reportId: string,
    { ocrText, aiSummary, keyFindings, suggestedTags }: any
  ) {
    const sql = `
            UPDATE generic_assessment_reports
            SET ocr_text = ?,
                ai_summary = ?,
                ai_key_findings = ?,
                tags_json = ?,
                processing_status = 'completed'
            WHERE id = ?
        `;

    await DbPromise.run(this.db, sql, [
      ocrText,
      aiSummary,
      JSON.stringify(keyFindings),
      JSON.stringify(suggestedTags),
      reportId,
    ]);
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string, organizationId: string) {
    const sql = `SELECT * FROM generic_assessment_reports WHERE id = ? AND organization_id = ?`;

    const row: any = await DbPromise.get(this.db, sql, [reportId, organizationId]);
    if (!row) throw new Error('Report not found');

    // Parse JSON fields
    row.tags_json = JSON.parse(row.tags_json || '[]');
    row.ai_key_findings = JSON.parse(row.ai_key_findings || '[]');
    row.linked_initiatives = JSON.parse(row.linked_initiatives || '[]');

    return row;
  }

  /**
   * Search reports
   */
  async searchReports({ organizationId, query, reportType, sortBy = 'uploaded_at' }: any) {
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

    // SQLi guard: sortBy is caller-supplied — whitelist to real sortable columns,
    // never interpolate raw input (same class as fixed inbox-v4 getInboxTable).
    const SORTABLE: Record<string, string> = {
      uploaded_at: 'uploaded_at',
      title: 'title',
      report_type: 'report_type',
    };
    const sortCol = SORTABLE[String(sortBy)] || 'uploaded_at';
    sql += ` ORDER BY ${sortCol} DESC LIMIT 50`;

    const rows = await DbPromise.all(this.db, sql, params);
    return rows || [];
  }

  /**
   * Link report to initiative
   */
  async linkToInitiative(reportId: string, initiativeId: string, organizationId: string) {
    try {
      const report = await this.getReport(reportId, organizationId);
      const linkedInitiatives = report.linked_initiatives || [];

      if (!linkedInitiatives.includes(initiativeId)) {
        linkedInitiatives.push(initiativeId);

        const sql = `
                    UPDATE generic_assessment_reports
                    SET linked_initiatives = ?
                    WHERE id = ? AND organization_id = ?
                `;

        await DbPromise.run(this.db, sql, [
          JSON.stringify(linkedInitiatives),
          reportId,
          organizationId,
        ]);
        return { success: true };
      }

      return { success: true, message: 'Already linked' };
    } catch (error) {
      throw error;
    }
  }
}

export default GenericReportService;
