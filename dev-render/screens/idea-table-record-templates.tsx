/**
 * RISK-06 — dev-render host for the REAL `<RecordTemplateManager>` (src/
 * components/MyWork/table/RecordTemplateManager.tsx), CLAUDE.md #7 (owner is
 * never the first visual tester).
 *
 * This component was a DEAD MOUNT: `grep -rln RecordTemplateManager src/`
 * only ever found the file itself + `ideaActionRegistry.ts`'s `source:`
 * comment strings — zero components imported it, despite a real backend
 * (server/src/routes/table-platform.routes.ts `/tables/:tableId/
 * record-templates`) and two registered actions (`table.record_template.*`).
 * Now wired into `TableToolbar`'s "More" menu (Tools section, usePlatform
 * only) — see `tests/components/MyWork/TableToolbar.recordTemplates.test.tsx`
 * for the reachability proof. This harness screenshots the dialog itself
 * BEFORE the owner sees it live.
 *
 * `RecordTemplateManager` is the REAL production component — no
 * re-implementation. It self-fetches via `TablePlatformApi.listRecordTemplates`
 * (a named async export, not a patchable `Api`-style singleton object — see
 * decision-record.tsx's comment on why `Api` is patchable; this module isn't
 * that shape), so the mock below intercepts `window.fetch` for the ONE URL
 * that module calls. Same escape hatch `prezentacje-template-states.tsx` uses
 * for its safety net, and for the same reason: there is no `Api.<method>` to
 * patch here.
 *
 * ★ PROSTUJE BŁĄD Z 2026-08-30 (przegląd przed odbiorem, ekran odrzucony).
 * Do tego dnia ten harness NIE mockował niczego, a komentarz wyżej twierdził,
 * że lista jest wtedy „naturalnie pusta (No templates yet)" i że to „uczciwy
 * render". To była nieprawda w dwóch miejscach:
 *   1. Właściciel nie widział pustej listy — widział pustą listę PLUS dwie
 *      czerwone pastylki „Nie udało się załadować szablonów" (fetch pada, a
 *      `React.StrictMode` w `dev-render/main.tsx:1687` montuje efekt dwa razy,
 *      stąd DWIE, nie jedna).
 *   2. „Awaria ładowania" i „zero szablonów" to DWA RÓŻNE stany produktu, a
 *      harness pokazywał je jako jeden. Ekran nie mógł być odebrany, bo nikt
 *      nie widział stanu, który miał oceniać.
 *
 * Teraz stan wybiera się jawnie z adresu (`?stan=`), a domyślny jest ten,
 * którego dotyczy odbiór: lista z realnymi szablonami.
 *
 * The "New Template" editor (`TemplateEditor`, opened via the "+ New"
 * button) does NOT fetch anything — it's a pure form keyed off the `fields`
 * prop — so clicking through to it in the live dev-render tab gives a fully
 * real, fully populated second screenshot (every editable field type:
 * singleLineText, longText, number, singleSelect, checkbox, date).
 *
 * URL: ?screen=idea-table-record-templates[&lang=pl|en][&theme=light|dark]
 *        [&stan=lista|pusty|blad]
 *   stan=lista (domyślny) — trzy realne szablony rekordów,
 *   stan=pusty            — backend odpowiada `{ templates: [] }` (PRAWDZIWA pustka),
 *   stan=blad             — backend odpowiada 500 (stan awarii ładowania).
 */
import React from 'react';

import { RecordTemplateManager } from '@/components/MyWork/table/RecordTemplateManager';
import type { TablePlatformField } from '@/types/tablePlatform';

const params = new URLSearchParams(window.location.search);
const isPl = (params.get('lang') || 'pl') !== 'en';
const stan = (params.get('stan') || 'lista') as 'lista' | 'pusty' | 'blad';

/**
 * Mock backendu — WYŁĄCZNIE dla `GET .../record-templates`.
 *
 * Dlaczego `window.fetch`, a nie `Api.<metoda>` (konwencja dev-render): ten
 * ekran nie chodzi przez singleton `Api`, tylko przez moduł ESM
 * `src/services/api/tablePlatform.api.ts` z NAZWANYMI eksportami — nie ma tam
 * obiektu, któremu można podmienić metodę. Wzór z
 * `dev-render/screens/prezentacje-template-states.tsx` (ten sam wyjątek, ta
 * sama przyczyna). Filtr jest wąski: każdy inny adres leci do prawdziwego
 * `fetch`, więc i18n z `public/locales/**` działa normalnie.
 *
 * Montowane na poziomie MODUŁU, nie w efekcie Reacta: `main.tsx` ładuje ekrany
 * przez `React.lazy`, więc ten kod wykonuje się tylko dla tego ekranu i ZANIM
 * `RecordTemplateManager` zdąży odpalić swój `useEffect`.
 */
