# K5-fix — demo sandbox TTL, Wpis 77 / DEC-518

Werdykt: **READY FOR INDEPENDENT REVIEW** na exact content SHA `4627bd853bae00865e2bcda48b026961cbfab676`.

## Zmiana zachowania

`ENABLE_DEMO_SANDBOX_TTL` jest teraz destrukcyjnym opt-in. Bez zmiennej, przy pustej wartości, `false` albo wartości nieznanej Scheduler nie rejestruje godzinnego zadania, a serwis kończy działanie przed wyszukaniem kandydatów i zwraca `0`. Jawne `true` (oraz dotychczas akceptowane wartości logiczne `1`, `yes`, `on`) uruchamia dotychczasowe zachowanie K5 bez zmiany jego reguł bezpieczeństwa.

## Dowody

- Exact base: `dcbd6c052a15f6ef65a6ec698bb0cbda4a7902fe`; jeden commit produktu, cztery pliki.
- Jawny test acceptance z wymaganym `--config vitest.acceptance.config.ts --retry=0`: **7/7 PASS** na disposable PostgreSQL `127.0.0.1:6455/consultify_k5_fix` (`MOCK_DB=false`). Nowy przypadek bez zmiennej zachowuje wszystkie organizacje, wykonuje zero DELETE i zwraca `0`.
- Pozostałe sześć testów K5 nadal przechodzi: explicit ON usuwa 3/3; 49/49 istniejących tabel otrzymuje DELETE; paid, świeży ended i kandydat zmieniony na paid są chronione; fault injection cofa 5/5 rekordów i daje `deleted=0`; explicit false nic nie usuwa.
- Jednostkowy kontrakt Scheduler: **6/6 PASS**, brak/pusta/false/nieznana wartość = OFF, a wartości opt-in = ON.
- Importery K5: **12/12 PASS** (`demoSessionDatasetSignal` 9/9, `trialCronDemoCleanup` 3/3); razem z kontraktem Scheduler: **18/18 PASS**.
- Server TypeScript: RC 0. Frontend: brak zmienionych plików; bieżący licznik 177 istniejących błędów, bez możliwości regresji z tej paczki.
- `check:jezyk:ci`: RC 0; `git diff --check`: RC 0; migracje 0; nowe `as any` 0; pliki zakazane 0.

## Granice

Nie uruchamiano cleanupu na stagingu, demo ani innej bazie chronionej. Nie wykonano deployu ani pushu na gałąź chronioną. Disposable PostgreSQL został usunięty po zapisaniu dowodu. Surowe wyniki są w `evidence/k5-demo-ttl-w77-fix/`.
