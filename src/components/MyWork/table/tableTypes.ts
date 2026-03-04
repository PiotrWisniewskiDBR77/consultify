/**
 * Shared types for the Idea Table subsystem.
 * Used by IdeaTableTool, CellRenderer, AddColumnDialog, FilterPanel, etc.
 */

export type ColumnType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
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
  | 'email';

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
}

export type FilterOperator =
  | 'contains'
  | 'equals'
  | 'not_empty'
  | 'is_empty'
  | 'gt'
  | 'lt'
  | 'between'
  | 'in';

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
  layout?: 'table' | 'kanban' | 'matrix';
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
  createdAt: string;
  editedAt?: string;
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

export const COLUMN_TYPE_LABELS: Record<ColumnType, { en: string; pl: string }> = {
  text: { en: 'Text', pl: 'Tekst' },
  number: { en: 'Number', pl: 'Liczba' },
  select: { en: 'Select', pl: 'Wybór' },
  multiselect: { en: 'Multi-select', pl: 'Wielokrotny wybór' },
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
};

export const ROW_ACCENT_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
  '#84cc16', '#eab308', '#f97316', '#ef4444', '#ec4899',
  '#a855f7', '#14b8a6', '#f59e0b', '#64748b',
];

export const COLOR_PALETTES: Record<string, { name: string; colors: string[] }> = {
  pastel: { name: 'Pastel', colors: ['#e0e7ff', '#dbeafe', '#d1fae5', '#fef3c7', '#fce7f3', '#ede9fe', '#ccfbf1', '#fee2e2'] },
  vibrant: { name: 'Vibrant', colors: ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'] },
  earth: { name: 'Earth', colors: ['#92400e', '#78350f', '#365314', '#1e3a5f', '#4a1d96', '#831843', '#134e4a', '#713f12'] },
  ocean: { name: 'Ocean', colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#2dd4bf', '#67e8f9', '#a5f3fc', '#bae6fd', '#7dd3fc'] },
  sunset: { name: 'Sunset', colors: ['#f97316', '#fb923c', '#fbbf24', '#ef4444', '#f43f5e', '#ec4899', '#f472b6', '#fda4af'] },
};

export const COLUMN_TYPE_COLORS: Partial<Record<ColumnType, string>> = {
  text: '#3b82f6',
  number: '#10b981',
  select: '#8b5cf6',
  multiselect: '#6366f1',
  date: '#f59e0b',
  checkbox: '#14b8a6',
  rating: '#eab308',
  person: '#ec4899',
  url: '#06b6d4',
  progress: '#84cc16',
  formula: '#a855f7',
  ai_generated: '#8b5cf6',
  file: '#64748b',
  relation: '#f97316',
  rollup: '#0ea5e9',
  emoji: '#fbbf24',
  color: '#ef4444',
  currency: '#10b981',
  phone: '#3b82f6',
  email: '#06b6d4',
};

export const SELECT_COLORS = [
  '#e0e7ff', '#dbeafe', '#d1fae5', '#fef3c7', '#fce7f3',
  '#ede9fe', '#ccfbf1', '#fee2e2', '#e0f2fe', '#f3e8ff',
];

export function evaluateFormula(formula: string, row: Record<string, any>): string | number {
  try {
    const expr = formula.replace(/\{(\w+)\}/g, (_, key) => {
      const val = row[key];
      return typeof val === 'number' ? String(val) : (Number(val) || 0).toString();
    });
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${expr})`)();
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
    case 'sum': return String(Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100);
    case 'avg': return String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100);
    case 'count': return String(nums.length);
    case 'min': return String(Math.min(...nums));
    case 'max': return String(Math.max(...nums));
    default: return '';
  }
}
