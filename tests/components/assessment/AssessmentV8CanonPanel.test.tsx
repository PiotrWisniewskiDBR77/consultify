/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
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
