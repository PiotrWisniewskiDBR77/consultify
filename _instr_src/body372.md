## Po co ten dyżur istnieje

Audyt ekranu „Czat AI” z 05.09 (`docs/program/AUDYT_CZAT_PRZYCISKI_20260905/00_ZESTAWIENIE.md`)
znalazł 449 przycisków/elementów na siedmiu powierzchniach ekranu i policzył jedną rodzinę
defektów P2 zbiorczo: **„Angielski w polskim UI (największa rodzina, ~40 miejsc)”.** To był
szacunek jednej powierzchni (paska kanwy), napisany w jednym zdaniu zbiorczym. Trzy z siedmiu
plików audytu (`A1`, `E`) przyznają wprost, że pełny sweep jest **„poza zakresem czasowym tego
przebiegu — wymaga osobnego sweep”.** Ten dyżur JEST tym sweep, zmierzonym mechanicznie, nie
oszacowanym.

**Wynik mojego pomiaru na markerze: nie ~40, tylko co najmniej 250 miejsc**, w dwóch klasach:

- **Klasa (b) — literał BEZ ŻADNEGO wywołania `t()`.** Etykieta jest zwykłym stringiem JS
  użytym wprost jako `aria-label`/`title`/tekst przycisku. Zero szans na tłumaczenie, bo kod
  nigdy nie pyta słownika. **42 miejsca** w pasku kanwy/blokach datasetu/`ToolsMenu.tsx` +
  **1** `window.confirm` na sztywno w `ChatHistorySidebar.tsx` = **43**.
- **Klasa (a) — `t(klucz, fallback)` z kluczem, którego wartość PL NIE ISTNIEJE w słowniku.**
  Kod pyta słownik, słownik milczy po polsku, użytkownik dostaje angielski `fallback` — **cicho,
  bez błędu**. **13** kluczy w menu AI edytora + **58** kluczy w
  `UnifiedChatPanel.tsx`/`ChatHistorySidebar.tsx`/`ConversationActions.tsx`/
  `MoveToProjectModal.tsx`/`SystemHealth.tsx` (14 z nich zweryfikowane przeze mnie imiennie,
  reszta z mechanicznego skanu) + **136** kluczy w `MessageRenderer.tsx` i 9 innych
  komponentach-kartach (z 19 sprawdzonych — pozostałe 9 mają zero trafień tej klasy).
  **RAZEM klasa (a): 13+58+136 = 207.**

**★ Korekta wobec audytu, zmierzona przeze mnie:** `A2` D-6 zgłosił jako brakujące
`canvas.versionHistory.confirmRestore/confirmYes/cancel`. Na markerze tej instrukcji **wszystkie
pięć kluczy tej rodziny są kompletne i poprawnie polskie w obu słownikach** — ktoś to już naprawił
równolegle, a rejestr audytu tego nie odnotował. To jest dokładnie ósmy znany kształt fałszywego
„gotowe” w tym programie w odwrotną stronę: **klucz nieobecny w rejestrze ≠ defekt nadal
istniejący.** Nie dotykasz tej rodziny.

**★ Druga korekta:** `C_naglowek_historia.md` D-3 nazwał jedną pod-rodzinę (nagłówek/historia)
„7 kluczy”. Mój pomiar komendami (7)-(8) w `§0.3` (imiennie zweryfikowane) daje **13** — a pełny
mechaniczny skan tych samych PIĘCIU plików (komenda 8b) daje **58**, bo audytor patrzył tylko na
punkty własnej listy, nie na wszystkie wywołania `t()` w tych plikach. Podaję obie liczby z
komendami, jak każe `Z24` — mianownik dyżuru to **58**, nie 7 ani 13.

**★ Trzecia korekta — metodologia:** licznik NIE jest „klucz nieobecny w PL LUB EN” (to dałoby
zawyżoną liczbę, bo część kluczy ma poprawną wartość PL, a brakuje jej dopiero w EN — to inny,
niższego priorytetu defekt parytetu słowników, nie „angielski w polskim UI”). Licznik tej rodziny
to WYŁĄCZNIE „wartość PL nieobecna” — to jest jedyna definicja zgodna z nazwą dyżuru.

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| klasa (b) — pasek kanwy + bloki datasetu + `ToolsMenu` | **42** literałów bez `t()` | `canvasActionAvailability.ts:27-47` (14), `WorkCanvasDocumentPanel.tsx` pending-op `:5158/5166/5173` (3) + dataset `:461-490` (7), `CanvasArtifactBlockRenderer.tsx` `EvidenceList`/aria-label/`BlockHeader` `:240,310,379-500,808-844` (17), `ToolsMenu.tsx:625` „Reset” (1) |
| klasa (b) — `window.confirm` na sztywno | **1** | `ChatHistorySidebar.tsx:641` |
| klasa (a) — `CanvasAIFloatingMenu.tsx` | **13** kluczy (`quickAction`×11, `tone`×2) | `:313,329`; **`labelPl` już istnieje w tablicy źródłowej i jest ignorowane** |
| klasa (a) — nagłówek/historia/SystemHealth, PEŁNY mianownik | **58** kluczy (14 imiennie + 44 ze skanu; audyt mówił „7”) | `UnifiedChatPanel.tsx` 36, `ChatHistorySidebar.tsx` 7, `ConversationActions.tsx` 5, `MoveToProjectModal.tsx` 7, `SystemHealth.tsx` 3 — skan `§0.3` komenda (8b) |
| klasa (a) — `MessageRenderer.tsx` + 9 kart (z 19 sprawdzonych) | **136** kluczy | skan `§0.3` komenda (11); filtr = wyłącznie `pl` brakujące |
| korekta — `canvas.versionHistory.*` | **JUŻ NAPRAWIONE** | audyt `A2` D-6 nieaktualny — 5/5 kluczy kompletne i polskie |
| bezpiecznik etykiet | **NIE OBEJMUJE** `AIChat`/`canvas` | `check-etykiety-dwujezyczne.mjs:51`, domyślny zakres = `DiscoveryTools`+`toolPacks` |
| `reachability-from-root.mjs --check-baseline` | **exit 1, PRZED tym dyżurem** | 3 nowe pliki test-only, NIEZWIĄZANE z rodziną AIChat/canvas — patrz `R6` |
| liście słowników | **pl 35204, en 33071** | komenda (12) |

