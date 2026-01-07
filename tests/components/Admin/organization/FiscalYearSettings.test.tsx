import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FiscalYearSettings } from '../../../../src/components/Admin/organization/FiscalYearSettings';

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
 * FiscalYearSettings Component Tests
 * Tests for fiscal year configuration with quarter preview
 */
describe('FiscalYearSettings', () => {
    const defaultProps = {
        organizationId: 'org-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                organization: {
                    id: 'org-1',
                    fiscalYearStart: 1, // January
                },
                updateOrganization: vi.fn(),
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render fiscal year start month selector', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            expect(screen.getByLabelText(/fiscal year start/i)).toBeInTheDocument();
        });

        it('should display all 12 months', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const monthOptions = screen.getAllByRole('option');
            expect(monthOptions).toHaveLength(12);
        });

        it('should show quarter preview', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            expect(screen.getByText(/Q1/i)).toBeInTheDocument();
            expect(screen.getByText(/Q2/i)).toBeInTheDocument();
            expect(screen.getByText(/Q3/i)).toBeInTheDocument();
            expect(screen.getByText(/Q4/i)).toBeInTheDocument();
        });

        it('should display current fiscal year start', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            expect(select).toHaveValue('1');
        });
    });

    describe('Quarter Preview', () => {
        it('should update quarters when month changes', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '4'); // April

            // Q1 should now be Apr-Jun
            expect(screen.getByText(/Apr.*Jun/i)).toBeInTheDocument();
        });

        it('should show correct date ranges for each quarter', () => {
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: {
                        id: 'org-1',
                        fiscalYearStart: 4, // April
                    },
                    updateOrganization: vi.fn(),
                };
                return selector(state);
            });

            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            // For April start:
            // Q1: Apr-Jun, Q2: Jul-Sep, Q3: Oct-Dec, Q4: Jan-Mar
            expect(screen.getByText(/Q1.*Apr.*Jun/i)).toBeInTheDocument();
            expect(screen.getByText(/Q2.*Jul.*Sep/i)).toBeInTheDocument();
        });
    });

    describe('Form Interactions', () => {
        it('should change fiscal year start month', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '7'); // July

            expect(select).toHaveValue('7');
        });

        it('should enable save button on change', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '7');

            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).not.toBeDisabled();
        });
    });

    describe('Save Operation', () => {
        it('should save fiscal year settings', async () => {
            const user = userEvent.setup();
            const updateOrg = vi.fn();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: { id: 'org-1', fiscalYearStart: 1 },
                    updateOrganization: updateOrg,
                };
                return selector(state);
            });

            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '4');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(updateOrg).toHaveBeenCalledWith(
                    expect.objectContaining({ fiscalYearStart: 4 })
                );
            });
        });

        it('should show confirmation dialog for mid-year changes', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '7');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/affect reports/i)).toBeInTheDocument();
            });
        });
    });

    describe('Help Text', () => {
        it('should show explanation of fiscal year impact', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            expect(screen.getByText(/affect.*reporting/i)).toBeInTheDocument();
        });

        it('should show info icon with tooltip', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const infoIcon = screen.getByTestId('fiscal-year-info');
            await user.hover(infoIcon);

            await waitFor(() => {
                expect(screen.getByRole('tooltip')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper select labeling', () => {
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            expect(select).toHaveAccessibleName();
        });

        it('should announce quarter changes to screen readers', async () => {
            const user = userEvent.setup();
            renderWithProviders(<FiscalYearSettings {...defaultProps} />);

            const select = screen.getByLabelText(/fiscal year start/i);
            await user.selectOptions(select, '4');

            const liveRegion = screen.getByRole('status');
            expect(liveRegion).toHaveTextContent(/quarters updated/i);
        });
    });
});




