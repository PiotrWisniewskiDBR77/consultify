/**
 * IdeaPanelComments — zakładka „Komentarze" prawego panelu Idei.
 *
 * Kanon D1: docs/standards/idea-workspace/07_PRAWY_PANEL.md §7 — komentarze są
 * FIRST-CLASS (osobna zakładka), a nie szczegół we Właściwościach.
 *
 * SKĄD DANE (zero atrap, Z3 — każdy element ma realne źródło):
 *   1. `node.data.comments[]` — komentarze zapisane w blobie grafu; tak trzymają
 *      je Tablica (`IdeaWhiteboardTool`) i Przepływ (`IdeaProcessFlowTool`),
 *      stąd biorą liczniki pinezki (`CommentPinBadge`). Panel czyta TEN SAM
 *      blob, który już dostaje w `graphNodes` — bez dodatkowego zapytania.
 *   2. `GET /my-work/my-ideas/:id/map/nodes/:nodeId/comments`
 *      (`Api.getNodeComments`) — serwerowa tabela `idea_node_comments`, ten sam
 *      kanał, którego używa `NodeCommentThread` (Mapa myśli). Dopisanie idzie
 *      przez `Api.addNodeComment`, usunięcie przez `Api.deleteNodeComment`.
 *
 * CZEGO TU NIE MA (świadomie, żeby nie zmyślać):
 *   • Nie ma endpointu „komentarze całej Idei" — zakres „Cała Idea" składamy z
 *     blobu (punkt 1). Zakres „Zaznaczenie" dokłada wątek serwerowy (punkt 2).
 *   • Nie ma pola „rozwiązany/nierozwiązany" ani wątków odpowiedzi w schemacie,
 *     więc NIE rysujemy filtrów ani przycisków, które nie miałyby na czym
 *     działać (standard §7 wymienia je jako docelowe — patrz raport).
 *
 * Wygląd: wyłącznie tokeny `c-*` (light+dark), czerwień tylko dla akcji
 * niszczącej (usuń). Zero crimson (`primary-*`).
 */
