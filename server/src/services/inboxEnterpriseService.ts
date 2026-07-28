/**
 * Inbox Enterprise Service
 *
 * V4-INBX-02: Focus board (capacity-aware planning, rules, shared templates)
 * V4-INBX-03: AI triage (confidence score, threshold, undo)
 * V4-INBX-05: Inbox table + preview pane (App Table Standard)
 * V4-INBX-06: Connectors (email→inbox, Slack/Teams webhooks→inbox, routing rules)
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

/**
 * Realne liczniki stanów Skrzynki (MVP 2026-07-28).
 *
 * PRZEDTEM: `counts: { open: total, done: 0, saved: 0, dismissed: 0 }` — wpisane na
 * sztywno. Skutek widoczny na ekranie: chip `ALL 497` i chip `Open 497` pokazywały
 * TĘ SAMĄ liczbę (bo `open` był po prostu `total`), a `Saved` renderował się dwa
 * razy i zawsze jako 0.
 *
 * Stany w bazie demo: `pending` (703), `triaged` (1), `resolved` (1).
 * Mapowanie: otwarte = wszystko poza rozstrzygniętym/odrzuconym.
 * `saved`/`dismissed` zostają 0 UCZCIWIE — w danych nie ma takiego stanu; lepiej
 * pokazać prawdziwe zero niż zmyśloną liczbę.
 */
function liczStany(
  wiersze: Array<{ stan: string; n: number }> | null | undefined,
  total: number
): { open: number; done: number; saved: number; dismissed: number } {
  const wg = new Map<string, number>();
  for (const w of wiersze || []) wg.set(String(w?.stan || ''), Number(w?.n) || 0);
  const suma = (...klucze: string[]) => klucze.reduce((acc, k) => acc + (wg.get(k) || 0), 0);

  const done = suma('resolved', 'done', 'completed');
  const dismissed = suma('dismissed', 'rejected');
  const saved = suma('saved', 'snoozed');
  // Brak wierszy stanu (np. starsza baza) → nie zgadujemy, wracamy do `total`.
  const open = wg.size === 0 ? total : Math.max(0, total - done - dismissed);
  return { open, done, saved, dismissed };
}

class InboxEnterpriseService {
  // ── V4-INBX-06: Connectors + Routing ──

