# INSTRUKCJA DYŻURU nr 13 — Codex — „Interview Creator Shell: budowa kreatora Wniosku wg zaakceptowanego prototypu (DEC-2026-08-25-67, komplet 10 rekomendacji) — wspólna powłoka dla kreatora Wniosku i Inicjatywy, za flagą default OFF"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–12. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Poprzednie dyżury dotyczyły Admin/Superadmin (nr 1–2), My Work (nr 3),
Results i Finance (nr 4), Initiatives (nr 5), Szablonów (nr 6), Assessment
(nr 7), Results (nr 8), Initiatives (nr 9), Meetings (nr 10), Execution
(nr 11) i Partner (nr 12). **Ten dyżur ich nie kontynuuje.** To osobny
obszar budowy: **powłoka kreatora w module Interview (Wywiad)**, wg decyzji
właściciela **`DEC-2026-08-25-67`**.

**Uwaga o numeracji — przeczytaj, żeby się nie pomylić.**

| Moduł | Katalog rejestru w repo | Trasa runtime | Decyzja o tożsamości adresu |
| --- | --- | --- | --- |
| Interview (Wywiad) | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/` | `/interview` (jedyny adres kanoniczny) | `DEC-2026-08-24-01` (`OWNER_DECISION_LEDGER_2026-08-24.md:23`) |

`/discovery` i `/project-intelligence` to **trwałe przekierowania**, nie druga
tożsamość modułu. `/discovery/canvas` i `/interview/respond/:token` to osobne
ekrany i **nie należą do tego dyżuru**.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Budujesz WYGLĄD I ZACHOWANIE POWŁOKI kreatora — nie budujesz nowej
mechaniki biznesowej, nie zmieniasz silnika analizy, nie tworzysz czwartej
powłoki kreatorów i nie włączasz niczego na żywo.**

Konkretnie:

1. **Cała nowa powierzchnia idzie za JEDNĄ nową flagą, domyślnie OFF,
   wszędzie — również na demo.** Flaga robocza: `interviewCreatorShell`
   w NOWYM pliku `src/utils/interviewCreatorShellFlag.ts`
   (wzorzec `interviewPipelineStepperFlag` — patrz §2.4). **Każda druga nowa flaga = STOP.**
   Flagi **nie włączasz**; włączenie po odbiorze wykonuje nadzorca.
2. **Nie powstaje czwarta powłoka kreatorów.** Powłoka to **rozszerzenie
   ISTNIEJĄCEGO `src/components/shared/WizardModal`**. `ToolWizardShell`
   zostaje kanoniczną powłoką narzędzi na trasie i **nie jest kopiowany ani
   zastępowany**. Utworzenie nowego, równoległego komponentu-powłoki
   (`CreatorShell.tsx` jako byt niezależny od `WizardModal`) = **odrzucenie
   dyżuru**. Nowy plik w katalogu `shared/WizardModal/` jest dozwolony
   **wyłącznie** jako część tej samej rodziny (wspólne typy, wspólny eksport
   z `index.ts`, jeden token geometrii) — patrz §S.1.
3. **Prototyp jest WIĄŻĄCY co do markupu, etykiet i geometrii.** Trzy pliki
   `docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/interview-creator-prototyp-{01-definicja,02-material,03-dostrojenie}.html`
   są **jedynym** źródłem prawdy o wyglądzie. Sekcje „Co ten ekran
   rozstrzyga" w tych plikach to **pytania 1–10 rozstrzygnięte przez
   właściciela** decyzją `DEC-2026-08-25-67` — wariant oznaczony
   `★ rekomendacja` jest **wybrany i obowiązujący**. Nie wolno wybrać
   innego wariantu i nie wolno „ulepszyć" prototypu.
4. **NIE DRD.** To jest kreator **wywiadu klasycznego**: Wniosek i Inicjatywa
   powstają z **zatwierdzonych sesji wywiadu**. DRD (`Method Core`,
   `DrdMethodWorkspaceScreen` / `MethodWorkspaceShell`, tryby
   `Interview | Matrix | Report`) ma własny silnik serwerowy i **nie wchodzi
   w tę powłokę** (`DEC-2026-08-24-02`). Dotknięcie DRD = **STOP**.
5. **Kroki 3–5 kreatora Inicjatywy (Kandydaci · Nadzór · Wynik) są bez
   dowodu** — `STEPS_3_5_EVIDENCE_MISSING`
   (`modules/02_INTERVIEW/MODULE_ACCEPTANCE.md:88`). Jeżeli Twoja praca
   dotknęłaby któregokolwiek z nich — **STOP i wpis w raporcie**, nie
   improwizacja.
6. **Odbiór wizualny = nadzorca, po dyżurze.** Twoja rola kończy się na
   „gotowe do zrzutu przez nadzorcę". **Nigdy** nie piszesz „gotowe do
   pokazania właścicielowi" ani „gotowe do włączenia flagi".
   Powód: CLAUDE.md reguła 7 — właściciel nigdy nie jest pierwszym testerem
   wizualnym.
7. **★ KONTRAKT DEC-2026-08-25-65 — ZERO OPERACJI CHMUROWYCH.** Do
   komunikatu „FREEZE ZAKOŃCZONY" (którego **nie dostaniesz w tym dyżurze**)
   obowiązuje: **zakaz deployów, zakaz jakiejkolwiek interakcji z Railway
   (CLI, env, domeny, redeploy, logi), zakaz zdalnych migracji/seedów/
   resetów, zakaz zapisu do wspólnej bazy demo/staging, zakaz merge
   i force-push na `demo`/`develop`/`main`.** Ten dyżur **nie ma migracji**
   i **nie ma bazy zdalnej** — pracujesz wyłącznie lokalnie. Kolizja
   z cudzą pracą → `COORDINATION_REQUIRED` w raporcie, nigdy samodzielne
   rozwiązanie.

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości
reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.

   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: dfd259af47**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor dfd259af47 codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, nie startuj z `main`,
   nie startuj z `Londyn`, nie startuj z żadnej gałęzi `codex/preserve-*`
   ani `codex/wave3-16-module-acceptance-*`. Załóż raport, wpisz pozycję STOP
   z wynikiem obu komend powyżej i zakończ dyżur. To jedyna dopuszczalna
   reakcja.

   Powód twardości: `codex/m03-admin-20260824` niesie **komplet materiałów
   wiążących tego dyżuru** — rejestr decyzji z `DEC-2026-08-25-67`, pliki
   prototypu z sekcjami rozstrzygającymi pytania 1–10, wytyczne
   `CONSULTING_CREATOR_GUIDELINES.md`, rejestr rekomendacji
   `INTERVIEW_RECOMMENDATION_REGISTER.md` oraz korpus dowodowy
   `INT-CREATOR-EVD-001..005`. Praca poza tą bazą = praca bez wymagań.

3. **Sprawdź, że materiały wiążące faktycznie widzisz** (warunek wstępny,
   nie formalność):

   ```bash
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md          # oczekiwane 119
   grep -n "DEC-2026-08-25-67" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :119
   grep -n "DEC-2026-08-24-01" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :23  (D1)
   grep -n "DEC-2026-08-24-02" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :24  (D2)
   grep -n "DEC-2026-08-25-65" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :117 (freeze)
   ls -la docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/interview-creator-prototyp-0*.html               # oczekiwane 3 pliki
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/CONSULTING_CREATOR_GUIDELINES.md        # oczekiwane 238
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/INTERVIEW_RECOMMENDATION_REGISTER.md    # oczekiwane 73
   wc -l docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/CREATOR_SKEPTICAL_REVIEW.md             # oczekiwane 77
   ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/evidence/tables-owner-review-2026-08-22/ | grep INT-CREATOR-EVD
   grep -n "INT-CREATOR-EVD-00" docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/evidence/tables-owner-review-2026-08-22/INDEX.md
   ```

   Brak któregokolwiek = **STOP**. Brak plików prototypu = **STOP
   bezwarunkowy** — bez nich nie masz wymagań wizualnych i nie wolno Ci
   zgadywać.

4. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/interview-creator-day13-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/interview-creator-day13-20260825`.)

