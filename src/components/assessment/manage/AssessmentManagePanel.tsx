import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ActivityLogPanel } from '@/components/assessment/ActivityLogPanel';
import { InitiativesManagementPanel } from '@/components/assessment/manage/InitiativesManagementPanel';
import { ReportsManagementPanel } from '@/components/assessment/manage/ReportsManagementPanel';
import { TeamManagementPanel } from '@/components/assessment/manage/TeamManagementPanel';
import {
  GateDecision,
  GateType,
  WorkflowStagesTable,
} from '@/components/assessment/manage/WorkflowStagesTable';
import { Api } from '@/services/api';
import { V8AssessmentApi } from '@/services/api/v8';
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

export function AssessmentManagePanel(props: {
  assessmentId: string;
  assessmentName?: string;
  initialTab?: TabId;
  onOpenReport?: (reportId: string) => void;
  onCreateReport?: () => void;
}) {
  const { assessmentId, assessmentName, initialTab, onOpenReport, onCreateReport } = props;
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabId>(initialTab || 'workflow');
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
  const [gateDecisions, setGateDecisions] = useState<GateDecision[]>([]);

  const title = useMemo(() => assessmentName || 'Assessment', [assessmentName]);
  const canManageTeam = Boolean(eligibility?.roleInfo?.permissions?.canManageTeam);
  const canManage = Boolean(eligibility?.roleInfo?.permissions?.canManage);
  const assessmentType = String(eligibility?.assessment?.type || '')
    .toUpperCase()
    .trim();
  const isDRD = assessmentType === 'DRD';

  const workflowGuide = useMemo(() => {
    const status = String(workflow?.status || 'DRAFT').toUpperCase() as WorkflowState;
    const completion = Number(eligibility?.assessment?.completionPercent || 0);
    const confidence = Number(eligibility?.assessment?.confidenceAvg || 0);
    const reportApproved = Boolean((eligibility?.assessment as any)?.reportApprovedAt);

    const steps: Array<{ title: string; detail: string; done?: boolean; next?: boolean }> = [
      {
        title: '1) Uzupełnij assessment (DoD)',
        detail: `Wymagane: completion 100% i confidence >= 3 (teraz: ${completion}% / ${confidence.toFixed(
          1
        )}).`,
        done: completion >= 100 && confidence >= 3,
      },
      {
        title: '2) Submit for review',
        detail: 'W workflow kliknij gate REQUEST_REVIEW (DRAFT → IN_REVIEW).',
        done: status !== 'DRAFT',
      },
      {
        title: '3) Utwórz i wygeneruj raport w Report Builder',
        detail:
          'Kliknij gate GENERATE_REPORT / APPROVE_REPORT → otworzy się Report Builder. Wygeneruj sekcje (Generate), potem Finalize (IN_REVIEW).',
        done: status === 'AWAITING_APPROVAL' || status === 'APPROVED' || reportApproved,
      },
      {
        title: '4) Zatwierdź raport',
        detail:
          'W Report Builder: Finalize → Approve (blokada: otwarte komentarze). Po approve gate APPROVE_REPORT w assessment workflow aktualizuje się automatycznie.',
        done: reportApproved,
      },
      {
        title: '5) Zatwierdź assessment',
        detail: 'Gate APPROVE_ASSESSMENT (AWAITING_APPROVAL → APPROVED).',
        done: status === 'APPROVED',
      },
      {
        title: '6) Wygeneruj inicjatywy',
        detail:
          'Po APPROVED użyj GENERATE_INITIATIVES / New Initiative (inicjatywy widoczne od DRAFT w module).',
        done: false,
      },
    ];

    // Mark the next actionable step
    const nextIdx =
      status === 'DRAFT'
        ? steps[0].done
          ? 1
          : 0
        : status === 'IN_REVIEW'
          ? reportApproved
            ? 4
            : 2
          : status === 'AWAITING_APPROVAL'
            ? 4
            : status === 'APPROVED'
              ? 5
              : 0;
    if (steps[nextIdx]) steps[nextIdx].next = true;

    return { status, steps };
  }, [workflow?.status, eligibility?.assessment]);

  // Allow parent to drive tab selection (e.g., header shortcuts)
  useEffect(() => {
    if (!initialTab) return;
    setTab(initialTab);
  }, [initialTab]);

  const reload = async () => {
    const [
      rolesResp,
      reqResp,
      assessmentResp,
      eligibilityResp,
      initiativesResp,
      batchesResp,
      assignmentsResp,
      gateDecisionsResp,
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
      V8AssessmentApi.listAssignments(assessmentId).catch(() => ({
        assessmentId,
        assignments: [],
      })),
      Api.get(`/assessment-workflow-v2/${assessmentId}/gate-decisions`).catch(() => ({
        decisions: [],
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
    setGateDecisions(
      Array.isArray((gateDecisionsResp as any)?.decisions)
        ? (gateDecisionsResp as any).decisions
        : []
    );
  };

  // Gate action handlers for WorkflowStagesTable
  const handleGateAction = useCallback(
    async (gateType: GateType, action: 'request' | 'approve' | 'reject', comment?: string) => {
      setError(null);
      try {
        if (action === 'request') {
          // Map gate types to existing API endpoints
          if (gateType === 'REQUEST_REVIEW') {
            await Api.post(`/assessment-workflow-v2/${assessmentId}/request-review`, {
              comment,
            });
          } else if (gateType === 'APPROVE_REPORT') {
            // Report Builder is the source of truth for reports.
            // Open the template picker / report creation flow (link-first).
            if (onCreateReport) {
              onCreateReport();
            } else {
              const qs = new URLSearchParams({
                new: 'true',
                sourceType: 'ASSESSMENT',
                sourceId: assessmentId,
                sourceName: assessmentName || 'Assessment',
              });
              navigate(`/reports/builder?${qs.toString()}`);
            }
            // Mark gate as pending (best-effort) to reflect that report work started.
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'PENDING',
            });
          } else if (gateType === 'APPROVE_ASSESSMENT') {
            // This would typically be triggered after report is approved
            // For now, just update the gate decision status
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'PENDING',
            });
          } else if (gateType === 'GENERATE_REPORT') {
            // Report Builder is the source of truth for reports.
            if (onCreateReport) {
              onCreateReport();
            } else {
              const qs = new URLSearchParams({
                new: 'true',
                sourceType: 'ASSESSMENT',
                sourceId: assessmentId,
                sourceName: assessmentName || 'Assessment',
              });
              navigate(`/reports/builder?${qs.toString()}`);
            }
            // Mark gate as pending while the report is being generated in Report Builder.
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'PENDING',
            });
          } else if (gateType === 'GENERATE_INITIATIVES') {
            await Api.post(`/assessment-workflow-v2/${assessmentId}/generate-initiatives`, {
              methodologyId: 'impact-feasibility',
              count: 5,
              includeChatContext: true,
            });
          }
        } else if (action === 'approve') {
          if (gateType === 'APPROVE_ASSESSMENT') {
            await Api.post(`/assessment-workflow-v2/${assessmentId}/approve`, { comment });
          } else if (gateType === 'APPROVE_REPORT') {
            // Approval should be done inside Report Builder review workflow.
            // Keep gate state updated for now.
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'APPROVED',
            });
          } else if (gateType === 'REQUEST_REVIEW') {
            // Approving review request moves to IN_REVIEW
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'APPROVED',
            });
          } else if (gateType === 'GENERATE_REPORT') {
            // Mark report generation as complete
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'APPROVED',
            });
          } else if (gateType === 'GENERATE_INITIATIVES') {
            // Mark initiatives generation as complete
            await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
              status: 'APPROVED',
            });
          }
        } else if (action === 'reject') {
          if (
            gateType === 'REQUEST_REVIEW' ||
            gateType === 'APPROVE_REPORT' ||
            gateType === 'APPROVE_ASSESSMENT'
          ) {
            await Api.post(`/assessment-workflow-v2/${assessmentId}/send-back`, {
              comment: comment || 'Rejected',
            });
          }
          // Also update gate decision status
          await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
            status: 'REJECTED',
          });
        }
        toast.success(`Gate action completed: ${action}`);
        await reload();
      } catch (e: any) {
        const errorMsg = e?.message || `Failed to ${action}`;
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [assessmentId]
  );

  const handleAssignGate = useCallback(
    async (gateType: GateType, assigneeId: string) => {
      setError(null);
      try {
        await Api.put(`/assessment-workflow-v2/${assessmentId}/gate-decisions/${gateType}`, {
          assigneeId,
        });
        toast.success('Assignee updated');
        await reload();
      } catch (e: any) {
        const errorMsg = e?.message || 'Failed to assign gate';
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [assessmentId]
  );

  // Get organizationId from roles or workflow
  const organizationId = useMemo(() => {
    return roles[0]?.organizationId || workflow?.organizationId || null;
  }, [roles, workflow]);

  // Team management handlers - search only within organization members
  const handleSearchUsers = useCallback(
    async (query: string) => {
      if (!organizationId) return [];
      try {
        // Fetch organization members and filter by query
        const members = await Api.get(`/organizations/${organizationId}/members`);
        const membersList = Array.isArray(members) ? members : [];

        const normalized = membersList
          .map((m: any) => ({
            id: m.user_id,
            email: m.email,
            name: [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email,
          }))
          .filter((u: OrgUser) => Boolean(u.id) && Boolean(u.email));

        const q = String(query || '').trim();
        if (q.length < 2) {
          // Default list for the modal (no/short query): show some org users to pick from.
          // Keep it bounded to avoid rendering huge lists.
          return normalized
            .sort((a: OrgUser, b: OrgUser) => (a.name || a.email).localeCompare(b.name || b.email))
            .slice(0, 50);
        }

        const queryLower = q.toLowerCase();
        return normalized
          .filter((u: OrgUser) => {
            const name = (u.name || '').toLowerCase();
            const email = (u.email || '').toLowerCase();
            return name.includes(queryLower) || email.includes(queryLower);
          })
          .slice(0, 50);
      } catch {
        return [];
      }
    },
    [organizationId]
  );

  const handleAddMember = useCallback(
    async (userId: string, role: string) => {
      await Api.post(`/assessment-workflow-v2/${assessmentId}/roles`, {
        userId,
        role,
      });
      toast.success('Member added successfully');
      await reload();
    },
    [assessmentId]
  );

  const handleUpdateMember = useCallback(
    async (userId: string, role: string) => {
      await Api.put(`/assessment-workflow-v2/${assessmentId}/roles/${userId}`, {
        role,
      });
      toast.success('Role updated');
      await reload();
    },
    [assessmentId]
  );

  const handleRemoveMember = useCallback(
    async (userId: string) => {
      await Api.delete(`/assessment-workflow-v2/${assessmentId}/roles/${userId}`);
      toast.success('Member removed');
      await reload();
    },
    [assessmentId]
  );

  const handleAssignArea = useCallback(
    async (areaId: string, userId: string, dueAt?: string) => {
      await V8AssessmentApi.upsertAssignment(assessmentId, {
        areaId,
        assignedUserId: userId,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        status: 'ACTIVE',
      });
      toast.success('Area assigned');
      await reload();
    },
    [assessmentId]
  );

  const handleRemoveAssignment = useCallback(
    async (assignmentId: string) => {
      await V8AssessmentApi.deleteAssignment(assessmentId, assignmentId);
      toast.success('Assignment removed');
      await reload();
    },
    [assessmentId]
  );

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
  }, [assessmentId, assessmentName, navigate, onCreateReport]);

  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Manage</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {title} • permissions, workflow, and logs
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['workflow', 'team', 'reports', 'initiatives', 'logs'] as TabId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                tab === id
                  ? 'border-slate-300 dark:border-white/25 bg-slate-900/[0.07] dark:bg-white/10 text-slate-900 dark:text-slate-100'
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
                      : 'Logs'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 dark:border-navy-800 bg-white/60 dark:bg-navy-900/40 overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-danger-600 dark:text-danger-300">{error}</div>
        ) : tab === 'team' ? (
          <div className="p-4">
            <TeamManagementPanel
              assessmentId={assessmentId}
              assessmentType={assessmentType}
              members={roles.map((r) => ({
                id: r.id,
                assessmentId: r.assessmentId,
                userId: r.userId,
                organizationId: r.organizationId,
                role: r.role,
                canEdit: Boolean(r.canEdit),
                canApprove: Boolean(r.canApprove),
                canManageTeam: Boolean(r.canManageTeam),
                canChangeStatus: Boolean(r.canChangeStatus),
                canGenerateReport: Boolean(r.canGenerateReport),
                canGenerateInitiatives: Boolean(r.canGenerateInitiatives),
                assignedAreas: r.assignedAreas || null,
                assignedBy: r.assignedBy || '',
                assignedAt: r.assignedAt || '',
                updatedAt: r.updatedAt || '',
                userName: r.userName,
                userEmail: r.userEmail,
              }))}
              assignments={assignments.map((a) => ({
                id: a.id,
                assessmentId: a.assessment_id,
                areaId: a.area_id,
                areaName: getAreaById(a.area_id)?.name,
                assignedUserId: a.assigned_user_id,
                assignedUserName: roles.find((r) => r.userId === a.assigned_user_id)?.userName,
                assignedUserEmail: roles.find((r) => r.userId === a.assigned_user_id)?.userEmail,
                assignedBy: a.assigned_by,
                assignedAt: a.assigned_at,
                dueAt: a.due_at,
                status: a.status || 'ACTIVE',
              }))}
              canManageTeam={canManageTeam}
              onRefresh={reload}
              onSearchUsers={handleSearchUsers}
              onAddMember={handleAddMember}
              onUpdateMember={handleUpdateMember}
              onRemoveMember={handleRemoveMember}
              onAssignArea={handleAssignArea}
              onRemoveAssignment={handleRemoveAssignment}
              drdStructure={DRD_STRUCTURE}
            />
          </div>
        ) : tab === 'initiatives' ? (
          <div className="p-4">
            <InitiativesManagementPanel
              assessmentId={assessmentId}
              assessmentName={title}
              workflowStatus={workflow?.status || 'DRAFT'}
              canManage={canManage}
              canGenerateInitiatives={Boolean(eligibility?.actions?.generateInitiatives?.allowed)}
              onRefresh={reload}
              onGenerateInitiatives={async (config) => {
                setActionBusy('gen-init');
                setError(null);
                try {
                  await Api.post(`/assessment-workflow-v2/${assessmentId}/generate-initiatives`, {
                    methodologyId: config.methodologyId,
                    count: config.count,
                    includeChatContext: config.includeChatContext,
                  });
                  await reload();
                } catch (e: any) {
                  setError(e?.message || 'Failed to generate initiatives');
                  throw e;
                } finally {
                  setActionBusy(null);
                }
              }}
            />
          </div>
        ) : tab === 'reports' ? (
          <div className="p-4">
            <ReportsManagementPanel
              assessmentId={assessmentId}
              assessmentName={title}
              workflowStatus={workflow?.status || 'DRAFT'}
              canManage={canManage}
              onRefresh={reload}
              onOpenReport={(reportId) => onOpenReport?.(reportId)}
              onCreateReport={onCreateReport}
              onCreateInitiatives={(reportId) => {
                // Switch to initiatives tab and trigger generation
                setTab('initiatives');
              }}
            />
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
                          className="h-8 px-3 rounded-lg bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:bg-navy-900/40 dark:disabled:bg-[#F4F7FB]/50 text-white dark:text-navy-950 text-[12px] font-semibold transition-colors"
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
                          className="h-8 px-3 rounded-lg bg-danger-500 hover:bg-danger-600 disabled:bg-danger-300 text-white text-[12px] font-semibold transition-colors"
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
          <div className="p-4">
            <WorkflowStagesTable
              assessmentId={assessmentId}
              currentStatus={(workflow?.status as any) || 'DRAFT'}
              completionPercent={
                typeof workflow?.completionPercent === 'number' ? workflow.completionPercent : 0
              }
              confidenceAvg={eligibility?.assessment?.confidenceAvg || 0}
              reportApproved={Boolean((eligibility?.assessment as any)?.reportApprovedAt)}
              eligibilityChecks={(eligibility?.checks || []).map((c) => ({
                key: c.key,
                label: c.label,
                pass: c.pass,
                severity: c.severity,
                reason: c.reason,
              }))}
              gateDecisions={gateDecisions}
              roles={roles.map((r) => ({
                userId: r.userId,
                userName: r.userName,
                userEmail: r.userEmail,
                role: r.role,
              }))}
              canManage={canManage}
              onRefresh={reload}
              onGateAction={handleGateAction}
              onAssignGate={handleAssignGate}
            />
          </div>
        )}
      </div>
    </div>
  );
}
