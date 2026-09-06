/** @vitest-environment node */
/**
 * P7K część B §10 — DOWÓD MECHANIKI ODCHYLENIA na REALNEJ bazie.
 *
 * Trzy zabezpieczenia danych, każde z opisanym dowodem mutacyjnym:
 *  1. IDEMPOTENCJA — ten sam miernik + ten sam okres = JEDNA karta.
 *     Mutacja: usuń odczyt `findActionCardBySource` z
 *     `ensureActionCardForKpiDeviation` (strażnik) ⇒ drugie wywołanie wpada na
 *     ograniczenie `action_cards_source_unique` i test pada.
 *  2. W LIMICIE NIC NIE POWSTAJE — `on_target`/`warning`/`neutral` nie tworzą
 *     ani karty, ani wpisu. Mutacja: zamień warunek na
 *     `performanceStatus === 'on_target'` (albo skasuj go) ⇒ test pada.
 *  3. IZOLACJA ORGANIZACJI — karta i jej odczyt należą WYŁĄCZNIE do
 *     organizacji miernika. Mutacja: usuń `ac.organization_id = ?` z
 *     `findActionCardBySource` ⇒ organizacja B „widzi" kartę organizacji A i
 *     nie dostaje własnej ⇒ test pada.
 *
 * Uruchomienie: RUN_DB_TESTS=1 DB_TYPE=postgres DATABASE_URL=… (baza 54400).
 * Bez tych zmiennych zestaw jest POMIJANY, nie „zielony" — atrapa bazy
 * (`NODE_ENV=test` bez `RUN_DB_TESTS`) odpowiada `changes:1` na każdy zapis
 * i udowodniłaby dowolną tezę.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!enabled)('P7K część B — karta działania z odchylenia KPI (realny PG)', () => {
  const tag = randomUUID().slice(0, 8);
  const orgA = `org-a-${tag}`;
  const orgB = `org-b-${tag}`;
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const kpiId = randomUUID();
  const periodStart = '2026-03-01';
  const periodEnd = '2026-03-31';

  let pool: Pool;
  let mod: typeof import('../kpiDeviationActionCard.js');
  let service: typeof import('../actionCardService.js');

  const base = {
    kpiId,
    kpiName: 'WIELKOŚĆ SPRZEDAŻY NETTO',
    unit: 'tys. PLN',
    periodStart,
    periodEnd,
    actualValue: 5000,
    targetValue: 6474,
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const [org, owner, nazwisko] of [
      [orgA, ownerA, 'Kowalska'],
      [orgB, ownerB, 'Nowak'],
    ] as const) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,
        [org, `P7K ${org}`]
      );
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status)
         VALUES($1,$2,$3,'unused','Test',$4,'OWNER','active')`,
        [owner, org, `${owner}@p7kb.local`, nazwisko]
      );
    }
    mod = await import('../kpiDeviationActionCard.js');
    service = await import('../actionCardService.js');
  });

  afterAll(async () => {
    for (const org of [orgA, orgB]) {
      await pool.query(`DELETE FROM action_cards WHERE organization_id=$1`, [org]);
      await pool.query(`DELETE FROM notifications WHERE organization_id=$1`, [org]).catch(() => undefined);
      await pool.query(`DELETE FROM users WHERE organization_id=$1`, [org]);
      await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]);
    }
    await pool.end();
  });

  const licznik = async (org: string) => {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM action_cards WHERE organization_id=$1`,
      [org]
    );
    return Number(rows[0].n);
  };

  it('rezultat poza limitem tworzy DOKŁADNIE JEDNĄ kartę, także przy drugim zapisie tego samego okresu', async () => {
    const wejscie = {
      ...base,
      organizationId: orgA,
      actorUserId: ownerA,
      performanceStatus: 'critical',
      kpiOwnerUserId: ownerA,
    };

    const pierwsze = await mod.ensureActionCardForKpiDeviation(wejscie);
    expect(pierwsze.created).toBe(true);
    expect(pierwsze.card?.status).toBe('OPEN');
    expect(pierwsze.card?.problem).toContain('Odchylenie: WIELKOŚĆ SPRZEDAŻY NETTO 03.2026');
    // §2.4: odpowiedzialność to NAZWISKO, nigdy identyfikator.
    expect(pierwsze.card?.ownerName).toBe('Test Kowalska');
    expect(pierwsze.card?.dueDate).toBe('2026-04-14');

    // Powtórzony zapis rezultatu tego samego okresu — STRAŻNIK IDEMPOTENCJI.
    const drugie = await mod.ensureActionCardForKpiDeviation({ ...wejscie, actualValue: 4800 });
    expect(drugie.created).toBe(false);
    expect(drugie.reason).toBe('already_open');
    expect(drugie.card?.id).toBe(pierwsze.card?.id);

    expect(await licznik(orgA)).toBe(1);
  });

  it('rezultat W LIMICIE nie tworzy ani karty, ani wpisu', async () => {
    const przed = await licznik(orgA);
    for (const status of ['on_target', 'warning', 'neutral', null]) {
      const wynik = await mod.ensureActionCardForKpiDeviation({
        ...base,
        kpiId: randomUUID(),
        organizationId: orgA,
        actorUserId: ownerA,
        actualValue: 7000,
        performanceStatus: status,
        kpiOwnerUserId: ownerA,
      });
      expect(wynik.created).toBe(false);
      expect(wynik.reason).toBe('within_limits');
      expect(wynik.card).toBeNull();
    }
    expect(await licznik(orgA)).toBe(przed);
  });

  it('karta należy WYŁĄCZNIE do organizacji miernika — obca organizacja jej nie widzi i dostaje własną', async () => {
    const sourceId = mod.buildKpiDeviationSourceId(kpiId, periodStart, periodEnd);

    // Obca organizacja nie widzi karty A ani przez odczyt źródła…
    const obcyOdczyt = await service.findActionCardBySource(
      { organizationId: orgB, actorUserId: ownerB },
      'kpi_deviation',
      sourceId
    );
    expect(obcyOdczyt).toBeNull();

    // …ani przez listę.
    const listaB = await service.listActionCards({ organizationId: orgB, actorUserId: ownerB });
    expect(listaB.map((c) => c.organizationId)).not.toContain(orgA);

    // I nie jest przez kartę A blokowana: dostaje SWOJĄ kartę na ten sam miernik.
    const wynikB = await mod.ensureActionCardForKpiDeviation({
      ...base,
      organizationId: orgB,
      actorUserId: ownerB,
      performanceStatus: 'critical',
      kpiOwnerUserId: ownerB,
    });
    expect(wynikB.created).toBe(true);
    expect(wynikB.card?.organizationId).toBe(orgB);
    expect(wynikB.card?.ownerName).toBe('Test Nowak');

    expect(await licznik(orgA)).toBe(1);
    expect(await licznik(orgB)).toBe(1);

    // Właściciel A dalej widzi TYLKO swoją.
    const listaA = await service.listActionCards({ organizationId: orgA, actorUserId: ownerA });
    expect(listaA).toHaveLength(1);
    expect(listaA[0].organizationId).toBe(orgA);
  });
});
