import { BookOpen, ChevronLeft, Plus, Search } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface NotebookHeaderActionsProps {
  /** Present only when the notebook was opened from the library list. */
  onBack?: () => void;
  onNewPage: () => void;
  /**
   * MYW-NBK-004 — opens the cross-notebook semantic search dialog. Optional
   * so existing callers/tests that don't need it keep working unchanged.
   */
  onSearchAllNotebooks?: () => void;
}

/**
 * The Notebook sidebar header's back-to-library and new-page buttons,
 * extracted from NotebookContent so they can be mounted and tested on their
 * own instead of the whole notebook editor (which pulls in tiptap and OOMs
 * jsdom on mount).
 */
export const NotebookHeaderActions: React.FC<NotebookHeaderActionsProps> = ({
  onBack,
  onNewPage,
  onSearchAllNotebooks,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {onBack ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onBack}
              data-testid="notebook-back-to-library"
              aria-label={t('notebook.notebookContent.label26', 'All notebooks')}
              className="w-7 h-7 shrink-0 rounded-lg bg-c-surface-raised text-c-text-secondary flex items-center justify-center hover:bg-c-surface-raised transition-colors"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t('notebook.notebookContent.label26', 'All notebooks')}</TooltipContent>
        </Tooltip>
      ) : (
        <div className="w-7 h-7 shrink-0 rounded-lg bg-c-surface-raised flex items-center justify-center">
          <BookOpen size={14} className="text-c-text-muted" />
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onNewPage}
            data-testid="notebook-new-page-button"
            aria-label={t('myWork.notebook.new', 'New page')}
            className="p-1.5 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised hover:brightness-110 transition-colors"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t('myWork.notebook.new', 'New page')}</TooltipContent>
      </Tooltip>
      {onSearchAllNotebooks ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSearchAllNotebooks}
              data-testid="notebook-search-all-button"
              aria-label={t('notebook.notebookContent.searchAllNotebooks', 'Search all notebooks')}
              className="p-1.5 rounded-lg bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised hover:brightness-110 transition-colors"
            >
              <Search size={16} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {t('notebook.notebookContent.searchAllNotebooks', 'Search all notebooks')}
          </TooltipContent>
        </Tooltip>
      ) : null}
    </>
  );
};
