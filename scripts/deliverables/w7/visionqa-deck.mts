/**
 * W7 fill-canvas — deck-visual VisionQA scorer. Same rubric/plumbing as the
 * step1b scorer, but scores the W7 BEFORE (fill-canvas OFF) vs AFTER (ON) PNGs
 * to prove the dead-bottom is gone (balance/no_overflow/hierarchy up) with no
 * regression on slides that were already OK (slide0 cover, slide5).
 *
 * RUN (needs a vision-capable key):
 *   export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv \
 *     | grep -E '^ANTHROPIC_API_KEY=' | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/w7/visionqa-deck.mts
 *
 * Output JSON: docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/visionqa-results.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';

import { VTS_CARDS } from './fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas'
);
const pngDir = path.join(runDir, 'png');

const RUBRIC = `Jesteś krytykiem wizualnym slajdów prezentacji konsultingowej (poziom McKinsey/BCG).
Oceń JEDEN wyrenderowany slajd (16:9) w skali 0.0–1.0 na PIĘCIU wymiarach rubryki "deck-visual":
1. readability   — czytelność tekstu (rozmiar, kontrast, długość linii)
2. hierarchy     — hierarchia wizualna (czy wzrok wie gdzie patrzeć najpierw)
3. balance       — balans/kompozycja (rozkład treści na płótnie, wykorzystanie przestrzeni, brak dużych pustek / MARTWEGO DOŁU)
4. no_overflow   — brak przepełnień/ucięć (treść mieści się, nic nie wychodzi poza ramkę)
5. layout_fit    — dopasowanie układu do treści (czy struktura pasuje do typu slajdu: KPI→siatka, porównanie→kolumny itd.)

Zwróć WYŁĄCZNIE JSON:
{
  "scores": { "readability": 0.0, "hierarchy": 0.0, "balance": 0.0, "no_overflow": 0.0, "layout_fit": 0.0 },
  "overall": 0.0,
  "issues": ["krótki opis problemu"]
}`;

interface SlideScore {
  slide: number;
  intent: string;
  title: string;
  variant?: string;
  scores: Record<string, number>;
  overall: number;
  issues: string[];
}

function pngToBase64(file: string): { data: string; media: 'image/png' } {
  return { data: readFileSync(file).toString('base64'), media: 'image/png' };
}

async function scoreSlide(
  client: Anthropic,
  file: string,
  ctx: { intent: string; title: string }
): Promise<{ scores: Record<string, number>; overall: number; issues: string[] }> {
  const img = pngToBase64(file);
  const resp = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RUBRIC },
          { type: 'image', source: { type: 'base64', media_type: img.media, data: img.data } },
          {
            type: 'text',
            text: `Kontekst slajdu — intent: ${ctx.intent}; tytuł: "${ctx.title}". Oceń tylko to co widać.`,
          },
        ],
      },
    ],
  });
  const text = resp.content[0]?.type === 'text' ? resp.content[0].text : '{}';
  const jsonStr = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(jsonStr);
  return { scores: parsed.scores || {}, overall: parsed.overall ?? 0.5, issues: parsed.issues || [] };
}

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY not set.');
    process.exit(2);
  }
  const client = new Anthropic();
  const before: SlideScore[] = [];
  const after: SlideScore[] = [];

  for (let i = 0; i < VTS_CARDS.length; i++) {
    const card = VTS_CARDS[i];
    for (const mode of ['before', 'after'] as const) {
      const file = path.join(pngDir, `slide${i}_${mode}.png`);
      if (!existsSync(file)) {
        console.error(`MISSING PNG: ${file} — run render-slides.mts first.`);
        process.exit(3);
      }
      const r = await scoreSlide(client, file, { intent: card.intent, title: card.title });
      const rec: SlideScore = {
        slide: i,
        intent: card.intent,
        title: card.title,
        variant: card.composition?.layoutVariantId,
        ...r,
      };
      (mode === 'before' ? before : after).push(rec);
      console.log(
        `slide ${i} ${mode.padEnd(6)} overall=${r.overall.toFixed(2)}  [${Object.entries(r.scores)
          .map(([k, v]) => `${k}=${Number(v).toFixed(2)}`)
          .join(' ')}]`
      );
    }
  }

  const avg = (arr: SlideScore[]) => arr.reduce((s, x) => s + x.overall, 0) / (arr.length || 1);
  const avgBefore = avg(before);
  const avgAfter = avg(after);
  const perDim = (arr: SlideScore[], dim: string) =>
    arr.reduce((s, x) => s + (x.scores[dim] ?? 0), 0) / (arr.length || 1);
  const dims = ['readability', 'hierarchy', 'balance', 'no_overflow', 'layout_fit'];

  console.log('\n=== W7 deck-visual VisionQA — BEFORE (fill OFF) vs AFTER (fill ON) ===');
  console.log(
    `  overall  BEFORE=${avgBefore.toFixed(3)}  AFTER=${avgAfter.toFixed(3)}  Δ=${(avgAfter - avgBefore >= 0 ? '+' : '') + (avgAfter - avgBefore).toFixed(3)}`
  );
  for (const d of dims) {
    const b = perDim(before, d);
    const a = perDim(after, d);
    console.log(
      `  ${d.padEnd(12)} BEFORE=${b.toFixed(3)}  AFTER=${a.toFixed(3)}  Δ=${(a - b >= 0 ? '+' : '') + (a - b).toFixed(3)}`
    );
  }

  console.log('\n  per-slide overall (regression watch):');
  for (let i = 0; i < before.length; i++) {
    const d = after[i].overall - before[i].overall;
    console.log(
      `    slide ${i} (${before[i].variant}) before=${before[i].overall.toFixed(2)} after=${after[i].overall.toFixed(2)} Δ=${(d >= 0 ? '+' : '') + d.toFixed(2)}`
    );
  }

  const out = {
    generatedAt: new Date().toISOString(),
    model: 'claude-sonnet-4-6',
    topic: 'VTS Group — diagnoza transformacji cyfrowej (W7 fill-canvas + guard-split)',
    axis: 'BEFORE = W7 fill-canvas OFF (top-glued, dead bottom); AFTER = W7 ON (vertical rhythm + guard-split). Composition present in both.',
    summary: {
      overall: { before: avgBefore, after: avgAfter, delta: avgAfter - avgBefore },
      perDimension: dims.map((d) => ({
        dimension: d,
        before: perDim(before, d),
        after: perDim(after, d),
        delta: perDim(after, d) - perDim(before, d),
      })),
      perSlide: before.map((b, i) => ({
        slide: i,
        variant: b.variant,
        before: b.overall,
        after: after[i].overall,
        delta: after[i].overall - b.overall,
      })),
    },
    before,
    after,
  };
  const outFile = path.join(runDir, 'visionqa-results.json');
  writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`\nwrote ${outFile}`);
  process.exit(0);
})().catch((err) => {
  console.error('[w7-visionqa] FAILED:', err);
  process.exit(1);
});
