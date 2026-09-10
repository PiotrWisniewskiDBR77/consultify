#!/usr/bin/env node
/**
 * projekty-duplikaty-dbr77-20260910.mjs — porządkowanie DUPLIKATÓW PROJEKTÓW
 * w organizacji DBR77 na STAGING (DEC-464 wariant b, zadanie D-C).
 *
 * KONTEKST / POMIAR (KROK 0, wykonany ręcznie przed napisaniem tego skryptu —
 * zob. evidence/d-c-projekty/measure-*.txt):
 *
 *   Organizacja DBR77 = a3e05d4a-5397-419d-b486-8e44366c0063 ma 16 projektów.
 *   12 z nich to trzy grupy o identycznej nazwie (E4 d5, git show 2dae92db17):
 *     - "DBR77 Transformation Program"        x6
 *     - "DBR77 Demo — All Modules"             x3
 *     - "Automated Changeover Optimization"    x3
 *   Pozostałe 4 nazwy są unikalne (Digital Transformation / Portfel — inicjatywy
 *   bezpośrednie / Program poprawy realizacji korzyści / Transformacja Cyfrowa
 *   Q2 2026) — POZA ZAKRESEM tego zadania, nie są ruszane.
 *
 *   "Pusty" wg zlecenia = 0 wierszy we WSZYSTKICH tabelach z kolumną project_id
 *   (skan information_schema.columns, ~140 tabel) POZA project_members/ustawieniami.
 *   Zmierzone tabelami z project_id > 0 (poza project_members) na 12 duplikatach:
 *     Automated Changeover Optimization (wszystkie 3: created 2026-02-15 17:52:27.000000, IDENTYCZNY co do mikrosekundy):
 *       21e06b0c-cf37-4c97-ae81-256a6950d691   initiatives=1, tasks=1        → TREŚĆ
 *       04366332-e4b5-4189-b656-72f8298665cf   tasks=1                       → TREŚĆ
 *       923bc369-e684-4aa6-a598-f69746fe719a   (brak)                        → PUSTY
 *     DBR77 Demo — All Modules (wszystkie 3: created 2026-02-22 11:29:11.506000, IDENTYCZNY):
 *       6be9d39f-2c73-4ac2-8e1d-e54870d4e872   (brak)                        → PUSTY
 *       ff83a6dd-b1f0-49e8-8edb-d06a3fc18241   ie_governance_role_bindings=6, initiative_candidates=5, tasks=1 → TREŚĆ
 *       project-dbr77-demo-all-modules         initiative_wizard_sessions=1  → TREŚĆ
 *     DBR77 Transformation Program, batch A (created 2025-12-23 18:26:46.000000, IDENTYCZNY x3):
 *       2fbb1e31-6c71-4228-b775-05aae98690d6   initiatives=7, tasks=19       → TREŚĆ
 *       f992cfae-9b03-473f-a685-a5f58b5a5119   initiative_dependencies=1, initiatives=7, tasks=16 → TREŚĆ
 *       project-dbr77-001                      initiatives=7, interview_sessions=3, tasks=16 → TREŚĆ
 *     DBR77 Transformation Program, batch B (created 2026-02-16 21:37:36.154000, IDENTYCZNY x3):
 *       655bb4b2-e757-480c-8d8d-df37a552c5bb   initiatives=1, tasks=1        → TREŚĆ
 *       5061af12-91d7-54b1-b424-9b5d9a715496   initiatives=1                 → TREŚĆ
 *       b4695c7c-0434-46ac-9cc1-3cd89afc463a   initiatives=1                 → TREŚĆ
 *
 *   Żaden z 12 duplikatów nie jest wpięty jako default_project_id/current_project_id
 *   (sprawdzone: organizations, users, user_preferences, user_task_templates —
 *   zero trafień). Bezpiecznie klasyfikować/ruszać którykolwiek.
 *
 * DECYZJA WYKONANA W TYM SKRYPCIE (tylko część jednoznaczna):
 *   ARCHIWIZACJA (mechanizm identyczny z trasą aplikacji
 *   server/src/controllers/ProjectController.ts:849 `archiveProject`:
 *   UPDATE projects SET status='archived', archived_at=NOW(), archived_by=<user>)
 *   dla DWÓCH jednoznacznie PUSTYCH duplikatów:
 *     - 923bc369-e684-4aa6-a598-f69746fe719a  (Automated Changeover Optimization)
 *     - 6be9d39f-2c73-4ac2-8e1d-e54870d4e872  (DBR77 Demo — All Modules)
 *
 * STOP — CELOWO NIE WYKONANE (rozdzielczy sufiks daty, KROK 1 zlecenia):
 *   Pozostałych 10 duplikatów NIE da się rozróżnić sufiksem `(YYYY-MM)` ani
 *   `(YYYY-MM-DD)` — w KAŻDEJ z trzech grup dwaj lub trzej "pełni" duplikaty
 *   mają created_at identyczny CO DO MIKROSEKUNDY (wstawieni jedną transakcją/
 *   seedem). Instrukcja zlecenia przewiduje wyłącznie eskalację miesiąc→dzień;
 *   dzień też jest identyczny, więc reguła się nie domyka bez NOWEGO,
 *   nieautoryzowanego elementu (numer porządkowy / czas / long content-based
 *   tie-break). Zgodnie z zasadą „STOP — zostaw i wypisz" te 10 projektów
 *   NIE jest tu zmieniane (żadnego rename). Wymagana decyzja właściciela/CTO
 *   co do reguły remisu przed dalszym działaniem — patrz MELDUNEK.
 *
 * UŻYCIE:
 *   DATABASE_URL=<staging thomas, bez SSL> node scripts/dane/projekty-duplikaty-dbr77-20260910.mjs --dry-run
 *   DATABASE_URL=… FORCE_PROJEKTY_DUPLIKATY=true node scripts/dane/projekty-duplikaty-dbr77-20260910.mjs --apply
 *   DATABASE_URL=… node scripts/dane/projekty-duplikaty-dbr77-20260910.mjs --verify
 *
 * Bezpieczniki: produkcja (centerbeam) odrzucana zawsze; host musi zawierać
 * fragment podany w --oczekiwany-host (domyślnie „thomas" — staging); --apply
 * wymaga DODATKOWO FORCE_PROJEKTY_DUPLIKATY=true; manifest z pełnymi wierszami
 * PRZED/PO w evidence/d-c-projekty/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'd-c-projekty');

const ORG_DBR77 = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const ARCHIVED_BY_DEFAULT = 'bf0f01a2-9ada-4cb8-a331-4dce1930e4f3'; // piotr@dbr77.com, ADMIN w DBR77

/** Jedyne dwa wiersze, o których ten skrypt może zdecydować bez dodatkowej decyzji właściciela: puste duplikaty. */
const PUSTE_DO_ARCHIWIZACJI = [
  {
    id: '923bc369-e684-4aa6-a598-f69746fe719a',
    nazwa: 'Automated Changeover Optimization',
    powod: 'pusty duplikat: 0 wierszy we wszystkich tabelach project_id poza project_members',
  },
  {
    id: '6be9d39f-2c73-4ac2-8e1d-e54870d4e872',
    nazwa: 'DBR77 Demo — All Modules',
    powod: 'pusty duplikat: 0 wierszy we wszystkich tabelach project_id poza project_members',
  },
];

