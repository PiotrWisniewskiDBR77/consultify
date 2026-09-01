#!/usr/bin/env node
/**
 * STANOWISKO — jedno narzędzie do zarządzania CAŁYM stanowiskiem pomiarowym
 * (harness dev-render :3020 + strona odbioru :3030).
 *
 * POWÓD ISTNIENIA (2026-09-01): jednego dnia stanowisko trzy razy zatrzymało
 * pracę właściciela — (1) zniknęły pliki z katalogu roboczego, (2) harness
 * padł przy jednoczesnym starcie dwóch instancji, (3) zostało osiem procesów
 * harnessu naraz, z których ŻADEN nie trzymał portu. Za każdym razem właściciel
 * widział białą stronę i błąd połączenia zamiast produktu, a naprawa polegała
 * na ręcznym `ps`/`kill`/restart. To narzędzie robi to samo mechanicznie,
 * jedną komendą, i NIE zgaduje sukcesu po samym starcie procesu — czeka na
 * HTTP 200 zanim zamelduje "działa".
 *
 * Dlaczego .mjs, nie .sh: stanowisko wymaga parsowania `ps`/`lsof`, licznika
 * procesów, odpytywania HTTP z limitem czasu i eskalacji SIGTERM→SIGKILL —
 * w bashu to sklejanie tekstu i wyścigi; w node to kilka czytelnych funkcji
 * na wbudowanych modułach (http/net/child_process). Reszta `scripts/dev/`
 * już jest w tej konwencji (`preflight-ports.mjs`, `stop-dev-ports.mjs`).
 *
 * BEZPIECZEŃSTWO (żelazna zasada): w tym katalogu pracują równolegle INNE
 * sesje — mogą mieć własny harness na innym porcie (np. 3922). To narzędzie
 * ubija WYŁĄCZNIE procesy pasujące do DOKŁADNEGO wzorca poleceń poniżej
 * (harness: zawiera `dev-render/vite.config.ts` ORAZ `--port 3020`; strona
 * odbioru: zawiera `scripts/dev/odbior-serwer.mjs`). Jeśli port zajmuje coś
 * INNEGO — narzędzie się zatrzymuje z błędem zamiast to ubić.
 *
 * Użycie:
 *   node scripts/dev/stanowisko.mjs start|stop|status|restart|sprawdz
 *
 * Kody wyjścia: 0 = OK, 1 = problem (nadaje się do bramki).
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const HARNESS_PORT = 3020;
const ODBIOR_PORT = 3030;

// Katalog TYMCZASOWY (nie w repo), namespaced po ROOT — żeby inny worktree
// tego samego repo (inna ścieżka) nie dzielił plików PID/logów z tym.
const SLUG = ROOT.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const STAN_DIR = path.join(os.tmpdir(), 'consultify-stanowisko', SLUG);
fs.mkdirSync(STAN_DIR, { recursive: true });

const USLUGI = {
  harness: {
    nazwa: 'harness (dev-render, :' + HARNESS_PORT + ')',
    port: HARNESS_PORT,
    log: path.join(STAN_DIR, 'harness.log'),
    pidfile: path.join(STAN_DIR, 'harness.pid'),
    url: `http://127.0.0.1:${HARNESS_PORT}/`,
    // Dokładny wzorzec — MUSI zawierać port, bo inne sesje mają własny harness
    // na innym porcie i nie wolno go tknąć.
    pasuje: (cmd) => cmd.includes('dev-render/vite.config.ts') && cmd.includes(`--port ${HARNESS_PORT}`),
    uruchom() {
      const bin = path.join(ROOT, 'node_modules/.bin/vite');
      if (!fs.existsSync(bin)) {
        throw new Error(`Brak binarki vite: ${bin} (npm install?)`);
      }
      return spawn(
        bin,
        ['--config', 'dev-render/vite.config.ts', '--port', String(HARNESS_PORT), '--strictPort'],
        { cwd: ROOT, detached: true, stdio: ['ignore', otwLog(this.log), otwLog(this.log)] }
      );
    },
  },
  odbior: {
    nazwa: 'strona odbioru (:' + ODBIOR_PORT + ')',
    port: ODBIOR_PORT,
    log: path.join(STAN_DIR, 'odbior.log'),
    pidfile: path.join(STAN_DIR, 'odbior.pid'),
    url: `http://127.0.0.1:${ODBIOR_PORT}/`,
    pasuje: (cmd) => cmd.includes('scripts/dev/odbior-serwer.mjs'),
    uruchom() {
      return spawn(process.execPath, ['scripts/dev/odbior-serwer.mjs'], {
        cwd: ROOT,
        detached: true,
        stdio: ['ignore', otwLog(this.log), otwLog(this.log)],
      });
    },
  },
};

function otwLog(plik) {
  return fs.openSync(plik, 'a');
}

// ---------- ps / lsof ----------

function psSnapshot() {
  let out;
  try {
    out = execFileSync('ps', ['-axww', '-o', 'pid=,lstart=,command='], { encoding: 'utf8' });
  } catch (e) {
    out = String(e?.stdout || '');
  }
  const wiersze = [];
  for (const linia of out.split('\n')) {
    const t = linia.trim();
    if (!t) continue;
    const m = t.match(/^(\d+)\s+(\w{3}\s+\w{3}\s+\d+\s+\d\d:\d\d:\d\d\s+\d{4})\s+(.*)$/);
    if (!m) continue;
    wiersze.push({ pid: Number(m[1]), lstart: m[2], cmd: m[3] });
  }
  return wiersze;
}

function znajdzPasujace(usluga, snapshot) {
  return snapshot.filter((w) => usluga.pasuje(w.cmd));
}

function lsofPort(port) {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const linia of out.split('\n').slice(1)) {
      const parts = linia.trim().split(/\s+/);
      const pid = Number(parts[1]);
      if (Number.isFinite(pid)) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function zyje(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function ubijPidy(pidy, etykieta) {
  if (pidy.length === 0) return [];
  for (const pid of pidy) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* proces mógł już zniknąć */
    }
  }
  const koniec = Date.now() + 3000;
  let pozostale = pidy.filter(zyje);
  while (pozostale.length > 0 && Date.now() < koniec) {
    await sen(200);
    pozostale = pozostale.filter(zyje);
  }
  for (const pid of pozostale) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* ignoruj */
    }
  }
  if (pozostale.length > 0) await sen(300);
  const nieubite = pidy.filter(zyje);
  if (nieubite.length > 0) {
    console.error(`  ! nie udało się ubić ${etykieta}: PID ${nieubite.join(', ')}`);
  }
  return pidy.filter((p) => !nieubite.includes(p));
}

