# Integracja 2026-09-02 — jeden kandydat z czterech rozjechanych linii

Gałąź: `integracja/20260902` · tip **`444d789363`** · baza `codex/m03-admin-20260824` (`f5ffe8fa22`)
Worktree pomiarowy: `/private/tmp/int-0902` · skarbiec: `consultify-recovery-vault-20260820.git`

Cel: **zielony sygnał budowy**, którego program nie miał od tygodnia (dyżur 163 zgłaszał OOM przy `tsc`).

---

## 1. Weryfikacja liczb wejściowych nadzorcy

Sprawdzone samodzielnie, przed pracą. **Wszystkie zgodne co do jednego:**

| Co | Podane | Zmierzone |
| --- | --- | --- |
| tip `codex/m03-admin-20260824` | `f5ffe8fa22` | `f5ffe8fa221b7f881fb8aaa12dd580061e818597` ✓ |
| tip batch241-269 | `ff6039c71b` | `ff6039c71bb48950ec39280d0415bf347ecca057` ✓ |
| tip `origin/develop` | `636cc8b237` | `636cc8b2379521123c133c2bf8804456b16a1ac3` ✓ |
| tip kreatora formularzy | `da67cf294c` | `da67cf294cb7624809f0c4f570999f1944b3f67c` ✓ |
| tip gałęzi bramek | `249211a0c1` | `249211a0c1c51b2f64a94d874a0c5000170d17d2` ✓ |
| merge-base m03 × batch | `5c2e6ceb34` | `5c2e6ceb34bd60941a6f4869b991c7b1f6002a50` ✓ |
| batch przed m03 / m03 przed batch | 571 / 52 | `52  571` (`--left-right`) ✓ |
| develop przed każdą naszą linią | 10 | 10 wobec m03 i wobec batch ✓ |

**Sprostowanie jedno:** gałąź `fix/integracja-bramki-20260831` ma wobec kandydata nie 10 commitów,
lecz 200+ (merge-base `f0290c5142`). Dziesięć to ostatnie commity CI tej gałęzi i tylko one były
przedmiotem zlecenia — reszta była już w kandydacie inną drogą. Rozstrzygnięte zgodnie z intencją.

---

## 2. Scalenia — SHA i konflikty

| # | Co | Źródło | Commit scalenia | Konflikty |
| --- | --- | --- | --- | --- |
| a | batch241-269 (nocna integracja Codexa) | `ff6039c71b` | **`4badaa454d`** | 1 add/add — patrz niżej |
| b | `origin/develop` (źródło stagingu) | `636cc8b237` | **`346dd2c656`** | brak |
| c | kreator formularzy + IDOR `/forms/:formId` | `da67cf294c` | **`076ab1d560`** | brak (diff pusty — patrz niżej) |
| d | cherry-picki z gałęzi bramek | 8 prób | 4 weszły | 4 odrzucone — patrz niżej |

### (a) Konflikt add/add — `scripts/dev/lib/check-screens-structure.py`

Obie strony dodały ten plik niezależnie. **Wersje są identyczne bajt w bajt**
(`diff -u` między `:2:` a `:3:` — pusty, kod wyjścia 0). Konflikt pozorny, wzięta wersja `--ours`.
Nic nie zgubiono.

Plik sąsiedni `scripts/dev/check-devrender-main.sh` scalił się automatycznie. Sprawdzone, że wynik
jest **nadzbiorem obu stron** (posortowany `diff` wobec `:2:` i wobec `:3:` — zero linii tylko po
jednej stronie). Suma bezpieczników zachowana: kontrola strukturalna bez zależności (strona m03)
+ kontrole 4/5/6 z podłogą liczebności (strona batch).

### (a) Higiena białych znaków

`git diff --check` na całym scaleniu: **482 ostrzeżenia, wszystkie w `docs/`** (raporty źródłowe
dyżurów, celowo nieznormalizowane — zgodnie z manifestem batcha).
**Poza `docs/`: 0.** To samo dla scaleń (b), (c), (d).

### (c) Kreator formularzy — merge o pustym diffie

Dwa commity (`55b8e4c738`, `da67cf294c`) **nie były** przodkami kandydata, ale scalenie dało
**zero zmienionych plików**. Sprawdzone po kolei: wszystkie **5 z 5 plików** tych commitów jest
w kandydacie **identycznych** z wersją gałęzi (`git diff --quiet HEAD da67cf294c -- <plik>`).
Batch wprowadził tę samą treść pod innymi SHA. Scalenie zostawione świadomie — zapisuje
przodkowanie, więc kandydat jest nadzbiorem także w sensie grafu.

