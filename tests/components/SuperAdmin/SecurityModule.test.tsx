/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SecurityModule from '@/views/superadmin/SecurityModule';

// Mock child components
vi.mock('@/views/superadmin/SSOConfigurationView', () => ({
    SSOConfigurationView: () => <div data-testid="sso-view">SSO Configuration</div>
}));

vi.mock('@/views/superadmin/SecurityPoliciesView', () => ({
    SecurityPoliciesView: () => <div data-testid="policies-view">Security Policies</div>
}));

vi.mock('@/views/superadmin/APIManagementView', () => ({
    APIManagementView: () => <div data-testid="api-view">API Management</div>
}));

vi.mock('@/views/superadmin/ComplianceCenterView', () => ({
    ComplianceCenterView: () => <div data-testid="compliance-view">Compliance Center</div>
}));

describe('SecurityModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with default sso tab', () => {
        render(<SecurityModule />);
        
        expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    });

    it('should render with initial tab', () => {
        render(<SecurityModule initialTab="policies" />);
        
        expect(screen.getByRole('heading', { name: 'Security' })).toBeInTheDocument();
    });

    it('should switch between tabs', () => {
        render(<SecurityModule />);
        
        const policiesTab = screen.getAllByText('Policies')[0];
        fireEvent.click(policiesTab);
        expect(policiesTab).toBeInTheDocument();
        
        const apiKeysTab = screen.getAllByText('API Keys')[0];
        fireEvent.click(apiKeysTab);
        expect(apiKeysTab).toBeInTheDocument();
    });

    it('should display all four tabs', () => {
        render(<SecurityModule />);
        
        expect(screen.getAllByText('SSO').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Policies').length).toBeGreaterThan(0);
        expect(screen.getAllByText('API Keys').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Compliance').length).toBeGreaterThan(0);
    });
});
