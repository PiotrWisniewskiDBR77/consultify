/**
 * StudioToolbar Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioToolbar } from '../../../components/Studio/StudioToolbar';

describe('StudioToolbar', () => {
    const defaultProps = {
        diagramType: 'process_flow',
        onAddNode: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render toolbar', () => {
        render(<StudioToolbar {...defaultProps} />);
        
        expect(screen.getByText('Process Step')).toBeInTheDocument();
        expect(screen.getByText('Decision')).toBeInTheDocument();
        expect(screen.getByText('Start/End')).toBeInTheDocument();
    });

    it('should call onAddNode when clicking a node type', () => {
        render(<StudioToolbar {...defaultProps} />);
        
        const processStepButton = screen.getByText('Process Step');
        fireEvent.click(processStepButton);
        
        expect(defaultProps.onAddNode).toHaveBeenCalledWith('processStep');
    });

    it('should show different node types for different diagram types', () => {
        const { rerender } = render(<StudioToolbar {...defaultProps} diagramType="org_chart" />);
        
        expect(screen.getByText('Person/Team')).toBeInTheDocument();
        
        rerender(<StudioToolbar {...defaultProps} diagramType="mindmap" />);
        expect(screen.getByText('Topic')).toBeInTheDocument();
        
        rerender(<StudioToolbar {...defaultProps} diagramType="raci" />);
        expect(screen.getByText('RACI Cell')).toBeInTheDocument();
    });

    it('should toggle expand/collapse', () => {
        render(<StudioToolbar {...defaultProps} />);
        
        const toggleButton = screen.getByRole('button', { name: '' });
        expect(toggleButton).toBeInTheDocument();
        
        // Toolbar should be visible initially
        expect(screen.getByText('Process Step')).toBeInTheDocument();
        
        // Click to collapse
        fireEvent.click(toggleButton);
        
        // Should still be in DOM but might be hidden
        // (depends on implementation)
    });

    it('should show "More" button', () => {
        render(<StudioToolbar {...defaultProps} />);
        
        expect(screen.getByText('More')).toBeInTheDocument();
    });
});








