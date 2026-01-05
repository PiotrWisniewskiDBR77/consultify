import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CompanyAddressSettings } from '../../../../components/admin/organization/CompanyAddressSettings';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../../store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('../../../../services/api', () => ({
    Api: {
        updateOrganization: vi.fn().mockResolvedValue({ success: true }),
        getOrganization: vi.fn().mockResolvedValue({
            address: {
                street: '123 Main St',
                city: 'Warsaw',
                state: 'Mazowieckie',
                postalCode: '00-001',
                country: 'Poland',
            },
        }),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

/**
 * CompanyAddressSettings Component Tests
 * Tests for company address management in organization settings
 */
describe('CompanyAddressSettings', () => {
    const defaultProps = {
        organizationId: 'org-1',
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                organization: {
                    id: 'org-1',
                    name: 'Test Org',
                    address: {
                        street: '123 Main St',
                        city: 'Warsaw',
                        state: 'Mazowieckie',
                        postalCode: '00-001',
                        country: 'Poland',
                    },
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
        it('should render address form fields', () => {
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/state/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
        });

        it('should display current address values', () => {
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            expect(screen.getByDisplayValue('123 Main St')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Warsaw')).toBeInTheDocument();
            expect(screen.getByDisplayValue('00-001')).toBeInTheDocument();
        });

        it('should show save button', () => {
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
        });
    });

    describe('Form Interactions', () => {
        it('should update street field', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const streetInput = screen.getByLabelText(/street/i);
            await user.clear(streetInput);
            await user.type(streetInput, '456 New St');

            expect(streetInput).toHaveValue('456 New St');
        });

        it('should update city field', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const cityInput = screen.getByLabelText(/city/i);
            await user.clear(cityInput);
            await user.type(cityInput, 'Krakow');

            expect(cityInput).toHaveValue('Krakow');
        });

        it('should update country from dropdown', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const countrySelect = screen.getByLabelText(/country/i);
            await user.selectOptions(countrySelect, 'Germany');

            expect(countrySelect).toHaveValue('Germany');
        });
    });

    describe('Validation', () => {
        it('should show error for empty required fields', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const streetInput = screen.getByLabelText(/street/i);
            await user.clear(streetInput);

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/street is required/i)).toBeInTheDocument();
            });
        });

        it('should validate postal code format', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const postalInput = screen.getByLabelText(/postal code/i);
            await user.clear(postalInput);
            await user.type(postalInput, 'invalid');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(screen.getByText(/invalid postal code/i)).toBeInTheDocument();
            });
        });
    });

    describe('Save Operation', () => {
        it('should save address on submit', async () => {
            const user = userEvent.setup();
            const updateOrg = vi.fn();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: {
                        id: 'org-1',
                        address: { street: '123 Main St', city: 'Warsaw' },
                    },
                    updateOrganization: updateOrg,
                };
                return selector(state);
            });

            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const streetInput = screen.getByLabelText(/street/i);
            await user.clear(streetInput);
            await user.type(streetInput, '456 New St');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(updateOrg).toHaveBeenCalled();
            });
        });

        it('should show success message on save', async () => {
            const user = userEvent.setup();
            const toast = await import('react-hot-toast');

            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.default.success).toHaveBeenCalledWith(
                    expect.stringContaining('saved')
                );
            });
        });

        it('should show error message on save failure', async () => {
            const user = userEvent.setup();
            const toast = await import('react-hot-toast');

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: { id: 'org-1', address: {} },
                    updateOrganization: vi.fn().mockRejectedValue(new Error('Save failed')),
                };
                return selector(state);
            });

            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            await waitFor(() => {
                expect(toast.default.error).toHaveBeenCalled();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper form labels', () => {
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            const inputs = screen.getAllByRole('textbox');
            inputs.forEach(input => {
                expect(input).toHaveAccessibleName();
            });
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<CompanyAddressSettings {...defaultProps} />);

            await user.keyboard('{Tab}');
            expect(screen.getByLabelText(/street/i)).toHaveFocus();

            await user.keyboard('{Tab}');
            expect(screen.getByLabelText(/city/i)).toHaveFocus();
        });
    });
});



