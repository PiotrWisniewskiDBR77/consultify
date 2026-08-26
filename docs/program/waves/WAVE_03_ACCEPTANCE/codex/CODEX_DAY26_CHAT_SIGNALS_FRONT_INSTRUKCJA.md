# INSTRUKCJA DYŻURU nr 26 — Codex — „Chat: FRONT feedu sygnałów — ekran listowy na StandardTable, podgląd wg kanonu, realne akcje, uczciwe stany puste, wszystko za jedną flagą OFF"

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–25. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-26.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

**★ TEN DYŻUR JEST WYJĄTKIEM.** Wszystkie poprzednie dyżury Codexa były
**tylne** (`server/src`, migracje, testy) i miały twardy zakaz dotykania `src/`.
Ten dyżur jest **FRONTOWY** — na wyraźną dyrektywę ekonomiczną właściciela
(front feedu miał iść „wewnętrznie", `DEC-2026-08-26-89`; właściciel przesunął
go do Codexa, żeby oszczędzić budżet modeli droższych). Wyjątek jest
**warunkowy** i warunki są trzy:

1. **całość za JEDNĄ flagą, domyślnie OFF, fail-closed** — po Twoim dyżurze
   aplikacja przy domyślnych ustawieniach wygląda i działa **bajt w bajt jak
   dziś**;
2. **budujesz wg gotowego kontraktu DTO**, który już istnieje i jest scalony —
   niczego w nim nie wymyślasz (jedna wąska licencja, §1.6);
3. **wewnętrzny polish-pass nadzorcy PRZED pokazaniem właścicielowi** — Twoje
   zrzuty trafiają do nadzorcy, nigdy wprost do właściciela.

Naruszenie któregokolwiek z tych trzech warunków = odrzucenie dyżuru,
niezależnie od jakości reszty.

---

## ★ KRYTYCZNE OGRANICZENIA CAŁEGO DYŻURU — przeczytaj przed §0

1. **★ JEDNA FLAGA, DOMYŚLNIE OFF, FAIL-CLOSED.** Cały Twój produkt wisi na
   `ff_chatSignalsFeed` (`src/utils/chatSignalsFeedFlag.ts`, wzorzec
   `criterionWorkspaceV2Flag.ts`, ale rozstrzygnięcie kończy się na
   **`?? false`**). Każdy błąd odczytu flagi → OFF. Zero innych nowych flag.
   **Nie zmieniasz wartości domyślnej ŻADNEJ istniejącej flagi** — w
   szczególności `myWorkSignalsV2` (dziś default ON, `useFeatureFlags`) zostaje
   dokładnie taka, jaka jest.
2. **★ SERWER JEST CUDZY.** `server/src` jest poza zakresem z **JEDNYM**
   wyjątkiem opisanym w §1.6 (licencja F — dokładnie jedno addytywne pole w
   `signalReadModel.ts`). Cokolwiek innego w `server/` = **STOP**.
3. **★ ZERO MIGRACJI.** Ten dyżur nie ma przydzielonego przedziału numerów,
   bo nie ma prawa dodać migracji. Gdyby cokolwiek wymagało migracji — **STOP**,
   wpis do raportu, koniec pozycji.
4. **★ ZERO LLM.** Nie wołasz dostawcy modelu, nie generujesz treści modelem,
   nie wpinasz klucza. Warstwa `INTERPRETED` sygnałów jest zbudowana po stronie
   serwera i **wyłączona** (`ENABLE_SIGNAL_INTERPRETER=false`); Twój front ma ją
   **obsłużyć jako możliwy przypadek danych**, nie włączyć.
5. **★ Wszystko, co pokazujesz, musi być realne.** Przycisk bez endpointu =
   **nie budujesz go**, tylko wpisujesz `BRAK_API` do raportu. Kolumna bez
   danych = nie zmyślasz jej wartości. Pusty stan = uczciwy pusty stan, nigdy
   „ładny placeholder".
6. **★ NIE JESTEŚ PIERWSZYM TESTEREM WIZUALNYM — ALE PIOTR TYM BARDZIEJ NIE.**
   `CLAUDE.md` §7: zanim ktokolwiek zobaczy ekran, **Ty** renderujesz go w
   harnessie `dev-render/`, **Ty** robisz zrzuty i **Ty** oglądasz je własnymi
   oczami i naprawiasz wady. Do raportu wchodzi lista wad, które sam u siebie
   znalazłeś i naprawiłeś. Raport kończysz zdaniem „gotowe do polish-passu
   nadzorcy", **nigdy** „gotowe do pokazania właścicielowi".
7. **★ DEC-65 — demo jest święte.** Zero Railway, zero deployu, zero zdalnych
   migracji/seedów, zero zapisów do wspólnej bazy. Ten dyżur w ogóle nie
   potrzebuje bazy (patrz §0.4a).
8. **★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** —
   ani do zapisu, ani do odczytu. Jedyny dozwolony kontakt: symlink
   `node_modules` (tylko odczyt, `DEC-86`).

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.
   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, `main`, `Londyn`,
   `codex/preserve-*`, `codex/chat-signals-day18-*` ani z żadnej gałęzi dnia
   17–25. Załóż raport, wpisz pozycję STOP z wynikiem obu komend i zakończ
   dyżur.

   **Reguła rozejścia (`DEC-2026-08-26-95`).** Jeżeli marker JEST przodkiem, ale
   tip uciekł do przodu — **to nie jest STOP**. Startujesz **dokładnie z
   markera**, wypisujesz w raporcie `git log --oneline <marker>..codex/m03-admin-20260824`
   i listę plików rozejścia; scalenie z nowszym tipem wykonuje nadzorca przy
   odbiorze. **Rebase w trakcie dyżuru: ZAKAZANY.**

3. **★ Weryfikacja stanu wejściowego (warunek wstępny, NIE formalność).**
   Sprawdzasz sam; wynik jest obowiązkową pozycją raportu. Każda z tych komend
   ma w §1.7 podany oczekiwany wynik — rozbieżność idzie do „Korekt wobec
   instrukcji", nie do improwizacji:

   ```bash
   # (a) trasa kanoniczna feedu — sedno całego dyżuru
   grep -n "api/signals" server/src/Gateway.ts
   wc -l server/src/routes/signals.routes.ts                      # oczekiwane: 73

   # (b) kształt DTO — sedno pozycji D
   grep -n "severityRaw\|nextCursor\|isMine" server/src/services/signals/signalReadModel.ts
   grep -n "severity:" server/src/types/workSignals.ts

   # (c) akcje wiersza — sedno pozycji B
   grep -n "^router\." server/src/routes/my-work/signals.routes.ts

   # (d) istniejąca powierzchnia feedu w Chacie — sedno pozycji A
   wc -l src/components/AIChat/ChatSignalsPanel.tsx               # oczekiwane: 524
   grep -n "ChatSignalsPanel\|signalsEnabled" src/components/AIChat/UnifiedChatPanel.tsx

   # (e) wzorzec flagi
   wc -l src/utils/criterionWorkspaceV2Flag.ts                    # oczekiwane: 118

   # (f) harness
   ls dev-render/vite.config.ts dev-render/shot.mjs
   ```

   **Brak (a), (b) albo (d) = STOP całego dyżuru** — pracujesz na złej bazie.

4. **Sprawdź, że materiały wiążące widzisz:**

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # w chwili wystawienia: 182
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_DAY18_REPORT_20260826.md # w chwili wystawienia: 190
   grep -n "DEC-2026-08-26-89\|DEC-2026-08-26-107\|DEC-2026-08-26-110" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
   git show codex/chat-signals-design-20260825 --stat | tail -3
   git show codex/chat-signals-design-20260825:docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md | wc -l   # 763
   ```

   **Projekt wiążący (763 linie) czytasz W CAŁOŚCI** — w szczególności §5.2
   (kształt odpowiedzi), §5.4 (rejestr konsumentów), §5.5 (umiejscowienie w
   Chacie), §6 D3 i §7 blok B5. Brak któregokolwiek materiału = **STOP**.
   Rozbieżność liczby linii (rejestry rosną) = **nie STOP**, tylko wpis w
   „Korektach wobec instrukcji".

5. Tworzysz **własną świeżą gałąź** z markera:

   ```bash
   git branch codex/chat-signals-front-day26-20260826 «MARKER_SHA»
   git worktree add /private/tmp/consultify-chat-signals-front-day26 codex/chat-signals-front-day26-20260826
   cd /private/tmp/consultify-chat-signals-front-day26
   ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules node_modules   # DEC-86, TYLKO ODCZYT
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only «MARKER_SHA»...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| #       | Zakaz                                                                                                                                                                                                                                                                                                                                                                                                | Dlaczego                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Z1      | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup` **na koniec**, wyłącznie własnej gałęzi `codex/chat-signals-front-day26-20260826`                                                                                                                                                                                                                      | Push na `origin`/demo wykonuje wyłącznie nadzorca                                                                  |
| Z2      | **Nie dotykasz `origin/demo`**, lokalnego `demo`, `Londyn`, `codex/m03-admin-20260824` ani gałęzi `codex/chat-signals-day18-*` / `codex/chat-signals-design-*`                                                                                                                                                                                                                                       | `demo` = święta baza; tamte gałęzie są zamknięte                                                                   |
| Z3      | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru                                                                                                                                                                                                                                                                 | Krach 3/4 powstał tak; `DEC-95`                                                                                    |
| **Z4**  | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`)                                                                                                                                                                                                                                                                                                    | Wymagania są w rejestrze decyzji i w projekcie                                                                     |
| **Z5**  | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`.** Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)** wg `DEC-86`                                                                                                                                                                              | Chroniony, brudny worktree właściciela                                                                             |
| Z6      | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*` (w chwili wystawienia żyje ich ponad dwadzieścia, część w użyciu)                                                                                                                                                                                                                                                                    | Cudze dyżury pracują równolegle                                                                                    |
| Z7      | **Nie zajmujesz portów sesyjnych.** W chwili wystawienia NASŁUCHUJĄ: 5000, 5037, **5432**, **5474**, **5499**, **5505**, 6379, 7000, 11434. **Twój harness `dev-render` = port 3026.** Port zajęty → bierzesz pierwszy wolny i wpisujesz do raportu. **Zakaz portu 3987** (runtime właściciela)                                                                                                      | Cudze dyżury pracują równolegle                                                                                    |
| Z8      | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji/seedów (`DEC-65`)                                                                                                                                                                                                                                                                 | Produkcja/demo poza zakresem                                                                                       |
| **Z9**  | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru — a ten dyżur bazy NIE POTRZEBUJE.** Nigdy demo/staging/produkcja, nigdy cudza retained-DB (5432/5474/5499/5505). **`DEC-98`: Z9 przerywa DANĄ CZYNNOŚĆ, nie cały dyżur** — zatrzymaj → ustal skutek → zapisz → przypnij env → kontynuuj. **Twardy STOP całego dyżuru TYLKO przy stwierdzonym realnym ZAPISIE do bazy spoza dyżuru** | „dane demo = twarz produktu" (`DEC-65`)                                                                            |
| **Z10** | **Dokładnie JEDNA nowa flaga: `ff_chatSignalsFeed`, default OFF.** Zero innych nowych flag. **Zero zmian wartości domyślnej istniejącej flagi** — `myWorkSignalsV2`, `criterionWorkspaceV2` i reszta zostają nietknięte. **Nie dodajesz flagi do `useFeatureFlags.tsx`** (projekt proponował `chatSignalsProducerV1` — patrz ERRATA §1.2 poz. 14)                                                    | CLAUDE.md reguła 9 + ★ pkt 1                                                                                       |
| Z11     | **Nie zmieniasz `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`, `src/components/ProtectedRoute.tsx`.** Twój ekran **nie jest nową trasą** — wchodzi w istniejącą powierzchnię Chatu (§1.7, §A.3). Dodanie trasy = **STOP**                                                                                                                                                                  | Gramatyka tras zaakceptowana; nowa trasa to osobna decyzja właściciela                                             |
| Z12     | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_FRONT_DAY26_REPORT_20260826.md`. Zrzuty idą do `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/chat-signals-front-20260826/`. **`MODULE_ACCEPTANCE.md` 13_CHAT — NIE DOTYKASZ** (patrz §1.4 poz. 8)                                                               | Repo tonie w dokumentach-duchach; wpis `CHAT-OWN-004` jest zbiorczy i jego rozbicie należy do nadzorcy (`DEC-107`) |
| Z13     | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz ich w kodzie ani raporcie                                                                                                                                                                                                                                                                                          | Rejestr decyzji jest `FINAL / IRREVOCABLE`                                                                         |
| **Z14** | **ZERO LLM.** Nie wołasz `llmService`, nie wpinasz klucza, nie generujesz treści modelem, nie włączasz `ENABLE_SIGNAL_INTERPRETER`                                                                                                                                                                                                                                                                   | Silnik AI = osobny moduł; ★ pkt 4                                                                                  |
| Z15     | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** Istniejący panel ma trzy uczciwe stany (`forbidden`, `failed`, `empty`) wypracowane przy M01-P03 — **rozszerzasz je, nigdy nie zwężasz**                                                                                                                                                                                       | Uczciwy pusty stan > udawany ekran                                                                                 |
| **Z16** | **Nie dotykasz `src/services/api.ts`** (21 998 linii, wspólny transport), `src/hooks/useFeatureFlags.tsx`, `src/contexts/FeatureFlagsContext.tsx`, `src/i18n.ts`. Wolno **czytać** i **wołać**                                                                                                                                                                                                       | Wspólny transport i wspólne flagi psują wszystkim naraz                                                            |
| **Z17** | **★ Zakaz wszystkiego poza powierzchnią sygnałów w Chacie** — z imiennymi wyjątkami z ramki poniżej                                                                                                                                                                                                                                                                                                  | „jeden ekran na raz" (CLAUDE.md §9)                                                                                |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, ani żadnego mocka/helpera współdzielonego. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru**                                                                              | Dyżur nr 2 wywalił tak 27 cudzych testów                                                                           |
| **Z19** | **★★ ZAKAZ uruchamiania jakichkolwiek testów DB bez KOMPLETU CZTERECH ZMIENNYCH env W TEJ SAMEJ LINII** (`DB_TYPE`, `NODE_ENV`, `RUN_DB_TESTS`, `MOCK_DB=false`) + jawny `DATABASE_URL`. **W tym dyżurze reguła jest prosta: żaden Twój test NIE dotyka bazy.** Jeśli którykolwiek Twój test wymagałby DB — **STOP**, przeprojektuj test na czysty mock transportu                                   | Dzień 17 mierzył na cudzej bazie; dzień 23 pokazał „0 failed" przy 60 SKIPPED                                      |
| **Z20** | **★★ DoD wymaga dowodu OSIĄGALNOŚCI, nie istnienia komponentu** (`DEC-104`). Ekran musi mieć **realne wejście w nawigacji ZA FLAGĄ**: klik→klik→ekran, z plikami i liniami. Komponent, do którego nie da się dojść z uruchomionej aplikacji, jest **nieistniejący**, choćby miał komplet zielonych testów                                                                                            | Zawyżenia wykrywane osobiście przez nadzorcę na tipie m03                                                          |
| **Z21** | **★★ Test wstrzykujący zależności NIE dowodzi ścieżki produkcyjnej** (`DEC-107`). Musi istnieć **co najmniej jeden test z REALNYM modułem flagi** (bez `vi.mock` na `chatSignalsFeedFlag`) — wzorzec gotowy: `src/components/Audit/method/workspace/__tests__/CriterionWorkspaceGate.realFlag.test.tsx`                                                                                              | Dyżur nr 18 miał 8/8 zielonych testów warstwy, która nie mogła zadziałać                                           |
| **Z22** | **★★ Zakaz atrapy ze skutkiem zewnętrznym** (`DEC-108`). Żaden przycisk nie może wyglądać na wykonany, jeśli backend odmówił. Akcja bez endpointu **nie powstaje** (→ `BRAK_API`). Akcja z endpointem, która zwróciła 4xx, **wraca do stanu sprzed kliknięcia** i mówi dlaczego                                                                                                                      | Optymistyczne usuwanie wiersza po 4xx = produkt kłamie                                                             |
| **Z23** | **★★ Pomiar testów BEZ ZAWĘŻANIA** (`DEC-108`). Raport podaje wynik z **PEŁNEGO zakresu §0.4a**, z rozbiciem na czerwone **ZASTANE** (na markerze, PRZED pierwszym commitem) i **WPROWADZONE**, z liczbą SKIPPED. **Podanie zawężonego wyboru = naruszenie**                                                                                                                                         | Deklarowane „98/98 PASS" bywało wyborem                                                                            |

