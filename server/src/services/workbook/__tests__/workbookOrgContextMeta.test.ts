/**
 * WorkbookGeneratorService — organizationName → Info sheet meta (N2, noc
 * 2026-07-27/28).
 *
 * `WorkbookGeneratorService.ts` used to hard-code a comment saying org-name
 * resolution on the Info sheet was "intentionally deferred — the UUID is not
 * user-facing" (see `buildWorkbookBuffer(schema, { meta: { source, ... } })`,
 * no `organizationName`). N2 wires the route's resolved org name (via
 * `documentOrgContextSourcePack.buildOrgContextSourcePack`, reused byte-for-
 * byte from Document Studio's P0 fix) into `WorkbookGenerationParams` /
 * `generateFromTemplate` input, and from there into the `buildWorkbookBuffer`
 * `meta` object that `addInfoSheet` (WorkbookBuilder.ts) renders onto the
 * Info sheet.
 *
 * This suite proves the LAST mile of that wiring — that whatever
 * `organizationName` the caller passes in actually reaches
 * `buildWorkbookBuffer`'s `meta.organizationName` — by mocking
 * `WorkbookBuilder.js` and asserting on the captured call, for BOTH the
 * free-form LLM pipeline (`generate`) and the deterministic template path
 * (`generateFromTemplate`). The route-level wiring (resolving the name from a
 * real organization fixture) is covered separately in
 * `server/src/routes/__tests__/workbook-org-context.routes.test.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let processImpl: (req: any) => Promise<{ success: boolean; content: string }>;

vi.mock('../../ai/AIPipeline.js', () => ({
  AIPipeline: {
    getInstance: () => ({
      process: (req: any) => processImpl(req),
    }),
  },
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockBuildWorkbookBuffer = vi.fn();
vi.mock('../WorkbookBuilder.js', async () => {
  const actual =
    await vi.importActual<typeof import('../WorkbookBuilder.js')>('../WorkbookBuilder.js');
  return {
    ...actual,
    buildWorkbookBuffer: (...args: unknown[]) => mockBuildWorkbookBuffer(...args),
  };
});

const CLEAN_SCHEMA = {
  title: 'Org Context Meta Fixture',
  description: 'minimal valid schema',
  sheets: [
    {
      name: 'Sheet1',
      columns: [{ key: 'item', header: 'Item', type: 'text' }],
      rows: [{ cells: { item: { value: 'Alpha' } } }],
    },
  ],
};

const PLAN_JSON = JSON.stringify({ domain: 'finance', sheets: [], total_complexity: 'low' });
const CONFIRM_JSON = JSON.stringify({
  approved: true,
  confidence: 0.9,
  issues: [],
  missing_elements: [],
});
const REVIEW_JSON = JSON.stringify({
  scores: {},
  overall_score: 4.5,
  pass: true,
  issues: [],
  fixes_applied: null,
});

function routeByPrompt(sys: string): string {
  if (sys.includes('PLAN the structure')) return PLAN_JSON;
  if (sys.includes('quality assurance reviewer for spreadsheet plans')) return CONFIRM_JSON;
  if (sys.includes('senior Excel quality reviewer')) return REVIEW_JSON;
  // GENERATION_SYSTEM_PROMPT
  if (sys.includes('You receive a PLAN and must produce')) return JSON.stringify(CLEAN_SCHEMA);
  return '{}';
}

describe('WorkbookGeneratorService — organizationName reaches Info-sheet meta', () => {
  beforeEach(() => {
    vi.resetModules();
    mockBuildWorkbookBuffer.mockReset();
    mockBuildWorkbookBuffer.mockResolvedValue(Buffer.from('fake-xlsx-bytes'));
    processImpl = async (req: any) => {
      const sys: string = req?.options?.systemInstruction ?? '';
      return { success: true, content: routeByPrompt(sys) };
    };
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('generate(): passes organizationName through to buildWorkbookBuffer meta', async () => {
    const { default: service } = await import('../WorkbookGeneratorService.js');

    await service.generate({
      prompt: 'Make a tiny budget',
      userId: 'u1',
      organizationId: 'org1',
      organizationName: 'DBR77',
    });

    expect(mockBuildWorkbookBuffer).toHaveBeenCalledTimes(1);
    const [, options] = mockBuildWorkbookBuffer.mock.calls[0];
    expect(options.meta.organizationName).toBe('DBR77');
  });

  it('generate(): omitting organizationName leaves meta.organizationName undefined (no regression)', async () => {
    const { default: service } = await import('../WorkbookGeneratorService.js');

    await service.generate({
      prompt: 'Make a tiny budget',
      userId: 'u1',
      organizationId: 'org1',
    });

    const [, options] = mockBuildWorkbookBuffer.mock.calls[0];
    expect(options.meta.organizationName).toBeUndefined();
  });

  it('generateFromTemplate(): passes organizationName through to buildWorkbookBuffer meta', async () => {
    vi.doMock('../templates/index.js', () => ({
      buildFromTemplateFlat: () => CLEAN_SCHEMA,
    }));
    const { default: service } = await import('../WorkbookGeneratorService.js');

    await service.generateFromTemplate({
      templateId: 'breakEven',
      flatParams: {},
      organizationName: 'Acme Sp. z o.o.',
    });

    expect(mockBuildWorkbookBuffer).toHaveBeenCalledTimes(1);
    const [, options] = mockBuildWorkbookBuffer.mock.calls[0];
    expect(options.meta.organizationName).toBe('Acme Sp. z o.o.');
  });

  it('generateFromTemplate(): brand-new org (no name resolved) builds fine with meta.organizationName undefined', async () => {
    vi.doMock('../templates/index.js', () => ({
      buildFromTemplateFlat: () => CLEAN_SCHEMA,
    }));
    const { default: service } = await import('../WorkbookGeneratorService.js');

    await service.generateFromTemplate({
      templateId: 'breakEven',
      flatParams: {},
    });

    const [, options] = mockBuildWorkbookBuffer.mock.calls[0];
    expect(options.meta.organizationName).toBeUndefined();
  });
});
