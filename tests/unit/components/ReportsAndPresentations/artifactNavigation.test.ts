import { describe, expect, it } from 'vitest';

import { resolveArtifactOpenPath } from '../../../../src/components/ReportsAndPresentations/artifactNavigation';
import { getArtifactPath } from '../../../../src/utils/artifactLinks';

describe('resolveArtifactOpenPath', () => {
  it('prefers explicit governance.openPath when set', () => {
    expect(
      resolveArtifactOpenPath({
        kind: 'document',
        originRecordId: 'r1',
        governance: { openPath: '/custom/open/r1' },
      })
    ).toBe('/custom/open/r1');
  });

  it('uses getArtifactPath for documents when no explicit openPath', () => {
    const id = 'rep-build-99';
    expect(resolveArtifactOpenPath({ kind: 'document', originRecordId: id, governance: {} })).toBe(
      getArtifactPath('report', id)
    );
  });

  it('uses getArtifactPath for presentations when no explicit openPath', () => {
    const id = 'deck-77';
    expect(
      resolveArtifactOpenPath({ kind: 'presentation', originRecordId: id, governance: null })
    ).toBe(getArtifactPath('presentation', id));
  });

  it('returns null for sheet (handled by sheet-specific open path)', () => {
    expect(
      resolveArtifactOpenPath({ kind: 'sheet', originRecordId: 'tp-1', governance: null })
    ).toBeNull();
  });

  it('returns null when originRecordId is empty', () => {
    expect(
      resolveArtifactOpenPath({ kind: 'document', originRecordId: '   ', governance: null })
    ).toBeNull();
  });
});
