#!/usr/bin/env tsx
/**
 * D-19 v2 (Wpis 69, wariant (c)) — KROK KOŃCOWY seeda pokazowego demo-en:
 * po zasianiu organizacji `northwind` wyrównuje kanoniczny agregat
 * `ie_aggregate_state.payload_json.lifecycleState` do kolumny
 * `initiatives.status` przez TEN SAM planner co `align-initiative-aggregate-state.ts`
 * (import funkcji, NIE `child_process`).
 *
 * Dlaczego tu: seed pisze `initiatives.status` bezpośrednio (wyjątek „USPOJNIENIE
 * A3"), więc agregat zostaje w `REGISTERED_DRAFT` i po migracji STAGE-1 (20262260)
 * rejestr pokazywałby inicjatywy w realizacji jako „Draft registered". Krok 98
 * domyka tę rozbieżność zaraz po zasianiu, zanim cokolwiek przeczyta agregat.
 *
 * Idempotentność: `processOrg` aktualizuje tylko wiersze, których stage naprawdę
 * się różni (`IS DISTINCT FROM`), więc powtórny przebieg daje aligned=0.
 * Bezpieczeństwo: allow-lista org pokazowych obowiązuje jak w skrypcie macierzystym
 * (northwind jest na liście); tryb domyślny brak — jawne --dry-run / --apply.
 * Nie dotyka `initiativeTransitionService.ts` ani domeny.
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/98-align.ts --apply --oczekiwany-host 127.0.0.1
 */
import pg from 'pg';

import { processOrg } from '../../../src/services/initiatives/alignInitiativeAggregateService';

import { ORG_ID, ORG_NAZWA, czytajWspolneArgumenty, sprawdzCel, wymaganyUrl } from './00-wspolne';

export type AlignKrokWynik = { aligned: number; already: number; skipped: number; wrote: number };

/** Jedna org (ta, którą seed właśnie zasiał) — wywołuje planner/apply z macierzystego skryptu. */
export async function uruchomAlignKrok(
  client: pg.Client,
  orgId: string,
  apply: boolean
): Promise<AlignKrokWynik> {
  const { counts, wrote, name } = await processOrg(client, orgId, apply);
  const aligned = counts.align;
  const already = counts['skip-aligned'];
  const skipped = counts['skip-short-circuit'] + counts['skip-no-stage'];
  console.log(
    `[98-align] org=${orgId} (${name ?? ORG_NAZWA}) mode=${apply ? 'APPLY' : 'DRY-RUN'} :: ` +
      `aligned=${aligned}, already=${already}, skipped=${skipped}` +
      (apply ? `, wrote=${wrote}` : '')
  );
  return { aligned, already, skipped, wrote };
}

async function main(): Promise<void> {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  if (opcje.tryb !== 'apply' && opcje.tryb !== 'dry-run') {
    throw new Error('98-align.ts obsługuje wyłącznie --apply albo --dry-run.');
  }
  const apply = opcje.tryb === 'apply';

  const url = wymaganyUrl();
  const cel = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const client = new pg.Client({ connectionString: url, ssl: false });
  await client.connect();

  try {
    console.log(`[98-align] cel: ${cel}`);
    await uruchomAlignKrok(client, ORG_ID, apply);
  } finally {
    await client.end();
  }
}

const wywolanyBezposrednio = String(process.argv[1] || '')
  .replace(/\\/g, '/')
  .endsWith('98-align.ts');
if (wywolanyBezposrednio) {
  main().catch((error) => {
    console.error(`[98-align] BŁĄD: ${(error as Error)?.message || error}`);
    process.exit(1);
  });
}
