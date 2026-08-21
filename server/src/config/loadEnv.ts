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

import logger from '../utils/Logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProductionEnv = process.env.NODE_ENV === 'production';
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
const shouldIgnoreLocalEnv =
  process.env.DOTENV_IGNORE_LOCAL === '1' || process.env.DOTENV_IGNORE_LOCAL === 'true';
const dotenvDisabled =
  process.env.DOTENV_DISABLED === '1' || process.env.DOTENV_DISABLED === 'true';

const repoRootEnvPath = path.resolve(__dirname, '../../../.env');
const repoRootEnvLocalPath = path.resolve(__dirname, '../../../.env.local');
const serverEnvPath = path.resolve(__dirname, '../../.env');
const serverEnvLocalPath = path.resolve(__dirname, '../../.env.local');
const repoRootDir = path.resolve(__dirname, '../../../');
const extraEnvPathRaw = process.env.ENV_FILE || process.env.DOTENV_PATH || null;
const extraEnvPath = (() => {
  if (!extraEnvPathRaw) return null;
  const raw = String(extraEnvPathRaw);
  // Resolve relative to repo root first (more ergonomic when server is started from /server),
  // fallback to process.cwd().
  const fromRepoRoot = path.resolve(repoRootDir, raw);
  if (fs.existsSync(fromRepoRoot)) return fromRepoRoot;
  return path.resolve(process.cwd(), raw);
})();

// Prefer repo-root `.env` (workspace-level config), fallback to `server/.env` for legacy setups.
const baseEnvPath = fs.existsSync(repoRootEnvPath) ? repoRootEnvPath : serverEnvPath;
// Prefer repo-root `.env.local`, fallback to `server/.env.local` for legacy setups.
const localEnvPath = shouldIgnoreLocalEnv
  ? null
  : fs.existsSync(repoRootEnvLocalPath)
    ? repoRootEnvLocalPath
    : fs.existsSync(serverEnvLocalPath)
      ? serverEnvLocalPath
      : null;

// By default, do NOT override env vars already set by the shell / npm scripts.
// This is critical for local dev where scripts explicitly set DB_TYPE/DATABASE_URL.
// If you really want `.env` to force-override exported variables, set DOTENV_OVERRIDE=1.
const shouldOverrideDotenv =
  !isProductionEnv &&
  !isTestEnv &&
  (process.env.DOTENV_OVERRIDE === '1' || process.env.DOTENV_OVERRIDE === 'true');

type ParsedEnv = Record<string, string>;

const parseEnvFile = (filePath: string): ParsedEnv => {
  const raw = fs.readFileSync(filePath);
  return dotenv.parse(raw);
};

const applyEnv = (parsed: ParsedEnv, opts: { override: boolean }) => {
  for (const [key, value] of Object.entries(parsed)) {
    if (opts.override || typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
};

// Layered loading:
// - Load base (.env) without overriding shell env (default)
// - Then load local (.env.local) and allow it to override values that came from base,
//   while still not overriding shell-provided env unless DOTENV_OVERRIDE=1.
const loadedPaths: string[] = [];
let baseParsed: ParsedEnv = {};
let localParsed: ParsedEnv = {};

if (!dotenvDisabled && fs.existsSync(baseEnvPath)) {
  baseParsed = parseEnvFile(baseEnvPath);
  applyEnv(baseParsed, { override: shouldOverrideDotenv });
  loadedPaths.push(baseEnvPath);
}

if (!dotenvDisabled && localEnvPath && fs.existsSync(localEnvPath)) {
  localParsed = parseEnvFile(localEnvPath);
  for (const [key, value] of Object.entries(localParsed)) {
    const current = process.env[key];
    const cameFromBase = typeof baseParsed[key] !== 'undefined' && current === baseParsed[key];
    const canOverride = shouldOverrideDotenv || typeof current === 'undefined' || cameFromBase;
    if (canOverride) {
      process.env[key] = value;
    }
  }
  loadedPaths.push(localEnvPath);
}

// Optional extra env file, e.g. `.env.staging.local` for connecting to staging DB from local dev.
// Highest priority, but still respects shell-provided env unless DOTENV_OVERRIDE=1.
if (!dotenvDisabled && extraEnvPath && fs.existsSync(extraEnvPath)) {
  const extraParsed = parseEnvFile(extraEnvPath);
  for (const [key, value] of Object.entries(extraParsed)) {
    const current = process.env[key];
    const cameFromBase = typeof baseParsed[key] !== 'undefined' && current === baseParsed[key];
    const cameFromLocal = typeof localParsed[key] !== 'undefined' && current === localParsed[key];
    const canOverride =
      shouldOverrideDotenv || typeof current === 'undefined' || cameFromBase || cameFromLocal;
    if (canOverride) {
      process.env[key] = value;
    }
  }
  loadedPaths.push(extraEnvPath);
}

// Dev-only visibility: confirm which env files were loaded (helps debug "keys pasted but not used").
if (!isProductionEnv) {
  logger.info('[Env] Loaded from:', loadedPaths.join(' + ') || '(none)');

  logger.info('[Env] JWT_SECRET length:', process.env.JWT_SECRET?.length || 0);

  logger.info('[Env] OPENAI_API_KEY set:', !!process.env.OPENAI_API_KEY);

  logger.info('[Env] OPENROUTER_API_KEY set:', !!process.env.OPENROUTER_API_KEY);

  logger.info(
    '[Env] GEMINI_API_KEY/GOOGLE_AI_API_KEY set:',
    !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_AI_API_KEY
  );
}
