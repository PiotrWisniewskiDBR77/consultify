/** @vitest-environment node */

/**
 * D-119 — `GET /api/report-builder-public/:token/pptx` hands the deck renderer
 * the locale of the shared REPORT, not a hardcoded Polish default.
 *
 * WHY THIS SUITE EXISTS: the public (token) route is the sibling of the D-46
 * authenticated route but was left out of that package, so it still passed
 * `reportConfig.language || 'pl'`. A shared English report whose config carries
 * no explicit language therefore got a Polish title slide, while the same
 * report's DOCX wrote the English one. A unit test of the resolver would not
 * catch a route that keeps its own `|| 'pl'`, so this suite drives the REAL
 * public router over HTTP and asserts the ARGUMENT that reaches
 * `PptxPipelineService.generateFromLegacyReport`.
 *
 * The resolver's own decision order lives in
 * `../../services/report/__tests__/exportLocale.test.ts`; the authenticated
 * route's wiring lives in `./report-builder-export-locale.routes.test.ts`.
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Top-level mock fns (declared before vi.mock factories) ───────────────────

const mockGetPublicLinkByToken = vi.fn();
const mockGenerateFromLegacyReport = vi.fn();
const mockResolveLocale = vi.fn();

vi.mock('../../services/reportBuilderService.js', () => ({
  default: {
    getPublicLinkByToken: (...a: unknown[]) => mockGetPublicLinkByToken(...a),
  },
}));

vi.mock('../../services/report/pptx/PptxPipelineService.js', () => ({
  PptxPipelineService: class {
    generateFromLegacyReport = (...a: unknown[]) => mockGenerateFromLegacyReport(...a);
  },
}));

vi.mock('../../services/ai/languagePolicy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ai/languagePolicy.js')>();
  return { ...actual, resolveLocale: (...a: unknown[]) => mockResolveLocale(...a) };
});

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

async function createApp(): Promise<Express> {
  const mod = await import('../report-builder-public.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/report-builder-public', mod.default);
  return app;
}

const TOKEN = 'public-token-1';

function publicLinkFixture(
  config: Record<string, unknown> = {},
  sections: Array<Record<string, unknown>> = []
) {
  return {
    link: {
      id: 'link-1',
      passwordHash: null,
      showCompanyLogo: false,
      showConsultifyBranding: true,
      customMessage: null,
    },
    report: {
      id: 'rb-report-1',
      title: 'Operational maturity review',
      config,
    },
    sections: sections.length
      ? sections
      : [{ sectionKey: 'summary', title: 'Executive summary', enabled: true, orderIndex: 0 }],
  };
}

describe('GET /api/report-builder-public/:token/pptx — export locale (D-119)', () => {
  beforeEach(() => {
    mockGetPublicLinkByToken.mockReset();
    mockGenerateFromLegacyReport.mockReset();
    mockResolveLocale.mockReset();
    mockGenerateFromLegacyReport.mockResolvedValue({
      buffer: Buffer.from('pptx-v2-bytes'),
      slideCount: 1,
      warnings: [],
      validation: { valid: true },
    });
    mockResolveLocale.mockResolvedValue('en');
  });

  it('★ sends the report config language to the renderer when the caller sends no ?language=', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(publicLinkFixture({ language: 'en' }));

    const app = await createApp();
    const res = await request(app)
      .get(`/api/report-builder-public/${TOKEN}/pptx`)
      .set('Authorization', 'Bearer public-token');

    expect(res.status).toBe(200);
    expect(mockGenerateFromLegacyReport).toHaveBeenCalledTimes(1);
    const [, options] = mockGenerateFromLegacyReport.mock.calls[0];
    expect(options.language).toBe('en');
  });

  it('allows PPTX download without Authorization when the public token is valid (D-139)', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(publicLinkFixture({ language: 'en' }));

    const app = await createApp();
    const res = await request(app).get(`/api/report-builder-public/${TOKEN}/pptx`);

    expect(res.status).toBe(200);
    expect(mockGetPublicLinkByToken).toHaveBeenCalledWith(TOKEN);
    expect(mockGenerateFromLegacyReport).toHaveBeenCalledTimes(1);
  });

  it('keeps Polish for a Polish report (no regression the other way)', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(publicLinkFixture({ language: 'pl-PL' }));

    const app = await createApp();
    await request(app)
      .get(`/api/report-builder-public/${TOKEN}/pptx`)
      .set('Authorization', 'Bearer public-token');

    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).toBe('pl');
  });

  it('honours an explicit ?language= over the report config language', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(publicLinkFixture({ language: 'en' }));

    const app = await createApp();
    await request(app)
      .get(`/api/report-builder-public/${TOKEN}/pptx?language=pl`)
      .set('Authorization', 'Bearer public-token');

    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).toBe('pl');
  });

  it('falls back to the section language when the report config carries none', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(
      publicLinkFixture({}, [
        { sectionKey: 'summary', title: 'Summary', language: 'pl', enabled: true, orderIndex: 0 },
      ])
    );

    const app = await createApp();
    await request(app)
      .get(`/api/report-builder-public/${TOKEN}/pptx`)
      .set('Authorization', 'Bearer public-token');

    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).toBe('pl');
  });

  it('★ falls back to the DEC-510 identity chain — never to Polish — when nothing else speaks', async () => {
    mockGetPublicLinkByToken.mockResolvedValue(publicLinkFixture({}));
    mockResolveLocale.mockResolvedValue('en');

    const app = await createApp();
    await request(app)
      .get(`/api/report-builder-public/${TOKEN}/pptx`)
      .set('Authorization', 'Bearer public-token');

    expect(mockResolveLocale).toHaveBeenCalledTimes(1);
    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).toBe('en');
    expect(mockGenerateFromLegacyReport.mock.calls[0][1].language).not.toBe('pl');
  });
});
