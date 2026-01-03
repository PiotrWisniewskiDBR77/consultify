/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Step3Workspace } from '../../../components/Step3Workspace';

const mockSession = {
    id: 'session-1',
    initiatives: []
} as any;

describe('Step3Workspace Component', () => {
    it('renders step 3 workspace', () => {
        render(<Step3Workspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Step 3/i) || screen.getByText(/Roadmap/i)).toBeInTheDocument();
    });
});






