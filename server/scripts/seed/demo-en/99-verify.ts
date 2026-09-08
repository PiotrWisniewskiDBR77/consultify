#!/usr/bin/env tsx
/**
 * D1 — VERIFY — asercje twarde ("== N", nie ">= N") dla organizacji `northwind`
 * po `01-rdzen.ts --apply` (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D1).
 *
 * UŻYCIE
 *   DATABASE_URL=… npx tsx server/scripts/seed/demo-en/99-verify.ts --oczekiwany-host 54418 --verify
 *
 * Po `01-rdzen.ts --reset` to samo polecenie musi zwrócić WSZYSTKIE liczby = 0.
 */
import { ORG_ID, ORG_NAZWA, czytajWspolneArgumenty, otworzPool, sprawdzCel, wymaganyUrl } from './00-wspolne';

type Asercja = { nazwa: string; oczekiwane: number; rzeczywiste: number };

async function main() {
  const opcje = czytajWspolneArgumenty(process.argv.slice(2));
  if (opcje.tryb !== 'verify') throw new Error('99-verify.ts obsługuje wyłącznie --verify.');

  const url = wymaganyUrl();
  const toz = sprawdzCel(url, opcje.oczekiwanyHost, opcje.celZdalny);
  const pool = otworzPool(url);
  const c = await pool.connect();

  try {
    console.log(`[verify] cel: ${toz}`);

    const orgIstnieje = await c.query('SELECT 1 FROM organizations WHERE id = $1', [ORG_ID]);
    const orgLiczba = orgIstnieje.rows.length;

    const uzytkownicy = await c.query('SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1', [ORG_ID]);
    const czlonkostwaAktywne = await c.query(
      "SELECT COUNT(*)::int AS n FROM organization_members WHERE organization_id = $1 AND status = 'ACTIVE'",
      [ORG_ID]
    );
    const zespoly = await c.query('SELECT COUNT(*)::int AS n FROM teams WHERE organization_id = $1', [ORG_ID]);
    const projekty = await c.query('SELECT COUNT(*)::int AS n FROM projects WHERE organization_id = $1', [ORG_ID]);
    const profil = await c.query('SELECT COUNT(*)::int AS n FROM organization_profiles WHERE organization_id = $1', [ORG_ID]);
    const wlasciciele = await c.query(
      "SELECT COUNT(*)::int AS n FROM organization_members WHERE organization_id = $1 AND role = 'OWNER' AND status = 'ACTIVE'",
      [ORG_ID]
    );
    const admini = await c.query(
      "SELECT COUNT(*)::int AS n FROM organization_members WHERE organization_id = $1 AND role = 'ADMIN' AND status = 'ACTIVE'",
      [ORG_ID]
    );
    const czlonkowie = await c.query(
      "SELECT COUNT(*)::int AS n FROM organization_members WHERE organization_id = $1 AND role = 'MEMBER' AND status = 'ACTIVE'",
      [ORG_ID]
    );
    const rolaWStanowisku = await c.query(
      `SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND role NOT IN ('OWNER','ADMIN','MEMBER','CONSULTANT','USER','GUEST','SUPERADMIN')`,
      [ORG_ID]
    );

    if (orgLiczba === 0) {
      // Stan po --reset: wszystko musi być zerem.
      const zestaw: Asercja[] = [
        { nazwa: 'organizacje (id=northwind)', oczekiwane: 0, rzeczywiste: orgLiczba },
        { nazwa: 'użytkownicy', oczekiwane: 0, rzeczywiste: uzytkownicy.rows[0].n },
        { nazwa: 'członkostwa ACTIVE', oczekiwane: 0, rzeczywiste: czlonkostwaAktywne.rows[0].n },
        { nazwa: 'zespoły', oczekiwane: 0, rzeczywiste: zespoly.rows[0].n },
        { nazwa: 'projekty', oczekiwane: 0, rzeczywiste: projekty.rows[0].n },
        { nazwa: 'profile organizacji', oczekiwane: 0, rzeczywiste: profil.rows[0].n },
      ];
      wypiszIZakoncz(zestaw);
      return;
    }

    const zestaw: Asercja[] = [
      { nazwa: 'organizacje (id=northwind)', oczekiwane: 1, rzeczywiste: orgLiczba },
      { nazwa: 'użytkownicy', oczekiwane: 9, rzeczywiste: uzytkownicy.rows[0].n },
      { nazwa: 'członkostwa ACTIVE', oczekiwane: 9, rzeczywiste: czlonkostwaAktywne.rows[0].n },
      { nazwa: 'zespoły', oczekiwane: 2, rzeczywiste: zespoly.rows[0].n },
      { nazwa: 'projekty', oczekiwane: 2, rzeczywiste: projekty.rows[0].n },
      { nazwa: 'profile organizacji', oczekiwane: 1, rzeczywiste: profil.rows[0].n },
      { nazwa: 'członkostwa OWNER', oczekiwane: 1, rzeczywiste: wlasciciele.rows[0].n },
      { nazwa: 'członkostwa ADMIN', oczekiwane: 2, rzeczywiste: admini.rows[0].n },
      { nazwa: 'członkostwa MEMBER', oczekiwane: 6, rzeczywiste: czlonkowie.rows[0].n },
      { nazwa: 'users.role spoza słownika (stanowisko wpisane jako rola)', oczekiwane: 0, rzeczywiste: rolaWStanowisku.rows[0].n },
    ];

    // Asercja obciążenia: suma alokacji na osobę (allocation_percent% z weekly_capacity_hours,
    // po jednym zespole na osobę w tym seedzie) nie może przekroczyć jej weekly_capacity_hours.
    const obciazenie = await c.query<{ email: string; weekly_capacity_hours: string; suma_godzin: string }>(
      `SELECT u.email, u.weekly_capacity_hours,
              COALESCE(SUM(u.weekly_capacity_hours * tm.allocation_percent / 100.0), 0) AS suma_godzin
       FROM users u
       LEFT JOIN team_members tm ON tm.user_id = u.id
       WHERE u.organization_id = $1
       GROUP BY u.email, u.weekly_capacity_hours`,
      [ORG_ID]
    );
    const przeciazeni = obciazenie.rows.filter((r) => Number(r.suma_godzin) > Number(r.weekly_capacity_hours) + 0.001);
    zestaw.push({ nazwa: 'osoby przeciążone (alokacja > weekly_capacity_hours)', oczekiwane: 0, rzeczywiste: przeciazeni.length });
    if (przeciazeni.length > 0) {
      console.error('[verify] przeciążeni:', przeciazeni.map((r) => `${r.email} (${r.suma_godzin}/${r.weekly_capacity_hours})`).join(', '));
    }

    // Asercja EN: żadna osoba language != 'en', żaden e-mail spoza domeny northwind.example.
    const nieAngielskiJezyk = await c.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND (language IS DISTINCT FROM 'en')",
      [ORG_ID]
    );
    zestaw.push({ nazwa: 'użytkownicy z language != en', oczekiwane: 0, rzeczywiste: nieAngielskiJezyk.rows[0].n });

    const spozaDomeny = await c.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND email NOT LIKE '%@northwind.example'",
      [ORG_ID]
    );
    zestaw.push({ nazwa: 'użytkownicy spoza domeny @northwind.example', oczekiwane: 0, rzeczywiste: spozaDomeny.rows[0].n });

    // Asercja V8: bez ani jednej WŁĄCZONEJ flagi organizacji cała powierzchnia
    // `/api/v8/*` zwraca 404 V8_ORG_DISABLED na NODE_ENV=production (staging,
    // demo) — `v8FeatureGate.middleware.ts:7`. Na NODE_ENV=development brak
    // wierszy jest CICHO przepuszczany, więc ta asercja jest jedynym miejscem,
    // które łapie różnicę między stanowiskiem lokalnym a stagingiem.
    const schematV8 = await c.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'v8' AND table_name = 'v8_feature_flags'"
    );
    const tabelaFlag = Number(schematV8.rows[0]?.n ?? 0) > 0 ? 'v8.v8_feature_flags' : 'v8_feature_flags';
    const flagiWlaczone = await c.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${tabelaFlag} WHERE organization_id = $1 AND enabled = 1`,
      [ORG_ID]
    );
    zestaw.push({ nazwa: 'flagi V8 organizacji WŁĄCZONE (bramka /api/v8 na produkcyjnym NODE_ENV)', oczekiwane: 8, rzeczywiste: flagiWlaczone.rows[0].n });
    const flagiWszystkie = await c.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM ${tabelaFlag} WHERE organization_id = $1`,
      [ORG_ID]
    );
    zestaw.push({ nazwa: 'wiersze flag V8 organizacji (łącznie z wyłączonymi)', oczekiwane: 9, rzeczywiste: flagiWszystkie.rows[0].n });

    console.log(`[verify] organizacja: ${ORG_NAZWA}`);
    wypiszIZakoncz(zestaw);
  } finally {
    c.release();
    await pool.end();
  }
}

function wypiszIZakoncz(asercje: Asercja[]): void {
  let bledy = 0;
  for (const a of asercje) {
    const ok = a.oczekiwane === a.rzeczywiste;
    if (!ok) bledy++;
    console.log(`[verify] ${ok ? 'OK  ' : 'FAIL'} ${a.nazwa.padEnd(55)} oczekiwane=${a.oczekiwane} rzeczywiste=${a.rzeczywiste}`);
  }
  if (bledy > 0) {
    console.error(`\n[verify] FAIL: ${bledy} asercji nie przeszło.`);
    process.exitCode = 1;
  } else {
    console.log(`\n[verify] PASS: wszystkie ${asercje.length} asercji przeszły.`);
  }
}

main().catch((e) => {
  console.error(`[verify] BŁĄD: ${(e as Error).message}`);
  process.exit(1);
});
