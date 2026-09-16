import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddFilesMenu } from '../../../src/components/AIChat/AddFilesMenu';

const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: toastSuccess },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (_key: string, fallback?: string, vars?: Record<string, unknown>) => {
      if (!fallback) return _key;
      if (vars?.types) return fallback.replace('{{types}}', String(vars.types));
      return fallback;
    },
  }),
}));

describe('AddFilesMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    toastSuccess.mockReset();
  });

  it('opens attachment menu from plus trigger', () => {
    render(
      <AddFilesMenu
        onFileSelect={vi.fn()}
        onUrlAdd={vi.fn()}
        connectedProviders={[]}
        isCloudImplemented={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add files/i }));

    expect(screen.getByText(/upload file/i)).toBeInTheDocument();
    expect(screen.getByText(/add link/i)).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(<AddFilesMenu onFileSelect={vi.fn()} disabled />);

    const trigger = screen.getByRole('button', { name: /add files/i });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);

    expect(screen.queryByText(/upload file/i)).not.toBeInTheDocument();
  });

  it('does not announce or remember a file rejected by the composer', () => {
    const onFileSelect = vi.fn(() => []);
    render(<AddFilesMenu onFileSelect={onFileSelect} />);
    const image = new File(['png'], 'screen.png', { type: 'image/png' });

    fireEvent.change(screen.getByTestId('add-files-hidden-input'), {
      target: { files: [image] },
    });

    expect(onFileSelect).toHaveBeenCalledWith([image]);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem('consultify-recent-attachments')).toBeNull();
  });

  it('reattaches a recent item with a docId via onRecentSelect', () => {
    localStorage.setItem(
      'consultify-recent-attachments',
      JSON.stringify([{ name: 'brief.pdf', docId: 'doc-123', addedAt: Date.now() }])
    );
    const onRecentSelect = vi.fn();

    render(
      <AddFilesMenu
        onFileSelect={vi.fn()}
        onRecentSelect={onRecentSelect}
        connectedProviders={[]}
        isCloudImplemented={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add files/i }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /recent/i }));
    fireEvent.click(screen.getByRole('button', { name: /brief\.pdf/i }));

    // Real reattach hands the existing server docId back to the composer.
    expect(onRecentSelect).toHaveBeenCalledWith({ name: 'brief.pdf', docId: 'doc-123' });
  });

  it('prompts a fresh upload for legacy recent items without a docId', () => {
    localStorage.setItem(
      'consultify-recent-attachments',
      JSON.stringify([{ name: 'brief.pdf', addedAt: Date.now() }])
    );
    const onRecentSelect = vi.fn();

    render(
      <AddFilesMenu
        onFileSelect={vi.fn()}
        onRecentSelect={onRecentSelect}
        connectedProviders={[]}
        isCloudImplemented={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /add files/i }));
    fireEvent.mouseEnter(screen.getByRole('button', { name: /recent/i }));
    fireEvent.click(screen.getByRole('button', { name: /brief\.pdf/i }));

    // No docId => can't reattach without re-upload, so onRecentSelect is not called.
    expect(onRecentSelect).not.toHaveBeenCalled();
  });

  it('normalizes bare domains to https:// when adding URL', () => {
    const onUrlAdd = vi.fn();
    render(<AddFilesMenu onFileSelect={vi.fn()} onUrlAdd={onUrlAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /add files/i }));
    fireEvent.click(screen.getByText(/add link/i));

    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'example.com/docs' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(onUrlAdd).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('rejects non-http protocols in URL modal', () => {
    const onUrlAdd = vi.fn();
    render(<AddFilesMenu onFileSelect={vi.fn()} onUrlAdd={onUrlAdd} />);

    fireEvent.click(screen.getByRole('button', { name: /add files/i }));
    fireEvent.click(screen.getByText(/add link/i));

    fireEvent.change(screen.getByPlaceholderText('https://…'), {
      target: { value: 'javascript:alert(1)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(onUrlAdd).not.toHaveBeenCalled();
  });
});
