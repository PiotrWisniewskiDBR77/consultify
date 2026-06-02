/**
 * Template Lifecycle Service (Block A · EPIC-T6)
 *
 * Owns the `draft → approved → deprecated` lifecycle on `tp_base_templates`.
 *
 * Side-effects on every state mutation:
 *   1. Updates the row.
 *   2. Appends an entry to `approval_history` JSONB array (in-row audit trail).
 *   3. Emits a `tp_audit_events` row via AuditService for cross-cutting audit.
 *
 * Authorization is the route layer's job — this service trusts the caller has
 * already enforced `requireSuperAdmin` (see table-platform.routes.ts). The
 * service still rejects clearly invalid transitions (e.g. promoting a
 * deprecated template) so even an authorized caller cannot poison state.
 *
 * Schema reference: migrations/20260508_block_a_template_lifecycle.sql
 * Spec reference:   docs/product/work-packets/tabele-full-product/block-A-template-catalog/epics/EPIC-T6_TEMPLATE_LIFECYCLE.md
 */

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import auditService from './AuditService.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type TemplateStatus = 'draft' | 'approved' | 'deprecated';

export interface ApprovalHistoryEntry {
  event: 'approved' | 'deprecated' | 'reverted_to_draft' | 'auto_promoted_from_legacy_featured';
  at: string;
  actor: string;
  note?: string;
  previous_status?: TemplateStatus;
}

export interface LifecycleTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  schema_snapshot: Record<string, unknown>;
  is_featured: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  status: TemplateStatus;
  version: string;
  owner_user_id: string | null;
  approval_history: ApprovalHistoryEntry[];
  governance_rules: Record<string, unknown>;
}

export interface ListLifecycleTemplatesOptions {
  status?: TemplateStatus | TemplateStatus[];
  category?: string;
}

export interface LifecycleMutationOptions {
  actorUserId: string;
  note?: string;
}

// ── Internal helpers ─────────────────────────────────────────────────────────

const VALID_STATUSES: readonly TemplateStatus[] = ['draft', 'approved', 'deprecated'] as const;

function isTemplateStatus(value: unknown): value is TemplateStatus {
  return typeof value === 'string' && (VALID_STATUSES as readonly string[]).includes(value);
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function rowToLifecycleTemplate(row: Record<string, unknown>): LifecycleTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description == null ? null : String(row.description),
    category: String(row.category ?? ''),
    thumbnail_url: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    schema_snapshot: parseJsonField<Record<string, unknown>>(row.schema_snapshot, {}),
    is_featured: Boolean(row.is_featured),
    usage_count: Number(row.usage_count ?? 0),
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    status: isTemplateStatus(row.status) ? row.status : 'draft',
    version: String(row.version ?? '1.0.0'),
    owner_user_id: row.owner_user_id == null ? null : String(row.owner_user_id),
    approval_history: parseJsonField<ApprovalHistoryEntry[]>(row.approval_history, []),
    governance_rules: parseJsonField<Record<string, unknown>>(row.governance_rules, {}),
  };
}

// ── Service ──────────────────────────────────────────────────────────────────

