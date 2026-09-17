# EXPORT-1 XLSX v2 — poprawki po W173

Data: 2026-09-17
Tor: B
Właściciel: Codex-2

## Wynik

Zamknięto wskazane P1 i P2:

1. Trend używa reguł OOXML `expression` z formułami `SEARCH`, które ExcelJS
   zachowuje, a LibreOffice renderuje jako czerwone i zielone tła.
2. Guard parytetu renderuje XLSX przez LibreOffice i mierzy piksele trendu.
3. Table Studio wybiera profil scorecard automatycznie wyłącznie na podstawie
   `template_family_ref=SHEET-BASE` lub kanonicznego ID szablonu. Jawny
   `?profile=consultify-supplier-scorecard` działa, obcy profil zwraca HTTP 400.
4. Zwykłe tabele zachowują profil ogólny i wartości źródłowe.
5. Nazwy obu arkuszy i mapa `Template fields` są porównywane bezpośrednio z
   zaakceptowanym fixture, bez literalnej listy w skrypcie.

`TemplateService.createFromTemplate` zapisuje w `tp_bases.metadata` ID i rodzinę
szablonu. Dzięki temu późniejszy eksport rozpoznaje pochodzenie bez sniffingu
nagłówków i bez zależności od opcjonalnej kolumny starszych wdrożeń.

## Dowody

- focused: 5 plików / 58 PASS; kontrakt workflow: 7/7 PASS,
- server TypeScript: 0 przy `@types/node 22.19.3`,
- frontend TypeScript exact-lock: 152 zastane diagnostyki; wiążący pomiar linii
  z W182: 169; zero plików frontu w delcie,
- parytet: 16/16 PASS; render LibreOffice: 6798 czerwonych i 6756 zielonych
  pikseli trendu,
- mutacja `drop-trend-cf`: 4 RED, w tym piksele 112/102 poniżej progu 500,
- oba PNG obejrzane: brak ucięć i nakładania.

## Granica

Nie wykonano pushu na linię, wdrożenia, zmian Railway ani zmiennych środowiska.
Paczka wymaga niezależnego odbioru CTO.
