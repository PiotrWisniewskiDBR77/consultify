/**
 * cardColumnHydration (R3) — mapuje wygenerowane KARTY (componentKey → treść)
 * na realne KOLUMNY TYPOWANE inicjatywy, zamiast zostawiać je tylko w
 * JSON-sinku `ai_generated_sections`.
 *
 * Dlaczego ostrożnie: kolumny są AUTORYTATYWNE (czyta je FE + UPDATE w
 * InitiativeController). Treść kart bywa wolnotekstowa LUB JSON (zależnie od
 * szablonu sekcji), więc hydracja jest:
 *   - DETERMINISTYCZNA i CZYSTA (bez sieci/DB) — łatwa do testu,
 *   - NIE-DESTRUKCYJNA: wypełnia tylko kolumny PUSTE (nie nadpisuje edycji),
 *   - DEFENSYWNA: nieparsowalna/niepewna karta jest pomijana (nie wstrzeliwuje
 *     śmieci do kolumny).
 *
 * Mapowanie componentKey → kolumna(y) trzyma parytet z FIELD_MAP/JSON_FIELDS
 * w `InitiativeController.updateInitiative` (formaty: skalar = tekst,
 * JSON-array = `JSON.stringify(string[])`).
 *
 * Kształty wejścia (output AI per sekcja — parytet z handleGenerateAI w FE):
 *   problemDefinition → { symptom, rootCause, costOfInaction }
 *   scope            → { inScope[], outOfScope[]|outScope[], killCriteria[] }
 *   targetState      → { targetDescription|description, successCriteria[], deliverables[], vision? }
 *        → success_criteria[] + deliverables[] (JSON-array) ORAZ target_state
 *          (JSON-OBIEKT: { description, successCriteria[], deliverables[] } — tak
 *          czyta FE: initiative.targetState.description/.deliverables/.successCriteria)
 *   financialImpact / businessCase → { businessValue, costCapex, costOpex, expectedRoi }
 *        LUB realny kształt premium: { revenueImpact, costSavings, benefitsRealization }
 *        (narracja składana w business_value, gdy brak jawnego businessValue)
 *        → dodatkowo estimated_budget = suma capex+opex, gdy oba liczbowe
 *   raid             → { risks[] | items[] }  → key_risks[] (JSON-array stringów
 *        "Ryzyko — mitygacja: …"; FE renderuje płaską listę, nie {risk,mitigation})
 *   kpis             → POMIJANE (osobna tabela `/initiatives/:id/kpis`)
 *   control          → POMIJANE (owner_* = referencja user-id, nie z tekstu AI)
 */

export interface TypedColumnUpdate {
  column: string;
  /** Skalar (string) lub `JSON.stringify(string[])` dla kolumn-tablic. */
  value: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function parseJsonLoose(content: unknown): any | null {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim();
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function cleanStr(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => x.length > 0);
}

/**
 * Wyłuskuje pierwszą liczbę z pola (number lub tekst typu "1,2 mln zł" / "500000").
 * Zwraca number lub undefined. Obsługuje polski separator dziesiętny (przecinek)
 * i skróty rzędu wielkości (tys./k, mln/m, mld). Konserwatywny: bez liczby → undefined.
 */
function parseAmount(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '').trim();
  if (!s) return undefined;
  // Znajdź pierwszy token liczbowy (z opcjonalnym separatorem tysięcy/dziesiętnym).
  const m = s.match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return undefined;
  let numStr = m[0].replace(/\s/g, '');
  // Heurystyka separatorów: jeśli są i kropka i przecinek → przecinek = tysiące.
  if (numStr.includes('.') && numStr.includes(',')) {
    numStr = numStr.replace(/,/g, '');
  } else if (numStr.includes(',')) {
    // Sam przecinek → traktuj jako dziesiętny (PL) tylko gdy po nim ≤2 cyfry.
    numStr = /,\d{1,2}$/.test(numStr) ? numStr.replace(',', '.') : numStr.replace(/,/g, '');
  }
  let n = Number(numStr);
  if (!Number.isFinite(n)) return undefined;
  const lower = s.toLowerCase();
  // Skrót rzędu wielkości: albo słowo (spacja: „1,2 mln zł"), albo sufiks
  // przyklejony do liczby („500k", „1.2M", „2m"). Kolejność: mld → mln → tys.
  const suffixAttached = /\d\s*([a-z])\b/.exec(lower)?.[1]; // litera tuż po liczbie
  if (/\bmld\b|\bbn\b|miliard/.test(lower)) n *= 1_000_000_000;
  else if (/\bmln\b|milion|\bmillion\b/.test(lower) || suffixAttached === 'm') n *= 1_000_000;
  else if (/\btys\b|tysi|\bthousand\b/.test(lower) || suffixAttached === 'k') n *= 1_000;
  else if (/\bm\b/.test(lower)) n *= 1_000_000; // samotne „m" (np. „$5 m") — po sufiksach
  return Number.isFinite(n) ? n : undefined;
}