5. Pracujesz we **własnym worktree**, nigdy w cudzym:

   ```bash
   git worktree add /private/tmp/consultify-interview-creator-day13 codex/interview-creator-day13-<data>
   cd /private/tmp/consultify-interview-creator-day13
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź | Push wykonuje wyłącznie nadzorca sesji głównej |
| Z2 | **Nie dotykasz `origin/demo`** ani lokalnego `demo`, ani `Londyn`, ani `develop`, ani `main` | `demo` = święta baza deployu; `DEC-65` zakazuje merge/force-push na te gałęzie do końca freeze'u |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych** | Krach 3/4 powstał dokładnie tak |
| **Z4** | **★ NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików oznaczonych `PRESERVED_PRODUCT_WIP` / `NO_COPY` w `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md` | Wymagania są **już** przełożone na rejestr uwag, wytyczne i prototyp. Zajrzenie tam nie da Ci nic nowego, a może Cię skłonić do cofnięcia modułu |
| **Z5** | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`, ani `grep -r`** | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree**: `/private/tmp/consultify-day13-instrukcja` (worktree tej instrukcji), `/private/tmp/consultify-creator-prototyp`, `/private/tmp/consultify-mod05-interview`, `/private/tmp/consultify-interview-preview`, `/private/tmp/consultify-day{2,3,4,5,7,8,9,10,11,12}-*`, `/private/tmp/consultify-m0*`, `/private/tmp/consultify-admin55-*`, `/private/tmp/consultify-audits-*`, `/private/tmp/consultify-partner-day12`, `/private/tmp/consultify-execution-day11`, `/private/tmp/consultify-meetings-day10*`, `/private/tmp/consultify-wave3-runtime-*` | Cudze worktree, część jest w użyciu przez równoległe dyżury |
| Z7 | **Nie zajmujesz portów zajętych przez inne dyżury** (3987 sesja nadzorcza; 3350 domyślny port harnessu dev-render; pasmo odbiorowe 4280–4481). Lokalny runtime aplikacji — **4324/4325**; harness dev-render — **3356** | Kolizja portów psuje cudze runtime'y odbiorowe |
| **Z8** | **★ Zero interakcji z Railway i zero operacji chmurowych (`DEC-2026-08-25-65`)** — brak `railway` CLI, brak zmiennych env, brak redeployu, brak logów produkcyjnych, brak domen, brak deployu na staging | Freeze przed pokazem demo. Kontrakt wiążący do odwołania |
| **Z9** | **★ Żadnej bazy zdalnej ani wspólnej** — nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB. **W tym dyżurze nie potrzebujesz ŻADNEJ bazy** — harness dev-render działa bez backendu i bez logowania | `DEC-65` + „dane demo = twarz produktu" |
| **Z10** | **★ Zero migracji.** Ten dyżur nie dodaje ani jednej migracji SQL. Jeżeli uznasz, że potrzebujesz zmiany schematu — to jest **STOP**, nie improwizacja | Freeze (`DEC-65`) + zakres dyżuru jest czysto frontendowy |
| **Z11** | **Powstaje CO NAJWYŻEJ JEDNA nowa flaga (`interviewCreatorShell`, wzorzec `interviewPipelineStepperFlag`, OFF wszędzie). Żadna istniejąca flaga nie zmienia wartości domyślnej. Żadna inna flaga nie powstaje** | CLAUDE.md reguła 9 (zakaz masowego włączania flag) + krach 07-12 |
| Z12 | **Nie zmieniasz tras.** `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts` i przekierowania `/discovery`, `/project-intelligence` — **nietknięte**. Kreator jest **dialogiem nad listą pod `/interview`**, nigdy osobną trasą (`DEC-2026-08-24-01`, D1) | Gramatyka tras zaakceptowana przez właściciela |
| Z13 | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/INTERVIEW_DAY13_REPORT_<data>.md`. Jedyny inny dokument, który wolno Ci zmienić, to `modules/02_INTERVIEW/MODULE_ACCEPTANCE.md` — i **wyłącznie** w ramach pozycji `R.1` | Repo tonie w dokumentach-duchach |
| Z14 | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** (w szczególności `:23` D1, `:24` D2, `:105` DEC-53, `:109` DEC-57, `:117` DEC-65, `:119` DEC-67) i nie podważasz ich w kodzie ani w raporcie. **Nie zmieniasz plików prototypu** | Rejestr decyzji jest `FINAL / IRREVOCABLE`; prototyp jest dowodem akceptu |
| **Z15** | **Nie budujesz i nie zmieniasz silnika AI.** Nie podpinasz dostawcy modelu, nie zmieniasz promptów, nie zmieniasz kontraktu odpowiedzi analizy. Budujesz **powierzchnię nad istniejącym serwisem** albo uczciwy wpis `BRAK_API` | Silnik AI = moduł agenta, ostatni w programie |
| **Z16** | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych** ani istniejącej mechaniki biznesowej kreatora. Właściciel powiedział wprost: „**merytorycznie to narzędzie jest ok**, tylko nie da się nim teraz zarządzać". Treść i mechanika zostają — zmienia się **sposób zarządzania nimi** | `INT-CREATOR-OWN-001` (`MODULE_ACCEPTANCE.md:88`) |
| **Z17** | **★ Zakaz wszystkiego poza powłoką kreatora.** Nie dotykasz: Organization, Settings, Admin, Superadmin, Chat, Assessment/DRD, Tools, Execution, Results, Finance, Audits, Partner, My Work, Meetings, Materials. **W samym Interview** dotykasz WYŁĄCZNIE punktów montażu kreatora — `InterviewHub.tsx` ma **10 077 linii** i jest żywym, zaakceptowanym ekranem (DEC-53, DEC-57). Ostra granica w ramce poniżej | Program konsolidacji „jeden moduł na raz"; lista, zakładki, kebaby i preview Interview mają **akcept właściciela na zrzutach** — przypadkowa zmiana kasuje jedyne, co przeszło |
| **Z18** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie Z18 = automatyczne odrzucenie CAŁEGO dyżuru** | **Lekcja z odbioru dnia 2:** Codex po cichu zmienił globalny mock w `tests/setup.ts` i wywalił **27 testów w cudzych modułach** |
| **Z19** | **Nie zmieniasz `src/components/standard/**` ani `src/components/shared/**` poza katalogiem `src/components/shared/WizardModal/`** — a i tam wyłącznie addytywnie i pod flagą. `PreviewPaneShell`, `PreviewActionBar`, `StandardTable`, `StandardModuleBar` — **WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ** | `DEC-2026-08-25-57` zamknął preview Interview na zrzutach; kanon list jest zamrożony |

**Zasięg Z18 — konkretnie, bo to jest zakaz, który najłatwiej złamać
„w dobrej wierze".**

```
tests/setup.ts                     ← plik, na którym poległ dyżur nr 2
tests/helpers/**                   (w tym unifiedMockSetup.js)
tests/__mocks__/**                 (llmApi, server/database, node-cron, @google/generative-ai, aws-sdk-client-s3)
vitest.config.ts
vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
vitest.perf.config.ts  vitest.migration.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**Co robisz, gdy potrzebujesz innego zachowania mocka.** Dokładnie jedno
z dwóch, zawsze **opt-in, nigdy globalnie**:

1. **`vi.mock` lokalnie w Twoim pliku testowym** — mock żyje i umiera razem
   z tym jednym plikiem;
2. **dedykowany helper w NOWYM pliku**, importowany jawnie tylko przez Twoje
   testy (np. `src/components/Interview/__tests__/creatorShellDay13Harness.ts`).
   Nowy plik, nie dopisek do istniejącego helpera współdzielonego.

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka", „to jest
addytywne, nic nie zepsuje", „inaczej mój test nie przejdzie". Jeśli Twój test
nie przechodzi bez zmiany globalnego mocka — to jest **STOP**, opisany
w raporcie.

**Zasięg Z17 — konkretnie. Granica jest ostra i przebiega tak:**

```
WOLNO (Twój zakres):
  src/components/shared/WizardModal/**                    (rozszerzenie rodziny: WizardModal.tsx,
                                                           WizardStepper.tsx, types.ts, index.ts
                                                           + NOWE pliki tej samej rodziny — §S.1)
  src/utils/interviewCreatorShellFlag.ts                  (NOWY plik — jedna flaga, §S.0)
  src/utils/__tests__/interviewCreatorShellFlag.test.ts   (NOWY test wartości domyślnej)
  src/components/Interview/InsightCreatorModal.tsx        (2 670 linii — główny plik dyżuru)
  src/components/Interview/__tests__/**                   (NOWE pliki; istniejące — patrz §T.1)
  src/components/Interview/InterviewHub.tsx               (★ WYŁĄCZNIE punkty montażu kreatora
                                                           z §1.5 pułapki 5 — import :137, stan :781,
                                                           render :10049 (+ :72/:758/:9373 jeśli §W).
                                                           NIC POZA TYM — §Z17.a)
  src/components/Initiatives/Wizard/InitiativeWizardModal.tsx  (★ WYŁĄCZNIE powłoka i kroki 1–2, za flagą — §W)
  public/locales/{pl,en}/translation.json                 (TYLKO klucze pod `interview.creator.*`)
  dev-render/screens/interview-creator-shell.tsx          (NOWY ekran harnessu — §T.5)
  dev-render/main.tsx                                     (WYŁĄCZNIE rejestracja jednego nowego ekranu)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/MODULE_ACCEPTANCE.md   (TYLKO §R.1)
  docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/evidence/day13/**      (TYLKO nowe zrzuty §R.2)
  docs/program/waves/WAVE_03_ACCEPTANCE/INTERVIEW_DAY13_REPORT_<data>.md            (jedyny nowy dokument)

NIE WOLNO:
  src/components/standard/**  ·  src/components/shared/**  (poza WizardModal/)   ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  src/components/shared/ToolWizardShell*                                          ← powłoka narzędzi, nietykalna
  src/routes/AppRoutes.tsx  ·  src/routes/routeConfig.ts                          ← D1
  src/components/Interview/* poza InsightCreatorModal i punktami montażu w InterviewHub
       (w szczególności: InterviewInsightPreview, InterviewSessionPreview,
        InterviewInitiativePreview, InterviewTemplatePreview, TemplateBuilder,
        InterviewSingleQuestionRuntime, InsightViewer, AssignInterviewModal)      ← akcepty DEC-53 / DEC-57
  src/components/shared/UnifiedCreateLauncher.tsx  (montuje InsightCreatorModal :33,:190)  ← Z19, tylko odczyt
  src/components/ui/primitives/useDialogA11y.ts                                   ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  src/hooks/useFeatureFlags.tsx · src/contexts/FeatureFlagsContext.tsx             ← centralny rejestr flag, poza zakresem
  src/components/Assessment/**  ·  wszystko DRD (MethodWorkspaceShell,
        DrdMethodWorkspaceScreen, Method Core)                                    ← D2, granica twarda
  src/components/Initiatives/** poza InitiativeWizardModal (i tam tylko §W)
  server/**                                                                        ← dyżur czysto frontendowy
  server/migrations/**                                                             ← Z10
  tests/setup.ts · tests/helpers/** · tests/__mocks__/** · vitest*.config.ts        ← Z18
  tests/e2e/**  ·  tests/acceptance/**                                             ← cudzy tor odbiorowy
  docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/**                              ← dowód akceptu, TYLKO ODCZYT
  wszystko inne
```

**Z17.a — reguła montażu w `InterviewHub.tsx` (10 077 linii).** To jest
najgroźniejszy plik dyżuru. Wolno Ci w nim zmienić **dokładnie tyle, żeby
kreator za flagą ON mógł się zamontować, a przy fladze OFF zachowanie było
bit-w-bit dzisiejsze**. Praktycznie oznacza to jeden warunek przy renderze
`InsightCreatorModal` (linia ~10 049) albo przekazanie jednego propsa.
**Zakazane:** refaktor Huba, wyciąganie stanu, zmiana zakładek, zmiana
tabeli, zmiana kebabów, zmiana preview, „przy okazji" poprawki i18n,
formatowanie całego pliku prettierem. Diff w `InterviewHub.tsx` większy
niż **20 linii** wymaga jawnego uzasadnienia w raporcie; większy niż
**60 linii** to **STOP**.

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie,
czego dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej
linii importu".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Nie zbiorcze
  „rebuild creator everywhere".
- **Conventional commits**, wzór:
  ```
  feat(interview): add interviewCreatorShell flag (pipeline-stepper model) + OFF proof (S.0)
  feat(interview): shared 1040x840 creator geometry token in WizardModal (S.1)
  feat(interview): four glass bands with reduced-transparency fallback (S.2)
  feat(interview): step 1 Definicja — 6 basic type cards + collapsed BCG group (K.1)
  test(interview): flag-off proof for the creator shell (T.2)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem — ale TYLKO na plikach
  tego commita.**
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
  **Zakazane:** `npx prettier --write src/` i cokolwiek, co przeformatuje
  `InterviewHub.tsx` w całości.
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest`
  repo.** Punktowo:
  ```bash
  npx vitest run src/components/Interview/__tests__
  npx vitest run src/components/Initiatives/Wizard/__tests__
  npx vitest run tests/components/Interview          # jeśli katalog istnieje
  ```
- **★ KAŻDA nowa powierzchnia = minimum CZTERY testy zachowania**:
  happy path · ścieżka błędu · pusty stan („brak danych" ≠ „brak danych
  spełniających warunki") · **dowód OFF** (przy fladze OFF nowa powierzchnia
  **nie istnieje** w drzewie i nie leci żadne nowe żądanie).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**.
  W tym repo takie testy istnieją (m.in. `*.ownerContract.test.ts`
  w `src/components/Interview/__tests__/`) i wolno Ci je zostawić — ale
  **każda Twoja pozycja musi mieć co najmniej jeden test, który RENDERUJE
  realny komponent i sprawdza WYNIK w drzewie DOM** (`@testing-library/react`).
  Grep-test wolno dołożyć jako dodatek, nigdy jako dowód.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok
  kodu w `src/` dodają się normalnie.
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json    # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild src/components/Interview/InsightCreatorModal.tsx --loader:.tsx=tsx --outfile=/dev/null   # OK
  ```
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodź ich przez
  `--no-verify`. Jeśli hook blokuje — popraw kod, nie hook.
  ```bash
  bash scripts/check-list-canon.sh src/components/Interview/InsightCreatorModal.tsx
  bash scripts/check-artefakt.sh    # jeżeli istnieje w tej bazie
  ```
  **`scripts/check-list-canon.sh --update` jest w tym dyżurze ZAKAZANE.**
  Baseline `scripts/check-list-canon.baseline.txt` **nie zmienia się** i jest
  jednym z dowodów Bloku 6.
- **Dane demo = twarz produktu.** Harness dev-render używa **mocków w pliku
  ekranu**, nie bazy. Zero rekordów testowych w jakiejkolwiek bazie.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Zero atrap.** Każda kontrolka, którą widać, coś robi. Kontrolka, dla
   której nie ma API — **nie powstaje**; zamiast niej idzie wpis `BRAK_API`
   do raportu. Etykieta obiecująca skutek, którego nie ma („Pokaż
   wykluczone (3)" bez listy wykluczonych) jest dokładnie tym defektem,
   którego nie wolno powielić.
2. **Realne dane tam, gdzie są.** Odczyt i zapis idą do istniejącego
   backendu przez istniejące serwisy. Zero nowych mocków w kodzie
   produkcyjnym, zero `sampleData`, zero zaszytych tablic, zero
   `localStorage` jako źródła prawdy (poza szkicem — §S.5, który jest
   jawnie oznaczony i ma zdefiniowany kontrakt).
3. **★ PARYTET Z PROTOTYPEM.** Powierzchnia odpowiada odpowiedniemu plikowi
   prototypu **co do struktury, etykiet i geometrii**: te same nazwy pasów,
   te same etykiety przycisków, te same wysokości (60/70/36/70 px), ta sama
   szerokość treści (880 px), ta sama liczba i kolejność sekcji. Odstępstwo
   = wpis w raporcie z uzasadnieniem, nie cicha zmiana.
4. **Minimum 4 testy zachowania** przechodzą: happy · błąd · pusty stan ·
   dowód OFF. **Testy grepujące źródło nie liczą się** (§0.3).
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson
   `#85182F`. Czerwień **wyłącznie** semantyka krytyczna. CTA i stany aktywne
   = neutralne (`--c-cta-bg` / `--c-active-bg`), **nigdy `bg-c-accent`**,
   **nigdy `btn-primary` jako „krok aktywny"**. Fokus = niebieski
   `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
   **★ Pułapka tego dyżuru:** dzisiejszy `WizardModal` ma
   `DEFAULT_ACCENT = 'rgb(var(--color-primary-600, 79 70 229))'`
   (`WizardModal.tsx:45`) i maluje nim pasek nagłówka oraz przycisk główny
   (`:162`, `:243`). **W nowej powłoce akcent musi być neutralny** — prototyp
   nie ma ani jednego kolorowego CTA. Zmiana `DEFAULT_ACCENT` dotyka
   **wszystkich** konsumentów `WizardModal` → robisz to **za flagą**, nie
   globalnie (§S.1 pkt 5).
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod — **klucz tworzysz
   w chwili tworzenia napisu, nie „na końcu"**. Zero polskich literałów
   w JSX, zero angielskich literałów w JSX. Klucze w
   `public/locales/pl/translation.json` **i**
   `public/locales/en/translation.json`, wyłącznie w gałęzi
   `interview.creator.*`. **Parytet PL/EN musi się zgadzać co do liczby
   kluczy** (§T.4).
7. **Light i dark** — powierzchnia wygląda poprawnie w obu motywach.
   Prototyp definiuje oba (zmienne `:root` i `:root[data-theme="dark"]`).
8. **★ Zrzut własny dla każdej NOWEJ powierzchni wizualnej** — dev-render
   z mockiem, **light i dark, PL**, wykonany przez Ciebie, wrzucony do
   `modules/02_INTERVIEW/evidence/day13/`. Zrzut czysty: zero gwiazdek, zero
   ozdób, tokeny `c-*`. **Bez zrzutu pozycja wizualna jest CZĘŚCIOWA.**
   Do każdego zrzutu dokładasz **porównanie z prototypem** (§R.2).
9. **Plik przepuszczony przez `prettier`** przed commitem (tylko pliki
   commita).
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych. Równolegle 27 testów w cudzych modułach było
czerwonych — przez zmianę w pliku współdzielonym.

**Przed oddaniem raportu wykonujesz pomiar zasięgu:**

1. Wypisz **wszystkie** pliki, które dotknąłeś:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Z tej listy wyodrębnij pliki **współdzielone** — takie, które importuje
   ktokolwiek spoza Twojego zakresu. Sprawdzasz to jawnie, nie z pamięci:
   ```bash
   grep -rln "shared/WizardModal" src/ | sort         # oczekiwane 5 konsumentów
   grep -rln "InsightCreatorModal" src/ | sort
   grep -rln "InitiativeWizardModal" src/ | sort
   ```
   **W tym dyżurze pliki współdzielone z definicji to:**

   `src/components/shared/WizardModal/**` — **pięciu importerów, z czego
   DWÓCH używa pełnej powłoki** (te dwa są najbardziej narażone na Twoją
   zmianę):

   | Importer | Relacja |
   | --- | --- |
   | `src/components/Reports/Wizard/ReportGeneratorWizard.tsx` | **pełna powłoka** `<WizardModal>` (`:47`, `:637`) |
   | `src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx` | **pełna powłoka** `<WizardModal>` (`:23-24`, `:840`) |
   | `src/components/Interview/InsightCreatorModal.tsx` | tylko `WizardStepper` (`:39`) |
   | `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | tylko stepper/typy (`:42`) |
   | `src/components/Audit/AuditOrchestratorWizard.tsx` | tylko `WizardStepper` (`:33`) |

   Dalej: `public/locales/{pl,en}/translation.json`;
   `src/components/Interview/InterviewHub.tsx` (montuje **oba** kreatory —
   `:9373` i `:10049`);
   `src/components/shared/UnifiedCreateLauncher.tsx` (montuje
   `InsightCreatorModal` — `:33`, `:190`; **nie zmieniasz go**, ale musisz
   pokazać, że nic mu się nie stało).
3. **Uruchom testy KATALOGÓW konsumentów**, nie tylko własnych plików.
   Minimum dla tego dyżuru:
   ```bash
   npx vitest run src/components/Interview/__tests__
   npx vitest run src/components/Initiatives/Wizard/__tests__
   npx vitest run tests/components/Interview
   npx vitest run tests/components/ToolWizardShell.canon-runtime.test.tsx
   npx vitest run src/components/Audit/__tests__            # jeśli istnieje
   npx vitest run src/components/Reports/__tests__          # jeśli istnieje
   npx vitest run src/routes/__tests__/interviewAliasRedirect.test.ts
   npx vitest run src/utils/__tests__/interviewPipelineStepperFlag.test.ts
   ```
   **★ Testy są w DWÓCH miejscach** — obok kodu (`src/**/__tests__/`)
   i centralnie (`tests/components/**`). Pominięcie drugiego to
   `ZASIĘG CZĘŚCIOWY`. Istotne pliki centralne:
   `tests/components/Interview/InsightCreatorModal.context-documents.test.tsx`,
   `tests/components/Interview/InsightCreatorModal.error-state.test.tsx`,
   `tests/components/Interview/InterviewHub.test.tsx`.
   jeśli ruszałeś `public/locales/*`:
   ```bash
   grep -rln "i18n\|useTranslation" tests/ | head -20      # i wymień w raporcie skalę
   npx vitest run tests/unit/i18n                          # jeśli katalog istnieje
   ```
4. **W raporcie deklarujesz zasięg jawnie**, w sekcji „Testy":
   - `ZASIĘG PEŁNY` — uruchomiłeś testy wszystkich **pięciu** katalogów
     konsumentów `WizardModal` i podajesz ich wyniki;
   - `ZASIĘG CZĘŚCIOWY` — uruchomiłeś tylko własne pliki. **Wtedy piszesz to
     wprost i wymieniasz, czego nie uruchomiłeś i dlaczego.**

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy
improwizacja.**

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- musiałbyś **stworzyć drugą flagę** albo zmienić domyślną wartość
  istniejącej (Z11);
- musiałbyś **stworzyć nowy, równoległy komponent-powłokę** zamiast
  rozszerzyć `WizardModal` (★ pkt 2) — to jest **STOP bezwarunkowy**;
- musiałbyś **dotknąć DRD** albo przenieść cokolwiek z DRD do tej powłoki
  (D2, ★ pkt 4);
- musiałbyś **dotknąć kroków 3–5 kreatora Inicjatywy** (Kandydaci · Nadzór ·
  Wynik) — `STEPS_3_5_EVIDENCE_MISSING`, ★ pkt 5;
- musiałbyś **stworzyć trasę** dla kreatora albo otworzyć go pod adresem
  innym niż `/interview` (D1, Z12);
- musiałbyś **zmienić plik prototypu**, żeby „pasował do kodu" (Z14) — to
  jest odwrócenie kierunku dowodu;
- musiałbyś **zmienić `DEFAULT_ACCENT` globalnie** w `WizardModal` i tym
  samym zmienić wygląd czterech cudzych kreatorów (DoD 5, §S.1 pkt 5);
- musiałbyś **zbudować kontrolkę, dla której nie ma API** — wtedy nie
  budujesz jej wcale; wpis `BRAK_API` z pełną tabelą jest **wynikiem
  pełnowartościowym** (DoD 1);
- musiałbyś **dodać migrację** albo dotknąć `server/**` (Z10, Z17);
- musiałbyś wykonać **jakąkolwiek operację chmurową** — deploy, Railway,
  zdalna baza, merge na `demo` (Z8, `DEC-65`);
- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej** —
  z jednym jawnym wyjątkiem opisanym w §T.1 i tylko na warunkach tam
  podanych;
- **test nie przechodzi i naprawa wymagałaby zmiany GLOBALNEGO mocka lub
  configu vitest (Z18)** — to jest STOP zawsze, bez wyjątku i bez
  „addytywnie, więc nic nie zepsuje";
- **pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module** — nie
  „naprawiasz" ich po cichu: opisujesz w raporcie, który commit je zapalił;
- diff w `InterviewHub.tsx` przekroczyłby **60 linii** (Z17.a);
- musiałbyś **zgadnąć rozstrzygnięcie kwestii otwartej** z §1.7. **Nie
  zgadujesz** — piszesz propozycję i STOP.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

22 sierpnia właściciel przeszedł moduł Interview ekran po ekranie. O dwóch
kreatorach — Wniosku (dziś: „AI Insight Creator") i Inicjatywy — powiedział
dosłownie (`modules/02_INTERVIEW/MODULE_ACCEPTANCE.md:88`,
`INT-CREATOR-OWN-001`):

> „Mamy dwie bardzo ważne karty: kartę do robienia insightów i później kartę
> do robienia inicjatyw. (…) **muszą wyglądać tak samo**. (…) merytorycznie
> to narzędzie jest ok, tylko niestety **nie da się nim teraz zarządzać**
> w tej postaci."

I dalej:

> „Mechanika jest OK (…) wybieramy insighty i on szybciutko nam proponuje
> obszar, ale to musi być **czytelne** (…) **ekran możemy zrobić większy**
> (…) trzeba sięgnąć po technologię **Liquid Glass** i zarządzać tymi
> ekranami bardzo dobrze."

Uwaga została udowodniona pięcioma zrzutami
(`INT-CREATOR-EVD-001..005`, `evidence/tables-owner-review-2026-08-22/`):

| Dowód | Ekran | Co pokazuje |
| --- | --- | --- |
| `INT-CREATOR-EVD-001` | Definicja | mały modal, ściśnięty trzystopniowy nagłówek, gęste karty typu wyniku; dalsze opcje pod wewnętrznym zagięciem |
| `INT-CREATOR-EVD-002` | Materiał | osoby, daty, rola i dział walczą o wąską kolumnę treści |
| `INT-CREATOR-EVD-003` | Dostrojenie, góra | blok pytania przewodniego, ramka „Advanced" i karty trybu analizy tworzą ramki w ramkach |
| `INT-CREATOR-EVD-004` | Dostrojenie, środek | wewnętrzny scroll dojeżdża do wątków i granicy kontekstu AI, a użytkownik nie ma sygnału postępu |
| `INT-CREATOR-EVD-005` | Dostrojenie, dół | dokumenty kontekstowe dopiero po długim przewijaniu; „Run" widoczny, ale nie wiadomo, co uruchamia |

Ścieżka od uwagi do tego dyżuru wyglądała tak: uwaga → wytyczne ekspertów
(`CONSULTING_CREATOR_GUIDELINES.md`) → dwóch niezależnych sceptyków
(`CREATOR_SKEPTICAL_REVIEW.md`) → rejestr rekomendacji (`REC-INT-001`, P0) →
**prototyp klikalny** (3 pliki HTML) → **akcept właściciela na zrzutach**
z kompletem 10 rekomendacji autora = `DEC-2026-08-25-67`.

**Jedno zdanie, które musisz zrozumieć, zanim zaczniesz:** ten dyżur **nie
zmienia tego, co kreator robi**. Zmienia **to, jak się nim zarządza**.
Mechanika (typy wyniku, tryby analizy, wątki, dokumenty kontekstowe,
uruchomienie analizy) jest przez właściciela **zaakceptowana merytorycznie**.
Twoim produktem jest powłoka, układ, gęstość, sygnalizacja i uczciwość
komunikatów — nic więcej i nic mniej.

### 1.2. Dokumenty wiążące merytorycznie

```
docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/
        interview-creator-prototyp-01-definicja.html      ← WIĄŻĄCY markup kroku 1 + pytania 1–4
        interview-creator-prototyp-02-material.html       ← WIĄŻĄCY markup kroku 2 + pytania 5–7
        interview-creator-prototyp-03-dostrojenie.html    ← WIĄŻĄCY markup kroku 3 + pytania 8–10
        evidence/INT-CREATOR-PROTO-0*_{LIGHT,DARK,LIGHT_PELNA}.png   ← 9 zrzutów, które właściciel zaakceptował
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
        :23   DEC-2026-08-24-01  D1 — /interview jedynym adresem (kreator = dialog nad listą)
        :24   DEC-2026-08-24-02  D2 — DRD osobnym silnikiem (granica twarda)
        :105  DEC-2026-08-25-53  Interview etap 1 na zrzutach; Creator Shell poza partią
        :109  DEC-2026-08-25-57  preview do kanonu; Creator Shell = P0, prototyp przed budową
        :117  DEC-2026-08-25-65  freeze staging/demo/production (Z8, Z9, Z10)
        :119  DEC-2026-08-25-67  TEN DYŻUR — akcept prototypu z kompletem 10 rekomendacji
docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/
        CONSULTING_CREATOR_GUIDELINES.md          (238 linii — profil wymagań; §1, §2, §7, §8, §9, §10 obowiązkowe)
        CREATOR_SKEPTICAL_REVIEW.md               (77 linii — dwóch sceptyków, decyzja „acceptable-v1")
        INTERVIEW_RECOMMENDATION_REGISTER.md      (73 linie — REC-INT-001 P0, REC-INT-007 awarie AI)
        MODULE_ACCEPTANCE.md                      (206 linii — TYLKO ODCZYT poza §R.1)
        evidence/tables-owner-review-2026-08-22/  (INT-CREATOR-EVD-001..005 + INDEX.md z hashami)
docs/ui-standards/TRIADA_KANON.md                 ← tło kreatora = lista /interview, nietykalna
CLAUDE.md                                          ← reguła 7 (pierwszy tester wizualny), reguła 9 (flagi)
```

### 1.3. Decyzje wiążące — sześć

1. **`DEC-2026-08-24-01` (D1)** — `/interview` jest **jedynym** adresem
   kanonicznym modułu. Kreator jest **dialogiem nad listą**, nie trasą.
   Nie tworzy nowego adresu ani nowego wejścia do modułu. Pilnuje tego
   `src/routes/__tests__/interviewAliasRedirect.test.ts:53`.
2. **`DEC-2026-08-24-02` (D2)** — DRD to osobny silnik serwerowy z trybami
   `Interview | Matrix | Report`. **Nie wchodzi w tę powłokę.** Granica
   twarda: dotknięcie = STOP.
3. **`DEC-2026-08-25-53`** — Interview etap 1 zaakceptowany na 19 zrzutach
   (zakładki, redirecty, kebaby, Discovery canvas). Creator Shell **poza
   tamtą partią**.
4. **`DEC-2026-08-25-57`** — panele preview sesji i inicjatywy przebudowane
   do kanonu i zaakceptowane (commit `3a8c11eb4d`). **Nie ruszasz ich.**
5. **`DEC-2026-08-25-65`** — kontrakt rozdzielenia staging/demo/production.
   Do „FREEZE ZAKOŃCZONY": zero deployów, zero Railway, zero zdalnych baz,
   zero merge na `demo`/`develop`/`main`. **Wpisany w Z8/Z9/Z10.**
6. **`DEC-2026-08-25-67`** — **ten dyżur**. Prototyp zaakceptowany
   **z kompletem 10 rekomendacji** (commit prototypu `a1bbae7a36`). Budowa:
   za flagą default OFF, wzorem prototypu 1:1, zrzuty przed włączeniem.

### 1.4. ★ KOORDYNACJA — z czym się nie zderzasz

**(a) Etap 1 Interview jest zamknięty i zaakceptowany.** Lista, zakładki,
kebaby, preview i Discovery canvas mają akcept właściciela na zrzutach
(`DEC-53` + `DEC-57`). **Nie dotykasz ich.** Jeżeli Twoja zmiana powoduje
wizualną zmianę czegokolwiek POZA dialogiem kreatora — to jest defekt,
nie feature.

**(b) DRD buduje osobny strumień** (`DEC-2026-08-25-45`, dyżur nr 7).
Prototypy DRD (`drd-prototyp-{interview,matrix,report}.html`) leżą w tym
samym katalogu `prototypes/` co Twoje. **Nie pomyl plików.** Twoje trzy to
`interview-creator-prototyp-*`.

**(c) Kreator Inicjatywy dzieli z Tobą powłokę, ale nie treść.**
`InitiativeWizardModal.tsx` (2 700 linii) ma pięć kroków; dowód istnieje
tylko dla kroków 1–2. §W opisuje dokładnie, ile wolno Ci w nim zmienić.

**W Bloku 0 sprawdzasz stan tych trzech rzeczy** i wynik wpisujesz do
raportu:
```bash
git log --oneline -10 -- src/components/Interview/
git log --oneline -10 -- src/components/Initiatives/Wizard/
git log --oneline -5 -- src/components/shared/WizardModal/
```

**Zasada rozstrzygająca spór o zakres:** jeżeli nie wiesz, czy coś należy
do Ciebie — **nie należy**, a Ty wpisujesz to do „Znalezisk".

### 1.5. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **★ `WizardModal` ma NIEAKTUALNY komentarz nagłówkowy — nie wierz mu,
   ale nie wyciągaj z tego złego wniosku.**
   `WizardModal.tsx:26-30` twierdzi: „this is a NEW, additive canon
   component. It is intentionally **NOT yet wired** into the three existing
   wizards". **To jest nieprawda.** Stan faktyczny (zweryfikowany na tipie):

   | Plik | Co bierze z rodziny | Chrome |
   | --- | --- | --- |
   | `src/components/Reports/Wizard/ReportGeneratorWizard.tsx` | **pełną powłokę** `<WizardModal>` — import `:47`, render `:637`, zamknięcie `:651` | z powłoki |
   | `src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx` | **pełną powłokę** `<WizardModal>` — importy `:23-24`, render `:840` | z powłoki |
   | `src/components/Interview/InsightCreatorModal.tsx` | **tylko** `WizardStepper` + typ `WizardStep` — import `:39` | **własny** |
   | `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | **tylko** stepper + typy — import `:42` | **własny** |
   | `src/components/Audit/AuditOrchestratorWizard.tsx` | **tylko** `WizardStepper` + typ — import `:33` (komentarz `:6` tłumaczy świadomą nie-adopcję) | **własny** |

   **★ Konsekwencja krytyczna:** `WizardModal` **ma dziś dwóch żywych
   konsumentów powłoki** (Reports, Charter). **Każda zmiana, którą wprowadzisz
   w samej powłoce bez flagi, natychmiast zmienia wygląd tych dwóch cudzych
   kreatorów.** Dlatego wariant kreatora musi być **opt-in przez props**
   (np. `variant="creator"` / `geometry="stepped"`) z **domyślnym zachowaniem
   bit-w-bit dzisiejszym**, a nie zmianą wartości domyślnych.
   Zweryfikuj sam w Bloku 0:
   ```bash
   grep -rn "<WizardModal" src/ | grep -v "shared/WizardModal/"   # oczekiwane: 2 pliki (Reports, Charter)
   grep -rln "shared/WizardModal" src/ | sort                     # oczekiwane: 5 plików
   ```
   „Rozszerzenie `WizardModal`" oznacza dwie rzeczy naraz — (a) dołożenie do
   niego **wariantu** powłoki kreatora i (b) **realne zaadoptowanie go**
   przez `InsightCreatorModal` w miejsce dzisiejszego bespoke chrome.
   Sam wariant bez adopcji to atrapa.

2. **★ Geometria `720×560` jest ZDUPLIKOWANA, nie współdzielona — a trzeci
   kreator ma jeszcze inną.**

   | Plik | Linia panelu | Geometria |
   | --- | --- | --- |
   | `src/components/shared/WizardModal/WizardModal.tsx` | `:151` | `h-[560px] w-[720px]` |
   | `src/components/Interview/InsightCreatorModal.tsx` | `:2584` | `h-[560px] w-[720px]` — **ten sam literał, skopiowany** |
   | `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | `:2537` | **`h-[640px] w-[1080px]`** — rozjazd |

   Overlay kreatora Wniosku: `:2577`; `role="dialog"`/`aria-modal`:
   `:2580-2581`; `WizardStepper`: `:2607`. Overlay Inicjatywy: `:2528`.
   **To jest dokładnie ten rozjazd, na który była uwaga właściciela
   („muszą wyglądać tak samo") — 720×560 obok 1080×640.**
   Twój token geometrii (§S.1) musi pogodzić **wszystkie trzy miejsca**,
   nie tylko komponent współdzielony.

3. **Kroki kreatora Wniosku JUŻ nazywają się tak jak w prototypie.**
   `InsightCreatorModal.tsx:74`:
   `type CreatorStepId = 'define' | 'material' | 'refine';`
   To jest dobra wiadomość: **nie zmieniasz przepływu**, tylko powłokę
   i układ treści w istniejących trzech krokach. Etykiety w UI mają brzmieć
   `Definicja / Materiał / Dostrojenie` (PL) — zgodnie z prototypem.

4. **W kroku 3 są DZIŚ zagnieżdżone obszary przewijania.**
   `InsightCreatorModal.tsx:1774` (`max-h-[280px] … overflow-auto`)
   i `:2157` (`max-h-[220px] … overflow-auto`) to dokładnie te wewnętrzne
   paski przewijania, na które jest uwaga `INT-CREATOR-EVD-003`.
   **Wytyczne żądają dokładnie JEDNEGO obszaru przewijania w całym dialogu**
   (`CONSULTING_CREATOR_GUIDELINES.md:43-44`). Usunięcie tych dwóch
   `overflow-auto` jest pozycją `K.3`, nie „przy okazji".

5. **`InterviewHub.tsx` montuje DWA kreatory i ma SIEDEM punktów montażu.**

   ```
   :72    import InitiativeWizardModal
   :137   import InsightCreatorModal
   :758   const [showInitiativeWizard, setShowInitiativeWizard] = useState(false)
   :781   const [showInsightModal, setShowInsightModal] = useState(false)
   :3763  otwarcie z paska akcji zbiorczych („Wnioski AI" / interview.hub.aiInsights)
   :5381  otwarcie z pustego stanu zakładki wniosków
   :9251  CTA Menu 2 dla zakładki „insights" („Nowy insight" / interview.hub.newInsight)
   :9267  CTA Menu 2 dla zakładki „initiatives" (data-testid="interview-add-initiatives-cta")
   :9373  <InitiativeWizardModal isOpen={showInitiativeWizard} …>
   :10049 <InsightCreatorModal isOpen={showInsightModal} …>
   ```

   **Oba kreatory pojawiają się w tym samym Hubie**, więc zmiana powłoki
   jednego, a nie drugiego, jest natychmiast widoczna dla właściciela jako
   niespójność. Dlatego §W istnieje — ale ma **twardy sufit** na krokach 3–5.

   **★ Trzeci konsument poza Hubem:**
   `src/components/shared/UnifiedCreateLauncher.tsx:33` (import), `:190`
   (render) też montuje `InsightCreatorModal`. **Nie zmieniasz tego pliku**
   (Z19), ale **uwzględniasz go w pomiarze zasięgu** (§0.4a) i sprawdzasz,
   że przy fladze OFF nic mu się nie zmieniło.

6. **Flaga musi mieć REALNEGO czytelnika, nie deklarację.** W tym repo
   istnieją **flagi-fantomy** — nazwa w konfiguracji, zero kodu, który ją
   czyta (wzorzec `ENABLE_TERESA_NOTE_CREATE`). Twój dowód OFF (§S.0) ma
   pokazać **render**, nie `grep`.

7. **★ Prototyp używa `data-theme`, a aplikacja używa klasy `.dark`.**
   Prototyp definiuje motyw ciemny jako `:root[data-theme="dark"]`.
   **Aplikacja tego nie robi** — tokeny `--c-*` żyją w
   `src/index.css`: motyw jasny w `:root` (od `:6`), ciemny w **`.dark`**
   (od `:233`). Odwzorowujesz **wartości**, nie selektory. Nie wprowadzasz
   `data-theme` do aplikacji.

8. **Prototyp używa gołego CSS, a aplikacja Tailwinda z tokenami `c-*`.**
   **Nie kopiujesz CSS z prototypu dosłownie** — odwzorowujesz **wartości**
   (wysokości, szerokości, odstępy, wagi fontów) klasami Tailwinda
   i tokenami `c-*`. Wartości `--glass-bg`, `--glass-line`, `--scrim`
   z prototypu przenosisz jako nowe zmienne CSS **zdefiniowane lokalnie dla
   powłoki kreatora** (light + `.dark`), nie jako globalny motyw.

9. **★ `prefers-reduced-transparency` NIE ISTNIEJE dziś w `src/`.**
   Jedyne wystąpienia w repo to trzy pliki prototypu (`:311` w każdym).
   To jest **nowa zdolność, którą budujesz**, a nie coś, co podłączasz.
   Raw `backdrop-filter` w `src/` jest w dwóch miejscach
   (`src/components/MyWork/NotebookContent.tsx:422`,
   `src/views/superadmin/SubscriptionPlansManager.css:184`); utility
   Tailwinda `backdrop-blur*` — w ~560 miejscach, w tym
   `WizardModal.tsx:139`. **Żadnego z tych miejsc nie ruszasz.**

10. **★ Nazewnictwo: prototyp mówi „Wniosek", kod mówi „insight".**
    W runtime etykiety brzmią `Nowy insight` (`interview.hub.newInsight`)
    i `Wnioski AI` (`interview.hub.aiInsights`); prototyp konsekwentnie
    używa **„Wniosek" / „Kreator wniosku"**. **Wiążący jest prototyp**
    (ma akcept właściciela) — ale zmiana etykiet **istniejących** kontrolek
    Huba (`:3763`, `:9251`) to zmiana zaakceptowanego ekranu i wymaga
    wpisu w raporcie. Nowe napisy kreatora piszesz wg prototypu; rozjazd
    nazewnictwa Hub↔kreator odnotowujesz w „Znaleziskach", **nie
    naprawiasz go po cichu**.

### 1.6. ★ Reguła 7 — dlaczego nic nie idzie na ekran właściciela

CLAUDE.md, reguła 7 (nienaruszalna, powód: załamanie 07-11): **Piotr nigdy
nie jest pierwszym testerem wizualnym.** Kolejność jest zawsze taka:
(a) prototyp → wstępny OK Piotra — **to już się stało, `DEC-67`**;
(b) **JA/Ty renderuję realny ekran i robię ZRZUT sam** (dev-render z mock-
danymi, bez logowania Piotra); (c) zrzut czysty (zero gwiazdek/ozdób,
tokeny `c-*`, zgodny z prototypem); (d) **dopiero wtedy** Piotr patrzy — do
AKCEPTU, nie do odkrywania zepsucia.

Twoja rola to **(b) i (c)**. Punkt (d) wykonuje nadzorca. Zakaz „włącz flagę
i zobacz" jako pierwszego sprawdzenia. **Wygląd tylko za flagą (default OFF)
do akceptu.** Po akcepcie → flaga domyślna + re-tag punktu — **to robi
nadzorca, nie Ty.**

### 1.7. Pozycje otwarte — pięć rzeczy, których NIE ZGADUJESZ

Ich produktem jest **STOP z propozycją** w raporcie, nie decyzja.

| ID | Kwestia | Dlaczego nie zgadujesz |
| --- | --- | --- |
| `C-O1` | **Trwałość szkicu**: `localStorage` (per przeglądarka) vs endpoint serwerowy (per użytkownik, przeżywa zmianę urządzenia). Prototyp mówi tylko „Szkic zapisany 10:12" | Serwerowy szkic = nowy endpoint = `server/**` = poza zakresem (Z17). Wybierz `localStorage` jako **v1 jawnie oznaczone**, opisz koszt i podnieś `C-O1` |
| `C-O2` | **Czy „Pokaż wykluczone (3)" ma realne API** zwracające sesje niezatwierdzone z powodem | Jeśli API nie ma — kontrolka **nie powstaje** (DoD 1). Wpis `BRAK_API` z dokładną tabelą, czego brakuje |
| `C-O3` | **Cztery rozróżnione przyczyny awarii AI** — czy backend zwraca typowany błąd (dostawca / uprawnienia / walidacja / sieć-serwer), czy tylko gołe `Failed to fill…` (`INT-INIT-AI-OBS-001`) | Bez typowanego błędu nie da się rozróżnić czterech przyczyn uczciwie. Inwentarz w §S.6 rozstrzyga; brak typów = STOP z propozycją kontraktu |
| `C-O4` | **Adopcja powłoki przez trzech pozostałych konsumentów** `WizardModal` (`InitiativeCharterWizard`, `AuditOrchestratorWizard`, `ReportGeneratorWizard`) | Kolejność pilotażu z wytycznych (§11): Przypisanie → Wniosek → Inicjatywa. **Nikt inny nie rusza**, dopóki pilot nie przejdzie odbioru. Rozszerzenie na nich = **STOP** |
| `C-O5` | **Wariant kompaktowy dla kreatora Przypisania** (`AssignInterviewModal`) — wytyczne go przewidują (`760–840px`, bez kroków) | Właściciel zaakceptował prototyp **Wniosku**, nie Przypisania. Budowa wariantu kompaktowego bez prototypu łamie regułę 7. Przygotuj **miejsce** w typie geometrii, nie buduj ekranu |

---

## 2. MAPA TECHNICZNA — skrót niezbędny

**Uwaga: mapa mogła się zestarzeć. Wszystko poniżej weryfikujesz w Bloku 0
i każdą rozbieżność wpisujesz do „Korekt wobec instrukcji".**

### 2.1. Rozmiar obszaru — żebyś wiedział, w co wchodzisz

```bash
wc -l src/components/shared/WizardModal/WizardModal.tsx        # oczekiwane 265
wc -l src/components/shared/WizardModal/WizardStepper.tsx      # oczekiwane 141
wc -l src/components/shared/WizardModal/types.ts               # oczekiwane 89
wc -l src/components/shared/WizardModal/index.ts               # oczekiwane 9
wc -l src/components/shared/ToolWizard/ToolWizardShell.tsx     # oczekiwane 750 (TYLKO ODCZYT)
wc -l src/components/Interview/InsightCreatorModal.tsx         # oczekiwane 2670
wc -l src/components/Interview/InterviewHub.tsx                # oczekiwane 10077
wc -l src/components/Initiatives/Wizard/InitiativeWizardModal.tsx  # oczekiwane 2700
wc -l dev-render/main.tsx                                      # oczekiwane 1198
```

`InterviewHub.tsx` przy 10 077 liniach jest **największym ryzykiem dyżuru**.
Reguła Z17.a: dotykasz go **wyłącznie w punktach montażu**.

### 2.2. Montaż — jak kreator trafia na ekran

```
/interview  (routeConfig.ts:43 ROUTES.INTERVIEW)
   └─ InterviewHub.tsx
        ├─ import InsightCreatorModal          :137
        ├─ const [showInsightModal, …]         :781
        ├─ <InitiativeWizardModal …>           :9373
        └─ <InsightCreatorModal isOpen={showInsightModal} …>  :10049
```

Kreator jest **dialogiem nad listą**. Nie ma i nie będzie miał trasy (D1).

### 2.3. `WizardModal` — stan faktyczny rodziny

```
src/components/shared/WizardModal/
   WizardModal.tsx     265 linii — powłoka: overlay :139 (z-overlay = 50, tailwind.config.js:57),
                       panel :151 (h-[560px] w-[720px]),
                       nagłówek :154-186, WizardStepper :189-196, treść :199-214, stopka :217-259
                       DEFAULT_ACCENT :45  ← crimson-ryzyko (DoD 5)
                       Esc-to-close :98-108 · klik w overlay zamyka :140-143
                       „focus" :111-113 — to JEDNORAZOWY panelRef.focus(), NIE pułapka fokusu
                       BRAK portalu (zero createPortal w całej rodzinie)
   WizardStepper.tsx   141 linii — pasek postępu + numerowane pigułki kroków
   types.ts            89 linii — LocalizedText, WizardStep, WizardModalProps
   index.ts            9 linii — eksporty rodziny (WizardModal + default, WizardStepper, 4 typy)
```

`WizardModalProps` (`types.ts:47-89`): `open`, `onClose`, `title`, `steps`,
`activeStepIndex`, `onStepChange`, `onComplete`, `completing?`, `footer?`,
`isPolish?`, `accentColor?`, `nextDisabled?`, `children?`.
`WizardStep` (`types.ts:28-45`): `id`, `label`, `hint?`,
`status?: 'empty'|'ready'|'complete'`, `optional?`, `content?`.

**Pięciu importerów rodziny — DWIE różne relacje (§1.5 pułapka 1):**
pełną powłokę biorą `ReportGeneratorWizard` i `InitiativeCharterWizard`;
sam `WizardStepper` biorą `InsightCreatorModal`, `InitiativeWizardModal`
i `AuditOrchestratorWizard`.

**★ Gotowy lek na brak pułapki fokusu:** repo ma już kanoniczny hook
`src/components/ui/primitives/useDialogA11y.ts` (test kontraktowy:
`src/components/ui/primitives/__tests__/useDialogA11y.test.tsx`), używany
przez inne dialogi. `WizardModal` go **nie używa**. Podłączenie go
w wariancie kreatora jest właściwą ścieżką (§T.6) — **za flagą**, żeby nie
zmienić zachowania Reports/Charter.

`ToolWizardShell` = `src/components/shared/ToolWizard/ToolWizardShell.tsx`
(750 linii, symbol `:55`), pełnoekranowa powłoka narzędzi na trasie,
jedyny produkcyjny wołający: `src/components/DiscoveryTools/ToolWizardView.tsx:19,271`.
**Nietykalna** (★ pkt 2).

### 2.4. Flagi — wzorzec, który masz powielić

W repo są **dwa** mechanizmy flag. Ty używasz **pierwszego**.

**A. Moduł flagi per-funkcja (wzorzec obowiązujący, ma precedens
DOKŁADNIE w Interview):**
`src/utils/interviewPipelineStepperFlag.ts` —
klucze `:28-32`, czytnik `:75`
`export function isInterviewPipelineStepperEnabled(): boolean`.
**Realny czytelnik: `src/components/Interview/InterviewHub.tsx:9363`**
(import `:123`). Test wartości domyślnej:
`src/utils/__tests__/interviewPipelineStepperFlag.test.ts:35` asertuje
`false`.

Kolejność rozstrzygania (pierwszy wygrywa): **URL query → localStorage →
Vite build env → OFF** (udokumentowana `:16-20`). `parseFlag` zwraca `null`
dla nieznanej wartości (`:34-40`); `readEnvFlag` zwraca `false`, gdy nie da
się sparsować (`:42-50`). **To jest dokładnie ten kształt, który kopiujesz.**

Rodzeństwo o tym samym kształcie (do porównania):
`src/components/CaseWorkspace/caseWorkspaceFlag.ts:56`,
`src/utils/unifiedCreateLauncherFlag.ts`,
`src/utils/artifactStudioFlags.ts`,
`src/utils/interviewPipelineStepperFlag.ts`.

**B. Centralny rejestr (starszy, z DevTools):**
`src/hooks/useFeatureFlags.tsx` (`FeatureFlag.defaultValue` `:35`,
`DEFAULT_FLAGS` `:109`), kontekst `src/contexts/FeatureFlagsContext.tsx:48`,
nadpisania lokalne bramkowane
`VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES` (`src/providers/AppProviders.tsx:119`).
**Nie używasz go** — dopisanie się do centralnego rejestru zmienia
powierzchnię DevTools i panelu Superadmina, czyli wychodzi poza Z17.

**★ Twoja flaga: twarde OFF, bez żadnego wyjątku.** Żadnego
`isDemoAcceptanceProfileEnabled`, żadnego „ON wszędzie poza produkcją",
żadnego auto-ON w profilu odbiorowym. Powód: właściciel nie widział jeszcze
zrzutów z realnego kodu (reguła 7). Jeżeli uznasz, że profil odbiorowy jest
potrzebny — to jest **STOP**, nie decyzja.

Klucze Twojej flagi (nazewnictwo spójne z precedensem Interview):
```
query:        ff_interviewCreatorShell
localStorage: ff.interview_creator_shell
env:          VITE_INTERVIEW_CREATOR_SHELL
```

### 2.5. i18n — stan zastany i Twój parytet

```bash
python3 - <<'PY'
import json
for l in ('pl','en'):
    d=json.load(open('public/locales/%s/translation.json'%l))
    print(l, 'kluczy w interview.*:', len(d.get('interview', {})))
PY
# oczekiwane: pl 34, en 34 — parytet pełny
```

Konfiguracja: `src/i18n.ts` — `defaultNS: 'translation'` (`:95`),
`ns: NAMESPACES` (`:96`, lista od `:39`). Zasoby ładowane po HTTP z `public/`.

Konwencja Interview: **jeden namespace `translation`**, ścieżka kropkowa
`interview.<obszar>.<klucz>`; UI Huba żyje pod `interview.hub.*`.
Podklucze `interview` (PL): `title, newSession, history, pipelineStepper,
categories, tabs, actions, status, companyFacts, conversational, inference,
sufficiency, runtimeMode, reviewer, hub`.

Przykłady istniejące w OBU językach (przydatne przy §1.5 pułapce 10):
`interview.hub.newInsight` (PL „Nowy insight" / EN „New insight", użyty
`InterviewHub.tsx:9256`), `interview.hub.addInitiatives` (`:9280`),
`interview.hub.aiInsights`, `interview.hub.noInsightsYet`.

Twoje klucze idą **wyłącznie** pod `interview.creator.*`. Po dyżurze
parytet PL/EN musi być nadal pełny (§T.4). **Nie ruszasz istniejących
34 podkluczy `interview.*`.**

**★ Pułapka:** sam `WizardModal` **nie używa i18n** — ma zaszyty
dwujęzyczny obiekt `COPY` (`WizardModal.tsx:47-58`) i sam wykrywa język
przez `i18n.language === 'pl'` (`:77`). Nowe napisy powłoki kreatora idą
przez **`useTranslation` i klucze**, nie przez rozbudowę `COPY`.
Rozbudowa `COPY` dotknęłaby dwóch cudzych konsumentów powłoki.

### 2.6. Harness dev-render — czym robisz zrzuty (kluczowe, przeczytaj)

Repo ma gotowy, dev-only harness, którego jedynym celem jest reguła 7:

```
dev-render/
   vite.config.ts        standalone Vite; uruchamiasz Z KATALOGU GŁÓWNEGO repo
   main.tsx              rejestr ekranów (SCREENS) + parametry URL
   screens/              ekrany-montaże z mockami
   shot.mjs              zrzutownik Playwright (bez MCP)
   mocks/                dane mock
```

Parametry URL harnessu (`dev-render/main.tsx:1-14`):
`?screen=<klucz>&lang=pl|en&theme=light|dark`.
Rejestr ekranów: `const SCREENS: Record<string, {label, render}>`
(`dev-render/main.tsx:345`), rozstrzygany z `?screen=` (`:1137`).
`dev-render/main.tsx` ma **1198 linii** i ~200 zarejestrowanych ekranów —
dopisujesz **dwie linie** (lazy import + wpis w rejestrze), nic więcej.

**Precedens dokładnie dla Interview:**
`dev-render/screens/interview-preview-canon.tsx`, zarejestrowany
w `dev-render/main.tsx:217` (lazy import) i `:680` (wpis w rejestrze
SCREENS). Powstał przy `DEC-2026-08-25-57` (commit `3a8c11eb4d`) i jest
**wzorcem, który kopiujesz**. Sąsiedzi warci zerknięcia:
`karta-interview.tsx` (`:216` / `:676`),
`template-create-wizard.tsx` (`:204` / `:763`).

**★ Uwaga o porcie — w repo są dwie sprzeczne liczby:**
`dev-render/vite.config.ts:18` i `:286` mówią **3020**, a nagłówek
`dev-render/shot.mjs` mówi **3350**. **Obie ignorujesz** i uruchamiasz
jawnie na **3356** (Z7), przekazując ten port w URL do `shot.mjs`.
Rozbieżność wpisz do „Znalezisk", nie naprawiaj.

Uruchomienie:
```bash
# z KATALOGU GŁÓWNEGO repo (żeby PostCSS/Tailwind się rozwiązały)
npx vite --config dev-render/vite.config.ts --port 3356
```
Zrzut:
```bash
node dev-render/shot.mjs <plik.png> "http://localhost:3356/?screen=interview-creator-shell&lang=pl&theme=light" --w=1440 --h=900
```
`shot.mjs` zawsze wypisuje na stdout `KONSOLA-BLEDY` i `SIEC-4XX5XX` —
**oba wklejasz do raportu przy każdym zrzucie**. Zrzut z błędem konsoli
nie jest dowodem.

### 2.7. Testy zastane — co Cię pilnuje

Runner: **vitest + testing-library**, `environment: 'jsdom'`
(`vitest.config.ts:199`), `globals: true` (`:198`),
`setupFiles: './tests/setup.ts'` (`:220` — **Z18, nie dotykasz**).

```
src/components/Interview/__tests__/
   InsightCreatorModal.a11y.test.tsx            ← Twój najbliższy sąsiad (kontrakt dialogu EN :80 / PL :129); NIE osłabiasz
   InterviewHub.smoke.test.tsx                  ← pilnuje, że Hub się renderuje
   InterviewPreviewFooter.ownerContract.test.ts ← akcept DEC-57; NIE dotykasz
   InterviewInitiativePreviewBody.canon.test.tsx
   AssignInterviewModal.behavior.test.tsx / .ownerContract.test.ts
   PreviewActionBar.ownerBehavior.test.tsx
   (+ 8 innych)
src/components/Initiatives/Wizard/__tests__/
   InitiativeWizardModal.a11y.test.tsx:76
   InitiativeWizardModal.projectSelection.test.tsx:68
tests/components/Interview/                     ← ★ DRUGIE miejsce, łatwe do przeoczenia
   InsightCreatorModal.context-documents.test.tsx
   InsightCreatorModal.error-state.test.tsx      ← bezpośrednio dotyka §S.6
   InterviewHub.test.tsx
tests/components/ToolWizardShell.canon-runtime.test.tsx:75   ← granica powłoki narzędzi
src/components/ui/primitives/__tests__/useDialogA11y.test.tsx ← wzorzec kontraktu fokusu
src/utils/__tests__/interviewPipelineStepperFlag.test.ts:35   ← wzorzec testu wartości domyślnej flagi
src/routes/__tests__/interviewAliasRedirect.test.ts:53        ← ROUTES.INTERVIEW === '/interview' (D1)
```

**Nie istnieje dziś żaden test samego `WizardModal.tsx`.** Twoje testy
kontraktu powłoki (§T.3) będą pierwsze — tym bardziej muszą pokrywać
**oba** stany flagi, żeby nie zamrozić przypadkiem cudzego zachowania.

### 2.8. Kanon UI — co obowiązuje w tym obszarze

- **Kreator NIE jest ekranem listowym** — `consultify-triada` /
  `StandardTable` go **nie dotyczą**. Tło pod dialogiem (lista `/interview`)
  **jest** ekranem listowym i jest zamrożone.
- **Kreator NIE jest artefaktem SPEC-A** — `ArtifactRightPanel`,
  `NModeShell` itd. go nie dotyczą.
- Obowiązuje **`CONSULTING_CREATOR_GUIDELINES.md`** jako profil wymagań
  oraz **prototyp** jako źródło prawdy o wyglądzie. Przy sprzeczności
  wygrywa **prototyp** (jest nowszy i ma akcept właściciela) — a sprzeczność
  wpisujesz do „Znalezisk".
- **Tokeny kolorów: §10.4.** Crimson = wyłącznie marka. CTA neutralne.

---

## 3. ★ KOMPLET 10 REKOMENDACJI (`DEC-2026-08-25-67`) — WIĄŻĄCE

Właściciel zaakceptował prototyp **wraz ze wszystkimi rekomendacjami
autora**. Poniżej rozstrzygnięcia — to nie są opcje.

| # | Pytanie | ROZSTRZYGNIĘCIE (wiążące) | Sekcja |
| --- | --- | --- | --- |
| 1 | Rozmiar powłoki kreatora | **`min(1040px, 100vw−64px) × min(840px, 100vh−48px)` — JEDEN wspólny token.** Treść wyśrodkowana do 880 px. Poniżej 1024 px szerokości → pełny ekran. **Dialog nie zmienia rozmiaru między krokami.** Odrzucone: 720×560, 960×820, zawsze-pełny-ekran | §S.1 |
| 2 | Ile typów wyniku od razu | **6 podstawowych widocznych + zwinięta sekcja „Zaawansowane i frameworki BCG" (7 typów)**, wymieniająca ukryte typy z nazwy w podsumowaniu + licznik. Odrzucone: wszystkie 13 naraz, 3 najczęstsze | §K.1 |
| 3 | Nazwa przycisku głównego | **Przycisk nazywa następny ekran albo zakres operacji: „Dalej: Materiał", „Dalej: Dostrojenie", „Uruchom analizę · 12 sesji".** Koszt widoczny przed kliknięciem. Odrzucone: gołe „Dalej"/„Uruchom", „Wygeneruj wniosek" | §S.4 |
| 4 | Zapis szkicu | **Autozapis co 20 s ORAZ przy każdej zmianie kroku.** Zamknięcie brudnego kreatora **musi zapytać**: zapisz szkic albo porzuć zmiany. Odrzucone: zapis tylko przy zmianie kroku, ręczny przycisk | §S.5 |
| 5 | Gdzie mieszka pasek „Co powstanie" | **Osobny pas 36 px pod krokami**, widoczny w każdym kroku, **jedna linia**, rozwijany na żądanie. **Nie może stać się kolejną stale otwartą kartą.** Odrzucone: w stopce, tylko na ostatnim kroku | §S.3 |
| 6 | Materiał wykluczony | **Licznik + wiersz nieklikalny z podanym powodem** + przycisk „Pokaż wykluczone (N)" otwierający pełną listę z datami. Odrzucone: nie pokazywać, osobna zakładka (łamie regułę jednego scrolla) | §K.2 |
| 7 | Czy „Uruchom" dostępny w kroku 2 | **TAK — „Uruchom teraz" obok „Dalej: Dostrojenie".** „Dalej: Dostrojenie" zostaje przyciskiem głównym (CTA), „Uruchom teraz" jest zwykłym przyciskiem. Odrzucone: zawsze przez krok 3, link „Pomiń dostrojenie" | §S.4, §K.2 |
| 8 | Zakres „Liquid Glass" | **Szkło WYŁĄCZNIE na powłoce** — nagłówek, pasek kroków, pasek zakresu, stopka. Treść formularza krystaliczna. **Maksymalnie trzy warstwy głębi:** przyciemnienie tła · powłoka · aktywny element. Odrzucone: brak szkła, szkło na kartach treści | §S.2 |
| 9 | Co dzielą kreator Wniosku i Inicjatywy | **Wspólna powłoka: geometria, nagłówek, kroki, pasek zakresu, stopka, stany, walidacja, zapis szkicu. Treść środka OSOBNA** (Wniosek 3 kroki, Inicjatywa 5, Przypisanie wariant kompaktowy bez kroków). Odrzucone: tylko wspólne tokeny, jeden komponent sterowany konfiguracją | §W |
| 10 | Zachowanie przy awarii AI | **Rozróżnienie CZTERECH przyczyn + zachowanie wpisanych danych:** dostawca niedostępny · brak uprawnień · błąd walidacji · błąd sieci/serwera. Każda z własnym tekstem, przyciskiem „Ponów" i ścieżką ręczną. **Sukces częściowy pokazuje osobno, co się udało, i ponawia wyłącznie to, co padło.** Odrzucone: jeden ogólny komunikat, ciche ponowienie | §S.6 |

**Bezpieczniki z pytania 8, które muszą przejść NIEZALEŻNIE od szkła:**
kontrast tekstu `4.5:1` i elementów `3:1` na każdym tle, jawny fokus,
awaryjne pełne krycie przy `prefers-reduced-transparency`, brak spadku
płynności przewijania. **Wersja nieprzezroczysta musi przejść wszystkie
bramki JAKO PIERWSZA — szkło jest dodatkiem, nie nośnikiem informacji.**

---

## §S. SEKCJA POWŁOKA — siedem pozycji

Powłoka jest **identyczna we wszystkich trzech krokach** i ma być identyczna
w kreatorze Inicjatywy. Zmienia się wyłącznie treść środka.

### S.0 — Flaga + inwentarz + dowód OFF (PIERWSZA, obowiązkowa)

1. **Inwentarz delty** — główny werdykt techniczny dyżuru. Dla **każdej**
   z 10 rekomendacji §3 wypełniasz wiersz:
   `rekomendacja → JEST / JEST_CZĘŚCIOWO / BRAK_UI_JEST_API / BRAK_API →
   dowód plik:linia`. To rozstrzyga, ile z tego jest przebudową układu,
   a ile wymagałoby backendu (którego nie dotykasz).
2. **Flaga** — NOWY plik `src/utils/interviewCreatorShellFlag.ts`
   wzorcem `interviewPipelineStepperFlag` (§2.4), z **twardym `false`**
   i bez żadnego auto-ON.
   Eksport: `export function isInterviewCreatorShellEnabled(): boolean`.
3. **★ Dowód OFF od razu, testem behawioralnym**: przy fladze OFF
   `InsightCreatorModal` renderuje **dzisiejszą** powłokę (`w-[720px]`,
   `h-[560px]`, dzisiejszy nagłówek i stopka), nowa powłoka **nie istnieje
   w drzewie DOM**, i **nie leci żadne nowe żądanie**. Test renderuje
   komponent, nie grepuje pliku.
4. **Dowód OFF wizualny**: zrzut dev-render sceny `off` w light i dark
   (wzorzec: `scripts/dev/ap-client-flag-off-screenshots.mjs` używa świeżego
   kontekstu przeglądarki per zrzut, bo `localStorage` z flagą **wycieka**
   między `page.goto()` w tym samym kontekście — powiel to zabezpieczenie).

**DoD S.0:** tabela delty dla 10 rekomendacji; flaga z realnym czytelnikiem;
test OFF renderujący; dwa zrzuty OFF; STOP-y `C-O1`…`C-O5` założone.

### S.1 — Jeden token geometrii `1040 × 840` (rekomendacja 1)

1. **Jedno miejsce prawdy.** W rodzinie `src/components/shared/WizardModal/`
   powstaje **jeden** eksportowany token geometrii, np.
   ```ts
   export const CREATOR_SHELL_GEOMETRY = {
     stepped:  { w: 1040, h: 840 },   // Wniosek, Inicjatywa
     compact:  { w:  840, h: 680 },   // miejsce na Przypisanie (C-O5) — NIE BUDUJESZ EKRANU
     legacy:   { w:  720, h: 560 },   // dzisiejszy wygląd, używany przy fladze OFF
   } as const;
   ```
   `compact` istnieje **wyłącznie jako miejsce w typie** — nie budujesz
   dla niego ekranu (C-O5).
2. **Wartości dokładnie z prototypu** (`interview-creator-prototyp-01-definicja.html:162`):
   `width: min(1040px, calc(100% − 64px))`,
   `height: min(840px, calc(100% − 48px))`, `border-radius: 16px`,
   **jedna zewnętrzna ramka**, `overflow: hidden`, `flex-direction: column`.
3. **Poniżej 1024 px szerokości → pełny ekran.** Nie zmniejszony modal.
   Wytyczne: „Mobile uses a full-screen creator. A reduced modal is not an
   accepted mobile variant" (`CONSULTING_CREATOR_GUIDELINES.md:152-153`).
4. **★ Dialog NIE zmienia rozmiaru między krokami.** To jest osobna
   asercja testowa: render kroku 1, 2 i 3 → ten sam `getBoundingClientRect`
   panelu.
5. **★ Akcent.** Nowa powłoka używa **neutralnego** CTA
   (`--c-cta-bg` / `--c-cta-text` z prototypu → w Tailwindzie odpowiedniki
   tokenów `c-*`), **nie** `DEFAULT_ACCENT`. **Nie zmieniasz
   `DEFAULT_ACCENT` globalnie** — zmiana dotknęłaby czterech cudzych
   kreatorów (Charter, Audit, Reports) i jest **STOP** (§0.5).
   Rozwiązanie: wariant powłoki ignoruje `accentColor` albo dostaje
   `accentColor` neutralny z miejsca wywołania — **za flagą**.
6. **★ Trzy miejsca z zaszytą geometrią, wszystkie pod flagą ON:**
   `WizardModal.tsx:151` (`720×560`),
   `InsightCreatorModal.tsx:2584` (`720×560`, skopiowany literał),
   `InitiativeWizardModal.tsx:2537` (**`1080×640`** — rozjazd).
   Po dyżurze wszystkie trzy biorą wartość **z jednego tokenu**.
   **Przy fladze OFF wszystkie trzy zachowują dzisiejsze wartości —
   również rozjazd `1080×640`.** Nie „poprawiasz go przy okazji" poza flagą.
7. **★ Wariant jest OPT-IN.** `WizardModal` ma dziś **dwóch żywych
   konsumentów powłoki** (`ReportGeneratorWizard:637`,
   `InitiativeCharterWizard:840`). Nowy wariant wchodzi przez **nowy,
   opcjonalny props** z domyślną wartością odwzorowującą dzisiejsze
   zachowanie. **Zmiana wartości domyślnej = zmiana wyglądu dwóch cudzych
   kreatorów = STOP.**

**DoD S.1:** jeden eksportowany token; geometria z prototypu; pełny ekran
< 1024 px; test „rozmiar nie drga między krokami"; `DEFAULT_ACCENT`
nietknięty globalnie; wariant opt-in z domyślną wartością „jak dziś";
dowód renderem, że przy OFF geometria to nadal `720×560` (Wniosek)
i `1080×640` (Inicjatywa), a Reports/Charter wyglądają bez zmian.

### S.2 — Cztery pasy powłoki + Liquid Glass + fallback (rekomendacja 8)

Powłoka ma **pięć stref, z czego cztery są stałe (szkło) i jedna przewijana**
— dokładnie jak prototyp:

| Pas | Wysokość | Zawartość | Szkło |
| --- | --- | --- | --- |
| 1. nagłówek `shead` | **60 px** | ikona 32 px, tytuł `18/24`, podtytuł `12/16` (kontekst: „Wywiad › Wnioski · <projekt>"), stan zapisu szkicu, `×` | TAK |
| 2. kroki `ssteps` | **70 px** | trzy karty kroków z numerem/ptaszkiem, nazwą `13/18` i podsumowaniem `12/16`; separatory `›` | TAK |
| 3. zakres `sscope` | **36 px** | „CO POWSTANIE" + jedna linia podsumowania + `Rozwiń` | TAK |
| 4. treść `sview`/`sscroll` | reszta | **jedyny obszar przewijany**; `swrap` `max-width: 880px`, `padding: 24px 24px 84px` | NIE |
| 5. stopka `sfoot` | **70 px** | przypis po lewej, przyciski po prawej | TAK |

1. **Szkło**: `background: var(--glass-bg)`,
   `backdrop-filter: blur(14px) saturate(1.5)`, `border` w `var(--glass-line)`.
   Wartości z prototypu: light `rgba(255,255,255,.74)` / `rgba(15,23,42,.07)`;
   dark `rgba(15,23,42,.74)` / `rgba(148,163,184,.14)`; scrim light
   `rgba(15,23,42,.44)`, dark `rgba(3,7,18,.62)`.
2. **★ Fallback OBOWIĄZKOWY**:
   ```css
   @media (prefers-reduced-transparency: reduce) {
     /* .shead,.ssteps,.sscope,.sfoot */
     backdrop-filter: none; background: var(--c-surface-raised);
   }
   ```
   **To jest testowalne** — test ustawia matchMedia i sprawdza klasę/styl.
3. **Maksymalnie trzy warstwy głębi**: scrim · powłoka · aktywny element.
   **Zero szkła na kartach treści.** Zero kart półprzezroczystych na
   półprzezroczystych.
4. **Wersja nieprzezroczysta jako pierwsza.** Budujesz i testujesz powłokę
   **bez szkła**, przechodzisz kontrast/fokus/scroll, dopiero potem
   dokładasz szkło jako warstwę, która **niczego nie niesie
   informacyjnie**.
5. **Kontrast**: tekst `4.5:1`, elementy/fokus `3:1` — na obu tłach.
   Zmierz i wpisz do raportu wartości dla: tytułu na szkle, podtytułu na
   szkle, etykiety kroku aktywnego, przycisku CTA.

**DoD S.2:** pięć stref o dokładnych wysokościach; szkło tylko na czterech;
fallback z testem; trzy warstwy głębi; pomiar kontrastu w raporcie; zrzuty
light+dark.

### S.3 — Pas „Co powstanie" (rekomendacja 5)

1. **Jedna linia, 36 px, pod krokami, w KAŻDYM kroku.** Etykieta
   `CO POWSTANIE` (`11px/600/uppercase/letter-spacing .14em`), po niej
   podsumowanie z pogrubionymi wartościami, `text-overflow: ellipsis`,
   `white-space: nowrap`.
2. **Treść wg kroku** (dokładnie jak prototyp):
   - krok 1: `Wniosek „<tytuł>" · N typów wyniku · materiał: jeszcze nie wybrany`
   - krok 2: `Wniosek „<tytuł>" · <typy> · N zatwierdzonych sesji · M osób · K wykluczone`
   - krok 3: `Wniosek „<tytuł>" · N typów wyniku · M sesji · K dokument · tryb analizy N · wątki M`
