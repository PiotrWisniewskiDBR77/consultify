import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkingHoursEditor } from '../../../../src/components/Admin/team/WorkingHoursEditor';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

/**
 * WorkingHoursEditor Component Tests
 * Tests for user working hours configuration with weekly schedule grid
 * CRITICAL FOR ENTERPRISE CAPACITY PLANNING
 */
describe('WorkingHoursEditor', () => {
    const defaultWorkingHours = {
        monday: { enabled: true, start: '09:00', end: '17:00' },
        tuesday: { enabled: true, start: '09:00', end: '17:00' },
        wednesday: { enabled: true, start: '09:00', end: '17:00' },
        thursday: { enabled: true, start: '09:00', end: '17:00' },
        friday: { enabled: true, start: '09:00', end: '17:00' },
        saturday: { enabled: false, start: '09:00', end: '13:00' },
        sunday: { enabled: false, start: '', end: '' },
    };

    const defaultProps = {
        userId: 'user-1',
        workingHours: defaultWorkingHours,
        onSave: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                user: { id: 'admin-1', role: 'ADMIN' },
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render all 7 days of the week', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            expect(screen.getByText(/monday/i)).toBeInTheDocument();
            expect(screen.getByText(/tuesday/i)).toBeInTheDocument();
            expect(screen.getByText(/wednesday/i)).toBeInTheDocument();
            expect(screen.getByText(/thursday/i)).toBeInTheDocument();
            expect(screen.getByText(/friday/i)).toBeInTheDocument();
            expect(screen.getByText(/saturday/i)).toBeInTheDocument();
            expect(screen.getByText(/sunday/i)).toBeInTheDocument();
        });

        it('should show toggle for each day', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const toggles = screen.getAllByRole('checkbox');
            expect(toggles).toHaveLength(7);
        });

        it('should show time inputs for enabled days', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            expect(within(mondayRow!).getByLabelText(/start/i)).toBeInTheDocument();
            expect(within(mondayRow!).getByLabelText(/end/i)).toBeInTheDocument();
        });

        it('should hide time inputs for disabled days', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const sundayRow = screen.getByText(/sunday/i).closest('[data-day]');
            expect(within(sundayRow!).queryByLabelText(/start/i)).toBeNull();
        });

        it('should display current working hours', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            expect(screen.getByDisplayValue('09:00')).toBeInTheDocument();
            expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
        });
    });

    describe('Day Toggle', () => {
        it('should toggle day enabled state', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const saturdayToggle = screen.getByTestId('toggle-saturday');
            await user.click(saturdayToggle);

            expect(saturdayToggle).toBeChecked();
        });

        it('should show time inputs when day is enabled', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const sundayToggle = screen.getByTestId('toggle-sunday');
            await user.click(sundayToggle);

            const sundayRow = screen.getByText(/sunday/i).closest('[data-day]');
            expect(within(sundayRow!).getByLabelText(/start/i)).toBeInTheDocument();
        });

        it('should hide time inputs when day is disabled', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayToggle = screen.getByTestId('toggle-monday');
            await user.click(mondayToggle);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            expect(within(mondayRow!).queryByLabelText(/start/i)).toBeNull();
        });
    });

    describe('Time Editing', () => {
        it('should update start time', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const startInput = within(mondayRow!).getByLabelText(/start/i);

            await user.clear(startInput);
            await user.type(startInput, '08:00');

            expect(startInput).toHaveValue('08:00');
        });

        it('should update end time', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const endInput = within(mondayRow!).getByLabelText(/end/i);

            await user.clear(endInput);
            await user.type(endInput, '18:00');

            expect(endInput).toHaveValue('18:00');
        });

        it('should validate time range', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const startInput = within(mondayRow!).getByLabelText(/start/i);
            const endInput = within(mondayRow!).getByLabelText(/end/i);

            await user.clear(startInput);
            await user.type(startInput, '18:00');
            await user.clear(endInput);
            await user.type(endInput, '09:00');

            await waitFor(() => {
                expect(screen.getByText(/end time.*after start/i)).toBeInTheDocument();
            });
        });
    });

    describe('Presets', () => {
        it('should show preset options', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            expect(screen.getByText(/presets/i)).toBeInTheDocument();
        });

        it('should apply 9-5 preset', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const preset9to5 = screen.getByRole('button', { name: /9-5/i });
            await user.click(preset9to5);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            expect(within(mondayRow!).getByDisplayValue('09:00')).toBeInTheDocument();
            expect(within(mondayRow!).getByDisplayValue('17:00')).toBeInTheDocument();
        });

        it('should apply flexible hours preset', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const flexiblePreset = screen.getByRole('button', { name: /flexible/i });
            await user.click(flexiblePreset);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            expect(within(mondayRow!).getByDisplayValue('08:00')).toBeInTheDocument();
            expect(within(mondayRow!).getByDisplayValue('20:00')).toBeInTheDocument();
        });
    });

    describe('Copy Functionality', () => {
        it('should copy hours to all days', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const copyButton = within(mondayRow!).getByRole('button', { name: /copy to all/i });
            await user.click(copyButton);

            // All days should have same hours as Monday
            const tuesdayRow = screen.getByText(/tuesday/i).closest('[data-day]');
            expect(within(tuesdayRow!).getByDisplayValue('09:00')).toBeInTheDocument();
        });

        it('should copy hours to weekdays only', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const copyButton = within(mondayRow!).getByRole('button', { name: /copy to weekdays/i });
            await user.click(copyButton);

            // Saturday should remain unchanged
            const saturdayRow = screen.getByText(/saturday/i).closest('[data-day]');
            const satToggle = within(saturdayRow!).getByRole('checkbox');
            expect(satToggle).not.toBeChecked();
        });
    });

    describe('Save Operation', () => {
        it('should call onSave with updated hours', async () => {
            const user = userEvent.setup();
            const onSave = vi.fn();

            renderWithProviders(<WorkingHoursEditor {...defaultProps} onSave={onSave} />);

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
                monday: expect.objectContaining({ enabled: true }),
            }));
        });

        it('should show success message on save', async () => {
            const user = userEvent.setup();
            const toast = await import('react-hot-toast');

            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(toast.default.success).toHaveBeenCalled();
        });

        it('should disable save when no changes', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).toBeDisabled();
        });
    });

    describe('Weekly Hours Summary', () => {
        it('should calculate total weekly hours', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            // 5 days * 8 hours = 40 hours
            expect(screen.getByText(/40.*hours.*week/i)).toBeInTheDocument();
        });

        it('should update total when hours change', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const saturdayToggle = screen.getByTestId('toggle-saturday');
            await user.click(saturdayToggle);

            // Now 5 days * 8 hours + 1 day * 4 hours = 44 hours
            await waitFor(() => {
                expect(screen.getByText(/44.*hours.*week/i)).toBeInTheDocument();
            });
        });
    });

    describe('Timezone', () => {
        it('should display user timezone', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} timezone="Europe/Warsaw" />);

            expect(screen.getByText(/Europe\/Warsaw/)).toBeInTheDocument();
        });

        it('should show timezone selector', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            expect(screen.getByLabelText(/timezone/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper labels for time inputs', () => {
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            const startInput = within(mondayRow!).getByLabelText(/start/i);
            const endInput = within(mondayRow!).getByLabelText(/end/i);

            expect(startInput).toHaveAccessibleName();
            expect(endInput).toHaveAccessibleName();
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<WorkingHoursEditor {...defaultProps} />);

            await user.keyboard('{Tab}');
            expect(screen.getByTestId('toggle-monday')).toHaveFocus();

            await user.keyboard('{Tab}');
            const mondayRow = screen.getByText(/monday/i).closest('[data-day]');
            expect(within(mondayRow!).getByLabelText(/start/i)).toHaveFocus();
        });
    });
});




