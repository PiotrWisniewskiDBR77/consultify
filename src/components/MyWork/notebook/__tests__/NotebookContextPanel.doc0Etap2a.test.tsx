/**
 * @vitest-environment jsdom
 *
 * DOC-0 etap 2a (DEC-593, Wpis 106 pkt Q2 wołacz 2) — `NotebookContextPanel`
 * (My Work → Notatnik → panel kontekstu, sekcja „Linked outputs").
 *
 * Panel NIE nawiguje sam: dispatchuje `mywork-open-item`, a cel liczy
 * `MyWorkHub.tsx` (~5,2 tys. linii; sześć sióstrzanych plików
 * `MyWorkHub.*.contract.test.ts` w tym repo pilnuje go kontraktem źródła, bo
 * nikt go w teście nie montował). Żeby trasa `/documents/:artifactId` była w
 * ogóle osiągalna z notatnika, zdarzenie musiało dostać `artifactId` rejestru —
 * `id` w detailu to `originRecordId`, którym viewera nie da się otworzyć.
 *
 * Tu mierzony jest REALNY komponent i ARGUMENT, który wysyła: klik „Open" na
 * wierszu dokumentu → `detail.artifactId` = id rejestru, a stare pola
 * (`type`, `id`, `name`) zostają nietknięte, więc każdy dotychczasowy słuchacz
 * widzi dokładnie to, co widział (addytywność payloadu).
 *
 * MUTACJE: (a) usunięcie czwartego argumentu `row.artifactId` w `openItem(...)`
 * → test „niesie artifactId" CZERWONY; (b) zamiana `row.originRecordId` na
 * `row.artifactId` w tym wywołaniu (stare pole podmienione zamiast dodane) →
 * test addytywności CZERWONY.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rowsMock = vi.hoisted(() => ({ current: [] as any[] }));

vi.mock('@/components/ReportsAndPresentations/useRapData', () => ({
  useArtifactOutputsForInitiatives: () => ({ rows: [], loading: false, error: null }),
  useArtifactOutputsForOrigins: () => ({ rows: rowsMock.current, loading: false, error: null }),
  useAssessmentOutputsForOrigins: () => ({ rows: [], loading: false, error: null }),
}));

vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

const apiMock = vi.hoisted(() => ({
  get: vi.fn(() => Promise.resolve([])),
  getLinkGraphBacklinks: vi.fn().mockResolvedValue([]),
  notebookResolveEmbedChips: vi.fn().mockResolvedValue({ chips: [] }),
  suggestMyIdeas: vi.fn().mockResolvedValue([]),
  getMyIdeas: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/services/api', () => ({ Api: apiMock, default: apiMock }));

import { NotebookContextPanel } from '../NotebookContextPanel';

const ARTIFACT_ID = 'art-doc0-9';
const ORIGIN_RECORD_ID = 'rpt-doc0-9';
const TITLE = 'Quarterly review pack';

function documentRow(overrides: Record<string, unknown> = {}) {
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
    <NotebookContextPanel
      open
      onClose={vi.fn()}
      editor={null}
      noteId="note-1"
      noteTitle="Export cutover"
      noteTags={[]}
      allNotes={[]}
      noteConvertedTo={[{ type: 'report_builder_report', id: ORIGIN_RECORD_ID }]}
    />
  );
}

/** The row's own „Open" button — the only button in the panel labelled `open`. */
async function clickRowOpen() {
  await waitFor(() => expect(screen.getByText(TITLE)).toBeInTheDocument());
  const open = screen
    .getAllByRole('button')
    .find((button) => /open/i.test(button.textContent || ''));
  expect(open).toBeTruthy();
  fireEvent.click(open as HTMLElement);
}

function captureOpenItemEvents() {
  const received: any[] = [];
  const listener = (event: Event) => received.push((event as CustomEvent).detail);
  window.addEventListener('mywork-open-item', listener);
  return { received, stop: () => window.removeEventListener('mywork-open-item', listener) };
}

beforeEach(() => {
  vi.clearAllMocks();
  rowsMock.current = [];
});

describe('NotebookContextPanel — payload `mywork-open-item` (DOC-0 etap 2a)', () => {
  it('dokument: klik „Open" niesie `artifactId` rejestru obok dotychczasowych pól', async () => {
    const { received, stop } = captureOpenItemEvents();
    renderPanel([documentRow()]);
    await clickRowOpen();
    stop();

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      type: 'report',
      id: ORIGIN_RECORD_ID,
      name: TITLE,
      artifactId: ARTIFACT_ID,
    });
  });

  it('addytywnie: stare pola (`type`, `id`, `name`) zostają DOKŁADNIE takie jak przed etapem 2a', async () => {
    const { received, stop } = captureOpenItemEvents();
    renderPanel([documentRow()]);
    await clickRowOpen();
    stop();

    // `id` to nadal originRecordId — podmiana go na artifactId złamałaby
    // każdego słuchacza, który otwiera obiekt starą trasą (flaga OFF).
    expect(received[0].id).toBe(ORIGIN_RECORD_ID);
    expect(received[0].type).toBe('report');
    expect(received[0].name).toBe(TITLE);
  });

  it('wiersz bez `artifactId` rejestru → pole puste, zdarzenie nadal wysłane', async () => {
    const { received, stop } = captureOpenItemEvents();
    renderPanel([documentRow({ artifactId: undefined })]);
    await clickRowOpen();
    stop();

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(ORIGIN_RECORD_ID);
    expect(received[0].artifactId).toBeUndefined();
  });

  it('prezentacja i arkusz: `artifactId` jedzie dalej, typ zostaje swój (viewer tylko dla dokumentów)', async () => {
    const { received, stop } = captureOpenItemEvents();
    renderPanel([
      documentRow({
        kind: 'presentation',
        artifactId: 'art-deck-1',
        originRecordId: 'deck-1',
        title: TITLE,
      }),
    ]);
    await clickRowOpen();
    stop();

    expect(received[0]).toMatchObject({
      type: 'presentation',
      id: 'deck-1',
      artifactId: 'art-deck-1',
    });
  });
});
