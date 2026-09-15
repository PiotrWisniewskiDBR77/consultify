# K2 SuperAdmin i18n v2 — independent review

**Werdykt: HOLD.** Poprawki v2 zamykają konkretne błędy z pierwszego odbioru i pokazują rzeczywiście polski ekran Organizations, ale kandydat podnosi front TSC z limitu 177 do 179 przez dwa nowe błędy w zmienionym `OrganizationsView.tsx`, manifest importerów nie obejmuje pełnej delty względem bazy, a status organizacji `pending` nadal ma błędną polską formę „Oczekujące”.

## Tożsamość i zakres

- Kandydat exact: `567938b0efa1c88d402dd76c94a6d6c3f989ffc0`.
- Kopia kandydata: `origin/backup/codex/b-k2-superadmin-i18n-20260915` wskazuje dokładnie ten sam SHA.
- Baza W73: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`.
- Review nie zmienia kodu produktu.
- Dozwolony zakres produktu zachowany; brak zmian w `DrdHttpMethodWorkspaceScreen.tsx`, `languagePolicy.ts` i `Dockerfile.api`.
- Zero nowych `as any` w delcie produktu.

## Blokery

### P1 — front TSC ma 179 błędów, czyli przekracza limit W73 o dwa

Pełny przebieg zakończył się w limicie 120 s: RC 2, 179 błędów i 7425 plików z `--listFiles`. Dwa błędy są nowe i leżą w pliku zmienionym przez K2:

- `src/views/superadmin/OrganizationsView.tsx:635` — TS2367 dla porównania statusu z `pending`;
- `src/views/superadmin/OrganizationsView.tsx:637` — TS2367 dla porównania statusu z `blocked`.

Typ `Organization.status` po wcześniejszym zawężeniu dopuszcza w tej gałęzi `cancelled | suspended | trial`, więc dopisane porównania są dla TypeScript niemożliwe. Bramka W73 wymaga `≤177`; aktualny kandydat ma 179 i nie może być przyjęty.

### P1 — status organizacji `pending` nie jest poprawnym polskim statusem

`superadmin.organizations.active` i `blocked` mają formy odnoszące się do organizacji: „Aktywna” i „Zablokowana”. Ten sam statusowy renderer oraz opcja edycji używają dla `pending` wartości „Oczekujące”. Poprawną spójną formą jest „Oczekująca”. Zrzut PL pokazuje wyłącznie rekordy aktywne, więc nie ujawnia tego błędu mimo deklaracji, że obejmuje statusy.

Pełny przegląd par EN/PL objął 539 pierwotnych kluczy K2 oraz 17 kluczy dodanych dla Organizations. Konkretne błędy z poprzedniego HOLD — grant, reveal panel, target audience, secret rotation, `Failed` oraz formuła — są naprawione. Pozostały też drobniejsze sformułowania wymagające korekty jakościowej, m.in. `No event types recorded in this window` oddane jako deklaracja, że typy zdarzeń „nie są rejestrowane”, oraz `rate limited` jako „ograniczone szybkością”.

### P2 — manifest importerów obejmuje poprawkę v2, a nie pełnego kandydata względem bazy

Kandydat zmienia 180 plików TSX względem `f2628a0d36`; poprawka po pierwszym HOLD zmienia tylko dwa TSX. `IMPORTER_DELTA_MANIFEST_V2.md` zawiera siedem plików testowych wyprowadzonych z tej drugiej, węższej delty. Nie zastępuje to brakującego manifestu importerów dla pełnych 180 plików produktu.

Przykładowe importery pominięte w manifeście istnieją dla `SuperAdminDashboard`, `EmailConfigurationPanel`, `OverviewModule`, `BillingCenterView` i `TenantCommandCenterView`. Niezależny przebieg siedmiu takich pominiętych plików dał 47/47 GREEN, ale nie stanowi kompletnego mianownika dla całej paczki. Wymagany jest manifest wyprowadzony z pełnego `git diff f2628a0d36..HEAD`, wynik per plik oraz porównanie z exact base.

Jedyny RED w dostarczonym manifeście jest uczciwie zastany: test `settings-admin-superadmin.p31-33.test.ts` i badany `adminNavigation.ts` mają identyczne blob SHA na bazie i kandydacie (`adb180d1e7…` i `fdaced1f36…`). Niezależnie powtórzony przebieg dał 100/101 z dokładnie tą samą jedną czerwoną asercją.

### P2 — freeze nie podaje finalnego SHA wprost

`FREEZE.md` podaje SHA kodu `3d61bbfb93` i opisuje finalny SHA jako „commit zawierający ten dokument”, ale nie zapisuje exact SHA freeze `567938b0…`. To nie zmienia tożsamości sprawdzonej przez review i backup, lecz finalny freeze po poprawkach powinien zawierać pełny SHA literalnie.

## Dowody pozytywne

- Test K2: 3/3 GREEN.
- Pomiar języka: `K4en 1 / K7 0` w dozwolonych ścieżkach; jedyny K4en to techniczne `pending:` w `InvoiceCenterView.tsx:383`.
- `npm run check:jezyk:ci`: GREEN, delta `K4en -600 / K7 -168`.
- Przykład formuły pozostaje `SUM(revenue) / COUNT(users)`; aplikacyjna konfiguracja i18n ma `escapeValue: false`, więc interpolacja `{{formula}}` nie zmienia identyfikatorów.
- Server TSC: RC 0.
- Esbuild pełnej delty TSX: 180/180 GREEN.
- `check-list-canon`: 349, baseline 349.
- `check-artefakt`: 8 / 0 / 117, bez wzrostu.
- Build: RC 0, 10754 moduły.
- Zrzuty EN i PL mają 2880×1800 pikseli, czyli logiczne 1440×900 przy skali 2. Oba obejrzano. PL ma przetłumaczone tytuł, akcje, zakładki, wyszukiwarkę, komunikat, nagłówki tabeli i widoczny status „Aktywna”.
- Logi `organizations-{en,pl}-light.console-network.log` są trwałym stdout repozytoryjnego `shot.mjs`: screenshot RC 0, błędy konsoli 0 i odpowiedzi 4xx/5xx 0.
- SHA-256 zrzutów: EN `d9aec183d3e97a6c1a912169e824456f0a22417b9a5cad7a3af40035841d767c`, PL `b5a29f66e89d417db4cd3adcedb8d2c1c6b16971015895e04f30b1f3a61d4b06`.

## Warunek ponownego odbioru

Naprawić dwa nowe błędy TypeScript, status `pending` oraz wskazane znaczeniowo słabe wartości PL. Następnie wygenerować pełny manifest importerów dla delty względem `f2628a0d36`, uruchomić go na kandydacie i exact base z `--retry=0`, a w nowym freeze podać literalny exact SHA. Pozostałe zielone bramki należy zachować bez regresji.
