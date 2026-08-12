# Case Workspace V1 — HANDOFF, 2026-08-12

> **Status: `WORK_IN_PROGRESS — NOT A CANDIDATE`.**
> Nie zgłaszam `READY_FOR_CODEX_REVIEW`. Powód jest konkretny i wypisany
> w §5: jeden otwarty, powtarzalny defekt (F2) i dwie otwarte decyzje
> właściciela, bez których siedem capability jest w produkcji nieosiągalnych.

---

## 1. Punkty odniesienia

| co | wartość |
|---|---|
| worktree | `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809` |
| branch | `claude/case-workspace-v1-20260809` |
| **BASE_SHA** | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| HEAD na wejściu sesji | `ebe4046df95d92bb7559387f287aef8722060e04` |
| **HEAD na wyjściu** | `5b7dcfc2638b4c15c926e33e5c0812e2a10d1d37` |
| stan drzewa | czyste |
| push / merge / deploy | **żaden nie wykonany** |

Commity tej sesji:
- `472abebf8a` — fale C+D (adaptery, run semantics, outbox, typechecki, rejestry)
- `48d54807e9` — bloker instalacji od zera (ordering migracji)
- `5b7dcfc263` — regresja `tsc` serwera + nieaktualna asercja append-only

---

## 2. WAVE R — recovery NIE był potrzebny

Prompt wejściowy ostrzegał, że `.git` worktree jest uszkodzony i trzeba
odtwarzać z archiwum. **To był fałszywy alarm.** Zweryfikowane:

- `git rev-parse HEAD` → `ebe4046df95d92bb7559387f287aef8722060e04`
- rodzic = `8c763a5a98cc35ade720e9e5211fe054591ed99a` ✓
- `9d17cac114` jest przodkiem HEAD ✓
- `git status --porcelain` = 0 linii ✓
- trzy dokumenty przekazania obecne **w commicie i na dysku** ✓
- metadane worktree istnieją i rozwiązują się poprawnie

Archiwum bezpieczeństwa NIE zostało użyte. Ścieżka awaryjna R3 (rekonstrukcja
z tar.gz) jest **bezprzedmiotowa** — prawdziwe obiekty Git są nienaruszone.
Nie twórz commita „recovery"; nic nie zginęło.

---

## 3. Bramki — ZMIERZONE, z podziałem na dwie konfiguracje

**Kluczowe ustalenie środowiskowe: nie istnieje jedna konfiguracja, w której
wszystko przechodzi.** Testy e2e wymagają backendu **włączonego**; test
wydajnościowy wymaga **wyłączonego**. Każdy pomiar zrobiony w jednej
konfiguracji kłamie o drugiej. Mierz osobno.

| bramka | wynik | konfiguracja |
|---|---|---|
| suita CW bez e2e | **603 / 603 PASS** (76 plików) | backend **DOWN** |
| e2e, pliki osobno | 10/10 i 24/24 | backend **UP** |
| **e2e, oba pliki razem** | **2 FAILED / 32 passed** | backend UP — **§5.1** |
| `server tsc --noEmit` | **EXIT 0** | — |
| `frontend tsc --noEmit` | **EXIT 0**, 0 błędów, 0 markerów crasha | — |
| `git diff --check BASE..HEAD` | **EXIT 0** | po commicie |
| migracja fresh (instalacja od zera) | **PASS** po naprawie — `Database ready`, `/api/ready` 200 | osobna baza |
| replay migracji | idempotentny (`Applying migrations: 0`) | — |
| drzewo | czyste | — |

Komenda testowa — ZAWSZE z `POSTGRES_SKIP_INIT_IN_TEST=1`:

```bash
cd server
DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
POSTGRES_SKIP_INIT_IN_TEST=1 \
DATABASE_URL="postgresql://case_workspace:case_workspace@127.0.0.1:55432/case_workspace_test" \
npx vitest run src/services/caseWorkspace/ src/routes/caseWorkspace/__tests__/ \
  --exclude '**/e2e/**' --environment node
```

---

## 4. Co realnie powstało

### 4.1 Siedem adapterów przestało być martwym kodem

`registerBuiltinCapabilityAdapters` miało **ZERO wywołań produkcyjnych** —
wszystkie adaptery modułów były w realnym wdrożeniu nieosiągalne. Ich testy
przechodziły wyłącznie dlatego, że każdy test sam robił rejestrację
w `beforeAll`. Ten sam wzorzec co outbox worker.

Prawdziwa przeszkoda (a nie przeoczenie): rejestracja **skleja** trwały wiersz
rejestru (UNIQUE na `capability_id` + `capability_version`) z wiązaniem
**w pamięci**, które musi wstawać przy każdym boocie. Drugi boot rzucał
`capability_already_registered`.

