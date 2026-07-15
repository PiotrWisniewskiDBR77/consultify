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
import { KnowledgePreviewSection } from '../../src/components/Landing/KnowledgePreviewSection';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../src/hooks/useKnowledge', () => ({
  useKnowledgeFeatured: () => ({
    data: [
      {
        id: 'kb-1',
        slug: 'preview-one',
        title: 'Preview One',
        summary: 'Preview summary',
        reading_time_minutes: 4,
        is_featured: true,
        category_slug: 'consultify-ops',
        category_name: 'Ops',
        category_icon: 'BookOpen',
        view_count: 1,
      },
    ],
    isLoading: false,
  }),
  useKnowledgePublicPreview: () => ({
    data: [],
    isLoading: false,
  }),
}));

function renderSection(props?: Partial<React.ComponentProps<typeof KnowledgePreviewSection>>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <KnowledgePreviewSection {...props} />
    </I18nextProvider>,
  );
}

describe('KnowledgePreviewSection CTA authority', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('navigates to the article page when clicking an article card', () => {
    renderSection();

    fireEvent.click(screen.getByText('Preview One'));

    expect(navigateMock).toHaveBeenCalledWith('/knowledge-base/consultify-ops/preview-one');
  });

  it('navigates to the knowledge base listing when clicking Access Full Knowledge Base', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /Access Full Knowledge Base/i }));

    expect(navigateMock).toHaveBeenCalledWith('/knowledge-base');
  });
});
