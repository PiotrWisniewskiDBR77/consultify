/**
 * ZLECENIE 1.1-J (przejście właściciela 06.09, Notatnik → lewa lista "Moje
 * notatki"). Mounts the REAL production row component
 * (`NotebookPageListRow`, src/components/MyWork/notebook/) against a mock
 * page array — no Api/fetch, no login — so the supervisor can screenshot the
 * fixed row shape BEFORE the owner ever sees it (CLAUDE.md #7).
 *
 * Owner's own words: "wszystkie tytuły notatek w jednej linii, bez opisów
 * pod spodem, i pionowy kebab — wtedy będziemy mieli porządek."
 *
 * URL params: &theme=light|dark (harness default handles this already).
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { NotebookPageListRow } from '../../src/components/MyWork/notebook/NotebookPageListRow';
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
    summary: 'Opis, który dawniej zajmował drugą linię wiersza — teraz widoczny tylko w panelu.',
    convertedTo: [{ type: 'task', id: 't1' }],
  }),
  mockPage({
    id: 'p2',
    title: 'Krótka myśl',
    icon: '💡',
    pinned: true,
    status: 'active',
  }),
  mockPage({
    id: 'p3',
    title: 'Materiały ze spotkania zarządu — bardzo długi tytuł, który musi się ucinać elipsą zamiast zawijać wiersz na dwie linie',
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
  mockPage({
    id: 'p7',
    title: 'Osierocona notatka bez powiązań',
    status: 'active',
  }),
  mockPage({
    id: 'p8',
    title: 'Draft prezentacji dla rady nadzorczej',
    status: 'archived',
  }),
  mockPage({
    id: 'p9',
    title: 'Pomysł: automatyzacja onboardingu',
    icon: '🚀',
    status: 'inbox',
    tags: ['produkt', 'automatyzacja', 'onboarding'],
  }),
  mockPage({
    id: 'p10',
    title: 'Notatka z warsztatu strategicznego',
    status: 'active',
  }),
  mockPage({
    id: 'p11',
    title: 'Podsumowanie tygodnia',
    status: 'converted',
    convertedTo: [{ type: 'report', id: 'r1' }],
  }),
];

export default function NotatnikListaScreen(): React.ReactElement {
  const [pages, setPages] = useState<NotebookPage[]>(INITIAL_PAGES);
  const [activeId, setActiveId] = useState<string>('p4');

  const togglePin = (id: string) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
  const archive = (id: string) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'archived' } : p)));
  const startWorking = (id: string) =>
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'active' } : p)));

  return (
    // ConvertToOutputMenu (embedded inside the kebab, unchanged production
    // component) calls useNavigate() unconditionally — it needs a Router
    // context even though this harness never actually navigates anywhere.
    <MemoryRouter initialEntries={['/notebook']}>
      <div className="flex h-full w-full items-start justify-center bg-c-bg p-8">
        <div className="w-80 shrink-0 rounded-2xl border border-c-border-subtle bg-c-surface p-2 shadow-sm">
          <h1
            className="mb-2 px-2 pt-1 text-sm font-semibold text-c-text"
            data-dev-render-chrome="true"
          >
            Notatnik — „Moje notatki" (1.1-J)
          </h1>
          <div className="flex flex-col gap-1">
            {pages.map((p, i) => (
              <NotebookPageListRow
                key={p.id}
                page={p}
                isActive={p.id === activeId}
                timeAgo={RELATIVE_TIMES[i % RELATIVE_TIMES.length]}
                onSelect={() => setActiveId(p.id)}
                onTogglePin={() => togglePin(p.id)}
                onStartWorking={() => startWorking(p.id)}
                onArchive={() => archive(p.id)}
                onConvertComplete={() => {}}
              />
            ))}
          </div>
        </div>
      </div>
    </MemoryRouter>
  );
}