import { Loader2, MessageSquare, Send, Sparkles, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

import type { IdeaWorkspaceSelection } from '../ideaSelectionTypes';

export interface IdeaPanelCommentsProps {
  ideaId: string;
  /** Idea jeszcze niezapisana → brak realnego id na serwerze, nie wołamy API. */
  isDraft: boolean;
  isPl: boolean;
  selection: IdeaWorkspaceSelection;
  graphNodes: any[];
}

interface PanelComment {
  id: string;
  nodeId: string;
  nodeLabel: string;
  author: string;
  text: string;
  createdAt?: string | number;
  /** `server` = tabela idea_node_comments (można usunąć), `blob` = graf. */
  source: 'server' | 'blob';
}

/** Autor-maszyna: Teresa/AI oznaczamy plakietką (standard §7). */
function czyAI(author: string): boolean {
  return /teresa|\bai\b|assistant|bot/i.test(author || '');
}

function czasWzgledny(value: string | number | undefined, pl: boolean): string {
  if (value === undefined || value === null) return '';
  const ts = typeof value === 'number' ? value : Date.parse(String(value));
  if (Number.isNaN(ts)) return String(value);
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return pl ? 'przed chwilą' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return pl ? `${m} min temu` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return pl ? `${h} godz. temu` : `${h}h ago`;
  return pl ? `${Math.floor(h / 24)} dn. temu` : `${Math.floor(h / 24)}d ago`;
}

function etykietaWezla(node: any, pl: boolean): string {
  return (
    node?.data?.label ||
    node?.data?.title ||
    node?.data?.text ||
    (pl ? '(bez etykiety)' : '(no label)')
  );
}

/** Komentarze zapisane w blobie grafu (Tablica / Przepływ). */
function zblobu(graphNodes: any[], pl: boolean, tylkoNode?: string | null): PanelComment[] {
  const out: PanelComment[] = [];
  for (const node of graphNodes ?? []) {
    if (tylkoNode && node?.id !== tylkoNode) continue;
    const arr = node?.data?.comments;
    if (!Array.isArray(arr)) continue;
    for (const c of arr) {
      if (!c) continue;
      out.push({
        id: String(c.id ?? `${node.id}-${out.length}`),
        nodeId: String(node.id),
        nodeLabel: etykietaWezla(node, pl),
        author: String(c.author ?? c.userName ?? (pl ? 'Nieznany' : 'Unknown')),
        text: String(c.text ?? ''),
        createdAt: c.createdAt ?? c.timestamp,
        source: 'blob',
      });
    }
  }
  return out;
}

const CARD =
  'rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 space-y-1.5';

export const IdeaPanelComments: React.FC<IdeaPanelCommentsProps> = ({
  ideaId,
  isDraft,
  isPl,
  selection,
  graphNodes,
}) => {
  const t = (pl: string, en: string) => (isPl ? pl : en);

  /**
   * Adresat komentarza = zaznaczony element. Bierzemy zaznaczenie węzła, a w
   * Tabeli także wiersza — ale WYŁĄCZNIE gdy taki element realnie istnieje w
   * grafie (cztery reprezentacje dzielą jeden graf idei). Bez tej weryfikacji
   * moglibyśmy zapisać komentarz pod identyfikatorem, którego nie ma.
   */
  const wybranyId = useMemo(() => {
    if (!selection || (selection.type !== 'node' && selection.type !== 'row')) return null;
    const id = selection.primaryId ? String(selection.primaryId) : null;
    if (!id) return null;
    return (graphNodes ?? []).some((n: any) => String(n?.id) === id) ? id : null;
  }, [selection, graphNodes]);

  // Zakres wg standardu §7 (Cała Idea · Zaznaczenie). „Widok" pominięty — panel
  // nie dostaje informacji o widocznym wycinku płótna, więc byłby to martwy
  // przełącznik.
  const [zakres, setZakres] = useState<'idea' | 'selection'>('idea');
  useEffect(() => {
    // Zaznaczenie elementu przełącza na jego wątek; odznaczenie wraca do Idei.
    setZakres(wybranyId ? 'selection' : 'idea');
  }, [wybranyId]);

  const [serwerowe, setSerwerowe] = useState<PanelComment[]>([]);
  const [ladowanie, setLadowanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [tresc, setTresc] = useState('');
  const [wysylka, setWysylka] = useState(false);

  const pobierz = useCallback(async () => {
    if (!wybranyId || !ideaId || isDraft) {
      setSerwerowe([]);
      return;
    }
    setLadowanie(true);
    setBlad(null);
    try {
      const res = await Api.getNodeComments(ideaId, wybranyId);
      const lista = Array.isArray(res?.comments) ? res.comments : [];
      const node = (graphNodes ?? []).find((n: any) => n?.id === wybranyId);
      setSerwerowe(
        lista.map((c: any) => ({
          id: String(c.id),
          nodeId: wybranyId,
          nodeLabel: etykietaWezla(node, isPl),
          author: String(c.author ?? ''),
          text: String(c.text ?? ''),
          createdAt: c.createdAt,
          source: 'server' as const,
        }))
      );
    } catch {
      // Kanał serwerowy niedostępny → zostają komentarze z blobu (bez atrapy).
      setSerwerowe([]);
      setBlad(t('Kanał serwerowy niedostępny', 'Server channel unavailable'));
    } finally {
      setLadowanie(false);
    }
  }, [ideaId, isDraft, wybranyId, graphNodes, isPl]);

  useEffect(() => {
    if (zakres === 'selection') void pobierz();
  }, [zakres, pobierz]);

  const zBlobuIdea = useMemo(() => zblobu(graphNodes, isPl), [graphNodes, isPl]);
  const zBlobuWezel = useMemo(
    () => (wybranyId ? zblobu(graphNodes, isPl, wybranyId) : []),
    [graphNodes, isPl, wybranyId]
  );

  const pozycje = useMemo(() => {
    const src = zakres === 'selection' ? [...serwerowe, ...zBlobuWezel] : zBlobuIdea;
    return [...src].sort((a, b) => {
      const ta = typeof a.createdAt === 'number' ? a.createdAt : Date.parse(String(a.createdAt));
      const tb = typeof b.createdAt === 'number' ? b.createdAt : Date.parse(String(b.createdAt));
      return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
    });
  }, [zakres, serwerowe, zBlobuWezel, zBlobuIdea]);

  const dodaj = useCallback(async () => {
    const txt = tresc.trim();
    if (!txt || !wybranyId || isDraft) return;
    setWysylka(true);
    try {
      await Api.addNodeComment(ideaId, wybranyId, txt);
      setTresc('');
      await pobierz();
    } catch {
      setBlad(t('Nie udało się dodać komentarza', 'Could not add the comment'));
    } finally {
      setWysylka(false);
    }
  }, [tresc, wybranyId, isDraft, ideaId, pobierz, isPl]);

  const usun = useCallback(
    async (c: PanelComment) => {
      if (c.source !== 'server') return;
      try {
        await Api.deleteNodeComment(ideaId, c.nodeId, c.id);
        await pobierz();
      } catch {
        setBlad(t('Nie udało się usunąć komentarza', 'Could not delete the comment'));
      }
    },
    [ideaId, pobierz, isPl]
  );

  const chip = (aktywny: boolean) =>
    `px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
      aktywny
        ? 'bg-c-focus/10 text-c-focus-solid'
        : 'text-c-text-secondary hover:bg-c-surface-raised'
    }`;

  return (
    <div className="space-y-3" data-testid="idea-panel-comments">
      {/* Przełącznik zakresu (§7) — „Zaznaczenie" tylko gdy jest co pokazać. */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setZakres('idea')}
          className={chip(zakres === 'idea')}
          data-testid="idea-panel-comments-scope-idea"
        >
          {t('Cała Idea', 'Whole idea')}
        </button>
        <button
          type="button"
          onClick={() => wybranyId && setZakres('selection')}
          disabled={!wybranyId}
          title={
            wybranyId
              ? undefined
              : t('Zaznacz element na płótnie', 'Select an element on the canvas')
          }
          className={`${chip(zakres === 'selection')} disabled:opacity-40 disabled:cursor-not-allowed`}
          data-testid="idea-panel-comments-scope-selection"
        >
          {t('Zaznaczenie', 'Selection')}
        </button>
        <span className="ml-auto text-[10px] tabular-nums text-c-text-muted">{pozycje.length}</span>
      </div>

      {isDraft && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[11px] text-c-text-secondary">
          {t(
            'Zapisz Ideę, aby komentować — wątki są przypięte do zapisanego elementu.',
            'Save the idea to comment — threads are attached to a saved element.'
          )}
        </div>
      )}

      {ladowanie && (
        <div className="flex items-center gap-2 text-[11px] text-c-text-muted">
          <Loader2 size={12} className="animate-spin" />
          {t('Wczytywanie…', 'Loading…')}
        </div>
      )}

      {blad && <div className="text-[10px] text-c-warning">{blad}</div>}

      {!ladowanie && pozycje.length === 0 && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center">
          <MessageSquare size={16} className="mx-auto mb-1.5 text-c-text-muted" />
          <div className="text-[11px] text-c-text-secondary">
            {zakres === 'selection'
              ? t('Brak komentarzy na tym elemencie.', 'No comments on this element.')
              : t('Brak komentarzy w tej Idei.', 'No comments in this idea yet.')}
          </div>
          {zakres === 'idea' && !wybranyId && (
            <div className="mt-1 text-[10px] text-c-text-muted">
              {t(
                'Komentarz prowadzimy na elemencie — zaznacz węzeł lub wiersz.',
                'Comments live on elements — select a node or a row.'
              )}
            </div>
          )}
        </div>
      )}

      {pozycje.length > 0 && (
        <div className="space-y-2">
          {pozycje.map((c) => (
            <div key={`${c.source}-${c.id}`} className={CARD}>
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    czyAI(c.author)
                      ? 'bg-c-info/15 text-c-info'
                      : 'bg-c-surface text-c-text-secondary'
                  }`}
                  aria-hidden="true"
                >
                  {czyAI(c.author) ? <Sparkles size={10} /> : (c.author || '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[11px] font-semibold text-c-text truncate">{c.author}</span>
                {czyAI(c.author) && (
                  <span className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wider bg-c-info/10 text-c-info">
                    AI
                  </span>
                )}
                <span className="ml-auto text-[10px] tabular-nums text-c-text-muted">
                  {czasWzgledny(c.createdAt, isPl)}
                </span>
                {c.source === 'server' && (
                  <button
                    type="button"
                    onClick={() => void usun(c)}
                    title={t('Usuń komentarz', 'Delete comment')}
                    className="text-c-text-muted hover:text-c-danger transition-colors"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <div className="text-[11px] leading-relaxed text-c-text-secondary whitespace-pre-wrap">
                {c.text}
              </div>
              {zakres === 'idea' && (
                <div className="text-[10px] text-c-text-muted truncate">↳ {c.nodeLabel}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dodawanie — tylko gdy jest realny adresat (element) i zapisana Idea. */}
      {wybranyId && !isDraft && (
        <div className="space-y-1.5">
          <textarea
            value={tresc}
            onChange={(e) => setTresc(e.target.value)}
            rows={2}
            placeholder={t('Dodaj komentarz…', 'Add a comment…')}
            className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-2 text-[11px] text-c-text placeholder:text-c-text-muted resize-none focus:outline-none focus:border-c-focus"
            data-testid="idea-panel-comments-input"
          />
          <button
            type="button"
            onClick={() => void dodaj()}
            disabled={!tresc.trim() || wysylka}
            className="inline-flex items-center gap-1.5 rounded-lg bg-c-text px-2.5 py-1.5 text-[10px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
            data-testid="idea-panel-comments-submit"
          >
            {wysylka ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            {t('Dodaj komentarz', 'Add comment')}
          </button>
        </div>
      )}
    </div>
  );
};

export default IdeaPanelComments;
