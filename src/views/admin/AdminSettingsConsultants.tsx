/**
 * AdminSettingsConsultants - External Consultants Management
 *
 * Features:
 * - Project-level consultant access (not organization)
 * - Access code system (consultants don't consume paid seats)
 * - Granular permissions table
 * - Multi-project assignment for existing consultants
 */

import {
  AlertCircle,
  Briefcase,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  Key,
  Mail,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { EntityStatusChip } from '../../components/ui/primitives/chips/EntityStatusChip';
import { useAppStore } from '../../store/useAppStore';

interface ConsultantProject {
  access_id: string;
  project_id: string;
  projectName: string;
  status: string;
  permissions: Record<string, boolean>;
  invited_at: string;
  accepted_at: string | null;
  access_code: string | null;
}

interface Consultant {
  consultant_id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  projects: ConsultantProject[];
}

interface Project {
  id: string;
  name: string;
  status: string;
}

interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: string;
}

const API_URL = '/api/consultant-project-access';

export const AdminSettingsConsultants: React.FC = () => {
  const { currentOrganization } = useAppStore();
  const token = localStorage.getItem('token');

  // State
  const [consultants, setConsultants] = useState<Consultant[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedConsultants, setExpandedConsultants] = useState<Set<string>>(new Set());

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant | null>(null);
  const [selectedProjectAccess, setSelectedProjectAccess] = useState<ConsultantProject | null>(
    null
  );

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteProjectId, setInviteProjectId] = useState('');
  const [inviteAccessCode, setInviteAccessCode] = useState('');
  const [inviteGenerateCode, setInviteGenerateCode] = useState(true);
  const [invitePermissions, setInvitePermissions] = useState<Record<string, boolean>>({});
  const [inviting, setInviting] = useState(false);

  // Default permissions (all false)
  const defaultPermissions: Record<string, boolean> = {
    canViewProject: false,
    canViewTasks: false,
    canViewInitiatives: false,
    canViewDecisions: false,
    canViewFinancials: false,
    canCreateTasks: false,
    canAssignTasks: false,
    canUpdateTasks: false,
    canDeleteTasks: false,
    canCreateInitiatives: false,
    canUpdateInitiatives: false,
    canDeleteInitiatives: false,
    canRequestDecisions: false,
    canApproveDecisions: false,
    canSubmitChangeRequests: false,
    canApproveChangeRequests: false,
    canComment: false,
    canUseAI: false,
    canEscalate: false,
    canReceiveEscalations: false,
  };

  // Fetch data
  useEffect(() => {
    loadData();
  }, [currentOrganization?.id]);

  const loadData = async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [consultantsRes, projectsRes, permissionsRes] = await Promise.all([
        fetch(API_URL, { headers }),
        fetch(`${API_URL}/projects`, { headers }),
        fetch(`${API_URL}/permission-definitions`, { headers }),
      ]);

      if (consultantsRes.ok) {
        const data = await consultantsRes.json();
        setConsultants(data);
      }

      if (projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(data);
      }

      if (permissionsRes.ok) {
        const data = await permissionsRes.json();
        setPermissionDefinitions(data);
      }
    } catch (error) {
      console.error('Failed to load consultant data:', error);
      toast.error('Failed to load consultant data');
    } finally {
      setLoading(false);
    }
  };

  // Invite consultant
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteProjectId) {
      toast.error('Email and project are required');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch(`${API_URL}/invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          projectId: inviteProjectId,
          permissions: invitePermissions,
          accessCode: inviteAccessCode || undefined,
          generateCode: inviteGenerateCode && !inviteAccessCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Invitation sent to ${inviteEmail}`);
        if (data.accessCode) {
          toast.success(`Access code: ${data.accessCode}`, { duration: 10000 });
        }
        setShowInviteModal(false);
        resetInviteForm();
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to send invitation');
      }
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  // Add project to existing consultant
  const handleAddProject = async (projectId: string) => {
    if (!selectedConsultant) return;

    try {
      const res = await fetch(`${API_URL}/${selectedConsultant.consultant_id}/add-project`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          permissions: defaultPermissions,
        }),
      });

      if (res.ok) {
        toast.success('Project access added');
        setShowAddProjectModal(false);
        loadData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to add project access');
      }
    } catch (error) {
      toast.error('Failed to add project access');
    }
  };

  // Update permissions
  const handleUpdatePermissions = async (permissions: Record<string, boolean>) => {
    if (!selectedProjectAccess) return;

    try {
      const res = await fetch(`${API_URL}/${selectedProjectAccess.access_id}/permissions`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissions }),
      });

      if (res.ok) {
        toast.success('Permissions updated');
        setShowPermissionsModal(false);
        loadData();
      } else {
        toast.error('Failed to update permissions');
      }
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  // Revoke project access
  const handleRevokeAccess = async (accessId: string) => {
    if (!confirm('Are you sure you want to revoke this project access?')) return;

    try {
      const res = await fetch(`${API_URL}/${accessId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Access revoked');
        loadData();
      } else {
        toast.error('Failed to revoke access');
      }
    } catch (error) {
      toast.error('Failed to revoke access');
    }
  };

  // Remove consultant entirely
  const handleRemoveConsultant = async (consultantId: string) => {
    if (!confirm('Are you sure you want to remove this consultant from all projects?')) return;

    try {
      const res = await fetch(`${API_URL}/consultant/${consultantId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        toast.success('Consultant removed');
        loadData();
      } else {
        toast.error('Failed to remove consultant');
      }
    } catch (error) {
      toast.error('Failed to remove consultant');
    }
  };

  // Reset invite form
  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteProjectId('');
    setInviteAccessCode('');
    setInviteGenerateCode(true);
    setInvitePermissions({ ...defaultPermissions });
  };

  // Toggle consultant expansion
  const toggleExpand = (consultantId: string) => {
    setExpandedConsultants((prev) => {
      const next = new Set(prev);
      if (next.has(consultantId)) {
        next.delete(consultantId);
      } else {
        next.add(consultantId);
      }
      return next;
    });
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Group permissions by category
  const groupedPermissions = permissionDefinitions.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    },
    {} as Record<string, PermissionDefinition[]>
  );

  // Get projects not yet assigned to a consultant
  const getUnassignedProjects = (consultant: Consultant) => {
    const assignedIds = new Set(consultant.projects.map((p) => p.project_id));
    return projects.filter((p) => !assignedIds.has(p.id));
  };

  // Count active permissions
  const countActivePermissions = (permissions: Record<string, boolean>) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-navy-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-c-text-muted" />
            External Consultants
          </h2>
          <p className="text-c-text-secondary text-sm mt-1">
            Manage external advisors with project-level access. Consultants don't consume your paid
            seat pool.
          </p>
        </div>
        <button
          onClick={() => {
            resetInviteForm();
            setShowInviteModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-c-surface-raised/40 hover:bg-slate-200 dark:bg-c-surface/5 dark:hover:bg-c-surface/10 text-navy-900 dark:text-white rounded-lg font-medium transition-colors border border-c-border-subtle"
        >
          <UserPlus size={18} />
          Invite Consultant
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex items-start gap-3">
        <Key className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-300">
          <p className="font-medium mb-1">Free consultant seats with access codes</p>
          <p className="text-blue-400/80">
            Consultants invited with an access code don't count against your organization's paid
            seats. This encourages consultants to use the platform widely. Generate codes when
            inviting or use existing ones.
          </p>
        </div>
      </div>

      {/* Consultants Table */}
      <div className="admin-card rounded-xl overflow-hidden">
        <table /* §27-todo: lista encji → migracja do FilterableTable + Menu 1/2/3 (kanon §2); swiadomie oznaczona, nie przepisana w tej sesji */  className="w-full text-left text-sm">
          <thead className="bg-c-bg dark:bg-c-surface/[0.02] text-c-text-muted font-medium border-b border-c-border-subtle">
            <tr>
              <th className="px-6 py-4 w-8"></th>
              <th className="px-6 py-4">Consultant</th>
              <th className="px-6 py-4">Projects</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-c-text-muted">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading consultants...
                </td>
              </tr>
            ) : consultants.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-c-text-muted">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="w-12 h-12 text-c-text-secondary" />
                    <p>No consultants linked to this organization yet.</p>
                    <button
                      onClick={() => {
                        resetInviteForm();
                        setShowInviteModal(true);
                      }}
                      className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      <UserPlus size={14} /> Invite your first consultant
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              consultants.map((consultant) => (
                <React.Fragment key={consultant.consultant_id}>
                  <tr className="hover:bg-c-surface/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleExpand(consultant.consultant_id)}
                        className="text-c-text-muted hover:text-white transition-colors"
                      >
                        {expandedConsultants.has(consultant.consultant_id) ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-c-text-secondary flex items-center justify-center font-medium text-xs">
                          {consultant.firstName?.[0] || consultant.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-navy-900 dark:text-white">
                            {consultant.firstName && consultant.lastName
                              ? `${consultant.firstName} ${consultant.lastName}`
                              : consultant.email}
                          </p>
                          <p className="text-xs text-c-text-muted">
                            {consultant.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-c-text-muted">
                        {consultant.projects.length} project
                        {consultant.projects.length !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {consultant.projects.some((p) => p.status === 'ACTIVE') ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedConsultant(consultant);
                            setShowAddProjectModal(true);
                          }}
                          className="text-c-text-muted hover:text-navy-900 dark:hover:text-white transition-colors p-2 hover:bg-c-surface-raised dark:hover:bg-c-surface/5 rounded-lg"
                          title="Add to project"
                        >
                          <FolderPlus size={16} />
                        </button>
                        <button
                          onClick={() => handleRemoveConsultant(consultant.consultant_id)}
                          className="text-c-text-muted hover:text-danger-400 transition-colors p-2 hover:bg-danger-500/10 rounded-lg"
                          title="Remove consultant"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded project details */}
                  {expandedConsultants.has(consultant.consultant_id) && (
                    <tr>
                      <td colSpan={5} className="bg-c-bg/50 dark:bg-c-surface/[0.01] px-6 py-4">
                        <div className="ml-8 space-y-3">
                          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider mb-2">
                            Project Access
                          </p>
                          {consultant.projects.map((project) => (
                            <div
                              key={project.access_id}
                              className="flex items-center justify-between bg-c-surface-raised/40 dark:bg-c-surface/[0.02] border border-c-border-subtle rounded-lg p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Briefcase className="w-4 h-4 text-c-text-muted" />
                                <div>
                                  <p className="font-medium text-navy-900 dark:text-white">
                                    {project.projectName}
                                  </p>
                                  <p className="text-xs text-c-text-muted">
                                    {countActivePermissions(project.permissions)} permissions active
                                    {project.access_code && (
                                      <span className="ml-2 text-blue-400">
                                        • Free seat (code: {project.access_code})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <EntityStatusChip status={project.status} />
                                <button
                                  onClick={() => {
                                    setSelectedProjectAccess(project);
                                    setShowPermissionsModal(true);
                                  }}
                                  className="text-c-text-muted hover:text-navy-900 dark:hover:text-white transition-colors p-1.5 hover:bg-slate-200 dark:hover:bg-c-surface/5 rounded"
                                  title="Edit permissions"
                                >
                                  <Settings size={14} />
                                </button>
                                <button
                                  onClick={() => handleRevokeAccess(project.access_id)}
                                  className="text-c-text-muted hover:text-danger-400 transition-colors p-1.5 hover:bg-danger-500/10 rounded"
                                  title="Revoke access"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-c-border-subtle flex justify-between items-center flex-shrink-0">
              <div>
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white">
                  Invite Consultant
                </h3>
                <p className="text-sm text-c-text-secondary mt-1">
                  Assign to a project with specific permissions
                </p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-c-text-muted hover:text-navy-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Consultant Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-2.5 text-c-text-muted"
                      size={18}
                    />
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="consultant@firm.com"
                      className="w-full pl-10 pr-4 py-2 bg-c-bg dark:bg-c-surface/5 border border-c-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-navy-900 dark:text-white placeholder:text-c-text-muted dark:placeholder:text-c-text-secondary"
                    />
                  </div>
                </div>

                {/* Project */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Assign to Project
                  </label>
                  <select
                    required
                    value={inviteProjectId}
                    onChange={(e) => setInviteProjectId(e.target.value)}
                    className="w-full px-4 py-2 bg-c-bg dark:bg-c-surface/5 border border-c-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-navy-900 dark:text-white"
                  >
                    <option value="" className="bg-c-surface">
                      Select a project...
                    </option>
                    {projects.map((project) => (
                      <option
                        key={project.id}
                        value={project.id}
                        className="bg-c-surface"
                      >
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Access Code Section */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-300">
                        Free Seat Access Code
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-c-text-muted">
                      <input
                        type="checkbox"
                        checked={inviteGenerateCode}
                        onChange={(e) => {
                          setInviteGenerateCode(e.target.checked);
                          if (e.target.checked) setInviteAccessCode('');
                        }}
                        className="rounded border-c-border bg-c-surface/5 text-blue-500 focus:ring-blue-500"
                      />
                      Auto-generate code
                    </label>
                  </div>

                  {!inviteGenerateCode && (
                    <input
                      type="text"
                      value={inviteAccessCode}
                      onChange={(e) => setInviteAccessCode(e.target.value.toUpperCase())}
                      placeholder="Enter existing code (e.g., CONS-A1B2C3D4)"
                      className="w-full px-4 py-2 bg-c-bg/30 dark:bg-navy-950/20 border border-c-border-subtle rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-c-text font-mono placeholder:text-c-text-secondary"
                    />
                  )}

                  <p className="text-xs text-blue-400/70 mt-2">
                    With an access code, this consultant won't consume your organization's paid seat
                    pool.
                  </p>
                </div>

                {/* Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Initial Permissions
                    </label>
                    <span className="text-xs text-c-text-muted">
                      {countActivePermissions(invitePermissions)}/
                      {Object.keys(defaultPermissions).length} enabled
                    </span>
                  </div>

                  <div className="bg-c-surface/[0.02] border border-c-border-subtle rounded-lg p-4 max-h-64 overflow-y-auto">
                    <div className="space-y-4">
                      {Object.entries(groupedPermissions).map(([category, perms]) => (
                        <div key={category}>
                          <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider mb-2">
                            {category}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {perms.map((perm) => (
                              <label
                                key={perm.key}
                                className="flex items-center gap-2 p-2 rounded hover:bg-c-surface-raised/20 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={invitePermissions[perm.key] || false}
                                  onChange={(e) =>
                                    setInvitePermissions({
                                      ...invitePermissions,
                                      [perm.key]: e.target.checked,
                                    })
                                  }
                                  className="rounded border-c-border bg-c-surface/5 text-blue-500 focus:ring-blue-500"
                                />
                                <div>
                                  <span className="text-sm text-c-text">{perm.label}</span>
                                  <p className="text-xs text-c-text-muted">
                                    {perm.description}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-c-text-muted mt-2">
                    <AlertCircle className="inline w-3 h-3 mr-1" />
                    Consultants start with no permissions by default. Enable only what's needed.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-c-border-subtle flex gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 bg-c-bg/30 dark:bg-navy-950/20 text-slate-300 rounded-lg hover:bg-c-surface-raised/40 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail || !inviteProjectId}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {inviting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Project Modal */}
      {showAddProjectModal && selectedConsultant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-c-surface border border-c-border-subtle rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-c-border-subtle flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-c-text">Add to Project</h3>
                <p className="text-sm text-c-text-muted mt-1">
                  {selectedConsultant.email}
                </p>
              </div>
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="text-c-text-muted hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-c-text-muted mb-4">
                Select a project to add this consultant to:
              </p>

              {getUnassignedProjects(selectedConsultant).length === 0 ? (
                <p className="text-c-text-muted text-center py-4">
                  This consultant already has access to all projects.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getUnassignedProjects(selectedConsultant).map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleAddProject(project.id)}
                      className="w-full flex items-center gap-3 p-3 bg-c-surface/[0.02] hover:bg-c-surface-raised/20 border border-c-border-subtle rounded-lg transition-colors text-left"
                    >
                      <Briefcase className="w-4 h-4 text-c-text-muted" />
                      <div>
                        <p className="font-medium text-c-text">{project.name}</p>
                        <EntityStatusChip status={project.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-c-border-subtle">
              <button
                onClick={() => setShowAddProjectModal(false)}
                className="w-full px-4 py-2 bg-c-bg/30 dark:bg-navy-950/20 text-slate-300 rounded-lg hover:bg-c-surface-raised/40 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedProjectAccess && (
        <PermissionsModal
          projectAccess={selectedProjectAccess}
          permissionDefinitions={permissionDefinitions}
          groupedPermissions={groupedPermissions}
          onClose={() => setShowPermissionsModal(false)}
          onSave={handleUpdatePermissions}
        />
      )}
    </div>
  );
};

// Separate Permissions Modal Component
const PermissionsModal: React.FC<{
  projectAccess: ConsultantProject;
  permissionDefinitions: PermissionDefinition[];
  groupedPermissions: Record<string, PermissionDefinition[]>;
  onClose: () => void;
  onSave: (permissions: Record<string, boolean>) => void;
}> = ({ projectAccess, groupedPermissions, onClose, onSave }) => {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    projectAccess.permissions || {}
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(permissions);
    setSaving(false);
  };

  const countActive = Object.values(permissions).filter(Boolean).length;
  const total = Object.keys(permissions).length;

  // Quick actions
  const enableAll = () => {
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach((key) => (newPerms[key] = true));
    setPermissions(newPerms);
  };

  const disableAll = () => {
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach((key) => (newPerms[key] = false));
    setPermissions(newPerms);
  };

  const enableViewOnly = () => {
    const newPerms = { ...permissions };
    Object.keys(newPerms).forEach((key) => {
      newPerms[key] = key.startsWith('canView');
    });
    setPermissions(newPerms);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-c-surface border border-c-border-subtle rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-c-border-subtle flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-c-text">Edit Permissions</h3>
            <p className="text-sm text-c-text-muted mt-1">
              {projectAccess.projectName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-c-text-muted hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {/* Quick actions */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-c-text-muted mr-2">Quick:</span>
            <button
              onClick={enableViewOnly}
              className="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded hover:bg-blue-500/20 transition-colors"
            >
              <Eye className="inline w-3 h-3 mr-1" />
              View Only
            </button>
            <button
              onClick={enableAll}
              className="px-3 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/20 rounded hover:bg-green-500/20 transition-colors"
            >
              <Check className="inline w-3 h-3 mr-1" />
              Enable All
            </button>
            <button
              onClick={disableAll}
              className="px-3 py-1 text-xs bg-danger-500/10 text-danger-400 border border-danger-500/20 rounded hover:bg-danger-500/20 transition-colors"
            >
              <EyeOff className="inline w-3 h-3 mr-1" />
              Disable All
            </button>
            <span className="ml-auto text-xs text-c-text-muted">
              {countActive}/{total} enabled
            </span>
          </div>

          {/* Permissions grid */}
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <div key={category}>
                <p className="text-xs font-medium text-c-text-muted uppercase tracking-wider mb-3">
                  {category}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map((perm) => (
                    <label
                      key={perm.key}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        permissions[perm.key]
                          ? 'bg-blue-500/10 border border-blue-500/20'
                          : 'bg-c-surface/[0.02] border border-c-border-subtle hover:bg-c-surface-raised/20'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={permissions[perm.key] || false}
                        onChange={(e) =>
                          setPermissions({
                            ...permissions,
                            [perm.key]: e.target.checked,
                          })
                        }
                        className="rounded border-c-border bg-c-surface/5 text-blue-500 focus:ring-blue-500"
                      />
                      <div>
                        <span
                          className={`text-sm ${permissions[perm.key] ? 'text-c-text' : 'text-slate-300'}`}
                        >
                          {perm.label}
                        </span>
                        <p className="text-xs text-c-text-muted">
                          {perm.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-c-border-subtle flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-c-bg/30 dark:bg-navy-950/20 text-slate-300 rounded-lg hover:bg-c-surface-raised/40 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={16} />
                Save Permissions
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
