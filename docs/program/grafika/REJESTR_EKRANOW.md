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
