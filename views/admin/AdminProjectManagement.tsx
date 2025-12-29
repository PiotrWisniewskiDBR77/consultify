import React, { useState, useEffect, useCallback } from 'react';
import { Api } from '../../services/api';
import { useUserCan } from '../../hooks/useUserCan';
import { Project } from '../../types';
import { Plus, Trash2, Layers, Settings, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ProjectGovernance } from '../../components/Admin/ProjectGovernance';
import { InfoButton } from '../../components/shared/InfoButton';


interface AdminProjectManagementProps {
    initialProjects?: Project[];
}

export const AdminProjectManagement: React.FC<AdminProjectManagementProps> = ({ initialProjects }) => {
    const { canDelete, canEdit } = useUserCan();
    const [projects, setProjects] = useState<Project[]>(initialProjects || []);
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedProjectForGovernance, setSelectedProjectForGovernance] = useState<Project | null>(null);

    const loadProjects = useCallback(async () => {
        try {
            const data = await Api.getProjects();
            setProjects(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load projects');
        }
    }, []);

    useEffect(() => {
        if (!initialProjects) {
            loadProjects();
        }
    }, [initialProjects, loadProjects]);

    const handleDeleteProject = async (id: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            await Api.deleteProject(id);
            toast.success('Project deleted');
            loadProjects();
        } catch (e) {
            toast.error('Failed to delete project');
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await Api.createProject({ name: newProjectName });
            toast.success('Project created');
            setNewProjectName('');
            setShowAddProjectModal(false);
            loadProjects();
        } catch (e) {
            toast.error('Failed to create project');
        }
    };

    return (
        <div className="space-y-4 relative">
            <InfoButton cardId="admin-projects" position="top-right" />
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-white">Active Projects</h2>
                <button
                    onClick={() => setShowAddProjectModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus size={16} /> New Project
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.length === 0 ? (
                    <div className="col-span-full bg-navy-900 border border-white/5 rounded-xl p-12 text-center text-slate-500">
                        No projects yet. Create your first project to get started.
                    </div>
                ) : (
                    projects.map(p => (
                        <div
                            key={p.id}
                            className="bg-navy-900 border border-white/5 rounded-xl p-6 hover:bg-navy-800 transition-colors group relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-10 h-10 rounded bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <Layers size={20} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEdit && (
                                        <button
                                            onClick={() => setSelectedProjectForGovernance(p)}
                                            className="text-slate-500 hover:text-purple-400"
                                            title="Governance Settings"
                                        >
                                            <Settings size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDeleteProject(p.id)}
                                            className="text-slate-500 hover:text-red-400"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <h3 className="font-semibold text-white mb-1">{p.name}</h3>
                            <p className="text-xs text-slate-400 mb-4">
                                Owner: {p.owner?.firstName || (p as any).owner_first_name || 'Unknown'} {p.owner?.lastName || (p as any).owner_last_name || ''}
                            </p>
                            <div className="flex justify-between items-center text-xs">
                                <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded capitalize">
                                    {p.status}
                                </span>
                                <span className="text-slate-600">
                                    {(p as any).created_at ? new Date((p as any).created_at).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Add Project Modal */}
            {showAddProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Create New Project</h2>
                            <button onClick={() => setShowAddProjectModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateProject} className="space-y-4">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">
                                    Project Name (e.g. "Digital Transformation 2025")
                                </label>
                                <input
                                    required
                                    value={newProjectName}
                                    onChange={e => setNewProjectName(e.target.value)}
                                    className="w-full bg-navy-950 border border-white/10 rounded p-3 text-white focus:border-purple-500 outline-none"
                                    placeholder="Enter project name..."
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold mt-4"
                            >
                                Create Project
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Project Governance Modal */}
            {selectedProjectForGovernance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-navy-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Settings size={20} className="text-purple-400" />
                                Governance: {selectedProjectForGovernance.name}
                            </h2>
                            <button onClick={() => setSelectedProjectForGovernance(null)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <ProjectGovernance
                            projectId={selectedProjectForGovernance.id}
                            onSave={() => {
                                toast.success('Governance settings saved');
                                setSelectedProjectForGovernance(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProjectManagement;

