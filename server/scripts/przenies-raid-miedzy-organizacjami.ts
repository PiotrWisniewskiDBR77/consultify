#!/usr/bin/env tsx
/**
 * Przeniesienie pozycji rejestru RAID (`raid_items`) z jednej organizacji do
 * drugiej — DEC-448 („dwie organizacje DBR77 na stagingu: jedna organizacja,
 * jeden zestaw danych").
 *
 * KLUCZOWA WŁAŚCIWOŚĆ: skrypt NIE przenosi na ślepo. Przed zapisem liczy
 * OSIEROCENIA — powiązania, które po zmianie `organization_id` wskazywałyby
 * poza organizację docelową:
 *
 *   1. `initiative_id` → inicjatywa zostaje w organizacji źródłowej. Wiersz RAID
 *      byłby wtedy w organizacji A, a jego inicjatywa w organizacji B. Zapytania
 *      produktu filtrujące po organizacji (np. `raid.routes.ts`:
 *      `initiative_id IN (SELECT id FROM initiatives WHERE project_id=? AND
 *      organization_id=?)`) przestają widzieć takie wiersze, a `LEFT JOIN
 *      initiatives` w `ExecutionController` pokazuje nazwę inicjatywy, której
 *      użytkownik nie może otworzyć (widok inicjatywy filtruje po organizacji).
 *   2. `owner_id` / `mitigation_owner_id` → użytkownik nie należy do organizacji
 *      docelowej (`users.organization_id` ≠ docelowa ORAZ brak wiersza
 *      w `organization_members`). Właściciel ryzyka byłby wtedy „spoza
 *      organizacji" — dokładnie problem 4 z `napraw-jezyk-i-czlonkostwo.ts`,
 *      tylko wprowadzony przez nas.
 *
 * Gdy osierocenia > 0, `--apply` jest ODMAWIANE. Nie ma flagi obchodzącej tę
 * odmowę: decyzja właściciela dotyczyła przeniesienia RAID, nie zepsucia
 * powiązań. Rozwiązaniem jest rozszerzenie zakresu przeniesienia (inicjatywy
 * i/lub członkostwa) osobną, świadomą decyzją — wtedy ten skrypt dostanie nowy
 * tryb, a nie obejście.
 *
 * Wzorzec 1:1 z `server/scripts/napraw-jezyk-i-czlonkostwo.ts`:
 * tryb próbny domyślny, CSV kopii + manifest cofnięcia PRZED zapisem, drugi
 * `--apply` musi wypisać 0, obie organizacje podawane JAWNIE i rozwiązywane
 * przez `resolveOrg` (odmawia, gdy organizacji nie ma w bazie, do której skrypt
 * się połączył).
 *
 * UŻYCIE (z korzenia repo):
 *   DATABASE_URL="…" npx tsx server/scripts/przenies-raid-miedzy-organizacjami.ts \
 *     --z-org=<uuid|nazwa> --do-org=<uuid|nazwa> --dry-run
 *   DATABASE_URL="…" npx tsx server/scripts/przenies-raid-miedzy-organizacjami.ts \
 *     --z-org=… --do-org=… --apply
 *   DATABASE_URL="…" npx tsx server/scripts/przenies-raid-miedzy-organizacjami.ts \
 *     --z-org=… --do-org=… --rollback=evidence/porzadki-org/przenies-raid-…-manifest.json
 */
import '../src/config/loadEnv.js';

import fs from 'node:fs';
import path from 'node:path';
import type { PoolClient } from 'pg';

import {
  qi,
  pool,
  resolveOrg,
  readManifest,
  restore,
  csvCell,
  REPO_ROOT,
  iso,
  type Manifest,
  type ManifestEntry,
} from './higiena-wlasciciela/wspolne.js';

const SKRYPT = 'przenies-raid-miedzy-organizacjami';
/** Katalog dowodów tego zlecenia — świadomie inny niż `evidence/higiena-danych`. */
const KATALOG_DOWODOW = path.join(REPO_ROOT, 'evidence', 'porzadki-org');

