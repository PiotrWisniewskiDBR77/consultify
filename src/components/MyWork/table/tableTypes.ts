/**
 * Shared types for the Idea Table subsystem.
 * Used by IdeaTableTool, CellRenderer, AddColumnDialog, FilterPanel, etc.
 */

import { evaluateFormulaString as evaluateFormulaStringCore } from './formulaEngineCore';

export type ColumnType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'status'
  | 'date'
  | 'checkbox'
  | 'rating'
  | 'person'
  | 'url'
  | 'progress'
  | 'formula'
  | 'ai_generated'
  | 'file'
  | 'relation'
  | 'rollup'
  | 'emoji'
  | 'color'
  | 'currency'
  | 'phone'
  | 'email'
  | 'created_time'
  | 'created_by'
  | 'last_edited_time'
  | 'last_edited_by';

export interface ColumnDef {
  key: string;
  header: string;
  type: ColumnType;
  visible: boolean;
  width: number;
  options?: string[];
  optionColors?: Record<string, string>;
  formula?: string;
  aiPrompt?: string;
  frozen?: boolean;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none';
  relationTarget?: string;
  rollupSource?: string;
  rollupFunction?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'percent_empty' | 'percent_not_empty';
}

export type FilterOperator =
  // legacy (FilterPanel) — snake_case
  | 'contains'
  | 'equals'
  | 'not_empty'
  | 'is_empty'
  | 'gt'
  | 'lt'
  | 'between'
  | 'in'
  // FilterBuilder (rich) — camelCase. All handled by filterEval.evaluateFilterRule.
  | 'doesNotContain'
  | 'startsWith'
  | 'endsWith'
  | 'notEquals'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'gte'
  | 'lte'
  | 'is'
  | 'isNot'
  | 'isAnyOf'
  | 'isNoneOf'
  | 'isBefore'
  | 'isAfter'
  | 'isOnOrBefore'
  | 'isOnOrAfter'
  | 'isWithin';

export interface FilterRule {
  id: string;
  column: string;
  operator: FilterOperator;
  value: string | string[] | number;
}

export interface FilterGroup {
  logic: 'and' | 'or';
  rules: FilterRule[];
}

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  name: string;
  icon?: string;
  sort?: SortConfig[];
  filters?: FilterGroup;
  groupBy?: string;
  columns?: { key: string; visible: boolean; width: number }[];
  layout?: 'table' | 'kanban' | 'timeline' | 'calendar' | 'matrix' | 'grid' | 'sticky';
}

export interface NodeAttachment {
  id: string;
  type: 'file' | 'image' | 'link' | 'drawing';
  name: string;
  url?: string;
  thumbnailUrl?: string;
  mimeType?: string;
  size?: number;
  createdAt: string;
}

export interface NodeComment {
  id: string;
  text: string;
  author: string;
  /** Author's user id — used to gate edit/delete to the comment's own author. */
  authorId?: string;
  createdAt: string;
  editedAt?: string;
  /** @mention display names parsed from comment text */
  mentions?: string[];
}

export interface NodeActivity {
  id: string;
  action: 'created' | 'edited' | 'comment' | 'attachment' | 'status_change' | 'ai_suggestion';
  field?: string;
  oldValue?: string;
  newValue?: string;
  author: string;
  createdAt: string;
}

export interface TableNode {
  id: string;
  type?: string;
  data?: Record<string, any>;
  position?: { x: number; y: number };
}

export interface TableEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, any>;
}

export const DEFAULT_COLUMN_WIDTH = 160;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 600;

export const STATUS_OPTIONS = [
  { value: 'todo', en: 'To Do', pl: 'Do zrobienia', color: '#e0e7ff' },
  { value: 'in_progress', en: 'In Progress', pl: 'W toku', color: '#fef3c7' },
  { value: 'done', en: 'Done', pl: 'Gotowe', color: '#d1fae5' },
  { value: 'blocked', en: 'Blocked', pl: 'Zablokowane', color: '#fee2e2' },
] as const;

export const COLUMN_TYPE_LABELS: Record<ColumnType, { en: string; pl: string }> = {
  text: { en: 'Text', pl: 'Tekst' },
  number: { en: 'Number', pl: 'Liczba' },
  select: { en: 'Select', pl: 'Wybór' },
  multiselect: { en: 'Multi-select', pl: 'Wielokrotny wybór' },
  status: { en: 'Status', pl: 'Status' },
  date: { en: 'Date', pl: 'Data' },
  checkbox: { en: 'Checkbox', pl: 'Checkbox' },
  rating: { en: 'Rating', pl: 'Ocena' },
  person: { en: 'Person', pl: 'Osoba' },
  url: { en: 'URL', pl: 'URL' },
  progress: { en: 'Progress', pl: 'Postęp' },
  formula: { en: 'Formula', pl: 'Formuła' },
  ai_generated: { en: 'AI Generated', pl: 'Wygenerowane AI' },
  file: { en: 'File', pl: 'Plik' },
  relation: { en: 'Relation', pl: 'Relacja' },
  rollup: { en: 'Rollup', pl: 'Agregacja' },
  emoji: { en: 'Emoji', pl: 'Emoji' },
  color: { en: 'Color', pl: 'Kolor' },
  currency: { en: 'Currency', pl: 'Waluta' },
  phone: { en: 'Phone', pl: 'Telefon' },
  email: { en: 'Email', pl: 'Email' },
  created_time: { en: 'Created time', pl: 'Czas utworzenia' },
  created_by: { en: 'Created by', pl: 'Utworzono przez' },
  last_edited_time: { en: 'Last edited', pl: 'Ostatnia edycja' },
  last_edited_by: { en: 'Edited by', pl: 'Edytowano przez' },
};

