/**
 * @vitest-environment jsdom
 *
 * PublicFormView — post-submit redirect + minimal styling knobs.
 *
 * Covers:
 *  - successful submit + valid https redirectUrl → window.location.assign after ~1.5s
 *  - javascript: redirectUrl is rejected (assign never called, stays on success screen)
 *  - accentColor: valid #rrggbb hex applied as inline backgroundColor on submit button
 *  - accentColor: invalid value falls back to the existing bg-blue-600 class
 *  - styling.logoUrl: renders an <img> when a valid http(s) URL is provided
 *
 * Uses vi.useFakeTimers() + vi.advanceTimersByTimeAsync() — no real waits.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PublicFormView from '../PublicFormView';

vi.mock('@/services/api/tablePlatform.api', () => ({
  getPublicForm: vi.fn(),
  submitPublicForm: vi.fn(),
}));

import * as tablePlatformApi from '@/services/api/tablePlatform.api';

const baseFields = [{ id: 'f1', name: 'Name', field_type: 'singleLineText', options: {} }];

function makeForm(config: Record<string, unknown>) {
  return {
    id: 'form-1',
    name: 'Test Form',
    description: null,
    slug: 'test-form',
    config,
    fields: baseFields,
  };
}

describe('PublicFormView — redirect + styling', () => {
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    assignSpy = vi.fn();
    // jsdom's window.location.assign isn't implemented; stub it directly.
    vi.stubGlobal('location', { ...window.location, assign: assignSpy });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('redirects to a valid https redirectUrl ~1.5s after successful submit', async () => {
    const form = makeForm({ fields: [{ fieldId: 'f1' }], redirectUrl: 'https://example.com/thanks' });
    (tablePlatformApi.getPublicForm as any).mockResolvedValue(form);
    (tablePlatformApi.submitPublicForm as any).mockResolvedValue({ ok: true });

    render(<PublicFormView slug="test-form" />);

    await vi.waitFor(() => expect(screen.getByText('Test Form')).toBeInTheDocument());

    const submitButton = screen.getByRole('button', { name: /submit/i });
    submitButton.closest('form')!.requestSubmit();

    await vi.waitFor(() =>
      expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    );

    expect(assignSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1600);

    expect(assignSpy).toHaveBeenCalledWith('https://example.com/thanks');
  });

  it('ignores an unsafe javascript: redirectUrl (assign never called)', async () => {
    const form = makeForm({
      fields: [{ fieldId: 'f1' }],
      redirectUrl: 'javascript:alert(1)',
    });
    (tablePlatformApi.getPublicForm as any).mockResolvedValue(form);
    (tablePlatformApi.submitPublicForm as any).mockResolvedValue({ ok: true });

    render(<PublicFormView slug="test-form" />);

    await vi.waitFor(() => expect(screen.getByText('Test Form')).toBeInTheDocument());

    const submitButton = screen.getByRole('button', { name: /submit/i });
    submitButton.closest('form')!.requestSubmit();

    await vi.waitFor(() =>
      expect(screen.getByText(/thank you for your submission/i)).toBeInTheDocument()
    );

    await vi.advanceTimersByTimeAsync(5000);

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('applies a valid accentColor as inline backgroundColor on the submit button', async () => {
    const form = makeForm({
      fields: [{ fieldId: 'f1' }],
      styling: { accentColor: '#123abc' },
    });
    (tablePlatformApi.getPublicForm as any).mockResolvedValue(form);

    render(<PublicFormView slug="test-form" />);

    await vi.waitFor(() => expect(screen.getByText('Test Form')).toBeInTheDocument());

    const submitButton = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement;
    expect(submitButton.style.backgroundColor).toBe('rgb(18, 58, 188)');
    expect(submitButton.className).not.toContain('bg-blue-600');
  });

  it('falls back to the default class when accentColor is invalid', async () => {
    const form = makeForm({
      fields: [{ fieldId: 'f1' }],
      styling: { accentColor: 'not-a-color' },
    });
    (tablePlatformApi.getPublicForm as any).mockResolvedValue(form);

    render(<PublicFormView slug="test-form" />);

    await vi.waitFor(() => expect(screen.getByText('Test Form')).toBeInTheDocument());

    const submitButton = screen.getByRole('button', { name: /submit/i }) as HTMLButtonElement;
    expect(submitButton.style.backgroundColor).toBe('');
    expect(submitButton.className).toContain('bg-blue-600');
  });

  it('renders the logo when a valid http(s) logoUrl is provided', async () => {
    const form = makeForm({
      fields: [{ fieldId: 'f1' }],
      styling: { logoUrl: 'https://example.com/logo.png' },
    });
    (tablePlatformApi.getPublicForm as any).mockResolvedValue(form);

    const { container } = render(<PublicFormView slug="test-form" />);

    await vi.waitFor(() => expect(screen.getByText('Test Form')).toBeInTheDocument());

    // alt="" is decorative (logo has no accessible name), so query by tag.
    const logo = container.querySelector('img') as HTMLImageElement | null;
    expect(logo).not.toBeNull();
    expect(logo!.src).toBe('https://example.com/logo.png');
  });
});
