#!/usr/bin/env node
/**
 * brud-e4-20260910.mjs — sprzątanie BRUDU W DANYCH widocznego dla właściciela na
 * bazie STAGING (zadanie E4, raport odbioru §6:
 * docs/program/PRZEKAZANIE_KODOWANIA_20260907/ODBIOR_W1B_INICJATYWY_REALIZACJA_20260910.md).
 *
 * Punkty D1–D4 i D6 z tego raportu. D5 to WYŁĄCZNIE pomiar (decyzja właściciela
 * co do duplikatów projektów jest poza zakresem tego skryptu). D7 nie jest tu —
 * to osobny skrypt (dowod-zapisu-northwind.mjs) wymagający logowania kontem
 * testowym, poza zakresem tego narzędzia.
 *
 * ------------------------------------------------------------------------------
 * DLACZEGO TAK
 * ------------------------------------------------------------------------------
 *  - ŻADNEGO dopasowania po wzorcu/LIKE do wyboru wierszy: każdy operowany
 *    identyfikator jest WPISANY WPROST w stałych niżej (ustalony ręcznym
 *    pomiarem, zapisanym w evidence/e4-dane/*.csv przed uruchomieniem tego
 *    skryptu). Filtr `organization_id` w każdym UPDATE/DELETE jest dodatkowym
 *    bezpiecznikiem, nie głównym mechanizmem wyboru.
 *  - Zamiast USUWANIA rekordów tam, gdzie tabela ma kolumnę/konwencję
 *    archiwizacji, wybieramy ARCHIWIZACJĘ (odwracalną, nie kasującą historii):
 *      * initiatives:      archived = TRUE, archived_at = now()   (dokładnie ten
 *        sam efekt co server/src/services/initiative/initiativeTransitionService.ts
 *        operacja ARCHIVE; server/src/domain/initiatives-execution/
 *        postgresInitiativeReader.ts:1433-1434 filtruje listę po
 *        `COALESCE(archived,false)=false AND archived_at IS NULL`, więc to
 *        realnie chowa wiersz z listy Inicjatyw)
 *      * rvn_roi_cases:    archived_at = now() (kolumna istnieje wprost w tabeli)
 *      * decisions:        status = 'cancelled' (już używana w tej tabeli wartość
 *        dla 7 innych wierszy; wszystkie widoki w ExecutionController.ts/
 *        decisionEscalationJob.ts traktują 'pending'/'escalated' jako aktywne,
 *        więc 'cancelled' chowa decyzję z aktywnych widoków bez kasowania wiersza)
 *      * raid_items:       status = 'CLOSED' (dozwolona wartość wg
 *        raid_items_status_check, oznacza zamknięty/nieaktywny RAID item)
 *      * tasks:             status = 'archived' (już realnie używana wartość w
 *        tej samej tabeli — 2 istniejące wiersze na starcie)
 *    initiative_milestones i initiative_history NIE są ruszane: pierwsza nie ma
 *    kolumny archiwizacji i jest widoczna tylko w szczególe już zarchiwizowanej
 *    inicjatywy; druga to log audytowy (append-only), nie „brud" tylko ślad
 *    prawdziwej edycji właściciela.
 *  - D3 (rodzina HTML-escape): dekoder PORTOWANY 1:1 z już istniejącego
 *    src/utils/decodeHtmlEntities.ts (ten sam algorytm: iteracyjny, ograniczony
 *    do 5 przebiegów, encje amp/lt/gt/quot/apos/nbsp + numeryczne &#NNN;/&#xHH;).
 *    Stosowany WYŁĄCZNIE na jawnie wypisanych (tabela,kolumna,id) trafieniach z
 *    pomiaru — nie na całych tabelach. `initiatives.problem_statement` i
 *    `initiatives.kill_criteria` zweryfikowane na próbce: po odkodowaniu dają
 *    POPRAWNY JSON (a InitiativeDocumentView.tsx:3475-3492 ma już fallback
 *    `JSON.parse(decodeHtmlEntities(x))`, czyli aplikacja SAMA zakłada, że to
 *    jest bug do naprawienia, nie zamierzony format) — więc odkodowujemy.
 *  - D6: kasowanie (nie archiwizacja) — to są wiersze silnika zdarzeń
 *    (event-sourcing), nie mają pojęcia „archived" i cały sens usunięcia sondy
 *    to zniknięcie śladu, nie jego ukrycie. Pełne wiersze idą do manifestu
 *    PRZED usunięciem.
 *
 * ------------------------------------------------------------------------------
 * UŻYCIE
 * ------------------------------------------------------------------------------
 *   DATABASE_URL=... node scripts/dane/brud-e4-20260910.mjs --op=<d1|d2|d3|d4|d5|d6|all> --dry-run
 *   DATABASE_URL=... FORCE_E4=true node scripts/dane/brud-e4-20260910.mjs --op=<...> --apply
 *
 * Domyślny tryb = dry-run (brak trybu jawnego --apply nigdy nie zapisuje).
 * --apply wymaga DODATKOWO zmiennej środowiskowej FORCE_E4=true.
 * Manifesty (pełne wiersze przed zmianą) lądują w
 *   evidence/e4-dane/manifesty/manifest-<op>-<ISO-czas>.json
 * Ten skrypt jest IDEMPOTENTNY: powtórne odpalenie --apply na już
 * zarchiwizowanych/odkodowanych/usuniętych wierszach nie zrobi nic (WHERE
 * dopisuje warunek odwrotny do stanu docelowego).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'e4-dane');
const KATALOG_MANIFESTOW = path.join(KATALOG_DOWODOW, 'manifesty');

const DBR77_ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const NORTHWIND_ORG = '468b234c-66c4-54e1-b626-5e0fb3a92f6a';

// ============================================================================
// Guard hosta — ten sam wzorzec co usun-organizacje.ts: produkcja ZAWSZE
// odrzucona, zdalne hosty tylko z jawnej listy proxy Railway.
// ============================================================================
const HOSTY_ZDALNE_DOZWOLONE = [
  'trolley.proxy.rlwy.net',
  'thomas.proxy.rlwy.net',
  'centerbeam.proxy.rlwy.net', // odrzucane niżej mimo obecności na liście — patrz check produkcji
];

function sprawdzHost(databaseUrl) {
  const u = new URL(databaseUrl);
  if (/centerbeam/i.test(u.hostname)) {
    throw new Error('PRODUKCJA (centerbeam) — STOP. Ten skrypt nie wolno uruchomić na produkcji.');
  }
  const lokalne = ['127.0.0.1', 'localhost', '::1', '0.0.0.0'];
  if (lokalne.includes(u.hostname)) return;
  if (!HOSTY_ZDALNE_DOZWOLONE.includes(u.hostname)) {
    throw new Error(`Host ${u.hostname} nie jest na liście dozwolonych zdalnych hostów.`);
  }
}

// ============================================================================
// Dekoder HTML entities — port 1:1 z src/utils/decodeHtmlEntities.ts
// ============================================================================
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeOnce(input) {
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(isHex ? body.slice(2) : body.slice(1), isHex ? 16 : 10);
      if (Number.isFinite(code) && code > 0 && code <= 0x10ffff) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return match;
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named !== undefined ? named : match;
  });
}

function decodeHtmlEntities(input) {
  if (typeof input !== 'string' || input.length === 0) return typeof input === 'string' ? input : '';
  let current = input;
  for (let i = 0; i < 5; i += 1) {
    const next = decodeOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

// ============================================================================
// Manifest helper
// ============================================================================
function zapiszManifest(op, dane) {
  fs.mkdirSync(KATALOG_MANIFESTOW, { recursive: true });
  const znacznik = new Date().toISOString().replace(/[:.]/g, '-');
  const plik = path.join(KATALOG_MANIFESTOW, `manifest-${op}-${znacznik}.json`);
  fs.writeFileSync(plik, JSON.stringify(dane, null, 2), 'utf8');
  return plik;
}

// ============================================================================
// D1 — rekord testowy "[ACCEPTANCE] Benefits realization" + zależność ROI
// ============================================================================
const D1_INITIATIVE_ID = 'dbr77--acceptance--initiative';
const D1_ROI_CASE_ID = 'c3b0f15c-b2ce-4a9d-a7d3-d5f8e7b17687';

async function mierzD1(c) {
  const ini = await c.query(
    'select id, organization_id, name, status, archived, archived_at from initiatives where id=$1',
    [D1_INITIATIVE_ID]
  );
  const roi = await c.query(
    'select case_id, organization_id, initiative_id, title, status, archived_at from rvn_roi_cases where case_id=$1',
    [D1_ROI_CASE_ID]
  );
  return { initiative: ini.rows[0] ?? null, roiCase: roi.rows[0] ?? null };
}

async function applyD1(c, apply) {
  const przed = await mierzD1(c);
  if (!przed.initiative) throw new Error(`D1: initiative ${D1_INITIATIVE_ID} nie istnieje — STOP.`);
  if (przed.initiative.organization_id !== DBR77_ORG) {
    throw new Error(`D1: initiative ${D1_INITIATIVE_ID} należy do innej organizacji niż DBR77 — STOP.`);
  }
  const planowane = [];
  if (!przed.initiative.archived) {
    planowane.push('initiatives.archived=TRUE,archived_at=now()');
    if (apply) {
      await c.query(
        `UPDATE initiatives SET archived = TRUE, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id = $2`,
        [D1_INITIATIVE_ID, DBR77_ORG]
      );
    }
  }
  if (przed.roiCase && !przed.roiCase.archived_at) {
    planowane.push('rvn_roi_cases.archived_at=now()');
    if (apply) {
      await c.query(
        `UPDATE rvn_roi_cases SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE case_id = $1 AND organization_id = $2`,
        [D1_ROI_CASE_ID, DBR77_ORG]
      );
    }
  }
  const po = apply ? await mierzD1(c) : null;
  return { przed, planowane, po };
}

// ============================================================================
// D2 — decyzja "zdfsf"
// ============================================================================
const D2_DECISION_ID = 'dc34768a-1e72-498b-9beb-9b2bf0c66b92';

async function mierzD2(c) {
  const r = await c.query(
    'select id, organization_id, initiative_id, title, status from decisions where id=$1',
    [D2_DECISION_ID]
  );
  return r.rows[0] ?? null;
}

async function applyD2(c, apply) {
  const przed = await mierzD2(c);
  if (!przed) throw new Error(`D2: decision ${D2_DECISION_ID} nie istnieje — STOP.`);
  if (przed.title !== 'zdfsf') throw new Error(`D2: tytuł decyzji zmienił się (${przed.title}) — STOP.`);
  if (przed.organization_id !== DBR77_ORG) throw new Error('D2: decyzja spoza DBR77 — STOP.');
  const planowane = [];
  if (przed.status !== 'cancelled') {
    planowane.push("decisions.status='cancelled'");
    if (apply) {
      await c.query(
        `UPDATE decisions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`,
        [D2_DECISION_ID, DBR77_ORG]
      );
    }
  }
  const po = apply ? await mierzD2(c) : null;
  return { przed, planowane, po };
}

// ============================================================================
// D3 — rodzina HTML-escape (jawna lista trafień z pomiaru 2026-09-10)
// ============================================================================
const D3_CELE = [
  { tabela: 'users', kolumna: 'job_title', pk: 'id', id: 'aa614b34-bfbd-4757-b2d4-52a2caa466f7' },
  { tabela: 'decisions', kolumna: 'description', pk: 'id', id: 'decision-c477bd37-8689-419c-b292-4b2b7fd432b3' },
  { tabela: 'initiatives', kolumna: 'kill_criteria', pk: 'id', id: 'd1b3751e-d2aa-4957-8967-10254e7628c3', oczekiwanyJson: true },
  { tabela: 'initiatives', kolumna: 'problem_statement', pk: 'id', id: '0a8e13eb-a610-4852-b820-604d4fc3ad73', oczekiwanyJson: true },
  { tabela: 'initiatives', kolumna: 'problem_statement', pk: 'id', id: '3cf4ef78-fd80-4a43-be80-9889145ca533', oczekiwanyJson: true },
  { tabela: 'initiatives', kolumna: 'problem_statement', pk: 'id', id: 'bafcb088-5453-4345-9500-5723d883fe2c', oczekiwanyJson: true },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '7058e152-878e-4a41-b0d4-4701db7bb439' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '8195f3e7-8afe-4750-860e-e0b7c08c6cf8' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '430a8f9a-bfd9-4205-9912-cde6d90fa06c' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '2ea790c7-e7bf-4f58-af1f-1ba9e17b1fea' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '6def4ccf-ef77-431d-9f1b-aed18b382a97' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: 'f9b942da-ccd6-4398-83b1-be2841ae4bc5' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: 'd5cb773d-d201-42a9-aa9a-192737d39d54' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '01fd6613-f2ce-4dda-8b6b-0bc5d82ae185' },
  { tabela: 'tasks', kolumna: 'description', pk: 'id', id: '96a4a017-8c0f-48e4-9edc-da26ab70aa07' },
];
const ENTITY_RE = /&amp;|&quot;|&#39;|&lt;|&gt;/;

async function mierzD3(c) {
  const wyniki = [];
  for (const cel of D3_CELE) {
    const r = await c.query(
      `select "${cel.pk}" as pk, organization_id, "${cel.kolumna}" as wartosc from "${cel.tabela}" where "${cel.pk}" = $1`,
      [cel.id]
    );
    wyniki.push({ ...cel, wiersz: r.rows[0] ?? null });
  }
  return wyniki;
}

async function applyD3(c, apply) {
  const przed = await mierzD3(c);
  const plan = [];
  for (const w of przed) {
    if (!w.wiersz) throw new Error(`D3: brak wiersza ${w.tabela}.${w.id} — STOP.`);
    if (w.wiersz.organization_id !== DBR77_ORG) throw new Error(`D3: wiersz spoza DBR77 (${w.tabela}.${w.id}) — STOP.`);
    const stara = w.wiersz.wartosc;
    if (typeof stara !== 'string' || !ENTITY_RE.test(stara)) {
      plan.push({ tabela: w.tabela, id: w.id, kolumna: w.kolumna, zmiana: 'brak (już czysto)' });
      continue;
    }
    const nowa = decodeHtmlEntities(stara);
    if (w.oczekiwanyJson) {
      try {
        JSON.parse(nowa);
      } catch (e) {
        throw new Error(`D3: ${w.tabela}.${w.id}.${w.kolumna} po odkodowaniu NIE jest poprawnym JSON — STOP (dług). ${e.message}`);
      }
    }
    // idempotencja: odkodowanie odkodowanego = ten sam wynik
    if (decodeHtmlEntities(nowa) !== nowa) {
      throw new Error(`D3: dekoder niestabilny na ${w.tabela}.${w.id}.${w.kolumna} — STOP.`);
    }
    plan.push({ tabela: w.tabela, id: w.id, kolumna: w.kolumna, stara, nowa });
    if (apply) {
      await c.query(`UPDATE "${w.tabela}" SET "${w.kolumna}" = $1, updated_at = CURRENT_TIMESTAMP WHERE "${w.pk}" = $2 AND organization_id = $3`, [
        nowa,
        w.id,
        DBR77_ORG,
      ]);
    }
  }
  const po = apply ? await mierzD3(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// D4 — inicjatywy z czatu "co dalej mogę zrobić?" (+ Fork) i zależności
// ============================================================================
const D4_INITIATIVE_IDS = ['9825ac24-bf6c-4d3d-991e-1cbc97312a1f', 'bafcb088-5453-4345-9500-5723d883fe2c'];
const D4_FORK_ID = 'bafcb088-5453-4345-9500-5723d883fe2c';
const D4_RAID_IDS = ['172bace5-b4df-4f8b-b4ae-294393e0cbe0', 'e3f56e8c-d65a-4c98-ab85-6cec772e801d', 'e1318dc7-4bc2-45d6-9b63-33c50d54c105'];
const D4_TASK_IDS = [
  '3eda96ba-02a9-4613-8238-c0e226a42d78', 'f47460ae-76ca-4e2c-b770-d34852f2d190', '4f3342f6-ba44-4297-872b-3dea6dae4da8',
  'fe570b3c-d408-41aa-a592-3f0f9d636708', '58dc7726-3041-4cf6-a8a7-712c52075006', '583726e0-85b1-4229-8c13-9ff9d2d592f3',
  '6dc98550-9ccb-4548-b2bd-0e2691950b58', '1717f3ef-b267-4c5f-9aff-bcde4f33ce96', '9acf6eaf-d399-41be-b907-5a9341220ff3',
  'd35897b5-6ea6-45c6-9f09-1226e46c7692', '9f4d8c6e-7ce0-4455-9aa4-a03abb632cda', '3f167e3d-336f-4089-89db-872bea02595d',
  '3a6f9beb-0220-48e6-890c-956b2a6813a8', '016851b5-7a43-4b08-b5a8-5a8cd9774e8a',
];
// D2 zajmuje się już decyzją dc34768a (zależność Fork) — tu tylko potwierdzamy stan, bez powtórki.

async function mierzD4(c) {
  const inis = await c.query('select id, organization_id, name, status, archived, archived_at from initiatives where id = ANY($1)', [D4_INITIATIVE_IDS]);
  const raid = await c.query('select id, organization_id, title, status from raid_items where id = ANY($1)', [D4_RAID_IDS]);
  const tasks = await c.query('select id, organization_id, title, status from tasks where id = ANY($1)', [D4_TASK_IDS]);
  const decyzja = await mierzD2(c);
  return { initiatives: inis.rows, raid: raid.rows, tasks: tasks.rows, decyzjaForkaZaleznosc: decyzja };
}

async function applyD4(c, apply) {
  const przed = await mierzD4(c);
  if (przed.initiatives.length !== D4_INITIATIVE_IDS.length) throw new Error('D4: brakuje jednej z inicjatyw — STOP.');
  if (przed.initiatives.some((i) => i.organization_id !== DBR77_ORG)) throw new Error('D4: inicjatywa spoza DBR77 — STOP.');
  if (przed.raid.length !== D4_RAID_IDS.length) throw new Error('D4: brakuje jednego z RAID items — STOP.');
  if (przed.tasks.length !== D4_TASK_IDS.length) throw new Error('D4: brakuje jednego z tasków — STOP.');

  const plan = [];
  for (const iid of D4_INITIATIVE_IDS) {
    const row = przed.initiatives.find((i) => i.id === iid);
    if (!row.archived) {
      plan.push(`initiatives(${iid}).archived=TRUE`);
      if (apply) {
        await c.query(
          `UPDATE initiatives SET archived = TRUE, archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND organization_id = $2`,
          [iid, DBR77_ORG]
        );
      }
    }
  }
  for (const row of przed.raid) {
    if (row.status !== 'CLOSED') {
      plan.push(`raid_items(${row.id}).status=CLOSED`);
      if (apply) {
        await c.query(`UPDATE raid_items SET status = 'CLOSED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`, [row.id, DBR77_ORG]);
      }
    }
  }
  for (const row of przed.tasks) {
    if (row.status !== 'archived') {
      plan.push(`tasks(${row.id}).status=archived`);
      if (apply) {
        await c.query(`UPDATE tasks SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`, [row.id, DBR77_ORG]);
      }
    }
  }
  // Decyzja zdfsf (zależność Fork) — jeżeli D2 nie było odpalone w tym samym
  // przebiegu, D4 też ją domyka (ten sam warunek, idempotentnie).
  if (przed.decyzjaForkaZaleznosc && przed.decyzjaForkaZaleznosc.status !== 'cancelled') {
    plan.push(`decisions(${D2_DECISION_ID}).status=cancelled (zależność Fork)`);
    if (apply) {
      await c.query(`UPDATE decisions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND organization_id = $2`, [D2_DECISION_ID, DBR77_ORG]);
    }
  }
  const po = apply ? await mierzD4(c) : null;
  return { przed, plan, po, uwaga: 'initiative_milestones (1 wiersz) i initiative_history (2 wiersze, log audytowy) NIE ruszane — brak kolumny archiwizacji / to log przeszłych edycji.' };
}

// ============================================================================
// D5 — TYLKO POMIAR (decyzja właściciela poza zakresem tego skryptu)
// ============================================================================
const D5_NAZWY = ['DBR77 Transformation Program', 'DBR77 Demo — All Modules', 'Automated Changeover Optimization'];

async function mierzD5(c) {
  const wyniki = [];
  for (const nazwa of D5_NAZWY) {
    const projekty = await c.query('select id, name, organization_id, created_at from projects where name = $1 order by created_at', [nazwa]);
    for (const p of projekty.rows) {
      const ni = await c.query('select count(*)::int as n from initiatives where project_id=$1', [p.id]);
      const nt = await c.query('select count(*)::int as n from tasks where project_id=$1', [p.id]);
      wyniki.push({ ...p, initiatives: ni.rows[0].n, tasks: nt.rows[0].n });
    }
  }
  return wyniki;
}

// ============================================================================
// D6 — ślad sondy w kanonie runtime-v1 (organizacja Northwind)
// ============================================================================
const D6_INITIATIVE_ID = process.env.D6_INITIATIVE_ID || 'initiative-w1a-probe-1789040489735';
const D6_PROPOSAL_ID = process.env.D6_PROPOSAL_ID || 'proposal-w1a-probe-1789040489735';

async function mierzD6(c) {
  const out = {};
  out.ie_aggregate_relations = (await c.query(`select * from ie_aggregate_relations where target_id = $1 or source_id ilike '%w1a-probe%'`, [D6_INITIATIVE_ID])).rows;
  out.ie_aggregate_state = (await c.query('select * from ie_aggregate_state where aggregate_id = ANY($1)', [[D6_INITIATIVE_ID, D6_PROPOSAL_ID]])).rows;
  out.ie_audit_events = (await c.query('select * from ie_audit_events where aggregate_id = ANY($1)', [[D6_INITIATIVE_ID, D6_PROPOSAL_ID]])).rows;
  out.ie_command_receipts = (await c.query('select * from ie_command_receipts where aggregate_id = ANY($1)', [[D6_INITIATIVE_ID, D6_PROPOSAL_ID]])).rows;
  out.ie_outbox_events = (await c.query('select * from ie_outbox_events where aggregate_id = ANY($1)', [[D6_INITIATIVE_ID, D6_PROPOSAL_ID]])).rows;
  out.initiative_candidates = (await c.query('select * from initiative_candidates where id = $1', [D6_PROPOSAL_ID])).rows;
  out.initiatives_kanon_stary = (await c.query('select id from initiatives where id = $1', [D6_INITIATIVE_ID])).rows;
  return out;
}

async function applyD6(c, apply) {
  const przed = await mierzD6(c);
  const orgSprawdz = (rows) => rows.every((r) => !r.organization_id || r.organization_id === NORTHWIND_ORG);
  for (const [tabela, rows] of Object.entries(przed)) {
    if (tabela === 'initiatives_kanon_stary') continue;
    if (!orgSprawdz(rows)) throw new Error(`D6: wiersz spoza Northwind w ${tabela} — STOP.`);
  }
  if (przed.initiatives_kanon_stary.length > 0) {
    throw new Error('D6: initiatives ma wiersz z tym id — niespodziewane, STOP (plan zakładał 0).');
  }
  const plan = [];
  const kolejnoscKasowania = [
    ['ie_aggregate_relations', null],
    ['ie_audit_events', null],
    ['ie_command_receipts', null],
    ['ie_outbox_events', null],
    ['ie_aggregate_state', null],
    ['initiative_candidates', null],
  ];
  for (const [tabela] of kolejnoscKasowania) {
    const n = przed[tabela].length;
    if (n === 0) continue;
    plan.push(`${tabela}: usuń ${n} wiersz(y)`);
    if (apply) {
      let res;
      if (tabela === 'ie_aggregate_relations') {
        res = await c.query(`DELETE FROM ie_aggregate_relations WHERE target_id = $1 OR source_id ilike '%w1a-probe%'`, [D6_INITIATIVE_ID]);
      } else if (tabela === 'initiative_candidates') {
        res = await c.query('DELETE FROM initiative_candidates WHERE id = $1', [D6_PROPOSAL_ID]);
      } else {
        res = await c.query(`DELETE FROM ${tabela} WHERE aggregate_id = ANY($1)`, [[D6_INITIATIVE_ID, D6_PROPOSAL_ID]]);
      }
      if (res.rowCount !== n) throw new Error(`D6: ${tabela} — usunięto ${res.rowCount}, oczekiwano ${n} — ROLLBACK.`);
    }
  }
  const po = apply ? await mierzD6(c) : null;
  return { przed, plan, po };
}

// ============================================================================
// CSV helper (PRZED/PO)
// ============================================================================
function piszCsv(nazwaPliku, naglowki, wiersze) {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linie = [naglowki.join(','), ...wiersze.map((w) => naglowki.map((h) => esc(w[h])).join(','))];
  const sciezka = path.join(KATALOG_DOWODOW, nazwaPliku);
  fs.writeFileSync(sciezka, linie.join('\n') + '\n', 'utf8');
  return sciezka;
}

// ============================================================================
// CSV PRZED/PO — spłaszczenie raportu do jednego arkusza na operację
// ============================================================================
function wierszePrzedPo(op, raport) {
  const w = [];
  const push = (element, pole, przed, po) => w.push({ op, element, pole, przed, po });

  if (raport.d1) {
    const { przed, po } = raport.d1;
    push('initiatives.' + D1_INITIATIVE_ID, 'archived', przed.initiative?.archived, po?.initiative?.archived ?? '');
    push('initiatives.' + D1_INITIATIVE_ID, 'archived_at', przed.initiative?.archived_at, po?.initiative?.archived_at ?? '');
    push('rvn_roi_cases.' + D1_ROI_CASE_ID, 'archived_at', przed.roiCase?.archived_at, po?.roiCase?.archived_at ?? '');
  }
  if (raport.d2) {
    const { przed, po } = raport.d2;
    push('decisions.' + D2_DECISION_ID, 'status', przed?.status, po?.status ?? '');
  }
  if (raport.d3) {
    for (const item of raport.d3.plan) {
      if (item.nowa !== undefined) push(`${item.tabela}.${item.id}`, item.kolumna, item.stara, item.nowa);
    }
  }
  if (raport.d4) {
    const { przed, po } = raport.d4;
    for (const iid of D4_INITIATIVE_IDS) {
      const pRow = przed.initiatives.find((i) => i.id === iid);
      const poRow = po?.initiatives.find((i) => i.id === iid);
      push('initiatives.' + iid, 'archived', pRow?.archived, poRow?.archived ?? '');
    }
    for (const row of przed.raid) {
      const poRow = po?.raid.find((r) => r.id === row.id);
      push('raid_items.' + row.id, 'status', row.status, poRow?.status ?? '');
    }
    for (const row of przed.tasks) {
      const poRow = po?.tasks.find((r) => r.id === row.id);
      push('tasks.' + row.id, 'status', row.status, poRow?.status ?? '');
    }
    push('decisions.' + D2_DECISION_ID, 'status (zależność Fork)', przed.decyzjaForkaZaleznosc?.status, po?.decyzjaForkaZaleznosc?.status ?? '');
  }
  if (raport.d5) {
    for (const p of raport.d5) push('projects.' + p.id, 'pomiar', `${p.name}|ini=${p.initiatives}|task=${p.tasks}|created=${p.created_at}`, '(tylko pomiar — decyzja właściciela)');
  }
  if (raport.d6) {
    const { przed, po } = raport.d6;
    for (const [tabela, rows] of Object.entries(przed)) {
      for (const row of rows) {
        const pk = row.id ?? row.case_id ?? row.aggregate_id ?? JSON.stringify(row).slice(0, 40);
        const nadalIstnieje = po ? (po[tabela] ?? []).some((r) => JSON.stringify(r) === JSON.stringify(row)) : '';
        push(`${tabela}.${pk}`, 'istnieje', 'TAK', po ? (nadalIstnieje ? 'TAK' : 'NIE (usunięto)') : '');
      }
    }
  }
  return w;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  const argi = process.argv.slice(2);
  const op = (argi.find((a) => a.startsWith('--op=')) ?? '--op=').slice(5);
  const apply = argi.includes('--apply');
  const dryRun = argi.includes('--dry-run') || !apply;

  if (!process.env.DATABASE_URL) throw new Error('Brak DATABASE_URL.');
  sprawdzHost(process.env.DATABASE_URL);
  if (apply && process.env.FORCE_E4 !== 'true') {
    throw new Error('--apply wymaga FORCE_E4=true.');
  }
  if (!op) throw new Error('Podaj --op=d1|d2|d3|d4|d5|d6|all');

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const c = await pool.connect();
  const raport = { op, tryb: apply ? 'APPLY' : 'DRY-RUN', czas: new Date().toISOString() };
  try {
    await c.query('BEGIN');
    const zestaw = op === 'all' ? ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] : [op];
    for (const o of zestaw) {
      if (o === 'd1') raport.d1 = await applyD1(c, apply);
      else if (o === 'd2') raport.d2 = await applyD2(c, apply);
      else if (o === 'd3') raport.d3 = await applyD3(c, apply);
      else if (o === 'd4') raport.d4 = await applyD4(c, apply);
      else if (o === 'd5') raport.d5 = await mierzD5(c);
      else if (o === 'd6') raport.d6 = await applyD6(c, apply);
      else throw new Error(`Nieznana operacja: ${o}`);
    }
    if (apply) await c.query('COMMIT');
    else await c.query('ROLLBACK');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('BŁĄD — ROLLBACK:', e.message);
    process.exitCode = 1;
    raport.blad = e.message;
  } finally {
    c.release();
    await pool.end();
  }

  const manifest = zapiszManifest(op + (apply ? '-apply' : '-dryrun'), raport);
  const wiersze = wierszePrzedPo(op, raport);
  const csvPlik = piszCsv(
    `${op}-${apply ? 'PO' : 'PRZED'}-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`,
    ['op', 'element', 'pole', 'przed', 'po'],
    wiersze
  );
  console.log(`[e4-dane] op=${op} tryb=${raport.tryb} manifest=${manifest} csv=${csvPlik}`);
  console.log(JSON.stringify(raport, (k, v) => (k === 'stara' || k === 'nowa' ? (typeof v === 'string' ? v.slice(0, 80) : v) : v), 2));
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

export { mierzD1, mierzD2, mierzD3, mierzD4, mierzD5, mierzD6, decodeHtmlEntities, piszCsv };
