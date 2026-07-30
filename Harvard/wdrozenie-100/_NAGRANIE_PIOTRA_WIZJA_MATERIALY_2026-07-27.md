# Nagranie Piotra — wizja modułu Materiały · 2026-07-27 (rano, tydzień 49. urodzin)

> Notuję wiernie, punkt po punkcie, w miarę jak Piotr dyktuje. Ten plik = SSOT wizji właściciela.
> Status: CZĘŚĆ 1 zanotowana, nagranie urwane w połowie zdania — czekam na ciąg dalszy.

## CZĘŚĆ 1

**N1. Skąd się biorą materiały.** W bardzo wielu miejscach aplikacji powstają: myśli, dokumenty,
artefakty, liczby, inicjatywy, idee — rzeczy, które chcemy PRZEDSTAWIĆ albo PRZEKAZAĆ w postaci
raportu. Po to istnieje moduł Materials.

**N2. Nazwa modułu.** „Powinniśmy go pewnie inaczej nazwać" — do wrócenia PÓŹNIEJ (parking).

**N3. Trzy typy dokumentów** (najczęściej używane przez ludzi):
- **Prezentacja (PowerPoint)** — ładna, graficzna, MAŁO słów, obrazy; ma szybko przemawiać
  do wzrokowców.
- **Word (najczęściej raport)** — zbita ilość tekstu, ładnie poukładana, po to żeby dało się
  to realnie analizować.
- **Excel (tabela)** — liczby ALE TAKŻE FORMUŁY, żeby można było symulować, przekładać,
  kombinować.

**N4. Sześć silników.** Potrzebujemy: (a) trzy GENERATORY DOKUMENTÓW + (b) trzy GENERATORY
TEMPLATE'ÓW. Template = np. „raport w PowerPoincie, 12 slajdów, opisane JAKIEGO TYPU treść na
którym slajdzie" — a później do tych typów treści dokładamy konkrety (np. z inicjatyw).
Formuła: **pomysł + template = raport/prezentacja**.

**N5. Dzisiejszy stan: „straszny bałagan po iluś podejściach".**

**N6. Zasady projektowe:**
- Ma być PROSTE.
- Możliwie MAŁO przycisków.
- Użytkownik możliwie SZYBKO widzi efekt.

**N7. Wzorce (benchmark):**
- **Gamma**: wpisujesz tylko tekst, odpowiadasz na trzy pytania → generuje się prezentacja.
- **Airtable**: opisujesz założenia; z boku żyje CZAT, a obok NA ŻYWO tworzy się dokument.
- Tak samo ma być u nas.

**N8. ★ NAJWIĘKSZY BRAK (sedno):** cała MECHANIKA POMIĘDZY — między przekazaniem informacji
i opisem czego chcemy, a konkretnym wynikiem. „Nie mamy dzisiaj chyba miejsca, w którym MÓZG
tworzy myśli: jak ma wyglądać tabela, jak ma wyglądać dany Word, jakie mają być treści
w PowerPoincie."

**N9. [urwane]** „Mamy za to…" — nagranie urwało się; ciąg dalszy w CZĘŚCI 2.

## CZĘŚĆ 2 (drugie nagranie)

**N10. Obsługa MUSI BYĆ PROSTA.** Dwa sposoby wejścia: (a) rozmawiamy z czatem, albo (b) wchodzimy
w samo narzędzie. „Nie może być tak, że mamy jakieś dziesiątki tabelek, jakieś archaiczne
połączenia po drodze."

**N11. ★ KANONICZNY PRZEPŁYW TWORZENIA (dosłownie):**
```
„Dodaj nowe"  →  KROK 1: który z TRZECH dokumentów?
              →  KROK 2: czyste / z AI / z template'u
              →  BANG (koniec pytań)
```
- **Czyste** → po prostu otwiera się czysty dokument.
- **Z AI** → otwiera się dokument, a Z BOKU okno AI (czat).
- **Z template'u** → otwiera się LISTA template'ów → wybieramy → otwiera się sam dokument.

**N12. ★ ZAKAZ (dosłownie):** „nie, że musimy ileś rzeczy wyklikiwać, powpisywać, jakieś dajesz mi
tabelę, jakieś wybory. To jest zupełnie do niczego niepotrzebne."
→ Dzisiejszy formularz intake (Description/Type/Density/Goal/Audience) = DO USUNIĘCIA z przepływu.

**N13. Model ekranu: „To musi być NARZĘDZIE, a z boku muszą być MENU."**

