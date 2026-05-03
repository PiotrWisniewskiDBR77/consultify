import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkCanvasDocumentPanel } from '../../../src/components/AIChat/WorkCanvasDocumentPanel';

describe('WorkCanvasDocumentPanel', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
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
    expect(screen.getByTestId('canvas-view-actions')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-file-actions')).toBeInTheDocument();
    expect(screen.queryByText('Start pracy')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Open Canvas templates/i }));
    expect(await screen.findByText('DBR77 work templates')).toBeInTheDocument();
    expect(screen.getByText(/decision, initiative, report, or presentation/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Markdown view' }));

    const mdView = screen.getByTestId('canvas-md-view') as HTMLTextAreaElement;
    expect(mdView.value).toContain('# Company Work Note');
    expect(mdView.value).not.toContain('{"');
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

    await user.click(await screen.findByRole('button', { name: 'Export Markdown' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/export?format=markdown',
        expect.any(Object)
      )
    );
    await user.click(screen.getByRole('button', { name: 'Export CSV' }));
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

    await user.click(screen.getByRole('button', { name: /Open Canvas templates/i }));
    expect(await screen.findByTestId('canvas-templates-menu')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Zrób research/i }));

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

    await user.type(screen.getByLabelText('Filter Risk Register'), 'scope');
    expect(screen.queryByText('Supply delay')).not.toBeInTheDocument();
    expect(screen.getByText('Scope drift')).toBeInTheDocument();

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
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));

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
    await user.click(screen.getByRole('button', { name: 'Dock view' }));

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
        expect(body).toEqual({ template: 'client_proposal_to_deck' });
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
        expect(body).toEqual({ approved: true });
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
        expect(body).toEqual({ body: 'Check assumptions' });
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
    await user.click(screen.getByRole('button', { name: 'Canvas diagnostics' }));
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

    await user.click(within(ledger).getByRole('button', { name: 'Run next' }));
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

    await user.type(
      screen.getByLabelText('Comment for Market research to report'),
      'Check assumptions'
    );
    await user.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'user-1: Check assumptions'
    );
    expect(screen.getByTestId('canvas-workflow-ledger')).toHaveTextContent(
      'Workflow comment added.'
    );
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
    await user.click(screen.getByRole('button', { name: /Open Canvas templates/i }));
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

    await user.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
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
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
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
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();

    unmount();
    render(<WorkCanvasDocumentPanel />);

    expect(await screen.findByTestId('canvas-md-view')).toBeInTheDocument();
  });

  it('shows quiet projection degraded state with retry', async () => {
    const user = userEvent.setup();
    render(<WorkCanvasDocumentPanel initialProjectionStatus="failed" />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
    expect(await screen.findByTestId('canvas-projection-status')).toHaveTextContent(
      'Projection failed'
    );

    await user.click(screen.getByRole('button', { name: /Retry projection/i }));
    await waitFor(() =>
      expect(screen.getByTestId('canvas-projection-status')).toHaveTextContent('Projection synced')
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
      if (url === '/api/work-canvas/drafts/draft-1/save-to-workspace') {
        expect(JSON.parse(String(init?.body))).toEqual({ target: 'idea' });
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
              linkedResource: {
                type: 'idea',
                id: 'idea-1',
                title: 'Company Work Note',
                url: '/my-work/ideas/idea-1',
              },
              readBack: { status: 'created' },
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

    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Company Work Note saved to idea. idea-1'
    );

    await user.click(screen.getByRole('button', { name: /Create presentation/i }));

    expect(await screen.findByTestId('canvas-action-feedback')).toHaveTextContent(
      'Presentation: Company Work Note created. deck-1'
    );
    expect(screen.getByRole('button', { name: /Create presentation/i })).toHaveAttribute(
      'data-action-status',
      'enabled'
    );
    expect(
      screen.queryByRole('button', { name: /Share Canvas document/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open document folder/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload files/i })).toBeInTheDocument();
  });

  it('captures Markdown selection without rendering selection chrome', async () => {
    const user = userEvent.setup();
    const onCanvasSelectionChange = vi.fn();
    render(<WorkCanvasDocumentPanel onCanvasSelectionChange={onCanvasSelectionChange} />);

    await screen.findByTestId('canvas-document-view');
    await user.click(screen.getByRole('button', { name: 'Markdown view' }));
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
    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Canvas document/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );

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
    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Canvas document/i }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/work-canvas/drafts', expect.any(Object))
    );

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

    fireEvent.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Versions' }));

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
    fireEvent.click(screen.getByRole('button', { name: /Canvas diagnostics/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Versions' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/work-canvas/drafts/draft-1/versions/version-1/restore',
        expect.objectContaining({ method: 'POST' })
      )
    );
    expect(await screen.findByText(/Restored Canvas version/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Markdown view' }));
    expect(((await screen.findByTestId('canvas-md-view')) as HTMLTextAreaElement).value).toContain(
      'Restored content'
    );
  });
});
