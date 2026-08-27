# INSTRUKCJA DYŻURU nr 41 — Codex — „Audyty: ŁAŃCUCH WYTWORZENIA RAPORTU z interfejsu + eksport do dokumentu przez ISTNIEJĄCY silnik"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–40. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★ DLACZEGO TEN DYŻUR ISTNIEJE — dwa zdania, potem dowody

**Raport audytu da się OBEJRZEĆ, ale nie da się GO ZROBIĆ.**
Trzynastosekcyjny dokument renderuje się poprawnie, jest zaplombowany hashem,
wersjonowany, ma kebab z Zatwierdź/Opublikuj i pełny ekran-artefakt — a
w całym `src/` **nie istnieje ani jedna linia, która woła trasę tworzącą
raport**. Użytkownik nie ma jak dojść od skończonego audytu do raportu.

To jest ten sam wzorzec, który program zwalcza od miesiąca — **„backend ma /
front nie woła"** (`DEC-2026-08-26-100`, pilotaż panelu, Audyty `6,0/10`) —
tyle że w wersji najdotkliwszej: tu **backend jest kompletny, przetestowany
przez realny HTTP na realnym PostgreSQL i osiągalny z `curl`a**, a mimo to
produkt jest niedziałający, bo brakuje **dwóch funkcji w pliku API frontu
i dwóch przycisków**.

Dowody, każdy sprawdzony na markerze, nie z pamięci:

| Ogniwo                                                | Backend                                                                                                                                                                         | Front                                                                                                                                                  |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Finalizacja Outputu (snapshot programu, hash, wersja) | `POST /api/audits/outputs/finalize` → `outputService.finalizeOutput` (`server/src/services/audits/outputService.ts:410`), trasa `server/src/routes/audits/outputs.routes.ts:62` | **BRAK.** `grep -rn "outputs/finalize\|finalizeOutput" src/` → **zero trafień**                                                                        |
| Wytworzenie raportu (render 13 sekcji, hash, wersja)  | `POST /api/audits/reports` → `reportService.generateReport` (`server/src/services/audits/reportService.ts:130`), trasa `server/src/routes/audits/reports.routes.ts:54`          | **BRAK.** `grep -n "generateReport" src/components/Audit/method/auditsMethodApi.ts` → **zero trafień** (plik ma 840 linii i ani jednej takiej funkcji) |
| Lista raportów                                        | `GET /api/audits/reports` (`reports.routes.ts:18`)                                                                                                                              | JEST — `auditsMethodApi.ts:572`                                                                                                                        |
| Otwarcie raportu                                      | `GET /api/audits/reports/:id` (`reports.routes.ts:30`)                                                                                                                          | JEST — `auditsMethodApi.ts:581`                                                                                                                        |
| Zatwierdź / Opublikuj                                 | `POST /:id/approve` (`:83`), `POST /:id/publish` (`:93`)                                                                                                                        | JEST — `auditsMethodApi.ts:588`, `:595`                                                                                                                |
| Eksport do pliku                                      | **BRAK TRASY**                                                                                                                                                                  | „Eksport PDF — **Planowane**", wyszarzały wiersz bez `onClick` (`src/components/Audit/method/AuditReportDocumentView.tsx:1283-1284`)                   |
| Powiązanie eksportu z Materiałami                     | `POST /:id/link-material` (`reports.routes.ts:103`)                                                                                                                             | **BRAK konsumenta**                                                                                                                                    |

**Backend tego łańcucha jest dowiedziony end-to-end i to nie jest twierdzenie
z dokumentacji.** `server/src/routes/audits/__tests__/verticalSlice.http.test.ts`
buduje aplikację tym samym `initializeRoutes`, którego używa produkcyjny
bootstrap, i przechodzi całą drogę żądaniami HTTP z tokenem — w tym
`POST /api/audits/outputs/finalize` (`:404`) i `POST /api/audits/reports`
(`:412`). Czyli: **nie budujesz mechaniki. Budujesz DOSTĘP DO NIEJ.**

I jeszcze jedno, gorsze od braku przycisku. **Interfejs kłamie o tym, jak
Output powstaje.** Stan pusty w `AuditOutputsTab` mówi dosłownie:

> „Output powstaje **automatycznie** przy finalizacji programu audytowego
> (zamknięcie etapu closure)"
> (`src/components/Audit/method/tabs/AuditOutputsTab.tsx:213`)

To jest **nieprawda**. `programService.transitionLifecycle`
(`server/src/services/audits/programService.ts:978`) robi `UPDATE` na
`audit_programs` i zapisuje zdarzenie — **i nic więcej**. `finalizeOutput` ma
w całym `server/src` **dokładnie jednego wołającego**: trasę HTTP
(`outputs.routes.ts:72`). Żadne przejście cyklu życia go nie uruchamia.
Użytkownik czyta zdanie, które każe mu czekać na coś, co nigdy nie nadejdzie.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★★ FRONT TYLKO ZA NOWĄ FLAGĄ, DOMYŚLNIE `OFF`.** Każda widoczna
   kontrolka, którą dodajesz, żyje za flagą `ff_auditsReportChain`
   (`§D.3`), **domyślnie wyłączoną**, dopóki właściciel nie zaakceptuje
   czystych zrzutów. To jest **reguła 7 `CLAUDE.md`** i w tym projekcie jest
   **nienaruszalna**: _„Piotr NIGDY nie jest pierwszym testerem wizualnym"_.
   **Ty renderujesz ekran i robisz zrzut SAM**, przed pokazaniem czegokolwiek
   właścicielowi. **Nie wolno Ci przestawić domyślnej wartości tej flagi na
   `ON` w tym dyżurze — ani w kodzie, ani w `.env*`, ani w harnessie.**
   Przestawienie = odrzucenie dyżuru, nie STOP.
2. **★★ ŻADEN PRZYCISK NIE MOŻE UDAWAĆ DZIAŁANIA.** Etykieta „Planowane"
   znika **dopiero wtedy, gdy funkcja realnie działa** — nie wcześniej,
   nie „bo już prawie". W szczególności: **„Eksport PDF" to PDF, a nie DOCX.**
   Jeżeli dowozisz DOCX (a tak jest — `§D.8`), to dodajesz **nową, uczciwą
   kontrolkę „Pobierz DOCX"**, a wiersz „Eksport PDF — Planowane" **zostaje
   nietknięty jako uczciwa deklaracja braku**, dopóki PDF nie powstanie.
   Podmiana etykiety `PDF` → `DOCX` przy zachowaniu wrażenia, że „eksport PDF
   już jest", to **atrapa** i podstawa odrzucenia pozycji.
3. **★★ NIE BUDUJESZ DRUGIEGO SILNIKA DOKUMENTÓW.** Silnik istnieje
   (`server/src/services/documentStudio/documentDocxRenderer.ts`, 1964 linie,
   zbudowany w dniach 32/34) i ma już **czterech konsumentów**
   (`method-core.routes.ts:563`, `bundleExportRuntime.ts:180`,
   `initiativeMaterializeService.ts:405`, `documentStudioService.ts:1605`).
   Twoim zadaniem jest **piąty konsument**: adapter payloadu audytu na
   `DocumentSchema`. **Jeżeli badanie wykaże, że payload audytu wymagałby
   PRZEBUDOWY silnika — STOP z opisem, nie improwizacja** (`§D.7` pkt 9).
4. **★ ZERO LLM, ZERO ZMYŚLANIA.** Adapter jest **czystą, deterministyczną
   transformacją**: to samo wejście → identyczny wynik. Brak danych =
   **uczciwy placeholder z nazwą brakującego pola**, nigdy wygenerowane zdanie.
   `reportRenderer.ts:1-16` deklaruje tę granicę wprost dla renderera raportu —
   **dziedziczysz ją w całości**.
5. **★ NIE DOPISUJESZ FUNKCJI, KTÓRYCH NIKT NIE ZAMÓWIŁ.** Ten dyżur ma
   **jedenaście pozycji roboczych** (`§1.3`) plus jedną dokumentacyjną.
   Kreator raportu, edytor treści raportu, harmonogram raportów, wysyłka
   mailem, podpis elektroniczny, PDF — **POZA ZAKRESEM** (`§1.4`), idą do
   „Znalezisk", nie do kodu.
6. **★ TEN DYŻUR MA JEDNĄ TWARDĄ BRAMKĘ WEJŚCIOWĄ.** Jeżeli **BLOK 0 pkt 8**
   nie przejdzie, nie zaczynasz żadnej pozycji `D`. Zakładasz raport,
   wpisujesz STOP z dosłownym wynikiem i kończysz dyżur.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: «MARKER_SHA»**

   > **★ RAMKA WARTOWNIKA — uwaga dla nadzorcy wystawiającego ten dokument
   > (usuń tę ramkę przy wiązaniu):** w miejsce **każdego** literalnego napisu
   > `«MARKER_SHA»` wpisujesz **rzeczywisty SHA tipa `codex/m03-admin-20260824`
   > z chwili wystawienia**, we **wszystkich** wystąpieniach w tym pliku
   > (jest ich kilkanaście — sprawdź `grep -c '«MARKER_SHA»'`, wynik po
   > podmianie musi być `0`). W dokumencie **nie ma i nie może być
   > przykładowego SHA**: dzień 29 dostał instrukcję z konkretnym SHA wpisanym
   > „na przykład" i wykonawca zawiązał się do niego dosłownie, po czym
   > pracował na martwej bazie. Dopóki ta ramka nie jest usunięta,
   > a `«MARKER_SHA»` nadal jest literalnym napisem, **dokument NIE JEST
   > ZWIĄZANY** i wykonawca ma obowiązek odrzucić go na pierwszej komendzie
   > dyżuru.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru:**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

   Wynik obu komend wklejasz do raportu **dosłownie**.

3. **Jeśli marker nie jest przodkiem tipa, gałąź nie istnieje, albo
   `«MARKER_SHA»` jest nadal literalnym napisem `«MARKER_SHA»` — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/audits-gaps-20260826`,
   `codex/audits-polish-20260826`, `codex/document-engine-day32-20260828`,
   `codex/execution-*`, `codex/finance-*`, `codex/assessment-*`,
   `codex/meetings-*` ani z żadnej gałęzi dni 17–40.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem,
   ale tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to
   nie jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline «MARKER_SHA»..codex/m03-admin-20260824` i listę plików
   rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy odbiorze.
   **Rebase w trakcie dyżuru: ZAKAZANY.**

4. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest **obowiązkową** pozycją raportu. Każda z tych
   komend ma podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", **nie do improwizacji**:

   ```bash
   # (a) ★★ SEDNO CAŁEGO DYŻURU — front nie zna dwóch komend tworzących
   grep -rn "outputs/finalize\|finalizeOutput" src/ ; echo "rc=$?"
   #   oczekiwane: ZERO trafień (rc=1)
   grep -n "generateReport" src/components/Audit/method/auditsMethodApi.ts ; echo "rc=$?"
   #   oczekiwane: ZERO trafień (rc=1)

   # (b) backend tych dwóch komend ISTNIEJE i jest zamontowany
   grep -n "outputService.finalizeOutput" server/src/routes/audits/outputs.routes.ts   # oczekiwane: :72
   grep -n "reportService.generateReport" server/src/routes/audits/reports.routes.ts   # oczekiwane: :68
   grep -n "app.use('/api/audits'" server/src/Gateway.ts                                # oczekiwane: :1369

   # (c) backend jest dowiedziony realnym HTTP (nie musisz tego dowodzić od zera)
   grep -n "outputs/finalize" server/src/routes/audits/__tests__/verticalSlice.http.test.ts  # oczekiwane: :404
   grep -n "/api/audits/reports"  server/src/routes/audits/__tests__/verticalSlice.http.test.ts  # oczekiwane: :412

   # (d) ★ KŁAMIĄCY STAN PUSTY — cykl życia NIE tworzy Outputu
   grep -rn "finalizeOutput" server/src --include='*.ts' | grep -v __tests__
   #   oczekiwane: DOKŁADNIE 3 trafienia — outputs.routes.ts:72 (jedyny wołający),
   #   outputService.ts:410 (definicja), reportRenderer.ts:13 (komentarz)
   grep -n "automatycznie" src/components/Audit/method/tabs/AuditOutputsTab.tsx  # oczekiwane: :213

   # (e) SEDNO POZYCJI D.7/D.8 — silnik dokumentów i jego wzorcowy konsument
   ls server/src/services/documentStudio/documentDocxRenderer.ts                 # oczekiwane: istnieje
   ls server/src/services/assessment/assessmentDrdReportSchemaService.ts         # oczekiwane: istnieje
   grep -n "renderDocumentSchemaToDocxBuffer" server/src/routes/method-core.routes.ts  # oczekiwane: :100 (import) i :563 (wywołanie)
   grep -n "export function isDrdReportProfile" server/src/services/documentStudio/documentDocxStyles.ts  # oczekiwane: :125

   # (f) SEDNO POZYCJI D.9 — martwy wiersz eksportu
   grep -n "Eksport PDF" src/components/Audit/method/AuditReportDocumentView.tsx  # oczekiwane: :1283

   # (g) SEDNO POZYCJI D.11 — skala kryteriów
   grep -n "PAGE_SIZE" src/components/Audit/method/tabs/AuditCriteriaBrowser.tsx  # oczekiwane: :78 (=25), :122, :125
   grep -n "limit\|offset" server/src/routes/audits/criteria.routes.ts ; echo "rc=$?"
   #   oczekiwane: ZERO trafień (rc=1) — trasa NIE stronicuje

   # (h) rejestr decyzji
   grep -c "DEC-2026-08-26-100" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   grep -c "DEC-2026-08-26-113" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1

   # (i) numeracja migracji
   ls server/migrations | grep -E '^202613'                            # oczekiwane: PUSTE
   ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -3    # oczekiwane: ...20261122, 20261123, 20261240

   # (j) najwyższe zastane ID ustaleń w rejestrze modułu
   grep -o "AUD-PF-[0-9]*"  docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md | sort -u | tail -1
   grep -o "AUD-OWN-[0-9]*" docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md | sort -u | tail -1
   ```

5. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/audits-day41-<data> «MARKER_SHA»
   git worktree add /private/tmp/consultify-audits-day41 codex/audits-day41-<data>
   cd /private/tmp/consultify-audits-day41
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

   **Katalog `/private/tmp/consultify-day41-instrukcja` istnieje i jest
   worktree, w którym powstał TEN dokument. NIE pracujesz w nim, nie kasujesz
   go, nie commitujesz do jego gałęzi.**

6. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w `§0.3`, `§0.4a` i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| #         | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Dlaczego                                                                                 |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `Z1`      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/audits-day41-<data>`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Push na `origin`/demo wykonuje wyłącznie nadzorca                                        |
| `Z2`      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani żadnej gałęzi `codex/audits-*`, `codex/tools-*`, `codex/execution-*`, `codex/finance-*`, `codex/assessment-*`, `codex/meetings-*`, `codex/day2*`, `codex/day3*`, `codex/day4*`, `fix/*`, `chore/*`                                                                                                                                                                                                                                                                                                                                                           | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku               |
| `Z3`      | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Krach 3/4 powstał tak; `DEC-95`                                                          |
| `Z4`      | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Wymagania są w rejestrze uwag i decyzjach                                                |
| `Z5`      | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                                                                                                                                                                                                                                                                                                               | Chroniony, brudny worktree właściciela                                                   |
| `Z6`      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich ponad 90, w tym `consultify-day30-instrukcja`, `consultify-day33-instrukcja`, `consultify-day37-instrukcja`, `consultify-day38-instrukcja`, `consultify-day39-instrukcja`, `consultify-day40-instrukcja`, `consultify-day41-instrukcja`, `consultify-docengine`                                                                                                                                                                                                                                                                                         | Cudze worktree, część w aktywnym użyciu                                                  |
| `Z7`      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia **NASŁUCHUJĄ**: `5432`, `5474`, `5511`, `5597`, `5673`, `5674`, `5681`. Zarezerwowane przez wcześniejsze instrukcje i **ZAKAZANE**: `5432`, `5474`, `5498`, `5499`, `5511`, `5512`, `5521`, `5533`, `5544`, `5556`, `5563`, `5566`, `5567`, `5571`, `5573`, `5575`, `5577`, `5581`, `5588`, `5589`, `5591`, `5597`, `5602`, `5605`, `5613`, `5617`, `5629`, `5641`, `5648`, `5657`, `5661`, `5673`, `5681`, `55291`, `55677`, `55941`, `59321`. **★ Twój kontener PG = `5693`.** Port zajęty → bierzesz pierwszy wolny **powyżej `5693`** (i spoza listy zakazanych) i wpisujesz go do raportu | Cudze dyżury pracują równolegle                                                          |
| `Z8`      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Produkcja/demo poza zakresem                                                             |
| `Z9`      | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB, nigdy żadna baza `consultify_w3_audits_owner_*` (są **zachowane do odbioru właściciela**, `modules/12_AUDITS/MODULE_ACCEPTANCE.md` G04). **`Z9` przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** (`DEC-2026-08-26-98`)                                                                                                                                                                                                                                                                                                               | „dane demo = twarz produktu"; tamte bazy są dowodem, nie piaskownicą                     |
| `Z10`     | **★★ Dokładnie JEDNA nowa flaga funkcyjna — `ff_auditsReportChain`, domyślnie `OFF` (`§D.3`). Zero zmian wartości domyślnej JAKIEJKOLWIEK istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w harnessie, gdziekolwiek. W szczególności `ff_auditsFindingsAndReportView` i `ff_auditsScaleAndPolish` **ZOSTAJĄ takie, jakie są** (obie `ON` od akceptu właściciela 27.08, `DEC-2026-08-27-142`) — nie „porządkujesz" ich, nie przestawiasz, nie usuwasz                                                                                                                                                                                    | `CLAUDE.md` reguła 9; flip flagi wymaga akceptu Piotra na zrzutach                       |
| `Z11`     | **★★ Nie zmieniasz zachowania `reportRenderer.ts`.** Ten plik ma **twardą granicę deklarowaną w nagłówku** (`:1-16`): zero zapytań do bazy, zero AI, zero `Date.now()`/`new Date()` bez argumentu, zero `Math.random()`. Wolno Ci go **czytać i importować typy**. Każda zmiana zachowania renderera = **zmiana treści zaplombowanych raportów wstecz** = STOP                                                                                                                                                                                                                                                                                          | Raport jest deterministycznym renderem Outputu; hash plombuje treść                      |
| `Z12`     | **★★ Nie zmieniasz kształtu `AuditOutputPayload` ani `AuditReportDocument`.** Pola **dokładasz** tylko wtedy, gdy pozycja tego wprost wymaga, i **nigdy nie usuwasz ani nie przemianowujesz** — `audit_reports.payload` niesie dokumenty zapisane wcześniej i objęte `content_hash`em. Złamanie kształtu = **rozjazd hasha z treścią**                                                                                                                                                                                                                                                                                                                  | `reportService.ts:165` liczy hash z dokumentu; stare wiersze zostają                     |
| `Z13`     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/AUDITS_REPORT_CHAIN_DAY41_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/12_AUDITS/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportów dni 32/34 ani rejestru uwag właściciela NIE edytujesz**                                                                                                                                                                                                                                                                                              | Repo tonie w dokumentach-duchach                                                         |
| `Z14`     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Uważasz, że decyzja się myli → **errata w raporcie**, nie patch w rejestrze                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                               |
| `Z15`     | **Nie budujesz generowania treści modelem i nie podpinasz dostawcy LLM.** Zero nowych wywołań `llmService`, zero `/api/ai/**`, zero kolejki. **Adapter dokumentu jest czystą funkcją**                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`                                  |
| `Z16`     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych / `null` / „—" / „Planowane" / „brak API".** Brak danych **zostaje** brakiem danych. „Planowane" **znika wyłącznie razem z dowozem funkcji, której dotyczy** — nigdy „przy okazji"                                                                                                                                                                                                                                                                                                                                                                                                            | Uczciwy pusty stan > udawany wynik                                                       |
| `Z17`     | **★★ NIETYKALNE:** `server/src/middleware/auditsStrictMembership.middleware.ts`, `server/src/services/audits/permissions.ts`, `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/middleware/v8FeatureGate.middleware.ts`, `server/src/services/v8/featureFlagService.ts`, `server/src/middleware/effectiveCapability.middleware.ts`, `server/src/Gateway.ts`. Wolno **czytać** i **wołać**                                                                                                                                           | Model uprawnień i bramki naprawiane in-house; zmiana bramki = zmiana produktu            |
| `Z18`     | **★ Zakaz wszystkiego poza modułem Audyty** — z imiennymi licencjami z ramki w `§1.7`. Cudze moduły, cudze serwisy, powłoka SPEC-A jako taka, kanon triady jako taki: **NIE**                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | „jeden moduł na raz"                                                                     |
| `Z19`     | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts` ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                                                                                                                                                                                                                                                      | Dyżur nr 2 wywalił tak 27 cudzych testów                                                 |
| `Z20`     | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**                                                                                                                                                                                                                                                                                                                                                                                                           | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`)            |
| `Z21`     | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). W tym dyżurze `Z21` ma znaczenie dosłowne: **cały dyżur JEST o osiągalności**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | `DEC-104` powstał po tym, jak DoD przepuścił martwy kod jako gotowy                      |
| `Z22`     | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Montujesz aplikację tym samym `initializeRoutes`, którym robi to `verticalSlice.http.test.ts:1-23` — **nie własnym mini-routerem, nie fabryką z podstawionym serwisem**                                                                                                                                                                                                                                                                                                                                                                                     | Dzień 18: 8/8 testów zielonych, warstwa martwa                                           |
| `Z23`     | **★★ ZERO ATRAP, a w szczególności zero atrap z zewnętrznym skutkiem.** Przycisk, który po kliknięciu nic nie zapisuje, jest atrapą. Etykieta „Pobierz" przy pliku, który nie powstaje, jest atrapą. Placeholder w dokumencie **udający treść** (zamiast nazwać brak) jest **atrapą najgorszej klasy**, bo trafia do klienta na papierze                                                                                                                                                                                                                                                                                                                | To jest cała różnica między „przeszło" a „działa"                                        |
| `Z24`     | **★ Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Podanie zawężonego wyboru albo przepisanie cudzej liczby zamiast własnego przebiegu = zawyżenie i podstawa odrzucenia                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Baseline jest Twoim obowiązkiem, nie cytatem                                             |
| **`Z25`** | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts:386-388` ma fallback: przy braku `DATABASE_URL` ustawia `postgresql://iris:iris_test@localhost:5432/iris_test`. **Port `5432` NASŁUCHUJE na tej maszynie i nie jest Twój.** Uruchomienie testu DB bez `DATABASE_URL` w tej samej linii komendy = połączenie do **cudzej bazy**. Twój jedyny dozwolony `DATABASE_URL` to `postgresql://postgres:cx@127.0.0.1:5693/cx_day41`                                                                                                                                                                 | Bez tego mierzysz — albo brudzisz — nie swoją bazę                                       |
| **`Z26`** | **★★ `RUN_DB_TESTS=1` i `MOCK_DB=false` są OBOWIĄZKOWE w tej samej linii, tak samo `ENABLE_V8_GLOBAL=true`.** Pakiety realdb liczą `REAL_PG` jako `RUN_DB_TESTS==='1' && MOCK_DB==='false' && DATABASE_URL.startsWith('postgres')`. Brak którejkolwiek → cały `describe` jest **`SKIPPED`**, a `SKIPPED` **nie jest `PASS`**. Zgłoszenie w całości pominiętego pakietu jako zielonego = zawyżenie                                                                                                                                                                                                                                                       | Tak powstaje „137/137 PASS" na warstwie, która nigdy się nie uruchomiła                  |
| **`Z27`** | **★★ ZAKAZ `git stash` w tym dyżurze — w każdej postaci (`stash`, `stash -u`, `stash pop`, `stash apply`).** Musisz odłożyć stan roboczy → robisz **kopię plików przez `cp`** do `/private/tmp/consultify-audits-day41-scratch/` i wracasz do niej `cp`-em. `stash` w worktree z symlinkiem `node_modules` i z nowymi, jeszcze nie dodanymi plikami w `tests/` **cicho gubi pliki nieśledzone**. Niepusty `git stash list` na koniec dyżuru = pozycja bez `ZROBIONE_WG_DoD`                                                                                                                                                                             | Utrata nieskomitowanego dowodu jest nieodwracalna                                        |
| **`Z28`** | **★★ ZERO POŁĄCZEŃ SIECIOWYCH DO ŚRODOWISK PROJEKTU.** Zakazane w każdej postaci — `curl`, `psql`, `railway`, przeglądarka, klient HTTP w teście: `demo.consultify.ai`, dowolny host `*.railway.app`, staging, produkcja, dowolny `DATABASE_URL` inny niż Twój `127.0.0.1:5693`. Dotyczy też „tylko sprawdzę, czy tam działa" i „tylko `SELECT 1`". Naruszenie = **odrzucenie dyżuru**, nie STOP                                                                                                                                                                                                                                                        | Jedyny autoryzowany kontakt z demo/produkcją ma nadzorca; `DEC-65`, `DEC-2026-08-28-158` |

> **Ramka do `Z9`.** `Z9` przerywa **daną czynność**, nie cały dyżur: jeżeli
> zorientujesz się, że komenda celuje w cudzą albo zdalną bazę — **przerywasz
> tę komendę**, wpisujesz do „Korekt wobec instrukcji", stawiasz własny
> kontener i wracasz. Nie kończysz z tego powodu dyżuru.

> **Ramka do `Z21`.** „Dowód osiągalności" to **pełna ścieżka**: realne
> kliknięcie / realne wejście HTTP → realne bramki → zapis do bazy → **odczyt,
> który ten wiersz podnosi** → **widoczny skutek w interfejsie**. Istnienie
> pliku, zielony test jednostkowy i „skompilowało się" **nie są** dowodem.
> **W tym dyżurze ostatnie ogniwo — widoczny skutek — jest CAŁYM PRODUKTEM.**