### (d) Cherry-picki z `fix/integracja-bramki-20260831`

Zgodnie ze zleceniem **`23eed6d924`** (masowy autofix, 2093 pliki) i **`a2b58b4d61`**
(przeliczone baseline'y) **nie były brane**.

| SHA źródłowy | Wynik | Nowy SHA |
| --- | --- | --- |
| `8d75731e1d` fix(types): dwa błędy typów ze scalenia | **OK** | `cebb4b173a` |
| `bef0829d36` fix(lint): 13 błędów, których --fix nie rusza | **POMINIĘTY** — konflikt w `server/src/services/v8/transformationMobilizationOwnerAdapterService.ts` | — |
| `5f6d2829bc` fix(ci): budżet czasu Lint & Type Check | **OK** | `c7b5e3bcbc` |
| `98dbd01437` fix(ci): serwer sądzony regułami frontu | **OK** | `0154c47555` |
| `eb41f85f5e` fix(types): kontrakt MutationResult | **POMINIĘTY** — konflikt w `AttachmentsSection.tsx` | — |
| `624573706f` fix(types): 28 → 0 błędów frontu | **POMINIĘTY** — konflikt w `IdeaMapWorkspace.tsx` | — |
| `0c4a875af5` fix(a11y): pierścienie fokusa | **POMINIĘTY** — konflikty w `PortfolioListView.tsx`, `PublicInterviewRespondentView.tsx` | — |
| `249211a0c1` fix(tests): wielkość liter + strażnik finansów | **OK** | `2a20bcdaad` |

**Dlaczego akurat te cztery.** Wszystkie cztery odrzucone powstały **po** masowym autofiksie
i niosą jego przeformatowanie w kontekście. Bez `23eed6d924` nie mają się o co zaczepić.
To nie jest przypadek — to bezpośredni koszt decyzji o nieprzyjmowaniu reformatu,
i wraca jako otwarty dług: **26 błędów typów frontu** (sekcja 3).

---

## 3. Bramka budowy — dokładne wyniki

### 3.1 Klient — **ZIELONY**

```
NODE_OPTIONS=--max-old-space-size=8192 npm run build     EXIT=0
✓ built in 53.32s
```

### 3.2 Serwer — **ZIELONY po naprawie** (`444d789363`)

Zmierzone w trzech punktach, żeby odróżnić dług zastany od regresji:

| Punkt | `tsc -p server/tsconfig.build.json --noEmit` |
| --- | --- |
| tip m03 `f5ffe8fa22` | **0 błędów** |
| tip batch `ff6039c71b` | **5 błędów** |
| kandydat po scaleniu | **5 błędów** (te same) |
| **kandydat po naprawie** | **0 błędów**, `npm run build` EXIT=0, `dist/src/index.js` powstaje (48 MB) |

**To nie był zastany dług — linia integracyjna budowała się do wczoraj.** Pięć błędów wniosła
gałąź batch i od nich `npm run build` w `server/` kończył się kodem 1, czyli **serwer nie powstawał
wcale**. Rozbicie:

1. **4 z 5 — `server/src/routes/notifications.routes.ts`.** Commit `2584f858e6`
   (naprawa IDOR eskalacji) dodał wymagany parametr `organizationId` do
   `EscalationService.getEscalations/runAutoEscalation` i poprawił **jeden z dwóch** wołaczy.
   Zamontowany w `Gateway.ts:204` jest ten poprawiony — **żywa trasa ma zabezpieczenie IDOR**
   (sprawdzone grepem importów, nie założeniem). Płaski plik ma dziś tylko dwóch wołaczy
   testowych, ale wchodzi do kompilacji i przez niego nie budował się cały serwer.
   Naprawiony tym samym kształtem co brat — **rodzina, nie pojedynczy przypadek**.
2. **1 z 5 — `server/src/routes/ai/ai-settings.routes.ts`.** Rozłożenie wyniku `mapKeys()`
   w literale obiektu gubi jego sygnaturę indeksową. Dodany jawny typ zwracany.
3. **`tesseract.js` — TO NIE BYŁ BŁĄD KODU.** Piąty błąd (`deckImageSafetyGates.ts`, brak
   `recognize`) to artefakt środowiska: paczka jest w `server/package.json` (`^7.0.0`), ale **nie ma
   jej w `node_modules`**, z którego korzysta ten worktree (symlink do checkoutu właściciela).
   Po zainstalowaniu paczki błąd znika **bez zmiany w kodzie**, dlatego kod nie został ruszony.
   **Do odnotowania:** każdy lokalny build serwera bez `npm install` w `server/` będzie na tym padał.

### 3.3 Typy frontu — OOM potwierdzony i zmierzony

**Zgłoszenie dyżuru 163 potwierdzone co do joty:**

```
NODE_OPTIONS=--max-old-space-size=8192  tsc --noEmit
FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of memory
  (sterta 8163 MB / 8206 MB po 222 s, kod wyjścia 134)
```

Maszyna ma **128 GB RAM** — limit 8 GB był ustawiony arbitralnie, nie wynikał z zasobów.
Po podniesieniu limitu przebieg kończy się normalnie:

| limit sterty | wynik | czas | szczyt RSS |
| --- | --- | --- | --- |
| 8 GB | **OOM** (kod 134) | 222 s | — |
| 16 GB | kończy | 162 s | 9,94 GB |
| 16 GB (po naprawie `tsconfig`) | kończy | **104 s** | **6,83 GB** |

Czyli `tsc --build` per projekt **nie był potrzebny** — wystarczyło zdjąć zbyt niski limit
i usunąć przyczynę rozdęcia. Realne zapotrzebowanie po naprawie mieści się w 8 GB z zapasem.

**Przyczyna rozdęcia i naprawa** (`35c7688068`):

| | błędy razem | w tym z `server/` | w tym TS7030 |
| --- | --- | --- | --- |
| przed | **882** | 856 | 848 |
| po | **26** | **0** | 0 |

Cherry-pick `0154c47555` wypisał **sześć** testów mieszkających w `src/`, a importujących
`server/src` — bo `exclude` nie powstrzymuje TypeScriptu przed śledzeniem importów.
Gałąź batch wniosła **dwa kolejne** testy tej samej rodziny i cały artefakt wrócił.
Wykluczenie zostało domknięte jako **rodzina** (pomiar: grep za importem `server/src` w `src/`),
nie jako dwa zgłoszenia — bo naprawa per-plik już raz odrosła w ciągu jednej doby.

**26 błędów frontu = dług ZASTANY, zero wniesionych przez scalenie.** Dowód: ten sam `tsconfig`
puszczony na samym `ff6039c71b` daje **28** błędów; różnica to dokładnie dwa błędy
(`ChatSmartSuggestions.tsx`, `UnifiedChatPanel.tsx`), które usuwa cherry-pick `8d75731e1d`.
`26 = 28 − 2`. Porównanie sygnatur `plik(linia,kol) TSxxxx` obu list: **zbiór „tylko w kandydacie" jest pusty.**

Te 26 to w większości ten sam kontrakt `MutationResult`, który naprawiały odrzucone cherry-picki
`eb41f85f5e` i `624573706f`. **Nie naprawiane** — to zastany dług i osobna praca.

### 3.4 Bramka kanonu list i hooki — **ZIELONE**

```
bash scripts/check-list-canon.sh                                        EXIT=0
✓ brak NOWYCH naruszeń kanonu tabel (pełny skan repo: 171 plików;
  naruszeń 394, baseline 394 — dług nie rośnie)
• Huby list z legacy menu (R2b): 1 z 11 *Hub.tsx
```

Uwaga do wiarygodności pomiaru: skrypt sam zameldował, że **staging był pusty**, i z własnej woli
przeszedł na pełny skan repo, „żeby nie zameldować fałszywej zieleni". Wynik pochodzi z pełnego skanu.

Hooki `pre-commit` (`core.hooksPath=.husky`) chodziły przy **każdym** commicie tej gałęzi:
`check-artefakt` (crimson w powłoce: 7, baseline 7), karty N (R2+R3: 0/0), `check-gestosc` — bez regresji.
`pre-push` jest w tym repo **wyłączony w kodzie** (`exit 0`) — nie jest bramką i nie należy go za taką uważać.

### 3.5 Testy z manifestu batcha — **22/22, `--retry=0`**

| Grupa | Plik(i) | Wynik |
| --- | --- | --- |
| Interview false-save | `src/components/Interview/__tests__/ConversationalPanel.applyDraftMappings.contract.test.tsx` | 2/2 |
| day255 (agent prezentacji) | 3 pliki `server/src/services/__tests__/day255-*` | 5/5 |
| day256 (PPTX / ślad źródła) | `day256-bundleDeckQa.sourceTraceabilityGate`, `day256-RulesEngine.sourceTraceabilityRule` | 4/4 |
| day257 (ugruntowanie wniosku) | `server/src/services/deliverables/__tests__/day257-deckConclusionSlide.textSourceGrounding.test.ts` | 2/2 |
| click-then-shoot (node:test) | `scripts/dev/__tests__/click-then-shoot.test.mjs` | 5/5 |
| day267 (Materiały) | `scripts/dev/__tests__/day267-materialy-zrzuty-werdykt.test.mjs` | 4/4 |
| **razem** | **9 plików** | **22 testy, 0 porażek** |

Warunki i pułapki, w które można było wpaść:

- Vitest uruchamiany **jawnie z `--retry=0`**; suita `node:test` nie ma mechanizmu ponowień.
- **`DB_TYPE=postgres`** podane jawnie. `vitest.config.ts:210` czyta `process.env.DB_TYPE || 'sqlite'`,
  więc zmienna działa — ale bez niej day256 kłamie na sqlite (manifest odnotował 2 porażki).
- **`day267` uruchomiony wprost przez `vitest run <plik>` melduje `No test files found` i kod 1**,
  bo `scripts/dev/__tests__` nie jest w `include` głównej konfiguracji. **To nie jest PASS.**
  Uruchomiony konfiguracją pomiarową (poza repo, `/private/tmp/int-0902-scratch/vitest.day267.config.ts`),
  która rozszerza `include` o ten katalog — dopiero wtedy 4/4. Manifest nazywał to „programmatic".
- Artefakt powtórki z manifestu istnieje i **zgadza się SHA-256**:
  `ecdf93340653f5afdf09b4971c304edee1f7efe8f5cf3238b760d547e98a57b8`.

**Dodatkowy test spoza manifestu** — bo zmieniłem plik, który ktoś importuje:
`tests/unit/backend/routes/h64-failsoft-batch5.test.ts` (jeden z dwóch wołaczy poprawionego
`notifications.routes.ts`) → **17/17 PASS**.

---

## 4. Czego NIE zmierzono (uczciwy brak, nie zieleń)

- **RealPG dyżurów 242 i 250** — pozostaje `NOT_PROVEN`, tak jak w manifeście batcha. Porty
  5432/5433/6012 są zajęte przez inny projekt; własnego kontenera nie stawiano, bo bramka budowy
  nie tego wymagała.
- **`tests/acceptance/interview-assignment-delivery-readback.e2e.test.ts`** — drugi wołacz
  poprawionego pliku tras; wymaga środowiska e2e, nie uruchamiany.
- **`npm run lint`** — nie uruchamiany. Gałąź bramek doprowadziła lint do zieleni **masowym
  autofiksem**, którego świadomie nie przyjęliśmy, więc lint tego kandydata jest z góry czerwony.
  Decyzja o reformacie należy do koordynatora.
- **26 błędów typów frontu** — zmierzone, wypisane, **nienaprawiane**.
- Zachowanie w przeglądarce, wygląd, jakikolwiek odbiór wizualny — poza zakresem tej pracy.

---

## 5. Pozycja kandydata wobec pozostałych linii

`git rev-list --left-right --count HEAD...<linia>` — pierwsza liczba: kandydat przed, druga: linia przed kandydatem.

| Linia | kandydat przed | **przed kandydatem** |
| --- | --- | --- |
| `origin/develop` `636cc8b237` | 768 | **0** |
| `codex/m03-admin-20260824` `f5ffe8fa22` | 592 | **0** |
| batch241-269 `ff6039c71b` | 73 | **0** |
| kreator formularzy `da67cf294c` | 666 | **0** |

**Kandydat jest ścisłym nadzbiorem wszystkich czterech linii.** Warunek „develop przed kandydatem = 0"
spełniony.

---

## 6. Stan bramki — jednym zdaniem

**Klient buduje się, serwer buduje się, kanon list zielony, 22/22 testów z manifestu bez ponowień —
po raz pierwszy od tygodnia. Otwarty pozostaje lint (świadomie) i 26 zastanych błędów typów frontu.**
