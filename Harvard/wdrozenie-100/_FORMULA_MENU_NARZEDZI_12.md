# FORMUŁA MENU + PRZYCISKÓW — 12 narzędzi Consultify (SSOT standaryzacji)

> **Cel:** jeden dokument, który dla KAŻDEGO narzędzia mówi dokładnie **co jest w którym menu i jakie przyciski/funkcje MAJĄ tam być**. To jest wzorzec docelowy (prescriptive), nie opis stanu.
> **Następny krok (osobny):** kolumna **Stan** wypełniana per przycisk — `✅ JEST` / `🔨 DOROBIĆ` / `❓ DECYZJA` — po czym standaryzujemy (jeden przycisk = jedno miejsce, wszędzie).
> **Kanon źródłowy:** `ARTIFACT_ANATOMY_STANDARD.md` §5 (menu per archetyp) · §6 (alfabet elementów + kebab §6.4) · §13 (instancjacja). Ten plik = instancjacja per-narzędzie tamtego standardu.

---

## 0. INWENTARZ — 12 narzędzi (szybkie liczenie: 5 + 4 + 3 = 12)

| # | Grupa | Narzędzie | Archetyp | Klasa | Centrum ekranu |
|---|-------|-----------|:---:|:---:|----------------|
| 1 | My Work / Ideas | **Mind Map** | A Canvas | L | płótno węzłów |
| 2 | My Work / Ideas | **Process Flow** | A Canvas | L | płótno kroków |
| 3 | My Work / Ideas | **Whiteboard** | A Canvas | L | płótno swobodne |
| 4 | My Work / Ideas | **Idea Table** | D Matryca | L | siatka (canvas-tabela) |
| 5 | My Work | **Notatnik** | B Dokument | S/L | tekst ciągły |
| 6 | Karty N | **Insight** | C Rekord | S | sekcje pól |
| 7 | Karty N | **Initiative** | C Rekord | L | ~10 ekranów wewn. |
| 8 | Karty N | **Task** | C Rekord | S | sekcje pól |
| 9 | Karty N | **Decision** | C Rekord | S | sekcje pól (opcje) |
| 10 | Generatory | **Word / Dokument** | B Dokument | L | tekst ciągły |
| 11 | Generatory | **Excel / Sheet** | D Matryca | L | siatka komórek |
| 12 | Generatory | **PowerPoint / Deck** | E Deck | L | slajdy |

Archetypy: **A Canvas · B Dokument · C Rekord · D Matryca · E Deck**. Klasa **S** = jeden widok (panel/modal, bez M2/M3). **L** = wiele widoków wewn. (M2+M3 aktywne).

---

## 1. FORMUŁA — wspólna powłoka (6 stref, identyczna dla wszystkich; różni się TYLKO centrum)

Każde narzędzie = ta sama powłoka. Standaryzujemy 6 stref:

| Strefa | Kod | Co tu mieszka | Reguła nienaruszalna |
|--------|-----|---------------|----------------------|
| Menu 1 artefaktu | **M1** | ← powrót · ikona-typ + tytuł (edyt. inline) · status lifecycle · stan zapisu · [indeks] · **1× PRIMARY** | Tylko tożsamość + JEDEN primary (neutralny, nie crimson). Nic więcej. |
| Menu 2 artefaktu | **M2** | listwa formatowania (B I U, nagłówki, listy) | TYLKO archetyp B (Dokument). Canvas/Rekord/Matryca/Deck = brak. |
| Menu 3 artefaktu | **M3** | chipy akcji bieżącego widoku + kontrolki (filtr/sort/zoom) + **AI (prawa)** | Slot AI ZAWSZE prawa strona. Klasa S = brak M3. |
| Lewy rail | **RAIL** | narzędzia-CZASOWNIKI (dodaj węzeł, rysuj, sticky) | Znika całkowicie gdy pusty. Głównie archetyp A/E. |
| Prawy panel | **PANEL** | accordion: **Akcje 2rz. · Właściwości · Powiązania · Komentarze · Historia/AI** | Stała kolejność sekcji. Zostaje zawsze. `ArtifactRightPanel`. |
| Prawy klik / kebab | **PPM** | lustro architektury przycisków, przefiltrowane | Stała kolejność §6.4 (niżej). |

