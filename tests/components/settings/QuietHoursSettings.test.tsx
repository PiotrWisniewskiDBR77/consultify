/**
 * @vitest-environment jsdom
 * QuietHoursSettings Component Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuietHoursSettings } from '@/components/settings/QuietHoursSettings';
import { Api } from '@/services/api';

// Mock API
vi.mock('@/services/api', () => ({
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

const mockQuietHoursSettings = {
    preferences: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
        daysOfWeek: [0, 6],
        allowUrgent: true,
        allowMentions: false,
        allowDirectMessages: false,
        autoReplyEnabled: false,
        autoReplyMessage: ''
    }
};

describe('QuietHoursSettings Component', () => {
    const user = userEvent.setup();
    const mockOnUpdate = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue(mockQuietHoursSettings);
        (Api.put as any).mockResolvedValue({});
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section title', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Quiet Hours / Do Not Disturb')).toBeInTheDocument();
            });
        });

        it('renders enable toggle', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument();
            });
        });

        it('renders save button', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });
        });
    });

    describe('Enable Toggle', () => {
        it('shows disabled state by default', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument();
            });
            
            // When disabled, schedule section should not be visible
            expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
        });

        it('hides schedule when disabled', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument();
            });

            expect(screen.queryByText('Schedule')).not.toBeInTheDocument();
        });

        it('shows schedule when enabled', async () => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: true }
            });

            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Schedule')).toBeInTheDocument();
            });
        });
    });

    describe('Schedule Section', () => {
        beforeEach(() => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: true }
            });
        });

        it('renders start time input', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Start Time')).toBeInTheDocument();
            });
        });

        it('renders end time input', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('End Time')).toBeInTheDocument();
            });
        });

        it('renders days of week buttons', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Sun')).toBeInTheDocument();
                expect(screen.getByText('Mon')).toBeInTheDocument();
                expect(screen.getByText('Tue')).toBeInTheDocument();
                expect(screen.getByText('Wed')).toBeInTheDocument();
                expect(screen.getByText('Thu')).toBeInTheDocument();
                expect(screen.getByText('Fri')).toBeInTheDocument();
                expect(screen.getByText('Sat')).toBeInTheDocument();
            });
        });

        it('shows weekend days as selected by default', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const sunButton = screen.getByText('Sun').closest('button');
                const satButton = screen.getByText('Sat').closest('button');
                expect(sunButton).toHaveClass('border-indigo-500');
                expect(satButton).toHaveClass('border-indigo-500');
            });
        });

        it('toggles day selection on click', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Mon')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Mon'));

            await waitFor(() => {
                const monButton = screen.getByText('Mon').closest('button');
                expect(monButton).toHaveClass('border-indigo-500');
            });
        });
    });

    describe('Exceptions Section', () => {
        beforeEach(() => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: true }
            });
        });

        it('renders exceptions section', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Exceptions')).toBeInTheDocument();
            });
        });

        it('renders allow urgent toggle', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow urgent notifications')).toBeInTheDocument();
            });
        });

        it('renders allow mentions toggle', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow @mentions')).toBeInTheDocument();
            });
        });

        it('renders allow DMs toggle', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Allow direct messages')).toBeInTheDocument();
            });
        });

        it('shows allow urgent as enabled by default', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                const container = screen.getByText('Allow urgent notifications').closest('div')?.parentElement;
                const toggle = container?.querySelector('button[class*="rounded-full"]');
                expect(toggle).toHaveClass('bg-purple-500');
            });
        });
    });

    describe('Auto Reply Section', () => {
        beforeEach(() => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: true }
            });
        });

        it('renders auto reply section', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Auto Reply')).toBeInTheDocument();
            });
        });

        it('renders auto reply toggle', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable auto-reply')).toBeInTheDocument();
            });
        });

        it('shows message input when auto reply enabled', async () => {
            (Api.get as any).mockResolvedValue({
                preferences: { 
                    ...mockQuietHoursSettings.preferences, 
                    enabled: true, 
                    autoReplyEnabled: true 
                }
            });

            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Auto-reply message')).toBeInTheDocument();
            });
        });

        it('hides message input when auto reply disabled', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable auto-reply')).toBeInTheDocument();
            });

            expect(screen.queryByText('Auto-reply message')).not.toBeInTheDocument();
        });
    });

    describe('Quick Presets', () => {
        beforeEach(() => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: true }
            });
        });

        it('renders quick presets section', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Quick Presets')).toBeInTheDocument();
            });
        });

        it('renders nights preset', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Nights (10pm-8am, every day)')).toBeInTheDocument();
            });
        });

        it('renders weekends preset', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Weekends only')).toBeInTheDocument();
            });
        });

        it('renders after work preset', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('After work hours (6pm-9am, weekdays)')).toBeInTheDocument();
            });
        });

        it('applies nights preset on click', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Nights (10pm-8am, every day)')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Nights (10pm-8am, every day)'));

            // All days should now be selected
            await waitFor(() => {
                const monButton = screen.getByText('Mon').closest('button');
                const tueButton = screen.getByText('Tue').closest('button');
                expect(monButton).toHaveClass('border-indigo-500');
                expect(tueButton).toHaveClass('border-indigo-500');
            });
        });
    });

    describe('Active Status Banner', () => {
        it('shows active banner when quiet hours currently active', async () => {
            // Mock current time to be within quiet hours
            const now = new Date();
            now.setHours(23, 0, 0, 0); // 11 PM
            vi.setSystemTime(now);

            (Api.get as any).mockResolvedValue({
                preferences: { 
                    ...mockQuietHoursSettings.preferences, 
                    enabled: true,
                    daysOfWeek: [0, 1, 2, 3, 4, 5, 6]
                }
            });

            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Quiet Hours are currently active')).toBeInTheDocument();
            });

            vi.useRealTimers();
        });

        it('hides active banner when quiet hours not active', async () => {
            (Api.get as any).mockResolvedValue({
                preferences: { ...mockQuietHoursSettings.preferences, enabled: false }
            });

            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Enable Quiet Hours')).toBeInTheDocument();
            });

            expect(screen.queryByText('Quiet Hours are currently active')).not.toBeInTheDocument();
        });
    });

    describe('Form Submission', () => {
        it('calls API on save', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(Api.put).toHaveBeenCalledWith('/settings/preferences/quietHours', expect.any(Object));
            });
        });

        it('shows success toast on save', async () => {
            render(<QuietHoursSettings currentUser={mockUser as any} onUpdate={mockOnUpdate} />);

            await waitFor(() => {
                expect(screen.getByText('Save')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Save'));

            await waitFor(() => {
                expect(screen.getByText('Saved!')).toBeInTheDocument();
            });
        });
    });
});

