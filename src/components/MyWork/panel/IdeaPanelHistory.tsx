/**
 * IdeaPanelHistory — zakładka „Historia" prawego panelu Idei.
 *
 * Kanon D1: docs/standards/idea-workspace/07_PRAWY_PANEL.md §8 — jedna oś czasu
 * zdarzeń, AI jest TYPEM ZDARZENIA (filtrem), nie osobną kategorią/zakładką.
 *
 * SKĄD DANE (dwa istniejące, realne źródła — NIE budujemy trzeciego magazynu):
 *   1. `GET /my-work/my-ideas/:id/activity` (`Api.getMyIdeaActivity`) — tabela
 *      `my_idea_activity`; ten sam strumień, który zapisuje `pushActivity`
 *      z `mindmap/ActivityFeed.tsx`. Fallback offline = `localStorage`
 *      `mm-activity-<ideaId>` — TEN SAM klucz, którego używa ActivityFeed.
 *   2. `GET /my-work/my-ideas/:id/map/snapshots` (`Api.getMyIdeaMapSnapshots`)
 *      — tabela `my_idea_map_snapshots`; te same wersje, które pokazuje modal
 *      `mindmap/SnapshotHistory.tsx` (fallback `mm-snapshots-<ideaId>`).
 *
 * DLACZEGO NIE OSADZAMY `SnapshotHistory` 1:1: ten komponent to modal na całym
 * ekranie (`fixed inset-0 z-modal`) — nie da się go wstawić w kolumnę panelu.
 * Czytamy więc TE SAME dane tym samym API; żadnej drugiej historii nie powstaje.
 *
 * PRZYWRACANIE WERSJI: przycisk pojawia się WYŁĄCZNIE gdy host poda
 * `onRestoreSnapshot` (realny handler płótna). Bez handlera nie rysujemy
 * martwego przycisku (Z3).
 *
 * Wygląd: tokeny `c-*`, kropka osi w kolorze typu zdarzenia; czerwień tylko dla
 * zdarzenia niszczącego (usunięcie elementu).
 */
import { Bot, Clock, GitBranch, Loader2, RotateCcw, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Api } from '@/services/api';

export type IdeaHistoryKind = 'people' | 'ai' | 'convert' | 'version';

export interface IdeaHistoryEntry {
  id: string;
  timestamp: number;
  kind: IdeaHistoryKind;
  /** Surowy typ zdarzenia z API (np. `node_added`, `snapshot`). */
  type: string;
  actor: string;
  label?: string;
  detail?: string;
  /** Wypełnione tylko dla wersji (migawek) — potrzebne do przywrócenia. */
  snapshot?: { nodes: any[]; edges: any[]; extensions?: Record<string, unknown> };
  nodeCount?: number;
  edgeCount?: number;
}

export interface IdeaPanelHistoryProps {
  ideaId: string;
  isDraft: boolean;
  isPl: boolean;
  /**
   * Przywrócenie migawki na płótno. Podaje host (IdeaMapWorkspace) — ten sam
   * handler, którym karmi modal `SnapshotHistory`. Brak → brak przycisku.
   */
  onRestoreSnapshot?: (nodes: any[], edges: any[], extensions?: Record<string, unknown>) => void;
}

const ACTIVITY_LS_PREFIX = 'mm-activity-';
const SNAPSHOT_LS_PREFIX = 'mm-snapshots-';

/** Klasyfikacja zdarzenia → filtr (§8: Ludzie · AI · Konwersje · Wersje). */
function klasyfikuj(type: string, actor: string): IdeaHistoryKind {
  const t = String(type || '').toLowerCase();
  if (t === 'snapshot') return 'version';
  if (t.startsWith('ai_') || /teresa|\bai\b|bot/i.test(actor || '')) return 'ai';
  if (t === 'convert' || t.includes('convert') || t.includes('import')) return 'convert';
  return 'people';
}

function czasWzgledny(ts: number, pl: boolean): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return pl ? 'przed chwilą' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return pl ? `${m} min temu` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return pl ? `${h} godz. temu` : `${h}h ago`;
  return pl ? `${Math.floor(h / 24)} dn. temu` : `${Math.floor(h / 24)}d ago`;
}

function czytajLokalne<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Odczyt osi czasu Idei — JEDNO źródło prawdy dla zakładki „Historia" (układ
 * 5 zakładek, flaga OFF) i dla scalonej osi „Aktywność" (`IdeaPanelActivity`,
 * układ 6 sekcji, flaga ON). Zwraca też `trybLokalny` — czy któreś ze źródeł
 * poleciało z `localStorage` zamiast z serwera (uczciwa plakietka w UI).
 */
