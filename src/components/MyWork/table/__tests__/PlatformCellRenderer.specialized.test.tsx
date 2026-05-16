/**
 * @vitest-environment jsdom
 *
 * Regression test — Block A · EPIC-T7 · Sprint A-S5.
 *
 * Verifies that the 5 specialized FieldType values introduced by EPIC-T7
 * are routed through `PlatformCellRenderer` to their dedicated cell
 * components and do NOT fall back to the generic TextDisplay.
 *
 * If this test ever falls back to TextDisplay, the renderer registry has
 * regressed and specialized field types will silently render as plain text.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { PlatformCellRenderer } from '../PlatformCellRenderer';

const VALID_UUID = '01234567-89ab-4cde-9012-3456789abcde';

describe('PlatformCellRenderer — specialized field types (EPIC-T7)', () => {
  it('routes risk_score values to RiskScoreCell', () => {
    render(<PlatformCellRenderer value={20} fieldType="risk_score" fieldOptions={{ scale: 25 }} />);
    expect(screen.getByTestId('risk-score-chip')).toBeInTheDocument();
  });

  it('routes priority values to PriorityCell', () => {
    render(
      <PlatformCellRenderer
        value="P0"
        fieldType="priority"
        fieldOptions={{ levels: 'P0_P1_P2_P3' }}
      />
    );
    expect(screen.getByTestId('priority-chip')).toBeInTheDocument();
  });

  it('routes ai_generated_summary values to AiSummaryCell', () => {
    render(
      <PlatformCellRenderer
        value="A summary"
        fieldType="ai_generated_summary"
        fieldOptions={{ prompt_template: '', max_chars: 200 }}
      />
    );
    expect(screen.getByTestId('ai-summary-text')).toBeInTheDocument();
  });

  it('routes ai_classification values to AiClassificationCell', () => {
    render(
      <PlatformCellRenderer
        value="quick_win"
        fieldType="ai_classification"
        fieldOptions={{ classes: ['quick_win', 'strategic'], prompt_template: '' }}
      />
    );
    expect(screen.getByTestId('ai-classification-chip')).toBeInTheDocument();
  });

  it('routes source_reference values to SourceReferenceCell', () => {
    render(
      <PlatformCellRenderer
        value={VALID_UUID}
        fieldType="source_reference"
        fieldOptions={{ allow_external: false }}
      />
    );
    expect(screen.getByTestId('source-ref-internal')).toBeInTheDocument();
  });

  it('forwards manual_override flag from record.data to AI summary cell', () => {
    render(
      <PlatformCellRenderer
        value="Edited by hand"
        fieldType="ai_generated_summary"
        fieldOptions={{ prompt_template: '', max_chars: 200 }}
        record={{ data: { __manual_override: true } }}
      />
    );
    expect(screen.getByTestId('ai-summary-text')).toHaveAttribute('data-manual-override', 'true');
  });

  it('forwards manual_override flag from record.data to AI classification cell', () => {
    render(
      <PlatformCellRenderer
        value="strategic"
        fieldType="ai_classification"
        fieldOptions={{ classes: ['quick_win', 'strategic'], prompt_template: '' }}
        record={{ data: { __manual_override: true } }}
      />
    );
    expect(screen.getByTestId('ai-classification-chip')).toHaveAttribute(
      'data-manual-override',
      'true'
    );
  });
});
