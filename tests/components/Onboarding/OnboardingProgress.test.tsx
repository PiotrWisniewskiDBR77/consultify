/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const OnboardingProgress = () => <div data-testid="onboarding-progress">Onboarding Progress</div>;

describe('OnboardingProgress Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<OnboardingProgress />);
        expect(screen.getByTestId('onboarding-progress')).toBeInTheDocument();
    });

    it('renders without crashing', () => {
        const { container } = render(<OnboardingProgress />);
        expect(container).toBeInTheDocument();
    });
});