3. **Przycisk `Rozwiń`** rozwija szczegóły **na żądanie**.
   **★ ZAKAZ:** pas nie może stać się kolejną stale otwartą kartą — po
   rozwinięciu ma się dać zwinąć i **stan domyślny jest zwinięty przy
   każdym wejściu w krok**.
4. Wartości w pasie są **liczone z realnego stanu kreatora**, nie zaszyte.
   Pas pokazujący `12 sesji`, gdy wybrano 7, jest atrapą.

**DoD S.3:** pas w trzech krokach; treść liczona ze stanu; zwijanie działa
i domyślnie zwinięte; test sprawdzający, że po zmianie wyboru w kroku 2
liczba w pasie się zmienia.

### S.4 — Stopka, nazwy przycisków, uzasadnienie blokady (rekomendacje 3 i 7)

1. **Układ stopki (70 px):** po lewej `footnote` (`11.5px`, `max-width 360px`),
   po prawej grupa przycisków. Przyciski `40 px`, `radius 8px`.
2. **Nazwy — wiążące, dokładnie jak prototyp:**

   | Krok | Przyciski od lewej | CTA |
   | --- | --- | --- |
   | 1 Definicja | `Anuluj` (ghost) · `Wstecz` (**disabled**) · **`Dalej: Materiał`** | `Dalej: Materiał` |
   | 2 Materiał | `Anuluj` · `Wstecz` · `Uruchom teraz` · **`Dalej: Dostrojenie`** | `Dalej: Dostrojenie` |
   | 3 Dostrojenie | `Anuluj` · `Wstecz` · **`Uruchom analizę · N sesji`** | `Uruchom analizę · N sesji` |

   `N` w kroku 3 to **realna liczba zatwierdzonych sesji z wyboru**, nie
   stała.
