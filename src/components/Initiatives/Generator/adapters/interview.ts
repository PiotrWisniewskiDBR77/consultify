/**
 * Adapter `interview` — wnioski z wywiadu.
 *
 * Silnik jest TEN SAM, którego używał stary „Kreator Inicjatyw AI"
 * (`Initiatives/Wizard/InitiativeWizardModal.tsx`): sesja kreatora
 * (`POST /initiatives/wizard/sessions`) → kandydaci z AI
 * (`POST /initiatives/wizard/sessions/:id/candidates/generate`) → utrwalenie
 * przez kanoniczny `createInitiativeWriteTruth` (proposal → register → zimny
 * odczyt). Nowy jest tylko ekran; ścieżka zapisu i lineage
 * (`source_type='interview_insight'`, `evidenceRefs: interview_insight:<id>`)
 * zostają bez zmian, więc odczyt `GET /initiatives?source=interview_insight`
 * w Wywiadzie dalej widzi swoje rekordy.
 *
 * Serwer kreatora nie zna template'ów inicjatywy — dlatego `wymagaTemplate`
 * jest tu `false` (patrz `types.ts`, uwaga o uczciwości powierzchni).
 */

import { Api } from '@/services/api';
import { V8InterviewApi } from '@/services/api/v8/interview';
import { createInitiativeWriteTruth } from '@/services/initiativeWriteTruth';

import type {
  AdapterGeneratora,
  ArgumentyGeneracji,
  OpcjaZrodla,
  PodgladInicjatywy,
  WynikStartu,
} from '../types';

export interface KontekstInterview {
  projectId: string;
  ownerUserId: string;
}

export function utworzAdapterInterview(ctx: KontekstInterview): AdapterGeneratora {
  return {
    id: 'interview',
    etykieta: 'Wywiad',
    tryby: [
      {
        wartosc: 'INTERVIEW_INSIGHTS',
        etykieta: 'Wnioski z wywiadu',
        opis: 'Na podstawie wybranych wniosków',
      },
    ],
    krokGlowny: {
      etykieta: 'Wybierz wnioski',
      placeholder: '— wybierz wnioski —',
      wielokrotny: true,
      lista: async () => {
        const resp = await V8InterviewApi.listInsights({ limit: 200, scope: 'active' });
        const list: any[] = Array.isArray((resp as any)?.insights) ? (resp as any).insights : [];
        return list.map((i: any) => ({
          id: String(i?.id || ''),
          nazwa: String(i?.title || i?.name || 'Wniosek'),
          opis: [i?.type, i?.status].filter(Boolean).map(String).join(' · ') || undefined,
        })) as OpcjaZrodla[];
      },
    },
    wymagaTemplate: false,
    wymagaMetodologii: false,
    maxLiczba: 20,
    domyslnaLiczba: 5,

    generuj: async (a: ArgumentyGeneracji): Promise<WynikStartu> => {
      const insightIds = a.glowny.filter(Boolean);
      if (insightIds.length === 0) throw new Error('Wybierz co najmniej jeden wniosek');
      if (!ctx.projectId || !ctx.ownerUserId) {
        throw new Error('Brak projektu lub właściciela — nie da się utrwalić inicjatywy');
      }

      const sessionResp: any = await Api.post('/initiatives/wizard/sessions', {
        projectId: ctx.projectId,
        mode: 'generate_from_evidence',
        businessPriorities: ['quality', 'automation', 'governance'],
        targetCount: Math.max(1, Math.min(20, Number(a.liczba) || 5)),
        timeHorizon: '90_days',
        riskAppetite: 'balanced',
        manualNotes: a.consultantBrief.trim(),
        sourceBasket: insightIds.map((id) => ({ type: 'interview_insight', id })),
      });
      const sessionId = String(sessionResp?.session?.id || '');
      if (!sessionId) throw new Error('Wizard session was not created');

      const candidatesResp: any = await Api.post(
        `/initiatives/wizard/sessions/${encodeURIComponent(sessionId)}/candidates/generate`,
        {}
      );
      const candidates: any[] = Array.isArray(candidatesResp?.candidates)
        ? candidatesResp.candidates
        : [];

      const evidenceRefs = insightIds.map((id) => `interview_insight:${id}`);
      const utworzone: PodgladInicjatywy[] = [];
      for (const c of candidates) {
        const result: any = await createInitiativeWriteTruth({
          projectId: ctx.projectId,
          initiativeOwnerId: ctx.ownerUserId,
          creationRequestId: `${sessionId}:${c.id}`,
          title: c.title,
          summary: c.opportunityStatement,
          description: c.rationale,
          problemStatement: c.problemStatement,
          axis: 'transformational',
          status: 'DRAFT',
          priority:
            Number(c.impactScore) >= 5 ? 'high' : Number(c.impactScore) >= 4 ? 'medium' : 'low',
          sourceType: 'interview_insight',
          sourceId: insightIds[0],
          evidenceRefs,
          tags: ['generator-inicjatyw', 'interview'],
        });
        const initiative = result?.truth?.initiative || result?.created?.initiative;
        if (initiative?.id) {
          utworzone.push({
            id: String(initiative.id),
            title: String(initiative.name || initiative.title || c.title),
            status: String(initiative.status || 'DRAFT'),
          });
        }
      }

      try {
        await Api.post(
          `/initiatives/wizard/sessions/${encodeURIComponent(sessionId)}/drafts-created`,
          {
            draftCount: utworzone.length,
            candidateIds: candidates.map((c: any) => c.id),
          }
        );
      } catch {
        // ślad audytu jest dodatkiem — brak wpisu nie unieważnia utworzonych inicjatyw
      }

      return { rodzaj: 'gotowe', inicjatywy: utworzone };
    },
  };
}
