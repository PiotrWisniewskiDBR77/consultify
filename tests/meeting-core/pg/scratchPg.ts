/**
 * scratchPg.ts — jednorazowy, izolowany PostgreSQL w kontenerze Docker dla
 * testów Meeting Core.
 *
 * WHY THIS EXISTS
 * ----------------
 * Ten repo miał już incydent, w którym `NODE_ENV=test` bez `RUN_DB_TESTS=1`
 * dawał CICHY MOCK bazy — skrypt "przechodził", zapisując zero wierszy
 * (patrz MEMORY: fin005-finance-atelier-2026-08-01, kanal-mailowy /
 * demo-entry-email-normalizacja). Ten moduł ma dokładnie odwrotną politykę:
 *
 *   1. Nigdy nie łączy się z niczym poza świeżo postawionym, lokalnym
 *      kontenerem Docker (assertScratchDatabaseUrl — patrz niżej).
 *   2. Jeśli Docker nie działa albo kontenera nie da się postawić / nie
 *      staje się gotowy w rozsądnym czasie — RZUCA BŁĄD. Nigdy nie zwraca
 *      cicho "no to pomiń testy" ani nie udaje sukcesu.
 *   3. Sam sprząta po sobie (unikalna nazwa kontenera, --rm, jawne
 *      usunięcie w teardownie). Nie dotyka żadnych innych kontenerów na
 *      maszynie (na hoście deweloperskim mogą działać dziesiątki innych
 *      kontenerów Postgres z innych projektów — scratchPg ich nie rusza).
 */

import { randomUUID } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { Client } from 'pg';

const execFileAsync = promisify(execFile);

const DOCKER_BIN = process.env.SCRATCH_PG_DOCKER_BIN || 'docker';
const POSTGRES_IMAGE = process.env.SCRATCH_PG_IMAGE || 'postgres:16-alpine';

// Hosty, na które WOLNO celować scratch-bazie testowej.
const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

// Port bazy hosta / domyślny port Postgresa — to NIE jest nasza baza,
// nawet jeśli host jest localhost. Harness ma zawsze używać własnego,
// wysokiego portu (Docker przydzieli efemeryczny port >32768, patrz
// startScratchPg poniżej).
const FORBIDDEN_LOCAL_PORTS = new Set([5432]);

// Wzorce hostów/URL-i, które jednoznacznie wskazują na bazę zdalną,
// zarządzaną albo produkcyjną/demo. Dopasowywane do CAŁEGO URL-a (nie tylko
// hosta), żeby złapać też przypadki typu subdomena/ścieżka/nazwa bazy.
const FORBIDDEN_URL_PATTERNS: RegExp[] = [
  /railway/i,
  /rlwy\.net/i,
  /proxy\.rlwy/i,
  /amazonaws/i,
  /supabase/i,
  /neon\.tech/i,
  /neon\.build/i,
  /render\.com/i,
  /centerbeam/i,
  /trolley/i,
  /demo/i,
  /prod/i,
];

/**
 * Strażnik URL-a bazy scratch. Testowalny w izolacji (bez Dockera).
 *
 * Rzuca Error z czytelnym komunikatem, jeśli `url`:
 *  - nie jest poprawnym URL-em postgres(ql)://,
 *  - wskazuje na host inny niż localhost/127.0.0.1,
 *  - wskazuje na port 5432 na localhoście (to baza HOSTA, nie scratch),
 *  - zawiera którykolwiek z FORBIDDEN_URL_PATTERNS (railway, rlwy.net,
 *    proxy.rlwy, amazonaws, supabase, neon, render.com, centerbeam,
 *    trolley, demo, prod).
 *
 * Nie rzuca (przechodzi) tylko dla URL-i postgres(ql)://.../... na
 * localhost/127.0.0.1, na porcie różnym od 5432.
 */
