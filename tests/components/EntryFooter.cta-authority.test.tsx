/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryFooter } from '../../src/components/Landing/EntryFooter';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
function renderFooter(props?: Partial<React.ComponentProps<typeof EntryFooter>>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <EntryFooter {...props} />
    </I18nextProvider>,
  );
}

describe('EntryFooter navigation structure', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all product links matching dbr77.com footer', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: /Industrial IoT/i })).toHaveAttribute('href', 'https://iot.dbr77.com');
    expect(screen.getByRole('link', { name: /Digital Twin/i })).toHaveAttribute('href', 'https://dt.dbr77.com');
    expect(screen.getByRole('link', { name: /^IRIS/i })).toHaveAttribute('href', 'https://iris.dbr77.com');
    expect(screen.getByRole('link', { name: /^Marketplace/i })).toHaveAttribute('href', 'https://marketplace.dbr77.com/marketplace');
    expect(screen.getByRole('link', { name: /^Consultify$/i })).toHaveAttribute('href', '/');
  });

  it('renders Become Partner CTA', () => {
    renderFooter();

    const partnerLink = screen.getByRole('link', { name: /Become Partner/i });
    expect(partnerLink).toHaveAttribute('href', '/become-partner');
  });

  it('renders legal links in the bottom strip', () => {
    renderFooter();

    expect(screen.getByRole('link', { name: /Privacy Policy/i })).toHaveAttribute('href', '/legal/privacy');
    expect(screen.getByRole('link', { name: /Cookie Policy/i })).toHaveAttribute('href', '/legal/cookies');
    expect(screen.getByRole('link', { name: /Security Overview/i })).toHaveAttribute('href', '/legal/security');
  });
});
