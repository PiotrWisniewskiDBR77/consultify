# ★★★ ARTEFAKTY — SPEC MENU per artefakt (2026-07-05, v2)
> Co MA być w każdym menu każdego artefaktu. Baza: **`docs/ui-standards/02-components/editor-shell-canon.md` (D-I — NADRZĘDNY dla powłoki edytorów)** + ARTIFACT_ANATOMY_STANDARD §5/§11.2/§13. Uziemienie realnych pól/akcji encji = przy budowie (skill consultify-artefakty).
> Lista 33 artefaktów: `_ROLLOUT_ARTEFAKTY_PLAN.md`. Decyzje Piotra 07-05: Interview=Rekord z centrum-czatem · Notatka=L.
> **v2 (07-05):** korekta po ponownym odnalezieniu Editor Shell Canon — narzędzia canvas = PŁYWAJĄCA paleta (nie kolumna), command row z HIERARCHIĄ (primary/secondary/⋯), inspector ≤5 sekcji. Zastępuje v1.

## Legenda stref (anatomia §2 + editor-shell-canon §2)
- **L1** = linia tożsamości: ← back/breadcrumb · ikona-typ · tytuł inline · status lifecycle · wskaźnik zapisu (osobno) · ID/link · **1 PRIMARY artefaktu** (prawa).
- **L2** = command row (akcje edytora, JEDNA linia z hierarchią): primary 1-4 · secondary ghost · segmented-tryb (max 1) · kontrolki widoku · **`⋯` overflow** ‖ **[✦ AI]** (skraj prawy).
- **L3** = listwa treści — TYLKO edytory dokumentowe (formatowanie tekstu / toolbar arkusza / toolbar slajdu). Canvas i Rekord: brak.
- **LEWA KOLUMNA** = struktura treści (rzeczowniki): karty/slajdy/outline/arkusze. Zwijalna.
- **PALETA** = pływające narzędzia canvas NA płótnie (czasowniki), półprzezroczysta, przy lewej krawędzi — NIE kolumna powłoki (editor-shell-canon: ZAKAZ raila w sidebarze).
- **PANEL** = prawa kolumna: inspector `ArtifactRightPanel`, **≤5 sekcji widocznych**, stała kolejność: **Akcje · Właściwości · Powiązania · Komentarze · Historia/AI**; pogrupowany separatorami; kontekstowy (artefakt ↔ zaznaczony element).
- **PPM** = menu kontekstowe, lustro przycisków, **portal do body** (z-context-menu=120), kolejność §6.4.

## ★ PRAWO LOKALIZACJI (uczy użytkownika — każda strefa znaczy ZAWSZE to samo)
| Strefa | Znaczenie — w KAŻDYM artefakcie |
|---|---|
| **Linia 1** | KIM JESTEM — tożsamość + jedno główne działanie artefaktu |
| **Linia 2** | CO ROBIĘ — akcje edytora (1-4 najważniejsze widoczne, reszta ghost/`⋯`) + tryb + widok + ✦AI |
| **Linia 3** | JAK FORMATUJĘ — listwa treści (tylko gdy centrum = tekst/siatka/slajd) |
| **Lewa kolumna** | GDZIE JESTEM w treści — struktura (karty · slajdy · outline · arkusze) |
| **Pływająca paleta** | CZYM TWORZĘ — narzędzia rysowania, na płótnie (tylko canvas) |
| **Prawa kolumna** | SZCZEGÓŁY ZAZNACZENIA — inspector ≤5 sekcji; nic nie zaznaczono → właściwości artefaktu |
| **PPM** | LUSTRO — te same akcje co przyciski, przy kursorze, nad wszystkim |

---

# ARCHETYP C — REKORD (12 artefaktów)
Centrum = sekcje pól. **L3 = brak · PALETA = brak.** LEWA KOLUMNA = lista kart (żywy wzorzec: Initiative/Task/Decision). Klasa S: drawer — nośnik treści = panel, bez L2/lewej kolumny.

