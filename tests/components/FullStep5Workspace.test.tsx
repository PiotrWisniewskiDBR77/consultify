/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FullStep5Workspace } from '../../../components/FullStep5Workspace';

const mockSession = {
    id: 'session-1',
    initiatives: []
} as any;

describe('FullStep5Workspace Component', () => {
    it('renders step 5 workspace', () => {
        render(<FullStep5Workspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Step 5/i) || screen.getByText(/Execution/i)).toBeInTheDocument();
    });
});

