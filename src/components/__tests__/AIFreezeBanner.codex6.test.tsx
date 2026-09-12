import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../store/useAppStore', () => ({
  useAppStore: () => ({
    aiFreezeStatus: {
      isFrozen: true,
      scope: 'Organization',
      reason:
        'Your organization has used its $50 monthly AI budget. Existing work remains available. Ask an administrator to raise the budget or wait for the next monthly reset.',
    },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { AIFreezeBanner } from '../AIFreezeBanner';

describe('CODEX6 AI freeze banner', () => {
  it('shows the actionable organization budget reason instead of a generic freeze', () => {
    render(<AIFreezeBanner />);
    expect(screen.getByText(/\$50 monthly AI budget/)).toBeInTheDocument();
    expect(screen.getByText(/Existing work remains available/)).toBeInTheDocument();
    expect(screen.getByText(/wait for the next monthly reset/)).toBeInTheDocument();
  });
});
