/**
 * AI Context Builder - Builds 6-layer context for every AI interaction
 * AI Core Layer — Enterprise PMO Brain
 */

import crypto from 'crypto';

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import { hasColumn } from '../utils/dbSchema.js';
import logger from '../utils/Logger.js';
import organizationContextService from './organizationContext/OrganizationContextService.js';

// Mutable dependencies for injection
let all = dbAll;
let get = dbGet;
let _pmoHealthServiceOverride: any = null;
let _aiActionExecutorOverride: any = null;
let _aiSettingsServiceOverride: any = null;
let _knowledgeServiceOverride: any = null;

let _pmoHealthService: any = null;
let _aiActionExecutor: any = null;
let _aiSettingsService: any = null;
let _knowledgeService: any = null;
let _coreDocsService: any = null;

// Interfaces
export interface ContextOptions {
  focusMode?: 'all' | 'pmo-docs' | 'project-data' | 'research' | 'web';
  currentScreen?: string | null;
  selectedObjectId?: string | null;
  selectedObjectType?: string | null;
  conversationId?: string | null;
}

export interface AIContext {
  platform: any;
  organization: any;
  project: any;
  execution: any;
  knowledge: any;
  external: any;
  pmo: any;
  pendingApprovals: any;
  aiSettings: any;
  focusMode: string;
  builtAt: string;
  contextHash: string;
  currentScreen: string | null;
  selectedObjectId: string | null;
  selectedObjectType: string | null;
}

// Lazy load dependencies to avoid circular dependencies
async function getPMOHealthService() {
  if (_pmoHealthServiceOverride) return _pmoHealthServiceOverride;
  if (!_pmoHealthService) {
    try {
      const mod = (await import('./pmoHealthService.js')) as any;
      _pmoHealthService = mod.default || mod.pmoHealthService || mod;
    } catch (e: unknown) {
      logger.warn('[AIContextBuilder] PMOHealthService not available');
    }
  }
  return _pmoHealthService;
}

async function getAIActionExecutor() {
  if (_aiActionExecutorOverride) return _aiActionExecutorOverride;
  if (!_aiActionExecutor) {
    try {
      // Import from the local JS file (compiled TS)
      const mod = (await import('./aiActionExecutor.js')) as any;
      _aiActionExecutor = mod.default || mod.aiActionExecutor || mod;
    } catch (e: unknown) {
      logger.warn('[AIContextBuilder] AIActionExecutor not available');
    }
  }
  return _aiActionExecutor;
}

async function getAISettingsService() {
  if (_aiSettingsServiceOverride) return _aiSettingsServiceOverride;
  if (!_aiSettingsService) {
    try {
      const mod = (await import('./aiSettingsService.js')) as any;
      const svc = mod.default || mod.aiSettingsService || mod;
      _aiSettingsService = svc && svc.__unavailable__ !== true ? svc : null;
    } catch (e: unknown) {
      logger.warn('[AIContextBuilder] AISettingsService not available');
      _aiSettingsService = null;
    }
  }
  return _aiSettingsService;
}

async function getKnowledgeService() {
  if (_knowledgeServiceOverride) return _knowledgeServiceOverride;
  if (!_knowledgeService) {
    try {
      const mod = (await import('./KnowledgeService.js')) as any;
      _knowledgeService = mod.knowledgeService || mod.default || mod;
    } catch (e: unknown) {
      logger.warn('[AIContextBuilder] KnowledgeService not available:', (e as Error).message);
    }
  }
  return _knowledgeService;
}

async function getCoreDocsService() {
  if (!_coreDocsService) {
    try {
      const mod = (await import('./ai/coreDocsService.js')) as any;
      _coreDocsService = mod.coreDocsService || mod.default || mod;
    } catch (e: unknown) {
      logger.warn('[AIContextBuilder] CoreDocsService not available:', (e as Error).message);
    }
  }
  return _coreDocsService;
}

const GOVERNANCE_KEYWORDS = [
  'governance',
  'policy',
  'role',
  'permission',
  'gate',
  'approval',
  'dod',
  'definition of done',
  'economics',
  'reporting',
  'compliance',
  'audit',
  'artefact',
  'artifact',
  'traceability',
  'pmo',
  'standard',
  'unblock',
  'change request',
  'escalation',
  'steering',
  'consultant',
];

function isGovernanceQuery(query?: string | null): boolean {
  if (!query) return false;
  const lower = query.toLowerCase();
  return GOVERNANCE_KEYWORDS.some((kw) => lower.includes(kw));
}

