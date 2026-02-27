# KPI — Benchmark Pack: Plant Balanced Scorecard 2023 (v1, PL)

## Pack meta

- **tool_slug**: `kpi`
- **pack_type**: `benchmarks`
- **pack_version**: `1.0.0`
- **language**: `pl`
- **source_kind**: `tool_pack`

## Provenance (sources)

- Źródło danych (plik): `knowledge/KPI/TOP BGD + KPI v2023 — kopia(BSC).csv`
- Źródło danych (oryginał XLSX): `knowledge/KPI/TOP BGD + KPI v2023 — kopia.xlsx`

## Audience + use

- **Used by**: AI + PMO (przykłady KPI, słownik pól, inspiracje)
- **Do not use for**: bezpośrednie wartości “target/baseline” bez kontekstu organizacji (to tylko przykład)

---

## Sections (chunk-friendly)

### [section_id:overview] Co to jest

Ten plik to przykładowa **Plant Balanced Scorecard** (rok 2023) z KPI rozpisanymi po:

- obszarach/rolach,
- jednostkach i częstotliwości,
- typie wskaźnika (rozliczeniowy/informacyjny),
- wartościach miesięcznych + YTD,
- benchmarkach/limitach/targetach.

### [section_id:field_dictionary] Słownik pól (z pliku)

Najczęściej spotykane kolumny w CSV:

- **OBSZAR**: domena BSC / obszar odpowiedzialności (np. SALES, OPERATIONS).
- **WSKAŹNIK**: nazwa KPI.
- **Jednostka**: np. `%`, `m2`, `szt.`, `LC/1000`.
- **Częstotliwość**: Miesiąc / Kwartał / narastająco.
- **Typ wskaźnika**: Rozliczeniowy / Informacyjny.
- **Odpowiedzialność**: rola/funkcja (np. Sprzedaż, Finanse, HR, Technologia).
- **WYNIK (rok poprzedni)**: np. `2022 WYNIK`.
- **BENCHMARK**: benchmark wewn./zewn. (jeśli podany).
- **DOPUSZCZALNE LIMITY [%]**: tolerancja/limity.
- **CEL/REZULTAT**: cel + typ (w pliku występują jako nagłówki wielowierszowe).
- **miesiące + YTD**: wartości okresowe oraz “Year To Date”.

### [section_id:how_to_use] Jak używać w Consultify (kanonicznie)

- **W UI KPI wizard** ten plik jest inspiracją dla:
  - nazewnictwa KPI,
  - wyboru jednostki,
  - częstotliwości,
  - ownerów (role).
- **Nie jest** kanonicznym źródłem targetów dla organizacji bez kontekstu.
- Jeżeli używamy tego jako benchmarku:
  - zapisujemy proveniencję (plik + wersja),
  - dopisujemy “dla jakiego zakładu/konfiguracji” ma sens porównanie.

### [section_id:pairs] Typowe pary KPI (dobre praktyki)

- **Wynik finansowy** ↔ **Terminowość raportowania** (kontrola procesu vs wynik).
- **Sprzedaż (wolumen)** ↔ **Marża** (wzrost vs jakość wyniku).
- **Koszt pracy** ↔ **Rotacja/Absencja** (koszt vs stabilność zasobów).

