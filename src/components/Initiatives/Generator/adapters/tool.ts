/**
 * Adapter `tool` — zatwierdzona sesja narzędzia.
 *
 * Endpoint bez zmian: `POST /tools/:toolId/generate-initiatives`. Walidator
 * `GenerateInitiativesSchema` (server/src/validators/tool.validators.ts)
 * dopuszcza `count` 1..7 — dlatego `maxLiczba` to 7, a nie 200; wystawienie
 * większego pola byłoby obietnicą, którą serwer odrzuci 400-tką.
 * Serwer nie zna template'ów inicjatywy → `wymagaTemplate: false`.
 */

import { Api } from '@/services/api';

import type {
  AdapterGeneratora,
  ArgumentyGeneracji,
  OpcjaZrodla,
  PodgladInicjatywy,
  WynikStartu,
} from '../types';

export const adapterTool: AdapterGeneratora = {
  id: 'tool',
  etykieta: 'Narzędzie',
  tryby: [
    {
      wartosc: 'TOOL_SESSION',
      etykieta: 'Sesja narzędzia',
      opis: 'Na podstawie zatwierdzonej sesji',
    },
  ],
  krokGlowny: {
    etykieta: 'Wybierz sesję narzędzia',
    placeholder: '— wybierz sesję —',
    wielokrotny: false,
    lista: async () => {
      const resp: any = await Api.listToolSessions({ status: 'approved', limit: 200, offset: 0 });
      const list: any[] = Array.isArray(resp?.items) ? resp.items : [];
      return list.map((s: any) => ({
        id: String(s.id),
        nazwa: String(s.name || s.toolType || 'Sesja'),
        opis: [s.toolType, s.status].filter(Boolean).map(String).join(' · ') || undefined,
      })) as OpcjaZrodla[];
    },
  },
  wymagaTemplate: false,
  wymagaMetodologii: true,
  maxLiczba: 7,
  domyslnaLiczba: 5,

  generuj: async (a: ArgumentyGeneracji): Promise<WynikStartu> => {
    const toolId = a.glowny[0];
    if (!toolId) throw new Error('Wybierz sesję narzędzia');
    const resp: any = await Api.generateToolInitiatives(toolId, {
      methodologyId: a.methodologyId,
      count: Math.max(1, Math.min(7, Number(a.liczba) || 1)),
      includeChatContext: a.includeChatContext,
    });
    const list: any[] = Array.isArray(resp?.initiatives)
      ? resp.initiatives
      : Array.isArray(resp?.created)
        ? resp.created
        : [];
    return {
      rodzaj: 'gotowe',
      inicjatywy: list.map((i: any) => ({
        id: String(i?.id || ''),
        title: String(i?.title || i?.name || 'Inicjatywa'),
        status: String(i?.status || 'DRAFT'),
      })) as PodgladInicjatywy[],
    };
  },
};

export type { OpcjaZrodla };
