import type { Editor } from '@tiptap/react';
import { CheckSquare, FileText, Lightbulb, Loader2, Scale, Target } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { Api } from '@/services/api';
import type { NotebookPage } from '@/types/myWork';

/**
 * NotebookMentionMenu — N7/K1 "@mention" entity picker for the Living Notebook.
 *
 * Type "@" in the editor to link a notebook page to another entity (initiative,
 * task, decision, idea, or another note). Selecting one inserts an `embeddedRef`
 * inline node AND records a link-graph edge, so the mention is bidirectional:
 * the mentioned entity gains a backlink to this note (shown in its Context panel).
 *
 * Mirrors the proven SlashMenu pattern (host detects the trigger via
 * detectMentionTrigger and feeds open/query/position here); this component owns
 * the picker UI, debounced entity search and keyboard navigation only.
 */

export type MentionEntityType = 'initiative' | 'task' | 'decision' | 'idea' | 'notebook_page';

export interface MentionEntity {
  type: MentionEntityType;
  id: string;
  title: string;
  status?: string;
  snippet?: string;
}

export interface MentionMenuState {
  open: boolean;
  query: string;
  triggerPos: number;
  coords: { top: number; left: number };
}

export const INITIAL_MENTION_STATE: MentionMenuState = {
  open: false,
  query: '',
  triggerPos: 0,
  coords: { top: 0, left: 0 },
};

/**
 * Detect an "@" mention trigger in the text before the cursor. Only fires when
 * the "@" follows whitespace or the block start (so email addresses like
 * user@host do NOT trigger it). The captured query may contain spaces so users
 * can search multi-word titles ("@market expansion").
 */
export function detectMentionTrigger(editor: Editor): MentionMenuState | null {
  const { $from } = editor.state.selection;
  const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);
  // The "@" must follow whitespace/start (so "email@host" doesn't trigger). The
  // query is optional and may NOT begin with a space — otherwise a lone "@ " in
  // ordinary prose ("@ meet at noon") would keep the picker open and searching.
  const match = textBefore.match(/(?:^|\s)@([\p{L}\p{N}_-][\p{L}\p{N} _-]{0,39})?$/u);
  if (!match) return null;

  const query = match[1] || '';
  // Position of the "@" itself = cursor - query length - 1.
  const from = $from.pos - query.length - 1;
  try {
    const coords = editor.view.coordsAtPos(from);
    return {
      open: true,
      query,
      triggerPos: from,
      coords: { top: coords.bottom + 4, left: coords.left },
    };
  } catch {
    return null;
  }
}

interface GroupCfg {
  type: MentionEntityType;
  icon: React.ComponentType<{ size?: number }>;
  labelEn: string;
  labelPl: string;
  emoji: string;
}

const GROUPS: GroupCfg[] = [
  { type: 'initiative', icon: Target, labelEn: 'Initiatives', labelPl: 'Inicjatywy', emoji: '🎯' },
  { type: 'task', icon: CheckSquare, labelEn: 'Tasks', labelPl: 'Zadania', emoji: '✓' },
  { type: 'decision', icon: Scale, labelEn: 'Decisions', labelPl: 'Decyzje', emoji: '⚖️' },
  { type: 'idea', icon: Lightbulb, labelEn: 'Ideas', labelPl: 'Pomysły', emoji: '💡' },
  { type: 'notebook_page', icon: FileText, labelEn: 'Notes', labelPl: 'Notatki', emoji: '📄' },
];

const GROUP_OF: Record<MentionEntityType, GroupCfg> = GROUPS.reduce(
  (acc, g) => ({ ...acc, [g.type]: g }),
  {} as Record<MentionEntityType, GroupCfg>
);

function toArray(res: any, key: string): any[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res[key])) return res[key];
  return [];
}

interface NotebookMentionMenuProps {
  open: boolean;
  query: string;
  position: { x: number; y: number };
  onSelect: (entity: MentionEntity) => void;
  onClose: () => void;
  isPolish: boolean;
  /** Current notebook pages, for client-side note search (excludes the active page). */
  notes?: NotebookPage[];
  /** Active page id to exclude from the notes results (can't mention itself). */
  activeNoteId?: string | null;
}

