/**
 * SecurityPoliciesPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SecurityPoliciesPanel } from '../../components/SuperAdmin/security/SecurityPoliciesPanel';
import { Api } from '../../../services/api';

// Mock the Api module
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn(),
        put: vi.fn(),
        post: vi.fn(),
        getOrganizations: vi.fn(),
    },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe('SecurityPoliciesPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockPolicy = {
        id: 'policy-1',
        organizationId: 'org-1',
        passwordMinLength: 12,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSpecial: true,
        passwordExpiryDays: 90,
        passwordHistoryCount: 5,
        maxLoginAttempts: 5,
        lockoutDurationMinutes: 30,
        sessionTimeoutMinutes: 60,
        concurrentSessionsLimit: 3,
        requireSessionBinding: false,
        ipAllowlist: [],
        ipBlocklist: [],
        geoRestrictions: [],
        mfaRequired: true,
        mfaMethods: ['totp'],
        mfaRememberDeviceDays: 30,
        compliancePreset: 'soc2',
    };

    const mockPresets = [
        { id: 'none', name: 'Standard', description: 'Basic security settings' },
        { id: 'soc2', name: 'SOC 2', description: 'SOC 2 Type II compliance' },
        { id: 'hipaa', name: 'HIPAA', description: 'Healthcare compliance' },
        { id: 'gdpr', name: 'GDPR', description: 'EU data protection' },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/presets')) {
                return Promise.resolve({ presets: mockPresets });
            }
            if (url.includes('/defaults') || url.includes('/security-policies/')) {
                return Promise.resolve({ policy: mockPolicy });
            }
            return Promise.resolve({});
        });
    });

    it('renders loading state initially', () => {
        render(<SecurityPoliciesPanel />);
        expect(screen.getByRole('status') || document.querySelector('.animate-spin')).toBeTruthy();
    });

    it('fetches and displays organizations', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('fetches policy presets', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/security-policies/presets');
        });
    });

    it('displays password policy section', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Password Policy')).toBeTruthy();
        });
    });

    it('displays session policy section', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Session Policy')).toBeTruthy();
        });
    });

    it('displays MFA section', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Multi-Factor Authentication')).toBeTruthy();
        });
    });

    it('shows save button disabled when no changes', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            const saveButton = screen.getByText('Save Changes');
            expect(saveButton.closest('button')).toHaveProperty('disabled', true);
        });
    });

    it('enables save button when policy is changed', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Password Policy')).toBeTruthy();
        });

        // Change a value
        const minLengthInput = screen.getByDisplayValue('12');
        fireEvent.change(minLengthInput, { target: { value: '14' } });

        const saveButton = screen.getByText('Save Changes');
        expect(saveButton.closest('button')).toHaveProperty('disabled', false);
    });

    it('saves policy changes when save button is clicked', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Password Policy')).toBeTruthy();
        });

        // Make a change
        const minLengthInput = screen.getByDisplayValue('12');
        fireEvent.change(minLengthInput, { target: { value: '14' } });

        // Click save
        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalled();
        });
    });

    it('displays compliance preset badge when preset is applied', async () => {
        render(<SecurityPoliciesPanel />);
        
        await waitFor(() => {
            expect(screen.getByText(/SOC 2.*Compliance/i) || screen.getByText('soc2')).toBeTruthy();
        });
    });
});












