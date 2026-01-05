/**
 * Unit tests for RegionalSettings component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies before importing component
vi.mock('../../services/api', () => ({
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

vi.mock('@/components/shared/InfoButton', () => ({
    InfoButton: () => null
}));

import { RegionalSettings } from '@/components/settings/RegionalSettings';
import { Api } from '../../services/api';

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    timezone: 'America/New_York',
    units: 'metric' as const
};

const mockOnUpdateUser = vi.fn();

describe('RegionalSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            preferences: {
                timezone: 'America/New_York',
                units: 'metric',
                currency: 'USD',
                numberFormat: 'en-US',
                dateFormat: 'MM/DD/YYYY',
                timeFormat: '12h',
                firstDayOfWeek: 'sunday'
            }
        });
        (Api.put as any).mockResolvedValue({ success: true });
    });

    it('renders regional settings form', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Regional Settings')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Timezone')).toBeInTheDocument();
    });

    it('loads preferences from API', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/preferences/regional');
        });
    });

    it('displays date format options', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Day/Month/Year')).toBeInTheDocument();
            expect(screen.getByText('Month/Day/Year')).toBeInTheDocument();
        });
    });

    it('displays time format options', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('24-hour')).toBeInTheDocument();
            expect(screen.getByText('12-hour')).toBeInTheDocument();
        });
    });

    it('displays measurement system options', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Metric')).toBeInTheDocument();
            expect(screen.getByText('Imperial')).toBeInTheDocument();
        });
    });

    it('shows preview of current settings', async () => {
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Preview of Your Settings')).toBeInTheDocument();
        });
    });

    it('handles API error gracefully', async () => {
        (Api.get as any).mockRejectedValue(new Error('API Error'));
        
        render(<RegionalSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        // Should still render with defaults
        await waitFor(() => {
            expect(screen.getByText('Regional Settings')).toBeInTheDocument();
        });
    });
});
