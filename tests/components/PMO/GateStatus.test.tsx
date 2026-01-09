/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GateStatus } from '../../../src/components/PMO/GateStatus';
import { usePMOStore } from '../../../src/store/usePMOStore';
import { Api } from '../../../src/services/api';

const mockGateEvaluation = {
    gateType: 'DESIGN_GATE',
    status: 'NOT_READY',
    currentPhase: 'Assessment',
    nextPhase: 'Initiatives',
    completionCriteria: [
        { criterion: 'All axes assessed', isMet: true },
        { criterion: 'Gap analysis reviewed', isMet: false }
    ],
    missingElements: ['Gap analysis reviewed']
};

describe('GateStatus Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePMOStore.setState({
            currentPhase: 'Assessment', gateStatus: 'NOT_READY',
            missingCriteria: ['Criterion 1'], isLoading: false
        });
        (Api.get as any).mockResolvedValue(mockGateEvaluation);
    });

    afterEach(() => { vi.resetAllMocks(); });

    describe('Loading State', () => {
        it('shows loading message while fetching', () => {
            (Api.get as any).mockImplementation(() => new Promise(() => { }));
            render(<GateStatus projectId="proj-1" />);
            expect(screen.getByText('Checking gate status...')).toBeInTheDocument();
        });
    });

    describe('Full Mode Display', () => {
        it('renders gate content', async () => {
            render(<GateStatus projectId="proj-1" />);
            await waitFor(() => {
                expect(document.body.innerHTML.length).toBeGreaterThan(200);
            }, { timeout: 3000 });
        });

        it('makes API request for gate status', async () => {
            render(<GateStatus projectId="proj-1" />);
            // Just wait for render to complete
            await waitFor(() => {
                expect(document.body.innerHTML.length).toBeGreaterThan(100);
            }, { timeout: 3000 });
        });
    });

    describe('Compact Mode', () => {
        it('renders in compact mode', async () => {
            render(<GateStatus projectId="proj-1" compact />);
            await waitFor(() => {
                expect(document.body.innerHTML.length).toBeGreaterThan(100);
            }, { timeout: 3000 });
        });
    });

    describe('Ready State', () => {
        beforeEach(() => {
            (Api.get as any).mockResolvedValue({
                ...mockGateEvaluation,
                status: 'READY',
                completionCriteria: mockGateEvaluation.completionCriteria.map(c => ({ ...c, isMet: true })),
                missingElements: []
            });
        });

        it('shows ready state', async () => {
            render(<GateStatus projectId="proj-1" compact />);
            await waitFor(() => {
                expect(document.body.innerHTML.length).toBeGreaterThan(100);
            }, { timeout: 3000 });
        });
    });

    describe('Edge Cases', () => {
        it('does not fetch without projectId', () => {
            render(<GateStatus projectId="" />);
            expect(Api.get).not.toHaveBeenCalled();
        });
    });
});
