/**
 * Demo Flow Tests
 * 
 * Tests for the demo mode functionality including:
 * - Instant demo access
 * - Welcome tour
 * - Demo banner
 * - Conversion optimization components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../../i18n';

// Mock framer-motion
jest.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Import demo components
import { DemoWelcomeTour } from '../../../components/demo/DemoWelcomeTour';
import { SmartDemoBanner } from '../../../components/demo/SmartDemoBanner';
import { DemoLoadingOverlay } from '../../../components/demo/DemoLoadingOverlay';
import { ExitIntentModal } from '../../../components/demo/ExitIntentModal';
import { DemoUpgradePrompt } from '../../../components/demo/DemoUpgradePrompt';

// Wrapper for i18n
const renderWithI18n = (component: React.ReactElement) => {
    return render(
        <I18nextProvider i18n={i18n}>
            {component}
        </I18nextProvider>
    );
};

describe('Demo Welcome Tour', () => {
    const mockOnClose = jest.fn();
    const mockOnComplete = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    it('renders when isOpen is true', () => {
        renderWithI18n(
            <DemoWelcomeTour
                isOpen={true}
                onClose={mockOnClose}
                onComplete={mockOnComplete}
            />
        );

        expect(screen.getByText(/Welcome to Consultinity/i)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        renderWithI18n(
            <DemoWelcomeTour
                isOpen={false}
                onClose={mockOnClose}
                onComplete={mockOnComplete}
            />
        );

        expect(screen.queryByText(/Welcome to Consultinity/i)).not.toBeInTheDocument();
    });

    it('shows role selection on first step', () => {
        renderWithI18n(
            <DemoWelcomeTour
                isOpen={true}
                onClose={mockOnClose}
                onComplete={mockOnComplete}
            />
        );

        expect(screen.getByText(/CEO \/ Executive/i)).toBeInTheDocument();
        expect(screen.getByText(/CTO \/ Tech Lead/i)).toBeInTheDocument();
        expect(screen.getByText(/Consultant/i)).toBeInTheDocument();
        expect(screen.getByText(/Investor/i)).toBeInTheDocument();
    });

    it('calls onClose when skip button is clicked', () => {
        renderWithI18n(
            <DemoWelcomeTour
                isOpen={true}
                onClose={mockOnClose}
                onComplete={mockOnComplete}
            />
        );

        const skipButton = screen.getByText(/Skip tour/i);
        fireEvent.click(skipButton);

        expect(mockOnClose).toHaveBeenCalled();
    });

    it('stores skip preference in localStorage', () => {
        renderWithI18n(
            <DemoWelcomeTour
                isOpen={true}
                onClose={mockOnClose}
                onComplete={mockOnComplete}
            />
        );

        const skipButton = screen.getByText(/Skip tour/i);
        fireEvent.click(skipButton);

        expect(localStorage.getItem('demo_tour_skipped')).toBe('true');
    });
});

describe('SmartDemoBanner', () => {
    it('renders demo mode indicator', () => {
        renderWithI18n(<SmartDemoBanner />);
        
        expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument();
    });

    it('displays demo email', () => {
        renderWithI18n(<SmartDemoBanner demoEmail="test@demo.com" />);
        
        expect(screen.getByText(/test@demo.com/i)).toBeInTheDocument();
    });

    it('shows timer', () => {
        renderWithI18n(<SmartDemoBanner />);
        
        // Timer should be displayed (format: HH:MM:SS)
        expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('shows Get Full Access button', () => {
        renderWithI18n(<SmartDemoBanner />);
        
        expect(screen.getByText(/Get Full Access/i)).toBeInTheDocument();
    });

    it('can be minimized', async () => {
        renderWithI18n(<SmartDemoBanner />);
        
        const minimizeButton = screen.getByTitle(/Minimize/i);
        fireEvent.click(minimizeButton);
        
        // After minimize, should show minimized version
        await waitFor(() => {
            expect(screen.getByText(/Demo Mode/i)).toBeInTheDocument();
        });
    });
});

describe('DemoLoadingOverlay', () => {
    it('renders loading state', () => {
        renderWithI18n(
            <DemoLoadingOverlay
                isLoading={true}
                progress={50}
                currentStep="data"
            />
        );
        
        expect(screen.getByText(/Preparing Your Experience/i)).toBeInTheDocument();
    });

    it('shows progress indicator', () => {
        renderWithI18n(
            <DemoLoadingOverlay
                isLoading={true}
                progress={75}
                currentStep="ai"
            />
        );
        
        expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('does not render when not loading', () => {
        renderWithI18n(
            <DemoLoadingOverlay
                isLoading={false}
                progress={100}
                currentStep="dashboard"
            />
        );
        
        expect(screen.queryByText(/Preparing Your Experience/i)).not.toBeInTheDocument();
    });
});

describe('ExitIntentModal', () => {
    const mockOnClose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders when open', () => {
        renderWithI18n(
            <ExitIntentModal isOpen={true} onClose={mockOnClose} />
        );
        
        expect(screen.getByText(/Before You Go/i)).toBeInTheDocument();
    });

    it('shows benefits list', () => {
        renderWithI18n(
            <ExitIntentModal isOpen={true} onClose={mockOnClose} />
        );
        
        expect(screen.getByText(/dedicated environment/i)).toBeInTheDocument();
        expect(screen.getByText(/Unlimited AI consultations/i)).toBeInTheDocument();
    });

    it('calls onClose when dismiss button is clicked', () => {
        renderWithI18n(
            <ExitIntentModal isOpen={true} onClose={mockOnClose} />
        );
        
        // Click the X button
        const closeButton = screen.getByRole('button', { name: '' });
        fireEvent.click(closeButton);
        
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('shows schedule demo CTA', () => {
        renderWithI18n(
            <ExitIntentModal isOpen={true} onClose={mockOnClose} />
        );
        
        expect(screen.getByText(/Schedule a Personal Demo/i)).toBeInTheDocument();
    });
});

describe('DemoUpgradePrompt', () => {
    const mockOnClose = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders toast variant', () => {
        renderWithI18n(
            <DemoUpgradePrompt
                isVisible={true}
                onClose={mockOnClose}
                variant="toast"
            />
        );
        
        expect(screen.getByText(/Unlock Full Potential/i)).toBeInTheDocument();
    });

    it('renders inline variant', () => {
        renderWithI18n(
            <DemoUpgradePrompt
                isVisible={true}
                onClose={mockOnClose}
                variant="inline"
            />
        );
        
        expect(screen.getByText(/works best with your own data/i)).toBeInTheDocument();
    });

    it('renders modal variant', () => {
        renderWithI18n(
            <DemoUpgradePrompt
                isVisible={true}
                onClose={mockOnClose}
                variant="modal"
            />
        );
        
        expect(screen.getByText(/Ready for the Full Experience/i)).toBeInTheDocument();
    });

    it('does not render when not visible', () => {
        renderWithI18n(
            <DemoUpgradePrompt
                isVisible={false}
                onClose={mockOnClose}
            />
        );
        
        expect(screen.queryByText(/Unlock Full Potential/i)).not.toBeInTheDocument();
    });
});

describe('Demo Flow Integration', () => {
    // Mock window.open for CTA clicks
    const originalOpen = window.open;
    
    beforeEach(() => {
        window.open = jest.fn();
    });

    afterEach(() => {
        window.open = originalOpen;
    });

    it('banner CTA opens HubSpot calendar', () => {
        renderWithI18n(<SmartDemoBanner />);
        
        const ctaButton = screen.getByText(/Get Full Access/i);
        fireEvent.click(ctaButton);
        
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining('meetings.hubspot.com'),
            '_blank'
        );
    });

    it('exit intent modal CTA opens HubSpot calendar', () => {
        const mockOnClose = jest.fn();
        renderWithI18n(
            <ExitIntentModal isOpen={true} onClose={mockOnClose} />
        );
        
        const scheduleButton = screen.getByText(/Schedule a Personal Demo/i);
        fireEvent.click(scheduleButton);
        
        expect(window.open).toHaveBeenCalledWith(
            expect.stringContaining('meetings.hubspot.com'),
            '_blank'
        );
    });
});






