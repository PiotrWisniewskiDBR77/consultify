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
import { SecurityView } from '../../src/views/legal/SecurityView';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderView() {
  return render(
    <I18nextProvider i18n={i18n}>
      <SecurityView />
    </I18nextProvider>,
  );
}

describe('SecurityView CTA authority', () => {
  beforeEach(() => {
    navigateMock.mockReset();
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
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  });

  it('preserves topbar demo/trial routes and exposes Anna on the page', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Try demo' }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/trial/start');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/demo');
  });
});
