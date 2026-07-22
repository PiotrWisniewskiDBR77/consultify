import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import React from 'react';

import type { AnalysisWorkspacePanelConfig } from './types';

interface AnalysisWorkspacePanelProps {
  panel: AnalysisWorkspacePanelConfig;
  onClose: () => void;
}

export const AnalysisWorkspacePanel: React.FC<AnalysisWorkspacePanelProps> = ({
  panel,
  onClose,
}) => {
  return (
    <motion.aside
      initial={{ x: 16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 16, opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex h-full min-h-0 flex-col bg-white dark:bg-navy-900"
    >
      <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-3 dark:border-white/[0.06]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-c-info to-blue-500 text-white">
          {panel.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{panel.title}</h2>
          <p className="text-[10px] text-slate-600 dark:text-slate-500">{panel.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          aria-label="Close AI panel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto">{panel.content}</div>
    </motion.aside>
  );
};

export default AnalysisWorkspacePanel;
