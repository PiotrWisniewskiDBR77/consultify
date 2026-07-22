# ODBIÓR NIEZALEŻNY — POC wiążącego kontraktu karty na Decision

**Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (baza `origin/demo`, ahead 4, NIE pushowany)
**Odbierany commit:** `738447b039` — *feat(poc-decision): adopcja wiazacego kontraktu karty*
**Metoda:** przebieg w izolowanym chromium (Playwright), harness `http://localhost:3220/?screen=karta-decision`,
light + dark, flaga ON (`&cardContract=1`) i OFF. Dowody: `plik:linia` + pomiar z DOM + zrzuty.
**Zasada:** nie ufałem raportowi POC — każde twierdzenie odtworzone samodzielnie.

## WERDYKT: ✅ PASS

POC dostarcza dokładnie to, co deklaruje: rdzeń nieusuwalny (typem + UI), węższy zestaw domyślny (4 karty),
kompozycja płynie przez wiążący kontrakt, aliasy renderują 1:1, zero regresji przy fladze OFF, zero crimson /
surowych kluczy / error-boundary / ReferenceError w obu motywach. Commit jest UCZCIWY — jego twierdzenia
(łącznie z „crimson 8→8, dodałem 0") potwierdzone niezależnie. Jedno zastrzeżenie (pre-existing dług, nie defekt
POC) opisane w pkt 4 i „Obserwacje".

---

## PASS/FAIL PER PUNKT

### 1. Render bez regresji — ✅ PASS
Zrzuty: `karta-decision-light.png`, `karta-decision-dark.png`.
- **Menu 1 czysty:** back · ikona-typ · tytuł inline („Rezydencja danych wywiadowczych —…") · status
  lifecycle „Oczekująca" · **osobny** wskaźnik zapisu „Zapisano" · slot AI (teal) · 2 przełączniki widoku ·
  **JEDEN primary** „Zatwierdź decyzję" (neutralny — czarny w light / biały w dark, **nie crimson**) · kebab (⋮).
- **Prawy panel — kolejność kanoniczna:** AKCJE → WŁAŚCIWOŚCI → POWIĄZANIA → KOMENTARZE → HISTORIA/AI
  (potwierdzone wzrokiem na zrzucie ORAZ bramką: `sectionIds=[actions,properties,relations,comments,history]`,
  `orderInversions=[]`). Powiązania klikalne (Ryzyka 4 + 5 linków, Załączniki 3).
- **Centrum renderuje:** sekcja „Zakres decyzji" z DOTYCZY (chipy TASK/DECISION), tekstem AI, paskiem
  NModeCardState (Regeneruj/Edytuj/Zaakceptuj), badge „Edytowane".
- **Brak error-boundary** (pomiar: `errorBoundary=false` light i dark), **brak surowych kluczy i18n**
  (`i18nKeys=[]` light i dark), **brak ReferenceError** (konsola: jedyny błąd to pre-existing
  `OrgContext orgs.find` — `src/contexts/OrgContext.tsx:50`, środowiskowy harness, obecny też w poprzednich
  sesjach; **nie** z kodu POC). Asercja dev R2 (`[decisionCardContract] …`) **nie odpaliła** → każda sekcja
  lewej nawigacji ma wpis w katalogu (alias zmapowany poprawnie).

### 2. RDZEŃ context-problem nieusuwalny — ✅ PASS
Zrzut: `karta-decision-picker-sekcje.png`. Pomiar wierszy menedżera „Sekcje ▾":
| karta | widoczna | liczba przycisków | remove (X) |
|---|---|---|---|
| **Zakres decyzji** (context-problem = rdzeń) | tak | **3** | **BRAK** |
| Opcje i trade-offy | tak | 4 | jest |
| Ryzyko i wpływ | tak | 4 | jest |
| Konsekwencje | tak | 4 | jest |
| RACI i eskalacja | nie | 4 | jest |
| Załączniki i powiązania | nie | 4 | jest |
| Komentarze | nie | 4 | jest |
| Logi aktywności | nie | 4 | jest |

Rdzeń jako jedyny NIE ma przycisku usuwania. Egzekwowane dwuwarstwowo: typ (`rola:'rdzen'` ⇒ `core:true`,
`decisionCardContract.ts:75,238`) + UI (`removeCard` przerywa dla `core`, `useCardLayout.ts:200`; wiersz remove
renderowany tylko `!isCore`, `NModeCardManager.tsx:363`, warunek `isCore` `:313`).

### 3. Domyślny węższy — ✅ PASS
Pomiar (DOM, świeży localStorage):
- **Widoczne przy otwarciu (lewa nawigacja): 4** — Zakres decyzji, Opcje i trade-offy, Ryzyko i wpływ,
  Konsekwencje (rdzeń + 3 rodziny DECISION). Identycznie w light i dark.
- **„Nowa karta ▾" (availableToAdd): 0** — komunikat „Wszystkie karty są już dodane"
  (`karta-decision-picker-nowa.png`). Powód mechaniczny: `buildDefaultLayout` seeduje CAŁY katalog (8),
  4 `visible` + 4 `hidden` (`useCardLayout.ts:80`), więc `availableToAdd = katalog − layout = 0`
  (`useCardLayout.ts:295`). Przywracanie ukrytych idzie przez „Sekcje ▾" (Eye/EyeOff), nie „Nowa karta".
- **Ukryte, przywracalne z „Sekcje": 4** — RACI i eskalacja + Załączniki i powiązania (wracają do lewej
  nawigacji), Komentarze + Logi aktywności (żyją w prawym panelu). Przełącznik zestawu **„Rdzeń decyzji /
  Pełny"** obecny (2 nazwane zestawy: default=4, full=8).
