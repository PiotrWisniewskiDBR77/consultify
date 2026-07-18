/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

import { DocsApiReferenceView } from '../../../src/views/docs/DocsApiReferenceView';

describe('DocsApiReferenceView placeholder', () => {
  it('shows an honest placeholder instead of a fake live api explorer', () => {
    render(
      <MemoryRouter>
        <DocsApiReferenceView />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'API Reference' })).toBeInTheDocument();
    expect(screen.getByText('Interactive API reference is not published yet.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Do not treat this page as an authoritative endpoint catalog. Use product docs and shipped integrations until the real API reference is available.'
      )
    ).toBeInTheDocument();
  });
});
