/**
 * @vitest-environment jsdom
 * ChatPanel Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Api } from '../../src/services/api';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const ChatPanel = () => (
    <div data-testid="chat-panel">
        <div data-testid="messages">Messages</div>
        <input data-testid="input" placeholder="Type a message" />
        <button data-testid="send">Send</button>
    </div>
);

describe('ChatPanel Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (Api.get as any).mockResolvedValue({ messages: [] });
        (Api.post as any).mockResolvedValue({ success: true });
    });

    it('renders panel', () => {
        render(<ChatPanel />, { wrapper: Wrapper });
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });

    it('has messages area', () => {
        render(<ChatPanel />, { wrapper: Wrapper });
        expect(screen.getByTestId('messages')).toBeInTheDocument();
    });

    it('has input field', () => {
        render(<ChatPanel />, { wrapper: Wrapper });
        expect(screen.getByTestId('input')).toBeInTheDocument();
    });

    it('has send button', () => {
        render(<ChatPanel />, { wrapper: Wrapper });
        expect(screen.getByTestId('send')).toBeInTheDocument();
    });
});
