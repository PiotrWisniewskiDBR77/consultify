/**
 * IdeaPanelActivity — sekcja „Aktywność" układu SZEŚCIU sekcji
 * (`ideaPanel6SectionsFlag.ts`, default OFF).
 *
 * SCALENIE, KTÓRE ROBI: dziś Komentarze i Historia to DWIE osobne zakładki
 * prawego panelu, a w panelu szczegółów wiersza Tabeli są jeszcze raz jako
 * „Comments" i „Activity" — cztery miejsca, dwie osie czasu, jedna nazwa
 * znacząca dwie różne rzeczy. Tutaj jest JEDNA oś czasu z chipami filtra:
 *
 *     Wszystko · Komentarze · Zmiany · AI
 *
 * ŹRÓDŁA DANYCH — bez trzeciego magazynu, wyłącznie istniejące odczyty:
 *   • komentarze → `pobierzKomentarzeSerwerowe` + `zblobu` (IdeaPanelComments),
 *     zapis przez `Api.addNodeComment` / `Api.deleteNodeComment` — dokładnie ta
 *     sama trasa, którą zakładka „Komentarze" ma dziś (łącznie z wątkiem całej
 *     Idei pod `IDEA_SCOPE_NODE_ID`),
 *   • zmiany i wersje → `pobierzHistorieIdei` (IdeaPanelHistory) — `my_idea_activity`
 *     + `my_idea_map_snapshots`, z fallbackiem `localStorage` jak dotąd.
 *
 * PRZEDMIOT: nic nie zaznaczone → oś czasu CAŁEJ Idei. Element zaznaczony →
 * ta sama oś zawężona do elementu.
 *
 * ★ OGRANICZENIE, KTÓREGO NIE UDAJEMY: strumień `my_idea_activity` NIE trzyma
 * identyfikatora węzła — ma tylko `nodeLabel`. Zawężenie ZMIAN do elementu
 * dopasowuje więc po etykiecie i jest przybliżone; komentarze zawężają się
 * dokładnie (po `node_id`). Panel mówi o tym wprost stopką, zamiast udawać
 * precyzję. Domknięcie = dopisanie `node_id` do zapisu zdarzeń (osobne zadanie).
 */
