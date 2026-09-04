# CODEX DAY 304 — historia Czatu prywatna / organizacyjna

## Wejście

- HEAD: `416432abafe31a390a909cf7e460a4bad7bef191`; `MARKER OK`; worktree czysty.
- porty 5286/5287/6308 wolne, 41 GiB wolne, kontener wyłącznie `cx-day304-pg`.
- pełne migracje na pustej bazie: `Postgres migrations complete`; drugi przebieg `Applying migrations: 0`.
- Z30: brak zmiennych poczty, 0 wierszy `smtp%`, 0 drenów w `Gateway.ts`; `server/src/index.ts` nie uruchomiono.

„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.”

## R1 — pomiar

Tabela tras, porównanie schematu i funkcje panelu: `docs/program/prototypy/HISTORIA_CZATU_ZAKRESY_20260903.md`.

Korekty: panel ma dokładnie 1365 linii, ale zna zakresy; definicji `CREATE TABLE IF NOT EXISTS conversations` są trzy, nie dwie; wzorzec `cross-org-idor.test.ts` ma 1939 linii i w katalogu jest 11 nazw zawierających `idor`.

## R2 — reguła widoczności

Regułę docelową zapisano w projekcie, lecz kod zastany ma co najmniej dwa wykonania ACL: `findAccessibleConversation` w `conversations.routes.ts` oraz osobne warunki w `chat-projects.routes.ts`, wspierane przez `chatPermissionService`. R2 „jedno miejsce w kodzie” pozostaje **CZĘŚCIOWE**.

Czerwony kontrakt dla dalszej centralizacji: każdy odczyt/mutacja rozmowy musi przejść przez jeden resolver, a test ma oblać się po usunięciu z niego filtra `organization_id`; handler nie może odtwarzać warunku SQL lokalnie. Refaktor wymaga pełnego spisu wszystkich handlerów i dowodu Gateway, więc nie został improwizowany w tym commicie.

## R3 — model i migracje

Nie dodano migracji: wymagane dane już mają reprezentację. Zakres wynika z `chat_projects.scope` i `conversations.visibility_scope`; wersję polityki niesie `access_policy_version`; jawna zgoda i ślad są atomowo emitowane jako `chat.visibility_consent_recorded` z `before`, `after`, aktorem, wersją polityki i operacją. Pełny łańcuch na pustym PG przeszedł, drugi przebieg zastosował 0 migracji. R3 jest **GOTOWE pomiarowo**, bez czwartej definicji tabeli.

## Test bazowy

`conversations.search.realdb.test.ts`: 12/12, pełne nazwy w `/private/tmp/cx-day304-historia-czatu-artefakty/przed.json`, `--retry=0`, realny PG 6308 i podpisany JWT. Ograniczenie Z22: test montuje `conversationsRoutes` w gołym Express, nie przez `ApiGateway.initializeRoutes`, więc **nie jest dowodem produkcyjnego montażu**; potwierdza zachowanie routera na PG, w tym parę członek widzi / obca org nie widzi.

Pułapki Z33: komplet env wymusił PG, auth bypass=false; suite sama ustawia E2E_MODE dla części ścieżek, a negatyw członkostwa używa podpisanego JWT. Nie używam jej jako dowodu Gateway ani jako pełnego R4.

## R4 — izolacja

Przed/po: 12 pełnych nazw, 12 PASS, pusty diff nazw; listy mają SHA-256 `8f3e90b3b078827251448cb480e0fe31bf85bcf618fb87f6062f2cddd9fae133`. Para obejmuje członka zespołu, który widzi rozmowę, oraz użytkownika obcej organizacji, który jej nie widzi, na realnym PG i z `--retry=0`.

Werdykt R4: **CZĘŚCIOWE**. Nie wykonano wymaganego dowodu mutacyjnego ani przejścia przez `ApiGateway.initializeRoutes`; obecna suite montuje router bezpośrednio. Nie wpisuję `VERIFIED` ani `ZROBIONE_WG_DoD`.

## R5 — prototyp panelu

Nie dodano nowej etykiety ani alternatywnego panelu: R2 i R4 nie spełniają jeszcze ostrych warunków, a kryterium właściciela zakazuje kosmetycznego podziału. Zastany realny `ChatHistorySidebar` już renderuje prywatne i organizacyjne foldery oraz operacje historii, ale nie ma odrębnej flagi default-OFF dla nowego wariantu. Nowe kadry: `NIE WYKONANO`; stan R5: **NIEUKOŃCZONE**. Bezpieczna kontynuacja to najpierw scentralizowany resolver + Gateway/mutacja, potem wariant wizualny za flagą OFF i 4 obejrzane kadry.

## R6 — wynik

Stan dyżuru: **CZĘŚCIOWE**. R1 i R3 są zamknięte pomiarowo; R2 nie centralizuje zastanych reguł; R4 ma real-PG parę, ale bez Gateway i mutacji; R5 celowo nie tworzy kosmetycznej powierzchni.

STOP-pytanie: brak pytania produktowego — wymagany kierunek jest jasny. Bloker ma charakter dowodowo-implementacyjny, nie decyzji właściciela.

TWIERDZENIA NIEZWERYFIKOWANE: produkcyjny mount wszystkich tras przez Gateway; zachowanie po usunięciu filtra organizacji; zimny readback osobnym klientem po przeniesieniu; atomowość audytu w awarii; komplet 4 kadrów; a11y i właścicielska akceptacja wariantu. Nic nie scalono i żadnej flagi nie włączono.