export async function pobierzHistorieIdei(
  ideaId: string,
  isPl: boolean
): Promise<{ wpisy: IdeaHistoryEntry[]; trybLokalny: boolean }> {
  const t = (pl: string, en: string) => (isPl ? pl : en);
  let lokalny = false;

  // 1. Strumień zdarzeń.
  let zdarzenia: IdeaHistoryEntry[] = [];
  const naZdarzenie = (e: any, zLokalnego: boolean): IdeaHistoryEntry => ({
    id: `act-${e.id}`,
    timestamp: zLokalnego
      ? Number(e.timestamp) || Date.now()
      : Number(e.timestamp) || Date.parse(String(e.createdAt)) || Date.now(),
    kind: klasyfikuj(e.type, e.actor),
    type: String(e.type || ''),
    actor: String(e.actor || ''),
    label: e.nodeLabel ? String(e.nodeLabel) : undefined,
    detail: e.detail ? String(e.detail) : undefined,
  });
  try {
    const res = await Api.getMyIdeaActivity(ideaId, { limit: 100 });
    const lista = Array.isArray(res?.entries) ? res.entries : [];
    zdarzenia = lista.map((e: any) => naZdarzenie(e, false));
  } catch {
    lokalny = true;
    zdarzenia = czytajLokalne<any>(`${ACTIVITY_LS_PREFIX}${ideaId}`).map((e: any) =>
      naZdarzenie(e, true)
    );
  }

  // 2. Wersje (migawki) — ten sam magazyn co modal Historii wersji.
  let wersje: IdeaHistoryEntry[] = [];
  const naWpis = (s: any): IdeaHistoryEntry => ({
    id: `snap-${s.id}`,
    timestamp: Number(s.timestamp) || Date.now(),
    kind: 'version',
    type: 'snapshot',
    actor: t('Wersja', 'Version'),
    label: String(s.label || ''),
    snapshot: { nodes: s.nodes || [], edges: s.edges || [], extensions: s.extensions },
    nodeCount: Number(s.nodeCount) || (s.nodes?.length ?? 0),
    edgeCount: Number(s.edgeCount) || (s.edges?.length ?? 0),
  });
  try {
    const res = await Api.getMyIdeaMapSnapshots(ideaId);
    wersje = (Array.isArray(res?.snapshots) ? res.snapshots : []).map(naWpis);
  } catch {
    lokalny = true;
    wersje = czytajLokalne<any>(`${SNAPSHOT_LS_PREFIX}${ideaId}`).map(naWpis);
  }

  return {
    wpisy: [...zdarzenia, ...wersje].sort((a, b) => b.timestamp - a.timestamp),
    trybLokalny: lokalny,
  };
}

export const KIND_DOT: Record<IdeaHistoryKind, string> = {
  people: 'bg-c-info',
  ai: 'bg-c-success',
  convert: 'bg-c-warning',
  version: 'bg-c-text-muted',
};

export const KIND_ICON: Record<IdeaHistoryKind, React.ComponentType<any>> = {
  people: User,
  ai: Bot,
  convert: GitBranch,
  version: Clock,
};

