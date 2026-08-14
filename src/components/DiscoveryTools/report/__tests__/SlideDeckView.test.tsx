import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { approve, submitForReview } from '@/toolOutputs/outputLifecycle';
import { renderToolReport } from '@/toolOutputs/renderReport';
import type { ReportBlock, ToolOutput } from '@/toolOutputs/types';

import SlideDeckView from '../SlideDeckView';

function makeOutput(overrides: Partial<ToolOutput> = {}): ToolOutput {
  const base: ToolOutput = {
    id: 'out-1',
    organizationId: 'org-1',
    toolSessionId: 'sess-1',
    toolType: 'dynamic-swot',
    methodPackVersion: '1.0.0',
    version: 1,
    title: 'SWOT — wejście na rynek DACH',
    status: 'draft',
    items: [
      { id: 'i1', label: 'Silny zespół wdrożeniowy', bucket: 'strengths', evidenceKind: 'fact', impact: 'high' },
      { id: 'i2', label: 'Rosnący popyt w DACH', bucket: 'opportunities', evidenceKind: 'observation', impact: 'medium' },
    ],
    tensions: [
      { id: 't1', posture: 'attack', title: 'Zespół × popyt', sourceItemIds: ['i1', 'i2'], priority: 5 },
    ],
    conclusions: [
      {
        id: 'c1',
        k1Fact: 'Popyt w DACH rośnie 3 kwartały z rzędu.',
        k2Meaning: 'Przewaga wdrożeniowa jest niewykorzystana.',
        k3Actions: ['Uruchomić pilota w DACH'],
        k4Effect: 'Pierwszy klient referencyjny w 6 miesięcy.',
        tradeoff: { chosen: 'Pilot w DACH', rejected: 'Rozwój produktu', why: 'Okno rynkowe zamyka się szybko.' },
        sourceTensionIds: ['t1'],
      },
      {
        id: 'c2',
        k1Fact: 'Czas wdrożenia jest 2x dłuższy niż u konkurencji.',
        k2Meaning: 'Ekspozycja na presję cenową rośnie.',
        k3Actions: ['Zmierzyć czas ostatnich wdrożeń'],
        k4Effect: 'Skrócenie ścieżki wdrożenia o 30%.',
        tradeoff: { chosen: 'Standaryzacja', rejected: 'Nowe funkcje', why: 'Ryzyko cenowe jest pilniejsze.' },
        sourceTensionIds: [],
      },
    ],
    createdAt: '2026-08-13T10:00:00Z',
    contentHash: '',
  };
  return { ...base, ...overrides };
}

function buildDoc(kind: 'report' | 'presentation') {
  const out = approve(submitForReview(makeOutput()), 'user-1', 'now');
  return renderToolReport([out], {
    id: kind === 'report' ? 'rep-1' : 'deck-1',
    organizationId: 'org-1',
    title: 'Wejście na rynek DACH',
    kind,
  });
}

function counterText() {
  return screen.getByTestId('slide-counter').textContent;
}

describe('SlideDeckView — nawigacja klawiaturą', () => {
  it('ArrowRight idzie naprzód, ArrowLeft cofa', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    expect(counterText()).toContain('1 /');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(counterText()).toContain('2 /');

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(counterText()).toContain('1 /');
  });

  it('End idzie na ostatni slajd, Home wraca na pierwszy', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    const total = Number(counterText()?.split('/')[1]?.trim());

    fireEvent.keyDown(window, { key: 'End' });
    expect(counterText()).toBe(`${total} / ${total}`);

    fireEvent.keyDown(window, { key: 'Home' });
    expect(counterText()).toBe(`1 / ${total}`);
  });

  it('granice NIE zawijają się — ArrowLeft na pierwszym slajdzie zostaje na pierwszym', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(counterText()).toContain('1 /');
  });

  it('granice NIE zawijają się — ArrowRight na ostatnim slajdzie zostaje na ostatnim', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    fireEvent.keyDown(window, { key: 'End' });
    const total = counterText();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(counterText()).toBe(total);
  });

  it('Escape wywołuje onExit, gdy nie jest w fullscreenie', () => {
    const doc = buildDoc('report');
    const onExit = vi.fn();
    render(<SlideDeckView doc={doc} onExit={onExit} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('kliknięcie kropki nawigacyjnej skacze bezpośrednio na dany slajd', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    const dots = screen.getAllByLabelText(/Go to slide/i);
    expect(dots.length).toBeGreaterThan(2);
    fireEvent.click(dots[2]);
    expect(counterText()).toContain('3 /');
  });
});

