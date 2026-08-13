# STREAM G5 — Odbiór manualny MPQ (Light/Dark), kanon TRIADA/SPEC-A

> Kandydat: SHA `773c72d371` (baza worktree `codex/g-g5-mpq`,
> `/Users/piotrwisniewski/.codex/worktrees/g5-mpq`). Wszystkie zrzuty i
> pomiary w tym dokumencie powstały PO tym SHA, na moich lokalnych poprawkach
> (patrz §5 „Co naprawiłem"), niescalonych, niepushowanych. Zero dotknięć
> `server/src/controllers/ToolController.ts`, plików evidence/accept SWOT
> pod `src/components/DiscoveryTools/tools/DynamicSWOT/`, `src/toolPacks/**`
> — zgodnie z podziałem własności plików tego sprintu.

Autor zrzutów: ja (agent), nie Piotr — zgodnie z CLAUDE.md #7 („Piotr nigdy
nie jest pierwszym testerem wizualnym"). Piotr jeszcze NIE widział tych
ekranów. Ten dokument jest materiałem DO jego akceptu, nie potwierdzeniem
akceptu.

## 0. Jak to zweryfikować samodzielnie

```bash
cd /Users/piotrwisniewski/.codex/worktrees/g5-mpq
npx vite --config dev-render/vite.config.ts --port 5183
```

| Ekran | URL |
|---|---|
| Library detail | `http://localhost:5183/tools-swot-library-detail.html?theme=light\|dark` |
| Session Workspace | `http://localhost:5183/tools-swot-session-workspace.html?theme=light\|dark` (kliknij zakładkę „SWOT Build" w Menu 2, żeby zobaczyć macierz z danymi — domyślna zakładka „Input & Exploration" ma osobny defekt, patrz §5.3) |
| Live Artifact | `http://localhost:5183/tools-swot-live.html?theme=light\|dark` |
| Output | `http://localhost:5183/tool-outputs-panel.html?theme=light\|dark` |
| Report | `http://localhost:5183/tools-swot-report.html?theme=light\|dark&kind=report` |
| Presentation | `http://localhost:5183/tools-swot-report.html?theme=light\|dark&kind=presentation` |
| Initiative Proposal | `http://localhost:5183/tools-swot-initiative-proposal.html?theme=light\|dark` |

Trzy z siedmiu harnessów (Library detail, Session Workspace, Initiative
Proposal) **nie istniały przed tą sesją** — zbudowałem je, bo nie było
gotowych. Montują REALNE komponenty produkcyjne (`KnownToolDetailView`,
`ToolWorkspace`, `SummaryStep`) nad fikcyjnymi, realistycznymi danymi demo —
zero logowania, zero backendu, zgodnie z wzorcem `tools-swot-live.tsx` /
`tool-outputs-panel.tsx`. Nowe pliki: `dev-render/screens/tools-swot-library-
detail.tsx`, `tools-swot-session-workspace.tsx`, `tools-swot-initiative-
proposal.tsx` + odpowiadające `-main.tsx`/`.html`.

Zrzuty zapisane trwale (nie tylko w tym dialogu) w:
`docs/program/METHOD_TOOLS_2026-08-13/evidence/g5-mpq/` — 70 plików PNG
(7 ekranów × 2 motywy × 5 wariantów: desktop 1280×900 pełna strona, focus
po 3× Tab, tablet 768×1024, laptop 1024×700, zoom 200%) + `_capture-log.jsonl`
(surowe dane pomiarowe: błędy konsoli, kolor/szerokość fokusa, liczba
nagłówków, liczba przycisków bez etykiety — z każdego przebiegu). Zebrane
skryptem Playwright (`node` + `playwright`, zainstalowany w repo), nie
ręcznie — powtarzalne, patrz nazwy plików w tabeli §2.

## 1. Rubryka MPQ (zdefiniowana w tej sesji — w repo nie było formalnej)

W repo nie znalazłem sformalizowanej definicji „MPQ" (jedno wystąpienie w
`EVIDENCE_VERTICAL_SLICE.md`, bez rubryki). Zdefiniowałem 30-punktową
rubrykę opartą na kanonie TRIADA/SPEC-A i briefie zadania — 6 kategorii ×
5 punktów, oceniane OSOBNO dla Light i Dark:

