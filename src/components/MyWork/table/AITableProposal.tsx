/**
 * AITableProposal — Reviewable AI-generated table structure.
 *
 * Supports granular per-item accept/reject for columns, views, and rows.
 */
import { Check, ChevronDown, ChevronRight, Columns3, Eye, Rows3, Sparkles, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, SavedView, TableNode } from './tableTypes';

export interface TableProposal {
  title?: string;
  description?: string;
  columns: ColumnDef[];
  views: SavedView[];
  rows: TableNode[];
  contextHints?: string[];
  sourceArtifacts?: { id: string; type: string; title: string }[];
}

interface AITableProposalProps {
  proposal: TableProposal;
  onAccept: (accepted: { columns?: ColumnDef[]; views?: SavedView[]; rows?: TableNode[] }) => void;
  onReject: () => void;
}

export const AITableProposal: React.FC<AITableProposalProps> = ({
  proposal,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();

  const [acceptedColumns, setAcceptedColumns] = useState<Set<string>>(
    new Set(proposal.columns.map((c) => c.key))
  );
  const [acceptedViews, setAcceptedViews] = useState<Set<string>>(
    new Set(proposal.views.map((v) => v.id))
  );
  const [acceptedRows, setAcceptedRows] = useState<Set<string>>(
    new Set(proposal.rows.map((r) => r.id))
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['columns', 'views', 'rows'])
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setAcceptedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleView = useCallback((id: string) => {
    setAcceptedViews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRow = useCallback((id: string) => {
    setAcceptedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllColumns = useCallback(() => {
    setAcceptedColumns((prev) =>
      prev.size === proposal.columns.length
        ? new Set()
        : new Set(proposal.columns.map((c) => c.key))
    );
  }, [proposal.columns]);

  const toggleAllViews = useCallback(() => {
    setAcceptedViews((prev) =>
      prev.size === proposal.views.length ? new Set() : new Set(proposal.views.map((v) => v.id))
    );
  }, [proposal.views]);

  const toggleAllRows = useCallback(() => {
    setAcceptedRows((prev) =>
      prev.size === proposal.rows.length ? new Set() : new Set(proposal.rows.map((r) => r.id))
    );
  }, [proposal.rows]);

  const handleApply = useCallback(() => {
    const accepted: { columns?: ColumnDef[]; views?: SavedView[]; rows?: TableNode[] } = {};
    if (acceptedColumns.size > 0) {
      accepted.columns = proposal.columns.filter((c) => acceptedColumns.has(c.key));
    }
    if (acceptedViews.size > 0) {
      accepted.views = proposal.views.filter((v) => acceptedViews.has(v.id));
    }
    if (acceptedRows.size > 0) {
      accepted.rows = proposal.rows.filter((r) => acceptedRows.has(r.id));
    }
    onAccept(accepted);
  }, [acceptedColumns, acceptedViews, acceptedRows, onAccept, proposal]);

  const totalAccepted = acceptedColumns.size + acceptedViews.size + acceptedRows.size;

  const sectionIcons: Record<string, React.ReactNode> = {
    columns: <Columns3 size={12} />,
    views: <Eye size={12} />,
    rows: <Rows3 size={12} />,
  };

  const renderCheckbox = (checked: boolean, onClick: () => void) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
        checked
          ? 'bg-c-surface border-c-border-subtle'
          : 'border-c-border-subtle hover:border-c-accent'
      }`}
    >
      {checked && <Check size={10} className="text-white" />}
    </button>
  );

  return (
    <div className="rounded-2xl border border-c-accent bg-c-surface shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 bg-c-accent-soft border-b border-c-accent flex-shrink-0">
        <Sparkles size={16} className="text-c-accent" />
        <div className="flex-1">
          <div className="text-xs font-bold text-c-text">
            {proposal.title || t('myWorkTable.aiTableProposal.defaultTitle')}
          </div>
          {proposal.description && (
            <div className="text-[10px] text-c-text-muted mt-0.5">{proposal.description}</div>
          )}
        </div>
        <button onClick={onReject} className="p-1 rounded-lg hover:bg-c-surface-raised">
          <X size={14} className="text-c-text-secondary" />
        </button>
      </div>

      {proposal.sourceArtifacts && proposal.sourceArtifacts.length > 0 && (
        <div className="px-4 py-2 bg-blue-50/50 dark:bg-blue-500/5 border-b border-blue-200/30 dark:border-blue-500/10 flex-shrink-0">
          <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 mb-1">
            {t('myWorkTable.aiTableProposal.contextSources')}
          </div>
          <div className="flex flex-wrap gap-1">
            {proposal.sourceArtifacts.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium bg-blue-100/60 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300"
              >
                {a.type}: {a.title}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2 overflow-auto flex-1">
        {/* Columns section */}
        {proposal.columns.length > 0 && (
          <div>
            <button
              onClick={() => toggleExpanded('columns')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              {expandedSections.has('columns') ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span className="text-c-text-muted">{sectionIcons.columns}</span>
              <span className="text-[11px] font-bold text-c-text flex-1 text-left">
                {t('myWorkTable.aiTableProposal.columns')}
              </span>
              <span className="text-[9px] text-c-text-secondary">
                {acceptedColumns.size}/{proposal.columns.length}
              </span>
              {renderCheckbox(acceptedColumns.size === proposal.columns.length, toggleAllColumns)}
            </button>
            {expandedSections.has('columns') && (
              <div className="ml-6 mt-1 space-y-0.5">
                {proposal.columns.map((col) => (
                  <div
                    key={col.key}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                      acceptedColumns.has(col.key) ? 'bg-c-accent-soft' : 'opacity-50'
                    }`}
                  >
                    {renderCheckbox(acceptedColumns.has(col.key), () => toggleColumn(col.key))}
                    <span className="text-[10px] font-medium text-c-text flex-1">{col.header}</span>
                    <span className="text-[8px] text-c-text-secondary bg-c-surface-raised px-1.5 py-0.5 rounded">
                      {col.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Views section */}
        {proposal.views.length > 0 && (
          <div>
            <button
              onClick={() => toggleExpanded('views')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              {expandedSections.has('views') ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span className="text-c-text-muted">{sectionIcons.views}</span>
              <span className="text-[11px] font-bold text-c-text flex-1 text-left">
                {t('myWorkTable.aiTableProposal.views')}
              </span>
              <span className="text-[9px] text-c-text-secondary">
                {acceptedViews.size}/{proposal.views.length}
              </span>
              {renderCheckbox(acceptedViews.size === proposal.views.length, toggleAllViews)}
            </button>
            {expandedSections.has('views') && (
              <div className="ml-6 mt-1 space-y-0.5">
                {proposal.views.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                      acceptedViews.has(v.id) ? 'bg-c-accent-soft' : 'opacity-50'
                    }`}
                  >
                    {renderCheckbox(acceptedViews.has(v.id), () => toggleView(v.id))}
                    <span className="text-[10px] font-medium text-c-text flex-1">
                      {v.icon || '📋'} {v.name}
                    </span>
                    {v.layout && (
                      <span className="text-[8px] text-c-text-secondary">{v.layout}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Rows section */}
        {proposal.rows.length > 0 && (
          <div>
            <button
              onClick={() => toggleExpanded('rows')}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            >
              {expandedSections.has('rows') ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
              <span className="text-c-text-muted">{sectionIcons.rows}</span>
              <span className="text-[11px] font-bold text-c-text flex-1 text-left">
                {t('myWorkTable.aiTableProposal.starterRows')}
              </span>
              <span className="text-[9px] text-c-text-secondary">
                {acceptedRows.size}/{proposal.rows.length}
              </span>
              {renderCheckbox(acceptedRows.size === proposal.rows.length, toggleAllRows)}
            </button>
            {expandedSections.has('rows') && (
              <div className="ml-6 mt-1 space-y-0.5">
                {proposal.rows.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${
                      acceptedRows.has(r.id) ? 'bg-c-accent-soft' : 'opacity-50'
                    }`}
                  >
                    {renderCheckbox(acceptedRows.has(r.id), () => toggleRow(r.id))}
                    <span className="text-[10px] font-medium text-c-text flex-1 truncate">
                      {r.data?.label || r.id}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {proposal.contextHints && proposal.contextHints.length > 0 && (
          <div className="pt-2 border-t border-c-border-subtle">
            <div className="text-[9px] font-bold uppercase tracking-wider text-c-text-secondary mb-1">
              {t('myWorkTable.aiTableProposal.aiContext')}
            </div>
            <div className="space-y-0.5">
              {proposal.contextHints.map((hint, i) => (
                <div key={i} className="text-[10px] text-c-text-muted">
                  • {hint}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-c-border-subtle flex-shrink-0">
        <span className="text-[9px] text-c-text-secondary">
          {totalAccepted} {t('myWorkTable.aiTableProposal.itemsSelected')}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onReject}
            className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-c-text-secondary hover:bg-c-surface-raised transition-colors"
          >
            {t('myWorkTable.aiTableProposal.reject')}
          </button>
          <button
            onClick={handleApply}
            disabled={totalAccepted === 0}
            className="px-4 py-1.5 rounded-xl text-[11px] font-bold bg-c-text text-c-surface hover:opacity-90 transition-colors disabled:opacity-40"
          >
            {t('myWorkTable.aiTableProposal.applySelected')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AITableProposal;
