# SCEPTYK ODBIORU — wytyczne właściciela z 06.09 zmierzone na żywo

**Zlecenie SO-0609.** Powód: słowo właściciela 06.09 21:05 — „zanim dasz mi to do sprawdzenia,
przeanalizuj sam, czy wszystko z moich wytycznych zostało zrealizowane".

**Stanowisko pomiaru:** vite `3090` + API `4100`, HEAD m03 `29992c920b`, baza `54400` (org DBR77),
sesja `/private/tmp/stanowisko-noc/auth.json`, 1440 × 900, motyw light.
**Dowody:** `evidence/sceptyk-0609/` — 47 zrzutów z realnych tras (każdy z plikiem `.json`:
`url`, `bledyKonsoli`, pełny `tekst` DOM). Zrzut z harnessu nie był używany ani razu.

**Uwaga metodyczna (uczciwość zakresu):** stanowisko ≠ staging. Wszystkie liczby poniżej pochodzą
z lokalnej bazy `54400`. Wytyczne dotyczące danych właściciela na stagingu NIE były mierzone.

**Stanowisko sceptyka:** zadaniem było obalać, nie potwierdzać. Wiersze rejestru „scalone / na żywo"
były ignorowane — liczy się wyłącznie to, co widać na ekranie.

---

## §1 Tabela werdyktów

