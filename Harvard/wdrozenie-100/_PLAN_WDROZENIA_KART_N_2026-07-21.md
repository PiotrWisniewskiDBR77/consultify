# PLAN WDROŻENIA — 7 kart N na SPEC-N (2026-07-21, wieczór)

> **Czym jest ten dokument:** rozkład jazdy dla fal W3+W4+W5 z planu 20.07 — przełożenie
> zatwierdzonego SPEC-N (`_SPEC_N_KARTY_2026-07-21.md`) na pakiety robocze per karta.
> **Nie wymyśla nic nowego** — każda pozycja cytuje ustalenie ze SPEC-N (§) albo defekt
> z inwentarza A1 (`_ANALIZA_A1_INWENTARZ_KART_N.md`, dowody plik:linia tam).
> **Rejestr:** realizuje ART-003 (fundament) · ART-004…010 (7 migracji) · ART-011 (bramka).

---

## 0. Czego ten plan ŚWIADOMIE NIE robi

| Poza zakresem | Dlaczego | Gdzie żyje |
|---|---|---|
| Kontrakty TREŚCI (rubryki, progi, prompty) | wymaga zatwierdzenia treści rubryk przez Piotra | KT1/KT2 → C8/DEC-010, osobna fala |
| Martwy kod (C-mode ~600 linii Notification, D-mode ~1870 Task, legacy Initiative) | decyzja P3: osobną falą PO migracjach — diff musi być odbieralny na zrzutach | fala sprzątania po Z |
| Tool Document | to WYNIK (PPT/Word/Excel), nie karta — SPEC-N §0A | ART-012 kontrakt renderu |
| Subtasks w Task | dziś nie istnieje w ogóle (A1) — to nowa funkcja, nie migracja | nowe zgłoszenie do rejestru |
| Taksonomia zakładek Initiative (Scope/Plan vs §13.1 Zadania/Definicja…) | zmiana treściowa, nie powłoki | osobne zgłoszenie |
| Twarda backendowa bramka evidence przy zatwierdzaniu | wymaga zmian serwera; w tej fali miękka blokada frontowa | osobne zgłoszenie (silnik) |

## 0A. Dwie KOREKTY decyzji ze SPEC-N §7 — do akceptu Piotra, nie chowam ich

