# RN-G6-A2 — Skala: ilu ludzi blokuje zerwana bramka decyzji cyklu życia inicjatywy

**Worktree:** `/Users/piotrwisniewski/rn-g2-lanes/g6-a2`
**Branch:** `rn-g6-a2`
**HEAD:** `d4494c7ad1cb27221654c82b3d84c1b2865cf6ea` (potwierdzone `git rev-parse HEAD` na starcie i na końcu — bez zmian, bo praca to wyłącznie odczyt + pliki w allowliście)
**`git status --short` na końcu:** wyłącznie ten raport + trzy skrypty w `scripts/rn-g6-a2-*` (allowlist). Zero zmian w `server/src/**`, `src/**`.

To jest **kontynuacja** `RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md` (przeczytany w całości przed startem). Tamten raport odpowiedział „czy mechanizm jest zepsuty" (tak, `BROKEN_RUNTIME_CONTRACT`). Ten raport odpowiada na węższe pytanie właściciela: **ilu ludzi to dziś blokuje i na czym dokładnie utykają.**

---

## Odpowiedź w jednym zdaniu

**Nie wiem, ilu prawdziwych klientów to dotyka — i nikt dziś nie może tego uczciwie policzyć z danych.** Ale wiem na pewno: mechanizm jest **strukturalnie zablokowany dla każdego użytkownika, który spróbuje przejść tę bramkę**, nie ma żadnej działającej ścieżki obejścia, a jedyna próba obejścia, jaką znalazłem w kodzie, **kłamie użytkownikowi o sukcesie**.

---

## Krok 1 — środowisko

Na maszynie z poprzedniego toru **żyje** Postgres na porcie `55821` (`pg_ctl status` → `PID 38806`, katalog `/Users/piotrwisniewski/rn-g6-lanes/pgdata-g6`). Sprawdziłem go **wyłącznie odczytem** (bez żadnego zapisu) i **nie nadaje się** do tego zadania:

- jedyna baza z danymi to `rn_g6_runtime` — to dataset **innego toru** (Results Next / KPI-ROI-OKR), zasiewany przez `scripts/rn-g6-seed-runtime-dataset.ts` (branch `rn-g6-runtime`);
- ten seed tworzy 6 inicjatyw **bezpośrednio SQL-em**, ze statusami typu `'active'`/`'TRACKING'`/`'EXECUTING'` wpisanymi ręcznie (nigdy nie przeszły przez silnik przejść), **zero** wierszy w `decisions` typu `GO_NO_GO`, **zero** wierszy w `initiative_lifecycle_gate_decisions` — bo ten seed w ogóle nie modeluje tego scenariusza (służy do czego innego: KPI/ROI/OKR);
- w bazie faktycznie było tylko 7 inicjatyw, żadna w statusie z listy bramkowej poza przypadkowym trafieniem 3× `EXECUTING` (wstawionym z pominięciem silnika, więc nic nie mówi o tym, czy bramka działa).

**Decyzja:** nie dotykałem `55821`/`rn_g6_runtime` zapisem (zero ryzyka dla drugiego toru). Postawiłem **własny, w pełni izolowany** Postgres 17 lokalnie, dokładnie wg instrukcji z briefu:

```
export LC_ALL=C LANG=C
/opt/homebrew/opt/postgresql@17/bin/initdb -D /tmp/rn-a2s-pgdata --locale=C -U postgres
/opt/homebrew/opt/postgresql@17/bin/pg_ctl -D /tmp/rn-a2s-pgdata \
  -o "-p 55911 -k /tmp/rn-a2s-sock -c listen_addresses=127.0.0.1" \
  -l /tmp/rn-a2s-pgdata/server.log start
createdb -h 127.0.0.1 -p 55911 -U postgres rn_a2s_gate_scale
DB_TYPE=postgres DATABASE_URL=postgresql://postgres@127.0.0.1:55911/rn_a2s_gate_scale \
  NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts   # BEZ --safe
```

Migracje: **0 błędów, 0 skipped**, `✅ Postgres migrations complete` (ostatnia migracja w łańcuchu: `init-pgvector.sql`).

