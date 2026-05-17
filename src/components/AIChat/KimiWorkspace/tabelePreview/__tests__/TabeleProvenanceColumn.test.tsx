/**
 * @vitest-environment jsdom
 *
 * Component tests for TabeleProvenanceColumn (Block B / B-S5b).
 *
 * Coverage:
 *   * "No signal" path renders an em-dash placeholder so the column
 *     never collapses mid-table.
 *   * Score-only path renders the compact bar.
 *   * Score + status path renders both bar and badge.
 *   * `readRowProvenance` honours the `__`-prefixed convention from
 *     `tablePlatformMappers.recordToNode`.
 *   * `rowsHaveProvenance` returns `false` when no row carries a signal
 *     and `true` when at least one does (B-P5 contract).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import {
  readRowProvenance,
  rowsHaveProvenance,
  TabeleProvenanceColumn,
} from '../TabeleProvenanceColumn';

describe('TabeleProvenanceColumn', () => {
  it('renders an em-dash when there is no actionable signal', () => {
    render(<TabeleProvenanceColumn confidenceScore={null} validationStatus="unverified" />);
    expect(screen.getByTestId('tabele-provenance-column-empty')).toHaveTextContent('—');
  });

  it('renders the compact confidence bar when a score is present', () => {
    render(<TabeleProvenanceColumn confidenceScore={0.7} validationStatus="unverified" />);
    expect(screen.getByTestId('tabele-provenance-column')).toBeInTheDocument();
    expect(screen.getByTestId('tabele-provenance-column-confidence')).toBeInTheDocument();
  });

  it('renders the verified badge in addition to the bar', () => {
    render(<TabeleProvenanceColumn confidenceScore={0.9} validationStatus="verified" />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('renders the flagged badge even when score is null', () => {
    render(<TabeleProvenanceColumn confidenceScore={null} validationStatus="flagged" />);
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });
});

describe('readRowProvenance', () => {
  it('reads numeric confidence and known status keys', () => {
    const result = readRowProvenance({
      __confidence_score: 0.42,
      __validation_status: 'flagged',
    });
    expect(result).toEqual({ confidenceScore: 0.42, validationStatus: 'flagged' });
  });

  it('coerces string-encoded numbers and rejects junk statuses', () => {
    const result = readRowProvenance({
      __confidence_score: '0.55',
      __validation_status: 'whatever',
    });
    expect(result.confidenceScore).toBe(0.55);
    expect(result.validationStatus).toBeNull();
  });

  it('returns nulls when the row carries no provenance keys', () => {
    expect(readRowProvenance({ name: 'foo' })).toEqual({
      confidenceScore: null,
      validationStatus: null,
    });
  });
});

describe('rowsHaveProvenance', () => {
  it('returns false when no row carries an actionable signal (B-P5)', () => {
    expect(rowsHaveProvenance([{ name: 'a' }, { __validation_status: 'unverified' }])).toBe(false);
  });

  it('returns true when any row has a non-null score', () => {
    expect(rowsHaveProvenance([{ name: 'a' }, { __confidence_score: 0.9 }])).toBe(true);
  });

  it('returns true when any row has a non-unverified status', () => {
    expect(rowsHaveProvenance([{ __validation_status: 'flagged' }])).toBe(true);
  });
});
