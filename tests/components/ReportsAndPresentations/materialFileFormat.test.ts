import { describe, expect, it } from 'vitest';

import {
  compareMaterialFileFormats,
  resolveMaterialFileFormat,
} from '../../../src/components/ReportsAndPresentations/materialFileFormat';

describe('material file format contract', () => {
  it.each([
    [{ fileFormat: 'docx' }, 'DOCX'],
    [{ exportFormat: 'PDF' }, 'PDF'],
    [{ mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, 'XLSX'],
    [{ filename: 'board-pack.PPTX' }, 'PPTX'],
    [{ originSummary: { storagePath: '/materials/model.xlsx?version=2' } }, 'XLSX'],
  ] as const)('resolves trustworthy format signal from %o', (source, expected) => {
    expect(resolveMaterialFileFormat(source)).toBe(expected);
  });

  it('does not infer a file format merely from generic artifact kind or runtime', () => {
    expect(resolveMaterialFileFormat({ title: 'Quarterly report' } as any)).toBe('Unknown');
    expect(resolveMaterialFileFormat({ kind: 'document', originRuntime: 'report' } as any)).toBe(
      'Unknown'
    );
  });

  it('uses deterministic canonical order including Unknown', () => {
    expect(['Unknown', 'PPTX', 'DOCX', 'PDF', 'XLSX'].sort(compareMaterialFileFormats)).toEqual([
      'DOCX',
      'PDF',
      'XLSX',
      'PPTX',
      'Unknown',
    ]);
  });
});
