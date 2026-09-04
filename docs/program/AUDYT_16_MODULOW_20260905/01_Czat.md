# 01. Czat — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

15 ekranów zatwierdzonych, 8 z Twoją uwagą. Dwie uwagi to realne defekty do naprawy (panel boczny Process Flow poza kadrem, pasek ikon Whiteboard wychodzi poza okno). Czat blokował się dziś na naszym liczniku 30 żądań/min — wyłączony. Historia rozmów prywatne/organizacyjne i menu kanw są w fali 2 Twoją decyzją.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Panel deliverables w Czacie (kanwa dokumentów) | `VITE_ENABLE_DELIVERABLES_LIGHT` | ON od dziś (parytet z demo) |
| Preferencje Czatu per użytkownik (DEC-386) | `—` | w kodzie od 15309dd3a6, na stagingu TAK |
| Licznik żądań AI 30/min blokował czat | `DISABLE_RATE_LIMIT` | licznik WYŁĄCZONY na stagingu od dziś 23:32 |

## A. Zatwierdzone obrazy — 15 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `canvas-kebab-restructure` | Kanwa — menu trzech kropek | A | ok | Wiesz nie wiem czy to docelowo będzie ok. Tutaj nagle wielkie funkcje sa pod pojedynczymi słowami.  Nie wiem co to efektywnie zorbi. Moze warto byłoby zrobić z nich przyciski w delikatnych ramkach i połokrągłe. Zobaczmy co z tego będzie. To bardzo ważna zmiana bo dotyczy ona wszsytkich idea. | `evidence/grafika/crimson-czat-20260903/canvas-kebab-restructure__PRZED__pl__1440__light.png` |
| `canvas-new-doc` | Kanwa — nowy dokument | A | ok | ok | `evidence/grafika/crimson-czat-20260903/canvas-new-doc__PRZED__pl__1440__light.png` |
| `canvas-toolbar-md-history` | Kanwa — pasek i historia | A | ok | ok | `evidence/grafika/crimson-czat-20260903/canvas-toolbar-md-history__PRZED__pl__1440__light.png` |
| `chat-split-teresa-right` | Czat — artefakt po lewej, Teresa po prawej | A | ok | ok | `evidence/grafika/crimson-czat-20260903/chat-split-teresa-right__PRZED__pl__1440__light.png` |
| `mindmap-i18n-smoke` | Mapa mysli — dodaj dowod | A | ok | ok | `evidence/grafika/130-noc-czat-agent-spotkania/mindmap-i18n-smoke__PRZED__light.png` |
| `processflow-canvas` | Diagram procesu | A | ok | Generalnie okno jest ok. Tutaj wielkim wyzwaniem jest ten panel boczny. na tym obrazie jak go nie mogę ocnić | `evidence/grafika/130-noc-czat-agent-spotkania/processflow-canvas__PRZED__light.png` |
| `teresa-chipy-panel-artefaktu` | Teresa w panelu artefaktu | A | ok | Love it | `evidence/grafika/99-diag-linia/teresa-chipy-panel-artefaktu__PO__light.png` |
| `teresa-chipy-sugestii` | Teresa — podpowiedzi | A | ok | A możemy gdzieś jakoś kontekstowo to włączać, wyłączać, bo ja generalnie jestem przeciwnikiem, ale pewnie są tacy, którzy dzięki temu rozumieją, co mają zrobić. Także wyrzucenie tego całkiem nie jest okej, ale w sobie tego nie lubię. Może tam, gdzie mamy plus, w nie wiem, zaproponuj coś – wiemy coś  | `evidence/grafika/crimson-czat-20260903/teresa-chipy-sugestii__PRZED__pl__1440__light.png` |
| `teresa-confirm-chip` | Teresa — potwierdzenie przed dzialaniem | A | ok | A zaproponujmy może trochę bardziej delikatną formułę graficzną tego okna, bo ono teraz jest takie duże i trochę toporne, a dzisiaj standardy tego typu konwersacji są już bardziej delikatne. Jak na przykład to robi właśnie Claude. | `evidence/grafika/crimson-czat-20260903/teresa-confirm-chip__PRZED__pl__1440__light.png` |
| `chat-signals-feed` | Strumien sygnalow | B | ok | Nie wiem, gdzie to jest, ale to jest w ogóle super mądre. | `evidence/grafika/crimson-czat-20260903/chat-signals-feed__PRZED__pl__1440__light.png` |
| `melscanvas-workspace` | Mala mapa mysli | B | ok | ok | `evidence/grafika/130-noc-czat-agent-spotkania/melscanvas-workspace__PRZED__light.png` |
| `mindmap-canvas` | Mapa mysli | B | ok | ok | `evidence/grafika/130-noc-czat-agent-spotkania/mindmap-canvas__PRZED__light.png` |
| `ntype-analizuj-ai` | Analizuj z AI — wynik | B | ok | Potwierdziam ok. Będe wpisywał dalej tylko ok jako ponowne potwierdznie | `evidence/grafika/130-noc-czat-agent-spotkania/ntype-analizuj-ai__PRZED__light.png` |
| `whiteboard-canvas` | Tablica | B | ok | tutaj jest tylko problem taki ze jak zanaczam element otweira sie pasek poziomy funkcji i on sie nie mieści w pasu - sa ikony które wygladają poza okno. tutaj opisy trzeba skrócić albo wywalić. | `evidence/grafika/130-noc-czat-agent-spotkania/whiteboard-canvas__PRZED__light.png` |
| `whiteboard-workshop` | Tablica — warsztat | B | ok | ok | `evidence/grafika/130-noc-czat-agent-spotkania/whiteboard-workshop__PRZED__light.png` |

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `canvas-kebab-restructure` | Kategoria 3 | PRZED (mega-kebab) + PO (8 grup) + ramka „MAPOWANIE" — cały ekran jest dokumentem projektowym | **wysokie** |
| `canvas-toolbar-md-history` | Kategoria 3 | pasek PO + otwarty kebab, dwa stany naraz | **wysokie** |
| `mindmap-i18n-smoke` | Kategoria 3 | trzy modale zamontowane naraz; są `fixed`, więc **widać tylko jeden** — dwa pozostałe właściciel ocenił „w ciemno" | **wysokie** |
| `chat-split-teresa-right` | Kategoria 4 | atrapa obu stron (`ArtifactMock` + mock czatu) | **A** |
| `canvas-new-doc` | Kategoria 4 | odtworzony 1:1 markup menu „+" | **A** |
| `canvas-kebab-restructure` | Kategoria 4 | odtworzony markup kebaba, etykiety po angielsku | **A** |
| `canvas-toolbar-md-history` | Kategoria 4 | odtworzony markup paska | **A** |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `ntype-analizuj-ai`: ROZSTRZYGNIĘTE 2026-09-02: lewa kolumna jest pusta, bo ten ekran pokazuje WYŁĄCZNIE panel analizy AI, a nie całą kartę. To własność przyrządu, nie defekt produktu — w aplikacji ten sam panel stoi wewnątrz pełnej karty (TaskDetailView:6066, DecisionDetailView, NotificationDetailView), gdzie lewą kolu
- `canvas-kebab-restructure`: Zrzut pokazuje zapis przebudowy menu z przeszłości — jest starszy niż dzisiejszy stan produktu.
- `canvas-kebab-restructure`: Panel współpracy nad przepływem (recenzent, wysłanie do przeglądu, zatwierdzenie) dalej jest po angielsku, ale schowany pod tym samym przełącznikiem dla programistów — zwykły użytkownik go nie widzi. Osobne zadanie.
- `canvas-new-doc`: Dane testowe nieaktualne wzgledem produktu — realny komponent ma juz polskie etykiety
- `canvas-toolbar-md-history`: Dane testowe pokazuja stara nazwe przycisku, juz poprawiona w produkcie
- `chat-signals-feed`: Wyjątek nazwany PRZED spojrzeniem: kolumna Sygnał nadal jest wąska i tytuły zawijają się na trzy linie — ale już wyłącznie na spacjach, nigdy w środku wyrazu. Podpis pod tytułem kończy się wielokropkiem.
- `teresa-chipy-panel-artefaktu`: Cienka crimsonowa smuga krazaca wokol pola pisania — USTALONE: to swiadoma ozdoba CHAT-OWN-012 (obrot 12 s, tylko gdy pole puste i nieaktywne). Na nieruchomym zrzucie wyglada jak rysa. Kolor to crimson #85182F przy 55% — kolizja z zasada, ze crimson jest tylko dla semantyki krytycznej. DECYZJA WLASC
- `teresa-chipy-sugestii`: Ta sama czerwonawa linia
- `teresa-confirm-chip`: PUSTKA ZAMIERZONA: Kontrolka potwierdzenia w czacie.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 15 w tym module (2 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `processflow-canvas` | „Generalnie okno jest ok. Tutaj wielkim wyzwaniem jest ten panel boczny. na tym obrazie jak go nie mogę ocnić" | 2026-09-01 | DO_NAPRAWY | Menu pod trzema kropkami na kanwie mówi teraz po polsku. Znikły napisy w rodzaju REALNE i CZĘŚCIOWE oraz angielskie końcówki — to był język  |
| `whiteboard-canvas` | „tutaj jest tylko problem taki ze jak zanaczam element otweira sie pasek poziomy funkcji i on sie nie mieści w pasu - sa ikony które wygladają poza okno. tutaj opisy trzeba skrócić albo wywalić." | 2026-09-01 | DO_NAPRAWY | — |
| `chat-signals-feed` | „Nie wiem, gdzie to jest, ale to jest w ogóle super mądre." | 2026-08-30 | ZROBIONE | — |
| `canvas-kebab-restructure` | „Wiesz nie wiem czy to docelowo będzie ok. Tutaj nagle wielkie funkcje sa pod pojedynczymi słowami. Nie wiem co to efektywnie zorbi. Moze warto byłoby zrobić z nich przyciski w delikatnych ramkach i połokrągłe. Zobaczmy co z tego będzie. To bardzo ważna zmiana | 2026-09-01 | BACKLOG | — |
| `canvas-new-doc` | „ok" | 2026-09-01 | BACKLOG | — |
| `canvas-toolbar-md-history` | „ok" | 2026-09-01 | BACKLOG | — |
| `chat-split-teresa-right` | „ok" | 2026-09-01 | BACKLOG | — |
| `melscanvas-workspace` | „OK" | 2026-09-01 | BACKLOG | Menu pod trzema kropkami na kanwie mówi teraz po polsku. Znikły napisy w rodzaju REALNE i CZĘŚCIOWE oraz angielskie końcówki — to był język  |
| `mindmap-canvas` | „OK" | 2026-09-01 | BACKLOG | Menu pod trzema kropkami na kanwie mówi teraz po polsku. Znikły napisy w rodzaju REALNE i CZĘŚCIOWE oraz angielskie końcówki — to był język  |
| `mindmap-i18n-smoke` | „OK" | 2026-09-01 | BACKLOG | — |
| `ntype-analizuj-ai` | „Potwierdziam ok. Będe wpisywał dalej tylko ok jako ponowne potwierdznie" | 2026-09-01 | BACKLOG | — |
| `teresa-chipy-panel-artefaktu` | „Love it" | 2026-09-01 | BACKLOG | — |
| `teresa-chipy-sugestii` | „A możemy gdzieś jakoś kontekstowo to włączać, wyłączać, bo ja generalnie jestem przeciwnikiem, ale pewnie są tacy, którzy dzięki temu rozumieją, co mają zrobić. Także wyrzucenie tego całkiem nie jest okej, ale w sobie tego nie lubię. Może tam, gdzie mamy plus | 2026-08-30 | BACKLOG | Chipy mozna wylaczyc i wlaczyc — przelacznik w menu Tryby AI, ustawienie zapamietuje sie po przeladowaniu. Domyslnie wlaczone, wiec nikomu n |
| `teresa-confirm-chip` | „A zaproponujmy może trochę bardziej delikatną formułę graficzną tego okna, bo ono teraz jest takie duże i trochę toporne, a dzisiaj standardy tego typu konwersacji są już bardziej delikatne. Jak na przykład to robi właśnie Claude." | 2026-08-30 | BACKLOG | Okno potwierdzenia jest teraz lekka kartka wtopiona w rozmowe zamiast ciezkiego modala: waskie, subtelna ramka, przyciski jako male pigulki  |
| `whiteboard-workshop` | „ok" | 2026-09-01 | BACKLOG | — |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-13_CHAT-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evidence/gra
   G19 |`IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY`| data=2026-09-04, sha=2a7273e087, mianownik pokryty=1 z 30 wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md` sekcja R2, przypadek „Day 360 G19 13 Chat private conversation isolation through ApiGateway denies a foreign organization while
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `IZOLACJA_UDOWODNIONA / MIANOWNIK_OTWARTY` (podniesione dyzurem 360 po scaleniu); P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/
```

### C4. Odłożone do fali 2 Twoją decyzją 03.09 (nie zobaczysz ich jutro i to nie jest defekt)

- `DEC-2026-09-03-357`: Nowa funkcja preferencji Czatu (zgłoszona za nieodtworzonym crashem) (koszt: DUŻE (nowa funkcja))
- `DEC-2026-09-03-377` (część): Przebudowa historii Czatu: rozdzielenie architekturą rozmów prywatnych i organizacyjnych (koszt: DUŻE — przebudowa `ChatHistorySidebar.tsx` (1 365 linii) + model widoczności)
- `DEC-2026-09-03-356`: Restrukturyzacja współdzielonego menu kanw Czatu (kebab) (koszt: DUŻE, szeroki promień)

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Chat → napisz krótką wiadomość do Teresy → otwórz listę rozmów w panelu
bocznym → kliknij realną, starszą rozmowę (nie pustą) → z kebaba wiadomości wybierz jedną akcję
(np. „Utwórz zadanie” albo „Kopiuj”).

**Co się zmieniło od 22–23.08**: naprawiony błąd, który wywalał cały panel sygnałów Czatu
(„feed.signals is not iterable”); komunikat błędu od dostawcy AI jest teraz zrozumiały i nie
pokazuje technicznego żargonu; dostępność klawiaturowa i kontrast doprowadzone do zera błędów.
Preferencja chipów sugestii jest teraz zapisywana per użytkownik w bazie; ustawienie przełączasz
w menu Czatu. Widoczne, jeżeli staging został zredeployowany po `15309dd3a6`.
(zdezaktualizowane przez `15309dd3a6` — realizacja `DEC-386`). Martwe, równoległe poddrzewo
wiadomości i stary `ChatPanel` usunięto; kroki powyżej odnoszą się do żywego panelu.
(zdezaktualizowane przez commit `1c4b5a5635` usuwający martwe poddrzewo Czatu).

**Czego NIE zgłaszaj**: restrukturyzacja menu kanw (kebab) w Czacie,
rozdzielenie historii na rozmowy prywatne/organizacyjne, przemalowanie czerwieni Czatu na
neutralne kolory — wszystko to świadomie odłożone do fali 2.

**Pytania (TAK/NIE)**:
- Wiadomość wysłała się i dostałeś odpowiedź bez błędu?
- Komunikat błędu (jeśli go zobaczyłeś) był zrozumiały, nie techniczny?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/13_CHAT/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
