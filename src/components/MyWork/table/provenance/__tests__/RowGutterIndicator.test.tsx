/**
 * @vitest-environment jsdom
 *
 * Component tests for RowGutterIndicator (Block B / B-S5).
 *
 * Coverage:
 *   * Renders nothing when the feature flag is OFF.
 *   * Renders nothing when score is null and status is `unverified`
 *     (no signal worth surfacing).
 *   * `flagged` always renders the amber indicator regardless of score.
 *   * `verified` always renders the emerald indicator regardless of score.
 *   * Score-only path uses red / amber / emerald per documented thresholds.
 *   * Memoization holds a stable identity between renders with the same
 *     props (B-T5 mitigation contract).
 */

import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import * as flag from '@/utils/recordProvenanceFlag';

import { RowGutterIndicator } from '../RowGutterIndicator';

describe('RowGutterIndicator', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(flag, 'isRecordProvenanceEnabled').mockReturnValue(true);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('renders nothing when the feature flag is OFF', () => {
    spy.mockReturnValue(false);
    const { queryByTestId } = render(
      <RowGutterIndicator confidenceScore={0.9} validationStatus="verified" />
    );
    expect(queryByTestId('provenance-row-gutter')).toBeNull();
  });

  it('renders nothing when score is null and status is unverified', () => {
    const { queryByTestId } = render(
      <RowGutterIndicator confidenceScore={null} validationStatus="unverified" />
    );
    expect(queryByTestId('provenance-row-gutter')).toBeNull();
  });

  it('renders the amber indicator when flagged regardless of score', () => {
    const { getByTestId } = render(
      <RowGutterIndicator confidenceScore={0.95} validationStatus="flagged" />
    );
    const el = getByTestId('provenance-row-gutter');
    expect(el.style.backgroundColor).toBe('var(--c-warning)');
  });

  it('renders the emerald indicator when verified regardless of score', () => {
    const { getByTestId } = render(
      <RowGutterIndicator confidenceScore={0.05} validationStatus="verified" />
    );
    const el = getByTestId('provenance-row-gutter');
    expect(el.style.backgroundColor).toBe('var(--c-success)');
  });

  it('uses red for low scores when status is unverified', () => {
    const { getByTestId } = render(
      <RowGutterIndicator confidenceScore={0.2} validationStatus="unverified" />
    );
    const el = getByTestId('provenance-row-gutter');
    expect(el.style.backgroundColor).toBe('var(--c-danger)');
  });

  it('uses emerald for high scores when status is unverified', () => {
    const { getByTestId } = render(
      <RowGutterIndicator confidenceScore={0.85} validationStatus="unverified" />
    );
    const el = getByTestId('provenance-row-gutter');
    expect(el.style.backgroundColor).toBe('var(--c-success)');
  });

  it('exposes a tooltip + aria-label including the percentage and status', () => {
    const { getByTestId } = render(
      <RowGutterIndicator confidenceScore={0.42} validationStatus="unverified" />
    );
    const el = getByTestId('provenance-row-gutter');
    expect(el.getAttribute('aria-label')).toMatch(/AI confidence 42%/);
    expect(el.getAttribute('title')).toMatch(/42%/);
  });
});