export function assertScratchDatabaseUrl(url: string): void {
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error('[scratchPg] ODMOWA: pusty lub brakujący URL bazy.');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[scratchPg] ODMOWA: URL bazy jest nieparsowalny: "${url}"`);
  }

  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error(
      `[scratchPg] ODMOWA: nieobsługiwany protokół "${parsed.protocol}" — oczekiwano postgres:// lub postgresql://.`
    );
  }

  // Dopasuj wzorce zabronionych hostów/bazy do CAŁEGO URL-a (host + path +
  // ewentualne query) — celowo szeroko, żeby złapać też np.
  // "...proxy.rlwy.net..." czy "/consultify_demo" jako nazwę bazy.
  for (const pattern of FORBIDDEN_URL_PATTERNS) {
    if (pattern.test(url)) {
      throw new Error(
        `[scratchPg] ODMOWA: URL bazy pasuje do zabronionego wzorca ${pattern} — wygląda na bazę zdalną/zarządzaną/produkcyjną/demo. URL: "${url}"`
      );
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    throw new Error(
      `[scratchPg] ODMOWA: host "${hostname}" nie jest localhost/127.0.0.1. Scratch-baza testowa MUSI być lokalna. URL: "${url}"`
    );
  }

  // Brak portu w URL-u = domyślny port Postgresa (5432) — traktuj tak samo
  // jak jawne :5432.
  const port = parsed.port === '' ? 5432 : Number(parsed.port);
  if (ALLOWED_HOSTNAMES.has(hostname) && FORBIDDEN_LOCAL_PORTS.has(port)) {
    throw new Error(
      `[scratchPg] ODMOWA: port ${port} na ${hostname} to port bazy HOSTA (np. deweloperski Postgres na 127.0.0.1:5432), nie scratch-baza testowa. ` +
        `Harness musi używać własnego, wysokiego portu przydzielonego przez Docker. URL: "${url}"`
    );
  }
}

export interface ScratchPg {
  /** connection string do scratch-bazy, gotowy do przekazania do `pg` */
  url: string;
  /** nazwa kontenera Docker (unikalna per uruchomienie) */
  containerName: string;
  /** wysoki, efemeryczny port hosta przydzielony przez Dockera */
  port: number;
  /** zatrzymuje i usuwa kontener; bezpieczne do wywołania wielokrotnie */
  stop: () => Promise<void>;
}

interface StartScratchPgOptions {
  /** limit czasu oczekiwania na gotowość bazy (ms), domyślnie 45s */
  readyTimeoutMs?: number;
  /** interwał odpytywania gotowości (ms), domyślnie 300ms */
  pollIntervalMs?: number;
}