- **Baseline regresji (flaga OFF): 6** widocznych w nawigacji (`karta-decision-flagOFF-light.png`) — stary
  `DECISION_SPEC.sets[0]`=8, ale `notionSections` ma 6 pozycji lewej nawigacji. Efekt flagi = zwężenie **6→4**.
  Flaga OFF renderuje bez błędów (zero regresji potwierdzone).

### 4. Bramka `check-artefakt-struktura.mjs` na Decision — ✅ PASS strukturalnie / ⚠ crimson = dług pre-existing
Wynik dla Decision:
- (a) Menu 1 / NModeHeader: **✓** (wprost `<NModeHeader>` — świadome „wejście do kontraktu", sygnał miękki).
- (b) ArtifactRightPanel: **✓ używa**.
- (c) Kolejność sekcji: **✓ zgodna z kanonem** (`[actions, properties, relations, comments, history]`, 0 inwersji).
- (d) Crimson w centrum: **✗ 8** → werdykt **FLAGA**.

**Weryfikacja niezależna twierdzenia „dodałem 0 crimson" — POTWIERDZONE:**
- Nowy plik `decisionCardContract.ts`: **0** tokenów crimson (grep `primary-|c-accent` = pusto).
- `DecisionDetailView.tsx`: crimson **7 (raw) / 6 (bez komentarza)** w PARENT `738447b039^` = **tyle samo** w HEAD
  → POC nie dodał ani jednej linii crimson. 6 zgłoszonych linii (`:7828,7952,8093,8349,8498,8603`) to
  **pre-existing legacy C-mode** (`bg-primary-500/15 border-primary-400/50 …`, `border-slate-300/60 dark:border-navy-600 …`)
  — daleko poza hunkami POC (98–1400).
- `shared/AIConnections.tsx:92,97` (2): plik **NIE tknięty** przez POC (nie ma go wśród 4 zmienionych plików).

Wniosek: FLAGA = 100% długu odziedziczonego (6 legacy C-mode + 2 AIConnections); wkład POC = 0. Części
strukturalne, za które odpowiada POC (Menu1 / panel / kolejność), **PASS**.

⚠ **Zastrzeżenie (nie defekt POC, do NASTĘPNEGO kroku):** plan `_KONTRAKT_KARTY_SSOT §9 KROK 1 pkt 3` chciał
„`--strict` **zielono** na Decision". Przy 8 crimson `--strict` = exit 1 (czerwono), więc ten cel §9 NIE jest
spełniony. Commit tego **nie ukrywa** („crimson 8→8", nagłówek „GRANICA POC"). Przed promocją flagi na domyślną:
albo domknąć te 8 (6 legacy C-mode + 2 AIConnections), albo świadomie zaakceptować dług.

### 5. `check-artefakt.sh --report` (crimson w powłoce) — ✅ PASS
`✓ brak nowych naruszeń crimson w powłoce artefaktów (aktualnie 5, baseline 17 — dług nie rośnie)`.
Karty N (raport): 2 ostrzeżenia R1 (solid CTA poza slotem) — w `NotificationDetailView:2288` i
`TaskDetailView:6247`, **nie w Decision**, nie z POC. R2+R3 blokujące = 0.

---

## OBSERWACJE (nie blokujące)

1. **Kwerk modelowania `comments`/`activity-log` (pre-existing, nie z POC).** Obie karty są w katalogu
   (`kolumna:'right'`), ale NIE w `notionSections` (renderują się tylko w prawym panelu). Adapter
   `toCatalogEntry` gubi `kolumna`, więc menedżer „Sekcje" listuje je jako przełączalne wiersze — a
   pokazanie ich (Eye) nie daje efektu w lewej nawigacji (`applyToSections` je odfiltrowuje, bo `byId`
   z `notionSections` ich nie zna, `useCardLayout.ts:300`). To samo istniało w starym `DECISION_SPEC`
   (tam jako „visible"); POC dziedziczy kwerk, nie tworzy go. **Rekomendacja na kolejną iterację:** adapter
   mógłby wyłączyć `kolumna:'right'` z katalogu `CardCatalogEntry`, żeby prawopanelowe karty nie pojawiały
   się jako wiersze menedżera lewej nawigacji.

2. **Higiena runtime silniejsza niż esbuild.** „esbuild przeszedł" ≠ „działa" — sprawdziłem żywy harness:
   Vite hot-transformował wszystkie 4 pliki i wyrenderował kartę w obu motywach bez wyjątku. To mocniejszy
   dowód kompilacji+runtime niż per-plikowy esbuild.

## ZRZUTY
- `karta-decision-light.png` — flaga ON, light (4 karty, prawy panel w kanonie).
- `karta-decision-dark.png` — flaga ON, dark (tokeny c-* OK, zero crimson).
- `karta-decision-picker-sekcje.png` — menedżer „Sekcje": 4 widoczne (Eye) + 4 ukryte (EyeOff), przełącznik
  „Rdzeń decyzji / Pełny", rdzeń bez remove.
- `karta-decision-picker-nowa.png` — „Nowa karta": „Wszystkie karty są już dodane" (availableToAdd=0).
- `karta-decision-flagOFF-light.png` — baseline regresji: 6 kart w nawigacji (flaga OFF).
