/**
 * financeKpiLabels — wskaźniki analizy finansowej po polsku: NAZWA, KATEGORIA,
 * WZÓR i OGÓLNA ZASADA INTERPRETACJI.
 *
 * ★ POWÓD (audyt FIN 2026-09-06, `evidence/audyt-mvp-20260906/FIN/RAPORT_FIN.md`
 * defekt #6, zrzut `06-analiza-karta.png`), trzy osobne wycieki na jednym ekranie:
 *   1. nazwy wskaźników po angielsku („Cash Conversion Cycle", „Debt to EBITDA (LTM)")
 *      — brane wprost z `finance_analysis_kpi_catalog.kpi_name`;
 *   2. kategorie SCREAMING_CASE po angielsku („EFFICIENCY", „LIQUIDITY", „LEVERAGE")
 *      — brane wprost z `finance_analysis_kpi_catalog.category`;
 *   3. kolumna „WZÓR" pokazywała `catalog.description`, czyli KOMENTARZ Z KODU
 *      ŹRÓDŁOWEGO: „…composed from the three underlying KPI catalog entries via
 *      formula_ref (DRY at the AST level, ADR section 5.4)." — ten sam tekst był
 *      zduplikowany w kolumnie „INTERPRETACJA" (`AnalysisWorkspace.tsx` ustawiało
 *      `formulaDisplay` i `interpretationGeneral` z JEDNEGO pola).
 *
 * `description` w katalogu jest notatką inżynierską dla autora formuły, nie
 * treścią dla CFO — ten moduł rozdziela WZÓR (co dzieli się przez co) od
 * INTERPRETACJI (co wyższa/niższa wartość znaczy), obie po polsku.
 *
 * Zakres: 18 wskaźników katalogu P0 (`20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`).
 * Kod spoza tej listy (KPI własne organizacji) NIE dostaje zmyślonej treści —
 * `financeKpiName` cofa się do nazwy z katalogu, a wzór/interpretacja zostają puste.
 */

export interface FinanceKpiLabel {
  /** Nazwa wskaźnika po polsku; skrót branżowy w nawiasie, gdy jest w powszechnym użyciu. */
  namePl: string;
  /** Wzór CZYTELNY: „Aktywa obrotowe / Zobowiązania krótkoterminowe", nie komentarz z kodu. */
  formulaPl: string;
  /** Ogólna zasada odczytu — co znaczy wyższa/niższa wartość. */
  interpretationPl: string;
}

