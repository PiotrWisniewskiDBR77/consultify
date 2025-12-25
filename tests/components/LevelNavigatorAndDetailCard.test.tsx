/**
 * Component Tests: LevelNavigator and LevelDetailCard
 * Tests for level navigation and detail display components
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock react-i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: any) => {
            if (options?.returnObjects) {
                return {};
            }
            return key;
        }
    })
}));

// Mock utils
vi.mock('../../utils/assessmentColors', () => ({
    getStatusBadgeClasses: (type: string) => `status-${type}`,
    getAssessmentButtonClasses: (type: string, isActive: boolean) => 
        isActive ? `btn-${type}-active` : `btn-${type}`
}));

import { LevelNavigator } from '../../components/assessment/LevelNavigator';
import { LevelDetailCard } from '../../components/assessment/LevelDetailCard';

describe('LevelNavigator', () => {
    const defaultProps = {
        levels: {
            '1': 'Initial - Ad hoc processes',
            '2': 'Repeatable - Basic processes',
            '3': 'Defined - Standardized processes',
            '4': 'Managed - Measured processes',
            '5': 'Optimizing - Continuous improvement',
            '6': 'Leading - Industry leadership',
            '7': 'Pioneering - Innovation frontier'
        },
        currentLevel: 1,
        onSelectLevel: vi.fn(),
        actualScore: 0,
        targetScore: 0
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(<LevelNavigator {...defaultProps} {...props} />);
    };

    // =========================================================================
    // RENDER TESTS
    // =========================================================================

    describe('Rendering', () => {
        it('should render all 7 levels', () => {
            renderComponent();
            
            // Check that all 7 level buttons are rendered
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBe(7);
        });

        it('should render level titles', () => {
            renderComponent();
            
            expect(screen.getByText(/Initial/)).toBeInTheDocument();
            expect(screen.getByText(/Optimizing/)).toBeInTheDocument();
        });

        it('should highlight current level', () => {
            renderComponent({ currentLevel: 3 });
            
            // Find the button containing level 3 content
            const buttons = screen.getAllByRole('button');
            const level3Button = buttons.find(btn => 
                btn.textContent?.includes('3') && btn.textContent?.includes('Defined')
            );
            expect(level3Button).toHaveClass('bg-slate-100');
        });
    });

    // =========================================================================
    // BITMASK STATUS TESTS
    // =========================================================================

    describe('Bitmask Status Display', () => {
        it('should show Actual badge for set levels', () => {
            // actualScore = 4 means level 3 is set (2^2 = 4)
            renderComponent({ actualScore: 4 });
            
            expect(screen.getByText(/Actual|actual_only/i)).toBeInTheDocument();
        });

        it('should show Target badge for set levels', () => {
            // targetScore = 8 means level 4 is set (2^3 = 8)
            renderComponent({ targetScore: 8 });
            
            expect(screen.getByText(/Target|target_only/i)).toBeInTheDocument();
        });

        it('should show combined badge when both set on same level', () => {
            // Both actual and target on level 3 (both = 4)
            renderComponent({ actualScore: 4, targetScore: 4 });
            
            expect(screen.getByText(/actual_target/i)).toBeInTheDocument();
        });

        it('should show multiple badges for multiple levels', () => {
            // actualScore = 6 means levels 2 and 3 are set (2 + 4 = 6)
            renderComponent({ actualScore: 6 });
            
            // Should have two "Actual" badges
            const actualBadges = screen.getAllByText(/Actual|actual_only/i);
            expect(actualBadges.length).toBe(2);
        });
    });

    // =========================================================================
    // SELECTION TESTS
    // =========================================================================

    describe('Level Selection', () => {
        it('should call onSelectLevel when clicked', () => {
            renderComponent();
            
            // Click on the level button containing "4"
            const level4Button = screen.getAllByRole('button').find(btn => 
                btn.textContent?.includes('4') && btn.textContent?.includes('Managed')
            );
            if (level4Button) fireEvent.click(level4Button);
            
            expect(defaultProps.onSelectLevel).toHaveBeenCalledWith(4);
        });

        it('should call onSelectLevel with correct level number', () => {
            renderComponent();
            
            // Click on the level button containing "7"
            const level7Button = screen.getAllByRole('button').find(btn => 
                btn.textContent?.includes('7') && btn.textContent?.includes('Pioneering')
            );
            if (level7Button) fireEvent.click(level7Button);
            
            expect(defaultProps.onSelectLevel).toHaveBeenCalledWith(7);
        });
    });
});

describe('LevelDetailCard', () => {
    const defaultProps = {
        level: 3,
        title: 'Defined - Standardized processes',
        description: 'At this level, processes are documented and standardized across the organization.',
        helperQuestions: [
            'Are processes documented?',
            'Is there a standard methodology?',
            'Are deviations tracked?'
        ],
        formula: 'Standardization = Documentation × Adherence',
        isActual: false,
        isTarget: false,
        onSetActual: vi.fn(),
        onSetTarget: vi.fn(),
        onSetNA: vi.fn(),
        notes: '',
        onNotesChange: vi.fn(),
        onAiAssist: vi.fn(),
        isAiLoading: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(<LevelDetailCard {...defaultProps} {...props} />);
    };

    // =========================================================================
    // CONTENT DISPLAY TESTS
    // =========================================================================

    describe('Content Display', () => {
        it('should display level number', () => {
            renderComponent();
            
            expect(screen.getByText(/LEVEL 3/i)).toBeInTheDocument();
        });

        it('should display title', () => {
            renderComponent();
            
            expect(screen.getByText('Defined - Standardized processes')).toBeInTheDocument();
        });

        it('should display description', () => {
            renderComponent();
            
            expect(screen.getByText(/processes are documented/i)).toBeInTheDocument();
        });

        it('should display helper questions', () => {
            renderComponent();
            
            expect(screen.getByText('Are processes documented?')).toBeInTheDocument();
            expect(screen.getByText('Is there a standard methodology?')).toBeInTheDocument();
        });

        it('should display formula when provided', () => {
            renderComponent();
            
            expect(screen.getByText(/Standardization = Documentation/)).toBeInTheDocument();
        });

        it('should not display formula section when not provided', () => {
            renderComponent({ formula: undefined });
            
            expect(screen.queryByText(/Working Formula/i)).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // ACTION BUTTON TESTS
    // =========================================================================

    describe('Action Buttons', () => {
        it('should render Actual button', () => {
            renderComponent();
            
            expect(screen.getByText(/Actual/)).toBeInTheDocument();
        });

        it('should render Target button', () => {
            renderComponent();
            
            expect(screen.getByText(/Target/)).toBeInTheDocument();
        });

        it('should render Not Applicable button', () => {
            renderComponent();
            
            expect(screen.getByText(/Not Applicable/)).toBeInTheDocument();
        });

        it('should call onSetActual when Actual clicked', () => {
            renderComponent();
            
            fireEvent.click(screen.getByText(/Actual/));
            
            expect(defaultProps.onSetActual).toHaveBeenCalled();
        });

        it('should call onSetTarget when Target clicked', () => {
            renderComponent();
            
            fireEvent.click(screen.getByText(/Target/));
            
            expect(defaultProps.onSetTarget).toHaveBeenCalled();
        });

        it('should call onSetNA when NA clicked', () => {
            renderComponent();
            
            fireEvent.click(screen.getByText(/Not Applicable/));
            
            expect(defaultProps.onSetNA).toHaveBeenCalled();
        });

        it('should show checkmark when Actual is set', () => {
            renderComponent({ isActual: true });
            
            // Button should contain CheckCircle2 icon
            const actualBtn = screen.getByText(/Actual/).closest('button');
            expect(actualBtn?.querySelector('svg')).toBeInTheDocument();
        });

        it('should show checkmark when Target is set', () => {
            renderComponent({ isTarget: true });
            
            const targetBtn = screen.getByText(/Target/).closest('button');
            expect(targetBtn?.querySelector('svg')).toBeInTheDocument();
        });
    });

    // =========================================================================
    // NOTES SECTION TESTS
    // =========================================================================

    describe('Notes Section', () => {
        it('should display notes textarea', () => {
            renderComponent();
            
            expect(screen.getByRole('textbox')).toBeInTheDocument();
        });

        it('should display current notes value', () => {
            renderComponent({ notes: 'Test note content' });
            
            expect(screen.getByRole('textbox')).toHaveValue('Test note content');
        });

        it('should call onNotesChange when typing', () => {
            renderComponent();
            
            const textarea = screen.getByRole('textbox');
            fireEvent.change(textarea, { target: { value: 'New note' } });
            
            expect(defaultProps.onNotesChange).toHaveBeenCalledWith('New note');
        });

        it('should show save button when notes exist', () => {
            renderComponent({ notes: 'Some content' });
            
            expect(screen.getByText(/Save/)).toBeInTheDocument();
        });

        it('should not show save button when notes empty', () => {
            renderComponent({ notes: '' });
            
            expect(screen.queryByText(/Save/)).not.toBeInTheDocument();
        });
    });

    // =========================================================================
    // AI BUTTON TESTS
    // =========================================================================

    describe('AI Button', () => {
        it('should display AI button when onAiAssist provided', () => {
            renderComponent();
            
            expect(screen.getByText(/AI/)).toBeInTheDocument();
        });

        it('should call onAiAssist when clicked', () => {
            renderComponent();
            
            const aiBtn = screen.getByText(/AI/).closest('button');
            fireEvent.click(aiBtn!);
            
            expect(defaultProps.onAiAssist).toHaveBeenCalled();
        });

        it('should be disabled when loading', () => {
            renderComponent({ isAiLoading: true });
            
            const aiBtn = screen.getByText(/Myślę|Thinking/i).closest('button');
            expect(aiBtn).toBeDisabled();
        });

        it('should show loading text when loading', () => {
            renderComponent({ isAiLoading: true });
            
            expect(screen.getByText(/Myślę|Thinking/i)).toBeInTheDocument();
        });

        it('should not show AI button when onAiAssist not provided', () => {
            renderComponent({ onAiAssist: undefined });
            
            // AI button should not be present
            const aiButtons = screen.queryAllByText(/AI/);
            expect(aiButtons.length).toBe(0);
        });
    });

    // =========================================================================
    // STYLING TESTS
    // =========================================================================

    describe('Styling', () => {
        it('should apply active styles to Actual button when set', () => {
            renderComponent({ isActual: true });
            
            const actualBtn = screen.getByText(/Actual/).closest('button');
            expect(actualBtn).toHaveClass('btn-actual-active');
        });

        it('should apply active styles to Target button when set', () => {
            renderComponent({ isTarget: true });
            
            const targetBtn = screen.getByText(/Target/).closest('button');
            expect(targetBtn).toHaveClass('btn-target-active');
        });
    });
});

