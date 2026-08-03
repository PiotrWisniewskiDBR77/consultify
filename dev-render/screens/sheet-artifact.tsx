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

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function SheetArtifactScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/excele?artifactId=${ID}`]}>
        <div className="h-screen w-full overflow-hidden bg-c-bg">
          <ExceleView />
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
