# CODEX DAY 247 — próbka z kategorii „już naprawione”

## Streszczenie

Na literalnym markerze instrukcji `df7f13056f` odtworzyłem populację 143 plików i, z ziarnem `20260901`, dokładnie tę samą próbkę 18 plików co autor. Do próby dołączyłem obowiązkowy `table-platform.routes.ts`. Wynik jest negatywny dla kategorii: w `table-platform.routes.ts`, poza naprawioną rodziną formularzy, nadal istnieją mutacje obiektu wyłącznie po jego `id`, bez dojścia do `organization_id` w `WHERE`.

Dyżur był wyłącznie statycznym pomiarem: nie uruchamiał bazy, runtime'u, testów ani modelu językowego i nie zmieniał produktu.

## Stan wejściowy

Marker instrukcji, użyty jako bezpośredni rodzic czystej gałęzi:

```text
df7f13056fa24995be07f64b0e8c877b3faeab45
MARKER OK (df7f13056f jest przodkiem github-backup/codex/m03-admin-20260824)
git status --short: pusty
```

Przed utworzeniem czystego worktree było 11 GiB wolne. Porty `6234`, `5214`, `5215` nie miały listenerów; kontener nie był wymagany i nie został uruchomiony.

## R1 — regeneracja i losowanie

Komenda autora, wykonana na historii markera, dała `143`. Ziarno `20260901`, `random.sample(..., 18)` dało dokładnie listę z instrukcji. Obowiązkowy dziewiętnasty plik dodano poza losowaniem.

## R2 — klasyfikacja 19 plików

Klasyfikacja dotyczy wyłącznie kryterium dyżuru: mutacji przyjmującej identyfikator obiektu i dochodzącej do zapisu bez tenantowego `organization_id` w `WHERE`. `BEZPIECZNY` nie jest ogólną akceptacją modułu, tylko wynikiem tego odczytu; `POZA ZAKRESEM` oznacza brak kwalifikującej mutacji obiektu.

| # | Plik | Wynik | Dowód statyczny |
|---:|---|---|---|
| 1 | `admin/service-accounts.routes.ts` | BEZPIECZNY | kontekst organizacji jest wymagany przed handlerami (`:14`), mutacje korzystają z tego scope |
| 2 | `benefits.routes.ts` | BEZPIECZNY | plik deklaruje ścianę tenantową dla całego routera (`:52`); mutacje obiektów przechodzą przez ten scope |
| 3 | `finance-enterprise.routes.ts` | BEZPIECZNY | `requireUser` zwraca parę `userId/orgId` (`:20`) używaną przez handlery |
| 4 | `method-core.routes.ts` | BEZPIECZNY | wspólna izolacja auth+tenant jest zadeklarowana na wejściu routera (`:15`); endpoint `outputs/:id/report` deleguje do tego samego scoped helpera (`:1763`) |
| 5 | `my-work/home.routes.ts` | POZA ZAKRESEM | brak mutującego endpointu z identyfikatorem; plik jest agregatem odczytowym (pierwszy kontekst użytkownika `:184`) |
| 6 | `organization/branding.routes.ts` | BEZPIECZNY | router wyprowadza `orgId` z parametru i sprawdza dostęp (`:41`); pięć mutacji zachowuje ten scope |
| 7 | `partners.routes.ts` | BEZPIECZNY / GLOBALNY | mutacje partnera korzystają z tożsamości użytkownika (`:226`); routery `superAdminPartnerRouter` i `partnerConfigRouter` są globalnymi operacjami administracyjnymi, nie tenantowymi obiektami |
| 8 | `performance.routes.ts` | POZA ZAKRESEM | brak mutującego endpointu |
| 9 | `pmo/projects.routes.ts` | BEZPIECZNY | router importuje i stosuje `requireOrgAccess` (`:22`), a mutacje projektu delegują do kontrolera po bramce capability (`:180-384`) |
| 10 | `presentationStudio.routes.ts` | BEZPIECZNY | plik jawnie deklaruje tenant scope (`:18`); jedyna kwalifikująca mutacja zachowuje kontrolę zasobu |
| 11 | `research.routes.ts` | BEZPIECZNY | organizacja jest wyprowadzana fail-closed z uwierzytelnionego requestu (`:39`) i przekazywana do operacji |
| 12 | `results-enterprise.routes.ts` | BEZPIECZNY | `requireUser` wymaga `userId/orgId` (`:19`) dla handlerów |
| 13 | `resultsVnext/okr.routes.ts` | BEZPIECZNY | router wymaga `requireOrgAccess()` (`:16`), a mutacje używają scoped access layer |
| 14 | `share.routes.ts` | BEZPIECZNY DLA KRYTERIUM | zapis share jest poprzedzony selekcją konwersacji należącej do użytkownika/organizacji (`:273-278`); update/delete wymagają właściciela lub twórcy (`:607-613`, `:670-675`) |
| 15 | `table-platform.relations-explain.routes.ts` | POZA ZAKRESEM | brak mutującego endpointu; wszystkie odczyty wymagają auth+organization (`:25`) |
| 16 | `user/preferences.routes.ts` | BEZPIECZNY | obiekt jest własnością `userId`; zapis jest scoped po użytkowniku (`:14`, routery `:76`, `:96`) |
| 17 | `v8/partner.routes.ts` | BEZPIECZNY | plik deklaruje scope przez `partner_users.partner_org_id` (`:2`); mutacje przechodzą przez partner access |
| 18 | `wave7-connectors.routes.ts` | BEZPIECZNY | `getAuthContext` wymaga `userId` i `organizationId` (`:20`); operacje używają tego kontekstu |
| 19 | `table-platform.routes.ts` | **DZIURAWY** | `PATCH /automations/:automationId/toggle` i `DELETE /automations/:automationId` nie mają access middleware (`:2964-2983`), a SQL zapisuje tylko `WHERE id = $1` (`AutomationService.ts:134-145`). Tak samo `PATCH/DELETE /relays/:relayId` (`:4368-4388`) dochodzi do `UPDATE/DELETE ... WHERE id` (`WebhookRelayService.ts:101-111`). Rodzina formularzy ma pięć głównych tras: POST `/forms`, GET `/bases/:baseId/forms`, GET/PATCH/DELETE `/forms/:formId`; trzy obiektowe mają dziś `requireFormAccess` (`:2839`, `:2851`, `:2869`) |

