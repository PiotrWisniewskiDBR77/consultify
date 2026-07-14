/**
 * SchemaDiffPreview — before/after diff view for Chat-to-Schema proposals.
 * Shows current schema vs proposed schema with color-coded additions,
 * modifications, and deletions. Collapsible per table.
 */
import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Minus,
  Plus,
  RefreshCw,
  Table2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiffField {
  name: string;
  type: string;
  options?: Record<string, unknown>;
  required?: boolean;
}

export interface DiffTable {
  name: string;
  fields: DiffField[];
}

export interface DiffChange {
  type: 'add_table' | 'add_field' | 'update_field' | 'delete_field' | 'delete_table';
  tableName: string;
  field?: DiffField;
  oldField?: DiffField;
  newField?: DiffField;
  newTable?: DiffTable;
}

export interface SchemaDiffPreviewProps {
  currentSchema: DiffTable[];
  proposedChanges: DiffChange[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProposedSchema(
  current: DiffTable[],
  changes: DiffChange[]
): { tables: DiffTable[]; changeMap: Map<string, Map<string, DiffChange>> } {
  const tableMap = new Map<string, DiffField[]>();
  const changeMap = new Map<string, Map<string, DiffChange>>();

  for (const t of current) {
    tableMap.set(t.name, [...t.fields]);
  }

  for (const c of changes) {
    if (!changeMap.has(c.tableName)) changeMap.set(c.tableName, new Map());
    const tChanges = changeMap.get(c.tableName)!;

    switch (c.type) {
      case 'add_table':
        if (c.newTable) {
          tableMap.set(c.tableName, c.newTable.fields);
          tChanges.set('__table__', c);
          for (const f of c.newTable.fields) {
            tChanges.set(f.name, { ...c, type: 'add_field', field: f });
          }
        }
        break;
      case 'add_field':
        if (c.field) {
          const fields = tableMap.get(c.tableName) ?? [];
          fields.push(c.field);
          tableMap.set(c.tableName, fields);
          tChanges.set(c.field.name, c);
        }
        break;
      case 'update_field':
        if (c.newField && c.oldField) {
          const fields = tableMap.get(c.tableName) ?? [];
          const idx = fields.findIndex((f) => f.name === c.oldField!.name);
          if (idx >= 0) fields[idx] = c.newField;
          tChanges.set(c.newField.name, c);
        }
        break;
      case 'delete_field':
        if (c.field) {
          const fields = tableMap.get(c.tableName) ?? [];
          const idx = fields.findIndex((f) => f.name === c.field!.name);
          if (idx >= 0) fields.splice(idx, 1);
          tChanges.set(c.field.name, c);
        }
        break;
      case 'delete_table':
        tableMap.delete(c.tableName);
        tChanges.set('__table__', c);
        break;
    }
  }

  const tables: DiffTable[] = [];
  for (const [name, fields] of tableMap) {
    tables.push({ name, fields });
  }

  return { tables, changeMap };
}

function getChangeColor(type: DiffChange['type']): string {
  switch (type) {
    case 'add_table':
    case 'add_field':
      return 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-500/15';
    case 'update_field':
      return 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-500/15';
    case 'delete_field':
    case 'delete_table':
      return 'bg-danger-500/10 border-danger-500/30 dark:bg-danger-500/15';
    default:
      return '';
  }
}

function getChangeIcon(type: DiffChange['type']): React.ReactNode {
  switch (type) {
    case 'add_table':
    case 'add_field':
      return <Plus size={10} className="text-emerald-600 dark:text-emerald-400" />;
    case 'update_field':
      return <RefreshCw size={10} className="text-amber-600 dark:text-amber-400" />;
    case 'delete_field':
    case 'delete_table':
      return <Minus size={10} className="text-danger-600 dark:text-danger-400" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const FieldRow: React.FC<{
  field: DiffField;
  change?: DiffChange;
  isPl: boolean;
}> = ({ field, change, isPl }) => {
  const bgClass = change ? getChangeColor(change.type) : '';
  const icon = change ? getChangeIcon(change.type) : null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent ${bgClass} transition-colors`}
    >
      <Columns3 size={12} className="text-c-text-secondary flex-shrink-0" />
      <span className="text-xs font-medium text-c-text min-w-[100px]">{field.name}</span>
      <span className="text-[10px] text-c-text-muted font-mono px-1.5 py-0.5 rounded bg-c-surface-raised">
        {field.type}
      </span>
      {field.required && (
        <span className="text-[9px] text-danger-500 font-semibold">
          {isPl ? 'wymagane' : 'required'}
        </span>
      )}
      {field.options && Object.keys(field.options).length > 0 && (
        <span className="text-[9px] text-c-text-secondary">
          {Object.keys(field.options).length} {isPl ? 'opcji' : 'opts'}
        </span>
      )}
      {change?.type === 'update_field' && change.oldField && (
        <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-auto">
          ←{' '}
          {change.oldField.type !== field.type
            ? `${change.oldField.type} → ${field.type}`
            : isPl
              ? 'zmienione'
              : 'modified'}
        </span>
      )}
      {icon && <span className="ml-auto flex-shrink-0">{icon}</span>}
    </div>
  );
};

const DeletedFieldRow: React.FC<{ field: DiffField }> = ({ field }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-transparent bg-danger-500/10 dark:bg-danger-500/15 border-danger-500/30 line-through opacity-60">
    <Columns3 size={12} className="text-danger-400 flex-shrink-0" />
    <span className="text-xs font-medium text-danger-700 dark:text-danger-300 min-w-[100px]">
      {field.name}
    </span>
    <span className="text-[10px] text-danger-500 font-mono px-1.5 py-0.5 rounded bg-danger-100 dark:bg-danger-900/30">
      {field.type}
    </span>
    <Minus size={10} className="text-danger-600 dark:text-danger-400 ml-auto" />
  </div>
);

const TableSection: React.FC<{
  table: DiffTable;
  isNew: boolean;
  isDeleted: boolean;
  fieldChanges: Map<string, DiffChange>;
  deletedFields: DiffChange[];
  isPl: boolean;
}> = ({ table, isNew, isDeleted, fieldChanges, deletedFields, isPl }) => {
  const [expanded, setExpanded] = useState(true);

  const tableBg = isNew
    ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10'
    : isDeleted
      ? 'border-danger-500/30 bg-danger-500/5 dark:bg-danger-500/10 opacity-60'
      : 'border-c-border-subtle';

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${tableBg}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-c-surface-raised transition-colors"
      >
        {expanded ? (
          <ChevronDown size={14} className="text-c-text-secondary" />
        ) : (
          <ChevronRight size={14} className="text-c-text-secondary" />
        )}
        <Table2
          size={14}
          className={
            isNew
              ? 'text-emerald-600 dark:text-emerald-400'
              : isDeleted
                ? 'text-danger-600 dark:text-danger-400'
                : 'text-c-accent'
          }
        />
        <span
          className={`text-xs font-semibold ${isDeleted ? 'text-danger-700 dark:text-danger-300 line-through' : 'text-c-text'}`}
        >
          {table.name}
        </span>
        <span className="text-[10px] text-c-text-secondary ml-auto">
          {table.fields.length} {isPl ? 'pól' : 'fields'}
        </span>
        {isNew && (
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
            {isPl ? 'nowa' : 'new'}
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="px-3 pb-3 space-y-1">
          {table.fields.map((field) => (
            <FieldRow
              key={field.name}
              field={field}
              change={fieldChanges.get(field.name)}
              isPl={isPl}
            />
          ))}
          {deletedFields.map((dc) =>
            dc.field ? <DeletedFieldRow key={dc.field.name} field={dc.field} /> : null
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const SchemaDiffPreview: React.FC<SchemaDiffPreviewProps> = ({
  currentSchema,
  proposedChanges,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const { tables: proposedTables, changeMap } = useMemo(
    () => buildProposedSchema(currentSchema, proposedChanges),
    [currentSchema, proposedChanges]
  );

  const deletedTableNames = useMemo(
    () => new Set(proposedChanges.filter((c) => c.type === 'delete_table').map((c) => c.tableName)),
    [proposedChanges]
  );

  const newTableNames = useMemo(
    () => new Set(proposedChanges.filter((c) => c.type === 'add_table').map((c) => c.tableName)),
    [proposedChanges]
  );

  const addCount = proposedChanges.filter(
    (c) => c.type === 'add_table' || c.type === 'add_field'
  ).length;
  const modCount = proposedChanges.filter((c) => c.type === 'update_field').length;
  const delCount = proposedChanges.filter(
    (c) => c.type === 'delete_field' || c.type === 'delete_table'
  ).length;

  return (
    <div className="rounded-2xl border border-sky-500/30 bg-c-surface shadow-xl overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-c-border-subtle bg-gradient-to-r from-sky-50/50 to-transparent dark:from-sky-950/20">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-c-text-secondary">
            {isPl ? 'Podgląd zmian' : 'Schema Diff'}
          </span>
          <div className="flex items-center gap-1.5 ml-2">
            {addCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Plus size={9} /> {addCount}
              </span>
            )}
            {modCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <RefreshCw size={9} /> {modCount}
              </span>
            )}
            {delCount > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-danger-500/15 text-danger-700 dark:text-danger-300">
                <Minus size={9} /> {delCount}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-c-surface-raised text-c-text-secondary hover:text-c-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-2 max-h-80 overflow-y-auto">
        {/* Existing tables (including deleted ones shown from current) */}
        {currentSchema
          .filter((t) => deletedTableNames.has(t.name))
          .map((table) => (
            <TableSection
              key={`del-${table.name}`}
              table={table}
              isNew={false}
              isDeleted={true}
              fieldChanges={new Map()}
              deletedFields={[]}
              isPl={isPl}
            />
          ))}

        {/* Proposed tables (new + existing with changes) */}
        {proposedTables.map((table) => {
          const tChanges = changeMap.get(table.name) ?? new Map<string, DiffChange>();
          const fieldChanges = new Map<string, DiffChange>();
          const deletedFields: DiffChange[] = [];

          for (const [key, change] of tChanges) {
            if (key === '__table__') continue;
            if (change.type === 'delete_field') {
              deletedFields.push(change);
            } else {
              fieldChanges.set(key, change);
            }
          }

          return (
            <TableSection
              key={table.name}
              table={table}
              isNew={newTableNames.has(table.name)}
              isDeleted={false}
              fieldChanges={fieldChanges}
              deletedFields={deletedFields}
              isPl={isPl}
            />
          );
        })}

        {proposedTables.length === 0 && currentSchema.length === 0 && (
          <div className="text-center py-6 text-xs text-c-text-secondary">
            {isPl ? 'Brak zmian do wyświetlenia' : 'No changes to display'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-c-border-subtle bg-c-surface-raised">
        <div className="flex items-center gap-4 text-[10px] text-c-text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {isPl ? 'Dodane' : 'Added'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {isPl ? 'Zmienione' : 'Modified'}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger-500" />
            {isPl ? 'Usunięte' : 'Deleted'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SchemaDiffPreview;
