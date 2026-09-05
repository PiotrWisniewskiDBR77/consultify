# RUNDA 3 — 17-aios (05.09.2026)

Wskazówka nadzorcy: `VITE_INTERNAL_TOOLS_ENABLED=false` w tym środowisku. Zmierzone: to NIE jest przyczyną — `canUseInternalTools()` (src/utils/internalToolsAccess.ts:42) zwraca `true` w trybie DEV niezależnie od flagi, więc dostęp do `/ai/*` na localhost:3000 jest odblokowany; ekrany faktycznie się renderują, w pełnej polskiej powłoce (Wave 6/7/8/9), zgodnej z obrazami zatwierdzonymi.

## Co to jest baner 'Not found' — zmierzone
Wszystkie 4 ekrany pokazują surowy, niezlokalizowany baner 'Not found' — to dosłowna treść błędu z zapytania API (np. `GET /api/ai-context/panel`), przechwycona przez `catch` i wypisana bez tłumaczenia. Trasy istnieją w kodzie serwera m03 (np. `Gateway.ts:1081 wave6ContextRoutes`), ale backend faktycznie odpowiadający na żądania (widoczny w rogu ekranu jako `LOCAL @b852ade6164e`) ma STARY gitSha — identyczny z `https://staging.consultify.ai/api/health` (`b852ade6164e...`) — i tych tras jeszcze nie serwuje. Wniosek: to DEFEKT zależny od wdrożenia serwera (CZEKA_NA_SERWER), nie brak danych — obraz zatwierdzony nie ma tego banera i pokazuje wypełnione dane.

| id | werdykt rano (R2) | werdykt teraz (R3) | jedno zdanie |
|---|---|---|---|
| aios-memory | ROZNI_SIE | **CZEKA_NA_SERWER** | Kompozycja identyczna z obrazem (Ustawienia kontekstu + Kandydat do pamięci po lewej, Co wie AI + Kolejka zarządzania pamięcią po prawej), etykiety pól po angielsku to znany wyjątek. |
| aios-connectors | ROZNI_SIE | **CZEKA_NA_SERWER** | Kompozycja zgodna: Zarejestruj konektor, Test wykonania narzędzia, Powiązanie z realnym źródłem po lewej; Stan konektorów (z przełącznikiem Kafle/Lista — życzenie właściciela już zrealizowane) + Audyt uruchomień po prawej. |
| aios-agents | ROZNI_SIE | **CZEKA_NA_SERWER** | Kompozycja zgodna: Uruchom agenta + Kontrolowane wykonanie narzędzia po lewej; Katalog, Zaplanowani agenci, Audyt uruchomień, Powiadomienia po prawej. |
| aios-outcomes | ROZNI_SIE | **CZEKA_NA_SERWER** | Kompozycja zgodna: Kontrakt KPI/ROI po lewej; Wyniki, Raporty, Panel AI Ops, Akceptacja końcowa po prawej. |

## Liczby
- CZEKA_NA_SERWER: 4 (wszystkie — baner 'Not found' + puste dane, trasy niewdrożone na obecnym backendzie)
- ROZNI_SIE: 0

## ROZNI_SIE ze specyfikacją naprawy
Brak — wszystkie 4 to jeden i ten sam mechanizm (backend na starym gitSha), nie defekt frontendu. Dodatkowa uwaga dla robotnika przy okazji naprawy serwera: zlokalizować komunikat błędu zamiast wyświetlać surowe 'Not found' (np. w Wave6ContextLearningPanel.tsx:96 i analogicznych panelach connectors/agents/outcomes) — dziś pokazuje angielski tekst error.message wprost użytkownikowi.
## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| aios-memory | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | Nadal 404 na GET /api/ai-context/panel — przyczyna dokładnie zdiagnozowana: middleware requireInternalToolsAccess zwraca 404 gdy INTERNAL_TOOLS_ENABLED != 'true' (kod tras Wave 6 jest kompletny i zamontowany, brakuje tylko zmiennej środowiskowej na stagingu). |
| aios-connectors | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | Ten sam mechanizm (INTERNAL_TOOLS_ENABLED) blokuje GET /api/ai-connectors — kod wave7-connectors.routes.ts kompletny, czeka na env var. |
| aios-agents | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | Ten sam mechanizm blokuje GET /api/ai-agents/catalog — kod wave8-agents.routes.ts kompletny, czeka na env var. |
| aios-outcomes | CZEKA_NA_SERWER | **CZEKA_NA_SERWER** | Ten sam mechanizm blokuje GET /api/ai-outcomes/outcomes — kod wave9-outcomes.routes.ts kompletny, czeka na env var. |

Ustalenie ponad to co wiedziała runda 3: to NIE jest brak kodu tras Wave 6-9 (są w pełni zaimplementowane i zamontowane w server/src/Gateway.ts:1081-1084). Jest to celowa bramka `requireInternalToolsAccess` (server/src/middleware/internalTools.middleware.ts) montowana PRZED prawdziwymi routerami (Gateway.ts:583-587), która zwraca 404 dopóki zmienna środowiskowa `INTERNAL_TOOLS_ENABLED` nie jest ustawiona na `'true'` na danym środowisku (na dev/test jest zawsze true). Konto piotr.wisniewski@dbr77.com (SUPERADMIN, domena dbr77.com) przejdzie domyślną whitelistę roli/domeny w chwili włączenia tej jednej zmiennej — to zadanie operacyjne (Railway env var), nie zadanie dla kolejnego dyżuru kodowego.

## Runda 5

Redeploy stagingu 10:49, gitSha `fd4e36e1e2` (`curl -s https://staging.consultify.ai/api/health`), env `INTERNAL_TOOLS_ENABLED=true` + `VITE_INTERNAL_TOOLS_ENABLED=true`. Zmierzone bezposrednio: wszystkie 4 endpointy AI OS zwracaja teraz HTTP 200 (GET /api/ai-context/panel, /api/ai-connectors, /api/ai-agents/catalog, /api/ai-outcomes/outcomes) — 0 bledow konsoli na kazdym z 4 zrzutow (poprzednio 1/4/4/2).

| id | werdykt runda 4 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| aios-memory | CZEKA_NA_SERWER | **ZGODNY** | Bramka zdjeta (200), kompozycja identyczna z obrazem wlacznie z sekcja "Kolejka zarzadzania pamiecia" (widoczna po przewinieciu — konto ma 25 realnych migawek zamiast 2 demo, stad dluzsza strona). |
| aios-connectors | CZEKA_NA_SERWER | **ZGODNY** | Bramka zdjeta (200), kompozycja identyczna (Rejestruj konektor / Test wykonania / Stan konektorow / Audyt), 13 realnych konektorow zamiast 3 demo. |
| aios-agents | CZEKA_NA_SERWER | **ZGODNY** | Bramka zdjeta (200), kompozycja identyczna (Uruchom agenta / Katalog / Zaplanowani agenci / Audyt / Powiadomienia), katalog ma 11 realnych agentow zamiast 2 demo. |
| aios-outcomes | CZEKA_NA_SERWER | **ZGODNY** | Bramka zdjeta (200), kompozycja identyczna (Kontrakt KPI/ROI / Wyniki / Raporty / Panel AI Ops / Akceptacja koncowa); Panel AI Ops pokazuje realny stan konta (Koszt $0, Bramka BLOCKED) zamiast demo (PASS) — to dane, nie uklad.

## Bilans po rundzie 5 (ten pakiet)
- ZGODNY: 4
- CZEKA_NA_SERWER: 0
