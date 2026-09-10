# ODBIÓR ADWERSARYJNY W2B — Inicjatywy i Realizacja, PO dwóch partiach napraw (10.09.2026)

**Zadanie:** 2-B. Ponowny odbiór po partiach napraw E1a·E1b·E1c·E2·E2b·E3·E3b (+ C1-FIX)
na kodzie, który idzie na staging.
**Punkt odniesienia (PRZED):** `git show 417a108628:docs/program/PRZEKAZANIE_KODOWANIA_20260907/ODBIOR_W1B_INICJATYWY_REALIZACJA_20260910.md`
(pomiar 10.09 14:35 na kodzie `691e2d3b0f`).
**Zasada pomiaru bez zmian:** dla każdej powierzchni mierzone są OBA kierunki — (1) czy dane się
POKAZUJĄ, (2) czy da się je ZMIENIĆ z interfejsu i czy zmiana przeżywa pełne przeładowanie strony.
Każdy wiersz: krok UI → kod HTTP → stan w bazie/po `reload()`.

---

## 0. Stanowisko pomiaru

| Element | Wartość |
|---|---|
| Worktree | `/Users/piotrwisniewski/Developer/wt/w1b-odbior-inicjatywy` |
| Gałąź / SHA | `mvp/odbior2-20260910` / **`71094d987e`** (`git rev-parse --short HEAD` przy starcie i przy commicie) |
| Baza | kopia `consultify_kopia_w2b` z `consultify_staging_1009` (kontener `consultify-pg18`, port 54418). **Żadna żywa baza nie była dotykana**; kopia skasowana po pracy |
| Organizacja | DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063` — 106 wierszy w tabeli `initiatives`, 21 agregatów runtime-v1, 115 wierszy w Realizacja→Praca |
| API | lokalnie `:4229` (`NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_MANAGED_SCHEMA=off ENABLE_V8_GLOBAL=true`), `ENABLE_INITIATIVE_UNIFIED_READ` **nieustawiona** (jak na stagingu) |
| Front | Vite `:3249`, tryb `staging`, 34 flagi `VITE_*` 1:1 z konfiguracji Railway staging |
| Konta | `audyt@dbr77.local` (ADMIN) i `audyt.member@dbr77.local` (MEMBER), obydwa z `user_preferences.onboarding_completed=true` |
| Przyrząd | Playwright/Chromium 1440×900 (część pomiarów 1440×1000–1400 dla stopki podglądu), motyw jasny wymuszony przez `consultify-storage.state.theme`, `page.on('console'/'pageerror'/'response'/'dialog')` |
| Zrzuty | `evidence/w2b-odbior/` (62 pliki) |

### 0.1 Cztery pułapki przyrządu złapane w tym pomiarze (bez nich raport byłby fałszywy)

1. **Motyw z zustand, nie z `prefers-color-scheme`.** Pierwsze zrzuty wyszły CIEMNE mimo ustawiania
   `theme-storage` i klasy `dark`. Prawdziwy klucz to `consultify-storage` (`useAppStore.ts:44`),
   pole `state.theme`, i wymaga **przeładowania strony**. Poprawione — wszystkie zrzuty w raporcie
   są jasne.
2. **`body.innerText()` kłamie w drugą stronę.** Dwa razy odczyt tekstu zwrócił „nie ma", a zrzut
   z tej samej sekundy pokazywał treść (autozapis opisu, tytuł nowej inicjatywy w rejestrze).
   Każde „nie widać" w tym raporcie opiera się na ZRZUCIE, nie na odczycie tekstu.
3. **Klik w środek wiersza tabeli Praca nie zawsze otwiera podgląd.** Wiersz ma 1270 px szerokości;
   jego geometryczny środek wypada na komórce OSOBA, która ma własny element interaktywny i połyka
   klik. Wyglądało to na regresję („po zmianie statusu wiersz przestaje otwierać podgląd”) i było
   **fałszywym alarmem** — klik w pierwszą komórkę otwiera podgląd normalnie. Zweryfikowane
   `elementFromPoint` + klik programowy. **To NIE jest defekt produktu.**
4. **Skrypt czyszczący zrzuty zniszczył zrzut.** Pierwsza wersja ukrywania plakietek przyrządu
   („LOCAL @…", „3 V9 overrides") szła 4 poziomy w górę i ukryła cały `#root` — zrzut wyszedł biały.
   Poprawione na „najwyższy przodek, którego CAŁA treść to nadal ta plakietka".

