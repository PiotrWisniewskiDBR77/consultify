// @ts-nocheck
/**
 * Initiative Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all initiative-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import {
  canExecuteGate,
  GateType,
  getGateForTransition,
  isValidTransition,
  VALID_TRANSITIONS,
} from '../constants/initiativeStatuses.js';
import notificationService from '../services/notificationService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';
import type {
  CreateInitiativeRequest,
  UpdateInitiativeRequest,
  UpdateInitiativeStatusRequest,
} from '../validators/initiative.validators.js';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const safeJsonParse = <T = unknown>(
  str: string | null | undefined,
  defaultValue: T[] = [] as T[]
): T[] => {
  if (!str || str === '' || str === 'null' || str === 'undefined') {
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(str);
    return parsed || defaultValue;
  } catch (e: unknown) {
    logger.warn('[initiatives] Failed to parse JSON:', str?.substring?.(0, 100));
    return defaultValue;
  }
};

const normalizeStatus = (value: string | null | undefined): string =>
  String(value || '').toUpperCase();

const hasApprovedGateDecision = async (
  orgId: string,
  initiativeId: string,
  pmoDomain: string
): Promise<boolean> => {
  const sql = `
        SELECT id, status, decision_maker_id, deadline
        FROM decisions
        WHERE organization_id = ?
          AND initiative_id = ?
          AND pmo_domain = ?
    `;
  const rows = await queryHelpers.queryAll(sql, [orgId, initiativeId, pmoDomain]);
  return rows.some((row: Record<string, unknown>) => {
    const status = String(row.status || '').toLowerCase();
    const hasOwner = !!row.decision_maker_id;
    const hasDueDate = !!row.deadline;
    return status === 'approved' && hasOwner && hasDueDate;
  });
};

const getInitiativeNotificationRecipients = async (
  orgId: string,
  initiativeId: string
): Promise<string[]> => {
  const recipients = new Set<string>();

  const initiative = await queryHelpers.queryOne(
    `SELECT owner_business_id, owner_execution_id, sponsor_id, name
     FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );

  const ownerBusinessId = (initiative as any)?.owner_business_id;
  const ownerExecutionId = (initiative as any)?.owner_execution_id;
  const sponsorId = (initiative as any)?.sponsor_id;
  [ownerBusinessId, ownerExecutionId, sponsorId]
    .filter(Boolean)
    .forEach((id: string) => recipients.add(id));

  // Watchers (if feature enabled)
  try {
    const watcherRows = await queryHelpers.queryAll(
      `SELECT w.user_id as userId
       FROM initiative_watchers w
       JOIN initiatives i ON i.id = w.initiative_id
       WHERE w.initiative_id = ? AND i.organization_id = ?`,
      [initiativeId, orgId]
    );
    watcherRows.forEach((r: any) => r?.userId && recipients.add(r.userId));
  } catch {
    // table may not exist yet
  }

  // Stakeholders (RACI)
  try {
    const stakeholderRows = await queryHelpers.queryAll(
      `SELECT s.user_id as userId
       FROM initiative_stakeholders s
       JOIN initiatives i ON i.id = s.initiative_id
       WHERE s.initiative_id = ? AND i.organization_id = ? AND s.user_id IS NOT NULL`,
      [initiativeId, orgId]
    );
    stakeholderRows.forEach((r: any) => r?.userId && recipients.add(r.userId));
  } catch {
    // table may not exist yet
  }

  return Array.from(recipients);
};

const hasPendingExecutionGateDecisions = async (
  orgId: string,
  initiativeId: string
): Promise<boolean> => {
  const columns = await queryHelpers.getTableColumns('decisions');
  const hasColumn = (column: string) => columns.some((col) => col.name === column);
  const hasInitiativeId = hasColumn('initiative_id');
  const hasTaskId = hasColumn('task_id');
  const hasRelatedObjectType = hasColumn('related_object_type');
  const hasRelatedObjectId = hasColumn('related_object_id');
  const hasType = hasColumn('type');

  const params: Array<string> = [orgId];
  let sql = `
        SELECT d.id
        FROM decisions d
    `;

  if (hasTaskId) {
    sql += ' LEFT JOIN tasks t ON d.task_id = t.id';
  }

  sql += ' WHERE d.organization_id = ?';

  const scopeConditions: string[] = [];
  if (hasInitiativeId) {
    scopeConditions.push('d.initiative_id = ?');
    params.push(initiativeId);
  }
  if (hasTaskId) {
    scopeConditions.push('t.initiative_id = ?');
    params.push(initiativeId);
  }
  if (hasRelatedObjectType && hasRelatedObjectId) {
    scopeConditions.push("(d.related_object_type = 'initiative' AND d.related_object_id = ?)");
    params.push(initiativeId);
  }

  if (scopeConditions.length === 0) {
    return false;
  }

  sql += ` AND (${scopeConditions.join(' OR ')})`;
  sql += ` AND d.status IN ('pending', 'escalated')`;

  if (hasType) {
    sql += ` AND d.type IN ('SCOPE_CHANGE', 'RISK_ACCEPTANCE', 'BLOCKER_RESOLUTION', 'PHASE_TRANSITION')`;
  }

  sql += ' LIMIT 1';
  const rows = await queryHelpers.queryAll(sql, params);
  return rows.length > 0;
};

/**
 * Parse multilingual text and return translation for user's language
 * @param text - JSON string with translations {pl: '...', en: '...', ...} or plain string
 * @param userLang - User's language code (default: 'en')
 * @returns Translated text or original if not multilingual
 */
const getMultilingualText = (text: string | null | undefined, userLang: string = 'en'): string => {
  if (!text) return '';

  // If it's a plain string (not JSON), return as-is
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return text;
  }

  try {
    const translations = JSON.parse(text);
    // Check if it's a multilingual object
    if (typeof translations === 'object' && translations !== null && !Array.isArray(translations)) {
      // Return translation for user's language, fallback to English, then first available
      return (
        translations[userLang] ||
        translations.en ||
        translations[Object.keys(translations)[0]] ||
        text
      );
    }
    return text;
  } catch {
    // Not JSON, return as-is
    return text;
  }
};

// ==========================================
// CONTROLLER METHODS
// ==========================================

