import { ChevronDown, Clock, Cpu, Database, HardDrive } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { usePageAwarePolling } from '@/hooks/usePageAwarePolling';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

interface SystemMetrics {
  latency: number;
  dbStatus: 'online' | 'offline';
  dbResponseTime: number;
  storageUsed: number;
  storageLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

export const SystemHealth = () => {
  const { t } = useTranslation();
  const currentUser = useAppStore((s) => s.currentUser);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const isDemoContext = isDemoMode || currentUser?.isDemo === true;
  const [status, setStatus] = useState<'online' | 'degraded' | 'offline' | 'loading'>('loading');
  const [build, setBuild] = useState<{
    version?: string;
    environment?: string;
    gitSha?: string;
    gitBranch?: string;
  }>({});
  const [metrics, setMetrics] = useState<SystemMetrics>({
    latency: 0,
    dbStatus: 'online',
    dbResponseTime: 0,
    storageUsed: 0,
    storageLimit: 1000,
    apiCallsUsed: 0,
    apiCallsLimit: 10000,
  });
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkHealth = useCallback(async () => {
    if (isDemoContext) {
      setStatus('online');
      setBuild({});
      setMetrics((prev) => ({
        ...prev,
        latency: 0,
        dbStatus: 'online',
        dbResponseTime: 0,
        apiCallsUsed: 0,
      }));
      return;
    }
    try {
      const startTime = performance.now();
      const data = await Api.checkSystemHealth();
      const endTime = performance.now();
      const measuredLatency = Math.round(endTime - startTime);

      const dbRaw = String((data as any)?.database || '').toLowerCase();
      const isDbConnected = dbRaw === 'connected';

      setStatus(isDbConnected ? 'online' : 'degraded');
      setBuild({
        version: (data as any)?.version,
        environment: (data as any)?.environment,
        gitSha: (data as any)?.gitSha,
        gitBranch: (data as any)?.gitBranch,
      });
      setMetrics((prev) => ({
        ...prev,
        latency: data.latency ?? measuredLatency,
        dbStatus: isDbConnected ? 'online' : 'offline',
        dbResponseTime: data.dbResponseTime ?? measuredLatency,
        storageUsed: data.storageUsed ?? prev.storageUsed,
        storageLimit: data.storageLimit ?? prev.storageLimit,
        apiCallsUsed: data.apiCallsUsed ?? prev.apiCallsUsed,
        apiCallsLimit: data.apiCallsLimit ?? prev.apiCallsLimit,
      }));
    } catch (err: any) {
      const statusCode = err?.status;
      if (statusCode === 401 || statusCode === 403) return;
      if (statusCode === 429 || statusCode === 503) {
        setStatus('degraded');
        return;
      }

      setStatus('offline');
      setBuild({});
      setMetrics((prev) => ({ ...prev, dbStatus: 'offline' }));
    }
  }, [isDemoContext]);

  usePageAwarePolling(checkHealth, {
    intervalMs: 90_000,
    runImmediately: true,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isDemoContext) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled
          title={t('system.demoDataTitle', 'Demo data session')}
          className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-primary-400/30 bg-primary-500/10 text-primary-700 dark:text-primary-200 cursor-default"
        >
          <div className="w-2 h-2 rounded-full bg-primary-500" />
          <span className="text-xs font-medium">{t('system.demoData', 'Demo Data')}</span>
          <ChevronDown size={14} className="text-primary-300/80" />
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          disabled
          className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-transparent px-3 text-xs font-medium text-navy-900 opacity-70 transition-colors duration-150 cursor-not-allowed dark:border-white/[0.08] dark:text-white"
        >
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>{t('system.data', 'Data')}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>
    );
  }

  const storagePercent = Math.round((metrics.storageUsed / metrics.storageLimit) * 100);
  const apiPercent = Math.round((metrics.apiCallsUsed / metrics.apiCallsLimit) * 100);
  const shaShort = build.gitSha ? String(build.gitSha).slice(0, 8) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors duration-150 ${
          status === 'offline'
            ? 'bg-rose-50/70 dark:bg-rose-500/10 border-rose-400/50 dark:border-rose-500/40 hover:bg-rose-100/70 dark:hover:bg-rose-500/15'
            : status === 'degraded'
              ? 'bg-amber-50/70 dark:bg-amber-500/10 border-amber-400/50 dark:border-amber-500/40 hover:bg-amber-100/70 dark:hover:bg-amber-500/15'
              : 'bg-transparent border-slate-200 dark:border-navy-700 hover:border-brand/50 hover:bg-slate-50 dark:hover:bg-white/5'
        } text-navy-900 dark:text-white`}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            status === 'online'
              ? 'bg-green-500'
              : status === 'degraded'
                ? 'bg-amber-500'
                : 'bg-rose-500'
          }`}
        />
        <span>{t('system.data', 'Data')}</span>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-navy-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  status === 'online'
                    ? 'bg-green-500 animate-pulse'
                    : status === 'degraded'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-rose-500'
                }`}
              />
              <span className="text-sm font-semibold text-navy-900 dark:text-white">
                {t('system.dataAccess', 'Data Access')}
              </span>
            </div>
          </div>

          {/* Database Section */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Database size={14} className="text-brand" />
              <span className="text-xs font-medium text-navy-900 dark:text-white">
                {t('system.database', 'Database')}
              </span>
            </div>
            <div className="space-y-1.5 pl-5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('system.status', 'Status')}
                </span>
                <span
                  className={metrics.dbStatus === 'online' ? 'text-green-500' : 'text-rose-500'}
                >
                  {metrics.dbStatus === 'online'
                    ? t('system.connected', 'Connected')
                    : t('system.disconnected', 'Disconnected')}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('system.responseTime', 'Response Time')}
                </span>
                <span className="text-navy-900 dark:text-white">{metrics.dbResponseTime}ms</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  {t('system.latency', 'API Latency')}
                </span>
                <span className="text-navy-900 dark:text-white">{metrics.latency}ms</span>
              </div>
            </div>
          </div>

          {/* Resources Section */}
          <div className="px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Cpu size={14} className="text-primary-500" />
              <span className="text-xs font-medium text-navy-900 dark:text-white">
                {t('system.resources', 'Your Resources')}
              </span>
            </div>
            <div className="space-y-3 pl-5">
              {/* Storage */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <HardDrive size={12} />
                    {t('system.storage', 'Storage')}
                  </span>
                  <span className="text-navy-900 dark:text-white">
                    {metrics.storageUsed} / {metrics.storageLimit} MB
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${storagePercent > 80 ? 'bg-amber-500' : 'bg-brand'}`}
                    style={{ width: `${Math.min(storagePercent, 100)}%` }}
                  />
                </div>
              </div>

              {/* API Calls */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {t('system.apiCalls', 'API Calls (month)')}
                  </span>
                  <span className="text-navy-900 dark:text-white">
                    {metrics.apiCallsUsed.toLocaleString()} /{' '}
                    {metrics.apiCallsLimit.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${apiPercent > 80 ? 'bg-amber-500' : 'bg-primary-500'}`}
                    style={{ width: `${Math.min(apiPercent, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-t border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {t('system.lastUpdate', 'Auto-refresh every 30s')}
              </span>
              {build.version || build.environment || build.gitSha ? (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  {[
                    build.environment ? String(build.environment) : null,
                    build.version ? `v${String(build.version)}` : null,
                    build.gitSha ? String(build.gitSha).slice(0, 12) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
