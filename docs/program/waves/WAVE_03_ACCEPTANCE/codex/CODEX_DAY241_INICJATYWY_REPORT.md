# CODEX DAY 241 — INICJATYWY

Status: **POMIAR CZĘŚCIOWY, DOWÓD GŁÓWNEJ LUKI POTWIERDZONY**. Ten dyżur niczego nie naprawia.

## Stan wejściowy

```text
MARKER OK
61fbb7b88f87c563395b8ce9bf8c67ddeffbab5d
git status --short: pusty
df po utworzeniu worktree: 8.6 GiB wolne
porty 6190, 5168, 5169: brak listenerów
```

Marker jest przodkiem aktualnego tipa; zgodnie z DEC-2026-08-26-95 praca rozpoczęła się dokładnie z markera. Tip bazowy uciekł do przodu (zakres `61fbb7b88f..github-backup/codex/m03-admin-20260824`), bez rebase.

## Baza i bezpieczeństwo

- Kontener: `cx-day241-pg`, obraz `pgvector/pgvector:pg16`, baza `cx241`, wyłącznie `127.0.0.1:6190`.
- Pierwszy przebieg: `Applying migrations: 880`, zakończony `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, zakończony bez błędu.
- Zapytanie `settings WHERE key LIKE 'smtp%'`: `0 rows`.
- Artefakt testu: `/private/tmp/cx-day241-inicjatywy-artefakty/day241-lazy-fields.json`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — mianowniki dróg zapisu

Pomiar własny przez `rg -c "router\\.(post|put|patch|delete)\\("`:

| plik | drogi zapisu |
|---|---:|
| `pmo/initiatives.routes.ts` | 96 |
| `pmo/initiativesExecutionRuntime.routes.ts` | 82 |
| `pmo/initiativeClosure.routes.ts` | 6 |
| `pmo/initiativesCapacityAdvisor.routes.ts` | 1 |
| `initiativeBackbone.routes.ts` | 1 |
| `initiativeGeneratorBrain.routes.ts` | 3 |
| `initiatives-additive.routes.ts` | 5 |
| `initiative-governance.routes.ts` | 10 |
| `initiativeMaterialize.routes.ts` | 2 |
| `initiativeCandidates.routes.ts` | 4 |
| **Razem** | **210** |

Uczciwy stan klasyfikacji: **M >=92, K >=16, D=25, U=77**. Nie przedstawiam `audit_mentions` jako liczby audytowanych tras. `runtime-v1` ma wspólny material-command UoW zapisujący `ie_audit_events`; 25 legacy handlerów zatrzymuje wcześniejszy middleware. Pełne rozpisanie 77 tras handler-po-handlerze nie zostało zakończone.

## R2 — obejście zatwierdzenia i dowód mutacyjny

Test `day241.lazy-fields-audit-gap.pg.test.ts` przeszedł **2/2**, `--retry=0`, z pełnymi nazwami:

1. `Day 241 LAZY_FIELDS audit gap via production ApiGateway and real PostgreSQL binds the proof to the assigned real PostgreSQL environment`
2. `Day 241 LAZY_FIELDS audit gap via production ApiGateway and real PostgreSQL persists hypothesisStatement through signed HTTP but creates no initiative_history row`

Łańcuch: podpisany JWT → `ApiGateway.getInstance().initializeRoutes(app)` → `verifyToken` (bypass jawnie `false`) → `PUT /api/initiatives/:id` → PostgreSQL → niezależny `SELECT hypothesis_statement` oraz `SELECT count(*) FROM initiative_history`. Pole zostało zapisane, historia została `0 → 0`.

Pułapki: `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres` i jawny `DATABASE_URL` były w tej samej linii. Test asercją potwierdził środowisko. Nie montował gołego routera.

Cztery funkcje `handle*Attachment*` / `handle*LinkedItem*` mają po dwa wystąpienia: definicję i zależność `useMemo`; brak realnego wywołania. To martwa biblioteka, nie działający przewód.

## R3 — wzorzec Organizacji

Organizacja rozdziela propozycję od decyzji człowieka, chroni przed ponownym rozstrzygnięciem i zapisuje numerowaną wersję z hashem. Baza sama blokuje zmianę opublikowanego snapshotu. `initiative_history` nie daje dziś tej gwarancji i, jak pokazuje dowód HTTP, nie obejmuje nawet wszystkich realnych zapisów.

## R4 — warianty dla właściciela

- A: usunąć potwierdzony martwy kod i nazwać rzeczy po imieniu. Niski koszt, luka audytu pozostaje.
- B: przeprowadzić osiągalne ciche zapisy przez istniejący `runtime-v1` i `ie_audit_events`. Średni koszt, wspólny ślad.
- C: dodać rejestr pending/approved/rejected oraz niemutowalne haszowane snapshoty jak w Organizacji. Wysoki koszt, prawdziwe zatwierdzenie.

Osobno warto naprawić `LAZY_FIELDS`: luka jest wąska i ma już czerwono-zielony kontrakt obserwacyjny, niezależny od wyboru A/B/C.

## R5 — ekrany

Pomiar `find` daje 15 plików TSX na najwyższym poziomie `components/Initiatives`, nie 14. Dwa zgłoszone widoki legacy/deprecated potwierdzono. `AppRoutes.tsx` bezpośrednio montuje `InitiativesHub` dla `ROUTES.INITIATIVES`; aliasy roadmap/portfolio przekierowują. Pełnego drzewa realnych wołających dla pozostałych komponentów nie zakończono.

## Pomiar nazw przed/po

Przed dodaniem nowego testu nie istniał pakiet Day 241, więc lista `przed-nazwy.txt` jest logicznie pusta. Po zmianie dodano dokładnie dwie pełne nazwy wymienione w R2; żadna nazwa nie zniknęła. JSON jest źródłem nazw, nie sam kod wyjścia.

## Korekty wobec instrukcji

- Twierdzenie o 14 plikach najwyższego poziomu zostało obalone: własny `find` zwrócił 15. To wynik, nie STOP.
- Czterokategorie N/M/K/D nie pokrywają nierozstrzygniętych tras; bezpiecznie dodano U zamiast przypisywać je na podstawie słów w kodzie.

## TWIERDZENIA NIEZWERYFIKOWANE

- Pełna klasyfikacja 77 tras pozostaje `NOT_PROVEN`.
- Co najmniej jeden realny wołający dla każdego z pozostałych komponentów pozostaje `NOT_PROVEN`.
- Nie uruchomiono szerokich zastanych pakietów, więc nie ma twierdzenia o braku regresji całego modułu; zakres zmiany to nowy test i dokumentacja.

## Zakres zmian

Wyłącznie nowy test dowodowy, ten raport oraz addytywna sekcja w `05_INITIATIVES/MODULE_ACCEPTANCE.md`. Zero zmian produktu, bramek, flag i infrastruktury testowej.
