/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FullStep4Workspace } from '../../components/workspaces/FullStep4Workspace';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            if (key === 'fullROI') return {
                intro: 'Analysis of implementation costs vs. projected benefits...',
                summary: { totalCost: 'Cost', totalBenefit: 'Benefit', roi: 'ROI', payback: 'Payback', years: 'years' },
                tableHeader: { cost: 'Cost', benefit: 'Benefit' }
            };
            if (key === 'fullInitiatives') return {
                tableHeader: { initiative: 'Initiative' }
            };
            return key;
        }
    })
}));

const mockSession = {
    id: 'session-1',
    initiatives: []
} as any;

describe('FullStep4Workspace Component', () => {
    it('renders step 4 workspace', () => {
        render(<FullStep4Workspace fullSession={mockSession} onUpdateInitiative={vi.fn()} onNextStep={vi.fn()} language="en" />);

        expect(screen.getByText(/Step 4/i) || screen.getByText(/Economics/i)).toBeInTheDocument();
    });
});














