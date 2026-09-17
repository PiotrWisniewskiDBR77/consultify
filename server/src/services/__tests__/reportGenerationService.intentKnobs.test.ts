/**
 * RB-1 (Wpis 76 / przepis Wpis 44): pokrętła Report Buildera podpięte w obie
 * strony. Mierzone tu reguły biznesowe:
 *  1. ta sama inicjatywa/sekcja + dwa różne `intent.audience` → dwa różne
 *     prompty systemowe i dwie różne wygenerowane treści (LLM mockowany,
 *     treść echouje linię AUDIENCE z promptu),
 *  2. `intent.tone` wchodzi do promptu jako REGISTER,
 *  3. pokrętła silnika zapisane pod `config.intent` (verbosity, customTone)
 *     docierają do STYLE REQUIREMENTS — przed naprawą buildStyleGuidance
 *     czytał wyłącznie górny poziom configu, więc nigdy nie docierały,
 *  4. legacy zapis na górnym poziomie configu nadal działa.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { llmCallMock, getReportMock, getSourceDataMock, generatedContents } = vi.hoisted(() => ({
  llmCallMock: vi.fn(),
  getReportMock: vi.fn(),
  getSourceDataMock: vi.fn(),
  generatedContents: [] as string[],
}));

vi.mock('../ai/llmService.js', () => ({ llmService: { call: llmCallMock } }));
vi.mock('../ai/modelRouter.js', () => ({
  default: {
    select: async () => ({ provider: 'mock', id: 'mock-model', endpoint: null, apiKey: null }),
  },
}));
vi.mock('../reportBuilderService.js', () => ({
  default: {
    getReport: getReportMock,
    getSourceDataForReport: getSourceDataMock,
  },
}));
vi.mock('../database/index.js', () => ({
  getDatabase: () => ({
    run: (_sql: string, _params: unknown[], cb: (err: Error | null) => void) =>
      cb.call({ changes: 1 }, null),
    get: (_sql: string, _params: unknown[], cb: (err: Error | null, row: unknown) => void) =>
      cb(null, null),
  }),
}));

import { generateSectionContent } from '../reportGenerationService';

const audienceLine = (systemPrompt: string) =>
  systemPrompt.split('\n').find((l) => l.startsWith('AUDIENCE: ')) || '';

const makeReport = (intent: Record<string, unknown>) => ({
  report: {
    id: 'r-1',
    config: { intent, styling: {} },
    companyContext: { organizationName: 'Northwind Packaging' },
    sourceRefs: null,
  },
  sections: [
    {
      sectionKey: 'exec_summary',
      sectionType: 'executive_summary',
      length: 'medium',
      language: 'business',
      blockConfig: {},
      sourceRefs: null,
    },
  ],
});

const seedSourceData = () =>
  getSourceDataMock.mockResolvedValue({
    assessment: { assessmentType: 'CUSTOM', name: 'Baseline', scores: {}, answers: {} },
    axesData: {},
  });

describe('RB-1 — pokrętła intent docierają do promptu (reportGenerationService)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generatedContents.length = 0;
    llmCallMock.mockImplementation(async (req: { systemPrompt: string }) => {
      const line = audienceLine(req.systemPrompt);
      const content = `Executive summary body for Northwind Packaging. ${line || 'No audience line.'} ${line || 'No audience line.'}`;
      generatedContents.push(content);
      return { content, usage: { totalTokens: 42 }, model: 'mock-model' };
    });
    seedSourceData();
  });

  it('same initiative, two audiences → two different prompts and two different reports', async () => {
    getReportMock.mockResolvedValue(makeReport({ audience: 'executive', language: 'en' }));
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');

    getReportMock.mockResolvedValue(makeReport({ audience: 'technical', language: 'en' }));
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');

    const executivePrompt = llmCallMock.mock.calls[0][0].systemPrompt as string;
    const technicalPrompt = llmCallMock.mock.calls[1][0].systemPrompt as string;

    expect(executivePrompt).toContain('AUDIENCE: Write for executives');
    expect(technicalPrompt).toContain('AUDIENCE: Write for technical readers');
    expect(executivePrompt).not.toBe(technicalPrompt);
    expect(generatedContents[0]).toContain('Write for executives');
    expect(generatedContents[0]).not.toContain('Write for technical readers');
    expect(generatedContents[1]).toContain('Write for technical readers');
    expect(generatedContents[0]).not.toBe(generatedContents[1]);
  });

  it('intent.tone enters the prompt as REGISTER', async () => {
    getReportMock.mockResolvedValue(makeReport({ audience: 'board', tone: 'decisive' }));
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');
    const systemPrompt = llmCallMock.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain('REGISTER: Use a decisive tone');
  });

  it('engine knobs saved under config.intent reach STYLE REQUIREMENTS', async () => {
    getReportMock.mockResolvedValue(
      makeReport({ verbosity: 'comprehensive', customTone: 'direct and data-driven' })
    );
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');
    const systemPrompt = llmCallMock.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain('VERBOSITY: Maximize detail');
    expect(systemPrompt).toContain('TONE: direct and data-driven');
  });

  it('writingStyle and illustrationLevel saved under config.intent reach STYLE REQUIREMENTS', async () => {
    getReportMock.mockResolvedValue(
      makeReport({ writingStyle: 'persuasive', illustrationLevel: 'extensive' })
    );
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');
    const systemPrompt = llmCallMock.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain('STYLE: Use persuasive tone to drive action');
    expect(systemPrompt).toContain('EXAMPLES: Include multiple examples, case studies');
  });

  it('legacy top-level config knobs still work', async () => {
    getReportMock.mockResolvedValue({
      report: {
        id: 'r-1',
        config: { verbosity: 'concise' },
        companyContext: { organizationName: 'Northwind Packaging' },
        sourceRefs: null,
      },
      sections: makeReport({}).sections,
    });
    await generateSectionContent('r-1', 'exec_summary', 'org-1', 'user-1');
    const systemPrompt = llmCallMock.mock.calls[0][0].systemPrompt as string;
    expect(systemPrompt).toContain('VERBOSITY: Be concise');
  });
});
