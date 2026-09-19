import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InitiativeCard } from '../InitiativeCard';
import { InitiativeStatus, type Initiative } from '../../types';

const statusLabels: Record<string, string> = {
  'initiatives.status.PROPOSED': 'Proposed',
  'initiatives.status.DRAFT': 'Draft',
  'initiatives.status.PENDING_APPROVAL': 'Pending approval',
  'initiatives.status.APPROVED': 'Approved',
  'initiatives.status.IN_EXECUTION': 'In execution',
  'initiatives.status.CLOSED': 'Closed',
  'initiatives.status.REJECTED': 'Rejected',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } | string) => {
      if (key in statusLabels) return statusLabels[key];
      if (typeof options === 'object' && options?.defaultValue) return options.defaultValue;
      if (typeof options === 'string') return options;
      return key;
    },
  }),
}));

const baseInitiative = (status: InitiativeStatus): Initiative => ({
  id: `initiative-${status}`,
  name: `Initiative ${status}`,
  title: `Initiative ${status}`,
  description: '',
  summary: '',
  status,
  strategicIntent: undefined,
  strategicRole: undefined,
  axis: undefined,
  aiConfidence: undefined,
  effortProfile: undefined,
  businessValue: undefined,
  placementReason: undefined,
  problemStatement: undefined,
} as unknown as Initiative);

describe('InitiativeCard status labels', () => {
  it.each([
    [InitiativeStatus.PROPOSED, 'Proposed'],
    [InitiativeStatus.DRAFT, 'Draft'],
    [InitiativeStatus.PENDING_APPROVAL, 'Pending approval'],
    [InitiativeStatus.APPROVED, 'Approved'],
    [InitiativeStatus.IN_EXECUTION, 'In execution'],
    [InitiativeStatus.CLOSED, 'Closed'],
    [InitiativeStatus.REJECTED, 'Rejected'],
  ])('renders generated label for %s', (status, expectedLabel) => {
    render(<InitiativeCard initiative={baseInitiative(status)} onClick={vi.fn()} />);

    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
  });
});
