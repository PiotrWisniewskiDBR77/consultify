/**
 * Unit tests for WorkPreferencesSettings component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies before importing component
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn()
    }
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key
    })
}));

vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn()
    },
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../components/shared/InfoButton', () => ({
    InfoButton: () => null
}));

import { WorkPreferencesSettings } from '../../../components/settings/WorkPreferencesSettings';
import { Api } from '../../../services/api';

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
};

const mockOnUpdateUser = vi.fn();

describe('WorkPreferencesSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            preferences: {
                defaultProjectView: 'kanban',
                defaultTaskSort: 'priority',
                weekStartDay: 'monday',
                showCompletedTasks: false,
                showSubtasks: true,
                autoArchiveDays: 30,
                taskDefaultDueDays: 7,
                defaultTimeTracking: 'none',
                defaultTaskPriority: 'medium',
                defaultReminderBefore: '1day',
                defaultSnoozeDuration: '1hour',
                autoSnoozeOverdue: false,
                enableFocusMode: true,
                focusModeBlocksNotifications: true,
                defaultFocusDuration: 25
            }
        });
        (Api.put as any).mockResolvedValue({ success: true });
    });

    it('renders work preferences form', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Work Preferences')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Default Project View')).toBeInTheDocument();
    });

    it('displays project view options', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Kanban Board')).toBeInTheDocument();
            expect(screen.getByText('List View')).toBeInTheDocument();
            expect(screen.getByText('Timeline')).toBeInTheDocument();
            expect(screen.getByText('Calendar')).toBeInTheDocument();
        });
    });

    it('displays priority options', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('No Priority')).toBeInTheDocument();
            expect(screen.getByText('Low')).toBeInTheDocument();
            expect(screen.getByText('Medium')).toBeInTheDocument();
            expect(screen.getByText('High')).toBeInTheDocument();
            expect(screen.getByText('Urgent')).toBeInTheDocument();
        });
    });

    it('displays task defaults section', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Task Defaults')).toBeInTheDocument();
        });
    });

    it('displays snooze and focus section', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Snooze & Focus')).toBeInTheDocument();
        });
    });

    it('displays focus mode settings when enabled', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Enable Focus Mode')).toBeInTheDocument();
            expect(screen.getByText('Block Notifications During Focus')).toBeInTheDocument();
            expect(screen.getByText('Default Focus Duration')).toBeInTheDocument();
        });
    });

    it('displays automation section', async () => {
        render(<WorkPreferencesSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Automation & Defaults')).toBeInTheDocument();
        });
    });
});
