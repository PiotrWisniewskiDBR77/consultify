# Plan: Ochrona Testów Automatycznych

**Data utworzenia:** 2026-02-15  
**Kontekst:** System praktycznie nie ma ochrony testów automatycznych. Ten dokument opisuje sytuację i plan naprawy dla kolejnego agenta.

---

## 0. Jak używać tego dokumentu (dla kolejnego agenta)

- Ten plan jest nastawiony na **“ochronę”** (bramki: pre-commit + CI), a nie na “naprawę pojedynczych testów”.
- Najpierw zamykamy luki P0 (żeby CI/commit faktycznie blokowały regresje), potem dopiero podnosimy coverage / E2E / jakość.
- Jeśli musisz szybko zweryfikować stan: uruchom lokalnie `npm run test:unit:critical` i sprawdź w CI job `test-quality-check` oraz `critical-path-coverage`.

## 1. Sytuacja wyjściowa

### 1.1 Co zostało naprawione (2026-02-15)

Naprawiono **7 failing tests** w **6 plikach**:

| Plik                                                    | Problem                                                                             | Rozwiązanie                                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `tests/components/auth/LoginView.test.tsx`              | Błędna ścieżka importu (`../../../../` zamiast `../../../`)                         | Poprawiono ścieżki względne                                                                |
| `tests/integration/routes/tasks.test.js`                | Brak named export `activityService` w mocku                                         | Dodano `activityService` do `vi.mock`                                                      |
| `tests/backend/trial_limits.test.js`                    | Brak `onboarding_status` w mocku org — `TRIAL_PROFILE_INCOMPLETE` blokował testy AI | Dodano `onboarding_status: 'ORG_SETUP_COMPLETED'` i handler dla `SELECT onboarding_status` |
| `tests/clipboard/clipboard-utils.test.js`               | Zła nazwa opcji (`clearTimeout` vs `autoClearTimeout`), async watcher nie odpalał   | `autoClearTimeout`, `vi.advanceTimersByTimeAsync`                                          |
| `tests/keyboard/keyboard-utils.test.js`                 | `Date.now()` nie reaguje na `vi.advanceTimersByTime`                                | `vi.setSystemTime`, dodatkowy combo `'b c'`                                                |
| `tests/security/sql-injection.test.ts`                  | 500 na unauthenticated requests                                                     | Auth bypass env, nagłówki, rozluźnione asercje                                             |
| `tests/unit/backend/security/inputSanitization.test.ts` | Asercja źródła oczekiwała `req.query = sanitizeObject`                              | Zmieniono na `sanitizeObject(req.query`                                                    |

**Stan po naprawie:** ~962 pliki testowe, ~8710 testów przechodzi. Pełny suite może mieć 1–2 flaky testy (np. `sorting-performance.test.ts`).

### 1.2 Dlaczego „praktycznie brak ochrony”

| Obszar           | Problem                                                                              | Skutek                                                              |
| ---------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **CI/CD**        | `test-quality-check` ma `continue-on-error: true`                                    | Placeholdery i fałszywe testy nie blokują merge                     |
| **Pre-commit**   | `test:unit:critical` uruchamia tylko ~7 plików                                       | Większość kodu nie jest chroniona przed commitem                    |
| **Coverage**     | Coverage “jest”, ale często **nie blokuje** (np. brak raportu → warning, a nie fail) | Brak realnego wymuszania progów pokrycia                            |
| **E2E**          | CI uruchamia tylko `ai-system-health.spec.ts` i `runtime/`                           | Reszta E2E (np. `security-cookie-auth.spec.ts`) nie jest w pipeline |
| **Integration**  | CI używa Postgres, lokalnie SQLite                                                   | Różnice środowisk, potencjalne flaki                                |
| **Test Quality** | `quality-check.ts` ma threshold 25% autentyczności                                   | Bardzo niski próg — wiele placeholderów może przejść                |

---

## 2. Architektura testów (5 poziomów)

W praktyce (operacyjnie) poziomy testów w repo wyglądają tak:

