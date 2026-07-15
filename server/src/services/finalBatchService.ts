/**
 * Final Batch Service
 *
 * V4-IDEA-06: Export mindmap/whiteboard (PDF, outline/markdown, PNG, watermarking)
 * V4-ORG-02: Cohort privacy (min N, suppression, noise/rounding, audit)
 * V4-ORG-03: Framework mappings (SIRI/ADMA/DRD/ISO, percentiles)
 * V4-ORG-04: Pipeline benchmark→gap→initiatives
 * V4-AI-04: Typed actions framework (propose→accept→execute, RBAC, idempotency)
 * V4-AI-08: Domain playbooks (Strategy, Decisions, RAID, Stakeholders, Results)
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';
import { getStorage } from './storage/index.js';

/**
 * M05/wire-m05-export — server-side export used to be a pure stub: `requestExport`
 * only inserted a `pending` row and NOTHING ever called `completeExport` (no worker
 * existed). Per decision #9 / DP-5 the client never surfaces this path unless
 * `VITE_ENABLE_IDEA_SERVER_EXPORT=true`; all genuinely-working exports (PNG/SVG/PDF/
 * Markdown/JSON/…) already run entirely client-side (see IdeaExportMenu.tsx) and do
 * NOT depend on this endpoint.
 *
 * This flag gates a REAL (thin) synchronous generator for the two formats that need
 * no browser-side canvas rendering — `json` and `markdown` — built from the
 * org-scoped `my_idea_maps` graph and written through the existing storage seam
 * (server/src/services/storage). Formats that require rendering a live canvas
 * (png/svg/pdf/package/mapping_report/share_manifest/report/presentation) are NOT
 * fakeable server-side; when requested with the flag on they fail the export row
 * and the route responds 501 rather than pretending to succeed.
 *
 * Default (flag OFF, unset in prod/demo) is UNCHANGED: requestExport just inserts
 * the pending audit row, exactly like before.
 */
const IDEA_SERVER_EXPORT_ENABLED = process.env.IDEA_SERVER_EXPORT_ENABLED === 'true';

/** Formats `generateExportFile` can produce without a browser-rendered canvas. */
const SERVER_GENERATABLE_FORMATS = new Set(['json', 'markdown']);

type IdeaMapRow = { nodes_json?: string | null; edges_json?: string | null };

function safeParseArray(raw: unknown): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildIdeaMarkdown(title: string, nodes: any[], edges: any[], footer: string): string {
  const lines: string[] = [`# ${title || 'Idea Map'}`, ''];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childMap = new Map<string, any[]>();
  for (const edge of edges) {
    const children = childMap.get(edge.source) || [];
    const target = nodeMap.get(edge.target);
    if (target) children.push(target);
    childMap.set(edge.source, children);
  }
  const rootNodes = nodes.filter((n) => !edges.some((e: any) => e.target === n.id));
  const renderNode = (node: any, depth: number) => {
    const label = node.data?.label || node.id;
    const prefix = depth === 0 ? '## ' : '  '.repeat(depth - 1) + '- ';
    lines.push(`${prefix}${label}`);
    for (const child of childMap.get(node.id) || []) renderNode(child, depth + 1);
  };
  if (rootNodes.length > 0) {
    for (const root of rootNodes) renderNode(root, 0);
  } else {
    for (const node of nodes) lines.push(`- ${node.data?.label || node.id}`);
  }
  lines.push('', '---', `*Exported from ${footer} (${new Date().toISOString().slice(0, 10)})*`);
  return lines.join('\n');
}

class FinalBatchService {
  // ── V4-IDEA-06: Export ──

  async requestExport(
    orgId: string,
    data: {
      ideaId: string;
      exportType: string;
      exportFormat: string;
      watermarkText?: string;
      includeMetadata?: boolean;
      requestedBy: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO idea_exports (id, organization_id, idea_id, export_type, export_format, watermark_text, include_metadata, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        orgId,
        data.ideaId,
        data.exportType,
        data.exportFormat,
        data.watermarkText ?? null,
        data.includeMetadata !== false ? 1 : 0,
        data.requestedBy,
      ]
    );
    return { id };
  }

