import { AlertCircle, CreditCard, Loader2, Mail, Plus, UserPlus, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { useAppStore } from '../store/useAppStore';
import { isAdminOrSuperAdminRole } from '../utils/roleGuards';

interface InviteUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
  projectId?: string; // If provided, creates a project invitation
}

interface Project {
  id: string;
  name: string;
}

interface SeatInfo {
  maxSeats: number;
  seatsUsed: number;
  seatsRemaining: number;
  canAddSeats: boolean;
  seatPrice: number;
  currency: string;
  isPaidOrg: boolean;
}

const API_URL = '/api';
const INVITE_SEAT_ADD_FAILED_COPY = 'Could not add a seat. Try again or contact support.';
const INVITE_SEND_FAILED_COPY = 'Could not send invitation. Try again or contact support.';

const InviteUserModal: React.FC<InviteUserModalProps> = ({ onClose, onSuccess, projectId }) => {
  const { currentUser } = useAppStore();
  const token = localStorage.getItem('token');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('USER');
  const [projectRole, setProjectRole] = useState('TEAM_MEMBER');
  const [selectedProject, setSelectedProject] = useState(projectId || '');
  const [isProjectInvite, setIsProjectInvite] = useState(!!projectId);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // Seat management state
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null);
  const [autoAddSeat, setAutoAddSeat] = useState(false);
  const [addingSeat, setAddingSeat] = useState(false);

  // Fetch projects for project invite option
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/projects`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setProjects(data);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };

    fetchProjects();
  }, [token]);

  // Fetch seat availability
  useEffect(() => {
    const fetchSeatInfo = async () => {
      try {
        const res = await fetch(`${API_URL}/billing/seats`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          setSeatInfo(data);
          // Auto-enable add seat if no seats remaining
          if (data.seatsRemaining === 0 && data.canAddSeats) {
            setAutoAddSeat(true);
          }
        }
      } catch (err) {
        console.error('Failed to fetch seat info:', err);
      }
    };

    fetchSeatInfo();
  }, [token]);

  // Check if seats are full
  const seatsAreFull = seatInfo && seatInfo.seatsRemaining === 0 && !seatInfo.isPaidOrg;
  const canProceed = !seatsAreFull || autoAddSeat;

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (isProjectInvite && !selectedProject) {
      setError('Please select a project');
      return;
    }

    // Check if we need to add a seat first
    if (seatsAreFull && !autoAddSeat) {
      setError(
        'Please enable "Add seat automatically" to proceed, or contact your administrator to upgrade your plan.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      // Step 1: Add seat if needed
      if (seatsAreFull && autoAddSeat) {
        setAddingSeat(true);
        const addSeatRes = await fetch(`${API_URL}/billing/seats/add`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quantity: 1 }),
        });

        const addSeatData = await addSeatRes.json();
        setAddingSeat(false);

        if (!addSeatRes.ok) {
          const rawCode = addSeatData?.error?.code || addSeatData?.code;
          const nextCode =
            typeof rawCode === 'string' && rawCode.trim().length > 0 ? rawCode.trim() : null;
          setErrorCode(nextCode);
          setError(INVITE_SEAT_ADD_FAILED_COPY);
          return;
        }

        // Update local seat info
        if (seatInfo) {
          setSeatInfo({
            ...seatInfo,
            maxSeats: addSeatData.newMaxSeats,
            seatsRemaining: addSeatData.newMaxSeats - seatInfo.seatsUsed,
          });
        }
      }

      // Step 2: Send invitation
      const endpoint = isProjectInvite
        ? `${API_URL}/invitations/project`
        : `${API_URL}/invitations/org`;

      const body = isProjectInvite
        ? { projectId: selectedProject, email, projectRole, orgRole: role }
        : { email, role };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const rawCode = data?.error?.code || data?.code;
        const nextCode =
          typeof rawCode === 'string' && rawCode.trim().length > 0 ? rawCode.trim() : null;
        setErrorCode(nextCode);
        setError(INVITE_SEND_FAILED_COPY);
        return;
      }

      onSuccess();
    } catch (err) {
      setErrorCode(null);
      setError(INVITE_SEND_FAILED_COPY);
    } finally {
      setLoading(false);
      setAddingSeat(false);
    }
  };

  const isAdmin = isAdminOrSuperAdminRole(currentUser?.role);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-navy-800 rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite User</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Seat Limit Warning */}
          {seatsAreFull && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/25 dark:border-amber-900/50 dark:text-amber-200 px-4 py-3 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Organization has reached maximum seats.</p>
                  <p className="text-amber-700 text-xs mt-1">
                    {seatInfo?.seatsUsed}/{seatInfo?.maxSeats} seats used.
                    {seatInfo?.canAddSeats &&
                      ` Add a seat for $${seatInfo?.seatPrice}/month to continue.`}
                  </p>

                  {/* Auto-add seat option */}
                  {seatInfo?.canAddSeats && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer bg-white/50 p-2 rounded-lg border border-amber-300">
                      <input
                        type="checkbox"
                        checked={autoAddSeat}
                        onChange={(e) => setAutoAddSeat(e.target.checked)}
                        className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-amber-900 flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          Add seat automatically
                        </span>
                        <span className="text-xs text-amber-600 block">
                          +${seatInfo?.seatPrice}/{seatInfo?.currency}/month will be added to your
                          billing
                        </span>
                      </div>
                      <CreditCard className="w-4 h-4 text-amber-600" />
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="bg-danger-50 border border-danger-200 text-danger-700 dark:bg-danger-900/30 dark:border-danger-900/60 dark:text-danger-300 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <div className="min-w-0">
                <div>{error}</div>
                {errorCode ? (
                  <div
                    data-testid="invite-user-error-code"
                    className="mt-1 text-[11px] font-medium text-danger-700/90 dark:text-danger-300/90"
                  >
                    Code: {errorCode}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* Email Input */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email Address *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600 dark:text-gray-400" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Invitation Type Toggle */}
          {!projectId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Invitation Type
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsProjectInvite(false)}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    !isProjectInvite
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-white dark:bg-navy-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-700'
                  }`}
                >
                  Organization
                </button>
                <button
                  type="button"
                  onClick={() => setIsProjectInvite(true)}
                  className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${
                    isProjectInvite
                      ? 'bg-navy-900 text-white border-navy-900'
                      : 'bg-white dark:bg-navy-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-navy-700 hover:bg-gray-50 dark:hover:bg-navy-700'
                  }`}
                >
                  Project
                </button>
              </div>
            </div>
          )}

          {/* Project Selection (for project invites) */}
          {isProjectInvite && !projectId && (
            <div>
              <label
                htmlFor="project"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Project *
              </label>
              <select
                id="project"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-2 bg-white dark:bg-navy-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Account Type (Organization-level permission) */}
          <div>
            <label
              htmlFor="role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Account Type
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-navy-900 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="USER">User</option>
              {isAdmin && <option value="ADMIN">Admin</option>}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {role === 'USER'
                ? 'Can view and contribute to assigned projects'
                : 'Can manage organization settings and users'}
            </p>
          </div>

          {/* Project Role (for project invites) */}
          {isProjectInvite && (
            <div>
              <label
                htmlFor="projectRole"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Project Role
              </label>
              <select
                id="projectRole"
                value={projectRole}
                onChange={(e) => setProjectRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="PROJECT_EXECUTIVE">Project Executive / Sponsor</option>
                <option value="PROJECT_MANAGER">Project Manager</option>
                <option value="TEAM_LEAD">Team Lead</option>
                <option value="TEAM_MEMBER">Team Member</option>
                <option value="STAKEHOLDER">Stakeholder / Viewer</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {projectRole === 'PROJECT_EXECUTIVE' && 'Strategic oversight and sponsorship'}
                {projectRole === 'PROJECT_MANAGER' && 'Full project management responsibilities'}
                {projectRole === 'TEAM_LEAD' && 'Leads a workstream or team within the project'}
                {projectRole === 'TEAM_MEMBER' && 'Executes tasks and contributes to deliverables'}
                {projectRole === 'STAKEHOLDER' && 'View-only access to project progress'}
              </p>
            </div>
          )}

          {/* Preview */}
          <div className="bg-gray-50 dark:bg-navy-800 rounded-lg p-4 border border-gray-200 dark:border-navy-700">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Invitation Preview
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{email || 'user@example.com'}</span> will be invited
              with <span className="font-medium">{role}</span> account type
              {isProjectInvite && selectedProject && (
                <>
                  {' '}
                  and <span className="font-medium">{projectRole.replace(/_/g, ' ')}</span> project
                  role
                </>
              )}
              .
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              The invitation will expire in 7 days.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-navy-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-navy-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !email || (seatsAreFull ? !autoAddSeat : false)}
              className="flex-1 px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                addingSeat ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding Seat...
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                )
              ) : seatsAreFull && autoAddSeat ? (
                <>
                  <Plus className="w-4 h-4" />
                  Add Seat & Invite
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InviteUserModal;