/**
 * FIX 1b (naprawa-r4Struct) — wyłuskuje ROI z NARRACJI karty finansowej.
 * Żywy section-prompt financialImpact emituje {revenueImpact, costSavings,
 * benefitsRealization} — NIE ma jawnego pola expectedRoi, więc `expected_roi`
 * zostawał NULL mimo że narracja zawiera „ROI 285%" / „zwrot 3,2x" / „payback 14
 * miesięcy". Skanujemy tekst w kolejności ważności i zwracamy pierwszy trafiony
 * wskaźnik jako czytelny string (kolumna expected_roi jest tekstowa). Bez trafienia
 * → undefined (nie zmyślamy).
 */
function extractRoiFromText(text: string): string | undefined {
  const s = String(text || '');
  if (!s.trim()) return undefined;
  // 1) Jawne "ROI ... 285%" (ROI w pobliżu procentu, dowolna kolejność, PL/EN).
  //    Klasa liczby dopuszcza „-" → łapie zakres „ROI 120-180%".
  const roiPct =
    s.match(/\broi\b[^%\n]{0,24}?(\d[\d\s.,-]*\s*%)/i) ||
    s.match(/(\d[\d\s.,-]*\s*%)[^%\n]{0,12}?\broi\b/i);
  if (roiPct) return `ROI ${roiPct[1].replace(/\s+/g, '')}`;
  // 2) Zwrot krotności "3,2x" / "zwrot 3x" / "return of 2.5x". Klasa liczby zawiera
  //    „-" → łapie ZAKRES który Claude realnie generuje: „ROI 2.5-3.5x" (bez „-"
  //    poprzedni regex kończył na „2.5" i wymagał „x" natychmiast → 0 trafień, demo
  //    2026-07-07: expected_roi = NULL mimo „ROI 2.5-3.5x" w karcie).
  const roiMult = s.match(/(?:roi|zwrot|return)[^0-9\n]{0,16}?(\d[\d.,-]*\s*x)\b/i) ||
    s.match(/\b(\d[\d.,-]*\s*x)\s*(?:roi|zwrot|return)/i);
  if (roiMult) return `ROI ${roiMult[1].replace(/\s+/g, '')}`;
  // 3) Payback / okres zwrotu "payback 14 miesięcy" / "zwrot w 12 mies.".
  const payback = s.match(
    /(?:payback|okres zwrotu|zwrot(?:\s+w)?)[^0-9\n]{0,16}?(\d[\d.,-]*)\s*(mies|month|m-?cy|lat|year|rok)/i,
  );
  if (payback) {
    const unit = payback[2].toLowerCase();
    const label = /lat|year|rok/.test(unit) ? 'lat' : 'mies.';
    return `payback ${payback[1]} ${label}`;
  }
  // 4) OSTATECZNOŚĆ — próg rentowności / break-even / pełna rentowność jako
  //    HORYZONT (data „Q2 2028" lub liczba miesięcy). Żywy prompt financialImpact
  //    często NIE podaje jawnego ROI/krotności, tylko moment osiągnięcia
  //    rentowności (demo 2026-07-07 INI-1: „Break-even produktu: Q1 2028. Pełna
  //    rentowność inicjatywy: Q2 2028"). To realny wskaźnik zwrotu — lepszy niż NULL.
  const breakEven = s.match(
    /(?:break-?even|pr[oó]g rentowno[śs]ci|pe[łl]na rentowno[śs][ćc]|rentowno[śs][ćc])[^\n]{0,40}?((?:Q[1-4]\s*)?\d{4}|\d{1,3}\s*(?:mies|month|m-?cy))/i,
  );
  if (breakEven) return `rentowność ${breakEven[1].replace(/\s+/g, ' ').trim()}`;
  return undefined;
}

