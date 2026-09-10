#!/usr/bin/env node
/**
 * DOWOD PRZEPLYWU ZAPISU (Zadanie 1-A2, w1a-sprzatanie-20260910) — po
 * usunieciu 15 organizacji-smieci ze stagingu. Cel: nie liczyc wierszy w
 * bazie (09.09 nauczylo: czystka skasowala 319 wierszy konfiguracji i
 * KAZDE tworzenie inicjatywy oddawalo 500, a licznik tego nie widzial) —
 * tylko realny POST/PUT/DELETE przez HTTP na koncie pokazowym Northwind,
 * przez TE SAME trasy, ktorych uzywa interfejs.
 *
 * *** NIE URUCHOMIONO PRZEZ ROBOTNIKA (agenta Claude) DO KONCA. ***
 * Krok logowania (POST /api/auth/login z haslem) jest akcja, ktorej agent
 * ma STALY, bezwarunkowy zakaz wykonywania samodzielnie — "entering
 * passwords to authenticate" jest w kategorii PROHIBITED w zasadach
 * bezpieczenstwa tej sesji i zasada wprost mowi, ze pozostaje zakazana
 * nawet gdy zlecajacy jawnie autoryzuje/dostarcza wszystkie dane. Zasada
 * nie rozroznia "prawdziwego" logowania od logowania kontem
 * testowym/pokazowym w skrypcie e2e — dotyczy samej czynnosci wpisania
 * hasla w celu uwierzytelnienia, niezaleznie od kontekstu czy autoryzacji
 * z zadania. Dlatego ten plik jest KODEM gotowym do uruchomienia (napisany
 * i zweryfikowany czytaniem zrodel + jeden zweryfikowany na zywo krok
 * anonimowy, patrz nizej), ale realny przebieg logowanie->zapis->sprzatanie
 * musi wykonac czlowiek (Piotr) recznie, jednym poleceniem ponizej.
 *
 * Co ZOSTALO faktycznie wykonane przez agenta na zywym stagingu (bez
 * hasla, wylacznie odczyt anonimowy — to NIE jest "logowanie"):
 *   GET https://staging.consultify.ai/api/csrf-token -> 200
 *   Body: {"token":"...")}  <- UWAGA: pole nazywa sie "token", NIE
 *   "csrfToken" jak zakladala instrukcja zadania. Ten skrypt uzywa
 *   prawidlowej nazwy pola zweryfikowanej na zywo.
 *
 * Uzycie (uruchamia CZLOWIEK, nie agent):
 *   node scripts/dane/dowod-zapisu-northwind.mjs
 *
 * Wymaga: ~/Developer/consultify-secrets/northwind-konta-STAGING.txt z
 * linia zaczynajaca sie od "Wspolne haslo" (NIE "Rotacja ..."). Haslo nigdy
 * nie trafia do stdout/stderr ani do logu evidence — tylko do naglowka
 * HTTP wysylanego bezposrednio do stagingu.
 *
 * Trasy potwierdzone CZYTANIEM ZRODEL (nie zgadywane):
 *   - login:      POST /api/auth/login                         (server/src/routes/auth.routes.ts)
 *   - csrf:       GET  /api/csrf-token -> {"token": "..."}      (server/src/index.ts:1251, server/src/middleware/csrf.middleware.ts)
 *   - me:         GET  /api/auth/me
 *   - initiatives (odczyt, do liczenia):        GET  /api/initiatives
 *   - KANON tworzenia inicjatywy (2 kroki, src/services/initiatives-execution/runtimeApi.ts):
 *       1) POST /api/initiatives/runtime-v1/source-proposals   (submitSourceProposal)
 *       2) POST /api/initiatives/runtime-v1/registrations      (registerSourceProposal)
 *     UI (src/components/Initiatives/InitiativesHub.tsx) woła createInitiativeWriteTruth
 *     (src/services/initiativeWriteTruth.ts), ktora WYMAGA projectId + initiativeOwnerId
 *     (initiativeOwnerId = wlasne id z /api/auth/me; projectId = projekt w organizacji
 *     Northwind, pobrany z GET /api/projects).
 *   - odczyt zarejestrowanej inicjatywy:  GET   /api/initiatives/runtime-v1/initiatives/:id
 *   - edycja tytulu:                      PATCH /api/initiatives/runtime-v1/initiatives/:id/metadata
 *   - usuniecie/zamkniecie (kanon nie ma DELETE — jest cancel):
 *                                          POST  /api/initiatives/runtime-v1/initiatives/:id/cancel
 *   - zadanie w Mojej Pracy (server/src/routes/pmo/tasks.routes.ts, mount server/src/Gateway.ts:926):
 *       POST   /api/tasks   {"title": "...", "status": "todo"}
 *       DELETE /api/tasks/:id
 *
 * Bezpiecznik CSRF (server/src/middleware/csrf.middleware.ts): request z
 * naglowkiem Authorization: Bearer <jwt> i BEZ ciasteczka csrf_token w
 * ogole omija walidacje CSRF (isBearerOnlyRequest). Ten skrypt i tak
 * zawsze wysyla x-csrf-token + ciasteczko z /api/csrf-token, zeby dzialac
 * niezaleznie od trybu CSRF_MODE na danym srodowisku.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const BASE_URL = 'https://staging.consultify.ai';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const EMAIL = 'james.whitfield@northwind.example';
const SECRETS_FILE = path.join(
  homedir(),
  'Developer/consultify-secrets/northwind-konta-STAGING.txt'
);
const TITLE = 'PROBE W1A 2026-09-10 — do usunięcia';

const log = [];
function record(line) {
  log.push(line);
  // eslint-disable-next-line no-console
  console.log(line);
}

const fivexx = [];

function readPassword() {
  const raw = readFileSync(SECRETS_FILE, 'utf8');
  for (const line of raw.split('\n')) {
    if (/wsp[oó]lne\s+has/i.test(line) && !/rotacj/i.test(line)) {
      const value = line.split(':').slice(1).join(':').trim();
      if (value) return value;
    }
  }
  throw new Error(`Nie znaleziono linii "Wspolne haslo" (nie "Rotacja") w ${SECRETS_FILE}`);
}

// Bardzo prosty cookie jar — wystarczy do jednego hosta.
const cookieJar = new Map();
function storeCookies(res) {
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const raw of setCookie) {
    const [pair] = raw.split(';');
    const idx = pair.indexOf('=');
    if (idx > 0) cookieJar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
function cookieHeader() {
  return Array.from(cookieJar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function call(method, urlPath, { body, csrfToken, bearer, expect } = {}) {
  const headers = { 'User-Agent': UA };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
  const cookies = cookieHeader();
  if (cookies) headers['Cookie'] = cookies;

  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  storeCookies(res);
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* not JSON */
  }
  const line = `${method} ${urlPath} -> ${res.status}`;
  record(line);
  if (res.status >= 500) fivexx.push({ method, urlPath, status: res.status, body: json });
  if (expect && !expect.includes(res.status)) {
    record(`  BLOKER: oczekiwano ${expect.join('/')} dostalem ${res.status}. Body: ${JSON.stringify(json)}`);
  }
  return { status: res.status, json };
}

