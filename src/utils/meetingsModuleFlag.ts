/**
 * Flaga modułu Spotkania (08_MEETINGS) — DEC-425 (właściciel, 2026-09-06):
 * „Wrzuć Spotkania za flagi i wpisz to do Fali 2. Nie będziemy teraz tego
 * rozwijać.” Moduł ma być NIEWIDOCZNY w MVP: brak pozycji w lewym menu,
 * trasy `/meetings/**` (i legacy `/meeting`) pokazują neutralny ekran
 * „Spotkania — planowane w Fali 2” zamiast `MeetingHub`/`MeetingObjectPage`.
 *
 * NIE jest to to samo co `BETA_MENU_STATUS.MODULE_MEETING` (`betaAccess.ts`
 * / `betaMenuStatus.ts`) — ten mechanizm reguluje widoczność PER ROLA
 * (admin/owner/superadmin są zwolnieni przez `BETA_ADMINS_EXEMPT=true`) i na
 * zablokowanej trasie pokazuje modal „beta locked” + przekierowanie do
 * `/chat`. DEC-425 chce PEŁNEJ niewidzialności — bez wyjątku dla adminów i
 * bez modala — więc dokłada DRUGĄ, niezależną bramkę na poziomie rejestracji
 * trasy/menu (ten plik), analogiczną do `caseWorkspaceFlag.ts` /
 * `VITE_ENABLE_CASE_WORKSPACE`. `BETA_MENU_STATUS.MODULE_MEETING` zostaje
 * `'open'` bez zmian: z tą flagą WŁĄCZONĄ zachowanie modułu jest identyczne
 * jak dziś (zero zmian w `MeetingHub`).
 *
 * Rozstrzygnięcie: WYŁĄCZNIE `import.meta.env.VITE_MODULE_MEETINGS === 'true'`.
 * Każda inna wartość (brak zmiennej, `''`, `'false'`, literówka) = OFF. Bez
 * `??`/`||` z domyślnym `true` — patrz pamięć nadzorcy „heurystyka domyślnej
 * flagi kłamie”.
 *
 * ★ ODCZYT MUSI BYĆ DOSŁOWNY `import.meta.env.KLUCZ` — BEZ CASTA. Zmierzone
 * przy tym zleceniu (1.1-M-3): wzorzec skopiowany z `navDeclutterFlag.ts` /
 * 108 „naprawionych” flag z dyżuru 2026-09-05
 * (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/AGENT_FLAGI_ENV_STATYCZNY_20260905.md`),
 * `(import.meta as unknown as { env?: ... }).env?.[KLUCZ]`, DZIAŁA w
 * `vite build` (zweryfikowane osobnym mini-projektem: `esbuild`/rollup
 * podstawia wartość poprawnie, bo cast jest już wygaszony w momencie
 * podstawiania), ale NIE DZIAŁA w `vite dev` ani w Vitest z `vi.stubEnv` —
 * oba wstrzykują `import.meta.env` przez preambułę WYŁĄCZNIE gdy
 * NIEPRZETRANSFORMOWANY kod źródłowy zawiera dosłowny, sąsiadujący napis
 * `import.meta.env` (patrz `zaiTeresaFlag.ts` — ten sam mechanizm, który
 * złamał oryginalny dwuinstrukcyjny wzorzec, łapie RÓWNIEŻ wariant z castem,
 * bo `as unknown as {...}` rozdziela `import.meta` i `.env` W TEKŚCIE
 * ŹRÓDŁOWYM, mimo że po kompilacji TS to jedno wyrażenie). Ten plik czyta
 * więc dosłownie `import.meta.env.VITE_MODULE_MEETINGS` (wzorzec
 * `zaiTeresaFlag.ts` / `caseWorkspaceFlag.ts`, oba bez castu) — inaczej
 * KROK 3 tego zlecenia (własny `vite --port …` + `VITE_MODULE_MEETINGS=true`)
 * dałby fałszywy negatyw: kod poprawny w buildzie produkcyjnym, a mimo to
 * niewidoczny na zrzucie z dev-servera. Zgłoszone osobno jako ZNALEZISKO dla
 * ~123 plików z wzorcem-castem (nie naprawiane tutaj — poza zakresem tego
 * zlecenia, `navDeclutterFlag.ts` i `assessmentDocxFlag.ts` mają ten sam
 * kształt).
 */
export function isMeetingsModuleEnabled(): boolean {
  try {
    return import.meta.env.VITE_MODULE_MEETINGS === 'true';
  } catch {
    return false;
  }
}
