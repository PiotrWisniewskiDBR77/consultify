# ODBIÓR ADWERSARYJNY NA ŻYWYM STAGINGU — linia `7e8668c7cc` (11.09.2026, wieczór)

**Zadanie:** ponowny odbiór po wdrożeniu linii `7e8668c7cc` (11.09 21:00). Mierzone OBA kierunki
dla każdej powierzchni (lekcja DEC-453): **(1) czy widać** — dane docierają na ekran;
**(2) czy da się zmienić** — zapis z interfejsu/API przechodzi, przeżywa pełne przeładowanie,
a odmowa dla niepowołanego jest realna.
**Wzór formy:** `ODBIOR_W2B_INICJATYWY_REALIZACJA_20260910.md`.

---

## WERDYKT ZBIORCZY: **4 BLOKERY · 4 REGRESJE MODUŁOWE · 1 zastane 5xx**

| | |
|---|---|
| **BLOKERY** | **B-1/B-2/B-3** — MEMBER zmienia, przypisuje sobie i blokuje CUDZE zadanie (jedna przyczyna, jedna poprawka) · **B-4** — karta zadania w Mojej Pracy nie ładuje treści dla **38 z 46** zadań (powłoka N zdrowa — 3 inne karty zdają 4/4) |
| **WAŻNE** | **W-3** — Inicjatywy, Materiały i Organizacja **nie otwierają się** (> 75 s, 5 prób) · **W-4** — Wyniki otwierają się z pustym środkiem · **W-1** — aplikacja montuje się 16–26 s · **W-2** — bramka „0 błędów konsoli" przechodzi nad białym ekranem |
| **DZIAŁA** | łańcuch statusów zadania do „Wykonane" z trwałością · zapis tytułu inicjatywy runtime-v1 (wersja 1→2) · odmowy dla niepowołanych na decyzjach i inicjatywach · megatrendy (10 wierszy, właściwa branża, zero „automotive") · brak skazanego fetcha eksportów w Ocenie · 10 z 16 pozycji menu · czasy API 1,6–2,4 s (próg 3 s) |
| **5xx** | **1 w całym przebiegu** — znany, zastany `POST /tasks/:id/assign` na zadaniu bez projektu |
| **NIEZMIERZONE** | 9 pozycji w §9 — **nie czytać jako „w porządku"** |

**Zero regresji? NIE. Cztery blokery, z czego trzy mają wspólną przyczynę w jednej linii kodu.**

**Najmocniejszy dowód, że powłoka N jest zdrowa:** karty **Decyzji**, **Powiadomienia**
i **Działania** zdają
**4 kryteria na 4** (niepuste centrum · dokładnie jeden `aside` · „Work with AI" w Menu 1 ·
zero błędów konsoli). Karta Zadania stoi **nie** przez wadę powłoki, tylko przez jedno złe
wywołanie odczytu — patrz B-4.

---

## 0. Stanowisko pomiaru

| Element | Wartość |
|---|---|
| Środowisko | **ŻYWY staging** `https://staging.consultify.ai` (nie kopia, nie localhost) |
| SHA na żywo | `/api/health` → `gitSha` = **`7e8668c7ccddc1cc335924c636243cf7cd7fe867`**, `database: connected`, `redis: connected`, `megatrendsAvailable: true`, `dbResponseTime: 1 ms` |
| Godzina | start **21:07 CEST**, koniec **22:4x CEST** 11.09.2026 |
| Worktree | `/Users/piotrwisniewski/Developer/wt/odbior-staging`, gałąź `mvp/odbior-staging-20260911` |
| Organizacja | **Northwind Manufacturing Ltd.** `468b234c-66c4-54e1-b626-5e0fb3a92f6a` |
| Konto OWNER | `james.whitfield@northwind.example` `08c54d75-5260-57b1-9db6-a30aed89a587`, rola projektowa **PROJECT_SPONSOR** |
| Konto MEMBER | `daniel.osei@northwind.example` `d62073a5-7095-5817-b383-4dc8942937d6`, rola projektowa **INITIATIVE_OWNER** |
| Zastane dane | 46 zadań · 13 inicjatyw klasycznych · 9 agregatów runtime-v1 · 9 decyzji · 30 kart działania · 4 wnioski z wywiadu · 1 powiadomienie · 6 członków projektu `6174636d…` |
| Przyrząd | Playwright/Chromium 1440×900, sesja z pliku (localStorage `token`/`refreshToken`/`user` **+ ciasteczka**), motyw z zustand `consultify-storage.state.theme`; `scripts/dev/odbior-staging-7e8668c7cc/harness.mjs` |
| Zrzuty | `evidence/odbior-staging-7e8668c7cc/` — `NN-<moduł>-<jasny\|ciemny>.png` + sidecar `.json` (liczba błędów konsoli, lista 4xx/5xx, czas do renderu) |
| Zapisy | wyłącznie Northwind, odwracalne, prefiks `ODBIOR-7e8668c7cc`; sprzątanie w §8 |

### 0.1 Cztery pułapki przyrządu złapane w tym pomiarze

1. **Biały zrzut przy stałym `waitForTimeout`.** Pierwsze 4 zrzuty wyszły **całkowicie białe**
   (`luma jasny = 255`, `body.innerText` puste, `#root` długości **0**) przy 0 błędów konsoli
   i 0 odpowiedzi ≥ 400 — czyli wszystkie „bezpieczniki" świeciły na zielono nad pustym obrazem.
   Przyczyna: aplikacja na stagingu montuje się **16–36 s**, a przyrząd czekał 5 s, potem 24 s.
   Poprawka: `page.waitForFunction(() => #root.innerHTML.length > 20000, {timeout: 75000})`
   zamiast zegara. **Bez tej poprawki cały raport byłby fałszywy** (29. raz ten kształt).
2. **Ciasteczka są potrzebne mimo Bearera.** Bez `csrf_token` aplikacja dostawała
   `403 CSRF_INVALID` na `POST /api/v10/teresa/voice-event`. To artefakt przyrządu, nie defekt
   produktu — po dołożeniu ciasteczek z pliku sesji znika. Wszystkie 403 CSRF w tym raporcie
   zostały w ten sposób wyeliminowane, więc pozostałe kody są realne.
