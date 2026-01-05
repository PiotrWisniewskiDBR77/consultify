/**
 * Unit tests for PrivacyDataSettings component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock dependencies before importing component
vi.mock('../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn()
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

import { PrivacyDataSettings } from '@/components/settings/PrivacyDataSettings';
import { Api } from '../../services/api';

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
};

const mockOnUpdateUser = vi.fn();

describe('PrivacyDataSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({
            preferences: {
                profileVisibility: 'organization',
                showOnlineStatus: true,
                showActivityStatus: true,
                showLastSeen: true,
                shareAnalytics: true,
                shareUsageData: false,
                improveAI: true,
                marketingEmails: false,
                productUpdates: true,
                newsletterSubscribed: false,
                allowThirdPartyIntegrations: true
            }
        });
        (Api.put as any).mockResolvedValue({ success: true });
        (Api.post as any).mockResolvedValue({ success: true });
    });

    it('renders privacy settings form', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Privacy & Data')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Profile Visibility')).toBeInTheDocument();
    });

    it('displays visibility options', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Public')).toBeInTheDocument();
            expect(screen.getByText('Organization Only')).toBeInTheDocument();
            expect(screen.getByText('Private')).toBeInTheDocument();
        });
    });

    it('displays activity status section', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Activity & Status')).toBeInTheDocument();
            expect(screen.getByText('Show Online Status')).toBeInTheDocument();
            expect(screen.getByText('Show Activity Status')).toBeInTheDocument();
            expect(screen.getByText('Show Last Seen')).toBeInTheDocument();
        });
    });

    it('displays data sharing section', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Data Sharing')).toBeInTheDocument();
            expect(screen.getByText('Share Analytics Data')).toBeInTheDocument();
            expect(screen.getByText('Help Improve AI')).toBeInTheDocument();
        });
    });

    it('displays data management section', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Data Management')).toBeInTheDocument();
            expect(screen.getByText('Export Your Data')).toBeInTheDocument();
            expect(screen.getByText('Delete Account')).toBeInTheDocument();
        });
    });

    it('displays marketing preferences', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Communication Preferences')).toBeInTheDocument();
            expect(screen.getByText('Product Updates')).toBeInTheDocument();
            expect(screen.getByText('Marketing Emails')).toBeInTheDocument();
            expect(screen.getByText('Newsletter')).toBeInTheDocument();
        });
    });

    it('loads preferences from API', async () => {
        render(<PrivacyDataSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/preferences/privacy');
        });
    });
});