  async ingestConnectorItem(
    orgId: string,
    data: {
      sourceChannel: string;
      sourceId?: string;
      payloadJson?: string;
      targetUserId?: string;
      senderEmail?: string;
      senderName?: string;
      subject?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO inbox_connector_items (id, organization_id, source_channel, source_id, payload_json, target_user_id, sender_email, sender_name, subject, received_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)`,
      [
        id,
        orgId,
        data.sourceChannel,
        data.sourceId ?? null,
        data.payloadJson ?? null,
        data.targetUserId ?? null,
        data.senderEmail ?? null,
        data.senderName ?? null,
        data.subject ?? null,
      ]
    );
    return { id };
  }

  async routeConnectorItem(orgId: string, itemId: string) {
    const item = await queryHelpers.queryFirst<{
      source_channel: string;
      payload_json: string;
      target_user_id: string;
    }>(`SELECT * FROM inbox_connector_items WHERE id=$1 AND organization_id=$2`, [itemId, orgId]);
    if (!item) return { routed: false, reason: 'item_not_found' };

    const rules = await queryHelpers.queryAll<{
      id: string;
      conditions_json: string;
      target_user_id: string;
      action_type: string;
      action_config: string;
    }>(
      `SELECT * FROM inbox_routing_rules WHERE organization_id=$1 AND channel=$2 AND is_active=1 ORDER BY priority DESC`,
      [orgId, item.source_channel]
    );

    for (const rule of rules) {
      const conditions = JSON.parse(rule.conditions_json || '{}');
      if (this.matchesConditions(item, conditions)) {
        const targetUser = rule.target_user_id || item.target_user_id;
        if (targetUser) {
          const inboxItemId = uuidv4();
          await queryHelpers.queryRun(
            `INSERT INTO canonical_inbox_items (id, user_id, organization_id, item_type, source_entity_type, source_entity_id, title, priority, section, status)
             VALUES ($1,$2,$3,'signal','connector',$4,$5,'normal','inbox','pending')
             ON CONFLICT (user_id, source_entity_type, source_entity_id) DO NOTHING`,
            [inboxItemId, targetUser, orgId, itemId, (item as any).subject || 'Connector item']
          );
          await queryHelpers.queryRun(
            `UPDATE inbox_connector_items SET status='routed', routed_by_rule_id=$1, canonical_inbox_item_id=$2 WHERE id=$3`,
            [rule.id, inboxItemId, itemId]
          );
          return { routed: true, ruleId: rule.id, targetUserId: targetUser, inboxItemId };
        }
      }
    }
    return { routed: false, reason: 'no_matching_rule' };
  }

  private matchesConditions(item: any, conditions: Record<string, unknown>): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;
    for (const [key, value] of Object.entries(conditions)) {
      if (item[key] !== value) return false;
    }
    return true;
  }

  async listConnectorItems(orgId: string, status?: string) {
    const sql = status
      ? `SELECT * FROM inbox_connector_items WHERE organization_id=$1 AND status=$2 ORDER BY created_at DESC`
      : `SELECT * FROM inbox_connector_items WHERE organization_id=$1 ORDER BY created_at DESC`;
    return queryHelpers.queryAll(sql, status ? [orgId, status] : [orgId]);
  }

  async createRoutingRule(
    orgId: string,
    data: {
      channel: string;
      ruleName?: string;
      conditionsJson?: object;
      targetUserId?: string;
      targetProjectId?: string;
      priority?: number;
      actionType?: string;
      actionConfig?: object;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO inbox_routing_rules (id, organization_id, channel, rule_name, conditions_json, target_user_id, target_project_id, priority, action_type, action_config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        orgId,
        data.channel,
        data.ruleName ?? null,
        data.conditionsJson ? JSON.stringify(data.conditionsJson) : '{}',
        data.targetUserId ?? null,
        data.targetProjectId ?? null,
        data.priority ?? 0,
        data.actionType ?? 'route_to_user',
        data.actionConfig ? JSON.stringify(data.actionConfig) : '{}',
      ]
    );
    return { id };
  }

  async listRoutingRules(orgId: string, channel?: string) {
    const sql = channel
      ? `SELECT * FROM inbox_routing_rules WHERE organization_id=$1 AND channel=$2 ORDER BY priority DESC`
      : `SELECT * FROM inbox_routing_rules WHERE organization_id=$1 ORDER BY priority DESC`;
    return queryHelpers.queryAll(sql, channel ? [orgId, channel] : [orgId]);
  }

  async updateRoutingRule(
    orgId: string,
    ruleId: string,
    data: Partial<{
      ruleName: string;
      conditionsJson: object;
      targetUserId: string;
      targetProjectId: string;
      priority: number;
      isActive: boolean;
      actionType: string;
      actionConfig: object;
    }>
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.ruleName !== undefined) {
      sets.push(`rule_name=$${idx++}`);
      params.push(data.ruleName);
    }
    if (data.conditionsJson !== undefined) {
      sets.push(`conditions_json=$${idx++}`);
      params.push(JSON.stringify(data.conditionsJson));
    }
    if (data.targetUserId !== undefined) {
      sets.push(`target_user_id=$${idx++}`);
      params.push(data.targetUserId);
    }
    if (data.targetProjectId !== undefined) {
      sets.push(`target_project_id=$${idx++}`);
      params.push(data.targetProjectId);
    }
    if (data.priority !== undefined) {
      sets.push(`priority=$${idx++}`);
      params.push(data.priority);
    }
    if (data.isActive !== undefined) {
      sets.push(`is_active=$${idx++}`);
      params.push(data.isActive ? 1 : 0);
    }
    if (data.actionType !== undefined) {
      sets.push(`action_type=$${idx++}`);
      params.push(data.actionType);
    }
    if (data.actionConfig !== undefined) {
      sets.push(`action_config=$${idx++}`);
      params.push(JSON.stringify(data.actionConfig));
    }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(ruleId, orgId);
    await queryHelpers.queryRun(
      `UPDATE inbox_routing_rules SET ${sets.join(', ')} WHERE id=$${idx++} AND organization_id=$${idx}`,
      params
    );
    return { ok: true };
  }

  async deleteRoutingRule(orgId: string, ruleId: string) {
    await queryHelpers.queryRun(
      `DELETE FROM inbox_routing_rules WHERE id=$1 AND organization_id=$2`,
      [ruleId, orgId]
    );
    return { deleted: true };
  }

  // ── V4-INBX-02: Focus Board ──

  async createFocusBoard(
    userId: string,
    orgId: string,
    data: {
      name?: string;
      capacityLimit?: number;
      rulesJson?: object;
      templateId?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO focus_boards (id, user_id, organization_id, name, capacity_limit, rules_json, template_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        id,
        userId,
        orgId,
        data.name ?? 'My Focus',
        data.capacityLimit ?? 5,
        data.rulesJson ? JSON.stringify(data.rulesJson) : '{}',
        data.templateId ?? null,
      ]
    );
    return { id };
  }

  async getFocusBoards(userId: string, orgId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM focus_boards WHERE user_id=$1 AND organization_id=$2 ORDER BY created_at`,
      [userId, orgId]
    );
  }