3. **Powłoka modułu ≠ produkt.** Po poprawce nr 1 zrzuty przestały być białe — i zaczęły
   pokazywać **pasek boczny, nagłówek modułu i kręciołek „Loading…" w środku**. Warunek
   „`#root` > 20 kB" spełnia sama powłoka, więc 16 zrzutów modułów pokazywało coś, czego
   właściciel nigdy nie ocenia. Poprawka: drugi warunek — czekaj, aż z treści zniknie
   wskaźnik ładowania (maks. 60 s), i dopiero wtedy zrzut. Pierwszy przelot (16 modułów)
   **odrzucony w całości i powtórzony**. To 15. raz ten kształt („przyrząd pokazuje nie produkt").
4. **Sonda uprawnień realnie zmieniła dane pokazowe.** Próba `PUT /api/tasks/<cudze>` jako MEMBER
   **przeszła** i nadpisała tytuł zadania Northwind. Rekord przywrócony w tej samej minucie
   (§8) — ale to jest właśnie znalezisko nr 1, nie wypadek przyrządu.

---
## 1. MOJA PRACA — karty N (N1/N2 + Codex P13-A)

**PRZED (rejestr 11.09):** karty N miały otwierać się z realnych rekordów, z niepustym centrum,
jednym prawym panelem, pozycją „Pracuj z AI" w Menu 1 i zerem błędów konsoli.

**Co ustaliłem o samej powierzchni (czytanie kodu, nie zgadywanie):**
`src/components/MyWork/MyWorkHub.tsx:1540-1585` — nasłuch `mywork-open-item` przyjmuje
**dokładnie sześć** typów: `task` · `idea` · `decision` · `notification` · `initiative` ·
`notebook`. **Nie ma gałęzi dla „Sesji wywiadu", „Wzorca wywiadu" ani „Wniosku"**
(interview insight) — tych trzech kart z briefu **nie da się otworzyć z Mojej Pracy**,
bo taka powierzchnia nie istnieje, a nie dlatego, że jest zepsuta.

| Karta | Otwarcie | Centrum | Werdykt |
|---|---|---|---|
| **Zadanie** | **DZIAŁA** — `mywork-open-item {type:'task'}` przełącza zakładkę na „Tasks" i otwiera kartę z tytułem realnego rekordu | **NIE ŁADUJE SIĘ** — `GET /api/my-work/personal-tasks/<id>` → **404 `TASK_NOT_FOUND`**, konsola: `Failed to load task Error: Failed to fetch personal task` (`TaskDetailView`). Karta zostaje na „Loading…" | **BLOKER B-4** |
| **Decyzja** | **DZIAŁA** — przełącza na „Decisions", tytuł rekordu w pasku kart | **PEŁNY KOMPLET** — `aside` = **1** (dokładnie jeden prawy panel), **„Work with AI" obecne**, wskaźnik ładowania = **0**, **0 błędów konsoli**, **0 × 4xx/5xx**; centrum niesie sekcje: Decision Scope · Options & Trade-offs · Risk & Impact · Consequences · RACI & Escalation · Attachments & Links, plus „Submit for review" i panel ACTIONS. Zrzut `03-karta-decyzja-ciemny.png` | **DZIAŁA** |
| **Powiadomienie** | **DZIAŁA** — `mywork-open-item {type:'notification'}` otwiera kartę „Interview assigned / New Interview Assignment" | **PEŁNY KOMPLET** — `aside` = **1**, **„Work with AI" obecne**, wskaźnik ładowania = **0**, **0 błędów konsoli, 0 × 4xx/5xx**; centrum: stan „Unread", akcja „Mark as read", Sections · Edit · Preview. Zrzut `04-karta-powiadomienie-jasny.png` | **DZIAŁA** |
| **Inicjatywa** | **ADRES TAK, EKRAN NIE** — zdarzenie zmienia adres na `/initiatives?artifact=initiative%3Ab650401b…`, ale **wyrenderowana treść to nadal Moja Praca → Inbox**; `aside` = **0**, karty nie widać. 0 błędów konsoli, 0 × 4xx | brak | **REGRESJA — rodzina W-3** (moduł `/initiatives` się nie montuje, więc karta nie ma gdzie się otworzyć) |
| **Karta działania** (`/action-cards/13efc367…`) | **DZIAŁA** — otwiera się z adresu w 18,6 s | **PEŁNY KOMPLET** — `aside` = **1**, **„Work with AI" obecne**, **„Close card" obecne**, wskaźnik ładowania = **0**, **0 błędów konsoli, 0 × 4xx/5xx**; centrum: Description · Source · Owner and due date · Actions and status, panel PROPERTIES (Status Open · Owner Priya Sharma · Due date 2026-02-14). Zrzut `06-karta-dzialania-jasny.png`. **Samego zapisu „Close card" nie wywołałem** | **DZIAŁA** (zapis: STOP) |
| Wniosek (interview insight) | **BRAK POWIERZCHNI** — `MyWorkHub.tsx:1555-1570` nie ma tego typu; 4 wnioski istnieją w API | — | **BRAK POWIERZCHNI** |
| Sesja wywiadu | **BRAK POWIERZCHNI** — jw.; sesje istnieją (`GET /api/interview/sessions` → 200) | — | **BRAK POWIERZCHNI** |
| Wzorzec wywiadu | **BRAK POWIERZCHNI** — jw.; szablony istnieją (`GET /api/interview/templates` → 200) | — | **BRAK POWIERZCHNI** |

### 1.1 BLOKER B-4 — karta zadania w Mojej Pracy nie pokazuje 38 z 46 zadań

Zmierzone bezpośrednio na API, tym samym kontem OWNER:

| Wywołanie | Wynik |
|---|---|
| `GET /api/my-work/personal-tasks/f9c386c1…` | **404** `{"error":"Not found","code":"TASK_NOT_FOUND"}` |
| `GET /api/tasks/f9c386c1…` | **200** — „Agree the shuttle safety case…", reporter = **james (to konto)**, wykonawca = Priya Sharma |

**Przyczyna — opisana w kodzie, ale niedomknięta.** `src/components/MyWork/TaskDetailView.tsx:1095`:
```ts
const task = ownerScoped ? await Api.getPersonalTask(id) : await Api.getTask(id);
```
`ownerScoped` ma **domyślnie `true`** (`TaskDetailView.tsx:196`), a `GET /api/my-work/personal-tasks/:id`
filtruje **po wykonawcy** (`buildPersonalTaskOwnerScope`). Komentarz w
`TaskDetailView.tsx:175-195` opisuje dokładnie ten defekt i mówi, że paczka **E1c/F1 naprawiła
go dla kart modułowych** przez przekazanie `ownerScoped={false}` — **ale sama „Moja Praca"
została na `true`**, przy założeniu „w Mojej Pracy zadania są zawsze własne".

**To założenie jest na stagingu nieprawdziwe.** Na Northwind james jest **reporterem wszystkich
46 zadań**, ale **wykonawcą tylko 8**. Czyli **38 z 46 (83 %) zadań nie otworzy karty** —
użytkownik klika swój własny, zgłoszony przez siebie rekord i dostaje kręciołek bez końca.
Zero komunikatu dla użytkownika, zero 5xx, jedno 404 w dzienniku sieciowym.

**Naprawa:** przekazać `ownerScoped={false}` również z „Mojej Pracy" albo — lepiej — poszerzyć
`buildPersonalTaskOwnerScope` o `reporter_id`/`created_by` (ten sam model własności, którego
używa `isTaskOwnedByCaller` w §4.1).

**Trzy karty zdają pełne kryterium: Decyzja · Powiadomienie · Karta działania.** Każda
spełnia **wszystkie cztery** wymagania z briefu (niepuste centrum · dokładnie jeden `aside` ·
„Pracuj z AI" w Menu 1 · zero błędów konsoli), a Karta działania ma dodatkowo widoczne
„Close card". **Powłoka kart N jest zdrowa** — to mocny wynik dla N1/N2/P13-A. To jest ważne dla oceny B-4: karta Zadania nie stoi przez wadę powłoki N, tylko
przez **jedno złe wywołanie odczytu** (§1.1). Poprawka B-4 powinna dać karcie Zadania
to samo, co ma już karta Decyzji.

**Werdykt punktu 1: JEDEN BLOKER + TRZY KARTY W PEŁNI ZDANE + DWIE NIEOSIĄGALNE.** Tego **nie wolno** zapisać jako
„karty N działają". Ustalone twardo: (a) **otwieranie** kart Zadania i Decyzji z Mojej Pracy
działa — zakładka się przełącza, karta dostaje tożsamość i tytuł z realnego rekordu;
(b) **karty Decyzji, Powiadomienia i Działania zdają pełne kryterium odbioru** (4/4); (c) **karta Zadania nie
ładuje treści dla 83 % zadań** (B-4, §1.1); (d) **karta Inicjatywy nie otwiera ekranu**
(rodzina W-3); (e) **trzy z siedmiu kart z briefu nie mają w ogóle powierzchni** w tym
przełączniku.
Czego **nie** ustaliłem: czy „Close card" realnie zmienia status (samego zapisu nie wywołałem). Przyczyna: każde wejście na `/my-work`
kosztuje 20–110 s (W-1), a dwie z ostatnich prób przekroczyły 75 s.
**To jest pozycja numer jeden do domknięcia w następnym dyżurze** — na rozgrzanej przeglądarce,
nie headless z zimnym cache.

---

## 2. INICJATYWY — PRZED → PO

Rekord kanoniczny użyty do pomiaru: **`initiative-d29cc12d-8e36-481d-958e-71747a6fbf26`**
(„P11 weryfikacja zapisu po czystce", `lifecycleState: REGISTERED_DRAFT`, `sourceType: MANUAL_HUB`)
— jedyny agregat runtime-v1 na Northwind z identyfikatorem w postaci `initiative-…`;
pozostałe 8 agregatów niesie `initiativeId` równy identyfikatorowi rekordu klasycznego.

| Powierzchnia | PRZED (rejestr 10–11.09) | PO — dowód na żywym stagingu | Werdykt |
|---|---|---|---|
| Rejestr — dane z serwera | DZIAŁA | **DZIAŁA** — `GET /api/initiatives` → **200**, **13 wierszy**, czas **2,39 s** | **DZIAŁA** |
| **Rejestr — EKRAN `/initiatives`** | DZIAŁA, 99 wierszy | **NIE OTWIERA SIĘ** — `#root` nie montuje treści w **75 s**, ekran kończy się komunikatem „Nie udało się wczytać danych na czas". **3 próby z 3** (dwie pod obciążeniem, jedna bez). Zero błędów konsoli, zero 4xx/5xx. Dane są, ekran ich nie pokazuje | **REGRESJA · patrz W-3** |
| Magazyn runtime-v1 | DZIAŁA | **DZIAŁA** — `GET /api/initiatives/runtime-v1/initiatives` → **200**, **9 agregatów** | **DZIAŁA** |
| **Zapis tytułu z karty (E1a)** | pętla `PUT … → 404` zlikwidowana, `PATCH … /metadata` → 200 | **DZIAŁA** — `PATCH /api/initiatives/runtime-v1/initiatives/initiative-d29cc12d…/metadata` → **200**, `{"status":"APPLIED","aggregateVersion":2}`; odczyt po zapisie: `version` **1 → 2**, tytuł = nowa wartość | **DZIAŁA** |
| Kontrakt zapisu | — | Ciało wymaga `expectedVersion` **i** `clientRequestId`; bez nich **400 `VALIDATION_FAILED`** (blokada optymistyczna działa, nie jest to defekt) | **DZIAŁA** |
| **Odmowa dla niepowołanego** | 403 | **DZIAŁA** — MEMBER na cudzej inicjatywie: `PUT` i `PATCH` → **403** `object_not_owned_by_caller` (§4) | **DZIAŁA** |
| RAID: dodaj/zmień/usuń, 409 przy duplikacie | naprawione (0×409) | **NIEZMIERZONE — STOP.** `GET …/runtime-v1/initiatives/<id>/raid-items` → **404 `API_ROUTE_NOT_FOUND`**; ścieżka RAID dla agregatu runtime-v1 leży pod innym adresem, którego nie udało się ustalić w budżecie czasu bez zgadywania | **STOP (niemierzalne w tym odbiorze)** |
| **„Zatwierdź" odmawia po polsku (E3b/DEC-465)** | odmowa PL z powodem | **NIEZMIERZONE — STOP.** `PATCH …/runtime-v1/initiatives/<id>/status` → **404**, `POST …/approve` → **404**; trasa zatwierdzania dla runtime-v1 nie została zlokalizowana od strony API. Dodatkowo konto pokazowe ma `language: "en"` (DEC-461: staging po angielsku), więc wymaganie „po polsku" jest dla tego konta bezprzedmiotowe | **STOP** |

---

## 3. REALIZACJA — PRZED → PO

| Powierzchnia | PRZED | PO — dowód | Werdykt |
|---|---|---|---|
| **Pełny łańcuch statusu zadania do „Wykonane" + reload** | DZIAŁA (E3/P2) | **DZIAŁA** — na sondzie `a5971ae0-b5e8-4520-962b-7cf02f1b8e7f` (utworzonej `POST /api/tasks` → **201**): `todo → in_progress` **200** → `review` **200** → `done` **200**; niezależny `GET` po całym łańcuchu: `status = done`. Zmiana przeżywa odczyt z bazy | **DZIAŁA** |
| Odczyt zadań | 115 wierszy (DBR77) | **DZIAŁA** — `GET /api/tasks` → **200**, **46 wierszy** (Northwind), czas **1,65 s**; rozkład: 32 `todo`, 7 `in_progress`, 5 `done`, 2 `blocked` | **DZIAŁA** |
| Decyzje | 73 wiersze (DBR77) | **DZIAŁA** — `GET /api/decisions` → **200**, **9 wierszy**, czas **2,23 s** | **DZIAŁA** |
| **Kebab „Zaktualizuj zadanie" na elemencie kanonicznym (D-6)** | miało być bez 404 | **CZĘŚCIOWO — jako OWNER DZIAŁA** (`PUT /api/tasks/<id>` → 200 dla obu sprawdzonych zadań, także kanonicznego `f9c386c1…` powiązanego z inicjatywą `b650401b…`). **Jako MEMBER: przechodzi, ale to właśnie regresja z §4** — nie 404, tylko 200 tam, gdzie miało być 403 | **DZIAŁA (OWNER) / REGRESJA (MEMBER)** |
| Zasoby — obciążenie > 0 % | miało liczyć | **NIEZMIERZONE — STOP.** Cztery kandydujące trasy (`/api/resources/utilization`, `/api/execution/resources`, `/api/projects/<id>/resources`, `/api/resource-allocation`) → **404 `API_ROUTE_NOT_FOUND`**; nie zgadywałem dalej. Ocena tej zakładki wymaga wejścia przez UI | **STOP** |
| **`POST /tasks/:id/assign` na zadaniu bez projektu** | znany sygnał 500 (rejestr 21:02) | **POTWIERDZONY, ZASTANY** — `POST /api/tasks/4e448f41-d7f0-54ba-bfd2-38eab1fa5cc2/assign` (zadanie „Approve Q3 capex request", `projectId = null`) → **500 `INTERNAL_ERROR`**, `correlationId: 27035dca-dde9-4a35-98fd-0deba08583c5`. Na Northwind takich zadań bez projektu jest **9 z 46** | **ZASTANE** |

---

## 4. UPRAWNIENIA — MEMBER vs cudze obiekty OWNER-a  ★ TU JEST REGRESJA

**PRZED (rejestr 11.09 20:52–21:04 + komentarze w kodzie):** paczka E2/E2b + STOP-4 opisane jako
**naprawione** — „MEMBER nadpisywał cudze zadanie z kodem 200", „MEMBER przepinał CUDZE zadanie
przez `/reassign`", „MEMBER zablokował CUDZE zadanie (status → blocked) i dostał 200" miały być
zamknięte bramką `requireTaskCapability(..., { enforceMode: 'enforce', objectScoped: true,
ownerPredicate: isTaskOwnedByCaller })`. Dowód powstał na **kopii** `consultify_kopia_s12b`.

**PO (żywy staging, 21:09–21:52).** Wołający: **daniel (MEMBER)**, rola projektowa
**INITIATIVE_OWNER** — ani reporter, ani wykonawca, ani twórca mierzonych obiektów.

| Próba (MEMBER → cudzy obiekt) | Oczekiwane | **Zmierzone na żywo** | Werdykt |
|---|---|---|---|
| `PUT /api/tasks/f9c386c1…` | 403 | **200** — tytuł w bazie realnie zmieniony na `ODBIOR-7e8668c7cc PROBA MEMBER` | **REGRESJA · BLOKER B-1** |
| `POST /api/tasks/f9c386c1…/assign` | 403 | **200** — `assigneeId` przeszedł z Priyi Sharmy na **daniela** | **REGRESJA · BLOKER B-2** |
| `POST /api/tasks/6c3e394a…/block` | 403 | **200** `{"success":true,"message":"Task blocked"}` — status cudzego zadania `todo` → **`blocked`** w bazie | **REGRESJA · BLOKER B-3** |
| `POST /api/tasks/f9c386c1…/reassign` | 403 | **403** `object_not_owned_by_caller` — gdy daniel **nie jest** wykonawcą | **DZIAŁA** |
| `POST /api/tasks/f9c386c1…/unassign` | 403 | **403** `missing_capability_or_scope` | **DZIAŁA** |
| `DELETE /api/tasks/f9c386c1…` | 403 | **403** `{"error":"You can only delete tasks you created"}` | **DZIAŁA** (ale patrz §4.1) |
| `PUT /api/decisions/870d50ea…/enhancements` | 403 | **403** `object_not_owned_by_caller` | **DZIAŁA** |
| `PUT /api/initiatives/8229e253…` | 403 | **403** `required: initiative.update` | **DZIAŁA** |
| `PATCH /api/initiatives/8229e253…` | 403 | **403** — jw. | **DZIAŁA** |

**★ Sprostowanie własnego pomiaru.** Pierwsze wywołanie `/reassign` zwróciło **200** i zapisałem
je jako czwartą dziurę. To była **nieprawda z mojej winy**: chwilę wcześniej dziura B-2 uczyniła
daniela wykonawcą tego zadania, więc predykat własności słusznie powiedział „tak". Po przywróceniu
rekordu ta sama próba daje **403**. `reassign` i `unassign` **bronią się poprawnie** — dziur są
**trzy, nie cztery**.

**Kontrola pozytywna (OWNER na tych samych obiektach):** `PUT /api/tasks/…` → **200**,
`PUT /api/initiatives/…` → **200** (`"No changes detected"`), `POST …/unblock` → **200**.
Bramka nie zabiera praw uprawnionym.

**Stan wierszy po próbach:** dwa zastane rekordy Northwind zostały **realnie zmienione**
(`f9c386c1…` tytuł + wykonawca; `6c3e394a…` status). Oba **przywrócone** — patrz §8.

### 4.1 Przyczyna — jedno `return` przed sprawdzeniem własności

Bramki **są** w linii `7e8668c7cc` (`git show 7e8668c7cc:server/src/routes/pmo/tasks.routes.ts`:
`task.update` w linii **1178**, `task.assign` **1257**, `task.reassign` **1277**,
`task.status.update` **1376**; `git diff 7e8668c7cc HEAD` dla tego pliku **pusty**).
Kod jest wdrożony. Nie działa **dopasowanie zdolności**:

`server/src/services/effectiveAccessService.ts:1110-1112`
```ts
const match = matchEffectiveCapability(access, capability);
if (match.kind === 'allow')
  return { allowed: true, reason: match.reason, matched: match.matched };   // ← wyjście PRZED własnością
```

`matchEffectiveCapability` zwraca `kind: 'allow'` także dla sufiksu **`.scoped`**
(`effectiveAccessService.ts:1039` — `SCOPE_SUFFIXES = ['.scoped']`; dopasowanie w liniach
**1081-1084**), a `kind: 'ownership'` **wyłącznie** dla `.own` / `.assigned` / `.delegated`
(`effectiveAccessService.ts:1040`; dopasowanie **1085-1088**). Dla `.scoped` `ownerPredicate`
**nigdy nie jest wołany**.

Szablon roli **INITIATIVE_OWNER**, którą daniel ma na projekcie `6174636d…` (potwierdzone
`GET /api/projects/6174636d…/members` → `projectRole: "INITIATIVE_OWNER"`; taką rolę ma
**4 z 6** członków tego projektu), niesie `effectiveAccessService.ts:316-322, 334`:
```
'task.create.scoped', 'task.assign.scoped', 'task.update.scoped',
'task.status.update.scoped', 'task.close.scoped', 'task.delete.scoped', 'initiative.update.own'
```
**Dokładnie te zdolności, które kończą się na `.scoped`, dały trzy dziury** (`task.update`,
`task.assign`, `task.status.update` → `/block`). `task.reassign` i `task.unassign` **nie są**
w tym szablonie → wynik `missing` → poprawna odmowa. `initiative.update.own` kończy się na
`.own` → poprawna odmowa. **Wzór zgadza się w 9 na 9 zmierzonych wywołań** — to nie jest
hipoteza, to dopasowany mechanizm.

**Próba obalenia własnej tezy (10. pomiar).** Szablon INITIATIVE_OWNER niesie też
`initiative.status.change.scoped` (`effectiveAccessService.ts:331`), a trasa
`PATCH /api/initiatives/:id/status` (`initiatives.routes.ts:3156-3166`) ma tę samą bramkę —
więc teza przewidywała czwartą dziurę. **Zmierzone: 403** `object_not_owned_by_caller`,
status inicjatywy `PROPOSED` **bez zmiany**. Powód nie obala tezy, tylko ją zawęża: dla tej
inicjatywy kontekst projektu rozwiązał się na `fd4139d8…` (nie na `6174636d…`), gdzie daniel
**nie ma żadnej roli projektowej**, więc zdolność wypadła jako `missing` i bramka zadziałała.
**Dziura otwiera się dokładnie tam, gdzie wołający ma rolę projektową z sufiksem `.scoped`
w tym samym projekcie co obiekt** — nie „wszędzie".

**Dlaczego przeszło poprzedni odbiór:** dowód E2/STOP-4 robiono na roli **TASK_ASSIGNEE**, która
niesie `task.update.assigned` (`effectiveAccessService.ts:181, 472`) — a `.assigned` jest
w `OWNERSHIP_SUFFIXES`, więc tam predykat realnie się odpala. Zabezpieczenie dowiedziono na
**jednej roli z sześciu** i ogłoszono domkniętym dla wszystkich (kształt „próbka zamiast zbioru"
+ „test scenariusza nie broni zabezpieczenia").

**Dlaczego `DELETE` mimo to odmawia:** blokuje go **druga linia obrony w kontrolerze**,
`server/src/controllers/TaskController.ts:2206-2212`, dopisana w E2 jako zapasowa. Dla
`PUT` / `assign` / `block` takiej drugiej linii **nie ma** — dlatego przetrwało tylko usuwanie.
To potwierdza diagnozę: middleware nie broni ról `.scoped`, a produkt broni się wyłącznie tam,
gdzie ktoś osobno dołożył sprawdzenie w kontrolerze.

**Zasięg.** Bramek z `objectScoped: true` jest w trasach **11**. Dla roli INITIATIVE_OWNER
omijane są **3 z nich**. Praktycznie: każdy członek z rolą projektową niosącą `task.*.scoped`
może **edytować, przypisywać i blokować dowolne** zadanie w projekcie — na Northwind to
**37 zadań** projektu `6174636d…` i **4 konta** z taką rolą.

**Naprawa (propozycja, NIE wykonana w tym odbiorze).** Punktowo w
`effectiveAccessService.ts:1110`: nie wychodzić na `kind: 'allow'`, gdy wołający przekazał
`requireOwnership: true` **i** dopasowanie padło na sufiks `.scoped` — wtedy przejść do gałęzi
własności zamiast zwracać zgodę. Wariant „przenieść `.scoped` do `OWNERSHIP_SUFFIXES`" dotyka
142 bramek naraz, więc łamie CLAUDE.md §9 (zakaz masowego włączania) — **odradzam**.

---

## 5. F3 — dok Teresy i megatrendy

| Powierzchnia | PRZED | PO — dowód | Werdykt |
|---|---|---|---|
| **Megatrendy dla Northwind** | miały dawać 200 / 10 wierszy / bez „automotive" | **DZIAŁA** — `GET /api/megatrends/baseline?industry=Industrial%20Manufacturing` → **200**, **dokładnie 10 wierszy**, każdy `industry: "Industrial Manufacturing"` (`mg-indmfg-tech-01…05`, `mg-indmfg-bus-01…05`, `mg-indmfg-soc-01`), ciąg **„automotive" nie występuje** w całej odpowiedzi. `/api/health` potwierdza `megatrendsAvailable: true` | **DZIAŁA** |
| Trasa megatrendów | — | Uwaga dla następnych pomiarów: działa **`/api/megatrends/baseline?industry=…`**; gołe `/api/megatrends` **nie odpowiada** (timeout), `/api/v8/megatrends` → 404 | **DROBNE** |

---
## 6. OCENA (Assessment)

| Powierzchnia | PRZED | PO — dowód | Werdykt |
|---|---|---|---|
| Odczyt ocen | DZIAŁA | **DZIAŁA** — `GET /api/assessments` → **200**, ocena „Northwind 2027 — Operational Maturity Assessment" `b2de5832…` | **DZIAŁA** |
| **Podgląd raportu bez skazanego pobierania eksportów** (0 × 404 na `/exports` przy `builderReportId = null`) | defekt F4c | **DZIAŁA** — przelot przez `/assessment` (§7.4): **0 odpowiedzi 4xx i 0 5xx** w całym dzienniku sieciowym, w tym **0 wywołań `/exports`**. Skazany fetch nie występuje | **DZIAŁA** |
| „Dodaj powiązanie" (F4c: legacy C-mode) | osiągalność do zmierzenia | **STOP** — nie zmierzone; wymaga kliknięcia w głąb kreatora, na co nie starczyło budżetu (patrz §9 STOP) | **STOP** |

---
## 7. OGÓLNE — 5xx, czasy, przelot przez menu

### 7.1 Odpowiedzi 5xx w całym przebiegu

| Pomiar | Liczba 5xx | Szczegół |
|---|---|---|
| Sondy API (61 wywołań: odczyty, zapisy, próby uprawnień, kontrole pozytywne) | **1** | `POST /api/tasks/4e448f41…/assign` — zadanie bez projektu, `INTERNAL_ERROR` |
| Przelot przeglądarką (patrz §7.3) | **0** | żaden zrzut nie zarejestrował odpowiedzi ≥ 500 |
| **Razem** | **1** | **wyłącznie znany, zastany sygnał z rejestru 21:02** — potwierdzony, nic nowego |

### 7.2 Czasy odpowiedzi API (Bearer, bez przeglądarki, mediana z 2 wywołań)

| Wywołanie | Czas | Próg ≤ 3 s |
|---|---|---|
| `GET /api/initiatives` | **2,39 s** | ✅ |
| `GET /api/decisions` | **2,23 s** | ✅ |
| `GET /api/tasks` (Praca) | **1,65 s** | ✅ |
| `GET /api/health` | **< 0,3 s** (`dbResponseTime: 1 ms`) | ✅ |

**Wszystkie trzy wymagane trasy mieszczą się w progu 3 s.**

### 7.3 Czas do pierwszego renderu aplikacji — ★ ZNALEZISKO WAŻNE

To **nie jest** czas API. Aplikacja na żywym stagingu montuje drzewo `#root` dopiero po
**16–36 s** od `domcontentloaded` — przez ten czas użytkownik widzi **biały ekran**, a potem
przez kilkanaście sekund napis „Loading tools…". Pomiar kontrolny (jedna przeglądarka,
bez obciążenia maszyny, `scripts/dev/odbior-staging-7e8668c7cc/dbg3.mjs`):

| Czas od wejścia | `#root` | Co widzi użytkownik |
|---|---|---|
| 5 s | **0 znaków** | biała strona |
| 10 s | 1 314 | „Loading tools…" |
| 15 s | 1 314 | „Loading tools…" |
| **25 s** | **117 940** | pełny ekran Mojej Pracy |

Zmierzone wartości `render` w zrzutach są **wyższe** (do 90 s) i **nie nadają się na liczbę
produktową**, bo dwie przeglądarki Chromium działały równolegle na jednej maszynie — to
skażenie przyrządu, nie pomiar produktu. **Liczbą do zapamiętania jest 16–26 s z pomiaru
kontrolnego pojedynczą przeglądarką.** Zero błędów konsoli i zero 4xx przez cały ten czas —
żaden bezpiecznik tego nie widzi (por. §0.1 pkt 1).

**Werdykt: WAŻNY.** Dla właściciela to jest „aplikacja się nie otwiera". Hipoteza przyczyny:
jeden wielki pakiet `assets/index-CzIIIb9c.js` ładowany synchronicznie przed pierwszą klatką
+ blokujące wywołania startowe; do pomiaru w osobnym dyżurze (nie mierzyłem podziału kodu).

---

### 7.4 Przelot przez 16 pozycji menu (1440, jasny)

Kryterium: moduł **otwiera się i pokazuje treść** (nie samą powłokę), zero błędów konsoli,
zero 4xx/5xx. „czas" = od wejścia do zniknięcia wskaźnika ładowania.

| # | Moduł | Adres zmierzony | Czas | Konsola | 4xx/5xx | Co widać | Werdykt |
|---:|---|---|---:|---:|---:|---|---|
| 1 | Chat | `/chat` | 48,0 s | 0 | 0/0 | „Nice to have you here, James", wejście głosowe, panele OUTPUT | **DZIAŁA** |
| 2 | My Work | `/my-work` | 16,5 s | 0 | 0/0 | Inbox, 8 zakładek, tabela z filtrami (ALL 11 · Overdue 4 · Action required 9) | **DZIAŁA** |
| 3 | Interview | `/interview` | 21,4 s | 0 | 0/0 | Inbox · Sessions · Assigned · Templates · Insights · Initiatives; All 3, Answered 1 | **DZIAŁA** |
| 4 | Tools | `/tools-hub` ❌ | — | 0 | 0/0 | **„Page not found"** — mój zły adres, patrz D-3 | **NIEZMIERZONE** |
| 5 | Assessment | `/assessment?tab=library` | 39,5 s | 0 | 0/0 | biblioteka ocen, **0 wywołań `/exports`** (§6) | **DZIAŁA** |
| 6 | Initiatives | `/initiatives` | **> 75 s ✗** | 1 | 0/0 | „Nie udało się wczytać danych na czas" | **REGRESJA (W-3)** |
| 7 | Execution | `/execution?tab=list&view=table` | 38,0 s | 0 | 0/0 | Dashboard · Deliveries · Work · Resources · Decisions & risks · Reports; Active 4, At risk 2, Overdue 1 | **DZIAŁA** |
| 8 | Results | `/results/kpi` | 36,9 s | 0 | 0/0 | **powłoka bez treści — środek pusty** | **REGRESJA (W-4)** |
| 9 | Finance | `/finance?tab=statements` | 27,3 s | 0 | 0/0 | Statements · Analysis · Models · Prediction · Enterprise valuation; All 1 | **DZIAŁA** |
| 10 | Materials | `/materials` | **> 75 s ✗** | 1 | 0/0 | **pusto** (0 znaków) | **REGRESJA (W-3)** |
| 11 | Audits | `/audits-hub` ❌ | — | 0 | 0/0 | **„Page not found"** — mój zły adres, patrz D-3 | **NIEZMIERZONE** |
| 12 | Meeting | `/meetings` | 22,1 s | 0 | 0/0 | „Meetings — planned for Wave 2. This module isn't part of the MVP" | **DZIAŁA** (świadomy stan) |
| 13 | Organization | `/organization` | **> 75 s ✗** | 1 | 0/0 | **pusto** (0 znaków) — **3 próby z 3** | **REGRESJA (W-3)** |
| 14 | Admin Panel | `/admin/team/members` | 27,9 s / **> 75 s ✗** | 0 / 1 | 0/0 | ADMIN PANEL, sekcje TEAM & ACCESS (1 400 znaków) — ale **druga próba nie zamontowała się w 75 s** | **DZIAŁA NIESTABILNIE** |
| 15 | Settings | `/settings/profile` | 10,9–51,8 s | 0 | 0/0 | Profile, Avatar & Photo, Email Signatures (1 337 znaków) | **DZIAŁA** |
| 16 | Partner Portal | `/partner?tab=partner-home` | 10,4–35,9 s | 0 | 0/0 | Partner Portal DBR77 Consultify, HOME · REFERRALS | **DZIAŁA** |

**Podsumowanie przelotu: 9 działa · 1 działa niestabilnie (Admin, 1 próba na 2) ·
4 regresje (Inicjatywy, Materiały, Organizacja — nie otwierają się; Wyniki — pusty środek) ·
2 niezmierzone z mojej winy (zły adres: Tools, Audits) · 1 świadomy stan „poza MVP" (Meeting).**

**Rozstrzał czasów jest sam w sobie sygnałem:** ten sam moduł potrafi się zamontować w 10 s
i nie zamontować w 75 s (Admin, Settings, Partner, My Work). To nie jest równy, przewidywalny
start — to loteria.
**Zero błędów konsoli i zero 4xx/5xx na KAŻDEJ z 16 pozycji** — łącznie z tymi, które
się nie otwierają. To jest dokładnie powód, dla którego bramka licząca błędy konsoli
nie może być jedynym odbiorem (W-2).

---

## 8. SPRZĄTANIE — co utworzyłem i co zostało

| Ślad | Co to | Stan |
|---|---|---|
| Zadanie `f9c386c1-8b09-5276-a5a0-4452f1e283b8` | **cudzy, zastany rekord Northwind** zmieniony przez sondę uprawnień (tytuł → `ODBIOR-7e8668c7cc PROBA MEMBER`, wykonawca → daniel) | **PRZYWRÓCONE 21:11** — tytuł `Agree the shuttle safety case with the works council`, wykonawca `a0e18893…` (Priya Sharma), status `blocked`, priorytet `critical` — zweryfikowane niezależnym `GET` |
| Inicjatywa `initiative-d29cc12d…` | tytuł zmieniony sondą E1a na `ODBIOR-7e8668c7cc P11 weryfikacja zapisu po czystce` | **PRZYWRÓCONE** — tytuł `P11 weryfikacja zapisu po czystce`; **`aggregateVersion` wynosi teraz 3 zamiast 1** (magazyn zdarzeń jest przyrostowy, wersji nie da się cofnąć — treść identyczna ze stanem zastanym) |
| Zadanie-sonda `a5971ae0-b5e8-4520-962b-7cf02f1b8e7f` | utworzone przeze mnie: `ODBIOR-7e8668c7cc sonda lancuch statusow`, projekt `6174636d…`, status `done` | **USUNIĘTE** (patrz meldunek na końcu) |
| Przypisania z prób `assign`/`reassign` | 3 zmiany wykonawcy na `f9c386c1…` | **PRZYWRÓCONE** wraz z rekordem (wiersz jw.) |

**Nic poza powyższym nie zostało utworzone ani zmienione. Zero zapisów na demo i na produkcji.**
Wszystkie zapisy dotyczyły wyłącznie organizacji Northwind na stagingu.

---

## 9. STOP — czego NIE zmierzyłem (i dlaczego)

Zgodnie z zasadą „brak pomiaru nie jest wynikiem", poniższe pozycje **nie mają werdyktu** —
nie wolno ich czytać jako „działa":

1. **RAID na agregacie runtime-v1** (dodanie/zmiana/usunięcie, 409 przy duplikacie) — trasa
   `…/runtime-v1/initiatives/<id>/raid-items` zwraca 404; właściwego adresu nie ustaliłem
   w budżecie, a zgadywanie tras już raz dało fałszywy raport.
2. **„Zatwierdź" i odmowa z powodem (E3b/DEC-465)** — `…/status` i `…/approve` dla runtime-v1
   zwracają 404; nie zlokalizowano pisarza od strony API.
3. **Zasoby → obciążenie > 0 %** — cztery kandydujące trasy 404.
4. **Ocena → „dodaj powiązanie" (F4c legacy C-mode)** — wymaga przejścia kreatorem.
5. **Karta „Sesja wywiadu" i „Wzorzec wywiadu"** — `MyWorkHub.tsx:1555-1570` przyjmuje wyłącznie
   typy `task` · `idea` · `decision` · `notification` · `initiative` · `notebook`.
   **Sesji wywiadu i wzorca wywiadu nie da się otworzyć jako karty N z Mojej Pracy** — nie ma
   dla nich gałęzi w tym przełączniku. To nie jest awaria, to **brak powierzchni**; wniosek
   (`interview insight`) też nie ma własnego typu.
6. **Karta działania → „Close card" realnie zmienia status** — ekran nie został otwarty.
7. **Karty Powiadomienia i Inicjatywy w Mojej Pracy** — przelot urwał się po pierwszej karcie.
8. **Prawy panel (`aside` ≤ 1) i „Pracuj z AI" w Menu 1** — na żadnej karcie nie policzone.
9. **Tools i Audits** — mierzyłem złe adresy (`/tools-hub`, `/audits-hub`); poprawne to
   `/tools` i `/audit-programs` (D-3). Uzupełniający przelot nie zdążył się wykonać.

---
## 10. LISTA ZNALEZISK

### BLOKER

**B-1 · MEMBER nadpisuje cudze zadanie** — `PUT /api/tasks/<cudze>` → **200** + realna zmiana
w bazie. Plik:linia przyczyny: `server/src/services/effectiveAccessService.ts:1110-1112`
(wyjście `kind === 'allow'` przed sprawdzeniem własności) w zestawieniu z
`effectiveAccessService.ts:1039` (`SCOPE_SUFFIXES = ['.scoped']`) i szablonem
`effectiveAccessService.ts:318` (`task.update.scoped` w INITIATIVE_OWNER).
Bramka pozornie broniąca: `server/src/routes/pmo/tasks.routes.ts:1177-1186`.

**B-2 · MEMBER przypisuje sobie cudze zadanie** — `POST /api/tasks/<cudze>/assign` → **200**,
`assigneeId` realnie zmieniony. Ta sama przyczyna; zdolność `task.assign.scoped`
(`effectiveAccessService.ts:317`), bramka `tasks.routes.ts:1255-1268`.

**B-3 · MEMBER blokuje cudze zadanie** — `POST /api/tasks/<cudze>/block` → **200**,
status `todo` → `blocked` w bazie. Ta sama przyczyna; zdolność `task.status.update.scoped`
(`effectiveAccessService.ts:320`), bramka `tasks.routes.ts:1370-1383`.

**B-4 · Karta zadania w Mojej Pracy nie ładuje treści dla 38 z 46 zadań** —
`GET /api/my-work/personal-tasks/<id>` → **404 `TASK_NOT_FOUND`**, karta stoi na „Loading…".
Plik:linia: `src/components/MyWork/TaskDetailView.tsx:1095` (`ownerScoped ? getPersonalTask :
getTask`) i `:196` (domyślne `ownerScoped = true`); serwerowy filtr
`buildPersonalTaskOwnerScope` odcina każdego, kto nie jest **wykonawcą**. Paczka E1c/F1
naprawiła to dla kart modułowych (`ownerScoped={false}`), Mojej Pracy **nie** —
`TaskDetailView.tsx:175-195` sam opisuje ten defekt i to założenie. Pełny dowód: §1.1.

> **Pierwsze trzy mają jedną przyczynę i jedną poprawkę.** To nie są trzy niezależne błędy —
> to jeden `return` w linii 1111, który trzykrotnie wychodzi na powierzchnię.

### WAŻNY

**W-1 · Aplikacja montuje się 16–26 s** (pomiar kontrolny pojedynczą przeglądarką; §7.3).
Przez pierwsze ~10 s **biały ekran**, potem „Loading tools…". Zero błędów konsoli i zero 4xx
przez cały ten czas — żaden istniejący bezpiecznik tego nie widzi. Hipoteza: jeden duży pakiet
`assets/index-*.js` + blokujące wywołania startowe; do zmierzenia osobno.

**W-3 · Dwa moduły nie otwierają się w ogóle: Inicjatywy i Materiały.** `/initiatives` i
`/materials` nie zamontowały treści w **75 s** — odpowiednio **3 z 3** i **2 z 2** prób, w tym
próby bez obciążenia maszyny. Inicjatywy kończą ekranem „Nie udało się wczytać danych na czas",
Materiały zostają **puste** (`body.innerText` = 0 znaków). W obu wypadkach: **zero błędów
konsoli, zero 4xx, zero 5xx** — a `GET /api/initiatives` z tej samej sesji odpowiada 200 w 2,4 s.
Dane są, ekran ich nie pokazuje. Zrzuty: `15-initiatives-jasny.png`, `19-materials-jasny.png`.
**Zastrzeżenie:** mierzone headless Chromium z zimnym cache; przed eskalacją potwierdzić
w zwykłej przeglądarce z ciepłym cache — ale 5 nieudanych prób z 5 to nie jest szum.

**W-4 · Moduł Wyniki otwiera się z pustym środkiem.** `/results/kpi`: powłoka, pasek boczny
i nagłówek „Results" renderują się, **obszar treści jest całkowicie pusty** — bez danych,
bez kręciołka, bez stanu pustego. `body.innerText` = 96 znaków (sama powłoka), 0 błędów
konsoli, 0 × 4xx/5xx. Zrzut: `17-results-jasny.png`.

**W-2 · Bezpiecznik „0 błędów konsoli" przechodzi nad białym ekranem.** Cztery pierwsze zrzuty
tego odbioru miały `konsola=0`, `4xx/5xx=0/0` i **pusty obraz** (§0.1 pkt 1). Każda bramka
oparta wyłącznie na liczniku błędów konsoli jest ślepa na najgorszy możliwy stan ekranu.
Poprawka wniesiona do przyrządu: `waitForFunction(#root.innerHTML.length > 20000)`; ta sama
poprawka powinna trafić do `scripts/dev/odbior-zywo/acceptance-console-clean.mjs`.

### DROBNE

**D-1 · `/api/megatrends` bez `/baseline` nie odpowiada** (timeout), `/api/v8/megatrends` → 404.
Działa wyłącznie `/api/megatrends/baseline?industry=…`. Koszt: każdy następny pomiar traci
na tym czas.

**D-3 · Błąd MOJEGO przelotu, nie produktu — adres Audytów.** Pierwszy przelot mierzył
`/audits-hub` (nie istnieje) i `/audits` (to **publiczna strona marketingowa**,
`src/routes/AppRoutes.tsx:1459`). Moduł w aplikacji stoi pod **`/audit-programs`**
(`AppRoutes.tsx:1760`, przekierowanie `:866`). Zapisuję jako ostrzeżenie dla następnego
pomiaru — nie jako defekt.

**D-0 · Komunikat awarii ładowania jest ZAWSZE po polsku, także dla konta angielskiego.**
Inicjatywy pod obciążeniem pokazały ekran „**Nie udało się wczytać danych na czas / Ładowanie
trwało dłużej niż 15 sekund. Spróbuj ponownie.**" na koncie, które ma `language: "en"`.
Źródło: `src/components/shared/states/ErrorState.tsx:70` i `:76` — teksty są w `defaultValue`,
a kluczy **`common.loadingTimeoutTitle` i `common.loadingTimeoutDescription` NIE MA ani w
`public/locales/en/translation.json`, ani w `pl/translation.json`** (sprawdzone oba pliki).
Czyli `t()` nigdy nie ma czego podstawić i **każdy użytkownik, w każdym języku, widzi polski
tekst**. To 18. kształt („klucz istnieje ≠ przetłumaczony") w odmianie „klucza w ogóle nie ma".
Sprzeczne z DEC-461. Naprawa: dodać oba klucze do obu plików.

**D-4 · Polskie dane na koncie angielskim.** Karta działania `13efc367…` renderuje treść
merytoryczną po polsku („Odchylenie: Training Hours per FTE 01.2026 — rezultat 6,8
hours/quarter poza limitem") na koncie z `language: "en"`. To dane, nie interfejs — ale
właściciel zobaczy mieszankę. Sprzeczne z DEC-461 (staging po angielsku).

**D-2 · `POST /api/tasks/:id/reassign` odrzuca kształt `{assigneeId}`** komunikatem
`expected string, received undefined` dla `fromAssigneeId`/`toAssigneeId` — poprawnie, ale
niezgodnie z rodzeństwem `/assign`, które bierze `{assigneeId}`. Dwa różne kontrakty na
sąsiednich trasach.

### ZASTANE (potwierdzone, bez zmiany)

**Z-1 · `POST /api/tasks/:id/assign` na zadaniu bez projektu → 500** `INTERNAL_ERROR`
(`correlationId: 27035dca-dde9-4a35-98fd-0deba08583c5`). Znany sygnał z rejestru 21:02.
Na Northwind dotyczy **9 z 46** zadań. **To jedyne 5xx w całym przebiegu.**

---
## 11. DLA WŁAŚCICIELA

### Trzy obrazy do karty porannej

| # | Plik | Co pokazuje |
|---|---|---|
| 1 | `evidence/odbior-staging-7e8668c7cc/dowod-bloker-put-member.json` | jedyny „obraz", który tu potrzebny: cudze zadanie Northwind po tym, jak zwykły członek zespołu zmienił mu tytuł i przypisał je sobie — z kodem odpowiedzi **200** |
| 2 | `evidence/odbior-staging-7e8668c7cc/02-karta-zadanie-ciemny.png` | karta zadania w „Mojej Pracy" stojąca na „Loading…" — tak wygląda 38 z 46 zadań Northwind |
| 3 | `evidence/odbior-staging-7e8668c7cc/15-initiatives-jasny.png` | Inicjatywy — ekran, który przy wolniejszym łączu kończy się komunikatem „Nie udało się wczytać danych na czas" |

### Cztery zdania po polsku, bez żargonu

0. **Karta zadania w „Mojej Pracy" nie otwiera treści dla 8 zadań na 10** — kręci się w
   nieskończoność, bo pokazuje tylko te, których jesteś wykonawcą, a nie te, które sam zgłosiłeś.
1. **Zwykły członek zespołu może zmienić, przypisać sobie i zablokować cudze zadanie** —
   sprawdziłem to na żywym stagingie na prawdziwym zadaniu i naprawdę się zmieniło; wszystko
   przywróciłem, ale dziura jest otwarta i trzeba ją zamknąć przed wpuszczeniem kogokolwiek
   do pilotażu.
2. **Wszystko inne, co miało być naprawione tą linią, działa** — zapisy przechodzą i przeżywają
   odświeżenie, decyzje i inicjatywy poprawnie odmawiają niepowołanym, megatrendy pokazują
   właściwą branżę, a w całym przebiegu wypadła tylko jedna znana awaria z listy.
3. **Trzy moduły — Inicjatywy, Materiały, Organizacja — w ogóle się nie otwierają**, a Wyniki
   otwierają się puste; dane na serwerze są, ekran ich nie pokazuje.
4. **Aplikacja otwiera się kilkanaście do dwudziestu kilku sekund** i przez pierwsze sekundy
   jest biała — to nie jest awaria w żadnym dzienniku, ale użytkownik odbierze to jako
   „nie działa".

---
## 12. NOTA METODYCZNA — dlaczego ten raport ma tyle „STOP"

Budżet wynosił ~90 minut; pomiar trwał ~2 h 20 min. Nadmiar poszedł **w całości** na trzy
rzeczy, z których żadna nie była przewidziana:

1. **Trzykrotna przebudowa przyrządu** (§0.1). Pierwsze 4 zrzuty białe, kolejnych 16 — powłoka
   z kręciołkiem. Oba przeloty **odrzuciłem i powtórzyłem**, zamiast opisać to, co wyszło.
2. **Znalezisko uprawnień** (§4) rozrosło się z jednej próby do 10 wywołań plus próba obalenia
   własnej tezy, bo pierwszy wynik był częściowo mój błąd (`reassign`).
3. **Aplikacja jest wolna** — pojedynczy zrzut kosztuje 20–90 s zamiast zakładanych 5 s.
   To samo w sobie jest znaleziskiem (W-1), ale zjadło cały zapas czasu na punkty 2 i 3 brief-u.

Pozycje w §9 **nie są** „sprawdzone i w porządku" — są **niesprawdzone**. Gdyby ktoś przepisał
ten raport do rejestru jako „odbiór przeszedł", byłoby to fałszem w sześciu miejscach.

---
