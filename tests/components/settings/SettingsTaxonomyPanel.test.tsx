/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsTaxonomyPanel } from '../../../src/components/settings/SettingsTaxonomyPanel';

const TAXONOMY_COPY: Record<string, string> = {
  'settings.taxonomy.title': 'One settings root with clear ownership',
  'settings.taxonomy.scopes.personal.title': 'Personal settings',
  'settings.taxonomy.scopes.tenant.title': 'Tenant handoff',
  'settings.taxonomy.impactTitle': 'Runtime-impact controls',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => TAXONOMY_COPY[key] ?? fallback ?? key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

describe('SettingsTaxonomyPanel', () => {
  it('renders the canonical settings scopes and runtime impact controls', () => {
    render(<SettingsTaxonomyPanel compact />);

    expect(screen.getByText('One settings root with clear ownership')).toBeInTheDocument();
    expect(screen.getByText('Personal settings')).toBeInTheDocument();
    expect(screen.getByText('Tenant handoff')).toBeInTheDocument();
    expect(screen.getByText('Runtime-impact controls')).toBeInTheDocument();
  });
});