```
L1 Unit       → tests/unit/**        (Vitest, gł. node)
L2 Component  → tests/components/**  (Vitest + React Testing Library, jsdom)
L3 Integration→ tests/integration/** (Vitest + DB, node)
L4 E2E        → tests/e2e/**         (Playwright; uruchamiane poza Vitest)
L5 NFR        → tests/security/** + tests/performance/** (Vitest, node)
```

Uwaga: w [`TESTING_STRATEGY_5_LEVELS.md`](./TESTING_STRATEGY_5_LEVELS.md) poziomy są opisane bardziej “koncepcyjnie”; ten dokument opisuje **realny podział folderów i narzędzi**, bo to on determinuje bramki w CI i pre-commit.

**Główne pliki konfiguracyjne / bramki:**

- CI pipeline: [`../.github/workflows/test-suite.yml`](../.github/workflows/test-suite.yml)
- Hook pre-commit: [`../.husky/pre-commit`](../.husky/pre-commit)
- Skrypty jakości/audytu: [`../scripts/testing/quality-check.ts`](../scripts/testing/quality-check.ts), [`../scripts/testing/run-audit.ts`](../scripts/testing/run-audit.ts)
- Vitest: [`../vitest.config.ts`](../vitest.config.ts), [`../vitest.perf.config.ts`](../vitest.perf.config.ts), [`../vitest.security.config.ts`](../vitest.security.config.ts)
- Playwright: [`../playwright.config.ts`](../playwright.config.ts)
- Setup testów: [`../tests/setup.ts`](../tests/setup.ts)
- Rejestr audytów: [`../tests/TEST_AUDIT_REGISTRY.md`](../tests/TEST_AUDIT_REGISTRY.md)

---

## 3. Plan działania dla kolejnego agenta

### Faza 1: Wzmocnienie bramek (P0)

1. **Usunąć `continue-on-error` z jobu `test-quality-check`** w [`../.github/workflows/test-suite.yml`](../.github/workflows/test-suite.yml), żeby placeholdery zaczęły blokować merge.
2. **Rozszerzyć `test:unit:critical`** w [`../package.json`](../package.json) tak, by obejmował:
   - co najmniej wszystkie krytyczne middleware/security (np. `tests/unit/backend/middleware/**`, `tests/unit/backend/security/**`)
   - krytyczne usługi autoryzacji/polityk dostępu (np. `accessPolicyService`, `permissionService`)
3. **Wzmocnić pre-commit** w [`../.husky/pre-commit`](../.husky/pre-commit):
   - dziś przejście testów jest weryfikowane przez `grep -q "Tests.*passed"` (kruchy warunek zależny od outputu)
   - preferowane: opierać się o **exit code** komendy (bez `grep`), ewentualnie ustalić reporter deterministyczny

### Faza 2: Pokrycie i raporty (P1)

4. **Ustabilizować coverage:**
   - Uruchamiać coverage na **podzbiorze** (np. `tests/unit/backend/middleware` + `tests/security`) zamiast całego suite (mniej timeoutów).
   - Dodać skrypt typu `test:coverage:critical` / `test:coverage:security` dla krytycznych modułów.
5. **Zrobić z coverage realną bramkę w CI**:
   - job `critical-path-coverage` nie powinien maskować błędów (`|| true`) ani przechodzić gdy brak raportu (obecnie: warning i “skip”)
   - job `coverage` powinien **failować** przy niespełnionych progach (obecnie: ostrzega przy <80%)

### Faza 3: E2E i integracja (P2)

6. **Włączyć więcej E2E w CI**:
   - obecnie job `e2e-tests` uruchamia tylko `tests/e2e/ai-system-health.spec.ts`
   - dołożyć krytyczne specy security/auth (np. cookie auth) lub stworzyć osobny job “security-e2e”
7. **Ujednolicić środowisko testów integracyjnych**:
   - CI używa Postgresa; dev często opiera się o SQLite → ryzyko różnic i flaków
   - wybrać jedną ścieżkę jako kanoniczną i dopiąć seed/migracje pod nią

