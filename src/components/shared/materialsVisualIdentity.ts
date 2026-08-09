/**
 * Canonical visual identity for Consultify materials.
 *
 * Keep this deliberately small: it is the shared contract for navigation,
 * launchers and template cards, not a second design system. The visual rules
 * live in `docs/ui-standards/02-components/MATERIALS_EDITOR_VISUAL_STANDARD.md`.
 */
import type { LucideIcon } from 'lucide-react';
import {
  FileSpreadsheet,
  FileText,
  FileType2,
  PanelsTopLeft,
  Presentation,
  TableProperties,
} from 'lucide-react';

export type MaterialKind = 'document' | 'presentation' | 'spreadsheet';

export interface MaterialVisualIdentity {
  /** Icon for the material itself. */
  icon: LucideIcon;
  /** Icon for a reusable template of that material. */
  templateIcon: LucideIcon;
  /** Signal only; editor chrome stays neutral. */
  accent: 'info' | 'fuchsia' | 'emerald';
}

export const MATERIAL_VISUAL_IDENTITY: Record<MaterialKind, MaterialVisualIdentity> = {
  document: {
    icon: FileText,
    templateIcon: FileType2,
    accent: 'info',
  },
  presentation: {
    icon: Presentation,
    templateIcon: PanelsTopLeft,
    accent: 'fuchsia',
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    templateIcon: TableProperties,
    accent: 'emerald',
  },
};

export function getMaterialVisualIdentity(kind: MaterialKind): MaterialVisualIdentity {
  return MATERIAL_VISUAL_IDENTITY[kind];
}
