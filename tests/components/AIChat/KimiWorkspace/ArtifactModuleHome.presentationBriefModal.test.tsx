/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback || _key,
      i18n: { language: 'en', resolvedLanguage: 'en' },
    }),
  };
});

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleTemplates', () => ({
  useModuleTemplates: () => ({
    templates: [{ id: 'api deck/201', title: 'API Deck 201', description: 'Live API template' }],
    loading: false,
  }),
}));

vi.mock('../../../../src/components/AIChat/KimiWorkspace/useModuleRecentArtifacts', () => ({
  useModuleRecentArtifacts: () => ({ artifacts: [], loading: false, refetch: vi.fn() }),
}));

import ArtifactModuleHome from '../../../../src/components/AIChat/KimiWorkspace/ArtifactModuleHome';

function renderHome(lane: 'prezentacje' | 'excele' | 'tabele' = 'prezentacje') {
  return render(
    <MemoryRouter>
      <ArtifactModuleHome lane={lane} />
    </MemoryRouter>
  );
}

describe('ArtifactModuleHome presentation brief modal', () => {
  beforeEach(() => navigateMock.mockClear());

  it('opens before navigation and Next carries the trimmed encoded brief', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /API Deck 201/i }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  Revenue EUR 3.7m by 22 September  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/prezentacje?templateArtifactId=api%20deck%2F201&templatePrompt=Revenue%20EUR%203.7m%20by%2022%20September'
    );
  });

  it('Skip preserves the previous template-only navigation', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: /API Deck 201/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(navigateMock).toHaveBeenCalledWith(
      '/prezentacje?templateArtifactId=api%20deck%2F201'
    );
  });

  it.each(['excele', 'tabele'] as const)('%s keeps immediate navigation without a modal', (lane) => {
    renderHome(lane);
    fireEvent.click(screen.getByRole('button', { name: /API Deck 201/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith(
      `/${lane}?templateArtifactId=api%20deck%2F201`
    );
  });
});
