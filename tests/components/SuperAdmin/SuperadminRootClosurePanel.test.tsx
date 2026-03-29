/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SuperadminRootClosurePanel } from '../../../src/components/SuperAdmin/SuperadminRootClosurePanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

describe('SuperadminRootClosurePanel', () => {
  it('renders the visible platform control plane canon', () => {
    render(<SuperadminRootClosurePanel compact />);

    expect(screen.getByText('One visible platform control plane')).toBeInTheDocument();
    expect(screen.getByText('Tenants and customers')).toBeInTheDocument();
    expect(screen.getByText('AI and connector platform ops')).toBeInTheDocument();
    expect(screen.getByText('Control-plane closure rules')).toBeInTheDocument();
  });
});