type Tryb = { rodzaj: 'dry-run' | 'apply' | 'rollback'; manifest?: string };

interface Cli {
  zOrg: string;
  doOrg: string;
  tryb: Tryb;
}

export function parseCliPrzeniesienia(argv = process.argv.slice(2)): Cli {
  const zOrg = argv.find((x) => x.startsWith('--z-org='))?.slice('--z-org='.length);
  const doOrg = argv.find((x) => x.startsWith('--do-org='))?.slice('--do-org='.length);
  const rollback = argv.find((x) => x.startsWith('--rollback='))?.slice('--rollback='.length);
  const wybrane =
    Number(argv.includes('--dry-run')) + Number(argv.includes('--apply')) + Number(Boolean(rollback));
  if (!zOrg || !doOrg || wybrane !== 1) {
    throw new Error(
      'Użycie: --z-org=<nazwa|uuid> --do-org=<nazwa|uuid> oraz dokładnie jedno: --dry-run | --apply | --rollback=<manifest.json>'
    );
  }
  if (zOrg === doOrg) throw new Error('--z-org i --do-org są identyczne — nie ma czego przenosić');
  return {
    zOrg,
    doOrg,
    tryb: rollback
      ? { rodzaj: 'rollback', manifest: rollback }
      : { rodzaj: argv.includes('--apply') ? 'apply' : 'dry-run' },
  };
}

function zapiszDowod(nazwa: string, tresc: string): string {
  fs.mkdirSync(KATALOG_DOWODOW, { recursive: true });
  const sciezka = path.join(KATALOG_DOWODOW, nazwa);
  fs.writeFileSync(sciezka, tresc);
  return sciezka;
}

interface WierszRaid {
  id: string;
  type: string;
  title: string;
  status: string | null;
  owner_id: string | null;
  mitigation_owner_id: string | null;
  initiative_id: string | null;
}

interface Osierocenie {
  raidId: string;
  tytul: string;
  rodzaj: 'INICJATYWA' | 'WLASCICIEL' | 'WLASCICIEL_MITYGACJI';
  wskazuje: string;
  szczegol: string;
}

/** Czy użytkownik należy do organizacji docelowej — po `users.organization_id` LUB `organization_members`. */
async function nalezyDoOrganizacji(c: PoolClient, userId: string, orgId: string): Promise<string | null> {
  const u = await c.query<{ organization_id: string | null; email: string | null }>(
    'SELECT organization_id, email FROM users WHERE id = $1',
    [userId]
  );
  if (u.rows.length === 0) return 'użytkownik nie istnieje w tabeli users';
  const wiersz = u.rows[0]!;
  if (String(wiersz.organization_id ?? '') === orgId) return null;
  const m = await c.query<{ n: string }>(
    'SELECT count(*)::text AS n FROM organization_members WHERE user_id = $1 AND organization_id::text = $2',
    [userId, orgId]
  );
  if (Number(m.rows[0]?.n ?? '0') > 0) return null;
  return `${wiersz.email ?? userId} ma users.organization_id=${wiersz.organization_id ?? 'NULL'} i brak wiersza w organization_members`;
}

async function zbadajOsierocenia(
  c: PoolClient,
  wiersze: WierszRaid[],
  docelowa: string
): Promise<Osierocenie[]> {
  const wynik: Osierocenie[] = [];
  for (const r of wiersze) {
    if (r.initiative_id) {
      const i = await c.query<{ organization_id: string | null; name: string | null }>(
        'SELECT organization_id, name FROM initiatives WHERE id = $1',
        [r.initiative_id]
      );
      if (i.rows.length === 0) {
        wynik.push({
          raidId: r.id,
          tytul: r.title,
          rodzaj: 'INICJATYWA',
          wskazuje: r.initiative_id,
          szczegol: 'inicjatywa nie istnieje',
        });
      } else if (String(i.rows[0]!.organization_id ?? '') !== docelowa) {
        wynik.push({
          raidId: r.id,
          tytul: r.title,
          rodzaj: 'INICJATYWA',
          wskazuje: r.initiative_id,
          szczegol: `"${i.rows[0]!.name ?? ''}" zostaje w organization_id=${i.rows[0]!.organization_id ?? 'NULL'}`,
        });
      }
    }
    for (const [pole, rodzaj] of [
      ['owner_id', 'WLASCICIEL'],
      ['mitigation_owner_id', 'WLASCICIEL_MITYGACJI'],
    ] as const) {
      const wartosc = r[pole];
      if (!wartosc) continue;
      const powod = await nalezyDoOrganizacji(c, wartosc, docelowa);
      if (powod) {
        wynik.push({ raidId: r.id, tytul: r.title, rodzaj, wskazuje: wartosc, szczegol: powod });
      }
    }
  }
  return wynik;
}

