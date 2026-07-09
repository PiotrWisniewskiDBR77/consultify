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
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona notatki + tytuł · status · zapis · [indeks] · **PRIMARY: „Udostępnij"** | ⬜ |
| **M2** | Nagłówek ▾ · B I U · lista • / 1. · wyrównanie · link · obraz/tabela · blok kodu · cytat | ⬜ |
| **M3** | tryb czytania toggle · spis treści (TOC) toggle · komentarze toggle · **AI: napisz / podsumuj / popraw** (prawa) | ⬜ |
| **RAIL** | — (lub outline gdy długa) | — |
| **PANEL** | ▸ Akcje (eksport PDF/DOCX, udostępnij, do notatnika ▸) · ▸ Właściwości (autor/daty/tagi/notatnik) · ▸ Powiązania · ▸ Komentarze · ▸ Wersje/AI | ⬜ |
| **PPM zaznaczenie / blok** | Kopiuj/Wklej · Formatuj ▸ · Link · Komentarz · AI: przepisz/skróć/rozwiń · —— · Duplikuj blok · Zmień typ ▸ · Usuń blok | ⬜ |

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
| Strefa | Przyciski / funkcje | Stan |
|--------|---------------------|:---:|
| **M1** | ← powrót · ikona dokumentu + tytuł · status · zapis · [indeks] · **PRIMARY: „Udostępnij"** (Eksport w panelu) | ⬜ |
| **M2** | Nagłówek ▾ · B I U · lista • / 1. · wyrównanie · link · obraz/tabela · blok kodu · cytat | ⬜ |
| **M3** | tryb czytania toggle · TOC toggle · komentarze toggle · śledź zmiany toggle · **AI: napisz / podsumuj / popraw / rozwiń** (prawa) | ⬜ |
| **RAIL** | — (outline dokumentu gdy długi) | — |
| **PANEL** | ▸ Akcje (**Eksport ▸ PDF/DOCX**, udostępnij) · ▸ Właściwości (autor/daty/tagi/wersja) · ▸ Powiązania (inicjatywa/źródła) · ▸ Komentarze (wątki) · ▸ Wersje/AI | ⬜ |
| **PPM zaznaczenie / blok** | jak Notatnik + „Zaakceptuj/Odrzuć propozycję AI" (śledzenie zmian) | ⬜ |

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
