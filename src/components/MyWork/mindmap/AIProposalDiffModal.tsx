import { AlertTriangle, Check, GitBranch, Plus, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { Edge, Node } from 'reactflow';

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
  isPl,
  existingNodes,
  onApply,
  onReject,
}) => {
  const [selectedAddIdx, setSelectedAddIdx] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, true]))
  );

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
        detail: isPl ? `Pod: ${parentLabel}` : `Under: ${parentLabel}`,
        idx,
      });
    });
    proposal.remove.nodeIds.forEach((nodeId) => {
      const node = existingNodes.find((n) => n.id === nodeId);
      result.push({
        type: 'remove',
        label: node ? String(node.data?.label || nodeId) : nodeId,
        detail: isPl ? 'Zostanie usunięty' : 'Will be removed',
      });
    });
    return result;
  }, [existingNodes, isPl, proposal]);

  const addCount = proposal.add.nodes.length;
  const removeCount = proposal.remove.nodeIds.length;
  const selectedCount = Object.values(selectedAddIdx).filter(Boolean).length;
  const hasDestructive = removeCount > 0;

  const selectAll = () =>
    setSelectedAddIdx(Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, true])));
  const deselectAll = () =>
    setSelectedAddIdx(Object.fromEntries(proposal.add.nodes.map((_, idx) => [idx, false])));

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl rounded-hig-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-hig-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <GitBranch size={15} className="text-slate-500" />
              {isPl ? 'Propozycja AI — podgląd zmian' : 'AI Proposal — Change Preview'}
            </h3>
            {proposal.rationale && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
                {proposal.rationale}
              </p>
            )}
          </div>
          <button
            onClick={onReject}
            className="p-2 rounded-hig-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Diff summary bar */}
        <div className="px-5 py-2.5 flex items-center gap-3 bg-slate-50/50 dark:bg-navy-950/20 border-b border-slate-200/40 dark:border-navy-700/40">
          {addCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
              <Plus size={10} /> {addCount} {isPl ? 'dodano' : 'added'}
            </span>
          )}
          {removeCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-danger-700 dark:text-danger-400 bg-danger-100 dark:bg-danger-900/30 px-2 py-0.5 rounded-full">
              <Trash2 size={10} /> {removeCount} {isPl ? 'usunięto' : 'removed'}
            </span>
          )}
          {hasDestructive && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle size={11} />{' '}
              {isPl ? 'Zawiera zmiany destrukcyjne' : 'Contains destructive changes'}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={selectAll}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] px-1.5 py-0.5 rounded-hig-sm transition-colors"
            >
              {isPl ? 'Zaznacz wszystko' : 'Select all'}
            </button>
            <button
              onClick={deselectAll}
              className="text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/[0.04] px-1.5 py-0.5 rounded-hig-sm transition-colors"
            >
              {isPl ? 'Odznacz' : 'Deselect'}
            </button>
          </div>
        </div>

        {/* Operations list */}
        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto">
          {ops.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-600 dark:text-slate-500">
              {isPl ? 'Brak proponowanych zmian.' : 'No changes proposed.'}
            </div>
          ) : (
            <table /* §27-exempt: layout specjalizowany/read-only/data-viz, nie kanoniczna lista przegladana */  className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider border-b border-slate-200/40 dark:border-navy-700/40">
                  <th className="py-1.5 w-8" />
                  <th className="py-1.5 w-16">{isPl ? 'Typ' : 'Type'}</th>
                  <th className="py-1.5">{isPl ? 'Węzeł' : 'Node'}</th>
                  <th className="py-1.5">{isPl ? 'Szczegóły' : 'Details'}</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((op, i) => {
                  const isAdd = op.type === 'add';
                  const isChecked = isAdd ? !!selectedAddIdx[op.idx!] : true;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-slate-200/40 dark:border-navy-700/20 transition-colors ${
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
                          <Check size={12} className="text-slate-600" />
                        )}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            isAdd
                              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400'
                          }`}
                        >
                          {isAdd ? <Plus size={9} /> : <Trash2 size={9} />}
                          {isAdd ? (isPl ? 'Dodaj' : 'Add') : isPl ? 'Usuń' : 'Del'}
                        </span>
                      </td>
                      <td className="py-2 font-medium text-slate-700 dark:text-slate-200">
                        {op.label}
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-500">{op.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Plan summary */}
        {proposal.rationale && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-hig-xl bg-slate-50/50 dark:bg-navy-900/10 border border-slate-200/40 dark:border-navy-700/30 text-[11px] text-slate-700 dark:text-slate-200">
            <strong>{isPl ? 'Plan:' : 'Plan:'}</strong>{' '}
            {isPl
              ? `Dodaj ${selectedCount} wybranych węzłów.`
              : `Add ${selectedCount} selected nodes.`}
            {removeCount > 0 &&
              ` ${isPl ? `Usuń ${removeCount} węzłów.` : `Remove ${removeCount} nodes.`}`}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center justify-between">
          <span className="text-[11px] text-slate-600 dark:text-slate-500">
            {isPl
              ? `${selectedCount} z ${addCount} zaznaczonych`
              : `${selectedCount} of ${addCount} selected`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onReject}
              className="px-4 py-1.5 rounded-hig-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
            >
              {isPl ? 'Odrzuć' : 'Reject'}
            </button>
            <button
              onClick={() => onApply(selectedAddIdx)}
              disabled={selectedCount === 0 && removeCount === 0}
              className="px-4 py-1.5 rounded-hig-lg text-xs font-semibold bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isPl ? `Zastosuj wybrane (${selectedCount})` : `Apply selected (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIProposalDiffModal;
