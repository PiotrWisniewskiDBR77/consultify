import * as queryHelpers from '../utils/queryHelpers.js';
import {
  type ApplicationRoleValue,
  defaultProjectRoleForApplicationRole,
  normalizeApplicationRole,
  normalizePlatformRole,
  normalizeProjectRole,
  normalizeUpper,
  type ProjectRoleValue,
} from '../utils/roleNormalization.js';

export type CapabilityScope =
  | 'organization'
  | 'project'
  | 'scoped'
  | 'own'
  | 'assigned'
  | 'delegated';

export interface AccessContext {
  userId: string;
  organizationId: string;
  applicationRole: ApplicationRoleValue;
  platformRole: 'SUPERADMIN' | null;
  projectId?: string | null;
  projectRole?: ProjectRoleValue | null;
  rawProjectRole?: string | null;
  roleTemplateId?: string | null;
  capabilities: string[];
  scope: CapabilityScope[];
  isImpersonating?: boolean;
  auditRequired: boolean;
  source: 'resolved' | 'fallback';
  warnings: string[];
}

interface RoleTemplate {
  roleKey: ProjectRoleValue;
  label: string;
  description: string;
  isRequired: boolean;
  isEnabled: boolean;
  capabilities: string[];
}

const FACTORY_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    roleKey: 'PROJECT_SPONSOR',
    label: 'Project Sponsor',
    description: 'Business accountability, budget, strategic decisions and escalations.',
    isRequired: true,
    isEnabled: true,
    capabilities: [
      'project.view',
      'project.summary.view',
      'project.financials.view',
      'project.settings.approve',
      'project.team.approve',
      'project.roles.approve',
      'decision.approve',
      'change.request.approve',
      'initiative.approve',
      'initiative.promote',
      'initiative.unblock',
      'gate.approve',
      'benefits.view',
      'audit.project.view',
      // Zwornik Delta A (§3.5): stakeholder registry — Sponsor sees/edits
      // engagements at project level and sees confidential influence/interest.
      'stakeholder.engagement.manage.project',
      'stakeholder.assessment.view',
    ],
  },
  {
    roleKey: 'PROJECT_LEADER',
    label: 'Project Leader',
    description: 'Operational delivery, planning, assignments, review and coordination.',
    isRequired: true,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.cycle.create',
      'okr.cycle.close',
      'okr.objective.create',
      'okr.objective.update',
      'okr.objective.delete',
      'okr.keyresult.create',
      'okr.keyresult.update',
      'okr.keyresult.delete',
      'okr.checkin.create',
      'project.view',
      'project.settings.manage',
      'project.team.manage',
      'project.roles.assign',
      'project.workstreams.manage',
      'task.create',
      'task.assign',
      'task.reassign',
      'task.unassign',
      'task.update',
      'task.status.update',
      'task.close',
      'task.reopen',
      'task.escalate',
      'task.delete',
      'interview.assignment.create',
      'interview.assignment.view_managed',
      'interview.assignment.remind',
      'interview.assignment.review',
      'interview.assignment.send_back',
      'interview.assignment.approve',
      'interview.insights.view',
      'interview.insights.handoff',
      'initiative.submit',
      'initiative.review',
      'initiative.send_back',
      'initiative.approve_to_review',
      'initiative.schedule',
      'initiative.start',
      'initiative.block',
      'initiative.complete',
      'initiative.create',
      'initiative.status.change',
      'initiative.delete',
      'my_work.triage',
      'my_work.delegate',
      'decision.request',
      'decision.update',
      'decision.delete',
      'change.request.submit',
      'risk.escalate',
      'audit.project.view',
      // Zwornik Delta A (§3.5): Leader manages project stakeholder engagements
      // and sees confidential influence/interest scores.
      'stakeholder.engagement.manage.project',
      'stakeholder.assessment.view',
      // 2026-07-14 Faza B (spec model ról PM #25/#28/#30/#35): capability
      // families for the previously-uncovered initiatives/projects endpoint
      // groups. Shadow-only rollout — telemetry decides before enforce.
      'initiative.program.manage',
      'initiative.template.manage',
      'initiative.template.apply',
      'initiative.section_type.manage',
      'initiative.wizard.use',
      'initiative.dependency.manage',
      'initiative.milestone.manage',
      'initiative.resource.manage',
      'initiative.staffing.manage',
      'initiative.budget.manage',
      'initiative.tool.manage',
      'initiative.intangible.manage',
      // Dedicated INITIATIVE-level stakeholder list (NOT the org-level
      // `stakeholder.registry.manage` — different scope, do not mix).
      'initiative.stakeholder.manage',
      'initiative.watcher.manage',
      'initiative.raid.manage',
      'initiative.link.manage',
      'initiative.gate_role.manage',
      'initiative.pir.manage',
      'change.champion.manage',
      'project.archive',
      'project.delete',
    ],
  },
  {
    roleKey: 'TASK_ASSIGNEE',
    label: 'Task Assignee',
    description: 'Executes assigned work and updates own progress.',
    isRequired: true,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.checkin.create',
      'project.view.assigned',
      'task.view.assigned',
      'task.update.assigned',
      'task.status.update.assigned',
      'task.comment.assigned',
      'task.escalate.assigned',
      // 2026-07-14 (Faza A, spec model role PM #25/#28/#30/#35): an assignee may
      // drop themselves from a task they hold — never reassign it to someone
      // else (that stays a Leader/PMO action, see task.reassign above).
      'task.unassign.assigned',
      'interview.assignment.start.assigned',
      'interview.assignment.answer.assigned',
      'interview.assignment.submit.assigned',
      'interview.insights.view.own',
      'my_work.triage',
    ],
  },
  {
    roleKey: 'OBSERVER',
    label: 'Observer',
    description: 'Safe read-only project access.',
    isRequired: true,
    isEnabled: true,
    capabilities: [
      'project.view',
      'project.summary.view',
      'task.view.scoped',
      'initiative.view.scoped',
      'interview.insights.view.scoped',
      'benefits.view',
    ],
  },
  {
    roleKey: 'PMO',
    label: 'PMO',
    description: 'Governance, standards, risks and gate readiness.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.cycle.create',
      'okr.cycle.close',
      'okr.objective.create',
      'okr.objective.update',
      'okr.objective.delete',
      'okr.keyresult.create',
      'okr.keyresult.update',
      'okr.keyresult.delete',
      'okr.checkin.create',
      'project.view',
      'project.settings.update',
      'project.team.update',
      'project.roles.assign.scoped',
      'project.workstreams.manage',
      'task.create',
      'task.assign',
      'task.reassign',
      'task.unassign',
      'task.update',
      'task.status.update',
      'task.close',
      'task.reopen',
      'interview.assignment.create',
      'interview.assignment.view_managed',
      'interview.assignment.remind',
      'interview.assignment.review',
      'interview.assignment.send_back',
      'interview.assignment.approve',
      'interview.insights.view',
      'initiative.submit',
      'initiative.review',
      'initiative.send_back',
      'initiative.approve_to_review',
      'initiative.schedule',
      'initiative.start',
      'initiative.block',
      'initiative.complete',
      'initiative.create',
      'initiative.status.change',
      'initiative.delete',
      'task.delete',
      'gate.approve',
      'my_work.triage',
      'my_work.delegate',
      'decision.request',
      'decision.update',
      'decision.delete',
      'change.request.submit',
      'risk.manage',
      'risk.escalate',
      'audit.project.view',
      // Zwornik Delta A (§3.5): PMO manages the org-level stakeholder registry
      // (identification layer) plus project engagements and confidential scores.
      'stakeholder.registry.manage',
      'stakeholder.engagement.manage.project',
      'stakeholder.assessment.view',
      // 2026-07-14 Faza B: PMO mirrors PROJECT_LEADER on the new endpoint
      // families (governance/standards side of the same delivery surface).
      'initiative.program.manage',
      'initiative.template.manage',
      'initiative.template.apply',
      'initiative.section_type.manage',
      'initiative.wizard.use',
      'initiative.dependency.manage',
      'initiative.milestone.manage',
      'initiative.resource.manage',
      'initiative.staffing.manage',
      'initiative.budget.manage',
      'initiative.tool.manage',
      'initiative.intangible.manage',
      'initiative.stakeholder.manage',
      'initiative.watcher.manage',
      'initiative.raid.manage',
      'initiative.link.manage',
      'initiative.gate_role.manage',
      'initiative.pir.manage',
      'change.champion.manage',
      'project.archive',
      'project.delete',
    ],
  },
  {
    roleKey: 'INITIATIVE_OWNER',
    label: 'Initiative Owner',
    description: 'Owns a specific initiative or value area.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.objective.update',
      'okr.keyresult.create',
      'okr.keyresult.update',
      'okr.checkin.create',
      'project.view',
      'task.create.scoped',
      'task.assign.scoped',
      'task.update.scoped',
      'task.status.update.scoped',
      'task.close.scoped',
      'interview.assignment.create.scoped',
      'interview.assignment.view_scoped',
      'interview.assignment.review.scoped',
      'interview.assignment.send_back.scoped',
      'interview.assignment.approve.scoped',
      'interview.insights.view.scoped',
      'initiative.submit',
      'initiative.create.scoped',
      'initiative.update.own',
      'initiative.status.change.scoped',
      'initiative.block.scoped',
      'initiative.complete.scoped',
      'task.delete.scoped',
      'benefits.view.scoped',
      'my_work.triage',
      'my_work.delegate.scoped',
      'decision.request.scoped',
      'change.request.submit.scoped',
      'risk.escalate.scoped',
      'audit.project.view.scoped',
      // 2026-07-14 Faza B: owner manages the building blocks OF HIS initiative
      // (scoped) — never org-level assets (programs/templates/section-types).
      'initiative.template.apply.scoped',
      'initiative.wizard.use.scoped',
      'initiative.milestone.manage.scoped',
      'initiative.resource.manage.scoped',
      'initiative.staffing.manage.scoped',
      'initiative.budget.manage.scoped',
      'initiative.tool.manage.scoped',
      'initiative.intangible.manage.scoped',
      'initiative.stakeholder.manage.scoped',
      'initiative.watcher.manage.scoped',
      'initiative.raid.manage.scoped',
      'initiative.link.manage.scoped',
    ],
  },
  {
    roleKey: 'WORKSTREAM_OWNER',
    label: 'Workstream Owner',
    description: 'Owns a scoped stream of work.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.objective.update',
      'okr.keyresult.create',
      'okr.keyresult.update',
      'okr.checkin.create',
      'project.view',
      'project.workstream.view.scoped',
      'project.workstream.update.scoped',
      'task.create.scoped',
      'task.assign.scoped',
      'task.update.scoped',
      'task.status.update.scoped',
      'task.close.scoped',
      'interview.assignment.create.scoped',
      'interview.assignment.view_scoped',
      'interview.assignment.review.scoped',
      'interview.insights.view.scoped',
      'initiative.submit.scoped',
      'initiative.create.scoped',
      'initiative.update.scoped',
      'initiative.status.change.scoped',
      'initiative.block.scoped',
      'task.delete.scoped',
      'benefits.view.scoped',
      'my_work.triage',
      'my_work.delegate.scoped',
      'decision.request.scoped',
      'change.request.submit.scoped',
      'risk.escalate.scoped',
      'audit.project.view.scoped',
      // 2026-07-14 Faza B: same scoped building-block set as INITIATIVE_OWNER
      // (conservative-wide per spec; shadow telemetry will verify — flagged
      // as a doubtful assignment for Piotr's review).
      'initiative.template.apply.scoped',
      'initiative.wizard.use.scoped',
      'initiative.milestone.manage.scoped',
      'initiative.resource.manage.scoped',
      'initiative.staffing.manage.scoped',
      'initiative.budget.manage.scoped',
      'initiative.tool.manage.scoped',
      'initiative.intangible.manage.scoped',
      'initiative.stakeholder.manage.scoped',
      'initiative.watcher.manage.scoped',
      'initiative.raid.manage.scoped',
      'initiative.link.manage.scoped',
    ],
  },
  {
    roleKey: 'REVIEWER',
    label: 'Reviewer',
    description: 'Quality, content or completeness reviewer.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      'project.view.scoped',
      'task.view.scoped',
      'task.comment.scoped',
      'task.review.delegated',
      'interview.assignment.view_scoped',
      'interview.assignment.review',
      'interview.assignment.send_back.delegated',
      'interview.assignment.approve.delegated',
      'interview.insights.view.scoped',
      'initiative.review',
      'initiative.send_back.delegated',
      'artifact.comment',
      'my_work.triage',
    ],
  },
  {
    roleKey: 'SME',
    label: 'Subject Matter Expert',
    description: 'Expert input without default delivery authority.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.checkin.create',
      'project.view.scoped',
      'task.view.scoped',
      'task.comment.scoped',
      'interview.assignment.answer.assigned',
      'interview.insights.view.scoped',
      'initiative.comment',
      'initiative.input',
      'benefits.input',
      'decision.comment',
      'my_work.triage',
    ],
  },
  {
    roleKey: 'CONSULTANT',
    label: 'Consultant',
    description: 'Internal or external consultant working in a project scope.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.checkin.create',
      'project.view.scoped',
      'task.view.assigned',
      'task.update.assigned',
      'task.status.update.assigned',
      'task.comment.assigned',
      'interview.assignment.start.assigned',
      'interview.assignment.answer.assigned',
      'interview.assignment.submit.assigned',
      'interview.insights.view.scoped',
      'initiative.submit.scoped',
      'initiative.comment.scoped',
      'artifact.comment.scoped',
      'my_work.triage',
    ],
  },
  {
    roleKey: 'BUSINESS_OWNER',
    label: 'Business Owner',
    description: 'Benefits, KPI and business value ownership.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      // OKR (D7 CRUD, resultsStrategic.routes.ts): rodzina dodana 2026-07-14
      // przed flipem CAPABILITY_ENFORCE — bez niej enforce = 403 dla nie-adminów
      // (finding 07-12). Org-wide (bez projektu) zarządzanie zostaje przy OWNER/ADMIN ('*').
      'okr.keyresult.update',
      'okr.checkin.create',
      'project.view',
      'project.summary.view',
      'project.financials.view.scoped',
      'initiative.view',
      'benefits.view',
      'benefits.track',
      'benefits.manage',
      'kpi.view',
      'kpi.update',
      'decision.comment',
      'interview.insights.view',
      'my_work.triage',
      'audit.project.view',
    ],
  },
  {
    roleKey: 'STEERING_COMMITTEE',
    label: 'Steering Committee',
    description: 'Strategic approvals, escalations and continue/stop decisions.',
    isRequired: false,
    isEnabled: true,
    capabilities: [
      'project.view',
      'project.summary.view',
      'project.financials.view',
      'project.settings.approve',
      'project.team.approve',
      'project.roles.approve',
      'decision.approve',
      'change.request.approve',
      'initiative.approve',
      'initiative.promote',
      'initiative.unblock',
      'initiative.cancel',
      'gate.approve',
      'risk.escalation.review',
      'benefits.view',
      'audit.project.view',
    ],
  },
];

