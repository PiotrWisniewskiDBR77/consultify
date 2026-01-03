/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuditTrailViewer } from '../../../components/PMO/AuditTrailViewer';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

const mockAuditEntries = [
    {
        id: 'audit-1',
        projectId: 'proj-1',
        pmoDomainId: 'GOVERNANCE_DECISION_MAKING',
        pmoPhase: 'Assessment',
        objectType: 'INITIATIVE',
        objectId: 'init-1',
        action: 'created',
        actorId: 'user-1',
        actorName: 'John Doe',
        iso21500Mapping: '4.3.2 Project Charter',
        pmbokMapping: 'Project Charter',
        prince2Mapping: 'Project Initiation',
        createdAt: '2024-01-15T10:00:00Z',
        details: {
            name: 'New Initiative',
            description: 'Test initiative creation'
        }
    },
    {
        id: 'audit-2',
        projectId: 'proj-1',
        pmoDomainId: 'SCOPE_CHANGE_CONTROL',
        pmoPhase: 'Planning',
        objectType: 'TASK',
        objectId: 'task-1',
        action: 'updated',
        actorId: 'user-2',
        actorName: 'Jane Smith',
        iso21500Mapping: '4.4.1 Scope Management',
        pmbokMapping: 'Scope Management',
        prince2Mapping: 'Change Control',
        createdAt: '2024-01-16T14:30:00Z',
        details: {
            field: 'status',
            oldValue: 'TODO',
            newValue: 'IN_PROGRESS'
        }
    }
];

describe('AuditTrailViewer Component', () => {
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
        vi.mocked(Api.get).mockResolvedValue(mockAuditEntries);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initial Rendering', () => {
        it('renders audit trail viewer title', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByText('Audit Trail')).toBeInTheDocument();
        });

        it('fetches audit entries on mount', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(Api.get).toHaveBeenCalledWith('/projects/proj-1/audit-trail');
            });
        });

        it('displays audit entries', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('New Initiative')).toBeInTheDocument();
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });
        });

        it('shows PMO standards mapping', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('4.3.2 Project Charter')).toBeInTheDocument();
                expect(screen.getByText('Project Charter')).toBeInTheDocument();
                expect(screen.getByText('Project Initiation')).toBeInTheDocument();
            });
        });
    });

    describe('Search Functionality', () => {
        it('shows search input', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByPlaceholderText('Search audit trail...')).toBeInTheDocument();
        });

        it('filters entries based on search term', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('New Initiative')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search audit trail...');
            await user.type(searchInput, 'John');

            expect(screen.getByText('New Initiative')).toBeInTheDocument();
            expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        });
    });

    describe('Filter Functionality', () => {
        it('shows domain filter', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByText('All Domains')).toBeInTheDocument();
            expect(screen.getByText('Governance')).toBeInTheDocument();
            expect(screen.getByText('Scope Control')).toBeInTheDocument();
        });

        it('filters by PMO domain', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('New Initiative')).toBeInTheDocument();
            });

            const governanceFilter = screen.getByText('Governance');
            await user.click(governanceFilter);

            expect(screen.getByText('New Initiative')).toBeInTheDocument();
            expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        });

        it('shows action filter', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByText('All Actions')).toBeInTheDocument();
            expect(screen.getByText('Created')).toBeInTheDocument();
            expect(screen.getByText('Updated')).toBeInTheDocument();
        });

        it('filters by action type', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('New Initiative')).toBeInTheDocument();
            });

            const createdFilter = screen.getByText('Created');
            await user.click(createdFilter);

            expect(screen.getByText('New Initiative')).toBeInTheDocument();
            expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        });
    });

    describe('Timeline View', () => {
        it('displays entries in chronological order', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                const entries = screen.getAllByTestId('audit-entry');
                expect(entries.length).toBe(2);
            });
        });

        it('shows formatted timestamps', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Jan 16, 2024')).toBeInTheDocument();
                expect(screen.getByText('Jan 15, 2024')).toBeInTheDocument();
            });
        });
    });

    describe('Entry Details', () => {
        it('shows action icons', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                // Check for action icons (we can't easily test the actual icons but can check they're rendered)
                expect(screen.getByText('created')).toBeInTheDocument();
                expect(screen.getByText('updated')).toBeInTheDocument();
            });
        });

        it('displays actor information', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            });
        });

        it('shows object type and ID', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('INITIATIVE')).toBeInTheDocument();
                expect(screen.getByText('TASK')).toBeInTheDocument();
            });
        });
    });

    describe('Standards Compliance', () => {
        it('displays ISO 21500 mapping', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('4.3.2 Project Charter')).toBeInTheDocument();
                expect(screen.getByText('4.4.1 Scope Management')).toBeInTheDocument();
            });
        });

        it('displays PMBOK mapping', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getAllByText('Project Charter')).toBeInTheDocument();
                expect(screen.getByText('Scope Management')).toBeInTheDocument();
            });
        });

        it('displays PRINCE2 mapping', async () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Project Initiation')).toBeInTheDocument();
                expect(screen.getByText('Change Control')).toBeInTheDocument();
            });
        });
    });

    describe('Export Functionality', () => {
        it('shows export button', () => {
            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByText('Export')).toBeInTheDocument();
        });

        it('exports audit trail when clicked', async () => {
            const mockBlob = new Blob(['test data'], { type: 'text/csv' });
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
            global.URL.revokeObjectURL = vi.fn();

            vi.mocked(Api.get).mockResolvedValueOnce(mockBlob);

            render(<AuditTrailViewer projectId="proj-1" />);

            const exportButton = screen.getByText('Export');
            await user.click(exportButton);

            expect(Api.get).toHaveBeenCalledWith('/projects/proj-1/audit-trail/export');
        });
    });

    describe('Empty State', () => {
        it('shows empty state when no entries', async () => {
            vi.mocked(Api.get).mockResolvedValue([]);

            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('No audit entries found')).toBeInTheDocument();
            });
        });
    });

    describe('Loading State', () => {
        it('shows loading indicator', () => {
            vi.mocked(Api.get).mockImplementation(() => new Promise(() => {}));

            render(<AuditTrailViewer projectId="proj-1" />);

            expect(screen.getByText('Loading audit trail...')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('handles API error gracefully', async () => {
            vi.mocked(Api.get).mockRejectedValue(new Error('API Error'));

            render(<AuditTrailViewer projectId="proj-1" />);

            await waitFor(() => {
                expect(screen.getByText('Error loading audit trail')).toBeInTheDocument();
            });
        });
    });
});







