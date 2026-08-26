# INSTRUKCJA DYŻURU nr 32 — Codex — „SILNIK DOKUMENTU: raport DRD generowany Z BAZY (krok 2 formuły dokumentów)"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–31. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-28.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

---

## ★★ DLACZEGO TEN DYŻUR JEST NAJWAŻNIEJSZY W CAŁYM PROGRAMIE

Właściciel produktu przez **miesiące** powtarzał jedno zdanie: *nigdy nie powstał
ani jeden naprawdę dobry dokument z szablonu*. To jest jego **strach nr 1** —
zapisany w rejestrze decyzji jako `DEC-2026-08-26-132` („SZABLONY I GENERACJA
DOKUMENTÓW — rekonesans (strach właściciela nr 1)").

**28 sierpnia 2026 ten strach został rozbrojony po raz pierwszy** — decyzja
`DEC-2026-08-28-151`, cytat właściciela po otwarciu pliku we własnym Wordzie:
„mam ten raport i w pdf. **sa zajebiste**". To był **ZŁOTY PLIK RĘCZNY**:
29-stronicowy raport DRD dla fikcyjnej spółki Metalpol, w którym **cała proza
została napisana ręką człowieka** i wpisana do pliku `data.cjs` (62 kB tekstu).

**Twoje zadanie to KROK 2 tej samej formuły — i jest to zadanie o wiele
trudniejsze niż krok 1, bo tym razem nikt nie może niczego napisać ręcznie.**
Masz udowodnić, że **SILNIK** potrafi zrobić to samo: wyprodukować plik `.docx`
w jakości złotego pliku, **dla dowolnego klienta, z danych sesji oceny leżących
w bazie** — a nie z ręcznie napisanego eseju.

Cytat z `DEC-151`, który definiuje odbiór Twojej pracy:

> „KROK 2 FORMUŁY DOKUMENTÓW ODBLOKOWANY: ten sam raport DRD generowany Z BAZY
> dla innego klienta (dowód, że **silnik pisze, nie tylko składa** — `data.cjs`
> było ręczne)."

**Konsekwencja, którą musisz zrozumieć, zanim napiszesz pierwszą linię kodu:**
części złotego pliku **NIE MA W ŻADNEJ BAZIE i nie da się ich wyliczyć**. Proza
narracyjna (wstępy rozdziałów, komentarze obszarów, wnioski, streszczenie
zarządcze) nie istnieje w danych. **Nie wolno Ci jej wymyślić, nie wolno Ci jej
wygenerować modelem (§Z14 — zero LLM) i nie wolno Ci jej przemilczeć.** Masz ją
oznaczyć **uczciwym, widocznym placeholderem** — dokładnie tak, jak robi to
zaakceptowany przez właściciela ekran raportu Oceny (`DEC-2026-08-27-146`,
`DEC-2026-08-27-150`).

**Dokument, który wygląda jak złoty plik, ale w miejsce brakującej prozy wstawia
zmyślone zdania, jest gorszy niż brak dokumentu i oznacza odrzucenie CAŁEGO
dyżuru.** To jest jedyne zdanie tej instrukcji, które warto zapamiętać na pamięć.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

1. **★★ CAŁY KATALOG `src/` JEST POZA ZAKRESEM DO ZAPISU.** Wolno Ci go
   **czytać i grepować** (jest to wręcz wymagane — BLOK 0), ale **nie zmieniasz
   w nim ani jednego znaku**: także „jednej linii importu", także żeby „dodać
   przycisk Pobierz .docx", także żeby „domknąć ostatnie ogniwo Z20". Przycisk
   frontowy jest **osobnym dyżurem frontowym, za flagą domyślnie OFF** — Twoim
   produktem jest **kontrakt trasy opisany w raporcie**, nie przycisk.
   Jedyny wyjątek od tego zakazu: **żaden**.
2. **★★ ZERO LLM. ZERO GENEROWANIA TREŚCI MODELEM.** Nie wołasz `llmService`,
   nie dotykasz `aiAssessmentPartnerService`, `aiAssessmentReportGenerator`,
   `initializeAI()`, nie ustawiasz `GOOGLE_AI_API_KEY`/`GEMINI_API_KEY`/
   `ANTHROPIC_API_KEY` w żadnym środowisku — także „na chwilę, żeby zobaczyć,
   jak by to wyglądało". Silnik AI to osobny moduł, ostatni w programie
   (`DEC-51`, potwierdzone `DEC-2026-08-28-152`). **Dokument tego dyżuru powstaje
   w 100% deterministycznie z danych i ze struktury.**
3. **★★ ZERO ZALEŻNOŚCI OD LIBREOFFICE (ani od żadnego innego renderera biurowego)
   W KODZIE SERWEROWYM.** Złoty plik był budowany skryptem, który wołał
   `/Applications/LibreOffice.app/Contents/MacOS/soffice` **dwa razy**: raz do
   rasteryzacji radaru (SVG→PNG) i raz do renderu PDF, z którego mierzono numery
   stron do spisu treści. **Obie te ścieżki są dla silnika serwerowego
   ZAKAZANE.** Railway nie ma LibreOffice, a dokładanie go byłoby wymianą jednego
   długu na większy. Rozwiązania bez LibreOffice masz podane w §C i §D.4 — nie
   improwizuj własnych (`puppeteer` jest w `devDependencies` i **też jest
   zakazany**, `DEC-132`).
4. **★ NIE PISZESZ NOWEGO GENERATORA OBOK.** Miejscem docelowym jest
   **istniejący silnik** `server/src/services/documentStudio/**` z pakietem
   `docx@9.5.1`. Skopiowanie `build.cjs` do `server/` i nazwanie go serwisem =
   **odrzucenie dyżuru**: `build.cjs` jest prototypem jednorazowym (sztywne
   ścieżki, 638 inline `rFonts`, dane w module, LibreOffice), a repo ma już
   **pięć** niezależnych systemów stylowania eksportu i szósty jest ostatnią
   rzeczą, jakiej potrzebuje (`DEC-132` pkt 2).
5. **★ SILNIK MA NIE PSUĆ SZEŚCIU ISTNIEJĄCYCH WOŁAJĄCYCH.**
   `renderDocumentSchemaToDocxBuffer` ma dziś sześciu konsumentów produkcyjnych
   (§1.5). **Każda Twoja zmiana w nim jest ADDYTYWNA i domyślnie WYŁĄCZONA**, a
   dowodem jest test bitowej niezmienności bufora dla schematu, który nowych pól
   nie ustawia (§A.4). To nie jest formalność — to jedyne zabezpieczenie, jakie
   masz.
6. **★ TEN DYŻUR MA SIEDEM POZYCJI ROBOCZYCH (§A–§G) I DWIE DOKUMENTACYJNE
   (§R.1, §R.2).** Wszystko inne, co Ci „po drodze" przyjdzie do głowy —
   tłumaczenie 233 opisów poziomów, naprawa atrap `/export/pdf` i `/export/pptx`
   w Assessment, ujednolicenie pięciu systemów stylowania, `docxtemplater`,
   szablony `.dotx`, generacja PPT — jest **POZA ZAKRESEM** (§1.6) i idzie do
   „Znalezisk", nie do kodu.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **gałąź `codex/m03-admin-20260824`**, przypięta do
   commitu-markera podanego niżej.

   **SHA markera: 5cfa62470e**

   > **★★ MARKER ZWIĄZANY PRZEZ NADZORCĘ 2026-08-28.** Powyżej stoi realny,
   > dziesięcioznakowy SHA tipa gałęzi `codex/m03-admin-20260824` z chwili
   > wydania zlecenia. To NIE jest wartownik i NIE jest powodem do STOP-u.
   >
   > **Jedyny STOP z tytułu markera** to negatywny wynik weryfikacji z pkt 2
   > (`MARKER BRAK`, czyli `git merge-base --is-ancestor` zwraca błąd).
   > Sama obecność SHA w tym miejscu jest stanem POPRAWNYM.
   >
   > **Historia (do wiadomości, nie do działania):** pierwsze wydanie tej
   > instrukcji miało w tym miejscu literalny wartownik `«MARKER_SHA»`, a
   > nadzorca związał marker podstawieniem globalnym, które weszło również
   > w treść tej ramki — przez co ramka zaczęła wskazywać prawdziwy marker
   > jako wartownik. Dyżur zatrzymał się prawidłowo. Naprawione 2026-08-28
   > przez nadzorcę: ramka wiązania nie zawiera już żadnego SHA poza polem
   > markera, a procedura wiązania podmienia wyłącznie to pole.

2. **Sprawdzasz marker PIERWSZĄ komendą dyżuru** (podstawiając za `<SHA>` to,
   co realnie stoi w ramce wyżej):

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor <SHA> codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

3. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/golden-drd-report-20260827`,
   `codex/assessment-day20-*`, `codex/assessment-day25-*`,
   `codex/assessment-day29-*`, `codex/assessment-report-front-day27-*`,
   `codex/meetings-*`, `codex/mgmtreports-*` ani z żadnej gałęzi dni 17–31.
   Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu (nadzorca scalił coś po związaniu markera) — **to nie
   jest STOP**. Startujesz **dokładnie z markera**, wypisujesz w raporcie
   `git log --oneline <SHA>..codex/m03-admin-20260824` i listę plików rozejścia;
   scalenie z nowszym tipem wykonuje nadzorca przy odbiorze. **Rebase w trakcie
   dyżuru: ZAKAZANY.**

4. **★★ WARUNEK WSTĘPNY NR 2: GAŁĄŹ ZŁOTEGO PLIKU MUSI ISTNIEĆ I BYĆ CZYTELNA.**
   Cały ten dyżur mierzy się wobec złotego pliku. Bez niego nie ma czego mierzyć.

   ```bash
   # (a) gałąź złotego pliku istnieje i niesie commit poprawek typograficznych
   git log --oneline -3 codex/golden-drd-report-20260827
   # oczekiwane: najwyżej c2a91d0258 "fix(golden-drd): nbsp sieroty + pl-PL + gramatyka zał. A + łamanie sygnatur (audyt 26.08)"

   # (b) komplet generatora — SIEDEM plików + dwa wyjścia
   git ls-tree -r --name-only codex/golden-drd-report-20260827 \
     -- docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/golden-drd-report/
   # oczekiwane 9 pozycji: RAPORT_DRD_METALPOL_WZORZEC.docx, .pdf,
   #   generator/{build.cjs,data.cjs,make.sh,measure.cjs,postprocess.cjs,radar.cjs,radar.png}

   # (c) czy złoty plik jest już w Twojej bazie? (spodziewane: NIE)
   git merge-base --is-ancestor codex/golden-drd-report-20260827 codex/m03-admin-20260824 \
     && echo "GOLDEN MERGED" || echo "GOLDEN NOT MERGED"
   ```

   | Warunek | Co robisz |
   | --- | --- |
   | `git log` gałęzi złotego pliku **nie działa** (gałąź nie istnieje) | **STOP CAŁEGO DYŻURU.** Bez wzorca nie ma parytetu. Raport + pozycja STOP. |
   | `GOLDEN NOT MERGED` (oczekiwane) | Pracujesz normalnie. Złoty plik czytasz **wyłącznie przez `git show`** do katalogu roboczego poza worktree (§0.3 „Odczyt wzorca"). **NIE cherry-pickujesz, NIE mergujesz, NIE kopiujesz `build.cjs`/`data.cjs` do `server/`.** |
   | `GOLDEN MERGED` | To samo. Wtedy pliki są w Twoim worktree i czytasz je wprost — ale nadal **niczego z `prototypes/` nie zmieniasz i niczego stamtąd nie importujesz w kodzie serwerowym.** |
   | Twój `git diff --name-only <SHA>...HEAD` zawiera cokolwiek w `docs/.../prototypes/golden-drd-report/**` | **Naruszenie — złoty plik jest zamkniętym dowodem akceptu właściciela (`DEC-151`). Odrzucenie pozycji.** |

5. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu. Każda komenda ma
   podany oczekiwany wynik — **rozbieżność idzie do „Korekt wobec instrukcji",
   nie do improwizacji**. Wykonujesz to w worktree z §0.1 pkt 6.

   ```bash
   # (a) sedno §A/§B — renderer docelowy i jego arkusz stylów
   grep -c "" server/src/services/documentStudio/documentDocxRenderer.ts   # oczekiwane: 1646
   grep -c "" server/src/services/documentStudio/documentDocxStyles.ts     # oczekiwane: >= 340
   grep -c "DocStudioTitle\|Subtitle\|Heading1\|BodyText\|BlockQuote\|Caption\|DocStudioFootnote\|AssumptionBody\|Callout\|SourceList\|TOCHeading" \
     server/src/services/documentStudio/documentDocxStyles.ts              # oczekiwane: >= 13

   # (b) sedno §C — rasteryzator wykresów (BEZ LibreOffice, @napi-rs/canvas + chart.js)
   grep -c "@napi-rs/canvas" server/src/services/documentStudio/documentChartRasterizer.ts   # oczekiwane: >= 1
   grep -n "DocumentChartKind" server/src/services/documentStudio/documentStudioTypes.ts      # oczekiwane: linia ~98
   grep -c "'radar'" server/src/services/documentStudio/documentStudioTypes.ts                # oczekiwane: 0 (ZERO — radaru NIE MA)

   # (c) sedno §D — kontrakt raportu Oceny (day20 + sessionLabel z day29)
   grep -c "" server/src/services/assessment/assessmentReportContractService.ts   # oczekiwane: 182
   grep -c "sessionLabel" server/src/services/assessment/assessmentReportContractService.ts  # oczekiwane: >= 1
   grep -c "contractVersion: 'assessment-report-contract-v1'" server/src/services/assessment/assessmentReportContractService.ts  # oczekiwane: 1

   # (d) sedno §E — struktura DRD i jej warstwa polska
   grep -c "" server/src/data/drdStructure.ts        # oczekiwane: 2210
   grep -c "namePL" server/src/data/drdStructure.ts  # oczekiwane: 48  (7 osi + 39 obszarów + 2 w interfejsach)
   grep -c "titlePL" server/src/data/drdStructure.ts # oczekiwane: 0 (ZERO — ★ to jest §E)
   grep -c "levelCount:" server/src/data/drdStructure.ts  # oczekiwane: 8 (1 w interfejsie + 7 osi)

   # (e) sedno §F — istniejąca trasa kontraktu, obok której staje trasa .docx
   grep -n "assessment-report-contract" server/src/routes/method-core.routes.ts   # oczekiwane: 1 trafienie (~:532)
   grep -c "assessmentReportContractService" server/src/routes/method-core.routes.ts  # oczekiwane: 2 (import + wywołanie)

   # (f) uczciwy placeholder — literał, który MASZ powtórzyć bit w bit
   grep -n '"emptySlot"' public/locales/pl/translation.json
   # oczekiwane: "emptySlot": "Sekcja do uzupełnienia — limit {{min}}–{{max}} słów."

   # (g) rejestr decyzji
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 204
   grep -c "DEC-2026-08-28-151" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md  # oczekiwane: >= 1
   ```

6. **Własna gałąź i własny worktree** (nigdy praca na `codex/m03-admin-20260824`):

   ```bash
   git branch codex/document-engine-day32-<data> <SHA>
   git worktree add /private/tmp/consultify-document-engine-day32 codex/document-engine-day32-<data>
   cd /private/tmp/consultify-document-engine-day32
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

7. **★ KOMENDA BAZOWA — wszystkie porównania w raporcie robisz wobec markera**,
   nigdy wobec `HEAD~1`:

   ```bash
   git diff --name-only <SHA>...HEAD
   ```

   Ta komenda ma w tym dokumencie własną nazwę — **„komenda bazowa"** — i wraca
   w §0.3, §0.4 i w szablonie raportu. Wynik wklejasz do raportu dosłownie.

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/document-engine-day32-<data>` | Push na `origin`/demo wykonuje wyłącznie nadzorca |
| Z2 | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824`, **`codex/golden-drd-report-20260827`** ani żadnej gałęzi `codex/assessment-*`, `codex/meetings-*`, `codex/mgmtreports-*`, `codex/chat-*`, `codex/tools-*` | `demo` = święta baza; tamte gałęzie to historia odebrana albo praca w toku; gałąź złotego pliku niesie zamknięty dowód akceptu właściciela |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4 powstał tak; `DEC-95` |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) | Wymagania są w rejestrze uwag i decyzjach |
| **Z5** | **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86` | Chroniony, brudny worktree właściciela — praca własna Piotra |
| Z6 | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` — w chwili wystawienia żyje ich kilkadziesiąt, w tym `consultify-golden-docx`, `consultify-day32-instrukcja` | Cudze worktree, część w aktywnym użyciu |
| Z7 | **Nie zajmujesz portów sesyjnych. TWÓJ KONTENER PG = `5521`.** Zakazane wprost, także gdy akurat wolne: **5499** (dzień 25), **5474** (Tools), **5498** (mgmtreports), **5511**, **5512**, **5533** (dzień 29), **55291**. Port zajęty → bierzesz pierwszy wolny **powyżej 5521** i wpisujesz go **jawnie** do raportu | Cudze dyżury pracują równolegle; tamte porty bywają wskrzeszane przez odbiorców |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`) | Produkcja/demo poza zakresem |
| **Z9** | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo/staging/produkcja, nigdy cudza retained-DB. **KOREKTA `DEC-2026-08-26-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — patrz ramka pod tabelą | „dane demo = twarz produktu" (`DEC-65`) |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Także zero „tymczasowej flagi na czas testu". Dotyczy w szczególności `ff_assessmentReportView`, `drdHttpSourceOfTruthV1`, `drdMethodWorkspaceSliceV1`, `methodWorkspaceShellV1`, `ENABLE_DELIVERABLES_LIGHT`, `ENABLE_V8_GLOBAL`, `DEMO_ORG_ID`, `enableStubRoutes` | CLAUDE.md reguła 9; flagi frontowe są w `src/` = poza zakresem. **Pole opcjonalne w schemacie dokumentu NIE jest flagą funkcyjną** — patrz ramka pod tabelą |
| Z11 | **Nie zmieniasz `src/components/ProtectedRoute.tsx`, `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`** ani gramatyki tras. **Dodajesz DOKŁADNIE JEDNĄ nową trasę HTTP** (§F) i ani jednej więcej. **Nie zmieniasz montaży w `server/src/Gateway.ts`** — §F wchodzi do routera już zamontowanego | Gramatyka zaakceptowana (`DEC-2026-08-24-07`); nowa trasa = nowa powierzchnia do odbioru |
| Z12 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_DAY32_REPORT_20260828.md`. Jedyny inny dokument, który wolno zmienić, to `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md` — wyłącznie w ramach `R.1`. **Raportów dni 20/25/27/29 NIE edytujesz** | Repo tonie w dokumentach-duchach; tamte raporty są zamkniętymi dowodami odbiorowymi |
| Z13 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie. Jeżeli uważasz, że decyzja się myli — piszesz **erratę w raporcie**, nie patch w rejestrze | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **★★ ZERO LLM.** Zero `llmService`, zero `initializeAI()`/`injectAIClient()`, zero `aiAssessmentReportGenerator`, zero kluczy AI w jakimkolwiek środowisku, zero tras `/api/ai/**`. **Cała treść dokumentu jest deterministyczna: albo wyliczona z danych, albo stała, albo jawny placeholder** | Silnik AI = osobny moduł, ostatni w programie; `DEC-51`, `DEC-2026-08-28-152`. **Dodatkowo: dokument z prozą od modelu nie jest dowodem, że silnik składa dokument — jest dowodem, że model pisze eseje** |
| **Z15** | **★★ ZERO ZMYŚLANIA. Brak danych = uczciwy placeholder, nigdy wypełniacz.** Nie wstawiasz „przykładowego" tekstu, „lorem ipsum", „tekst poglądowy", nazwiska oceniającego, branży klienta ani żadnego zdania, którego nie ma w bazie. **Nie kopiujesz prozy z `data.cjs` złotego pliku do kodu serwerowego** — to jest treść o Metalpolu i wstawiona komukolwiek innemu jest kłamstwem o kliencie | Sedno tego dyżuru; `DEC-146`/`DEC-150` (ekran raportu Oceny pokazuje puste sloty uczciwie) |
| **Z16** | **★★ NIETYKALNE: `server/src/services/effectiveAccessService.ts`, `frameworkEntitlementService.ts`, `middleware/frameworkEntitlement.middleware.ts`, `PermissionsService`, `server/src/services/v8/artifactRegistryService.ts`, `server/src/services/methodCore/**` (jądro zdarzeń), `server/src/method-core/outputs/**`.** Wolno **czytać** i **wołać** | Model uprawnień i jądro Method Core naprawiane in-house; jądro współdzielone z Audits/SIRI (`DEC-139`) |
| **Z17** | **★ Zakaz wszystkiego poza wskazanym zakresem** — z imiennymi licencjami z ramki w §1.7. Cały front (`src/**` do zapisu), powłoka SPEC-A, kanon triady, cudze serwisy, cudze moduły: **NIE** | „jeden moduł na raz"; podział FRONT/TYŁ |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | Dyżur nr 2 wywalił tak 27 cudzych testów |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, podanego W TEJ SAMEJ LINII komendy — PIĘĆ zmiennych, nie dwie.** Kolejność Bloku 0: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar**. Do raportu obowiązkowy **dowód celu połączenia** i **liczba SKIPPED** | Dzień 17 zmierzył stan wejściowy na cudzej/niezmigrowanej bazie (`DEC-96/98`); dzień 19 mierzył bez `MOCK_DB=false` |
| **Z20** | **★ DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`) — patrz ramka pod tabelą | Bramka DoD dnia 60 przepuściła „ZROBIONE" przy czterech żywych martwych gałęziach |
| **Z21** | **★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). W tym dyżurze wariant szczególnie kuszący: **test, który woła serwis mapujący z ręcznie napisanym obiektem kontraktu, NIE dowodzi niczego o silniku.** Dowodem jest przebieg **od realnego JWT, przez realny router, przez realny serwis kontraktu, do realnego PG** | Dzień 18: 8/8 testów zielonych, warstwa AI martwa, bo wszystkie wstrzykiwały własne `generate` |
| **Z22** | **★ Zakaz atrapy z zewnętrznym skutkiem** (`DEC-2026-08-26-108`). Wariant tego dyżuru: **plik `.docx`, który wygląda dobrze, ale jego treść nie pochodzi z wierszy w bazie** (bo serwis ma domyślne wartości, bo test wstrzyknął dane, bo mapa ma fallback z przykładem). **Sukces odpowiedzi + ładny plik przy zerowym odczycie z bazy = ODRZUCENIE pozycji** | Dzień 19: `DELETE /occurrence` rozsyłał `CANCEL`, nie zmieniwszy nic w bazie |
| **Z23** | **★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-2026-08-26-108`) — wynik z **PEŁNEGO zakresu §0.4**, z rozbiciem **ZASTANE / WPROWADZONE** i liczbą **SKIPPED**. **Podanie zawężonego wyboru = naruszenie** | Dzień 19 zadeklarował „98/98 PASS" przy 189/193 w zakresie własnej instrukcji |

**★ Z9 — procedura po korekcie `DEC-2026-08-26-98` (nie zabijaj dyżuru).**
Jeżeli złapiesz się na komendzie DB bez przypiętego env: **zatrzymaj tę komendę →
ustal skutek (czy w ogóle doszło do połączenia i czy był ZAPIS) → zapisz
ustalenie w raporcie → przypnij env → KONTYNUUJ pozycję.** Twardy STOP całego
dyżuru **wyłącznie** przy stwierdzonym realnym **zapisie** do bazy spoza dyżuru.
`localhost:5432/iris_test` to wewnętrzny fallback konwencji testowej repo
(`tests/setup.ts`), nie obca baza — ale i tak nie mierzysz przeciwko niemu.

**★ Z10 — czym jest flaga, a czym nie jest.**
Flagą funkcyjną jest przełącznik środowiskowy albo wpis w rejestrze flag, który
zmienia zachowanie **już działającej ścieżki produkcyjnej dla istniejących
użytkowników**. **Nie jest** flagą: nowe **opcjonalne pole schematu dokumentu**
(np. `formattingSchema.tocConfig.nativeField`), którego brak zachowuje
dotychczasowe zachowanie bit w bit. Właśnie taki mechanizm masz stosować w §A/§B/§C
— i **udowodnić** jego neutralność testem z §A.4. Jeżeli łapiesz się na tym, że
Twoja zmiana wymaga zmiennej środowiskowej — **STOP i pozycja w raporcie**, nie
zmienna.

**★★ Z19 — PIĘĆ zmiennych w tej samej linii, i dlaczego to nie jest biurokracja.**

- `server/src/database/Database.ts` — `process.env.MOCK_DB === 'true'` podstawia
  **mock DB BEZWARUNKOWO**, niezależnie od `RUN_DB_TESTS`;
- `tests/setup.ts` — `process.env.MOCK_DB = process.env.MOCK_DB || 'true'`,
  czyli **brak jawnego `MOCK_DB=false` USTAWIA `MOCK_DB='true'`**;
- `tests/setup.ts` — globalny mock `auth.middleware.js`: przy **braku** nagłówka
  `Authorization` i przy `MOCK_DB !== 'false'` wstrzykuje użytkownika
  `role: 'owner', isSuperAdmin: true` i woła `next()`. Czyli **anonim dostaje
  `200` zamiast `401`**.

**W tym dyżurze jest jeszcze jeden, decydujący powód: cała teza dyżuru brzmi
„dokument powstaje Z DANYCH". Na mocku DB nie ma żadnych danych — serwis
kontraktu zwróci pustkę albo fallback, a Ty wyprodukujesz ładny plik o niczym
i uznasz go za dowód.** Dlatego **każde** uruchomienie testu dotykającego bazy ma
env **w tej samej linii**:

```bash
DATABASE_URL="postgres://postgres:cx@localhost:5521/cx_day32" \
DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
npx vitest run <plik>
```

i **każdy** taki przebieg jest poprzedzony dowodem celu połączenia:

```bash
docker exec cx-day32-pg psql -U postgres -d cx_day32 -c "SELECT current_database(), inet_server_port();"
```

Wynik tej komendy (**dosłowny**) jest obowiązkową pozycją raportu. Pomiar bez
dowodu celu = pomiar nieistniejący. **Pakiet w całości `SKIPPED` zaraportowany
jako `PASS` = zawyżenie i podstawa odrzucenia.** (Uwaga: `docker exec ... psql`
łączy się socketem wewnątrz kontenera, więc `inet_server_port()` bywa pusty — to
**nie jest** błąd; wtedy dokładasz wynik `docker port cx-day32-pg` jako dowód
mapowania na host.)

**★ Z20 — jak wygląda dowód osiągalności.**
Nie wystarczy „funkcja istnieje i ma test jednostkowy". Dla **każdej** pozycji
podajesz w raporcie **ścieżkę wywołania od realnego wejścia**:

```
realne wejście (metoda + URL, jaki wychodzi z klienta HTTP)
  → montaż w Gateway.ts (plik:linia)
  → middleware (gatewayVerifyToken / trialEntryGuard / ...)
  → handler trasy (plik:linia)
  → serwis mapujący (plik:linia)
  → serwis kontraktu (plik:linia)
  → ODCZYT tabel (nazwy tabel i kolumn)
  → renderer .docx (plik:linia)
  → bajty odpowiedzi (nagłówki + rozmiar)
```

**★★ UCZCIWA FORMA OSTATNIEGO OGNIWA W TYM DYŻURZE — przeczytaj, zanim skłamiesz
przez przemilczenie.** Trasa z §F **nie ma i nie będzie miała w tym dyżurze
konsumenta frontowego** — przycisk „Pobierz .docx" jest osobnym dyżurem frontowym
(★ ograniczenie krytyczne pkt 1). Dlatego ostatnim ogniwem jest **koperta HTTP
odpowiedzi wraz z bajtami pliku** i **piszesz to wprost**: „ostatnie ogniwo =
koperta HTTP + bufor .docx; konsumenta frontowego brak, kontrakt dla frontu
opisany w §F.5". **Nie wolno Ci** dopisać konsumenta w `src/`, żeby ogniwo
„domknąć", i **nie wolno Ci** przemilczeć jego braku.

**★ Z21 — co to znaczy „test domyślnego okablowania" w tym dyżurze.**
Test, który buduje własny `express()` i **wstrzykuje własny serwis kontraktu albo
ręcznie napisany obiekt `reportContract`**, nie dowodzi niczego. Wzorzec dowodowy
tego dyżuru to (wzór do naśladowania — `server/src/services/assessment/__tests__/
assessmentAiPartner.day25.pg.test.ts:31-35`): importujesz **realny router**
`server/src/routes/method-core.routes.js`, montujesz go pod `/api/method`
z **realnym `verifyToken` i realnym `trialEntryGuard` w kolejności produkcyjnej**,
z realnym JWT podpisanym sekretem z `Config`, przeciwko **realnemu PG z §0.4**.
**Serwisy, baza, mapowanie błędów, bufor .docx — realne.**

**Zasięg Z18 — konkretnie.**

```
tests/setup.ts
tests/helpers/**            (w tym unifiedMockSetup.js)
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

Gdy potrzebujesz innego zachowania mocka: **opt-in, nigdy globalnie** — `vi.mock`
lokalnie w Twoim pliku testowym albo dedykowany helper w **nowym** pliku
importowanym tylko przez Twoje testy. Jeśli Twój test nie przechodzi bez zmiany
globalnego mocka — to **STOP**, nie zmiana globalnego mocka.

### 0.3. Higiena wykonania

- **★ COMMIT PER POZYCJA — TWARDO.** Dzień 24 wrzucił cztery pozycje do jednego
  commita i to był dodatkowy powód, dla którego żadna nie dostała
  `ZROBIONE_WG_DoD`. Conventional commits — dokładnie te (zangielszczone treści,
  polski raport):

  ```
  feat(document-studio): add an opt-in DRD report style profile to the docx stylesheet (A)
  test(document-studio): pin byte-identical output for schemas without the new profile (A.4)
  feat(document-studio): apply Polish typographic spacing at the run level (B)
  feat(document-studio): render radar charts without an office suite (C)
  feat(assessment): map the report contract onto a document schema (D)
  feat(drd): carry Polish level labels on the axis scale (E)
  feat(assessment): serve the DRD report as a docx download (F)
  test(assessment): prove the report is generated from database rows for a second tenant (G)
  docs(assessment): raise 04_ASSESSMENT acceptance to the delivered scope (R.1)
  docs(assessment): day 32 duty report (R.2)
  ```

- **★ Odczyt wzorca (złoty plik) — procedura, która NIE brudzi worktree.**
  Wszystko, co wypakowujesz ze złotego pliku, ląduje **poza worktree**, w
  katalogu roboczym `/private/tmp/consultify-day32-wzorzec/`:

  ```bash
  mkdir -p /private/tmp/consultify-day32-wzorzec && cd /private/tmp/consultify-day32-wzorzec
  G=codex/golden-drd-report-20260827
  P=docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/golden-drd-report
  git -C <root-repo> show $G:$P/RAPORT_DRD_METALPOL_WZORZEC.docx > wzorzec.docx
  for f in build.cjs data.cjs radar.cjs postprocess.cjs measure.cjs make.sh; do
    git -C <root-repo> show $G:$P/generator/$f > $f
  done
  rm -rf x && mkdir x && (cd x && unzip -q ../wzorzec.docx)
  # arkusz stylów wzorca — podstawa tabeli parytetu §G.3
  python3 -c "import re,sys;d=open('x/word/styles.xml',encoding='utf8').read();print('\n'.join(sorted(set(re.findall(r'w:styleId=\"([^\"]+)\"',d)))))"
  ```

  **Katalogu `/private/tmp/consultify-day32-wzorzec/` NIE commitujesz i NIE
  linkujesz z kodu serwerowego.** Jest to materiał pomiarowy, nie zależność.

- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`. W repo **nie ma** skryptu `format` — wołasz
  `npx prettier` wprost.
- **Typy punktowo** — `npx esbuild <plik>.ts --loader:.ts=ts --outfile=/dev/null`.
  **NIGDY pełny `tsc -p` repo, NIGDY pełny `vitest` repo.**
  **★ Uwaga: `esbuild` TRANSPILUJE, nie typuje — nie złapie błędu typu.** Dla
  plików, które piszesz od zera (§D, §F), dopuszczam **jeden** przebieg
  `npx tsc --noEmit --skipLibCheck <plik>.ts` z filtrem do własnych plików;
  wynik do raportu. **Zakaz `tsc -p server/tsconfig.json`** — wynik i tak jest
  zdominowany przez kilkadziesiąt cudzych `@ts-nocheck` w `server/src/services/`.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `toContain('...')`, **nie liczy się do DoD** (Z21). Dla `.docx`
  „behawioralny" znaczy: **rozpakowujesz wyprodukowany bufor i asertujesz na
  realnym XML** (`word/document.xml`, `word/styles.xml`, `word/footer*.xml`),
  a nie na kodzie, który go tworzy.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `server/src/` dodają się normalnie.
- **★ MIGRACJE — reguły twarde.**
  1. **Wyłącznie addytywne.** `CREATE TABLE IF NOT EXISTS`,
     `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
     `INSERT ... ON CONFLICT DO NOTHING`. **Zakaz** `DROP`,
     `ALTER COLUMN ... TYPE`, `RENAME`, `DELETE`, bezwarunkowego `UPDATE`.
  2. **★★ NUMERACJA — DZIEŃ 32 MA PRZYDZIELONY PRZEDZIAŁ `20261210`–`20261219`.**
     Reguła „najwyższy + 1" obowiązuje **TYLKO WEWNĄTRZ tego przedziału**.
     Numery spoza przedziału są **ZAKAZANE, nawet jeśli `ls` pokazuje je jako
     wolne**: `20261124`–`20261209` to pule dni 22–31 i prac wewnętrznych,
     **część jeszcze nie scalona**, więc `ls` ich u Ciebie nie pokaże — to nie
     znaczy, że są wolne. (Najwyższy widoczny na markerze to `20261123`;
     **nie** bierz `20261124`.)

     **Obowiązkowy `ls | grep` PRZED KAŻDYM plikiem:**

     ```bash
     ls server/migrations | grep -E '^202612[0-9]{2}' | sort | tail -5   # co widać jako zajęte
     ls server/migrations | grep '^2026121'                              # MUSI być PUSTE przed utworzeniem pliku
     ```

     Nazwa: `<numer>_assessment_day32_<temat>.sql`. `migrate.postgres.ts` stosuje
     migracje w porządku **alfabetycznym nazw plików**, więc kolizja numeru to
     cicha katastrofa — dokładnie ta, którą wykrył odbiór dnia 18 (`DEC-107`).
  3. **★ ZERO nowych kluczy obcych.**
  4. **★★ NAJPEWNIEJ NIE POTRZEBUJESZ ŻADNEJ MIGRACJI. Sprawdziłem to za Ciebie:**
     - §A/§B/§C to warstwa renderowania — zero obiektów bazodanowych;
     - §D **wyłącznie czyta** przez `assessmentReportContractService`, który
       czyta `method_sessions`, `projects` oraz wyjścia Method Core — wszystkie
       istnieją;
     - §E dokłada **stałe w kodzie TypeScript** (`server/src/data/drdStructure.ts`),
       **nie kolumnę w bazie**. Etykiety skali są kanonem metodyki, nie danymi
       tenanta — trzymanie ich w bazie byłoby nowym kontraktem zapisu, którego
       nikt nie zamawiał;
     - §F to trasa odczytu — zero DDL;
     - §G to seed **w teście**, nie migracja.

     **Migracja bez udowodnionego braku obiektu na świeżej bazie = pozycja
     odrzucona.** Jeżeli mimo to uznasz, że migracja jest potrzebna — **STOP,
     opis w raporcie, decyzja nadzorcy**.
- **★ SPRZĄTANIE ŚRODOWISKA — dokładnie tak i nie inaczej.**

  ```bash
  docker rm -fv cx-day32-pg
  ```

  **ABSOLUTNY ZAKAZ `docker volume prune`, `docker system prune`, `docker
  volume rm` na czymkolwiek, czego nazwy nie znasz.** Równolegle żyją kontenery
  i wolumeny innych dyżurów; `prune` kasuje cudze retained-DB i jest
  nieodwracalny. `docker rm -fv <nazwa>` usuwa **wyłącznie** kontener tego
  dyżuru wraz z jego anonimowymi wolumenami — i to jest cała procedura.
  Sprzątasz **na końcu dyżuru, po ostatnim pomiarze**, i odnotowujesz to
  w raporcie.

### 0.4. BLOK 0 — środowisko i pomiar wejściowy (kolejność obowiązkowa)

**Kolejność jest częścią wymogu. Najpierw baza, potem pomiar.**

1. **Kontener** (port **5521**, patrz Z7):

   ```bash
   docker run -d --name cx-day32-pg -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx_day32 \
     -p 5521:5432 pgvector/pgvector:pg17
   # odczekaj na gotowość, potem DOWÓD CELU:
   docker exec cx-day32-pg psql -U postgres -d cx_day32 -c "SELECT current_database(), inet_server_port();"
   docker port cx-day32-pg
   ```

2. **Pełne migracje na PUSTEJ bazie** (tryb strict — bez tego §D/§F/§G nie mają
   na czym stanąć):

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5521/cx_day32" DB_TYPE=postgres \
     npx tsx server/src/database/migrate.postgres.ts
   ```

   Liczba zastosowanych migracji i ewentualne błędy — **dosłownie do raportu**.
   Migracja, która nie przechodzi na pustej bazie, jest **znaleziskiem
   raportowym**, nie powodem do jej „poprawienia" (poza zakresem, Z17).

3. **Pomiar WEJŚCIOWY — pełny zakres, bez zawężania (Z23).** Uruchamiasz
   **wszystko z listy poniżej**, zapisujesz `PASS/FAIL/SKIPPED` per plik i sumę.
   To jest Twoje „PRZED"; identyczny przebieg powtarzasz na końcu jako „PO".

   ```bash
   DATABASE_URL="postgres://postgres:cx@localhost:5521/cx_day32" \
   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
   npx vitest run \
     server/src/services/documentStudio/__tests__ \
     server/src/services/assessment/__tests__ \
     server/src/routes/assessment/__tests__ \
     tests/unit/backend/routes \
     --reporter=verbose
   ```

   **Czerwone ZASTANE wypisujesz imiennie w raporcie PRZED rozpoczęciem §A.**
   Bez tej listy nie da się odróżnić Twojej regresji od cudzego długu i odbiór
   przyjmie najgorszą interpretację.

4. **Weryfikacja stanu wejściowego z §0.1 pkt 5** — wszystkie komendy (a)–(g),
   wyniki dosłownie do raportu, rozbieżności do „Korekt wobec instrukcji".

5. **Rekonesans osiągalności (obowiązkowy, wynik do raportu).**

   ```bash
   # kto dziś woła renderer .docx — sześciu konsumentów, których NIE WOLNO Ci zepsuć
   grep -rn "renderDocumentSchemaToDocxBuffer" server/src --include="*.ts" | grep -v "__tests__"
   # czy ktokolwiek w src/ pyta o raport DRD w .docx (spodziewane: NIKT)
   grep -rn "assessment-report" src/ | head
   # czy istnieją atrapy eksportu Assessment (DEC-132 pkt 5) — NIE naprawiasz ich, tylko odnotowujesz
   grep -rn "export/pdf\|export/pptx" server/src/routes/assessment/ | head
   ```

---

## 1. STAN WEJŚCIOWY — ustalenia zmierzone przez nadzorcę

Poniższe ustalenia zostały **zmierzone**, nie przepisane z cudzego raportu.
Każde ma podaną komendę weryfikacyjną w §0.1 pkt 5. Gdziekolwiek Twój pomiar
rozejdzie się z tym rozdziałem — **wiążący jest Twój pomiar**, a rozbieżność
idzie do „Korekt wobec instrukcji".

### 1.1. Czym jest złoty plik i co dokładnie zaakceptował właściciel

`RAPORT_DRD_METALPOL_WZORZEC.docx` — **29 stron**, budowany skryptem
`generator/build.cjs` (**34 kB**) z danymi w `generator/data.cjs` (**62 kB
ręcznie napisanej prozy**). Właściciel otworzył `.docx` i `.pdf` we własnym
Wordzie i ocenił: „sa zajebiste" (`DEC-2026-08-28-151`, **OWNER_ACCEPT**).

**Co zostało zaakceptowane:** typografia, struktura, paleta, geometria tabel,
radar, spis treści, stopka, klauzula poufności, załącznik. To jest **złoty
standard** i punkt odniesienia parytetu.

**Czego NIE zaakceptowano jako sposobu wytwarzania:** samego generatora.
`DEC-151` mówi wprost: „`data.cjs` było ręczne". Generator jest jednorazowym
prototypem i **NIE jest kodem produkcyjnym** — mówi to nawet jego własny
nagłówek (`build.cjs:5`).

**Otwarta, NIEBLOKUJĄCA uwaga właściciela z `DEC-151` (iteracja 2, nie ten
dyżur):** „1B (węższa kolumna / wypełnienie końcówek / Calibri)". **Nie
realizujesz jej.** Odnotowujesz w „Znaleziskach", żeby nie zginęła.

### 1.2. Kontrakt złotego pliku — wyprowadzony z `build.cjs`

To jest **specyfikacja wyjścia**, którą silnik ma odtworzyć. Wszystkie liczby
pochodzą z lektury `build.cjs`; **potwierdzasz je sam** przy odczycie wzorca
(§0.3).

**(a) Geometria i kompozycja strony**

| Parametr | Wartość we wzorcu |
| --- | --- |
| Format | A4 — `210 × 297 mm` (`convertMillimetersToTwip`) |
| Marginesy | góra/lewo/prawo **22 mm**, dół **20 mm**, stopka **11 mm** |
| Szerokość kolumny treści | **9412 dxa** (`PAGE_W − 2 × MARGIN`) |
| Pierwsza strona | `titlePage: true` — okładka bez stopki (`footers.first` = pusta) |
| Łamanie stron | **właściwość akapitu `pageBreakBefore` na nadtytule (kickerze)**, NIGDY pusty akapit z `<w:br type="page"/>` — pusty akapit tworzy dodatkową pustą stronę na granicy sekcji |
| Nagłówki H1 | **bez** `pageBreakBefore` w stylu — inaczej kicker zostaje osierocony na poprzedniej stronie |

**(b) Paleta (BRAND_EXPORT_CANON §3, motyw executive)**

| Rola | Hex | Uwaga |
| --- | --- | --- |
| `NAVY` (dominant) | `0C447C` | wypełnienie komórki poziomu osiągniętego |
| `NAVY_DARK` | `083152` | nagłówki tabel, wyróżnienia |
| `TEAL` (accent) | `1D9E75` | kickery, linie sekcji, poziom docelowy |
| `TEAL_DARK` | `14664B` | tekst na wypełnieniu docelowym |
| `INK` | `1F2937` | treść |
| `MUTED` | `6B7280` | podpisy, stopka, drugi plan |
| `HAIR` | `D6DFE8` | linie włoskowe |
| **`CRIMSON`** | **`85182F`** | **WYŁĄCZNIE znak marki + oznaczenie luki krytycznej** |
| `FILL_HEAD` / `FILL_BELOW` / `FILL_TOGO` / `FILL_TARGET` | `E2E9EF` / `D3DDE7` / `E8F5F1` / `BFE4D8` | tinty matrycy |

> **★ PUŁAPKA NR 1 CAŁEGO REPO (CLAUDE.md reguła 3):** w Tailwindzie produktu
> `primary` = **crimson `#85182F`**. Tu obowiązuje ta sama zasada w wersji
> dokumentowej: **crimson jest znakiem marki i sygnałem luki krytycznej — niczym
> więcej.** Wypełnienie nagłówka tabeli crimsonem, akcent CTA, „bo ładnie
> wygląda" = naruszenie kanonu.

**(c) Fonty** — `Calibri Light` (nagłówki) + `Calibri` (treść). BRAND_EXPORT_CANON
§11 D1: **wyłącznie kroje Office-native**. **Nie osadzasz fontów w `.docx`** —
to jest wymóg wzorca, nie przeoczenie. (Moduł `server/src/utils/pdfFonts.ts`
z Lato OFL, `DEC-133`/`DEC-139`, dotyczy **tras PDF-owych `pdfkit`**, nie `.docx`
— nie mieszaj tych dwóch spraw i nie dotykaj `pdfFonts.ts` w tym dyżurze.)

**(d) Struktura dokumentu — kolejność bloków**

```
1. Okładka           znak marki (crimson) · kicker · tytuł 32 pt · nazwa klienta ·
                     linia teal · tabela metadanych (9 wierszy) · klauzula poufności
2. Spis treści       kicker (nowa strona) + nagłówek + pole TOC (poziomy 1–2)
3. Streszczenie      lead + akapit · RADAR (rys. 1) + podpis · tabela zbiorcza
   zarządcze         7 osi (tab. 1) + podpis · „Luki krytyczne i rekomendacja główna" (3 akapity)
4. × 7  ROZDZIAŁ     kicker „Rozdział N z 7 · oś N struktury DRD" (nowa strona)
   OSI               → H1 „N. <nazwa osi>"
                     → podpis: skala · liczba obszarów · luki krytyczne
                     → linia teal
                     → WSTĘP (120–180 słów)
                     → H2 „Matryca poziomów dojrzałości" + tabela matrycy + podpis (30–60 słów)
                     → H2 „Ocena obszarów", a w niej dla KAŻDEGO obszaru:
                          H3 „<id>  <nazwa>"
                          WSTĘGA „Sygnatura" (tinta + pionowy akcent po lewej):
                            poziom obecny · poziom docelowy · luka · priorytet · dowody
                          akapit p1 + akapit p2   (razem 110–170 słów,
                            mikrostruktura: stan → dowód/wiarygodność → skutek biznesowy
                            → luka i sens targetu → najbliższy krok)
                     → H2 „Wnioski rozdziału" + tekst (180–260 słów)
                     → etykieta „LINIA DECYZYJNA" + tabela 4 wierszy
                          (Kierunek · Priorytet · Horyzont · Warunek sukcesu)
5. Wnioski końcowe   kicker + H1 „8. Wnioski końcowe" + akapity + H2 + tabela linii
                     decyzyjnej całego programu + podpis
6. Załącznik A       kicker + H1 „Załącznik A. Rejestr luk" + akapit wprowadzający
                     + tabela rejestru (posortowana: luka malejąco, potem oś, potem nazwa)
                     + podpis
```

**(e) Style nazwane — 22 w arkuszu, 9 własnych używanych**

Własne (`paragraphStyles`): `Tresc`, `Lead`, `Kicker`, `Podpis`, `Sygnatura`,
`TOC1`, `TOC2`, `NaglowekBezNumeru`, `NaglowekBezNumeru2`.
Domyślne (`styles.default`): `heading1` (Calibri Light 20 pt navy),
`heading2` (Calibri bold 13,5 pt navy), `heading3` (Calibri bold 11,5 pt ink),
`document.run` (Calibri 11 pt ink, **`language: 'pl-PL'`**),
`document.paragraph` (interlinia 312).

> **★★ TO JEST NAJWAŻNIEJSZY WYMÓG JAKOŚCIOWY TEGO DYŻURU.** Audyt złotego pliku
> (7,5/10) wykazał w nim **638 inline `rFonts`** — czyli formatowanie wklejane
> przy pojedynczych przebiegach zamiast dziedziczone z arkusza stylów. **We
> wzorcu ręcznym to wada kosmetyczna. W SILNIKU to BLOKADA.** Dokument z inline
> formatowaniem jest nieedytowalny sensownie po stronie klienta (zmiana stylu
> w Wordzie nic nie zmienia), nieprzeszukiwalny dla narzędzi dostępności
> i niemożliwy do utrzymania. **Twój silnik nadaje wygląd WYŁĄCZNIE przez
> `styleId`; inline `run` dopuszczam tylko tam, gdzie style Worda fizycznie nie
> sięgają: kolor pojedynczego przebiegu w wielobarwnym akapicie (wstęga
> „Sygnatura", wiersz matrycy) i wypełnienie komórki.** Liczba inline `rFonts`
> w Twoim wyjściu jest **mierzoną, raportowaną wartością** (§G.3) i ma być
> **radykalnie niższa niż 638**.

**(f) Tabele — geometria wzorca**

| Tabela | Kolumny (dxa) | Linie |
| --- | --- | --- |
| Matryca osi | `2950` obszar · `N` kolumn poziomów (razem `3770`) · `850` luka · `1842` priorytet | pełna siatka włoskowa `HAIR` grubość 3 |
| Linia decyzyjna | `2300` + `7112` | góra `TEAL` 8, wewnątrz poziomo `HAIR` 3, pionowe **NONE** |
| Zbiorcza 7 osi | `3020 · 1500 · 1500 · 1400 · 1992` | góra/dół `NAVY` 8, wewnątrz poziomo `HAIR` 3, pionowe **NONE** |
| Rejestr luk (zał. A) | `3100 · 2250 · 2250 · 550 · 1262` | jw. |
| Metadane okładki | `2900 · 6512` | góra/dół `HAIR` 3, wewnątrz poziomo `HAIR` 3 |

Marginesy komórki: `top/bottom 70`, `left/right 110`. Wyrównanie: liczby
**do prawej**, poziomy w matrycy **wyśrodkowane**. **Zebra: WYŁĄCZONA**
(BRAND_EXPORT_CANON §6). Nagłówek tabeli: **jasne wypełnienie `FILL_HEAD`
+ tekst `NAVY_DARK` pogrubiony** — nie odwrotnie.

**(g) Semantyka wypełnień matrycy** (kolumna = poziom skali osi):

| Warunek | Wypełnienie | Tekst |
| --- | --- | --- |
| `poziom < obecny` | `FILL_BELOW` | pusty |
| `poziom == obecny` | **`NAVY`** | numer, biały, pogrubiony |
| `obecny < poziom < docelowy` | `FILL_TOGO` | pusty |
| `poziom == docelowy` | `FILL_TARGET` | numer, `TEAL_DARK`, pogrubiony |

Kolumna „Luka" = `docelowy − obecny`, **crimson przy `>= 3`**.
Kolumna „Priorytet" = funkcja luki: `>=3` → **Krytyczny**, `2` → Wysoki,
`1` → Średni, `0` → Utrzymanie.

**(h) Radar** — SVG budowany ręcznie, rasteryzowany **LibreOffice'em** do PNG
`2480 × 1430`, osadzany jako `606 × 349` pt. Pięć pierścieni siatki co 20%,
szprychy, **dwa wielokąty** (docelowy: teal, wypełnienie 10%, obrys 5;
obecny: navy, wypełnienie 17%, obrys 6), punkty na wierzchołkach, etykiety osi
łamane na 1–2 linie + podpis `X% → Y%`, legenda-chipy (kółka, nie kwadraciki),
**zero gradientów, zero 3D, zero crimson** (BRAND_EXPORT_CANON §7).
**Wartości są PROCENTAMI skali własnej osi** (`średnia_poziomów / levelCount`) —
dzięki temu osie o 5, 6 i 7 poziomach są porównywalne.
**Rasteryzacja LibreOffice'em jest w silniku ZAKAZANA — §C podaje zamiennik.**

**(i) Spis treści — mechanizm dwuprzebiegowy (i dlaczego go NIE powtarzasz)**

Wzorzec: pole TOC pozostaje natywne, ale `postprocess.cjs` **wstrzykuje do niego
zapamiętany wynik pola** (cached field result), a numery stron pochodzą
z `measure.cjs`, który **renderuje PDF LibreOffice'em** i czyta strony przez
`pdfinfo` / `pdftotext`. Dwa przebiegi, bo pierwszy ustala paginację.

**Dla silnika serwerowego ta ścieżka jest zamknięta** (★ ograniczenie krytyczne
pkt 3). Rozstrzygnięcie masz w §D.4 — i **jest to świadoma, nazwana różnica
parytetu**, nie przeoczenie.

**(j) Stopka** — linia włoskowa u góry, trzy strefy przez tabulatory
(`CENTER` na `CONTENT_W/2`, `RIGHT` na `CONTENT_W`):
`Poufne — <klient>` · `Strona {PAGE} z {NUMPAGES}` · `● Consultify` (kropka
crimson). Pola `PAGE`/`NUMPAGES` w formie **kanonicznej** (osobne przebiegi
`begin` / `instrText` / `separate` / wynik / `end` z powtórzonym `rPr`) —
forma skrócona gubi formatowanie wyniku w części czytników.

**(k) Typografia polska — twarde spacje**

```js
text.replace(/(^|\s)([aiouwzAIOUWZ]) /g, '$1$2 ')
```

Wzorzec przechwytuje **każde** wywołanie `new TextRun({ text })` przez podklasę
`TextRun`, więc reguła obejmuje treść, komentarze, wnioski, linię decyzyjną
i tabele. **Sierota na końcu wiersza (samotne „i", „w", „z") to widoczny defekt
składu w polskim dokumencie doradczym.** W silniku ma to być **wbudowane
w renderer** (§B), nie doklejane w warstwie danych.

**(l) Metadane pliku** — `creator`/`lastModifiedBy` = `Consultify`, `title`,
`subject`, `description`, `keywords`, `features.updateFields = true`.
**Zero danych osobowych w metadanych** (BRAND_EXPORT_CANON §4 + D5).

### 1.3. Silnik docelowy — co JUŻ masz i czego NIE musisz budować

| Element | Stan w repo | Wniosek dla Ciebie |
| --- | --- | --- |
| Renderer `.docx` | `server/src/services/documentStudio/documentDocxRenderer.ts`, **1646 linii**, `docx@9.5.1`, funkcja `renderDocumentSchemaToDocxBuffer(schema, options)` | **Miejsce docelowe.** Rozszerzasz addytywnie |
| Arkusz stylów | `documentDocxStyles.ts` — **13 stabilnych `styleId`** (`DocStudioTitle`, `Subtitle`, `Heading1..3`, `BodyText`, `BlockQuote`, `Caption`, `DocStudioFootnote`, `AssumptionBody`, `Callout`, `SourceList`, `TOCHeading`) + `buildDocxStyleConfig()` + `DOCX_PALETTE` | Baza dla §A |
| **Język `pl-PL`** | **JUŻ JEST**: `documentDocxStyles.ts:349` ustawia `w:lang` na domyślnym przebiegu, gdy `schema.language` zaczyna się od `pl` | **Wada złotego pliku z audytu tu NIE WYSTĘPUJE.** Nie „naprawiasz" jej drugi raz — **weryfikujesz i raportujesz** |
| Wypełnienie **pojedynczej komórki** tabeli | **JUŻ JEST**: `renderTableBlock` czyta `cell.fill` i sam dobiera biały pogrubiony tekst na ciemnym tle (`isDarkFill`) | **Matryca DRD jest wyrażalna istniejącym blokiem `table`.** Nie dodajesz nowego typu bloku |
| Zebra w tabelach | **JEST WŁĄCZONA domyślnie** (`rowIndex % 2 === 1` → `DOCX_PALETTE.zebraFill`) | **Kolizja z BRAND_EXPORT_CANON §6 (zebra OFF).** Rozstrzygnięcie w §A.3 |
| Nagłówek tabeli | **navy fill + biały pogrubiony tekst** | Odwrotnie niż wzorzec (jasne tło + ciemny tekst). Rozstrzygnięcie w §A.3 |
| Rasteryzacja wykresów | `documentChartRasterizer.ts` — **`@napi-rs/canvas` + `chart.js`**, prebuilt binaria, **BEZ cairo/pango i BEZ LibreOffice** | **To jest Twój zamiennik LibreOffice dla radaru** (§C) |
| Typy wykresów | `DocumentChartKind = 'bar' \| 'line' \| 'pie' \| 'donut' \| 'scatter' \| 'area'` — **`'radar'` NIE ISTNIEJE** | §C dokłada `'radar'`. `chart.js` obsługuje radar natywnie — to jest mapowanie, nie nowy silnik wykresów |
| Spis treści | `renderTocBlock` — **statyczny, ŚWIADOMIE bez numerów stron** (komentarz w kodzie: „A static TOC cannot reliably know page numbers until Word updates fields") | Zgodne z zakazem LibreOffice. §D.4 dokłada **opcjonalne** pole natywne |
| Stopka + `PAGE`/`NUMPAGES` | **JUŻ JEST** (`documentDocxRenderer.ts:1533-1581`) | Nie budujesz od nowa |
| Fonty domyślne | `Aptos` / `Aptos Display`; `schema.formattingSchema` może je nadpisać | **Calibri ustawiasz przez schemat, nie przez zmianę domyślnych** — zmiana domyślnych dotknęłaby sześciu cudzych konsumentów |
| Kontrakt raportu | `assessmentReportContractService.ts`, **182 linie**, `contractVersion: 'assessment-report-contract-v1'`, 7 rozdziałów = 7 osi, `sessionLabel` (dzień 29) | **Twoje jedyne źródło danych** |
| Trasa kontraktu | `GET /api/method/sessions/:sessionId/assessment-report-contract` (`method-core.routes.ts:~532`) | Obok niej staje trasa `.docx` z §F |
| Struktura DRD | `server/src/data/drdStructure.ts`, **2210 linii**, 7 osi, 39 obszarów, 233 opisy poziomów | Kanon metodyki |

**★ SZEŚCIU KONSUMENTÓW RENDERERA, KTÓRYCH NIE WOLNO CI ZEPSUĆ:**

```
server/src/services/v8/transformationFinalOutputService.ts:9
server/src/services/deliverables/bundleExportRuntime.ts:12
server/src/services/documentStudio/documentStudioService.ts:72
server/src/services/initiative/initiativeMaterializeService.ts:28
  + trasy pobierania .docx: server/src/routes/report-builder.routes.ts:4111
                            server/src/routes/report-builder-public.routes.ts:596  (PUBLICZNY link!)
```

Ostatnia pozycja jest publicznie osiągalna. **Regresja w rendererze wychodzi
poza system.** Stąd wymóg bitowej niezmienności z §A.4.

### 1.4. ★★ KLUCZOWE USTALENIE DYŻURU — co silnik może wypełnić Z DANYCH, a czego NIE MOŻE

**To jest najważniejsza tabela w tym dokumencie.** Wyprowadzona z zestawienia
`build.cjs` + `data.cjs` (czego wzorzec używa) z `assessmentReportContractService.ts`
+ `drdStructure.ts` (co realnie jest w kontrakcie i w bazie). **Weryfikujesz ją
sam w §D.1 i jej potwierdzenie albo obalenie jest obowiązkową pozycją raportu.**

**Legenda:** `DANE` = wyliczalne deterministycznie z kontraktu/struktury ·
`STAŁA` = tekst niezmienny dla każdego raportu · `BRAK` = nie istnieje
w kontrakcie ani w bazie → **placeholder** · `CZĘŚCIOWO` = jest, ale nie w tej
postaci, co we wzorcu.

| # | Element złotego pliku | Źródło w silniku | Werdykt |
| --- | --- | --- | --- |
| 1 | Tytuł „Raport z oceny dojrzałości cyfrowej" | literał | **STAŁA** |
| 2 | Nazwa klienta na okładce | `reportContract.sessionLabel.displayName` = **nazwa PROJEKTU**, nie spółki (`projects.name`); przy braku projektu = `null` | **CZĘŚCIOWO** — patrz ramka pod tabelą |
| 3 | Zakład / lokalizacja (`site`) | — | **BRAK** |
| 4 | Profil działalności (`industry`) | — | **BRAK** |
| 5 | Zatrudnienie (`headcount`) | — | **BRAK** |
| 6 | Okres oceny (`period`) | — | **BRAK** (jest tylko `generatedAt` — moment wydania, nie okres) |
| 7 | Oceniający + rola (`assessor`) | — | **BRAK** |
| 8 | Sponsor po stronie klienta | — | **BRAK** |
| 9 | Metodyka (`methodVersion`) | `reportContract.methodVersion` (`output.methodPackVersion ?? session.method_pack_version`) | **DANE** |
| 10 | Sygnatura sesji | `reportContract.sessionId` (UUID, nie „DRD-2026-0817-MTP") | **CZĘŚCIOWO** — jest identyfikator, nie ludzka sygnatura |
| 11 | Data wydania | `reportContract.generatedAt` | **DANE** |
| 12 | Wersja/rewizja raportu | `reportContract.revision`, `outputId`, `contractVersion` | **DANE** (wzorzec tego NIE MA — to jest przewaga silnika) |
| 13 | Klauzula poufności | literał (z podstawieniem nazwy z poz. 2) | **STAŁA** |
| 14 | Spis treści (wpisy) | wyprowadzalny ze struktury dokumentu | **DANE** |
| 15 | Spis treści (numery stron) | wymagałby renderu → LibreOffice | **BRAK — świadomie, §D.4** |
| 16 | Radar: wartości osi | `średnia(currentLevel) / maxLevel`, `średnia(targetLevel) / maxLevel` po obszarach ocenionych | **DANE** |
| 17 | Radar: etykiety osi | `axis.namePL` (istnieje dla **wszystkich 7 osi**) | **DANE** |
| 18 | Tabela zbiorcza 7 osi | jw. + liczba luk krytycznych (`gap >= 3`) | **DANE** |
| 19 | Nazwy osi po polsku | **`drdStructure.axis.namePL` — ISTNIEJE** (`Procesy Cyfrowe`, `Produkty Cyfrowe`, …) | **DANE** — ★ patrz ramka „obalenie tezy" |
| 20 | Nazwy obszarów po polsku | **`drdStructure.area.namePL` — ISTNIEJE dla wszystkich 39 obszarów** | **DANE** |
| 21 | Identyfikatory obszarów (`1A`, `2D`, …) | `matrix.areas[].unitId` | **DANE** |
| 22 | Poziom obecny / docelowy / luka | `matrix.areas[].currentLevel / targetLevel / gap` | **DANE** |
| 23 | Liczba poziomów skali osi | `chapter.maxLevel` | **DANE** |
| 24 | Wypełnienia matrycy (below/current/togo/target) | funkcja poz. 22–23 | **DANE** |
| 25 | Priorytet | funkcja luki (`>=3 Krytyczny`, `2 Wysoki`, `1 Średni`, `0 Utrzymanie`) | **DANE** |
| 26 | **Etykiety poziomów skali po polsku** (np. „3 — Kontrola procesu") | `drdStructure.levels[].title` istnieje, ale **PO ANGIELSKU**; `titlePL` = **0 wystąpień** | **CZĘŚCIOWO → §E** |
| 27 | Stan dowodów („udokumentowane / niepełne / zadeklarowane") | `matrix.areas[].evidenceState` ∈ `evidenced / incomplete / declared / not_assessed` | **DANE** (mapa PL w §D.2) |
| 28 | Obszary pominięte + kod pominięcia | `skipped`, `skipCode`, `skips[]` | **DANE** — ★ **wzorzec tego NIE MA; to jest przewaga silnika i MUSI być widoczne w dokumencie** |
| 29 | Wstęp rozdziału (120–180 słów) | `chapter.introduction.content` = **`null`** | **BRAK → placeholder** |
| 30 | Podpis matrycy (30–60 słów) | `chapter.matrix.caption.content` = **`null`** | **BRAK → placeholder** |
| 31 | Komentarz obszaru (110–170 słów, mikrostruktura 5-częściowa) | `chapter.areaComments[].content` = **`null`** (jest za to `microstructure`, `answerRefs`, `evidenceRefs`, `sourceLocators`, `uncertainty`) | **BRAK → placeholder z wypisaną mikrostrukturą** |
| 32 | Wnioski rozdziału (180–260 słów) | `chapter.conclusion.content` = **`null`** | **BRAK → placeholder** |
| 33 | Linia decyzyjna (kierunek/priorytet/horyzont/warunek sukcesu) | `chapter.conclusion.decisionLine.*` = **wszystkie `null`** | **BRAK → placeholder w 4 wierszach tabeli** |
| 34 | Streszczenie zarządcze (5 akapitów) | **NIE ISTNIEJE ani slot, ani treść** | **BRAK → §D.3 rozstrzyga** |
| 35 | Wnioski końcowe (rozdz. 8) + linia decyzyjna programu | **NIE ISTNIEJE ani slot, ani treść** | **BRAK → §D.3 rozstrzyga** |
| 36 | Załącznik A — rejestr luk (sortowanie, priorytety, liczba luk krytycznych) | w pełni wyliczalny z poz. 21–25 | **DANE** |
| 37 | Stopka, paginacja, numeracja tabel/rysunków | mechanika renderera + licznik | **STAŁA / DANE** |

> **★★ OBALENIE TEZY, KTÓREJ NIE WOLNO CI POWIELIĆ.** W materiałach roboczych
> krąży twierdzenie: *„nazwy osi w `drdStructure.ts` są angielskie, polska
> warstwa złotego pliku była ręczna"*. **To jest FAŁSZ i zmierzyłem to:**
> `grep -c namePL server/src/data/drdStructure.ts` → **48**. Polskie nazwy
> **wszystkich 7 osi i wszystkich 39 obszarów** są w strukturze i **zgadzają się
> co do znaku** z tym, co wzorzec ma w `data.cjs` (`Procesy Cyfrowe`,
> `Procesy Sprzedaży`, `Procesy Logistyczne`, `Procesy Produkcyjne`,
> `Procesy Jakości`). Ten sam duet pól niesie już kontrakt raportu jako
> `axisNamePL` i `unitNamePL`. **Nie tłumaczysz nazw osi ani obszarów. Nie
> wpisujesz ich do kodu serwisu.** Czytasz je z kontraktu.
>
> **Prawdziwa dziura polskiej warstwy jest gdzie indziej i jest węższa:**
> `DRDLevel` ma `title` + `description` **wyłącznie po angielsku** i **nie ma
> `titlePL`** (`grep -c titlePL` → **0**). To jest §E i tylko to.

> **★ POZYCJA 2 — NAZWA KLIENTA. Przeczytaj, zanim wpiszesz cokolwiek na
> okładkę.** `sessionLabel.displayName` to **nazwa projektu**, nie nazwa spółki
> klienta (dzień 29, `DEC-2026-08-27-149`: „źródło org-scoped z uczciwym
> `null`"). To bywa to samo, ale **nie musi**. **NIE wolno Ci** sięgnąć po
> `organizations.name` „bo tak będzie ładniej" — nazwa organizacji w Consultify
> jest nazwą **firmy doradczej-najemcy**, a nie jej klienta, i wpisanie jej na
> okładkę raportu dla klienta byłoby **błędem merytorycznym widocznym dla
> odbiorcy końcowego**. Zasada: **`displayName` jeśli jest; jeśli `null` —
> placeholder „[Nazwa klienta do uzupełnienia]", a nie substytut z innego pola.**
> Jeżeli uznasz, że istnieje lepsze źródło — **STOP i pozycja w raporcie**, nie
> zmiana serwisu kontraktu.

**Podsumowanie ilościowe do raportu (potwierdzasz własnym pomiarem):**
**~24 z 37** elementów wzorca jest **w pełni wyliczalnych z danych lub stałych**,
**~3** są **częściowe**, **~10** to **czysta narracja bez pokrycia** i wchodzi
jako **jawne placeholdery**. **Silnik odtwarza całą KONSTRUKCJĘ dokumentu
i wszystkie LICZBY; nie odtwarza PROZY — i mówi o tym wprost w samym pliku.**

### 1.5. Uczciwy placeholder — jak MA wyglądać i skąd pochodzi jego brzmienie

Ekran raportu Oceny (dzień 27, zaakceptowany przez właściciela — `DEC-146`,
`DEC-150`, flaga `ff_assessmentReportView` domyślnie ON) pokazuje puste sloty
narracyjne literałem z `public/locales/pl/translation.json`:

```
"emptySlot": "Sekcja do uzupełnienia — limit {{min}}–{{max}} słów."
```

**Silnik ma mówić do klienta dokładnie tym samym głosem.** Serwer nie ma warstwy
i18n, więc literał wpisujesz w kodzie serwisu §D — **bit w bit, z półpauzą `—`
i z półpauzą w zakresie `–`** (to są dwa różne znaki: `U+2014` i `U+2013`;
pomylenie ich jest defektem typograficznym, który odbiór wyłapie).

**Forma w dokumencie:**

- akapit stylem `Podpis` (kursywa, `MUTED`) — **wizualnie odróżnialny od treści
  na pierwszy rzut oka**, żeby nikt go przypadkiem nie wziął za tekst raportu;
- **zero crimson** — brak treści to nie jest stan krytyczny, tylko stan roboczy;
- dla komentarza obszaru (poz. 31) placeholder **wypisuje mikrostrukturę**
  z kontraktu (`stan_faktyczny`, `ocena_i_wiarygodnosc`,
  `znaczenie_dla_przedsiebiorstwa`, `luka_i_sens_targetu`, `najblizszy_krok`)
  po polsku, jako listę — konsultant ma dostać **rusztowanie**, nie pustkę;
- dla linii decyzyjnej placeholder stoi **w każdym z czterech wierszy osobno**,
  nie zamiast tabeli — tabela ma zostać, bo jej struktura jest częścią wzorca;
- **obszar pominięty (poz. 28)** dostaje **inny** komunikat niż brak treści:
  `„Obszar pominięty w ocenie — kod: <skipCode>."`, a przy pominięciu częściowym
  — listę pominiętych pytań. **Pominięcie to decyzja konsultanta, nie luka
  w dokumencie**, i tak ma być zapisane.

**Czego placeholder NIE robi:** nie liczy słów za konsultanta, nie proponuje
treści, nie zawiera przykładu, nie mówi „TODO", nie jest w nawiasach
kwadratowych stylizowanych na zmienną szablonu.

### 1.6. Poza zakresem (idzie do „Znalezisk", nie do kodu)

1. **Tłumaczenie 233 opisów poziomów** (`DRDLevel.description`) — §E dotyka
   **wyłącznie krótkich etykiet skali**, nie opisów.
2. **Atrapy eksportu Assessment** — `/export/pdf` (36 linii, bez okładki
   i stopki) i `/export/pptx` (dokładnie 2 slajdy, zero konsumentów), `DEC-132`
   pkt 5. **Nie naprawiasz ich i nie usuwasz** — inwentaryzujesz.
3. **Ujednolicenie pięciu systemów stylowania eksportu** (VF3-2/3/4) —
   `DEC-132` pkt 2. Twój profil z §A jest **wsadem** do tej pracy, nie jej
   wykonaniem.
4. **`docxtemplater`, szablony `.dotx`/`.potx`, generacja PPT, HTML→PDF** —
   odrzucone w `DEC-132`.
5. **`ENABLE_DELIVERABLES_LIGHT` i cały system Deliverables/M17** — decyzja
   właściciela w toku.
6. **Przycisk „Pobierz .docx" i jakikolwiek kod w `src/`** — osobny dyżur
   frontowy za flagą OFF.
7. **Uwaga „1B" właściciela z `DEC-151`** (węższa kolumna / wypełnienie końcówek
   / Calibri) — iteracja 2.
8. **`server/src/utils/pdfFonts.ts` i trasy `pdfkit`** — zamknięte
   `DEC-133`/`DEC-139`.
9. **Drugi dokument na tym samym silniku (raport Audits) i deck** — kolejne
   pozycje formuły, po odbiorze tego dyżuru.

### 1.7. Granica plikowa — ostra

```
WOLNO (Twój zakres):
  server/src/services/documentStudio/documentDocxStyles.ts            (§A — ADDYTYWNIE: profil DRD)
  server/src/services/documentStudio/documentDocxRenderer.ts          (§A/§B/§D.4 — ADDYTYWNIE, domyślnie wyłączone)
  server/src/services/documentStudio/documentStudioTypes.ts           (§C — DOKŁADNIE jedna wartość: 'radar'; §D.4 — jedno pole opcjonalne)
  server/src/services/documentStudio/documentChartRasterizer.ts       (§C — mapowanie radaru)
  server/src/services/assessment/assessmentDrdReportSchemaService.ts  (§D — NOWY PLIK, serce dyżuru)
  server/src/data/drdStructure.ts                                     (§E — WYŁĄCZNIE dodanie etykiet skali PL; ZERO zmian w istniejących polach)
  server/src/routes/method-core.routes.ts                             (★ WĄSKA LICENCJA §F — patrz ramka)
  server/src/services/documentStudio/__tests__/day32.*.test.ts        (NOWE pliki)
  server/src/services/assessment/__tests__/day32.*.test.ts            (NOWE pliki)
  tests/integration/routes/assessment.day32.*.postgres.integration.test.ts  (NOWE pliki, git add -f)
  docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-engine-day32-20260828/**  (NOWY katalog dowodowy)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md  (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_DAY32_REPORT_20260828.md    (jedyny nowy dokument)

IMIENNE LICENCJE (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  server/src/services/assessment/assessmentReportContractService.ts   (WOŁASZ; ZMIANA = STOP — kontrakt odebrany DEC-122/DEC-149, front dnia 27 na nim stoi)
  server/src/services/assessment/assessmentSkipReasonService.ts       (WOŁASZ pośrednio; ZMIANA = STOP)
  server/src/method-core/outputs/**                                   (WOŁASZ bez zmian; ZMIANA = STOP, Z16)
  server/src/utils/DbPromise.ts                                       (WOŁASZ; ZMIANA = STOP)
  server/src/middleware/auth.middleware.ts                            (MONTUJESZ w teście; ZMIANA = STOP)
  server/src/middleware/trialEntryGuard.middleware.ts                 (MONTUJESZ w teście; ZMIANA = STOP)
  server/src/services/documentStudio/documentDocxStructure.ts         (CZYTASZ; ZMIANA = STOP)
  docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md               (CZYTASZ jako SSOT stylowania; ZMIANA = STOP)
  docs/.../prototypes/golden-drd-report/**                            (CZYTASZ przez `git show`; ZMIANA = ODRZUCENIE)
  wzorzec testu dowodowego —
    server/src/services/assessment/__tests__/assessmentAiPartner.day25.pg.test.ts
    (realny router + realny JWT + realny PG — Twój wzorzec dla §F.4 i §G)

NIE WOLNO:
  ★★ CAŁE src/** DO ZAPISU (odczyt i grep — TAK, wręcz wymagane)   ← podział FRONT/TYŁ; zero wyjątków
  ★  dev-render/**, public/locales/**                              ← front
  ★  server/src/services/aiAssessmentPartnerService.ts             ← Z14, zero LLM
     server/src/services/aiAssessmentReportGenerator.ts            ← Z14
     server/src/services/aiAssessmentFormHelper.ts                 ← Z14
  server/src/services/effectiveAccessService.ts                    ← Z16
  server/src/services/v8/artifactRegistryService.ts                ← Z16
  server/src/services/methodCore/**                                ← Z16, jądro współdzielone z Audits/SIRI
  server/src/Gateway.ts                                            ← §F nie potrzebuje montażu; router /api/method już stoi
  server/src/routes/assessment/**                                  ← inny tor (atrapy eksportu = znalezisko, nie naprawa)
  server/src/utils/pdfFonts.ts i trasy pdfkit                      ← zamknięte DEC-133/139
  server/src/services/deliverables/**                              ← ENABLE_DELIVERABLES_LIGHT, decyzja właściciela w toku
  server/src/services/v8/transformationFinalOutputService.ts       ← konsument renderera; MIERZYSZ, nie zmieniasz
  server/src/services/initiative/initiativeMaterializeService.ts   ← jw.
  server/src/routes/report-builder*.routes.ts                      ← jw. (w tym trasa PUBLICZNA)
  server/migrations/<istniejące pliki>                             ← TYLKO ODCZYT
  tests/e2e/**  ·  tests/acceptance/**                             ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  wszystko inne
```

**★★ RAMKA: WĄSKA LICENCJA NA `method-core.routes.ts`.** Ten plik jest w `Z16`
opisany jako jądro („trasa tylko przekazuje wynik serwisu"). **W tym dyżurze
otwieram go DOKŁADNIE na jedną rzecz: dopisanie JEDNEGO handlera `router.get`
bezpośrednio pod istniejącym handlerem `assessment-report-contract`, wraz
z jednym importem serwisu z §D.** Nic więcej: nie zmieniasz istniejących
handlerów, nie ruszasz `requireOrg`, `requireActor`, `requireIdempotencyKey`,
`sendAssessmentSkipReasonError`, nie zmieniasz montażu, nie refaktorujesz pliku,
nie przenosisz kodu. **To jest świadome rozszerzenie licencji przez nadzorcę,
nie Twoja interpretacja.** Diff tego pliku ma być **czytelny w całości w jednym
spojrzeniu** — jeśli nie jest, pozycja jest do odrzucenia.

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie jest**
praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, idziesz
dalej. Wyjątku nie ma nawet dla „jednej linii importu".

---

## 2. POZYCJE DYŻURU

**Kolejność jest wiążąca: §A → §B → §C → §D → §E → §F → §G → §R.**
Każda pozycja ma **definicję ukończenia** — dopóki wszystkie jej punkty nie są
spełnione **i udowodnione behawioralnie**, pozycja ma w raporcie status
`CZĘŚCIOWO` albo `NIE_ZACZĘTE`, **nigdy `ZROBIONE`**. Uczciwy `CZĘŚCIOWO`
z nazwaną przyczyną jest w tym programie oceniany wyżej niż zawyżone `ZROBIONE`
(`DEC-2026-08-27-149`).

---

### §A — Profil stylu „raport DRD" w arkuszu stylów (fundament)

**Cel:** silnik ma umieć nadać dokumentowi wygląd wzorca **wyłącznie przez style
nazwane**, bez dotykania sześciu istniejących konsumentów.

**A.1 — Odczyt wzorca i inwentaryzacja.** Wykonaj procedurę z §0.3 („Odczyt
wzorca"). Do raportu: **pełna lista `w:styleId` z `word/styles.xml` wzorca**
(oczekiwane ~22) oraz **liczba inline `rFonts` w `word/document.xml` wzorca**:

```bash
grep -o 'w:rFonts' x/word/document.xml | wc -l    # oczekiwane ~638
```

Ta liczba jest **wartością odniesienia** dla §G.3.

**A.2 — Profil.** Rozszerz `documentDocxStyles.ts` **addytywnie** o profil klasy
formatowania dla raportu DRD. Wymagania twarde:

1. **Nowe `styleId` dokładasz do `DOCX_STYLE_IDS`** — istniejących **nie
   zmieniasz ani nie zmieniasz ich nazw** (komentarz w pliku mówi wprost, że
   Word wiąże po nich outline/TOC/drzewo dostępności).
2. Profil pokrywa **dziewięć ról własnych wzorca** (§1.2 e): treść, treść
   wiodąca, nadtytuł sekcji, podpis elementu, wstęga sygnatury, TOC1, TOC2,
   nagłówek bez numeru, nagłówek sekcji bez spisu — plus mapowanie na
   istniejące `Heading1..3`.
3. **Paleta z §1.2 (b)** wchodzi jako nazwany zestaw obok `DOCX_PALETTE`;
   **`DOCX_PALETTE` zostaje nietknięta** (używa jej sześciu konsumentów).
4. **Fonty `Calibri` / `Calibri Light` ustawia SCHEMAT** (`formattingSchema`),
   nie domyślne wartości `resolveDocxFonts`. Domyślnych **nie ruszasz**.
5. Cała geometria strony z §1.2 (a) — jako wartości profilu, nie literały
   rozsiane po rendererze.

**A.3 — Dwa rozstrzygnięcia kolizji z kanonem (są w zakresie, nie improwizuj).**

| Kolizja | Stan dziś | Co robisz |
| --- | --- | --- |
| **Zebra w tabelach** | włączona bezwarunkowo (`rowIndex % 2 === 1`) | Zebra staje się **sterowalna profilem** i w profilu DRD jest **WYŁĄCZONA** (BRAND_EXPORT_CANON §6). **Dla wszystkich pozostałych profili zachowanie bez zmian** (dowód: §A.4) |
| **Nagłówek tabeli** | navy fill + biały pogrubiony tekst | W profilu DRD: **`FILL_HEAD` + tekst `NAVY_DARK` pogrubiony** (wzorzec). Poza profilem — bez zmian |

**Jeżeli okaże się, że któregokolwiek z tych zachowań nie da się usterowalnić
bez zmiany domyślnego wyniku dla cudzych konsumentów — STOP tej pozycji**, opis
w raporcie, `CZĘŚCIOWO`. **Nie „poprawiasz" wyglądu cudzych dokumentów przy
okazji.**

**A.4 — ★★ DOWÓD BITOWEJ NIEZMIENNOŚCI (bez tego cała pozycja jest odrzucona).**
Nowy test `server/src/services/documentStudio/__tests__/day32.rendererParity.test.ts`:

1. bierze **realny, nietrywialny** `DocumentSchema` (nagłówki + akapity + tabela
   z co najmniej 3 wierszami + lista + callout), **nieustawiający żadnego
   nowego pola**;
2. renderuje go `renderDocumentSchemaToDocxBuffer`;
3. rozpakowuje bufor i porównuje **`word/document.xml` + `word/styles.xml`**
   z zapisanym w teście wzorcem **wygenerowanym na kodzie z markera**
   (procedura: przed §A.2 uruchom generację i zapisz oba XML-e jako fixture
   testowy; `git add -f` jeśli lądują w `tests/`);
4. **asercja: identyczność.** Znormalizuj wyłącznie to, co z natury jest
   niedeterministyczne (identyfikatory relacji, znaczniki czasu) i **wypisz
   w komentarzu testu, co dokładnie znormalizowałeś i dlaczego** — normalizacja
   bez uzasadnienia jest sposobem na ukrycie regresji.

**Definicja ukończenia §A:**
- [ ] lista `styleId` wzorca i liczba inline `rFonts` wzorca w raporcie;
- [ ] profil DRD w arkuszu stylów, wszystkie 9 ról własnych + mapowanie H1–H3;
- [ ] `DOCX_STYLE_IDS` i `DOCX_PALETTE` rozszerzone, **nie zmienione**;
- [ ] zebra i nagłówek tabeli sterowalne profilem, w DRD wg kanonu;
- [ ] test §A.4 **zielony**, z opisaną normalizacją;
- [ ] `npx esbuild` czysty na obu dotkniętych plikach;
- [ ] w raporcie: `git diff --stat` tej pozycji.

---

### §B — Typografia polska na poziomie renderera

**Cel:** żadna sierota typograficzna nie ma prawa wyjść z silnika — niezależnie
od tego, kto i skąd poda tekst.

**B.1 — Miejsce.** Reguła twardej spacji wchodzi **w jednym punkcie**: tam, gdzie
renderer zamienia tekst na przebieg (`TextRun`). Wzorzec robił to podklasą
`TextRun` przechwytującą **każde** wywołanie (`build.cjs:29-40`) — to jest
właściwa myśl i masz ją przenieść. **Nie rozsiewasz `replace()` po miejscach
wywołania** — wtedy zawsze któreś zostanie pominięte, co jest dokładnie tym
defektem, który audyt wykrył we wzorcu przed poprawką.

**B.2 — Reguła.** Minimum wzorca: twarda spacja (`U+00A0`) po jednoliterowych
spójnikach i przyimkach `a i o u w z` (małe i wielkie), gdy stoją jako osobne
słowo. Regex referencyjny — §1.2 (k).

**★ Trzy pułapki, które masz obsłużyć świadomie:**
1. **Nie stosujesz reguły do tekstu, który nie jest polski.** Warunek:
   `schema.language` zaczyna się od `pl`. Dla `en-US` wstawienie `U+00A0` po
   angielskim „a" byłoby **defektem**.
2. **Nie stosujesz reguły dwa razy** — po `U+00A0` nie ma już spacji do
   zamiany, ale sprawdź to testem, nie założeniem.
3. **Nie stosujesz reguły w polach i kodach** — numery stron, `PAGE`/`NUMPAGES`,
   identyfikatory (`1A`), kody pominięć. Sposób: reguła działa na **treści
   tekstowej przebiegów**, nie na `instrText`.

**B.3 — Dowód behawioralny.** Test
`server/src/services/documentStudio/__tests__/day32.polishTypography.test.ts`:
- renderuje schemat `pl-PL` z akapitem zawierającym co najmniej cztery
  jednoliterowce w różnych pozycjach (początek zdania, środek, po przecinku,
  przed liczbą);
- **rozpakowuje `word/document.xml` i asertuje obecność `U+00A0`
  w oczekiwanych miejscach oraz jego BRAK po dwuliterowych wyrazach**;
- renderuje ten sam schemat z `en-US` i asertuje **zero `U+00A0`**;
- **osobna asercja diakrytyków**: `Zażółć gęślą jaźń` przechodzi przez renderer
  bez uszkodzenia (to jest bezpośrednie nawiązanie do `DEC-132` pkt 1, gdzie
  ten sam napis wychodził z tras PDF jako `ZaÏ1Brq¶Á ja¡D`; dla `.docx` z UTF-8
  to ma po prostu działać — **udowodnij, że działa, zamiast zakładać**).

**Definicja ukończenia §B:**
- [ ] reguła w **jednym** punkcie renderera, warunkowana językiem schematu;
- [ ] test §B.3 zielony, wszystkie cztery asercje;
- [ ] test §A.4 nadal zielony dla `en-US` (**brak wpływu na cudzych konsumentów**);
- [ ] w raporcie: fragment XML „przed/po" (dosłowny) dla jednego akapitu.

---

### §C — Radar bez pakietu biurowego

**Cel:** wykres, który we wzorcu powstawał przez `soffice --convert-to png`,
powstaje w silniku przez ścieżkę już obecną w repo.

**C.1 — Ustalenie wejściowe.** Potwierdź własnym pomiarem:
`documentChartRasterizer.ts` używa **`@napi-rs/canvas` + `chart.js/auto`**
(prebuilt binaria, bez `cairo`/`pango`, decyzja CTO: „lekki napi-rs zamiast
natywnego chartjs-node-canvas — ryzyko buildu Railway"). **`chart.js` obsługuje
typ `radar` natywnie.** To znaczy, że §C jest **mapowaniem**, nie budową silnika
wykresów. Jeżeli Twój pomiar temu przeczy — **STOP**, opis, `CZĘŚCIOWO`.

**C.2 — Zmiana.** Dokładasz **dokładnie jedną** wartość `'radar'` do
`DocumentChartKind` i jej obsługę w rasteryzatorze. Wymagania z kanonu
(BRAND_EXPORT_CANON §7 + §1.2 h):
- **dwie serie**: „Poziom obecny" (navy, wypełnienie ~17%) i „Poziom docelowy"
  (teal, wypełnienie ~10%), obie z widocznymi punktami;
- **skala 0–100%** (wartości to procenty skali własnej osi — §1.4 poz. 16),
  pierścienie co 20%;
- **zero gradientów, zero cieni, zero 3D, zero crimson**;
- legenda **pod wykresem**, czytelna, bez ramki;
- etykiety osi z `axis.namePL`; jeżeli etykieta jest długa — **łamiesz ją**,
  nie skracasz w połowie wyrazu (realny defekt wykryty we wzorcu: „Średniozaawansowa
  | ny").

**★ Czego NIE robisz:** nie budujesz SVG i nie szukasz rasteryzatora SVG. Wzorzec
robił SVG **tylko dlatego**, że nie miał `chart.js`. Ty masz.

**C.3 — Dowód.** Test
`server/src/services/documentStudio/__tests__/day32.radarChart.test.ts`
w konwencji już obecnej w repo (`__setChartCanvasCtorForTest`):
- konfiguracja przekazana do `chart.js` ma `type: 'radar'`, dwie serie,
  siedem etykiet, skalę `0–100`;
- **osobny przebieg BEZ wstrzykniętego ctora** (ścieżka produkcyjna
  `@napi-rs/canvas`) produkujący **realne bajty PNG** — asercja na sygnaturze
  PNG i na niezerowym rozmiarze. **To jest wymóg Z21**: test wyłącznie
  z atrapą nie dowodzi, że radar w ogóle się rysuje na Railway;
- **asercja negatywna: w całym `documentStudio/**` nie pada ani razu `soffice`,
  `libreoffice`, `puppeteer`, `pdftoppm`, `pdfinfo`, `pdftotext`** — grep
  w teście albo w raporcie, do wyboru, ale **wynik obowiązkowy**.

**Definicja ukończenia §C:**
- [ ] `'radar'` w `DocumentChartKind` + obsługa w rasteryzatorze;
- [ ] paleta i geometria wg kanonu, siedem etykiet z `namePL`;
- [ ] test §C.3 zielony, w tym przebieg produkcyjny z realnym PNG;
- [ ] dowód braku zależności od pakietu biurowego (grep w raporcie);
- [ ] test §A.4 nadal zielony.

---

### §D — Serwis mapujący: kontrakt raportu → `DocumentSchema` (SERCE DYŻURU)

**Nowy plik:**
`server/src/services/assessment/assessmentDrdReportSchemaService.ts`.

**Kontrakt funkcji:** wejście = obiekt zwrócony przez
`assessmentReportContractService.build(...)` (**nie** organizacja i sesja —
serwis mapujący **nie chodzi do bazy sam**; chodzenie do bazy to zadanie serwisu
kontraktu). Wyjście = `DocumentSchema` gotowy dla
`renderDocumentSchemaToDocxBuffer`. **Funkcja czysta: bez I/O, bez daty
systemowej, bez losowości.** Ta czystość jest wymogiem, nie stylem — dzięki niej
§G może porównać dwa wywołania i udowodnić determinizm.

**D.1 — Weryfikacja tabeli pokrycia z §1.4.** **Zanim napiszesz mapowanie**,
potwierdź własnym odczytem kontraktu, ile pól złotego pliku ma realne pokrycie.
Do raportu wchodzi **Twoja wersja tabeli §1.4** z kolumną „potwierdzone /
obalone / doprecyzowane". **Rozbieżność wobec §1.4 nie jest błędem — jest
wynikiem.** Zawyżenie („to też da się wyliczyć") wykryte przy odbiorze **jest**
błędem.

**D.2 — Mapowanie deterministyczne (część „DANE").** Wszystko z §1.4 oznaczone
`DANE`/`STAŁA`, w strukturze z §1.2 (d). Wymagane mapy — **jako nazwane stałe
w jednym miejscu pliku**, nie rozsiane po kodzie:

```
evidenceState → PL:   evidenced → „udokumentowane"
                      incomplete → „niepełne"
                      declared → „zadeklarowane"
                      not_assessed → „nieocenione"
gap → priorytet:      >=3 → „Krytyczny" (crimson) · 2 → „Wysoki" · 1 → „Średni" · 0 → „Utrzymanie"
poziom → procent:     średnia poziomów obszarów ocenionych / maxLevel
```

**★ Cztery pułapki obliczeniowe, które MUSISZ obsłużyć jawnie** (każda ma być
pokryta osobnym testem — to są dokładnie te miejsca, w których silnik zaczyna
kłamać):

1. **`currentLevel` albo `targetLevel` = `null`** (obszar nieoceniony).
   Nie liczysz go do średniej, nie traktujesz jako zera, **nie pomijasz go
   w matrycy** — wiersz zostaje, komórki poziomów są puste, luka to `—`.
   Zero w miejscu braku danych to najstarszy sposób, w jaki raport kłamie.
2. **Oś, w której ZERO obszarów ma poziomy** — średnia jest niezdefiniowana.
   Radar dostaje **brak punktu na tej osi** (nie zero!), tabela zbiorcza `—`,
   a rozdział jawnie mówi, że oś nie została oceniona.
3. **Obszar pominięty** (`skipped: true`) — nie wchodzi do średnich, **wchodzi
   do matrycy** z adnotacją kodu pominięcia (§1.5).
4. **Pominięcie częściowe** (`skipped: false`, ale `skips[]` niepuste) —
   obszar liczy się normalnie, ale komentarz obszaru **wymienia pominięte
   pytania**. Ta rozróżnialność została specjalnie zbudowana w dniu 20
   (poprawka `FIX-2 (P1-2)` w serwisie kontraktu: *„skip decisions are
   per-question, never per-area"*) i **zgubienie jej w dokumencie zmarnowałoby
   tamtą pracę**.

**D.3 — Sekcje bez pokrycia (część „BRAK") — rozstrzygnięcie.**

| Element | Co robisz |
| --- | --- |
| Wstęp rozdziału, podpis matrycy, komentarz obszaru, wnioski rozdziału, 4 wiersze linii decyzyjnej | **Struktura zostaje, treść = placeholder z §1.5** z realnymi limitami słów z kontraktu (`minWords`/`maxWords` — **czytasz je z kontraktu, nie wpisujesz z pamięci**) |
| **Streszczenie zarządcze** (poz. 34) | **Sekcja zostaje w dokumencie**, bo bez niej struktura wzorca się rozpada, ale jej treść to **placeholder**. **Radar i tabela zbiorcza — które są DANYMI — zostają w niej normalnie.** Czyli: sekcja z realnym wykresem, realną tabelą i jawnie pustą narracją |
| **Wnioski końcowe + linia decyzyjna programu** (poz. 35) | **Tak samo.** Tabela linii decyzyjnej zostaje ze wszystkimi czterema wierszami i placeholderem w każdym |
| **Załącznik A** | **W całości z danych** — bez placeholderów |

**★ NIE dopisujesz slotów do `assessmentReportContractService.ts`** (streszczenie
zarządcze, wnioski końcowe). Kontrakt jest odebrany i front dnia 27 na nim stoi;
`contractVersion` ma zostać nietknięty. Brak tych slotów to **znalezisko
raportowe z propozycją** („kontrakt v1 nie przewiduje rozdziału 0 i 8; wzorzec je
ma; propozycja rozszerzenia do v2 w osobnym dyżurze"), a nie zmiana w tym
dyżurze.

**D.4 — Spis treści bez pakietu biurowego — rozstrzygnięcie.**

Renderer ma dziś **statyczny spis bez numerów stron**, i to jest **świadoma
decyzja autora**, nie brak. Robisz **jedno, addytywne** rozszerzenie:

- opcjonalne pole w `formattingSchema.tocConfig` (nazwa w rodzaju
  `nativeField`), **domyślnie nieustawione** — brak pola = zachowanie dzisiejsze
  bit w bit (dowód: §A.4);
- gdy ustawione: renderer emituje **natywne pole Worda `TableOfContents`**
  (poziomy 1–2, hiperłącza) **plus** `features.updateFields = true`
  w `Document`. Word wypełni numery stron przy otwarciu; **serwer ich nie liczy
  i nie udaje, że zna**;
- schemat raportu DRD z §D.2 to pole ustawia.

**★★ TO JEST NAZWANA RÓŻNICA PARYTETU I MASZ JĄ NAPISAĆ WPROST W RAPORCIE:**
złoty plik ma numery stron **wpisane** (zmierzone LibreOffice'em), silnik ma
**pole natywne wypełniane przez Worda**. Konsekwencja praktyczna, którą też
zapisujesz: **konwersja `.docx → PDF` narzędziem, które nie aktualizuje pól,
pokaże spis bez numerów.** To jest cena za brak LibreOffice na serwerze i
**decyzję o tej cenie podjął nadzorca, nie Ty** — Twoim obowiązkiem jest ją
uczciwie odnotować, a nie „rozwiązać" instalując pakiet biurowy.

**D.5 — Testy §D** (`server/src/services/assessment/__tests__/day32.drdSchema.test.ts`) —
**wszystkie behawioralne, na wyprodukowanym schemacie i na rozpakowanym `.docx`**:

1. struktura: okładka → TOC → streszczenie → **7 rozdziałów** → wnioski końcowe →
   załącznik A (kolejność i komplet);
2. każdy rozdział ma podsekcje w kolejności wzorca (wstęp → matryca → ocena
   obszarów → wnioski → linia decyzyjna);
3. cztery pułapki z §D.2 — **osobny test na każdą**;
4. placeholder pojawia się **dokładnie tam, gdzie `content === null`**, i
   **nigdzie indziej** (asercja obustronna — samo „jest placeholder" nie
   wystarcza; trzeba udowodnić, że nie zjadł treści, która była);
5. **asercja antyzmyśleniowa**: żaden ciąg dłuższy niż ~40 znaków w wyjściu nie
   pochodzi spoza {kontrakt, `drdStructure`, lista stałych zadeklarowanych
   w serwisie}. Zrealizuj to jak chcesz (np. rejestr stałych + asercja na
   pokrycie), ale **zrealizuj** — to jest bezpiecznik przed najgorszym możliwym
   defektem tego dyżuru (Z15);
6. **determinizm**: dwa wywołania z tym samym wejściem dają identyczny schemat.

**Definicja ukończenia §D:**
- [ ] nowy plik, funkcja czysta, zero I/O, zero `Date.now()`;
- [ ] Twoja wersja tabeli §1.4 w raporcie (potwierdzone/obalone/doprecyzowane);
- [ ] pełna struktura wzorca odtworzona (§1.2 d);
- [ ] mapy PL jako nazwane stałe w jednym miejscu;
- [ ] cztery pułapki obliczeniowe pokryte osobnymi testami;
- [ ] placeholdery **wyłącznie** tam, gdzie brak danych — asercja obustronna;
- [ ] asercja antyzmyśleniowa zielona;
- [ ] `contractVersion` **nietknięty**, `assessmentReportContractService.ts`
      **bez zmian** (dowód: pusty diff pliku);
- [ ] pole `tocConfig.nativeField` addytywne, domyślnie nieaktywne;
- [ ] różnica parytetu spisu treści opisana wprost.

---

### §E — Polskie etykiety skali poziomów

**Cel:** zamknąć **jedyną realną** dziurę polskiej warstwy struktury DRD (§1.4
poz. 26) — i zamknąć ją **wąsko**, bez tłumaczenia 233 opisów.

**E.1 — POMIAR PRZED DECYZJĄ (obowiązkowy, i to on wyznacza zakres).**
Wzorzec używał **jednej skali na oś** (`A1` 7 etykiet, `A2` 5, `A3` 5),
a `drdStructure` trzyma `levels[]` **per obszar**. Zmierz, czy tytuły poziomów
są **jednakowe dla wszystkich obszarów w obrębie osi**:

```bash
npx tsx -e "
const m = require('./server/src/data/drdStructure.ts');
" 2>/dev/null || true
# jeżeli import TS jest kłopotliwy, zrób to tekstowo — ważny jest WYNIK, nie metoda:
#   dla każdej osi zbierz listę level.title po kolei w obrębie każdego obszaru
#   i porównaj listy między obszarami tej samej osi
```

| Wynik pomiaru | Co robisz |
| --- | --- |
| **Tytuły poziomów są jednakowe w obrębie osi** (spodziewane dla osi 1 — obszar `1A` ma `Basic Data Registration / Workstation Control / Process Control / Automation / …`, co odpowiada wzorcowej skali `Rejestracja danych / Kontrola stanowiska / Kontrola procesu / Automatyzacja / …`) | Dodajesz **`levelLabelsPL: string[]` na osi** (`DRDAxis`), długości `levelCount`. **Siedem tablic, razem ~41 napisów.** Zakres skończony i sprawdzalny |
| **Tytuły różnią się między obszarami tej samej osi** | **STOP tej pozycji.** **Nie wymyślasz uśrednionej skali.** Zamiast tego: dodajesz opcjonalne `titlePL` do `DRDLevel` (**bez wypełniania**), silnik czyta `titlePL ?? title`, a różnicę i wielkość pracy opisujesz w raporcie jako pozycję backlogu. Dokument pokaże wtedy etykietę angielską — **brzydko, ale uczciwie** |
| **Wynik mieszany** (część osi jednorodna, część nie) | Wypełniasz **tylko osie jednorodne**, resztę zostawiasz na `title`. Wypisujesz w raporcie, które osie są w którym stanie |

**E.2 — Zasada nadrzędna.** Zmiana w `drdStructure.ts` jest **wyłącznie
addytywna**: **nie dotykasz `id`, `name`, `namePL`, `levelCount`,
`levels[].level`, `levels[].title`, `levels[].description`.** `drdStructure`
i kanon 7 osi zostały odebrane (`DEC-122`) i są czytane przez inne moduły —
**zmiana istniejącego pola = STOP**.

**E.3 — Konsumpcja.** Serwis z §D czyta etykietę przez jeden helper
(`levelLabelsPL[n-1] ?? levels[n-1].titlePL ?? levels[n-1].title`) i używa jej
w matrycy, we wstędze „Sygnatura" i w rejestrze luk. **Fallback jest widoczny
w raporcie, nie ukryty** — jeżeli dokument dla którejś osi pokazuje etykiety
angielskie, ma to być wypisane.

**E.4 — Dowód.** Test `day32.drdLevels.test.ts`: dla każdej osi z wypełnionymi
etykietami — długość tablicy `=== levelCount`, brak pustych napisów, brak
duplikatów **w obrębie osi**; dla osi bez etykiet — helper zwraca `title`
i **nie rzuca**.

**Definicja ukończenia §E:**
- [ ] pomiar E.1 wykonany, wynik (jednorodne / nie / mieszane) w raporcie;
- [ ] zmiana **wyłącznie addytywna**, `git diff` pokazuje same dodania;
- [ ] helper z jawnym fallbackiem, użyty w trzech miejscach dokumentu;
- [ ] test E.4 zielony;
- [ ] **zero migracji** (etykiety to kanon metodyki w kodzie, nie dane tenanta).

---

### §F — Trasa: raport DRD jako plik `.docx`

**F.1 — Kształt.** Jeden handler w `method-core.routes.ts`, **bezpośrednio pod**
istniejącym `assessment-report-contract`:

```
GET /api/method/sessions/:sessionId/assessment-report.docx?outputId=<opcjonalny>
```

- organizacja **wyłącznie z JWT** (`requireOrg`) — **nigdy z query, nigdy
  z body**; próba wstrzyknięcia `?organizationId=` ma być bez skutku;
- `outputId` opcjonalny, semantyka identyczna jak w trasie kontraktu (rewizja);
- obsługa błędów **przez ten sam `sendAssessmentSkipReasonError`** — czyli
  sesja nieistniejąca **i** sesja cudzego tenanta dają **identyczne `404`**
  (`SESSION_NOT_FOUND`), bez wycieku informacji o istnieniu;
- odpowiedź `200`:
  `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`,
  `Content-Disposition: attachment; filename="..."` — **nazwa pliku
  zsanityzowana** (bez ukośników, cudzysłowów, znaków spoza zakresu; nazwa
  z `sessionLabel.displayName` bywa dowolnym napisem od użytkownika),
  `Content-Length` ustawiony;
- **zero zapisu do bazy** — trasa jest czysto odczytowa; **nie tworzysz wpisu
  audytu, nie bumpujesz rewizji, nie materializujesz artefaktu.** Gdyby to
  było potrzebne — jest to osobna decyzja, nie efekt uboczny pobrania pliku.

**F.2 — Czego NIE robisz.** Nie dodajesz drugiej trasy (`/preview`, `/pdf`,
`.pptx`), nie zmieniasz montażu w `Gateway.ts`, nie dotykasz istniejącego
handlera kontraktu, nie ruszasz `routes/index.ts` (martwy barrel, `DEC-137`).

**F.3 — Nazwa pliku.** Deterministyczna, czytelna dla klienta, **bez danych
osobowych**, w rodzaju
`Raport_DRD_<zsanityzowana-nazwa-lub-sesja>_<RRRRMMDD>.docx`. Jeżeli
`displayName` jest `null` — **nie zgadujesz nazwy**, używasz identyfikatora sesji.

**F.4 — Dowód (Z20 + Z21) — na realnym PG, realnym routerze i realnym JWT.**
`tests/integration/routes/assessment.day32.reportDocx.postgres.integration.test.ts`
(`git add -f`), wzorowany na `assessmentAiPartner.day25.pg.test.ts`, montujący
**oba** middleware w kolejności produkcyjnej:

1. **sesja z danymi** → `200`, poprawny `Content-Type`, `Content-Disposition`,
   bufor zaczynający się od sygnatury ZIP (`PK`), rozpakowywalny, zawierający
   `word/document.xml` i `word/styles.xml`;
2. **sesja cudzego tenanta** → `404`, **treść odpowiedzi identyczna** jak dla
   sesji nieistniejącej (asercja porównawcza obu odpowiedzi, nie dwie osobne);
3. **`?organizationId=<obcy>`** → wynik identyczny jak bez parametru
   (parametr ignorowany);
4. **brak/zły JWT** → `401`;
5. **sesja istniejąca, ale bez ani jednego wyniku** → **`200` z uczciwie pustym
   raportem** (struktura + placeholdery), **nie `404` i nie `500`**. To jest
   `Z15` w wersji trasowej: uczciwie pusty raport > brak raportu > raport
   udawany;
6. **`?outputId=<z innej sesji>`** → `404` (`REPORT_REVISION_NOT_FOUND`).

**F.5 — Kontrakt dla frontu (do raportu, NIE do kodu).** W raporcie podajesz
gotowy do wklejenia opis dla dyżuru frontowego: metoda, URL, parametry, kody
odpowiedzi, nagłówki, nazwa pliku, zachowanie przy pustym raporcie, sposób
pobrania w przeglądarce **oraz** wskazanie, że przycisk ma stanąć **za flagą
domyślnie OFF** i wejść na demo dopiero po akcepcie właściciela na zrzucie
(CLAUDE.md reguły 7 i 9).

**Definicja ukończenia §F:**
- [ ] **dokładnie jeden** nowy handler, diff pliku czytelny w jednym spojrzeniu;
- [ ] org wyłącznie z JWT; obcy tenant i brak sesji nieodróżnialne;
- [ ] nagłówki + sanityzacja nazwy pliku;
- [ ] zero zapisu do bazy (dowód: `SELECT count(*)` na tabelach dotykanych, przed i po);
- [ ] sześć scenariuszy §F.4 **zielonych na realnym PG**;
- [ ] ścieżka osiągalności Z20 wypisana w raporcie **z numerami linii**;
- [ ] kontrakt dla frontu §F.5 w raporcie.

---

### §G — DOWÓD KOŃCOWY: plik dla INNEJ organizacji + tabela parytetu

**To jest pozycja, dla której cały dyżur istnieje.** Bez niej reszta jest kodem
bez dowodu.

**G.1 — Druga organizacja, drugi klient, zero Metalpolu.**
W teście (`day32.secondTenant`) zasiej na własnym PG **dwie** organizacje
i w każdej po jednej sesji DRD z **różnymi** wynikami. Wymagania:

- **żadna z nich nie jest Metalpolem** i żadna nie powtarza jego liczb —
  ma być widać, że dokument idzie za danymi, a nie za wzorcem;
- **co najmniej jeden obszar nieoceniony** (`currentLevel = null`);
- **co najmniej jedno pominięcie pełne i jedno częściowe** (§D.2 pułapki 3–4);
- **co najmniej jedna oś bez ani jednego wyniku** (pułapka 2);
- **co najmniej jedna luka krytyczna** (`gap >= 3`) — żeby crimson i „Krytyczny"
  miały się na czym pokazać;
- **polskie znaki w nazwie projektu** (np. `Zakład Wtryskowni Ćmielów`) —
  przechodzą przez nazwę pliku, okładkę i stopkę.

**Dane demo = twarz produktu (CLAUDE.md): seed żyje w kontenerze tego dyżuru,
sprząta po sobie i nie dotyka żadnej innej bazy.**

**G.2 — Artefakty dowodowe.** Zapisz do
`docs/program/waves/WAVE_03_ACCEPTANCE/evidence/document-engine-day32-20260828/`:

- **`raport-drd-org-a.docx`** — plik wygenerowany przez **realną trasę** z §F
  (nie przez wywołanie serwisu w teście!) dla pierwszej organizacji;
- **`raport-drd-org-b.docx`** — to samo dla drugiej;
- **`parytet.md`** — tabela z §G.3;
- **`document.xml.txt`** — wyciąg strukturalny z pierwszego pliku (lista
  nagłówków w kolejności + użyte `styleId` + liczba tabel), tak żeby odbiorca
  mógł sprawdzić strukturę **bez otwierania Worda**.

**★ Rozmiar plików trzymaj w ryzach** (radar to PNG). Jeżeli którykolwiek
przekracza ~2 MB — zamiast pliku wstaw jego wyciąg i **napisz, dlaczego**.

**G.3 — TABELA PARYTETU wobec złotego pliku.** Cztery obszary, każdy wiersz
z werdyktem `PARYTET / RÓŻNICA ŚWIADOMA / LUKA / NIEMIERZALNE` **i uzasadnieniem**:

| Obszar | Co mierzysz | Jak |
| --- | --- | --- |
| **Struktura** | obecność i kolejność: okładka · TOC · streszczenie · 7 rozdziałów · wnioski końcowe · załącznik A; wewnątrz rozdziału: wstęp · matryca · ocena obszarów · wnioski · linia decyzyjna | lista nagłówków z `word/document.xml` obu plików, obok siebie |
| **Style** | liczba `w:styleId` w `styles.xml`; **liczba inline `w:rFonts` w `document.xml`** (wzorzec ~638 — Twoja ma być **radykalnie niższa**, i podajesz obie liczby); zgodność palety i krojów | `grep -o ... \| wc -l` na obu plikach |
| **Paginacja** | **NIEMIERZALNE W TYM DYŻURZE** — pomiar wymagałby renderu PDF, czyli LibreOffice (★ ograniczenie krytyczne pkt 3) | Wpisujesz `NIEMIERZALNE` **z podaniem przyczyny i skutku dla użytkownika** (§D.4). **Nie instalujesz pakietu biurowego, żeby wypełnić tę kratkę** — to byłoby złamanie zakazu dla ozdoby w tabeli |
| **Diakrytyki** | `ą ć ę ł ń ó ś ź ż` + `Ą Ć Ę Ł Ń Ó Ś Ź Ż` w treści, w nagłówkach, **w stopce**, **w nazwie pliku**; twarde spacje po jednoliterowcach; **brak** twardych spacji w wersji `en-US` | odczyt `document.xml`/`footer*.xml` + nagłówek `Content-Disposition` |

**Dodatkowo dwa wiersze, których wzorzec nie ma i które są przewagą silnika:**

| Obszar | Werdykt |
| --- | --- |
| **Uczciwość pustych sekcji** | Ile sekcji narracyjnych dostało placeholder, ile treść — liczby z obu wygenerowanych plików |
| **Widoczność pominięć** | Czy pominięcia pełne i częściowe są w dokumencie widoczne z kodem — cytat z `document.xml` |

**G.4 — Pomiar wyjściowy (Z23).** Powtórz **dokładnie** przebieg z §0.4 pkt 3.
Do raportu: `PRZED` / `PO` / **delta**, z rozbiciem **ZASTANE / WPROWADZONE**
i liczbą **SKIPPED**. **Każdy nowy FAIL wymaga imiennego wyjaśnienia**; nowy FAIL
w którymkolwiek z sześciu konsumentów renderera (§1.3) to **STOP i cofnięcie
zmiany**, nie „do naprawy w kolejnym dyżurze".

**Definicja ukończenia §G:**
- [ ] dwa pliki `.docx` dla **dwóch różnych, niemetalpolowych** organizacji,
      wygenerowane **przez trasę**;
- [ ] wszystkie sześć warunków danych z §G.1 obecnych i **widocznych w pliku**;
- [ ] `parytet.md` z czterema obszarami + dwoma wierszami przewagi, każdy
      z werdyktem i uzasadnieniem;
- [ ] liczba inline `rFonts` podana dla wzorca i dla obu Twoich plików;
- [ ] pomiar wyjściowy pełnego zakresu, delta wyjaśniona co do testu;
- [ ] `docker rm -fv cx-day32-pg` wykonane i odnotowane.

---

### §R.1 — `MODULE_ACCEPTANCE.md` modułu Ocena

W `docs/program/waves/WAVE_03_ACCEPTANCE/modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`
podnieś stan **wyłącznie o to, co realnie dowiozłeś**, i **wyłącznie w sekcjach
dotyczących eksportu/raportu**. Zakazy: nie reformatujesz pliku (dzień 17 dostał
za to uwagę — 55 przeformatowanych linii zaszumiło governance), nie zmieniasz
cudzych wierszy, nie podnosisz statusów pozycji, których nie dotknąłeś.
**Jeżeli którakolwiek pozycja wyszła `CZĘŚCIOWO` — wpisujesz `CZĘŚCIOWO`.**

### §R.2 — Raport dyżuru

**Dokładnie jeden plik:**
`docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_DAY32_REPORT_20260828.md`,
wg szablonu z §3.

---

## 3. RAPORT — szablon obowiązkowy

Plik: `docs/program/waves/WAVE_03_ACCEPTANCE/DOCUMENT_ENGINE_DAY32_REPORT_20260828.md`.
Sekcje w tej kolejności, żadnej nie pomijasz (pusta sekcja = napis „brak", nie
usunięcie nagłówka).

```markdown
# Dyżur 32 — silnik dokumentu: raport DRD z bazy — raport

## 0. Wiązanie i środowisko
- SHA markera (dosłownie to, co stało w instrukcji): ...
- MARKER OK / MARKER BRAK: ... (wynik komendy)
- Rozejście markera wobec tipa (git log + lista plików) albo „brak rozejścia"
- Gałąź własna, worktree, komenda bazowa `git diff --name-only <SHA>...HEAD` (dosłownie)
- Gałąź złotego pliku: wynik `git log -3` + `git ls-tree` + GOLDEN MERGED/NOT MERGED
- Kontener PG: nazwa, PORT (jawnie), dowód celu połączenia (dosłowny wynik), `docker port`
- Migracje na pustej bazie: liczba zastosowanych, błędy
- Sprzątanie: `docker rm -fv cx-day32-pg` — wykonane / nie (jeśli nie: dlaczego)

## 1. Weryfikacja stanu wejściowego (§0.1 pkt 5)
Tabela: komenda | oczekiwane | zmierzone | zgodne?

## 2. Pomiar PRZED (pełny zakres §0.4 pkt 3, bez zawężania)
- suma PASS / FAIL / SKIPPED
- lista czerwonych ZASTANYCH — imiennie, plik po pliku

## 3. ★ TABELA POKRYCIA — co silnik wypełnia z danych, a czego nie (§D.1)
37 wierszy z §1.4 + kolumna „potwierdzone / obalone / doprecyzowane" + komentarz.
Na końcu: podsumowanie ilościowe (DANE / STAŁA / CZĘŚCIOWO / BRAK).

## 4. Pozycje
Dla KAŻDEJ z §A, §B, §C, §D, §E, §F, §G:
- status: ZROBIONE_WG_DoD / CZĘŚCIOWO / NIE_ZACZĘTE / STOP
- co zrobione, plik:linia
- definicja ukończenia — odhaczona punkt po punkcie (albo wskazany brak)
- dowód behawioralny: nazwa testu + wynik + fragment asercji
- ★ ŚCIEŻKA OSIĄGALNOŚCI Z20 (dla §F obowiązkowo pełna, z numerami linii)

## 5. Parytet wobec złotego pliku (§G.3)
Cztery obszary + dwa wiersze przewagi. Każdy wiersz: werdykt + uzasadnienie.
Osobno wypisane: liczba inline rFonts we wzorcu i w obu wygenerowanych plikach.

## 6. Nazwane RÓŻNICE ŚWIADOME (nie luki)
Minimum: (a) spis treści — pole natywne zamiast wpisanych numerów, ze skutkiem
dla konwersji PDF; (b) rasteryzacja radaru przez @napi-rs/canvas zamiast
LibreOffice; (c) proza narracyjna zastąpiona placeholderami.
Każda różnica: czym jest, dlaczego, jaki ma skutek dla klienta końcowego.

## 7. Pomiar PO (pełny zakres, bez zawężania)
- suma PASS / FAIL / SKIPPED
- delta wobec PRZED, rozbicie ZASTANE / WPROWADZONE
- każdy nowy FAIL — imienne wyjaśnienie
- osobne potwierdzenie: sześciu konsumentów renderera bez nowych FAIL

## 8. Artefakty dowodowe
Ścieżki, rozmiary, jak powstały (przez trasę czy przez serwis — musi być: przez trasę).

## 9. Korekty wobec instrukcji
Każde miejsce, w którym instrukcja rozminęła się z repo. To nie jest krytyka —
to jest wymóg. Instrukcja bez korekt po dyżurze jest podejrzana.

## 10. Znaleziska poza zakresem
Atrapy eksportu Assessment, brak slotów rozdziału 0 i 8 w kontrakcie v1,
uwaga 1B właściciela z DEC-151, koszt tłumaczenia 233 opisów poziomów,
cokolwiek jeszcze zobaczysz. Bez naprawiania.

## 11. Twierdzenia NIEZWERYFIKOWANE
Wszystko, co napisałeś, a czego nie zmierzyłeś. Pusta sekcja jest dozwolona
TYLKO wtedy, gdy naprawdę wszystko zmierzyłeś — i wtedy też to napisz.

## 12. Kontrakt trasy dla dyżuru frontowego (§F.5)
Gotowy do wklejenia.

## 13. Commity
Lista SHA + tytuł, jeden na pozycję.
```

---

## 4. ZASADY ROZSTRZYGANIA WĄTPLIWOŚCI

1. **STOP zamiast zgadywania — zawsze.** Jeżeli instrukcja czegoś nie
   przewidziała, a Ty musisz podjąć decyzję o kształcie produktu (nazwa klienta,
   brzmienie placeholdera, dodatkowa sekcja, dodatkowe pole kontraktu, migracja)
   — **zatrzymujesz pozycję, opisujesz w raporcie, idziesz do następnej.**
   Dyżur z uczciwym STOP-em jest odbierany; dyżur ze zgadniętym rozwiązaniem
   jest odrzucany i cofany.
2. **Kolejność źródeł prawdy:** (a) ten dokument → (b) `OWNER_DECISION_LEDGER_2026-08-24.md`
   → (c) `docs/ui-standards/00-foundation/BRAND_EXPORT_CANON.md` → (d) złoty plik
   → (e) kod w repo. **Sprzeczność między (d) a (e) rozstrzygasz na korzyść (e)
   i opisujesz** — złoty plik jest wzorcem wyglądu, nie wzorcem implementacji.
3. **Uczciwy `CZĘŚCIOWO` > zawyżone `ZROBIONE`.** `DEC-2026-08-27-149` pochwalił
   dyżur, który dowiózł część zakresu i **napisał to wprost**. To jest wzorzec
   raportowania w tym programie.
4. **„Testy przeszły" ≠ „działa"** (CLAUDE.md, złota reguła 1). Weryfikujesz
   **realny runtime**: realny router, realny JWT, realny PG, realne bajty pliku.
5. **Nie ratujesz wyniku zmianą warunków.** Nie włączasz flagi, nie podnosisz
   uprawnień, nie wyłączasz middleware, nie normalizujesz asercji „żeby przeszła",
   nie instalujesz pakietu biurowego, nie wołasz modelu. Jeżeli pomiar wychodzi
   czerwony — **czerwony wynik jest wynikiem**.

---

## 5. BRIEF WYNIKOWY (to oddajesz nadzorcy — krótko, na końcu raportu)

```
DYŻUR 32 — SILNIK DOKUMENTU (raport DRD z bazy)

Marker:            <SHA> — MARKER OK/BRAK
Gałąź:             codex/document-engine-day32-<data>
PG:                cx-day32-pg, port <PORT>, migracje <N>, posprzątane TAK/NIE
Migracje własne:   <ile> (spodziewane: 0) — numery z przedziału 20261210-19

Pozycje:           A <status> · B <status> · C <status> · D <status>
                   E <status> · F <status> · G <status> · R.1 <status>

Testy:             PRZED <P/F/S>  →  PO <P/F/S>   (nowe FAIL: <ile> — <jakie>)
Sześciu konsumentów renderera:  bez nowych FAIL TAK/NIE

DOWÓD KOŃCOWY:     plik .docx dla <org A> i <org B> — wygenerowane PRZEZ TRASĘ TAK/NIE
                   ścieżka: docs/.../evidence/document-engine-day32-20260828/

PARYTET:           struktura <werdykt> · style <werdykt> ·
                   paginacja NIEMIERZALNE (brak renderera — świadome) ·
                   diakrytyki <werdykt>
                   inline rFonts:  wzorzec <N> → silnik <M>

POKRYCIE DANYMI:   z danych/stałe <ile>/37 · częściowe <ile> · placeholdery <ile>
Zero LLM:          TAK/NIE          Zero LibreOffice w kodzie serwerowym:  TAK/NIE
Zero zmian w src/: TAK/NIE          contractVersion nietknięty:            TAK/NIE

STOP-y:            <lista albo „brak">
Niezweryfikowane:  <lista albo „brak">
Do decyzji nadzorcy: <lista albo „brak">
```

---

## 6. JEDNO ZDANIE NA KONIEC

Właściciel usłyszał 28 sierpnia, że **da się** zrobić dobry dokument. Ten dyżur
ma pokazać, że da się go zrobić **bez człowieka piszącego prozę** — dla każdego
klienta, z tego, co naprawdę leży w bazie. **Dokument, który uczciwie mówi
„tej sekcji jeszcze nie ma", jest dowodem, że silnik działa. Dokument, który
w to miejsce wstawia ładne zdanie, jest dowodem, że silnik kłamie — i cofa
program o miesiące.**
