/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it } from 'vitest';

import { AIOsProductMapSection } from '../../../src/components/Landing/AIOsProductMapSection';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
describe('AIOsProductMapSection messaging', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('packages the AI family as one governed operating environment', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <AIOsProductMapSection />
      </I18nextProvider>
    );

    expect(screen.getByText('AI operating system')).toBeInTheDocument();
    expect(
      screen.getByText(
        'One AI system for assistants, prompts, agents, knowledge, and artifact-native work.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Consultify packages strong AI architecture as a visible operating environment: guided assistants, governed prompts, multi-step agents, policy-aware knowledge, and outputs that continue beyond chat.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Prompt OS')).toBeInTheDocument();
    expect(screen.getByText('Knowledge')).toBeInTheDocument();
    expect(screen.getByText('Outputs')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The point is not more AI surfaces. The point is one coherent, governed AI operating environment across chat, execution, knowledge, and outputs.'
      )
    ).toBeInTheDocument();
  });
});
