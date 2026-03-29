/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdminV8CanonPanel } from '../../../src/components/Admin/AdminV8CanonPanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
  }),
}));

describe('AdminV8CanonPanel', () => {
  it('renders the canonical tenant operator cockpit and ownership rules', () => {
    render(<AdminV8CanonPanel compact />);

    expect(screen.getByText('One tenant operator cockpit')).toBeInTheDocument();
    expect(screen.getByText('Team operations')).toBeInTheDocument();
    expect(screen.getByText('Sync and integration controls')).toBeInTheDocument();
    expect(screen.getByText('Ownership and boundary rules')).toBeInTheDocument();
  });
});
