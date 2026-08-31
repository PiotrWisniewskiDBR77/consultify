---
doc_id: grafika-rejestr-ekranow
status: canonical
truth_type: work-register
established: 2026-08-30
---

# Rejestr ekranów — jeden wiersz na ekran

**Zasady użycia w `00_ZASADY_PRACY.md`.** Ten plik jest jedynym miejscem, gdzie
żyje stan pracy nad wyglądem. Oba tory (grafika i funkcje) piszą tutaj.

## Słownik stanów

| Stan | Znaczenie |
| --- | --- |
| `NIEZBADANY` | brak zrzutu stanu zastanego — **nie wolno budować** |
| `ISTNIEJE_DOBRY` | zmierzony, przechodzi kanon, do odbioru |
| `ISTNIEJE_DO_POPRAWKI` | zmierzony, są nazwane defekty |
| `ZA_FLAGĄ` | zbudowany, niewidoczny domyślnie — podana flaga i jej wartość |
| `ODŁOŻONY` | martwy albo poza zakresem; wpis w `ODLOZONE.md`; **nie wraca bez zgody właściciela** |
| `DO_ZBUDOWANIA` | dowiedziono, że nie istnieje (trasa nie istnieje albo komponent nie jest renderowany) |

Ocena `A`/`B`/`C`/`D` — wg reguły nr 2. **Do właściciela idą tylko `A` i `B`.**

## ★ Inwentarz właściciela — punkt startowy (2026-08-30, jego słowa)

Właściciel deklaruje, że **widział większość ekranów**, z częścią nie był
zadowolony. **NIE widział:**

- **Wyników — w całości.** Żadnego ekranu.
- **Finansów — poza modelem finansowym.**
- **Części dokumentów.**
- Kilku pojedynczych rzeczy, których nie umie wymienić.

**Konsekwencja operacyjna:** w tych trzech obszarach ryzyko zbudowania czegoś,
co już istnieje, jest **największe** — pomiar przed dotknięciem jest tam
bezwzględny. W pozostałych modułach domyślna praca to **poprawa**, nie budowa.

Osobno do sprawdzenia: sekcja **Internal Tools / AI OS** (8 pozycji podrzędnych)
— nie pada w inwentarzu właściciela ani razu.

## Kolejność dnia — wg sidebara

Menu główne: Chat · My Work · Interview · Tools · Assessment · Initiatives ·
Execution · Results · Finance · Materials · Audits · Meeting
Menu dolne: Admin · Organization · Internal Tools (AI OS ×8) · Settings ·
Partner Portal · SuperAdmin

## Rejestr

| # | Moduł | Ekran / funkcja | Trasa | Komponent | Stan | Flaga | Zrzut PRZED | Zrzut PO | Ocena | Werdykt właściciela | Odkryte ponad dokumentację |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Inicjatywy | Karta inicjatywy — dokument | `/initiatives/:id` | `InitiativeDocumentView.tsx` (montowany bezpośrednio, **zero flag** — sprawdzone) | `ISTNIEJE_DO_POPRAWKI` | brak | `evidence/grafika/06-inicjatywy/karta-initiative__PRZED__{light,dark}.png` | — | **C** | — | 9 odchyleń od wzorca, lista niżej |
| 2 | Wywiad | Karta wniosku | — | `InsightViewer.tsx` przez harness `karta-insight` | `NIEZBADANY` | — | `evidence/grafika/00-karty-artefaktow/karta-insight__PRZED__{light,dark}.png` | — | — | — | zrzut wykonany, ocena w toku |
| 3 | Moja praca | Karta zadania | — | harness `karta-task` | `NIEZBADANY` | — | `evidence/grafika/00-karty-artefaktow/karta-task__PRZED__{light,dark}.png` | — | — | — | zrzut wykonany, ocena w toku |
| 4 | Moja praca | Karta decyzji | — | harness `karta-decision` | `NIEZBADANY` | — | `evidence/grafika/00-karty-artefaktow/karta-decision__PRZED__{light,dark}.png` | — | — | — | zrzut wykonany, ocena w toku |
| 5 | Narzędzia | Karta narzędzia | — | harness `karta-tool` | `NIEZBADANY` | — | `evidence/grafika/00-karty-artefaktow/karta-tool__PRZED__{light,dark}.png` | — | — | — | zrzut wykonany, ocena w toku |

## ★★ STAN ODBIORU PER MODUŁ — dwa rejestry pogodzone (2026-08-30)

Krok zerowy wykonany. Macierz zgodności UI (2.08) okazała się **przeterminowana
i w innej taksonomii** (19 modułów sprzed rozdziału Tools/Assessment) — nie nadaje
się jako źródło. Wiążący jest rejestr decyzji właściciela, zweryfikowany w kodzie.