---

## 1. INICJATYWY — PRZED → PO

| Powierzchnia | PRZED (14:35, `691e2d3b0f`) | PO (`71094d987e`) — dowód | Werdykt |
|---|---|---|---|
| Rejestr (lista) | DZIAŁA, 99 wierszy, 0 błędów | **DZIAŁA** — 99 wierszy, `StandardTable`, PL, 0×4xx/5xx, 0 błędów konsoli, 0 `pageerror`. `02-inicjatywy-rejestr.png` | **DZIAŁA** |
| **Rejestr → kolumna STATUS** | **WAŻNY — pokazywał nieprawdę**: 7× „Zatwierdzona" wobec 2 APPROVED w bazie; wiersz 1 „Wdrożenie sieci czujników IoT" rejestr „Zatwierdzona", karta „Do zatwierdzenia", baza `PENDING_APPROVAL` | **NAPRAWIONE.** Ten sam wiersz: rejestr „Do zatwierdzenia" = karta = baza. Pomiar źródłowy: 6 rekordów runtime-v1 koliduje z tabelą klasyczną, wszystkie mają `lifecycleState=APPROVED_BACKLOG`, a rejestr bierze teraz `status` z tabeli klasycznej (2× APPROVED → 2× „Zatwierdzona"). Pozostałe 2 „Zatwierdzona" to rekordy **wyłącznie** runtime-v1 (brak odpowiednika w tabeli — nie mają czemu przeczyć). „Wstrzymana" ×2 = `onHold=true`, zgodne. **Zero rozjazdów** po parowaniu id | **DZIAŁA** (E1a/N2) |
| Rejestr → kebab wiersza | 3 pozycje, „Archiwizuj" wyszarzona z podpisem | **BEZ ZMIAN** — „Otwórz", „Otwórz podgląd", „Archiwizuj" (wyszarzona, podpis PL). `03-inicjatywy-kebab.png` | **WAŻNY** — decyzja produktowa (brak edycji/usuwania w kebabie) niezmieniona |
| Karta — Podgląd | DZIAŁA, 28 odczytów 200 | **DZIAŁA** — 29 żądań przy otwarciu, **0×4xx/5xx**, 0 błędów konsoli. `04-inicjatywa-karta.png` | **DZIAŁA** |
| Karta — tryb Edycja | DZIAŁA | **DZIAŁA** — przełącznik, CTA, panel AKCJE i WŁAŚCIWOŚCI. `06-inicjatywa-edycja.png` | **DZIAŁA** |
| **Zmiana statusu inicjatywy — komunikat** | **BLOKER**: `PATCH …/status` → 400 `{"error":"A current GO decision is required","rule":"GATE_DECISION_REQUIRED"}`, komunikat pokazany **po angielsku** | **Odmowa PO POLSKU.** Po uzupełnieniu właściciela: `PATCH /api/initiatives/:id/status` → **400**, toast: **„Brakuje aktualnej decyzji GO komitetu."** Zrzut `12-odmowa-statusu.png`. Status w bazie bez zmian (`PENDING_APPROVAL`) | **ZNANE-ZABLOKOWANE-DECYZJĄ** (decyzja 5 właściciela; komunikat naprawiony przez E3b/B) |
| **Bramka gotowości przed zmianą statusu** | blokada po angielsku („Owner assigned", 18. kształt) | **PO POLSKU** — bez właściciela: „Nie można przejść dalej — brakuje elementów blokujących:\\n• **Właściciel przypisany**". `11-cta-zatwierdz.png` | **DZIAŁA**, ale patrz defekt D-1 niżej |
| Karta — właściciel | DZIAŁA (PUT 200, po reload) | **DZIAŁA** — `PUT /api/initiatives/:id` → 200, `owner_execution_id=4cfeae1e…`, po reload „Ewa Nowicka". `09b-wlasciciel-po-reload.png` | **DZIAŁA** |
| Karta — priorytet | DZIAŁA | **DZIAŁA** — `PUT` → 200, `initiatives.priority='high'`, po reload „Wysoki". `16-priorytet-po-reload.png` | **DZIAŁA** |
| Karta — autozapis opisów | DZIAŁA (1× PUT, 0 pętli) | **DZIAŁA** — dokładnie **1×** `PUT` → 200, **0 żądań przez 13 s bezczynności**, treść widoczna po pełnym reload. `15b-autozapis-po-reload.png` | **DZIAŁA** |
| **Karta — RAID: edycja** | **WAŻNY** — `PATCH …/raid-items/:id` → **409**, retry → 200 (2/2 prób) | **NAPRAWIONE** — **1× PATCH → 200, ZERO 409**; `raid_items.probability='HIGH'` w bazie | **DZIAŁA** (E1a/N3) |
| Karta — RAID: dodanie | DZIAŁA (POST 201) | **DZIAŁA** — `POST …/raid-items/:id` → **201**, 0×409 | **DZIAŁA** |
| **Karta — RAID: usunięcie** | DZIAŁA z długiem (409 → 200) | **NAPRAWIONE** — modal PL („Usunąć „Nowa pozycja"? Tej operacji nie można cofnąć."), `DELETE` → **200, 0×409**, wiersz zniknął z `raid_items` (1 → 0). `24-raid-modal.png`, `25-raid-po-usunieciu.png` | **DZIAŁA** |
| Karta — Bramy | 13 wierszy cyklu; **brak pola decyzji GO/NO-GO** | **BEZ ZMIAN** — 13 wierszy, decydent, gotowość i blokady **po polsku**; przeszukanie wszystkich widocznych przycisków: **żadnego pisarza decyzji GO/NO-GO**. `10-sekcja-bramy.png` | **ZNANE-ZABLOKOWANE-DECYZJĄ** (E3b/A STOP — decyzja 5) |
| **Nowa inicjatywa → „Wypełnij formularz"** | **BLOKER** — 201/201, ale rekordu nie ma w tabeli `initiatives`; karta pętli `PUT … → 404` (6 przy otwarciu + **9 na 15 s bezczynności**), jedyny ślad: plakietka „Niezapisane" | **PĘTLA ZLIKWIDOWANA.** `POST source-proposals` 201 → `POST registrations` 201; karta otwiera się z treścią z formularza; **0 żądań przez 20 s bezczynności, 0× PUT**; w nagłówku jawny komunikat: „**Ta inicjatywa jest w nowym rejestrze — edycja z karty będzie dostępna po scaleniu rejestrów**". `28-po-utworzeniu.png`, `29-nowa-karta-komunikat.png` | **DZIAŁA** (E1a/N1) — z zastrzeżeniami D-2 i D-3 |
| Nowa inicjatywa → zapis tytułu | pętla 404, nic się nie zapisywało | **DZIAŁA** — edycja tytułu w nagłówku → `PATCH /api/initiatives/runtime-v1/initiatives/:id/metadata` → **200**; `ie_aggregate_state.payload_json.title` = nowa wartość, `version` 1 → 2; **po pełnym reload nowy tytuł widoczny w rejestrze**. `30-nowa-tytul-zmieniony.png`, `30b-rejestr-po-zmianie.png` | **DZIAŁA** |
| Nowa inicjatywa → zapis pozostałych pól (opis problemu itd.) | pętla 404 | **ŚWIADOMIE ZABLOKOWANE** — edycja „Opisu problemu": **0 żądań**, komunikat blokady w miejscu statusu zapisu. Zgodne z projektem N1 (tylko `title/summary/description` mają kanonicznego pisarza) | **ZNANE-ZABLOKOWANE-DECYZJĄ** (blok „jeden magazyn, część zapisowa") |
| **Karta → Zadania → „Otwórz task"** | (nie mierzone w W1B jako osobna pozycja; rodzina defektu z Realizacji) | **DZIAŁA** — kebab wiersza zadania: „Otwórz task", „Duplikuj", „Usuń"; klik → `GET /api/tasks/:id` → **200**, karta zadania otwiera się jako zakładka, **zero 404, zero ekranu „Nie znaleziono zadania"**. `34-karta-zadanie-otwarte.png` | **DZIAŁA** (E1c/F1) |
| Karta — Analiza finansowa / „Wygeneruj z AI" | STOP-3 (brak kredytów LLM) | **STOP — nadal niemierzalne** (patrz §5) | **STOP** |
| Nowa inicjatywa → „Kreator inicjatywy AI" | STOP-3 | Kreator **otwiera się**, 5 kroków, całość po polsku, 0×4xx/5xx. Sama generacja niemierzalna (§5). `66-kreator-ai.png` | **STOP częściowy** |

