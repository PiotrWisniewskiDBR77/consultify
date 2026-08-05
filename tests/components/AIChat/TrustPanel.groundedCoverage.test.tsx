/**
 * TrustPanel — M01-P04B (GF-CHAT-08 coverage: "each attributed claim has a
 * source, or the answer is explicitly marked unsupported").
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { isAnswerGrounded, TrustPanel } from '../../../src/components/AIChat/TrustPanel';

describe('isAnswerGrounded (M01-P04B / GF-CHAT-08 coverage)', () => {
  it('is false for a bundle with zero citations', () => {
    expect(isAnswerGrounded({ citationsCount: 0 })).toBe(false);
  });

  it('is false when citationsCount is missing entirely', () => {
    expect(isAnswerGrounded({})).toBe(false);
  });

  it('is false for a null bundle', () => {
    expect(isAnswerGrounded(null)).toBe(false);
  });

  it('is true when there is at least one citation and coverage did not fail', () => {
    expect(isAnswerGrounded({ citationsCount: 2, coverage: { passesPolicy: true } })).toBe(true);
    // No coverage result at all (validator did not run) — citations alone still ground it.
    expect(isAnswerGrounded({ citationsCount: 1 })).toBe(true);
  });

  it('is false when citations exist but claim coverage explicitly failed', () => {
    expect(isAnswerGrounded({ citationsCount: 3, coverage: { passesPolicy: false } })).toBe(false);
  });

  /**
   * NEGATIVE CONTROL (c) — required by the packet: "test coverage cytowań
   * MUSI padać przy odpowiedzi bez ani jednego źródła oznaczonej jako
   * grounded". Reproduces exactly the broken shape this control targets: a
   * naive "grounded" check that only looks at whether SOMETHING got
   * rendered (e.g. `sourceClasses.length`, which defaults to `['general']`
   * even with zero citations — see `SourcesStrip`/`TrustPanel`'s existing
   * `sourceClasses` fallback) instead of the actual citation count.
   */
  it('[negative control] a naive "has sourceClasses" check would wrongly call a zero-citation answer grounded', () => {
    const naiveGroundedCheck = (data: { sourceClasses?: string[] }) =>
      (data.sourceClasses?.length ?? 0) > 0;
    const zeroSourceBundle = { citationsCount: 0, sourceClasses: ['general'] };
    // The naive check is fooled by the always-present 'general' fallback class.
    expect(naiveGroundedCheck(zeroSourceBundle)).toBe(true);
    // The real check is not.
    expect(isAnswerGrounded(zeroSourceBundle)).toBe(false);
  });
});

describe('TrustPanel — renders the grounded/not-grounded signal', () => {
  it('shows "Not grounded" for a zero-citation bundle', () => {
    render(<TrustPanel bundle={{ citationsCount: 0, model: 'gpt-4o' }} />);
    const badge = screen.getByTestId('trust-panel-grounded');
    expect(badge).toHaveAttribute('data-grounded', 'false');
    expect(badge.textContent).toBe('Not grounded');
  });

  it('shows "Grounded" for a cited, coverage-passing bundle', () => {
    render(
      <TrustPanel
        bundle={{
          citationsCount: 2,
          coverage: { totalClaims: 2, citedClaims: 2, coverageScore: 1, passesPolicy: true },
        }}
      />
    );
    const badge = screen.getByTestId('trust-panel-grounded');
    expect(badge).toHaveAttribute('data-grounded', 'true');
    expect(screen.getByTestId('trust-panel-coverage').textContent).toContain('2/2 cited');
  });

  it('shows "Not grounded" when citations exist but claim coverage failed', () => {
    render(
      <TrustPanel
        bundle={{
          citationsCount: 1,
          coverage: { totalClaims: 3, citedClaims: 1, coverageScore: 0.33, passesPolicy: false },
        }}
      />
    );
    expect(screen.getByTestId('trust-panel-grounded')).toHaveAttribute('data-grounded', 'false');
  });
});
