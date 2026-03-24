/**
 * PropertyRegistry — Single source of truth for every column/property type.
 *
 * Each entry defines:
 *  - label (i18n)
 *  - icon key (lucide-react component name)
 *  - default width
 *  - default value for new cells
 *  - validation function
 *  - coerce function (normalize raw value)
 *  - filter operators that make sense for this type
 *  - configFields (what AddColumnDialog should show)
 *  - aggregation support
 *  - renderHint (inline | pill | bar | icon-only | chip-list)
 */
import type { ColumnType, FilterOperator } from './tableTypes';

export type RenderHint = 'inline' | 'pill' | 'bar' | 'icon-only' | 'chip-list' | 'avatar' | 'link';

export type ConfigField =
  | 'options'
  | 'formula'
  | 'aiPrompt'
  | 'currencyCode'
  | 'dateFormat'
  | 'relationTarget'
  | 'rollupSource'
  | 'rollupFunction'
  | 'maxRating';

export interface PropertySpec {
  type: ColumnType;
  label: { en: string; pl: string };
  icon: string;
  defaultWidth: number;
  defaultValue: unknown;
  renderHint: RenderHint;
  supportsAggregation: boolean;
  filterOperators: FilterOperator[];
  configFields: ConfigField[];
  validate: (value: unknown) => boolean;
  coerce: (value: unknown) => unknown;
  group: 'basic' | 'rich' | 'computed' | 'linked';
}

function alwaysValid(): boolean {
  return true;
}

function identity(v: unknown): unknown {
  return v;
}

const TEXT_FILTERS: FilterOperator[] = ['contains', 'equals', 'not_empty', 'is_empty'];
const NUMBER_FILTERS: FilterOperator[] = ['equals', 'gt', 'lt', 'between', 'not_empty', 'is_empty'];
const SELECT_FILTERS: FilterOperator[] = ['equals', 'in', 'not_empty', 'is_empty'];
const BOOL_FILTERS: FilterOperator[] = ['equals'];

