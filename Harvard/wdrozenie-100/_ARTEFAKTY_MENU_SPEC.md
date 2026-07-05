# ★★★ ARTEFAKTY — SPEC MENU per artefakt (2026-07-05)
> Co MA być w każdym menu każdego artefaktu. Baza: ARTIFACT_ANATOMY_STANDARD §5 (menu per archetyp) + §13 (instancjacja) + §11.2 (powłoka build-ready). Uziemienie realnych pól/akcji encji = przy budowie (skill consultify-artefakty).
> Lista 33 artefaktów: `_ROLLOUT_ARTEFAKTY_PLAN.md`. Decyzje Piotra 07-05: Interview=Rekord z centrum-czatem · Notatka=L.

## Legenda stref (anatomia §2 — 6 stref)
- **M1** = Menu 1 tożsamości (cienki pasek): ← back/breadcrumb · ikona-typ · tytuł inline · status lifecycle · wskaźnik zapisu (osobno) · [indeks] · **1 PRIMARY** (prawa).
- **M2** = Menu 2 listwa edycji — TYLKO archetyp B (formatowanie tekstu) / D-E (toolbar). Rekord/Canvas: brak.
- **M3** = Menu 3 akcje widoku: nawigacja wewn. (klasa L, pill/underline) + view-local + **[AI]** (prawa). Klasa S: brak M3.
- **RAIL** = lewy rail narzędzi — TYLKO archetyp A (znika gdy pusty).
- **PANEL** = prawy panel accordion `ArtifactRightPanel`, sekcje STAŁA kolejność: **Akcje · Właściwości · Powiązania · Komentarze · Historia/AI**.
- **KEBAB/PPM** = menu kontekstowe, kolejność §6.4 (Otwórz·Podgląd — Edytuj·Powiel·Zmień nazwę — Eksport·Udostępnij·Przenieś — AI — Archiwizuj·Usuń).

---

# ARCHETYP C — REKORD (12 artefaktów)
Centrum = sekcje pól. **M2 = brak · RAIL = brak.** Klasa S: nośnik treści = prawy panel (drawer), brak M3. Klasa L: M3 = zakładki sekcji.

## Wspólny szkielet (identyczny dla wszystkich Rekordów)
- **M1:** ← · ikona-typ · tytuł inline · status lifecycle · „Zapisano •" · [indeks] · **PRIMARY = przejście stanu** (per artefakt niżej).
- **M2:** — (rekord nie edytuje tekstu ciągłego).
- **M3:** klasa S → brak. Klasa L → pill-zakładki sekcji + [AI: uzupełnij] (prawa).
- **RAIL:** —
- **PANEL (accordion):** Akcje (Eksport▸/Udostępnij/Kopiuj-link) · Właściwości (owner/daty/status/prio/budżet…) · Powiązania (klikalne linki) · Komentarze · Historia/AI. Klasa S: panel = całe centrum drawera.
- **KEBAB:** Otwórz·Podgląd — Edytuj·Powiel·Zmień nazwę — Eksport▸·Udostępnij·Przenieś▸ — AI:uzupełnij — Archiwizuj·Usuń(danger).

## Per artefakt — delta (ikona · otwiera · M1 PRIMARY · M3 zakładki (L) · PANEL sekcje kluczowe)
| # | Artefakt | Ikona | Otwiera | M1 PRIMARY | M3 zakładki (klasa L) | PANEL — sekcje kluczowe |
|---|----------|-------|---------|-----------|------------------------|--------------------------|
| 17 | **Initiative** (L) | `target` | pełna | „Submit for Review" (wg statusu) | Przegląd · Zadania · Definicja · Wdrożenie · Ekonomia · Governance · Zespół | Właściwości(owner/sponsor/budżet/oś) · Powiązania(KPI/tasks/źródła) · Komentarze · Historia |
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
| 28 | **Interview Session** (L) | `messages-square` | pełna | „Zakończ / Generuj insights" | Rozmowa · Pytania · Insights · Podsumowanie | Właściwości(respondent/status/postęp) · Powiązania(inicjatywy/insights) · Historia. **Centrum = czat** (nie sekcje pól) |

**Uwaga Interview (§20 Q2):** powłoka Rekordu (M1/panel/kebab identyczne), jedyna różnica = centrum to konwersacja zamiast sekcji-pól.

---

