/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SystemModule from '../../../views/superadmin/SystemModule';

describe('SystemModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default health tab', () => {
        render(<SystemModule />);
        
        expect(screen.getByText('Health')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<SystemModule initialTab="audit-log" />);
        
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<SystemModule />);
        
        fireEvent.click(screen.getByText('Audit Log'));
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Feature Flags'));
        expect(screen.getByText('Feature Flags')).toBeInTheDocument();
    });

    it('should display all four tabs', () => {
        render(<SystemModule />);
        
        expect(screen.getByText('Health')).toBeInTheDocument();
        expect(screen.getByText('Audit Log')).toBeInTheDocument();
        expect(screen.getByText('Feature Flags')).toBeInTheDocument();
        expect(screen.getByText('Integrations')).toBeInTheDocument();
    });
});
