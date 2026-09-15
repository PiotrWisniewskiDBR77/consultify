import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMenuStructure } from '../menuConfig';

const identityT = (key: string, fallback?: string) => fallback ?? key;

/**
 * F9 (15.09.2026) — Fala F, etap „PMO w interfejsie".
 *
 * Zmierzone na stagingu `c458374bfa`: przy `VITE_PMO_PROJECTS=true` trasa
 * `/projects` renderowala pelny modul (3 wiersze, API 200), ale `menuConfig.ts`
 * nie mial ani jednego odwolania do projektow — modul byl osiagalny WYLACZNIE
 * przez wpisanie adresu. Ten plik pilnuje obu stron bramki.
 */
describe('Sidebar menu — Projects za flaga VITE_PMO_PROJECTS [F9]', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bez zmiennej (domyslnie OFF) menu NIE zawiera MODULE_PROJECTS', () => {
    vi.stubEnv('VITE_PMO_PROJECTS', '');
    expect(getMenuStructure(identityT as any).find((i) => i.id === 'MODULE_PROJECTS')).toBeUndefined();
  });

  it("jawne 'false' NIE wlacza", () => {
    vi.stubEnv('VITE_PMO_PROJECTS', 'false');
    expect(getMenuStructure(identityT as any).find((i) => i.id === 'MODULE_PROJECTS')).toBeUndefined();
  });

  it("literowka 'True' NIE wlacza — pozostaje OFF", () => {
    vi.stubEnv('VITE_PMO_PROJECTS', 'True');
    expect(getMenuStructure(identityT as any).find((i) => i.id === 'MODULE_PROJECTS')).toBeUndefined();
  });

  it("'true' dodaje pozycje z etykieta EN i ikona", () => {
    vi.stubEnv('VITE_PMO_PROJECTS', 'true');
    const item = getMenuStructure(identityT as any).find((i) => i.id === 'MODULE_PROJECTS');
    expect(item).toBeDefined();
    expect(item?.label).toBe('Projects');
    expect(item?.icon).toBeTruthy();
  });

  it('stoi ZARAZ PO Inicjatywach i przed Wdrozeniem', () => {
    vi.stubEnv('VITE_PMO_PROJECTS', 'true');
    const ids = getMenuStructure(identityT as any).map((i) => i.id);
    expect(ids.indexOf('MODULE_PROJECTS')).toBe(ids.indexOf('MODULE_INITIATIVES') + 1);
    expect(ids.indexOf('MODULE_PROJECTS')).toBeLessThan(ids.indexOf('MODULE_EXECUTION'));
  });

  it('ON nie rusza zadnej innej pozycji menu (parytet z OFF)', () => {
    vi.stubEnv('VITE_PMO_PROJECTS', '');
    const off = getMenuStructure(identityT as any).map((i) => i.id);
    vi.stubEnv('VITE_PMO_PROJECTS', 'true');
    const on = getMenuStructure(identityT as any).map((i) => i.id);
    expect(on.filter((id) => id !== 'MODULE_PROJECTS')).toEqual(off);
    expect(on.length).toBe(off.length + 1);
  });
});