function sen(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- porty / HTTP ----------

function canBind(port) {
  return new Promise((resolve) => {
    const s = net
      .createServer()
      .once('error', () => resolve(false))
      .once('listening', () => s.close(() => resolve(true)))
      .listen(port, '0.0.0.0');
  });
}

async function czekajAzWolny(port, limitMs = 5000) {
  const koniec = Date.now() + limitMs;
  while (Date.now() < koniec) {
    if (await canBind(port)) return true;
    await sen(150);
  }
  return false;
}

function pobierz(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({ ok: true, status: res.statusCode, headers: res.headers, body })
      );
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, blad: 'timeout' });
    });
    req.on('error', (e) => resolve({ ok: false, blad: e.code || String(e.message || e) }));
  });
}

async function czekajNaHttp(url, limitMs = 30000, interwalMs = 500) {
  const koniec = Date.now() + limitMs;
  let ostatni = null;
  while (Date.now() < koniec) {
    const r = await pobierz(url, 2000);
    ostatni = r;
    if (r.ok && r.status && r.status < 500) return { ok: true, wynik: r };
    await sen(interwalMs);
  }
  return { ok: false, wynik: ostatni };
}

// ---------- komendy ----------

async function jestZdrowy(usl) {
  const r = await pobierz(usl.url, 2000);
  return !!(r.ok && r.status && r.status < 500);
}

/**
 * Sprząta osierocone procesy TYLKO dla jednej usługi. Wywoływane z `start`
 * WYŁĄCZNIE dla usługi, która okazała się niezdrowa (start ma być
 * idempotentny per usługa — usługa, która już działa, ma zostać NIETKNIĘTA,
 * żeby np. `start` po awarii samego harnessu nie zrzucał działającej strony
 * odbioru, z której właściciel może w tej chwili korzystać).
 */
async function sprzatnijDlaUslugi(usl) {
  const snapshot = psSnapshot();
  const pasujace = znajdzPasujace(usl, snapshot);

  // Kto trzyma port — jeśli to KTOŚ INNY niż nasz wzorzec, przerywamy.
  const listenerzy = lsofPort(usl.port);
  const obcy = listenerzy.filter((pid) => !pasujace.some((w) => w.pid === pid));
  if (obcy.length > 0) {
    const opisy = obcy.map((pid) => {
      const w = snapshot.find((x) => x.pid === pid);
      return `PID ${pid}: ${w ? w.cmd : '(nieznany proces)'}`;
    });
    throw new Error(
      `Port ${usl.port} (${usl.nazwa}) zajmuje OBCY proces — nie ubijam go automatycznie.\n` +
        opisy.map((o) => '    ' + o).join('\n') +
        '\n  Zamknij go ręcznie albo zwolnij port i spróbuj ponownie.'
    );
  }

  if (pasujace.length > 0) {
    console.log(
      `  - ${usl.nazwa}: ${pasujace.length} osierocony(ch)/martwy(ch) proces(ów) (PID ${pasujace
        .map((w) => w.pid)
        .join(', ')}) — ubijam`
    );
    await ubijPidy(
      pasujace.map((w) => w.pid),
      usl.nazwa
    );
  }
  if (fs.existsSync(usl.pidfile)) fs.rmSync(usl.pidfile, { force: true });

  const wolny = await czekajAzWolny(usl.port, 5000);
  if (!wolny) {
    throw new Error(
      `Port ${usl.port} (${usl.nazwa}) nadal zajęty po sprzątaniu — sprawdź ręcznie (\`lsof -nP -iTCP:${usl.port}\`).`
    );
  }
}

