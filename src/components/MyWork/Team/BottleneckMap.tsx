/**
 * BottleneckMap - Dependency bottleneck visualization
 * BCG/McKinsey style: Clear blocking chains, actionable insights
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Link,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface BlockingItem {
  id: string;
  title: string;
  type: 'task' | 'decision' | 'resource' | 'external';
  owner?: string;
  daysBlocked: number;
  blockedBy?: string; // ID of blocking item
  blockedByTitle?: string;
  blockedItems: number; // Number of items this blocks
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string; // Description of impact
}

interface BottleneckMapProps {
  bottlenecks?: BlockingItem[];
  loading?: boolean;
  onResolve?: (id: string) => void;
  onEscalate?: (id: string) => void;
  onItemClick?: (id: string) => void;
}

// Type icon mapping
const typeConfig = {
  task: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  decision: { icon: Clock, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  resource: { icon: User, color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30' },
  external: {
    icon: Link,
    color: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-800',
  },
};

// Severity styling
const severityConfig = {
  critical: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-500/30',
    badge: 'bg-rose-500 text-white',
    text: 'text-rose-700 dark:text-rose-300',
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-500/30',
    badge: 'bg-orange-500 text-white',
    text: 'text-orange-700 dark:text-orange-300',
  },
  medium: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-500/30',
    badge: 'bg-amber-500 text-white',
    text: 'text-amber-700 dark:text-amber-300',
  },
  low: {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-navy-700',
    badge: 'bg-slate-400 text-white',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

// Bottleneck Card
const BottleneckCard: React.FC<{
  item: BlockingItem;
  onResolve?: () => void;
  onEscalate?: () => void;
  onClick?: () => void;
}> = ({ item, onResolve, onEscalate, onClick }) => {
  const { t } = useTranslation();
  const typeConf = typeConfig[item.type];
  const severityConf = severityConfig[item.severity];
  const TypeIcon = typeConf.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`
                relative p-4 rounded-xl border-l-4 ${severityConf.bg} ${severityConf.border}
                cursor-pointer hover:shadow-md transition-all
            `}
      onClick={onClick}
    >
      {/* Critical pulse */}
      {item.severity === 'critical' && (
        <div className="absolute top-3 right-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-8 h-8 rounded-lg ${typeConf.bg} flex items-center justify-center shrink-0`}
        >
          <TypeIcon size={16} className={typeConf.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${severityConf.badge}`}>
              {item.severity.toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">
              {item.type}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-navy-900 dark:text-white line-clamp-2">
            {item.title}
          </h4>
        </div>
      </div>

      {/* Blocking Info */}
      {item.blockedByTitle && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-white/50 dark:bg-white/5 rounded-lg">
          <XCircle size={12} className="text-rose-500 shrink-0" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {t('team.bottleneck.blockedBy', 'Blocked by')}:
          </span>
          <span className="text-xs font-medium text-navy-900 dark:text-white truncate">
            {item.blockedByTitle}
          </span>
        </div>
      )}

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-xs mb-3">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-slate-400 dark:text-slate-500" />
          <span
            className={
              item.daysBlocked > 3
                ? 'text-rose-600 dark:text-rose-400 font-bold'
                : 'text-slate-600 dark:text-slate-400'
            }
          >
            {item.daysBlocked}d {t('team.bottleneck.blocked', 'blocked')}
          </span>
        </div>
        {item.owner && (
          <div className="flex items-center gap-1.5">
            <User size={12} className="text-slate-400 dark:text-slate-500" />
            <span className="text-slate-600 dark:text-slate-400">{item.owner}</span>
          </div>
        )}
        {item.blockedItems > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {t('team.bottleneck.blocking', 'Blocking')} {item.blockedItems}
            </span>
          </div>
        )}
      </div>

      {/* Impact */}
      <p className={`text-xs ${severityConf.text} mb-3`}>{item.impact}</p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onResolve?.();
          }}
          className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
        >
          {t('team.bottleneck.resolve', 'Resolve')}
        </button>
        {(item.severity === 'critical' || item.severity === 'high') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEscalate?.();
            }}
            className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors flex items-center gap-1"
          >
            <Zap size={12} />
            {t('team.bottleneck.escalate', 'Escalate')}
          </button>
        )}
      </div>
    </motion.div>
  );
};

export const BottleneckMap: React.FC<BottleneckMapProps> = ({
  bottlenecks = [],
  loading = false,
  onResolve,
  onEscalate,
  onItemClick,
}) => {
  const { t } = useTranslation();

  const displayBottlenecks: BlockingItem[] = bottlenecks;

  // Stats
  const criticalCount = displayBottlenecks.filter((b) => b.severity === 'critical').length;
  const highCount = displayBottlenecks.filter((b) => b.severity === 'high').length;
  const totalBlockedItems = displayBottlenecks.reduce((sum, b) => sum + b.blockedItems, 0);

  if (loading) {
    return (
      <div className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-4 animate-pulse">
        <div className="h-6 w-40 bg-slate-200 dark:bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-slate-100 dark:bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                criticalCount > 0
                  ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30'
                  : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'
              }`}
            >
              <AlertTriangle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                {t('team.bottleneck.title', 'Bottleneck Map')}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    criticalCount > 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  {displayBottlenecks.length}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('team.bottleneck.subtitle', 'Blocking items requiring attention')}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <div className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/30">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  {criticalCount} {t('team.bottleneck.critical', 'critical')}
                </span>
              </div>
            )}
            <div className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {totalBlockedItems} {t('team.bottleneck.itemsBlocked', 'items blocked')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck List */}
      <div className="p-4">
        {displayBottlenecks.length > 0 ? (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {displayBottlenecks.map((item, idx) => (
                <BottleneckCard
                  key={item.id}
                  item={item}
                  onResolve={() => onResolve?.(item.id)}
                  onEscalate={() => onEscalate?.(item.id)}
                  onClick={() => onItemClick?.(item.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-8">
            <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-500" />
            <p className="text-lg font-semibold text-navy-900 dark:text-white mb-1">
              {t('team.bottleneck.allClear', 'All Clear!')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('team.bottleneck.noBlockers', 'No blocking items detected')}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default BottleneckMap;
