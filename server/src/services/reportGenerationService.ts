/**
 * Report Generation Service
 * FLOW-REPORT-001: Generate, export, and share reports
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ReportGenerationParams {
  reportType: 'assessment' | 'project' | 'portfolio' | 'initiative';
  sourceId: string; // assessmentId, projectId, etc.
  language?: string;
  templateId?: string;
  includeAppendix?: boolean;
}

export interface GeneratedReport {
  id: string;
  type: string;
  title: string;
  executiveSummary: string;
  sections: ReportSection[];
  generatedAt: string;
  language: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
  charts?: ChartDefinition[];
  tables?: TableDefinition[];
}

export interface ChartDefinition {
  type: 'radar' | 'bar' | 'line' | 'pie';
  title: string;
  data: Record<string, unknown>;
}

export interface TableDefinition {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface PublicLinkParams {
  reportId: string;
  reportType: string;
  organizationId: string;
  userId: string;
  password?: string;
  expiresInDays?: number;
  showCompanyLogo?: boolean;
  showConsultinityBranding?: boolean;
  customMessage?: string;
}

// ==========================================
// SERVICE
// ==========================================

class ReportGenerationService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  private async ensureExportDir(): Promise<string> {
    const exportDir = path.resolve(process.cwd(), 'exports', 'reports');
    await fs.promises.mkdir(exportDir, { recursive: true });
    return exportDir;
  }

  private formatDecisions(decisions: { title?: string; deadline?: string; status?: string }[]): string {
    if (!decisions || decisions.length === 0) {
      return 'No pending decisions.';
    }
    return decisions
      .slice(0, 10)
      .map((d, index) => {
        const due = d.deadline ? ` (due ${d.deadline})` : '';
        const status = d.status ? ` [${String(d.status).toUpperCase()}]` : '';
        return `${index + 1}. ${d.title || 'Decision'}${status}${due}`;
      })
      .join('\n');
  }

  private formatEscalations(decisions: { title?: string; deadline?: string; status?: string }[]): string {
    const escalated = decisions.filter(
      (d) => String(d.status || '').toLowerCase() === 'escalated'
    );
    if (!escalated.length) {
      return 'No escalations.';
    }
    return escalated
      .slice(0, 10)
      .map((d, index) => {
        const due = d.deadline ? ` (due ${d.deadline})` : '';
        return `${index + 1}. ${d.title || 'Decision'}${due}`;
      })
      .join('\n');
  }

  /**
   * Generate a report
   */
  async generateReport(params: ReportGenerationParams, orgId: string): Promise<GeneratedReport> {
    const db = await this.getDb();
    const now = new Date().toISOString();
    const language = params.language || 'en';

    let report: GeneratedReport;

    switch (params.reportType) {
      case 'assessment':
        report = await this.generateAssessmentReport(params.sourceId, language, orgId);
        break;
      case 'project':
        report = await this.generateProjectReport(params.sourceId, language, orgId);
        break;
      case 'portfolio':
        report = await this.generatePortfolioReport(orgId, language);
        break;
      case 'initiative':
        report = await this.generateInitiativeReport(params.sourceId, language, orgId);
        break;
      default:
        throw new Error(`Unknown report type: ${params.reportType}`);
    }

    logger.info(`[ReportGenerationService] Generated ${params.reportType} report: ${report.id}`);
    return report;
  }

  /**
   * Generate assessment report
   */
  private async generateAssessmentReport(
    assessmentId: string,
    language: string,
    orgId: string
  ): Promise<GeneratedReport> {
    const db = await this.getDb();

    // Get assessment data
    const assessment = await db.get<{
      id: string;
      name: string;
      framework: string;
      overall_score: number;
      maturity_level: number;
      completed_at: string;
    }>('SELECT * FROM assessments WHERE id = ? AND organization_id = ?', [assessmentId, orgId]);

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    // Get dimension scores
    const dimensionScores = await db.all<{
      dimension_id: string;
      dimension_name: string;
      score: number;
      max_score: number;
    }>('SELECT * FROM assessment_dimension_scores WHERE assessment_id = ?', [assessmentId]);

    // Build report
    const reportId = `report-${uuidv4()}`;
    const maturityLabels: Record<number, string> = {
      1: 'Initial',
      2: 'Developing',
      3: 'Defined',
      4: 'Managed',
      5: 'Optimizing',
    };

    const report: GeneratedReport = {
      id: reportId,
      type: 'assessment',
      title: `${assessment.framework} Assessment Report: ${assessment.name}`,
      executiveSummary: this.generateExecutiveSummary(assessment, dimensionScores || [], language),
      sections: this.generateAssessmentSections(assessment, dimensionScores || [], language),
      generatedAt: new Date().toISOString(),
      language,
    };

    // Update assessment report record
    await db.run(
      `UPDATE assessment_reports SET 
                executive_summary = ?,
                detailed_analysis = ?,
                updated_at = datetime('now')
             WHERE assessment_id = ?`,
      [report.executiveSummary, JSON.stringify(report.sections), assessmentId]
    );

    return report;
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    assessment: { name: string; framework: string; overall_score: number; maturity_level: number },
    dimensionScores: { dimension_name: string; score: number }[],
    language: string
  ): string {
    const maturityLabels: Record<number, string> = {
      1: 'Initial',
      2: 'Developing',
      3: 'Defined',
      4: 'Managed',
      5: 'Optimizing',
    };

    const topStrengths = dimensionScores
      .filter((d) => d.score >= 3.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((d) => d.dimension_name);

    const topGaps = dimensionScores
      .filter((d) => d.score < 3)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2)
      .map((d) => d.dimension_name);

    // Generate in requested language (simplified - should use i18n)
    if (language === 'pl') {
      return (
        `Ocena ${assessment.framework} "${assessment.name}" została zakończona z wynikiem ${assessment.overall_score?.toFixed(1) || 'N/A'} / 5.0 ` +
        `(Poziom dojrzałości: ${maturityLabels[assessment.maturity_level] || 'N/A'}). ` +
        (topStrengths.length > 0 ? `Mocne strony: ${topStrengths.join(', ')}. ` : '') +
        (topGaps.length > 0 ? `Obszary do poprawy: ${topGaps.join(', ')}.` : '')
      );
    }

    return (
      `The ${assessment.framework} assessment "${assessment.name}" has been completed with an overall score of ${assessment.overall_score?.toFixed(1) || 'N/A'} / 5.0 ` +
      `(Maturity Level: ${maturityLabels[assessment.maturity_level] || 'N/A'}). ` +
      (topStrengths.length > 0 ? `Key strengths: ${topStrengths.join(', ')}. ` : '') +
      (topGaps.length > 0 ? `Areas for improvement: ${topGaps.join(', ')}.` : '')
    );
  }

  /**
   * Generate assessment sections
   */
  private generateAssessmentSections(
    assessment: { framework: string; overall_score: number },
    dimensionScores: {
      dimension_id: string;
      dimension_name: string;
      score: number;
      max_score: number;
    }[],
    language: string
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // Results by Dimension section
    const dimensionSection: ReportSection = {
      id: 'results-by-dimension',
      title: language === 'pl' ? 'Wyniki według wymiarów' : 'Results by Dimension',
      content: '',
      charts: [
        {
          type: 'radar',
          title: 'Dimension Scores',
          data: {
            labels: dimensionScores.map((d) => d.dimension_name),
            values: dimensionScores.map((d) => d.score),
            maxValue: 5,
          },
        },
      ],
      tables: [
        {
          title: 'Dimension Breakdown',
          headers: ['Dimension', 'Score', 'Max', 'Gap'],
          rows: dimensionScores.map((d) => [
            d.dimension_name,
            d.score.toFixed(1),
            d.max_score.toFixed(1),
            (d.max_score - d.score).toFixed(1),
          ]),
        },
      ],
    };
    sections.push(dimensionSection);

    // Recommendations section
    const recommendations: ReportSection = {
      id: 'recommendations',
      title: language === 'pl' ? 'Rekomendacje' : 'Recommendations',
      content: this.generateRecommendations(dimensionScores, language),
    };
    sections.push(recommendations);

    return sections;
  }

  /**
   * Generate recommendations based on gaps
   */
  private generateRecommendations(
    dimensionScores: { dimension_name: string; score: number }[],
    language: string
  ): string {
    const gaps = dimensionScores.filter((d) => d.score < 3.5).sort((a, b) => a.score - b.score);

    if (gaps.length === 0) {
      return language === 'pl'
        ? 'Organizacja wykazuje silną dojrzałość we wszystkich wymiarach. Kontynuuj doskonalenie.'
        : 'The organization shows strong maturity across all dimensions. Continue optimization efforts.';
    }

    const recs = gaps.slice(0, 3).map((g, i) => {
      if (language === 'pl') {
        return `${i + 1}. Priorytet: Poprawa wymiaru "${g.dimension_name}" (obecny wynik: ${g.score.toFixed(1)}/5.0)`;
      }
      return `${i + 1}. Priority: Improve "${g.dimension_name}" dimension (current score: ${g.score.toFixed(1)}/5.0)`;
    });

    return recs.join('\n\n');
  }

  /**
   * Generate project report
   */
  private async generateProjectReport(
    projectId: string,
    language: string,
    orgId: string
  ): Promise<GeneratedReport> {
    const db = await this.getDb();

    const project = await db.get<{
      id: string;
      name: string;
      description?: string | null;
      status?: string | null;
      start_date?: string | null;
      end_date?: string | null;
    }>(
      'SELECT * FROM projects WHERE id = ? AND organization_id = ?',
      [projectId, orgId]
    );

    if (!project) {
      throw new Error('Project not found');
    }

    const decisions = await db.all<{
      title: string;
      deadline: string | null;
      status: string;
    }>(
      `SELECT title, deadline, status FROM decisions 
       WHERE project_id = ? AND organization_id = ? AND status IN ('pending', 'escalated')`,
      [projectId, orgId]
    );

    const initiativeCounts = await db.all<{ status: string; count: number }>(
      `SELECT UPPER(status) as status, COUNT(*) as count
       FROM initiatives
       WHERE project_id = ? AND organization_id = ?
       GROUP BY UPPER(status)`,
      [projectId, orgId]
    );
    const initiativeSummary = initiativeCounts.length
      ? initiativeCounts.map((row) => `${row.status}: ${row.count}`).join(', ')
      : 'No initiatives.';

    return {
      id: `report-${uuidv4()}`,
      type: 'project',
      title: `Project Report: ${project.name}`,
      executiveSummary:
        language === 'pl'
          ? `Raport statusu dla projektu ${project.name}.`
          : `Status report for project ${project.name}.`,
      sections: [
        {
          id: 'overview',
          title: language === 'pl' ? 'Podsumowanie projektu' : 'Project Overview',
          content: [
            project.description ? `Description: ${project.description}` : null,
            project.status ? `Status: ${String(project.status).toUpperCase()}` : null,
            project.start_date ? `Start: ${project.start_date}` : null,
            project.end_date ? `End: ${project.end_date}` : null,
          ]
            .filter(Boolean)
            .join('\n') || `Project ${project.name}.`,
        },
        {
          id: 'initiative-status',
          title: language === 'pl' ? 'Status inicjatyw' : 'Initiatives Status',
          content: initiativeSummary,
        },
        {
          id: 'decisions-required',
          title: language === 'pl' ? 'Decyzje wymagane' : 'Decisions Required',
          content: this.formatDecisions(decisions || []),
        },
        {
          id: 'escalations',
          title: language === 'pl' ? 'Eskalacje' : 'Escalations',
          content: this.formatEscalations(decisions || []),
        },
      ],
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  /**
   * Generate portfolio report
   */
  private async generatePortfolioReport(orgId: string, language: string): Promise<GeneratedReport> {
    const db = await this.getDb();
    const projectCountRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM projects WHERE organization_id = ?`,
      [orgId]
    );
    const initiativeCountRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM initiatives WHERE organization_id = ?`,
      [orgId]
    );
    const initiativeStatusRows = await db.all<{ status: string; count: number }>(
      `SELECT UPPER(status) as status, COUNT(*) as count
       FROM initiatives
       WHERE organization_id = ?
       GROUP BY UPPER(status)`,
      [orgId]
    );
    const decisionCountRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM decisions WHERE organization_id = ? AND status IN ('pending', 'escalated')`,
      [orgId]
    );
    const escalatedCountRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM decisions WHERE organization_id = ? AND status = 'escalated'`,
      [orgId]
    );

    return {
      id: `report-${uuidv4()}`,
      type: 'portfolio',
      title: 'Portfolio Overview Report',
      executiveSummary:
        language === 'pl' ? 'Status portfela w skali organizacji.' : 'Organization-wide portfolio status.',
      sections: [
        {
          id: 'portfolio-summary',
          title: language === 'pl' ? 'Podsumowanie portfela' : 'Portfolio Summary',
          content: `Projects: ${projectCountRow?.count || 0}, Initiatives: ${
            initiativeCountRow?.count || 0
          }, Pending decisions: ${decisionCountRow?.count || 0}, Escalated: ${
            escalatedCountRow?.count || 0
          }.`,
        },
        {
          id: 'initiative-status',
          title: language === 'pl' ? 'Status inicjatyw' : 'Initiatives Status',
          content: initiativeStatusRows.length
            ? initiativeStatusRows.map((row) => `${row.status}: ${row.count}`).join(', ')
            : 'No initiatives.',
        },
      ],
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  /**
   * Generate initiative report
   */
  private async generateInitiativeReport(
    initiativeId: string,
    language: string,
    orgId: string
  ): Promise<GeneratedReport> {
    const db = await this.getDb();
    const initiative = await db.get<{
      id: string;
      title?: string | null;
      name?: string | null;
      summary?: string | null;
      status?: string | null;
      progress?: number | null;
      project_id?: string | null;
      planned_start_date?: string | null;
      planned_end_date?: string | null;
    }>(
      `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
      [initiativeId, orgId]
    );
    if (!initiative) {
      throw new Error('Initiative not found');
    }

    const decisions = await db.all<{
      title: string;
      deadline: string | null;
      status: string;
    }>(
      `SELECT title, deadline, status FROM decisions 
       WHERE initiative_id = ? AND organization_id = ? AND status IN ('pending', 'escalated')`,
      [initiativeId, orgId]
    );

    const taskCounts = await db.all<{ status: string; count: number }>(
      `SELECT UPPER(status) as status, COUNT(*) as count
       FROM tasks
       WHERE initiative_id = ? AND organization_id = ?
       GROUP BY UPPER(status)`,
      [initiativeId, orgId]
    );

    const initiativeName = initiative.title || initiative.name || 'Initiative';
    const taskSummary = taskCounts.length
      ? taskCounts.map((row) => `${row.status}: ${row.count}`).join(', ')
      : 'No tasks.';

    return {
      id: `report-${uuidv4()}`,
      type: 'initiative',
      title: `Initiative Report: ${initiativeName}`,
      executiveSummary:
        language === 'pl'
          ? `Raport dla inicjatywy ${initiativeName}.`
          : `Report for initiative ${initiativeName}.`,
      sections: [
        {
          id: 'initiative-summary',
          title: language === 'pl' ? 'Podsumowanie inicjatywy' : 'Initiative Summary',
          content: [
            initiative.summary ? `Summary: ${initiative.summary}` : null,
            initiative.status ? `Status: ${String(initiative.status).toUpperCase()}` : null,
            initiative.progress !== null && initiative.progress !== undefined
              ? `Progress: ${initiative.progress}%`
              : null,
            initiative.planned_start_date ? `Start: ${initiative.planned_start_date}` : null,
            initiative.planned_end_date ? `End: ${initiative.planned_end_date}` : null,
          ]
            .filter(Boolean)
            .join('\n') || `Initiative ${initiativeName} overview.`,
        },
        {
          id: 'task-status',
          title: language === 'pl' ? 'Status zadań' : 'Task Status',
          content: taskSummary,
        },
        {
          id: 'decisions-required',
          title: language === 'pl' ? 'Decyzje wymagane' : 'Decisions Required',
          content: this.formatDecisions(decisions || []),
        },
        {
          id: 'escalations',
          title: language === 'pl' ? 'Eskalacje' : 'Escalations',
          content: this.formatEscalations(decisions || []),
        },
      ],
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  /**
   * Create public link for report
   */
  async createPublicLink(params: PublicLinkParams): Promise<{
    linkId: string;
    linkUrl: string;
    expiresAt: string | null;
  }> {
    const db = await this.getDb();
    const linkId = uuidv4();
    const linkToken = crypto.randomBytes(32).toString('hex');

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const passwordHash = params.password
      ? crypto.createHash('sha256').update(params.password).digest('hex')
      : null;

    await db.run(
      `INSERT INTO report_public_links (
                id, report_id, report_type, organization_id, link_token,
                password_hash, expires_at, show_company_logo, show_consultinity_branding,
                custom_message, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        linkId,
        params.reportId,
        params.reportType,
        params.organizationId,
        linkToken,
        passwordHash,
        expiresAt,
        params.showCompanyLogo !== false ? 1 : 0,
        params.showConsultinityBranding !== false ? 1 : 0,
        params.customMessage || null,
        params.userId,
      ]
    );

    // Base URL would come from config
    const linkUrl = `/reports/public/${linkToken}`;

    logger.info(`[ReportGenerationService] Created public link: ${linkId}`);

    return {
      linkId,
      linkUrl,
      expiresAt,
    };
  }

  /**
   * Get report by public link token
   */
  async getPublicReport(
    linkToken: string,
    password?: string
  ): Promise<{
    report: GeneratedReport | null;
    error?: string;
  }> {
    const db = await this.getDb();

    const link = await db.get<{
      id: string;
      report_id: string;
      report_type: string;
      organization_id: string;
      password_hash: string | null;
      expires_at: string | null;
      revoked_at: string | null;
    }>('SELECT * FROM report_public_links WHERE link_token = ?', [linkToken]);

    if (!link) {
      return { report: null, error: 'Link not found' };
    }

    if (link.revoked_at) {
      return { report: null, error: 'Link has been revoked' };
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return { report: null, error: 'Link has expired' };
    }

    if (link.password_hash) {
      if (!password) {
        return { report: null, error: 'Password required' };
      }
      const providedHash = crypto.createHash('sha256').update(password).digest('hex');
      if (providedHash !== link.password_hash) {
        return { report: null, error: 'Invalid password' };
      }
    }

    // Increment view count
    await db.run(
      `UPDATE report_public_links SET view_count = view_count + 1, last_viewed_at = datetime('now') WHERE id = ?`,
      [link.id]
    );

    // Generate and return report
    const report = await this.generateReport(
      {
        reportType: link.report_type as any,
        sourceId: link.report_id,
      },
      link.organization_id
    );

    return { report };
  }

  /**
   * Export report to format
   */
  async exportReport(
    reportId: string,
    format: 'pdf' | 'pptx' | 'docx' | 'xlsx',
    userId: string
  ): Promise<{ exportId: string; filePath: string }> {
    const db = await this.getDb();
    const exportId = uuidv4();

    const userRow = await db.get<{ organization_id: string }>(
      `SELECT organization_id FROM users WHERE id = ?`,
      [userId]
    );
    if (!userRow?.organization_id) {
      throw new Error('User organization not found');
    }

    const orgId = userRow.organization_id;
    const assessment = await db.get<{ id: string }>(
      `SELECT id FROM assessments WHERE id = ? AND organization_id = ?`,
      [reportId, orgId]
    );
    const project = await db.get<{ id: string }>(
      `SELECT id FROM projects WHERE id = ? AND organization_id = ?`,
      [reportId, orgId]
    );
    const initiative = await db.get<{ id: string }>(
      `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
      [reportId, orgId]
    );

    const reportType: ReportGenerationParams['reportType'] = assessment
      ? 'assessment'
      : project
        ? 'project'
        : initiative
          ? 'initiative'
          : 'portfolio';

    const report = await this.generateReport(
      {
        reportType,
        sourceId: reportType === 'portfolio' ? orgId : reportId,
      },
      orgId
    );

    const exportDir = await this.ensureExportDir();
    const fileName = `${exportId}.${format}`;
    const absolutePath = path.join(exportDir, fileName);
    const publicPath = `/exports/reports/${fileName}`;

    if (format === 'pdf') {
      await this.writePdfReport(report, absolutePath);
    } else if (format === 'pptx') {
      await this.writePptxReport(report, absolutePath);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    await db.run(
      `INSERT INTO report_exports (id, report_id, report_type, format, file_path, exported_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [exportId, reportId, reportType, format, publicPath, userId]
    );

    logger.info(`[ReportGenerationService] Export queued: ${exportId} (${format})`);

    return { exportId, filePath: publicPath };
  }

  private async writePdfReport(report: GeneratedReport, filePath: string): Promise<void> {
    const doc = new PDFDocument({ margin: 48 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text(report.title || 'Report');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#555555');
    doc.text(`Generated: ${report.generatedAt}`);
    doc.text(`Language: ${report.language}`);
    doc.moveDown();

    doc.fillColor('#000000').fontSize(13).text('Executive Summary');
    doc.fontSize(11).text(report.executiveSummary || 'No summary available.');
    doc.moveDown();

    report.sections.forEach((section) => {
      doc.fontSize(13).fillColor('#000000').text(section.title);
      doc.fontSize(11).fillColor('#333333').text(section.content || 'No content.');
      doc.moveDown();
    });

    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private async writePptxReport(report: GeneratedReport, filePath: string): Promise<void> {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    const titleSlide = pptx.addSlide();
    titleSlide.addText(report.title || 'Report', {
      x: 0.5,
      y: 0.6,
      w: 12.3,
      h: 1,
      fontSize: 32,
      bold: true,
    });
    titleSlide.addText(report.executiveSummary || 'Executive summary', {
      x: 0.5,
      y: 1.8,
      w: 12.3,
      h: 3.5,
      fontSize: 16,
      color: '666666',
    });

    report.sections.forEach((section) => {
      const slide = pptx.addSlide();
      slide.addText(section.title, {
        x: 0.5,
        y: 0.4,
        w: 12.3,
        h: 0.6,
        fontSize: 22,
        bold: true,
      });
      slide.addText(section.content || 'No content.', {
        x: 0.5,
        y: 1.2,
        w: 12.3,
        h: 5.0,
        fontSize: 14,
        color: '444444',
      });
    });

    await pptx.writeFile({ fileName: filePath });
  }
}

// Export singleton
const reportGenerationService = new ReportGenerationService();
export default reportGenerationService;

// Named exports
export const generateReport = (params: ReportGenerationParams, orgId: string) =>
  reportGenerationService.generateReport(params, orgId);
export const createPublicLink = (params: PublicLinkParams) =>
  reportGenerationService.createPublicLink(params);
export const getPublicReport = (linkToken: string, password?: string) =>
  reportGenerationService.getPublicReport(linkToken, password);
export const exportReport = (
  reportId: string,
  format: 'pdf' | 'pptx' | 'docx' | 'xlsx',
  userId: string
) => reportGenerationService.exportReport(reportId, format, userId);
