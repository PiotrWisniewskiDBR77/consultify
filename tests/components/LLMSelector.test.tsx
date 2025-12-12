import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMSelector } from '../../components/LLMSelector';
import { useAppStore } from '../../store/useAppStore';
import { Api } from '../../services/api';

vi.mock('../../store/useAppStore');
vi.mock('../../services/api');

describe('Component Test: LLMSelector', () => {
    const mockSetAIConfig = vi.fn();
    const mockCurrentUser = { id: 'user-1', aiConfig: {} };

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            aiConfig: {
                autoMode: false,
                selectedModelId: null,
            },
            setAIConfig: mockSetAIConfig,
            currentUser: mockCurrentUser,
        });
        (Api.getPublicLLMProviders as any).mockResolvedValue([
            { id: 'model-1', name: 'GPT-4', provider: 'OpenAI' },
            { id: 'model-2', name: 'Claude', provider: 'Anthropic' },
        ]);
    });

    it('renders selector button', () => {
        render(<LLMSelector />);
        expect(screen.getByText(/Select Model|Auto/i)).toBeInTheDocument();
    });

    it('opens dropdown when clicked', async () => {
        render(<LLMSelector />);

        const button = screen.getByText(/Select Model|Auto/i);
        fireEvent.click(button);

        await waitFor(() => {
            expect(Api.getPublicLLMProviders).toHaveBeenCalled();
        });
    });

    it('displays models in dropdown', async () => {
        render(<LLMSelector />);

        const button = screen.getByText(/Select Model|Auto/i);
        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText('GPT-4')).toBeInTheDocument();
        });
    });

    it('filters models by search query', async () => {
        render(<LLMSelector />);

        const button = screen.getByText(/Select Model|Auto/i);
        fireEvent.click(button);

        await waitFor(() => {
            const searchInput = screen.getByPlaceholderText(/Search/i);
            fireEvent.change(searchInput, { target: { value: 'GPT' } });

            expect(screen.getByText('GPT-4')).toBeInTheDocument();
            expect(screen.queryByText('Claude')).not.toBeInTheDocument();
        });
    });

    it('selects model when clicked', async () => {
        render(<LLMSelector />);

        const button = screen.getByText(/Select Model|Auto/i);
        fireEvent.click(button);

        await waitFor(() => {
            const modelOption = screen.getByText('GPT-4');
            fireEvent.click(modelOption);

            expect(mockSetAIConfig).toHaveBeenCalledWith({
                selectedModelId: 'model-1',
                autoMode: false,
            });
        });
    });

    it.skip('toggles auto mode', () => {
        render(<LLMSelector />);

        const autoToggle = screen.getByText(/Auto/i);
        if (autoToggle) {
            fireEvent.click(autoToggle);
            expect(mockSetAIConfig).toHaveBeenCalled();
        }
    });
});

