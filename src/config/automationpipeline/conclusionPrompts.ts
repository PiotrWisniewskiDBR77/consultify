/**
 * Automation Pipeline — conclusion prompt contract (CONCLUSION_LAYER_STANDARD W2).
 *
 * Bridges the deterministic synthesis engine (automationPipelineEngine.ts) with
 * the AI runtime. The engine produces a grounded baseline (tech tiers + effort×
 * impact quadrants + hidden-volume/TCO) + lever ranking + a W2 wave sequence;
 * these builders turn that into an INSIGHT-FIRST prompt so the model surfaces
 * "what WINS out of this" (doctrine section 6) — not a recap of the register —
 * WITHOUT inventing FTE-hours or processes the session does not support.
 *
 * Insight patterns seeded (doctrine section 6):
 *   - "process X = high-volume + rule-based + structured data = candidate #1 (quick win, RPA)"
 *   - "N% of reported volume sits in processes not ready without redesign first"
 *   - "we are automating chaos → fix the process first → a redesign initiative, not a bot"
 *   - "this looks like RPA but the data profile needs an IDP layer first"
 *   - "the register is 90% top-down — we do not see the real pipeline (build process mining)"
 *
 * Shape mirrors the shared tool conclusion contract (verdict / rationale /
 * tradeoffs / initiatives / expectedEffect) used by the RPA/SMED/inventory
 * prompts, so the operational summary renderer consumes this output the same way.
 */

import {
  QUADRANT_LABEL,
  buildW2MoveSequence,
  computeBaseline,
  rankLevers,
  techTierLabel,
  WAVE_LABEL,
  type AutomationPipelineSession,
  type ProcessAssessment,
} from './automationPipelineEngine';
import { localizeLadder } from './index';
import { type PipelineLeverId } from './deepeningLadder';

const localize = (pl: string, en: string, isPolish: boolean) => (isPolish ? pl : en);

/** Pick the single strongest quick-win candidate for the headline insight. */
const strongestOf = (assessments: ProcessAssessment[], quadrant: string): ProcessAssessment | null => {
  const pool = assessments.filter((a) => a.quadrant === quadrant);
  if (pool.length === 0) return null;
  return pool.reduce((best, a) => (a.automatableFteHours > best.automatableFteHours ? a : best));
};

/**
 * Grounded, insight-first synthesis prompt: seeds the model with the engine's
 * baseline, per-process tech/quadrant assessments and the W2 wave sequence so
 * its output stays consistent with the scored facts. Returns null when there is
 * nothing to conclude on.
 */
