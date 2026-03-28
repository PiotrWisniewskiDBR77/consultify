/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../src/i18n';
import { AboutView } from '../../src/views/legal/AboutView';

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
      <AboutView />
    </I18nextProvider>,
  );
}

describe('AboutView CTA authority', () => {
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

  it('preserves demo/trial CTA routes and exposes Anna on the page', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Explore Demo' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Start Free Trial' })[0]);

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/demo');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/trial/start');
  });
});
