/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWelcome } from '../../../src/components/Onboarding/OnboardingWelcome';

describe('OnboardingWelcome Component', () => {
    const user = userEvent.setup();

    it('renders welcome message', () => {
        render(<OnboardingWelcome onStart={vi.fn()} />);

        expect(screen.getByText(/Welcome/i) || screen.getByText(/Get Started/i)).toBeInTheDocument();
    });

    it('calls onStart when button clicked', async () => {
        const onStart = vi.fn();
        render(<OnboardingWelcome onStart={onStart} />);

        const startButton = screen.getByRole('button', { name: /Start/i });
        await user.click(startButton);

        expect(onStart).toHaveBeenCalled();
    });
});