const templateLifecycleService = {
  /**
   * List templates filtered by status / category. No tenant scoping —
   * `tp_base_templates` is a system-owned catalog (org_id is intentionally
   * absent on the table). The route layer handles role-based filtering when
   * exposing draft entries to non-admins.
   */
  async listTemplates(options: ListLifecycleTemplatesOptions = {}): Promise<LifecycleTemplate[]> {
    const db = getDatabase();
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.status !== undefined) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      const invalid = statuses.find((s) => !isTemplateStatus(s));
      if (invalid !== undefined) {
        throw new Error(`Invalid template status: ${String(invalid)}`);
      }
      params.push(statuses);
      conditions.push(`status = ANY($${params.length}::text[])`);
    }

    if (options.category) {
      params.push(options.category);
      conditions.push(`category = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `
      SELECT *
      FROM   tp_base_templates
      ${where}
      ORDER BY is_featured DESC, usage_count DESC, name ASC
    `;

    const result = await db.query(sql, params);
    return result.rows.map((row) => rowToLifecycleTemplate(row as Record<string, unknown>));
  },

  async getTemplate(templateId: string): Promise<LifecycleTemplate | null> {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('templateId is required');
    }
    const db = getDatabase();
    const result = await db.query('SELECT * FROM tp_base_templates WHERE id = $1', [templateId]);
    if (result.rows.length === 0) return null;
    return rowToLifecycleTemplate(result.rows[0] as Record<string, unknown>);
  },

  async getTemplateGovernance(templateId: string): Promise<{
    status: TemplateStatus;
    version: string;
    owner_user_id: string | null;
    approval_history: ApprovalHistoryEntry[];
    governance_rules: Record<string, unknown>;
  } | null> {
    const tpl = await this.getTemplate(templateId);
    if (!tpl) return null;
    return {
      status: tpl.status,
      version: tpl.version,
      owner_user_id: tpl.owner_user_id,
      approval_history: tpl.approval_history,
      governance_rules: tpl.governance_rules,
    };
  },

  async approveTemplate(
    templateId: string,
    options: LifecycleMutationOptions
  ): Promise<LifecycleTemplate> {
    return this._transition(templateId, 'approved', options, ['draft']);
  },

  async deprecateTemplate(
    templateId: string,
    options: LifecycleMutationOptions
  ): Promise<LifecycleTemplate> {
    return this._transition(templateId, 'deprecated', options, ['approved', 'draft']);
  },

  async revertToDraft(
    templateId: string,
    options: LifecycleMutationOptions
  ): Promise<LifecycleTemplate> {
    return this._transition(templateId, 'draft', options, ['approved', 'deprecated']);
  },

  async _transition(
    templateId: string,
    nextStatus: TemplateStatus,
    options: LifecycleMutationOptions,
    allowedFromStatuses: TemplateStatus[]
  ): Promise<LifecycleTemplate> {
    if (!templateId || typeof templateId !== 'string') {
      throw new Error('templateId is required');
    }
    if (!options.actorUserId) {
      throw new Error('actorUserId is required');
    }

    const current = await this.getTemplate(templateId);
    if (!current) {
      const err = new Error(`Template not found: ${templateId}`);
      (err as { code?: string }).code = 'TEMPLATE_NOT_FOUND';
      throw err;
    }

    if (current.status === nextStatus) {
      // Idempotent: re-applying the same status is a no-op (no audit duplication).
      return current;
    }

    if (!allowedFromStatuses.includes(current.status)) {
      const err = new Error(
        `Invalid transition: cannot move template ${templateId} from '${current.status}' to '${nextStatus}'`
      );
      (err as { code?: string }).code = 'INVALID_LIFECYCLE_TRANSITION';
      throw err;
    }

    const eventName: ApprovalHistoryEntry['event'] =
      nextStatus === 'approved'
        ? 'approved'
        : nextStatus === 'deprecated'
          ? 'deprecated'
          : 'reverted_to_draft';

    const historyEntry: ApprovalHistoryEntry = {
      event: eventName,
      at: new Date().toISOString(),
      actor: options.actorUserId,
      note: options.note,
      previous_status: current.status,
    };

    const db = getDatabase();
    const updateResult = await db.query(
      `
      UPDATE tp_base_templates
         SET status           = $1,
             owner_user_id    = COALESCE(owner_user_id, $2),
             approval_history = approval_history || $3::jsonb
       WHERE id = $4
       RETURNING *
      `,
      [nextStatus, options.actorUserId, JSON.stringify([historyEntry]), templateId]
    );

    if (updateResult.rows.length === 0) {
      // Race: template was deleted between getTemplate() and UPDATE.
      const err = new Error(`Template disappeared mid-transition: ${templateId}`);
      (err as { code?: string }).code = 'TEMPLATE_NOT_FOUND';
      throw err;
    }

    const updated = rowToLifecycleTemplate(updateResult.rows[0] as Record<string, unknown>);

    try {
      await auditService.logEvent(
        `template_${eventName}`,
        'template',
        templateId,
        options.actorUserId,
        { status: current.status },
        { status: nextStatus },
        {
          template_name: current.name,
          template_category: current.category,
          template_version: updated.version,
          note: options.note ?? null,
        }
      );
    } catch (auditErr) {
      // Audit failure must NOT roll back the lifecycle write; it's already
      // captured in approval_history. Log loudly so ops sees the divergence.
      logger.error('[TemplateLifecycleService] audit emit failed (state already mutated)', {
        templateId,
        nextStatus,
        actorUserId: options.actorUserId,
        error: (auditErr as Error).message,
      });
    }

    return updated;
  },
};

export type TemplateLifecycleService = typeof templateLifecycleService;
export default templateLifecycleService;
