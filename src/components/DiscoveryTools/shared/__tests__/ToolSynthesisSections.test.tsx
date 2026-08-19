import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  normalizeUniversalSynthesis,
  ToolSynthesisSections,
  UNIVERSAL_SYNTHESIS_SECTION_IDS,
} from '../ToolSynthesisSections';

describe('ToolSynthesisSections', () => {
  it('renders exactly the nine universal sections in the frozen order', () => {
    const sections = normalizeUniversalSynthesis(
      Object.fromEntries(UNIVERSAL_SYNTHESIS_SECTION_IDS.map((id) => [id, [`Evidence for ${id}`]])),
      false,
      { 'executive-answer': ['source-output-1'] }
    );

    render(<ToolSynthesisSections sections={sections} />);

    const synthesis = screen.getByTestId('universal-synthesis');
    const rendered = Array.from(
      synthesis.querySelectorAll<HTMLElement>('[data-synthesis-section]')
    );
    expect(rendered).toHaveLength(9);
    expect(rendered.map((node) => node.dataset.synthesisSection)).toEqual([
      ...UNIVERSAL_SYNTHESIS_SECTION_IDS,
    ]);
    rendered.forEach((node, index) => {
      expect(within(node).getByText(`${index + 1}/9`)).toBeInTheDocument();
      expect(within(node).getByText('Needs validation')).toBeInTheDocument();
    });
    expect(within(rendered[0]).getByText('Evidence references')).toBeInTheDocument();
    expect(within(rendered[0]).getByText('source-output-1')).toBeInTheDocument();
  });

  it('keeps missing evidence visible instead of inventing synthesis content', () => {
    const sections = normalizeUniversalSynthesis(
      { 'executive-answer': 'A source-backed answer' },
      false
    );

    render(<ToolSynthesisSections sections={sections} />);

    expect(screen.getAllByText('Needs validation')).toHaveLength(1);
    expect(screen.getAllByText('Needs evidence')).toHaveLength(8);
    expect(screen.getAllByText('—')).toHaveLength(8);
  });
});