export class InitiativeController {
  /**
   * Get all initiatives for organization
   */
  static getInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const headers = req.headers || {};
      const acceptLang =
        (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const { status, source, sourceAssessmentId } = req.query as {
        status?: string;
        source?: string;
        sourceAssessmentId?: string;
      };
      const params: Array<unknown> = [orgId];
      let sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            WHERE i.organization_id = ?
        `;
      if (status) {
        sql += ` AND UPPER(i.status) = ?`;
        params.push(normalizeStatus(status));
      }

      // Assessment module support: show initiatives derived from assessments/reports
      if (source && source.toString().toLowerCase() === 'assessment') {
        // Canonical source tracking (preferred): source_type/source_id
        // Backward compatible (legacy): source_assessment_id/source_report_id/created_from
        sql += ` AND (
          (LOWER(COALESCE(i.source_type,'')) IN ('assessment','assessment_report') AND COALESCE(i.source_id,'') <> '')
          OR i.source_assessment_id IS NOT NULL
          OR i.source_report_id IS NOT NULL
          OR LOWER(COALESCE(i.created_from,'')) = 'assessment'
        )`;
      }
      if (sourceAssessmentId) {
        // Match both canonical and legacy assessment linkage
        sql += ` AND (
          i.source_assessment_id = ?
          OR (LOWER(COALESCE(i.source_type,'')) = 'assessment' AND i.source_id = ?)
        )`;
        params.push(sourceAssessmentId, sourceAssessmentId);
      }
      sql += ` ORDER BY i.created_at DESC`;

      const rows = await queryHelpers.queryAll(sql, params);

      const initiatives = rows.map((i: Record<string, unknown>) => ({
        id: i.id,
        organizationId: i.organization_id,
        projectId: i.project_id,
        name: getMultilingualText((i.name as string) || (i.title as string), lang),
        axis: i.axis,
        area: i.area,
        summary: getMultilingualText(i.summary as string, lang),
        hypothesis: i.hypothesis,
        status: i.status,
        initiativeTemplateId: (i as any).initiative_template_id ?? null,
        progress: i.progress || 0,
        currentStage: i.current_stage,
        sourceType: i.source_type,
        sourceId: i.source_id,
        businessValue: i.business_value,
        costCapex: i.cost_capex,
        costOpex: i.cost_opex,
        expectedRoi: i.expected_roi,
        valueDriver: i.value_driver,
        confidenceLevel: i.confidence_level,
        valueTiming: i.value_timing,
        plannedStartDate: i.planned_start_date,
        plannedEndDate: i.planned_end_date,
        actualStartDate: i.actual_start_date,
        actualEndDate: i.actual_end_date,
        problemStatement: i.problem_statement,
        deliverables: safeJsonParse(i.deliverables as string, []),
        successCriteria: safeJsonParse(i.success_criteria as string, []),
        scopeIn: safeJsonParse(i.scope_in as string, []),
        scopeOut: safeJsonParse(i.scope_out as string, []),
        keyRisks: safeJsonParse(i.key_risks as string, []),
        ownerBusiness: i.owner_business_id
          ? {
              id: i.owner_business_id,
              firstName: i.ob_first_name,
              lastName: i.ob_last_name,
              avatarUrl: i.ob_avatar,
            }
          : null,
        ownerExecution: i.owner_execution_id
          ? {
              id: i.owner_execution_id,
              firstName: i.oe_first_name,
              lastName: i.oe_last_name,
              avatarUrl: i.oe_avatar,
            }
          : null,
      }));

      res.json(initiatives);
    }
  );

  /**
   * Get single initiative by ID
   */
  static getInitiativeById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const headers = req.headers || {};
      const acceptLang =
        (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            WHERE i.id = ? AND i.organization_id = ?
        `;

      const initiative = await queryHelpers.queryOne(sql, [id, orgId]);
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const i = initiative as Record<string, unknown>;

      // Parse JSON fields and apply multilingual text
      const parsed = {
        ...initiative,
        name: getMultilingualText((i.name as string) || (i.title as string), lang),
        summary: getMultilingualText(i.summary as string, lang),
        deliverables: safeJsonParse(i.deliverables as string, []),
        successCriteria: safeJsonParse(i.success_criteria as string, []),
        scopeIn: safeJsonParse(i.scope_in as string, []),
        scopeOut: safeJsonParse(i.scope_out as string, []),
        keyRisks: safeJsonParse(i.key_risks as string, []),
        sourceType: i.source_type,
        sourceId: i.source_id,
        initiativeTemplateId: (i as any).initiative_template_id ?? null,
      };

      res.json(parsed);
    }
  );

  /**
   * Create a new initiative
   */
  static createInitiative = asyncHandler(
    async (req: AuthenticatedRequest<CreateInitiativeRequest>, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        projectId,
        title,
        axis,
        area,
        summary,
        hypothesis,
        businessValue,
        costCapex,
        costOpex,
        expectedRoi,
        valueDriver,
        confidenceLevel,
        valueTiming,
        status,
        plannedStartDate,
        plannedEndDate,
        ownerBusinessId,
        ownerExecutionId,
        problemStatement,
        deliverables,
        successCriteria,
        scopeIn,
        scopeOut,
        keyRisks,
      } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }

      // TODO: Check access policy when AccessPolicyService is migrated

      const id = uuidv4();
      const now = new Date().toISOString();

      const sql = `
            INSERT INTO initiatives (
                id, organization_id, project_id, title, axis, area, summary, hypothesis, status,
                business_value, cost_capex, cost_opex, expected_roi,
                value_driver, confidence_level, value_timing,
                planned_start_date, planned_end_date,
                owner_business_id, owner_execution_id,
                problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      try {
        await queryHelpers.queryRun(sql, [
          id,
          orgId,
          projectId ?? null,
          title,
          axis ?? null,
          area ?? null,
          summary ?? null,
          hypothesis ?? null,
          status ?? null,
          businessValue ?? null,
          costCapex ?? null,
          costOpex ?? null,
          expectedRoi ?? null,
          valueDriver ?? null,
          confidenceLevel ?? null,
          valueTiming ?? null,
          plannedStartDate ?? null,
          plannedEndDate ?? null,
          ownerBusinessId ?? null,
          ownerExecutionId ?? null,
          problemStatement ?? null,
          JSON.stringify(deliverables || []),
          JSON.stringify(successCriteria || []),
          JSON.stringify(scopeIn || []),
          JSON.stringify(scopeOut || []),
          JSON.stringify(keyRisks || []),
          now,
          now,
        ]);
      } catch (error) {
        const legacySql = `
              INSERT INTO initiatives (
                  id, organization_id, project_id, name, axis, area, summary, hypothesis, status,
                  business_value, cost_capex, cost_opex, expected_roi,
                  start_date, end_date,
                  owner_business_id, owner_execution_id,
                  problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                  created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
        await queryHelpers.queryRun(legacySql, [
          id,
          orgId,
          projectId ?? null,
          title,
          axis ?? null,
          area ?? null,
          summary ?? null,
          hypothesis ?? null,
          status ?? null,
          businessValue ?? null,
          costCapex ?? null,
          costOpex ?? null,
          expectedRoi ?? null,
          plannedStartDate ?? null,
          plannedEndDate ?? null,
          ownerBusinessId ?? null,
          ownerExecutionId ?? null,
          problemStatement ?? null,
          JSON.stringify(deliverables || []),
          JSON.stringify(successCriteria || []),
          JSON.stringify(scopeIn || []),
          JSON.stringify(scopeOut || []),
          JSON.stringify(keyRisks || []),
          now,
          now,
        ]);
      }

      res.json({ id, name: title, message: 'Initiative created' });
    }
  );

  /**
   * Update initiative
   */
  static updateInitiative = asyncHandler(
    async (req: AuthenticatedRequest<UpdateInitiativeRequest>, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // 1. Fetch existing initiative
      const existing = await queryHelpers.queryOne(
        `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const currentStatus = normalizeStatus((existing as any).status);
      const actorId = userId;
      const actorName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || undefined;

      // 2. Block editing for terminal statuses (CANCELLED, ARCHIVED)
      if (currentStatus === 'CANCELLED' || currentStatus === 'ARCHIVED') {
        res.status(403).json({
          error: 'Cannot edit initiative in terminal status',
          status: currentStatus,
        });
        return;
      }

      // 3. Build update map — only include fields that are provided
      const body = req.body as Record<string, unknown>;
      const FIELD_MAP: Record<string, string> = {
        title: 'title',
        axis: 'axis',
        area: 'area',
        summary: 'summary',
        hypothesis: 'hypothesis',
        businessValue: 'business_value',
        costCapex: 'cost_capex',
        costOpex: 'cost_opex',
        expectedRoi: 'expected_roi',
        valueDriver: 'value_driver',
        confidenceLevel: 'confidence_level',
        valueTiming: 'value_timing',
        plannedStartDate: 'planned_start_date',
        plannedEndDate: 'planned_end_date',
        ownerBusinessId: 'owner_business_id',
        ownerExecutionId: 'owner_execution_id',
        problemStatement: 'problem_statement',
      };

      // JSON array fields (stored as JSON strings)
      const JSON_FIELDS: Record<string, string> = {
        deliverables: 'deliverables',
        successCriteria: 'success_criteria',
        scopeIn: 'scope_in',
        scopeOut: 'scope_out',
        keyRisks: 'key_risks',
      };

      const updates: string[] = [];
      const params: unknown[] = [];
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

      // Process scalar fields
      for (const [bodyKey, dbCol] of Object.entries(FIELD_MAP)) {
        if (body[bodyKey] !== undefined) {
          const oldVal = (existing as Record<string, unknown>)[dbCol];
          const newVal = body[bodyKey];
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes.push({ field: bodyKey, oldValue: oldVal, newValue: newVal });
          }
          updates.push(`${dbCol} = ?`);
          params.push(newVal ?? null);
        }
      }

      // Process JSON array fields
      for (const [bodyKey, dbCol] of Object.entries(JSON_FIELDS)) {
        if (body[bodyKey] !== undefined) {
          const newJson = JSON.stringify(body[bodyKey] || []);
          const oldJson = (existing as Record<string, unknown>)[dbCol];
          if (String(oldJson || '[]') !== newJson) {
            changes.push({ field: bodyKey, oldValue: oldJson, newValue: body[bodyKey] });
          }
          updates.push(`${dbCol} = ?`);
          params.push(newJson);
        }
      }

      if (updates.length === 0) {
        res.json({ id, message: 'No changes detected' });
        return;
      }

      // 4. Date validation
      const finalStart = (body.plannedStartDate ?? (existing as any).planned_start_date) as
        | string
        | null;
      const finalEnd = (body.plannedEndDate ?? (existing as any).planned_end_date) as string | null;
      if (finalStart && finalEnd) {
        const startDate = new Date(finalStart);
        const endDate = new Date(finalEnd);
        if (!Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
          if (startDate > endDate) {
            res.status(400).json({ error: 'plannedStartDate must be before plannedEndDate' });
            return;
          }
        }
      }

      // 5. Execute the update
      const now = new Date().toISOString();
      updates.push('updated_at = ?');
      params.push(now);
      if (userId) {
        updates.push('updated_by = ?');
        params.push(userId);
      }
      params.push(id, orgId);

      const sql = `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, params);

      // 6. Log changes to initiative_history (diff audit trail)
      if (changes.length > 0) {
        try {
          const historyId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO initiative_history (id, initiative_id, organization_id, action, actor_id, actor_name, changes, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              historyId,
              id,
              orgId,
              'fields_updated',
              actorId || null,
              actorName || null,
              JSON.stringify(
                changes.map((c) => ({
                  field: c.field,
                  from: c.oldValue,
                  to: c.newValue,
                }))
              ),
              now,
            ]
          );
        } catch {
          // history table may not exist - best effort
          logger.warn('[initiatives] Could not write to initiative_history');
        }
      }

      // 7. Emit notifications for critical changes (owner changes)
      try {
        const ownerBusinessChanged =
          body.ownerBusinessId !== undefined &&
          String(body.ownerBusinessId || '') !== String((existing as any).owner_business_id || '');
        const ownerExecutionChanged =
          body.ownerExecutionId !== undefined &&
          String(body.ownerExecutionId || '') !==
            String((existing as any).owner_execution_id || '');

        if (ownerBusinessChanged || ownerExecutionChanged) {
          const initiativeName = String(
            (existing as any)?.name || (existing as any)?.title || 'Initiative'
          );
          const recipients = await getInitiativeNotificationRecipients(orgId, id);

          // Notify new owners
          const newOwners = [
            ownerBusinessChanged ? body.ownerBusinessId : null,
            ownerExecutionChanged ? body.ownerExecutionId : null,
          ].filter(Boolean) as string[];

          for (const newOwnerId of newOwners) {
            if (newOwnerId && newOwnerId !== actorId) {
              await notificationService
                .send({
                  userId: newOwnerId,
                  organizationId: orgId,
                  type: 'initiative.owner_changed',
                  title: 'You were assigned as initiative owner',
                  body: `You are now an owner of: ${initiativeName}`,
                  entityType: 'initiative',
                  entityId: id,
                  actionUrl: '/initiatives',
                  actorId,
                  actorName,
                  priority: 'high',
                  metadata: { initiativeName },
                })
                .catch(() => {});
            }
          }

          // Notify watchers/stakeholders about owner change
          await Promise.allSettled(
            recipients
              .filter((uid) => uid && uid !== actorId && !newOwners.includes(uid))
              .map((uid) =>
                notificationService.send({
                  userId: uid,
                  organizationId: orgId,
                  type: 'initiative.owner_changed',
                  title: 'Initiative ownership changed',
                  body: `${initiativeName}: ownership was updated`,
                  entityType: 'initiative',
                  entityId: id,
                  actionUrl: '/initiatives',
                  actorId,
                  actorName,
                  priority: 'normal',
                  metadata: { initiativeName },
                })
              )
          );
        }
      } catch {
        // best-effort notifications
      }

      // 8. Return updated initiative
      const updated = await queryHelpers.queryOne(
        `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      res.json({
        id,
        message: 'Initiative updated',
        changesCount: changes.length,
        initiative: updated,
      });
    }
  );

  /**
   * Update initiative status
   */
  static updateInitiativeStatus = asyncHandler(
    async (
      req: AuthenticatedRequest<UpdateInitiativeStatusRequest>,
      res: Response
    ): Promise<void> => {
      const { id } = req.params;
      const { status, reason } = req.body;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const existing = await queryHelpers.queryOne(
        `SELECT status, name, created_by FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const currentStatus = normalizeStatus((existing as Record<string, unknown>).status as string);
      const nextStatus = normalizeStatus(status as string);
      const initiativeName = String((existing as any)?.name || 'Initiative');
      const actorId = req.user?.id;
      const actorRole = String((req.user as any)?.role || '').toUpperCase();
      const actorName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || undefined;

      // TRANSITION VALIDATION: check if from→to is allowed
      if (!isValidTransition(currentStatus as any, nextStatus as any)) {
        res.status(400).json({
          error: `Invalid status transition: ${currentStatus} → ${nextStatus}`,
          rule: 'INVALID_TRANSITION',
          from: currentStatus,
          to: nextStatus,
          validNext: VALID_TRANSITIONS[currentStatus as keyof typeof VALID_TRANSITIONS] || [],
        });
        return;
      }

      // RBAC + gate enforcement (enterprise governance)
      // - Consultant can only SUBMIT_FOR_REVIEW for initiatives they authored (created_by)
      // - PM/Lead/PMO gate approvals move initiatives to global visibility (REVIEW)
      const gate = getGateForTransition(currentStatus as any, nextStatus as any);
      if (gate) {
        const isAdmin = actorRole === 'ADMIN' || actorRole === 'SUPERADMIN';
        if (!isAdmin && !canExecuteGate(actorRole as any, gate)) {
          res.status(403).json({
            error: 'Permission denied for this status transition',
            gate,
            from: currentStatus,
            to: nextStatus,
            role: actorRole,
          });
          return;
        }
        if (gate === GateType.SUBMIT_FOR_REVIEW && actorRole === 'CONSULTANT') {
          const createdBy = (existing as any)?.created_by
            ? String((existing as any).created_by)
            : null;
          if (createdBy && actorId && createdBy !== String(actorId)) {
            res.status(403).json({
              error: 'Consultants can only submit initiatives they created',
              gate,
              from: currentStatus,
              to: nextStatus,
            });
            return;
          }
        }
        if (gate === GateType.SEND_BACK && !reason) {
          res.status(400).json({
            error: 'Reason is required to send back an initiative',
            gate,
            from: currentStatus,
            to: nextStatus,
            requiresReason: true,
          });
          return;
        }
      }

      // Gate decision validation
      // Canonical flow (PMO):
      // DRAFT -> PENDING_REVIEW -> REVIEW -> PROMOTED -> PLANNING -> APPROVED -> SCHEDULED -> EXECUTING -> DONE -> TRACKING

      // REVIEW -> PROMOTED: requires Go/No-Go decision (governance)
      if (currentStatus === 'REVIEW' && nextStatus === 'PROMOTED') {
        const hasGoNoGo = await hasApprovedGateDecision(orgId, id, 'GOVERNANCE_DECISION_MAKING');
        if (!hasGoNoGo) {
          try {
            const recipients = await getInitiativeNotificationRecipients(orgId, id);
            await Promise.allSettled(
              recipients
                .filter((uid) => uid && uid !== actorId)
                .map((userId) =>
                  notificationService.send({
                    userId,
                    organizationId: orgId,
                    type: 'initiative.gate_blocked',
                    title: 'Initiative gate blocked',
                    body: `${initiativeName}: Go/No-Go decision is required to promote.`,
                    entityType: 'initiative',
                    entityId: id,
                    actionUrl: '/initiatives',
                    actorId,
                    actorName,
                    priority: 'high',
                    metadata: { currentStatus, nextStatus, gate: 'GOVERNANCE_DECISION_MAKING' },
                  })
                )
            );
          } catch {
            // best-effort
          }

          res.status(400).json({
            error: 'Go/No-Go decision is required to promote this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          });
          return;
        }
      }

      // PROMOTED -> PLANNING: requires Resources Commit decision
      if (currentStatus === 'PROMOTED' && nextStatus === 'PLANNING') {
        const hasResourcesCommit = await hasApprovedGateDecision(
          orgId,
          id,
          'RESOURCE_RESPONSIBILITY'
        );
        if (!hasResourcesCommit) {
          try {
            const recipients = await getInitiativeNotificationRecipients(orgId, id);
            await Promise.allSettled(
              recipients
                .filter((uid) => uid && uid !== actorId)
                .map((userId) =>
                  notificationService.send({
                    userId,
                    organizationId: orgId,
                    type: 'initiative.gate_blocked',
                    title: 'Initiative gate blocked',
                    body: `${initiativeName}: Resources Commit decision is required to start planning.`,
                    entityType: 'initiative',
                    entityId: id,
                    actionUrl: '/initiatives',
                    actorId,
                    actorName,
                    priority: 'high',
                    metadata: { currentStatus, nextStatus, gate: 'RESOURCE_RESPONSIBILITY' },
                  })
                )
            );
          } catch {
            // best-effort
          }

          res.status(400).json({
            error: 'Resources Commit decision is required to start planning',
            rule: 'GATE_DECISION_REQUIRED',
          });
          return;
        }
      }

      // APPROVED -> SCHEDULED: requires Schedule Lock decision (and dates)
      if (currentStatus === 'APPROVED' && nextStatus === 'SCHEDULED') {
        const hasScheduleLock = await hasApprovedGateDecision(orgId, id, 'SCHEDULE_MILESTONES');
        if (!hasScheduleLock) {
          try {
            const recipients = await getInitiativeNotificationRecipients(orgId, id);
            await Promise.allSettled(
              recipients
                .filter((uid) => uid && uid !== actorId)
                .map((userId) =>
                  notificationService.send({
                    userId,
                    organizationId: orgId,
                    type: 'initiative.gate_blocked',
                    title: 'Initiative gate blocked',
                    body: `${initiativeName}: Schedule Lock decision is required to schedule.`,
                    entityType: 'initiative',
                    entityId: id,
                    actionUrl: '/initiatives',
                    actorId,
                    actorName,
                    priority: 'high',
                    metadata: { currentStatus, nextStatus, gate: 'SCHEDULE_MILESTONES' },
                  })
                )
            );
          } catch {
            // best-effort
          }

          res.status(400).json({
            error: 'Schedule Lock decision is required to schedule this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          });
          return;
        }

        const row = await queryHelpers.queryOne(
          `SELECT planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
          [id, orgId]
        );
        const plannedStart = (row as any)?.planned_start_date;
        const plannedEnd = (row as any)?.planned_end_date;
        if (!plannedStart || !plannedEnd) {
          try {
            const recipients = await getInitiativeNotificationRecipients(orgId, id);
            await Promise.allSettled(
              recipients
                .filter((uid) => uid && uid !== actorId)
                .map((userId) =>
                  notificationService.send({
                    userId,
                    organizationId: orgId,
                    type: 'initiative.gate_blocked',
                    title: 'Initiative gate blocked',
                    body: `${initiativeName}: plannedStartDate and plannedEndDate are required to schedule.`,
                    entityType: 'initiative',
                    entityId: id,
                    actionUrl: '/initiatives',
                    actorId,
                    actorName,
                    priority: 'high',
                    metadata: { currentStatus, nextStatus, gate: 'SCHEDULE_DATES_REQUIRED' },
                  })
                )
            );
          } catch {
            // best-effort
          }

          res.status(400).json({
            error: 'plannedStartDate and plannedEndDate are required to schedule this initiative',
            rule: 'SCHEDULE_DATES_REQUIRED',
          });
          return;
        }
      }

      if (
        ['EXECUTING', 'BLOCKED'].includes(currentStatus) &&
        nextStatus === 'DONE' &&
        (await hasPendingExecutionGateDecisions(orgId, id))
      ) {
        res.status(400).json({
          error: 'Resolve pending execution gate decisions before closing this initiative',
          rule: 'EXECUTION_GATE_DECISION_REQUIRED',
        });
        return;
      }

      // Execute status update with lifecycle timestamps
      const now = new Date().toISOString();
      const lifecycleUpdates: string[] = ['status = ?', 'updated_at = ?'];
      const lifecycleParams: unknown[] = [nextStatus, now];

      // Set lifecycle-specific timestamps
      if (nextStatus === 'PENDING_REVIEW') {
        lifecycleUpdates.push('review_requested_at = ?', 'review_requested_by = ?');
        lifecycleParams.push(now, actorId || null);
      }
      if (nextStatus === 'APPROVED') {
        lifecycleUpdates.push('approved_at = ?', 'approved_by = ?');
        lifecycleParams.push(now, actorId || null);
        if (reason) {
          lifecycleUpdates.push('approval_comment = ?');
          lifecycleParams.push(reason);
        }
      }
      if (nextStatus === 'SCHEDULED') {
        lifecycleUpdates.push('execution_started_at = ?');
        lifecycleParams.push(null); // will be set when EXECUTING starts
      }
      if (nextStatus === 'EXECUTING') {
        lifecycleUpdates.push('execution_started_at = ?');
        lifecycleParams.push(now);
      }
      if (nextStatus === 'BLOCKED') {
        lifecycleUpdates.push('blocked_at = ?', 'blocked_reason = ?');
        lifecycleParams.push(now, reason || null);
      }
      if (currentStatus === 'BLOCKED' && nextStatus === 'EXECUTING') {
        lifecycleUpdates.push('unblocked_at = ?', 'blocked_at = ?', 'blocked_reason = ?');
        lifecycleParams.push(now, null, null);
      }
      if (nextStatus === 'DONE') {
        lifecycleUpdates.push('done_at = ?', 'done_by = ?', 'completed_at = ?');
        lifecycleParams.push(now, actorId || null, now);
      }
      if (nextStatus === 'CANCELLED') {
        lifecycleUpdates.push('cancelled_at = ?', 'cancelled_reason = ?');
        lifecycleParams.push(now, reason || null);
      }
      if (nextStatus === 'ARCHIVED') {
        lifecycleUpdates.push('archived_at = ?');
        lifecycleParams.push(now);
      }
      if (actorId) {
        lifecycleUpdates.push('updated_by = ?');
        lifecycleParams.push(actorId);
      }

      lifecycleParams.push(id, orgId);
      const sql = `UPDATE initiatives SET ${lifecycleUpdates.join(', ')} WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, lifecycleParams);

      // Log to initiative_status_history (audit trail)
      try {
        const historyId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO initiative_status_history (id, initiative_id, organization_id, from_status, to_status, changed_by, reason, gate_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            historyId,
            id,
            orgId,
            currentStatus,
            nextStatus,
            actorId || null,
            reason || null,
            gate || null,
            now,
          ]
        );
      } catch {
        // status_history table may not exist yet — best-effort
        logger.warn('[initiatives] Could not write to initiative_status_history');
      }

      // Log to initiative_history (general audit)
      try {
        const histId = uuidv4();
        await queryHelpers.queryRun(
          `INSERT INTO initiative_history (id, initiative_id, organization_id, action, actor_id, actor_name, changes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            histId,
            id,
            orgId,
            'status_changed',
            actorId || null,
            actorName || null,
            JSON.stringify({
              from: currentStatus,
              to: nextStatus,
              reason: reason || null,
              gate: gate || null,
            }),
            now,
          ]
        );
      } catch {
        // best-effort
      }

      // Emit notifications (best-effort)
      try {
        const recipients = await getInitiativeNotificationRecipients(orgId, id);
        const isModuleChange =
          (currentStatus === 'PENDING_REVIEW' && nextStatus === 'REVIEW') ||
          (currentStatus === 'SCHEDULED' && nextStatus === 'EXECUTING') ||
          (currentStatus === 'DONE' && nextStatus === 'TRACKING');

        await Promise.allSettled(
          recipients
            .filter((uid) => uid && uid !== actorId)
            .map((userId) =>
              notificationService.send({
                userId,
                organizationId: orgId,
                type: isModuleChange ? 'initiative.module_changed' : 'initiative.status_changed',
                title: isModuleChange
                  ? 'Initiative moved to new module'
                  : 'Initiative status changed',
                body: `${initiativeName}: ${currentStatus} → ${nextStatus}${reason ? ` (${reason})` : ''}`,
                entityType: 'initiative',
                entityId: id,
                actionUrl: '/initiatives',
                actorId,
                actorName,
                priority:
                  nextStatus === 'BLOCKED' || nextStatus === 'CANCELLED' ? 'high' : 'normal',
                metadata: { from: currentStatus, to: nextStatus, reason, gate },
              })
            )
        );
      } catch {
        // best-effort
      }

      res.json({
        id,
        status: nextStatus,
        previousStatus: currentStatus,
        gate: gate || null,
        message: 'Status updated',
      });
    }
  );

  /**
   * Quick update initiative (timeline, owners, status)
   */
  static quickUpdateInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const { id } = req.params;
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const {
        progress,
        status,
        plannedStartDate,
        plannedEndDate,
        ownerBusinessId,
        ownerExecutionId,
        priority,
      } = req.body as Record<string, unknown>;

      const current = await queryHelpers.queryOne(
        `SELECT planned_start_date, planned_end_date, owner_business_id, owner_execution_id, name
         FROM initiatives
         WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!current) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const actorId = req.user?.id;
      const actorName =
        req.user?.firstName && req.user?.lastName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user?.email || undefined;

      const previousOwnerBusinessId = (current as any).owner_business_id as string | null;
      const previousOwnerExecutionId = (current as any).owner_execution_id as string | null;
      const initiativeName = String((current as any)?.name || 'Initiative');

      const existingStart = (current as Record<string, unknown>).planned_start_date as
        | string
        | null;
      const existingEnd = (current as Record<string, unknown>).planned_end_date as string | null;
      const finalStart = (plannedStartDate ?? existingStart) as string | null;
      const finalEnd = (plannedEndDate ?? existingEnd) as string | null;

      if (finalStart && finalEnd) {
        const startDate = new Date(finalStart);
        const endDate = new Date(finalEnd);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
          res.status(400).json({ error: 'Invalid date format' });
          return;
        }
        if (startDate > endDate) {
          res.status(400).json({ error: 'plannedStartDate must be before plannedEndDate' });
          return;
        }
      }

      const updates: string[] = [];
      const params: Array<unknown> = [];

      if (progress !== undefined) {
        updates.push('progress = ?');
        params.push(progress);
      }
      if (status) {
        updates.push('status = ?');
        params.push(normalizeStatus(status as string));
      }
      if (plannedStartDate !== undefined) {
        updates.push('planned_start_date = ?');
        params.push(plannedStartDate);
      }
      if (plannedEndDate !== undefined) {
        updates.push('planned_end_date = ?');
        params.push(plannedEndDate);
      }
      if (ownerBusinessId !== undefined) {
        updates.push('owner_business_id = ?');
        params.push(ownerBusinessId);
      }
      if (ownerExecutionId !== undefined) {
        updates.push('owner_execution_id = ?');
        params.push(ownerExecutionId);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        params.push(priority);
      }

      if (updates.length === 0) {
        res.json({ message: 'No updates provided' });
        return;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(id, orgId);

      const sql = `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, params);

      // Emit owner change notifications (best-effort)
      try {
        const ownerBusinessChanged =
          ownerBusinessId !== undefined &&
          String(ownerBusinessId || '') !== String(previousOwnerBusinessId || '');
        const ownerExecutionChanged =
          ownerExecutionId !== undefined &&
          String(ownerExecutionId || '') !== String(previousOwnerExecutionId || '');

        if (ownerBusinessChanged || ownerExecutionChanged) {
          const recipients = await getInitiativeNotificationRecipients(orgId, id);
          const bodyParts: string[] = [];
          if (ownerBusinessChanged) bodyParts.push('Business owner updated');
          if (ownerExecutionChanged) bodyParts.push('Execution owner updated');

          await Promise.allSettled(
            recipients
              .filter((uid) => uid && uid !== actorId)
              .map((userId) =>
                notificationService.send({
                  userId,
                  organizationId: orgId,
                  type: 'initiative.owner_changed',
                  title: 'Initiative owner changed',
                  body: `${initiativeName}: ${bodyParts.join(' · ')}`,
                  entityType: 'initiative',
                  entityId: id,
                  actionUrl: '/initiatives',
                  actorId,
                  actorName,
                  priority: 'normal',
                  metadata: {
                    previousOwnerBusinessId,
                    previousOwnerExecutionId,
                    ownerBusinessId,
                    ownerExecutionId,
                  },
                })
              )
          );
        }
      } catch {
        // best-effort
      }

      res.json({ success: true, message: 'Initiative updated' });
    }
  );

  /**
   * Get portfolio data with initiatives and stats
   */
  static getPortfolioData = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            WHERE i.organization_id = ?
            ORDER BY i.created_at DESC
        `;

      const rows = await queryHelpers.queryAll(sql, [orgId]);

      // Helper to normalize status
      const normalizePortfolioStatus = (status: string | unknown): string => {
        const s = String(status || 'DRAFT').toUpperCase();
        // Map old statuses to new ones
        if (s.includes('STEP3') || s.includes('STEP_3')) return 'REVIEW';
        if (s.includes('STEP4') || s.includes('STEP_4') || s.includes('PILOT')) return 'APPROVED';
        if (s.includes('STEP5') || s.includes('STEP_5') || s.includes('FULL')) return 'EXECUTING';
        if (s === 'COMPLETED' || s === 'DONE') return 'DONE';
        if (
          [
            'DRAFT',
            'PENDING_REVIEW',
            'PLANNING',
            'REVIEW',
            'PROMOTED',
            'APPROVED',
            'SCHEDULED',
            'EXECUTING',
            'BLOCKED',
            'DONE',
            'TRACKING',
            'CANCELLED',
            'ARCHIVED',
          ].includes(s)
        ) {
          return s;
        }
        return 'DRAFT';
      };

      // Helper to parse localized name
      const parseName = (name: string | unknown): string => {
        const n = String(name || 'Untitled Initiative');
        if (n.startsWith('{')) {
          try {
            const parsed = JSON.parse(n);
            return parsed.en || parsed.pl || n;
          } catch {
            return n;
          }
        }
        return n;
      };

      const initiatives = rows.map((i: Record<string, unknown>) => {
        const budget =
          ((i.cost_capex as number) || 0) + ((i.cost_opex as number) || 0) ||
          (i.business_value as number) ||
          0;
        return {
          id: i.id,
          organizationId: i.organization_id,
          projectId: i.project_id,
          name: parseName(i.title || i.name),
          title: parseName(i.title || i.name),
          axis: i.axis || 'operational',
          area: i.area,
          summary: i.summary,
          hypothesis: i.hypothesis,
          status: normalizePortfolioStatus(i.status),
          progress: i.progress || 0,
          currentStage: i.current_stage,
          businessValue: i.business_value || 0,
          budget: budget,
          costCapex: i.cost_capex || 0,
          costOpex: i.cost_opex || 0,
          expectedRoi: i.expected_roi || 0,
          valueDriver: i.value_driver,
          confidenceLevel: i.confidence_level || 'medium',
          valueTiming: i.value_timing,
          plannedStartDate: i.planned_start_date,
          plannedEndDate: i.planned_end_date,
          actualStartDate: i.actual_start_date,
          actualEndDate: i.actual_end_date,
          priority: String(i.priority || 'MEDIUM').toUpperCase(),
          sourceId: i.source_id,
          sourceType: i.source_type,
          targetQuarter: i.planned_start_date
            ? `Q${Math.ceil((new Date(i.planned_start_date as string).getMonth() + 1) / 3)} ${new Date(i.planned_start_date as string).getFullYear()}`
            : undefined,
          ownerBusiness: i.owner_business_id
            ? {
                id: i.owner_business_id,
                firstName: i.ob_first_name,
                lastName: i.ob_last_name,
                avatarUrl: i.ob_avatar,
              }
            : null,
          ownerExecution: i.owner_execution_id
            ? {
                id: i.owner_execution_id,
                firstName: i.oe_first_name,
                lastName: i.oe_last_name,
                avatarUrl: i.oe_avatar,
              }
            : null,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        };
      });

      // Calculate stats by status
      const byStatus: Record<string, number> = {};
      initiatives.forEach((i: any) => {
        byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      });

      const totalInitiatives = initiatives.length;
      const executing = byStatus['EXECUTING'] || 0;
      const approved = byStatus['APPROVED'] || 0;
      const review = byStatus['REVIEW'] || 0;
      const blockedCount = byStatus['BLOCKED'] || 0;
      const done = byStatus['DONE'] || 0;

      const totalBudget = initiatives.reduce((sum: number, i: any) => sum + (i.budget || 0), 0);
      const totalValue = initiatives.reduce(
        (sum: number, i: any) => sum + (i.businessValue || 0),
        0
      );
      const avgProgress =
        totalInitiatives > 0
          ? Math.round(
              initiatives.reduce((sum: number, i: any) => sum + (i.progress || 0), 0) /
                totalInitiatives
            )
          : 0;

      res.json({
        initiatives,
        stats: {
          total: totalInitiatives,
          byStatus,
          executing,
          approved,
          review,
          blockedCount,
          done,
          totalBudget,
          totalValue,
          avgProgress,
        },
      });
    }
  );

  /**
   * Get initiative dependencies for portfolio timeline
   */
  static getPortfolioDependencies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId } = req.query as { projectId?: string };
      const params: Array<string> = [orgId];
      let sql = `
            SELECT id, from_initiative_id, to_initiative_id, type, project_id
            FROM initiative_dependencies
            WHERE organization_id = ?
        `;

      if (projectId) {
        sql += ` AND project_id = ?`;
        params.push(projectId);
      }

      sql += ` ORDER BY created_at DESC`;

      const rows = await queryHelpers.queryAll(sql, params);
      const dependencies = rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        fromInitiativeId: row.from_initiative_id,
        toInitiativeId: row.to_initiative_id,
        type: row.type,
        projectId: row.project_id,
      }));

      res.json({ dependencies });
    }
  );

  /**
   * Create initiative dependency
   */
  static createPortfolioDependency = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { fromInitiativeId, toInitiativeId, type, projectId } = req.body as {
        fromInitiativeId?: string;
        toInitiativeId?: string;
        type?: string;
        projectId?: string;
      };

      if (!fromInitiativeId || !toInitiativeId) {
        res.status(400).json({ error: 'fromInitiativeId and toInitiativeId are required' });
        return;
      }

      if (fromInitiativeId === toInitiativeId) {
        res.status(400).json({ error: 'Cannot create self-dependency' });
        return;
      }

      const existingDep = await queryHelpers.queryOne(
        `SELECT id FROM initiative_dependencies
         WHERE organization_id = ? AND from_initiative_id = ? AND to_initiative_id = ?`,
        [orgId, fromInitiativeId, toInitiativeId]
      );
      if (existingDep) {
        res.json({
          dependency: {
            id: (existingDep as Record<string, unknown>).id,
            fromInitiativeId,
            toInitiativeId,
            type: type || 'FINISH_TO_START',
            projectId,
          },
        });
        return;
      }

      // Cycle detection using DFS — prevent A→B→C→A loops
      try {
        const allDeps = await queryHelpers.queryAll<{
          from_initiative_id: string;
          to_initiative_id: string;
        }>(
          `SELECT from_initiative_id, to_initiative_id FROM initiative_dependencies WHERE organization_id = ?`,
          [orgId]
        );

        // Build adjacency list (from → [to1, to2, ...])
        const adjacency = new Map<string, Set<string>>();
        for (const dep of allDeps) {
          const from = String(dep.from_initiative_id);
          const to = String(dep.to_initiative_id);
          if (!adjacency.has(from)) adjacency.set(from, new Set());
          adjacency.get(from)!.add(to);
        }
        // Add the proposed new edge
        if (!adjacency.has(fromInitiativeId)) adjacency.set(fromInitiativeId, new Set());
        adjacency.get(fromInitiativeId)!.add(toInitiativeId);

        // DFS from toInitiativeId to see if we can reach fromInitiativeId (= cycle)
        const visited = new Set<string>();
        const stack = [toInitiativeId];
        let hasCycle = false;

        while (stack.length > 0) {
          const current = stack.pop()!;
          if (current === fromInitiativeId) {
            hasCycle = true;
            break;
          }
          if (visited.has(current)) continue;
          visited.add(current);

          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const neighbor of neighbors) {
              if (!visited.has(neighbor)) {
                stack.push(neighbor);
              }
            }
          }
        }

        if (hasCycle) {
          res.status(400).json({
            error: 'Creating this dependency would form a cycle',
            rule: 'DEPENDENCY_CYCLE_DETECTED',
            fromInitiativeId,
            toInitiativeId,
          });
          return;
        }
      } catch (cycleErr) {
        // If cycle detection fails, log but don't block
        logger.warn('[initiatives] Cycle detection failed:', cycleErr);
      }

      let resolvedProjectId = projectId;
      if (!resolvedProjectId) {
        const projectRow = await queryHelpers.queryOne(
          `SELECT project_id FROM initiatives WHERE id = ? AND organization_id = ?`,
          [fromInitiativeId, orgId]
        );
        resolvedProjectId = (projectRow as Record<string, unknown>)?.project_id as string;
      }

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_dependencies (
              id, organization_id, project_id, from_initiative_id, to_initiative_id, type, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          resolvedProjectId || null,
          fromInitiativeId,
          toInitiativeId,
          type || 'FINISH_TO_START',
          new Date().toISOString(),
        ]
      );

      res.status(201).json({
        dependency: {
          id,
          fromInitiativeId,
          toInitiativeId,
          type: type || 'FINISH_TO_START',
          projectId: resolvedProjectId || null,
        },
      });
    }
  );

  /**
   * Delete initiative dependency
   */
  static deletePortfolioDependency = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await queryHelpers.queryRun(
        `DELETE FROM initiative_dependencies WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );

      res.json({ success: true });
    }
  );

  // ==========================================
  // FLOW-INITIATIVE-001: STATUS TRANSITIONS
  // ==========================================

  /**
   * Check initiative readiness for review
   */
  static checkReadiness = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const initiativeId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get initiative
      const initiative = await queryHelpers.dbGet<any>(
        'SELECT * FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // Define required fields for review submission
      const requiredFields = [
        { field: 'title', display: 'Title', filled: !!initiative.title },
        { field: 'summary', display: 'Summary', filled: !!initiative.summary },
        {
          field: 'problem_statement',
          display: 'Problem Statement',
          filled: !!initiative.problem_statement,
        },
        {
          field: 'planned_start_date',
          display: 'Start Date',
          filled: !!initiative.planned_start_date,
        },
        { field: 'planned_end_date', display: 'End Date', filled: !!initiative.planned_end_date },
        {
          field: 'owner_business_id',
          display: 'Business Owner',
          filled: !!initiative.owner_business_id,
        },
      ];

      const optionalFields = [
        {
          field: 'deliverables',
          display: 'Deliverables',
          filled: initiative.deliverables && safeJsonParse(initiative.deliverables).length > 0,
        },
        {
          field: 'success_criteria',
          display: 'Success Criteria',
          filled:
            initiative.success_criteria && safeJsonParse(initiative.success_criteria).length > 0,
        },
        {
          field: 'business_value',
          display: 'Business Value',
          filled: initiative.business_value != null,
        },
        { field: 'cost_capex', display: 'Cost Estimate', filled: initiative.cost_capex != null },
        {
          field: 'owner_execution_id',
          display: 'Execution Owner',
          filled: !!initiative.owner_execution_id,
        },
      ];

      const missingRequired = requiredFields.filter((f) => !f.filled);
      const missingOptional = optionalFields.filter((f) => !f.filled);
      const completionPercentage = Math.round(
        ((requiredFields.filter((f) => f.filled).length +
          optionalFields.filter((f) => f.filled).length) /
          (requiredFields.length + optionalFields.length)) *
          100
      );

      res.json({
        success: true,
        initiativeId,
        ready: missingRequired.length === 0,
        completionPercentage,
        requiredFields,
        optionalFields,
        missingRequired: missingRequired.map((f) => f.display),
        missingOptional: missingOptional.map((f) => f.display),
      });
    }
  );

  /**
   * Submit initiative for review
   */
  static submitForReview = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Check current status is planning
      const initiative = await queryHelpers.dbGet<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (initiative.status !== 'planning') {
        res
          .status(400)
          .json({ error: `Cannot submit for review from status: ${initiative.status}` });
        return;
      }

      // Update status to review
      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'review',
                review_requested_at = datetime('now'),
                review_requested_by = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
        [userId, initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative submitted for review',
        initiativeId,
        newStatus: 'review',
      });
    }
  );

  /**
   * Approve initiative
   */
  static approveInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { comment, roadmapQuarter, roadmapYear } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.dbGet<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (initiative.status !== 'review') {
        res.status(400).json({ error: `Cannot approve from status: ${initiative.status}` });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'approved',
                approved_at = datetime('now'),
                approved_by = ?,
                approval_comment = ?,
                roadmap_quarter = ?,
                roadmap_year = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
        [userId, comment || null, roadmapQuarter || null, roadmapYear || null, initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative approved',
        initiativeId,
        newStatus: 'approved',
      });
    }
  );

  /**
   * Reject initiative (back to planning)
   */
  static rejectInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { reason } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.dbGet<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (initiative.status !== 'review') {
        res.status(400).json({ error: `Cannot reject from status: ${initiative.status}` });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'planning',
                approval_comment = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
        [reason || 'Rejected - needs more work', initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative rejected and returned to planning',
        initiativeId,
        newStatus: 'planning',
      });
    }
  );

  /**
   * Start execution
   */
  static startExecution = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.dbGet<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (initiative.status !== 'approved') {
        res.status(400).json({ error: `Cannot start execution from status: ${initiative.status}` });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'executing',
                execution_started_at = datetime('now'),
                updated_at = datetime('now')
             WHERE id = ?`,
        [initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative execution started',
        initiativeId,
        newStatus: 'executing',
      });
    }
  );

  /**
   * Block initiative
   */
  static blockInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { reason, decisionId } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'blocked',
                blocked_at = datetime('now'),
                blocked_reason = ?,
                updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`,
        [reason || 'Blocked', initiativeId, orgId]
      );

      res.json({
        success: true,
        message: 'Initiative blocked',
        initiativeId,
        newStatus: 'blocked',
      });
    }
  );

  /**
   * Unblock initiative
   */
  static unblockInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const initiativeId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'executing',
                unblocked_at = datetime('now'),
                blocked_reason = NULL,
                updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );

      res.json({
        success: true,
        message: 'Initiative unblocked',
        initiativeId,
        newStatus: 'executing',
      });
    }
  );

  /**
   * Complete initiative (mark as done)
   */
  static completeInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { enableBenefitsTracking } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'done',
                done_at = datetime('now'),
                done_by = ?,
                benefits_tracking_enabled = ?,
                updated_at = datetime('now')
             WHERE id = ? AND organization_id = ?`,
        [userId, enableBenefitsTracking ? 1 : 0, initiativeId, orgId]
      );

      res.json({
        success: true,
        message: 'Initiative completed',
        initiativeId,
        newStatus: 'done',
        benefitsTrackingEnabled: !!enableBenefitsTracking,
      });
    }
  );

  /**
   * Move initiative to different project
   */
  static moveInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { targetProjectId, moveTasks } = req.body;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!targetProjectId) {
        res.status(400).json({ error: 'targetProjectId is required' });
        return;
      }

      // Verify target project exists and belongs to org
      const targetProject = await queryHelpers.dbGet<{ id: string }>(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [targetProjectId, orgId]
      );

      if (!targetProject) {
        res.status(404).json({ error: 'Target project not found' });
        return;
      }

      // Get current project
      const initiative = await queryHelpers.dbGet<{ project_id: string }>(
        'SELECT project_id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const oldProjectId = initiative.project_id;

      // Move initiative
      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                project_id = ?,
                updated_at = datetime('now')
             WHERE id = ?`,
        [targetProjectId, initiativeId]
      );

      // Optionally move associated tasks
      if (moveTasks) {
        await queryHelpers.dbRun(
          `UPDATE tasks SET 
                    project_id = ?,
                    updated_at = datetime('now')
                 WHERE initiative_id = ?`,
          [targetProjectId, initiativeId]
        );
      }

      // Record history
      await queryHelpers.dbRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
             VALUES (?, ?, 'moved', ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          JSON.stringify({ project_id: oldProjectId }),
          JSON.stringify({ project_id: targetProjectId }),
          userId,
          moveTasks ? 'Tasks moved with initiative' : 'Initiative moved without tasks',
        ]
      );

      res.json({
        success: true,
        message: 'Initiative moved successfully',
        initiativeId,
        fromProjectId: oldProjectId,
        toProjectId: targetProjectId,
        tasksMoved: !!moveTasks,
      });
    }
  );

  /**
   * Archive initiative
   */
  static archiveInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const initiativeId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.dbGet<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (!['done', 'cancelled'].includes(initiative.status)) {
        res.status(400).json({ error: 'Only done or cancelled initiatives can be archived' });
        return;
      }

      await queryHelpers.dbRun(
        `UPDATE initiatives SET 
                status = 'archived',
                updated_at = datetime('now')
             WHERE id = ?`,
        [initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative archived',
        initiativeId,
        newStatus: 'archived',
      });
    }
  );

  // ==========================================
  // BENEFITS MODULE: KPI ENDPOINTS
  // ==========================================

  /**
   * Get initiatives filtered by status (for Benefits module)
   */
  static getInitiativesByStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { statuses } = req.params;
      if (!statuses) {
        res.status(400).json({ error: 'Statuses parameter is required' });
        return;
      }

      // Parse comma-separated statuses and support DONE/COMPLETED interchangeably
      const rawStatuses = statuses
        .split(',')
        .map((s: string) => s.trim().toUpperCase())
        .filter(Boolean);
      const statusSet = new Set<string>();
      rawStatuses.forEach((status) => {
        if (status === 'DONE') {
          statusSet.add('DONE');
          statusSet.add('COMPLETED');
          return;
        }
        if (status === 'COMPLETED') {
          statusSet.add('COMPLETED');
          statusSet.add('DONE');
          return;
        }
        statusSet.add(status);
      });
      const statusList = Array.from(statusSet);

      const placeholders = statusList.map(() => '?').join(',');
      const sql = `
        SELECT i.*, p.name as project_name
        FROM initiatives i
        LEFT JOIN projects p ON i.project_id = p.id
        WHERE i.organization_id = ? AND UPPER(i.status) IN (${placeholders})
        ORDER BY i.updated_at DESC
      `;

      const rows = await queryHelpers.queryAll(sql, [orgId, ...statusList]);

      const initiatives = rows.map((i: Record<string, unknown>) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        summary: i.summary,
        problemStatement: i.problem_statement,
        hypothesis: i.hypothesis,
        businessValue: i.business_value,
        costCapex: i.cost_capex,
        costOpex: i.cost_opex,
        expectedRoi: i.expected_roi,
        ownerBusinessId: i.owner_business_id,
        ownerExecutionId: i.owner_execution_id,
        plannedStartDate: i.planned_start_date,
        plannedEndDate: i.planned_end_date,
        deliverables: safeJsonParse(i.deliverables as string, []),
        successCriteria: safeJsonParse(i.success_criteria as string, []),
        keyRisks: safeJsonParse(i.key_risks as string, []),
        axis: i.axis,
        priority: i.priority,
        status: (i.status as string)?.toUpperCase() === 'COMPLETED' ? 'DONE' : i.status,
        sourceId: i.source_id,
        sourceType: i.source_type,
        progress: i.progress || 0,
        projectId: i.project_id,
        projectName: i.project_name,
        organizationId: i.organization_id,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      }));

      res.json({ initiatives });
    }
  );

  /**
   * Get KPIs for an initiative
   */
  static getInitiativeKpis = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify initiative belongs to org
      const initiative = await queryHelpers.queryOne(
        'SELECT id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const kpis = await queryHelpers.queryAll(
        `SELECT 
          id,
          initiative_id as initiativeId,
          name,
          description,
          category,
          unit,
          baseline_value as baselineValue,
          target_value as targetValue,
          current_value as currentValue,
          progress_percentage as progressPercentage,
          status,
          measurement_frequency as measurementFrequency,
          trend_data as trendData,
          created_at as createdAt,
          updated_at as updatedAt,
          CASE WHEN current_value >= target_value THEN 1 ELSE 0 END as isOnTarget,
          current_value as latestValue
        FROM initiative_kpis 
        WHERE initiative_id = ?
        ORDER BY created_at DESC`,
        [initiativeId]
      );

      // Parse trend_data JSON
      const parsedKpis = kpis.map((kpi: any) => ({
        ...kpi,
        trendData: safeJsonParse(kpi.trendData, []),
        isOnTarget: Boolean(kpi.isOnTarget),
      }));

      res.json({ kpis: parsedKpis });
    }
  );

  /**
   * Create a new KPI for an initiative
   */
  static createInitiativeKpi = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      const {
        name,
        description,
        category,
        unit,
        baselineValue,
        targetValue,
        measurementFrequency,
      } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!name || !category || !unit) {
        res.status(400).json({ error: 'Name, category, and unit are required' });
        return;
      }

      // Verify initiative belongs to org
      const initiative = await queryHelpers.queryOne(
        'SELECT id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const kpiId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO initiative_kpis (
          id, initiative_id, organization_id, name, description, category, unit, 
          baseline_value, target_value, current_value, progress_percentage, status,
          measurement_frequency, trend_data, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'on_track', ?, '[]', ?, ?)`,
        [
          kpiId,
          initiativeId,
          orgId,
          name,
          description || null,
          category,
          unit,
          baselineValue || 0,
          targetValue || 0,
          baselineValue || 0,
          measurementFrequency || 'monthly',
          now,
          now,
        ]
      );

      res.status(201).json({
        success: true,
        kpi: {
          id: kpiId,
          initiativeId,
          name,
          description,
          category,
          unit,
          baselineValue: baselineValue || 0,
          targetValue: targetValue || 0,
          currentValue: baselineValue || 0,
          progressPercentage: 0,
          status: 'on_track',
          measurementFrequency: measurementFrequency || 'monthly',
          createdAt: now,
        },
      });
    }
  );

  // ==========================================
  // ROADMAP MODULE: MILESTONES ENDPOINTS
  // ==========================================

  /**
   * Get milestones for an initiative
   */
  static getMilestones = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify initiative belongs to org
      const initiative = await queryHelpers.queryOne(
        'SELECT id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const milestones = await queryHelpers.queryAll(
        `SELECT 
          id,
          initiative_id as initiativeId,
          name,
          description,
          target_date as targetDate,
          actual_date as actualDate,
          status,
          order_index as orderIndex,
          is_gate as isGate,
          gate_decision_id as gateDecisionId,
          created_at as createdAt,
          updated_at as updatedAt
        FROM initiative_milestones 
        WHERE initiative_id = ?
        ORDER BY order_index ASC`,
        [initiativeId]
      );

      res.json({ milestones: milestones.map((m: any) => ({ ...m, isGate: Boolean(m.isGate) })) });
    }
  );

  /**
   * Create a milestone for an initiative
   */
  static createMilestone = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      const { name, description, targetDate, isGate } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      // Verify initiative belongs to org
      const initiative = await queryHelpers.queryOne(
        'SELECT id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // Get next order index
      const lastMilestone = await queryHelpers.queryOne(
        'SELECT MAX(order_index) as maxOrder FROM initiative_milestones WHERE initiative_id = ?',
        [initiativeId]
      );
      const nextOrder = ((lastMilestone as any)?.maxOrder || 0) + 1;

      const milestoneId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO initiative_milestones (
          id, initiative_id, organization_id, name, description, target_date, status, order_index, is_gate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
        [
          milestoneId,
          initiativeId,
          orgId,
          name,
          description || null,
          targetDate || null,
          nextOrder,
          isGate ? 1 : 0,
          now,
          now,
        ]
      );

      res.status(201).json({
        success: true,
        milestone: {
          id: milestoneId,
          initiativeId,
          name,
          description,
          targetDate,
          status: 'PENDING',
          orderIndex: nextOrder,
          isGate: Boolean(isGate),
          createdAt: now,
        },
      });
    }
  );

  /**
   * Update a milestone
   */
  static updateMilestone = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, milestoneId } = req.params;
      const { name, description, targetDate, actualDate, status, orderIndex, isGate } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify milestone exists and belongs to org
      const milestone = await queryHelpers.queryOne(
        `SELECT m.id FROM initiative_milestones m
         JOIN initiatives i ON m.initiative_id = i.id
         WHERE m.id = ? AND m.initiative_id = ? AND i.organization_id = ?`,
        [milestoneId, initiativeId, orgId]
      );

      if (!milestone) {
        res.status(404).json({ error: 'Milestone not found' });
        return;
      }

      const updates: string[] = [];
      const params: unknown[] = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (targetDate !== undefined) {
        updates.push('target_date = ?');
        params.push(targetDate);
      }
      if (actualDate !== undefined) {
        updates.push('actual_date = ?');
        params.push(actualDate);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (orderIndex !== undefined) {
        updates.push('order_index = ?');
        params.push(orderIndex);
      }
      if (isGate !== undefined) {
        updates.push('is_gate = ?');
        params.push(isGate ? 1 : 0);
      }

      if (updates.length === 0) {
        res.json({ success: true, message: 'No updates provided' });
        return;
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(milestoneId);

      await queryHelpers.queryRun(
        `UPDATE initiative_milestones SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      res.json({ success: true, message: 'Milestone updated' });
    }
  );

  /**
   * Delete a milestone
   */
  static deleteMilestone = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, milestoneId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Verify milestone exists and belongs to org
      const milestone = await queryHelpers.queryOne(
        `SELECT m.id FROM initiative_milestones m
         JOIN initiatives i ON m.initiative_id = i.id
         WHERE m.id = ? AND m.initiative_id = ? AND i.organization_id = ?`,
        [milestoneId, initiativeId, orgId]
      );

      if (!milestone) {
        res.status(404).json({ error: 'Milestone not found' });
        return;
      }

      await queryHelpers.queryRun('DELETE FROM initiative_milestones WHERE id = ?', [milestoneId]);

      res.json({ success: true });
    }
  );

  /**
   * Get resources for an initiative
   */
  static getResources = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const resources = await queryHelpers.queryAll(
        `SELECT 
          r.id,
          r.initiative_id as initiativeId,
          r.user_id as userId,
          r.role,
          r.allocation_percentage as allocationPercentage,
          r.start_date as startDate,
          r.end_date as endDate,
          r.notes,
          u.first_name as firstName,
          u.last_name as lastName,
          u.avatar_url as avatarUrl
        FROM initiative_resources r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.initiative_id = ? AND r.organization_id = ?`,
        [initiativeId, orgId]
      );

      res.json({ resources });
    }
  );

  /**
   * Add resource to an initiative
   */
  static addResource = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      const { userId, role, allocationPercentage, startDate, endDate, notes } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!role) {
        res.status(400).json({ error: 'Role is required' });
        return;
      }

      const resourceId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO initiative_resources (
          id, initiative_id, organization_id, user_id, role, allocation_percentage, start_date, end_date, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          initiativeId,
          orgId,
          userId || null,
          role,
          allocationPercentage || 100,
          startDate || null,
          endDate || null,
          notes || null,
          now,
        ]
      );

      res.status(201).json({
        success: true,
        resource: {
          id: resourceId,
          initiativeId,
          userId,
          role,
          allocationPercentage: allocationPercentage || 100,
          startDate,
          endDate,
          notes,
        },
      });
    }
  );

  // ==========================================
  // P0: RAID / Stakeholders / Watchers / History
  // ==========================================

  static getStakeholders = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await queryHelpers.queryAll(
        `SELECT 
          s.id,
          s.initiative_id as initiativeId,
          s.user_id as userId,
          s.external_name as externalName,
          s.external_email as externalEmail,
          s.role,
          s.raci_type as raciType,
          s.created_at as createdAt,
          u.first_name as firstName,
          u.last_name as lastName,
          u.email as email
        FROM initiative_stakeholders s
        JOIN initiatives i ON i.id = s.initiative_id
        LEFT JOIN users u ON u.id = s.user_id
        WHERE s.initiative_id = ? AND i.organization_id = ?
        ORDER BY s.created_at DESC`,
        [initiativeId, orgId]
      );

      res.json({ stakeholders: rows });
    }
  );

  static addStakeholder = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId } = req.params;
      const { userId, raciType, role, externalName, externalEmail } = req.body || {};

      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const exists = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!exists) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (!userId && !externalName) {
        res.status(400).json({ error: 'userId or externalName is required' });
        return;
      }

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_stakeholders (
          id, initiative_id, user_id, external_name, external_email, role, raci_type, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          initiativeId,
          userId || null,
          userId ? null : externalName,
          userId ? null : externalEmail || null,
          role || null,
          raciType || null,
          actorId,
        ]
      );

      // Record history
      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          'stakeholder_added',
          null,
          JSON.stringify({ userId, externalName, raciType, role }),
          actorId,
          null,
        ]
      );

      res.status(201).json({ success: true, id });
    }
  );

  static deleteStakeholder = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId, stakeholderId } = req.params as any;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const row = await queryHelpers.queryOne(
        `SELECT s.id FROM initiative_stakeholders s
         JOIN initiatives i ON i.id = s.initiative_id
         WHERE s.id = ? AND s.initiative_id = ? AND i.organization_id = ?`,
        [stakeholderId, initiativeId, orgId]
      );
      if (!row) {
        res.status(404).json({ error: 'Stakeholder not found' });
        return;
      }

      await queryHelpers.queryRun(`DELETE FROM initiative_stakeholders WHERE id = ?`, [
        stakeholderId,
      ]);
      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          'stakeholder_removed',
          JSON.stringify({ id: stakeholderId }),
          null,
          actorId,
          null,
        ]
      );

      res.json({ success: true });
    }
  );

  static getWatchers = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await queryHelpers.queryAll(
        `SELECT
          w.id,
          w.initiative_id as initiativeId,
          w.user_id as userId,
          w.created_at as createdAt,
          u.first_name as firstName,
          u.last_name as lastName,
          u.email as email
        FROM initiative_watchers w
        JOIN initiatives i ON i.id = w.initiative_id
        JOIN users u ON u.id = w.user_id
        WHERE w.initiative_id = ? AND i.organization_id = ?
        ORDER BY w.created_at DESC`,
        [initiativeId, orgId]
      );

      res.json({ watchers: rows });
    }
  );

  static addWatcher = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId } = req.params;
      const { userId } = req.body || {};
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
      }

      const exists = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!exists) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const id = uuidv4();
      try {
        await queryHelpers.queryRun(
          `INSERT INTO initiative_watchers (id, initiative_id, user_id) VALUES (?, ?, ?)`,
          [id, initiativeId, userId]
        );
      } catch (e: any) {
        // Unique constraint violation: treat as idempotent
      }

      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), initiativeId, 'watcher_added', null, JSON.stringify({ userId }), actorId, null]
      );

      res.status(201).json({ success: true });
    }
  );

  static deleteWatcher = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId, watcherId } = req.params as any;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const row = await queryHelpers.queryOne(
        `SELECT w.id, w.user_id as userId FROM initiative_watchers w
         JOIN initiatives i ON i.id = w.initiative_id
         WHERE w.id = ? AND w.initiative_id = ? AND i.organization_id = ?`,
        [watcherId, initiativeId, orgId]
      );
      if (!row) {
        res.status(404).json({ error: 'Watcher not found' });
        return;
      }

      await queryHelpers.queryRun(`DELETE FROM initiative_watchers WHERE id = ?`, [watcherId]);
      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          'watcher_removed',
          JSON.stringify({ id: watcherId, userId: (row as any).userId }),
          null,
          actorId,
          null,
        ]
      );

      res.json({ success: true });
    }
  );

  static getRaid = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { id: initiativeId } = req.params;
    const limit = Number(req.query?.limit || 50);
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const rows = await queryHelpers.queryAll(
      `SELECT
          r.id,
          r.initiative_id as initiativeId,
          LOWER(r.type) as type,
          r.title,
          r.description,
          r.status,
          r.impact as severity,
          r.owner_id as ownerId,
          r.due_date as dueDate,
          r.created_at as createdAt,
          r.updated_at as updatedAt
        FROM raid_items r
        WHERE r.organization_id = ? AND r.initiative_id = ?
        ORDER BY r.updated_at DESC
        LIMIT ?`,
      [orgId, initiativeId, Number.isFinite(limit) ? limit : 50]
    );

    res.json({ items: rows });
  });

  static createRaidItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId } = req.params;
      const { type, title, description, severity, dueDate, ownerId } = req.body || {};
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!type || !title) {
        res.status(400).json({ error: 'type and title are required' });
        return;
      }

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO raid_items (
          id, organization_id, initiative_id, type, title, description, impact, due_date, owner_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          initiativeId,
          String(type).toUpperCase(),
          title,
          description || null,
          severity ? String(severity).toUpperCase() : null,
          dueDate || null,
          ownerId || null,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          'raid_item_created',
          null,
          JSON.stringify({ id, type, title }),
          actorId,
          null,
        ]
      );

      res.status(201).json({ success: true, id });
    }
  );

  static updateRaidItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId, raidId } = req.params as any;
      const { title, description, status, severity, dueDate, ownerId } = req.body || {};
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const existing = await queryHelpers.queryOne(
        `SELECT id, title, description, status, impact, due_date, owner_id
         FROM raid_items
         WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [raidId, orgId, initiativeId]
      );
      if (!existing) {
        res.status(404).json({ error: 'RAID item not found' });
        return;
      }

      await queryHelpers.queryRun(
        `UPDATE raid_items
         SET title = COALESCE(?, title),
             description = COALESCE(?, description),
             status = COALESCE(?, status),
             impact = COALESCE(?, impact),
             due_date = COALESCE(?, due_date),
             owner_id = COALESCE(?, owner_id),
             updated_at = datetime('now')
         WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [
          title ?? null,
          description ?? null,
          status ?? null,
          severity ? String(severity).toUpperCase() : null,
          dueDate ?? null,
          ownerId ?? null,
          raidId,
          orgId,
          initiativeId,
        ]
      );

      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          initiativeId,
          'raid_item_updated',
          JSON.stringify(existing),
          JSON.stringify({ title, description, status, severity, dueDate, ownerId }),
          actorId,
          null,
        ]
      );

      res.json({ success: true });
    }
  );

  static deleteRaidItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId, raidId } = req.params as any;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const existing = await queryHelpers.queryOne(
        `SELECT id, title FROM raid_items WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [raidId, orgId, initiativeId]
      );
      if (!existing) {
        res.status(404).json({ error: 'RAID item not found' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM raid_items WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [raidId, orgId, initiativeId]
      );

      await queryHelpers.queryRun(
        `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), initiativeId, 'raid_item_deleted', JSON.stringify(existing), null, actorId, null]
      );

      res.json({ success: true });
    }
  );

  static getHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const rows = await queryHelpers.queryAll(
        `SELECT 
          h.id,
          h.initiative_id as initiativeId,
          h.action as eventType,
          h.changed_by as actorId,
          h.changed_at as createdAt,
          h.old_value as oldValue,
          h.new_value as newValue,
          h.notes
        FROM initiative_history h
        JOIN initiatives i ON i.id = h.initiative_id
        WHERE h.initiative_id = ? AND i.organization_id = ?
        ORDER BY h.changed_at DESC
        LIMIT 200`,
        [initiativeId, orgId]
      );

      res.json({ events: rows });
    }
  );
}

export default InitiativeController;
