/**
 * MM-P2 (2026-08-10) measurement harness — renders the REAL `NodeContextMenu`
 * (worst case: `hasChildren` so the "Convert branch" group is present) so the
 * 1280×800 no-scroll acceptance bar can be MEASURED, not assumed. Reports the
 * top-level menu's actual pixel height in the page itself (top-left corner)
 * for a screenshot/JS read, plus renders it a second time with the AI submenu
 * pre-opened (via a real click, done in-page) so the flyout height is visible
 * too. Harness-only — never reachable from the real app.
 */
import React, { useEffect, useRef, useState } from 'react';

import { NodeContextMenu } from '../../src/components/MyWork/mindmap/NodeContextMenu';

const MmPpmMeasureScreen: React.FC = () => {
  const [menuHeight, setMenuHeight] = useState<number | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const measured = useRef(false);

  useEffect(() => {
    if (measured.current) return;
    const id = window.setInterval(() => {
      const el = document.querySelector<HTMLElement>('[data-testid="mindmap-node-context-menu"]');
      if (el) {
        measured.current = true;
        setMenuHeight(el.getBoundingClientRect().height);
        window.clearInterval(id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative h-[800px] w-[1280px] bg-c-surface text-c-text" data-testid="mels-canvas">
      <div className="absolute left-2 top-2 z-[100] rounded bg-black/80 px-2 py-1 font-mono text-xs text-white">
        top-level height: {menuHeight === null ? 'measuring…' : `${Math.round(menuHeight)}px`} /
        viewport 800px
      </div>
      <button
        type="button"
        id="ai-trigger-proxy"
        className="absolute left-2 top-10 z-[100] rounded bg-black/80 px-2 py-1 text-xs text-white"
        onClick={() => {
          const trigger = document.querySelector<HTMLButtonElement>(
            '[data-command-id="ctx_group_ai"]'
          );
          trigger?.click();
          setAiOpen(true);
        }}
      >
        open AI submenu
      </button>
      <NodeContextMenu
        x={16}
        y={64}
        nodeId="node-1"
        nodeType="idea"
        isLocked={false}
        isPl={false}
        canPasteStyle
        canPasteNodes
        hasChildren
        comingSoonIds={[]}
        onClose={() => undefined}
        onAction={() => undefined}
      />
      {aiOpen ? null : null}
    </div>
  );
};

export default MmPpmMeasureScreen;
