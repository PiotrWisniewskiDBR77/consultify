/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SettingsTaxonomyPanel } from '../../../src/components/settings/SettingsTaxonomyPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
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
