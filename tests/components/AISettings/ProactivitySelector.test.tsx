/**
 * ProactivitySelector Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Import after mock
import { ProactivitySelector } from '@/components/AISettings/ProactivitySelector';

describe('ProactivitySelector', () => {
    const defaultProps = {
        value: 'BALANCED' as const,
        onChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders all three proactivity modes', () => {
        render(<ProactivitySelector {...defaultProps} />);
        
        expect(screen.getByText('Reactive')).toBeInTheDocument();
        expect(screen.getByText('Balanced')).toBeInTheDocument();
        expect(screen.getByText('Proactive')).toBeInTheDocument();
    });

    it('highlights the selected mode', () => {
        render(<ProactivitySelector {...defaultProps} value="PROACTIVE" />);
        
        // The Proactive button should have different styling (selected state)
        const proactiveButton = screen.getByRole('button', { name: /proactive/i });
        expect(proactiveButton).toHaveClass('border-2');
    });

    it('calls onChange when a mode is selected', () => {
        const onChange = vi.fn();
        render(<ProactivitySelector {...defaultProps} onChange={onChange} />);
        
        const reactiveButton = screen.getByRole('button', { name: /reactive/i });
        fireEvent.click(reactiveButton);
        
        expect(onChange).toHaveBeenCalledWith('REACTIVE');
    });

    it('disables modes above maxAllowed', () => {
        render(<ProactivitySelector {...defaultProps} maxAllowed="BALANCED" />);
        
        const proactiveButton = screen.getByRole('button', { name: /proactive/i });
        expect(proactiveButton).toBeDisabled();
    });

    it('shows behaviors when showBehaviors is true', () => {
        render(<ProactivitySelector {...defaultProps} showBehaviors={true} />);
        
        expect(screen.getByText('Auto-suggestions')).toBeInTheDocument();
        expect(screen.getByText('Proactive nudges')).toBeInTheDocument();
    });

    it('hides behaviors when showBehaviors is false', () => {
        render(<ProactivitySelector {...defaultProps} showBehaviors={false} />);
        
        expect(screen.queryByText('Auto-suggestions')).not.toBeInTheDocument();
    });

    it('renders in compact mode', () => {
        render(<ProactivitySelector {...defaultProps} compact={true} />);
        
        // In compact mode, mode titles should still be visible
        expect(screen.getByText('Balanced')).toBeInTheDocument();
    });

    it('does not call onChange when disabled', () => {
        const onChange = vi.fn();
        render(<ProactivitySelector {...defaultProps} onChange={onChange} disabled={true} />);
        
        const reactiveButton = screen.getByRole('button', { name: /reactive/i });
        fireEvent.click(reactiveButton);
        
        expect(onChange).not.toHaveBeenCalled();
    });

    it('shows correct description for REACTIVE mode', () => {
        render(<ProactivitySelector {...defaultProps} value="REACTIVE" showBehaviors={true} />);
        
        expect(screen.getByText(/waits for your questions/i)).toBeInTheDocument();
    });

    it('shows correct description for PROACTIVE mode', () => {
        render(<ProactivitySelector {...defaultProps} value="PROACTIVE" showBehaviors={true} />);
        
        expect(screen.getByText(/actively assists/i)).toBeInTheDocument();
    });
});

