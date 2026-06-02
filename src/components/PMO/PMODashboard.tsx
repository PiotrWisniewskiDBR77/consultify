import { Activity, Briefcase, LayoutDashboard, Target } from 'lucide-react';
import React from 'react';

export const PMODashboard: React.FC = () => {
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <LayoutDashboard className="w-8 h-8 text-blue-600" />
          PMO Portfolio Dashboard
        </h1>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            New Initiative
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <DashboardCard
          title="Active Initiatives"
          value="24"
          icon={<Briefcase className="w-6 h-6" />}
          trend="+12%"
          color="blue"
        />
        <DashboardCard
          title="Portfolio Health"
          value="86%"
          icon={<Activity className="w-6 h-6" />}
          trend="Stable"
          color="green"
        />
        <DashboardCard
          title="Strategic Alignment"
          value="92%"
          icon={<Target className="w-6 h-6" />}
          trend="+5%"
          color="purple"
        />
        <DashboardCard
          title="Risk Level"
          value="Low"
          icon={<Activity className="w-6 h-6" />}
          trend="-2%"
          color="yellow"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 dark:text-white">Portfolio Overview</h2>
        <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-gray-400">
          Portfolio Visualization Placeholder
        </div>
      </div>
    </div>
  );
};

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend?: string;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, icon, trend, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-primary-50 text-primary-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{trend}</span>
        )}
      </div>
      <h3 className="text-sm text-gray-500 dark:text-gray-400 font-medium">{title}</h3>
      <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{value}</p>
    </div>
  );
};
