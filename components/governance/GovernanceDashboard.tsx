import { History, Lock, ShieldCheck, UserCheck } from 'lucide-react';
import React from 'react';

export const GovernanceDashboard: React.FC = () => {
    return (
        <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-8 h-8 text-indigo-600" />
                    Governance & Security Control
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <GovStatCard
                    title="Audit Events (24h)"
                    value="1,284"
                    icon={<History className="w-5 h-5" />}
                    status="Operational"
                />
                <GovStatCard
                    title="Active Permissions"
                    value="42 Rules"
                    icon={<Lock className="w-5 h-5" />}
                    status="Verified"
                />
                <GovStatCard
                    title="Compliance Score"
                    value="98.2%"
                    icon={<UserCheck className="w-5 h-5" />}
                    status="Excellent"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-500" />
                        Recent Audit Log
                    </h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="flex items-center gap-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0"
                            >
                                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                <div>
                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                        User updated Role permissions
                                    </p>
                                    <p className="text-xs text-gray-500">2 minutes ago • admin-001</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 dark:text-white">Security Alerts</h3>
                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-400">
                        No critical alerts detected
                    </div>
                </div>
            </div>
        </div>
    );
};

interface GovStatCardProps {
    title: string;
    value: string;
    icon: React.ReactNode;
    status: string;
}

const GovStatCard: React.FC<GovStatCardProps> = ({ title, value, icon, status }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    {icon}
                </div>
                <h3 className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</h3>
            </div>
            <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold dark:text-white">{value}</p>
                <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    {status}
                </span>
            </div>
        </div>
    );
};
