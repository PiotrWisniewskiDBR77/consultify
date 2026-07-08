/**
 * Data Inventory — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (dataInventoryEngine.ts) with the
 * AI runtime. The engine produces the four grounded diagnoses (inventory /
 * quality profile / governance maturity / AI readiness) plus a W2-validated
 * governance sequence; these builders turn that into a prompt so the model
 * refines wording and fills gaps WITHOUT inventing datasets, owners, quality
 * numbers or maturity levels the session does not support.
 *
 * INSIGHT-FIRST: the doctrine's main product is not a list of datasets but
 * sentences that lead straight to governance initiatives — "domain X critical
 * for AI, quality 40% = a hard blocker", "60% dark data with no owner",
 * "AI amplifies error -> the quality bar is higher". The prompt seeds those
 * exact insight shapes so the model writes verdicts, not recaps.
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used across the operational tools,
 * so the operational summary renderer consumes Data Inventory output the same way.
 */

import {
  assessAiReadiness,
  assessGovernance,
  assessQuality,
  buildGovernanceSequence,
  computeInventoryBaseline,
  scoreDataInventory,
  scoreLevers,
  type DataInventorySession,
} from './dataInventoryEngine';
import { localizeLadder } from './index';
import {
  QUALITY_DIMENSION_META,
  type DataGovernanceLeverId,
} from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);
const pct = (ratio: number) => Math.round(Math.max(0, Math.min(1, ratio)) * 100);

/**
 * Grounded synthesis prompt for the Data Inventory tool. Seeds the model with
 * the engine's four diagnoses, the scored levers and the W2 governance sequence
 * so its output stays consistent with the scored facts. Returns null when there
 * is nothing to conclude on (no assets AND no assessed domains).
 */
