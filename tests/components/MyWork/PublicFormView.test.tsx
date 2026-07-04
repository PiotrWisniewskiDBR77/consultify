/**
 * PublicFormView tests — Task 1: Redirect, Task 2: Styling
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PublicFormView from '@/components/MyWork/table/PublicFormView';
import * as tablePlatformApi from '@/services/api/tablePlatform.api';

vi.mock('@/services/api/tablePlatform.api');

describe('PublicFormView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  describe('Task 1: Redirect after successful submit', () => {
    it('should redirect to valid http:// URL after 1.5s delay', async () => {
      const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});
      
      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name', required: true }],
          redirectUrl: 'https://example.com/success',
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      vi.mocked(tablePlatformApi.submitPublicForm).mockResolvedValue(true);

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      // Fill and submit
      const input = screen.getByDisplayValue('');
      await userEvent.type(input, 'John');
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      // Verify success message shown first
      await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());

      // window.location.assign should NOT be called yet
      expect(assignSpy).not.toHaveBeenCalled();

      // Advance timers by 1500ms
      vi.advanceTimersByTime(1500);

      // Now it should be called
      expect(assignSpy).toHaveBeenCalledWith('https://example.com/success');
      assignSpy.mockRestore();
    });

    it('should redirect to https:// URL', async () => {
      const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'email', label: 'Email', required: true }],
          redirectUrl: 'https://secure.example.com/done',
        },
        fields: [{ id: 'email', name: 'Email', field_type: 'email', options: {} }],
      });

      vi.mocked(tablePlatformApi.submitPublicForm).mockResolvedValue(true);

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Email')).toBeInTheDocument());

      const input = screen.getByDisplayValue('');
      await userEvent.type(input, 'test@example.com');
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());

      vi.advanceTimersByTime(1500);

      expect(assignSpy).toHaveBeenCalledWith('https://secure.example.com/done');
      assignSpy.mockRestore();
    });

    it('should IGNORE javascript: URLs for security', async () => {
      const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name', required: true }],
          redirectUrl: 'javascript:alert("xss")',
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      vi.mocked(tablePlatformApi.submitPublicForm).mockResolvedValue(true);

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      const input = screen.getByDisplayValue('');
      await userEvent.type(input, 'John');
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());

      vi.advanceTimersByTime(1500);

      // Should NOT call assign for javascript: URL
      expect(assignSpy).not.toHaveBeenCalled();
      assignSpy.mockRestore();
    });

    it('should IGNORE data: URLs', async () => {
      const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'test', label: 'Test', required: true }],
          redirectUrl: 'data:text/html,<script>alert("xss")</script>',
        },
        fields: [{ id: 'test', name: 'Test', field_type: 'singleLineText', options: {} }],
      });

      vi.mocked(tablePlatformApi.submitPublicForm).mockResolvedValue(true);

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());

      const input = screen.getByDisplayValue('');
      await userEvent.type(input, 'value');
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());

      vi.advanceTimersByTime(1500);

      // Should NOT call assign for data: URL
      expect(assignSpy).not.toHaveBeenCalled();
      assignSpy.mockRestore();
    });

    it('should NOT redirect if redirectUrl is missing', async () => {
      const assignSpy = vi.spyOn(window.location, 'assign').mockImplementation(() => {});

      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name', required: true }],
          // No redirectUrl
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      vi.mocked(tablePlatformApi.submitPublicForm).mockResolvedValue(true);

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      const input = screen.getByDisplayValue('');
      await userEvent.type(input, 'John');
      await userEvent.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(screen.getByText(/thank you/i)).toBeInTheDocument());

      vi.advanceTimersByTime(1500);

      expect(assignSpy).not.toHaveBeenCalled();
      assignSpy.mockRestore();
    });
  });

  describe('Task 2: Apply styling from config', () => {
    it('should apply accentColor to submit button', async () => {
      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name', required: true }],
          styling: { accentColor: '#ff0000' },
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      const style = window.getComputedStyle(submitBtn);
      
      // Button should have the accent color applied
      expect(submitBtn).toHaveStyle({ backgroundColor: '#ff0000' });
    });

    it('should apply logoUrl as image', async () => {
      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name' }],
          styling: { logoUrl: 'https://example.com/logo.png' },
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => {
        const logo = screen.getByAltText('Logo') as HTMLImageElement;
        expect(logo).toBeInTheDocument();
        expect(logo.src).toContain('logo.png');
      });
    });

    it('should NOT render logo if logoUrl is missing', async () => {
      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name' }],
          styling: {},
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      expect(screen.queryByAltText('Logo')).not.toBeInTheDocument();
    });

    it('should use default blue button color if accentColor not provided', async () => {
      vi.mocked(tablePlatformApi.getPublicForm).mockResolvedValue({
        id: 'form-1',
        name: 'Test Form',
        description: null,
        slug: 'test-form',
        config: {
          fields: [{ fieldId: 'name', label: 'Name' }],
          styling: {},
        },
        fields: [{ id: 'name', name: 'Name', field_type: 'singleLineText', options: {} }],
      });

      render(<PublicFormView slug="test-form" />);

      await waitFor(() => expect(screen.getByText('Name')).toBeInTheDocument());

      const submitBtn = screen.getByRole('button', { name: /submit/i });
      
      // Should have default blue color
      expect(submitBtn).toHaveStyle({ backgroundColor: '#2563eb' });
    });
  });
});
