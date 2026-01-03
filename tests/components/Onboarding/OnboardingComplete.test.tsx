/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingComplete } from '../../../components/Onboarding/OnboardingComplete';

describe('OnboardingComplete Component', () => {
    const user = userEvent.setup();

    it('renders completion message', () => {
        render(<OnboardingComplete onFinish={vi.fn()} />);

        expect(screen.getByText(/Complete/i) || screen.getByText(/Congratulations/i)).toBeInTheDocument();
    });

    it('calls onFinish when button clicked', async () => {
        const onFinish = vi.fn();
        render(<OnboardingComplete onFinish={onFinish} />);

        const finishButton = screen.getByRole('button', { name: /Finish/i });
        await user.click(finishButton);

        expect(onFinish).toHaveBeenCalled();
    });
});