export const FINANCE_KPI_LABELS: Readonly<Record<string, FinanceKpiLabel>> = {
  CASH_CONVERSION_CYCLE: {
    namePl: 'Cykl konwersji gotówki (CCC)',
    formulaPl: 'Cykl należności + Cykl zapasów − Cykl zobowiązań',
    interpretationPl: 'Ile dni gotówka jest zamrożona w kapitale obrotowym. Krócej = lepiej.',
  },
  CASH_RATIO: {
    namePl: 'Wskaźnik gotówkowy',
    formulaPl: 'Środki pieniężne i ekwiwalenty / Zobowiązania krótkoterminowe',
    interpretationPl: 'Najostrzejsza miara płynności — ile bieżących zobowiązań pokrywa sama gotówka.',
  },
  CURRENT_RATIO: {
    namePl: 'Wskaźnik płynności bieżącej',
    formulaPl: 'Aktywa obrotowe / Zobowiązania krótkoterminowe',
    interpretationPl: 'Zdolność do regulowania zobowiązań krótkoterminowych. Poniżej 1 = ryzyko płynności.',
  },
  DEBT_TO_EBITDA: {
    namePl: 'Dług do EBITDA (LTM)',
    formulaPl: 'Zobowiązania długoterminowe / EBITDA z ostatnich 12 miesięcy',
    interpretationPl: 'Ile lat EBITDA potrzeba na spłatę długu. Typowa miara kowenantów kredytowych — niżej = bezpieczniej.',
  },
  DEBT_TO_EQUITY: {
    namePl: 'Dług do kapitału własnego',
    formulaPl: 'Zobowiązania długoterminowe / Kapitał własny',
    interpretationPl: 'Struktura finansowania. Ujemny kapitał własny jest stanem legalnym, choć zagrożonym — pokazywany z flagą, nie ukrywany.',
  },
  DIO: {
    namePl: 'Cykl zapasów (DIO)',
    formulaPl: 'Średni stan zapasów / (Koszt własny sprzedaży / 365)',
    interpretationPl: 'Ile dni zapas leży w magazynie, zanim się sprzeda. Krócej = mniej zamrożonej gotówki.',
  },
  DPO: {
    namePl: 'Cykl zobowiązań (DPO)',
    formulaPl: 'Średni stan zobowiązań handlowych / (Koszt własny sprzedaży / 365)',
    interpretationPl: 'Ile dni firma płaci dostawcom. Dłużej = tańsze finansowanie handlowe, ale ryzyko relacji.',
  },
  DSO: {
    namePl: 'Cykl należności (DSO)',
    formulaPl: 'Średni stan należności handlowych / (Przychody ze sprzedaży / 365)',
    interpretationPl: 'Ile dni klienci zwlekają z zapłatą. Krócej = szybszy dopływ gotówki.',
  },
  EBITDA_MARGIN_PCT: {
    namePl: 'Marża EBITDA',
    formulaPl: 'EBITDA / Przychody ze sprzedaży',
    interpretationPl: 'Rentowność operacyjna przed amortyzacją. Wyżej = lepiej.',
  },
  FCF_MARGIN: {
    namePl: 'Marża wolnych przepływów pieniężnych (FCF)',
    formulaPl: 'Wolne przepływy pieniężne / Przychody ze sprzedaży',
    interpretationPl: 'Ile z każdej złotówki przychodu zostaje jako gotówka do dyspozycji. Wyżej = lepiej.',
  },
  GROSS_MARGIN_PCT: {
    namePl: 'Marża brutto na sprzedaży',
    formulaPl: '(Przychody ze sprzedaży − Koszt własny sprzedaży) / Przychody ze sprzedaży',
    interpretationPl: 'Rentowność na poziomie produktu, przed kosztami sprzedaży i zarządu. Wyżej = lepiej.',
  },
  INTEREST_COVERAGE: {
    namePl: 'Pokrycie odsetek zyskiem operacyjnym',
    formulaPl: 'Zysk operacyjny (EBIT) / Koszty odsetek',
    interpretationPl: 'Ile razy zysk operacyjny pokrywa odsetki. Poniżej 1 = firma nie obsługuje długu z działalności.',
  },
  NET_MARGIN_PCT: {
    namePl: 'Marża zysku netto',
    formulaPl: 'Zysk netto / Przychody ze sprzedaży',
    interpretationPl: 'Ostateczna rentowność po wszystkich kosztach i podatku. Wyżej = lepiej.',
  },
  OPERATING_CASH_FLOW_MARGIN: {
    namePl: 'Marża operacyjnych przepływów pieniężnych',
    formulaPl: 'Przepływy pieniężne z działalności operacyjnej / Przychody ze sprzedaży',
    interpretationPl: 'Na ile zysk jest pokryty realną gotówką z działalności. Wyżej = wyższa jakość zysku.',
  },
  QUICK_RATIO: {
    namePl: 'Wskaźnik płynności szybkiej',
    formulaPl: '(Aktywa obrotowe − Zapasy) / Zobowiązania krótkoterminowe',
    interpretationPl: 'Płynność bez najmniej płynnej pozycji, czyli zapasów. Poniżej 1 = napięta płynność.',
  },
  REVENUE_GROWTH_YOY: {
    namePl: 'Dynamika przychodów r/r',
    formulaPl: '(Przychody bieżącego okresu − Przychody poprzedniego okresu) / Przychody poprzedniego okresu',
    interpretationPl: 'Tempo wzrostu sprzedaży rok do roku. Porównuje dwa pełne okresy, nie średnie.',
  },
  ROA: {
    namePl: 'Rentowność aktywów (ROA)',
    formulaPl: 'Zysk netto / Średni stan aktywów ogółem',
    interpretationPl: 'Ile zysku przynosi każda złotówka majątku. Wyżej = efektywniejszy majątek.',
  },
  ROE: {
    namePl: 'Rentowność kapitału własnego (ROE)',
    formulaPl: 'Zysk netto / Średni stan kapitału własnego',
    interpretationPl: 'Zwrot dla właścicieli. Ujemne ROE przy ujemnym kapitale własnym to klasyczna pułapka — pokazywane z flagą, nigdy ukrywane.',
  },
};

/**
 * Kategorie katalogu KPI (SCREAMING_CASE po angielsku w bazie) → nazwy PL.
 * Kategoria nieznana NIE trafia na ekran surowa — jest humanizowana
 * (`CASH_FLOW` → „Cash flow"), żeby luka wyglądała jak luka, a nie jak kod.
 */
const KPI_CATEGORY_PL: Readonly<Record<string, string>> = {
  LIQUIDITY: 'Płynność',
  PROFITABILITY: 'Rentowność',
  LEVERAGE: 'Zadłużenie',
  EFFICIENCY: 'Efektywność',
  COVERAGE: 'Pokrycie',
  RETURNS: 'Zwroty',
  CASH_FLOW: 'Przepływy pieniężne',
  GROWTH: 'Wzrost',
  VALUATION: 'Wycena',
  WORKING_CAPITAL: 'Kapitał obrotowy',
};

function humanize(value: string): string {
  const words = value.toLowerCase().split(/[_\s]+/).filter(Boolean);
  if (words.length === 0) return value;
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}

/** Nazwa wskaźnika PO POLSKU; dla KPI spoza katalogu P0 — nazwa z katalogu organizacji. */
export function financeKpiName(kpiCode: string, catalogName?: string | null): string {
  const known = FINANCE_KPI_LABELS[kpiCode];
  if (known) return known.namePl;
  const fromCatalog = String(catalogName ?? '').trim();
  return fromCatalog || humanize(kpiCode);
}

/** Kategoria PO POLSKU. Nigdy nie zwraca SCREAMING_CASE. */
export function financeKpiCategory(category: string | null | undefined): string {
  const raw = String(category ?? '').trim();
  if (!raw) return '—';
  return KPI_CATEGORY_PL[raw.toUpperCase()] ?? humanize(raw);
}

/** Wzór i ogólna interpretacja; `null` gdy KPI jest spoza katalogu P0 (nie zgadujemy formuły). */
export function financeKpiFormula(kpiCode: string): { formulaPl: string; interpretationPl: string } | null {
  const known = FINANCE_KPI_LABELS[kpiCode];
  return known ? { formulaPl: known.formulaPl, interpretationPl: known.interpretationPl } : null;
}

export function hasFinanceKpiLabel(kpiCode: string): boolean {
  return Object.prototype.hasOwnProperty.call(FINANCE_KPI_LABELS, kpiCode);
}
