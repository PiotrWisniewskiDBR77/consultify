import { describe, expect, it } from 'vitest';

import {
  getArtifactStudioRolloutDecision,
  isArtifactStudioLaneEnabled,
} from '../artifactStudioFlags';

const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
});

describe('Artifact Studio rollout flags', () => {
  it('is fail-closed when no flags are configured', () => {
    // Tor `document` (Word) nie ma decyzji właściciela → nadal fail-closed.
    expect(isArtifactStudioLaneEnabled('document', {})).toBe(false);
  });

  it('requires both the global and lane flag', () => {
    expect(
      isArtifactStudioLaneEnabled('document', {
        storage: storage({ 'ff.artifact_studio': '1' }),
      })
    ).toBe(false);

    expect(
      isArtifactStudioLaneEnabled('document', {
        storage: storage({
          'ff.artifact_studio': '1',
          'ff.document_studio_v2': '1',
        }),
      })
    ).toBe(true);
  });

  it('allows query flags to override stored values for operator rollback', () => {
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        query: new URLSearchParams('ff_artifactStudio=1&ff_presentationStudioV2=0'),
        storage: storage({
          'ff.artifact_studio': '1',
          'ff.presentation_studio_v2': '1',
        }),
      })
    ).toBe(false);
  });

  it('isolates lane enablement', () => {
    const source = {
      query: new URLSearchParams('ff_documentStudioV2=0'),
    };
    // Jawne `0` gasi WYŁĄCZNIE swój tor; dwa tory z decyzją właściciela
    // (arkusz 2026-08-30, prezentacja 2026-08-30) zostają włączone.
    expect(isArtifactStudioLaneEnabled('document', source)).toBe(false);
    expect(isArtifactStudioLaneEnabled('presentation', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('spreadsheet', source)).toBe(true);
  });

  it('★ WORD (tor `document`) zostaje wyłączony, choć arkusz i prezentacja są włączone', () => {
    // ★ To jest bezpiecznik regresji WORDA. Gdyby ktoś przestawił domyślną
    // wartość wspólnie dla wszystkich torów, `DocumentStudioDocumentPanel`
    // (linia ~3549: `rightRailTools` zerowane w trybie warsztatu) wygasiłby
    // prawy pas ikon — czyli zabrałby Wordowi panel, który właściciel uznaje
    // za działający. Ten test ma paść, jeśli ktoś zrobi to hurtem.
    expect(isArtifactStudioLaneEnabled('document', {})).toBe(false);
    expect(isArtifactStudioLaneEnabled('spreadsheet', {})).toBe(true);
    expect(isArtifactStudioLaneEnabled('presentation', {})).toBe(true);
  });

  it('★ PREZENTACJA włączona domyślnie — ale tylko razem z prawym panelem powłoki', () => {
    // Warunek, który tę wartość uzasadnia, jest w KODZIE, nie w tym pliku:
    // `DeckBuilderMelsView` musi podawać powłoce `artifactRightPanelSlot`.
    // Bez niego `rightRailTools={[]}` + `aiEntrySlot` tylko przy torze OFF
    // dawały prezentacji 0 px prawej powierzchni (zmierzone: 417 px → 0 px).
    expect(isArtifactStudioLaneEnabled('presentation', {})).toBe(true);
  });

  it('keeps an explicit off switch for the presentation lane (przycisk cofania)', () => {
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        query: new URLSearchParams('ff_presentationStudioV2=0'),
      })
    ).toBe(false);
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        query: new URLSearchParams('ff_artifactStudio=0'),
      })
    ).toBe(false);
    expect(
      isArtifactStudioLaneEnabled('presentation', {
        env: { VITE_PRESENTATION_STUDIO_V2: 'false' },
      })
    ).toBe(false);
  });

  it('keeps an explicit off switch for the spreadsheet lane (przycisk cofania)', () => {
    expect(
      isArtifactStudioLaneEnabled('spreadsheet', {
        query: new URLSearchParams('ff_spreadsheetStudioV2=0'),
      })
    ).toBe(false);
    expect(
      isArtifactStudioLaneEnabled('spreadsheet', {
        query: new URLSearchParams('ff_artifactStudio=0'),
      })
    ).toBe(false);
    expect(
      isArtifactStudioLaneEnabled('spreadsheet', {
        env: { VITE_SPREADSHEET_STUDIO_V2: 'false' },
      })
    ).toBe(false);
  });

  it('reports flag provenance without exposing raw values', () => {
    const decision = getArtifactStudioRolloutDecision('spreadsheet', {
      query: new URLSearchParams('ff_artifactStudio=1'),
      storage: storage({ 'ff.spreadsheet_studio_v2': 'true' }),
    });

    expect(decision).toEqual({
      lane: 'spreadsheet',
      enabled: true,
      globalEnabled: true,
      laneEnabled: true,
      globalSource: 'query',
      laneSource: 'storage',
    });
    expect(decision).not.toHaveProperty('rawValue');
  });

  it('reports a fail-closed default decision', () => {
    expect(getArtifactStudioRolloutDecision('document', {})).toEqual({
      lane: 'document',
      enabled: false,
      globalEnabled: false,
      laneEnabled: false,
      globalSource: 'default',
      laneSource: 'default',
    });
  });

  it('enables every lane from the central demo acceptance profile', () => {
    const source = {
      env: { VITE_DEMO_ACCEPTANCE: 'true' },
      hostname: 'demo.consultify.ai',
    };
    expect(isArtifactStudioLaneEnabled('document', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('presentation', source)).toBe(true);
    expect(isArtifactStudioLaneEnabled('spreadsheet', source)).toBe(true);
  });

  it('never enables the acceptance profile on public production', () => {
    expect(
      isArtifactStudioLaneEnabled('document', {
        env: { VITE_DEMO_ACCEPTANCE: 'true' },
        hostname: 'consultify.ai',
      })
    ).toBe(false);
  });
});