| # | DEC / pozycja | Cytat właściciela (skrót) | Werdykt | Dowód | Uwaga |
|---|---|---|---|---|---|
| 1 | **DEC-410** Wywiad bez steppera | „niepotrzebna, nic nie daje, usunąć" | **DONE** | `07-interview.png` — Menu 2 = Skrzynka · Sesje · Przydzielone · Szablony · Wnioski · Inicjatywy | Zero paska etapów, zero numerków ①–⑥ |
| 2 | **DEC-410b** Wywiad bez „Dopuszczenia" | „nie było takiego przycisku procesu… usuń" | **DONE** | `07-interview.png` | Zakładki „④ Dopuszczenie" nie ma |
| 3 | **DEC-411** Analiza kart N = warunek MVP | „koniecznie… analizy wszystkich n-type card" | **W TOKU (P10)** | — | Paczka analityczna, nie ekran |
| 4 | **DEC-407** „Pracuj z AI" + sticky w kartach | „powinniśmy mieć WorkWithAI… teraz jest archaiczna formuła" | **PARTIAL** | `34-init-karta.png` (Sekcje·Edycja·Podgląd·Pracuj z AI), `41-miernik-narzedzie.png` (Sekcje·Pracuj z AI), `37-swot-karta.png` (sam Pracuj z AI) | „Pracuj z AI" jest w 3/3 sprawdzonych kartach; Menu 5 niepełne: karta SWOT nie ma Sekcji ani Edycja/Podgląd, karta KPI nie ma Edycja/Podgląd |
| 5 | **DEC-412** Narzędzia: Insighty ≠ Raporty, CTA per zakładka | „we wszystkich zakładkach ten sam CTA… nie mogę wygenerować" | **DONE** | `24…27-tools-*.png` | 5 różnych CTA (Dodaj narzędzie / Nowa sesja / Nowy insight / Nowy raport / Nowa inicjatywa); Insighty 3 pozycje vs Raporty 16 — listy rozjechane, nie identyczne; nagłówki Inicjatyw po polsku |
| 6 | **DEC-413** Jeden generator inicjatyw (wzorzec z Oceny) | „taki sam generator jak w ocenie… w każdym miejscu" | **NIEMIERZALNE** | `19-audyty-inicjatywy.png`, `26-tools-inicjatywy.png`, `23-ocena-inicjatywy.png` | CTA „Nowa inicjatywa" istnieje w Ocenie, Narzędziach i Audytach; BRAKUJE pomiaru: czy wszystkie trzy otwierają ten sam modal (trzeba 3 kliki + porównanie treści modala) |
| 7 | **DEC-414** Ocena Biblioteka bez chipów Menu 3 | „wielka ilość tych okien, w ogóle wywal" | **DONE** | `06-assessment.png` | Zero rzędu chipów, zero pigułki Teresa |
| 8 | **DEC-414b** Ocena — cały moduł bez rzędu chipów | „trzecie menu jest zbędne… zostaw tylko to, co jest w filtrze" | **PARTIAL** | `20…23-ocena-*.png` | Chipy zniknęły ze wszystkich 4 zakładek ✔, ale filtr, który miał je ZASTĄPIĆ, nie powstał: w Menu 2 nie ma dropdownu, została sama pigułka „Wszystkie N". Porównaj Audyty, gdzie dropdown jest |
| 9 | **DEC-415 (1)** Kolor stanu odpowiedzi w sesji DRD | „częściowy pomarańczowy, potwierdzony zielony" | **DONE** | `42-drd-warsztat.png` | „Częściowo" zaznaczone pomarańczowo + pomarańczowa ramka karty pytania; zielonego nie dało się pokazać na tym stanie (żadna jednostka nie jest „Potwierdzona") |
| 10 | **DEC-415 (2)** „Zapytaj Teresę" ma być aktywny | „w ogóle nie jest aktywny" | **DONE** | `43-drd-teresa-klik.png` | Klik działa i otwiera dok Teresy z kontekstem: „AI uwzględnia: Ocena: Ocena DRD — Procesy Sprzedaży" |
| 11 | **DEC-415 (3)** „Podyktuj" ma słuchać albo zniknąć | „mikrofon Podyktuj nie słucha" | **NIEMIERZALNE** | `42-drd-warsztat.png` | Przycisk „Podyktuj" jest na ekranie; BRAKUJE pomiaru: nasłuchu mikrofonu nie da się sprawdzić zrzutem — potrzebny test z syntetycznym strumieniem audio albo ręczny |
| 12 | **DEC-415b** Nagłówek DRD: Ustawienia + kebab + „Pracuj z AI" | „zostawiamy tylko Ustawienia i kebab; dodajemy Pracuj z AI" | **DONE** | `42-drd-warsztat.png` | Są: Pracuj z AI, Ustawienia, kebab ⋮. Nie ma: chipa „Szkic", „Zapisano", „Zapisz teraz". Poza wytyczną został przycisk „Wyjdź" po lewej |
| 13 | **DEC-415c** DRD: większe czcionki, mniej pustki | „zważyłbym powiększenie czcionek" | **DONE** | `42-drd-warsztat.png` | Pytanie w dużym stopniu (≈24 px), pole odpowiedzi wysokie, karta zwarta |
| 14 | **DEC-416** Ocena → Wnioski: generator wniosków | „brak narzędzia do generowania wniosków" | **PARTIAL** | `21-ocena-wnioski.png` | Lista pokazuje TYP = „Wniosek" (nie „Zapis sesji”) ✔, CTA „Nowy wniosek" jest ✔; BRAKUJE pomiaru: czy CTA otwiera generator (Źródło → sesja → wniosek), czy tylko pusty formularz |
| 15 | **DEC-417** Audyty pod Oceną, bez Raportów DRD, „Nowy audyt" zamrożony | „przenieś poniżej Oceny"; „wyrzuć Raporty DRD"; „przycisk zamrozić" | **DONE** | `10-exec-kokpit.png` (kolejność ikon sidebaru), `03-audits.png` | Ikona Audytów bezpośrednio pod Oceną; brak zakładki „Raporty DRD"; „Nowy audyt" wyszarzony + komunikat „Zamrożone do fali 2: wgrywanie założeń audytu i generator pytań" |
| 16 | **DEC-417b** Audyty Menu 3: jeden wzór | „straszny bałagan w menu trzecim, poukładaj" | **PARTIAL** | `03/16/17/18/19-audyty-*.png` | Wzór JEST jednolity we wszystkich 5 zakładkach (dropdown w Menu 2 + dokładnie 3 chipy) — słowo właściciela spełnione; ale zakres CTO mówił „BRAK rzędu chipów" — rząd został |
| 17 | **DEC-417c** Audyty bez zakładki „Ustalenia" | „wywal ustalenia… nie wiem, po co to jest" | **DONE** | `03-audits.png` | Menu 2 = Biblioteka · Sesje · Wnioski · Raporty · Inicjatywy |
| 18 | **DEC-417d** Audyty: generatory jak w Narzędziach i Ocenie | „podpiąć generator raportów, inicjatyw i insightów" | **PARTIAL** | `17/18/19-audyty-*.png` | CTA per zakładka są („Nowy wniosek", „Nowy raport", „Nowa inicjatywa"), pusty stan mówi prawdę bez „Wkrótce" ✔; BRAKUJE pomiaru: czy CTA otwierają realne generatory |
| 19 | **DEC-417e** Audyty: „Wyniki" → „Wnioski" | „zamiast Wyniki to Wnioski" | **DONE** | `17-audyty-wnioski.png` | Zakładka „Wnioski", 1 wniosek (Kandydat) ze źródłem „Raport audytu", CTA „Nowy wniosek" |
| 20 | ODBIÓR: Organizacja · Panel administratora · Ustawienia | „zaakceptuj przejście przez organizację, panel administratora i ustawienia" | **ODEBRANE (nie mierzone)** | — | Zamknięte słowem właściciela 15:40; nie ma czego obalać |
| 21 | **DEC-419** Bez „Zapytaj Teresę o …" w prawym panelu kart | „to wyrzuć, skoro mamy już pracę z AI" | **PARTIAL** | `34-init-karta.png`, `41-miernik-narzedzie.png`, `37-swot-karta.png` (wszystkie: brak); kod: `src/components/ResultsVNext/teresa/TeresaProposalPanel.tsx:487`, `src/components/DiscoveryTools/tools/DynamicSWOT/TeresaSwotProposals.tsx:539` | Karty inicjatywy, miernika, sesji narzędzia, zadania, decyzji, powiadomienia, notatki — czysto ✔; ale ŻYJĄ jeszcze dwa przyciski: „Zapytaj Teresę ponownie" (panel propozycji Wyników) i „Zapytaj Teresę" (propozycje Teresy w SWOT). `teresaEntry` ma nadal 3 konsumentów w kodzie |
| 22 | **DEC-420** Inicjatywy Menu 3: 2–3 przyciski | „ogranicz do dwóch lub trzech" | **DONE** | `02-initiatives.png` | Dokładnie 3 chipy (Wszystkie 63 · Do zatwierdzenia 16 · W realizacji 22); „Adopt classic initiative" zniknęło; dropdown Priorytet + Status w Menu 2 |
| 23 | **DEC-420b** Pigułka „FILTERS: priority" precz | (obca pigułka nachodząca na Menu 3) | **DONE** | `44-init-priorytet.png` + `src/components/Initiatives/InitiativesHub.tsx:1246-1252` | Pigułki nie ma na żadnym zrzucie; w kodzie `activeFilters` nie jest już zasilany |
| 24 | **DEC-420c** Podgląd na klik wiersza (Inicjatywy) | „preview otwierany… przy pojedynczym kliknięciu na linię" | **DONE** | `15-init-klik-wiersz.png` | Klik w „Supply Chain Optimization" otworzył panel: KONTEKST INICJATYWY / Właściwości / POWIĄZANIA / Kopiuj link |
| 25 | **DEC-397b** Podgląd wraca na klik po zamknięciu (wszystkie listy) | „działa przy pojedynczym kliknięciu na linię albo z kebaba" | **DONE** | `15`, `35-kpi-raport`, `39-miernik-karta`, `40-drd-sesja`, `45-init-plan`, `46-init-obciazenie` | Zmierzone w 6 różnych listach (Inicjatywy, Wyniki, mierniki, Ocena, Plan, Obciążenie) — wszędzie klik wiersza otwiera podgląd |
| 26 | **DEC-422** Wyniki: „Uwaga" i „Raport zarządczy" precz z treści KPI/OKR/ROI | „usunąć w całości" | **DONE** | `36-kpi-karta.png`, `41-miernik-narzedzie.png` | Żadnego z dwóch przycisków nie ma ani na raporcie KPI, ani na karcie miernika |
| 27 | **DEC-421** Plan i Obciążenie = narzędzia z generatorem | „to zadanie tak duże, że trzeba je Codexowi wydać" | **DONE** | `45-init-plan.png`, `46-init-obciazenie.png` | Plan = tabela PLANÓW + „Nowy plan" + 3 chipy; Obciążenie = tabela ANALIZ + „Nowa analiza" + 3 chipy; podgląd na klik. Zero id technicznych `aco-plan-scenario-…`, zero EXECUTING/DRAFT po angielsku |
| 28 | **DEC-422b** Wyniki: „Raporty zarządcze" jako zakładka Menu 2 z generatorem | „przenieś do menu drugiego… dołącz generator" | **PARTIAL** | `33-wyniki-raporty.png`, `36-kpi-karta.png` | Zakładka „Raporty zarządcze" jest, tabela raportów + CTA „Nowy raport" ✔; ale „podwójne sterowanie", na które właściciel narzekał, ZOSTAŁO: raport KPI wciąż ma podrząd „Mierniki \| Migawki przeglądu" |
| 29 | **DEC-422c** Dodawanie KPI bez UUID, z opisem i AI | „wywala się dodawanie karty KPI… wymusić opis KPI" | **NIEMIERZALNE** | `36-kpi-karta.png` (CTA „Dodaj miernik" widoczne) | BRAKUJE pomiaru: nie otwierałem dialogu (zakaz tworzenia rekordów testowych w bazie demo bez sprzątania). Do zmierzenia: klik „Dodaj miernik" → czy pole to „KPI ID (UUID)", czy lista + opis + „Zaproponuj z AI" |
| 30 | **DEC-422d** Karty KPI/OKR/ROI = karty N | „nie ma drugiego, trzeciego menu… nie ma przycisku Work with AI" | **PARTIAL** | `41-miernik-narzedzie.png` | KPI: pełna karta N ✔ (pasek „Lista \| KPI WARTOŚĆ REKLAMACJI", Menu 5 „Sekcje · Pracuj z AI", sekcje Wyniki/Kontrakt/Pomiary/Odchylenia/Karty działania/Działania/Raporty/Historia). OKR (cel) i ROI (analiza) NIE zmierzone — właściciel powiedział „dokładnie te same uwagi" dla trzech typów |
| 31 | ODBIÓR: ROI · OKR · KPI — narzędzia TAK, sterowanie NIE | „jedyny brak: menu 1–3 i formuła Pracuj z AI" | **PARTIAL** | jw. | Zamknięte tylko dla KPI; dwa pozostałe typy kart bez dowodu |
| 32 | **DEC-422e** „Wyszukiwarka" precz | „ten wyszukiwak wywalamy" | **DONE** | `05-results-kpi.png` | Menu 2 Wyników = KPI · OKR · ROI · Raporty zarządcze — zakładki „Wyszukiwarka" nie ma |
| 33 | ODBIÓR/DEC-423 Materiały: filtry do standardu rozwijanej listy | „to dziwne coś usuń; zostają dwa rozwijane filtry" | **DONE** | `04-materialy.png` | Menu 2: dropdown „Status" + dropdown „Widoczność"; przycisku „Filtry" i popovera nie ma; brak crimsonowego „Pokaż robocze". Odstępstwo: CTA to „Nowa prezentacja"/„Nowy arkusz" per typ, nie jedno „Nowy materiał" |
| 34 | **DEC-423b/c** Materiały: jeden standard filtra + Menu 3 jak w Dokumentach; Arkusze bez „Źródeł danych" | „w trzech typach zrób tak jak w Dokumentach" | **DONE** | `04-materialy.png`, `29-mat-arkusze.png` | Menu 3 = 3 chipy statusu w każdej zakładce; w Arkuszach brak segmentu „Arkusze \| Źródła danych" |
| 35 | **DEC-423d** Biblioteka wzorców: Galeria/Tabela w Menu 2, bez dodatkowego rzędu | „ten przycisk powinien być w drugim menu"; „cały pasek do menu trzeciego"; „Nowy wzorzec wyłączyłbym" | **PARTIAL** | `30-mat-biblioteka.png` | Menu 2 = zakładki + „Pochodzenie i prawa" + Status + „Nowy wzorzec" WYSZARZONY („Tworzenie wzorców w fali 2") ✔; Menu 3 = jeden rząd formaty + źródła ✔; ale **pstryczka Galeria/Tabela nie ma w ogóle** — właściciel prosił o przeniesienie go do Menu 2, a on zniknął z ekranu |
| 36 | ODBIÓR: karta 1 Wyniki = TAK, karta 2 Materiały = TAK | „1 Tak, 2 tak" | **ODEBRANE** | — | Zamknięte słowem właściciela 17:54 |
| 37 | **DEC-424** Statusy inicjatyw: 7 statusów po polsku | „zrób na razie tak jak piszesz" | **DONE** | `02-initiatives.png`, `01-execution.png`, `26-tools-inicjatywy.png`, `23-ocena-inicjatywy.png` | Na czterech powierzchniach po polsku: Szkic · Do zatwierdzenia · Zatwierdzona · W realizacji · Zamknięta. Zero „NIEZNANY STATUS", zero EN |
| 38 | ODBIÓR: Partnerzy = odebrane | „zaakceptuj cały moduł partnerów" | **ODEBRANE** | — | — |
| 39 | **DEC-425** Spotkania za flagą (OFF), rozwój w Fali 2 | „wrzuć spotkania za flagi… nie będziemy tego rozwijać" | **DONE** | `10-exec-kokpit.png` (sidebar — brak ikony Spotkań), `09-meetings.png` | Sidebar: 11 pozycji, ikony Spotkań nie ma; głęboki link `/meetings` nie wywraca ekranu — pokazuje „Spotkania — planowane w Fali 2" |
| 40 | **DEC-426** Kokpit: przełącznik Ryzyka/Rozstrzygnięcia w Menu 3, jedna tabela na całą szerokość | „zrób przycisk na trzecim panelu menu, który przełącza widok… tabela na całą szerokość" | **DONE** | `10-exec-kokpit.png` | Menu 3 = „Ryzyka 16 · Rozstrzygnięcia 25" z licznikami, wybór zapisany w URL (`?kokpit=ryzyka`), jedna tabela na pełnej szerokości, kafle nietknięte |
| 41 | **DEC-427 (Praca)** Zadania z runtime, bez „SLA brak" | „wszystkie cztery funkcje leżą" | **PARTIAL** | `11-exec-praca.png` | 91 zadań (rejestr mówił 84 + runtime), statusy po polsku, zero „SLA brak", filtr realizacji w Menu 2, 3 chipy ✔. **ALE kolumna INICJATYWA ma „—" we WSZYSTKICH widocznych wierszach**, choć rejestr melduje naprawę „nazwy inicjatyw w Pracy" |
| 42 | **DEC-427 (Decyzje i ryzyka)** 25 decyzji / 16 ryzyk | jw. | **DONE** | `13-exec-decyzje.png` | Menu 3 = Decyzje 25 · Ryzyka 16 · Po terminie 13; CTA „Nowa decyzja"; eskalacje po polsku (Czerwona/Bursztynowa) |
| 43 | **DEC-427 (Zasoby)** podaż godzin, obłożenie | jw. | **PARTIAL** | `12-exec-zasoby.png` | Dane realne ✔: 9 osób, popyt 1042 h, podaż 2720 h, obłożenie 38 %, 11 przeciążonych tygodni, kolumny POPYT/PODAŻ/OBŁOŻENIE/LUKA, CTA „Dodaj dostępność". **ALE Menu 3 ma 10 chipów, z czego 6 stale 0** — to STOP zgłoszony przez wykonawcę R2 i wciąż nienaprawiony; łamie kanon ≤3 chipy |
| 44 | **DEC-427 (Raporty)** 4 poziomy z DOCX/PDF | „raporty na różnych poziomach" | **PARTIAL** | `14-exec-raporty.png` | Cztery poziomy są i są po polsku: Karta realizacji (Właściciel inicjatywy) · Tygodniowy pakiet realizacji (PMO) · Zdrowie programu (Komitet sterujący) · Jedna strona dla sponsora (Zarząd) ✔. **ALE** na liście nadal siedzą 2 stare wiersze „Kontrakt runtime" z 23 sie (do usunięcia wg R1), a eksportu DOCX/PDF nie zmierzyłem |
| 45 | **DEC-427 (Realizacje)** = inicjatywy w toku z RAG | jw. | **NOT** | `01-execution.png` vs `02-initiatives.png` | Zakładka „Realizacje" pokazuje **12 wierszy, wszystkie ze statusem „Zatwierdzona"** — czyli inicjatywy zatwierdzone, ale NIEROZPOCZĘTE. W tym samym momencie moduł Inicjatywy liczy „W realizacji 22". Rejestr melduje 23 wiersze. To nie jest lista realizacji |
| 46 | **DEC-428** Audyty: `program_owner` przechodzi cały łańcuch | (decyzja CTO na znaleziska A4) | **NIEMIERZALNE** | — | Stanowisko jest zalogowane kontem superadmina (Audyt Nocny). BRAKUJE: konta z rolą `program_owner` w bazie 54400 + przejścia finalizacja → raport → publikacja → wniosek na tym koncie |
| 47 | **DEC-429** Karty N: 5 wymogów właściciela | „każda karta musi mieć kontrakt… przyciski AI we wszystkich typach" | **W TOKU (P10-S)** | — | SSOT + matryca 21 kart w produkcji |
| 48 | **DEC-430** Karty N: pełny inwentarz („może ich być 140") | „wszystkie musimy przeanalizować" | **W TOKU (P10-I)** | — | Inwentarz w kodzie |
| 49 | **DEC-432 … DEC-441** (16 decyzji 21:31) | (klikane odpowiedzi) | **W TOKU (P13)** | — | Wydane 21:31, po restarcie stanowiska — poza pomiarem. Wyjątek niżej |
| 50 | **DEC-438 (fragment)** Ocena: CMMI/Lean jako „Planowane" | (decyzja 21:31) | **DONE** *(przed terminem)* | `06-assessment.png` | Biblioteka Oceny: ADMA/CMMI/LEAN/SIRI = „Planowane", DRD = „Rdzeń metody" |
| 51 | **DEC-442 / DEC-443** (4 decyzje 21:35) | (klikane odpowiedzi) | **W TOKU** | — | Wydane 21:35 |

---

## §2 Liczby

| Werdykt | Ile | Które |
|---|---|---|
| **DONE** | **25** | 1, 2, 5, 7, 9, 10, 12, 13, 15, 17, 19, 22, 23, 24, 25, 26, 27, 32, 33, 34, 37, 39, 40, 42, 50 |
| **PARTIAL** | **13** | 4, 8, 14, 16, 18, 21, 28, 30, 31, 35, 41, 43, 44 |
| **NOT** | **1** | 45 (Realizacja › Realizacje) |
| **NIEMIERZALNE** | **4** | 6, 11, 29, 46 |
| **W TOKU** | **5** | 3, 47, 48, 49, 51 |
| **ODEBRANE przez właściciela (nie mierzone)** | **3** | 20, 36, 38 |
| **RAZEM** | **51** | |

---

## §3 Rozjazdy rejestr ↔ ekran (najcenniejszy wynik)

Uporządkowane od najgroźniejszego.

1. **Realizacja › Realizacje pokazuje nie te inicjatywy.** Rejestr (1.12-R1, wiersz 256):
   „Realizacje = inicjatywy w toku z RAG (**23 wiersze**)". Ekran: **12 wierszy, każdy ze statusem
   „Zatwierdzona"**. Równolegle moduł Inicjatywy w tym samym runtime liczy **„W realizacji 22"**.
   Najbardziej prawdopodobna przyczyna: migracja P12 na siedem statusów (APPROVED = 12,
   IN_EXECUTION = 23) przestawiła filtr zakładki na APPROVED. To znaczy, że najważniejsza zakładka
   modułu, który właściciel ma jutro odbierać, listuje inicjatywy jeszcze nierozpoczęte.
   *Dowód:* `01-execution.png` vs `02-initiatives.png`.

2. **Praca: kolumna INICJATYWA pusta mimo meldunku o naprawie.** Rejestr (wiersz 256) wprost wymienia
   wśród napraw „nazwy inicjatyw w Pracy". Ekran: `—` we wszystkich widocznych wierszach 91 zadań.
   *Dowód:* `11-exec-praca.png`.

3. **Zasoby: 10 chipów Menu 3, 6 stale zerowych.** Wykonawca R2 sam zgłosił to jako STOP
   (`ExecutionHub.tsx:697-708`) i przekazał do R1; R1 zostało scalone, chipy zostały.
   Kanon po DEC-420/423b to ≤3 chipy. *Dowód:* `12-exec-zasoby.png`.

4. **Biblioteka wzorców: pstryczek Galeria/Tabela zniknął zamiast się przenieść.** Właściciel
   (16:36): „to, co jest pod Galeria i Tabela, dobrze pokazuje… tylko ten przycisk powinien być
   w drugim menu". Na ekranie nie ma go ani w Menu 2, ani nigdzie indziej — została sama tabela.
   *Dowód:* `30-mat-biblioteka.png`.

5. **DEC-419 zameldowana jako „usuń wszędzie", żyją dwa przyciski.** `TeresaProposalPanel.tsx:487`
   („Zapytaj Teresę ponownie", panel propozycji Wyników) i
   `TeresaSwotProposals.tsx:539` („Zapytaj Teresę", propozycje Teresy w SWOT — czyli dokładnie
   w narzędziu, przy którym właściciel wydał DEC-407 o „archaicznej formule").
   `teresaEntry` ma nadal 3 konsumentów w `src/`.

6. **Ocena: chipy usunięte, obiecany dropdown nie powstał.** Zakres DEC-414b mówił „zostaje dropdown
   filtra w Menu 2 (jeśli zakładka nie ma dropdownu, a miała chipy — dropdown zamiast chipów)".
   Na czterech zakładkach Oceny nie ma żadnego filtra — tylko licznik „Wszystkie N".
   W Audytach analogiczna praca dała dropdown. Dwa moduły, dwa różne wyniki tej samej wytycznej.
   *Dowód:* `20…23-ocena-*.png` vs `16…19-audyty-*.png`.

7. **Realizacja › Raporty: rekordy do usunięcia nadal na liście.** R1 zapowiadał usunięcie rekordów
   ACO; obok czterech poziomów MVP wiszą 2 wiersze „Kontrakt runtime" z 23 sie 2026
   (Tygodniowy pakiet realizacji, Obłożenie zasobów). *Dowód:* `14-exec-raporty.png`.

8. **Rozjazd „na plus": DEC-421 zrobione, choć rejestr trzyma je jako zapisane do paczki P11.**
   Plan i Obciążenie są już tabelami planów/analiz z CTA i podglądem. Rejestr należy zaktualizować,
   żeby nikt nie zlecił tego drugi raz. *Dowód:* `45-init-plan.png`, `46-init-obciazenie.png`.

9. **Rozjazd „na plus": DEC-438 (CMMI/Lean = „Planowane") już na ekranie**, mimo że decyzja padła
   21:31, po ostatnim scaleniu. *Dowód:* `06-assessment.png`.

10. **Liczniki Inicjatyw nie sumują się.** Menu 2 pokazuje „Status: Wszystkie **72**", Menu 3
    „Wszystkie **63** · Do zatwierdzenia 16 · W realizacji 22". Dwa różne „wszystkie" w jednym pasku.
    *Dowód:* `02-initiatives.png`.

---

## §4 Do pokazania właścicielowi rano (tylko DONE, jeden obraz na pozycję)

| Co powiedzieć właścicielowi | Obraz |
|---|---|
| Wywiad: dodatkowe menu etapów i „Dopuszczenie" usunięte | `evidence/sceptyk-0609/07-interview.png` |
| Ocena → Biblioteka: rząd chipów zniknął, Teresa tylko w Menu 1 | `06-assessment.png` |
| Audyty: pod Oceną w sidebarze, bez Raportów DRD i Ustaleń, „Nowy audyt" zamrożony | `03-audits.png` |
| Audyty: zakładka „Wnioski" zamiast „Wyniki", z wnioskiem i CTA | `17-audyty-wnioski.png` |
| Inicjatywy: trzecie menu ograniczone do 3 przycisków, filtry w Menu 2 | `02-initiatives.png` |
| Inicjatywy: podgląd otwiera się na pojedynczy klik wiersza | `15-init-klik-wiersz.png` |
| Inicjatywy: karta z „Pracuj z AI", bez „Zapytaj Teresę" | `34-init-karta.png` |
| Inicjatywy: Plan i Obciążenie to teraz tabele planów i analiz z generatorem | `45-init-plan.png` |
| Sesja DRD: kolor stanu odpowiedzi (Częściowo = pomarańczowy), większe czcionki | `42-drd-warsztat.png` |
| Sesja DRD: „Zapytaj Teresę" działa i otwiera Teresę z kontekstem pytania | `43-drd-teresa-klik.png` |
| Sesja DRD: nagłówek to już tylko Pracuj z AI, Ustawienia i kebab | `42-drd-warsztat.png` |
| Narzędzia: Insighty i Raporty to różne listy, każda zakładka ma swoje CTA | `24-tools-insighty.png` |
| Wyniki: Menu 2 = KPI · OKR · ROI · Raporty zarządcze (bez Wyszukiwarki) | `33-wyniki-raporty.png` |
| Wyniki: karta miernika jako pełne narzędzie z „Pracuj z AI" i sekcjami | `41-miernik-narzedzie.png` |
| Materiały: dwa rozwijane filtry, „dziwne coś" (popover Filtry) usunięte | `04-materialy.png` |
| Materiały → Biblioteka wzorców: „Nowy wzorzec" zamrożony, jeden rząd filtrów | `30-mat-biblioteka.png` |
| Statusy inicjatyw po polsku, siedem pozycji | `02-initiatives.png` |
| Spotkania zniknęły z menu, link nie wywraca ekranu | `09-meetings.png` |
| Realizacja → Kokpit: jeden przełącznik Ryzyka/Rozstrzygnięcia, tabela na całą szerokość | `10-exec-kokpit.png` |
| Realizacja → Decyzje i ryzyka: 25 decyzji, 16 ryzyk, 13 po terminie | `13-exec-decyzje.png` |

---

## §5 NIE mówimy, że gotowe

| Pozycja | Czego brakuje | Rozmiar |
|---|---|---|
| **Realizacja › Realizacje** (DEC-427) | Zakładka listuje 12 inicjatyw „Zatwierdzonych" zamiast 22 „W realizacji" — jeden filtr w źródle danych zakładki po migracji P12 | mały kod, duży skutek (~1 h) |
| **Realizacja › Praca** (DEC-427) | Pusta kolumna INICJATYWA w 91 wierszach — join zadanie→inicjatywa nie dociera do widoku | ~2 h |
| **Realizacja › Zasoby** (DEC-427) | 10 chipów Menu 3 → dropdown albo ≤3 chipy (`ExecutionHub.tsx:697-708`) | ~1 h |
| **Realizacja › Raporty** (DEC-427) | 2 rekordy „Kontrakt runtime" do usunięcia; eksport DOCX/PDF niezmierzony | ~1 h + pomiar |
| **Ocena, 4 zakładki** (DEC-414b) | Brakuje dropdownu filtra, który miał zastąpić chipy | ~2 h |
| **Biblioteka wzorców** (DEC-423d) | Brak pstryczka Galeria/Tabela — właściciel prosił o przeniesienie, a on zniknął | ~2 h |
| **Karty N: Menu 5** (DEC-407) | Karta sesji narzędzia (SWOT) nie ma „Sekcje" ani Edycja/Podgląd; karta miernika nie ma Edycja/Podgląd | ~3 h |
| **Teresa w dwóch panelach** (DEC-419) | `TeresaProposalPanel.tsx:487` i `TeresaSwotProposals.tsx:539` nadal renderują „Zapytaj Teresę" | ~1 h |
| **Wyniki: raport KPI** (DEC-422b) | Podrząd „Mierniki \| Migawki przeglądu" = podwójne sterowanie, na które właściciel narzekał | ~2 h |
| **Karty OKR i ROI** (DEC-422d) | Niezmierzone — właściciel powiedział „dokładnie te same uwagi" dla trzech typów, potwierdzony jest tylko KPI | pomiar ~30 min, naprawa nieznana |
| **Audyty: Menu 3** (DEC-417b) | Rząd chipów został wbrew zakresowi „brak rzędu chipów" (choć jednolity i ≤3 — do rozstrzygnięcia z właścicielem) | decyzja, nie kod |
| **Generator inicjatyw** (DEC-413) | CTA są w trzech modułach, ale nie potwierdzono, że otwierają ten sam generator z Oceny | pomiar ~30 min |
| **Generator wniosków Oceny** (DEC-416) | CTA „Nowy wniosek" jest — nie wiadomo, czy za nim stoi generator | pomiar ~20 min |
| **Generatory Audytów** (DEC-417d) | Trzy CTA — nie wiadomo, czy podpięte do realnych silników | pomiar ~30 min |
| **Dodawanie KPI** (DEC-422c) | Nie otwierano dialogu „Dodaj miernik" — nie wiadomo, czy UUID zniknęło | pomiar ~20 min |
| **„Podyktuj" w DRD** (DEC-415) | Przycisk jest, nasłuch mikrofonu niezmierzony | pomiar wymaga innego narzędzia |
| **Audyty: `program_owner`** (DEC-428) | Brak konta z tą rolą na stanowisku; łańcuch niezmierzony | pomiar ~1 h (założyć konto, przejść łańcuch, posprzątać) |

---

## §6 Znaleziska poza wytycznymi (zauważone przy pomiarze)

1. **Narzędzia → Sesje i Inicjatywy: 8 i 7 chipów Menu 3**, w tym nieprzetłumaczone **„Archived"**
   i **„Blocked"** (`27-tools-sesje.png`). Moduł nie został objęty kanonem Menu 3 z DEC-414b/417b/420.
2. **Narzędzia → Raporty: 12 błędów konsoli** typu „Encountered two children with the same key"
   (`25-tools-raporty.png.json`) — duplikaty kluczy React na liście raportów.
3. **Wyniki: 3 × HTTP 404** na każdej trasie Wyników —
   `/api/vnext/results/kpi/scorecards/<id>/review-snapshots/published`. Brak opublikowanej migawki
   zwracany jako 404 zamiast pustej odpowiedzi; śmieci w konsoli przy każdym wejściu.
4. **Karta sesji narzędzia pokazuje techniczną etykietę typu `dynamic-swot`** w pasku otwartych kart
   (`37-swot-karta.png`) — dokładnie ten defekt, który DEC-420/P4 kazał poprawić w Inicjatywach.
5. **Biblioteka wzorców: 79 wzorców z angielskimi nazwami** („Investor pitch", „Board deck",
   „[System] client final report (EN)") w produkcie prowadzonym po polsku.
6. **Realizacja → Decyzje: wszystkie 25 tytułów po angielsku** (dane, nie kod) — jeśli to ma być
   ekran pokazowy dla właściciela, warto je przetłumaczyć razem z DEC-437.
7. **Realizacja → Decyzje: trzy CTA w Menu 2** („Nowa decyzja", „Dodaj sygnał", „Przygotuj
   interwencję") — do zważenia wobec reguły jednego CTA na zakładkę.
