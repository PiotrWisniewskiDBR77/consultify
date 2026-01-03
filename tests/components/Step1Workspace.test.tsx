/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Step1Workspace } from '../../../components/Step1Workspace';

const mockSession = {
    id: 'session-1',
    assessment: {}
} as any;

describe('Step1Workspace Component', () => {
    it('renders step 1 workspace', () => {
        render(<Step1Workspace fullSession={mockSession} onStartAxis={vi.fn()} onNextStep={vi.fn()} />);

        expect(screen.getByText(/Assessment/i) || screen.getByText(/Step 1/i)).toBeInTheDocument();
    });
});