export const IdeaPanelHistory: React.FC<IdeaPanelHistoryProps> = ({
  ideaId,
  isDraft,
  isPl,
  onRestoreSnapshot,
}) => {
  const t = (pl: string, en: string) => (isPl ? pl : en);

  const [wpisy, setWpisy] = useState<IdeaHistoryEntry[]>([]);
  const [ladowanie, setLadowanie] = useState(false);
  const [trybLokalny, setTrybLokalny] = useState(false);
  const [filtr, setFiltr] = useState<IdeaHistoryKind | 'all'>('all');

  const pobierz = useCallback(async () => {
    if (!ideaId || isDraft) {
      setWpisy([]);
      return;
    }
    setLadowanie(true);
    const { wpisy: pobrane, trybLokalny: lokalny } = await pobierzHistorieIdei(ideaId, isPl);
    setTrybLokalny(lokalny);
    setWpisy(pobrane);
    setLadowanie(false);
  }, [ideaId, isDraft, isPl]);

  useEffect(() => {
    void pobierz();
    // ActivityFeed nadaje to zdarzenie po każdym `pushActivity` — odświeżamy
    // oś czasu bez odpytywania w pętli.
    const onUpdate = () => void pobierz();
    window.addEventListener('mm-activity-update', onUpdate);
    return () => window.removeEventListener('mm-activity-update', onUpdate);
  }, [pobierz]);

  const liczniki = useMemo(() => {
    const c: Record<IdeaHistoryKind, number> = { people: 0, ai: 0, convert: 0, version: 0 };
    for (const w of wpisy) c[w.kind] += 1;
    return c;
  }, [wpisy]);

  const widoczne = useMemo(
    () => (filtr === 'all' ? wpisy : wpisy.filter((w) => w.kind === filtr)),
    [wpisy, filtr]
  );

  const filtry: Array<{ id: IdeaHistoryKind | 'all'; label: string; count: number }> = [
    { id: 'all', label: t('Wszystko', 'All'), count: wpisy.length },
    { id: 'people', label: t('Ludzie', 'People'), count: liczniki.people },
    { id: 'ai', label: 'AI', count: liczniki.ai },
    { id: 'convert', label: t('Konwersje', 'Conversions'), count: liczniki.convert },
    { id: 'version', label: t('Wersje', 'Versions'), count: liczniki.version },
  ];

  return (
    <div className="space-y-3" data-testid="idea-panel-history">
      {/* Filtry — pozycja bez zdarzeń jest wyłączona (nie udajemy, że coś jest). */}
      <div className="flex flex-wrap items-center gap-1">
        {filtry.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => f.count > 0 && setFiltr(f.id)}
            disabled={f.count === 0}
            title={f.count === 0 ? t('Brak takich zdarzeń', 'No such events') : undefined}
            className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              filtr === f.id
                ? 'bg-c-focus/10 text-c-focus-solid'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
            data-testid={`idea-panel-history-filter-${f.id}`}
          >
            {f.label}
            <span className="ml-1 tabular-nums text-c-text-muted">{f.count}</span>
          </button>
        ))}
      </div>

      {trybLokalny && (
        <div className="text-[10px] text-c-warning">
          {t(
            'tryb lokalny — historia z tej przeglądarki',
            'local mode — history from this browser'
          )}
        </div>
      )}

      {isDraft && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-[11px] text-c-text-secondary">
          {t(
            'Zapisz Ideę, aby zbierać historię zmian.',
            'Save the idea to start collecting its history.'
          )}
        </div>
      )}

      {ladowanie && (
        <div className="flex items-center gap-2 text-[11px] text-c-text-muted">
          <Loader2 size={12} className="animate-spin" />
          {t('Wczytywanie…', 'Loading…')}
        </div>
      )}

      {!ladowanie && !isDraft && widoczne.length === 0 && (
        <div className="rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-4 text-center">
          <Clock size={16} className="mx-auto mb-1.5 text-c-text-muted" />
          <div className="text-[11px] text-c-text-secondary">
            {t('Brak zapisanych zdarzeń.', 'No recorded events yet.')}
          </div>
        </div>
      )}

      {widoczne.length > 0 && (
        <ol className="space-y-2">
          {widoczne.map((w) => {
            const Icon = KIND_ICON[w.kind];
            const niszczace = w.type === 'node_deleted';
            return (
              <li
                key={w.id}
                className="relative rounded-[11px] border border-c-border-subtle bg-c-surface-raised px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      niszczace ? 'bg-c-danger' : KIND_DOT[w.kind]
                    }`}
                  />
                  <Icon size={11} className="shrink-0 text-c-text-muted" />
                  <span className="truncate text-[11px] font-semibold text-c-text">{w.actor}</span>
                  <span className="ml-auto shrink-0 text-[10px] tabular-nums text-c-text-muted">
                    {czasWzgledny(w.timestamp, isPl)}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-c-text-secondary">
                  {w.kind === 'version' ? (
                    <span>
                      {w.label || t('Migawka', 'Snapshot')}
                      <span className="ml-1.5 tabular-nums text-c-text-muted">
                        {w.nodeCount ?? 0} · {w.edgeCount ?? 0}
                      </span>
                    </span>
                  ) : (
                    <span>
                      <span className="text-c-text-muted">{w.type}</span>
                      {w.label ? ` · ${w.label}` : ''}
                      {w.detail ? ` — ${w.detail}` : ''}
                    </span>
                  )}
                </div>
                {w.kind === 'version' && onRestoreSnapshot && w.snapshot && (
                  <button
                    type="button"
                    onClick={() =>
                      onRestoreSnapshot(
                        w.snapshot!.nodes,
                        w.snapshot!.edges,
                        w.snapshot!.extensions
                      )
                    }
                    className="mt-1.5 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-c-focus-solid hover:bg-c-focus/10 transition-colors"
                    data-testid="idea-panel-history-restore"
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
    </div>
  );
};

export default IdeaPanelHistory;
