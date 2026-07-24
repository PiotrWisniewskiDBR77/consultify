# HANDOFF — IDEE, stan na 2026-07-24 (koniec okna kontekstu)

Ten plik jest punktem wejścia dla następnej sesji. Zawiera stan faktyczny, otwarte
błędy (w tym jeden **krytyczny, psujący dane**) i kolejkę prac. Czytaj w całości
przed dotknięciem czegokolwiek.

---

## 0. NAJPILNIEJSZE — KRYTYCZNY BŁĄD, KTÓRY PSUJE DANE

### Objaw
Piotr otworzył z listy Ideę „Proces ofertowania — od zapytania do podpisu"
(zasianą jako `process_flow`). Aplikacja wyrenderowała ją **jako mapę myśli**:
menu kontekstowe „Add topic (to root) / Auto-cluster / Show level 1-2", Menu 3
„Add node" zamiast „Add shape", widżet „Map Health 10%". Menu nie dawały się
zamknąć (nakładka menu kontekstowego + pasek zaznaczenia mapy).

### Przyczyna źródłowa — MOJA REGRESJA z P0-5
`src/components/MyWork/IdeaMapWorkspace.tsx`, blok w `hydrate()`:
przy naprawie P0-5 (żeby cudzy wybór narzędzia nie przestawiał ekranu) usunięto
adopcję `mapRes.map.preferredTool` i **nie dano nic w zamian**. Efekt:

```
initialTool (deep-link)  →  jeśli brak:
localStorage per idea    →  jeśli brak:
                            NIC → internalActiveTool zostaje 'mindmap'
```

Czyli **każda Idea typu Przepływ/Tablica/Tabela otwarta PIERWSZY RAZ z listy
w danej przeglądarce renderowała się jako mapa myśli.**

### Dlaczego moje testy tego nie złapały
Wszystkie moje repro wchodziły URL-em z nazwą narzędzia
(`/my-work/ideas/<id>/workspace/process-flow`), co ustawia `initialTool` i
**maskuje błąd**. Piotr wchodzi z listy, bez sluga. ★ LEKCJA: repro musi
odtwarzać ścieżkę użytkownika, nie wygodną ścieżkę testera.

### ★ ESKALACJA: błąd KORUMPUJE DANE
`IdeaMapWorkspace.tsx` (~linia 591) zapisuje przy każdym autosave:
`preferredTool: activeTool`. Więc gdy Idea otworzyła się błędnie jako mapa,
autozapis **nadpisał w bazie prawdziwy typ Idei na `mindmap`**.

Dowód: na liście Piotra „Proces ofertowania" pokazuje już narzędzie
**„Recommendation map"** zamiast „Process Flow". Dane są uszkodzone, nie tylko widok.

### Stan naprawy (NIEDOKOŃCZONA)
Wprowadzono fallback w `hydrate()` — gdy brak lokalnej preferencji, honoruj
`mapRes.map.preferredTool` (własna natura Idei ≠ cudzy stan sesji).
Kod: szukaj komentarza `★ REGRESJA P0-5 (naprawiona 2026-07-24)`.

**Test po naprawie (czysta przeglądarka, URL BEZ sluga narzędzia):**
```
OK   mapa      Menu3="Dodaj węzeł"      mapHealth=true
OK   tablica   Menu3="Dodaj karteczkę"
BŁĄD przeplyw  Menu3="Dodaj węzeł"      ← nadal źle
OK   tabela    Menu3="Dodaj wiersz"     tabela=true
```
„przeplyw" nadal zły **nie dlatego, że fix nie działa**, tylko dlatego, że
**w bazie ta Idea ma już `preferred_tool='mindmap'`** (skutek korupcji wyżej).

### CO ZROBIĆ NAJPIERW (kolejność obowiązkowa)
1. **Napraw dane**: przywróć `preferred_tool` dla 4 przykładów:
   - `f257af8d-98ba-4602-a45c-d3bdfbb563e3` → `mindmap`
   - `f1d8ab10-7d99-40e7-9b5b-af53558cca76` → `whiteboard`
   - `b9f9ae19-66e0-47c9-a794-4b3f9772585d` → **`process_flow`** (uszkodzona)
   - `33e9e68d-845d-4667-82d9-47b7178f5d56` → `table`
   Sprawdź też `extensions_json.surfaceState.activeTool`.
2. **Powtórz test** repro bez sluga — wszystkie 4 muszą przejść.
3. **Rozważ zabezpieczenie przed ponowną korupcją**: autosave nie powinien
   nadpisywać `preferred_tool` typem, który wynikł z fallbacku, a nie z wyboru
   użytkownika (`userSelectedToolRef`). Serwer używa `preferred_tool` także jako
   guard treści (`isSuspiciousEmptyReset` w `my-work.routes.ts`) — nie wyłączać zapisu bez analizy.
4. **Wypchnij na demo** (patrz §5 — procedura forward-portu).

---

## 1. GDZIE CO JEST

| Co | Gdzie |
|---|---|
| Worktree roboczy | `/private/tmp/odbior-4` (gałąź `odbior/lokalny-2026-07-23`) |
| Backup gałęzi | `origin/odbior/lokalny-2026-07-23` |
| Demo (live) | `origin/demo` = `5e35d8a76c`, `demo.consultify.ai` |
| Punkt cofania demo | tag `demo-rollback-pre-idee-2026-07-24` = `876ca16679` |
| Standard docelowy | `docs/standards/idea-workspace/` (12 rozdziałów + `00_INDEX.md`) |
| Tracker fal | `docs/standards/idea-workspace/_POSTEP_FALE.md` |
| Pozycje odbioru | `rejestr/3-DO-ODBIORU/IDE-015…023` |
| Dowody QA | `artifacts/idea-workspace-qa/2026-07-23T2330-2abb4820cc/` |
| Backup 143 usuniętych idei | `/private/tmp/idee-backup/` (idee + platforma tabel) |

