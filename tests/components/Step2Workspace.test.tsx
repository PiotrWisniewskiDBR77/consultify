/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Step2Workspace } from '../../../components/Step2Workspace';

const mockSession = {
    id: 'session-1',
    initiatives: []
} as any;

describe('Step2Workspace Component', () => {
    it('renders step 2 workspace', () => {
        render(<Step2Workspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Step 2/i) || screen.getByText(/Initiatives/i)).toBeInTheDocument();
    });
});


