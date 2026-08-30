/**
 * Dev-render host — ARKUSZ JAKO GOTOWY OBIEKT (odbiór 2026-07-23).
 *
 * Ekran `excele-engine-reveal` montuje ten sam `ExceleView`, ale bez `?artifactId`,
 * więc widok zatrzymuje się na stanie HOME (wejście do modułu). Realny obiekt —
 * split-screen z zakładkami arkuszy, siatką i formułami — pokazuje się dopiero
 * po podaniu artifactId: `ExceleView` woła wtedy `Api.get('/workbook/:id')`
 * i mapuje `schema_json.sheets` przez `buildWorkbookGridSheets`.
 *
 * Stąd ten host: podaje artifactId w routerze i stubuje `Api.get` mockiem
 * wielo-arkuszowego workbooka (wartości + formuły), żeby odbiór szedł bez backendu.
 *
 * Stub zakłada metodę `Api.get`, NIE `window.fetch` — patchowanie fetch nie działa
 * dla wywołań idących przez warstwę Api (pułapka dev-render, 2026-07-23).
 *
 * URL: ?screen=sheet-artifact&theme=light|dark&lang=pl|en
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

/**
 * ★ HARNESS NIE WYMUSZA FLAG (zmiana 2026-08-30).
 *
 * Do 30.08 ten plik wpisywał `ff.artifact_studio` i `ff.spreadsheet_studio_v2`
 * do localStorage, bo warsztat był domyślnie wyłączony. Po decyzji właściciela
 * („To, co jest — włączyć i wypolerować.") tor arkusza jest DOMYŚLNIE włączony
 * w `src/utils/artifactStudioFlags.ts`, więc harness pokazuje stan PRODUKTU,
 * a nie stan podrasowany przez harness — inaczej zrzut odbiorowy przestaje
 * cokolwiek mierzyć (pułapka „harness kłamie").
 *
 * Stan SPRZED włączenia: dopisz `&ff_artifactStudio=0` do adresu.
 */

const ID = 'wb-odbior-2026-07-23';

/** Kolumna w kształcie oczekiwanym przez buildWorkbookGridSheets. */
const kol = (key: string, header: string) => ({ key, header });

/** Wiersz: mapa klucz kolumny → { value } albo { formula }. */
const wiersz = (cells: Record<string, { value?: unknown; formula?: string }>) => ({ cells });

