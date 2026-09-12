# CODEX4 — raport E1 (12.09.2026)

## 1. Stanowisko

Zakres tego przekazania: wyłącznie E1, dwa zastane 5xx. Worktree
`/Users/piotrwisniewski/Developer/codex-wt/codex4-dlug-mvp`, gałąź
`codex/dlug-mvp-20260912`, marker `d4ebea2c86` (przodek lokalnego
`origin/integracja/20260911`, exit 0). Przeczytano całą instrukcję, `docs/SOURCE_OF_TRUTH.md`,
kontrakty MW_TASKS/MW_INBOX i wskazany Tasks Complete Product Contract. Na markerze instrukcja
zawiera jeszcze `<<MARKER_SHA>>`; konkretny marker podał integrator i został sprawdzony.
Start: czysty checkout, 42 GiB wolnego. Bez zmian poza E1.

Kontener własny `cx-codex4-pg`, obraz `pgvector/pgvector:pg18`, adres `127.0.0.1:6455`,
baza `cx4_e1`. Kopia przez lokalny `pg_dump` z dopuszczonego `consultify-pg18`,
baza źródłowa `consultify_staging_1009`; dump odtworzony we własnym kontenerze.
Nie było połączeń do Railway/staging/demo/produkcji. Nie ładowano `server.env`.
Nie uruchamiano aplikacyjnego index.ts, poczty, drainerów ani zewnętrznych modeli.
Test montuje rzeczywisty ApiGateway i produkcyjny `errorHandlerMiddleware`, używa
podpisanego JWT i aktywnego membership, bez mocków lub obejścia autoryzacji.

## 2. E1 — wynik i dowody

**E1: lokalne kryteria naprawy spełnione; niezależny odbiór integratora pozostaje osobną bramką.**

### Inbox legacy

PRZED: cztery warianty `status=open|done|saved|all` zwracały 500.
Przyczyna: `TypeError: i.receivedAt.slice is not a function` w
`server/src/routes/my-work.routes.ts:2254` na markerze. PostgreSQL zwraca timestamp jako
`Date`, podczas gdy `InboxItem.receivedAt` i licznik `newToday` zakładają string ISO.
Cztery źródła przypisywały obiekt Date bez normalizacji: blocked tasks, assigned tasks,
pending decisions i notifications. Overdue tasks miały już `.toISOString()`.

PO: normalizacja tych czterech projekcji do ISO, przed liczeniem summary i serializacją.
Pozostaje identyczny kształt `{summary, items}` oczekiwany przez fallback w
`src/components/MyWork/InboxContent.tsx:2453–2458`. Plik frontu i kanoniczna trasa v8
nie zostały zmienione. Test używa jednocześnie czterech prawdziwych źródeł z timestampami PG,
sprawdza 200 na czterech statusach, `summary.newToday=4`, dokładne tytuły i format ISO.

### Przypisanie bez projektu

PRZED: assign oraz reassign zadania z `project_id=NULL` kończą się 500:
`Error: User is not a member of this project`,
`server/src/services/taskAssignmentService.ts:171` na markerze; wywołanie
`ProjectMemberService.getMember(null, assigneeId)` nie może znaleźć członkostwa projektu.

PO: wspólny serwis, przed sprawdzeniem członkostwa i przed jakimkolwiek zapisem,
odmawia **422** z kodem `TASK_ASSIGNMENT_PROJECT_REQUIRED` oraz komunikatem
**“Add this task to a project before assigning it.”**.
To jawnie dozwolony wariant E1. Zadania `personal/general` pozostają legalne; nie
poszerzono jednak projektowej polityki przypisania, obejmującej role projektu, SLA i audyt,
o niezdefiniowany odpowiednik organizacyjny. DEC-469 dla inicjatyw nie jest decyzją o
uprawnieniach przypisań zadań. Nie twierdzimy, że użytkownik może teraz przypisywać
projektowo zadanie osobiste; otrzymuje czytelny następny krok zamiast 500.

Realny test: przypisanie osoby z tej samej i obcej organizacji → 422 i pełny wiersz zadania
bez zmian; obcy wołający → nadal 404 i wiersz bez zmian. Reassign używa tej samej odmowy.
Kontrola pozytywna: zadanie mające projekt i wykonawcę z rolą `TASK_ASSIGNEE` → 200,
SQL readback wskazuje wykonawcę, SLA=24 i przyszły termin SLA.

### RED → GREEN, stały mianownik

Plik: `server/src/routes/__tests__/codex4LegacyInboxAndAssignment.pg.test.ts`.
Końcowy mianownik: **9 testów**, `retry=0`.