export function buildAutomationPipelineConclusionPrompt(
  session: AutomationPipelineSession,
  isPolish: boolean
): string | null {
  const baseline = computeBaseline(session);
  if (baseline.candidateCount === 0) return null;

  const ranking = rankLevers(session);
  const sequence = buildW2MoveSequence(session);

  const topQuickWin = strongestOf(baseline.assessments, 'quick-win');
  const topBet = strongestOf(baseline.assessments, 'strategic-bet');

  const baselineLine = isPolish
    ? `Portfel automatyzacji: ${baseline.candidateCount} procesów-kandydatów; ${baseline.totalFteHours} FTE-h/rok pracy manualnej łącznie, z czego ${baseline.automatableFteHours} FTE-h/rok automatyzowalnych (główna ścieżka). Największy pojedynczy blok: ${baseline.topCandidateFteHours} FTE-h/rok${baseline.topCandidateId ? ` (proces „${baseline.topCandidateId}")` : ''}. Niegotowe technicznie (redesign najpierw): ${baseline.notReadyFteHours} FTE-h/rok (${Math.round(baseline.notReadyShare * 100)}% wolumenu). Zmierzone: ${Math.round(baseline.measuredRatio * 100)}% kandydatów; z process/task miningu: ${Math.round(baseline.miningRatio * 100)}%.`
    : `Automation portfolio: ${baseline.candidateCount} candidate processes; ${baseline.totalFteHours} FTE-h/yr of manual work total, of which ${baseline.automatableFteHours} FTE-h/yr automatable (main path). Largest single block: ${baseline.topCandidateFteHours} FTE-h/yr${baseline.topCandidateId ? ` (process "${baseline.topCandidateId}")` : ''}. Not technically ready (redesign first): ${baseline.notReadyFteHours} FTE-h/yr (${Math.round(baseline.notReadyShare * 100)}% of volume). Measured: ${Math.round(baseline.measuredRatio * 100)}% of candidates; from process/task mining: ${Math.round(baseline.miningRatio * 100)}%.`;

  const tierLine = isPolish
    ? `Dobór technologii: RPA ${baseline.tierCounts.rpa} · IDP ${baseline.tierCounts.idp} · IPA ${baseline.tierCounts.ipa} · agent AI ${baseline.tierCounts.agentic} · redesign najpierw ${baseline.tierCounts['redesign-first']}. Ćwiartki: quick win ${baseline.quadrantCounts['quick-win']} · strategiczny zakład ${baseline.quadrantCounts['strategic-bet']} · wypełniacz ${baseline.quadrantCounts['fill-in']} · znak zapytania ${baseline.quadrantCounts['question-mark']}.`
    : `Technology fit: RPA ${baseline.tierCounts.rpa} · IDP ${baseline.tierCounts.idp} · IPA ${baseline.tierCounts.ipa} · AI agent ${baseline.tierCounts.agentic} · redesign-first ${baseline.tierCounts['redesign-first']}. Quadrants: quick win ${baseline.quadrantCounts['quick-win']} · strategic bet ${baseline.quadrantCounts['strategic-bet']} · fill-in ${baseline.quadrantCounts['fill-in']} · question mark ${baseline.quadrantCounts['question-mark']}.`;

  const perProcessLines = baseline.assessments
    .map(
      (a) =>
        `- ${a.id}: ${localize(techTierLabel(a.techTier).pl, techTierLabel(a.techTier).en, isPolish)} · ${localize(
          QUADRANT_LABEL[a.quadrant].pl,
          QUADRANT_LABEL[a.quadrant].en,
          isPolish
        )} · ${a.automatableFteHours} FTE-h/yr · impact ${a.impact}/5 × effort ${a.effort}/5 (TCO ${isPolish ? 'wdroż.' : 'build'} ${a.tco.implementation}/${isPolish ? 'utrzym.' : 'maint.'} ${a.tco.maintenance}/${isPolish ? 'ryz.' : 'risk'} ${a.tco.risk})${a.redesignFirst ? (isPolish ? ' · REDESIGN NAJPIERW' : ' · REDESIGN FIRST') : ''}${a.paretoScopable ? (isPolish ? ' · 80/20 scopable' : ' · 80/20 scopable') : ''}${a.ownerReady ? '' : isPolish ? ' · brak właściciela governance' : ' · no governance owner'}`
    )
    .join('\n');

  const scoreLines = ranking.scores
    .filter((s) => s.moveCount > 0)
    .map(
      (s) =>
        `- ${localize(s.label.pl, s.label.en, isPolish)}: fit ${s.score}/9 (attractiveness ${s.attractiveness} × feasibility ${s.feasibility}), ${s.fteHoursAddressed} FTE-h/yr addressed, ${s.evidenceBacked}/${s.moveCount} evidence-backed`
    )
    .join('\n');

  const seqLines = sequence
    .map(
      (m) =>
        `${m.order}. [${localize(WAVE_LABEL[m.wave].pl, WAVE_LABEL[m.wave].en, isPolish)}] ${localize(
          m.title.pl,
          m.title.en,
          isPolish
        )} — rationale: ${localize(m.rationale.pl, m.rationale.en, isPolish)} | trade-off: ${localize(
          m.tradeOff.pl,
          m.tradeOff.en,
          isPolish
        )} | rejected variant: ${localize(m.rejectedVariant.pl, m.rejectedVariant.en, isPolish)}`
    )
    .join('\n');

  // Seed the doctrine's insight archetypes, grounded in this session's facts.
  const seededInsights: string[] = [];
  if (topQuickWin) {
    seededInsights.push(
      isPolish
        ? `Proces „${topQuickWin.id}" = ${topQuickWin.automatableFteHours} FTE-h/rok + ${localize(techTierLabel(topQuickWin.techTier).pl, '', true)} = kandydat #1 (quick win) — gotowy do wpięcia w inicjatywę z właścicielem i celem liczbowym.`
        : `Process "${topQuickWin.id}" = ${topQuickWin.automatableFteHours} FTE-h/yr + ${localize('', techTierLabel(topQuickWin.techTier).en, false)} = candidate #1 (quick win) — ready to wire into an initiative with an owner and a numeric target.`
    );
  }
  if (baseline.notReadyShare >= 0.3) {
    seededInsights.push(
      isPolish
        ? `${Math.round(baseline.notReadyShare * 100)}% automatyzowalnego wolumenu siedzi w procesach niegotowych BEZ zmiany reguł/redesignu najpierw — to zatrzymuje pipeline przed marnowaniem budżetu i przekierowuje na inicjatywę redesignu procesu, nie technologii.`
        : `${Math.round(baseline.notReadyShare * 100)}% of automatable volume sits in processes not ready WITHOUT redesign first — this stops the pipeline from wasting budget and redirects to a process-redesign initiative, not a technology one.`
    );
  }
  if (baseline.tierCounts.idp > 0) {
    seededInsights.push(
      isPolish
        ? `Część procesów wygląda na kandydatów RPA, ale profil danych (dokumenty nieustrukturyzowane) wymaga najpierw warstwy IDP — inaczej wdrożenie utknie na etapie ekstrakcji danych.`
        : `Some processes look like RPA candidates, but the data profile (unstructured documents) needs an IDP layer first — otherwise the build stalls at data extraction.`
    );
  }
  if (baseline.miningRatio < 0.3) {
    seededInsights.push(
      isPolish
        ? `Rejestr kandydatów pochodzi w ${100 - Math.round(baseline.miningRatio * 100)}% ze zgłoszeń top-down — brak process miningu oznacza, że nie widzicie prawdziwego pipeline'u; priorytet inwestycyjny to narzędzie odkrywania procesu, nie kolejny bot.`
        : `The candidate register is ${100 - Math.round(baseline.miningRatio * 100)}% top-down requests — without process mining you do not see the real pipeline; the investment priority is a process-discovery tool, not another bot.`
    );
  }
  const topPareto = strongestOf(baseline.assessments.filter((a) => a.paretoScopable), 'quick-win')
    ?? (baseline.paretoScopableIds.length > 0
      ? baseline.assessments.find((a) => a.paretoScopable) ?? null
      : null);
  if (topPareto) {
    seededInsights.push(
      isPolish
        ? `80/20: proces „${topPareto.id}" ma dominującą ścieżkę (≥80% wolumenu) — automatyzuj GŁÓWNĄ ścieżkę + eskalacja wyjątków do człowieka; ${topPareto.automatableFteHours} FTE-h/rok głównej ścieżki to większość wartości przy ułamku effortu potrzebnego na 100% wariantów (długi ogon niewart osobnej automatyzacji).`
        : `80/20: process "${topPareto.id}" has a dominant path — automate the MAIN path + escalate exceptions to a human; ${topPareto.automatableFteHours} FTE-h/yr of the main path is most of the value at a fraction of the effort needed for 100% of variants (the long tail is not worth its own automation).`
    );
  }
  if (baseline.technicallyReadyNoOwnerIds.length > 0) {
    seededInsights.push(
      isPolish
        ? `Bariera pozatechniczna: proces(y) „${baseline.technicallyReadyNoOwnerIds.join(', ')}" (${baseline.noOwnerFteHours} FTE-h/rok) kwalifikują się technicznie, ale NIE mają właściciela biznesowego gotowego przejąć governance bota — to najczęstszy powód, dla którego „gotowe technicznie" pipeline'y stoją w miejscu; ruch = wyznacz właściciela ZANIM padnie budżet na budowę, nie po.`
        : `Non-technical barrier: process(es) "${baseline.technicallyReadyNoOwnerIds.join(', ')}" (${baseline.noOwnerFteHours} FTE-h/yr) qualify technically but have NO business owner ready to take over bot governance — the most common reason "technically ready" pipelines stall; the move = name an owner BEFORE the build budget is committed, not after.`
    );
  }

  const header = isPolish
    ? 'Działaj jako partner ds. Intelligent Automation / hyperautomation (McKinsey/Deloitte/Gartner). Poniżej masz ugruntowaną na danych ocenę portfela automatyzacji: dobór technologii per proces, macierz effort × impact, wykryte procesy „do redesignu najpierw", ukryty wolumen (FTE-h) i sekwencję fal W2. Zacznij od INSIGHTU (co z tego WYNIKA), nie od streszczenia rejestru. Dopracuj sformułowania i uzupełnij luki, ale NIE wymyślaj FTE-godzin ani procesów niepopartych danymi sesji.'
    : 'Act as an Intelligent Automation / hyperautomation partner (McKinsey/Deloitte/Gartner). Below is a data-grounded assessment of the automation portfolio: per-process technology fit, an effort × impact matrix, detected "redesign-first" processes, hidden volume (FTE-h) and a W2 wave sequence. Lead with an INSIGHT (what this WINS), not a recap of the register. Refine the wording and fill gaps, but do NOT invent FTE-hours or processes the session facts do not support.';

  const rules = isPolish
    ? [
        'Insight-first: „verdict" i „keyInsights" mówią, co WYNIKA z oceny (który proces = kandydat #1 i dlaczego, co odpada i dlaczego), nie streszczają rejestru.',
        'Każdy insight kończy się KONKRETNĄ pozycją w pipeline (proces + technologia + priorytet + właściciel + FTE-h) ALBO inicjatywą poprzedzającą automatyzację (redesign procesu, budowa API, process mining).',
        'Każdy ruch MUSI mieć: rationale, trade-off (co to kosztuje), wariant odrzucony (czego świadomie NIE robicie i dlaczego).',
        'Trzymaj porządek: odkryj → sprofiluj → dobierz technologię → priorytetyzuj (effort×impact) → sekwencjonuj (quick winy przed strategic bets). Nie automatyzuj chaosu — proces z wysokim % wyjątków idzie do redesignu, nie do bota.',
        'Dobór technologii wynika z PROFILU procesu (regułowość × dane × osąd), nie z mody — nie proponuj agenta AI tam, gdzie wystarczy RPA, ani RPA tam, gdzie dane wymagają IDP.',
        'Liczby (FTE-h, %, ćwiartki, technologie) wyłącznie z bazy powyżej — nie licz i nie zmyślaj.',
      ]
    : [
        'Insight-first: "verdict" and "keyInsights" say what the assessment WINS (which process = candidate #1 and why, what drops out and why), not a recap of the register.',
        'Every insight ends in a CONCRETE pipeline entry (process + technology + priority + owner + FTE-h) OR a pre-automation initiative (process redesign, API build, process mining).',
        'Every move MUST carry: rationale, trade-off (what it costs), rejected variant (what you deliberately do NOT do and why).',
        'Keep order: discover → profile → technology fit → prioritize (effort×impact) → sequence (quick wins before strategic bets). Do not automate chaos — a process with a high exception rate goes to redesign, not a bot.',
        'Technology fit follows the process PROFILE (rule-ness × data × judgment), not a trend — do not propose an AI agent where RPA suffices, nor RPA where the data needs IDP.',
        'Numbers (FTE-h, %, quadrants, technologies) come exclusively from the baseline above — do not compute or invent them.',
      ];

  return `${header}

=== AUTOMATION PORTFOLIO BASELINE (facts — the only admissible source of amounts) ===
${baselineLine}
${tierLine}

=== PER-PROCESS ASSESSMENT (technology fit × effort × impact quadrant) ===
${perProcessLines}

=== SCORED PIPELINE LEVERS ===
${scoreLines}

=== W2 WAVE SEQUENCE (grounded draft) ===
${seqLines}

=== SEEDED INSIGHTS (doctrine archetypes, grounded in the facts above — refine, do not dilute) ===
${seededInsights.length > 0 ? seededInsights.map((i) => `- ${i}`).join('\n') : '- (none triggered — derive insights from the per-process assessment above)'}

Rules:
${rules.map((r) => `- ${r}`).join('\n')}

QUALITY BARS:
- Answer-first: "verdict" is a thesis about the pipeline decision (what wins the budget, in what order, with what technology), not a recap of the inputs.
- Numbers exclusively from the facts above; do not compute or invent new ones.
- Zero filler and zero AI meta-phrases ("As an AI", "Based on the provided data", "In conclusion") — write like a partner signing the work with their name.
- Every sentence falsifiable: with opposite facts it would read differently.
- Map the grounded W2 wave sequence above into 3-5 "initiatives", preserving its order (order = priority); a redesign-track move becomes a pre-automation initiative, not an automation one.
- Respond in ${isPolish ? 'Polish' : 'English'}, active voice, partner tone.

Return JSON:
{
  "summary": {
    "verdict": "answer-first, 1-2 sentences: what wins the automation budget, in what order, with what technology — and what does NOT (redesign first)",
    "executiveSummary": "3-4 sentences: restate the verdict, then why — anchored in the FTE-hours, tech tiers and quadrants above",
    "keyInsights": ["3 insights, each ending in a concrete pipeline entry OR a pre-automation initiative, tied to the facts above"],
    "appliedConclusions": ["what to build first (quick win + technology)", "what NOT to automate yet (redesign-first)", "what to validate/measure next"],
    "tradeoffs": [{"chosen":"...","rejected":"...","why":"..."}],
    "expectedEffect": {"text":"FTE-hours recovered / risk reduced, behaviorally observable","horizon":"..."}
  },
  "initiatives": [{"title":"...","description":"what to do + first step (verb + artifact + role)","type":"operational","estimatedImpact":"high|medium|low","estimatedEffort":"high|medium|low","rationale":"why — names the technology fit, the trade-off (chosen at the cost of what) and the rejected variant"}]
}`;
}

/**
 * Builds the deepening prompt for a single lever rung — used when the user asks
 * AI to "think deeper" on a specific pipeline lever.
 */
export function buildAutomationPipelineDeepenPrompt(
  lever: PipelineLeverId,
  rungId: 'surface' | 'evidence' | 'quantification' | 'risk-capability',
  isPolish: boolean
): string | null {
  const rungs = localizeLadder(lever, isPolish);
  const rung = rungs.find((r) => r.id === rungId);
  if (!rung) return null;
  return `${rung.question}\n\n${isPolish ? 'Kontekst konsultanta' : 'Consultant framing'}: ${rung.rationale}`;
}