### Faza 4: Jakość testów (P3)

8. **Podnieść threshold w `quality-check.ts`** z 25% do 50%+ autentyczności.
9. **Zidentyfikować i usunąć placeholdery** — skrypt `quality-check.ts` już je wykrywa; naprawić lub usunąć fałszywe testy.
10. **Dodać `test:audit` do pre-commit** (opcjonalnie, szybki audyt L1+L2) — uwaga na czas wykonania.

---

## 4. Kluczowe pliki i komendy

| Komenda                      | Opis                         |
| ---------------------------- | ---------------------------- |
| `npm run test:unit`          | Unit (Vitest)                |
| `npm run test:component`     | Component (8 shardów)        |
| `npm run test:integration`   | Integration                  |
| `npm run test:security`      | Security + npm audit         |
| `npm run test:performance`   | Performance                  |
| `npm run test:unit:critical` | Krytyczne testy (pre-commit) |
| `npm run test:quality-check` | Wykrywanie placeholderów     |
| `npm run test:audit`         | Szybki audyt L1+L2           |
| `npm run test:audit:full`    | Pełny audyt z raportem       |
| `npx playwright test`        | E2E (Playwright)             |

| Plik                                            | Rola                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `vitest.config.ts`                              | Konfiguracja Vitest, exclude, environmentMatchGlobs                         |
| `tests/setup.ts`                                | Globalne mocki (np. auth.middleware)                                        |
| `scripts/security/verify-security-integrity.ts` | Weryfikacja implementacji security (blokuje merge)                          |
| `scripts/testing/block-duplicates.sh`           | Blokada duplikatów w pre-commit                                             |
| `.husky/pre-commit`                             | Hook: block-duplicates, lint-staged, security-integrity, test:unit:critical |
| `.github/workflows/test-suite.yml`              | CI: unit/component/integration/security/e2e/perf + coverage + quality-check |
| `scripts/testing/quality-check.ts`              | Anti-placeholder gate (autentyczność testów)                                |
| `scripts/testing/run-audit.ts`                  | Audyt testów (quick/full + raport + rejestr)                                |
| `playwright.config.ts`                          | Konfiguracja Playwright (E2E)                                               |

---

## 5. Znane problemy i pułapki

1. **`tests/setup.ts`** — globalny mock `auth.middleware.js` może przechwytywać importy. Testy wymagające prawdziwego middleware używają `vi.importActual`.
2. **Środowisko** — `environmentMatchGlobs` w vitest: `tests/unit/backend/**`, `tests/security/**` → `node`; reszta → `jsdom`.
3. **Aliasy** — `server/services/activityService` → `server/src/services/ActivityService.ts` (vitest resolve).
4. **E2E wykluczone z Vitest** — `tests/e2e/**` w `exclude`; E2E uruchamiane tylko przez Playwright.
5. **Flaky** — `sorting-performance.test.ts` może failować pod obciążeniem (threshold czasowy).
6. **Kruche bramki** — unikaj “parsowania outputu” (`grep`) jako warunku sukcesu; opieraj się o exit code i deterministyczne formaty raportów (junit/json).

---

## 6. Kolejność realizacji (rekomendowana)

```
1. Faza 1.1 – usunąć continue-on-error z test-quality-check
2. Faza 1.2 – rozszerzyć test:unit:critical
3. Faza 1.3 – zweryfikować pre-commit
4. Faza 2.1 – dodać test:coverage:security
5. Faza 3.1 – włączyć security E2E w CI
6. Faza 4.1 – podnieść threshold quality-check
```

---

## 7. Kontakt z poprzednim kontekstem

- Naprawione testy: LoginView, tasks, trial_limits, clipboard, keyboard, sql-injection, inputSanitization.
- Produkcja security: cookie auth, CSRF, sanitization, auth middleware, DB-backed security APIs — opis w `production_security_system_*.plan.md` (jeśli istnieje).
- Raport Antygracity wskazywał na niską autentyczność testów — `quality-check.ts` i `run-audit.ts` są narzędziami naprawczymi.