3. **Przypisy stopki (wiążące):**
   - krok 1: „Szkic zapisuje się automatycznie — zamknięcie kreatora nie
     kasuje wyborów."
   - krok 2: „Krok 3 jest opcjonalny — możesz uruchomić analizę już teraz
     na ustawieniach domyślnych."
   - krok 3: „Wynik pojawi się jako wniosek w stanie »Do przeglądu« —
     dopiero Twoja akceptacja czyni go materiałem dla inicjatyw."
4. **★ Zablokowany CTA ZAWSZE ma widoczny powód** (wytyczne `:148-150`).
   Walidacja po interakcji albo po próbie przejścia; fokus na pierwszy błąd;
   podsumowanie błędów poza ekranem **nad stopką**.
5. **„Uruchom teraz" w kroku 2 jest zwykłym przyciskiem, nie CTA** —
   rekomendacja 7 rozstrzyga to wprost.

**DoD S.4:** trzy układy stopki; etykiety 1:1 z prototypem; `N` liczone;
test „disabled CTA pokazuje powód"; test „Uruchom teraz z kroku 2 startuje
tę samą operację co CTA kroku 3 na wartościach domyślnych".

### S.5 — Autozapis szkicu co 20 s (rekomendacja 4)

1. **Autozapis co 20 s ORAZ przy każdej zmianie kroku.** Wskaźnik
   w nagłówku: `Szkic zapisany <HH:MM>` z zieloną kropką (`--c-success`).
