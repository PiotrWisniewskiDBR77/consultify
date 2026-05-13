import { getAssessmentRoles } from './assessmentPermissionService.js';
import { get as dbGet } from '../utils/DbPromise.js';

type SupportedAction = 'create' | 'read' | 'update' | 'delete' | 'export' | string;

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

const normalizeFramework = (framework: unknown): string | undefined =>
  normalizeOptionalString(framework)?.toUpperCase();

const normalizeUserId = (value: unknown): string | undefined => normalizeOptionalString(value);

const normalizeRole = (role: unknown): string =>
  (normalizeOptionalString(role) || 'viewer').toLowerCase();

const ADMIN_ROLES = new Set(['admin', 'owner', 'superadmin', 'super_admin', 'manager']);
const APPROVER_ROLES = new Set(['admin', 'owner', 'superadmin', 'super_admin', 'manager']);
const CERTIFIER_ROLES = new Set(['admin', 'owner', 'superadmin', 'super_admin']);

const ACTION_PERMISSION_MAP: Record<string, string> = {
  create: 'canEdit',
  read: 'canView',
  update: 'canEdit',
  delete: 'canManage',
  export: 'canView',
};

const resolveUserRoles = async (
  assessmentId: string | undefined,
  organizationId: string | undefined
): Promise<Array<{ userId?: string; role?: string; permissions?: Record<string, boolean> }>> => {
  if (!assessmentId || !organizationId) return [];
  const rows = await getAssessmentRoles(assessmentId, organizationId);
  return Array.isArray(rows) ? (rows as Array<{ userId?: string; role?: string; permissions?: Record<string, boolean> }>) : [];
};

const getSystemRole = async (userId: string): Promise<string | undefined> => {
  const fromRole = await dbGet<{ role?: string }>(`SELECT role FROM users WHERE id = ? LIMIT 1`, [userId]);
  if (normalizeOptionalString(fromRole?.role)) return normalizeRole(fromRole?.role);

  const fromAccessRole = await dbGet<{ access_role?: string }>(
    `SELECT access_role FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (normalizeOptionalString(fromAccessRole?.access_role)) {
    return normalizeRole(fromAccessRole?.access_role);
  }

  const fromUserRole = await dbGet<{ user_role?: string }>(
    `SELECT user_role FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  if (normalizeOptionalString(fromUserRole?.user_role)) {
    return normalizeRole(fromUserRole?.user_role);
  }

  return undefined;
};

const hasFrameworkPermission = async (
  userId: string,
  action: SupportedAction,
  context?: { organizationId?: string; projectId?: string }
): Promise<boolean> => {
  const organizationId = normalizeOptionalString(context?.organizationId);
  const assessmentId = normalizeOptionalString(context?.projectId);
  const permissionKey = ACTION_PERMISSION_MAP[String(action).toLowerCase()];

  if (!permissionKey) return false;
  if (!assessmentId || !organizationId) return false;

  const roles = await resolveUserRoles(assessmentId, organizationId);
  const role = roles.find((r) => normalizeUserId(r.userId) === userId);
  if (!role) return false;

  const normalizedRole = normalizeRole(role.role);
  if (ADMIN_ROLES.has(normalizedRole)) return true;

  return Boolean(role.permissions?.[permissionKey]);
};

export const FrameworkRBACService = {
  async hasPermission(
    userId: unknown,
    framework: unknown,
    action: SupportedAction,
    context?: { organizationId?: string; projectId?: string }
  ): Promise<boolean> {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedFramework = normalizeFramework(framework);
    if (!normalizedUserId || !normalizedFramework) return false;
    return hasFrameworkPermission(normalizedUserId, action, context);
  },

  async canApprove(userId: unknown, framework: unknown): Promise<boolean> {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedFramework = normalizeFramework(framework);
    if (!normalizedUserId || !normalizedFramework) return false;
    const role = await getSystemRole(normalizedUserId);
    if (!role) return false;
    return APPROVER_ROLES.has(role);
  },

  async canCertify(userId: unknown, framework: unknown): Promise<boolean> {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedFramework = normalizeFramework(framework);
    if (!normalizedUserId || !normalizedFramework) return false;
    const role = await getSystemRole(normalizedUserId);
    if (!role) return false;
    return CERTIFIER_ROLES.has(role);
  },

  async validateWorkflowTransition(
    userId: unknown,
    framework: unknown,
    fromStatus: unknown,
    toStatus: unknown
  ): Promise<{ allowed: boolean; reason?: string }> {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedFramework = normalizeFramework(framework);
    const from = normalizeOptionalString(fromStatus)?.toUpperCase();
    const to = normalizeOptionalString(toStatus)?.toUpperCase();

    if (!normalizedUserId || !normalizedFramework || !from || !to) {
      return { allowed: false, reason: 'Invalid workflow validation context' };
    }

    if (from === to) return { allowed: true };
    return { allowed: true };
  },
};

export default FrameworkRBACService;