describe('SlideDeckView — fullscreen: fallback bez Fullscreen API', () => {
  it('jsdom nie implementuje requestFullscreen — przycisk fullscreen mimo to nie rzuca i przełącza tryb', () => {
    expect(typeof document.documentElement.requestFullscreen).toBe('undefined');
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    const btn = screen.getByLabelText(/Fullscreen/i);
    expect(() => fireEvent.click(btn)).not.toThrow();
    const stage = screen.getByTestId('slide-deck-view');
    expect(stage).toHaveAttribute('data-fullscreen', 'true');
  });

  it('klawisz F ma ten sam efekt fallbacku co przycisk', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    expect(() => fireEvent.keyDown(window, { key: 'f' })).not.toThrow();
    expect(screen.getByTestId('slide-deck-view')).toHaveAttribute('data-fullscreen', 'true');
  });
});

describe('SlideDeckView — presentationMode ukrywa chrome, NIE treść', () => {
  it('ukrywa pasek tytułu/licznika/nawigacji, ale renderuje te same bloki konkluzji', () => {
    const doc = buildDoc('presentation');

    const { unmount } = render(<SlideDeckView doc={doc} />);
    expect(screen.queryByTestId('slide-counter')).not.toBeNull();
    const normalConclusions = screen
      .getAllByText(/Popyt w DACH rośnie|Czas wdrożenia jest/i)
      .map((el) => el.textContent);
    unmount();

    render(<SlideDeckView doc={doc} presentationMode />);
    expect(screen.queryByTestId('slide-counter')).toBeNull();
    const presentationConclusions = screen
      .getAllByText(/Popyt w DACH rośnie|Czas wdrożenia jest/i)
      .map((el) => el.textContent);

    expect(presentationConclusions).toEqual(normalConclusions);
  });
});

describe('SlideDeckView — druk: jeden slajd na stronę, bez przycięcia', () => {
  it('każdy slajd ma warianty print: wymuszające widoczność i podział strony', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    const pages = screen.getAllByTestId('slide-page');
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page) => {
      expect(page.className).toContain('print:!flex');
      expect(page.className).toContain('print:break-after-page');
    });
    // Ostatni slajd nie dostaje podziału strony PO sobie (nie potrzebuje pustej strony).
    expect(pages[pages.length - 1].className).toContain('last:print:break-after-auto');
  });

  it('WSZYSTKIE slajdy zostają w DOM-ie (nie tylko bieżący) — inaczej podgląd druku pokazałby jeden', () => {
    const doc = buildDoc('report');
    render(<SlideDeckView doc={doc} />);
    const pages = screen.getAllByTestId('slide-page');
    const activePages = pages.filter((p) => p.getAttribute('aria-hidden') === 'false');
    expect(activePages).toHaveLength(1);
    expect(pages.length).toBeGreaterThan(activePages.length);
  });
});

describe('SlideDeckView — zero osobnego stanu treści', () => {
  it('slajdy pochodzą wyłącznie z doc — dwa różne obiekty o tym samym contentHash dają tę samą liczbę slajdów', () => {
    const doc = buildDoc('report');
    const clone: typeof doc = JSON.parse(JSON.stringify(doc));

    const rendered1 = render(<SlideDeckView doc={doc} />);
    const countA = within(rendered1.container).getAllByTestId('slide-page').length;
    rendered1.unmount();

    const rendered2 = render(<SlideDeckView doc={clone} />);
    const countB = within(rendered2.container).getAllByTestId('slide-page').length;
    rendered2.unmount();

    expect(countA).toBe(countB);
    expect(countA).toBeGreaterThan(1);
  });
});