> **Ramka do `Z23` — trzy atrapy, na które ten dyżur jest szczególnie
> narażony.** (1) Przycisk „Wystaw raport", który woła API i **nie odświeża
> listy** — użytkownik widzi „nic się nie stało" i klika drugi raz, tworząc
> duplikat wersji. (2) Eksport, który zwraca `200` z pustym buforem, bo
> adapter nie umiał zmapować sekcji — **plik istnieje, treści nie ma**.
> (3) Placeholder w dokumencie, który brzmi jak zdanie merytoryczne zamiast
> nazwać brakujące pole. Wszystkie trzy przechodzą „testy zielone".

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Jedenaście pozycji roboczych = **minimum
  jedenaście commitów** (plus jeden dokumentacyjny). Wrzucenie kilku pozycji do
  jednego commita jest **samodzielnym powodem, dla którego pozycja nie dostanie
  `ZROBIONE_WG_DoD`** (tak zginął dzień 24). Conventional commits:

  ```
  test(audits): prove the report chain is complete on the server and absent in the client (D.1)
  feat(audits): let the client call the two commands that create an Output and a Report (D.2)
  feat(audits): add the ff_auditsReportChain reveal flag, default OFF (D.3)
  feat(audits): give the session preview a real "finalize Output" control (D.4)
  feat(audits): let an Output issue a versioned report from the interface (D.5)
  fix(audits): stop telling users an Output appears automatically (D.6)
  feat(audits): map the sealed audit report payload onto the document schema (D.7)
  feat(audits): serve the audit report as a real .docx through the existing engine (D.8)
  feat(audits): replace the dead export row with a control that actually downloads (D.9)
  test(audits): prove the whole chain end to end on real PostgreSQL (D.10)
  test(audits): measure the criteria surface at production scale (D.11)
  docs(audits): day 41 report chain duty report (R.1)
  ```

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
  **★ UWAGA — `AuditReportDocumentView.tsx` ma 1359 linii, a
  `auditsMethodApi.ts` 840.** Jeżeli wynik reformatu przekracza ~3× liczbę
  Twoich linii merytorycznych — **cofasz reformat (`cp` z kopii wg `Z27`, nigdy
  `git stash`)**, zostawiasz styl zastany i wpisujesz to do raportu. Reformat
  cudzego kodu nie jest produktem dyżuru.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`
  (dla `.tsx`: `--loader:.tsx=tsx`).
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ `esbuild` TRANSPILUJE, nie typuje** — nie złapie błędu typu. Dlatego każda
  zmiana kontraktu ma test behawioralny. **W `§D.7` to ma konkretne znaczenie:**
  adapter zwracający `DocumentSchema` z brakującym wymaganym polem przejdzie
  `esbuild`, a wywróci się dopiero w rendererze — jedynym dowodem jest test,
  który **realnie renderuje bufor i sprawdza jego zawartość**.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE** (`Z22`). Nowe testy serwera kładziesz
  **obok kodu**: `server/src/routes/audits/__tests__/` (istnieje —
  `mounting.integration.test.ts`, `verticalSlice.http.test.ts`) albo
  `server/src/services/audits/__tests__/` (istnieje — 21 plików). Testy frontu:
  `src/components/Audit/method/__tests__/` (istnieje — 14 plików).
  **NOWE pliki w `tests/` wymagają `git add -f`**; pliki `__tests__` obok kodu
  dodają się normalnie.
- **★ URUCHAMIANIE TESTÓW.** `server/vitest.config.ts` wymaga uruchomienia
  **z cwd `server`** albo jawnego `--config server/vitest.config.ts` z filtrem
  `server/...`. Uruchomienie z roota z filtrem `server/src/...` bez `--config`
  zwraca `No test files found` — a to **nie jest** `PASS` ani `SKIP`, tylko
  `NIE_ZMIERZONE`. Podanie takiego przebiegu jako zielonego = zawyżenie.
  Testy frontu (`src/**`) uruchamiasz z roota, bez `--config`.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE INDEX IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
     **Każda migracja nieaddytywna = STOP.**
  2. **★★ NUMERACJA — DZIEŃ 41 MA PRZYDZIELONY PRZEDZIAŁ `20261300`–`20261309`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261299` to pule dni 22–40 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261240` z dnia
     35; **nie** bierz `20261241`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^2026[0-9]{4}_' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep -E '^202613'                           # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_audits_day41_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa (`DEC-107`).

  3. **★ SPODZIEWAM SIĘ ZERO MIGRACJI.** Ten dyżur **nie tworzy tabel** —
     `audit_outputs`, `audit_reports`, `audit_program_criteria` istnieją od
     `server/migrations/20260813_audits_method_core.sql`. Przedział jest
     przydzielony **wyłącznie na wypadek**, gdyby pomiar w `§D.11` udowodnił
     potrzebę indeksu. **Migracja bez udowodnionego pomiarem braku = pozycja
     odrzucona.** Dowód (`EXPLAIN ANALYZE` z Twojego kontenera) idzie do
     raportu **PRZED** plikiem migracji.
  4. **`MIGRATION_PREPARED`** — migracja jest przygotowana i udowodniona
     lokalnie, **nigdy** uruchomiona zdalnie (`REMOTE_EXECUTION_NOT_AUTHORIZED`,
     `Z28`).
- **★ Dane demo = twarz produktu.** Wszystko, co zapisujesz, zapisujesz do
  **swojego jednorazowego kontenera**. Twoje testy sprzątają po sobie
  w dokładnym zasięgu swojej organizacji, **PRZED usunięciem organizacji**;
  wzorzec sprzątania: `verticalSlice.http.test.ts` (`afterAll`). Sprzątanie
  kontenera **i wolumenów** (`docker rm -fv`) jest obowiązkowe (BLOK 0 pkt 11).
  **NIGDY `docker volume prune`** — zabija cudze kontenery.
- **★ ZRZUTY.** Każda pozycja frontowa (`D.4`, `D.5`, `D.6`, `D.9`) wymaga
  **czterech zrzutów**: flaga `OFF` light, flaga `OFF` dark, flaga `ON` light,
  flaga `ON` dark. Zrzuty robisz **SAM**, przez dev-render/harness z danymi
  mock, bez logowania Piotra. Zrzut ma być **czysty**: zero gwiazdek, zero
  ozdób, tokeny `c-*`, zgodny z zastanym wyglądem sąsiednich kontrolek.
  Zrzuty odkładasz do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/evidence/day41/`
  i wymieniasz w raporcie **z nazwami plików**.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie czternaście**:

1. **Realne dane** — odczyt i zapis idą do backendu. Zero mocków jako źródła
   prawdy. Pusty wynik = uczciwy pusty stan; nieznane = jawny brak **z nazwą
   brakującego pola**, **nigdy zmyślona wartość**.
2. **Zapis z readbackiem** — po komendzie zapisującej test ponownie odczytuje
   stan z bazy **niezależnym połączeniem** (osobny `pg.Client`/`Pool`), nie
   z koperty odpowiedzi.
3. **Zero atrap (`Z23`)**, w szczególności zero atrap z zewnętrznym skutkiem.
   Brak API → wpis `BRAK_API`. Brak danych → `BRAK_DANYCH`. Brak decyzji
   właściciela → `DECISION_REQUIRED` **z nazwą pytania**.
4. **Minimum 4 testy zachowania** (happy · błąd 4xx/5xx · uczciwy pusty stan ·
   **negatyw tenanta**), behawioralne. Pozycje `D.2`, `D.5`, `D.7`, `D.8`
   i `D.10` mają **wyższe minima** podane we własnych paragrafach.
5. **★ Test HTTP realnego routera** przez `supertest` na **realnym PG**,
   montujący aplikację przez `initializeRoutes` (`Z22`). Test na zmockowanym
   serwisie **nie zastępuje** tego wymogu.
6. **★ DOWÓD OSIĄGALNOŚCI (`Z21`)** — pełna ścieżka od realnego wejścia, przez
   zapis, do **widocznego skutku w interfejsie**.
7. **★ TEST DOMYŚLNEGO OKABLOWANIA (`Z22`)** — realny router, realne bramki,
   realne serwisy, **realne mapowanie błędów**; mockowanie ograniczone do
   `auth.middleware.js` i `Logger.js`. **Każdy inny mock wymaga wpisu
   w raporcie z uzasadnieniem.**
8. **Kontrole negatywne tenanta** — obcy `organizationId` nigdy nie dostaje
   `200`; `organizationId` **wyłącznie z tokenu/kontekstu**, nigdy z body/query.
   Test wysyła obcą organizację **w body ORAZ w nagłówku kontekstu org**
   i dostaje `404` (fail-closed), **nigdy `403` z danymi obiektu, nigdy `200`**.
9. **★ Kontrola negatywna zdolności** — żądanie bez zdolności wymaganej przez
   `permissions.ts` (`output.finalize` dla `D.4`, `report.draft` dla `D.5`) jest
   **ODRZUCONE i nie zostawia śladu mutacji** (dowodzisz liczbą wierszy
   w `audit_outputs` / `audit_reports` przed i po) **oraz nie zostawia
   zdarzenia** w rejestrze zdarzeń audytu. **Role ustawiasz realnym wierszem
   członkostwa programu**, nie wstrzyknięciem do `req.user`.
   **★ `permissions.ts` jest NIETYKALNY (`Z17`) — używasz zdolności, które
   już tam są** (`:76-79`): `output.finalize`, `report.draft`, `report.approve`,
   `report.publish`. **Dodanie nowej nazwy zdolności = STOP.**
10. **Realny PG w jednorazowym Dockerze** (port **`5693`**, obraz
    **`pgvector/pgvector:pg16`** — `postgres:15` **NIE przechodzi migracji**,
    brak rozszerzenia `vector`) z pełnymi migracjami, z dowodem celu połączenia
    (`Z20`/`Z25`/`Z26`), ze sprzątnięciem kontenera **i wolumenów**.
11. **★ Dla pozycji frontowych: cztery zrzuty** (`OFF`/`ON` × light/dark) wg
    `§0.3`, plus **polish-pass wewnętrzny** wg `§0.4b`. Bez kompletu zrzutów
    pozycja frontowa **nie dostaje `ZROBIONE_WG_DoD`**.
12. **Parytet i18n PL+EN w tym samym commicie** dla każdego napisu, który
    dodajesz. Zastana konwencja modułu to `isPolish ? '...' : '...'`
    (`AuditReportsTab.tsx` całą powierzchnią) plus `t(klucz, fallback)`
    w `AuditsMethodHub.tsx:307-329` — **trzymasz konwencję pliku, który
    zmieniasz**, nie wprowadzasz trzeciej.
13. **Plik przez `prettier`** przed commitem (z zastrzeżeniem z `§0.3`).
14. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód osiągalności →
dowód testowy → nazwy plików zrzutów`.

### 0.4b. ★ POLISH-PASS WEWNĘTRZNY — obowiązkowy przed KAŻDYM zrzutem

Zanim zrobisz zrzut, przechodzisz tę listę **literalnie, za każdym razem**.
To jest skrócona część B listy czekowania z `docs/ui-standards/TRIADA_KANON.md`,
zawężona do tego, co ten dyżur faktycznie dotyka:

1. **Kolor.** `primary-*` w Tailwind = **crimson `#85182F`** — **KAŻDY numer**.
   Czerwień **wyłącznie** dla semantyki krytycznej. CTA i stany aktywne =
   neutralne; fokus = **niebieski `c-focus`**. Twoje nowe przyciski kopiują
   klasy z sąsiada, który już przeszedł odbiór — wzorzec dosłowny:
   `AuditReportDocumentView.tsx:1252-1256` (`border-c-border`, `text-c-text`,
   `hover:bg-c-surface-raised`, `disabled:opacity-50`,
   `focus-visible:ring-c-focus`). **Hook `scripts/check-list-canon.sh` blokuje
   naruszenia — uruchamiasz go przed każdym commitem frontowym.**
2. **Zero własnych tabel.** Ekrany listowe **wyłącznie** `StandardTable` /
   `StandardModuleBar` / `StandardPreview`. **Nie dokładasz ani jednego
   `<table>`, ani jednej własnej siatki.** (To złamało zamrożony kanon 07-12 —
   `CLAUDE.md` reguła 9.)
3. **Kebab wiersza** — kontrakt `StandardRowMenu`, kolejność
   `context → manage → danger`. Pozycja niedostępna jest **`disabled`
   z prawdziwym powodem w `note`**, **nigdy ukryta**. Wzorzec dosłowny:
   `AuditReportsTab.tsx:196-242`.
4. **Stan zablokowany mówi DLACZEGO.** Każdy `disabled` ma tekst z **konkretną
   przyczyną i stanem bieżącym** — wzorzec: `„Wymagany status «zatwierdzony»
(obecny: szkic)"` (`AuditReportsTab.tsx:223`). „Niedostępne" bez powodu =
   pozycja odrzucona.
5. **Stan ładowania i błędu** — `LoadingState` / `ErrorState` z `shared/states`,
   nigdy własny spinner, nigdy `alert()`.
6. **Light + dark** — sprawdzasz OBA, na zrzucie widać OBA.
7. **Zero surowych ID na twarzy.** Żadnego `usr_…`, `aout_…`, `arep_…`
   w widocznym tekście. `AuditReportDocumentView` ma już maszynerię rozwiązywania
   ID na nazwy (nagłówek pliku, `:69-77`) — korzystasz z niej, nie omijasz.
8. **Zero gwiazdek, emoji i ozdób.** (Powód historyczny: „gwiazda", załamanie
   07-11.)

Wynik polish-passu wpisujesz do raportu jako **osiem odhaczonych punktów per
ekran**, nie jako zdanie „polish wykonany".

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (`Z24`)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie `Z24`.**

1. Wypisz wszystkie dotknięte pliki **komendą bazową** (`§0.1` pkt 6).
2. Wyodrębnij **współdzielone** (importuje je ktoś spoza Twojego zakresu):
   `server/src/services/documentStudio/**` (★ **dyżur 40 pracuje na tym samym
   silniku** — `§1.9`), `server/src/routes/audits/**`,
   `server/src/services/audits/**`, `src/components/Audit/**`.
3. **Zmierz zakres DWA RAZY:**
   - **(a) na markerze, PRZED pierwszym commitem** → czerwone **ZASTANE**;
   - **(b) na `HEAD` po ostatnim commicie** → różnica to czerwone **WPROWADZONE**.
     Obie liczby idą do raportu, w formacie `X PASS / Y FAIL / Z SKIPPED`, per plik.
4. Uruchom **minimum** poniższą listę. `ENV` oznacza dosłownie

   ```
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5693/cx_day41" DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock
   ```

   **w tej samej linii komendy** (`Z20`/`Z25`/`Z26`), a `VC` oznacza
   `--config server/vitest.config.ts`:

   ```bash
   # --- rdzeń audytów: serwisy i trasy (TWÓJ RDZEŃ) ---
   ENV npx vitest run VC server/src/services/audits/__tests__ --no-file-parallelism
   ENV npx vitest run VC server/src/routes/audits/__tests__   --no-file-parallelism

   # --- silnik dokumentów: MUSI zostać zielony, bo go tylko KONSUMUJESZ ---
   ENV npx vitest run VC server/src/services/documentStudio/__tests__ --no-file-parallelism
   ENV npx vitest run    tests/unit/deliverables/documentDocxGolden.test.ts

   # --- wzorcowy konsument silnika (raport DRD) — dowód, że go nie ruszyłeś ---
   ENV npx vitest run VC server/src/routes/__tests__ --no-file-parallelism -t "method-core"

   # --- bramka członkostwa audytów (nie dotykasz, ma zostać zielona) ---
   ENV npx vitest run VC server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts

   # --- front audytów: 14 plików, wszystkie w zakresie ---
   npx vitest run src/components/Audit/method/__tests__
   npx vitest run src/utils/__tests__/auditsFindingsAndReportViewFlag.test.ts
   npx vitest run src/utils/__tests__/auditsScaleAndPolishFlag.test.ts
   ```

   Pakiety `documentStudio` są w zakresie **nie dlatego, że je zmieniasz** (nie
   wolno Ci — `§1.9`), tylko dlatego, że **muszą pozostać zielone** — to jest
   Twój dowód, że nie ruszyłeś toru dyżuru 40 i dorobku dni 32/34.

5. **★ Wynik podajesz BEZ ZAWĘŻANIA, z rozbiciem i z liczbą `SKIPPED`:**

   ```
   Zakres §0.4a: <X>/<Y> PASS, <S> SKIPPED
     czerwone ZASTANE (na markerze, PRZED moim pierwszym commitem): <lista plików + liczby>
     czerwone WPROWADZONE (zapalone przez mój commit): <lista + SHA commitu, który je zapalił>
     SKIPPED z powodu env (w tym: ile z powodu REAL_PG): <lista> ← jeśli niepuste, pomiar jest CZĘŚCIOWY
   ```

   **Deklaracja „N/N PASS" na wybranym podzbiorze przy czerwonych w zakresie
   `§0.4a` = zawyżenie i podstawa odrzucenia.** **Deklaracja „PASS" przy
   pakiecie w całości `SKIPPED` = to samo** (`Z26`).

6. Deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co pominąłeś,
   i dlaczego). `CZĘŚCIOWY` bez wyliczenia pozycji jest odrzucany.
7. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu „przed/po"
   w raporcie** (pełny tekst asercji). Dotyczy też usunięcia bloku `describe`.
   Osłabienie bez wpisu = odrzucenie.
   **★ W tym dyżurze jest jedno miejsce, gdzie to Cię dotknie na pewno:**
   `AuditOutputsTab.test.tsx` może asertować dzisiejszy, **kłamiący** tekst
   stanu pustego. `§D.6` ten tekst zmienia. **Nie kasujesz testu** — przepisujesz
   go na nowy, prawdziwy tekst i wpisujesz „przed/po" dosłownie.
8. **★★ BASELINE JEST TWOIM OBOWIĄZKIEM, NIE CYTATEM.** `DEC-2026-08-26-113`
   podaje „testy 153" dla partii A i „172/172" dla partii B.
   **Przepisanie którejkolwiek z tych liczb zamiast własnego przebiegu =
   naruszenie `Z24`.** Mierzysz sam i podajesz swoje.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- **zmienić cokolwiek w `server/src/services/documentStudio/**` poza jawną
  licencją z `§1.9`** — to STOP **zawsze**, także „addytywnie", także „jedno
  pole w typie". Dyżur 40 pracuje na tych samych plikach;
- **przestawić domyślną wartość `ff_auditsReportChain` na `ON`** — to
  **odrzucenie dyżuru**, nie STOP;
- **zmienić zachowanie `reportRenderer.ts`** (`Z11`) albo kształt
  `AuditOutputPayload` / `AuditReportDocument` (`Z12`) — STOP **zawsze**;
- **dodać nową nazwę zdolności do `permissions.ts`** — STOP; używasz
  **istniejących** `output.finalize` / `report.draft` / `report.approve` /
  `report.publish` (`permissions.ts:76-79`);
- **podpiąć LLM do treści raportu albo do placeholderów** (`Z15`) — STOP;
- **zbudować drugi silnik dokumentów, drugi renderer DOCX albo własny generator
  PDF** — STOP **zawsze**, bez „to tylko mały helper";
- **stwierdzić, że payload audytu nie mapuje się na `DocumentSchema` bez
  przebudowy silnika** — to jest **przewidziany, LEGALNY STOP** (`§D.7` pkt 9),
  z pełnym opisem, którego bloku brakuje i co trzeba by zmienić;
- **dotknąć `Gateway.ts`, `auditsStrictMembership.middleware.ts`,
  `permissions.ts`, `effectiveAccessService.ts`** (`Z17`) — STOP **zawsze**;
- **zmienić kształt istniejącej koperty odczytu w sposób, który złamie
  dzisiejszego konsumenta w `src/`** — pola **dokładasz**, nigdy nie zmieniasz
  ani nie usuwasz. Gdy inaczej się nie da → STOP z rekomendacją;
- **usunąć albo przemianować „Planowane" przy funkcji, której nie dowozisz**
  (`Z16`) — STOP; „Eksport PDF" zostaje „Planowane", bo PDF-a nie robisz;
- **zbudować kreator raportu, edytor treści, harmonogram, wysyłkę mailem albo
  upload eksportu do Materiałów** — **poza zakresem** (`§1.4`), osobne zadania;
- **dodać migrację** bez pomiaru dowodzącego potrzeby, albo z numerem **spoza
  przedziału `20261300`–`20261309`** — STOP;
- test nie przechodzi i naprawa wymaga zmiany GLOBALNEGO mocka/configu vitest
  (`Z19`) — STOP zawsze, bez „addytywnie, więc nic nie zepsuje";
- pomiar zasięgu (`§0.4a`) pokazał czerwone testy w cudzym module — nie
  „naprawiasz" po cichu: opisujesz, który commit je zapalił.

**Zakaz obchodzenia hooka pre-commit (`--no-verify`) — to zakaz, nie STOP:**
naprawiasz kod, nie omijasz strażnika. Dotyczy to w szczególności
`scripts/check-list-canon.sh` i `scripts/check-artefakt.sh`.
**Zakaz `git stash` (`Z27`) — to zakaz, nie STOP:** odkładasz stan przez `cp`.
**Zakaz połączeń do demo/staging/produkcji (`Z28`) — to zakaz, nie STOP.**

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

**★ Jedno zastrzeżenie do STOP-u.** STOP jest narzędziem wobec **braku
informacji albo braku licencji**, nie wobec trudności. Ten dyżur ma **jeden
przewidziany, legalny STOP** (`§D.7` pkt 9 — niedopasowanie payloadu do silnika)
i on jest opisany co do formy dowodu. **Każdy inny STOP wymaga wskazania,
której informacji albo której licencji Ci brakuje.** „Trudne" i „dużo pracy"
nie są powodami.

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

26.08 panel ekspercki dał modułowi Audyty **`6,0/10`** — pilotaż całej metody
panelowej (`DEC-2026-08-26-100`). Werdykt nazwał wzorzec, który potem powtórzył
się w kolejnych modułach: **„backend ma / front nie woła"**. Dwie partie napraw
(`DEC-2026-08-26-113`) zasypały dwie największe dziury — zakładkę „Ustalenia"
i czytelny widok raportu — obie za flagami `OFF`, obie włączone
**dopiero po akcepcie właściciela na zrzutach 27.08** (`DEC-2026-08-27-142`).
Wynik po tych partiach: **`6,5/10`**.

Późniejszy pomiar stanu wykazał jednak rzecz, której panel nie nazwał wprost,
bo oceniał **to, co widać**, a nie **to, czego nie da się zrobić**:

> „13 sekcji raportu renderuje się, ale **nie da się wytworzyć raportu
> z interfejsu**, a »Eksport PDF« to etykieta »Planowane« bez akcji."

Do tego doszły dwa rozstrzygnięcia właściciela, które ten dyżur wykonuje:

- **`DEC-2026-08-25-125`** — ekran raportu ma renderować **ZAPLOMBOWANY payload
  13 sekcji**, a nie deck; `/presentation` (8 sekcji) jest **jawnym, drugim
  trybem**, nigdy domyślnym. Wykonane — `AuditReportDocumentView.tsx:33-46`.
- **`DEC-2026-08-28-154c`** — właściciel: **eksport BUDOWAĆ, nie ukrywać.**
  Czyli: „Planowane" nie jest rozwiązaniem docelowym; jest uczciwym opisem
  braku, który ma zniknąć **razem z dowozem funkcji**.

### 1.2. ★★ ERRATA — CZTERNAŚCIE RZECZY ZWERYFIKOWANYCH W KODZIE NA MARKERZE

Rejestr jest **hipotezą**, kod jest **faktem**. To zostało sprawdzone
`grep`em i odczytem, nie przepisane z dokumentacji. **Weryfikujesz każdy punkt
sam w BLOKU 0 i wynik wklejasz do raportu** — jeśli którykolwiek się nie
zgadza, idzie do „Korekt wobec instrukcji".

1. **`reportRenderer.renderAuditReport` (`:428`) produkuje DOKŁADNIE 13 sekcji**
   w tej kolejności: `executive_summary` (text), `scope` (keyValue),
   `methodology` (text), `limitations` (list), `overall_conclusion` (text),
   `findings_by_severity` (group), `findings_by_area` (group),
   `objective_evidence_references` (table), `systemic_conclusions` (list),
   `corrective_action_plan` (table), `verification_plan` (table),
   `appendices` (group), `traceability_matrix` (table) — `:437`–`:505`.
   **Pięć rodzajów treści: `text`, `list`, `table`, `keyValue`, `group`.**
2. **Renderer jest czysty i zaplombowany kontraktem w nagłówku** (`:1-16`):
   zero DB, zero AI, zero zegara, zero losowości. Datę „teraz" **zawsze
   dostarcza wołający** (`options.generatedAt`).
3. **Hash liczy `reportService.generateReport` z GOTOWEGO dokumentu**
   (`reportService.ts:165`: `computeOutputHash(document)`), a nie z Outputu.
   Czyli **plomba obejmuje dokładnie te 13 sekcji**.
4. **Wersjonowanie jest bezwyścigowe** — `INSERT ... SELECT COALESCE(MAX(version),0)+1`
   w jednej instrukcji (`reportService.ts:175-177`), z obsługą kolizji
   `uq_audit_reports_program_kind_version` (`:197`).
5. **Opublikowany raport jest niezmienny.** Nie ma trasy edycji. Korekta to
   `supersedeReport` (`:318`) — **nowa wersja**, nigdy `UPDATE` treści.
6. **`generateReport` wymaga zdolności `report.draft`** (`:135`),
   `finalizeOutput` — `output.finalize` (`outputService.ts:411`). Obie nazwy
   **już istnieją** w `permissions.ts:76-79`.
7. **`finalizeOutput` ma twardą regułę wejścia**: żadne ustalenie nie może być
   w `draft`/`in_review` (`outputService.ts:427-437`) — w przeciwnym razie
   `AuditStateError` z **liczbą blokujących ustaleń i przykładowym ID**.
   **To jest gotowy, dobry komunikat dla użytkownika — używasz go, nie piszesz
   własnego.**
8. **`publishReport` odmawia publikacji raportu opartego na zastąpionym
   Outputcie** (`reportService.ts:287-294`).
9. **★ `transitionLifecycle` NIE tworzy Outputu.** `programService.ts:978`
   robi `UPDATE audit_programs` + zdarzenie. `finalizeOutput` ma **dokładnie
   jednego wołającego w całym `server/src`**: `outputs.routes.ts:72`.
   **Stan pusty w `AuditOutputsTab.tsx:213` twierdzi inaczej i jest to
   nieprawda.**
10. **★ Front nie zna dwóch komend tworzących.** `auditsMethodApi.ts` (840
    linii) ma `listOutputs` (`:564`), `listReports` (`:572`), `getReport`
    (`:581`), `approveReport` (`:588`), `publishReport` (`:595`),
    `getReportPresentation` (`:837`) — i **nie ma** `finalizeOutput` ani
    `generateReport`. `POST /reports/:id/link-material` też nie ma konsumenta.
11. **Backend łańcucha jest dowiedziony realnym HTTP.**
    `verticalSlice.http.test.ts` buduje app przez `initializeRoutes` i wywołuje
    `POST /api/audits/outputs/finalize` (`:404`) oraz `POST /api/audits/reports`
    (`:412`). **Nie musisz dowodzić backendu od zera — masz dowód i wzorzec.**
12. **Silnik dokumentów ma czterech konsumentów i jawny mechanizm profilu.**
    `renderDocumentSchemaToDocxBuffer` (`documentDocxRenderer.ts:1952`);
    profil włącza się **addytywnie, istniejącym slotem**:
    `isDrdReportProfile(schema)` czyta
    `schema.formattingSchema.colorTemplateId === 'drd-report'`
    (`documentDocxStyles.ts:125-127`). **To jest wzorzec, którym dokładasz
    swój profil — nie nowa gałąź w rendererze.**
13. **Wzorzec trasy pobrania pliku istnieje i jest kompletny**:
    `GET /sessions/:sessionId/assessment-report.docx`
    (`method-core.routes.ts:552-590`) — kontrakt → schemat → bufor →
    `Content-Disposition` z **ASCII fallback i `filename*=UTF-8''`**
    (`:583`). **Kopiujesz ten wzorzec co do nagłówka.**
14. **★ Skala kryteriów: `DEC-125` zamknął OKIENKO, nie STRONICOWANIE.**
    `AuditCriteriaBrowser.tsx` ma **pager po stronie klienta**, `PAGE_SIZE = 25`
    (`:78`, `:122`, `:125`) — to zastąpiło 208-pikselowe okienko podglądu.
    Ale `GET /api/audits/criteria` **nie przyjmuje `limit` ani `offset`**
    (`criteria.routes.ts:27-45` — tylko `programId`, `conformityStatus`,
    `assignedTo`, `search`), a `criterionService.listCriteria`
    (`criterionService.ts:170-197`) robi `SELECT *` bez `LIMIT` i dokłada
    agregaty liczników. **Czyli: 300 kryteriów leci w JEDNEJ odpowiedzi,
    a klient je tylko kroi.** Czy to boli — **rozstrzygasz POMIAREM** (`§D.11`),
    nie opinią.

### 1.3. ZAKRES — dokładnie jedenaście pozycji roboczych + jedna dokumentacyjna

| Poz.   | Co                                                                                   | Warstwa     | Flaga           |
| ------ | ------------------------------------------------------------------------------------ | ----------- | --------------- |
| `D.1`  | Test-strażnik: dowód, że łańcuch jest kompletny na serwerze i nieosiągalny z klienta | test        | —               |
| `D.2`  | `finalizeOutput` + `generateReport` w `auditsMethodApi.ts`                           | front (API) | — (bez UI)      |
| `D.3`  | Flaga `ff_auditsReportChain`, domyślnie `OFF`                                        | front       | tworzy flagę    |
| `D.4`  | Kontrolka „Sfinalizuj Output" w podglądzie sesji                                     | front (UI)  | `OFF`           |
| `D.5`  | Kontrolka „Wystaw raport" na liście Outputów                                         | front (UI)  | `OFF`           |
| `D.6`  | Uczciwe stany puste Outputów i Raportów (koniec kłamstwa o „automatycznie")          | front (UI)  | częściowo `OFF` |
| `D.7`  | Adapter payloadu audytu → `DocumentSchema` (kontrakt schematu)                       | serwer      | —               |
| `D.8`  | `GET /api/audits/reports/:id/export.docx` przez ISTNIEJĄCY silnik                    | serwer      | —               |
| `D.9`  | Kontrolka „Pobierz DOCX" zamiast martwego wiersza (PDF zostaje „Planowane")          | front (UI)  | `OFF`           |
| `D.10` | Dowód end-to-end całego łańcucha na realnym PG                                       | test        | —               |
| `D.11` | Pomiar skali kryteriów (150–300) i rozstrzygnięcie sprawy stronicowania              | pomiar      | —               |
| `R.1`  | Raport dyżuru                                                                        | dokument    | —               |

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

- **PDF.** Nie budujesz. Nie szukasz biblioteki. Nie „przy okazji przez
  LibreOffice". Wiersz „Eksport PDF — Planowane" **zostaje nietknięty**.
- **Kreator raportu** (wieloetapowy wizard z wyborem sekcji, odbiorcy, języka).
  `POST /reports` przyjmuje `language`/`audience`/`confidentiality`/`templateKey`
  — **Ty wystawiasz minimum: `programId`, `outputId`, `reportKind`, opcjonalny
  `title` i `asOfDate` dla raportu realizacji.** Reszta = osobne zadanie.
- **Edycja treści raportu.** Nie ma i nie ma być — raport jest renderem.
- **`supersedeReport` z interfejsu.** Backend ma (`reportService.ts:318`),
  trasy HTTP **nie ma wcale** — to znalezisko, nie Twoja pozycja.
- **`link-material` / upload eksportu do Materiałów.** Trasa istnieje
  (`reports.routes.ts:103`) i **nie generuje żadnego pliku** (komentarz
  `reportService.ts:358`). Podpięcie eksportu do Materiałów wymaga ścieżki
  uploadu, której ten dyżur nie dotyka. **Znalezisko.**
- **Harmonogram raportów, wysyłka mailem, podpis, wersjonowanie eksportów.**
- **Cudze moduły.** Assessment, Tools, Execution, Finance — **nie**.
- **Zmiany w silniku dokumentów.** `§1.9` — kolizja z dyżurem 40.
- **Włączenie flagi na `ON`.** Robi to nadzorca **po akcepcie właściciela**.

### 1.5. Decyzje wiążące (nie podważasz ich w kodzie ani w raporcie)

| Decyzja                  | Treść wiążąca dla Ciebie                                                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DEC-2026-08-26-100`     | Audyty `6,0/10`; wzorzec „backend ma / front nie woła" jest **defektem produktu**, nie stylem                                       |
| `DEC-2026-08-25-125`     | Ekran raportu renderuje **zaplombowany payload 13 sekcji**; `/presentation` = **jawny drugi tryb**, nigdy domyślny                  |
| `DEC-2026-08-26-113`     | Dwie partie napraw Audytów; obie flagi wprowadzone jako `OFF`, włączone po akcepcie                                                 |
| `DEC-2026-08-27-142`     | `ff_auditsFindingsAndReportView` i `ff_auditsScaleAndPolish` **włączone po akcepcie właściciela na zrzutach** — **nie ruszasz ich** |
| `DEC-2026-08-28-154c`    | **Eksport BUDOWAĆ, nie ukrywać** — „Planowane" znika razem z dowozem                                                                |
| `DEC-2026-08-26-104`     | DoD wymaga **dowodu osiągalności**, nie istnienia pliku                                                                             |
| `DEC-2026-08-26-107`     | Test wstrzykujący zależności **nie dowodzi** ścieżki produkcyjnej                                                                   |
| `CLAUDE.md` reguła 4 i 7 | Odbiór ekranu = lista czekowania **oczami, za każdym razem**; **Piotr nigdy nie jest pierwszym testerem wizualnym**                 |
| `CLAUDE.md` reguła 9     | **Zakaz masowego włączania flag**; ekrany listowe **wyłącznie** `StandardTable`/`StandardModuleBar`                                 |

### 1.6. ★ PODZIAŁ FRONT / TYŁ — reguła rozstrzygająca

Ten dyżur **łamie** zwykłą zasadę „jeden dyżur = jedna warstwa" i robi to
świadomie: **sednem problemu jest właśnie SZEW między warstwami**. Dlatego
reguła jest inna niż zwykle i brzmi tak:

- **Serwer (`D.7`, `D.8`)** — dowozisz do końca, bez flagi. Nowa trasa
  eksportu jest **nowa**, więc nikomu niczego nie psuje; jej istnienie bez
  konsumenta byłoby dokładnie tym błędem, który ten dyżur zwalcza — dlatego
  konsument (`D.9`) jest w tym samym dyżurze, **za flagą**.
- **Front (`D.4`, `D.5`, `D.6`, `D.9`)** — **wszystko za flagą `OFF`**, plus
  zrzuty, plus polish-pass. **Włączenie flagi nie jest częścią tego dyżuru.**
- **Wyjątek jednego zdania w `D.6`.** Usunięcie **nieprawdziwego** zdania ze
  stanu pustego **nie jest nową funkcją i nie chowa się za flagą** — kłamstwo
  ma zniknąć niezależnie od stanu flagi. Ale tekst wskazujący **gdzie kliknąć**
  pojawia się **wyłącznie przy fladze `ON`**. To rozróżnienie jest
  obowiązkowe i sprawdzane testem (`§D.6` pkt 5).

### 1.7. Mapa plików, które Cię obchodzą (stan zweryfikowany na markerze)

**Serwer — czytasz i (gdzie napisano) piszesz:**

| Plik                                                                          | Rola                                                                             | Licencja                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- |
| `server/src/services/audits/reportRenderer.ts` (734 l.)                       | 3 renderery + kontrakt `AuditOutputPayload` / `AuditReportDocument`              | **TYLKO ODCZYT + import typów** (`Z11`, `Z12`)      |
| `server/src/services/audits/reportService.ts` (404 l.)                        | generate/list/get/approve/publish/supersede/link-material/presentation           | **TYLKO ODCZYT**                                    |
| `server/src/services/audits/outputService.ts`                                 | `finalizeOutput` (`:410`), `computeOutputHash` (`:90`)                           | **TYLKO ODCZYT**                                    |
| `server/src/services/audits/permissions.ts`                                   | zdolności (`:76-79`)                                                             | **NIETYKALNY** (`Z17`)                              |
| `server/src/routes/audits/reports.routes.ts` (118 l.)                         | trasy raportów                                                                   | **ZAPIS — tylko dołożenie trasy eksportu z `§D.8`** |
| `server/src/routes/audits/outputs.routes.ts` (96 l.)                          | trasy Outputów                                                                   | **TYLKO ODCZYT**                                    |
| `server/src/routes/audits/context.ts`                                         | `auditActor` / `assertActor` / `route()` — wspólny kształt błędów                | **TYLKO ODCZYT, obowiązkowo UŻYWASZ**               |
| **`server/src/services/audits/auditReportDocumentSchemaService.ts`**          | **NOWY PLIK — `§D.7`**                                                           | **ZAPIS (tworzysz)**                                |
| `server/src/services/assessment/assessmentDrdReportSchemaService.ts` (451 l.) | **WZORZEC** adaptera na `DocumentSchema`                                         | **TYLKO ODCZYT**                                    |
| `server/src/services/documentStudio/documentDocxRenderer.ts` (1964 l.)        | silnik DOCX                                                                      | **TYLKO ODCZYT — `§1.9`**                           |
| `server/src/services/documentStudio/documentStudioTypes.ts`                   | `DocumentSchema` (`:706`), `DocumentBlock` (`:146`), `DocumentBlockType` (`:77`) | **TYLKO ODCZYT**                                    |
| `server/src/services/documentStudio/documentDocxStyles.ts`                    | `isDrdReportProfile` (`:125`) — wzorzec bramki profilu                           | **TYLKO ODCZYT — `§1.9`**                           |
| `server/src/routes/method-core.routes.ts:552-590`                             | **WZORZEC** trasy pobrania `.docx`                                               | **TYLKO ODCZYT**                                    |
| `server/src/routes/audits/__tests__/verticalSlice.http.test.ts` (479 l.)      | **WZORZEC** testu HTTP na realnym PG                                             | **TYLKO ODCZYT**                                    |

**Front — czytasz i (gdzie napisano) piszesz:**

| Plik                                                                | Rola                                                                                          | Licencja                                                              |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/components/Audit/method/auditsMethodApi.ts` (840 l.)           | cała warstwa API modułu; `unwrapEnvelope` (`:375`), `toArray` (`:390`), `buildQuery` (`:419`) | **ZAPIS — `§D.2`, wyłącznie dołożenie funkcji**                       |
| `src/components/Audit/method/tabs/AuditProcessesTab.tsx`            | lista sesji + podgląd z przejściami cyklu życia (`:143-153`, `:389-420`)                      | **ZAPIS — `§D.4`**                                                    |
| `src/components/Audit/method/tabs/AuditOutputsTab.tsx` (236 l.)     | lista Outputów, kebab (`:127-130`), stan pusty (`:209-215`)                                   | **ZAPIS — `§D.5`, `§D.6`**                                            |
| `src/components/Audit/method/tabs/AuditReportsTab.tsx` (349 l.)     | lista raportów, kebab (`:196-242`), stan pusty (`:301-307`)                                   | **ZAPIS — `§D.6`**                                                    |
| `src/components/Audit/method/AuditReportDocumentView.tsx` (1359 l.) | ekran-artefakt raportu; panel Akcje (`:1239-1287`), martwy wiersz eksportu (`:1281-1285`)     | **ZAPIS — `§D.9`**                                                    |
| **`src/utils/auditsReportChainFlag.ts`**                            | **NOWY PLIK — `§D.3`**                                                                        | **ZAPIS (tworzysz)**                                                  |
| `src/utils/auditsFindingsAndReportViewFlag.ts`                      | **WZORZEC** flagi (query > localStorage > env > default, fail-closed)                         | **TYLKO ODCZYT**                                                      |
| `src/components/standard/**`                                        | `StandardTable`, `StandardPreview`, `StandardRowMenu`, `ArtifactRightPanel`                   | **TYLKO ODCZYT — używasz, nie zmieniasz**                             |
| `src/components/Audit/method/AuditsMethodHub.tsx`                   | powłoka modułu, zakładki, CTA                                                                 | **ZAPIS wyłącznie jeśli `§D.5` wymaga przekazania propa odświeżenia** |

### 1.8. Pułapki, na które wpadli poprzednicy (nie powtarzaj)

1. **„Backend ma, więc gotowe."** To jest dokładnie ten dyżur. Nigdy nie
   deklarujesz pozycji zrobionej na podstawie istnienia trasy.
2. **Deck zamiast dokumentu.** Poprzednia wersja `AuditReportDocumentView`
   renderowała **8-sekcyjny deck** z `/presentation`, podczas gdy przycisk
   „Zatwierdź" w tym samym widoku zatwierdzał **13-sekcyjny, zaplombowany
   payload**. Zatwierdzający czytał **inny dokument, niż podpisywał**
   (`DEC-125`, opis: `AuditReportDocumentView.tsx:5-13`). **Twój eksport
   MUSI eksportować `report.payload`, nie `/presentation`.** Eksport decku pod
   nazwą raportu byłby powtórzeniem tego samego błędu metody.
3. **Surowy enum na twarzy.** Partia A pokazała użytkownikowi `VERIFIED`
   i `1 możliwych tematów`. Naprawiono **u źródła** (słownik PL + helper form
   liczebnika). **Twoje placeholdery i etykiety w dokumencie przechodzą ten sam
   test: czy klient to zrozumie na papierze?**
4. **Własna tabela w powłoce.** `InitiativesLightShell`/`InterviewLightShell`
   zrobiły bespoke grid zamiast `StandardTable` i poszły hurtem na żywo —
   to złamało zamrożony kanon (`CLAUDE.md` reguła 9). **Zero własnych tabel.**
5. **Fantomowa flaga.** `ENABLE_TERESA_NOTE_CREATE` = 0 linii implementacji.
   **Twoja flaga ma mieć konsumenta w tym samym commicie albo w następnym —
   i wpis w raporcie, który to wskazuje.**
6. **Zielony test na wstrzykniętych zależnościach.** Dzień 18: 8/8 PASS,
   warstwa martwa. **Montujesz `initializeRoutes`.**
7. **Pomiar na cudzej bazie.** Dzień 17. **`Z25`/`Z26` w każdej linii.**
8. **Reformat cudzego pliku jako „diff dyżuru".** `AuditReportDocumentView.tsx`
   ma 1359 linii i **łatwo zrobić z niego 1300-liniowy diff jednym `prettier`**.
   Reguła 3× z `§0.3`.

### 1.9. ★ KOLIZJE Z DYŻURAMI W TOKU — sprawdzone, zakres rozłączny

Sześć dyżurów pracuje równolegle. **Kolizja = STOP, nie „scalę się później".**

#### ★★ DYŻUR 40 (Tools) — TEN SAM SILNIK DOKUMENTÓW. Czytaj to dwa razy.

Dyżur 40 buduje **eksport wyniku narzędzia** przez **ten sam
`documentDocxRenderer`**. To jest **jedyna realna kolizja tego dyżuru** i ma
twardy rozdział:

|                         | Dyżur 40 (Tools)             | Dyżur 41 (Audyty) — Ty                                               |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------- |
| **Co mapuje**           | wynik narzędzia              | **payload audytu — 13 sekcji `AuditReportDocument`**                 |
| **Nowy plik adaptera**  | własny, w obszarze Tools     | **`server/src/services/audits/auditReportDocumentSchemaService.ts`** |
| **Nowa trasa**          | własna, w obszarze Tools     | **`GET /api/audits/reports/:id/export.docx`**                        |
| **Profil w rendererze** | własny identyfikator profilu | **własny identyfikator profilu**                                     |

**Zasady rozłączności — twarde:**

1. **Każdy z was pisze WYŁĄCZNIE we własnym pliku adaptera i we własnej
   trasie.** Twój adapter mieszka w `server/src/services/audits/`. Nie tworzysz
   niczego w `server/src/services/documentStudio/` ani w `server/src/services/tools*`.
2. **★★ PLIKI WSPÓLNE RENDERERA SĄ DLA CIEBIE TYLKO DO ODCZYTU.**
   `documentDocxRenderer.ts`, `documentDocxStyles.ts`, `documentDocxStructure.ts`,
   `documentStudioTypes.ts` — **nie zmieniasz w nich ani jednego znaku**.
3. **Jeżeli Twoje mapowanie WYMAGA zmiany w którymkolwiek z tych plików —
   to jest STOP** (`§D.7` pkt 9), z opisem: co dokładnie brakuje, w którym
   pliku, w ilu linijkach. **Nadzorca koordynuje taką zmianę między dyżurami
   40 i 41** — Ty jej nie robisz, nawet „addytywnie za bramką profilu".
   Powód jest prosty: dwa dyżury dokładające gałęzie do tego samego 1964-liniowego
   renderera **na dwóch gałęziach naraz** dają konflikt scalenia w pliku,
   którego nikt nie umie bezpiecznie rozwiązać.
4. **Bramka profilu — jeśli w ogóle jej potrzebujesz — jest ADDYTYWNA
   i po Twojej stronie.** Wzorzec zastany: profil włącza się **istniejącym,
   opcjonalnym slotem** `schema.formattingSchema.colorTemplateId`
   (`documentDocxStyles.ts:125-127`). **Ustawiasz ten slot w SWOIM adapterze.**
   Jeśli wartość, której chcesz użyć, nie ma odpowiednika w rendererze —
   **nie dodajesz go tam**; używasz zastanego zachowania domyślnego
   i **wpisujesz do „Znalezisk", że profil audytowy jest do dorobienia**.
5. **Testy silnika (`server/src/services/documentStudio/__tests__`,
   `tests/unit/deliverables/documentDocxGolden.test.ts`) MUSZĄ zostać zielone**
   i są w Twoim zakresie pomiaru (`§0.4a`). Czerwień tam = dowód, że ruszyłeś
   cudzy tor.

#### Pozostałe pięć

| Dyżur                  | Obszar                                        | Rozdział                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **39** (poświadczenia) | poświadczenia / uprawnienia / model dostępu   | **Nie dotykasz `permissions.ts`, `auditsStrictMembership.middleware.ts`, `effectiveAccessService.ts` ani żadnej bramki** (`Z17`). Używasz **istniejących** zdolności `output.finalize` / `report.draft`. Potrzeba nowej nazwy zdolności = **STOP**, temat dyżuru 39                                            |
| **33**                 | nośniki decyzji właściciela / progi           | Nie zaszywasz żadnej wartości progowej ani taksonomii. W tym dyżurze nie ma progów — jeśli wyjdzie Ci, że potrzebujesz „domyślnego rodzaju raportu" albo „domyślnego odbiorcy", **to jest decyzja właściciela, nie stała w kodzie** → uczciwy wybór w UI, nigdy `?? 'audit_report'` ukryte przed użytkownikiem |
| **30** (Finanse)       | moduł Finanse, `Gateway.ts`, `demoWriteGuard` | Rozłączny. **Nie dotykasz `Gateway.ts`** (`Z17`)                                                                                                                                                                                                                                                               |
| **37**                 | osobny moduł                                  | Rozłączny. Jeśli komenda bazowa pokaże Ci pliki spoza `src/components/Audit/**`, `src/utils/audits*`, `server/src/services/audits/**`, `server/src/routes/audits/**` — **przerywasz i sprawdzasz, skąd się wzięły**                                                                                            |
| **38**                 | osobny moduł                                  | jw.                                                                                                                                                                                                                                                                                                            |

**Procedura przy podejrzeniu kolizji:** przerywasz pozycję, wpisujesz do
raportu `KOLIZJA — <dyżur> — <plik:linia> — <co dokładnie się nakłada>`,
i **nie commitujesz zmiany w spornym pliku**. Rozstrzyga nadzorca.

---

## BLOK 0 — START (wykonaj po kolei, ZANIM napiszesz pierwszą linię kodu)

1. **Marker** — `§0.1` pkt 2-3. Wynik dosłownie do raportu.
2. **Warunki wstępne** — wszystkie komendy z `§0.1` pkt 4 (a-j). Wynik do
   tabeli w raporcie, kolumny: `komenda | oczekiwane | otrzymane | zgodne?`.
3. **Worktree i gałąź** — `§0.1` pkt 5. Oświadczenie o `Z5`/`DEC-86` do raportu.
4. **★ Kontener PG — PRZED jakimkolwiek pomiarem** (`Z20`):

   ```bash
   docker run -d --name cx-day41-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day41 \
     -p 5693:5432 pgvector/pgvector:pg16
   # czekasz na gotowość:
   until docker exec cx-day41-pg pg_isready -U postgres; do sleep 1; done
   ```

   **Jeśli port `5693` jest zajęty** — bierzesz pierwszy wolny powyżej,
   spoza listy zakazanych z `Z7`, i **wpisujesz go do raportu oraz podmieniasz
   we WSZYSTKICH komendach niżej**.

5. **Pełne migracje na świeżej bazie** (strict, `migrate.postgres.ts`):

   ```bash
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5693/cx_day41" DB_TYPE=postgres NODE_ENV=test \
     npx tsx server/src/database/migrate.postgres.ts
   ```

   **Liczba zastosowanych migracji i wynik idą do raportu.** Migracje muszą
   przejść **w całości**; częściowy przebieg = STOP.

6. **Dowód celu połączenia** (`Z25`) — do raportu dosłownie:

   ```bash
   psql "postgresql://postgres:cx@127.0.0.1:5693/cx_day41" -c \
     "SELECT current_database(), inet_server_port(), (SELECT count(*) FROM audit_reports) AS reports, (SELECT count(*) FROM audit_outputs) AS outputs;"
   ```

   Oczekiwane: `cx_day41 | 5432 | 0 | 0` (port wewnątrz kontenera to `5432` —
   to poprawne; Twoje mapowanie zewnętrzne to `5693`).

7. **★ Ustalenie `REAL_PG`** (`Z26`) — uruchamiasz **jeden** istniejący pakiet
   realdb i sprawdzasz, że **NIE jest `SKIPPED`**:

   ```bash
   DATABASE_URL="postgresql://postgres:cx@127.0.0.1:5693/cx_day41" DB_TYPE=postgres NODE_ENV=test \
     RUN_DB_TESTS=1 MOCK_DB=false ENABLE_V8_GLOBAL=true POSTGRES_SKIP_INIT_IN_TEST=1 AI_PROVIDER_MODE=mock \
     npx vitest run --config server/vitest.config.ts \
     server/src/routes/audits/__tests__/verticalSlice.http.test.ts
   ```

   **Wynik `SKIPPED` = `REAL_PG` nie działa = STOP.** Nie idziesz dalej.

8. **★★ BRAMKA WEJŚCIOWA — SZEŚĆ PODPUNKTÓW.** Wszystkie muszą wyjść zgodnie
   z oczekiwaniem. **Rozbieżność w którymkolwiek = STOP i koniec dyżuru:**

   | #   | Komenda                                                                                                 | Oczekiwane                                                                  |
   | --- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
   | 8a  | `grep -rn "outputs/finalize\|finalizeOutput" src/`                                                      | **zero trafień**                                                            |
   | 8b  | `grep -n "generateReport" src/components/Audit/method/auditsMethodApi.ts`                               | **zero trafień**                                                            |
   | 8c  | `grep -rn "finalizeOutput" server/src --include='*.ts' \| grep -v __tests__`                            | **3 trafienia**, w tym **dokładnie jeden wołający**: `outputs.routes.ts:72` |
   | 8d  | test z pkt 7                                                                                            | **PASS, nie SKIPPED**                                                       |
   | 8e  | `grep -n "Eksport PDF" src/components/Audit/method/AuditReportDocumentView.tsx`                         | `:1283`                                                                     |
   | 8f  | `grep -n "renderDocumentSchemaToDocxBuffer" server/src/services/documentStudio/documentDocxRenderer.ts` | `:1952`                                                                     |

   **Sens bramki:** 8a-8c dowodzą, że **problem, dla którego istnieje ten
   dyżur, nadal istnieje**. Jeśli ktoś już go naprawił — nie dokładasz drugiej
   ścieżki, tylko kończysz dyżur z opisem stanu zastanego.

9. **★ INWENTARZ KONSUMENTÓW** — wypisujesz, kto dziś woła każdą z ośmiu tras
   raportów i Outputów, i wklejasz tabelę do raportu:

   ```bash
   for r in "audits/outputs" "audits/outputs/finalize" "audits/reports" "reports/:id/approve" \
            "reports/:id/publish" "reports/:id/presentation" "link-material" "audits/criteria"; do
     echo "=== $r ==="; grep -rn "$r" src/ | grep -v __tests__ | head -3
   done
   ```

10. **Baseline testów (a)** — `§0.4a` pkt 3(a), **na markerze, przed pierwszym
    commitem**. Liczby do raportu.
11. **Sprzątanie — zaplanuj już teraz.** Na koniec dyżuru **obowiązkowo**:

    ```bash
    docker rm -fv cx-day41-pg
    ```

    **NIGDY `docker volume prune`.** Potwierdzenie wykonania idzie do raportu.

---

## §D.1 — TEST-STRAŻNIK: łańcuch kompletny na serwerze, nieosiągalny z klienta

**Commit test-only. Zero kodu produkcyjnego w tym commicie.**

### Po co

Żeby **dowód luki był w repo, a nie w tej instrukcji**. Za trzy miesiące ktoś
zapyta „czy to naprawdę było zepsute" — ma dostać test, nie dokument.

### Co budujesz

Jeden plik: `server/src/routes/audits/__tests__/day41.reportChainReachability.pg.test.ts`.

1. **Część serwerowa (realny HTTP, realny PG, `initializeRoutes`).**
   Wzorzec 1:1 z `verticalSlice.http.test.ts:1-124`. Test:
   - tworzy organizację, aktorów i program z pakietu (jak wzorzec);
   - doprowadza program do stanu, w którym `finalizeOutput` przechodzi
     (żadne ustalenie w `draft`/`in_review` — `outputService.ts:427`);
   - `POST /api/audits/outputs/finalize` → `201`, czyta wiersz
     **niezależnym połączeniem** i sprawdza `content_hash IS NOT NULL`
     oraz `version = 1`;
   - `POST /api/audits/reports` z `reportKind: 'audit_report'` → `201`;
   - **sprawdza, że `payload.sections` ma DOKŁADNIE 13 elementów**
     i że ich `id` to lista z `§1.2` pkt 1, **w tej kolejności**;
   - sprawdza, że `content_hash` raportu **różni się** od hasha Outputu
     (bo plombuje inny byt — `reportService.ts:165`).
2. **Część „cykl życia nie tworzy Outputu"** — dowód punktu `§1.2` pkt 9:
   nowy program, `POST /programs/:id/transition` do stanu `closure`,
   następnie **niezależny `SELECT count(*) FROM audit_outputs WHERE program_id=…`
   → `0`**. To jest dowód, że stan pusty w `AuditOutputsTab.tsx:213` kłamie.
3. **Część klientowa (strażnik regresji, NIE dowód — `Z22`).**
   Jeden `it` w `src/components/Audit/method/__tests__/` czytający źródło
   `auditsMethodApi.ts` i asertujący, że **po tym dyżurze** eksportuje
   `finalizeOutput` i `generateReport`. **Uwaga:** ten test jest **czerwony
   w commicie `D.1`** i zielenieje w `D.2` — to jest zamierzone i **wpisujesz to
   do raportu**. Jeżeli Twoja konfiguracja nie pozwala zacommitować czerwonego
   testu (hook), **odwracasz kolejność: `D.2` przed `D.1`** i odnotowujesz to
   w „Korektach wobec instrukcji".

### Definicja ukończenia `D.1`

- [ ] plik testowy istnieje, montuje `initializeRoutes`, biegnie na realnym PG
      (port `5693`), **nie jest `SKIPPED`**;
- [ ] asercja „13 sekcji, te ID, ta kolejność" — obecna i zielona;
- [ ] asercja „przejście cyklu życia nie tworzy Outputu" — obecna i zielona;
- [ ] test sprząta po sobie **w zasięgu swojej organizacji, PRZED jej
      usunięciem**;
- [ ] zero kodu produkcyjnego w commicie (`git show --stat` w raporcie);
- [ ] wpis w raporcie: SHA, liczba testów, czas przebiegu.

---

## §D.2 — DWIE KOMENDY W WARSTWIE API FRONTU

**Zero UI w tym commicie.** Dokładasz **wyłącznie funkcje** do
`src/components/Audit/method/auditsMethodApi.ts`.

### Co budujesz

Dwie funkcje, **dokładnie w konwencji pliku**, w sekcji
`// Outputs / Reports / Proposals` (`:562`), obok `listOutputs` i `listReports`:

1. **`finalizeOutput(programId: string, title?: string): Promise<AuditOutputSummary>`**
   - `Api.post('/audits/outputs/finalize', { programId, title })`;
   - `unwrapEnvelope(res)` (`:375`) — **obowiązkowo**, to jest zastany, ścisły
     kontrakt koperty; niepoprawny kształt `200` jest **błędem kontraktu**,
     nie pustym wynikiem;
   - readback kształtu: brak `id` w odpowiedzi → **rzucasz**, nie zwracasz
     `null`. Uzasadnienie: `finalizeOutput` to **komenda tworząca**; „udało
     się, ale nie wiem co powstało" jest stanem, którego UI nie umie obsłużyć
     uczciwie.
2. **`generateReport(input): Promise<AuditReportSummary>`** gdzie `input` to:

   ```ts
   {
     programId: string;
     outputId: string;
     reportKind: 'audit_report' | 'remediation_progress';
     title?: string;
     asOfDate?: string;   // tylko dla remediation_progress
   }
   ```

   - `Api.post('/audits/reports', input)`;
   - `unwrapEnvelope` + readback `id` jak wyżej;
   - **★ NIE wysyłasz `language`/`audience`/`confidentiality`/`templateKey`.**
     Backend je przyjmuje (`reports.routes.ts:73-76`), ale **nie masz od kogo
     wziąć wartości** — a wysłanie zaszytej stałej byłoby cichym ustanowieniem
     produktu (`§1.9`, dyżur 33). Zostają `null`, tak jak dziś.

### Czego NIE robisz

- **Nie dodajesz `supersedeReport`** — nie ma trasy HTTP (znalezisko).
- **Nie dodajesz `linkMaterial`** — trasa jest, ale nie ma czego linkować
  (`§1.4`).
- **Nie zmieniasz żadnej istniejącej funkcji w tym pliku.** `git diff` tego
  commita ma pokazywać **wyłącznie dodane linie** (plus ewentualnie import).
  Sprawdzasz to sam: `git show --stat` i `git show | grep '^-' | grep -v '^---'`
  → **pusto**.

### Testy (minimum 6, ponad DoD)

W `src/components/Audit/method/__tests__/auditsMethodApi.contract.test.ts`
(**plik istnieje** — dokładasz `describe`, nie tworzysz drugiego pliku):

1. `finalizeOutput` wysyła `POST` pod właściwy URL z właściwym body;
2. `finalizeOutput` przy poprawnej kopercie zwraca obiekt z `id`;
3. `finalizeOutput` przy kopercie bez `success:true` **rzuca**
   `AUDITS_API_CONTRACT_ERROR`;
4. `generateReport` wysyła komplet wymaganych pól i **nie wysyła** pól,
   których nie ma w `input` (asercja negatywna na `language`);
5. `generateReport` dla `remediation_progress` przekazuje `asOfDate`;
6. `generateReport` przy odpowiedzi bez `id` **rzuca**.

### Definicja ukończenia `D.2`

- [ ] dwie funkcje istnieją, w konwencji pliku, z `unwrapEnvelope`;
- [ ] diff **wyłącznie addytywny** (dowód komendą w raporcie);
- [ ] 6 testów kontraktowych zielonych;
- [ ] strażnik z `D.1` część 3 **zielenieje** — wpisujesz to do raportu;
- [ ] `npx esbuild src/components/Audit/method/auditsMethodApi.ts --loader:.ts=ts --outfile=/dev/null` czysty;
- [ ] **zero UI** w commicie.

---

## §D.3 — FLAGA `ff_auditsReportChain`, DOMYŚLNIE `OFF`

### Co budujesz

Nowy plik `src/utils/auditsReportChainFlag.ts`, **wzorowany 1:1** na
`src/utils/auditsFindingsAndReportViewFlag.ts` — **przeczytaj go w całości
przed pisaniem**, ma 100 linii i jest wzorcem zaakceptowanym przez odbiór.

Kontrakt:

| Element        | Wartość                                                                               |
| -------------- | ------------------------------------------------------------------------------------- |
| `localStorage` | `ff.audits_report_chain`                                                              |
| query          | `ff_auditsReportChain`                                                                |
| env            | `VITE_AUDITS_REPORT_CHAIN`                                                            |
| kolejność      | query > localStorage > env > **default `false`**                                      |
| fail-closed    | `try/catch` wokół całości → **`false`** przy błędzie odczytu                          |
| cache          | wynik cache'owany na poziomie modułu + `resetAuditsReportChainFlagCache()` dla testów |
| eksport kluczy | `AUDITS_REPORT_CHAIN_FLAG_KEYS`                                                       |

**★ Komentarz nagłówkowy pliku MA MÓWIĆ PRAWDĘ.** Wzorzec zawiera zdanie
o tym, kiedy i dlaczego flagę przestawiono na `ON`. **U Ciebie flaga jest
`OFF` i komentarz ma to stwierdzać wprost**, wraz z warunkiem włączenia:
_„default OFF do czasu akceptu właściciela na zrzutach (CLAUDE.md reguła 7).
Flip wykonuje nadzorca, nie ten dyżur."_ Partia B poprzedniego dyżuru musiała
korygować **trzy błędne komentarze „default OFF"** przy flagach, które były
`ON` (`DEC-2026-08-26-113`). **Nie dokładasz czwartego.**

### Testy (minimum 5)

`src/utils/__tests__/auditsReportChainFlag.test.ts`, wzorzec:
`auditsFindingsAndReportViewFlag.test.ts`.

1. domyślnie `false` (brak query, brak `localStorage`, brak env);
2. query `=1` włącza; query `=0` wyłącza **mimo `localStorage=1`**;
3. `localStorage` włącza przy braku query;
4. rzucający `window.localStorage` → `false` (fail-closed), **nie wyjątek**;
5. `resetAuditsReportChainFlagCache()` faktycznie czyści cache.

### Definicja ukończenia `D.3`

- [ ] plik istnieje, kontrakt jak w tabeli, **default `false`**;
- [ ] komentarz nagłówkowy mówi prawdę o stanie flagi i o warunku flipa;
- [ ] 5 testów zielonych;
- [ ] **konsument flagi wskazany w raporcie** (`D.4`) — flaga bez konsumenta
      jest fantomem (`§1.8` pkt 5);
- [ ] `grep -rn "VITE_AUDITS_REPORT_CHAIN" .env* docker-compose*` → **pusto**
      (nie ustawiasz jej nigdzie).

---

## §D.4 — KONTROLKA „SFINALIZUJ OUTPUT" W PODGLĄDZIE SESJI

**Za flagą `ff_auditsReportChain`, domyślnie `OFF`.**

### Gdzie

`src/components/Audit/method/tabs/AuditProcessesTab.tsx`, w **panelu podglądu**
sesji — dokładnie tam, gdzie już żyją przejścia cyklu życia (`:389-420`).
**Nie w kebabie wiersza**, i to jest świadome: kebab per-wiersz nie ma dostępu
do stanu, którego ta akcja potrzebuje (nagłówek pliku, `:12-14`, wyjaśnia,
dlaczego przejścia lifecycle są w podglądzie, a nie w kebabie —
**trzymasz tę samą regułę**).

### Zachowanie

1. Przycisk **„Sfinalizuj Output"**, widoczny **wyłącznie przy fladze `ON`**.
2. Kliknięcie → `finalizeOutput(programId)` z `D.2`.
3. **Sukces** → panel pokazuje potwierdzenie z **numerem wersji Outputu**
   i **skróconym hashem** (pierwsze 12 znaków, `font-mono`), plus wywołanie
   `onProgramChanged()` (prop już istnieje, `:56`), żeby Hub odświeżył listy.
   **★ Bez odświeżenia to atrapa** (`Z23`, ramka pkt 1).
4. **Błąd `409` z `outputService`** (ustalenia w `draft`/`in_review`) →
   **pokazujesz komunikat z backendu dosłownie**. On już zawiera liczbę
   blokujących ustaleń i przykładowe ID (`outputService.ts:432-435`).
   **Nie piszesz własnego, uboższego tekstu.**
5. **Błąd `403`** (brak zdolności `output.finalize`) → komunikat mówiący
   **którego uprawnienia brakuje**, w PL i EN.
6. **Podwójne kliknięcie** — przycisk `disabled` na czas żądania (wzorzec
   `transitioning` już w pliku, `:143-153`). Bez tego użytkownik wytworzy dwie
   wersje Outputu.

### Uczciwość kontrolki (`Z16`, `Z23`)

- Przycisk **nigdy nie jest ukrywany z powodu stanu danych** — jest `disabled`
  **z powodem** (wzorzec `AuditReportsTab.tsx:208-212`).
- **Wyjątek:** przy fladze `OFF` kontrolki **nie ma wcale**. To nie jest
  ukrywanie stanu — to jest niewdrożona funkcja za flagą.

### Testy (minimum 5)

`src/components/Audit/method/__tests__/AuditProcessesTab.finalizeOutput.test.tsx`:

1. flaga `OFF` → przycisku **nie ma w DOM** (nie „jest ukryty");
2. flaga `ON` → przycisk jest, klik woła `finalizeOutput` z właściwym `programId`;
3. sukces → widoczna wersja + hash, `onProgramChanged` wywołane **raz**;
4. `409` → widoczny **dosłowny** komunikat z backendu;
5. w trakcie żądania przycisk `disabled` (dowód: dwa kliknięcia = jedno wywołanie).

### Definicja ukończenia `D.4`

- [ ] 5 testów zielonych;
- [ ] **polish-pass `§0.4b`, osiem punktów odhaczonych w raporcie**;
- [ ] **cztery zrzuty** (`OFF`/`ON` × light/dark) w
      `modules/12_AUDITS/evidence/day41/`, wymienione po nazwach;
- [ ] `scripts/check-list-canon.sh` przechodzi;
- [ ] parytet i18n PL+EN w tym samym commicie;
- [ ] dowód osiągalności: klik → `POST` → wiersz w `audit_outputs` → widoczna
      wersja i hash w panelu.

---

## §D.5 — KONTROLKA „WYSTAW RAPORT" NA LIŚCIE OUTPUTÓW

**Za flagą `ff_auditsReportChain`, domyślnie `OFF`.**

### Gdzie

`src/components/Audit/method/tabs/AuditOutputsTab.tsx` — **w kebabie wiersza
ORAZ w panelu podglądu**. Kebab tego pliku jest dziś ubogi:
`{ universalHandlers: { preview } }` (`:127-130`). Dokładasz blok
`statusTransitions` wg kontraktu `StandardRowMenu`, wzorzec dosłowny:
`AuditReportsTab.tsx:196-242`.

### Zachowanie

1. Pozycja kebaba **„Wystaw raport audytu"** → `generateReport({ programId,
outputId, reportKind: 'audit_report' })`.
2. Pozycja **„Wystaw raport realizacji"** → `reportKind: 'remediation_progress'`.
   **★ Ta pozycja wymaga daty `asOfDate`.** Backend ma fallback na „dziś"
   (`reportService.ts:150`), ale **fallback ukryty przed użytkownikiem to
   ustanowienie produktu po cichu**. Dlatego: ta pozycja **otwiera mały modal
   z jednym polem daty**, domyślnie pustym, z etykietą mówiącą, czego dotyczy
   („Snapshot postępu naprawy na dzień"). Pusta data = wysyłasz bez `asOfDate`
   i **modal mówi wprost, że wtedy zostanie użyta data dzisiejsza**.
   Modal: `src/components/ui/primitives/Modal` (wzorzec: `NewAuditModal.tsx`).
3. **Output zastąpiony** (`supersededBy != null`) → obie pozycje `disabled`
   **z powodem**: „Output został zastąpiony nowszą wersją — raport wystawia się
   z aktualnego Outputu". (Backend i tak odmówi publikacji takiego raportu —
   `reportService.ts:287-294` — więc blokada na wejściu jest uczciwa, nie
   nadgorliwa.)
4. **Sukces** → potwierdzenie z **numerem wersji raportu** i **rodzajem**,
   plus **odświeżenie zakładki Raporty**. Jeśli wymaga to nowego propa
   z `AuditsMethodHub.tsx` — dokładasz go, **minimalnie**, i odnotowujesz.
5. **Błąd `403`** (brak `report.draft`) i **`409`** (równoległe generowanie —
   `reportService.ts:198`) → komunikaty dosłowne z backendu.
6. **Podwójne kliknięcie** — `disabled` na czas żądania, jak w `D.4`.

### ★ Czego NIE robisz

- **Nie nawigujesz automatycznie** do nowo wystawionego raportu. Kuszące, ale:
  raport jest w statusie `draft`, a ekran raportu ma przyciski Zatwierdź/Opublikuj
  — automatyczny skok tam **popycha użytkownika do zatwierdzenia dokumentu,
  którego jeszcze nie przeczytał**. To jest dokładnie ten błąd metody, który
  `DEC-125` nazwał. Potwierdzenie z linkiem „Otwórz raport" — **tak**.
  Automatyczny skok — **nie**.

### Testy (minimum 7)

`src/components/Audit/method/__tests__/AuditOutputsTab.generateReport.test.tsx`:

1. flaga `OFF` → kebab ma **tylko** `preview`, jak dziś;
2. flaga `ON` → kebab ma dwie nowe pozycje;
3. „Raport audytu" → `generateReport` z `reportKind: 'audit_report'`;
4. „Raport realizacji" → otwiera modal; zatwierdzenie z datą → `asOfDate` w body;
5. modal z pustą datą → body **bez** `asOfDate` **i** widoczna informacja
   o użyciu daty dzisiejszej;
6. Output zastąpiony → obie pozycje `disabled` **z widocznym powodem**;
7. sukces → potwierdzenie z wersją, **brak automatycznej nawigacji**
   (asercja: `navigate` nie wywołane).

### Definicja ukończenia `D.5`

- [ ] 7 testów zielonych;
- [ ] kebab zgodny z kontraktem `StandardRowMenu` (`context → manage → danger`);
- [ ] **polish-pass `§0.4b`** + **cztery zrzuty** (w tym zrzut otwartego modalu);
- [ ] `scripts/check-list-canon.sh` przechodzi; **zero własnych tabel**;
- [ ] parytet i18n PL+EN;
- [ ] dowód osiągalności: klik → `POST /audits/reports` → wiersz w
      `audit_reports` z `version` i `content_hash` → raport **widoczny na
      zakładce Raporty bez przeładowania strony**.

---

## §D.6 — KONIEC KŁAMSTWA W STANACH PUSTYCH

### Problem

`AuditOutputsTab.tsx:213` mówi użytkownikowi, że Output powstaje
**automatycznie**. Nie powstaje (`§1.2` pkt 9, dowód w `D.1` część 2).
`AuditReportsTab.tsx:305` mówi: „Sfinalizuj program, żeby móc wystawić pierwszy
raport" — czyli kieruje do czynności, **której w interfejsie nie ma**.

### Co robisz — i to jest jedyne miejsce w tym dyżurze z podwójnym zachowaniem

1. **Zdanie nieprawdziwe znika BEZWARUNKOWO**, niezależnie od flagi.
   Kłamstwo nie jest funkcją i nie chowa się za flagą (`§1.6`).
2. **Tekst przy fladze `OFF`** ma opisywać **stan faktyczny bez flagi**:
   Output powstaje przez **finalizację programu audytowego**, która jest
   **osobną, jawną czynnością**; w tej wersji interfejsu **nie jest ona
   dostępna z ekranu**. Formułujesz to jako uczciwy opis, nie jako przeprosiny
   i nie jako obietnicę.
3. **Tekst przy fladze `ON`** dodatkowo **wskazuje, gdzie kliknąć**
   („Otwórz sesję na zakładce Sesje i użyj «Sfinalizuj Output»").
4. To samo w `AuditReportsTab.tsx` — stan pusty przy `ON` wskazuje zakładkę
   Outputy i akcję „Wystaw raport"; przy `OFF` mówi prawdę o braku ścieżki.
5. **★ Test rozróżnienia jest obowiązkowy** — dwa `it`: przy `OFF` tekst
   **nie zawiera** instrukcji klikania; przy `ON` **zawiera**. Bez tego testu
   pozycja nie dostaje `ZROBIONE_WG_DoD`.

### ★ Obowiązkowy wpis „przed/po"

`AuditOutputsTab.test.tsx` i/lub `AuditReportsTab.test.tsx` **mogą asertować
dzisiejszy tekst**. Sprawdzasz to **przed** zmianą:

```bash
grep -rn "automatycznie\|Sfinalizuj program" src/components/Audit/method/__tests__/
```

Jeżeli tak — **nie kasujesz testu**, przepisujesz go na nowy tekst i wpisujesz
do raportu **pełną treść asercji przed i po** (`§0.4a` pkt 7).

### Definicja ukończenia `D.6`

- [ ] w `src/components/Audit/` **zero wystąpień** słowa „automatycznie"
      w kontekście powstawania Outputu (dowód `grep`em w raporcie);
- [ ] dwa teksty per ekran (`OFF`/`ON`), rozróżnienie pokryte testem;
- [ ] wpis „przed/po" dla każdej dotkniętej asercji;
- [ ] parytet i18n PL+EN dla **wszystkich czterech** wariantów tekstu;
- [ ] **cztery zrzuty** (`OFF`/`ON` × light/dark) stanów pustych.

---

## §D.7 — KONTRAKT SCHEMATU: PAYLOAD AUDYTU → `DocumentSchema`

**To jest najtrudniejsza pozycja dyżuru. Czytasz ją w całości, zanim napiszesz
pierwszą linię.**

### Zasada nadrzędna

**Nie budujesz silnika. Budujesz TŁUMACZA.** Wejście: `AuditReportDocument`
(13 sekcji, pięć rodzajów treści). Wyjście: `DocumentSchema`
(`documentStudioTypes.ts:706`). Silnik już umie z tego zrobić `.docx`
(`documentDocxRenderer.ts:1952`).

### Wzorzec, który kopiujesz

`server/src/services/assessment/assessmentDrdReportSchemaService.ts` (451 linii).
**Przeczytaj go w całości.** Kluczowe wzorce do przeniesienia:

- `paragraph(blockId, text, docxStyleId, pageBreakBefore)` (`:79`) i
  `heading(blockId, text, level)` (`:90`) — **lokalne helpery budujące
  `DocumentBlock`**, nie wywołania renderera;
- `placeholder(minWords, maxWords)` (`:52`) — **jawny, nazwany placeholder**
  zamiast pustego stringa;
- `DRD_REPORT_FIXED_TEXT` (`:17`) — **zamrożone teksty stałe w jednym
  `Object.freeze`**, nie rozsypane po funkcjach;
- `Object.freeze` na eksporcie serwisu (`:449`).

### Plik

`server/src/services/audits/auditReportDocumentSchemaService.ts` — **NOWY**.

Eksport główny:

```ts
export function buildAuditReportDocumentSchema(
  report: {
    id: string;
    title: string;
    version: number;
    reportKind: string;
    language: string | null;
    audience: string | null;
    confidentiality: string | null;
    contentHash: string | null;
    generatedAt: string | null;
  },
  document: AuditReportDocument, // import TYPU z reportRenderer.js
  context: { programName: string | null; organizationName: string | null }
): DocumentSchema;
```

**★ `AuditReportDocument` importujesz jako TYP z `reportRenderer.js`**
(`import type { … } from '../audits/reportRenderer.js'`). To jest import typu,
nie zmiana pliku — `Z11` na to pozwala i mówi o tym wprost.

### Mapowanie — pięć rodzajów treści na bloki silnika

Silnik zna te typy bloków (`documentStudioTypes.ts:77-98`): `heading`,
`paragraph`, `bullet_list`, `numbered_list`, `table`, `callout`, `quote`,
`kpi_strip`, `risk_table`, `image`, `chart`, `footnote`, `citation`.

| Rodzaj sekcji audytu | Blok silnika                                                                      | Uwaga                                                                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`               | `heading` (poziom 2) + `paragraph`                                                | tytuł sekcji zawsze jako `heading`                                                                                                                                                                              |
| `list`               | `heading` + `bullet_list`                                                         | pusta lista → **placeholder, nie pusty blok**                                                                                                                                                                   |
| `table`              | `heading` + `table`                                                               | kolumny wyprowadzasz **deterministycznie z kluczy pierwszego elementu**, w stałej, jawnie zadeklarowanej kolejności per sekcja — **nigdy z `Object.keys` bez sortowania**, bo to daje niedeterministyczny wynik |
| `keyValue`           | `heading` + `table` dwukolumnowa (Właściwość / Wartość)                           | konwencja zgodna z `ArtifactPropertiesTable` na froncie                                                                                                                                                         |
| `group`              | `heading` (poziom 2) + per grupa: `heading` (poziom 3) + zawartość wg reguł wyżej | zagnieżdżenie **maksymalnie jednopoziomowe**                                                                                                                                                                    |

### ★ Zasady twarde tego mapowania

1. **Determinizm.** Ta sama para (`report`, `document`) → **bajt w bajt ten sam
   `DocumentSchema`**. Zero `Date.now()`, zero `Math.random()`, zero `Object.keys`
   bez jawnego porządku. `createdAt`/`updatedAt` w schemacie **bierzesz
   z `report.generatedAt`**, nigdy z zegara. **Test determinizmu jest
   obowiązkowy** (dwa wywołania → `toEqual`).
2. **Zero LLM, zero zmyślania** (`Z15`). Tłumacz przenosi tekst, który już
   jest w payloadzie. **Nie skraca, nie streszcza, nie „poprawia stylu".**
3. **Brak danych = uczciwy placeholder z nazwą pola.** Wzór:
   `„[Brak danych: <nazwa sekcji>]"` — po polsku, **jednoznacznie rozpoznawalny
   jako brak**, nigdy zdanie udające treść (`Z23`, ramka pkt 3). Placeholdery
   trzymasz w jednym `Object.freeze` na górze pliku.
4. **Zero surowych ID w tekście dokumentu.** Payload niesie `criterionId`,
   `ownerUserId`, `findingId`. **Ekran już to rozwiązuje** — nagłówek
   `AuditReportDocumentView.tsx:69-77` opisuje jak. **Ty tego nie powtarzasz
   w serwisie** (wymagałoby zapytań do bazy, a serwis ma być czysty).
   Zamiast tego: **`context` przyjmuje gotowe mapy nazw** albo — jeśli
   wołający ich nie ma — **wypisujesz ID w formacie jawnie technicznym**
   (`«ID: aout_…»`) i **odnotowujesz to jako znalezisko do dalszej pracy**.
   Cichy wyciek `usr_7f3a…` na papier do klienta jest **niedopuszczalny**.
5. **Metadane dokumentu.** Tytuł = `report.title`. `language` = `report.language
?? 'pl'` (i to jest **jedyny** dozwolony fallback w tym pliku, bo `DocumentSchema`
   wymaga `'pl' | 'en'`; odnotowujesz go w raporcie). `confidentiality` —
   mapujesz z `report.confidentiality`, a przy `null` używasz **najostrożniejszej**
   wartości dostępnej w typie, nie najluźniejszej.
6. **★ Plomba na papierze.** Stopka/metadane dokumentu **muszą nieść
   `content_hash` i numer wersji raportu**. Powód: dokument wychodzi z systemu
   i przestaje być kontrolowany — **hash jest jedynym sposobem, żeby po fakcie
   udowodnić, którą wersję klient dostał**. To jest wymóg, nie ozdoba.
7. **Kolejność sekcji = kolejność z payloadu.** Nie przestawiasz, nie
   grupujesz „ładniej".
8. **★ Profil formatowania.** Ustawiasz `formattingSchema` w SWOIM adapterze.
   Jeżeli chcesz profilu wizualnego innego niż domyślny — patrz `§1.9` pkt 4:
   **nie dodajesz nowej wartości do renderera**; używasz zachowania domyślnego
   i wpisujesz do „Znalezisk", że profil audytowy jest do dorobienia
   w koordynacji z dyżurem 40.
9. **★★ PRZEWIDZIANY, LEGALNY STOP.** Jeżeli którejkolwiek z 13 sekcji **nie
   da się wyrazić** dostępnymi blokami bez zmiany w
   `server/src/services/documentStudio/**` — **STOP**, w formacie:

   ```
   ### STOP — D.7 — niedopasowanie payloadu do silnika
   Sekcja: <id sekcji, np. traceability_matrix>
   Kształt payloadu: <dosłowny fragment typu z reportRenderer.ts:NNN>
   Czego brakuje w silniku: <typ bloku / pole / zachowanie>
   Plik i szacowany rozmiar zmiany: <plik:linia, ile linii>
   Dlaczego nie da się obejść: <2-3 zdania — dlaczego rozbicie na paragraph/table nie wystarcza>
   Stan: pozostałe sekcje zmapowane i zacommitowane w <SHA>, ta jedna nie
   ```

   **Uwaga metodyczna:** zanim postawisz ten STOP, sprawdź **rozbicie**.
   Macierz traceability to tabela — a tabela **jest** typem bloku. Sekcja
   `group` to nagłówek + zawartość — a nagłówek i zawartość **są** typami
   bloków. STOP jest zasadny tylko wtedy, gdy **żadna kompozycja istniejących
   bloków** nie oddaje treści bez jej zniekształcenia. „Byłoby ładniej z nowym
   blokiem" **nie jest** powodem STOP-u.

### Testy (minimum 8)

`server/src/services/audits/__tests__/auditReportDocumentSchemaService.test.ts`:

1. **13 sekcji payloadu → 13 sekcji/grup bloków**, w tej samej kolejności;
2. każdy z pięciu rodzajów treści (`text`/`list`/`table`/`keyValue`/`group`)
   ma pokrycie — po jednym `it` albo jeden `it.each` z pięcioma przypadkami;
3. **determinizm** — dwa wywołania na tym samym wejściu → `toEqual`;
4. **pusta sekcja → placeholder z nazwą sekcji**, nie pusty blok;
5. **hash i wersja obecne** w metadanych schematu;
6. payload `remediation_progress` (6 sekcji) też mapuje się bez wyjątku;
7. **zero zegara** — test podaje `generatedAt` i sprawdza, że wynik go używa;
   dodatkowo `grep` w pliku: `new Date()` bez argumentu i `Date.now()` →
   **zero trafień** (asercja na źródle jest tu **legalna jako strażnik**,
   ale **nie liczy się do minimum** — musi być obok testów behawioralnych);
8. **schemat faktycznie renderuje się do bufora** —
   `renderDocumentSchemaToDocxBuffer(schema)` zwraca bufor **niepusty**
   i większy niż arbitralnie mały próg (np. 1 kB). **To jest ten test, którego
   `esbuild` nie zastąpi** (`§0.3`).

### Definicja ukończenia `D.7`

- [ ] plik istnieje w `server/src/services/audits/`, **zero zmian w `documentStudio/**`**
      (dowód: `git diff --name-only «MARKER_SHA»...HEAD | grep documentStudio` → pusto);
- [ ] 8 testów zielonych, w tym render do niepustego bufora;
- [ ] dowód determinizmu i braku zegara;
- [ ] placeholdery w jednym `Object.freeze`, każdy nazywa brakujące pole;
- [ ] hash + wersja w metadanych dokumentu;
- [ ] wpis w raporcie: **tabela 13 sekcji → bloki**, żeby odbierający widział
      mapowanie bez czytania kodu.

---

## §D.8 — TRASA EKSPORTU PRZEZ ISTNIEJĄCY SILNIK

### Co budujesz

Jedna trasa w `server/src/routes/audits/reports.routes.ts` — **dokładanie,
nie przepisywanie pliku** (118 linii, diff ma być addytywny):

```
GET /api/audits/reports/:id/export.docx
```

Kolejność implementacji, wzorzec dosłowny `method-core.routes.ts:552-590`:

1. `auditActor(req)` + `assertActor(actor)` — **te same helpery co reszta
   pliku** (`context.ts`), nie własne;
2. `reportService.getReport(actor.organizationId, req.params.id)` →
   `404` z `code: 'AUDIT_NOT_FOUND'` gdy brak (**ten sam kształt co `:37`**);
3. **★ Źródłem treści jest `report.payload`, NIGDY `/presentation`**
   (`§1.8` pkt 2 — to jest ten sam błąd metody, który naprawił `DEC-125`);
4. `buildAuditReportDocumentSchema(...)` z `D.7`;
5. `renderDocumentSchemaToDocxBuffer(schema)`;
6. nagłówki **1:1 wg wzorca** (`method-core.routes.ts:576-587`):
   - `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
   - `Content-Disposition: attachment; filename="<ascii>"; filename*=UTF-8''<encoded>`
   - `Content-Length: String(buffer.length)`
   - **nazwa pliku**: `Raport_audytu_<bezpieczny-tytuł>_v<wersja>_<RRRRMMDD>.docx`,
     z **tą samą normalizacją** co wzorzec (`NFC`, `[^\p{L}\p{N}._-]+ → _`,
     obcięcie do 80 znaków) i **z fallbackiem ASCII** (`Ł/ł → L/l`, `NFD` +
     usunięcie znaków łączących). **Polski tytuł w nagłówku HTTP bez tego
     fallbacku psuje pobieranie w części klientów** — dlatego wzorzec go ma.
7. **Rodzaj raportu nie ma znaczenia dla trasy** — `audit_report`
   i `remediation_progress` idą tą samą drogą, bo adapter obsługuje oba
   (`D.7` test 6).

### Bramka dostępu — rozstrzygnięcie

**Nie wprowadzasz nowej zdolności** (`Z17`, `§0.5`). Trasa jest **odczytem**
i stosuje **dokładnie tę samą bramkę, co `GET /reports/:id`**: `auditActor` +
`assertActor` + tenantowanie przez `actor.organizationId` w zapytaniu.
Uzasadnienie wpisujesz do raportu jednym zdaniem: _kto może przeczytać raport
na ekranie, ten może go pobrać; eksport nie odsłania niczego ponad to, co
zwraca `GET /reports/:id`._

**★ Jeżeli uważasz, że eksport powinien wymagać osobnej zdolności — to jest
STOP z rekomendacją do dyżuru 39, nie Twoja zmiana w `permissions.ts`.**

### Testy (minimum 6, na realnym PG, przez `initializeRoutes`)

Dokładasz do `server/src/routes/audits/__tests__/` (nowy plik
`day41.reportExport.pg.test.ts`):

1. **happy** — raport istnieje → `200`, `Content-Type` docx,
   `Content-Length > 0`, bufor zaczyna się od sygnatury ZIP (`PK`);
2. **`Content-Disposition`** zawiera **oba** warianty nazwy (ASCII
   i `filename*=UTF-8''`), a tytuł z polskimi znakami **nie psuje nagłówka**;
3. **`404`** dla nieistniejącego `id`, z `code: 'AUDIT_NOT_FOUND'`;
4. **negatyw tenanta** — raport innej organizacji → `404`, **nigdy `200`,
   nigdy `403` z danymi**; test wysyła obcą organizację **w nagłówku kontekstu
   org**, nie tylko w tokenie;
5. **`remediation_progress`** też się eksportuje (`200`, niepusty bufor);
6. **treść jest z payloadu, nie z decku** — dowód: raport, którego payload ma
   13 sekcji, daje bufor **istotnie większy** niż ten sam raport zmapowany
   z 8-sekcyjnego decku. **Jeśli nie umiesz tego zmierzyć wiarygodnie
   rozmiarem — asertuj obecność tekstu sekcji, która istnieje TYLKO w wersji
   13-sekcyjnej** (np. tytuł „Macierz traceability"), przez rozpakowanie
   `word/document.xml` z bufora. **Ta asercja jest obowiązkowa** — to jedyny
   dowód, że nie powtórzyłeś błędu z `§1.8` pkt 2.

### Definicja ukończenia `D.8`

- [ ] trasa istnieje, diff w `reports.routes.ts` **wyłącznie addytywny**;
- [ ] 6 testów zielonych na realnym PG, przez `initializeRoutes`;
- [ ] **asercja „treść z payloadu, nie z decku"** obecna i zielona;
- [ ] **zero zmian w `documentStudio/**`** (dowód `git diff --name-only`);
- [ ] zdanie uzasadniające bramkę dostępu w raporcie;
- [ ] dowód osiągalności: `curl` na Twój lokalny serwer testowy → plik
      otwiera się w edytorze tekstu (**otwierasz go i patrzysz** — nie
      „test przeszedł").

---

## §D.9 — MARTWY WIERSZ EKSPORTU → KONTROLKA, KTÓRA POBIERA

**Za flagą `ff_auditsReportChain`, domyślnie `OFF`.**

### Stan zastany

`AuditReportDocumentView.tsx:1281-1285` — wyszarzały `div` z napisem
„Eksport PDF" / „Planowane", `opacity-60`, **bez `onClick`**. Nagłówek pliku
(`:73-76`) opisuje to jako świadomą decyzję poprzedniego dyżuru.

### Co robisz

1. **Dodajesz NOWĄ kontrolkę** „Pobierz DOCX" / „Download DOCX" w sekcji
   „Akcje" prawego panelu (`ArtifactRightPanel`), **powyżej** wiersza PDF,
   stylami **identycznymi** jak sąsiednie przyciski Zatwierdź/Opublikuj
   (`:1252-1256` — kopiujesz klasy dosłownie).
2. Kliknięcie → pobranie z `GET /api/audits/reports/:id/export.docx`.
   **Implementacja pobrania:** zastana konwencja aplikacji dla pobierania
   plików. **Sprawdzasz, jak robi to istniejący konsument raportu DRD**
   (`grep -rn "assessment-report.docx" src/`) i **robisz tak samo**. Jeśli
   takiego konsumentu nie ma — używasz zwykłego `<a href>` z atrybutem
   `download`, **bez własnego kodu blobowego**, i odnotowujesz decyzję.
3. **★ WIERSZ „EKSPORT PDF — PLANOWANE" ZOSTAJE NIETKNIĘTY.** Nie zmieniasz
   jego tekstu, nie usuwasz go, nie zamieniasz na DOCX. PDF nie powstał, więc
   „Planowane" jest **prawdą** (`Z16`, `DEC-154c` mówi „budować, nie ukrywać" —
   a nie „przemianować").
4. **Flaga `OFF`** → kontrolki DOCX **nie ma w DOM**; wiersz PDF wygląda
   **dokładnie jak dziś**. Zrzut `OFF` musi być **nieodróżnialny od stanu
   zastanego** — to jest Twój dowód, że nie zepsułeś zaakceptowanego ekranu.
5. **Stan ładowania** — przycisk `disabled` z widocznym wskaźnikiem na czas
   pobierania. **Błąd** → `ErrorState`/komunikat inline w tej samej sekcji,
   **nigdy `alert()`**, nigdy cicha porażka.

### Testy (minimum 5)

`src/components/Audit/method/__tests__/AuditReportDocumentView.export.test.tsx`
(**uwaga:** `AuditReportDocumentView.test.tsx` już istnieje — **nowy plik**,
żeby nie mieszać się z cudzymi asercjami):

1. flaga `OFF` → **brak** kontrolki DOCX w DOM; wiersz „Eksport PDF" /
   „Planowane" **obecny i niezmieniony**;
2. flaga `ON` → kontrolka DOCX obecna; wiersz PDF **nadal obecny
   i nadal „Planowane"** (asercja **obowiązkowa** — to strażnik przed
   podmianą etykiety);
3. klik → żądanie idzie pod `…/reports/<id>/export.docx`;
4. w trakcie pobierania kontrolka `disabled`;
5. błąd pobrania → widoczny komunikat, **`alert` nie wywołany**.

### Definicja ukończenia `D.9`

- [ ] 5 testów zielonych, w tym **strażnik wiersza PDF**;
- [ ] **polish-pass `§0.4b`** — ze szczególną uwagą na punkt 1 (kolor):
      przycisk pobierania **nie jest** `primary-*`;
- [ ] `scripts/check-artefakt.sh` przechodzi (to ekran-artefakt SPEC-A);
- [ ] **cztery zrzuty**; zrzut `OFF` **nieodróżnialny od stanu zastanego**;
- [ ] parytet i18n PL+EN;
- [ ] dowód osiągalności: klik w realnym harnessie → **plik na dysku,
      otwarty i obejrzany**.

---

## §D.10 — DOWÓD END-TO-END CAŁEGO ŁAŃCUCHA

### Po co osobna pozycja

Bo `D.1`–`D.9` dowodzą **ogniw**. Ta pozycja dowodzi **łańcucha**: że da się
przejść całą drogę bez ręcznego dokładania czegokolwiek w bazie.

### Co budujesz

`server/src/routes/audits/__tests__/day41.reportChainEndToEnd.pg.test.ts`,
**jeden `it`**, realny PG, `initializeRoutes`, wyłącznie żądania HTTP:

```
pakiet → program → kryterium → dowód → ustalenie → przegląd ustalenia
  → POST /outputs/finalize            (Output v1, hash)
  → POST /reports {audit_report}      (Raport v1, draft, 13 sekcji, hash)
  → GET  /reports                     (raport JEST na liście)
  → GET  /reports/:id                 (payload = 13 sekcji, ten sam hash)
  → GET  /reports/:id/export.docx     (bufor .docx, niepusty, treść z payloadu)
  → POST /reports/:id/approve         (approved)
  → POST /reports/:id/publish         (published)
  → POST /reports {audit_report}      (Raport v2 — wersjonowanie działa)
```

Asercje obowiązkowe na każdym kroku:

1. **readback niezależnym połączeniem** po każdym zapisie (`pg.Client` obok
   aplikacji), nie z koperty odpowiedzi;
2. **hash raportu v1 ≠ hash Outputu** (plombują różne byty);
3. **v2 dostaje `version = 2`**, a v1 **nie zmienia treści ani hasha**
   (niezmienność opublikowanego raportu — `§1.2` pkt 5);
4. **publikacja raportu opartego na zastąpionym Outputcie odmawia** — dokładasz
   `POST /outputs/:id/supersede` i sprawdzasz `AuditStateError`
   (`reportService.ts:287-294`);
5. **negatyw tenanta na każdym kroku odczytu** — obca organizacja `404`.

### Definicja ukończenia `D.10`

- [ ] jeden przebieg, wszystkie kroki, **nie `SKIPPED`**;
- [ ] pięć asercji obowiązkowych obecnych;
- [ ] test **sprząta po sobie**, `SELECT count(*)` po `afterAll` w zasięgu
      organizacji testowej → `0` dla `audit_outputs`, `audit_reports`,
      `audit_programs`;
- [ ] czas przebiegu w raporcie (żeby odbierający wiedział, czy to nadaje się
      do CI).

---

## §D.11 — SKALA KRYTERIÓW: POMIAR, NIE OPINIA

### Pytanie do rozstrzygnięcia

Panel wskazywał: **demo ma 42 kryteria, realny audyt ma 150–300**, a lista nie
stronicowała. `DEC-125` dowiózł **pełnoekranową listę z pagerem klienta**
(`AuditCriteriaBrowser.tsx:78` — `PAGE_SIZE = 25`). **Pytanie brzmi: czy to
domknęło sprawę.**

Fakt zweryfikowany (`§1.2` pkt 14): **trasa nie stronicuje**.
`GET /api/audits/criteria` przyjmuje tylko `programId`/`conformityStatus`/
`assignedTo`/`search` (`criteria.routes.ts:27-45`), a `listCriteria`
(`criterionService.ts:170-197`) robi `SELECT *` bez `LIMIT` i **dokłada
agregaty liczników per kryterium**. Klient dostaje wszystko i kroi.

### Co robisz — POMIAR, w tej kolejności

1. **Seed na swoim kontenerze**: jeden program z **300 kryteriami**, każde
   z realistyczną liczbą powiązanych dowodów i ustaleń (nie puste wiersze —
   puste zmierzą nieprawdę). Seed **w pliku testowym**, nie skryptem w repo.
2. **Zmierz trzy rzeczy** i wpisz do raportu **liczbami**:
   - rozmiar odpowiedzi `GET /api/audits/criteria?programId=…` w **kB**
     (`Content-Length`), dla 42, 150 i 300 kryteriów;
   - czas odpowiedzi (mediana z 5 przebiegów) dla tych samych trzech rozmiarów;
   - `EXPLAIN ANALYZE` zapytania z `listCriteria` przy 300 kryteriach —
     czy `idx_audit_program_criteria_program`
     (`20260813_audits_method_core.sql:312`) jest używany.
3. **Rozstrzygnij**, jednym z trzech werdyktów, **z liczbami jako uzasadnieniem**:

   | Werdykt                    | Kiedy                                                                                                                                                     | Co robisz                                                                                                                                                                                                                                                                                                                                                                                                   |
   | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `SKALA_ZAMKNIĘTA`          | odpowiedź dla 300 kryteriów mieści się w rozsądnym budżecie (podaj swój próg i uzasadnij go pomiarem, nie przeczuciem), plan zapytania korzysta z indeksu | **nic nie zmieniasz w kodzie**; wpisujesz pomiar do raportu i do `MODULE_ACCEPTANCE.md`                                                                                                                                                                                                                                                                                                                     |
   | `SKALA_DO_DOMKNIĘCIA`      | pomiar pokazuje realny problem (rozmiar odpowiedzi albo czas)                                                                                             | **NIE naprawiasz w tym dyżurze.** Piszesz **propozycję addytywnego stronicowania** (`limit`/`offset`/`total` jako **opcjonalne** parametry, brak parametru = zachowanie zastane, żaden dzisiejszy konsument się nie łamie) i **STOP z rekomendacją**. Powód: zmiana kontraktu odczytu kryteriów dotyka `AuditCriteriaBrowser` i `CriterionWorkspaceV2` — to osobna pozycja produktowa, nie ogon tego dyżuru |
   | `POMIAR_NIEROZSTRZYGAJĄCY` | nie udało się zmierzyć wiarygodnie                                                                                                                        | opisujesz **dlaczego** i czego brakuje                                                                                                                                                                                                                                                                                                                                                                      |

4. **★ Nie przepisujesz opinii panelu.** „Panel mówił, że jest źle" nie jest
   wynikiem pomiaru. Podajesz **swoje liczby**.

### Definicja ukończenia `D.11`

- [ ] seed 300 kryteriów wykonany **na własnym kontenerze**, sprzątnięty;
- [ ] trzy pomiary × trzy rozmiary, **w tabeli, z jednostkami**;
- [ ] `EXPLAIN ANALYZE` wklejony dosłownie;
- [ ] **jeden z trzech werdyktów**, z liczbą jako uzasadnieniem;
- [ ] **zero zmian w kodzie produkcyjnym** w tym commicie, chyba że werdykt to
      `SKALA_ZAMKNIĘTA` (wtedy też zero — tylko dokumentacja).

---

## §R.1 — RAPORT

Jeden plik, tworzysz go **na początku dyżuru** i uzupełniasz w miarę pracy
(nie na końcu z pamięci):

```
docs/program/waves/WAVE_03_ACCEPTANCE/AUDITS_REPORT_CHAIN_DAY41_REPORT_20260828.md
```

Dodatkowo — i **tylko to** — wolno Ci dopisać do
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/12_AUDITS/MODULE_ACCEPTANCE.md`
sekcję ze **stanem faktycznym łańcucha raportu** i **wynikiem pomiaru skali**
(`D.11`). Nowe ID ustaleń nadajesz **kontynuując zastaną numerację**
(`AUD-PF-<n>`, `AUD-OWN-<n>` — najwyższe zastane sprawdzasz w BLOKU 0 pkt 4j).
**Nie zmieniasz istniejących wpisów, nie podnosisz bram G00-G20** — to robi
odbierający.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~120 min, NIE pomijasz)

Marker → warunki wstępne → worktree → kontener PG → migracje → dowód celu
połączenia → `REAL_PG` → **bramka wejściowa (6 podpunktów)** → inwentarz
konsumentów → baseline testów (a).

### Blok 1 — dowód luki i warstwa API (`D.1` → `D.2` → `D.3`)

Zaczynasz od dowodu, że problem istnieje, i od **najtańszych** ogniw. Po tym
bloku łańcuch jest **osiągalny z konsoli przeglądarki**, choć jeszcze nie
z ekranu — i to jest dobry moment na pierwszy przegląd u nadzorcy.

### Blok 2 — ścieżka użytkownika (`D.4` → `D.5` → `D.6`)

Trzy pozycje frontowe, każda z polish-passem i czterema zrzutami.
**Nie łączysz ich w jeden commit.** Po tym bloku **da się wytworzyć raport
z interfejsu** — to jest główny produkt dyżuru.

### Blok 3 — eksport (`D.7` → `D.8` → `D.9`)

Kolejność jest wiążąca: adapter przed trasą, trasa przed przyciskiem.
**Przycisk bez trasy to atrapa, trasa bez adaptera nie skompiluje się
sensownie.** Tu też mieszka jedyny przewidziany STOP (`D.7` pkt 9).

### Blok 4 — dowód całości i pomiar (`D.10` → `D.11`)

`D.10` domyka łańcuch jednym przebiegiem. `D.11` jest **niezależny** — możesz
go zrobić wcześniej, jeśli blok 3 utknie na STOP-ie.

### Blok 5 — domknięcie (obowiązkowo, ~90 min)

Baseline testów (b) → pomiar zasięgu `§0.4a` → `git stash list` (musi być
pusty) → **`docker rm -fv cx-day41-pg`** → raport → commit dokumentacyjny →
(opcjonalnie) push na `github-backup` własnej gałęzi.

### Zasada nadrzędna kolejności

**Jeśli utkniesz na pozycji dłużej niż na jeden solidny podchód — nie brniesz.**
Zapisujesz stan, wpisujesz STOP albo „częściowo", **commitujesz to, co działa**,
i idziesz dalej. Dyżur z ośmioma zamkniętymi pozycjami i trzema uczciwymi
STOP-ami jest **wart więcej** niż dyżur z jedenastoma pozycjami, z których
cztery są atrapami.

---

## 9. RAPORT — jedyny dokument, który tworzysz

### 9.1. Szablon

```markdown
# Audyty dzień 41 — łańcuch wytworzenia raportu i eksport — raport dyżuru <data>

## Marker i baza

## Oświadczenie o chronionym checkoutcie (Z5/DEC-86)

## Oświadczenie o zakazie `git stash` (Z27) — wynik `git stash list`

## Oświadczenie o braku połączeń do demo/staging/produkcji (Z28)

## Dowód celu połączenia (Z20/Z25/Z26) — port, baza, liczba migracji

## ★ WERYFIKACJA ERRATY §1.2 — czternaście punktów

## Warunki wstępne — tabela (BLOK 0 pkt 4)

## ★★ BRAMKA WEJŚCIOWA (BLOK 0 pkt 8) — sześć podpunktów, wyniki dosłownie

## ★ USTALENIE REAL_PG (BLOK 0 pkt 7)

## ★ INWENTARZ KONSUMENTÓW (BLOK 0 pkt 9)

## Pozycje — tabela zbiorcza (D.1–D.11, R.1)

## ★ MAPA ŁAŃCUCHA — co było, co dołożyłem, czego nadal nie ma

## ★ DOWODY OSIĄGALNOŚCI (Z21/DEC-104) — obowiązkowe dla KAŻDEJ pozycji

## ★ TESTY DOMYŚLNEGO OKABLOWANIA (Z22/DEC-107) — który test montuje initializeRoutes

## ★ MAPOWANIE 13 SEKCJI → BLOKI DOKUMENTU (D.7) — tabela

## ★ ODPOWIEDŹ NA PYTANIE O SILNIK: czy eksport dało się oprzeć na istniejącym silniku

## ★ ROZSTRZYGNIĘCIE SKALI (D.11) — pomiary, EXPLAIN, werdykt

## ★ POLISH-PASS §0.4b — osiem punktów per ekran (D.4, D.5, D.6, D.9)

## ★ ZRZUTY — lista plików, po cztery na pozycję frontową

## Pomiar zasięgu testów §0.4a — ZASTANE / WPROWADZONE / SKIPPED

## Migracje — MIGRATION_PREPARED albo „zero migracji"

## STOP-y

## Korekty wobec instrukcji

## Znaleziska (poza zakresem, do decyzji nadzorcy)

## Twierdzenia NIEZWERYFIKOWANE

## Sprzątanie — potwierdzenie `docker rm -fv`
```

### 9.2. Trzy pytania, na które raport MUSI odpowiedzieć wprost

Odbierający zada je pierwsze. Odpowiedz na nie **zdaniami, nie tabelami**:

1. **Czy da się dziś wytworzyć raport z interfejsu?** Jeśli tak — **którym
   kliknięciem, z którego ekranu**, i za którą flagą. Jeśli nie — **którego
   ogniwa brakuje**.
2. **Czy eksport oparł się na istniejącym silniku dokumentów?** Jeśli tak —
   **ile linii ma Twój adapter i ile linii zmieniłeś w silniku** (odpowiedź
   „zero" jest tu jedyną poprawną). Jeśli nie — **którego bloku zabrakło**.
3. **Czy sprawa skali jest zamknięta?** Werdykt z `D.11` **z liczbami**.

### 9.3. Sekcja „Twierdzenia NIEZWERYFIKOWANE" — obowiązkowa, nie ozdobna

Wypisujesz **wszystko, czego nie sprawdziłeś sam**, a co przyjąłeś na wiarę
z tej instrukcji albo z komentarzy w kodzie. Przykłady rzeczy, które **łatwo
przyjąć bez sprawdzenia**: że hook `check-list-canon.sh` faktycznie łapie
naruszenia koloru; że `AuditReportDocumentView` faktycznie renderuje wszystkie
13 sekcji dla realnego payloadu (nagłówek pliku tak twierdzi, ale to komentarz);
że demo ma 42 kryteria. **Sekcja pusta = sygnał, że jej nie wypełniłeś, a nie
że wszystko sprawdziłeś.**