/**
 * Rozwiązanie organizacji z DOKŁADNYM dopasowaniem po `id` w pierwszej
 * kolejności. Powód (zmierzony na stagingu 07.09): `resolveOrg` ze `wspolne.ts`
 * dopasowuje `id = $1 OR name ILIKE '%$1%'` i dla identyfikatora `dbr77`
 * zwraca 2 wiersze („DBR77" i „DBR77 Digital Consulting"), więc rzuca wyjątek
 * mimo że identyfikator jest jednoznaczny. Zachowana zostaje właściwość
 * wymagana przez zlecenie: organizacja nieistniejąca w bazie, do której skrypt
 * się połączył, kończy pracę błędem.
 */
async function rozwiazOrganizacje(c: PoolClient, needle: string) {
  const dokladny = await c.query<{ id: string; name: string }>(
    'SELECT id, name FROM organizations WHERE id::text = $1',
    [needle]
  );
  if (dokladny.rows.length === 1) return dokladny.rows[0]!;
  return resolveOrg(c, needle);
}

async function policzRaid(c: PoolClient, orgId: string): Promise<number> {
  const r = await c.query<{ n: string }>(
    'SELECT count(*)::text AS n FROM raid_items WHERE organization_id::text = $1',
    [orgId]
  );
  return Number(r.rows[0]?.n ?? '0');
}

