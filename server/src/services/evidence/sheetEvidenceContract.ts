/**
 * Sheet (arkusz) — HP-16 domknięcie kontraktu dowodowego.
 *
 * PROBLEM (PANEL_HP16_REAL.md): generator arkusza (`docGenerationRuntime.startSheet`)
 * idzie ścieżką tła (202 + poll) i — w odróżnieniu od decka/dokumentu/mindmapy/
 * process_flow/notatki — NIGDY nie liczył `EvidenceContract` ani nie persystował
 * `EvidenceEnvelope`. Był jedynym z 8 narzędzi Teresy bez kontraktu dowodowego, więc
 * panel dowodowy (`ArtifactRightPanel`, fetch `/evidence/sheet/:id`) pokazywał dla
 * arkuszy pusty stan mimo realnych sygnałów jakości.
 *
 * Ten moduł domyka lukę DETERMINISTYCZNIE — wzorzec deck (`buildDeckEvidenceContract`)
 * + note (`buildNoteEvidenceContract`): PURE funkcja, ZERO LLM, ZERO I/O. Reużywa
 * sygnały, które pipeline arkusza już policzył (nie liczy drugiego zestawu):
 *   - `sourceRefs` = encje org podpięte jako grounding (`DocGenerationSetup.sourceRefs`)
 *     — dokładnie to, co poszło do `buildGroundingFacts`.
 *   - `grounded` = czy do promptu trafiły REALNE fakty organizacji (`sheetFacts !== null`).
 *     Gdy `false` — wiersze startowe są jawnie ILUSTRACYJNE (kontrakt §0.3 w startSheet),
 *     nie rzeczywiste metryki: twarde ryzyko + `toVerify`, sufit jakości niski.
 *   - `premium` = czy użyto TYPOWANEGO schematu B4 (`tableSchemaB4`, exceljs/CF) zamiast
 *     surowego markdownu — realny sygnał jakości strukturalnej.
 *   - `rowCount` = liczba wierszy danych (`extractGfmTable(...).rowCount`) — licznik
 *     kompletności, nie ocena LLM.
 */
import {
  deriveConfidence,
  type EvidenceContract,
  type EvidenceContractSource,
} from './evidenceContract.js';

/** Minimalny kształt źródła — zgodny z `DocumentSourceRef` (celowo luźny). */
export interface SheetEvidenceSourceRef {
  sourceType: string;
  sourceId: string;
  sourceTitle?: string;
}

export interface SheetEvidenceOptions {
  /** Encje org podpięte jako grounding (`stored.sourceRefs`). Puste = brak twardych źródeł. */
  sourceRefs?: SheetEvidenceSourceRef[];
  /** Surowy tekst prośby (`stored.intent`) — źródło `chat_intent`, jedyny wkład bez grounddingu. */
  seedText?: string;
  /**
   * `true` gdy do promptu trafiły REALNE fakty organizacji (`sheetFacts !== null`).
   * `false` ⇒ wiersze są ilustracyjne (§0.3), nie rzeczywiste dane — sufit jakości niski.
   */
  grounded: boolean;
  /** `true` gdy zmaterializowano TYPOWANY schemat B4 (premium), nie surowy markdown. */
  premium: boolean;
  /** Liczba wierszy danych w tabeli (`table.rowCount`). */
  rowCount: number;
}

/**
 * Buduje `EvidenceContract` arkusza. DETERMINISTYCZNIE — zero LLM, zero I/O.
 *
 * Reguły jakości (parytet z `buildNoteEvidenceContract`):
 *   - `grounded` (realne fakty org) ⇒ premium 100 / legacy 80.
 *   - `!grounded` (wiersze ilustracyjne) ⇒ 20 gdy są jakieś wiersze, 0 gdy brak.
 *     `qualityScore < 40` twardo obniża pewność do 'low' (bramka `deriveConfidence`).
 *   - `unresolvedGaps` = 1 gdy `!grounded` (luka: brak realnych danych), inaczej 0.
 *   - Pewność 'high' wymaga ≥3 źródeł ∧ brak luk ∧ jakość ≥70 — więc tylko ugruntowany
 *     arkusz z ≥3 podpiętymi encjami org może osiągnąć 'high' (uczciwe).
 */
export function buildSheetEvidenceContract(opts: SheetEvidenceOptions): EvidenceContract {
  const seed = String(opts.seedText || '').trim();
  const refs = Array.isArray(opts.sourceRefs) ? opts.sourceRefs : [];
  const rowCount = Number.isFinite(opts.rowCount) ? Math.max(0, opts.rowCount) : 0;

  const sources: EvidenceContractSource[] = [];
  if (seed) sources.push({ type: 'chat_intent', title: seed.slice(0, 120) });
  refs
    .filter((r) => r && (r.sourceId || r.sourceTitle))
    .forEach((r) =>
      sources.push({
        type: r.sourceType || 'source',
        ref: r.sourceId,
        title: r.sourceTitle || r.sourceId,
      })
    );

  const risks: string[] = [];
  const toVerify: string[] = [];

  if (!opts.grounded) {
    risks.push(
      'Arkusz wypełniony przykładowymi wierszami startowymi — w kontekście nie było realnych danych organizacji (kontrakt §0.3). Liczby są ilustracyjne, nie rzeczywiste metryki.'
    );
    toVerify.push(
      'Zweryfikuj wartości w arkuszu — powstały jako przykłady (brak faktów org w kontekście), nie są rzeczywistymi danymi.'
    );
  }

  if (rowCount === 0) {
    toVerify.push(
      'Arkusz nie ma żadnych wierszy danych — uzupełnij ręcznie lub wygeneruj ponownie z konkretniejszą prośbą.'
    );
  }

  if (!opts.premium) {
    // Legacy markdown-LLM ⇒ brak typowania kolumn (number/currency/date/singleSelect),
    // brak reguł formatowania warunkowego — struktura słabsza niż schemat B4.
    toVerify.push(
      'Arkusz powstał w trybie tekstowym (bez typowanego schematu) — sprawdź typy kolumn i formaty wartości.'
    );
  }

  const qualityScore = opts.grounded ? (opts.premium ? 100 : 80) : rowCount > 0 ? 20 : 0;

  const confidence = deriveConfidence({
    sourceCount: sources.length,
    unresolvedGaps: opts.grounded ? 0 : 1,
    qualityScore,
  });

  return { sources, assumptions: [], risks, confidence, toVerify };
}

export default { buildSheetEvidenceContract };
