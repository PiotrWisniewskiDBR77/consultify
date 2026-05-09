/**
 * @vitest-environment jsdom
 *
 * Component tests for `PresentationStudioLayoutAuditBanner` (Sprint S11).
 *
 * Verifies:
 *   - When `audit` is null, the banner renders nothing (page never shows
 *     audit summary before a preview ran).
 *   - When `audit.warnings.length === 0`, the clean tile renders with a
 *     stable test hook and an emerald "no findings" message.
 *   - When findings exist, the warning tile renders with the aggregate
 *     count, a toggle to expand the breakdown, and a per-flag count
 *     element for each non-zero flag class.
 *   - The toggle button flips visibility of the breakdown and warnings
 *     list, and `aria-expanded` updates correctly.
 *   - The banner is purely advisory: it never triggers a callback or a
 *     mutation. (Verified by absence of any such prop.)
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { PresentationStudioOutlineLayoutAudit } from '@/services/api/presentationStudio.api';

import { PresentationStudioLayoutAuditBanner } from '../PresentationStudioLayoutAuditBanner';

function makeCleanAudit(): PresentationStudioOutlineLayoutAudit {
  return {
    warnings: [],
    slideAudits: [{ index: 0, intent: 'cover', flags: [] }],
    flagCounts: {
      layout_overflow_title: 0,
      layout_overflow_key_message: 0,
      layout_overflow_blocks: 0,
      missing_source_for_evidence_intent: 0,
      unsupported_intent_for_pptx_export: 0,
      unsupported_intent_for_pdf_export: 0,
    },
  };
}

function makeFindingsAudit(): PresentationStudioOutlineLayoutAudit {
  return {
    warnings: [
      '[layout_overflow_title] Slide 2 (executive_summary): title is 220 chars; …',
      '[missing_source_for_evidence_intent] Slide 3 (recommendation_single): …',
    ],
    slideAudits: [
      { index: 0, intent: 'cover', flags: [] },
      { index: 1, intent: 'executive_summary', flags: ['layout_overflow_title'] },
      {
        index: 2,
        intent: 'recommendation_single',
        flags: ['missing_source_for_evidence_intent'],
      },
    ],
    flagCounts: {
      layout_overflow_title: 1,
      layout_overflow_key_message: 0,
      layout_overflow_blocks: 0,
      missing_source_for_evidence_intent: 1,
      unsupported_intent_for_pptx_export: 0,
      unsupported_intent_for_pdf_export: 0,
    },
  };
}

describe('PresentationStudioLayoutAuditBanner', () => {
  it('renders nothing when audit is null', () => {
    const { container } = render(<PresentationStudioLayoutAuditBanner audit={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the clean state when there are no findings', () => {
    render(<PresentationStudioLayoutAuditBanner audit={makeCleanAudit()} />);
    const banner = screen.getByTestId('presentation-studio-layout-audit');
    expect(banner.getAttribute('data-state')).toBe('clean');
    expect(banner.textContent).toContain('Layout audit: no findings');
    // No toggle button on the clean state.
    expect(screen.queryByTestId('presentation-studio-layout-audit-toggle')).toBeNull();
  });

  it('renders the warning state with aggregate count when findings exist', () => {
    render(<PresentationStudioLayoutAuditBanner audit={makeFindingsAudit()} />);
    const banner = screen.getByTestId('presentation-studio-layout-audit');
    expect(banner.getAttribute('data-state')).toBe('warnings');
    expect(banner.textContent).toContain('Layout audit: 2 findings');
    // Breakdown is collapsed by default — toggle exists, details do not.
    expect(screen.getByTestId('presentation-studio-layout-audit-toggle')).toBeTruthy();
    expect(screen.queryByTestId('presentation-studio-layout-audit-details')).toBeNull();
  });

  it('expands the breakdown when the toggle is clicked', () => {
    render(<PresentationStudioLayoutAuditBanner audit={makeFindingsAudit()} />);
    const toggle = screen.getByTestId('presentation-studio-layout-audit-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('presentation-studio-layout-audit-details')).toBeTruthy();

    // Per-flag count tiles only render for flags with count > 0.
    expect(
      screen.getByTestId('presentation-studio-layout-audit-flag-layout_overflow_title')
    ).toBeTruthy();
    expect(
      screen.getByTestId('presentation-studio-layout-audit-flag-missing_source_for_evidence_intent')
    ).toBeTruthy();
    expect(
      screen.queryByTestId('presentation-studio-layout-audit-flag-layout_overflow_blocks')
    ).toBeNull();
  });

  it('collapses the breakdown when the toggle is clicked a second time', () => {
    render(
      <PresentationStudioLayoutAuditBanner audit={makeFindingsAudit()} defaultExpanded={true} />
    );
    const toggle = screen.getByTestId('presentation-studio-layout-audit-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('presentation-studio-layout-audit-details')).toBeTruthy();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('presentation-studio-layout-audit-details')).toBeNull();
  });

  it('renders the raw warning strings inside the expanded details', () => {
    render(
      <PresentationStudioLayoutAuditBanner audit={makeFindingsAudit()} defaultExpanded={true} />
    );
    const warnings = screen.getByTestId('presentation-studio-layout-audit-warnings');
    expect(warnings.textContent).toContain('[layout_overflow_title]');
    expect(warnings.textContent).toContain('[missing_source_for_evidence_intent]');
  });

  it('uses singular language when there is exactly one finding', () => {
    render(
      <PresentationStudioLayoutAuditBanner
        audit={{
          warnings: ['[layout_overflow_title] Slide 1 …'],
          slideAudits: [{ index: 0, intent: 'cover', flags: ['layout_overflow_title'] }],
          flagCounts: {
            layout_overflow_title: 1,
            layout_overflow_key_message: 0,
            layout_overflow_blocks: 0,
            missing_source_for_evidence_intent: 0,
            unsupported_intent_for_pptx_export: 0,
            unsupported_intent_for_pdf_export: 0,
          },
        }}
      />
    );
    expect(screen.getByTestId('presentation-studio-layout-audit').textContent).toContain(
      'Layout audit: 1 finding'
    );
  });
});
