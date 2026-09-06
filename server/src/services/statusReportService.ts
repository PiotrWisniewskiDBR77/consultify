import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
// import BudgetService from './budgetService.js'; // Assuming wrapper exists and works. Or import from source if migrated.
// Given the list_dir showed budgetService.ts is small, likely a wrapper.
// To be safe and avoid circular deps issues during testing, I might want to inject it or lazily import it,
// similar to how JS did but with import()
// For now, I'll attempt a static import. If it fails, I'll switch to dynamic.

export const RAG_STATUS = {
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED: 'RED',
  // Honest reporting: a section with no authoritative data source is NA
  // ("not independently tracked"), never a fake GREEN. NA is ignored by the
  // overall roll-up (it is neither RED nor AMBER), so it cannot inflate status.
  NA: 'NA',
} as const;

export const SECTION_NAMES = {
  SCHEDULE: 'SCHEDULE',
  BUDGET: 'BUDGET',
  SCOPE: 'SCOPE',
  QUALITY: 'QUALITY',
  RISKS: 'RISKS',
  RESOURCES: 'RESOURCES',
} as const;

export const PERIOD_TYPES = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
} as const;

export class StatusReportService {
  private db;

  // Public constants for easy access
  static RAG_STATUS = RAG_STATUS;
  static SECTION_NAMES = SECTION_NAMES;
  static PERIOD_TYPES = PERIOD_TYPES;

  // Also expose instance properties if needed for compatibility
  public RAG_STATUS = RAG_STATUS;
  public SECTION_NAMES = SECTION_NAMES;
  public PERIOD_TYPES = PERIOD_TYPES;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Set dependencies for testing
   */
  setDependencies(deps: { db?: any }) {
    if (deps.db) this.db = deps.db;
  }

  /**
   * Generate a new status report
   */
  async generateReport(
    orgId: string,
    initiativeId: string,
    periodType: string,
    userId: string,
    options: any = {}
  ) {
    const id = uuidv4();
    const now = new Date();

    // Calculate period dates
    const { periodStart, periodEnd, periodLabel } = this.calculatePeriod(
      periodType,
      options.periodDate
    );

    // Get initiative details
    const initiative = await DbPromise.get<any>(
      this.db,
      `
            SELECT i.*, p.name as project_name,
                ob.first_name as owner_first, ob.last_name as owner_last
            FROM initiatives i
            LEFT JOIN projects p ON i.project_id = p.id
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            WHERE i.id = ? AND i.organization_id = ?
        `,
      [initiativeId, orgId]
    );

    if (!initiative) {
      throw new Error('Initiative not found');
    }

    // Gather data for the report
    const reportData = await this.gatherReportData(initiativeId, orgId, periodStart, periodEnd);

    // Calculate section statuses
    const sections = this.calculateSectionStatuses(reportData);

    // Calculate overall status
    const overallStatus = this.calculateOverallStatus(sections);

    // Generate narrative content
    const narrative = await this.generateNarrative(initiative, reportData, sections);

    const nowStr = now.toISOString();

    // Insert report
    await DbPromise.run(
      this.db,
      `
            INSERT INTO status_reports (
                id, organization_id, initiative_id, project_id,
                period_type, period_start, period_end, period_label,
                overall_status, overall_trend, sections_json,
                executive_summary, accomplishments, next_steps, escalations,
                risks_and_issues, recommendations,
                progress_percent, budget_consumed_percent,
                tasks_completed, tasks_total,
                open_risks, open_issues, pending_decisions,
                generation_method, status, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      [
        id,
        orgId,
        initiativeId,
        initiative.project_id,
        periodType,
        periodStart,
        periodEnd,
        periodLabel,
        overallStatus,
        reportData.trend || 'STABLE',
        JSON.stringify(sections),
        narrative.executiveSummary,
        JSON.stringify(narrative.accomplishments),
        JSON.stringify(narrative.nextSteps),
        JSON.stringify(narrative.escalations),
        narrative.risksAndIssues,
        narrative.recommendations,
        reportData.progress,
        reportData.budgetConsumedPercent,
        reportData.tasksCompleted,
        reportData.tasksTotal,
        reportData.openRisks,
        reportData.openIssues,
        reportData.pendingDecisions,
        options.method || 'MANUAL',
        'DRAFT',
        userId,
        nowStr,
        nowStr,
      ]
    );

    // Store section history
    for (const [sectionName, sectionData] of Object.entries(sections)) {
      // @ts-ignore
      const { status, content, highlights, issues } = sectionData;
      await DbPromise.run(
        this.db,
        `
                INSERT INTO report_section_history (
                    id, report_id, section_name, status, content, highlights, issues, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
        [
          uuidv4(),
          id,
          sectionName,
          status,
          content,
          JSON.stringify(highlights || []),
          JSON.stringify(issues || []),
          nowStr,
        ]
      );
    }

    return {
      id,
      initiativeId,
      initiativeName: initiative.name,
      periodType,
      periodLabel,
      overallStatus,
      sections,
      narrative,
      status: 'DRAFT',
    };
  }

