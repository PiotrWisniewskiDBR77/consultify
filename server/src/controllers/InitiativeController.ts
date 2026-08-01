// @ts-nocheck
/**
 * Initiative Controller
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles all initiative-related business logic
 */

import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAiGate } from '../constants/initiativeGateAi.js';
import {
  GATE_PERMISSIONS,
  GateType,
  getGateForTransition,
  isScheduledOnward,
  VALID_TRANSITIONS,
} from '../constants/initiativeStatuses.js';
import activityService from '../services/ActivityService.js';
import auditEventsService from '../services/AuditEventsService.js';
import {
  assertCardMeetsFormula,
  CardContentGateError,
} from '../services/cardContentFormulaValidator.js';
import { fireClosureHandoff } from '../services/executionResultsBridge.js';
import { createInitiative as funnelCreateInitiative } from '../services/initiative/createInitiativeService.js';
import { getGateReadiness } from '../services/initiative/gateAiReadinessService.js';
import { getTimelineFlags } from '../services/initiative/gateTimelineService.js';
import { resolveInitiativeAccessContext } from '../services/initiative/initiativeAccessResolver.js';
import { validateCardContent } from '../services/initiative/initiativeCardValidators.js';
import { isInitiativeGateAiEnabled } from '../services/initiative/initiativeGateAiConfig.js';
import { getBlockingReadinessItems } from '../services/initiative/initiativeGateReadinessService.js';
import {
  evaluateInitiativeGateAccess,
  evaluateInitiativeWriteAccess,
} from '../services/initiative/initiativeGovernanceGuard.js';
import {
  deleteInitiativeKpiAssignment,
  listInitiativeKpiAssignments,
  updateInitiativeKpiAssignment,
  upsertInitiativeKpiAssignment,
} from '../services/initiative/initiativeKpiAssignmentService.js';
import { normalizeInitiativeDbStatusForRead } from '../services/initiative/initiativeLifecycleCanon.js';
import {
  addLinkedItem,
  listLinkedItems,
  removeLinkedItem,
} from '../services/initiative/initiativeLinkedItemsService.js';
import { findSimilarInitiatives } from '../services/initiative/initiativeSimilarityService.js';
import {
  executeInitiativeTransition,
  getColumnNameSet,
  getInitiativeNotificationRecipients,
  normalizeStatus,
  pushOptionalColumnUpdate,
} from '../services/initiative/initiativeTransitionService.js';
import { isRequireInitiativeProjectEnabled } from '../services/initiativeProjectPolicyService.js';
import notificationService from '../services/notificationService.js';
import {
  calculateRiskScore,
  categorizeScore,
  DEFAULT_THRESHOLDS,
} from '../services/raidScoringService.js';
import { syncInitiativeCapacity } from '../services/staffingPlanService.js';
import {
  getInitiativeDetailRead,
  getInitiativeTaskDependenciesRead,
  getPortfolioRead,
} from '../services/v8/planningPortfolioReadService.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { decodeHtmlEntities } from '../utils/htmlEntities.js';
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

