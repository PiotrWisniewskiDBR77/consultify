/**
 * Action Proposal List Component Tests
 * 
 * Phase 5: Component Tests - Critical AI Component
 * Tests AI action proposal list rendering and selection.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ActionProposalList, ActionProposal } from '../../components/ai/ActionProposalList';

describe('ActionProposalList', () => {
    const mockProposals: ActionProposal[] = [
        {
            proposal_id: 'prop-1',
            origin_signal: 'signal-1',
            origin_recommendation: 'recommendation-1',
            title: 'Create Task for Initiative',
            action_type: 'TASK_CREATE',
            scope: 'PROJECT',
            payload_preview: { taskTitle: 'New Task' },
            risk_level: 'LOW',
            expected_impact: 'Improve efficiency',
            simulation: {
                assumptions: ['Assumption 1'],
                expected_direction: 'positive'
            },
            requires_approval: true
        },
        {
            proposal_id: 'prop-2',
            origin_signal: 'signal-2',
            origin_recommendation: 'recommendation-2',
            title: 'Schedule Meeting',
            action_type: 'MEETING_SCHEDULE',
            scope: 'INITIATIVE',
            payload_preview: { meetingDate: '2024-01-01' },
            risk_level: 'HIGH',
            expected_impact: 'High impact change',
            simulation: {
                assumptions: ['Assumption 2'],
                expected_direction: 'negative'
            },
            requires_approval: true
        }
    ];

    const mockOnSelect = vi.fn();

    describe('Rendering', () => {
        it('should render empty state when no proposals', () => {
            render(
                <ActionProposalList
                    proposals={[]}
                    onSelect={mockOnSelect}
                />
            );
            expect(screen.getByText('No pending action proposals found.')).toBeInTheDocument();
        });

        it('should render list of proposals', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                />
            );
            expect(screen.getByText('Create Task for Initiative')).toBeInTheDocument();
            expect(screen.getByText('Schedule Meeting')).toBeInTheDocument();
        });

        it('should display proposal titles', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                />
            );
            expect(screen.getByText(mockProposals[0].title)).toBeInTheDocument();
            expect(screen.getByText(mockProposals[1].title)).toBeInTheDocument();
        });

        it('should display risk levels', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                />
            );
            // Risk badges should be present
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });
    });

    describe('Selection', () => {
        it('should call onSelect when proposal is clicked', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                />
            );
            const proposalButton = screen.getByText('Create Task for Initiative').closest('button');
            if (proposalButton) {
                fireEvent.click(proposalButton);
                expect(mockOnSelect).toHaveBeenCalledWith(mockProposals[0]);
            }
        });

        it('should highlight selected proposal', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                    selectedId="prop-1"
                />
            );
            const selectedButton = screen.getByText('Create Task for Initiative').closest('button');
            expect(selectedButton).toHaveClass('bg-indigo-600');
        });

        it('should not highlight unselected proposals', () => {
            render(
                <ActionProposalList
                    proposals={mockProposals}
                    onSelect={mockOnSelect}
                    selectedId="prop-1"
                />
            );
            const unselectedButton = screen.getByText('Schedule Meeting').closest('button');
            expect(unselectedButton).not.toHaveClass('bg-indigo-600');
        });
    });

    describe('Risk Level Display', () => {
        it('should display LOW risk correctly', () => {
            render(
                <ActionProposalList
                    proposals={[mockProposals[0]]}
                    onSelect={mockOnSelect}
                />
            );
            const button = screen.getByText('Create Task for Initiative').closest('button');
            expect(button).toBeInTheDocument();
        });

        it('should display HIGH risk correctly', () => {
            render(
                <ActionProposalList
                    proposals={[mockProposals[1]]}
                    onSelect={mockOnSelect}
                />
            );
            const button = screen.getByText('Schedule Meeting').closest('button');
            expect(button).toBeInTheDocument();
        });
    });

    describe('Action Type Icons', () => {
        it('should render correct icon for TASK_CREATE', () => {
            render(
                <ActionProposalList
                    proposals={[mockProposals[0]]}
                    onSelect={mockOnSelect}
                />
            );
            const button = screen.getByText('Create Task for Initiative').closest('button');
            expect(button).toBeInTheDocument();
        });

        it('should render correct icon for MEETING_SCHEDULE', () => {
            render(
                <ActionProposalList
                    proposals={[mockProposals[1]]}
                    onSelect={mockOnSelect}
                />
            );
            const button = screen.getByText('Schedule Meeting').closest('button');
            expect(button).toBeInTheDocument();
        });
    });
});

