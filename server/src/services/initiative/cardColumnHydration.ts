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
  const roiPct =
    s.match(/\broi\b[^%\n]{0,24}?(\d[\d\s.,]*\s*%)/i) ||
    s.match(/(\d[\d\s.,]*\s*%)[^%\n]{0,12}?\broi\b/i);
  if (roiPct) return `ROI ${roiPct[1].replace(/\s+/g, '')}`;
  // 2) Zwrot krotności "3,2x" / "zwrot 3x" / "return of 2.5x".
  const roiMult = s.match(/(?:roi|zwrot|return)[^0-9\n]{0,16}?(\d[\d.,]*\s*x)\b/i) ||
    s.match(/\b(\d[\d.,]*\s*x)\s*(?:roi|zwrot|return)/i);
  if (roiMult) return `ROI ${roiMult[1].replace(/\s+/g, '')}`;
  // 3) Payback / okres zwrotu "payback 14 miesięcy" / "zwrot w 12 mies.".
  const payback = s.match(
    /(?:payback|okres zwrotu|zwrot(?:\s+w)?)[^0-9\n]{0,16}?(\d[\d.,]*)\s*(mies|month|m-?cy|lat|year|rok)/i,
  );
  if (payback) {
    const unit = payback[2].toLowerCase();
    const label = /lat|year|rok/.test(unit) ? 'lat' : 'mies.';
    return `payback ${payback[1]} ${label}`;
  }
  return undefined;
}

/**
 * FIX 1b — wyłuskuje KWOTĘ BUDŻETU z narracji karty finansowej. Szuka słowa-klucza
 * budżetu/kosztu obok liczby z jednostką (mln/tys/k/M + waluta) i zwraca number.
 * Formaty: "budżet 1,2 mln zł", "€500k", "koszt 2.4M PLN", "300 tys. zł".
 * Bez trafienia → undefined.
 */
function extractBudgetFromText(text: string): number | undefined {
  const s = String(text || '');
  if (!s.trim()) return undefined;
  // Słowo-klucz budżetu/kosztu/inwestycji, potem (w ~40 znakach) token kwotowy.
  const kw =
    /(bud[żz]et|koszt|inwestycj|nak[łl]ad|capex|opex|cost|budget|investment|spend)/i;
  const m = kw.exec(s);
  if (m) {
    const tail = s.slice(m.index, m.index + 80);
    // Token kwotowy: liczba + opcjonalny skrót rzędu wielkości + opcjonalna waluta.
    const amt = tail.match(
      /[€$£]?\s*\d[\d\s.,]*\s*(?:mld|mln|tys\.?|bn|m|k|miliard|milion|tysi[ąa]c)?\s*(?:z[łl]|pln|eur|usd|€|\$|£)?/i,
    );
    if (amt) {
      const n = parseAmount(amt[0]);
      if (n !== undefined && n > 0) return n;
    }
  }
  // Fallback: dowolny token z jawną walutą + skrótem rzędu wielkości ("€500k").
  const anyMoney = s.match(
    /[€$£]\s*\d[\d\s.,]*\s*(?:mld|mln|tys\.?|bn|m|k|miliard|milion|tysi[ąa]c)?/i,
  ) ||
    s.match(
      /\d[\d\s.,]*\s*(?:mld|mln|tys\.?|bn|m|k)\s*(?:z[łl]|pln|eur|usd|€|\$|£)/i,
    );
  if (anyMoney) {
    const n = parseAmount(anyMoney[0]);
    if (n !== undefined && n > 0) return n;
  }
  return undefined;
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
    if (!isEmptyCol(existingRow, column)) return;
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
