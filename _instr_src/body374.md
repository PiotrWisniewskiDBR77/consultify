## Po co ten dyżur istnieje

Dyżur 372 (marker `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`) zmierzył mechanicznie całą rodzinę
„angielski w polskim UI” na ekranie „Czat AI” — **250 miejsc**, nie ~40 jak szacował audyt 05.09 —
i uczciwie zameldował **PARTIAL**: naprawił 13 (menu AI edytora, `R3` tamtej instrukcji), zostawił
**237** z pełną, odtwarzalną listą `plik:linia` w `evidence/i18n-czat/`. Ten dyżur jest
**domknięciem** tych 237 pozycji, zmierzonym ponownie na dzisiejszym markerze
`8f60ab998734adcdf61a080f4e1270c3dbdffceb` (który zawiera scalone dyżury 367–373).

**Zmierzone przeze mnie dziś: liczby z 372 się NIE zmieniły.** Żaden z sześciu równoległych dyżurów
tej paczki (367–371, 373) nie dotknął żadnego z plików produktu tej rodziny — 372 sam to
odnotował w swoim „Kolizja z dyżurem 373”, a mój niezależny skan `skan-r4.py`/`skan-r5.py` na
dzisiejszym markerze potwierdza te same sumy: **58** (nagłówek/historia/SystemHealth) i **136**
(`MessageRenderer`+karty). Mianownik do domknięcia: **43** (klasa b) + **194** (klasa a, 58+136) =
**237**.

**Cztery rzeczy, których 372 nie mógł zrobić w swojej licencji, wchodzą dziś do zakresu:**

1. **Pełny sweep klasy (c)** — klucz istnieje w obu słownikach, wartość PL identyczna z EN.
   372 zmierzył 25 kandydatów w `evidence/i18n-czat/klasa-c-podejrzani.txt` i uznał wszystkie za
   uzasadnione (nazwy własne/skróty), plus zostawił 2 niepewne (`aiChat.homeCards.finance.m16.
   {monteCarlo,sensitivity}.addDriver` = „+ driver”) bez potwierdzonego konsumenta. **Ja
   zweryfikowałem dziś dodatkowo**: te 2 klucze są **martwe** (zero konsumentów tej dokładnej
   ścieżki w `src/`) — prawdziwy konsument (`WhatIfSensitivityPanel.tsx:230`,
   `MonteCarloNpvPanel.tsx:231`) woła INNĄ ścieżkę (`finance.m16.*.addDriver`, bez prefiksu
   `aiChat.homeCards.`) w module **Finance/Economics**, poza Czatem AI. **Nie dotykasz żadnego z
   4 kluczy** — dokumentujesz jako dwie osobne obserwacje.
2. **Przeniesienie `canvas.aiMenu.tooLong`.** Kod (`CanvasRichEditor.tsx:79`, wewnątrz
   `requestCanvasQuickAI`) woła `t('canvas.aiMenu.tooLong', '...too long...')`. Tego klucza NIE MA
   w żadnym słowniku. Poprawne polskie tłumaczenie już istnieje — pod BŁĘDNĄ ścieżką
   `initiatives.suggestedChangesPanel.tooLong` (zero konsumentów tej ścieżki — sprawdzone
   `grep`em), gdzie ktoś (najprawdopodobniej autor dyżuru 367, wg śladu w
   `docs/program/waves/WAVE_03_ACCEPTANCE/ODBIOR_367...`) wpisał je omyłkowo. Dziś użytkownik
   zawsze widzi angielski fallback dla tego komunikatu błędu.
3. **Naprawa `TransformationCasesPanel.tsx:114`.** 372 rozszerzył zasięg bezpiecznika etykiet
   (`check-etykiety-dwujezyczne.mjs`) o `AIChat`/`canvas`, odkrył nowy, nieuzasadniony dług
   (ternary `isPolish ? 'Rebaseline' : 'Rebaseline'`), i **wycofał rozszerzenie**, żeby nie złamać
   ratchetu `maxUnjustifiedIdentical` bez licencji na naprawę. Dziś licencja tę naprawę obejmuje.
4. **Zrzuty PL/EN** każdej naprawionej powierzchni przez dev-render (bez logowania Piotra,
   zgodnie z regułą 7 z `CLAUDE.md`), sekcje rozwinięte.

**Decyzja nadzorcy, rozstrzygnięta, nie do przedyskutowania w tym dyżurze:** panel „workflow
ledger” (`WorkCanvasDocumentPanel.tsx:4692-4906`, za `VITE_DEV_DIAGNOSTICS`, default OFF) **zostaje
po angielsku na stałe** — diagnostyka deweloperska, nie funkcja produktowa. 372 zadał to pytanie
właścicielowi; odpowiedź jest „nie tłumaczyć”. Nie pytasz ponownie.

**Decyzja nadzorcy dla jednego konkretnego klucza w R3:** toast `myWork.ideas.sentToWorkspaceToast`
(„Opened in Ideas workspace”, pojawia się po akcji „wyślij do Pomysłów” — zmiana K8 z dyżuru 370)
dostaje polskie brzmienie **dosłownie „Pomysł zapisany, otwieram Moją Pracę”**. Nie wymyślasz
własnego tłumaczenia dla tej jednej pozycji — użyj tego zdania.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| R2 (klasa b) — literały bez `t()` + `window.confirm` | **43** (42+1), BEZ ZMIAN od 372 | `canvasActionAvailability.ts:27-47` (14), `WorkCanvasDocumentPanel.tsx` pending-op `:5158/5166/5173` (3) + dataset `:461-490` (7), `CanvasArtifactBlockRenderer.tsx:240,310,379-500,808-844` (17), `ToolsMenu.tsx:625` (1), `ChatHistorySidebar.tsx:641` `window.confirm` (1) |
| R3 (klasa a) — `t(klucz,fallback)` bez wartości PL | **194** (58+136), BEZ ZMIAN od 372 | `UnifiedChatPanel.tsx` 36, `ChatHistorySidebar.tsx` 7, `ConversationActions.tsx` 5, `MoveToProjectModal.tsx` 7, `SystemHealth.tsx` 3 (=58); `MessageRenderer.tsx` 48 + 9 kart (=136) — `evidence/i18n-czat/skan-r4.py`, `skan-r5.py` |
| R4 (klasa c) — klucz istnieje, PL=EN | **0 potwierdzonych defektów** w rodzinie (25 kandydatów, wszystkie uzasadnione) + **2 klucze martwe** poza rodziną (`addDriver`, konsument w innym module) | `evidence/i18n-czat/klasa-c-podejrzani.txt` (372) + moja dzisiejsza weryfikacja konsumenta |
| R5 — `canvas.aiMenu.tooLong` | **NIE ISTNIEJE** pod właściwą ścieżką; poprawna wartość PL siedzi osierocona pod `initiatives.suggestedChangesPanel.tooLong` (0 konsumentów tej ścieżki) | `CanvasRichEditor.tsx:79` woła; oba słowniki, węzeł `initiatives.suggestedChangesPanel` |
| R6 — `TransformationCasesPanel.tsx:114` | **1 defekt nieuzasadniony**, ternary `'Rebaseline'`/`'Rebaseline'` | odkryty przez 372, nienaprawiony |
| R6 — bezpiecznik etykiet, zasięg domyślny | **4** nieuzasadnione, WSZYSTKIE poza rodziną Czatu AI (SWOT) | `check-etykiety-dwujezyczne.mjs` bez `--zakres`, `roots` = `DiscoveryTools`+`toolPacks` |
| R6 — symulacja zasięgu połączonego (`DiscoveryTools+toolPacks+AIChat+canvas`) | `pliki=448, ternary=789, nieuzasadnione=5` PRZED naprawą pozycji wyżej, **4** PO | moja symulacja dzisiaj, `§0.3` komenda 10 |
| `reachability --check-baseline` | **exit 1, 49 plików PRE-ISTNIEJĄCYCH**, NIEZWIĄZANYCH z Czatem AI (w tym 3 z `AIChat/__tests__/` ale z INNYCH dyżurów) | `§0.3` komenda 13 — **NIE 1 ani 3, jak twierdziły wcześniejsze instrukcje tej paczki** |
| liście słowników PRZED | **pl 35294, en 33154** | `§0.3` komenda 11 — wyższe niż PO-372 (`35213/33080`), bo równoległe dyżury paczki też dopisywały klucze |
| 3 bezpieczniki kanonu | `focus=0, list=0, artefakt=0` | `§0.3` komenda 12 |
| ostatnia litera rejestru | `AM` (dyżur 373) → wolna `AN` | `§0.3` komenda 14, sprawdź SAM tuż przed commitem |

