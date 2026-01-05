/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SteeringCommitteeReport } from '../@/components/Reports/Management/SteeringCommitteeReport';
import { ManagementReport, SteeringCommitteeReportContent } from '../@/types';

const mockContent: SteeringCommitteeReportContent = {
    executiveSummary: 'Project is on track with major milestones achieved.',
    overallStatus: {
        schedule: { category: 'SCHEDULE', status: 'GREEN', trend: 'STABLE', summary: 'On track' },
        budget: { category: 'BUDGET', status: 'GREEN', trend: 'STABLE', summary: 'On budget' },
        scope: { category: 'SCOPE', status: 'GREEN', trend: 'STABLE', summary: 'Stable' },
        risk: { category: 'RISK', status: 'GREEN', trend: 'STABLE', summary: 'Low' },
        overallHealth: 'GREEN',
        lastUpdated: new Date().toISOString()
    },
    kpis: [
        { id: 'k1', name: 'ROI', category: 'COST', currentValue: 120, targetValue: 100, unit: '%', trend: 'IMPROVING', status: 'GREEN' }
    ],
    risksAndIssues: [],
    decisionsRequired: [],
    forecast: {
        nextMilestones: [],
        nextGates: [],
        forecastNarrative: 'On track to meet Q1 goals.'
    },
    warnings: [],
    auditTrail: {
        reportId: 'rep-1',
        generatedAt: new Date().toISOString(),
        generatedBy: 'system',
        generatedByName: 'System Admin',
        version: '1',
        pmoDomain: 'EXECUTION',
        iso21500Mapping: '',
        pmbokMapping: '',
        prince2Mapping: '',
        dataSnapshot: {
            projectsIncluded: 1,
            tasksAnalyzed: 10,
            initiativesAnalyzed: 2,
            decisionsAnalyzed: 0,
            risksAnalyzed: 0,
            dataAsOf: new Date().toISOString()
        }
    }
};

const mockReport: ManagementReport = {
    id: 'rep-1',
    organizationId: 'org-1',
    reportType: 'STEERING_COMMITTEE',
    scope: 'PROJECT',
    status: 'FINAL',
    title: 'Monthly Highlight Report',
    periodStart: '2025-12-01',
    periodEnd: '2025-12-31',
    generatedBy: 'user-1',
    generatedByName: 'John Doe',
    content: mockContent,
    aiNarrative: 'Strategic insights...',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

describe('SteeringCommitteeReport Component', () => {
    it('renders the report title and executive summary', () => {
        render(<SteeringCommitteeReport report={mockReport} />);
        expect(screen.getByText('Monthly Highlight Report')).toBeInTheDocument();
        expect(screen.getByText('Project is on track with major milestones achieved.')).toBeInTheDocument();
    });

    it('renders the RAG status area', () => {
        render(<SteeringCommitteeReport report={mockReport} />);
        expect(screen.getByText('Schedule')).toBeInTheDocument();
        expect(screen.getByText('Budget')).toBeInTheDocument();
    });

    it('renders KPI section', () => {
        render(<SteeringCommitteeReport report={mockReport} />);
        expect(screen.getByText('ROI')).toBeInTheDocument();
        expect(screen.getByText('120%')).toBeInTheDocument();
    });
});