2. **Stany wskaźnika (wszystkie trzy, rozróżnialne):**
   `zapisany <godzina>` · `zapisywanie…` · `nie udało się zapisać —
   <powód> + Ponów`. Cichy błąd zapisu jest **atrapą**.
3. **★ Zamknięcie brudnego kreatora MUSI zapytać**: „zapisz szkic" albo
   „porzuć zmiany". Dotyczy `×`, `Esc` i kliknięcia w scrim.
   **Uwaga:** dzisiejszy `WizardModal` zamyka się na `Esc` (`:98-108`)
   i na klik w overlay (`:140-143`) **bez pytania** — to musi się zmienić
   pod flagą ON.
4. **Powrót do szkicu** wraca **do tego samego kroku i tych samych
   wyborów**. Test: zapisz → odmontuj → zamontuj → ten sam krok, ten sam
   tytuł, te same typy, ten sam wybór osób.
5. **Trwałość = `C-O1`.** v1 na `localStorage`, jawnie oznaczone
   w raporcie jako ograniczenie (nie przeżywa zmiany przeglądarki).
   Klucz z namespace i wersją, np.
   `consultify.interview.creatorDraft.v1.<organizationId>.<projectId>`.
   **Zero danych osobowych w kluczu.**

**DoD S.5:** timer 20 s + zapis na zmianie kroku; trzy stany wskaźnika;
pytanie przy zamknięciu brudnego (×/Esc/scrim); cold-resume do tego samego
kroku; `C-O1` opisane jako STOP z propozycją.

### S.6 — Cztery rozróżnione przyczyny awarii AI (rekomendacja 10)

Powód istnienia tej pozycji: w przeglądzie 22.08 kreator Inicjatywy pokazał
gołe **„Failed to fill the section with AI"** (`INT-INIT-AI-OBS-001`,
`REC-INT-007`). To jest wspólne dla obu kreatorów — **dlatego mieszka
w powłoce, nie w treści**.

1. **Inwentarz najpierw (`C-O3`)**: sprawdź, czy backend zwraca typowany
   błąd. Jeżeli zwraca tylko tekst — **nie zmyślasz typów**: mapujesz to,
   co da się rozróżnić uczciwie (np. HTTP 401/403 → uprawnienia,
   4xx walidacyjny → walidacja, 5xx/timeout/offline → sieć/serwer,
   reszta → dostawca), resztę opisujesz jako `BRAK_API` i podnosisz STOP
   z propozycją kontraktu.
