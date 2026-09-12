# CODEX4 — raport E1 i E2 (12.09.2026)

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


## 4. E3

NIEWYKONANE w tym przekazaniu — dalsza praca integratora.

## 5. E4

NIEWYKONANE w tym przekazaniu. Starsza instrukcja kont wskazuje demo, nowsza decyzja
pilotażu staging; przed użyciem narzędzi integrator ma ujednolicić cel.

## 6. SHA

E1: `5544f2f3fe36434a6c7fc6ca9a29b5272feea0c2`.
E2: commit zawierający aktualizację tego raportu; pełny SHA w przekazaniu integratora.
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
uprawnień; nie ma dowodu wdrożenia, wyłącznie lokalnych E1/E2.

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
