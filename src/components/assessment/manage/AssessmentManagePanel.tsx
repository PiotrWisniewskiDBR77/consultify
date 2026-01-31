import React, { useEffect, useMemo, useState } from 'react';

import { ActivityLogPanel } from '@/components/assessment/ActivityLogPanel';
import { Api } from '@/services/api';
import { DRD_STRUCTURE, getAreaById } from '@/services/drdStructure';

type TabId = 'workflow' | 'team' | 'initiatives' | 'reports' | 'access' | 'logs';

type WorkflowState =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'AWAITING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ARCHIVED';

type AssessmentWorkflowInfo = {
  id?: string | null;
  assessmentId: string;
  organizationId?: string;
  status: WorkflowState;
  updatedAt?: string;
  completionPercent?: number;
};

type RoleRecord = {
  id: string;
  assessmentId: string;
  userId: string;
  organizationId: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  canEdit?: boolean;
  canApprove?: boolean;
  canManageTeam?: boolean;
  canChangeStatus?: boolean;
  canGenerateReport?: boolean;
  canGenerateInitiatives?: boolean;
  assignedAreas?: string[] | null;
  assignedBy?: string;
  assignedAt?: string;
  updatedAt?: string;
  userName?: string;
  userEmail?: string;
};

type AccessRequest = {
  id: string;
  assessmentId: string;
  organizationId: string;
  requesterId: string;
  requestedRole: 'editor' | 'manager';
  requestedAreas?: string[] | null;
  justification: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
  requesterName?: string;
  requesterEmail?: string;
};

type EligibilityResponse = {
  assessment: {
    id: string;
    type: string;
    status: string;
    completionPercent: number;
    confidenceAvg: number;
    updatedAt?: string;
  };
  roleInfo: {
    role: string;
    permissions: Record<string, boolean>;
    assignedAreas: string[] | null;
    isOwner: boolean;
  };
  checks: Array<{
    key: string;
    label: string;
    pass: boolean;
    severity: 'blocking' | 'warning';
    reason?: string;
  }>;
  actions: Record<
    string,
    {
      allowed: boolean;
      blockedBy: string[];
    }
  >;
};

type OrgUser = {
  id: string;
  email: string;
  name: string;
};

type AreaAssignment = {
  id: string;
  assessment_id: string;
  area_id: string;
  assigned_user_id: string;
  assigned_by: string;
  assigned_at: string;
  due_at?: string | null;
  status?: string;
};

type InitiativeBatch = {
  id: string;
  methodologyId: string;
  initiativesCount: number;
  includeChatContext: boolean;
  generatedBy: string;
  generatedByName: string;
  createdAt: string;
};

type LinkedInitiative = {
  id: string;
  title: string;
  status: string;
  batch_id?: string;
};