const WORKBOOK = {
  id: ID,
  title: 'Model marży projektu wdrożeniowego',
  schema_json: {
    title: 'Model marży projektu wdrożeniowego',
    sheets: [
      {
        name: 'Założenia',
        columns: [
          kol('poz', 'Pozycja'),
          kol('wart', 'Wartość'),
          kol('jedn', 'Jednostka'),
          kol('zrodlo', 'Źródło'),
        ],
        rows: [
          wiersz({
            poz: { value: 'Stawka dzienna konsultanta' },
            wart: { value: 4200 },
            jedn: { value: 'PLN/dzień' },
            zrodlo: { value: 'Cennik 2026 Q3' },
          }),
          wiersz({
            poz: { value: 'Koszt własny dnia' },
            wart: { value: 2450 },
            jedn: { value: 'PLN/dzień' },
            zrodlo: { value: 'Kontroling, VI 2026' },
          }),
          wiersz({
            poz: { value: 'Liczba dni w projekcie' },
            wart: { value: 62 },
            jedn: { value: 'dni' },
            zrodlo: { value: 'Harmonogram v4' },
          }),
          wiersz({
            poz: { value: 'Udział podwykonawcy' },
            wart: { value: 0.18 },
            jedn: { value: '%' },
            zrodlo: { value: 'Umowa ramowa' },
          }),
        ],
      },
      {
        name: 'Kalkulacja',
        columns: [
          kol('etap', 'Etap'),
          kol('dni', 'Dni'),
          kol('przychod', 'Przychód'),
          kol('koszt', 'Koszt'),
          kol('marza', 'Marża'),
        ],
        rows: [
          wiersz({
            etap: { value: 'Diagnoza' },
            dni: { value: 12 },
            przychod: { formula: 'B2*Założenia!B2' },
            koszt: { formula: 'B2*Założenia!B3' },
            marza: { formula: 'C2-D2' },
          }),
          wiersz({
            etap: { value: 'Projekt rozwiązania' },
            dni: { value: 20 },
            przychod: { formula: 'B3*Założenia!B2' },
            koszt: { formula: 'B3*Założenia!B3' },
            marza: { formula: 'C3-D3' },
          }),
          wiersz({
            etap: { value: 'Wdrożenie' },
            dni: { value: 24 },
            przychod: { formula: 'B4*Założenia!B2' },
            koszt: { formula: 'B4*Założenia!B3' },
            marza: { formula: 'C4-D4' },
          }),
          wiersz({
            etap: { value: 'Stabilizacja' },
            dni: { value: 6 },
            przychod: { formula: 'B5*Założenia!B2' },
            koszt: { formula: 'B5*Założenia!B3' },
            marza: { formula: 'C5-D5' },
          }),
          wiersz({
            etap: { value: 'RAZEM' },
            dni: { formula: 'SUM(B2:B5)' },
            przychod: { formula: 'SUM(C2:C5)' },
            koszt: { formula: 'SUM(D2:D5)' },
            marza: { formula: 'SUM(E2:E5)' },
          }),
        ],
      },
      {
        name: 'Wrażliwość',
        columns: [
          kol('scen', 'Scenariusz'),
          kol('stawka', 'Stawka'),
          kol('marza', 'Marża'),
          kol('proc', 'Marża %'),
        ],
        rows: [
          wiersz({
            scen: { value: 'Presja cenowa −10%' },
            stawka: { formula: 'Założenia!B2*0,9' },
            marza: { formula: 'B2*Kalkulacja!B6-Kalkulacja!D6' },
            proc: { formula: 'C2/(B2*Kalkulacja!B6)' },
          }),
          wiersz({
            scen: { value: 'Plan bazowy' },
            stawka: { formula: 'Założenia!B2' },
            marza: { formula: 'Kalkulacja!E6' },
            proc: { formula: 'C3/Kalkulacja!C6' },
          }),
          wiersz({
            scen: { value: 'Premia za pilność +8%' },
            stawka: { formula: 'Założenia!B2*1,08' },
            marza: { formula: 'B4*Kalkulacja!B6-Kalkulacja!D6' },
            proc: { formula: 'C4/(B4*Kalkulacja!B6)' },
          }),
        ],
      },
    ],
  },
};

const oryginalnyGet = Api.get.bind(Api);
Api.get = (async (url: string, ...reszta: unknown[]) => {
  if (typeof url === 'string' && url.includes(`/workbook/${ID}`)) return WORKBOOK;
  // Pozostałe wywołania oddajemy dalej — inne screeny mają własne stuby.
  return oryginalnyGet(url, ...(reszta as []));
}) as typeof Api.get;

/**
 * ★ STUB POLECEŃ SKOROSZYTU (2026-08-30).
 *
 * Audyt `ARKUSZ_PREZENTACJA_PLAN.md` kończył się zdaniem „czego NIE
 * udowodniłem": harness stubował tylko `Api.get`, więc każde polecenie
 * edycyjne szło w `POST /api/workbook/:id/commands`, dostawało 404 i nic
 * się nie działo. Bez tego stubu NIE DA SIĘ pokazać zrzutem, że wstawianie
 * kolumn i formatowanie realnie działa — a „testy przeszły" ≠ „działa".
 *
 * To jest atrapa SERWERA, nie produktu: stosuje operacje na kopii schematu
 * w pamięci karty. Ścieżka kliencka (rejestr poleceń → kontroler → `Api`)
 * jest przechodzona w całości, prawdziwa.
 *
 * `&stub=0` w adresie WYŁĄCZA stub — wtedy widać ścieżkę porażki (404) i to,
 * czy warsztat uczciwie mówi, że nie zapisał.
 */
type Komorka = { value?: unknown; formula?: string; style?: Record<string, unknown> };
type Arkusz = {
  name: string;
  columns: Array<{ key: string; header: string }>;
  rows: Array<{ cells: Record<string, Komorka> }>;
};

const stubWlaczony =
  typeof window === 'undefined' ||
  new URLSearchParams(window.location.search).get('stub') !== '0';