export const AIContextBuilder = {
  /**
   * Set dependencies for testing
   */
  setDependencies(deps: any) {
    if (deps.db) {
      all = deps.db.all;
      get = deps.db.get;
    }
    if (deps.PMOHealthService) _pmoHealthServiceOverride = deps.PMOHealthService;
    if (deps.AIActionExecutor) _aiActionExecutorOverride = deps.AIActionExecutor;
    if (deps.AISettingsService) _aiSettingsServiceOverride = deps.AISettingsService;
    if (deps.KnowledgeService) _knowledgeServiceOverride = deps.KnowledgeService;
  },

  /**
   * Build complete 6-layer context + PMO health snapshot
   */
  buildContext: async (
    userId: string,
    organizationId: string,
    projectId: string | null = null,
    options: ContextOptions = {}
  ): Promise<AIContext> => {
    const focusMode = options.focusMode || 'all';
    const conversationId = options.conversationId || null;
    const t0 = Date.now();
    logger.debug(
      `[AIContextBuilder] buildContext user=${userId} org=${organizationId} proj=${projectId} focus=${focusMode}`
    );

    const PMOHealthService = await getPMOHealthService();
    const AISettingsService = await getAISettingsService();

    // Build all context layers in parallel where possible
    const [platform, organization, project, execution, knowledge, external] = await Promise.all([
      AIContextBuilder._buildPlatformContext(userId, organizationId),
      AIContextBuilder._buildOrganizationContext(organizationId),
      projectId ? AIContextBuilder._buildProjectContext(projectId) : Promise.resolve(null),
      AIContextBuilder._buildExecutionContext(userId, projectId),
      AIContextBuilder._buildKnowledgeContext(projectId, focusMode, conversationId),
      AIContextBuilder._buildExternalContext(organizationId, focusMode),
    ]);

    // Fetch PMOHealthSnapshot
    const pmo = { healthSnapshot: null };
    if (projectId && PMOHealthService && ['all', 'pmo-docs', 'project-data'].includes(focusMode)) {
      try {
        pmo.healthSnapshot = await PMOHealthService.getHealthSnapshot(projectId);
      } catch (err: any) {
        logger.warn('[AIContextBuilder] PMO health snapshot failed:', (err as Error).message);
      }
    }

    // Fetch enrichment layers in parallel
    const [
      pendingApprovals,
      aiSettings,
      selectedEntity,
      assessmentData,
      financialData,
      historicalPatterns,
    ] = await Promise.all([
      AIContextBuilder._buildPendingApprovalsContext(userId, organizationId, projectId),
      (async () => {
        if (!AISettingsService) return null;
        try {
          return await AISettingsService.getEffectiveSettings(userId, organizationId);
        } catch (err: any) {
          logger.warn('[AIContextBuilder] AI settings failed:', (err as Error).message);
          return null;
        }
      })(),
      AIContextBuilder._buildSelectedEntityContext(
        options.selectedObjectType,
        options.selectedObjectId
      ),
      AIContextBuilder._buildAssessmentContext(projectId, organizationId),
      AIContextBuilder._buildFinancialContext(projectId, organizationId),
      AIContextBuilder._buildHistoricalPatternsContext(projectId, organizationId),
    ]);

    // T121: merge doc approvals into pending approvals (conversation scope)
    let pendingApprovalsMerged: any = pendingApprovals as any;
    const pendingDocs = (knowledge as any)?.pendingDocumentApprovals;
    if (pendingDocs?.count > 0) {
      const existingCount = Number(pendingApprovalsMerged?.count || 0);
      pendingApprovalsMerged = {
        ...(pendingApprovalsMerged || { count: 0, actions: [], summary: null }),
        count: existingCount + Number(pendingDocs.count || 0),
        documents: pendingDocs,
        summary:
          pendingApprovalsMerged?.summary ||
          `User has ${Number(pendingDocs.count || 0)} document(s) awaiting approval for AI access.`,
      };
    }

    let systemDocs: any = null;
    try {
      const CoreDocsService = await getCoreDocsService();
      if (CoreDocsService) {
        const queryHint = options.currentScreen || '';
        const isGov = isGovernanceQuery(queryHint);
        const maxSnippets = isGov ? 7 : 3;
        const maxChars = isGov ? 4000 : 2000;
        const snippets = await CoreDocsService.getSystemSnippets(
          queryHint || undefined,
          maxSnippets,
          maxChars
        );
        if (snippets?.length) {
          systemDocs = {
            snippets: snippets.map((s: any) => ({
              docTitle: s.docTitle,
              docSlug: s.docSlug,
              section: s.sectionTitle,
              content: s.content,
            })),
            count: snippets.length,
            isGovernanceEnhanced: isGov,
          };
        }
      }
    } catch (err: any) {
      logger.warn('[AIContextBuilder] System docs layer failed:', (err as Error).message);
    }

    // P23-F1: Include recent workbooks in AI context
    let recentWorkbooks: any = null;
    try {
      const wbRows = await all(
        `SELECT id, title, description, sheet_count, quality_score, created_at
         FROM generated_workbooks WHERE organization_id = ?
         ORDER BY created_at DESC LIMIT 5`,
        [organizationId]
      );
      if (wbRows?.length) {
        recentWorkbooks = {
          count: wbRows.length,
          items: wbRows.map((wb: any) => ({
            id: wb.id,
            title: wb.title,
            description: wb.description,
            sheetCount: wb.sheet_count,
            qualityScore: wb.quality_score,
            createdAt: wb.created_at,
          })),
        };
      }
    } catch {
      // generated_workbooks table may not exist yet
    }

    const fullContext = {
      platform,
      organization,
      project,
      execution,
      selectedEntity,
      knowledge,
      external,
      pmo,
      pendingApprovals: pendingApprovalsMerged,
      aiSettings,
      assessmentData,
      financialData,
      historicalPatterns,
      systemDocs,
      recentWorkbooks,
    };

    let filteredContext = AIContextBuilder._applyFocusModeFilter(fullContext, focusMode);

    // T119: Organization context policy enforcement (SSOT in organization_ai_settings.context_policy_json)
    try {
      const govMod = (await import('./ai/contextGovernance.js')) as any;
      const getOrgContextPolicy = govMod.getOrgContextPolicy || govMod.default?.getOrgContextPolicy;
      const filterContextByPolicy =
        govMod.filterContextByPolicy || govMod.default?.filterContextByPolicy;

      if (
        typeof getOrgContextPolicy === 'function' &&
        typeof filterContextByPolicy === 'function'
      ) {
        const policy = await getOrgContextPolicy(organizationId);
        filteredContext = filterContextByPolicy(filteredContext as any, policy) as any;

        // Attach a lightweight snapshot for explainability/debug (do not include full JSON policy blob).
        (filteredContext as any).aiSettings = {
          ...(filteredContext as any).aiSettings,
          orgContextPolicy: {
            categories: policy?.categories || null,
            retention: policy?.retention || null,
            piiRedaction: policy?.piiRedaction || null,
          },
        };
      }
    } catch (err: any) {
      // SECURITY: fail CLOSED — on governance error, strip sensitive categories rather than
      // leaking unfiltered context. This prevents policy‑bypass on transient DB errors.
      logger.warn(
        `[AIContextBuilder] Context policy enforcement failed — applying restrictive defaults: ${err?.message}`
      );
      try {
        const restrictivePolicy: any = {
          categories: {
            ORG_PROFILE: true,
            ORG_TERMINOLOGY: true,
            ORG_PATTERNS: false,
            ORG_STRATEGY: true,
            ORG_SECURITY_POSTURE: false,
            ORG_FINANCIAL_SUMMARY: false,
            ORG_DOCUMENTS: true,
          },
          piiRedaction: 'on',
          retention: 'strict',
        };
        const govFallback = (await import('./ai/contextGovernance.js')) as any;
        const fallbackFilter =
          govFallback.filterContextByPolicy || govFallback.default?.filterContextByPolicy;
        if (typeof fallbackFilter === 'function') {
          filteredContext = fallbackFilter(filteredContext as any, restrictivePolicy) as any;
        }
      } catch {
        // Last resort: strip everything sensitive manually
        const org = (filteredContext as any)?.organization;
        if (org) {
          delete org.topPatterns;
          delete org.orgPatterns;
        }
        delete (filteredContext as any).financialData;
        delete (filteredContext as any).securityPosture;
      }
    }

    // Cap context size to avoid sending excessive tokens to LLM
    const contextSizeEstimate = JSON.stringify(filteredContext).length;
    if (contextSizeEstimate > 12000) {
      logger.warn(
        `[AIContextBuilder] Context is large (${contextSizeEstimate} chars), trimming execution layer`
      );
      // Trim execution layer first — it's the largest and least critical for general queries
      if (filteredContext.execution) {
        const exec = filteredContext.execution as any;
        if (exec.userTasks?.length > 5) exec.userTasks = exec.userTasks.slice(0, 5);
        if (exec.userInitiatives?.length > 3)
          exec.userInitiatives = exec.userInitiatives.slice(0, 3);
        if (exec.pendingDecisions?.length > 3)
          exec.pendingDecisions = exec.pendingDecisions.slice(0, 3);
        if (exec.blockers?.length > 3) exec.blockers = exec.blockers.slice(0, 3);
      }
      // Trim knowledge layer
      if ((filteredContext as any).knowledge) {
        const kn = (filteredContext as any).knowledge;
        if (kn.projectDocuments?.length > 5) kn.projectDocuments = kn.projectDocuments.slice(0, 5);
        if (kn.previousDecisions?.length > 5)
          kn.previousDecisions = kn.previousDecisions.slice(0, 5);
        if (kn.strategicDirections?.length > 3)
          kn.strategicDirections = kn.strategicDirections.slice(0, 3);
      }
    }

    logger.debug(
      `[AIContextBuilder] Context built in ${Date.now() - t0}ms (${contextSizeEstimate} chars)`
    );
    return {
      ...filteredContext,
      focusMode,
      builtAt: new Date().toISOString(),
      contextHash: AIContextBuilder._generateHash(platform, organization, project),
      currentScreen: options.currentScreen || null,
      selectedObjectId: options.selectedObjectId || null,
      selectedObjectType: options.selectedObjectType || null,
    } as AIContext;
  },

  /**
   * Apply focus mode filtering
   */
  _applyFocusModeFilter: (fullContext: any, focusMode: string) => {
    const systemDocs = fullContext.systemDocs || null;
    switch (focusMode) {
      case 'pmo-docs':
        return {
          platform: fullContext.platform,
          organization: { name: fullContext.organization?.name },
          project: null,
          execution: null,
          knowledge: {
            ragDisabled: fullContext.knowledge?.ragDisabled,
            projectDocuments: [],
            previousDecisions: [],
            frameworkKnowledge: fullContext.knowledge?.frameworkKnowledge || [],
            pmoStandards: fullContext.knowledge?.pmoStandards || fullContext.knowledge,
          },
          external: null,
          pmo: fullContext.pmo,
          pendingApprovals: [],
          systemDocs,
        };

      case 'project-data':
        return {
          platform: fullContext.platform,
          organization: fullContext.organization,
          project: fullContext.project,
          execution: fullContext.execution,
          knowledge: {
            ragDisabled: fullContext.knowledge?.ragDisabled,
            projectDocuments: fullContext.knowledge?.projectDocuments || [],
            previousDecisions: fullContext.knowledge?.previousDecisions || [],
          },
          external: null,
          pmo: fullContext.pmo,
          pendingApprovals: fullContext.pendingApprovals,
          systemDocs,
        };

      case 'research':
        return {
          platform: fullContext.platform,
          organization: fullContext.organization,
          project: fullContext.project,
          execution: fullContext.execution,
          knowledge: fullContext.knowledge,
          external: null,
          pmo: fullContext.pmo,
          pendingApprovals: fullContext.pendingApprovals,
          systemDocs,
        };

      case 'web':
        return {
          platform: { role: fullContext.platform?.role },
          organization: {
            name: fullContext.organization?.name,
            industry: fullContext.organization?.industry,
          },
          project: fullContext.project ? { name: fullContext.project?.name } : null,
          execution: null,
          knowledge: null,
          external: {
            ...fullContext.external,
            webSearchEnabled: true,
            webSearchPriority: 'high',
          },
          pmo: null,
          pendingApprovals: [],
          systemDocs,
        };

      case 'all':
      default:
        return fullContext;
    }
  },

  /**
   * Layer 1: Platform Context
   */
  _buildPlatformContext: async (userId: string, organizationId: string) => {
    const user: any = (await get(`SELECT role FROM users WHERE id = ?`, [userId])) || {};
    const policies: any =
      (await get(`SELECT * FROM ai_policies WHERE organization_id = ?`, [organizationId])) || {};

    let platformRole = 'USER';
    if (user.role === 'SUPERADMIN') platformRole = 'SUPERADMIN';
    else if (user.role === 'ADMIN') platformRole = 'ADMIN';

    return {
      role: platformRole,
      tenantId: organizationId,
      userId,
      policyLevel: policies.policy_level || 'ADVISORY',
      globalPolicies: {
        internetEnabled: policies.internet_enabled === 1,
        maxPolicyLevel: policies.max_policy_level || 'ASSISTED',
        auditRequired: policies.audit_required !== 0,
      },
    };
  },

  /**
   * Layer 2: Organization Context
   */
  _buildOrganizationContext: async (organizationId: string) => {
    const org: any =
      (await get(`SELECT * FROM organizations WHERE id = ?`, [organizationId])) || {};
    const projects =
      (await all(`SELECT id FROM projects WHERE organization_id = ? AND is_closed = 0`, [
        organizationId,
      ])) || [];
    const memory: any =
      (await get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`, [
        organizationId,
      ])) || {};

    // Fetch org-level patterns (best practices, lessons learned) from organization_memory
    let orgPatterns: Array<{ type: string; title: string; content: string }> = [];
    try {
      const patternRows = (await all(
        `SELECT memory_type, title, content FROM organization_memory
         WHERE organization_id = ? AND is_active = 1
         ORDER BY usage_count DESC LIMIT 5`,
        [organizationId]
      )) as any[];
      orgPatterns = (patternRows || []).map((r: any) => ({
        type: r.memory_type,
        title: r.title,
        content: (r.content || '').slice(0, 200),
      }));
    } catch {
      // organization_memory table may not exist yet
    }

    // Fetch terminology from ai_organization_memory key-value store
    const terminology: Record<string, string> = {};
    try {
      const termRows = (await all(
        `SELECT memory_key, memory_value FROM ai_organization_memory
         WHERE organization_id = ? AND memory_key LIKE 'terminology_%'`,
        [organizationId]
      )) as any[];
      for (const r of termRows || []) {
        const key = String(r.memory_key).replace('terminology_', '');
        terminology[key] = String(r.memory_value || '');
      }
    } catch {
      // ignore
    }

    // ORG-001: Chat consumes only an immutable, explicitly published snapshot.
    // Draft/proposed claims and mutable context rows are never read into the
    // request context. Tenant scope is enforced by getPublishedSnapshot().
    const publishedContext = await organizationContextService
      .getPublishedSnapshot(organizationId)
      .catch(() => null);
    const resolvedContext = publishedContext?.context || null;

    const formattedFindings = (resolvedContext?.signals?.interviewFindings ?? []).map((f) => {
      const tag = `[${String(f.confidenceLevel).toUpperCase()}]`;
      const base = `${tag} ${f.findingStatement}`;
      const limitsNote = f.limits ? ` | Limits: ${f.limits}` : '';
      const evidenceNote =
        f.evidenceCount > 0
          ? ` (${f.evidenceCount} evidence pointer${f.evidenceCount === 1 ? '' : 's'})`
          : '';
      return `${base}${limitsNote}${evidenceNote}`;
    });

    // Feedback #1b81d375 / #2f5803b0 / #30592ee0 / #fa158b06 — Teresa used to
    // reply "nie mam dostępu do danych VTS / Atelier / plików" even when the
    // org had interview answers, evidence files, and manual notes persisted
    // in `organization_context_items` (VTS collected Q&A, uploaded PDFs,
    // manual entries). `resolvedContext.signals.interviewFindings` only
    // surfaces *processed* P10 findings — the raw interview answers and
    // evidence titles never reached the prompt. This pull exposes a compact
    // snapshot (last ~30 rows grouped by source_type) so Teresa can reason
    // about the tenant's actual content without a project scope.
    let contextItemsSample: {
      interviewAnswers: Array<{ question: string; answer: string; updatedAt: string }>;
      evidence: Array<{ title: string; fileType?: string; updatedAt: string }>;
      manualNotes: Array<{ title: string; snippet: string; updatedAt: string }>;
      documentExtractions: Array<{ title: string; snippet: string; updatedAt: string }>;
      totalItems: number;
      lastUpdated: string | null;
    } | null = null;
    try {
      const rows =
        ((await all(
          `SELECT id, source_type, source_label, content_json, updated_at
             FROM organization_context_items
            WHERE organization_id = ?
              AND (visibility_scope IS NULL OR visibility_scope IN ('organization', 'public'))
            ORDER BY updated_at DESC
            LIMIT 60`,
          [organizationId]
        )) as Array<{
          id: string;
          source_type: string;
          source_label: string | null;
          content_json: string | null;
          updated_at: string;
        }>) || [];

      const parseRow = (raw: string | null): Record<string, any> => {
        if (!raw) return {};
        try {
          const p = JSON.parse(raw);
          return p && typeof p === 'object' ? p : {};
        } catch {
          return {};
        }
      };

      const truncate = (s: unknown, max: number) => {
        const str = typeof s === 'string' ? s : String(s ?? '');
        return str.length > max ? `${str.slice(0, max).trim()}…` : str;
      };

      const interviewAnswers: Array<{ question: string; answer: string; updatedAt: string }> = [];
      const evidence: Array<{ title: string; fileType?: string; updatedAt: string }> = [];
      const manualNotes: Array<{ title: string; snippet: string; updatedAt: string }> = [];
      const documentExtractions: Array<{ title: string; snippet: string; updatedAt: string }> = [];

      for (const row of rows) {
        const content = parseRow(row.content_json);
        const label = row.source_label || '';
        const updatedAt = row.updated_at;

        if (row.source_type === 'interview_answer' && interviewAnswers.length < 8) {
          const q = String(content.questionText || label || '').trim();
          const a = String(content.answerText || content.answer || '').trim();
          if (q && a) {
            interviewAnswers.push({
              question: truncate(q, 240),
              answer: truncate(a, 360),
              updatedAt,
            });
          }
        } else if (row.source_type === 'interview_evidence' && evidence.length < 5) {
          const title = String(content.title || content.fileName || label || 'Evidence').trim();
          evidence.push({
            title: truncate(title, 120),
            fileType: content.fileType || content.evidenceType || undefined,
            updatedAt,
          });
        } else if (
          (row.source_type === 'manual_entry' || row.source_type === 'manual_context') &&
          manualNotes.length < 5
        ) {
          const title = String(label || content.title || 'Manual note').trim();
          const snippet = String(
            content.text || content.content || content.note || content.body || ''
          ).trim();
          if (snippet) {
            manualNotes.push({
              title: truncate(title, 120),
              snippet: truncate(snippet, 300),
              updatedAt,
            });
          }
        } else if (
          (row.source_type === 'doc_ingestion' || row.source_type === 'document_extraction') &&
          documentExtractions.length < 5
        ) {
          const title = String(label || content.title || content.fileName || 'Document').trim();
          const snippet = String(content.text || content.summary || content.excerpt || '').trim();
          documentExtractions.push({
            title: truncate(title, 120),
            snippet: truncate(snippet, 260),
            updatedAt,
          });
        }
      }

      if (
        interviewAnswers.length ||
        evidence.length ||
        manualNotes.length ||
        documentExtractions.length
      ) {
        contextItemsSample = {
          interviewAnswers,
          evidence,
          manualNotes,
          documentExtractions,
          totalItems: rows.length,
          lastUpdated: rows[0]?.updated_at || null,
        };
      }
    } catch (err: any) {
      logger.warn(
        '[AIContextBuilder] organization_context_items snapshot failed:',
        err?.message || String(err)
      );
    }

    return {
      organizationId,
      organizationName: resolvedContext?.profile.companyName || org.name || 'Unknown',
      industry: resolvedContext?.profile.industry || org.industry || null,
      locations: [],
      activeProjectIds: projects.map((p: any) => p.id),
      activeProjectCount: projects.length,
      pmoMaturityLevel: memory.pmo_maturity || 'BASIC',
      profile: resolvedContext?.profile,
      strategic: resolvedContext?.strategic,
      operations: resolvedContext?.operations,
      systems: resolvedContext?.systems,
      stakeholders: resolvedContext?.stakeholders,
      notes: resolvedContext?.notes,
      metadata: resolvedContext?.metadata,
      evidence: resolvedContext?.evidence,
      signals: {
        ...resolvedContext?.signals,
        interviewFindingsFormatted: formattedFindings,
      },
      trust: resolvedContext?.trust,
      contextConflicts: resolvedContext?.conflicts,
      contextTimeline: resolvedContext?.timeline?.slice(0, 10),
      organizationContextSnapshotId: publishedContext?.snapshotId,
      organizationContextSourceRefs: publishedContext?.sourceRefs,
      organizationContextContentHash: publishedContext?.contentHash,
      // Organization Memory: patterns and terminology for AI context
      orgPatterns: orgPatterns.length > 0 ? orgPatterns : undefined,
      terminology: Object.keys(terminology).length > 0 ? terminology : undefined,
      // Feedback #1b81d375 / #2f5803b0 / #30592ee0 / #fa158b06 — raw snapshot
      // of the org's collected context (interview Q&As, evidence files,
      // manual notes) so Teresa can cite actual tenant data in chat.
      contextItemsSample: undefined,
    };
  },

  /**
   * Layer 3: Project Context
   */
  _buildProjectContext: async (projectId: string) => {
    const project: any = (await get(`SELECT * FROM projects WHERE id = ?`, [projectId])) || {};
    if (!project.id) return null;

    const initiatives: any = (await get(
      `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                FROM initiatives WHERE project_id = ?`,
      [projectId]
    )) || { total: 0, completed: 0 };

    const PHASE_ORDER = [
      'Context',
      'Assessment',
      'Initiatives',
      'Roadmap',
      'Execution',
      'Stabilization',
    ];
    const phaseNumber = PHASE_ORDER.indexOf(project.current_phase || 'Context') + 1;

    let governanceRules = {};
    try {
      governanceRules = JSON.parse(project.governance_settings || '{}');
    } catch {}

    return {
      projectId,
      projectName: project.name,
      currentPhase: project.current_phase || 'Context',
      phaseNumber,
      governanceRules: {
        requireApprovalForPhaseTransition:
          (governanceRules as any).requireApprovalForPhaseTransition || false,
        stageGatesEnabled: (governanceRules as any).stageGatesEnabled || false,
        aiPolicyOverride: null,
      },
      sponsorId: project.sponsor_id,
      projectManagerId: project.project_manager_id,
      roadmapStatus: project.status,
      initiativeCount: initiatives.total,
      completedInitiatives: initiatives.completed,
    };
  },

  /**
   * Layer 4: Execution Context
   */
  _buildExecutionContext: async (userId: string, projectId: string | null) => {
    let taskSql = `SELECT id, title, status, due_date FROM tasks WHERE assignee_id = ? AND status NOT IN ('done', 'DONE')`;
    const taskParams = [userId];
    if (projectId) {
      taskSql += ` AND project_id = ?`;
      taskParams.push(projectId);
    }
    taskSql += ` ORDER BY due_date ASC LIMIT 10`;
    const tasks = await all(taskSql, taskParams);

    let initiativeSql = `SELECT id, name, status FROM initiatives WHERE owner_business_id = ? AND status NOT IN ('COMPLETED', 'CANCELLED')`;
    const initiativeParams = [userId];
    if (projectId) {
      initiativeSql += ` AND project_id = ?`;
      initiativeParams.push(projectId);
    }
    initiativeSql += ` LIMIT 10`;
    const initiatives = await all(initiativeSql, initiativeParams);

    let decisionSql = `SELECT id, title, created_at FROM decisions WHERE decision_maker_id = ? AND status IN ('pending', 'escalated')`;
    const decisionParams = [userId];
    if (projectId) {
      decisionSql += ` AND project_id = ?`;
      decisionParams.push(projectId);
    }
    decisionSql += ` LIMIT 10`;
    const decisions = await all(decisionSql, decisionParams);

    let blockerSql = `SELECT id, 'TASK' as type, blocked_reason as description FROM tasks 
                   WHERE assignee_id = ? AND status IN ('blocked', 'BLOCKED')`;
    const blockerParams = [userId];
    if (projectId) {
      blockerSql += ` AND project_id = ?`;
      blockerParams.push(projectId);
    }
    const blockers = await all(blockerSql, blockerParams);

    let capacityStatus = 'HEALTHY';
    if (tasks.length > 15) capacityStatus = 'OVERLOADED';
    else if (tasks.length > 8) capacityStatus = 'WARNING';

    return {
      userId,
      userTasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.due_date,
      })),
      userInitiatives: initiatives.map((i: any) => ({ id: i.id, name: i.name, status: i.status })),
      pendingDecisions: decisions.map((d: any) => ({
        id: d.id,
        title: d.title,
        createdAt: d.created_at,
      })),
      blockers: blockers.map((b: any) => ({
        id: b.id,
        type: b.type,
        description: b.description || 'No reason provided',
      })),
      capacityStatus,
    };
  },

  /**
   * Layer 5: Knowledge Context
   */
  _buildKnowledgeContext: async (
    projectId: string | null,
    _focusMode: string = 'all',
    conversationId: string | null = null
  ) => {
    const KnowledgeService = await getKnowledgeService();

    let organizationId = null;
    if (projectId) {
      const project: any =
        (await get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId])) || {};
      organizationId = project.organization_id;
    }

    let strategicDirections = [];
    if (organizationId && KnowledgeService) {
      try {
        strategicDirections = await KnowledgeService.getActiveStrategies(organizationId);
      } catch (err: any) {
        logger.warn(
          '[AIContextBuilder] Failed to load strategic directions:',
          (err as Error).message
        );
      }
    }

    let approvedIdeas = [];
    if (organizationId && KnowledgeService) {
      try {
        approvedIdeas = await KnowledgeService.getApprovedIdeas({
          organizationId,
          projectId: projectId || undefined,
        });
      } catch (err: any) {
        logger.warn('[AIContextBuilder] Failed to load approved ideas:', (err as Error).message);
      }
    }

    if (!projectId) {
      return {
        ragDisabled: false,
        projectDocuments: [],
        strategicDirections: (strategicDirections || []).map((s: any) => ({
          title: s.title,
          description: s.description,
          priority: s.priority,
          progress_percentage: s.progress_percentage,
        })),
        approvedIdeas: (approvedIdeas || []).slice(0, 5).map((i: any) => ({
          content: i.content,
          category: i.category,
          tags: i.tags || [],
        })),
      };
    }

    const project: any = (await get(`SELECT rag_enabled FROM projects WHERE id = ?`, [
      projectId,
    ])) || {
      rag_enabled: 1,
    };
    if (project.rag_enabled === 0) {
      return {
        ragDisabled: true,
        projectDocuments: [],
        message: 'RAG is disabled for this project',
      };
    }

    const decisions = await all(
      `SELECT id, title, outcome FROM decisions 
                WHERE project_id = ? AND status != 'PENDING' 
                ORDER BY decided_at DESC LIMIT 10`,
      [projectId]
    );

    const projectInfo: any =
      (await get(`SELECT phase_history FROM projects WHERE id = ?`, [projectId])) || {};
    let phaseHistory = [];
    try {
      phaseHistory = JSON.parse(projectInfo.phase_history || '[]');
    } catch {}

    let documents = [];
    if (organizationId && KnowledgeService) {
      try {
        documents = await KnowledgeService.getDocuments(organizationId);
      } catch (err: any) {}
    }

    // T121: Per-document governance (ai_visibility/sensitivity) + conversation-scoped approvals
    let docGov: any = null;
    let pendingDocumentApprovals: any = { count: 0, documentIds: [], documents: [] };
    try {
      const dgMod = (await import('./ai/documentGovernance.js')) as any;
      const filterDocumentsByVisibility =
        dgMod.filterDocumentsByVisibility || dgMod.default?.filterDocumentsByVisibility;
      if (typeof filterDocumentsByVisibility === 'function' && Array.isArray(documents)) {
        const docIds = documents.map((d: any) => String(d?.id || '')).filter(Boolean);
        const access = await filterDocumentsByVisibility(
          docIds,
          projectId || undefined,
          conversationId || undefined
        );
        docGov = {
          allowedDocIds: access.allowed || [],
          blockedDocIds: access.blocked || [],
          requiresApprovalDocIds: access.requiresApproval || [],
          approvedViaConversation: access.approvedViaConversation || [],
        };

        const allowedSet = new Set<string>(access.allowed || []);
        const requiresSet = new Set<string>(access.requiresApproval || []);

        const allowedDocs = documents.filter((d: any) => allowedSet.has(String(d?.id || '')));
        const requiresDocs = documents.filter((d: any) => requiresSet.has(String(d?.id || '')));

        documents = allowedDocs;
        pendingDocumentApprovals = {
          count: requiresDocs.length,
          documentIds: requiresDocs.map((d: any) => String(d?.id || '')).filter(Boolean),
          documents: requiresDocs.map((d: any) => ({
            id: d.id,
            filename: d.filename,
            category: d.category || null,
            tags: d.tags ? (typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags) : [],
          })),
        };
      }
    } catch {
      // fail-open
    }

    return {
      ragDisabled: false,
      projectDocuments: documents.map((d: any) => ({
        id: d.id,
        filename: d.filename,
        category: d.category || null,
        tags: d.tags ? (typeof d.tags === 'string' ? JSON.parse(d.tags) : d.tags) : [],
      })),
      pendingDocumentApprovals,
      docGovernance: docGov,
      previousDecisions: decisions.map((d: any) => ({
        id: d.id,
        title: d.title,
        outcome: d.outcome || 'N/A',
      })),
      phaseHistory: phaseHistory.map((ph: any) => ({ phase: ph.phase, enteredAt: ph.enteredAt })),
      strategicDirections: (strategicDirections || []).map((s: any) => ({
        title: s.title,
        description: s.description,
        priority: s.priority,
        progress_percentage: s.progress_percentage,
        success_metrics: s.success_metrics || [],
      })),
      approvedIdeas: (approvedIdeas || []).slice(0, 5).map((i: any) => ({
        content: i.content,
        category: i.category,
        tags: i.tags || [],
        impact_score: i.impact_score,
      })),
    };
  },

  /**
   * Layer 6: External Context
   */
  _buildExternalContext: async (organizationId: string, _focusMode: string = 'all') => {
    const policies: any =
      (await get(`SELECT internet_enabled FROM ai_policies WHERE organization_id = ?`, [
        organizationId,
      ])) || {};
    return {
      internetEnabled: policies.internet_enabled === 1,
      externalSourcesUsed: [],
    };
  },

  /**
   * Pending Approvals Context for HITL Learning System
   */
  _buildPendingApprovalsContext: async (
    userId: string,
    organizationId: string,
    projectId: string | null
  ) => {
    const AIActionExecutor = await getAIActionExecutor();
    if (!AIActionExecutor) return { count: 0, actions: [], summary: null };

    try {
      const pendingActions = await AIActionExecutor.getPendingActions(
        userId,
        projectId,
        organizationId
      );
      if (!pendingActions || pendingActions.length === 0)
        return { count: 0, actions: [], summary: null };

      const actionsWithPatterns = await Promise.all(
        pendingActions.slice(0, 5).map(async (action: any) => {
          let patternInfo = null;
          try {
            patternInfo = await AIActionExecutor.getPatternInfo(
              userId,
              action.action_type,
              action.payload || {}
            );
          } catch (e: unknown) {}

          return {
            id: action.id,
            actionType: action.action_type,
            title: action.draftContent?.title || action.draftContent?.name || action.action_type,
            riskLevel: action.payload?.riskLevel || 'LOW',
            createdAt: action.created_at,
            patternInfo,
          };
        })
      );

      const byType: any = {};
      pendingActions.forEach((a: any) => {
        byType[a.action_type] = (byType[a.action_type] || 0) + 1;
      });

      const typeSummary = Object.entries(byType)
        .map(([type, count]) => `${count} ${type.replace(/_/g, ' ').toLowerCase()}`)
        .join(', ');

      return {
        count: pendingActions.length,
        actions: actionsWithPatterns,
        summary: `User has ${pendingActions.length} pending AI actions awaiting approval: ${typeSummary}`,
        oldestCreatedAt: pendingActions[pendingActions.length - 1]?.created_at,
        hasLearnedPatterns: actionsWithPatterns.some((a: any) => a.patternInfo?.decisionCount > 1),
      };
    } catch (error: unknown) {
      logger.error('[AIContextBuilder] Failed to get pending approvals:', error);
      return { count: 0, actions: [], summary: null };
    }
  },

  // ================================================================
  // PHASE 1 — ENRICHMENT LAYERS
  // ================================================================

  /**
   * Layer 4.5: Selected Entity Deep Loading
   * Fetches full data for the entity the user is currently viewing.
   */
  _buildSelectedEntityContext: async (objectType?: string | null, objectId?: string | null) => {
    if (!objectType || !objectId) return null;

    try {
      switch (objectType.toLowerCase()) {
        case 'initiative': {
          const initiative: any = await get(
            `SELECT i.id, i.name, i.description, i.status, i.priority,
                    i.cost_capex, i.cost_opex, i.expected_roi,
                    i.estimated_duration_weeks, i.start_date, i.end_date,
                    i.execution_started_at, i.completed_at,
                    i.drd_axis, i.drd_area
             FROM initiatives i WHERE i.id = ?`,
            [objectId]
          );
          if (!initiative) return null;

          const kpis = await all(
            `SELECT name, target_value, current_value, unit FROM initiative_kpis WHERE initiative_id = ?`,
            [objectId]
          );
          const deps = await all(
            `SELECT depends_on_id, dependency_type FROM initiative_dependencies WHERE initiative_id = ?`,
            [objectId]
          );
          const stakeholders = await all(
            `SELECT user_id, role FROM initiative_stakeholders WHERE initiative_id = ? LIMIT 10`,
            [objectId]
          );

          return {
            type: 'initiative',
            data: {
              ...initiative,
              kpis: kpis.slice(0, 10),
              dependencies: deps.slice(0, 10),
              stakeholders: stakeholders.slice(0, 5),
            },
          };
        }

        case 'task': {
          const task: any = await get(
            `SELECT t.id, t.title, t.description, t.status, t.priority, 
                    t.due_date, t.progress, t.assignee_id, t.initiative_id
             FROM tasks t WHERE t.id = ?`,
            [objectId]
          );
          if (!task) return null;

          const comments = await all(
            `SELECT content, created_by, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at DESC LIMIT 5`,
            [objectId]
          );
          const deps = await all(
            `SELECT depends_on_id, type FROM task_dependencies WHERE task_id = ? LIMIT 10`,
            [objectId]
          );

          return {
            type: 'task',
            data: {
              ...task,
              recentComments: comments,
              dependencies: deps,
            },
          };
        }

        case 'assessment': {
          const assessment: any = await get(
            `SELECT id, name, framework, status, overall_score, confidence_avg, completion_percent
             FROM maturity_assessments WHERE id = ?`,
            [objectId]
          );
          if (!assessment) return null;

          const axisScores = await all(
            `SELECT axis_id, axis_name, as_is_score, to_be_score, gap, justification
             FROM digitization_axis_scores WHERE assessment_id = ? ORDER BY gap DESC`,
            [objectId]
          );

          return {
            type: 'assessment',
            data: {
              ...assessment,
              axisScores: axisScores.slice(0, 15),
              topGaps: axisScores.filter((a: any) => a.gap > 0).slice(0, 5),
            },
          };
        }

        case 'decision': {
          const decision: any = await get(
            `SELECT id, title, description, type, status, options, criteria, deadline
             FROM decisions WHERE id = ?`,
            [objectId]
          );
          if (!decision) return null;

          let parsedOptions = [];
          try {
            parsedOptions = JSON.parse(decision.options || '[]');
          } catch {}

          return {
            type: 'decision',
            data: {
              ...decision,
              options: parsedOptions,
            },
          };
        }

        default:
          return null;
      }
    } catch (err: any) {
      logger.warn(
        `[AIContextBuilder] Entity loading failed for ${objectType}/${objectId}:`,
        err?.message
      );
      return null;
    }
  },

  /**
   * Layer 7: Assessment Data Context
   * Provides assessment scores, gaps, and recommendations for the active project.
   */
  _buildAssessmentContext: async (projectId: string | null, organizationId: string) => {
    if (!projectId) return null;

    try {
      const parseJson = (raw: unknown): Record<string, any> => {
        if (!raw) return {};
        if (typeof raw === 'object') return raw as Record<string, any>;
        if (typeof raw !== 'string') return {};
        try {
          const parsed = JSON.parse(raw);
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
        } catch {
          return {};
        }
      };

      const canonicalAssessment: any = await get(
        `SELECT
           id,
           name,
           assessment_type,
           status,
           completion_percent,
           confidence_avg,
           score_summary,
           context_snapshot,
           p28_workbench_v1,
           created_at,
           updated_at
         FROM assessments
         WHERE project_id = ? AND organization_id = ?
         ORDER BY COALESCE(updated_at, created_at) DESC
         LIMIT 1`,
        [projectId, organizationId]
      );

      if (canonicalAssessment) {
        const scoreSummary = parseJson(canonicalAssessment.score_summary);
        const contextSnapshot = parseJson(canonicalAssessment.context_snapshot);
        const workbench = parseJson(canonicalAssessment.p28_workbench_v1);
        const scoreValues =
          (workbench?.scoreProposal?.scoreValues as Record<string, unknown> | undefined) ||
          (scoreSummary?.scores as Record<string, unknown> | undefined) ||
          (scoreSummary?.scoreValues as Record<string, unknown> | undefined) ||
          {};

        const normalizedScores = Object.entries(scoreValues)
          .map(([axis, value]) => ({
            axis,
            asIs:
              typeof value === 'number'
                ? value
                : typeof value === 'string' && value.trim() !== ''
                  ? Number(value)
                  : null,
          }))
          .filter((entry) => Number.isFinite(entry.asIs))
          .map((entry) => ({ ...entry, asIs: Number(entry.asIs) }));

        const needsWorkTopAxes = Array.isArray(contextSnapshot?.needsWorkTopAxes)
          ? contextSnapshot.needsWorkTopAxes
          : [];

        return {
          assessmentId: canonicalAssessment.id,
          name: canonicalAssessment.name,
          framework: canonicalAssessment.assessment_type || 'DRD',
          status: canonicalAssessment.status,
          overallScore: scoreSummary?.overallScore ?? scoreSummary?.overall_score ?? null,
          overallTarget: scoreSummary?.overallTarget ?? scoreSummary?.overall_target ?? null,
          overallGap: scoreSummary?.overallGap ?? scoreSummary?.overall_gap ?? null,
          completionPercent: canonicalAssessment.completion_percent,
          confidenceAvg:
            canonicalAssessment.confidence_avg ?? workbench?.scoreProposal?.confidence ?? null,
          runState: workbench?.runState || null,
          axisScores: normalizedScores.slice(0, 10).map((entry) => ({
            axis: entry.axis,
            asIs: entry.asIs,
            toBe: null,
            gap: null,
          })),
          topGaps: needsWorkTopAxes.length
            ? needsWorkTopAxes.slice(0, 5).map((axis: any) => ({
                axis: axis?.axisName || axis?.axisId || 'unknown',
                gap:
                  typeof axis?.percent === 'number'
                    ? Math.max(0, 100 - Number(axis.percent))
                    : null,
              }))
            : normalizedScores
                .slice()
                .sort((a, b) => Number(a.asIs) - Number(b.asIs))
                .slice(0, 5)
                .map((entry) => ({
                  axis: entry.axis,
                  gap: Number((5 - Number(entry.asIs)).toFixed(2)),
                })),
        };
      }

      // Fallback for legacy projects that still store DRD in maturity_assessments.
      const assessment: any = await get(
        `SELECT id, name, framework, status, overall_score, confidence_avg, completion_percent
         FROM maturity_assessments
         WHERE project_id = ? AND status IN ('COMPLETED', 'APPROVED', 'IN_REVIEW', 'IN_PROGRESS')
         ORDER BY created_at DESC LIMIT 1`,
        [projectId]
      );
      if (!assessment) return null;

      const axisScores = await all(
        `SELECT axis_id, axis_name, as_is_score, to_be_score, gap
         FROM digitization_axis_scores
         WHERE assessment_id = ?
         ORDER BY gap DESC`,
        [assessment.id]
      );

      const analysis: any = await get(
        `SELECT overall_as_is, overall_to_be, overall_gap
         FROM digitization_analyses
         WHERE assessment_id = ? LIMIT 1`,
        [assessment.id]
      );

      return {
        assessmentId: assessment.id,
        name: assessment.name,
        framework: assessment.framework,
        status: assessment.status,
        overallScore: assessment.overall_score || analysis?.overall_as_is || null,
        overallTarget: analysis?.overall_to_be || null,
        overallGap: analysis?.overall_gap || null,
        completionPercent: assessment.completion_percent,
        axisScores: axisScores.slice(0, 10).map((a: any) => ({
          axis: a.axis_name || a.axis_id,
          asIs: a.as_is_score,
          toBe: a.to_be_score,
          gap: a.gap,
        })),
        topGaps: axisScores
          .filter((a: any) => a.gap > 0)
          .slice(0, 5)
          .map((a: any) => ({
            axis: a.axis_name || a.axis_id,
            gap: a.gap,
          })),
      };
    } catch (err: any) {
      logger.warn('[AIContextBuilder] Assessment context failed:', err?.message);
      return null;
    }
  },

  /**
   * Layer 8: Financial Data Context
   * Provides ROI, NPV, cost data for the project portfolio.
   */
  _buildFinancialContext: async (projectId: string | null, organizationId: string) => {
    try {
      // Aggregate initiative financials (project-scoped)
      let financials: any = null;
      let analysis: any = null;
      let scenarios: any[] = [];
      if (projectId) {
        financials = await get(
          `SELECT 
             COUNT(*) as initiative_count,
             SUM(COALESCE(cost_capex, 0)) as total_capex,
             SUM(COALESCE(cost_opex, 0)) as total_opex,
             AVG(COALESCE(expected_roi, 0)) as avg_roi
           FROM initiatives
           WHERE project_id = ? AND status NOT IN ('CANCELLED', 'ARCHIVED')`,
          [projectId]
        );

        analysis = await get(
          `SELECT npv, irr, roi_percentage, payback_months, total_investment, total_benefit
           FROM analysis_financials
           WHERE project_id = ?
           ORDER BY created_at DESC LIMIT 1`,
          [projectId]
        );

        scenarios = await all(
          `SELECT scenario_type, npv, irr, roi_percentage, probability
           FROM analysis_financial_scenarios
           WHERE project_id = ?
           ORDER BY created_at DESC LIMIT 3`,
          [projectId]
        );
      }

      // V8 Finance module live data (org-scoped, not project-scoped)
      let v8Finance: Record<string, unknown> | null = null;
      try {
        const stmtCount = await get(
          `SELECT COUNT(*) as cnt FROM financial_statement_packs WHERE organization_id = ?`,
          [organizationId]
        );
        const modelCount = await get(
          `SELECT COUNT(*) as cnt FROM financial_model_versions WHERE organization_id = ?`,
          [organizationId]
        );
        const activeRun: any = await get(
          `SELECT run_id, current_step, kpi_linkage_status, degraded_json
           FROM v8_finance_lane_runs
           WHERE organization_id = ? AND (current_step != 'readback' OR readback_confirmed = 0)
           ORDER BY created_at DESC LIMIT 1`,
          [organizationId]
        );
        const latestVersion: any = await get(
          `SELECT version_type, is_finalized, created_at FROM v8_finance_version_snapshots
           WHERE organization_id = ? ORDER BY created_at DESC LIMIT 1`,
          [organizationId]
        );
        if ((stmtCount as any)?.cnt || (modelCount as any)?.cnt || activeRun) {
          v8Finance = {
            statementCount: (stmtCount as any)?.cnt || 0,
            modelCount: (modelCount as any)?.cnt || 0,
            activeLane: activeRun
              ? {
                  runId: activeRun.run_id,
                  step: activeRun.current_step,
                  kpiLinkage: activeRun.kpi_linkage_status,
                  degradedCount: (() => {
                    try {
                      return JSON.parse(activeRun.degraded_json || '[]').length;
                    } catch {
                      return 0;
                    }
                  })(),
                }
              : null,
            latestVersion: latestVersion
              ? { type: latestVersion.version_type, finalized: !!latestVersion.is_finalized }
              : null,
          };
        }
      } catch {
        // V8 Finance tables may not exist — non-blocking
      }

      if (!financials?.initiative_count && !analysis && !v8Finance) return null;

      return {
        portfolio: {
          initiativeCount: financials?.initiative_count || 0,
          totalCapex: financials?.total_capex || 0,
          totalOpex: financials?.total_opex || 0,
          avgExpectedRoi: financials?.avg_roi || 0,
        },
        analysis: analysis
          ? {
              npv: analysis.npv,
              irr: analysis.irr,
              roiPercentage: analysis.roi_percentage,
              paybackMonths: analysis.payback_months,
              totalInvestment: analysis.total_investment,
              totalBenefit: analysis.total_benefit,
            }
          : null,
        scenarios: scenarios.map((s: any) => ({
          type: s.scenario_type,
          npv: s.npv,
          irr: s.irr,
          roi: s.roi_percentage,
          probability: s.probability,
        })),
        v8Finance,
      };
    } catch (err: any) {
      logger.warn('[AIContextBuilder] Financial context failed:', err?.message);
      return null;
    }
  },

  /**
   * Layer 9+10: Historical Patterns, RAID Items, Decision Memory
   */
  _buildHistoricalPatternsContext: async (projectId: string | null, organizationId: string) => {
    try {
      const result: any = {};

      // Initiative success patterns (org-wide)
      if (organizationId) {
        const hasEstimatedDurationWeeks = await hasColumn(
          'initiatives',
          'estimated_duration_weeks'
        );
        const avgDurationSql = hasEstimatedDurationWeeks
          ? `AVG(CASE WHEN i.estimated_duration_weeks > 0 THEN i.estimated_duration_weeks ELSE NULL END) as avg_duration_weeks`
          : `NULL::numeric as avg_duration_weeks`;
        const stats: any = await get(
          `SELECT 
             COUNT(*) as total,
             SUM(CASE WHEN i.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
             SUM(CASE WHEN i.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
             ${avgDurationSql}
           FROM initiatives i
           JOIN projects p ON i.project_id = p.id
           WHERE p.organization_id = ?`,
          [organizationId]
        );

        if (stats?.total > 0) {
          result.initiativePatterns = {
            total: stats.total,
            completed: stats.completed || 0,
            cancelled: stats.cancelled || 0,
            successRate:
              stats.total > 0 ? Math.round(((stats.completed || 0) / stats.total) * 100) : 0,
            avgDurationWeeks: Math.round(stats.avg_duration_weeks || 0),
          };
        }
      }

      // Active RAID items for project
      if (projectId) {
        const raidItems = await all(
          `SELECT type, title, status, probability, impact, mitigation_plan
           FROM raid_items
           WHERE project_id = ? AND status IN ('OPEN', 'IN_PROGRESS', 'ACTIVE')
           ORDER BY 
             CASE impact WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END
           LIMIT 10`,
          [projectId]
        );

        if (raidItems.length > 0) {
          result.raidItems = raidItems.map((r: any) => ({
            type: r.type,
            title: r.title,
            status: r.status,
            probability: r.probability,
            impact: r.impact,
            hasMitigation: !!r.mitigation_plan,
          }));
        }
      }

      // Decision outcomes (org-wide learning) – use outcome_notes (actual_outcome may not exist)
      if (organizationId) {
        const decisionOutcomes = await all(
          `SELECT problem_framing, chosen_option, confidence_score, outcome_notes
           FROM ai_decision_outcomes
           WHERE organization_id = ? AND outcome_notes IS NOT NULL
           ORDER BY created_at DESC LIMIT 5`,
          [organizationId]
        ).catch(() => [] as any[]);

        if (decisionOutcomes?.length > 0) {
          result.decisionMemory = decisionOutcomes.map((d: any) => ({
            problem: (d.problem_framing || '').slice(0, 100),
            chosen: (d.chosen_option || '').slice(0, 80),
            confidence: d.confidence_score,
            outcome: d.outcome_notes,
          }));
        }
      }

      return Object.keys(result).length > 0 ? result : null;
    } catch (err: any) {
      logger.warn('[AIContextBuilder] Historical patterns failed:', err?.message);
      return null;
    }
  },

  /**
   * Generate context hash
   */
  _generateHash: (platform: any, organization: any, project: any) => {
    const data = JSON.stringify({
      tenantId: platform?.tenantId,
      organizationId: organization?.organizationId,
      projectId: project?.projectId || null,
      role: platform?.role,
      policyLevel: platform?.policyLevel,
    });
    return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
  },
};

export default AIContextBuilder;