### 1.1 Defekty ZNALEZIONE W TYM ODBIORZE (nie było ich na liście PRZED)

**D-1 — literalne `\n` w komunikacie blokady bramy (widoczne dla właściciela).**
Toast pokazuje: `Nie można przejść dalej — brakuje elementów blokujących:\n• Właściciel przypisany`
— znak `\n` jest **wypisany dosłownie**, nie łamie linii. Źródło:
`public/locales/pl/translation.json:13190` i `public/locales/en/translation.json:14002` —
wartość ma `"…blokujących:\\n• {{items}}"` (podwójny backslash w JSON = literalny `\n` w tekście).
**Defekt ZASTANY** (ten sam ciąg jest w `691e2d3b0f`), ale **nowo widoczny**, bo dopiero E3b sprawił,
że ten komunikat w ogóle dociera do użytkownika po polsku. Zrzut: `11-cta-zatwierdz.png`.
Naprawa: pojedynczy `\n` w obu plikach. ~10 minut.
**Werdykt: KOSMETYKA WIDOCZNA** (właściciel zobaczy „śmieć" w komunikacie).

**D-2 — komunikat o nowym rejestrze pomalowany na czerwono (`text-c-danger`).**
Zmierzony kolor: `rgb(232, 5, 56)`, klasa `shrink-0 text-xs text-c-danger max-w-[280px] text-right`
(`InitiativeDocumentView.tsx:11140-11142` — `saveState="error"`). To komunikat **informacyjny**
(„edycja z karty będzie dostępna po scaleniu rejestrów"), a nie stan krytyczny. `CLAUDE.md` §UI pkt 3:
czerwień wyłącznie dla semantyki krytycznej.
**Werdykt: KOSMETYKA** (naruszenie kanonu koloru). Naprawa: własny wariant „info" zamiast `saveState='error'`.

**D-3 — karta nowej inicjatywy nie otwiera się z adresu URL.**
`GET /initiatives?mode=doc&open=initiative-24a3880d-…` w świeżej sesji **pokazuje rejestr**, nie kartę
(karta otwiera się tylko bezpośrednio po utworzeniu, w tej samej sesji). Skutek dla właściciela:
nie da się wrócić do świeżo utworzonej inicjatywy linkiem ani po odświeżeniu — trzeba ją znaleźć
na liście (jest tam, na górze) i otworzyć dwuklikiem.
**Werdykt: WAŻNY.** Rodzina „jeden magazyn" — do bloku zapisowego.

**D-4 — mieszanka językowa na karcie inicjatywy i w rejestrze.**
(a) Nagłówek sekcji „**Tasks**" i przycisk „**Dodaj task**" na polskiej karcie (`32-karta-zadania.png`);
kebab wiersza zadania: „Otwórz **task**".
(b) Tytuł karty „**IoT Sensor Network Deployment**" przy tytule w rejestrze „**Wdrożenie sieci
czujników IoT**" — dwa różne teksty dla tego samego rekordu (karta czyta tytuł z metadanych
runtime-v1, rejestr z `initiatives.name`). Właściciel widzi to jako „otworzyłem nie tę inicjatywę".
**Werdykt: (a) KOSMETYKA · (b) WAŻNY.**

**D-5 — `column "assigned_to" does not exist` (NOWE, nie było w W1B).**
Log API, 4 wystąpienia: `[NotificationService] enrichEntityData failed for TASK/<id>: error: column
"assigned_to" does not exist`. Powiadomienia o zmianie zadania **cicho nie powstają**. Ekran nic nie
pokazuje, konsola przeglądarki czysta.
**Werdykt: WAŻNY** (drugi po `task_history` fantom kolumny na tej samej ścieżce zapisu zadania).

---

## 2. REALIZACJA — PRZED → PO

| Powierzchnia | PRZED | PO — dowód | Werdykt |
|---|---|---|---|
| 6 zakładek (Kokpit · Realizacje · Praca · Zasoby · Decyzje i ryzyka · Raporty) | wszystkie renderują | **Wszystkie 6 renderuje**, liczby zgodne z PRZED: Kokpit 10 wierszy TOP ryzyk, Realizacje 8, Praca 115, Zasoby 56, Decyzje 73, Raporty 2. **0×4xx/5xx, 0 błędów konsoli, 0 `pageerror` na KAŻDEJ z 6 zakładek**. `40-realizacja-*.png` | **DZIAŁA** |
| **Realizacje → kebab wiersza** | **WAŻNY** — „Otwórz podgląd" **×2 (duplikat)**, „Usuń" trwale wyłączone **bez wytłumaczenia** | **NAPRAWIONE** — 3 pozycje: „Otwórz podgląd" (raz), „Edytuj", „Usuń" wyłączone **z podpisem PL**: „Usunąć można tylko inicjatywę w statusie „Szkic" lub „Odrzucona". Tę inicjatywę trzeba najpierw anulować w cyklu życia." `41b-realizacje-kebab.png` | **DZIAŁA** (E1b/R2) |
| **Praca → kebab wiersza** | **WAŻNY** — tylko 2 pozycje („Otwórz zadanie", „Otwórz podgląd"); brak edycji, usuwania, statusu, przypisania | **NAPRAWIONE** — **6 pozycji**: „Otwórz zadanie", „Przypisz osobę", „Ustaw status: …" (lista zależna od bieżącego statusu — dla „Wykonane" 2 przejścia, dla „W toku" 5), „Otwórz podgląd", „Usuń". `45-praca-kebab.png` | **DZIAŁA** (E3/P2) |
| **Praca → „Otwórz zadanie"** | **BLOKER** — ekran „Nie znaleziono zadania…", `GET /api/my-work/personal-tasks/:id` → **404** (3/3 wiersze), nawigacja uciekała z `/execution` na `/my-work` | **NAPRAWIONE** — sprawdzone na wierszach 0, 2 i 5: **0×404, 0 ekranu „Nie znaleziono zadania", adres zostaje na `/execution`**, otwiera się panel podglądu w module. `55-zadanie-otwarte.png` | **DZIAŁA** (E1b/R1) — z uwagą U-1 |
| **Praca → zmiana statusu zadania** | **BLOKER** — nie było ŻADNEJ kontrolki statusu (ani wiersz, ani kebab, ani stopka); „Zamknij zadanie" wyłączone z podpisem „ustaw najpierw W toku" — **a nie było czym ustawić** | **NAPRAWIONE, pełny łańcuch zmierzony:** pill „Zmień status" w stopce podglądu → select z przejściami z `GET /api/tasks/workflow-config`. Do zrobienia → **W toku** (`PUT /api/tasks/:id` 200, po reload „W toku") → **W przeglądzie** (PUT 200) → **Wykonane** przez „Zamknij zadanie" (PUT 200). Baza: `tasks.status='done'`. Ta sama zmiana z kebaba wiersza: `PUT` 200. `50-podglad-w-toku.png`, `51-status-w-przegladzie.png`, `52-po-zamknieciu.png` | **DZIAŁA** (E3/P2) |
| Praca → podgląd → Zmień osobę / Zmień termin | Zmień osobę DZIAŁA (PUT 200, po reload) | **DZIAŁA** — obie akcje obecne w stopce (`OBRAZ-2`), pill „Przypisz osobę" w kebabie działa | **DZIAŁA** |
| Praca → „Usuń" z kebaba | brak pozycji | **DZIAŁA** — modal PL: „Usuń zadanie · Usunąć „Load testing after migration"? Tej operacji nie można cofnąć." → `DELETE /api/tasks/:id` → **200**. `58-usun-modal.png` | **DZIAŁA** |
| Praca → kolumna OSOBA | 74/115 wypełnione, zgodne z bazą | 77/115 wypełnione. **Sprostowanie własnej hipotezy:** wyglądało to na kłamstwo („Audyt Admin" w tabeli przy `assignee_id = NULL` w bazie), ale `PUT /api/tasks/:id` ustawia `owner_id` na edytującego, a **obie** powierzchnie (tabela i podgląd, pole „Odpowiedzialny") czytają to samo `ownerId` — **nie ma sprzeczności między ekranami**. Do wiadomości: każda edycja zadania czyni edytującego jego „osobą" | **DZIAŁA** (zachowanie do potwierdzenia produktowo) |
| Zasoby (obłożenie) | podaż 2240 h, **popyt 0 h, obłożenie 0 %** | **BEZ ZMIAN** — „osób 7 · popyt 0 h · podaż 2240 h · obłożenie 0 % · przeciążonych tygodni 0 · zaległość 480 h u 6 os." `43-realizacja-zasoby.png` | **ZNANE-ZABLOKOWANE-DECYZJĄ** (decyzja 2 właściciela) |
| Decyzje i ryzyka | Decyzje 73 / Ryzyka 11 / Sygnały 45 | **BEZ ZMIAN**, 0 błędów | **DZIAŁA** |
| Raporty | 2 raporty + 12 definicji | **BEZ ZMIAN**, 0 błędów | **DZIAŁA** |

