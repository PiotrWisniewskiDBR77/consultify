/**
 * BackupConfigPanel Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BackupConfigPanel } from '../../components/SuperAdmin/data/BackupConfigPanel';
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

describe('BackupConfigPanel', () => {
    const mockOrganizations = [
        { id: 'org-1', name: 'Test Organization' },
        { id: 'org-2', name: 'Another Org' },
    ];

    const mockConfig = {
        id: 'config-1',
        organization_id: 'org-1',
        enabled: true,
        frequency: 'daily',
        retention_days: 30,
        include_attachments: true,
        include_audit_logs: false,
        last_backup_at: '2025-01-01T02:00:00Z',
        last_backup_status: 'success',
        last_backup_size: 52428800, // 50MB
    };

    const mockHistory = [
        {
            id: 'backup-1',
            timestamp: '2025-01-01T02:00:00Z',
            status: 'success',
            size: 52428800,
            type: 'scheduled',
        },
        {
            id: 'backup-2',
            timestamp: '2024-12-31T02:00:00Z',
            status: 'success',
            size: 51200000,
            type: 'scheduled',
        },
        {
            id: 'backup-3',
            timestamp: '2024-12-30T02:00:00Z',
            status: 'failed',
            size: 0,
            type: 'manual',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getOrganizations as any).mockResolvedValue(mockOrganizations);
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup-config')) {
                return Promise.resolve({ config: mockConfig });
            }
            if (url.includes('/backup-history')) {
                return Promise.resolve({ history: mockHistory });
            }
            return Promise.resolve({});
        });
    });

    it('renders and fetches organizations', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(Api.getOrganizations).toHaveBeenCalled();
        });
    });

    it('shows organization select dropdown', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Test Organization')).toBeTruthy();
        });
    });

    it('fetches backup config when organization is selected', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(Api.get).toHaveBeenCalledWith('/data-export/backup-config?organizationId=org-1');
        });
    });

    it('displays backup configuration section', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Backup Configuration')).toBeTruthy();
            expect(screen.getByText('Configure automatic backups')).toBeTruthy();
        });
    });

    it('shows enable/disable toggle', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Enable Automatic Backups')).toBeTruthy();
        });
    });

    it('shows frequency selector', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Backup Frequency')).toBeTruthy();
            expect(screen.getByDisplayValue('Daily')).toBeTruthy();
        });
    });

    it('shows retention period input', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Retention Period (days)')).toBeTruthy();
            expect(screen.getByDisplayValue('30')).toBeTruthy();
        });
    });

    it('shows include attachments checkbox', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Include Attachments')).toBeTruthy();
        });
    });

    it('shows include audit logs checkbox', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Include Audit Logs')).toBeTruthy();
        });
    });

    it('displays backup status section', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Backup Status')).toBeTruthy();
            expect(screen.getByText('Current backup information')).toBeTruthy();
        });
    });

    it('shows last backup date', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Last Backup')).toBeTruthy();
        });
    });

    it('shows last backup size', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Last Backup Size')).toBeTruthy();
            expect(screen.getByText('50.0 MB')).toBeTruthy();
        });
    });

    it('shows next scheduled backup', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Next Scheduled Backup')).toBeTruthy();
        });
    });

    it('displays backup history section', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Recent Backups')).toBeTruthy();
            expect(screen.getByText('Backup history')).toBeTruthy();
        });
    });

    it('shows backup history items', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            // Check for history items
            const historyItems = document.querySelectorAll('.lucide-check-circle-2, .lucide-x-circle');
            expect(historyItems.length).toBeGreaterThan(0);
        });
    });

    it('shows Run Backup Now button', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Run Backup Now')).toBeTruthy();
        });
    });

    it('shows Save Changes button', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Save Changes')).toBeTruthy();
        });
    });

    it('enables save button when config is changed', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Backup Configuration')).toBeTruthy();
        });

        // Change retention days
        const retentionInput = screen.getByDisplayValue('30');
        fireEvent.change(retentionInput, { target: { value: '60' } });

        const saveButton = screen.getByText('Save Changes');
        expect(saveButton.closest('button')).not.toHaveProperty('disabled', true);
    });

    it('saves config when save button is clicked', async () => {
        (Api.put as any).mockResolvedValue({ success: true });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByDisplayValue('30')).toBeTruthy();
        });

        // Change retention days
        const retentionInput = screen.getByDisplayValue('30');
        fireEvent.change(retentionInput, { target: { value: '60' } });

        // Click save
        fireEvent.click(screen.getByText('Save Changes'));

        await waitFor(() => {
            expect(Api.put).toHaveBeenCalledWith(
                '/data-export/backup-config?organizationId=org-1',
                expect.objectContaining({
                    retentionDays: 60,
                })
            );
        });
    });

    it('triggers manual backup when Run Backup Now is clicked', async () => {
        (Api.post as any).mockResolvedValue({ success: true });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Run Backup Now')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Run Backup Now'));

        await waitFor(() => {
            expect(Api.post).toHaveBeenCalledWith('/data-export/backup-config/trigger', { organizationId: 'org-1' });
        });
    });

    it('disables Run Backup Now when backups are disabled', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup-config')) {
                return Promise.resolve({ config: { ...mockConfig, enabled: false } });
            }
            if (url.includes('/backup-history')) {
                return Promise.resolve({ history: mockHistory });
            }
            return Promise.resolve({});
        });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            const runButton = screen.getByText('Run Backup Now');
            expect(runButton.closest('button')).toHaveProperty('disabled', true);
        });
    });

    it('shows "Never" when no last backup', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup-config')) {
                return Promise.resolve({ config: { ...mockConfig, last_backup_at: null } });
            }
            if (url.includes('/backup-history')) {
                return Promise.resolve({ history: [] });
            }
            return Promise.resolve({});
        });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Never')).toBeTruthy();
        });
    });

    it('shows "Disabled" for next backup when backups are disabled', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup-config')) {
                return Promise.resolve({ config: { ...mockConfig, enabled: false } });
            }
            if (url.includes('/backup-history')) {
                return Promise.resolve({ history: mockHistory });
            }
            return Promise.resolve({});
        });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Disabled')).toBeTruthy();
        });
    });

    it('shows empty history message when no backups', async () => {
        (Api.get as any).mockImplementation((url: string) => {
            if (url.includes('/backup-config')) {
                return Promise.resolve({ config: mockConfig });
            }
            if (url.includes('/backup-history')) {
                return Promise.resolve({ history: [] });
            }
            return Promise.resolve({});
        });
        
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('No backup history available')).toBeTruthy();
        });
    });

    it('refreshes data when refresh button is clicked', async () => {
        render(<BackupConfigPanel />);
        
        await waitFor(() => {
            expect(screen.getByText('Backup Configuration')).toBeTruthy();
        });

        vi.clearAllMocks();
        
        const refreshIcon = document.querySelector('svg.lucide-refresh-cw');
        if (refreshIcon) {
            fireEvent.click(refreshIcon.closest('button')!);
        }

        await waitFor(() => {
            expect(Api.get).toHaveBeenCalled();
        });
    });
});












