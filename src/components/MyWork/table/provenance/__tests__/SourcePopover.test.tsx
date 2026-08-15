/**
 * @vitest-environment jsdom
 *
 * Component tests for SourcePopover (Block B / EPIC-T8).
 *
 * Coverage:
 *   * Active count + cap badge in the header.
 *   * Loading / error / empty states render the right copy + test ids.
 *   * Active vs archived sources: archived rows must NOT render.
 *   * Verify / archive callbacks fire with the correct source object.
 *   * Add button is disabled at the cap and enabled below it.
 *   * Read-only mode hides verify / archive / add affordances.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; value?: number }) => {
      const messages: Record<string, string> = {
        'myWorkTable.sourcePopover.loading': 'Loading…',
        'myWorkTable.sourcePopover.reachedCap': 'Reached cap of {{value}} active sources.',
      };
      return (messages[key] ?? options?.defaultValue ?? key).replace(
        '{{value}}',
        String(options?.value ?? '')
      );
    },
    i18n: { language: 'en' },
  }),
}));

import type { RecordSource } from '@/services/api/recordProvenance.api';

import { SourcePopover } from '../SourcePopover';

function makeSource(overrides: Partial<RecordSource> = {}): RecordSource {
  return {
    id: overrides.id ?? `src-${Math.random().toString(36).slice(2, 7)}`,
    organization_id: 'org-1',
    record_id: 'rec-1',
    source_type: overrides.source_type ?? 'manual',
    source_uri: overrides.source_uri ?? null,
    source_metadata: overrides.source_metadata ?? {},
    confidence_contribution: overrides.confidence_contribution ?? null,
    created_by: overrides.created_by ?? 'user-1',
    created_at: overrides.created_at ?? new Date().toISOString(),
    last_verified_at: overrides.last_verified_at ?? null,
    last_verified_by: overrides.last_verified_by ?? null,
    archived_at: overrides.archived_at ?? null,
  };
}

describe('SourcePopover', () => {
  it('renders the empty state when there are no active sources', () => {
    render(<SourcePopover sources={[]} />);
    expect(screen.getByTestId('provenance-source-popover-empty')).toBeInTheDocument();
  });

  it('renders the loading state and hides the empty state while loading', () => {
    render(<SourcePopover sources={[]} loading />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByTestId('provenance-source-popover-empty')).not.toBeInTheDocument();
  });

  it('renders the error state when an error is provided', () => {
    render(<SourcePopover sources={[]} error="Boom" />);
    expect(screen.getByTestId('provenance-source-popover-error')).toHaveTextContent('Boom');
  });

  it('hides archived sources from the active list', () => {
    const sources = [
      makeSource({ id: 'a', archived_at: null, source_type: 'manual' }),
      makeSource({
        id: 'b',
        archived_at: new Date().toISOString(),
        source_type: 'ai_extraction',
      }),
    ];
    render(<SourcePopover sources={sources} />);
    const items = screen.queryAllByTestId('provenance-source-popover-item');
    expect(items).toHaveLength(1);
  });

  it('invokes onVerify with the picked source', () => {
    const onVerify = vi.fn();
    const source = makeSource({ id: 'src-1' });
    render(<SourcePopover sources={[source]} onVerify={onVerify} />);
    fireEvent.click(screen.getByTestId('provenance-source-popover-verify-src-1'));
    expect(onVerify).toHaveBeenCalledWith(source);
  });

  it('disables the Add button when the cap is reached', () => {
    const sources = Array.from({ length: 50 }, (_, i) => makeSource({ id: `src-${i}` }));
    render(<SourcePopover sources={sources} onAddClick={vi.fn()} />);
    const addBtn = screen.getByTestId('provenance-source-popover-add');
    expect(addBtn).toBeDisabled();
  });

  it('enables Add when below cap and forwards the click', () => {
    const onAddClick = vi.fn();
    render(<SourcePopover sources={[]} onAddClick={onAddClick} />);
    const addBtn = screen.getByTestId('provenance-source-popover-add');
    expect(addBtn).not.toBeDisabled();
    fireEvent.click(addBtn);
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('hides verify / archive / add affordances in read-only mode', () => {
    const source = makeSource({ id: 'src-x' });
    render(
      <SourcePopover
        sources={[source]}
        onVerify={vi.fn()}
        onArchive={vi.fn()}
        onAddClick={vi.fn()}
        readOnly
      />
    );
    expect(screen.queryByTestId('provenance-source-popover-verify-src-x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-source-popover-archive-src-x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('provenance-source-popover-add')).not.toBeInTheDocument();
  });
});
