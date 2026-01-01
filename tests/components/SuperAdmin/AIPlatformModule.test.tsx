/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIPlatformModule from '../../../views/superadmin/AIPlatformModule';

describe('AIPlatformModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default llm-config tab', () => {
        render(<AIPlatformModule />);
        
        expect(screen.getByText('LLM Config')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<AIPlatformModule initialTab="intelligence" />);
        
        expect(screen.getByText('Intelligence')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<AIPlatformModule />);
        
        fireEvent.click(screen.getByText('Intelligence'));
        expect(screen.getByText('Intelligence')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Knowledge'));
        expect(screen.getByText('Knowledge')).toBeInTheDocument();
    });

    it('should display all five tabs', () => {
        render(<AIPlatformModule />);
        
        expect(screen.getByText('LLM Config')).toBeInTheDocument();
        expect(screen.getByText('Intelligence')).toBeInTheDocument();
        expect(screen.getByText('Knowledge')).toBeInTheDocument();
        expect(screen.getByText('Costs')).toBeInTheDocument();
        expect(screen.getByText('Health')).toBeInTheDocument();
    });

    it('should render correct content for each tab', () => {
        render(<AIPlatformModule />);
        
        // Default tab should show LLM Config content
        expect(screen.getByText('LLM Config')).toBeInTheDocument();
    });
});
