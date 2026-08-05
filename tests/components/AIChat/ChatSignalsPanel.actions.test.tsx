import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M01-012 — dwie wady wiersza sygnału w panelu czatu:
 *  1. `limit=50` w zapytaniu vs `slice(0, 12)` w renderze = ciche gubienie 38 sygnałów;
 *  2. pięć zawsze widocznych przycisków w każdym wierszu = brak hierarchii akcji.
 * Ten plik pilnuje obu napraw naraz.
 */

const apiGet = vi.fn();
const apiPost = vi.fn();
const createMyIdea = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('react-i18next', () => {
  // `t` MUSI mieć stabilną tożsamość: panel trzyma `refresh` w useCallback([t, projectId])
  // i odpala je z useEffect. Nowa funkcja `t` przy każdym renderze = ponowny fetch
  // po każdej zmianie stanu (i cofnięcie skutków drzemki/odrzucenia w teście).
  //
  // `t(key, fallback, options)` — the count label calls this 3-arg form with
  // `options = { count }`; a mock that ignores the 3rd arg would render the
  // raw `'{{count}} signals'` template forever, which happens to hide a
  // header-total regression instead of catching it. Interpolate for real.
  const t = (_key: string, fallback?: any, options?: Record<string, unknown>) => {
    const template = typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);
    const interpolationOptions =
      options && typeof options === 'object'
        ? options
        : fallback && typeof fallback === 'object'
          ? fallback
          : undefined;
    if (!interpolationOptions) return template;
    return String(template).replace(/\{\{(\w+)\}\}/g, (_m, name) =>
      Object.prototype.hasOwnProperty.call(interpolationOptions, name)
        ? String((interpolationOptions as Record<string, unknown>)[name])
        : _m
    );
  };
  return {
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({ t }),
  };
});

vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: any[]) => apiGet(...args),
    post: (...args: any[]) => apiPost(...args),
    createMyIdea: (...args: any[]) => createMyIdea(...args),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

import { ChatSignalsPanel } from '@/components/AIChat/ChatSignalsPanel';

const makeSignals = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    key: `sig-${i + 1}`,
    type: `TYPE_${i + 1}`,
    title: `Signal ${i + 1}`,
    body: `Body of signal ${i + 1}`,
    projectName: 'DBR77',
  }));

const renderPanel = async (count: number) => {
  apiGet.mockResolvedValue({ signals: makeSignals(count), mutedTypes: [] });
  render(<ChatSignalsPanel open onClose={vi.fn()} projectId="proj-1" />);
  await waitFor(() =>
    expect(screen.getAllByTestId('chat-signal-primary-action').length).toBeGreaterThan(0)
  );
};

