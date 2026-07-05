# ★★★ NOTATKA-PRAWO: STANDARD TRIADY (słowa Piotra, sesja 2026-07-04 ~14:30)
> Wzorzec = ŻYWY pasek My Work Tasks (zrzut w sesji; light). „To menu, które tu załączam, jest dobre." Każde odstępstwo od tej notatki = błąd implementacji.

## MENU 1 — pasek górny (tożsamość)
- Lewa: breadcrumb „Moduł > Zakładka" (np. My Work > Tasks).
- Prawa: Data · Model · ikony systemowe · profil.
- Werdykt Piotra: „u góry w zasadzie cały czas jest wszystko ok" — NIE RUSZAĆ, tylko nie psuć.

## MENU 2 — środkowe, funkcjonalne (TO, CO SIĘ NAJCZĘŚCIEJ PSUJE)
- **Od LEWEJ:** lupa, potem przyciski funkcjonalne modułu (Ideas · Notebook · Inbox · Calendar · Tasks · Decisions · Manager) — ikona + etykieta.
- **Od PRAWEJ (w tej kolejności do środka):** primary CTA „New Task" (ciemny, wypełniony) · przełącznik widoków (segment ikon: lista / kanban / kalendarz) · ewentualne dodatkowe filtry, jeżeli potrzebne.
- **Kształt przycisków (KLUCZ):** zaokrąglone pigułki **W RAMKACH** (widoczna obwódka), tło płaskie; **aktywny = wypełnienie w innym, wyraźnie widocznym kolorze** (neutralnym — nie czerwień).
- **Rozmiar:** dokładnie jak na wzorze (h-9; ikona 16; label text-sm). „Wielkość jest tutaj także dobra."

## MENU 3 — dynamiczne (mniejsze przyciski, dopasowane do tabeli)
- Przyciski MNIEJSZE niż w Menu 2 (chipy h-7, text-[11px]), zawartość zależna od stanu tabeli — dlatego „menu dynamiczne".
- **TRZY TRYBY (wymienne w tym samym pasku):**
  1. **Filtracja prosta:** chipy z licznikami (All 119 · Overdue 42 · Today 0 · This Week 0 · Urgent 13 · New 0); aktywny chip wypełniony; liczniki zawsze widoczne (także 0).
  2. **Akcje bulk:** gdy zaznaczono ≥1 pozycję w tabeli — pasek czynności do wykonania na zaznaczeniu.
  3. **Karty otwartych pozycji:** gdy otwarto pozycję z tabeli — dynamiczne taby otwartych kart (przełączanie/zamykanie).