**Alfabet elementów (§6 — jedna ikona = jedno znaczenie, wszędzie):** Otwórz `maximize-2` · Podgląd `eye` · Edytuj `pencil` · Zmień nazwę `text-cursor` · Powiel `copy` · Przenieś `folder-input` · Eksport `download` · Udostępnij `share-2` · Kopiuj link `link` · Komentarz `message-square` · Historia `history` · AI `sparkles` · Archiwizuj `archive` · Usuń `trash-2`(danger).

**Kebab / PPM — stała kolejność (§6.4, nienaruszalna):**
`1. Otwórz · Podgląd │ 2. Edytuj · Zmień nazwę · Powiel │ 3. Eksport ▸ · Udostępnij · Kopiuj link · Przenieś ▸ │ 4. AI: uzupełnij · AI: podsumuj │ 5. Archiwizuj · Usuń(danger, koniec)`

**5 reguł przekrojowych:** (1) dokładnie 1 primary w M1; (2) slot AI zawsze prawa M3 + sekcja AI w panelu; (3) „Powiązania" first-class w KAŻDYM narzędziu (indeks linkowania); (4) tryb Read/Edit toggle dla B i C; (5) stany empty/loading/error zaprojektowane per narzędzie („co zrobić by zacząć", nie „No data").

Legenda kolumny **Stan** (wypełniamy w kroku 2): `✅ JEST` · `🔨 DOROBIĆ` · `❓ DECYZJA` · `⬜ do zestawienia`.

---

## 2. GRUPA MY WORK / IDEAS (5) — archetyp A Canvas + D Matryca + B Dokument

### 1 · Mind Map (A Canvas · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona mapy + tytuł inline · status · zapis · [indeks] · **PRIMARY: „Konwertuj na inicjatywę"** | ⬜ |
| **M2** | — (canvas bez listwy tekstu) | — |
| **M3** | zoom ± · dopasuj do ekranu · minimapa toggle · siatka toggle · układ auto (radial/tree) · **AI: rozbuduj gałąź / zaproponuj węzły** (prawa) | ⬜ |
| **RAIL** | kursor/select · dodaj węzeł · połącz (krawędź) · tekst · kolor/kształt węzła · komentarz | ⬜ |
| **PANEL** | ▸ Akcje (eksport PNG/PDF, udostępnij) · ▸ Właściwości węzła (kolor/rozmiar/typ) · ▸ Powiązania (do inicjatyw/źródeł) · ▸ Komentarze · ▸ Historia/AI | ⬜ |
| **PPM płótno** | Dodaj węzeł tutaj · Wklej · Zaznacz wszystko · Dopasuj widok | ⬜ |
| **PPM węzeł** | Edytuj · Powiel · Połącz z… · Kolor ▸ · Komentarz · —— · Usuń | ⬜ |

### 2 · Process Flow (A Canvas · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona procesu + tytuł · status · zapis · [indeks] · **PRIMARY: „Konwertuj na inicjatywę"** | ⬜ |
| **M2** | — | — |
| **M3** | zoom ± · dopasuj · minimapa · siatka · orientacja (poziom/pion) · **AI: uzupełnij krok / wykryj wąskie gardło** (prawa) | ⬜ |
| **RAIL** | select · dodaj krok (akcja) · dodaj decyzję (romb) · połącz (strzałka+etykieta) · swimlane/tor · tekst · komentarz | ⬜ |
| **PANEL** | ▸ Akcje (eksport, udostępnij) · ▸ Właściwości kroku (typ/właściciel/czas) · ▸ Powiązania · ▸ Komentarze · ▸ Historia/AI | ⬜ |
| **PPM płótno / krok** | jak Mind Map + „Zmień typ kroku ▸" (akcja/decyzja/start/koniec) | ⬜ |

### 3 · Whiteboard (A Canvas · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona tablicy + tytuł · status · zapis · [indeks] · **PRIMARY: „Konwertuj na inicjatywę"** | ⬜ |
| **M2** | — | — |
| **M3** | zoom ± · dopasuj · minimapa · siatka · **AI: uporządkuj / streść tablicę** (prawa) | ⬜ |
| **RAIL** | select · sticky (notka) · kształt (prostokąt/koło/strzałka) · rysuj (freehand) · tekst · obraz/upload · frame/ramka · połącz · komentarz | ⬜ |
| **PANEL** | ▸ Akcje (eksport, udostępnij) · ▸ Właściwości elementu (kolor/warstwa) · ▸ Powiązania · ▸ Komentarze · ▸ Historia/AI | ⬜ |
| **PPM płótno / element** | Dodaj tutaj ▸ · Warstwa (na wierzch/spód) · Kolor ▸ · Powiel · —— · Usuń | ⬜ |

