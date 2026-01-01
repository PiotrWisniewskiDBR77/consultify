/**
 * MFAChallenge Component Tests
 * 
 * Tests for the Multi-Factor Authentication challenge component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock i18next

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

import MFAChallenge from '../../../components/auth/MFAChallenge';

describe('MFAChallenge', () => {
    const mockOnVerify = vi.fn();
    const mockOnCancel = vi.fn();
    const user = userEvent.setup();

    beforeEach(() => {
        vi.clearAllMocks();
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const renderComponent = (props = {}) => {
        return render(
            <MFAChallenge
                onVerify={mockOnVerify}
                onCancel={mockOnCancel}
                {...props}
            />
        );
    };

    describe('TOTP Mode', () => {
        it('renders TOTP input fields by default', () => {
            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            expect(inputs.length).toBe(6);
        });

        it('allows entering 6-digit code', async () => {
            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            inputs.forEach((input, i) => {
                expect(input).toHaveValue(String(i + 1));
            });
        });

        it('only accepts numeric input', async () => {
            renderComponent();

            const firstInput = screen.getAllByRole('textbox')[0];
            await user.type(firstInput, 'abc123');

            expect(firstInput).toHaveValue('1');
        });

        it('auto-focuses next input when digit entered', async () => {
            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            await user.type(inputs[0], '1');

            await waitFor(() => {
                expect(document.activeElement).toBe(inputs[1]);
            });
        });

        it('handles backspace to go to previous input', async () => {
            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            await user.type(inputs[0], '1');
            await user.type(inputs[1], '2');
            await user.keyboard('{Backspace}');

            await waitFor(() => {
                expect(document.activeElement).toBe(inputs[0]);
            });
        });

        it('handles paste of 6-digit code', async () => {
            renderComponent();

            const firstInput = screen.getAllByRole('textbox')[0];
            await user.click(firstInput);
            
            // Simulate paste
            fireEvent.paste(firstInput, {
                clipboardData: {
                    getData: () => '123456'
                }
            });

            await waitFor(() => {
                const inputs = screen.getAllByRole('textbox');
                expect(inputs[0]).toHaveValue('1');
                expect(inputs[5]).toHaveValue('6');
            });
        });

        it('verifies code successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    '/api/mfa/challenge',
                    expect.objectContaining({
                        method: 'POST',
                        headers: expect.objectContaining({
                            'Authorization': 'Bearer mock-token'
                        })
                    })
                );
            });

            await waitFor(() => {
                expect(mockOnVerify).toHaveBeenCalledWith(true);
            });
        });

        it('shows error for invalid code', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Invalid code' })
            });

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], '0');
            }

            await waitFor(() => {
                expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
            });

            expect(mockOnVerify).not.toHaveBeenCalled();
        });

        it('shows error for incomplete code', async () => {
            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            await user.type(inputs[0], '1');
            
            // Try to verify with incomplete code
            const verifyButton = screen.getByText(/verify|submit/i);
            if (verifyButton) {
                await user.click(verifyButton);
            }

            await waitFor(() => {
                expect(screen.getByText(/6-digit code/i)).toBeInTheDocument();
            });
        });
    });

    describe('Backup Code Mode', () => {
        it('switches to backup code mode', async () => {
            renderComponent();

            const switchButton = screen.getByText(/backup code|use backup/i);
            await user.click(switchButton);

            expect(screen.getByPlaceholderText(/backup code/i)).toBeInTheDocument();
        });

        it('verifies backup code successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            renderComponent();

            const switchButton = screen.getByText(/backup code|use backup/i);
            await user.click(switchButton);

            const backupInput = screen.getByPlaceholderText(/backup code/i);
            await user.type(backupInput, 'BACKUP-CODE-1234');

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalled();
            });

            await waitFor(() => {
                expect(mockOnVerify).toHaveBeenCalledWith(true);
            });
        });

        it('shows error for invalid backup code', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Invalid backup code' })
            });

            renderComponent();

            const switchButton = screen.getByText(/backup code|use backup/i);
            await user.click(switchButton);

            const backupInput = screen.getByPlaceholderText(/backup code/i);
            await user.type(backupInput, 'INVALID-CODE');

            await waitFor(() => {
                expect(screen.getByText(/invalid backup code/i)).toBeInTheDocument();
            });
        });
    });

    describe('Trust Device Option', () => {
        it('shows trust device checkbox when enabled', () => {
            renderComponent({ trustDeviceOption: true });

            expect(screen.getByLabelText(/trust this device/i)).toBeInTheDocument();
        });

        it('hides trust device checkbox when disabled', () => {
            renderComponent({ trustDeviceOption: false });

            expect(screen.queryByLabelText(/trust this device/i)).not.toBeInTheDocument();
        });

        it('sends trust device flag when checked', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true })
            });

            renderComponent({ trustDeviceOption: true });

            const checkbox = screen.getByLabelText(/trust this device/i);
            await user.click(checkbox);

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledWith(
                    expect.any(String),
                    expect.objectContaining({
                        body: expect.stringContaining('trustDevice')
                    })
                );
            });
        });
    });

    describe('Cancel Functionality', () => {
        it('calls onCancel when cancel button clicked', async () => {
            renderComponent();

            const cancelButton = screen.getByText(/cancel/i);
            await user.click(cancelButton);

            expect(mockOnCancel).toHaveBeenCalledTimes(1);
        });

        it('does not call onCancel when not provided', () => {
            renderComponent({ onCancel: undefined });

            expect(screen.queryByText(/cancel/i)).not.toBeInTheDocument();
        });
    });

    describe('Loading States', () => {
        it('shows loading during verification', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            await waitFor(() => {
                expect(document.querySelector('.animate-spin')).toBeInTheDocument();
            });
        });

        it('disables inputs during loading', async () => {
            mockFetch.mockImplementation(() => new Promise(() => {}));

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            await user.type(inputs[0], '1');

            await waitFor(() => {
                inputs.forEach(input => {
                    expect(input).toBeDisabled();
                });
            });
        });
    });

    describe('Error Handling', () => {
        it('displays network errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            await waitFor(() => {
                expect(screen.getByText(/network error|failed/i)).toBeInTheDocument();
            });
        });

        it('clears error when new input entered', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                json: async () => ({ error: 'Invalid code' })
            });

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], '0');
            }

            await waitFor(() => {
                expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
            });

            await user.type(inputs[0], '1');

            await waitFor(() => {
                expect(screen.queryByText(/invalid code/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Remaining Codes Display', () => {
        it('displays remaining backup codes count', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({ 
                    success: true,
                    remainingCodes: 5
                })
            });

            renderComponent();

            const inputs = screen.getAllByRole('textbox');
            for (let i = 0; i < 6; i++) {
                await user.type(inputs[i], String(i + 1));
            }

            await waitFor(() => {
                expect(screen.getByText(/5.*remaining/i)).toBeInTheDocument();
            });
        });
    });
});