| Bieg | Wynik | Dowód poza repo |
|---|---|---|
| RED z oboma plikami produkcyjnymi odtworzonymi dokładnie z markera | 7 failed / 2 passed | `e1-red-expanded.log` |
| GREEN po przywróceniu napraw | 9 passed / 0 failed | `e1-green-final.log` |
| TypeScript serwera | exit 0, pusty log (0 B) | `e1-server-tsc-final.log` |

RED obala cztery warianty inbox oraz assign same-org/foreign-assignee i reassign.
Kontrole pozytywnego przypisania projektowego i odmowy obcemu wołającemu pozostają zielone.
Odtworzenie markerowych plików było kontrolowaną mutacją przez `git show` i kopie w scratch,
bez stash/reset, bez osłabiania testów. Najpierw powstał wariant 8-testowy, potem na prośbę
integratora dodano cztery źródła i kontrolę projektową; ostateczna para RED/GREEN ma te same 9 nazw.
Pierwszy dodatkowy bieg z korzenia repo zebrał zero testów (`e1-red-invalid-root.log`)
i nie jest zaliczeniem. Poprawne biegi wykonano z `server/`, zgodnie z rzeczywistym root configu.

Komenda z katalogu `server/` (dane wyłącznie lokalne):

```sh
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6455/cx4_e1 JWT_SECRET=codex4-local-only-secret-at-least-32-characters npx vitest run --config vitest.config.ts src/routes/__tests__/codex4LegacyInboxAndAssignment.pg.test.ts --retry=0
npx tsc --noEmit
```

### Rodzina

- Cztery projekcje receivedAt w jednym inboxie: naprawione i objęte wspólną fixture.
- Overdue inbox już normalizował datę; brak zmiany.
- `my-work/{stats,home,focus,manager,calendar}.routes.ts`: odczyt wzorców dat;
  miejscowe `slice(0,10)` używają ISO/string lub mają kontrolę typu. Nie znaleziono
  drugiego identycznego bezwarunkowego `receivedAt.slice` poza naprawianym inboxem.
  Nie wykonano pełnego runtime wszystkich tych tras.
- `reassign` deleguje do assignTask: ta sama przyczyna, poprawione wspólnym serwisem i zmierzone.
- Wywołania serwisu z triage/delegate `my-work.routes.ts:272` oraz
  `portfolioOptimization.routes.ts:632` dziedziczą jawną odmowę projektu;
  nie zmieniano ich handlerów i nie wykonano ich oddzielnego odbioru.
- Nie projektowano odmów dla innych zastanych błędów członkostwa/roli w zadaniach
  z projektem; to odrębne warunki, nie defekt NULL projektu.

## 3. E2

NIEWYKONANE w tym przekazaniu — dalsza praca integratora.

## 4. E3

NIEWYKONANE w tym przekazaniu — dalsza praca integratora.

## 5. E4

NIEWYKONANE w tym przekazaniu. Starsza instrukcja kont wskazuje demo, nowsza decyzja
pilotażu staging; przed użyciem narzędzi integrator ma ujednolicić cel.

## 6. SHA

E1: commit zawierający ten raport; pełny SHA w przekazaniu integratora i `git log -1`.
Nie wykonano push ani scalenia.

## 7. Przekazanie bazy i sprzątanie

Artefakty: `/Users/piotrwisniewski/Developer/codex-wt/codex4-artefakty/`.
Scratch/dump: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/staging-local.dump`.
Test usuwa swoje zadania, decyzję, notyfikację, projekt, memberships, użytkowników i organizacje.
Zdarzenia audytu z pozytywnych przypisań należą do izolowanej bazy testowej; nie osłabiano
niezmienialności audytu, aby je skasować. Cały własny `cx4_e1` należy usunąć po zakończeniu bloku.
Kontener i baza pozostawione integratorowi do E2/E3; nie są bazą oglądaną przez użytkowników.
Nie kasowano ani nie zmieniano cudzych baz. Dla czystego E3 można odtworzyć dump do nowego
własnego `cx4_bundle`:

```sh
docker exec cx-codex4-pg createdb -U postgres cx4_bundle
docker exec -i cx-codex4-pg pg_restore -U postgres -d cx4_bundle --no-owner --no-acl < /Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/staging-local.dump
```

## 8. Czego nie sprawdzono

Żadne żywe środowisko, UI ani nowe zrzuty (E1 jest backend-only), pełny front tsc,
pełna regresja aplikacji, kanoniczny inbox runtime i oddzielne trasy delegate/portfolio.
Nie zmierzono wszystkich istniejących zadań bez projektu ani liczby z pierwotnej premisy;
reprodukcja używa izolowanych fixture w legalnej lokalnej kopii. Brak migracji i zmian
uprawnień; nie ma dowodu wdrożenia, wyłącznie lokalnego E1.
