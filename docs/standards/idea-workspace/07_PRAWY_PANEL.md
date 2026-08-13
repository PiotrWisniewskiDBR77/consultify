# 07 — Prawy panel

> **Zastąpienie kierunku 2026-08-09:** treść tego panelu pozostaje ważna, ale
> jest renderowana w jednym panelu po lewej. Prawa krawędź canvasa należy do
> raila narzędzi, a skrajna prawa powierzchnia wyłącznie do globalnej Teresy.
> Kontrakt migracji: [rozdział 13](13_MIGRACJA_NAWIGACJI_2026-08-09.md).

Prawy panel to system informacji o Idei i o tym, co jest zaznaczone. Dziś działa najgorzej ze wszystkich powierzchni — pięć ikon udaje zakładki, ale nie przełącza treści, a układ miesza poziomy informacji. Ten rozdział opisuje panel docelowy: **jeden kanon dla całego produktu**, z zaakceptowanym językiem wizualnym.

## 1. Decyzja: jeden kanon dla Idei i kart N (D1)

Produkt miał dwa różne kanony prawego panelu:
- **SPEC-A** (`ARTIFACT_ANATOMY_STANDARD §708`): Akcje · Właściwości · Powiązania · Komentarze · Historia/AI — używany przez 7 kart N.
- **Propozycja dla Idei:** Przegląd · Inspektor · Powiązania · Komentarze · Historia.

**Trzy z pięciu zakładek były już identyczne.** Właściciel zdecydował o ujednoliceniu. Kanon obowiązujący w całym produkcie:

> **Przegląd · Właściwości · Powiązania · Komentarze · Historia**

| Zakładka | Odpowiada na pytanie | W Idei (płótno) | W karcie N (rekord) |
|---|---|---|---|
| **Przegląd** | Czym jest ten obiekt jako całość? | brief, etap, kompletność, statystyki, rekomendowany krok | streszczenie, status, właściciel, kluczowe pola, następny krok |
| **Właściwości** | Jakie są szczegóły tego, co mam pod ręką? | właściwości zaznaczenia; bez zaznaczenia → ustawienia reprezentacji | tabela właściwości rekordu (`ArtifactPropertiesTable`) |
| **Powiązania** | Z czym to jest połączone? | identycznie | identycznie |
| **Komentarze** | Co mówi zespół? | identycznie | identycznie |
| **Historia** | Co się z tym działo? | identycznie (AI = typ zdarzenia) | identycznie |

**Co znika:** zakładka „Akcje" ze SPEC-A. Jej zawartość (eksport, udostępnij) przenosi się do **Menu 1 / kebab** — spójnie z tym, jak Idea trzyma Konwersję i Eksport. Akcje wynikające z konkretnej zakładki zostają w niej (np. „Odłącz" w Powiązaniach, „Przywróć wersję" w Historii).

**Dlaczego „Właściwości", a nie „Inspektor":** termin jest już w produkcie i w SPEC-A (mniejszy koszt migracji kart N), a „Inspektor" to żargon narzędzi graficznych. Funkcja identyczna — dla płótna zachowuje się jak inspektor zaznaczenia.

⚠ **Konsekwencja do zaplanowania:** 7 kart N jest odebranych i działa na demo. Ich zmiana = ponowny odbiór. Migracja powinna pójść **jedną partią po zamknięciu Idei**. Wymaga też aktualizacji `ARTIFACT_ANATOMY_STANDARD.md` §708 i §1213 — inaczej dwa dokumenty będą mówić różne rzeczy.

## 2. Zachowanie zakładek

Ikony zakładek żyją na prawej krawędzi (prawy rail), pionowo, w kolejności jak wyżej.

| Sytuacja | Zachowanie |
|---|---|
| panel zamknięty, klik ikony | otwiera panel na tej zakładce |
| panel otwarty, klik **innej** ikony | przełącza treść, panel zostaje otwarty |
| panel otwarty, klik **aktywnej** ikony | zamyka panel |

- Aktywna zakładka jest **wyraźnie oznaczona** (tło + pionowy wskaźnik przy krawędzi).
- Stan aktywnej zakładki jest **lokalny dla użytkownika**. Nie wolno synchronizować go jako globalnego stanu Idei — przełączenie zakładki nie może zmieniać ekranu innym osobom.
- Każda ikona ma tooltip z nazwą zakładki.

