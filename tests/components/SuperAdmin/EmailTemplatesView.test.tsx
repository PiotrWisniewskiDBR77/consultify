/**
 * EmailTemplatesView Tests
 * Tests for the SuperAdmin Email Templates management view
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmailTemplatesView } from '../../../src/views/superadmin/EmailTemplatesView';
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

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            changeLanguage: () => new Promise(() => { }),
        },
    }),
    initReactI18next: {
        type: '3rdParty',
        init: () => { },
    }
}));

describe('EmailTemplatesView', () => {
    const user = userEvent.setup();

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
        (global.fetch as Mock).mockImplementation((url, options) => {
            const urlStr = String(url);
            console.log('Fetch called:', urlStr);
            const method = options?.method || 'GET';

            if (urlStr.includes('categories')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ categories: [{ id: 'cat-1', name: 'System', color: '#000000' }] })
                });
            }
            if (urlStr.includes('tags')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ tags: [] })
                });
            }
            if (method === 'DELETE' || urlStr.includes('publish') || urlStr.includes('deprecate') || urlStr.includes('clone')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true, template: { ...mockTemplates[0], status: 'PUBLISHED' } })
                });
            }
            // Default templates list
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ templates: mockTemplates })
            });
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render templates list with correct status badges', async () => {
            render(<EmailTemplatesView />);

            // Verify loading state first
            expect(screen.getByText(/Loading templates/i)).toBeInTheDocument();

            // Wait for loading to finish
            await waitFor(() => {
                expect(screen.queryByText(/Loading templates/i)).not.toBeInTheDocument();
            }, { timeout: 4000 });

            // Verify content
            expect(screen.getByRole('heading', { name: /Email Templates/i })).toBeInTheDocument();
            expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            expect(screen.getByText('Invoice Email')).toBeInTheDocument();

            // Verify status badges using scoped queries
            const welcomeRow = screen.getByText('Welcome Email').closest('tr');
            if (welcomeRow) {
                expect(within(welcomeRow).getByText(/Published/i)).toBeInTheDocument();
            }

            const invoiceRow = screen.getByText('Invoice Email').closest('tr');
            if (invoiceRow) {
                expect(within(invoiceRow).getByText(/Draft/i)).toBeInTheDocument();
            }
        });

        it('should show empty state when no templates', async () => {
            (global.fetch as Mock).mockImplementation((url) => {
                const urlStr = String(url);
                if (urlStr.includes('categories')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ categories: [] }) });
                if (urlStr.includes('tags')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ tags: [] }) });
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ templates: [] })
                });
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
                expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
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
                expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
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
            const filterSelect = screen.getByRole('combobox', { name: /Filter by status/i });
            if (filterSelect) {
                await user.selectOptions(filterSelect, 'PUBLISHED');
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
                await user.type(searchInput, 'welcome');
            }

            // Should trigger new fetch with search
            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('search=welcome'),
                    expect.any(Object)
                );
            }, { timeout: 1000 });
        });
    });

    describe('Template Actions', () => {
        it('should handle publish action', async () => {
            // Mock handled in beforeEach
            render(<EmailTemplatesView />);

            await waitFor(() => {
                expect(screen.getByText('Invoice Email')).toBeInTheDocument();
            });

            // Find publish button inside actions menu
            // Open actions menu first
            const moreActions = screen.getAllByLabelText('More actions')[1]; // Second template is Invoice (DRAFT)
            await user.click(moreActions);

            const publishButton = await screen.findByRole('button', { name: /Publish/i });
            await user.click(publishButton);

            await waitFor(() => {
                expect(global.fetch).toHaveBeenCalledWith(
                    expect.stringContaining('/publish'),
                    expect.objectContaining({ method: 'POST' })
                );
            });
        });

        it('should handle deprecate action', async () => {
            render(<EmailTemplatesView />);

            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Open actions menu for first template
            const moreActions = screen.getAllByLabelText('More actions')[0];
            await user.click(moreActions);

            const deprecateButton = await screen.findByRole('button', { name: /Deprecate|Archive/i });
            await user.click(deprecateButton);

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

            render(<EmailTemplatesView />);

            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            // Open actions menu
            const moreActions = screen.getAllByLabelText('More actions')[0];
            await user.click(moreActions);

            const deleteButton = await screen.findByRole('button', { name: /Delete/i });
            await user.click(deleteButton);

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
            (global.fetch as Mock).mockImplementation((url) => {
                const urlStr = String(url);
                if (urlStr.includes('categories') || urlStr.includes('tags')) return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });

                return Promise.resolve({
                    ok: false,
                    status: 500,
                    json: () => Promise.resolve({ error: 'Server error' })
                });
            });

            render(<EmailTemplatesView />);

            await waitFor(() => {
                expect(screen.getByText(/error|failed|problem/i)).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have accessible buttons', async () => {
            render(<EmailTemplatesView />);

            await waitFor(() => {
                expect(screen.getByText('Welcome Email')).toBeInTheDocument();
            });

            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toHaveAccessibleName();
            });
        });
    });
});