async function cmdStart() {
  console.log('Start...');
  for (const usl of Object.values(USLUGI)) {
    if (await jestZdrowy(usl)) {
      console.log(`  - ${usl.nazwa}: już działa i odpowiada — zostawiam bez zmian.`);
      continue;
    }
    await sprzatnijDlaUslugi(usl);
    fs.writeFileSync(usl.log, `--- start ${new Date().toISOString()} ---\n`);
    const proc = usl.uruchom();
    proc.unref();
    fs.writeFileSync(usl.pidfile, String(proc.pid), 'utf8');
    console.log(`  - ${usl.nazwa}: uruchomiony (PID ${proc.pid}), log: ${usl.log}`);
  }

  console.log('Czekam na odpowiedź HTTP 200 obu serwerów...');
  let wszystkoOk = true;
  for (const usl of Object.values(USLUGI)) {
    const { ok, wynik } = await czekajNaHttp(usl.url, 30000);
    if (ok) {
      console.log(`  - ${usl.nazwa}: OK (HTTP ${wynik.status})`);
    } else {
      wszystkoOk = false;
      const powod = wynik?.blad ? `błąd: ${wynik.blad}` : `HTTP ${wynik?.status}`;
      console.error(
        `  ! ${usl.nazwa}: NIE ODPOWIEDZIAŁ w 30s (${powod}). Sprawdź log: ${usl.log}`
      );
      try {
        const ogon = fs.readFileSync(usl.log, 'utf8').split('\n').slice(-15).join('\n');
        console.error(`    ostatnie linie logu:\n${ogon.replace(/^/gm, '    ')}`);
      } catch {
        /* brak logu */
      }
    }
  }

  if (!wszystkoOk) {
    console.error('\nStart NIEUDANY — jeden lub oba serwery nie odpowiedziały.');
    process.exitCode = 1;
    return;
  }
  console.log('\nStanowisko gotowe:');
  for (const usl of Object.values(USLUGI)) console.log(`  ${usl.url}`);
}

async function cmdStop() {
  console.log('Stop...');
  const snapshot = psSnapshot();
  let cokolwiek = false;
  for (const usl of Object.values(USLUGI)) {
    const pasujace = znajdzPasujace(usl, snapshot);
    if (pasujace.length === 0) {
      console.log(`  - ${usl.nazwa}: już zatrzymany.`);
    } else {
      cokolwiek = true;
      const ubite = await ubijPidy(
        pasujace.map((w) => w.pid),
        usl.nazwa
      );
      console.log(`  - ${usl.nazwa}: zatrzymano PID ${ubite.join(', ') || '(brak)'}`);
    }
    if (fs.existsSync(usl.pidfile)) fs.rmSync(usl.pidfile, { force: true });
  }
  if (!cokolwiek) console.log('Nic nie działało.');
  else console.log('Zatrzymano.');
}

function formatujCzas(w) {
  if (!w) return '?';
  return w.lstart;
}

async function cmdStatus() {
  const snapshot = psSnapshot();
  let ok = true;
  for (const usl of Object.values(USLUGI)) {
    const pasujace = znajdzPasujace(usl, snapshot);
    const zyjeCount = pasujace.length;
    const http = await pobierz(usl.url, 2000);
    const portOk = http.ok && http.status && http.status < 500;

    console.log(`${usl.nazwa}`);
    console.log(`  proces:  ${zyjeCount > 0 ? `ŻYJE (${zyjeCount})` : 'NIE DZIAŁA'}`);
    if (zyjeCount > 1) {
      console.log(`  UWAGA:   więcej niż jeden proces tego rodzaju (${zyjeCount}) — sprawdź duchy.`);
    }
    console.log(`  port:    ${portOk ? `odpowiada (HTTP ${http.status})` : 'BRAK ODPOWIEDZI' + (http.blad ? ` (${http.blad})` : '')}`);
    if (pasujace.length > 0) {
      console.log(`  od:      ${formatujCzas(pasujace[0])} (PID ${pasujace.map((w) => w.pid).join(', ')})`);
    }
    console.log('');

    if (zyjeCount === 0 || !portOk) ok = false;
  }
  if (!ok) process.exitCode = 1;
}

