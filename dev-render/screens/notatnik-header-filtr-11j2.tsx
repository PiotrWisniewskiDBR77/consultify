/**
 * ZLECENIE 1.1-J2 (przejście właściciela 06.09, Notatnik → nagłówek + filtr
 * listy "Moje notatki"). Mounts the REAL production header
 * (`NotebookHeaderActions`) + the REAL filter dropdown
 * (`NotebookViewFilterSelect`) + the REAL row component (`NotebookPageListRow`,
 * unchanged from 1.1-J) against a mock page array — no Api/fetch, no login —
 * so the supervisor can screenshot the fixed header/filter BEFORE the owner
 * ever sees it (CLAUDE.md #7).
 *
 * Reproduces the REAL DOM nesting from `NotebookContent.tsx` (the sidebar's
 * `overflow-hidden` wrapper around the header) so the DEC-405c tooltip-
 * clipping bug is reproducible/verifiable here, not just described.
 *
 * DEC-405b — chips row (Wszystkie/Przypięte/Ostatnie/Do przeglądu/Świeże/
 * Osierocone) replaced by ONE dropdown with counters, next to a persistent
 * "Szukaj w notatkach…" field (one line).
 * DEC-405c — empty tooltip over wstecz/+/lupa: root cause was
 * `TooltipContent`'s default `bottom-full` (renders ABOVE the trigger)
 * clipped by the sidebar's `overflow-hidden` ancestor, because the header is
 * the very first element in that box (nothing above it to make room). Fixed
 * by giving the header's three tooltips `side="bottom"`.
 *
 * URL params: &theme=light|dark (harness default handles this already).
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { NotebookHeaderActions } from '../../src/components/MyWork/NotebookHeaderActions';
import { NotebookPageListRow } from '../../src/components/MyWork/notebook/NotebookPageListRow';
import {
  isFreshPage,
  isRecentPage,
  isToReviewPage,
  matchesView,
  type NotebookViewLens,
} from '../../src/components/MyWork/notebook/notebookViewLensPredicates';
import { NotebookViewFilterSelect } from '../../src/components/MyWork/notebook/NotebookViewFilterSelect';
import type { NotebookPage } from '../../src/types/myWork';

function mockPage(overrides: Partial<NotebookPage>): NotebookPage {
  return {
    id: overrides.id || Math.random().toString(36).slice(2),
    title: 'Notatka',
    projectId: null,
    visibility: 'private',
    tags: [],
    contentJson: null,
    contentText: '',
    maturity: 'growing',
    icon: null,
    summary: null,
    status: 'active',
    pinned: false,
    convertedTo: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as NotebookPage;
}

const RELATIVE_TIMES = ['3m', '22m', '1h', '4h', '9h', '1d', '2d', '4d', '1w', '3w', '6w'];

const INITIAL_PAGES: NotebookPage[] = [
  mockPage({
    id: 'p1',
    title: 'Rekomendacje dla klienta ELKOMTECH — model cenowy Q4',
    pinned: true,
    status: 'active',
    tags: ['strategia', 'cennik'],
    convertedTo: [{ type: 'task', id: 't1' }],
  }),
  mockPage({ id: 'p2', title: 'Krótka myśl', icon: '💡', pinned: true, status: 'active' }),
  mockPage({
    id: 'p3',
    title: 'Materiały ze spotkania zarządu',
    status: 'inbox',
    tags: ['zarzad'],
  }),
  mockPage({
    id: 'p4',
    title: 'Analiza konkurencji DACH',
    status: 'active',
    verificationStatus: 'verified',
    maturity: 'actionable',
  }),
  mockPage({
    id: 'p5',
    title: 'Notatka do przeglądu — dane rynkowe',
    status: 'active',
    staleAt: '2026-08-01T00:00:00.000Z',
  }),
  mockPage({
    id: 'p6',
    title: 'Wgrany plik — RODO checklist.pdf',
    status: 'active',
    captureSource: 'upload',
  }),
  mockPage({ id: 'p7', title: 'Osierocona notatka bez powiązań', status: 'active' }),
  mockPage({ id: 'p8', title: 'Draft prezentacji dla rady nadzorczej', status: 'archived' }),
  mockPage({
    id: 'p9',
    title: 'Pomysł: automatyzacja onboardingu',
    icon: '🚀',
    status: 'inbox',
    tags: ['produkt'],
  }),
];

export default function NotatnikHeaderFiltrScreen(): React.ReactElement {
  const [pages] = useState<NotebookPage[]>(INITIAL_PAGES);
  const [activeId, setActiveId] = useState<string>('p4');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewLens, setViewLens] = useState<NotebookViewLens>('all');

  // Harness stand-in for the real "orphaned" check (async link_graph_edges
  // lookup in NotebookContent.tsx) — p7 is the only mock page tagged
  // orphaned here. Everything else below is the REAL, unchanged predicate
  // module (`notebookViewLensPredicates.ts`, DEC-405b).
  const isOrphanedPage = (p: NotebookPage) => p.id === 'p7';

  const searched = pages.filter((p) =>
    searchQuery.trim() ? p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) : true
  );
  const filteredPages = searched.filter((p) => matchesView(p, viewLens, isOrphanedPage));

  const viewCounts = {
    all: searched.length,
    pinned: searched.filter((p) => p.pinned).length,
    recent: searched.filter(isRecentPage).length,
    toReview: searched.filter(isToReviewPage).length,
    fresh: searched.filter(isFreshPage).length,
    orphaned: searched.filter(isOrphanedPage).length,
  };

  return (
    // ConvertToOutputMenu (embedded inside the kebab, unchanged production
    // component) calls useNavigate() unconditionally — it needs a Router
    // context even though this harness never actually navigates anywhere.
    <MemoryRouter initialEntries={['/notebook']}>
      <div className="flex h-full w-full items-start justify-center bg-c-bg p-8">
        <div
          className="w-80 shrink-0 rounded-2xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden bg-c-surface flex flex-col"
          style={{ maxHeight: 560 }}
          data-dev-render-chrome-root="true"
        >
          {/* Sidebar header — REAL <NotebookHeaderActions>, same nesting
              (overflow-hidden ancestor with the header as the very first
              child) as `NotebookContent.tsx` so tooltip clipping is
              reproducible here exactly as in production. */}
          <div className="px-4 py-3 border-b border-c-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <NotebookHeaderActions
                  onBack={() => {}}
                  onNewPage={() => {}}
                  onSearchAllNotebooks={() => {}}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-c-text truncate">Notatnik</div>
                  <div className="text-[10px] text-c-text-secondary">
                    {filteredPages.length} stron
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DEC-405b — jedna linia: pole „Szukaj w notatkach…” + jeden filtr
              rozwijany z licznikami (chipy Wszystkie/Przypięte/Ostatnie/Do
              przeglądu/Świeże/Osierocone usunięte z osobnego rzędu). */}
          <div className="px-3 pt-2.5 pb-2.5 border-b border-c-border-subtle">
            <NotebookViewFilterSelect
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              value={viewLens}
              onChange={setViewLens}
              counts={viewCounts}
            />
          </div>

          <div className="flex-1 overflow-y-auto nb-scroll p-2 space-y-1">
            {filteredPages.map((p, i) => (
              <NotebookPageListRow
                key={p.id}
                page={p}
                isActive={p.id === activeId}
                timeAgo={RELATIVE_TIMES[i % RELATIVE_TIMES.length]}
                onSelect={() => setActiveId(p.id)}
                onTogglePin={() => {}}
                onStartWorking={() => {}}
                onArchive={() => {}}
                onConvertComplete={() => {}}
              />
            ))}
            {filteredPages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-xs text-c-text-muted">
                Brak notatek dla tego filtra
              </div>
            )}
          </div>
        </div>
      </div>
    </MemoryRouter>
  );
}
