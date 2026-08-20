import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConvertToDialog } from '../../../src/components/MyWork/ConvertToDialog';

const { materialize } = vi.hoisted(() => ({ materialize: vi.fn() }));
vi.mock('../../../src/services/traceabilityService', () => ({
  materializeMyWorkSession: (...args: unknown[]) => materialize(...args),
}));
vi.mock('../../../src/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

describe('ConvertToDialog budget authority', () => {
  beforeEach(() => {
    materialize.mockReset();
    materialize.mockResolvedValue({ id: 'tool-session-1' });
  });

  it('requires an explicit ordered period and returns the exact configuration', async () => {
    const onConvert = vi.fn();
    render(
      <ConvertToDialog
        open
        onClose={vi.fn()}
        targetType="budget"
        sources={[{ type: 'idea', id: 'idea-1', title: 'Operating plan' }]}
        onConvert={onConvert}
      />
    );
    const confirm = screen.getByRole('button', { name: /confirm/i });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2028-12-31' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2028-01-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/after start/i);
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2028-01-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2028-12-31' } });
    fireEvent.change(screen.getByLabelText(/granularity/i), { target: { value: 'quarterly' } });
    fireEvent.change(screen.getByLabelText(/currency/i), { target: { value: 'EUR' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(onConvert).toHaveBeenCalledWith({ id: 'tool-session-1' }, 'budget', {
        periodStart: '2028-01-01',
        periodEnd: '2028-12-31',
        granularity: 'quarterly',
        currency: 'EUR',
      })
    );
  });
});