const safeJsonParseObject = <T extends Record<string, unknown> = Record<string, unknown>>(
  str: string | null | undefined,
  fallback: T
): T => {
  if (!str || str === '' || str === 'null' || str === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
};

const getTopBarCapabilities = (status: string, userRoles: string[]) => {
  const currentStatus = normalizeStatus(status);
  const isTerminal = currentStatus === 'CANCELLED' || currentStatus === 'ARCHIVED';
  const rolesUpper = (userRoles || []).map((r) => String(r || '').toUpperCase());
  const isAdmin = rolesUpper.includes('ADMIN') || rolesUpper.includes('SUPERADMIN');
  const hasEditRole =
    isAdmin ||
    rolesUpper.some((r) =>
      ['PMO', 'PROJECT_MANAGER', 'PROJECT_LEAD', 'INITIATIVE_OWNER', 'PROJECT_SPONSOR'].includes(r)
    );
  return {
    canEditPriority: hasEditRole && !isTerminal,
    canEditOwner: hasEditRole && !isTerminal,
    canEditTargetDate: hasEditRole && !isTerminal,
  };
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
        res.status(401).json({ error: 'Unauthorized', code: 'INITIATIVES_UNAUTHORIZED' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const headers = req.headers || {};
      const acceptLang =
        (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const { status, source, sourceAssessmentId, projectId, search } = req.query as {
        status?: string;
        source?: string;
        sourceAssessmentId?: string;
        projectId?: string;
        search?: string;
      };
      const priorityRaw = (req.query as any)?.priority as string | string[] | undefined;
      const priorities = Array.isArray(priorityRaw)
        ? priorityRaw
        : priorityRaw
          ? [priorityRaw]
          : [];
      const qh = queryHelpers as unknown as {
        getTableColumns?: (table: string) => Promise<unknown[]>;
        queryAll?: (sql: string, params?: Array<unknown>) => Promise<Record<string, unknown>[]>;
      };
      const initiativeColumns = getColumnNameSet(
        typeof qh.getTableColumns === 'function' ? await qh.getTableColumns('initiatives') : []
      );
      const params: Array<unknown> = [orgId];
      let sql = `
            SELECT i.*, 
                ob.first_name as ob_first_name, ob.last_name as ob_last_name, ob.avatar_url as ob_avatar,
                oe.first_name as oe_first_name, oe.last_name as oe_last_name, oe.avatar_url as oe_avatar,
                COALESCE(sa.framework_type, sa.assessment_type) as source_framework
            FROM initiatives i
            LEFT JOIN users ob ON i.owner_business_id = ob.id
            LEFT JOIN users oe ON i.owner_execution_id = oe.id
            LEFT JOIN assessments sa ON sa.id = COALESCE(i.source_assessment_id, i.source_id)
            WHERE i.organization_id = ?
        `;
      // Zwornik Delta C (§5.2.2) — "Nieprzypisane": reuses this same list
      // endpoint with a sentinel value instead of a dedicated screen, per the
      // SSOT ("widok „Nieprzypisane" na liście inicjatyw"). `?projectId=unassigned`.
      if (projectId === 'unassigned') {
        sql += ` AND i.project_id IS NULL`;
      } else if (projectId) {
        sql += ` AND i.project_id = ?`;
        params.push(String(projectId));
      }
      if (status) {
        sql += ` AND UPPER(i.status) = ?`;
        params.push(normalizeStatus(status));
      }
      if (priorities.length > 0) {
        const normalized = priorities.map((p) => String(p || '').toUpperCase()).filter(Boolean);
        if (normalized.length > 0) {
          sql += ` AND UPPER(COALESCE(i.priority,'')) IN (${normalized.map(() => '?').join(', ')})`;
          params.push(...normalized);
        }
      }
      if (search) {
        const like = `%${String(search).toLowerCase()}%`;
        sql += ` AND (
          LOWER(COALESCE(i.title, i.name, '')) LIKE ?
          OR LOWER(COALESCE(i.summary, '')) LIKE ?
          OR LOWER(COALESCE(i.hypothesis, '')) LIKE ?
        )`;
        params.push(like, like, like);
      }

      const normalizedSourceFilter = source ? source.toString().trim().toLowerCase() : '';
      // Assessment module support: show initiatives derived from assessments/reports
      if (normalizedSourceFilter === 'assessment') {
        // Canonical source tracking (preferred): source_type/source_id
        // Backward compatible (legacy): source_assessment_id/source_report_id/created_from
        const assessmentSourceClauses: string[] = [];
        if (initiativeColumns.has('source_type') && initiativeColumns.has('source_id')) {
          assessmentSourceClauses.push(
            "(i.source_type IN ('assessment','assessment_report','ASSESSMENT','ASSESSMENT_REPORT') AND i.source_id IS NOT NULL AND i.source_id <> '')"
          );
        }
        if (initiativeColumns.has('source_assessment_id')) {
          assessmentSourceClauses.push('i.source_assessment_id IS NOT NULL');
        }
        if (initiativeColumns.has('source_report_id')) {
          assessmentSourceClauses.push('i.source_report_id IS NOT NULL');
        }
        if (initiativeColumns.has('created_from')) {
          assessmentSourceClauses.push("i.created_from IN ('assessment','ASSESSMENT')");
        }
        if (assessmentSourceClauses.length > 0) {
          sql += ` AND (${assessmentSourceClauses.join(' OR ')})`;
        } else {
          sql += ` AND 1 = 0`;
        }
      } else if (normalizedSourceFilter) {
        const sourceClauses: string[] = [];
        if (initiativeColumns.has('source_type')) {
          sourceClauses.push("LOWER(COALESCE(i.source_type, '')) = ?");
          params.push(normalizedSourceFilter);
        }
        if (initiativeColumns.has('created_from')) {
          sourceClauses.push("LOWER(COALESCE(i.created_from, '')) = ?");
          params.push(normalizedSourceFilter);
        }
        if (initiativeColumns.has('category')) {
          sourceClauses.push("LOWER(COALESCE(i.category, '')) = ?");
          params.push(normalizedSourceFilter);
        }
        if (sourceClauses.length > 0) {
          sql += ` AND (${sourceClauses.join(' OR ')})`;
        } else {
          sql += ` AND 1 = 0`;
        }
      }
      if (sourceAssessmentId) {
        // Match both canonical and legacy assessment linkage
        sql += ` AND (
          i.source_assessment_id = ?
          OR (i.source_type IN ('assessment','ASSESSMENT') AND i.source_id = ?)
        )`;
        params.push(sourceAssessmentId, sourceAssessmentId);
      }
      sql += ` ORDER BY i.created_at DESC`;

      const limitRaw = Number((req.query as any)?.limit);
      const offsetRaw = Number((req.query as any)?.offset);
      const pageLimit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 1000) : null;
      const pageOffset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;
      if (pageLimit !== null) {
        sql += ` LIMIT ?`;
        params.push(pageLimit);
        if (pageOffset > 0) {
          sql += ` OFFSET ?`;
          params.push(pageOffset);
        }
      }

      let rows: Record<string, unknown>[] = [];
      try {
        if (typeof qh.queryAll !== 'function') {
          throw new Error('queryAll unavailable');
        }
        rows = await qh.queryAll(sql, params);
      } catch {
        res
          .status(500)
          .json({ error: 'Failed to load initiatives', code: 'INITIATIVES_LIST_FAILED' });
        return;
      }

      const initiatives = rows.map((i: Record<string, unknown>) => ({
        id: i.id,
        organizationId: i.organization_id,
        // #69: Author column (Assessment ▸ Initiatives) — `SELECT i.*` already pulls
        // created_by off the row, but this hand-built response shape dropped it before
        // reaching the client (same class of bug as unifiedSessionsData in
        // DiscoveryToolsHub.tsx, fixed for assessment sessions in commit 94403b4f57).
        createdBy: i.created_by,
        projectId: i.project_id,
        name: getMultilingualText((i.name as string) || (i.title as string), lang),
        axis: i.axis,
        area: i.area,
        summary: getMultilingualText(i.summary as string, lang),
        hypothesis: i.hypothesis,
        status: i.status,
        priority: i.priority || 'medium',
        impact: i.impact || 'medium',
        effort: i.effort,
        // Wiring finding (2026-07-16): `risk_level` is a real column (011/
        // 20260603) already pulled by `SELECT i.*` above, but this hand-built
        // response shape dropped it before reaching the client — same class
        // of bug as the `createdBy` fix above (#69). Additive only: adds a
        // field, changes nothing for existing consumers.
        riskLevel: (i as any).risk_level ?? null,
        category: i.category,
        reportName: i.report_name || null,
        report_name: i.report_name || null,
        initiativeTemplateId: (i as any).initiative_template_id ?? null,
        progress: i.progress || 0,
        currentStage: i.current_stage,
        sourceType: i.source_framework || i.source_type,
        sourceId: i.source_id,
        actionContract: safeJsonParseObject(i.action_contract_json as string, {}),
        sourcePack: safeJsonParseObject(i.source_pack_json as string, {}),
        evidenceRefs: safeJsonParse(i.evidence_refs_json as string, []),
        sourceAssessmentId: i.source_assessment_id,
        sourceFramework: i.source_framework,
        businessValue: i.business_value,
        costCapex: i.cost_capex,
        costOpex: i.cost_opex,
        expectedRoi: i.expected_roi,
        valueDriver: i.value_driver,
        confidenceLevel: i.confidence_level,
        valueTiming: i.value_timing,
        estimatedBudget: i.estimated_budget,
        estimatedTimeline: i.estimated_timeline,
        plannedStartDate: i.planned_start_date,
        plannedEndDate: i.planned_end_date,
        baselineVersion: (i as any).baseline_version ? Number((i as any).baseline_version) : null,
        scheduleBaselineId: (i as any).schedule_baseline_id ?? null,
        actualStartDate: i.actual_start_date,
        actualEndDate: i.actual_end_date,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
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
        res.status(401).json({ error: 'Unauthorized', code: 'INITIATIVES_UNAUTHORIZED' });
        return;
      }

      // Get user language from Accept-Language header or default to English
      const headers = req.headers || {};
      const acceptLang =
        (headers['accept-language'] as string) || (headers['Accept-Language'] as string) || 'en';
      const userLang = acceptLang.split(',')[0].split('-')[0].toLowerCase() || 'en';
      const supportedLangs = ['pl', 'en', 'de', 'es', 'ar', 'ja'];
      const lang = supportedLangs.includes(userLang) ? userLang : 'en';

      const initiative = await getInitiativeDetailRead(id, orgId, lang);
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found', code: 'INITIATIVE_NOT_FOUND' });
        return;
      }
      res.json(initiative);
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

      // M13 SECURITY: pilot participants (USER/GUEST band) may not create
      // initiatives via the API. Authoritative backend of the UI-only pilot gate.
      const createAccess = evaluateInitiativeWriteAccess(req.user?.role, {
        isSuperAdmin: req.user?.isSuperAdmin === true,
      });
      if (!createAccess.allowed) {
        res.status(403).json({ error: createAccess.reason, code: createAccess.code });
        return;
      }

      // Zwornik Delta C (§5.2.1, D-J): every NEW initiative created through the
      // interactive API/wizard MUST name a project — no silent NULL. This is the
      // hard, user-facing half of the anchoring policy; background/AI creators
      // going through the funnel below get the soft auto-anchor instead (see
      // createInitiativeService.ts). Runs BEFORE the funnel/raw-insert branch so
      // it applies regardless of INITIATIVE_FUNNEL_ENABLED.
      if (
        isRequireInitiativeProjectEnabled() &&
        !(req.body as { projectId?: unknown })?.projectId
      ) {
        res.status(400).json({
          error: 'projectId is required — every initiative must belong to a project',
          code: 'INITIATIVE_PROJECT_REQUIRED',
        });
        return;
      }

      // ── O7.1 TWARDA BRAMA (przed zapisem, obie ścieżki: funnel i raw-insert) ──
      // Decyzja Piotra: inicjatywa poniżej progu formuły NIE powstaje. Egzekwuje
      // TYLKO wąską listę blokującą (brak tytułu / placeholder-filler) — reguły
      // kompletności/heurystyki pozostają doradcze, więc lekki quick-create nie
      // jest blokowany. FAIL-OPEN gdy walidator rzuci (bug). Zawór:
      // CARD_CONTENT_HARD_GATE (default ON). Umieszczone TU (a nie tylko w funnelu),
      // bo INITIATIVE_FUNNEL_ENABLED jest domyślnie OFF → to raw-insert jest ŻYWĄ
      // ścieżką na demo (weryfikuj realny runtime, nie flagi).
      try {
        const b = req.body as Record<string, unknown>;
        assertCardMeetsFormula(
          'initiative',
          {
            title: b.title,
            problem_statement: b.problemStatement,
            hypothesis: b.hypothesis,
            summary: b.summary,
            description: b.description,
            business_value: b.businessValue,
          },
          {
            onValidatorError: (err) =>
              logger.warn(
                `[InitiativeController] hard-gate walidator rzucił wyjątek — FAIL-OPEN, karta przechodzi: ${
                  (err as Error)?.message || err
                }`
              ),
          }
        );
      } catch (gateErr) {
        if (gateErr instanceof CardContentGateError) {
          res.status(gateErr.statusCode).json(gateErr.toResponse());
          return;
        }
        throw gateErr;
      }

      // Uspójnienie F1 — single creation funnel (flag-gated rollout). When enabled,
      // creation flows through createInitiativeService (one contract, DRAFT default,
      // name+title). Route already ran validateBody(CreateInitiativeSchema) → validate:false.
      if (process.env.INITIATIVE_FUNNEL_ENABLED === 'true') {
        try {
          const result = await funnelCreateInitiative(orgId, req.body as Record<string, unknown>, {
            validate: false,
            actor: {
              id: req.user?.id,
              ip: (req as { ip?: string }).ip,
              userAgent: (req as { get?: (h: string) => string }).get?.('user-agent'),
            },
          });
          res.json({ id: result.id, name: result.name, message: 'Initiative created' });
        } catch (e) {
          const err = e as { statusCode?: number; message?: string };
          res
            .status(err?.statusCode || 400)
            .json({ error: err?.message || 'Failed to create initiative' });
        }
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
        sourceType,
        sourceId,
        category,
        priority,
        impact,
        effort,
        description,
        sourcePack,
        actionContract,
        evidenceRefs,
        programId,
      } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }
      // F15 (data-integrity, continuation of Z139): INITIATIVE_FUNNEL_ENABLED is
      // default OFF, so this raw-insert branch (not the funnel above) is the
      // live path on demo today. Decode entities the global sanitizer escaped
      // on the title before storing initiatives.title/name.
      const decodedTitle = typeof title === 'string' ? decodeHtmlEntities(title) : title;

      // V3-A01: Traceability guard — non-manual sources require sourceId
      const normalizedSourceType = String(sourceType || 'manual')
        .trim()
        .toLowerCase();
      const normalizedSourceId = sourceId != null ? String(sourceId).trim() : '';
      if (normalizedSourceType !== 'manual' && !normalizedSourceId) {
        res.status(400).json({ error: 'sourceId is required when sourceType is not manual' });
        return;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const sql = `
            INSERT INTO initiatives (
                id, organization_id, project_id, program_id, title, name, category, priority, impact, effort,
                axis, area, summary, hypothesis, status,
                business_value, cost_capex, cost_opex, expected_roi,
                value_driver, confidence_level, value_timing,
                planned_start_date, planned_end_date,
                owner_business_id, owner_execution_id,
                problem_statement, deliverables, success_criteria, scope_in, scope_out, key_risks,
                source_type, source_id, action_contract_json, source_pack_json, evidence_refs_json,
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

      try {
        await queryHelpers.queryRun(sql, [
          id,
          orgId,
          projectId ?? null,
          programId ?? null,
          decodedTitle,
          decodedTitle, // name mirrors title (legacy column, NOT NULL in older schemas)
          category ?? null,
          priority ?? 'medium',
          impact ?? 'medium',
          effort ?? 'medium',
          axis ?? null,
          area ?? null,
          summary ?? null,
          hypothesis ?? description ?? null,
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
          normalizedSourceType,
          normalizedSourceId || null,
          JSON.stringify(
            actionContract && typeof actionContract === 'object' ? actionContract : {}
          ),
          JSON.stringify(sourcePack && typeof sourcePack === 'object' ? sourcePack : {}),
          JSON.stringify(Array.isArray(evidenceRefs) ? evidenceRefs : []),
          req.user?.id ?? null, // created_by
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
                  source_type, source_id,
                  created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
        await queryHelpers.queryRun(legacySql, [
          id,
          orgId,
          projectId ?? null,
          decodedTitle,
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
          normalizedSourceType,
          normalizedSourceId || null,
          req.user?.id ?? null, // created_by
          now,
          now,
        ]);
      }

      try {
        await auditEventsService.log({
          actorId: req.user?.id,
          actorType: 'USER',
          action: 'initiative.created',
          resourceType: 'initiative',
          resourceId: id,
          after: {
            id,
            title: decodedTitle,
            projectId: projectId ?? null,
            status: status ?? null,
            sourceType: normalizedSourceType,
            sourceId: normalizedSourceId || null,
          },
          organizationId: orgId,
          ip: (req as any).ip,
          userAgent: (req as any).get?.('user-agent'),
        });
      } catch {
        /* best-effort audit */
      }
      res.json({ id, name: decodedTitle, message: 'Initiative created' });
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

      // 2.1 Enforce top-bar edit rules (owner / target dates) based on backend capabilities
      const accessCtx = userId
        ? await resolveInitiativeAccessContext(orgId, id, userId, req.user?.role)
        : null;
      const effectiveRoles = accessCtx?.effectiveRoles || [];
      const topBarCaps = getTopBarCapabilities(currentStatus, effectiveRoles);
      const body = req.body as Record<string, unknown>;

      // M13 SECURITY (state-machine bypass): the generic update path is NOT a
      // status-transition endpoint. `status` is gated by the central state machine
      // (isValidTransition + gate RBAC + readiness + Go/No-Go decisions) in
      // updateInitiativeStatus. Writing it here would let a client jump
      // DRAFT → APPROVED directly, skipping every gate. Reject an attempted status
      // CHANGE (a same-value echo is tolerated so clients can PUT the full object
      // back). Status is also dropped from FIELD_MAP below as defense-in-depth.
      if (body.status !== undefined) {
        const requestedStatus = normalizeStatus(body.status as string);
        if (requestedStatus && requestedStatus !== currentStatus) {
          res.status(400).json({
            error:
              'Status cannot be changed via this endpoint. Use POST /initiatives/:id/status (or the transition actions) so gate validation is enforced.',
            field: 'status',
            rule: 'STATUS_TRANSITION_REQUIRES_GATE',
            from: currentStatus,
            to: requestedStatus,
          });
          return;
        }
      }

      const isOwnerUpdate =
        body.ownerId !== undefined ||
        body.ownerBusinessId !== undefined ||
        body.ownerExecutionId !== undefined ||
        body.sponsorId !== undefined;
      const isTargetDateUpdate =
        body.plannedStartDate !== undefined || body.plannedEndDate !== undefined;

      if (isOwnerUpdate && !topBarCaps.canEditOwner) {
        res.status(403).json({
          error: 'Owner cannot be edited in current status for current role',
          field: 'owner',
          currentStatus,
          roles: effectiveRoles,
        });
        return;
      }
      if (isTargetDateUpdate && !topBarCaps.canEditTargetDate) {
        res.status(403).json({
          error: 'Target date cannot be edited in current status for current role',
          field: 'targetDate',
          currentStatus,
          roles: effectiveRoles,
        });
        return;
      }

      // 3. Build update map — only include fields that are provided
      const existingCols = new Set(Object.keys(existing as any));
      const titleCol = existingCols.has('title')
        ? 'title'
        : existingCols.has('name')
          ? 'name'
          : 'title';
      const plannedStartCol = existingCols.has('planned_start_date')
        ? 'planned_start_date'
        : existingCols.has('start_date')
          ? 'start_date'
          : 'planned_start_date';
      const plannedEndCol = existingCols.has('planned_end_date')
        ? 'planned_end_date'
        : existingCols.has('end_date')
          ? 'end_date'
          : 'planned_end_date';
      const ownerExecutionCol = existingCols.has('owner_execution_id')
        ? 'owner_execution_id'
        : existingCols.has('owner_id')
          ? 'owner_id'
          : 'owner_execution_id';

      const FIELD_MAP: Record<string, string> = {
        title: titleCol,
        axis: 'axis',
        area: 'area',
        summary: 'summary',
        // UI uses `description`; DB column is `hypothesis`
        description: 'hypothesis',
        hypothesis: 'hypothesis',
        businessValue: 'business_value',
        costCapex: 'cost_capex',
        costOpex: 'cost_opex',
        expectedRoi: 'expected_roi',
        valueDriver: 'value_driver',
        confidenceLevel: 'confidence_level',
        valueTiming: 'value_timing',
        // NOTE: `status` is intentionally NOT in this allowlist. Status changes must
        // go through updateInitiativeStatus (gate-validated). An attempted status
        // change is rejected above with 400; a same-value echo is simply ignored.
        progress: 'progress',
        plannedStartDate: plannedStartCol,
        plannedEndDate: plannedEndCol,
        // UI aliases
        ownerId: ownerExecutionCol,
        ownerBusinessId: 'owner_business_id',
        ownerExecutionId: ownerExecutionCol,
        sponsorId: 'sponsor_id',
        priority: 'priority',
        marketContext: 'market_context',
        problemStatement: 'problem_statement',
        estimatedBudget: 'estimated_budget',
        // V4-INIT-02: Program hierarchy
        programId: 'program_id',
        parentProgramId: 'program_id',
      };

      // JSON array fields (stored as JSON strings)
      const JSON_FIELDS: Record<string, string> = {
        deliverables: 'deliverables',
        successCriteria: 'success_criteria',
        scopeIn: 'scope_in',
        scopeOut: 'scope_out',
        killCriteria: 'kill_criteria',
        keyRisks: 'key_risks',
        tags: 'tags',
        resourceTools: 'resource_tools',
        targetState: 'target_state',
      };

      const updates: string[] = [];
      const params: unknown[] = [];
      const changes: Array<{ field: string; oldValue: unknown; newValue: unknown }> = [];

      // Process scalar fields
      for (const [bodyKey, dbCol] of Object.entries(FIELD_MAP)) {
        if (body[bodyKey] !== undefined) {
          const oldVal = (existing as Record<string, unknown>)[dbCol];
          // F15 (data-integrity, continuation of Z139): decode HTML entities the
          // global input-sanitization middleware escaped on the title field
          // before storing — same pattern as the create funnel
          // (createInitiativeService.ts). Other scalar fields (dates, ids,
          // numbers) are left untouched.
          const newVal =
            bodyKey === 'title' && typeof body[bodyKey] === 'string'
              ? decodeHtmlEntities(body[bodyKey] as string)
              : body[bodyKey];
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes.push({ field: bodyKey, oldValue: oldVal, newValue: newVal });
          }
          updates.push(`${dbCol} = ?`);
          params.push(newVal ?? null);
        }
      }

      // Mirror name ↔ title: the funnel writes name=title on CREATE, so keep the
      // two columns in lockstep on UPDATE too. The UI only ever edits `title`, and
      // without this a rename would write `title` while leaving the canonical
      // read-compat `name` column stale (name<>title drift). Only when a separate
      // `name` column exists and `title` is the column actually being written.
      if (body.title !== undefined && titleCol === 'title' && existingCols.has('name')) {
        updates.push('name = ?');
        params.push(
          typeof body.title === 'string' ? decodeHtmlEntities(body.title) : (body.title ?? null)
        );
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

      // Mark Complete — AI signal only; lazy ALTER + JSON persist
      if (body.sectionCompletions !== undefined && body.sectionCompletions !== null) {
        const initiativeCols = getColumnNameSet(await queryHelpers.getTableColumns('initiatives'));
        if (!initiativeCols.has('section_completions')) {
          try {
            await queryHelpers.queryRun(
              `ALTER TABLE initiatives ADD COLUMN section_completions TEXT`
            );
          } catch (err: any) {
            const m = String(err?.message || err).toLowerCase();
            if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
          }
        }
        const newJson =
          typeof body.sectionCompletions === 'string'
            ? body.sectionCompletions
            : JSON.stringify(body.sectionCompletions);
        updates.push('section_completions = ?');
        params.push(newJson);
      }

      // Canon sections persisted via dedicated lazy-ALTER'd TEXT columns. Kept
      // separate from the legacy `hypothesis` column (which holds the Initiative
      // Scope narrative via the `description` alias) to avoid collisions.
      const LAZY_FIELDS: Array<{ key: string; col: string; json?: boolean }> = [
        { key: 'hypothesisStatement', col: 'hypothesis_statement' },
        { key: 'lessonsLearned', col: 'lessons_learned' },
        { key: 'changeLog', col: 'change_log', json: true },
        { key: 'okrs', col: 'okrs', json: true },
      ];
      let lazyColsChecked: ReturnType<typeof getColumnNameSet> | null = null;
      for (const f of LAZY_FIELDS) {
        if (body[f.key] === undefined || body[f.key] === null) continue;
        if (!lazyColsChecked) {
          lazyColsChecked = getColumnNameSet(await queryHelpers.getTableColumns('initiatives'));
        }
        if (!lazyColsChecked.has(f.col)) {
          try {
            await queryHelpers.queryRun(`ALTER TABLE initiatives ADD COLUMN ${f.col} TEXT`);
            lazyColsChecked.add(f.col);
          } catch (err: any) {
            const m = String(err?.message || err).toLowerCase();
            if (!m.includes('already exists') && !m.includes('duplicate column')) throw err;
          }
        }
        const val = f.json
          ? typeof body[f.key] === 'string'
            ? body[f.key]
            : JSON.stringify(body[f.key])
          : body[f.key];
        updates.push(`${f.col} = ?`);
        params.push(val ?? null);
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
      // Include updated_by only when column exists (skip on Postgres until migration runs)
      const isPostgres = (process.env.DB_TYPE || '').toLowerCase() === 'postgres';
      if (userId && !isPostgres) {
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
          // FIX (NOT-NULL sweep): initiative_history has no organization_id/actor_name/
          // changes columns (real schema: id, initiative_id, action, old_value, new_value,
          // changed_by, changed_at, notes) — the previous statement targeted columns that
          // don't exist (42703) AND omitted changed_by (NOT NULL, no default → 23502 even
          // if the column names had matched). Both errors were swallowed by the try/catch
          // below, so every write here silently no-op'd. Map to the real columns and keep
          // the rich diff payload in `notes` (same convention as the two other call sites
          // below and in initiativeGovernanceService.ts).
          await queryHelpers.queryRun(
            `INSERT INTO initiative_history (id, initiative_id, action, changed_by, changed_at, notes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              historyId,
              id,
              'fields_updated',
              actorId || 'system',
              now,
              JSON.stringify({
                actorName: actorName || null,
                changes: changes.map((c) => ({
                  field: c.field,
                  from: c.oldValue,
                  to: c.newValue,
                })),
              }),
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
                .catch((err: unknown) => logger.warn('[Initiative] notification failed', err));
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
      try {
        await auditEventsService.log({
          actorId: userId,
          actorType: 'USER',
          action: 'initiative.updated',
          resourceType: 'initiative',
          resourceId: id,
          before: {
            status: currentStatus,
            ...Object.fromEntries(changes.map((c) => [c.field, c.oldValue])),
          },
          after: updated as Record<string, unknown>,
          metadata: { changesCount: changes.length },
          organizationId: orgId,
          ip: (req as any).ip,
          userAgent: (req as any).get?.('user-agent'),
        });
      } catch {
        /* best-effort audit */
      }
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
      const actorId = req.user?.id;
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const overrideReason = (req.body as any)?.overrideReason;

      const result = await executeInitiativeTransition({
        orgId,
        initiativeId: id,
        actorId,
        actorRole: req.user?.role ?? null,
        actorFirstName: req.user?.firstName ?? null,
        actorLastName: req.user?.lastName ?? null,
        actorEmail: req.user?.email ?? null,
        requestIp: (req as any).ip ?? null,
        requestUserAgent: (req as any).get?.('user-agent') ?? null,
        nextStatusInput: status as string,
        reason,
        overrideReason,
      });

      if (!result.ok) {
        res.status(result.statusCode).json(result.body);
        return;
      }

      res.json({
        id: result.id,
        status: result.status,
        previousStatus: result.previousStatus,
        gate: result.gate,
        message: 'Status updated',
      });
    }
  );

  // ==========================================
  // INITIATIVE: TASK DEPENDENCIES (aggregated)
  // ==========================================

  /**
   * Get all task dependencies within an initiative, formatted for the UI table.
   *
   * Returns rows compatible with `TaskDependency` (frontend), including `sourceTaskId`
   * so the UI can call existing task dependency endpoints for edit/copy/delete.
   *
   * GET /api/initiatives/:id/task-dependencies
   */
  static getInitiativeTaskDependencies = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const dependencies = await getInitiativeTaskDependenciesRead(initiativeId, orgId);
      res.json({ dependencies });
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

      if (status !== undefined) {
        res.status(400).json({
          error: 'Status cannot be updated via quick-update. Use /initiatives/:id/status endpoint.',
          field: 'status',
        });
        return;
      }

      const current = await queryHelpers.queryOne(
        `SELECT status, planned_start_date, planned_end_date, owner_business_id, owner_execution_id, name
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
      const currentStatus = normalizeStatus((current as any)?.status);

      // Enforce top-bar edit rules for quick update endpoint
      const accessCtx = actorId
        ? await resolveInitiativeAccessContext(orgId, id, actorId, req.user?.role)
        : null;
      const effectiveRoles = accessCtx?.effectiveRoles || [];
      const topBarCaps = getTopBarCapabilities(currentStatus, effectiveRoles);

      if (priority !== undefined && !topBarCaps.canEditPriority) {
        res.status(403).json({
          error: 'Priority cannot be edited in current status for current role',
          field: 'priority',
          currentStatus,
          roles: effectiveRoles,
        });
        return;
      }
      if (
        (ownerBusinessId !== undefined || ownerExecutionId !== undefined) &&
        !topBarCaps.canEditOwner
      ) {
        res.status(403).json({
          error: 'Owner cannot be edited in current status for current role',
          field: 'owner',
          currentStatus,
          roles: effectiveRoles,
        });
        return;
      }
      if (
        (plannedStartDate !== undefined || plannedEndDate !== undefined) &&
        !topBarCaps.canEditTargetDate
      ) {
        res.status(403).json({
          error: 'Target date cannot be edited in current status for current role',
          field: 'targetDate',
          currentStatus,
          roles: effectiveRoles,
        });
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
      const data = await getPortfolioRead(orgId, {
        projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
        programId: typeof req.query.programId === 'string' ? req.query.programId : undefined,
        statuses: (req.query as any)?.statuses as string | string[] | undefined,
        status: (req.query as any)?.status as string | string[] | undefined,
        priority: (req.query as any)?.priority as string | string[] | undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      });

      res.json(data);
    }
  );

  /**
   * V4-INIT-02: Get portfolio rollups by program (hierarchy)
   * Returns programs with initiative counts and health distribution
   */
  static getPortfolioRollups = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { projectId, parentProgramId } = req.query as {
        projectId?: string;
        parentProgramId?: string;
      };

      const rollupParams: unknown[] = [orgId];
      let rollupSql = `
        SELECT
          COALESCE(i.program_id, '__ungrouped__') AS program_id,
          p.name AS program_name,
          p.parent_program_id,
          COUNT(*) AS initiative_count,
          SUM(COALESCE(i.cost_capex, 0) + COALESCE(i.cost_opex, 0)) AS total_budget,
          -- business_value is stored as TEXT; a bare COALESCE(.., 0) makes Postgres
          -- try to unify TEXT with INTEGER -> 42804. Guard the numeric cast so free-text
          -- values do not blow up (would be 22P02) and non-numeric rows count as 0.
          -- IMPORTANT: no literal question-mark chars anywhere here (comment or regex) —
          -- adaptQuery naively rewrites every question-mark to a $n placeholder, even
          -- inside comments and string literals, so use {0,1} for the optional quantifier.
          SUM(CASE WHEN i.business_value ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$'
                   THEN i.business_value::numeric ELSE 0 END) AS total_value,
          SUM(CASE WHEN UPPER(COALESCE(i.status,'')) IN ('EXECUTING','DONE','TRACKING') THEN 1 ELSE 0 END) AS health_green,
          SUM(CASE WHEN UPPER(COALESCE(i.status,'')) IN ('APPROVED','REVIEW','PROMOTED','SCHEDULED','PLANNING') THEN 1 ELSE 0 END) AS health_amber,
          SUM(CASE WHEN UPPER(COALESCE(i.status,'')) NOT IN ('EXECUTING','DONE','TRACKING','APPROVED','REVIEW','PROMOTED','SCHEDULED','PLANNING') OR i.status IS NULL THEN 1 ELSE 0 END) AS health_red
        FROM initiatives i
        LEFT JOIN programs p ON p.id = i.program_id AND p.organization_id = i.organization_id
        WHERE i.organization_id = ?
      `;
      if (projectId) {
        rollupSql += ` AND i.project_id = ?`;
        rollupParams.push(String(projectId));
      }
      if (parentProgramId) {
        rollupSql += ` AND p.parent_program_id = ?`;
        rollupParams.push(String(parentProgramId));
      }
      rollupSql += ` GROUP BY COALESCE(i.program_id, '__ungrouped__'), p.name, p.parent_program_id ORDER BY initiative_count DESC`;

      const rows = await queryHelpers.queryAll(rollupSql, rollupParams);

      let childProgramsMap: Record<
        string,
        Array<{ id: string; name: string; status: string }>
      > = {};
      try {
        const allPrograms = await queryHelpers.queryAll(
          `SELECT id, name, status, parent_program_id FROM programs WHERE organization_id = ?`,
          [orgId]
        );
        for (const cp of allPrograms as Array<Record<string, unknown>>) {
          const parentId = cp.parent_program_id as string | null;
          if (parentId) {
            if (!childProgramsMap[parentId]) childProgramsMap[parentId] = [];
            childProgramsMap[parentId].push({
              id: cp.id as string,
              name: cp.name as string,
              status: cp.status as string,
            });
          }
        }
      } catch {
        childProgramsMap = {};
      }

      const programs = rows.map((r: Record<string, unknown>) => {
        const pid = (r.program_id as string) === '__ungrouped__' ? null : (r.program_id as string);
        return {
          programId: pid,
          programName: (r.program_name as string) || null,
          parentProgramId: (r.parent_program_id as string) || null,
          initiativeCount: Number(r.initiative_count),
          totalBudget: Number(r.total_budget) || 0,
          totalValue: Number(r.total_value) || 0,
          health: {
            green: Number(r.health_green) || 0,
            amber: Number(r.health_amber) || 0,
            red: Number(r.health_red) || 0,
          },
          childPrograms: pid ? childProgramsMap[pid] || [] : [],
        };
      });

      res.json({ programs });
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
      // Schema compatibility:
      // - legacy: from_initiative_id / to_initiative_id
      // - newer: source_id / target_id
      let cols: Set<string> = new Set();
      try {
        const colRows = (await queryHelpers.queryAll(
          `SELECT LOWER(column_name) as column_name
           FROM information_schema.columns
           WHERE table_name = 'initiative_dependencies'`
        )) as Array<{ column_name?: string }>;
        cols = new Set((colRows || []).map((r) => String(r.column_name || '')).filter(Boolean));
      } catch {
        cols = new Set();
      }

      const fromExpr = cols.has('from_initiative_id')
        ? 'from_initiative_id'
        : cols.has('source_id')
          ? 'source_id'
          : 'NULL';
      const toExpr = cols.has('to_initiative_id')
        ? 'to_initiative_id'
        : cols.has('target_id')
          ? 'target_id'
          : 'NULL';

      let sql = `
            SELECT id,
                   ${fromExpr} as from_initiative_id,
                   ${toExpr} as to_initiative_id,
                   type,
                   project_id
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
      // Schema compatibility: some environments require source_id/target_id (NOT NULL).
      let cols: Set<string> = new Set();
      try {
        const colRows = (await queryHelpers.queryAll(
          `SELECT LOWER(column_name) as column_name
           FROM information_schema.columns
           WHERE table_name = 'initiative_dependencies'`
        )) as Array<{ column_name?: string }>;
        cols = new Set((colRows || []).map((r) => String(r.column_name || '')).filter(Boolean));
      } catch {
        cols = new Set();
      }

      const insertCols: string[] = ['id', 'organization_id', 'project_id'];
      const insertVals: any[] = [id, orgId, resolvedProjectId || null];

      if (cols.has('from_initiative_id')) {
        insertCols.push('from_initiative_id');
        insertVals.push(fromInitiativeId);
      }
      if (cols.has('to_initiative_id')) {
        insertCols.push('to_initiative_id');
        insertVals.push(toInitiativeId);
      }
      if (cols.has('source_id')) {
        insertCols.push('source_id');
        insertVals.push(fromInitiativeId);
      }
      if (cols.has('target_id')) {
        insertCols.push('target_id');
        insertVals.push(toInitiativeId);
      }
      if (cols.has('type')) {
        insertCols.push('type');
        insertVals.push(type || 'FINISH_TO_START');
      }
      if (cols.has('created_at')) {
        insertCols.push('created_at');
        insertVals.push(new Date().toISOString());
      }
      if (cols.has('created_by')) {
        insertCols.push('created_by');
        insertVals.push(req.user?.id || null);
      }

      const placeholders = insertCols.map(() => '?').join(', ');
      await queryHelpers.queryRun(
        `INSERT INTO initiative_dependencies (${insertCols.join(', ')}) VALUES (${placeholders})`,
        insertVals
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
      const initiative = await queryHelpers.queryOne<any>(
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
      const initiative = await queryHelpers.queryOne<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // M13 SECURITY: governance gate role check (SUBMIT_REVIEW owned by
      // Initiative Owner / PMO / Project Lead / Admin). A bare TEAM_MEMBER /
      // pilot participant is rejected with 403.
      const submitGate = await evaluateInitiativeGateAccess({
        organizationId: String(orgId),
        initiativeId: String(initiativeId),
        userId: String(userId),
        gate: 'SUBMIT_REVIEW',
        systemRoleHint: req.user?.role,
        isSuperAdmin: req.user?.isSuperAdmin === true,
      });
      if (!submitGate.allowed) {
        res.status(403).json({ error: submitGate.reason, code: submitGate.code });
        return;
      }

      if (initiative.status !== 'planning') {
        res
          .status(400)
          .json({ error: `Cannot submit for review from status: ${initiative.status}` });
        return;
      }

      // Update status to review
      await queryHelpers.queryRun(
        `UPDATE initiatives SET 
                status = 'review',
                review_requested_at = CURRENT_TIMESTAMP,
                review_requested_by = ?,
                updated_at = CURRENT_TIMESTAMP
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
   *
   * H16 fix (2026-08-01): now a thin adapter over executeInitiativeTransition,
   * targeting the real next canonical status from REVIEW: PROMOTED (gate
   * ACCEPT — GATE_PERMISSIONS[ACCEPT] = PROJECT_SPONSOR / STEERING_COMMITTEE,
   * expanding to PORTFOLIO_OWNER when no steering board is enabled, or ADMIN
   * unconditionally). This REPLACES the old bespoke REVIEW->'approved'
   * shortcut, which used a more permissive legacy role table
   * (evaluateInitiativeGateAccess granted PMO too — an over-grant neither the
   * canonical GATE_PERMISSIONS nor the independent effectiveAccessService
   * capability template agree with) and skipped PROMOTED/PLANNING entirely,
   * the GOVERNANCE_DECISION_MAKING GO/NO-GO gate, the AI soft-block, and
   * readiness checks.
   *
   * BEHAVIOR CHANGE — document for callers:
   *   Before: any REVIEW-status initiative, PMO/Sponsor/Steering/Portfolio/Admin
   *     role, no GO/NO-GO decision required -> status='approved' (lowercase;
   *     not even a legal VALID_TRANSITIONS target).
   *   After:  only a REVIEW-status initiative, caller holding
   *     PROJECT_SPONSOR/STEERING_COMMITTEE(/PORTFOLIO_OWNER)/ADMIN, WITH a
   *     current (non-superseded) approved GOVERNANCE_DECISION_MAKING decision
   *     -> status='PROMOTED' (canonical). PMO alone can no longer call this
   *     endpoint successfully (403) unless also holding one of the roles above.
   *   roadmapQuarter/roadmapYear: the canonical transition engine has no
   *     concept of these fields (grepped updateInitiative's FIELD_MAP — no
   *     other endpoint sets them either). Preserved here as a best-effort,
   *     non-blocking side update AFTER a successful transition so existing
   *     callers don't silently lose this capability.
   *   comment: now flows into the transition's audit trail (reason) instead
   *     of the approval_comment column directly — that column is only written
   *     by the canonical engine when nextStatus === 'APPROVED', a later stage
   *     than PROMOTED.
   *   Known caller: tests/e2e/m13/m13-manual.spec.ts §4.2 posts an empty body
   *     to this route right after submit-review (status is PENDING_REVIEW at
   *     that point, not REVIEW) and only asserts `status < 500` — both the
   *     old and new code return 400 there, so that test is unaffected. A
   *     caller that wants a real PROMOTED result now needs REVIEW status, one
   *     of the roles above, and a current approved GOVERNANCE_DECISION_MAKING
   *     decision to already exist — none of which the old endpoint required.
   */
  static approveInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { comment, roadmapQuarter, roadmapYear, overrideReason } = req.body as Record<
        string,
        unknown
      >;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await executeInitiativeTransition({
        orgId,
        initiativeId,
        actorId: userId,
        actorRole: req.user?.role ?? null,
        actorFirstName: req.user?.firstName ?? null,
        actorLastName: req.user?.lastName ?? null,
        actorEmail: req.user?.email ?? null,
        requestIp: (req as any).ip ?? null,
        requestUserAgent: (req as any).get?.('user-agent') ?? null,
        nextStatusInput: 'PROMOTED',
        reason: comment ? String(comment) : null,
        // ACCEPT (REVIEW->PROMOTED) is one of the 9 AI_GATES — inherited from the
        // canonical engine along with everything else. Threaded through so a
        // caller hitting the (flag-gated, per-org, fail-open) AI soft-block via
        // THIS route retains the same override escape hatch PATCH /:id/status
        // already has, instead of being stuck with no way to proceed.
        overrideReason: overrideReason ? String(overrideReason) : null,
      });

      if (!result.ok) {
        res.status(result.statusCode).json({ ...result.body, initiativeId });
        return;
      }

      // Best-effort, non-blocking: preserve legacy roadmapQuarter/roadmapYear
      // persistence. This is a plain data write (no authorization or
      // state-machine logic of its own) — the transition above already
      // enforced who may act and whether the GO/NO-GO decision is current, so
      // this cannot reintroduce the bypass being closed.
      if (roadmapQuarter !== undefined || roadmapYear !== undefined) {
        try {
          const cols = getColumnNameSet(await queryHelpers.getTableColumns('initiatives'));
          const updates: string[] = [];
          const vals: unknown[] = [];
          pushOptionalColumnUpdate(updates, vals, cols, 'roadmap_quarter', roadmapQuarter ?? null);
          pushOptionalColumnUpdate(updates, vals, cols, 'roadmap_year', roadmapYear ?? null);
          if (updates.length > 0) {
            vals.push(initiativeId, orgId);
            await queryHelpers.queryRun(
              `UPDATE initiatives SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
              vals
            );
          }
        } catch (e: any) {
          logger.warn(
            '[initiatives] approveInitiative: roadmap fields best-effort write failed:',
            e?.message
          );
        }
      }

      res.json({
        success: true,
        message: 'Initiative approved',
        initiativeId,
        newStatus: result.status,
      });
    }
  );

  /**
   * Start execution
   *
   * H16 fix (2026-08-01): now a thin adapter over executeInitiativeTransition,
   * targeting EXECUTING. This closes the SCHEDULED->EXECUTING bypass this
   * packet exists for: the handler previously had ZERO authorization inside
   * it (no role check, no capability call — only the inert shadow-mode
   * capability middleware wrapped the route, and shadow mode always calls
   * next() regardless of the computed verdict) and accepted a direct
   * APPROVED->EXECUTING jump, skipping SCHEDULED entirely — illegal per
   * VALID_TRANSITIONS[APPROVED] (only SCHEDULED/CANCELLED).
   *
   * BEHAVIOR CHANGE — document for callers:
   *   Before: any initiative with status (case-insensitively) 'approved' ->
   *     status='EXECUTING', no role check, no decision check, no audit row.
   *   After:  only a SCHEDULED-status initiative; caller must hold PMO/ADMIN
   *     (gate START, GATE_PERMISSIONS[START] = PMO); AND a current approved
   *     GOVERNANCE_DECISION_MAKING decision must exist (new — this transition
   *     previously had no decision gate at all, even on the canonical PATCH
   *     path). Calling this on an APPROVED (not yet SCHEDULED) initiative now
   *     correctly returns 400 INVALID_TRANSITION instead of silently
   *     "succeeding" by skipping the SCHEDULED gate.
   *   Known caller: tests/acceptance/h16-start-execution.e2e.test.ts
   *     currently documents/asserts the OLD bypass behavior as correct; a
   *     separate agent owns rewriting it to assert this new contract (that
   *     rewrite is the actual proof this fix works end-to-end).
   */
  static startExecution = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { overrideReason } = req.body as Record<string, unknown>;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const result = await executeInitiativeTransition({
        orgId,
        initiativeId,
        actorId: userId,
        actorRole: req.user?.role ?? null,
        actorFirstName: req.user?.firstName ?? null,
        actorLastName: req.user?.lastName ?? null,
        actorEmail: req.user?.email ?? null,
        requestIp: (req as any).ip ?? null,
        requestUserAgent: (req as any).get?.('user-agent') ?? null,
        nextStatusInput: 'EXECUTING',
        // START (SCHEDULED->EXECUTING) is also an AI_GATE — see the identical
        // note in approveInitiative above.
        overrideReason: overrideReason ? String(overrideReason) : null,
      });

      if (!result.ok) {
        res.status(result.statusCode).json({ ...result.body, initiativeId });
        return;
      }

      res.json({
        success: true,
        message: 'Initiative execution started',
        initiativeId,
        newStatus: result.status,
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

      await queryHelpers.queryRun(
        `UPDATE initiatives SET 
                status = 'blocked',
                blocked_at = CURRENT_TIMESTAMP,
                blocked_reason = ?,
                updated_at = CURRENT_TIMESTAMP
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

      await queryHelpers.queryRun(
        `UPDATE initiatives SET 
                status = 'executing',
                unblocked_at = CURRENT_TIMESTAMP,
                blocked_reason = NULL,
                updated_at = CURRENT_TIMESTAMP
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

      await queryHelpers.queryRun(
        `UPDATE initiatives SET
                status = 'done',
                done_at = CURRENT_TIMESTAMP,
                done_by = ?,
                benefits_tracking_enabled = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND organization_id = ?`,
        [userId, enableBenefitsTracking ? 1 : 0, initiativeId, orgId]
      );

      // G1 fix (2026-07-10): this endpoint was a second DONE-transition path
      // that bypassed the M14→M15 closure handoff entirely (audit found it
      // has no frontend caller today, but it is a live, unguarded route —
      // leaving it unwired would silently reopen the same data-integrity gap
      // the moment anything starts calling it). Same choke-point wrapper as
      // updateInitiativeStatus; fire-and-forget + idempotent internally.
      fireClosureHandoff(orgId, initiativeId, userId);

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
      const targetProject = await queryHelpers.queryOne<{ id: string }>(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [targetProjectId, orgId]
      );

      if (!targetProject) {
        res.status(404).json({ error: 'Target project not found' });
        return;
      }

      // Get current project
      const initiative = await queryHelpers.queryOne<{ project_id: string }>(
        'SELECT project_id FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const oldProjectId = initiative.project_id;

      // Move initiative
      await queryHelpers.queryRun(
        `UPDATE initiatives SET 
                project_id = ?,
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
        [targetProjectId, initiativeId]
      );

      // Optionally move associated tasks
      if (moveTasks) {
        await queryHelpers.queryRun(
          `UPDATE tasks SET 
                    project_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                 WHERE initiative_id = ?`,
          [targetProjectId, initiativeId]
        );
      }

      // Record history
      await queryHelpers.queryRun(
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
   * Zwornik Delta C (§5.2.2) — bulk-assign "Nieprzypisane" initiatives to a
   * project. Reuses the same per-initiative move logic as `moveInitiative`
   * (verify target project once, then update project_id + optionally tasks +
   * history per initiative), looped and fail-soft per id so one bad id in the
   * batch does not abort the rest.
   */
  static bulkAssignInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const { initiativeIds, targetProjectId, moveTasks } = req.body as {
        initiativeIds?: unknown;
        targetProjectId?: unknown;
        moveTasks?: unknown;
      };

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!targetProjectId || typeof targetProjectId !== 'string') {
        res.status(400).json({ error: 'targetProjectId is required' });
        return;
      }
      const ids = Array.isArray(initiativeIds)
        ? initiativeIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
        : [];
      if (ids.length === 0) {
        res.status(400).json({ error: 'initiativeIds must be a non-empty array' });
        return;
      }

      const targetProject = await queryHelpers.queryOne<{ id: string }>(
        'SELECT id FROM projects WHERE id = ? AND organization_id = ?',
        [targetProjectId, orgId]
      );
      if (!targetProject) {
        res.status(404).json({ error: 'Target project not found' });
        return;
      }

      const results: Array<{ initiativeId: string; success: boolean; error?: string }> = [];
      for (const initiativeId of ids) {
        try {
          const initiative = await queryHelpers.queryOne<{ project_id: string | null }>(
            'SELECT project_id FROM initiatives WHERE id = ? AND organization_id = ?',
            [initiativeId, orgId]
          );
          if (!initiative) {
            results.push({ initiativeId, success: false, error: 'Initiative not found' });
            continue;
          }
          const oldProjectId = initiative.project_id;

          await queryHelpers.queryRun(
            `UPDATE initiatives SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [targetProjectId, initiativeId]
          );

          if (moveTasks) {
            await queryHelpers.queryRun(
              `UPDATE tasks SET project_id = ?, updated_at = CURRENT_TIMESTAMP WHERE initiative_id = ?`,
              [targetProjectId, initiativeId]
            );
          }

          await queryHelpers.queryRun(
            `INSERT INTO initiative_history (id, initiative_id, action, old_value, new_value, changed_by, notes)
                 VALUES (?, ?, 'moved', ?, ?, ?, ?)`,
            [
              uuidv4(),
              initiativeId,
              JSON.stringify({ project_id: oldProjectId }),
              JSON.stringify({ project_id: targetProjectId }),
              userId,
              'Bulk-assigned from Nieprzypisane (Zwornik Delta C)',
            ]
          );

          results.push({ initiativeId, success: true });
        } catch (err) {
          results.push({
            initiativeId,
            success: false,
            error: (err as Error)?.message || 'Assign failed',
          });
        }
      }

      const assignedCount = results.filter((r) => r.success).length;
      res.json({
        success: assignedCount > 0,
        targetProjectId,
        assignedCount,
        failedCount: results.length - assignedCount,
        results,
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

      const initiative = await queryHelpers.queryOne<{ status: string }>(
        'SELECT status FROM initiatives WHERE id = ? AND organization_id = ?',
        [initiativeId, orgId]
      );

      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // Status is persisted with the canonical UPPERCASE enum values
      // (InitiativeStatus.DONE/CANCELLED). A previous lowercase guard
      // ('done'/'cancelled') never matched, so archive was effectively
      // always rejected — normalize before comparing. DRAFT initiatives
      // are not archivable; use hard delete to discard them.
      const currentStatus = normalizeStatus(initiative.status);
      if (!['DONE', 'CANCELLED'].includes(currentStatus)) {
        res.status(400).json({
          error: 'Only done or cancelled initiatives can be archived',
          status: currentStatus,
        });
        return;
      }

      await queryHelpers.queryRun(
        `UPDATE initiatives SET
                status = 'ARCHIVED',
                updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
        [initiativeId]
      );

      res.json({
        success: true,
        message: 'Initiative archived',
        initiativeId,
        newStatus: 'ARCHIVED',
      });
    }
  );

  /**
   * Hard-delete an initiative (DELETE /api/initiatives/:id).
   *
   * Object-level authorization: org isolation (a foreign-org id resolves to
   * 404, never leaks) plus owner-or-admin (any owner/sponsor/creator column,
   * or an organization admin). Most child rows are removed by ON DELETE
   * CASCADE FKs; this handler additionally clears the references the schema
   * does NOT cascade:
   *   - digitization_analyses.initiative_id (RESTRICT FK — would otherwise
   *     block the delete with a FK violation on Postgres),
   *   - link_graph_edges (no FK — edges on either side),
   *   - v8_provenance_ledger (referenced by output_id, no FK).
   *
   * This is the path that lets DRAFT initiatives created via the notebook
   * "convert" flow be discarded (previously unreachable: the only DELETE
   * handler lived in an unmounted legacy router).
   */
  static deleteInitiative = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const role = (req.user as any)?.role as string | undefined;
      const initiativeId = req.params.id;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Org-scoped read: a cross-org id never resolves here, so the response
      // is an indistinguishable 404 (no existence leak).
      const existing = await queryHelpers.queryOne<{
        id: string;
        status: string | null;
        owner_business_id: string | null;
        owner_execution_id: string | null;
        sponsor_id: string | null;
        created_by: string | null;
      }>(
        `SELECT id, status, owner_business_id, owner_execution_id, sponsor_id, created_by
           FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );

      if (!existing) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const ownerIds = [
        existing.owner_business_id,
        existing.owner_execution_id,
        existing.sponsor_id,
        existing.created_by,
      ]
        .filter(Boolean)
        .map((v) => String(v));
      const isOwner = !!userId && ownerIds.includes(String(userId));
      // Privileged roles: any *ADMIN* variant plus the organization OWNER —
      // OWNER outranks ADMIN but does not contain the substring, so a plain
      // `.includes('ADMIN')` locked org owners out of deleting initiatives.
      const upperRole = String(role || '').toUpperCase();
      const isAdmin = upperRole.includes('ADMIN') || upperRole === 'OWNER';
      if (!isOwner && !isAdmin) {
        res.status(403).json({
          error: 'Only the initiative owner or an organization admin can delete it',
          code: 'INITIATIVE_DELETE_FORBIDDEN',
        });
        return;
      }

      // Hard-delete is only allowed for not-yet-active initiatives. An active
      // initiative (PLANNING…TRACKING) is linked into M14/15/16 (deployment,
      // results, finance) and must be CANCELLED first so those rows unwind
      // through the lifecycle rather than being orphaned by a raw delete.
      const DELETABLE_STATUSES = new Set(['DRAFT', 'CANCELLED']);
      const currentStatus = String(existing.status || 'DRAFT').toUpperCase();
      if (!DELETABLE_STATUSES.has(currentStatus)) {
        res.status(409).json({
          error: 'Only DRAFT or CANCELLED initiatives can be deleted. Cancel the initiative first.',
          code: 'INITIATIVE_DELETE_INVALID_STATE',
          status: currentStatus,
        });
        return;
      }

      // Clear references the DB FKs do not cascade. Each is best-effort: a
      // table absent in a given schema variant must not block the delete.
      try {
        await queryHelpers.queryRun(
          'UPDATE digitization_analyses SET initiative_id = NULL WHERE initiative_id = ?',
          [initiativeId]
        );
      } catch (e: any) {
        logger.warn('[initiatives] delete: digitization_analyses unlink skipped:', e?.message);
      }
      try {
        await queryHelpers.queryRun(
          `DELETE FROM link_graph_edges
             WHERE organization_id = ?
               AND ((source_type = 'initiative' AND source_id = ?)
                 OR (target_type = 'initiative' AND target_id = ?))`,
          [orgId, initiativeId, initiativeId]
        );
      } catch (e: any) {
        logger.warn('[initiatives] delete: link_graph_edges cleanup skipped:', e?.message);
      }
      try {
        await queryHelpers.queryRun(
          'DELETE FROM v8_provenance_ledger WHERE organization_id = ? AND output_id = ?',
          [orgId, initiativeId]
        );
      } catch (e: any) {
        logger.warn('[initiatives] delete: provenance cleanup skipped:', e?.message);
      }

      // Hard delete — child tables with ON DELETE CASCADE clean themselves up.
      await queryHelpers.queryRun('DELETE FROM initiatives WHERE id = ? AND organization_id = ?', [
        initiativeId,
        orgId,
      ]);

      res.json({ success: true, message: 'Initiative deleted', initiativeId });
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

      try {
        const kpis = await listInitiativeKpiAssignments(initiativeId, orgId);
        res.json({ kpis });
      } catch (err: any) {
        if (String(err?.message || '').includes('Initiative not found')) {
          res.status(404).json({ error: 'Initiative not found' });
          return;
        }
        throw err;
      }
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
        observationPhase,
        trackedInRealization,
        trackedPostImplementation,
        observationStatus,
        definitionSource,
        realizationExpectation,
        postImplementationExpectation,
      } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!name || !unit) {
        res.status(400).json({ error: 'Name and unit are required' });
        return;
      }
      try {
        const kpi = await upsertInitiativeKpiAssignment({
          initiativeId,
          organizationId: orgId,
          userId: req.user?.id || null,
          name,
          description: description || null,
          category: category || 'benefits',
          unit,
          baselineValue,
          targetValue,
          measurementFrequency,
          observationPhase,
          trackedInRealization,
          trackedPostImplementation,
          observationStatus,
          definitionSource,
          realizationExpectation,
          postImplementationExpectation,
        });

        res.status(201).json({
          success: true,
          kpi,
        });
      } catch (err: any) {
        const message = String(err?.message || '');
        if (message.includes('Initiative not found')) {
          res.status(404).json({ error: 'Initiative not found' });
          return;
        }
        if (message.includes('KPI name is required')) {
          res.status(400).json({ error: 'KPI name is required' });
          return;
        }
        throw err;
      }
    }
  );

  /**
   * Update KPI assignment for an initiative
   */
  static updateInitiativeKpi = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, kpiId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        // M13 SECURITY (mass-assignment): server-derived identity/tenant fields MUST
        // win over the request body. Spreading `...req.body` LAST would let a client
        // override organizationId/initiativeId/kpiId/userId — defeating the
        // org-scope assertions inside updateInitiativeKpiAssignment. Spread the body
        // first, then pin the protected fields from the route params + token.
        const kpi = await updateInitiativeKpiAssignment({
          ...req.body,
          initiativeId,
          organizationId: orgId,
          userId: req.user?.id || null,
          kpiId,
        });

        res.json({ success: true, kpi });
      } catch (err: any) {
        const message = String(err?.message || '');
        if (message.includes('Initiative not found') || message.includes('KPI not found')) {
          res
            .status(404)
            .json({ error: message.includes('KPI') ? 'KPI not found' : 'Initiative not found' });
          return;
        }
        throw err;
      }
    }
  );

  /**
   * Delete KPI assignment for an initiative
   */
  static deleteInitiativeKpi = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, kpiId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        await deleteInitiativeKpiAssignment({
          initiativeId,
          organizationId: orgId,
          kpiId,
        });
        res.json({ success: true });
      } catch (err: any) {
        const message = String(err?.message || '');
        if (message.includes('Initiative not found') || message.includes('KPI not found')) {
          res
            .status(404)
            .json({ error: message.includes('KPI') ? 'KPI not found' : 'Initiative not found' });
          return;
        }
        throw err;
      }
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

      // H4.4 fix (SQLite-izm systemowy — MEMORY finding_unquoted_camelcase_aliases_systemic):
      // unquoted camelCase aliases fold to all-lowercase on Postgres (initiativeId ->
      // initiativeid, targetDate -> targetdate, orderIndex -> orderindex, isGate ->
      // isgate, …), so every camelCase field below came back `undefined` in the JSON
      // response on Postgres (and `Boolean(m.isGate)` was silently ALWAYS false).
      // Double-quoting preserves the case on both engines without touching the
      // frontend contract (Gantt/timeline UI already expects these camelCase keys).
      const milestones = await queryHelpers.queryAll(
        `SELECT
          id,
          initiative_id as "initiativeId",
          name,
          description,
          target_date as "targetDate",
          actual_date as "actualDate",
          status,
          order_index as "orderIndex",
          is_gate as "isGate",
          gate_decision_id as "gateDecisionId",
          created_at as "createdAt",
          updated_at as "updatedAt"
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
      // H4.4 fix (SQLite-izm systemowy — MEMORY finding_unquoted_camelcase_aliases_systemic):
      // unquoted camelCase alias `maxOrder` gets folded to lowercase `maxorder` by
      // Postgres, so `.maxOrder` silently read `undefined` and EVERY milestone was
      // inserted with order_index=1 (nextOrder = (undefined || 0) + 1). Use the
      // established snake_case-alias convention (see InterviewController.ts:7227,
      // reportBuilderService.ts:1494) which round-trips correctly on both engines.
      const lastMilestone = await queryHelpers.queryOne(
        'SELECT MAX(order_index) as max_order FROM initiative_milestones WHERE initiative_id = ?',
        [initiativeId]
      );
      const nextOrder = ((lastMilestone as any)?.max_order || 0) + 1;

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

  // ==========================================
  // TIMELINE BASELINES (Schedule lock snapshots)
  // ==========================================

  /**
   * Get schedule baselines for an initiative
   */
  static getScheduleBaselines = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.queryOne(
        `SELECT id, baseline_version as "baselineVersion", schedule_baseline_id as "scheduleBaselineId"
         FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const baselines = await queryHelpers.queryAll(
        `SELECT
          id,
          version,
          status_at_baseline as "statusAtBaseline",
          planned_start_date as "plannedStartDate",
          planned_end_date as "plannedEndDate",
          created_by as "createdBy",
          created_at as "createdAt"
        FROM initiative_schedule_baselines
        WHERE initiative_id = ? AND organization_id = ?
        ORDER BY version DESC`,
        [initiativeId, orgId]
      );

      res.json({
        baselines,
        currentBaselineVersion: Number((initiative as any)?.baselineVersion || 0) || 0,
        scheduleBaselineId: (initiative as any)?.scheduleBaselineId ?? null,
      });
    }
  );

  /**
   * Get a single schedule baseline (by version)
   */
  static getScheduleBaseline = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, version } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const v = Number.parseInt(String(version || ''), 10);
      if (!Number.isFinite(v) || v <= 0) {
        res.status(400).json({ error: 'Invalid baseline version' });
        return;
      }

      const baseline = await queryHelpers.queryOne(
        `SELECT
          id,
          version,
          status_at_baseline as "statusAtBaseline",
          planned_start_date as "plannedStartDate",
          planned_end_date as "plannedEndDate",
          snapshot,
          created_by as "createdBy",
          created_at as "createdAt"
        FROM initiative_schedule_baselines
        WHERE initiative_id = ? AND organization_id = ? AND version = ?
        LIMIT 1`,
        [initiativeId, orgId, v]
      );
      if (!baseline) {
        res.status(404).json({ error: 'Baseline not found' });
        return;
      }

      const current = await queryHelpers.queryOne(
        `SELECT planned_start_date as "plannedStartDate", planned_end_date as "plannedEndDate"
         FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );

      const toDayDiff = (from: any, to: any): number | null => {
        if (!from || !to) return null;
        const a = new Date(String(from));
        const b = new Date(String(to));
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
        return Math.round((b.getTime() - a.getTime()) / 86400000);
      };

      const snapshotRaw = (baseline as any).snapshot;
      const snapshot =
        typeof snapshotRaw === 'string' ? safeJsonParseObject(snapshotRaw, {}) : snapshotRaw || {};

      res.json({
        baseline: {
          ...baseline,
          snapshot,
        },
        variance: {
          startDays: toDayDiff(
            (baseline as any).plannedStartDate,
            (current as any)?.plannedStartDate
          ),
          endDays: toDayDiff((baseline as any).plannedEndDate, (current as any)?.plannedEndDate),
        },
      });
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
          r.initiative_id as "initiativeId",
          r.user_id as "userId",
          r.name,
          r.role,
          r.allocation_percentage as "allocationPercentage",
          r.start_date as "startDate",
          r.end_date as "endDate",
          r.notes,
          r.source,
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.avatar_url as "avatarUrl"
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
      const { userId, name, role, allocationPercentage, startDate, endDate, notes, source } =
        req.body;

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
          id,
          initiative_id,
          organization_id,
          user_id,
          name,
          role,
          allocation_percentage,
          start_date,
          end_date,
          notes,
          created_at,
          source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          resourceId,
          initiativeId,
          orgId,
          userId || null,
          name || null,
          role,
          allocationPercentage || 100,
          startDate || null,
          endDate || null,
          notes || null,
          now,
          source || 'manual',
        ]
      );

      try {
        await syncInitiativeCapacity(initiativeId, orgId);
      } catch {
        /* best-effort */
      }

      res.status(201).json({
        success: true,
        resource: {
          id: resourceId,
          initiativeId,
          userId,
          name,
          role,
          allocationPercentage: allocationPercentage || 100,
          startDate,
          endDate,
          notes,
          source: source || 'manual',
        },
      });
    }
  );

  /**
   * Delete resource from an initiative
   */
  static deleteResource = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, resourceId } = req.params as any;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM initiative_resources WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [resourceId, initiativeId, orgId]
      );

      try {
        await syncInitiativeCapacity(initiativeId, orgId);
      } catch {
        /* best-effort */
      }

      res.json({ success: true });
    }
  );

  /**
   * Update resource in an initiative
   */
  static updateResource = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, resourceId } = req.params as any;
      const { name, role, allocationPercentage, startDate, endDate, notes } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE initiative_resources SET
          name = COALESCE(?, name),
          role = COALESCE(?, role),
          allocation_percentage = COALESCE(?, allocation_percentage),
          start_date = COALESCE(?, start_date),
          end_date = COALESCE(?, end_date),
          notes = COALESCE(?, notes),
          updated_at = ?
        WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [
          name,
          role,
          allocationPercentage,
          startDate,
          endDate,
          notes,
          now,
          resourceId,
          initiativeId,
          orgId,
        ]
      );

      try {
        await syncInitiativeCapacity(initiativeId, orgId);
      } catch {
        /* best-effort */
      }

      res.json({ success: true });
    }
  );

  // ==========================================
  // BUDGET ITEMS CRUD
  // ==========================================

  /**
   * Get all budget items for an initiative
   */
  static getBudgetItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const items = await queryHelpers.queryAll(
        `SELECT
          id,
          initiative_id as "initiativeId",
          category,
          cost_type as "costType",
          amount,
          currency,
          description,
          source,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM initiative_budget_items
        WHERE initiative_id = ? AND organization_id = ?
        ORDER BY created_at ASC`,
        [initiativeId, orgId]
      );

      res.json({ budgetItems: items });
    }
  );

  /**
   * Add budget item to an initiative
   */
  static addBudgetItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      const { category, costType, amount, currency, description, source } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const itemId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO initiative_budget_items (
          id, initiative_id, organization_id, category, cost_type, amount, currency, description, created_at, updated_at, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          initiativeId,
          orgId,
          category || 'other',
          costType || 'OPEX',
          amount || 0,
          currency || 'PLN',
          description || null,
          now,
          now,
          source || 'manual',
        ]
      );

      res.status(201).json({
        success: true,
        budgetItem: {
          id: itemId,
          initiativeId,
          category: category || 'other',
          costType: costType || 'OPEX',
          amount: amount || 0,
          currency: currency || 'PLN',
          description,
          source: source || 'manual',
        },
      });
    }
  );

  /**
   * Update budget item
   */
  static updateBudgetItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, itemId } = req.params as any;
      const { category, costType, amount, currency, description } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE initiative_budget_items SET
          category = COALESCE(?, category),
          cost_type = COALESCE(?, cost_type),
          amount = COALESCE(?, amount),
          currency = COALESCE(?, currency),
          description = COALESCE(?, description),
          updated_at = ?
        WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [category, costType, amount, currency, description, now, itemId, initiativeId, orgId]
      );

      res.json({ success: true });
    }
  );

  /**
   * Delete budget item
   */
  static deleteBudgetItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, itemId } = req.params as any;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM initiative_budget_items WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [itemId, initiativeId, orgId]
      );

      res.json({ success: true });
    }
  );

  // ==========================================
  // TOOLS CRUD
  // ==========================================

  /**
   * Get all tools for an initiative
   */
  static getTools = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const items = await queryHelpers.queryAll(
        `SELECT
          id,
          initiative_id as "initiativeId",
          name,
          category,
          vendor,
          license_cost as "licenseCost",
          license_type as "licenseType",
          status,
          notes,
          source,
          cost_type as "costType",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM initiative_tools
        WHERE initiative_id = ? AND organization_id = ?
        ORDER BY created_at ASC`,
        [initiativeId, orgId]
      );

      res.json({ tools: items });
    }
  );

  /**
   * Add tool to an initiative
   */
  static addTool = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orgId = req.user?.organizationId;
    const { id: initiativeId } = req.params;
    const { name, category, vendor, licenseCost, licenseType, status, notes, source, costType } =
      req.body;

    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const toolId = uuidv4();
    const now = new Date().toISOString();

    await queryHelpers.queryRun(
      `INSERT INTO initiative_tools (
          id, initiative_id, organization_id, name, category, vendor, license_cost, license_type, status, notes, created_at, updated_at, source, cost_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        toolId,
        initiativeId,
        orgId,
        name,
        category || 'software',
        vendor || null,
        licenseCost || 0,
        licenseType || 'subscription',
        status || 'planned',
        notes || null,
        now,
        now,
        source || 'manual',
        costType || 'OPEX',
      ]
    );

    res.status(201).json({
      success: true,
      tool: {
        id: toolId,
        initiativeId,
        name,
        category: category || 'software',
        vendor,
        licenseCost: licenseCost || 0,
        licenseType: licenseType || 'subscription',
        status: status || 'planned',
        notes,
        source: source || 'manual',
        costType: costType || 'OPEX',
      },
    });
  });

  /**
   * Update tool
   */
  static updateTool = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, toolId } = req.params as any;
      const { name, category, vendor, licenseCost, licenseType, status, notes, costType } =
        req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE initiative_tools SET
          name = COALESCE(?, name),
          category = COALESCE(?, category),
          vendor = COALESCE(?, vendor),
          license_cost = COALESCE(?, license_cost),
          license_type = COALESCE(?, license_type),
          status = COALESCE(?, status),
          notes = COALESCE(?, notes),
          cost_type = COALESCE(?, cost_type),
          updated_at = ?
        WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [
          name,
          category,
          vendor,
          licenseCost,
          licenseType,
          status,
          notes,
          costType,
          now,
          toolId,
          initiativeId,
          orgId,
        ]
      );

      res.json({ success: true });
    }
  );

  /**
   * Delete tool
   */
  static deleteTool = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, toolId } = req.params as any;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM initiative_tools WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [toolId, initiativeId, orgId]
      );

      res.json({ success: true });
    }
  );

  // ==========================================
  // INTANGIBLE ASSETS CRUD (Licenses, Training, Knowledge, IP)
  // ==========================================

  /**
   * Get all intangible assets for an initiative
   */
  static getIntangibleAssets = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const items = await queryHelpers.queryAll(
        `SELECT
          id,
          initiative_id as "initiativeId",
          asset_type as "assetType",
          name,
          provider,
          cost,
          currency,
          valid_from as "validFrom",
          valid_until as "validUntil",
          status,
          beneficiaries,
          notes,
          source,
          cost_type as "costType",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM initiative_intangible_assets
        WHERE initiative_id = ? AND organization_id = ?
        ORDER BY created_at ASC`,
        [initiativeId, orgId]
      );

      res.json({ intangibleAssets: items });
    }
  );

  /**
   * Add intangible asset to an initiative
   */
  static addIntangibleAsset = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      const {
        assetType,
        name,
        provider,
        cost,
        currency,
        validFrom,
        validUntil,
        status,
        beneficiaries,
        notes,
        source,
        costType,
      } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!name) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }

      const itemId = uuidv4();
      const now = new Date().toISOString();

      await queryHelpers.queryRun(
        `INSERT INTO initiative_intangible_assets (
          id, initiative_id, organization_id, asset_type, name, provider, cost, currency,
          valid_from, valid_until, status, beneficiaries, notes, created_at, updated_at, source, cost_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          itemId,
          initiativeId,
          orgId,
          assetType || 'license',
          name,
          provider || null,
          cost || 0,
          currency || 'PLN',
          validFrom || null,
          validUntil || null,
          status || 'planned',
          beneficiaries || null,
          notes || null,
          now,
          now,
          source || 'manual',
          costType || 'OPEX',
        ]
      );

      res.status(201).json({
        success: true,
        intangibleAsset: {
          id: itemId,
          initiativeId,
          assetType: assetType || 'license',
          name,
          provider,
          cost: cost || 0,
          currency: currency || 'PLN',
          validFrom,
          validUntil,
          status: status || 'planned',
          beneficiaries,
          notes,
          source: source || 'manual',
          costType: costType || 'OPEX',
        },
      });
    }
  );

  /**
   * Update intangible asset
   */
  static updateIntangibleAsset = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, assetId } = req.params as any;
      const {
        assetType,
        name,
        provider,
        cost,
        currency,
        validFrom,
        validUntil,
        status,
        beneficiaries,
        notes,
        costType,
      } = req.body;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const now = new Date().toISOString();
      await queryHelpers.queryRun(
        `UPDATE initiative_intangible_assets SET
          asset_type = COALESCE(?, asset_type),
          name = COALESCE(?, name),
          provider = COALESCE(?, provider),
          cost = COALESCE(?, cost),
          currency = COALESCE(?, currency),
          valid_from = COALESCE(?, valid_from),
          valid_until = COALESCE(?, valid_until),
          status = COALESCE(?, status),
          beneficiaries = COALESCE(?, beneficiaries),
          notes = COALESCE(?, notes),
          cost_type = COALESCE(?, cost_type),
          updated_at = ?
        WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [
          assetType,
          name,
          provider,
          cost,
          currency,
          validFrom,
          validUntil,
          status,
          beneficiaries,
          notes,
          costType,
          now,
          assetId,
          initiativeId,
          orgId,
        ]
      );

      res.json({ success: true });
    }
  );

  /**
   * Delete intangible asset
   */
  static deleteIntangibleAsset = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId, assetId } = req.params as any;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM initiative_intangible_assets WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [assetId, initiativeId, orgId]
      );

      res.json({ success: true });
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
          s.initiative_id as "initiativeId",
          s.user_id as "userId",
          s.external_name as "externalName",
          s.external_email as "externalEmail",
          s.role,
          s.raci_type as "raciType",
          s.influence_level as "influenceLevel",
          s.interest_level as "interestLevel",
          s.created_at as "createdAt",
          u.first_name as "firstName",
          u.last_name as "lastName",
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
      const { userId, raciType, role, externalName, externalEmail, influenceLevel, interestLevel } =
        req.body || {};

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

      const rawRole = String(role || '').trim();
      const rawRaci = String(raciType || '').trim();

      // UI commonly sends RACI roles (accountable/responsible/consulted/informed)
      // while DB enforces a business-role enum in `role`.
      // We persist RACI in `raci_type` (A/R/C/I) and map to a safe DB role.
      const DB_ROLES = new Set(['SPONSOR', 'OWNER', 'CONTRIBUTOR', 'REVIEWER', 'INFORMED']);
      const toDbRoleFromRaci = (r: string): string => {
        const up = r.toUpperCase();
        if (up === 'A') return 'OWNER';
        if (up === 'R') return 'CONTRIBUTOR';
        if (up === 'C') return 'REVIEWER';
        if (up === 'I') return 'INFORMED';
        return 'CONTRIBUTOR';
      };
      const toRaciFromUiRole = (r: string): string | null => {
        const low = r.toLowerCase();
        if (low === 'accountable') return 'A';
        if (low === 'responsible') return 'R';
        if (low === 'consulted') return 'C';
        if (low === 'informed') return 'I';
        return null;
      };

      let resolvedRaci: string | null = rawRaci ? rawRaci.toUpperCase() : null;
      let resolvedDbRole: string | null = rawRole ? rawRole.toUpperCase() : null;

      // If role looks like UI RACI role string, map it.
      const raciFromUi = rawRole ? toRaciFromUiRole(rawRole) : null;
      if (raciFromUi) {
        resolvedRaci = raciFromUi;
        resolvedDbRole = toDbRoleFromRaci(raciFromUi);
      }

      // If role looks like a RACI letter, map it.
      if (rawRole && ['A', 'R', 'C', 'I'].includes(rawRole.toUpperCase())) {
        resolvedRaci = rawRole.toUpperCase();
        resolvedDbRole = toDbRoleFromRaci(resolvedRaci);
      }

      // If DB role is provided, keep it (and keep any provided RACI).
      if (resolvedDbRole && !DB_ROLES.has(resolvedDbRole)) {
        // As a fallback, default to CONTRIBUTOR (DB-safe)
        resolvedDbRole = 'CONTRIBUTOR';
      }

      // If raci_type not provided but DB role is "INFORMED", default RACI to I.
      if (!resolvedRaci && resolvedDbRole === 'INFORMED') {
        resolvedRaci = 'I';
      }

      // DB requires influence_level + interest_level NOT NULL (1..5). Default to 3.
      const inf = Number.isFinite(Number(influenceLevel)) ? Number(influenceLevel) : 3;
      const intr = Number.isFinite(Number(interestLevel)) ? Number(interestLevel) : 3;

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_stakeholders (
          id,
          initiative_id,
          user_id,
          external_name,
          external_email,
          role,
          raci_type,
          influence_level,
          interest_level,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          initiativeId,
          userId || null,
          userId ? null : externalName,
          userId ? null : externalEmail || null,
          resolvedDbRole || 'CONTRIBUTOR',
          resolvedRaci || null,
          inf,
          intr,
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
          w.initiative_id as "initiativeId",
          w.user_id as "userId",
          w.created_at as "createdAt",
          u.first_name as "firstName",
          u.last_name as "lastName",
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
        `SELECT w.id, w.user_id as "userId" FROM initiative_watchers w
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
          r.initiative_id as "initiativeId",
          LOWER(r.type) as type,
          r.title,
          r.description,
          r.status,
          r.impact as severity,
          r.probability,
          r.risk_score as "riskScore",
          r.score_category as "scoreCategory",
          r.owner_id as "ownerId",
          r.due_date as "dueDate",
          r.mitigation_plan,
          r.response_strategy,
          r.mitigation_owner_id,
          r.mitigation_due_date,
          r.mitigation_status,
          r.created_at as "createdAt",
          r.updated_at as "updatedAt"
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
      const { type, title, description, severity, probability, dueDate, ownerId } = req.body || {};
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!type || !title) {
        res.status(400).json({ error: 'type and title are required' });
        return;
      }

      const id = uuidv4();
      const impactVal = severity ? String(severity).toUpperCase() : null;
      const probVal = probability ? String(probability).toUpperCase() : null;
      const riskScore = calculateRiskScore(probVal || 'LOW', impactVal || 'LOW');
      const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);
      await queryHelpers.queryRun(
        `INSERT INTO raid_items (
          id, organization_id, initiative_id, type, title, description, impact, probability, risk_score, score_category, due_date, owner_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          orgId,
          initiativeId,
          String(type).toUpperCase(),
          title,
          description || null,
          impactVal,
          probVal,
          riskScore,
          scoreCategory,
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
      const { title, description, status, severity, probability, dueDate, ownerId } =
        req.body || {};
      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const existing = await queryHelpers.queryOne<any>(
        `SELECT id, title, description, status, impact, probability, due_date, owner_id
         FROM raid_items
         WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [raidId, orgId, initiativeId]
      );
      if (!existing) {
        res.status(404).json({ error: 'RAID item not found' });
        return;
      }

      const finalImpact = severity ? String(severity).toUpperCase() : existing.impact || 'LOW';
      const finalProb = probability
        ? String(probability).toUpperCase()
        : existing.probability || 'LOW';
      const riskScore = calculateRiskScore(finalProb, finalImpact);
      const scoreCategory = categorizeScore(riskScore, DEFAULT_THRESHOLDS);

      await queryHelpers.queryRun(
        `UPDATE raid_items
         SET title = COALESCE(?, title),
             description = COALESCE(?, description),
             status = COALESCE(?, status),
             impact = COALESCE(?, impact),
             probability = COALESCE(?, probability),
             risk_score = ?,
             score_category = ?,
             due_date = COALESCE(?, due_date),
             owner_id = COALESCE(?, owner_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND organization_id = ? AND initiative_id = ?`,
        [
          title ?? null,
          description ?? null,
          status ?? null,
          severity ? String(severity).toUpperCase() : null,
          probability ? String(probability).toUpperCase() : null,
          riskScore,
          scoreCategory,
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
          h.initiative_id as "initiativeId",
          h.action as "eventType",
          h.changed_by as "actorId",
          h.changed_at as "createdAt",
          h.old_value as "oldValue",
          h.new_value as "newValue",
          h.notes
        FROM initiative_history h
        LEFT JOIN initiatives i ON i.id = h.initiative_id
        WHERE h.initiative_id = ? AND (i.organization_id = ? OR i.id IS NULL)
        ORDER BY h.changed_at DESC
        LIMIT 200`,
        [initiativeId, orgId]
      );

      res.json({ events: rows });
    }
  );

  // ============================================================
  // GATE ROLES MANAGEMENT
  // ============================================================

  /**
   * GET /initiatives/:id/gate-roles
   * Returns all gate role assignments for an initiative.
   * Also auto-derives roles from initiative fields (owner → INITIATIVE_OWNER, sponsor → SPONSOR).
   */
  static getGateRoles = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.queryOne(
        `SELECT owner_business_id, owner_execution_id, sponsor_id
         FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // Explicit gate role assignments from table
      let explicitRoles: any[] = [];
      try {
        explicitRoles = await queryHelpers.queryAll(
          `SELECT
            gr.id,
            gr.initiative_id as "initiativeId",
            gr.gate_role as "gateRole",
            gr.user_id as "userId",
            gr.assigned_by as "assignedBy",
            gr.assigned_at as "assignedAt",
            u.first_name as "firstName",
            u.last_name as "lastName",
            u.email
          FROM initiative_gate_roles gr
          LEFT JOIN users u ON u.id = gr.user_id
          WHERE gr.initiative_id = ?
          ORDER BY gr.gate_role, gr.assigned_at`,
          [initiativeId]
        );
      } catch {
        // Table may not exist yet
      }

      // Auto-derived roles from initiative fields
      const derived: any[] = [];
      const ini = initiative as any;
      if (ini.owner_business_id) {
        derived.push({
          gateRole: 'INITIATIVE_OWNER',
          userId: ini.owner_business_id,
          source: 'auto',
        });
        derived.push({ gateRole: 'BUSINESS_OWNER', userId: ini.owner_business_id, source: 'auto' });
      }
      if (ini.owner_execution_id) {
        derived.push({
          gateRole: 'INITIATIVE_OWNER',
          userId: ini.owner_execution_id,
          source: 'auto',
        });
      }
      if (ini.sponsor_id) {
        derived.push({ gateRole: 'PROJECT_SPONSOR', userId: ini.sponsor_id, source: 'auto' });
      }

      // Merge: explicit roles take priority, add derived ones that don't overlap
      const explicitKeys = new Set(explicitRoles.map((r: any) => `${r.gateRole}::${r.userId}`));
      const mergedDerived = derived
        .filter((d) => !explicitKeys.has(`${d.gateRole}::${d.userId}`))
        .map((d) => ({ ...d, id: `derived-${d.gateRole}-${d.userId}` }));

      res.json({
        roles: [...explicitRoles.map((r: any) => ({ ...r, source: 'explicit' })), ...mergedDerived],
      });
    }
  );

  /**
   * PUT /initiatives/:id/gate-roles
   * Bulk upsert gate role assignments.
   * Body: { roles: [{ gateRole: string, userId: string }] }
   */
  static updateGateRoles = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const actorId = req.user?.id;
      const { id: initiativeId } = req.params;
      const { roles } = req.body || {};

      if (!orgId || !actorId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.queryOne(
        `SELECT id FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      if (!Array.isArray(roles)) {
        res.status(400).json({ error: 'roles must be an array of { gateRole, userId }' });
        return;
      }

      // Delete all explicit roles and re-insert
      try {
        await queryHelpers.queryRun(`DELETE FROM initiative_gate_roles WHERE initiative_id = ?`, [
          initiativeId,
        ]);
      } catch {
        // Table may not exist — will be created by migration
      }

      const inserted: any[] = [];
      for (const role of roles) {
        if (!role.gateRole || !role.userId) continue;
        const id = uuidv4();
        try {
          await queryHelpers.queryRun(
            `INSERT INTO initiative_gate_roles (id, initiative_id, gate_role, user_id, assigned_by)
             VALUES (?, ?, ?, ?, ?)`,
            [id, initiativeId, role.gateRole, role.userId, actorId]
          );
          inserted.push({ id, gateRole: role.gateRole, userId: role.userId });
        } catch {
          // Skip duplicates / errors
        }
      }

      // Audit
      try {
        await queryHelpers.queryRun(
          `INSERT INTO initiative_history (id, initiative_id, action, new_value, changed_by)
           VALUES (?, ?, ?, ?, ?)`,
          [uuidv4(), initiativeId, 'gate_roles_updated', JSON.stringify(inserted), actorId]
        );
      } catch {
        // best-effort
      }

      res.json({ success: true, roles: inserted });
    }
  );

  /**
   * Linked items (M13 Depth · Seria K · K3) — durable artifact correlation.
   * GET/POST /initiatives/:id/linked-items · DELETE /:id/linked-items/:linkId
   */
  static getLinkedItems = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const items = await listLinkedItems(orgId, req.params.id);
      res.json({ items });
    }
  );

  static addLinkedItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { targetType, targetId, label } = (req.body as any) || {};
      const item = await addLinkedItem(orgId, req.params.id, {
        targetType: String(targetType || ''),
        targetId: String(targetId || ''),
        label: label != null ? String(label) : null,
        createdBy: req.user?.id,
      });
      if (!item) {
        res.status(400).json({ error: 'Could not add link', code: 'LINKED_ITEM_INVALID' });
        return;
      }
      res.json({ item });
    }
  );

  static removeLinkedItem = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      await removeLinkedItem(orgId, req.params.id, req.params.linkId);
      res.json({ success: true });
    }
  );

  /**
   * POST /initiatives/validate-card  (M13 Depth · Seria K · K1)
   * Deterministic §B3 card-quality validators (advisory, never blocks).
   */
  static validateCard = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { text, rules } = (req.body as any) || {};
      const issues = validateCardContent(
        String(text || ''),
        Array.isArray(rules) ? rules : undefined
      );
      res.json({ issues });
    }
  );

  /**
   * POST /initiatives/similar-check  (M13 Depth · Seria C · C1)
   * Portfolio-aware duplicate detection: given a candidate {name, summary},
   * return existing org initiatives that look similar (advisory, never blocks).
   */
  static checkSimilarInitiatives = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { name, summary, excludeId } = (req.body as any) || {};
      const similar = await findSimilarInitiatives(
        orgId,
        { name: name ? String(name) : '', summary: summary ? String(summary) : '' },
        { excludeId: excludeId ? String(excludeId) : undefined }
      );
      res.json({ similar });
    }
  );

  /**
   * POST /initiatives/:id/gate-ai-check  (M13 Depth · Fala 1)
   * Lazy AI readiness for a specific gate (substantive rollup + timeline).
   * `enabled:false` when the per-org flag is OFF, the gate is non-AI, or AI
   * failed open — the caller must NOT soft-block in that case.
   */
  static getGateAiCheck = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { id } = req.params;
      const gateRaw = String((req.body as any)?.gate || '')
        .trim()
        .toUpperCase();
      const targetStatusRaw = String((req.body as any)?.targetStatus || '')
        .trim()
        .toUpperCase();

      // Org-scoped existence (cross-org id → indistinguishable 404).
      const existing = await queryHelpers.queryOne(
        `SELECT id, status FROM initiatives WHERE id = ? AND organization_id = ?`,
        [id, orgId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      // Prefer an explicit `gate`; otherwise derive it from `targetStatus` using
      // the current status (so the FE can pass the transition it's attempting).
      let gate: string | null = (Object.values(GateType) as string[]).includes(gateRaw)
        ? gateRaw
        : null;
      if (!gate && targetStatusRaw) {
        const current = normalizeInitiativeDbStatusForRead((existing as any).status);
        gate = getGateForTransition(current as any, targetStatusRaw as any) || null;
      }
      if (!gate) {
        res.status(400).json({ error: 'Unknown gate', code: 'GATE_AI_UNKNOWN_GATE' });
        return;
      }

      const enabled = (await isInitiativeGateAiEnabled(orgId)) && isAiGate(gate as any);
      if (!enabled) {
        res.json({ enabled: false, gate, aiReadiness: null, timeline: null });
        return;
      }
      const [aiReadiness, timeline] = await Promise.all([
        getGateReadiness(id, gate as any, orgId),
        getTimelineFlags(id, gate as any, orgId),
      ]);
      res.json({ enabled: true, gate, aiReadiness, timeline });
    }
  );

  /**
   * GET /initiatives/:id/gate-readiness-check
   * Comprehensive gate readiness check for the current status.
   * Returns: which gates are available, who can approve, what's blocking.
   */
  static getGateReadinessCheck = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const currentUserId = req.user?.id;
      const { id: initiativeId } = req.params;

      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = await queryHelpers.queryOne(
        `SELECT * FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      );
      if (!initiative) {
        res.status(404).json({ error: 'Initiative not found' });
        return;
      }

      const ini = initiative as any;
      const currentStatus = String(ini.status || 'DRAFT').toUpperCase();

      // Canonical role resolution (system role + project membership + gate roles + steering board)
      const accessCtx =
        orgId && currentUserId
          ? await resolveInitiativeAccessContext(orgId, initiativeId, currentUserId, req.user?.role)
          : null;
      const steeringBoardEnabled = !!accessCtx?.steeringBoard?.enabled;
      const userRoles = accessCtx?.effectiveRoles || [];

      // Expanded assignments include initiative gate roles + derived + project roles + steering board members
      const expandedAssignments: Array<{ gateRole: string; userId: string }> = [
        ...(accessCtx?.roleAssignments || []),
      ];

      const projectId = accessCtx?.projectId ? String(accessCtx.projectId) : null;
      const mapProjectRoleToInitiativeGateRoles = (projectRole: string): string[] => {
        const r = String(projectRole || '')
          .trim()
          .toUpperCase();
        if (!r) return [];
        if (['PROJECT_SPONSOR', 'SPONSOR'].includes(r)) return ['PROJECT_SPONSOR'];
        if (
          [
            'PROJECT_LEADER',
            'PROJECT_LEAD',
            'PROJECT_MANAGER',
            'PMO_LEAD',
            'MANAGER',
            'TEAM_LEAD',
            'WORKSTREAM_OWNER',
          ].includes(r)
        ) {
          return ['PROJECT_MANAGER', 'PROJECT_LEAD'];
        }
        if (r === 'PMO') return ['PMO'];
        if (r === 'PORTFOLIO_OWNER') return ['PORTFOLIO_OWNER'];
        if (r === 'BUSINESS_OWNER') return ['BUSINESS_OWNER'];
        if (r === 'STEERING_COMMITTEE') return ['STEERING_COMMITTEE'];
        if (r === 'INITIATIVE_OWNER') return ['INITIATIVE_OWNER'];
        if (r === 'TEAM_MEMBER') return ['TEAM_MEMBER'];
        return [];
      };

      if (projectId) {
        try {
          const members = await queryHelpers.queryAll(
            `SELECT user_id as "userId", project_role as "projectRole"
             FROM project_members WHERE project_id = ?`,
            [projectId]
          );
          members.forEach((m: any) => {
            const userId = String(m?.userId || '');
            const projectRole = String(m?.projectRole || '');
            if (!userId || !projectRole) return;
            mapProjectRoleToInitiativeGateRoles(projectRole).forEach((gateRole) => {
              expandedAssignments.push({ gateRole, userId });
            });
          });
        } catch {
          // best-effort
        }

        if (steeringBoardEnabled) {
          try {
            const boardMembers = await queryHelpers.queryAll(
              `SELECT user_id as "userId"
               FROM project_steering_board_members
               WHERE project_id = ? AND UPPER(member_type) IN ('CHAIR','BOARD_MEMBER')`,
              [projectId]
            );
            boardMembers.forEach((m: any) => {
              const userId = String(m?.userId || '');
              if (userId) expandedAssignments.push({ gateRole: 'STEERING_COMMITTEE', userId });
            });
          } catch {
            // best-effort
          }
        }
      }

      // Get valid next transitions and check which ones the user can execute
      const validNext = VALID_TRANSITIONS[currentStatus as keyof typeof VALID_TRANSITIONS] || [];
      const availableTransitions: any[] = [];

      for (const nextStatus of validNext) {
        const gate = getGateForTransition(currentStatus as any, nextStatus as any);
        const requiredRoles = gate ? GATE_PERMISSIONS[gate] || [] : [];
        const effectiveRequiredRoles = steeringBoardEnabled
          ? requiredRoles
          : requiredRoles.flatMap((r: string) => {
              if (r === 'STEERING_COMMITTEE') return ['PROJECT_SPONSOR', 'PORTFOLIO_OWNER'];
              return [r];
            });
        const canExecute =
          userRoles.includes('ADMIN') ||
          (gate ? effectiveRequiredRoles.some((r: string) => userRoles.includes(r)) : true);

        // Get assigned users for the required roles
        const assignedApprovers = effectiveRequiredRoles.flatMap((role: string) =>
          expandedAssignments.filter((gr: any) => String(gr.gateRole).toUpperCase() === role)
        );

        availableTransitions.push({
          targetStatus: nextStatus,
          gate: gate || null,
          requiredRoles: effectiveRequiredRoles,
          assignedApprovers,
          canCurrentUserExecute: canExecute,
          hasAssignedApprover: assignedApprovers.length > 0,
        });
      }

      // Readiness criteria for current stage
      const readiness: any[] = [];
      const addCheck = (
        key: string,
        label: string,
        pass: boolean,
        severity: string,
        suggestedAction?: string,
        suggestedActor?: string
      ) => {
        readiness.push({ key, label, pass, severity, suggestedAction, suggestedActor });
      };

      addCheck(
        'title',
        'Title defined',
        !!ini.name,
        'blocking',
        'Add a concise initiative title that clearly describes the change.',
        'Initiative Owner'
      );
      addCheck(
        'owner',
        'Owner assigned',
        !!(ini.owner_business_id || ini.owner_execution_id),
        'blocking',
        'Assign a business or execution owner who will be accountable.',
        'PMO / Project Manager'
      );

      if (['PENDING_REVIEW', 'REVIEW', 'PROMOTED', 'PLANNING'].includes(currentStatus)) {
        addCheck(
          'summary',
          'Summary / problem statement',
          !!(ini.summary || ini.problem_statement),
          'warning',
          'Write a 2-3 sentence summary explaining the business problem this initiative addresses.',
          'Initiative Owner'
        );
      }
      if (['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(currentStatus)) {
        addCheck(
          'sponsor',
          'Sponsor assigned',
          !!ini.sponsor_id,
          'warning',
          'Nominate a senior leader who will champion and fund this initiative.',
          'PMO / Portfolio Owner'
        );
      }
      if (currentStatus === 'APPROVED') {
        const start = ini.planned_start_date || ini.start_date || null;
        const end = ini.planned_end_date || ini.end_date || null;
        addCheck(
          'timeline_dates',
          'Planned dates set (start + end)',
          !!(start && end),
          'blocking',
          'Set planned start and end dates before scheduling (baseline lock).',
          'Project Manager'
        );

        // Milestones required to baseline schedule
        try {
          const m = await queryHelpers.queryOne(
            `SELECT COUNT(*) as c
             FROM initiative_milestones
             WHERE initiative_id = ? AND organization_id = ?`,
            [initiativeId, orgId]
          );
          const c = Number((m as any)?.c || 0);
          addCheck(
            'schedule_milestones',
            'Milestones defined',
            c > 0,
            'blocking',
            'Add at least one milestone to lock the schedule baseline.',
            'Initiative Owner / Project Manager'
          );
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          const missing =
            msg.includes('no such table') ||
            msg.includes('does not exist') ||
            msg.includes('relation');
          addCheck(
            'schedule_milestones',
            missing ? 'Milestones schema available' : 'Milestones defined',
            false,
            'blocking',
            missing
              ? 'Milestones table is missing. Run migrations (initiative_milestones).'
              : 'Add at least one milestone to lock the schedule baseline.',
            'PMO / Platform Admin'
          );
        }
      }
      if (isScheduledOnward(currentStatus)) {
        const start = ini.planned_start_date || ini.start_date || null;
        const end = ini.planned_end_date || ini.end_date || null;
        addCheck(
          'timeline',
          'Timeline set',
          !!(start && end),
          'blocking',
          'Set planned start and end dates for baseline scheduling.',
          'Project Manager'
        );
        // Baseline version is expected after scheduling; keep as warning to avoid breaking legacy rows.
        addCheck(
          'baseline',
          'Schedule baseline locked',
          Number(ini.baseline_version || 0) > 0,
          'warning',
          'Create a schedule baseline snapshot (re-schedule) to enable variance tracking.',
          'PMO / Project Manager'
        );
      }

      if (['PLANNING', 'APPROVED'].includes(currentStatus)) {
        addCheck(
          'scope',
          'Scope defined',
          !!(ini.scope || ini.objectives),
          'warning',
          'Define the scope or objectives so reviewers understand boundaries.',
          'Initiative Owner'
        );

        try {
          const riskCount = await queryHelpers.queryOne(
            `SELECT COUNT(*) as c FROM initiative_raids WHERE initiative_id = ? AND type = 'RISK'`,
            [initiativeId]
          );
          addCheck(
            'risks',
            'Risks identified',
            Number((riskCount as any)?.c || 0) > 0,
            'warning',
            'Identify at least one risk and its mitigation strategy.',
            'Initiative Owner / Risk Manager'
          );
        } catch {
          // best-effort
        }

        try {
          const taskCount = await queryHelpers.queryOne(
            `SELECT COUNT(*) as c FROM tasks WHERE initiative_id = ?`,
            [initiativeId]
          );
          addCheck(
            'tasks',
            'Tasks created',
            Number((taskCount as any)?.c || 0) > 0,
            'warning',
            'Break down the initiative into executable tasks.',
            'Project Manager / Initiative Owner'
          );
        } catch {
          // best-effort
        }
      }

      if (currentStatus === 'DONE') {
        addCheck(
          'benefits_owner',
          'Business Owner assigned (benefits owner)',
          !!ini.owner_business_id,
          'blocking',
          'Assign the business owner who will track realized benefits.',
          'PMO / Sponsor'
        );
        try {
          const kpiCount = await queryHelpers.queryOne(
            `SELECT COUNT(*) as c FROM initiative_kpis WHERE initiative_id = ?`,
            [initiativeId]
          );
          const cAll = Number((kpiCount as any)?.c || 0);
          addCheck(
            'benefits_kpis',
            'KPIs defined',
            cAll > 0,
            'blocking',
            'Define measurable KPIs that will prove business value.',
            'Business Owner'
          );

          const readyCount = await queryHelpers.queryOne(
            `SELECT COUNT(*) as c
             FROM initiative_kpis
             WHERE initiative_id = ?
               AND target_value IS NOT NULL
               AND unit IS NOT NULL`,
            [initiativeId]
          );
          const cReady = Number((readyCount as any)?.c || 0);
          addCheck(
            'benefits_kpi_targets',
            'KPI targets + units defined',
            cReady > 0,
            'warning',
            'Set numeric targets and units for each KPI.',
            'Business Owner'
          );
        } catch (e: any) {
          addCheck('benefits_kpis', 'KPIs defined', false, 'blocking');
        }
      }

      // Check if required gate roles are assigned
      const nextGates = availableTransitions.filter((t: any) => t.gate && t.gate !== 'CANCEL');
      for (const transition of nextGates) {
        const missingRoles = (transition.requiredRoles as string[]).filter(
          (role: string) =>
            !expandedAssignments.some((gr: any) => String(gr.gateRole).toUpperCase() === role)
        );
        if (missingRoles.length > 0) {
          addCheck(
            `gate_role_${transition.gate}`,
            `Gate approver assigned for ${transition.gate}: ${missingRoles.join(', ')}`,
            false,
            'warning',
            `Assign users to roles: ${missingRoles.join(', ')} so the gate can be approved.`,
            'PMO / Project Manager'
          );
        }
      }

      // Capabilities contract (v1) — backend is source of truth for UI enablement
      const isTerminal = currentStatus === 'CANCELLED' || currentStatus === 'ARCHIVED';
      const isAdmin = userRoles.some((r: string) =>
        ['ADMIN', 'SUPERADMIN'].includes(String(r || '').toUpperCase())
      );
      const hasEditRole =
        isAdmin ||
        userRoles.some((r: string) =>
          [
            'PMO',
            'PROJECT_MANAGER',
            'PROJECT_LEAD',
            'INITIATIVE_OWNER',
            'PROJECT_SPONSOR',
          ].includes(String(r || '').toUpperCase())
        );

      const topBar = {
        canEditPriority: hasEditRole && !isTerminal,
        canEditOwner: hasEditRole && !isTerminal,
        canEditTargetDate: hasEditRole && !isTerminal,
      };

      const contextCreateActions = (() => {
        if (!hasEditRole || isTerminal) return [];
        if (['PLANNING', 'APPROVED', 'SCHEDULED', 'EXECUTING', 'BLOCKED'].includes(currentStatus)) {
          return ['task', 'decision', 'raid'];
        }
        if (['REVIEW', 'PROMOTED', 'PENDING_REVIEW', 'DRAFT'].includes(currentStatus)) {
          return ['decision', 'raid'];
        }
        return [];
      })();

      const cards = {
        canEditCards:
          topBar.canEditPriority ||
          topBar.canEditOwner ||
          topBar.canEditTargetDate ||
          contextCreateActions.length > 0,
        reasonCode:
          topBar.canEditPriority ||
          topBar.canEditOwner ||
          topBar.canEditTargetDate ||
          contextCreateActions.length > 0
            ? null
            : 'NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE',
      };

      const ai = {
        canUseAi: cards.canEditCards && !isTerminal,
        allowedSectionKeys: cards.canEditCards && !isTerminal ? ['*'] : [],
      };

      const blockingItems = await getBlockingReadinessItems(orgId, initiativeId);

      res.json({
        currentStatus,
        userRoles,
        availableTransitions,
        passed: blockingItems.length === 0,
        missing: blockingItems.map((item) => ({
          section: item.section,
          field: item.field,
          requirement: item.requirement,
          key: item.key,
          label: item.label,
          suggestedAction: item.suggestedAction,
        })),
        capabilities: {
          version: 1,
          source: 'backend',
          topBar,
          cards,
          reasonCodes: {
            topBar: {
              priority: topBar.canEditPriority ? null : 'TOP_BAR_PRIORITY_LOCKED_BY_ROLE_OR_STATUS',
              owner: topBar.canEditOwner ? null : 'TOP_BAR_OWNER_LOCKED_BY_ROLE_OR_STATUS',
              targetDate: topBar.canEditTargetDate
                ? null
                : 'TOP_BAR_TARGET_DATE_LOCKED_BY_ROLE_OR_STATUS',
            },
            cards: { edit: cards.canEditCards ? null : 'NO_EDIT_PERMISSION_FOR_STATUS_OR_ROLE' },
            ai: { use: ai.canUseAi ? null : 'AI_LOCKED_NO_EDIT_CAPABILITY' },
          },
          ctaBar: {
            workflowActions: availableTransitions
              .filter((t: any) => t.canCurrentUserExecute)
              .map((t: any) => ({ targetStatus: t.targetStatus, gate: t.gate || null })),
            contextCreateActions,
            canUseAi: ai.canUseAi,
            aiAllowedSectionKeys: ai.allowedSectionKeys,
          },
        },
        readiness,
        allBlocking: blockingItems.length === 0,
        allWarnings: readiness.filter((r: any) => r.severity === 'warning' && !r.pass).length === 0,
      });
    }
  );

  /**
   * GET /initiatives/:id/status-history
   * Returns gate audit trail from initiative_status_history.
   */
  static getStatusHistory = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const { id: initiativeId } = req.params;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      let rows: any[] = [];
      try {
        // Try full schema (532+) first: gate_type, created_at, organization_id.
        // Fall back to legacy schema (061): changed_at only, filter org via initiatives join.
        try {
          rows = await queryHelpers.queryAll(
            `SELECT
              h.id,
              h.initiative_id as "initiativeId",
              h.from_status as "fromStatus",
              h.to_status as "toStatus",
              h.changed_by as "changedBy",
              h.reason,
              h.gate_type as "gateType",
              h.created_at as "createdAt",
              u.first_name as "changedByFirstName",
              u.last_name as "changedByLastName",
              u.email as "changedByEmail"
            FROM initiative_status_history h
            LEFT JOIN users u ON u.id = h.changed_by
            WHERE h.initiative_id = ? AND h.organization_id = ?
            ORDER BY h.created_at DESC
            LIMIT 100`,
            [initiativeId, orgId]
          );
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          const missingColumn =
            msg.includes('does not exist') ||
            msg.includes('no such column') ||
            msg.includes('gate_type') ||
            msg.includes('created_at') ||
            msg.includes('organization_id');
          if (missingColumn) {
            rows = await queryHelpers.queryAll(
              `SELECT
                h.id,
                h.initiative_id as "initiativeId",
                h.from_status as "fromStatus",
                h.to_status as "toStatus",
                h.changed_by as "changedBy",
                h.reason,
                NULL as "gateType",
                h.changed_at as "createdAt",
                u.first_name as "changedByFirstName",
                u.last_name as "changedByLastName",
                u.email as "changedByEmail"
              FROM initiative_status_history h
              LEFT JOIN users u ON u.id = h.changed_by
              JOIN initiatives i ON i.id = h.initiative_id AND i.organization_id = ?
              WHERE h.initiative_id = ?
              ORDER BY h.changed_at DESC
              LIMIT 100`,
              [orgId, initiativeId]
            );
          } else {
            throw e;
          }
        }
      } catch {
        // Table may not exist
      }

      res.json({ history: rows });
    }
  );

  // ==========================================
  // INITIATIVE COMMENTS
  // ==========================================

  /**
   * GET /api/initiatives/:id/comments
   * Return initiative comments (newest first).
   */
  static getInitiativeComments = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const initiativeId = req.params.id;
      if (!orgId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      try {
        const rows = await queryHelpers.queryAll(
          `
            SELECT
              c.id,
              c.content,
              c.user_id as "authorId",
              c.created_at as "createdAt",
              u.first_name as "firstName",
              u.last_name as "lastName",
              u.email as email
            FROM initiative_comments c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.initiative_id = ? AND c.organization_id = ?
            ORDER BY c.created_at DESC
            LIMIT 200
          `,
          [initiativeId, orgId]
        );

        const comments = rows.map((r: any) => {
          const authorName = `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || 'User';
          return {
            id: r.id,
            content: r.content,
            authorId: r.authorId,
            authorName,
            createdAt: r.createdAt,
            likes: 0,
            likedByMe: false,
          };
        });

        res.json({ comments });
      } catch (e: any) {
        res.status(500).json({ error: 'Failed to load comments' });
      }
    }
  );

  /**
   * POST /api/initiatives/:id/comments
   * Add comment to initiative.
   */
  static addInitiativeComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = req.params.id;
      const { content } = req.body as { content?: string };

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!content || !String(content).trim()) {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const id = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO initiative_comments (id, initiative_id, organization_id, user_id, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [id, initiativeId, orgId, userId, String(content).trim()]
      );

      res.status(201).json({ id });
    }
  );

  /**
   * DELETE /api/initiatives/:id/comments/:commentId
   * Delete comment (best-effort ownership check: allow author or admin).
   */
  static deleteInitiativeComment = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const role = (req.user as any)?.role as string | undefined;
      const initiativeId = req.params.id;
      const commentId = req.params.commentId;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const row = await queryHelpers.queryOne<{ user_id: string }>(
        `SELECT user_id FROM initiative_comments WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [commentId, initiativeId, orgId]
      );

      if (!row) {
        res.json({ success: true });
        return;
      }

      const isOwner = String((row as any).user_id) === String(userId);
      const isAdmin = String(role || '')
        .toUpperCase()
        .includes('ADMIN');
      if (!isOwner && !isAdmin) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      await queryHelpers.queryRun(
        `DELETE FROM initiative_comments WHERE id = ? AND initiative_id = ? AND organization_id = ?`,
        [commentId, initiativeId, orgId]
      );
      res.json({ success: true });
    }
  );

  /**
   * POST /api/initiatives/:id/resources/ai-apply-log
   * Record a single summary audit entry after the user applies AI proposals in Resources.
   */
  static logResourcesAiApply = asyncHandler(
    async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const orgId = req.user?.organizationId;
      const userId = req.user?.id;
      const initiativeId = String(req.params.id || '');
      const { scope, budgetAdded, fteAdded, toolsAdded, intangiblesAdded, note } = req.body as any;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const initiative = (await queryHelpers.queryOne(
        `SELECT id, organization_id, project_id, COALESCE(title, name) as title
         FROM initiatives WHERE id = ? AND organization_id = ?`,
        [initiativeId, orgId]
      )) as any;

      // Activity log (human audit trail)
      try {
        await activityService.log({
          organizationId: String(orgId),
          userId: String(userId),
          action: 'initiative.resources.ai_apply',
          entityType: 'initiative',
          entityId: initiativeId,
          entityName: String(initiative?.title || ''),
          metadata: {
            scope,
            budgetAdded,
            fteAdded,
            toolsAdded,
            intangiblesAdded,
            note: note || null,
          },
        });
      } catch {
        // never block the request
      }

      // AI audit log (governance / explainability)
      try {
        const AIAuditLogger = await import('../services/aiAuditLogger.js').then(
          (m) => (m as any).default || m
        );
        await (AIAuditLogger as any).logInteraction({
          userId: String(userId),
          organizationId: String(orgId),
          projectId: initiative?.project_id ? String(initiative.project_id) : null,
          actionType: 'INITIATIVE_RESOURCES_APPLY',
          actionDescription: 'User applied AI-proposed resources (additions only)',
          contextSnapshot: {
            initiativeId,
            scope,
            counts: {
              budgetAdded: Number(budgetAdded) || 0,
              fteAdded: Number(fteAdded) || 0,
              toolsAdded: Number(toolsAdded) || 0,
              intangiblesAdded: Number(intangiblesAdded) || 0,
            },
            note: note || null,
          },
          dataSourcesUsed: ['initiative', 'resources_tables'],
          aiRole: 'ADVISOR',
          policyLevel: 'ADVISORY',
          confidenceLevel: 'MEDIUM',
          aiSuggestion: null,
          userDecision: 'APPLIED',
          userFeedback: null,
        });
      } catch {
        // ignore
      }

      res.json({ success: true });
    }
  );
}

export default InitiativeController;
