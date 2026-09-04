# Domknięcie dyżuru 288 — 2 czerwone testy → 23/23 (2026-09-03)

Werdykt odbioru (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/ODBIOR_DYZUROW_288_289_296_20260903.md`,
sekcja 288, zastrzeżenie Z1): **SCALIĆ Z ZASTRZEŻENIEM** — gałąź zostawiała 2 testy czerwone w pliku,
który na m03 HEAD ma 23/23 PASS.

## Plik
`server/src/routes/v8/__tests__/financeStatementMountedSurface.test.ts`

## Dwa czerwone testy (nazwy dosłownie)
1. `reaches only exact flags and Statement handlers when global and org V8 gates are disabled`
2. `uses the real Finance membership/editor wall before handlers while V8 gates are disabled`

## PRZED (potwierdzone własnym uruchomieniem)
```
npx vitest run src/routes/v8/__tests__/financeStatementMountedSurface.test.ts
 ❯ ... (23 tests | 2 failed)
   × reaches only exact flags and Statement handlers when global and org V8 gates are disabled
     Error: expected 200 "OK", got 403 "Forbidden"
   × uses the real Finance membership/editor wall before handlers while V8 gates are disabled
     AssertionError: expected { …(2) } to match object { code: 'FINANCE_EDIT_FORBIDDEN' }
     - "code": "FINANCE_EDIT_FORBIDDEN"
     + "code": "BETA_LOCKED"
Test Files  1 failed (1)
Tests  2 failed | 21 passed (23)
```

## Przyczyna
`createMountedFinanceStatementRouter` (dyżur 288, `server/src/routes/v8/financeStatementMountedSurface.ts`)
domyślnie montuje realny `createModuleGate('MODULE_ECONOMICS')` PRZED `financeRouter`/`flagsRouter`.
`createModuleGate` (`server/src/middleware/betaGate.middleware.ts:27-46`) czyta rolę z
`req.user?.role` (OWNER/ADMIN/ADMINISTRATOR/SUPERADMIN przechodzi, inaczej 403 `BETA_LOCKED`).

Oba testy montują ten router z realnym `moduleGate` (nie nadpisują go w `overrides`), ale ich stuby
`verifyToken`/`identity` ustawiały `req.user` BEZ pola `role`:
- Test 1: `pass('auth')` → `req.user = { id: 'user-1', organizationId: 'org-v8-disabled' }` — brak roli,
  więc realna bramka słusznie odbija stub 403 zamiast puścić go do stubowanych handlerów `flags`/`finance`,
  które test chciał zweryfikować (allowlistę `isMountedFinanceStatementSurface`, nie samą bramkę modułu).
- Test 2: `identity` → `req.user = { id: userId, organizationId: 'org-v8-disabled' }` — brak roli,
  więc OBAJ użytkownicy (member-user i owner-user) dostawali 403 `BETA_LOCKED` z bramki modułu, zanim
  dotarli do realnej ściany membership/editor (`FINANCE_EDIT_FORBIDDEN`), którą ten test miał bronić.

To jest kształt „test montuje stub bez roli i oczekuje 200 od trasy, która teraz słusznie jest za
bramką" z instrukcji — naprawa jest po stronie TESTU, nie produktu: bramka działa poprawnie
(potwierdzone też przez odbiorcę w Dowodzie 1-3 sekcji 288 tego samego pliku odbioru).

## Naprawa (tylko test, wzorzec z `*.membershipGate.pg.test.ts` w tym samym katalogu — tam JWT niesie
`role: 'ADMIN'`, co czyta ten sam `createModuleGate`)
- Linia 52: `req.user = { id: 'user-1', organizationId: 'org-v8-disabled' }` →
  `req.user = { id: 'user-1', organizationId: 'org-v8-disabled', role: 'OWNER' }`
- Linia 123: `req.user = { id: userId, organizationId: 'org-v8-disabled' }` →
  `req.user = { id: userId, organizationId: 'org-v8-disabled', role: 'ADMIN' }`
  (oba stuby — member-user i owner-user — dostają tę samą rolę na poziomie tokena/bramki modułu;
  różnicowanie MEMBER/OWNER dzieje się niżej, w mocku `organization_members` przez `database.get`,
  który zostaje nienaruszony — to jest właśnie ściana, którą test bada).

## PO (potwierdzone własnym uruchomieniem)
```
npx vitest run src/routes/v8/__tests__/financeStatementMountedSurface.test.ts
 Test Files  1 passed (1)
      Tests  23 passed (23)
```

## Kontrola braku regresji w rodzinie tras finansów v8
Cały katalog `server/src/routes/v8/__tests__/` PRZED naprawą: 18 failed / 798 passed (822).
Ten sam katalog PO naprawie: 16 failed / 800 passed (822) — dokładnie 2 testy przybyły do zielonych,
reszta czerwonych (np. `res10-ownership-separation.routes.test.ts`) jest spoza rodziny finansów/288,
niezmieniona przez tę naprawę i poza zakresem tego dyżuru.

## Dowód mutacyjny (rejestr bramek)
```
npx vitest run tests/unit/backend/security/betaGateMountRegistry.test.ts
PRZED mutacją:  Tests  50 passed (50)
```
Mutacja: usunięto z `server/src/routes/v8/index.ts` blok
```js
v8Router.use((req, res, next) => {
  if (!FINANCE_MODULE_PATH.test(req.path)) return next();
  return financeModuleGate(req, res, next);
});
```
```
PO mutacji:     Tests  3 failed | 47 passed (50)
  (m.in. "MODULE_ECONOMICS · Finance — rodzina /api/v8/finance* (closed) —
   rola ustalona PRZED bramką (inaczej wygaszenie dla wszystkich)")
```
Plik `server/src/routes/v8/index.ts` przywrócony z kopii zapasowej bezpośrednio po pomiarze;
`git status --short` po przywróceniu pokazuje TYLKO zmieniony plik testu (index.ts bez zmian).
Rejestr po przywróceniu: 50/50 PASS ponownie.

## esbuild
`npx esbuild server/src/routes/v8/__tests__/financeStatementMountedSurface.test.ts --bundle
--platform=node --format=esm --outfile=/dev/null` → `Done in 4ms`, bez błędów.

## Commity
Do uzupełnienia po `git commit` (SHA poniżej w meldunku końcowym).
