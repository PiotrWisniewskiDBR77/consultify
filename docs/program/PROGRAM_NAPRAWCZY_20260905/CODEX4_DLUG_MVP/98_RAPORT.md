# CODEX4 — raport E1–E4 (12.09.2026)

## 1. Stanowisko

Pierwsze przekazanie obejmowało E1. Raport uzupełniono o E2, częściowy E3 i lokalne narzędzia E4; bez wdrożenia. Worktree
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

## 3. E2 — ponowne otwarcie karty działania

**E2: lokalne kryteria spełnione; niezależny odbiór integratora pozostaje osobną bramką.**
Baza kodu E1: `5544f2f3fe36434a6c7fc6ca9a29b5272feea0c2`. Ten etap korzysta z tego samego
izolowanego `cx4_e1`; realny ApiGateway na 4214, zbudowany Vite preview na 5214.

### Premisa i kontrakt

PRZED: brak trasy reopen w `server/src/routes/actionCards.routes.ts`; update serwisu
przyjmuje wybrane pola treści, nie status. Realny POST reopen daje 404. Close ustawia
`action_cards.status=CLOSED`, `updated_by`, `updated_at`; nie ma osobnych kolumn closed_at/by
ani oddzielnego wpisu historii. Dodatkowo zamyka istniejący canonical Inbox właściciela
jako resolved z `metadata.closedBy=action_card_close`. Dotychczas błąd tego drugiego zapisu
był połykany, więc karta i Inbox mogły pozostać niespójne.

PO: `POST /api/action-cards/:id/reopen` ustawia OPEN i aktualnego aktora/czas. Ta sama
bramka co close: zalogowany członek organizacji, również peer niebędący właścicielem → 200;
obca organizacja i brak karty → 404; bez JWT → 401. Nie rozszerzono uprawnień. Powtórny
reopen otwartej karty → 200, bez żadnej zmiany jej wiersza ani Inbox. Przyjęto semantykę
idempotentnego sukcesu; close również nie przepisuje już czasu zamkniętej karty.

Obie strony wykonują się w jednej transakcji z blokadą wiersza karty (`FOR UPDATE OF ac`),
a następnie istniejącej projekcji Inbox. Reopen przywraca wyłącznie resolved z dokładnym
znacznikiem `action_card_close`: pending, source_status OPEN, resolved_at NULL, usunięty
closedBy, pozostałe metadata zachowane. Manual resolved i dismissed pozostają nietknięte,
nawet dismissed ze starym znacznikiem systemowym. Brak Inbox jest legalny, nic nie jest tworzone.
Uszkodzona metadata nie powoduje500 i nie daje dowodu systemowej własności dla reopen.
Retry close naprawia stary częściowy zapis CLOSED+pending bez zmiany zamkniętej karty.

Zmiana close jest konieczna dla tej samej przyczyny: bez wspólnego row lock opóźniony zapis
starego close mógł zamknąć Inbox już po reopen. Po zmianie błąd któregokolwiek zapisu daje
500 i rollback całości, zamiast dotychczasowego sukcesu z połkniętym błędem Inbox.
Nie zmieniono queryHelpers, schematu, innych kart ani mechanizmu historii.

### Interfejs i rodzina

ActionCardPage przełącza Close/Reopen w tym samym miejscu, stylu i z istniejącą ikoną Check.
Przewód obejmuje też ActionCard → ActionCardList → KpiToolPage oraz klienta API.
EN `Reopen card`, PL `Otwórz ponownie`; powiadomienia sukcesu/błędu mają klucze obu języków.
Przycisk jest zablokowany podczas zapisu; błąd nie zmienia stanu karty lokalnie.
Istniejąca akcja nawigacyjna `Open card` pozostaje odrębna od zmiany cyklu życia
(i poprawiono jej mylący fallback tekstowy). KpiToolPage zachowuje zastany translator pl/en;
nowe klucze używają osobnego aliasu `translate`.
Rodzeństwo tej samej przyczyny: close, strona karty i lista kart KPI — objęte zmianą.
Pozostałe typy kart N i ogólny Inbox nie zostały refaktoryzowane.

### Stały mianownik RED → GREEN

