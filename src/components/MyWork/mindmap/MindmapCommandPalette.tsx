/**
 * MindmapCommandPalette — Cmd+K / Ctrl+K command palette for mindmap actions.
 * Rendered as a portal at document root level.
 */
import { Search } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useFullscreenPortalTarget } from '@/hooks/useFullscreenPortalTarget';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

interface CommandItem {
  id: string;
  tkey: string;
  labelEn: string;
  shortcut?: string;
  category: string;
  action: string;
}

interface MindmapCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

const COMMANDS: CommandItem[] = [
  // Nodes
  {
    id: 'add_child',
    tkey: 'myWorkMindmap.command.add_child',
    labelEn: 'Add child',
    shortcut: 'Tab',
    category: 'nodes',
    action: 'mm_add_child',
  },
  {
    id: 'add_sibling',
    tkey: 'myWorkMindmap.command.add_sibling',
    labelEn: 'Add sibling',
    shortcut: 'Enter',
    category: 'nodes',
    action: 'mm_add_sibling',
  },
  {
    id: 'add_root',
    tkey: 'myWorkMindmap.command.add_root',
    labelEn: 'Add root topic',
    category: 'nodes',
    action: 'mm_add_root',
  },
  {
    id: 'delete',
    tkey: 'myWorkMindmap.command.delete',
    labelEn: 'Delete selected',
    shortcut: 'Del',
    category: 'nodes',
    action: 'mm_delete',
  },
  {
    id: 'duplicate',
    tkey: 'myWorkMindmap.command.duplicate',
    labelEn: 'Duplicate',
    shortcut: '⌘D',
    category: 'nodes',
    action: 'mm_duplicate',
  },
  {
    // M06 product gap — BatchConvertModal exists + dispatcher handles mm_batch_convert,
    // but nothing offered it. Lets the user convert many selected nodes at once.
    id: 'batch_convert',
    tkey: 'myWorkMindmap.command.batch_convert',
    labelEn: 'Batch convert',
    category: 'nodes',
    action: 'mm_batch_convert',
  },

  // AI
  {
    id: 'ai_expand',
    tkey: 'myWorkMindmap.command.ai_expand',
    labelEn: 'AI Expand',
    category: 'ai',
    action: 'mm_ai_expand',
  },
  {
    id: 'ai_summarize',
    tkey: 'myWorkMindmap.command.ai_summarize',
    labelEn: 'AI Summarize',
    category: 'ai',
    action: 'mm_ai_summarize',
  },
  {
    id: 'ai_gap',
    tkey: 'myWorkMindmap.command.ai_gap',
    labelEn: 'AI Gap Analysis',
    category: 'ai',
    action: 'mm_ai_gap_analysis',
  },
  {
    id: 'ai_suggest',
    tkey: 'myWorkMindmap.command.ai_suggest',
    labelEn: 'AI Suggest',
    category: 'ai',
    action: 'mm_ai_suggest',
  },

  // Layout
  {
    id: 'auto_cluster',
    tkey: 'myWorkMindmap.command.auto_cluster',
    labelEn: 'Auto-cluster',
    category: 'layout',
    action: 'mm_auto_cluster',
  },
  {
    id: 'auto_layout',
    tkey: 'myWorkMindmap.command.auto_layout',
    labelEn: 'Auto-layout',
    category: 'layout',
    action: 'mm_auto_layout',
  },
  {
    id: 'struct_mindmap',
    tkey: 'myWorkMindmap.command.struct_mindmap',
    labelEn: 'Structure: Mind Map',
    category: 'layout',
    action: 'mm_set_structure:mindmap',
  },
  {
    id: 'struct_org',
    tkey: 'myWorkMindmap.command.struct_org',
    labelEn: 'Structure: Org Chart',
    category: 'layout',
    action: 'mm_set_structure:org_chart',
  },
  {
    id: 'struct_tree',
    tkey: 'myWorkMindmap.command.struct_tree',
    labelEn: 'Structure: Tree (Right)',
    category: 'layout',
    action: 'mm_set_structure:tree_right',
  },
  {
    id: 'struct_fishbone',
    tkey: 'myWorkMindmap.command.struct_fishbone',
    labelEn: 'Structure: Fishbone',
    category: 'layout',
    action: 'mm_set_structure:fishbone',
  },
  {
    id: 'struct_timeline',
    tkey: 'myWorkMindmap.command.struct_timeline',
    labelEn: 'Structure: Timeline',
    category: 'layout',
    action: 'mm_set_structure:timeline',
  },
  {
    id: 'struct_semantic',
    tkey: 'myWorkMindmap.command.struct_semantic',
    labelEn: 'Structure: Semantic',
    category: 'layout',
    action: 'mm_set_structure:semantic',
  },

  // View
  {
    id: 'toggle_health',
    tkey: 'myWorkMindmap.command.toggle_health',
    labelEn: 'Toggle health score',
    category: 'view',
    action: 'mm_toggle_health',
  },
  {
    id: 'presentation',
    tkey: 'myWorkMindmap.command.presentation',
    labelEn: 'Toggle presentation',
    category: 'view',
    action: 'mm_presentation',
  },
  {
    id: 'fit_view',
    tkey: 'myWorkMindmap.command.fit_view',
    labelEn: 'Zoom to fit',
    category: 'view',
    action: 'mm_fit_view',
  },
  {
    id: 'toggle_minimap',
    tkey: 'myWorkMindmap.command.toggle_minimap',
    labelEn: 'Toggle minimap',
    category: 'view',
    action: 'mm_toggle_minimap',
  },
  // M06 product gaps — these views were built (TimelineView/MindMap3DView/TimeHeatmap)
  // but no UI surface emitted their action strings, so they were unreachable. The
  // dispatcher (useMindMapQuickActions) already handles each one; the palette just
  // needs to offer them.
  {
    id: 'timeline_view',
    tkey: 'myWorkMindmap.command.timeline_view',
    labelEn: 'Timeline view',
    category: 'view',
    action: 'mm_timeline',
  },
  {
    id: 'view_3d',
    tkey: 'myWorkMindmap.command.view_3d',
    labelEn: '3D view',
    category: 'view',
    action: 'mm_3d_view',
  },
  {
    id: 'time_heatmap',
    tkey: 'myWorkMindmap.command.time_heatmap',
    labelEn: 'Time heatmap',
    category: 'view',
    action: 'mm_time_heatmap',
  },

  // Export
  {
    id: 'export_md',
    tkey: 'myWorkMindmap.command.export_md',
    labelEn: 'Export: Markdown',
    category: 'export',
    action: 'mm_export_markdown',
  },
  {
    id: 'export_png',
    tkey: 'myWorkMindmap.command.export_png',
    labelEn: 'Export: PNG',
    category: 'export',
    action: 'mm_export_png',
  },
  {
    id: 'export_svg',
    tkey: 'myWorkMindmap.command.export_svg',
    labelEn: 'Export: SVG',
    category: 'export',
    action: 'mm_export_svg',
  },
  {
    id: 'export_pptx',
    tkey: 'myWorkMindmap.command.export_pptx',
    labelEn: 'Export: HTML Presentation',
    category: 'export',
    action: 'mm_export_pptx',
  },

  // Edit
  {
    id: 'undo',
    tkey: 'myWorkMindmap.command.undo',
    labelEn: 'Undo',
    shortcut: '⌘Z',
    category: 'edit',
    action: 'mm_undo',
  },
  {
    id: 'redo',
    tkey: 'myWorkMindmap.command.redo',
    labelEn: 'Redo',
    shortcut: '⌘⇧Z',
    category: 'edit',
    action: 'mm_redo',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  nodes: 'Nodes',
  ai: 'AI',
  layout: 'Layout',
  view: 'View',
  export: 'Export',
  edit: 'Edit',
};

function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (const ch of t) {
    if (ch === q[qi]) qi++;
    if (qi === q.length) return true;
  }
  return false;
}

