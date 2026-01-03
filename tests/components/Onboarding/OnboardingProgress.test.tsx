/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingProgress } from '../../../components/Onboarding/OnboardingProgress';

describe('OnboardingProgress Component', () => {
    it('renders progress indicator', () => {
        render(<OnboardingProgress currentStep={2} totalSteps={5} />);

        expect(screen.getByText(/2/i) || screen.getByText(/5/i)).toBeInTheDocument();
    });

    it('displays progress bar', () => {
        const { container } = render(<OnboardingProgress currentStep={2} totalSteps={5} />);

        expect(container.querySelector('.progress') || container.querySelector('[role="progressbar"]')).toBeInTheDocument();
    });
});









