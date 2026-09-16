import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const mermaidMock = vi.hoisted(() => ({
  initialize: vi.fn(),
  render: vi.fn(async () => ({
    svg: Buffer.from(
      'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+d2luZG93Ll9feHNzPTE8L3NjcmlwdD48Zm9yZWlnbk9iamVjdD48ZGl2PmJhZDwvZGl2PjwvZm9yZWlnbk9iamVjdD48YSBocmVmPSJqYXZhc2NyaXB0OmFsZXJ0KDEpIj48dGV4dD5VbnNhZmU8L3RleHQ+PC9hPjx0ZXh0IG9uY2xpY2s9ImFsZXJ0KDEpIj5TYWZlIGxhYmVsPC90ZXh0Pjwvc3ZnPg==',
      'base64'
    ).toString('utf8'),
  })),
}));

vi.mock('mermaid', () => ({ default: mermaidMock }));

import { CanvasArtifactBlockRenderer } from '../CanvasArtifactBlockRenderer';

describe('CanvasArtifactBlockRenderer Mermaid final-context boundary', () => {
  it('disables HTML labels and sanitizes active SVG before innerHTML', async () => {
    const block = {
      id: 'diagram-security',
      kind: 'diagram',
      schemaVersion: 'canvas-block/v1',
      title: Buffer.from('U2FmZSBwcm9jZXNz', 'base64').toString('utf8'),
      status: 'ready',
      capabilities: ['view'],
      data: { mermaid: 'flowchart LR\n A[Start] --> B[Finish]' },
      provenance: { source: 'user' },
      markdownProjection: '',
      markdownProjectionStatus: 'ready',
    } as never;

    const { container } = render(<CanvasArtifactBlockRenderer block={block} />);

    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    expect(mermaidMock.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        htmlLabels: false,
        flowchart: expect.objectContaining({ htmlLabels: false }),
      })
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('foreignObject')).toBeNull();
    expect(container.querySelector('[onclick]')).toBeNull();
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toMatch(/^javascript:/i);
    expect(container.textContent).toContain(
      Buffer.from('U2FmZSBsYWJlbA==', 'base64').toString('utf8')
    );
  });
});