**Zasięg Z17 — granica jest ostra.**

```
WOLNO (Twój zakres):
  src/utils/chatSignalsFeedFlag.ts                              (NOWY — jedyna flaga)
  src/utils/__tests__/chatSignalsFeedFlag.test.ts               (NOWY)
  src/components/AIChat/signalsFeed/**                          (NOWY katalog — cały front feedu)
  src/components/AIChat/ChatSignalsPanel.tsx                    (★ LICENCJA WĄSKA — WYŁĄCZNIE bramka flagi + szerokość szuflady za flagą; §A.3 pkt 4)
  public/locales/pl/translation.json                            (TYLKO nowe klucze `chatSignals.*`)
  public/locales/en/translation.json                            (parytet 1:1 w TYM SAMYM commicie)
  dev-render/chat-signals-feed.html                             (NOWY)
  dev-render/chat-signals-feed-main.tsx                         (NOWY)
  dev-render/screens/chat-signals-feed.tsx                      (NOWY)
  tests/components/AIChat/signalsFeed/**                        (NOWE pliki, `git add -f`)
  docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_FRONT_DAY26_REPORT_20260826.md   (jedyny nowy dokument)
  docs/program/waves/WAVE_03_ACCEPTANCE/evidence/chat-signals-front-20260826/**       (zrzuty)
  server/src/services/signals/signalReadModel.ts                (★ LICENCJA F — WYŁĄCZNIE jedno addytywne pole, §1.6; jeśli trzeba dotknąć drugiego pliku serwera → STOP)
  server/src/services/signals/__tests__/                        (NOWY plik testu TYLKO jeśli używasz licencji F)

IMIENNE WYJĄTKI (wolno CZYTAĆ i WOŁAĆ istniejące, NIE zmieniać ich kodu):
  src/components/standard/StandardTable.tsx · StandardModuleBar.tsx · StandardPreview.tsx · PriorityCell.tsx
  src/components/shared/TableWithPreviewLayout.tsx · src/components/shared/ModuleMenu3.tsx
  src/components/shared/PreviewPane/**  ·  src/components/ui/ResizableTable/PreviewPaneShell.tsx
  src/services/api.ts                                           (WOŁASZ `Api.get`/`Api.post`; ZMIANA = STOP)
  src/routes/routeConfig.ts                                     (CZYTASZ — do rozstrzygnięcia destynacji, §A.2)
  src/components/AIChat/UnifiedChatPanel.tsx                    (CZYTASZ — tam jest montaż panelu; ZMIANA = STOP)
  server/src/**                                                 (CZYTASZ do końca; ZMIANA = STOP poza licencją F)

NIE WOLNO:
  src/routes/AppRoutes.tsx · routeConfig.ts (zapis) · ProtectedRoute.tsx      ← Z11
  src/services/api.ts · src/hooks/useFeatureFlags.tsx · src/i18n.ts           ← Z16
  src/components/AIChat/UnifiedChatPanel.tsx                                  ← wspólna powłoka Chatu, ma test grepujący źródło
  src/components/MyWork/**                                                    ← cudza powierzchnia (Executive czyta /my-work/signals?limit=5)
  server/src/routes/**  ·  server/src/jobs/**  ·  server/src/services/signals/rules/**
  server/src/services/demo/demoPrincipalGuard.ts                              ← ★ dopisanie sygnałów do allowlisty demo = STOP (ERRATA poz. 11)
  server/migrations/**                                                        ← ZERO migracji
  tests/setup.ts · tests/helpers/** · tests/__mocks__/** · vitest*.config.ts   ← Z18
  tests/e2e/** · tests/acceptance/**                                          ← cudzy tor odbiorowy (MIERZYSZ, nie zmieniasz)
  scripts/*.baseline.json (zapis)                                             ← ★ baseline hardcoded-colors/a11y NIE podnosisz (§0.3)
  wszystko inne
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
idziesz dalej. Wyjątku nie ma nawet dla „jednej linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycja.** Jedna pozycja = jeden commit. Conventional commits:
  ```
  feat(chat): fail-closed feature flag for the signals feed front (F.1)
  feat(chat): typed signal DTO reader with PL dictionaries for every enum (D.1)
  feat(chat): destination resolver that never renders a dead click (A.2)
  feat(chat): signals feed on StandardTable behind ff_chatSignalsFeed (A.3)
  feat(chat): signal preview on the six-block preview canon (B.1)
  feat(chat): on-demand refresh with an honest 429 throttle state (C.1)
  feat(signals): expose producerEnabled on the feed envelope (G.1, licencja F)
  chore(chat): dev-render harness for the signals feed (E.1)
  docs(chat): light+dark evidence for five feed states (E.2)
  test(chat): component and real-flag coverage for the signals feed (T.1)
  docs(chat): day 26 front report with the design parity table (R.1)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem** na plikach tego commita:
  `npx prettier --write <pliki>`.
- **★ `bash scripts/check-list-canon.sh <pliki>` OBOWIĄZKOWY przed KAŻDYM
  commitem dotykającym `.tsx`** — to bezpiecznik zamrożonego kanonu tabel
  (CLAUDE.md §9). Bramka failuje, gdy liczba naruszeń w pliku ROŚNIE albo gdy
  plik spoza baseline ma >0 naruszeń. **Twoje NOWE pliki mają mieć ZERO
  naruszeń.** `--update` na baseline: **ZAKAZANE**.
- **★ `scripts/hardcoded-colors.baseline.json` i `scripts/a11y-jsx.baseline.json`
  NIE ROSNĄ.** `ChatSignalsPanel.tsx` ma dziś w baseline 54 twarde kolory i 1
  naruszenie a11y — to dług zastany, którego **nie powiększasz**. Twoje nowe
  pliki: **zero twardych kolorów**, wyłącznie tokeny `c-*`.
- **Testy celowane per pozycja** — **nigdy pełny `tsc -p` repo ani pełny
  `vitest`**. Typy punktowo:
  `npx esbuild <plik> --loader:.tsx=tsx --outfile=/dev/null`.
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**: happy ·
  ścieżka błędu (4xx) · pusty stan · **stan „flaga OFF" (renderuje się stary
  panel, bajt w bajt)**.
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy i
  asertuje `toContain('...')`, **nie liczy się do DoD** (w repo takie są —
  `chatHeaderControls.ownerFeedback.test.ts` — i to jest dług, nie wzorzec).
- **NOWE pliki w `tests/` wymagają `git add -f`** (`.gitignore` ma `/tests/*`).
  Pliki `__tests__` obok kodu w `src/` dodają się normalnie.
- **★ Tokeny, nie kolory.** Wyłącznie `c-*` (`c-text`, `c-text-secondary`,
  `c-text-muted`, `c-surface`, `c-surface-raised`, `c-border`, `c-danger`,
  `c-focus`). **`primary-*` KAŻDY numer = crimson `#85182F`** — czerwień
  wyłącznie dla semantyki krytycznej (waga `critical`/`blocker`), **nigdy**
  jako CTA/stan aktywny. Fokus zawsze `focus-visible:ring-c-focus`.
- **★ i18n PL wiodące.** Każdy napis przez `t()`, klucze pod `chatSignals.*`,
  **parytet PL+EN w tym samym commicie**. Zero surowych enumów na ekranie
  (`WARNING`, `EXECUTION`, `DETERMINISTIC` → słownik PL). Zero surowych dat ISO
  (`2026-08-26T12:00:00Z` → „14 min temu" / „dziś 14:15").
- **Zero nowych zależności** w `package.json`.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

Pozycja jest zrobiona, gdy spełnia **wszystkie dwanaście**:

1. **Realne dane** — komponent czyta REALNE endpointy przez `Api` (`GET
/signals`, `POST /signals/refresh`, `POST /my-work/signals/...`). Zero
   `sampleData` jako źródła prawdy w kodzie produkcyjnym (mock żyje wyłącznie w
   `dev-render/screens/`).
2. **Uczciwy stan pusty i uczciwy błąd** — sześć stanów z §A.4, rozróżnialnych.
   Pusty ≠ błąd ≠ wyłączony producent ≠ brak uprawnień.