Następnie zasiałem **własny, jawnie oznaczony jako ILUSTRACYJNY** dataset — `scripts/rn-g6-a2-seed-gate-dataset.mjs` (nowy plik, allowlist) — bo `scripts/rn-g6-seed-runtime-dataset.ts` z briefu, jak wyżej, nie modeluje inicjatyw/decyzji w ogóle. Skrypt tworzy jedną organizację + użytkownika + projekt (`rn-g6-a2-org-0001` itd.) i 34 inicjatywy rozłożone po wszystkich statusach cyklu życia, z częścią z nich mającą **zatwierdzoną** decyzję `GO_NO_GO` w starej tabeli `decisions` (symulacja: „PM kliknął Zatwierdź w module Decisions").

**To NIE jest kopia realnych danych klienta — to jest wymyślony, ale poprawny strukturalnie zestaw, żeby dało się w ogóle policzyć mechanizm.** Patrz sekcja „Czego to NIE dowodzi".

---

## Krok 2 — liczby

Na `rn_a2s_gate_scale`, organizacja `rn-g6-a2-org-0001`:

| Status inicjatywy | Liczba |
|---|---|
| DRAFT | 5 |
| PENDING_REVIEW | 2 |
| **REVIEW** (bramkowany) | 4 |
| **PROMOTED** (bramkowany) | 3 |
| PLANNING | 2 |
| **APPROVED** (bramkowany) | 4 |
| **SCHEDULED** (bramkowany) | 4 |
| **BLOCKED** (bramkowany) | 2 |
| **EXECUTING** (bramkowany) | 3 |
| DONE | 3 |
| CANCELLED | 1 |
| ARCHIVED | 1 |
| **RAZEM** | **34** |

| Miara | Liczba |
|---|---|
| Inicjatywy w statusach wymagających decyzji bramkowej (REVIEW+PROMOTED+APPROVED+SCHEDULED+BLOCKED+EXECUTING) | **20** |
| Wiersze w `decisions` typu `GO_NO_GO`, status `approved` (czyli: ludzie PODJĘLI decyzję w module, z którego realnie korzystają) | **14** |
| Wiersze w `initiative_lifecycle_gate_decisions` (czyli: ile z tych decyzji system-bramka W OGÓLE widzi) | **0** |
| **Inicjatywy z zatwierdzoną decyzją w starej tabeli, a zerem w nowej** (= dokładnie ta liczba, o którą pytał właściciel) | **14** |

Zapytanie za trzecim wierszem (dowodowe, nie tylko zliczenie):

```sql
SELECT count(DISTINCT i.id) AS orphaned_count
FROM initiatives i
JOIN decisions d ON d.initiative_id = i.id AND d.type = 'GO_NO_GO' AND d.status = 'approved'
WHERE i.organization_id = 'rn-g6-a2-org-0001'
  AND i.status IN ('REVIEW','PROMOTED','APPROVED','SCHEDULED','BLOCKED','EXECUTING')
  AND NOT EXISTS (SELECT 1 FROM initiative_lifecycle_gate_decisions g WHERE g.initiative_id = i.id);
-- orphaned_count = 14
```

**Interpretacja liczb (WAŻNE):** `14/20 = 70%` to jest artefakt tego, JAK JA skonstruowałem seed (celowo dałem ~70% bramkowanych inicjatyw zatwierdzoną starą decyzję, żeby dane były czytelne), **nie jest to żaden pomiar realnego świata**. Jedyna liczba, która TU jest strukturalnie gwarantowana niezależnie od tego, ile decyzji wymyślę — to wiersz czwarty: **`initiative_lifecycle_gate_decisions` = 0, zawsze, dla każdej z tych decyzji**, bo — jak ustalono w poprzednim raporcie — nic w reachable kodzie produkcyjnym nigdy nie pisze do tej tabeli. Gdybym zasiał 2 zatwierdzone decyzje albo 200, czwarty wiersz i tak byłby 0.

---

## Krok 3 — realna ścieżka produktu

### 3a. Wywołanie realnego endpointu

Wziąłem `rn-g6-a2--init-021--scheduled` (status `SCHEDULED`, ma zatwierdzoną `GO_NO_GO` decyzję w `decisions` z `pmo_domain='GOVERNANCE_DECISION_MAKING'` — dokładnie ten gate, którego wymaga przejście `SCHEDULED→EXECUTING`). Wywołałem **realny router + realny `verifyToken`** (nie mock), tak jak zrobiłby to frontend: `POST /api/initiatives/:id/start-execution` (`server/src/routes/pmo/initiatives.routes.ts`), skrypt `scripts/rn-g6-a2-probe-transition.mjs`.

**Dosłowna odpowiedź:**

```
STATUS: 400
BODY: {
  "error": "Go/No-Go decision is required to start execution of this initiative",
  "rule": "GATE_DECISION_REQUIRED",
  "initiativeId": "rn-g6-a2--init-021--scheduled"
}
```

Stan w bazie PRZED i PO — bez zmian: `{ status: 'SCHEDULED', execution_started_at: null }`.

### 3b. Czy komunikat daje jakąkolwiek wskazówkę

**Nie.** Treść `"Go/No-Go decision is required..."` brzmi tak, jakby NIKT jeszcze nie podjął decyzji. Ale ten konkretny użytkownik **już to zrobił** — w module Decisions, który jest jedynym miejscu w produkcie, gdzie w ogóle da się zatwierdzić decyzję GO/NO-GO. Komunikat:

- nie mówi „Twoja decyzja istnieje, ale w niekompatybilnym formacie";
- nie mówi „skontaktuj się z administratorem" ani nie wskazuje żadnej alternatywnej ścieżki;
- nie różni się NICZYM od komunikatu, który dostałby ktoś, kto naprawdę jeszcze nie podjął żadnej decyzji.

Efekt: użytkownik, który zrobił dokładnie to, o co go prosił produkt, dostaje komunikat sugerujący, że nic nie zrobił. Najbardziej prawdopodobna reakcja: idzie z powrotem do modułu Decisions, zatwierdza tę samą decyzję jeszcze raz (bo może kliknął źle?), dostaje ten sam błąd, i albo się poddaje, albo pisze do supportu.

---

## Krok 4 — trzy pytania właściciela, prostym językiem

### 1) Czy da się dziś przeprowadzić inicjatywę przez pełen cykl życia w produkcie?

**Nie.** Zatrzymuje się na **pierwszej** bramce decyzyjnej, na jaką trafi — a jest ich pięć rozsianych po całej ścieżce (Review→Promoted, Promoted→Planning, Approved→Scheduled, Scheduled/Blocked→Executing, Executing→Done). Użytkownik może dojść do stanu, w którym bramka jest wymagana, kliknąć „Zatwierdź" w module Decisions (jedyne miejsce, gdzie w ogóle da się to zrobić) — i mimo to dostanie odmowę. Nie ma żadnego kroku dalej. To nie jest „wolniej" ani „trudniej" — to jest **twardy mur**, przez który dziś nie da się przejść żadną ścieżką dostępną w interfejsie.

### 2) Czy istnieje jakakolwiek obejściowa ścieżka?

**Sprawdziłem uczciwie i szukałem aktywnie — nie znalazłem żadnej DZIAŁAJĄCEJ.** Konkretnie sprawdziłem:

- **Parametr `overrideReason` / „miękkie" obejście gate'u** — istnieje w kodzie, ale to osobny mechanizm (AI-readiness soft-block), i kod **wprost dokumentuje**, że kontrola decyzji GO/NO-GO „NEVER skipped for any actor, system included" (`server/src/services/initiative/initiativeTransitionService.ts`, komentarz nad linią ~627). Nie da się nim ominąć bramki decyzyjnej.
- **Inne trasy zmiany statusu** (`PATCH /:id/status`, `PATCH /:id`, `/approve`, `/unblock` — `server/src/routes/pmo/initiatives.routes.ts`) — wszystkie, bez wyjątku, przechodzą przez ten sam, jeden silnik `executeInitiativeTransition` (`server/src/controllers/InitiativeController.ts`, potwierdzone grepem: 5 wywołań tej funkcji z różnych handlerów). Żadna nie omija bramki.
- **Historyczny „surowy" bypass** w `server/src/routes/executionControl.routes.ts` i `server/src/routes/v8/execution-control.routes.ts` (endpoint `/timeline-update` kiedyś przyjmował `field:'status'` i robił gołe `UPDATE` bez żadnej walidacji) — **już zamknięty** (fix INI-005, 2026-08-01, `code: 'TIMELINE_UPDATE_STATUS_FORBIDDEN'`). Nieaktualny, ale odnotowuję, bo to dokładnie ten typ ścieżki, którego szukałem.

- **★ Najciekawsze znalezisko — istnieje trasa, która PRÓBUJE ominąć bramkę, ale jest sama w sobie zepsuta i myląca.** Manager Cockpit ma szybką akcję „unblock" dla zablokowanych inicjatyw: `POST /api/v8/execution-control/manager/lanes/:laneId/problem-actions/execute` (`server/src/routes/v8/execution-control.routes.ts:1968`, chronione uprawnieniem `manage_workstreams` — czyli manager/PMO, nie zwykły user), które woła `executeManagerProblemAction` → `case 'unblock'` w `server/src/services/v8/managerActionExecutionService.ts:314-321`:
  ```ts
  case 'unblock': {
    await dbRun(
      `UPDATE initiatives SET status = 'IN_PROGRESS', updated_at = NOW() WHERE id = ? AND organization_id = ?`,
      [row.sourceEntityId, organizationId]
    );
    addChange('INITIATIVE', row.sourceEntityId);
    return { message: 'Initiative moved out of blocked state.', changedEntities };
  }
  ```
  To jest surowy SQL, **całkowicie z pominięciem silnika przejść i bramki decyzyjnej** — dokładnie to, czego szukałem jako ewentualnego obejścia. Problem: `'IN_PROGRESS'` **nie jest** legalną wartością statusu w tym schemacie (`initiatives_status_check` CHECK constraint dopuszcza tylko `DRAFT/PENDING_REVIEW/REVIEW/PROMOTED/PLANNING/APPROVED/SCHEDULED/EXECUTING/BLOCKED/DONE/TRACKING/CANCELLED/ARCHIVED`). Zweryfikowałem empirycznie na realnym Postgresie z tym dokładnym zapytaniem: rzuca `ERROR: new row for relation "initiatives" violates check constraint "initiatives_status_check"`.

  **I jest gorzej.** Ta funkcja woła to przez `dbRun` z `server/src/utils/DbPromise.ts`, którego `run()` domyślnie (`fallback: true`) **łyka błąd SQL** i zwraca `{success: false, error: "..."}` **zamiast rzucić wyjątek** — a wywołujący kod (`case 'unblock'`) **nigdy nie sprawdza tego zwrotu**. Zweryfikowałem to bezpośrednio (`scripts/rn-g6-a2-probe-dbrun-swallow.mjs`, dokładnie ten sam SQL i dokładnie ten sam `DbPromise.run`, na inicjatywie `rn-g6-a2--init-025--blocked`):
  ```
  BEFORE status: BLOCKED
  DbPromise.run() RETURNED: {"success":false,"error":"new row for relation \"initiatives\" violates check constraint \"initiatives_status_check\""}
  AFTER status: BLOCKED
  ```
  Czyli: manager klika „Odblokuj" w Manager Cockpit, dostaje **HTTP 200** i komunikat **„Initiative moved out of blocked state."**, wpis w `manager_action_audit_log` mówiący, że coś się zmieniło — a inicjatywa **fizycznie w ogóle się nie rusza**, zostaje `BLOCKED`. To nie jest działające obejście bramki — to osobny defekt: **fałszywy sukces**, niezależny od problemu opisanego w głównym raporcie, ale w tym samym obszarze produktu i wart naprawy razem z nim.

**Wniosek: obejście NIE ISTNIEJE.** Jedyna próba, jaką znalazłem, sama nie działa — i dodatkowo kłamie o tym, że zadziałała.

### 3) Czy realne dane mogą być osierocone?

**Mechanizm na to pozwala — potwierdzam to strukturalnie, nie liczbowo.** Każda inicjatywa, która osiągnie jeden z pięciu stanów bramkowanych (`REVIEW`, `PROMOTED`, `APPROVED`, `SCHEDULED`/`BLOCKED`, `EXECUTING`), **nie ma dziś żadnej ścieżki do przodu** — potwierdzone empirycznie w Kroku 3 i teoretycznie w Kroku 4.2 (brak obejścia). To znaczy: jeśli na jakimkolwiek środowisku z żywym ruchem istnieje choć jedna inicjatywa w takim stanie, **jest ona dziś osierocona z definicji mechanizmu** — nie dlatego, że coś poszło nie tak z tą konkretną inicjatywą, tylko dlatego, że CAŁA klasa przejść jest zablokowana dla wszystkich. Nie mam jednak (i nie mogę mieć z tego zbioru) liczby: „ile realnych inicjatyw u ilu realnych klientów".

---

## Czego to NIE dowodzi

- **To NIE są dane realnych klientów.** `rn_a2s_gate_scale` to mój własny, jednorazowy, w pełni wymyślony zestaw (34 inicjatywy, jedna organizacja). Liczby „20 bramkowanych", „14 z zatwierdzoną starą decyzją" są artefaktem TEGO, jak skonstruowałem seed — nie pomiarem czegokolwiek u klienta. **Nie wiem i nie mogę stąd wiedzieć, ilu realnych klientów/inicjatyw to dotyka.**
- Sprawdzony wcześniej `rn_g6_runtime` (port 55821, drugi tor) też nie daje tej odpowiedzi — to dataset innego programu (KPI/ROI/OKR), bez inicjatyw przechodzących przez silnik ani decyzji GO/NO-GO.
- Nie sprawdzałem demo/dev/prod (`trolley`/`thomas`/`centerbeam`) — zakazane mandatem tej sondy, więc nie wiem, czy i ile inicjatyw jest tam dziś realnie w stanach bramkowanych z zatwierdzoną starą decyzją.
- Jedyna liczba z Kroku 2, która **jest** strukturalnie wiarygodna niezależnie od mojego seeda: `initiative_lifecycle_gate_decisions` = 0 dla każdej zatwierdzonej starej decyzji, bo żaden reachable kod produkcyjny tam nie pisze (ustalone przez czytanie kodu w poprzednim raporcie, nie tylko przez ten seed).
- Nie testowałem pozostałych czterech bramkowanych przejść (`REVIEW→PROMOTED`, `PROMOTED→PLANNING`, `APPROVED→SCHEDULED`, `EXECUTING→DONE`) realnym wywołaniem HTTP — tylko `SCHEDULED→EXECUTING`. Mechanizm bazowy (`hasApprovedGateDecision`, ten sam pusty `catch`) jest identyczny dla wszystkich pięciu (potwierdzone czytaniem kodu w poprzednim raporcie), więc nie oczekuję innego wyniku, ale nie uruchomiłem tego empirycznie dla pozostałych czterech w TEJ sesji.
- Znalezisko „unblock kłamie o sukcesie" sprawdziłem SQL-owo (identyczny statement przez identyczny `DbPromise.run`) i przez czytanie routingu (potwierdzone: trasa istnieje, jest zamontowana, wymaga `manage_workstreams`). **Nie** wywołałem pełnego HTTP end-to-end dla tej trasy (wymagałoby to dodatkowo zbudowania danych pasujących do wykrywacza „problemów" w danej lane — `getManagerProblems` — co wykracza poza budżet tej sondy). Poziom pewności: wysoki (sam SQL + brak sprawdzania `result.success` w kodzie są jednoznaczne), ale nie jest to trzeci, w pełni end-to-end dowód jak w Kroku 3a.