**RAZEM (mianownik wstępny, do potwierdzenia w `R1`): 42+1+13+58+136 = 250 miejsc.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **42** literałów klasy (b) w pasku kanwy/blokach datasetu/`ToolsMenu`;
**1** `window.confirm` na sztywno; **13** kluczy klasy (a) w `CanvasAIFloatingMenu.tsx` (z gotowym,
niewykorzystanym `labelPl`); **58** kluczy klasy (a) w nagłówku/historii/SystemHealth — PEŁNY
mianownik ze skanu, nie 7 i nie tylko 13 imiennie sprawdzone; **136** kluczy klasy (a) w
`MessageRenderer.tsx` + 9 kartach; `canvas.versionHistory.*` **JUŻ naprawione** (nie dotykasz);
bezpiecznik etykiet **nie obejmuje** tej rodziny; `reachability` **czerwony PRZED** Twoją zmianą
z powodu trzech cudzych plików; liście słowników **pl 35204 / en 33071**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost w „Korektach wobec instrukcji”.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · SŁOWNIK · TEST · BEZPIECZNIK

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief
z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Słownik PL** | `public/locales/pl/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE nowych kluczy** wymienionych w `R2`-`R5`, wartość musi być polska, nie kopią EN (chyba że nazwa własna/skrót — uzasadnij). Zakaz zmiany istniejących wartości poza sekcjami dodawanymi | — |
| **Słownik EN** | `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE tych samych kluczy**, wartość = literał angielski już obecny w kodzie jako fallback. Zakaz zmiany istniejących wartości | — |
| **Klasa (b) — pasek kanwy** | `src/utils/canvas/canvasActionAvailability.ts` | **★ WĄSKA LICENCJA:** zamiana 14 literałów `actionLabels` na `t('canvas.actions.<id>', '<oryginalny literał EN>')`. Zakaz zmiany `actionGroups`, `availability()`, sygnatur eksportowanych | Brief |
| **Klasa (b) — panel kanwy** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE `R2`:** zamiana 3 literałów pending-operation (`:5158,5166,5173`) i 7 etykiet `datasetArtifactActions` (`:461-490`) na `t(klucz, literał)`. **Zakaz** dotykania handlerów, warunków renderu, `outputTargets`, logiki draftów, save/share/proposals | Brief |
| **Klasa (b) — bloki artefaktów** | `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | **★ WĄSKA LICENCJA:** 12 `title="..."` w `EvidenceList` (`:379-383,413-416,498-500`), 2 `aria-label={\`...\`}` (`:240,310` — zachowaj interpolację zmiennej), `BlockHeader` (`:808-844`, 3 literały: „block”, „Copy”, „CSV”). Zakaz zmiany `onCopy`/`onExport`/logiki eksportu CSV | Brief |
| **Klasa (b) — narzędzia** | `src/components/AIChat/ToolsMenu.tsx` | **★ WĄSKA LICENCJA:** linia 625, `>Reset<` → `{t('common.reset', 'Reset')}`. Zakaz zmiany handlera `onClick` (reset stanu) | Brief |
| **Klasa (a) — menu AI edytora** | `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` | **★ WĄSKA LICENCJA:** dodanie 13 kluczy do obu słowników z wartością PL = `action.labelPl`/`option.labelPl` JUŻ obecne w `QUICK_ACTIONS`/`TONE_OPTIONS` (`:41-144`). **Zakaz** zmiany `prompt`, `id`, kolejności tablic, logiki `onAIRequest` | Brief |
| **Klasa (a) — nagłówek/historia** | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/components/AIChat/ChatHistorySidebar.tsx`, `src/components/AIChat/ConversationActions.tsx`, `src/components/AIChat/MoveToProjectModal.tsx` | **★ WĄSKA LICENCJA:** dodanie WSZYSTKICH 58 kluczy zmierzonych w `R1`/`R4` (14 zidentyfikowanych imiennie, reszta ze skanu) + zamiana `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)` (`ChatHistorySidebar.tsx:641`) na `window.confirm(t('aiChat.confirmDeleteBulk', ...))`. **Zakaz** zmiany logiki usuwania/przenoszenia/RODO-zgody | Brief |
| **Klasa (a) — SystemHealth** | `src/components/SystemHealth.tsx` | **★ WĄSKA LICENCJA:** linia 191, dodanie klucza `system.dataAccess`. Zakaz zmiany reszty komponentu | Brief |
| **Klasa (a) — MessageRenderer + karty** | `src/components/AIChat/MessageRenderer.tsx`, `ArtifactBadge.tsx`, `ArtifactChip.tsx`, `CaseIntakeConfirmCard.tsx`, `ChatTableProposalCard.tsx`, `CitationList.tsx`, `ExecutionProposalMessage.tsx`, `GovernedChatHandoffCard.tsx`, `GovernedInitiativeHandoffCard.tsx`, `InlineResponseFeedback.tsx`, `Messages/InlineThinkingStream.tsx`, `Messages/ReasoningTrace.tsx`, `ResearchProgress.tsx`, `SourcesStrip.tsx`, `StructuredOutputBlock.tsx`, `TeresaProposalCard.tsx`, `ToolStepList.tsx`, `TrustBadge.tsx`, `TrustPanel.tsx`, `ChatCodeBlock.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE dopisanie brakującego klucza do obu słowników** dla każdego `t(klucz, fallback)` znalezionego w `R1`. **Zakaz** zmiany JSX poza samym wywołaniem `t()` (klucz już istnieje w kodzie — nie trzeba go dopisywać w komponencie), zakaz zmiany propsów/handlerów/warunków renderu | Brief |
| **NIETYKALNE — `canvas.versionHistory.*`** | `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` | **TYLKO ODCZYT.** Rodzina już naprawiona (patrz korekta wyżej) — dotknięcie tego pliku bez nowego dowodu defektu jest poza zakresem | Errata w raporcie, nie zmiana |
| **NIETYKALNE — workflow ledger** | `WorkCanvasDocumentPanel.tsx:4692-4906` | **TYLKO ODCZYT.** Za `isCanvasDevDiagnosticsEnabled()`, default OFF, diagnostyka deweloperska — pytanie do właściciela, nie decyzja wykonawcy | Pytanie w raporcie |
| **Nowe testy** | `src/components/AIChat/__tests__/*.i18n.test.tsx` (NOWE, konwencja katalogu — patrz `SCIEZKI`) | **★ PEŁNA LICENCJA.** Wzorzec: `GovernedChatHandoffCard.day179.i18n.test.tsx`. `git add -f` | — |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs` | **★ WĄSKA LICENCJA, WYŁĄCZNIE `R6`:** rozszerzenie tablicy `roots` (linia 51) o `src/components/AIChat` i `src/utils/canvas`, **JEŻELI** pomiar `R6` pokaże, że dziś ich nie obejmuje (już zmierzone: nie obejmuje). Zakaz zmiany regexów `languageCondition`/`ternaryPattern` | Brief |
| **Baseline etykiet** | `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ WĄSKA LICENCJA:** podniesienie `minFiles`/`minTernaries` WYŁĄCZNIE w górę, o realnie zmierzoną różnicę, nigdy w dół | — |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** ręczne dopisanie WYŁĄCZNIE ścieżek własnych nowych plików testowych do `testOnlyFiles`. **Zakaz** użycia `--update-baseline` (odmawia przy jakimkolwiek wzroście — patrz `§0.3` komenda 13), zakaz usuwania istniejących wpisów, zakaz dotykania `files` (unreachable) | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY372_I18N_CZAT_REPORT.md` (**NOWY**) | `R6` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **`server/src/**`** | wszystko | **TYLKO ODCZYT — CAŁA WARSTWA.** Ten dyżur nie ma tras tył (patrz nagłówek) | Brief, jeśli okaże się potrzebne — to jest STOP merytoryczny dla tej pozycji |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `13_CHAT` | Rekomendacja w raporcie |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (musza URODNAC o dokladnie tyle, ile dodales)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35204, en 33071. PO: PRZED + (liczba kluczy faktycznie
#   dodanych w R2-R5, ta sama liczba w obu jezykach — słownik nie jest symetryczny
#   dzis, ale KAZDY nowy klucz tego dyzuru wchodzi do OBU rownoczesnie)

# (b) cztery bezpieczniki maja konczyc sie kodem 0 — Z WYJATKIEM reach, patrz (c)
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby PRZED: wszystkie 0. Jezeli PO Twojej zmiany ktorykolwiek sie
#   zaczerwieni — naprawiasz KODEM, nigdy progiem (Z35).

# (c) ★★ reachability — WYJATEK udokumentowany, nie zwykly bezpiecznik 0/0
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: exit 1, "New test-only files (3)" — pliki NIEZWIAZANE z
#   tym dyzurem (patrz Stan zastany). PO Twojej zmianie (dodanie wlasnych plikow
#   testowych do src/components/AIChat/__tests__/ + reczny wpis do
#   reachability.baseline.json, patrz R6): oczekiwany wynik to DALEJ exit 1,
#   z DOKLADNIE TYMI SAMYMI TRZEMA nazwami w komunikacie "New test-only files" —
#   Twoje wlasne nowe pliki NIE MAJA sie pojawic na tej liscie (bo je dopisales
#   do baseline). Jesli po Twojej zmianie lista ma 4+ pozycje zamiast 3 —
#   to JEST Twoja regresja tego bezpiecznika, napraw wpis w R6.

# (d) bezpiecznik etykiet — zakres, nie tylko kod wyjscia
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety-domyslny=$?"
node scripts/dev/check-etykiety-dwujezyczne.mjs --zakres=src/components/AIChat; echo "etykiety-aichat=$?"
#   moje liczby PRZED: domyslny=0 (bo AIChat poza zasiegiem, patrz Stan zastany),
#   etykiety-aichat zalezny od tego, ile ternary pattern (isPolish?'x':'y') jest
#   w AIChat — zmierz i zapisz. PO R6 (jesli rozszerzasz roots): domyslny MUSI
#   nadal konczyc sie 0 (zero nieuzasadnionych identycznych), bo teraz obejmuje
#   wiecej plikow.
```

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | literałów klasy (b), pasek kanwy + dataset + `ToolsMenu` | `42` | komenda (1)-(4) z `§0.3` | TAK — czyta kod źródłowy wprost |
| 2 | `window.confirm` na sztywno | `1` | komenda (8) | TAK |
| 3 | kluczy klasy (a), `CanvasAIFloatingMenu.tsx` | `13` | komenda (5)-(6) | TAK — i potwierdza `labelPl` już obecne |
| 4 | kluczy klasy (a), nagłówek/historia/SystemHealth, PEŁNY mianownik | `58` | komenda (8b), skrypt `skan-r4.py` w `§0.3` | TAK — **audyt mówił „7”, imienna weryfikacja daje 13-14, pełny skan wiąże na 58** |
| 5 | kluczy klasy (a), `MessageRenderer`+9 kart | `136` | komenda (11), skrypt `skan-r5.py` w `§0.3` | TAK — pełny sweep 19 plików, filtr = wyłącznie `pl` brakujące |
| 6 | rodzina `canvas.versionHistory.*` | `0` (już naprawione) | komenda (10) | TAK — **korekta wobec audytu** |
| 7 | zakres bezpiecznika etykiet | „nie obejmuje” | komenda (14) | TAK — `roots` w linii 51 + wywołanie w pre-commit |
| 8 | `reachability` PRZED | `exit 1`, 3 pliki | komenda (13) | TAK — pełny komunikat, nie tylko kod wyjścia |
| 9 | liście słowników PRZED | `pl 35204 / en 33071` | komenda (12) | TAK |
| 10 | RAZEM mianownik dyżuru | `250` | suma wierszy 1+2+3+4+5 = 42+1+13+58+136 | TAK — **potwierdź w `R1` własnym sumowaniem, nie przepisuj** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`public/locales/pl/translation.json` · `public/locales/en/translation.json` ·
`src/utils/canvas/canvasActionAvailability.ts` ·
`src/components/AIChat/WorkCanvasDocumentPanel.tsx` ·
`src/components/AIChat/CanvasArtifactBlockRenderer.tsx` ·
`src/components/AIChat/ToolsMenu.tsx` ·
`src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` ·
`src/components/AIChat/UnifiedChatPanel.tsx` ·
`src/components/AIChat/ChatHistorySidebar.tsx` ·
`src/components/AIChat/ConversationActions.tsx` ·
`src/components/AIChat/MoveToProjectModal.tsx` ·
`src/components/SystemHealth.tsx` ·
`src/components/AIChat/MessageRenderer.tsx` i komponenty-karty z trafieniami (do 9, wymienione w tabeli licencji i zmierzone w `R1`) ·
nowe pliki `src/components/AIChat/__tests__/day372-*.i18n.test.tsx` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY372_I18N_CZAT_REPORT.md` ·
`evidence/i18n-czat/**` (nowy katalog).

**Zapisujesz WARUNKOWO:**
`scripts/dev/check-etykiety-dwujezyczne.mjs` (tylko jeśli `R6` potwierdzi brak zasięgu — już
potwierdzone, więc TAK) · `scripts/dev/check-etykiety-dwujezyczne.baseline.json` (tylko podniesienie
progów w górę) · `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (tylko dopisanie
własnych nowych plików testowych) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (CAŁOŚĆ — brak tras tył) ·
`src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` (rodzina już naprawiona) ·
`WorkCanvasDocumentPanel.tsx` linie `4692-4906` (workflow ledger, dev-diagnostics) ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) ·
handlery `onClick`/`onCopy`/`onExport`/logika zapisu draftów/proposals/`Api.*` w KAŻDYM dotkniętym
pliku (zmieniasz WYŁĄCZNIE literał → `t()`) · kolejność/`id`/`prompt` w `QUICK_ACTIONS`/`TONE_OPTIONS`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day372-i18n-czat
git diff --name-only --cached | tee /private/tmp/cx-day372-i18n-czat-artefakty/staged.txt
bash -c "grep -iE '^server/src/|CanvasVersionHistory\.tsx|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE' /private/tmp/cx-day372-i18n-czat-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# osobno: zmiana w kazdym dotknietym pliku PRODUKTU ma dotyczyc TYLKO literalu/t(), nie logiki —
# przeglad reczny kazdego diffa < 20 linii per plik jest oczekiwany; diff > 20 linii w jednym
# pliku produktu = STOP i przeczytaj wlasny diff zanim scommitujesz
git diff --cached -- src/ | grep -c '^[+-]' 
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Test broni ZACHOWANIA prawdziwego resolvera i18next, nigdy tekstu źródła.**
`readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest **zakazany** jako dowód. Wzorzec
obowiązkowy: prawdziwa instancja `i18next` z `fallbackLng:false` (klucz brakujący zwraca sam
klucz, nie fallback — to jedyny sposób odróżnić „przetłumaczone” od „fallback po angielsku”),
PLUS co najmniej jeden test renderujący realny komponent. Gotowy wzorzec w repo:
`src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx` — kopiujesz
KSZTAŁT (instancja + `t()` + render + `container.textContent`), nie wynik.

**(2) Wartość PL nie może być kopią wartości EN.** Klucz „dodany”, którego polska wartość to
przepisany angielski string, nie jest naprawą — jest tym samym defektem z ptaszkiem (`Z32`
analogicznie: dowód mutacyjny wymaga realnej różnicy). Wyjątek: nazwy własne i skróty techniczne
(„Teresa”, „CSV”, „KPI”) — piszesz uzasadnienie w raporcie, wzorem `justification()` w
`scripts/dev/i18n-pl-audyt.mjs`.

**(3) Zakaz rozszerzania zakresu poza 30-plikową rodzinę** z tabeli licencji. Mechaniczny skan
`R1` prawie na pewno znajdzie ten sam wzorzec (`t(klucz, fallback)` z brakującym kluczem) POZA
tymi plikami, w innych narzędziach niż Czat AI. To NIE jest Twoje do naprawy — zapisujesz
`plik:linia` do „CO NADAL WYMAGA OSOBNEGO ZLECENIA” i idziesz dalej.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: SKAN MECHANICZNY, MIANOWNIK PRZED (bez zmian kodu)

**To jest pomiar. Nie naprawiasz w tej pozycji.**

1. Uruchom **dosłownie** wszystkie 14 komend z `§0.3` na swoim worktree z markera. Zapisz każdy
   wynik do `evidence/i18n-czat/skan-przed.txt` (nowy plik, `git add -f`).
2. **Potwierdź lub obal moje sumowanie: 42+1+13+58+136 = 250.** Jeżeli Twoje liczby się różnią —
   to jest WYNIK, nie sprzeczność (`Z24`) — zapisz swoją tabelę mianowników od zera, z komendami.
3. **Sprawdź klasę (c)** z definicji tego dyżuru: klucz istnieje w OBU słownikach, ale wartość PL
   jest identyczna z EN i wygląda na angielską. Skrypt pomocniczy (nie nowy plik trwały — uruchom
   ad hoc):
   ```bash
   python3 -c "
   import json, re
   pl = json.load(open('public/locales/pl/translation.json'))
   en = json.load(open('public/locales/en/translation.json'))
   def flatten(d, prefix=''):
       for k, v in d.items():
           p = f'{prefix}.{k}' if prefix else k
           if isinstance(v, dict): yield from flatten(v, p)
           else: yield p, v
   plf = dict(flatten(pl))
   enf = dict(flatten(en))
   suspects = [(k, v) for k, v in plf.items() if k in enf and v == enf[k] and re.search('[a-zA-Z]', v) and not re.search('[ąćęłńóśźż]', v.lower()) and k.startswith(('canvas.', 'aiChat.', 'chat.', 'system.'))]
   print(len(suspects), 'podejrzanych (klucz w obu, wartosc identyczna, wyglada na angielska)')
   for k, v in suspects[:40]: print(k, '=', repr(v))
   "
   ```
   Zapisz wynik do `evidence/i18n-czat/klasa-c-podejrzani.txt`. Każdą pozycję orzekasz z osobna:
   uzasadniona (nazwa własna/skrót — wpisz dlaczego) albo REALNY DEFEKT (dopisz do mianownika
   swojej pozycji `R2`-`R5`, w zależności od pliku).
4. **Zapisz mianownik ostateczny PRZED** w `evidence/i18n-czat/mianownik-przed.json`:
   `{"klasa_b": N, "klasa_a": N, "klasa_c_defekt": N, "razem": N}`.

**Wymagany dowód:** `skan-przed.txt`, `klasa-c-podejrzani.txt`, `mianownik-przed.json`, wszystkie
w `evidence/i18n-czat/`. **Commit po `R1`.**

## R2 — KLASA (b): PASEK KANWY, BLOKI DATASETU, TOOLSMENU (rdzeń)

1. **`canvasActionAvailability.ts:27-47`** — zamień 14 wpisów `actionLabels` z literału na
   `t('canvas.actions.<id>', '<oryginalny literał>')` (np. `copy: t('canvas.actions.copy', 'Copy Markdown')`
   — **uwaga**: ten plik nie jest komponentem React, sprawdź czy `t` jest dostępne w tym module;
   jeżeli nie — funkcja `actionLabels` musi stać się funkcją przyjmującą `t` jako parametr, wołaną
   z komponentu, który go ma (`renderCommandButton` w `WorkCanvasDocumentPanel.tsx:3232`). **To
   jest jedyna dopuszczalna zmiana kształtu kodu w tej pozycji** — sygnatura funkcji, nie logika.
2. **`WorkCanvasDocumentPanel.tsx`** — 3 literały pending-operation (`:5158,5166,5173`) i 7 etykiet
   `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Pamiętaj: ten sam obiekt
   `datasetArtifactActions` renderuje się w DWÓCH miejscach (`:3767` i `:4264`, pułapka 5) —
   naprawiasz JEDNO źródło, oba miejsca dostają tłumaczenie automatycznie.
3. **`CanvasArtifactBlockRenderer.tsx`** — 12 `title="..."` w `EvidenceList` (`:379-383,413-416,
   498-500`), 2 `aria-label={\`...\`}` z interpolacją (`:240,310` — zachowaj `${block.title}`/
   `${entry.index + 1}` wewnątrz tłumaczonego stringa przez `t(klucz, fallback, {title: block.title})`
   ze wzorcem `{{title}}` w słowniku), `BlockHeader` (`:808-844`, 3 literały: „block”, „Copy”,
   „CSV” — funkcja wołana z 6 miejsc, naprawiasz raz, pułapka 4).
4. **`ToolsMenu.tsx:625`** — `>Reset<` → `{t('common.reset', 'Reset')}`.
5. **KROK 0 rodziny wewnątrz tej pozycji:** po zmianie uruchom
   `bash -c "grep -rn 'aria-label=\"[A-Z]\|title=\"[A-Z]' src/utils/canvas/ src/components/AIChat/WorkCanvasDocumentPanel.tsx src/components/AIChat/CanvasArtifactBlockRenderer.tsx"` —
   oczekiwany wynik: **0 trafień** poza `t(...)`-owanymi (regex może złapać fałszywe pozytywy w
   klasach CSS zaczynających się wielką literą — odsiej ręcznie i zapisz co odsiałeś).
6. **Test:** rozszerz/utwórz `src/components/AIChat/__tests__/day372-canvasToolbar.i18n.test.tsx` —
   instancja `i18next` z `lng:'pl'`, `fallbackLng:false`; pętla po wszystkich 14+3+7 kluczach
   `canvas.actions.*`/`canvas.panel.pendingOperation.*`/`canvas.panel.dataset.*` sprawdzająca
   `testI18n.t(klucz)` ≠ klucz; PLUS jeden render `WorkCanvasDocumentPanel` (albo najmniejszy
   wycinek, jeśli pełny montaż wymaga zbyt wielu propsów/mocków — opisz co zmockowałeś) z
   asercją, że `aria-label` przycisku „Utwórz prezentację” to POLSKI tekst, nie „Create
   presentation”. Osobny test/`describe` dla `CanvasArtifactBlockRenderer` (render bloku typu
   `research`, sprawdź `container.textContent` zawiera polskie nagłówki `EvidenceList`) i dla
   `ToolsMenu` (render, `screen.getByText` polskiego „Resetuj”/odpowiednika, NIE „Reset”).

**Wymagany dowód:** diff czterech plików produktu (42 literały klasy b) · wynik grep-u
„0 trafień” z pkt 5 · nowy plik testowy zielony · `git diff` par PRZED/PO tekstu (np. zrzut
`container.textContent` przed i po dla jednego bloku) pokazujący zniknięcie angielskiego
stringa. **Commit po `R2`.**

## R3 — KLASA (a): MENU AI EDYTORA — 13 KLUCZY Z JUŻ GOTOWYM `labelPl` (rdzeń)

1. Dla każdego z 11 `QUICK_ACTIONS` i 2 `TONE_OPTIONS` w `CanvasAIFloatingMenu.tsx:41-144` dodaj
   klucz `canvas.aiMenu.quickAction.<id>` / `canvas.aiMenu.tone.<id>` do obu słowników:
   **PL = `action.labelPl` skopiowane 1:1** (już poprawne, np. „Rozwiń”, „Skróć”, „Doszlifuj”),
   **EN = `action.labelEn`**.
2. **Nie zmieniaj linii renderującej** (`:313,329`, `t(klucz, action.labelEn)`) — fallback zostaje
   jako siatka bezpieczeństwa, klucz teraz istnieje i wygrywa.
3. **Zweryfikuj**, że żaden z 13 kluczy nie koliduje z istniejącą sekcją `canvas.aiMenu.*` (już są
   tam klucze jak `explain`, `condense`, `expand`, `askTeresa` — sprawdź, że Twoje nowe nie
   nadpisują istniejących: `python3 -c "import json; d=json.load(open('public/locales/pl/translation.json')); print(list(d.get('canvas',{}).get('aiMenu',{}).keys()))"`).

**Wymagany dowód:** diff dwóch słowników (13 nowych kluczy × 2 pliki) · test
`day372-canvasAiMenu.i18n.test.tsx`: pętla resolvera (13 kluczy, `fallbackLng:false`,
`expect(t(klucz)).toBe(action.labelPl)`) + render `CanvasAIFloatingMenu` z zaznaczonym tekstem,
otwarcie flyoutu „Akcje”/„Ton”, `container.textContent` zawiera „Rozwiń”/„Formalny” i NIE zawiera
„Expand”/„Formal”. **Commit po `R3`.**

## R4 — KLASA (a): NAGŁÓWEK, HISTORIA, SYSTEMHEALTH — PEŁNY SWEEP, 58 KLUCZY + 1 `window.confirm` (rdzeń)

1. **KROK 0 rodziny — nie ogranicz się do imiennie znanych.** Uruchom `evidence/i18n-czat/skan-r4.py`
   (zapisany w `R1`, wzorzec skryptu w `§0.3` komenda 8b), rozszerzony tak, by drukował
   `plik:linia:klucz:fallback` dla KAŻDEGO trafienia (nie tylko sumę), i zapisz pełną listę do
   `evidence/i18n-czat/header-historia-lista.txt`. **14 z 58 pozycji mam już zweryfikowane
   imiennie** (poniżej, z `plik:linia`) — reszta (44) wychodzi z tej listy:
   `aiChat.business` (`UnifiedChatPanel.tsx:6797`) · `aiChat.muteNow` (:6883) ·
   `aiChat.workPanel.title` (:7490) · `aiChat.workPanel.resizeDivider` (:7495) ·
   `aiChat.actions.export` (`ConversationActions.tsx:356`) · `aiChat.actions.purge` (:407) ·
   `aiChat.confirmDeleteDestructive` (:368) · `aiChat.confirmPurge` (:392) ·
   `aiChat.confirmDeleteFolder` (`ChatHistorySidebar.tsx:902`) ·
   `aiChat.confirmDeleteFolderWithConvs` (:899) · `aiChat.deleteFolderFailed` (:910) ·
   `aiChat.confirmMovePrivateToOrganization` (:943, też `MoveToProjectModal.tsx:153`) ·
   `aiChat.visibilityConsentRecorded` (:956, też `MoveToProjectModal.tsx:168`) ·
   `system.dataAccess` (`SystemHealth.tsx:191`).
2. Dodaj do obu słowników **wszystkie 58** klucze z listy z kroku 1 (wartość EN = fallback już
   w kodzie, wartość PL — Twoje tłumaczenie, naturalne, nie dosłowna kalka).
3. **`ChatHistorySidebar.tsx:641`** — `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)`
   → dodaj klucz `aiChat.confirmDeleteBulk` z interpolacją `{{count}}`
   (`t('aiChat.confirmDeleteBulk', 'Delete {{count}} conversation(s)?', {count: ids.length})`),
   wartość PL z poprawną polską odmianą liczebnika (i18next `_plural`/`_one` albo prosty zapis
   „Usunąć {{count}} rozmów(y)?” — wybierz kształt spójny z resztą pliku, sprawdź czy repo już
   ma wzorzec liczby mnogiej w `aiChat.*` i skopiuj go).
4. **Uwaga do `aiChat.newChat`** z audytu `C` D-2: klucz `aiChat.newChat` ma dziś fallback
   `'Nowy czat'` w kodzie, ale sama wartość klucza w słowniku to `'Nowa rozmowa'` (klucz wygrywa
   nad fallbackiem — użytkownik i tak widzi poprawny polski tekst). To NIE jest defekt widoczny
   dla użytkownika — **nie dotykaj**, zapisz w raporcie jako obserwację (fallback mylący dla
   przyszłego programisty, poza zakresem tego dyżuru — który naprawia to, co WIDAĆ, nie kod
   źródłowy jako taki).
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r4.py` — oczekiwany wynik **0**.
   Częściowe wykonanie z jawną listą braków jest wynikiem pełnowartościowym (`§0.5`).

**Wymagany dowód:** `header-historia-lista.txt` (pełna, 58 wierszy na starcie) · diff pięciu plików
produktu + dwóch słowników (do 58 nowych par kluczy) · para „przed: `window.confirm` pokazuje
angielski tekst (zrzut/opis) / po: pokazuje polski” · test
`day372-headerHistorySystemHealth.i18n.test.tsx`: resolver w pętli po wszystkich 58 kluczach
(`fallbackLng:false`, `t(klucz) !== klucz`) + render `ChatHistorySidebar` (przycisk usuwania,
sprawdź wywołanie `window.confirm` przez `vi.spyOn(window, 'confirm')` i asercję na PRZEKAZANY
string, nie tylko że został wywołany) + render `SystemHealth` (rozwinięta pigułka „Dane”, nagłówek
po polsku) + wynik `skan-r4.py` PO (docelowo `0`). **Commit po `R4`.**

## R5 — KLASA (a): PEŁNY SWEEP `MessageRenderer.tsx` + KARTY — 136 KLUCZY (rdzeń, największa pozycja)

**To jest sweep, który audyt 05.09 nazwał wprost „poza zakresem czasowym”. Robisz go tutaj,
mechanicznie, plik po pliku.**

1. Uruchom `evidence/i18n-czat/skan-r5.py` (zapisany w `R1`, wzorzec skryptu w `§0.3` komenda 11)
   i zapisz **pełną** listę `plik:linia:klucz:fallback` do
   `evidence/i18n-czat/messagerenderer-karty-lista.txt` (rozszerz skrypt, by drukował każdą
   pozycję, nie tylko sumę — dodaj `print(f'{rel}:{line}\t{key}\t{fallback}')` w pętli). Zmierzone
   przeze mnie: **136**, w 10 z 19 plików (`MessageRenderer.tsx` 48, `TrustBadge.tsx` 19,
   `ExecutionProposalMessage.tsx` 18, `GovernedInitiativeHandoffCard.tsx` 17, `ResearchProgress.tsx`
   11, `CitationList.tsx` 9, `TeresaProposalCard.tsx` 8, `InlineResponseFeedback.tsx` 3,
   `ArtifactBadge.tsx` 2, `GovernedChatHandoffCard.tsx` 1); pozostałe 9 plików (`ArtifactChip`,
   `CaseIntakeConfirmCard`, `ChatTableProposalCard`, `Messages/InlineThinkingStream`,
   `Messages/ReasoningTrace`, `SourcesStrip`, `StructuredOutputBlock`, `ToolStepList`,
   `TrustPanel`, `ChatCodeBlock`) mają dziś **0** trafień tej klasy — zostają w licencji (KROK 0
   = cały plik sprawdzony, nie próbka), ale nie wymagają zmiany, chyba że Twój pomiar pokaże inaczej.
2. **Dla plików z co najmniej jednym trafieniem** (patrz lista wyżej): dodaj brakujące
   klucze do obu słowników. PL = tłumaczenie fallbacku EN, naturalne, spójne z resztą sekcji tego
   klucza w słowniku (sprawdź sąsiednie klucze tej samej gałęzi — np. `chat.report.*` już ma
   4 poprawne wpisy obok Twoich nowych w tej samej rodzinie, trzymaj ten sam rejestr językowy).
3. **Nie zmieniaj JSX.** Każdy `t(klucz, fallback)` w kodzie zostaje identyczny — dodajesz
   WYŁĄCZNIE brakujący `klucz` do słowników. Jeśli w trakcie pracy odkryjesz, że jakiś klucz jest
   używany z RÓŻNYMI fallbackami w różnych miejscach (kolizja nazw) — to jest STOP MERYTORYCZNY dla
   TEGO klucza: zapisz oba miejsca, zaproponuj rozdzielenie na dwa klucze jako diff nienałożony,
   idź dalej z resztą.
4. **Test — jeden plik per komponent, wzorcem `day179`:** dla KAŻDEGO z 10 plików z trafieniami: instancja
   `i18next` (`fallbackLng:false`) + pętla po wszystkich kluczach TEGO pliku znalezionych w kroku 1,
   asercja `t(klucz) !== klucz`; PLUS jeden render tego komponentu (z minimalnymi, opisanymi w
   komentarzu mockami propsów) sprawdzający, że renderowany `container.textContent`/konkretny
   `aria-label` nie zawiera ŻADNEGO z angielskich fallbacków tego pliku. Jeżeli komponent jest
   zbyt głęboko zagnieżdżony, by wyrenderować go w izolacji (np. wymaga kontekstu, którego nie ma
   w testowym drzewie) — dopuszczalne jest wywołanie samej funkcji/hooka zwracającego etykiety,
   **opisane w raporcie dlaczego pełny render nie był możliwy** (to jest dozwolony wyjątek z `R1`
   punkt 2 wzorca 366, nie automat).
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r5.py`
   — oczekiwany wynik: **0** (klasa a zniknęła z tej rodziny). Jeżeli zostało N > 0 — albo
   dokończ, albo zatrzymaj się z listą pozostałych `plik:linia` i uczciwym „N z 136 zrobione,
   reszta opisana”. **Częściowe wykonanie tej pozycji z jawną listą braków JEST wynikiem
   pełnowartościowym** (`§0.5`), pod warunkiem że lista jest kompletna i żaden dodany klucz nie
   ma wartości-kopii EN.

**Wymagany dowód:** `messagerenderer-karty-lista.txt` (pełna, 136 wierszy na starcie) · diff
10 plików komponentów (0 linii logiki, tylko import słownika jeśli w ogóle) · diff dwóch
słowników (do 136 nowych par kluczy) · 10 (lub mniej, jeśli STOP częściowy) plików testowych,
każdy zielony · wynik skryptu PO (docelowo `0`) · lista pozostałych, jeśli STOP częściowy.
**Commit po `R5`** (dopuszczalne commity cząstkowe co kilka plików, każdy z działającymi testami
dla TYCH plików — nie jeden gigantyczny commit na końcu).

## R6 — BEZPIECZNIK ETYKIET, BASELINE OSIĄGALNOŚCI, WARUNKI KOŃCOWE, RAPORT

1. **Bezpiecznik etykiet.** Już zmierzone w `R1`/`§0.3` (14): domyślny zakres
   `check-etykiety-dwujezyczne.mjs` (`DiscoveryTools`+`toolPacks`) NIE obejmuje `AIChat`/`canvas`.
   Rozszerz `roots` (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i
   `path.join(repoRoot, 'src/utils/canvas')`. Uruchom bez argumentów i zmierz nowe
   `zbadane pliki=`/`ternary=` — jeżeli wzrosły ponad `baseline.minFiles`/`minTernaries`, PODNIEŚ
   te progi w `check-etykiety-dwujezyczne.baseline.json` do realnie zmierzonej wartości (nigdy w
   dół). Jeżeli `nieuzasadnione-identyczne` > 0 po rozszerzeniu (np. `CanvasArtifactSwitcher.tsx`
   ma bare-variable ternary `pl ? 'x' : 'y'`, który MOŻE nie pasować do dzisiejszego regexu —
   sprawdź komendą, nie zgaduj) — to jest osobny defekt do opisania, NIE naprawiasz kodu produktu
   w tej pozycji poza tym, co już zrobiłeś w `R2`-`R5`.
2. **Baseline osiągalności.** Policz swoje własne nowe pliki testowe (z `R2`-`R5`, ścieżka
   `src/components/AIChat/__tests__/day372-*.i18n.test.tsx`). Otwórz
   `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json`, dopisz RĘCZNIE (edytorem,
   nie przez `--update-baseline`, które odmówi — patrz `§0.3` komenda 13) każdą nową ścieżkę do
   tablicy `testOnlyFiles`. Uruchom `node scripts/dev/reachability-from-root.mjs --check-baseline`
   — oczekiwany wynik: DALEJ `exit 1`, z DOKŁADNIE tymi samymi 3 nazwami sprzed dyżuru w komunikacie
   (Twoje własne pliki mają zniknąć z listy „nowych”, bo są już w baseline). Jeżeli lista ma więcej
   niż 3 pozycje — brakuje wpisu, dopisz.
3. **Warunki wspólne serii, pomiar PO** — powtórz bloki (a)-(d) z sekcji „WARUNKI WSPÓLNE SERII”
   i wklej wynik obok PRZED.
4. **Raport** (`CODEX_DAY372_I18N_CZAT_REPORT.md`) zawiera: tabelę mianowników PRZED/PO (250 →
   docelowo 0, lub mniej z jawną listą braków) · listę wszystkich nowych kluczy per plik (link do
   `evidence/i18n-czat/`) · dowód mutacyjny dla co najmniej JEDNEGO przykładu z każdej z pozycji
   `R2`-`R5` (przed: `container.textContent` zawiera angielski string; po: nie zawiera) · sekcję
   „KOREKTY WOBEC AUDYTU” (canvas.versionHistory już naprawione; „7 kluczy” → 58 pełnego mianownika;
   „~40” → 250) · **niepustą sekcję „TWIERDZENIA NIEZWERYFIKOWANE”**.
5. ★★ **Osobna, obowiązkowa sekcja „CO NADAL WYMAGA OSOBNEGO ZLECENIA”:** każde wystąpienie tego
   samego wzorca (`t(klucz, fallback)` z brakującym kluczem, LUB literał bez `t()`) znalezione
   PRZEZ TWÓJ skan POZA 30-plikową rodziną tego dyżuru — z `plik:linia`, bez naprawy.
6. ★★ **Osobna, obowiązkowa sekcja „PYTANIA DO WŁAŚCICIELA”:** czy panel „workflow ledger”
   (`WorkCanvasDocumentPanel.tsx:4692-4906`, za `VITE_DEV_DIAGNOSTICS` OFF) ma być kiedykolwiek
   przetłumaczony, czy zostaje diagnostyką wyłącznie po angielsku na stałe — **tak/nie**. Sekcja
   nie może być pusta.
7. Zanim dopiszesz sekcję do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę komendą
   `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
   **tuż przed commitem** (mój pomiar przy pisaniu tej instrukcji: ostatnia = `AF`, więc wolna =
   `AG` — ale sprawdź sam, równolegle piszą inni autorzy paczki 367-373).

**Wymagany dowód:** diff `check-etykiety-dwujezyczne.mjs` + `.baseline.json` z uzasadnieniem liczb ·
diff `reachability.baseline.json` (tylko dodane linie) + wynik `--check-baseline` PO ·
warunki wspólne PRZED/PO obok siebie · raport kompletny wg listy wyżej. **Commit po `R6`.**

## Próg odbioru

**Mianownik 250 (lub Twój zmierzony) potwierdzony w `R1` z odtwarzalnym skanem; klasa (b) (43
miejsca: pasek kanwy + `ToolsMenu` + `window.confirm`) i klasa (a) menu AI (13 kluczy) naprawione
w 100%, z testem renderującym prawdziwy komponent w `pl` i dowodem mutacyjnym przed/po; klasa (a)
nagłówka/historii/SystemHealth (58 kluczy, `R4`) i sweep `MessageRenderer`+karty (136, `R5`)
wykonane w całości ALBO zatrzymane z jawną, kompletną listą braków; zero nowego klucza z wartością
PL identyczną z EN bez uzasadnienia; bezpiecznik etykiet objął `AIChat`/`canvas` LUB zmierzone
i opisane dlaczego nie; `reachability` nie pogorszony ponad pre-istniejące 3 pozycje; liście
słowników wzrosły dokładnie o liczbę faktycznie dodanych kluczy, symetrycznie w obu językach.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test czyta plik źródłowy przez `readFileSync`
zamiast wywołać resolver/renderować komponent; którakolwiek nowa wartość PL jest kopią EN bez
uzasadnienia; naprawiono próbkę zamiast całej zmierzonej rodziny bez jawnego STOP-u i listy braków;
zmieniono logikę handlera/warunku poza samą zamianą literału na `t()`; dotknięto
`canvas.versionHistory.*` mimo że była już naprawiona; `reachability`/`check-etykiety` pogorszone
bez odnotowania.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „klasa (b) i mniejsza klasa (a)
naprawione w 100% z testami; `MessageRenderer`+karty zrobione dla 6 z 10 plików z trafieniami
(98 z 136 kluczy), reszta opisana z `plik:linia`” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na starym markerze. Wynik ponownego sprawdzenia wklejasz do raportu
z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nowy tekst widoczny dla użytkownika = flaga OFF” (`Z11`) vs „napraw i18n bez flagi” | `POZYCJE_Z_FLAGAMI`: to jest naprawa potwierdzonego defektu (angielski tam, gdzie miał być polski), nie nowy element wizualny — `Z11` dotyczy NOWYCH ekranów/komponentów, nie poprawki tekstu istniejącego |
| „Dodaj klucz do słownika” vs „nie zmieniaj wartości istniejących” | Tabela licencji: WYŁĄCZNIE dopisywanie nowych kluczy; istniejące klucze (np. `aiChat.newChat`, `canvas.versionHistory.*`) zostają nietknięte |
| „Nowe testy do `tests/`” (doktryna ogólna) vs „kładziesz w `src/components/AIChat/__tests__/`” | `SCIEZKI`: udokumentowany wyjątek TEGO katalogu — 74 istniejące pliki już tam są, w tym dokładnie ten wzorzec (`day179`); potwierdzone w `reachability.baseline.json` |
| „`reachability` ma kończyć się 0” (ogólna zasada) vs „PRZED tym dyżurem już jest 1” | Warunki wspólne serii, blok (c): wyjątek udokumentowany — mierzysz NIE POGORSZENIE (te same 3 nazwy PRZED i PO), nie zero |
| „Napraw całą rodzinę 136 kluczy (`R5`) / 58 kluczy (`R4`)” vs „realistyczny czas jednego dyżuru” | `R4` punkt 5 i `R5` punkt 5: dopuszczalne zatrzymanie częściowe z jawną, kompletną listą braków — to jest wynik, nie porażka |
| „`labelPl` już istnieje, użyj go” vs „nie zmieniaj logiki” | `R3`: kopiujesz WARTOŚĆ `labelPl` do słownika, nie zmieniasz kodu, który go definiuje ani linii renderującej |
| „Popraw `window.confirm`” vs „nie zmieniaj logiki usuwania” | `R4` punkt 2: zmieniasz WYŁĄCZNIE argument `window.confirm` (tekst), nie warunek/efekt po potwierdzeniu |
| „Przetłumacz kebab kanwy w całości” (sugestia audytu) vs „workflow ledger to diagnostyka dev” | Tabela licencji + `R6`: workflow ledger NIETYKALNE, pytanie do właściciela zamiast tłumaczenia na spekulację |
| „Rozszerz zasięg bezpiecznika etykiet” vs „bezpiecznik nietykalny (`Z12`/`Z18`)” | Tabela licencji: WĄSKA licencja na dopisanie do `roots`, jawnie przyznana w `R6`, bo to inny plik niż `Z18`-owe `tests/setup.ts`/`vitest.config.ts` |
| „`--update-baseline` naprawi reachability” vs „skrypt odmawia przy wzroście” | `R6` punkt 2 + `§0.3` komenda 13: ręczna edycja JSON, nie automat |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkich 10 plików produktu (4 w `R2`, 1 w `R3`, 5 w `R4`) + 19 sprawdzonych w `R5` (10 z trafieniami), `GovernedChatHandoffCard.day179.i18n.test.tsx` (wzorzec, istnieje), `reachability.baseline.json`, `check-etykiety-dwujezyczne.mjs`+`.baseline.json` sprawdzone bezpośrednio; nowe pliki (`evidence/i18n-czat/**`, `src/components/AIChat/__tests__/day372-*.i18n.test.tsx`, raport) jawnie oznaczone jako NOWE |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy, wszystkie 14 komend `§0.3` uruchomione osobiście na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — słownik PL/EN · 5 grup plików klasy (b)/(a) · testy · bezpiecznik etykiet + baseline · baseline osiągalności · rejestr · raport · infrastruktura testów (odczyt) · `server/src/**` (odczyt, brak tras tył) · macierz (odczyt) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2`-`R4` dotykają wyłącznie własnych plików, `R5` mechaniczny (dodawanie kluczy, zero logiki), `R6` administracyjny |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6443/5583 wolne (`lsof` przy wydaniu), zero kontenera `cx-day372-*`, zero gałęzi/worktree; rodzeństwo 367-371/373 ma rozłączne porty i tematy (inne moduły) |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera, w tym skrypt Pythona zapisany do pliku tymczasowego |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: `t()` cichy fallback, `labelPl` martwy, klucz-istnieje-nie-znaczy-przetłumaczony, `BlockHeader` 6×, dataset-actions 2×, workflow ledger dev-only |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
