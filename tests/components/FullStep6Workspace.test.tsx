/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FullStep6Workspace } from '../../components/FullStep6Workspace';

const mockSession = {
    id: 'session-1',
    initiatives: []
} as any;

describe('FullStep6Workspace Component', () => {
    it('renders step 6 workspace', () => {
        render(<FullStep6Workspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Step 6/i) || screen.getByText(/Rollout/i)).toBeInTheDocument();
    });
});










