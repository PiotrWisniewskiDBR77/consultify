import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMenuStructure } from '../menuConfig';

const identityT = (key: string, fallback?: string) => fallback ?? key;

/**
 * DEC-425 (właściciel, 2026-09-06, 1.1-M-3): Spotkania (08_MEETINGS)
 * NIEWIDOCZNE w MVP do Fali 2. `getMenuStructure` musi omijać pozycję
 * `MODULE_MEETING` wyłącznie na podstawie `isMeetingsModuleEnabled()`
 * (`meetingsModuleFlag.ts`), niezależnie od roli — zero wyjątku dla
 * adminów, w odróżnieniu od `BETA_MENU_STATUS`/`BETA_ADMINS_EXEMPT`.
 */
describe('Sidebar menu — Meeting entry za flagą VITE_MODULE_MEETINGS (DEC-425)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('bez zmiennej (domyślnie OFF) menu NIE zawiera MODULE_MEETING', () => {
    vi.stubEnv('VITE_MODULE_MEETINGS', '');
    const menu = getMenuStructure(identityT as any);
    expect(menu.find((item) => item.id === 'MODULE_MEETING')).toBeUndefined();
  });

  it('jawne OFF (\'false\') menu NIE zawiera MODULE_MEETING', () => {
    vi.stubEnv('VITE_MODULE_MEETINGS', 'false');
    const menu = getMenuStructure(identityT as any);
    expect(menu.find((item) => item.id === 'MODULE_MEETING')).toBeUndefined();
  });

  it('literówka (\'True\', wielka litera) NIE włącza — pozostaje OFF', () => {
    vi.stubEnv('VITE_MODULE_MEETINGS', 'True');
    const menu = getMenuStructure(identityT as any);
    expect(menu.find((item) => item.id === 'MODULE_MEETING')).toBeUndefined();
  });

  it("VITE_MODULE_MEETINGS=true menu ZAWIERA MODULE_MEETING", () => {
    vi.stubEnv('VITE_MODULE_MEETINGS', 'true');
    const menu = getMenuStructure(identityT as any);
    const item = menu.find((item) => item.id === 'MODULE_MEETING');
    expect(item).toBeDefined();
    expect(item?.badge).toBe('beta');
  });

  it('nie zmienia liczby/tożsamości pozostałych pozycji menu między OFF i ON (poza MODULE_MEETING)', () => {
    vi.stubEnv('VITE_MODULE_MEETINGS', '');
    const menuOff = getMenuStructure(identityT as any).map((item) => item.id);
    vi.stubEnv('VITE_MODULE_MEETINGS', 'true');
    const menuOn = getMenuStructure(identityT as any).map((item) => item.id);
    expect(menuOn.filter((id) => id !== 'MODULE_MEETING')).toEqual(menuOff);
    expect(menuOn.length).toBe(menuOff.length + 1);
  });
});

/**
 * MUTACJA (dowód, że zabezpieczenie faktycznie broni czegoś): gdyby ktoś
 * odwrócił domyślne zachowanie flagi na domyślnie-ON (heurystyka domyślnej
 * flagi kłamie — pamięć nadzorcy), pierwszy test wyżej („bez zmiennej menu
 * NIE zawiera MODULE_MEETING”) musi zaświecić się na czerwono. Sprawdzone
 * ręcznie: podmiana `isMeetingsModuleEnabled()` na `!== 'false'` w
 * `meetingsModuleFlag.ts` powoduje FAIL testu „bez zmiennej (domyślnie OFF)”
 * (menu zawiera MODULE_MEETING, gdy nie powinno) — przywrócone po
 * weryfikacji, patrz meldunek końcowy.
 */
