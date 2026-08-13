/**
 * Evidence-only Tailwind config wrapper (G1, 2026-08-12).
 *
 * Why this exists: the project's REAL tailwind.config.js only scans src/**,
 * dev-render/**, views/**, components/**, App.tsx, index.html (its own
 * `content` globs) — it does NOT scan this evidence directory. That is fine
 * for the "after" (fixed) classes, because they now live in the real
 * component source and get compiled normally. It silently breaks the
 * "before" (original, pre-fix) classes once the fix has ALREADY landed in
 * BottomNavigation.tsx: compound-variant utilities that existed ONLY in the
 * original line — `active:text-primary-600`, `dark:active:text-primary-400`
 * — no longer appear ANYWHERE in the scanned source tree, so Tailwind's JIT
 * never generates their CSS rules, and a fixture requesting them silently
 * falls back to whatever cascades from elsewhere (looks like a PASS, isn't
 * real — this was caught live: see debug-active.cjs / README "one bug found
 * building this rig").
 *
 * Fix: wrap the real config, keep every token/theme/plugin identical (no
 * hand-copied values — same failure class this whole evidence pattern exists
 * to avoid, see f2-bottomnav-contrast-2026-08-12/README.md), and widen ONLY
 * `content` to also scan this directory's fixture.html. fixture.html statically
 * contains BOTH the before and after class strings side by side, so both
 * compile every time, regardless of the real component's current state.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import base from '../../../../../tailwind.config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  ...base,
  content: [...base.content, path.join(__dirname, 'fixture.html')],
};
