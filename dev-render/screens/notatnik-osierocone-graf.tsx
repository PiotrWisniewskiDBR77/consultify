/**
 * Dev-render host: Notatnik #18 — graf połączeń (naprawiony).
 *
 * REALNY <NotebookGraphPanel/> (produkcyjny komponent, ten sam co w
 * NotebookContent), zasilony mockiem `window.fetch` zamiast żywego
 * backendu. Panel dokowany (w-72) + przycisk „Pełny ekran" —
 * 171-pojedyncze (uwaga właściciela 2026-09-01: "zrób ją na całym
 * ekranie jedną, bo kilka na jednym ekranie nie daje komfortu
 * pracy"). PRZED #171 ten harness stackował TRZY osobne
 * <NotebookGraphView/> jeden pod drugim wyłącznie do celów audytu
 * (patrz git blame) — właściciel to zobaczył i skomentował jako
 * rzeczywisty UX. W realnym produkcie graf renderuje się RAZ, na
 * jedną otwartą notatkę (NotebookContent.tsx) — więc PO pokazuje
 * dokładnie to (jeden panel, z wyjściem na pełny ekran).
 *
 * Fixy #18 widoczne tu:
 *  - kolory węzłów grafu = var(--c-*) → poprawny kontrast w dark (był hardcoded hex)
 *  - węzły backlinków pokazują TYTUŁY (nie "task: a1b2c3d4")
 *  - lewy wachlarz tematów = tylko tematy TEJ notatki (był org-wide bug)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — USUNIĘTA atrapa prawej kolumny „soczewka Osierocone"
 * (audyt przyrządu, Kategoria 1).
 *
 * Ten ekran wcześniej dorysowywał RĘCZNIE (nie realnym komponentem) prawą
 * kolumnę `w-[360px]` z paskiem soczewek notatnika i wierszami listy z
 * odznaką „Bez powiązań" — obok REALNEGO `NotebookGraphPanel`. Produkcja
 * (`NotebookContent.tsx:4256`) montuje `NotebookGraphPanel` SAM — jego
 * sąsiad to `NotebookRightRail` (Praca/Kontekst), nie żaden sidebar
 * „Osierocone". Ta atrapa nie odpowiadała ŻADNEMU sąsiadowi, jaki produkcja
 * kiedykolwiek montuje obok grafu — usunięta. Filtr „Osierocone" jako taki
 * (lista notatek, nie panel grafu) żyje gdzie indziej w produkcie i nie jest
 * przedmiotem tego ekranu.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * URL: ?screen=notatnik-osierocone-graf&theme=light|dark
 *      &graf=fullscreen   ← startuje z otwartym pełnym ekranem grafu (evidence PO)
 */
import React, { useEffect, useState } from 'react';

import { NotebookGraphPanel } from '../../src/components/MyWork/notebook/NotebookGraphPanel';

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

// LEWA — REALNY <NotebookGraphPanel/> (dokowany w-72 + wyjście na pełny
// ekran), jedna notatka na raz — dokładnie jak w produkcie (NotebookContent
// montuje ten sam komponent raz, dla activePage). `&graf=fullscreen` startuje
// już rozwinięty, dla deterministycznego zrzutu PO bez klikania w skrypcie.
function GraphColumn({ isPl }: { isPl: boolean }): React.ReactElement {
  const [ready, setReady] = useState(false);
  const startFullscreen = new URLSearchParams(window.location.search).get('graf') === 'fullscreen';
  const [dockOpen, setDockOpen] = useState(!startFullscreen);
  const [fullscreen, setFullscreen] = useState(startFullscreen);

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
    ]);
    setReady(true);
    return uninstall;
  }, []);

  if (!ready) return <div />;

  return (
    <div className="flex h-full min-w-0 flex-col gap-4 overflow-y-auto border-r border-c-border-subtle bg-c-bg p-5">
      <div className="text-sm font-bold text-c-text">
        {isPl
          ? 'Notatnik — graf połączeń jednej notatki (171-pojedyncze)'
          : 'Notebook — one note’s connection graph (171-pojedyncze)'}
      </div>
      <p className="max-w-md text-xs text-c-text-muted">
        {isPl
          ? 'Dokowany panel (w-72) zostaje wąski — ale ma "Pełny ekran" obok. Kliknij ikonę, żeby zobaczyć ten sam graf bez ścieśnienia.'
          : 'The docked panel (w-72) stays narrow — but it has "Full screen" next to it. Click the icon to see the same graph without the squeeze.'}
      </p>
      <div className="flex flex-1 items-start">
        <NotebookGraphPanel
          show={dockOpen}
          fullscreen={fullscreen}
          pageId="note-connected"
          pageTitle="Ustalenia z rozmowy — wejście na rynek DE"
          isPolish={isPl}
          onCloseDock={() => setDockOpen(false)}
          onExpand={() => setFullscreen(true)}
          onCollapse={() => setFullscreen(false)}
        />
      </div>
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
    </div>
  );
}
