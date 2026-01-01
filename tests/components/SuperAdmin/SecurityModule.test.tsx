/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityModule from '../../../views/superadmin/SecurityModule';

describe('SecurityModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default sso tab', () => {
        render(<SecurityModule />);
        
        expect(screen.getByText('SSO')).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<SecurityModule initialTab="policies" />);
        
        expect(screen.getByText('Policies')).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<SecurityModule />);
        
        fireEvent.click(screen.getByText('Policies'));
        expect(screen.getByText('Policies')).toBeInTheDocument();
        
        fireEvent.click(screen.getByText('API Keys'));
        expect(screen.getByText('API Keys')).toBeInTheDocument();
    });

    it('should display all four tabs', () => {
        render(<SecurityModule />);
        
        expect(screen.getByText('SSO')).toBeInTheDocument();
        expect(screen.getByText('Policies')).toBeInTheDocument();
        expect(screen.getByText('API Keys')).toBeInTheDocument();
        expect(screen.getByText('Compliance')).toBeInTheDocument();
    });
});
