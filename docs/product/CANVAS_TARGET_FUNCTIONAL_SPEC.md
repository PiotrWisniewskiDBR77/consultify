# Canvas — docelowa specyfikacja funkcjonalna (idealny stan końcowy)

Wersja: 1.0 (2026-06-10). Status: SPEC DOCELOWY — definicja "jak ma działać całość".
Nadrzędne doktryny: V8.1 (Native Artifact Runtime), DELIVERABLES_LIGHT_TARGET (lekki runtime),
benchmark: Claude Artifacts + ChatGPT Canvas + Kimi + Gamma (docs/benchmarks/).
Plan dojścia: `docs/plans/CANVAS_NEXT_STEPS_EXECUTION_PLAN.md`.

---

## 1. Misja

**Canvas to warsztat, w którym rozmowa z Teresą zamienia się w consulting-grade artefakt —
bez formularzy, bez utraty kontekstu, z pełną kontrolą nad każdą zmianą.**
Konsultant mówi, co chce; Teresa planuje, generuje i edytuje; artefakt żyje obok rozmowy,
zna swoje źródła i swoje przeznaczenie, i jednym ruchem staje się notatką, inicjatywą,
PDF-em albo publicznym linkiem.

## 2. Pojęcia (słownik)

| Pojęcie | Definicja |
|---|---|
| **Artefakt** | Trwała jednostka treści: Dokument / Prezentacja / Arkusz. Pierwszoklasowy byt, nie eksport. |
| **Draft** | Robocza postać artefaktu w Canvasie (`work_canvas_drafts`); markdown jako projekcja kanoniczna. |
| **Generacja** | Async proces `plan → generate → validate → draft` (jeden kontrakt, parametr `format`). |
| **Registry** | Kanoniczny indeks artefaktów (Outputs Library) + linki pochodzenia (origin/source). |
| **Materializacja** | Zamiana treści Canvasa w encję workspace (Idea/Notatka/Inicjatywa/Decyzja/Task). |
| **Źródło (sourceRef)** | Encja gruntująca treść: notatka, insight, inicjatywa, wywiad, inny artefakt. |

## 3. Podróże użytkownika (zachowanie idealne, krok po kroku)

### J1 — Tworzenie z czatu ("Napisz raport o transformacji procesu X")
1. Użytkownik pisze intencję po polsku lub angielsku (także odmienioną: "przygotuj prezentację…",
   "zrób mi tabelę…"). Żadnych słów-kluczy do zapamiętania.
2. Teresa odpowiada **checklistą zadań** (wzorzec Kimi): Plan → Treść → Walidacja → Gotowe.
   Każdy krok rozwijalny (tool-trace): jakie sekcje, jakie źródła użyte.
3. Split-view otwiera się **natychmiast po PLAN** ze szkieletem sekcji ("Teresa pisze treść…").
4. Treść wypełnia szkielet na żywo; po zakończeniu panel pokazuje finalny artefakt
   **bez przeładowania**. Plan jest edytowalny przed startem generacji (user może skreślić sekcję).
5. Treść jest ZAWSZE realną prozą w języku rozmowy. Zero placeholderów. Tam, gdzie brak źródeł —
   założenia oznaczone inline (badge "założenie").
6. Błąd generacji = widoczny komunikat w czacie z przyczyną i akcją "Spróbuj ponownie".
   **Nigdy cicha porażka.**
7. W transkrypcie zostaje **chip artefaktu** (ikona typu + tytuł + Otwórz) — trwały po reloadzie.

### J2 — Tworzenie z encji ("Zrób dokument z tego")
1. Na notatce, insighcie, inicjatywie i sesji wywiadu jest akcja kontekstowa
   "Zrób dokument / Zrób prezentację z tego". Jeden klik — zero formularzy.
2. Otwiera się czat z gotowym intentem + przypiętymi źródłami (sourceRefs); dalej przebieg J1.
3. Wygenerowane sekcje mają **chipy źródeł** ("Notatka: Spotkanie z Elkomtech §2") — klik
   otwiera źródło. Treść spoza źródeł → badge założenia.
4. Działa też językiem naturalnym bez wchodzenia na encję: "zrób dokument z notatki o Elkomtech"
   → Teresa wyszukuje (retrieval), pokazuje najlepsze dopasowanie, **potwierdza z użytkownikiem**,
   dopiero potem generuje. Maks 3 kandydatów do wyboru; brak wyniku = mówi wprost.
5. Notatka ma dodatkowo "Rozwiń w dokument": treść notatki staje się draftem do rozbudowy
   (bez generacji); zapis tworzy nową stronę z linkiem do oryginału.

