/**
 * TemplateStructureList — lewy rail wspólnej powłoki builderów (#83d).
 *
 * Reużywalny spis elementów struktury (sekcje / slajdy / kolumny) — wzorzec
 * SlideSorter DeckBuildera, ale typo-agnostyczny. Renderuje KARTY (nie tabelę
 * — kanon TRIADA #1: listy-tabele = StandardTable; to spis edytorski powłoki,
 * nie ekran listowy). Akcje: dodaj, wybierz, przesuń ↑/↓, usuń.
 */

import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import React from 'react';

export interface StructureListItem {
  id: string;
  label: string;
  /** krótki podpis pod etykietą (typ bloku / archetyp / typ kolumny). */
  meta: string;
  /** numer porządkowy (1-based) pokazywany w żetonie. */
  index: number;
}

export interface TemplateStructureListProps {
  items: StructureListItem[];
  selectedId: string | null;
  addLabel: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
}

export const TemplateStructureList: React.FC<TemplateStructureListProps> = ({
  items,
  selectedId,
  addLabel,
  onSelect,
  onAdd,
  onMove,
  onDelete,
}) => {
  return (
    <div
      className="flex flex-col h-full min-h-0"
      data-testid="template-structure-list"
      data-structure-count={items.length}
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-1">
        {items.map((item, i) => {
          const active = item.id === selectedId;
          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(item.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(item.id);
                }
              }}
              className={[
                'group rounded-lg border px-2.5 py-2 cursor-pointer transition-colors',
                active
                  ? 'border-c-focus bg-c-focus/10'
                  : 'border-c-border bg-c-surface hover:bg-c-surface-raised',
              ].join(' ')}
              data-testid={`structure-item-${item.id}`}
              data-active={active}
            >
              <div className="flex items-start gap-2">
                <GripVertical className="w-3.5 h-3.5 mt-0.5 text-c-text-muted shrink-0" />
                <span
                  className={[
                    'shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold',
                    active ? 'bg-c-focus text-white' : 'bg-c-bg text-c-text-muted',
                  ].join(' ')}
                >
                  {item.index}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-c-text truncate">{item.label}</div>
                  <div className="text-[11px] text-c-text-muted truncate">{item.meta}</div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  aria-label="Przesuń w górę"
                  title="Przesuń w górę"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(item.id, -1);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-muted hover:text-c-text hover:bg-c-bg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Przesuń w dół"
                  title="Przesuń w dół"
                  disabled={i === items.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(item.id, 1);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-muted hover:text-c-text hover:bg-c-bg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Usuń"
                  title="Usuń"
                  disabled={items.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded text-c-text-muted hover:text-c-danger hover:bg-c-danger/10 disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-2 border-t border-c-border">
        <button
          type="button"
          onClick={onAdd}
          title={addLabel}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-c-border px-3 py-2 text-sm font-medium text-c-text-muted hover:text-c-text hover:border-c-focus hover:bg-c-focus/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          data-testid="structure-add"
        >
          <Plus className="w-4 h-4" aria-hidden />
          {addLabel}
        </button>
      </div>
    </div>
  );
};

export default TemplateStructureList;
