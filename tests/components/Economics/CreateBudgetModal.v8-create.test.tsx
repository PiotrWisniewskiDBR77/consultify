import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateBudgetModal } from '../../../src/components/Economics/modals/CreateBudgetModal';

const createBudget = vi.fn();

vi.mock('../../../src/services/api/v8/finance', () => ({
  V8FinanceApi: { createBudget: (...args: unknown[]) => createBudget(...args) },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

describe('CreateBudgetModal canonical registration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBudget.mockResolvedValue({
      budget: {
        id: 'budget-v8',
        title: 'FY27 Budget',
        status: 'DRAFT',
        currency: 'PLN',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
      },
      lineCount: 15,
      scenarioCount: 3,
      replay: false,
    });
  });

  it('requires an explicit period and calls only the canonical V8 registration command', async () => {
    const onCreated = vi.fn();
    render(<CreateBudgetModal onCreated={onCreated} onClose={vi.fn()} />);

    const create = screen.getByRole('button', { name: 'Create' });
    expect(create).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('e.g., Budget 2026 Q1-Q4'), {
      target: { value: 'FY27 Budget' },
    });
    const months = document.querySelectorAll('input[type="month"]');
    fireEvent.change(months[0], { target: { value: '2027-01' } });
    fireEvent.change(months[1], { target: { value: '2027-12' } });
    fireEvent.click(create);

    await waitFor(() => expect(createBudget).toHaveBeenCalledTimes(1));
    expect(createBudget).toHaveBeenCalledWith(
      {
        title: 'FY27 Budget',
        periodStart: '2027-01-01',
        periodEnd: '2027-12-31',
        granularity: 'monthly',
        currency: 'PLN',
        sourceKind: 'manual',
      },
      expect.any(String)
    );
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'budget-budget-v8' }));
  });
});
