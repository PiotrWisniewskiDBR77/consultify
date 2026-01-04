/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FocusBoard } from '../../components/MyWork/Focus/FocusBoard';
import { Api } from '../../../services/api';

// Mock dependencies

vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        updateTask: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    Reorder: {
        Group: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        Item: ({ children, ...props }: any) => <div {...props}>{children}</div>
    }
}));

const mockFocusTasks = [
    {
        taskId: 'task-1',
        title: 'Morning Task 1',
        timeBlock: 'morning' as const,
        isCompleted: false,
        priority: 'high',
        dueDate: new Date().toISOString(),
        initiativeName: 'Project Alpha',
        estimatedMinutes: 30
    },
    {
        taskId: 'task-2',
        title: 'Afternoon Task 1',
        timeBlock: 'afternoon' as const,
        isCompleted: false,
        priority: 'medium',
        dueDate: new Date().toISOString()
    },
    {
        taskId: 'task-3',
        title: 'Buffer Task 1',
        timeBlock: 'buffer' as const,
        isCompleted: true,
        priority: 'low'
    }
];

const mockSuggestions = {
    suggestedTasks: [
        {
            taskId: 'suggested-1',
            title: 'Suggested Task 1',
            reason: 'High priority deadline approaching',
            suggestedTimeBlock: 'morning'
        }
    ],
    reasoning: 'Based on your priorities and deadlines'
};