function assertDockerAvailable(): void {
  try {
    execFileSync(DOCKER_BIN, ['info'], { stdio: 'pipe' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[scratchPg] Docker nie jest dostępny albo demon Dockera nie działa. ` +
        `Testy PG w tests/meeting-core wymagają realnego kontenera Postgres — ` +
        `NIE MOGĄ być cicho pominięte. Uruchom/zainstaluj Docker i spróbuj ponownie.\n` +
        `Szczegóły: ${detail}`
    );
  }
}

/**
 * Stawia jednorazowy kontener Postgres 16 na wysokim, przydzielonym przez
 * Dockera porcie hosta (`-p 127.0.0.1::5432` — Docker sam wybiera wolny,
 * efemeryczny port, typowo >32768; to spełnia wymóg "wysoki, nietypowy port"
 * i eliminuje kolizje z innymi kontenerami/usługami na maszynie developerskiej
 * bez własnej logiki skanowania portów).
 *
 * Czeka aktywnym pollingiem (nie `sleep`) aż baza faktycznie przyjmuje
 * połączenia i odpowiada na `SELECT 1`. Jeśli się nie doczeka w
 * `readyTimeoutMs` — sprząta kontener i RZUCA błąd (nie zwraca cichej
 * porażki).
 */
export async function startScratchPg(opts: StartScratchPgOptions = {}): Promise<ScratchPg> {
  const readyTimeoutMs = opts.readyTimeoutMs ?? 45_000;
  const pollIntervalMs = opts.pollIntervalMs ?? 300;

  assertDockerAvailable();

  const containerName = `consultify-scratch-pg-${randomUUID().slice(0, 8)}`;
  const dbUser = 'scratch';
  const dbPassword = 'scratch';
  const dbName = 'scratch';

  try {
    await execFileAsync(DOCKER_BIN, [
      'run',
      '-d',
      '--rm',
      '--name',
      containerName,
      '-e',
      `POSTGRES_USER=${dbUser}`,
      '-e',
      `POSTGRES_PASSWORD=${dbPassword}`,
      '-e',
      `POSTGRES_DB=${dbName}`,
      // Bind only to loopback, on a Docker-assigned ephemeral host port.
      '-p',
      '127.0.0.1::5432',
      POSTGRES_IMAGE,
    ]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[scratchPg] Nie udało się postawić kontenera "${containerName}" (obraz ${POSTGRES_IMAGE}). ` +
        `To NIE jest sytuacja do cichego pominięcia testów — traktuj jako twardy błąd środowiska.\n` +
        `Szczegóły: ${detail}`
    );
  }

  let port: number;
  try {
    port = await resolveMappedPort(containerName);
  } catch (err) {
    await removeContainer(containerName);
    throw err;
  }

  const url = `postgres://${dbUser}:${dbPassword}@127.0.0.1:${port}/${dbName}`;

  // Samokontrola strażnikiem — jeśli kiedykolwiek zbudujemy URL, który by go
  // nie przeszedł, to jest błąd w TYM pliku, nie w testach. Wolimy rzucić
  // głośno tu, niż pozwolić testom połączyć się z czymkolwiek niezweryfikowanym.
  assertScratchDatabaseUrl(url);

  try {
    await waitUntilReady(url, readyTimeoutMs, pollIntervalMs);
  } catch (err) {
    await removeContainer(containerName);
    throw err;
  }

  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    await removeContainer(containerName);
  };

  return { url, containerName, port, stop };
}

async function resolveMappedPort(containerName: string): Promise<number> {
  let stdout: string;
  try {
    const result = await execFileAsync(DOCKER_BIN, ['port', containerName, '5432/tcp']);
    stdout = result.stdout;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[scratchPg] Nie udało się odczytać zmapowanego portu kontenera "${containerName}". Szczegóły: ${detail}`
    );
  }
  // `docker port` zwraca linie w stylu "0.0.0.0:55987" i/lub "[::]:55987".
  // Bierzemy pierwszą linię z liczbą po dwukropku.
  const match = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /:\d+$/.test(line));
  if (!match) {
    throw new Error(
      `[scratchPg] Nie rozpoznano numeru portu w wyjściu "docker port ${containerName} 5432/tcp": "${stdout}"`
    );
  }
  const portStr = match.slice(match.lastIndexOf(':') + 1);
  const port = Number(portStr);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`[scratchPg] Nieprawidłowy numer portu odczytany z Dockera: "${portStr}"`);
  }
  return port;
}

async function waitUntilReady(
  url: string,
  timeoutMs: number,
  pollIntervalMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 2_000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return; // gotowe
    } catch (err) {
      lastError = err;
      try {
        await client.end();
      } catch {
        // ignoruj — klient mógł się nigdy nie połączyć
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(
    `[scratchPg] Kontener Postgres nie stał się gotowy w ciągu ${timeoutMs}ms. ` +
      `To jest twardy błąd (nie cichy skip). Ostatni błąd połączenia: ${detail}`
  );
}

async function removeContainer(containerName: string): Promise<void> {
  try {
    await execFileAsync(DOCKER_BIN, ['rm', '-f', containerName]);
  } catch (err) {
    // Kontener mógł się już sam usunąć (--rm po zatrzymaniu) — nie eskalujemy
    // błędu teardownu ponad wynik właściwego testu, ale logujemy głośno,
    // żeby nie zgubić cicho realnego problemu ze sprzątaniem.
    const detail = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[scratchPg] Ostrzeżenie: nie udało się usunąć kontenera "${containerName}": ${detail}`
    );
  }
}
