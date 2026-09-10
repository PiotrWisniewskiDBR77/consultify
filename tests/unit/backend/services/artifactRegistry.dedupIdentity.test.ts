/**
 * P15 — dedup listy artefaktów po TOŻSAMOŚCI, nie po nazwie.
 *
 * Defekt (zmierzony na stagingu 10.09.2026): `dedupeArtifacts` kluczował po
 * `resolvedTitle + outputType + originRuntime`, więc dwa RÓŻNE dokumenty
 * (różny `originRecordId`) o tej samej nazwie zwijały się w jeden wiersz —
 * 283 realne, niedraftowe artefakty były niewidoczne, a ANI JEDEN z nich nie
 * był prawdziwym duplikatem (0 grup dzielących `origin_runtime+origin_record_id`).
 *
 * Intencja DEC-4 (M17/S6.3, „filtr śmieci") zostaje uszanowana: ten sam obiekt
 * źródłowy zarejestrowany kilka razy nadal zwija się do najnowszego wiersza
 * z licznikiem wersji. Zmienia się WYŁĄCZNIE klucz: tożsamość origin zamiast nazwy.
 */
import { describe, expect, it } from 'vitest';

import { dedupeArtifacts } from '../../../../server/src/services/v8/artifactRegistryService.js';
import type { ArtifactListItem } from '../../../../server/src/types/artifactRegistry.js';

function makeItem(overrides: Partial<ArtifactListItem> = {}): ArtifactListItem {
  return {
    artifactId: 'art-1',
    organizationId: 'org-1',
    outputType: 'report',
    artifactFamily: 'document',
    deliveryState: 'ready',
    titleSnapshot: 'Raport otwarcia',
    ownerUserId: 'user-1',
    canonicalHome: 'outputs_library',
    visibilityScope: 'organization',
    projectId: null,
    contextSnapshotId: null,
    executionRunId: null,
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    originSummary: null,
    isDraft: false,
    createdBy: 'user-1',
    createdAt: '2026-09-01T00:00:00.000Z',
    lastTransitionAt: '2026-09-01T00:00:00.000Z',
    originRuntime: 'report',
    originRecordId: 'rec-1',
    resolvedTitle: 'Raport otwarcia',
    originTitle: 'Raport otwarcia',
    originStatus: null,
    reportType: null,
    presentationMode: null,
    slideCount: null,
    exportFormat: null,
    sourceRefs: [],
    publishState: null,
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: null,
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...overrides,
  } as ArtifactListItem;
}

describe('dedupeArtifacts — dwa różne dokumenty o tej samej nazwie', () => {
  it('pokazuje OBA dokumenty, gdy różnią się rekordem źródłowym', () => {
    const nowszy = makeItem({ artifactId: 'artifact-nowszy', originRecordId: 'rec-A' });
    const starszy = makeItem({ artifactId: 'artifact-starszy', originRecordId: 'rec-B' });

    const result = dedupeArtifacts([nowszy, starszy]);

    expect(result.map((r) => r.artifactId)).toEqual(['artifact-nowszy', 'artifact-starszy']);
    expect(result.every((r) => r.duplicateCount === 1)).toBe(true);
    expect(result.every((r) => r.duplicateArtifactIds.length === 0)).toBe(true);
  });

  it('rodzina: to samo dla prezentacji, arkuszy i szablonów', () => {
    const rodzina: Array<[ArtifactListItem['outputType'], string]> = [
      ['presentation', 'presentation'],
      ['sheet', 'sheet'],
      ['report', 'document_template'],
    ];
    for (const [outputType, originRuntime] of rodzina) {
      const a = makeItem({ artifactId: `${outputType}-a`, outputType, originRuntime: originRuntime as never, originRecordId: 'src-A', resolvedTitle: 'Ten sam tytuł' });
      const b = makeItem({ artifactId: `${outputType}-b`, outputType, originRuntime: originRuntime as never, originRecordId: 'src-B', resolvedTitle: 'Ten sam tytuł' });
      expect(dedupeArtifacts([a, b]).map((r) => r.artifactId)).toEqual([
        `${outputType}-a`,
        `${outputType}-b`,
      ]);
    }
  });

  it('bez rekordu źródłowego każdy artefakt zostaje osobnym wierszem', () => {
    const a = makeItem({ artifactId: 'brak-a', originRuntime: null, originRecordId: null });
    const b = makeItem({ artifactId: 'brak-b', originRuntime: null, originRecordId: null });

    expect(dedupeArtifacts([a, b])).toHaveLength(2);
  });

  it('DEC-4 zachowane: ten sam obiekt źródłowy nadal zwija się do najnowszego', () => {
    const v3 = makeItem({ artifactId: 'v3', originRecordId: 'rec-X' });
    const v2 = makeItem({ artifactId: 'v2', originRecordId: 'rec-X' });
    const v1 = makeItem({ artifactId: 'v1', originRecordId: 'rec-X' });

    const result = dedupeArtifacts([v3, v2, v1]);

    expect(result).toHaveLength(1);
    expect(result[0].artifactId).toBe('v3');
    expect(result[0].duplicateCount).toBe(3);
    expect(result[0].duplicateArtifactIds).toEqual(['v2', 'v1']);
  });

  it('nie mutuje wejścia', () => {
    const a = makeItem({ artifactId: 'a', originRecordId: 'rec-X' });
    const b = makeItem({ artifactId: 'b', originRecordId: 'rec-X' });
    dedupeArtifacts([a, b]);
    expect(a.duplicateCount).toBe(1);
    expect(a.duplicateArtifactIds).toEqual([]);
  });
});
