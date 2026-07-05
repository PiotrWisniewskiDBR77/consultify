/**
 * IdeaSlashCommandMenu — Floating command palette triggered by "/" on canvas.
 *
 * Provides quick access to AI actions, templates, element creation, and data import.
 */
import {
  Brain,
  FileText,
  Frame,
  GitBranch,
  Image as ImageIcon,
  Layers,
  Link2,
  Search,
  Sparkles,
  StickyNote,
  Target,
  Type,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { CanvasToolType } from './ideaSelectionTypes';

interface SlashCommand {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  labelPl: string;
  labelEn: string;
  descPl: string;
  descEn: string;
  keywords: string[];
  action: string;
  category: 'ai' | 'element' | 'template' | 'import';
}

const COMMANDS: SlashCommand[] = [
  {
    id: 'ai-expand',
    icon: GitBranch,
    labelPl: 'AI Rozbuduj',
    labelEn: 'AI Expand',
    descPl: 'Rozbuduj mapę z AI',
    descEn: 'Expand map with AI',
    keywords: ['ai', 'expand', 'rozbuduj'],
    action: 'ai_expand',
    category: 'ai',
  },
  {
    id: 'ai-challenge',
    icon: Target,
    labelPl: 'AI Kwestionuj',
    labelEn: 'AI Challenge',
    descPl: 'Kwestionuj zaznaczenie',
    descEn: 'Challenge selection',
    keywords: ['ai', 'challenge', 'kwestionuj'],
    action: 'ai_challenge',
    category: 'ai',
  },
  {
    id: 'ai-brainstorm',
    icon: Brain,
    labelPl: 'AI Brainstorm',
    labelEn: 'AI Brainstorm',
    descPl: 'Generuj pomysły',
    descEn: 'Generate ideas',
    keywords: ['ai', 'brainstorm', 'pomysly'],
    action: 'ai_brainstorm',
    category: 'ai',
  },
  {
    id: 'ai-summarize',
    icon: FileText,
    labelPl: 'AI Podsumuj',
    labelEn: 'AI Summarize',
    descPl: 'Podsumuj mapę',
    descEn: 'Summarize map',
    keywords: ['ai', 'summarize', 'podsumuj'],
    action: 'ai_summarize',
    category: 'ai',
  },
  {
    id: 'sticky',
    icon: StickyNote,
    labelPl: 'Notatka',
    labelEn: 'Sticky note',
    descPl: 'Dodaj sticky note',
    descEn: 'Add sticky note',
    keywords: ['sticky', 'notatka', 'note'],
    action: 'wb_add_sticky',
    category: 'element',
  },
  {
    id: 'text',
    icon: Type,
    labelPl: 'Tekst',
    labelEn: 'Text',
    descPl: 'Dodaj blok tekstu',
    descEn: 'Add text block',
    keywords: ['text', 'tekst'],
    action: 'wb_add_text',
    category: 'element',
  },
  {
    id: 'frame',
    icon: Frame,
    labelPl: 'Rama',
    labelEn: 'Frame',
    descPl: 'Dodaj ramę/sekcję',
    descEn: 'Add frame/section',
    keywords: ['frame', 'rama', 'sekcja'],
    action: 'wb_add_frame',
    category: 'element',
  },
  {
    id: 'image',
    icon: ImageIcon,
    labelPl: 'Obraz',
    labelEn: 'Image',
    descPl: 'Dodaj obraz',
    descEn: 'Add image',
    keywords: ['image', 'obraz', 'zdjecie'],
    action: 'wb_add_image',
    category: 'element',
  },
  {
    id: 'link',
    icon: Link2,
    labelPl: 'Link',
    labelEn: 'Link',
    descPl: 'Dodaj link',
    descEn: 'Add link',
    keywords: ['link', 'url'],
    action: 'wb_add_link',
    category: 'element',
  },
  {
    id: 'template-swot',
    icon: Layers,
    labelPl: 'Szablon SWOT',
    labelEn: 'Template SWOT',
    descPl: 'Analiza SWOT',
    descEn: 'SWOT Analysis',
    keywords: ['template', 'swot', 'szablon'],
    action: 'template_swot',
    category: 'template',
  },
  {
    id: 'template-bmc',
    icon: Layers,
    labelPl: 'Business Model Canvas',
    labelEn: 'Business Model Canvas',
    descPl: '9 bloków modelu',
    descEn: '9 building blocks',
    keywords: ['template', 'bmc', 'canvas', 'business'],
    action: 'template_bmc',
    category: 'template',
  },
  {
    id: 'from-assessment',
    icon: Search,
    labelPl: 'Z assessmentu',
    labelEn: 'From assessment',
    descPl: 'Importuj gaps',
    descEn: 'Import gaps',
    keywords: ['assessment', 'import', 'gaps'],
    action: 'import_assessment',
    category: 'import',
  },
  {
    id: 'from-interview',
    icon: Search,
    labelPl: 'Z wywiadu',
    labelEn: 'From interview',
    descPl: 'Importuj insights',
    descEn: 'Import insights',
    keywords: ['interview', 'import', 'insights', 'wywiad'],
    action: 'import_interview',
    category: 'import',
  },
];

const CATEGORY_LABELS: Record<string, { pl: string; en: string }> = {
  ai: { pl: 'AI', en: 'AI' },
  element: { pl: 'Elementy', en: 'Elements' },
  template: { pl: 'Szablony', en: 'Templates' },
  import: { pl: 'Import', en: 'Import' },
};

export interface IdeaSlashCommandMenuProps {
  open: boolean;
  position?: { x: number; y: number };
  activeTool: CanvasToolType;
  onClose: () => void;
  onCommand: (action: string) => void;
}

export const IdeaSlashCommandMenu: React.FC<IdeaSlashCommandMenuProps> = ({
  open,
  position,
  activeTool,
  onClose,
  onCommand,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().replace(/^\//, '');
    if (!q) return COMMANDS;
    return COMMANDS.filter(
      (cmd) =>
        cmd.keywords.some((k) => k.includes(q)) ||
        cmd.labelEn.toLowerCase().includes(q) ||
        cmd.labelPl.toLowerCase().includes(q)
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map: Record<string, SlashCommand[]> = {};
    for (const cmd of filtered) {
      if (!map[cmd.category]) map[cmd.category] = [];
      map[cmd.category].push(cmd);
    }
    return map;
  }, [filtered]);

  const flatList = useMemo(() => filtered, [filtered]);

  const handleSelect = useCallback(
    (cmd: SlashCommand) => {
      onCommand(cmd.action);
      onClose();
    },
    [onClose, onCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, flatList.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIdx]) handleSelect(flatList[selectedIdx]);
      }
    },
    [flatList, handleSelect, onClose, selectedIdx]
  );

  if (!open) return null;

  const style = position
    ? { left: position.x, top: position.y }
    : { left: '50%', top: '30%', transform: 'translateX(-50%)' };

  return (
    <div
      ref={menuRef}
      className="fixed z-toast bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl w-[320px] max-h-[400px] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      style={style}
    >
      <div className="px-3 py-2 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isPl ? 'Wpisz polecenie…' : 'Type a command…'}
            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-200 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {Object.entries(grouped).map(([cat, cmds]) => (
          <div key={cat}>
            <div className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-500">
              {isPl ? CATEGORY_LABELS[cat]?.pl : CATEGORY_LABELS[cat]?.en}
            </div>
            {cmds.map((cmd) => {
              const idx = flatList.indexOf(cmd);
              const isSelected = idx === selectedIdx;
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-white/[0.07]'
                      : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon size={14} className={isSelected ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
                      {isPl ? cmd.labelPl : cmd.labelEn}
                    </div>
                    <div className="text-[9px] text-slate-600 dark:text-slate-500">
                      {isPl ? cmd.descPl : cmd.descEn}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-4 text-center text-[11px] text-slate-600">
            {isPl ? 'Brak wyników' : 'No results'}
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeaSlashCommandMenu;
