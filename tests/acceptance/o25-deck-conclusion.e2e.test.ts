/**
 * Oxford O2.5 — Deck CONCLUSION LAYER slide (K1→K4 "Wnioski") — REAL-runtime E2E.
 *
 * PROVES the wiring: a deck generated on the chat path ("stwórz prezentację…")
 * gains a grounded CONCLUSION slide (verdict → why → what-to-do → horizon,
 * CONCLUSION_LAYER_STANDARD §W5) that PASSES the K1→K4 server-twin validator
 * (`validateConclusion`) — instead of being a section collage that stops at
 * "pokaż liczby".
 *
 * Two axes, REAL services + REAL DB (parity pg18 :5443), REAL LLM
 * (ANTHROPIC_API_KEY), REAL flags:
 *
 *  A) CHAT PATH — the literal "stwórz prezentację" flow: `generateDeliverable
 *     ({type:'presentation'})` → plan (`generateOutline`, writes the deck row
 *     synchronously) → start (`generateDeck` in the background) → poll → read
 *     `unified_json`. Asserts the persisted deck carries a slide whose
 *     `_conclusion` envelope is a K1→K4 structure with `validation.allHardPass`.
 *
 *  B) GROUNDED PATH — `generateOutline` + `generateDeck` called directly with an
 *     `initiative_portfolio` + `kpi_roi` source (real rows on the org), visuals
 *     off for speed. Proves the conclusion is GROUNDED: numbers-from-engine hold
 *     (validator `numbers_from_engine` passes) and the K-structure is complete.
 *
 * Flags: ENABLE_DELIVERABLES_LIGHT + ENABLE_DECK_CONCLUSION_SLIDE ON (both
 * default OFF — set here BEFORE the first import of the generator). Isolation:
 * prefix `odbior--o25--`, cleaned in afterAll. NIE push.
 */
import { appendFileSync } from 'node:fs';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--o25--';

function evidence(line: string): void {
  console.log(line);
  const file = process.env.O25_EVIDENCE_FILE;
  if (file) {
    try {
      appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
    } catch {
      /* best-effort */
    }
  }
}

const createdDeckIds: string[] = [];
const createdInitiativeIds: string[] = [];
const createdKpiIds: string[] = [];

type GenerateDeliverableFn = (
  params: { type: string; intent: string; title?: string },
  context: {
    organizationId?: string;
    userId?: string;
    conversationId?: string | null;
    language?: string;
    role?: string;
  }
) => Promise<Record<string, unknown>>;

type StatusFn = (params: {
  generationId: string;
  organizationId: string;
}) => Promise<Record<string, unknown>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenModule = any;

let generateDeliverable: GenerateDeliverableFn;
let getGenerationStatus: StatusFn;
let generatorService: GenModule;

