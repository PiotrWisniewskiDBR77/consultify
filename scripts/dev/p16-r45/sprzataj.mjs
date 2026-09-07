#!/usr/bin/env node
/**
 * SPRZATANIE po dowodzie P16/R4+R5 — dane demo sa twarza produktu.
 *
 * Usuwa WYLACZNIE rekordy probne tego kroku:
 *   · pozycje `raid_items` o tytule `proba-r45-%`,
 *   · decyzje o rodowodzie `delay_signal` (wnioski o przesuniecie utworzone
 *     przez skrypt dowodowy).
 *
 * Uzycie: node scripts/dev/p16-r45/sprzataj.mjs [--na-sucho]
 * Dziala TYLKO na kopii bazy `consultify_p16r45` (sprawdzane wprost).
 */
import { execFileSync } from 'node:child_process';

const NA_SUCHO = process.argv.includes('--na-sucho');
const BAZA = 'consultify_p16r45';

const psql = (sql) =>
  execFileSync(
    'docker',
    ['exec', 'consultify-noc-pg', 'psql', '-U', 'postgres', '-d', BAZA, '-tAc', sql],
    { encoding: 'utf8' }
  ).trim();

const nazwaBazy = psql('SELECT current_database()');
if (nazwaBazy !== BAZA) {
  console.error(`STOP: podlaczona baza to ${nazwaBazy}, a nie ${BAZA}.`);
  process.exit(1);
}

const raid = psql("SELECT count(*) FROM raid_items WHERE title LIKE 'proba-r45-%'");
const decyzje = psql("SELECT count(*) FROM decisions WHERE source_type = 'delay_signal'");
console.log(`Do usuniecia: raid_items ${raid}, decisions (delay_signal) ${decyzje}`);

if (NA_SUCHO) {
  console.log('--na-sucho: nic nie usunieto.');
  process.exit(0);
}

// Slad zdarzen kanonicznego writera znika razem z pozycja — inaczej zostalyby
// osierocone wiersze agregatu, ktore psuja CAS przy nastepnym probnym zapisie.
psql(
  "DELETE FROM ie_aggregate_state WHERE aggregate_type = 'raid_item' AND aggregate_id IN (SELECT id FROM raid_items WHERE title LIKE 'proba-r45-%')"
);
psql("DELETE FROM raid_items WHERE title LIKE 'proba-r45-%'");
psql("DELETE FROM decisions WHERE source_type = 'delay_signal'");

console.log(
  `Po sprzataniu: raid_items ${psql("SELECT count(*) FROM raid_items WHERE title LIKE 'proba-r45-%'")}, ` +
    `decisions ${psql("SELECT count(*) FROM decisions WHERE source_type = 'delay_signal'")}`
);
console.log(`Stan koncowy: raid_items ${psql('SELECT count(*) FROM raid_items')}, decisions ${psql('SELECT count(*) FROM decisions')}`);
