/**
 * DEC-413 — JEDEN generator inicjatyw.
 *
 * Bramka pilnuje rzeczy, którą łatwo złamać przy refaktorze: KAŻDY adapter
 * źródła musi wołać DOKŁADNIE swój endpoint, z payloadem, który przyjmuje
 * jego serwer. Zamiana adapterów miejscami (np. `interview` wołający trasę
 * narzędzi) daje ciche „wygenerowano zero inicjatyw" na produkcji, bo obie
 * trasy odpowiadają 200 z inną kopertą.
 *
 * Testujemy sam adapter, nie modal — to adapter niesie wiedzę o module,
 * a modal jest bezmodułowy z założenia.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const wolania: Array<{ metoda: 'get' | 'post'; url: string; body?: any }> = [];

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(async (url: string) => {
      wolania.push({ metoda: 'get', url });
      if (url.startsWith('/assessment-reports')) return { reports: [] };
      if (url.startsWith('/initiatives/templates')) return { templates: [] };
      return {};
    }),
    post: vi.fn(async (url: string, body?: any) => {
      wolania.push({ metoda: 'post', url, body });
      if (url.includes('initiative-generation-runs')) return { runId: 'run-1' };
      if (url.includes('/wizard/sessions') && !url.includes('candidates'))
        return { session: { id: 'sess-1' } };
      if (url.includes('candidates/generate')) return { candidates: [] };
      if (url === '/audits/proposals') return { data: [{ id: 'p1', title: 'Propozycja' }] };
      return {};
    }),
    listAssessments: vi.fn(async () => ({ items: [] })),
    listToolSessions: vi.fn(async () => ({ items: [] })),
    generateToolInitiatives: vi.fn(async (toolId: string, payload: any) => {
      wolania.push({ metoda: 'post', url: `/tools/${toolId}/generate-initiatives`, body: payload });
      return { initiatives: [{ id: 'i1', title: 'Inicjatywa', status: 'DRAFT' }] };
    }),
  },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: { listInsights: vi.fn(async () => ({ insights: [] })) },
}));

vi.mock('@/services/initiativeWriteTruth', () => ({
  createInitiativeWriteTruth: vi.fn(async () => ({
    truth: { initiative: { id: 'i9', name: 'Z wniosku', status: 'DRAFT' } },
  })),
}));

vi.mock('@/components/Audit/method/auditsMethodApi', () => ({
  listPrograms: vi.fn(async () => ({ items: [], total: 0 })),
  listFindings: vi.fn(async () => ({ items: [], total: 0 })),
}));

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { adapterAssessment } from '../adapters/assessment';
import { adapterAudit } from '../adapters/audit';
import { adapterTool } from '../adapters/tool';
import { utworzAdapterInterview } from '../adapters/interview';
import type { ArgumentyGeneracji } from '../types';

const argumenty = (nadpisz: Partial<ArgumentyGeneracji> = {}): ArgumentyGeneracji => ({
  tryb: 'ASSESSMENT_REPORT',
  glowny: ['src-1'],
  wtorny: [],
  templateId: 'tpl-1',
  methodologyId: 'impact-feasibility',
  liczba: 5,
  includeChatContext: true,
  consultantBrief: '',
  ...nadpisz,
});

const posty = () => wolania.filter((w) => w.metoda === 'post');

beforeEach(() => {
  wolania.length = 0;
});

describe('DEC-413 — adaptery generatora wołają dokładnie swój endpoint', () => {
  it('assessment: POST /assessment-workflow-v2/:id/initiative-generation-runs z trybem, template i raportem', async () => {
    const wynik = await adapterAssessment.generuj(
      argumenty({ glowny: ['as-1'], wtorny: ['rep-1'] })
    );

    const post = posty()[0];
    expect(post.url).toBe('/assessment-workflow-v2/as-1/initiative-generation-runs');
    expect(post.body).toMatchObject({
      mode: 'ASSESSMENT_REPORT',
      reportId: 'rep-1',
      templateId: 'tpl-1',
      methodologyId: 'impact-feasibility',
      requestedCount: 5,
    });
    expect(wynik).toEqual({ rodzaj: 'bieg', uchwyt: { runId: 'run-1', kontekstId: 'as-1' } });
  });

  it('assessment: tryb ASSESSMENT_ONLY nie wysyła reportId', async () => {
    await adapterAssessment.generuj(
      argumenty({ tryb: 'ASSESSMENT_ONLY', glowny: ['as-2'], wtorny: ['rep-9'] })
    );
    expect(posty()[0].body).not.toHaveProperty('reportId');
  });

  it('tool: POST /tools/:toolId/generate-initiatives i twardy sufit count=7 z walidatora zod', async () => {
    await adapterTool.generuj(argumenty({ glowny: ['tool-7'], liczba: 99 }));

    const post = posty()[0];
    expect(post.url).toBe('/tools/tool-7/generate-initiatives');
    expect(post.body).toMatchObject({ methodologyId: 'impact-feasibility', count: 7 });
    // Nigdy trasą Oceny ani Audytu.
    expect(posty().some((w) => w.url.includes('initiative-generation-runs'))).toBe(false);
    expect(posty().some((w) => w.url === '/audits/proposals')).toBe(false);
  });

  it('interview: sesja kreatora + kandydaci AI, nigdy trasa narzędzi', async () => {
    const adapter = utworzAdapterInterview({ projectId: 'proj-1', ownerUserId: 'user-1' });
    await adapter.generuj(argumenty({ glowny: ['ins-1', 'ins-2'] }));

    const trasy = posty().map((w) => w.url);
    expect(trasy).toContain('/initiatives/wizard/sessions');
    expect(trasy).toContain('/initiatives/wizard/sessions/sess-1/candidates/generate');
    // MUTACJA, przed którą broni ta bramka: adapter `interview` wołający
    // endpoint narzędzi. Gdyby ktoś podmienił implementację, ten wiersz padnie.
    expect(trasy.some((u) => /^\/tools\/.+\/generate-initiatives$/.test(u))).toBe(false);

    const sesja = posty().find((w) => w.url === '/initiatives/wizard/sessions');
    expect(sesja?.body?.sourceBasket).toEqual([
      { type: 'interview_insight', id: 'ins-1' },
      { type: 'interview_insight', id: 'ins-2' },
    ]);
  });

  it('interview: bez projektu lub właściciela odmawia zamiast tworzyć sierotę', async () => {
    const adapter = utworzAdapterInterview({ projectId: '', ownerUserId: '' });
    await expect(adapter.generuj(argumenty({ glowny: ['ins-1'] }))).rejects.toThrow();
    expect(posty()).toHaveLength(0);
  });

  it('audit: POST /audits/proposals z programId i findingIds', async () => {
    const wynik = await adapterAudit.generuj(
      argumenty({ glowny: ['prog-1'], wtorny: ['f-1', 'f-2'] })
    );

    const post = posty()[0];
    expect(post.url).toBe('/audits/proposals');
    expect(post.body).toMatchObject({ programId: 'prog-1', findingIds: ['f-1', 'f-2'] });
    expect(wynik).toEqual({
      rodzaj: 'gotowe',
      inicjatywy: [{ id: 'p1', title: 'Propozycja', status: 'DRAFT' }],
    });
  });

  it('audit: bez ustaleń nie strzela do serwera', async () => {
    await expect(
      adapterAudit.generuj(argumenty({ glowny: ['prog-1'], wtorny: [] }))
    ).rejects.toThrow();
    expect(posty()).toHaveLength(0);
  });

  it('template jest wymagany TYLKO tam, gdzie serwer go przyjmuje', () => {
    expect(adapterAssessment.wymagaTemplate).toBe(true);
    expect(adapterTool.wymagaTemplate).toBe(false);
    expect(adapterAudit.wymagaTemplate).toBe(false);
    expect(utworzAdapterInterview({ projectId: 'p', ownerUserId: 'u' }).wymagaTemplate).toBe(false);
  });
});
