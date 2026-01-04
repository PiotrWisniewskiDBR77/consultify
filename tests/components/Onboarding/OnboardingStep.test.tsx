/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnboardingStep } from '../../components/Onboarding/OnboardingStep';

describe('OnboardingStep Component', () => {
    it('renders onboarding step', () => {
        render(<OnboardingStep step={1} title="Test Step" isActive={true} isComplete={false} />);

        expect(screen.getByText('Test Step')).toBeInTheDocument();
    });

    it('shows active state', () => {
        render(<OnboardingStep step={1} title="Test Step" isActive={true} isComplete={false} />);

        const step = screen.getByText('Test Step');
        expect(step.closest('div')).toHaveClass(/active/);
    });

    it('shows complete state', () => {
        render(<OnboardingStep step={1} title="Test Step" isActive={false} isComplete={true} />);

        const step = screen.getByText('Test Step');
        expect(step.closest('div')).toHaveClass(/complete/);
    });
});














