/**
 * @vitest-environment jsdom
 *
 * Odbiór 05.09 (04-narzędzia, defekt 5): 29 „zatwierdzonych" sesji narzędzi
 * (100%, nazwy „MyWork idea: …") otwierało angielski widok awaryjny z surowym
 * JSON-em. Zmierzona przyczyna: to nie są sesje narzędzi, tylko wiersze
 * `tool_sessions` z `tool_type='MYWORK'`, które serwer zapisuje jako ŚLAD
 * POCHODZENIA przy konwersji pomysłu/notatki z Mojej Pracy
 * (server/src/routes/my-work.routes.ts `createMyWorkToolSession`).
 * `MYWORK` nie jest w DEDICATED_TOOL_TYPES → hub spadał na
 * GenericToolDocumentView.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getToolSessionMock } = vi.hoisted(() => ({ getToolSessionMock: vi.fn() }));

vi.mock('@/services/api', () => ({
  Api: { getToolSession: getToolSessionMock },
}));

import {
  MyWorkTraceDocumentView,
  myWorkSourceHref,
  readMyWorkTrace,
} from '@/components/DiscoveryTools/MyWorkTraceDocumentView';

describe('MyWorkTraceDocumentView — czytelny polski stan zamiast JSON-u', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('czyta ślad z realnego kształtu zapisanego przez createMyWorkToolSession', () => {
    const session = {
      id: 's1',
      name: 'MyWork idea: Wejście na rynek DACH — mapa decyzji',
      toolType: 'MYWORK',
      answers: {
        origin: 'MYWORK',
        source: { type: 'idea', id: 'idea-77' },
        summary: 'Skrót pomysłu właściciela.',
      },
      contextSnapshot: { myWork: true, origin: 'MYWORK', source: { type: 'idea', id: 'idea-77' } },
    };
    expect(readMyWorkTrace(session)).toEqual({
      origin: 'MYWORK',
      source: { type: 'idea', id: 'idea-77' },
      summary: 'Skrót pomysłu właściciela.',
    });
    expect(myWorkSourceHref({ type: 'idea', id: 'idea-77' })).toBe('/my-work/ideas/idea-77');
    expect(myWorkSourceHref({ type: 'notebook', id: 'n1' })).toBe('/my-work/notebook');
    expect(myWorkSourceHref({ type: 'idea', id: '' })).toBeNull();
    expect(myWorkSourceHref(null)).toBeNull();
  });

  it('spada na contextSnapshot, gdy answers są puste', () => {
    expect(
      readMyWorkTrace({
        answers: {},
        contextSnapshot: { origin: 'MYWORK', source: { type: 'notebook', id: 'nb-1' } },
      }).source
    ).toEqual({ type: 'notebook', id: 'nb-1' });
  });

  it('rysuje polski ekran śladu z linkiem do źródła, bez surowego JSON-a', async () => {
    getToolSessionMock.mockResolvedValue({
      id: 's1',
      name: 'MyWork idea: Wejście na rynek DACH — mapa decyzji',
      toolType: 'MYWORK',
      answers: {
        origin: 'MYWORK',
        source: { type: 'idea', id: 'idea-77' },
        summary: 'Skrót pomysłu właściciela.',
      },
      contextSnapshot: {},
    });

    render(<MyWorkTraceDocumentView sessionId="s1" onBack={() => {}} />);

    await screen.findByTestId('mywork-trace-document-view');
    expect(screen.getByText(/Ślad pochodzenia · Pomysł/)).toBeInTheDocument();
    expect(screen.getByTestId('mywork-trace-summary')).toHaveTextContent(
      'Skrót pomysłu właściciela.'
    );
    expect(screen.getByTestId('mywork-trace-source-link')).toHaveAttribute(
      'href',
      '/my-work/ideas/idea-77'
    );

    // żadnego angielskiego widoku awaryjnego ani zrzutu JSON-a
    expect(screen.queryByText(/Why you saw the placeholder/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll('pre').length).toBe(0);
  });

  it('bez identyfikatora źródła mówi wprost, że nie ma dokąd przejść', async () => {
    getToolSessionMock.mockResolvedValue({
      id: 's2',
      name: 'MyWork notebook: notatka',
      toolType: 'MYWORK',
      answers: { origin: 'MYWORK', source: null, summary: null },
      contextSnapshot: {},
    });

    render(<MyWorkTraceDocumentView sessionId="s2" onBack={() => {}} />);

    await screen.findByTestId('mywork-trace-document-view');
    expect(screen.queryByTestId('mywork-trace-source-link')).not.toBeInTheDocument();
    expect(screen.getByText(/nie ma dokąd przejść/)).toBeInTheDocument();
  });
});
