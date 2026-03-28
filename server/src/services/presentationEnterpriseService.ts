/**
 * Presentation Enterprise Service (V4-DECK-02 through V4-DECK-07)
 *
 * V4-DECK-02: Refresh engine (artifact bindings, diff preview, approval)
 * V4-DECK-03: Layout rules (auto-layout guardrails, export QA, regression)
 * V4-DECK-04: Template governance (variables, versioning, consulting packs)
 * V4-DECK-05: PPTX import (slide mapping, round-trip)
 * V4-DECK-06: Realtime collaboration (presence, cursors, heartbeat)
 * V4-DECK-07: Media library governance (rights, entitlements, watermarking)
 */

import { v4 as uuidv4 } from 'uuid';

import * as queryHelpers from '../utils/queryHelpers.js';

// ============================================================
// Service
// ============================================================

class PresentationEnterpriseService {
  // ── V4-DECK-02: Data bindings + refresh ──

  async createBinding(
    orgId: string,
    data: {
      deckId: string;
      slideIndex: number;
      blockId?: string;
      bindingType?: string;
      artifactType?: string;
      artifactId?: string;
      datasetRef?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_data_bindings (id, organization_id, deck_id, slide_index, block_id, binding_type, artifact_type, artifact_id, dataset_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.deckId,
        data.slideIndex,
        data.blockId || null,
        data.bindingType || 'artifact',
        data.artifactType || null,
        data.artifactId || null,
        data.datasetRef || null,
      ]
    );
    return { id };
  }

