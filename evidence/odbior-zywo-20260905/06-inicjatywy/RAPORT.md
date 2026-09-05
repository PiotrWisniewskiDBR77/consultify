# Odbiór na żywo 05.09 — pakiet 06 — Inicjatywy

Liczby: **ZGODNY: 2** · **RÓŻNI_SIĘ: 0** · **NIE_DOTARŁEM: 3** (razem 5)

## Zgodne (2)
- `capacity-advisor-a3` (Obciążenie) — kompozycja identyczna z obrazem, różnice tylko językowe (konto EN) i znany wyjątek ucięcia tekstu.
- `plan-scenario-d1` (Plan) — kompozycja identyczna z obrazem, różnice tylko językowe i inne dane.

## Nie dotarłem (3) — z powodem
- `ev-football-field` — ekran nieosiągalny żadną ścieżką nawigacji. Otwarcie realnego rekordu wyceny w Finance → Enterprise valuation kończy się błędem "Legacy valuation is not mapped" (409, "Select a valuation to continue"). Flaga funkcji `ff.finance_value_panels` jest wyłączona w działającej aplikacji mimo że `.env.local` ma `VITE_FINANCE_VALUE_PANELS=true` — rozjazd konfiguracji/runtime. Po wymuszeniu flagi parametrem URL widać surową galerię 20 wewnętrznych paneli deweloperskich, kompletnie inną niż zatwierdzony obraz; zakładka EV basket w niej pokazuje tylko pusty tekst bez akcji.
- `karta-initiative` — pierwszy realny rekord listy Inicjatyw ("Pełna identyfikowalność partii") nie ładuje karty: czerwony błąd "Nie udało się załadować karty inicjatywy", potwierdzony przez retry. Sieć: 404 na wszystkich 3 endpointach API inicjatyw — rekord wskazuje na ID z puli demo-story, którego backend stagingu nie zna.
- `initiative-record` — sprawdzone na DRUGIM realnym rekordzie ("Akademia liderów transformacji") żeby wykluczyć przypadek jednostkowy — identyczny błąd. Wniosek: usterka jest systemowa, dotyczy całej listy Inicjatyw — obecnie nie da się otworzyć ŻADNEJ pełnej karty inicjatywy z realnych danych stagingu.

## Ile czasu i co było trudne
Ok. 25 minut. Trudność: dotarcie do ekranu EV basket wymagało kilku prób nawigacji (Finance→Enterprise valuation→otwarcie rekordu→błąd), doczytania kodu żeby zrozumieć strukturę flag (`financeEvBasketFlag.ts`, `financeValuePanelsFlag.ts`, `FinanceValuePanelsSurface.tsx`) i sprawdzenia, czy problem jest specyficzny dla jednego rekordu (sprawdzono 2 różne wyceny — ten sam błąd). Podobnie dla kart inicjatyw: pierwsza próba (błąd ładowania) mogła wyglądać na przypadek jednostkowy, więc sprawdzono drugi rekord, co potwierdziło usterkę systemową.
