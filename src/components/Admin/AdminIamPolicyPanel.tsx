import { AlertTriangle, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

type DelegatedRole = {
  id: string;
  name: string;
  capabilities: string[];
};

type AdminIamPolicy = {
  delegatedRoles: DelegatedRole[];
  accessReviewsEnabled: boolean;
  accessReviewCadenceDays: number;
  contextAwareAccessEnabled: boolean;
  privilegedSessionReauthMinutes: number;
  breakGlassEnabled: boolean;
  breakGlassApprovers: string[];
  alertOnPrivilegedChange: boolean;
};

const emptyPolicy: AdminIamPolicy = {
  delegatedRoles: [],
  accessReviewsEnabled: true,
  accessReviewCadenceDays: 90,
  contextAwareAccessEnabled: false,
  privilegedSessionReauthMinutes: 30,
  breakGlassEnabled: false,
  breakGlassApprovers: [],
  alertOnPrivilegedChange: true,
};

export const AdminIamPolicyPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState<AdminIamPolicy>(emptyPolicy);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentForm, setAssignmentForm] = useState({
    userId: '',
    roleId: 'billing_admin',
    roleName: 'Billing Admin',
    capabilities: 'billing:read, billing:write',
    expiresAt: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [result, assignmentResult] = await Promise.all([
          Api.getAdminIAMPolicy(),
          Api.getAdminIAMAssignments(),
        ]);
        setPolicy(result?.policy || emptyPolicy);
        setAssignments(assignmentResult?.assignments || []);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to load IAM policy');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const updateRole = (index: number, changes: Partial<DelegatedRole>) => {
    setPolicy((current) => ({
      ...current,
      delegatedRoles: current.delegatedRoles.map((role, roleIndex) =>
        roleIndex === index ? { ...role, ...changes } : role
      ),
    }));
  };

  const addRole = () => {
    setPolicy((current) => ({
      ...current,
      delegatedRoles: [
        ...current.delegatedRoles,
        { id: `custom_${Date.now()}`, name: 'Custom Admin', capabilities: ['read:admin'] },
      ],
    }));
  };

  const removeRole = (index: number) => {
    setPolicy((current) => ({
      ...current,
      delegatedRoles: current.delegatedRoles.filter((_, roleIndex) => roleIndex !== index),
    }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const result = await Api.updateAdminIAMPolicy(policy);
      setPolicy(result?.policy || policy);
      toast.success('IAM policy updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update IAM policy');
    } finally {
      setSaving(false);
    }
  };

  const createAssignment = async () => {
    if (!assignmentForm.userId.trim()) return;
    try {
      const result = await Api.createAdminIAMAssignment({
        userId: assignmentForm.userId.trim(),
        roleId: assignmentForm.roleId,
        roleName: assignmentForm.roleName,
        capabilities: assignmentForm.capabilities
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        expiresAt: assignmentForm.expiresAt || null,
      });
      setAssignments((current) => [result?.assignment, ...current].filter(Boolean));
      toast.success('Delegated assignment created');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create delegated assignment');
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    try {
      await Api.deleteAdminIAMAssignment(assignmentId);
      setAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
      toast.success('Delegated assignment removed');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete delegated assignment');
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
        Loading IAM policy...
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-5 w-5 text-primary-500" />
            Enterprise IAM Governance
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Define delegated admin roles, access review cadence, break-glass posture, and
            context-aware admin safeguards for this tenant.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save IAM policy'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <label className="rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10">
          <div className="font-medium text-slate-900 dark:text-white">Access reviews</div>
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            Require recurring recertification of privileged admin access.
          </div>
          <input
            type="checkbox"
            checked={policy.accessReviewsEnabled}
            onChange={(event) =>
              setPolicy((current) => ({ ...current, accessReviewsEnabled: event.target.checked }))
            }
            className="mt-3 h-4 w-4"
          />
        </label>

        <label className="rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10">
          <div className="font-medium text-slate-900 dark:text-white">Context-aware access</div>
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            Require stronger checks for privileged sessions and sensitive changes.
          </div>
          <input
            type="checkbox"
            checked={policy.contextAwareAccessEnabled}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                contextAwareAccessEnabled: event.target.checked,
              }))
            }
            className="mt-3 h-4 w-4"
          />
        </label>

        <label className="rounded-xl border border-slate-200 p-4 text-sm dark:border-white/10">
          <div className="font-medium text-slate-900 dark:text-white">Break-glass</div>
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            Allow emergency elevation with explicit approvers and audit requirements.
          </div>
          <input
            type="checkbox"
            checked={policy.breakGlassEnabled}
            onChange={(event) =>
              setPolicy((current) => ({ ...current, breakGlassEnabled: event.target.checked }))
            }
            className="mt-3 h-4 w-4"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Access review cadence (days)
          <input
            type="number"
            min={30}
            value={policy.accessReviewCadenceDays}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                accessReviewCadenceDays: Number(event.target.value || 90),
              }))
            }
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Privileged session reauth (minutes)
          <input
            type="number"
            min={5}
            value={policy.privilegedSessionReauthMinutes}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                privilegedSessionReauthMinutes: Number(event.target.value || 30),
              }))
            }
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
          />
        </label>
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Break-glass approvers
          <input
            type="text"
            value={policy.breakGlassApprovers.join(', ')}
            onChange={(event) =>
              setPolicy((current) => ({
                ...current,
                breakGlassApprovers: event.target.value
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
              }))
            }
            placeholder="owner@company.com, ciso@company.com"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
          />
        </label>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            Privileged admin changes should be combined with tenant audit monitoring and high-risk
            alerting. This policy is stored as the tenant-admin IAM truth surface for P32.
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Delegated admin roles
          </h3>
          <button
            onClick={addRole}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:text-slate-200"
          >
            <Plus className="h-4 w-4" />
            Add delegated role
          </button>
        </div>

        {policy.delegatedRoles.map((role, index) => (
          <div
            key={role.id}
            className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 lg:grid-cols-[180px,1fr,auto]"
          >
            <input
              type="text"
              value={role.name}
              onChange={(event) => updateRole(index, { name: event.target.value })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <input
              type="text"
              value={role.capabilities.join(', ')}
              onChange={(event) =>
                updateRole(index, {
                  capabilities: event.target.value
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean),
                })
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-navy-900 dark:text-white"
            />
            <button
              onClick={() => removeRole(index)}
              className="inline-flex items-center justify-center rounded-lg border border-danger-200 px-3 py-2 text-danger-600 dark:border-danger-500/20 dark:text-danger-300"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">
          Delegated admin assignments
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <input
            type="text"
            value={assignmentForm.userId}
            onChange={(event) =>
              setAssignmentForm((current) => ({ ...current, userId: event.target.value }))
            }
            placeholder="user-id"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
          />
          <input
            type="text"
            value={assignmentForm.roleName}
            onChange={(event) =>
              setAssignmentForm((current) => ({ ...current, roleName: event.target.value }))
            }
            placeholder="Role name"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
          />
          <input
            type="text"
            value={assignmentForm.capabilities}
            onChange={(event) =>
              setAssignmentForm((current) => ({ ...current, capabilities: event.target.value }))
            }
            placeholder="billing:read, billing:write"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-navy-900"
          />
          <button
            onClick={() => void createAssignment()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Assign delegated role
          </button>
        </div>

        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 lg:grid-cols-[1fr,1fr,auto]"
            >
              <div>
                <div className="font-medium text-slate-900 dark:text-white">
                  {assignment.roleName || assignment.roleId}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  User: {assignment.userId}
                </div>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {(assignment.capabilities || []).join(', ') || 'No capabilities'}
              </div>
              <button
                onClick={() => void deleteAssignment(assignment.id)}
                className="inline-flex items-center justify-center rounded-lg border border-danger-200 px-3 py-2 text-danger-600 dark:border-danger-500/20 dark:text-danger-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminIamPolicyPanel;
