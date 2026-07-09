/**
 * GROUNDING_RULES — single shared block of anti-fabrication instructions injected
 * into every Discovery tool AI prompt (full-session builders, dedicated-tool
 * builders, conclusion prompts, per-section suggestion/summary prompts).
 *
 * Born from the adversarial panel (2026-07-09, 19 confirmed findings, 66/100)
 * which found 4 systemic patterns across tools:
 *   W1 — fabricated client metrics stamped as fact (evidenceType:'fact',
 *        confidence 5, provenance 'Client briefing data') with no such data
 *        in the session input.
 *   W2 — cross-tool target/threshold drift (a tool sets a KPI target weaker
 *        than the ambition the client already stated elsewhere in the session).
 *   W3 — %-of-team-time arithmetic errors (e.g. 15h/week reported as 37.5% of
 *        a 4-person team instead of 15 / (4*40) = 9.4%).
 *
 * DO NOT copy-paste this text into individual prompt files — import and inject
 * this constant/function instead, so a future fix only needs to land once.
 */

export const GROUNDING_RULES_PL = `=== ZASADY UGRUNTOWANIA (GROUNDING RULES) — obowiązują dla całej odpowiedzi ===
1. FAKT vs HIPOTEZA: każda liczba, metryka, koszt lub ROI, która nie występuje wprost we wsadzie sesji (brief/kontekst organizacji/case), MUSI być oznaczona jako hipoteza: evidenceType:"assumption" (lub state:"proposed"), confidence <= 2, provenance:"AI-estimate". NIGDY nie oznaczaj wymyślonej liczby jako evidenceType:"fact", confidence 5, ani provenance sugerującą dane klienta (np. "Client briefing data", "dane finansowe DBR77") — chyba że ta dokładna liczba faktycznie występuje we wsadzie.
2. MOSTEK WYLICZENIOWY: każda kwota w EUR/PLN, ROI lub procent MUSI mieć pole "derivation" pokazujące licznik/mianownik (np. "oszczędność = Δodchyleń × GMV × marża = 120 × 45000 × 0,08"). Jeśli nie potrafisz podać mostka wyliczeniowego z liczb obecnych we wsadzie — NIE podawaj kwoty; zamiast tego sformułuj stwierdzenie kierunkowe ("redukuje koszt operacyjny", bez liczby).
3. SPÓJNOŚĆ TARGETÓW: progi i cele KPI (np. target reklamacji, target czasu cyklu) bierz WYŁĄCZNIE z wsadu sesji (case/kontekst organizacji/ambicja klienta). Jeśli wsad definiuje konkretną ambicję (np. "<5% reklamacji"), NIE WOLNO Ci ustawić progu słabszego niż ta ambicja (np. 8%) — dopasuj się do niej lub zaostrz, nigdy nie rozluźniaj.
4. ARYTMETYKA CZASU ZESPOŁU: procent czasu zespołu = godziny / (liczba_FTE × 40h). Nigdy nie licz procentu czasu względem 1 osoby, gdy mowa o zespole wieloosobowym. Zawsze pokaż wyliczenie w "derivation" (np. "15h / (4×40h) = 9,4%").
5. Jeśli którejkolwiek z powyższych informacji brakuje we wsadzie — powiedz to wprost (np. "brak danych o liczbie FTE — przyjęto założenie X, do weryfikacji z klientem") zamiast milczeć i zgadywać z ukrytą pewnością.`;

export const GROUNDING_RULES_EN = `=== GROUNDING RULES — apply to the entire response ===
1. FACT vs HYPOTHESIS: any number, metric, cost, or ROI that is NOT explicitly present in the session input (brief / organization context / case) MUST be marked as a hypothesis: evidenceType:"assumption" (or state:"proposed"), confidence <= 2, provenance:"AI-estimate". NEVER mark a fabricated number as evidenceType:"fact", confidence 5, or a provenance implying client data (e.g. "Client briefing data", "DBR77 financial data") unless that exact number is actually present in the input.
2. CALCULATION BRIDGE: any EUR/PLN amount, ROI, or percentage MUST carry a "derivation" field showing the numerator/denominator (e.g. "savings = Δdeviations × GMV × margin = 120 × 45000 × 0.08"). If you cannot show a derivation from numbers actually present in the input, do NOT state the amount — give a directional statement instead ("reduces operating cost", with no number).
3. TARGET CONSISTENCY: KPI thresholds/targets (e.g. complaint rate target, cycle-time target) come EXCLUSIVELY from the session input (case / organization context / client ambition). If the input defines a specific ambition (e.g. "<5% complaints"), you MUST NOT set a weaker threshold (e.g. 8%) — match it or tighten it, never loosen it.
4. TEAM-TIME ARITHMETIC: percent of team time = hours / (FTE_count × 40h). Never compute the percentage against 1 person when the context is a multi-person team. Always show the calculation in "derivation" (e.g. "15h / (4×40h) = 9.4%").
5. If any of the above inputs is missing, say so explicitly (e.g. "no FTE count given — assumed X, to verify with client") instead of silently guessing with false confidence.`;

/** Returns the grounding-rules block in the requested language. */
export function groundingRules(isPolish: boolean): string {
  return isPolish ? GROUNDING_RULES_PL : GROUNDING_RULES_EN;
}

/**
 * Bilingual block for prompt builders that don't know the session language
 * up front (they instruct the model to detect PL/EN and respond in kind).
 * Keep both languages so the rule applies regardless of which one the model
 * picks for its answer.
 */
export const GROUNDING_RULES_BOTH = `${GROUNDING_RULES_EN}

(PL) ${GROUNDING_RULES_PL}`;