**N14. ★ GENERATOR TEMPLATE'ÓW — układ 3-kolumnowy (dosłownie):**
- **LEWA**: kolejność poszczególnych treści (sekwencja bloków/slajdów/sekcji).
- **PRAWA**: elementy / „tooling" — klocki, które będziemy układali.
- **ŚRODEK**: układanie kolejności i wygląd — tu budujemy template.
- Po zapisaniu template'u: „później już nie musimy tego wszystkiego opisywać, tylko nam to
  po prostu wychodzi".

**N15. ★ METODA: powtórzyć to, co zrobiliśmy przy IDEACH.** Ustalić, jak mają wyglądać artefakty:
- wylistować WSZYSTKIE menu: lewe (kolejność treści), prawe (narzędziówka), GÓRNE („co mamy u góry?"),
- rozstrzygnąć, które elementy są POWTARZALNE dla wszystkich narzędzi, a które nie,
- opisać RAZ, DOBRZE, **korzystając z bazy porównywalnych narzędzi** (benchmark rynkowy),
- „mieć tę robotę zrobioną" (raz, na stałe — jak kanon triady/SPEC-A dla list i artefaktów).

**N16. ★★ DRUGA WIELKA RZECZ: „CAŁA MĄDROŚĆ DO WYGENEROWANIA".** Gdy dajemy mu taska, musi mieć
UMYSŁ, który: (1) najpierw ZAPLANUJE, co ma być w treściach, (2) potem bierze się do roboty
i robi to NA NASZYCH OCZACH — „tak jak robią to inni". To jest ten sam brak co N8 (mózg pomiędzy),
teraz doprecyzowany: plan treści → widoczna egzekucja na żywo.

## CZĘŚĆ 3 — PIERWSZE WRAŻENIE Z ŻYWEGO DEMO (2026-07-28, po nocy)

**N18. ✅ WERDYKT OGÓLNY:** „to rzeczywiście zaczyna działać. Brawo! (…) stary, wielki krok."
Pierwszy raz od dawna pozytywna ocena kierunku — utrzymać tempo i sposób pracy.

**N19. ★ PROBLEM: nie da się wyjść z dokumentu.** „Mam [problem], żeby wyjść z tego dokumentu.
To jest jakieś issue. Nie widzę takiej prostej nawigacji." — mimo że breadcrumb `Materiały ›
Dokumenty › …` i strzałka powrotu są w kodzie (B3, 27.07), użytkownik ich NIE ZAUWAŻA.
Wniosek: afordancja wyjścia jest za słaba / w złym miejscu. To nie jest brak funkcji, to brak
widoczności — naprawiać wyglądem, nie kolejnym przyciskiem gdzie indziej.

**N20. ★ BRAK PODSTAWOWEGO MENU PLIKU.** „Nie ma Zapisz, Zapisz jako, Otwórz — to co jest
pierwszymi przyciskami w Wordzie." Użytkownik oczekuje kanonu edytora dokumentów: **Nowy ·
Otwórz · Zapisz · Zapisz jako** (+ Eksport, który już mamy). Dziś jest tylko Export DOCX / Share /
Start over — czyli operacje końcowe, bez operacji na PLIKU.
→ To wchodzi do `_KANON_MENU_3_NARZEDZIA` jako obowiązkowy blok M1 dla wszystkich 3 narzędzi.

**N21. Obserwacja techniczna (do zbadania):** ekran „Generate" potrafi zostać na „Loading
document…" (zrzut 2). Do potwierdzenia czy to stan przejściowy czy zawieszenie.

**N22. Obserwacja techniczna:** interfejs pokazał się po ANGIELSKU (Materials/Documents/History/
Share/OUTLINE), mimo polskiego konta. Prawdopodobna przyczyna: konto Piotra nie ma ustawionego
języka → po zmianie z 27.07 (język konta steruje UI) fallback idzie na język przeglądarki.
Do sprawdzenia: czy `users.language` jest puste dla tego konta.

**N17. Doktryna realizacji:** „Nie wymyślamy koła — wszyscy duzi mają dziś tę technologię.
Wystarczy prześledzić, ukraść i ułożyć." → benchmark-first, nie greenfield.

## CZĘŚĆ 4 — DRUGA TURA ODBIORU (2026-07-28, przedpołudnie)

**N23. ★★ ROZSTRZYGNIĘCIE MENU GÓRNEGO — wzorzec z IDEI.** Problem: w całej aplikacji mamy
**trzy paski od góry** (Menu 1·2·3). Artefakt/dokument otwiera się „w linku menu drugiego" — i tak
ma być. Ale w narzędziach dokumentowych (Word) tych trzech pasków nie ma i robi się niespójnie.
DECYZJA właściciela: **przyjąć system analogiczny do IDEI**:
- tryb **PEŁNY EKRAN** (jak w ideach) — paski górne znikają,
- w **PRAWYM DOLNYM ROGU** pływające menu: w ideach były **4 przyciski narzędzi idei**,
  tutaj mają być **3 przyciski dokumentów** (Word · Excel · PowerPoint),
- **przełączanie w locie**: „jesteśmy w prezentacji, potrzebujemy do tego zrobić Word — wciskam
  przycisk Word i może się on otwierać",
- w tym samym menu **ZOOM** — potrzebny i dla PowerPointa, i dla Excela,
- oraz przycisk **pełny ekran / wyjście z pełnego ekranu**.
Reguła: **pełny ekran ⇒ menu górne schowane; brak pełnego ekranu ⇒ menu górne zostaje.**
→ To jest odpowiedź na N19 (nie da się wyjść z dokumentu): wyjście przestaje być szukaniem
strzałki, staje się jawnym przełącznikiem trybu.

**N24. ★ ARKUSZ SIĘ NIE OTWIERA.** „Bardzo długo ładuje mi się arkusz… czekam już pewnie ze
30 sekund". Ekran: `Materials › Sheets › Sheet`, w środku spinner „Tworzenie pustego arkusza…".
Drugi przypadek tej samej klasy co N21 ⇒ **wzorzec, nie przypadek**: stan ładowania bez wyjścia.

**N25. ★★★ „TO NIE O TO NAM CHODZIŁO" — ekran arkusza to nie Excel.** Po długim czekaniu powstał
ekran **„Table Studio"** z kartą **„Operational table"**, plikiem **.csv**, polem
`FORMAT: Operational`, licznikami `ROWS 0 / COLUMNS 0` i komunikatem „Could not load table preview".
Stare przykłady wyglądają tak samo (np. „Rejestr 8 inicjatyw transformacji AI…" — 1 wiersz,
6 kolumn, CSV). Właściciel: **„ciągle nie widziałem tego Excela"**.
→ PRZYCZYNA USTALONA W KODZIE (nie hipoteza): `useKimiArtifactPipeline.ts:676-679` — gdy realny
silnik arkuszy (`POST /api/workbook/generate`) rzuci wyjątek, kod robi `console.warn` i **po cichu**
podmienia wynik na starą tabelę operacyjną (CSV), oznaczając ją `type: 'xlsx'` i opisując
„Spreadsheet". Silnik Excela nie jest zepsuty — jest **ZASŁONIĘTY CICHYM FALLBACKIEM**.
Dlatego cała nocna praca (8 modeli, NPV/IRR, warstwa Założeń, kolory formuł) była dla właściciela
niewidoczna.

**N27. ★★★ ROZSTRZYGNIĘCIE KOŃCOWE UKŁADU — DWA OBRAZY (zastępuje i doprecyzowuje N23).**
Właściciel dosłownie: *„w naturalny sposób mamy zawsze dwa obrazy"*.

**OBRAZ 1 — roboczy (z menu).** Widoczne wszystkie trzy paski: **Menu 1 · Menu 2 · Menu 3**.
Po otwarciu dokumentu jego **tytuł pojawia się w Menu 3 (dynamicznym)** — *„tak jak we wszystkich
innych miejscach"*. Dzięki temu **można przeskakiwać między otwartymi dokumentami** (karty).
★To jest spójność z resztą aplikacji, nie nowy pomysł — Menu 3 dynamiczne już tak działa
dla artefaktów w innych modułach.

**OBRAZ 2 — pełny ekran.** Cały ekran na narzędzie. *„To może być to, jak to obecnie wygląda"* —
czyli dzisiejszy wygląd Document Studio jest AKCEPTOWALNY jako tryb pełnoekranowy, brakuje mu
tylko sposobu wyjścia i przełączania.

**★ DWA MAŁE MENU W PRAWYM DOLNYM ROGU — „to samo co mamy w Idea".**
Właściciel wskazuje istniejący precedens (moduł IDEE) i chce go powtórzyć, NIE wymyślać:
- **Menu A — widok:** **zoom** + przełącznik **pełny ekran ⇄ obraz roboczy**.
- **Menu B — narzędzie:** wybór, czy pracujemy z **Wordem, Excelem, czy PowerPointem** —
  *„możliwość przeskakiwania między narzędziami"*.

**★ PODZIAŁ RÓL (potwierdzony przez właściciela — koniec dwuznaczności):**
| Miejsce | Rola |
|---|---|
| **Prawa szyna ikon** (P-04) | narzędzia pracy **WEWNĄTRZ** dokumentu; lista będzie rosła |
| **Menu 3 dynamiczne** (obraz 1) | przeskakiwanie między **otwartymi dokumentami** |
| **Dolne-prawe menu A** | zoom + tryb widoku |
| **Dolne-prawe menu B** | przeskakiwanie między **narzędziami** (Word/Excel/PPT) |

**Zasada nadrzędna:** pełny ekran ⇒ paski górne schowane, ale dolne-prawe menu ZOSTAJE
(bo tylko przez nie da się wrócić) — to odpowiedź na N19 i na zastrzeżenie z menu „Plik",
że wyjście w pasku górnym znika w pełnym ekranie.

**★ WERYFIKACJA PRECEDENSU (wykonana 28.07, plik:linia — po lekcji z P-01):**
| Element | Czy istnieje w IDEACH? | Dowód |
|---|---|---|
| **Menu A — zoom + pełny ekran** | ✅ **ISTNIEJE, gotowe do przeniesienia** | `src/components/MyWork/canvas/CanvasZoomControls.tsx:98` — `absolute bottom-3 right-3`; zawiera zoom +/−, **procent powiększenia**, dopasuj widok, **przełącznik pełnego ekranu** (`Maximize2`/`Minimize2`), opcjonalnie focus/minimapa. Używany przez `IdeaProcessFlowTool`, `IdeaWhiteboardTool`, `IdeaRecommendationMap` |
| **Menu B — przełącznik narzędzi** | ❌ **NIE ISTNIEJE jako menu** | Jest wyłącznie **skrót klawiszowy `Alt+1/2/3/4`** (`IdeaMapWorkspace.tsx:1704`, klucz `mindmap.switchToolMindMapWhiteboardProcess`). Widocznego, klikalnego menu w rogu NIE MA — trzeba je **zbudować** |

**Wniosek dla planowania:** połowa roboty jest gotowa do przeniesienia 1:1, połowa to nowy
komponent. Nie obiecywać „przeniesiemy z idei" w całości — to byłoby powtórzenie błędu z P-01.

**N28. ★★★ UNIWERSALNOŚĆ NAWIGACJI — jeden standard dla 7 narzędzi.**
Właściciel dosłownie: *„podsumowując opisaliśmy teraz nawigację, która ma być właściwa zarówno
dla wszystkich dokumentów, czyli Worda, Excela i PowerPointa, jak i IDEA. Tam są cztery
narzędzia, czyli Mind Mapa, Whiteboard, Workflow i tabela, i tam ta koncepcja ma być dokładnie
taka sama."*

**Zakres standardu = 7 narzędzi:** Word · Excel · PowerPoint · Mapa myśli · Whiteboard ·
Process Flow · Tabela idei.
Menu B (przełącznik narzędzi) jest zatem **kontekstowe**: w module Materiały pokazuje 3 dokumenty,
w module Idee — 4 narzędzia idei. Ten sam komponent, inna lista.

**Potwierdzenie pozytywne (właściciel rzadko chwali — notować):**
*„Bardzo mi pasuje z kolei takie otwierane panel boczny z poszczególnych ikon i tu sobie będziemy
przez to przechodzić."* → wzorzec „ikona na szynie → otwiera panel boczny" jest ZAAKCEPTOWANY
i staje się kanonem prawej strony dla wszystkich 7 narzędzi.

**N29. ★★ POZIOMY PASEK CZĘSTYCH NARZĘDZI NAD DOKUMENTEM (wzorzec Apple/Pages).**
Właściciel dosłownie: *„warto byłoby, idąc za głównymi graczami, takimi jak Apple czy Microsoft,
[zrobić] menu głównych narzędzi powyżej tego dokumentu, czyli takie menu poziome, a nie tylko
listy z prawej strony. Sugerujmy się tym, co robi Pages (…) gdzie wystawiamy tylko te klawisze,
które się często wykorzystuje. Możemy się wklikać w prawym panelu do wszystkich naprawdę bardzo
detalicznych narzędzi, ale to, co jest pod ręką, co często używamy, powinno być widoczne tutaj."*

**PODZIAŁ RÓL — teraz kompletny (trzy miejsca, nie dwa):**
| Miejsce | Zawartość | Zasada |
|---|---|---|
| **Poziomy pasek nad dokumentem** | najczęstsze narzędzia edycji | mała, kuratorowana garść — jak Pages |
| **Prawa szyna + panel** | wszystkie narzędzia szczegółowe | tu się „wklikujemy" |
| **Dolne-prawe pływające** | zoom, pełny ekran, przełączanie narzędzi | widok i nawigacja |

★TO ROZWIĄZUJE ZNALEZISKO Z INWENTARZA (28.07): Word ma 13-14 działających zakładek prawego
panelu, ale **żadnego paska formatowania** — formatowanie dostępne tylko ze skrótów klawiszowych.
N29 wypełnia dokładnie tę lukę.
★NAPIĘCIE Z P-06 (do rozstrzygnięcia projektowego, nie ignorować): właściciel wcześniej kazał
scalić dwa paski w jeden, bo się dublowały. Teraz dokłada pasek narzędzi edycyjnych. To NIE jest
sprzeczność, jeśli rozumieć tak: znika zdublowana **nawigacja**, pojawia się pasek **edycji**.
Razem: jeden pasek nawigacyjny (góra) + jeden pasek narzędzi edycji (nad dokumentem).

**N30. ★★★ TRZY TRYBY PRACY NA SLAJDACH — „chcemy być lepsi od Gammy".**
Właściciel dosłownie: *„przeanalizuj, jak Gamma pracuje na slajdach, bo Gamma pozwala pracować
w samym obrazie także AI"*. Trzy równoległe drogi do tej samej zmiany:
1. **MANUALNIE** — *„sami przestawiamy, dodajemy, przesuwamy, jak w analogowej wersji"*
   (klasyczne narzędzia prezentacyjne). Po ustawieniu: *„powiemy, że to ma być standard"*
   → ręczny układ staje się wzorcem (most do N31).
2. **LOKALNY KOMENTARZ NA SLAJDZIE** — *„na poziomie slajdu (…) jest gdzieś mała ikonka
   otwierająca lokalny komentarz i mówimy: zmień to, zmień to"* → AI w kontekście JEDNEGO
   slajdu, nie całej prezentacji.
3. **TERESA GLOBALNIE** — *„idziemy do Teresy i mówimy: hej, przebuduj nam te slajdy"*.

★ **TEZA KONKURENCYJNA (to jest cel, nie ozdoba):** *„chcemy być tu trochę lepsi od Gammy,
bo w Gammie manualnie de facto niewiele da się zrobić."*
→ Nasza przewaga = **pełna kontrola manualna RÓWNORZĘDNA z AI**, nie AI zamiast kontroli.
Konsekwencja projektowa: tryb 1 musi być prawdziwy (przesuwanie, wyrównywanie, warstwy),
a nie atrapa. Dziś slajd ma tylko „Enter text here…".

**N31. ★★ DWA TYPY WZORCÓW: KOLORÓW i TREŚCI (nakładalne, ale niezależne).**
Właściciel dosłownie: *„wypracuj formułę, w którym jak zrobimy jakąś prezentację, to będziemy
mogli potraktować ją jako wzorzec dalej. (…) Wzorzec kolorów i wzorzec treści. Dwa typy wzorców.
Można je na siebie nakładać, ale niekoniecznie."*

**Przepływ (dosłownie):** *„[konsultant] prezentacją jest z niej dumny i wie, że co tydzień musi
robić analogiczną — to wtedy wybiera «zrób z niej template», ładuje ją do template'ów, opisuje,
system dobrze mu zadał kilka doszczegóławiających pytań, czy tak ma być, jak rzeczywiście jest,
i go."*

**Co z tego wynika:**
- akcja **„zrób z tego wzorzec"** dostępna z gotowego materiału (nie tylko tworzenie wzorca od zera),
- **rozdzielenie warstwy wyglądu od warstwy struktury treści** — można wziąć kolory bez struktury
  i odwrotnie,
- **krótki, mądry wywiad** przy zapisie wzorca („czy to ma być stałe, czy zmienne?") — to jest
  ta sama mechanika, co mózg planujący treść (N8/N16), tylko obrócona: system pyta, żeby
  zrozumieć, co w tym materiale jest szablonem, a co jednorazową treścią,
- ★POWIĄZANIE z N4 („pomysł + template = raport/prezentacja") i z istniejącym generatorem
  szablonów prezentacji, który właściciel ocenił jako dobry.

**N26. Polecenie porządkowe:** „wyrzuć wszystkie stare przykłady, które i tak się nie nadają,
stwórz nowy przykład do zabawy, do demonstracji, na której będziemy dalej ćwiczyli".
→ Warunek kolejności: **najpierw działający silnik, potem zasiew przykładu** (inaczej zasiejemy
kolejny CSV udający arkusz).
