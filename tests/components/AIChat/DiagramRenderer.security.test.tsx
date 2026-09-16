import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

import { DiagramRenderer } from '../../../src/components/AIChat/Artifacts/renderers/DiagramRenderer';
import { MERMAID_STRICT_FLOWCHART_FIXTURE } from './fixtures/mermaid-strict-flowchart.fixture';

const maliciousSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <a id="safe" href="https://safe.test/diagram"><text>safe</text></a>
    <a id="js" href="javascript:alert(1)" onclick="alert(2)"><text>js</text></a>
    <a id="data" href="data:text/html,boom"><text>data</text></a>
    <a id="vb" xlink:href="vbscript:msgbox(1)"><text>vb</text></a>
    <line id="marker-safe" marker-end="url(#safe-arrow)"/>
    <line id="marker-js" marker-start="url(javascript:alert(4))"/>
    <line id="marker-data" marker-mid="url(data:image/svg+xml,boom)"/>
    <script>alert(3)</script>
  </svg>`;

describe('DiagramRenderer SVG security boundary', () => {
  beforeEach(() => {
    mermaidMock.initialize.mockClear();
    mermaidMock.render.mockReset().mockResolvedValue({ svg: maliciousSvg });
  });

  it('uses Mermaid strict mode and removes executable SVG links and handlers', async () => {
    const { container } = render(<DiagramRenderer content="flowchart LR; A-->B" />);

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        htmlLabels: false,
        flowchart: expect.objectContaining({ htmlLabels: false }),
      })
    );
    expect(container.querySelector('#safe')?.getAttribute('href')).toBe(
      'https://safe.test/diagram'
    );
    for (const id of ['js', 'data', 'vb']) {
      const link = container.querySelector(`#${id}`);
      expect(link?.hasAttribute('href')).toBe(false);
      expect(link?.hasAttribute('xlink:href')).toBe(false);
      expect(link?.hasAttribute('onclick')).toBe(false);
    }
    expect(container.querySelector('#marker-safe')?.getAttribute('marker-end')).toBe(
      'url(#safe-arrow)'
    );
    expect(container.querySelector('#marker-js')?.hasAttribute('marker-start')).toBe(false);
    expect(container.querySelector('#marker-data')?.hasAttribute('marker-mid')).toBe(false);
    expect(container.querySelector('script')).toBeNull();
  });

  it('retains labels and arrow markers from a strict-mode Mermaid SVG fixture', async () => {
    mermaidMock.render.mockResolvedValueOnce({
      svg: MERMAID_STRICT_FLOWCHART_FIXTURE,
    });

    const { container } = render(<DiagramRenderer content="flowchart LR; A-->B" />);
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());

    const diagramSvg = container.querySelector('marker')?.closest('svg');
    expect(diagramSvg?.querySelector('defs marker path')).not.toBeNull();
    expect(diagramSvg?.querySelector('g.node rect')).not.toBeNull();
    expect(Array.from(diagramSvg?.querySelectorAll('text') ?? []).map((node) => node.textContent)).toEqual([
      'Draft',
      'Approve',
    ]);
    expect(diagramSvg?.querySelector('path.flowchart-link')?.getAttribute('marker-end')).toBe(
      'url(#flowchart-v2-pointEnd)'
    );
    expect(diagramSvg?.querySelector('foreignObject')).toBeNull();
  });
});