2. **Cztery przypadki, każdy z własnym tekstem PL/EN**:

   | Przyczyna | Komunikat mówi | Akcje |
   | --- | --- | --- |
   | dostawca niedostępny | że problem jest po stronie modelu, nie po stronie danych | `Ponów` · `Wypełnij ręcznie` · `Szczegóły` |
   | brak uprawnień | czego brakuje i do kogo się zwrócić | `Szczegóły` (bez `Ponów` — ponowienie nic nie da) |
   | błąd walidacji | **które pole** i dlaczego | fokus na pole · `Popraw` |
   | błąd sieci/serwera | że dane są zachowane i można spróbować ponownie | `Ponów` · `Szczegóły` |

3. **★ ZACHOWANIE DANYCH jest twarde.** Po każdej z czterech awarii
   **wszystko, co użytkownik wpisał, zostaje**. Test na każdą z czterech.
4. **Sukces częściowy** pokazuje **osobno**, co się udało i co padło,
   i **ponawia wyłącznie to, co padło**. Nigdy nie ponawia całości.
5. **Zakaz cichego ponowienia w tle** — rekomendacja 10 odrzuciła je wprost.
6. **Wynik AI pozostaje PROPOZYCJĄ do akceptacji** — nigdy nie jest
   oznaczony jako prawda przyjęta (wytyczne `:125-126`).

**DoD S.6:** cztery rozróżnione stany z osobnymi tekstami PL/EN; cztery
testy „dane przetrwały"; sukces częściowy z ponowieniem tylko tego, co
padło; brak cichego retry; `C-O3` rozstrzygnięte albo STOP.

### S.7 — Jeden scroll + jawny wskaźnik dalszej treści + „Koniec kroku"

1. **★ Dokładnie JEDEN obszar przewijany w całym dialogu.** Usuwasz
   zagnieżdżone `overflow-auto` — dziś minimum dwa:
   `InsightCreatorModal.tsx:1774` i `:2157` (§1.5 pułapka 4).
   Test: w otwartym kroku 3 liczba elementów ze `scrollHeight >
   clientHeight` w drzewie dialogu = **1**.
2. **Wskaźnik dalszej treści jest JAWNY, nie sam gradient.** Plakietka
   przy dolnej krawędzi treści, nazywająca **liczbę i nazwy** sekcji niżej:
   - krok 1: `Niżej: 1 sekcja — Zaawansowane i frameworki BCG (7 typów)`
   - krok 2: `Niżej: 1 sekcja — Zawężenie materiału (daty, rola, dział)`
   - krok 3: `Niżej: 2 sekcje — Wątki tematyczne, Dokumenty kontekstowe · potem kontrakt AI`
   Plakietka jest **klikalna** (przewija) i **znika na końcu treści**.
3. **Znacznik „Koniec kroku"** — na końcu treści kroku 3 jawny separator
   `Koniec kroku — dalej już nic nie ma`. To jest bezpośrednia odpowiedź na
   `INT-CREATOR-EVD-004`.
4. **Zero przewijania poziomego** przy wspieranych szerokościach i przy
   zoomie 200%.
5. **Przy zmianie kroku**: fokus na nagłówek kroku, treść wraca na górę,
   **wszystkie wcześniejsze wybory zachowane** przy `Wstecz`/`Dalej`
   (wytyczne `:144-145`).

**DoD S.7:** jeden scroll (test liczący); plakietka z liczbą i nazwami
sekcji, znikająca na końcu; „Koniec kroku" w kroku 3; brak scrolla
poziomego przy 1280/1440/1920 i zoom 200%; fokus i pozycja po zmianie kroku.

---

## §K. SEKCJA KROKI — trzy pozycje

Struktura treści każdego kroku: `swrap` (max 880 px) → `qhead` (H2 `18/24`
+ podtytuł `14/20`) → sekcje `sect` (odstęp 24 px) → ewentualny `notice`.

### K.1 — Krok 1 „Definicja" (rekomendacja 2)

Nagłówek: **„Co ma powstać?"** / „Nazwij wynik i wybierz jego formę.
Materiał wskażesz w następnym kroku."

1. **Tytuł wniosku \*** — pole `48 px`, `font-size 15`, `font-weight 500`.
   Pod nim helper stanu: przy braku kolizji zielony ptaszek + „Brak
   podobnych wniosków o tej nazwie w projekcie <nazwa>." **Jeśli sprawdzanie
   kolizji nie ma API — helper nie powstaje** (DoD 1, wpis `BRAK_API`).
2. **Typ wyniku \*** — nagłówek sekcji + **licznik po prawej: „Wybrano N
   z 13"**.
3. **Sześć kart podstawowych, dwie kolumny, min-height 64 px**, każda:
   ikona 30 px w ramce, tytuł `14/20` **600**, opis `12/16` muted,
   checkbox 18 px po prawej. `role="checkbox"` + `aria-checked`.
   **Sześć podstawowych (kolejność wiążąca):** Podsumowanie wykonawcze ·
   Odkrywanie problemów · Analiza ogólna · Analiza trendów · Rekomendacje ·
   Porównanie wywiadów.
4. **Helper pod kartami:** „Sześć typów podstawowych. Zaawansowane
   i frameworki BCG są niżej — nic nie znika, jest zwinięte."
5. **Zwinięta sekcja `Zaawansowane i frameworki BCG`** — pasek 48 px:
   chevron · tytuł **600** · podsumowanie wymieniające ukryte typy
   **z nazwy** (`Analiza luk · Ocena ryzyk · Skan szans · Ocena dojrzałości ·
   Mapa interesariuszy · +2`) · plakietka **`7 typów`**.
   **★ Zasada z wytycznych (`:130-131`): ukrywanie pól WYŁĄCZNIE po to, by
   zmniejszyć gęstość, jest ZAKAZANE.** Zwijasz grupę, która ma własną
   nazwę i licznik — i tylko dlatego wolno.
6. **`notice` na dole:** „Wynik zapisze się jako obiekt Wniosek w module
   Wywiad" + „Zachowamy autora, czas, wersję modelu, parametry i pochodzenie
   materiału (sesja → wniosek → inicjatywa)."
7. **★ Kontrakt pierwszego widoku przy 1440×900:** tytuł, **pełny wybór
   typu podstawowego** i przycisk główny widoczne **bez przewijania**.
   To jest asercja testowa i asercja zrzutowa.

**DoD K.1:** wszystkie 13 typów dostępnych (6 + 7 zwinięte, z nazwami);
licznik „N z 13"; karty 64 px w 2 kolumnach; kontrakt pierwszego widoku
1440×900; plakietka „Niżej: 1 sekcja…"; zrzut light+dark vs prototyp.

### K.2 — Krok 2 „Materiał" (rekomendacja 6)

Nagłówek: **„Z jakiego materiału korzystamy?"** / „Do analizy wchodzą
wyłącznie sesje zatwierdzone przez menedżera. Resztę widzisz i wiesz
dlaczego jej nie ma."

