import React from 'react';
import { User, Project } from '../../types';
import { Users, Briefcase, DollarSign } from 'lucide-react';
import { InfoButton } from '../../components/shared/InfoButton';

interface AdminDashboardProps {
    users: User[];
    projects: Project[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ users, projects }) => {
    return (
        <div className="space-y-6 relative">
            <InfoButton cardId="admin-dashboard" position="top-right" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Users</p>
                        <h3 className="text-2xl font-bold text-white">{users.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-400">
                        <Users size={24} />
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Active Projects</p>
                        <h3 className="text-2xl font-bold text-white">{projects.length}</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-green-500/20 text-green-400">
                        <Briefcase size={24} />
                    </div>
                </div>
                <div className="bg-navy-900 border border-white/5 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Est. Revenue</p>
                        <h3 className="text-2xl font-bold text-white">$0.00</h3>
                    </div>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-400">
                        <DollarSign size={24} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

