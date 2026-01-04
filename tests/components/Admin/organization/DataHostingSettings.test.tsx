import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataHostingSettings } from '../../../../components/admin/organization/DataHostingSettings';

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
 * DataHostingSettings Component Tests
 * Tests for data hosting location selection with compliance badges
 */
describe('DataHostingSettings', () => {
    const defaultProps = {
        organizationId: 'org-1',
    };

    const hostingRegions = [
        { id: 'eu-west', name: 'EU West (Frankfurt)', compliance: ['GDPR', 'ISO27001'] },
        { id: 'us-east', name: 'US East (Virginia)', compliance: ['SOC2', 'HIPAA'] },
        { id: 'ap-south', name: 'Asia Pacific (Singapore)', compliance: ['PDPA'] },
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                organization: {
                    id: 'org-1',
                    dataHostingRegion: 'eu-west',
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
        it('should render region selection', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            expect(screen.getByText(/data hosting/i)).toBeInTheDocument();
        });

        it('should display available regions', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            hostingRegions.forEach(region => {
                expect(screen.getByText(region.name)).toBeInTheDocument();
            });
        });

        it('should show current region as selected', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const euRegion = screen.getByText('EU West (Frankfurt)');
            expect(euRegion.closest('[data-selected]')).toHaveAttribute('data-selected', 'true');
        });

        it('should display compliance badges', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            expect(screen.getByText('GDPR')).toBeInTheDocument();
            expect(screen.getByText('ISO27001')).toBeInTheDocument();
        });
    });

    describe('Region Selection', () => {
        it('should select different region on click', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            expect(usRegion.closest('[data-selected]')).toHaveAttribute('data-selected', 'true');
        });

        it('should show confirmation dialog for region change', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            await waitFor(() => {
                expect(screen.getByText(/data migration/i)).toBeInTheDocument();
            });
        });

        it('should show migration warning', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            await waitFor(() => {
                expect(screen.getByText(/downtime/i)).toBeInTheDocument();
            });
        });
    });

    describe('Compliance Badges', () => {
        it('should show compliance info on hover', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const gdprBadge = screen.getByText('GDPR');
            await user.hover(gdprBadge);

            await waitFor(() => {
                expect(screen.getByText(/general data protection/i)).toBeInTheDocument();
            });
        });

        it('should update badges when region changes', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            expect(screen.getByText('SOC2')).toBeInTheDocument();
            expect(screen.getByText('HIPAA')).toBeInTheDocument();
        });
    });

    describe('Save Operation', () => {
        it('should save region change after confirmation', async () => {
            const user = userEvent.setup();
            const updateOrg = vi.fn();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: { id: 'org-1', dataHostingRegion: 'eu-west' },
                    updateOrganization: updateOrg,
                };
                return selector(state);
            });

            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            const confirmButton = await screen.findByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            await waitFor(() => {
                expect(updateOrg).toHaveBeenCalledWith(
                    expect.objectContaining({ dataHostingRegion: 'us-east' })
                );
            });
        });

        it('should cancel region change when cancelled', async () => {
            const user = userEvent.setup();
            const updateOrg = vi.fn();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: { id: 'org-1', dataHostingRegion: 'eu-west' },
                    updateOrganization: updateOrg,
                };
                return selector(state);
            });

            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const usRegion = screen.getByText('US East (Virginia)');
            await user.click(usRegion);

            const cancelButton = await screen.findByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            expect(updateOrg).not.toHaveBeenCalled();
        });
    });

    describe('Region Restrictions', () => {
        it('should show unavailable regions as disabled', () => {
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: {
                        id: 'org-1',
                        dataHostingRegion: 'eu-west',
                        plan: 'basic', // Basic plan may have limited regions
                    },
                    updateOrganization: vi.fn(),
                };
                return selector(state);
            });

            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const apRegion = screen.getByText('Asia Pacific (Singapore)');
            expect(apRegion.closest('button')).toBeDisabled();
        });

        it('should show upgrade prompt for restricted regions', async () => {
            const user = userEvent.setup();

            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: {
                        id: 'org-1',
                        dataHostingRegion: 'eu-west',
                        plan: 'basic',
                    },
                    updateOrganization: vi.fn(),
                };
                return selector(state);
            });

            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const apRegion = screen.getByText('Asia Pacific (Singapore)');
            await user.click(apRegion);

            await waitFor(() => {
                expect(screen.getByText(/upgrade.*enterprise/i)).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper radio group semantics', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            expect(screen.getByRole('radiogroup')).toBeInTheDocument();
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            await user.keyboard('{Tab}');
            await user.keyboard('{ArrowDown}');

            const focusedRegion = document.activeElement;
            expect(focusedRegion).toHaveAttribute('role', 'radio');
        });

        it('should announce compliance info for screen readers', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            const euRegion = screen.getByText('EU West (Frankfurt)').closest('[role="radio"]');
            expect(euRegion).toHaveAccessibleDescription(/GDPR/);
        });
    });

    describe('Current Region Display', () => {
        it('should show data residency summary', () => {
            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            expect(screen.getByText(/data.*stored.*EU/i)).toBeInTheDocument();
        });

        it('should show last migration date if applicable', () => {
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    organization: {
                        id: 'org-1',
                        dataHostingRegion: 'eu-west',
                        lastMigrationDate: '2024-01-15',
                    },
                    updateOrganization: vi.fn(),
                };
                return selector(state);
            });

            renderWithProviders(<DataHostingSettings {...defaultProps} />);

            expect(screen.getByText(/last.*migration.*2024/i)).toBeInTheDocument();
        });
    });
});