**K1 — Decision i Task: przeklasyfikowanie S → L zamiast cięcia do 4 sekcji.**
Decyzja #2 mówiła „Task: klasa S z limitem 4 sekcji". Po zejściu do kodu: pełna karta Task ma
10 sekcji treści, Decision 8 — obie otwierają się dziś pełnostronicowo. Zbicie do 4 sekcji =
realna utrata treści, nie porządek. **Duch decyzji** („limit zamienia spór o gust w test")
zostaje: limit klasy S = 4 obowiązuje, ale te dwie karty są po prostu klasą L — **drawer
z listy to ich preview** (DecisionPreviewPanel — już naprawiony dziś), pełna karta = pełna
strona. §13.1 dostaje korektę S→L dla obu.

**K2 — Notification: bez sekcji Komentarze w ogóle.**
Decyzja #3 („lżejszy podtyp — bez pełnego panelu") zderza się z rezerwacją id `comments` dla
panelu (§2.1). Rozstrzygnięcie: wiadomość systemowa **nie jest artefaktem współpracy** —
komentarzy nie ma nigdzie (sekcja znika), zostaje skrócony panel: Właściwości + Historia.
Do obejrzenia na zrzucie PRZED/PO.

---

## 1. Zasada wykonania (lekcja z dziś, zapisana w SPEC-N §6B)

**Dozbrajamy istniejące komponenty — nie budujemy powłoki od zera.** `NModeShell`,
`NModeToolbar`, `NModeCardState`, `ArtifactRightPanel` istnieją i są dobre; brakuje im
pojedynczych zdolności i **typu, który wymusza użycie**. Dokładnie tak jak dziś
z `PreviewActionBar.overflowActions`: jedna zdolność dodana raz → trzy ręczne kopie zniknęły.

---

## 2. FALA F — FUNDAMENT (przed jakąkolwiek migracją; sekwencyjnie)

| # | Pakiet | Co powstaje | Realizuje |
|---|---|---|---|
| **F1** | **Kontrakt typowy `StandardArtifactShell`** — cienka, typowana warstwa NAD `NModeShell` (NModeShell nietknięty → nic istniejącego się nie psuje). Wymusza: `rightPanel: RightPanelSections` (rekord o stałych kluczach `actions/properties/relations/comments/history` + opcjonalne `evidence`, NIE `?:`) · `primaryAction: Config \| {intentionallyNone, reason}` · `sections: NModeSectionDef[]` gdzie id z uniona **bez** `comments/history/activity-log` · `aiContract: Props \| {none, reason}` na każdej sekcji · `class: 'S'\|'L'` z walidacją ≤4 sekcje dla S · **zero** portal-targetów i `children` poza slotami | SPEC-N §5.1, §2.1–2.5 |
| **F2** | **`NModeToolbar` + `overflowActions`** — ta sama zdolność co dziś w PreviewActionBar: >5 widocznych akcji → obowiązkowe „…" wbudowane w komponent, dev-warn przy przekroczeniu | SPEC-N §2.4, DOKTRYNA_GESTOSCI §1 |
| **F3** | **Rejestr `src/components/standard/registry.ts`** — 7 wpisów: typ karty → komponent → sekcja SPEC → ekran harnessu (`karta-*`). Z niego czyta smoke i hook | SPEC-N §5.4 |
| **F4** | **Bramki:** (a) `check-artefakt.sh` rozszerzony: drugi solid-CTA poza slotem primary · `createPortal` w plikach 7 kart · zarezerwowane id w tablicach sekcji lewej nav; (b) `scripts/karty-n-smoke.mjs` — dla każdego wpisu rejestru otwiera ekran harnessu i sprawdza brak error-boundary (automatyzacja tego, co dziś robiłem ręcznie — **jedyna bramka łapiąca runtime**, lekcja TDZ z fali N) | SPEC-N §5.2–5.3, §5B |

Wyjście F: wszystko się kompiluje, **żadna karta jeszcze nie zmigrowana**, ale kontrakt gotowy
i bramki uzbrojone. Rozmiar: ~1 sesja, robi sesja główna (nie armia) — to wymaga osądu.

---

## 3. FALE M — 7 MIGRACJI (kolejność wg ciężaru z A1)

Format pakietu: agent dostaje **wyłącznie swój plik** + ten wiersz planu + SPEC-N + swój
fragment A1. Zakres = lista poniżej, **nic ponadto** (żadnych refaktorów przy okazji).

### M1 · TOOL — `KnownToolDetailView.tsx` (1451 linii) · najlżejsza · fala równoległa A
- primary „Startuj sesję" → Menu 1 (`primaryAction`); dziś w toolbarze (A1: `:1427` vs `:134`)
- minimalny prawy panel: Właściwości (typ/kategoria/etap) · Powiązania (uczciwie puste) · Historia (nieobecna, nie pusta)
- uczciwy error state — dziś błąd API renderuje pełną treść domyślną (A1: `:1403-1421`)
- crimson w POWŁOCE: `statusDotColor: 'bg-primary-400'` (`:1441`) → token; 13 dekoracyjnych w treści ZOSTAJE (sweep kolorów = osobny etap, decyzja 07-08)
- `aiContract: {none, reason: 'statyczna baza wiedzy'}` na 4 sekcjach

### M2 · NOTIFICATION — `NotificationDetailView.tsx` (3213) · fala równoległa A
- podtyp „wiadomość systemowa" wg K2: skrócony panel (Właściwości+Historia), sekcja Komentarzy znika
- jeden primary: „Otwórz dokument" gdy jest źródło, inaczej „Oznacz przeczytane"
- ActionBar 7 przycisków → ≤4 widoczne + overflow (F2)
- skróty `D`/`M` widoczne jako badge; `D` (delete) z potwierdzeniem — dziś niewidoczny skrót kasuje bez pytania (A1)
- deprecated `draftSavedLabel` przestaje być nadużywany (karta read-only → brak wskaźnika zapisu)

### M3 · INTERVIEW — `InterviewWorkspace.tsx` (2990) · fala równoległa B
- decyzja #5: `single_question` **przestaje mieć własny top-bar** (A1: `:2739, 2757-2841`) — jedna powłoka, różni się centrum
- prawy panel: Właściwości (szablon/przypisany/termin/postęp) · Powiązania (sesje/insighty) · Historia
- martwe wpięcie AI: `onChat` działa, `showChatButton` nigdy nie ustawiony (A1: `:2969`) → włączyć (slot AI stały wg §18.1)
- duplikaty Save/Approve/Send-back między gałęziami trybów → jedna deklaracja akcji
- brakujące klucze i18n z dzisiejszych znalezisk (`noReview`, `runtimeMode.conversational.*`) → dopisać pl/en

### M4 · DECISION — `DecisionDetailView.tsx` (8830) · fala równoległa B
- ✅ zrobione dziś: dublet Delegate (commit `a10b8ada2f`)
- Comments + Activity Log WYCHODZĄ z lewej nav (A1: `:7602, :7684`) — treść w pełnej formie do panelu (dziś dublet: pełny canvas w nav I skrót w panelu)
- Save znika z panelu Actions (nagłówek ma autosave/„Saved") — SPEC-N §2.6
- bespoke „Inline ActionBar" → `NModeToolbar` (dług oznaczony w kodzie: `:5176` „will migrate")
- `aiContract` na 8/8 sekcji (dziś 4/8; RACI itp. jawne `{none}`)
- klasa: **S→L wg K1**

### M5 · INSIGHT — `InsightViewer.tsx` (8897) · fala równoległa B
- dublet Export: panel `:7903` vs toolbar `:8283` → zostaje toolbar, panel Actions traci
- dublet AI Consultant: panel `:7911` vs toolbar solid `:8461` → jedno wejście (toolbar); solid → outline (SPEC-N §2.3: nic poza primary nie jest solid)
- Save znika z panelu Actions (nagłówek ma „Saved")
- comments/activity-log dublet centrum+panel — **wykonać własny TODO kodu** (`:759` „move Comments…") → tylko panel
- wariant badge-only `NModeCardBadge` zostaje (udokumentowany wyjątek); `evidence` zostaje (wzorzec dla reszty)

### M6 · TASK — `TaskDetailView.tsx` (7389) · fala C
- klasa **S→L wg K1**; druga etykieta „Menu 1 (klasa S)" znika (A1)
- Comments/Attachments/Activity z lewej nav → panel
- Save dublet (header + panel, ten sam handler) → panel bez Save
- `aiContract` 4/10 → 10/10 (część jawne `{none}`)
- Subtasks: POZA zakresem (nowe zgłoszenie)

### M7 · INITIATIVE — `InitiativeDocumentView.tsx` (10 818) · fala C · najcięższa, model wysoki
- **ZBUDOWAĆ prawy panel** (`ArtifactRightPanel` — 0 użyć dziś, A1): pozioma siatka 7 pól → sekcja Właściwości; sekcje centrum `comments` (`:5171`) i `activity-log` (`:5180`) → panel
- **`evidence` w panelu** (P2 rozstrzygnięte przez Piotra: TAK): odczyt istniejących `evidence_refs`; puste → uczciwe „brak dowodów"; **miękka blokada frontowa** przy „Submit for Review" (ostrzeżenie, nie twarda ściana — twarda = backend, osobne zgłoszenie); wzorzec bramki: obieg wywiadów (blokuje promocję, nie pisanie — SPEC-N §4A)
- toolbar 9 grup → ≤5 widocznych + overflow (F2)
- dwa wejścia AI-chat („Propose next steps" vs „AI Consultant", dług przyznany w kodzie `:10511`) → jedno
- `aiContract` 13/26 → 26/26
- dwa pojęcia „Present" (gęstość N/C vs fullscreen card-walk pod jedną ikoną) → rozdzielone nazwy i sloty (SPEC-N §2.7)
- dublet lifecycle primary vs `InitiativeDraftJourney.onAdvance` (tylko DRAFT) → jedna deklaracja

---

## 4. FALA Z — ZACIŚNIĘCIE (po M7)

1. 7 kart importuje wyłącznie `StandardArtifactShell`; `check-artefakt.sh` **blokuje** bezpośredni `NModeShell` w tych 7 plikach → ósma karta nie ma jak powstać niezgodna
2. smoke 7/7 zielony + przejście DoD §18.1 + 4 punkty fali (SPEC-N) na każdej karcie oczami
3. SPEC-N wchodzi do `ARTIFACT_ANATOMY_STANDARD.md` jako §11.2a; §13.1 dostaje 3 nowe kolumny + korekty K1/K2
4. skill `consultify-karty-n` zaktualizowany o rejestr i smoke
5. rejestr: ART-004…010 → do-odbioru, każde ze zrzutami PRZED/PO

---

## 5. ORKIESTRACJA

**Fale:** F (sesja główna, sekwencyjnie) → **A**: M1+M2 równolegle → **B**: M3+M4+M5 równolegle → **C**: M6, M7 → Z (sesja główna).

**Modele:** M1/M2 tanie; M3–M5 średnie; M6/M7 wysoki (Initiative: najwyższy effort). Zgodnie z HIGIENĄ WYKONANIA z CLAUDE.md.

**Żelazne reguły agenta migracyjnego:**
1. Edytujesz WYŁĄCZNIE swój plik karty (+ ewentualnie locale JSON). `NModeLayout/`, `standard/` — ZAKAZ; potrzebę zgłaszasz w raporcie.
2. Zakres = lista z twojego pakietu. Widzisz coś obok — raportujesz, nie ruszasz.
3. Po każdej zmianie: esbuild pliku. Pełny tsc/vitest — ZAKAZ (OOM).
4. Nie deklarujesz „działa" — deklarujesz „esbuild OK + co zmieniłem". Runtime weryfikuje nadzorca w harnessie (lekcja: dziś 2/8 ekranów z „esbuild OK" nie działało w przeglądarce).
5. Uczciwy raport blokady > udawane wykonanie.

**Protokół po każdej fali (nadzorca):** harness wszystkich dotkniętych kart (jasny+ciemny) →
zrzuty PRZED/PO → commit-batch → pre-flight → push demo → meldunek Piotrowi. Piotr odbiera
partiami na demo (tryb ustalony dziś: „wpychaj na demo i będziemy testowali").

---

## 6. RYZYKA — uczciwie

| Ryzyko | Mitygacja |
|---|---|
| Pliki 3–11k linii; chirurgia może zahaczyć sąsiedni przepływ | zakres-listy, zero refaktorów, smoke po każdej fali, zrzuty PRZED/PO |
| esbuild nie łapie runtime (TDZ — 2× dziś) | harness otwierany po KAŻDEJ migracji, nie na końcu |
| Panel Initiative to realnie nowe UI | zrzut do akceptu Piotra PRZED pushem tej jednej karty |
| Dwie karty na raz w tym samym pliku locale | pakiety nie współdzielą plików poza locale; locale — append-only |

**Rozmiar szczerze:** plan z 20.07 szacował W3+W4 na ~3–4 tygodnie. Dziś fundament częściowo
stoi (harness 8/8, wzorzec overflow, bramka źródeł), armia działa równolegle, więc realnie:
**F = 1 sesja · fale A+B = 1–2 dni sesyjne · C = 1–2 dni · Z = pół dnia.** Nie „4 tygodnie",
ale też nie „jeden wieczór" — Initiative sama jest większa niż wszystko, co zrobiliśmy dziś.

---

*Po akcepcie: GO = startuję Falę F w tej sesji, fale A/B/C armią, meldunek po każdej.*
