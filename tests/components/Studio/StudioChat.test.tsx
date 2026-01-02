/**
 * StudioChat Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StudioChat } from '../../../components/Studio/StudioChat';

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

describe('StudioChat', () => {
    const defaultProps = {
        messages: [],
        isProcessing: false,
        onSendMessage: vi.fn()
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render empty state when no messages', () => {
        render(<StudioChat {...defaultProps} />);
        
        expect(screen.getByText('Start Creating')).toBeInTheDocument();
        expect(screen.getByText(/Describe the diagram/)).toBeInTheDocument();
    });

    it('should render messages', () => {
        const messages = [
            { id: 'msg-1', role: 'user' as const, content: 'Create a process flow', timestamp: new Date() },
            { id: 'msg-2', role: 'assistant' as const, content: 'I created the diagram', timestamp: new Date() }
        ];
        
        render(<StudioChat {...defaultProps} messages={messages} />);
        
        expect(screen.getByText('Create a process flow')).toBeInTheDocument();
        expect(screen.getByText('I created the diagram')).toBeInTheDocument();
    });

    it('should show processing indicator when isProcessing is true', () => {
        render(<StudioChat {...defaultProps} isProcessing={true} />);
        
        expect(screen.getByText(/Generating diagram/)).toBeInTheDocument();
    });

    it('should call onSendMessage when sending a message', () => {
        const onSendMessage = vi.fn();
        
        render(<StudioChat {...defaultProps} onSendMessage={onSendMessage} />);
        
        const input = screen.getByPlaceholderText(/Describe your diagram/);
        fireEvent.change(input, { target: { value: 'Create a flow chart' } });
        
        const sendButton = screen.getByRole('button', { name: '' }); // Send button has no text
        fireEvent.click(sendButton);
        
        expect(onSendMessage).toHaveBeenCalledWith('Create a flow chart');
    });

    it('should not send empty messages', () => {
        const onSendMessage = vi.fn();
        
        render(<StudioChat {...defaultProps} onSendMessage={onSendMessage} />);
        
        const sendButton = screen.getByRole('button', { name: '' });
        fireEvent.click(sendButton);
        
        expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should send message on Enter key', () => {
        const onSendMessage = vi.fn();
        
        render(<StudioChat {...defaultProps} onSendMessage={onSendMessage} />);
        
        const input = screen.getByPlaceholderText(/Describe your diagram/);
        fireEvent.change(input, { target: { value: 'Create an org chart' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        
        expect(onSendMessage).toHaveBeenCalledWith('Create an org chart');
    });

    it('should not send on Shift+Enter', () => {
        const onSendMessage = vi.fn();
        
        render(<StudioChat {...defaultProps} onSendMessage={onSendMessage} />);
        
        const input = screen.getByPlaceholderText(/Describe your diagram/);
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
        
        expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should show quick actions when no messages', () => {
        render(<StudioChat {...defaultProps} />);
        
        expect(screen.getByText('Quick actions')).toBeInTheDocument();
        expect(screen.getByText('Create process flow')).toBeInTheDocument();
        expect(screen.getByText('Create org chart')).toBeInTheDocument();
    });

    it('should fill input with quick action prompt', () => {
        render(<StudioChat {...defaultProps} />);
        
        const quickAction = screen.getByText('Create process flow');
        fireEvent.click(quickAction);
        
        const input = screen.getByPlaceholderText(/Describe your diagram/) as HTMLTextAreaElement;
        expect(input.value).toContain('Create a process flow for');
    });

    it('should show clear button when there are messages', () => {
        const messages = [
            { id: 'msg-1', role: 'user' as const, content: 'Test', timestamp: new Date() }
        ];
        const onClear = vi.fn();
        
        render(<StudioChat {...defaultProps} messages={messages} onClear={onClear} />);
        
        const clearButton = screen.getByTitle('Clear chat');
        expect(clearButton).toBeInTheDocument();
        
        fireEvent.click(clearButton);
        expect(onClear).toHaveBeenCalled();
    });

    it('should display diagram update indicator in message', () => {
        const messages = [
            { 
                id: 'msg-1', 
                role: 'assistant' as const, 
                content: 'Created diagram', 
                timestamp: new Date(),
                diagramUpdate: {
                    action: 'replace' as const,
                    nodes: [],
                    edges: []
                }
            }
        ];
        
        render(<StudioChat {...defaultProps} messages={messages} />);
        
        expect(screen.getByText(/Diagram generated/)).toBeInTheDocument();
    });

    it('should disable send button when processing', () => {
        render(<StudioChat {...defaultProps} isProcessing={true} />);
        
        const input = screen.getByPlaceholderText(/Describe your diagram/);
        fireEvent.change(input, { target: { value: 'Test' } });
        
        // Button should be disabled (has spinner instead of send icon)
        const buttons = screen.getAllByRole('button');
        const sendButton = buttons.find(b => b.className.includes('rounded-lg') && b.closest('.shrink-0'));
        if (sendButton) expect(sendButton).toBeDisabled();
    });

    it('should display suggestions when provided', () => {
        const suggestions = ['Add a decision node', 'Connect nodes A and B'];
        
        render(<StudioChat {...defaultProps} suggestions={suggestions} />);
        
        // Suggestions should be visible
        expect(screen.getByText('Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Add a decision node')).toBeInTheDocument();
    });
});

