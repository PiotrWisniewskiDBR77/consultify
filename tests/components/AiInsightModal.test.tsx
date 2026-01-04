/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiInsightModal } from '../../components/AiInsightModal';

// Mock AI Agent
vi.mock('../../services/ai/agent', () => ({
    analyzeSessionForInsights: vi.fn().mockResolvedValue([])
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            changeLanguage: () => new Promise(() => { }),
        },
    }),
}));

describe('AiInsightModal Component', () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    const mockData = {
        narrative: 'This is a test narrative for the insight.',
        observations: ['Budget mismatch identified', 'Risk factor is High'],
        suggestions: ['Review budget', 'Contact manager'],
        status: 'WARNING'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders modal when open', () => {
        render(
            <AiInsightModal
                isOpen={true}
                onClose={mockOnClose}
                title="AI Analysis"
                type="validation"
                data={mockData}
            />
        );

        expect(screen.getByText('AI Analysis')).toBeInTheDocument();
        expect(screen.getByText(/This is a test narrative/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
        render(
            <AiInsightModal
                isOpen={false}
                onClose={mockOnClose}
                title="AI Analysis"
                type="validation"
                data={mockData}
            />
        );

        expect(screen.queryByText('AI Analysis')).not.toBeInTheDocument();
    });

    it('displays observations correctly', () => {
        render(
            <AiInsightModal
                isOpen={true}
                onClose={mockOnClose}
                title="AI Analysis"
                type="validation"
                data={mockData}
            />
        );

        expect(screen.getByText('Budget mismatch identified')).toBeInTheDocument();
        expect(screen.getByText('Risk factor is High')).toBeInTheDocument();
    });

    it('calls onClose when close button clicked', async () => {
        render(
            <AiInsightModal
                isOpen={true}
                onClose={mockOnClose}
                title="AI Analysis"
                type="validation"
                data={mockData}
            />
        );

        // There are multiple close buttons (header X and footer button)
        // Let's click the footer one which usually has "Close" or "common.close" text
        const closeButtons = screen.getAllByRole('button');
        // Filter for one that likely represents close
        const closeBtn = closeButtons.find(btn => btn.textContent === 'common.close') || closeButtons[0];

        await user.click(closeBtn);
        expect(mockOnClose).toHaveBeenCalled();
    });
});