### 2.1 Uwagi i defekty znalezione w Realizacji

**U-1 — „Otwórz zadanie" i „Otwórz podgląd" robią teraz to samo.**
Po naprawie R1 pozycja „Otwórz zadanie" otwiera **panel podglądu** w module — czyli dokładnie to,
co robi „Otwórz podgląd" dwie pozycje niżej. Pełną kartę zadania otwiera dopiero przycisk „Otwórz"
w nagłówku panelu. To ta sama klasa problemu, którą R2 usunął w kebabie Realizacji (duplikat).
**Werdykt: KOSMETYKA / do decyzji nazewniczej** (albo „Otwórz zadanie" ma otwierać pełną kartę,
albo pozycja jest zbędna).

**D-6 — „Zaktualizuj zadanie" na elemencie kanonicznym prowadzi do 404 i komunikatu pół po angielsku.**
Konto MEMBER, Realizacja → Praca, kebab wiersza kanonicznego (`origin` inny niż `tasks`),
pozycja „Zaktualizuj zadanie" → aplikacja próbuje otworzyć **kartę inicjatywy** dla pseudo-identyfikatora
`work:review-exec-supply-chain:task-supplier-data`:
```
404 GET /api/v8/planning/initiatives/work%3Areview-exec-supply-chain%3Atask-supplier-data
404 GET /api/initiatives/work:review-exec-supply-chain:task-supplier-data/suggested-changes
404 GET /api/initiatives/work:review-exec-supply-chain:task-supplier-data
404 GET /api/initiatives/runtime-v1/initiatives/work%3A…
```
Ekran: „Nie udało się załadować karty inicjatywy. **The card may have been moved or removed, or the
connection dropped. Try again, or go back.**" — pierwsze zdanie po polsku, drugie po angielsku.
To **ta sama rodzina** co naprawione E1b/R1 i E1c/F1 (element pracy otwierany złym czytnikiem),
na trzeciej, nieobjętej naprawą ścieżce.
**Werdykt: BLOKER dla tej ścieżki** (jedyna akcja edycyjna, jaką MEMBER ma w tym module, kończy się
błędem). **Zastrzeżenie:** na koncie ADMIN nie znalazłem w tabeli ani jednego wiersza kanonicznego,
więc **nie wiem, czy ADMIN może w to wejść** — patrz STOP-4.