## Wspólny szkielet (identyczny dla wszystkich Rekordów)
- **L1:** ← · ikona-typ · tytuł inline · status lifecycle · „Zapisano •" · ID/link · **PRIMARY = przejście stanu** (per artefakt niżej).
- **L2 (klasa L):** primary-akcje (np. + Nowy element · Eksport · Zrób materiał) · secondary ghost · `⋯` ‖ ✦AI. Klasa S: pasek akcji stanu w drawerze (Start/Block… wg artefaktu).
- **LEWA KOLUMNA (klasa L):** lista kart pogrupowana (SCOPE&PLAN · DECISIONS&RISK · PEOPLE · OUTCOMES · RECORDS), reorder, zwijalne grupy.
- **PANEL:** Akcje (Eksport▸/Udostępnij/Kopiuj-link) · Właściwości (owner/daty/status/prio/budżet…) · Powiązania (klikalne) · Komentarze · Historia/AI. Klasa S: panel = całe centrum drawera.
- **PPM:** Otwórz·Podgląd — Edytuj·Powiel·Zmień nazwę — Eksport▸·Udostępnij·Przenieś▸ — AI:uzupełnij — Archiwizuj·Usuń(danger).

## Per artefakt — delta (ikona · otwiera · L1 PRIMARY · lewa kolumna (L) · PANEL sekcje kluczowe)
| # | Artefakt | Ikona | Otwiera | L1 PRIMARY | Lewa kolumna (klasa L) | PANEL — sekcje kluczowe |
|---|----------|-------|---------|-----------|------------------------|--------------------------|
| 17 | **Initiative** (L) | `target` | pełna | „Submit for Review" (wg statusu) | karty wg grup (katalog kart) | Właściwości(owner/sponsor/budżet/oś) · Powiązania(KPI/tasks/źródła) · Komentarze · Historia |
| 18 | Task (S) | `check-square` | drawer | „Oznacz done" | — (S) | Właściwości(status/prio/owner/termin) · Podzadania · Powiązania · Komentarze · Historia |
| 19 | Decision (S) | `scale` | drawer | „Zatwierdź" | — | Opcje · Wpływ · Zatwierdzenia · Powiązania · Historia |
| 20 | KPI (S) | `gauge` | drawer | „Zapisz pomiar" | — | Formuła · Cel/baza · Powiązane inicjatywy · Historia |
| 21 | Insight (S) | `gem` | drawer | „Konwertuj → inicjatywa" | — | Dowody · Kategoria · Powiązania · Historia |
| 22 | Idea / Concept (S) | `lightbulb` | drawer | „Konwertuj → inicjatywa" | — | Tagi · Źródło · Powiązania |
| 23 | RAID (S) | `shield-alert` | drawer | „Zamknij" | — | Kategoria · Prawdopod./wpływ · Mitygacja · Owner · Historia |
| 24 | Milestone (S) | `flag` | drawer | „Oznacz osiągnięty" | — | Data · Powiązane dostawy · Zależności |
| 25 | Change Request (S) | `git-pull-request` | drawer | „Zatwierdź zmianę" | — | Wpływ · Plan wdrożenia · CCB · Historia |
| 26 | Stage Gate (S) | `shield-check` | drawer | „Zatwierdź bramę" | — | Kryteria · Dostawy · Zatwierdzający |
| 27 | Action Proposal (S) | `wand-2` | drawer | „Akceptuj" / „Odrzuć" | — | Uzasadnienie AI · Wpływ · Dowody |
| 28 | **Interview Session** (L) | `messages-square` | pełna | „Zakończ / Generuj insights" | Rozmowa · Pytania · Insights · Podsumowanie | Właściwości(respondent/status/postęp) · Powiązania · Historia. **Centrum = czat** |

**Uwaga Interview (§20 Q2):** powłoka Rekordu (L1/panel/PPM identyczne), jedyna różnica = centrum to konwersacja.

