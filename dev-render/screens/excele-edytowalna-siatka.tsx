/**
 * Dev-render host — ARKUSZ EDYTOWALNY, „Ocena opłacalności projektu (NPV/IRR)"
 * (2026-07-28, za flagą `ff_excele_edit`, domyślnie OFF).
 *
 * Render-verify obowiązkowy PRZED pokazaniem właścicielowi (CLAUDE.md #7) —
 * ten harness ładuje REALNY model, który Piotr zna: `projectViability`
 * (`server/src/services/workbook/templates/projectViability.ts`, tytuł
 * "Ocena opłacalności projektu (NPV/IRR)"). Uproszczona kopia (3 lata zamiast
 * dowolnego horyzontu, bez arkusza Wrażliwości — nieistotny dla testu edycji)
 * z DOKŁADNIE tą samą konwencją formuł co produkcyjny szablon: absolutne
 * cross-sheet referencje `'Założenia'!$B$n` (patrz `aRef()` w
 * projectViability.ts — NIE nazwana referencja, więc nasz klientowy silnik
 * formuł, który świadomie nie obsługuje nazwanych zakresów, liczy to poprawnie).
 *
 * Wzorowany na `dev-render/screens/sheet-artifact.tsx` (stub `Api.get`, nie
 * `window.fetch` — patrz pułapka opisana tam). Dodatkowo stubuje
 * `Api.updateWorkbookCell` STANOWO: mutuje `WORKBOOK.schema_json` w miejscu,
 * więc kolejny odczyt (np. po przełączeniu zakładki arkusza i powrocie) widzi
 * już zapisaną wartość — dowód, że trasa `PATCH /api/workbook/:id/cell`
 * (server/src/routes/workbook.routes.ts) jest realnie wołana i że jej
 * kontrakt (sheetIndex/rowIndex/columnKey/value|formula) pasuje do klienta.
 *
 * URL: ?screen=excele-edytowalna-siatka&theme=light|dark&lang=pl
 *      &ff_excele_edit=1   ← historycznie WYMAGANE; DZIŚ już nie ma znaczenia
 *                             (patrz notatka niżej).
 *
 * ★ USTALENIE (grafika 2026-08-31, przy naprawie "przyrząd zasłania produkt"):
 * ten opis i `&ff_excele_edit=1` są STALE. `ff_excele_edit`/`EditableSpreadsheetGrid`
 * żyją WYŁĄCZNIE w starej ścieżce `KimiWorkspaceShell` (`ExceleView.tsx`).
 * Ale ten sam plik od 2026-08-30 wymusza `ff.artifact_studio`+`ff.spreadsheet_studio_v2`
 * — a tor `spreadsheet` ma od 2026-08-30 DOMYŚLNIE `true`
 * (`src/utils/artifactStudioFlags.ts` LANE_DEFAULT_ENABLED, decyzja właściciela
 * "to co jest — włączyć i wypolerować"). Przy reopen istniejącego skoroszytu
 * (`effectivePreview?.type === 'xlsx' && effectiveWorkbookId`) `ExceleView.tsx`
 * renderuje wtedy `SpreadsheetArtifactStudio` (2560 linii, WŁASNY
 * `EditableSpreadsheetGrid` bez gate'a na `ff_excele_edit` i WŁASNY
 * `ArtifactRightPanel` zamiast `ExceleRightRail`) — `KimiWorkspaceShell`
 * (jedyne miejsce, gdzie `ff_excele_edit` cokolwiek zmienia) jest w tej ścieżce
 * NIEOSIĄGALNY. To dlatego ten zrzut i `excele-prawy-panel-standard.tsx`
 * (identyczny model WORKBOOK) wychodzą bajt w bajt identyczne — i to jest
 * ZGODNE ze stanem realnego produktu, nie błąd narzędzia zrzutowego. Naprawiać
 * nie ma czego: to jest właściwy stan dzisiejszy.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

import { ExceleView } from '@/components/AIChat/KimiWorkspace/ExceleView';
import { Api } from '@/services/api';

/**
 * ★ WŁĄCZONE NA PROŚBĘ WŁAŚCICIELA (2026-08-30): ten harness startuje z WŁĄCZONYM
 * pełnym warsztatem (`ff_artifactStudio` + tor arkusza/prezentacji).
 *
 * UWAGA — to NIE jest to, co widzi dziś użytkownik. Domyślnie obie flagi są
 * wyłączone i produkt pokazuje okrojoną wersję. Tu włączamy je celowo, żeby
 * właściciel mógł kliknąć warsztat, zanim zdecydujemy o włączeniu na stałe.
 * Żeby zobaczyć stan dzisiejszy: dopisz `&ff_artifactStudio=0` do adresu.
 */
