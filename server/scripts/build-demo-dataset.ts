#!/usr/bin/env npx tsx
/**
 * Odbudowa zestawu danych demo (tenant Anna / ateliertoys-demo) na **aktualnie wybranym** Postgres.
 *
 * **Target bazy (z laptopa):** użyj `DATABASE_PUBLIC_URL` z `railway variable list --service consultify --environment production`
 * albo:
 *
 *   railway run --service consultify --environment production -- \
 *     env -u DATABASE_URL npx tsx server/scripts/build-demo-dataset.ts
 *
 * (`env -u DATABASE_URL` wymusza publiczny proxy zamiast `*.railway.internal`.)
 *
 * Kroki:
 *  1) `clone-dbr77-to-atelier.ts` — kopia org `dbr77` → `atelier` (opcjonalnie `CLONE_PURGE_TARGET=1`)
 *  2) `align-atelier-data-to-demo-org.ts` — `atelier` → `DEMO_ORG_ID` / `ateliertoys-demo`, personal tasks, decyzje Piotr→Anna
 *  3) `copy-showcase-my-ideas-to-anna.ts` — wybrane Ideas → Anna w **ateliertoys-demo**
 *
 * Użycie:
 *   npx tsx server/scripts/build-demo-dataset.ts              # dry-run (clone + align dry; ideas kończy się komunikatem)
 *   npx tsx server/scripts/build-demo-dataset.ts --write      # wykonanie
 *
 * Flagi:
 *   --skip-clone   — pomiń klon (np. gdy `atelier` jest już świeży)
 *   --skip-align   — pomiń wyrównanie org (tylko po ręcznym align)
 *   --skip-ideas   — pomiń kopiowanie Ideas
 *   --ideas-only   — to samo co --skip-clone --skip-align (tylko krok 3; bezpieczne na prod)
 *
 * Env (opcjonalnie):
 *   CLONE_PURGE_TARGET=1     — przed klonedem czyści wiersze org docelowego w skopiowanych tabelach
 *   CONFIRM_DEMO_REBUILD=1  — wymagane przy --write jeśli ustawione CLONE_PURGE_TARGET=1 (ochrona przed pomyłką)
 *
 * ⚠️  Bez CLONE_PURGE_TARGET=1 klon z --write dopisuje NOWE UUID (~tysiące duplikatów w `atelier`).
 *     Pełna odbudowa: CLONE_PURGE_TARGET=1 CONFIRM_DEMO_REBUILD=1 … --write
 *     Tylko Ideas na już wyrównanym tenancie: --ideas-only --write
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { logSelectedDatabaseTarget, resolveScriptDatabaseTarget } from './lib/scriptDatabaseTarget.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');

function run(label: string, cmd: string, env: NodeJS.ProcessEnv) {
  console.log(`\n========== ${label} ==========\n> ${cmd}\n`);
  execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', env });
}

async function main() {
  const write = process.argv.includes('--write');
  const ideasOnly = process.argv.includes('--ideas-only');
  const skipClone = process.argv.includes('--skip-clone') || ideasOnly;
  const skipAlign = process.argv.includes('--skip-align') || ideasOnly;
  const skipIdeas = process.argv.includes('--skip-ideas');
  const flag = write ? '--write' : '';

  const purge = String(process.env.CLONE_PURGE_TARGET || '').trim() === '1';
  if (write && purge && String(process.env.CONFIRM_DEMO_REBUILD || '').trim() !== '1') {
    console.error(
      'CLONE_PURGE_TARGET=1 wymaga CONFIRM_DEMO_REBUILD=1 przy --write (celowo, żeby nie wyczyścić demo przypadkiem).'
    );
    process.exit(1);
  }
  if (write && !skipClone && !purge) {
    console.error(
      'Przy --write krok „clone” wymaga CLONE_PURGE_TARGET=1 (żeby nie zdublować tysięcy wierszy w `atelier`).\n' +
        'Albo pomiń klon: --skip-clone albo tylko Ideas: --ideas-only --write'
    );
    process.exit(1);
  }

  const target = resolveScriptDatabaseTarget({
    label: 'build-demo-dataset',
    databaseUrl: process.env.DATABASE_URL,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  logSelectedDatabaseTarget('build-demo-dataset', target);

  const dbEnv = {
    ...process.env,
    DATABASE_URL: target.connectionString,
    DATABASE_PUBLIC_URL: target.connectionString,
  };

  if (!skipClone) {
    run('1/3 Clone dbr77 → atelier', `npx tsx server/scripts/clone-dbr77-to-atelier.ts ${flag}`.trim(), dbEnv);
  } else {
    console.log(`\n(Skip clone${ideasOnly ? ' --ideas-only' : ' --skip-clone'})\n`);
  }

  if (!skipAlign) {
    const alignEnv = {
      ...dbEnv,
      ALIGN_PERSONAL_TASKS: process.env.ALIGN_PERSONAL_TASKS ?? '1',
      ALIGN_REMAP_DECISIONS: process.env.ALIGN_REMAP_DECISIONS ?? '1',
    };
    run(
      '2/3 Align atelier → demo org',
      `npx tsx server/scripts/align-atelier-data-to-demo-org.ts ${flag}`.trim(),
      alignEnv
    );
  } else {
    console.log(`\n(Skip align${ideasOnly ? ' --ideas-only' : ' --skip-align'})\n`);
  }

  if (!skipIdeas) {
    const ideasEnv = {
      ...dbEnv,
      // Po align wszystko ma żyć na tenantcie demo, nie na slug `atelier`
      CLONE_TARGET_ORG_ID: process.env.DEMO_ORG_ID?.trim() || 'ateliertoys-demo',
    };
    run(
      '3/3 Copy showcase My Ideas → Anna',
      `npx tsx server/scripts/copy-showcase-my-ideas-to-anna.ts ${flag}`.trim(),
      ideasEnv
    );
  } else {
    console.log('\n(Skip ideas --skip-ideas)\n');
  }

  console.log(
    write
      ? '\n✅ build-demo-dataset: zapis zakończony.\n'
      : '\n✅ build-demo-dataset: dry-run zakończony (uruchom z --write aby zapisać).\n'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
