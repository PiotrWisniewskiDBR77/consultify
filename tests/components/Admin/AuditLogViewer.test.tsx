/**
 * AuditLogViewer Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AuditLogViewer } from '../../../components/Admin/AuditLogViewer';
import api from '../../../services/api';

// Mock API
jest.mock('../../../services/api');
const mockedApi = api as jest.Mocked<typeof api>;

const mockLogs = [
    {
        id: '1',
        timestamp: '2024-01-15T10:00:00Z',
        user_id: 'user-123',
        organization_id: 'org-456',
        action: 'ai_request',
        resource_type: 'chat',
        model_used: 'gpt-4o',
        tokens_used: 1500,
        cost_usd: 0.045,
        risk_level: 'LOW' as const,
        flagged: false
    },
    {
        id: '2',
        timestamp: '2024-01-15T11:00:00Z',
        user_id: 'user-789',
        organization_id: 'org-456',
        action: 'ai_request',
        resource_type: 'report',
        model_used: 'gpt-4o',
        tokens_used: 5000,
        cost_usd: 0.15,
        risk_level: 'HIGH' as const,
        flagged: true,
        flag_reason: 'High token usage'
    }
];

describe('AuditLogViewer', () => {
    beforeEach(() => {
        mockedApi.get.mockResolvedValue({
            data: {
                success: true,
                data: mockLogs,
                count: 2
            }
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders the component title', async () => {
        render(<AuditLogViewer />);
        
        expect(screen.getByText('AI Audit Log')).toBeInTheDocument();
    });

    it('displays logs in table format', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('user-123...')).toBeInTheDocument();
        });
    });

    it('shows risk level indicators', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('LOW')).toBeInTheDocument();
            expect(screen.getByText('HIGH')).toBeInTheDocument();
        });
    });

    it('shows flagged entries highlighted', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            const flaggedRow = screen.getByText('user-789...').closest('tr');
            expect(flaggedRow).toHaveClass('bg-red-50');
        });
    });

    it('opens filter panel when filter button is clicked', async () => {
        render(<AuditLogViewer />);
        
        const filterButton = screen.getByText('Filtry');
        fireEvent.click(filterButton);
        
        expect(screen.getByText('Poziom ryzyka')).toBeInTheDocument();
    });

    it('filters by risk level', async () => {
        render(<AuditLogViewer />);
        
        const filterButton = screen.getByText('Filtry');
        fireEvent.click(filterButton);
        
        const riskSelect = screen.getByRole('combobox', { name: /poziom ryzyka/i });
        fireEvent.change(riskSelect, { target: { value: 'HIGH' } });
        
        await waitFor(() => {
            expect(mockedApi.get).toHaveBeenCalledWith(
                expect.stringContaining('riskLevel=HIGH')
            );
        });
    });

    it('opens detail modal when row is clicked', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('user-123...')).toBeInTheDocument();
        });
        
        fireEvent.click(screen.getByText('user-123...'));
        
        await waitFor(() => {
            expect(screen.getByText('Szczegóły logu')).toBeInTheDocument();
        });
    });

    it('exports to CSV when export button is clicked', async () => {
        const mockCreateObjectURL = jest.fn();
        global.URL.createObjectURL = mockCreateObjectURL;
        
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('Export CSV')).toBeInTheDocument();
        });
        
        const exportButton = screen.getByText('Export CSV');
        fireEvent.click(exportButton);
        
        expect(mockCreateObjectURL).toHaveBeenCalled();
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(mockedApi.get).toHaveBeenCalledTimes(1);
        });
        
        const refreshButton = screen.getByText('Odśwież');
        fireEvent.click(refreshButton);
        
        await waitFor(() => {
            expect(mockedApi.get).toHaveBeenCalledTimes(2);
        });
    });

    it('displays statistics cards', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('Wszystkie logi')).toBeInTheDocument();
            expect(screen.getByText('Wysokie ryzyko')).toBeInTheDocument();
            expect(screen.getByText('Oflagowane')).toBeInTheDocument();
            expect(screen.getByText('Łączny koszt')).toBeInTheDocument();
        });
    });

    it('handles pagination', async () => {
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText('Poprzednie')).toBeInTheDocument();
            expect(screen.getByText('Następne')).toBeInTheDocument();
        });
    });

    it('displays error state', async () => {
        mockedApi.get.mockRejectedValueOnce(new Error('API Error'));
        
        render(<AuditLogViewer />);
        
        await waitFor(() => {
            expect(screen.getByText(/API Error/i)).toBeInTheDocument();
        });
    });

    it('displays loading state', () => {
        render(<AuditLogViewer />);
        
        expect(screen.getByText('Ładowanie...')).toBeInTheDocument();
    });
});


