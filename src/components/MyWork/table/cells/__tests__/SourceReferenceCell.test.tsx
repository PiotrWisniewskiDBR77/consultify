/**
 * @vitest-environment jsdom
 *
 * Component tests for SourceReferenceCell (Block A · EPIC-T7 · Sprint A-S5).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SourceReferenceCell } from '../SourceReferenceCell';

const VALID_UUID = '01234567-89ab-4cde-9012-3456789abcde';

describe('SourceReferenceCell', () => {
  it('renders "No source" when value is null', () => {
    render(<SourceReferenceCell value={null} fieldOptions={{ allow_external: false }} />);
    expect(screen.getByTestId('source-ref-empty')).toHaveTextContent(/No source/i);
  });

  it('renders an internal "Source" button for a UUID string value', () => {
    render(<SourceReferenceCell value={VALID_UUID} fieldOptions={{ allow_external: false }} />);
    const btn = screen.getByTestId('source-ref-internal');
    expect(btn).toHaveAttribute('data-source-id', VALID_UUID);
  });

  it('renders an internal "Source" button for `{source_id}` object shape', () => {
    render(
      <SourceReferenceCell
        value={{ source_id: VALID_UUID }}
        fieldOptions={{ allow_external: false }}
      />
    );
    const btn = screen.getByTestId('source-ref-internal');
    expect(btn).toHaveAttribute('data-source-id', VALID_UUID);
  });

  it('calls onOpenSource with the source UUID when the chip is clicked', () => {
    const onOpenSource = vi.fn();
    render(
      <SourceReferenceCell
        value={VALID_UUID}
        fieldOptions={{ allow_external: false }}
        onOpenSource={onOpenSource}
      />
    );
    fireEvent.click(screen.getByTestId('source-ref-internal'));
    expect(onOpenSource).toHaveBeenCalledWith(VALID_UUID);
  });

  it('renders an external link with hostname when allow_external = true', () => {
    render(
      <SourceReferenceCell
        value="https://example.com/path/file"
        fieldOptions={{ allow_external: true }}
      />
    );
    const link = screen.getByTestId('source-ref-external');
    expect(link).toHaveAttribute('href', 'https://example.com/path/file');
    expect(link.textContent).toContain('example.com');
  });

  it('renders external link from `{external_url}` object shape', () => {
    render(
      <SourceReferenceCell
        value={{ external_url: 'https://example.com/x' }}
        fieldOptions={{ allow_external: true }}
      />
    );
    expect(screen.getByTestId('source-ref-external')).toHaveAttribute(
      'href',
      'https://example.com/x'
    );
  });

  it('blocks external URL string when allow_external = false', () => {
    render(
      <SourceReferenceCell value="https://example.com" fieldOptions={{ allow_external: false }} />
    );
    expect(screen.getByTestId('source-ref-blocked')).toHaveTextContent(/Blocked/i);
  });

  it('blocks `{external_url}` object when allow_external = false', () => {
    render(
      <SourceReferenceCell
        value={{ external_url: 'https://example.com' }}
        fieldOptions={{ allow_external: false }}
      />
    );
    expect(screen.getByTestId('source-ref-blocked')).toBeInTheDocument();
  });

  it('marks unrecognised value shapes as invalid', () => {
    render(<SourceReferenceCell value={42 as unknown} fieldOptions={{ allow_external: true }} />);
    expect(screen.getByTestId('source-ref-invalid')).toBeInTheDocument();
  });

  it('marks empty `{}` object as invalid', () => {
    render(<SourceReferenceCell value={{}} fieldOptions={{ allow_external: true }} />);
    expect(screen.getByTestId('source-ref-invalid')).toBeInTheDocument();
  });

  it('does NOT use raw hex literals', () => {
    const { container } = render(
      <SourceReferenceCell value={VALID_UUID} fieldOptions={{ allow_external: false }} />
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
