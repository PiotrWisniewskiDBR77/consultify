/**
 * Unit tests for AdvancedSettings component
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
        post: vi.fn(),
        delete: vi.fn()
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

// Mock clipboard
Object.assign(navigator, {
    clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
    }
});

import { AdvancedSettings } from '@/components/settings/AdvancedSettings';
import { Api } from '../../services/api';

const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User'
};

const mockOnUpdateUser = vi.fn();

describe('AdvancedSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockImplementation((url: string) => {
            if (url === '/settings/preferences/advanced') {
                return Promise.resolve({
                    preferences: {
                        defaultExportFormat: 'pdf',
                        includeAttachments: true,
                        exportDateRange: 'all',
                        enableDeveloperMode: false,
                        showDebugInfo: false,
                        logAPIRequests: false,
                        keyboardShortcutsEnabled: true,
                        enableBetaFeatures: false
                    }
                });
            }
            if (url === '/settings/api-keys') {
                return Promise.resolve({
                    keys: [
                        {
                            id: 'key-1',
                            name: 'Test Key',
                            key: 'pk_12345678••••••••••••',
                            permissions: ['read', 'write'],
                            createdAt: '2024-01-01T00:00:00Z',
                            lastUsed: null
                        }
                    ]
                });
            }
            if (url === '/settings/connected-accounts') {
                return Promise.resolve({ accounts: [] });
            }
            return Promise.resolve({});
        });
        (Api.put as any).mockResolvedValue({ success: true });
        (Api.post as any).mockResolvedValue({ 
            success: true,
            key: 'pk_test_abc123def456',
            apiKey: {
                id: 'new-key-id',
                name: 'New Key',
                key: 'pk_test_ab••••••••••••',
                permissions: ['read'],
                createdAt: new Date().toISOString(),
                lastUsed: null
            }
        });
        (Api.delete as any).mockResolvedValue({ success: true });
    });

    it('renders advanced settings form', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
        });
        
        expect(screen.getByText('Personal API Keys')).toBeInTheDocument();
    });

    it('displays API keys section', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Personal API Keys')).toBeInTheDocument();
            expect(screen.getByText('Test Key')).toBeInTheDocument();
        });
    });

    it('displays export preferences section', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Export Preferences')).toBeInTheDocument();
            expect(screen.getByText('Default Export Format')).toBeInTheDocument();
        });
    });

    it('displays keyboard shortcuts section', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
            expect(screen.getByText('New Task')).toBeInTheDocument();
        });
    });

    it('displays connected accounts section', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Connected Accounts')).toBeInTheDocument();
            expect(screen.getByText('Google')).toBeInTheDocument();
            expect(screen.getByText('Microsoft')).toBeInTheDocument();
            expect(screen.getByText('GitHub')).toBeInTheDocument();
        });
    });

    it('displays developer options section', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(screen.getByText('Developer Options')).toBeInTheDocument();
            expect(screen.getByText('Developer Mode')).toBeInTheDocument();
            expect(screen.getByText('Beta Features')).toBeInTheDocument();
        });
    });

    it('loads data from multiple API endpoints', async () => {
        render(<AdvancedSettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/settings/preferences/advanced');
            expect(Api.get).toHaveBeenCalledWith('/settings/api-keys');
            expect(Api.get).toHaveBeenCalledWith('/settings/connected-accounts');
        });
    });
});
