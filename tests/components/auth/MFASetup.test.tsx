import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MFASetup from '../../../components/auth/MFASetup';

// Mock fetch
global.fetch = vi.fn();

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
    }),
}));

// Mock navigator.clipboard
Object.assign(navigator, {
    clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
    },
});

describe('MFASetup Component', () => {
    const mockOnComplete = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('token', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders intro step correctly', () => {
        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
        expect(screen.getByText('Add an extra layer of security')).toBeInTheDocument();
        expect(screen.getByText(/Two-factor authentication adds an extra layer/)).toBeInTheDocument();
    });

    it('shows setup steps in intro', () => {
        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        expect(screen.getByText(/1. Download an authenticator app/)).toBeInTheDocument();
        expect(screen.getByText(/2. Scan the QR code/)).toBeInTheDocument();
        expect(screen.getByText(/3. Enter the code from your app/)).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked in intro', () => {
        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
        
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('initializes MFA setup and shows QR code', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/mfa/setup',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Scan this QR code with your authenticator app')).toBeInTheDocument();
            expect(screen.getByAltText('MFA QR Code')).toBeInTheDocument();
            expect(screen.getByText('ABCD EFGH IJKL MNOP')).toBeInTheDocument();
        });
    });

    it('shows error message when setup initialization fails', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Setup failed' }),
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            expect(screen.getByText('Setup failed')).toBeInTheDocument();
        });
    });

    it('copies manual entry secret to clipboard', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const copyButton = screen.getByTitle('Copy');
            fireEvent.click(copyButton);
        });

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD EFGH IJKL MNOP');
        });

        expect(screen.getByTitle('Copy')).toBeInTheDocument(); // Check icon changes
    });

    it('navigates to verify step from scan step', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Enter the 6-digit code from your authenticator app')).toBeInTheDocument();
        });
    });

    it('allows entering verification code', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8'] }),
            });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        // Go through setup
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '123456' } });
        });

        expect(screen.getByPlaceholderText('000000')).toHaveValue('123456');
    });

    it('filters non-numeric characters from verification code', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '12a34b56' } });
        });

        expect(screen.getByPlaceholderText('000000')).toHaveValue('123456');
    });

    it('limits verification code to 6 digits', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '1234567890' } });
        });

        expect(screen.getByPlaceholderText('000000')).toHaveValue('123456');
    });

    it('verifies code and shows backup codes', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        const mockBackupCodes = ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8'];

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ backupCodes: mockBackupCodes }),
            });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        // Go through setup
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '123456' } });
        });

        const verifyButton = screen.getByText('Verify & Enable');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/mfa/verify-setup',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ token: '123456' }),
                })
            );
        });

        await waitFor(() => {
            expect(screen.getByText('Two-Factor Authentication Enabled!')).toBeInTheDocument();
            expect(screen.getByText('Save your backup codes!')).toBeInTheDocument();
            
            // Check backup codes are displayed
            mockBackupCodes.forEach(code => {
                expect(screen.getByText(code)).toBeInTheDocument();
            });
        });
    });

    it('shows error when verification fails', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData,
            })
            .mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Invalid code' }),
            });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '123456' } });
        });

        const verifyButton = screen.getByText('Verify & Enable');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid code')).toBeInTheDocument();
        });
    });

    it('disables verify button when code is not 6 digits', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '12345' } });
        });

        const verifyButton = screen.getByText('Verify & Enable');
        expect(verifyButton).toBeDisabled();
    });

    it('allows going back from verify to scan step', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSetupData,
        });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const backButton = screen.getByText('Back');
            fireEvent.click(backButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Scan this QR code with your authenticator app')).toBeInTheDocument();
        });
    });

    it('copies backup codes to clipboard', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        const mockBackupCodes = ['CODE1', 'CODE2', 'CODE3', 'CODE4'];

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ backupCodes: mockBackupCodes }),
            });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        // Complete setup flow
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '123456' } });
        });

        const verifyButton = screen.getByText('Verify & Enable');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            const copyButton = screen.getByText('Copy all codes');
            fireEvent.click(copyButton);
        });

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockBackupCodes.join('\n'));
        });
    });

    it('calls onComplete when done button is clicked', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        const mockBackupCodes = ['CODE1', 'CODE2', 'CODE3', 'CODE4'];

        (global.fetch as any)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSetupData,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ backupCodes: mockBackupCodes }),
            });

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        // Complete setup flow
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        await waitFor(() => {
            const nextButton = screen.getByText("I've scanned the code");
            fireEvent.click(nextButton);
        });

        await waitFor(() => {
            const codeInput = screen.getByPlaceholderText('000000');
            fireEvent.change(codeInput, { target: { value: '123456' } });
        });

        const verifyButton = screen.getByText('Verify & Enable');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            const doneButton = screen.getByText("I've saved my backup codes");
            fireEvent.click(doneButton);
        });

        expect(mockOnComplete).toHaveBeenCalledTimes(1);
    });

    it('shows loading state during API calls', async () => {
        const mockSetupData = {
            qrCode: 'data:image/png;base64,test-qr-code',
            manualEntry: 'ABCD EFGH IJKL MNOP',
        };

        (global.fetch as any).mockImplementationOnce(() => 
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                json: async () => mockSetupData,
            }), 100))
        );

        render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
        
        const continueButton = screen.getByText('Continue');
        fireEvent.click(continueButton);

        // Should show loading spinner
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
        });
    });
});

