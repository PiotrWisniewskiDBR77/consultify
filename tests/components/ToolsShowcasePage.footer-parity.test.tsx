/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it, vi } from 'vitest';

import i18n from '../../src/i18n';
import { ToolsShowcasePage } from '../../src/views/ToolsShowcasePage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: null,
    theme: 'dark',
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../src/components/Education/ToolVideoModal', () => ({
  ToolVideoModal: () => null,
}));

function renderView() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ToolsShowcasePage />
    </I18nextProvider>,
  );
}

describe('ToolsShowcasePage footer parity', () => {
  it('uses the shared landing footer contract', () => {
    renderView();

    expect(screen.getByText('Become a Consultify Partner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Become Partner' })).toHaveAttribute(
      'href',
      '/become-partner',
    );
  });
});
