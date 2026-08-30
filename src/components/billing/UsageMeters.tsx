import { AlertTriangle, Database, HardDrive } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface UsageData {
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  storage: {
    usedGB: number;
    limitGB: number;
    percentage: number;
  };
  plan: string;
  periodEnd?: string;
}

interface UsageMetersProps {
  usage: UsageData;
  compact?: boolean;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
  return num.toString();
};

const getStatusColor = (percentage: number): string => {
  if (percentage >= 95) return 'bg-danger-500';
  if (percentage >= 80) return 'bg-amber-500';
  if (percentage >= 60) return 'bg-yellow-500';
  return 'bg-emerald-500';
};

const getTextColor = (percentage: number): string => {
  if (percentage >= 95) return 'text-danger-500';
  if (percentage >= 80) return 'text-amber-500';
  return 'text-gray-600 dark:text-gray-400';
};

export const UsageMeters: React.FC<UsageMetersProps> = ({ usage, compact = false }) => {
  const { t } = useTranslation();
  // Default values to prevent undefined access
  const tokens = usage?.tokens || { used: 0, limit: 100000, remaining: 100000, percentage: 0 };
  const storage = usage?.storage || { usedGB: 0, limitGB: 5, percentage: 0 };

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        {/* Tokens */}
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-indigo-500" />
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getStatusColor(tokens.percentage)} transition-all`}
              style={{ width: `${Math.min(100, tokens.percentage)}%` }}
            />
          </div>
          <span className={`text-xs ${getTextColor(tokens.percentage)}`}>{tokens.percentage}%</span>
        </div>

        {/* Storage */}
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary-500" />
          <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getStatusColor(storage.percentage)} transition-all`}
              style={{ width: `${Math.min(100, storage.percentage)}%` }}
            />
          </div>
          <span className={`text-xs ${getTextColor(storage.percentage)}`}>
            {storage.percentage}%
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Token Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Database className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Token Usage</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {usage?.plan || 'Free'} Plan
              </p>
            </div>
          </div>
          {tokens.percentage >= 80 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {tokens.percentage >= 95 ? 'Critical' : 'Warning'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {formatNumber(tokens.used)} / {formatNumber(tokens.limit)} tokens
            </span>
            <span className={`font-medium ${getTextColor(tokens.percentage)}`}>
              {tokens.percentage}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getStatusColor(tokens.percentage)} transition-all duration-500`}
              style={{ width: `${Math.min(100, tokens.percentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(tokens.remaining)} tokens remaining this period
          </p>
        </div>
      </div>

      {/* Storage Usage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Storage Usage</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Knowledge Base & Documents</p>
            </div>
          </div>
          {storage.percentage >= 80 && (
            <div className="flex items-center gap-1.5 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                {storage.percentage >= 95 ? 'Critical' : 'Warning'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {storage.usedGB.toFixed(2)} GB / {storage.limitGB} GB
            </span>
            <span className={`font-medium ${getTextColor(storage.percentage)}`}>
              {storage.percentage}%
            </span>
          </div>
          <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getStatusColor(storage.percentage)} transition-all duration-500`}
              style={{ width: `${Math.min(100, storage.percentage)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {(storage.limitGB - storage.usedGB).toFixed(2)} GB available
          </p>
        </div>
      </div>

      {/* Period Info */}
      {usage.periodEnd && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {t('billing.usage.resetsOn', 'Limit odnowi się {{date}}', { date: new Date(usage.periodEnd).toLocaleDateString('pl-PL') })}
        </p>
      )}
    </div>
  );
};

export default UsageMeters;