// Categorical row accents → canonical c-tag palette (distinct hues, NOT crimson).
// CSS vars so light/dark themes resolve automatically.
export const ROW_ACCENT_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-2)',
  'var(--c-tag-3)',
  'var(--c-tag-4)',
  'var(--c-tag-5)',
  'var(--c-tag-6)',
  'var(--c-tag-7)',
  'var(--c-tag-8)',
  'var(--c-tag-9)',
  'var(--c-tag-10)',
  'var(--c-tag-11)',
  'var(--c-tag-12)',
  'var(--c-tag-2)',
  'var(--c-tag-8)',
];

export const COLOR_PALETTES: Record<string, { name: string; colors: string[] }> = {
  pastel: {
    name: 'Pastel',
    colors: [
      '#e0e7ff',
      '#dbeafe',
      '#d1fae5',
      '#fef3c7',
      '#fce7f3',
      '#ede9fe',
      '#ccfbf1',
      '#fee2e2',
    ],
  },
  vibrant: {
    name: 'Vibrant',
    colors: [
      '#6366f1',
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#f43f5e',
      '#ec4899',
      '#3b82f6',
      '#84cc16',
    ],
  },
  earth: {
    name: 'Earth',
    colors: [
      '#92400e',
      '#78350f',
      '#365314',
      '#1e3a5f',
      '#4a1d96',
      '#831843',
      '#134e4a',
      '#713f12',
    ],
  },
  ocean: {
    name: 'Ocean',
    colors: [
      '#0ea5e9',
      '#3b82f6',
      '#3b82f6',
      '#2dd4bf',
      '#67e8f9',
      '#a5f3fc',
      '#bae6fd',
      '#7dd3fc',
    ],
  },
  sunset: {
    name: 'Sunset',
    colors: [
      '#f59e0b',
      '#fb923c',
      '#fbbf24',
      '#f43f5e',
      '#f43f5e',
      '#ec4899',
      '#f472b6',
      '#fda4af',
    ],
  },
};

export const COLUMN_TYPE_COLORS: Partial<Record<ColumnType, string>> = {
  text: '#3b82f6',
  number: '#10b981',
  select: '#6366f1',
  multiselect: '#6366f1',
  status: '#f59e0b',
  date: '#f59e0b',
  checkbox: '#3b82f6',
  rating: '#eab308',
  person: '#ec4899',
  url: '#3b82f6',
  progress: '#84cc16',
  formula: '#a855f7',
  ai_generated: '#6366f1',
  file: '#64748b',
  relation: '#f59e0b',
  rollup: '#0ea5e9',
  emoji: '#fbbf24',
  color: '#f43f5e',
  currency: '#10b981',
  phone: '#3b82f6',
  email: '#3b82f6',
  created_time: '#94a3b8',
  created_by: '#94a3b8',
  last_edited_time: '#94a3b8',
  last_edited_by: '#94a3b8',
};

// Categorical select/lane colors → canonical c-tag palette (distinct hues,
// theme-aware via CSS vars). Was a hardcoded pastel hex ramp.
export const SELECT_COLORS = [
  'var(--c-tag-1)',
  'var(--c-tag-2)',
  'var(--c-tag-3)',
  'var(--c-tag-4)',
  'var(--c-tag-5)',
  'var(--c-tag-6)',
  'var(--c-tag-7)',
  'var(--c-tag-8)',
  'var(--c-tag-9)',
  'var(--c-tag-10)',
];

export function evaluateFormula(formula: string, row: Record<string, any>): string | number {
  // R5: delegate to the single shared AST engine (port of the server engine)
  // instead of `new Function`. `{field}` braces are tokenized natively by the
  // core, and bare identifiers resolve against the row by name.
  try {
    const result = evaluateFormulaStringCore(formula, row as Record<string, unknown>);
    if (result == null) return '—';
    return typeof result === 'number' ? Math.round(result * 100) / 100 : String(result);
  } catch {
    return '—';
  }
}

export function computeAggregation(
  agg: ColumnDef['aggregation'],
  values: (string | number | undefined | null)[]
): string {
  if (!agg || agg === 'none') return '';
  const nums = values.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return agg === 'count' ? '0' : '—';
  switch (agg) {
    case 'sum':
      return String(Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100);
    case 'avg':
      return String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100);
    case 'count':
      return String(nums.length);
    case 'min':
      return String(Math.min(...nums));
    case 'max':
      return String(Math.max(...nums));
    default:
      return '';
  }
}