Naprawa: wiązanie rejestruje się pierwsze (samo w sobie nic nie daje —
udowodnione: związane, ale niezarejestrowane capability nadal zwraca
`CAPABILITY_NOT_FOUND`), a łapany jest **wyłącznie** ten jeden błąd.
Kontrola ADMIN przez `requireOrgRole` **nietknięta** — udowodnione aktorem
z rolą MEMBER.

### 4.2 Trzy nowe adaptery

Assessment 8/8, Results 7/7, Documents+Presentation 14/14. Wszystkie
**linkują** obiekty natywne, nigdy nie kopiują. Każdy broni się przed
`DbPromise.run()` z `fallback:true` przez ponowny odczyt po zapisie.

### 4.3 Run semantics — 38/38

`ANY` i `N_OF_M` (z walidacją `1 <= N <= M` egzekwowaną dwukrotnie),
`SKIPPED` dla gałęzi niewybranej przez `DECISION_GATEWAY`. Migracja
niepotrzebna — kolumny już istniały. `advanceRun` **nadal** nigdy nie
deklaruje `FAILED` automatycznie (świadome, teraz ze strażnikiem regresji).
Restart udowodniony **realnym osobnym procesem V8**.

### 4.4 Outbox/inbox

`recordInboxProcessingFailure` był martwym kodem — teraz osiągalny realną
ścieżką rekonsyliacji, udowodnione wstrzykiwaniem awarii aż do `DEAD_LETTER`.
Per-wierszowy `next_retry_at` (migracja addytywna), backoff wykładniczy,
dead-letter, rekonsyliacja, metryki.

---

## 5. CO JEST OTWARTE — czytaj to przed ogłoszeniem czegokolwiek

### 5.1 F2 — dwa pliki e2e nie mogą działać razem (POWTARZALNE)

```
osobno:  liveStack.e2e.part2.pg.test.ts  -> 10/10 (dwukrotnie)
osobno:  ten sam test przez -t            -> PASS
RAZEM:   vitest run .../e2e/              -> 2 failed / 32 passed
         × EXECUTING -> FAILED -> retry -> APPROVED   expected 404 to be 200
         × confirming an OLD digest ... fails closed  expected 403 to be 200
```

**To, KTÓRE testy padają, zmienia się między przebiegami** — wcześniejszy
przebieg dał tylko drugą awarię.

Znaczenie: twierdzenie „Golden Cases przechodzą" jest prawdziwe **wyłącznie
przy plikach uruchamianych osobno**, a to nie jest legalna bramka. Kanoniczny
przebieg pełnej suity obejmuje oba pliki.

Nie rozstrzygnięto, czy to izolacja testów, czy realny defekt produktu
(przeciek stanu / cross-tenant, który interferencja tylko ujawnia). Pakiet F2
miał to udowodnić, nie zgadnąć.

### 5.2 Decyzja właściciela — tożsamość bootstrapowa

Podłączenie adapterów jest w kodzie zrobione, ale **za dwiema zmiennymi
środowiskowymi**: `CASE_WORKSPACE_CAPABILITY_BOOT_ACTOR_ID` i
`CASE_WORKSPACE_CAPABILITY_BOOT_ORG_ID`. Dopóki nie wskazują realnego ADMIN-a
i realnej organizacji, blok loguje ostrzeżenie i nic nie robi — czyli
**siedem capability nadal jest nieosiągalnych w tym środowisku**.

W kodzie **nie istnieje** konwencja „platform-admin bootstrap identity" dla
RBAC Case Workspace. To decyzja właściciela, nie do wymyślenia przez agenta.

### 5.3 Decyzja właściciela — testowanie na demo

Piotr poprosił o testy na demo (DBR77, `piotr.wisniewski@dbr77.com`).
To zderza się z twardą regułą tego programu (zakaz zapisów do demo/staging,
wyłącznie disposable PG i dane syntetyczne). Testy Case Workspace **piszą**.
Przedstawione warianty: (a) zostajemy lokalnie, (b) odczyt-only na demo,
(c) świadome zniesienie zakazu. **Bez odpowiedzi.**

### 5.4 Znane, zgłoszone, nienaprawione

- **39 wierszy `IMPLEMENTED_AND_PROVEN`, których `test_ref` nie wskazuje
  istniejącego pliku.** Znalezione przez C5, nierozwiązane.
- 18 wierszy z SHA korpusu dokumentów użytym jako SHA kodu — oflagowane.
- `createNativeDeck` **w ogóle nie sprawdza wyniku zapisu** — gorszy wariant
  klasy `DbPromise`-swallow niż ten z Finance. Adapter się broni ponownym
  odczytem, ale sam serwis został nienaprawiony (poza allowlistą).
- `DatabaseInitializer.ts` ma **osobny** mechanizm migracji (`[TP-Migrations]`,
  z myślnikiem — inny niż naprawiony `[TP Migrations]`), który pada
  nie-fatalnie na `736_inbox_performance_indexes.sql`. Niezwiązane
  z Case Workspace, boot przechodzi dalej.
