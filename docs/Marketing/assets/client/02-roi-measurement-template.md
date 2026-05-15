# ROI — szablon pomiaru (before / after / persistence)

**Dla:** CFO, CEO (Decision), Owner (Expansion)  
**Cel:** Wiązać inicjatywę z **liczbami**, które da się obronić przed zarządem i audytem.

---

## 1. Identyfikacja inicjatywy

| Pole | Wartość |
|---|---|
| Nazwa inicjatywy | *Np. Pilot Consultify — widoczność transformacji w obszarze [X]* |
| Opis biznesowy (1 akapit) | *Cel biznesowy, ograniczenie zakresu, powiązanie z priorytetem zarządu (np. koszt, przewidywalność, czas cyklu).* |
| Owner biznesowy | *Np. COO / Transformation Officer — imię i rola* |
| Owner finansowy (CFO delegate) | *Osoba akceptująca baseline i definicje kosztu* |
| Zakres czasowy | *Data start — data koniec pilota / fazy (np. T0 … T+90)* |

---

## 2. Baseline (before)

| Metryka | Jednostka | Wartość baseline | Źródło danych | Data pomiaru |
|---|---|---:|---|---|
| Koszt jednostkowy procesu (przykład) | PLN / EUR | *wpisz* | ERP / FP&A | *data* |
| Lead time / cycle time (przykład) | dni | *wpisz* | ticketing / proces | *data* |
| Obciążenie FTE na koordynację (przykład) | FTE-h / mies. | *wpisz* | szacunek + timesheet | *data* |

**Założenia baseline:** *Co jest włączone w koszt (licencje, FTE, integracje). Co jest wyłączone (np. capex niezwiązany z pilotem). Jedna wersja baseline — zmiana tylko z uzasadnieniem i wpisem w changelog.*

---

## 3. Target (planowany efekt)

| Metryka | Target | Termin | Metoda pomiaru |
|---|---:|---|---|
| Primary KPI (np. redukcja lead time) | *np. −15% vs baseline* | T+60 | *ten sam pomiar co baseline* |
| Secondary KPI (np. koszt koordynacji) | *np. −10% vs baseline* | T+60 | *Źródło: …* |

**Źródło targetu:** *Negocjacja z biznesem + sanity check CFO; opcjonalnie benchmark wewnętrzny / branżowy (bez obietnicy jeśli brak danych).*

---

## 4. Inwestycja (cost)

| Pozycja | Kwota / effort | Okres |
|---|---|---|
| Licencja / usługa Consultify | *wpisz wg oferty / umowy* | *np. miesiąc / faza pilota* |
| Wewnętrzny czas (FTE) | *godziny × stawka kosztowa lub % etatu* | *ten sam okres co pilot* |
| Inne (integracje, szkolenia, PMO) | *wpisz* | *…* |

**TCO widziane przez CFO:** *Suma powyższych + koszt opóźnień (jeśli istotny) + koszt ryzyka (opcjonalnie jako narracja, nie jako „ściśle wyliczone”).*

---

## 5. After (po wdrożeniu — pierwszy pomiar)

| Metryka | Wartość | Data | Delta vs baseline |
|---|---:|---|---:|
| Primary KPI | *wpisz* | *data pomiaru* | *% / abs* |
| Secondary KPI | *wpisz* | *data pomiaru* | *% / abs* |

**Uwagi:** *Jednorazowe efekty (np. sezon, zamknięcie kwartału), zmiany organizacyjne równoległe — opisz krótko, żeby audyt rozumiał kontekst.*

---

## 6. Persistence (utrzymanie efektu — klucz dla CFO)

| Okres review | Metryka | Wartość | Uwagi |
|---|---|---:|---|
| +30 dni | Primary KPI | *wpisz* | *…* |
| +60 dni | Primary KPI | *wpisz* | *…* |
| +90 dni | Primary KPI | *wpisz* | *trend vs after* |

**Reguła:** jeśli KPI spada poniżej progu *np. −5 pp vs poziom „after” lub vs uzgodniony floor* → *eskalacja do steering + plan naprawczy w 10 dni roboczych (dopasujcie do polityki klienta).*

---

## 7. Governance

- **Częstotliwość review finansowego:** *kwartalnie minimum; miesięcznie w pierwszym kwartale po go-live.*
- **Gdzie żyją dane:** *system źródłowy (ERP/BI) + eksport do wspólnego folderu due diligence / zarządu.*
- **Audytowalność:** baseline i zmiany baseline zatwierdza *CFO delegate*; log zmian w *jednym arkuszu / narzędziu*.

---

## Załącznik: przykład before/after (anonimowy)

Skrót lub link do wypełnionego [`05-case-study-template-anonymous.md`](./05-case-study-template-anonymous.md).