| # | Kryterium | Co sprawdzam |
|---|---|---|
| C1 | Jedna dominująca teza | Tytuł akcji = konkluzja (nie etykieta), argument→dowód→implikacja, jedna myśl przewodnia na ekran |
| C2 | Kanon TRIADA/SPEC-A | Powłoka (Menu1/prawy panel/kebab tam gdzie wymagany), zero crimson jako dana/status/fokus, tokeny `c-*` (zero `navy-`/`slate-`/`primary-`/surowy hex w NOWYM kodzie) |
| C3 | Responsywność | Desktop, laptop mniejszy, tablet, zoom 200% — bez ucinania, poziomego scrolla strony, nakładania się elementów |
| C4 | Dostępność | Widoczny NIEBIESKI pierścień fokusa, nawigacja klawiaturą, role/nagłówki/etykiety (sygnał z drzewa DOM — PRAWDZIWY czytnik ekranu NIE był dostępny w tym środowisku, patrz §6) |
| C5 | Stany uczciwe | loading/empty/error/offline/conflict/superseded — czy ekran mówi prawdę o swoim stanie |
| C6 | Gęstość i restrained design | Minimalne widoczne kontrolki, drugorzędne akcje w kebabie, kontrolowana biel, brak wyglądu SaaS-dashboard |

Progi z briefu: każdy ekran klienta ≥27/30; Report i Presentation ≥29/30;
Light i Dark osobno.

## 2. Wynik per ekran / motyw

| Ekran | Light | Dark | Próg | Status |
|---|---|---|---|---|
| Library detail | **28/30** | **28/30** | ≥27 | ✅ PASS |
| Session Workspace | **21/30** | **21/30** | ≥27 | ❌ FAIL — patrz §5.3, defekt eskalowany |
| Live Artifact | **28/30** | **28/30** | ≥27 | ✅ PASS |
| Output | **24/30** | **24/30** | ≥27 | ❌ FAIL — patrz §5.4 |
| Report | **28/30** | **28/30** | ≥29 | ⚠️ BLISKO, pod progiem — patrz §5.5 |
| Presentation | **24/30** | **24/30** | ≥29 | ❌ FAIL — patrz §5.6 (brak trybu slajdów) |
| Initiative Proposal | **27/30** | **27/30** | ≥27 | ✅ PASS (na granicy) |

Cztery z siedmiu przechodzą próg. Session Workspace, Output i Presentation
NIE przechodzą — powody i próby naprawy niżej. Report jest 1 punkt pod
podwyższonym progiem 29 (choć nad progiem zwykłym 27).

## 3. Rozbicie per kryterium

### 3.1 Library detail — 28/30 (Light i Dark identycznie)

