# D-12 — dwa zarzuty: jeden naprawiony, drugi to DECYZJA WŁAŚCICIELA

## 1. „COMPLETENESS: P&L / —BS / —CF" — NAPRAWIONE (i to w trzech miejscach)
Myślnik braku był PRZYKLEJONY do nazwy sprawozdania, więc na ekranie czytało
się to jak literówka, a nie jak „brak BS".

Ten sam wyraz `` `—${type}` `` był przepisany w TRZECH plikach:
`Economics/FinanceHub.tsx:1170`, `Economics/hooks/useFinanceData.ts:434`
i `Finance/FinancialStatementPackWorkspace.tsx:252`. Naprawa w jednym z nich
odrosłaby w dwóch pozostałych, więc etykieta ma teraz jeden dom —
`financeCompletenessLabel` w `Economics/financeTypes.ts`.

Pomiar przed: `P&L / —BS / —CF`. Pomiar po: `P&L / — BS / — CF`.

## 2. „IX 2026" (rzymski miesiąc) — NIE REPRODUKUJE SIĘ i JEST WOLĄ WŁAŚCICIELA
Dwie rzeczy, obie zmierzone:

**a) Nie widać tego na wskazanym ekranie.** Na Wynikach → KPI kolumna PERIOD
pokazuje „—" (report builder nie ma wypełnionego okresu w danych Northwind).
Rzymskiego zapisu nie ma na tym zrzucie ani w tekście strony.

**b) Rzymski zapis nie jest „konwencją polską", tylko zapisem, o który
poprosił właściciel.** Jedyne miejsce, które go produkuje, to
`src/labels/kpiReportLabels.ts` → `kpiReportPeriodLabel`, a komentarz nad
tablicą mówi wprost: „Miesiąc rzymski — zapis, którym właściciel opisuje okres
raportu („VIII 2026")". Funkcja NIE przyjmuje `isPolish` — jest z założenia
językowo neutralna, bo cyfry rzymskie są takie same w obu językach.

Osobno w tym samym pliku istnieje `kpiPeriodColumnLabel`, który dla kolumn
tabeli daje `SEP 2026` / `WRZ 2026` — czyli produkt MA już zapis skrócony
i przełączany językiem tam, gdzie ma sens.

NIE ZMIENIAM tego bez słowa właściciela: to jego zapis, nie defekt.
PYTANIE DO WŁAŚCICIELA: czy dla klienta anglojęzycznego nagłówek okresu
raportu ma zostać „IX 2026", czy przejść na „Sep 2026" (jak kolumny)?