### J3 — Edycja (dokument żyje pod ręką i pod Teresą)
1. **Pisanie bezpośrednie**: pełny rich-edytor (nagłówki, listy, tabele, zadania), autosave,
   bez trybu "tylko podgląd".
2. **Zaznaczenie → menu AI**: Popraw / Skróć / Rozwiń / Ton (Formalny·Prostszy) / Wyjaśnij.
   Każda zmiana przechodzi przez **diff accept/reject** (czerwone usunięcia, zielone wstawki);
   Esc odrzuca. Wyjaśnij niczego nie zmienia — odpowiedź w popoverze.
3. **Polecenie z czatu przy otwartym artefakcie**: "zmień tytuł sekcji 2", "dopisz akapit o ryzyku
   do sekcji Finanse" → **patch chirurgiczny** — zmienia się tylko cel (diff na miejscu),
   nie regeneruje całości; duże polecenia → regeneracja sekcji; pełny rewrite tylko na żądanie.
4. **Streaming**: Teresa pisze do edytora na żywo (append/replace/patch), edytor zablokowany na
   czas strumienia, Esc przerywa. Po strumieniu — normalna edycja.
5. **Prezentacja**: per-karta menu (Regeneruj / Inny układ); regeneracja karty nie dotyka reszty.
   **Arkusz**: edycja komórek inline; struktura przez Teresę.
6. Każda zmiana AI ma provenance (kto/kiedy/jakim promptem/co zastąpiono).

### J4 — Cykl życia artefaktu
1. **Wersje**: każda operacja tworzy wersję; panel historii — krokowanie ‹ ›, podgląd, Przywróć
   (restore = nowa wersja, historia nigdy nie znika).
2. **Wiele artefaktów w rozmowie**: switcher (taby ≤3, dalej dropdown); aktywny artefakt
   pamiętany per rozmowa, przeżywa reload.
3. **Chip w transkrypcie**: zamknięcie panelu nie gubi artefaktu — chip pod wiadomością,
   klik otwiera właściwy artefakt.
4. **Auto-emisja**: gdy odpowiedź Teresy jest de facto dokumentem (samodzielna, długa, z
   nagłówkami), pojawia się chip "Otwórz jako dokument" — bez nachalnego auto-otwierania panelu.

### J5 — Dystrybucja
1. **Eksport**: PDF / DOCX / PPTX / XLSX z natywnymi stylami (nagłówki, tabele — nie zrzut tekstu);
   biblioteki ładowane leniwie.
2. **Share**: jeden klik → publiczny link `/public/artifacts/<token>` (brandowany viewer,
   bez logowania, rate-limit, TTL 7 dni) → kopiuj / **Cofnij udostępnianie** (natychmiastowe 404).
3. **Outputs Library**: kanoniczny dom wszystkich artefaktów — filtry (Typ/Właściciel/Status/Tag),
   statusy (Draft/Review/Final/Sent), akcje: Otwórz, Duplikuj, **Użyj jako szablonu**, Udostępnij,
   Usuń. AI-adresowalna ("zrób nową ofertę z tych trzech dokumentów").

### J6 — Materializacja do workspace (obieg pracy)
1. Z Canvasa jednym ruchem: zapisz jako **Idea** (nagłówki → mapa myśli) / **Notatka** /
   **Inicjatywa** / **Decyzja** / **Task**. Powstają prawdziwe encje z deep-linkiem.
2. **Pętla domknięta w obie strony**: encja nosi badge "Źródło: Canvas (rozmowa)";
   draft pokazuje "Utworzone z tego dokumentu" z linkami; inicjatywa pokazuje sekcję
   "Artefakty" (decki/dokumenty z niej zrodzone).
3. Bezpieczeństwo: każda referencja między encjami walidowana w granicy organizacji (403 przy
   próbie cross-org).
4. Mapa myśli ma "Omów z Teresą" — struktura mapy wchodzi do rozmowy; stamtąd J1/J2.

### J7 — Inteligencja Teresy (zasady zachowania)
1. **Retrieval**: Teresa zna treść organizacji (notatki, insighty, inicjatywy) przez narzędzia
   wyszukiwania; **zawsze potwierdza dopasowanie przed działaniem**; nigdy nie zmyśla treści
   spoza wyników.
2. **Grounding dual-mode**: ze źródłami — cytuje per sekcja; bez źródeł — pisze realną prozę
   z założeniami inline. Nigdy boilerplate.