  /**
   * Calculate period dates
   */
  calculatePeriod(periodType: string, referenceDate: Date | string = new Date()) {
    const date = new Date(referenceDate);
    let periodStart: Date, periodEnd: Date, periodLabel: string;

    switch (periodType) {
      case 'WEEKLY':
        // Get Monday of current week
        const dayOfWeek = date.getDay();
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        periodStart = new Date(date.setDate(diff));
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6);
        periodEnd.setHours(23, 59, 59, 999);

        const weekNum = Math.ceil(
          (periodStart.getDate() + new Date(periodStart.getFullYear(), 0, 1).getDay()) / 7
        );
        periodLabel = `Week ${weekNum}, ${periodStart.getFullYear()}`;
        break;

      case 'MONTHLY':
        periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
        periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
        const monthNames = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];
        periodLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        break;

      case 'QUARTERLY':
        const quarter = Math.floor(date.getMonth() / 3);
        periodStart = new Date(date.getFullYear(), quarter * 3, 1);
        periodEnd = new Date(date.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
        periodLabel = `Q${quarter + 1} ${date.getFullYear()}`;
        break;

      default:
        periodStart = new Date();
        periodEnd = new Date();
        periodLabel = 'Current';
    }

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      periodLabel,
    };
  }

  /**
   * Gather data for report generation
   */
  async gatherReportData(
    initiativeId: string,
    orgId: string,
    periodStart: string,
    periodEnd: string
  ) {
    // Initiative progress
    const initiative = await DbPromise.get<any>(
      this.db,
      `
            SELECT progress, status, business_value, blocked_reason, on_hold
            FROM initiatives WHERE id = ?
        `,
      [initiativeId]
    );

    // Task statistics
    const taskStats = (await DbPromise.get<any>(
      this.db,
      `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
                SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) as blocked
            FROM tasks WHERE initiative_id = ?
        `,
      [initiativeId]
    )) || { total: 0, completed: 0, in_progress: 0, blocked: 0 };

    // Tasks completed this period
    const periodTasks = (await DbPromise.get<any>(
      this.db,
      `
            SELECT COUNT(*) as completed_this_period
            FROM tasks 
            WHERE initiative_id = ? 
              AND status = 'DONE'
              AND updated_at >= ? AND updated_at <= ?
        `,
      [initiativeId, periodStart, periodEnd]
    )) || { completed_this_period: 0 };

    // Budget data (from execution budget service)
    let budgetData = { consumedPercent: 0, isOverBudget: false, remaining: 0 };
    try {
      const { getInitiativeBudgetSummary } = await import('./executionBudgetService.js');
      const summary = await getInitiativeBudgetSummary(orgId, initiativeId);
      if (summary) {
        budgetData = {
          consumedPercent: summary.variance.percent,
          isOverBudget: summary.forecast.isOverBudget,
          remaining: Math.max(0, summary.planned.total - summary.actual.total),
        };
      }
    } catch (e) {
      logger.warn('StatusReportService: Failed to load budget data', e);
    }

    // RAID items
    const raidStats = (await DbPromise.get<any>(
      this.db,
      `
            SELECT 
                SUM(CASE WHEN type = 'RISK' AND status = 'OPEN' THEN 1 ELSE 0 END) as open_risks,
                SUM(CASE WHEN type = 'ISSUE' AND status = 'OPEN' THEN 1 ELSE 0 END) as open_issues,
                SUM(CASE WHEN (impact = 'HIGH' OR impact = 'CRITICAL') AND status = 'OPEN' THEN 1 ELSE 0 END) as high_priority
            FROM raid_items WHERE initiative_id = ?
        `,
      [initiativeId]
    )) || { open_risks: 0, open_issues: 0, high_priority: 0 };

    // Pending decisions
    const decisionStats = (await DbPromise.get<any>(
      this.db,
      `
            SELECT COUNT(*) as pending
            FROM decisions 
            WHERE initiative_id = ? AND status IN ('pending', 'escalated')
        `,
      [initiativeId]
    )) || { pending: 0 };

    // Calculate trend based on previous report
    const previousReport = await DbPromise.get<any>(
      this.db,
      `
            SELECT overall_status, progress_percent
            FROM status_reports 
            WHERE initiative_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        `,
      [initiativeId]
    );

    let trend = 'STABLE';
    if (previousReport && initiative) {
      if (initiative.progress > previousReport.progress_percent + 5) trend = 'IMPROVING';
      else if (initiative.progress < previousReport.progress_percent - 5) trend = 'DECLINING';
    }

    return {
      progress: initiative?.progress || 0,
      status: initiative?.status,
      onHold: Boolean(initiative?.on_hold), // DEC-424 (P12-int-c): BLOCKED -> on_hold flag
      blockedReason: initiative?.blocked_reason,
      tasksTotal: taskStats.total || 0,
      tasksCompleted: taskStats.completed || 0,
      tasksInProgress: taskStats.in_progress || 0,
      tasksBlocked: taskStats.blocked || 0,
      tasksCompletedThisPeriod: periodTasks.completed_this_period || 0,
      budgetConsumedPercent: budgetData.consumedPercent,
      isOverBudget: budgetData.isOverBudget,
      openRisks: raidStats.open_risks || 0,
      openIssues: raidStats.open_issues || 0,
      highPriorityItems: raidStats.high_priority || 0,
      pendingDecisions: decisionStats.pending || 0,
      trend,
    };
  }

  /**
   * Calculate section statuses
   */
  calculateSectionStatuses(data: any) {
    const sections: any = {};

    // Schedule section
    const scheduleStatus =
      data.tasksBlocked > 0
        ? 'RED'
        : data.tasksInProgress > data.tasksTotal * 0.5 && data.progress < 50
          ? 'AMBER'
          : 'GREEN';
    sections[SECTION_NAMES.SCHEDULE] = {
      status: scheduleStatus,
      content: `${data.tasksCompleted}/${data.tasksTotal} tasks completed (${data.progress}% progress)`,
      highlights:
        data.tasksCompletedThisPeriod > 0
          ? [`Completed ${data.tasksCompletedThisPeriod} tasks this period`]
          : [],
      issues: data.tasksBlocked > 0 ? [`${data.tasksBlocked} tasks currently blocked`] : [],
    };

    // Budget section
    const budgetStatus = data.isOverBudget
      ? 'RED'
      : data.budgetConsumedPercent >= 90
        ? 'AMBER'
        : 'GREEN';
    sections[SECTION_NAMES.BUDGET] = {
      status: budgetStatus,
      content: `${data.budgetConsumedPercent}% of budget consumed`,
      highlights: data.budgetConsumedPercent < 80 ? ['Budget on track'] : [],
      issues: data.isOverBudget ? ['Budget overrun detected'] : [],
    };

    // Scope section — no authoritative scope-change source feeds this report
    // yet (change control lives in Rollout Change Log). Report NA honestly
    // instead of a fabricated GREEN. Wire to change-control when available.
    sections[SECTION_NAMES.SCOPE] = {
      status: RAG_STATUS.NA,
      content: 'Scope not independently tracked this period (no change-control feed)',
      highlights: [],
      issues: [],
    };

    // Quality section — derived from realized issues (open RAID issues are the
    // available quality/delivery-problem signal), not a hardcoded GREEN.
    const qualityStatus = data.openIssues >= 3 ? 'RED' : data.openIssues >= 1 ? 'AMBER' : 'GREEN';
    sections[SECTION_NAMES.QUALITY] = {
      status: qualityStatus,
      content:
        data.openIssues > 0
          ? `${data.openIssues} open issue(s) affecting quality/delivery`
          : 'No open issues tracked this period',
      highlights: data.openIssues === 0 ? ['No open issues'] : [],
      issues: data.openIssues >= 3 ? [`${data.openIssues} open issues require attention`] : [],
    };

    // Risks section
    const risksStatus =
      data.highPriorityItems >= 3
        ? 'RED'
        : data.openRisks >= 3 || data.highPriorityItems >= 1
          ? 'AMBER'
          : 'GREEN';
    sections[SECTION_NAMES.RISKS] = {
      status: risksStatus,
      content: `${data.openRisks} open risks, ${data.openIssues} open issues`,
      highlights: data.openRisks === 0 ? ['No open risks'] : [],
      issues:
        data.highPriorityItems > 0
          ? [`${data.highPriorityItems} high-priority items require attention`]
          : [],
    };

    // Resources section
    sections[SECTION_NAMES.RESOURCES] = {
      status: data.onHold ? 'RED' : 'GREEN',
      content:
        data.onHold
          ? `Initiative blocked: ${data.blockedReason || 'Reason not specified'}`
          : 'Resources allocated as planned',
      highlights: [],
      issues: data.onHold ? ['Initiative is blocked'] : [],
    };

    return sections;
  }

  /**
   * Calculate overall status from sections
   */
  calculateOverallStatus(sections: any) {
    const statuses = Object.values(sections).map((s: any) => s.status);

    if (statuses.includes('RED')) return 'RED';
    if (statuses.filter((s) => s === 'AMBER').length >= 2) return 'AMBER';
    if (statuses.includes('AMBER')) return 'AMBER';
    return 'GREEN';
  }

  /**
   * Generate narrative content
   */
  async generateNarrative(initiative: any, data: any, sections: any) {
    const accomplishments: string[] = [];
    const nextSteps: string[] = [];
    const escalations: any[] = [];

    // Generate accomplishments
    if (data.tasksCompletedThisPeriod > 0) {
      accomplishments.push(`Completed ${data.tasksCompletedThisPeriod} tasks this period`);
    }
    if (data.progress >= 50 && data.progress < 75) {
      accomplishments.push('Reached 50% progress milestone');
    } else if (data.progress >= 75 && data.progress < 100) {
      accomplishments.push('Approaching completion - 75%+ progress achieved');
    }

    // Generate next steps
    if (data.tasksInProgress > 0) {
      nextSteps.push(`Continue work on ${data.tasksInProgress} in-progress tasks`);
    }
    if (data.pendingDecisions > 0) {
      nextSteps.push(`Resolve ${data.pendingDecisions} pending decisions`);
    }
    if (data.openRisks > 0) {
      nextSteps.push('Review and update risk mitigation plans');
    }

    // Generate escalations
    if (data.onHold) {
      escalations.push({
        type: 'BLOCKER',
        message: `Initiative blocked: ${data.blockedReason || 'Reason not specified'}`,
        requiredAction: 'Executive intervention required',
      });
    }
    if (data.pendingDecisions >= 3) {
      escalations.push({
        type: 'DECISION_BACKLOG',
        message: `${data.pendingDecisions} pending decisions creating delays`,
        requiredAction: 'Schedule decision review meeting',
      });
    }

    // Executive summary
    const statusWord =
      sections.SCHEDULE?.status === 'GREEN'
        ? 'on track'
        : sections.SCHEDULE?.status === 'AMBER'
          ? 'at risk'
          : 'off track';
    const executiveSummary =
      `${initiative.name} is currently ${statusWord} with ${data.progress}% completion. ` +
      `${data.tasksCompleted} of ${data.tasksTotal} tasks completed. ` +
      (data.openIssues > 0
        ? `${data.openIssues} open issues require attention.`
        : 'No critical issues.');

    // Risks and issues summary
    const risksAndIssues =
      data.openRisks > 0 || data.openIssues > 0
        ? `There are ${data.openRisks} open risks and ${data.openIssues} open issues being tracked.`
        : 'No significant risks or issues at this time.';

    // Recommendations
    let recommendations = '';
    if (data.trend === 'DECLINING') {
      recommendations =
        'Consider reviewing resource allocation and timeline. Progress trend is declining.';
    } else if (data.isOverBudget) {
      recommendations =
        'Budget overrun detected. Recommend immediate cost review and approval for additional funds or scope adjustment.';
    } else if (data.highPriorityItems > 0) {
      recommendations =
        'Focus on resolving high-priority risks and issues before proceeding with new work.';
    } else {
      recommendations = 'Continue current trajectory. No immediate action required.';
    }

    return {
      executiveSummary,
      accomplishments,
      nextSteps,
      escalations,
      risksAndIssues,
      recommendations,
    };
  }

  /**
   * Get report by ID
   */
  async getReport(reportId: string, orgId: string) {
    const report = await DbPromise.get<any>(
      this.db,
      `
            SELECT r.*, i.title as initiative_name,
                u.first_name as created_by_first, u.last_name as created_by_last
            FROM status_reports r
            JOIN initiatives i ON r.initiative_id = i.id
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.id = ? AND r.organization_id = ?
        `,
      [reportId, orgId]
    );

    if (!report) return null;

    // Parse JSON fields
    const sections = report.sections_json ? JSON.parse(report.sections_json) : {};
    const accomplishments = report.accomplishments ? JSON.parse(report.accomplishments) : [];
    const nextSteps = report.next_steps ? JSON.parse(report.next_steps) : [];
    const escalations = report.escalations ? JSON.parse(report.escalations) : [];

    return {
      id: report.id,
      initiativeId: report.initiative_id,
      initiativeName: report.initiative_name,
      projectId: report.project_id,
      periodType: report.period_type,
      periodStart: report.period_start,
      periodEnd: report.period_end,
      periodLabel: report.period_label,
      overallStatus: report.overall_status,
      overallTrend: report.overall_trend,
      sections,
      executiveSummary: report.executive_summary,
      accomplishments,
      nextSteps,
      escalations,
      risksAndIssues: report.risks_and_issues,
      recommendations: report.recommendations,
      metrics: {
        progressPercent: report.progress_percent,
        budgetConsumedPercent: report.budget_consumed_percent,
        tasksCompleted: report.tasks_completed,
        tasksTotal: report.tasks_total,
        openRisks: report.open_risks,
        openIssues: report.open_issues,
        pendingDecisions: report.pending_decisions,
      },
      status: report.status,
      generationMethod: report.generation_method,
      createdBy: report.created_by_first
        ? `${report.created_by_first} ${report.created_by_last}`
        : null,
      createdAt: report.created_at,
      updatedAt: report.updated_at,
    };
  }

  /**
   * List reports for initiative
   */
  async listReports(initiativeId: string, orgId: string, options: any = {}) {
    const { limit = 20, offset = 0, status } = options;

    let sql = `
            SELECT r.id, r.period_type, r.period_label, r.overall_status,
                r.status, r.progress_percent, r.created_at,
                u.first_name, u.last_name
            FROM status_reports r
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.initiative_id = ? AND r.organization_id = ?
        `;
    const params: any[] = [initiativeId, orgId];

    if (status) {
      sql += ` AND r.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const reports = await DbPromise.all<any>(this.db, sql, params);

    return reports.map((r) => ({
      id: r.id,
      periodType: r.period_type,
      periodLabel: r.period_label,
      overallStatus: r.overall_status,
      status: r.status,
      progressPercent: r.progress_percent,
      createdBy: r.first_name ? `${r.first_name} ${r.last_name}` : null,
      createdAt: r.created_at,
    }));
  }

  /**
   * Update report
   */
  async updateReport(reportId: string, updates: any, userId: string) {
    const allowedFields = [
      'executive_summary',
      'accomplishments',
      'next_steps',
      'escalations',
      'risks_and_issues',
      'recommendations',
      'overall_status',
      'status',
    ];

    const setClauses: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = ?`);
        params.push(
          ['accomplishments', 'next_steps', 'escalations'].includes(snakeKey)
            ? JSON.stringify(value)
            : value
        );
      }
    }

    if (setClauses.length === 0) return false;

    setClauses.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(reportId);

    await DbPromise.run(
      this.db,
      `UPDATE status_reports SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    return true;
  }

  /**
   * Approve report
   */
  async approveReport(reportId: string, userId: string) {
    const now = new Date().toISOString();
    await DbPromise.run(
      this.db,
      `
            UPDATE status_reports 
            SET status = 'APPROVED', approved_by = ?, approved_at = ?, updated_at = ?
            WHERE id = ?
        `,
      [userId, now, now, reportId]
    );
  }

  /**
   * Publish report
   */
  async publishReport(reportId: string) {
    const now = new Date().toISOString();
    await DbPromise.run(
      this.db,
      `
            UPDATE status_reports 
            SET status = 'PUBLISHED', published_at = ?, updated_at = ?
            WHERE id = ?
        `,
      [now, now, reportId]
    );
  }

  // Legacy method stubs if needed, or migration of others not critically needed for now
}

export default new StatusReportService();
