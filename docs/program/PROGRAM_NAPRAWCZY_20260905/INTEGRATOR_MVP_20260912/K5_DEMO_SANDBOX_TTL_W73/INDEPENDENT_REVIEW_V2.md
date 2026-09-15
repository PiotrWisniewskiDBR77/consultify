# K5 demo sandbox TTL v2 — independent re-review

**Werdykt: ACCEPT. Sześć blockerów z przeglądu `706f5127` jest zamkniętych na exact kandydacie `8304d3e3a94f100deba60d6834bb3568217f5338` (content `517cc884de`).**

Baza produktu: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`  
Poprzedni HOLD: `706f5127e467d25976f7cd3afee767aa8a830271`  
Środowisko odbioru: świeży PostgreSQL 16, `127.0.0.1:6456/consultify_k5_review`, `DB_TYPE=postgres`, `MOCK_DB=false`.

## Zamknięcie blockerów

1. **Jedna przypięta transakcja — zamknięte.** `cleanupExpiredDemos()` wywołuje
   `withPinnedPostgresTransaction()`. Ten helper pobiera jeden `PoolClient`, na
   nim wykonuje `BEGIN`, lock/re-check, wszystkie zapytania purgera, readback i
   `COMMIT` albo `ROLLBACK`, a klient zwalnia w `finally`.
2. **DELETE fail-closed i uczciwy licznik — zamknięte.** Ścieżka transakcyjna
   używa `tx.queryRun()` bez fallbacku. Błąd przerywa purger, uruchamia rollback,
   a `deleted` rośnie dopiero po zerowym readbacku organizacji i udanym
   zakończeniu transakcji.
3. **Lock i re-check bezpieczeństwa — zamknięte.** Pod `SELECT ... FOR UPDATE OF
   o` ponownie sprawdzane są: wzorzec id, typ `DEMO`, bezwzględny wiek, stan
   płatności, brak realnego człowieka i whitelist id/nazwa. Fresh schema ma FK
   `users.organization_id -> organizations.id`, więc lock rekordu organizacji
   chroni również okno przed współbieżnym dopisaniem członka.
4. **Bezwzględne 24 h — zamknięte.** Zarówno discovery, jak i re-check wymagają
   `o.created_at < cutoff`; stan `ended` i `expires_at` sesji nie stanowią już
   alternatywnej ścieżki kwalifikacji. Świeża organizacja z sesją `ended`
   przetrwała test.
5. **Mianownik 49 tabel — zamknięte w zadanym znaczeniu.** Fresh strict utworzył
   wszystkie 49/49 zależnych tabel. Test przerywa się przy braku którejkolwiek,
   a hook potwierdza wykonanie rzeczywistego `DELETE` dla każdej. Lista kodu ma
   wszystkie 50/50 nazw planu CTO (49 zależności + `organizations`) oraz 13
   dodatkowych tabel, bez braków.
6. **Fixtures bezpieczeństwa i rollback — zamknięte.** Płatna organizacja oraz
   świeża organizacja z zakończoną sesją pozostają. Zmiana płatności po discovery
   jest wykrywana przez re-check. Deterministyczny błąd po `DELETE tasks` cofa
   wcześniejsze kasowania: organizacja, użytkownik, projekt, zadanie i komentarz
   pozostają 5/5, a `deleted=0`.

Poza główną suitą wykonałem dwa dodatkowe zachowaniowe probe'y po discovery:
realny użytkownik `@acme-industries.pl` dodany przed lockiem zatrzymał kasowanie
(`deleted=0`, organizacja pozostała), a dopisanie id do whitelisty przed
re-checkiem również zatrzymało kasowanie (`deleted=0`, organizacja pozostała).

## Niezależnie uruchomione dowody

- Fresh strict: **918/918 migracji**, bez migracji dodanej przez K5.
- `demoCleanup.e2e.test.ts` z configiem acceptance, `--retry=0`: **6/6 PASS**.
- Importery na kandydacie: `demoSessionDatasetSignal` 9/9 oraz
  `trialCronDemoCleanup` 3/3, razem **12/12 PASS**.
- Te same importery na exact bazie `f2628a0d36`: **12/12 PASS**; brak regresji
  nazw testów.
- Server TypeScript: **RC 0**.
- Front TypeScript: **RC 2, 177 błędów, 7427 listFiles**; próg W73 zachowany.
- `check:jezyk:ci`: PASS, K4en -68, K7 -1.
- `check:list-canon`: **349**, bez wzrostu.
- `check:artefakt`: **8-0-117**, bez wzrostu.
- Build produkcyjny z `NODE_OPTIONS=--max-old-space-size=8192`: **RC 0**.
- Nowe `as any`: **0**. Migracje produktu: **0**.

## Różnice nieblokujące

- Niezależny pomiar `--listFiles` zwrócił 7427 zamiast 7424 z logu autora,
  przy identycznych 177 błędach. Różnica dotyczy środowiska zależności; limit
  błędów i wymaganie realnego uruchomienia kompilatora są spełnione.
- Pierwszy build z domyślnym limitem pamięci Node zakończył się OOM po
  transformacji 10 754 modułów. Powtórzenie z limitem 8 GB zakończyło się RC 0;
  jest to ograniczenie procesu odbiorowego, nie czerwień produktu.
- Główna suita potwierdza wykonanie DELETE w każdej z 49 tabel; nie umieszcza
  osobnego wiersza fixture w każdej tabeli. Ten claim jest celowo ograniczony do
  istnienia tabeli, poprawnego wykonania zapytania i zerowego readbacku, a nie do
  pełnej reprezentatywności każdego modelu domenowego.

Nie uruchamiano cleanupu na stagingu, demo ani produkcji. Lokalny kontener i jego
wolumen zostały usunięte po zebraniu dowodów.