1. **★ Pasek zatwierdzenia na górze** (`notice.warn`, akcent
   `--c-warning`, nie czerwień): „`N` sesji w projekcie · `M`
   zatwierdzonych wejdzie do analizy" + druga linia z **powodami**
   („2 sesje czekają na akceptację (<osoba>), 1 sesja odesłana do poprawy
   <data> (<osoba>)") + przycisk **`Pokaż wykluczone (K)`**.
   **Materiał niezatwierdzony nigdy nie wchodzi do analizy po cichu**
   (wytyczne `:111-112`).
   `Pokaż wykluczone` wymaga API — jeśli go nie ma, przycisk **nie
   powstaje**, a pasek nadal podaje liczby i powody (`C-O2`).
2. **Osoby — PEŁNA SZEROKOŚĆ (880 px)**, wiersze `min-height 56 px`:
   checkbox 18 px · nazwisko `14/20` **600** · rola + dział `12/16` muted ·
   liczba sesji po prawej, `tabular-nums`.
3. **Wiersz zbiorczy na górze listy**: „Wszystkie osoby z zatwierdzonym
   materiałem" + `N osób · M sesji · okres <od> – <do>`.
   **Nagie „All people" bez tej informacji jest defektem** (`INT-CREATOR-EVD-002`).
4. **★ Wiersz niedostępny ZAWSZE podaje powód.** Widoczny, nieklikalny
   (`aria-disabled`), `opacity .72`, checkbox `border-style: dashed`,
   powód w linii opisu wyróżniony kolorem `--c-warning`
   (np. „czeka na akceptację menedżera").
5. **Helper pod listą:** „Wiersz niedostępny zawsze podaje powód. Pusty
   wybór osób jest zakazany — zawsze widać, co jest i czego brakuje."
   **Pusty selektor jest zakazany** (wytyczne `:180`); „brak danych" musi
   różnić się od „brak danych spełniających warunki".
6. **Zawężenie materiału — osobna sekcja, siatka 2×2**, każde pole
   **min. 280 px**: `Data od` · `Data do` · `Rola respondenta` · `Dział`.
   Nagłówek sekcji z adnotacją po prawej: „Opcjonalne — bez zmian
   analizujemy wszystko powyżej".
7. **`Uruchom teraz` w stopce** (rekomendacja 7) — startuje **tę samą
   operację** co CTA kroku 3, na wartościach domyślnych kroku 3.
8. Licznik w nagłówku sekcji osób: „Wybrano `N` z `M` · `K` sesji".

**DoD K.2:** pasek 3 liczb + powody; osoby na pełnej szerokości z wierszem
zbiorczym; wiersz niedostępny z powodem; filtry 2×2 ≥ 280 px; „Uruchom
teraz" działa; pusty stan rozróżniony; zrzut light+dark vs prototyp.

### K.3 — Krok 3 „Dostrojenie"

Nagłówek: **„Czy chcesz dostroić analizę?"** / „Ten krok jest opcjonalny.
Pytanie przewodnie zwykle wystarcza — reszta ma sensowne wartości domyślne."

1. **★ Pytanie przewodnie dominuje POZYCJĄ I ROZMIAREM, nie kolorem.**
   Zwykły `textarea` (`min-height 112 px`, `14/20`) na **płaskim tle**,
   pierwszy w treści. **Fioletowa ramka z `INT-CREATOR-EVD-003` znika.**
   Adnotacja w nagłówku pola: „Jedyne pole, które zwykle warto wypełnić".
   Helper: „Pytanie kieruje analizą, nie ogranicza materiału. Bez niego AI
   wybierze najważniejsze obserwacje samodzielnie."
2. **★ „Zaawansowane" to JEDEN pasek 48 px** z podsumowaniem
   („tryb analizy · wątki · dokumenty kontekstowe") i licznikiem
   **`N zmian`**. Po rozwinięciu — **jedna ramka**, w środku sekcje
   oddzielone **odstępem**, nie kolejnymi ramkami.
   **Koniec z ramkami w ramkach** (`INT-CREATOR-EVD-003`).
3. **Tryb analizy**: cztery karty w dwóch kolumnach + licznik „Wybrano N
   z 7" + helper wymieniający **z nazwy** pozostałe trzy tryby
   („Skan inicjatyw i szans · Ocena jakości materiału · Między wierszami").
   **Zero własnego paska przewijania** (usuwasz `:1774`).
4. **Wątki tematyczne**: pigułki 32 px, licznik „Wybrano N z 12".
   **Zero własnego paska przewijania** (usuwasz `:2157`).
5. **Dokumenty kontekstowe**: licznik w nagłówku sekcji
   („`N` gotowy · `M` w przetwarzaniu · limit 5"), strefa drop z listą
   formatów i limitów, lista plików z plakietką stanu.
   **Plik w przetwarzaniu jest nieklikalny i podaje powód**
   („Przetwarzanie — wejdzie do analizy dopiero po zakończeniu").
6. **★ Kontrakt operacji AI NAD STOPKĄ** (`notice`), zawierający
   **wszystkie pięć**: (a) co wejdzie — liczba zatwierdzonych sesji, osób,
   zakres dat, liczba dokumentów i fragmentów; (b) co powstanie — wymienione
   typy wyniku; (c) że wynik jest **propozycją do akceptacji**;
   (d) szacowany czas; (e) że operacja jest **przerywalna i nie tworzy
   duplikatu po ponowieniu**.
   Wartości **liczone**, nie zaszyte. Nieznany szacowany czas → nie
   zmyślasz go, tylko pomijasz i piszesz o tym w raporcie.
7. **Znacznik „Koniec kroku — dalej już nic nie ma"** na końcu treści (§S.7).

**DoD K.3:** pytanie przewodnie bez fioletowej ramki, pierwsze w treści;
„Zaawansowane" jako jeden pasek z licznikiem; **zero zagnieżdżonego
scrolla** (test liczący); kontrakt AI z pięcioma elementami, liczony;
„Koniec kroku"; zrzut light+dark vs prototyp.

---

## §W. SEKCJA WSPÓLNA POWŁOKA WNIOSEK + INICJATYWA (rekomendacja 9)

**Właściciel powiedział: „muszą wyglądać tak samo".** Rekomendacja 9
rozstrzyga, jak głęboko.

### W.1 — Co dokładnie jest wspólne

**Wspólne (mieszka w powłoce):** geometria, nagłówek, pasek kroków, pasek
zakresu, stopka, stany (ładowanie / błąd / pusty / sukces), walidacja
i uzasadnienie blokady CTA, zapis szkicu, obsługa czterech awarii AI.

**Osobne (treść środka):** Wniosek ma 3 kroki, Inicjatywa 5
(Wnioski · Zamiar · Kandydaci · Nadzór · Wynik), Przypisanie działa
w wariancie kompaktowym bez kroków.

**Odrzucone wprost:** „jeden komponent sterowany konfiguracją treści" —
ryzyko, że konfiguracja urośnie szybciej niż trzy jasne warianty jednej
powłoki.

### W.2 — Ile wolno Ci zmienić w `InitiativeWizardModal` — SUFIT

1. **WOLNO:** podmienić bespoke chrome na wspólną powłokę **za tą samą
   flagą `ff.interview_creator_shell`** i doprowadzić do parytetu **kroki 1 (Wnioski)
   i 2 (Zamiar)** — jedyne, dla których istnieje dowód
   (`INT-INIT-CREATOR-EVD-001..004`).
2. **★ STOP na krokach 3–5** (Kandydaci · Nadzór · Wynik):
   `STEPS_3_5_EVIDENCE_MISSING`. Wolno im dać **wspólną powłokę**
   (bo powłoka jest identyczna z definicji), ale **nie wolno przebudowywać
   ich treści, układu ani etykiet**. Dotknięcie treści = STOP z wpisem.
3. **Kolejność pilotażu z wytycznych (§11): Przypisanie → Wniosek →
   Inicjatywa.** Właściciel zaakceptował prototyp **Wniosku**. Dlatego:
   **jeżeli zabraknie czasu, §W jest pierwsze do odpuszczenia** — Wniosek
   musi być domknięty co do DoD, Inicjatywa może zostać na dzisiejszej
   powłoce z wpisem w raporcie. **Odwrotna kolejność jest błędem.**
4. **Nie ruszasz mechaniki Inicjatywy** — ładowania wniosków, sygnału
   wydolności, osi audytu, sprawdzania podobieństwa, triage kandydatów,
   tworzenia szkiców. To jest zaakceptowana merytoryka (Z16).
5. **`InitiativeCharterWizard`, `AuditOrchestratorWizard`,
   `ReportGeneratorWizard` — NIE RUSZASZ** (`C-O4`).

**DoD W:** wspólna powłoka pod flagą w obu kreatorach; parytet kroków 1–2
Inicjatywy; kroki 3–5 z powłoką, ale **bez zmian treści**; wpis STOP
`STEPS_3_5_EVIDENCE_MISSING`; zrzut kreatora Inicjatywy krok 1 i 2
(light+dark) obok kreatora Wniosku — **dowód, że wyglądają tak samo**.

---

## §T. SEKCJA TESTY — sześć pozycji

### T.1 — ★ Jedyny dopuszczalny przypadek zmiany testu istniejącego

Wolno Ci **dodać** przypadki do
`src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx`.
**Nie wolno** osłabić ani usunąć żadnej istniejącej asercji.

Jedyny dopuszczalny wyjątek: jeżeli istniejący test asertuje **dosłownie
geometrię `720×560`** i Twoja zmiana pod flagą ON ją zmienia — wtedy
**rozszerzasz test o oba przypadki** (`flaga OFF → 720×560`,
`flaga ON → 1040×840`), nigdy nie kasujesz starego. Fakt takiej zmiany
opisujesz w raporcie w osobnej sekcji „Zmiana testu istniejącego"
z cytatem przed/po.

### T.2 — Dowód OFF jako osobny, jawny pakiet

Minimum trzy asercje, wszystkie **renderujące**:
1. przy OFF panel ma dzisiejszą geometrię i dzisiejszy chrome;
2. przy OFF **żaden** element nowej powłoki nie istnieje w drzewie
   (`queryBy… === null`);
3. przy OFF nie leci **żadne** nowe żądanie (spy na klienta API).

### T.3 — Kontrakty powłoki

Po jednym teście na: token geometrii · brak zmiany rozmiaru między krokami ·
cztery pasy o zadanych wysokościach · fallback `prefers-reduced-transparency` ·
**dokładnie jeden obszar przewijany** · plakietka „Niżej: N sekcji" znikająca
na końcu · „Koniec kroku" · zablokowany CTA z powodem · autozapis + pytanie
przy zamknięciu brudnego · cztery awarie AI z zachowaniem danych.

### T.4 — i18n PL + EN, parytet utrzymany

Wszystkie napisy pod `interview.creator.*`, w obu plikach, w tym samym
commicie co kod. Test parytetu: zbiór kluczy `interview.creator.*` w PL
**identyczny** ze zbiorem w EN. Zero literałów w JSX — sprawdzasz to
punktowo:
```bash
grep -nE '>[^<>{]*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ][^<>{]*<' src/components/Interview/InsightCreatorModal.tsx | head -30
```
Wynik powinien być pusty dla nowo dodanych fragmentów.

### T.5 — Ekran harnessu i dane dowodowe

Powstaje **jeden** nowy ekran harnessu
`dev-render/screens/interview-creator-shell.tsx`, zarejestrowany
w `dev-render/main.tsx` (lazy import + wpis w rejestrze SCREENS) — wzorem
`interview-preview-canon`. Ekran:
- montuje **realny** `InsightCreatorModal` (i, jeśli §W zrobione, realny
  `InitiativeWizardModal`) z **mockami w pliku ekranu**, bez backendu;
- przyjmuje z URL: `step=1|2|3`, `scene=default|off|ai-error|empty|partial`,
  `lang`, `theme`;
- **wymusza flagę** przez `localStorage` na starcie i **jawnie zapisuje
  `false` dla `scene=off`** (nigdy „nie ruszam" — inaczej flaga wycieknie
  z poprzedniej nawigacji).

Fixture stresowy wg wytycznych (`:207-208`): **≥ 50 szablonów, 100 osób,
30 wniosków, 10 kandydatów, długie etykiety PL/EN i pięć jednoczesnych
błędów walidacji.** Jeśli nie zrobisz pełnego — wpisz, ile zrobiłeś.

### T.6 — Dostępność i responsywność

- pełna ścieżka klawiaturą; **pułapka fokusu** w dialogu i **powrót fokusu**
  po zamknięciu. Dzisiejszy `WizardModal` robi tylko jednorazowy
  `panelRef.current?.focus()` (`:111-113`) na panelu z `tabIndex={-1}`
  (`:146-147`) — **to nie jest pułapka fokusu**: `Tab` wychodzi z dialogu,
  a fokus nie wraca po zamknięciu. **Lek jest gotowy w repo:**
  `src/components/ui/primitives/useDialogA11y.ts` (kontrakt opisany testem
  `src/components/ui/primitives/__tests__/useDialogA11y.test.tsx`).
  Podłączasz go **w wariancie kreatora, za flagą** — nie zmieniasz
  zachowania Reports/Charter. Hooka **nie modyfikujesz** (Z19);
- **brak portalu**: `WizardModal` renderuje się inline (zero `createPortal`
  w całej rodzinie), a overlay ma `z-overlay` = 50
  (`tailwind.config.js:57`). Jeżeli nowa geometria wywoła problem
  z nakładaniem, **nie dodajesz portalu po cichu** — to zmiana kontraktu
  dla dwóch cudzych konsumentów powłoki, czyli STOP z propozycją;
- `aria-current="step"` na kroku bieżącym, ogłaszanie zmiany kroku;
- macierz szerokości: `1280×720`, `1440×900`, `1920×1080`, tablet,
  pełny ekran mobile, **zoom 200%** — bez scrolla poziomego, bez ukrytego
  CTA, bez nieujawnionej sekcji wymaganej;
- `prefers-reduced-motion`: bez skalowania i przesunięć; animacje
  `150–220 ms`.

---

## §R. SEKCJA REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 02_INTERVIEW do stanu faktycznego

Aktualizujesz **wyłącznie** fakty wynikające z tego dyżuru: co zbudowane,
za jaką flagą, jakie dowody powstały, co zostało jako `BRAK_API` / STOP.
**Nie zmieniasz werdyktu odbiorowego** — to rola nadzorcy i właściciela.
`INT-CREATOR-OWN-001` pozostaje `PENDING` do odbioru wizualnego.
**Nie kasujesz** statusu `STEPS_3_5_EVIDENCE_MISSING`.

### R.2 — ★ Komplet dowodów z PARYTETEM WIZUALNYM

Katalog: `modules/02_INTERVIEW/evidence/day13/`.

**Minimum zrzutów (light + dark, PL, 1440×900):**

| Plik | Scena |
| --- | --- |
| `DAY13-01_DEFINICJA_{LIGHT,DARK}.png` | krok 1, stan domyślny |
| `DAY13-02_MATERIAL_{LIGHT,DARK}.png` | krok 2, stan domyślny |
| `DAY13-03_DOSTROJENIE_{LIGHT,DARK}.png` | krok 3, „Zaawansowane" rozwinięte |
| `DAY13-04_FLAG_OFF_{LIGHT,DARK}.png` | flaga OFF — dzisiejszy wygląd |
| `DAY13-05_AI_ERROR_{LIGHT,DARK}.png` | jedna z czterech awarii AI z zachowanymi danymi |
| `DAY13-06_REDUCED_TRANSPARENCY_LIGHT.png` | fallback pełnego krycia |
| `DAY13-07_INICJATYWA_KROK1_{LIGHT,DARK}.png` | tylko jeśli §W zrobione |

**★ PARYTET: do każdego zrzutu 01–03 dokładasz w raporcie tabelę
porównania z odpowiednim zrzutem prototypu**
(`prototypes/evidence/INT-CREATOR-PROTO-0*_LIGHT.png` / `_DARK.png`):

```
| Element | Prototyp | Mój zrzut | Zgodne? |
| wysokość nagłówka | 60 px | ... | TAK/NIE + powód |
| wysokość pasa kroków | 70 px | ... | |
| wysokość pasa zakresu | 36 px | ... | |
| wysokość stopki | 70 px | ... | |
| szerokość treści | 880 px | ... | |
| liczba kart typu wyniku widocznych | 6 | ... | |
| etykieta CTA | „Dalej: Materiał" | ... | |
| plakietka „Niżej…" | jest | ... | |
```

Każde `NIE` wymaga zdania uzasadnienia. **Zrzut bez tabeli parytetu nie
jest dowodem.** Do każdego zrzutu dołączasz wynik `KONSOLA-BLEDY`
i `SIEC-4XX5XX` z `shot.mjs`.

---

## 8. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz)

1. `git fetch --all --prune`; **weryfikacja markera** (SHA masz w §0.1 pkt 1):
   ```bash
   MARKER=<SHA-markera-z-§0.1>
   git merge-base --is-ancestor "$MARKER" codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```
   Brak → **STOP i koniec dyżuru** (§0.1 pkt 2).
2. Weryfikacja materiałów wiążących (§0.1 pkt 3). Brak → **STOP**.
   **Otwórz i przeczytaj trzy pliki prototypu w całości** — to jest
   warunek wstępny, nie formalność.
3. Utworzenie gałęzi + worktree (§0.1 pkt 4–5).
4. **★ Weryfikacja mapy technicznej z §2 — mapa mogła się zestarzeć.**
   Wykonujesz **wszystkie** poniższe i **każdą rozbieżność wpisujesz do
   „Korekt wobec instrukcji"**; dalej pracujesz na stanie faktycznym.
   ```bash
   # rozmiary (§2.1)
   wc -l src/components/shared/WizardModal/WizardModal.tsx          # oczekiwane 265
   wc -l src/components/Interview/InsightCreatorModal.tsx           # oczekiwane 2670
   wc -l src/components/Interview/InterviewHub.tsx                  # oczekiwane 10077
   wc -l src/components/Initiatives/Wizard/InitiativeWizardModal.tsx # oczekiwane 2700

   # ★ pułapka 1 — KTO używa pełnej powłoki, a kto tylko steppera
   grep -rn "<WizardModal" src/ | grep -v "shared/WizardModal/"
   # oczekiwane: DWA pliki — Reports/Wizard/ReportGeneratorWizard.tsx (:637,:651)
   #             i Initiatives/Wizard/InitiativeCharterWizard.tsx (:840)
   grep -rln "shared/WizardModal" src/ | sort                       # oczekiwane 5 plików

   # ★ pułapka 2 — TRZY miejsca z zaszytą geometrią, w tym jeden rozjazd
   grep -n "h-\[560px\]\|w-\[720px\]" src/components/shared/WizardModal/WizardModal.tsx        # :151
   grep -n "h-\[560px\]\|w-\[720px\]" src/components/Interview/InsightCreatorModal.tsx         # :2584
   grep -n "h-\[640px\]\|w-\[1080px\]" src/components/Initiatives/Wizard/InitiativeWizardModal.tsx  # :2537

   # ★ pułapka 3 — nazwy kroków
   grep -n "CreatorStepId" src/components/Interview/InsightCreatorModal.tsx  # oczekiwane :74 define|material|refine

   # ★ pułapka 4 — zagnieżdżony scroll
   grep -n "overflow-auto" src/components/Interview/InsightCreatorModal.tsx  # oczekiwane min. :1774 :2157

   # ★ pułapka 5 — SIEDEM punktów montażu w Hubie
   grep -n "InsightCreatorModal\|InitiativeWizardModal\|showInsightModal\|showInitiativeWizard" src/components/Interview/InterviewHub.tsx
   # oczekiwane: :72 :137 :758 :781 :3763 :5381 :9251 :9267 :9373 :10049
   grep -rn "InsightCreatorModal" src/components/shared/UnifiedCreateLauncher.tsx   # oczekiwane :33 :190

   # akcent (DoD 5) i brak pułapki fokusu / portalu
   grep -n "DEFAULT_ACCENT\|color-primary" src/components/shared/WizardModal/WizardModal.tsx  # :45
   grep -rn "createPortal" src/components/shared/WizardModal/                                  # oczekiwane: PUSTY
   ls src/components/ui/primitives/useDialogA11y.ts                                            # gotowy lek na fokus

   # flaga — wzorzec z precedensem W INTERVIEW
   grep -n "ff\.\|ff_\|VITE_" src/utils/interviewPipelineStepperFlag.ts        # :28-32
   grep -n "isInterviewPipelineStepperEnabled" src/components/Interview/InterviewHub.tsx  # :123 import, :9363 realny czytelnik

   # trasa (D1)
   grep -n "INTERVIEW" src/routes/routeConfig.ts                    # :43 '/interview', :462 mapa widoku
   grep -n "ROUTES.INTERVIEW" src/routes/AppRoutes.tsx              # :1941
   npx vitest run src/routes/__tests__/interviewAliasRedirect.test.ts

   # harness (§2.6)
   ls dev-render/screens/interview-preview-canon.tsx
   grep -n "interview-preview-canon" dev-render/main.tsx            # oczekiwane :217 i :680
   grep -n "SCREENS" dev-render/main.tsx | head -3                  # rejestr :345

   # tokeny i szkło (§1.5 pułapki 7-9)
   grep -n -- "--c-focus-solid\|--c-surface-raised" src/index.css | head -6   # light od :6, dark od :233
   grep -rn "prefers-reduced-transparency" src/                     # oczekiwane: PUSTY (nowa zdolność)

   # i18n (§2.5)
   python3 -c "import json;[print(l,len(json.load(open('public/locales/%s/translation.json'%l)).get('interview',{}))) for l in ('pl','en')]"

   # historia obszaru (§1.4)
   git log --oneline -10 -- src/components/Interview/
   git log --oneline -10 -- src/components/Initiatives/Wizard/
   git log --oneline -5  -- src/components/shared/WizardModal/
   ```
5. **Dowód stanu wyjściowego testów** — **wyniki wklejasz do raportu**,
   to Twój punkt odniesienia przy odbiorze:
   ```bash
   npx vitest run src/components/Interview/__tests__
   npx vitest run src/components/Initiatives/Wizard/__tests__
   npx vitest run tests/components/Interview
   npx vitest run src/routes/__tests__/interviewAliasRedirect.test.ts
   ```
6. **Stan zastany kanonu tabel** (punkt odniesienia dla Bloku 6):
   ```bash
   bash scripts/check-list-canon.sh 2>&1 | tail -20
   ```
   Liczbę naruszeń i baseline wpisujesz do raportu — po dyżurze **nie może
   urosnąć**.
7. **Uruchomienie harnessu i pierwszy zrzut stanu ZASTANEGO** — żeby mieć
   „przed":
   ```bash
   npx vite --config dev-render/vite.config.ts --port 3356
   # w drugim terminalu, po dodaniu ekranu (albo na istniejącym ekranie Interview)
   node dev-render/shot.mjs /tmp/day13-before.png "http://localhost:3356/?screen=interview-preview-canon&lang=pl&theme=light"
   ```
   Cel: potwierdzić, że harness **działa u Ciebie**, zanim zaczniesz kod.
8. Założenie pliku raportu (§9) i wpisanie wyników kroków 1–7.

### Blok 1 — fundament (S.0 → S.1)

S.0 jest tanie i w większości bez kodu — **robisz je pierwsze**, bo od
tabeli delty zależy, co w ogóle da się zbudować bez backendu.
Potem token geometrii — bez niego nie ma o czym mówić.

### Blok 2 — powłoka (S.2 → S.3 → S.4 → S.7)

Najpierw wersja **nieprzezroczysta**, przechodząca kontrast/fokus/scroll.
Szkło dokładasz na końcu bloku, jako warstwę.

### Blok 3 — stany powłoki (S.5 → S.6)

Autozapis i cztery awarie AI. **S.6 zaczynasz od inwentarza `C-O3`** —
jeżeli backend nie daje typów, produktem jest STOP z propozycją kontraktu,
a nie zmyślone cztery przypadki.

### Blok 4 — treść kroków (K.1 → K.2 → K.3)

Kolejność nieprzypadkowa: K.1 jest najtańsze i domyka kontrakt pierwszego
widoku; K.3 jest najgęstsze i tam siedzą dwa zagnieżdżone scrolle.

### Blok 5 — wspólnota z Inicjatywą (W.1 → W.2)

**Blok najłatwiejszy do odpuszczenia.** Jeżeli Wniosek nie jest domknięty
co do DoD — **nie zaczynasz tego bloku**.

### Blok 6 — domknięcie (obowiązkowo, ~80 min, NIE pomijasz)

1. **T.1 · T.2 · T.3 · T.4 · T.5 · T.6 · R.1 · R.2** — testy, zrzuty
   i rejestr **dla tego, co faktycznie zbudowałeś**. Nie dla tego, co
   planowałeś.
2. **Pomiar zasięgu testów** wg §0.4a: lista dotkniętych plików,
   wyodrębnienie współdzielonych, testy **pięciu** katalogów konsumentów
   `WizardModal`, jawna deklaracja `ZASIĘG PEŁNY` / `ZASIĘG CZĘŚCIOWY`.
3. **SIEDEM DOWODÓW — wszystkie do raportu, wszystkie obowiązkowe:**
   ```bash
   # (1) Z18 — globalna infrastruktura testowa            oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "tests/setup|tests/helpers|tests/__mocks__|vitest.*config"

   # (2) Z10 + DEC-65 — zero migracji, zero backendu       oczekiwany wynik: PUSTY
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -E "^(server/|server/migrations/)"

   # (3) Flagi — dokładnie JEDNA nowa, OFF wszędzie
   git diff codex/m03-admin-20260824...HEAD | grep -E "^\+.*(ff_|VITE_.*_ENABLED|localStorage: 'ff\.)"
   # oczekiwane: WYŁĄCZNIE trzy klucze flagi interviewCreatorShell
   grep -n "return false" src/utils/interviewCreatorShellFlag.ts
   # oczekiwane: twarde false, BEZ isDemoAcceptanceProfileEnabled i BEZ fallbacku D-D

   # (4) Z17 — zakres plików                              każdy plik w wyniku wymaga uzasadnienia
   git diff --name-only codex/m03-admin-20260824...HEAD | grep -vE "^(src/components/shared/WizardModal/|src/components/Interview/(InsightCreatorModal\.tsx|InterviewHub\.tsx|__tests__/)|src/utils/(interviewCreatorShellFlag\.ts|__tests__/interviewCreatorShellFlag\.test\.ts)|src/components/Initiatives/Wizard/InitiativeWizardModal\.tsx|public/locales/|dev-render/(screens/interview-creator-shell\.tsx|main\.tsx)|docs/program/waves/WAVE_03_ACCEPTANCE/(INTERVIEW_DAY13_REPORT|modules/02_INTERVIEW/))"
   # ★ Pliki z standard/, shared/ (poza WizardModal/), AppRoutes, routeConfig,
   #   Assessment/, server/, prototypes/ w wyniku = NARUSZENIE Z17

   # (5) Z17.a — rozmiar diffu w Hubie
   git diff --stat codex/m03-admin-20260824...HEAD -- src/components/Interview/InterviewHub.tsx
   # >20 linii wymaga uzasadnienia; >60 linii = STOP

   # (6) Kanon tabel — baseline nietknięty
   bash scripts/check-list-canon.sh 2>&1 | tail -20
   git diff codex/m03-admin-20260824...HEAD -- scripts/check-list-canon.baseline.txt
   # drugi wynik MUSI być pusty; pierwszy: liczba naruszeń NIE ROŚNIE

   # (7) ★ WIP właściciela + prototyp — oświadczenie w raporcie
   git diff --name-only codex/m03-admin-20260824...HEAD | grep "prototypes/"   # oczekiwany wynik: PUSTY
   # „nie otwierałem /Users/piotrwisniewski/Developer/Consultify"
   ```
4. **Ponowne uruchomienie trzech pakietów z Bloku 0 kroku 5** i wklejenie
   wyników „po" obok „przed".
5. **Komplet zrzutów + tabele parytetu** (§R.2).
6. Domknięcie raportu.

### Zasada nadrzędna kolejności

**Lepiej trzy pozycje domknięte co do DoD niż piętnaście „prawie".**
Jeżeli zostaje Ci godzina, nie zaczynaj nowej pozycji — zrób Blok 6,
uporządkuj commity i zamknij dyżur czysto. **Blok 6 nie jest opcjonalny.**

**Jeżeli musisz wybrać między pozycjami**, priorytet jest taki:

1. **S.0** — bez flagi i dowodu OFF nic z tego nie może istnieć w repo;
2. **S.1 + S.2** — to jest odpowiedź na główną uwagę właściciela
   („ekran możemy zrobić większy", „Liquid Glass");
3. **S.7** — jeden scroll i jawny wskaźnik dalszej treści zamykają
   `INT-CREATOR-EVD-003/004`, najtaniej z całego dyżuru;
4. **K.1 + K.2 + K.3** — treść kroków, w tej kolejności;
5. **S.5 + S.6** — autozapis i awarie AI;
6. **§W** — ostatnie, i pierwsze do odpuszczenia.

**Pięć pozycji otwartych z §1.7 NIE jest odkładalnych** — ich produktem
jest STOP w raporcie, a to kosztuje minuty, nie godziny.

---

## 9. RAPORT — jedyny dokument, który tworzysz

Ścieżka, dokładnie jedna:

```
docs/program/waves/WAVE_03_ACCEPTANCE/INTERVIEW_DAY13_REPORT_<data>.md
```

Raport leży **na poziomie fali**, nie w `modules/02_INTERVIEW/` — bo rejestr
modułu jest dokumentem odbiorowym i zmieniasz go wyłącznie w zakresie `R.1`.
Nie tworzysz drugiego pliku nigdzie indziej (Z13).

### 9.1. Szablon

```markdown
# Interview dzień 13 — Creator Shell — raport dyżuru <data>

Baza: codex/m03-admin-20260824 @ <tip SHA>
Marker: dfd259af47 — POTWIERDZONY / BRAK
Gałąź robocza: codex/interview-creator-day13-<data>
Worktree: /private/tmp/consultify-interview-creator-day13
Porty użyte: 4324/4325 · harness dev-render 3356   ·   Baza: ŻADNA   ·   Migracje: ZERO
Czas pracy: <od>–<do>

## Oświadczenie o chronionym WIP (Z4/Z5) i o prototypie (Z14)
Nie otwierałem, nie czytałem i nie kopiowałem katalogu
/Users/piotrwisniewski/Developer/Consultify — ani plików, ani diffów, ani gita.   TAK / NIE
Nie zmieniłem ani jednego pliku w docs/.../prototypes/ (dowód (7) Bloku 6).       TAK / NIE

## Oświadczenie o freeze (DEC-2026-08-25-65, Z8/Z9/Z10)
Nie wykonałem żadnego deployu, żadnej operacji Railway, żadnej zdalnej migracji,
żadnego zapisu do wspólnej bazy demo/staging i żadnego merge/push na
demo/develop/main. Nie użyłem żadnej bazy danych.                                TAK / NIE

## Warunki wstępne — wynik sprawdzenia (Blok 0 kroki 1–2)
| Sprawdzenie | Oczekiwane | Wynik | Dowód |

## Korekty wobec instrukcji (Blok 0 krok 4)
| Twierdzenie §2 | Stan faktyczny | Dowód plik:linia |

## ★ Tabela delty — 10 rekomendacji DEC-67 (produkt S.0)
| # | Rekomendacja | JEST / JEST_CZĘŚCIOWO / BRAK_UI_JEST_API / BRAK_API | Dowód | Zbudowane w |

## Pozycje — tabela zbiorcza
| Pozycja | Commit SHA | Status (DONE / CZĘŚCIOWA / STOP / NIE ZACZĘTA) | Dowód |
| S.0 | | | |
| S.1 … S.7 | | | |
| K.1 … K.3 | | | |
| W.1, W.2 | | | |
| T.1 … T.6 | | | |
| R.1, R.2 | | | |

## ★ Parytet wizualny z prototypem (produkt R.2)
### Krok 1 — Definicja
| Element | Prototyp | Mój zrzut | Zgodne? |
### Krok 2 — Materiał
### Krok 3 — Dostrojenie
(Każde „NIE" z jednym zdaniem uzasadnienia.)

## Flaga i dowód OFF
Nazwa: interviewCreatorShell · klucze: ff_interviewCreatorShell / ff.interview_creator_shell / VITE_INTERVIEW_CREATOR_SHELL
Wartość domyślna: OFF wszędzie (także demo i profil odbiorowy) — dowód: <plik:linia + test>
Dowód OFF behawioralny: <nazwa testu + wynik>
Dowód OFF wizualny: DAY13-04_FLAG_OFF_{LIGHT,DARK}.png

## BRAK_API — czego nie zbudowałem, bo nie ma czym
| Kontrolka z prototypu | Czego brakuje | Co byłoby potrzebne | Gdzie to opisałem |

## Pozycje otwarte — STOP-y do zatwierdzenia nadzorcy
### STOP — C-O1 trwałość szkicu (localStorage vs serwer)
### STOP — C-O2 API listy wykluczonych sesji
### STOP — C-O3 typowany błąd AI (cztery przyczyny)
### STOP — C-O4 adopcja powłoki przez trzech pozostałych konsumentów
### STOP — C-O5 wariant kompaktowy Przypisania
### STOP — STEPS_3_5_EVIDENCE_MISSING (jeśli §W dotknięte)
### STOP — <pozostałe, jeśli wystąpiły>

## Znaleziska (problemy w istniejącym kodzie — NIE naprawiane przeze mnie)
(m.in. nieaktualny komentarz nagłówkowy WizardModal.tsx:26-30 — §1.5 pułapka 1)

## Testy
### Testy własne
### Zmiana testu istniejącego (§T.1) — przed/po, cytat
### Pomiar zasięgu (§0.4a): ZASIĘG PEŁNY / CZĘŚCIOWY + wyniki 5 katalogów konsumentów
### Testy stanu wyjściowego — przed i po

## Siedem dowodów Bloku 6
(1) Z18 … (2) zero server/migracji … (3) jedna flaga OFF … (4) zakres Z17 …
(5) diff w InterviewHub (linii: N) … (6) kanon tabel … (7) prototyp nietknięty

## Zrzuty (R.2)
| Plik | Scena | KONSOLA-BLEDY | SIEC-4XX5XX |

## Licznik
Pozycji DONE: N/M · commitów: K · plików dotkniętych: P · linii diffu w InterviewHub.tsx: L

## Czego NIE zrobiłem i dlaczego
```

### 9.2. Zasady raportowania

- **Nigdy „gotowe do pokazania właścicielowi"** ani „gotowe do włączenia
  flagi". Jedyna dopuszczalna formuła: **„gotowe do zrzutu i odbioru przez
  nadzorcę"**.
- **Nigdy „testy przeszły" jako dowód działania.** Dowodem jest render +
  asercja na wyniku, a dla wyglądu — zrzut + tabela parytetu.
- **Każde „NIE" w tabeli parytetu wymaga zdania**, nie milczenia.
- **`BRAK_API` jest wynikiem pełnowartościowym.** Przycisk, który „na razie
  nic nie robi", nie jest.

---

## 10. ŚCIĄGA

### 10.1. Pliki, które otwierasz najczęściej

```
docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/interview-creator-prototyp-01-definicja.html
docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/interview-creator-prototyp-02-material.html
docs/program/waves/WAVE_03_ACCEPTANCE/prototypes/interview-creator-prototyp-03-dostrojenie.html
docs/program/waves/WAVE_03_ACCEPTANCE/modules/02_INTERVIEW/CONSULTING_CREATOR_GUIDELINES.md
src/components/shared/WizardModal/WizardModal.tsx          :45 akcent · :98 Esc · :111 „focus" · :151 geometria · :189 stepper
src/components/shared/WizardModal/types.ts                 :28 WizardStep · :47 WizardModalProps
src/components/Interview/InsightCreatorModal.tsx           :74 kroki · :1774 scroll · :2157 scroll · :2577 overlay · :2584 geometria
src/components/Initiatives/Wizard/InitiativeWizardModal.tsx :2528 overlay · :2537 geometria 1080x640
src/components/Interview/InterviewHub.tsx                  :72 :137 :758 :781 :3763 :5381 :9251 :9267 :9373 :10049  (TYLKO te punkty)
src/components/ui/primitives/useDialogA11y.ts              (pułapka fokusu — UŻYWAĆ, NIE ZMIENIAĆ)
src/index.css                                              :6 tokeny light · :233 tokeny .dark
src/utils/interviewCreatorShellFlag.ts          (NOWY — Twój)
src/utils/interviewPipelineStepperFlag.ts                  (wzorzec flagi — TYLKO ODCZYT)
dev-render/main.tsx  ·  dev-render/screens/interview-preview-canon.tsx  ·  dev-render/shot.mjs
```

### 10.2. Komendy

```bash
# harness + zrzut
npx vite --config dev-render/vite.config.ts --port 3356
node dev-render/shot.mjs out.png "http://localhost:3356/?screen=interview-creator-shell&step=1&lang=pl&theme=light" --w=1440 --h=900

# typy punktowo
npx esbuild src/components/Interview/InsightCreatorModal.tsx --loader:.tsx=tsx --outfile=/dev/null

# testy celowane
npx vitest run src/components/Interview/__tests__
npx vitest run src/components/Initiatives/Wizard/__tests__

# hooki
bash scripts/check-list-canon.sh src/components/Interview/InsightCreatorModal.tsx

# porównanie z bazą
git diff --name-only codex/m03-admin-20260824...HEAD
git diff --stat codex/m03-admin-20260824...HEAD -- src/components/Interview/InterviewHub.tsx
```

### 10.3. Dziesięć rzeczy, które najłatwiej zepsuć

1. **Zbudować nową powłokę zamiast rozszerzyć `WizardModal`.** To jest
   czwarty system kreatorów i odrzucenie dyżuru.
2. **Zmienić `DEFAULT_ACCENT` globalnie** i przemalować cztery cudze
   kreatory na crimson.
3. **Zrefaktorować `InterviewHub.tsx`.** 10 077 linii, akcept właściciela
   na zrzutach. Dotykasz **czterech miejsc**.
4. **Puścić `prettier --write src/`** i zrobić diff na 40 000 linii.
5. **Zapomnieć o fallbacku `prefers-reduced-transparency`** i zostawić
   szkło jako jedyny nośnik separacji.
6. **Zostawić zagnieżdżony scroll** w kroku 3 (`:1774`, `:2157`) — to jest
   dokładnie uwaga `INT-CREATOR-EVD-003`.
7. **Zbudować „Pokaż wykluczone (3)" bez API** i zrobić atrapę z tego, co
   miało naprawiać atrapę.
8. **Zmyślić cztery typy błędu AI**, których backend nie rozróżnia.
9. **Zmienić plik prototypu**, żeby „pasował do kodu".
10. **Napisać w raporcie „gotowe do pokazania właścicielowi".**

### 10.4. Tokeny kolorów (jedyne dozwolone)

```
--c-text            --c-surface           --c-success
--c-text-secondary  --c-surface-raised    --c-danger
--c-text-muted      --c-border            --c-info
                    --c-border-subtle     --c-focus
                    --c-border-strong     --c-warning
--c-cta-bg / --c-cta-text        (CTA neutralne)
--c-active-bg / --c-active-border / --c-active-text   (stan aktywny)
--glass-bg / --glass-line / --scrim                   (WYŁĄCZNIE 4 pasy powłoki)
```

Źródło tokenów: **`src/index.css`** — 160 deklaracji `--c-*`; motyw jasny
w `:root` (od `:6`), ciemny w **`.dark`** (od `:233`).
`--c-focus: rgba(37,99,235,.4)` `:70`, `--c-focus-solid: #2563eb` `:72`
(dark `#5b8def` `:266-292`). Reguły obrysu fokusu: `:1049`, `:1059`, `:1088`.
`--c-focus` **świadomie nie idzie za akcentem użytkownika** (komentarz `:731`).

`--c-accent` = crimson = **wyłącznie marka**, nigdy element UI.
Fokus zawsze: `focus-visible:ring-2 ring-[color:var(--c-focus)]`.

W tym dyżurze `--c-danger` **wolno** użyć wyłącznie dla stanu faktycznie
krytycznego (nieudany zapis szkicu, awaria AI). **Nie wolno** dla: nagłówka
sekcji, kroku aktywnego, CTA, plakietki „Niżej: N sekcji", wiersza
niedostępnego (to `--c-warning`, nie błąd), sesji czekającej na akceptację
ani stanu „brak danych".

---

## 11. NA KONIEC

Ten dyżur robi cztery rzeczy, których nikt jeszcze nie wykonał, a które
właściciel zamówił 22 sierpnia i zatwierdził 25 sierpnia decyzją
`DEC-2026-08-25-67`.

**Pierwsza — kreator przestaje być za mały.** Właściciel powiedział wprost:
„ekran możemy zrobić większy". Dziś powłoka ma zaszyte `720×560`
w dwóch miejscach naraz (`WizardModal.tsx:151`,
`InsightCreatorModal.tsx:2584`) i to jest bezpośrednie źródło uwagi
`INT-CREATOR-EVD-001`. Po tym dyżurze rozmiar jest **jednym tokenem
`1040×840`**, wspólnym dla Wniosku, Inicjatywy i (w przyszłości)
Przypisania, a dialog **nie drga między krokami**.

**Druga — użytkownik wie, ile jeszcze zostało.** Cztery z pięciu dowodów
z przeglądu mówią o tym samym: treść ucieka pod zagięcie, są trzy paski
przewijania, a końca nie widać. Po tym dyżurze w całym dialogu jest
**dokładnie jeden obszar przewijany**, na dole stoi plakietka nazywająca
**liczbę i nazwy** sekcji niżej, a krok 3 kończy się jawnym „Koniec kroku —
dalej już nic nie ma".

**Trzecia — kreator przestaje kłamać o materiale.** Dziś nie wiadomo,
czemu liczba sesji w kreatorze różni się od liczby w module. Po tym dyżurze
pasek u góry kroku 2 mówi `15 / 12 / 3`, każde wykluczenie ma **powód**,
wiersz niedostępny jest **widoczny i opisany**, a nad stopką kroku 3 stoi
**kontrakt operacji AI**: co wejdzie, co powstanie, ile potrwa, że wynik
jest **propozycją**, i że ponowienie nie tworzy duplikatu.

**Czwarta — dwa kreatory zaczynają wyglądać tak samo.** Właściciel
powiedział to jednym zdaniem: „muszą wyglądać tak samo". Rekomendacja 9
rozstrzyga jak głęboko: **wspólna powłoka, osobna treść**. Ale kroki 3–5
Inicjatywy nie mają dowodu (`STEPS_3_5_EVIDENCE_MISSING`) — więc dostają
powłokę i **nic więcej**.

Trzy rzeczy, których ten dyżur **nie robi**, i to jest celowe: nie dotyka
DRD (`D2` — osobny silnik, osobne tryby), nie tworzy trasy dla kreatora
(`D1` — jeden adres `/interview`, dialog nad listą), nie zmienia mechaniki
biznesowej ani silnika AI (właściciel: „merytorycznie to narzędzie jest ok").

Jedna rzecz, którą ten dyżur ma zrobić **lepiej niż poprzednie**: nie
zostawić ani jednej kontrolki, która wygląda na działającą, a nie jest.
Prototyp obiecuje „Pokaż wykluczone (3)", cztery rozróżnione awarie AI
i szacowany czas operacji. Jeżeli któregoś z nich nie da się dowieźć
uczciwie — **wpis `BRAK_API` z pełną tabelą jest odpowiedzią**. Przycisk,
który „na razie nic nie robi", nie jest.

I siedem rzeczy, które sprawdzimy **przed** wszystkim innym przy odbiorze:
czy `git diff --name-only` nie zawiera ani jednego pliku globalnej
infrastruktury testowej (Z18); czy nie ma ani jednego pliku z `server/`
i ani jednej migracji (Z10, `DEC-65`); czy powstała **dokładnie jedna**
nowa flaga i jest **OFF wszędzie**, także w profilu odbiorowym; czy diff
w `InterviewHub.tsx` mieści się w kilkunastu liniach; czy pliki prototypu
są **nietknięte**; czy `check-list-canon.baseline.txt` jest nietknięty;
i **czy każdy zrzut ma obok siebie tabelę parytetu z prototypem**.
Dyżur, który zapali cudze testy, zbuduje czwartą powłokę, ruszy DRD,
wykona jakąkolwiek operację chmurową albo zostawi choćby jedną atrapę,
zostaje odrzucony w całości — niezależnie od tego, jak dobre są pozostałe
pozycje.

Powodzenia. Prototyp otwarty obok kodu przez cały dyżur, raport na bieżąco,
inwentarz przed każdą pozycją, STOP bez wahania zamiast zgadywania,
prettier tylko na plikach commita, Blok 6 zawsze.

**Marker, którego nadzorca użyje przy wklejeniu tej instrukcji: dfd259af47.**

Koniec instrukcji.