---

# ★ GRUPA TIER-1 — 8 NARZĘDZI TREŚCI (jeden układ, delty per narzędzie) — v2 wg Editor Shell Canon
> Idee (Mind Map · Process Flow · Whiteboard · Tabela — jedna przestrzeń, My Work → Ideas) + Dokumenty
> (Word/Wordy · Excel/Arkusz · Prezentacja/Deck) + Notatka = **8 narzędzi, które muszą działać NAJBARDZIEJ solidnie**.
> Ten sam układ (Prawo lokalizacji ↑); nie wszystkie elementy występują wszędzie — pozycja jest żelazna.

## T0. WSPÓLNY UKŁAD (jeden szkielet dla 8)
```
╔══════════════════════════════════════════════════════════════════════════════╗
║ L1  [←][ikona][Tytuł][status][Zapisano •][ID·link]  [przełącznik*]  [PRIMARY] ║
╟──────────────────────────────────────────────────────────────────────────────╢
║ L2  [primary-akcje 1-4] [secondary ghost] [tryb▾ max1] [widok] [⋯]      [✦AI] ║
╟──────────────────────────────────────────────────────────────────────────────╢
║ L3  listwa treści (formatowanie / arkusz / slajd) — canvas: BRAK (linia znika)║
╟─────────────┬──────────────────────────────────────────┬─────────────────────╢
║ LEWA KOLUMNA│  ┌paleta┐        CENTRUM                  │ PANEL (inspector)   ║
║ = STRUKTURA │  │pływa │   (canvas/tekst/siatka/slajdy)  │ ≤5 sekcji accordion ║
║ (zwijalna)  │  └(A)───┘        + PPM (portal)           │ kontekstowy         ║
╚═════════════╧══════════════════════════════════════════╧═════════════════════╝
```
**Reguły żelazne:**
1. **Pozycja stała; nieobecne znika bez luki** — nigdy nie przestawia pozostałych. Kto zna jedno narzędzie, zna wszystkie.
2. **L2 = JEDNA linia z hierarchią** (editor-shell-canon): primary 1-4 wyróżnione · secondary ghost · rzadkie pod `⋯` · max JEDEN segmented-tryb z opisami · **zero duplikatów wejść AI** (jedno ✦ na skraju prawym).
3. **Narzędzia canvas = PŁYWAJĄCA paleta na płótnie** (półprzezroczysta, zaokrąglona, margines od krawędzi; kursor·kształty·+·undo/redo·zoom). **ZAKAZ kolumny-raila w powłoce/sidebarze** (UI-L1).
4. **Lewa kolumna = zawsze struktura treści** (rzeczowniki). Brak struktury → kolumny nie ma.
5. **PANEL = ArtifactRightPanel:** ≤5 sekcji widocznych (Akcje·Właściwości·Powiązania·Komentarze·Historia/AI), grupy z separatorami, sekcja Właściwości kontekstowa (artefakt ↔ zaznaczony element).
6. **PPM = lustro, portal do body** (z-context-menu), bogate na elemencie (styl/kolor · dodaj · połącz · AI · przenieś · convert), kolejność §6.4.
7. `*` **Przełącznik narzędzia** (segment MM·PF·WB·Tabela) tylko w grupie Idee — jedna przestrzeń robocza, 4 widoki pracy; przełączenie NIE gubi kontekstu.
8. **Z-index wg tokenów** (editor-shell-canon §3): app-chrome > overlay > canvas; żadnych surowych `z-[9999]`.