⚠ **Dziś złamane:** `renderMelsCanvasRightRailPanel(_activeToolId)` ignoruje identyfikator zakładki (podkreślnik w nazwie parametru) i zawsze zwraca ten sam pełny komponent; host nie przekazuje `activeRightToolId` ani `onSelectRightTool`. Naprawa = przekazać stan + przełączać treść po identyfikatorze.

## 3. Wygląd (Z2) — specyfikacja z zaakceptowanego prototypu

Panel jest **jasnym komponentem systemowym**, nie technicznym sidebarem.

| Cecha | Wartość |
|---|---|
| szerokość | 384 px (stała) |
| tło | powierzchnia systemowa (jasna w motywie jasnym, podniesiona w ciemnym) |
| obramowanie | 1 px, delikatne |
| zaokrąglenie | 14 px |
| odstęp | od krawędzi ekranu i od obszaru roboczego |
| przewijanie | wyłącznie wewnątrz panelu |
| cień | brak lub bardzo subtelny |

**Nagłówek panelu:** ikona typu obiektu w kolorowym kwadracie · nazwa Idei · chipy (etap, stan zapisu) · nazwa aktywnej zakładki wersalikami w szarości.

**Treść:** karty na tle podniesionym, zaokrąglenie 11 px, wewnętrzny odstęp 13–14 px, odstęp między kartami 12 px. Nagłówki sekcji: wersaliki, 10,5 px, waga 750, kolor przygaszony. Wartości: mocne, kolor główny.

**Zasady wizualne:**
- Karty **nie kurczą się**, gdy treść przekracza wysokość panelu — przewija się panel, nie karty.
- Liczby prezentowane cyframi tabelarycznymi.
- **Czerwień wyłącznie dla semantyki krytycznej.** Kompletność, zdrowie i statusy używają zieleni/bursztynu. Niski wynik zdrowia **nie jest czerwony**.
- Akcent (niebieski) tylko dla akcji i stanów aktywnych.

## 4. Zakładka Przegląd

**Zakres:** `workspace`. Opisuje całą Ideę. Nie służy do edycji pojedynczego elementu.

Sekcje w kolejności:
1. **Problem / brief** — opis, po co ta Idea istnieje.
2. **Kompletność** — wskaźnik pierścieniowy z wartością procentową, etykietą i informacją **kiedy był liczony**.
3. **Statystyki** — siatka 2×2: elementy · relacje · gałęzie/kroki/wiersze · powiązania.
4. **Właściwości Idei** — etap (z możliwością przejścia dalej), właściciel, obszar, priorytet, ostatnia zmiana.
5. **Rekomendowany krok** — wyróżniony blok z jedną akcją oraz **podpowiedzią, jak to samo powiedzieć Teresie**.

⚠ **Zdrowie nie jest osobną zakładką.** Jest częścią Przeglądu. Jeżeli system pokazuje wynik typu „Brak ostrzeżeń", musi być jasne, **czy walidacja została uruchomiona**. Stan początkowy w Process Flow to `Niezwalidowane`, nigdy zielone „Brak ostrzeżeń".

## 5. Zakładka Właściwości

**Zakres:** `single_item` · `selected_items` · `edge` · `lane_frame` · `table_row` · `table_column` · `table_cell`.

| Co zaznaczone | Co pokazuje panel |
|---|---|
| **nic** | ustawienia aktualnej reprezentacji (mapa: układ/poziomy/motyw; tablica: siatka/tło; proces: reguły walidacji/tory/notacja; tabela: ustawienia widoku) |
| **jeden element** | nazwa · typ · opis · status · priorytet · właściciel · właściwości specyficzne · wygląd · liczniki (relacje/komentarze/załączniki) · akcje lokalne · AI dla elementu |
| **wiele elementów** | licznik zaznaczenia · wspólne właściwości · akcje masowe · AI dla zaznaczenia · wyrównaj/rozłóż/grupuj (jeśli dotyczy) |
| **krawędź** | etykieta · typ relacji · kierunek · styl linii · źródło · cel · usuń · wstaw element na połączeniu |
| **kontener (tor/ramka)** | nazwa · kolor · blokada · zwinięcie · dopasowanie do zawartości |
| **wiersz tabeli** | pola rekordu · relacje · komentarze · historia edycji |
| **kolumna** | nazwa pola · typ · widoczność · szerokość · użycie w sort/grupowaniu · formuła/opcje · usuń |
| **komórka** | wartość · typ · walidacja · historia edycji · wyczyść · kopiuj · AI wypełnij |

## 6. Zakładka Powiązania

**Zakres:** `workspace` z filtrem. Powiązania są **first-class** — nie chowamy ich w Właściwościach.

