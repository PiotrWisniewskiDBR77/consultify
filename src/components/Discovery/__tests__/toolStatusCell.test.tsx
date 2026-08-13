/**
 * @vitest-environment jsdom
 *
 * Component-level regression coverage for the confirmed defect: a Discovery
 * Tools list row whose backend status is `approved` or `GENERATED` rendered
 * as "Draft" (docs/program/METHOD_TOOLS_2026-08-13/STATUS_CANON.md has the
 * full inventory). `renderToolStatusCell()` is what every status column in
 * DiscoveryToolsHub.tsx now uses — this asserts the actually-rendered DOM
 * text, not just the underlying mapper (already covered by
 * src/domain/__tests__/toolStatus.test.ts).
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { renderToolStatusCell } from '../toolStatusCell';

describe('renderToolStatusCell — the confirmed defect', () => {
  it('a row whose backend status is "approved" renders as Approved, not Draft', () => {
    render(<>{renderToolStatusCell('approved', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Approved');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('a row whose backend status is "GENERATED" (uppercase, tool_sessions casing) does NOT render as Draft', () => {
    render(<>{renderToolStatusCell('GENERATED', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Generated');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('APPROVED (tool_sessions casing) renders as Approved in Polish too', () => {
    render(<>{renderToolStatusCell('APPROVED', true)}</>);
    expect(screen.getByRole('status')).toHaveTextContent('Zatwierdzone');
  });

  it('IN_PROGRESS (present in tool_sessions, missing from the old ad-hoc maps) does not fall back to Draft', () => {
    render(<>{renderToolStatusCell('IN_PROGRESS', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('In progress');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('FAILED does not fall back to Draft', () => {
    render(<>{renderToolStatusCell('FAILED', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Failed');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('superseded (tool_outputs casing) does not fall back to Draft', () => {
    render(<>{renderToolStatusCell('superseded', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Superseded');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('a genuinely unrecognized status renders the explicit fallback text, never a silent Draft', () => {
    render(<>{renderToolStatusCell('SOME_MADE_UP_STATUS', false)}</>);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('unknown status: SOME_MADE_UP_STATUS');
    expect(chip).not.toHaveTextContent('Draft');
  });

  it('a real DRAFT status still renders as Draft (control — the fix must not over-correct)', () => {
    render(<>{renderToolStatusCell('DRAFT', false)}</>);
    expect(screen.getByRole('status')).toHaveTextContent('Draft');
  });
});
