/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
import { ResourcesPage } from '../../src/views/ResourcesPage';

const navigateMock = vi.fn();
const demoModalSpy = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: null,
    setCurrentView: vi.fn(),
    setSessionMode: vi.fn(),
    setCurrentUser: vi.fn(),
    setDemoMode: vi.fn(),
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../src/components/Landing/DemoModeModal', () => ({
  DemoModeModal: (props: any) => {
    demoModalSpy(props);
    return props.isOpen ? <div data-testid="demo-mode-modal">{props.mode}</div> : null;
  },
}));

vi.mock('../../src/components/Landing/FullVideoModal', () => ({
  FullVideoModal: () => null,
}));

function renderView() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ResourcesPage />
    </I18nextProvider>,
  );
}

describe('ResourcesPage CTA authority', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    demoModalSpy.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: () => 'anna-session-id' },
    });
  });

  it('routes topbar demo and trial through the shared modal contract and exposes Anna on the page', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    expect(screen.getByTestId('demo-mode-modal')).toHaveTextContent('trial');

    fireEvent.click(screen.getByRole('button', { name: 'Try demo' }));
    expect(screen.getByTestId('demo-mode-modal')).toHaveTextContent('demo');
  });
});