**Przełącznik zakresu:** Cała Idea · Widok · Zaznaczenie.

Grupy:
1. **Artefakty Consultify** — inicjatywa · zadanie · decyzja · raport · prezentacja · wywiad · notatnik · dokument
2. **Źródła i dowody** — załączniki, pliki
3. **Linki zewnętrzne**
4. **Odwołania zwrotne** (co wskazuje na tę Ideę)
5. **Dane zaimportowane**

Każda pozycja pokazuje: ikonę typu · nazwę · status · datę · akcję otwarcia · akcję odłączenia (jeśli użytkownik ma uprawnienia).

⚠ **Dziś złamane:** przyciski „Dodaj powiązanie" i „Powiąż artefakt" w panelu wiersza tabeli nadają zdarzenia `idea-workspace-add-edge` i `idea-workspace-link-artifact`, które **nie mają żadnego odbiorcy**. Zgodnie z Z3 taka pozycja nie może istnieć bez handlera.

## 7. Zakładka Komentarze

**Zakres:** `workspace` lub `selection`. Komentarze są **first-class** — to funkcja współpracy, nie szczegół elementu.

**Przełącznik zakresu:** Cała Idea · Widok · Zaznaczenie.
**Filtry:** wszystkie · nierozwiązane · moje · AI.

Każdy komentarz: awatar i autor · data · treść · odpowiedzi · stan rozwiązany/nierozwiązany · wzmianki · **oznaczenie AI**, jeśli wygenerowała go Teresa (inny kolor awatara + plakietka).

Na dole: pole dodania komentarza.

**Komentarze nie mieszają się z historią zmian.** Historia to zdarzenia systemowe, komentarze to rozmowa ludzi (i Teresy).

## 8. Zakładka Historia

**Zakres:** `workspace`, z filtrem widoku lub zaznaczenia.

**Filtry:** Wszystko · Ludzie · AI · System · Import · Konwersje.

Prezentacja: oś czasu z kropką w kolorze typu zdarzenia (człowiek / AI / system).

Każdy wpis: kto · kiedy · co zmienił · zakres · wartość poprzednia → nowa (gdy dotyczy) · link do elementu · możliwość porównania lub przywrócenia wersji (po potwierdzeniu).

**Zakładka nazywa się „Historia", nie „Historia / AI".** AI jest typem zdarzenia i filtrem, nie osobną kategorią.

## 9. Czego prawy panel nie zawiera

- przełącznika reprezentacji (jest w prawym dolnym rogu — D2),
- zakładki Konwersja (to akcja, mieszka w Menu 1 / menu zaznaczenia — D6),
- Eksportu,
- Problemu, Statusu i Zdrowia jako osobnych zakładek (są częścią Przeglądu),
- AI jako osobnej stałej zakładki bez jasnego zakresu,
- martwych ikon.

## 10. Akcje w panelu

Dozwolone tylko wtedy, gdy wynikają z aktywnej zakładki:

| Zakładka | Dozwolone akcje |
|---|---|
| Przegląd | „Popraw brief z AI", „Przelicz kompletność", rekomendowany krok |
| Właściwości | „Konwertuj zaznaczone", „Usuń zaznaczone", „AI przepisz element" |
| Powiązania | „Dodaj powiązanie", „Dołącz źródło", „Odłącz" |
| Komentarze | „Dodaj komentarz", „Oznacz jako rozwiązany" |
| Historia | „Przywróć wersję" (po potwierdzeniu), „Porównaj" |

Konwersja całej Idei zostaje w Menu 1.

## Kryteria odbioru

- [ ] Pięć ikon prawego raila przełącza **pięć różnych treści**.
- [ ] Klik aktywnej ikony zamyka panel; klik innej przełącza bez zamykania.
- [ ] Aktywna zakładka jest wizualnie jednoznaczna.
- [ ] Przegląd nie miesza się z Właściwościami (poziom całej Idei vs poziom zaznaczenia).
- [ ] Powiązania i Komentarze istnieją jako **osobne** zakładki.
- [ ] Konwersja nie jest zakładką panelu.
- [ ] Panel wygląda identycznie w czterech reprezentacjach i w kartach N.
- [ ] Zdrowie pokazuje, kiedy było liczone; stan początkowy walidacji to `Niezwalidowane`.
- [ ] Czerwień nie występuje poza semantyką krytyczną.
- [ ] Karty nie kurczą się przy przewijaniu treści.
- [ ] Każdy przycisk w panelu ma handler (Z3) i wpis dla Teresy (Z4).
