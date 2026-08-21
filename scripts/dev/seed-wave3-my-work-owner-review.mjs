#!/usr/bin/env node
/**
 * Compatibility entrypoint. The former shared `cw-local` implementation is
 * retired because reset disabled append-only triggers. All commands now use
 * the owned disposable-database successor through the server TypeScript loader.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const result = spawnSync(
  fileURLToPath(new URL('../../node_modules/.bin/tsx', import.meta.url)),
  [fileURLToPath(new URL('./seed-wave3-my-work-owner-review-owned.mjs', import.meta.url)), ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
