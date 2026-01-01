/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkstreamBoard } from '../../../components/PMO/WorkstreamBoard';
import { WorkstreamStatus } from '../../../types';

// Mock API
vi.mock('../../../services/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

// Mock i18n

const mockWorkstreams = [
    {
        id: 'ws-1',
        name: 'Development Workstream',
        description: 'Handles all development activities',
        status: WorkstreamStatus.ACTIVE,
        ownerId: 'user-1',
        owner: { firstName: 'John', lastName: 'Doe' },
        initiatives: [
            {
                id: 'init-1',
                name: 'Feature Implementation',
                status: 'IN_PROGRESS',
                progress: 75
            }
        ],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-15'
    },
    {
        id: 'ws-2',
        name: 'Testing Workstream',
        description: 'Quality assurance activities',
        status: WorkstreamStatus.ON_HOLD,
        ownerId: 'user-2',
        owner: { firstName: 'Jane', lastName: 'Smith' },
        initiatives: [],
        createdAt: '2024-01-01',
        updatedAt: '2024-01-10'
    }
];

describe('WorkstreamBoard Component', () => {
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        global.localStorage = {
            getItem: vi.fn(() => 'mock-token'),
            setItem: vi.fn(),
            removeItem: vi.fn(),
            clear: vi.fn(),
            length: 0,
            key: vi.fn()
        } as any;

        // Mock API response
        vi.mocked(api.get).mockResolvedValue({ data: mockWorkstreams });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders workstream board title', () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            expect(screen.getByText('Workstreams')).toBeInTheDocument();
        });

        it('fetches workstreams on mount', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(api.get).toHaveBeenCalledWith('/projects/proj-1/workstreams');
            });
        });

        it('displays workstream cards', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
                expect(screen.getByText('Testing Workstream')).toBeInTheDocument();
            });
        });

        it('shows workstream status indicators', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Active')).toBeInTheDocument();
                expect(screen.getByText('On Hold')).toBeInTheDocument();
            });
        });
    });

    describe('Workstream Management', () => {
        it('shows add workstream button when canManage is true', () => {
            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            expect(screen.getByText('Add Workstream')).toBeInTheDocument();
        });

        it('hides add workstream button when canManage is false', () => {
            render(<WorkstreamBoard projectId="proj-1" canManage={false} />);

            expect(screen.queryByText('Add Workstream')).not.toBeInTheDocument();
        });

        it('opens add workstream modal', async () => {
            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            const addButton = screen.getByText('Add Workstream');
            await user.click(addButton);

            expect(screen.getByText('Create Workstream')).toBeInTheDocument();
        });

        it('creates new workstream', async () => {
            vi.mocked(api.post).mockResolvedValue({
                data: {
                    id: 'ws-3',
                    name: 'New Workstream',
                    status: WorkstreamStatus.ACTIVE
                }
            });

            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            const addButton = screen.getByText('Add Workstream');
            await user.click(addButton);

            const nameInput = screen.getByPlaceholderText('Workstream name');
            await user.type(nameInput, 'New Workstream');

            const descriptionInput = screen.getByPlaceholderText('Description (optional)');
            await user.type(descriptionInput, 'New workstream description');

            const createButton = screen.getByRole('button', { name: /create/i });
            await user.click(createButton);

            expect(api.post).toHaveBeenCalledWith('/projects/proj-1/workstreams', {
                name: 'New Workstream',
                description: 'New workstream description'
            });
        });
    });

    describe('Workstream Details', () => {
        it('displays initiative count', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('1 initiative')).toBeInTheDocument();
                expect(screen.getByText('0 initiatives')).toBeInTheDocument();
            });
        });

        it('shows owner information', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            });
        });

        it('displays progress information', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('75%')).toBeInTheDocument();
            });
        });
    });

    describe('Workstream Actions', () => {
        it('shows action menu for workstreams', async () => {
            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            });

            const menuButtons = screen.getAllByRole('button', { name: /more actions/i });
            expect(menuButtons.length).toBeGreaterThan(0);
        });

        it('allows editing workstream', async () => {
            vi.mocked(api.put).mockResolvedValue({ data: { success: true } });

            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            });

            const menuButtons = screen.getAllByRole('button', { name: /more actions/i });
            await user.click(menuButtons[0]);

            const editButton = screen.getByText('Edit');
            await user.click(editButton);

            const nameInput = screen.getByDisplayValue('Development Workstream');
            await user.clear(nameInput);
            await user.type(nameInput, 'Updated Workstream');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(api.put).toHaveBeenCalledWith('/projects/proj-1/workstreams/ws-1', {
                name: 'Updated Workstream',
                description: 'Handles all development activities'
            });
        });

        it('allows deleting workstream', async () => {
            vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });

            render(<WorkstreamBoard projectId="proj-1" canManage={true} />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            });

            const menuButtons = screen.getAllByRole('button', { name: /more actions/i });
            await user.click(menuButtons[0]);

            const deleteButton = screen.getByText('Delete');
            await user.click(deleteButton);

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            expect(api.delete).toHaveBeenCalledWith('/projects/proj-1/workstreams/ws-1');
        });
    });

    describe('Status Filtering', () => {
        it('shows status filter options', () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            expect(screen.getByText('All Status')).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
            expect(screen.getByText('On Hold')).toBeInTheDocument();
            expect(screen.getByText('Completed')).toBeInTheDocument();
        });

        it('filters workstreams by status', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            });

            const activeFilter = screen.getByText('Active');
            await user.click(activeFilter);

            expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            expect(screen.queryByText('Testing Workstream')).not.toBeInTheDocument();
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no workstreams', async () => {
            vi.mocked(api.get).mockResolvedValue({ data: [] });

            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('No workstreams created yet')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('shows loading indicator', () => {
            vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

            render(<WorkstreamBoard projectId="proj-1" />);

            expect(screen.getByText('Loading workstreams...')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('handles API error gracefully', async () => {
            vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Error loading workstreams')).toBeInTheDocument();
            });
        });
    });

    describe('Expandable Cards', () => {
        it('expands to show initiatives', async () => {
            render(<WorkstreamBoard projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Development Workstream')).toBeInTheDocument();
            });

            const expandButtons = screen.getAllByRole('button', { name: /expand/i });
            await user.click(expandButtons[0]);

            expect(screen.getByText('Feature Implementation')).toBeInTheDocument();
        });
    });
});

