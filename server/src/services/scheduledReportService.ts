/**
 * Scheduled Report Service
 *
 * Manages cyclic/scheduled report generation.
 * Supports cron-based scheduling, template-based generation,
 * and automatic distribution.
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import { governRecipients } from './deliverables/recipientGovernance.js';

// ============================================
// TYPES
// ============================================

export type ScheduleFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'custom';
export type ScheduleStatus = 'active' | 'paused' | 'completed' | 'failed';
export type DeliveryMethod = 'email' | 'dashboard' | 'webhook' | 'storage';
export type ScheduleType = 'time_based' | 'event_triggered' | 'hybrid';
export type DeliverableType = 'report' | 'presentation' | 'both' | 'bundle';
export type ScopeType = 'organization' | 'portfolio' | 'project' | 'initiative';

export interface ReportSchedule {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  // Template configuration
  templateId?: string;
  reportType: string;
  // Source data
  sourceAssessmentId?: string;
  sourceProjectId?: string;
  // Schedule type (T062)
  scheduleType: ScheduleType;
  deliverableType: DeliverableType;
  scopeType: ScopeType;
  scopeId?: string;
  // Schedule configuration
  frequency: ScheduleFrequency;
  cronExpression: string;
  timezone: string;
  // Execution tracking
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'failed' | null;
  lastRunReportId: string | null;
  runCount: number;
  // Delivery configuration
  deliveryMethods: DeliveryMethod[];
  deliveryConfig: DeliveryConfig;
  // Status
  isActive: boolean;
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryConfig {
  email?: {
    recipients: string[];
    subject?: string;
    includeAttachment?: boolean;
    attachmentFormat?: 'pdf' | 'pptx' | 'xlsx';
    /** W6.4 — adresy, które zrezygnowały z dostawy (opt-out). */
    optOut?: string[];
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
    includeReportData?: boolean;
  };
  storage?: {
    path: string;
    format: 'pdf' | 'pptx' | 'xlsx' | 'json';
  };
}

export interface ScheduleCreateRequest {
  name: string;
  description?: string;
  templateId?: string;
  reportType: string;
  sourceAssessmentId?: string;
  sourceProjectId?: string;
  scheduleType?: ScheduleType;
  deliverableType?: DeliverableType;
  scopeType?: ScopeType;
  scopeId?: string;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  timezone?: string;
  deliveryMethods: DeliveryMethod[];
  deliveryConfig: DeliveryConfig;
  startDate?: string;
}

export interface ScheduleUpdateRequest {
  name?: string;
  description?: string;
  scheduleType?: ScheduleType;
  deliverableType?: DeliverableType;
  scopeType?: ScopeType;
  scopeId?: string;
  frequency?: ScheduleFrequency;
  cronExpression?: string;
  timezone?: string;
  deliveryMethods?: DeliveryMethod[];
  deliveryConfig?: DeliveryConfig;
  isActive?: boolean;
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt?: string;
  generatedReportId?: string;
  generatedPresentationId?: string;
  triggerType?: string;
  triggerReason?: string;
  deliverableType?: string;
  error?: string;
  deliveryResults: DeliveryResult[];
}

export interface DeliveryResult {
  method: DeliveryMethod;
  status: 'success' | 'failed';
  details?: string;
  timestamp: string;
}

// ============================================
// CRON PRESETS
// ============================================

const FREQUENCY_CRON_MAP: Record<ScheduleFrequency, string> = {
  daily: '0 9 * * *', // Every day at 9 AM
  weekly: '0 9 * * 1', // Every Monday at 9 AM
  biweekly: '0 9 1,15 * *', // 1st and 15th of month at 9 AM
  monthly: '0 9 1 * *', // 1st of month at 9 AM
  quarterly: '0 9 1 1,4,7,10 *', // 1st of Jan, Apr, Jul, Oct at 9 AM
  custom: '0 9 * * *', // Default to daily
};

// ============================================
// SERVICE CLASS
// ============================================

class ScheduledReportService {
  private db: any;
  private reportBuilderService: any;
  private emailService: any;
  private initialized = false;

  constructor() {
    // Dependencies will be injected
  }

