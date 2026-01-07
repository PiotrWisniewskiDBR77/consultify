/**
 * AIModule Unit Tests
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AIModule } from '@/views/admin/AIModule';

// Mock dependencies
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('AIModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render AI module', () => {
        render(
            <BrowserRouter>
                <AIModule />
            </BrowserRouter>
        );
        
        expect(screen.getByText(/AI/i)).toBeInTheDocument();
    });

    it('should render llm-config tab by default', () => {
        render(
            <BrowserRouter>
                <AIModule />
            </BrowserRouter>
        );
        
        const llmTab = screen.queryByText(/LLM Config/i);
        expect(llmTab).toBeTruthy();
    });

    it('should render all four tabs', () => {
        render(
            <BrowserRouter>
                <AIModule />
            </BrowserRouter>
        );
        
        const tabs = ['LLM Config', 'AI Health', 'Help Analytics', 'Tokens'];
        tabs.forEach(tab => {
            const tabElement = screen.queryByText(new RegExp(tab, 'i'));
            expect(tabElement).toBeTruthy();
        });
    });
});

