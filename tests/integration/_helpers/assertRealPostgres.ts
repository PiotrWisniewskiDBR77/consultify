/**
 * Wspólny strażnik środowiska testów bazodanowych.
 *
 * POWÓD ISTNIENIA — dwie realne pułapki, które dały fałszywą zieleń w Fazie 0:
 *
 *  1. `NODE_ENV=test` bez `RUN_DB_TESTS=1` / `MOCK_DB=false` powoduje CICHY
 *     MOCK bazy. Warmup „przechodził", a tabel nie było. Testy zieleniły się
 *     nie dotykając Postgresa.
 *  2. Testy z `describe.skip` przy braku `DATABASE_URL` wyglądają w raporcie
 *     jak sukces („0 failed"), choć nic nie sprawdziły.
 *
 * Dlatego: brak warunku = **FAIL**, nigdy SKIP i nigdy fallback do mocka.
 *
 * Strażnik dowodzi połączenia zapytaniami do serwera, nie odczytem zmiennych:
 * `SELECT version()`, `current_database()`, `current_schema()`.
 */
import { Client } from 'pg';

export interface RealPostgresProof {
  serverVersion: string;
  database: string;
  schema: string;
  host: string;
  port: string;
}

/** Nazwy baz, na których testy NIE MOGĄ być uruchamiane. */
const FORBIDDEN_DB_HOSTS = [
  'centerbeam.proxy.rlwy.net', // PROD
  'trolley.proxy.rlwy.net', // DEMO / staging
  'ballast.proxy.rlwy.net',
];

function fail(msg: string): never {
  throw new Error(
    `[assertRealPostgresTestEnvironment] ${msg}\n` +
      'Test bazodanowy MUSI padać, a nie być pomijany — pominięcie wygląda w raporcie jak sukces.'
  );
}

/**
 * Weryfikuje, że test biegnie przeciw REALNEMU, jednorazowemu PostgreSQL.
 *
 * @param opts.expectedDatabase nazwa bazy, której się spodziewamy (np. `consultinity`)
 * @returns dowody odczytane z serwera bazy
 */
export async function assertRealPostgresTestEnvironment(opts?: {
  expectedDatabase?: string;
  /** Dopuść host spoza listy zakazanych tylko, gdy jawnie wskazany. */
  allowHost?: string;
}): Promise<RealPostgresProof> {
  // --- 1. flagi, bez których warstwa DB cicho mockuje ---
  if (process.env.RUN_DB_TESTS !== '1') {
    fail('RUN_DB_TESTS != 1 — warstwa bazy zwróciłaby atrapę zamiast Postgresa.');
  }
  if (String(process.env.MOCK_DB).toLowerCase() !== 'false') {
    fail(`MOCK_DB=${process.env.MOCK_DB ?? '<brak>'} — wymagane jawne MOCK_DB=false.`);
  }

  const url = process.env.DATABASE_URL;
  if (!url) fail('brak DATABASE_URL.');

  // --- 2. ochrona przed uderzeniem w PROD/DEMO ---
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    fail('DATABASE_URL nie jest poprawnym URL-em.');
  }
  const host = parsed.hostname;
  if (FORBIDDEN_DB_HOSTS.includes(host) && opts?.allowHost !== host) {
    fail(`host ${host} to baza produkcyjna/demo — testy integracyjne są na niej ZABRONIONE.`);
  }

  // --- 3. dowód z serwera, nie ze zmiennych środowiskowych ---
  const client = new Client({ connectionString: url, ssl: false });
  try {
    await client.connect();
  } catch (e) {
    fail(`nie udało się połączyć z PostgreSQL (${host}:${parsed.port}): ${(e as Error).message}`);
  }

  try {
    const v = await client.query<{ version: string }>('SELECT version() AS version');
    const d = await client.query<{ db: string; schema: string }>(
      'SELECT current_database() AS db, current_schema() AS schema'
    );

    const serverVersion = String(v.rows[0]?.version ?? '');
    const database = String(d.rows[0]?.db ?? '');
    const schema = String(d.rows[0]?.schema ?? '');

    if (!/PostgreSQL/i.test(serverVersion)) {
      fail(`serwer nie przedstawia się jako PostgreSQL: "${serverVersion}".`);
    }
    if (!database) fail('current_database() zwróciło pustą wartość.');
    if (!schema) fail('current_schema() zwróciło pustą wartość.');

    if (opts?.expectedDatabase && database !== opts.expectedDatabase) {
      fail(`oczekiwano bazy "${opts.expectedDatabase}", a połączono z "${database}".`);
    }

    return { serverVersion, database, schema, host, port: parsed.port };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Asercja, że badana gałąź promocji REALNIE została osiągnięta.
 *
 * Odpowiedź blokująca (400/404/409/500) nie może zaliczyć testu idempotencji,
 * wyścigu ani trwałości — w Fazie 0 właśnie tak powstała fałszywa zieleń:
 * `confidence_avg` poniżej progu blokował promocję, a testy przechodziły puste.
 */
export function assertPromotionBranchReached(res: {
  status: number;
  body?: unknown;
}): void {
  if (res.status >= 300) {
    throw new Error(
      `[assertPromotionBranchReached] promocja NIE doszła do badanej gałęzi: ` +
        `status=${res.status}, body=${JSON.stringify(res.body ?? {}).slice(0, 300)}. ` +
        'Test idempotencji/wyścigu/persistence nie może zaliczyć się na odpowiedzi blokującej.'
    );
  }
}

/** Minimalna wartość `confidence_avg`, przy której promocja przechodzi bramkę. */
export const MIN_PROMOTION_CONFIDENCE = 3;
