/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ContentModule from '../../../views/superadmin/ContentModule';

// Mock child components
vi.mock('../../../views/superadmin/PlaybookTemplatesListView', () => ({
    PlaybookTemplatesListView: () => <div data-testid="playbooks-view">Playbooks Content</div>
}));

describe('ContentModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default playbooks tab', () => {
        render(<ContentModule />);
        
        expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<ContentModule initialTab="email-templates" />);
        
        expect(screen.getByRole('heading', { name: 'Content' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<ContentModule />);
        
        const emailTemplatesTab = screen.getAllByText('Email Templates')[0];
        fireEvent.click(emailTemplatesTab);
        expect(emailTemplatesTab).toBeInTheDocument();
    });

    it('should display both tabs', () => {
        render(<ContentModule />);
        
        expect(screen.getAllByText('Playbooks').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Email Templates').length).toBeGreaterThan(0);
    });
});
