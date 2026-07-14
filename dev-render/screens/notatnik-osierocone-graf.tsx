/**
 * Dev-render host: Notatnik #18 — graf połączeń (naprawiony) + osierocone notatki.
 *
 * Dwie kolumny:
 *  LEWA  — REALNY <NotebookGraphView/> (produkcyjny komponent, ten sam co w
 *          NotebookContent), zasilony mockiem `window.fetch` zamiast żywego
 *          backendu. Pokazuje 3 stany: notatka z tematami+backlinkami
 *          (tytuły rozwiązane, nie surowe id), notatka pusta (empty-state),
 *          notatka tylko-z-tematami (prawa strona pusta).
 *  PRAWA — mock paska soczewek + wiersza listy notatnika z nowym filtrem
 *          „Osierocone" aktywnym i odznaką „Bez powiązań" na wierszu — te same
 *          klasy Tailwind/tokeny c-* co w realnym NotebookContent.tsx (patrz
 *          #18 commit), bo NotebookContent to duży, silnie stanowy komponent
 *          (edytor Tiptap, API calls) — niepraktyczny do zamontowania w
 *          statycznym harnessie 1:1; struktura JSX skopiowana wiernie.
 *
 * Fixy #18 widoczne tu:
 *  - kolory węzłów grafu = var(--c-*) → poprawny kontrast w dark (był hardcoded hex)
 *  - węzły backlinków pokazują TYTUŁY (nie "task: a1b2c3d4")
 *  - lewy wachlarz tematów = tylko tematy TEJ notatki (był org-wide bug)
 *  - sidebar: soczewka „Osierocone" + odznaka „Bez powiązań" (c-warning, nie crimson)
 */
import { AlertTriangle, Clock, Pin, Sparkles, Unlink } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { NotebookGraphView } from '../../src/components/MyWork/notebook/NotebookGraphView';

// ── Mock backend: intercepts the exact endpoints NotebookGraphView calls ───
type MockRoute = { match: (url: string) => boolean; json: unknown };

function installFetchMock(routes: MockRoute[]) {
  const original = window.fetch;
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const route = routes.find((r) => r.match(url));
    if (route) {
      return new Response(JSON.stringify(route.json), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return original(input, init);
  }) as typeof window.fetch;
  return () => {
    window.fetch = original;
  };
}

const TOPICS_CONNECTED = [
  { id: 't1', name: 'Wejście na rynek DE', pageCount: 6 },
  { id: 't2', name: 'Bariery regulacyjne', pageCount: 3 },
];
const BACKLINK_REFS_CONNECTED = [
  { sourceType: 'initiative', sourceId: 'ini-1111111111' },
  { sourceType: 'task', sourceId: 'tsk-2222222222' },
  { sourceType: 'decision', sourceId: 'dec-3333333333' },
];
const EMBED_CHIPS_CONNECTED = [
  {
    artifactType: 'initiative',
    artifactId: 'ini-1111111111',
    title: 'Ekspansja DE — inicjatywa',
    snippet: '',
    permissionOk: true,
  },
  {
    artifactType: 'task',
    artifactId: 'tsk-2222222222',
    title: 'Zweryfikuj bariery regulacyjne',
    snippet: '',
    permissionOk: true,
  },
  {
    artifactType: 'decision',
    artifactId: 'dec-3333333333',
    title: 'Wybór wariantu B',
    snippet: '',
    permissionOk: true,
  },
];

function GraphCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-c-border-subtle bg-c-surface p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
        {title}
      </div>
      {children}
    </div>
  );
}

// LEWA — 3 stany realnego NotebookGraphView, każdy zasilony osobnym mockiem fetch.
function GraphColumn({ isPl }: { isPl: boolean }): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const uninstall = installFetchMock([
      {
        match: (u) => u.includes('/notebook/pages/note-connected/topics'),
        json: { data: TOPICS_CONNECTED },
      },
      {
        match: (u) => u.includes('/link-graph/backlinks') && u.includes('id=note-connected'),
        json: BACKLINK_REFS_CONNECTED,
      },
      {
        match: (u) => u.includes('/notebook/embed-chips/resolve'),
        json: { chips: EMBED_CHIPS_CONNECTED },
      },
      {
        match: (u) => u.includes('/notebook/pages/note-topics-only/topics'),
        json: { data: TOPICS_CONNECTED.slice(0, 1) },
      },
      {
        match: (u) => u.includes('/link-graph/backlinks') && u.includes('id=note-topics-only'),
        json: [],
      },
      {
        match: (u) => u.includes('/notebook/pages/note-empty/topics'),
        json: { data: [] },
      },
      {
        match: (u) => u.includes('/link-graph/backlinks') && u.includes('id=note-empty'),
        json: [],
      },
    ]);
    setReady(true);
    return uninstall;
  }, []);

  if (!ready) return <div />;

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto border-r border-c-border-subtle bg-c-bg p-5">
      <div className="text-sm font-bold text-c-text">
        {isPl ? 'Graf połączeń — po naprawie #18' : 'Connection graph — after #18 fix'}
      </div>
      <GraphCard
        title={
          isPl
            ? 'Notatka z tematami + backlinkami (tytuły)'
            : 'Note with topics + backlinks (titled)'
        }
      >
        <NotebookGraphView
          pageId="note-connected"
          pageTitle="Ustalenia z rozmowy — wejście na rynek DE"
          isPolish={isPl}
          height={260}
        />
      </GraphCard>
      <GraphCard
        title={
          isPl ? 'Notatka tylko z tematem (brak backlinków)' : 'Note with topic only (no backlinks)'
        }
      >
        <NotebookGraphView
          pageId="note-topics-only"
          pageTitle="Szkic — regulacje DE"
          isPolish={isPl}
          height={220}
        />
      </GraphCard>
      <GraphCard title={isPl ? 'Notatka osierocona (pusty stan)' : 'Orphaned note (empty state)'}>
        <NotebookGraphView
          pageId="note-empty"
          pageTitle="Luźna myśl bez kontekstu"
          isPolish={isPl}
          height={180}
        />
      </GraphCard>
    </div>
  );
}

