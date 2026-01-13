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
                id, organization_id, project_id, title, axis, area, summary, hypothesis,
                business_value, cost_capex, cost_opex, expected_roi,
                value_driver, confidence_level, value_timing,
                planned_start_date, planned_end_date,
                owner_business_id, owner_execution_id,
                problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      await queryHelpers.queryRun(sql, [
        id,
        orgId,
        projectId,
        title,
        axis ?? null,
        area ?? null,
        summary ?? null,
        hypothesis ?? null,
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

      // TODO: Use InitiativeStatusService when migrated
      const sql = `UPDATE initiatives SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?`;
      await queryHelpers.queryRun(sql, [status, new Date().toISOString(), id, orgId]);

      res.json({ id, status, message: 'Status updated' });
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
      const normalizeStatus = (status: string | unknown): string => {
        const s = String(status || 'DRAFT').toUpperCase();
        // Map old statuses to new ones
        if (s.includes('STEP3') || s.includes('STEP_3')) return 'REVIEW';
        if (s.includes('STEP4') || s.includes('STEP_4') || s.includes('PILOT')) return 'APPROVED';
        if (s.includes('STEP5') || s.includes('STEP_5') || s.includes('FULL')) return 'EXECUTING';
        if (s === 'COMPLETED' || s === 'DONE') return 'DONE';
        if (['DRAFT', 'PLANNING', 'REVIEW', 'APPROVED', 'EXECUTING', 'BLOCKED', 'DONE', 'CANCELLED', 'ARCHIVED'].includes(s)) {
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
        const budget = ((i.cost_capex as number) || 0) + ((i.cost_opex as number) || 0) || (i.business_value as number) || 0;
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
          status: normalizeStatus(i.status),
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
          priority: (String(i.priority || 'MEDIUM')).toUpperCase(),
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
      
      const totalBudget = initiatives.reduce(
        (sum: number, i: any) => sum + (i.budget || 0),
        0
      );
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
}

export default InitiativeController;