**U-2 — MEMBER widzi 7 ze 115 wierszy w Realizacja → Praca** (i 86 z 99 inicjatyw).
Wszystkie 7 to elementy kanoniczne z dwóch przypadków realizacji, żaden nie jest zwykłym zadaniem.
Nie było mierzone w W1B, więc nie wiem, czy to zmiana. Jeśli tak ma być — w porządku; jeśli nie,
zwykły członek zespołu praktycznie nie ma tam pracy do wykonania. **Do decyzji produktowej.**

**U-3 — 403 przy wejściu MEMBER-a na Inicjatywy.**
`GET /api/organizations/:id/members` → **403** ×2 przy każdym wejściu. Ekran działa (86 inicjatyw
się pokazuje), użytkownik nic nie widzi. Prawdopodobnie poprawna odmowa wywołana bezwarunkowo.
**Werdykt: KOSMETYKA techniczna** (hałas 4xx na normalnym ekranie).

---

## 3. UPRAWNIENIA (MEMBER) — pomiar C

| Próba | PRZED (W1B §3.1) | PO | Werdykt |
|---|---|---|---|
| MEMBER edytuje **cudzą inicjatywę** z karty | `PUT`/`PATCH` → **200**, tytuł nadpisany (także przy `CAPABILITY_ENFORCE=enforce`) | **Nie ma czym.** Karta cudzej inicjatywy otwiera się **wyłącznie do odczytu**: brak przełącznika „Edycja/Podgląd", „Nowa inicjatywa" i „Pracuj z AI" wyszarzone, panel AKCJE: „W trybie Podglądu działania są niedostępne…". Zero żądań zapisu, baza bez zmian. `62-member-karta-inicjatywy.png` | **DZIAŁA** (E2b, fail-closed już na UI) |
| MEMBER edytuje **cudze zadanie** z Realizacji | `PUT /api/tasks/:id` → **200**, `tasks.title` nadpisane | **Nieosiągalne z tej powierzchni** — w liście MEMBER-a nie ma ani jednego zwykłego zadania (U-2), a jedyna akcja edycyjna kończy się D-6. Odmowy po polsku **nie zobaczyłem** — bo produkt nie doprowadza do żądania | **NIEZMIERZONE Z UI** — patrz STOP-5. Bramka serwerowa udowodniona testami E2 (7/7) i E2b (10/10) na realnym PG, ale **nie moim pomiarem z przeglądarki** |