export const MindmapCommandPalette: React.FC<MindmapCommandPaletteProps> = ({
  open,
  onClose,
  onAction,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  /** 2026-07-28: paleta musi być widoczna także w pełnym ekranie płótna. */
  const portalTarget = useFullscreenPortalTarget();
  useDialogA11y({ open, onClose, containerRef: dialogRef, initialFocusRef: inputRef });

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    return COMMANDS.filter((cmd) => {
      const text = `${t(cmd.tkey, cmd.labelEn)} ${cmd.shortcut || ''} ${cmd.category}`;
      return fuzzyMatch(query, text);
    });
  }, [query, t]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const execute = useCallback(
    (cmd: CommandItem) => {
      if (cmd.action.startsWith('mm_set_structure:')) {
        const structureType = cmd.action.split(':')[1];
        window.dispatchEvent(
          new CustomEvent('idea-workspace-quick-action', {
            detail: { action: 'mm_set_structure', structureType },
          })
        );
      } else {
        onAction(cmd.action);
      }
      onClose();
    },
    [onAction, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((p) => Math.min(p + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((p) => Math.max(p - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIdx]) execute(filtered[selectedIdx]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIdx, execute, onClose]
  );

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-cmd-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  if (!open) return null;

  const grouped = new Map<string, { items: CommandItem[]; startIdx: number }>();
  let runIdx = 0;
  for (const cmd of filtered) {
    if (!grouped.has(cmd.category)) grouped.set(cmd.category, { items: [], startIdx: runIdx });
    grouped.get(cmd.category)!.items.push(cmd);
    runIdx++;
  }

  const content = (
    <>
      <div className="fixed inset-0 bg-c-bg backdrop-blur-sm z-context-menu" onClick={onClose} />
      <div className="fixed top-[14%] left-1/2 -translate-x-1/2 w-full max-w-md z-context-menu">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('ideas.mindmap.commandPalette', 'Command palette')}
          tabIndex={-1}
          className="bg-c-surface-raised dark:bg-c-surface rounded-xl shadow-2xl border border-c-border-subtle dark:border-c-border-subtle overflow-hidden outline-none"
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-c-border-subtle dark:border-c-border-subtle">
            <Search size={16} className="text-c-text-secondary shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('ideas.mindmap.searchActions', 'Search actions…')}
              className="flex-1 bg-transparent text-sm text-c-text-secondary dark:text-c-text placeholder-c-text-muted outline-none"
            />
            <kbd className="hidden sm:flex items-center px-1.5 py-0.5 bg-c-surface-raised dark:bg-c-surface-raised rounded text-[10px] font-mono text-c-text-secondary dark:text-c-text-muted">
              ⌘K
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[360px] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="py-8 text-center text-sm text-c-text-secondary dark:text-c-text-secondary">
                {t('ideas.mindmap.noResults', 'No results')}
              </div>
            ) : (
              Array.from(grouped.entries()).map(([cat, { items, startIdx }]) => (
                <div key={cat} className="mb-1">
                  <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-c-text-secondary dark:text-c-text-secondary">
                    {t(`myWorkMindmap.commandCategory.${cat}`, CATEGORY_LABELS[cat] || cat)}
                  </div>
                  {items.map((cmd, i) => {
                    const globalIdx = startIdx + i;
                    const isActive = globalIdx === selectedIdx;
                    return (
                      <button
                        key={cmd.id}
                        data-cmd-idx={globalIdx}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setSelectedIdx(globalIdx)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                          isActive
                            ? 'bg-c-surface-raised dark:bg-c-surface text-c-text dark:text-c-text'
                            : 'text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                        }`}
                      >
                        <span className="flex-1 font-medium truncate">
                          {t(cmd.tkey, cmd.labelEn)}
                        </span>
                        {cmd.shortcut && (
                          <kbd
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              isActive
                                ? 'bg-c-surface-raised dark:bg-c-surface text-c-text-secondary dark:text-c-text'
                                : 'bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary'
                            }`}
                          >
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 px-3.5 py-1.5 border-t border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface-raised text-[10px] text-c-text-secondary dark:text-c-text-secondary">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-c-surface-raised dark:bg-c-surface-raised rounded">
                ↑↓
              </kbd>
              {t('ideas.mindmap.navigate', 'Navigate')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-c-surface-raised dark:bg-c-surface-raised rounded">
                ↵
              </kbd>
              {t('ideas.mindmap.execute', 'Execute')}
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-c-surface-raised dark:bg-c-surface-raised rounded">
                esc
              </kbd>
              {t('ideas.mindmap.close', 'Close')}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  if (!portalTarget) return null;
  return ReactDOM.createPortal(content, portalTarget);
};

export default MindmapCommandPalette;
