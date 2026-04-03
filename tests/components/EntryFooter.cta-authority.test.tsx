/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EntryFooter } from '../../src/components/Landing/EntryFooter';
import i18n from '../../src/i18n';

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

    expect(screen.getByRole('link', { name: /Privacy Policy/i })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('link', { name: /Cookie Policy/i })).toHaveAttribute('href', '/cookies');
    expect(screen.getByRole('link', { name: /Security Overview/i })).toHaveAttribute('href', '/security');
  });
});
