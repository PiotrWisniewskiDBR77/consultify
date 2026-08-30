---
doc_id: plan-po-odbiorze-20260830
status: proposal
truth_type: work-plan
established: 2026-08-30
zrodlo: 162 decyzje właściciela z odbioru grafiki (baza `odbior.sqlite`)
---

# Plan po odbiorze — 162 decyzje właściciela

## Co się wydarzyło

Właściciel przeszedł **cały arkusz odbioru**: 162 decyzje, **70 z komentarzem**.

| Werdykt | Ile |
| --- | --- |
| Akceptuję | **98** |
| Do poprawki | **48** |
| Odrzucam | **15** |
| bez decyzji | 1 |

**60% ekranów przeszło.** To jest wynik, nie porażka — i pierwszy raz w historii
projektu mamy podpisany, policzalny stan.

---

## Zasada porządkowania: przyczyny, nie ekrany

Dzisiejszy dzień dał na to trzy dowody. Jedna poprawka w domyślnej wartości
etykiety naprawiła nagłówki podglądu **w całej aplikacji**. Jedna poprawka
w formatowaniu daty naprawiła **każdą tabelę z kolumną daty**. Jedna poprawka
liczby mnogiej naprawiła **wszystkie liczniki „N dni temu"**.

Gdyby te trzy szły jako poprawki per ekran, byłoby ich kilkadziesiąt i część
zostałaby pominięta.

**Dlatego plan jest ułożony według przyczyn.** Kolejność wynika z dźwigni i ryzyka,
nie z kolejności zgłoszeń.

---

## FALA 0 — utrata danych (przed wszystkim innym)

To jedyny temat, w którym **użytkownik traci swoją pracę**. Nie jest kosmetyczny
i nie czeka na inne fale.

**Karta decyzji, słowa właściciela:** *„informacje przekazane nie są wysyłane do
serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd"*.
Baner na ekranie mówi to wprost — komentarze, alternatywy, ryzyka i notatki żyją
tylko w tej jednej przeglądarce.

**Karta zadania — zmierzone przeze mnie w kodzie:** cztery z ośmiu sekcji (Pomysły
realizacji, Ryzyka i alternatywy, Dowody, RACI) **nie mają ścieżki odczytu**.
`setRisks`, `setAlternatives`, `setImplementationIdeas`, `setEvidenceItems`,
`setStakeholders` są wołane wyłącznie z akcji użytkownika i z odpowiedzi AI —
**ani razu przy wczytaniu rekordu**.

**Pierwszy pomiar, zanim cokolwiek naprawimy:** czy te dane w ogóle **się zapisują**.
Sprawdzona jest tylko ścieżka odczytu. To rozstrzyga, czy tracimy pracę, czy tylko
jej nie pokazujemy — i to są dwie zupełnie różne naprawy.

---

## FALA 1 — warstwa wspólna (największa dźwignia)

Trzy poprawki, każda w jednym miejscu, każda dotykająca kilkudziesięciu ekranów.

### 1.1 Tabela na pełną szerokość, wiersz w jednej linii
Zgłoszone przy **ośmiu ekranach**: lista ocen · panel raportów · tablica inicjatyw ·
raporty DRD · sejf · biblioteka DRD · plan inicjatyw · wybierak metodyk.

**Zmierzone przyczyny — są DWIE, nie jedna:**
- raport DRD ma **twardy limit** `max-w-6xl` w kodzie,
- sejf i lista ocen limitu nie mają, ale tracą **~300 px na marginesach**
  (tabela 1138 px przy oknie 1440 px, lewy margines 147 px).

Do tego osobne żądanie: *„żeby każdy wiersz był jedną linią, a nie rozkładał się
na cztery"* — to jest kwestia szerokości kolumn i zawijania, nie samej tabeli.

### 1.2 Jeden podgląd (preview)
Zgłoszone przy **czterech ekranach**. Słowa właściciela przy zestawieniu czterech
podglądów obok siebie: *„to jest wartościowy obrazek, bo pokazuje, jak
nieporównywalne są podglądy, które powinny być takie same"*.
Kanon podglądu istnieje (`consultify-preview`, sześć bloków) — nie jest stosowany.

### 1.3 Jedno źródło kolejności sekcji prawego panelu
Pełna analiza: `ANALIZA_PRAWY_PANEL.md`. Trzy panele trzymają **własne kopie** listy
sekcji; siedem szyn stoi poza kanonem. Krok pierwszy to skasowanie kopii — zmiana
mechaniczna, bez efektu wizualnego, **zatrzymuje dalsze rozjeżdżanie się**.

---

## FALA 2 — decyzje konstrukcyjne (wymagają właściciela, potem budowa)

### 2.1 ROI = jedna karta N (3 odrzucenia, jedno uzasadnienie)
*„ROI to jedna analiza i powinna mieć formułę N-karty. Teraz, gdy tworzysz to
w menu poziomym, nie mamy możliwości ułożenia tego w strukturze dokumentu."*
Trzy dzisiejsze ekrany ROI (rejestr, pełne narzędzie, wyniki po wdrożeniu) scalają
się w **jeden artefakt z sekcjami**.

