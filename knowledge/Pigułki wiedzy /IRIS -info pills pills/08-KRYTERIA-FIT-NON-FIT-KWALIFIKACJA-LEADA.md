# IRIS — Kryteria Fit / Non-fit (Kwalifikacja Leada)

Data: 2026-03-03  
Wersja: 1.0  
Cel: pomóc w kwalifikacji — kiedy IRIS da dużą wartość, a kiedy wdrożenie będzie nieefektywne.

---

## 1) Profil idealnego klienta (Ideal Fit)

IRIS jest najbardziej efektywny, gdy klient ma:

### 1.1. Skala i złożoność

- **Zakład/zakłady produkcyjne** z realną złożonością operacji:
  - ≥ 100 pracowników (lub wysoka automatyzacja i krytyczność dostępności),
  - wiele gniazd/stanowisk, kilka linii lub wiele SKU,
  - wewnętrzna logistyka (magazyn, lokacje, przepływy).
- **Wąskie gardła i koszty strat** są odczuwalne:
  - przestoje, awaryjność, braki materiałowe, niezgodności jakościowe.

### 1.2. Dojrzałość organizacyjna (wystarczająca do sukcesu)

- jest **Sponsor** (COO/CFO/CEO) zdolny podejmować decyzje,
- są **ownerzy procesów** (Produkcja/UR/Jakość/Logistyka/Lean/DX),
- istnieje minimalne governance: statusy, review KPI, rozliczanie zadań.

### 1.3. Typowe branże (przykłady)

- produkcja dyskretna (automotive, metal, maszynowa, elektronika),
- FMCG (linie, jakość, traceability),
- procesowa (chemia/food) — po dopasowaniu modelu danych,
- logistyka wewnętrzna i magazynowanie w zakładach.

---

## 2) Dobre dopasowanie (Fit) — warunki sukcesu

IRIS działa dobrze, gdy:

- klient chce **szybko uzyskać baseline i quick wins**,
- akceptuje podejście iteracyjne: *MVP danych → rekomendacje → egzekucja → KPI*,
- jest gotowość na **standaryzację** (definicje KPI, słowniki, role),
- IT umożliwia:
  - dostęp do przeglądarki (HTTPS),
  - (opcjonalnie) integracje API/SSO w kolejnych etapach.

---

## 3) Non-fit (kiedy IRIS nie będzie efektywny)

IRIS nie jest dobrym wyborem, gdy klient:

- jest zbyt mały (brak ekonomiki danych i procesu),
- nie ma decyzyjności (brak sponsora),
- nie akceptuje pracy nad danymi i procesami (“chcemy tylko raport”),
- oczekuje sterowania maszynami w czasie rzeczywistym jako podstawowej funkcji (to nie ten poziom systemu).

---

## 4) “Red Flags” — min. 20 sygnałów ostrzegawczych

Poniższe sygnały zwykle oznaczają ryzyko braku efektu lub bardzo długi time-to-value:

1. **Brak sponsora** i brak osoby decyzyjnej po stronie klienta.
2. **Sponsor nie ma czasu** i deleguje wszystko bez prawa do decyzji/budżetu.
3. **Brak ownerów procesów** (nikt nie “posiada” produkcji/UR/jakości/logistyki).
4. **Brak zgody na mierzenie KPI** (“nie chcemy liczb, bo będą rozliczenia”).
5. **Brak gotowości na transparentność** (lęk przed ujawnieniem niskiej efektywności).
6. **Oczekiwanie “magicznej AI” bez danych** i bez zmian procesowych.
7. **Chęć wdrożenia wszystkiego naraz** (brak priorytetów, over-scope).
8. **Brak minimalnego porządku w danych** i brak zasobów do ich poprawy.
9. **Zakaz eksportu/importu danych** (blokady bezpieczeństwa bez alternatyw).
10. **Brak zgody IT na dostęp HTTPS** do systemu (lub brak ścieżki dopuszczenia).
11. **Wymóg pełnej integracji z ERP/SCADA “na start”** jako warunek wstępny.
12. **Silna polityka “no cloud”** bez gotowości na Private Cloud/On-Prem i utrzymanie.
13. **Organizacja jest w kryzysie kadrowym** (brak rąk do pracy, zero capacity).
14. **Wewnętrzna wojna między działami** (IT vs produkcja vs finanse) bez mediacji.
15. **Brak zgody na role/RBAC** (“wszyscy mają wszystko”).
16. **Brak dyscypliny wykonania** (inicjatywy nie są dowożone, brak follow-up).
17. **Oczekiwanie pełnej odpowiedzialności dostawcy za wynik biznesowy** bez wpływu na proces i ludzi po stronie klienta.
18. **KPI zdefiniowane politycznie** (cel = “udowodnić” z góry założoną tezę).
19. **Brak zgody na audyt i ślad zmian** (sprzeczne z enterprise i compliance).
20. **Zbyt mała skala**: pojedyncza linia, proste operacje, brak mierzalnych strat.
21. **Bardzo niestabilny proces** (ciągłe reorganizacje) bez okresu stabilizacji.
22. **Zakup narzędzia “bo konkurencja ma AI”** bez problem statement i celu.

---

## 5) Szybka checklista kwalifikacyjna (dla sprzedaży)

Minimalne “TAK”, żeby iść dalej:

- jest Sponsor i Lider Projektu,
- są min. 2 ownerzy procesów (np. Produkcja + UR/Jakość/Logistyka),
- klient akceptuje 4–8 tygodni iteracji do pierwszych mierzalnych wyników,
- klient dostarczy minimalne master data lub ma plan, jak je przygotować,
- IT umożliwia dostęp i ma ścieżkę bezpieczeństwa (SSO/integracje — etapowo).