// PRAWA — mock sidebara notatnika: pasek soczewek (z 'Osierocone' aktywnym) +
// wiersze listy, struktura/klasy skopiowane z NotebookContent.tsx (#18 commit).
function SidebarColumn({ isPl }: { isPl: boolean }): React.ReactElement {
  const lenses: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    count: number;
    active?: boolean;
  }> = [
    { key: 'all', label: isPl ? 'Wszystkie' : 'All', icon: null, count: 0 },
    { key: 'pinned', label: isPl ? 'Przypięte' : 'Pinned', icon: <Pin size={11} />, count: 2 },
    { key: 'recent', label: isPl ? 'Ostatnie' : 'Recent', icon: <Clock size={11} />, count: 5 },
    {
      key: 'toReview',
      label: isPl ? 'Do przeglądu' : 'To review',
      icon: <AlertTriangle size={11} />,
      count: 1,
    },
    { key: 'fresh', label: isPl ? 'Świeże' : 'Fresh', icon: <Sparkles size={11} />, count: 3 },
    {
      key: 'orphaned',
      label: isPl ? 'Osierocone' : 'Orphaned',
      icon: <Unlink size={11} />,
      count: 4,
      active: true,
    },
  ];

  const rows = [
    {
      title: isPl ? 'Luźna myśl bez kontekstu' : 'Loose thought, no context',
      orphaned: true,
      time: isPl ? '2 dni temu' : '2d ago',
    },
    {
      title: isPl ? 'Szybka notatka ze spotkania' : 'Quick meeting scratch note',
      orphaned: true,
      time: isPl ? '5 dni temu' : '5d ago',
    },
    {
      title: isPl ? 'Ustalenia z rozmowy — wejście na rynek DE' : 'Chat findings — DE market entry',
      orphaned: false,
      time: isPl ? '3 godz. temu' : '3h ago',
    },
  ];

  return (
    <div className="flex h-full w-[360px] shrink-0 flex-col bg-c-bg p-5">
      <div className="mb-3 text-sm font-bold text-c-text">
        {isPl ? 'Sidebar notatnika — soczewka „Osierocone"' : 'Notebook sidebar — "Orphaned" lens'}
      </div>

      <div className="rounded-2xl border border-c-border-subtle bg-c-surface">
        {/* pasek soczewek */}
        <div className="flex flex-wrap items-center gap-1 px-3 py-2.5 border-b border-c-border-subtle">
          {lenses.map((v) => (
            <button
              key={v.key}
              type="button"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                v.active ? 'bg-c-text text-c-surface' : 'bg-c-surface-raised text-c-text-secondary'
              }`}
            >
              {v.icon}
              {v.label}
              {v.key !== 'all' && v.count > 0 && (
                <span
                  className={`rounded-full px-1 text-[9px] ${v.active ? 'bg-c-surface/20' : 'bg-c-surface text-c-text-muted'}`}
                >
                  {v.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* wiersze listy (filtrowane do „osierocone" — 2 z odznaką + 1 zwykła dla kontrastu) */}
        <div className="flex flex-col gap-1 p-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="group relative rounded-xl border border-transparent px-3 py-2.5 hover:bg-c-surface-raised"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-400" />
                    <span className="flex-1 truncate text-[13px] font-semibold text-c-text">
                      {r.title}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-c-text-muted">
                      {r.time}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle bg-c-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-text-secondary">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {isPl ? 'Rozwijana' : 'Growing'}
                    </span>
                    {r.orphaned && (
                      <span
                        className="inline-flex items-center gap-0.5 rounded-md bg-c-warning/10 text-c-warning px-1.5 py-0.5 text-[11px] font-medium"
                        title={
                          isPl
                            ? 'Brak powiązań — dodaj wzmiankę (@) lub zarchiwizuj'
                            : 'No connections — add a mention (@) or archive'
                        }
                      >
                        <Unlink size={9} className="inline" />
                        {isPl ? 'Bez powiązań' : 'Unlinked'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-c-text-muted">
        {isPl
          ? 'Filtr nie usuwa nic automatycznie (D4) — użytkownik dodaje wzmiankę (@) w treści notatki albo używa istniejącej akcji „Archiwizuj" w kebabie.'
          : 'The filter never auto-deletes (D4) — the user adds a mention (@) in the note body or uses the existing "Archive" kebab action.'}
      </p>
    </div>
  );
}

export default function NotatnikOsieroconeGrafScreen(): React.ReactElement {
  const isPl =
    (document.documentElement.lang || 'pl').startsWith('pl') ||
    new URLSearchParams(window.location.search).get('lang') !== 'en';

  return (
    <div className="flex h-screen w-full overflow-hidden bg-c-bg">
      <div className="min-w-0 flex-1">
        <GraphColumn isPl={isPl} />
      </div>
      <SidebarColumn isPl={isPl} />
    </div>
  );
}
