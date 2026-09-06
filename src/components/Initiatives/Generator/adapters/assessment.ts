/**
 * Adapter `assessment` — zachowanie 1:1 z modalem, który właściciel przyjął
 * 06.09 (`assessment/InitiativesGenerationWizardModal.tsx`): trzy tryby
 * źródła, wybór oceny, wybór raportu (poza trybem ASSESSMENT_ONLY), template,
 * metodologia i liczba, a start = bieg w tle z odpytywaniem postępu.
 */

import { Api } from '@/services/api';

import type {
  AdapterGeneratora,
  ArgumentyGeneracji,
  OpcjaZrodla,
  PodgladInicjatywy,
  PostepBiegu,
  UchwytBiegu,
  WynikStartu,
} from '../types';

const trasaBiegu = (assessmentId: string, runId?: string) =>
  `/assessment-workflow-v2/${encodeURIComponent(assessmentId)}/initiative-generation-runs${
    runId ? `/${encodeURIComponent(runId)}` : ''
  }`;

export const adapterAssessment: AdapterGeneratora = {
  id: 'assessment',
  etykieta: 'Ocena',
  tryby: [
    {
      wartosc: 'ASSESSMENT_REPORT',
      etykieta: 'Assessment + Report',
      opis: 'Pełna analiza z obu źródeł',
    },
    { wartosc: 'ASSESSMENT_ONLY', etykieta: 'Tylko Assessment', opis: 'Na podstawie samej oceny' },
    { wartosc: 'REPORT_ONLY', etykieta: 'Tylko Report', opis: 'Na podstawie raportu' },
  ],
  krokGlowny: {
    etykieta: 'Wybierz ocenę',
    placeholder: '— wybierz ocenę —',
    wielokrotny: false,
    lista: async () => {
      const resp: any = await Api.listAssessments({ limit: 200, offset: 0 });
      const list: any[] = Array.isArray(resp?.items)
        ? resp.items
        : Array.isArray(resp?.assessments)
          ? resp.assessments
          : [];
      return list.map((a: any) => ({
        id: String(a?.id || ''),
        nazwa: String(a?.name || a?.title || ''),
        opis: String(
          a?.assessmentType || a?.assessment_type || a?.type || 'ASSESSMENT'
        ).toUpperCase(),
      })) as OpcjaZrodla[];
    },
  },
  krokWtorny: {
    etykieta: 'Wybierz raport',
    placeholder: '— wybierz raport —',
    wielokrotny: false,
    widoczny: (tryb) => tryb !== 'ASSESSMENT_ONLY',
    tekstBezPoprzednika: 'Najpierw wybierz ocenę.',
    lista: async ({ glowny }) => {
      const assessmentId = glowny[0];
      if (!assessmentId) return [];
      const resp: any = await Api.get(
        `/assessment-reports?assessmentId=${encodeURIComponent(assessmentId)}`
      );
      const list: any[] = Array.isArray(resp?.reports) ? resp.reports : [];
      return list.map((r: any) => ({
        id: String(r.id),
        nazwa: String(r.name || r.title || 'Report'),
        opis: r.status ? String(r.status).toUpperCase() : undefined,
      })) as OpcjaZrodla[];
    },
  },
  wymagaTemplate: true,
  wymagaMetodologii: true,
  maxLiczba: 200,
  domyslnaLiczba: 20,

  generuj: async (a: ArgumentyGeneracji): Promise<WynikStartu> => {
    const assessmentId = a.glowny[0];
    const body: Record<string, unknown> = {
      mode: a.tryb,
      methodologyId: a.methodologyId,
      requestedCount: Math.max(1, Math.min(200, Number(a.liczba) || 1)),
      batchSize: 7,
      includeChatContext: a.includeChatContext,
      templateId: a.templateId,
    };
    if (a.tryb !== 'ASSESSMENT_ONLY' && a.wtorny[0]) body.reportId = a.wtorny[0];
    if (a.consultantBrief.trim()) body.consultantBrief = a.consultantBrief.trim();

    const resp: any = await Api.post(trasaBiegu(assessmentId), body);
    const runId = String(resp?.runId || '');
    if (!runId) throw new Error('Missing runId');
    return { rodzaj: 'bieg', uchwyt: { runId, kontekstId: assessmentId } };
  },

  postep: async (u: UchwytBiegu): Promise<PostepBiegu | null> => {
    const resp: any = await Api.get(trasaBiegu(u.kontekstId, u.runId));
    const run = resp?.run;
    if (!run) return null;
    return {
      status: run.status,
      generatedCount: Number(run.generatedCount || 0),
      requestedCount: Number(run.requestedCount || 0),
      batchesPlanned: Number(run.batchesPlanned || 0),
      batchesSucceeded: Number(run.batchesSucceeded || 0),
      batchesFailed: Number(run.batchesFailed || 0),
      error: run.error || null,
    };
  },

  wynikBiegu: async (u: UchwytBiegu): Promise<PodgladInicjatywy[]> => {
    const resp: any = await Api.get(`${trasaBiegu(u.kontekstId, u.runId)}/initiatives`);
    return Array.isArray(resp?.initiatives) ? resp.initiatives : [];
  },

  przeslijDoPrzegladu: async (u: UchwytBiegu): Promise<number> => {
    const resp: any = await Api.post(
      `${trasaBiegu(u.kontekstId, u.runId)}/submit-for-review`,
      {}
    );
    return Number(resp?.updated || 0);
  },
};
