import mermaid from 'mermaid';
import { beforeAll, describe, expect, it } from 'vitest';

import { sanitizeMermaidSvg } from '../../../src/utils/safeMermaidSvg';

beforeAll(() => {
  // Mermaid measures labels during layout. jsdom does not implement these SVG
  // geometry methods, so the proof supplies deterministic dimensions while
  // keeping Mermaid's real parser, renderer and SVG generation path intact.
  Object.defineProperty(SVGElement.prototype, 'getBBox', {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 96, height: 24 }),
  });
  Object.defineProperty(SVGElement.prototype, 'getComputedTextLength', {
    configurable: true,
    value: () => 96,
  });
});

describe('DiagramRenderer — real Mermaid strict SVG proof', () => {
  it('renders SVG text labels and a local arrow marker without foreignObject', async () => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      htmlLabels: false,
      flowchart: { useMaxWidth: true, htmlLabels: false },
    });

    const { svg: renderedSvg } = await mermaid.render(
      'feedback-0b-real-mermaid',
      'flowchart LR\n  A[Draft] --> B[Approve]'
    );
    const sanitized = sanitizeMermaidSvg(renderedSvg);
    const parsed = new DOMParser().parseFromString(sanitized, 'image/svg+xml');

    expect(renderedSvg).not.toContain('<foreignObject');
    expect(parsed.querySelector('foreignObject')).toBeNull();
    expect(parsed.documentElement.textContent).toContain('Draft');
    expect(parsed.documentElement.textContent).toContain('Approve');
    expect(parsed.querySelectorAll('text').length).toBeGreaterThanOrEqual(2);

    const markedEdge = Array.from(parsed.querySelectorAll('[marker-end]')).find((element) =>
      /^url\(#[A-Za-z0-9_.:-]+\)$/.test(element.getAttribute('marker-end') ?? '')
    );
    expect(markedEdge).toBeDefined();
  });
});
