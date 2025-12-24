import React, { useState, useEffect } from 'react';
import { X, Mail, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface InviteUserModalProps {
    onClose: () => void;
    onSuccess: () => void;
    projectId?: string; // If provided, creates a project invitation
}

interface Project {
    id: string;
    name: string;
}

const API_URL = '/api';

const InviteUserModal: React.FC<InviteUserModalProps> = ({ onClose, onSuccess, projectId }) => {
    const { currentUser } = useAppStore();
    const token = localStorage.getItem('token');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('USER');
    const [projectRole, setProjectRole] = useState('member');
    const [selectedProject, setSelectedProject] = useState(projectId || '');
    const [isProjectInvite, setIsProjectInvite] = useState(!!projectId);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch projects for project invite option
    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch(`${API_URL}/projects`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
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

        setLoading(true);
        setError(null);

        try {
            const endpoint = isProjectInvite
                ? `${API_URL}/invitations/project`
                : `${API_URL}/invitations/org`;

            const body = isProjectInvite
                ? { projectId: selectedProject, email, projectRole, orgRole: role }
                : { email, role };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send invitation');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERADMIN';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Invite User</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {/* Email Input */}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="colleague@company.com"
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    {/* Invitation Type Toggle */}
                    {!projectId && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Invitation Type
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsProjectInvite(false)}
                                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${!isProjectInvite
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Organization
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsProjectInvite(true)}
                                    className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-colors ${isProjectInvite
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                            <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
                                Project *
                            </label>
                            <select
                                id="project"
                                value={selectedProject}
                                onChange={(e) => setSelectedProject(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
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

                    {/* Organization Role */}
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                            Organization Role
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="USER">User</option>
                            {isAdmin && <option value="ADMIN">Admin</option>}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            {role === 'USER'
                                ? 'Can view and contribute to assigned projects'
                                : 'Can manage organization settings and users'}
                        </p>
                    </div>

                    {/* Project Role (for project invites) */}
                    {isProjectInvite && (
                        <div>
                            <label htmlFor="projectRole" className="block text-sm font-medium text-gray-700 mb-1">
                                Project Role
                            </label>
                            <select
                                id="projectRole"
                                value={projectRole}
                                onChange={(e) => setProjectRole(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                {projectRole === 'member' && 'Can view and contribute to the project'}
                                {projectRole === 'admin' && 'Can manage project settings and members'}
                                {projectRole === 'owner' && 'Full control over the project'}
                            </p>
                        </div>
                    )}

                    {/* Preview */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Invitation Preview</h4>
                        <p className="text-sm text-gray-600">
                            <span className="font-medium">{email || 'user@example.com'}</span> will be invited as a{' '}
                            <span className="font-medium">{role}</span> to the organization
                            {isProjectInvite && selectedProject && (
                                <>
                                    {' '}and as{' '}
                                    <span className="font-medium">{projectRole}</span>
                                    {' '}to the selected project
                                </>
                            )}
                            .
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            The invitation will expire in 7 days.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !email}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Sending...
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