export const PROPERTY_REGISTRY: Record<ColumnType, PropertySpec> = {
  text: {
    type: 'text',
    label: { en: 'Text', pl: 'Tekst' },
    icon: 'Type',
    defaultWidth: 240,
    defaultValue: '',
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? '' : String(v)),
    group: 'basic',
  },
  number: {
    type: 'number',
    label: { en: 'Number', pl: 'Liczba' },
    icon: 'Hash',
    defaultWidth: 120,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: [],
    validate: (v) => v == null || typeof v === 'number' || !isNaN(Number(v)),
    coerce: (v) => (v == null || v === '' ? null : Number(v)),
    group: 'basic',
  },
  select: {
    type: 'select',
    label: { en: 'Select', pl: 'Wybór' },
    icon: 'List',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'pill',
    supportsAggregation: false,
    filterOperators: SELECT_FILTERS,
    configFields: ['options'],
    validate: alwaysValid,
    coerce: (v) => (v == null ? null : String(v)),
    group: 'basic',
  },
  multiselect: {
    type: 'multiselect',
    label: { en: 'Multi-select', pl: 'Wielokrotny wybór' },
    icon: 'ListChecks',
    defaultWidth: 180,
    defaultValue: [],
    renderHint: 'chip-list',
    supportsAggregation: false,
    filterOperators: ['in', 'not_empty', 'is_empty'],
    configFields: ['options'],
    validate: (v) => v == null || Array.isArray(v),
    coerce: (v) => {
      if (Array.isArray(v)) return v;
      if (v == null || v === '') return [];
      return [String(v)];
    },
    group: 'basic',
  },
  status: {
    type: 'status',
    label: { en: 'Status', pl: 'Status' },
    icon: 'CircleDot',
    defaultWidth: 130,
    defaultValue: 'todo',
    renderHint: 'pill',
    supportsAggregation: false,
    filterOperators: SELECT_FILTERS,
    configFields: ['options'],
    validate: alwaysValid,
    coerce: (v) => (v == null ? 'todo' : String(v)),
    group: 'basic',
  },
  date: {
    type: 'date',
    label: { en: 'Date', pl: 'Data' },
    icon: 'Calendar',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: ['equals', 'gt', 'lt', 'between', 'not_empty', 'is_empty'],
    configFields: ['dateFormat'],
    validate: (v) => v == null || typeof v === 'string',
    coerce: (v) => (v == null || v === '' ? null : String(v).slice(0, 10)),
    group: 'basic',
  },
  checkbox: {
    type: 'checkbox',
    label: { en: 'Checkbox', pl: 'Checkbox' },
    icon: 'CheckSquare',
    defaultWidth: 80,
    defaultValue: false,
    renderHint: 'icon-only',
    supportsAggregation: false,
    filterOperators: BOOL_FILTERS,
    configFields: [],
    validate: (v) => typeof v === 'boolean' || v == null,
    coerce: (v) => Boolean(v),
    group: 'basic',
  },
  rating: {
    type: 'rating',
    label: { en: 'Rating', pl: 'Ocena' },
    icon: 'Star',
    defaultWidth: 120,
    defaultValue: 0,
    renderHint: 'icon-only',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: ['maxRating'],
    validate: (v) => v == null || (typeof v === 'number' && v >= 0 && v <= 10),
    coerce: (v) => Math.max(0, Math.min(10, Number(v) || 0)),
    group: 'basic',
  },
  person: {
    type: 'person',
    label: { en: 'Person', pl: 'Osoba' },
    icon: 'User',
    defaultWidth: 150,
    defaultValue: null,
    renderHint: 'avatar',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? null : String(v)),
    group: 'basic',
  },
  url: {
    type: 'url',
    label: { en: 'URL', pl: 'URL' },
    icon: 'Link2',
    defaultWidth: 200,
    defaultValue: '',
    renderHint: 'link',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? '' : String(v)),
    group: 'basic',
  },
  progress: {
    type: 'progress',
    label: { en: 'Progress', pl: 'Postęp' },
    icon: 'Percent',
    defaultWidth: 160,
    defaultValue: 0,
    renderHint: 'bar',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: [],
    validate: (v) => v == null || (typeof v === 'number' && v >= 0 && v <= 100),
    coerce: (v) => Math.max(0, Math.min(100, Number(v) || 0)),
    group: 'basic',
  },
  formula: {
    type: 'formula',
    label: { en: 'Formula', pl: 'Formuła' },
    icon: 'Calculator',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: ['formula'],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
  ai_generated: {
    type: 'ai_generated',
    label: { en: 'AI Generated', pl: 'Wygenerowane AI' },
    icon: 'Sparkles',
    defaultWidth: 200,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: ['aiPrompt'],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
  file: {
    type: 'file',
    label: { en: 'File', pl: 'Plik' },
    icon: 'File',
    defaultWidth: 160,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: ['not_empty', 'is_empty'],
    configFields: [],
    validate: alwaysValid,
    coerce: identity,
    group: 'rich',
  },
  relation: {
    type: 'relation',
    label: { en: 'Relation', pl: 'Relacja' },
    icon: 'Link2',
    defaultWidth: 180,
    defaultValue: null,
    renderHint: 'chip-list',
    supportsAggregation: false,
    filterOperators: ['not_empty', 'is_empty'],
    configFields: ['relationTarget'],
    validate: alwaysValid,
    coerce: identity,
    group: 'linked',
  },
  rollup: {
    type: 'rollup',
    label: { en: 'Rollup', pl: 'Agregacja' },
    icon: 'Sigma',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: ['rollupSource', 'rollupFunction'],
    validate: alwaysValid,
    coerce: identity,
    group: 'linked',
  },
  emoji: {
    type: 'emoji',
    label: { en: 'Emoji', pl: 'Emoji' },
    icon: 'Smile',
    defaultWidth: 80,
    defaultValue: null,
    renderHint: 'icon-only',
    supportsAggregation: false,
    filterOperators: ['equals', 'not_empty', 'is_empty'],
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? null : String(v)),
    group: 'rich',
  },
  color: {
    type: 'color',
    label: { en: 'Color', pl: 'Kolor' },
    icon: 'Palette',
    defaultWidth: 100,
    defaultValue: null,
    renderHint: 'icon-only',
    supportsAggregation: false,
    filterOperators: ['equals', 'not_empty', 'is_empty'],
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? null : String(v)),
    group: 'rich',
  },
  currency: {
    type: 'currency',
    label: { en: 'Currency', pl: 'Waluta' },
    icon: 'DollarSign',
    defaultWidth: 130,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: true,
    filterOperators: NUMBER_FILTERS,
    configFields: ['currencyCode'],
    validate: (v) => v == null || !isNaN(Number(v)),
    coerce: (v) => (v == null || v === '' ? null : Number(v)),
    group: 'rich',
  },
  phone: {
    type: 'phone',
    label: { en: 'Phone', pl: 'Telefon' },
    icon: 'Phone',
    defaultWidth: 150,
    defaultValue: '',
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? '' : String(v)),
    group: 'rich',
  },
  email: {
    type: 'email',
    label: { en: 'Email', pl: 'Email' },
    icon: 'Mail',
    defaultWidth: 200,
    defaultValue: '',
    renderHint: 'link',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: (v) => (v == null ? '' : String(v)),
    group: 'rich',
  },
  created_time: {
    type: 'created_time',
    label: { en: 'Created time', pl: 'Czas utworzenia' },
    icon: 'Clock',
    defaultWidth: 160,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: ['gt', 'lt', 'between', 'not_empty', 'is_empty'],
    configFields: [],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
  created_by: {
    type: 'created_by',
    label: { en: 'Created by', pl: 'Utworzono przez' },
    icon: 'UserPlus',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'avatar',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
  last_edited_time: {
    type: 'last_edited_time',
    label: { en: 'Last edited', pl: 'Ostatnia edycja' },
    icon: 'Clock',
    defaultWidth: 160,
    defaultValue: null,
    renderHint: 'inline',
    supportsAggregation: false,
    filterOperators: ['gt', 'lt', 'between', 'not_empty', 'is_empty'],
    configFields: [],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
  last_edited_by: {
    type: 'last_edited_by',
    label: { en: 'Edited by', pl: 'Edytowano przez' },
    icon: 'UserCheck',
    defaultWidth: 140,
    defaultValue: null,
    renderHint: 'avatar',
    supportsAggregation: false,
    filterOperators: TEXT_FILTERS,
    configFields: [],
    validate: alwaysValid,
    coerce: identity,
    group: 'computed',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getPropertySpec(type: ColumnType): PropertySpec {
  return PROPERTY_REGISTRY[type] ?? PROPERTY_REGISTRY.text;
}

export function getDefaultValue(type: ColumnType): unknown {
  return getPropertySpec(type).defaultValue;
}

export function coerceValue(type: ColumnType, value: unknown): unknown {
  return getPropertySpec(type).coerce(value);
}

export function validateValue(type: ColumnType, value: unknown): boolean {
  return getPropertySpec(type).validate(value);
}

export function getFilterOperators(type: ColumnType): FilterOperator[] {
  return getPropertySpec(type).filterOperators;
}

export function getPropertyGroups(): {
  key: string;
  label: { en: string; pl: string };
  types: ColumnType[];
}[] {
  return [
    {
      key: 'basic',
      label: { en: 'Basic', pl: 'Podstawowe' },
      types: Object.values(PROPERTY_REGISTRY)
        .filter((s) => s.group === 'basic')
        .map((s) => s.type),
    },
    {
      key: 'rich',
      label: { en: 'Rich', pl: 'Zaawansowane' },
      types: Object.values(PROPERTY_REGISTRY)
        .filter((s) => s.group === 'rich')
        .map((s) => s.type),
    },
    {
      key: 'computed',
      label: { en: 'Computed', pl: 'Obliczane' },
      types: Object.values(PROPERTY_REGISTRY)
        .filter((s) => s.group === 'computed')
        .map((s) => s.type),
    },
    {
      key: 'linked',
      label: { en: 'Linked', pl: 'Powiązane' },
      types: Object.values(PROPERTY_REGISTRY)
        .filter((s) => s.group === 'linked')
        .map((s) => s.type),
    },
  ];
}