## Czy znalazłem obejście — TAK/NIE

**NIE — nie ma żadnej działającej ścieżki obejścia bramki.** Jedyna próba obejścia, jaką znalazłem w reachable kodzie (`managerActionExecutionService.ts:314-321`, trasa `POST /api/v8/execution-control/manager/lanes/:laneId/problem-actions/execute`), sama jest zepsuta przez naruszenie CHECK constraint i dodatkowo — przez domyślne `fallback:true` w `DbPromise.run()` — zwraca użytkownikowi fałszywy komunikat sukcesu zamiast błędu. To NOWE znalezisko względem `RN_G6_A2_INITIATIVE_GATE_DIVERGENCE.md` (tamten raport go nie opisywał).

## Co ruszyłem poza allowlistą

**Nic.** Zero zmian w `server/src/**`/`src/**`. Utworzone pliki: ten raport oraz trzy skrypty diagnostyczne w `scripts/rn-g6-a2-*` (w allowliście):
- `scripts/rn-g6-a2-seed-gate-dataset.mjs`
- `scripts/rn-g6-a2-probe-transition.mjs`
- `scripts/rn-g6-a2-probe-dbrun-swallow.mjs`

Cała reprodukcja na moim własnym, jednorazowym Postgresie: `127.0.0.1:55911`, katalog danych `/tmp/rn-a2s-pgdata`, gniazdo `/tmp/rn-a2s-sock` — zatrzymany (`pg_ctl stop`, dokładny PID, bez `pkill`) i skasowany po zakończeniu pracy. **Nie dotknąłem** `55821`/`rn_g6_runtime` (drugi tor) zapisem — tylko trzy read-only zapytania (`\dt`, `SELECT count`, `SELECT status, count(*) ... GROUP BY`). Nie modyfikowałem żadnego z pięciu zakazanych plików. Zero push/merge/deploy/subagentów.
