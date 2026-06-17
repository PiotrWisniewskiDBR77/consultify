import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

// GAP M01 L-09 (chat-as-controller, Tryb B) — regression lock.
//
// Deterministyczny handoff czat→panel: kiedy generacja deliverable kończy się,
// czat (UnifiedChatPanel:525) emituje
//   window.dispatchEvent(new CustomEvent('deliverables:draft-ready', { detail: { draftId } }))
// Wrapper WorkCanvasDocumentPanel (WorkCanvasDocumentPanel.tsx:711-720) łapie ten
// event i robi setMountOverride({ kind: 'doc', draftId }). Ponieważ render bez
// props.initialDraftId nie odpala bezpiecznika N-5 (overrideIsStaleForNewDraft),
// effectiveOverride wygrywa (:740-747) i panel montuje keyed
// `WorkCanvasMarkdownDocumentPanel` z key=`switched-doc-<draftId>` oraz
// initialDraftId=<draftId> (:761-768). Świeży panel hydratuje draft po id
// (GET /api/work-canvas/drafts/<draftId>, :940-960) i pokazuje jego tytuł
// zamiast pustego szablonu „Company Work Note".
//
// Istniejący test ('mounts the backing draft ... when initialDraftId is set')
// pokrywa WYŁĄCZNIE ścieżkę props-driven. Ten plik blokuje ścieżkę
// EVENT-driven (faktyczny handoff czatu), której dotąd nic nie testowało.
describe('WorkCanvasDocumentPanel — deliverables:draft-ready handoff mount', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    // Rich TipTap editor jest domyślny; pinujemy tryb 'document' jak w głównym
    // pliku testów, żeby query'ować dokumentowy UI (title input).
    window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('switches to mount the event draft (keyed doc panel), not the base template', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      // Keyed markdown panel hydratuje draft po id po przełączeniu mountu.
      if (String(url).includes('/api/work-canvas/drafts/draft-handoff-09')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              draft: {
                id: 'draft-handoff-09',
                draftId: 'draft-handoff-09',
                title: 'Notatka z handoffu czatu',
                contentMd: '# Notatka z handoffu czatu\n\n- [ ] Pozycja z czatu',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        } as unknown as Response;
      }
      // Wersje / dowolny poboczny fetch — utrzymaj render stabilny.
      return { ok: true, json: async () => ({ success: true, data: [] }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    // Render bez initialDraftId → mount startuje na szablonie „base".
    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    // Panel startuje na pustym szablonie „Company Work Note".
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Company Work Note')
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/work-canvas/drafts/draft-handoff-09'),
      expect.anything()
    );

    // Czat kończy generację → emituje deterministyczny handoff event.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('deliverables:draft-ready', {
          detail: { draftId: 'draft-handoff-09' },
        })
      );
    });

    // Panel przełącza się na keyed mount draftu z eventu i hydratuje go po id —
    // tytuł to draft z handoffu, NIE szablon „Company Work Note".
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Notatka z handoffu czatu')
    );
    expect(screen.getByLabelText('Canvas document title')).not.toHaveValue('Company Work Note');
    // Mount draftu nastąpił deterministycznie przez GET po id z eventu.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/work-canvas/drafts/draft-handoff-09'),
      expect.anything()
    );
  });

  it('lets a NEW draftId via props win over a stale event override (N-5 guard)', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/work-canvas/drafts/draft-new-via-props')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              draft: {
                id: 'draft-new-via-props',
                draftId: 'draft-new-via-props',
                title: 'Nowy draft z propsów',
                contentMd: '# Nowy draft z propsów',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        } as unknown as Response;
      }
      if (String(url).includes('/api/work-canvas/drafts/draft-stale-event')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              draft: {
                id: 'draft-stale-event',
                draftId: 'draft-stale-event',
                title: 'Stary draft z eventu',
                contentMd: '# Stary draft z eventu',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    // Panel jest już podparty draftem przez propsy (initialDraftId).
    const { rerender } = render(
      <WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-new-via-props" />
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Nowy draft z propsów')
    );

    // Spóźniony event wskazuje na INNY (stary) draft — override jest stale,
    // bo props.initialDraftId !== event.draftId → bezpiecznik N-5 go odrzuca
    // (overrideIsStaleForNewDraft → effectiveOverride=null), więc props wygrywa.
    act(() => {
      window.dispatchEvent(
        new CustomEvent('deliverables:draft-ready', {
          detail: { draftId: 'draft-stale-event' },
        })
      );
    });

    // Tytuł nadal pochodzi z draftu z propsów — stary event NIE przejął mountu.
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Nowy draft z propsów')
    );
    expect(screen.getByLabelText('Canvas document title')).not.toHaveValue('Stary draft z eventu');

    // Sanity: gdy propsy zmieniają się na ten sam draftId co event, reset(:704)
    // czyści override i panel wciąż montuje aktualny prop draft (props-driven).
    rerender(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-new-via-props" />);
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Nowy draft z propsów')
    );
  });
});
