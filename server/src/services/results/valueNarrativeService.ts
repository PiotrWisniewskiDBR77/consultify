/**
 * valueNarrativeService — deterministyczna narracja wartości dla zarządu (M15/W6, 6.3).
 *
 * Generuje czytelny, jednojęzyczny (PL) opis stanu realizacji wartości transformacji
 * na podstawie agregatów rezultatów. BEZ LLM — czysty szablon, te same wejścia dają
 * dokładnie ten sam tekst (determinizm). Liczby formatowane helperem k/M.
 */

export interface NarrativeBenefit {
  name?: string;
  realizedValue?: number;
}

export interface NarrativeRisk {
  name?: string;
  atRiskValue?: number;
}

export interface NarrativeDecision {
  action: string; // np. 'DOŁÓŻ' | 'ZABIJ' | dowolna rekomendacja
  name?: string;
}

export interface ValueNarrativeInput {
  banked: number;
  inFlight: number;
  atRisk: number;
  totalTarget: number;
  pctOfTarget: number;
  topBenefits?: NarrativeBenefit[];
  topRisks?: NarrativeRisk[];
  decisions?: NarrativeDecision[];
}

export interface ValueNarrative {
  headline: string;
  paragraphs: string[];
  bullets: string[];
}

/**
 * Formatuje liczbę do zwięzłej postaci k/M (PL: separator nierozdzielający dla tysięcy).
 * Deterministyczny: brak zależności od locale runtime.
 *  - |v| >= 1_000_000 → "X,Y M"
 *  - |v| >= 1_000     → "X,Y k"
 *  - reszta           → liczba całkowita
 */
export function formatValue(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '0';
  }
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    return `${sign}${trimDecimal(abs / 1_000_000)} M`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimDecimal(abs / 1_000)} k`;
  }
  return `${sign}${Math.round(abs)}`;
}

/** Zaokrągla do 1 miejsca po przecinku i obcina zbędne ",0"; PL przecinek dziesiętny. */
function trimDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return str.replace('.', ',');
}

/** Formatuje wartość pieniężną z jednostką PLN. */
function formatPln(value: number | null | undefined): string {
  return `${formatValue(value)} PLN`;
}

/** Formatuje procent (PL przecinek), bez zbędnych miejsc po przecinku. */
function formatPct(pct: number | null | undefined): string {
  const safe = pct == null || !Number.isFinite(pct) ? 0 : pct;
  const rounded = Math.round(safe * 10) / 10;
  const str = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${str.replace('.', ',')}%`;
}

/**
 * Buduje pełną narrację wartości dla zarządu.
 * Deterministyczna: brak losowości, dat, sortowań zależnych od kolejności wejścia.
 */
export function buildNarrative(input: ValueNarrativeInput): ValueNarrative {
  const banked = safeNum(input.banked);
  const inFlight = safeNum(input.inFlight);
  const atRisk = safeNum(input.atRisk);
  const totalTarget = safeNum(input.totalTarget);
  const pctOfTarget = safeNum(input.pctOfTarget);

  const headline = `Transformacja dostarczyła ${formatPln(banked)} (${formatPct(pctOfTarget)} celu)`;

  const paragraphs: string[] = [];

  paragraphs.push(
    `Na ten moment zabankowano ${formatPln(banked)} potwierdzonej wartości, co stanowi ` +
      `${formatPct(pctOfTarget)} celu transformacji wynoszącego ${formatPln(totalTarget)}.`,
  );

  paragraphs.push(
    `W realizacji pozostaje ${formatPln(inFlight)} wartości, która jest aktywnie wdrażana ` +
      `i powinna zasilić wynik w kolejnych okresach.`,
  );

  if (atRisk > 0) {
    paragraphs.push(
      `Zagrożone jest ${formatPln(atRisk)} planowanej wartości — wymaga to interwencji ` +
        `zarządczej, aby uniknąć ubytku w realizacji celu.`,
    );
  } else {
    paragraphs.push(
      `Na chwilę obecną żadna wartość nie jest oznaczona jako zagrożona — ryzyko realizacji ` +
        `pozostaje pod kontrolą.`,
    );
  }

  const bullets: string[] = [];

  const topBenefits = input.topBenefits ?? [];
  for (const b of topBenefits) {
    const name = b.name?.trim() || 'Korzyść';
    bullets.push(`Korzyść: ${name} — zrealizowano ${formatPln(b.realizedValue)}`);
  }

  const topRisks = input.topRisks ?? [];
  for (const r of topRisks) {
    const name = r.name?.trim() || 'Ryzyko';
    bullets.push(`Ryzyko: ${name} — zagrożone ${formatPln(r.atRiskValue)}`);
  }

  const decisions = input.decisions ?? [];
  const addCount = decisions.filter((d) => isAction(d, 'DOŁÓŻ')).length;
  const killCount = decisions.filter((d) => isAction(d, 'ZABIJ')).length;
  if (decisions.length > 0) {
    bullets.push(
      `Rekomendacje: ${addCount} × DOŁÓŻ, ${killCount} × ZABIJ ` +
        `(łącznie ${decisions.length} rekomendacji do decyzji zarządu).`,
    );
  }

  return { headline, paragraphs, bullets };
}

/**
 * Jednoakapitowy skrót wykonawczy (executive summary).
 * Deterministyczny; składa najważniejsze liczby w jedno zdanie.
 */
export function executiveSummary(input: ValueNarrativeInput): string {
  const banked = safeNum(input.banked);
  const inFlight = safeNum(input.inFlight);
  const atRisk = safeNum(input.atRisk);
  const totalTarget = safeNum(input.totalTarget);
  const pctOfTarget = safeNum(input.pctOfTarget);

  const riskClause =
    atRisk > 0
      ? `, a ${formatPln(atRisk)} jest zagrożone i wymaga uwagi zarządu`
      : `, przy braku wartości oznaczonej jako zagrożona`;

  return (
    `Transformacja dostarczyła dotychczas ${formatPln(banked)} potwierdzonej wartości ` +
    `(${formatPct(pctOfTarget)} celu ${formatPln(totalTarget)}); ` +
    `${formatPln(inFlight)} pozostaje w realizacji${riskClause}.`
  );
}

function safeNum(v: number | null | undefined): number {
  return v == null || !Number.isFinite(v) ? 0 : v;
}

function isAction(d: NarrativeDecision, action: string): boolean {
  return (d.action || '').trim().toUpperCase() === action.toUpperCase();
}

export default { buildNarrative, executiveSummary, formatValue };