if (typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  if (p.get('ff_artifactStudio') !== '0') {
    try {
      window.localStorage.setItem('ff.artifact_studio', '1');
      window.localStorage.setItem('ff.spreadsheet_studio_v2', '1');
      window.localStorage.setItem('ff.presentation_studio_v2', '1');
    } catch {
      /* prywatne okno — trudno, wtedy trzeba parametrem w adresie */
    }
  }
}

const ID = 'wb-dev-render-project-viability';

const kol = (key: string, header: string) => ({ key, header });
const wiersz = (cells: Record<string, { value?: unknown; formula?: string }>) => ({ cells });

// Założenia — dokładnie te 7 driverów co projectViability.ts (uproszczony
// horyzont: 3 lata zamiast parametrycznych 3–15).
const ZALOZENIA = {
  name: 'Założenia',
  columns: [kol('driver', 'Założenie'), kol('wartosc', 'Wartość')],
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
// Wiersze: 2=inwestycja 3=CF rok1 4=wzrost 5=stopa dyskontowa 6=wartość rezydualna 7=stopa podatkowa
const AR = { investment: 2, cf1: 3, growth: 4, discountRate: 5, residual: 6, taxRate: 7 };
const aRef = (row: number) => `'Założenia'!$B$${row}`;

// Przepływy — kolumny: pozycja(A) rok0(B) rok1(C) rok2(D) rok3(E). Ta sama
// struktura wierszy co ENGINE_ROW w projectViability.ts (gross/tax/net/
// discountFactor/discounted), skrócona do horyzontu 3 lat.
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

// Wyniki — NPV/IRR dokładnie jak w projectViability.ts buildWynikiSheet:
// NPV(rate, C4:E4)+B4 (rok0 dodany osobno, poza zakresem NPV — konwencja
// Excela: NPV() zakłada, że pierwsza wartość przypada na KONIEC okresu 1).
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

// Stub STANOWY (nie zamrożony — patrz lekcja "mock MUSI być stanowy",
// MEMORY.md noc-idee-fala-bugow-2026-07-27): mutuje WORKBOOK w miejscu, więc
// kolejny GET /workbook/:id (np. po przełączeniu zakładki i powrocie) widzi
// już zapisaną wartość — realny dowód trwałości kontraktu PATCH.
Api.updateWorkbookCell = (async (
  workbookId: string,
  payload: {
    sheetIndex: number;
    rowIndex: number;
    columnKey: string;
    value?: unknown;
    formula?: string;
  }
) => {
  if (workbookId !== ID) throw new Error('unknown workbook in dev-render stub');
  const sheet = WORKBOOK.schema_json.sheets[payload.sheetIndex] as {
    rows: Array<{ cells: Record<string, { value?: unknown; formula?: string }> }>;
  };
  const row = sheet.rows[payload.rowIndex];
  const nextCell =
    typeof payload.formula === 'string' && payload.formula.trim()
      ? { formula: payload.formula.trim() }
      : { value: payload.value ?? null };
  row.cells[payload.columnKey] = nextCell;
  return {
    ok: true,
    sheetIndex: payload.sheetIndex,
    rowIndex: payload.rowIndex,
    columnKey: payload.columnKey,
    cell: nextCell,
  };
}) as typeof Api.updateWorkbookCell;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

export default function ExceleEdytowalnaSiatkaScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      {/*
        GRAFIKA 2026-08-30: dołożony `FeatureFlagsProvider`.
        POWÓD: pełny pasek narzędzi arkusza (`SpreadsheetArtifactStudio` — wstaw
        wiersz/kolumnę, formatowanie, waluta, procent) ISTNIEJE w kodzie za dwiema
        flagami domyślnie wyłączonymi. Bez tego providera włączenie flag wywalało
        ekran (`useFeatureFlagsContext must be used within FeatureFlagsProvider`),
        więc NIE DAŁO SIĘ zobaczyć tego paska na zrzucie — a reguła #7 mówi, że
        właściciel nigdy nie jest pierwszym testerem wizualnym.
        Włączenie: `?ff_artifactStudio=1&ff_spreadsheetStudioV2=1`.
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