| Kontrola | RED | GREEN | Dowody poza repo |
|---|---|---|---|
| RealPG ApiGateway JWT, 8 testów, retry=0 | 7 failed / 1 passed | 8 passed | `e2-red8-final.log`, `e2-green8-final.log` |
| Render/klik ActionCard, 4 testy, retry=0 | 3 failed / 1 passed | 4 passed | `e2-front-red.log`, `e2-front-green.log` |
| TypeScript serwera po finalnym kodzie | — | exit 0 | `e2-server-tsc-final.log` |
| esbuild per 5 zmienionych plików frontu | — | 5/5 | `e2-esbuild.log` |
| Vite build z manifestem, heap 8GB | — | exit 0, 45.67s | `e2-build-final.log`, `dist/.vite/manifest.json` |

RealPG: close→reopen+SQL readback; idempotencja; same-org peer; foreign/anon/missing;
manual resolved; dismissed; brak Inbox; rollback obu kierunków przy kontrolowanej awarii
**zarówno zapisu Inbox, jak i karty**; rzeczywiste czekanie obu requestów za row lock
potwierdzone przez pg_stat_activity; naprawa legacy partial-close; błędna metadata.
RED przywraca dwa pliki backendu z HEAD E1 (dla E2 identyczne z markerem), potem wracają
kopie GREEN, bez stash/reset. W obu końcowych biegach identyczne 8 przypadków.
Pierwszy build wykrył zdublowane `t` w KpiToolPage; alias poprawiono i ponowny build przeszedł.
Nie zaliczamy wcześniejszego nieudanego buildu jako dowodu.

### UI i granice pomiaru

Konto lokalne `audyt@dbr77.local` powstało w osobnej organizacji kopii DB, bcrypt zgodny
z aplikacją, onboarding zakończony. Realny POST /api/auth/login dostarczył sesję JWT;
Playwright używa tej sesji. Karta `274e62e8-0e09-4267-beb8-cf159c46c5e4` powstała realnym API.
Jeden kontekst 1440×900; motyw z zustand, stabilność treści 3×400ms; klik Close→200,
klik Reopen→200, reload→OPEN/Close card w obu motywach. Bez mockowania endpointów.

Zrzuty własne, obejrzane: `evidence/n1-reopen-card/closed-light.png`, `closed-dark.png`,
`reopened-reload-light.png`, `reopened-reload-dark.png`; każdy ma JSON z URL, stanem,
motywem, czasem, luma i odpowiedziami HTTP. `summary.json` zachowuje surowe błędy.
Średnia luma i różnice znajdują się w tabeli poniżej (próg różnicy >40).

| Stan | Light | Dark | Różnica |
|---|---:|---:|---:|
| closed | 247.71 | 24.92 | 222.80 |
| reopened-reload | 247.80 | 24.85 | 222.95 |


0 pageerror, 0 błędów lifecycle. W konsoli występują wyłącznie 404 `/api/health` i
`/api/csrf-token`: są montowane w aplikacyjnym index.ts poza Gateway, którego minimalny
przyrząd używa bez index.ts. Nie ukryto ich ani nie dodano sztucznych odpowiedzi200.
To ograniczenie przyrządu, nie dowód poprawnego globalnego bootstrapu; E3 wymaga prawdziwych
handlerów health/CSRF. Nie wykonano osobnego żywego kliknięcia listy KPI ani polskiej sesji;
lista ma test render/klik i esbuild, polski klucz jest dostarczony. UI nie dowodzi całego produktu.


## 4. E3 — PARTIAL