3. **Zero atrap.** Brak endpointu → akcja **nie powstaje**, wpis `BRAK_API` w
   raporcie. Destynacja bez realnej trasy → pigułka **wyłączona z wyjaśnieniem**,
   nigdy martwy klik (`DEC-25`, projekt §5.2).
4. **★ Z22** — po 4xx interfejs **wraca do stanu sprzed kliknięcia** i mówi
   dlaczego. Zakaz „optymistycznego" usuwania wiersza, którego serwer nie usunął.
5. **Minimum 4 testy zachowania** (happy · 4xx · pusty · flaga OFF),
   behawioralne, `@testing-library/react`.
6. **★ Z21 — co najmniej jeden test z REALNYM modułem flagi** (bez `vi.mock`),
   wzorzec `CriterionWorkspaceGate.realFlag.test.tsx`: sprawdza, że przy braku
   jakiegokolwiek override'u ekran **NIE** się renderuje (fail-closed).
7. **★ Z20 — dowód OSIĄGALNOŚCI** w formacie:
   ```
   realne wejście (co klika użytkownik)
     → komponent montujący (plik:linia)
     → bramka flagi (plik:linia)
     → Twój ekran (plik:linia)
     → wywołanie API (metoda + URL)
   ```
8. **★ Kanon triady** — ekran listowy **WYŁĄCZNIE** `StandardTable` +
   `StandardModuleBar` (Menu 3) + `StandardPreview`. Zakaz własnej tabeli,
   własnego kebaba, własnego panelu podglądu. `check-list-canon.sh` zielony.
9. **★ Kanon podglądu — 6 bloków** (nagłówek · meta · treść · relacje ·
   akcje-pill · kebab) przez `StandardPreview`; moduł deklaruje treść, komponent
   narzuca wygląd.
10. **★ Zrzut light + dark** dla każdego stanu, zrobiony przez Ciebie z
    harnessu, **obejrzany przez Ciebie** i opisany w raporcie (co widziałeś, co
    poprawiłeś).
11. **i18n PL+EN w tym samym commicie**, zero surowych enumów i dat ISO.
12. **`prettier` + `check-list-canon.sh`** przed commitem + **wpis w raporcie**:
    `pozycja → commit SHA → status → dowód osiągalności → dowód testowy → zrzuty`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu (Z23)

**Ten paragraf definiuje PEŁNY zakres pomiaru. Raport podaje wynik z CAŁEGO tego
zakresu. Podanie zawężonego wyboru = naruszenie Z23.**

1. Wypisz wszystkie dotknięte pliki: `git diff --name-only <marker>...HEAD`
   (komenda dosłownie jak w §0.1 pkt 6).
2. **Zmierz zakres DWA RAZY:** (a) na markerze bazowym, PRZED pierwszym commitem
   → czerwone **ZASTANE**; (b) na `HEAD` po ostatnim commicie → różnica to
   czerwone **WPROWADZONE**. Obie liczby, w formacie `X PASS / Y FAIL / Z SKIPPED`,
   per plik.
3. Uruchom **minimum** poniższą listę. **Żadna z tych komend nie potrzebuje
   bazy** — jeśli któraś próbuje się łączyć, to jest znalezisko do raportu, nie
   powód do postawienia kontenera:
   ```bash
   npx vitest run tests/components/AIChat
   npx vitest run tests/components/AIChat/signalsFeed            # NOWE, Twoje
   npx vitest run src/utils/__tests__/chatSignalsFeedFlag.test.ts # NOWE, Twoje
   npx vitest run src/components/AIChat/__tests__
   npx vitest run src/utils/__tests__/criterionWorkspaceV2Flag.test.ts
   npx vitest run src/components/standard/__tests__
   npx vitest run tests/components/standard
   npx vitest run tests/unit/i18n                                # jeśli istnieje — parytet kluczy
   # jeśli używasz licencji F (G.1):
   npx vitest run server/src/services/signals/__tests__
   ```
4. W raporcie deklarujesz jawnie `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY` (i co
   pominąłeś, i dlaczego), **z osobną tabelą „czerwone ZASTANE" i „czerwone
   WPROWADZONE", z kolumną SKIPPED**. **Czerwonych zastanych NIE naprawiasz** —
   opisujesz. **Każdą czerwoną wprowadzoną** albo naprawiasz, albo zgłaszasz
   jako STOP; przemilczenie = naruszenie.
5. **Osłabienie asercji w teście istniejącym wcześniej wymaga wpisu „przed/po"**
   w raporcie. Dotyczy to w szczególności
   `src/components/AIChat/__tests__/chatHeaderControls.ownerFeedback.test.ts`,
   który **grepuje źródło** `ChatSignalsPanel.tsx` i wymaga w nim literałów
   `id="chat-signals-panel"` oraz `aria-modal="true"` (ERRATA §1.2 poz. 13).
   Osłabienie bez wpisu = odrzucenie.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**
Zatrzymujesz się w szczególności, gdy musiałbyś:

