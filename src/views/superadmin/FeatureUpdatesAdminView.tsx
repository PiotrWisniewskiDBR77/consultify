import {
  Archive,
  Bell,
  Building2,
  Eye,
  Globe,
  Loader2,
  MousePointerClick,
  PenSquare,
  Plus,
  Send,
  ShieldAlert,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import {
  AdminApi,
  type FeatureUpdateAudience,
  type FeatureUpdateChangeType,
  type FeatureUpdateImportance,
  type FeatureUpdateStatus,
  type ManagedFeatureUpdate,
  type ManagedFeatureUpdateInput,
} from '../../services/api/admin.api';

type ScopeFilter = 'relevant' | 'global' | 'organization';

type OrganizationOption = {
  id: string;
  name: string;
};

type EditorState = {
  title: string;
  bodyMd: string;
  tags: string;
  importance: FeatureUpdateImportance;
  status: Exclude<FeatureUpdateStatus, 'published'>;
  organizationId: string;
  audience: FeatureUpdateAudience;
  targetRoles: string;
  surface: 'global' | 'module' | 'view';
  moduleId: string;
  targetView: string;
  changeType: FeatureUpdateChangeType;
  effectiveFrom: string;
  expiresAt: string;
  requiresAck: boolean;
  actionLabel: string;
};

const EMPTY_EDITOR: EditorState = {
  title: '',
  bodyMd: '',
  tags: '',
  importance: 'normal',
  status: 'draft',
  organizationId: '',
  audience: 'all',
  targetRoles: '',
  surface: 'global',
  moduleId: '',
  targetView: '',
  changeType: 'improvement',
  effectiveFrom: '',
  expiresAt: '',
  requiresAck: false,
  actionLabel: 'Try it now',
};

const CHANGE_TYPE_LABELS: Record<FeatureUpdateChangeType, string> = {
  new_feature: 'New feature',
  improvement: 'Improvement',
  important_change: 'Important change',
  risk_or_breaking: 'Risk / breaking',
};

const AUDIENCE_LABELS: Record<FeatureUpdateAudience, string> = {
  all: 'All users',
  admins: 'Admins',
  superadmins: 'Superadmins',
  roles: 'Selected roles',
};

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildEditorState(item?: ManagedFeatureUpdate | null): EditorState {
  if (!item) return EMPTY_EDITOR;
  return {
    title: item.title,
    bodyMd: item.bodyMd,
    tags: item.tags.join(', '),
    importance: item.importance,
    status: item.status === 'published' ? 'review' : item.status,
    organizationId: item.organizationId || '',
    audience: item.audience,
    targetRoles: item.targetRoles.join(', '),
    surface: item.surface,
    moduleId: item.moduleId || '',
    targetView: item.targetView || '',
    changeType: item.changeType,
    effectiveFrom: toDateTimeLocal(item.effectiveFrom),
    expiresAt: toDateTimeLocal(item.expiresAt),
    requiresAck: item.requiresAck,
    actionLabel:
      typeof item.actionPayload?.label === 'string'
        ? String(item.actionPayload.label)
        : 'Try it now',
  };
}

function buildPayload(state: EditorState): ManagedFeatureUpdateInput {
  const targetView = state.targetView.trim();
  return {
    title: state.title.trim(),
    bodyMd: state.bodyMd.trim(),
    tags: state.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    importance: state.importance,
    status: state.status,
    organizationId: state.organizationId || null,
    audience: state.audience,
    targetRoles:
      state.audience === 'roles'
        ? state.targetRoles
            .split(',')
            .map((role) => role.trim())
            .filter(Boolean)
        : [],
    surface: state.surface,
    moduleId: state.moduleId.trim() || null,
    targetView: targetView || null,
    changeType: state.changeType,
    effectiveFrom: fromDateTimeLocal(state.effectiveFrom),
    expiresAt: fromDateTimeLocal(state.expiresAt),
    requiresAck: state.requiresAck,
    actionPayload: targetView
      ? {
          kind: 'view',
          view: targetView,
          label: state.actionLabel.trim() || 'Try it now',
        }
      : {},
  };
}

export const FeatureUpdatesAdminView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<ManagedFeatureUpdate[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    draft: 0,
    review: 0,
    published: 0,
    archived: 0,
    global: 0,
    organization: 0,
  });
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('relevant');
  const [statusFilter, setStatusFilter] = useState<FeatureUpdateStatus | 'all'>('all');
  const [organizationFilter, setOrganizationFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);

  const selectedUpdate = useMemo(
    () => updates.find((item) => item.id === selectedId) || null,
    [selectedId, updates]
  );
  const selectedIsReadOnly = selectedUpdate?.status === 'published';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResponse, orgsResponse] = await Promise.all([
        AdminApi.listFeatureUpdates({
          scope: scopeFilter,
          status: statusFilter,
          organizationId: organizationFilter || undefined,
        }),
        AdminApi.getOrganizations(),
      ]);

      setUpdates(listResponse.items);
      setSummary(listResponse.summary);
      setOrganizations(
        (orgsResponse as any[]).map((org) => ({
          id: String(org.id),
          name: String(org.name || org.organization_name || `Org ${org.id}`),
        }))
      );
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load feature updates');
    } finally {
      setLoading(false);
    }
  }, [organizationFilter, scopeFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setEditor(buildEditorState(selectedUpdate));
  }, [selectedUpdate]);

  const handleNew = () => {
    setSelectedId(null);
    setEditor(EMPTY_EDITOR);
  };

  const handleSave = async () => {
    if (!editor.title.trim() || !editor.bodyMd.trim()) {
      toast.error('Title and body are required');
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload(editor);
      if (selectedUpdate) {
        await AdminApi.updateFeatureUpdate(selectedUpdate.id, payload);
        toast.success('Update draft saved');
      } else {
        const result = await AdminApi.createFeatureUpdate(payload);
        setSelectedId(result.id);
        toast.success('Update draft created');
      }
      await loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save feature update');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (item: ManagedFeatureUpdate) => {
    setPublishingId(item.id);
    try {
      const result = await AdminApi.publishFeatureUpdate(item.id);
      toast.success(result.emailed ? 'Update published and email sent' : 'Update published');
      await loadData();
      setSelectedId(item.id);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to publish update');
    } finally {
      setPublishingId(null);
    }
  };

  const handleArchive = async (item: ManagedFeatureUpdate) => {
    setArchivingId(item.id);
    try {
      await AdminApi.archiveFeatureUpdate(item.id);
      toast.success('Update archived');
      await loadData();
      if (selectedId === item.id) {
        setSelectedId(item.id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to archive update');
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Bell size={16} />
            Total updates
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.total}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary.published} published, {summary.review} in review
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Globe size={16} />
            Global reach
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.global}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Platform-wide announcements
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Building2 size={16} />
            Organization-scoped
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.organization}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Tenant-level communications
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <ShieldAlert size={16} />
            Workflow backlog
          </div>
          <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            {summary.draft + summary.review}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {summary.draft} drafts, {summary.archived} archived
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Release communications
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage global and organization updates, set governance, and watch adoption.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
            >
              <option value="relevant">Relevant scope</option>
              <option value="global">Global only</option>
              <option value="organization">Organization only</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FeatureUpdateStatus | 'all')}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={organizationFilter}
              onChange={(e) => setOrganizationFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm min-w-[220px]"
            >
              <option value="">All organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleNew}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              New update
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-6 items-start">
        <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-4 space-y-4 xl:sticky xl:top-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {selectedUpdate ? 'Edit update' : 'Draft new update'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Build the message, target the right audience, then publish from here.
              </p>
            </div>
            {selectedUpdate && (
              <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-white/10 text-xs text-slate-600 dark:text-slate-300">
                {selectedUpdate.status}
              </span>
            )}
          </div>

          {selectedIsReadOnly && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Published updates are read-only. Archive and republish if you need a revised message.
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Title</div>
            <input
              value={editor.title}
              onChange={(e) => setEditor((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              placeholder="Short, specific, operational"
            />
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Body (Markdown)
            </div>
            <textarea
              value={editor.bodyMd}
              onChange={(e) => setEditor((prev) => ({ ...prev, bodyMd: e.target.value }))}
              rows={10}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm font-mono"
              placeholder="What changed, who it is for, what to do now."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Scope</div>
              <select
                value={editor.organizationId}
                onChange={(e) => setEditor((prev) => ({ ...prev, organizationId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                <option value="">Global</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Status</div>
              <select
                value={editor.status}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    status: e.target.value as Exclude<FeatureUpdateStatus, 'published'>,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Importance
              </div>
              <select
                value={editor.importance}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    importance: e.target.value as FeatureUpdateImportance,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Change type
              </div>
              <select
                value={editor.changeType}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    changeType: e.target.value as FeatureUpdateChangeType,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Audience</div>
              <select
                value={editor.audience}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    audience: e.target.value as FeatureUpdateAudience,
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Surface</div>
              <select
                value={editor.surface}
                onChange={(e) =>
                  setEditor((prev) => ({
                    ...prev,
                    surface: e.target.value as EditorState['surface'],
                  }))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              >
                <option value="global">Global feed</option>
                <option value="module">Module</option>
                <option value="view">Specific view</option>
              </select>
            </div>
          </div>

          {editor.audience === 'roles' && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Target roles
              </div>
              <input
                value={editor.targetRoles}
                onChange={(e) => setEditor((prev) => ({ ...prev, targetRoles: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                placeholder="ADMIN, PROJECT_MANAGER"
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">Tags</div>
            <input
              value={editor.tags}
              onChange={(e) => setEditor((prev) => ({ ...prev, tags: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              placeholder="reports, roadmap, interview"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Module id
              </div>
              <input
                value={editor.moduleId}
                onChange={(e) => setEditor((prev) => ({ ...prev, moduleId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                placeholder="finance"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Target view
              </div>
              <input
                value={editor.targetView}
                onChange={(e) => setEditor((prev) => ({ ...prev, targetView: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
                placeholder="SUPERADMIN_OVERVIEW"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Effective from
              </div>
              <input
                type="datetime-local"
                value={editor.effectiveFrom}
                onChange={(e) => setEditor((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Expires at
              </div>
              <input
                type="datetime-local"
                value={editor.expiresAt}
                onChange={(e) => setEditor((prev) => ({ ...prev, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300">CTA label</div>
            <input
              value={editor.actionLabel}
              onChange={(e) => setEditor((prev) => ({ ...prev, actionLabel: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-sm"
              placeholder="Try it now"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={editor.requiresAck}
              onChange={(e) =>
                setEditor((prev) => ({
                  ...prev,
                  requiresAck: e.target.checked,
                }))
              }
              className="rounded border-slate-300"
            />
            Requires acknowledgement
          </label>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || selectedIsReadOnly}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-60 text-white text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <PenSquare size={16} />}
              {selectedUpdate ? 'Save changes' : 'Create draft'}
            </button>
            <button
              onClick={handleNew}
              className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-navy-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          ) : updates.length === 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-10 text-center">
              <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <div className="text-sm text-slate-600 dark:text-slate-300">
                No updates match the selected filters.
              </div>
            </div>
          ) : (
            updates.map((item) => {
              const active = item.id === selectedId;
              const orgLabel =
                organizations.find((org) => org.id === item.organizationId)?.name ||
                (item.scope === 'global' ? 'Global' : 'Organization');

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    active
                      ? 'border-c-info/50 bg-slate-50 dark:border-c-info/30 dark:bg-white/[0.06]'
                      : 'border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                          {item.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                          {CHANGE_TYPE_LABELS[item.changeType]}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[11px] text-slate-600 dark:text-slate-300">
                          {AUDIENCE_LABELS[item.audience]}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          {item.scope === 'global' ? <Globe size={12} /> : <Building2 size={12} />}
                          {orgLabel}
                        </span>
                        <span>{item.importance}</span>
                        {item.targetView && <span>View: {item.targetView}</span>}
                        {item.tags.length > 0 && <span>Tags: {item.tags.join(', ')}</span>}
                      </div>

                      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 whitespace-pre-wrap">
                        {item.bodyMd}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Eye size={12} />
                          {item.analytics.opened} opens
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Bell size={12} />
                          {item.analytics.read} reads
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MousePointerClick size={12} />
                          {item.analytics.clicked} clicks
                        </span>
                        {item.publishedAt && (
                          <span>Published {new Date(item.publishedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap lg:flex-col gap-2 lg:min-w-[148px]">
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <PenSquare size={14} />
                        {item.status === 'published' ? 'View' : 'Edit'}
                      </button>

                      {(item.status === 'draft' || item.status === 'review') && (
                        <button
                          onClick={() => handlePublish(item)}
                          disabled={publishingId === item.id}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-60 text-white text-sm font-medium transition-colors"
                        >
                          {publishingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Publish
                        </button>
                      )}

                      {item.status !== 'archived' && (
                        <button
                          onClick={() => handleArchive(item)}
                          disabled={archivingId === item.id}
                          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                          {archivingId === item.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Archive size={14} />
                          )}
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureUpdatesAdminView;