/**
 * Token KWOTOWY: liczba, która MUSI nieść MARKER wartości pieniężnej — skrót rzędu
 * wielkości (mln/tys/k/M/mld) LUB walutę (zł/PLN/€/EUR/$/…). Bez markera token nie
 * jest kwotą (to procent, liczba klientów, rok itd.).
 *
 * Dlaczego twardo (demo 2026-07-07): stary regex miał WSZYSTKIE markery opcjonalne,
 * więc słowo „koszt" tuż przy „…akwizycji klienta o 40% dzięki…" łapało gołą „40"
 * → estimated_budget = 40 (śmieć). Wymóg markera + próg ≥1000 to eliminuje: lepiej
 * NULL niż „40".
 */
const MONEY_SCALE = '(?:mld|mln|tys\\.?|bn|m|k|miliard|milion|tysi[ąa]c)';
const MONEY_CUR = '(?:z[łl]|pln|eur|usd|€|\\$|£)';
const MONEY_TOKEN_RE = new RegExp(
  // 1) symbol waluty PRZED liczbą (opcjonalny skrót po): „€500k", „$1.2 mln"
  `(?:[€$£]\\s*\\d[\\d\\s.,]*\\s*${MONEY_SCALE}?)` +
    // 2) liczba + SKRÓT rzędu wielkości (opcjonalna waluta po): „800K PLN", „1.2M"
    `|(?:\\d[\\d\\s.,]*\\s*${MONEY_SCALE}\\s*${MONEY_CUR}?)` +
    // 3) liczba + WALUTA bez skrótu: „500000 PLN", „750 tys" łapie (2)
    `|(?:\\d[\\d\\s.,]*\\s*${MONEY_CUR})`,
  'gi',
);

/** Pierwszy token kwotowy w oknie o wartości ≥1000 (odrzuca gołe małe liczby). */
function firstMoneyAmount(window: string): number | undefined {
  const toks = window.match(MONEY_TOKEN_RE);
  if (!toks) return undefined;
  for (const t of toks) {
    const n = parseAmount(t);
    if (n !== undefined && n >= 1000) return n;
  }
  return undefined;
}

/**
 * FIX 1b (naprawa-r5Extract) — wyłuskuje KWOTĘ BUDŻETU z narracji karty finansowej.
 * Token kwotowy MUSI mieć marker (skrót/waluta) i wartość ≥1000 — inaczej odrzucony
 * (naprawia śmieciowe „40" z „redukcję kosztów o 40%").
 *
 * Priorytet słów-kluczy: MOCNE (budżet/nakład/inwestycja/capex/opex — jednoznaczny
 * wydatek) przed SŁABYM „koszt/cost" (przeciążone „redukcją/oszczędnością kosztów",
 * które opisują KORZYŚĆ, nie nakład). Demo 2026-07-07 INI-1: „koszt" trafiał w
 * „redukcji kosztów delivery … 2.1M PLN" (przychód!) — priorytet „nakład" bierze
 * poprawnie „nakłady … 1.8M PLN". Bez trafienia → undefined.
 */
function extractBudgetFromText(text: string): number | undefined {
  const s = String(text || '');
  if (!s.trim()) return undefined;

  const nearKeyword = (kwSource: string): number | undefined => {
    const kw = new RegExp(kwSource, 'gi');
    let m: RegExpExecArray | null;
    while ((m = kw.exec(s)) !== null) {
      const n = firstMoneyAmount(s.slice(m.index, m.index + 90));
      if (n !== undefined) return n;
    }
    return undefined;
  };

  // 1) MOCNE słowa-klucze (jednoznaczny nakład kapitałowy).
  const strong = nearKeyword('(bud[żz]et|inwestycj|nak[łl]ad|capex|opex|budget|investment|spend)');
  if (strong !== undefined) return strong;
  // 2) SŁABE „koszt/cost" (dopiero gdy brak mocnego — przeciążone semantycznie).
  const weak = nearKeyword('(koszt|cost)');
  if (weak !== undefined) return weak;
  // 3) Fallback: dowolny token kwotowy z markerem gdziekolwiek w tekście.
  return firstMoneyAmount(s);
}

/**
 * Buduje płaskie linie ryzyk z karty RAID. FE (`InitiativeFullView` → key_risks)
 * renderuje ZWYKŁĄ listę stringów, więc {risk,mitigation} spłaszczamy do jednego
 * czytelnego wiersza. Akceptuje wiele kształtów, jakie emitują różne prompty.
 */