  async updateFocusBoard(
    boardId: string,
    userId: string,
    data: Partial<{
      name: string;
      capacityLimit: number;
      rulesJson: object;
      isShared: boolean;
    }>
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      sets.push(`name=$${idx++}`);
      params.push(data.name);
    }
    if (data.capacityLimit !== undefined) {
      sets.push(`capacity_limit=$${idx++}`);
      params.push(data.capacityLimit);
    }
    if (data.rulesJson !== undefined) {
      sets.push(`rules_json=$${idx++}`);
      params.push(JSON.stringify(data.rulesJson));
    }
    if (data.isShared !== undefined) {
      sets.push(`is_shared=$${idx++}`);
      params.push(data.isShared ? 1 : 0);
    }

    if (sets.length === 0) return { ok: true };
    sets.push(`updated_at=CURRENT_TIMESTAMP`);
    params.push(boardId, userId);
    await queryHelpers.queryRun(
      `UPDATE focus_boards SET ${sets.join(', ')} WHERE id=$${idx++} AND user_id=$${idx}`,
      params
    );
    return { ok: true };
  }

  async addFocusItem(
    boardId: string,
    orgId: string,
    data: {
      inboxItemId?: string;
      sourceEntityType?: string;
      sourceEntityId?: string;
      title: string;
      priority?: string;
      plannedDate?: string;
      timeEstimateMinutes?: number;
      sortOrder?: number;
    }
  ) {
    // H6.5 (org-scope, fail-closed): the board MUST belong to the caller's org.
    // Without this filter any authenticated user could add items to a foreign
    // org's focus board by guessing/knowing its id (cross-org write).
    const board = await queryHelpers.queryFirst<{ capacity_limit: number }>(
      `SELECT capacity_limit FROM focus_boards WHERE id=$1 AND organization_id=$2`,
      [boardId, orgId]
    );
    if (!board) {
      return { error: 'board_not_found' };
    }
    const currentCount = await queryHelpers.queryFirst<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM focus_board_items WHERE board_id=$1 AND status IN ('planned','in_progress')`,
      [boardId]
    );
    if (currentCount && currentCount.cnt >= board.capacity_limit) {
      return { error: 'capacity_exceeded', limit: board.capacity_limit, current: currentCount.cnt };
    }

    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO focus_board_items (id, board_id, inbox_item_id, source_entity_type, source_entity_id, title, priority, planned_date, time_estimate_minutes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        boardId,
        data.inboxItemId ?? null,
        data.sourceEntityType ?? null,
        data.sourceEntityId ?? null,
        data.title,
        data.priority ?? 'normal',
        data.plannedDate ?? null,
        data.timeEstimateMinutes ?? null,
        data.sortOrder ?? 0,
      ]
    );
    return { id };
  }

  async getFocusItems(boardId: string, orgId: string, status?: string) {
    // H6.5 (org-scope, fail-closed): only return items when the owning board
    // belongs to the caller's org. The board_id -> focus_boards join enforces
    // the tenant boundary; a foreign board id yields an empty list, never data.
    const sql = status
      ? `SELECT fbi.* FROM focus_board_items fbi
           JOIN focus_boards fb ON fb.id = fbi.board_id
          WHERE fbi.board_id=$1 AND fb.organization_id=$2 AND fbi.status=$3
          ORDER BY fbi.sort_order`
      : `SELECT fbi.* FROM focus_board_items fbi
           JOIN focus_boards fb ON fb.id = fbi.board_id
          WHERE fbi.board_id=$1 AND fb.organization_id=$2
          ORDER BY fbi.sort_order`;
    return queryHelpers.queryAll(sql, status ? [boardId, orgId, status] : [boardId, orgId]);
  }

  async completeFocusItem(itemId: string, orgId: string) {
    // H6.5 (org-scope, fail-closed): scope the mutation to items whose board
    // belongs to the caller's org so a foreign item id is a no-op, not a write.
    await queryHelpers.queryRun(
      `UPDATE focus_board_items SET status='completed', completed_at=CURRENT_TIMESTAMP
        WHERE id=$1
          AND board_id IN (SELECT id FROM focus_boards WHERE organization_id=$2)`,
      [itemId, orgId]
    );
    return { ok: true };
  }

  async removeFocusItem(itemId: string, orgId: string) {
    // H6.5 (org-scope, fail-closed): same tenant guard as completeFocusItem.
    await queryHelpers.queryRun(
      `DELETE FROM focus_board_items
        WHERE id=$1
          AND board_id IN (SELECT id FROM focus_boards WHERE organization_id=$2)`,
      [itemId, orgId]
    );
    return { deleted: true };
  }

  async createFocusTemplate(
    orgId: string,
    userId: string,
    data: {
      name: string;
      description?: string;
      rulesJson?: object;
      capacityLimit?: number;
      isOrgDefault?: boolean;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO focus_board_templates (id, organization_id, name, description, rules_json, capacity_limit, is_org_default, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        id,
        orgId,
        data.name,
        data.description ?? null,
        data.rulesJson ? JSON.stringify(data.rulesJson) : '{}',
        data.capacityLimit ?? 5,
        data.isOrgDefault ? 1 : 0,
        userId,
      ]
    );
    return { id };
  }

  async listFocusTemplates(orgId: string) {
    return queryHelpers.queryAll(
      `SELECT * FROM focus_board_templates WHERE organization_id=$1 ORDER BY is_org_default DESC, name`,
      [orgId]
    );
  }

  // ── V4-INBX-03: AI Triage ──

  async triageInboxItem(
    orgId: string,
    data: {
      inboxItemId: string;
      suggestedPriority?: string;
      suggestedSection?: string;
      suggestedAction?: string;
      confidenceScore: number;
      reasoning?: string;
      originalPriority?: string;
      originalSection?: string;
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO inbox_ai_triage_log (id, organization_id, inbox_item_id, suggested_priority, suggested_section, suggested_action, confidence_score, reasoning, original_priority, original_section)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        orgId,
        data.inboxItemId,
        data.suggestedPriority ?? null,
        data.suggestedSection ?? null,
        data.suggestedAction ?? null,
        data.confidenceScore,
        data.reasoning ?? null,
        data.originalPriority ?? null,
        data.originalSection ?? null,
      ]
    );
    return { id };
  }

  async acceptTriage(triageId: string, orgId: string) {
    // H6.5 (org-scope, fail-closed): resolve the triage row inside the caller's
    // org first. A foreign triageId returns not_found and mutates nothing —
    // previously any user could accept another org's triage and rewrite that
    // org's inbox item priority/section (cross-org write).
    const triage = await queryHelpers.queryFirst<{
      inbox_item_id: string;
      suggested_priority: string;
      suggested_section: string;
    }>(
      `SELECT inbox_item_id, suggested_priority, suggested_section
         FROM inbox_ai_triage_log WHERE id=$1 AND organization_id=$2`,
      [triageId, orgId]
    );
    if (!triage) return { ok: false, reason: 'not_found' };

    await queryHelpers.queryRun(
      `UPDATE inbox_ai_triage_log SET accepted=1, resolved_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND organization_id=$2`,
      [triageId, orgId]
    );
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (triage.suggested_priority) {
      sets.push(`priority=$${idx++}`);
      params.push(triage.suggested_priority);
    }
    if (triage.suggested_section) {
      sets.push(`section=$${idx++}`);
      params.push(triage.suggested_section);
    }
    if (sets.length > 0) {
      params.push(triage.inbox_item_id, orgId);
      await queryHelpers.queryRun(
        `UPDATE canonical_inbox_items SET ${sets.join(', ')}, status='triaged', updated_at=CURRENT_TIMESTAMP WHERE id=$${idx++} AND organization_id=$${idx}`,
        params
      );
    }
    return { ok: true };
  }

  async rejectTriage(triageId: string, orgId: string) {
    // H6.5 (org-scope, fail-closed): scope the write to the caller's org.
    await queryHelpers.queryRun(
      `UPDATE inbox_ai_triage_log SET accepted=0, resolved_at=CURRENT_TIMESTAMP
        WHERE id=$1 AND organization_id=$2`,
      [triageId, orgId]
    );
    return { ok: true };
  }

  async undoTriage(triageId: string, orgId: string) {
    // H6.5 (org-scope, fail-closed): resolve + mutate strictly within the org.
    const triage = await queryHelpers.queryFirst<{
      inbox_item_id: string;
      original_priority: string;
      original_section: string;
      accepted: number;
    }>(`SELECT * FROM inbox_ai_triage_log WHERE id=$1 AND organization_id=$2`, [triageId, orgId]);
    if (!triage) return { ok: false, reason: 'not_found' };
    if (!triage.accepted) return { ok: false, reason: 'not_accepted' };

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (triage.original_priority) {
      sets.push(`priority=$${idx++}`);
      params.push(triage.original_priority);
    }
    if (triage.original_section) {
      sets.push(`section=$${idx++}`);
      params.push(triage.original_section);
    }
    if (sets.length > 0) {
      params.push(triage.inbox_item_id, orgId);
      await queryHelpers.queryRun(
        `UPDATE canonical_inbox_items SET ${sets.join(', ')}, status='pending', updated_at=CURRENT_TIMESTAMP WHERE id=$${idx++} AND organization_id=$${idx}`,
        params
      );
    }
    await queryHelpers.queryRun(
      `UPDATE inbox_ai_triage_log SET undone=1 WHERE id=$1 AND organization_id=$2`,
      [triageId, orgId]
    );
    return { ok: true };
  }

  async getTriageLog(orgId: string, inboxItemId?: string) {
    const sql = inboxItemId
      ? `SELECT * FROM inbox_ai_triage_log WHERE organization_id=$1 AND inbox_item_id=$2 ORDER BY created_at DESC`
      : `SELECT * FROM inbox_ai_triage_log WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100`;
    return queryHelpers.queryAll(sql, inboxItemId ? [orgId, inboxItemId] : [orgId]);
  }

  async getTriageConfig(orgId: string, userId: string) {
    return queryHelpers.queryFirst(
      `SELECT * FROM inbox_ai_triage_config WHERE organization_id=$1 AND user_id=$2`,
      [orgId, userId]
    );
  }

  async upsertTriageConfig(
    orgId: string,
    userId: string,
    data: {
      autoTriageEnabled?: boolean;
      confidenceThreshold?: number;
      allowedActions?: string[];
    }
  ) {
    const id = uuidv4();
    await queryHelpers.queryRun(
      `INSERT INTO inbox_ai_triage_config (id, organization_id, user_id, auto_triage_enabled, confidence_threshold, allowed_actions)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET auto_triage_enabled=$4, confidence_threshold=$5, allowed_actions=$6, updated_at=CURRENT_TIMESTAMP`,
      [
        id,
        orgId,
        userId,
        data.autoTriageEnabled ? 1 : 0,
        data.confidenceThreshold ?? 0.7,
        data.allowedActions
          ? JSON.stringify(data.allowedActions)
          : '["prioritize","section","snooze"]',
      ]
    );
    return { ok: true };
  }

  // ── V4-INBX-05: Inbox Table (App Table Standard) ──

  async getInboxTable(
    userId: string,
    orgId: string,
    filters: {
      status?: string;
      priority?: string;
      section?: string;
      slaStatus?: string;
      search?: string;
      sortBy?: string;
      sortDir?: string;
      limit?: number;
      offset?: number;
    }
  ) {
    const conditions = ['user_id=$1', 'organization_id=$2'];
    const params: unknown[] = [userId, orgId];
    let idx = 3;

    if (filters.status && filters.status !== 'all') {
      const statusMap: Record<string, string> = {
        open: 'pending',
        done: 'resolved',
        saved: 'snoozed',
      };
      conditions.push(`status=$${idx++}`);
      params.push(statusMap[filters.status] ?? filters.status);
    }
    if (filters.priority) {
      conditions.push(`priority=$${idx++}`);
      params.push(filters.priority);
    }
    if (filters.section) {
      conditions.push(`section=$${idx++}`);
      params.push(filters.section);
    }
    if (filters.slaStatus) {
      conditions.push(`sla_status=$${idx++}`);
      params.push(filters.slaStatus);
    }
    if (filters.search) {
      conditions.push(`(title LIKE $${idx} OR description LIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    // H6.5 SQL-injection guard: the ORDER BY column and direction MUST come from
    // an explicit whitelist — never interpolate raw user input (req.query.sortBy)
    // into SQL. Unknown/malicious input falls back to the default (created_at DESC).
    // Whitelist maps accepted client keys (API field names + raw column names) to
    // real canonical_inbox_items columns.
    const SORTABLE_COLUMNS: Record<string, string> = {
      created_at: 'created_at',
      received_at: 'created_at',
      receivedat: 'created_at',
      updated_at: 'updated_at',
      updatedat: 'updated_at',
      resolved_at: 'resolved_at',
      priority: 'priority',
      title: 'title',
      status: 'status',
      section: 'section',
      item_type: 'item_type',
      itemtype: 'item_type',
      type: 'item_type',
      sla_deadline: 'sla_deadline',
      sladeadline: 'sla_deadline',
      due_date: 'sla_deadline',
      duedate: 'sla_deadline',
      sla_status: 'sla_status',
      slastatus: 'sla_status',
    };
    const sortCol = SORTABLE_COLUMNS[(filters.sortBy || '').toLowerCase().trim()] || 'created_at';
    // sortDir whitelist: only 'asc' maps to ASC, everything else → DESC.
    const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
    // Defense-in-depth: coerce limit/offset to safe bounded integers (the value is
    // also interpolated, so it must never carry non-numeric input).
    const limit =
      Number.isFinite(filters.limit) && (filters.limit as number) > 0
        ? Math.min(Math.floor(filters.limit as number), 500)
        : 50;
    const offset =
      Number.isFinite(filters.offset) && (filters.offset as number) >= 0
        ? Math.floor(filters.offset as number)
        : 0;

    const countSql = `SELECT COUNT(*) as total FROM canonical_inbox_items WHERE ${conditions.join(' AND ')}`;
    const dataSql = `SELECT * FROM canonical_inbox_items WHERE ${conditions.join(' AND ')} ORDER BY ${sortCol} ${sortDir} LIMIT ${limit} OFFSET ${offset}`;

    // MVP 2026-07-28: chip `ALL` pokazywał tę samą liczbę co `Open` (497=497), bo
    // `counts` niżej były wpisane na sztywno (`open: total`). Liczymy realne stany
    // tym samym warunkiem co `countSql` — inaczej chipy nie mogą się zsumować.
    const statusSql = `SELECT lower(coalesce(status, '')) AS stan, COUNT(*) AS n FROM canonical_inbox_items WHERE ${conditions.join(' AND ')} GROUP BY 1`;

    const [countResult, rawItems, statusRows] = await Promise.all([
      queryHelpers.queryFirst<{ total: number }>(countSql, params),
      queryHelpers.queryAll<any>(dataSql, params),
      queryHelpers.queryAll<{ stan: string; n: number }>(statusSql, params),
    ]);

    const priorityToUrgency = (p: string | null): string => {
      const lp = (p || '').toLowerCase();
      if (lp === 'critical') return 'critical';
      if (lp === 'high') return 'high';
      if (lp === 'low') return 'low';
      return 'normal';
    };

    const items = (rawItems || []).map((r: any) => {
      const srcType = r.source_entity_type || 'notification';
      const srcId = r.source_entity_id || r.id;
      return {
        id: r.id,
        type: r.item_type || 'system_alert',
        itemType: r.item_type || 'signal',
        section: r.section || 'fyi_system',
        title: r.title || '',
        description: r.description || '',
        source: { type: (srcType === 'ai' ? 'ai' : 'system') as 'ai' | 'system' | 'user' },
        receivedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        dueDate: r.sla_deadline ? new Date(r.sla_deadline).toISOString() : undefined,
        urgency: priorityToUrgency(r.priority),
        priority: r.priority,
        itemStatus:
          r.status === 'pending'
            ? 'open'
            : r.status === 'resolved'
              ? 'done'
              : r.status === 'snoozed'
                ? 'saved'
                : r.status,
        isActionable: [
          'approvals_gates',
          'decisions_required',
          'assigned_tasks',
          'blocked_escalations',
        ].includes(r.section),
        _key: `${srcType}:${srcId}`,
        linkedTaskId: srcType === 'task' ? srcId : undefined,
        linkedDecisionId: srcType === 'decision' ? srcId : undefined,
        sourceEntityType: srcType,
        sourceEntityId: srcId,
        sla: r.sla_deadline
          ? {
              dueAt: new Date(r.sla_deadline).toISOString(),
              isBreached: r.sla_status === 'breached',
            }
          : undefined,
      };
    });

    const total = countResult?.total ?? 0;
    const critical = items.filter((i: any) => i.urgency === 'critical').length;
    const actionRequired = items.filter((i: any) => i.isActionable).length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const newToday = items.filter((i: any) => new Date(i.receivedAt) >= todayStart).length;

    logger.info(
      `[inbox-v4-table] user=${userId} org=${orgId} filters=${JSON.stringify(filters)} => total=${total} items=${items.length}`
    );
    return {
      summary: {
        total,
        critical,
        newToday,
        actionRequired,
        counts: liczStany(statusRows, total),
      },
      items,
      total,
      limit,
      offset,
    };
  }

  async getInboxItemPreview(userId: string, itemId: string) {
    const item = await queryHelpers.queryFirst(
      `SELECT * FROM canonical_inbox_items WHERE id=$1 AND user_id=$2`,
      [itemId, userId]
    );
    if (!item) return null;

    const triageLog = await queryHelpers.queryAll(
      `SELECT * FROM inbox_ai_triage_log WHERE inbox_item_id=$1 ORDER BY created_at DESC LIMIT 5`,
      [itemId]
    );

    return { ...item, triageLog };
  }
}

export const inboxEnterpriseService = new InboxEnterpriseService();
