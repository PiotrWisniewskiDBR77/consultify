/**
 * @vitest-environment jsdom
 *
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q2 wołacz 3) — `RezultatyView.tsx`
 * (Zlecenia → Rezultaty). Trzy klasyfikatory otwarcia (`rozstrzygnijOtwarcie`
 * :254, `otwarcieZOdpowiedziBackendu` :349 przez `useOtwarciaZBackendu`,
 * `rozstrzygnijOtwarcieDowodu` :528) liczą trasę dokumentu. Nagłówek pliku
 * sam zakazuje rozjazdu („gdyby każde z tych trzech miejsc liczyło trasę
 * osobno, rozjazd byłby kwestią czasu"), dlatego wszystkie trzy idą przez
 * JEDNO `sciezkaWidokaDokumentu` — a tu wszystkie trzy są zmierzone.
 *
 * Asertowane są REALNE funkcje produktu (eksportowane, używane przez
 * `CaseDetailScreen` i tabelę Rezultatów), nie ich lustro, i asertowany jest
 * CEL nawigacji — dokładnie to, co pod klawisz „Otwórz" wstawia powłoka.
 *
 * Parytet OFF: flaga `VITE_DOC0_DOCUMENT_VIEWER` OFF / brak flagi / wiersz bez
 * `artifactId` rejestru / obiekt inny niż dokument → DOKŁADNIE
 * `getArtifactPath(typ, id)`, czyli dzisiejsza trasa bajt w bajt.
 *
 * MUTACJE (przywróć stary cel → RED): w każdym z trzech miejsc
 * `sciezkaWidokaDokumentu(typ, X) ?? getArtifactPath(typ, X)` → samo
 * `getArtifactPath(typ, X)` gasi odpowiedni test ON; usunięcie warunku flagi
 * w `resolveDocumentViewerPath` gasi wszystkie testy OFF.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolveOpen = vi.hoisted(() => vi.fn());

vi.mock('../api', () => ({
  resolveArtifactLinkOpen: resolveOpen,
  linkArtifactToCase: vi.fn(),
  newIdempotencyKey: vi.fn(() => 'idem-1'),
  pinArtifactRevision: vi.fn(),
  unlinkArtifactFromCase: vi.fn(),
}));

import { getArtifactPath } from '@/utils/artifactLinks';

import { DOCUMENT_VIEWER_FLAG_KEYS } from '@/components/documents/documentViewerFlag';
import {
  invalidujOtwarcieBackendu,
  rozstrzygnijOtwarcie,
  rozstrzygnijOtwarcieDowodu,
  useOtwarciaZBackendu,
} from '../RezultatyView';
import type { ArtifactLinkOpenResolution, CaseArtifactLink } from '../types';

const LS_KEY = DOCUMENT_VIEWER_FLAG_KEYS.localStorage;
const LINK_ID = 'cwlink-doc-1';
const ARTIFACT_ID = 'art-doc0-9';

function dokumentLink(overrides: Partial<CaseArtifactLink> = {}): CaseArtifactLink {
  return {
    linkId: LINK_ID,
    caseId: 'case-1',
    artifactType: 'document',
    artifactId: ARTIFACT_ID,
    artifactRevision: null,
    relation: 'DELIVERABLE',
    linkStatus: 'ACTIVE',
    isStale: false,
    staleReason: null,
    linkedAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  } as CaseArtifactLink;
}

function backendResolution(overrides: Partial<ArtifactLinkOpenResolution> = {}) {
  return {
    linkId: LINK_ID,
    caseId: 'case-1',
    relation: 'DELIVERABLE',
    state: 'AVAILABLE',
    deepLink: { artifactType: 'document', artifactId: ARTIFACT_ID },
    isStale: false,
    staleReason: null,
    staleMarkedAt: null,
    unavailableReason: null,
    unavailableMarkedAt: null,
    unlinkReason: null,
    unlinkedAt: null,
    returnContext: { caseId: 'case-1' },
    resolvedAt: '2026-09-18T10:00:00.000Z',
    ...overrides,
  } as unknown as ArtifactLinkOpenResolution;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  invalidujOtwarcieBackendu(LINK_ID);
});

afterEach(() => {
  window.localStorage.clear();
  invalidujOtwarcieBackendu(LINK_ID);
});

describe('rozstrzygnijOtwarcie (klasyfikacja z linku) — flaga ON', () => {
  beforeEach(() => {
    window.localStorage.setItem(LS_KEY, '1');
  });

  it('dokument → samodzielny ekran `/documents/:artifactId`', () => {
    const wynik = rozstrzygnijOtwarcie(dokumentLink());
    expect(wynik.status).toBe('otwieralny');
    expect(wynik).toMatchObject({ status: 'otwieralny', sciezka: `/documents/${ARTIFACT_ID}` });
  });

  it('warianty typu (`report`, `wordy`) też → viewer (jedna mapa modułów)', () => {
    for (const artifactType of ['report', 'wordy', 'DOCUMENT']) {
      expect(
        rozstrzygnijOtwarcie(dokumentLink({ artifactType, linkId: `l-${artifactType}` }))
      ).toMatchObject({ sciezka: `/documents/${ARTIFACT_ID}` });
    }
  });

  it('obiekt inny niż dokument → dzisiejsza trasa (viewer tylko dla dokumentów)', () => {
    expect(
      rozstrzygnijOtwarcie(dokumentLink({ artifactType: 'presentation', artifactId: 'deck-1' }))
    ).toMatchObject({ sciezka: getArtifactPath('presentation', 'deck-1') });
    expect(
      rozstrzygnijOtwarcie(dokumentLink({ artifactType: 'decision', artifactId: 'dec-1' }))
    ).toMatchObject({ sciezka: getArtifactPath('decision', 'dec-1') });
  });

  it('dokument bez `artifactId` → `getArtifactPath` (nie ma czego otworzyć w viewerze)', () => {
    expect(rozstrzygnijOtwarcie(dokumentLink({ artifactId: '' }))).toMatchObject({
      sciezka: getArtifactPath('report', ''),
    });
  });

  it('stan powiązania wygrywa nad trasą: UNAVAILABLE/UNLINKED nadal uczciwie zamknięte', () => {
    expect(rozstrzygnijOtwarcie(dokumentLink({ linkStatus: 'UNAVAILABLE' })).status).toBe(
      'niedostepny'
    );
    expect(rozstrzygnijOtwarcie(dokumentLink({ linkStatus: 'UNLINKED' })).status).toBe('odpiety');
  });
});

describe('rozstrzygnijOtwarcie — flaga OFF (parytet z linią bajt w bajt)', () => {
  it('dokument przy OFF → DOKŁADNIE dzisiejsza trasa Report Buildera', () => {
    window.localStorage.setItem(LS_KEY, '0');
    expect(rozstrzygnijOtwarcie(dokumentLink())).toMatchObject({
      status: 'otwieralny',
      sciezka: getArtifactPath('report', ARTIFACT_ID),
    });
  });

  it('brak jakiejkolwiek flagi (fail-closed) → dzisiejsza trasa', () => {
    expect(rozstrzygnijOtwarcie(dokumentLink())).toMatchObject({
      sciezka: getArtifactPath('report', ARTIFACT_ID),
    });
  });
});

describe('otwarcieZOdpowiedziBackendu (przez useOtwarciaZBackendu)', () => {
  it('AVAILABLE z deepLinkiem dokumentu → `/documents/:artifactId` przy ON', async () => {
    window.localStorage.setItem(LS_KEY, '1');
    resolveOpen.mockResolvedValue(backendResolution());
    const { result } = renderHook(() => useOtwarciaZBackendu([dokumentLink()]));
    await waitFor(() => expect(result.current[LINK_ID]).toBeTruthy());
    expect(result.current[LINK_ID]).toMatchObject({
      status: 'otwieralny',
      sciezka: `/documents/${ARTIFACT_ID}`,
    });
  });

  it('STALE → nadal otwieralne, ale z ostrzeżeniem i tą samą trasą viewera', async () => {
    window.localStorage.setItem(LS_KEY, '1');
    resolveOpen.mockResolvedValue(
      backendResolution({ state: 'STALE', isStale: true, staleReason: 'rewizja starsza' })
    );
    const { result } = renderHook(() => useOtwarciaZBackendu([dokumentLink()]));
    await waitFor(() => expect(result.current[LINK_ID]?.status).toBe('otwieralny'));
    expect(result.current[LINK_ID]).toMatchObject({
      sciezka: `/documents/${ARTIFACT_ID}`,
    });
    expect(result.current[LINK_ID].ostrzezenie).toBeTruthy();
  });

  it('przy OFF → dzisiejsza trasa (backend nie zmienia celu, tylko stan)', async () => {
    window.localStorage.setItem(LS_KEY, '0');
    resolveOpen.mockResolvedValue(backendResolution());
    const { result } = renderHook(() => useOtwarciaZBackendu([dokumentLink()]));
    await waitFor(() => expect(result.current[LINK_ID]).toBeTruthy());
    expect(result.current[LINK_ID]).toMatchObject({
      sciezka: getArtifactPath('report', ARTIFACT_ID),
    });
  });

  it('UNAVAILABLE/DELETED → uczciwy powód, zero trasy', async () => {
    window.localStorage.setItem(LS_KEY, '1');
    resolveOpen.mockResolvedValue(backendResolution({ state: 'UNAVAILABLE' }));
    const { result } = renderHook(() => useOtwarciaZBackendu([dokumentLink()]));
    await waitFor(() => expect(result.current[LINK_ID]?.status).toBe('niedostepny'));
    expect('sciezka' in result.current[LINK_ID]).toBe(false);
  });
});

describe('rozstrzygnijOtwarcieDowodu (evidence_ref „typ:id")', () => {
  it('dowód `document:art-…` → `/documents/:artifactId` przy ON', () => {
    window.localStorage.setItem(LS_KEY, '1');
    expect(rozstrzygnijOtwarcieDowodu(`document:${ARTIFACT_ID}`)).toMatchObject({
      status: 'otwieralny',
      sciezka: `/documents/${ARTIFACT_ID}`,
    });
  });

  it('ten sam dowód przy OFF → dzisiejsza trasa', () => {
    window.localStorage.setItem(LS_KEY, '0');
    expect(rozstrzygnijOtwarcieDowodu(`document:${ARTIFACT_ID}`)).toMatchObject({
      sciezka: getArtifactPath('report', ARTIFACT_ID),
    });
  });

  it('dowód innego typu i dowód-opis → bez zmian względem linii', () => {
    window.localStorage.setItem(LS_KEY, '1');
    expect(rozstrzygnijOtwarcieDowodu('decision:dec-1')).toMatchObject({
      sciezka: getArtifactPath('decision', 'dec-1'),
    });
    expect(rozstrzygnijOtwarcieDowodu('Załącznik PDF od klienta')?.status).toBe('nieznany-typ');
    expect(rozstrzygnijOtwarcieDowodu('')).toBeNull();
  });
});
