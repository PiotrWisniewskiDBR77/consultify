/**
 * Adapter `audit` — ustalenia programu audytu.
 *
 * Endpoint ISTNIEJE i nie trzeba go dopisywać:
 * `POST /audits/proposals { programId, findingIds[] }` →
 * `proposalService.draftProposalsFromFindings`. W module Audyty „inicjatywa"
 * na etapie draftu jest PROPOZYCJĄ (zakładka `initiatives` renderuje
 * `GET /audits/proposals`), a promocja do realnej inicjatywy to osobne,
 * istniejące przejście `POST /audits/proposals/:id/register` w kebabie wiersza
 * — dlatego generator kończy się na propozycjach i niczego nie dubluje.
 */

import { Api } from '@/services/api';
import { listFindings, listPrograms } from '@/components/Audit/method/auditsMethodApi';

import type {
  AdapterGeneratora,
  ArgumentyGeneracji,
  OpcjaZrodla,
  PodgladInicjatywy,
  WynikStartu,
} from '../types';

export const adapterAudit: AdapterGeneratora = {
  id: 'audit',
  etykieta: 'Audyt',
  tryby: [
    {
      wartosc: 'AUDIT_FINDINGS',
      etykieta: 'Ustalenia audytu',
      opis: 'Na podstawie potwierdzonych ustaleń',
    },
  ],
  krokGlowny: {
    etykieta: 'Wybierz program audytu',
    placeholder: '— wybierz program —',
    wielokrotny: false,
    lista: async () => {
      const res = await listPrograms({ limit: 200 });
      return res.items.map((p: any) => ({
        id: String(p.id),
        nazwa: String(p.name || 'Program'),
        opis: p.lifecycleState ? String(p.lifecycleState) : undefined,
      })) as OpcjaZrodla[];
    },
  },
  krokWtorny: {
    etykieta: 'Wybierz ustalenia',
    placeholder: '— wybierz ustalenia —',
    wielokrotny: true,
    tekstBezPoprzednika: 'Najpierw wybierz program audytu.',
    lista: async ({ glowny }) => {
      const programId = glowny[0];
      if (!programId) return [];
      const res = await listFindings({ programId, limit: 200 });
      return res.items.map((f: any) => ({
        id: String(f.id),
        nazwa: String(f.statement || f.title || 'Ustalenie'),
        opis: [f.severity, f.status].filter(Boolean).map(String).join(' · ') || undefined,
      })) as OpcjaZrodla[];
    },
  },
  wymagaTemplate: false,
  wymagaMetodologii: false,
  maxLiczba: 50,
  domyslnaLiczba: 5,

  generuj: async (a: ArgumentyGeneracji): Promise<WynikStartu> => {
    const programId = a.glowny[0];
    const findingIds = a.wtorny.filter(Boolean);
    if (!programId) throw new Error('Wybierz program audytu');
    if (findingIds.length === 0) throw new Error('Wybierz co najmniej jedno ustalenie');
    const resp: any = await Api.post('/audits/proposals', {
      programId,
      findingIds,
      splitBy: 'none',
    });
    const list: any[] = Array.isArray(resp?.data) ? resp.data : Array.isArray(resp) ? resp : [];
    return {
      rodzaj: 'gotowe',
      inicjatywy: list.map((p: any) => ({
        id: String(p?.id || ''),
        title: String(p?.title || p?.suggestedTitle || 'Propozycja'),
        status: String(p?.status || 'DRAFT'),
      })) as PodgladInicjatywy[],
    };
  },
};
