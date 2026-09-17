/**
 * DOC-0 etap 1 (b) (DEC-595, Wpis 68) — lista dokumentów BEZ sierot 404.
 *
 * `archiveContentlessDocumentRows` (documentRegistryBackfillService) archiwizuje
 * 6 wierszy `artifact_family='document'`, których treść nie istnieje w ŻADNYM
 * rejestrze, i stempluje w ISTNIEJĄCEJ kolumnie `origin_summary_json` etykietę
 * `doc0Orphan` (zero DDL). Reguła w `matchesViewFilters`: PARA
 * (delivery_state='archived' + etykieta) nie wchodzi do listy — sam 'archived'
 * NIE wystarcza, bo archiwum z wyboru użytkownika zostaje widoczne (filtr
 * statusu 'archived' w Outputs). Odwracalność: `restoreArchivedDocumentRows`
 * cofa delivery_state i ZOSTAWIA etykietę — para się rozpada, wiersz wraca.
 *
 * MUTACJA (zmierzona, meldunek Wpis 68): usunięcie reguły archived+etykieta
 * z `matchesViewFilters` → test „ukrywa sierotę" CZERWONY.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDbAll = vi.fn();
const mockDbGet = vi.fn();
const mockDbRun = vi.fn();

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => mockDbAll(...args),
  get: (...args: unknown[]) => mockDbGet(...args),
  run: (...args: unknown[]) => mockDbRun(...args),
}));

vi.mock('../v8/featureFlagService.js', () => ({
  isV8Enabled: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import type { ArtifactListItem } from '../../types/artifactRegistry.js';
import { matchesViewFilters } from '../v8/artifactRegistryService.js';

function documentListItem(overrides: Partial<ArtifactListItem> = {}): ArtifactListItem {
  return {
    artifactId: 'art-doc0-1',
    organizationId: 'org-alpha',
    outputType: 'report',
    artifactFamily: 'document',
    deliveryState: 'ready',
    titleSnapshot: 'Quarterly Review',
    ownerUserId: null,
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
    createdBy: 'system',
    createdAt: '2026-09-01T10:00:00.000Z',
    lastTransitionAt: '2026-09-01T10:00:00.000Z',
    originRuntime: 'report',
    originRecordId: 'rpt-doc0-1',
    resolvedTitle: 'Quarterly Review',
    originTitle: null,
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

const ORPHAN_LABEL = { doc0Orphan: true, doc0OrphanReason: 'not_found', doc0OrphanArchivedAt: '2026-09-17T00:00:00.000Z' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('matchesViewFilters — DEC-595: sieroty 404 poza listą dokumentów', () => {
  it('ukrywa dokument archived + doc0Orphan (dokładnie sierota z backfillu)', () => {
    const orphan = documentListItem({
      deliveryState: 'archived',
      originSummary: ORPHAN_LABEL,
    });
    expect(matchesViewFilters(orphan, {}, 'user-1')).toBe(false);
    expect(matchesViewFilters(orphan, { artifactFamily: 'document' }, 'user-1')).toBe(false);
  });

  it('POKAZUJE dokument archived BEZ etykiety (archiwum z wyboru użytkownika)', () => {
    const userArchived = documentListItem({ deliveryState: 'archived' });
    expect(matchesViewFilters(userArchived, {}, 'user-1')).toBe(true);
  });

  it('POKAZUJE wiersz przywrócony: etykieta zostaje, delivery_state sprzed archiwizacji (odwracalność)', () => {
    const restored = documentListItem({
      deliveryState: 'ready',
      originSummary: ORPHAN_LABEL,
    });
    expect(matchesViewFilters(restored, {}, 'user-1')).toBe(true);
  });

  it('etykieta bez archived NIE ukrywa innych rodzin (reguła tylko document+archived)', () => {
    const presentation = documentListItem({
      outputType: 'presentation',
      artifactFamily: 'presentation',
      deliveryState: 'archived',
      originSummary: ORPHAN_LABEL,
    });
    expect(matchesViewFilters(presentation, {}, 'user-1')).toBe(true);
  });

  it('nieczysty originSummary (brak doc0Orphan / inna wartość) NIE ukrywa archived', () => {
    const noisy = documentListItem({
      deliveryState: 'archived',
      originSummary: { sourceType: 'doc0_native_backfill', doc0Orphan: 'true' },
    });
    expect(matchesViewFilters(noisy, {}, 'user-1')).toBe(true);
  });
});