export function buildDataInventoryConclusionPrompt(
  session: DataInventorySession,
  isPolish: boolean
): string | null {
  const inv = computeInventoryBaseline(session);
  const quality = assessQuality(session);
  const governance = assessGovernance(session);
  const ai = assessAiReadiness(session);
  const score = scoreDataInventory(session);
  const levers = scoreLevers(session);
  const sequence = buildGovernanceSequence(session);

  if (inv.totalAssets === 0 && quality.profiles.length === 0) return null;

  // --- Inventory line -----------------------------------------------------
  const inventoryLine = isPolish
    ? `Mapa aktywów: ${inv.totalAssets} zbiorów w ${inv.domainsCovered} domenach; ${inv.orphanCount} bez właściciela (${pct(inv.orphanShare)}% — sieroce zbiory); ${inv.darkDataCount} dark data (${pct(inv.darkDataShare)}%); ${inv.sensitiveCount} z danymi wrażliwymi, z tego ${inv.sensitiveOrphanCount} bez właściciela (ryzyko compliance nieznanego zakresu).`
    : `Asset map: ${inv.totalAssets} assets across ${inv.domainsCovered} domains; ${inv.orphanCount} ownerless (${pct(inv.orphanShare)}% — orphan datasets); ${inv.darkDataCount} dark data (${pct(inv.darkDataShare)}%); ${inv.sensitiveCount} holding sensitive data, of which ${inv.sensitiveOrphanCount} ownerless (compliance risk of unknown scope).`;

  // --- Quality profile (per domain, per weakest dimension) ----------------
  const qualityLines = quality.profiles.length
    ? quality.profiles
        .map((p) => {
          const weak = p.weakestDimension
            ? ` | ${isPolish ? 'najsłabszy wymiar' : 'weakest dimension'}: ${localize(
                QUALITY_DIMENSION_META[p.weakestDimension.id].label.pl,
                QUALITY_DIMENSION_META[p.weakestDimension.id].label.en,
                isPolish
              )} ${pct(p.weakestDimension.score)}%`
            : '';
          return `- ${localize(p.label.pl, p.label.en, isPolish)}: ${isPolish ? 'jakość' : 'quality'} ${pct(p.overall)}% (${p.assessedCount}/8 ${isPolish ? 'wymiarów ocenionych' : 'dimensions assessed'})${weak}`;
        })
        .join('\n')
    : `- ${isPolish ? 'Brak ocenionej jakości domen.' : 'No domain quality assessed.'}`;

  // --- Governance maturity + cross-domain spread --------------------------
  const governanceLines = governance.domains.length
    ? governance.domains
        .map(
          (d) =>
            `- ${localize(d.label.pl, d.label.en, isPolish)}: ${isPolish ? 'poziom' : 'level'} ${d.level}/5 (${localize(d.levelName.pl, d.levelName.en, isPolish)})`
        )
        .join('\n')
    : `- ${isPolish ? 'Brak ocenionej dojrzałości governance.' : 'No governance maturity assessed.'}`;
  const spreadLine = governance.domains.length
    ? isPolish
      ? `Rozjazd dojrzałości między domenami: ${governance.spread} poziomów (min ${governance.minLevel}, max ${governance.maxLevel}, średnia ${governance.meanLevel}). Rozjazd sam w sobie jest insightem: governance idzie tam, gdzie jest kara za jego brak, nie tam, gdzie jest wartość.`
      : `Cross-domain maturity spread: ${governance.spread} levels (min ${governance.minLevel}, max ${governance.maxLevel}, mean ${governance.meanLevel}). The spread is itself an insight: governance goes where its absence is penalized, not where the value is.`
    : '';
  const transitionalLine = governance.transitionalRisk.length
    ? isPolish
      ? `Ostrzeżenie o trajektorii (wysoka jakość + niski governance = stan tymczasowy): ${governance.transitionalRisk
          .map((t) => `${t.label.pl.toLowerCase()} (jakość ${pct(t.quality)}%, governance ${t.level})`)
          .join('; ')}.`
      : `Trajectory warning (high quality + low governance = transitional): ${governance.transitionalRisk
          .map((t) => `${t.label.en.toLowerCase()} (quality ${pct(t.quality)}%, governance ${t.level})`)
          .join('; ')}.`
    : '';

  // --- AI readiness (weakest link, blockers, elevated bar) -----------------
  const aiLine = ai.perDomain.length
    ? isPolish
      ? `Gotowość pod AI${ai.useCaseTitle ? ` („${ai.useCaseTitle}")` : ''}: projekt stoi na ${ai.perDomain.length} domenach krytycznych; gotowość całego projektu = najsłabsze ogniwo (${pct(ai.overallReadiness)}%). Blokady (${ai.blockers.length}): ${
          ai.blockers.length
            ? ai.blockers.map((b) => `${b.label.pl.toLowerCase()} ${pct(b.readiness)}%`).join('; ')
            : 'brak'
        }. Model potrzebuje WSZYSTKICH domen naraz — jedna słaba domena wyznacza readiness całości; próg jakości pod AI (${pct(0.8)}%) jest wyższy niż pod raport dla ludzi, bo AI amplifikuje błąd.`
      : `AI readiness${ai.useCaseTitle ? ` ("${ai.useCaseTitle}")` : ''}: the project stands on ${ai.perDomain.length} critical domains; whole-project readiness = the weakest link (${pct(ai.overallReadiness)}%). Blockers (${ai.blockers.length}): ${
          ai.blockers.length
            ? ai.blockers.map((b) => `${b.label.en.toLowerCase()} ${pct(b.readiness)}%`).join('; ')
            : 'none'
        }. The model needs ALL domains at once — one weak domain sets the whole readiness; the AI quality bar (${pct(0.8)}%) is higher than a human report's, because AI amplifies error.`
    : `- ${isPolish ? 'Brak zdefiniowanego przypadku użycia AI — gotowość nieoceniana.' : 'No AI use-case defined — readiness not assessed.'}`;

  // --- Scored levers ------------------------------------------------------
  const leverLines = levers
    .slice()
    .sort((a, b) => b.urgency - a.urgency)
    .map(
      (l) =>
        `- ${localize(l.label.pl, l.label.en, isPolish)}: ${isPolish ? 'pilność' : 'urgency'} ${pct(l.urgency)}% — ${localize(l.reason.pl, l.reason.en, isPolish)}`
    )
    .join('\n');

  // --- W2 governance sequence (grounded draft) ----------------------------
  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${isPolish ? 'Faza' : 'Phase'} ${m.phase} · ${m.lever}] ${localize(m.title.pl, m.title.en, isPolish)} — rationale: ${localize(
          m.rationale.pl,
          m.rationale.en,
          isPolish
        )} | trade-off: ${localize(m.tradeOff.pl, m.tradeOff.en, isPolish)} | rejected variant: ${localize(
          m.rejectedVariant.pl,
          m.rejectedVariant.en,
          isPolish
        )}`
    )
    .join('\n');

  const scoreLine = isPolish
    ? `Indeks kondycji danych: ${score.overall}/100 (inwentarz ${score.inventoryHealth}, jakość ${score.qualityHealth}, governance ${score.governanceHealth}, gotowość AI ${score.aiReadinessHealth}). Overall jest bramkowany najsłabszym filarem — jedna twarda blokada nie zostaje uśredniona.`
    : `Data-health index: ${score.overall}/100 (inventory ${score.inventoryHealth}, quality ${score.qualityHealth}, governance ${score.governanceHealth}, AI readiness ${score.aiReadinessHealth}). Overall is gated by the weakest pillar — one hard blocker is not averaged away.`;

  const header = isPolish
    ? 'Działaj jako partner ds. governance danych i gotowości pod AI (metodyka DAMA-DMBOK, Gartner data governance maturity, data readiness for AI). Poniżej masz ugruntowaną na danych diagnozę: mapę aktywów, profil jakości po wymiarach, dojrzałość governance z rozjazdem między domenami, gotowość pod AI i sekwencję ruchów W2. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj zbiorów, właścicieli, liczb jakości ani poziomów dojrzałości niepopartych danymi sesji.'
    : 'Act as a data-governance and AI-readiness partner (DAMA-DMBOK, Gartner data governance maturity, data readiness for AI). Below is a data-grounded diagnosis: the asset map, a per-dimension quality profile, governance maturity with the cross-domain spread, AI readiness and a W2 move sequence. Refine the wording and fill gaps, but do NOT invent datasets, owners, quality numbers or maturity levels the session facts do not support.';

  const rules = isPolish
    ? [
        'INSIGHT-FIRST: produktem są zdania prowadzące do inicjatyw governance, nie lista zbiorów. Wzorce: „domena X krytyczna dla AI, ale jakość 40% = twarda blokada projektu, nie szczegół do poprawy w locie"; „60% zbiorów bez właściciela = dark data/sieroce zbiory w skali = nieznane ryzyko RODO, nie nieporządek"; „AI amplifikuje błąd → próg jakości pod AI wyższy niż pod raport dla ludzi".',
        'Jakość i governance to OSOBNE osie — wysoka jakość bez governance jest tymczasowa; czytaj je razem dla tej samej domeny (wysoka jakość + niski poziom = ostrzeżenie o trajektorii, nie powód do spokoju).',
        'Gotowość pod AI wyznacza NAJSŁABSZE ogniwo krytycznej domeny — model potrzebuje wszystkich domen naraz; jedna domena o wysokiej jakości nie ratuje readiness.',
        'Sekwencja TRZYMA porządek: naprawa master data (Faza 0) POPRZEDZA pilot AI (Faza 1), nigdy równolegle — pilot na złych danych daje model prognozujący ładnie na złym gruncie, a słaby wynik brzmi jak „AI nie działa" zamiast „dane nie były gotowe".',
        'Rozjazd governance między domenami to insight sam w sobie: governance idzie tam, gdzie jest kara za jego brak (audyt/regulator), nie tam, gdzie jest wartość strategiczna (AI).',
        'Sieroczy zbiór (brak właściciela) i dark data to CZYNNE ryzyko, nie neutralny fakt — nazwij je jako ryzyko, nie jako lukę do uzupełnienia później.',
        'Liczby (liczba zbiorów, %, poziomy, jakość) wyłącznie z diagnozy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'INSIGHT-FIRST: the product is sentences that lead to governance initiatives, not a list of datasets. Patterns: "domain X critical for AI, but quality 40% = a hard project blocker, not a detail to fix on the fly"; "60% of datasets ownerless = dark data/orphans at scale = unknown GDPR risk, not untidiness"; "AI amplifies error -> the AI quality bar is higher than a human report’s".',
        'Quality and governance are SEPARATE axes — high quality without governance is temporary; read them together for the same domain (high quality + low level = a trajectory warning, not a reason for calm).',
        'AI readiness is set by the WEAKEST critical-domain link — the model needs all domains at once; one high-quality domain does not save readiness.',
        'The sequence KEEPS order: master-data repair (Phase 0) PRECEDES the AI pilot (Phase 1), never in parallel — a pilot on bad data yields a model forecasting neatly on bad ground, and a weak result reads as "AI doesn’t work" instead of "the data wasn’t ready".',
        'The cross-domain governance spread is itself an insight: governance goes where its absence is penalized (audit/regulator), not where the strategic value is (AI).',
        'An orphan dataset (no owner) and dark data are ACTIVE risk, not a neutral fact — name them as risk, not as a gap to fill later.',
        'Numbers (asset counts, %, levels, quality) come exclusively from the diagnosis above — do not compute or invent them.',
      ];

  return `${header}

