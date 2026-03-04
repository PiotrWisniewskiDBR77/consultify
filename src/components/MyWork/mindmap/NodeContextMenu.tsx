import {
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  GitBranch,
  Link2,
  MessageSquare,
  Network,
  Plus,
  Rocket,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserPlus,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';

export interface NodeContextMenuProps {
  x: number;
  y: number;
  nodeId: string;
  nodeType: string;
  isLocked: boolean;
  isPl: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
}

interface MenuItem {
  id: string;
  labelPl: string;
  labelEn: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  danger?: boolean;
  disabled?: boolean;
  dividerAfter?: boolean;
}

export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  x,
  y,
  nodeId,
  nodeType,
  isLocked,
  isPl,
  onClose,
  onAction,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('mousedown', handler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const handleClick = useCallback(
    (action: string) => {
      onAction(action);
      onClose();
    },
    [onAction, onClose]
  );

  const isProtected = nodeId === 'root' || nodeId.startsWith('branch-');

  const items: MenuItem[] = [
    { id: 'ctx_open_detail', labelPl: 'Otwórz szczegóły', labelEn: 'Open details', icon: ExternalLink, disabled: isProtected },
    { id: 'ctx_edit', labelPl: 'Edytuj (F2)', labelEn: 'Edit (F2)', icon: Edit3, disabled: isProtected },
    { id: 'ctx_add_child', labelPl: 'Dodaj gałąź (Tab)', labelEn: 'Add child (Tab)', icon: Plus, disabled: isLocked, dividerAfter: true },
    { id: 'ctx_add_sibling', labelPl: 'Dodaj sąsiada (Enter)', labelEn: 'Add sibling (Enter)', icon: GitBranch, disabled: isLocked || isProtected },
    { id: 'ctx_drill_down', labelPl: 'Drill down (sub-mapa)', labelEn: 'Drill down (sub-map)', icon: ChevronRight, disabled: isProtected, dividerAfter: true },
    { id: 'ctx_ai_expand', labelPl: 'AI: Rozbuduj temat', labelEn: 'AI: Expand topic', icon: Sparkles, disabled: isLocked, dividerAfter: true },
    { id: 'ctx_ai_deepen', labelPl: 'AI: Pogłęb', labelEn: 'AI: Deepen', icon: Sparkles, disabled: isLocked },
    { id: 'ctx_what_if', labelPl: 'AI: Co jeśli...?', labelEn: 'AI: What if...?', icon: GitBranch, disabled: isLocked },
    { id: 'ctx_convert_initiative', labelPl: 'Konwertuj → Inicjatywa', labelEn: 'Convert → Initiative', icon: Rocket, disabled: isLocked },
    { id: 'ctx_convert_decision', labelPl: 'Konwertuj → Decyzja', labelEn: 'Convert → Decision', icon: Star, disabled: isLocked, dividerAfter: true },
    { id: 'ctx_vote_up', labelPl: 'Głosuj ↑', labelEn: 'Vote up', icon: Star, disabled: isLocked || isProtected },
    { id: 'ctx_assign', labelPl: 'Przypisz osobę', labelEn: 'Assign person', icon: UserPlus, disabled: isLocked || isProtected },
    { id: 'ctx_comments', labelPl: 'Komentarze', labelEn: 'Comments', icon: MessageSquare, disabled: isProtected },
    { id: 'ctx_dependencies', labelPl: 'Wykryj zależności', labelEn: 'Detect dependencies', icon: Network, disabled: isLocked },
    { id: 'ctx_priority', labelPl: 'AI: Priorytetyzacja', labelEn: 'AI: Prioritize', icon: Target, disabled: isLocked },
    { id: 'ctx_share_branch', labelPl: 'Udostępnij gałąź', labelEn: 'Share branch', icon: Link2, disabled: isProtected, dividerAfter: true },
    { id: 'ctx_duplicate', labelPl: 'Duplikuj', labelEn: 'Duplicate', icon: Copy, disabled: isLocked || isProtected },
    { id: 'ctx_delete', labelPl: 'Usuń (Del)', labelEn: 'Delete (Del)', icon: Trash2, danger: true, disabled: isLocked || isProtected },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[200px] py-1 rounded-xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl border border-slate-200/60 dark:border-navy-700/60 shadow-2xl"
      style={{ left: x, top: y }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <React.Fragment key={item.id}>
            <button
              type="button"
              disabled={item.disabled}
              onClick={() => handleClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] font-medium transition-colors ${
                item.disabled
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={13} className={item.danger ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'} />
              <span className="flex-1">{isPl ? item.labelPl : item.labelEn}</span>
              {(item.id === 'ctx_ai_expand' || item.id === 'ctx_ai_deepen') && (
                <ChevronRight size={10} className="text-slate-300" />
              )}
            </button>
            {item.dividerAfter && (
              <div className="my-1 mx-2 h-px bg-slate-200/40 dark:bg-white/[0.04]" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
