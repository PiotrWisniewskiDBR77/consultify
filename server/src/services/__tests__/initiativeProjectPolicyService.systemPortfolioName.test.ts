/**
 * F9 (15.09.2026) — kontener systemowy inicjatyw: nazwa EN + klucz wyszukiwania.
 *
 * SPROSTOWANIE PREMISY, ktore ten plik utrwala: meldunek linii 6 twierdzil, ze
 * serwis szuka kontenera PO NAZWIE, wiec zmiana nazwy zrobi duplikat. Pomiar
 * mowi co innego — lookup idzie po `is_system`, strzezonym partial unique index
 * `uq_projects_org_system_portfolio`. Gdyby ktos kiedys przestawil lookup na
 * nazwe, ostatni wiersz tego pliku wywroci sie na czerwono.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  SYSTEM_PORTFOLIO_PROJECT_DESCRIPTION,
  SYSTEM_PORTFOLIO_PROJECT_LEGACY_NAMES,
  SYSTEM_PORTFOLIO_PROJECT_NAME,
} from '../initiativeProjectPolicyService.js';

const KORZEN = path.resolve(__dirname, '../../../..');
const ZRODLO_SERWISU = fs.readFileSync(
  path.join(KORZEN, 'server/src/services/initiativeProjectPolicyService.ts'),
  'utf-8'
);
const MIGRACJA = fs.readFileSync(
  path.join(KORZEN, 'server/migrations/20262220_f9_system_portfolio_en_name.sql'),
  'utf-8'
);
const ROLLBACK = fs.readFileSync(
  path.join(KORZEN, 'server/migrations/rollback/20262220_f9_system_portfolio_en_name.down.sql'),
  'utf-8'
);

const POLSKIE_ZNAKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

describe('kontener systemowy inicjatyw — etykieta EN, klucz `is_system`', () => {
  it('nazwa i opis sa po angielsku (DEC-461)', () => {
    expect(SYSTEM_PORTFOLIO_PROJECT_NAME).not.toMatch(POLSKIE_ZNAKI);
    expect(SYSTEM_PORTFOLIO_PROJECT_DESCRIPTION).not.toMatch(POLSKIE_ZNAKI);
  });

  it('migracja danych przestawia DOKLADNIE stara etykiete na nowa — bez dryfu literalow', () => {
    // Bez tego porownania SQL i kod rozjezdzaja sie po cichu: migracja
    // szukalaby napisu, ktorego kod juz nie pisze.
    expect(MIGRACJA).toContain(SYSTEM_PORTFOLIO_PROJECT_LEGACY_NAMES[0]);
    expect(MIGRACJA).toContain(SYSTEM_PORTFOLIO_PROJECT_NAME);
    expect(ROLLBACK).toContain(SYSTEM_PORTFOLIO_PROJECT_LEGACY_NAMES[0]);
    expect(ROLLBACK).toContain(SYSTEM_PORTFOLIO_PROJECT_NAME);
  });

  it('migracja dopasowuje po `is_system`, a nie tylko po nazwie', () => {
    expect(MIGRACJA).toMatch(/WHERE is_system = TRUE/);
    expect(ROLLBACK).toMatch(/WHERE is_system = TRUE/);
  });

  it('serwis wyszukuje kontener po stalym kluczu `is_system`, nie po nazwie', () => {
    expect(ZRODLO_SERWISU).toContain('WHERE organization_id = ? AND is_system = TRUE');
    // MUTACJA: `... AND name = ?` w SELECCIE kontenera wywraca ten wiersz.
    expect(ZRODLO_SERWISU).not.toMatch(/SELECT id FROM projects WHERE[^`]*name\s*=/);
  });
});