function buildRiskLines(j: any): string[] {
  const raw =
    (Array.isArray(j?.risks) && j.risks) ||
    (Array.isArray(j?.items) && j.items) ||
    (Array.isArray(j?.raid) && j.raid) ||
    (Array.isArray(j?.add) && j.add) ||
    (Array.isArray(j) ? j : null);
  if (!Array.isArray(raw)) return [];
  const lines: string[] = [];
  for (const it of raw) {
    if (typeof it === 'string') {
      const s = it.trim();
      if (s) lines.push(s);
      continue;
    }
    if (!it || typeof it !== 'object') continue;
    // Tylko wpisy typu RISK (gdy typ podany); brak typu → traktuj jako ryzyko.
    const type = String(it.type ?? it.category ?? '').toLowerCase();
    if (type && !/risk|ryzyk/.test(type)) continue;
    const title = cleanStr(it.risk ?? it.title ?? it.name ?? it.description ?? it.text);
    if (!title) continue;
    const mitigation = cleanStr(
      it.mitigation ?? it.mitigationPlan ?? it.mitigation_plan ?? it.proposedAction ?? it.contingency,
    );
    lines.push(mitigation ? `${title} — mitygacja: ${mitigation}` : title);
  }
  return lines;
}

/** Kolumna jest „pusta" (wolno wypełnić): null / '' / '[]' / '{}'. */
function isEmptyCol(existingRow: Record<string, unknown>, col: string): boolean {
  const v = existingRow[col];
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return s === '' || s === '[]' || s === '{}';
}

/**
 * FIX (naprawa-r6bExtract, defekt #1) — wykrywa ŚMIECIOWĄ wartość budżetu utrwaloną
 * PRZED tym fixem. Żywy dowód (demo 2026-07-07): INI-2 ma estimated_budget=40, śmieć
 * z „redukcję kosztów akwizycji o 40%" (gołe „40" bez markera pieniężnego), mimo że
 * karta financialImpact niesie „koszty wejścia ~400k PLN". Hydracja non-destrukcyjna
 * NIE nadpisze tego (40 ≠ puste). Dlatego dla estimated_budget dopuszczamy nadpisanie,
 * gdy istniejąca wartość jest ŚMIECIOWA.
 *
 * ŚMIEĆ = wartość, która nie może być realnym budżetem projektu: nie-liczba, albo
 * liczba bez skali (< 1000). Realny budżet inicjatywy to co najmniej tysiące (patrz
 * próg ≥1000 w firstMoneyAmount). Zachowawczo: „400000", „1500000" itd. → NIE śmieć.
 */
function isGarbageBudget(v: unknown): boolean {
  if (v === null || v === undefined) return true; // puste = też „do wypełnienia"
  const s = String(v).trim();
  if (s === '' || s === '[]' || s === '{}') return true;
  const n = Number(s.replace(/\s/g, '').replace(',', '.'));
  // Nie-liczbowa treść w kolumnie liczbowej → śmieć (np. „40%", „low").
  if (!Number.isFinite(n)) return true;
  // Liczba bez skali (< 1000) nie jest realnym budżetem inicjatywy → śmieć.
  return n < 1000;
}

/**
 * FIX (naprawa-r6bExtract, defekt #1) — wykrywa ŚMIECIOWĄ wartość ROI utrwaloną PRZED
 * fixem. expected_roi jest KOLUMNĄ TEKSTOWĄ i realny wskaźnik zwrotu ZAWSZE niesie
 * marker: procent („285%"), krotność („3,2x"), payback/rentowność/miesiące/rok, albo
 * słowo ROI. Sama gola liczba (np. „40" z „o 40%") jest śmieciem — nie mówi nic o
 * zwrocie. ŚMIEĆ = brak jakiegokolwiek markera zwrotu (albo pusto).
 */
function isGarbageRoi(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  if (s === '' || s === '[]' || s === '{}') return true;
  // Realny ROI musi nieść marker zwrotu: %, krotność x, roi, payback, rentowność,
  // break-even, jednostka czasu (mies./month/lat/rok/year).
  const hasSignal =
    /%/.test(s) ||
    /\d\s*x\b/i.test(s) ||
    /\broi\b/i.test(s) ||
    /payback|rentowno[śs][ćc]|break-?even|zwrot/i.test(s) ||
    /\b(mies|month|m-?cy|lat|rok|year)\b/i.test(s);
  return !hasSignal;
}