export const NotebookMentionMenu: React.FC<NotebookMentionMenuProps> = ({
  open,
  query,
  position,
  onSelect,
  onClose,
  isPolish,
  notes = [],
  activeNoteId,
}) => {
  const [results, setResults] = useState<MentionEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const t = (en: string, pl: string) => (isPolish ? pl : en);

  // Debounced server entity search + client-side note search.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(async () => {
      const q = query.trim().slice(0, 80);
      const qEnc = encodeURIComponent(q);
      const [initRes, taskRes, decRes, ideaRes] = await Promise.allSettled([
        Api.get(`/initiatives?q=${qEnc}&limit=6`),
        Api.get(`/my-work/tasks?q=${qEnc}&limit=6`),
        Api.get(`/decisions?q=${qEnc}&limit=6`),
        q ? Api.suggestMyIdeas(q, 6) : Api.getMyIdeas({ limit: 6 }),
      ]);
      if (cancelled) return;

      const collected: MentionEntity[] = [];
      const push = (type: MentionEntityType, raw: any[]) => {
        raw.slice(0, 6).forEach((i: any) => {
          const title = String(i.title || i.name || '').trim();
          if (!i.id || !title) return;
          collected.push({ type, id: String(i.id), title, status: i.status, snippet: i.body || i.summary });
        });
      };
      if (initRes.status === 'fulfilled') push('initiative', toArray(initRes.value, 'initiatives'));
      if (taskRes.status === 'fulfilled') push('task', toArray(taskRes.value, 'tasks'));
      if (decRes.status === 'fulfilled') push('decision', toArray(decRes.value, 'decisions'));
      if (ideaRes.status === 'fulfilled') push('idea', toArray(ideaRes.value, 'ideas'));

      // Notes: client-side filter (no dedicated search endpoint).
      const ql = q.toLowerCase();
      notes
        .filter((n) => n.id !== activeNoteId)
        .filter((n) => !ql || (n.title || '').toLowerCase().includes(ql))
        .slice(0, 6)
        .forEach((n) =>
          collected.push({
            type: 'notebook_page',
            id: n.id,
            title: n.title || (isPolish ? 'Bez tytułu' : 'Untitled'),
            status: n.status,
            snippet: n.summary || undefined,
          })
        );

      setResults(collected);
      setLoading(false);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query, notes, activeNoteId, isPolish]);

  useEffect(() => setActiveIdx(0), [results]);

  useEffect(() => {
    itemRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Keyboard navigation (capture phase so it wins over the editor).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => (results.length ? (i + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (results[activeIdx]) {
          e.preventDefault();
          onSelect(results[activeIdx]);
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, results, activeIdx, onSelect, onClose]);

  // Stable group order over the flat result list.
  const grouped = useMemo(() => {
    return GROUPS.map((g) => ({
      cfg: g,
      items: results.filter((r) => r.type === g.type),
    })).filter((g) => g.items.length > 0);
  }, [results]);

  if (!open) return null;

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('Mention an entity', 'Wzmiankuj encję')}
      className="absolute z-50 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-lg py-1"
      style={{ top: position.y, left: position.x }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {loading && results.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-c-text-muted">
          <Loader2 size={14} className="animate-spin" />
          {t('Searching…', 'Szukam…')}
        </div>
      ) : results.length === 0 ? (
        <div className="px-3 py-4 text-center text-[12px] text-c-text-muted">
          {t('No matches', 'Brak dopasowań')}
        </div>
      ) : (
        grouped.map(({ cfg, items }) => {
          const Icon = cfg.icon;
          return (
            <div key={cfg.type} className="px-1">
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-c-text-muted">
                <Icon size={11} />
                {t(cfg.labelEn, cfg.labelPl)}
              </div>
              {items.map((entity) => {
                const flatIdx = results.indexOf(entity);
                const isActive = flatIdx === activeIdx;
                return (
                  <button
                    key={`${entity.type}:${entity.id}`}
                    ref={(el) => {
                      itemRefs.current[flatIdx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveIdx(flatIdx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(entity);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                      isActive ? 'bg-c-surface-raised' : 'hover:bg-c-surface-raised dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-[15px] leading-none">{cfg.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-c-text">
                        {entity.title}
                      </span>
                      {entity.status && (
                        <span className="block truncate text-[11px] text-c-text-muted">
                          {entity.status}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
};

/** Build the embeddedRef attrs + emoji label for a chosen mention entity. */
export function mentionEntityToEmbedRef(entity: MentionEntity, isPolish: boolean) {
  const cfg = GROUP_OF[entity.type];
  const title = entity.title || (isPolish ? 'Bez tytułu' : 'Untitled');
  return {
    artifactType: entity.type,
    artifactId: entity.id,
    title,
    label: `${cfg?.emoji || '🔗'} ${title}`,
    status: entity.status || '',
    snippet: entity.snippet || '',
  };
}

export default NotebookMentionMenu;
