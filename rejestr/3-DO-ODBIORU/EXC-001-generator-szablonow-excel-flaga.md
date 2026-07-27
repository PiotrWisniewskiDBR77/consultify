# EXC-001 — Generator szablonów Excel (zakładka + dopasowanie z czatu, za flagą OFF)

- **Stan:** DO ODBIORU (czeka od 2026-07-23, wzbogacone 2026-07-26)
- **Flaga:** `ff_workbook_templates` — default OFF (jedyna z flag Materiałów, która NIE dostała
  flipu 2026-07-22 — pozostałe: `ff_excele`/`ff_deck_architect`/`ff_tpl_editor` są ON).
- **Demo:** zakładka wdrożona `d410918a1e` (2026-07-23); dopasowanie 7/7 z czatu dołożone
  2026-07-26 w `4afa506200` (tag `demo-safe-2026-07-26-standard`).

## Co to jest
7 gotowych modeli arkuszy z żywymi formułami (3-scenariuszowy P&L, budżet operacyjny, wycena DCF,
próg rentowności, cashflow 12m, unit economics, amortyzacja kredytu) — rejestr kodowy
`WORKBOOK_TEMPLATES`, nie rekordy bazy (D4 architekta: to „modele workbooków", nie szablony
użytkownika).

**Dwie ścieżki użycia:**
1. **Formularz** (zakładka „Generator szablonów Excel" w hubie Materiałów, za flagą) — wybór
   modelu z kart, wypełnienie parametrów, podgląd siatki+formuł+wykresu, badge jakości.
2. **Czat** — użytkownik opisuje potrzebę słowami, model dopasowuje wzorzec z katalogu.
   **Naprawione 2026-07-26**: wcześniej bramka rozpoznawała tylko frazy P&L/scenariuszowe —
   pozostałe 6 modeli było nieosiągalne z czatu mimo że istniały. Teraz rozpoznaje PL+EN frazy
   dla wszystkich 7 (np. „próg rentowności"/„break-even", „amortyzacja kredytu"/„loan
   amortization"). Przy okazji naprawiono błąd, który wywaliłby budowę dla 6 nowych wzorców
   (zła funkcja mapowania parametrów, tylko pierwszy model miał poprawną).

## Do klikania w odbiorze (dopisz `?ff_workbook_templates=1` do URL Materiałów)
1. Hub Materiałów → zakładka „Generator szablonów Excel" → 7 kart modeli → wybierz dowolny,
   wypełnij parametry → podgląd siatki z prawdziwymi formułami + nazwy arkuszy (nie „Sheet 1/2")
   + mini-wykres + badge jakości.
2. W czacie (Excel/Arkusz z AI): opisz potrzebę frazą dla modelu INNEGO niż P&L (np. „potrzebuję
   harmonogramu spłat kredytu") — sprawdź czy trafia we właściwy model.
3. Wyłącz flagę → zakładka znika (formularz), czat nadal dopasowuje wszystkie 7 (to mechanika
   bez flagi, nie UI).

## Znany drobny dług (pre-existing, nie blokuje)
Brak — bugi percent×100 i „Sheet 1/2" zgłoszone wcześniej okazały się już naprawione przy
audycie 2026-07-26 (dowód w kodzie: komentarze z datami napraw).
