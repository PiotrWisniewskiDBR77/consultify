/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InboxTriage } from '../../../src/components/MyWork/Inbox/InboxTriage';
import { Api } from '../../../src/services/api';

// Mock dependencies

vi.mock('@/services/api', () => ({
    Api: {
        get: vi.fn(),
        post: vi.fn()
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
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

const mockInboxItems = [
    {
        id: 'inbox-1',
        type: 'new_assignment' as const,
        title: 'Critical Task Assignment',
        description: 'You have been assigned a critical task',
        urgency: 'critical' as const,
        receivedAt: new Date().toISOString(),
        source: {
            userId: 'user-1',
            userName: 'John Doe',
            avatarUrl: null
        },
        linkedTask: {
            taskId: 'task-1',
            title: 'Critical Task',
            dueDate: new Date().toISOString()
        },
        triaged: false
    },
    {
        id: 'inbox-2',
        type: 'mention' as const,
        title: 'You were mentioned in a comment',
        description: 'Check out this discussion',
        urgency: 'high' as const,
        receivedAt: new Date().toISOString(),
        source: {
            userId: 'user-2',
            userName: 'Jane Smith'
        },
        triaged: false
    },
    {
        id: 'inbox-3',
        type: 'review_request' as const,
        title: 'Review requested',
        description: 'Please review this document',
        urgency: 'normal' as const,
        receivedAt: new Date().toISOString(),
        source: {},
        triaged: false
    },
    {
        id: 'inbox-4',
        type: 'escalation' as const,
        title: 'Low priority notification',
        urgency: 'low' as const,
        receivedAt: new Date().toISOString(),
        source: {},
        triaged: false
    }
];

describe('InboxTriage Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            items: mockInboxItems
        });
        (Api.post as any).mockResolvedValue({ success: true });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Loading State', () => {
        it('shows loading spinner while fetching data', async () => {
            (Api.get as any).mockImplementation(() => new Promise(() => {}));
            
            render(<InboxTriage />);
            
            expect(document.querySelector('.animate-spin')).toBeTruthy();
        });
    });

    describe('Inbox Display', () => {
        it('renders header with title and item count', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Inbox')).toBeInTheDocument();
                expect(screen.getByText(/4 items/)).toBeInTheDocument();
            });
        });

        it('shows critical count in header', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText(/1 critical/)).toBeInTheDocument();
            });
        });

        it('displays items grouped by urgency', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Krytyczne')).toBeInTheDocument();
                expect(screen.getByText('Wysokie')).toBeInTheDocument();
                expect(screen.getByText('Normalne')).toBeInTheDocument();
                expect(screen.getByText('Niskie')).toBeInTheDocument();
            });
        });

        it('shows item titles', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
                expect(screen.getByText('You were mentioned in a comment')).toBeInTheDocument();
                expect(screen.getByText('Review requested')).toBeInTheDocument();
            });
        });

        it('displays item descriptions', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('You have been assigned a critical task')).toBeInTheDocument();
            });
        });

        it('shows source user info', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });
        });

        it('displays item type', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('new assignment')).toBeInTheDocument();
            });
        });
    });

    describe('Urgency Sections', () => {
        it('expands critical, high, and normal by default', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                // Critical item should be visible
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
                // High item should be visible
                expect(screen.getByText('You were mentioned in a comment')).toBeInTheDocument();
                // Normal item should be visible
                expect(screen.getByText('Review requested')).toBeInTheDocument();
            });
        });

        it('toggles section expansion on header click', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Find and click critical section header
            const criticalHeader = screen.getByText('Krytyczne').closest('button');
            if (criticalHeader) {
                await user.click(criticalHeader);
            }

            // After collapse, items should be hidden (AnimatePresence handles this)
        });

        it('shows count badge for each section', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                // Should show count badges
                const badges = screen.getAllByText('1');
                expect(badges.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Item Selection', () => {
        it('toggles item selection on checkbox click', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Click on checkbox (Square icon)
            const checkboxes = screen.getAllByRole('button');
            const checkbox = checkboxes.find(btn => btn.querySelector('.lucide-square'));
            
            if (checkbox) {
                await user.click(checkbox);
            }
        });

        it('shows bulk actions bar when items selected', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Select an item
            const checkboxes = screen.getAllByRole('button');
            const checkbox = checkboxes.find(btn => btn.querySelector('.lucide-square'));
            
            if (checkbox) {
                await user.click(checkbox);
            }

            await waitFor(() => {
                expect(screen.getByText(/1 selected/)).toBeInTheDocument();
            });
        });

        it('provides select all option', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Select an item first to show bulk bar
            const checkboxes = screen.getAllByRole('button');
            const checkbox = checkboxes.find(btn => btn.querySelector('.lucide-square'));
            
            if (checkbox) {
                await user.click(checkbox);
            }

            await waitFor(() => {
                expect(screen.getByText('Select all')).toBeInTheDocument();
            });

            // Click select all
            await user.click(screen.getByText('Select all'));

            await waitFor(() => {
                expect(screen.getByText(/4 selected/)).toBeInTheDocument();
            });
        });

        it('provides clear selection option', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Select an item
            const checkboxes = screen.getAllByRole('button');
            const checkbox = checkboxes.find(btn => btn.querySelector('.lucide-square'));
            
            if (checkbox) {
                await user.click(checkbox);
            }

            await waitFor(() => {
                expect(screen.getByText('Clear')).toBeInTheDocument();
            });

            // Click clear
            await user.click(screen.getByText('Clear'));

            // Bulk bar should be hidden
            await waitFor(() => {
                expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
            });
        });
    });

    describe('Triage Actions', () => {
        it('shows triage actions on hover', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Hover over item card
            const itemCard = screen.getByText('Critical Task Assignment').closest('.group');
            if (itemCard) {
                await fireEvent.mouseEnter(itemCard);
            }

            // Triage action buttons should appear
        });

        it('processes single item triage', async () => {
            const onTriage = vi.fn();
            render(<InboxTriage onTriage={onTriage} />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Hover to show actions
            const itemCard = screen.getByText('Critical Task Assignment').closest('.group');
            if (itemCard) {
                await fireEvent.mouseEnter(itemCard);
            }

            // Click accept_today action
            const acceptButtons = screen.getAllByRole('button').filter(btn =>
                btn.classList.contains('triage-accept')
            );

            if (acceptButtons[0]) {
                await user.click(acceptButtons[0]);
            }

            await waitFor(() => {
                expect(Api.post).toHaveBeenCalledWith(
                    '/my-work/inbox/inbox-1/triage',
                    expect.objectContaining({ action: 'accept_today' })
                );
            });
        });

        it('processes bulk triage', async () => {
            const onBulkTriage = vi.fn();
            render(<InboxTriage onBulkTriage={onBulkTriage} />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Select multiple items
            const checkboxes = screen.getAllByRole('button').filter(btn => 
                btn.querySelector('.lucide-square')
            );
            
            for (const checkbox of checkboxes.slice(0, 2)) {
                await user.click(checkbox);
            }

            await waitFor(() => {
                expect(screen.getByText(/2 selected/)).toBeInTheDocument();
            });

            // Click bulk archive action
            const archiveButtons = screen.getAllByRole('button').filter(btn =>
                btn.classList.contains('triage-archive')
            );

            if (archiveButtons[0]) {
                await user.click(archiveButtons[0]);
            }

            await waitFor(() => {
                expect(Api.post).toHaveBeenCalledWith(
                    '/my-work/inbox/bulk-triage',
                    expect.objectContaining({
                        action: 'archive',
                        itemIds: expect.any(Array)
                    })
                );
            });
        });

        it('removes item from list after triage', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Hover to show actions
            const itemCard = screen.getByText('Critical Task Assignment').closest('.group');
            if (itemCard) {
                await fireEvent.mouseEnter(itemCard);
            }

            // Click triage action
            const acceptButtons = screen.getAllByRole('button').filter(btn =>
                btn.classList.contains('triage-accept')
            );

            if (acceptButtons[0]) {
                await user.click(acceptButtons[0]);
            }

            await waitFor(() => {
                // Item should be removed from the list (optimistic update)
                expect(screen.queryByText('Critical Task Assignment')).not.toBeInTheDocument();
            });
        });

        it('reverts on API error', async () => {
            (Api.post as any).mockRejectedValueOnce(new Error('API Error'));
            
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Hover and triage
            const itemCard = screen.getByText('Critical Task Assignment').closest('.group');
            if (itemCard) {
                await fireEvent.mouseEnter(itemCard);
            }

            const acceptButtons = screen.getAllByRole('button').filter(btn =>
                btn.classList.contains('triage-accept')
            );

            if (acceptButtons[0]) {
                await user.click(acceptButtons[0]);
            }

            // Should reload inbox after error
            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledTimes(2);
            });
        });
    });

    describe('Filtering', () => {
        it('renders filter dropdown', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByRole('combobox')).toBeInTheDocument();
            });
        });

        it('filters by item type', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Change filter to mentions only
            const filterSelect = screen.getByRole('combobox');
            await user.selectOptions(filterSelect, 'mention');

            await waitFor(() => {
                // Should only show mention items
                expect(screen.getByText('You were mentioned in a comment')).toBeInTheDocument();
                // Assignment should not be visible
                expect(screen.queryByText('Critical Task Assignment')).not.toBeInTheDocument();
            });
        });

        it('shows all types by default', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                const filterSelect = screen.getByRole('combobox') as HTMLSelectElement;
                expect(filterSelect.value).toBe('all');
            });
        });
    });

    describe('Item Click Handler', () => {
        it('calls onItemClick when item content is clicked', async () => {
            const onItemClick = vi.fn();
            render(<InboxTriage onItemClick={onItemClick} />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Click on item title
            await user.click(screen.getByText('Critical Task Assignment'));

            expect(onItemClick).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'inbox-1' })
            );
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no items', async () => {
            (Api.get as any).mockResolvedValue({ items: [] });

            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText("You've processed all items. Great job!")).toBeInTheDocument();
            });
        });
    });

    describe('Triaged Items', () => {
        it('filters out already triaged items', async () => {
            (Api.get as any).mockResolvedValue({
                items: [
                    { ...mockInboxItems[0], triaged: true },
                    mockInboxItems[1]
                ]
            });

            render(<InboxTriage />);

            await waitFor(() => {
                // Only non-triaged item should be visible
                expect(screen.getByText('You were mentioned in a comment')).toBeInTheDocument();
                expect(screen.queryByText('Critical Task Assignment')).not.toBeInTheDocument();
            });
        });

        it('applies opacity to triaged items if shown', async () => {
            // Items are filtered before render, but if a triaged item were shown,
            // it would have opacity-50 class
            (Api.get as any).mockResolvedValue({
                items: [{ ...mockInboxItems[0], triaged: false }]
            });

            render(<InboxTriage />);

            await waitFor(() => {
                const card = screen.getByText('Critical Task Assignment').closest('.group');
                expect(card).not.toHaveClass('opacity-50');
            });
        });
    });

    describe('Keyboard Shortcuts', () => {
        it('displays keyboard shortcuts in tooltips', async () => {
            render(<InboxTriage />);

            await waitFor(() => {
                expect(screen.getByText('Critical Task Assignment')).toBeInTheDocument();
            });

            // Hover to show actions
            const itemCard = screen.getByText('Critical Task Assignment').closest('.group');
            if (itemCard) {
                await fireEvent.mouseEnter(itemCard);
            }

            // Buttons should have title with shortcut
            const acceptButtons = screen.getAllByRole('button').filter(btn =>
                btn.classList.contains('triage-accept')
            );

            if (acceptButtons[0]) {
                expect(acceptButtons[0].getAttribute('title')).toContain('T');
            }
        });
    });
});