  async getBindings(orgId: string, deckId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_data_bindings WHERE organization_id = ? AND deck_id = ? ORDER BY slide_index, created_at`,
        [orgId, deckId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      deckId: r.deck_id,
      slideIndex: r.slide_index,
      blockId: r.block_id,
      bindingType: r.binding_type,
      artifactType: r.artifact_type,
      artifactId: r.artifact_id,
      datasetRef: r.dataset_ref,
      lastRefreshAt: r.last_refresh_at,
      diffPreview: safeJson(r.diff_preview),
      approvalStatus: r.approval_status,
    }));
  }

  async refreshBinding(orgId: string, bindingId: string, newValueHash: string) {
    const current = await queryHelpers.queryOne<any>(
      `SELECT last_value_hash FROM deck_data_bindings WHERE id = ? AND organization_id = ?`,
      [bindingId, orgId]
    );
    if (!current) return false;
    const changed = current.last_value_hash !== newValueHash;
    const diff = { changed, previousHash: current.last_value_hash, currentHash: newValueHash };
    await queryHelpers.queryRun(
      `UPDATE deck_data_bindings SET last_value_hash = ?, diff_preview = ?, last_refresh_at = ?,
       approval_status = CASE WHEN ? = 1 THEN 'pending' ELSE approval_status END
       WHERE id = ? AND organization_id = ?`,
      [
        newValueHash,
        JSON.stringify(diff),
        new Date().toISOString(),
        changed ? 1 : 0,
        bindingId,
        orgId,
      ]
    );
    return true;
  }

  async approveBinding(orgId: string, bindingId: string, userId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE deck_data_bindings SET approval_status = 'approved', approved_by = ?, approved_at = ? WHERE id = ? AND organization_id = ?`,
      [userId, new Date().toISOString(), bindingId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  // ── V4-DECK-03: Layout rules + export QA ──

  async createLayoutRule(
    orgId: string | null,
    data: {
      ruleName: string;
      ruleType?: string;
      config: Record<string, unknown>;
      isGlobal?: boolean;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_layout_rules (id, organization_id, rule_name, rule_type, config, is_global) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.ruleName,
        data.ruleType || 'spacing',
        JSON.stringify(data.config),
        data.isGlobal ? 1 : 0,
      ]
    );
    return { id };
  }

  async getLayoutRules(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_layout_rules WHERE organization_id = ? OR is_global = 1 ORDER BY created_at`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      ruleName: r.rule_name,
      ruleType: r.rule_type,
      config: safeJson(r.config),
      isGlobal: !!r.is_global,
    }));
  }

  async createExportQA(
    orgId: string,
    data: {
      deckId: string;
      exportFormat?: string;
      fidelityScore: number;
      issues?: unknown[];
      passed: boolean;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_export_qa_results (id, organization_id, deck_id, export_format, fidelity_score, issues, passed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.deckId,
        data.exportFormat || 'pptx',
        data.fidelityScore,
        JSON.stringify(data.issues || []),
        data.passed ? 1 : 0,
      ]
    );
    return { id, passed: data.passed, fidelityScore: data.fidelityScore };
  }

  async getExportQAResults(orgId: string, deckId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_export_qa_results WHERE organization_id = ? AND deck_id = ? ORDER BY created_at DESC`,
        [orgId, deckId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      exportFormat: r.export_format,
      fidelityScore: r.fidelity_score,
      issues: safeJsonArray(r.issues),
      passed: !!r.passed,
      createdAt: r.created_at,
    }));
  }

  // ── V4-DECK-04: Template governance ──

  async createTemplateGovernance(
    orgId: string,
    userId: string,
    data: {
      templateId: string;
      name: string;
      description?: string;
      category?: string;
      variables?: unknown[];
      governanceLevel?: string;
      consultingPackType?: string;
    }
  ) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO deck_template_governance (id, organization_id, template_id, name, description, category, variables, governance_level, consulting_pack_type, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.templateId,
        data.name,
        data.description || null,
        data.category || 'general',
        JSON.stringify(data.variables || []),
        data.governanceLevel || 'org',
        data.consultingPackType || null,
        userId,
        now,
        now,
      ]
    );
    return { id, name: data.name, version: 1, status: 'draft' };
  }

  async publishTemplateVersion(orgId: string, governanceId: string, userId: string) {
    const gov = await queryHelpers.queryOne<any>(
      `SELECT * FROM deck_template_governance WHERE id = ? AND organization_id = ?`,
      [governanceId, orgId]
    );
    if (!gov) return false;
    await queryHelpers.queryRun(
      `INSERT INTO deck_template_versions (id, governance_id, version, template_snapshot, variables, created_by)
       VALUES (?, ?, ?, '{}', ?, ?)`,
      [uuidv4(), governanceId, gov.version, gov.variables || '[]', userId]
    );
    await queryHelpers.queryRun(
      `UPDATE deck_template_governance SET version = version + 1, status = 'published', updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), governanceId]
    );
    return true;
  }

  async getTemplateGovernance(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_template_governance WHERE organization_id = ? OR organization_id IS NULL ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      templateId: r.template_id,
      name: r.name,
      description: r.description,
      category: r.category,
      variables: safeJsonArray(r.variables),
      version: r.version,
      status: r.status,
      governanceLevel: r.governance_level,
      consultingPackType: r.consulting_pack_type,
    }));
  }

  // ── V4-DECK-05: PPTX import ──

  async createPPTXImport(
    orgId: string,
    userId: string,
    data: {
      originalFilename: string;
      fileSizeBytes?: number;
      slideCount?: number;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_pptx_imports (id, organization_id, original_filename, file_size_bytes, slide_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orgId, data.originalFilename, data.fileSizeBytes || 0, data.slideCount || 0, userId]
    );
    return { id, status: 'pending' };
  }

  async updatePPTXImport(
    orgId: string,
    importId: string,
    data: {
      deckId?: string;
      mappingData?: unknown[];
      status: string;
      warnings?: unknown[];
    }
  ) {
    const updates: string[] = ['import_status = ?'];
    const params: unknown[] = [data.status];
    if (data.deckId) {
      updates.push('deck_id = ?');
      params.push(data.deckId);
    }
    if (data.mappingData) {
      updates.push('mapping_data = ?');
      params.push(JSON.stringify(data.mappingData));
    }
    if (data.warnings) {
      updates.push('import_warnings = ?');
      params.push(JSON.stringify(data.warnings));
    }
    if (data.status === 'completed') {
      updates.push('completed_at = ?');
      params.push(new Date().toISOString());
    }
    params.push(importId, orgId);
    await queryHelpers.queryRun(
      `UPDATE deck_pptx_imports SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return true;
  }

  async getPPTXImports(orgId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_pptx_imports WHERE organization_id = ? ORDER BY created_at DESC`,
        [orgId]
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      deckId: r.deck_id,
      originalFilename: r.original_filename,
      slideCount: r.slide_count,
      mappingData: safeJsonArray(r.mapping_data),
      status: r.import_status,
      warnings: safeJsonArray(r.import_warnings),
      createdAt: r.created_at,
    }));
  }

  // ── V4-DECK-06: Realtime collaboration ──

  async joinCollabSession(orgId: string, deckId: string, userId: string) {
    const id = uuidv4();
    const now = new Date().toISOString();
    await queryHelpers.queryRun(
      `INSERT INTO deck_collab_sessions (id, organization_id, deck_id, user_id, connected_at, last_heartbeat_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, orgId, deckId, userId, now, now]
    );
    return { sessionId: id };
  }

  async updatePresence(
    orgId: string,
    sessionId: string,
    data: { cursorPosition?: Record<string, unknown>; activeSlideIndex?: number }
  ) {
    const updates: string[] = ['last_heartbeat_at = ?'];
    const params: unknown[] = [new Date().toISOString()];
    if (data.cursorPosition) {
      updates.push('cursor_position = ?');
      params.push(JSON.stringify(data.cursorPosition));
    }
    if (data.activeSlideIndex !== undefined) {
      updates.push('active_slide_index = ?');
      params.push(data.activeSlideIndex);
    }
    params.push(sessionId, orgId);
    await queryHelpers.queryRun(
      `UPDATE deck_collab_sessions SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`,
      params
    );
    return true;
  }

  async leaveCollabSession(orgId: string, sessionId: string) {
    await queryHelpers.queryRun(
      `UPDATE deck_collab_sessions SET is_active = 0, disconnected_at = ? WHERE id = ? AND organization_id = ?`,
      [new Date().toISOString(), sessionId, orgId]
    );
    return true;
  }

  async getActiveCollaborators(orgId: string, deckId: string) {
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT cs.*, u.first_name, u.last_name FROM deck_collab_sessions cs
       LEFT JOIN users u ON u.id = cs.user_id
       WHERE cs.organization_id = ? AND cs.deck_id = ? AND cs.is_active = 1
       ORDER BY cs.connected_at`,
        [orgId, deckId]
      )) || [];
    return rows.map((r: any) => ({
      sessionId: r.id,
      userId: r.user_id,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      cursorPosition: safeJson(r.cursor_position),
      activeSlideIndex: r.active_slide_index,
      lastHeartbeatAt: r.last_heartbeat_at,
    }));
  }

  // ── V4-DECK-07: Media library governance ──

  async addMedia(
    orgId: string,
    userId: string,
    data: {
      filename: string;
      mimeType: string;
      fileSizeBytes?: number;
      storageUrl?: string;
      rightsStatus?: string;
      licenseType?: string;
      licenseExpiry?: string;
      entitlementScope?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_media_library (id, organization_id, filename, mime_type, file_size_bytes, storage_url, rights_status, license_type, license_expiry, entitlement_scope, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.filename,
        data.mimeType,
        data.fileSizeBytes || 0,
        data.storageUrl || null,
        data.rightsStatus || 'unknown',
        data.licenseType || null,
        data.licenseExpiry || null,
        data.entitlementScope || 'org',
        userId,
      ]
    );
    return { id };
  }

  async getMediaLibrary(orgId: string, rightsFilter?: string) {
    const conditions = ['organization_id = ?'];
    const params: unknown[] = [orgId];
    if (rightsFilter) {
      conditions.push('rights_status = ?');
      params.push(rightsFilter);
    }
    const rows =
      (await queryHelpers.queryAll<any>(
        `SELECT * FROM deck_media_library WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
        params
      )) || [];
    return rows.map((r: any) => ({
      id: r.id,
      filename: r.filename,
      mimeType: r.mime_type,
      fileSizeBytes: r.file_size_bytes,
      storageUrl: r.storage_url,
      rightsStatus: r.rights_status,
      licenseType: r.license_type,
      licenseExpiry: r.license_expiry,
      entitlementScope: r.entitlement_scope,
      watermarkApplied: !!r.watermark_applied,
      uploadedBy: r.uploaded_by,
    }));
  }

  async applyWatermark(orgId: string, mediaId: string) {
    const result = await queryHelpers.queryRun(
      `UPDATE deck_media_library SET watermark_applied = 1 WHERE id = ? AND organization_id = ?`,
      [mediaId, orgId]
    );
    return (result?.changes || 0) > 0;
  }

  async logMediaUsage(
    orgId: string,
    data: { mediaId: string; deckId: string; slideIndex?: number; actorId: string; action?: string }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO deck_media_usage_log (id, organization_id, media_id, deck_id, slide_index, action, actor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orgId,
        data.mediaId,
        data.deckId,
        data.slideIndex ?? null,
        data.action || 'inserted',
        data.actorId,
      ]
    );
    return { id };
  }
}

function safeJson(val: unknown): Record<string, unknown> {
  if (!val) return {};
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as Record<string, unknown>);
  } catch {
    return {};
  }
}
function safeJsonArray(val: unknown): unknown[] {
  if (!val) return [];
  try {
    return typeof val === 'string' ? JSON.parse(val) : (val as unknown[]);
  } catch {
    return [];
  }
}

const presentationEnterpriseService = new PresentationEnterpriseService();
export default presentationEnterpriseService;
export { PresentationEnterpriseService, presentationEnterpriseService };
