/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfigurationModule from '../../../views/superadmin/ConfigurationModule';

// Mock child components
vi.mock('../../../views/superadmin/SystemSettings', () => ({
    SystemSettings: () => <div data-testid="settings-view">System Settings</div>
}));

vi.mock('../../../views/superadmin/WhitelabelStudioView', () => ({
    WhitelabelStudioView: () => <div data-testid="whitelabel-view">Whitelabel Studio</div>
}));

describe('ConfigurationModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default settings tab', () => {
        render(<ConfigurationModule />);
        
        expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<ConfigurationModule initialTab="whitelabel" />);
        
        expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<ConfigurationModule />);
        
        const whitelabelTab = screen.getAllByText('White-label')[0];
        fireEvent.click(whitelabelTab);
        expect(whitelabelTab).toBeInTheDocument();
        
        const legalTab = screen.getAllByText('Legal')[0];
        fireEvent.click(legalTab);
        expect(legalTab).toBeInTheDocument();
    });

    it('should display all three tabs', () => {
        render(<ConfigurationModule />);
        
        expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
        expect(screen.getAllByText('White-label').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Legal').length).toBeGreaterThan(0);
    });
});
