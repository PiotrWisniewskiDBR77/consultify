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

import { useReducedMotion } from '@/hooks/useReducedMotion';

import { EVIDENCE_DOT_CLASS, EVIDENCE_TONE } from './evidenceSemantics';
import type { MethodEvidenceState, MethodNavigatorNode } from './types';

export interface MethodNavigatorProps {
  nodes: readonly MethodNavigatorNode[];
  activeUnitId: string | null;
  onSelect: (unitId: string) => void;
  className?: string;
}

/**
 * Semantyka pochodzi z evidenceSemantics.ts — ten komponent miał ją poprawnie
 * od początku, ale trzymał własną kopię mapy, więc dwa inne komponenty zdążyły
 * się od niej rozjechać. Teraz rozjazd jest niemożliwy.
 */
const EVIDENCE_DOT: Record<MethodEvidenceState, string> = {
  complete: EVIDENCE_DOT_CLASS[EVIDENCE_TONE.complete],
  weak: EVIDENCE_DOT_CLASS[EVIDENCE_TONE.weak],
  missing: EVIDENCE_DOT_CLASS[EVIDENCE_TONE.missing],
  conflicting: EVIDENCE_DOT_CLASS[EVIDENCE_TONE.conflicting],
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
  const prefersReducedMotion = useReducedMotion();

  const activate = (e: React.SyntheticEvent) => {
    // Stop propagation: role="treeitem" now lives on <li>, and <li>s nest
    // (a parent's <li> wraps its children's <ul role="group">) — without
    // this, a click/Enter on a DEEP child would bubble to every ancestor
    // <li>'s own handler and re-toggle/re-select them too.
    e.stopPropagation();
    isLeaf ? onSelect(node.unitId) : setExpanded((v) => !v);
  };

  // `role="treeitem"` MUST live on the <li> itself (the ARIA treeview pattern
  // requires <ul role="tree"|"group"> to own only treeitem/group children —
  // axe: aria-required-children/aria-required-parent/listitem all fail when
  // the role instead sits on an inner <div>, because the <li> then reads as
  // "just a list item" to the accessibility tree, not a tree node). The
  // `<ul role="group">` for children stays NESTED inside this <li> (a
  // treeitem may own a group), not as its sibling. The <li> itself is left
  // unstyled/non-flex (so the nested <ul> doesn't get pulled into a flex
  // row) — the visual row (background/hover/focus ring) lives on the inner
  // div.
  //
  // 2026-08-13 fix: this was previously driven by a Tailwind *named group*
  // (`group/treeitem` on the <li> + `group-focus-visible/treeitem:ring-*` on
  // the div), which compiles to a plain CSS DESCENDANT selector
  // (`.group\/treeitem:focus-visible .group-focus-visible\/treeitem\:ring-2`).
  // Because a parent node's `<ul role="group">` of children is NESTED INSIDE
  // its own <li> (required by the ARIA treeitem/group pattern above), every
  // descendant treeitem also carries the `group/treeitem` class — so
  // focusing a PARENT node lit up the ring on every descendant row too
  // (confirmed via a real Tab + getComputedStyle check: focusing "Strategia
  // i governance" showed the identical ring box-shadow on its child rows
  // "Governance danych"/"Mapa drogowa cyfrowa", not just the focused li).
  // Visually this reads as one big highlighted block, not "which row has
  // focus" — the exact defect flagged by audit. Fixed with a SINGLE combined
  // arbitrary variant `[&:focus-visible>div]:ring-*` on the <li>: `&` is
  // this li, `:focus-visible>div` requires BOTH that this exact li is
  // focus-visible AND targets only its own DIRECT-CHILD row div — so it only
  // ever reaches this li's own row, never a nested li's row (several levels
  // down, inside the sibling <ul>). NOTE: writing this as two stacked
  // variants (`focus-visible:[&>div]:ring-2`) does NOT work — Tailwind
  // resolves that to `.li-class > div:focus-visible` (the DIV must be
  // focus-visible, not the li), confirmed empirically via inspecting the
  // compiled dev-server stylesheet (`document.styleSheets`) before landing
  // on the single-bracket form below.
  return (
    <li
      className="list-none focus-visible:outline-none [&:focus-visible>div]:ring-2 [&:focus-visible>div]:ring-c-focus"
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={active}
      aria-label={`${node.name}${isLeaf ? `, poziom ${node.currentLevel ?? 'nieustalony'}${node.targetLevel !== null ? ` z ${node.targetLevel}` : ''}, evidence ${node.evidenceState}${node.openQuestionCount > 0 ? `, ${node.openQuestionCount} otwartych pytań` : ''}` : ''}`}
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate(e);
        }
      }}
    >
      <div
        className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition-colors ${
          active ? 'bg-c-surface-raised text-c-text font-semibold' : 'text-c-text-secondary hover:bg-c-surface-raised'
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren && (
          <ChevronRight
            size={12}
            className={`shrink-0 text-c-text-muted ${prefersReducedMotion ? '' : 'transition-transform'} ${expanded ? 'rotate-90' : ''}`}
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