### 2.2 Wyniki = trzy poziomy — **ZDECYDOWANE**
`DECYZJA_WYNIKI_TRZY_POZIOMY.md`. Poziom 1 zbudowany jako prototyp, czeka na OK.
Dochodzi: przycisk „Nowe OKR" w prawym górnym rogu rejestru celów, oraz plan
inicjatyw, który *„otwiera wybraną linię jako tabelę poniżej zamiast konkretnej karty"*.

### 2.3 Ocena ≠ Audyt (temat merytoryczny, nie graficzny)
*„Audyt i oceny to dwie różne historie. Oceny mają swój framework i raporty."*
Do tego dwie uwagi tej samej klasy: prezentacja z oceny **odrzucona** („musi być
opis, muszą być macierze — teraz nie ma macierzy nawet"), oraz *„w ocenie mamy
macierz odpowiedzi i ona jest ważna, bo jest NARZĘDZIEM, nie prezentacją"*.
**To wymaga rozstrzygnięcia zakresu, zanim ktokolwiek narysuje ekran.**

### 2.4 Ekrany pośrednie bez celu (7 pozycji, 3 odrzucenia wprost)
*„Nie wiem, po co on w ogóle jest"* — o trzech generatorach szablonów.
Właściciel podał docelowy przepływ: **wybierasz „generuj szablon" → otwiera się
generator → gotowy szablon ląduje na liście szablonów.** Ekran pośredni
z podpowiedziami nie ma w tym miejsca.
Ta sama klasa: stany szablonu prezentacji, wejście „nowy wzorzec", pierwszy widok
Excela (*„jak otwieramy arkusz, pyta, czy z szablonu, czysty, czy z Teresą — to
omawialiśmy"*).

---

## FALA 3 — brakujące narzędzia pracy (funkcja, nie grafika)

Zgłoszone przy **pięciu ekranach** i to jest jedna rzecz powiedziana pięć razy:

*„nie mam tutaj w ogóle narzędzia Excelowego. Gdybym chciał zmienić coś w tych
tabelach, jak w Excelu…"* · *„nie widzę nigdzie, gdzie mogę edytować — narzędzi
do edycji ręcznej też nie widzę. Podobnie zresztą jak w Excelu"* (deck) ·
*„wyrzucamy całą tę zabawę z góry do prawego panelu i musimy dołożyć u góry listę
narzędzi do pracy z tabelą"* · *„tabela powinna zaczynać się od samej góry, teraz
jedna trzecia ekranu jest zużyta niepotrzebnie"*.

**Wniosek: arkusz i prezentacja są dziś do OGLĄDANIA, nie do PRACY.** Brakuje paska
narzędzi edycji. To jest funkcja do zbudowania, nie poprawka wyglądu.

---

## FALA 4 — duplikaty powierzchni

*„Trzeci raz dajesz mi tę kartę do akceptacji."* · *„Nie wiem, czemu to jest inna
tabela inicjatyw. Powinniśmy mieć JEDNĄ tabelę inicjatyw."*

Dwie rzeczy naraz:
- **w produkcie** — dwie różne tabele inicjatyw, do scalenia,
- **w moim arkuszu odbioru** — kilka ekranów harnessu montuje TEN SAM komponent
  produkcyjny, więc właściciel oceniał to samo po kilka razy. **To mój błąd
  narzędziowy:** arkusz musi odsiewać po komponencie, nie po nazwie ekranu.

---

## FALA 5 — polerowanie stylu (9 ekranów)

Przyciski, które są słowami zamiast przyciskami (wycena) · stany błędu do
wyśrodkowania i „napisania ładniej" · kontrolka potwierdzenia Teresy *„za duża
i toporna — dziś standardy takich rozmów są delikatniejsze, jak robi to Claude"* ·
chipy podpowiedzi do włączania kontekstowo · ikony w warsztacie agenta startujące
**zwinięte, nie rozwinięte** · Outlook w synchronizacji kalendarza · „bardziej
seksowny" launcher materiałów.

**Idzie na końcu świadomie:** to jedyna fala, w której nic się nie psuje, jeśli
poczeka.

---

## FALA 6 — agent (czeka na zgodę właściciela)

Zmierzone od końca do końca na czystej bazie lokalnej: **plan się tworzy
(201, trzy kroki w bazie), uruchomienie zwraca 200 i NIE ROBI NIC.**
Punkt zerwania: `agentTaskDispatchService.ts:61` — przełącznik
`ENABLE_AI_TASKS_WORKER` domyślnie wyłączony, z komentarzem „after owner approval".

**To jedyna fala, która nie zaczyna się od pracy, tylko od Twojej decyzji.**

---

## Czego w tym planie NIE MA — świadomie

- **Ekranów, których właściciel nie umiał umiejscowić** („nie wiem, gdzie to jest" —
  6 pozycji). Część to ekrany harnessu bez odpowiednika w produkcie, część to
  powierzchnie za wyłączoną flagą (raporty DRD). **Zanim je naprawimy, trzeba
  rozstrzygnąć, czy w ogóle istnieją w produkcie** — inaczej naprawimy coś, czego
  nikt nigdy nie otworzy.
- **Wyceny czasu.** Nie oszacowałem, ile to trwa. Nie mam podstaw, a zmyślona
  liczba byłaby gorsza niż jej brak.
