import { Layers, LayoutGrid, Plus, Sparkles, StickyNote } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface WhiteboardEmptyStateProps {
  isPl: boolean;
  locked: boolean;
  onSeedQuickStart: (mode: 'brainstorm' | 'affinity' | 'workshop') => void;
  onAddSticky: () => void;
}

export const WhiteboardEmptyState: React.FC<WhiteboardEmptyStateProps> = ({
  isPl,
  locked,
  onSeedQuickStart,
  onAddSticky,
}) => {
  const { t } = useTranslation();

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="text-center pointer-events-auto">
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-c-surface-raised flex items-center justify-center">
          <StickyNote size={24} className="text-c-text-muted" />
        </div>
        <div className="text-sm font-semibold text-c-text-secondary mb-1">
          {t('myWork.whiteboard.empty.title')}
        </div>
        <div className="text-[11px] text-c-text-secondary mb-3 max-w-[200px]">
          {t('myWork.whiteboard.empty.subtitle')}
        </div>
        {!locked && (
          <div className="flex flex-col items-center gap-2">
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              aria-label={t('myWork.whiteboard.empty.quickStart')}
            >
              <button
                onClick={() => onSeedQuickStart('brainstorm')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised transition-colors"
              >
                <Sparkles size={14} />
                Brainstorm
              </button>
              <button
                onClick={() => onSeedQuickStart('affinity')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <Layers size={14} />
                Affinity map
              </button>
              <button
                onClick={() => onSeedQuickStart('workshop')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <LayoutGrid size={14} />
                Workshop wall
              </button>
            </div>
            <button
              onClick={onAddSticky}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-c-surface dark:bg-[#F4F7FB] text-white hover:bg-c-surface-raised transition-colors"
            >
              <Plus size={14} />
              {t('myWork.whiteboard.empty.addSticky')}
            </button>
            <div className="text-[10px] text-c-text-secondary max-w-[260px]">
              {t('myWork.whiteboard.emptyExtra.toolsHint')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