**RAZEM mianownik do naprawy w tym dyżurze: 43 (R2) + 194 (R3) = 237, plus R4 (orzeczenie, nie
naprawa kodu), R5 (1 przeniesienie), R6 (1 naprawa + rozszerzenie bezpiecznika).**

## ★ Zmierz moje liczby sam

Twierdzę, na dzisiejszym markerze: R2 **43** pozycji BEZ ZMIAN od 372; R3 **194** pozycji BEZ ZMIAN
od 372; R4 **0** potwierdzonych defektów w rodzinie + **2** klucze martwe poza rodziną
(`addDriver`); R5 klucz `canvas.aiMenu.tooLong` **nie istnieje**, poprawna wartość PL osierocona pod
`initiatives.suggestedChangesPanel.tooLong`; R6 **1** defekt (`Rebaseline`) + zasięg domyślny
bezpiecznika **4** nieuzasadnione (SWOT, poza rodziną) → po rozszerzeniu i naprawie: **4**
(niezmieniona liczba, inny skład); `reachability` **49** plików PRE-ISTNIEJĄCYCH; liście słowników
**pl 35294 / en 33154**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost w „Korektach wobec instrukcji”.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · SŁOWNIK · TEST · BEZPIECZNIK

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany brief
z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Słownik PL** | `public/locales/pl/translation.json` | **★ DOPISYWANIE nowych kluczy** (`R2`-`R3`, `R5`) wartość polska nie kopia EN + **USUNIĘCIE** WYŁĄCZNIE węzła `initiatives.suggestedChangesPanel.tooLong` (`R5`, ma zero konsumentów). Zakaz zmiany innych istniejących wartości | — |
| **Słownik EN** | `public/locales/en/translation.json` | **★ DOPISYWANIE** tych samych kluczy, wartość = literał angielski już obecny w kodzie jako fallback, + **USUNIĘCIE** analogicznego węzła `tooLong` (`R5`). Zakaz zmiany innych wartości | — |
| **Klasa (b) — pasek kanwy** | `src/utils/canvas/canvasActionAvailability.ts` | **★ WĄSKA LICENCJA:** zamiana 14 wpisów `actionLabels` na `t('canvas.actions.<id>', '<literał>')`; jeśli `t` niedostępne w tym module, funkcja przyjmuje `t` jako parametr wołany z `WorkCanvasDocumentPanel.tsx:3232` — jedyna dopuszczalna zmiana kształtu. Zakaz zmiany `actionGroups`/`availability()` | Brief |
| **Klasa (b) — panel kanwy** | `src/components/AIChat/WorkCanvasDocumentPanel.tsx` | **★ WĄSKA LICENCJA:** 3 literały pending-operation (`:5158,5166,5173`) + 7 `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Naprawiasz JEDNO źródło (renderuje się 2×, `:3767`/`:4264`). Zakaz zmiany handlerów/`outputTargets`/logiki draftów | Brief |
| **Klasa (b) — bloki artefaktów** | `src/components/AIChat/CanvasArtifactBlockRenderer.tsx` | **★ WĄSKA LICENCJA:** 12 `title="..."` w `EvidenceList` (`:379-383,413-416,498-500`), 2 `aria-label={\`...\`}` z interpolacją (`:240,310` — zachowaj zmienną przez `{{placeholder}}`), `BlockHeader` (`:808-844`, wołana z 6 miejsc, naprawiasz raz). Zakaz zmiany `onCopy`/`onExport` | Brief |
| **Klasa (b) — narzędzia** | `src/components/AIChat/ToolsMenu.tsx` | **★ WĄSKA LICENCJA:** linia 625, `>Reset<` → `{t('common.reset', 'Reset')}`. Zakaz zmiany handlera | Brief |
| **Klasa (b) — `window.confirm`** | `src/components/AIChat/ChatHistorySidebar.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE linia 641:** `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)` → klucz `aiChat.confirmDeleteBulk` z `{{count}}`, polska odmiana liczebnika spójna z resztą pliku. Zakaz zmiany logiki usuwania | Brief |
| **Klasa (a) — nagłówek/historia** | `src/components/AIChat/UnifiedChatPanel.tsx`, `ChatHistorySidebar.tsx` (poza linią 641, już opisaną wyżej), `ConversationActions.tsx`, `MoveToProjectModal.tsx` | **★ WĄSKA LICENCJA:** dodanie WSZYSTKICH 55 pozostałych kluczy z `evidence/i18n-czat/header-historia-lista.txt` (58 minus `system.dataAccess`, patrz niżej), w tym `myWork.ideas.sentToWorkspaceToast` = „Pomysł zapisany, otwieram Moją Pracę” (decyzja nadzorcy, dosłownie). Zakaz zmiany logiki usuwania/przenoszenia/RODO-zgody | Brief |
| **Klasa (a) — SystemHealth** | `src/components/SystemHealth.tsx` | **★ WĄSKA LICENCJA:** 3 klucze (`system.demoDataTitle`, `system.demoData`, `system.dataAccess`, linie 118/122/191). Zakaz zmiany reszty komponentu | Brief |
| **Klasa (a) — MessageRenderer + karty** | `src/components/AIChat/MessageRenderer.tsx`, `ArtifactBadge.tsx`, `ExecutionProposalMessage.tsx`, `GovernedInitiativeHandoffCard.tsx`, `ResearchProgress.tsx`, `CitationList.tsx`, `TeresaProposalCard.tsx`, `InlineResponseFeedback.tsx`, `GovernedChatHandoffCard.tsx`, `TrustBadge.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE dopisanie brakującego klucza do obu słowników** dla każdego `t(klucz,fallback)` z `evidence/i18n-czat/messagerenderer-karty-lista.txt` (136 pozycji). Zakaz zmiany JSX poza samym wywołaniem `t()` — klucz już istnieje w kodzie | Brief |
| **Klasa (c) — orzeczenie** | (odczyt wyłącznie: pliki nośniki 25 kandydatów z `klasa-c-podejrzani.txt`) | **TYLKO ODCZYT** — 372 już zmierzył i uzasadnił, Ty POTWIERDZASZ ponownie i dopisujesz orzeczenie dla 2 kluczy `addDriver` (martwe, poza modułem — NIE naprawiasz) | Errata w raporcie |
| **R5 — przeniesienie `tooLong`** | oba słowniki, węzły `canvas.aiMenu` i `initiatives.suggestedChangesPanel` | **★ PEŁNA LICENCJA:** dodaj `canvas.aiMenu.tooLong` (PL = wartość już istniejąca pod złą ścieżką, EN = fallback z kodu), usuń `tooLong` z `initiatives.suggestedChangesPanel` (0 konsumentów, zweryfikowane). `CanvasRichEditor.tsx` **NIE WYMAGA zmiany kodu** — już woła właściwy klucz | Brief |
| **R6 — dług etykiet** | `src/components/AIChat/TransformationCasesPanel.tsx` | **★ WĄSKA LICENCJA, WYŁĄCZNIE linia 114:** `isPolish ? 'Rebaseline' : 'Rebaseline'` → realna polska wartość (np. „Ustal nowy punkt odniesienia” albo zachowany termin z uzasadnieniem w raporcie, wzorem `justification()`) — **NIE** kopia EN. Zakaz zmiany reszty komponentu (przycisk `disabled`, `mutationUnavailable` zostają) | Brief |
| **Bezpiecznik etykiet** | `scripts/dev/check-etykiety-dwujezyczne.mjs` | **★ PEŁNA LICENCJA, `R6`:** rozszerz `roots` (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i `path.join(repoRoot, 'src/utils/canvas')`. Zakaz zmiany regexów `languageCondition`/`ternaryPattern` | Brief |
| **Baseline etykiet** | `scripts/dev/check-etykiety-dwujezyczne.baseline.json` | **★ PEŁNA LICENCJA:** podniesienie `minFiles`/`minTernaries` do realnie zmierzonych wartości PO rozszerzeniu `roots` (nigdy w dół). `maxUnjustifiedIdentical` zostaje na `4`, chyba że Twój pomiar PO naprawie da inną liczbę — wtedy dopasuj zgodnie z Twoim pomiarem, z komendą w raporcie | — |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA:** dopisanie WYŁĄCZNIE ścieżek TWOICH własnych nowych plików testowych do `testOnlyFiles`. Zakaz `--update-baseline`, zakaz usuwania istniejących wpisów (w tym 49 pre-istniejących niezwiązanych), zakaz dotykania `files` | — |
| **Nowe testy** | `src/components/AIChat/__tests__/day374-*.i18n.test.tsx` (NOWE, konwencja katalogu) | **★ PEŁNA LICENCJA.** Wzorce: `GovernedChatHandoffCard.day179.i18n.test.tsx`, `day372-canvasAiMenu.i18n.test.tsx`. `git add -f` | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja, litera sprawdzona komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md` (**NOWY**) | Jedyny nowy dokument rejestrowy | — |
| **`evidence/i18n-czat/**`** | katalog dziedziczony z 372 | **DOPISYWANIE** (nowe pliki tego dyżuru), zakaz kasowania istniejących plików 372 | — |
| **NIETYKALNE — workflow ledger** | `WorkCanvasDocumentPanel.tsx:4692-4906` | **TYLKO ODCZYT.** Rozstrzygnięte przez nadzorcę — zostaje po angielsku | Errata w raporcie |
| **NIETYKALNE — `CanvasAIFloatingMenu.tsx`, `canvas.versionHistory.*`** | odpowiednio | **TYLKO ODCZYT** — 372 już naprawił/potwierdził, brak nowego dowodu defektu | Errata w raporcie |
| **NIETYKALNE — `finance.m16.*`, `Economics/panels/**`** | odpowiednio | **TYLKO ODCZYT** — realny defekt (`+ driver`), ale w innym module, poza tym dyżurem | Brief w „CO NADAL WYMAGA OSOBNEGO ZLECENIA” |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| **`server/src/**`** | wszystko | **TYLKO ODCZYT — CAŁA WARSTWA** | Brief, STOP merytoryczny jeśli potrzebne |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU** | Rekomendacja w raporcie |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow — R2/R3/R5 rosna, R5 jest NETTO ZERO (usuwasz 1, dodajesz 1)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35294, en 33154. PO: PRZED + (liczba kluczy faktycznie
#   dodanych w R2-R3) + 0 netto z R5 (usun 1 + dodaj 1) — ta sama liczba PL i EN,
#   symetrycznie

# (b) trzy bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby PRZED: wszystkie 0. Jezeli PO Twojej zmiany ktorykolwiek sie
#   zaczerwieni — naprawiasz KODEM, nigdy progiem (Z35)

# (c) ★★ reachability — 49 plikow PRE-ISTNIEJACYCH, wyjatek udokumentowany
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: exit 1, "New test-only files (49)" — pelna lista w Stanie
#   zastanym, ZERO zwiazanych z rodzina tego dyzuru poza 3 plikami cudzych
#   dyzurow AIChat (367-371). PO Twojej zmianie (wlasne nowe pliki dopisane do
#   reachability.baseline.json): oczekiwany wynik to DALEJ exit 1, z DOKLADNIE
#   TYMI SAMYMI 49 nazwami — Twoje wlasne nowe pliki NIE MAJA sie pojawic na tej
#   liscie. Jesli lista ma 50+ pozycji — to Twoja regresja, napraw wpis w R2-R6

# (d) bezpiecznik etykiet — PRZED domyslny, PO rozszerzony
node scripts/dev/check-etykiety-dwujezyczne.mjs; echo "etykiety-domyslny-przed=$?"
#   moje liczby PRZED: zbadane pliki=166, ternary=353, nieuzasadnione=4, wszystkie
#   4 w DiscoveryTools/SWOTCorrelationsStep.tsx — ZERO w rodzinie tego dyzuru
#   (uruchamiasz PONOWNIE PO zmianie R6 — patrz R6 dla oczekiwanego wyniku)
```

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | R2 — literałów klasy (b) + `window.confirm` | `43` | `§0.3` komenda 2 | TAK — czyta kod źródłowy wprost, BEZ ZMIAN od 372 |
| 2 | R3 — kluczy klasy (a), pełny mianownik | `194` (58+136) | `§0.3` komenda 3, skrypty `skan-r4.py`/`skan-r5.py` | TAK — BEZ ZMIAN od 372 |
| 3 | R4 — klasa (c), defekty potwierdzone w rodzinie | `0` | `klasa-c-podejrzani.txt` + `§0.3` komenda 5 | TAK — 372 zmierzył, ja potwierdzam ponownie |
| 4 | R4 — klucze martwe/poza modułem, rozstrzygnięte dziś | `2` (`addDriver`) | `§0.3` komenda 6 | TAK — nowy pomiar konsumenta, poza licencją tego dyżuru |
| 5 | R5 — `canvas.aiMenu.tooLong` istnieje pod właściwą ścieżką | `0` → cel `1` | `§0.3` komenda 7 | TAK |
| 6 | R6 — defektów nieuzasadnionych w `TransformationCasesPanel.tsx` | `1` → cel `0` | `§0.3` komenda 8 | TAK |
| 7 | R6 — zasięg domyślny bezpiecznika etykiet PRZED | `4` nieuzasadnione, 0 w rodzinie | `§0.3` komenda 9 | TAK |
| 8 | R6 — zasięg połączony (symulacja) PRZED/PO naprawy | `5` → `4` | `§0.3` komenda 10 | TAK — potwierdź PONOWNIE po realnej zmianie kodu, nie tylko symulacji |
| 9 | `reachability` PRZED | `exit 1`, 49 plików | `§0.3` komenda 13 | TAK — pełny komunikat, nie tylko kod wyjścia |
| 10 | liście słowników PRZED | `pl 35294 / en 33154` | `§0.3` komenda 11 | TAK |
| 11 | RAZEM mianownik dyżuru do naprawy | `237` (R2+R3) | suma wierszy 1+2 = 43+194 | TAK — potwierdź w `R1` własnym sumowaniem |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`public/locales/pl/translation.json` · `public/locales/en/translation.json` ·
`src/utils/canvas/canvasActionAvailability.ts` ·
`src/components/AIChat/WorkCanvasDocumentPanel.tsx` ·
`src/components/AIChat/CanvasArtifactBlockRenderer.tsx` ·
`src/components/AIChat/ToolsMenu.tsx` ·
`src/components/AIChat/ChatHistorySidebar.tsx` ·
`src/components/AIChat/UnifiedChatPanel.tsx` ·
`src/components/AIChat/ConversationActions.tsx` ·
`src/components/AIChat/MoveToProjectModal.tsx` ·
`src/components/SystemHealth.tsx` ·
`src/components/AIChat/MessageRenderer.tsx` i komponenty-karty z trafieniami (do 9) ·
`src/components/AIChat/TransformationCasesPanel.tsx` (WYŁĄCZNIE linia 114) ·
`scripts/dev/check-etykiety-dwujezyczne.mjs` (linia `roots`) ·
`scripts/dev/check-etykiety-dwujezyczne.baseline.json` (progi w górę) ·
nowe pliki `src/components/AIChat/__tests__/day374-*.i18n.test.tsx` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md` ·
`evidence/i18n-czat/**` (dopisanie do istniejącego katalogu).

**Zapisujesz WARUNKOWO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (tylko dopisanie własnych nowych
plików testowych) · `docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna sekcja).

**JAWNIE NIE ZAPISZESZ:** `server/src/**` (CAŁOŚĆ) ·
`src/components/AIChat/CanvasEditor/CanvasRichEditor.tsx` (kod już woła właściwy klucz, zmieniasz
WYŁĄCZNIE słowniki) · `src/components/AIChat/CanvasEditor/CanvasAIFloatingMenu.tsx` (naprawione
w 372) · `src/components/AIChat/CanvasEditor/CanvasVersionHistory.tsx` (rodzina już naprawiona) ·
`WorkCanvasDocumentPanel.tsx` linie `4692-4906` (workflow ledger) ·
`src/components/Economics/panels/WhatIfSensitivityPanel.tsx`, `MonteCarloNpvPanel.tsx` (inny
moduł) · `TransformationCasesPanel.tsx` poza linią 114 ·
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie 16) ·
handlery `onClick`/`onCopy`/`onExport`/logika zapisu draftów/proposals/`Api.*` w KAŻDYM dotkniętym
pliku (zmieniasz WYŁĄCZNIE literał → `t()`) · pliki `evidence/i18n-czat/` z 372 (nie kasujesz).

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day374-i18n-czat-domkniecie
git diff --name-only --cached | tee /private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/staged.txt
bash -c "grep -iE '^server/src/|CanvasVersionHistory\.tsx|CanvasAIFloatingMenu\.tsx|CanvasRichEditor\.tsx|Economics/panels|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE' /private/tmp/cx-day374-i18n-czat-domkniecie-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
git diff --cached -- src/ | grep -c '^[+-]'
```

---

## R0 — TRZY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Test broni ZACHOWANIA prawdziwego resolvera i18next, nigdy tekstu źródła.**
`readFileSync` + `toContain` na pliku `.tsx`/`.ts` jest **zakazany** jako dowód. Wzorzec
obowiązkowy: prawdziwa instancja `i18next` z `fallbackLng:false`, PLUS co najmniej jeden test
renderujący realny komponent. Gotowe wzorce w repo: `GovernedChatHandoffCard.day179.i18n.test.tsx`
(oryginalny) i `day372-canvasAiMenu.i18n.test.tsx` — **kopiujesz KSZTAŁT, nie wynik** (drugi plik
NALEŻY DO TEJ SAMEJ RODZINY, jest już zielony, uruchom go PRZED rozpoczęciem pracy jako dowód, że
środowisko jest sprawne).

**(2) Wartość PL nie może być kopią wartości EN.** Klucz „dodany”, którego polska wartość to
przepisany angielski string, nie jest naprawą. Wyjątek: nazwy własne i skróty techniczne — piszesz
uzasadnienie w raporcie, wzorem `justification()` w `scripts/dev/i18n-pl-audyt.mjs`. Dotyczy też
`TransformationCasesPanel.tsx:114` — „Rebaseline” skopiowane po obu stronach BEZ uzasadnienia jest
dokładnie tym defektem.

**(3) Zakaz rozszerzania zakresu poza rodzinę z tabeli licencji.** Mechaniczny skan `R1` może
znaleźć ten sam wzorzec POZA plikami tego ekranu (np. `finance.m16.sensitivity.addDriver` w
Economics — już potwierdzone jako realny defekt, ale poza modułem). To NIE jest Twoje do naprawy —
zapisujesz `plik:linia` do „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.

**Wymagany dowód:** trzy zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita.

## R1 — KROK 0: PRZEMIAR MIANOWNIKA NA DZISIEJSZYM MARKERZE (bez naprawy)

**To jest pomiar. Nie naprawiasz w tej pozycji.**

1. Uruchom **dosłownie** wszystkie 16 komend z `§0.3` na swoim worktree z dzisiejszego markera.
   Zapisz wynik do `evidence/i18n-czat/skan-374-przed.txt` (NOWY plik — nie nadpisujesz plików
   372, `git add -f`).
2. **Potwierdź lub obal moje twierdzenie: liczby 372 (43+194=237) się nie ruszyły.** Jeżeli Twój
   pomiar się różni — to jest WYNIK (`Z24`), zapisz swoją tabelę od zera, z komendami.
3. **Potwierdź rozstrzygnięcie kluczy `addDriver`** (martwe, konsument w innym module) — komenda 6.
   Jeśli Twój `grep` znajdzie konsumenta ścieżki `aiChat.homeCards.finance.m16.*` w rodzinie tego
   ekranu, którego ja nie znalazłem — to JEST realny defekt tego dyżuru, dopisz do R3.
4. **Zapisz mianownik ostateczny PRZED** w `evidence/i18n-czat/mianownik-374-przed.json`:
   `{"r2": N, "r3": N, "r4_martwe_poza_modulem": N, "r5_brakuje": true/false, "r6_defekt": N, "razem_do_naprawy": N}`.

**Wymagany dowód:** `skan-374-przed.txt`, `mianownik-374-przed.json` w `evidence/i18n-czat/`.
**Commit po `R1`.**

## R2 — KLASA (b): LITERAŁY BEZ `t()` + `window.confirm` — CEL 0 (rdzeń)

1. **`canvasActionAvailability.ts:27-47`** — 14 wpisów `actionLabels` → `t('canvas.actions.<id>',
   '<literał>')`, patrz tabela licencji dla zmiany kształtu funkcji jeśli `t` niedostępne w module.
2. **`WorkCanvasDocumentPanel.tsx`** — 3 literały pending-operation (`:5158,5166,5173`) i 7 etykiet
   `datasetArtifactActions` (`:461-490`) → `t(klucz, literał)`. Jeden obiekt renderuje się 2×
   (`:3767`, `:4264`) — naprawiasz raz.
3. **`CanvasArtifactBlockRenderer.tsx`** — 12 `title="..."` (`:379-383,413-416,498-500`), 2
   `aria-label={\`...\`}` z interpolacją (`:240,310`), `BlockHeader` (`:808-844`, wołana z 6 miejsc).
4. **`ToolsMenu.tsx:625`** — `>Reset<` → `{t('common.reset', 'Reset')}`.
5. **`ChatHistorySidebar.tsx:641`** — `window.confirm(\`Delete ${{ids.length}} conversation(s)?\`)`
   → klucz `aiChat.confirmDeleteBulk` z interpolacją `{{count}}`, polska odmiana liczebnika.
6. **KROK 0 rodziny wewnątrz tej pozycji:** po zmianie uruchom
   `bash -c "grep -rn 'aria-label=\"[A-Z]\|title=\"[A-Z]' src/utils/canvas/ src/components/AIChat/WorkCanvasDocumentPanel.tsx src/components/AIChat/CanvasArtifactBlockRenderer.tsx"` —
   oczekiwany wynik: **0 trafień** poza `t(...)`-owanymi (odsiej fałszywe pozytywy w klasach CSS,
   zapisz co odsiałeś).
7. **Test:** `src/components/AIChat/__tests__/day374-canvasLiterals.i18n.test.tsx` — instancja
   `i18next` (`fallbackLng:false`) w pętli po wszystkich 14+3+7+1 kluczach `canvas.actions.*`/
   `canvas.panel.pendingOperation.*`/`canvas.panel.dataset.*`/`common.reset`, PLUS render
   `WorkCanvasDocumentPanel` (albo najmniejszy wycinek z opisanymi mockami) z asercją, że
   `aria-label` przycisku „Utwórz prezentację” jest POLSKI, nie „Create presentation”. Osobny
   `describe` dla `CanvasArtifactBlockRenderer` (render bloku `research`, `container.textContent`
   zawiera polskie nagłówki `EvidenceList`) i `ChatHistorySidebar` (`vi.spyOn(window, 'confirm')`,
   asercja na PRZEKAZANY string, nie tylko wywołanie).

**Wymagany dowód:** diff pięciu plików produktu (43 pozycje) · wynik grep-u „0 trafień” z pkt 6 ·
test zielony · para „przed: `container.textContent`/`window.confirm` zawiera angielski string” /
„po: zawiera polski”. **Commit po `R2`.**

## R3 — KLASA (a): PEŁNY SWEEP `t(klucz,fallback)` BEZ WARTOŚCI PL — CEL 0, 194 KLUCZE (rdzeń, największa pozycja)

1. Uruchom `evidence/i18n-czat/skan-r4.py` i `skan-r5.py` (dziedziczone z 372), zapisz PEŁNĄ listę
   `plik:linia:klucz:fallback` (jeśli skrypty jeszcze nie drukują każdej pozycji, rozszerz je o
   `print(f'{{rel}}:{{line}}\t{{key}}\t{{fallback}}')` w pętli) do
   `evidence/i18n-czat/skan-374-r3-pelna-lista.txt`.
2. Dodaj **wszystkie 58** brakujące klucze nagłówka/historii/SystemHealth (`UnifiedChatPanel.tsx`,
   `ChatHistorySidebar.tsx`, `ConversationActions.tsx`, `MoveToProjectModal.tsx`,
   `SystemHealth.tsx`) do obu słowników. **`myWork.ideas.sentToWorkspaceToast`** dostaje wartość PL
   dosłownie: **„Pomysł zapisany, otwieram Moją Pracę”** (decyzja nadzorcy — nie parafrazujesz).
   Pozostałe 57 kluczy tłumaczysz naturalnie, spójnie z sąsiednimi kluczami tej samej gałęzi
   słownika (sprawdź rejestr językowy sąsiadów przed wpisaniem).
3. Dodaj **wszystkie 136** brakujące klucze `MessageRenderer.tsx` + 9 kart (`TrustBadge.tsx`,
   `ExecutionProposalMessage.tsx`, `GovernedInitiativeHandoffCard.tsx`, `ResearchProgress.tsx`,
   `CitationList.tsx`, `TeresaProposalCard.tsx`, `InlineResponseFeedback.tsx`, `ArtifactBadge.tsx`,
   `GovernedChatHandoffCard.tsx`) — **nie zmieniasz JSX**, klucz już jest wołany w kodzie, dopisujesz
   WYŁĄCZNIE do słowników.
4. Jeśli w trakcie odkryjesz klucz użyty z RÓŻNYMI fallbackami w różnych miejscach (kolizja nazw) —
   STOP MERYTORYCZNY dla TEGO klucza: zapisz oba miejsca, zaproponuj rozdzielenie jako diff
   nienałożony, idź dalej z resztą.
5. **Kontrola mianownika:** po zakończeniu uruchom PONOWNIE `skan-r4.py` i `skan-r5.py` —
   oczekiwany wynik: **0** dla obu. Częściowe wykonanie z jawną listą braków jest wynikiem
   pełnowartościowym (`Prawo zatrzymania`), pod warunkiem że lista jest kompletna i żaden dodany
   klucz nie ma wartości-kopii EN.
6. **Test — jeden plik per komponent, wzorcem `day179`/`day372`:** dla każdego z 5+10=15 plików
   dotkniętych: instancja `i18next` (`fallbackLng:false`) + pętla po kluczach TEGO pliku, asercja
   `t(klucz) !== klucz`; PLUS render komponentu (minimalnymi, opisanymi mockami) sprawdzający, że
   `container.textContent`/`aria-label` nie zawiera angielskiego fallbacku tego pliku. Jeśli pełny
   render niemożliwy — dozwolone wywołanie samej funkcji/hooka zwracającego etykiety, **opisane w
   raporcie dlaczego**. Dla toastu K8: test renderujący akcję „wyślij do Pomysłów”, asercja że
   wyświetlony toast to „Pomysł zapisany, otwieram Moją Pracę”, NIE „Opened in Ideas workspace”.

**Wymagany dowód:** `skan-374-r3-pelna-lista.txt` (194 wiersze na starcie) · diff 15 plików
produktu (0 linii logiki) · diff dwóch słowników (do 194 nowych par kluczy) · 15 (lub mniej, jeśli
STOP częściowy) plików testowych zielonych · wynik obu skryptów PO (docelowo `0` każdy) · lista
pozostałych, jeśli STOP częściowy. **Commit po `R3`** (dopuszczalne commity cząstkowe co kilka
plików, każdy z działającymi testami dla TYCH plików).

## R4 — KLASA (c): ORZECZENIE POZYCJA PO POZYCJI (bez naprawy kodu poza R6)

1. Otwórz `evidence/i18n-czat/klasa-c-podejrzani.txt` (372). **Potwierdź ponownie** każdą z 25
   pozycji — uruchom skrypt z `R1` dyżuru 372 (patrz `§0.3` komenda z tamtej instrukcji, wzorzec w
   `evidence/i18n-czat/skan-przed.txt`) na dzisiejszym markerze i porównaj listę. Jeżeli lista się
   zmieniła (nowy kandydat, zniknięty kandydat) — zapisz różnicę.
2. **Rozstrzygnij ostatecznie 2 klucze `addDriver`** (`§0.3` komenda 6): zapisz w raporcie sekcję
   „Klucze martwe w rodzinie” — `aiChat.homeCards.finance.m16.monteCarlo.addDriver` i
   `...sensitivity.addDriver`, zero konsumentów w `src/`, **NIE naprawiasz, NIE usuwasz** (usuwanie
   nieużywanych kluczy to inny dyżur — porządki słownika, poza tym zakresem). Zapisz osobno
   „Defekt realny poza modułem”: `finance.m16.sensitivity.addDriver` = „+ driver” w
   `WhatIfSensitivityPanel.tsx:230`, moduł Finance/Economics, do „CO NADAL WYMAGA OSOBNEGO
   ZLECENIA”.
3. Jeżeli mechaniczny skan (rozszerzony na WIĘCEJ prefiksów niż `canvas.`/`aiChat.`/`chat.`/
   `system.`, np. `myWork.`, jeśli Twoje nowe klucze z `R3` wprowadzą jakiś przez pomyłkę) znajdzie
   nowego kandydata klasy (c) w plikach dotkniętych `R2`/`R3` — orzekasz go tu, nie zostawiasz.

**Wymagany dowód:** `evidence/i18n-czat/klasa-c-374-potwierdzenie.txt` (25 pozycji + werdykt +
2 klucze martwe rozstrzygnięte + różnica względem 372 jeśli jest). **Commit po `R4`.**

## R5 — PRZENIESIENIE `canvas.aiMenu.tooLong` (rdzeń)

1. W obu słownikach dodaj węzeł `canvas.aiMenu.tooLong`:
   **PL** = wartość już istniejąca pod `initiatives.suggestedChangesPanel.tooLong`
   („Zaznaczony tekst jest za długi dla tej akcji AI. Skróć zaznaczenie i spróbuj ponownie.” —
   skopiuj 1:1, jest już poprawna po polsku), **EN** = fallback już obecny w kodzie
   (`CanvasRichEditor.tsx:79`, „The selected text is too long for this AI action. Shorten the
   selection and try again.”).
2. **Usuń** węzeł `tooLong` z `initiatives.suggestedChangesPanel` w OBU słownikach (zero
   konsumentów tej ścieżki, zweryfikowane `§0.3` komenda 7) — zachowaj pozostałe klucze tego węzła
   (`title`, `toReview`, `empty`, `accept`, `reject`), one SĄ używane w `SuggestedChangesPanel.tsx`.
3. **`CanvasRichEditor.tsx` NIE WYMAGA zmiany** — już woła `t('canvas.aiMenu.tooLong', ...)` pod
   właściwą ścieżką, brakowało tylko wpisu w słowniku.
4. **Test:** `src/components/AIChat/__tests__/day374-canvasTooLong.i18n.test.tsx` — (a) instancja
   `i18next` (`fallbackLng:false`), `testI18n.t('canvas.aiMenu.tooLong', fallback)` zwraca POLSKI
   tekst, nie klucz i nie fallback EN; (b) wywołaj `requestCanvasQuickAI` (albo funkcję eksportowaną
   z `CanvasRichEditor.tsx`, sprawdź dokładną nazwę eksportu) z tekstem dłuższym niż
   `CANVAS_AI_MESSAGE_MAX_LENGTH`, asercja że zwrócone `errorLine` to POLSKI tekst; (c) render
   `CanvasAIFloatingMenu` z `errorLine` ustawionym na tę dokładną wartość, `requestErrorVisible`
   prawda, asercja że `container.textContent` zawiera polski tekst, NIE „too long for this AI
   action”. To jest DOKŁADNIE wzorzec z `R0` punkt 1 — test asertuje POLSKI tekst w renderze, nigdy
   fallback.
5. Sprawdź `initiatives.suggestedChangesPanel.tooLong` zniknął, a `SuggestedChangesPanel.tsx`
   dalej renderuje się bez błędu (uruchom istniejące testy tego komponentu, jeśli są — `find
   -iname '*SuggestedChangesPanel*test*'`).

**Wymagany dowód:** diff dwóch słowników (1 węzeł dodany, 1 usunięty) · test zielony z trzema
częściami (a)/(b)/(c) powyżej · para „przed: `errorLine` = angielski fallback” / „po: `errorLine` =
polski tekst” · potwierdzenie że `SuggestedChangesPanel.tsx` nie regresuje. **Commit po `R5`.**

## R6 — NAPRAWA DŁUGU + ROZSZERZENIE BEZPIECZNIKA ETYKIET (rdzeń)

1. **Napraw `TransformationCasesPanel.tsx:114` NAJPIERW**, przed zmianą `roots`:
   `isPolish ? 'Rebaseline' : 'Rebaseline'` → realna polska wartość. To jest przycisk `disabled`
   (`mutationUnavailable`) obok „Zatwierdź zakres”/„Poproś o korektę”/„Utwórz rewizję” — dobierz
   tłumaczenie spójne z tym rejestrem (np. „Ustal nowy punkt odniesienia” — Ty decydujesz o
   dokładnym brzmieniu, ale **nie kopiujesz EN** bez uzasadnienia w stylu `justification()`).
2. **Zmierz PO naprawie**, PRZED zmianą `roots`: `node scripts/dev/check-etykiety-dwujezyczne.mjs
   --zakres=src/components/AIChat` — oczekiwany wynik: **0** nieuzasadnionych (był 1). Jeśli nie —
   Twoje tłumaczenie nadal wygląda po angielsku lub trafia w inny wzorzec regexu, popraw.
3. **Rozszerz `roots`** (linia 51) o `path.join(repoRoot, 'src/components/AIChat')` i
   `path.join(repoRoot, 'src/utils/canvas')`. Uruchom bez argumentów:
   `node scripts/dev/check-etykiety-dwujezyczne.mjs`. Zmierz `zbadane pliki=`/`ternary=`/
   `nieuzasadnione=`.
4. **Podnieś `minFiles`/`minTernaries`** w `check-etykiety-dwujezyczne.baseline.json` do realnie
   zmierzonej wartości z pkt 3 (nigdy w dół). Jeżeli `nieuzasadnione-identyczne` z pkt 3 różni się
   od `4` (mój pomiar symulacyjny) — dopasuj `maxUnjustifiedIdentical` do TWOJEGO zmierzonego
   wyniku z komendą w raporcie (nie zgaduj, nie kopiuj mojej liczby bez sprawdzenia).
5. Jeżeli krok 3 ujawni NOWE nieuzasadnione pozycje spoza `TransformationCasesPanel.tsx:114` (np.
   inny plik z bare-variable ternary, którego regex dziś nie łapie poprawnie) — to jest osobny
   defekt do opisania w raporcie, **NIE naprawiasz kodu produktu** w tej pozycji poza tym, co już
   zrobiłeś w `R2`-`R5`+krok 1 tej pozycji.

**Wymagany dowód:** diff `TransformationCasesPanel.tsx` (1 linia) · wynik `--zakres=src/components/
AIChat` PRZED/PO (1→0) · diff `check-etykiety-dwujezyczne.mjs` (`roots`) · diff `.baseline.json`
z uzasadnieniem liczb · wynik domyślnego uruchomienia PO rozszerzeniu. **Commit po `R6`.**

## R7 — ZRZUTY PL/EN, WARUNKI KOŃCOWE, RAPORT

1. **Zrzuty bez logowania Piotra** (zasada 7 z `CLAUDE.md`), przez `dev-render` (wzorzec:
   `dev-render/screens/chat-*.tsx` już istniejące w repo — użyj mocków, nie realnego backendu).
   Dla KAŻDEJ z siedmiu naprawionych powierzchni (pasek kanwy, panel datasetu/pending-operation,
   bloki artefaktów, `ToolsMenu`, nagłówek/historia/`SystemHealth`, `MessageRenderer`+karty,
   komunikat „tekst za długi”) zrób **PL i EN**, z rozwiniętymi sekcjami (nie zwiniętymi — zasada
   „zwinięta sekcja nie jest dowodem”), zapisz do `evidence/i18n-czat/zrzuty-374/<powierzchnia>-
   {pl,en}.png`. Jeśli harness dla którejś powierzchni nie istnieje i zbudowanie go w tym dyżurze
   jest nieproporcjonalne do zadania — opisz to jawnie w raporcie zamiast fabrykować zrzut.
2. Powtórz bloki (a)-(d) z „WARUNKI WSPÓLNE SERII” PO ostatnim commicie, wklej wynik obok PRZED.
3. **Reachability, kontrola końcowa:** `node scripts/dev/reachability-from-root.mjs
   --check-baseline` — oczekiwany wynik: DALEJ `exit 1`, z DOKŁADNIE tymi samymi 49 nazwami z `R1`
   (Twoje własne nowe pliki dopisane do `testOnlyFiles` w baseline, więc znikają z listy „nowych”).
4. **Raport** (`CODEX_DAY374_I18N_CZAT_DOMKNIECIE_REPORT.md`) zawiera: tabelę mianowników PRZED/PO
   (237 → docelowo 0, lub mniej z jawną listą braków) · listę wszystkich nowych kluczy per plik ·
   dowód mutacyjny dla co najmniej JEDNEGO przykładu z każdej pozycji `R2`,`R3`,`R5`,`R6` ·
   sekcję „KOREKTY WOBEC INSTRUKCJI I AUDYTU 372” · **niepustą sekcję „TWIERDZENIA
   NIEZWERYFIKOWANE”**.
5. ★★ **Sekcja „CO NADAL WYMAGA OSOBNEGO ZLECENIA”:** `finance.m16.sensitivity.addDriver` = „+
   driver” w module Finance/Economics (poza zakresem) · dowolny nowy wzorzec znaleziony przez
   Twój skan POZA tą rodziną.
6. ★★ **Sekcja „DECYZJE WYKONANE” (nie pytania — nadzorca już rozstrzygnął):** panel „workflow
   ledger” zostaje po angielsku na stałe · toast K8 = „Pomysł zapisany, otwieram Moją Pracę”.
7. Zanim dopiszesz sekcję do `REJESTR_ZNALEZISK_20260903.md`, sprawdź literę komendą
   `bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
   **tuż przed commitem** (mój pomiar: ostatnia = `AM`, wolna = `AN` — sprawdź sam).

**Wymagany dowód:** katalog `evidence/i18n-czat/zrzuty-374/` z parami PL/EN · warunki wspólne
PRZED/PO obok siebie · raport kompletny wg listy wyżej. **Commit po `R7`.**

## Próg odbioru

**Mianownik 237 (lub Twój zmierzony) potwierdzony w `R1` z odtwarzalnym skanem; R2 (43 pozycje) i
R5 (przeniesienie `tooLong`) naprawione w 100%, z testem renderującym prawdziwy komponent w `pl` i
dowodem mutacyjnym przed/po; R3 (194 klucze) wykonane w całości ALBO zatrzymane z jawną, kompletną
listą braków; R4 (klasa c) ma orzeczenie pozycja po pozycji, w tym rozstrzygnięcie 2 kluczy
`addDriver`; R6 naprawił `TransformationCasesPanel.tsx:114` i rozszerzył bezpiecznik etykiet o
`AIChat`/`canvas` bez naruszenia ratchetu; zero nowego klucza z wartością PL identyczną z EN bez
uzasadnienia; `reachability` nie pogorszony ponad pre-istniejące 49 pozycji; liście słowników
wzrosły dokładnie o liczbę faktycznie dodanych kluczy (R2+R3) plus netto zero z R5, symetrycznie w
obu językach; R7 dostarczył zrzuty PL/EN z rozwiniętymi sekcjami dla każdej naprawionej
powierzchni.**

Odbiorca odrzuci dyżur, w którym: jakikolwiek nowy test czyta plik źródłowy przez `readFileSync`
zamiast wywołać resolver/renderować komponent; którakolwiek nowa wartość PL jest kopią EN bez
uzasadnienia; naprawiono próbkę zamiast całej zmierzonej rodziny bez jawnego STOP-u i listy braków;
zmieniono logikę handlera/warunku poza samą zamianą literału na `t()`; dotknięto plik spoza tabeli
licencji (`Economics/panels/**`, `CanvasAIFloatingMenu.tsx`, workflow ledger); `reachability`/
`check-etykiety` pogorszone bez odnotowania; toast K8 przetłumaczony inaczej niż zdaniem nadzorcy.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R2 i R5 naprawione w 100% z
testami; R3 zrobione dla 12 z 15 plików z trafieniami (167 ze 194 kluczy), reszta opisana z
`plik:linia`” — **jest pełnowartościowym wynikiem**.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: sprawdzasz warunek NA
BIEŻĄCEJ LINII, nie ponownie na dzisiejszym markerze. Wynik ponownego sprawdzenia wklejasz do
raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Nowy tekst widoczny dla użytkownika = flaga OFF” (`Z11`) vs „napraw i18n bez flagi” | `POZYCJE_Z_FLAGAMI`: naprawa potwierdzonego defektu, nie nowy element wizualny — ta sama decyzja co w 372 |
| „Dodaj klucz do słownika” vs „nie zmieniaj wartości istniejących” | Tabela licencji: WYŁĄCZNIE dopisywanie + jedno jawnie licencjonowane USUNIĘCIE w `R5` (0 konsumentów, zweryfikowane) |
| „237 pozycji z 372 się nie ruszyły” vs „mierz sam, nie przepisuj” | `Z24`: podane liczby są MOIM pomiarem na dzisiejszym markerze z komendami — Twój pomiar rozstrzyga, jeśli się różni |
| „Napraw całą rodzinę 194 kluczy (`R3`)” vs „realistyczny czas jednego dyżuru” | `R3` punkt 5: dopuszczalne zatrzymanie częściowe z jawną, kompletną listą braków |
| „Rozszerz zasięg bezpiecznika etykiet” vs „bezpiecznik nietykalny (`Z12`/`Z18`)” | Tabela licencji: PEŁNA licencja na `roots`+`baseline.json`, jawnie przyznana w `R6`, inny plik niż `Z18`-owe `tests/setup.ts` |
| „Napraw `TransformationCasesPanel.tsx:114`” vs „zakaz rozszerzania zakresu poza rodzinę” | `R6` punkt 1: ten JEDEN plik/linia jest w tabeli licencji WYŁĄCZNIE dlatego, że blokuje `R6`, nie jako precedens do dalszego rozszerzania |
| „`addDriver` wygląda po angielsku” vs „nie dotykaj plików poza rodziną” | `R4`: klucze osierocone w rodzinie NIE są naprawiane (brak konsumenta = brak widocznego defektu); realny konsument jest w innym module, poza zakresem |
| „`reachability` ma kończyć się 0” (ogólna zasada) vs „PRZED tym dyżurem już jest 49” | Warunki wspólne serii, blok (c): wyjątek udokumentowany — mierzysz NIE POGORSZENIE (te same 49 nazwy PRZED i PO), nie zero |
| „Przetłumacz kebab kanwy w całości” (sugestia audytu) vs „workflow ledger to diagnostyka dev” | Tabela licencji: workflow ledger NIETYKALNE, ROZSTRZYGNIĘTE przez nadzorcę (nie pytanie) |
| „Toast K8 = decyzja nadzorcy” vs „Ty tłumaczysz naturalnie resztę R3” | `R3` punkt 2: TA JEDNA pozycja ma odgórnie zadane brzmienie, reszta 57 kluczy jest Twoim tłumaczeniem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 10 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie pliki produktu sprawdzone bezpośrednio na `8f60ab9987`, w tym `evidence/i18n-czat/**` dziedziczone (istnieje), `TransformationCasesPanel.tsx:114` (istnieje, zweryfikowany), `canvas.aiMenu.tooLong` (potwierdzone: nie istnieje), nowe pliki jawnie oznaczone jako NOWE |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 11 wierszy, wszystkie 16 komend `§0.3` uruchomione osobiście na dzisiejszym markerze, w tym symulacja zasięgu połączonego bezpiecznika etykiet |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — słownik PL/EN · pliki klasy (b)/(a) · klasa (c) odczyt · R5 przeniesienie · R6 naprawa+bezpiecznik+baseline · testy · rejestr · raport · infrastruktura testów (odczyt) · `server/src/**` (odczyt) · Economics (odczyt, inny moduł) · macierz (odczyt) |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` tylko mierzy, `R2`/`R5`/`R6` dotykają wyłącznie własnych plików, `R3` mechaniczny (dodawanie kluczy), `R4` orzeczenie bez kodu, `R7` administracyjny+zrzuty |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6445/5585 wolne (`lsof` przy wydaniu), zero kontenera `cx-day374-*`, zero gałęzi/worktree; rodzeństwo 367-373 i zarezerwowane 375-377 mają rozłączne porty |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z dzisiejszego markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: 7 wymienionych w `PULAPKA_WLASCIWA_TEMU_MODULOWI`, w tym nowa skala reachability (49, nie 1/3) i zły klucz `tooLong` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