- Walidacja schematu OpenAPI: **`EVIDENCE_MISSING`** — brak walidatora offline.
  Parity, unikalność `operationId` i kontrole strukturalne wykonane (8/8).
- Scenariusz 12 (deliverable open/return): C4b twierdzi „domknięty", ale
  **zrzuty pochodzą od poprzedniego, zabitego agenta**, a C4b je jedynie
  zweryfikował i dołożył własną kontrolę przez realne API. Dowód
  z drugiej ręki — traktuj odpowiednio.
- Run 30-minutowy: `EVIDENCE_MISSING`.
- Pełna macierz a11y (VoiceOver, axe, 7 breakpointów × 2 motywy): niepełna.

---

## 6. Pułapki, które kosztowały czas TEJ sesji (dopisz do poprzednich pięciu)

1. **`timeout` nie istnieje na macOS.** Daje exit 127 i **pusty log**, który
   wygląda jak czysty przebieg. Unieważniło mój pierwszy pomiar migracji.
2. **`kill -9` na `npx`/`tsx` zostawia żywe dziecko**, wciąż trzymające bazę.
   Zabijaj **po porcie** (`lsof -ti tcp:PORT | xargs kill -9`) i potwierdzaj.
3. **EADDRINUSE oddaje bazę procesowi-widmo.** Mój „świeży" przebieg padł na
   zajętym porcie, a tabele, które zmierzyłem, stworzył ocalały proces.
4. **Nie wyciszaj błędów `DROP DATABASE`.** `DROP` pada przy otwartych
   połączeniach; wyciszony, zmierzysz bazę, którą uważasz za pustą, a nie jest.
   Zawsze `pg_terminate_backend` najpierw i weryfikuj licznik tabel.
5. **Inline timeout jako trzeci argument `it()` bije flagę CLI
   `--testTimeout`.** Sprawdź przed wyciągnięciem wniosku z timeoutu.
6. **`tsc` OOM-uje i crash wygląda jak sukces.** Poprzednia sesja raportowała
   „frontend tsc 0 błędów" — to był stack trace V8. Ufaj **kodowi wyjścia**.
7. **Maszyna bywa współdzielona z innymi sesjami.** W szczycie chodziło ~10
   obcych procesów `tsc` z innych worktree; zapytania do `information_schema`
   trwały **104 sekundy**. Nie diagnozuj defektów pod takim obciążeniem —
   i **nie zabijaj cudzych procesów**.
8. **Backend dev na :3001 chodzi z `NODE_ENV=development` przeciw
   `case_workspace_test`.** Produkcyjny outbox worker wypija fixture'y testów
   na żywo. To unieważniło test wydajnościowy i skaziło baseline 587/590.
9. **`migrate.postgres.ts` uruchamiaj z KATALOGU GŁÓWNEGO repo**, nie z
   `server/` — ścieżkę `server/migrations` rozwiązuje względem cwd.
10. **Robotnicy mają zakaz pełnego `tsc`** (bo OOM). Skutek uboczny: regresja
    typów wychodzi dopiero na fan-inie. To koszt reguły, nie wina pakietu.

---

## 7. Reguły, które muszą przetrwać zmianę sesji

- **Bez push. Bez merge do demo. Bez deployu. Bez zapisów do staging/demo.**
- Bez `git reset --hard`, `git clean`, stashowania cudzych zmian, `git add -A`.
- Nie czyścić cudzych worktree ani nie zabijać cudzych procesów.
- Agenci wykonawczy: **Sonnet**. Koordynator: **Opus** (wyraźne polecenie
  właściciela z 2026-08-12, podyktowane zużyciem tokenów).
- Jeden agent = rozłączny allowlist. Pliki integracyjne
  (`adapters/index.ts`, `server/src/index.ts`, `Gateway.ts`, `src/App.tsx`,
  współdzielone testy kontraktowe) edytuje **wyłącznie koordynator**.
- **Backend na :3001 należy do koordynatora.** Żaden agent go nie restartuje —
  inaczej pakiety widzą fantomowe awarie.
- Kontrola negatywna obowiązkowa przy poprawkach bezpieczeństwa.
- Żaden agent nie ogłasza `FINAL PASS`.

---

## 8. Co zrobić w następnej kolejności

1. **Domknąć F2** — bez tego nie ma legalnej bramki Golden Cases.
2. **Uzyskać od właściciela dwie decyzje** z §5.2 i §5.3.
3. **Rozstrzygnąć 39 wierszy PROVEN bez realnego `test_ref`** — dopóki żyją,
   liczby w rejestrach nie znaczą tego, co obiecują.
4. Zamknąć `EVIDENCE_MISSING`: walidator OpenAPI offline, Run 30-minutowy,
   pełna macierz a11y.
5. Dopiero potem rozważać kandydata. `FINAL PASS` należy do Codex i właściciela.
