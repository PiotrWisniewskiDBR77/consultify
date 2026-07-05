/**
 * CommandPalette — Cmd+K command bar for power-user access to all builder actions.
 * Features: fuzzy search, categorized commands, keyboard navigation, Teresa integration.
 */

import {
  BarChart3,
  Download,
  Image,
  LayoutGrid,
  List,
  Palette,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Table,
  Type,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: 'insert' | 'edit' | 'theme' | 'export' | 'navigate' | 'ai';
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertBlock: (type: string) => void;
  onPresent: () => void;
  onExport: (format: 'pdf' | 'pptx' | 'png') => void;
  onToggleAgent: () => void;
  onOpenTheme: () => void;
  onAddCard: () => void;
  /** R4 — Share & collaboration. Was wrongly wired to onPresent. */
  onShare?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onInsertBlock,
  onPresent,
  onExport,
  onToggleAgent,
  onOpenTheme,
  onAddCard,
  onShare,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(
    () => [
      // Insert
      {
        id: 'add_heading',
        label: 'Add heading',
        category: 'insert',
        icon: <Type size={14} />,
        action: () => onInsertBlock('heading'),
      },
      {
        id: 'add_text',
        label: 'Add text',
        category: 'insert',
        icon: <Type size={14} />,
        action: () => onInsertBlock('paragraph'),
      },
      {
        id: 'add_bullets',
        label: 'Add bullet list',
        category: 'insert',
        icon: <List size={14} />,
        action: () => onInsertBlock('bullet_list'),
      },
      {
        id: 'add_table',
        label: 'Add table',
        category: 'insert',
        icon: <Table size={14} />,
        action: () => onInsertBlock('table'),
      },
      {
        id: 'add_chart',
        label: 'Add chart',
        category: 'insert',
        icon: <BarChart3 size={14} />,
        action: () => onInsertBlock('chart'),
      },
      {
        id: 'add_image',
        label: 'Add image',
        category: 'insert',
        icon: <Image size={14} />,
        action: () => onInsertBlock('image'),
      },
      {
        id: 'add_kpi',
        label: 'Add KPI widget',
        category: 'insert',
        icon: <BarChart3 size={14} />,
        action: () => onInsertBlock('kpi_widget'),
      },
      {
        id: 'add_diagram',
        label: 'Add smart diagram',
        category: 'insert',
        icon: <LayoutGrid size={14} />,
        action: () => onInsertBlock('smart_diagram'),
      },
      {
        id: 'add_card',
        label: 'Add new slide',
        category: 'insert',
        icon: <Plus size={14} />,
        shortcut: '⌘N',
        action: onAddCard,
      },

      // Theme
      {
        id: 'change_theme',
        label: 'Change theme',
        description: 'Switch color palette',
        category: 'theme',
        icon: <Palette size={14} />,
        action: onOpenTheme,
      },

      // Export
      {
        id: 'present',
        label: 'Present',
        description: 'Start fullscreen presentation',
        category: 'export',
        icon: <Play size={14} />,
        shortcut: '⌘P',
        action: onPresent,
      },
      {
        id: 'export_pdf',
        label: 'Export as PDF',
        category: 'export',
        icon: <Download size={14} />,
        action: () => onExport('pdf'),
      },
      {
        id: 'export_pptx',
        label: 'Export as PPTX',
        category: 'export',
        icon: <Download size={14} />,
        action: () => onExport('pptx'),
      },
      {
        id: 'export_png',
        label: 'Export as PNG',
        category: 'export',
        icon: <Download size={14} />,
        action: () => onExport('png'),
      },
      {
        id: 'share',
        label: 'Share',
        description: 'Share & collaboration settings',
        category: 'export',
        icon: <Share2 size={14} />,
        action: onShare ?? onPresent,
      },

      // AI
      {
        id: 'ask_teresa',
        label: 'Ask Teresa',
        description: 'Open the unified conversation surface',
        category: 'ai',
        icon: <Sparkles size={14} />,
        shortcut: '⌘J',
        action: onToggleAgent,
      },
    ],
    [onInsertBlock, onPresent, onExport, onToggleAgent, onOpenTheme, onAddCard, onShare]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return fuzzyFilter(commands, query);
  }, [commands, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            onClose();
          } else if (query.trim()) {
            onToggleAgent();
            onClose();
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onClose, query, onToggleAgent]
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const grouped = groupByCategory(filtered);

  return (
    <div
      className="fixed inset-0 z-toast flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative w-[520px] max-h-[420px] bg-c-surface rounded-2xl shadow-2xl border border-c-border-subtle overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-c-border-subtle">
          <Search size={16} className="text-c-text-secondary flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('presentations.builder.commandPalette.placeholder', 'Type a command...')}
            className="flex-1 bg-transparent text-sm outline-none focus:ring-2 focus:ring-c-focus text-c-text placeholder:text-c-text-muted"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary border border-c-border-subtle">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Sparkles size={16} className="mx-auto text-c-accent mb-2" />
              <p className="text-xs text-c-text-secondary">
                Press Enter to open Teresa and continue the conversation.
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, cmds]) => (
              <div key={cat}>
                <p className="px-4 py-1 text-[10px] font-semibold uppercase text-c-text-secondary">
                  {CATEGORY_LABELS[cat as Command['category']] || cat}
                </p>
                {cmds.map((cmd) => {
                  const globalIdx = filtered.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        globalIdx === selectedIndex
                          ? 'bg-c-accent-soft'
                          : 'hover:bg-c-surface-raised'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 ${globalIdx === selectedIndex ? 'text-c-accent' : 'text-c-text-secondary'}`}
                      >
                        {cmd.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-c-text">{cmd.label}</p>
                        {cmd.description && (
                          <p className="text-[10px] text-c-text-secondary truncate">{cmd.description}</p>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-secondary border border-c-border-subtle">
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

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-c-border-subtle text-[10px] text-c-text-secondary">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>ESC Close</span>
          <span className="ml-auto">Use Teresa for conversational AI</span>
        </div>
      </div>
    </div>
  );
};

const CATEGORY_LABELS: Record<string, string> = {
  insert: 'Insert',
  edit: 'Edit',
  theme: 'Theme',
  export: 'Export & Present',
  navigate: 'Navigate',
  ai: 'AI Actions',
};

function fuzzyFilter(commands: Command[], query: string): Command[] {
  const lower = query.toLowerCase();
  return commands
    .map((cmd) => {
      const label = cmd.label.toLowerCase();
      const desc = (cmd.description || '').toLowerCase();
      let score = 0;

      if (label === lower) score = 100;
      else if (label.startsWith(lower)) score = 80;
      else if (label.includes(lower)) score = 60;
      else if (desc.includes(lower)) score = 40;
      else {
        // Fuzzy: check if all chars of query appear in order
        let qi = 0;
        for (let i = 0; i < label.length && qi < lower.length; i++) {
          if (label[i] === lower[qi]) qi++;
        }
        if (qi === lower.length) score = 20;
      }

      return { cmd, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.cmd);
}

function groupByCategory(commands: Command[]): Record<string, Command[]> {
  const groups: Record<string, Command[]> = {};
  for (const cmd of commands) {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  }
  return groups;
}

/**
 * Hook to register Cmd+K shortcut globally in the Deck Builder.
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onOpen]);
}