3. **Język**: artefakt podąża za językiem wiadomości użytkownika, nie ustawień.
4. **Dyscyplina odpowiedzi**: krótko w czacie, treść w artefakcie; checklista zamiast ściany
   tekstu o postępie.

## 4. Macierz stanów artefaktu

```
requested → planning → generating → validating → draft ⇄ (edycje/wersje)
                                                   │
            ┌──────────────┬──────────────┬────────┼──────────────┐
            ▼              ▼              ▼        ▼              ▼
        exported       shared        materialized  in_review → approved/final
        (PDF/…)    (public token,    (idea/note/   (workflow, opcjonalny)
                    revocable)       initiative/
                                     decision/task)
```
Każde przejście: widoczne w UI, odwracalne tam gdzie to ma sens (share→revoke,
wersje→restore), zapisane w provenance.

## 5. Gwarancje jakości (niełamliwe)

1. **Zero placeholderów** w treści użytkownika (gate w generatorze — twardy).
2. **Zero cichych porażek** — każdy błąd ma komunikat i akcję.
3. **Kontekst nigdy nie ginie** — od intencji do artefaktu bez przepisywania promptu.
4. **Historia nigdy nie znika** — wersje append-only.
5. **Granica organizacji** — żadna referencja/wyszukiwanie nie przekracza org.
6. **Provenance wszędzie** — każda treść wie, skąd jest (źródło/AI/człowiek) i dokąd poszła.
7. **Edytor jest jednym źródłem prawdy widoku** — każda zewnętrzna zmiana treści (stream,
   draft-ready, restore, switch) jest widoczna natychmiast, bez reloadu.

## 6. Anti-scope (świadomie NIE — dopóki owner nie zdecyduje inaczej)

- Realtime multiplayer (CRDT) — pojedynczy edytor + wersje wystarczają w v1.
- React/HTML live-apps i AI-powered artifacts (analog `window.claude.complete`).
- Parytet z Airtable/Notion/Gamma w edytorach (formuły, bazy, brand-engine).
- Render narzędzi Ideas w Canvasie — most przez deep-linki (D-C-1).
- Live-sync notatka↔canvas — kopiowanie z provenance (D-C-2).

## 7. Definicja DONE całości (checklista akceptacyjna — testowalna)

Przebieg referencyjny (do QA run, każdy punkt = screenshot/dowód):
- [ ] 1. "Przygotuj prezentację o korzyściach AI dla VTS" → checklista → żywy deck → chip w czacie.
- [ ] 2. "Napisz raport o wdrożeniu X" → szkielet → finalna proza bez reloadu; zero placeholderów.
- [ ] 3. "Zrób tabelę porównania dostawców" → arkusz GFM; round-trip edycji bezstratny.
- [ ] 4. Przy otwartym raporcie: "dopisz sekcję o ryzykach" → streaming do edytora.
- [ ] 5. "Zmień tytuł sekcji 2 na Y" → patch: diff tylko na celu.
- [ ] 6. Zaznacz akapit → Skróć → diff → Accept; Wyjaśnij → popover, dokument nietknięty.
- [ ] 7. Historia: cofnij 2 wersje → podgląd → Przywróć → nowy wpis restore.
- [ ] 8. Drugi artefakt w tej samej rozmowie → switcher; reload → wszystko na miejscu.
- [ ] 9. Z notatki: "Zrób dokument z tego" → sekcje z chipami źródła.
- [ ] 10. W czacie: "zrób dokument z notatki o <temat>" → Teresa znajduje, potwierdza, generuje.
- [ ] 11. Notatka → "Rozwiń w dokument" → edycja → zapis z backlinkiem.
- [ ] 12. Zapisz jako Idea → mapa z nagłówków; badge źródła na encji; "Utworzone z tego dokumentu".
- [ ] 13. Deck z inicjatywy → sekcja "Artefakty" na inicjatywie.
- [ ] 14. Mapa myśli → "Omów z Teresą" → dokument odzwierciedla gałęzie.
- [ ] 15. Eksport PDF + PPTX → natywne style.
- [ ] 16. Share → incognito działa → revoke → 404.
- [ ] 17. Outputs Library: filtr po typie, Duplikuj → nowy draft.
- [ ] 18. Długa raportowa odpowiedź Teresy → chip "Otwórz jako dokument"; small talk → brak chipa.
- [ ] 19. Próba cross-org (sourceRef/target cudzej org) → 403, bez wycieku.
- [ ] 20. Wyłączone flagi → zachowanie legacy bajt-w-bajt (additive proof).
