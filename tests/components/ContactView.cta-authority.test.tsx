/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../src/i18n';
import { ContactView } from '../../src/views/legal/ContactView';

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
      <ContactView />
    </I18nextProvider>,
  );
}

describe('ContactView CTA authority', () => {
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
  });

  it('preserves topbar demo/trial routes and exposes Anna on the page', () => {
    renderView();

    expect(screen.getByRole('button', { name: 'Ask Anna first' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Start trial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Watch demo' }));

    expect(navigateMock).toHaveBeenNthCalledWith(1, '/trial/start');
    expect(navigateMock).toHaveBeenNthCalledWith(2, '/demo');
  });
});