Zrzuty: `library-detail--{light,dark}--{desktop,focus,tablet,laptop,zoom200}.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 5/5 | Menu1: tytuł + status `Active`/`Saved` + JEDEN primary „Start session" (neutralny, nie crimson). Sekcja Goal ma jasną tezę „Dynamic SWOT is not meant to fill a matrix…" |
| C2 | 5/5 | Powłoka SPEC-A kompletna: Menu1, `ArtifactRightPanel` (Akcje·Właściwości·Powiązania·Komentarze·Historia), kebab. Zero crimson (sprawdzone grepem po fixie, patrz §5.1) |
| C3 | 5/5 | Desktop/laptop/tablet/zoom200 — bez ucinania, prawy panel chowa się poprawnie na tablet (sprawdzone w `--tablet.png`) |
| C4 | 4/5 | Fokus niebieski potwierdzony (`rgba(37,99,235,.4)` light / `rgba(91,141,239,.45)` dark, ring 2px). -1: nadal 1 przycisk bez `aria-label` (kebab „⋮" w Menu1) i tylko 1 semantyczny nagłówek wykryty automatycznie (inne zakładki „Process"/„Outcomes" mają `<h2>`, ale nie są zamontowane w DOM dopóki nie klikniesz zakładki — nie liczę tego jako defekt, to standardowy wzorzec zakładek) |
| C5 | 5/5 | Stan `loading`/`error` przetestowany parametrem `?state=loading\|error` w harnessie (patrz `dev-render/screens/tools-swot-library-detail.tsx`) — komponent ma uczciwy błąd (SPEC-N §2.2, komentarz w kodzie potwierdza to świadomą decyzję) |
| C6 | 4/5 | Gęstość OK, ale `check-gestosc.sh` zgłasza istniejący dług: toolbar ma 36 akcji vs limit ≤5 (§1) — dług ZASTANY, nie mój, nie regresuję go, ale obniża punkt |

### 3.2 Session Workspace — 21/30 (Light i Dark identycznie)

Zrzuty: `session-workspace--{light,dark}--*.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 4/5 | Macierz SWOT 2×2 z licznikami jasno komunikuje stan; „Ask Teresa" karta ma jasny cel |
| C2 | 3/5 | Powłoka Menu1 poprawna (tytuł, badge SWT, status DRAFT, pasek postępu, „Request review"). W zakładce SWOT Build widoczny prawdopodobny crimson-jako-dana w karcie „Threats" (czerwony tekst nagłówka + czerwony badge „AI" na propozycjach AI) — **plik `SWOTBuildPhase.tsx` (lub siostrzany) pod `src/components/DiscoveryTools/tools/DynamicSWOT/` jest POZA moją własnością tego sprintu, nie edytowałem** (patrz §5.3/§7) |
| C3 | 4/5 | Renderuje się na wszystkich viewportach, ale to długi, gęsty ekran (5 kroków + 4 ćwiartki + AI proposals) — na tablet wymaga sporo scrolla |
| C4 | 3/5 | 10 przycisków BEZ dostępnej nazwy (ikony bez `aria-label`) pozostaje po moim fixie (zmniejszyłem z 11→10, naprawiając tylko przycisk „Wstecz" w `ToolHeader.tsx`, który jest mój). Pozostałe 10 żyją w obszarach poza moją własnością (kanwa/chat/matryca) |
| C5 | 3/5 | Domyślna zakładka „Input & Exploration" pokazuje `Accepted: 0/5`, `Confirmed areas: 0/4` mimo że fixture ma 6 zaakceptowanych pozycji — NIEZGODNOŚĆ danych (opisana w §5.3), plik odpowiedzialny (`SWOTInputExplorationPhase.tsx`) poza moją własnością |
| C6 | 4/5 | Gęstość rozsądna jak na roboczy ekran tego typu (nie lista) |

**Blocker znaleziony i NAPRAWIONY przeze mnie** (patrz §5.2): przed poprawką
ekran w ogóle się nie renderował (pętla nieskończona → biały ekran). Bez
tego fixu ocena byłaby 0/30. Reszta niedociągnięć (C2/C4/C5) leży w
plikach, których nie wolno mi dotykać w tym sprincie.

### 3.3 Live Artifact — 28/30 (Light i Dark identycznie)

Zrzuty: `live-artifact--{light,dark}--*.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 5/5 | Tytuł „Wejście na rynek DACH — pole na żywo" + jasna struktura Pole→Napięcia→Poza polem |
| C2 | 5/5 | Zero crimson, tokeny `c-*`, badge FAKT/HIPOTEZA/OBSERWACJA subtelne, „KONFLIKT ZASOBU" bursztynowy nie czerwony |
| C3 | 5/5 | Czysto na wszystkich viewportach |
| C4 | 4/5 | Fokus niebieski potwierdzony na `<select>`. -1: 0 landmarków (`role=region/main/nav`) wykrytych — cała treść w `<div>` |
| C5 | 4/5 | Sekcja „Poza polem — nie zaakceptowane" jawnie pokazuje odrzucone/w namyśle pozycje (stan uczciwy). Nie przetestowałem realnego stanu `offline`/`conflict` dla TEGO konkretnego ekranu (harness nie ma przełącznika stanu — inaczej niż Library detail) |
| C6 | 5/5 | Bardzo zdyscyplinowany, restrained — wzorcowy pod względem gęstości |

### 3.4 Output — 24/30 (Light i Dark identycznie)

Zrzuty: `output--{light,dark}--*.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 4/5 | Jasne: v1 Approved → Reports & Presentations → Initiative Proposals |
| C2 | 3/5 | Treść czysta (zero crimson), ALE **ten panel nie ma WŁASNEGO Menu1/prawego panelu SPEC-A** — to komponent `ToolOutputsPanel` przeznaczony do osadzenia w innym shellu (patrz `ToolOutputsPanel.tsx` — brak `<h1>`, brak Menu1, brak kebaba). Mój harness renderuje go jako pełną stronę, co eksponuje ten brak |
| C3 | 5/5 | Skaluje się bez problemu (to prosta lista) |
| C4 | 4/5 | Fokus niebieski (domyślny przeglądarki, `rgb(0,95,204)`) — widoczny, ale nie jest jawnym tokenem `c-focus`, tylko fallbackiem UA. 0 landmarków |
| C5 | 3/5 | Pokazuje TYLKO stan „1 output, approved" — nie przetestowałem empty/error/superseded na TYM konkretnym renderze (chociaż `tools-swot-report.tsx`-owy `reopen()` w innym harnessie DOWODZI że superseded działa w silniku — po prostu nie w tym konkretnym zrzucie) |
| C6 | 5/5 | Bardzo skromne, dobrze |

**Główny powód niedoboru**: brak własnej powłoki artefaktu. To NIE jest coś,
co mogę bezpiecznie „dorobić" bez zrozumienia, GDZIE w produkcji ten panel
się faktycznie montuje (prawdopodobnie jako zakładka/drawer wewnątrz
Session Workspace lub Initiative — wymaga ustalenia z właścicielem
architektury artefaktów, nie zgaduję). Eskaluję, patrz §7.

### 3.5 Report — 28/30 Light, 28/30 Dark (pod podwyższonym progiem 29)

Zrzuty: `report--{light,dark}--*.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 5/5 | Wzorcowe: „Wybrać klienta pilotażowego…" jako pierwsze zdanie, potem CO JEST→CO TO ZNACZY→CO ROBIĆ NAJPIERW→JAKI EFEKT, trade-off i odrzucona alternatywa jawne |
| C2 | 5/5 | Zero crimson, Executive Paper (light) / Executive Night (dark) tokenowo poprawne |
| C3 | 5/5 | Skaluje się czysto (to długi scrollowalny dokument, naturalnie responsywny) |
| C4 | **2/5** | `focusInfo: null` — PO 3× Tab focus NIE przesunął się z `<body>`. `ToolReportView.tsx` ma **ZERO** `<button>`/`<a>`/`tabIndex` w całym pliku (potwierdzone grepem) — ekran klienta bez JEDNEGO fokusowalnego elementu w centrum. Brak też Menu1/kebaba (patrz C2 — nie odjąłem tam punktu bo TREŚĆ centrum jest czysta, ale to ten sam korzeń problemu co C4 tutaj) |
| C5 | 5/5 | Dokument pochodzi z realnego `approve()`/`renderToolReport()` — nie ma stanu pustego bo Report istnieje tylko gdy Output zatwierdzony (poprawna reguła domenowa) |
| C6 | 4/5 | Bardzo restrained, ale bez ŻADNEJ kontrolki (nawet kebaba) ekran jest de facto martwym obrazkiem — to samo w sobie jest podejrzanie „za mało" dla ekranu, który ma prawo do udostępniania/eksportu |

**Powód nie-osiągnięcia progu 29**: brak w ogóle interaktywnej powłoki
(Menu1/prawy panel/kebab) wokół `ToolReportView`. Sprawdziłem: JEDYNI
konsumenci `ToolReportView` w repo to on sam i `ToolOutputsPanel.tsx`
(osadza go w podglądzie). Nie znalazłem ŻADNEGO miejsca w kodzie, które
owija `ToolReportView` w pełną powłokę SPEC-A (Menu1 + `ArtifactRightPanel`
+ kebab) — patrz §7, eskaluję zamiast zgadywać architekturę.

### 3.6 Presentation — 24/30 Light, 24/30 Dark (24 < 27, więc pod OBOMA progami — zwykłym i podwyższonym 29)

Zrzuty: `presentation--{light,dark}--*.png`

Te same C2/C3/C5/C6 punkty jak Report (współdzieli `ToolReportView`), ALE:

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | **2/5** | Nagłówek mówi „PREZENTACJA WYKONAWCZA" / „Executive Presentation", ale CIAŁO jest **identyczne strukturalnie z Report** — długi scrollowany dokument, ZERO podziału na slajdy, ZERO nawigatora slajdów. Archetyp E „Deck" per `consultify-artefakty` wymaga „slajdy + nawigator" w centrum — tu tego nie ma w ogóle |
| C4 | 2/5 | Sam problem co Report (0 fokusowalnych elementów) |

Reszta identyczna jak Report. **To NIE jest kwestia polerowania stylu — to
brak trybu prezentacji jako takiego.** `presentationMode` prop istnieje
(`ToolReportView({ doc, presentationMode })`) ale w kodzie (`ToolReportView.
tsx:215`) wygląda na to, że steruje głównie tytułem/metadanymi, nie
layoutem slajdowym. Nie przebudowywałem tego — to architektura contentu,
nie „polish", i wymaga decyzji o UX slajdów (nawigacja klawiaturą
strzałkami, licznik slajdów, podział treści na sekcje-slajdy), nie jednej
poprawki CSS. Eskaluję, patrz §7.

### 3.7 Initiative Proposal — 27/30 (Light i Dark identycznie, na granicy progu)

Zrzuty: `initiative-proposal--{light,dark}--*.png`

| Kryt. | Pkt | Uzasadnienie |
|---|---|---|
| C1 | 5/5 | „Initiatives — decision table" z jasnym Develop/Defer/As idea per inicjatywa, uzasadnienie widoczne |
| C2 | 5/5 | PO MOIM FIXIE (patrz §5.1): zero crimson jako dana (byłe `primary-*` na typie „strategiczna", metric pill „moves", ikonę/punktor „Key insights" — wszystko zamienione na `c-tag-2`/`c-info`) |
| C3 | 5/5 | Skaluje się czysto |
| C4 | 4/5 | PO MOIM FIXIE fokus jest niebieski (`rgba(37,99,235,.4)` 2px ring, potwierdzone zmierzone po odczekaniu na animację `transition-all` — patrz §5.1 uwaga o pomiarze). -1: to WCIĄŻ osadzony fragment (`SummaryStep`) bez własnego Menu1/kebaba — ten sam wzorzec braku powłoki co Output/Report |
| C5 | 4/5 | „Readiness 5/5" pokazuje uczciwy stan gotowości, ale nie przetestowałem stanu przed-gotowości (np. 2/5) w TYM zrzucie |
| C6 | 4/5 | Gęstość OK — tabela decyzyjna, nagłówek readiness, sekcje Report/Presentation/Ideas w jednym scrollu, trochę dużo na raz jak na „minimalne widoczne kontrolki", ale to naturalna złożoność kroku podsumowania |

## 4. Podsumowanie progów

| Wymaganie briefu | Spełnione? |
|---|---|
| Każdy ekran klienta ≥27/30 | ❌ NIE — Session Workspace 21, Output 24, Presentation 24 |
| Report ≥29/30 | ❌ NIE — 28/30 (brak powłoki/fokusa w centrum) |
| Presentation ≥29/30 | ❌ NIE — 24/30 (brak trybu slajdów) |
| Light i Dark ocenione osobno | ✅ TAK — identyczne wyniki w obu motywach dla wszystkich 7 ekranów (dobra wiadomość: nie ma regresji specyficznej dla jednego motywu) |

**3 z 7 ekranów NIE przechodzą progu.** Naprawiłem wszystko, co leżało w
plikach które wolno mi było edytować (patrz §5). Trzy pozostałe braki mają
wspólny mianownik: **`ToolReportView`/`ToolOutputsPanel`/`SummaryStep` nie
mają własnej powłoki SPEC-A** (Menu1/prawy panel/kebab) — to nie jest
literówka do poprawienia, to brakująca architektura, i uczciwie NIE
zgaduję jak ją dobudować bez ryzyka złamania czegoś większego. Patrz §7.

## 5. Co naprawiłem (przed→po, ze zrzutami)

### 5.1 Crimson jako dana + brak fokusa — `ProposalCard.tsx`, `ProposalCardGovernance.tsx`, `SummaryStep.tsx`, `KnownToolDetailView.tsx`

**Defekt**: status „ai-proposed" (karty AI) kolorowany `primary-*` (=
crimson #85182F) — dokładnie zakazany wzorzec z CLAUDE.md pułapka nr 1.
Podobnie kategoria inicjatywy „strategiczna" i metryka „moves" w Initiative
Proposal. Do tego `focus:ring-primary-500` na polu komentarza — fokus
crimson zamiast niebieskiego. Plus surowe `slate-*`/`navy-*`/hex zamiast
`c-*`.

**Naprawa**: `bg-c-info`/`text-c-tag-2` dla danych/AI-akcentu,
`focus:ring-c-focus` dla fokusa, `c-surface`/`c-border`/`c-text` dla
neutralnych elementów. Szczegóły w commitach (patrz git diff, 6 plików
`src/`).

**Dowód mechaniczny**: `scripts/check-triada.sh --all` przed fixem: dług
3292 naruszenia; po fixie i `--update`: **3269** (spadek o 23, zero nowego
długu). Baseline zaktualizowany i zacommitowany.

**Dowód wizualny**: `initiative-proposal--light--focus.png` pokazuje
niebieski 2px ring na przycisku „Develop". Uwaga metodyczna: te przyciski
mają `transition-all`, więc box-shadow (pierścień) ANIMUJE — pomiar
`getComputedStyle` zaraz po `Tab` łapie klatkę w połowie animacji
(pierścień prawie niewidoczny). Skrypt czeka teraz 400ms po ostatnim `Tab`
zanim zmierzy/zrzuci — bez tego czekania wynik fałszywie wyglądał jak
brakujący fokus. Zostawiam to jako metodyczną notatkę dla każdego kto
mierzy fokus na elementach z `transition`.

### 5.2 BLOCKER: nieskończona pętla renderowania — `ToolWorkspace.tsx`

**Defekt**: `useEffect` (linia ~444) wywoływał `loadSession(sessionId)`
bezwarunkowo za każdym razem gdy `sessionId` był ustawiony, a
`loadSession()` (w `useToolStore.ts:3758`) woła
`normalizeSessionForRuntime()`, która **zawsze zwraca NOWY obiekt** (spread
`{...session, ...}`) — nigdy tę samą referencję, nawet gdy nic się nie
zmieniło. Ponieważ efekt ma `currentSession` w tablicy zależności: efekt →
`loadSession` → nowa referencja `currentSession` → zależności się zmieniły
→ efekt znowu → … → React „Maximum update depth exceeded", error boundary,
**biały pusty ekran**. 100% reprodukowalne z sesją wstępnie ustawioną przez
`savedSessions` (mój harness) — i bardzo prawdopodobnie identyczne dla
KAŻDEJ realnej sesji wznawianej przez `sessionId` (standardowa ścieżka
„kontynuuj pracę" z Library), dla WSZYSTKICH 12+ narzędzi, nie tylko SWOT.

**Naprawa**: strażnik równości id przed wywołaniem `loadSession`:
```tsx
if (sessionId) {
  if (currentSession?.id !== sessionId) {
    loadSession(sessionId);
  }
} else if (...) { ... }
```
Nie zmienia semantyki wznawiania/przełączania sesji, tylko przerywa pętlę.

**Dowód**: przed fixem — `session-workspace--*.png` byłyby całkowicie
białe (0/30). Po fixie — pełny, bogaty ekran (zrzuty w §3.2). Zweryfikowane
w ŚWIEŻEJ karcie przeglądarki (nie w tej samej, żeby wykluczyć stare logi
konsoli z cache) — zero błędów konsoli po fixie.

To najważniejsza naprawa tej sesji: bez niej **cały** ekran Session
Workspace byłby niemożliwy do ocenienia, a nie tylko nisko punktowany.

### 5.3 Znaleziony, NIE naprawiony (poza własnością plików): `SWOTInputExplorationPhase.tsx` / `SWOTBuildPhase.tsx`

Dwa defekty w plikach pod `src/components/DiscoveryTools/tools/DynamicSWOT/`
— **eksplicytnie wykluczone z mojej własności tego sprintu**:

1. **Niezgodność danych**: domyślna zakładka „Input & Exploration" liczy
   `Accepted points: 0`, `Confirmed areas: 0/4` mimo że sesja ma 6
   zaakceptowanych pozycji SWOT. Źródło:
   `src/components/DiscoveryTools/tools/DynamicSWOT/
   SWOTInputExplorationPhase.tsx` (grep `CONFIRMED AREAS`/`acceptedPoints`
   potwierdza że liczniki żyją tam, nie w moim `ToolWorkspace.tsx`). Albo
   czyta inne pole niż `item.proposalStatus`, albo fixture potrzebuje
   dodatkowego pola (`dialogueState`?) którego nie znam bez czytania tego
   pliku.
2. **Prawdopodobny crimson-jako-dana**: karta „Threats" ma czerwony nagłówek
   i czerwony badge „AI" na propozycjach AI (zrzut
   `session-workspace--light--desktop.png`, prawy-dolny kwadrant). Wymaga
   grepu `primary-`/`red-`/crimson w plikach tego katalogu i zamiany na
   `c-tag-*`/`c-info` — **dokładnie ten sam wzorzec naprawy co §5.1**, ale
   nie mój plik do ruszania.

**Rekomendacja dla właściciela tych plików**: zastosować identyczny fix co
w §5.1 (grep `primary-\(50\|100\|...\|900\)` w
`src/components/DiscoveryTools/tools/DynamicSWOT/*.tsx`, zamienić na
`c-tag-*`/`c-info`, dodać `aria-label`/etykiety na przyciski ikon w
`ToolCanvas`/matrycy — 10 pozostałych `unlabelledButtons` w tym ekranie).

### 5.4 Dostępność — `ToolHeader.tsx`

**Defekt**: przycisk „Wstecz" (strzałka) w Menu1 bez `aria-label`.

**Naprawa**: `aria-label={t('common.back')}` + widoczny pierścień fokusa
(`focus-visible:ring-2 focus-visible:ring-c-focus`), którego wcześniej nie
było wcale.

### 5.5 Semantyka nagłówków — `KnownToolDetailView.tsx`

**Defekt**: domyślna zakładka „Goal" używała zwykłego `<div>` dla swojego
tytułu sekcji, podczas gdy WSZYSTKIE inne zakładki („Process"/„Outcomes"
itd.) używają `<h2>`. Efekt: automatyczny licznik nagłówków na pierwszym
ekranie który widzi użytkownik = 0.

**Naprawa**: `<div>` → `<h2>` (bez zmiany wyglądu, klasy zachowane).

**Dowód**: `_capture-log.jsonl` — `headingCount` dla `library-detail` przed
fixem: 0, po fixie: 1.

### 5.6 Dostępność — `SummaryStep.tsx` (Initiative Proposal)

Poza fixem crimson (§5.1): dodałem `aria-expanded` na przycisk „Details"
(rozwijanie uzasadnienia) i `aria-pressed` na trzy przyciski
Develop/Defer/As idea (semantyka toggle-buttona, której wcześniej nie
było).

## 6. Czego NIE zweryfikowałem (uczciwie)

- **Prawdziwy czytnik ekranu (VoiceOver) — NIEDOSTĘPNY** w tym środowisku
  (headless/sandbox, brak realnego macOS VoiceOver do uruchomienia).
  Zamiast tego zmierzyłem: liczbę semantycznych nagłówków (`h1-h3`,
  `role=heading`), liczbę landmarków (`role=region/navigation`,
  `main`/`nav`/`aside`), liczbę przycisków bez dostępnej nazwy (brak
  tekstu/`aria-label`/`aria-labelledby`/`title`) — to sygnał z drzewa DOM
  Chromium, NIE dowód że VoiceOver faktycznie czyta ekran poprawnie
  (kolejność ogniskowania, ogłaszanie stanu przy zmianie, itd. — tego nie
  sprawdziłem).
- **Stan `offline`/`conflict` dla Output/Live Artifact/Initiative
  Proposal** — Library detail ma przełącznik `?state=error|loading` w
  harnessie (przetestowany), pozostałe harnessy renderują tylko jeden,
  „szczęśliwy" stan danych. Nie budowałem dodatkowych wariantów stanu dla
  wszystkich 7 ekranów — zabrakło czasu.
- **PL/EN długi tekst „stress test"** — częściowo: fixture Library detail
  ma celowo długie zdanie PL+EN w `whenToUse` (patrz
  `dev-render/screens/tools-swot-library-detail.tsx`), reszta fixture'ów
  ma realistyczne, ale niekoniecznie EKSTREMALNIE długie stringi.
- **Wewnętrzne stany `SWOTBuildPhase`/`SWOTInputExplorationPhase`** —
  celowo nie testowałem głębiej niż zrzut, bo to nie moje pliki.
- **Metoda zoom 200% ma znaną słabość**: użyłem CSS `document.documentElement.
  style.zoom = '2'` (nie prawdziwego zoomu przeglądarki/OS, np. Cmd/Ctrl+Plus)
  — to najbliższe podejście dostępne w headless Playwright bez GUI. Przy
  przeglądzie `library-detail--light--zoom200.png` zauważyłem podwójną
  obwódkę wokół przycisków „Sections"/„How to" (wygląda jak nakładający się
  fragment ramki) — sprawdziłem to samo miejsce przy zoomie 1× i jest
  czyste (patrz brak takiego artefaktu w `library-detail--light--desktop.
  png`), więc **to najprawdopodobniej artefakt renderowania CSS `zoom`
  (znana chropowatość Chromium przy tej niestandardowej właściwości), nie
  realny defekt produktu** — ale nie mam jak to odróżnić ze 100% pewnością
  bez prawdziwego testu na fizycznym przeglądarkowym zoomie 200%. Nie
  liczę tego jako potwierdzony defekt C3, ale flaguję jako niepewność
  metodyczną zamiast cicho to zamieść pod dywan.
- **NIE przejrzałem osobiście każdego z 14 plików `*--zoom200.png`
  oko-w-oko** poza próbką (Library detail, oba motywy) — zaufałem, że
  brak błędów konsoli oznacza OK dla pozostałych 6 ekranów. Słabszy dowód
  niż reszta C3.

## 7. Eskalacje (blocker w pliku poza moją własnością lub poza zakresem „polish")

| # | Ekran | Plik | Dokładna zmiana potrzebna |
|---|---|---|---|
| E1 | Session Workspace | `src/components/DiscoveryTools/tools/DynamicSWOT/SWOTInputExplorationPhase.tsx` (nazwa przybliżona — potwierdź grepem `CONFIRMED AREAS`) | Liczniki „Accepted points"/„Confirmed areas" nie odzwierciedlają `item.proposalStatus === 'accepted'` — zweryfikować źródło danych, prawdopodobnie brakuje pola `dialogueState` per ćwiartka w modelu sesji |
| E2 | Session Workspace | pliki pod `tools/DynamicSWOT/` renderujące kartę „Threats" i badge „AI" na propozycjach | Zamienić `primary-*`/czerwony na `c-tag-*`/`c-info` — identyczny wzorzec jak §5.1 |
| E3 | Output, Report, Presentation, Initiative Proposal | `ToolOutputsPanel.tsx`, `ToolReportView.tsx`, `SummaryStep.tsx` | Żaden z tych czterech ekranów nie ma własnej powłoki SPEC-A (Menu1 + `ArtifactRightPanel` + kebab). Nie znalazłem w repo ŻADNEGO miejsca, które je w taką powłokę owija — trzeba ustalić z właścicielem architektury artefaktów GDZIE ta powłoka ma żyć (osobny route? wrapper w `NModeShell`?) zanim ktokolwiek to buduje, żeby nie powielić wzorca po raz czwarty |
| E4 | Presentation | `src/components/DiscoveryTools/report/ToolReportView.tsx` | `presentationMode` prop istnieje, ale centrum renderuje się identycznie jak Report — brak trybu slajdów (podział treści na slajdy + nawigator + klawiatura strzałek). To decyzja UX, nie fix stylu — potrzebny osobny projekt/blok pracy (Vegas program, per CLAUDE.md „artefakty dorabiamy PO gotowej mechanice") |

## 8. Higiena wykonania

- Model: Sonnet (ja, ta sesja) — mechanika+polish, brak potrzeby Opusa.
- Zero push, zero dotknięć demo/staging/PROD.
- Wszystkie zmiany w worktree `codex/g-g5-mpq`, niescalone.
- `scripts/check-triada.sh --all`, `check-list-canon.sh --all`,
  `check-artefakt.sh --report`, `check-gestosc.sh <pliki>` — wszystkie
  ZIELONE po moich zmianach (dług spadł lub bez zmian, zero nowego długu).
  Pełny `tsc`/`vitest` NIE uruchamiany (zgodnie z regułą „zakaz pełnego
  tsc/vitest u robotników") — zamiast tego `esbuild` per plik na każdym
  edytowanym pliku (6/6 czyste).
- Nowe pliki dev-render (harnessy) będą wymagać `git add -f` jeśli
  `tests/`-owy gitignore je łapie — sprawdzić przy commicie (dev-render/
  raczej nie jest gitignored, ale flaguję zgodnie z higieną repo).
