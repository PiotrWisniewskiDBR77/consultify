# Odbiór na żywo 05.09 — pakiet 07 — Realizacja (Execution)

Liczby: **ZGODNY: 2** · **RÓŻNI_SIĘ: 3** · **NIE_DOTARŁEM: 3** (razem 8)

## Zgodne (2)
- `execution-tab-list` (Realizacje) — kompozycja i preview panel identyczne z obrazem.
- `execution-tab-control` (Sterowanie) — kompozycja identyczna, tabela od razu pod paskiem filtrów.

## Różnią się (3) — z opisem
- `execution-tab-work` (Praca) — utyka trwale na "Loading canonical work" (liczniki 0), mimo że WSZYSTKIE zapytania sieciowe (execution-cases + work dla 5 realizacji) zwracają 200 z danymi. Błąd w warstwie stanu UI, nie w API/backendzie.
- `execution-tab-resources` (Zasoby) — jeszcze gorzej: po filtrach nie ma nawet komunikatu ładowania, tylko pusty biały ekran; tabela i panel podglądu z obrazu nie renderują się wcale.
- `execution-tab-rollout` ("Rollout"/Śledzenie KPI) — nagłówek i tabela renderują się poprawnie, ale kolumna Trend pokazuje wszędzie "No history yet" zamiast wykresów-sparkline z obrazu.

## Nie dotarłem (3) — z powodem
- `execution-report-day11` — zgodnie z dokumentacją pakietu cała powierzchnia jest domyślnie wyłączona wszędzie (potwierdzone w kodzie, "Rule #7"); zakładka Raporty pokazuje inny, bazowy ekran zarządzania raportami. To oczekiwany stan, nie nowa usterka.
- `exe-002-004-ui-audit` — dowodowy rekord z obrazu ("Margin Leakage Recovery Sprint") nie istnieje w danych tego środowiska; wszystkie realne inicjatywy na liście /initiatives kończą się tym samym błędem ładowania karty co w pakiecie 06 (demo-story ID nieznane API).
- `execution-tab-summary` ("Summary one-look") — mimo że flaga summaryOneLook jest w tym środowisku włączona, deep-link `?tab=summary` jest przekierowywany na `tab=list`, bo whitelist parametru `tab` w ExecutionHub.tsx nie zawiera wartości "summary", i nigdzie w kodzie nie ma przycisku, który by tam prowadził. Ekran jest zbudowany, ale całkowicie nieosiągalny nawigacyjnie.

## Ile czasu i co było trudne
Ok. 30 minut. Trudność główna: odróżnienie "stan pusty/oczekiwany" (execution-report-day11 — udokumentowane) od prawdziwej usterki (Praca/Zasoby — utykanie mimo poprawnych danych z API, wymagało śledzenia sieci żeby wykluczyć backend). Znalezienie właściwego deep-linku dla Rollout i Summary wymagało przejrzenia `ExecutionHub.tsx` (redirecty `/rollout`→`tab=rollout`, whitelist tab w efekcie deep-linku) — bez tego "Summary one-look" wyglądałoby na zwykłe "nie znalazłem", a w rzeczywistości to udokumentowany brak wywołania w kodzie.
