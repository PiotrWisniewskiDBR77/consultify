/**
 * _diag-ai-images — LIVE verification of AI IMAGE GENERATION for the deck path.
 *
 * Proves the three rungs of the new deck image pipeline (deckVisualsService):
 *   (a) generateWithGemini  — Google "nano-banana" (gemini-2.5-flash-image)
 *   (b) generateWithReplicate — efficient Chinese model (qwen/qwen-image)
 *   (c) resolveDefaultImageProvider — env-default chooser picks gemini by default
 *
 * Writes proof bytes to /tmp/nano-banana.png and /tmp/qwen.png and reports
 * sizes + any provider that failed (incl. the working Replicate slug).
 *
 * RUN (keys from Railway staging — NO new keys needed):
 *   export GEMINI_API_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^GEMINI_API_KEY=' | sed 's/^GEMINI_API_KEY=//' | tr -d ' "')
 *   export REPLICATE_API_TOKEN=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^REPLICATE_API_TOKEN=' | sed 's/^REPLICATE_API_TOKEN=//' | tr -d ' "')
 *   export UNSPLASH_ACCESS_KEY=$(railway variables --environment staging --service consultify --kv 2>/dev/null | grep -E '^UNSPLASH_ACCESS_KEY=' | sed 's/^UNSPLASH_ACCESS_KEY=//' | tr -d ' "')
 *   node --import tsx scripts/deliverables/_diag-ai-images.mts
 */
// ── SAFETY ISOLATION (must run BEFORE any server import) ────────────────────
// PROD-safe + DB-free: this probe touches only HTTP image APIs.
process.env.DOTENV_IGNORE_LOCAL = '1';
process.env.SKIP_DB_INIT = '1';

import { writeFileSync } from 'node:fs';

const {
  generateWithGemini,
  generateWithReplicate,
  resolveDefaultImageProvider,
} = await import('../../server/src/services/ai/deckVisualsService.js');

const PROMPT =
  'modern industrial HVAC factory at dusk, blue tones, no text, no people';

function sniff(buf: Buffer): string {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'PNG';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'JPEG';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'WEBP';
  return 'UNKNOWN';
}

const results: Record<string, string> = {};

// ── (a) Gemini / nano-banana ────────────────────────────────────────────────
console.log('\n=== (a) generateWithGemini (nano-banana / gemini-2.5-flash-image) ===');
if (!process.env.GEMINI_API_KEY) {
  results.gemini = 'SKIPPED — GEMINI_API_KEY not set';
  console.log('  SKIP: GEMINI_API_KEY missing');
} else {
  try {
    const t0 = Date.now();
    const buf = await generateWithGemini({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'gemini-2.5-flash-image',
      prompt: PROMPT,
    });
    const fmt = sniff(buf);
    const ok = buf.length > 5 * 1024 && (fmt === 'PNG' || fmt === 'JPEG' || fmt === 'WEBP');
    writeFileSync('/tmp/nano-banana.png', buf);
    results.gemini = `${ok ? 'PASS' : 'WEAK'} — ${buf.length} bytes ${fmt}, ${Date.now() - t0}ms → /tmp/nano-banana.png`;
    console.log('  ' + results.gemini);
  } catch (err: any) {
    results.gemini = `FAIL — ${err?.message || err}`;
    console.log('  ' + results.gemini);
  }
}

// ── (b) Replicate / Qwen ──────────────────────────────────────────────────────
console.log('\n=== (b) generateWithReplicate (qwen/qwen-image) ===');
if (!process.env.REPLICATE_API_TOKEN && !process.env.REPLICATE_API_KEY) {
  results.replicate = 'SKIPPED — REPLICATE_API_TOKEN not set';
  console.log('  SKIP: REPLICATE_API_TOKEN missing');
} else {
  const token = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || '';
  // Try qwen/qwen-image first; fall back to flux-schnell as a Replicate-path sanity check.
  const candidates = ['qwen/qwen-image', 'black-forest-labs/flux-schnell'];
  let done = false;
  for (const slug of candidates) {
    try {
      console.log(`  trying slug: ${slug} ...`);
      const t0 = Date.now();
      const buf = await generateWithReplicate({
        apiToken: token,
        model: slug,
        prompt: PROMPT,
        timeoutMs: 180_000,
      });
      const fmt = sniff(buf);
      const ok = buf.length > 5 * 1024 && (fmt === 'PNG' || fmt === 'JPEG' || fmt === 'WEBP');
      writeFileSync('/tmp/qwen.png', buf);
      results.replicate = `${ok ? 'PASS' : 'WEAK'} — slug=${slug}, ${buf.length} bytes ${fmt}, ${Date.now() - t0}ms → /tmp/qwen.png`;
      console.log('  ' + results.replicate);
      done = true;
      break;
    } catch (err: any) {
      console.log(`  slug ${slug} FAILED: ${(err?.message || err).toString().slice(0, 200)}`);
    }
  }
  if (!done) results.replicate = 'FAIL — all Replicate slugs errored (see logs above)';
}

// ── (c) env-default chooser ───────────────────────────────────────────────────
console.log('\n=== (c) resolveDefaultImageProvider() default ===');
{
  const prev = process.env.DELIVERABLE_IMAGE_PROVIDER;
  delete process.env.DELIVERABLE_IMAGE_PROVIDER; // exercise the DEFAULT
  const sel = resolveDefaultImageProvider();
  if (prev !== undefined) process.env.DELIVERABLE_IMAGE_PROVIDER = prev;

  if (!sel) {
    results.chooser =
      process.env.GEMINI_API_KEY
        ? 'FAIL — default chooser returned null despite GEMINI_API_KEY present'
        : 'INFO — chooser null (GEMINI_API_KEY not set; default IS gemini but no key)';
  } else {
    const picked = String(sel.provider?.provider || '').toLowerCase();
    results.chooser =
      picked === 'gemini'
        ? `PASS — default picks gemini (model=${sel.modelId})`
        : `FAIL — default picked "${picked}" (expected gemini)`;
  }
  console.log('  ' + results.chooser);
}

// ── SUMMARY ───────────────────────────────────────────────────────────────────
console.log('\n========== SUMMARY ==========');
for (const [k, v] of Object.entries(results)) console.log(`  ${k.padEnd(10)}: ${v}`);
console.log('=============================\n');

const anyFail = Object.values(results).some((v) => v.startsWith('FAIL'));
process.exit(anyFail ? 1 : 0);
