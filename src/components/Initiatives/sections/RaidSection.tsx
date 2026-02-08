/**
 * RaidSection - RAID Log (Risks, Assumptions, Issues, Dependencies)
 *
 * Extracted from InitiativeDocumentView.
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Loader2, Plus, Sparkles } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';
import { RAID_TYPE_CONFIG, SEVERITY_CONFIG } from './types';

export const RaidSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const {
    raidItems,
    criticalRaids,
    isPolish,
    isGeneratingAI,
    handleGenerateAI,
    isMutating,
    showCreateRaid,
    setShowCreateRaid,
    newRaidTitle,
    setNewRaidTitle,
    newRaidType,
    setNewRaidType,
    newRaidSeverity,
    setNewRaidSeverity,
    newRaidDescription,
    setNewRaidDescription,
    handleCreateRaid,
  } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="raid"
      title="RAID Log"
      icon={<AlertTriangle size={18} className="text-rose-500 dark:text-rose-400" />}
      iconBg="bg-gradient-to-br from-rose-500/10 to-red-500/10 dark:from-rose-500/20 dark:to-red-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        <div className="flex items-center gap-2">
          {criticalRaids > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
              {criticalRaids} {isPolish ? 'kryt.' : 'crit.'}
            </span>
          )}
          <span className="text-xs text-slate-400">{raidItems.length}</span>
        </div>
      }
      actions={
        <div className="flex items-center gap-2">
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              setShowCreateRaid(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-medium transition-all"
          >
            <Plus size={14} />
            <span>{isPolish ? 'Dodaj' : 'Add'}</span>
          </motion.button>
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateAI('raid');
            }}
            disabled={isGeneratingAI === 'raid'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 text-xs font-medium transition-all disabled:opacity-50"
            title={isPolish ? 'AI zidentyfikuje ryzyka' : 'AI will identify risks'}
          >
            {isGeneratingAI === 'raid' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            <span>AI</span>
          </motion.button>
        </div>
      }
    >
      {showCreateRaid && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-4 rounded-xl border-2 border-rose-300 dark:border-rose-500/50 bg-rose-50/30 dark:bg-rose-500/5 space-y-3"
        >
          <input
            type="text"
            value={newRaidTitle}
            onChange={(e) => setNewRaidTitle(e.target.value)}
            placeholder={isPolish ? 'Tytuł...' : 'Title...'}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            autoFocus
          />
          <textarea
            value={newRaidDescription}
            onChange={(e) => setNewRaidDescription(e.target.value)}
            placeholder={isPolish ? 'Opis (opcjonalnie)...' : 'Description (optional)...'}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={newRaidType}
              onChange={(e) => setNewRaidType(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            >
              <option value="risk">{isPolish ? 'Ryzyko' : 'Risk'}</option>
              <option value="assumption">{isPolish ? 'Założenie' : 'Assumption'}</option>
              <option value="issue">{isPolish ? 'Problem' : 'Issue'}</option>
              <option value="dependency">{isPolish ? 'Zależność' : 'Dependency'}</option>
            </select>
            <select
              value={newRaidSeverity}
              onChange={(e) => setNewRaidSeverity(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm"
            >
              <option value="LOW">{isPolish ? 'Niski' : 'Low'}</option>
              <option value="MEDIUM">{isPolish ? 'Średni' : 'Medium'}</option>
              <option value="HIGH">{isPolish ? 'Wysoki' : 'High'}</option>
              <option value="CRITICAL">{isPolish ? 'Krytyczny' : 'Critical'}</option>
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateRaid(false)}
              className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
            >
              {isPolish ? 'Anuluj' : 'Cancel'}
            </button>
            <button
              onClick={handleCreateRaid}
              disabled={isMutating || !newRaidTitle.trim()}
              className="px-3 py-1.5 text-xs bg-rose-500 text-white rounded-lg disabled:opacity-50"
            >
              {isPolish ? 'Utwórz' : 'Create'}
            </button>
          </div>
        </motion.div>
      )}

      {/* RAID Summary */}
      {raidItems.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {(['risk', 'assumption', 'issue', 'dependency'] as const).map((type) => {
            const count = raidItems.filter((r) => r.type === type).length;
            const config = RAID_TYPE_CONFIG[type];
            return (
              <div
                key={type}
                className={`p-2 rounded-lg text-center ${config.color.replace('text-', 'bg-').replace('/20', '/10')}`}
              >
                <div className="text-lg font-bold">{count}</div>
                <div className="text-[10px] uppercase">
                  {isPolish ? config.labelPl : config.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {raidItems.length === 0 && !showCreateRaid ? (
        <div className="text-center py-6 border-2 border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
          <AlertTriangle size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400">
            {isPolish ? 'Brak elementów RAID' : 'No RAID items'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {isPolish
              ? 'Dodaj ryzyka, założenia, problemy lub zależności'
              : 'Add risks, assumptions, issues or dependencies'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Sort: critical/high severity first, then by type */}
          {raidItems
            .sort((a, b) => {
              const severityOrder: Record<string, number> = {
                CRITICAL: 0,
                HIGH: 1,
                MEDIUM: 2,
                LOW: 3,
              };
              const aSev = severityOrder[a.severity?.toUpperCase() || 'MEDIUM'] ?? 2;
              const bSev = severityOrder[b.severity?.toUpperCase() || 'MEDIUM'] ?? 2;
              return aSev - bSev;
            })
            .map((r) => {
              const isHighSeverity = ['HIGH', 'CRITICAL'].includes(r.severity?.toUpperCase() || '');
              const raidTypeConfig = RAID_TYPE_CONFIG[r.type] || RAID_TYPE_CONFIG.risk;
              const sevConfig =
                SEVERITY_CONFIG[r.severity?.toUpperCase() || 'MEDIUM'] || SEVERITY_CONFIG.MEDIUM;

              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-lg border transition-all ${
                    isHighSeverity
                      ? 'bg-red-50/30 dark:bg-red-500/5 border-red-200/50 dark:border-red-500/20'
                      : 'bg-slate-50/50 dark:bg-navy-800/50 border-slate-200/50 dark:border-navy-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-medium flex-shrink-0 ${raidTypeConfig.color}`}
                      >
                        {isPolish ? raidTypeConfig.labelPl : raidTypeConfig.label}
                      </span>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {r.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {r.ownerName && (
                        <span className="text-[10px] text-slate-400 hidden sm:inline">
                          {r.ownerName}
                        </span>
                      )}
                      {r.severity && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${sevConfig.color}`}
                        >
                          {isPolish ? sevConfig.labelPl : sevConfig.label}
                        </span>
                      )}
                      {r.status && r.status !== 'OPEN' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">
                          {r.status}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  {r.dueDate && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <Clock size={10} className="text-slate-400" />
                      <span
                        className={`text-[10px] ${
                          new Date(r.dueDate) < new Date()
                            ? 'text-red-500 font-medium'
                            : 'text-slate-400'
                        }`}
                      >
                        {new Date(r.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </CollapsibleSection>
  );
};
