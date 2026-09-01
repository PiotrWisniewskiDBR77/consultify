/**
 * NotebookGraphPanel — docked connection-graph panel + its full-screen
 * expansion (171-pojedyncze, uwaga właściciela 2026-09-01: "Jak robimy takie
 * nody notatek to moze zrob ja na całym ekranie jedną bo kilka na jedym
 * eraknie nie daje komfortu pracy").
 *
 * Production mounts this docked at a fixed w-72 (288px) panel next to the
 * note editor (see NotebookContent.tsx) — genuinely cramped for exploring a
 * graph. Rather than redesigning the dock (a bigger, riskier change), this
 * adds a "Full screen" control that opens the SAME <NotebookGraphView> of the
 * SAME single note in a full-viewport overlay. Extracted out of
 * NotebookContent.tsx so the dev-render harness can mount the real thing
 * (not a hand-copied lookalike).
 */
import { Maximize2, Minimize2, Network, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { NotebookGraphView } from './NotebookGraphView';

export interface NotebookGraphPanelProps {
  /** Docked w-72 panel visible. */
  show: boolean;
  /** Full-screen overlay visible (independent of `show` — you can jump
   * straight to full screen and the dock stays closed underneath). */
  fullscreen: boolean;
  pageId: string;
  pageTitle: string;
  isPolish?: boolean;
  onCloseDock: () => void;
  onExpand: () => void;
  onCollapse: () => void;
}

export const NotebookGraphPanel: React.FC<NotebookGraphPanelProps> = ({
  show,
  fullscreen,
  pageId,
  pageTitle,
  isPolish = false,
  onCloseDock,
  onExpand,
  onCollapse,
}) => {
  const { t } = useTranslation();
  const expandLabel = t('notebook.notebookContent.graphExpand', 'Full screen');
  const collapseLabel = t('notebook.notebookContent.graphCollapse', 'Exit full screen');
  const titleLabel = t('notebook.notebookContent.label84', 'Connection graph');

  return (
    <>
      {show && (
        <div className="w-72 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-c-text-secondary">
              <Network size={13} />
              {titleLabel}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onExpand}
                title={expandLabel}
                aria-label={expandLabel}
                className="p-0.5 rounded text-c-text-secondary hover:bg-c-surface-raised transition-colors"
              >
                <Maximize2 size={13} />
              </button>
              <button type="button" onClick={onCloseDock} aria-label="Close">
                <X size={13} className="p-0.5 rounded text-c-text-secondary hover:bg-c-surface-raised transition-colors" />
              </button>
            </div>
          </div>
          <NotebookGraphView pageId={pageId} pageTitle={pageTitle} isPolish={isPolish} />
        </div>
      )}

      {fullscreen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={expandLabel}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-6 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onCollapse();
          }}
        >
          <div className="flex h-full w-full max-w-6xl flex-col rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-c-text">
                <Network size={15} />
                {titleLabel}
                <span className="font-normal text-c-text-muted">— {pageTitle}</span>
              </div>
              <button
                type="button"
                onClick={onCollapse}
                title={collapseLabel}
                aria-label={collapseLabel}
                className="rounded-md p-1.5 text-c-text-secondary transition-colors hover:bg-c-surface-raised hover:text-c-text"
              >
                <Minimize2 size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <NotebookGraphView
                pageId={pageId}
                pageTitle={pageTitle}
                isPolish={isPolish}
                className="h-full"
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotebookGraphPanel;
