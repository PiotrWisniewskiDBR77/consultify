/**
 * System Health Dashboard
 * Hidden diagnostic panel accessible from landing page
 */

import { Activity, AlertTriangle, CheckCircle, RefreshCw, XCircle, Zap } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details?: any;
  autoFixAvailable?: boolean;
  autoFixed?: boolean;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error';
  timestamp: string;
  checks: HealthCheck[];
  autoRepairsApplied: number;
}

export default function SystemHealthDashboard() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/system/health');
      const data = await response.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutoRepair = async () => {
    setRepairing(true);
    try {
      const response = await fetch('/api/system/health/repair', {
        method: 'POST',
      });
      const data = await response.json();
      setHealth(data);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Auto-repair failed:', error);
    } finally {
      setRepairing(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-rose-50 border-rose-200';
      default:
        return 'bg-gray-50 dark:bg-navy-800 border-gray-200';
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'warning':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-rose-500';
      default:
        return 'bg-gray-50 dark:bg-navy-8000';
    }
  };

  const hasAutoFixableIssues = health?.checks.some(
    (c) => (c.status === 'error' || c.status === 'warning') && c.autoFixAvailable
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className={`w-3 h-3 rounded-full ${health ? getOverallStatusColor(health.overall) : 'bg-gray-50 dark:bg-navy-8000'} animate-pulse`}
            />
            <h1 className="text-3xl font-bold">System Health Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            {lastCheck && (
              <span className="text-sm text-gray-600 dark:text-gray-500 dark:text-gray-400">
                Last check: {lastCheck.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {hasAutoFixableIssues && (
              <button
                onClick={runAutoRepair}
                disabled={repairing}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 animate-pulse"
              >
                <Zap className={`w-4 h-4 ${repairing ? 'animate-spin' : ''}`} />
                Auto-Repair
              </button>
            )}
          </div>
        </div>

        {/* Overall Status */}
        {health && (
          <div className={`p-6 rounded-xl mb-8 ${getStatusColor(health.overall)} border-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {getStatusIcon(health.overall)}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {health.overall === 'healthy'
                      ? 'All Systems Operational'
                      : health.overall === 'warning'
                        ? 'Some Issues Detected'
                        : 'Critical Issues Detected'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {health.checks.filter((c) => c.status === 'healthy').length} /{' '}
                    {health.checks.length} checks passed
                  </p>
                </div>
              </div>
              {health.autoRepairsApplied > 0 && (
                <div className="px-4 py-2 bg-green-100 text-green-800 rounded-lg">
                  {health.autoRepairsApplied} auto-repair(s) applied
                </div>
              )}
            </div>
          </div>
        )}

        {/* Health Checks Grid */}
        {loading && !health ? (
          <div className="text-center py-12">
            <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="text-gray-600 dark:text-gray-500 dark:text-gray-400">
              Running health checks...
            </p>
          </div>
        ) : health ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {health.checks.map((check, index) => (
              <div
                key={index}
                className={`p-6 rounded-xl border-2 ${getStatusColor(check.status)} transition-all hover:shadow-lg`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <h3 className="text-lg font-semibold text-gray-900">{check.name}</h3>
                  </div>
                  {check.autoFixAvailable && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                      Auto-fix available
                    </span>
                  )}
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-3">{check.message}</p>

                {check.details && (
                  <div className="mt-4 p-3 bg-white/50 rounded-lg">
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </div>
                )}

                {check.autoFixed && (
                  <div className="mt-3 px-3 py-2 bg-green-100 text-green-800 text-sm rounded-lg flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Auto-fixed in this session
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-600 dark:text-gray-500 dark:text-gray-400 text-sm">
          <p>System Health Dashboard • Auto-refresh every 30 seconds</p>
          <p className="mt-2">Press ESC to close</p>
        </div>
      </div>
    </div>
  );
}
