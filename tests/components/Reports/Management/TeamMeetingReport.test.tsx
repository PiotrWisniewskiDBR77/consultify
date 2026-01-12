/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamMeetingReport } from '../../../../components/Reports/Management/TeamMeetingReport';
import { ManagementReport, TeamMeetingReportContent } from '../../../../types';

const mockContent: TeamMeetingReportContent = {
    statusSummary: {
        progressPercent: 65,
        healthStatus: 'GREEN',
        tasksTotal: 20,
        tasksCompleted: 13,
        tasksInProgress: 5,
        tasksBlocked: 2,
        tasksOverdue: 0,
        initiativesTotal: 4,
        initiativesOnTrack: 3,
        initiativesAtRisk: 1,
        decisionsApproved: 2,
        decisionsPending: 1
    },
    completedWork: [
        { id: 'w1', type: 'TASK', title: 'Login API', completedAt: new Date().toISOString(), completedBy: 'u1', completedByName: 'Dev 1' }
    ],
    workInProgress: [],
    blockers: [
        { id: 'b1', type: 'TASK', title: 'Missing assets', blockedReason: 'Wait for design', blockedSince: new Date().toISOString(), daysBlocked: 2, ownerId: 'u2', ownerName: 'Dev 2', severity: 'MEDIUM' }
    ],
    pendingDecisions: [],
    nextPeriodPlan: [
        { id: 'p1', type: 'TASK', title: 'E2E Testing', plannedDate: new Date().toISOString(), priority: 'HIGH' }
    ],
    aiHighlights: ['Maintained good velocity.'],
    aiConcerns: ['Design bottleneck identified.']
};

const mockReport: ManagementReport = {
    id: 'rep-2',
    organizationId: 'org-1',
    reportType: 'TEAM_MEETING',
    scope: 'PROJECT',
    status: 'FINAL',
    title: 'Weekly Team Checkpoint',
    periodStart: '2025-12-22',
    periodEnd: '2025-12-28',
    generatedBy: 'system',
    generatedByName: 'System',
    content: mockContent,
    aiNarrative: 'Weekly execution summary...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('TeamMeetingReport Component', () => {
    it('renders project progress metrics', () => {
        render(<TeamMeetingReport report={mockReport} />);
        expect(screen.getByText('65%')).toBeInTheDocument();
        expect(screen.getByText('13')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders task list and blockers', () => {
        render(<TeamMeetingReport report={mockReport} />);
        expect(screen.getByText('Login API')).toBeInTheDocument();
        expect(screen.getByText('Missing assets')).toBeInTheDocument();
    });

    it('renders the AI highlights', () => {
        render(<TeamMeetingReport report={mockReport} />);
        expect(screen.getByText('Maintained good velocity.')).toBeInTheDocument();
    });
});