if (stubWlaczony) {
  let wersja = 0;
  const stan: Arkusz[] = JSON.parse(JSON.stringify(WORKBOOK.schema_json.sheets));

  const zastosuj = (op: Record<string, unknown>): void => {
    const arkusz = stan[Number(op.sheetIndex ?? 0)];
    if (!arkusz) return;
    const typ = String(op.type);
    if (typ === 'setCell' || typ === 'clearCell') {
      const wiersz = arkusz.rows[Number(op.rowIndex)];
      const klucz = String(op.columnKey);
      if (!wiersz) return;
      wiersz.cells[klucz] =
        typ === 'clearCell'
          ? {}
          : {
              ...(wiersz.cells[klucz] ?? {}),
              ...(op.formula != null
                ? { formula: String(op.formula), value: undefined }
                : { value: op.value as unknown, formula: undefined }),
            };
      return;
    }
    if (typ === 'insertColumns') {
      const ile = Number(op.count ?? 1);
      const gdzie = Number(op.atIndex ?? 0);
      for (let i = 0; i < ile; i += 1) {
        const klucz = `nowa_${Date.now()}_${i}`;
        arkusz.columns.splice(gdzie + i, 0, { key: klucz, header: 'Nowa kolumna' });
        arkusz.rows.forEach((wiersz) => {
          wiersz.cells[klucz] = {};
        });
      }
      return;
    }
    if (typ === 'deleteColumns') {
      const usuwane = arkusz.columns.splice(Number(op.atIndex ?? 0), Number(op.count ?? 1));
      arkusz.rows.forEach((wiersz) => {
        usuwane.forEach((kolumna) => delete wiersz.cells[kolumna.key]);
      });
      return;
    }
    if (typ === 'insertRows') {
      const puste = Array.from({ length: Number(op.count ?? 1) }, () => ({
        cells: Object.fromEntries(arkusz.columns.map((k) => [k.key, {}])),
      }));
      arkusz.rows.splice(Number(op.atIndex ?? 0), 0, ...puste);
      return;
    }
    if (typ === 'deleteRows') {
      arkusz.rows.splice(Number(op.atIndex ?? 0), Number(op.count ?? 1));
      return;
    }
    if (typ === 'setCellStyle') {
      const patch = (op.patch ?? {}) as Record<string, unknown>;
      for (let r = Number(op.startRow ?? 0); r <= Number(op.endRow ?? 0); r += 1) {
        for (let c = Number(op.startColumn ?? 0); c <= Number(op.endColumn ?? 0); c += 1) {
          const klucz = arkusz.columns[c]?.key;
          const wiersz = arkusz.rows[r];
          if (!klucz || !wiersz) continue;
          wiersz.cells[klucz] = {
            ...(wiersz.cells[klucz] ?? {}),
            style: { ...((wiersz.cells[klucz]?.style as object) ?? {}), ...patch },
          };
        }
      }
    }
  };

  Api.applyWorkbookCommands = (async (
    _id: string,
    payload: { operations: Array<Record<string, unknown>> }
  ) => {
    payload.operations.forEach(zastosuj);
    wersja += 1;
    return { version: wersja };
  }) as typeof Api.applyWorkbookCommands;

  Api.getWorkbookSchema = (async () => ({
    id: ID,
    title: WORKBOOK.title,
    description: null,
    sheets: JSON.parse(JSON.stringify(stan)),
  })) as typeof Api.getWorkbookSchema;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function SheetArtifactScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        GRAFIKA 2026-08-30: dolozony `FeatureFlagsProvider` (1:1 jak w
        `excele-edytowalna-siatka.tsx`). POWOD: naglowek tego pliku wlacza
        `ff.artifact_studio` + `ff.spreadsheet_studio_v2`, a wtedy `ExceleView`
        montuje `SpreadsheetArtifactStudio`, ktory przez `useOpenChatWithContext`
        czyta `useFeatureFlagsContext`. Bez providera ekran wywalal sie na
        `useFeatureFlagsContext must be used within FeatureFlagsProvider` i zrzut
        pokazywal czerwony stos zamiast arkusza — czyli NIE DALO SIE zmierzyc
        stanu zastanego (regula #7).
      */}
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <MemoryRouter initialEntries={[`/excele?artifactId=${ID}`]}>
          <div className="h-screen w-full overflow-hidden bg-c-bg">
            <ExceleView />
          </div>
        </MemoryRouter>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}