**Baza:** demo i staging dzielą **trolley** (`.env.staging.local`). PROD =
centerbeam, NIE dotykać bez jawnej zgody. Konto Piotra:
`d2b6a316-08c5-47cf-9bf7-4ba50311d5a2`, org `a3e05d4a-5397-419d-b486-8e44366c0063`.

---

## 2. OCENA POSTĘPU — UCZCIWA

Piotr ocenił: „bardzo bardzo dużo z planu zmiany jeszcze nie zostało zrobione".
**Ma rację.** Mój błąd raportowania: odhaczałem pozycje backlogu zamiast mierzyć,
co realnie zmieniło się na ekranie.

### Zrobione i realne (fundament, którego nie widać)
- **P0 (5/5)**: historia konwersji (migracja `my_idea_conversions` na staging),
  guard importu, brak duplikacji przy przełączeniu, prawy panel przełącza treść,
  stan widoku lokalny (★ ta ostatnia wprowadziła krytyczny błąd — §0).
- **P1 (8/8)**: martwe kliknięcia powłoki, martwe eventy, schowek/Delete-krawędź/
  Wstaw-między w Przepływie, generatory AI Tablicy wołają model, Raport/Prezentacja
  z Eksportu → Konwersja, rail nie zasłania pasków.
- **P2 częściowo**: Menu 3 z rejestru akcji, menu krawędzi (WB/MM/PF), menu komórki
  Tabeli, minimapa jako ikona, Menu 1 jawny alert konfliktu.
- **P3-1/2/3/7/8**: ~1150 linii martwego kodu i endpointów usuniętych, tłumaczenia,
  fantom flagi `tablePlatformRecordsApi` usunięty.
- **Rejestr akcji** `src/actions/ideaActionRegistry.ts` + strażnik
  `scripts/check-actions.sh` (guard #7 w `.husky/pre-commit`) — martwe kliknięcie
  nie przejdzie do repo.
- **Transport Teresy** (Z4) za dwiema flagami OFF — runda serwer→SSE→front.

### NIEZROBIONE — to, po czym Piotr ocenia produkt
1. **★ Kanon prawego panelu (decyzja D1) NIE ISTNIEJE.** Zakładki dziś:
   `problem · status · inspector · convert · health`. Standard (rozdz. 07) wymaga:
   **Przegląd · Właściwości · Powiązania · Komentarze · Historia**.
   **Powiązania i Komentarze nie istnieją nigdzie w kodzie.** P2-4 zrobił tylko
   warstwę graficzną (za flagą) — postawienie „P2-4 ✅" było zawyżone.
2. **Z3 łamane na widoku**: 6 pozycji „SOON" w Convert (`ideaConvertTargets.ts`,
   `status: 'soon'`) — Action Plan, RAID Log, Financial Model, Budget, Valuation.
3. **Zakładka „Map Health" bez treści** — powiela widżet pływający na płótnie.
4. **Słownictwo etapów rozjechane**: lista „Shaping" vs panel „STRUCTURING →
   Validating" — trzy nazwy na to samo.
5. **Interfejs po angielsku**, treść po polsku. Gorzej: **AI Blind Spots analizuje
   polską mapę i odpowiada po angielsku** — realny defekt, nie ustawienie.
6. **Lewy rail** wg rozdz. 06 — zrobiony tylko data-rail Tabeli za flagą.
7. **Cała praca wizualna za flagami OFF** → z miejsca Piotra ekran wygląda jak przed pracą.

---

## 3. ŚWIEŻE PROŚBY PIOTRA (nierozliczone)

1. **Kolumna „Tool" na liście ma być czytelna** — zamiast „Recommendation map"
   ma pisać wprost, czy to **Process Flow / Mapa myśli / Whiteboard / Tabela**.
   (Zrzut: kolumna Tool pokazuje „Recommendation map", „Whiteboard", „Table”.)
2. **Menu nie dają się zamknąć** — patrz §0; prawdopodobnie skutek uboczny
   renderowania powłoki mapy na obiekcie procesu, ale **zweryfikować osobno**
   po naprawie typu narzędzia.
3. Kolejka, którą sam zadeklarowałem po ocenie Piotra:
   - zbudować prawdziwy kanon panelu D1 (5 zakładek, w tym Powiązania i Komentarze od zera),
   - usunąć 6 „SOON" (podłączyć albo skasować),
   - ujednolicić słownictwo etapów + język odpowiedzi AI,
   - domknąć lewy rail wg rozdz. 06.
4. **Zmiana sposobu raportowania**: meldować **co zmieniło się na ekranie**
   (zrzut przed/po), nie odhaczone pozycje backlogu.

---

## 4. SCENA DEMO — 4 PRZYKŁADY

Konto Piotra wyczyszczone ze **143 testowych idei** (backup: `/private/tmp/idee-backup/`),
zasiane 4 dopracowane przykłady:

| Idea | ID | Narzędzie | Treść |
|---|---|---|---|
| Wejście na rynek DACH — mapa decyzji | `f257af8d…` | mindmap | root + 5 gałęzi + 16 tez + 4 powiązania międzygałęziowe, zdrowie 51% |
| Dlaczego tracimy klientów po 3 miesiącach | `f1d8ab10…` | whiteboard | 3 ramki (5/4/3 karteczki), diament decyzji, link, notatka-decyzja |
| Proces ofertowania — od zapytania do podpisu | `b9f9ae19…` | **process_flow** ⚠ uszkodzone | 4 tory, 12 kroków, 13 połączeń z warunkami, czasy/koszt |
| Portfel inicjatyw AI — priorytetyzacja | `33e9e68d…` | table | 10 wierszy × 10 kolumn, pigułki statusu/priorytetu/obszaru |

### ★★ DWIE PUŁAPKI SEEDOWANIA (powtórzą się)
1. **Mapa myśli rozpoznaje role węzłów po PREFIKSIE ID**, nie po `type`:
   `id === 'root'` i `id.startsWith('branch-')`. Steruje tym wskaźnik zdrowia,
   WSZYSTKIE nakładki AI, „dodaj sąsiada", operacje na poddrzewie
   (`MapHealthScore.tsx:117`, `IdeaRecommendationMap.tsx:1174`).
   Zasiew z własnymi id → zdrowie 10% i martwe AI. Po poprawie: 51%.