## T1. MATRYCA OBECNOŚCI — element × narzędzie (✓ jest · — brak)
| Element (pozycja stała) | MM | PF | WB | Tabela | Word | Excel | Deck | Notatka |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **L1** tożsamość (komplet) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **L1** przełącznik narzędzia | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| **L1** PRIMARY | Konwertuj→inicjatywa | ←tożsamo | ←tożsamo | ←tożsamo | Eksportuj ▸ | Eksportuj ▸ | Eksportuj/Prezentuj | Udostępnij |
| **L2** primary-akcje (1-4) | +węzeł · Auto-układ · Dyskutuj | +krok · +decyzja · Waliduj | +sticky · +kształt | +wiersz · +kolumna · Widok▾ | Tryb Czytaj/Edytuj · TOC | Dane · Wizualizacje | +slajd · Duplikuj · Motyw▾ | Tryb czytania · Backlinks |
| **L2** `⋯` overflow | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **L2** ✦AI (skraj prawy) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **L3** listwa treści | — | — | — | toolbar tabeli | formatowanie | toolbar arkusza | toolbar slajdu | formatowanie lekkie |
| **Lewa kolumna** (struktura) | — *(later: warstwy/ramki)* | — *(later: lane'y)* | — | widoki/arkusze | outline | arkusze | **miniatury slajdów** | — |
| **Paleta pływająca** | ✓ | ✓ | ✓ | — | — | — | — | — |
| **PANEL** inspector ≤5 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **PPM** na elemencie | węzeł | krok/strzałka/lane | kształt/rysunek | komórka/kolumna/wiersz | zaznaczenie/blok | komórka/kolumna/wiersz | slajd/blok | zaznaczenie/blok |

## T2. DELTY PER NARZĘDZIE

### GRUPA IDEE (jedna przestrzeń; wszystkie: L1 PRIMARY = „Konwertuj → inicjatywa")
**T2.1 Mind Map** `network` — PALETA: kursor · +węzeł · połącz · kolor ▸ · sticky · komentarz · undo/redo · zoom±/dopasuj/minimapa. L2 primary: +węzeł · Auto-układ · Dyskutuj z Teresą; `⋯`: eksport obrazu, siatka, ustawienia mapy. PANEL-Właściwości(element): węzeł — tekst/kolor/typ; (artefakt): nazwa/źródło/tagi. PPM węzeł: Edytuj · Powiel · Dodaj dziecko · Połącz z… · Kolor ▸ · ✦Rozwiń · Przenieś do ▸ · — · Usuń.
**T2.2 Process Flow** `workflow` — PALETA: kursor · +krok · +decyzja(romb) · strzałka · swimlane · tekst · undo/redo · zoom±/dopasuj/siatka. L2 primary: +krok · +decyzja · ✦Waliduj przepływ. PANEL(element): krok — nazwa/typ/właściciel; strzałka — etykieta/warunek; lane — nazwa/rola. PPM krok: Edytuj · Powiel · Połącz z… · Zmień typ ▸ · — · Usuń.
**T2.3 Whiteboard** `pen-tool` — PALETA: kursor · pióro · kształt ▸ · tekst · sticky · obraz · gumka · undo/redo · zoom±/dopasuj. L2 primary: +sticky · +kształt · ✦Uporządkuj. PANEL(element): kolor/grubość/wypełnienie/warstwa. PPM: Edytuj · Powiel · Kolor ▸ · Warstwa ▸ · — · Usuń.
**T2.4 Tabela (Idea Table)** `table` — L3: +wiersz · +kolumna · typ pola ▸ · fx · formatowanie warunkowe · sort/filtr. L2 primary: +wiersz · +kolumna · Widok▾ (grid/kanban). Lewa kolumna: widoki. PANEL(element): kolumna — typ/formuła/format; komórka — wartość/walidacja. PPM kolumna: Zmień typ ▸ · Sortuj · Filtruj · Ukryj · — · Usuń.

### GRUPA DOKUMENTY (Materiały)
**T2.5 Word/Wordy** `file-text` — PRIMARY: Eksportuj ▸ (PDF/DOCX). L3: Nagłówek▾ · B I U · listy · wyrównanie · link · obraz/tabela · blok ▸ (wykres/KPI/callout). L2 primary: Tryb Czytaj/Edytuj · TOC; `⋯`: historia wersji, statystyki. Lewa kolumna: outline. PPM zaznaczenie: Formatuj ▸ · Link · Komentarz · ✦Przepisz/Skróć/Rozwiń. PPM blok: Duplikuj · Przenieś ↑↓ · Zmień typ ▸ · — · Usuń.
**T2.6 Excel/Arkusz** `table-2` — PRIMARY: Eksportuj ▸ (XLSX/CSV). L3: **identyczny układ jak T2.4** (+wiersz · +kolumna · format komórki ▸ · fx · form. warunkowe · sort/filtr). L2 primary: Dane · Wizualizacje · ✦Wglądy. Lewa kolumna: arkusze. PANEL(element): komórka — formuła/format/walidacja; kolumna — typ/agregacja. PPM komórka: Kopiuj/Wklej · Format ▸ · Formuła · Komentarz · — · Wyczyść.
**T2.7 Prezentacja/Deck** `presentation` — PRIMARY: Eksportuj / Prezentuj. L3: Układ▾ · tekst · obraz · kształt · wykres/tabela. L2 primary: +slajd · Duplikuj · Motyw▾; `⋯`: notatki prelegenta, przejścia. **Lewa kolumna: nawigator miniatur + biblioteka źródeł.** PANEL: slajd — układ/brand; (artefakt) — motyw/brand-kit/format. PPM slajd: Duplikuj · Przenieś ▸ · Ukryj · Zmień układ ▸ · — · Usuń.

### NOTATKA
**T2.8 Notatka** `notebook-pen` — PRIMARY: Udostępnij (klasa L). L3: Nagłówek▾ · B I U · lista · link · załącznik. L2 primary: Tryb czytania · Backlinks. PANEL: Właściwości (notebook/tagi/personal-team) · **Powiązania = backlinki first-class** · Komentarze · Historia/AI. PPM zaznaczenie: Formatuj ▸ · Link · ✦Podsumuj/Rozwiń/Zamień-na-zadania.

## T3. AKCJE ✦AI PER NARZĘDZIE (to samo miejsce, inny zestaw; jedno wejście AI — bez duplikatów)
| Narzędzie | Zestaw ✦AI |
|---|---|
| Mind Map | Podpowiedz gałęzie · Klasteryzuj · Podsumuj mapę · Konwertuj na inicjatywy (propozycja) |
| Process Flow | Zaproponuj proces z opisu · Uzupełnij kroki · Waliduj (luki/pętle) |
| Whiteboard | Uporządkuj/wyrównaj · Klasteryzuj sticky · Podsumuj do notatki |
| Tabela / Excel | Zaproponuj schemat · Wypełnij z opisu · Analizuj dane · Formuła z opisu |
| Word | Napisz sekcję · Podsumuj · Popraw styl · (zaznaczenie) Przepisz/Skróć/Rozwiń |
| Deck | Komponuj slajd · Wariant układu · Dopasuj narrację |
| Notatka | Podsumuj · Rozwiń · Zamień na zadania |

## T4. DoD TIER-1 (poprzeczka solidności — odbiór najostrzejszy)
- Układ = Prawo lokalizacji + matryca T1 co do POZYCJI (odstępstwo = błąd, nie wariant).
- Kryterium „Shell ✅" z editor-shell-canon §5: 3 strefy · z-index tokeny · jeden motyw · L2 z hierarchią · panel ≤5 sekcji · PPM portal+bogate · zero raila-w-sidebarze · klasa wizualna 2026.
- Pełny DoD artefaktu §18.1 + niezmienniki §15.3 (zaznaczenie→panel, hover, drag=shadow, klawiatura, Esc).
- Autosave ze wskaźnikiem w L1 (osobno od statusu) + guard niezapisanych zmian.
- Grupa Idee: przełącznik narzędzia zachowuje kontekst pracy.
- Sekwencja rozjazdu (editor-shell-canon §5): **wzorzec = Mind Map → akcept Piotra na demo → rozjazd na 6 pozostałych + Notatka-audyt**.