  /**
   * Entry point used by the route: creates the audit row (unchanged behavior),
   * then — ONLY when IDEA_SERVER_EXPORT_ENABLED is true — attempts real
   * generation for server-generatable formats. Flag OFF returns exactly the
   * legacy `{ id }` stub shape.
   */
  async requestAndGenerateExport(
    orgId: string,
    data: {
      ideaId: string;
      exportType: string;
      exportFormat: string;
      watermarkText?: string;
      includeMetadata?: boolean;
      requestedBy: string;
    }
  ): Promise<
    | { id: string; status: 'pending' }
    | { id: string; status: 'completed'; fileUrl: string; fileSizeBytes: number }
    | { id: string; status: 'failed'; reason: 'unsupported_format' | 'idea_not_found'; message: string }
  > {
    const { id } = await this.requestExport(orgId, data);

    if (!IDEA_SERVER_EXPORT_ENABLED) {
      return { id, status: 'pending' };
    }

    if (!SERVER_GENERATABLE_FORMATS.has(data.exportFormat)) {
      const message = `Server-side export not implemented for format "${data.exportFormat}" — it requires client-side canvas rendering. Use the in-app export (PNG/SVG/PDF/…) instead.`;
      await this.failExport(id, message);
      return { id, status: 'failed', reason: 'unsupported_format', message };
    }

    try {
      const generated = await this.generateExportFile(orgId, data.ideaId, data.exportFormat, {
        watermarkText: data.watermarkText,
      });
      if (!generated) {
        const message = 'Idea map not found for this organization';
        await this.failExport(id, message);
        return { id, status: 'failed', reason: 'idea_not_found', message };
      }
      await this.completeExport(id, {
        fileUrl: generated.fileUrl,
        fileSizeBytes: generated.fileSizeBytes,
      });
      return {
        id,
        status: 'completed',
        fileUrl: generated.fileUrl,
        fileSizeBytes: generated.fileSizeBytes,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export generation failed';
      await this.failExport(id, message);
      throw err;
    }
  }

  /**
   * Real generation for `json`/`markdown`: reads the org-scoped canonical
   * `my_idea_maps` graph, renders the file, and writes it through the storage
   * seam (local disk in dev, S3/R2 when STORAGE_PROVIDER=s3). Returns null if
   * the idea/map doesn't exist in this org (never reaches across orgs).
   */
  private async generateExportFile(
    orgId: string,
    ideaId: string,
    exportFormat: string,
    opts: { watermarkText?: string }
  ): Promise<{ fileUrl: string; fileSizeBytes: number } | null> {
    const idea = await queryHelpers.queryFirst<{ title: string }>(
      `SELECT title FROM my_ideas WHERE id=$1 AND organization_id=$2`,
      [ideaId, orgId]
    );
    if (!idea) return null;

    const map = await queryHelpers.queryFirst<IdeaMapRow>(
      `SELECT nodes_json, edges_json FROM my_idea_maps WHERE idea_id=$1 AND organization_id=$2 AND is_canonical=TRUE LIMIT 1`,
      [ideaId, orgId]
    );
    const nodes = safeParseArray(map?.nodes_json);
    const edges = safeParseArray(map?.edges_json);
    const footer = opts.watermarkText || 'Consultify Idea Workspace';

    let body: string;
    let contentType: string;
    let ext: string;
    if (exportFormat === 'markdown') {
      body = buildIdeaMarkdown(idea.title, nodes, edges, footer);
      contentType = 'text/markdown';
      ext = 'md';
    } else {
      body = JSON.stringify(
        {
          id: ideaId,
          title: idea.title,
          exportedAt: new Date().toISOString(),
          nodes,
          edges,
          watermark: footer,
        },
        null,
        2
      );
      contentType = 'application/json';
      ext = 'json';
    }

    const buffer = Buffer.from(body, 'utf-8');
    const key = `idea-exports/${orgId}/${ideaId}-${uuidv4()}.${ext}`;
    const storage = getStorage();
    await storage.putObject({ key, body: buffer, contentType });
    const fileUrl = await storage.getUrl(key);
    return { fileUrl, fileSizeBytes: buffer.length };
  }

  async getExports(orgId: string, ideaId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM idea_exports WHERE organization_id=$1 AND idea_id=$2 ORDER BY created_at DESC`,
      [orgId, ideaId]
    );
  }

  async completeExport(exportId: string, data: { fileUrl: string; fileSizeBytes?: number }) {
    await queryHelpers.queryRun(
      `UPDATE idea_exports SET status='completed', file_url=$1, file_size_bytes=$2, completed_at=CURRENT_TIMESTAMP WHERE id=$3`,
      [data.fileUrl, data.fileSizeBytes ?? null, exportId]
    );
    return { ok: true };
  }

  async failExport(exportId: string, errorMessage: string) {
    await queryHelpers.queryRun(
      `UPDATE idea_exports SET status='failed', error_message=$1 WHERE id=$2`,
      [errorMessage, exportId]
    );
    return { ok: true };
  }

  // ── V4-ORG-02: Cohort Privacy ──

  async getCohortPolicy(orgId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM benchmark_cohort_policies WHERE organization_id=$1`,
      [orgId]
    );
  }