---

## 4. KONSOLA, 5xx, LOG API

| Ekran | `pageerror` | błędy konsoli | 4xx/5xx w sieci |
|---|---|---|---|
| Logowanie → `/chat` | 0 | 0 | 0 |
| `/initiatives` rejestr | 0 | 0 | 0 |
| `/initiatives` karta istniejącej | 0 | 0 | 0 |
| `/initiatives` karta **nowo utworzonej** | 0 | 0 | **2** przy otwarciu (PRZED: 6 + **9 na 15 s bezczynności**); **0 przez 20 s bezczynności** |
| `/execution?tab=summary` | 0 | 0 | 0 |
| `/execution?tab=initiatives` | 0 | 0 | 0 |
| `/execution?tab=work` | 0 | 0 | 0 |
| `/execution?tab=resources` | 0 | 0 | 0 |
| `/execution?tab=control` | 0 | 0 | 0 |
| `/execution?tab=reports` | 0 | 0 | 0 |
| Praca → „Otwórz zadanie" | 0 | 0 | **0** (PRZED: 3–5 × 404) |
| Karta zadania z karty inicjatywy | 0 | 0 | **1** — `403 GET /api/my-work/object-attachments/task/:id` (ADMIN, własna organizacja; ekran nic nie pokazuje) |

