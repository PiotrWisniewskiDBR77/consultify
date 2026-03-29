/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MobileV8ScopePanel } from '../../../src/components/shared/MobileV8ScopePanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

describe('MobileV8ScopePanel', () => {
  it('renders the mobile support matrix and device boundary statement', () => {
    render(<MobileV8ScopePanel compact />);

    expect(screen.getByText('A credible mobile support promise')).toBeInTheDocument();
    expect(screen.getByText('Mobile-first')).toBeInTheDocument();
    expect(screen.getByText('Desktop-only')).toBeInTheDocument();
    expect(screen.getByText('PWA and device boundaries')).toBeInTheDocument();
  });
});
