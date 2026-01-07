import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SeatAllocationView } from '../../../../src/components/Admin/billing/SeatAllocationView';

// Mock dependencies
vi.mock('../../../../services/api', () => ({
    Api: {
        getSeatAllocation: vi.fn().mockResolvedValue({
            total: 50,
            used: 35,
            available: 15,
            seatTypes: [
                { type: 'FULL', total: 30, used: 25 },
                { type: 'LIMITED', total: 15, used: 8 },
                { type: 'GUEST', total: 5, used: 2 },
            ],
            users: [
                { id: 'user-1', name: 'John Doe', seatType: 'FULL', lastActive: '2024-12-20' },
                { id: 'user-2', name: 'Jane Smith', seatType: 'LIMITED', lastActive: '2024-12-19' },
            ],
        }),
        updateSeatAllocation: vi.fn().mockResolvedValue({ success: true }),
        addSeats: vi.fn().mockResolvedValue({ success: true }),
        removeSeats: vi.fn().mockResolvedValue({ success: true }),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

/**
 * SeatAllocationView Component Tests
 * Tests for seat allocation dashboard and management
 * CRITICAL FOR ENTERPRISE BILLING & LICENSE MANAGEMENT
 */
describe('SeatAllocationView', () => {
    const defaultProps = {
        organizationId: 'org-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render seat overview', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/seat allocation/i)).toBeInTheDocument();
            });
        });

        it('should display total seats', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/50.*total/i)).toBeInTheDocument();
            });
        });

        it('should show used vs available seats', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/35.*used/i)).toBeInTheDocument();
                expect(screen.getByText(/15.*available/i)).toBeInTheDocument();
            });
        });

        it('should display seat utilization chart', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByTestId('seat-utilization-chart')).toBeInTheDocument();
            });
        });

        it('should show seat types breakdown', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/full/i)).toBeInTheDocument();
                expect(screen.getByText(/limited/i)).toBeInTheDocument();
                expect(screen.getByText(/guest/i)).toBeInTheDocument();
            });
        });
    });

    describe('Seat Type Breakdown', () => {
        it('should show usage for each seat type', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                const fullRow = screen.getByText(/full/i).closest('[data-seat-type]');
                expect(within(fullRow!).getByText(/25.*30/)).toBeInTheDocument();
            });
        });

        it('should display progress bars for each type', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                const progressBars = screen.getAllByRole('progressbar');
                expect(progressBars.length).toBeGreaterThanOrEqual(3);
            });
        });

        it('should highlight near-capacity seat types', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                const fullRow = screen.getByText(/full/i).closest('[data-seat-type]');
                expect(fullRow).toHaveClass('warning');
            });
        });
    });

    describe('User List', () => {
        it('should display users with seat assignments', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
                expect(screen.getByText('Jane Smith')).toBeInTheDocument();
            });
        });

        it('should show seat type for each user', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                const johnRow = screen.getByText('John Doe').closest('tr');
                expect(within(johnRow!).getByText(/full/i)).toBeInTheDocument();
            });
        });

        it('should show last active date', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                const johnRow = screen.getByText('John Doe').closest('tr');
                expect(within(johnRow!).getByText(/2024-12-20|Dec 20/i)).toBeInTheDocument();
            });
        });

        it('should allow filtering by seat type', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const filterSelect = screen.getByLabelText(/filter.*seat type/i);
            await user.selectOptions(filterSelect, 'FULL');

            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        });
    });

    describe('Seat Management', () => {
        it('should allow changing user seat type', async () => {
            const user = userEvent.setup();
            const { Api } = await import('../../../../services/api');

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const johnRow = screen.getByText('John Doe').closest('tr');
            const seatSelect = within(johnRow!).getByRole('combobox');
            await user.selectOptions(seatSelect, 'LIMITED');

            expect(Api.updateSeatAllocation).toHaveBeenCalledWith('user-1', 'LIMITED');
        });

        it('should show confirmation for seat type change', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const johnRow = screen.getByText('John Doe').closest('tr');
            const seatSelect = within(johnRow!).getByRole('combobox');
            await user.selectOptions(seatSelect, 'LIMITED');

            expect(screen.getByText(/confirm.*change/i)).toBeInTheDocument();
        });
    });

    describe('Add/Remove Seats', () => {
        it('should show add seats button', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /add seats/i })).toBeInTheDocument();
            });
        });

        it('should open add seats modal', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /add seats/i })).toBeInTheDocument();
            });

            const addButton = screen.getByRole('button', { name: /add seats/i });
            await user.click(addButton);

            expect(screen.getByText(/add.*seats/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/number of seats/i)).toBeInTheDocument();
        });

        it('should show prorated billing preview', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /add seats/i })).toBeInTheDocument();
            });

            const addButton = screen.getByRole('button', { name: /add seats/i });
            await user.click(addButton);

            const seatsInput = screen.getByLabelText(/number of seats/i);
            await user.type(seatsInput, '5');

            expect(screen.getByText(/prorated.*cost/i)).toBeInTheDocument();
        });

        it('should add seats on confirm', async () => {
            const user = userEvent.setup();
            const { Api } = await import('../../../../services/api');

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /add seats/i })).toBeInTheDocument();
            });

            const addButton = screen.getByRole('button', { name: /add seats/i });
            await user.click(addButton);

            const seatsInput = screen.getByLabelText(/number of seats/i);
            await user.type(seatsInput, '5');

            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            expect(Api.addSeats).toHaveBeenCalledWith('org-1', 5, expect.any(String));
        });
    });

    describe('Seat Recommendations', () => {
        it('should show inactive user recommendations', async () => {
            const { Api } = await import('../../../../services/api');
            Api.getSeatAllocation.mockResolvedValueOnce({
                total: 50,
                used: 50,
                available: 0,
                users: [
                    { id: 'user-1', name: 'John Doe', seatType: 'FULL', lastActive: '2024-06-01' }, // Inactive
                ],
                recommendations: [
                    { type: 'inactive', userId: 'user-1', message: 'Inactive for 6 months' },
                ],
            });

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/inactive.*6 months/i)).toBeInTheDocument();
            });
        });

        it('should show upgrade recommendations when at capacity', async () => {
            const { Api } = await import('../../../../services/api');
            Api.getSeatAllocation.mockResolvedValueOnce({
                total: 50,
                used: 50,
                available: 0,
                seatTypes: [],
                users: [],
            });

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/at capacity/i)).toBeInTheDocument();
                expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();
            });
        });
    });

    describe('Export', () => {
        it('should allow exporting seat allocation report', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
            });

            const exportButton = screen.getByRole('button', { name: /export/i });
            await user.click(exportButton);

            expect(screen.getByText(/csv/i)).toBeInTheDocument();
            expect(screen.getByText(/excel/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper table semantics', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByRole('table')).toBeInTheDocument();
            });
        });

        it('should announce seat changes to screen readers', async () => {
            const user = userEvent.setup();
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText('John Doe')).toBeInTheDocument();
            });

            const johnRow = screen.getByText('John Doe').closest('tr');
            const seatSelect = within(johnRow!).getByRole('combobox');
            await user.selectOptions(seatSelect, 'LIMITED');

            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveTextContent(/seat type.*changed/i);
        });
    });

    describe('Loading & Error States', () => {
        it('should show loading skeleton', async () => {
            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            expect(screen.getByTestId('seat-allocation-skeleton')).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.queryByTestId('seat-allocation-skeleton')).not.toBeInTheDocument();
            });
        });

        it('should show error state', async () => {
            const { Api } = await import('../../../../services/api');
            Api.getSeatAllocation.mockRejectedValueOnce(new Error('Failed to load'));

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
            });
        });

        it('should allow retry on error', async () => {
            const user = userEvent.setup();
            const { Api } = await import('../../../../services/api');
            Api.getSeatAllocation.mockRejectedValueOnce(new Error('Failed to load'));

            renderWithProviders(<SeatAllocationView {...defaultProps} />);

            await waitFor(() => {
                expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
            });

            const retryButton = screen.getByRole('button', { name: /retry/i });
            await user.click(retryButton);

            expect(Api.getSeatAllocation).toHaveBeenCalledTimes(2);
        });
    });
});




