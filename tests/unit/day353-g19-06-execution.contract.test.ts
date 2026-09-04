// CZERWONY Z ZAŁOŻENIA — nie regresja tego dyżuru
import { expect, it } from 'vitest';

it('KONTRAKT DLA DYŻURU 353 — 06 Execution odmawia obcemu tenantowi odczytu istniejącego execution case', () => {
  expect.fail('initiativesExecutionRuntime.dropdown sprawdza tylko właściciela i tytuł; brakuje pary obcy/właściciel oraz mutacji filtra organization_id na trasie runtime execution.');
});
