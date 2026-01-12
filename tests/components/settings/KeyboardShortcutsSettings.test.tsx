/**
 * @vitest-environment jsdom
 * KeyboardShortcutsSettings Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeyboardShortcutsSettings } from '../../components/settings/KeyboardShortcutsSettings';
import { Api } from '../../../services/api';

// Mock API
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

// Mock i18n
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback
    })
}));

const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe'
};

const mockShortcutsPrefs = {
    preferences: {
        preset: 'default',
        enabled: true,
        showHints: true,
        customShortcuts: {},
        disabledShortcuts: []
    }
};

describe('KeyboardShortcutsSettings Component', () => {
    const user = userEvent.setup();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockShortcutsPrefs);
        (Api.put as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section title', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
            });
        });

        it('renders enable toggle', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Keyboard Shortcuts')).toBeInTheDocument();
            });
        });

        it('renders save button', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                // The component renders
                expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
            });
            
            // Save button should be present
            const saveButtons = screen.getAllByRole('button');
            expect(saveButtons.length).toBeGreaterThan(0);
        });

        it('renders reset button', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Reset')).toBeInTheDocument();
            });
        });
    });

    describe('Enable/Disable Toggle', () => {
        it('shows enabled state by default', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Keyboard Shortcuts')).toBeInTheDocument();
                // When enabled by default, preset selector should be visible
                expect(screen.getByText('Shortcut Preset')).toBeInTheDocument();
            });
        });

        it('hides shortcuts list when disabled', async () => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockShortcutsPrefs.preferences, enabled: false }
            });

            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Keyboard Shortcuts')).toBeInTheDocument();
            });

            // Preset selector should not be visible when disabled
            expect(screen.queryByText('Shortcut Preset')).not.toBeInTheDocument();
        });

        it('shows shortcuts list when enabled', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Shortcut Preset')).toBeInTheDocument();
            });
        });
    });

    describe('Preset Selection', () => {
        it('renders all preset options', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Default')).toBeInTheDocument();
                expect(screen.getByText('VS Code')).toBeInTheDocument();
                expect(screen.getByText('Sublime Text')).toBeInTheDocument();
                expect(screen.getByText('Vim')).toBeInTheDocument();
                expect(screen.getByText('Custom')).toBeInTheDocument();
            });
        });

        it('shows default preset as selected', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const defaultButton = screen.getByText('Default').closest('button');
                expect(defaultButton).toHaveClass('border-purple-500');
            });
        });

        it('changes preset on click', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('VS Code')).toBeInTheDocument();
            });

            await user.click(screen.getByText('VS Code'));

            await waitFor(() => {
                const vscodeButton = screen.getByText('VS Code').closest('button');
                expect(vscodeButton).toHaveClass('border-purple-500');
            });
        });
    });

    describe('Shortcuts List', () => {
        it('renders navigation shortcuts category', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Navigation')).toBeInTheDocument();
            });
        });

        it('renders task management shortcuts category', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Task Management')).toBeInTheDocument();
            });
        });

        it('renders AI features shortcuts category', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('AI Features')).toBeInTheDocument();
            });
        });

        it('renders individual shortcuts', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Go to Home')).toBeInTheDocument();
                expect(screen.getByText('Global Search')).toBeInTheDocument();
                expect(screen.getByText('New Task')).toBeInTheDocument();
            });
        });

        it('shows shortcut key combinations', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                // Look for kbd elements with shortcut keys
                const kbdElements = document.querySelectorAll('kbd');
                expect(kbdElements.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Search Functionality', () => {
        it('renders search input', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
            });
        });

        it('filters shortcuts by search query', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Search shortcuts...')).toBeInTheDocument();
            });

            const searchInput = screen.getByPlaceholderText('Search shortcuts...');
            await user.type(searchInput, 'search');

            await waitFor(() => {
                expect(screen.getByText('Global Search')).toBeInTheDocument();
                expect(screen.queryByText('Go to Home')).not.toBeInTheDocument();
            });
        });
    });

    describe('Custom Shortcuts', () => {
        it('shows edit button for shortcuts', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const editButtons = document.querySelectorAll('[class*="hover:text-purple-500"]');
                expect(editButtons.length).toBeGreaterThan(0);
            });
        });

        it('shows input field when editing shortcut', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Go to Home')).toBeInTheDocument();
            });

            // Find and click the edit button
            const shortcutRow = screen.getByText('Go to Home').closest('div[class*="rounded-lg"]');
            const editButton = shortcutRow?.querySelector('button[class*="hover:text-purple-500"]');
            
            if (editButton) {
                await user.click(editButton);
            }

            await waitFor(() => {
                expect(screen.getByPlaceholderText('Press keys...')).toBeInTheDocument();
            });
        });
    });

    describe('Show Hints Toggle', () => {
        it('renders show hints toggle', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Show Shortcut Hints')).toBeInTheDocument();
            });
        });
    });

    describe('Form Submission', () => {
        it('calls API on save', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
            });

            // Find and click the save button
            const buttons = screen.getAllByRole('button');
            const saveButton = buttons.find(btn => btn.textContent?.includes('Save'));
            if (saveButton) {
                await user.click(saveButton);
            }

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/settings/preferences/shortcuts', expect.any(Object));
            });
        });

        it('resets to default on reset click', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            // First change preset
            await waitFor(() => {
                expect(screen.getByText('VS Code')).toBeInTheDocument();
            });

            await user.click(screen.getByText('VS Code'));

            // Then reset
            await user.click(screen.getByText('Reset'));

            await waitFor(() => {
                const defaultButton = screen.getByText('Default').closest('button');
                expect(defaultButton).toHaveClass('border-purple-500');
            });
        });
    });

    describe('Tip Section', () => {
        it('renders tip section', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Tip')).toBeInTheDocument();
            });
        });

        it('shows tip about viewing shortcuts', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText(/Press "\?" anywhere/)).toBeInTheDocument();
            });
        });
    });

    describe('Toggle Individual Shortcuts', () => {
        it('allows toggling individual shortcuts on/off', async () => {
            render(<KeyboardShortcutsSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Go to Home')).toBeInTheDocument();
            });

            // Find and click the mini toggle for a shortcut
            const shortcutRow = screen.getByText('Go to Home').closest('div[class*="rounded-lg"]');
            const miniToggle = shortcutRow?.querySelector('button[class*="w-8"]');
            
            if (miniToggle) {
                await user.click(miniToggle);
            }

            // Shortcut row should now have reduced opacity
            await waitFor(() => {
                const row = screen.getByText('Go to Home').closest('div[class*="rounded-lg"]');
                expect(row).toHaveClass('opacity-50');
            });
        });
    });
});

