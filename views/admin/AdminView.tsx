import React, { useState, useEffect } from 'react';
import { Api } from '../../services/api';
import { User, AppView, Project } from '../../types';
import { useAppStore } from '../../store/useAppStore';
import { Shield } from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { AdminUserManagement } from './AdminUserManagement';
import { AdminProjectManagement } from './AdminProjectManagement';
import { AdminLLMView } from './AdminLLMView';
import { AdminKnowledgeView } from './AdminKnowledgeView';
import { AdminAnalyticsView } from './AdminAnalyticsView';
import { AdminMetricsDashboardView } from './AdminMetricsDashboardView';
import { AdminSettingsConsultants } from './AdminSettingsConsultants';
import { AIMissionControl } from '../../components/Admin/AIMissionControl';
import { BulkOperationsView } from './BulkOperationsView';
import { WorkModeSettings } from '../../components/Admin/WorkModeSettings';
import { PlaybookRunsView } from './PlaybookRunsView';

interface AdminViewProps {
    currentUser: User;
    onNavigate: (view: AppView) => void;
}


export const AdminView: React.FC<AdminViewProps> = ({ currentUser, onNavigate }) => {
    const { currentView } = useAppStore();
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        const initData = async () => {
            try {
                const [u, p] = await Promise.all([Api.getUsers(), Api.getProjects()]);
                setUsers(u);
                setProjects(p);
            } catch (e) {
                console.error('Failed to load initial admin data', e);
            }
        };
        initData();
    }, []);

    // Render content based on current view
    const renderContent = () => {
        switch (currentView) {
            case AppView.ADMIN_DASHBOARD:
                return <AdminDashboard users={users} projects={projects} />;
            case AppView.ADMIN_USERS:
                return <AdminUserManagement initialUsers={users} />;
            case AppView.ADMIN_PROJECTS:
                return <AdminProjectManagement initialProjects={projects} />;
            case AppView.ADMIN_LLM:
                return <AdminLLMView />;
            case AppView.ADMIN_KNOWLEDGE:
                return <AdminKnowledgeView />;
            case AppView.ADMIN_ANALYTICS:
                return <AdminAnalyticsView />;
            case AppView.ADMIN_METRICS:
                return <AdminMetricsDashboardView />;
            case AppView.ADMIN_AI_HEALTH:
                return <AIMissionControl />;
            case AppView.ADMIN_SETTINGS_CONSULTANTS:
                return <AdminSettingsConsultants />;
            case AppView.ADMIN_BULK_OPERATIONS:
                return <BulkOperationsView />;
            case AppView.ADMIN_WORK_MODE:
                return <WorkModeSettings />;
            case AppView.ADMIN_PLAYBOOK_RUNS:
                return <PlaybookRunsView />;
            default:
                return <AdminDashboard users={users} projects={projects} />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-950">
            {/* Admin Header */}
            <div className="h-14 border-b border-white/5 bg-navy-950 flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield className="text-purple-500" size={18} />
                        Admin Panel: {currentUser.companyName}
                    </h1>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {renderContent()}
            </div>
        </div>
    );
};
