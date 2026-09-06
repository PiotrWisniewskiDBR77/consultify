# 1.1-R3 (DEC-422c) — dowód

## Zrzuty (stanowisko lokalne, API 4100, vite 3167, 1440 light, konto audyt@dbr77.local)
Trasa: `/results/kpi/scorecards/0a9a0f97-c029-5687-98a3-b94c7a8c6ec7` (karta „KPI jakości — sierpień 2026").

- `00-karta-wynikow.png` — punkt wyjścia, przycisk „Dodaj miernik".
- `a-droga-a-lista-kpi.png` — droga A: po wpisaniu „rekl" lista 5 mierników po NAZWIE
  (Reklamacje zewnętrzne (PPM), LICZBA REKLAMACJI, WARTOŚĆ REKLAMACJI, …) + kod DBR77.BSC.xxx.
  ZERO UUID w oknie.
- `b-droga-b-propozycja-ai.png` — droga B: „Zaproponuj z AI" wypełniło opis (PL), jednostkę `%`,
  cel `90` i kierunek „Wyżej = lepiej". Podpis: „Propozycja AI wypełniła: opis, jednostka,
  kierunek, cel. Sprawdź i popraw — zapisuje dopiero »Dodaj«." NIC NIE ZAPISANE.
- `c-miernik-dodany-do-karty.png` — droga B po kliknięciu „Dodaj": miernik
  „Terminowość dostaw do klienta (1.1-R3)" w tabeli karty, licznik pozycji 1 → 2.

Błędy konsoli na zrzutach: 404 `…/review-snapshots/published` — trasa NIEZWIĄZANA z tą zmianą
(brak opublikowanej migawki przeglądu tej karty), obecna też na zrzucie `00` sprzed zmian.

## Rekord testowy — utworzony i USUNIĘTY
KPI `9b0a09b3-b7b7-46ed-9b81-aa7a23664cb5`
(`TERMINOWOSC_DOSTAW_DO_KLIENTA_1_1_R3_U7YAXQ`, opis zapisany w `rvn_kpi_definition_versions.description`,
`unit='%'`, `target_geometry='threshold_min'`, `target_value=95`).
Usunięty z lokalnej bazy 54400 (pozycja karty + wersja definicji + definicja) — kontrola po sprzątaniu:
`kpi=0, pozycje=0, wersje=0`. Baza demo/staging/produkcja NIETKNIĘTE.

## Testy
- ZASTANE PRZED zmianą: `testy-baza.txt` — 1 plik, 2 testy, PASS.
- PO: 2 pliki, 6 testów, PASS (4 nowe).
- Mutacje (każda RED, po każdej przywrócenie i GREEN):
  1. droga A wysyła `etykietaKpi(wybrany)` zamiast `wybrany.kpiId` → RED
  2. opis nieobowiązkowy (`if (!nazwa.trim()) return` + `brakOpisu = false`) → RED
  3. „Zaproponuj z AI" po propozycji woła `createKpiDraft` + `onSubmit` → RED