/**
 * P0-2 (Canvas audit 2026-06-10) — Canvas capabilities for regular members.
 *
 * The Work Canvas panel resolves its 9 `canvas.*` capabilities via
 * GET /api/access/effective WITHOUT a projectId, so the project-scoped
 * FACTORY_ROLE_TEMPLATES above never apply there. Before this baseline only
 * OWNER/ADMIN/SUPERADMIN ('*') passed any canvas check — Canvas was de facto
 * admin-only. Canvas drafts are personal chat artifacts (ownedDraft-scoped),
 * so every standard member gets the full set, including convert.initiative /
 * convert.decision: converting only creates a draft entity in the member's
 * own workspace — project-level promotion/approval stays gated by the
 * `initiative.` / `decision.` capabilities in the role templates above.
 */
export const CANVAS_MEMBER_CAPABILITIES: string[] = [
  'canvas.output.presentation',
  'canvas.output.table',
  'canvas.output.report',
  'canvas.convert.idea',
  'canvas.convert.note',
  'canvas.convert.initiative',
  'canvas.convert.decision',
  'canvas.convert.task',
  'canvas.share',
];

/**
 * Organization-level baseline capabilities granted by application role,
 * independent of project membership. OWNER/ADMIN are omitted because they
 * already receive '*' in resolveEffectiveAccess; GUEST stays read-only.
 */