const SZABLONY = [
  {
    id: 'tpl-1',
    tableId: 'mock-table',
    name: isPl ? 'Zadanie wdrożeniowe' : 'Rollout task',
    data: {
      label: isPl ? 'Zadanie wdrożeniowe' : 'Rollout task',
      status: 'todo',
      owner: 'Ala Kowalska',
      effort: 3,
      urgent: false,
    },
    createdAt: '2026-08-20T09:00:00Z',
    updatedAt: '2026-08-20T09:00:00Z',
  },
  {
    id: 'tpl-2',
    tableId: 'mock-table',
    name: isPl ? 'Ryzyko do przeglądu' : 'Risk for review',
    data: {
      label: isPl ? 'Ryzyko do przeglądu' : 'Risk for review',
      status: 'in_progress',
      owner: 'Piotr Wiśniewski',
      effort: 5,
      urgent: true,
    },
    createdAt: '2026-08-22T11:30:00Z',
    updatedAt: '2026-08-26T08:15:00Z',
  },
  {
    id: 'tpl-3',
    tableId: 'mock-table',
    name: isPl ? 'Wniosek z warsztatu' : 'Workshop finding',
    data: {
      label: isPl ? 'Wniosek z warsztatu' : 'Workshop finding',
      status: 'done',
      owner: 'Marek Nowak',
      effort: 1,
      urgent: false,
    },
    createdAt: '2026-08-25T14:05:00Z',
    updatedAt: '2026-08-25T14:05:00Z',
  },
];

const g = window as unknown as { __REC_TPL_FETCH__?: boolean };
if (!g.__REC_TPL_FETCH__) {
  g.__REC_TPL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    if (url.includes('/record-templates')) {
      if (stan === 'blad') {
        return new Response(JSON.stringify({ error: 'INTERNAL' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ templates: stan === 'pusty' ? [] : SZABLONY }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return realFetch(input as RequestInfo, init);
  };
}

const FIELDS: TablePlatformField[] = [
  {
    id: 'label',
    tableId: 'mock-table',
    name: isPl ? 'Nazwa' : 'Label',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 0,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'status',
    tableId: 'mock-table',
    name: 'Status',
    fieldType: 'singleSelect',
    options: {
      options: [
        { id: 'todo', name: isPl ? 'Do zrobienia' : 'To do' },
        { id: 'in_progress', name: isPl ? 'W toku' : 'In progress' },
        { id: 'done', name: isPl ? 'Zrobione' : 'Done' },
      ],
    },
    isComputed: false,
    order: 1,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'owner',
    tableId: 'mock-table',
    name: isPl ? 'Właściciel' : 'Owner',
    fieldType: 'singleLineText',
    options: {},
    isComputed: false,
    order: 2,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'effort',
    tableId: 'mock-table',
    name: isPl ? 'Wysiłek' : 'Effort',
    fieldType: 'number',
    options: {},
    isComputed: false,
    order: 3,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'due_date',
    tableId: 'mock-table',
    name: isPl ? 'Termin' : 'Due date',
    fieldType: 'date',
    options: {},
    isComputed: false,
    order: 4,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'urgent',
    tableId: 'mock-table',
    name: isPl ? 'Pilne' : 'Urgent',
    fieldType: 'checkbox',
    options: {},
    isComputed: false,
    order: 5,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  {
    id: 'notes',
    tableId: 'mock-table',
    name: isPl ? 'Notatki' : 'Notes',
    fieldType: 'longText',
    options: {},
    isComputed: false,
    order: 6,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
  // Computed field — must be EXCLUDED from TemplateEditor's editable list
  // (EDITABLE_FIELD_TYPES check + `!f.isComputed`).
  {
    id: 'age_days',
    tableId: 'mock-table',
    name: isPl ? 'Wiek (dni)' : 'Age (days)',
    fieldType: 'number',
    options: {},
    isComputed: true,
    order: 7,
    createdAt: '2026-08-12T09:00:00Z',
    updatedAt: '2026-08-12T09:00:00Z',
  },
];

export function IdeaTableRecordTemplatesScreen(): React.ReactElement {
  return (
    <div className="flex h-screen w-full flex-col bg-c-bg p-6">
      <div className="mb-3 text-[11px] text-c-text-muted">
        {isPl
          ? `Dev-render — RISK-06 RecordTemplateManager. Backend zamockowany, stan="${stan}" (?stan=lista|pusty|blad). Kliknij "+ Nowa", aby zobaczyć TemplateEditor ze wszystkimi typami pól.`
          : `Dev-render — RISK-06 RecordTemplateManager. Backend mocked, state="${stan}" (?stan=lista|pusty|blad). Click "+ New" to see TemplateEditor with every field type.`}
      </div>
      <RecordTemplateManager
        open
        onClose={() => {}}
        tableId="mock-table"
        fields={FIELDS}
        onUseTemplate={() => {}}
        locked={false}
      />
    </div>
  );
}

export default IdeaTableRecordTemplatesScreen;
