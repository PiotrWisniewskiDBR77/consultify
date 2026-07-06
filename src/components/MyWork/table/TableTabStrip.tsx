/**
 * TableTabStrip — Airtable-style bottom tab strip for switching between
 * tables within a base. Supports drag-reorder, rename, duplicate, delete,
 * and creating new tables.
 */
import { Copy, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface TableTabStripProps {
  baseId: string;
  tables: { id: string; name: string }[];
  activeTableId: string;
  onSelectTable: (tableId: string) => void;
  onCreateTable: () => void;
  onRenameTable: (tableId: string, newName: string) => void;
  onDuplicateTable: (tableId: string) => void;
  onDeleteTable: (tableId: string) => void;
  onReorderTables?: (tables: { id: string; name: string }[]) => void;
}

export const TableTabStrip: React.FC<TableTabStripProps> = ({
  tables,
  activeTableId,
  onSelectTable,
  onCreateTable,
  onRenameTable,
  onDuplicateTable,
  onDeleteTable,
  onReorderTables,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [contextMenu, setContextMenu] = useState<{
    tableId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleRenameSubmit = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameTable(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }, [renamingId, renameValue, onRenameTable]);

  const handleDragStart = useCallback((tableId: string) => {
    setDragId(tableId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, tableId: string) => {
      e.preventDefault();
      if (dragId && dragId !== tableId) {
        setDragOverId(tableId);
      }
    },
    [dragId]
  );

  const handleDragEnd = useCallback(() => {
    if (dragId && dragOverId && dragId !== dragOverId && onReorderTables) {
      const ordered = [...tables];
      const fromIdx = ordered.findIndex((t) => t.id === dragId);
      const toIdx = ordered.findIndex((t) => t.id === dragOverId);
      if (fromIdx >= 0 && toIdx >= 0) {
        const [moved] = ordered.splice(fromIdx, 1);
        ordered.splice(toIdx, 0, moved);
        onReorderTables(ordered);
      }
    }
    setDragId(null);
    setDragOverId(null);
  }, [dragId, dragOverId, tables, onReorderTables]);

  return (
    <div className="flex items-center h-9 bg-c-surface-raised border-t border-c-border-subtle px-1 gap-0.5 overflow-x-auto flex-shrink-0 select-none">
      {tables.map((table) => {
        const isActive = table.id === activeTableId;
        const isDragOver = table.id === dragOverId;

        if (renamingId === table.id) {
          return (
            <div
              key={table.id}
              className="flex items-center h-7 px-2 bg-c-surface rounded-t border border-b-0 border-c-border-subtle"
            >
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') {
                    setRenamingId(null);
                    setRenameValue('');
                  }
                }}
                className="w-24 text-xs bg-transparent outline-none text-c-text-secondary"
              />
            </div>
          );
        }

        return (
          <button
            key={table.id}
            draggable
            onDragStart={() => handleDragStart(table.id)}
            onDragOver={(e) => handleDragOver(e, table.id)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectTable(table.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ tableId: table.id, x: e.clientX, y: e.clientY });
            }}
            className={`
              flex items-center gap-1 h-7 px-3 rounded-t text-xs whitespace-nowrap transition-colors
              ${isDragOver ? 'border-l-2 border-c-info' : ''}
              ${
                isActive
                  ? 'bg-c-surface text-c-text font-semibold border-b-2 border-c-info shadow-sm'
                  : 'text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface'
              }
            `}
          >
            <GripVertical
              size={10}
              className="opacity-0 group-hover:opacity-40 cursor-grab flex-shrink-0"
            />
            {table.name}
          </button>
        );
      })}

      {/* Add table button */}
      <button
        onClick={onCreateTable}
        className="flex items-center justify-center h-7 w-7 rounded text-c-text-muted hover:text-c-text-secondary hover:bg-c-surface transition-colors flex-shrink-0"
        title={isPl ? 'Dodaj tabelę' : 'Add table'}
      >
        <Plus size={14} />
      </button>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-[200] bg-c-surface rounded-lg shadow-xl border border-c-border-subtle py-1 min-w-[150px]"
          style={{ left: contextMenu.x, top: contextMenu.y - 120 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
            onClick={() => {
              const t = tables.find((t) => t.id === contextMenu.tableId);
              setRenameValue(t?.name ?? '');
              setRenamingId(contextMenu.tableId);
              setContextMenu(null);
            }}
          >
            <Pencil size={12} />
            {isPl ? 'Zmień nazwę' : 'Rename'}
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-c-surface-raised text-c-text-secondary"
            onClick={() => {
              onDuplicateTable(contextMenu.tableId);
              setContextMenu(null);
            }}
          >
            <Copy size={12} />
            {isPl ? 'Duplikuj' : 'Duplicate'}
          </button>
          {tables.length > 1 && (
            <>
              <div className="h-px bg-c-border-subtle my-1" />
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-c-danger hover:bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)]"
                onClick={() => {
                  onDeleteTable(contextMenu.tableId);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={12} />
                {isPl ? 'Usuń' : 'Delete'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