  async upsertCohortPolicy(
    orgId: string,
    data: {
      minCohortSize?: number;
      suppressionEnabled?: boolean;
      noiseMethod?: string;
      noiseMagnitude?: number;
      auditAllQueries?: boolean;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO benchmark_cohort_policies (id, organization_id, min_cohort_size, suppression_enabled, noise_method, noise_magnitude, audit_all_queries)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (organization_id)
       DO UPDATE SET min_cohort_size=$3, suppression_enabled=$4, noise_method=$5, noise_magnitude=$6, audit_all_queries=$7, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        data.minCohortSize ?? 5,
        data.suppressionEnabled !== false ? 1 : 0,
        data.noiseMethod ?? 'rounding',
        data.noiseMagnitude ?? 0.05,
        data.auditAllQueries !== false ? 1 : 0,
      ]
    );
    return { ok: true };
  }

  async applyCohortPrivacy(
    orgId: string,
    queryResult: { value: number; cohortSize: number },
    userId: string,
    queryType: string,
    queryParams?: object
  ) {
    const policy = await this.getCohortPolicy(orgId);
    const minN = (policy as any)?.min_cohort_size ?? 5;
    const suppressed = queryResult.cohortSize < minN;
    let finalValue = queryResult.value;
    let noiseApplied = false;

    if (!suppressed && policy) {
      const method = (policy as any).noise_method;
      const magnitude = (policy as any).noise_magnitude ?? 0.05;
      if (method === 'rounding') {
        const factor = Math.pow(10, Math.round(-Math.log10(magnitude)));
        finalValue = Math.round(finalValue * factor) / factor;
        noiseApplied = true;
      } else if (method === 'noise') {
        finalValue += (Math.random() - 0.5) * 2 * magnitude * finalValue;
        noiseApplied = true;
      }
    }

    if ((policy as any)?.audit_all_queries) {
      const auditId = uuidv4();
      await queryHelpers.queryRun(
        `INSERT INTO benchmark_query_audit (id, organization_id, user_id, query_type, query_params, cohort_size, suppressed, noise_applied)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          auditId,
          orgId,
          userId,
          queryType,
          JSON.stringify(queryParams ?? {}),
          queryResult.cohortSize,
          suppressed ? 1 : 0,
          noiseApplied ? 1 : 0,
        ]
      );
    }

    return {
      value: suppressed ? null : finalValue,
      suppressed,
      noiseApplied,
      cohortSize: queryResult.cohortSize,
    };
  }

  async getQueryAudit(orgId: string, limit: number = 100) {
    return queryHelpers.queryAll(
      `SELECT * FROM benchmark_query_audit WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [orgId, limit]
    );
  }

  // ── V4-ORG-03: Framework Mappings ──

  async upsertFrameworkMapping(data: {
    frameworkKey: string;
    frameworkName: string;
    version?: string;
    dimensionKey: string;
    dimensionName: string;
    percentileP25?: number;
    percentileP50?: number;
    percentileP75?: number;
    percentileP90?: number;
    whatGoodLooksLike?: string;
    dataSource?: string;
  }) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO benchmark_framework_mappings (id, framework_key, framework_name, version, dimension_key, dimension_name, percentile_p25, percentile_p50, percentile_p75, percentile_p90, what_good_looks_like, data_source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (framework_key, dimension_key)
       DO UPDATE SET framework_name=$3, version=$4, dimension_name=$6, percentile_p25=$7, percentile_p50=$8, percentile_p75=$9, percentile_p90=$10, what_good_looks_like=$11, data_source=$12, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        data.frameworkKey,
        data.frameworkName,
        data.version ?? null,
        data.dimensionKey,
        data.dimensionName,
        data.percentileP25 ?? null,
        data.percentileP50 ?? null,
        data.percentileP75 ?? null,
        data.percentileP90 ?? null,
        data.whatGoodLooksLike ?? null,
        data.dataSource ?? null,
      ]
    );
    return { id };
  }

  async getFrameworkMappings(frameworkKey?: string) {
    const sql = frameworkKey
      ? `SELECT * FROM benchmark_framework_mappings WHERE framework_key=$1 ORDER BY dimension_key`
      : `SELECT * FROM benchmark_framework_mappings ORDER BY framework_key, dimension_key`;
    return queryHelpers.queryAll(sql, frameworkKey ? [frameworkKey] : []);
  }

  async getFrameworks() {
    return queryHelpers.queryAll(
      `SELECT DISTINCT framework_key, framework_name, version FROM benchmark_framework_mappings ORDER BY framework_name`,
      []
    );
  }

  // ── V4-ORG-04: Benchmark→Gap→Initiatives Pipeline ──

  async createGapAnalysis(
    orgId: string,
    data: {
      frameworkKey: string;
      assessmentId?: string;
      gaps?: object[];
      recommendations?: object[];
      createdBy: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO benchmark_gap_analyses (id, organization_id, framework_key, assessment_id, gaps_json, recommendations_json, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        orgId,
        data.frameworkKey,
        data.assessmentId ?? null,
        JSON.stringify(data.gaps ?? []),
        JSON.stringify(data.recommendations ?? []),
        data.createdBy,
      ]
    );
    return { id };
  }

  async getGapAnalyses(orgId: string, frameworkKey?: string) {
    const sql = frameworkKey
      ? `SELECT * FROM benchmark_gap_analyses WHERE organization_id=$1 AND framework_key=$2 ORDER BY created_at DESC`
      : `SELECT * FROM benchmark_gap_analyses WHERE organization_id=$1 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, frameworkKey ? [orgId, frameworkKey] : [orgId]);
  }

  async linkGapToInitiative(gapAnalysisId: string, dimensionKey: string, initiativeId: string) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO benchmark_gap_initiative_links (id, gap_analysis_id, gap_dimension_key, initiative_id)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (gap_analysis_id, gap_dimension_key, initiative_id) DO NOTHING`,
      [id, gapAnalysisId, dimensionKey, initiativeId]
    );
    return { id };
  }

  async getGapInitiativeLinks(gapAnalysisId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM benchmark_gap_initiative_links WHERE gap_analysis_id=$1 ORDER BY gap_dimension_key`,
      [gapAnalysisId]
    );
  }

  async updateGapAnalysisStatus(
    gapAnalysisId: string,
    status: string,
    autoInitiativesCreated?: number
  ) {
    const sets = [`status=$1`, `updated_at=CURRENT_TIMESTAMP`];
    const params: unknown[] = [status];
    if (autoInitiativesCreated !== undefined) {
      sets.push(`auto_initiatives_created=$2`);
      params.push(autoInitiativesCreated);
    }
    params.push(gapAnalysisId);
    await queryHelpers.queryRun(
      `UPDATE benchmark_gap_analyses SET ${sets.join(', ')} WHERE id=$${params.length}`,
      params
    );
    return { ok: true };
  }

  // ── V4-AI-04: Typed Actions ──

  async proposeAction(
    orgId: string,
    data: {
      actionType: string;
      targetEntityType: string;
      targetEntityId?: string;
      proposedChanges: object;
      previewDiff?: string;
      rbacRequiredRole?: string;
      idempotencyKey?: string;
      proposedBy: string;
    }
  ) {
    if (data.idempotencyKey) {
      const existing = await queryHelpers.queryFirst<{ id: string }>(
        `SELECT id FROM ai_typed_actions WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1`,
        [orgId, data.idempotencyKey]
      );
      if (existing?.id) {
        return { id: existing.id, reused: true };
      }
    }

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO ai_typed_actions (id, organization_id, action_type, target_entity_type, target_entity_id, proposed_changes, preview_diff, rbac_required_role, idempotency_key, proposed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        orgId,
        data.actionType,
        data.targetEntityType,
        data.targetEntityId ?? null,
        JSON.stringify(data.proposedChanges),
        data.previewDiff ?? null,
        data.rbacRequiredRole ?? null,
        data.idempotencyKey ?? null,
        data.proposedBy,
      ]
    );
    return { id, reused: false };
  }

  async getProposedActions(orgId: string, status?: string) {
    const sql = status
      ? `SELECT * FROM ai_typed_actions WHERE organization_id=$1 AND status=$2 ORDER BY created_at DESC`
      : `SELECT * FROM ai_typed_actions WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`;
    return queryHelpers.queryAll(sql, status ? [orgId, status] : [orgId]);
  }

  async acceptAction(orgId: string, actionId: string, acceptedBy: string, actorRole?: string) {
    const action = await this.getAction(orgId, actionId);
    if (!action) return { ok: false, reason: 'not_found' };
    if ((action as any).status !== 'proposed') return { ok: false, reason: 'invalid_state' };

    const requiredRole = (action as any).rbac_required_role as string | undefined;
    if (!this.hasRequiredRole(actorRole, requiredRole)) {
      return { ok: false, reason: 'insufficient_role', requiredRole };
    }

    const result = await queryHelpers.queryRun(
      `UPDATE ai_typed_actions
       SET status='accepted', accepted_by=$1
       WHERE id=$2 AND organization_id=$3 AND status='proposed'`,
      [acceptedBy, actionId, orgId]
    );
    return { ok: result.changes > 0 };
  }

  async executeAction(orgId: string, actionId: string, result?: object) {
    const updateResult = await queryHelpers.queryRun(
      `UPDATE ai_typed_actions
       SET status='executed', executed_at=CURRENT_TIMESTAMP, execution_result=$1
       WHERE id=$2 AND organization_id=$3 AND status='accepted'`,
      [result ? JSON.stringify(result) : null, actionId, orgId]
    );
    return { ok: updateResult.changes > 0 };
  }

  async rejectAction(orgId: string, actionId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE ai_typed_actions
       SET status='rejected'
       WHERE id=$1 AND organization_id=$2 AND status='proposed'`,
      [actionId, orgId]
    );
    return { ok: result.changes > 0 };
  }

  async getAction(orgId: string, actionId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM ai_typed_actions WHERE id=$1 AND organization_id=$2`,
      [actionId, orgId]
    );
  }

  // ── V4-AI-08: Domain Playbooks ──

  async createPlaybook(
    orgId: string | null,
    data: {
      domain: string;
      playbookName: string;
      description?: string;
      systemPrompt: string;
      exampleQueries?: string[];
      requiredContext?: string[];
      outputSchema?: object;
      isSystem?: boolean;
      createdBy?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO ai_domain_playbooks (id, organization_id, domain, playbook_name, description, system_prompt, example_queries, required_context, output_schema, is_system, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        orgId,
        data.domain,
        data.playbookName,
        data.description ?? null,
        data.systemPrompt,
        JSON.stringify(data.exampleQueries ?? []),
        JSON.stringify(data.requiredContext ?? []),
        JSON.stringify(data.outputSchema ?? {}),
        data.isSystem ? 1 : 0,
        data.createdBy ?? null,
      ]
    );
    return { id };
  }

  async getPlaybooks(domain?: string, orgId?: string) {
    if (domain && orgId) {
      return queryHelpers.queryAll(
        `SELECT * FROM ai_domain_playbooks WHERE domain=$1 AND (organization_id=$2 OR organization_id IS NULL OR is_system=1) ORDER BY is_system DESC, playbook_name`,
        [domain, orgId]
      );
    }
    if (domain) {
      return queryHelpers.queryAll(
        `SELECT * FROM ai_domain_playbooks WHERE domain=$1 ORDER BY playbook_name`,
        [domain]
      );
    }
    return queryHelpers.queryAll(
      `SELECT * FROM ai_domain_playbooks ORDER BY domain, playbook_name`,
      []
    );
  }

  async getPlaybook(playbookId: string) {
    return queryHelpers.queryFirst(`SELECT * FROM ai_domain_playbooks WHERE id=$1`, [playbookId]);
  }

  async updatePlaybook(
    playbookId: string,
    data: Partial<{
      playbookName: string;
      description: string;
      systemPrompt: string;
      exampleQueries: string[];
      requiredContext: string[];
      outputSchema: object;
    }>
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.playbookName !== undefined) {
      sets.push(`playbook_name=$${idx++}`);
      params.push(data.playbookName);
    }
    if (data.description !== undefined) {
      sets.push(`description=$${idx++}`);
      params.push(data.description);
    }
    if (data.systemPrompt !== undefined) {
      sets.push(`system_prompt=$${idx++}`);
      params.push(data.systemPrompt);
    }
    if (data.exampleQueries !== undefined) {
      sets.push(`example_queries=$${idx++}`);
      params.push(JSON.stringify(data.exampleQueries));
    }
    if (data.requiredContext !== undefined) {
      sets.push(`required_context=$${idx++}`);
      params.push(JSON.stringify(data.requiredContext));
    }
    if (data.outputSchema !== undefined) {
      sets.push(`output_schema=$${idx++}`);
      params.push(JSON.stringify(data.outputSchema));
    }

    if (sets.length === 0) return { ok: true };
    sets.push(`version=version+1`);
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(playbookId);
    await queryHelpers.queryRun(
      `UPDATE ai_domain_playbooks SET ${sets.join(', ')} WHERE id=$${idx}`,
      params
    );
    return { ok: true };
  }

  async executePlaybook(
    orgId: string,
    data: {
      playbookId: string;
      userId: string;
      inputContext?: object;
      outputResult?: object;
      citations?: string[];
      confidence?: number;
      durationMs?: number;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO ai_playbook_executions (id, playbook_id, organization_id, user_id, input_context, output_result, citations, confidence, duration_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        id,
        data.playbookId,
        orgId,
        data.userId,
        JSON.stringify(data.inputContext ?? {}),
        JSON.stringify(data.outputResult ?? {}),
        JSON.stringify(data.citations ?? []),
        data.confidence ?? null,
        data.durationMs ?? null,
      ]
    );
    return { id };
  }

  async getPlaybookExecutions(playbookId: string, limit: number = 50) {
    return queryHelpers.queryAll(
      `SELECT * FROM ai_playbook_executions WHERE playbook_id=$1 ORDER BY created_at DESC LIMIT $2`,
      [playbookId, limit]
    );
  }

  private hasRequiredRole(actorRole?: string, requiredRole?: string): boolean {
    if (!requiredRole) return true;
    return this.roleRank(actorRole) >= this.roleRank(requiredRole);
  }

  private roleRank(role?: string): number {
    const normalized = String(role || 'VIEWER')
      .trim()
      .toUpperCase();
    switch (normalized) {
      case 'SUPERADMIN':
      case 'SUPER_ADMIN':
      case 'OWNER':
        return 5;
      case 'ADMIN':
      case 'ADMINISTRATOR':
        return 4;
      case 'PROJECT_MANAGER':
      case 'MANAGER':
        return 3;
      case 'TEAM_MEMBER':
      case 'MEMBER':
      case 'USER':
        return 2;
      case 'VIEWER':
      case 'GUEST':
      case 'CLIENT':
      default:
        return 1;
    }
  }
}

export const finalBatchService = new FinalBatchService();
