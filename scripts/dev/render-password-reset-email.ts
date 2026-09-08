/**
 * One-off render: dumps the real password reset email HTML (PL + EN) to disk
 * for the visual evidence screenshot (dev-render harness pattern per
 * CLAUDE.md §7 — nobody sees a raw/unrendered screen first).
 *
 * Imports the exact same `buildPasswordResetEmail` used by
 * server/src/routes/auth.routes.ts — this is the real output, not a
 * hand-written mockup.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { buildPasswordResetEmail } from '../../server/src/routes/auth.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../../evidence/email-reset');
fs.mkdirSync(outDir, { recursive: true });

const resetLink = 'https://demo.consultify.ai/reset-password?token=6f9c2e1a7b3d4c5e8f0a1b2c3d4e5f60';

const pl = buildPasswordResetEmail({
  lang: 'pl',
  firstName: 'Piotr',
  resetLink,
  ttlMinutes: 60,
});

const en = buildPasswordResetEmail({
  lang: 'en',
  firstName: 'Jane',
  resetLink,
  ttlMinutes: 60,
});

fs.writeFileSync(path.join(outDir, 'reset-pl.html'), pl.html, 'utf8');
fs.writeFileSync(path.join(outDir, 'reset-en.html'), en.html, 'utf8');
fs.writeFileSync(path.join(outDir, 'reset-pl.txt'), pl.text, 'utf8');
fs.writeFileSync(path.join(outDir, 'reset-en.txt'), en.text, 'utf8');

console.log('Wrote', outDir);
