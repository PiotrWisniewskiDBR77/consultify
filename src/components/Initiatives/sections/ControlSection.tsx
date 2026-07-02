/**
 * ControlSection - Module, Status, Priority, Workflow Actions
 *
 * Extracted from InitiativeDocumentView (right column #2).
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Flag, Layers } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getStatusActions, getStatusMeta } from '@/services/initiativeLifecycle';

import { CardBlockRenderer } from '../cards/CardBlockRenderer';
import { buildControlCardSpec } from '../cards/cardSpecBuilders';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';
import { getModuleFromStatus, MODULE_CONFIG, PRIORITY_CONFIG } from './types';

export const ControlSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const {
    initiative,
    isPolish,
    priority,
    setPriority,
    showPriorityDropdown,
    setShowPriorityDropdown,
    statusActions,
    primaryActions,
    handleStatusAction,
    isMutating,
  } = useInitiativeContext();

  const status = (initiative?.status || 'DRAFT') as string;
  const statusMeta = getStatusMeta(status as any);
  const currentModule = getModuleFromStatus(status);
  const moduleConfig = MODULE_CONFIG[currentModule];
  const priorityConfig =
    PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

  // F3 (D11) display layer — generic CardBlockRenderer preview. ADDITIVE: a
  // read-only "as it reads" governance summary built from the SAME resolved
  // human labels shown above (never codes). Does not replace the edit UI.
  const owner = (initiative as any)?.owner ?? (initiative as any)?.ownerName ?? (initiative as any)?.owner_name;
  const controlCardSpec = buildControlCardSpec(
    {
      module: isPolish ? moduleConfig.labelPl : moduleConfig.label,
      status: statusMeta.label,
      priority: isPolish ? priorityConfig.labelPl : priorityConfig.label,
      owner,
    },
    {
      title: t('initiatives.controlSection.control'),
      moduleLabel: t('initiatives.controlSection.currentModule'),
      statusLabel: 'Status',
      priorityLabel: t('initiatives.controlSection.priority'),
      ownerLabel: isPolish ? 'Właściciel' : 'Owner',
    }
  );

  return (
    <CollapsibleSection
      id="control"
      title={t('initiatives.controlSection.control')}
      icon={<Layers size={18} className="text-primary-500 dark:text-primary-400" />}
      iconBg="bg-gradient-to-br from-primary-500/10 to-crimson-500/10 dark:from-primary-500/20 dark:to-crimson-500/20"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-4">
        {/* Module & Status */}
        <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-navy-800 dark:to-navy-900/50 border border-slate-200/80 dark:border-navy-700/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              {t('initiatives.controlSection.currentModule')}
            </span>
            <a
              href={moduleConfig.route}
              className="text-[10px] text-primary-500 hover:text-primary-600 font-medium"
            >
              {t('initiatives.controlSection.goTo')}
            </a>
          </div>
          <div
            className={`flex items-center gap-3 p-3 rounded-lg ${moduleConfig.bgLight} border border-slate-200/50 dark:border-navy-600/50 mb-3`}
          >
            <div
              className={`w-10 h-10 rounded-xl ${moduleConfig.bgLight} flex items-center justify-center`}
            >
              <div className={`w-3 h-3 rounded-full ${moduleConfig.color}`} />
            </div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${moduleConfig.textColor}`}>
                {isPolish ? moduleConfig.labelPl : moduleConfig.label}
              </p>
              <p className="text-[10px] text-slate-600">
                {isPolish ? moduleConfig.descriptionPl : moduleConfig.description}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Status
            </span>
          </div>
          <div
            className={`flex items-center gap-3 p-3 rounded-lg ${statusMeta.bgColor} border border-slate-200/50 dark:border-navy-600/50`}
          >
            <div
              className={`w-3 h-3 rounded-full ${statusMeta.dotColor || statusMeta.color || 'bg-slate-400'} animate-pulse`}
            />
            <div className="flex-1">
              <p className={`text-sm font-semibold ${statusMeta.color}`}>{statusMeta.label}</p>
              {statusMeta.description && (
                <p className="text-[10px] text-slate-600">{statusMeta.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="relative">
          <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            {t('initiatives.controlSection.priority')}
          </label>
          <button
            onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 hover:border-primary-300 dark:hover:border-primary-500/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Flag size={14} className={priorityConfig.color} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {isPolish ? priorityConfig.labelPl : priorityConfig.label}
              </span>
            </div>
            <ChevronDown size={14} className="text-slate-600" />
          </button>
          <AnimatePresence>
            {showPriorityDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute z-20 mt-1 w-full bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-lg overflow-hidden"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setPriority(key as any);
                      setShowPriorityDropdown(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-navy-700 ${key === priority ? 'bg-primary-50 dark:bg-primary-500/10' : ''}`}
                  >
                    <Flag size={14} className={config.color} />
                    <span className="text-slate-700 dark:text-slate-300">
                      {isPolish ? config.labelPl : config.label}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status Actions */}
        {primaryActions.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-navy-700">
            {primaryActions.map((a) => (
              <button
                key={a.targetStatus}
                onClick={() => handleStatusAction(a)}
                disabled={isMutating}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white text-sm font-semibold shadow-lg shadow-primary-500/30 disabled:opacity-50 transition-all"
              >
                <span>{a.label}</span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        )}

        {/* F3 (D11) display layer — generic CardBlockRenderer preview.
            ADDITIVE: a read-only governance summary built from the same
            resolved labels. Status/priority/module are effectively always
            present, so this renders unconditionally below the edit UI. */}
        <div className="pt-3 border-t border-slate-200 dark:border-navy-700">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            {t('initiatives.controlSection.control')}
          </div>
          <CardBlockRenderer spec={controlCardSpec} showTitle={false} />
        </div>
      </div>
    </CollapsibleSection>
  );
};