// ── główny mapper ────────────────────────────────────────────────────────────

/**
 * Zbiera UPDATE-y dla kolumn typowanych z mapy kart. Zwraca tylko te kolumny,
 * które (a) ISTNIEJĄ w schemacie, (b) są PUSTE w istniejącym wierszu, (c) dało
 * się pewnie wyprowadzić z treści karty.
 *
 * @param cards        sectionKey → treść karty (string lub już sparsowany obiekt)
 * @param existingCols zbiór nazw kolumn tabeli `initiatives`
 * @param existingRow  bieżący wiersz (do testu nie-destrukcyjności); domyślnie pusty
 */
export function buildTypedColumnUpdates(
  cards: Record<string, unknown> | null | undefined,
  existingCols: Set<string>,
  existingRow: Record<string, unknown> = {},
): TypedColumnUpdate[] {
  const out: TypedColumnUpdate[] = [];
  if (!cards || typeof cards !== 'object') return out;

  const push = (column: string, value: string | undefined) => {
    if (value === undefined || value === '') return;
    if (!existingCols.has(column)) return;
    if (!isEmptyCol(existingRow, column)) {
      // FIX (naprawa-r6bExtract, defekt #1): non-destrukcyjność jest domyślnie
      // WŁĄCZONA (nie klobrujemy ręcznych edycji), z JEDNYM wyjątkiem — kolumny,
      // do których PRZED tym fixem trafiał ŚMIEĆ z gołych liczb (estimated_budget=40,
      // expected_roi=„40"). Dla nich nadpisujemy TYLKO gdy istniejąca wartość jest
      // śmieciowa, a NOWA ekstrakcja NIE jest (lepsza). Realne (sensowne) wartości
      // pozostają nietknięte.
      const isGarbageOverride =
        (column === 'estimated_budget' &&
          isGarbageBudget(existingRow[column]) &&
          !isGarbageBudget(value)) ||
        (column === 'expected_roi' &&
          isGarbageRoi(existingRow[column]) &&
          !isGarbageRoi(value));
      if (!isGarbageOverride) return;
    }
    // dedup: pierwszy wygrywa
    if (out.some((u) => u.column === column)) return;
    out.push({ column, value });
  };
  const pushList = (column: string, items: string[]) => {
    if (!items.length) return;
    push(column, JSON.stringify(items));
  };

  // problemDefinition → problem_statement (skalar). Symptom = nagłówek problemu;
  // jeśli brak JSON-a, użyj surowego tekstu karty.
  const pd = cards['problemDefinition'];
  if (pd !== undefined) {
    const j = parseJsonLoose(pd);
    const symptom = cleanStr(j?.symptom);
    const fallbackText = typeof pd === 'string' ? cleanStr(pd) : undefined;
    push('problem_statement', symptom || fallbackText);
  }

  // scope → scope_in / scope_out / kill_criteria (JSON-arrays)
  const sc = cards['scope'];
  if (sc !== undefined) {
    const j = parseJsonLoose(sc);
    if (j && typeof j === 'object') {
      pushList('scope_in', cleanList(j.inScope ?? j.scopeIn));
      pushList('scope_out', cleanList(j.outOfScope ?? j.outScope ?? j.scopeOut));
      pushList('kill_criteria', cleanList(j.killCriteria ?? j.kill));
    }
  }

  // targetState → success_criteria / deliverables (JSON-arrays) ORAZ target_state
  // (JSON-OBIEKT: FE czyta initiative.targetState.description/.successCriteria/.deliverables).
  const ts = cards['targetState'];
  if (ts !== undefined) {
    const j = parseJsonLoose(ts);
    if (j && typeof j === 'object') {
      const successCriteria = cleanList(j.successCriteria ?? j.criteria);
      const deliverables = cleanList(j.deliverables);
      const description = cleanStr(j.targetDescription ?? j.description ?? j.vision ?? j.targetState);
      pushList('success_criteria', successCriteria);
      pushList('deliverables', deliverables);
      // target_state jako OBIEKT (JSON.stringify obiektu, nie tablicy) — parytet z
      // JSON_FIELDS.targetState w InitiativeController i kształtem czytanym przez FE.
      if (description || successCriteria.length || deliverables.length) {
        const targetObj: Record<string, unknown> = {};
        if (description) targetObj.description = description;
        if (successCriteria.length) targetObj.successCriteria = successCriteria;
        if (deliverables.length) targetObj.deliverables = deliverables;
        push('target_state', JSON.stringify(targetObj));
      }
    }
  }

  // raid → key_risks (JSON-array płaskich stringów; FE renderuje listę, nie obiekty)
  const raid = cards['raid'];
  if (raid !== undefined) {
    const j = parseJsonLoose(raid);
    if (j && typeof j === 'object') {
      pushList('key_risks', buildRiskLines(j));
    }
  }

  // financialImpact / businessCase → skalary finansowe
  const fin = cards['financialImpact'] ?? cards['businessCase'];
  if (fin !== undefined) {
    const j = parseJsonLoose(fin);
    if (j && typeof j === 'object') {
      // business_value (text): najpierw jawne pole, a gdy go brak — złóż je z
      // NARRACYJNEGO kształtu, który realnie emituje żywy section-prompt
      // financialImpact ({revenueImpact, costSavings, benefitsRealization}).
      // Bez tego (zweryfikowane na demo 2026-06-28) kolumna zostawała NULL mimo
      // wygenerowanej karty, bo żadna z nazw `businessValue/rationale/value` nie
      // pasowała. Kolejność: oszczędności (najbardziej „wartościowe") → przychód
      // → realizacja korzyści.
      const explicitBv = cleanStr(j.businessValue ?? j.rationale ?? j.value);
      const narrativeBv =
        [cleanStr(j.costSavings), cleanStr(j.revenueImpact), cleanStr(j.benefitsRealization)]
          .filter(Boolean)
          .join(' ') || undefined;
      push('business_value', explicitBv ?? narrativeBv);
      const capexRaw = cleanStr(j.costCapex ?? j.capex);
      const opexRaw = cleanStr(j.costOpex ?? j.opex);
      push('cost_capex', capexRaw);
      push('cost_opex', opexRaw);

      // Cała narracja karty (do skanu ROI/budżetu, gdy brak jawnych pól). Żywy
      // prompt zwraca {revenueImpact, costSavings, benefitsRealization} — liczby
      // ROI/budżetu żyją WEWNĄTRZ tych stringów, nie w osobnych polach.
      const narrativeText = [
        cleanStr(j.revenueImpact),
        cleanStr(j.costSavings),
        cleanStr(j.benefitsRealization),
        cleanStr(j.businessValue),
        cleanStr(j.rationale),
      ]
        .filter(Boolean)
        .join('\n');

      // expected_roi: jawne pole → inaczej wyłuskaj z narracji (FIX 1b).
      const explicitRoi = cleanStr(j.expectedRoi ?? j.roi);
      push('expected_roi', explicitRoi ?? extractRoiFromText(narrativeText));

      // estimated_budget: jawne pole → inaczej suma capex+opex (gdy liczbowe) →
      // inaczej wyłuskaj kwotę z narracji (FIX 1b). Kolumna liczbowa/skalarna →
      // zapisz gołą wartość, nie tekst z jednostką.
      const explicitBudget =
        parseAmount(j.estimatedBudget ?? j.budget ?? j.totalCost ?? j.totalBudget);
      if (explicitBudget !== undefined) {
        push('estimated_budget', String(explicitBudget));
      } else {
        const capexN = parseAmount(j.costCapex ?? j.capex);
        const opexN = parseAmount(j.costOpex ?? j.opex);
        if (capexN !== undefined || opexN !== undefined) {
          push('estimated_budget', String((capexN ?? 0) + (opexN ?? 0)));
        } else {
          const narrativeBudget = extractBudgetFromText(narrativeText);
          if (narrativeBudget !== undefined) push('estimated_budget', String(narrativeBudget));
        }
      }
    }
  }

  return out;
}

/** Buduje fragment `SET col = ?, ...` + params z listy update-ów (kolejność stała). */
export function toUpdateSql(updates: TypedColumnUpdate[]): { setClause: string; params: string[] } {
  return {
    setClause: updates.map((u) => `${u.column} = ?`).join(', '),
    params: updates.map((u) => u.value),
  };
}

// Czyste detektory śmieciowych wartości — wyeksportowane do testów jednostkowych
// (naprawa-r6bExtract, defekt #1). Bez DB/sieci — deterministyczne.
export const __test__ = { isGarbageBudget, isGarbageRoi };
