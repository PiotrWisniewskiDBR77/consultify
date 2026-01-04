import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RouterSync } from '../../components/RouterSync';
import { useAppStore } from '../../store/useAppStore';
import { AppView, SessionMode, AuthStep } from '../../types';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';

// Mock store
vi.mock('../../store/useAppStore');

describe('RouterSync', () => {
    const mockSetCurrentView = vi.fn();
    const mockSetSessionMode = vi.fn();
    const mockSetAuthInitialStep = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as unknown as Mock).mockReturnValue({
            setCurrentView: mockSetCurrentView,
            setSessionMode: mockSetSessionMode,
            setAuthInitialStep: mockSetAuthInitialStep,
            currentView: AppView.DASHBOARD,
            currentUser: null
        });
        sessionStorage.clear();
    });

    it('navigates to Demo on /demo route', async () => {
        render(
            <MemoryRouter initialEntries={['/demo']}>
                <RouterSync />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(mockSetSessionMode).toHaveBeenCalledWith(SessionMode.DEMO);
            expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.AUTH);
        });
    });

    it('navigates to Trial Start on /trial/start route', () => {
        render(
            <MemoryRouter initialEntries={['/trial/start']}>
                <RouterSync />
            </MemoryRouter>
        );

        expect(mockSetSessionMode).toHaveBeenCalledWith(SessionMode.FULL);
        expect(mockSetAuthInitialStep).toHaveBeenCalledWith(AuthStep.REGISTER);
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.AUTH);
    });

    it('captures attribution parameters', () => {
        render(
            <MemoryRouter initialEntries={['/?ref=TEST_REF&invite=TEST_INVITE']}>
                <RouterSync />
            </MemoryRouter>
        );

        expect(sessionStorage.getItem('attribution_ref')).toBe('TEST_REF');
        expect(sessionStorage.getItem('attribution_invite')).toBe('TEST_INVITE');
    });

    it('navigates to Welcome on /consulting', () => {
        render(
            <MemoryRouter initialEntries={['/consulting']}>
                <RouterSync />
            </MemoryRouter>
        );
        expect(mockSetCurrentView).toHaveBeenCalledWith(AppView.WELCOME);
    });
});
