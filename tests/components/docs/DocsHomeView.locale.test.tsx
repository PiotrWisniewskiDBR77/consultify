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
    t: (_key: string, fallback?: string) => fallback || _key,
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
  });
});
