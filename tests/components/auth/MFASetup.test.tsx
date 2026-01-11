/**
 * MFASetup Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

// Mock clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
});

describe('MFASetup Component', () => {
  const mockOnComplete = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
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
      render(<MFASetup onComplete={mockOnComplete} onCancel={mockOnCancel} />);
      await user.click(screen.getByText('Continue'));
      await waitFor(() => screen.getByText(/Scan this QR code/i));
      return user;
    };

    it('should show copy button for manual entry', async () => {
      await setupToQRStep();

      expect(screen.getByTitle('Copy')).toBeInTheDocument();
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

    it('should have Back and Verify buttons', async () => {
      await setupToVerifyStep();

      expect(screen.getByText('Back')).toBeInTheDocument();
      expect(screen.getByText('Verify & Enable')).toBeInTheDocument();
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

    it('should call onComplete when Done is clicked', async () => {
      const user = await setupToBackupStep();

      await user.click(screen.getByText("I've saved my backup codes"));

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });
});
