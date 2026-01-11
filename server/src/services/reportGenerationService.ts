/**
 * Report Generation Service
 * FLOW-REPORT-001: Generate, export, and share reports
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

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
   * Generate project report (stub)
   */
  private async generateProjectReport(
    projectId: string,
    language: string,
    orgId: string
  ): Promise<GeneratedReport> {
    const db = await this.getDb();

    const project = await db.get<{ id: string; name: string }>(
      'SELECT * FROM projects WHERE id = ? AND organization_id = ?',
      [projectId, orgId]
    );

    if (!project) {
      throw new Error('Project not found');
    }

    return {
      id: `report-${uuidv4()}`,
      type: 'project',
      title: `Project Report: ${project.name}`,
      executiveSummary: `Status report for project ${project.name}.`,
      sections: [],
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  /**
   * Generate portfolio report (stub)
   */
  private async generatePortfolioReport(orgId: string, language: string): Promise<GeneratedReport> {
    return {
      id: `report-${uuidv4()}`,
      type: 'portfolio',
      title: 'Portfolio Overview Report',
      executiveSummary: 'Organization-wide portfolio status.',
      sections: [],
      generatedAt: new Date().toISOString(),
      language,
    };
  }

  /**
   * Generate initiative report (stub)
   */
  private async generateInitiativeReport(
    initiativeId: string,
    language: string,
    orgId: string
  ): Promise<GeneratedReport> {
    return {
      id: `report-${uuidv4()}`,
      type: 'initiative',
      title: 'Initiative Report',
      executiveSummary: `Report for initiative ${initiativeId}.`,
      sections: [],
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

    // For now, just record the export request
    // Actual file generation would use pdfkit, pptxgenjs, etc.
    const filePath = `/exports/${reportId}.${format}`;

    await db.run(
      `INSERT INTO report_exports (id, report_id, report_type, format, file_path, exported_by)
             VALUES (?, ?, 'assessment', ?, ?, ?)`,
      [exportId, reportId, format, filePath, userId]
    );

    logger.info(`[ReportGenerationService] Export queued: ${exportId} (${format})`);

    return { exportId, filePath };
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