=== DATA-HEALTH INDEX ===
${scoreLine}

=== (1) INVENTORY — ASSET MAP (facts — the only admissible source of counts) ===
${inventoryLine}

=== (2) QUALITY PROFILE — 8 DAMA DIMENSIONS (a profile, never one number) ===
${qualityLines}

=== (3) GOVERNANCE MATURITY — GARTNER 5 LEVELS + CROSS-DOMAIN SPREAD ===
${governanceLines}
${spreadLine}
${transitionalLine}

=== (4) AI READINESS — WEAKEST-LINK GATING + ELEVATED QUALITY BAR ===
${aiLine}

=== SCORED GOVERNANCE LEVERS (by urgency) ===
${leverLines}

=== W2 GOVERNANCE SEQUENCE (grounded draft — order = priority, phase = sequencing) ===
${seqLines}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the data/AI-readiness decision, not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 sequence above into 3-5 "initiatives", preserving its order (order = priority) and phase (Phase 0 master-data repair precedes Phase 1 AI pilot).
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: whether the data is ready for the planned AI/analytics decision, and the single hardest blocker",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the asset map, the quality profile, the governance spread and the weakest-link readiness above",
    "keyInsights": ["3 insights in the doctrine's shape, each tied to the facts above (domain X critical for AI but quality N% = blocker; K% dark data/orphans = unknown compliance risk; AI amplifies error so the bar is higher)"],
    "appliedConclusions": ["what to fix FIRST (Phase 0)", "what NOT to do (do not run the AI pilot in parallel with the master-data repair)", "what to validate next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"governance-maturity / quality / AI-readiness change, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"governance","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the trade-off (chosen at the cost of what) and the rejected variant; states its phase (0 = before AI pilot, 1 = the pilot)"}]
}`;
}

/**
 * Builds the deepening prompt for a single governance-lever rung — used when the
 * user asks AI to "think deeper" on a specific lever (inventory / quality /
 * governance / AI readiness).
 */
export function buildDataInventoryDeepenPrompt(
  lever: DataGovernanceLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}