const APPLICATION_ROLE_BASELINE_CAPABILITIES: Partial<Record<ApplicationRoleValue, string[]>> = {
  USER: [...CANVAS_MEMBER_CAPABILITIES, 'okr.checkin.create'],
};

let roleSchemaReady = false;

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (!value || typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function capabilitiesForRole(role: ProjectRoleValue | null | undefined): string[] {
  return FACTORY_ROLE_TEMPLATES.find((template) => template.roleKey === role)?.capabilities || [];
}

function dedupe(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

export async function ensureProjectRoleTemplateSchema(): Promise<void> {
  if (roleSchemaReady) return;

  await queryHelpers
    .queryRun(
      `CREATE TABLE IF NOT EXISTS project_role_templates (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        role_key TEXT NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        is_factory INTEGER DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        is_enabled INTEGER DEFAULT 1,
        capabilities_json TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, role_key)
      )`
    )
    .catch(() => undefined);

  await queryHelpers
    .queryRun(
      `CREATE TABLE IF NOT EXISTS project_role_overrides (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role_key TEXT NOT NULL,
        capabilities_json TEXT DEFAULT '[]',
        is_enabled INTEGER DEFAULT 1,
        fallback_role_key TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, role_key)
      )`
    )
    .catch(() => undefined);

  await queryHelpers
    .queryRun(
      `CREATE TABLE IF NOT EXISTS role_change_audit_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        project_id TEXT,
        actor_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        before_json TEXT,
        after_json TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`
    )
    .catch(() => undefined);

  await queryHelpers
    .queryRun(`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS role_template_id TEXT`)
    .catch(() => undefined);
  await queryHelpers
    .queryRun(`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS normalized_project_role TEXT`)
    .catch(() => undefined);
  await queryHelpers
    .queryRun(`ALTER TABLE project_members ADD COLUMN IF NOT EXISTS legacy_project_role TEXT`)
    .catch(() => undefined);

  roleSchemaReady = true;
}

export async function seedFactoryRoleTemplates(
  organizationId: string | null = null
): Promise<void> {
  await ensureProjectRoleTemplateSchema();
  const orgKey = organizationId || 'GLOBAL';

  // N+1 fix (finding staging_db_perf): this seeding runs on every
  // /api/access/effective capability-check. The previous per-template loop
  // issued one UPSERT per FACTORY_ROLE_TEMPLATE (~12 round-trips), and at
  // ~150ms/round-trip against a remote Railway DB that alone added ~1.8s to a
  // check the front-end fires ~9× on a single Canvas mount. Collapse to a
  // single multi-row INSERT ... ON CONFLICT (12 round-trips → 1). Behaviour is
  // identical: same columns, same conflict target (organization_id, role_key),
  // same upsert semantics for every template.
  if (FACTORY_ROLE_TEMPLATES.length === 0) return;

  const columns =
    'id, organization_id, role_key, label, description, is_factory, is_required, is_enabled, ' +
    'capabilities_json, created_at, updated_at';
  const rowPlaceholder = '(?, ?, ?, ?, ?, 1, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)';
  const placeholders = FACTORY_ROLE_TEMPLATES.map(() => rowPlaceholder).join(', ');
  const values: unknown[] = [];
  for (const template of FACTORY_ROLE_TEMPLATES) {
    const id = `factory_${orgKey}_${template.roleKey}`.toLowerCase();
    values.push(
      id,
      organizationId,
      template.roleKey,
      template.label,
      template.description,
      template.isRequired ? 1 : 0,
      template.isEnabled ? 1 : 0,
      JSON.stringify(template.capabilities)
    );
  }

  await queryHelpers
    .queryRun(
      `INSERT INTO project_role_templates (
        ${columns}
      )
      VALUES ${placeholders}
      ON CONFLICT(organization_id, role_key) DO UPDATE SET
        label = excluded.label,
        description = excluded.description,
        is_factory = 1,
        is_required = excluded.is_required,
        capabilities_json = excluded.capabilities_json,
        updated_at = CURRENT_TIMESTAMP`,
      values
    )
    .catch(() => undefined);
}

/**
 * AUTHORITATIVE organization membership -> application role. FAILS CLOSED.
 *
 * Returns null when there is no membership row, when the row is not ACTIVE, or
 * when the lookup itself fails. Callers MUST treat null as "no organization access".
 *
 * Two deliberate properties, both security-relevant:
 *
 *  1. ACTIVE predicate. The previous query had no status predicate, so a REVOKED
 *     row still returned its role. The canonical production predicate used
 *     everywhere else in this codebase is UPPER(status) = 'ACTIVE' (see
 *     auth.middleware.ts, auditsStrictMembership.middleware.ts, ideaMapAccess.ts,
 *     and the note at testSupport.routes.ts:993). This now matches it.
 *
 *  2. NO `fallback` PARAMETER. It previously accepted the caller's token-derived
 *     role and returned it whenever no row existed, so deleting a membership did
 *     not remove access — it handed control of the role to the token. The
 *     parameter WAS the vulnerability, so it is gone rather than merely unused.
 *
 * A lookup error returns null rather than degrading to any claimed role: an
 * unreadable membership table must not become an open door.
 */
async function readApplicationRole(
  userId: string,
  organizationId: string
): Promise<ApplicationRoleValue | null> {
  let row: { role?: string; status?: string } | null | undefined;
  try {
    row = await queryHelpers.queryOne<{ role?: string; status?: string }>(
      `SELECT role, status FROM organization_members
        WHERE user_id = ? AND organization_id = ? LIMIT 1`,
      [userId, organizationId]
    );
  } catch {
    return null;
  }
  if (!row) return null;
  if (normalizeUpper(row.status) !== 'ACTIVE') return null;
  return normalizeApplicationRole(row.role);
}

async function readProjectMembership(userId: string, projectId: string) {
  return await queryHelpers
    .queryOne<{
      project_role?: string;
      normalized_project_role?: string;
      role_template_id?: string;
      permissions?: string;
      is_invoked?: number;
      consultant_profile?: string;
    }>(
      `SELECT project_role, normalized_project_role, role_template_id, permissions,
              is_invoked, consultant_profile
       FROM project_members
       WHERE user_id = ? AND project_id = ?
       LIMIT 1`,
      [userId, projectId]
    )
    .catch(() => null);
}

async function readTemplateCapabilities(params: {
  organizationId: string;
  roleKey: ProjectRoleValue;
  roleTemplateId?: string | null;
}): Promise<string[]> {
  await seedFactoryRoleTemplates(params.organizationId);
  const byId = params.roleTemplateId
    ? await queryHelpers
        .queryOne<{
          capabilities_json?: string;
        }>(`SELECT capabilities_json FROM project_role_templates WHERE id = ? LIMIT 1`, [
          params.roleTemplateId,
        ])
        .catch(() => null)
    : null;
  if (byId) return parseJsonArray(byId.capabilities_json);

  const row = await queryHelpers
    .queryOne<{ capabilities_json?: string }>(
      `SELECT capabilities_json
       FROM project_role_templates
       WHERE (organization_id = ? OR organization_id IS NULL) AND role_key = ?
       ORDER BY CASE WHEN organization_id = ? THEN 0 ELSE 1 END
       LIMIT 1`,
      [params.organizationId, params.roleKey, params.organizationId]
    )
    .catch(() => null);
  const templateCapabilities = parseJsonArray(row?.capabilities_json);
  return templateCapabilities.length > 0
    ? templateCapabilities
    : capabilitiesForRole(params.roleKey);
}

/**
 * Capability strings the org ADMIN role does NOT get, even though ADMIN
 * otherwise holds every capability an ADMIN previously received via the bare
 * '*' wildcard (see ADMIN_UNRESTRICTED_SENTINEL below).
 *
 * DEC-2026-08-25-17: project role management is OWNER-only. Live-verified
 * 2026-08-25 — with ADMIN holding the bare '*' wildcard, an ADMIN could call
 * the admin.project_roles.manage-gated endpoints (access.routes.ts,
 * security/roles.routes.ts) and get 200 instead of 403. The code already
 * intended this: the OWNER branch below lists 'admin.project_roles.manage'
 * explicitly even though '*' already made that listing redundant for
 * OWNER — the ADMIN branch just never carried the same exclusion, because
 * '*' silently overrode it.
 *
 * This set must only grow from an explicit, documented decision — never from
 * guessing which capability "sounds like" it should be owner-only. Ownership
 * transfer is NOT listed here because it is not gated through this
 * capability system at all: organization/ownership.routes.ts checks
 * `role === 'OWNER'` directly against the membership row.
 */
const OWNER_ONLY_CAPABILITIES = new Set<string>(['admin.project_roles.manage']);

/**
 * Sentinel meaning "every capability ADMIN would have received via the bare
 * '*' wildcard, except OWNER_ONLY_CAPABILITIES". This is NOT '*' — '*'
 * remains an unconditional bypass (OWNER, SUPERADMIN) with no exceptions.
 * ADMIN must never hold literal '*' again, or this whole mechanism is
 * silently defeated the same way the original bug worked.
 */
const ADMIN_UNRESTRICTED_SENTINEL = 'admin.*.except-owner-only';

export async function resolveEffectiveAccess(params: {
  userId: string;
  organizationId: string;
  applicationRole?: string | null;
  projectId?: string | null;
  isImpersonating?: boolean;
}): Promise<AccessContext> {
  const platformRole = normalizePlatformRole(params.applicationRole);
  /*
   * PLATFORM SUPERADMIN — DELIBERATE, EXPLICITLY AUTHORIZED BEHAVIOUR (owner decision 15A).
   *
   * A token normalizing to SUPERADMIN is granted org-level OWNER in ANY organization
   * WITHOUT a membership row and WITHOUT consulting the database at all, and is then
   * granted '*' below. This lane did NOT change that; it is preserved exactly and is
   * pinned by a named focused test so it can never drift silently. If this policy is
   * to change, that is a separate owner decision — not a refactor.
   */
  const membershipRole = platformRole
    ? null
    : await readApplicationRole(params.userId, params.organizationId);
  const hasAuthority = platformRole !== null || membershipRole !== null;
  const applicationRole: ApplicationRoleValue = platformRole
    ? 'OWNER'
    : (membershipRole ?? 'GUEST');
  const warnings: string[] = [];

  /*
   * FAIL CLOSED. No ACTIVE membership (missing row, non-ACTIVE row, or unreadable
   * table) yields NO capabilities at all. We return before the project branch on
   * purpose: falling through would hand out project-role template capabilities via
   * defaultProjectRoleForApplicationRole to a principal with no organization access.
   */
  if (!hasAuthority) {
    return {
      userId: params.userId,
      organizationId: params.organizationId,
      applicationRole: 'GUEST',
      platformRole: null,
      projectId: params.projectId,
      projectRole: null,
      rawProjectRole: null,
      roleTemplateId: null,
      capabilities: [],
      scope: ['organization'],
      isImpersonating: params.isImpersonating,
      auditRequired: params.isImpersonating === true,
      source: 'resolved',
      warnings: ['NO_ACTIVE_ORGANIZATION_MEMBERSHIP'],
    };
  }

  let projectRole: ProjectRoleValue | null = null;
  let rawProjectRole: string | null = null;
  let roleTemplateId: string | null = null;
  let capabilities: string[] = [];
  const scope = new Set<CapabilityScope>(['organization']);

  if (params.projectId) {
    const membership = await readProjectMembership(params.userId, params.projectId);
    rawProjectRole = membership?.normalized_project_role || membership?.project_role || null;
    projectRole = normalizeProjectRole(rawProjectRole);
    roleTemplateId = membership?.role_template_id || null;

    if (!projectRole) {
      projectRole = defaultProjectRoleForApplicationRole(applicationRole);
      warnings.push('PROJECT_ROLE_FALLBACK_FROM_APPLICATION_ROLE');
    }

    const templateCapabilities = await readTemplateCapabilities({
      organizationId: params.organizationId,
      roleKey: projectRole,
      roleTemplateId,
    });
    const memberCapabilities = parseJsonArray(membership?.permissions);
    capabilities = dedupe([...templateCapabilities, ...memberCapabilities]);
    scope.add('project');
    if (capabilities.some((capability) => capability.endsWith('.scoped'))) scope.add('scoped');
    if (capabilities.some((capability) => capability.endsWith('.own'))) scope.add('own');
    if (capabilities.some((capability) => capability.endsWith('.assigned'))) scope.add('assigned');
    if (capabilities.some((capability) => capability.endsWith('.delegated')))
      scope.add('delegated');
  }

  // P0-2: org-level baseline (e.g. canvas.*) — applies with or without a
  // project context, so chat-scoped surfaces like Work Canvas resolve real
  // capabilities for regular members instead of an empty set.
  capabilities = dedupe([
    ...capabilities,
    ...(APPLICATION_ROLE_BASELINE_CAPABILITIES[applicationRole] || []),
  ]);

  if (platformRole === 'SUPERADMIN') {
    capabilities = dedupe([...capabilities, '*', 'superadmin.access', 'audit.project.view']);
  }
  if (applicationRole === 'OWNER') {
    capabilities = dedupe([
      ...capabilities,
      '*',
      'admin.access',
      'admin.people.manage',
      'admin.project_roles.manage',
    ]);
  }
  if (applicationRole === 'ADMIN') {
    capabilities = dedupe([
      ...capabilities,
      ADMIN_UNRESTRICTED_SENTINEL,
      'admin.access',
      'admin.people.manage',
    ]);
  }

  return {
    userId: params.userId,
    organizationId: params.organizationId,
    applicationRole,
    platformRole,
    projectId: params.projectId,
    projectRole,
    rawProjectRole,
    roleTemplateId,
    capabilities,
    scope: Array.from(scope),
    isImpersonating: params.isImpersonating,
    auditRequired:
      params.isImpersonating === true ||
      capabilities.some(
        (capability) => capability.includes('approve') || capability.includes('manage')
      ),
    source: 'resolved',
    warnings,
  };
}

export function hasEffectiveCapability(
  access: Pick<AccessContext, 'capabilities' | 'platformRole'>,
  capability: string
): boolean {
  if (access.platformRole === 'SUPERADMIN') return true;
  const capabilities = new Set(access.capabilities);
  if (capabilities.has('*') || capabilities.has(capability)) return true;
  if (capabilities.has(ADMIN_UNRESTRICTED_SENTINEL) && !OWNER_ONLY_CAPABILITIES.has(capability))
    return true;
  return ['.scoped', '.own', '.assigned', '.delegated'].some((suffix) =>
    capabilities.has(`${capability}${suffix}`)
  );
}

export function mapLegacyPermissionToCapability(permissionKey: string): string {
  const key = normalizeUpper(permissionKey);
  const mappings: Record<string, string> = {
    INTERVIEW_ASSIGN_VIEW: 'interview.assignment.view_managed',
    INTERVIEW_ASSIGN_MANAGE: 'interview.assignment.create',
    INTERVIEW_REMIND: 'interview.assignment.remind',
    INTERVIEW_TEMPLATE_VIEW: 'interview.template.view',
    INTERVIEW_TEMPLATE_USE: 'interview.template.use',
    INTERVIEW_TEMPLATE_MANAGE: 'interview.template.manage',
    INTERVIEW_INSIGHTS_VIEW: 'interview.insights.view',
    INTERVIEW_INSIGHTS_CREATE: 'interview.insights.create',
    INTERVIEW_INSIGHTS_REVIEW: 'interview.assignment.review',
    INTERVIEW_INSIGHTS_HANDOFF: 'interview.insights.handoff',
    INTERVIEW_INSIGHTS_PUBLISH: 'interview.insights.publish',
    TASK_VIEW: 'task.view',
    TASK_CREATE: 'task.create',
    TASK_ASSIGN: 'task.assign',
    TASK_UPDATE: 'task.update',
    TASK_STATUS_UPDATE: 'task.status.update',
    TASK_CLOSE: 'task.close',
    MANAGE_STAGE_GATES: 'initiative.approve',
    PROJECT_VIEW: 'project.view',
    PROJECT_TEAM_MANAGE: 'project.team.manage',
    PROJECT_ROLES_MANAGE: 'admin.project_roles.manage',
  };
  return mappings[key] || key.toLowerCase().replace(/_/g, '.');
}

export { FACTORY_ROLE_TEMPLATES };

export default {
  ensureProjectRoleTemplateSchema,
  seedFactoryRoleTemplates,
  resolveEffectiveAccess,
  hasEffectiveCapability,
  FACTORY_ROLE_TEMPLATES,
};
