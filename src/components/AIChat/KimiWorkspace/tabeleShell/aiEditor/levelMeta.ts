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
  label: string;
  description: string;
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
    icon: PenLine,
  },
  {
    id: 'record',
    numeral: 2,
    label: 'Record',
    description: 'Fill missing fields on one record.',
    icon: Rows,
  },
  {
    id: 'column',
    numeral: 3,
    label: 'Column',
    description: 'Bulk-fill one column across visible records.',
    icon: Columns3,
  },
  {
    id: 'structure',
    numeral: 4,
    label: 'Structure',
    description: 'Add, rename, retype, or drop fields.',
    icon: Boxes,
  },
  {
    id: 'view',
    numeral: 5,
    label: 'View',
    description: 'Create or update a saved view config.',
    icon: Filter,
  },
  {
    id: 'relational',
    numeral: 6,
    label: 'Relations',
    description: 'Propose new linked-record relations.',
    icon: Library,
  },
  {
    id: 'methodological',
    numeral: 7,
    label: 'Methodology',
    description: 'Flag deviations from governance rules.',
    icon: ShieldCheck,
    superAdminOnly: true,
  },
  {
    id: 'source',
    numeral: 8,
    label: 'Sources',
    description: 'Suggest sources for records that lack them.',
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
    icon: PenLine,
  };
}
