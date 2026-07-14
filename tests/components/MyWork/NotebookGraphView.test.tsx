import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('reactflow/dist/style.css', () => ({}));
vi.mock('reactflow', () => ({
  __esModule: true,
  default: ({ nodes, edges }: any) => (
    <div data-testid="reactflow" data-nodes={nodes?.length ?? 0} data-edges={edges?.length ?? 0} />
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
}));

import { NotebookGraphView } from '@/components/MyWork/notebook/NotebookGraphView';

const topics = [{ id: 't1', name: 'Pricing', pageCount: 3 }];
const backlinks = [{ id: 'bl1', sourceType: 'initiative', sourceId: 'init-12345678' }];

afterEach(() => {
  delete (global as any).fetch;
});

describe('NotebookGraphView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the topic + backlink counts in the header', async () => {
    (global as any).fetch = vi.fn(async (url: string) => {
      if (url.includes('/notebook/topics')) {
        return { ok: true, json: async () => ({ data: topics }) };
      }
      return { ok: true, json: async () => ({ data: backlinks }) };
    });
    render(<NotebookGraphView pageId="p1" pageTitle="Q2 plan" />);
    await waitFor(() => expect(screen.getByText(/1 topics • 1 backlinks/)).toBeInTheDocument());
  });

  it('builds a graph node per topic + backlink plus the center node', async () => {
    (global as any).fetch = vi.fn(async (url: string) => {
      if (url.includes('/notebook/topics')) return { ok: true, json: async () => ({ data: topics }) };
      return { ok: true, json: async () => ({ data: backlinks }) };
    });
    render(<NotebookGraphView pageId="p1" pageTitle="Q2 plan" />);
    const rf = await screen.findByTestId('reactflow');
    // center + 1 topic + 1 backlink = 3 nodes
    expect(rf.getAttribute('data-nodes')).toBe('3');
    expect(rf.getAttribute('data-edges')).toBe('2');
  });

  it('shows the empty state when no topics or backlinks load', async () => {
    (global as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    render(<NotebookGraphView pageId="p1" />);
    expect(await screen.findByText(/No topics or backlinks/i)).toBeInTheDocument();
    expect(screen.queryByTestId('reactflow')).not.toBeInTheDocument();
  });

  it('degrades to empty when both fetches reject', async () => {
    (global as any).fetch = vi.fn(async () => { throw new Error('network'); });
    render(<NotebookGraphView pageId="p1" />);
    expect(await screen.findByText(/No topics or backlinks/i)).toBeInTheDocument();
  });

  it('renders the title via t() (language-driven, not isPolish prop)', async () => {
    // i18n(M04): title moved from isPolish-ternary to t(); test env resolves EN defaultValue.
    (global as any).fetch = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    render(<NotebookGraphView pageId="p1" isPolish />);
    expect(await screen.findByText('Connection graph')).toBeInTheDocument();
  });
});