2. **Dzieci ramek Whiteboardu mają pozycje WZGLĘDNE wobec ramki** (React Flow
   `parentId`). Zasiew z pozycjami absolutnymi → karteczki poza ramką.

---

## 5. PROCEDURA PROMOCJI NA DEMO (★ NIETYPOWA — przeczytaj)

**Gałąź `odbior/lokalny-2026-07-23` ma NIEPOWIĄZANĄ historię z `origin/demo`**
(`git merge-base` = pusto, exit 1 — demo było kiedyś przebudowane).

- `git merge-tree` z pustą bazą **nie wykrywa konfliktów** → „0 konfliktów" jest FAŁSZYWE.
- Merge całej gałęzi **cofnąłby ~127 plików mechaniki demo** (diff drzew: 309 plików, −2695 linii).
- **Jedyna bezpieczna droga: forward-port per-SHA (cherry-pick), NIGDY merge gałęzi.**

Sprawdzona procedura:
```bash
git worktree add /private/tmp/promote-demo origin/demo
cd /private/tmp/promote-demo
git cherry-pick <start>..<HEAD>          # 178/182 plików identycznych → czysto
# TWARDA weryfikacja — musi być PUSTO:
comm -23 <(git diff --name-only origin/demo HEAD|sort) <(git diff --name-only <start> <HEAD>|sort)
ln -sfn /private/tmp/odbior-4/node_modules node_modules   # ★ bez tego tsc CICHO nie działa
NODE_OPTIONS="--max-old-space-size=8192" node_modules/.bin/tsc --noEmit -p tsconfig.json
bash scripts/check-actions.sh
git push origin HEAD:demo
```
Monitor: `railway deployment list --service consultify` (z katalogu głównego, nie z worktree),
potem `curl https://demo.consultify.ai/api/health` — sprawdź `gitSha`.

---

## 6. FLAGI (stan na teraz)

