import {
  FileSpreadsheet,
  FileText,
  FileType2,
  PanelsTopLeft,
  Presentation,
  TableProperties,
} from 'lucide-react';
import { describe, expect, it } from 'vitest';

import {
  getMaterialVisualIdentity,
  MATERIAL_VISUAL_IDENTITY,
} from '@/components/shared/materialsVisualIdentity';

describe('MATERIAL_VISUAL_IDENTITY', () => {
  it('uses the canonical Lucide identity and template icons for every material', () => {
    expect(MATERIAL_VISUAL_IDENTITY.document).toMatchObject({
      icon: FileText,
      templateIcon: FileType2,
      accent: 'info',
    });
    expect(MATERIAL_VISUAL_IDENTITY.presentation).toMatchObject({
      icon: Presentation,
      templateIcon: PanelsTopLeft,
      accent: 'fuchsia',
    });
    expect(MATERIAL_VISUAL_IDENTITY.spreadsheet).toMatchObject({
      icon: FileSpreadsheet,
      templateIcon: TableProperties,
      accent: 'emerald',
    });
  });

  it('has one stable lookup seam for shared launchers and template builders', () => {
    expect(getMaterialVisualIdentity('document')).toBe(MATERIAL_VISUAL_IDENTITY.document);
    expect(getMaterialVisualIdentity('presentation')).toBe(MATERIAL_VISUAL_IDENTITY.presentation);
    expect(getMaterialVisualIdentity('spreadsheet')).toBe(MATERIAL_VISUAL_IDENTITY.spreadsheet);
  });
});
