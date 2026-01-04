import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkPreferencesSettings } from '../../../../src/components/settings/WorkPreferencesSettings';

// Mock dependencies
const mockUseAppStore = vi.fn();
vi.mock('../../../../src/store/useAppStore', () => ({
    useAppStore: (selector: any) => mockUseAppStore(selector),
}));

vi.mock('../../../../src/services/api', () => ({
    Api: {
        updateUserPreferences: vi.fn().mockResolvedValue({}),
        getUserPreferences: vi.fn().mockResolvedValue({
            defaultView: 'kanban',
            itemsPerPage: 25,
            autoSave: true,
            keyboardShortcuts: true,
            theme: 'system'
        }),
    },
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

/**
 * WorkPreferencesSettings Component Tests
 * Tests for work preferences settings component
 * CRITICAL FOR ENTERPRISE USER EXPERIENCE CUSTOMIZATION
 */
describe('WorkPreferencesSettings Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockUseAppStore.mockImplementation((selector: any) => {
            const state = {
                user: {
                    id: 'test-user',
                    preferences: {
                        defaultView: 'kanban',
                        itemsPerPage: 25,
                        autoSave: true,
                        keyboardShortcuts: true,
                        theme: 'system'
                    }
                },
                updateUserPreferences: vi.fn(),
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render all preference sections', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            expect(screen.getByText('Default View')).toBeInTheDocument();
            expect(screen.getByText('Items Per Page')).toBeInTheDocument();
            expect(screen.getByText('Auto Save')).toBeInTheDocument();
            expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
            expect(screen.getByText('Theme')).toBeInTheDocument();
        });

        it('should show current preference values', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            expect(screen.getByDisplayValue('kanban')).toBeInTheDocument();
            expect(screen.getByDisplayValue('25')).toBeInTheDocument();
            expect(screen.getByDisplayValue('system')).toBeInTheDocument();
        });

        it('should show toggle states for boolean preferences', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            const autoSaveToggle = screen.getByRole('checkbox', { name: /auto save/i });
            const keyboardToggle = screen.getByRole('checkbox', { name: /keyboard shortcuts/i });

            expect(autoSaveToggle).toBeChecked();
            expect(keyboardToggle).toBeChecked();
        });
    });

    describe('Interactions', () => {
        it('should update default view preference', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const viewSelect = screen.getByDisplayValue('kanban');
            await user.selectOptions(viewSelect, 'list');

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                defaultView: 'list'
            });
        });

        it('should update items per page', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const itemsInput = screen.getByDisplayValue('25');
            await user.clear(itemsInput);
            await user.type(itemsInput, '50');

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                itemsPerPage: 50
            });
        });

        it('should toggle boolean preferences', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const autoSaveToggle = screen.getByRole('checkbox', { name: /auto save/i });
            await user.click(autoSaveToggle);

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                autoSave: false
            });
        });

        it('should update theme preference', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const themeSelect = screen.getByDisplayValue('system');
            await user.selectOptions(themeSelect, 'dark');

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                theme: 'dark'
            });
        });
    });

    describe('Validation', () => {
        it('should validate items per page range', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const itemsInput = screen.getByDisplayValue('25');
            await user.clear(itemsInput);
            await user.type(itemsInput, '5'); // Below minimum

            // Should show validation error
            await waitFor(() => {
                expect(screen.getByText(/minimum.*10/i)).toBeInTheDocument();
            });
        });

        it('should prevent saving with validation errors', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const itemsInput = screen.getByDisplayValue('25');
            await user.clear(itemsInput);
            await user.type(itemsInput, '5');

            const saveButton = screen.getByRole('button', { name: /save/i });
            await user.click(saveButton);

            expect(mockUseAppStore().updateUserPreferences).not.toHaveBeenCalled();
        });
    });

    describe('Persistence', () => {
        it('should save preferences automatically on change', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const viewSelect = screen.getByDisplayValue('kanban');
            await user.selectOptions(viewSelect, 'calendar');

            // Auto-save should trigger
            await waitFor(() => {
                expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                    defaultView: 'calendar'
                });
            });
        });

        it('should show save confirmation', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const viewSelect = screen.getByDisplayValue('kanban');
            await user.selectOptions(viewSelect, 'list');

            await waitFor(() => {
                expect(screen.getByText(/preferences.*saved/i)).toBeInTheDocument();
            });
        });

        it('should handle save errors gracefully', async () => {
            const user = userEvent.setup();

            // Mock API error
            mockUseAppStore.mockImplementation((selector: any) => {
                const state = {
                    user: { id: 'test-user', preferences: {} },
                    updateUserPreferences: vi.fn().mockRejectedValue(new Error('Save failed')),
                };
                return selector(state);
            });

            renderWithProviders(<WorkPreferencesSettings />);

            const viewSelect = screen.getByDisplayValue('kanban');
            await user.selectOptions(viewSelect, 'list');

            await waitFor(() => {
                expect(screen.getByText(/failed.*save/i)).toBeInTheDocument();
            });
        });
    });

    describe('Reset to Defaults', () => {
        it('should show reset button', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            expect(screen.getByRole('button', { name: /reset.*defaults/i })).toBeInTheDocument();
        });

        it('should reset all preferences to defaults', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const resetButton = screen.getByRole('button', { name: /reset.*defaults/i });
            await user.click(resetButton);

            // Confirm dialog
            const confirmButton = screen.getByRole('button', { name: /confirm/i });
            await user.click(confirmButton);

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                defaultView: 'kanban',
                itemsPerPage: 25,
                autoSave: true,
                keyboardShortcuts: true,
                theme: 'system'
            });
        });

        it('should cancel reset when user declines', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const resetButton = screen.getByRole('button', { name: /reset.*defaults/i });
            await user.click(resetButton);

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            expect(mockUseAppStore().updateUserPreferences).not.toHaveBeenCalled();
        });
    });

    describe('Keyboard Shortcuts', () => {
        it('should show keyboard shortcuts help', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            const shortcutsToggle = screen.getByRole('checkbox', { name: /keyboard shortcuts/i });
            expect(shortcutsToggle).toBeChecked();

            // Should show shortcuts help section
            expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
        });

        it('should display available shortcuts', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
            expect(screen.getByText('Ctrl+Z')).toBeInTheDocument();
            expect(screen.getByText('Ctrl+Y')).toBeInTheDocument();
        });

        it('should allow customizing shortcuts', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const customizeButton = screen.getByRole('button', { name: /customize.*shortcuts/i });
            await user.click(customizeButton);

            // Should open customization modal
            expect(screen.getByText(/customize.*shortcuts/i)).toBeInTheDocument();

            const saveShortcutButton = screen.getByRole('button', { name: /save.*shortcut/i });
            await user.click(saveShortcutButton);

            expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('should have proper labels for form controls', () => {
            renderWithProviders(<WorkPreferencesSettings />);

            const viewSelect = screen.getByDisplayValue('kanban');
            expect(viewSelect).toHaveAttribute('aria-label', 'Default view preference');

            const itemsInput = screen.getByDisplayValue('25');
            expect(itemsInput).toHaveAttribute('aria-label', 'Items per page');
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            // Tab through form controls
            await user.keyboard('{Tab}');
            const firstControl = screen.getByDisplayValue('kanban');
            expect(firstControl).toHaveFocus();
        });

        it('should announce changes to screen readers', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const themeSelect = screen.getByDisplayValue('system');
            await user.selectOptions(themeSelect, 'dark');

            // Should announce the change
            expect(screen.getByText(/theme.*changed.*dark/i)).toBeInTheDocument();
        });
    });

    describe('Performance', () => {
        it('should debounce preference updates', async () => {
            const user = userEvent.setup();

            renderWithProviders(<WorkPreferencesSettings />);

            const itemsInput = screen.getByDisplayValue('25');

            // Rapid typing should be debounced
            await user.clear(itemsInput);
            await user.type(itemsInput, '50');

            // Should not save immediately
            expect(mockUseAppStore().updateUserPreferences).not.toHaveBeenCalled();

            // Wait for debounce
            await waitFor(() => {
                expect(mockUseAppStore().updateUserPreferences).toHaveBeenCalledWith({
                    itemsPerPage: 50
                });
            }, { timeout: 1000 });
        });
    });
});