- **Od PRAWEJ:** przyciski funkcjonalne **AI** (np. „✦ AI Priorities").

## TABELA — wzorzec My Work Tasks („ten wzór tabeli jest po prostu idealny")
- **Separacja wierszy:** DELIKATNA linia włoskowa między wierszami — w light i dark. NIGDY gruba/biała linia ani odstęp-pas (to, co Piotra „przeraża na slajdach").
- **Wiersze z podtytułem lub bez:** podtytuł (szary opis pod tytułem) CHOWANY/ROZWIJANY przełącznikiem „Show row description" w menu funkcjonalności tabeli.
- **Kolumny — mechanika działa IDEALNIE w My Work, skopiować 1:1:** ręczna zmiana szerokości (grip na granicy, zero-sum, persistencja) · sortowanie klikiem nagłówka · filtrowanie per kolumna (lejek w nagłówku) · układanie kolejności kolumn.
- **Prawy górny róg tabeli — OBOWIĄZKOWY punkt kontrolny:** przycisk (Settings2) otwierający popover „VISIBLE COLUMNS": dodawanie/odejmowanie kolumn (Task/Actions = LOCKED), na dole przełącznik „Show row description" (chowanie/rozwijanie podtytułów wierszy). Piotr: „niezbędny element sterowania tabelą — kontroluj, czy jest we WSZYSTKICH tabelach tak przygotowany; w niektórych są jeszcze stare, zupełnie niepasujące elementy". ⇒ Każdy odbiór ekranu z tabelą ZACZYNA się od kliknięcia tego przycisku i porównania popovera z wzorem My Work.
- **Lewa krawędź każdego wiersza:** kwadracik (checkbox) — zaznaczenie wielu linii ⇒ w MENU 3 odpala się tryb działań na wielu liniach naraz; zestaw akcji bulk ZALEŻY OD KONTEKSTU tabeli (per encja).
- Statusy = cichy chip z kropką; priorytety = kropka + tonowany tekst; kebab po prawej każdego wiersza = długa kontekstowa lista sekcjami.

## KEBAB WIERSZA — standard 5 bloków (propozycja nadzorcy na bazie wzorów Tasks+Inbox; czeka na „ok" Piotra)
Kolejność bloków NIEZMIENNA, separatory między blokami, każda pozycja z ikoną:
1. **WEJŚCIE+DOMKNIĘCIE** (zawsze; treść wg encji): View/Open + Complete/Done/Approve.
2. **PRZEJŚCIA STANU** (kontekstowy): Task=To do/In progress/Blocked · Decyzja=Approve/Reject · Inbox=Focus→Today/This week/Later.
3. **CZAS** (tylko encje z terminami): Delay › / Snooze-presety (2h, jutro rano, 3 dni, pon.).
4. **UNIWERSALNY** (ZAWSZE identyczny app-wide): Open preview · Edit · Archive; niegotowe = disabled z dopiskiem („Coming soon"), nigdy ukryte.
5. **DESTRUKCYJNY** (zawsze ostatni, oddzielony): Delete/Reject — czerwony, jedyna czerwień menu.
API: moduł deklaruje bloki 1-3; bloki 4-5 dokłada StandardTable automatycznie (kebab bez kompletu = niemożliwy konstrukcyjnie).

## PREVIEW — 6 bloków od góry do dołu (Piotr: „rysy standardu są, ale nie w pełni — określić jasno")
1. Nagłówek: tytuł (truncate) · pin · Open (jedyne w preview) · ×.
2. Karta meta: chipy Status/Priorytet/Ważność + termin po prawej + linia rekomendacji.
3. DETAILS: etykieta + licznik słów + ⋮ (Copy/Export/Pobierz — TYLKO tu) + treść scrollowalna.
4. AI: ramka z chipami akcji AI per encja.
5. Relations: pigułki klikalne albo „No relations".
6. AKCJE: siatka 2 kolumny; rząd 1 = rozstrzygnięcia (Approve/Reject · Today/Snooze/Done), rząd 2 = informacyjne (More info/Delegate), rząd 3 = czas/eskalacja (Remind/Escalate/Snooze ▾).

## STANDARD PRZYCISKU AKCJI PREVIEW (super ważne — dziś brak standardu)
Jeden komponent; pigułka h-9 zaokrąglona Z WIDOCZNĄ RAMKĄ, ikona+etykieta+badge skrótu; 4 warianty kolorystyki (ustabilizowane, niepodmienialne): pozytywny=zielony tint · destrukcyjny=czerwony tint · uwaga=bursztyn · neutralny=ghost z ramką. Moduł deklaruje tylko wariant+etykietę+handler.

## KANBAN — wzorzec: My Work Decisions („generalnie zgodny ze standardem — inne mają wyglądać dokładnie tak")
**KOLUMNY**
- Nagłówek: kropka w kolorze semantycznym stanu + nazwa + goły szary licznik; opcjonalny „+" po prawej TYLKO w kolumnach, w których wolno tworzyć.
- Zawsze widoczne WSZYSTKIE kolumny cyklu życia — również puste (licznik 0) z placeholderem: mała ikona stanu + „No decisions/…" wyszarzone, wycentrowane w pionie.
- Kolumna = strefa, nie pudełko: bez własnego tła i obrysu; separacja światłem (odstępem). Stała szerokość; przy nadmiarze przewija się cała deska poziomo.
**KARTA**
- Lewa krawędź: pionowy pasek akcentu ~3px — kolor niesie pilność: bursztyn (oczekujące), czerwony (krytyczne/eskalowane). Karta CRITICAL dodatkowo ma delikatny różowy tint tła całej karty. To JEDYNE miejsca koloru powierzchni na karcie.
- Układ od góry: uchwyt drag (⠿) + tytuł (semibold, max 2 linie) → opis (szary, 2 linie, przycinany „…") → rząd chipów: priorytet (flaga + MEDIUM/HIGH/CRITICAL, cichy tonowany) i typ (ikona + label, neutralna ramka) → chip projektu (neutralny) → stopka: termin z ikoną po lewej („10d waiting" szare / „100d overdue" czerwonawe) + awatar-inicjały właściciela po prawej.
- Powierzchnia karty: bg-c-surface, zaokrąglenie md-lg, hairline ramka, cień minimalny; hover = lekko raised. Żadnych grubych obrysów.
**ZACHOWANIA**
- Drag&drop kartą między kolumnami (za uchwyt); pusta kolumna przyjmuje drop (strefa aktywna).
- Klik karty = preview (standard 6 bloków); double-click/Open = pełny widok.
- Nad deską: standardowa triada Menu 1/2/3 (Menu 2: przełącznik widoków wskazuje kanban; Menu 3: te same chipy filtrów co w widoku tabeli — filtry działają na deskę identycznie).
**ZAKAZY**: kolumny-pudełka z tłem/obrysem · pełne czerwone pigułki priorytetów na kartach · różne wysokości pasków akcentu · chowanie pustych kolumn.

## ZASADY WSPÓLNE
- Kolory aktywnych stanów: neutralne wypełnienie (nigdy crimson); czerwień wyłącznie semantyka krytyczna (liczniki Overdue itp. jako treść, nie jako stan przycisku).
- Ta notatka + żywe My Work = SSOT dla `src/components/standard/` (StandardModuleBar / StandardTable / StandardPreview). Tabela i preview: spec w _VEGAS_USTALENIA_KOMPLET pkt ★0 (kebab = długa lista kontekstowa sekcjami; preview = Header→Meta→Details⋮→AI→Relations→komplet akcji ze skrótami).
- Adopcja w modułach WYŁĄCZNIE przez te komponenty; każdy ekran odbierany checklistą z tej notatki.
