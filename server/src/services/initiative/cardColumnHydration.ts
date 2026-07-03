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
 *   targetState      → { successCriteria[], deliverables[], vision? }
 *   financialImpact / businessCase → { businessValue, costCapex, costOpex, expectedRoi }
 *        LUB realny kształt premium: { revenueImpact, costSavings, benefitsRealization }
 *        (narracja składana w business_value, gdy brak jawnego businessValue)
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

  // targetState → success_criteria / deliverables (JSON-arrays)
  const ts = cards['targetState'];
  if (ts !== undefined) {
    const j = parseJsonLoose(ts);
    if (j && typeof j === 'object') {
      pushList('success_criteria', cleanList(j.successCriteria ?? j.criteria));
      pushList('deliverables', cleanList(j.deliverables));
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
      push('cost_capex', cleanStr(j.costCapex ?? j.capex));
      push('cost_opex', cleanStr(j.costOpex ?? j.opex));
      push('expected_roi', cleanStr(j.expectedRoi ?? j.roi));
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
