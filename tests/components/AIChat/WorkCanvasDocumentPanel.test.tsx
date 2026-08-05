import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

// The Dock/Markdown view toggle moved into the Canvas menu (the
// "Canvas menu" / MoreHorizontal control) after the rich-editor rollout.
// These helpers open that menu (if needed) before flipping the view mode so
// the tests interact with the current UI rather than a stale top-level toggle.
async function switchView(
  user: ReturnType<typeof userEvent.setup>,
  mode: 'Markdown view' | 'Dock view'
) {
  if (!screen.queryByRole('button', { name: mode })) {
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
  }
  await user.click(await screen.findByRole('button', { name: mode }));
}

function switchViewFireEvent(mode: 'Markdown view' | 'Dock view') {
  if (!screen.queryByRole('button', { name: mode })) {
    fireEvent.click(screen.getByRole('button', { name: /Canvas menu/i }));
  }
  fireEvent.click(screen.getByRole('button', { name: mode }));
}

describe('WorkCanvasDocumentPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    // The rich TipTap editor became the default Canvas view mode. These tests
    // assert against the document/MD views, so pin the persisted mode to
    // 'document' to render the document UI the tests query.
    window.localStorage.setItem('workCanvas.viewMode.v2', 'document');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:canvas-table'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  it('switches between document and Markdown views from the same source', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-document-view')).toHaveTextContent(
      'Company Work Note'
    );
    expect(screen.queryByText('Canvas')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Canvas document title')).toHaveValue('Company Work Note');
    expect(screen.getByTestId('canvas-workspace-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-output-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-file-actions')).toBeInTheDocument();
    expect(screen.queryByText('Start pracy')).not.toBeInTheDocument();

    // The view toggle, capability badges and starter templates now live inside
    // the Canvas menu (the "Canvas menu" / MoreHorizontal control).
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    expect(await screen.findByTestId('canvas-view-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-template-capability-document')).toHaveTextContent('Real');
    expect(screen.getByTestId('canvas-template-capability-research')).toHaveTextContent('Partial');

    await switchView(user, 'Markdown view');

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Company Work Note');
    expect(mdView.value).not.toContain('{"');
  });

  it('shows capability honesty labels for the active Canvas and workflow template', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));

    expect(await screen.findByTestId('canvas-capability-status')).toHaveTextContent('Real');
    expect(screen.getByTestId('canvas-capability-note')).toHaveTextContent(
      'Markdown document, autosave, versions, export and Teresa context are backed.'
    );
    expect(screen.getByTestId('canvas-workflow-capability-status')).toHaveTextContent('Partial');
    expect(screen.getByText(/ResearchSession planning linkage is backed/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Workflow template'), 'decision_memo_to_execution_plan');
    expect(screen.getByTestId('canvas-workflow-capability-status')).toHaveTextContent('Real');
    expect(screen.getByText(/approval gate and output lineage are backed/i)).toBeInTheDocument();
  });

  it('links a research Canvas draft to a planned ResearchSession', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/research/sessions') {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          mission: 'Market Research Brief',
          conversationId: 'conv-1',
          expectedOutput: 'research_report',
        });
        return {
          ok: true,
          json: async () => ({
            success: true,
            session: {
              sessionId: 'rs-canvas-1',
              status: 'planned',
              mission: 'Market Research Brief',
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts') {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          conversationId: 'conv-1',
          kind: 'research',
          title: 'Market Research Brief',
          researchSessionId: 'rs-canvas-1',
        });
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-research-1',
              title: 'Market Research Brief',
              kind: 'research',
              contentMd: body.contentMd,
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
              researchSessionId: 'rs-canvas-1',
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /New Canvas/i }));
    await user.click(screen.getByRole('button', { name: /Zrób research/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/research/sessions', expect.any(Object)));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    expect(await screen.findByTestId('canvas-research-session-id')).toHaveTextContent('rs-canvas-1');
  });

  it('exports the active Canvas as Markdown, CSV and metadata JSON', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts' && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        } as Response;
      }
      if (String(url).includes('/api/work-canvas/drafts/draft-1/export')) {
        return {
          ok: true,
          headers: new Headers({ 'content-disposition': 'attachment; filename="canvas.md"' }),
          blob: async () => new Blob(['exported canvas']),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel />);

    // Export actions now live inside the Canvas menu, renamed to "Download …".
    await user.click(await screen.findByRole('button', { name: /Canvas menu/i }));
    await user.click(await screen.findByRole('button', { name: 'Download Markdown' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/export?format=markdown',
        expect.any(Object)
      )
    );
    await user.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/export?format=csv',
        expect.any(Object)
      )
    );
    await user.click(screen.getByRole('button', { name: 'Export metadata' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/export?format=json',
        expect.any(Object)
      );
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('renders GFM tables and checkboxes without raw Markdown bullets as the document UI', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByText('Define the business question.')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /New Canvas/i }));
    await user.click(await screen.findByRole('button', { name: /Zrób research/i }));

    expect(await screen.findByRole('columnheader', { name: 'Dimension' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Definition' })).toBeInTheDocument();
    expect(screen.getByTestId('canvas-document-view')).not.toHaveTextContent('{"');
  });

  it('renders native table, chart and diagram artifact blocks with business actions', async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });
    render(
      <WorkCanvasDocumentPanel
        initialBlocks={[
          {
            id: 'table-1',
            kind: 'table',
            schemaVersion: 'canvas-block/v1',
            title: 'Risk Register',
            status: 'ready',
            capabilities: ['view', 'sort', 'filter', 'export'],
            data: {
              columns: ['Risk', 'Owner', 'Impact'],
              rows: [
                { Risk: 'Supply delay', Owner: 'Ops', Impact: 'High' },
                { Risk: 'Scope drift', Owner: 'PMO', Impact: 'Medium' },
              ],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjection: '### Risk Register\n\n| Risk | Owner | Impact |\n|---|---|---|',
            markdownProjectionStatus: 'synced',
          },
          {
            id: 'chart-1',
            kind: 'chart',
            schemaVersion: 'canvas-block/v1',
            title: 'Impact Summary',
            status: 'ready',
            capabilities: ['view'],
            data: {
              spec: {
                mark: 'bar',
                encoding: { x: { field: 'Impact' }, y: { field: 'Count' } },
              },
              metrics: [
                { label: 'High', value: 3 },
                { label: 'Medium', value: 1 },
              ],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjection: '### Impact Summary\n\n- High: 3\n- Medium: 1',
            markdownProjectionStatus: 'synced',
          },
          {
            id: 'diagram-1',
            kind: 'diagram',
            schemaVersion: 'canvas-block/v1',
            title: 'Approval Flow',
            status: 'ready',
            capabilities: ['view'],
            data: {
              mermaid: 'flowchart LR\n  draft[Draft] --> approve[Approve]',
              nodes: [
                { id: 'draft', label: 'Draft' },
                { id: 'approve', label: 'Approve' },
              ],
              edges: [{ from: 'draft', to: 'approve', label: 'review' }],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjection: '### Approval Flow\n\nNodes: 2\nConnections: 1',
            markdownProjectionStatus: 'synced',
          },
          {
            id: 'research-1',
            kind: 'research',
            schemaVersion: 'canvas-block/v1',
            title: 'Market Evidence',
            status: 'ready',
            capabilities: ['view'],
            data: {
              question: 'Which market risk matters most?',
              confidence: 'medium',
              findings: ['Buyers require proof of integration readiness.'],
              sources: [],
              gaps: ['Need customer interviews.'],
              recommendations: ['Run validation interviews before committing roadmap.'],
            },
            provenance: { source: 'assistant', conversationId: 'conv-1' },
            markdownProjection: '### Market Evidence\n\nConfidence: medium',
            markdownProjectionStatus: 'synced',
          },
        ]}
      />
    );

    expect(await screen.findByTestId('canvas-artifact-blocks')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-artifact-block-table-1')).toHaveTextContent('Risk Register');
    expect(screen.getByRole('columnheader', { name: /Risk/ })).toBeInTheDocument();
    expect(screen.getByText('Supply delay')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-artifact-block-chart-1')).toHaveTextContent('Impact Summary');
    expect(screen.getByTestId('canvas-artifact-block-chart-1')).toHaveTextContent(
      'Vega-Lite runtime'
    );
    expect(screen.getByTestId('canvas-vega-render-chart-1')).toBeInTheDocument();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);
    expect(screen.getByTestId('canvas-artifact-block-diagram-1')).toHaveTextContent(
      'Approval Flow'
    );
    expect(screen.getByTestId('canvas-artifact-block-diagram-1')).toHaveTextContent(
      'Mermaid diagram source'
    );
    expect(screen.getByText('draft → approve')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-artifact-block-research-1')).toHaveTextContent(
      'Evidence degraded: no sources are attached to this research block yet.'
    );
    expect(screen.getByTestId('canvas-artifact-block-research-1')).toHaveTextContent(
      'Need customer interviews.'
    );

    await user.type(screen.getByLabelText('Filter Risk Register'), 'scope');
    expect(screen.queryByText('Supply delay')).not.toBeInTheDocument();
    expect(screen.getByText('Scope drift')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Filter Risk Register'));
    const impactSortButton = screen.getByRole('button', { name: /Impact/ });
    await user.click(impactSortButton);
    await user.click(impactSortButton);
    expect(impactSortButton).toHaveTextContent('↓');
    await user.click(screen.getByLabelText('Select row 1'));
    await user.click(screen.getByRole('button', { name: 'Export selected' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
      'Risk Register selected rows exported as CSV.'
    );
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByText('2 rows · 0 selected')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('Risk Register'));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Risk Register copied as Markdown.'
    );

    await user.click(screen.getByRole('button', { name: 'CSV' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
      'Risk Register exported as CSV.'
    );

    await user.click(screen.getByRole('button', { name: 'Copy source' }));
    expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('flowchart LR'));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Approval Flow diagram source copied.'
    );

    await user.click(screen.getByRole('button', { name: 'Export diagram' }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
      'Approval Flow diagram source exported.'
    );
  });

  it('finalizes research report from diagnostics with lineage feedback', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts?conversationId=conv-1') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'draft-research-1',
                title: 'Research brief',
                kind: 'research',
                contentMd: '# Research brief',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                blocks: [
                  {
                    id: 'research-block-1',
                    kind: 'research',
                    schemaVersion: 'canvas-block/v1',
                    title: 'Evidence block',
                    status: 'ready',
                    capabilities: ['view'],
                    data: {
                      question: 'What changed in the market?',
                      findings: ['Demand rising'],
                      sources: ['Interview transcript'],
                      confidence: 'high',
                    },
                    provenance: { source: 'assistant', conversationId: 'conv-1' },
                    markdownProjection: '### Evidence block',
                    markdownProjectionStatus: 'synced',
                  },
                ],
              },
            ],
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-research-1/research/finalize-report') {
        expect(init?.method).toBe('POST');
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-research-1',
                title: 'Research brief',
                kind: 'research',
                contentMd: '# Research brief',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
              reportResource: {
                type: 'report',
                id: 'report-draft-1',
                title: 'Report: Research brief',
                url: '/work-canvas?draftId=report-draft-1',
              },
              readBack: {
                target: 'research_final_report',
                status: 'promotion_recorded',
                evidenceSummary: [{ blockId: 'research-block-1' }],
              },
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    await user.click(screen.getByRole('button', { name: 'Finalize research report' }));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Research final report recorded (report-draft-1) with 1 evidence block.'
    );
  });

  it('turns selected Canvas text into native artifact blocks', async () => {
    const user = userEvent.setup();
    const generatedBlocks: any[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note\n\n- [ ] Define the business question.',
              blocks: generatedBlocks,
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        const kind = body.operation.kind;
        if (body.previewOnly) {
          expect(body.operation.approved).toBeUndefined();
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                draft: {
                  id: 'draft-1',
                  title: 'Company Work Note',
                  contentMd: '# Company Work Note\n\n- [ ] Define the business question.',
                  blocks: generatedBlocks,
                  saveState: 'saved',
                  lifecycleState: 'draft',
                  markdownProjectionStatus: 'synced',
                },
                preview: {
                  proposedChange: `Create ${kind}`,
                  affectedBlocks: [`${kind}-from-selection`],
                  markdownDiff: {
                    addedLines: 0,
                    removedLines: 0,
                    summary: '0 lines added, 0 lines removed',
                  },
                  approvalRequired: true,
                  validationResult: { status: 'passed', message: 'Preview validated' },
                },
              },
            }),
          };
        }
        expect(body.operation.approved).toBe(true);
        generatedBlocks.push({
          id: `${kind}-from-selection`,
          kind,
          schemaVersion: 'canvas-block/v1',
          title: body.operation.title,
          status: 'draft',
          capabilities: kind === 'table' ? ['view', 'sort', 'filter', 'export'] : ['view'],
          data:
            kind === 'table'
              ? {
                  columns: ['Item', 'Source'],
                  rows: [{ Item: 'Define the business question.', Source: 'Canvas selection' }],
                }
              : kind === 'chart'
                ? { metrics: [{ label: 'Define the business question.', value: 1 }] }
                : kind === 'diagram'
                  ? {
                      nodes: [{ id: 'step-1', label: 'Define the business question.' }],
                      edges: [],
                    }
                  : kind === 'research'
                    ? {
                        question: 'Define the business question.',
                        findings: ['Define the business question.'],
                        sources: ['Canvas selection'],
                        confidence: 'medium',
                        gaps: ['Needs source validation'],
                        recommendations: ['Validate findings before making a durable decision'],
                      }
                    : {
                        question: 'Define the business question.',
                        options: [{ label: 'Define the business question.', score: 1 }],
                        criteria: ['Business impact'],
                        risks: ['Needs owner review before approval'],
                        assumptions: ['Generated from selected Canvas text'],
                        recommendation: 'Define the business question.',
                        approvalStatus: 'draft',
                      },
          provenance: { source: 'user', conversationId: 'conv-1', draftId: 'draft-1' },
          markdownProjection: `### ${body.operation.title}\n\nDefine the business question.`,
          markdownProjectionStatus: 'synced',
        });
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note\n\n- [ ] Define the business question.',
                blocks: generatedBlocks,
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
              diff: { addedLines: 0, removedLines: 0, summary: '0 lines added, 0 lines removed' },
              preview: {
                proposedChange: `Create ${kind}`,
                affectedBlocks: [`${kind}-from-selection`],
                approvalRequired: true,
              },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions') {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    const selected = 'Define the business question.';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    const blockActions = await screen.findByTestId('canvas-selection-block-actions');
    expect(blockActions).toBeInTheDocument();
    await user.click(within(blockActions).getByRole('button', { name: 'Create table' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent('Create table');
    await user.click(screen.getByRole('button', { name: /Apply Table from selection/i }));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Table from selection created from selected Canvas text.'
    );

    await user.click(within(blockActions).getByRole('button', { name: 'Create chart' }));
    await user.click(await screen.findByRole('button', { name: /Apply Chart from selection/i }));
    await user.click(within(blockActions).getByRole('button', { name: 'Create diagram' }));
    await user.click(await screen.findByRole('button', { name: /Apply Diagram from selection/i }));
    await user.click(within(blockActions).getByRole('button', { name: 'Create research' }));
    await user.click(await screen.findByRole('button', { name: /Apply Research from selection/i }));
    await user.click(within(blockActions).getByRole('button', { name: 'Create decision' }));
    await user.click(await screen.findByRole('button', { name: /Apply Decision from selection/i }));
    await switchView(user, 'Dock view');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/work-canvas/drafts/draft-1/operations',
      expect.objectContaining({ method: 'POST' })
    );
    expect(await screen.findByTestId('canvas-artifact-blocks')).toBeInTheDocument();
    expect(screen.getByText('Table from selection')).toBeInTheDocument();
    expect(screen.getByText('Chart from selection')).toBeInTheDocument();
    expect(screen.getByText('Diagram from selection')).toBeInTheDocument();
    expect(screen.getByText('Research from selection')).toBeInTheDocument();
    expect(screen.getByText('Decision from selection')).toBeInTheDocument();
    expect(screen.getByText(/Confidence:/)).toHaveTextContent('medium');
    expect(screen.getByText(/Approval status:/)).toHaveTextContent('draft');
    expect(screen.getAllByText('Define the business question.').length).toBeGreaterThan(1);
  });

  it('previews and applies a governed edit for selected Canvas text', async () => {
    const user = userEvent.setup();
    const originalContent = '# Company Work Note\n\n- [ ] Define the business question.';
    const replacement = '- [x] Define the business question and decision owner.';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: originalContent,
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
              updatedAt: '2026-05-03T19:00:00.000Z',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        expect(body.operation.type).toBe('replace_selection');
        expect(body.operation.selectedText).toBe('Define the business question.');
        expect(body.operation.replacementMd).toBe(replacement);
        if (body.previewOnly) {
          expect(body.operation.approved).toBeUndefined();
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                preview: {
                  proposedChange: 'Replace selected Canvas text',
                  affectedBlocks: [],
                  markdownDiff: {
                    addedLines: 1,
                    removedLines: 1,
                    summary: '1 line added, 1 line removed',
                    addedLineSamples: [replacement],
                    removedLineSamples: ['- [ ] Define the business question.'],
                  },
                  approvalRequired: false,
                },
              },
            }),
          };
        }
        expect(body.operation.approved).toBe(true);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: originalContent.replace('Define the business question.', replacement),
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                updatedAt: '2026-05-03T19:01:00.000Z',
              },
              diff: { addedLines: 1, removedLines: 1, summary: '1 line added, 1 line removed' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions') {
        return { ok: true, json: async () => ({ success: true, data: [] }) };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    const selected = 'Define the business question.';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    expect(await screen.findByTestId('canvas-selection-edit-panel')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Selection edit replacement'), {
      target: { value: replacement },
    });
    await user.click(screen.getByRole('button', { name: 'Preview edit' }));

    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Replace selected Canvas text'
    );
    expect(screen.getByTestId('canvas-operation-preview')).toHaveTextContent(
      '1 lines added, 1 lines removed'
    );
    expect(screen.getByTestId('canvas-operation-diff-preview')).toHaveTextContent(
      '- [ ] Define the business question.'
    );
    expect(screen.getByTestId('canvas-operation-diff-preview')).toHaveTextContent(replacement);

    await user.click(screen.getByRole('button', { name: 'Revise edit' }));
    await waitFor(() => expect(screen.queryByTestId('canvas-operation-preview')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Selection edit replacement')).toHaveValue(replacement);
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
      'Selection edit reopened'
    );

    await user.click(screen.getByRole('button', { name: 'Preview edit' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Replace selected Canvas text'
    );

    await user.click(screen.getByRole('button', { name: 'Apply edit suggestion' }));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Selection edit applied.'
    );
    expect((screen.getByTestId('canvas-md-view') as HTMLTextAreaElement).value).toContain(
      replacement
    );
  });

  it('uses writing shortcuts to draft replacement Markdown without bypassing preview', async () => {
    const user = userEvent.setup();
    const originalContent = '# Company Work Note\n\n- [ ] Define the business question.';
    const replacement = '- [ ] Define the business question';
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: originalContent,
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
              updatedAt: '2026-05-03T19:10:00.000Z',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        expect(body.previewOnly).toBe(true);
        expect(body.operation.type).toBe('replace_selection');
        expect(body.operation.selectedText).toBe('Define the business question.');
        expect(body.operation.replacementMd).toBe(replacement);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              preview: {
                proposedChange: 'Replace selected Canvas text',
                affectedBlocks: [],
                markdownDiff: {
                  addedLines: 1,
                  removedLines: 1,
                  summary: '1 line added, 1 line removed',
                  addedLineSamples: ['- [ ] Define the business question'],
                  removedLineSamples: ['Define the business question.'],
                },
                approvalRequired: false,
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    const selected = 'Define the business question.';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    const shortcuts = await screen.findByTestId('canvas-selection-writing-shortcuts');
    await user.click(within(shortcuts).getByRole('button', { name: 'Action list' }));

    expect(screen.getByLabelText('Selection edit replacement')).toHaveValue(replacement);
    expect(screen.queryByTestId('canvas-operation-preview')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Preview edit' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Replace selected Canvas text'
    );
    expect(screen.getByTestId('canvas-operation-diff-preview')).toHaveTextContent(
      '- [ ] Define the business question'
    );
  });

  it('turns an uploaded CSV dataset into a KPI dashboard block', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        expect(body.operation.type).toBe('generate_artifact_from_dataset');
        expect(body.operation.artifactKind).toBe('dashboard');
        expect(body.operation.dataset.filename).toBe('pipeline.csv');
        if (body.previewOnly) {
          expect(body.operation.approved).toBeUndefined();
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                draft: {
                  id: 'draft-1',
                  title: 'Company Work Note',
                  contentMd: '# Company Work Note',
                  blocks: [],
                  saveState: 'saved',
                  lifecycleState: 'draft',
                  markdownProjectionStatus: 'synced',
                },
                preview: {
                  proposedChange: 'Create dashboard block "KPI Dashboard: pipeline.csv"',
                  affectedBlocks: ['dashboard-1'],
                  markdownDiff: {
                    addedLines: 0,
                    removedLines: 0,
                    summary: '0 lines added, 0 lines removed',
                  },
                  approvalRequired: true,
                  validationResult: { status: 'passed', message: 'Preview validated' },
                },
              },
            }),
          };
        }
        expect(body.operation.approved).toBe(true);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [
                  {
                    id: 'dashboard-1',
                    kind: 'dashboard',
                    schemaVersion: 'canvas-block/v1',
                    title: 'KPI Dashboard: pipeline.csv',
                    status: 'ready',
                    capabilities: ['view', 'export', 'convert'],
                    data: {
                      kpis: [
                        { label: 'Rows', value: 3 },
                        { label: 'Columns', value: 3 },
                      ],
                      charts: [
                        {
                          title: 'Revenue preview',
                          metrics: [
                            { label: 'Qualified', value: 100 },
                            { label: 'Won', value: 400 },
                          ],
                        },
                      ],
                      insights: ['Dataset "pipeline.csv" has 3 rows and 3 columns.'],
                      recommendedActions: ['Validate column meanings with the business owner.'],
                      limitations: [
                        'Stage 7 uses deterministic server-side profiling only; no arbitrary code execution was run.',
                      ],
                    },
                    provenance: {
                      source: 'import',
                      conversationId: 'conv-1',
                      draftId: 'draft-1',
                      filename: 'pipeline.csv',
                    },
                    markdownProjection:
                      '### KPI Dashboard: pipeline.csv\n\nKPIs:\n- Rows: 3\n\nData limitations:\n- Stage 7 uses deterministic server-side profiling only; no arbitrary code execution was run.',
                    markdownProjectionStatus: 'synced',
                  },
                ],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');

    const file = new File(['Stage,Revenue,Owner\nQualified,100,Ada\nWon,400,Ada'], 'pipeline.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn(async () => 'Stage,Revenue,Owner\nQualified,100,Ada\nWon,400,Ada'),
    });
    const upload = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(upload, file);

    const datasetActions = await screen.findByTestId('canvas-dataset-actions');
    expect(datasetActions).toHaveTextContent('Dataset ready: pipeline.csv');

    await user.click(within(datasetActions).getByRole('button', { name: 'KPI dashboard' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Create dashboard block'
    );
    await user.click(screen.getByRole('button', { name: /Apply dashboard/i }));

    expect(await screen.findByTestId('canvas-artifact-block-dashboard-1')).toHaveTextContent(
      'KPI Dashboard: pipeline.csv'
    );
    expect(screen.getByText('Rows')).toBeInTheDocument();
    expect(screen.getByText('Data limitations')).toBeInTheDocument();
    expect(screen.getByText(/no arbitrary code execution/i)).toBeInTheDocument();
  });

  it('turns an uploaded XLSX dataset into a governed dashboard preview', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        expect(body.operation.type).toBe('generate_artifact_from_dataset');
        expect(body.operation.artifactKind).toBe('dashboard');
        expect(body.operation.dataset.filename).toBe('pipeline.xlsx');
        expect(body.operation.dataset.format).toBe('xlsx');
        expect(body.operation.dataset.content).toBe('AQIDBA==');
        if (body.previewOnly) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                draft: {
                  id: 'draft-1',
                  title: 'Company Work Note',
                  contentMd: '# Company Work Note',
                  blocks: [],
                  saveState: 'saved',
                  lifecycleState: 'draft',
                  markdownProjectionStatus: 'synced',
                },
                preview: {
                  proposedChange: 'Create dashboard block "KPI Dashboard: pipeline.xlsx"',
                  affectedBlocks: ['dashboard-xlsx'],
                  markdownDiff: {
                    addedLines: 0,
                    removedLines: 0,
                    summary: '0 lines added, 0 lines removed',
                  },
                  approvalRequired: true,
                  validationResult: { status: 'passed', message: 'Preview validated' },
                },
              },
            }),
          };
        }
        expect(body.operation.approved).toBe(true);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [
                  {
                    id: 'dashboard-xlsx',
                    kind: 'dashboard',
                    schemaVersion: 'canvas-block/v1',
                    title: 'KPI Dashboard: pipeline.xlsx',
                    status: 'ready',
                    capabilities: ['view', 'export', 'convert'],
                    data: {
                      kpis: [{ label: 'Rows', value: 2 }],
                      insights: ['Dataset "pipeline.xlsx" has 2 rows and 3 columns.'],
                      limitations: [
                        'Stage 7 uses deterministic server-side profiling only; no arbitrary code execution was run.',
                      ],
                    },
                    provenance: {
                      source: 'import',
                      conversationId: 'conv-1',
                      draftId: 'draft-1',
                      filename: 'pipeline.xlsx',
                    },
                    markdownProjection: '### KPI Dashboard: pipeline.xlsx',
                    markdownProjectionStatus: 'synced',
                  },
                ],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'pipeline.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: vi.fn(async () => new Uint8Array([1, 2, 3, 4]).buffer),
    });
    const upload = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(upload, file);

    const datasetActions = await screen.findByTestId('canvas-dataset-actions');
    expect(datasetActions).toHaveTextContent('Dataset ready: pipeline.xlsx');

    await user.click(within(datasetActions).getByRole('button', { name: 'KPI dashboard' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Create dashboard block'
    );
    await user.click(screen.getByRole('button', { name: /Apply dashboard/i }));

    expect(await screen.findByTestId('canvas-artifact-block-dashboard-xlsx')).toHaveTextContent(
      'KPI Dashboard: pipeline.xlsx'
    );
  });

  it('creates an aggregate analysis chart from an uploaded dataset through approval preview', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/operations') {
        const body = JSON.parse(String(init?.body));
        expect(body.operation.type).toBe('generate_artifact_from_dataset');
        expect(body.operation.artifactKind).toBe('chart');
        expect(body.operation.analysis).toEqual({ kind: 'aggregate_numeric' });
        expect(body.operation.dataset.filename).toBe('pipeline.csv');
        if (body.previewOnly) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                draft: {
                  id: 'draft-1',
                  title: 'Company Work Note',
                  contentMd: '# Company Work Note',
                  blocks: [],
                  saveState: 'saved',
                  lifecycleState: 'draft',
                  markdownProjectionStatus: 'synced',
                },
                preview: {
                  proposedChange: 'Create chart block "Aggregate Chart: pipeline.csv"',
                  affectedBlocks: ['aggregate-chart'],
                  markdownDiff: {
                    addedLines: 0,
                    removedLines: 0,
                    summary: '0 lines added, 0 lines removed',
                  },
                  approvalRequired: true,
                  validationResult: { status: 'passed', message: 'Preview validated' },
                },
              },
            }),
          };
        }
        expect(body.operation.approved).toBe(true);
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [
                  {
                    id: 'aggregate-chart',
                    kind: 'chart',
                    schemaVersion: 'canvas-block/v1',
                    title: 'Aggregate Chart: pipeline.csv',
                    status: 'ready',
                    capabilities: ['view', 'export', 'convert'],
                    data: {
                      chartType: 'bar',
                      insight: 'Quick distribution for Revenue total.',
                      analysis: 'Aggregated Revenue by Owner.',
                      metrics: [
                        { label: 'Ada', value: 500 },
                        { label: 'Tom', value: 250 },
                      ],
                    },
                    provenance: {
                      source: 'import',
                      conversationId: 'conv-1',
                      draftId: 'draft-1',
                      filename: 'pipeline.csv',
                      analysisKind: 'aggregate_numeric',
                    },
                    markdownProjection: '### Aggregate Chart: pipeline.csv',
                    markdownProjectionStatus: 'synced',
                  },
                ],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');

    const file = new File(['Owner,Revenue\nAda,100\nTom,250\nAda,400'], 'pipeline.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn(async () => 'Owner,Revenue\nAda,100\nTom,250\nAda,400'),
    });
    const upload = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(upload, file);

    const datasetActions = await screen.findByTestId('canvas-dataset-actions');
    await user.click(within(datasetActions).getByRole('button', { name: 'Aggregate chart' }));
    expect(await screen.findByTestId('canvas-operation-preview')).toHaveTextContent(
      'Create chart block'
    );
    await user.click(screen.getByRole('button', { name: /Apply Aggregate Chart/i }));

    expect(await screen.findByTestId('canvas-artifact-block-aggregate-chart')).toHaveTextContent(
      'Aggregate Chart: pipeline.csv'
    );
    expect(screen.getByTestId('canvas-artifact-block-aggregate-chart')).toHaveTextContent('Ada');
  });

  it('starts and resumes a governed workflow from Canvas diagnostics', async () => {
    const user = userEvent.setup();
    const workflowRun = {
      id: 'workflow-1',
      draftId: 'draft-1',
      conversationId: 'conv-1',
      template: 'market_research_to_report',
      title: 'Market research to report',
      status: 'active',
      steps: [
        {
          id: 'step-1',
          kind: 'teresa_action',
          title: 'Frame the workflow',
          summary: 'Prepare workflow',
          status: 'completed',
          createdAt: '2026-05-03T00:00:00.000Z',
        },
        {
          id: 'step-2',
          kind: 'user_approval',
          title: 'Approval checkpoint',
          summary: 'Approve before durable output',
          status: 'pending',
          approvalRequired: true,
          createdAt: '2026-05-03T00:00:00.000Z',
        },
      ],
      approvals: [{ stepId: 'step-2', status: 'pending', requiredCapability: 'approve' }],
      outputs: [],
      events: [
        {
          id: 'event-1',
          type: 'created',
          actorId: 'user-1',
          summary: 'Workflow created from template: Market research to report.',
          createdAt: '2026-05-03T00:00:00.000Z',
        },
        {
          id: 'event-2',
          type: 'approval_required',
          actorId: 'user-1',
          summary: 'Workflow requires approval before durable output creation.',
          createdAt: '2026-05-03T00:00:00.000Z',
        },
      ],
      createdBy: 'user-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
    };
    let reviewGateActive = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows') {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ baseUpdatedAt: null, template: 'client_proposal_to_deck' });
        const selectedWorkflowRun = {
          ...workflowRun,
          template: 'client_proposal_to_deck',
          title: 'Client proposal to deck',
          steps: [
            {
              id: 'step-1',
              kind: 'teresa_action',
              title: 'Extract proposal storyline',
              summary: 'Identify client problem and proof points.',
              status: 'completed',
              createdAt: '2026-05-03T00:00:00.000Z',
            },
            {
              id: 'step-2',
              kind: 'user_approval',
              title: 'Approve deck outline',
              summary: 'Approve before durable deck output.',
              status: 'pending',
              approvalRequired: true,
              createdAt: '2026-05-03T00:00:00.000Z',
            },
          ],
          events: [
            ...workflowRun.events,
            {
              id: 'event-3',
              type: 'created',
              actorId: 'user-1',
              summary: 'Workflow created from template: Client proposal to deck.',
              createdAt: '2026-05-03T00:00:00.000Z',
            },
          ],
        };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [selectedWorkflowRun] },
              },
              workflowRun: selectedWorkflowRun,
              readBack: { status: 'created' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/resume') {
        const resumed = {
          ...workflowRun,
          steps: [
            ...workflowRun.steps,
            {
              id: 'step-3',
              kind: 'teresa_action',
              title: 'Resume workflow',
              summary: 'User resumed workflow from Canvas diagnostics.',
              status: 'completed',
              createdAt: '2026-05-03T00:01:00.000Z',
            },
          ],
        };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [resumed] },
              },
              workflowRun: resumed,
              readBack: { status: 'resumed' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/run-next') {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ baseUpdatedAt: null, approved: true });
        if (reviewGateActive) {
          const payload = {
            error: 'Workflow review lifecycle must be approved before generating a durable output',
            code: 'CANVAS_WORKFLOW_REVIEW_REQUIRED',
            recoverable: true,
            data: {
              workflowRunId: 'workflow-1',
              lifecycle: 'in_review',
              reviewerId: 'reviewer-1',
            },
          };
          return {
            ok: false,
            status: 409,
            statusText: 'Conflict',
            url: '/api/work-canvas/drafts/draft-1/workflows/workflow-1/run-next',
            clone: () => ({ json: async () => payload }),
            json: async () => payload,
            text: async () => JSON.stringify(payload),
          };
        }
        const completed = {
          ...workflowRun,
          status: 'completed',
          steps: workflowRun.steps.map((step) =>
            step.id === 'step-2'
              ? { ...step, status: 'completed', approvedAt: '2026-05-03T00:02:00.000Z' }
              : step
          ),
          approvals: [{ stepId: 'step-2', status: 'approved', requiredCapability: 'approve' }],
          outputs: [
            {
              stepId: 'step-2',
              type: 'report',
              id: 'report-1',
              title: 'Report: Company Work Note',
              url: '/work-canvas?draftId=report-1',
            },
          ],
          events: [
            ...workflowRun.events,
            {
              id: 'event-4',
              type: 'approved',
              actorId: 'user-1',
              summary: 'Approved workflow checkpoint for Client proposal to deck.',
              createdAt: '2026-05-03T00:02:00.000Z',
            },
            {
              id: 'event-5',
              type: 'output_created',
              actorId: 'user-1',
              summary: 'Created report output: Report: Company Work Note.',
              createdAt: '2026-05-03T00:02:00.000Z',
            },
          ],
        };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [completed] },
              },
              workflowRun: completed,
              outputResource: {
                type: 'report',
                id: 'report-1',
                title: 'Report: Company Work Note',
                url: '/work-canvas?draftId=report-1',
              },
              readBack: { status: 'completed' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/collaboration') {
        const body = JSON.parse(String(init?.body));
        expect(init?.method).toBe('PATCH');
        expect(body).toMatchObject({ reviewerId: 'reviewer-1', lifecycle: 'in_review' });
        reviewGateActive = true;
        const reviewed = {
          ...workflowRun,
          collaboration: {
            ownerId: 'user-1',
            reviewerId: 'reviewer-1',
            lifecycle: 'in_review',
            comments: [],
          },
          events: [
            ...workflowRun.events,
            {
              id: 'event-6',
              type: 'collaboration_updated',
              actorId: 'user-1',
              summary: 'Workflow review metadata updated to in_review.',
              createdAt: '2026-05-03T00:03:00.000Z',
            },
          ],
        };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [reviewed] },
              },
              workflowRun: reviewed,
              readBack: { status: 'updated' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/comments') {
        const body = JSON.parse(String(init?.body));
        expect(init?.method).toBe('POST');
        expect(body).toMatchObject({ baseUpdatedAt: null, body: 'Check assumptions' });
        const commented = {
          ...workflowRun,
          collaboration: {
            ownerId: 'user-1',
            reviewerId: 'reviewer-1',
            lifecycle: 'in_review',
            comments: [
              {
                id: 'comment-1',
                authorId: 'user-1',
                body: 'Check assumptions',
                createdAt: '2026-05-03T00:03:00.000Z',
              },
            ],
          },
          events: [
            ...workflowRun.events,
            {
              id: 'event-7',
              type: 'comment_added',
              actorId: 'user-1',
              summary: 'Workflow comment added.',
              createdAt: '2026-05-03T00:04:00.000Z',
            },
          ],
        };
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [commented] },
              },
              workflowRun: commented,
              comment: commented.collaboration.comments[0],
              readBack: { status: 'commented' },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Canvas menu' }));
    await user.selectOptions(screen.getByLabelText('Workflow template'), 'client_proposal_to_deck');
    expect(
      screen.getByText('Proposal storyline, deck outline and presentation output.')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start workflow' }));

    const ledger = await screen.findByTestId('canvas-workflow-ledger');
    expect(ledger).toHaveTextContent('Client proposal to deck');
    expect(ledger).toHaveTextContent('Extract proposal storyline');
    expect(ledger).toHaveTextContent('approval required');
    expect(ledger).toHaveTextContent('Timeline');
    expect(ledger).toHaveTextContent('Workflow created from template: Client proposal to deck.');
    expect(ledger).toHaveTextContent(
      'Approval checkpoint: Approve deck outline awaits explicit approval.'
    );

    await user.click(within(ledger).getByRole('button', { name: 'Approve and run' }));
    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Workflow output created: Report: Company Work Note. report-1'
    );
    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Created report output: Report: Company Work Note.'
    );
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent('Outputs');
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Report: Company Work Note'
    );
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/work-canvas?draftId=report-1'
    );
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Workflow completed: output is available in the ledger.'
    );
    expect(screen.getByRole('button', { name: 'Completed' })).toBeDisabled();

    await user.click(within(ledger).getByRole('button', { name: 'Resume' }));
    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Resume workflow'
    );

    await user.type(screen.getByLabelText('Reviewer for Market research to report'), 'reviewer-1');
    await user.click(screen.getByRole('button', { name: 'Send to review' }));
    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Reviewer: reviewer-1'
    );
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent('Lifecycle: in_review');
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Review gate: mark approved before running next.'
    );
    expect(screen.getByRole('button', { name: 'Approve and run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send to review' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mark approved' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeDisabled();

    await user.type(
      screen.getByLabelText('Comment for Market research to report'),
      'Check assumptions'
    );
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'user-1: Check assumptions'
    );
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Workflow comment added.'
    );
  });

  it('disables workflow creation while start workflow is in flight', async () => {
    const user = userEvent.setup();
    const workflowRun = {
      id: 'workflow-1',
      draftId: 'draft-1',
      conversationId: 'conv-1',
      template: 'market_research_to_report',
      title: 'Market research to report',
      status: 'active',
      steps: [],
      approvals: [],
      outputs: [],
      events: [],
      createdBy: 'user-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
    };
    let resolveCreateWorkflow: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts?conversationId=conv-1') {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            ],
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows') {
        return new Promise<Response>((resolve) => {
          resolveCreateWorkflow = resolve;
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Canvas menu' }));
    await user.click(screen.getByRole('button', { name: 'Start workflow' }));

    const startingButton = await screen.findByRole('button', { name: 'Starting...' });
    expect(startingButton).toBeDisabled();
    fireEvent.click(startingButton);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    resolveCreateWorkflow?.({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          draft: {
            id: 'draft-1',
            title: 'Company Work Note',
            contentMd: '# Company Work Note',
            blocks: [],
            saveState: 'saved',
            lifecycleState: 'draft',
            markdownProjectionStatus: 'synced',
            provenance: { workflowRuns: [workflowRun] },
          },
          workflowRun,
          readBack: { status: 'created' },
        },
      }),
    } as Response);
    expect(await screen.findByText('Market research to report')).toBeInTheDocument();
  });

  it('shows friendly conflict copy when starting a workflow from a stale draft', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows') {
        const payload = {
          error: 'Canvas draft changed since the request started',
          code: 'CANVAS_DRAFT_CONFLICT',
          recoverable: true,
        };
        return {
          ok: false,
          status: 409,
          statusText: 'Conflict',
          url: '/api/work-canvas/drafts/draft-1/workflows',
          clone: () => ({ json: async () => payload }),
          json: async () => payload,
          text: async () => JSON.stringify(payload),
        } as unknown as Response;
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Canvas menu' }));
    await user.click(screen.getByRole('button', { name: 'Start workflow' }));

    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Canvas changed elsewhere. Your local edits are still visible. Reload latest or retry from the current draft before applying this action.'
    );
    expect(screen.getByRole('button', { name: 'Start workflow' })).toBeEnabled();
  });

  it('preserves an existing workflow reviewer when approving without editing the reviewer field', async () => {
    const user = userEvent.setup();
    const workflowRun = {
      id: 'workflow-1',
      draftId: 'draft-1',
      conversationId: 'conv-1',
      template: 'market_research_to_report',
      title: 'Market research to report',
      status: 'active',
      steps: [],
      approvals: [],
      outputs: [],
      events: [],
      collaboration: {
        ownerId: 'user-1',
        reviewerId: 'reviewer-1',
        lifecycle: 'in_review',
        comments: [],
      },
      createdBy: 'user-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
    };
    let resolveCollaboration: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              blocks: [],
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [workflowRun] },
              },
              workflowRun,
              readBack: { status: 'created' },
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/collaboration') {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ reviewerId: 'reviewer-1', lifecycle: 'approved' });
        const approved = {
          ...workflowRun,
          collaboration: {
            ...workflowRun.collaboration,
            lifecycle: 'approved',
          },
        };
        return new Promise<Response>((resolve) => {
          resolveCollaboration = resolve;
        }).then(
          () =>
            ({
              ok: true,
              json: async () => ({
                success: true,
                data: {
                  draft: {
                    id: 'draft-1',
                    title: 'Company Work Note',
                    contentMd: '# Company Work Note',
                    blocks: [],
                    saveState: 'saved',
                    lifecycleState: 'draft',
                    markdownProjectionStatus: 'synced',
                    provenance: { workflowRuns: [approved] },
                  },
                  workflowRun: approved,
                  readBack: { status: 'updated' },
                },
              }),
            }) as Response
        );
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Canvas menu' }));
    await user.click(screen.getByRole('button', { name: 'Start workflow' }));
    const reviewerInput = await screen.findByLabelText('Reviewer for Market research to report');
    expect(reviewerInput).toHaveValue('reviewer-1');

    await user.click(screen.getByRole('button', { name: 'Mark approved' }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Updating...' })).toHaveLength(2);
      expect(reviewerInput).toBeDisabled();
    });
    resolveCollaboration?.({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          draft: {
            id: 'draft-1',
            title: 'Company Work Note',
            contentMd: '# Company Work Note',
            blocks: [],
            saveState: 'saved',
            lifecycleState: 'draft',
            markdownProjectionStatus: 'synced',
            provenance: {
              workflowRuns: [
                {
                  ...workflowRun,
                  collaboration: {
                    ...workflowRun.collaboration,
                    lifecycle: 'approved',
                  },
                },
              ],
            },
          },
          workflowRun: {
            ...workflowRun,
            collaboration: {
              ...workflowRun.collaboration,
              lifecycle: 'approved',
            },
          },
          readBack: { status: 'updated' },
        },
      }),
    } as Response);

    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Lifecycle: approved'
    );
    expect(screen.getByRole('button', { name: 'Mark approved' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/work-canvas/drafts/draft-1/workflows/workflow-1/collaboration',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  it('disables workflow execution while run-next is in flight', async () => {
    const user = userEvent.setup();
    const workflowRun = {
      id: 'workflow-1',
      draftId: 'draft-1',
      conversationId: 'conv-1',
      template: 'market_research_to_report',
      title: 'Market research to report',
      status: 'active',
      steps: [
        {
          id: 'step-1',
          kind: 'teresa_action',
          title: 'Frame the workflow',
          summary: 'Prepare workflow',
          status: 'completed',
          createdAt: '2026-05-03T00:00:00.000Z',
        },
        {
          id: 'step-2',
          kind: 'user_approval',
          title: 'Approve report',
          summary: 'Approve before durable output.',
          status: 'pending',
          approvalRequired: true,
          createdAt: '2026-05-03T00:00:00.000Z',
        },
      ],
      approvals: [{ stepId: 'step-2', status: 'pending', requiredCapability: 'approve' }],
      outputs: [],
      events: [],
      createdBy: 'user-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      updatedAt: '2026-05-03T00:00:00.000Z',
    };
    let resolveRunNext: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts?conversationId=conv-1') {
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
            ],
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
                blocks: [],
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                provenance: { workflowRuns: [workflowRun] },
              },
              workflowRun,
              readBack: { status: 'created' },
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-1/workflows/workflow-1/run-next') {
        expect(JSON.parse(String(init?.body))).toMatchObject({ approved: true });
        return new Promise<Response>((resolve) => {
          resolveRunNext = resolve;
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Canvas menu' }));
    await user.click(screen.getByRole('button', { name: 'Start workflow' }));

    await user.click(await screen.findByRole('button', { name: 'Approve and run' }));
    const runningButton = await screen.findByRole('button', { name: 'Running...' });
    expect(runningButton).toBeDisabled();
    fireEvent.click(runningButton);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const completed = {
      ...workflowRun,
      status: 'completed',
      approvals: [{ stepId: 'step-2', status: 'approved', requiredCapability: 'approve' }],
      outputs: [
        {
          stepId: 'step-2',
          type: 'report',
          id: 'report-1',
          title: 'Report: Company Work Note',
          url: '/work-canvas?draftId=report-1',
        },
      ],
    };
    resolveRunNext?.({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          draft: {
            id: 'draft-1',
            title: 'Company Work Note',
            contentMd: '# Company Work Note',
            blocks: [],
            saveState: 'saved',
            lifecycleState: 'draft',
            markdownProjectionStatus: 'synced',
            provenance: { workflowRuns: [completed] },
          },
          workflowRun: completed,
          outputResource: completed.outputs[0],
          readBack: { status: 'completed' },
        },
      }),
    } as Response);
    expect(await screen.findByRole('button', { name: 'Completed' })).toBeDisabled();
  });

  it('keeps Canvas visible when an artifact block renderer falls back', async () => {
    render(
      <WorkCanvasDocumentPanel
        initialBlocks={[
          {
            id: 'broken-chart',
            kind: 'chart',
            schemaVersion: 'canvas-block/v1',
            title: 'Broken Chart',
            status: 'failed',
            capabilities: ['view'],
            data: {},
            provenance: { source: 'assistant' },
            markdownProjection: '### Broken Chart\n\nProjection unavailable.',
            markdownProjectionStatus: 'failed',
            projectionError: 'Chart spec could not be rendered.',
          },
        ]}
      />
    );

    expect(await screen.findByTestId('canvas-document-view')).toHaveTextContent(
      'Company Work Note'
    );
    expect(screen.getByTestId('canvas-artifact-block-broken-chart')).toHaveTextContent(
      'Chart spec could not be rendered.'
    );
    expect(screen.getByTestId('canvas-artifact-block-broken-chart')).toHaveTextContent(
      'Projection unavailable.'
    );
  });

  it('updates active document state when a starter action is selected', async () => {
    const user = userEvent.setup();
    const onActiveDocumentChange = vi.fn();
    render(<WorkCanvasDocumentPanel onActiveDocumentChange={onActiveDocumentChange} />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /New Canvas/i }));
    await user.click(screen.getByRole('button', { name: /Przygotuj decyzję/i }));

    expect(await screen.findByTestId('canvas-active-title')).toHaveValue('Decision Memo');
    expect(onActiveDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Decision Memo', activeStarterId: 'decision' })
    );
  });

  it('lets users rename the Canvas document from the topbar', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    const titleInput = screen.getByLabelText('Canvas document title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Client Strategy Memo');

    expect(titleInput).toHaveValue('Client Strategy Memo');
    expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
      'data-save-state',
      'unsaved'
    );

    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    // Save/projection/action diagnostics now live under the collapsible
    // "MD file properties" (i18n: canvas.panel.mdProps.title) section inside the Canvas menu.
    await user.click(screen.getByRole('button', { name: /MD file properties/i }));
    expect(screen.getByTestId('canvas-diagnostics-save-state')).toHaveTextContent(
      'Unsaved changes'
    );
    expect(screen.getByTestId('canvas-diagnostics-action-state')).toHaveTextContent('Idle');
  });

  it('marks Markdown edits unsaved and saves through the draft API when possible', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: 'draft-1',
          lifecycleState: 'draft',
          markdownProjectionStatus: 'synced',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);
    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');
    await user.type(screen.getByTestId('canvas-md-view'), '\nNew note');

    expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
      'data-save-state',
      'unsaved'
    );

    await user.click(screen.getByRole('button', { name: /Save Canvas document/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
        'data-save-state',
        'saved'
      )
    );
  });

  it('remembers the last Document or MD view mode', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');
    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();

    unmount();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();
  });

  it('shows quiet projection degraded state with retry', async () => {
    const user = userEvent.setup();
    const failedBlock = {
      id: 'chart-failed',
      kind: 'chart',
      schemaVersion: 'canvas-block/v1',
      title: 'Failed chart',
      status: 'failed',
      capabilities: ['view'],
      data: { metrics: [{ label: 'A', value: 1 }] },
      markdownProjection: '### Failed chart',
      markdownProjectionStatus: 'failed' as const,
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 'draft-projection-1',
              title: 'Projection doc',
              kind: 'document',
              contentMd: '# Projection doc',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'failed',
              blocks: [failedBlock],
            },
          }),
        } as Response;
      }
      if (url === '/api/work-canvas/drafts/draft-projection-1/operations') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-projection-1',
                title: 'Projection doc',
                kind: 'document',
                contentMd: '# Projection doc',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
                blocks: [
                  {
                    ...failedBlock,
                    markdownProjectionStatus: 'synced',
                  },
                ],
              },
            },
          }),
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <WorkCanvasDocumentPanel
        conversationId="conv-1"
        initialStarterId="document"
        initialProjectionStatus="failed"
        initialBlocks={[failedBlock]}
      />
    );

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas menu/i }));
    // Projection status lives under the collapsible "MD file properties"
    // (i18n: canvas.panel.mdProps.title) section.
    await user.click(screen.getByRole('button', { name: /MD file properties/i }));
    expect(await screen.findByTestId('canvas-projection-status')).toHaveTextContent(
      'Projection failed'
    );

    await user.click(screen.getByRole('button', { name: /Retry projection/i }));
    await waitFor(() =>
      expect(screen.getByTestId('canvas-projection-status')).toHaveTextContent('Projection synced')
    );
    expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
      'Projection retried from backend runtime.'
    );
  });

  it('runs workspace and output command actions through real Canvas runtimes', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      // Workspace handoffs go through the governed proposal flow (commit
      // fed34ea9c5, "govern active canvas owner handoffs", 2026-08-03):
      // create a proposal, then approve it — the old direct
      // /save-to-workspace call this test used to mock is dead code
      // (workCanvasSaveToWorkspace in src/services/api.ts has zero callers).
      if (url === '/api/work-canvas/drafts/draft-1/proposals') {
        const body = JSON.parse(String(init?.body));
        expect(body.target).toBe('idea');
        expect(body.payload).toMatchObject({ title: 'Company Work Note' });
        expect(body.idempotencyKey).toEqual(expect.any(String));
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'proposal-1',
              draftId: 'draft-1',
              target: 'idea',
              status: 'approved',
              targetObjectId: 'idea-1',
              readBack: { url: '/my-work/ideas/idea-1' },
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/create-output') {
        expect(JSON.parse(String(init?.body))).toEqual({ outputType: 'presentation' });
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note',
              },
              outputResource: {
                type: 'presentation',
                id: 'deck-1',
                title: 'Presentation: Company Work Note',
                url: '/presentations/builder/deck-1',
              },
              readBack: { status: 'created' },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Send to idea/i }));

    // Governed-handoff feedback (showDurableHandoffReceipt) renders
    // "Created {target} ({objectId}). [Open created object](url)" — the
    // Markdown link renders as a real clickable anchor pointing at the
    // backend-returned deep link (readBack.url).
    const workspaceFeedback = await screen.findByTestId('canvas-action-feedback');
    expect(workspaceFeedback).toHaveTextContent('Created idea (idea-1).');
    const openLink = within(workspaceFeedback).getByRole('link', { name: 'Open created object' });
    expect(openLink).toHaveAttribute('href', '/my-work/ideas/idea-1');

    await user.click(screen.getByRole('button', { name: /Create presentation/i }));

    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Presentation: Company Work Note created. deck-1'
    );
    expect(screen.getByRole('button', { name: /Create presentation/i })).toHaveAttribute(
      'data-action-status',
      'enabled'
    );
    // Share is a real toolbar action now (canvas.share capability); in the
    // vitest runtime the capability defaults to false, so it renders gated
    // with the honest missing-permission reason (P0-2 replaced the false
    // "coming soon" copy).
    expect(screen.getByRole('button', { name: /Share Canvas document/i })).toHaveAttribute(
      'data-action-status',
      'disabled_missing_permission'
    );
    // The standalone "Open document folder" and "Upload files" toolbar buttons
    // were removed in the rich-editor rollout; dataset upload now lives behind
    // the Canvas menu ("Upload dataset") and the document folder action is gone.
    expect(
      screen.queryByRole('button', { name: /Open document folder/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload files/i })).not.toBeInTheDocument();
  });

  // Regression (live audit check 7): save-as-note success must keep the panel
  // OPEN and show the feedback strip with a clickable note deep-link — the
  // observed failure was a silently closing panel with no success feedback.
  it('keeps the panel open and shows a clickable note link after save-as-note', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      // Governed proposal flow (commit fed34ea9c5, 2026-08-03) — see the
      // sibling test above for why /save-to-workspace is no longer called.
      if (url === '/api/work-canvas/drafts/draft-1/proposals') {
        const body = JSON.parse(String(init?.body));
        expect(body.target).toBe('note');
        expect(body.payload).toMatchObject({ title: 'Company Work Note' });
        expect(body.idempotencyKey).toEqual(expect.any(String));
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'proposal-2',
              draftId: 'draft-1',
              target: 'note',
              status: 'approved',
              targetObjectId: 'page-1',
              readBack: { url: '/my-work/notebook/page-1' },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel onClose={onClose} />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Save as note/i }));

    const noteFeedback = await screen.findByTestId('canvas-action-feedback');
    expect(noteFeedback).toHaveTextContent('Created note (page-1).');
    const noteLink = within(noteFeedback).getByRole('link', { name: 'Open created object' });
    expect(noteLink).toHaveAttribute('href', '/my-work/notebook/page-1');
    // The panel must NOT close on success — the user reviews the link first.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('canvas-document-view')).toBeInTheDocument();
  });

  it('renders Canvas action failures as safe alerts without backend details', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/save-to-workspace') {
        throw new Error('SQLSTATE 23505 secret=/var/db/internal.trace');
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Send to idea/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to save Canvas to idea.');
    expect(alert).not.toHaveTextContent('SQLSTATE');
    expect(alert).not.toHaveTextContent('/var/db');
  });

  it('captures Markdown selection without rendering selection chrome', async () => {
    const user = userEvent.setup();
    const onCanvasSelectionChange = vi.fn();
    render(<WorkCanvasDocumentPanel onCanvasSelectionChange={onCanvasSelectionChange} />);

    await screen.findByTestId('canvas-document-view');
    await switchView(user, 'Markdown view');
    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    const selected = 'Operating workspace';
    const start = mdView.value.indexOf(selected);
    mdView.setSelectionRange(start, start + selected.length);
    fireEvent.select(mdView);

    expect(onCanvasSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedText: selected, mode: 'md' })
    );
    expect(screen.queryByTestId('canvas-selection-bar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ask Teresa/i })).not.toBeInTheDocument();
  });

  it('autosaves persisted Markdown edits after debounce without manual save', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({
        data: {
          id: 'draft-1',
          title: 'Company Work Note',
          contentMd:
            url === '/api/work-canvas/drafts'
              ? '# Company Work Note'
              : '# Company Work Note\nAutosaved',
          saveState: 'saved',
          lifecycleState: 'draft',
          markdownProjectionStatus: 'synced',
        },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    switchViewFireEvent('Markdown view');
    fireEvent.click(screen.getByRole('button', { name: /Save Canvas document/i }));
    // Wait for the manual save to settle so the draft id is hydrated before the
    // autosave path (which only fires once a draftId exists) is exercised.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
        'data-save-state',
        'saved'
      )
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    fireEvent.change(mdView, { target: { value: `${mdView.value}\nAutosaved` } });
    expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
      'data-save-state',
      'unsaved'
    );

    vi.advanceTimersByTime(1500);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts/draft-1', expect.any(Object))
    );
  });

  it('keeps local edits visible when autosave hits a Canvas revision conflict', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
              updatedAt: '2026-05-03T00:00:00.000Z',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1') {
        expect(JSON.parse(String(init?.body))).toMatchObject({
          baseUpdatedAt: '2026-05-03T00:00:00.000Z',
        });
        return {
          ok: false,
          json: async () => ({
            code: 'CANVAS_DRAFT_CONFLICT',
            error: 'Canvas changed since this action started.',
            recoverable: true,
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    switchViewFireEvent('Markdown view');
    fireEvent.click(screen.getByRole('button', { name: /Save Canvas document/i }));
    // Let the initial save settle so the draft id is hydrated before the
    // autosave conflict path runs.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
        'data-save-state',
        'saved'
      )
    );
    expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    fireEvent.change(mdView, { target: { value: '# Company Work Note\nLocal conflict edit' } });
    vi.advanceTimersByTime(1500);

    await waitFor(() =>
      expect(screen.getByTestId('canvas-action-feedback')).toHaveTextContent(
        'Canvas changed elsewhere'
      )
    );
    expect(mdView.value).toContain('Local conflict edit');
    expect(screen.getByRole('button', { name: /Save Canvas document/i })).toHaveAttribute(
      'data-save-state',
      'failed'
    );
  });

  it('loads version history from diagnostics', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'version-1',
                draftId: 'draft-1',
                operationType: 'replace_selection',
                summary: 'Updated text',
                contentMd: '# Company Work Note',
                createdBy: 'user-1',
                createdAt: '2026-05-03T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');

    fireEvent.click(screen.getByRole('button', { name: /Canvas menu/i }));
    // #87c (rewizja 07-13): the menu item was renamed "Versions" → "Version
    // history" and now carries a stable testid (canvas-history-menu-item);
    // the label also appears a second time in the collapsed "Advanced"
    // details section, so a text-role query is ambiguous — the testid is not.
    fireEvent.click(await screen.findByTestId('canvas-history-menu-item'));

    expect(await screen.findByText('replace_selection')).toBeInTheDocument();
    expect(screen.getByText(/Updated text/)).toBeInTheDocument();
  });

  it('restores a version while preserving the active draft context', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/work-canvas/drafts') {
        return {
          ok: true,
          json: async () => ({
            data: {
              id: 'draft-1',
              title: 'Company Work Note',
              contentMd: '# Company Work Note\n\nCurrent content',
              saveState: 'saved',
              lifecycleState: 'draft',
              markdownProjectionStatus: 'synced',
            },
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 'version-1',
                draftId: 'draft-1',
                operationType: 'manual_save',
                summary: 'Previous stable version',
                contentMd: '# Company Work Note\n\nRestored content',
                createdBy: 'user-1',
                createdAt: '2026-05-03T00:00:00.000Z',
              },
            ],
          }),
        };
      }
      if (url === '/api/work-canvas/drafts/draft-1/versions/version-1/restore') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              draft: {
                id: 'draft-1',
                title: 'Company Work Note',
                contentMd: '# Company Work Note\n\nRestored content',
                saveState: 'saved',
                lifecycleState: 'draft',
                markdownProjectionStatus: 'synced',
              },
              restoredVersion: { id: 'version-1' },
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" />);

    await screen.findByTestId('canvas-document-view');
    fireEvent.click(screen.getByRole('button', { name: /Canvas menu/i }));
    // #87c (rewizja 07-13): the menu item was renamed "Versions" → "Version
    // history" and now carries a stable testid (canvas-history-menu-item);
    // the label also appears a second time in the collapsed "Advanced"
    // details section, so a text-role query is ambiguous — the testid is not.
    fireEvent.click(await screen.findByTestId('canvas-history-menu-item'));
    // CanvasVersionHistory now gates restore behind an inline confirm (avoid
    // accidental data loss): "Restore" swaps to "Yes, restore" in place, a
    // second click is required before the panel's restoreVersion path fires.
    fireEvent.click(await screen.findByTestId('canvas-version-restore'));
    fireEvent.click(await screen.findByTestId('canvas-version-restore-confirm'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/versions/version-1/restore',
        expect.objectContaining({ method: 'POST' })
      )
    );
    expect(await screen.findByText(/Restored Canvas version/)).toBeInTheDocument();

    switchViewFireEvent('Markdown view');
    expect(((await screen.findByTestId('canvas-md-view')) as HTMLTextAreaElement).value).toContain(
      'Restored content'
    );
  });

  // Regresja Tryb B (UWAGA #1 / SPEC_ZADANIE_01): gdy canvas jest podparty
  // draftem (initialDraftId), panel MUSI zamontować ten draft jako dokument,
  // a NIE wracać do pustego szablonu „Company Work Note". To gwarantuje, że
  // „dodałem do Canvasa" od Teresy faktycznie widać po prawej — niezależnie od
  // wyścigu reset(:704) vs event `deliverables:draft-ready`.
  it('mounts the backing draft (not the base template) when initialDraftId is set', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/work-canvas/drafts/draft-tryb-b')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              draft: {
                id: 'draft-tryb-b',
                draftId: 'draft-tryb-b',
                title: 'Plan dnia 7 lutego',
                contentMd: '# Plan dnia 7 lutego\n\n- [ ] Przegląd inicjatyw',
                saveState: 'saved',
                lifecycleState: 'draft',
                  markdownProjectionStatus: 'synced',
              },
            },
          }),
        } as unknown as Response;
      }
      // Versions / any auxiliary fetch — keep render stable.
      return { ok: true, json: async () => ({ success: true, data: [] }) } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<WorkCanvasDocumentPanel conversationId="conv-1" initialDraftId="draft-tryb-b" />);

    // The mounted document is the backing draft, hydrated by id.
    await waitFor(() =>
      expect(screen.getByLabelText('Canvas document title')).toHaveValue('Plan dnia 7 lutego')
    );
    // And it is NOT the empty "Company Work Note" base template.
    expect(screen.getByLabelText('Canvas document title')).not.toHaveValue('Company Work Note');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/work-canvas/drafts/draft-tryb-b'),
      expect.anything()
    );
  });
});