# ★ GRUPA TIER-1 — 8 NARZĘDZI TREŚCI (identyczny układ menu, delty per narzędzie)
> Dyrektywa Piotra (2026-07-05): Idee (Mind Map · Process Flow · Whiteboard · Tabela — żyją w jednym miejscu,
> My Work → Ideas) + Dokumenty (Word/Wordy · Excel/Arkusz · Prezentacja/Deck) + Notatka = **8 głównych narzędzi,
> które muszą działać NAJBARDZIEJ solidnie**. Wszystkie mają TEN SAM układ menu (stałe pozycje);
> nie wszystkie elementy występują wszędzie i nie wszystkie działają tak samo — ale pozycja elementu jest żelazna.

## T0. WSPÓLNY UKŁAD (jeden szkielet dla wszystkich 8)
```
╔══════════════════════════════════════════════════════════════════════════╗
║ M1  [←] [ikona] [Tytuł inline] [status] [Zapisano •] [ID·link]            ║
║                      (prawa) [przełącznik narzędzia*] [✦AI] … [PRIMARY]   ║
╟──────────────────────────────────────────────────────────────────────────╢
║ M2  listwa TREŚCI — zależna od typu centrum (canvas: BRAK — pasek znika)  ║
╟──────────────────────────────────────────────────────────────────────────╢
║ M3  [kontrolki widoku: zoom/dopasuj/siatka | tryb/TOC | dane/widoki]      ║
║                                                        (prawa) [✦ AI]    ║
╟──────┬──────────────────────────────────────────────┬────────────────────╢
║ RAIL │              CENTRUM                          │ PANEL (accordion)  ║
║ narz.│   (canvas / tekst / siatka / slajdy)          │ Akcje·Właściwości· ║
║ (A/E)│         + PPM = lustro akcji                  │ Powiązania·Koment.·║
║      │                                               │ Historia/AI        ║
╚══════╧══════════════════════════════════════════════╧════════════════════╝
```
**Reguły żelazne układu:**
1. **Pozycja elementu jest stała.** Element nieobecny w danym narzędziu ZNIKA (bez luki), ale NIGDY nie zmienia kolejności pozostałych. Użytkownik, który zna jedno narzędzie, zna wszystkie.
2. **M2 istnieje tylko, gdy centrum ma listwę treści** (tekst/siatka/slajd). Canvas (MM/PF/WB) nie ma M2 — jego „narzędzia" żyją w RAILu (czasowniki przy lewej ręce, treść w centrum).
3. **RAIL znika, gdy pusty** (nie rezerwujemy miejsca).
4. **[✦ AI] zawsze na skraju prawym M3** — to samo miejsce w każdym narzędziu; zestaw akcji AI różny per narzędzie (T3).
5. **PANEL = ArtifactRightPanel** (5 sekcji, stała kolejność). Sekcja **Właściwości jest kontekstowa**: nic nie zaznaczono → właściwości artefaktu; zaznaczony element (węzeł/kształt/komórka/blok/slajd) → właściwości elementu (progresywne ujawnianie).
6. **PPM = lustro** akcji na klikniętym elemencie, kolejność §6.4 kanonu.
7. `*` **Przełącznik narzędzia** (segment 4 ikon: MM·PF·WB·Tabela) występuje TYLKO w grupie Idee — cztery narzędzia to jedna przestrzeń robocza (jeden pomysł, cztery widoki pracy; dziś: IdeaMapWorkspace, Alt+1..4).

## T1. MATRYCA OBECNOŚCI — element × narzędzie (✓ = jest · w = wariant · — = brak)
| Element (pozycja stała) | MM | PF | WB | Tabela | Word | Excel | Deck | Notatka |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **M1** ← · ikona · tytuł inline · status · zapis · ID/link | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **M1** przełącznik narzędzia (MM·PF·WB·Tab) | ✓ | ✓ | ✓ | ✓ | — | — | — | — |
| **M1** PRIMARY | Konwertuj→inicjatywa | ← to samo | ← to samo | ← to samo | Eksportuj ▸ | Eksportuj ▸ | Eksportuj / Prezentuj | Udostępnij |
| **M2** listwa treści | — | — | — | toolbar tabeli | formatowanie tekstu | toolbar arkusza | toolbar slajdu | formatowanie lekkie |
| **M3** kontrolki widoku (lewa) | zoom·dopasuj·minimapa | zoom·dopasuj·minimapa·siatka | zoom·dopasuj·siatka | Dane·Widoki·filtr/sort | Czytaj/Edytuj·TOC·komentarze | Dane·Wizualizacje·filtr/sort | +slajd·duplikuj·notatki prelegenta | tryb czytania·backlinks |
| **M3** [✦ AI] (skraj prawy) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **RAIL** lewy | narzędzia canvas | narzędzia canvas | narzędzia canvas | — | — (outline gdy długi) | — | nawigator slajdów + źródła | — |
| **PANEL** accordion (5 sekcji) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **PPM** na elemencie | węzeł | krok/strzałka/lane | kształt/rysunek | komórka/kolumna/wiersz | zaznaczenie/blok | komórka/kolumna/wiersz | slajd/blok | zaznaczenie/blok |

