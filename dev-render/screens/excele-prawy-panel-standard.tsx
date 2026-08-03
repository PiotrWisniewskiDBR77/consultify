/**
 * Dev-render host — Excel PRAWY PANEL jako SZYNA IKON (2026-07-28), za flagą
 * `ff_excele_right_rail` (domyślnie OFF, `src/utils/exceleRightRailFlag.ts`).
 *
 * Zgłoszenie Piotra (żywe demo): otwarty "Pusty arkusz" (breadcrumb
 * Materials › Sheets › Sheet) pokazywał po prawej pionowy ACCORDION
 * (Akcje·Właściwości·Powiązania·Komentarze·Historia) z jawną atrapą w
 * Komentarzach ("Komentarze będą dostępne wkrótce") — zupełnie inaczej niż
 * Word, gdzie prawa strona to szyna ikon (klik → panel).
 *
 * Ten harness renderuje REALNY `ExceleView` z NIEPUSTYM skoroszytem (model
 * "Ocena opłacalności projektu (NPV/IRR)" — 3 arkusze: Założenia/Przepływy/
 * Wyniki), bo właściciel utknął akurat na PUSTYM arkuszu i to nie może się
 * powtórzyć na zrzucie odbioru. Dane 1:1 z `excele-edytowalna-siatka.tsx`
 * (ten sam model, bez flagi edycji — tu weryfikujemy TYLKO prawy panel).
 *
 * URL: ?screen=excele-prawy-panel-standard&theme=light|dark&lang=pl
 *      &ff_excele_right_rail=1   ← WYMAGANE, żeby zobaczyć szynę zamiast
 *                                    starego accordionu (flaga domyślnie OFF)
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

const ID = 'wb-dev-render-prawy-panel';

const kol = (key: string, header: string) => ({ key, header });
const wiersz = (cells: Record<string, { value?: unknown; formula?: string }>) => ({ cells });

const ZALOZENIA = {
  name: 'Założenia',
  columns: [kol('driver', 'Driver'), kol('wartosc', 'Wartość')],
  rows: [
    wiersz({ driver: { value: 'Nakład początkowy (inwestycja)' }, wartosc: { value: 500000 } }),
    wiersz({ driver: { value: 'Przepływ operacyjny brutto — rok 1' }, wartosc: { value: 220000 } }),
    wiersz({ driver: { value: 'Wzrost przepływów % rocznie' }, wartosc: { value: 0.06 } }),
    wiersz({
      driver: { value: 'Stopa dyskontowa (wymagana stopa zwrotu)' },
      wartosc: { value: 0.1 },
    }),
    wiersz({
      driver: { value: 'Wartość rezydualna (koniec horyzontu)' },
      wartosc: { value: 50000 },
    }),
    wiersz({ driver: { value: 'Stopa podatkowa' }, wartosc: { value: 0.19 } }),
  ],
};
const AR = { investment: 2, cf1: 3, growth: 4, discountRate: 5, residual: 6, taxRate: 7 };
const aRef = (row: number) => `'Założenia'!$B$${row}`;

const PRZEPLYWY = {
  name: 'Przepływy',
  columns: [
    kol('pozycja', 'Pozycja'),
    kol('rok0', 'Rok 0'),
    kol('rok1', 'Rok 1'),
    kol('rok2', 'Rok 2'),
    kol('rok3', 'Rok 3'),
  ],
  rows: [
    wiersz({
      pozycja: { value: 'Przepływ operacyjny brutto' },
      rok1: { formula: aRef(AR.cf1) },
      rok2: { formula: `C2*(1+${aRef(AR.growth)})` },
      rok3: { formula: `D2*(1+${aRef(AR.growth)})` },
    }),
    wiersz({
      pozycja: { value: 'Podatek od przepływu operacyjnego' },
      rok1: { formula: `MAX(C2,0)*${aRef(AR.taxRate)}` },
      rok2: { formula: `MAX(D2,0)*${aRef(AR.taxRate)}` },
      rok3: { formula: `MAX(E2,0)*${aRef(AR.taxRate)}` },
    }),
    wiersz({
      pozycja: { value: 'Przepływ pieniężny netto' },
      rok0: { formula: `-${aRef(AR.investment)}` },
      rok1: { formula: 'C2-C3' },
      rok2: { formula: 'D2-D3' },
      rok3: { formula: `E2-E3+${aRef(AR.residual)}` },
    }),
    wiersz({
      pozycja: { value: 'Współczynnik dyskontowy' },
      rok0: { formula: `1/(1+${aRef(AR.discountRate)})^0` },
      rok1: { formula: `1/(1+${aRef(AR.discountRate)})^1` },
      rok2: { formula: `1/(1+${aRef(AR.discountRate)})^2` },
      rok3: { formula: `1/(1+${aRef(AR.discountRate)})^3` },
    }),
    wiersz({
      pozycja: { value: 'Zdyskontowany przepływ netto' },
      rok0: { formula: 'B4*B5' },
      rok1: { formula: 'C4*C5' },
      rok2: { formula: 'D4*D5' },
      rok3: { formula: 'E4*E5' },
    }),
  ],
};

const WYNIKI = {
  name: 'Wyniki',
  columns: [kol('metryka', 'Metryka'), kol('wartosc', 'Wartość')],
  rows: [
    wiersz({
      metryka: { value: 'NPV (wartość bieżąca netto)' },
      wartosc: { formula: `NPV(${aRef(AR.discountRate)},'Przepływy'!C4:E4)+'Przepływy'!B4` },
    }),
    wiersz({
      metryka: { value: 'IRR (wewnętrzna stopa zwrotu)' },
      wartosc: { formula: `IRR('Przepływy'!B4:E4)` },
    }),
    wiersz({
      metryka: { value: 'Suma zdyskontowanych przepływów (lata 1–3)' },
      wartosc: { formula: `SUM('Przepływy'!C6:E6)` },
    }),
  ],
};

const WORKBOOK = {
  id: ID,
  title: 'Ocena opłacalności projektu (NPV/IRR)',
  schema_json: {
    title: 'Ocena opłacalności projektu (NPV/IRR)',
    sheets: [ZALOZENIA, PRZEPLYWY, WYNIKI],
  },
};

const oryginalnyGet = Api.get.bind(Api);
Api.get = (async (url: string, ...reszta: unknown[]) => {
  if (typeof url === 'string' && url.includes(`/workbook/${ID}`)) return WORKBOOK;
  return oryginalnyGet(url, ...(reszta as []));
}) as typeof Api.get;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExcelePrawyPanelStandardScreen(): React.ReactElement {
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