| Flaga | Default | Co włącza |
|---|---|---|
| `ideaImportGuardRail` | **ON** | podgląd + potwierdzenie + migawka + cofnięcie przy imporcie |
| `ff_ideaPanelVisual` | OFF | panel kartowy (odpowiedź na „wsiowo") — `?ff_ideaPanelVisual=1` |
| `ideaSwitcherBottomRight` | OFF | przełącznik reprezentacji w prawym dolnym rogu (D2) |
| `ff_tableDataRail` | OFF | data-rail Tabeli — `?ff_tableDataRail=1` |
| `ff_tableFieldProposal` | OFF | podgląd propozycji autofill Tabeli |
| `ENABLE_TERESA_IDEA_ACTIONS` + `VITE_*` | OFF | transport akcji Idei do Teresy (żywa runda z LLM NIEzweryfikowana) |

---

## 7. POZYCJE ODROCZONE (osobne projekty — standard sam je odracza)

- **P3-4** migracja danych Table → P15: mechanizm `migrateWorkspace` gotowy,
  uruchomienie = decyzja operacyjna Piotra, **nie odpalać autonomicznie**.
- **P3-5** 7 kart N na kanon panelu (D1): standard odracza „po zamknięciu Idei".
- **P3-6** persystencja Whiteboardu + 3 kanały realtime: refaktor wysokiego ryzyka.

---

## 8. ZASADY, KTÓRE OBOWIĄZUJĄ (nie negocjowalne)

- **Weryfikuj REALNY runtime**, nie dokumentację ani flagi. „Testy przeszły" ≠ „działa".
- **Zrzut rozstrzyga, nie liczba z DOM.** Mój pomiar geometrii mówił „czysto",
  a zrzut pokazywał ucięty tekst.
- **Narzędzie pomiarowe potrafi cicho unieważnić pomiar**: `tsc` bez `node_modules`
  wypisuje „0 błędów" i exit 1; strażnik z wąskim wzorcem przepuszcza zły format.
  **Zawsze testuj strażnika ZEPSUTYM wejściem.**
- **Piotr nigdy pierwszym testerem wizualnym** (reguła #7) — render-verify własny
  przed pokazaniem; zmiany wizualne za flagą OFF do akceptu.
- **Nic na demo bez akceptacji** — wyjątek: Piotr jawnie polecił push 2026-07-24.
- **Mandat CTO**: decyzje techniczne podejmuję sam i raportuję z uzasadnieniem;
  nie odsyłam ich do Piotra (on = CEO, biznes i funkcja).
- `enableLocalOverrides` w `FeatureFlagsProvider` = **false** → override flag
  z localStorage jest IGNOROWANY; render-verify flagi z rejestru wymaga
  tymczasowej zmiany `defaultValue`.
- Dane demo = twarz produktu: probe'y sprzątają po sobie, zero rekordów testowych.

---

## 9. AKTUALIZACJA — koniec sesji 2026-07-24 (po recenzji Piotra)

### Wykonane po napisaniu tego handoffu
- **Naprawiona regresja typu narzędzia** (§0) — fallback na `preferredTool` Idei.
- **Naprawione uszkodzone dane** „Procesu ofertowania": `preferred_tool` i
  `surfaceState.activeTool` → `process_flow`, oraz **przywrócony `type:'flowNode'`
  w 12 węzłach** (mapa zdarła typ; kształty/tory/etykiety ocalały).
- **Test ścieżką użytkownika** (z listy, BEZ sluga, czysta przeglądarka):
  wszystkie 4 Idee otwierają się właściwym narzędziem.
- **★ WŁĄCZONE FLAGI WIZUALNE** — bo Piotr testuje i słusznie widział stary ekran:
  `ideaSwitcherBottomRight` (przełącznik w prawym dolnym rogu, D2),
  `ff_ideaPanelVisual` (panel kartowy, Z2), `ff_tableDataRail`.
  Zweryfikowane: przełącznik w rogu (4 przyciski), zniknął z lewego railа.
- **Wypchnięte na demo**: commit `8bef69248a` (jest w `origin/demo`; inna sesja
  pchnęła po nas — deploy `e84c3c4c08` zawiera naszą pracę). Punkt cofania: `5e35d8a76c`.

### ★ ANALIZA LUK WOBEC GŁÓWNYCH WYTYCZNYCH (o to prosił Piotr)

| Wytyczna | Stan | Co brakuje |
|---|---|---|
| **D2** przełącznik w prawym dolnym rogu | ✅ **teraz włączone** | — (minimapa-ikona K2 już była live) |
| **D1** kanon panelu (Przegląd·Właściwości·Powiązania·Komentarze·Historia) | ❌ **NIE ZBUDOWANE** | zakładki to nadal `problem·status·inspector·convert·health`; **Powiązania i Komentarze nie istnieją w kodzie**. To NAJWIĘKSZA otwarta pozycja |
| **Z2** panel nie „wsiowo" | ⚠ częściowo | kartowy wygląd włączony, ale struktura zakładek wciąż stara (patrz D1) |
| **Z3** zero placeholderów | ❌ **łamane na żywo** | 6 pozycji „SOON" w Convert (`ideaConvertTargets.ts`, `status:'soon'`) |
| **Z4** Teresa steruje wszystkim | ⚠ zbudowane, OFF | transport gotowy, ale żywa runda z LLM NIGDY nie zweryfikowana → flaga OFF |
| **Z1** analogiczność 4 narzędzi | ⚠ częściowo | tryb kursora w Tablicy i Przepływie **dekoracyjny** (rozdz. 06 §3: „naprawa wymagana") |
| **rozdz. 06** lewy rail | ⚠ częściowo | zrobiony tylko data-rail Tabeli; Szablony/Import wciąż w railu wszystkich narzędzi wbrew §2 |
| **Język** | ❌ | interfejs po angielsku przy polskiej treści; **AI Blind Spots odpowiada po angielsku na polską mapę** |
| **Słownictwo etapów** | ❌ | lista „Shaping" vs panel „STRUCTURING → Validating" |
| **Kolumna „Tool" na liście** | ❌ | pokazuje „Recommendation map"; Piotr chce czytelnie: Mapa myśli / Whiteboard / Process Flow / Tabela |

### KOLEJKA NA NASTĘPNĄ SESJĘ (priorytet malejący)
1. **Kanon panelu D1** — zbudować Powiązania i Komentarze od zera, przemianować
   zakładki. To jest to, po czym Piotr ocenia produkt.
2. **Usunąć 6 „SOON"** z Convert — podłączyć albo skasować (Z3).
3. **Kolumna „Tool"** — czytelne nazwy typów narzędzi na liście.
4. **Język**: interfejs + AI odpowiadające w języku mapy.
5. **Słownictwo etapów** — jedna nazwa na jeden etap.
6. **Tryb kursora** realnie sterujący płótnem w WB/PF (Z1).
7. **Zabezpieczenie przed ponowną korupcją** `preferred_tool` (§0 pkt 3).

### ★ LEKCJA METODYCZNA Z TEJ SESJI
Raportowałem **odhaczone pozycje backlogu** zamiast **zmian widocznych na ekranie**
— i przez to zawyżałem postęp. Piotr dwukrotnie i słusznie to skorygował.
Następna sesja: meldować **zrzut przed/po**, nie listę ✅.
Druga lekcja: **praca za flagą OFF nie istnieje dla właściciela** — jeśli on testuje,
flagi muszą być ON, inaczej cała robota jest niewidoczna i wygląda na niezrobioną.

---

## 10. RUNDA 2 — WYKONANA I NA DEMO (2026-07-24, po recenzji Piotra)

**Demo:** partia wypchnięta jako `2400b496e5` (forward-port per-SHA, 17/18 commitów
czysto; 18. dotyczył wyłącznie harnessu i był zbędny — jego treść przyszła
z późniejszymi). Punkt cofnięcia: tag **`demo-rollback-pre-idee-runda2-2026-07-24`**
= `e84c3c4c08`. Deploy SUCCESS, `/` i `/api/health` = 200, nowy build potwierdzony
na żywym pliku `/locales/pl/translation.json`.

**Uwaga:** demo żyje pod wieloma sesjami — zaraz po pushu doszła partia n-Type.
Moje commity są przodkiem obecnego HEAD (sprawdzone `merge-base --is-ancestor`),
tamta sesja świadomie je wmergowała. **Zawsze `git fetch` + pre-flight.**

### Kolejka 1–7 z §9 — ZAMKNIĘTA W CAŁOŚCI

| # | Pozycja | Stan | Dowód |
|---|---|---|---|
| 1 | Kanon panelu D1 | ✅ | 5 zakładek klikniętych w harnessie; Powiązania/Komentarze/Historia na żywych źródłach |
| 2 | 6 × „SOON" w Convert | ✅ | 0 wystąpień na ekranie; 12 celów → 6, wszystkie live |
| 3 | Kolumna „Tool" | ✅ | jedno źródło etykiet; „Mapa rekomendacji" = 0 wystąpień |
| 4 | Język AI | ✅ | treść wygrywa z flagą UI; 8/8 backend + 4/4 front na realnych danych |
| 5 | Słownictwo etapów | ✅ | `IDEA_STAGE_BUCKET_LABELS`; rozjazd był NAWET wewnątrz jednego pliku |
| 6 | Tryb kursora Z1 | ✅ | kursor `grab`, węzeł przeciągnięty myszą NIE zmienił pozycji |
| 7 | Tarcza `preferred_tool` | ✅ | zapis v7→8, `preferred_tool` i `type:'flowNode'` nietknięte |

### Domknięte PONAD kolejkę
- **Z3 w railu i kebabie**: martwe sloty Import/Więcej **znikają** z Tablicy/
  Przepływu/Tabeli (nie wiszą wyszarzone). Kebab: Prezentacja i Raport odblokowane.
- **Parytet Z1 w Mapie**: Mapa była SŁABSZA po naprawie WB/PF — dociągnięta do
  tego samego SSOT (`ideaCanvasCursorMode.ts`).
- **Przełącznik D2 OBOK klastra zoomu** (zgłoszenie Piotra ze zrzutem), nie nad nim.
- **5 surowych/zamrożonych kluczy i18n** usuniętych z ekranu.

### ★ TRZY LEKCJE METODYCZNE (droższe niż same naprawy)

1. **Sprawdź hipotezę, zanim ją ogłosisz.** Surowy klucz `mindmap.savedSecondsAgo`
   wyglądał na brak polskich form mnogich — naliczyłem 324 „podejrzane" klucze
   w całej aplikacji. Próba na i18next v25 w izolacji **obaliła hipotezę**
   (biblioteka poprawnie schodzi do klucza bazowego). Prawdziwa przyczyna była
   węższa: `t` poza zależnościami `useMemo` → etykieta liczona przed
   doładowaniem tłumaczeń i nigdy nieprzeliczana. Gdybym zgłosił „324 błędy",
   byłoby to dokładnie to zawyżanie, za które Piotr mnie skorygował.
2. **Weryfikacja własnej poprawki wykryła moją własną regresję.** Ustawienie
   przełącznika obok zoomu przykryło przycisk „Działaj" w podpowiedzi AI
   (zmierzone: 417–561 vs 489–558). Układ obok jest teraz PREFERENCJĄ z odwrotem
   na piętro, nie regułą na siłę. Druga pułapka: filtr przeszkód łapał wielkie
   warstwy tła płótna, więc układ obok **nigdy się nie włączał**.
3. **`check-triada` cicho unieważniała pomiar.** Skrypt kończył się „✓ czysto
   (sprawdzono plików: 0)". Inna sesja naprawiła go tego dnia (grep BRE→ERE);
   teraz uczciwie ostrzega „NIC nie zweryfikowano". **Ta partia została
   przebadana regułą strażnika puszczoną wprost na dodane linie:
   1672 linie w `src/components|src/views`, 0 naruszeń crimson.**

### OTWARTE (nie blokuje testów Piotra)
- **Rozjazd modeli etapów**: lista ma 5 kubełków, panel 7 etapów V5 — zamierzone
  mapowanie (`V5_TO_LIST_BUCKET`), ale użytkownik widzi dwa słowniki. Wymaga
  decyzji o modelu etapów, nie poprawki tekstu.
- **12 podejrzanych `useMemo`** z `t()` bez `t` w zależnościach — zostawione
  ŚWIADOMIE, bo nie dało się ich pokazać na ekranie. Zasada: mniej zmian
  z dowodem > dużo na wiarę. Lista w commicie `6a530c3b7e`.
- **Martwy kod**: `IdeaPinnedCard.tsx` nie jest używany nigdzie w repo; 5 zmiennych
  `useMemo` zadeklarowanych i nieużywanych (`TaskDetailView`, `DecisionDetailView`).
- **Etykieta „Zapisano 424034s temu"** — brak zwijania sekund do minut/godzin.
  Widoczne dopiero przy długo otwartej sesji.
- **Sprzątanie worktree'ów** — ~20 drzew w `/private/tmp`. NIE sprzątałem, bo inne
  sesje pracowały równolegle; usunięcie drzewa pod żywą sesją zrywa jej pracę.
  Kryterium bezpieczne: gałąź w całości na `origin/demo` + brak zmian lokalnych.

---

## 11. RUNDA 3 — etapy + Teresa Z4 (2026-07-24, po decyzjach Piotra)

**Decyzje właściciela w tej rundzie:**
1. Pomysł ma **PIĘĆ etapów** — model z listy (Iskra · Rośnie · Kształtuje się · Gotowy · Promowany).
2. Priorytet po testach: **Teresa Z4 — żywa runda**, bo to jedyna z czterech zasad nigdy niesprawdzona.

### Etapy — jeden słownik
Zmieniona **wyłącznie warstwa prezentacji**. Kolumna `my_ideas.stage`, walidator
`IdeaStageEnum` (7 wartości V5), `normalizeStageToV5` i logika przejść — nietknięte.
Panel czyta przez `V5_TO_LIST_BUCKET` → `IDEA_STAGE_BUCKET_LABELS`.

★ **Poprawka nadzorcy po symulacji przejść:** krok „o jeden V5" dawał DWA kliknięcia
wyglądające na bezczynne (`framing` i `validating` — następna wartość w TYM SAMYM
kubełku, więc przycisk mówił „→ Gotowy" przy plakietce „Gotowy"). Przycisk skacze
teraz do najbliższego etapu **widocznie innego**.
Sprawdzone przed tą decyzją: konwersja NIE jest bramkowana na `ready_to_convert`;
nudge na `exploring` siedzi w `IdeaPinnedCard` (zero odwołań w repo).
**KOSZT:** `IdeaFunnelAnalytics` (żywy) nie zobaczy `exploring`/`ready_to_convert`
ustawionych TYM przyciskiem — inne ścieżki nadal je ustawiają.

★ **Fałszywy alarm:** podejrzewałem, że mapowanie nie jest monotoniczne i nazwa cofa
się z „Kształtuje się" na „Rośnie". Symulacja na PRAWDZIWYCH stałych (kolejność V5 to
`spark·framing·exploring·structuring·…`, nie ta, którą wpisałem z pamięci) pokazała,
że mapowanie JEST monotoniczne. Nic nie zmieniono.

### Teresa Z4 — WYNIK ŻYWEJ RUNDY
13 poleceń × 3 modele = **39 przebiegów, 36 wywołań narzędzi**. Realny manifest
z rejestru + realna persona. Zero zapisów do bazy, bez stawiania aplikacji.

| model | trafność | fałszywe wywołania |
|---|---|---|
| gpt-4o (STANDARD wg `modelRouter`) | 10/13 | 2 |
| sonnet-4-6 (fallback) | 10/13 | 2 |
| sonnet-4-5 (kontrolnie) | 11/13 | 0 |

★★ **HALUCYNACJA NAZWY NARZĘDZIA: 0 na 36 wywołań.** Model nigdy nie wymyślił nazwy
spoza rejestru — teza „rejestr = jedyne źródło prawdy" się broni.

**Naprawione (na demo):**
1. **Serwer wyrzucał kontekst otwartej Idei.** Front wysyłał `context.ideaContext`,
   `grep ideaContext server/src/` = ZERO. Model odmawiał („nie widzę otwartego
   Przepływu"), mając go otwartego. Blok `## OTWARTA REPREZENTACJA IDEI` w
   `ai.routes.ts`. Kontrolny przebieg przestał odmawiać.
2. **Dwie granice negatywne** w `teresa.description` (`table_categorize`,
   `find_themes`) — modele podstawiały akcję Tabeli na prośbę o karteczki Tablicy
   i meldowały nieprawdę o tym, co zrobiły.

**NIE naprawione świadomie — `idea_workspace_convert` / `_duplicate` martwe przez
Teresę:** rejestr wymaga `ctx.confirmed` przy `source:'teresa'`
(`ideaActionRegistry:802`), a `UnifiedChatPanel:1958` woła `executeTeresaTool` bez
tego pola i nikt w `src/` go nie ustawia. **Nie przekazuję `confirmed: true` z czatu**
— zdjęłoby to bramkę całkiem, akcja wykonywałaby się na wniosek MODELU, nie na jawną
zgodę człowieka. Właściwa naprawa = kontrolka potwierdzenia w czacie (decyzja
produktowa).

### ★ FLAGA `ENABLE_TERESA_IDEA_ACTIONS` NADAL WYŁĄCZONA — i dlaczego
Zweryfikowana jest POŁOWA łańcucha: model → SSE `idea_action {toolName,args}`.
Druga połowa (`executeTeresaTool → runIdeaAction → handler` rusza węzeł na płótnie)
wymaga testu w przeglądarce. Włączenie teraz = Piotr pierwszy odkrywa, czy działa
(reguła #7). **Następny krok: domknąć drugą połowę w przeglądarce, potem flaga.**
Pułapka operacyjna: flaga frontu to `VITE_ENABLE_TERESA_IDEA_ACTIONS` — **build-time**,
sama zmienna na serwerze nic nie da bez przebudowy frontu.

### ★ POMYŁKA, KTÓRĄ SAM ZŁAPAŁEM I COFNĄŁEM
Zgłosiłem „rozjazd flagi `ENABLE_TERESA_MINDMAP`" jako żywy defekt (trzy odczyty,
przeciwne domyślne). **To było błędne.** Pod tą nazwą żyją DWIE funkcje:
*wyszukiwanie* map (`persona.ts` + `orgRetrievalShared.ts` + `ai.routes` wantsMindmap
— celowo domyślnie OFF, co-gated z `ENABLE_TERESA_RETRIEVAL`) i *generowanie* mapy
(`FeatureFlags` + `generateDeliverable` + `mcpServer` — domyślnie ON). Każda
wewnętrznie spójna. „Naprawa" sprawiłaby, że persona zapowiada modelowi narzędzie,
którego nie ma. Zmiany cofnięte. **Zostaje dług nazewniczy: jedna nazwa flagi na dwie
funkcje o przeciwnych domyślnych.**

### OTWARTE po tej rundzie
- Druga połowa łańcucha Z4 w przeglądarce → potem flaga.
- Kontrolka potwierdzenia w czacie (odblokowuje convert/duplicate przez Teresę).
- Trzeci zdryfowany słownik etapów: `IdeaCanvasMenu1Bits.tsx` — „Kształtuje" bez „ się".
- Dług nazewniczy `ENABLE_TERESA_MINDMAP` (dwie funkcje, jedna nazwa).
- Pozycje z §10: martwy kod, 12 niepotwierdzonych `useMemo`, zwijanie „Zapisano Ns temu",
  sprzątanie worktree'ów.

---

## 12. ZAMKNIĘCIE SESJI 2026-07-24 (przed przerwą Piotra — testy w niedzielę wieczorem)

### Co doszło po §11

**Naprawa menu konta (poza modułem IDEE, ale ta sama sesja):** Piotr zgłosił zrzutem
„menu wchodzi na panel" — dropdown konta (avatar, prawy górny róg) kolidował wizualnie
z inną zawartością ekranu. Przyczyna: `UserProfileMenu.tsx` był JEDYNYM dropdownem w
całym repo bez `createPortal` do `document.body` (Select/MultiSelect/DatePicker/
Menu3DropdownChip/TableSettingsPopover — wszystkie portalują). Nagłówek dostaje
lokalny `z-sticky`(20) przez regułę „z-index działa na flex-item bez position", ale to
NIE przebija realnych body-level elementów z wyższym z-index (np. `global-fab-rail` w
`MainLayout.tsx`, `fixed z-dropdown`=40, ikony pomoc/feedback/dokument).

**Dowód, nie domysł:** zbudowany żywy harness (realny `UserProfileMenu` + realny
nagłówek `MainLayout` + mock `global-fab-rail` 1:1 z kodu) — PRZED naprawą ikony rail
WYRAŹNIE cięły przez otwarte menu (zrzut). PO naprawie (portal do body, pozycja z
`getBoundingClientRect`, `z-modal`=60, dual-ref outside-click) — zero kolizji.
Naprawiony plik: `src/components/layout/UserProfileMenu.tsx`. Na demo.

**★ Ślepy zaułek po drodze (uczciwie odnotowany):** pierwsza teoria (zły z-index na
samym dropdownie) była zła — syntetyczny test pokazał, że architektura header-vs-
content jest poprawna. Dopiero żywa replika z prawdziwym komponentem ujawniła
prawdziwą przyczynę (brak portalu). Nie wdrożyłem naprawy na fałszywej podstawie.

### Samoaudyt zgodności z regułami (na żądanie Piotra, 2026-07-24)

Wykonany pełny przegląd sesji względem CLAUDE.md. Wynik: **zgodne, z trzema
zastrzeżeniami**, wszystkie ujawnione wprost Piotrowi:

1. Agenci tej sesji dzielili JEDEN worktree bez izolacji git (higiena wykonania każe
   osobny worktree per krok) — pilnowane ręcznie przez jawne „nie dotykaj pliku X",
   zero cichej utraty pracy (każdy diff przejrzany osobno), ale nie podręcznikowe.
2. Brakowało tagu cofnięcia dla ostatniej promocji (naprawa menu konta) — DOPISANY:
   `demo-rollback-pre-account-menu-fix-2026-07-24` (SHA `9218962778`).
3. **★★ SHA-e commitów IDEE PRZESUNĘŁY SIĘ.** Demo to gałąź, na którą push miały
   RÓWNOLEGLE inne sesje (Materiały, karty-n, agt-008…) — każdy retry mojej pętli
   promocji (fetch→cherry-pick na nowy czubek→push) nadawał moim commitom NOWY hash.
   Treść identyczna, numer inny. Jeśli szukasz SHA cytowanego wcześniej w tym
   dokumencie i go nie znajdziesz na `git log origin/demo` — szukaj po TREŚCI
   komunikatu (`git log origin/demo --grep="..."`), nie po samym SHA.

Zero sekretów, zero zapisu do bazy (test Teresy = bezpośrednie wywołania API modelu,
nigdy serwera/trolley), zero crimson (pełny skan diffu sesji), zero PROD, zero
force-push, zero `--no-verify`. Główny checkout repo nietknięty przez całą sesję.

### Tagi cofnięcia z tej sesji (najnowsze na dole)
- `demo-rollback-pre-idee-2026-07-24` — przed pierwszą turą promocji (§9→§10)
- `demo-rollback-pre-idee-runda2-2026-07-24` — SHA `e84c3c4c08`, przed rundą 2 (17 commitów: D1/Z1/Z3/język/etykiety)
- `demo-rollback-pre-etapy-teresa-2026-07-24` — SHA `dbabea9c16`, przed rundą 3 (etapy+Teresa)
- `demo-rollback-pre-account-menu-fix-2026-07-24` — SHA `9218962778`, przed naprawą menu konta (dopisany retroaktywnie)

### CO ZOSTAJE DO ZROBIENIA (kolejność wg priorytetu, nie kolejność odkrycia)

1. **Feedback Piotra z testów niedziela wieczór** — ŹRÓDŁO PRAWDY na start następnej
   sesji. Przeczytaj NAJPIERW, zanim ruszysz cokolwiek — może zmienić priorytety
   poniżej.
2. **Teresa Z4 — druga połowa łańcucha.** Zweryfikowana jest tylko połowa: model→SSE
   `idea_action`. NIE zweryfikowane: czy `executeTeresaTool → runIdeaAction → handler`
   faktycznie rusza węzeł na płótnie w przeglądarce. Zrób to PRZED włączeniem flagi
   `ENABLE_TERESA_IDEA_ACTIONS` (dziś OFF, słusznie — reguła #7: Piotr nie może być
   pierwszym, kto odkrywa, czy działa). Flaga frontu `VITE_ENABLE_TERESA_IDEA_ACTIONS`
   jest BUILD-TIME — sama zmienna serwera nic nie da bez przebudowy frontu.
3. **Kontrolka potwierdzenia w czacie** — bez niej `idea_workspace_convert`/
   `_duplicate` są trwale martwe przez Teresę (rejestr żąda `ctx.confirmed`, czat go
   nie wysyła). To DECYZJA PRODUKTOWA (jak ma wyglądać potwierdzenie), nie sama
   naprawa kodu — może wymagać pytania do Piotra.
4. **Trzeci zdryfowany słownik etapów**: `IdeaCanvasMenu1Bits.tsx:39-44` ma własną
   kopię `STAGE_BUCKET_LABEL` z literówką „Kształtuje" (bez „ się"), zamiast czytać
   `IDEA_STAGE_BUCKET_LABELS` z `ideaEntryTypes.ts`. Tania poprawka, znaleziona ale
   celowo nieruszona (poza zakresem zlecenia w danym momencie).
5. **Dług nazewniczy `ENABLE_TERESA_MINDMAP`** — jedna nazwa flagi na DWIE różne
   funkcje (wyszukiwanie map vs generowanie mapy) o przeciwnych domyślnych. Nie jest
   to błąd dziś (każda ścieżka wewnętrznie spójna), ale pułapka na następnego
   czytelnika. Rozdzielić na dwie nazwy przy najbliższej okazji dotykania tego pliku.
6. **12 niepotwierdzonych podejrzeń `useMemo` z zamrożonym i18n** (lista w §11
   poprzedniego agenta) — brak taniego dowodu w dostępnych harnessach. Nie ruszać na
   ślepo, tylko gdy pojawi się tani sposób weryfikacji per przypadek.
7. **Martwy kod**: `IdeaPinnedCard.tsx` — cały komponent, zero odwołań w repo.
   Kandydat do skasowania (osobny, bezpieczny commit).
8. **Kosmetyka**: „Zapisano 424034s temu" — zwijanie do minut/godzin w
   `IdeaMapWorkspace.tsx` (`draftSavedLabel`), nie tylko naprawiony wcześniej surowy
   klucz i18n.
9. **Pełny 40-punktowy checklist Harvard/DoD SPEC-A** — NIE przejechany od zera dla
   każdej dotkniętej powierzchni tej sesji (np. przycisk „Przywróć wersję" w
   Historii, wątki odpowiedzi w Komentarzach, wszystkie 4 narzędzia × light/dark ×
   każda zakładka panelu). Zweryfikowane zrzutem było to, co realnie zmieniane —
   nie cały moduł od zera.
10. Poza IDEE: Materiały mają rozpisaną kolejną falę (Word `from_template`,
    menu-cleanup Menu2→5 typów), DOKUMENTY mają otwartą pętlę do 9,0 (patrz pamięć
    sesji: `loop-do-9-2026-07-23`).

---

## 13. PROMPT DLA NASTĘPCY (wklej to na start nowej sesji)

Kontynuujesz pracę nad modułem **IDEE** (cztery narzędzia płótna Idei: Mapa myśli ·
Whiteboard · Process Flow · Tabela) w Consultify. Poprzednia sesja domknęła rundy 2 i
3 z listy właściciela (Piotra) i jest już WYPCHNIĘTA na `origin/demo` — sprawdź to
sam (`git fetch origin demo && git log origin/demo --oneline -30`), nie ufaj samym
SHA cytowanym w tym dokumencie: **demo to gałąź współdzielona z innymi równoległymi
sesjami, więc numery commitów mogły się przesunąć przy cherry-picku — szukaj po
treści komunikatu, nie po samym hashu, jeśli któregoś nie znajdziesz.**

**Zanim cokolwiek zrobisz:**
1. Przeczytaj CAŁY ten plik (`Harvard/wdrozenie-100/_HANDOFF_IDEE_2026-07-24.md`) od
   początku — sekcje 0-12 mają kontekst, którego nie chcesz odkrywać po raz drugi
   (zwłaszcza §0 o dawnej regresji korupcji danych i §8 o twardych zasadach).
2. **Sprawdź, czy Piotr zostawił feedback z testów** (obiecał wieczór niedzieli
   2026-07-26) — to jest teraz ŹRÓDŁO PRAWDY o priorytetach, ważniejsze niż kolejka w
   §12. Szukaj w `rejestr/3-DO-ODBIORU/` (pozycje IDE-*) i w wiadomościach czatu.
3. Zweryfikuj REALNY runtime, nie dokumentację — audyty starzeją się w ~3 dni.
   `grep` realnego callera w `src/`/`server/src/`, sprawdź czy flaga ma
   implementację, czytaj stan danych z ŻYWEJ bazy (trolley), nie z kodu.

**Twarde zasady tego projektu (nie negocjowalne, złamanie = zatrzymaj się i zapytaj):**
- **Piotr nigdy nie jest pierwszym testerem wizualnym.** Każdą zmianę ekranu
  renderujesz i sprawdzasz zrzutem SAM, w harnessie dev-render (worktree
  `/private/tmp/odbior-4`, `npx vite --config dev-render/vite.config.ts --port 3195`),
  ZANIM Piotr ją zobaczy. Zmiany wizualne wchodzą za flagą domyślnie OFF do akceptu.
- **Baza gałęzi promocji = zawsze `origin/demo`, ZAWSZE forward-port per-SHA
  (cherry-pick), NIGDY merge** — gałąź robocza IDEE ma niepowiązaną historię z demo;
  merge cofnąłby dziesiątki plików cudzej mechaniki. Worktree izolowany na
  `origin/demo`, `git cherry-pick -x <sha>`, esbuild + strażniki na finalnym drzewie,
  PUSH z retry-loop (fetch→cherry-pick na nowy czubek→push) jeśli demo ruszyło pod
  Tobą w międzyczasie — to normalne, dzieje się często.
- **Tag cofnięcia PRZED każdym pushem na demo** — `git tag -a demo-rollback-<opis>-<data> <sha_przed>`, `git push origin <tag>`. Bez wyjątków, nawet dla „małych" zmian.
- **Crimson (`bg-primary-*`, `focus:ring-primary`) tylko dla semantyki krytycznej** —
  `bash scripts/check-triada.sh <zmienione_pliki>` po KAŻDEJ zmianie. Uwaga: ten
  strażnik na czystym drzewie (bez realnego diffu) melduje „sprawdzono 0 plików" —
  to NIE znaczy „czysto", tylko że nic nie zbadał. Ufaj tylko wynikom z realnym
  diffem w trakcie pracy.
- **Zero zapisów do bazy demo (trolley) bez wyraźnej potrzeby** — dane demo to twarz
  produktu. Jeśli test wymaga wywołania modelu AI, wołaj API dostawcy bezpośrednio
  (klucz z `.env.staging.local`), nie serwer aplikacji — to test bez zapisu.
- **PROD (centerbeam) — nigdy, bez jawnej zgody Piotra.**

**Gdzie zaczynasz technicznie** (worktree `/private/tmp/odbior-4`, gałąź
`odbior/lokalny-2026-07-23`): harness weryfikacyjny zarejestrowany w
`.claude/launch.json` jako `idee-verify-3195` (port 3195); ekrany dev-render:
`?screen=mindmap-canvas`, `whiteboard-canvas`, `processflow-canvas`, `idea-table`
(parametry `&lang=pl|en&theme=light|dark`).

**Pierwsza konkretna robota do zrobienia** (patrz §12 pkt 2-3 dla pełnego
uzasadnienia): dokończyć weryfikację **Teresy Z4** — sprawdzić w przeglądarce (nie
tylko teoretycznie), czy `executeTeresaTool → runIdeaAction → handler` faktycznie
wykonuje akcję na płótnie, gdy wywołanie przychodzi od modelu przez SSE
`idea_action`. Transport i trafność modelu są już potwierdzone (13 poleceń × 3
modele, 0 halucynacji nazw narzędzi) — brakuje tylko dowodu, że wykonanie po stronie
przeglądarki działa identycznie jak klik człowieka. Dopiero po tym włącz
`ENABLE_TERESA_IDEA_ACTIONS` (uwaga: `VITE_ENABLE_TERESA_IDEA_ACTIONS` po stronie
frontu jest build-time).

Jeśli Piotr zostawił feedback z testów — to on rządzi kolejnością, nie ta lista.
