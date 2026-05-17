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
});