import { Loader2, MessageSquare, RotateCcw, Send, Sparkles, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

import type { IdeaWorkspaceSelection } from '../ideaSelectionTypes';
import {
  czasWzgledny,
  czyAI,
  etykietaWezla,
  IDEA_SCOPE_NODE_ID,
  type PanelComment,
  pobierzKomentarzeSerwerowe,
  zblobu,
} from './IdeaPanelComments';
import {
  type IdeaHistoryEntry,
  KIND_DOT,
  KIND_ICON,
  pobierzHistorieIdei,
} from './IdeaPanelHistory';

export type IdeaActivityFilter = 'all' | 'comments' | 'changes' | 'ai';

export interface IdeaPanelActivityProps {
  ideaId: string;
  isDraft: boolean;
  isPl: boolean;
  selection: IdeaWorkspaceSelection;
  graphNodes: any[];
  /** Przywrócenie migawki — bez handlera nie rysujemy martwego przycisku (Z3). */
  onRestoreSnapshot?: (nodes: any[], edges: any[], extensions?: Record<string, unknown>) => void;
}

/** Jeden wpis scalonej osi czasu — komentarz albo zdarzenie/wersja. */
interface WpisOsi {
  key: string;
  timestamp: number;
  /** Kubełek filtra. */
  bucket: 'comments' | 'changes' | 'ai';
  komentarz?: PanelComment;
  zdarzenie?: IdeaHistoryEntry;
}

const CARD =
  'rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 space-y-1.5';

function czasZKomentarza(c: PanelComment): number {
  const ts = typeof c.createdAt === 'number' ? c.createdAt : Date.parse(String(c.createdAt));
  return Number.isNaN(ts) ? 0 : ts;
}

export const IdeaPanelActivity: React.FC<IdeaPanelActivityProps> = ({
  ideaId,
  isDraft,
  isPl,
  selection,
  graphNodes,
  onRestoreSnapshot,
}) => {
  const t = (pl: string, en: string) => (isPl ? pl : en);

  /**
   * Przedmiot osi = zaznaczony element, o ile REALNIE istnieje w grafie
   * (cztery reprezentacje dzielą jeden graf). Bez tej weryfikacji zapisalibyśmy
   * komentarz pod identyfikatorem, którego nie ma — identyczna ostrożność jak
   * w zakładce „Komentarze".
   */
  const wybranyId = useMemo(() => {
    if (!selection || (selection.type !== 'node' && selection.type !== 'row')) return null;
    const id = selection.primaryId ? String(selection.primaryId) : null;
    if (!id) return null;
    return (graphNodes ?? []).some((n: any) => String(n?.id) === id) ? id : null;
  }, [selection, graphNodes]);

  const wybranaEtykieta = useMemo(() => {
    if (!wybranyId) return null;
    const node = (graphNodes ?? []).find((n: any) => String(n?.id) === wybranyId);
    return node ? etykietaWezla(node, isPl) : null;
  }, [wybranyId, graphNodes, isPl]);

  const [filtr, setFiltr] = useState<IdeaActivityFilter>('all');
  const [serwerowe, setSerwerowe] = useState<PanelComment[]>([]);
  const [historia, setHistoria] = useState<IdeaHistoryEntry[]>([]);
  const [trybLokalny, setTrybLokalny] = useState(false);
  const [ladowanie, setLadowanie] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const [tresc, setTresc] = useState('');
  const [wysylka, setWysylka] = useState(false);

  /** Adresat zapisu: element w kontekście elementu, wątek Idei bez zaznaczenia. */
  const celId = wybranyId ?? IDEA_SCOPE_NODE_ID;
  const celEtykieta = wybranyId
    ? (wybranaEtykieta ?? t('(bez etykiety)', '(no label)'))
    : t('Cała Idea', 'Whole idea');

  const pobierz = useCallback(async () => {
    if (!ideaId || isDraft) {
      setSerwerowe([]);
      setHistoria([]);
      return;
    }
    setLadowanie(true);
    setBlad(null);
    try {
      setSerwerowe(await pobierzKomentarzeSerwerowe(ideaId, wybranyId));
    } catch {
      // Kanał serwerowy padł → zostają komentarze z blobu grafu (bez atrapy).
      setSerwerowe([]);
      setBlad(t('Kanał serwerowy niedostępny', 'Server channel unavailable'));
    }
    const { wpisy, trybLokalny: lokalny } = await pobierzHistorieIdei(ideaId, isPl);
    setHistoria(wpisy);
    setTrybLokalny(lokalny);
    setLadowanie(false);
  }, [ideaId, isDraft, wybranyId, isPl]);

  useEffect(() => {
    void pobierz();
    // Ten sam sygnał, którym ActivityFeed odświeża Historię — bez odpytywania w pętli.
    const onUpdate = () => void pobierz();
    window.addEventListener('mm-activity-update', onUpdate);
    return () => window.removeEventListener('mm-activity-update', onUpdate);
  }, [pobierz]);

  const zBlobu = useMemo(() => zblobu(graphNodes, isPl, wybranyId), [graphNodes, isPl, wybranyId]);

  const etykietaDlaId = useCallback(
    (nodeId: string): string => {
      if (nodeId === IDEA_SCOPE_NODE_ID) return t('Cała Idea', 'Whole idea');
      const node = (graphNodes ?? []).find((n: any) => String(n?.id) === nodeId);
      if (!node) return t('(usunięty element)', '(deleted element)');
      return etykietaWezla(node, isPl);
    },
    [graphNodes, isPl]
  );

  /** Scalona oś czasu — jedna lista, posortowana malejąco po czasie. */
  const wpisy = useMemo<WpisOsi[]>(() => {
    const komentarze = [...serwerowe, ...zBlobu].map((c) =>
      c.nodeLabel ? c : { ...c, nodeLabel: etykietaDlaId(c.nodeId) }
    );
    const zdarzenia = wybranaEtykieta
      ? // Zawężenie ZMIAN po etykiecie — jedyny klucz, jaki niesie strumień
        // zdarzeń (patrz nagłówek pliku). Wersje (migawki) dotyczą całej mapy,
        // więc w kontekście elementu ich nie pokazujemy.
        historia.filter((h) => h.kind !== 'version' && h.label === wybranaEtykieta)
      : historia;

    const zListy: WpisOsi[] = [
      ...komentarze.map((c) => ({
        key: `c-${c.source}-${c.id}`,
        timestamp: czasZKomentarza(c),
        bucket: (czyAI(c.author) ? 'ai' : 'comments') as WpisOsi['bucket'],
        komentarz: c,
      })),
      ...zdarzenia.map((h) => ({
        key: `h-${h.id}`,
        timestamp: h.timestamp,
        bucket: (h.kind === 'ai' ? 'ai' : 'changes') as WpisOsi['bucket'],
        zdarzenie: h,
      })),
    ];
    return zListy.sort((a, b) => b.timestamp - a.timestamp);
  }, [serwerowe, zBlobu, historia, wybranaEtykieta, etykietaDlaId]);

  const liczniki = useMemo(() => {
    const c = { comments: 0, changes: 0, ai: 0 };
    for (const w of wpisy) c[w.bucket] += 1;
    return c;
  }, [wpisy]);

  const widoczne = useMemo(
    () => (filtr === 'all' ? wpisy : wpisy.filter((w) => w.bucket === filtr)),
    [wpisy, filtr]
  );

  const filtry: Array<{ id: IdeaActivityFilter; label: string; count: number }> = [
    { id: 'all', label: t('Wszystko', 'All'), count: wpisy.length },
    { id: 'comments', label: t('Komentarze', 'Comments'), count: liczniki.comments },
    { id: 'changes', label: t('Zmiany', 'Changes'), count: liczniki.changes },
    { id: 'ai', label: 'AI', count: liczniki.ai },
  ];

  const dodaj = useCallback(async () => {
    const txt = tresc.trim();
    if (!txt || isDraft) return;
    setWysylka(true);
    setBlad(null);
    try {
      await Api.addNodeComment(ideaId, celId, txt);
      setTresc('');
      await pobierz();
    } catch {
      setBlad(t('Nie udało się dodać komentarza', 'Could not add the comment'));
    } finally {
      setWysylka(false);
    }
  }, [tresc, celId, isDraft, ideaId, pobierz, isPl]);

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

  return (
    <div className="space-y-3" data-testid="idea-panel-activity">
      {/* Chipy filtra — pozycja bez wpisów jest wyłączona (nie udajemy treści). */}
      <div className="flex flex-wrap items-center gap-1">
        {filtry.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => (f.count > 0 || f.id === 'all') && setFiltr(f.id)}
            disabled={f.count === 0 && f.id !== 'all'}
            title={f.count === 0 ? t('Brak takich wpisów', 'No such entries') : undefined}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              filtr === f.id
                ? 'bg-c-focus/10 text-c-focus-solid'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            data-testid={`idea-panel-activity-filter-${f.id}`}
          >
            {f.label}
            <span className="ml-1 tabular-nums text-c-text-muted">{f.count}</span>
          </button>
        ))}
      </div>

      {trybLokalny && (
        <div className="text-[10px] text-c-warning">
          {t(
            'tryb lokalny — część historii z tej przeglądarki',
            'local mode — part of the history comes from this browser'
          )}
        </div>
      )}

      {isDraft && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[11px] text-c-text-secondary">
          {t(
            'Zapisz Ideę, aby zbierać komentarze i historię zmian.',
            'Save the idea to start collecting comments and change history.'
          )}
        </div>
      )}

      {blad && <div className="text-[10px] text-c-warning">{blad}</div>}

      {ladowanie && (
        <div className="flex items-center gap-2 text-[11px] text-c-text-muted">
          <Loader2 size={12} className="animate-spin" />
          {t('Wczytywanie…', 'Loading…')}
        </div>
      )}

      {!ladowanie && !isDraft && widoczne.length === 0 && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center">
          <MessageSquare size={16} className="mx-auto mb-1.5 text-c-text-muted" />
          <div className="text-[11px] text-c-text-secondary">
            {wybranyId
              ? t('Brak aktywności na tym elemencie.', 'No activity on this element yet.')
              : t('Brak aktywności w tej Idei.', 'No activity in this idea yet.')}
          </div>
          <div className="mt-1 text-[10px] text-c-text-muted">
            {t('Napisz pierwszy komentarz poniżej.', 'Write the first comment below.')}
          </div>
        </div>
      )}

      {widoczne.length > 0 && (
        <ol className="space-y-2" data-testid="idea-panel-activity-list">
          {widoczne.map((w) => {
            if (w.komentarz) {
              const c = w.komentarz;
              const ai = czyAI(c.author);
              return (
                <li key={w.key} className={CARD}>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        ai ? 'bg-c-info/15 text-c-info' : 'bg-c-surface text-c-text-secondary'
                      }`}
                      aria-hidden="true"
                    >
                      {ai ? <Sparkles size={10} /> : (c.author || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-[11px] font-semibold text-c-text">
                      {c.author}
                    </span>
                    <span className="rounded px-1 py-px text-[8px] font-bold uppercase tracking-wider bg-c-surface text-c-text-muted">
                      {ai ? 'AI' : t('komentarz', 'comment')}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-c-text-muted">
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
                  {!wybranyId && (
                    <div className="truncate text-[10px] text-c-text-muted">↳ {c.nodeLabel}</div>
                  )}
                </li>
              );
            }

            const h = w.zdarzenie!;
            const Icon = KIND_ICON[h.kind];
            const niszczace = h.type === 'node_deleted';
            return (
              <li key={w.key} className={CARD}>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      niszczace ? 'bg-c-danger' : KIND_DOT[h.kind]
                    }`}
                  />
                  <Icon size={11} className="shrink-0 text-c-text-muted" />
                  <span className="truncate text-[11px] font-semibold text-c-text">{h.actor}</span>
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums text-c-text-muted">
                    {czasWzgledny(h.timestamp, isPl)}
                  </span>
                </div>
                <div className="text-[11px] text-c-text-secondary">
                  {h.kind === 'version' ? (
                    <span>
                      {h.label || t('Migawka', 'Snapshot')}
                      <span className="ml-1.5 tabular-nums text-c-text-muted">
                        {h.nodeCount ?? 0} · {h.edgeCount ?? 0}
                      </span>
                    </span>
                  ) : (
                    <span>
                      <span className="text-c-text-muted">{h.type}</span>
                      {h.label ? ` · ${h.label}` : ''}
                      {h.detail ? ` — ${h.detail}` : ''}
                    </span>
                  )}
                </div>
                {h.kind === 'version' && onRestoreSnapshot && h.snapshot && (
                  <button
                    type="button"
                    onClick={() =>
                      onRestoreSnapshot(
                        h.snapshot!.nodes,
                        h.snapshot!.edges,
                        h.snapshot!.extensions
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-c-focus-solid hover:bg-c-focus/10 transition-colors"
                    data-testid="idea-panel-activity-restore"
                  >
                    <RotateCcw size={10} />
                    {t('Przywróć wersję', 'Restore version')}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Uczciwa stopka o przybliżeniu — tylko gdy zawężamy do elementu. */}
      {wybranyId && (
        <div className="text-[10px] leading-relaxed text-c-text-muted">
          {t(
            'Komentarze zawężone dokładnie do elementu; zmiany — po jego nazwie.',
            'Comments are scoped exactly to the element; changes are matched by its name.'
          )}
        </div>
      )}

      {!isDraft && (
        <div className="space-y-1.5">
          <textarea
            value={tresc}
            onChange={(e) => setTresc(e.target.value)}
            rows={2}
            placeholder={
              wybranyId
                ? t('Dodaj komentarz do elementu…', 'Add a comment on the element…')
                : t('Dodaj komentarz do całej Idei…', 'Add a comment on the whole idea…')
            }
            className="w-full rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-2 text-[11px] text-c-text placeholder:text-c-text-muted resize-none focus:outline-none focus:border-c-focus"
            data-testid="idea-panel-activity-input"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void dodaj()}
              disabled={!tresc.trim() || wysylka}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-c-text px-2.5 py-1.5 text-[10px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
              data-testid="idea-panel-activity-submit"
            >
              {wysylka ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
              {t('Dodaj komentarz', 'Add comment')}
            </button>
            <span
              className="min-w-0 truncate text-[10px] text-c-text-muted"
              title={celEtykieta}
              data-testid="idea-panel-activity-target"
            >
              ↳ {celEtykieta}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default IdeaPanelActivity;
