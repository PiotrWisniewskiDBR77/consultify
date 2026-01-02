import React, { useState, useEffect, useCallback } from 'react';
import { Api } from '../../services/api';
import { useUserCan } from '../../hooks/useUserCan';
import { Project } from '../../types';
import {
    Plus, Trash2, Layers, Settings, X, LayoutGrid, List,
    Users, Target, FileText, PieChart, Info, Search, ChevronRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ProjectGovernance } from '../../components/Admin/ProjectGovernance';
import { InfoButton } from '../../components/shared/InfoButton';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface AdminProjectManagementProps {
    initialProjects?: Project[];
}

export const AdminProjectManagement: React.FC<AdminProjectManagementProps> = ({ initialProjects }) => {
    const { canDelete, canEdit } = useUserCan();
    const [projects, setProjects] = useState<Project[]>(initialProjects || []);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddProjectModal, setShowAddProjectModal] = useState(false);
    const [selectedProjectForGovernance, setSelectedProjectForGovernance] = useState<Project | null>(null);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        goal: ''
    });

    const loadProjects = useCallback(async () => {
        try {
            setLoading(true);
            const data = await Api.getProjects();
            setProjects(Array.isArray(data) ? data : (data as any).projects || []);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load projects');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialProjects && initialProjects.length > 0) {
            setProjects(initialProjects);
        }
    }, [initialProjects]);

    useEffect(() => {
        if (!initialProjects || initialProjects.length === 0) {
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
            await Api.createProject(formData);
            toast.success('Project created');
            setFormData({ name: '', description: '', goal: '' });
            setShowAddProjectModal(false);
            loadProjects();
        } catch (e) {
            toast.error('Failed to create project');
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const StatBadge = ({ icon: Icon, count, label, color = "indigo" }: any) => (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-${color}-500/5 border border-${color}-500/10 text-xs text-slate-500 dark:text-slate-400`} title={label}>
            <Icon size={12} className={`text-${color}-600 dark:text-${color}-400`} />
            <span className="font-medium text-slate-700 dark:text-slate-300">{count || 0}</span>
        </div>
    );

    return (
        <div className="space-y-4 relative pb-20">
            <InfoButton cardId="admin-projects" position="top-right" />

            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-1">Project Command Center</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Manage transformation projects, teams, and knowledge assets.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 dark:bg-navy-900 p-1 rounded-lg border border-slate-200 dark:border-white/5">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-500 hover:text-navy-900 dark:hover:text-slate-300'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' : 'text-slate-500 hover:text-navy-900 dark:hover:text-slate-300'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAddProjectModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all text-sm font-semibold shadow-lg shadow-green-900/20"
                    >
                        <Plus size={18} /> New Project
                    </button>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg text-navy-900 dark:text-white focus:border-purple-500 outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-xl p-16 text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto text-slate-400 dark:text-slate-600">
                        <Layers size={32} />
                    </div>
                    <div>
                        <h3 className="text-navy-900 dark:text-white font-medium">No projects found</h3>
                        <p className="text-slate-600 dark:text-slate-500 text-sm mt-1">Start by creating a new project to organize your transformation assets.</p>
                    </div>
                    <button
                        onClick={() => setShowAddProjectModal(true)}
                        className="text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 text-sm font-medium"
                    >
                        + Create First Project
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProjects.map(p => (
                        <div
                            key={p.id}
                            onClick={() => {
                                useAppStore.getState().setCurrentProjectId(p.id);
                                useAppStore.getState().setCurrentView(AppView.ADMIN_PROJECT_DETAILS);
                            }}
                            className="bg-white dark:bg-navy-900/50 backdrop-blur-sm border border-slate-200 dark:border-white/10 rounded-2xl p-6 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all group relative border-l-4 border-l-purple-500 cursor-pointer shadow-sm dark:shadow-none"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                                    <Layers size={22} />
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {canEdit && (
                                        <button
                                            onClick={() => setSelectedProjectForGovernance(p)}
                                            className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-white/10 shadow-sm"
                                            title="Project Settings"
                                        >
                                            <Settings size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDeleteProject(p.id)}
                                            className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/10 shadow-sm"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <h3 className="font-bold text-navy-900 dark:text-white text-lg mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">{p.name}</h3>

                            {p.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4 h-10">
                                    {p.description}
                                </p>
                            )}

                            {!p.description && (
                                <p className="text-sm text-slate-400 dark:text-slate-600 italic mb-4 h-10">No description provided.</p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-6">
                                <StatBadge icon={Users} count={p.memberCount} label="Team Members" color="blue" />
                                <StatBadge icon={Target} count={p.initiativeCount} label="Initiatives" color="green" />
                                <StatBadge icon={PieChart} count={p.assessmentCount} label="Assessments" color="amber" />
                                <StatBadge icon={FileText} count={p.documentCount} label="Documents" color="slate" />
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-[10px] text-navy-900 dark:text-white">
                                        {p.owner?.firstName?.[0] || (p as any).owner_first_name?.[0] || 'U'}
                                    </div>
                                    <span className="text-slate-600 dark:text-slate-400 capitalize">
                                        {p.status}
                                    </span>
                                </div>
                                <span className="text-slate-400 dark:text-slate-600">
                                    {new Date(p.createdAt || (p as any).created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* List View */
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm dark:shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-white/5">
                                <th className="px-6 py-4">Project</th>
                                <th className="px-6 py-4">Team</th>
                                <th className="px-6 py-4">Assets</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Owner</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredProjects.map(p => (
                                <tr
                                    key={p.id}
                                    onClick={() => {
                                        useAppStore.getState().setCurrentProjectId(p.id);
                                        useAppStore.getState().setCurrentView(AppView.ADMIN_PROJECT_DETAILS);
                                    }}
                                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                                                <Layers size={18} />
                                            </div>
                                            <div>
                                                <div className="text-navy-900 dark:text-white font-medium group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">{p.name}</div>
                                                <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1 max-w-[200px]">{p.description || 'No description'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5 text-slate-300">
                                            <Users size={14} className="text-blue-400" />
                                            <span className="text-sm font-medium">{p.memberCount || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Initiatives">
                                                <Target size={14} className="text-green-600 dark:text-green-400" />
                                                <span className="text-xs">{p.initiativeCount || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Assessments">
                                                <PieChart size={14} className="text-amber-600 dark:text-amber-400" />
                                                <span className="text-xs">{p.assessmentCount || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300" title="Documents">
                                                <FileText size={14} className="text-slate-400 dark:text-slate-400" />
                                                <span className="text-xs">{p.documentCount || 0}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-[10px] font-bold uppercase border border-green-500/20">
                                            {p.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-600 dark:text-slate-400 text-sm">
                                            {p.owner?.firstName || (p as any).owner_first_name || 'System'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white transition-colors"
                                                title="View Details"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                            {canEdit && (
                                                <button
                                                    onClick={() => setSelectedProjectForGovernance(p)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                                    title="Settings"
                                                >
                                                    <Settings size={18} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteProject(p.id)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Project Modal */}
            {showAddProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-600 rounded-lg text-white">
                                    <Plus size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-navy-900 dark:text-white">Launch New Project</h2>
                            </div>
                            <button onClick={() => setShowAddProjectModal(false)} className="p-2 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Project Identity
                                </label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-navy-900 dark:text-white focus:border-purple-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="e.g. Intelligent Factory Optimization"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                                    Scope & Description
                                </label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-navy-900 dark:text-white focus:border-purple-500 outline-none transition-all h-24 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="Briefly describe the project transformation scope..."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                    <Target size={12} className="text-green-600 dark:text-green-400" />
                                    Strategic Goal (CEL)
                                </label>
                                <input
                                    value={formData.goal}
                                    onChange={e => setFormData({ ...formData, goal: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl p-3.5 text-navy-900 dark:text-white focus:border-purple-500 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                    placeholder="e.g. Reduce operational waste by 25% by Q4"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddProjectModal(false)}
                                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2"
                                >
                                    Initialize Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Project Governance Modal */}
            {selectedProjectForGovernance && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                <Settings size={22} className="text-purple-600 dark:text-purple-400" />
                                Governance: {selectedProjectForGovernance.name}
                            </h2>
                            <button onClick={() => setSelectedProjectForGovernance(null)} className="p-2 text-slate-400 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <ProjectGovernance
                            projectId={selectedProjectForGovernance.id}
                            onSave={() => {
                                toast.success('Governance settings saved');
                                setSelectedProjectForGovernance(null);
                                loadProjects();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminProjectManagement;
