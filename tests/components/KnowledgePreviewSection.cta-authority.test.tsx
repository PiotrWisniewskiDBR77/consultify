/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../src/i18n';
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
        category_slug: 'ops',
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

    expect(navigateMock).toHaveBeenCalledWith('/knowledge-base/ops/preview-one');
  });

  it('navigates to the knowledge base listing when clicking Access Full Knowledge Base', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /Access Full Knowledge Base/i }));

    expect(navigateMock).toHaveBeenCalledWith('/knowledge-base');
  });
});
