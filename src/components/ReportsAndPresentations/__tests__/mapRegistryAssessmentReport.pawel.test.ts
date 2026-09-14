/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] P-P13 (`56c2cc19`) — „I created
 * assesments reports, but they are not avalibel in Materials/Documents".
 *
 * Zmierzone: `mapRegistryItemToUnified` znało cztery runtime'y rodziny
 * dokumentów, a `assessment_report` był piątym — wiersz wracał `null`
 * i wypadał z listy PRZED jakimkolwiek filtrem zakładki. Ta sama klasa błędu,
 * co poprawka P0.2 dla `native_artifact`.
 */
import { describe, expect, it } from 'vitest';

import { mapRegistryItemToUnified } from '../useRapData';

const WIERSZ_REJESTRU = {
  artifactId: '172d1ffb-feeb-4793-916d-2b9a63c33295',
  originRuntime: 'assessment_report',
  originRecordId: '7051ebd9-0b5a-4ea9-a99b-02dbd46275cc',
  resolvedTitle: 'DRD report — 20260914',
  deliveryState: 'draft',
  visibilityScope: 'organization',
  openPath: '/assessment/drd/7051ebd9-0b5a-4ea9-a99b-02dbd46275cc',
  createdAt: '2026-09-14T05:22:00.000Z',
};

describe('mapRegistryItemToUnified — assessment_report', () => {
  it('raport oceny trafia do rodziny dokumentów (zakładka Materiały → Dokumenty)', () => {
    const row = mapRegistryItemToUnified(WIERSZ_REJESTRU);

    expect(row).not.toBeNull();
    expect(row!.kind).toBe('document');
    expect(row!.artifactId).toBe(WIERSZ_REJESTRU.artifactId);
    expect(row!.originRecordId).toBe(WIERSZ_REJESTRU.originRecordId);
  });

  it('wiersz bez runtime albo bez identyfikatora źródła nadal odpada', () => {
    expect(mapRegistryItemToUnified({ ...WIERSZ_REJESTRU, originRuntime: null })).toBeNull();
    expect(mapRegistryItemToUnified({ ...WIERSZ_REJESTRU, originRecordId: null })).toBeNull();
  });
});
