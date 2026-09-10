/**
 * P15 — generator danych dowodowych do harnessu dev-render.
 *
 * Bierze DWA różne dokumenty o IDENTYCZNYM tytule (różne `originRecordId`) i
 * przepuszcza je przez PRAWDZIWĄ serwerową `dedupeArtifacts` — tę samą funkcję,
 * której używa `listArtifactsForUser`. Wynik ląduje w JSON, który montuje ekran
 * harnessu, więc zrzut pokazuje realny wynik serwera, nie ręczny mock.
 *
 * Przed naprawą ten JSON miał JEDEN wiersz; po naprawie ma DWA.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { dedupeArtifacts } from '../../server/src/services/v8/artifactRegistryService.js';
import type { ArtifactListItem } from '../../server/src/types/artifactRegistry.js';

function dokument(over: Partial<ArtifactListItem>): ArtifactListItem {
  return {
    artifactId: 'art',
    organizationId: 'org-demo',
    outputType: 'report',
    artifactFamily: 'document',
    deliveryState: 'ready',
    titleSnapshot: 'Plan transformacji operacyjnej',
    ownerUserId: 'user-1',
    canonicalHome: 'outputs_library',
    visibilityScope: 'organization',
    projectId: null,
    contextSnapshotId: null,
    executionRunId: null,
    templateFamilyRef: null,
    sourceInitiativeId: null,
    aiGovernancePresetRef: null,
    originSummary: { sourceType: 'document_studio' },
    isDraft: false,
    createdBy: 'user-1',
    createdAt: '2026-09-09T09:00:00.000Z',
    lastTransitionAt: '2026-09-09T09:00:00.000Z',
    originRuntime: 'document_studio' as never,
    originRecordId: 'rec',
    resolvedTitle: 'Plan transformacji operacyjnej',
    originTitle: 'Plan transformacji operacyjnej',
    originStatus: null,
    reportType: 'executive_memo',
    presentationMode: null,
    slideCount: null,
    exportFormat: 'docx',
    sourceRefs: [],
    publishState: 'approved',
    publishReviewers: [],
    reviewGateCount: 0,
    ownerName: 'Piotr Wiśniewski',
    duplicateCount: 1,
    duplicateArtifactIds: [],
    ...over,
  } as ArtifactListItem;
}

// Newest → oldest, dokładnie jak ORDER BY w zapytaniu listy.
const wejscie: ArtifactListItem[] = [
  dokument({
    artifactId: 'artifact-b4ad328c',
    originRecordId: 'b4ad328c-0000-4000-8000-000000000001',
    ownerName: 'Kasia Nowak',
    lastTransitionAt: '2026-09-10T08:30:00.000Z',
  }),
  dokument({
    artifactId: 'artifact-ab8dbf5c',
    originRecordId: 'ab8dbf5c-0000-4000-8000-000000000002',
    ownerName: 'Tomek Zieliński',
    lastTransitionAt: '2026-09-09T16:10:00.000Z',
  }),
];

const wynik = dedupeArtifacts(wejscie);

const wiersze = wynik.map((it) => ({
  kind: 'document' as const,
  originRecordId: it.originRecordId,
  artifactId: it.artifactId,
  title: it.resolvedTitle,
  statusKey: 'ready',
  owner: it.ownerName,
  updatedAt: it.lastTransitionAt,
  reportType: it.reportType,
  exportFormats: it.exportFormat ? [it.exportFormat] : [],
  fileFormat: 'DOCX',
  governance: {
    visibilityScope: it.visibilityScope,
    publishState: it.publishState,
    openPath: `/document-studio/${it.originRecordId}`,
    originSummary: it.originSummary,
  },
}));

const out = resolve(process.cwd(), 'dev-render/mocks/p15-dedup-rows.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({ wejscie: wejscie.length, poDedupie: wynik.length, wiersze }, null, 2),
  'utf-8'
);
console.log(`wejscie=${wejscie.length} poDedupie=${wynik.length} -> ${out}`);
