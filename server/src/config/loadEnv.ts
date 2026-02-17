/**
 * loadEnv
 *
 * IMPORTANT (ESM): static imports are evaluated before module body in entrypoints.
 * To guarantee env is populated before other config modules run, we load dotenv
 * in a dedicated module and import it FIRST from `src/index.ts` (and also from
 * config modules defensively).
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProductionEnv = process.env.NODE_ENV === 'production';
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;

const repoRootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');

// Prefer repo-root `.env` (workspace-level config), fallback to `server/.env` for legacy setups.
const envPathToUse = fs.existsSync(repoRootEnvPath) ? repoRootEnvPath : serverEnvPath;

// By default, do NOT override env vars already set by the shell / npm scripts.
// This is critical for local dev where scripts explicitly set DB_TYPE/SQLITE_PATH.
// If you really want `.env` to force-override exported variables, set DOTENV_OVERRIDE=1.
const shouldOverrideDotenv =
  !isProductionEnv &&
  !isTestEnv &&
  (process.env.DOTENV_OVERRIDE === '1' || process.env.DOTENV_OVERRIDE === 'true');

dotenv.config({
  path: envPathToUse,
  override: shouldOverrideDotenv,
});

// Dev-only visibility: confirm which .env was loaded (helps debug "keys pasted but not used").
if (!isProductionEnv) {
  // eslint-disable-next-line no-console
  console.log('[Env] Loaded from:', envPathToUse);
  // eslint-disable-next-line no-console
  console.log('[Env] JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);
  // eslint-disable-next-line no-console
  console.log('[Env] OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);
  // eslint-disable-next-line no-console
  console.log(
    '[Env] GEMINI_API_KEY/GOOGLE_AI_API_KEY set:',
    !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_AI_API_KEY
  );
}

