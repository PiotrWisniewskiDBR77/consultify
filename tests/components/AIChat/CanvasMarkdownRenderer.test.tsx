import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CanvasMarkdownRenderer } from '../../../src/components/AIChat/CanvasMarkdownRenderer';

describe('CanvasMarkdownRenderer', () => {
  it('renders GFM content as document UI instead of raw Markdown text', () => {
    render(
      <CanvasMarkdownRenderer
        text={`# Research Note

Area: Market research

> Important context

| Signal | Meaning |
|---|---|
| Demand | Growing |

- [ ] Verify source

\`inline code\`

\`\`\`ts
const signal = 'growing';
\`\`\`

[Consultify](https://example.com)`}
      />
    );

    expect(screen.getByRole('heading', { name: 'Research Note' })).toBeInTheDocument();
    expect(screen.getByText('Area: Market research')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Signal' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByText('inline code')).toBeInTheDocument();
    expect(screen.getByText("const signal = 'growing';")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consultify' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
    expect(screen.getByText('Important context')).toBeInTheDocument();
    expect(screen.queryByText('{"contentJson"')).not.toBeInTheDocument();
  });

  it('routes a ```mermaid fence to the diagram renderer, not a raw code block', () => {
    const { container } = render(
      <CanvasMarkdownRenderer
        text={`# Flow

\`\`\`js
const x = 1;
\`\`\`

\`\`\`mermaid
flowchart LR
  A[Input] --> B[Process] --> C[Output]
\`\`\`
`}
      />
    );

    // A normal fenced block still renders as a syntax-highlighted code block.
    expect(container.querySelector('code.language-js')).not.toBeNull();
    // The mermaid fence takes the diagram branch (lazy DiagramRenderer / Suspense
    // fallback) — it must NOT render as a <code class="language-mermaid"> block.
    expect(container.querySelector('code.language-mermaid')).toBeNull();
  });
});
