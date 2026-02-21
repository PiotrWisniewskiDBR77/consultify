/**
 * MFAChallenge Component Tests
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MFAChallenge from '../../../src/components/auth/MFAChallenge';

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

describe('MFAChallenge Component', () => {
  const mockOnVerify = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('Initial Render', () => {
    it('should render the MFA challenge modal', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);

      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    it('should display TOTP input by default', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);

      expect(screen.getByText(/Enter the code from your authenticator app/i)).toBeInTheDocument();
    });

    it('should render 6 input boxes for TOTP code', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      expect(inputs).toHaveLength(6);
    });

    it('should show trust device option when enabled', () => {
      render(<MFAChallenge onVerify={mockOnVerify} trustDeviceOption={true} />);

      expect(screen.getByText(/Trust this device for 30 days/i)).toBeInTheDocument();
    });

    it('should hide trust device option when disabled', () => {
      render(<MFAChallenge onVerify={mockOnVerify} trustDeviceOption={false} />);

      expect(screen.queryByText(/Trust this device for 30 days/i)).not.toBeInTheDocument();
    });

    it('should show backup code option', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);

      expect(screen.getByText(/Use a backup code instead/i)).toBeInTheDocument();
    });
  });

  describe('TOTP Input', () => {
    it('should allow entering digits in input boxes', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], '1');

      expect(inputs[0]).toHaveValue('1');
    });

    it('should only accept numeric input', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'a');

      expect(inputs[0]).toHaveValue('');
    });

    it('should auto-focus next input after entering digit', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], '1');

      expect(document.activeElement).toBe(inputs[1]);
    });

    it('focuses previous input on Backspace when current is empty', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);
      const inputs = screen.getAllByRole('textbox');

      inputs[1].focus();
      fireEvent.keyDown(inputs[1], { key: 'Backspace' });

      expect(document.activeElement).toBe(inputs[0]);
    });

    it('on paste focuses next input after pasted digits', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);
      const inputs = screen.getAllByRole('textbox');

      const container = inputs[0].parentElement!;
      fireEvent.paste(container, {
        clipboardData: { getData: () => '123' },
        preventDefault: () => {},
      });

      // focusIndex = Math.min(3, 5) => 3 (next slot after 3 digits)
      expect(document.activeElement).toBe(inputs[3]);
    });
  });

  describe('Mode Switching', () => {
    it('should switch to backup code mode when link is clicked', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const backupLink = screen.getByText(/Use a backup code instead/i);
      await user.click(backupLink);

      expect(screen.getByText(/Enter one of your backup codes/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('XXXX-XXXX')).toBeInTheDocument();
    });

    it('should switch back to TOTP mode from backup', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      // Switch to backup
      await user.click(screen.getByText(/Use a backup code instead/i));

      // Switch back
      await user.click(screen.getByText(/Back to authenticator code/i));

      expect(screen.getByText(/Enter the code from your authenticator app/i)).toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should show cancel button when onCancel is provided', () => {
      render(<MFAChallenge onVerify={mockOnVerify} onCancel={mockOnCancel} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not show cancel button when onCancel is not provided', () => {
      render(<MFAChallenge onVerify={mockOnVerify} />);

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} onCancel={mockOnCancel} />);

      await user.click(screen.getByText('Cancel'));

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('TOTP Verification', () => {
    it('should call API when 6 digits are entered', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/mfa/challenge', expect.any(Object));
      });
    });

    it('should call onVerify on successful verification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(mockOnVerify).toHaveBeenCalledWith(true);
      });
    });

    it('should show error message on failed verification', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid code' }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByText('Invalid code')).toBeInTheDocument();
      });
    });

    it('falls back to default failed message when API returns no error payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByText('Verification failed')).toBeInTheDocument();
      });
      // The inputs may re-mount after state resets; re-query for stable refs.
      const inputsAfter = screen.getAllByRole('textbox');
      inputsAfter.forEach((i) => expect(i).toHaveValue(''));
    });

    it('shows blocked message when API responds blocked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ blocked: true }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByText('Too many attempts. Please try again later.')).toBeInTheDocument();
      });
    });

    it('shows error when TOTP verification throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByText('Network down')).toBeInTheDocument();
      });
    });

    it('falls back to default error message when rejection has no message', async () => {
      mockFetch.mockRejectedValueOnce({});

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(screen.getByText('An error occurred')).toBeInTheDocument();
      });
    });
  });

  describe('Backup Code Verification', () => {
    it('should verify backup code when button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, remainingCodes: 9 }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      // Switch to backup mode
      await user.click(screen.getByText(/Use a backup code instead/i));

      // Enter backup code
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');

      // Click verify
      await user.click(screen.getByText('Verify'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/mfa/backup-code', expect.any(Object));
      });
    });

    it('disables Verify button when backup code is empty', async () => {
      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      expect(screen.getByText('Verify')).toBeDisabled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('shows invalid backup code error when API rejects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid backup code' }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');
      await user.click(screen.getByText('Verify'));

      expect(await screen.findByText('Invalid backup code')).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('falls back to default invalid backup code message when API returns no error payload', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');
      await user.click(screen.getByText('Verify'));

      expect(await screen.findByText('Invalid backup code')).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('shows blocked message and clears backup code when API responds blocked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ blocked: true }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');
      await user.click(screen.getByText('Verify'));

      expect(
        await screen.findByText('Too many attempts. Please try again later.')
      ).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('shows error when backup verification throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');
      await user.click(screen.getByText('Verify'));

      expect(await screen.findByText('Network down')).toBeInTheDocument();
    });

    it('falls back to default error message when backup rejection has no message', async () => {
      mockFetch.mockRejectedValueOnce({});

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} />);

      await user.click(screen.getByText(/Use a backup code instead/i));
      const input = screen.getByPlaceholderText('XXXX-XXXX');
      await user.type(input, 'ABCD-1234');
      await user.click(screen.getByText('Verify'));

      expect(await screen.findByText('An error occurred')).toBeInTheDocument();
    });
  });

  describe('Trust Device', () => {
    it('should include trustDevice in API request when checked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const user = userEvent.setup();
      render(<MFAChallenge onVerify={mockOnVerify} trustDeviceOption={true} />);

      // Check trust device
      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      // Enter code
      const inputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(inputs[i], String(i + 1));
      }

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/mfa/challenge',
          expect.objectContaining({
            body: expect.stringContaining('"trustDevice":true'),
          })
        );
      });
    });
  });
});