| Moduł | Werdykt uzgodniony | Co dokładnie odebrane | Uwaga |
| --- | --- | --- | --- |
| Czat | ODEBRANY_CZĘŚCIOWO | feed sygnałów (warstwa deterministyczna) | warstwa AI za flagą OFF |
| Moja praca | ODEBRANY_CZĘŚCIOWO | prototypy i punktowe naprawy; moduł jako całość `NOT_ACCEPTED` | ★ rozjazd flagi kalendarza |
| Wywiad | ODEBRANY_CZĘŚCIOWO | adresy, zakładki, kebaby, podgląd | Creator Shell to tylko prototyp |
| Narzędzia | ODEBRANY_CZĘŚCIOWO → **COFNIĘTY** dla Insights | nazewnictwo, biblioteka frameworków | ★ flaga cofnięta po awarii na staging |
| Ocena | ODEBRANY_CZĘŚCIOWO | raport DRD i jego ekran | 3 widoki DRD to prototyp |
| **Inicjatywy** | **NIEODEBRANY** | **nic** | jedyny moduł, gdzie oba źródła zgodne: zero |
| Realizacja | ODEBRANY_CZĘŚCIOWO | wyłącznie reguła banera niedostępności | |
| **Wyniki** | ODEBRANY_CZĘŚCIOWO | **wyłącznie rejestr wskaźników** | ROI i OKR za flagami OFF — zgodne z inwentarzem właściciela |
| **Finanse** | **NIEODEBRANY** | **zero zrzutów** — rejestr sam to prostuje | zgodne z inwentarzem właściciela |
| Materiały | ODEBRANY_CZĘŚCIOWO | silnik arkusza, taksonomia szablonów | brak zrzutów całego modułu |
| Audyty | ODEBRANY_CZĘŚCIOWO | Menu 3, kolumny, kebab, warsztat kryterium V2 | trzy flagi potwierdzone ON w kodzie |
| Spotkania | **SPORNY** | gramatyka adresów, karta SPEC-A, prawy panel | decyzja nazwana „pełny zakres", treść warunkowa |
| Administracja | ODEBRANY_CZĘŚCIOWO | pakiet powiadomień, granice, polityki | brak akceptu całego modułu |
| **Organizacja** | **ODEBRANY_CAŁY** | redesign 21→11, 22 zrzuty | `CLOSED_FINAL`, flaga **ON potwierdzona w kodzie** — **NIE RUSZAĆ** |
| **Ustawienia** | **ODEBRANY_CAŁY** | 9 grup × dwa motywy, 21 zrzutów | `CLOSED_FINAL` — **NIE RUSZAĆ** |
| Portal partnerski | ODEBRANY_CZĘŚCIOWO | UI zatwierdzone 29.08 | ekonomia poza zakresem |

### ★ Dwa potwierdzone gitem przypadki „domknięte za flagą, której nie ma"

1. **Kalendarz w Mojej Pracy** — decyzja mówi „domyślne ON", commit włączający
   został **zrewertowany tego samego dnia przez właściciela**. Rejestr o tym nie wie.
2. **Insights w Narzędziach** — właściciel zaakceptował zrzuty, flaga poszła na ON,
   dzień później wróciła na OFF, bo powodowała awarię na staging. Wpis akceptu
   **nie ma adnotacji o cofnięciu**.

**Wniosek operacyjny:** akcept właściciela **nie dowodzi**, że użytkownik to widzi.
Przed każdą pracą nad ekranem sprawdzam wartość flagi **w kodzie**, nie w rejestrze.

### Wewnętrzna sprzeczność kart odbioru — do naprawy

Karty Organizacji i Ustawień mają sekcję „Owner verdict: `PENDING`" **tuż nad**
sekcją `CLOSED_FINAL`. Szablon nie został uzupełniony po dopisaniu domknięcia.
Automatyczny odczyt „Decision: PENDING" da dla tych dwóch modułów fałszywy wynik.

## ★ Odchylenia od wzorca — karta Inicjatywy (pierwszy zmierzony ekran)

Powłoka jest **znacznie bliżej wzorca, niż zakładałem**: pasek tożsamości, prawy panel
accordion w niemal kanonicznej kolejności, lewy rail z licznikami, gęsta polska treść
doradcza, czytelny motyw ciemny, zero błędów konsoli.

Dziewięć odchyleń:

| # | Odchylenie | Waga |
| --- | --- | --- |
| 1 | **Brak okruszków** — wzorzec ma pełną ścieżkę do obiektu; użytkownik nie wie, gdzie jest | wysoka |
| 2 | **Brak kodu obiektu** przy tytule — nie da się zacytować inicjatywy w mailu | wysoka |
| 3 | **„Zapisano" bez daty i godziny** — słowo bez informacji | średnia |
| 4 | **Brak przycisku głównego** — wzorzec ma jeden wyraźny („Zgłoś do bramy G3"), tu tylko kebab | wysoka |
| 5 | ★ **„AKCJE 0"** — licznik zero przy akcjach. Wzorzec ma tam cztery realne akcje. To jest dokładnie przypadek, przed którym ostrzega kanon: **liczba 0 nie oznacza braku działań** | **krytyczna** |
| 6 | **Menu 3 nie pokazuje postępu** — jest „Sekcje · Edycja · Podgląd · Analizuj z AI" zamiast zakładek z licznikami `6/9`, `3/7`. Wzorzec pokazuje postęp w nawigacji | wysoka |
| 7 | **Brak trzech bloków uczciwości**: „Brakujące — nazwane", „Twoje uprawnienia" (Możesz/Nie możesz), ocena postępu z zastrzeżeniem „wysoki licznik nie oznacza gotowości" | **krytyczna** |
| 8 | **Treść jest ścianą tekstu** — wzorzec dzieli ją na karty z nagłówkami i tabelami | średnia |
| 9 | Przycisk „Analizuj z AI" — ramka i wypełnienie wyglądają jak akcent CTA; do sprawdzenia wobec tokenu AI | niska |

**Ocena: `C`** — nie pokazuję właścicielowi jako produktu. Idzie do naprawy.

## ★★ KOREKTA WŁASNEJ LISTY ODCHYLEŃ — karta Inicjatywy (2026-08-30)

Zweryfikowałem swoje dziewięć odchyleń **w kodzie i w żywym ekranie**.
**Pięć z nich nie było defektami.** Zapisuję to jako ostrzeżenie dla siebie
i dla każdego następnego, bo mechanizm powtórzy się przy każdym ekranie.

| # | Moje odchylenie | Werdykt po weryfikacji |
| --- | --- | --- |
| 1 | brak okruszków | **NIE DEFEKT PRODUKTU** — harness renderuje kartę bez powłoki aplikacji; okruszki mieszkają w powłoce. Do sprawdzenia w żywym runtime, nie w harnessie |
| 2 | brak kodu obiektu przy tytule | **NIE DEFEKT — decyzja właściciela `D-D` z 2026-07-22**: kod obiektu i link przeniesione do kebaba celowo. Przywrócenie ich byłoby cofnięciem decyzji |
| 3 | „Zapisano" bez daty | **DO SPRAWDZENIA** — decyzja `D-C` mówi „wskaźnik tekstowy, nieklikalny"; wzorzec pokazuje datę i godzinę. Możliwa realna luka |
| 4 | brak przycisku głównego | **NIE DEFEKT GRAFIKI — dziura funkcjonalna.** `statusActions` jest twardo `[]` (`InitiativeDocumentView.tsx:1414`) na mocy `DEC-104` z 2026-08-26: ścieżka zapisu statusu **rzuca wyjątkiem dla każdego statusu docelowego**, więc każda akcja była gwarantowaną awarią. Wyłączenie było słuszne. **Należy do toru funkcji, nie grafiki** |
| 5 | „AKCJE 0" | **NIE DEFEKT — zachowanie trybu Podglądu**, decyzja właściciela 2026-07-24, z jawnym zakazem komunikatu opisowego. W trybie Edycji sekcja ma dwa realne przyciski |
| 6 | Menu 3 bez liczników postępu | **CZĘŚCIOWO** — lewy rail ma liczniki (9, 5, 5), ale to liczby pozycji, nie postęp `6/9` jak we wzorcu |
| 7 | brak bloków uczciwości | **NIEROZSTRZYGNIĘTE** — oceniałem jedną sekcję z dwudziestu czterech |
| 8 | ściana tekstu | **CZĘŚCIOWO** — kształt treści pochodzi z danych makietowych, nie z komponentu |
| 9 | kolor przycisku AI | do zmierzenia tokenem |

### Co znalazłem naprawdę, przy okazji

- **★ Mieszany język w sekcji „Bramy"** — tabela trzynastu etapów cyklu życia ma
  **angielskie opisy** („Benefits tracking in progress", „Initiative was cancelled",
  „Archived for reference") obok polskich etykiet („Zarchiwizuj", „Nie rozpoczęto").
  To realny defekt i widać go gołym okiem.
- **Przełącznik Edycja/Podgląd działa** — moje pierwsze kliknięcie chybiło.
- **Nawigacja po sekcjach działa** — przełącza treść centrum.

### ★ KONFLIKT DO ROZSTRZYGNIĘCIA PRZEZ WŁAŚCICIELA

Decyzja z **2026-07-24** (w kodzie): w Podglądzie sekcja Akcje jest zwinięta
z licznikiem `0`, **bez komunikatu opisowego** — „SSOT go zakazuje wprost".

Wzorzec z **2026-08-30** (dzisiejszy) mówi odwrotnie: „Tryb podglądu — akcje nie są
dostępne w tym widoku; **liczba 0 nie oznacza braku działań**" oraz „To ograniczenie
widoku, nie informacja, że działań jest zero".

**Nowszy wzorzec przeczy starszej decyzji.** Nie rozstrzygam tego sam.

### Wniosek metodyczny — obowiązuje od teraz

**Odchylenie od wzorca nie jest defektem, dopóki nie sprawdzę, czy nie jest
decyzją.** Kolejność: zobacz ekran → znajdź komponent → **przeczytaj komentarze
przy kodzie** (w tym repozytorium niosą decyzje właściciela z datami) → dopiero
wtedy orzekaj. Pominięcie tego kroku dałoby pięć „napraw", z których dwie cofnęłyby
decyzje właściciela, a jedna złamałaby jawny zakaz.
