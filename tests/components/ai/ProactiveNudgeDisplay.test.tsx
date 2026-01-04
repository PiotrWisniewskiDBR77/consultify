/**
 * ProactiveNudgeDisplay Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProactiveNudgeDisplay } from '../../components/ai/ProactiveNudgeDisplay';
import { useProactiveNudges } from '../../../hooks/useProactiveNudges';
import { useAIContext } from '../../contexts/AIContext';

// Mock hooks
jest.mock('../../../hooks/useProactiveNudges');
jest.mock('../../../contexts/AIContext');

const mockNudge = {
    id: 'nudge-1',
    nudgeId: 'assessment_help',
    userId: 'user-123',
    message: 'Widzę, że rozpocząłeś ocenę. Chcesz, żebym pomógł Ci zrozumieć poszczególne kryteria?',
    capability: 'assessment_help',
    priority: 75,
    metadata: {},
    createdAt: Date.now(),
    expiresAt: Date.now() + 3600000
};

describe('ProactiveNudgeDisplay', () => {
    const mockDismissNudge = jest.fn();
    const mockActOnNudge = jest.fn();
    const mockClearNudge = jest.fn();
    const mockOpenChat = jest.fn();

    beforeEach(() => {
        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: mockNudge,
            pendingCount: 1,
            loading: false,
            error: null,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            trackActivity: jest.fn(),
            clearNudge: mockClearNudge
        });

        (useAIContext as jest.Mock).mockReturnValue({
            openChat: mockOpenChat
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders nudge when available', () => {
        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText('Sugestia AI')).toBeInTheDocument();
        expect(screen.getByText(/Widzę, że rozpocząłeś ocenę/)).toBeInTheDocument();
    });

    it('shows accept and dismiss buttons', () => {
        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText('Tak, pomóż')).toBeInTheDocument();
        expect(screen.getByText('Nie teraz')).toBeInTheDocument();
    });

    it('calls actOnNudge when accept button is clicked', async () => {
        render(<ProactiveNudgeDisplay />);
        
        fireEvent.click(screen.getByText('Tak, pomóż'));
        
        await waitFor(() => {
            expect(mockActOnNudge).toHaveBeenCalledWith('assessment_help', 'accepted');
        });
    });

    it('opens chat when accept button is clicked', async () => {
        render(<ProactiveNudgeDisplay />);
        
        fireEvent.click(screen.getByText('Tak, pomóż'));
        
        await waitFor(() => {
            expect(mockOpenChat).toHaveBeenCalledWith(mockNudge.message);
        });
    });

    it('calls dismissNudge when dismiss button is clicked', async () => {
        render(<ProactiveNudgeDisplay />);
        
        fireEvent.click(screen.getByText('Nie teraz'));
        
        await waitFor(() => {
            expect(mockDismissNudge).toHaveBeenCalledWith('assessment_help');
        });
    });

    it('shows "Nie pokazuj więcej" option', () => {
        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText('Nie pokazuj więcej')).toBeInTheDocument();
    });

    it('does not render when disabled', () => {
        render(<ProactiveNudgeDisplay enabled={false} />);
        
        expect(screen.queryByText('Sugestia AI')).not.toBeInTheDocument();
    });

    it('does not render when no nudge available', () => {
        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: null,
            pendingCount: 0,
            loading: false,
            error: null,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            trackActivity: jest.fn(),
            clearNudge: mockClearNudge
        });

        render(<ProactiveNudgeDisplay />);
        
        expect(screen.queryByText('Sugestia AI')).not.toBeInTheDocument();
    });

    it('shows pending count badge when multiple nudges', () => {
        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: mockNudge,
            pendingCount: 3,
            loading: false,
            error: null,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            trackActivity: jest.fn(),
            clearNudge: mockClearNudge
        });

        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('positions correctly based on position prop', () => {
        const { container } = render(<ProactiveNudgeDisplay position="top-left" />);
        
        const nudgeContainer = container.querySelector('.fixed');
        expect(nudgeContainer).toHaveClass('top-6');
        expect(nudgeContainer).toHaveClass('left-6');
    });

    it('shows correct icon for capability', () => {
        render(<ProactiveNudgeDisplay />);
        
        // The Lightbulb icon should be present for assessment_help
        expect(screen.getByText('Sugestia AI')).toBeInTheDocument();
    });

    it('clears nudge after action', async () => {
        render(<ProactiveNudgeDisplay />);
        
        fireEvent.click(screen.getByText('Tak, pomóż'));
        
        await waitFor(() => {
            expect(mockClearNudge).toHaveBeenCalled();
        });
    });
});

describe('ProactiveNudgeDisplay - Different Capabilities', () => {
    const mockDismissNudge = jest.fn();
    const mockActOnNudge = jest.fn();
    const mockClearNudge = jest.fn();

    beforeEach(() => {
        (useAIContext as jest.Mock).mockReturnValue({
            openChat: jest.fn()
        });
    });

    it('displays report generation nudge correctly', () => {
        const reportNudge = {
            ...mockNudge,
            nudgeId: 'report_empty',
            capability: 'report_generation',
            message: 'Raport jest pusty. Chcesz, żebym wygenerował kompleksowy raport?'
        };

        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: reportNudge,
            pendingCount: 1,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            clearNudge: mockClearNudge
        });

        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText(/Raport jest pusty/)).toBeInTheDocument();
    });

    it('displays initiative suggestion nudge correctly', () => {
        const initiativeNudge = {
            ...mockNudge,
            nudgeId: 'no_initiatives',
            capability: 'initiative_suggestion',
            message: 'Nie masz jeszcze inicjatyw zmian. Mogę zaproponować priorytetowe działania.'
        };

        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: initiativeNudge,
            pendingCount: 1,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            clearNudge: mockClearNudge
        });

        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText(/Nie masz jeszcze inicjatyw/)).toBeInTheDocument();
    });

    it('displays first login nudge correctly', () => {
        const firstLoginNudge = {
            ...mockNudge,
            nudgeId: 'first_login',
            capability: 'onboarding',
            message: 'Witaj w Consultify! Jestem Twoim asystentem AI.'
        };

        (useProactiveNudges as jest.Mock).mockReturnValue({
            currentNudge: firstLoginNudge,
            pendingCount: 1,
            dismissNudge: mockDismissNudge,
            actOnNudge: mockActOnNudge,
            clearNudge: mockClearNudge
        });

        render(<ProactiveNudgeDisplay />);
        
        expect(screen.getByText(/Witaj w Consultify/)).toBeInTheDocument();
    });
});











