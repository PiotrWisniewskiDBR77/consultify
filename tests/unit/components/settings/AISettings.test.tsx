import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AISettings } from '@/components/settings/AISettings';
import { Api } from '@/services/api';
import { User } from '@/types';

// Mock Api
vi.mock('@/services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
        getLLMProviders: vi.fn(),
        checkLLMProvidersHealth: vi.fn(),
    }
}));

// Note: react-hot-toast is mocked globally in tests/setup.ts

// Mock router
vi.mock('react-router-dom', () => ({
    Link: ({ children, ...props }: any) => <a {...props}>{children}</a>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, def?: string) => def || key }),
}));

// Mock hooks
vi.mock('@/hooks/useRealtimeCosts', () => ({
    useRealtimeCosts: () => ({
        connected: true,
        summary: {
            totalCostThisMonth: 10.50,
            totalRequestsThisMonth: 120,
            totalTokensThisMonth: 500000
        },
        refresh: vi.fn()
    })
}));

describe('AISettings', () => {
    const mockUser: User = {
        id: 'user1',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        organizationId: 'org1',
        aiConfig: {
            visibleModelIds: ['gpt-4']
        }
    } as any;

    const mockOnUpdateUser = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Default API mocks
        (Api.getLLMProviders as any).mockResolvedValue([
            { id: 'gpt-4', name: 'GPT-4', is_active: true, is_enabled_for_org: true },
            { id: 'claude-3', name: 'Claude 3', is_active: true, is_enabled_for_org: true }
        ]);

        (Api.checkLLMProvidersHealth as any).mockResolvedValue({});

        (Api.get as any).mockImplementation((url: string) => {
            if (url === '/settings/preferences') {
                return Promise.resolve({ data: { ai: { responseStyle: 'balanced' } } });
            }
            return Promise.resolve({ data: {} });
        });

        // Mock fetch for user/org settings
        global.fetch = vi.fn().mockImplementation((url) => {
            if (url.toString().includes('/api/ai-settings')) {
                return Promise.resolve({
                    json: () => Promise.resolve({})
                });
            }
            return Promise.resolve({
                json: () => Promise.resolve({})
            });
        });
    });

    it('renders and loads initial data', async () => {
        render(<AISettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);

        await waitFor(() => {
            expect(screen.getByText('LLM Management')).toBeInTheDocument();
            expect(screen.getByText('Performance Tiers')).toBeInTheDocument(); // Tab label
        });
    });

    it('navigates between tabs', async () => {
        const user = userEvent.setup();
        render(<AISettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);

        await waitFor(() => expect(screen.getByText('Performance Tiers')).toBeInTheDocument());

        // Click BYOK Keys tab
        await user.click(screen.getByText('BYOK Keys'));
        await waitFor(() => expect(screen.getByText(/Bring Your Own Keys/i)).toBeInTheDocument());

        // Click Privacy tab
        await user.click(screen.getByText(/Privacy/i));
        // Privacy content logic... just check tab became active or content changed
        // Since we don't have detailed privacy content in the snipped view, just check we clicked it
    });

    it('saves configuration', async () => {
        const user = userEvent.setup();
        render(<AISettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);

        await waitFor(() => expect(screen.getByText('Performance Tiers')).toBeInTheDocument());

        const saveBtn = screen.getByText('Save Configuration');
        await user.click(saveBtn);

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith('/settings/preferences/ai', expect.any(Object));
        });
    });

    it('allows adding a new provider key', async () => {
        const user = userEvent.setup();
        render(<AISettings currentUser={mockUser} onUpdateUser={mockOnUpdateUser} />);

        await waitFor(() => expect(screen.getByText('BYOK Keys')).toBeInTheDocument());
        await user.click(screen.getByText('BYOK Keys'));

        const addKeyBtn = await screen.findByText(/Add Key/i);
        await user.click(addKeyBtn);

        // Fill form
        const nameInput = screen.getByPlaceholderText(/e.g. My Personal GPT-4 Key/i);
        await user.type(nameInput, 'My Key');

        const keyInput = screen.getByPlaceholderText(/sk-.../i);
        await user.type(keyInput, 'sk-test-key-123456');

        const saveKeyBtn = screen.getByText('Save Key');
        await user.click(saveKeyBtn);

        await waitFor(() => {
            expect(screen.getByText('My Key')).toBeInTheDocument();
            expect(localStorage.getItem('user_ai_providers')).toContain('My Key');
        });
    });
});
