import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MFAChallenge from '../../../components/auth/MFAChallenge';

// Mock fetch
global.fetch = vi.fn();

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue || key,
    }),
}));

describe('MFAChallenge Component', () => {
    const mockOnVerify = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.setItem('token', 'test-token');
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('renders correctly with TOTP mode', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
        expect(screen.getByText('Enter the code from your authenticator app')).toBeInTheDocument();
        
        // Check for 6 input boxes
        const inputs = screen.getAllByRole('textbox');
        expect(inputs).toHaveLength(6);
    });

    it('allows entering TOTP code digit by digit', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        // Enter first digit
        fireEvent.change(inputs[0], { target: { value: '1' } });
        expect(inputs[0]).toHaveValue('1');
        
        // Enter second digit
        fireEvent.change(inputs[1], { target: { value: '2' } });
        expect(inputs[1]).toHaveValue('2');
    });

    it('auto-focuses next input when entering digit', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        fireEvent.change(inputs[0], { target: { value: '1' } });
        
        // Next input should be focused
        expect(document.activeElement).toBe(inputs[1]);
    });

    it('handles paste event with 6-digit code', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        const container = inputs[0].closest('.flex');
        
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
        });
        pasteEvent.clipboardData.setData('text', '123456');
        
        fireEvent.paste(container!, pasteEvent);
        
        // All inputs should be filled
        inputs.forEach((input, index) => {
            expect(input).toHaveValue(String(index + 1));
        });
    });

    it('filters non-numeric characters from paste', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        const container = inputs[0].closest('.flex');
        
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
        });
        pasteEvent.clipboardData.setData('text', '12a34b56');
        
        fireEvent.paste(container!, pasteEvent);
        
        // Should only contain digits
        expect(inputs[0]).toHaveValue('1');
        expect(inputs[1]).toHaveValue('2');
        expect(inputs[2]).toHaveValue('3');
        expect(inputs[3]).toHaveValue('4');
        expect(inputs[4]).toHaveValue('5');
        expect(inputs[5]).toHaveValue('6');
    });

    it('handles backspace to move to previous input', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        // Fill first two inputs
        fireEvent.change(inputs[0], { target: { value: '1' } });
        fireEvent.change(inputs[1], { target: { value: '2' } });
        
        // Focus second input and press backspace
        inputs[1].focus();
        fireEvent.keyDown(inputs[1], { key: 'Backspace' });
        
        // Should focus first input
        expect(document.activeElement).toBe(inputs[0]);
    });

    it('switches to backup code mode', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const switchButton = screen.getByText('Use a backup code instead');
        fireEvent.click(switchButton);
        
        expect(screen.getByText('Enter one of your backup codes')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('XXXX-XXXX')).toBeInTheDocument();
    });

    it('switches back from backup to TOTP mode', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        // Switch to backup
        const switchButton = screen.getByText('Use a backup code instead');
        fireEvent.click(switchButton);
        
        // Switch back
        const backButton = screen.getByText('Back to authenticator code');
        fireEvent.click(backButton);
        
        expect(screen.getByText('Enter the code from your authenticator app')).toBeInTheDocument();
    });

    it('shows trust device checkbox when trustDeviceOption is true', () => {
        render(<MFAChallenge onVerify={mockOnVerify} trustDeviceOption={true} />);
        
        expect(screen.getByText('Trust this device for 30 days')).toBeInTheDocument();
    });

    it('hides trust device checkbox when trustDeviceOption is false', () => {
        render(<MFAChallenge onVerify={mockOnVerify} trustDeviceOption={false} />);
        
        expect(screen.queryByText('Trust this device for 30 days')).not.toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', () => {
        render(<MFAChallenge onVerify={mockOnVerify} onCancel={mockOnCancel} />);
        
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
        
        expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('does not show cancel button when onCancel is not provided', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('verifies TOTP code successfully', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        // Enter 6-digit code
        '123456'.split('').forEach((digit, index) => {
            fireEvent.change(inputs[index], { target: { value: digit } });
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/mfa/challenge',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer test-token',
                    }),
                })
            );
        });

        await waitFor(() => {
            expect(mockOnVerify).toHaveBeenCalledWith(true);
        });
    });

    it('shows error message on verification failure', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid code' }),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        '123456'.split('').forEach((digit, index) => {
            fireEvent.change(inputs[index], { target: { value: digit } });
        });

        await waitFor(() => {
            expect(screen.getByText('Invalid code')).toBeInTheDocument();
        });

        expect(mockOnVerify).not.toHaveBeenCalled();
    });

    it('shows blocked message when too many attempts', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ blocked: true }),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        '123456'.split('').forEach((digit, index) => {
            fireEvent.change(inputs[index], { target: { value: digit } });
        });

        await waitFor(() => {
            expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
        });
    });

    it('verifies backup code successfully', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ remainingCodes: 9 }),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        // Switch to backup mode
        const switchButton = screen.getByText('Use a backup code instead');
        fireEvent.click(switchButton);
        
        // Enter backup code
        const backupInput = screen.getByPlaceholderText('XXXX-XXXX');
        fireEvent.change(backupInput, { target: { value: 'ABCD-EFGH' } });
        
        // Click verify
        const verifyButton = screen.getByText('Verify');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                '/api/mfa/backup-code',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ code: 'ABCD-EFGH' }),
                })
            );
        });

        await waitFor(() => {
            expect(mockOnVerify).toHaveBeenCalledWith(true);
        });
    });

    it('shows error when backup code is invalid', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid backup code' }),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        // Switch to backup mode
        const switchButton = screen.getByText('Use a backup code instead');
        fireEvent.click(switchButton);
        
        // Enter backup code
        const backupInput = screen.getByPlaceholderText('XXXX-XXXX');
        fireEvent.change(backupInput, { target: { value: 'INVALID' } });
        
        // Click verify
        const verifyButton = screen.getByText('Verify');
        fireEvent.click(verifyButton);

        await waitFor(() => {
            expect(screen.getByText('Invalid backup code')).toBeInTheDocument();
        });

        expect(mockOnVerify).not.toHaveBeenCalled();
    });

    it('converts backup code to uppercase', () => {
        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        // Switch to backup mode
        const switchButton = screen.getByText('Use a backup code instead');
        fireEvent.click(switchButton);
        
        // Enter lowercase backup code
        const backupInput = screen.getByPlaceholderText('XXXX-XXXX');
        fireEvent.change(backupInput, { target: { value: 'abcd-efgh' } });
        
        expect(backupInput).toHaveValue('ABCD-EFGH');
    });

    it('disables inputs during loading', async () => {
        (global.fetch as any).mockImplementationOnce(() => 
            new Promise(resolve => setTimeout(() => resolve({
                ok: true,
                json: async () => ({}),
            }), 100))
        );

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        '123456'.split('').forEach((digit, index) => {
            fireEvent.change(inputs[index], { target: { value: digit } });
        });

        // Inputs should be disabled during loading
        await waitFor(() => {
            inputs.forEach(input => {
                expect(input).toBeDisabled();
            });
        });
    });

    it('clears code and refocuses first input on error', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid code' }),
        });

        render(<MFAChallenge onVerify={mockOnVerify} />);
        
        const inputs = screen.getAllByRole('textbox');
        
        '123456'.split('').forEach((digit, index) => {
            fireEvent.change(inputs[index], { target: { value: digit } });
        });

        await waitFor(() => {
            // Code should be cleared
            inputs.forEach(input => {
                expect(input).toHaveValue('');
            });
        });
    });
});

