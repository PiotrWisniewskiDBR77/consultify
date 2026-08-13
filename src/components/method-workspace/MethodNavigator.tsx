/**
 * MethodNavigator — left rail, structure supplied by the Method Pack
 * (axis/pillar/building block → dimension/area). Per UI-NAV §2: each position
 * shows current, target, evidence state, gap and next action.
 *
 * Domain-agnostic: nodes come in as flat `MethodNavigatorNode[]` with a
 * `parentId`, grouped here into a tree for rendering. DRD's 7 axes vs SIRI's
 * 3 building blocks are just different node data, not different components.
 */
import { ChevronRight } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import type { MethodEvidenceState, MethodNavigatorNode } from './types';

export interface MethodNavigatorProps {
  nodes: readonly MethodNavigatorNode[];
  activeUnitId: string | null;
  onSelect: (unitId: string) => void;
  className?: string;
}

const EVIDENCE_DOT: Record<MethodEvidenceState, string> = {
  complete: 'bg-c-success',
  weak: 'bg-c-warning',
  missing: 'bg-c-text-muted',
  conflicting: 'bg-c-danger',
};

interface TreeNode extends MethodNavigatorNode {
  children: TreeNode[];
}

function buildTree(nodes: readonly MethodNavigatorNode[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  nodes.forEach((n) => byId.set(n.unitId, { ...n, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (list: TreeNode[]) => {
    list.sort((a, b) => a.order - b.order);
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

const NodeRow: React.FC<{
  node: TreeNode;
  depth: number;
  activeUnitId: string | null;
  onSelect: (id: string) => void;
}> = ({ node, depth, activeUnitId, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren;
  const active = node.unitId === activeUnitId;

  return (
    <li>
      <div
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors ${
          active ? 'bg-c-surface-raised text-c-text font-semibold' : 'text-c-text-secondary hover:bg-c-surface-raised'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        role="treeitem"
        aria-expanded={hasChildren ? expanded : undefined}
        aria-selected={active}
        tabIndex={0}
        onClick={() => (isLeaf ? onSelect(node.unitId) : setExpanded((v) => !v))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            isLeaf ? onSelect(node.unitId) : setExpanded((v) => !v);
          }
        }}
      >
        {hasChildren && (
          <ChevronRight
            size={12}
            className={`shrink-0 transition-transform text-c-text-muted ${expanded ? 'rotate-90' : ''}`}
          />
        )}
        <span
          aria-hidden="true"
          className={`shrink-0 h-1.5 w-1.5 rounded-full ${EVIDENCE_DOT[node.evidenceState]}`}
          title={`Evidence: ${node.evidenceState}`}
        />
        <span className="min-w-0 truncate flex-1">{node.name}</span>
        {isLeaf && (
          <span className="shrink-0 text-[10px] text-c-text-muted tabular-nums">
            {node.currentLevel ?? '—'}
            {node.targetLevel !== null ? ` / ${node.targetLevel}` : ''}
          </span>
        )}
        {isLeaf && node.openQuestionCount > 0 && (
          <span className="shrink-0 rounded-full bg-c-info/10 text-c-info px-1.5 text-[10px] font-medium">
            {node.openQuestionCount}
          </span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul role="group">
          {node.children.map((child) => (
            <NodeRow key={child.unitId} node={child} depth={depth + 1} activeUnitId={activeUnitId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
};

export const MethodNavigator: React.FC<MethodNavigatorProps> = ({ nodes, activeUnitId, onSelect, className = '' }) => {
  const tree = useMemo(() => buildTree(nodes), [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="p-4 text-xs text-c-text-muted" data-testid="method-navigator-empty">
        Method Pack nie dostarczył jeszcze struktury.
      </div>
    );
  }

  return (
    <nav aria-label="Method Navigator" data-testid="method-navigator" className={className}>
      <ul role="tree" className="space-y-0.5">
        {tree.map((node) => (
          <NodeRow key={node.unitId} node={node} depth={0} activeUnitId={activeUnitId} onSelect={onSelect} />
        ))}
      </ul>
    </nav>
  );
};

export default MethodNavigator;
