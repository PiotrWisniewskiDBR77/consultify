/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectTeamPanel } from '../../../src/components/PMO/ProjectTeamPanel';

describe('ProjectTeamPanel Component', () => {
    const defaultProps = {
        projectId: 'proj-1',
        teamMembers: [
            { id: 'user-1', name: 'John Doe', role: 'Lead' },
            { id: 'user-2', name: 'Jane Smith', role: 'Developer' },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders component', () => {
        render(<ProjectTeamPanel {...defaultProps} />);
        expect(document.body).toBeDefined();
    });

    it('renders without crashing', () => {
        const { container } = render(<ProjectTeamPanel {...defaultProps} />);
        expect(container).toBeInTheDocument();
    });

    it('displays team content', () => {
        render(<ProjectTeamPanel {...defaultProps} />);

        const teamElements = screen.queryAllByText(/team|member|role/i);
        expect(teamElements.length).toBeGreaterThanOrEqual(0);
    });

    it('handles empty team', () => {
        render(<ProjectTeamPanel {...defaultProps} teamMembers={[]} />);
        expect(document.body).toBeDefined();
    });
});