## T2. DELTY PER NARZĘDZIE

### GRUPA IDEE (jedna przestrzeń, 4 widoki pracy; wszystkie: PRIMARY = „Konwertuj → inicjatywa")
**T2.1 Mind Map** `network`
- **RAIL:** wskaźnik/zaznacz · + węzeł · połącz · kolor ▸ · sticky · komentarz.
- **M3:** zoom ± · dopasuj · minimapa (toggle) ‖ ✦AI.
- **PANEL-Właściwości (element):** węzeł — tekst, kolor, typ, rozmiar; (artefakt) — nazwa mapy, źródło, tagi.
- **PPM węzeł:** Edytuj · Powiel · Połącz z… · Kolor ▸ · Komentarz · — · Usuń. **PPM płótno:** Wklej · +węzeł tutaj · Zaznacz wszystko · Dopasuj widok.

**T2.2 Process Flow** `workflow`
- **RAIL:** wskaźnik · + krok · + decyzja (romb) · połącz/strzałka · swimlane · tekst · komentarz.
- **M3:** zoom ± · dopasuj · minimapa · siatka (toggle) ‖ ✦AI.
- **PANEL-Właściwości (element):** krok — nazwa, typ, właściciel, opis; strzałka — etykieta, warunek; lane — nazwa, rola.
- **PPM krok:** Edytuj · Powiel · Połącz z… · Zmień typ ▸ · Komentarz · — · Usuń.

**T2.3 Whiteboard** `pen-tool`
- **RAIL:** wskaźnik · pióro/rysuj · kształt ▸ · tekst · sticky · obraz · komentarz · gumka.
- **M3:** zoom ± · dopasuj · siatka ‖ ✦AI.
- **PANEL-Właściwości (element):** kształt/rysunek — kolor, grubość, wypełnienie, warstwa.
- **PPM kształt:** Edytuj · Powiel · Kolor ▸ · Warstwa ▸ (przód/tył) · — · Usuń.

**T2.4 Tabela (Idea Table)** `table`
- **M2 (toolbar tabeli):** + wiersz · + kolumna · typ pola ▸ · formuła (fx) · formatowanie warunkowe · sort/filtr.
- **M3:** Dane · Widoki (grid/kanban) · filtr/sort ‖ ✦AI.
- **PANEL-Właściwości (element):** kolumna — typ, formuła, format; komórka — wartość, walidacja.
- **PPM kolumna:** Zmień typ ▸ · Sortuj · Filtruj · Ukryj · — · Usuń kolumnę. **PPM wiersz:** Otwórz · Powiel · — · Usuń.

### GRUPA DOKUMENTY (Materiały)
**T2.5 Word / Wordy** `file-text` — PRIMARY: **Eksportuj ▸** (PDF/DOCX)
- **M2 (formatowanie):** Nagłówek ▾ · **B I U** · lista • / 1. · wyrównanie · link · obraz/tabela · blok ▸ (wykres/KPI/callout).
- **M3:** tryb Czytaj/Edytuj · TOC (toggle) · komentarze (toggle) ‖ ✦AI.
- **PANEL-Właściwości:** autor, daty, tagi, szablon źródłowy, status recenzji.
- **PPM zaznaczenie:** Wytnij/Kopiuj/Wklej · Formatuj ▸ · Link · Komentarz · ✦Przepisz/Skróć/Rozwiń. **PPM blok:** Duplikuj · Przenieś ↑↓ · Zmień typ ▸ · — · Usuń blok.