async function main(): Promise<void> {
  const cli = parseCliPrzeniesienia();
  const p = pool();
  const c = await p.connect();
  try {
    // resolveOrg rzuca wyjątek, gdy organizacji nie ma w TEJ bazie — to jest
    // wymagana odmowa uruchomienia przy nieistniejącym identyfikatorze.
    const zrodlo = await rozwiazOrganizacje(c, cli.zOrg);
    const cel = await rozwiazOrganizacje(c, cli.doOrg);
    if (zrodlo.id === cel.id) throw new Error('--z-org i --do-org wskazują tę samą organizację');

    console.log(`${SKRYPT} · ${zrodlo.name} (${zrodlo.id}) → ${cel.name} (${cel.id}) · ${cli.tryb.rodzaj}`);

    if (cli.tryb.rodzaj === 'rollback') {
      const manifest = readManifest(cli.tryb.manifest!, SKRYPT);
      const cofniete = await restore(c, manifest);
      console.log(`COFNIĘTE: ${cofniete} (manifest: ${cli.tryb.manifest})`);
      return;
    }

    const przedZrodlo = await policzRaid(c, zrodlo.id);
    const przedCel = await policzRaid(c, cel.id);
    console.log(`PRZED · RAID w ${zrodlo.name}: ${przedZrodlo} · RAID w ${cel.name}: ${przedCel}`);

    const kandydaci = (
      await c.query<WierszRaid>(
        `SELECT id, type, title, status, owner_id, mitigation_owner_id, initiative_id
           FROM raid_items WHERE organization_id::text = $1 ORDER BY created_at`,
        [zrodlo.id]
      )
    ).rows;

    if (kandydaci.length === 0) {
      console.log('DO PRZENIESIENIA: 0 — nic do zrobienia.');
      return;
    }

    const osierocenia = await zbadajOsierocenia(c, kandydaci, cel.id);

    const planCsv = zapiszDowod(
      `${SKRYPT}-${iso()}-plan.csv`,
      'tabela,id,typ,tytul,organization_id_przed,organization_id_po\n' +
        kandydaci
          .map((r) =>
            ['raid_items', r.id, r.type, r.title, zrodlo.id, cel.id].map(csvCell).join(',')
          )
          .join('\n') +
        '\n'
    );
    console.log(`PLAN CSV (${kandydaci.length} wierszy): ${planCsv}`);

    if (osierocenia.length > 0) {
      const osCsv = zapiszDowod(
        `${SKRYPT}-${iso()}-osierocenia.csv`,
        'raid_id,tytul,rodzaj,wskazuje_na,szczegol\n' +
          osierocenia
            .map((o) => [o.raidId, o.tytul, o.rodzaj, o.wskazuje, o.szczegol].map(csvCell).join(','))
            .join('\n') +
          '\n'
      );
      console.log('');
      console.log(`OSIEROCENIA: ${osierocenia.length} (CSV: ${osCsv})`);
      for (const o of osierocenia) {
        console.log(`  ${o.rodzaj} · ${o.raidId} "${o.tytul}" → ${o.wskazuje} · ${o.szczegol}`);
      }
      console.log('');
      console.log(
        'STOP: przeniesienie osieroci powyższe powiązania. --apply jest ODMAWIANE. ' +
          'Rozszerz zakres decyzji (inicjatywy / członkostwa) zamiast obchodzić tę bramkę.'
      );
      process.exitCode = 3;
      return;
    }

    if (cli.tryb.rodzaj !== 'apply') {
      console.log(`DRY-RUN: nic nie zostało zmienione. DO PRZENIESIENIA: ${kandydaci.length}`);
      return;
    }

    // Kopia bezpieczeństwa PRZED zapisem: pełne wiersze + manifest cofnięcia.
    const pelne = (
      await c.query<Record<string, unknown>>(
        `SELECT * FROM raid_items WHERE organization_id::text = $1 ORDER BY created_at`,
        [zrodlo.id]
      )
    ).rows;
    const kopiaCsv = zapiszDowod(
      `${SKRYPT}-${iso()}-kopia-raid_items.csv`,
      'snapshot_json\n' + pelne.map((r) => csvCell(JSON.stringify(r))).join('\n') + '\n'
    );
    const wpisy: ManifestEntry[] = pelne.map((r) => ({
      table: 'raid_items',
      idColumn: 'id',
      id: String(r.id),
      action: 'archive',
      before: r,
      backupCsv: kopiaCsv,
    }));
    const manifest: Manifest = {
      version: 1,
      script: SKRYPT,
      organizationId: zrodlo.id,
      organizationName: zrodlo.name,
      createdAt: new Date().toISOString(),
      entries: wpisy,
    };
    const sciezkaManifestu = zapiszDowod(
      `${SKRYPT}-${iso()}-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n'
    );
    console.log(`Kopia CSV: ${kopiaCsv}`);
    console.log(`Manifest cofnięcia: ${sciezkaManifestu}`);

    const zmiana = await c.query(
      `UPDATE ${qi('raid_items')} SET organization_id = $1, updated_at = now() WHERE organization_id::text = $2`,
      [cel.id, zrodlo.id]
    );
    const poZrodlo = await policzRaid(c, zrodlo.id);
    const poCel = await policzRaid(c, cel.id);
    console.log(`PRZENIESIONE: ${zmiana.rowCount ?? 0}`);
    console.log(`PO · RAID w ${zrodlo.name}: ${poZrodlo} · RAID w ${cel.name}: ${poCel}`);
    console.log('Uruchom ten sam --apply drugi raz — musi wypisać DO PRZENIESIENIA: 0.');
  } finally {
    c.release();
    await p.end();
  }
}

const uruchomionyWprost =
  typeof process.argv[1] === 'string' && process.argv[1].includes('przenies-raid-miedzy-organizacjami');
if (uruchomionyWprost) {
  main().catch((błąd) => {
    console.error(String(błąd instanceof Error ? błąd.message : błąd));
    process.exit(1);
  });
}
