/**
 * @vitest-environment jsdom
 *
 * Component tests for AiSummaryCell (Block A · EPIC-T7 · Sprint A-S5).
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AiSummaryCell } from '../AiSummaryCell';

describe('AiSummaryCell', () => {
  it('renders "AI pending…" when value is null', () => {
    render(
      <AiSummaryCell
        value={null}
        fieldOptions={{ prompt_template: 'Summarize record', max_chars: 200 }}
      />
    );
    expect(screen.getByTestId('ai-summary-pending')).toHaveTextContent(/AI pending/i);
  });

  it('renders "AI pending…" when value is empty string', () => {
    render(<AiSummaryCell value="" fieldOptions={{ prompt_template: '', max_chars: 200 }} />);
    expect(screen.getByTestId('ai-summary-pending')).toBeInTheDocument();
  });

  it('renders the summary text within max_chars without truncation', () => {
    render(
      <AiSummaryCell
        value="Short summary."
        fieldOptions={{ prompt_template: 'tpl', max_chars: 200 }}
      />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node).toHaveTextContent('Short summary.');
    expect(node).toHaveAttribute('data-truncated', 'false');
  });

  it('truncates when value length exceeds max_chars and appends ellipsis', () => {
    render(
      <AiSummaryCell value={'a'.repeat(20)} fieldOptions={{ prompt_template: '', max_chars: 5 }} />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node).toHaveAttribute('data-truncated', 'true');
    expect(node.textContent ?? '').toMatch(/…$/);
  });

  it('clamps max_chars to the hard 2000 limit even if options request more', () => {
    render(
      <AiSummaryCell
        value={'a'.repeat(2500)}
        fieldOptions={{ prompt_template: '', max_chars: 9999 }}
      />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node).toHaveAttribute('data-truncated', 'true');
    expect((node.textContent ?? '').length).toBeLessThanOrEqual(2000);
  });

  it('renders a UserCheck icon and manual-override flag when manualOverride is true', () => {
    render(
      <AiSummaryCell
        value="Edited by hand"
        manualOverride={true}
        fieldOptions={{ prompt_template: '', max_chars: 200 }}
      />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node).toHaveAttribute('data-manual-override', 'true');
    expect(node.getAttribute('title')).toMatch(/manual_override/);
  });

  it('omits manual-override when manualOverride is false / unset', () => {
    render(
      <AiSummaryCell value="AI-generated" fieldOptions={{ prompt_template: '', max_chars: 200 }} />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node).toHaveAttribute('data-manual-override', 'false');
  });

  it('exposes prompt template in tooltip when provided', () => {
    render(
      <AiSummaryCell
        value="Summary"
        fieldOptions={{ prompt_template: 'Summarize record in ≤200 chars', max_chars: 200 }}
      />
    );
    const node = screen.getByTestId('ai-summary-text');
    expect(node.getAttribute('title')).toMatch(/Summarize record/);
  });

  it('does NOT use raw hex literals', () => {
    const { container } = render(
      <AiSummaryCell value="text" fieldOptions={{ prompt_template: '', max_chars: 200 }} />
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});
