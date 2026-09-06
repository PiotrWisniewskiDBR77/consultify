// @ts-nocheck
/**
 * Management Reports Service
 * Generates management reports, exports, and approval workflow
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import managementReportRepository from '../repositories/ManagementReportRepository.js';
import { all, get, run } from '../utils/DbPromise.js';
import { registerPdfFonts } from '../utils/pdfFonts.js';
import { parseMaybeJson } from '../utils/pgFlags.js';
import { exportsDir } from '../utils/storagePaths.js';

type ExportDeps = {
  PDFDocument: any | null;
  PptxGenJS: any | null;
  ExcelJS: any | null;
};

let exportDepsPromise: Promise<ExportDeps> | null = null;
async function loadExportDeps(): Promise<ExportDeps> {
  if (exportDepsPromise) return exportDepsPromise;
  exportDepsPromise = (async () => {
    let PDFDocument: any | null = null;
    let PptxGenJS: any | null = null;
    let ExcelJS: any | null = null;

    try {
      const mod = await import('pdfkit');
      PDFDocument = (mod as any).default || mod;
    } catch {
      PDFDocument = null;
    }

    try {
      const mod = await import('pptxgenjs');
      PptxGenJS = (mod as any).default || mod;
    } catch {
      PptxGenJS = null;
    }

    try {
      const mod = await import('exceljs');
      ExcelJS = (mod as any).default || mod;
    } catch {
      ExcelJS = null;
    }

    return { PDFDocument, PptxGenJS, ExcelJS };
  })();
  return exportDepsPromise;
}

function dependencyMissing(dep: 'pdfkit' | 'pptxgenjs' | 'exceljs'): Error {
  const err = new Error(`Dependency missing: ${dep}`);
  (err as any).code = 'DEPENDENCY_MISSING';
  (err as any).dependency = dep;
  (err as any).status = 503;
  return err;
}

// Tenant-scoping helper (DEC-131 P1-4): a foreign report must be
// indistinguishable from a missing one — 404, never a leak of existence,
// never a 503 from something downstream running first. Callers resolve
// this BEFORE any read or write on the report.
function reportNotFoundError(): Error {
  const err = new Error('Report not found');
  (err as any).code = 'NOT_FOUND';
  (err as any).status = 404;
  return err;
}

// DEC-140: same shape as reportNotFoundError() above — a project in a
// foreign org and a project that does not exist must be indistinguishable
// (404, never 403) so the endpoint never confirms a foreign project's
// existence to the caller.
function projectNotFoundError(): Error {
  const err = new Error('Project not found');
  (err as any).code = 'NOT_FOUND';
  (err as any).status = 404;
  return err;
}

const DEFAULT_PERIODS: Record<string, number> = {
  TEAM_MEETING: 7,
  TEAM_WEEKLY: 7,
  STEERING_COMMITTEE: 30,
  PORTFOLIO_HEALTH: 30,
  RAID: 30,
};

const PMO_MAPPINGS = {
  pmoDomain: 'PERFORMANCE_MONITORING',
  iso21500Mapping: 'Project Performance Measurement (Clause 4.4.22)',
  pmbokMapping: 'Measurement Performance Domain',
  prince2Mapping: 'Highlight Report / Progress Theme',
};

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const isUnitTest = () => process.env.VITEST === 'true' && process.env.MOCK_DB !== 'true';

const getPeriodWindow = (periodDays?: number, customStart?: string, customEnd?: string) => {
  const end = customEnd ? new Date(customEnd) : new Date();
  const start = customStart
    ? new Date(customStart)
    : new Date(end.getTime() - (periodDays || 7) * 24 * 60 * 60 * 1000);
  return {
    periodStart: formatDate(start),
    periodEnd: formatDate(end),
  };
};

const computeRag = (values: { red?: number; amber?: number } = {}) => {
  if ((values.red || 0) > 0) return 'RED';
  if ((values.amber || 0) > 0) return 'AMBER';
  return 'GREEN';
};

const normalizeSeverity = (severity: string | null | undefined) => {
  if (!severity) return 'MEDIUM';
  const upper = severity.toUpperCase();
  if (upper === 'CRITICAL') return 'CRITICAL';
  if (upper === 'HIGH') return 'HIGH';
  if (upper === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
};

class ManagementReportsService {
  // Tenant-scoping helper (DEC-131 P1-4): resolves the report AND verifies
  // it belongs to organizationId in one query, before any other logic runs
  // (dependency checks, writes, ...). Missing report and foreign-tenant
  // report both throw the same 404 — no existence leak via status code.
  private async assertReportInOrganization(reportId: string, organizationId?: string) {
    if (!organizationId) throw reportNotFoundError();
    const row = await managementReportRepository.getReportByIdForOrganization(
      reportId,
      organizationId
    );
    if (!row) throw reportNotFoundError();
    return row;
  }

  // DEC-140: mirrors assertReportInOrganization() above, but gates
  // generateReport() itself. Every report-generation branch (TEAM_MEETING,
  // TEAM_WEEKLY, STEERING_COMMITTEE scope=PROJECT, RAID) eventually reads
  // project-scoped data — some via getProjectById() (unscoped by design,
  // see repository note), RAID additionally via raw SQL keyed on
  // project_id alone. Neither of those checks tenancy on its own, so this
  // must run BEFORE generateReport() dispatches to any branch, using ONLY
  // the organizationId resolved from the verified token (never body/query).
  private async assertProjectInOrganization(projectId: string, organizationId?: string) {
    if (!organizationId) throw projectNotFoundError();
    const project = await managementReportRepository.getProjectByIdForOrganization(
      projectId,
      organizationId
    );
    if (!project) throw projectNotFoundError();
    return project;
  }

  private async ensureExportDir(): Promise<string> {
    const exportDir = exportsDir('management-reports');
    return exportDir;
  }

  private buildSummaryLines(report: any): string[] {
    const lines: string[] = [];
    if (report?.title) lines.push(`Title: ${report.title}`);
    if (report?.reportType) lines.push(`Type: ${report.reportType}`);
    if (report?.scope) lines.push(`Scope: ${report.scope}`);
    if (report?.periodStart && report?.periodEnd) {
      lines.push(`Period: ${report.periodStart} - ${report.periodEnd}`);
    }
    if (report?.content?.executiveSummary) {
      lines.push(`Executive Summary: ${report.content.executiveSummary}`);
    }
    return lines;
  }

  private async writePdfReport(report: any, filePath: string): Promise<void> {
    const { PDFDocument } = await loadExportDeps();
    if (!PDFDocument) throw dependencyMissing('pdfkit');

    const doc = new PDFDocument({ margin: 48 });
    // DEC-132/133: default pdfkit Helvetica has no Polish diacritics.
    registerPdfFonts(doc);
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text(report.title || 'Management Report');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#555555');
    this.buildSummaryLines(report).forEach((line) => doc.text(line));

    doc.moveDown();
    doc.fillColor('#000000').fontSize(13).text('Decisions Required');
    const decisions = report?.content?.decisionsRequired || [];
    if (decisions.length === 0) {
      doc.fontSize(11).text('None');
    } else {
      decisions.slice(0, 10).forEach((decision: any, index: number) => {
        doc
          .fontSize(11)
          .text(
            `${index + 1}. ${decision.title || 'Decision'} (Owner: ${decision.ownerName || 'TBD'})`
          );
      });
    }

    doc.moveDown();
    doc.fontSize(13).text('Key Highlights');
    const highlights = report?.aiNarrative ? [report.aiNarrative] : [];
    if (highlights.length === 0) {
      doc.fontSize(11).text('No highlights available.');
    } else {
      highlights.forEach((item: string) => doc.fontSize(11).text(item));
    }

    doc.end();
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  }

  private async writePptxReport(report: any, filePath: string): Promise<void> {
    const { PptxGenJS } = await loadExportDeps();
    if (!PptxGenJS) throw dependencyMissing('pptxgenjs');

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';

    const titleSlide = pptx.addSlide();
    titleSlide.addText(report.title || 'Management Report', {
      x: 0.5,
      y: 1.0,
      w: 12.5,
      h: 1.0,
      fontSize: 32,
    });
    titleSlide.addText(this.buildSummaryLines(report).join('\n'), {
      x: 0.8,
      y: 2.2,
      w: 12.0,
      h: 2.5,
      fontSize: 14,
      color: '666666',
    });

    const decisionsSlide = pptx.addSlide();
    decisionsSlide.addText('Decisions Required', {
      x: 0.6,
      y: 0.6,
      w: 12.5,
      h: 0.6,
      fontSize: 24,
    });
    const decisions = report?.content?.decisionsRequired || [];
    const decisionLines =
      decisions.length === 0
        ? ['None']
        : decisions.slice(0, 10).map((decision: any, index: number) => {
            const owner = decision.ownerName || decision.requestedByName || 'TBD';
            return `${index + 1}. ${decision.title || 'Decision'} (${owner})`;
          });
    decisionsSlide.addText(decisionLines.join('\n'), {
      x: 0.8,
      y: 1.6,
      w: 12.0,
      h: 4.5,
      fontSize: 16,
      color: '333333',
    });

    const narrativeSlide = pptx.addSlide();
    narrativeSlide.addText('Executive Narrative', {
      x: 0.6,
      y: 0.6,
      w: 12.5,
      h: 0.6,
      fontSize: 24,
    });
    narrativeSlide.addText(
      report?.aiNarrative || report?.content?.executiveSummary || 'No narrative available.',
      {
        x: 0.8,
        y: 1.6,
        w: 12.0,
        h: 5.0,
        fontSize: 16,
        color: '333333',
      }
    );

    await pptx.writeFile({ fileName: filePath });
  }

  private async writeXlsxReport(report: any, filePath: string): Promise<void> {
    const { ExcelJS } = await loadExportDeps();
    if (!ExcelJS) throw dependencyMissing('exceljs');
    const workbook = new ExcelJS.Workbook();
    const summary = workbook.addWorksheet('Summary');
    summary.addRow(['Summary']);
    for (const line of this.buildSummaryLines(report)) summary.addRow([line]);
    const content = report?.content && typeof report.content === 'object' ? report.content : {};
    const used = new Set(['Summary']);
    for (const [rawName, section] of Object.entries(content)) {
      let name =
        String(rawName)
          .replace(/[\\/*?:[\]]/g, '_')
          .slice(0, 31) || 'Section';
      let suffix = 1;
      while (used.has(name)) name = `${name.slice(0, 27)}_${suffix++}`;
      used.add(name);
      const sheet = workbook.addWorksheet(name);
      sheet.addRow(['Value']);
      if (Array.isArray(section)) {
        for (const item of section)
          sheet.addRow([typeof item === 'string' ? item : JSON.stringify(item)]);
      } else if (section !== null && section !== undefined && section !== '') {
        sheet.addRow([typeof section === 'string' ? section : JSON.stringify(section)]);
      }
    }
    await workbook.xlsx.writeFile(filePath);
  }
  async generateReport(options) {
    // DEC-140 gate: runs before ANY branch below touches project data
    // (including RAID's raw SQL path, which bypasses getProjectById
    // entirely). A projectId that does not resolve inside options.organizationId
    // — foreign-tenant or nonexistent — is rejected here, uniformly, as 404.
    if (options.projectId) {
      await this.assertProjectInOrganization(options.projectId, options.organizationId);
    }
    switch (options.reportType) {
      case 'TEAM_MEETING':
      case 'TEAM_WEEKLY':
        return this.generateTeamMeetingReport(options.projectId, options);
      case 'STEERING_COMMITTEE':
        return this.generateSteeringCommitteeReport(options);
      case 'PORTFOLIO_HEALTH':
        return this.generatePortfolioHealthReport(options);
      case 'RAID':
        return this.generateRaidReport(options);
      default:
        throw new Error('Unsupported report type');
    }
  }

  async generateTeamMeetingReport(projectId, options) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    const project = await managementReportRepository.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const periodDays = options.periodDays || DEFAULT_PERIODS[options.reportType || 'TEAM_MEETING'];
    const { periodStart, periodEnd } = getPeriodWindow(
      periodDays,
      options.customPeriodStart,
      options.customPeriodEnd
    );

    const [
      taskStats,
      initiativeStats,
      decisionStats,
      completedWork,
      workInProgress,
      blockers,
      pendingDecisions,
      upcomingTasks,
    ] = await Promise.all([
      managementReportRepository.getTaskStatistics(projectId),
      managementReportRepository.getInitiativeStatistics(projectId),
      managementReportRepository.getDecisionStatistics(projectId),
      managementReportRepository.getCompletedTasks(projectId, periodStart, periodEnd),
      managementReportRepository.getInProgressTasks(projectId),
      managementReportRepository.getBlockedTasks(projectId),
      managementReportRepository.getPendingProjectDecisions(projectId),
      managementReportRepository.getUpcomingTasks(projectId, formatDate(new Date())),
    ]);

    const progressPercent = taskStats?.total
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

    const healthStatus = computeRag({
      red: taskStats?.blocked || 0,
      amber: taskStats?.overdue || 0,
    });

    const statusSummary = {
      progressPercent,
      healthStatus,
      tasksTotal: taskStats?.total || 0,
      tasksCompleted: taskStats?.completed || 0,
      tasksInProgress: taskStats?.inProgress || 0,
      tasksBlocked: taskStats?.blocked || 0,
      tasksOverdue: taskStats?.overdue || 0,
      initiativesTotal: initiativeStats?.total || 0,
      initiativesOnTrack: initiativeStats?.onTrack || 0,
      initiativesAtRisk: initiativeStats?.atRisk || 0,
      decisionsApproved: decisionStats?.approved || 0,
      decisionsPending: decisionStats?.pending || 0,
    };

    const content = {
      statusSummary,
      completedWork: (completedWork || []).map((item) => ({
        id: item.id,
        type: 'TASK',
        title: item.title,
        completedAt: item.completedAt,
        completedBy: item.completedById,
        completedByName: item.completedByName,
        projectId,
        projectName: project.name,
        initiativeId: item.initiativeId,
        initiativeTitle: item.initiativeTitle,
      })),
      workInProgress: (workInProgress || []).map((item) => ({
        id: item.id,
        type: 'TASK',
        title: item.title,
        assigneeId: item.assigneeId,
        assigneeName: item.assigneeName,
        progressPercent: item.progress || 0,
        dueDate: item.due_date,
        daysUntilDue: item.due_date
          ? Math.ceil((new Date(item.due_date) - Date.now()) / 86400000)
          : 0,
        status: item.progress >= 80 ? 'GREEN' : item.progress >= 50 ? 'AMBER' : 'RED',
        projectId,
        projectName: project.name,
      })),
      blockers: (blockers || []).map((item) => ({
        id: item.id,
        type: 'TASK',
        title: item.title,
        blockedReason: item.blocked_reason || 'Blocked',
        blockedSince: item.updated_at,
        daysBlocked: item.updated_at
          ? Math.ceil((Date.now() - new Date(item.updated_at).getTime()) / 86400000)
          : 0,
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        severity: 'HIGH',
        projectId,
        projectName: project.name,
        suggestedAction: 'Resolve blocker or escalate to PMO',
      })),
      pendingDecisions: (pendingDecisions || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        decisionType: item.decision_type || 'GENERAL',
        status: item.status || 'PENDING',
        ownerId: item.ownerId,
        ownerName: item.ownerName,
        createdAt: item.created_at,
        daysWaiting: item.created_at
          ? Math.ceil((Date.now() - new Date(item.created_at).getTime()) / 86400000)
          : 0,
        urgency: 'MEDIUM',
        projectId,
        projectName: project.name,
      })),
      nextPeriodPlan: (upcomingTasks || []).map((item) => ({
        id: item.id,
        type: 'TASK',
        title: item.title,
        ownerId: item.assigneeId,
        ownerName: item.assigneeName,
        dueDate: item.due_date,
        priority: item.priority,
        projectId,
        projectName: project.name,
      })),
      aiHighlights: [],
      aiConcerns: [],
    };

    const ai = await this.generateAiNarrative({
      reportType: options.reportType,
      scope: 'PROJECT',
      summary: `${project.name} delivered ${statusSummary.tasksCompleted} tasks with ${statusSummary.tasksBlocked} blockers.`,
      aiEnhancement: options.aiEnhancement,
      organizationId: options.organizationId || project.organization_id,
    });

    const report = await this.saveReport({
      reportType: options.reportType || 'TEAM_MEETING',
      scope: 'PROJECT',
      projectId,
      organizationId: options.organizationId || project.organization_id,
      title: `${project.name} ${options.reportType === 'TEAM_WEEKLY' ? 'Team Weekly' : 'Team Meeting'} Report`,
      periodStart,
      periodEnd,
      status: 'DRAFT',
      generatedBy: options.userId,
      content,
      aiNarrative: ai.narrative,
      aiWarnings: ai.warnings,
      requiresApproval: options.requiresApproval,
      approvalConfig: options.approvalConfig,
    });

    return report;
  }

  async generateSteeringCommitteeReport(options) {
    const scope = options.scope || 'PORTFOLIO';
    const periodDays = options.periodDays || DEFAULT_PERIODS.STEERING_COMMITTEE;
    const { periodStart, periodEnd } = getPeriodWindow(
      periodDays,
      options.customPeriodStart,
      options.customPeriodEnd
    );

    const organizationId = options.organizationId;
    const projectId = scope === 'PROJECT' ? options.projectId : undefined;

    const project = projectId ? await managementReportRepository.getProjectById(projectId) : null;
    const projects =
      scope === 'PORTFOLIO'
        ? await managementReportRepository.getActiveProjects(organizationId)
        : project
          ? [project]
          : [];

    const [riskStats, budgetMetrics, kpis, risksAndIssues, decisionsRequired, milestones, gates] =
      scope === 'PROJECT'
        ? await Promise.all([
            managementReportRepository.getRiskStatistics(projectId),
            managementReportRepository.getBudgetMetrics(projectId),
            managementReportRepository.getCustomKPIs(projectId),
            managementReportRepository.getActiveRisksAndIssues(projectId),
            managementReportRepository.getBoardDecisions(projectId),
            managementReportRepository.getMilestones(projectId),
            managementReportRepository.getStageGates(projectId),
          ])
        : [null, null, [], [], [], [], []];

    const scheduleStatus = computeRag({
      red: (riskStats?.critical || 0) > 0 ? 1 : 0,
      amber: (riskStats?.high || 0) > 0 ? 1 : 0,
    });
    const budgetStatus =
      budgetMetrics?.variance_percent && budgetMetrics.variance_percent < -10 ? 'RED' : 'GREEN';

    const overallStatus = {
      schedule: {
        category: 'SCHEDULE',
        status: scheduleStatus,
        trend: 'STABLE',
        summary: 'Delivery timeline status',
      },
      budget: {
        category: 'BUDGET',
        status: budgetStatus,
        trend: 'STABLE',
        summary: 'Budget variance within tolerance',
      },
      scope: {
        category: 'SCOPE',
        status: 'GREEN',
        trend: 'STABLE',
        summary: 'Scope stable',
      },
      risk: {
        category: 'RISK',
        status: computeRag({
          red: riskStats?.critical || 0,
          amber: riskStats?.high || 0,
        }),
        trend: 'DECLINING',
        summary: 'Open critical risks tracked',
      },
      overallHealth: computeRag({
        red: scheduleStatus === 'RED' || budgetStatus === 'RED' ? 1 : 0,
        amber: scheduleStatus === 'AMBER' || budgetStatus === 'AMBER' ? 1 : 0,
      }),
      lastUpdated: new Date().toISOString(),
    };

    const content = {
      executiveSummary:
        scope === 'PORTFOLIO'
          ? `Portfolio overview for ${projects.length} active initiatives.`
          : `Executive summary for ${project?.name || 'project'}.`,
      overallStatus,
      kpis: (kpis || []).map((kpi) => ({
        id: kpi.id,
        name: kpi.name,
        currentValue: kpi.current_value ?? kpi.currentValue ?? 0,
        targetValue: kpi.target_value ?? kpi.targetValue ?? 0,
        unit: kpi.unit || '',
        status: kpi.status || 'GREY',
        trend: kpi.trend || 'STABLE',
      })),
      risksAndIssues: (risksAndIssues || []).map((item) => ({
        id: item.id,
        type: (item.type || 'RISK').toUpperCase(),
        title: item.title || item.name,
        severity: normalizeSeverity(item.severity),
        owner: item.ownerId || '',
        ownerName: item.ownerName || 'Unassigned',
        status: item.status || 'OPEN',
        detectedAt: item.created_at || item.detected_at || new Date().toISOString(),
        daysOpen: item.created_at
          ? Math.ceil((Date.now() - new Date(item.created_at).getTime()) / 86400000)
          : 0,
        impact: item.impact || 'Medium',
        projectId: item.project_id,
        projectName: item.projectName,
        requiresEscalation: ['CRITICAL', 'HIGH'].includes(normalizeSeverity(item.severity)),
      })),
      decisionsRequired: (decisionsRequired || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        decisionType: item.decision_type || 'STRATEGIC',
        requestedBy: item.requested_by || item.requestedBy,
        requestedByName: item.requestedByName || 'PMO',
        deadline: item.deadline || periodEnd,
        daysUntilDeadline: item.deadline
          ? Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000)
          : 0,
        impact: item.impact || 'High',
        options: [],
        projectId: item.project_id,
        projectName: item.projectName,
        estimatedValue: item.estimated_value,
        currency: item.currency,
      })),
      forecast: {
        nextMilestones: (milestones || []).map((milestone) => ({
          id: milestone.id,
          name: milestone.name,
          plannedDate: milestone.plannedDate,
          status: milestone.status || 'GREY',
          projectId: projectId,
          projectName: project?.name,
        })),
        nextGates: (gates || []).map((gate) => ({
          id: gate.id,
          name: gate.name,
          gateType: gate.gateType,
          plannedDate: gate.plannedDate,
          readiness: gate.status === 'PASSED' ? 'GREEN' : 'AMBER',
          missingCriteria: [],
          projectId: projectId,
          projectName: project?.name,
        })),
        projectedCompletion: periodEnd,
        confidenceLevel: 'MEDIUM',
        forecastNarrative: 'Projected completion aligns with current delivery trajectory.',
      },
      warnings: [],
      auditTrail: {
        reportId: '',
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId,
        generatedByName: '',
        version: '1.0',
        pmoDomain: PMO_MAPPINGS.pmoDomain,
        iso21500Mapping: PMO_MAPPINGS.iso21500Mapping,
        pmbokMapping: PMO_MAPPINGS.pmbokMapping,
        prince2Mapping: PMO_MAPPINGS.prince2Mapping,
        dataSnapshot: {
          projectsIncluded: projects.length,
          tasksAnalyzed: 0,
          initiativesAnalyzed: 0,
          decisionsAnalyzed: decisionsRequired?.length || 0,
          risksAnalyzed: risksAndIssues?.length || 0,
          dataAsOf: new Date().toISOString(),
        },
      },
    };

    const ai = await this.generateAiNarrative({
      reportType: options.reportType,
      scope,
      summary: content.executiveSummary,
      aiEnhancement: options.aiEnhancement,
      organizationId,
    });

    const report = await this.saveReport({
      reportType: 'STEERING_COMMITTEE',
      scope,
      projectId: projectId,
      organizationId: organizationId,
      title:
        scope === 'PORTFOLIO'
          ? 'Steering Committee Portfolio Report'
          : `Steering Committee Report - ${project?.name || 'Project'}`,
      periodStart,
      periodEnd,
      status: 'DRAFT',
      generatedBy: options.userId,
      content,
      aiNarrative: ai.narrative,
      aiWarnings: ai.warnings,
      requiresApproval: options.requiresApproval,
      approvalConfig: options.approvalConfig,
    });

    return report;
  }

  async generatePortfolioHealthReport(options) {
    const periodDays = options.periodDays || DEFAULT_PERIODS.PORTFOLIO_HEALTH;
    const { periodStart, periodEnd } = getPeriodWindow(periodDays);
    const organizationId = options.organizationId;

    const projects = await managementReportRepository.getActiveProjects(organizationId);
    const projectHealth = [];
    let onTrack = 0;
    let atRisk = 0;
    let critical = 0;

    for (const project of projects) {
      const [taskMetrics, riskStats, decisions] = await Promise.all([
        managementReportRepository.getBasicTaskMetrics(project.id),
        managementReportRepository.getRiskStatistics(project.id),
        managementReportRepository.getPendingProjectDecisions(project.id),
      ]);
      const status = computeRag({
        red: (riskStats?.critical || 0) + (taskMetrics?.blocked || 0) > 0 ? 1 : 0,
        amber: (taskMetrics?.overdueTasks || 0) > 0 || (riskStats?.high || 0) > 0 ? 1 : 0,
      });
      if (status === 'GREEN') onTrack += 1;
      if (status === 'AMBER') atRisk += 1;
      if (status === 'RED') critical += 1;

      projectHealth.push({
        projectId: project.id,
        projectName: project.name,
        ownerName: project.owner_name,
        status,
        keyIssues: [],
        nextMilestone: '',
        decisionsRequired: decisions?.length || 0,
      });
    }

    const overallHealth = computeRag({
      red: critical,
      amber: atRisk,
    });

    const content = {
      executiveSummary: `Portfolio health snapshot across ${projects.length} active projects.`,
      portfolioOverview: {
        totalProjects: projects.length,
        onTrack,
        atRisk,
        critical,
        overallHealth,
      },
      healthDrivers: [
        { category: 'SCHEDULE', status: overallHealth, summary: 'Delivery timelines reviewed' },
        { category: 'BUDGET', status: 'GREEN', summary: 'Spending within tolerance' },
        { category: 'RISK', status: overallHealth, summary: 'Critical risks tracked' },
        { category: 'BENEFITS', status: 'AMBER', summary: 'Benefits realization in progress' },
      ],
      projectHealth,
      benefitsSnapshot: {
        totalBenefits: projects.length * 2,
        realizedBenefits: onTrack,
        pipelineBenefits: atRisk + critical,
      },
      economicsSnapshot: {
        plannedBudget: 0,
        actualSpend: 0,
        variancePercent: 0,
      },
      risksAndIssues: [],
      decisionsRequired: [],
      nextPeriodPriorities: [
        'Resolve critical delivery blockers',
        'Confirm next steering decisions',
        'Validate benefits realization targets',
      ],
      warnings: critical > 0 ? ['Critical initiatives require steering escalation.'] : [],
      auditTrail: {
        reportId: '',
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId,
        generatedByName: '',
        version: '1.0',
        pmoDomain: PMO_MAPPINGS.pmoDomain,
        iso21500Mapping: PMO_MAPPINGS.iso21500Mapping,
        pmbokMapping: PMO_MAPPINGS.pmbokMapping,
        prince2Mapping: PMO_MAPPINGS.prince2Mapping,
        dataSnapshot: {
          projectsIncluded: projects.length,
          tasksAnalyzed: 0,
          initiativesAnalyzed: 0,
          decisionsAnalyzed: 0,
          risksAnalyzed: 0,
          dataAsOf: new Date().toISOString(),
        },
      },
    };

    const ai = await this.generateAiNarrative({
      reportType: options.reportType,
      scope: 'PORTFOLIO',
      summary: content.executiveSummary,
      aiEnhancement: options.aiEnhancement,
      organizationId,
    });

    const report = await this.saveReport({
      reportType: 'PORTFOLIO_HEALTH',
      scope: 'PORTFOLIO',
      projectId: undefined,
      organizationId,
      title: 'Portfolio Health Report',
      periodStart,
      periodEnd,
      status: 'DRAFT',
      generatedBy: options.userId,
      content,
      aiNarrative: ai.narrative,
      aiWarnings: ai.warnings,
      requiresApproval: options.requiresApproval,
      approvalConfig: options.approvalConfig,
    });

    return report;
  }

  async generateRaidReport(options) {
    const periodDays = options.periodDays || DEFAULT_PERIODS.RAID;
    const { periodStart, periodEnd } = getPeriodWindow(periodDays);
    const organizationId = options.organizationId;
    const projectId = options.projectId;

    const insights = projectId
      ? await all(
          `SELECT * FROM project_insights WHERE project_id = ? AND category IN ('assumption', 'dependency')`,
          [projectId]
        )
      : [];
    const risks = projectId
      ? await managementReportRepository.getActiveRisksAndIssues(projectId)
      : [];
    const decisions = projectId
      ? await managementReportRepository.getBoardDecisions(projectId)
      : [];

    const assumptions = insights.filter((item) => item.category === 'assumption');
    const dependencies = insights.filter((item) => item.category === 'dependency');

    const escalations = (risks || [])
      .filter((risk) => ['critical', 'CRITICAL', 'high', 'HIGH'].includes(risk.severity))
      .map((risk) => ({
        id: risk.id,
        level: risk.severity?.toUpperCase() === 'CRITICAL' ? 'RED' : 'AMBER',
        reason: risk.title || risk.name,
        ownerName: risk.ownerName,
        dueDate: risk.due_date,
        projectId,
        projectName: risk.projectName,
      }));

    const content = {
      executiveSummary:
        projectId !== undefined
          ? 'RAID summary with current risks and dependencies.'
          : 'Portfolio RAID summary.',
      risks: (risks || []).map((risk) => ({
        id: risk.id,
        type: 'Risk',
        title: risk.title || risk.name,
        description: risk.description || '',
        severity: normalizeSeverity(risk.severity),
        probability: 'Medium',
        ownerId: risk.ownerId,
        status: risk.status || 'Open',
        dueDate: risk.due_date,
        linkedInitiativeId: risk.initiative_id,
        mitigationPlan: risk.mitigation_plan,
      })),
      assumptions: (assumptions || []).map((item) => ({
        id: item.id,
        type: 'Assumption',
        title: item.title,
        description: item.content,
        severity: 'Medium',
        ownerId: item.created_by,
        status: item.status === 'confirmed' ? 'Open' : 'Mitigated',
        dueDate: item.updated_at,
      })),
      issues: (risks || [])
        .filter((risk) => risk.type === 'ISSUE')
        .map((issue) => ({
          id: issue.id,
          type: 'Issue',
          title: issue.title || issue.name,
          description: issue.description || '',
          severity: normalizeSeverity(issue.severity),
          ownerId: issue.ownerId,
          status: issue.status || 'Open',
          dueDate: issue.due_date,
        })),
      dependencies: (dependencies || []).map((item) => ({
        id: item.id,
        type: 'Dependency',
        title: item.title,
        description: item.content,
        severity: 'Low',
        ownerId: item.created_by,
        status: item.status === 'confirmed' ? 'Open' : 'Mitigated',
        dueDate: item.updated_at,
      })),
      decisionsRequired: (decisions || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description || '',
        decisionType: item.decision_type || 'RISK_ACCEPTANCE',
        requestedBy: item.requested_by || item.requestedBy,
        requestedByName: item.requestedByName || 'PMO',
        deadline: item.deadline || periodEnd,
        daysUntilDeadline: item.deadline
          ? Math.ceil((new Date(item.deadline).getTime() - Date.now()) / 86400000)
          : 0,
        impact: item.impact || 'High',
        options: [],
        projectId: projectId,
        projectName: item.projectName,
      })),
      escalations,
      auditTrail: {
        reportId: '',
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId,
        generatedByName: '',
        version: '1.0',
        pmoDomain: PMO_MAPPINGS.pmoDomain,
        iso21500Mapping: PMO_MAPPINGS.iso21500Mapping,
        pmbokMapping: PMO_MAPPINGS.pmbokMapping,
        prince2Mapping: PMO_MAPPINGS.prince2Mapping,
        dataSnapshot: {
          projectsIncluded: projectId ? 1 : 0,
          tasksAnalyzed: 0,
          initiativesAnalyzed: 0,
          decisionsAnalyzed: decisions?.length || 0,
          risksAnalyzed: risks?.length || 0,
          dataAsOf: new Date().toISOString(),
        },
      },
    };

    const ai = await this.generateAiNarrative({
      reportType: options.reportType,
      scope: options.scope || 'PROJECT',
      summary: content.executiveSummary,
      aiEnhancement: options.aiEnhancement,
      organizationId,
    });

    const report = await this.saveReport({
      reportType: 'RAID',
      scope: options.scope || 'PROJECT',
      projectId,
      organizationId,
      title: projectId ? 'Project RAID Report' : 'Portfolio RAID Report',
      periodStart,
      periodEnd,
      status: 'DRAFT',
      generatedBy: options.userId,
      content,
      aiNarrative: ai.narrative,
      aiWarnings: ai.warnings,
      requiresApproval: options.requiresApproval,
      approvalConfig: options.approvalConfig,
    });

    return report;
  }

  async getReport(reportId, organizationId) {
    if (!organizationId) return null;
    const report = await managementReportRepository.getReportByIdForOrganization(
      reportId,
      organizationId
    );
    if (!report) return null;
    if (!isUnitTest() && typeof managementReportRepository.getUser === 'function') {
      const user = report.generated_by
        ? await managementReportRepository.getUser(report.generated_by)
        : null;
      if (user) {
        report.generated_by_name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      }
    }
    return this.mapReport(report);
  }

  async getReportHistory(filters) {
    const { rows, total } = await managementReportRepository.getReports(filters);
    const reports = (rows || []).map((row) => ({
      id: row.id,
      title: row.title,
      reportType: row.report_type,
      scope: row.scope,
      status: row.status,
      generatedBy: row.generated_by,
      generatedByName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      projectName: row.project_name,
      createdAt: row.created_at,
      // DEC-422b/e (06.09): kolumna „Zaktualizowano" w tabeli raportów
      // zarządczych w Menu 2 Wyników. Wiersz i tak przychodzi jako `mr.*`
      // (ManagementReportRepository.getReports) — dokładamy jedno pole do
      // mapowania, zero zmian w zapytaniu i zero nowych tras.
      updatedAt: row.updated_at,
      pdfPath: row.pdf_path,
      pptxPath: row.pptx_path,
    }));
    return { reports, total };
  }

  async updateReport(reportId, updates, userId, organizationId) {
    const report = await this.assertReportInOrganization(reportId, organizationId);
    if (report.status === 'FINAL') {
      throw new Error('Finalized reports cannot be edited');
    }

    const newTitle = updates.title || report.title;
    await run(
      `UPDATE management_reports SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newTitle, reportId]
    );

    await this.createReportVersion(
      reportId,
      report.content,
      report.ai_narrative,
      report.ai_warnings,
      userId,
      'Updated report metadata'
    );

    return this.getReport(reportId, organizationId);
  }

  async submitForApproval(reportId, userId, organizationId) {
    const report = await this.assertReportInOrganization(reportId, organizationId);

    await run(
      `UPDATE management_reports SET approval_status = 'PENDING', requires_approval = 1 WHERE id = ?`,
      [reportId]
    );

    const approvalConfig = report.approval_config
      ? JSON.parse(report.approval_config)
      : report.approvalConfig || { levels: [] };

    const levels = approvalConfig.levels || [];
    for (const level of levels) {
      await run(
        `INSERT INTO management_report_approvals (id, report_id, approval_level, required_role, status, created_at)
         VALUES (?, ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)`,
        [uuidv4(), reportId, level.level || 1, level.role || 'MANAGER']
      );
    }

    await this.logAudit(reportId, 'SUBMITTED', userId, { levels });
    return true;
  }

  async getApprovalStatus(reportId, organizationId) {
    const report = await this.assertReportInOrganization(reportId, organizationId);
    const approvals = await all(
      `SELECT * FROM management_report_approvals WHERE report_id = ? ORDER BY approval_level`,
      [reportId]
    );
    return {
      status: report?.approval_status || 'NONE',
      approvals,
    };
  }

  async approveReport(reportId, userId, comment, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    await run(
      `UPDATE management_report_approvals SET status = 'APPROVED', decided_by = ?, decided_at = CURRENT_TIMESTAMP, decision_comment = ?
       WHERE report_id = ? AND status = 'PENDING'`,
      [userId, comment || '', reportId]
    );
    await run(`UPDATE management_reports SET approval_status = 'APPROVED' WHERE id = ?`, [
      reportId,
    ]);
    await this.logAudit(reportId, 'APPROVED', userId, { comment });
    return true;
  }

  // DEC-136: this used to return every PENDING approval row in the whole
  // installation. The approval row carries no organization of its own, so the
  // tenant boundary is the parent report — join it and filter there.
  async getPendingApprovals(organizationId) {
    if (!organizationId) return [];
    const pending = await all(
      `SELECT a.* FROM management_report_approvals a
        JOIN management_reports r ON r.id = a.report_id
       WHERE a.status = 'PENDING' AND r.organization_id = ?
       ORDER BY a.created_at DESC`,
      [organizationId]
    );
    return pending;
  }

  // Version rows are children of a report and carry no organization column of
  // their own — the tenant check is always on the parent report, resolved
  // BEFORE any version content is read.
  private async readVersionRow(reportId, versionNumber) {
    return get(
      `SELECT * FROM management_report_versions WHERE report_id = ? AND version_number = ?`,
      [reportId, versionNumber]
    );
  }

  async getVersions(reportId, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const versions = await all(
      `SELECT * FROM management_report_versions WHERE report_id = ? ORDER BY version_number DESC`,
      [reportId]
    );
    return versions;
  }

  async getVersion(reportId, versionNumber, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    return this.readVersionRow(reportId, versionNumber);
  }

  async compareVersions(reportId, v1, v2, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const [version1, version2] = await Promise.all([
      this.readVersionRow(reportId, v1),
      this.readVersionRow(reportId, v2),
    ]);
    if (!version1 || !version2) {
      throw new Error('Version not found');
    }
    return { v1: version1, v2: version2 };
  }

  async addComment(reportId, data, userId, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const comment = {
      id: uuidv4(),
      reportId,
      versionId: data.versionId || null,
      sectionId: data.sectionId || null,
      content: data.content,
      parentCommentId: data.parentCommentId || null,
      mentions: data.mentions || [],
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await managementReportRepository.addComment(comment);
    await this.logAudit(reportId, 'COMMENTED', userId, { sectionId: data.sectionId });
    return comment;
  }

  async getComments(reportId, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    return managementReportRepository.getComments(reportId);
  }

  // DEC-136: a comment used to be addressable by its id alone, with no link to
  // the report in the URL or to the caller's organization. Two checks now:
  // the comment must belong to the report in the path, AND that report must
  // belong to the caller's organization. Both failures look like one 404.
  private async assertCommentInReportAndOrganization(commentId, reportId, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const comment = await managementReportRepository.getCommentById(commentId);
    if (!comment || comment.report_id !== reportId) throw reportNotFoundError();
    return comment;
  }

  async updateComment(commentId, updates, userId, reportId, organizationId) {
    const comment = await this.assertCommentInReportAndOrganization(
      commentId,
      reportId,
      organizationId
    );

    const content = updates.content ?? comment.content;
    const isResolved = updates.isResolved ?? comment.is_resolved;

    await run(
      `UPDATE management_report_comments SET content = ?, is_resolved = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [content, isResolved ? 1 : 0, commentId]
    );

    if (updates.isResolved) {
      await managementReportRepository.resolveComment(commentId, userId);
    }

    return {
      ...comment,
      content,
      isResolved: Boolean(isResolved),
    };
  }

  async deleteComment(commentId, reportId, organizationId) {
    await this.assertCommentInReportAndOrganization(commentId, reportId, organizationId);
    await managementReportRepository.deleteComment(commentId);
  }

  async getAuditLog(reportId, action, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const rows = await all(
      `SELECT * FROM management_report_audit_log WHERE report_id = ? ${
        action ? 'AND action = ?' : ''
      } ORDER BY created_at DESC`,
      action ? [reportId, action] : [reportId]
    );
    return rows;
  }

  async finalizeReport(reportId, userId, organizationId) {
    const report = await this.assertReportInOrganization(reportId, organizationId);
    const integrityHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(report.content || {}))
      .digest('hex');
    await managementReportRepository.finalizeReport(reportId, integrityHash, userId);
    await this.logAudit(reportId, 'FINALIZED', userId, { integrityHash });
    return this.getReport(reportId, organizationId);
  }

  async unlockReport(reportId, userId, reason, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    await managementReportRepository.unlockReport(reportId);
    await this.logAudit(reportId, 'UNLOCKED', userId, { reason });
    return this.getReport(reportId, organizationId);
  }

  // DEC-136 P0: a share link leaves the system entirely (anyone holding the
  // URL can be handed the report), so the tenant check has to happen BEFORE
  // the token is minted and BEFORE the row is touched — a foreign report must
  // produce zero writes and the same 404 as a missing one.
  async createShareLink(reportId, expiresInDays, userId, organizationId) {
    await this.assertReportInOrganization(reportId, organizationId);
    const shareToken = uuidv4();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null;
    await managementReportRepository.createShareLink(
      reportId,
      shareToken,
      expiresAt,
      organizationId
    );
    await this.logAudit(reportId, 'SHARED', userId, { expiresAt });
    return { shareToken, expiresAt };
  }

  async generateExport(reportId, format, userId, organizationId) {
    const row = await managementReportRepository.getReportByIdForOrganization(
      reportId,
      organizationId
    );
    const report = row ? this.mapReport(row) : null;
    if (!report) {
      const err = new Error('Report not found');
      (err as any).code = 'NOT_FOUND';
      (err as any).status = 404;
      throw err;
    }

    // Resolve tenant visibility before dependency state so a foreign report is
    // always indistinguishable from a missing report.
    if (format === 'pdf' || format === 'pptx' || format === 'xlsx') {
      const deps = await loadExportDeps();
      if (format === 'pdf' && !deps.PDFDocument) throw dependencyMissing('pdfkit');
      if (format === 'pptx' && !deps.PptxGenJS) throw dependencyMissing('pptxgenjs');
      if (format === 'xlsx' && !deps.ExcelJS) throw dependencyMissing('exceljs');
    }

    const exportDir = await this.ensureExportDir();
    const fileName = `${reportId}.${format}`;
    const filePath = path.join(exportDir, fileName);
    const publicPath = `/exports/management-reports/${fileName}`;

    if (format === 'pdf') {
      await this.writePdfReport(report, filePath);
    } else if (format === 'pptx') {
      await this.writePptxReport(report, filePath);
    } else if (format === 'xlsx') {
      await this.writeXlsxReport(report, filePath);
    }

    const column = format === 'pdf' ? 'pdf_path' : format === 'pptx' ? 'pptx_path' : 'xlsx_path';
    await run(`UPDATE management_reports SET ${column} = ? WHERE id = ? AND organization_id = ?`, [
      publicPath,
      reportId,
      organizationId,
    ]);
    await this.logAudit(reportId, 'EXPORTED', userId, { format });
    return { filePath: publicPath };
  }

  async getUsageAnalytics(organizationId) {
    const row = await get(
      `SELECT COUNT(*) as total, COUNT(DISTINCT report_type) as types
       FROM management_reports WHERE organization_id = ?`,
      [organizationId]
    );
    return row || { total: 0, types: 0 };
  }

  async getTypesAnalytics(organizationId) {
    const rows = await all(
      `SELECT report_type as "reportType", COUNT(*) as total
       FROM management_reports WHERE organization_id = ?
       GROUP BY report_type`,
      [organizationId]
    );
    return rows || [];
  }

  // DEC-136: reportIds come straight from the request body and the only thing
  // this does with them is write an audit row — which used to let a caller
  // stamp a row onto ANOTHER org's report. Every id is tenant-checked first.
  async bulkExport(reportIds, format, userId, organizationId) {
    for (const reportId of reportIds) {
      await this.assertReportInOrganization(reportId, organizationId);
    }
    const exportId = uuidv4();
    await this.logAudit(reportIds[0], 'BULK_EXPORTED', userId, { reportIds, format });
    return {
      exportId,
      filePath: `/exports/management-reports/${exportId}.${format}.zip`,
    };
  }

  async listTemplates(organizationId) {
    const rows = await all(
      `SELECT * FROM management_report_templates WHERE organization_id = ? ORDER BY created_at DESC`,
      [organizationId]
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      reportType: row.report_type,
      sections: parseMaybeJson(row.sections, []),
      createdAt: row.created_at,
      createdByName: row.created_by_name,
    }));
  }

  async createTemplate(organizationId, userId, payload) {
    const template = {
      id: uuidv4(),
      organizationId,
      reportType: payload.reportType,
      name: payload.name,
      description: payload.description || '',
      sections: payload.sections || [],
      createdBy: userId,
    };

    await run(
      `INSERT INTO management_report_templates (id, organization_id, report_type, name, description, sections, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        template.id,
        template.organizationId,
        template.reportType,
        template.name,
        template.description,
        JSON.stringify(template.sections),
        template.createdBy,
      ]
    );

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      reportType: template.reportType,
      sections: template.sections,
      createdAt: new Date().toISOString(),
    };
  }

  async updateTemplate(templateId, organizationId, payload) {
    await run(
      `UPDATE management_report_templates SET name = ?, description = ?, sections = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND organization_id = ?`,
      [
        payload.name,
        payload.description,
        JSON.stringify(payload.sections || []),
        templateId,
        organizationId,
      ]
    );
  }

  async deleteTemplate(templateId, organizationId) {
    await run(`DELETE FROM management_report_templates WHERE id = ? AND organization_id = ?`, [
      templateId,
      organizationId,
    ]);
  }

  async listSchedules(organizationId) {
    const rows = await all(
      `SELECT s.*, p.name as project_name
       FROM management_report_schedules s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.organization_id = ?
       ORDER BY s.created_at DESC`,
      [organizationId]
    );
    return rows.map((row) => ({
      id: row.id,
      reportType: row.report_type,
      scope: row.scope,
      projectId: row.project_id,
      projectName: row.project_name,
      frequency: row.frequency,
      dayOfWeek: row.day_of_week,
      dayOfMonth: row.day_of_month,
      timeOfDay: row.time_of_day,
      timezone: row.timezone,
      isActive: Boolean(row.is_active),
      nextScheduledAt: row.next_scheduled_at,
      recipients: row.recipients ? JSON.parse(row.recipients) : [],
    }));
  }

  async createSchedule(organizationId, userId, payload) {
    const id = uuidv4();
    const nextScheduledAt = this.calculateNextSchedule(payload);
    await run(
      `INSERT INTO management_report_schedules
       (id, organization_id, project_id, report_type, scope, frequency, day_of_week, day_of_month, time_of_day, timezone, recipients, created_by, next_scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        organizationId,
        payload.projectId || null,
        payload.reportType,
        payload.scope,
        payload.frequency,
        payload.dayOfWeek ?? null,
        payload.dayOfMonth ?? null,
        payload.timeOfDay || '09:00',
        payload.timezone || 'Europe/Warsaw',
        JSON.stringify(payload.recipients || []),
        userId,
        nextScheduledAt,
      ]
    );
    return {
      id,
      reportType: payload.reportType,
      scope: payload.scope,
      projectId: payload.projectId,
      frequency: payload.frequency,
      dayOfWeek: payload.dayOfWeek,
      dayOfMonth: payload.dayOfMonth,
      timeOfDay: payload.timeOfDay,
      timezone: payload.timezone,
      isActive: true,
      nextScheduledAt,
      recipients: payload.recipients || [],
    };
  }

  async deleteSchedule(scheduleId, organizationId) {
    await run(`DELETE FROM management_report_schedules WHERE id = ? AND organization_id = ?`, [
      scheduleId,
      organizationId,
    ]);
  }

  calculateNextSchedule(payload) {
    const now = new Date();
    const [hours, minutes] = (payload.timeOfDay || '09:00').split(':').map(Number);
    const next = new Date(now);
    next.setHours(hours, minutes, 0, 0);

    if (payload.frequency === 'DAILY') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (payload.frequency === 'WEEKLY' || payload.frequency === 'BIWEEKLY') {
      const targetDay = payload.dayOfWeek ?? 1;
      const dayOffset = (targetDay - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + (dayOffset === 0 && next <= now ? 7 : dayOffset));
      if (payload.frequency === 'BIWEEKLY') {
        next.setDate(next.getDate() + 7);
      }
    } else if (payload.frequency === 'MONTHLY') {
      next.setDate(payload.dayOfMonth || 1);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
      }
    }

    return next.toISOString();
  }

  async generateAiNarrative({ reportType, scope, summary, aiEnhancement, organizationId }) {
    if (!aiEnhancement) {
      return { narrative: summary, warnings: [] };
    }
    if (isUnitTest()) {
      return { narrative: summary, warnings: [] };
    }

    try {
      // REJESTR T7b-3/4 (2026-07-19): aiExecutiveReporting.ts now has a real implementation
      // (one grounded llmService call, tier STANDARD, fail-soft) — see that file's header.
      const aiModule = await import('./aiExecutiveReporting.js');
      const aiService = aiModule.default || aiModule;
      if (
        aiService?.generateReport &&
        reportType !== 'TEAM_MEETING' &&
        reportType !== 'TEAM_WEEKLY'
      ) {
        const result = await aiService.generateReport({
          type: reportType,
          scope,
          summary,
          organizationId,
        });
        return { narrative: result?.narrative || summary, warnings: result?.warnings || [] };
      }
      if (aiService?.translateToNarrative) {
        return { narrative: aiService.translateToNarrative(summary), warnings: [] };
      }
    } catch (error) {
      return { narrative: 'AI summary unavailable.', warnings: ['AI service was unavailable'] };
    }

    return { narrative: summary, warnings: [] };
  }

  async saveReport(data) {
    const reportId = uuidv4();
    const now = new Date().toISOString();
    const report = {
      id: reportId,
      organizationId: data.organizationId,
      projectId: data.projectId,
      reportType: data.reportType,
      scope: data.scope,
      title: data.title,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      status: data.status,
      generatedBy: data.generatedBy,
      content: data.content,
      aiNarrative: data.aiNarrative || '',
      aiWarnings: data.aiWarnings || [],
      createdAt: now,
    };

    await managementReportRepository.saveReport(report);

    if (isUnitTest()) {
      return {
        ...report,
        generatedByName: '',
        status: report.status,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        organizationId: report.organizationId,
        createdAt: now,
        updatedAt: now,
      };
    }

    if (data.requiresApproval) {
      await run(
        `UPDATE management_reports SET requires_approval = 1, approval_config = ? WHERE id = ?`,
        [JSON.stringify(data.approvalConfig || {}), reportId]
      );
    }

    await this.createReportVersion(
      reportId,
      report.content,
      report.aiNarrative,
      report.aiWarnings,
      data.generatedBy,
      'Initial version'
    );

    await this.logAudit(reportId, 'CREATED', data.generatedBy, { reportType: data.reportType });
    let generatedByName = '';
    if (data.generatedBy) {
      const user = await managementReportRepository.getUser(data.generatedBy);
      if (user) {
        generatedByName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      }
    }

    return {
      ...report,
      generatedByName,
      status: report.status,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      organizationId: report.organizationId,
      createdAt: now,
      updatedAt: now,
    };
  }

  async createReportVersion(reportId, content, aiNarrative, aiWarnings, userId, summary) {
    const currentVersionRow = await get(
      `SELECT MAX(version_number) as "versionNumber" FROM management_report_versions WHERE report_id = ?`,
      [reportId]
    );
    const nextVersion = (currentVersionRow?.versionNumber || 0) + 1;
    await run(
      `INSERT INTO management_report_versions
       (id, report_id, version_number, version_label, content, ai_narrative, ai_warnings, change_summary, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        reportId,
        nextVersion,
        `${nextVersion}.0`,
        JSON.stringify(content || {}),
        aiNarrative || '',
        JSON.stringify(aiWarnings || []),
        summary || 'Report updated',
        userId,
      ]
    );
    await run(`UPDATE management_reports SET current_version = ? WHERE id = ?`, [
      nextVersion,
      reportId,
    ]);
  }

  async logAudit(reportId, action, userId, details) {
    await run(
      `INSERT INTO management_report_audit_log (id, report_id, action, actor_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [uuidv4(), reportId, action, userId, JSON.stringify(details || {})]
    );
  }

  mapReport(row) {
    const content =
      typeof row.content === 'string' ? JSON.parse(row.content || '{}') : row.content || {};
    const aiWarnings =
      typeof row.ai_warnings === 'string'
        ? JSON.parse(row.ai_warnings || '[]')
        : row.ai_warnings || row.aiWarnings || [];
    return {
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      reportType: row.report_type,
      scope: row.scope,
      title: row.title,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      generatedBy: row.generated_by,
      generatedByName: row.generated_by_name || row.generatedByName || '',
      content,
      aiNarrative: row.ai_narrative || '',
      aiWarnings,
      pdfPath: row.pdf_path,
      pptxPath: row.pptx_path,
      xlsxPath: row.xlsx_path,
      shareToken: row.share_token,
      shareExpiresAt: row.share_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentVersion: row.current_version,
      approvalStatus: row.approval_status,
      requiresApproval: Boolean(row.requires_approval),
      approvalConfig: row.approval_config ? JSON.parse(row.approval_config) : row.approvalConfig,
      lockedAt: row.locked_at,
      lockedBy: row.locked_by,
      finalizedAt: row.finalized_at,
      finalizedBy: row.finalized_by,
      integrityHash: row.integrity_hash,
      previousReportId: row.previous_report_id,
    };
  }
}

const managementReportsService = new ManagementReportsService();
export default managementReportsService;