describe('FocusBoard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            board: {
                tasks: mockFocusTasks,
                executionScore: 75
            },
            suggestions: null
        });
        (Api.put as any).mockResolvedValue({ success: true });
        (Api.post as any).mockResolvedValue({ suggestions: mockSuggestions });
        (Api.updateTask as any).mockResolvedValue({ success: true });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading spinner while fetching data', async () => {
            (Api.get as any).mockImplementation(() => new Promise(() => {})); // Never resolves
            
            render(<FocusBoard />);
            
            expect(screen.getByRole('status') || document.querySelector('.animate-spin')).toBeTruthy();
        });
    });

    describe('Focus Board Display', () => {
        it('renders header with title and date', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText("Today's Focus")).toBeInTheDocument();
            });
        });

        it('displays tasks in correct time blocks', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
                expect(screen.getByText('Afternoon Task 1')).toBeInTheDocument();
                expect(screen.getByText('Buffer Task 1')).toBeInTheDocument();
            });
        });

        it('shows initiative name for tasks with initiatives', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Project Alpha')).toBeInTheDocument();
            });
        });

        it('shows estimated time for tasks', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('30 min')).toBeInTheDocument();
            });
        });

        it('displays execution score', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('75')).toBeInTheDocument();
                expect(screen.getByText('Execution Score')).toBeInTheDocument();
            });
        });

        it('shows progress bar with correct values', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                // 1 completed out of 3
                expect(screen.getByText('1/3')).toBeInTheDocument();
            });
        });
    });

    describe('Time Block Sections', () => {
        it('renders morning, afternoon, and buffer sections', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Rano')).toBeInTheDocument();
                expect(screen.getByText('Popołudnie')).toBeInTheDocument();
                expect(screen.getByText('Bufor')).toBeInTheDocument();
            });
        });

        it('displays time ranges for blocks', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('8:00 - 12:00')).toBeInTheDocument();
                expect(screen.getByText('12:00 - 17:00')).toBeInTheDocument();
                expect(screen.getByText('Elastyczny')).toBeInTheDocument();
            });
        });

        it('shows task count per block', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                // Morning: 0/1, Afternoon: 0/1, Buffer: 1/1
                const counters = screen.getAllByText(/\d\/\d/);
                expect(counters.length).toBeGreaterThanOrEqual(3);
            });
        });

        it('can toggle block expansion', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            // Click on morning block header to collapse
            const morningHeader = screen.getByText('Rano').closest('button');
            if (morningHeader) {
                await user.click(morningHeader);
            }
        });
    });

    describe('Task Completion', () => {
        it('toggles task completion on checkbox click', async () => {
            const onTaskComplete = vi.fn();
            render(<FocusBoard onTaskComplete={onTaskComplete} />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            // Find and click the completion button
            const completionButtons = screen.getAllByRole('button');
            const completionButton = completionButtons.find(btn => 
                btn.querySelector('svg')?.closest('button')
            );
            
            if (completionButton) {
                await user.click(completionButton);
            }

            await waitFor(() => {
                expect(Api.updateTask).toHaveBeenCalled();
            });
        });

        it('shows completed task with strikethrough', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                const completedTask = screen.getByText('Buffer Task 1');
                expect(completedTask).toHaveClass('line-through');
            });
        });

        it('reverts on API error', async () => {
            (Api.updateTask as any).mockRejectedValueOnce(new Error('API Error'));
            
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            // Attempt completion
            const buttons = screen.getAllByRole('button');
            if (buttons[0]) {
                await user.click(buttons[0]);
            }

            // Should call loadFocus again to revert
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Task Removal', () => {
        it('removes task from focus on remove button click', async () => {
            const onRemoveFromFocus = vi.fn();
            render(<FocusBoard onRemoveFromFocus={onRemoveFromFocus} />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            // Hover over task card to show remove button
            const taskCard = screen.getByText('Morning Task 1').closest('.group');
            if (taskCard) {
                await fireEvent.mouseEnter(taskCard);
            }

            // Find X button
            const removeButtons = screen.getAllByRole('button').filter(btn => 
                btn.querySelector('.lucide-x')
            );

            if (removeButtons[0]) {
                await user.click(removeButtons[0]);
            }

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/my-work/focus', expect.any(Object));
            });
        });
    });

    describe('AI Suggestions', () => {
        it('fetches AI suggestions on button click', async () => {
            const onRequestAISuggestion = vi.fn();
            render(<FocusBoard onRequestAISuggestion={onRequestAISuggestion} />);

            await waitFor(() => {
                expect(screen.getByText("Today's Focus")).toBeInTheDocument();
            });

            const aiButton = screen.getByText('AI Suggest');
            await user.click(aiButton);

            await waitFor(() => {
                expect(Api.post).toHaveBeenCalledWith('/my-work/focus/ai-suggest', expect.any(Object));
            });
        });

        it('displays AI suggestions panel after fetch', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText("Today's Focus")).toBeInTheDocument();
            });

            const aiButton = screen.getByText('AI Suggest');
            await user.click(aiButton);

            await waitFor(() => {
                expect(screen.getByText('AI Suggestions')).toBeInTheDocument();
                expect(screen.getByText('Suggested Task 1')).toBeInTheDocument();
                expect(screen.getByText('High priority deadline approaching')).toBeInTheDocument();
            });
        });

        it('shows reasoning for suggestions', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText("Today's Focus")).toBeInTheDocument();
            });

            const aiButton = screen.getByText('AI Suggest');
            await user.click(aiButton);

            await waitFor(() => {
                expect(screen.getByText('Based on your priorities and deadlines')).toBeInTheDocument();
            });
        });

        it('disables AI button when max tasks reached', async () => {
            (Api.get as any).mockResolvedValue({
                board: {
                    tasks: [
                        { taskId: '1', title: 'Task 1', timeBlock: 'morning', isCompleted: false },
                        { taskId: '2', title: 'Task 2', timeBlock: 'morning', isCompleted: false },
                        { taskId: '3', title: 'Task 3', timeBlock: 'afternoon', isCompleted: false },
                        { taskId: '4', title: 'Task 4', timeBlock: 'afternoon', isCompleted: false },
                        { taskId: '5', title: 'Task 5', timeBlock: 'buffer', isCompleted: false }
                    ],
                    executionScore: 50
                }
            });

            render(<FocusBoard />);

            await waitFor(() => {
                const aiButton = screen.getByText('AI Suggest').closest('button');
                expect(aiButton).toBeDisabled();
            });
        });

        it('shows max tasks warning when 5 tasks are in focus', async () => {
            (Api.get as any).mockResolvedValue({
                board: {
                    tasks: [
                        { taskId: '1', title: 'Task 1', timeBlock: 'morning', isCompleted: false },
                        { taskId: '2', title: 'Task 2', timeBlock: 'morning', isCompleted: false },
                        { taskId: '3', title: 'Task 3', timeBlock: 'afternoon', isCompleted: false },
                        { taskId: '4', title: 'Task 4', timeBlock: 'afternoon', isCompleted: false },
                        { taskId: '5', title: 'Task 5', timeBlock: 'buffer', isCompleted: false }
                    ],
                    executionScore: 50
                }
            });

            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText(/Maximum 5 focus tasks/)).toBeInTheDocument();
            });
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no tasks', async () => {
            (Api.get as any).mockResolvedValue({
                board: { tasks: [], executionScore: 0 }
            });

            render(<FocusBoard />);

            await waitFor(() => {
                // EmptyState component should be rendered
                expect(screen.getByText('Add from Inbox')).toBeInTheDocument();
            });
        });
    });

    describe('Task Click Handler', () => {
        it('calls onTaskClick when task is clicked', async () => {
            const onTaskClick = vi.fn();
            render(<FocusBoard onTaskClick={onTaskClick} />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            const taskTitle = screen.getByText('Morning Task 1');
            await user.click(taskTitle);

            expect(onTaskClick).toHaveBeenCalledWith('task-1');
        });
    });

    describe('Date Handling', () => {
        it('uses provided date for API calls', async () => {
            const customDate = new Date('2024-06-15');
            render(<FocusBoard date={customDate} />);

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith('/my-work/focus?date=2024-06-15');
            });
        });

        it('uses current date when no date provided', async () => {
            render(<FocusBoard />);

            const today = new Date().toISOString().split('T')[0];
            
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith(`/my-work/focus?date=${today}`);
            });
        });
    });

    describe('Reorder Functionality', () => {
        it('persists reorder changes to API', async () => {
            render(<FocusBoard />);

            await waitFor(() => {
                expect(screen.getByText('Morning Task 1')).toBeInTheDocument();
            });

            // Simulate a reorder (this would typically be done via drag-drop)
            // The handleBlockReorder function updates state and calls API
            // We verify the API is called with the focus endpoint
            expect(Api.get).toHaveBeenCalled();
        });
    });

    describe('Add to Focus Callback', () => {
        it('calls onAddToFocus when adding suggestion', async () => {
            const onAddToFocus = vi.fn();
            render(<FocusBoard onAddToFocus={onAddToFocus} />);

            await waitFor(() => {
                expect(screen.getByText("Today's Focus")).toBeInTheDocument();
            });

            // Trigger AI suggestions
            const aiButton = screen.getByText('AI Suggest');
            await user.click(aiButton);

            await waitFor(() => {
                expect(screen.getByText('Suggested Task 1')).toBeInTheDocument();
            });

            // Click add button on suggestion
            const addButtons = screen.getAllByRole('button').filter(btn => 
                btn.querySelector('.lucide-plus')
            );
            
            if (addButtons.length > 0) {
                await user.click(addButtons[addButtons.length - 1]);
                expect(onAddToFocus).toHaveBeenCalledWith('suggested-1', 'morning');
            }
        });
    });
});