async function cmdSprawdz() {
  console.log('Kontrola głębsza (treść, nie tylko kod)...');
  let ok = true;

  // 1) Strona odbioru — treść sensowna, nie tylko 200.
  {
    const usl = USLUGI.odbior;
    const r = await pobierz(usl.url, 5000);
    const dlugosc = r.body ? r.body.length : 0;
    const maMarker = !!r.body && r.body.includes('Odbiór grafiki');
    const zdrowe = r.ok && r.status === 200 && dlugosc > 5000 && maMarker;
    console.log(`- ${usl.nazwa}: ${zdrowe ? 'OK' : 'PROBLEM'} (HTTP ${r.status ?? '-'}, ${dlugosc} B, marker=${maMarker})`);
    if (!zdrowe) {
      ok = false;
      console.log(`    ${r.blad ? `błąd: ${r.blad}` : 'treść wygląda na obciętą/niewłaściwą (za krótka albo brak znanego tytułu strony).'}`);
    }
  }

  // 2) Harness — jeden ekran (powłoka SPA) nie jest pusty.
  {
    const usl = USLUGI.harness;
    const shell = await pobierz(usl.url, 5000);
    const shellDlugosc = shell.body ? shell.body.length : 0;
    const shellOk =
      shell.ok &&
      shell.status === 200 &&
      shellDlugosc > 400 &&
      shell.body.includes('dev-render-root') &&
      shell.body.includes('main.tsx');
    console.log(
      `- ${usl.nazwa} (powłoka /): ${shellOk ? 'OK' : 'PROBLEM'} (HTTP ${shell.status ?? '-'}, ${shellDlugosc} B)`
    );
    if (!shellOk) ok = false;

    const modul = await pobierz(usl.url + 'main.tsx', 8000);
    const modulDlugosc = modul.body ? modul.body.length : 0;
    const modulOk = modul.ok && modul.status === 200 && modulDlugosc > 20000;
    console.log(
      `- ${usl.nazwa} (main.tsx): ${modulOk ? 'OK' : 'PROBLEM'} (HTTP ${modul.status ?? '-'}, ${modulDlugosc} B)`
    );
    if (!modulOk) {
      ok = false;
      console.log('    moduł wejściowy jest podejrzanie krótki/nieosiągalny — harness może serwować śmieci.');
    }

    // Wariant, który dziś naprawdę się zdarzył: /api/* pod harnessem ma
    // oddawać uczciwe 404 JSON (apiNoBackendPlugin), a NIE stronę zastępczą
    // SPA (200 text/html) — inaczej ekran wygląda jakby miał backend, którego
    // nie ma. Pomijamy tę kontrolę, gdy proxy jest świadomie włączone.
    if (!process.env.DEV_RENDER_API_PROXY_TARGET) {
      const api = await pobierz(usl.url + 'api/__stanowisko-sprawdz', 5000);
      const apiOk =
        api.ok &&
        api.status === 404 &&
        String(api.headers?.['content-type'] || '').includes('application/json') &&
        String(api.body || '').includes('DEV_RENDER_NO_BACKEND');
      console.log(`- ${usl.nazwa} (/api/* uczciwe 404, nie strona zastępcza): ${apiOk ? 'OK' : 'PROBLEM'}`);
      if (!apiOk) {
        ok = false;
        console.log('    /api/* oddaje coś innego niż uczciwe 404 JSON — możliwy powrót błędu ze strony zastępczej.');
      }
    } else {
      console.log('- (DEV_RENDER_API_PROXY_TARGET ustawiony — pomijam kontrolę /api/*)');
    }
  }

  console.log(ok ? '\nSprawdz: WSZYSTKO OK.' : '\nSprawdz: SĄ PROBLEMY (patrz wyżej).');
  if (!ok) process.exitCode = 1;
}

async function cmdRestart() {
  await cmdStop();
  await cmdStart();
}

// ---------- main ----------

const KOMENDY = { start: cmdStart, stop: cmdStop, status: cmdStatus, restart: cmdRestart, sprawdz: cmdSprawdz };

async function main() {
  const kmd = process.argv[2];
  const fn = KOMENDY[kmd];
  if (!fn) {
    console.error('Użycie: node scripts/dev/stanowisko.mjs start|stop|status|restart|sprawdz');
    process.exitCode = 1;
    return;
  }
  try {
    await fn();
  } catch (e) {
    console.error(`Błąd: ${e?.message || e}`);
    process.exitCode = 1;
  }
}

main();
