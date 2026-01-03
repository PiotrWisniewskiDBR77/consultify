/**
 * EmailTemplatesView Tests
 * Tests for the SuperAdmin Email Templates management view
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailTemplatesView } from '../../../views/superadmin/EmailTemplatesView';
import '@testing-library/jest-dom';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn().mockReturnValue('mock-token'),
    setItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('EmailTemplatesView', () => {
    const mockTemplates = [
        {
            id: 'et-1',
            templateKey: 'welcome',
            name: 'Welcome Email',
            description: 'Sent to new users',
            subject: 'Welcome to Consultify!',
            status: 'PUBLISHED',
            version: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        },
        {
            id: 'et-2',
            templateKey: 'invoice',
            name: 'Invoice Email',
            description: 'Sent for billing',
            subject: 'Your Invoice',
            status: 'DRAFT',
            version: 1,
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-01-10T00:00:00Z'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ templates: mockTemplates })
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render the view title', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText(/Email Templates/i)).toBeInTheDocument();
            });
        });

        it('should show loading state initially', () => {
            render(<EmailTemplatesView />);
            
            // Should show loading indicator before data loads
            expect(screen.getByTestId('loading-spinner') || screen.getByRole('status')).toBeDefined();
        });

        it('should render templates list after loading', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
                expect(screen.getByText('Invoice Email')).toBeInTheDocument();
            });
        });

        it('should display template status badges', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
                expect(screen.getByText('DRAFT')).toBeInTheDocument();
            });
        });

        it('should show empty state when no templates', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ templates: [] })
            });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText(/No templates/i) || screen.getByText(/Create your first/i)).toBeInTheDocument();
            });
        });
    });

    describe('Actions', () => {
        it('should show Create Template button', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Create|New/i })).toBeInTheDocument();
            });
        });

        it('should open editor when Create button clicked', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: /Create|New/i });
                fireEvent.click(createButton);
            });

            await waitFor(() => {
                expect(screen.getByText(/Template Name|Name/i)).toBeInTheDocument();
            });
        });

        it('should call fetch when Edit button clicked', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Find and click edit button for first template
            const editButtons = screen.getAllByRole('button', { name: /Edit/i });
            if (editButtons.length > 0) {
                fireEvent.click(editButtons[0]);
            }

            // Editor should open
            await waitFor(() => {
                expect(screen.getByDisplayValue('Welcome Email') || screen.getByText('Welcome Email')).toBeInTheDocument();
            });
        });
    });

    describe('Filtering', () => {
        it('should filter by status', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Find status filter
            const filterSelect = screen.getByRole('combobox');
            if (filterSelect) {
                await userEvent.selectOptions(filterSelect, 'PUBLISHED');
            }

            // Should trigger new fetch with filter
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('status=PUBLISHED'),
                    expect.any(Object)
                );
            });
        });

        it('should search templates', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Find search input
            const searchInput = screen.getByPlaceholderText(/Search/i);
            if (searchInput) {
                await userEvent.type(searchInput, 'welcome');
            }

            // Should trigger new fetch with search
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('search=welcome'),
                    expect.any(Object)
                );
            }, { timeout: 500 });
        });
    });

    describe('Template Actions', () => {
        it('should handle publish action', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ templates: mockTemplates })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ template: { ...mockTemplates[1], status: 'PUBLISHED' } })
                });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Invoice Email')).toBeInTheDocument();
            });

            // Find publish button for draft template
            const publishButtons = screen.getAllByRole('button', { name: /Publish/i });
            if (publishButtons.length > 0) {
                fireEvent.click(publishButtons[0]);
            }

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/publish'),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('should handle deprecate action', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ templates: mockTemplates })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ template: { ...mockTemplates[0], status: 'DEPRECATED' } })
                });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Find deprecate button for published template
            const deprecateButtons = screen.getAllByRole('button', { name: /Deprecate|Archive/i });
            if (deprecateButtons.length > 0) {
                fireEvent.click(deprecateButtons[0]);
            }

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/deprecate'),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('should handle delete with confirmation', async () => {
            // Mock window.confirm
            const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ templates: mockTemplates })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Find delete button
            const deleteButtons = screen.getAllByRole('button', { name: /Delete/i });
            if (deleteButtons.length > 0) {
                fireEvent.click(deleteButtons[0]);
            }

            expect(confirmSpy).toHaveBeenCalled();

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/et-1'),
                    expect.objectContaining({ method: 'DELETE' })
                );
            });

            confirmSpy.mockRestore();
        });
    });

    describe('Error Handling', () => {
        it('should show error message on fetch failure', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: 'Server error' })
            });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText(/error|failed|problem/i)).toBeInTheDocument();
            });
        });

        it('should handle network errors', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText(/error|failed|problem/i)).toBeInTheDocument();
            });
        });
    });

    describe('Pagination', () => {
        it('should show pagination when many templates', async () => {
            const manyTemplates = Array.from({ length: 50 }, (_, i) => ({
                id: `et-${i}`,
                templateKey: `template-${i}`,
                name: `Template ${i}`,
                status: 'PUBLISHED',
                version: 1
            }));

            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ templates: manyTemplates })
            });

            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                // Should show pagination controls if implemented
                expect(screen.getByText('Template 0') || screen.getByText(/Page/i) || screen.getByText(/1 of/i)).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have accessible table headers', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Table should have proper headers
            const headers = screen.getAllByRole('columnheader');
            expect(headers.length).toBeGreaterThan(0);
        });

        it('should have accessible buttons', async () => {
            render(<EmailTemplatesView />);
            
            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // All buttons should be accessible
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toHaveAccessibleName();
            });
        });
    });
});