export function AssessmentManagePanel(props: { assessmentId: string; assessmentName?: string }) {
  const { assessmentId, assessmentName } = props;

  const [tab, setTab] = useState<TabId>('workflow');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [workflow, setWorkflow] = useState<AssessmentWorkflowInfo | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityResponse | null>(null);
  const [assessmentContextSnapshot, setAssessmentContextSnapshot] = useState<Record<string, any>>(
    {}
  );
  const [auditPhase, setAuditPhase] = useState<
    'PREP' | 'FIELDWORK' | 'VALIDATION' | 'REVIEW' | 'APPROVAL'
  >('PREP');
  const [auditNotes, setAuditNotes] = useState('');
  const [decisionOwnerId, setDecisionOwnerId] = useState<string>('');
  const [decisionDueDate, setDecisionDueDate] = useState<string>('');
  const [decisionPriority, setDecisionPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    'medium'
  );
  const [reviewComment, setReviewComment] = useState('');
  const [sendBackComment, setSendBackComment] = useState('');
  const [methodologyId, setMethodologyId] = useState<
    'impact-feasibility' | 'moscow' | 'rice' | 'value-effort' | 'strategic-fit'
  >('impact-feasibility');
  const [initiativeCount, setInitiativeCount] = useState(5);
  const [includeChatContext, setIncludeChatContext] = useState(true);
  const [initiativeTitle, setInitiativeTitle] = useState('');
  const [initiativeDescription, setInitiativeDescription] = useState('');
  const [initiativePriority, setInitiativePriority] = useState<
    'low' | 'medium' | 'high' | 'critical'
  >('medium');
  const [initiativeRisk, setInitiativeRisk] = useState<'low' | 'medium' | 'high'>('medium');
  const [initiativeCategory, setInitiativeCategory] = useState('');
  const [batches, setBatches] = useState<InitiativeBatch[]>([]);
  const [linkedInitiatives, setLinkedInitiatives] = useState<LinkedInitiative[]>([]);
  const [assignments, setAssignments] = useState<AreaAssignment[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [newRole, setNewRole] = useState<RoleRecord['role']>('viewer');
  const [assignAxisId, setAssignAxisId] = useState<number>(1);
  const [assignAreaId, setAssignAreaId] = useState<string>('1A');
  const [assignDueAt, setAssignDueAt] = useState<string>('');
  const [assignUserId, setAssignUserId] = useState<string>('');
  const [actionBusy, setActionBusy] = useState<
    null | 'request-review' | 'approve' | 'send-back' | 'gen-init'
  >(null);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [roleBusyUserId, setRoleBusyUserId] = useState<string | null>(null);
  const [roleEdits, setRoleEdits] = useState<Record<string, RoleRecord['role']>>({});

  const title = useMemo(() => assessmentName || 'Assessment', [assessmentName]);
  const canManageTeam = Boolean(eligibility?.roleInfo?.permissions?.canManageTeam);
  const canManage = Boolean(eligibility?.roleInfo?.permissions?.canManage);
  const assessmentType = String(eligibility?.assessment?.type || '')
    .toUpperCase()
    .trim();
  const isDRD = assessmentType === 'DRD';

  const reload = async () => {
    const [
      rolesResp,
      reqResp,
      assessmentResp,
      eligibilityResp,
      initiativesResp,
      batchesResp,
      assignmentsResp,
    ] = await Promise.all([
      Api.get(`/assessment-workflow-v2/${assessmentId}/roles`),
      Api.get(`/assessment-workflow-v2/${assessmentId}/access-requests`),
      Api.get(`/assessment-workflow-v2/${assessmentId}`),
      Api.get(`/assessment-workflow-v2/${assessmentId}/eligibility`),
      Api.get(`/assessment-workflow-v2/${assessmentId}/generated-initiatives`).catch(() => ({
        initiatives: [],
      })),
      Api.get(`/assessment-workflow-v2/${assessmentId}/initiative-batches`).catch(() => ({
        batches: [],
      })),
      Api.get(`/assessment-workflow-v2/${assessmentId}/assignments`).catch(() => ({
        assignments: [],
      })),
    ]);
    setRoles(Array.isArray(rolesResp?.roles) ? rolesResp.roles : []);
    setRequests(Array.isArray(reqResp?.requests) ? reqResp.requests : []);
    const statusRaw = String(assessmentResp?.status || 'DRAFT').toUpperCase() as WorkflowState;
    setWorkflow({
      assessmentId,
      status: statusRaw,
      updatedAt: assessmentResp?.updated_at || assessmentResp?.updatedAt,
      completionPercent:
        typeof assessmentResp?.completion_percent === 'number'
          ? assessmentResp.completion_percent
          : typeof assessmentResp?.completionPercent === 'number'
            ? assessmentResp.completionPercent
            : undefined,
    });
    const ctx = (assessmentResp?.contextSnapshot || {}) as Record<string, any>;
    setAssessmentContextSnapshot(ctx);
    const audit = (ctx?.audit || {}) as any;
    if (audit?.phase && typeof audit.phase === 'string') {
      const p = String(audit.phase).toUpperCase();
      if (['PREP', 'FIELDWORK', 'VALIDATION', 'REVIEW', 'APPROVAL'].includes(p)) {
        setAuditPhase(p as any);
      }
    }
    if (typeof audit?.notes === 'string') {
      setAuditNotes(audit.notes);
    }
    setEligibility((eligibilityResp as any) || null);
    setLinkedInitiatives(
      Array.isArray((initiativesResp as any)?.initiatives)
        ? (initiativesResp as any).initiatives
        : []
    );
    setBatches(Array.isArray((batchesResp as any)?.batches) ? (batchesResp as any).batches : []);
    setAssignments(
      Array.isArray((assignmentsResp as any)?.assignments)
        ? (assignmentsResp as any).assignments
        : []
    );
  };

  useEffect(() => {
    // Keep role edit state in sync with loaded roles (preserve local edits where possible)
    setRoleEdits((prev) => {
      const next: Record<string, RoleRecord['role']> = { ...prev };
      for (const r of roles) {
        if (!next[r.userId]) next[r.userId] = r.role;
      }
      return next;
    });
  }, [roles]);

  useEffect(() => {
    if (!canManageTeam) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      const q = encodeURIComponent(userQuery || '');
      Api.get(`/assessment-workflow-v2/${assessmentId}/users?query=${q}`)
        .then((resp: any) => {
          if (cancelled) return;
          setUsers(Array.isArray(resp?.users) ? resp.users : []);
        })
        .catch(() => {
          if (cancelled) return;
          setUsers([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [assessmentId, canManageTeam, userQuery]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.resolve()
      .then(async () => {
        await reload();
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load Manage data');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Manage</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {title} • permissions, workflow, and access requests
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['workflow', 'team', 'reports', 'initiatives', 'access', 'logs'] as TabId[]).map(
            (id) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  tab === id
                    ? 'border-purple-200/60 dark:border-purple-900/30 bg-purple-50/70 dark:bg-purple-900/10 text-purple-700 dark:text-purple-200'
                    : 'border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900'
                }`}
              >
                {id === 'workflow'
                  ? 'Workflow'
                  : id === 'team'
                    ? 'Team'
                    : id === 'reports'
                      ? 'Reports'
                      : id === 'initiatives'
                        ? 'Initiatives'
                        : id === 'access'
                          ? 'Access requests'
                          : 'Logs'}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-300">{error}</div>
        ) : tab === 'team' ? (
          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Add member</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Search users in your organization and assign a role.
              </div>
              <div className="mt-3 grid md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">User search</label>
                  <input
                    value={userQuery}
                    onChange={(e) => setUserQuery(e.target.value)}
                    disabled={!canManageTeam}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="name or email…"
                  />
                  <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40">
                    {(users || []).length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 dark:text-slate-400">
                        {canManageTeam
                          ? 'No users found.'
                          : 'You do not have permission to manage team.'}
                      </div>
                    ) : (
                      (users || []).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors ${
                            selectedUserId === u.id ? 'bg-purple-50/70 dark:bg-purple-900/10' : ''
                          }`}
                        >
                          <div className="font-medium text-slate-900 dark:text-white">{u.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {u.email}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Role</label>
                  <select
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    disabled={!canManageTeam}
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                  <button
                    type="button"
                    disabled={!canManageTeam || !selectedUserId || roleBusyUserId !== null}
                    onClick={async () => {
                      setRoleBusyUserId(selectedUserId);
                      setError(null);
                      try {
                        await Api.post(`/assessment-workflow-v2/${assessmentId}/roles`, {
                          userId: selectedUserId,
                          role: newRole,
                        });
                        setSelectedUserId('');
                        await reload();
                      } catch (e: any) {
                        setError(e?.message || 'Failed to assign role');
                      } finally {
                        setRoleBusyUserId(null);
                      }
                    }}
                    className="mt-3 w-full h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                  >
                    {roleBusyUserId === selectedUserId ? 'Assigning…' : 'Assign role'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Assignments
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Assign responsibility for areas (DRD only).
              </div>

              {!isDRD ? (
                <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Assignments UI is currently implemented for DRD assessments.
                </div>
              ) : (
                <>
                  <div className="mt-3 grid md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Axis</label>
                      <select
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                        value={String(assignAxisId)}
                        onChange={(e) => {
                          const nextAxis = Number(e.target.value || 1);
                          setAssignAxisId(nextAxis);
                          const firstArea = DRD_STRUCTURE.find((a) => a.id === nextAxis)?.areas?.[0]
                            ?.id;
                          if (firstArea) setAssignAreaId(firstArea);
                        }}
                      >
                        {DRD_STRUCTURE.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.id}. {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Area</label>
                      <select
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                        value={assignAreaId}
                        onChange={(e) => setAssignAreaId(e.target.value)}
                      >
                        {(DRD_STRUCTURE.find((a) => a.id === assignAxisId)?.areas || []).map(
                          (area) => (
                            <option key={area.id} value={area.id}>
                              {area.id} — {area.name}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">User</label>
                      <select
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                      >
                        <option value="">Select user…</option>
                        {(users || []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Tip: use the search above to find users.
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">Due date</label>
                      <input
                        type="date"
                        value={assignDueAt}
                        onChange={(e) => setAssignDueAt(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={!canManageTeam || !assignAreaId || !assignUserId}
                      onClick={async () => {
                        setError(null);
                        try {
                          await Api.put(`/assessment-workflow-v2/${assessmentId}/assignments`, {
                            areaId: assignAreaId,
                            assignedUserId: assignUserId,
                            dueAt: assignDueAt ? new Date(assignDueAt).toISOString() : null,
                            status: 'ACTIVE',
                          });
                          await reload();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to save assignment');
                        }
                      }}
                      className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                    >
                      Save assignment
                    </button>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200/80 dark:border-navy-700 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-50/80 dark:bg-navy-900/40 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Current assignments ({assignments.length})
                    </div>
                    <div className="divide-y divide-slate-200 dark:divide-navy-800">
                      {assignments.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 dark:text-slate-400">
                          No assignments yet.
                        </div>
                      ) : (
                        assignments.map((a) => {
                          const area = getAreaById(a.area_id);
                          const assignee =
                            roles.find((r) => r.userId === a.assigned_user_id)?.userName ||
                            roles.find((r) => r.userId === a.assigned_user_id)?.userEmail ||
                            a.assigned_user_id;
                          return (
                            <div key={a.id} className="p-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm text-slate-900 dark:text-white truncate">
                                  {a.area_id} — {area?.name || 'Area'}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                  Assigned to: {assignee}
                                  {a.due_at
                                    ? ` • due ${new Date(a.due_at).toLocaleDateString()}`
                                    : ''}
                                </div>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-navy-700 text-slate-600 dark:text-slate-300">
                                {a.status || 'ACTIVE'}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200/60 dark:border-navy-800">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Roles</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Permissions are computed per role (admin/manager/editor/viewer).
                </div>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-navy-800">
                {roles.length === 0 ? (
                  <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                    No roles assigned.
                  </div>
                ) : (
                  roles.map((r) => (
                    <div key={r.id} className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {r.userName || r.userEmail || r.userId}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {r.userEmail || '—'} • {r.role}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 flex-wrap justify-end">
                          <span className="px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40">
                            Edit: {r.canEdit ? 'yes' : 'no'}
                          </span>
                          <span className="px-2 py-1 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/60 dark:bg-navy-900/40">
                            Manage: {r.canManageTeam ? 'yes' : 'no'}
                          </span>
                          <select
                            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-[12px] text-slate-900 dark:text-white"
                            value={roleEdits[r.userId] || r.role}
                            disabled={!canManageTeam || roleBusyUserId === r.userId}
                            onChange={(e) => {
                              const nextRole = e.target.value as RoleRecord['role'];
                              setRoleEdits((prev) => ({ ...prev, [r.userId]: nextRole }));
                            }}
                            aria-label="Role"
                          >
                            <option value="admin">admin</option>
                            <option value="manager">manager</option>
                            <option value="editor">editor</option>
                            <option value="viewer">viewer</option>
                          </select>
                          <button
                            type="button"
                            disabled={
                              !canManageTeam ||
                              roleBusyUserId !== null ||
                              (roleEdits[r.userId] || r.role) === r.role
                            }
                            onClick={async () => {
                              const nextRole = roleEdits[r.userId] || r.role;
                              setRoleBusyUserId(r.userId);
                              setError(null);
                              try {
                                await Api.put(
                                  `/assessment-workflow-v2/${assessmentId}/roles/${r.userId}`,
                                  {
                                    role: nextRole,
                                  }
                                );
                                await reload();
                              } catch (e: any) {
                                setError(e?.message || 'Failed to update role');
                              } finally {
                                setRoleBusyUserId(null);
                              }
                            }}
                            className="h-8 px-3 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-[12px] font-semibold transition-colors"
                          >
                            {roleBusyUserId === r.userId ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            disabled={!canManageTeam || roleBusyUserId !== null}
                            onClick={async () => {
                              if (!confirm('Remove this role assignment?')) return;
                              setRoleBusyUserId(r.userId);
                              setError(null);
                              try {
                                await Api.delete(
                                  `/assessment-workflow-v2/${assessmentId}/roles/${r.userId}`
                                );
                                await reload();
                              } catch (e: any) {
                                setError(e?.message || 'Failed to remove role');
                              } finally {
                                setRoleBusyUserId(null);
                              }
                            }}
                            className="h-8 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : tab === 'initiatives' ? (
          <div className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Initiatives
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Generate, create, and review initiatives linked to this assessment.
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    await reload();
                  } catch (e: any) {
                    setError(e?.message || 'Failed to refresh');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="h-9 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Generate initiatives
              </div>
              <div className="mt-2 grid md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Methodology</label>
                  <select
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    value={methodologyId}
                    onChange={(e) => setMethodologyId(e.target.value as any)}
                  >
                    <option value="impact-feasibility">Impact x Feasibility</option>
                    <option value="moscow">MoSCoW</option>
                    <option value="rice">RICE</option>
                    <option value="value-effort">Value x Effort</option>
                    <option value="strategic-fit">Strategic Fit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Count</label>
                  <select
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    value={String(initiativeCount)}
                    onChange={(e) => setInitiativeCount(Number(e.target.value))}
                  >
                    {[3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeChatContext}
                    onChange={(e) => setIncludeChatContext(e.target.checked)}
                  />
                  Include chat context
                </label>
                <button
                  type="button"
                  disabled={
                    actionBusy !== null || !eligibility?.actions?.generateInitiatives?.allowed
                  }
                  onClick={async () => {
                    setActionBusy('gen-init');
                    setError(null);
                    try {
                      await Api.post(
                        `/assessment-workflow-v2/${assessmentId}/generate-initiatives`,
                        {
                          methodologyId,
                          count: initiativeCount,
                          includeChatContext,
                          ...(decisionOwnerId ? { decisionOwnerId } : {}),
                          ...(decisionDueDate
                            ? { dueDate: new Date(decisionDueDate).toISOString() }
                            : {}),
                          ...(decisionPriority ? { priority: decisionPriority } : {}),
                        }
                      );
                      await reload();
                    } catch (e: any) {
                      setError(e?.message || 'Failed to generate initiatives');
                    } finally {
                      setActionBusy(null);
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                >
                  {actionBusy === 'gen-init' ? 'Generating…' : 'Generate initiatives'}
                </button>
                {!eligibility?.actions?.generateInitiatives?.allowed &&
                (eligibility?.actions?.generateInitiatives?.blockedBy || []).length ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Blocked:{' '}
                    {(eligibility?.actions?.generateInitiatives?.blockedBy || []).join(' • ')}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Create initiative (manual)
              </div>
              <div className="mt-3 grid md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Title</label>
                  <input
                    value={initiativeTitle}
                    onChange={(e) => setInitiativeTitle(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="Initiative title…"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400">Priority</label>
                  <select
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    value={initiativePriority}
                    onChange={(e) => setInitiativePriority(e.target.value as any)}
                  >
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="critical">critical</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Description</label>
                  <textarea
                    value={initiativeDescription}
                    onChange={(e) => setInitiativeDescription(e.target.value)}
                    className="mt-1 w-full min-h-[88px] px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="Short description…"
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Risk</label>
                    <select
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      value={initiativeRisk}
                      onChange={(e) => setInitiativeRisk(e.target.value as any)}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">
                      Category (optional)
                    </label>
                    <input
                      value={initiativeCategory}
                      onChange={(e) => setInitiativeCategory(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      placeholder="e.g. digital_transformation"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  disabled={!initiativeTitle.trim() || actionBusy !== null}
                  onClick={async () => {
                    setActionBusy('gen-init');
                    setError(null);
                    try {
                      await Api.post(`/assessment-workflow-v2/${assessmentId}/initiatives`, {
                        title: initiativeTitle.trim(),
                        description: initiativeDescription.trim()
                          ? initiativeDescription.trim()
                          : null,
                        priority: initiativePriority,
                        risk: initiativeRisk,
                        category: initiativeCategory.trim() ? initiativeCategory.trim() : null,
                      });
                      setInitiativeTitle('');
                      setInitiativeDescription('');
                      setInitiativeCategory('');
                      await reload();
                    } catch (e: any) {
                      setError(e?.message || 'Failed to create initiative');
                    } finally {
                      setActionBusy(null);
                    }
                  }}
                  className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                >
                  Create initiative
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Batches</div>
                <div className="mt-3 space-y-2">
                  {(batches || []).length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No batches yet.
                    </div>
                  ) : (
                    (batches || []).map((b) => (
                      <div key={b.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 dark:text-white truncate">
                            {b.methodologyId} • {b.initiativesCount}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {b.generatedByName} • {new Date(b.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-200/80 dark:border-navy-700 text-slate-600 dark:text-slate-300">
                          {b.includeChatContext ? 'chat' : 'no chat'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Linked initiatives
                </div>
                <div className="mt-3 space-y-2">
                  {(linkedInitiatives || []).length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No initiatives yet.
                    </div>
                  ) : (
                    (linkedInitiatives || []).map((i) => (
                      <div key={i.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 dark:text-white truncate">
                            {i.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {String(i.status || '').toUpperCase()}
                            {i.batch_id ? ` • ${i.batch_id}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = `/initiatives`;
                          }}
                          className="h-8 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
                        >
                          Open
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'reports' ? (
          <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Reports</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Create professional reports from this assessment
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Navigate to Report Builder with assessment pre-selected
                  window.location.href = `/reports/builder?new=true&sourceType=ASSESSMENT&sourceId=${assessmentId}&sourceName=${encodeURIComponent(title)}`;
                }}
                disabled={workflow?.status !== 'APPROVED'}
                className={`
                  flex items-center gap-2 h-10 px-4 rounded-lg font-medium text-sm transition-all
                  ${
                    workflow?.status === 'APPROVED'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                New Report
              </button>
            </div>

            {/* Status info */}
            {workflow?.status !== 'APPROVED' && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <div className="font-medium text-amber-800 dark:text-amber-200">
                      Assessment not approved
                    </div>
                    <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Reports can only be created from approved assessments. Current status:{' '}
                      <strong>{workflow?.status || 'Unknown'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick info */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Report Builder
                </div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                  Create comprehensive reports with customizable sections, AI-generated content, and
                  professional formatting.
                </div>
                <button
                  type="button"
                  onClick={() => (window.location.href = '/reports/builder')}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Open Report Builder →
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Assessment Info
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Status:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {workflow?.status || '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Framework:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {assessmentType || 'DRD'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Completion:</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      {workflow?.completionPercent || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : tab === 'logs' ? (
          <div className="h-[min(72vh,780px)] overflow-auto">
            <ActivityLogPanel assessmentId={assessmentId} />
          </div>
        ) : tab === 'access' ? (
          <div className="divide-y divide-slate-200 dark:divide-navy-800">
            {requests.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
                No access requests.
              </div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {r.requesterName || r.requesterEmail || r.requesterId}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        requests {r.requestedRole} • {r.priority} • {r.status}
                      </div>
                    </div>
                    {r.status === 'PENDING' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!canManage || requestBusyId !== null}
                          onClick={async () => {
                            setRequestBusyId(r.id);
                            setError(null);
                            try {
                              await Api.post(
                                `/assessment-workflow-v2/${assessmentId}/access-requests/${r.id}/approve`,
                                { grantedRole: r.requestedRole }
                              );
                              await reload();
                            } catch (e: any) {
                              setError(e?.message || 'Failed to approve request');
                            } finally {
                              setRequestBusyId(null);
                            }
                          }}
                          className="h-8 px-3 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-[12px] font-semibold transition-colors"
                        >
                          {requestBusyId === r.id ? 'Working…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={!canManage || requestBusyId !== null}
                          onClick={async () => {
                            const reason = window.prompt('Reason for rejection?');
                            if (!reason || reason.trim().length < 2) return;
                            setRequestBusyId(r.id);
                            setError(null);
                            try {
                              await Api.post(
                                `/assessment-workflow-v2/${assessmentId}/access-requests/${r.id}/reject`,
                                { reason: reason.trim() }
                              );
                              await reload();
                            } catch (e: any) {
                              setError(e?.message || 'Failed to reject request');
                            } finally {
                              setRequestBusyId(null);
                            }
                          }}
                          className="h-8 px-3 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-[12px] font-semibold transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                    {r.justification}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Workflow</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Manage preparation → review → approval. Initiatives and reports are in dedicated
                  tabs.
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    await reload();
                  } catch (e: any) {
                    setError(e?.message || 'Failed to refresh');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="h-9 px-3 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Current status
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    {workflow?.status || '—'}
                  </span>
                </div>
                <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                  Completion:{' '}
                  <span className="font-semibold">
                    {typeof workflow?.completionPercent === 'number'
                      ? `${Math.round(workflow.completionPercent)}%`
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Eligibility
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {eligibility?.checks?.every((c) => c.severity !== 'blocking' || c.pass)
                        ? 'Eligible'
                        : 'Blocked'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Role: {eligibility?.roleInfo?.role || '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {(eligibility?.checks || []).map((c) => (
                    <div key={c.key} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-700 dark:text-slate-200 truncate">
                          {c.label}
                        </div>
                        {c.reason ? (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {c.reason}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${
                          c.pass
                            ? 'bg-green-100/60 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200/60 dark:border-green-900/30'
                            : c.severity === 'blocking'
                              ? 'bg-rose-100/60 dark:bg-rose-900/20 text-rose-700 dark:text-rose-200 border-rose-200/60 dark:border-rose-900/30'
                              : 'bg-amber-100/60 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200 border-amber-200/60 dark:border-amber-900/30'
                        }`}
                      >
                        {c.pass ? 'PASS' : c.severity === 'blocking' ? 'BLOCK' : 'WARN'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Audit phase
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Manage preparation and execution phases (stored in context snapshot).
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Phase</label>
                    <select
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      value={auditPhase}
                      onChange={(e) => setAuditPhase(e.target.value as any)}
                      disabled={!canManage}
                    >
                      <option value="PREP">PREP</option>
                      <option value="FIELDWORK">FIELDWORK</option>
                      <option value="VALIDATION">VALIDATION</option>
                      <option value="REVIEW">REVIEW</option>
                      <option value="APPROVAL">APPROVAL</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!canManage}
                      onClick={async () => {
                        setError(null);
                        try {
                          const nextCtx = {
                            ...assessmentContextSnapshot,
                            audit: {
                              ...(assessmentContextSnapshot?.audit || {}),
                              phase: auditPhase,
                              notes: auditNotes,
                              updatedAt: new Date().toISOString(),
                            },
                          };
                          await Api.put(`/assessment-workflow-v2/${assessmentId}`, {
                            contextSnapshot: nextCtx,
                          });
                          await reload();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to save audit phase');
                        }
                      }}
                      className="w-full h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                    >
                      Save phase
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Notes</label>
                  <textarea
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    className="mt-1 w-full min-h-[84px] px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="What is the audit team focusing on right now?"
                    disabled={!canManage}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Decision settings (optional)
                </div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  These fields will be attached to workflow/initiative actions when supported.
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">
                      Decision owner
                    </label>
                    <select
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      value={decisionOwnerId}
                      onChange={(e) => setDecisionOwnerId(e.target.value)}
                      disabled={!canManage}
                    >
                      <option value="">(default: you)</option>
                      {(users || []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Tip: use Team → Add member search to load users into this list.
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Due date</label>
                    <input
                      type="date"
                      value={decisionDueDate}
                      onChange={(e) => setDecisionDueDate(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      disabled={!canManage}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 dark:text-slate-400">Priority</label>
                    <select
                      className="mt-1 w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                      value={decisionPriority}
                      onChange={(e) => setDecisionPriority(e.target.value as any)}
                      disabled={!canManage}
                    >
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Review</div>
                <div className="mt-2 space-y-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Optional note
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    className="w-full min-h-[84px] px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="(optional) what should reviewers focus on?"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={
                        actionBusy !== null || !eligibility?.actions?.requestReview?.allowed
                      }
                      onClick={async () => {
                        setActionBusy('request-review');
                        setError(null);
                        try {
                          await Api.post(`/assessment-workflow-v2/${assessmentId}/request-review`, {
                            ...(reviewComment.trim() ? { comment: reviewComment.trim() } : {}),
                            ...(decisionOwnerId ? { decisionOwnerId } : {}),
                            ...(decisionDueDate
                              ? { dueDate: new Date(decisionDueDate).toISOString() }
                              : {}),
                            ...(decisionPriority ? { priority: decisionPriority } : {}),
                          });
                          await reload();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to submit for review');
                        } finally {
                          setActionBusy(null);
                        }
                      }}
                      className="h-10 px-4 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-semibold transition-colors"
                    >
                      {actionBusy === 'request-review' ? 'Submitting…' : 'Submit for review'}
                    </button>
                    {!eligibility?.actions?.requestReview?.allowed &&
                    (eligibility?.actions?.requestReview?.blockedBy || []).length ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Blocked:{' '}
                        {(eligibility?.actions?.requestReview?.blockedBy || []).join(' • ')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Approval</div>
                <div className="mt-2 space-y-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Send back comment (required)
                  </label>
                  <textarea
                    value={sendBackComment}
                    onChange={(e) => setSendBackComment(e.target.value)}
                    className="w-full min-h-[84px] px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                    placeholder="Explain what needs to be fixed…"
                  />

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={actionBusy !== null || !eligibility?.actions?.approve?.allowed}
                      onClick={async () => {
                        setActionBusy('approve');
                        setError(null);
                        try {
                          await Api.post(`/assessment-workflow-v2/${assessmentId}/approve`, {
                            ...(decisionOwnerId ? { decisionOwnerId } : {}),
                            ...(decisionDueDate
                              ? { dueDate: new Date(decisionDueDate).toISOString() }
                              : {}),
                            ...(decisionPriority ? { priority: decisionPriority } : {}),
                          });
                          await reload();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to approve');
                        } finally {
                          setActionBusy(null);
                        }
                      }}
                      className="h-10 px-4 rounded-lg border border-slate-200/80 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors disabled:opacity-60"
                    >
                      {actionBusy === 'approve' ? 'Approving…' : 'Approve'}
                    </button>

                    <button
                      type="button"
                      disabled={
                        actionBusy !== null ||
                        sendBackComment.trim().length < 2 ||
                        !eligibility?.actions?.sendBack?.allowed
                      }
                      onClick={async () => {
                        setActionBusy('send-back');
                        setError(null);
                        try {
                          await Api.post(`/assessment-workflow-v2/${assessmentId}/send-back`, {
                            comment: sendBackComment.trim(),
                          });
                          await reload();
                        } catch (e: any) {
                          setError(e?.message || 'Failed to send back');
                        } finally {
                          setActionBusy(null);
                        }
                      }}
                      className="h-10 px-4 rounded-lg bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white text-sm font-semibold transition-colors"
                    >
                      {actionBusy === 'send-back' ? 'Sending…' : 'Send back'}
                    </button>
                  </div>
                  {!eligibility?.actions?.approve?.allowed &&
                  (eligibility?.actions?.approve?.blockedBy || []).length ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Approve blocked:{' '}
                      {(eligibility?.actions?.approve?.blockedBy || []).join(' • ')}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