async function main() {
  record(`=== Dowod przeplywu zapisu Northwind — staging — ${new Date().toISOString()} ===`);

  // 1) CSRF (anonimowe, bez hasla)
  const csrf1 = await call('GET', '/api/csrf-token', { expect: [200] });
  const csrfToken = csrf1.json?.token;
  if (!csrfToken) throw new Error('Brak pola "token" w odpowiedzi /api/csrf-token');

  // 2) Logowanie — TU wymagane haslo. Patrz naglowek pliku: agent tego kroku
  // nie wykonuje sam. Od tego miejsca w dol uruchamia to WYLACZNIE czlowiek.
  const password = readPassword();
  const login = await call('POST', '/api/auth/login', {
    body: { email: EMAIL, password },
    csrfToken,
    expect: [200],
  });
  const bearer = login.json?.token;

  // 3) /api/auth/me
  const me = await call('GET', '/api/auth/me', { bearer, expect: [200] });
  const userId = me.json?.id || me.json?.user?.id;
  if (!userId) throw new Error('Brak id uzytkownika w /api/auth/me');
  record(`  userId: ${userId}`);

  // 4) GET /api/initiatives — liczba wierszy
  const initList1 = await call('GET', '/api/initiatives', { bearer, expect: [200] });
  const countBefore = Array.isArray(initList1.json)
    ? initList1.json.length
    : Array.isArray(initList1.json?.data)
      ? initList1.json.data.length
      : Array.isArray(initList1.json?.initiatives)
        ? initList1.json.initiatives.length
        : null;
  record(`  /api/initiatives przed: ${countBefore ?? 'nieznane (ksztalt odpowiedzi inny niz zakladany)'}`);

  // 5) GET /api/projects — potrzebny projectId do kanonu tworzenia
  const projects = await call('GET', '/api/projects', { bearer, expect: [200] });
  const projectList = Array.isArray(projects.json?.data)
    ? projects.json.data
    : Array.isArray(projects.json)
      ? projects.json
      : [];
  const projectId = projectList[0]?.id;
  if (!projectId) throw new Error('Brak zadnego projektu w organizacji Northwind — nie da sie utworzyc inicjatywy kanonicznie.');
  record(`  projectId: ${projectId}`);

  // 6) KANON tworzenia inicjatywy — dwa kroki (src/services/initiatives-execution/runtimeApi.ts)
  const clientRequestId = `w1a-probe-${Date.now()}`;
  const proposal = await call('POST', '/api/initiatives/runtime-v1/source-proposals', {
    bearer,
    csrfToken,
    expect: [200, 201],
    body: {
      proposalId: `proposal-${clientRequestId}`,
      expectedVersion: 0,
      clientRequestId,
      sourceType: 'MANUAL_HUB',
      sourceId: `manual-hub-${clientRequestId}`,
      sourceVersion: 1,
      provenance: { type: 'MANUAL_HUB' },
      title: TITLE,
      problem: TITLE,
      proposedOutcome: null,
      projectId,
      initiativeOwnerId: userId,
      visibility: 'PROJECT',
    },
  });

  const registration = await call('POST', '/api/initiatives/runtime-v1/registrations', {
    bearer,
    csrfToken,
    expect: [200, 201],
    body: {
      proposalId: `proposal-${clientRequestId}`,
      expectedVersion: proposal.json?.aggregateVersion ?? 1,
      clientRequestId: `reg-${clientRequestId}`,
      projectId,
      initiativeOwnerId: userId,
    },
  });
  const initiativeId = registration.json?.response?.initiativeId || registration.json?.initiativeId;
  if (!initiativeId) {
    record('  BLOKER: brak initiativeId w odpowiedzi rejestracji — STOP, nie kontynuuje.');
  } else {
    record(`  initiativeId: ${initiativeId}`);

    // 7) Edycja tytulu
    const NEW_TITLE = `${TITLE} (edytowano)`;
    await call('PATCH', `/api/initiatives/runtime-v1/initiatives/${initiativeId}/metadata`, {
      bearer,
      csrfToken,
      expect: [200],
      body: {
        expectedVersion: registration.json?.aggregateVersion ?? 1,
        clientRequestId: `amend-${clientRequestId}`,
        title: NEW_TITLE,
      },
    });
    const readBack = await call('GET', `/api/initiatives/runtime-v1/initiatives/${initiativeId}`, {
      bearer,
      expect: [200],
    });
    const titleMatches = readBack.json?.title === NEW_TITLE || readBack.json?.response?.title === NEW_TITLE;
    record(`  tytul po edycji zgadza sie: ${titleMatches}`);

    // 8) Zadanie w Mojej Pracy — utworz i usun
    const task = await call('POST', '/api/tasks', {
      bearer,
      csrfToken,
      expect: [200, 201],
      body: { title: `${TITLE} — zadanie`, status: 'todo' },
    });
    const taskId = task.json?.id || task.json?.task?.id;
    if (taskId) {
      record(`  taskId: ${taskId}`);
      await call('DELETE', `/api/tasks/${taskId}`, { bearer, csrfToken, expect: [200, 204] });
    } else {
      record('  BLOKER: brak id nowego zadania — nie da sie posprzatac automatycznie.');
    }

    // 9) Usuniecie/zamkniecie inicjatywy — kanon nie ma DELETE, jest cancel
    const cancel = await call('POST', `/api/initiatives/runtime-v1/initiatives/${initiativeId}/cancel`, {
      bearer,
      csrfToken,
      expect: [200],
      body: {
        expectedVersion: (registration.json?.aggregateVersion ?? 1) + 1,
        clientRequestId: `cancel-${clientRequestId}`,
        reason: 'w1a-sprzatanie: proba dowodu zapisu, do usuniecia',
      },
    });
    if (cancel.status !== 200) {
      record(`  STOP: nie udalo sie anulowac inicjatywy ${initiativeId} — usun recznie.`);
    } else {
      const readAfter = await call('GET', `/api/initiatives/runtime-v1/initiatives/${initiativeId}`, {
        bearer,
        expect: [200],
      });
      const status = readAfter.json?.status || readAfter.json?.response?.status;
      record(`  status inicjatywy po anulowaniu: ${status}`);
    }
  }

  // 10) Podsumowanie 5xx
  record('');
  record(`5xx napotkane: ${fivexx.length}`);
  for (const item of fivexx) {
    record(`  ${item.method} ${item.urlPath} -> ${item.status}: ${JSON.stringify(item.body)}`);
  }
}

main()
  .then(() => {
    record('=== KONIEC ===');
    process.exit(fivexx.length > 0 ? 1 : 0);
  })
  .catch((err) => {
    record(`BLAD: ${err.message}`);
    process.exit(1);
  });