  setDependencies(deps: { db: any; reportBuilderService?: any; emailService?: any }) {
    this.db = deps.db;
    this.reportBuilderService = deps.reportBuilderService;
    this.emailService = deps.emailService;
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.db) return;
    // Lazy-init to make cron + routes resilient even when explicit DI is missing.
    const { getDatabaseAsync } = await import('../database/Database.js');
    const db = await getDatabaseAsync();
    const rbMod = await import('./reportBuilderService.js');
    const reportBuilderService = (rbMod as any).default || rbMod;
    this.setDependencies({ db, reportBuilderService });
  }

  // ============================================
  // SCHEDULE CRUD
  // ============================================

  /**
   * Create a new report schedule
   */
  async createSchedule(
    request: ScheduleCreateRequest,
    organizationId: string,
    userId: string
  ): Promise<ReportSchedule> {
    await this.ensureInitialized();
    const id = uuidv4();
    const now = new Date().toISOString();

    // Determine cron expression
    const cronExpression = request.cronExpression || FREQUENCY_CRON_MAP[request.frequency];
    const timezone = request.timezone || 'UTC';

    // Calculate next run
    const nextRunAt = this.calculateNextRun(cronExpression, timezone, request.startDate);

    const scheduleType = request.scheduleType || 'time_based';
    const deliverableType = request.deliverableType || 'report';
    const scopeType = request.scopeType || 'organization';

    const schedule: ReportSchedule = {
      id,
      organizationId,
      name: request.name,
      description: request.description,
      templateId: request.templateId,
      reportType: request.reportType,
      sourceAssessmentId: request.sourceAssessmentId,
      sourceProjectId: request.sourceProjectId,
      scheduleType,
      deliverableType,
      scopeType,
      scopeId: request.scopeId,
      frequency: request.frequency,
      cronExpression,
      timezone,
      nextRunAt: scheduleType === 'event_triggered' ? null : nextRunAt,
      lastRunAt: null,
      lastRunStatus: null,
      lastRunReportId: null,
      runCount: 0,
      deliveryMethods: request.deliveryMethods,
      deliveryConfig: request.deliveryConfig,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.run(
      `INSERT INTO report_schedules (
        id, organization_id, schedule_name, cron_expression, timezone,
        next_run_at, last_run_at, last_run_status, last_run_report_id,
        run_count, is_active, config_json, created_by, created_at, updated_at,
        schedule_type, deliverable_type, scope_type, scope_id, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.organizationId,
        schedule.name,
        schedule.cronExpression,
        schedule.timezone,
        schedule.nextRunAt,
        schedule.lastRunAt,
        schedule.lastRunStatus,
        schedule.lastRunReportId,
        schedule.runCount,
        schedule.isActive ? 1 : 0,
        JSON.stringify({
          description: schedule.description,
          templateId: schedule.templateId,
          reportType: schedule.reportType,
          sourceAssessmentId: schedule.sourceAssessmentId,
          sourceProjectId: schedule.sourceProjectId,
          frequency: schedule.frequency,
          deliveryMethods: schedule.deliveryMethods,
          deliveryConfig: schedule.deliveryConfig,
        }),
        schedule.createdBy,
        schedule.createdAt,
        schedule.updatedAt,
        schedule.scheduleType,
        schedule.deliverableType,
        schedule.scopeType,
        schedule.scopeId || null,
        schedule.description || null,
      ]
    );

    return schedule;
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    scheduleId: string,
    organizationId: string,
    updates: ScheduleUpdateRequest
  ): Promise<ReportSchedule | null> {
    await this.ensureInitialized();
    const existing = await this.getSchedule(scheduleId, organizationId);
    if (!existing) return null;

    const now = new Date().toISOString();

    const updated: ReportSchedule = {
      ...existing,
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description,
      scheduleType: updates.scheduleType ?? existing.scheduleType,
      deliverableType: updates.deliverableType ?? existing.deliverableType,
      scopeType: updates.scopeType ?? existing.scopeType,
      scopeId: updates.scopeId ?? existing.scopeId,
      frequency: updates.frequency ?? existing.frequency,
      cronExpression: updates.cronExpression ?? existing.cronExpression,
      timezone: updates.timezone ?? existing.timezone,
      deliveryMethods: updates.deliveryMethods ?? existing.deliveryMethods,
      deliveryConfig: updates.deliveryConfig ?? existing.deliveryConfig,
      isActive: updates.isActive ?? existing.isActive,
      updatedAt: now,
    };

    if (updates.cronExpression || updates.timezone) {
      updated.nextRunAt = this.calculateNextRun(updated.cronExpression, updated.timezone);
    }

    if (updated.scheduleType === 'event_triggered') {
      updated.nextRunAt = null;
    }

    await this.db.run(
      `UPDATE report_schedules SET
        schedule_name = ?, cron_expression = ?, timezone = ?,
        next_run_at = ?, is_active = ?, config_json = ?, updated_at = ?,
        schedule_type = ?, deliverable_type = ?, scope_type = ?, scope_id = ?, description = ?
       WHERE id = ? AND organization_id = ?`,
      [
        updated.name,
        updated.cronExpression,
        updated.timezone,
        updated.nextRunAt,
        updated.isActive ? 1 : 0,
        JSON.stringify({
          description: updated.description,
          templateId: updated.templateId,
          reportType: updated.reportType,
          sourceAssessmentId: updated.sourceAssessmentId,
          sourceProjectId: updated.sourceProjectId,
          frequency: updated.frequency,
          deliveryMethods: updated.deliveryMethods,
          deliveryConfig: updated.deliveryConfig,
        }),
        updated.updatedAt,
        updated.scheduleType,
        updated.deliverableType,
        updated.scopeType,
        updated.scopeId || null,
        updated.description || null,
        scheduleId,
        organizationId,
      ]
    );

    return updated;
  }

  /**
   * Get a schedule by ID
   */
  async getSchedule(scheduleId: string, organizationId: string): Promise<ReportSchedule | null> {
    await this.ensureInitialized();
    const row = await this.db.get(
      `SELECT * FROM report_schedules WHERE id = ? AND organization_id = ?`,
      [scheduleId, organizationId]
    );

    if (!row) return null;
    return this.mapRowToSchedule(row);
  }

  /**
   * List schedules for an organization
   */
  async listSchedules(
    organizationId: string,
    options?: {
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<ReportSchedule[]> {
    await this.ensureInitialized();
    let query = `SELECT * FROM report_schedules WHERE organization_id = ?`;
    const params: any[] = [organizationId];

    if (options?.isActive !== undefined) {
      query += ` AND is_active = ?`;
      params.push(options.isActive ? 1 : 0);
    }

    query += ` ORDER BY next_run_at ASC`;

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const rows = await this.db.all(query, params);
    return rows.map((row: any) => this.mapRowToSchedule(row));
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string, organizationId: string): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.db.run(
      `DELETE FROM report_schedules WHERE id = ? AND organization_id = ?`,
      [scheduleId, organizationId]
    );

    return result.changes > 0;
  }

  /**
   * Pause a schedule
   */
  async pauseSchedule(scheduleId: string, organizationId: string): Promise<ReportSchedule | null> {
    await this.ensureInitialized();
    return this.updateSchedule(scheduleId, organizationId, { isActive: false });
  }

  /**
   * Resume a schedule
   */
  async resumeSchedule(scheduleId: string, organizationId: string): Promise<ReportSchedule | null> {
    await this.ensureInitialized();
    const schedule = await this.getSchedule(scheduleId, organizationId);
    if (!schedule) return null;

    // Recalculate next run from now
    const nextRunAt = this.calculateNextRun(schedule.cronExpression, schedule.timezone);

    await this.db.run(
      `UPDATE report_schedules SET is_active = 1, next_run_at = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [nextRunAt, new Date().toISOString(), scheduleId, organizationId]
    );

    return this.getSchedule(scheduleId, organizationId);
  }

  // ============================================
  // EXECUTION
  // ============================================

  /**
   * Get schedules due for execution
   */
  async getDueSchedules(): Promise<ReportSchedule[]> {
    await this.ensureInitialized();
    const now = new Date().toISOString();

    const rows = await this.db.all(
      `SELECT * FROM report_schedules 
       WHERE is_active = 1 AND next_run_at <= ?
       ORDER BY next_run_at ASC`,
      [now]
    );

    return rows.map((row: any) => this.mapRowToSchedule(row));
  }

  /**
   * Execute a scheduled report generation
   */
  async executeSchedule(
    scheduleId: string,
    triggerContext?: { triggerType: string; triggerReason: string }
  ): Promise<ScheduleExecution> {
    await this.ensureInitialized();
    const executionId = uuidv4();
    const startedAt = new Date().toISOString();

    const execution: ScheduleExecution = {
      id: executionId,
      scheduleId,
      status: 'running',
      startedAt,
      triggerType: triggerContext?.triggerType || 'cron',
      triggerReason: triggerContext?.triggerReason,
      deliveryResults: [],
    };

    try {
      // Get schedule
      const schedule = await this.db.get(`SELECT * FROM report_schedules WHERE id = ?`, [
        scheduleId,
      ]);

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      const scheduleData = this.mapRowToSchedule(schedule);

      // Generate report
      let reportId: string | null = null;
      let bundleZip: Buffer | null = null;
      let bundleBaseName: string | null = null;

      // W6.1 — bridge do generatora M17 gdy deliverableType === 'bundle'.
      if (scheduleData.deliverableType === 'bundle') {
        const brief = scheduleData.description?.trim() || scheduleData.name;
        if (brief && brief.length >= 20) {
          const { generateBundle } = await import('./deliverables/bundleGenerationRuntime.js');
          const { exportBundleFiles, bundleFilesToZip, safeBundleBaseName } = await import('./deliverables/bundleExportRuntime.js');
          const bundle = await generateBundle(brief, { orgId: scheduleData.organizationId, preferPremium: true });
          if (bundle) {
            const files = await exportBundleFiles(bundle);
            bundleBaseName = safeBundleBaseName(bundle.spine.meta.company);
            bundleZip = await bundleFilesToZip(files, bundleBaseName);
            reportId = `bundle-${uuidv4()}`;
          }
        }
      } else if (this.reportBuilderService) {
        // Step 1: Create report structure from template
        const report = await this.reportBuilderService.generateFromTemplate(
          scheduleData.templateId,
          scheduleData.organizationId,
          scheduleData.createdBy,
          {
            assessmentId: scheduleData.sourceAssessmentId,
            projectId: scheduleData.sourceProjectId,
            config: {
              // preserve schedule intent in report config for generation "voice"
              scheduleName: scheduleData.name,
              scheduleFrequency: scheduleData.frequency,
            },
          }
        );
        reportId = report?.id;

        // Step 2: Generate content for all sections (minimal recurring pipeline)
        if (reportId) {
          const rgMod = await import('./reportGenerationService.js');
          const generateFullReport = (rgMod as any).generateFullReport as any;
          if (typeof generateFullReport === 'function') {
            await generateFullReport(
              reportId,
              scheduleData.organizationId,
              scheduleData.createdBy,
              {
                regenerateAll: false,
              }
            );
          }
        }
      }

      execution.generatedReportId = reportId || undefined;

      // Deliver report (or bundle ZIP)
      if (reportId) {
        const zipAttachment = bundleZip
          ? { filename: `${bundleBaseName ?? 'material'}-komplet.zip`, contentBase64: bundleZip.toString('base64') }
          : undefined;
        execution.deliveryResults = await this.deliverReport(scheduleData, reportId, zipAttachment);
      }

      // Update schedule
      const nextRunAt = this.calculateNextRun(scheduleData.cronExpression, scheduleData.timezone);

      await this.db.run(
        `UPDATE report_schedules SET
          last_run_at = ?, last_run_status = 'success', last_run_report_id = ?,
          next_run_at = ?, run_count = run_count + 1, updated_at = ?
         WHERE id = ?`,
        [startedAt, reportId, nextRunAt, new Date().toISOString(), scheduleId]
      );

      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.completedAt = new Date().toISOString();

      // Update schedule with failure
      await this.db.run(
        `UPDATE report_schedules SET
          last_run_at = ?, last_run_status = 'failed', updated_at = ?
         WHERE id = ?`,
        [startedAt, new Date().toISOString(), scheduleId]
      );
    }

    // Log execution
    await this.logExecution(execution);

    return execution;
  }

  /**
   * Deliver report via configured methods.
   * `bundleAttachment` (W6.1): opjonalny ZIP wiązki M17 — dołączany do emaila.
   */
  private async deliverReport(
    schedule: ReportSchedule,
    reportId: string,
    bundleAttachment?: { filename: string; contentBase64: string },
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const method of schedule.deliveryMethods) {
      try {
        switch (method) {
          case 'email':
            await this.deliverViaEmail(schedule, reportId, bundleAttachment);
            results.push({
              method: 'email',
              status: 'success',
              timestamp: new Date().toISOString(),
            });
            break;

          case 'webhook':
            await this.deliverViaWebhook(schedule, reportId);
            results.push({
              method: 'webhook',
              status: 'success',
              timestamp: new Date().toISOString(),
            });
            break;

          case 'storage':
            await this.deliverToStorage(schedule, reportId);
            results.push({
              method: 'storage',
              status: 'success',
              timestamp: new Date().toISOString(),
            });
            break;

          case 'dashboard':
            // Dashboard delivery is automatic (report is in the system)
            results.push({
              method: 'dashboard',
              status: 'success',
              details: 'Report available in dashboard',
              timestamp: new Date().toISOString(),
            });
            break;
        }
      } catch (error) {
        results.push({
          method,
          status: 'failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  /**
   * Deliver report via email.
   * W6.1: `bundleAttachment` — ZIP wiązki M17 (base64) dołączany jako plik.
   */
  private async deliverViaEmail(
    schedule: ReportSchedule,
    reportId: string,
    bundleAttachment?: { filename: string; contentBase64: string },
  ): Promise<void> {
    const emailConfig = schedule.deliveryConfig.email;
    if (!emailConfig || !emailConfig.recipients?.length) return;

    // W6.3/W6.4 — governance odbiorców: walidacja + dedupe + opt-out + limit PRZED wysyłką.
    const { allowed: governedRecipients, rejected } = governRecipients(emailConfig.recipients, {
      optOut: emailConfig.optOut ?? [],
    });
    if (rejected.length > 0) {
      logger.info(
        `[ScheduledReportService] ${rejected.length} odbiorców odrzuconych (governance): ` +
        rejected.map((r) => `${r.email}:${r.reason}`).join(', '),
      );
    }
    if (governedRecipients.length === 0) {
      logger.warn(`[ScheduledReportService] brak ważnych odbiorców po governance (report ${reportId})`);
      return;
    }

    // W6.2 — un-stub: realnie WYŚLIJ przez emailService. Wcześniej tylko logowało
    // (a `this.emailService` bywa nieustawiony w cron-path → 0 wysyłek). Importujemy
    // realny `send` z modułu; fallback na wstrzyknięty serwis gdy obecny.
    const subject = emailConfig.subject || `Raport „${schedule.name}" gotowy`;
    const html =
      `<p>Zaplanowany raport <strong>${schedule.name}</strong> został wygenerowany.</p>` +
      `<p>Identyfikator raportu: <code>${reportId}</code></p>` +
      (bundleAttachment
        ? `<p>W załączniku znajdziesz komplet plików (DOCX+XLSX+PPTX).</p>`
        : `<p>Materiał jest dostępny w bibliotece „Materiały".</p>`);

    // W6.1 — dołącz ZIP wiązki gdy dostępny.
    const attachments = bundleAttachment
      ? [{ filename: bundleAttachment.filename, content: bundleAttachment.contentBase64, contentType: 'application/zip' }]
      : undefined;

    let sendFn: ((opts: { to: string; subject: string; html: string; attachments?: unknown[] }) => Promise<unknown>) | null = null;
    if (this.emailService?.send) {
      sendFn = (opts) => this.emailService.send(opts);
    } else {
      const mod = await import('./emailService.js');
      sendFn = (opts) => mod.send(opts as never);
    }

    for (const to of governedRecipients) {
      try {
        await sendFn({ to, subject, html, ...(attachments ? { attachments } : {}) });
        logger.info(`[ScheduledReportService] email sent to ${to} (report ${reportId})`);
      } catch (err) {
        logger.warn(
          `[ScheduledReportService] email to ${to} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  /**
   * Deliver report via webhook
   */
  private async deliverViaWebhook(schedule: ReportSchedule, reportId: string): Promise<void> {
    const webhookConfig = schedule.deliveryConfig.webhook;
    if (!webhookConfig) return;

    const payload = {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      reportId,
      timestamp: new Date().toISOString(),
    };

    await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...webhookConfig.headers,
      },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Deliver report to storage
   */
  private async deliverToStorage(schedule: ReportSchedule, reportId: string): Promise<void> {
    const storageConfig = schedule.deliveryConfig.storage;
    if (!storageConfig) return;

    // This would integrate with file storage service
    logger.info(`[ScheduledReportService] Saving report to ${storageConfig.path}`);
  }

  /**
   * Log execution for audit
   */
  private async logExecution(execution: ScheduleExecution): Promise<void> {
    try {
      await this.db.run(
        `INSERT INTO schedule_executions (
          id, schedule_id, status, started_at, completed_at,
          generated_report_id, error, delivery_results_json,
          trigger_type, trigger_reason, deliverable_type, generated_presentation_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          execution.id,
          execution.scheduleId,
          execution.status,
          execution.startedAt,
          execution.completedAt,
          execution.generatedReportId,
          execution.error,
          JSON.stringify(execution.deliveryResults),
          execution.triggerType || null,
          execution.triggerReason || null,
          execution.deliverableType || null,
          execution.generatedPresentationId || null,
        ]
      );
    } catch (error) {
      logger.error('[ScheduledReportService] Failed to log execution:', error);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Calculate next run time based on cron expression
   */
  private calculateNextRun(cronExpression: string, timezone: string, startDate?: string): string {
    // Simplified next run calculation
    // In production, use a proper cron parser like 'cron-parser'
    const now = startDate ? new Date(startDate) : new Date();

    // Parse cron parts: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      // Default to next day at 9 AM
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next.toISOString();
    }

    const [minute, hour] = parts;
    const next = new Date(now);

    // Set time
    next.setHours(parseInt(hour) || 9, parseInt(minute) || 0, 0, 0);

    // If time has passed today, move to next day
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  }

  /**
   * Map database row to schedule object
   */
  private mapRowToSchedule(row: any): ReportSchedule {
    const config = JSON.parse(row.config_json || '{}');

    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.schedule_name,
      description: row.description || config.description,
      templateId: config.templateId || row.report_template_id,
      reportType: config.reportType || 'assessment',
      sourceAssessmentId: config.sourceAssessmentId || row.source_assessment_id,
      sourceProjectId: config.sourceProjectId,
      scheduleType: row.schedule_type || 'time_based',
      deliverableType: row.deliverable_type || 'report',
      scopeType: row.scope_type || 'organization',
      scopeId: row.scope_id,
      frequency: config.frequency || 'monthly',
      cronExpression: row.cron_expression,
      timezone: row.timezone || 'UTC',
      nextRunAt: row.next_run_at,
      lastRunAt: row.last_run_at,
      lastRunStatus: row.last_run_status,
      lastRunReportId: row.last_run_report_id,
      runCount: row.run_count || 0,
      deliveryMethods: config.deliveryMethods || ['dashboard'],
      deliveryConfig: config.deliveryConfig || {},
      isActive: Boolean(row.is_active),
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get execution history for a schedule
   */
  async getExecutionHistory(
    scheduleId: string,
    organizationId: string,
    limit: number = 10
  ): Promise<ScheduleExecution[]> {
    await this.ensureInitialized();
    const rows = await this.db.all(
      `SELECT e.* FROM schedule_executions e
       JOIN report_schedules s ON e.schedule_id = s.id
       WHERE e.schedule_id = ? AND s.organization_id = ?
       ORDER BY e.started_at DESC
       LIMIT ?`,
      [scheduleId, organizationId, limit]
    );

    return rows.map((row: any) => ({
      id: row.id,
      scheduleId: row.schedule_id,
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      generatedReportId: row.generated_report_id,
      generatedPresentationId: row.generated_presentation_id,
      triggerType: row.trigger_type,
      triggerReason: row.trigger_reason,
      deliverableType: row.deliverable_type,
      error: row.error,
      deliveryResults: JSON.parse(row.delivery_results_json || '[]'),
    }));
  }

  /**
   * Get frequency presets
   */
  getFrequencyPresets(): { frequency: ScheduleFrequency; label: string; cron: string }[] {
    return [
      { frequency: 'daily', label: 'Daily at 9 AM', cron: FREQUENCY_CRON_MAP.daily },
      { frequency: 'weekly', label: 'Weekly on Monday', cron: FREQUENCY_CRON_MAP.weekly },
      { frequency: 'biweekly', label: 'Bi-weekly (1st & 15th)', cron: FREQUENCY_CRON_MAP.biweekly },
      { frequency: 'monthly', label: 'Monthly on 1st', cron: FREQUENCY_CRON_MAP.monthly },
      { frequency: 'quarterly', label: 'Quarterly', cron: FREQUENCY_CRON_MAP.quarterly },
    ];
  }

  /**
   * Process all due time-based schedules (called periodically).
   * For each due schedule, executes report generation.
   */
  async processScheduledReports(): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
  }> {
    await this.ensureInitialized();
    const dueSchedules = await this.getDueSchedules();
    let succeeded = 0;
    let failed = 0;

    for (const schedule of dueSchedules) {
      try {
        const execution = await this.executeSchedule(schedule.id, {
          triggerType: 'cron',
          triggerReason: `Scheduled run (${schedule.frequency})`,
        });
        if (execution.status === 'success') {
          succeeded++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error(`[ScheduledReportService] Failed to process schedule ${schedule.id}:`, error);
        failed++;
      }
    }

    return { processed: dueSchedules.length, succeeded, failed };
  }
}

export const scheduledReportService = new ScheduledReportService();
export default ScheduledReportService;
