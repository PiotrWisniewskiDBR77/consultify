import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const appStore = vi.hoisted(() => ({
  isChatCollapsed: true,
  toggleChatCollapse: vi.fn(() => {
    appStore.isChatCollapsed = !appStore.isChatCollapsed;
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (state: typeof appStore) => unknown) => selector(appStore),
}));

import { resetJedenPanelForTests, useJedenPanel } from '../useJedenPanel';

const wrapperAt = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe('useJedenPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetJedenPanelForTests();
    appStore.isChatCollapsed = true;
    appStore.toggleChatCollapse.mockClear();
  });

  afterEach(() => resetJedenPanelForTests());

  it('pamięta świadome zamknięcie osobno dla każdego modułu', () => {
    const myWork = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/my-work') });

    act(() => myWork.result.current.zamknij());

    expect(myWork.result.current.zamkniety).toBe(true);
    expect(localStorage.getItem('consultify.listPanel.my-work.closed')).toBe('1');
    expect(localStorage.getItem('consultify.listPanel.assessment.closed')).toBeNull();

    const assessment = renderHook(() => useJedenPanel(), {
      wrapper: wrapperAt('/assessment'),
    });
    expect(assessment.result.current.zamkniety).toBe(false);
  });

  it('traktuje zmianę globalnego czatu jako zdarzenie, nie stan początkowy', () => {
    appStore.isChatCollapsed = false;
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/interview') });

    expect(panel.result.current.zakladka).toBe('rekord');

    appStore.isChatCollapsed = true;
    panel.rerender();
    expect(panel.result.current.zakladka).toBe('rekord');

    appStore.isChatCollapsed = false;
    panel.rerender();
    expect(panel.result.current.zakladka).toBe('teresa');
    expect(panel.result.current.zamkniety).toBe(false);
  });

  it('współdzieli stan między panelem i Menu 3', () => {
    const panel = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/finance/reports') });
    const menu = renderHook(() => useJedenPanel(), { wrapper: wrapperAt('/finance/reports') });

    act(() => menu.result.current.otworzTerese());

    expect(panel.result.current.zakladka).toBe('teresa');
    expect(panel.result.current.zamkniety).toBe(false);
  });
});