- zmienić cokolwiek w `server/src` poza jednym polem z licencji F (§1.6);
- dodać migrację (jakąkolwiek);
- dodać trasę SPA albo pozycję w nawigacji (Z11);
- dodać drugą flagę albo zmienić default istniejącej (Z10);
- zbudować przycisk bez realnego endpointu (→ `BRAK_API`);
- wyrenderować destynację, której trasa nie istnieje (→ pigułka wyłączona +
  wpis, nigdy „i tak wstawię `navigate()`");
- dopisać cokolwiek do `PUBLIC_DEMO_WRITE_ALLOWLIST`;
- zmienić cudzy test spoza wąskiej licencji (Z18/Z17);
- podnieść baseline `hardcoded-colors` / `a11y-jsx`;
- uruchomić test dotykający bazy (Z19);
- pokazać ekran właścicielowi zamiast nadzorcy (★ pkt 6).

Format wpisu STOP:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST

### 1.1. Skąd bierze się ten dyżur

Moduł **Chat** dostał od właściciela 17 uwag odbiorowych (`CHAT-OWN-001`–`017`,
`OWNER_REVIEW_2026-08-22.md`). Uwaga `CHAT-OWN-004` (P1) dotyczyła panelu
„Ważne sygnały": panel istniał, ale **feed był pusty, bo nikt sygnałów nie
produkował**, a to, co się w nim pokazywało, nie miało ani źródła („skąd
wiadomo"), ani świeżości, ani wagi, ani destynacji („co mam z tym zrobić").

Powstał projekt wiążący `CHAT_SIGNALS_PRODUCER_DESIGN_2026-08-25.md` (763
linie, gałąź `codex/chat-signals-design-20260825`) i właściciel rozstrzygnął
trzy punkty decyzyjne (`DEC-2026-08-26-89`, OWNER_ACCEPT):

- **D1 = B** — fala 1 obejmuje domeny EXECUTION + DECISION + RESULTS(KPI) + FINANCE;
- **D2 = B** — warstwa deterministyczna ON, warstwa AI (`INTERPRETED`) zbudowana,
  ale za flagą OFF do akceptu właściciela na zrzutach;
- **D3 = B** — **feed jest ORGANIZACYJNY z filtrem roli, a sprawy własne są
  WYRÓŻNIONE** (nie osobisty, nie dwa oddzielne feedy).

Mechanikę tylną dowiózł **dyżur nr 18** (`DEC-107` — odbiór z P0, `DEC-110` —
FIX-y wykonane i **SCALONE** do `codex/m03-admin-20260824`). Stan po scaleniu:
8 z 10 reguł deterministycznych realnych, kanoniczna tabela `work_signals`,
ledger przebiegów, trasa `GET /api/signals`, throttle 60 s na `POST
/api/signals/refresh`, przemapowane `GET /my-work/signals`, obie flagi serwerowe
nadal **OFF**.

`DEC-89` zakładał, że front feedu zrobimy „wewnętrznie". Właściciel zmienił to
dyrektywą ekonomiczną: **front robi Codex** — stąd wyjątkowy, frontowy charakter
tego dyżuru i trzy warunki z nagłówka.

### 1.2. ★★ ERRATA — CZTERNAŚCIE RZECZY, KTÓRE SĄ INNE, NIŻ WYGLĄDA

**To jest najważniejszy paragraf tej instrukcji.** Każdy punkt został
zweryfikowany na kodzie w chwili wystawienia. Jeżeli u siebie zobaczysz coś
innego — to jest wpis do „Korekt wobec instrukcji", a nie powód do improwizacji.

1. **Front feedu NIE JEST greenfieldem — powierzchnia już istnieje i jest
   ŻYWA.** `src/components/AIChat/ChatSignalsPanel.tsx` (524 linie) jest
   zamontowany w `UnifiedChatPanel.tsx:7345-7351`, a jego trigger siedzi w
   nagłówku Chatu (`UnifiedChatPanel.tsx:6619-6632`), za istniejącą flagą
   `signalsEnabled = isEnabled('myWorkSignalsV2')` (`:808`, **default ON**).
   Panel woła `Api.get('/my-work/signals?limit=50&projectId=…')` (`:193`) oraz
   snooze/mute-type/dismiss (`:282`, `:300`, `:317`).
   **Konsekwencja:** nie budujesz feedu od zera i nie usuwasz istniejącego. Twój
   ekran to **drugi tryb tej samej powierzchni**, wybierany flagą.

2. **Kanoniczne miejsce feedu wg projektu to CHAT, nie My Work.** Projekt §5.4
   (rejestr konsumentów) i §5.5 („Umiejscowienie w Chacie") oraz blok **B5**
   („Konsument Chat", za flagą OFF) wskazują panel Chatu jako powierzchnię
   feedu. My Work jest konsumentem **agregatu** (`home.routes.ts` `rollupSignals`)
   i skróconej listy (`src/components/MyWork/Executive/ExecutiveDashboard.tsx:276`
   — `Api.get('/my-work/signals?limit=5')`). **Nie dotykasz My Work.**

3. **★ Waga: zlecenie i projekt mówią odwrotnie niż kod.** W `SignalDTO`
   (`server/src/types/workSignals.ts:123-148`):
   - `severity: 'INFO' | 'WARNING' | 'CRITICAL'` — pole **legacy, ŚCIĘTE**;
     `signalReadModel.ts:120-123` mapuje `blocker → CRITICAL`;
   - `severityRaw: 'info' | 'warning' | 'critical' | 'blocker'` — pole **pełnej
     wagi** (`executionVisibility.ts:48`).
     Projekt §5.2 deklaruje `severity` z wariantem `'BLOCKER'` — **w kodzie tak
     NIE JEST**. **Front MUSI czytać `severityRaw`**; czytanie `severity` gubi
     najwyższy poziom i sprawia, że blocker wygląda jak zwykły critical.
     Baza wprost odrzuca `severity='BLOCKER'` (CHECK, test dnia 18) — wielkość
     liter po stronie odczytu normalizujesz sam.

4. **Koperta feedu ma dokładnie dwa pola.** `readSignalFeed` zwraca
   `{ signals: SignalDTO[], nextCursor: string | null }`
   (`signalReadModel.ts:37, 150-158`). **Nie ma** `mutedTypes`, **nie ma**
   `total`, **nie ma** `producerEnabled`.
   Skutek uboczny w kodzie zastanym: `ChatSignalsPanel.tsx:195` czyta
   `data.mutedTypes` — czyli **zawsze `[]`** — więc blok „Wyciszone typy"
   (`:502-519`) **nigdy się nie renderuje**. To istniejący martwy fragment; nie
   naprawiasz go w starym panelu, ale **nie kopiujesz** go do nowego.

5. **Filtr roli w UI jest niewykonalny — i to jest dobrze.** `GET /api/signals`
   przyjmuje wyłącznie: `limit`, `projectId`, `domain`, `origin`, `severityMin`,
   `cursor` (`signals.routes.ts:29-34`). **Rola pochodzi z tokenu** i jest
   wstrzykiwana po stronie serwera (`signalReadModel.ts:38, 46-51`); parametr
   `role` w query jest **ignorowany** (test dnia 18 to przypina).
   **Konsekwencja:** chip „filtr roli" w Menu 3 byłby atrapą → **nie budujesz
   go**, wpisujesz `BRAK_API` do tabeli parytetu. Zamiast tego: chip
   **„Tylko moje"**, który realizuje D3 („sprawy własne wyróżnione") na polu
   `isMine` — z jawną etykietą, że filtruje **załadowaną stronę** (§A.4 pkt 6).

6. **Kolumna „status" jest z definicji stała.** Read model filtruje
   `w.status = 'OPEN'` (`signalReadModel.ts:42`), więc `SignalDTO.status` w
   feedzie to zawsze `OPEN`. Kolumna „Status" wymagana w zakresie A powstaje, ale
   **renderuje słownik PL (`Otwarty`) i nic poza tym** — a Ty wpisujesz do
   raportu jednozdaniową propozycję dla nadzorcy (np. zastąpienie jej kolumną
   „Powtarzalność" liczoną z `firstObservedAt` vs `lastObservedAt`).
   **Sam kolumny nie podmieniasz** — to decyzja nadzorcy.

7. **★ Destynacje z reguł prawdopodobnie NIE MAJĄ TRAS W APLIKACJI.** Osiem
   reguł emituje `action.route`:

   | reguła (`signalType`)          | `action.route` z serwera    | trasa w SPA?                                                                                         |
   | ------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------- |
   | `task_overdue`                 | `/tasks/<id>`               | **brak w `AppRoutes.tsx`/`routeConfig.ts`**                                                          |
   | `task_due_soon_not_started`    | `/tasks/<id>`               | **brak**                                                                                             |
   | `task_blocked_stale`           | `/tasks/<id>`               | **brak**                                                                                             |
   | `initiative_no_baseline`       | `/initiatives/<id>`         | jest tylko `/initiatives` (`routeConfig.ts:110`)                                                     |
   | `decision_pending_stale`       | `/decisions/<id>`           | jest tylko redirect `/decisions → /my-work/decisions` (`AppRoutes.tsx:1568`)                         |
   | `decision_blocking_dependents` | `/decisions/<id>`           | jw.                                                                                                  |
   | `kpi_threshold_breached`       | `/results/kpis/<id>`        | **realna trasa to `/results/kpi/:kpiId`** (`routeConfig.ts:164`) — liczba mnoga w regule jest błędna |
   | `budget_overspend`             | `/initiatives/<id>/finance` | **brak**                                                                                             |

   **To nie jest Twój błąd do naprawienia w regułach (server = STOP).** To jest
   powód, dla którego pozycja **A.2** istnieje: budujesz **resolver destynacji**
   z jawną tabelą i uczciwym zachowaniem „brak trasy → pigułka wyłączona z
   wyjaśnieniem". **Zakaz zgadywania trasy, zakaz `navigate()` w ciemno.**
   Weryfikujesz każdą z ośmiu pozycji **sam**, na `routeConfig.ts` i
   `AppRoutes.tsx`, i wynik wpisujesz do raportu.

8. **★ Polski nie jest zagwarantowany przez serwer.** `readSignalFeed` rozwija
   `title_key`/`body_key` słownikiem serwerowym wg nagłówka
   **`accept-language`** (`signals.routes.ts:28`,
   `services/signals/i18n/dictionary.ts`). Ale `src/services/api.ts:767-770`
   ma komentarz wprost: _„Browsers treat `Accept-Language` as a forbidden header,
   so setting it here is best-effort. Use `X-App-Language` as the reliable
   signal"_ — a read model `X-App-Language` **ignoruje**. Czyli użytkownik z
   przeglądarką EN dostanie **angielskie tytuły w polskim UI** (ryzyko R10 z
   projektu, niedomknięte).
   **Naprawa jest FRONTOWA i należy do Ciebie (pozycja D.1):** renderujesz
   tytuł/treść z `titleKey` + `titleParams` (i `bodyKey`/`bodyParams`) przez
   **front-owe i18n**, a serwerowe `title`/`body` traktujesz **wyłącznie jako
   fallback**, gdy klucza nie ma w słowniku frontu. Klucze serwerowe są znane i
   jest ich 9 par (`dictionary.ts`) — przenosisz je 1:1 do
   `public/locales/{pl,en}/translation.json` pod `chatSignals.rule.*`.
   **Nie zmieniasz serwerowego słownika.**

9. **Throttle 429 ma inny kształt, niż spodziewa się klient.** `POST
/api/signals/refresh` zwraca przy dławieniu
   `{ error: 'THROTTLED', retryAfterSeconds }` (`signals.routes.ts:56-62`) —
   **bez nagłówka `Retry-After`**. Tymczasem `api.ts:1110-1119` ustawia
   `err.retryAfter` tylko z nagłówka `Retry-After` albo z pola `data.retryAfter`.
   **Czyli `err.retryAfter` będzie `undefined`**, a czas dostaniesz z
   `err.data.retryAfterSeconds`. Obsłuż oba (`err.retryAfter ??
err.data?.retryAfterSeconds`) i **nigdy nie ponawiaj automatycznie** — w
   `api.ts` żyje klientowy blokator transportu, który po serii 429 zaczyna
   odrzucać ścieżkę lokalnie (`recordTransportFailure`, `:430-450`).

10. **Odświeżenie przy wyłączonym producencie zwraca 200, nie błąd.**
    `runDeterministicForOrganization` przy `ENABLE_SIGNAL_PRODUCER != 'true'`
    zwraca `SKIPPED_DISABLED`, a trasa odpowiada
    `200 { producerEnabled: false, run: {...} }` (`signals.routes.ts:63-69`,
    `workSignalProducerJob.ts:10-33`). **Dodatkowo ścieżka ON_DEMAND zapisuje
    wiersz do ledgera**, więc **drugie kliknięcie w ciągu 60 s daje 429** — nawet
    gdy producent jest wyłączony. Oba te stany muszą być w UI uczciwe i
    rozróżnialne.

11. **W trybie demo publicznego WSZYSTKIE Twoje akcje są odmawiane.**
    `PUBLIC_DEMO_WRITE_ALLOWLIST` (`server/src/services/demo/demoPrincipalGuard.ts:267-290`)
    dopuszcza dokładnie cztery ścieżki zapisu (logout, refresh tokenu, wyjście z
    demo, telemetria). Snooze, dismiss, mute-type i refresh sygnałów **nie są na
    liście** → principal demo dostanie odmowę. **Dopisanie sygnałów do allowlisty
    = STOP** (zmiana serwera poza licencją F i zmiana polityki demo).
    Front ma pokazać uczciwy komunikat „w trybie demo ta akcja jest zablokowana",
    a nie udawać sukces.

12. **Nie ma odwrotności dla wyciszenia ani drzemki.** W
    `server/src/routes/my-work/signals.routes.ts` istnieją WYŁĄCZNIE:
    `POST /signals/:key/snooze` (presety `1h` / `4h` / `tomorrow` / `week`,
    `:151-178`), `POST /signals/:key/dismiss` (`:180-199`),
    `POST /signals/mute-type` (`:106-128`), `POST /signals/mute-domain`
    (`:130-149`). **Nie ma** `un-mute`, **nie ma** `un-snooze`, **nie ma** GET-a
    listy wyciszeń. Konsekwencje: (a) „Wycisz typ" jest **nieodwracalny z UI** →
    wymaga potwierdzenia i jawnego ostrzeżenia w treści; (b) **nie budujesz
    ekranu zarządzania wyciszeniami** (`BRAK_API`); (c) `mute-domain` możesz
    pominąć — zakres zlecenia wymienia snooze/dismiss/mute-type.
    Uwaga do kluczy: `ownedSignal` odrzuca klucze zaczynające się od
    `notification:` i wymaga istnienia wiersza w `work_signals` — klucze spoza
    modelu kanonicznego dostają **404** (ujawnione w `FIX-7e` dnia 18).

13. **Istniejący test GREPUJE ŹRÓDŁO panelu.**
    `src/components/AIChat/__tests__/chatHeaderControls.ownerFeedback.test.ts:76-84`
    czyta `ChatSignalsPanel.tsx` jako tekst i wymaga w nim literałów
    `id="chat-signals-panel"` oraz `aria-modal="true"`. **Twoja bramka flagi musi
    zostawić powłokę dialogu nietkniętą** — podmieniasz wyłącznie **treść** panelu.

14. **Nazwa flagi w projekcie jest inna niż w zleceniu.** Projekt §7 („Rejestr
    flag") przewiduje `chatSignalsProducerV1` w `src/hooks/useFeatureFlags.tsx`.
    **Wiążąca jest nazwa ze zlecenia właściciela: `ff_chatSignalsFeed`**, jako
    moduł na wzorcu `criterionWorkspaceV2Flag.ts` (query > localStorage > env >
    default OFF). **Nie tworzysz drugiej flagi w `useFeatureFlags`** (Z16).
    Rozbieżność wpisujesz do tabeli parytetu z projektem.

### 1.3. ZAKRES — dokładnie jedenaście pozycji, nic więcej

| Pozycja | Nazwa                                                                                                   | Litera zlecenia |
| ------- | ------------------------------------------------------------------------------------------------------- | --------------- |
| **F.1** | Flaga `ff_chatSignalsFeed` — fail-closed, z testem realnego modułu                                      | (flaga)         |
| **D.1** | Czytnik DTO: `severityRaw`, `blocker→CRITICAL`, słowniki PL wszystkich enumów, tytuły z `titleKey`      | D               |
| **A.2** | Resolver destynacji — tabela ośmiu tras, brak trasy = pigułka wyłączona                                 | A/B             |
| **A.3** | Ekran feedu: `StandardModuleBar` (Menu 3) + `StandardTable`, wyróżnienie „moje", paginacja `nextCursor` | A               |
| **A.4** | Sześć stanów ekranu (pełny · pusty · producent OFF · brak uprawnień · błąd · dławienie)                 | A               |
| **B.1** | Podgląd sygnału wg kanonu 6 bloków + realne akcje (snooze/dismiss/mute-type)                            | B               |
| **C.1** | Odświeżenie `POST /signals/refresh` z obsługą 429 i czasem karencji                                     | C               |
| **G.1** | **(warunkowa, licencja F)** addytywne `producerEnabled` w kopercie feedu                                | F               |
| **E.1** | Harness `dev-render` z danymi PL (Metalpol / Anna Kowalska)                                             | E               |
| **E.2** | Zrzuty light+dark pięciu stanów, **obejrzane i poprawione przez Ciebie**                                | E               |
| **T.1** | Testy komponentów + test realnej flagi + pomiar Z23                                                     | F               |
| **R.1** | Raport z tabelą parytetu z projektem                                                                    | (raport)        |

(Pozycji jest dwanaście wierszy, bo `R.1` to raport — nie liczy się do
jedenastu pozycji roboczych.)

### 1.4. POZA ZAKRESEM — jawnie, żebyś nie zaczął

1. **Włączanie flag serwerowych** (`ENABLE_SIGNAL_PRODUCER`,
   `ENABLE_SIGNAL_INTERPRETER`) — osobny krok nadzorcy po odbiorze (`DEC-110`).
2. **Dwie niezbudowane reguły** (`res.roi_confidence_dropped`,
   `fin.benefit_not_realized`) — czekają na decyzję właściciela o źródle danych.
3. **Przeniesienie triggera sygnałów do prawej grupy nagłówka**
   (`CHAT-OWN-004`/`CHAT-OWN-010`, projekt §5.5). To wymaga zmian w
   `UnifiedChatPanel.tsx` — wspólnej powłoce z testem grepującym źródło. **Nie
   robisz tego**; wpisujesz do tabeli parytetu jako „niedostarczone — poza
   zakresem dyżuru".
4. **Przebudowa starego panelu** (usunięcie martwego bloku `mutedTypes`,
   likwidacja twardych kolorów, zamiana kart na tabelę przy fladze OFF). Stary
   tryb ma zostać **bajt w bajt**.
5. **My Work** — Home, Executive, radar, `rollupSignals`.
6. **Adapter `v8_execution_signals`**, warstwa `AGGREGATED`, notyfikacje.
7. **`mute-domain`** — endpoint istnieje, ale zakres akcji wiersza jest
   zamknięty na snooze/dismiss/mute-type. Jeśli uznasz, że warto — wpis do
   raportu, nie kod.
8. **`MODULE_ACCEPTANCE.md` 13_CHAT** — `CHAT-OWN-004` żyje tam wyłącznie w
   zbiorczym wierszu `CHAT-OWN-001–017` (`:62`); jego rozbicie dotknęłoby 16
   cudzych pozycji, więc `DEC-107` uznał STOP dnia 18 w tej sprawie za zasadny.
   **Nie edytujesz tego pliku.**
9. **E2E/Playwright poza `dev-render/shot.mjs`.** Zrzuty robisz z harnessu, nie
   z aplikacji z logowaniem.

### 1.5. Decyzje wiążące

| Decyzja                                 | Co z niej wynika dla Ciebie                                                                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DEC-2026-08-26-89` (D3 = B)            | Feed jest **organizacyjny z filtrem roli**, a **sprawy własne wyróżnione**. `isMine` z DTO musi być widoczne w tabeli (nie tylko w podglądzie).                                   |
| `DEC-2026-08-26-89` (D2 = B)            | Sygnały `origin='INTERPRETED'` mogą przyjść z rodowodem (`provenance`) — front ma je **obsłużyć jako dane**, oznaczyć pochodzenie i pokazać rodowód w podglądzie. Zero włączania. |
| `DEC-2026-08-26-107` / `-110`           | Mechanika jest scalona i zweryfikowana na żywym PG; DTO jest zamknięty. Zmiana kontraktu = STOP.                                                                                  |
| `DEC-2026-08-25-65`                     | Zero deployów, zero Railway, zero zdalnych migracji, zero zapisów do wspólnej bazy.                                                                                               |
| `DEC-2026-08-26-104` (Z20)              | Dowodem jest osiągalność z realnego wejścia, nie istnienie pliku.                                                                                                                 |
| `DEC-2026-08-26-107` (Z21)              | Test z wstrzykniętą flagą nie dowodzi niczego — musi być test realnego modułu flagi.                                                                                              |
| `DEC-2026-08-26-108` (Z22/Z23)          | Zakaz atrapy ze skutkiem; pomiar testów bez zawężania.                                                                                                                            |
| `DEC-2026-08-25-25` (za projektem §5.2) | Brak uprawnienia do destynacji → akcja **wyłączona z wyjaśnieniem**, nie martwy klik.                                                                                             |
| CLAUDE.md §1/§9                         | Ekran listowy WYŁĄCZNIE `StandardTable`/`StandardModuleBar`; powłoka nie klei własnej tabeli.                                                                                     |
| CLAUDE.md §3                            | `primary-*` = crimson; czerwień tylko dla semantyki krytycznej; fokus `c-focus`.                                                                                                  |
| CLAUDE.md §7                            | Ty renderujesz, Ty robisz zrzut, Ty go oglądasz i naprawiasz — dopiero potem człowiek.                                                                                            |

### 1.6. ★ PODZIAŁ FRONT / TYŁ — licencja F, imiennie

**Zasada:** `server/src` jest cudzy i zamknięty. Jedyny wyjątek:

> **LICENCJA F (wąska, warunkowa) — `server/src/services/signals/signalReadModel.ts`:
> wolno dopisać DOKŁADNIE JEDNO addytywne pole do koperty odpowiedzi feedu:
> `producerEnabled: boolean`, czytane z już wyeksportowanej funkcji
> `isSignalProducerEnabled()` (`server/src/jobs/workSignalProducerJob.ts:10`).**

Warunki licencji — **wszystkie naraz**:

1. Zmiana jest **addytywna**: dokładamy klucz do zwracanego obiektu, nie
   zmieniamy `signals` ani `nextCursor`, nie zmieniamy zapytania SQL, nie
   dokładamy drugiego zapytania do bazy.
2. Zmieniasz **dokładnie jeden plik serwera**. Jeżeli okaże się, że potrzebny
   jest drugi (np. eksport, typ w innym module, zmiana trasy) — **STOP**, pozycja
   `G.1` idzie do raportu jako STOP, a front realizuje wariant zapasowy (§A.4
   pkt 3b).
3. Dokładasz **jeden test** w `server/src/services/signals/__tests__/`, czysto
   jednostkowy, **bez bazy** (podstawiasz `db.query` atrapą, ustawiasz
   `process.env.ENABLE_SIGNAL_PRODUCER` i sprawdzasz obie wartości pola).
4. Pole pojawi się **także** w odpowiedzi `GET /my-work/signals` (ta trasa woła
   ten sam read model, `my-work/signals.routes.ts:62-77`) — sprawdź, że stary
   `ChatSignalsPanel` to ignoruje (ignoruje: czyta tylko `signals` i
   `mutedTypes`). Wpisz to do raportu jako świadomy skutek uboczny.
5. **Zero zmian zachowania** przy fladze OFF i ON — pole jest czysto
   informacyjne.

Wszystko inne w `server/` = **STOP**.

### 1.7. Stan faktyczny — co JUŻ JEST (zweryfikowane na markerze)

**Trasy (serwer).**

| Metoda + URL                             | Plik                                                                                                               | Uwaga                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/signals`                       | `server/src/routes/signals.routes.ts:19-39`, montaż `Gateway.ts:719` (`gatewayVerifyToken` + `orgMembershipGuard`) | zwraca `{ signals, nextCursor }`; parametry `limit`, `projectId`, `domain`, `origin`, `severityMin`, `cursor`                                                        |
| `POST /api/signals/refresh`              | `signals.routes.ts:41-71`                                                                                          | throttle 60 s → `429 { error:'THROTTLED', retryAfterSeconds }`; sukces → `200 { producerEnabled, run }`; `body.organizationId ≠ token` → `400 ORGANIZATION_MISMATCH` |
| `GET /api/my-work/signals`               | `server/src/routes/my-work/signals.routes.ts:47-79`, montaż `my-work.routes.ts:2722` + `Gateway.ts:1045`           | ten sam read model; dodatkowo `requireTables(...)`                                                                                                                   |
| `POST /api/my-work/signals/:key/snooze`  | `:151-178`                                                                                                         | presety `1h`/`4h`/`tomorrow`(domyślny)/`week`; `404 SIGNAL_NOT_FOUND` przy obcym/nieznanym kluczu                                                                    |
| `POST /api/my-work/signals/:key/dismiss` | `:180-199`                                                                                                         | jw.                                                                                                                                                                  |
| `POST /api/my-work/signals/mute-type`    | `:106-128`                                                                                                         | `400 TYPE_REQUIRED` przy pustym; zwraca `{ mutedTypes: string[] }`                                                                                                   |
| `POST /api/my-work/signals/mute-domain`  | `:130-149`                                                                                                         | poza zakresem dyżuru                                                                                                                                                 |

**Kontrakt `SignalDTO`** (`server/src/types/workSignals.ts:123-148`,
produkowany w `signalReadModel.ts:108-148`):

```
key            string                      // signal_id (UUID) — klucz akcji
type           string                      // np. 'task_overdue' — MAŁYMI literami
title, body    string                      // rozwinięte przez serwer wg accept-language (ERRATA 8)
severity       'INFO'|'WARNING'|'CRITICAL'  // ŚCIĘTE, blocker→CRITICAL
severityRaw    'info'|'warning'|'critical'|'blocker'   // ★ PEŁNA WAGA
createdAt      string (ISO)
projectId / projectName   string|null
entityType     string   // SourceObjectType
entityId       string
domain         'EXECUTION'|'DECISION'|'RESULTS'|'FINANCE'|'ASSESSMENT'|'MEETINGS'|'MATERIALS'|'GOVERNANCE'
origin         'DETERMINISTIC'|'AGGREGATED'|'INTERPRETED'
source         { evidence: SignalEvidence[]; ruleId: string; ruleVersion: number }
freshness      { lastObservedAt; runAt; nextRunAt: null }
destination    { kind; route; params; permission; allowed: boolean|null }
provenance?    { ... }                     // tylko INTERPRETED
isMine         boolean                     // audience_user_id === userId  ← D3
titleKey / titleParams / bodyKey / bodyParams          // ★ źródło i18n dla frontu
firstObservedAt string
status         'OPEN'                      // stałe w feedzie (ERRATA 6)
```

`SignalEvidence`: `{ ref, refType, version, observedValue, observedAt }`.

**Osiem realnych reguł** (`server/src/services/signals/rules/**`) — do słownika PL:

| `signalType`                   | domena    | waga bazowa                   | klucz tytułu                                   |
| ------------------------------ | --------- | ----------------------------- | ---------------------------------------------- |
| `task_overdue`                 | EXECUTION | `warning`/`critical` (≥7 dni) | `signals.exec.task.overdue.title`              |
| `task_due_soon_not_started`    | EXECUTION | `warning`                     | `signals.exec.task.due_soon_not_started.title` |
| `task_blocked_stale`           | EXECUTION | `critical`                    | `signals.exec.task.blocked_stale.title`        |
| `initiative_no_baseline`       | EXECUTION | `critical`                    | `signals.exec.initiative.no_baseline.title`    |
| `decision_pending_stale`       | DECISION  | —                             | `signals.dec.pending_stale.title`              |
| `decision_blocking_dependents` | DECISION  | —                             | `signals.dec.blocking_dependents.title`        |
| `kpi_threshold_breached`       | RESULTS   | —                             | `signals.res.kpi_threshold_breached.title`     |
| `budget_overspend`             | FINANCE   | —                             | `signals.fin.budget_overspend.title`           |

(Pełne pary klucz→tekst PL/EN masz w
`server/src/services/signals/i18n/dictionary.ts` — **kopiujesz je, nie zmieniasz**.)

**Front.**

| Co                                 | Gdzie                                                                                                                                                                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Panel „Ważne sygnały" (stary tryb) | `src/components/AIChat/ChatSignalsPanel.tsx`                                                                                                                                                                            |
| Montaż panelu + trigger            | `src/components/AIChat/UnifiedChatPanel.tsx:808, 6619-6632, 7345-7351`                                                                                                                                                  |
| Wzorzec flagi                      | `src/utils/criterionWorkspaceV2Flag.ts` (118 linii)                                                                                                                                                                     |
| Wzorzec testu realnej flagi        | `src/components/Audit/method/workspace/__tests__/CriterionWorkspaceGate.realFlag.test.tsx`                                                                                                                              |
| Tabela                             | `src/components/standard/StandardTable.tsx` (`columns`, `rows`, `onRowClick`, `density`, opcjonalny `surfaceId`)                                                                                                        |
| Pasek modułu                       | `src/components/standard/StandardModuleBar.tsx` — **wszystkie propy opcjonalne**; Menu 3 przez `chips`/`activeChip`/`onChipChange` + `menu3Right`                                                                       |
| Podgląd (6 bloków)                 | `src/components/standard/StandardPreview.tsx`                                                                                                                                                                           |
| Układ tabela+podgląd               | `src/components/shared/TableWithPreviewLayout.tsx` (single click → podgląd, `J`/`K`, `Esc`)                                                                                                                             |
| Transport                          | `src/services/api.ts` — `Api.get('/signals?…')` → `/api/signals`; błąd niesie `err.status`, `err.data`, czasem `err.retryAfter`                                                                                         |
| Harness                            | `dev-render/vite.config.ts` (root = `dev-render`, alias `@`, `publicDir` = `public/`), `dev-render/shot.mjs` (Playwright), przykład: `dev-render/materials-registry*.tsx` + `dev-render/screens/materials-registry.tsx` |

### 1.8. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **Szuflada ma dziś `max-w-md`** (`ChatSignalsPanel.tsx:343`). Tabela + podgląd
   w 448 px to katastrofa. Geometria za flagą jest **zadana** (§A.3 pkt 3) — nie
   dobierasz jej „na oko" i **nie zmieniasz** szerokości przy fladze OFF.
2. **`destination.allowed` bywa `null`** — gdy `req.can` nie jest ustawione
   (`signalReadModel.ts:138`). `null` **nie znaczy „brak uprawnień"** — znaczy
   „nie wiadomo". Traktuj `false` jako brak uprawnienia (pigułka wyłączona z
   wyjaśnieniem), a `null` jako „dozwolone, ale bez potwierdzenia" — **nigdy
   odwrotnie**, bo ukryjesz działającą akcję.
3. **`type` jest małymi literami**, a `mute-type` normalizuje do wielkich
   (`my-work/signals.routes.ts:114-116`, `FIX-7c`). Nie licz na spójność — sam
   normalizuj po stronie odczytu.
4. **Kursor jest nieprzezroczysty** (base64url `lastObservedAt|signalId`). Nie
   parsujesz go, nie budujesz własnego — przekazujesz 1:1 jako `?cursor=`.
5. **Vite harness i symlink `node_modules`**: config ma dedykowany
   `cacheDir` i `dedupe` dla React — **nie zmieniaj tego**, inaczej dostaniesz
   „Invalid hook call" z dwóch kopii React.
6. **`git add -f`** dla nowych plików w `tests/` — inaczej commit „przejdzie",
   a plików nie będzie w repo (klasyczne fałszywe zielono).
7. **Sprawdź `PriorityCell.tsx`** zanim napiszesz własną komórkę wagi — jeśli
   semantyka nie pasuje, rób własną **na tokenach `c-*`**, nigdy `primary-*`.
8. **Nie wołaj API w `dev-render`.** Harness ma być bez sieci: wstrzykujesz dane
   propem albo podmieniasz `Api` lokalnie w pliku ekranu harnessu (nie w kodzie
   produkcyjnym). Każde `4xx/5xx` z harnessu wypisuje `shot.mjs` — ma być pusto.

---

## §F. FLAGA — pozycja F.1

### F.1 — `ff_chatSignalsFeed`, fail-closed

**Cel:** jeden przełącznik, który przy każdym błędzie i przy braku ustawienia
daje **OFF**.

**Zakres pliku:** `src/utils/chatSignalsFeedFlag.ts` (NOWY) — kopiujesz strukturę
`src/utils/criterionWorkspaceV2Flag.ts` z **jedną różnicą**: rozstrzygnięcie
kończy się na `?? false`, a `catch` też daje `false`.

```
LS_KEY    = 'ff.chat_signals_feed'
QUERY_KEY = 'ff_chatSignalsFeed'
ENV_KEY   = 'VITE_CHAT_SIGNALS_FEED'
kolejność: query > localStorage > env > DEFAULT OFF
eksport:   isChatSignalsFeedEnabled(): boolean
           resetChatSignalsFeedFlagCache(): void
           CHAT_SIGNALS_FEED_FLAG_KEYS = { localStorage, query, env }
```

**Nagłówek pliku (komentarz)** ma zawierać: po co flaga, co bramkuje, dlaczego
default OFF (odbiór wizualny właściciela przed włączeniem, CLAUDE.md §7/§9) i
kto ją zdejmuje (nadzorca po akcepcie zrzutów).

**DoD F.1:**

- test `src/utils/__tests__/chatSignalsFeedFlag.test.ts` (wzorzec
  `criterionWorkspaceV2Flag.test.ts`): brak override → **false**; `?ff_chatSignalsFeed=1`
  → true; `localStorage='on'` → true; query `0` wygrywa nad `localStorage='on'`
  → false; rzucający `localStorage` → **false** (fail-closed, nie wyjątek);
  cache + reset;
- **zero** zmian w `useFeatureFlags.tsx`;
- `prettier` + wpis w raporcie.

---

## §D. CZYTNIK DTO I SŁOWNIKI — pozycja D.1

### D.1 — jeden typ, jedna waga, polskie słowa

**Cel:** front ma **jedno** miejsce, w którym surowe DTO zamienia się w rzeczy
nadające się do pokazania człowiekowi.

**Pliki (NOWE):**

- `src/components/AIChat/signalsFeed/signalTypes.ts` — typy TS lustrzane do
  `server/src/types/workSignals.ts` (przepisujesz, **nie importujesz** z
  `server/`), plus `SignalsFeedResponse = { signals: SignalDTO[]; nextCursor: string | null; producerEnabled?: boolean }`.
- `src/components/AIChat/signalsFeed/signalPresentation.ts` — funkcje czyste:
  - `readSeverity(dto): 'info'|'warning'|'critical'|'blocker'` — **z `severityRaw`**,
    z normalizacją wielkości liter; fallback na `severity` (z odwzorowaniem
    `CRITICAL→critical`) **tylko** gdy `severityRaw` brak; funkcja zwraca też
    `wasCapped: boolean` (gdy musiała użyć fallbacku) — do raportu, nie do UI;
  - `severityRank` (info 0 · warning 1 · critical 2 · blocker 3) — do sortowania;
  - `signalTitle(dto, t)` / `signalBody(dto, t)` — **z `titleKey`+`titleParams`**
    przez i18n frontu; gdy klucza nie ma w słowniku → **serwerowe `title`/`body`**;
    gdy i tego nie ma → `chatSignals.untitled`;
  - `signalAge(dto, now, t)` — z `firstObservedAt`, po polsku, względnie
    („12 min temu", „3 godz. temu", „wczoraj", „5 dni temu"). **Zero ISO na
    ekranie**; pełna data trafia w `title=` atrybut jako tooltip.

**Słowniki (`public/locales/{pl,en}/translation.json`, gałąź `chatSignals`)** —
minimum:

- `chatSignals.severity.{info,warning,critical,blocker}`
  (PL: `Informacja`, `Ostrzeżenie`, `Krytyczny`, `Blokada`);
- `chatSignals.domain.{EXECUTION,DECISION,RESULTS,FINANCE,ASSESSMENT,MEETINGS,MATERIALS,GOVERNANCE}`
  (PL: `Wykonanie`, `Decyzje`, `Wyniki`, `Finanse`, `Ocena`, `Spotkania`,
  `Materiały`, `Nadzór`);
- `chatSignals.origin.{DETERMINISTIC,AGGREGATED,INTERPRETED}`
  (PL: `Reguła`, `Zbiorczy`, `Interpretacja AI`);
- `chatSignals.status.OPEN` (PL: `Otwarty`);
- `chatSignals.rule.<klucz serwerowy>` — **9 par tytuł/treść 1:1** z
  `server/src/services/signals/i18n/dictionary.ts`, z zachowaniem placeholdera
  `{value}` (i18next: `{{value}}` — konwersję nazwy parametru robisz w
  `signalTitle`, nie w słowniku serwera);
- `chatSignals.age.*`, `chatSignals.empty.*`, `chatSignals.error.*`,
  `chatSignals.action.*` (dobierz spójnie, PL wiodące).

**DoD D.1:**

- **PL i EN w tym samym commicie**, klucz w klucz (sprawdź skryptem/porównaniem,
  wynik do raportu);
- testy jednostkowe: `blocker` nie degraduje się do `critical`; brak
  `severityRaw` → fallback ze ścieżką `wasCapped`; nieznany `titleKey` → tekst z
  serwera; brak obu → `untitled`; wiek dla 5 progów czasu; **zero surowych
  enumów** (test asertuje polskie napisy);
- `prettier` + wpis w raporcie.

---

## §A. EKRAN FEEDU — pozycje A.2, A.3, A.4

### A.2 — Resolver destynacji: nigdy martwy klik

**Powód:** ERRATA §1.2 poz. 7. Serwer podaje `destination.route`, którego
aplikacja może nie znać.

**Plik (NOWY):** `src/components/AIChat/signalsFeed/signalDestination.ts`.

**Co robisz — dokładnie:**

1. Budujesz **jawną tabelę** `SIGNAL_DESTINATIONS: Record<signalType, { route: (dto) => string | null; label: string; sourceOfTruth: string }>`
   dla **ośmiu** typów z §1.7. `route` zwraca **realną, istniejącą trasę** albo
   `null`.
2. **Każdą pozycję weryfikujesz sam** — `grep` w `src/routes/routeConfig.ts` i
   `src/routes/AppRoutes.tsx` — i w komentarzu przy pozycji zapisujesz
   `plik:linia` trasy docelowej albo słowo `BRAK_TRASY`.
3. Wynik funkcji `resolveDestination(dto)`:
   - `{ kind: 'ROUTE', href }` — trasa istnieje **i** `allowed !== false`;
   - `{ kind: 'FORBIDDEN', reason }` — `allowed === false`;
   - `{ kind: 'NO_ROUTE', reason }` — trasy nie ma (albo typ spoza tabeli).
4. **Zakaz** budowania trasy z `destination.route` „na wiarę". Zakaz
   `navigate(dto.destination.route)`. Zakaz `window.open`.
5. Jeśli **wszystkie osiem** wypadnie `BRAK_TRASY` — to jest **poprawny wynik**,
   nie porażka. Wpisujesz go do raportu jako znalezisko `P1` dla nadzorcy
   („projekt §7 bramka odbioru pkt 4 niespełniona na poziomie reguł serwerowych"),
   a UI konsekwentnie pokazuje wyłączoną pigułkę z wyjaśnieniem.

**DoD A.2:** tabela ośmiu pozycji w raporcie (`signalType` → `route` z serwera →
werdykt → `plik:linia` dowodu); ≥4 testy (trasa jest / `allowed=false` /
`allowed=null` → dozwolone / typ nieznany → `NO_ROUTE`); zero `navigate` w ciemno.

### A.3 — Ekran: `StandardModuleBar` (Menu 3) + `StandardTable`

**Plik (NOWY):** `src/components/AIChat/signalsFeed/ChatSignalsFeed.tsx`
(+ `useSignalsFeed.ts` na pobieranie).

1. **Pobieranie** (`useSignalsFeed.ts`):
   - `Api.get('/signals?' + params)` — **trasa kanoniczna `/api/signals`**, nie
     `/my-work/signals` (ta druga jest powierzchnią zgodności dla starego panelu);
   - parametry: `limit=50`, `projectId` (z kontekstu rozmowy, jak dziś),
     `domain`, `origin`, `severityMin`, `cursor`;
   - **paginacja przez `nextCursor`**: przycisk „Pokaż starsze" dokleja stronę
     (`signals` rosną, `nextCursor` się nadpisuje); brak `nextCursor` → przycisk
     znika. **Zakaz cichego obcinania** (stary panel pobierał 50 i pokazywał 12 —
     to był defekt M01-012);
   - stan błędu rozróżnia `401/403` od reszty (wzorzec `errorKind` z istniejącego
     panelu — **rozszerzasz, nie zwężasz**, Z15).
2. **Menu 3** — `StandardModuleBar` z **wyłącznie** `chips` / `activeChip` /
   `onChipChange` (+ ewentualnie `menu3Right` na przycisk „Odśwież" z C.1).
   **Bez Menu 1 i Menu 2** (breadcrumbs/tabs/CTA) — to nie jest moduł główny,
   to powierzchnia w Chacie. Chipy (z licznikami, licznik widoczny także przy 0):
   - `wszystkie`;
   - `moje` — **klient**, po `isMine` (D3);
   - domeny obecne w danych: `EXECUTION`, `DECISION`, `RESULTS`, `FINANCE` —
     **serwer**, przez `?domain=`;
   - waga: `≥ ostrzeżenie`, `≥ krytyczny` — **serwer**, przez `?severityMin=`.
     **Chipa roli NIE MA** (ERRATA 5). Chip serwerowy przeładowuje listę od
     początku (kursor się resetuje); chip kliencki nie strzela do API. **Różnicę
     widać w UI** — chip kliencki ma dopisek „(z załadowanych)" w tooltipie.
3. **Geometria za flagą (zadana, nie do negocjacji):** przy ON szuflada panelu
   rośnie z `max-w-md` do `max-w-[1040px] w-full` i nadal jest przyklejona do
   prawej krawędzi; przy OFF **nic się nie zmienia**. Wewnątrz:
   `TableWithPreviewLayout` (tabela z lewej, podgląd z prawej).
   Przy szerokości okna < 1024 px podgląd schodzi pod tabelę (zachowanie
   `TableWithPreviewLayout` — nie obchodzisz go własnym CSS).
   **Tabela nigdy nie scrolluje poziomo całej strony** — wąskie kolumny mają
   `truncate`, nie łamanie układu.
4. **Kolumny — dokładnie sześć**, w tej kolejności:

   | id         | nagłówek PL | treść                                                                                 | uwagi                                                                                                                             |
   | ---------- | ----------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
   | `signal`   | Sygnał      | tytuł (D.1) + druga linia = treść, przycięta                                          | **kolumna identyfikująca**; wyróżnienie „moje": kropka/wskaźnik + `aria-label`, **nigdy sam kolor**                               |
   | `domain`   | Domena      | słownik PL                                                                            |                                                                                                                                   |
   | `severity` | Waga        | 4 poziomy z `severityRaw`                                                             | crimson **wyłącznie** dla `critical`/`blocker`; `blocker` musi być odróżnialny od `critical` (nie tylko odcieniem — też etykietą) |
   | `source`   | Źródło      | `origin` (słownik) + `ruleId` w tooltipie; przy `INTERPRETED` znacznik pochodzenia AI |                                                                                                                                   |
   | `age`      | Wiek        | względny czas z `firstObservedAt`, tooltip = pełna data                               |                                                                                                                                   |
   | `status`   | Status      | słownik PL (`Otwarty`)                                                                | ERRATA 6 — kolumna stała z definicji; wpis w raporcie                                                                             |

   Sortowanie domyślne: **waga malejąco, potem wiek malejąco** (`severityRank`,
   potem `lastObservedAt`). Sortowanie jest **klientowe, na załadowanych
   stronach** — i tak to opisujesz w raporcie (serwer sortuje po
   `last_observed_at DESC`).

5. **Bramka w `ChatSignalsPanel.tsx` (licencja wąska)** — dozwolone są
   **dokładnie trzy** rodzaje zmian w tym pliku:
   - import `isChatSignalsFeedEnabled` i `ChatSignalsFeed`;
   - jedna stała `const feedV2 = isChatSignalsFeedEnabled();`;
   - warunkowe: (a) klasa szerokości szuflady, (b) **treść** panelu
     (`feedV2 ? <ChatSignalsFeed … /> : <istniejąca treść bez zmian />`).
     **Powłoka dialogu (`id="chat-signals-panel"`, `role="dialog"`,
     `aria-modal="true"`, nagłówek z tytułem i „×") zostaje nietknięta** —
     ERRATA 13. Żadnych innych zmian, żadnego „przy okazji".

**DoD A.3:** ≥6 testów (render pełnej listy · chip serwerowy strzela z
`?domain=` · chip kliencki nie strzela · `nextCursor` dokleja stronę · brak
`nextCursor` chowa przycisk · **flaga OFF → renderuje się stary panel**);
`check-list-canon.sh` zielony na nowych plikach; dowód osiągalności (Z20);
zrzuty z E.2.

### A.4 — Sześć stanów, każdy uczciwy

| #   | Stan                                            | Warunek                                     | Co widać                                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Pełny**                                       | `signals.length > 0`                        | tabela + licznik „N sygnałów"                                                                                                                                                                                               |
| 2   | **Pusty (producent działa)**                    | `signals.length === 0` **i** producent ON   | „Brak otwartych sygnałów" + jedno zdanie, co to znaczy (warunki reguł nie są spełnione — to dobry stan), + data ostatniego przebiegu, jeśli znana                                                                           |
| 3a  | **Producent wyłączony** (wariant z licencją F)  | `producerEnabled === false` z koperty feedu | „Producent sygnałów jest wyłączony — dopóki nie zostanie włączony, ta lista będzie pusta niezależnie od stanu projektów." **Bez** „brak sygnałów"                                                                           |
| 3b  | **Producent nieznany** (wariant bez licencji F) | brak pola `producerEnabled`                 | „Brak otwartych sygnałów" + druga linia: „Nie wiemy, czy producent sygnałów jest włączony — sprawdź przyciskiem Odśwież." Po `POST /refresh` z `producerEnabled:false` przechodzisz w komunikat ze stanu 3a **na tę sesję** |
| 4   | **Brak uprawnień**                              | `err.status` 401/403                        | istniejąca treść `aiChat.signals.forbidden`, `role="alert"`                                                                                                                                                                 |
| 5   | **Błąd**                                        | inne `err.status` / brak sieci              | „Nie udało się sprawdzić sygnałów" + `Ponów` (bez auto-ponawiania)                                                                                                                                                          |
| 6   | **Dławienie**                                   | 429 z `POST /refresh`                       | „Odświeżanie będzie dostępne za N s" — licznik maleje, przycisk wyłączony do zera (C.1)                                                                                                                                     |

**Zakaz łączenia stanów.** Stan 5 **nigdy** nie może wyglądać jak stan 2 — to był
dokładnie defekt M01-P03 naprawiony w istniejącym panelu; nie cofasz go.

**DoD A.4:** po jednym teście na stan (6), każdy sprawdza **treść** (nie klasę
CSS); zrzuty stanów 1, 2/3a, 6 i podglądu (E.2).

---

## §B. PODGLĄD — pozycja B.1

### B.1 — `StandardPreview`, sześć bloków, realne akcje

**Plik (NOWY):** `src/components/AIChat/signalsFeed/ChatSignalsFeedPreview.tsx`.
**Zakaz własnego panelu** — deklarujesz treść, `StandardPreview` narzuca wygląd
(CLAUDE.md §1, skill `consultify-preview`).

Mapowanie sześciu bloków:

1. **Nagłówek** — tytuł sygnału; `Open` = destynacja z A.2 (wyłączona przy
   `NO_ROUTE`/`FORBIDDEN`, z wyjaśnieniem); `×` zamyka podgląd.
2. **Meta** — pigułki: waga (`severityRaw`), domena, pochodzenie
   (`origin`, przy `INTERPRETED` znacznik AI), projekt (`projectName`),
   „moje" gdy `isMine`; trailing = **świeżość** („zmierzone 14:15",
   z `freshness.lastObservedAt`, względnie + tooltip z pełną datą).
3. **Treść / Szczegóły** — `body` (D.1) + **„Skąd wiadomo"**: lista
   `source.evidence` (`refType` przez słownik PL, `observedValue`,
   `observedAt` względnie) + `ruleId`/`ruleVersion` jako podpis drobnym drukiem.
   Gdy `evidence` puste → **uczciwie**: „Brak zapisanych dowodów" (nie zmyślasz).
4. **Rodowód (tylko `origin='INTERPRETED'`)** — `provenance` (dostawca, model,
   wersje promptu/szablonu, pewność, na jakich sygnałach oparty) w bloku
   zwijanym. Gdy `provenance` brak przy `INTERPRETED` → **wyraźna informacja o
   braku rodowodu**, nigdy ukrycie (`DEC-51`: zakaz atrapy AI).
5. **Relacje** — obiekt źródłowy (`entityType` + `entityId` przez słownik PL) i
   projekt; klikalne **tylko** gdy A.2 zwróci `ROUTE`.
6. **Akcje (pigułki)** — dokładnie te, które mają endpoint:
   - **Drzemka** — `POST /my-work/signals/{key}/snooze` z **wyborem presetu**
     (`1h`, `4h`, `do jutra`, `tydzień`) — stary panel wysyłał na sztywno `1h`,
     nie powielaj tego;
   - **Ukryj** — `POST /my-work/signals/{key}/dismiss`;
   - **Wycisz typ** — `POST /my-work/signals/mute-type` `{ type }` —
     **z potwierdzeniem** i jawnym ostrzeżeniem „tej operacji nie da się cofnąć z
     aplikacji" (ERRATA 12);
   - **Zapisz do Notatnika / do Moich pomysłów** — **NIE przenosisz** ze starego
     panelu (poza zakresem; jeśli uznasz, że warto — wpis do raportu).
     Kebab podglądu: bez własnych wynalazków; jeżeli `StandardPreview` wymaga
     pozycji kebaba, dajesz w nim „Kopiuj identyfikator sygnału".

**Reguła Z22 dla każdej akcji:** klik → blokada przycisku → odpowiedź →

- `2xx`: wiersz znika z listy **i** licznik maleje **i** komunikat mówi, co się
  stało i na jak długo (dla drzemki — do kiedy, z `snoozedUntil`);
- `4xx/5xx`: **wiersz zostaje**, przycisk wraca, komunikat mówi dlaczego (`404
SIGNAL_NOT_FOUND` → „sygnał już nie istnieje, odśwież"; `403` w trybie demo →
  „w trybie demo ta akcja jest zablokowana", ERRATA 11).

**DoD B.1:** ≥6 testów (każda z trzech akcji: sukces + 4xx bez zniknięcia
wiersza); test presetów drzemki; test bloku „Skąd wiadomo" przy pustych
dowodach; test `INTERPRETED` bez `provenance`; zrzut podglądu light+dark.

---

## §C. ODŚWIEŻENIE — pozycja C.1

### C.1 — `POST /signals/refresh` i uczciwe dławienie

1. Przycisk „Odśwież" w Menu 3 (`menu3Right`).
2. Wywołanie: `Api.post('/signals/refresh', {})` — **bez `organizationId` w
   body** (serwer odrzuca niezgodne `400 ORGANIZATION_MISMATCH`; wysyłanie
   zgodnego jest zbędne i ryzykowne).
3. Odpowiedzi:
   - `200 { producerEnabled: true, run }` → od razu przeładowanie feedu od
     pierwszej strony; komunikat „Odświeżono";
   - `200 { producerEnabled: false, run }` → **stan 3a** z §A.4 (producent
     wyłączony) na tę sesję; feed przeładowany, ale komunikat mówi prawdę;
   - `429` → **stan 6**: czas z `err.retryAfter ?? err.data?.retryAfterSeconds`;
     przycisk wyłączony, licznik maleje co sekundę, po zejściu do zera przycisk
     wraca. **Zero automatycznego ponawiania** (ERRATA 9);
   - `4xx/5xx` inne → stan 5.
4. **Zakaz odpalania `refresh` automatycznie** przy otwarciu panelu, przy zmianie
   chipa i w interwale. To zapis, nie odczyt (ERRATA 10 — pisze wiersz do ledgera).

**DoD C.1:** ≥4 testy (200 ON · 200 OFF · 429 z liczbą sekund z `data` · 429 z
`Retry-After`); test, że po 429 przycisk jest wyłączony i **nie** ma drugiego
`POST`; zrzut stanu 6.

---

## §G. LICENCJA F — pozycja G.1 (warunkowa)

### G.1 — `producerEnabled` w kopercie feedu

Realizujesz **tylko** wtedy, gdy spełnisz wszystkie pięć warunków z §1.6.
Inaczej: STOP i wariant 3b z §A.4.

- `server/src/services/signals/signalReadModel.ts`: import
  `isSignalProducerEnabled` z `../../jobs/workSignalProducerJob.js`, dopisanie
  `producerEnabled: isSignalProducerEnabled()` do zwracanego obiektu **i** do
  sygnatury typu zwrotnego.
- Test jednostkowy **bez bazy** w `server/src/services/signals/__tests__/`:
  `db.query` = atrapa zwracająca `[]`; `ENABLE_SIGNAL_PRODUCER='true'` → pole
  `true`; brak zmiennej → `false`; `signals`/`nextCursor` bez zmian.
- W raporcie: jawnie, że pole pojawia się też w `GET /my-work/signals` i że stary
  panel je ignoruje.

**Jeżeli w trakcie okaże się, że trzeba dotknąć drugiego pliku serwera — STOP,
cofasz zmianę, front idzie wariantem 3b.**

---

## §E. HARNESS I ZRZUTY — pozycje E.1, E.2

### E.1 — `dev-render` z danymi PL

**Pliki (NOWE):** `dev-render/chat-signals-feed.html`,
`dev-render/chat-signals-feed-main.tsx`, `dev-render/screens/chat-signals-feed.tsx`
(wzorzec 1:1 z `materials-registry*`).

1. Renderujesz **REALNY** komponent `ChatSignalsFeed` (nie makietę) z
   `I18nextProvider` (`src/i18n`) i `MemoryRouter`.
2. **Dane mock po polsku i spójne fabularnie** — organizacja **Metalpol**,
   osoby **Anna Kowalska** (konsultantka, właścicielka części sygnałów →
   `isMine: true`) i **Marek Nowak**. Minimum **9 wierszy** pokrywających:
   wszystkie cztery wagi (w tym **blocker**), cztery domeny (EXECUTION,
   DECISION, RESULTS, FINANCE), `origin` `DETERMINISTIC` **i** `INTERPRETED`
   (jeden z `provenance`, jeden bez — dla stanu uczciwego braku rodowodu),
   sygnał z `isMine: true` i bez, sygnał z pustym `evidence`, sygnał z długim
   tytułem (test przycięcia), `destination.allowed` w wariantach `true`/`false`/`null`.
3. **Zero sieci.** Dane wstrzykujesz propem/kontekstem; jeśli komponent pobiera
   sam — w ekranie harnessu podstawiasz warstwę pobierania (lokalnie, w pliku
   harnessu). Kod produkcyjny **nie może** mieć gałęzi „jeśli harness".
4. Sterowanie przez query: `?theme=light|dark` (motyw), `?stan=pelny|pusty|producent-off|dlawienie`
   (stany z §A.4), `?podglad=1` (otwarty podgląd pierwszego wiersza).
   Flagę wymuszasz w harnessie przez `?ff_chatSignalsFeed=1` — **to jest też
   dowód, że bramka działa z query**.
5. Uruchomienie (z katalogu worktree, **port 3026**):
   ```bash
   npx vite --config dev-render/vite.config.ts --port 3026
   ```

### E.2 — Zrzuty: pięć stanów × dwa motywy, obejrzane przez Ciebie

```bash
mkdir -p docs/program/waves/WAVE_03_ACCEPTANCE/evidence/chat-signals-front-20260826
node dev-render/shot.mjs \
  docs/program/waves/WAVE_03_ACCEPTANCE/evidence/chat-signals-front-20260826/01-pelny-light.png \
  "http://localhost:3026/chat-signals-feed.html?ff_chatSignalsFeed=1&theme=light&stan=pelny" --w=1440 --h=900
```

Komplet **dziesięciu** plików (nazewnictwo obowiązkowe):

```
01-pelny-light.png            01-pelny-dark.png
02-pusty-light.png            02-pusty-dark.png
03-producent-off-light.png    03-producent-off-dark.png
04-podglad-light.png          04-podglad-dark.png
05-dlawienie-light.png        05-dlawienie-dark.png
```

**★ Warunek oddania pozycji (CLAUDE.md §7):** **oglądasz każdy z dziesięciu
zrzutów** i wypełniasz w raporcie tabelę „co zobaczyłem → co poprawiłem".
Minimum, czego szukasz:

- czerwień poza semantyką krytyczną (crimson na CTA/aktywnym chipie = **wada**);
- kontrast w ciemnym motywie (szary tekst na szarym tle);
- ucięte/nachodzące napisy, poziomy pasek przewijania strony;
- surowe enumy (`WARNING`, `EXECUTION`) i surowe daty ISO;
- puste kolumny, kolumny bez sensu, brak wyróżnienia „moje";
- ramka fokusu inna niż `c-focus` (sprawdź `--key=Tab` w `shot.mjs`);
- **`KONSOLA-BLEDY` i `SIEC-4XX5XX` z `shot.mjs` muszą być PUSTE** — wynik
  wklejasz do raportu.

Deklaracja „zrzuty zrobione" bez tabeli obserwacji = **pozycja niezaliczona**.

---

## §T. TESTY — pozycja własna, nie dodatek

### T.1 — pakiet testowy i pomiar Z23

1. **Lokalizacja:** `tests/components/AIChat/signalsFeed/**` (nowe pliki →
   `git add -f`) + `src/utils/__tests__/chatSignalsFeedFlag.test.ts`.
2. **Obowiązkowy test realnej flagi (Z21)** — bez `vi.mock` na
   `chatSignalsFeedFlag`, wzorzec `CriterionWorkspaceGate.realFlag.test.tsx`:
   - bez override'u → renderuje się **stary** panel (fail-closed);
   - `?ff_chatSignalsFeed=1` → renderuje się nowy feed;
   - `localStorage` rzucający wyjątkiem → stary panel, **bez** wyjątku w renderze.
3. **Obowiązkowy test „OFF nic nie zmienia"** — przy fladze OFF `ChatSignalsPanel`
   renderuje dokładnie te elementy co dziś (`chat-signals-count`,
   `chat-signal-primary-action`, `chat-signals-empty`) — czyli **istniejący**
   `tests/components/AIChat/ChatSignalsPanel.actions.test.tsx` musi pozostać
   **zielony bez zmian**. Jeśli go zmienisz — wpis „przed/po" (§0.4a pkt 5).
4. **Zakaz testów dotykających bazy** (Z19). Transport mockujesz **lokalnie** w
   swoim pliku (`vi.mock('@/services/api', …)`), nigdy globalnie (Z18).
5. **Pomiar Z23** wg §0.4a — dwie tabele (ZASTANE / WPROWADZONE) z kolumną
   SKIPPED.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~50 min, NIE pomijasz)

1. Marker + gałąź + worktree + symlink `node_modules` (§0.1).
2. Komendy weryfikacyjne (a)–(f) z §0.1 pkt 3 — wyniki do raportu.
3. **Przeczytaj w całości:** projekt (763 linie, `git show`), raport dnia 18
   (190 linii), `ChatSignalsPanel.tsx` (524), `signalReadModel.ts` (159),
   `my-work/signals.routes.ts` (201), `signals.routes.ts` (73),
   `criterionWorkspaceV2Flag.ts` (118).
4. **Pomiar ZASTANY (Z23)** — pełna lista z §0.4a na **markerze**, przed
   pierwszym commitem.
5. Weryfikacja ośmiu destynacji (A.2 pkt 2) — tabela do raportu.

### Blok 1 — fundament (F.1 → D.1 → A.2)

Tanie, czyste, bez UI. Po każdym: `prettier`, `esbuild`, test celowany, commit.

### Blok 2 — ekran (A.3 → A.4)

Najpierw tabela na realnych komponentach, potem stany. Bramkę w
`ChatSignalsPanel.tsx` wstawiasz **na końcu A.3** — i od razu sprawdzasz, że
`chatHeaderControls.ownerFeedback.test.ts` i
`ChatSignalsPanel.actions.test.tsx` są zielone.

### Blok 3 — podgląd i akcje (B.1 → C.1)

Każda akcja z parą testów (sukces / 4xx bez zniknięcia wiersza).

### Blok 4 — licencja F (G.1) — TYLKO jeśli warunki §1.6 spełnione

Przy pierwszym sygnale, że trzeba dotknąć drugiego pliku serwera — STOP i
wariant 3b.

### Blok 5 — harness i zrzuty (E.1 → E.2)

**To jest blok, w którym najczęściej wychodzą wady.** Zaplanuj na niego czas na
poprawki: zrzut → obejrzenie → poprawka → **ponowny zrzut**. Do repo trafia
komplet **po** poprawkach.

### Blok 6 — domknięcie (obowiązkowo, ~60 min)

1. `bash scripts/check-list-canon.sh --all` — wynik do raportu (Twoje pliki: 0).
2. Sprawdzenie, że `scripts/hardcoded-colors.baseline.json` i
   `scripts/a11y-jsx.baseline.json` **nie są zmienione**
   (`git diff --name-only` nie zawiera ich).
3. Parytet PL/EN kluczy `chatSignals.*` — wynik do raportu.
4. **Pomiar WPROWADZONY (Z23)** — pełna lista z §0.4a na `HEAD`.
5. Dowód zamrożenia: `git diff --name-only <marker>...HEAD` (§0.1 pkt 6) — lista musi się
   zgadzać z ramką „WOLNO" z §0.2, plik po pliku.
6. Raport (R.1).

### Zasada nadrzędna kolejności

**Nigdy nie zaczynasz kolejnej pozycji, zanim poprzednia nie ma commita i wpisu
w raporcie.** Jeżeli utkniesz — STOP w raporcie i przechodzisz dalej; dyżur z
ośmioma uczciwymi pozycjami i trzema STOP-ami jest wart więcej niż jedenaście
pozycji „gotowych" z jedną atrapą.

---

## 9. RAPORT — jedyny dokument, który tworzysz

`docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_SIGNALS_FRONT_DAY26_REPORT_20260826.md`

### 9.1. Szablon

```markdown
# Chat — front feedu sygnałów, dzień 26 — raport dyżuru 2026-08-26

Baza: `codex/m03-admin-20260824 @ <marker>` · Marker: POTWIERDZONY / BRAK
Gałąź robocza: `codex/chat-signals-front-day26-20260826`
Worktree: `/private/tmp/consultify-chat-signals-front-day26`
Porty: harness `3026` (albo pierwszy wolny — jaki) · lokalny PG: ŻADEN
Migracje: ŻADNE

## Oświadczenia

- Chroniony katalog `/Users/piotrwisniewski/Developer/Consultify`: nie czytałem ani nie zmieniałem; jedyny kontakt to read-only symlink `node_modules`: TAK/NIE
- Nie zmieniłem niczego w `server/src` poza licencją F (albo: nie użyłem licencji F): TAK/NIE
- Nie dodałem migracji, trasy SPA ani drugiej flagi: TAK/NIE
- Nie zmieniłem wartości domyślnej żadnej istniejącej flagi: TAK/NIE
- Nie użyłem Railway, deployu, zdalnej bazy ani wspólnej bazy demo: TAK/NIE
- Nie wywołałem providera AI: TAK/NIE
- Nie wykonałem push na `origin` ani merge: TAK/NIE
- Zrzuty obejrzałem osobiście przed oddaniem: TAK/NIE

## Warunki wstępne — tabela

| Kontrola (§0.1 pkt 3) | Oczekiwane | Wynik | Konsekwencja |

## ★ WERYFIKACJA ERRATY §1.2 — czternaście punktów

| # | Twierdzenie erraty | Potwierdzone? | Dowód (plik:linia / komenda) |

## Pozycje

| Pozycja | Status | Commit | Dowód osiągalności (Z20) | Dowód testowy | Zrzuty |
| F.1 · D.1 · A.2 · A.3 · A.4 · B.1 · C.1 · G.1 · E.1 · E.2 · T.1 | ZROBIONE_WG_DoD / CZĘŚCIOWO / STOP | | | | |

## ★ TABELA PARYTETU Z PROJEKTEM (warunek oddania raportu)

| Wymaganie projektu (§/blok) | Co dowiozłem | Rozbieżność | Powód |
| §5.2 kształt DTO — `severity` z `BLOCKER` | czytam `severityRaw` (4 poziomy) | projekt opisuje pole, którego kod nie ma | ERRATA 3 |
| §5.5 trigger do prawej grupy nagłówka (CHAT-OWN-004/010) | NIEDOSTARCZONE | poza zakresem dyżuru | §1.4 poz. 3 |
| §7 blok B5 — `source`/`freshness`/`severity`/`destination` w panelu | … | … | … |
| §7 rejestr flag — `chatSignalsProducerV1` | `ff_chatSignalsFeed` (util modułowy) | inna nazwa i inny mechanizm | ERRATA 14 |
| §7 bramka odbioru pkt 4 — „każdy sygnał ma klikalną destynację" | … | … | A.2 |
| DEC-89 D3 — sprawy własne wyróżnione | … | … | … |
| (uzupełnij o KAŻDY punkt §5.2, §5.4, §5.5, §7 B5 i bramkę odbioru §7) |

## ★ TABELA OŚMIU DESTYNACJI (A.2)

| `signalType` | `route` z serwera | Trasa w SPA (plik:linia) | Werdykt | Co widzi użytkownik |

## ★ ZRZUTY — co zobaczyłem, co poprawiłem (CLAUDE.md §7)

| Plik zrzutu | Co zobaczyłem | Wada? | Poprawka (commit) | Zrzut po poprawce |
Wynik `KONSOLA-BLEDY` / `SIEC-4XX5XX` z `shot.mjs`: <dosłownie>

## ★ POMIAR TESTÓW (Z23) — PEŁNY zakres §0.4a

### Czerwone ZASTANE (na markerze, PRZED pierwszym commitem)

### Czerwone WPROWADZONE przez dyżur

| Plik/pakiet | PASS | FAIL | SKIPPED | Uwaga |
Deklaracja: ZASIĘG PEŁNY / ZASIĘG CZĘŚCIOWY (+ co pominięte i dlaczego)

## Flaga i licencje

| Flaga | Default | Czytelnik | Test realnego modułu |
| `ff_chatSignalsFeed` | OFF | `src/utils/chatSignalsFeedFlag.ts` | … |

| Licencja | Plik | Co dokładnie zmieniłem |
| L-panel | `src/components/AIChat/ChatSignalsPanel.tsx` | (import + stała + dwa warunki) |
| L-F | `server/src/services/signals/signalReadModel.ts` | (jedno pole) albo NIEUŻYTA |

## i18n

Klucze dodane: <lista> · Parytet PL/EN: <wynik porównania>

## Kanon

`check-list-canon.sh --all`: <wynik> · naruszenia w moich plikach: <liczba, ma być 0>
`hardcoded-colors.baseline.json` / `a11y-jsx.baseline.json`: NIEZMIENIONE / ZMIENIONE (dlaczego)

## STOP-y i znaleziska

### STOP — <pozycja> (format §0.5)

## Korekty wobec instrukcji

## Dowód zamrożenia (DEC-65 + §0.2)

`git diff --name-only <marker>...HEAD` — lista plików + zgodność z ramką „WOLNO"

## Licznik i czego nie zrobiono

<N pozycji: X ZROBIONE_WG_DoD, Y CZĘŚCIOWO, Z STOP; flaga nadal OFF>
Gotowe do polish-passu nadzorcy.
```

**Ostatnie zdanie raportu ma brzmieć „Gotowe do polish-passu nadzorcy." —
nigdy „gotowe do pokazania właścicielowi".**

---

## 10. Czego NIE robisz na koniec

- Nie pushujesz na `origin`. Nie mergujesz. Nie tagujesz.
- Nie włączasz flagi (ani swojej, ani serwerowych).
- Nie sprzątasz cudzych worktree ani cudzych kontenerów PG.
- Nie edytujesz `MODULE_ACCEPTANCE.md`, rejestru decyzji ani raportu dnia 18.
- Nie pokazujesz niczego właścicielowi.