Finalny odbiór i pełna tabela per moduł: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/POMIAR_BUNDLE_20260912.md`, commit dowodów `3d79d82972a7cdcc18583d2107081b36e2a18dff`. Kod po krokach: `375660f7d1b8bd171bf52a9f271eefdd2b986c1e`. Wspólny boot 5615909→1911610B spełnia próg2MB; pełny cold zalogowanego My Work 7010816→5788473B decoded JS go nie spełnia. Transfer1874354→1782616B, liczba skryptów54→263; gotowość2455→2462ms nie dowodzi przyspieszenia.

Obejrzano osobiście wszystkie19parPNG (15 prawdziwych modułów sidebar + cold +3karty), bez nowej regresji renderu w light1440. Znane2automatyczne PUT403 na CLOSED initiative występują w obu fazach, więc zero błędów produktu NIEosiągnięte. Root potwierdził Help first-open/state/deep-link oraz public auth bez prywatnego layoutu; artykuł Help i prawdziwy voice pozostają nieprzetestowane. Historyczne kroki1/2 poniżej opisują stan pośredni, nie zastępują tego wyniku.

## 5. E4 — przygotowanie narzędzi i lokalny odbiór

DEC-472 wyznacza **staging** jako cel pilotażu; historyczna nazwa pliku z „demo” nie zmienia celu. Dostawa przygotowuje narzędzia operatora. Wszystkie wykonania opisane niżej używały wyłącznie własnego PostgreSQL18 w cx-codex4-pg, loopback6455/cx4_*, realnego ApiGateway4214 i prywatnych plików poza repo. Bez poczty, schedulerów, dotenv, obejścia auth i bez połączeń z żywymi środowiskami. API montuje realne health/CSRF/sanitization/error handlers; health200. MOCK_DB=false/RUN_DB_TESTS=1; mock dotyczy Redis, nie PG lub HTTPlogin. Stanowisko rozpoczęte przy25GiB wolnego. Oryginalny prepare integratora nie był ponawiany.

### E4.1 — CI

Marker: staging nieobecny w push i pull_request. Dodany do obu oraz do istniejących warunków jobów/kroków, aby samo uruchomienie workflow nie kończyło się pominięciem testów. YAML safe_load PASS; deklaratywne RED marker → GREEN aktualne trigger branches. Żaden job tego workflow nie wdraża aplikacji, więc nie dodano fikcyjnego deployment if. Konfiguracja nie dowodzi, że CI przejdzie.

Po push staging uruchamiają się lint/typecheck i readiness-paths, następnie zależne quality/skip/levels/unit/component/integration/colocated/security/initiatives/acceptance, E2E gates, coverage i summary; readiness-smoke zależy od readiness-paths. Non-PR obejmuje performance, security, l4-smoke, e2e-runtime-smoke i coverage. PR-only patch-coverage/pr-gate nie startują po push. Szczegółowe needs/if/timeouts: `codex4-artefakty/e4-ci-config-review.json`.

Read-only `gh run list` zachowano w `e4-ci-history.json`: ostatni demo34331513097 zakończył się failure po8m58s od createdAt do updatedAt, trzy develop po11m04s/10m06s/9m56s, też failure. To czas obserwowany z kolejką, nie prognoza pełnego zielonego zestawu. Brak staging w ostatnich10wynikach nie dowodzi „nigdy”; czas nowego staging run UNKNOWN. Nie wywołano workflow ani push.

### E4.2 — konta pilotażu

`pilotaz-demo-konta-20260912.mjs`: dokładnie4 potwierdzone adresy w UUIDDBR77; bcrypt koszt10, losowe14znaków, nowe konto MEMBER + ACTIVE membership, email verified, onboarding_completed jak `/onboarding/skip`. Nie fabrykuje zgód prawnych ani stanu organizacyjnego onboardingu. Istniejące users.role i membership.role pozostają oddzielnie zachowane; login używa membership jako SSOT. Brak membership istniejącej osoby zatrzymuje całość (`EXISTING_MEMBERSHIP_REQUIRES_REVIEW`), nie przywraca odebranego dostępu. Obca organizacja, nieaktywne konto lub membership, duplikat email również STOP.

Stan PRZED (w tym wrażliwe skróty/tokens) i nowe credentials trafiają do prywatnych0600wx plików poza checkoutem. File fsync + parent directory fsync przed COMMIT; błąd zapisu zatrzymuje transakcję. Credentials mają PRECOMMIT_VERIFY_BEFORE_DISTRIBUTION, dopiero ACK daje osobny receipt. Lost ACK oznacza COMMIT_OUTCOME_UNKNOWN, nigdy potwierdzony rollback; release/end nie maskują wyniku. Reset rows są usuwane, aktywne refreshe odwołane. Forced password change w produkcie NIEISTNIEJE; wcześniejsze accessJWT żyją do expiry. Reset route przechowuje losowy32B hex token z expires_at (authRuntime.ts:64, domyślnie60min, konfigurowalne), odrzuca brak/wygaśnięcie i użycie bieżącego hasła; aplikacja również hashuje nowe hasło bcrypt10.

Lokalnie: dry-run bez zmian6tabel; apply + realne4HTTPloginy; odmowa starych haseł istniejących kont; zachowanie obu ról i efektywnej roli HTTP; drugi apply stałe UUID/brak duplikatów +4loginy; pełne pg_dump/pg_restore do osobnej cx4_pilot_rollback i zgodność readback PASS. Oba apply: committed:true, receiptWritten:true, cleanupWarnings:[] odczytane z logów. Powtórny pilot jest rotacją hasła, nie zerowym zapisem.

### E4.3 — klony i ochrona danych

Premisa20klonów NIEodtworzona w dostarczonej lokalnej kopii: SELECT prefiksu ateliertoys-demo-session-% zwrócił0 (`e4-cleanup-premise.json`), stan staging UNKNOWN. Utworzono jawne lokalne sentinele, zamiast twierdzić, że skasowano20żywych organizacji.

Źródła istniejącego sprzątacza: index.ts:612 nie startuje schedulera w test lub DISABLE_SCHEDULER=true; Scheduler.ts:242 ma już godzinowy job, TrialCron.ts:154 woła demoService.cleanupExpiredDemos. demoService.ts:65 wymaga DEMO_CLEANUP_ENABLED; :70 używa osobnego DEMO_CLEANUP_TTL_HOURS(default24), podczas gdy demo/demoSessionService.ts:25 używa DEMO_SESSION_TTL_HOURS. demoService.ts:87 chroni też nazwę „atelier toys”, :181 filtruje whitelist po nazwie, więc klon z tą nazwą może zostać wyłączony mimo TTL. Nie znamy rzeczywistych env/logów20klonów; są to konkretne możliwe warunki, nie ustalona przyczyna produkcyjna.

Propozycja nadzorcy: sprawdzić flagę/cadence i oba TTL; zastąpić ochronę po samej nazwie jawnie ustalonymi bazowymi ID + człowiekiem przez obie ścieżki/obie daty login + legalhold + aktywna sesja, z realną transakcją. Samego schedulera/demoSeedService nie zmieniono. Zastany demoService guard patrzy tylko na users.organization_id i domenę seed, więc nie należy go bez review utożsamiać z nowym, surowszym skryptem.

`sprzatanie-klonow-demo-session-20260912.mjs` wymaga listy dokładnych ID, kwalifikacji DEMO/nonpaying/expired, bazowych/protected IDs i seed allowlist. Chroni primary i membership, last_login OR last_login_at, orphan membership, zewnętrzne membership seed, legalhold (nieznany/query failure = STOP), aktywne sesje, template i global/reserved IDs. Nie wybiera celu po nazwie. Blokuje tabele przed kwalifikacją/zapisem; reużywa `organizationLifecycleService.deleteOrganizationDataInTransaction` i jego kolejności FK, bez własnej listy DELETE.

Apply wymaga pełnego custom PGDMP i SHA256, źródłowego host/port/database zgodnego z target, prywatnego niesymlinkowego pliku oraz ścieżki/hash dowodów rzeczywistego restore do review. Manifest/counts nie zastępują dumpu. Hash JSON nie jest dowodem odtwarzalności. Harness rzeczywiście wykonywał pg_restore i porównał wszystkie public-table hashes/counts, sekwencje i large objects. Nie narzucono arbitralnego max1h, opcjonalny maxAgeSeconds jest jawnie ustalaną polityką.

Lokalnie9negatywnych partii valid+protected odrzuconych właściwymi kodami i cała baza bez zmian; dry-run bez zmian; poprawny apply usunął tylko valid i CASCADE child; protected/global sentinel rows identyczne. Drugi apply zero zmian. Pełny restore do cx4_cleanup_rollback odzyskał klon i dziecko bez organization_id. Wszystko PASS. Pierwsza próba kanonicznej inicjatywy była NOT_PROVEN przez błąd harness sourceType='manual'; poprawiono na kontrakt MANUAL_HUB/provenance i osobna próba po czystce przeszła POSTsource-proposals201→POSTregistrations201→GET200→SQLie_aggregate_state. Bez osłabiania bramek lub SQL zastępującego tworzenie inicjatywy.

### Walidacja, komendy i ograniczenia

Pure testy bezpieczeństwa43PASS; mutation usunięcia guard istniejącego membership: RED1FAIL/42PASS → GREEN43 (integrator, e4-safety-*.log). To nie zastępuje RealPG. Runtime/harness źródła w `scripts/dev/codex4-e4-local-acceptance.mjs`; prywatny katalog run: `codex4-scratch/e4-local-20260912`, state/credentials/manifestów nie wolno publikować. Końcowe dodatkowe próby opisano poniżej.

Komendy operatora są szablonem do review, NIEautoryzacją ich uruchomienia zdalnie. Target JSONversion1: operation, intendedEnvironment=staging, executionEnvironment=staging, dokładne host/port/database/organizationIds, backup metadata i kwalifikacja cleanup. W local-copy używa się loopback6455 i cx4_*. Brak auto-discovery lub domyślnego zdalnego hosta. Staging wymaga jawnego absolutnego --tls-ca, poprawnego PEM i ssl.rejectUnauthorized:true.

```sh
DATABASE_URL='<reviewed PostgreSQL URL>' node scripts/dane/pilotaz-demo-konta-20260912.mjs --target=staging --expected-host='<reviewed host>' --expected-database='<reviewed database>' --tls-ca=/absolute/reviewed-ca.pem --target-manifest=/absolute/private/pilot-target.json --manifest=/absolute/private/pilot-dry.json
DATABASE_URL='<reviewed PostgreSQL URL>' node scripts/dane/pilotaz-demo-konta-20260912.mjs --target=staging --expected-host='<reviewed host>' --expected-database='<reviewed database>' --tls-ca=/absolute/reviewed-ca.pem --target-manifest=/absolute/private/pilot-target.json --manifest=/absolute/private/pilot-before.json --apply --backup=/absolute/private/full.dump --out=/absolute/private/passwords.json
DATABASE_URL='<reviewed PostgreSQL URL>' node scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs --target=staging --expected-host='<reviewed host>' --expected-database='<reviewed database>' --tls-ca=/absolute/reviewed-ca.pem --target-manifest=/absolute/private/cleanup-target.json --manifest=/absolute/private/cleanup-dry.json
# Apply cleanup: same reviewed target, distinct --manifest, plus --apply --backup=/absolute/private/full.dump.
```

Review E4 wykonał autor; NIEjest niezależnym odbiorem. Nadzorca musi przejrzeć pełne wyniki restore, listę celu i aktualny stan przed jakimkolwiek live apply.

## 6. SHA

E1: `5544f2f3fe36434a6c7fc6ca9a29b5272feea0c2`.
E2: `934e08de86f23d8f48438a69e9dde1522136c04c`.
E3: kod `8ff9565b7f`, `ff2caf56a5`, `375660f7d1`; evidence/report `3d79d82972a7cdcc18583d2107081b36e2a18dff`.
E4: commit zawierający aktualizację tej sekcji; SHA w końcowym handoffie.
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

Żadne żywe środowisko; UI E1 (backend-only); pełny front tsc,
pełna regresja aplikacji, kanoniczny inbox runtime i oddzielne trasy delegate/portfolio.
Nie zmierzono wszystkich istniejących zadań bez projektu ani liczby z pierwotnej premisy;
reprodukcja używa izolowanych fixture w legalnej lokalnej kopii. Brak migracji i zmian
uprawnień; nie ma dowodu wdrożenia, wyłącznie lokalnych E1/E2, częściowego E3 i narzędzi E4. E4: brak live TLS handshake, actual lost-COMMIT-ACK injection, dwusesyjnego race i testu crash/power-loss; pure mocks nie dowodzą tych scenariuszy. Nie sprawdzono aktywnego staging CI ani środowiskowych przyczyn20klonów. Nie uruchomiono pełnego fronttsc lub kolejnego builda dla E4 (pliki Node/CI).

## E3 — krok 1, dostawa częściowa (kolejny krok wymagany)

Premisa zmierzona na archiwum markera d4ebea2c86:5615909B JS wspólnego startu (App3781294B + AppProviders1517348B + index317267B),3chunki. To5.36MiB; raportowane dawniej7chunków nie odtworzyło się w tym lokalnym buildzie. Sam index317267B zaniża wynik: normalny boot bezwarunkowo importuje App. Pomiar scripts/dev/measure-boot-bundle.mjs liczy unikalne pliki w przechodnim statycznym domknięciu obu korzeni. JS pierwszej wybranej lazytrasy i czas rzeczywistego ekranu są osobnym pomiarem.

Krok1: StudioUnavailableView, AuthView, ProductEntryPage przez istniejący lazyWithRetry/Suspense. HelpSidePanel dopiero przy pierwszym otwarciu, potem zachowuje stan po zamknięciu; listener deep-link pozostaje aktywny. Diagnoza: Studio→SplitLayout→UnifiedChatPanel→TipTap; Help/Landing importowały całą przestrzeń ikon. Bez zmiany UI i bez manualChunks.

Wspólny boot po kroku1 na kodzie E2+zmiana: **2459398B**, 3chunki. Cel≤2000000B jeszcze NIEosiągnięty. Build0 (35.65s,heap8GB). Pierwszy baseline przy domyślnym heap4GB zakończył się OOM; powtórka przy8GB przeszła38.44s. Oba wyniki zachowane poza repo.

Dowody poza repo: codex4-artefakty/e3-before-chunks.json, e3-marker-build-8gb.json/log, e3-step1-current-chunks.json, e3-step1-current-build.json/log, e3-step1-module-map.json. Niezależny source review: brak znalezionego blokera kroku1; odbiór przeglądarkowy i limit pakietu pozostają NIEUDOWODNIONE dla zakończeniaE3. Następny krok: odroczenie SDKgłosowego, zachowanie anulowania sesji, odbiór wspólnej wersji PRZED/PO. Nie przenosimy tej częściowej dostawy do statusuE3PASS.

## E3 — krok 2, nadal PARTIAL

SDK GoogleGenAI ładowany przy rozpoczęciu voice w Teresie i Annie. Unmount unieważnia token próby; opóźniony start nie otwiera mikrofonu/sesji po stop lub unmount. Niezależny review wykrył brak unieważnienia przy unmount; naprawiono przed commitem. Nowe testy rzeczywistego oczekiwania (teardown AudioContext i voice-context fetch, nie udawane opóźnienie importu): RED4FAIL/3PASS → GREEN7/7. Istniejące Teresa13/13 i capability/barge-in7/7 PASS. Brak dowodu rzeczywistej rozmowy z zewnętrznym dostawcą w tym lokalnym teście.

Build PASS36.95s, wspólny boot **2182459B** (App624783, AppProviders1240409,index317267); cel2000000B nadal nieosiągnięty. Zmniejszenie od baseline około61.1%. Nie ogłaszamy E3PASS. Logi codex4-artefakty/e3-step2-build.json/log, e3-voice-*-red/green.log oraz e3-voice-existing-*.log.

Przegląd baseline:15rzeczywistych modułów sidebar, dodatkowo coldMyWork i3karty =19PNG obejrzanych niezależnie, bez pustych ekranów. Oryginalna premisa16pozycji niepotwierdzona. Realny defekt: otwarcie CLOSED inicjatywy wykonuje automatyczny PUT403; GET renderuje kartę, widoczne Unsaved. Pozostaje osobnym problemem produktu; nie ukrywamy go zmianą fixture. Końcowy pomiar czasu i before/after jeszcze trwa; wspólny boot nie oznacza całego JS pierwszego zalogowanego ekranu.

## E3 — krok 3, wspólny start poniżej progu; odbiór całości nadal PARTIAL

MainLayout ładowany przez istniejący lazyWithRetry i wspólny Suspense tras. Publiczny login nie potrzebuje powłoki zalogowanego użytkownika. Dla /my-work powłoka nadal jest potrzebna i jej JS musi wejść do osobnego pomiaru pierwszego ekranu; nie utożsamiamy tych metryk. Bez zmian wyglądu, guardów lub manualChunks.

Common boot **1911610B**,3chunki (App354014, AppProviders1240369,index317227), cel≤2000000 osiągnięty wyłącznie dla tej jawnej definicji. Build z --manifest PASS35.21s. Poprzedni build PASS35.63s nie wygenerował manifestu; pomiar poprawnie odmówił ENOENT i wykonano nowy build. Dowody e3-step3-build-manifest.log i e3-step3-chunks.json poza repo. Pełny before/after zbudowanych stron oraz Help regresja trwają; do czasu ich zakończenia E3 pozostaje PARTIAL. Znany odziedziczony autoPUT403 na CLOSED inicjatywie nadal otwarty, poza logiką optymalizacji.


## E4 — końcowe dodatkowe dowody lokalne

- Cztery rzeczywiste source mutants na osobnych cx4_cleanup_mut_*: usunięcie guard membership, legalhold, last_login i last_login_at umożliwiło skasowanie chronionego rekordu; każda odpowiadająca poprawna próba zatrzymała całą partię i zachowała bazę. **4/4 PASS**. Każda baza mutanta miała pełny backup i rzeczywisty restore/readback przed apply. Produkcyjne źródła nie były mutowane; kopie wyłącznie w prywatnym scratch.
- `pilot-security`: rzeczywisty login wystawił refresh; /auth/refresh200 potwierdził jego działanie. Lokalny reset token utworzony według schematu aplikacji był odnaleziony przez /reset-password (odmowa ponownego użycia bieżącego hasła PASSWORD_REUSE_NOT_ALLOWED). Po ponownym CLI apply refresh401 i reset400/PASSWORD_RESET_INVALID, SQL0aktywnych refresh i0resetów. Nowe4hasła logują. **PASS**, bez wysyłania poczty.
- `pilot-faults`: pełny nowy backup+restore/readback. Zastany prywatny plik --out powoduje EEXIST dopiero po SQLrotacji: CLI odmówił,6tabel identycznych, brak successreceipt — **realny rollback PASS**. W kopii safety modułu wstrzyknięto wyjątek klienta bezpośrednio po prawdziwym COMMIT. CLI zwrócił COMMIT_OUTCOME_UNKNOWN bez receipt; nowe połączenie PG sprawdziło skróty, a4loginy potwierdziły rzeczywisty zapis. **PASS klasyfikacji i rozpoznania skutku**, nie symulacja awarii sieci/utraty TCP. Nie ponawiano niejednoznacznej operacji. Ten bieg zmienił hasła tylko lokalnych kopii; jego plik pozostaje oznaczony PRECOMMIT i prywatny, nie służy dystrybucji.
- Pierwotne NOT_PROVEN dla token replay i client fault w fazie pilot pozostają w surowych wynikach; późniejsze osobne fazy uzupełniają te dowody. NOT_PROVEN dwusesyjnego race, mutanta predykatu organizacji kanonicznego silnika, mutanta template i rzeczywistej awarii sieci pozostają otwarte. Nie ogłaszamy pełnego odbioru bezpieczeństwa operatora lub całej aplikacji.
- Przyrząd uzupełniono o opcjonalne initiative-probe / pilot-security / pilot-faults / pilot-membership-guard, zawsze local6455/cx4_* i prywatne rozłączne ścieżki. Kontrole node --check dla4plików.mjs PASS. Jedna odrzucona próba syntax-check podczas pisania dodatkowego reset fixture została poprawiona przed wykonaniem; nic z błędną składnią nie wykonało SQL.

Bazy i prywatne dowody pozostawiono integratorowi do niezależnego odbioru w izolowanym kontenerze; nie są bazami prezentowanymi użytkownikom. Do usunięcia po review wyłącznie własne cx4_* i własny proces API, bez kasowania cudzych zasobów. E4 nie potrzebuje nowego builda ani tsc serwera (Z9 wymagał ich po E1/E2, wykonane wcześniej). Brak powtórzenia prepare, no push/live.

Dodatkowo realny preflight braku membership: osobny cx4_pilot_membership_guard sklonowany z ukończonego, niezmienionego restore; lokalna fixture usuwa membership. CLI dry-run kończy EXISTING_MEMBERSHIP_REQUIRES_REVIEW, sześć tabel/hasła bez zmian, dostęp nie został odtworzony. PASS tej negatywnej próby; nie jest to osobna realna próba apply przy brakującym membership. Bezpieczne zestawienie wszystkich faz (bez credentials): codex4-artefakty/E4_LOCAL_ACCEPTANCE.json.

## E4 — poprawka wyścigu kwalifikacji po niezależnym HOLD (12.09)

Niezależny odbiór `C4_E4_INDEPENDENT_REVIEW.md` wykazał P1: SERIALIZABLE zapamiętywał snapshot na discovery katalogu, zanim cleanup zdobył blokady tabel. Legal hold zatwierdzony na drugim połączeniu między discovery i LOCK był niewidoczny; organizacja została usunięta. Pierwotny RED zachowany bez zmian: `codex4-scratch/review-cleanup-race/result.json`.

Poprawka dotyczy wyłącznie cleanup apply: przed pierwszym odczytem w transakcji ustawia READ COMMITTED; discovery znajduje tabele, istniejący SHARE ROW EXCLUSIVE blokuje wszystkie stałe guard tables i dynamiczne tabele org, a dopiero po zdobyciu blokad wykonywana jest **cała kwalifikacja**. Każdy guard widzi zapisy zatwierdzone przed LOCK; blokady uniemożliwiają zmianę danych podczas kwalifikacji/usuwania do końca transakcji. Posortowana lista tabel ogranicza różną kolejność locków. Pilot pozostaje SERIALIZABLE, dry-run REPEATABLE READ READ ONLY, kanoniczny silnik kasowania i pozostałe zabezpieczenia bez zmian. To nie jest nowe globalne ustawienie izolacji.

Przyrząd `scripts/dev/codex4-e4-cleanup-race.mjs` używa wyłącznie przekazanej bazy `cx4_review_cleanup_race` na127.0.0.1:6455 i jawnego lokalnego Docker socket. Przed każdym scenariuszem wykonuje prawdziwy restore pełnego custom dump syntetycznej bazy do tej samej własnej bazy, zachowuje stdout/stderr procesu i readback. Nie jest to restore pełnego schematu staging ani jego odbiór. Dwa połączenia PG, rzeczywisty runCleanup i kanoniczny delete; wrapper steruje tylko momentem drugiej transakcji między discovery i LOCK. Nie dotknięto cx4_pilot/cx4_cleanup/API4214/live.

Dowody:

- Autor przed poprawką: `codex4-scratch/e4-race-red-20260912/result.json`, exit1,11/13 testów czerwonych. Dziewięć guardów INSERT (hold, primary human, membership human, last_login, last_login_at, orphan membership, external membership, active demo session, active tenant) przepuszczało usunięcie; template/paid UPDATE zachowały org przez PostgreSQL40001, lecz nie dawały prawidłowego rozpoznania guardu. Nie opisujemy tych dwóch jako udanego niebezpiecznego skasowania.
- Po poprawce: `codex4-scratch/e4-race-green-20260912/result.json`, exit0,13/13 PASS; ten sam moment zatwierdzenia równoległego guardu. Legal hold jest widoczny jako1wiersz i daje typed LEGAL_HOLD.
- Wzmocniony końcowy readback: `codex4-scratch/e4-race-green-readback-20260912/result.json`, exit0,13/13 PASS. Każdy z11guardów zachowuje wszystkie wiersze sześciu tabel kwalifikacji (porównanie deterministycznych hashy po zatwierdzeniu drugiej transakcji i po odmowie cleanup), bez commit receipt. Sześć prób zapisu po LOCK (organizations/users/membership/policies/demo_sessions/demo_session_tenants) kończy55P03 przy150ms lock_timeout. Niechroniony valid clone zostaje prawidłowo usunięty.
- Dotychczasowe czyste testy safety:43/43 PASS, `codex4-artefakty/e4-race-safety-green.log`; node --check obu zmienionych .mjs i git diff --check PASS. Nie wykonywano ciężkiego build/tsc — zmiana operatora.mjs i lokalnego harnessu.

Komenda odbioru (nowa, nieistniejąca prywatna ścieżka OUT; destructive tylko na wskazanej własnej bazie review):

```sh
node scripts/dev/codex4-e4-cleanup-race.mjs --out=/absolute/new/private/review-output --source=/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/review-cleanup-race/before.dump
```

Status autora: **FIX + LOCAL13/13 + PURE43/43; oczekuje niezależnego ponownego odbioru**, E4 HOLD nie jest automatycznie zniesiony. Dotychczasowe ograniczenia prawdziwego network ACK loss, pełnego schematu/concurrent DDL, canonical org-predicate mutation i live TLS pozostają. Ostatni scenariusz pozostawia syntetyczną bazę review po valid delete; każdy następny bieg przyrządu odtwarza wyłącznie tę bazę. Nie ma automatycznego push/deploy.
