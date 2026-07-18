/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const docsHooks = vi.hoisted(() => ({
  useDocsCategories: vi.fn(() => ({ data: [], isLoading: false })),
  useDocsFeatured: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'pl' },
  }),
}));

vi.mock('../../../src/hooks/useDocs', () => ({
  useDocsCategories: (...args: any[]) => docsHooks.useDocsCategories(...args),
  useDocsFeatured: (...args: any[]) => docsHooks.useDocsFeatured(...args),
}));

import { DocsHomeView } from '../../../src/views/docs/DocsHomeView';

describe('DocsHomeView locale wiring', () => {
  it('uses the active i18n language for docs categories and featured articles', () => {
    render(
      <MemoryRouter>
        <DocsHomeView />
      </MemoryRouter>
    );

    expect(docsHooks.useDocsCategories).toHaveBeenCalledWith('pl');
    expect(docsHooks.useDocsFeatured).toHaveBeenCalledWith('pl', 6);
    expect(screen.getByText('Consultify Documentation')).toBeInTheDocument();
    expect(screen.getByText('Get help your way')).toBeInTheDocument();
    expect(screen.getByText('Ask Teresa for guided help')).toBeInTheDocument();
    expect(screen.getByText('Consulting journey')).toBeInTheDocument();
    expect(screen.getByText('Support surfaces')).toBeInTheDocument();
    expect(screen.getByText('Where Help ends and Education begins')).toBeInTheDocument();
    expect(screen.getByText('Canonical learning-path model')).toBeInTheDocument();
    expect(screen.getByText('Inside Help / Knowledge Base')).toBeInTheDocument();
    expect(screen.getByText('Inside standalone Education / Academy')).toBeInTheDocument();
  });
});
