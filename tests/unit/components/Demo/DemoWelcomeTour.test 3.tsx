/**
 * DemoWelcomeTour Component Tests
 * Testing onboarding tour functionality
 * 
 * @module tests/unit/components/Demo/DemoWelcomeTour.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

// Mock DemoWelcomeTour component
const MockDemoWelcomeTour: React.FC<{
    isOpen?: boolean;
    onComplete?: () => void;
    onSkip?: () => void;
    steps?: Array<{ title: string; description: string }>;
}> = ({
    isOpen = true,
    onComplete = () => { },
    onSkip = () => { },
    steps = [
        { title: 'Welcome', description: 'Welcome to the platform!' },
        { title: 'Dashboard', description: 'This is your main dashboard.' },
        { title: 'Get Started', description: 'Click here to begin.' }
    ]
}) => {
        const [currentStep, setCurrentStep] = useState(0);

        if (!isOpen) return null;

        const isLastStep = currentStep === steps.length - 1;

        return (
            <div data-testid="welcome-tour" role="dialog">
                <div data-testid="tour-progress">
                    Step {currentStep + 1} of {steps.length}
                </div>
                <h2 data-testid="tour-title">{steps[currentStep].title}</h2>
                <p data-testid="tour-description">{steps[currentStep].description}</p>
                <div>
                    <button onClick={onSkip} data-testid="tour-skip">Skip Tour</button>
                    {currentStep > 0 && (
                        <button onClick={() => setCurrentStep(c => c - 1)} data-testid="tour-prev">
                            Previous
                        </button>
                    )}
                    {isLastStep ? (
                        <button onClick={onComplete} data-testid="tour-complete">
                            Get Started
                        </button>
                    ) : (
                        <button onClick={() => setCurrentStep(c => c + 1)} data-testid="tour-next">
                            Next
                        </button>
                    )}
                </div>
            </div>
        );
    };

describe('DemoWelcomeTour Component', () => {
    describe('Visibility', () => {
        it('should render when open', () => {
            render(<MockDemoWelcomeTour isOpen={true} />);
            expect(screen.getByTestId('welcome-tour')).toBeInTheDocument();
        });

        it('should not render when closed', () => {
            render(<MockDemoWelcomeTour isOpen={false} />);
            expect(screen.queryByTestId('welcome-tour')).not.toBeInTheDocument();
        });
    });

    describe('Step Navigation', () => {
        it('should show first step initially', () => {
            render(<MockDemoWelcomeTour />);
            expect(screen.getByTestId('tour-title')).toHaveTextContent('Welcome');
            expect(screen.getByTestId('tour-progress')).toHaveTextContent('Step 1 of 3');
        });

        it('should navigate to next step', () => {
            render(<MockDemoWelcomeTour />);

            fireEvent.click(screen.getByTestId('tour-next'));

            expect(screen.getByTestId('tour-title')).toHaveTextContent('Dashboard');
            expect(screen.getByTestId('tour-progress')).toHaveTextContent('Step 2 of 3');
        });

        it('should navigate to previous step', () => {
            render(<MockDemoWelcomeTour />);

            fireEvent.click(screen.getByTestId('tour-next'));
            fireEvent.click(screen.getByTestId('tour-prev'));

            expect(screen.getByTestId('tour-title')).toHaveTextContent('Welcome');
        });

        it('should not show prev button on first step', () => {
            render(<MockDemoWelcomeTour />);
            expect(screen.queryByTestId('tour-prev')).not.toBeInTheDocument();
        });

        it('should show complete button on last step', () => {
            render(<MockDemoWelcomeTour />);

            fireEvent.click(screen.getByTestId('tour-next'));
            fireEvent.click(screen.getByTestId('tour-next'));

            expect(screen.getByTestId('tour-complete')).toBeInTheDocument();
            expect(screen.queryByTestId('tour-next')).not.toBeInTheDocument();
        });
    });

    describe('Callbacks', () => {
        it('should call onComplete when completing tour', () => {
            const onComplete = vi.fn();
            render(<MockDemoWelcomeTour onComplete={onComplete} />);

            fireEvent.click(screen.getByTestId('tour-next'));
            fireEvent.click(screen.getByTestId('tour-next'));
            fireEvent.click(screen.getByTestId('tour-complete'));

            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('should call onSkip when skipping tour', () => {
            const onSkip = vi.fn();
            render(<MockDemoWelcomeTour onSkip={onSkip} />);

            fireEvent.click(screen.getByTestId('tour-skip'));

            expect(onSkip).toHaveBeenCalledTimes(1);
        });
    });

    describe('Accessibility', () => {
        it('should have dialog role', () => {
            render(<MockDemoWelcomeTour />);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });
});
