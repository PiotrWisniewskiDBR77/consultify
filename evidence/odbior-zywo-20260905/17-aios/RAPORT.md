# Raport — pakiet 17 (Internal Tools / AI OS)

Liczby: ZGODNY 0 / ROZNI_SIE 4 / NIE_DOTARLEM 0 (na 4 ekrany)

## Uwaga metodyczna
Pakiet zakładał, że `VITE_INTERNAL_TOOLS_ENABLED=false` zablokuje dostęp (NIE_DOTARLEM). W praktyce
`.env.local` na tym środowisku ma tę flagę na `false`, ale `canUseInternalTools()` zwraca `true` gdy
`import.meta.env.DEV === true` — serwer działał w trybie dev, więc bramka nie zadziałała i wszystkie
4 ekrany były realnie dostępne pod `/ai/context`, `/ai/connectors`, `/ai/agents`, `/ai/outcomes`
(alias `/ai-os` przekierowuje na hub `/ai`). Zweryfikowano realnym zrzutem, nie zgadywano.

## Różnice (4)
1. **aios-memory** — puste karty „What AI Knows"/„Memory Stewardship Queue" (brak migawek/kandydatów), baner „Not found" + 1 błąd konsoli 404. Układ i pola (po angielsku — znany wyjątek) zgodne.
2. **aios-connectors** — Connector Health same zera i „No Wave 7 connectors yet." zamiast 3 przykładowych konektorów, baner „Not found" + 4 błędy konsoli 404. Przełącznik Tiles/List już obecny (życzenie właściciela).
3. **aios-agents** — Catalog/Scheduled Agents/Audit/Notifications wszystkie puste zamiast przykładowych wpisów z obrazu. Brak błędów konsoli.
4. **aios-outcomes** — Outcomes puste, AI Ops Dashboard pokazuje zera (Providers:0/Cost:$0/BLOCKED) zamiast danych z obrazu, baner „Not found" + 2 błędy konsoli 404.

Wspólny wzorzec: 3 z 4 ekranów (memory/connectors/outcomes) pokazują baner „Not found" i błędy 404 w konsoli —
wygląda na wspólne źródło (np. brakujący endpoint/zasób referencyjny dla tej organizacji), a nie 4 niezależne usterki.
Same układy/komponenty/sekcje są identyczne z obrazami zatwierdzonymi — różnice dotyczą wyłącznie danych (puste
zamiast przykładowych) i sygnałów błędu, nie struktury ekranu.

## Nie dotarłem
Brak (0/4) — wbrew założeniu pakietu wszystkie ekrany były dostępne.

## Czas i trudności
Największą trudnością było ustalenie, że `/ai-os` przekierowuje na `/ai` i że karty na hubie nie są linkami
klikanymi wprost tekstem (kliknięcie „text=Connectors" nie nawigowało) — rozwiązane przez odczytanie
`ROUTES.AI_OS.*` w `src/routes/routeConfig.ts` i nawigację bezpośrednio pod pełne ścieżki
(`/ai/context`, `/ai/connectors`, `/ai/agents`, `/ai/outcomes`). Czas: ok. 20 minut.
