import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getDecisions: vi.fn(),
  getDecision: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('@/i18n', () => ({ default: { language: 'en' } }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: 'user-1' } }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/ui/primitives', () => ({
  LoadingState: () => <div role="status">Loading decisions</div>,
  ErrorState: ({ title, retry }: { title: string; retry: () => void }) => (
    <div role="alert">
      {title}
      <button type="button" onClick={retry}>Retry</button>
    </div>
  ),
}));
vi.mock('@/components/ui/composed/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-decisions">{title}</div>,
}));
vi.mock('@/components/ui/primitives/chips', () => ({
  DueChip: () => null,
  EntityStatusChip: () => null,
  MetaChip: () => null,
  PriorityChip: () => null,
}));
vi.mock('@/components/shared/TableWithPreviewLayout', () => ({
  TableWithPreviewLayout: ({ children, selectedItem, renderPreview, onOpenFull }: any) => (
    <div>
      {children}
      {selectedItem ? (
        <div data-testid="decision-preview">
          {renderPreview(selectedItem)}
          <button type="button" onClick={() => onOpenFull(selectedItem.id)}>Open full</button>
        </div>
      ) : null}
    </div>
  ),
}));
vi.mock('@/components/standard', () => ({
  StandardTable: ({ data, onRowClick }: any) => (
    <div data-testid="decisions-table">
      {data.map((row: any) => (
        <button type="button" key={row.id} onClick={() => onRowClick(row)}>{row.title}</button>
      ))}
    </div>
  ),
}));
vi.mock('../DecisionPreviewPanel', () => ({
  DecisionPreviewBody: ({ decision }: any) => <div>{decision.description}</div>,
  DecisionPreviewFooter: () => null,
}));
vi.mock('../shared/DelegationModal', () => ({ DelegationModal: () => null }));

import { DecisionsPanelContent } from '../DecisionsPanelContent';

const decision = {
  id: 'decision-1',
  title: 'Approve transformation roadmap',
  description: 'Choose the governed rollout option.',
  status: 'PENDING',
  priority: 'HIGH',
  decisionOwnerId: 'user-1',
  requestedById: 'user-2',
  createdAt: '2026-08-23T10:00:00.000Z',
};
const requiredProps = { onCountsChange: vi.fn() };

describe('DecisionsPanelContent owner states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getDecisions.mockReset();
    api.getDecision.mockReset();
    api.get.mockReset();
    api.get.mockResolvedValue(null);
  });

  it('renders an honest loading state followed by the empty state', async () => {
    let resolve: (value: unknown[]) => void = () => undefined;
    api.getDecisions.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<DecisionsPanelContent {...requiredProps} viewMode="my" searchQuery="" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading decisions');
    resolve([]);
    expect(await screen.findByTestId('empty-decisions')).toHaveTextContent(
      'No decisions awaiting your action'
    );
  });

  it('fails closed with Retry and recovers the canonical table', async () => {
    api.getDecisions
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([decision]);
    render(<DecisionsPanelContent {...requiredProps} viewMode="my" searchQuery="" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load decisions');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('decisions-table')).toHaveTextContent(decision.title);
    expect(api.getDecisions).toHaveBeenCalledTimes(2);
  });

  it('opens canonical detail data and forwards full navigation', async () => {
    const onDecisionClick = vi.fn();
    api.getDecisions.mockResolvedValue([decision]);
    api.getDecision.mockResolvedValue({ ...decision, description: 'Server detail readback.' });
    render(
      <DecisionsPanelContent
        {...requiredProps}
        viewMode="my"
        searchQuery=""
        onDecisionClick={onDecisionClick}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: decision.title }));
    expect(await screen.findByText('Server detail readback.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open full' }));
    await waitFor(() => expect(onDecisionClick).toHaveBeenCalledWith('decision-1', decision));
  });
});
