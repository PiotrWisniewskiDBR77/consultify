/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplatesTabContent } from '../../../src/components/ReportsAndPresentations/TemplatesTabContent';

const navigateMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/components/shared/ModuleHub', () => ({
  GridView: ({ items, onItemAction }: any) => (
    <div>
      {items.map((item: any) => (
        <button key={item.id} onClick={() => onItemAction('open', item)}>
          Use {item.name}
        </button>
      ))}
    </div>
  ),
}));

const templates = [
  {
    id: 'deck row/201',
    artifactIndexId: 'deck index/201',
    title: 'Presentation 201',
    type: 'presentation',
    category: 'R2',
    scope: 'organization',
    status: 'active',
  },
  {
    id: 'report-row-201',
    artifactIndexId: 'report-index-201',
    title: 'Report 201',
    type: 'report',
    category: 'R1',
    scope: 'organization',
    status: 'active',
  },
] as any;

function renderContent() {
  return render(
    <TemplatesTabContent
      viewMode="grid"
      searchQuery=""
      activeFilters={[]}
      onFilterChange={() => {}}
      templates={templates}
      loading={false}
    />
  );
}

describe('TemplatesTabContent presentation brief modal', () => {
  beforeEach(() => navigateMock.mockClear());

  it('opens before presentation navigation and Next appends the encoded brief', () => {
    renderContent();
    fireEvent.click(screen.getByRole('button', { name: 'Use Presentation 201' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  Margin 18% on 22 September  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/prezentacje?templateArtifactId=deck%20index%2F201&templatePrompt=Margin%2018%25%20on%2022%20September'
    );
  });

  it('Skip preserves the previous presentation template path', () => {
    renderContent();
    fireEvent.click(screen.getByRole('button', { name: 'Use Presentation 201' }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/prezentacje?templateArtifactId=deck%20index%2F201'
    );
  });

  it('report templates navigate immediately without the modal', () => {
    renderContent();
    fireEvent.click(screen.getByRole('button', { name: 'Use Report 201' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/wordy?templateArtifactId=report-index-201');
  });
});
