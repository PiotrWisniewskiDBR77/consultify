/**
 * Level metadata for the 8-level AI Editor.
 *
 * One source of truth for label / icon / short description so the
 * panel, level cards, and tests stay in sync.
 *
 * Block C · EPIC-T10 · Sprint C-S5.
 */

import { Boxes, Code2, Columns3, Filter, Library, PenLine, Rows, ShieldCheck } from 'lucide-react';

import type { AiEditorLevel } from '@/services/api/tablePlatform.api';

export interface AiEditorLevelMeta {
  id: AiEditorLevel;
  numeral: number;
  /** English default label. Prefer translateLevelMeta(meta, t) for display. */
  label: string;
  /** English default description. Prefer translateLevelMeta(meta, t) for display. */
  description: string;
  labelKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Levels 7 (methodological) and 8 (source) require super-admin role. */
  superAdminOnly?: boolean;
}

export const AI_EDITOR_LEVELS_META: AiEditorLevelMeta[] = [
  {
    id: 'cell',
    numeral: 1,
    label: 'Cell',
    description: 'Refine a single cell value.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.cell.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.cell.description',
    icon: PenLine,
  },
  {
    id: 'record',
    numeral: 2,
    label: 'Record',
    description: 'Fill missing fields on one record.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.record.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.record.description',
    icon: Rows,
  },
  {
    id: 'column',
    numeral: 3,
    label: 'Column',
    description: 'Bulk-fill one column across visible records.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.column.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.column.description',
    icon: Columns3,
  },
  {
    id: 'structure',
    numeral: 4,
    label: 'Structure',
    description: 'Add, rename, retype, or drop fields.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.structure.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.structure.description',
    icon: Boxes,
  },
  {
    id: 'view',
    numeral: 5,
    label: 'View',
    description: 'Create or update a saved view config.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.view.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.view.description',
    icon: Filter,
  },
  {
    id: 'relational',
    numeral: 6,
    label: 'Relations',
    description: 'Propose new linked-record relations.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.relational.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.relational.description',
    icon: Library,
  },
  {
    id: 'methodological',
    numeral: 7,
    label: 'Methodology',
    description: 'Flag deviations from governance rules.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.methodological.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.methodological.description',
    icon: ShieldCheck,
    superAdminOnly: true,
  },
  {
    id: 'source',
    numeral: 8,
    label: 'Sources',
    description: 'Suggest sources for records that lack them.',
    labelKey: 'kimi.tabeleShell.aiEditor.level.source.label',
    descriptionKey: 'kimi.tabeleShell.aiEditor.level.source.description',
    icon: Code2,
    superAdminOnly: true,
  },
];

export function getLevelMeta(id: AiEditorLevel): AiEditorLevelMeta {
  const meta = AI_EDITOR_LEVELS_META.find((m) => m.id === id);
  if (meta) return meta;
  return {
    id,
    numeral: 0,
    label: id,
    description: '',
    labelKey: '',
    descriptionKey: '',
    icon: PenLine,
  };
}

/** Resolve the display label/description for a level via i18next `t`, falling
 *  back to the English defaults baked into AI_EDITOR_LEVELS_META. */
export function translateLevelMeta(
  meta: AiEditorLevelMeta,
  t: (key: string, def: string) => string
): { label: string; description: string } {
  return {
    label: meta.labelKey ? t(meta.labelKey, meta.label) : meta.label,
    description: meta.descriptionKey ? t(meta.descriptionKey, meta.description) : meta.description,
  };
}
