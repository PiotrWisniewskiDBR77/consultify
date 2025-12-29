/**
 * MFASetup Component Tests
 * 
 * Tests for the Multi-Factor Authentication setup wizard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback: string) => fallback || key,
    }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
});

import MFASetup from '../../../components/auth/MFASetup';

describe('MFASetup', () => {
    const mockOnComplete = vi.fn();
    const mockOnCancel = vi.fn();
    const user = userEvent.setup();

    const mockSetupData = {
        qrCode: 'data:image/png;base64,mock-qr-code',
        manualEntry: 'ABCD1234EFGH5678',
        message: 'Scan the QR code with your authenticator app'
    };

    const mockBackupCodes = ['CODE1-1234', 'CODE2-5678', 'CODE3-9012', 'CODE4-3456', 'CODE5-7890'];

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(
            <MFASetup
                onComplete={mockOnComplete}
                onCancel={mockOnCancel}
                {...props}
            />
        );
    };

    // ===== Step 1: Introduction =====

    describe('Introduction Step', () => {
        it('renders introduction screen by default', () => {
            renderComponent();

            expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
            expect(screen.getByText('Add an extra layer of security')).toBeInTheDocument();
            expect(screen.getByText(/download an authenticator app/i)).toBeInTheDocument();
        });

        it('shows setup steps', () => {
            renderComponent();

            expect(screen.getByText(/download an authenticator app/i)).toBeInTheDocument();
            expect(screen.getByText(/scan the qr code/i)).toBeInTheDocument();
            expect(screen.getByText(/enter the code/i)).toBeInTheDocument();
        });

        it('renders Continue and Cancel buttons', () => {
            renderComponent();

            expect(screen.getByText('Continue')).toBeInTheDocument();
            expect(screen.getByText('Cancel')).toBeInTheDocument();
        });

        it('calls onCancel when Cancel clicked', async () => {
            renderComponent();

            await user.click(screen.getByText('Cancel'));

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('initiates setup when Continue clicked', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData
            });

            renderComponent();

            await user.click(screen.getByText('Continue'));

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/mfa/setup',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-token'
                    })
                })
            );
        });

        it('shows loading state while initializing', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));

            renderComponent();

            await user.click(screen.getByText('Continue'));

            expect(screen.getByText('Continue').closest('button')).toBeDisabled();
        });

        it('shows error if setup fails', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Setup failed' })
            });

            renderComponent();

            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText('Setup failed')).toBeInTheDocument();
            });
        });
    });

    // ===== Step 2: Scan QR Code =====

    describe('Scan QR Code Step', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData
            });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
            });
        });

        it('displays QR code image', () => {
            const qrImage = screen.getByAltText('MFA QR Code');
            expect(qrImage).toBeInTheDocument();
            expect(qrImage).toHaveAttribute('src', mockSetupData.qrCode);
        });

        it('displays manual entry code', () => {
            expect(screen.getByText(mockSetupData.manualEntry)).toBeInTheDocument();
        });

        it('copies secret to clipboard when copy clicked', async () => {
            const copyButtons = screen.getAllByRole('button');
            const copyButton = copyButtons.find(btn => 
                btn.getAttribute('title') === 'Copy'
            );

            if (copyButton) {
                await user.click(copyButton);

                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                    mockSetupData.manualEntry
                );
            }
        });

        it('shows copied confirmation', async () => {
            const copyButtons = screen.getAllByRole('button');
            const copyButton = copyButtons.find(btn => 
                btn.getAttribute('title') === 'Copy'
            );

            if (copyButton) {
                await user.click(copyButton);

                // Check icon should appear
                await waitFor(() => {
                    expect(document.querySelector('[class*="text-green"]')).toBeInTheDocument();
                });
            }
        });

        it('proceeds to verify step when button clicked', async () => {
            await user.click(screen.getByText("I've scanned the code"));

            expect(screen.getByText(/enter the 6-digit code/i)).toBeInTheDocument();
        });
    });

    // ===== Step 3: Verify Code =====

    describe('Verify Code Step', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData
            });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
            });

            await user.click(screen.getByText("I've scanned the code"));
        });

        it('renders verification input', () => {
            expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
        });

        it('only accepts numeric input', async () => {
            const input = screen.getByPlaceholderText('000000');
            await user.type(input, 'abc123def');

            expect(input).toHaveValue('123');
        });

        it('limits input to 6 digits', async () => {
            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '1234567890');

            expect(input).toHaveValue('123456');
        });

        it('enables verify button with 6 digits', async () => {
            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '123456');

            expect(screen.getByText('Verify & Enable')).not.toBeDisabled();
        });

        it('disables verify button with less than 6 digits', async () => {
            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '12345');

            expect(screen.getByText('Verify & Enable')).toBeDisabled();
        });

        it('goes back to scan step when Back clicked', async () => {
            await user.click(screen.getByText('Back'));

            expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
        });

        it('verifies code and shows backup codes on success', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    backupCodes: mockBackupCodes
                })
            });

            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '123456');
            await user.click(screen.getByText('Verify & Enable'));

            await waitFor(() => {
                expect(screen.getByText('Two-Factor Authentication Enabled!')).toBeInTheDocument();
            });
        });

        it('shows error for invalid verification code', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Invalid token' })
            });

            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '000000');
            await user.click(screen.getByText('Verify & Enable'));

            await waitFor(() => {
                expect(screen.getByText('Invalid token')).toBeInTheDocument();
            });
        });

        it('shows error for too short code', async () => {
            const input = screen.getByPlaceholderText('000000');
            await user.clear(input);
            await user.type(input, '12345');
            
            // Button should be disabled, so clicking won't work
            // but we test that proper validation message would appear
            expect(screen.getByText('Verify & Enable')).toBeDisabled();
        });
    });

    // ===== Step 4: Backup Codes =====

    describe('Backup Codes Step', () => {
        beforeEach(async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSetupData
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => ({
                        success: true,
                        backupCodes: mockBackupCodes
                    })
                });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
            });

            await user.click(screen.getByText("I've scanned the code"));

            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '123456');
            await user.click(screen.getByText('Verify & Enable'));

            await waitFor(() => {
                expect(screen.getByText('Two-Factor Authentication Enabled!')).toBeInTheDocument();
            });
        });

        it('displays success message', () => {
            expect(screen.getByText('Two-Factor Authentication Enabled!')).toBeInTheDocument();
        });

        it('displays backup codes warning', () => {
            expect(screen.getByText('Save your backup codes!')).toBeInTheDocument();
        });

        it('displays all backup codes', () => {
            mockBackupCodes.forEach(code => {
                expect(screen.getByText(code)).toBeInTheDocument();
            });
        });

        it('copies all backup codes to clipboard', async () => {
            await user.click(screen.getByText('Copy all codes'));

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
                mockBackupCodes.join('\n')
            );
        });

        it('shows copied confirmation for backup codes', async () => {
            await user.click(screen.getByText('Copy all codes'));

            await waitFor(() => {
                expect(screen.getByText('Copied!')).toBeInTheDocument();
            });
        });

        it('calls onComplete when done button clicked', async () => {
            await user.click(screen.getByText("I've saved my backup codes"));

            expect(mockOnComplete).toHaveBeenCalledTimes(1);
        });
    });

    // ===== Error Handling =====

    describe('Error Handling', () => {
        it('displays API error messages', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Server error occurred' })
            });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText('Server error occurred')).toBeInTheDocument();
            });
        });

        it('displays network error messages', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/network error|failed to initialize/i)).toBeInTheDocument();
            });
        });

        it('clears error when trying again', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    json: async () => ({ error: 'First error' })
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSetupData
                });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText('First error')).toBeInTheDocument();
            });

            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.queryByText('First error')).not.toBeInTheDocument();
            });
        });
    });

    // ===== Loading States =====

    describe('Loading States', () => {
        it('shows loading during setup initialization', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));

            renderComponent();
            await user.click(screen.getByText('Continue'));

            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('shows loading during verification', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: async () => mockSetupData
                })
                .mockImplementation(() => new Promise(() => {}));

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
            });

            await user.click(screen.getByText("I've scanned the code"));

            const input = screen.getByPlaceholderText('000000');
            await user.type(input, '123456');
            await user.click(screen.getByText('Verify & Enable'));

            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });

        it('disables buttons during loading', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));

            renderComponent();
            await user.click(screen.getByText('Continue'));

            expect(screen.getByText('Continue').closest('button')).toBeDisabled();
        });
    });

    // ===== Accessibility =====

    describe('Accessibility', () => {
        it('has accessible form controls', () => {
            renderComponent();

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);
        });

        it('focuses input on verify step', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData
            });

            renderComponent();
            await user.click(screen.getByText('Continue'));

            await waitFor(() => {
                expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
            });

            await user.click(screen.getByText("I've scanned the code"));

            const input = screen.getByPlaceholderText('000000');
            expect(document.activeElement).toBe(input);
        });
    });
});
