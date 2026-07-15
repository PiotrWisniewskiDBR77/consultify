/**
 * HP-25 B4 — SCIM group-sync self-service: an org-admin maps their OWN
 * organization's IdP groups (Entra / Okta) to an internal role, optionally
 * scoped to a single project, without a superadmin.
 *
 * Reads/writes `/api/admin/identity/scim/*` (org-scoped — organization_id from
 * the token; a supplied projectId is validated to belong to the org before any
 * write, see adminP32.routes.ts + scimGroupMappingService.ts).
 *
 * Behind `scimGroupSyncFlag` (default OFF) — see src/utils/scimGroupSyncFlag.ts.
 * Modelled on AdminSsoSelfServiceCard (HP-24) for shell + token parity.
 */
import { Loader2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { DegradedState } from './AdminState';

type GroupMapping = {
  id: string;
  external_group_id?: string;
  external_group_name?: string;
  internal_role?: string;
  project_id?: string | null;
  project_name?: string | null;
  is_active?: boolean | number;
  member_count?: number;
};

type ProjectOption = { id: string; name: string };

// Curated role options: the two flat legacy roles plus the canonical project
// roles (projectRoleCanon.ts). Canonical roles are most meaningful when the
// mapping is scoped to a project.
const ROLE_OPTIONS: Array<{ value: string; labelKey: string; fallback: string }> = [
  { value: 'member', labelKey: 'scimGroupSync.roles.member', fallback: 'Member' },
  { value: 'admin', labelKey: 'scimGroupSync.roles.admin', fallback: 'Admin' },
  { value: 'PROJECT_LEADER', labelKey: 'scimGroupSync.roles.projectLeader', fallback: 'Project Leader' },
  { value: 'INITIATIVE_OWNER', labelKey: 'scimGroupSync.roles.initiativeOwner', fallback: 'Initiative Owner' },
  { value: 'WORKSTREAM_OWNER', labelKey: 'scimGroupSync.roles.workstreamOwner', fallback: 'Workstream Owner' },
  { value: 'REVIEWER', labelKey: 'scimGroupSync.roles.reviewer', fallback: 'Reviewer' },
  { value: 'SME', labelKey: 'scimGroupSync.roles.sme', fallback: 'Subject Matter Expert' },
  { value: 'OBSERVER', labelKey: 'scimGroupSync.roles.observer', fallback: 'Observer' },
];

const inputClass =
  'w-full rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text';

export const AdminScimGroupSyncCard: React.FC = () => {
  const { t } = useTranslation();
  const [mappings, setMappings] = useState<GroupMapping[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [groupName, setGroupName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [role, setRole] = useState('member');
  const [projectId, setProjectId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [summaryRes, projectsRes] = await Promise.all([
        Api.getAdminScimSummary(),
        Api.getProjects().catch(() => []),
      ]);
      setMappings(Array.isArray(summaryRes?.summary?.groupMappings)
        ? summaryRes.summary.groupMappings
        : []);
      const projectOptions: ProjectOption[] = (Array.isArray(projectsRes) ? projectsRes : [])
        .map((p: any) => ({ id: String(p?.id || ''), name: String(p?.name || p?.title || p?.id || '') }))
        .filter((p: ProjectOption) => p.id);
      setProjects(projectOptions);
    } catch (error: any) {
      setLoadError(
        error?.message || t('scimGroupSync.errors.load', 'Failed to load group mappings')
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const projectNameById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [projects]);

  const handleCreate = async () => {
    if (!groupName.trim() && !groupId.trim()) {
      toast.error(
        t('scimGroupSync.errors.groupRequired', 'Enter an IdP group name or ID')
      );
      return;
    }
    setSaving(true);
    try {
      await Api.createAdminScimGroupMapping({
        externalGroupName: groupName.trim(),
        externalGroupId: groupId.trim(),
        internalRole: role,
        // Empty = org-wide mapping. When set, the backend validates it belongs
        // to this org before writing.
        projectId: projectId || null,
      });
      toast.success(t('scimGroupSync.toasts.created', 'Group mapping added'));
      setGroupName('');
      setGroupId('');
      setRole('member');
      setProjectId('');
      await load();
    } catch (error: any) {
      toast.error(
        error?.message || t('scimGroupSync.errors.create', 'Failed to add group mapping')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await Api.deleteAdminScimGroupMapping(id);
      toast.success(t('scimGroupSync.toasts.deleted', 'Group mapping removed'));
      await load();
    } catch (error: any) {
      toast.error(
        error?.message || t('scimGroupSync.errors.delete', 'Failed to remove group mapping')
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-c-border bg-c-surface p-5">
        <div className="flex items-center gap-2 text-sm text-c-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('scimGroupSync.loading', 'Loading group mappings…')}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-c-border bg-c-surface p-5">
        <DegradedState
          title={t('scimGroupSync.errors.loadTitle', 'Group mappings unavailable')}
          description={loadError}
        />
        <button
          onClick={() => void load()}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" />
          {t('scimGroupSync.actions.retry', 'Retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-c-border bg-c-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-c-text">
            <Users className="h-4 w-4 text-c-text-secondary" />
            {t('scimGroupSync.title', 'Group mappings (Entra / Okta → role)')}
          </div>
          <p className="mt-1 text-sm text-c-text-secondary">
            {t(
              'scimGroupSync.description',
              'Map an identity-provider group to an internal role. Leave "Project" empty for an organization-wide mapping, or pick a project to scope the role to it.'
            )}
          </p>
        </div>
      </div>

      {/* Create form */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm text-c-text-secondary">
          {t('scimGroupSync.fields.groupName', 'IdP group name')}
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="e.g. Azure AD Finance-Approvers"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm text-c-text-secondary">
          {t('scimGroupSync.fields.groupId', 'IdP group ID (optional)')}
          <input
            type="text"
            value={groupId}
            onChange={(event) => setGroupId(event.target.value)}
            placeholder="objectId / group GUID"
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="block text-sm text-c-text-secondary">
          {t('scimGroupSync.fields.role', 'Internal role')}
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className={`${inputClass} mt-1`}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey, option.fallback)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-c-text-secondary">
          {t('scimGroupSync.fields.project', 'Project (optional — org-wide if empty)')}
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={`${inputClass} mt-1`}
          >
            <option value="">
              {t('scimGroupSync.fields.orgWide', 'Organization-wide')}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => void handleCreate()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text text-c-bg px-4 py-2 text-sm font-medium hover:bg-c-text-secondary disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('scimGroupSync.actions.add', 'Add group mapping')}
        </button>
      </div>

      {/* Existing mappings */}
      <div className="mt-5 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-c-text-muted">
          {t('scimGroupSync.list.heading', 'Existing mappings')}
        </div>
        {mappings.length === 0 ? (
          <p className="text-sm text-c-text-secondary">
            {t('scimGroupSync.list.empty', 'No group mappings yet.')}
          </p>
        ) : (
          <ul className="divide-y divide-c-border rounded-lg border border-c-border">
            {mappings.map((mapping) => {
              const scopeLabel =
                mapping.project_id
                  ? mapping.project_name ||
                    projectNameById.get(String(mapping.project_id)) ||
                    t('scimGroupSync.list.projectScoped', 'Project-scoped')
                  : t('scimGroupSync.list.orgWide', 'Organization-wide');
              return (
                <li
                  key={mapping.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate text-c-text">
                      {mapping.external_group_name || mapping.external_group_id || mapping.id}{' '}
                      <span aria-hidden="true">&rarr;</span>{' '}
                      <span className="font-medium">{mapping.internal_role || 'member'}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-c-text-muted">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 ${
                          mapping.project_id
                            ? 'bg-c-surface-raised text-c-text-secondary'
                            : 'bg-c-surface-raised text-c-text-muted'
                        }`}
                      >
                        {scopeLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => void handleDelete(mapping.id)}
                    disabled={deletingId === mapping.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-50"
                    aria-label={t('scimGroupSync.actions.remove', 'Remove mapping')}
                  >
                    {deletingId === mapping.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t('scimGroupSync.actions.remove', 'Remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminScimGroupSyncCard;
