/**
 * @vitest-environment jsdom
 *
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q2 wołacz 1) — `InitiativeCompactPanel`
 * (Inicjatywy → panel boczny → zakładka Outputs).
 *
 * Zlecenie nazywa ten wołacz wprost: `InitiativeCompactPanel.tsx:816-828`,
 * „TYLKO wołacz" — czyli przy fladze `VITE_DOC0_DOCUMENT_VIEWER` ON klik w
 * wiersz DOKUMENTU jedzie na samodzielny ekran `/documents/:artifactId`, a
 * OFF i każdy inny rodzaj wiersza zostaje przy dzisiejszej trasie generatora.
 *
 * Mierzony jest REALNY komponent produktu (nie lustro `onOpen`) i ARGUMENT
 * `navigate(...)` — dokładnie to, co decyduje, gdzie wyląduje użytkownik.
 *
 * MUTACJE (przywróć stary cel → RED):
 *  (a) `viewerPath ?? (…getArtifactPath…)` → samo `getArtifactPath(…)` w `onOpen`
 *      → test ON CZERWONY;
 *  (b) usunięcie warunku `row.kind === 'document'` → test „prezentacja/arkusz
 *      zostają przy swojej trasie" CZERWONY;
 *  (c) usunięcie `isDocumentViewerEnabled()` w `resolveDocumentViewerPath`
 *      → test OFF CZERWONY (helper jest wspólny, patrz
 *      `artifactNavigation.doc0Viewer.test.ts`).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const navigateSpy = vi.hoisted(() => vi.fn());
const onCloseSpy = vi.hoisted(() => vi.fn());
const rowsMock = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateSpy }));

vi.mock('@/components/ReportsAndPresentations/useRapData', () => ({
  useArtifactOutputsForInitiative: () => ({
    rows: rowsMock.current,
    loading: false,
    error: null,
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(() => Promise.resolve([])),
    getInitiativeById: vi.fn(() => Promise.resolve({ id: 'ini-1', name: 'Pilot initiative' })),
  },
}));

import { getArtifactPath } from '@/utils/artifactLinks';
import { DOCUMENT_VIEWER_FLAG_KEYS } from '@/components/documents/documentViewerFlag';

import { InitiativeCompactPanel } from '../InitiativeCompactPanel';

const LS_KEY = DOCUMENT_VIEWER_FLAG_KEYS.localStorage;
const ARTIFACT_ID = 'art-doc0-1';
const ORIGIN_RECORD_ID = 'rpt-doc0-1';
const TITLE = 'Annual operations review';

function outputRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'document' as const,
    originRecordId: ORIGIN_RECORD_ID,
    artifactId: ARTIFACT_ID,
    title: TITLE,
    statusKey: 'ready',
    governance: null,
    ...overrides,
  };
}

function renderPanel(rows: any[]) {
  rowsMock.current = rows;
  return render(
    <InitiativeCompactPanel
      initiative={{ id: 'ini-1', name: 'Pilot initiative' } as any}
      isOpen
      onClose={onCloseSpy}
      mode="embedded"
    />
  );
}

/** Zakładka Outputs → klik w wiersz (jeden przycisk na wiersz, cały wiersz klika się). */
async function clickRow() {
  const tab = await waitFor(() => {
    const found = screen
      .getAllByRole('button')
      .find((button) => /outputs/i.test(button.textContent || ''));
    expect(found).toBeTruthy();
    return found as HTMLElement;
  });
  fireEvent.click(tab);
  const row = await waitFor(() => {
    const found = screen
      .getAllByRole('button')
      .find((button) => (button.textContent || '').includes(TITLE));
    expect(found).toBeTruthy();
    return found as HTMLElement;
  });
  fireEvent.click(row);
}

beforeEach(() => {
  vi.clearAllMocks();
  rowsMock.current = [];
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('InitiativeCompactPanel Outputs — flaga ON (DEC-593)', () => {
  beforeEach(() => {
    window.localStorage.setItem(LS_KEY, '1');
  });

  it('dokument → samodzielny ekran `/documents/:artifactId` (ten sam id co w wierszu)', async () => {
    renderPanel([outputRow()]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(`/documents/${ARTIFACT_ID}`);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('prezentacja i arkusz → dzisiejsze trasy generatorów (viewer tylko dla dokumentów)', async () => {
    renderPanel([
      outputRow({
        kind: 'presentation',
        artifactId: 'art-deck-1',
        originRecordId: 'deck-1',
        title: TITLE,
      }),
    ]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('presentation', 'deck-1'));
  });

  it('arkusz → trasa arkusza', async () => {
    renderPanel([
      outputRow({ kind: 'sheet', artifactId: 'art-sheet-1', originRecordId: 'sheet-1', title: TITLE }),
    ]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('sheet', 'sheet-1'));
  });

  it('dokument bez `artifactId` rejestru → dzisiejsza trasa (nie ma czego otworzyć)', async () => {
    renderPanel([outputRow({ artifactId: undefined })]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', ORIGIN_RECORD_ID));
  });
});

describe('InitiativeCompactPanel Outputs — flaga OFF (parytet z linią bajt w bajt)', () => {
  it('dokument przy OFF → DOKŁADNIE dzisiejsza trasa Report Buildera', async () => {
    window.localStorage.setItem(LS_KEY, '0');
    renderPanel([outputRow()]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', ORIGIN_RECORD_ID));
  });

  it('brak jakiejkolwiek flagi (fail-closed) → dzisiejsza trasa', async () => {
    renderPanel([outputRow()]);
    await clickRow();
    expect(navigateSpy).toHaveBeenCalledWith(getArtifactPath('report', ORIGIN_RECORD_ID));
  });
});