describe('ChatSignalsPanel — truncation and action hierarchy (M01-012)', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    createMyIdea.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
    apiPost.mockResolvedValue({});
    createMyIdea.mockResolvedValue({});
  });

  it('shows 12 signals initially and reveals the rest through the show-more control', async () => {
    await renderPanel(20);

    expect(screen.getAllByTestId('chat-signal-primary-action')).toHaveLength(12);
    expect(screen.queryByText('Signal 13')).toBeNull();

    const showMore = screen.getByTestId('chat-signals-show-more');
    // Kontrolka MUSI powiedzieć, ile jeszcze zostało — inaczej to nadal ciche obcinanie.
    expect(showMore.textContent).toContain('(8)');

    fireEvent.click(showMore);

    expect(screen.getAllByTestId('chat-signal-primary-action')).toHaveLength(20);
    expect(screen.getByText('Signal 20')).toBeTruthy();
    expect(screen.getByTestId('chat-signals-show-more').textContent).toContain('Show fewer');
  });

  /**
   * M01-P03 negative control (b) — the header count MUST report the true
   * total (`allSignals.length`), not the length of the truncated/visible
   * slice. Before the M01-012 fix the header read
   * `t('aiChat.signals.count', ..., { count: visibleSignals.length })`, so
   * with 20 signals fetched and 12 shown the header silently said "12
   * signals" even though 8 more existed — exactly the class of silent
   * truncation this packet forbids. This test fails if that regresses.
   */
  it('reports the TRUE total in the header, not the truncated visible-slice length', async () => {
    await renderPanel(20);

    expect(screen.getByTestId('chat-signals-count').textContent).toContain('20');
    expect(screen.getByTestId('chat-signals-count').textContent).not.toContain('12 signals');

    // Collapsing back to 12 visible rows must not change the reported total.
    fireEvent.click(screen.getByTestId('chat-signals-show-more'));
    fireEvent.click(screen.getByTestId('chat-signals-show-more'));
    expect(screen.getAllByTestId('chat-signal-primary-action')).toHaveLength(12);
    expect(screen.getByTestId('chat-signals-count').textContent).toContain('20');
  });

  /**
   * M01-P03 — honest empty-body state. A signal with no `body` used to print
   * a fabricated "No details" line styled exactly like real content on
   * EVERY such row, which the packet's contract explicitly bans ("zakaz
   * atrapowego `No details`"). The honest fix omits the line entirely for a
   * signal with no body — no manufactured claim about an absent field.
   */
  it('does not fabricate a "No details" line for a signal with no body', async () => {
    apiGet.mockResolvedValue({
      signals: [
        { key: 'sig-1', type: 'TYPE_1', title: 'Signal with no body', body: '', projectName: 'DBR77' },
      ],
      mutedTypes: [],
    });
    render(<ChatSignalsPanel open onClose={vi.fn()} projectId="proj-1" />);
    await waitFor(() =>
      expect(screen.getAllByTestId('chat-signal-primary-action').length).toBeGreaterThan(0)
    );

    expect(screen.getByText('Signal with no body')).toBeInTheDocument();
    expect(screen.queryByText('No details')).toBeNull();
  });

  /**
   * M01-P03 — honest failure state (CANON §4.1: no silent fail). A failed
   * fetch used to leave the panel in the SAME visual state as a genuine
   * empty result ("No signals right now."), with only a toast (which fades)
   * telling the truth. This asserts a distinct, persistent error state with
   * a retry affordance.
   */
  it('shows a distinct error state (not the empty state) when the fetch fails', async () => {
    apiGet.mockRejectedValue(Object.assign(new Error('Request failed'), { status: 500 }));
    render(<ChatSignalsPanel open onClose={vi.fn()} projectId="proj-1" />);

    await waitFor(() => expect(screen.getByTestId('chat-signals-error')).toBeInTheDocument());
    expect(screen.queryByTestId('chat-signals-empty')).toBeNull();
  });

  it('shows a distinct forbidden state on 401/403, not the empty state', async () => {
    apiGet.mockRejectedValue(Object.assign(new Error('Forbidden'), { status: 403 }));
    render(<ChatSignalsPanel open onClose={vi.fn()} projectId="proj-1" />);

    await waitFor(() => expect(screen.getByTestId('chat-signals-forbidden')).toBeInTheDocument());
    expect(screen.queryByTestId('chat-signals-empty')).toBeNull();
    expect(screen.queryByTestId('chat-signals-error')).toBeNull();
  });

  it('does not render the show-more control when everything already fits', async () => {
    await renderPanel(5);

    expect(screen.getAllByTestId('chat-signal-primary-action')).toHaveLength(5);
    expect(screen.queryByTestId('chat-signals-show-more')).toBeNull();
  });

  it('renders exactly one visible primary action per row, with the rest behind a kebab', async () => {
    await renderPanel(3);

    const primaries = screen.getAllByTestId('chat-signal-primary-action');
    const menus = screen.getAllByTestId('chat-signal-actions-menu');
    expect(primaries).toHaveLength(3);
    expect(menus).toHaveLength(3);
    primaries.forEach((btn) => expect(btn.textContent).toContain('Save to Notebook'));

    // Akcje drugoplanowe nie mogą być widoczne zanim ktoś otworzy kebab.
    expect(screen.queryByText('Save to My Ideas')).toBeNull();
    expect(screen.queryByText('Snooze')).toBeNull();
    expect(screen.queryByText('Mute type')).toBeNull();
    expect(screen.queryByText('Dismiss')).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('invokes the primary action handler', async () => {
    await renderPanel(1);

    fireEvent.click(screen.getAllByTestId('chat-signal-primary-action')[0]);

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/my-work/notebook/pages', expect.any(Object))
    );
  });

  it('keeps every secondary action reachable through the menu and still firing its handler', async () => {
    await renderPanel(3);

    // 1) Save to My Ideas (nie usuwa wiersza)
    fireEvent.click(screen.getAllByTestId('chat-signal-actions-menu')[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save to My Ideas' }));
    await waitFor(() => expect(createMyIdea).toHaveBeenCalledTimes(1));
    expect(createMyIdea.mock.calls[0][0]).toMatchObject({
      title: 'Signal 1',
      sourceType: 'signal',
    });

    // 2) Snooze (usuwa wiersz sig-1)
    fireEvent.click(screen.getAllByTestId('chat-signal-actions-menu')[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Snooze' }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/my-work/signals/sig-1/snooze', { preset: '1h' })
    );
    await waitFor(() => expect(screen.queryByText('Signal 1')).toBeNull());

    // 3) Mute type (usuwa wiersz sig-2 po typie)
    fireEvent.click(screen.getAllByTestId('chat-signal-actions-menu')[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mute type' }));
    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/my-work/signals/mute-type', { type: 'TYPE_2' })
    );
    await waitFor(() => expect(screen.queryByText('Signal 2')).toBeNull());

    // 4) Dismiss (akcja destrukcyjna — wizualnie wyróżniona w menu)
    fireEvent.click(screen.getAllByTestId('chat-signal-actions-menu')[0]);
    const dismiss = screen.getByRole('menuitem', { name: 'Dismiss' });
    expect(dismiss.className).toContain('text-c-danger');
    fireEvent.click(dismiss);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/my-work/signals/sig-3/dismiss', {}));
  });

  it('opens the menu with Enter, closes it with Escape and returns focus to the trigger', async () => {
    await renderPanel(1);

    const trigger = screen.getAllByTestId('chat-signal-actions-menu')[0] as HTMLButtonElement;
    trigger.focus();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(screen.getByRole('menu')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    // Fokus wchodzi w menu, żeby klawiatura nie została na zewnątrz.
    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('opens the menu with Space as well', async () => {
    await renderPanel(1);

    const trigger = screen.getAllByTestId('chat-signal-actions-menu')[0] as HTMLButtonElement;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: ' ' });

    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
