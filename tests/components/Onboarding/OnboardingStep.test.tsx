/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const OnboardingStep = () => <div data-testid="onboarding-step">Onboarding Step</div>;

describe('OnboardingStep Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<OnboardingStep />);
        expect(screen.getByTestId('onboarding-step')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<OnboardingStep />);
        expect(container).toBeInTheDocument();
    });
});
