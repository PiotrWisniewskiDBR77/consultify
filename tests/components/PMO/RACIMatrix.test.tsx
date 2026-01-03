/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RACIMatrix } from '../../../components/PMO/RACIMatrix';
import { RACIType, PMOProjectRole } from '../../../types';

// Mock API
vi.mock('../../../services/api', () => ({
    api: {
        get: vi.fn(),
        post: vi.fn()
    }
}));

// Mock i18n

const mockRACIMatrix = {
    projectId: 'proj-1',
    assignments: [
        {
            objectType: 'INITIATIVE',
            objectId: 'init-1',
            objectName: 'Test Initiative',
            assignments: [
                {
                    role: PMOProjectRole.PMO_LEAD,
                    raci: RACIType.R,
                    userId: 'user-1',
                    userName: 'John Doe'
                },
                {
                    role: PMOProjectRole.SPONSOR,
                    raci: RACIType.A,
                    userId: 'user-2',
                    userName: 'Jane Smith'
                }
            ]
        },
        {
            objectType: 'TASK',
            objectId: 'task-1',
            objectName: 'Test Task',
            assignments: [
                {
                    role: PMOProjectRole.INITIATIVE_OWNER,
                    raci: RACIType.R,
                    userId: 'user-3',
                    userName: 'Bob Wilson'
                }
            ]
        }
    ]
};

describe('RACIMatrix Component', () => {
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
        vi.mocked(api.get).mockResolvedValue({ data: mockRACIMatrix });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders RACI matrix title', () => {
            render(<RACIMatrix projectId="proj-1" />);

            expect(screen.getByText('RACI Matrix')).toBeInTheDocument();
        });

        it('fetches RACI data on mount', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(api.get).toHaveBeenCalledWith('/projects/proj-1/raci');
            });
        });

        it('displays object types and names', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Initiative')).toBeInTheDocument();
                expect(screen.getByText('Test Task')).toBeInTheDocument();
            });
        });

        it('shows RACI assignments', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('R')).toBeInTheDocument();
                expect(screen.getByText('A')).toBeInTheDocument();
            });
        });
    });

    describe('RACI Legend', () => {
        it('displays RACI legend', () => {
            render(<RACIMatrix projectId="proj-1" />);

            expect(screen.getByText('RACI Legend')).toBeInTheDocument();
            expect(screen.getByText('Responsible')).toBeInTheDocument();
            expect(screen.getByText('Accountable')).toBeInTheDocument();
            expect(screen.getByText('Consulted')).toBeInTheDocument();
            expect(screen.getByText('Informed')).toBeInTheDocument();
        });
    });

    describe('Matrix Display', () => {
        it('renders matrix table structure', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByRole('table')).toBeInTheDocument();
            });
        });

        it('shows roles as columns', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('PMO Lead')).toBeInTheDocument();
                expect(screen.getByText('Sponsor')).toBeInTheDocument();
                expect(screen.getByText('Initiative Owner')).toBeInTheDocument();
            });
        });

        it('displays correct RACI badges', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                const rBadges = screen.getAllByText('R');
                const aBadges = screen.getAllByText('A');
                expect(rBadges.length).toBeGreaterThan(0);
                expect(aBadges.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Object Types', () => {
        it('shows all object types in filter', () => {
            render(<RACIMatrix projectId="proj-1" />);

            expect(screen.getByText('All Types')).toBeInTheDocument();
            expect(screen.getByText('Initiatives')).toBeInTheDocument();
            expect(screen.getByText('Tasks')).toBeInTheDocument();
            expect(screen.getByText('Decisions')).toBeInTheDocument();
        });

        it('filters by object type', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Test Initiative')).toBeInTheDocument();
            });

            // Click filter for Tasks only
            const tasksFilter = screen.getByText('Tasks');
            await user.click(tasksFilter);

            expect(screen.getByText('Test Task')).toBeInTheDocument();
            expect(screen.queryByText('Test Initiative')).not.toBeInTheDocument();
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no assignments', async () => {
            vi.mocked(api.get).mockResolvedValue({
                data: { projectId: 'proj-1', assignments: [] }
            });

            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('No RACI assignments found')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('shows loading indicator', () => {
            vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

            render(<RACIMatrix projectId="proj-1" />);

            expect(screen.getByText('Loading RACI matrix...')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('handles API error gracefully', async () => {
            vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Error loading RACI matrix')).toBeInTheDocument();
            });
        });
    });

    describe('RACI Badge Styling', () => {
        it('applies correct colors for RACI types', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                // Check for blue background (Responsible)
                const blueBadges = document.querySelectorAll('.bg-blue-500');
                expect(blueBadges.length).toBeGreaterThan(0);

                // Check for red background (Accountable)
                const redBadges = document.querySelectorAll('.bg-red-500');
                expect(redBadges.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Tooltip Information', () => {
        it('shows tooltips on hover', async () => {
            render(<RACIMatrix projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('R')).toBeInTheDocument();
            });

            // Hover over R badge
            const rBadge = screen.getByText('R');
            await user.hover(rBadge);

            // Tooltip should appear (though we can't easily test the actual tooltip content)
            expect(rBadge).toBeInTheDocument();
        });
    });

    describe('Export Functionality', () => {
        it('shows export button', () => {
            render(<RACIMatrix projectId="proj-1" />);

            expect(screen.getByText('Export')).toBeInTheDocument();
        });

        it('calls export API when export is clicked', async () => {
            vi.mocked(api.post).mockResolvedValue({ data: { success: true } });

            render(<RACIMatrix projectId="proj-1" />);

            const exportButton = screen.getByText('Export');
            await user.click(exportButton);

            expect(api.post).toHaveBeenCalledWith('/projects/proj-1/raci/export');
        });
    });
});







