/**
 * E11 (2026-08-10) — direct coverage for the mandatory conversion preview
 * (docs/standards/idea-workspace/10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md
 * §2.2). This is the single gate now shared by every Convert entry point in
 * `IdeaMapWorkspace.handleConvert` — prior state (E02-N5-CONVERT ledger
 * finding) was that NO preview existed anywhere, only a toast after the
 * server call. These tests exercise the dialog in isolation (no server, no
 * host component) so the contract is pinned regardless of how the host wires
 * it.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ConversionPreviewDialog,
  type ConversionPreviewData,
} from '../../../src/components/MyWork/ConversionPreviewDialog';

function makeData(overrides?: Partial<ConversionPreviewData>): ConversionPreviewData {
  return {
    targetLabelPl: 'Inicjatywa',
    targetLabelEn: 'Initiative',
    targetArtifactName: 'My idea title',
    scope: {
      kind: 'workspace',
      labelPl: 'Cała Idea',
      labelEn: 'Whole Idea',
      elementLabels: [],
      elementCount: 0,
    },
    mappedFields: [
      { sourcePl: 'Tytuł Idei', sourceEn: 'Idea title', targetPl: 'Nazwa', targetEn: 'Name' },
    ],
    warnings: [],
    willPromoteStage: true,
    priorConversionCount: 0,
    ...overrides,
  };
}

describe('ConversionPreviewDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConversionPreviewDialog
        open={false}
        isPolish={false}
        data={makeData()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading state when open but data has not resolved yet — never a dead click', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/Preparing preview/i)).toBeInTheDocument();
    // No confirm button yet — nothing to accidentally click through.
    expect(screen.queryByTestId('idea-conversion-preview-confirm')).not.toBeInTheDocument();
  });

  it('shows scope, target, artifact name and mapped fields once data resolves', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Whole Idea')).toBeInTheDocument();
    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByTestId('idea-conversion-preview-name')).toHaveTextContent(
      'My idea title'
    );
    expect(screen.getByText('Idea title')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('shows the stage-promotion notice only for whole-Idea (workspace) scope', () => {
    const { rerender } = render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData({ willPromoteStage: true })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/mark the whole Idea as Promoted/i)).toBeInTheDocument();

    rerender(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData({
          willPromoteStage: false,
          scope: {
            kind: 'single_item',
            labelPl: 'Węzeł',
            labelEn: 'Single node',
            elementLabels: ['Risk: vendor lock-in'],
            elementCount: 1,
          },
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText(/mark the whole Idea as Promoted/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Idea stage stays unchanged/i)).toBeInTheDocument();
    expect(screen.getByText('Risk: vendor lock-in')).toBeInTheDocument();
  });

  it('shows real prior-conversion count instead of hiding lineage', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData({ priorConversionCount: 2 })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/already been converted 2×/i)).toBeInTheDocument();
    expect(screen.getByText(/appends another, separate record/i)).toBeInTheDocument();
  });

  it('surfaces warnings honestly instead of silently proceeding', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData({
          warnings: [{ pl: 'Idea jest pusta.', en: 'This Idea has no content yet.' }],
        })}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('This Idea has no content yet.')).toBeInTheDocument();
  });

  it('cancel calls onCancel and never onConfirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByTestId('idea-conversion-preview-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirm calls onConfirm — the only path that actually persists anything', () => {
    const onConfirm = vi.fn();
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('idea-conversion-preview-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while submitting, so a slow server call cannot be double-fired', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish={false}
        data={makeData()}
        submitting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByTestId('idea-conversion-preview-confirm')).toBeDisabled();
    expect(screen.getByTestId('idea-conversion-preview-cancel')).toBeDisabled();
  });

  it('renders Polish copy when isPolish is true', () => {
    render(
      <ConversionPreviewDialog
        open
        isPolish
        data={makeData()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Cała Idea')).toBeInTheDocument();
    expect(screen.getByText('Inicjatywa')).toBeInTheDocument();
    expect(screen.getByTestId('idea-conversion-preview-confirm')).toHaveTextContent(
      'Potwierdź i konwertuj'
    );
  });
});