**T2.6 Excel / Arkusz** `table-2` — PRIMARY: **Eksportuj ▸** (XLSX/CSV)
- **M2 (toolbar arkusza):** + wiersz · + kolumna · format komórki ▸ (waluta/%/data) · formuła (fx) · formatowanie warunkowe · sort/filtr. *(Celowo IDENTYCZNY układ jak Tabela-Idea T2.4 — różni się tylko primary i brakiem przełącznika narzędzi.)*
- **M3:** Dane · Wizualizacje · Wglądy (AI) ‖ ✦AI.
- **PANEL-Właściwości (element):** komórka — formuła, format, walidacja; kolumna — typ, agregacja; (artefakt) — arkusze, zakresy nazwane.
- **PPM komórka:** Kopiuj/Wklej · Format ▸ · Formuła · Komentarz · — · Wyczyść.

**T2.7 Prezentacja / Deck** `presentation` — PRIMARY: **Eksportuj / Prezentuj**
- **M2 (toolbar slajdu):** Układ ▾ · tekst · obraz · kształt · wykres/tabela.
- **M3:** + slajd · duplikuj slajd · notatki prelegenta (toggle) ‖ ✦AI.
- **RAIL:** nawigator miniatur slajdów + biblioteka źródeł (artefakty do wstawienia).
- **PANEL-Właściwości:** slajd — układ, motyw/brand; (artefakt) — motyw globalny, brand kit, format eksportu.
- **PPM slajd (w nawigatorze):** Duplikuj · Przenieś ▸ · Ukryj · Zmień układ ▸ · — · Usuń. **PPM blok na slajdzie:** Edytuj · Zamień ▸ · Warstwa ▸ · — · Usuń.

### NOTATKA
**T2.8 Notatka (Notebook)** `notebook-pen` — PRIMARY: **Udostępnij** — klasa L (pełna strona; decyzja Piotra 07-05)
- **M2 (formatowanie lekkie):** Nagłówek ▾ · **B I U** · lista · link · załącznik.
- **M3:** tryb czytania (toggle) · backlinks (toggle) ‖ ✦AI.
- **PANEL:** Właściwości (notebook, tagi, personal/team) · **Powiązania = backlinki first-class** (dwustronne linki @wzmianka) · Komentarze · Historia/AI.
- **PPM zaznaczenie:** Formatuj ▸ · Link · ✦Podsumuj/Rozwiń/Zamień-na-zadania.

## T3. AKCJE AI PER NARZĘDZIE (przycisk ✦ — to samo miejsce, inny zestaw)
| Narzędzie | Zestaw akcji ✦AI (M3 prawa + sekcja Historia/AI panelu) |
|---|---|
| Mind Map | Podpowiedz gałęzie · Klasteryzuj węzły · Podsumuj mapę · Konwertuj na inicjatywy (propozycja) |
| Process Flow | Zaproponuj proces z opisu · Uzupełnij brakujące kroki · Waliduj przepływ (luki/pętle) |
| Whiteboard | Uporządkuj/wyrównaj · Klasteryzuj sticky · Podsumuj do notatki |
| Tabela / Excel | Zaproponuj kolumny/schemat · Wypełnij z opisu · Analizuj (wnioski z danych) · Formuła z opisu |
| Word | Napisz sekcję · Podsumuj · Popraw styl · (na zaznaczeniu) Przepisz/Skróć/Rozwiń |
| Deck | Komponuj slajd · Wariant układu · Dopasuj narrację (ton/odbiorca) |
| Notatka | Podsumuj · Rozwiń · Zamień na zadania (propozycja do My Work) |

## T4. DoD GRUPY TIER-1 (poprzeczka solidności — te 8 odbieramy najostrzej)
- Układ zgodny z T0/T1 co do POZYCJI każdego elementu (matryca = kontrakt; odstępstwo = błąd, nie wariant).
- Pełny DoD artefaktu §18.1 (Menu1 komplet · panel accordion · stany · tokeny c-* · zero crimson) + niezmienniki §15.3 (zaznaczenie→panel, hover, drag=shadow, klawiatura, Esc).
- Autosave ze wskaźnikiem w M1 (osobno od statusu) + guard niezapisanych zmian.
- Odbiór OCZAMI każdego z 8 (dark+light, PPM, panel, AI-slot) — priorytet nad wszystkimi innymi artefaktami.
- Grupa Idee: przełącznik narzędzia zachowuje kontekst (przełączenie MM↔PF↔WB↔Tab nie gubi pracy).
