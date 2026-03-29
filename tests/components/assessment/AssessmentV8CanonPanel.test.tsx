/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import i18n from '../../../src/i18n';
import { AssessmentV8CanonPanel } from '../../../src/components/assessment/AssessmentV8CanonPanel';

function renderView(mode: 'catalog' | 'session') {
  return render(
    <I18nextProvider i18n={i18n}>
      <AssessmentV8CanonPanel mode={mode} compact={mode === 'session'} />
    </I18nextProvider>,
  );
}

describe('AssessmentV8CanonPanel', () => {
  it('renders the shared assessment family narrative on the public surface', () => {
    renderView('catalog');

    expect(screen.getByText('One assessment family with one shared workbench')).toBeInTheDocument();
    expect(screen.getByText('Choose the right methodology')).toBeInTheDocument();
    expect(
      screen.getByText('AI assists interpretation without pretending to replace method authority.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
  });

  it('renders the governed workbench runtime inside assessment sessions', () => {
    renderView('session');

    expect(screen.getByText('This assessment runs inside the shared workbench model')).toBeInTheDocument();
    expect(screen.getByText('What stays governed here')).toBeInTheDocument();
    expect(
      screen.getByText('Downstream actions stay linked to this assessment session.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Assessment bridge')).toBeInTheDocument();
  });
});
