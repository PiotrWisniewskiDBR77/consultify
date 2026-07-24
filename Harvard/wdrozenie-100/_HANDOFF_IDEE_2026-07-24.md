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