Jedyne ostrzeżenia konsoli w całej sesji: `i18next::translator: accessing an object - but
returnObjects options is not enabled!` (bez zmian, KOSMETYKA).

**Log serwera (pełna sesja, `tmp/w2b/api-sesja1.log`):**

| Wzorzec | PRZED | PO |
|---|---|---|
| `column td.predecessor_id does not exist` | **4×** | **0×** — **NAPRAWIONE** (E1b/R3) |
| `relation "task_history" does not exist` | zgłoszone jako STOP zastany | **11×** (22 linie logu) — **BEZ ZMIAN**, każda zmiana statusu zadania gubi historię (insert best-effort). Migracja leży w `server/migrations/never-ran/001_upgrade_tasks.sql.sql` |
| `column "assigned_to" does not exist` (NotificationService/TASK) | nie zgłoszone | **4×** — **NOWE** (D-5) |
| 5xx w logu | — | **1** (nieistotny, przy zamykaniu procesu) |

---

## 5. REGRESJE

**Regresji nie znalazłem.** Wszystko, co działało 10.09 o 14:35, działa nadal; żadna z pozycji
„DZIAŁA" z raportu W1B nie zeszła do „nie działa". W szczególności zweryfikowane ponownie i nadal
sprawne: rejestr, kebab, karta w obu trybach, właściciel, priorytet, autozapis (1× PUT, 0 pętli),
RAID dodaj/edytuj/usuń, 6 zakładek Realizacji, „Zmień osobę".

**Jeden fałszywy alarm, który sam obaliłem** przed wpisaniem do raportu: „po zmianie statusu wiersz
przestaje otwierać podgląd" — to była geometria klikania przyrządu (§0.1 pkt 3), nie produkt.

**Trzy rzeczy, których PRZED nie było na liście, a teraz są widoczne** — D-1, D-2, D-6 — to nie są
regresje w ścisłym sensie (D-1 i D-2 to skutki uboczne naprawy komunikatów, D-6 to nieobjęta
naprawą gałąź tej samej rodziny), ale właściciel może je zobaczyć.

---

## 6. PODSUMOWANIE LICZBOWE PRZED → PO

