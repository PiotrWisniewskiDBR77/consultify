/**
 * UserTaskList Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserTaskList } from '../../../src/components/dashboard/UserTaskList';
import { Task, TaskStatus, AppView } from '../../../src/types';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Api
const mockGetTasks = vi.fn();
const mockCreateTask = vi.fn();
vi.mock('../../../src/services/api', () => ({
  Api: {
    getTasks: () => mockGetTasks(),
    createTask: (data: any) => mockCreateTask(data),
  },
}));

// Mock store
vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User' },
  }),
}));

// Mock TaskDetailModal
vi.mock('../../../src/components/TaskDetailModal', () => ({
  TaskDetailModal: ({ isOpen, onClose, onSave }: any) =>
    isOpen ? (
      <div data-testid="task-modal">
        <button onClick={onClose}>Close</button>
        <button onClick={() => onSave({ title: 'New Task' })}>Save</button>
      </div>
    ) : null,
}));

describe('UserTaskList Component', () => {
  const mockOnNavigate = vi.fn();

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'proj-1',
      title: 'Complete Assessment',
      description: 'Finish the maturity assessment',
      type: 'task',
      status: TaskStatus.IN_PROGRESS,
      priority: 'high',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskType: 'task',
      stepPhase: 'design',
    },
    {
      id: 'task-2',
      projectId: 'proj-1',
      title: 'Review Roadmap',
      description: 'Review the transformation roadmap',
      type: 'task',
      status: TaskStatus.TODO,
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskType: 'task',
      stepPhase: 'pilot',
    },
    {
      id: 'task-3',
      projectId: 'proj-1',
      title: 'Completed Task',
      description: 'This task is done',
      type: 'task',
      status: TaskStatus.DONE,
      priority: 'low',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      taskType: 'task',
      stepPhase: 'design',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTasks.mockResolvedValue(mockTasks);
  });

  describe('Initial Render', () => {
    it('should render the component', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('My Action Plan')).toBeInTheDocument();
      });
    });

    it('should show loading state initially', () => {
      mockGetTasks.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      expect(screen.getByText('Loading tasks...')).toBeInTheDocument();
    });

    it('should fetch tasks on mount', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(mockGetTasks).toHaveBeenCalled();
      });
    });

    it('should display description text', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText(/Complete these steps/i)).toBeInTheDocument();
      });
    });
  });

  describe('Task Display', () => {
    it('should display task titles', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Complete Assessment')).toBeInTheDocument();
        expect(screen.getByText('Review Roadmap')).toBeInTheDocument();
      });
    });

    it('should display task descriptions', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Finish the maturity assessment')).toBeInTheDocument();
      });
    });

    it('should show Start Task button for active tasks', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        const startButtons = screen.getAllByText('Start Task');
        expect(startButtons.length).toBeGreaterThan(0);
      });
    });

    it('should show Completed label for done tasks', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('should show message when no tasks', async () => {
      mockGetTasks.mockResolvedValue([]);
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('No pending tasks. Great job!')).toBeInTheDocument();
      });
    });
  });

  describe('Add Task Button', () => {
    it('should show Add Task button', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Add Task')).toBeInTheDocument();
      });
    });

    it('should open modal when Add Task clicked', async () => {
      const user = userEvent.setup();
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => screen.getByText('Add Task'));
      await user.click(screen.getByText('Add Task'));

      expect(screen.getByTestId('task-modal')).toBeInTheDocument();
    });
  });

  describe('Refresh Button', () => {
    it('should have refresh button', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByTitle('Refresh')).toBeInTheDocument();
      });
    });

    it('should refetch tasks when refresh clicked', async () => {
      const user = userEvent.setup();
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => screen.getByTitle('Refresh'));
      await user.click(screen.getByTitle('Refresh'));

      expect(mockGetTasks).toHaveBeenCalledTimes(2);
    });
  });

  describe('Navigation', () => {
    it('should call onNavigate when Start Task clicked', async () => {
      const user = userEvent.setup();
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => screen.getByText('Complete Assessment'));

      const startButtons = screen.getAllByText('Start Task');
      await user.click(startButtons[0]);

      expect(mockOnNavigate).toHaveBeenCalled();
    });
  });

  describe('How It Works Section', () => {
    it('should display how it works section', async () => {
      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('How it works')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API error gracefully', async () => {
      mockGetTasks.mockRejectedValue(new Error('API Error'));

      render(<UserTaskList onNavigate={mockOnNavigate} />);

      await waitFor(() => {
        // Should not crash, just show empty or error state
        expect(screen.getByText('My Action Plan')).toBeInTheDocument();
      });
    });
  });
});
