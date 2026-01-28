// @ts-nocheck
/**
 * Initiative Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all initiative-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

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

const hasPendingExecutionGateDecisions = async (
  orgId: string,
  initiativeId: string
): Promise<boolean> => {
  const columns = await queryHelpers.queryAll<{ name: string }>('PRAGMA table_info(decisions)');
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
        sql += ` AND (i.source_assessment_id IS NOT NULL OR i.source_report_id IS NOT NULL OR LOWER(COALESCE(i.created_from,'')) = 'assessment')`;
      }
      if (sourceAssessmentId) {
        sql += ` AND i.source_assessment_id = ?`;
        params.push(sourceAssessmentId);
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
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // TODO: Implement full update logic with field mapping
      // For now, return success
      res.json({ message: 'Initiative updated' });
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
        `SELECT status FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const currentStatus = normalizeStatus((existing as Record<string, unknown>).status as string);
      const nextStatus = normalizeStatus(status as string);

      // Gate decision validation
      // Flow: DRAFT -> REVIEW -> APPROVED -> PLANNING -> EXECUTING
      
      // REVIEW -> APPROVED: requires Go/No-Go decision
      if (currentStatus === 'REVIEW' && nextStatus === 'APPROVED') {
        const hasGoNoGo = await hasApprovedGateDecision(
          orgId,
          id,
          'GOVERNANCE_DECISION_MAKING'
        );
        if (!hasGoNoGo) {
          res.status(400).json({
            error: 'Go/No-Go decision is required to approve this initiative',
            rule: 'GATE_DECISION_REQUIRED',
          });
          return;
        }
      }

      // APPROVED -> PLANNING: requires Resources Commit and Schedule Lock decisions
      if (currentStatus === 'APPROVED' && nextStatus === 'PLANNING') {
        const [hasResourcesCommit, hasScheduleLock] = await Promise.all([
          hasApprovedGateDecision(orgId, id, 'RESOURCE_RESPONSIBILITY'),
          hasApprovedGateDecision(orgId, id, 'SCHEDULE_MILESTONES'),
        ]);
        if (!hasResourcesCommit || !hasScheduleLock) {
          res.status(400).json({
            error: 'Resources Commit and Schedule Lock decisions are required to start planning',
            rule: 'GATE_DECISION_REQUIRED',
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

      // TODO: Use InitiativeStatusService when migrated
      const sql = `UPDATE initiatives SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, [nextStatus, new Date().toISOString(), id, orgId]);

      res.json({ id, status: nextStatus, message: 'Status updated' });
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
        `SELECT planned_start_date, planned_end_date FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!current) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

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
            'PLANNING',
            'REVIEW',
            'APPROVED',
            'EXECUTING',
            'BLOCKED',
            'DONE',
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

      const existing = await queryHelpers.queryOne(
        `SELECT id FROM initiative_dependencies
         WHERE organization_id = ? AND from_initiative_id = ? AND to_initiative_id = ?`,
        [orgId, fromInitiativeId, toInitiativeId]
      );
      if (existing) {
        res.json({
          dependency: {
            id: (existing as Record<string, unknown>).id,
            fromInitiativeId,
            toInitiativeId,
            type: type || 'FINISH_TO_START',
            projectId,
          },
        });
        return;
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
}

export default InitiativeController;
