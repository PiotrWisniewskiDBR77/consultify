import { AlertTriangle, Check, GitBranch, Plus, Trash2, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Edge, Node } from 'reactflow';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

type AIMapProposal = {
  add: { nodes: Node[]; edges: Edge[] };
  remove: { nodeIds: string[]; edgeIds: string[] };
  reorder?: { note?: string; order?: string[] } | null;
  rationale?: string | null;
};

interface AIProposalDiffModalProps {
  proposal: AIMapProposal;
  isPl: boolean;
  existingNodes: Node[];
  onApply: (selectedNodeIndices: Record<number, boolean>) => void;
  onReject: () => void;
}

type OpType = 'add' | 'remove';
interface DiffOp {
  type: OpType;
  label: string;
  detail: string;
  idx?: number;
}

export const AIProposalDiffModal: React.FC<AIProposalDiffModalProps> = ({
  proposal,
  existingNodes,
  onApply,
  onReject,
}) => {
  const { t } = useTranslation();
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, true]))
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose: onReject, containerRef: dialogRef });

  const ops = useMemo<DiffOp[]>(() => {
    const result: DiffOp[] = [];
    proposal.add.nodes.forEach((n, idx) => {
      const parentEdge = proposal.add.edges.find((e) => e.target === (n as any).id);
      const parentNode = parentEdge
        ? existingNodes.find((en) => en.id === parentEdge.source) ||
          proposal.add.nodes.find((an: any) => an.id === parentEdge.source)
        : null;
      const parentLabel = parentNode
        ? String((parentNode as any).data?.label || parentNode.id)
        : '?';
      result.push({
        type: 'add',
        label: String((n as any).data?.label || (n as any).id || 'Node'),
        detail: t('ideas.mindmap.underLabel', 'Under: {{label}}', { label: parentLabel }),
        idx,
      });
    });
    proposal.remove.nodeIds.forEach((nodeId) => {
      const node = existingNodes.find((n) => n.id === nodeId);
      result.push({
        type: 'remove',
        label: node ? String(node.data?.label || nodeId) : nodeId,
        detail: t('ideas.mindmap.willBeRemoved', 'Will be removed'),
      });
    });
    return result;
  }, [existingNodes, proposal, t]);

  const addCount = proposal.add.nodes.length;
  const removeCount = proposal.remove.nodeIds.length;
  const selectedCount = Object.values(selectedAddIdx).filter(Boolean).length;
  const hasDestructive = removeCount > 0;

  const selectAll = () =>
    setSelectedAddIdx(Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, true])));
  const deselectAll = () =>
    setSelectedAddIdx(Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, false])));


  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-proposal-diff-modal-title"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-hig-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-hig-xl overflow-hidden outline-none"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <h3
              id="ai-proposal-diff-modal-title"
              className="text-sm font-semibold text-c-text dark:text-c-text flex items-center gap-2"
            >
              <GitBranch size={15} className="text-c-text-secondary" />
              {t('ideas.mindmap.aiProposalChangePreview', 'AI Proposal — Change Preview')}
            </h3>
            {proposal.rationale && (
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1 max-w-lg">
                {proposal.rationale}
              </p>
            )}
          </div>
          <button
            onClick={onReject}
            className="p-2 rounded-hig-lg text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff summary bar */}
        <div className="px-5 py-2.5 flex items-center gap-3 bg-c-surface-raised dark:bg-c-surface border-b border-c-border-subtle dark:border-c-border-subtle">
          {addCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-c-success dark:text-c-success bg-c-surface-raised dark:bg-c-surface px-2 py-0.5 rounded-full">
              <Plus size={10} /> {addCount} {t('ideas.mindmap.added', 'added')}
            </span>
          )}
          {removeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-c-danger dark:text-c-danger bg-c-surface-raised dark:bg-c-surface px-2 py-0.5 rounded-full">
              <Trash2 size={10} /> {removeCount} {t('ideas.mindmap.removed', 'removed')}
            </span>
          )}
          {hasDestructive && (
            <span className="inline-flex items-center gap-1 text-[11px] text-c-warning dark:text-c-warning">
              <AlertTriangle size={11} />{' '}
              {t('ideas.mindmap.containsDestructiveChanges', 'Contains destructive changes')}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={selectAll}
              className="text-[10px] text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised px-1.5 py-0.5 rounded-hig-sm transition-colors"
            >
              {t('ideas.mindmap.selectAll', 'Select all')}
            </button>
            <button
              onClick={deselectAll}
              className="text-[10px] text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised px-1.5 py-0.5 rounded-hig-sm transition-colors"
            >
              {t('ideas.mindmap.deselect', 'Deselect')}
            </button>
          </div>
        </div>

        {/* Operations list */}
        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto">
          {ops.length === 0 ? (
            <div className="text-center py-8 text-sm text-c-text-secondary dark:text-c-text-secondary">
              {t('ideas.mindmap.noChangesProposed', 'No changes proposed.')}
            </div>
          ) : (
            <table
              /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */ className="w-full text-xs"
            >
              <thead>
                <tr className="text-left text-[10px] font-semibold text-c-text-secondary dark:text-c-text-secondary uppercase tracking-wider border-b border-c-border-subtle dark:border-c-border-subtle">
                  <th className="py-1.5 w-8" />
                  <th className="py-1.5 w-16">{t('ideas.mindmap.type', 'Type')}</th>
                  <th className="py-1.5">{t('ideas.mindmap.node', 'Node')}</th>
                  <th className="py-1.5">{t('ideas.mindmap.details', 'Details')}</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((op, i) => {
                  const isAdd = op.type === 'add';
                  const isChecked = isAdd ? !!selectedAddIdx[op.idx!] : true;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-c-border-subtle dark:border-c-border-subtle transition-colors ${
                        isChecked ? '' : 'opacity-40'
                      }`}
                    >
                      <td className="py-2">
                        {isAdd ? (
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) =>
                              setSelectedAddIdx((prev) => ({
                                ...prev,
                                [op.idx!]: e.target.checked,
                              }))
                            }
                            className="rounded"
                          />
                        ) : (
                          <Check size={12} className="text-c-text-secondary" />
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            isAdd
                              ? 'bg-c-surface-raised dark:bg-c-surface-raised text-c-success dark:text-c-success'
                              : 'bg-c-surface-raised dark:bg-c-surface-raised text-c-danger dark:text-c-danger'
                          }`}
                        >
                          {isAdd ? <Plus size={9} /> : <Trash2 size={9} />}
                          {isAdd ? t('ideas.mindmap.add', 'Add') : t('ideas.mindmap.del', 'Del')}
                        </span>
                      </td>
                      <td className="py-2 font-medium text-c-text-secondary dark:text-c-text">
                        {op.label}
                      </td>
                      <td className="py-2 text-c-text-secondary dark:text-c-text-secondary">
                        {op.detail}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Plan summary */}
        {proposal.rationale && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-hig-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle text-[11px] text-c-text-secondary dark:text-c-text">
            <strong>{t('ideas.mindmap.plan', 'Plan:')}</strong>{' '}
            {t('ideas.mindmap.addNSelectedNodes', 'Add {{count}} selected nodes.', {
              count: selectedCount,
            })}
            {removeCount > 0 &&
              ` ${t('ideas.mindmap.removeNNodes', 'Remove {{count}} nodes.', { count: removeCount })}`}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center justify-between">
          <span className="text-[11px] text-c-text-secondary dark:text-c-text-secondary">
            {t('ideas.mindmap.nOfMSelected', '{{selected}} of {{total}} selected', {
              selected: selectedCount,
              total: addCount,
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-1.5 rounded-hig-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
            >
              {t('ideas.mindmap.reject', 'Reject')}
            </button>
            <button
              onClick={() => onApply(selectedAddIdx)}
              disabled={selectedCount === 0 && removeCount === 0}
              className="px-4 py-1.5 rounded-hig-lg text-xs font-semibold bg-c-surface text-c-text dark:bg-c-surface-raised dark:text-c-text dark:hover:bg-c-surface-raised hover:bg-c-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {t('ideas.mindmap.applySelectedN', 'Apply selected ({{count}})', {
                count: selectedCount,
              })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIProposalDiffModal;
