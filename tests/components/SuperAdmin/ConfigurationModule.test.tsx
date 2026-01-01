/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfigurationModule from '../../../views/superadmin/ConfigurationModule';

describe('ConfigurationModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default settings tab', () => {
        render(<ConfigurationModule />);
        
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<ConfigurationModule initialTab="whitelabel" />);
        
        expect(screen.getByText('White-label')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<ConfigurationModule />);
        
        fireEvent.click(screen.getByText('White-label'));
        expect(screen.getByText('White-label')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('Legal'));
        expect(screen.getByText('Legal')).toBeInTheDocument();
    });

    it('should display all three tabs', () => {
        render(<ConfigurationModule />);
        
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('White-label')).toBeInTheDocument();
        expect(screen.getByText('Legal')).toBeInTheDocument();
    });
});