beforeAll(async () => {
  // Both flags default OFF — must be ON in THIS process BEFORE the first import
  // of generateDeliverable.ts / presentationGeneratorService.ts (config/
  // FeatureFlags reads process.env once at module load; the generator's
  // conclusion gate reads process.env at call time).
  process.env.ENABLE_DELIVERABLES_LIGHT = 'true';
  process.env.ENABLE_DECK_CONCLUSION_SLIDE = 'true';

  await seed(); // idempotent org/user/membership

  // Grounded source data for axis B (prefix-isolated, cleaned in afterAll).
  const client = pgClient();
  await client.connect();
  try {
    for (let i = 1; i <= 3; i++) {
      const id = `${PREFIX}init-${i}`;
      createdInitiativeIds.push(id);
      await client.query(
        `INSERT INTO initiatives (id, organization_id, name, status, priority, axis, progress, expected_roi, created_at)
         VALUES ($1, $2, $3, 'EXECUTING', $4, 'DATA', $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [id, SEED.ORG_ID, `${PREFIX}Inicjatywa ${i}`, 100 - i, 20 * i, 150 + i]
      );
    }
    for (let i = 1; i <= 2; i++) {
      const id = `${PREFIX}kpi-${i}`;
      createdKpiIds.push(id);
      await client.query(
        `INSERT INTO initiative_kpis (id, organization_id, name, unit, baseline_value, target_value, current_value)
         VALUES ($1, $2, $3, '%', $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [id, SEED.ORG_ID, `${PREFIX}Wskaznik ${i}`, 40 + i, 80 + i, 62 + i]
      );
    }
  } finally {
    await client.end();
  }

  ({ generateDeliverable } = await import(
    '../../server/src/services/ai/tools/generateDeliverable.js'
  ));
  ({ status: getGenerationStatus } = (await import(
    '../../server/src/services/deliverables/deliverablesGenerationService.js'
  )) as unknown as { status: StatusFn });
  generatorService = await import('../../server/src/services/presentationGeneratorService.js');
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    if (createdDeckIds.length) {
      await client
        .query('DELETE FROM v8_artifact_origin_links WHERE origin_record_id = ANY($1)', [
          createdDeckIds,
        ])
        .catch(() => {});
      await client
        .query('DELETE FROM v8_output_artifacts WHERE artifact_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_deck_versions WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_cards WHERE deck_id = ANY($1)', [createdDeckIds])
        .catch(() => {});
      await client
        .query('DELETE FROM presentation_decks WHERE id = ANY($1)', [createdDeckIds])
        .catch(() => {});
    }
    if (createdKpiIds.length) {
      await client
        .query('DELETE FROM initiative_kpis WHERE id = ANY($1)', [createdKpiIds])
        .catch(() => {});
    }
    if (createdInitiativeIds.length) {
      await client
        .query('DELETE FROM initiatives WHERE id = ANY($1)', [createdInitiativeIds])
        .catch(() => {});
    }
  } finally {
    await client.end();
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollGenerationStatus(
  generationId: string,
  timeoutMs: number,
  intervalMs = 3000
): Promise<Record<string, unknown> | undefined> {
  const deadline = Date.now() + timeoutMs;
  let last: Record<string, unknown> | undefined;
  while (Date.now() < deadline) {
    last = await getGenerationStatus({ generationId, organizationId: SEED.ORG_ID });
    if (last?.state === 'draft' || last?.state === 'error') return last;
    await sleep(intervalMs);
  }
  return last;
}

interface ConclusionEnvelope {
  version: number;
  structure: string;
  k1: string;
  k2: string;
  k3: Array<{ action: string; whyFirst: string; ownerRole: string }>;
  k4: string;
  k4Horizon: string;
  confidence: string;
  source: string;
  validation: { allHardPass: boolean; failures: string[] };
}

/** Find the CONCLUSION slide (carries the `_conclusion` envelope) in a unified_json blob. */
function findConclusionSlide(
  unifiedJson: unknown
): { slide: Record<string, unknown>; conclusion: ConclusionEnvelope } | null {
  const uj = typeof unifiedJson === 'string' ? JSON.parse(unifiedJson) : unifiedJson;
  const slides: Array<Record<string, unknown>> = Array.isArray((uj as any)?.slides)
    ? (uj as any).slides
    : [];
  for (const slide of slides) {
    const c = (slide as any)._conclusion as ConclusionEnvelope | undefined;
    if (c && c.structure === 'K1-K4') return { slide, conclusion: c };
  }
  return null;
}

/** Assert the K1→K4 shape + hard-validator pass on a conclusion envelope. */
function assertKStructure(conclusion: ConclusionEnvelope): void {
  expect(conclusion.structure).toBe('K1-K4');
  // K1 verdict / K2 why / K4 effect present.
  expect(typeof conclusion.k1).toBe('string');
  expect(conclusion.k1.trim().length).toBeGreaterThan(0);
  expect(conclusion.k2.trim().length).toBeGreaterThan(0);
  expect(conclusion.k4.trim().length).toBeGreaterThan(0);
  // K3 — 1..3 owned actions.
  expect(Array.isArray(conclusion.k3)).toBe(true);
  expect(conclusion.k3.length).toBeGreaterThanOrEqual(1);
  expect(conclusion.k3.length).toBeLessThanOrEqual(3);
  for (const a of conclusion.k3) {
    expect(a.action.trim().length).toBeGreaterThan(0);
    expect(a.ownerRole.trim().length).toBeGreaterThan(0);
  }
  // K4 horizon present.
  expect(conclusion.k4Horizon.trim().length).toBeGreaterThan(0);
  // The K1→K4 server-twin validator passes every HARD gate. `allHardPass` is
  // the publish gate per CONCLUSION_LAYER_STANDARD §4.4 ("a conclusion failing
  // this MUST NOT be published"); the soft advisory checks (confidence_honest,
  // len_limits, lang, …) may legitimately fire on consultant-grade LLM prose.
  evidence(
    `[O25] conclusion source=${conclusion.source} confidence=${conclusion.confidence} allHardPass=${conclusion.validation.allHardPass} failures=[${conclusion.validation.failures.join(',')}]`
  );
  if (!conclusion.validation.allHardPass) {
    evidence(`[O25][DEBUG] k1="${conclusion.k1}"`);
    evidence(`[O25][DEBUG] k2="${conclusion.k2}"`);
    evidence(`[O25][DEBUG] k3=${JSON.stringify(conclusion.k3)}`);
    evidence(`[O25][DEBUG] k4="${conclusion.k4}" horizon="${conclusion.k4Horizon}"`);
  }
  expect(conclusion.validation.allHardPass).toBe(true);
}

// ============================================================================
// A) CHAT PATH — "stwórz prezentację" → deck gains a K1→K4 conclusion slide.
// ============================================================================
describe('Acceptance O2.5: deck conclusion slide (chat path — generateDeliverable)', () => {
  it('generates a deck whose unified_json contains a K1→K4 "Wnioski" slide that passes the validator', async () => {
    const title = `${PREFIX}Deck ${Date.now()}`;
    const result = await generateDeliverable(
      {
        type: 'presentation',
        intent:
          'Prezentacja zarządcza: kontekst, rekomendacja i plan wdrożenia programu transformacji.',
        title,
      },
      { organizationId: SEED.ORG_ID, userId: SEED.USER_ID, language: 'pl', role: SEED.ROLE }
    );
    if (!result.ok) console.error(`[O25-A] generateDeliverable FAILED: ${JSON.stringify(result)}`);
    expect(result.error).not.toBe('feature_disabled');
    expect(result.ok).toBe(true);

    const deckId = String((result as any).draftId || '');
    expect(deckId).toBeTruthy();
    createdDeckIds.push(deckId);

    const final = await pollGenerationStatus(deckId, 180_000, 3000);
    console.log(`[O25-A] final state=${(final as any)?.state} error=${(final as any)?.error ?? ''}`);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT status, unified_json, deck_json, slide_count FROM presentation_decks WHERE id = $1`,
        [deckId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('ready');
      expect(Number(rows[0].slide_count)).toBeGreaterThan(0);
      expect(rows[0].unified_json).toBeTruthy();

      const found = findConclusionSlide(rows[0].unified_json);
      expect(found, 'unified_json must contain a K1→K4 conclusion slide').not.toBeNull();
      assertKStructure(found!.conclusion);

      // The visible slide is a real content slide (key_messages) titled with the
      // verdict headline; its body carries the 4 K-blocks.
      expect(String(found!.slide.intent)).toBe('key_messages');
      const headline = String(found!.slide.key_message || '');
      expect(headline.length).toBeGreaterThan(8);

      // deck_json (projected DeckDocument) also carries the conclusion card copy.
      const deckJsonStr = String(rows[0].deck_json || '');
      expect(deckJsonStr).toContain('Czego oczekiwać'); // K4 block label (pl)

      evidence(
        `[O25-A] GREEN deck=${deckId} slides=${rows[0].slide_count} conclusion.source=${found!.conclusion.source} confidence=${found!.conclusion.confidence} allHardPass=${found!.conclusion.validation.allHardPass} headline="${headline.slice(0, 70)}"`
      );
    } finally {
      await client.end();
    }
  }, 220_000);
});

// ============================================================================
// B) GROUNDED PATH — direct generateOutline + generateDeck with real sources.
// ============================================================================
describe('Acceptance O2.5: deck conclusion slide (grounded — real initiative/KPI sources)', () => {
  it('builds a grounded K1→K4 conclusion from initiative + KPI facts (numbers-from-engine holds)', async () => {
    const setup = {
      title: `${PREFIX}Grounded ${Date.now()}`,
      language: 'pl' as const,
      audience: 'executive' as const,
      goal: 'decide' as const,
      theme: 'corporate' as const,
      confidentiality: 'internal' as const,
      // Visuals OFF: keep the run fast + deterministic (no image provider calls).
      visuals: { enabled: false as const },
      sourceArtifacts: [
        {
          type: 'initiative_portfolio' as const,
          id: `${PREFIX}src-init`,
          label: 'Portfel inicjatyw',
          readiness: 'ready' as const,
        },
        {
          type: 'kpi_roi' as const,
          id: `${PREFIX}src-kpi`,
          label: 'KPI i ROI',
          readiness: 'ready' as const,
        },
      ],
    };

    const { outline, deckId } = await generatorService.generateOutline(setup, SEED.ORG_ID);
    expect(deckId).toBeTruthy();
    createdDeckIds.push(deckId);

    const genResult = await generatorService.generateDeck(deckId, outline, setup, SEED.ORG_ID);
    expect(Number(genResult.slideCount)).toBeGreaterThan(0);

    const client = pgClient();
    await client.connect();
    try {
      const { rows } = await client.query(
        `SELECT status, unified_json FROM presentation_decks WHERE id = $1`,
        [deckId]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('ready');

      const found = findConclusionSlide(rows[0].unified_json);
      expect(found, 'grounded deck must contain a K1→K4 conclusion slide').not.toBeNull();
      assertKStructure(found!.conclusion);

      // Grounded: numbers-from-engine hard-validator is part of allHardPass
      // (already asserted). With real initiative + KPI rows the conclusion is
      // NOT the empty-brief "insufficient" degenerate — confidence is graded.
      expect(['high', 'medium', 'low']).toContain(found!.conclusion.confidence);

      evidence(
        `[O25-B] GREEN deck=${deckId} conclusion.source=${found!.conclusion.source} confidence=${found!.conclusion.confidence} allHardPass=${found!.conclusion.validation.allHardPass} k3=${found!.conclusion.k3.length}`
      );
    } finally {
      await client.end();
    }
  }, 220_000);
});