| | PRZED (14:35) | PO (`71094d987e`) |
|---|---|---|
| BLOKERY | **3** (nowa inicjatywa/pętla 404 · zmiana statusu inicjatywy po angielsku · „Otwórz zadanie" 404) | **1** (D-6, na ścieżce MEMBER-a; dwa poprzednie zamknięte, trzeci zamieniony w świadomą blokadę produktową z polskim komunikatem) |
| WAŻNE | **6** | **4** (kebab rejestru bez edycji · D-3 karta nowej inicjatywy bez adresu · D-4b dwa tytuły tego samego rekordu · D-5 `assigned_to`) |
| KOSMETYKA | 2 | 5 (D-1, D-2, D-4a, U-1, U-3) |
| ZNANE-ZABLOKOWANE-DECYZJĄ | — | 3 (decyzja GO/zatwierdzenie inicjatywy · obłożenie/popyt 0 · zapis pozostałych pól nowej inicjatywy) |
| 404 na karcie nowej inicjatywy w bezczynności | 9 / 15 s | **0 / 20 s** |
| 409 na zapisie RAID | 1 na każdą operację | **0** |
| `predecessor_id` w logu | 4× | **0×** |

---

## 7. DANE POKAZOWE (§6 raportu W1B)

Mierzyłem na kopii `consultify_staging_1009`, która powstała **przed** partią E4 (14:47), więc brud
z §6 nadal w niej jest i nadal go widać: decyzja `zdfsf` (`decisions`, status `pending`),
dwie inicjatywy „co dalej mogę zrobić?" (`DRAFT`), `users.job_title = 'R&amp;amp;amp;D Specjalist'`,
`initiatives.problem_statement` z podwójnym escapem (`{&quot;symptom&quot;:…}`).
**Na stagingu tego już nie ma** — partia E4 (`26094949ac`, manifesty `evidence/e4-dane/manifesty/`)
wykonała czyszczenie na żywych danych 10.09 o 15:15. **Nie weryfikowałem tego na żywym stagingu**
(zakaz dotykania żywych baz) — to jedyny odczyt do potwierdzenia przez nadzorcę.

Wiersz bazowy `ie_governance_policies ('*','PRODUCT','DEFAULT','ACTIVE')` w moim szablonie:
**jest** (count = 1). STOP-1 z W1B na tym szablonie **nie występuje** — tworzenie inicjatyw działa.

---

## 8. STOP

**STOP-1 — kreator AI i „Wygeneruj z AI" nadal niemierzalne.** Świeży dowód z logu tej sesji:
`[AI:CircuitBreaker] Failure recorded for [openai] {"error":"You have no credits remaining…"}`,
`[deepseek] {"error":"Insufficient Balance"}` (38 wystąpień). Kreator **otwiera się** i jest po polsku
(5 kroków), ale generacji szkicu nie sprawdziłem. Musi to zmierzyć ktoś, gdzie klucze działają.

**STOP-2 — odmowa uprawnień po polsku niezmierzona z przeglądarki.** MEMBER nie ma w interfejsie
drogi, którą doszedłby do zapisu cudzego zadania (U-2, D-6). Bramka serwerowa ma własne testy
adwersaryjne (E2 7/7, E2b 10/10 na realnym PG), ale **teksty odmów w UI zostały sprawdzone tylko
dla inicjatyw** (tam UI blokuje wcześniej i żadna odmowa się nie pokazuje).

**STOP-3 — nie wiem, czy D-6 dotyczy konta ADMIN.** Na koncie ADMIN nie znalazłem w tabeli Praca
żadnego wiersza kanonicznego (`origin` inny niż `tasks`), więc nie miałem na czym powtórzyć.
Do sprawdzenia jednym kliknięciem na stagingu na koncie właściciela.

**STOP-4 — `task_history` nadal nie istnieje.** Każda zmiana statusu zadania próbuje wpisać historię
i cicho odbija. „Dziennik zmian" zadania jest z tego powodu pusty — właściciel może to zauważyć
przy pierwszym pytaniu „kto to zmienił".

**STOP-5 — nie wykonałem żadnej naprawy kodu.** Zmieniłem wyłącznie `docs/` i `evidence/`.
Wszystkie zmiany danych są w kopii `consultify_kopia_w2b`, skasowanej po pomiarze. W kopii
powstały 4 inicjatywy próbne i 1 zadanie zostało usunięte — **żywych baz to nie dotyczy**.
