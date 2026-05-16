/**
 * @vitest-environment jsdom
 *
 * Component tests for AddSourceDialog (Block B / EPIC-T8).
 *
 * Coverage:
 *   * `open=false` renders nothing.
 *   * Submitting with default values builds the documented payload.
 *   * Confidence contribution out of [0, 1] is rejected before submit.
 *   * URI > 2048 chars is rejected before submit.
 *   * `onSubmit` rejection surfaces an error and keeps the dialog open.
 *   * Successful submit closes the dialog.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import { AddSourceDialog } from '../AddSourceDialog';

describe('AddSourceDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AddSourceDialog open={false} onClose={vi.fn()} onSubmit={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits with the documented payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<AddSourceDialog open onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-uri'), {
      target: { value: 'https://example.com/data.csv' },
    });
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-contribution'), {
      target: { value: '0.6' },
    });
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-note'), {
      target: { value: 'CSV import from finance team' },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit).toHaveBeenCalledWith({
      source_type: 'manual',
      source_uri: 'https://example.com/data.csv',
      confidence_contribution: 0.6,
      source_metadata: { note: 'CSV import from finance team' },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('rejects out-of-range confidence contribution', async () => {
    const onSubmit = vi.fn();
    render(<AddSourceDialog open onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-contribution'), {
      target: { value: '1.5' },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      /0 and 1/i
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects URI > 2048 chars', async () => {
    const onSubmit = vi.fn();
    render(<AddSourceDialog open onClose={vi.fn()} onSubmit={onSubmit} />);
    const longUri = 'https://example.com/' + 'x'.repeat(2050);
    fireEvent.change(screen.getByTestId('provenance-add-source-dialog-uri'), {
      target: { value: longUri },
    });
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      /2048/
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('surfaces onSubmit rejection without closing the dialog', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network down'));
    const onClose = vi.fn();
    render(<AddSourceDialog open onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.submit(
      screen.getByTestId('provenance-add-source-dialog-submit').closest('form') as HTMLFormElement
    );
    expect(await screen.findByTestId('provenance-add-source-dialog-error')).toHaveTextContent(
      'Network down'
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
