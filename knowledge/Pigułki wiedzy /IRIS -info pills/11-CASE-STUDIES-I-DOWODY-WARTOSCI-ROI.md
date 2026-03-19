# IRIS — Case Studies i Dowody Wartości (ROI)

Data: 2026-03-03  
Wersja: 1.0  
Uwaga: poniższe case’y są **anonimizowane** i/lub **modelowe** (typowe scenariusze wdrożeń) — konkretne liczby zależą od branży, skali i jakości danych.

---

## 1) Jak liczymy ROI dla IRIS (prosty model)

### 1.1. Definicje

- **Korzyści roczne** (Benefits): oszczędności + dodatkowy zysk (np. większa dostępność, mniejszy scrap, mniejsze zapasy).
- **Koszty roczne** (Costs): licencja + wdrożenie + utrzymanie + zaangażowanie wewnętrzne (opcjonalnie liczone).

### 1.2. Wzór ROI

\[
ROI = \frac{Benefits - Costs}{Costs}
\]

### 1.3. Payback period (czas zwrotu)

\[
Payback\ (miesiące) \approx \frac{Koszt\ wdrożenia + licencja\ (mies.)}{Korzyści\ miesięczne}
\]

W praktyce IRIS najczęściej zwraca się na:

- **redukcji przestojów i awarii**,
- **redukcji braków materiałowych**,
- **redukcji scrapu/niezgodności**,
- **oszczędności czasu ludzi (raportowanie, koordynacja)**.

---

## 2) Przykładowe case studies (modelowe)

### Case 1 — Redukcja przestojów poprzez egzekucję działań (MES + GEMBA_TASKS)

- **Sytuacja początkowa**: częste przestoje na 2 kluczowych gniazdach, brak ownerów i SLA dla działań korygujących.  
- **Co wdrożono**:
  - lifecycle zleceń (MES) + rejestracja problemów i działań,
  - tasks z SLA i eskalacją (GEMBA_TASKS),
  - dashboard “top losses” + status działań.
- **Efekt**:
  - spadek łącznego czasu przestojów o 10–20% w 8–12 tygodni,
  - skrócenie “time-to-action” (od problemu do przypisania ownera) z dni do godzin.
- **Wartość**: jeśli 1h przestoju = 10 000 PLN, redukcja 20h/mies. = 200 000 PLN/mies.

### Case 2 — Skrócenie MTTR i kontrola backlogu UR (CMMS + alerty)

- **Sytuacja początkowa**: awarie zgłaszane telefonicznie, brak historii i priorytetów, work orders “giną”.  
- **Co wdrożono**:
  - CMMS (assets, failure report, work orders),
  - priorytety i SLA, raport “overdue”,
  - (opcjonalnie) automatyczne tworzenie work orders z alertów IoT.
- **Efekt**:
  - redukcja MTTR o 15–30%,
  - mniejsza liczba awarii powtarzalnych dzięki historii i analizie.
- **Wartość**: mniej utraconej produkcji + mniej nadgodzin UR.

### Case 3 — Domknięcie jakości (QMS auto po MES) i spadek scrapu

- **Sytuacja początkowa**: inspekcje jakości wykonywane niespójnie, brak natychmiastowego feedbacku do produkcji.  
- **Co wdrożono**:
  - QMS inspections + wynik PASS/FAIL,
  - automatyczne tworzenie inspekcji po `mes.order.completed`,
  - raport trendów (jakość vs produkt/linia/zmiana).
- **Efekt**:
  - szybsze wykrywanie odchyłów,
  - spadek scrapu/odrzutów o 5–15% w obszarze objętym kontrolą.
- **Wartość**: redukcja scrapu o 1 pp przy koszcie materiału 2 mln PLN/rok = 20 000 PLN/rok (dla wycinka); zwykle większa, gdy obejmuje linie krytyczne.

### Case 4 — Stabilizacja dostępności materiałów (WMS baseline)

- **Sytuacja początkowa**: braki materiałowe “zaskakują” produkcję; stock w Excelu i opóźniony.  
- **Co wdrożono**:
  - WMS: magazyny/lokacje/stock + przyjęcia,
  - widok braków i rotacji,
  - podstawowa dyscyplina aktualizacji.
- **Efekt**:
  - mniej zatrzymań produkcji z braku materiału,
  - mniej ekspresowych zakupów i transportów.
- **Wartość**: redukcja kosztów ekspresowych + poprawa OTIF wewnętrznego.

---

## 3) Średni czas zwrotu (benchmark dla rozmów handlowych)

W typowych wdrożeniach **czas zwrotu** najczęściej mieści się w widełkach:

- **3–6 miesięcy**: gdy startujemy od obszaru o wysokich kosztach strat (przestoje/awarie/braki) i szybko wdrażamy egzekucję (tasks + SLA).  
- **6–9 miesięcy**: gdy zakres obejmuje kilka modułów i wymaga porządkowania danych lub integracji.  
- **9–12+ miesięcy**: gdy projekt jest enterprise (wiele zakładów, compliance, duże integracje).

---

## 4) Jak IRIS “broni” ROI (mechanizmy systemowe)

- **Audit i ślad decyzji**: łatwo udowodnić, co zostało zrobione i dlaczego.
- **Zadania z SLA**: rekomendacje są egzekwowane, a nie tylko raportowane.
- **KPI baseline/target**: korzyści są mierzone, nie deklarowane.
- **Wąskie gardła i priorytety**: koncentracja na 20% działań dających 80% efektu.

---

## 5) Dane wymagane do policzenia ROI w ofercie (minimum)

- koszt 1h przestoju (lub zakres),
- liczba godzin przestojów / miesiąc (lub przybliżenie),
- koszty awarii (części, serwis, nadgodziny),
- scrap/odrzuty (proc. lub wartościowo),
- koszty ekspresowych braków (transporty, przestoje),
- koszt pracy ludzi na raportowaniu (osobo-godziny/tydzień).

