# Karta decyzji — 10.09.2026, wieczór

Cztery sprawy, których nie rozstrzygam sam, bo dotyczą Twoich danych albo kierunku produktu.
Każda ma rekomendację; wystarczy „1 tak / 2 nie / 3 tak / 4 b" jednym zdaniem.

## 1. Polskie nazwy inicjatyw, decyzji i ryzyk na stagingu

Część Twoich inicjatyw, decyzji i pozycji RAID ma angielskie nazwy z czasów seedów. Skrypt tłumaczący
istnieje i był przetestowany na sucho, nie był uruchamiany. Działa z manifestem i cofnięciem.

**Rekomendacja: TAK**, uruchomić przed Twoim przejściem (inaczej przy przejściu zobaczysz angielskie wiersze
i zapiszesz je jako defekt).

## 2. Obciążenie w Realizacji liczy zero

Zakładka Zasoby pokazuje podaż 2240 h i popyt 0 h, więc obłożenie 0 %. Powód to brak danych, nie kod:
żadna z Twoich inicjatyw nie ma zapotrzebowania na etaty (`required_capacity_fte`), a osoby nie mają
stanowisk ani tygodniowej dostępności (2 z 15 osób ma stanowisko). Gotowy seed z 06.09 celuje w nieistniejące
identyfikatory i nic nie robi.

Opcje: (a) dosiać realistyczne zapotrzebowanie dla 10 największych inicjatyw DBR77 i stanowiska dla 15 osób
(pokazowo, z manifestem); (b) zostawić zero i zapisać jako znane ograniczenie do pilotażu.

**Rekomendacja: (a)** — ekran z zerami wygląda na zepsuty, a to jedna z kart flagowych Realizacji.

## 3. Megatrendy dla branży Northwind

Panel Megatrendów dla organizacji Northwind (motoryzacja) oddaje błąd, bo w bazie nie ma danych dla tej branży.
Kod działa dla branż, które mają dane.

Opcje: (a) dosiać megatrendy dla motoryzacji (zestaw 8–12 pozycji, po polsku, z manifestem);
(b) ukryć panel dla branż bez danych z komunikatem „wkrótce".

**Rekomendacja: (b) teraz, (a) po pilotażu** — pilotaż idzie na DBR77, nie na Northwind.

## 4. Duplikaty projektów w Twojej organizacji

Zmierzone dziś: „DBR77 Transformation Program" istnieje 6 razy, „DBR77 Demo — All Modules" 3 razy,
„Automated Changeover Optimization" 3 razy. Widać to w liście wyboru projektu przy nowej inicjatywie.
Pełna tabela (id, liczba inicjatyw i zadań w każdym, daty) jest w `evidence/e4-dane/d5-PRZED-*.csv`.

Opcje: (a) scalić duplikaty do jednego projektu każdej nazwy, przenosząc inicjatywy i zadania (z manifestem);
(b) zarchiwizować puste duplikaty, zostawić te z zawartością i dopisać im sufiks daty; (c) nie ruszać.

**Rekomendacja: (b)** — bez ryzyka pomieszania zawartości, a lista wyboru staje się czytelna.

---

Po Twoich odpowiedziach wykonuję bez kolejnych pytań, ze zrzutem bazy i manifestem przed każdą operacją.