/** 10 pozostałych duplikatów z treścią — NIE ruszane, tylko wypisywane jako STOP. */
const TRESCIOWE_STOP = [
  '21e06b0c-cf37-4c97-ae81-256a6950d691',
  '04366332-e4b5-4189-b656-72f8298665cf',
  'ff83a6dd-b1f0-49e8-8edb-d06a3fc18241',
  'project-dbr77-demo-all-modules',
  '2fbb1e31-6c71-4228-b775-05aae98690d6',
  'f992cfae-9b03-473f-a685-a5f58b5a5119',
  'project-dbr77-001',
  '655bb4b2-e757-480c-8d8d-df37a552c5bb',
  '5061af12-91d7-54b1-b424-9b5d9a715496',
  'b4695c7c-0434-46ac-9cc1-3cd89afc463a',
];

function stempel() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sprawdzCel(url, oczekiwanyHost) {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const baza = decodeURIComponent(u.pathname.replace(/^\//, '')).toLowerCase();
  if (/centerbeam/i.test(host) || /centerbeam/i.test(baza)) {
    throw new Error('Cel wskazuje PRODUKCJĘ (centerbeam). Odmowa bezwarunkowa. STOP.');
  }
  if (!oczekiwanyHost) throw new Error('Brak --oczekiwany-host. STOP.');
  if (!host.includes(oczekiwanyHost)) {
    throw new Error(`Host celu nie zawiera fragmentu „${oczekiwanyHost}". STOP.`);
  }
  return `${host}:${u.port || '5432'}${u.pathname}`;
}

async function pobierzStanProjektow(c, ids) {
  const r = await c.query(
    `SELECT id, name, status, archived_at, archived_by, created_at, updated_at
       FROM projects WHERE id = ANY($1::text[]) AND organization_id = $2
       ORDER BY name, created_at`,
    [ids, ORG_DBR77]
  );
  return r.rows;
}

function toCsv(rows) {
  const head = 'id,name,status,archived_at,archived_by,created_at';
  const lines = rows.map((r) =>
    [r.id, JSON.stringify(r.name), r.status, r.archived_at ?? '', r.archived_by ?? '', r.created_at?.toISOString?.() ?? r.created_at]
      .map((v) => String(v ?? ''))
      .join(',')
  );
  return [head, ...lines].join('\n') + '\n';
}

async function main() {
  const argv = process.argv.slice(2);
  const tryb = argv.includes('--apply') ? 'apply' : argv.includes('--verify') ? 'verify' : 'dry-run';
  const idxHost = argv.findIndex((a) => a === '--oczekiwany-host' || a.startsWith('--oczekiwany-host='));
  let oczekiwanyHost = 'thomas';
  if (idxHost !== -1) {
    const a = argv[idxHost];
    oczekiwanyHost = a.includes('=') ? a.split('=')[1] : argv[idxHost + 1];
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Brak DATABASE_URL. STOP.');
  const cel = sprawdzCel(databaseUrl, oczekiwanyHost);

  if (tryb === 'apply' && process.env.FORCE_PROJEKTY_DUPLIKATY !== 'true') {
    throw new Error('--apply wymaga FORCE_PROJEKTY_DUPLIKATY=true (dwa klucze). STOP.');
  }

  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const c = await pool.connect();
  const idyPuste = PUSTE_DO_ARCHIWIZACJI.map((p) => p.id);
  const idyWszystkie = [...idyPuste, ...TRESCIOWE_STOP];

  try {
    console.log(`[projekty-duplikaty] cel=${cel} tryb=${tryb}`);

    const przed = await pobierzStanProjektow(c, idyWszystkie);
    const czasStempla = stempel();
    fs.writeFileSync(path.join(KATALOG_DOWODOW, `PRZED-${czasStempla}.csv`), toCsv(przed));

    if (tryb === 'verify') {
      console.log('\n=== VERIFY: stan bieżący ===');
      for (const p of przed) {
        console.log(`${p.id} | ${p.name} | status=${p.status} | archived_at=${p.archived_at ?? '—'} | archived_by=${p.archived_by ?? '—'}`);
      }
      const paryNazw = new Map();
      for (const p of przed) {
        if (p.status === 'archived') continue;
        paryNazw.set(p.name, (paryNazw.get(p.name) || 0) + 1);
      }
      const duplikatyAktywne = [...paryNazw.entries()].filter(([, n]) => n > 1);
      console.log('\n=== VERIFY: pary o identycznej nazwie wśród AKTYWNYCH (nie-archived) ===');
      if (!duplikatyAktywne.length) console.log('(brak) — ale patrz STOP w komentarzu skryptu: 10 projektów z treścią NIE zostało jeszcze rozróżnionych sufiksem.');
      else for (const [nazwa, n] of duplikatyAktywne) console.log(`${nazwa}: ${n} aktywnych`);
      return;
    }

    // dry-run / apply: tylko archiwizacja pustych duplikatów
    const planowane = [];
    for (const cel2 of PUSTE_DO_ARCHIWIZACJI) {
      const wiersz = przed.find((p) => p.id === cel2.id);
      if (!wiersz) {
        console.log(`STOP: nie znaleziono ${cel2.id} (${cel2.nazwa}) w organizacji DBR77 — pomijam.`);
        continue;
      }
      if (wiersz.status === 'archived') {
        console.log(`[idempotencja] ${cel2.id} (${cel2.nazwa}) już ma status=archived — bez zmian.`);
        continue;
      }
      planowane.push({ ...cel2, poprzedniStatus: wiersz.status });
    }

    console.log(`\n=== ${tryb === 'apply' ? 'APPLY' : 'DRY-RUN'}: archiwizacja pustych duplikatów (${planowane.length}) ===`);
    for (const p of planowane) console.log(`  ${p.id} (${p.nazwa}): status ${p.poprzedniStatus} → archived — ${p.powod}`);

    console.log(`\n=== STOP — bez zmian, wymaga decyzji o regule remisu (${TRESCIOWE_STOP.length}) ===`);
    for (const id of TRESCIOWE_STOP) {
      const w = przed.find((p) => p.id === id);
      console.log(`  ${id} | ${w?.name ?? '?'} | created=${w?.created_at?.toISOString?.() ?? w?.created_at} | status=${w?.status}`);
    }

    const manifest = {
      wykonano: new Date().toISOString(),
      tryb,
      cel,
      organizacja: ORG_DBR77,
      archived_by: ARCHIVED_BY_DEFAULT,
      planowane_archiwizacje: planowane,
      stop_bez_zmian: TRESCIOWE_STOP,
      przed,
    };
    const manifestPath = path.join(KATALOG_DOWODOW, `manifest-${czasStempla}.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nManifest: ${manifestPath}`);

    if (tryb === 'apply' && planowane.length) {
      await c.query('BEGIN');
      try {
        for (const p of planowane) {
          const res = await c.query(
            `UPDATE projects
                SET status = 'archived', archived_at = NOW(), archived_by = $1, updated_at = NOW()
              WHERE id = $2 AND organization_id = $3 AND status <> 'archived'`,
            [ARCHIVED_BY_DEFAULT, p.id, ORG_DBR77]
          );
          console.log(`  UPDATE ${p.id}: ${res.rowCount} wiersz(y)`);
        }
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw e;
      }

      const po = await pobierzStanProjektow(c, idyWszystkie);
      fs.writeFileSync(path.join(KATALOG_DOWODOW, `PO-${czasStempla}.csv`), toCsv(po));
      console.log('\n=== PO archiwizacji ===');
      for (const p of po) console.log(`${p.id} | ${p.name} | status=${p.status} | archived_at=${p.archived_at ?? '—'}`);
    }
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('BŁĄD:', e.message);
  process.exit(1);
});