### 4 · Idea Table (D Matryca · L — canvas-tabela hybryda)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona tabeli + tytuł · status · zapis · [indeks] · **PRIMARY: „Generuj inicjatywy z zaznaczonych"** | ⬜ |
| **M2** | toolbar tabeli: wstaw wiersz · wstaw kolumnę · typ kolumny ▾ · format komórki | ⬜ |
| **M3** | filtr · sort · grupuj · toggle widok (tabela/kanban) · konfiguruj kolumny · **AI: uzupełnij kolumnę / skategoryzuj** (prawa) | ⬜ |
| **RAIL** | — (znika w prostej tabeli) | — |
| **PANEL** | ▸ Akcje (eksport CSV/.xlsx, udostępnij) · ▸ Szczegół rekordu (rozwinięcie wiersza) · ▸ Powiązania · ▸ Komentarze rekordu · ▸ Historia/AI | ⬜ |
| **PPM komórka / wiersz** | Edytuj · Ustaw wartość ▸ · Dodaj notatkę · —— · Powiel wiersz · Usuń wiersz | ⬜ |

### 5 · Notatnik (B Dokument · S/L)

> **DIFF 07-09 (vegas/a4-docs, weryfikacja `src/components/MyWork/NotebookContent.tsx` + `notebook/*`):**
> Realny layout = biblioteka (sidebar listy stron) + edytor, wzorzec Notion two-pane — NIE jest to jeszcze
> instancja formalnego M1-identity-header + `ArtifactRightPanel` accordion. Wiele funkcji z Formuły JEST w
> kodzie, ale rozproszone (hamburger ⋯, tabbed rail „Praca/Kontekst" zamiast accordionu w stałej kolejności).

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót (JEST, `onBackToLibrary`) · ikona notatki + tytuł (tytuł edytowalny inline w edytorze, NIE w osobnym pasku identity) · status (brak lifecycle badge w M1 — status żyje tylko jako kropka w liście) · zapis (brak widocznego wskaźnika „Zapisano/Zapisuję" w M1; `isSavingRef` istnieje tylko wewnętrznie) · [indeks] (brak) · **PRIMARY „Udostępnij"** — 🔨 BRAK: `onShare` w `NotebookHamburgerMenu` nigdy nie jest przekazywany z `NotebookContent`, ZERO backendu share-link dla notatek (`grep` nie znalazł `createNotebookShareLink` ani odpowiednika) | 🔨 |
| **M2** | `NotebookToolbar` (B I U, nagłówki, listy) ✅ JEST · brak wyrównania/blok-kodu/cytat jako osobnych przycisków paska (dostępne przez `/` slash-menu, nie M2) | 🔨 częściowo |
| **M3** | brak toggle „tryb czytania" · brak TOC toggle (spis treści nie istnieje w kodzie) · komentarze — brak toggle, komentarze żyją gdzie indziej · **AI slot NIE jest w stałej prawej pozycji M3** — AI wywoływane przez hamburger ⋯ (`onAskAI`) i przez zakładkę „Praca" panelu bocznego (`NotebookRightRail`), nie jako chip „AI: napisz/podsumuj/popraw" | 🔨 |
| **RAIL** | brak outline/lewego railu nawet dla długich notatek (jest tylko wewnętrzny `NotebookBacklinksBar`) | 🔨 |
| **PANEL** | ✅ *treściowo bogaty*, ale NIE jako `ArtifactRightPanel` accordion w kanonicznej kolejności — to tabbed `NotebookRightRail` (zakładki „Praca"/„Kontekst") łączący `AIChatInlinePanel` (ma wbudowany `ShareSection`!) + `NotebookContextPanel`. Eksport JEST (`NotebookExportMenu`, osobny przycisk w toolbarze, nie w panelu). Wersje JEST (`NotebookVersionHistory`, toggle osobny, nie w akordeonie). Powiązania JEST częściowo (`NotebookBacklinksBar` + `NotebookAttachmentsSection`, ale poza sekcją „Powiązania" panelu). Komentarze — NIE znaleziono dedykowanej sekcji komentarzy per-strona w tym pliku. | 🔨 rozjazd struktury vs kanon |
| **PPM zaznaczenie / blok** | `NotebookBubbleToolbar` = tylko formatowanie (B/I/U/link) przy zaznaczeniu — BRAK menu „Kopiuj/Wklej · Komentarz · AI: przepisz/skróć/rozwiń · Duplikuj blok · Zmień typ ▸ · Usuń blok"; brak klasycznego PPM (prawy klik) w ogóle w edytorze | 🔨 |

**Ocena:** Notatnik ma SILNIK bogatszy niż formalna powłoka (backlinks, mentions, AI proposals, quick-capture, wersjonowanie) — ale **nie przeszedł jeszcze adopcji SPEC-A powłoki** (brak M1-identity/`ArtifactRightPanel`/PPM). To NIE jest fantom — funkcje realnie działają, tylko w innym locum niż Formuła każe. Zamiana na formalną powłokę = zadanie architektoniczne (przeniesienie `NotebookRightRail`→`ArtifactRightPanel`), NIE mechaniczne — wymaga decyzji Piotra czy warto rozbierać dojrzały tabbed-rail na accordion, i weryfikacji wzrokiem (nie zrobione w tej turze, brak dostępu do żywego podglądu).

---

## 3. GRUPA KARTY N (4) — archetyp C Rekord

> Klasa **S** (Insight/Task/Decision): prawy PANEL jest GŁÓWNYM nośnikiem treści; brak M2/M3. Klasa **L** (Initiative): pełne M3 (nawigacja wewn.).

### 6 · Insight (C Rekord · S)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona insightu + tytuł · status · zapis · [indeks] · **PRIMARY: „Konwertuj na inicjatywę"** | ⬜ |
| **M2 / M3** | — (klasa S) | — |
| **PANEL** (główny nośnik) | ▸ Treść insightu (obserwacja/znaczenie/rekomendacja — sekcje AI) · ▸ Właściwości (źródło/data/pewność/tag) · ▸ Powiązania (inicjatywy/wywiady/dokumenty) · ▸ Akcje 2rz. (eksport, udostępnij) · ▸ Historia/AI | ⬜ |
| **PPM (w liście)** | Otwórz · Podgląd │ Edytuj · Zmień nazwę · Powiel │ Eksport ▸ · Udostępnij · Kopiuj link │ AI: uzupełnij │ Archiwizuj · Usuń | ⬜ |

### 7 · Initiative (C Rekord · L — ~10 ekranów wewn.)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona inicjatywy + tytuł · status lifecycle · zapis · [indeks] · **PRIMARY: przejście stanu („Zgłoś do przeglądu" / „Zatwierdź" / „Zamknij")** | ⬜ |
| **M2** | — | — |
| **M3** (nawig. wewn. jako pill) | Przegląd · Zakres · Taski · RAID · Finanse/ROI · Kamienie milowe · Governance · Dokumenty · **AI: uzupełnij sekcję** (prawa) | ⬜ |
| **RAIL** | — | — |
| **PANEL** | ▸ Akcje 2rz. (eksport, udostępnij, konwersje) · ▸ Właściwości (owner/sponsor/daty/budżet/oś) · ▸ Powiązania (KPI/taski/decyzje/źródła) · ▸ Komentarze · ▸ Historia/AI | ⬜ |
| **PPM (w liście)** | pełny §6.4 (Otwórz…Usuń) + „Konwertuj ▸" | ⬜ |

### 8 · Task (C Rekord · S)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona taska + tytuł · status · zapis · [indeks] · **PRIMARY: przejście stanu („Rozpocznij" / „Zakończ" / „Zablokuj")** | ⬜ |
| **M2 / M3** | — (klasa S) | — |
| **PANEL** (główny nośnik) | ▸ Treść (opis/kryteria akceptacji/dowody — sekcje AI) · ▸ Właściwości (owner/priorytet/termin/estymacja/inicjatywa) · ▸ Powiązania (inicjatywa/decyzje/pliki) · ▸ Akcje 2rz. · ▸ Historia/AI | ⬜ |
| **PPM (w liście)** | §6.4 + „Oznacz: Wykonane/Zablokowane" | ⬜ |

### 9 · Decision (C Rekord · S)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona decyzji + tytuł · status · zapis · [indeks] · **PRIMARY: „Zatwierdź decyzję"** | ⬜ |
| **M2 / M3** | — (klasa S) | — |
| **PANEL** (główny nośnik) | ▸ Treść (kontekst/opcje/rekomendacja/uzasadnienie/odrzucona alternatywa — sekcje AI) · ▸ Właściwości (decydent/data/status/waga) · ▸ Powiązania (inicjatywa/ryzyka/źródła) · ▸ Akcje 2rz. · ▸ Historia/AI | ⬜ |
| **PPM (w liście)** | §6.4 + „Zatwierdź / Odrzuć / Wstrzymaj" | ⬜ |

---

## 4. GRUPA GENERATORY (3) — archetyp B Dokument + D Matryca + E Deck

### 10 · Word / Dokument (B Dokument · L)

> **DIFF 07-09 (vegas/a4-docs, weryfikacja `DocumentStudioView.tsx` + `DocumentStudioDocumentPanel.tsx`,
> 2398 linii):** Word używa **`ExecutiveModuleShell`** (jedna z 3 dojrzałych powłok wg doktryny „WYRÓWNAĆ nie
> scalać" — NIE `ArtifactRightPanel`). To zamierzone (archetypy B/D/E), więc brak `ArtifactRightPanel` tu
> NIE jest gapem samym w sobie — gapem jest niezgodność KOLEJNOŚCI/DOSTĘPNOŚCI z kanonem Formuły.

| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | TopBar z `ExecutiveModuleShell` — ma tab-chips Generate/Plan template w fazie budowy, ale **BRAK jednego jawnego M1 PRIMARY „Udostępnij"** — w fazie `document` primary miejsce zajmuje TopBar chip „Export DOCX" (`topBarChips`, l.~1842-1900), a Share jest schowany w overflow rail (`toolShare`, l.1966) — **DOKŁADNIE ODWROTNIE niż formuła** (chce Udostępnij=primary M1, Eksport=panel) | ❓ DECYZJA (inwersja primary/eksport) |
| **M2** | brak klasycznego paska formatowania w widoku wygenerowanego dokumentu (to widok schema/sekcje, nie wolny tekst) — `DocumentTipTapEditor` istnieje ale nie ma odrębnego M2 toolbara zweryfikowanego w tym pliku | 🔨 do doprecyzowania |
| **M3** | brak trybu czytania / TOC-toggle / komentarze-toggle / śledź-zmiany-toggle jako chipy M3 — funkcjonalnie odpowiedniki istnieją ale jako osobne rail-tools (Comments, Schema diff), nie M3 chipy | 🔨 rozjazd lokalizacji |
| **RAIL** | ✅ JEST — lewy `leftRailTitle="Outline"` (outline dokumentu), zgodnie z formułą | ✅ |
| **PANEL** | ✅ **bogatszy niż kanon** — 13 narzędzi w prawym railu: primary 5 (Sources, Properties, Quality QA, Teresa, Comments) + overflow 8 (Activity, Schema diff, Audience variants, **Share links**, Approvals, Manifest gate, Content library, AI Editor) za jednym `⋯ more`. **Powiązania jako pojęcie Formuły (link do inicjatywy/rodzica) nie istnieje** — „Sources" to źródła-wejścia generacji, nie powiązania-wyjścia. Komentarze ✅ (`DocumentCommentsPanel`, wątki). Historia/AI rozbite: Activity (overflow) + Teresa (primary) + AI Editor (overflow) zamiast jednej sekcji. **Share celowo w overflow, nie w Akcje** — sprzeczne z kanonem „Udostępnij" jako action pierwszej klasy | ❓ DECYZJA (czy spłaszczyć do kanonicznych 5 sekcji, czy 13-tool rail to świadomy wyjątek „wyznacznika rynkowego") |
| **PPM zaznaczenie / blok** | ✅ JEST — `DocumentInlineAIMenu` + `useDocumentInlineAI` mają `acceptProposal`/`rejectProposal` (Zaakceptuj/Odrzuć propozycję AI), zgodnie z formułą | ✅ |

**Ocena:** Word jest NAJBLIŻEJ kanonu z całej dwójki (potwierdza wcześniejszy finding „Word = wyznacznik, blisko" z doktryny G6) — silnik REVIEW/QA/warianty/manifest-gate jest głębszy niż to co Formuła w ogóle przewiduje. Realny gap to **kolejność/widoczność** (Share pogrzebany w overflow zamiast M1 primary) i **brak formalnego „Powiązania"** do rodzica/inicjatywy. Nie jest to fix mechaniczny bez ryzyka: `primaryRightRailTools` ma świadomy komentarz w kodzie „≤5 primary icons" (kanon powłoki Document Studio) — przestawienie Share do primary wymaga decyzji CO wypada (nie luźny dodatek 6. ikony) + weryfikacji wzrokiem. NIE zrobione w tej turze (brak żywego podglądu w tym środowisku).

### 11 · Excel / Sheet (D Matryca · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona arkusza + tytuł · status · zapis · [indeks] · **PRIMARY: „Eksportuj .xlsx"** | ⬜ |
| **M2** | toolbar tabeli: wstaw wiersz/kolumnę · format komórki (liczba/data/waluta) · formuła `fx` · scal komórki · obramowanie | ⬜ |
| **M3** | zakładki arkuszy (sheet tabs) · filtr · sort · zamroź nagłówek · **AI: uzupełnij / policz / wykres** (prawa) | ⬜ |
| **RAIL** | — (lub nawigator arkuszy gdy wiele) | — |
| **PANEL** | ▸ Akcje (**Eksport .xlsx/CSV**, udostępnij) · ▸ Szczegół komórki (formuła/format) · ▸ Właściwości (autor/daty) · ▸ Powiązania · ▸ Historia/AI | ⬜ |
| **PPM komórka / zakres** | Wytnij/Kopiuj/Wklej · Format ▸ · Wstaw/Usuń wiersz-kolumnę · Formuła · —— · Wyczyść | ⬜ |

### 12 · PowerPoint / Deck (E Deck · L)
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona decku + tytuł · status · zapis · [indeks] · **PRIMARY: „Eksportuj / Prezentuj"** | ⬜ |
| **M2** | toolbar slajdu: układ ▾ · tekst · obraz · kształt · wykres/tabela · brand | ⬜ |
| **M3** | dodaj slajd · duplikuj slajd · przejścia · tryb prezentera · **AI: komponuj slajd / przepisz** (prawa) | ⬜ |
| **RAIL** | nawigator slajdów (miniatury) + biblioteka źródeł-artefaktów | ⬜ |
| **PANEL** | ▸ Akcje (**Eksport ▸ PPTX/PDF**, prezentuj, udostępnij) · ▸ Układ slajdu · ▸ Brand kit · ▸ Powiązania · ▸ AI | ⬜ |
| **PPM slajd** | Duplikuj · Przenieś ▸ · Ukryj · Zmień układ ▸ · —— · Usuń | ⬜ |

---

## 5. NASTĘPNY KROK (osobny) — zestawienie i standaryzacja

1. **Diff per przycisk:** przejść każdą tabelę i wypełnić kolumnę **Stan**: `✅ JEST` (działa na demo) / `🔨 DOROBIĆ` / `❓ DECYZJA` — weryfikując REALNY runtime (nie docy), bo audyty się starzeją.
2. **Wychwycić rozjazdy:** ten sam przycisk w różnych miejscach różnych narzędzi (np. Eksport raz w M1, raz w panelu) → sprowadzić do miejsca kanonicznego (§6).
3. **Standaryzacja falami wg archetypu:** A Canvas (1-3) → C Rekord (6-9) → B Dokument (5,10) → D Matryca (4,11) → E Deck (12). Wspólna powłoka `ArtifactRightPanel` już istnieje — adopcja, nie budowa od zera.
4. **Odbiór wzrokiem (DoD §18.1):** per narzędzie zrzuty dark+light → akceptacja Piotra. Dopiero „tak" = ✅.

**Uwaga o reużyciu:** Task/Decision/Insight/KPI pojawiają się w wielu modułach (My Work, Initiatives, Execution, Results) — to JEDEN artefakt, wiele domów. Standaryzujemy raz, działa wszędzie.
