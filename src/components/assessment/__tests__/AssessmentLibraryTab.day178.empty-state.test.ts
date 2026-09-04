import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AssessmentLibraryTab } from '../library/AssessmentLibraryTab';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'pl' } }),
}));

vi.mock('@/components/standard', () => ({
  StandardPreview: () => null,
  StandardTable: ({ empty }: any) =>
    React.createElement(
      'section',
      { 'aria-label': 'assessment-library-empty-state' },
      React.createElement('h2', null, empty.title),
      React.createElement('p', null, empty.description)
    ),
}));

describe('AssessmentLibraryTab day178 empty-state render contract', () => {
  it('describes an empty static catalog without claiming a load failure', () => {
    render(React.createElement(AssessmentLibraryTab));

    expect(
      screen.getByRole('heading', { name: 'Brak dostępnych metodyk oceny' })
    ).toBeInTheDocument();
    expect(screen.getByText('Katalog metodyk jest pusty.')).toBeInTheDocument();
    expect(
      screen.queryByText('The methodology catalog could not be loaded.')
    ).not.toBeInTheDocument();
  });
});
