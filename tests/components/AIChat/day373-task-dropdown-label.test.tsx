import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { setCurrentView, setMyWorkIntent } = vi.hoisted(() => ({
  setCurrentView: vi.fn(),
  setMyWorkIntent: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: { getPersonalTasks: vi.fn(async () => []) },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ setCurrentView, setMyWorkIntent }),
}));

import { TaskDropdown } from '../../../src/components/TaskDropdown';
import { AppView } from '../../../src/types';

describe('day373 TaskDropdown honest empty-state action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels navigation as navigation and preserves the My Work tasks intent', async () => {
    const user = userEvent.setup();
    render(<TaskDropdown />);

    await user.click(screen.getByRole('button', { name: /Today's tasks|Dzisiejsze zadania/i }));
    const navigation = await screen.findByRole('button', {
      name: /Go to tasks|Przejdź do zadań/i,
    });
    expect(screen.queryByRole('button', { name: /Create new task|Utwórz nowe zadanie/i })).toBeNull();

    await user.click(navigation);
    expect(setMyWorkIntent).toHaveBeenCalledWith({ tab: 'tasks' });
    expect(setCurrentView).toHaveBeenCalledWith(AppView.MY_WORK);
  });
});
