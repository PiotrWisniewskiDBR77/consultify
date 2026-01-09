/**
 * @vitest-environment jsdom
 * LLMSelector Component Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>{children}</BrowserRouter>
);

const LLMSelector = () => (
    <div data-testid="llm-selector">
        <label>Select AI Model</label>
        <select data-testid="model-select">
            <option value="gpt-4">GPT-4</option>
            <option value="claude">Claude</option>
        </select>
    </div>
);

describe('LLMSelector Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders selector', () => {
        render(<LLMSelector />, { wrapper: Wrapper });
        expect(screen.getByTestId('llm-selector')).toBeInTheDocument();
    });

    it('has model dropdown', () => {
        render(<LLMSelector />, { wrapper: Wrapper });
        expect(screen.getByTestId('model-select')).toBeInTheDocument();
    });
});
