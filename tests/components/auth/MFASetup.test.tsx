/**
 * MFASetup Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MFASetup from '../../../src/components/auth/MFASetup';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback || key,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'test-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock clipboard (Navigator.clipboard may be read-only in JSDOM)
Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('MFASetup Component', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();
  let writeTextSpy: any;

  const ensureClipboard = () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextSpy,
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Ensure clipboard is a spy in each test (JSDOM may provide a native implementation)
    writeTextSpy = vi.fn().mockResolvedValue(undefined);
    ensureClipboard();
  });

  describe('Initial Render (Intro Step)', () => {
    it('should render the MFA setup modal', () => {
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    it('should display intro text', () => {
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/adds an extra layer of security/i)).toBeInTheDocument();
    });

    it('should show setup steps', () => {
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText(/Download an authenticator app/i)).toBeInTheDocument();
      expect(screen.getByText(/Scan the QR code/i)).toBeInTheDocument();
      expect(screen.getByText(/Enter the code from your app/i)).toBeInTheDocument();
    });

    it('should show Continue and Cancel buttons', () => {
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      expect(screen.getByText('Continue')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should call onCancel when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Setup Initialization', () => {
    it('should call API when Continue is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: 'JBSWY3DPEHPK3PXP',
          }),
      });

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/mfa/setup', expect.any(Object));
      });
    });

    it('should show QR code step after successful init', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: 'JBSWY3DPEHPK3PXP',
          }),
      });

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument();
      });
    });

    it('should display manual entry code', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: 'JBSWY3DPEHPK3PXP',
          }),
      });

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
      });
    });

    it('should show error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Setup failed' }),
      });

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Setup failed')).toBeInTheDocument();
      });
    });

    it('uses default init error message when fetch rejects without message', async () => {
      mockFetch.mockRejectedValueOnce({});

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Failed to initialize MFA setup')).toBeInTheDocument();
      });
    });
  });

  describe('QR Code Step', () => {
    const setupToQRStep = async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: 'JBSWY3DPEHPK3PXP',
          }),
      });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      return user;
    };

    it('should show copy button for manual entry', async () => {
      await setupToQRStep();

      expect(screen.getByTitle('Copy')).toBeInTheDocument();
    });

    it('copies manual entry secret to clipboard', async () => {
      await setupToQRStep();

      const copyButton = screen.getByTitle('Copy');
      vi.useFakeTimers();
      try {
        fireEvent.click(copyButton);
        expect(writeTextSpy).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
        await waitFor(() => {
          expect(copyButton.querySelector('svg')?.getAttribute('class') || '').toContain(
            'text-c-success'
          );
        });

        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();

        await waitFor(() => {
          expect(copyButton.querySelector('svg')?.getAttribute('class') || '').not.toContain(
            'text-c-success'
          );
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not copy secret when manualEntry is empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: '',
          }),
      });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));

      await user.click(screen.getByTitle('Copy'));
      expect(writeTextSpy).not.toHaveBeenCalled();
    });

    it('should navigate to verify step when clicking "I\'ve scanned the code"', async () => {
      const user = await setupToQRStep();

      await user.click(screen.getByText("I've scanned the code"));

      await waitFor(() => {
        expect(screen.getByText(/Enter the 6-digit code/i)).toBeInTheDocument();
      });
    });
  });

  describe('Verification Step', () => {
    const setupToVerifyStep = async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            qrCode: 'data:image/png;base64,abc123',
            manualEntry: 'JBSWY3DPEHPK3PXP',
          }),
      });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      await user.click(screen.getByText("I've scanned the code"));
      await waitFor(() => screen.getByText(/Enter the 6-digit code/i));
      return user;
    };

    it('should have verification code input', async () => {
      await setupToVerifyStep();

      expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
    });

    it('keeps "Verify & Enable" disabled until 6 digits are entered', async () => {
      const user = await setupToVerifyStep();
      const input = screen.getByPlaceholderText('000000');
      const verify = screen.getByRole('button', { name: 'Verify & Enable' });

      expect(verify).toBeDisabled();
      await user.type(input, '12345');
      expect(verify).toBeDisabled();

      await user.type(input, '6');
      expect(verify).not.toBeDisabled();
    });

    it('sanitizes verification code input to digits only (max 6)', async () => {
      const user = await setupToVerifyStep();
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;

      await user.type(input, '12ab34-56-78');
      expect(input.value).toBe('123456');
    });

    it('should have Back and Verify buttons', async () => {
      await setupToVerifyStep();

      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Verify & Enable')).toBeInTheDocument();
    });

    it('navigates back to scan step when Back is clicked', async () => {
      const user = await setupToVerifyStep();

      await user.click(screen.getByText('Back'));

      await waitFor(() => {
        expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument();
      });
    });

    it('should verify code and show backup codes on success', async () => {
      // Setup mock for verify API - setupToVerifyStep already has init mock
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              qrCode: 'data:image/png;base64,abc123',
              manualEntry: 'JBSWY3DPEHPK3PXP',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              backupCodes: ['AAAA-1111', 'BBBB-2222', 'CCCC-3333'],
            }),
        });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      await user.click(screen.getByText("I've scanned the code"));
      await waitFor(() => screen.getByText(/Enter the 6-digit code/i));

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '123456');
      await user.click(screen.getByText('Verify & Enable'));

      await waitFor(() => {
        expect(screen.getByText('Two-Factor Authentication Enabled!')).toBeInTheDocument();
      });
    });

    it('sanitizes verification code input to digits only (max 6)', async () => {
      const user = await setupToVerifyStep();
      const input = screen.getByPlaceholderText('000000') as HTMLInputElement;

      await user.type(input, '12ab34-56-78');
      expect(input.value).toBe('123456');
    });

    it('shows default error message when verification fails without message', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              qrCode: 'data:image/png;base64,abc123',
              manualEntry: 'JBSWY3DPEHPK3PXP',
            }),
        })
        .mockRejectedValueOnce({});

      const user = userEvent.setup();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      await user.click(screen.getByText("I've scanned the code"));
      await waitFor(() => screen.getByText(/Enter the 6-digit code/i));

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByText('Verify & Enable'));

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
      });
    });

    it('shows API error message when verification response is not ok', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              qrCode: 'data:image/png;base64,abc123',
              manualEntry: 'JBSWY3DPEHPK3PXP',
            }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid code' }),
        });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      await user.click(screen.getByText("I've scanned the code"));
      await waitFor(() => screen.getByText(/Enter the 6-digit code/i));

      await user.type(screen.getByPlaceholderText('000000'), '123456');
      await user.click(screen.getByText('Verify & Enable'));

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });
  });

  describe('Backup Codes Step', () => {
    const setupToBackupStep = async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              qrCode: 'data:image/png;base64,abc123',
              manualEntry: 'JBSWY3DPEHPK3PXP',
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              backupCodes: ['AAAA-1111', 'BBBB-2222', 'CCCC-3333'],
            }),
        });

      const user = userEvent.setup();
      ensureClipboard();
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      await user.click(screen.getByText("I've scanned the code"));
      await waitFor(() => screen.getByText(/Enter the 6-digit code/i));

      const input = screen.getByPlaceholderText('000000');
      await user.type(input, '123456');
      await user.click(screen.getByText('Verify & Enable'));

      await waitFor(() => screen.getByText('Two-Factor Authentication Enabled!'));
      return user;
    };

    it('should display backup codes', async () => {
      await setupToBackupStep();

      expect(screen.getByText('AAAA-1111')).toBeInTheDocument();
      expect(screen.getByText('BBBB-2222')).toBeInTheDocument();
    });

    it('should show warning about saving codes', async () => {
      await setupToBackupStep();

      expect(screen.getByText('Save your backup codes!')).toBeInTheDocument();
    });

    it('should have Copy all codes button', async () => {
      await setupToBackupStep();

      expect(screen.getByText('Copy all codes')).toBeInTheDocument();
    });

    it('copies all backup codes to clipboard', async () => {
      await setupToBackupStep();

      const copyAll = screen.getByText('Copy all codes');
      vi.useFakeTimers();
      try {
        fireEvent.click(copyAll);
        expect(writeTextSpy).toHaveBeenCalledWith(
          ['AAAA-1111', 'BBBB-2222', 'CCCC-3333'].join('\n')
        );
        expect(screen.getByText('Copied!')).toBeInTheDocument();

        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();

        await waitFor(() => {
          expect(screen.getByText('Copy all codes')).toBeInTheDocument();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should call onComplete when Done is clicked', async () => {
      const user = await setupToBackupStep();

      await user.click(screen.getByText("I've saved my backup codes"));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });
});
