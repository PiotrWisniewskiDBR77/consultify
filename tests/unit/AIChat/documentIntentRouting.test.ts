/**
 * 1.1-A (06.09) — BRAMKA RUTOWANIA I ZAKAZU CICHEGO ZAPISU.
 * [ODMROZENIE 13_CHAT DEC-397]
 *
 * Zabezpieczenie, którego broni ten plik (ZASADY_AI_TERESA_SSOT §3 „Zakaz
 * auto-apply", S4 „odrzucenie = zero zmian"):
 *   1. prośba o treść „w oknie obok" jest ROZPOZNANA jako praca na
 *      dokumencie i NIE trafia na ścieżkę tworzenia obiektu w innym module;
 *   2. propozycja treści NIE zapisuje nic do dokumentu, dopóki człowiek nie
 *      kliknie — kliknięcie jest JEDYNYM źródłem zdarzenia zapisu.
 *
 * Dowód mutacyjny (każdy z tych ruchów MUSI dać czerwień — sprawdzone ręcznie
 * przy pisaniu testu, opis w komentarzach przy asercjach):
 *   • usunięcie `isDocumentProduceRequest` z `detectCanvasWriteIntent`
 *     → test „rozpoznaje prośbę właściciela" pada (null zamiast 'append');
 *   • wywołanie `apply()` w `TeresaDocumentProposalCard` przy montowaniu
 *     karty (auto-approve) → test „nic nie leci do dokumentu bez kliknięcia"
 *     pada, bo zdarzenie pojawia się bez `click`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectCanvasWriteIntent } from '@/components/AIChat/canvasStreamIntentDetector';
import {
  CANVAS_DOCUMENT_APPLY_EVENT,
  type CanvasDocumentApplyDetail,
  type CanvasDocumentProposal,
  buildDocumentProposalMessage,
  requestDocumentProposal,
  stripMarkdownFence,
} from '@/components/AIChat/canvasDocumentProposal';
import { TeresaDocumentProposalCard } from '@/components/AIChat/TeresaDocumentProposalCard';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const PROSBA_WLASCICIELA = 'Zrob mi plan w okni obok';

describe('1.1-A — rutowanie intencji „napisz w dokumencie obok"', () => {
  it('rozpoznaje prośbę właściciela jako pracę na dokumencie', () => {
    // MUTACJA: skasuj gałąź `isDocumentProduceRequest` → tu wraca null,
    // a wiadomość leci na backend, gdzie regex trafia w „plan" i produkuje
    // propozycję `Initiatives · create` (dokładnie zgłoszony defekt).
    expect(detectCanvasWriteIntent(PROSBA_WLASCICIELA)).toBe('append');
  });

  it('nie rozpoznaje pytania o plan jako polecenia pisania', () => {
    expect(detectCanvasWriteIntent('jaki mamy plan na jutro?')).toBeNull();
  });

  it('prośba o INICJATYWĘ nie jest przechwytywana jako praca na dokumencie', () => {
    // Kontrapunkt: gdy człowiek naprawdę chce inicjatywy, detektor musi
    // przepuścić wiadomość do Teresy (ścieżka propozycji z „Zatwierdź").
    expect(detectCanvasWriteIntent('załóż inicjatywę z tego planu')).toBeNull();
    expect(detectCanvasWriteIntent('zrób inicjatywę z tego planu')).toBeNull();
  });
});

describe('1.1-A — wytworzenie propozycji nic nie zapisuje', () => {
  it('woła wyłącznie /api/ai/generate i nie dotyka żadnej trasy zapisu', async () => {
    const wolania: string[] = [];
    const fetchImpl = vi.fn(async (url: any) => {
      wolania.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ text: '## Plan\n\n- krok pierwszy' }),
      } as any;
    });

    const proposal = await requestDocumentProposal({
      request: PROSBA_WLASCICIELA,
      documentMarkdown: '# Notatka robocza',
      documentTitle: 'Notatka robocza',
      language: 'pl',
      fetchImpl: fetchImpl as any,
      token: 'tok',
    });

    expect(wolania).toEqual(['/api/ai/generate']);
    expect(proposal?.state).toBe('pending');
    expect(proposal?.markdown).toContain('## Plan');
  });

  it('zdejmuje opakowanie ```markdown, żeby podgląd był treścią, nie kodem', () => {
    expect(stripMarkdownFence('```markdown\n# Tytuł\n```')).toBe('# Tytuł');
    expect(stripMarkdownFence('# Tytuł')).toBe('# Tytuł');
  });

  it('prompt niesie prośbę i aktualny dokument (rodowód dla modelu)', () => {
    const message = buildDocumentProposalMessage({
      request: PROSBA_WLASCICIELA,
      documentMarkdown: '# Notatka robocza\n\n## Kontekst',
    });
    expect(message).toContain(PROSBA_WLASCICIELA);
    expect(message).toContain('## Kontekst');
  });
});

describe('1.1-A — karta propozycji: zapis TYLKO z kliknięcia człowieka', () => {
  const proposal: CanvasDocumentProposal = {
    proposalId: 'p1',
    request: PROSBA_WLASCICIELA,
    markdown: '## Plan\n\n- krok pierwszy',
    documentTitle: 'Notatka robocza',
    hasSelection: false,
    state: 'pending',
  };

  let zdarzenia: CanvasDocumentApplyDetail[] = [];
  const listener = (event: Event) => {
    zdarzenia.push((event as CustomEvent).detail as CanvasDocumentApplyDetail);
  };

  beforeEach(() => {
    zdarzenia = [];
    window.addEventListener(CANVAS_DOCUMENT_APPLY_EVENT, listener);
  });
  afterEach(() => {
    window.removeEventListener(CANVAS_DOCUMENT_APPLY_EVENT, listener);
  });

  it('po samym wyrenderowaniu karty NIC nie leci do dokumentu', () => {
    render(React.createElement(TeresaDocumentProposalCard, { proposal }));
    // MUTACJA: dodaj `useEffect(() => apply('append'), [])` w karcie
    // (auto-approve) → ta asercja pada.
    expect(zdarzenia).toHaveLength(0);
    expect(screen.getByTestId('teresa-document-proposal-badge').textContent).toBe(
      'Do zatwierdzenia'
    );
  });

  it('podgląd treści jest widoczny PRZED zatwierdzeniem', () => {
    render(React.createElement(TeresaDocumentProposalCard, { proposal }));
    expect(screen.getByTestId('teresa-document-proposal-preview').textContent).toContain(
      'krok pierwszy'
    );
  });

  it('dopiero „Wstaw do dokumentu" emituje zdarzenie zapisu — dokładnie raz', () => {
    render(React.createElement(TeresaDocumentProposalCard, { proposal }));
    fireEvent.click(screen.getByTestId('teresa-document-proposal-insert'));
    expect(zdarzenia).toHaveLength(1);
    expect(zdarzenia[0].markdown).toContain('krok pierwszy');
    expect(zdarzenia[0].mode).toBe('append');
  });

  it('„Odrzuć" = zero zmian (SSOT §5 S4)', () => {
    render(React.createElement(TeresaDocumentProposalCard, { proposal }));
    fireEvent.click(screen.getByTestId('teresa-document-proposal-reject'));
    expect(zdarzenia).toHaveLength(0);
    expect(screen.getByTestId('teresa-document-proposal').getAttribute('data-proposal-state')).toBe(
      'rejected'
    );
  });
});
