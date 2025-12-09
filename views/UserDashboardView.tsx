import React, { useEffect, useState } from 'react';
import { User, AppView } from '../types';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { Layers, ChevronRight, Briefcase, PlusCircle, LogOut } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserDashboardProps {
    currentUser: User;
    onNavigate: (view: AppView) => void;
}

interface Project {
    id: string;
    name: string;
    status: string;
    owner_first_name?: string;
    owner_last_name?: string;
    created_at: string;
}

export const UserDashboardView: React.FC<UserDashboardProps> = ({ currentUser, onNavigate }) => {
    const { setCurrentProjectId, logout } = useAppStore();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            const data = await Api.getProjects();
            setProjects(data);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load projects');
        } finally {
            setIsLoading(false);
        }
    };

    const handleProjectSelect = (projectId: string) => {
        setCurrentProjectId(projectId);
        // Navigate to the first step of full transformation
        onNavigate(AppView.FULL_STEP1_ASSESSMENT);
        toast.success('Entered Project Workspace');
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white transition-colors duration-300">
            {/* Header */}
            <div className="h-20 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-950 flex items-center justify-between px-8 shrink-0 transition-colors duration-300">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2 text-navy-950 dark:text-white">
                        <Briefcase className="text-purple-600 dark:text-purple-500" />
                        My Projects
                    </h1>
                    <p className="text-xs text-slate-500">Select a project to work on</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-medium text-navy-900 dark:text-white">{currentUser.firstName} {currentUser.lastName}</div>
                        <div className="text-xs text-slate-500">{currentUser.companyName}</div>
                    </div>
                    <button onClick={() => logout()} className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-navy-900 dark:hover:text-white transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-8 overflow-auto">
                <div className="max-w-5xl mx-auto">
                    {isLoading ? (
                        <div className="text-center text-slate-500 py-12">Loading projects...</div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-300 dark:border-white/10 rounded-xl">
                            <Layers size={48} className="mx-auto text-slate-400 dark:text-slate-600 mb-4" />
                            <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-2">No Projects Found</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-6">You don't have any assigned projects yet. Contact your organization administrator.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-up">
                            {projects.map(project => (
                                <div
                                    key={project.id}
                                    onClick={() => handleProjectSelect(project.id)}
                                    className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6 cursor-pointer hover:border-purple-500/50 hover:bg-slate-50 dark:hover:bg-navy-800 transition-all group relative overflow-hidden shadow-sm hover:shadow-md"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                        <ChevronRight className="text-slate-400 dark:text-slate-600 group-hover:text-purple-500 dark:group-hover:text-purple-400" />
                                    </div>

                                    <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform">
                                        <Layers size={24} />
                                    </div>

                                    <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">{project.name}</h3>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`w-2 h-2 rounded-full ${project.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{project.status}</span>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center text-xs text-slate-500">
                                        <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}

                            {/* Placeholder for "Request New Project" or similar future feature */}
                            <div className="border border-dashed border-slate-300 dark:border-white/10 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-not-allowed opacity-50">
                                <PlusCircle size={32} className="text-slate-400 dark:text-slate-600 mb-2" />
                                <span className="text-sm font-medium text-slate-400">Request New Project</span>
                                <span className="text-xs text-slate-500 dark:text-slate-600 mt-1">(Contact Admin)</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
