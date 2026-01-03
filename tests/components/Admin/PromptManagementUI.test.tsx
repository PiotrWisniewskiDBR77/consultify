/**
 * PromptManagementUI Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PromptManagementUI } from '../../../components/Admin/PromptManagementUI';
import api from '../../../services/api';

// Mock API
jest.mock('../../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

const mockPrompts = [
    {
        id: 'prompt-1',
        name: 'System Prompt',
        category: 'system',
        description: 'Main system prompt',
        template: 'You are a helpful AI assistant for {{company_name}}.',
        variables: ['company_name'],
        is_active: true,
        version: 3,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z'
    },
    {
        id: 'prompt-2',
        name: 'Report Prompt',
        category: 'report',
        description: 'Report generation prompt',
        template: 'Generate a report for {{project_name}} covering {{scope}}.',
        variables: ['project_name', 'scope'],
        is_active: true,
        version: 1,
        created_at: '2024-01-10T00:00:00Z',
        updated_at: '2024-01-10T00:00:00Z'
    }
];

const mockPromptDetail = {
    ...mockPrompts[0],
    versions: [
        { id: 'v3', version: 3, template: 'Version 3', created_at: '2024-01-15T00:00:00Z' },
        { id: 'v2', version: 2, template: 'Version 2', created_at: '2024-01-10T00:00:00Z' },
        { id: 'v1', version: 1, template: 'Version 1', created_at: '2024-01-01T00:00:00Z' }
    ]
};

describe('PromptManagementUI', () => {
    beforeEach(() => {
        mockedApi.get.mockImplementation((url: string) => {
            if (url.includes('/ai-prompts/')) {
                return Promise.resolve({
                    data: { success: true, data: mockPromptDetail }
                });
            }
            return Promise.resolve({
                data: { success: true, data: mockPrompts }
            });
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the component title', () => {
        render(<PromptManagementUI />);
        
        expect(screen.getByText('Prompty AI')).toBeInTheDocument();
    });

    it('displays prompt list', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
            expect(screen.getByText('Report Prompt')).toBeInTheDocument();
        });
    });

    it('shows prompt version numbers', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText(/v3/)).toBeInTheDocument();
            expect(screen.getByText(/v1/)).toBeInTheDocument();
        });
    });

    it('shows active/inactive status', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            const activeLabels = screen.getAllByText('Aktywny');
            expect(activeLabels.length).toBeGreaterThan(0);
        });
    });

    it('filters prompts by category', async () => {
        render(<PromptManagementUI />);
        
        const categorySelect = screen.getByRole('combobox');
        fireEvent.change(categorySelect, { target: { value: 'system' } });
        
        await waitFor(() => {
            expect(mockedApi.get).toHaveBeenCalledWith(
                expect.stringContaining('category=system')
            );
        });
    });

    it('searches prompts by name', async () => {
        render(<PromptManagementUI />);
        
        const searchInput = screen.getByPlaceholderText('Szukaj...');
        fireEvent.change(searchInput, { target: { value: 'System' } });
        
        // Search should filter locally
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
    });

    it('loads prompt details when selected', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(mockedApi.get).toHaveBeenCalledWith('/ai-prompts/prompt-1');
        });
    });

    it('displays prompt template in editor', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText(/You are a helpful AI assistant/)).toBeInTheDocument();
        });
    });

    it('shows variables as tags', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('{{company_name}}')).toBeInTheDocument();
        });
    });

    it('enables edit mode when edit button is clicked', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('Edytuj')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Edytuj'));
        
        expect(screen.getByText('Zapisz')).toBeInTheDocument();
        expect(screen.getByText('Anuluj')).toBeInTheDocument();
    });

    it('saves prompt changes', async () => {
        mockedApi.put.mockResolvedValueOnce({ data: { success: true } });
        
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('Edytuj')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Edytuj'));
        fireEvent.click(screen.getByText('Zapisz'));
        
        await waitFor(() => {
            expect(mockedApi.put).toHaveBeenCalledWith(
                '/ai-prompts/prompt-1',
                expect.any(Object)
            );
        });
    });

    it('shows version history panel', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('Historia')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Historia'));
        
        await waitFor(() => {
            expect(screen.getByText('Historia wersji')).toBeInTheDocument();
        });
    });

    it('shows test panel', async () => {
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Test'));
        
        await waitFor(() => {
            expect(screen.getByText('Test prompta')).toBeInTheDocument();
            expect(screen.getByText('Uruchom test')).toBeInTheDocument();
        });
    });

    it('runs test with variables', async () => {
        mockedApi.post.mockResolvedValueOnce({
            data: {
                success: true,
                data: {
                    rendered: 'You are a helpful AI assistant for Acme Corp.',
                    unreplacedVariables: [],
                    characterCount: 45
                }
            }
        });
        
        render(<PromptManagementUI />);
        
        await waitFor(() => {
            expect(screen.getByText('System Prompt')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('System Prompt'));
        
        await waitFor(() => {
            expect(screen.getByText('Test')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Test'));
        
        await waitFor(() => {
            expect(screen.getByText('Uruchom test')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('Uruchom test'));
        
        await waitFor(() => {
            expect(mockedApi.post).toHaveBeenCalledWith(
                '/ai-prompts/prompt-1/test',
                expect.any(Object)
            );
        });
    });

    it('displays placeholder when no prompt selected', () => {
        render(<PromptManagementUI />);
        
        expect(screen.getByText('Wybierz prompt z listy')).toBeInTheDocument();
    });
});