W `table-platform.routes.ts` są dalsze statyczne kandydaty tej samej klasy (m.in. webhooki i automatyzacje run-now). Do rozstrzygnięcia kryterium wystarczają dwa niezależne, prześledzone do SQL przypadki powyżej; pełny niewyrywkowy audyt tej dużej trasy pozostaje rekomendacją, nie został przedstawiony jako wykonany.

## R3 — kryterium

KRYTERIUM: czy w próbie 19 plików znaleziono choć JEDNĄ dziurę klasy "mutujący endpoint bez organization_id aż do WHERE" (poza już znanym, już naprawionym table-platform)?

**TAK.**

Kategoria "już naprawione" (290 plików wg audytu / 143 wg rekonstrukcji) **PRZESTAJE BYĆ KATEGORIĄ, na której można polegać bez czytania**. Rekomendacja: pełny, niewyrywkowy przegląd całej populacji, analogiczny do R2/R3 dyżuru 246 dla kandydatów "nietkniętych".

Live-proof dla wskazanych dziur powinien wykonać podpisanym JWT organizacji B mutację identyfikatora automatyzacji/relaya organizacji A przez realny `ApiGateway`, a następnie SQL i GET readback wykazujący brak zmiany. Ten dyżur nie miał licencji na bazę ani testy, więc nie wykonał ataku i nie wpisuje `VERIFIED`.

## Pomiar nazw testów

Licencja nie wskazuje żadnego pakietu testowego, a §5 jawnie nakazuje statyczny pomiar bez kontenera. Nie uruchomiono pakietu i nie ogłoszono wyniku testów. Artefakty `przed-nazwy.txt` i `po-nazwy.txt` są puste; ich diff jest pusty, bo nie dodano ani nie usunięto testu. Pułapki §0.2d (a)-(d) nie dotyczą niewykonanego runnera; pułapka (e) jest sednem odczytu wszystkich rodzin w plikach.

Oba artefakty mają SHA-256 `01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b` i leżą w `/private/tmp/cx-day247-probka-naprawione-clean-artefakty/`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Brak live-proof na realnym Postgresie; wynik `DZIURAWY` jest potwierdzony statycznie do literalnego SQL, zgodnie z licencją pomiarową.
- Nie ogłaszam pełnego audytu wszystkich 138 mutujących deklaracji w `table-platform.routes.ts`; wskazane przykłady rozstrzygają kryterium, a reszta wymaga osobnego niewyrywkowego przeglądu.
- Nie ogłaszam, że 18 pozostałych plików jest ogólnie bezpiecznych; klasyfikacja ogranicza się do kryterium tego dyżuru.

## Korekty wobec instrukcji

1. Pierwsza realizacja omyłkowo zastosowała marker kolejki `7a733cb63d` zamiast literalnego markera tej instrukcji `df7f13056f`, przez co gałąź zawierała dziewięć obcych commitów przed commitem dyżuru. Remediacja nie zmieniła ani nie przepisała skażonej gałęzi: odtworzyła wyłącznie dwa licencjonowane dokumenty na nowej gałęzi `codex/day247-probka-naprawione-20260901-clean`, której bezpośrednim rodzicem jest `df7f13056f`. Wszystkie pomiary wejściowe powtórzono na właściwym markerze; populacja nadal wynosi 143, próbka jest identyczna, a przytoczone linie i werdykt pozostają aktualne.
2. Komenda (3) z grepu szuka tylko ścieżek zaczynających się `/forms` i pokazuje trzy trasy obiektowe oraz submissions; nie pokazuje POST `/forms` i listy `/bases/:baseId/forms`. Policzyłem rodzinę z pełnych deklaracji, nie z obciętego grepu.
3. Komenda (6) oczekuje tekstu „Sasiednie trasy”, którego dokument nie zawiera; potwierdzenie 3/5 jest w `ZNALEZISKO_IDOR_FORMULARZE.md:16` i sekcji „Naprawa” od `:24`.
4. R1 poleca plik tymczasowy `/tmp/touched_247.txt`; populację podałem bezpośrednio potokiem do deterministycznego skryptu, bez tworzenia dodatkowego współdzielonego pliku. Wynik jest identyczny: 143 i ta sama próbka.

## Zakres zmian

W repo zmieniono wyłącznie ten raport oraz dopisano jedną sekcję na końcu rejestru audytu. Kod produktu pozostał nietknięty.

## Remediacja proceduralna i ancestry

Pierwotna gałąź `codex/day247-probka-naprawione-20260901` pozostaje nietknięta jako zapis błędu proceduralnego. Niniejsza gałąź korekcyjna została utworzona bezpośrednio z `df7f13056f`; przeniesiono wyłącznie zmiany z commitu dyżuru dotyczące dwóch plików dozwolonych tabelą licencji. Dowód po commicie: `git rev-parse HEAD^` ma zwrócić dokładnie `df7f13056fa24995be07f64b0e8c877b3faeab45`, a `git diff --name-only df7f13056f..HEAD` ma zwrócić dokładnie dwa pliki wymienione w tej sekcji.
