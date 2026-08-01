---
doc_id: OPS-SEC-001
truth_type: operations
status: READY_FOR_DECISION
owner: claude
product_owner: piotr
priority: P0
depends_on: SEC-PUB-002
last_reviewed: 2026-08-01
---

# OPS-SEC-001 — runbook operatora przed publicznym wystawieniem `demo.consultify.ai`

## Do czego służy ten dokument

To jest lista czynności **na żywym środowisku**, które muszą być wykonane, zanim
`https://demo.consultify.ai` zostanie pokazane komukolwiek spoza zespołu. Nie jest to
lista zmian w kodzie — te są w `SEC-PUB-002` (rejestr publicznej powierzchni
diagnostycznej) i w `OPS-DEMO-002` (publiczna ścieżka wejścia). Ten runbook zbiera to,
czego **żaden pakiet kodowy nie zamknie sam z siebie**, bo wymaga rotacji sekretu,
dostępu do Railway i zapytania do bazy `demo`.

Powstał, bo takiego dokumentu nie było. Sprawdzone i odrzucone jako punkt wejścia:

| Kandydat | Dlaczego nie |
| --- | --- |
| `docs/operations/STAGING_TO_PRODUCTION_RUNBOOK.md` | opisuje model `develop → main` i „dedicated Railway staging target”; kanon `ENVIRONMENT_AND_NAMING_AUTHORITY.md` mówi Railway project `consultify`, environment `demo`. Operator idący tym runbookiem celuje w nieistniejący przepływ |
| `docs/operations/STAGING_PRODUCTION_OPERATING_MODEL.md` | ten sam, wycofany model gałęzi; `last updated 2026-04-12` |
| `docs/operations/PRODUCTION_DEPLOYMENT_CHECKLIST.md` | audyt modułów SuperAdmina ze stycznia, nie procedura wystawienia stagingu |
| `docs/ssot/DATA_SECURITY_OPERATIONS.md` | kanon zasad („potencjalny wyciek wymaga rotacji, nie tylko usunięcia pliku”), świadomie bez kroków operacyjnych — jest mapą, nie procedurą |
| `PACKETS/OPS-DEMO-001_CONTROLLED_DEMO_PROMOTION.md` | `ACCEPTED`, zamknięty zapis jednej promocji kodu; jego bramki dotyczą deploymentu, nie ekspozycji publicznej |
| `PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md` | „Kroki stagingowe dla Codex” dotyczą wyłącznie testu slice’u 2 (publiczna rejestracja demo), nie stanu kont administracyjnych |
| `PACKETS/SEC-PUB-002_PUBLIC_SYSTEM_SURFACE.md` | ma sekcję „Co musi się zmienić, zanim `demo.consultify.ai` zostanie wystawione publicznie”, ale **jawnie odsyła rotację poza siebie**: „pytanie operacyjne do właściciela, poza kodem” (pozycja 2 listy P0) |

## Tabela bramek przed wystawieniem

Werdykt `GO` dla publicznej ekspozycji wymaga, żeby **każda** bramka blokująca miała
stan `WYKONANA` z dowodem. Bramka bez dowodu jest bramką niewykonaną.

| # | Bramka | Rodzaj | Właściciel treści | Kto wykonuje | Stan |
| --- | --- | --- | --- | --- | --- |
| **O-1** | **Rotacja i unieważnienie sesji poświadczenia ujawnionego przez byłe `GET /api/system/health`** | **BLOKUJĄCA — P0** | ten dokument | **operator z dostępem do Railway i bazy `demo` (nie agent)** | **NIEWYKONANA** |
| O-2 | Usunięcie `GET /api/system/health` i pustego modułu `routes/system-health.routes.ts` | blokująca — P0 | `SEC-PUB-002`, pozycja 1 | strumień kodu | wykonana w `d590a5efaa`, do potwierdzenia po scaleniu |
| O-3 | Usunięcie zaszytej pary poświadczeń z repozytorium | blokująca — P0 | `SEC-PUB-002`, pozycja 2 | strumień kodu | częściowa — patrz O-1 krok 4, punkt o `server/scripts/dev-ensure-admin.ts` |
| O-4 | Guardy na `/api/system-health`, `/api/health/aggregated`, `/database`, `/connections`, `/data-context` | przed wystawieniem, nieblokująca | `SEC-PUB-002`, pozycje 3-4, 7 | strumień kodu | otwarta |
| O-5 | `ENABLE_TEST_SUPPORT` i `TEST_SUPPORT_KEY` nieustawione na `demo` | przed wystawieniem | `SEC-PUB-002`, pozycja 10 | operator | otwarta |
| O-6 | Publiczna ścieżka wejścia `Try demo` przechodzi kroki stagingowe | blokująca dla funkcji | `OPS-DEMO-002` | Codex | `BLOCKED` |

O-2…O-6 są w tej tabeli po to, żeby operator widział całość jednym spojrzeniem.
Autorytetem dla ich treści pozostają wskazane pakiety — tu ich nie duplikujemy.

---

# O-1 — BRAMKA BLOKUJĄCA: rotacja poświadczenia administratora

> **NIE WYSTAWIAJ `demo.consultify.ai` PUBLICZNIE, DOPÓKI TA BRAMKA NIE JEST ZAMKNIĘTA.**
> To nie jest zalecenie, przypis ani „do zrobienia po odbiorze”. Sześć kroków niżej
> wykonuje się **przed** ekspozycją, w podanej kolejności, i każdy zostawia dowód.

## Czego dotyczy

Para adres e-mail + hasło administratora, którą do niedawna ujawniała **publiczna,
nieuwierzytelniona trasa `GET /api/system/health`**. Wartość pary jest zapisana
w `SEC-PUB-002` (ustalenie U1) oraz w historii Git pliku
`server/src/routes/system-health.routes.ts`. **W tym dokumencie nie jest powtarzana
i nie wolno jej tu dopisywać.**

## Dlaczego to jest blokada, a nie zalecenie

Trasa nie „mogła” ujawnić hasła — ona **odpowiadała na pytanie, czy hasło działa**.
Wszystkie trzy gałęzie handlera odsyłały tę parę w ciele odpowiedzi, w tym gałąź
sukcesu, która dodatkowo podawała rolę konta. Dowolny anonimowy klient z internetu
mógł zapytać serwer, czy poświadczenie administratora jest nadal ważne, i dostać
prostą odpowiedź.

Trasa nie miała żadnego middleware — montowana w `server/src/index.ts:150`, czyli
**przed** `helmet`, `cors`, sanityzacją, CSRF, audytem i globalnym `apiLimiter`
(`SEC-PUB-002`, sekcja „Kolejność montażu”). Nie ma więc ani logu dostępu, ani
licznika żądań, z których dałoby się odtworzyć, kto i ile razy pytał.

Stąd jedyny uczciwy wniosek operacyjny:

> **Para jest SKOMPROMITOWANA.** Była odpowiadalna dla anonimowych klientów przez
> nieznany okres i bez śladu w audycie. Zakładamy, że jest znana osobom trzecim.
> Brak dowodu nadużycia **nie jest** dowodem braku nadużycia — przy zerowym audycie
> takiego dowodu nie da się wytworzyć.

Usunięcie trasy (`d590a5efaa`) zamyka wyciek na przyszłość. **Nie unieważnia
poświadczenia, które już wyciekło.**

## Krok 1 — potwierdź, czego rotacja dotyczy

Zapytanie do żywej bazy PostgreSQL environment `demo` (i osobno PROD, jeśli konto tam
istnieje — patrz „Zakres”). Czytamy stan, nie zgadujemy z kodu.

1. czy konto o ujawnionym adresie istnieje, jaką ma rolę i `organization_id`;
2. czy ujawnione hasło nadal na nim działa — **tego nie sprawdzamy logowaniem
   z ciekawości**; sprawdzenie jest krokiem 6 i wykonuje się je **po** rotacji,
   z oczekiwaniem `401`;
3. czy istnieją inne konta z tym samym hasłem. Powód jest konkretny:
   `server/scripts/dev-ensure-admin.ts` ustawia **to samo domyślne hasło** dla konta
   SUPERADMIN (`:41`, `:44`) oraz dla całej listy `DEFAULT_DBR77_ADMINS` — **18 kont**
   (`:54`, `:182-183`). Jeśli ten skrypt kiedykolwiek biegł przeciwko bazie `demo`,
   rotacja jednego konta nie wystarczy.

Wynik kroku 1 to lista kont do rotacji, z identyfikatorami. Lista wchodzi do dowodu.

## Krok 2 — rotacja PRZED wystawieniem, nie po

Kolejność jest bezwzględna: **rotacja → unieważnienie sesji → weryfikacja →
ekspozycja publiczna**. Nie odwrotnie, nie „równolegle”, nie „zaraz po demie”.

Uzasadnienie w jednym zdaniu: po wystawieniu publicznym adres jest osiągalny dla
całego internetu, a poświadczenie, które przez nieznany czas było potwierdzane
anonimowo, daje wejście na konto z rolą administratora w środowisku z realnymi danymi
klientów demo.

Rotację wykonuje się **ścieżką aplikacji** (`POST /api/auth/change-password`,
`server/src/routes/auth.routes.ts:2160`) albo resetem hasła
(`POST /api/auth/reset-password`, `:2285`), a nie `UPDATE users SET password_hash`
wprost w bazie. Powód jest w kroku 3.

## Krok 3 — unieważnij WSZYSTKIE sesje i rodziny refresh tokenów

To jest krok, który najłatwiej wykonać pozornie.

### Czego NIE wolno użyć jako dowodu

**`POST /api/auth/revoke-all` (`server/src/routes/auth.routes.ts:2106`) NIE KOŃCZY
SESJI.** Zwraca `200 { message: 'All tokens revoked successfully' }` i tego komunikatu
nie wolno traktować jako potwierdzenia. Mechanizm, per `SEC-AUTH-001`:

- handler zapisuje **jeden wiersz-znacznik** do `revoked_tokens`
  (`auth.routes.ts:2125`, `reason = 'revoke-all'`) i **nie dotyka `refresh_tokens`**;
- znacznik czyta wyłącznie middleware tokena **dostępu**
  (`server/src/middleware/auth.middleware.ts:259`, porównanie `iat` `:1095-1100`);
- `RefreshTokenService` **nigdy** nie czyta `revoked_tokens`, więc każdy, kto trzyma
  refresh token, wymienia go na **nowy** token dostępu z późniejszym `iat` — a taki
  przechodzi kontrolę. Sesja trwa dalej.

To jest cicha awaria mechanizmu bezpieczeństwa: operator dostaje `200` za operację,
która nie nastąpiła. Ta sama klasa błędu co awaria kanału mailowego z 2026-07-31,
gdzie `send()` zwracało `true` po odrzuceniu przesyłki przez serwer.

### Czego użyć

Mechanizm, który działa, **istnieje w kodzie**:
`refreshTokenService.revokeAllUserTokens(userId)`
(`server/src/services/RefreshTokenService.ts:500`, implementacja `:558-564` —
`UPDATE refresh_tokens SET revoked_at = …, revoked_reason = ? WHERE user_id = ?
AND revoked_at IS NULL`). Unieważnia całą rodzinę refresh tokenów konta.

Jest wołany automatycznie przez:

- zmianę hasła — `auth.routes.ts:2210`;
- reset hasła — `auth.routes.ts:2351` (`reason = 'password_reset'`).

**Stąd wymaganie z kroku 2:** rotacja wykonana ścieżką aplikacji unieważnia rodziny
refresh tokenów sama. Rotacja wykonana `UPDATE`-em wprost w bazie **nie unieważnia
niczego** — wtedy revocation trzeba wywołać osobno i osobno udowodnić.

### Uwaga o tokenach dostępu, które już są w obiegu

Rotacja i `revokeAllUserTokens` nie kasują tokenów dostępu wydanych wcześniej — te są
podpisanymi JWT i żyją do swojego `exp`. Na `demo` domyślny czas życia to
`AUTH_ACCESS_TOKEN_EXPIRY` z domyślną wartością `1h` dla środowisk stage-like
(`server/src/config/authRuntime.ts:50-56`), ale **nie zakładaj tego w ciemno**:
część ścieżek podpisuje token wartością `JWT_EXPIRES_IN`, której domyślna wartość
w konfiguracji wynosi `365d` (`server/src/config/Config.ts:21`, `:102`). Operator ma
**odczytać rzeczywistą wartość obu zmiennych z Railway environment `demo`** i zapisać
ją w dowodzie.

Jedynym mechanizmem, który ucina już wydane tokeny dostępu, jest znacznik
`revoke-all`. Wniosek praktyczny: znacznika można użyć **jako uzupełnienia**, nigdy
jako całości — sam z siebie nie zamyka refresh tokenów, a same refresh tokeny nie
zamykają tokenów dostępu. Potrzebne są oba, a dowodem jest krok 6, nie kod odpowiedzi.

## Krok 4 — para nie może istnieć w konfiguracji

Potwierdź, że ujawniona para **nie występuje** jako wartość:

1. w zmiennych środowiskowych Railway, environment `demo` — przegląd pełnej listy
   zmiennych, nie tylko tych, których nazwa kojarzy się z hasłem;
2. w zmiennych environment `production` — sprawdzenie read-only, bez zmian;
3. w `railway.json` i `Dockerfile.api` (builder to `DOCKERFILE`, plik
   `Dockerfile.api` — `railway.json`). Powód nie jest teoretyczny: `OPS-DEMO-001`
   odnotował, że Dockerfile przekazuje `GEMINI_API_KEY` przez build `ARG`/`ENV`, więc
   ten plik już raz posłużył za nośnik sekretu;
4. w skryptach seed/bootstrap, które mogą **cofnąć rotację**. Konkretnie
   `server/scripts/dev-ensure-admin.ts` trzyma ujawnioną parę jako **wartości
   domyślne** (`:41`, `:44`) i ustawia to samo hasło dla 18 kont z
   `DEFAULT_DBR77_ADMINS` (`:182-183`). Skrypt nie jest wpięty w deploy (`railway.json`
   uruchamia obraz, nie ten skrypt), więc nie zadziała sam — ale **jedno ręczne
   uruchomienie przeciwko bazie `demo` po rotacji przywraca stan sprzed rotacji**.
   Do decyzji właściciela kodu: zmienić domyślne wartości na wymagane zmienne
   środowiskowe albo twardo odmówić uruchomienia poza `NODE_ENV=development`.

Zakres 1-3 to czynności operatora. Zakres 4 to zgłoszenie do strumienia kodu — tu
tylko odnotowane, bo bez tego rotacja jest odwracalna jednym poleceniem.

## Krok 5 — gdzie ma mieszkać nowe hasło

**Nowej wartości nie wolno zapisać:**

- w żadnym pliku repozytorium, łącznie z tym dokumentem, raportami odbioru, pakietami
  `PACKETS/*`, notatkami sesji i plikami `.env` w drzewie roboczym;
- w treści commita ani w opisie PR;
- w logach aplikacji, w wyjściu skryptu, w komentarzu do zadania, w kanale czatu ani
  w zrzucie ekranu dołączanym do dowodu;
- w argumencie polecenia powłoki, który wyląduje w historii `zsh`/`bash`.

**Nowa wartość ma mieszkać wyłącznie:**

- w menedżerze haseł zespołu — jako kanoniczne miejsce dla ludzi;
- w Railway secret store dla environment `demo`, jeśli jakikolwiek komponent
  faktycznie potrzebuje tego poświadczenia w runtime. Domyślna odpowiedź brzmi: nie
  potrzebuje, i wtedy nie trafia tam wcale.

Kanon `docs/ssot/DATA_SECURITY_OPERATIONS.md`, sekcja „Sekrety”, jest tu wiążący:
repozytorium może zawierać wyłącznie szablony bez prawdziwych wartości, a potencjalny
wyciek wymaga rotacji, a nie samego usunięcia pliku.

## Krok 6 — weryfikacja bez ujawniania nowej wartości

Każdy z pięciu testów jest sprawdzalny i **żaden nie wymaga podania nowego hasła
komukolwiek ani zapisania go gdziekolwiek**.

| # | Test | Oczekiwany wynik |
| --- | --- | --- |
| W1 | `POST /api/auth/login` **starą** parą (tą ujawnioną — wartość bierz z menedżera haseł lub `SEC-PUB-002`, nie przepisuj jej do dowodu) | `401` `Invalid email or password` (`server/src/controllers/AuthController.ts:172`, `:212`). Dowód zapisujemy jako sam kod odpowiedzi — **bez ciała żądania** |
| W2 | `SELECT count(*) FROM refresh_tokens WHERE user_id = <id konta> AND revoked_at IS NULL AND expires_at > now()` na bazie `demo` | **`0`**. Równoważnie `GET /api/auth/sessions` (`auth.routes.ts:262`) dla tego konta zwraca pustą listę |
| W3 | Token dostępu przechwycony **przed** rotacją (jeśli operator taki ma) użyty na `GET /api/auth/me` (`auth.routes.ts:300`) | `401`. Jeśli zwraca `200`, znacznik `revoke-all` nie został zapisany albo `iat` tokena jest późniejszy niż znacznik — wracamy do kroku 3 |
| W4 | Ponowne wykonanie kroku 1 dla **wszystkich** kont z listy (nie tylko tego jednego) | żadne konto z listy nie uwierzytelnia się starym hasłem |
| W5 | `GET /api/system/health` na `https://demo.consultify.ai` | odpowiedź **nieodróżnialna od trasy, której nigdy nie było** — aplikacja odpowiada `401` na nieznane `/api/*` (asercja zgodna z ustaleniem K2 z `SEC-PUB-001`). **Nie** „`404`” |

Do dowodu wchodzą: kody odpowiedzi, liczności z zapytań SQL, znaczniki czasu i
identyfikator operatora. **Nie wchodzą**: ciała żądań logowania, wartości haseł,
skróty hasła (`password_hash`) ani zrzuty ekranu menedżera haseł.

Bramka O-1 przechodzi w stan `WYKONANA` dopiero, gdy W1-W5 mają wynik zgodny
z tabelą. Jeden test bez wyniku = bramka niewykonana = **NO-GO dla ekspozycji**.

## Zakres — demo czy także PROD

`SEC-PUB-002` świadomie nie odpowiada na pytanie, czy konto o ujawnionym adresie
istnieje na produkcji (ustalenie „Czego ten pakiet nie twierdzi”, punkt 4). Ten runbook
też na nie nie odpowiada — wymaga zapytania do żywej bazy.

Decyzja operacyjna jest jednak jednoznaczna niezależnie od odpowiedzi: **jeśli konto
istnieje na PROD z tym samym hasłem, rotacja obejmuje PROD w tej samej partii.**
Ujawnienie było publiczne; nie da się go ograniczyć do środowiska, na którym trasę
znaleziono. Krok na PROD wymaga osobnej, jawnej paczki operacyjnej — kanon
`ENVIRONMENT_AND_NAMING_AUTHORITY.md` zabrania dotykania environment `production`
w tej fali bez decyzji Product Ownera.

## Czego ten runbook nie twierdzi

1. **Nie twierdzę, że doszło do nadużycia.** Twierdzę, że przy zerowym audycie tej
   trasy nie da się tego ani potwierdzić, ani wykluczyć — i że wobec tego jedynym
   bezpiecznym założeniem jest kompromitacja.
2. **Nie sprawdzałem stanu żadnego konta w żadnej bazie.** Cała analiza to lektura
   kodu i pakietów `SEC-PUB-002` / `SEC-AUTH-001`. Krok 1 istnieje właśnie po to, żeby
   ten stan ustalić zapytaniem, a nie założeniem.
3. **Nie rotowałem niczego i nie mam do tego mandatu.** Rotacja, dostęp do Railway
   i dostęp do bazy `demo` są czynnościami operatora, świadomie poza pasem agenta.
4. **Nie zmieniałem kodu.** Ten pakiet dotknął dwóch plików dokumentacji: tego oraz
   krótkiego bloku odsyłacza w `SEC-PUB-002`.
5. **Numery linii w `server/src/index.ts` i `server/src/routes/system-health.routes.ts`
   traktuj jako orientacyjne** — równoległe strumienie pracują na tych plikach.
   Kotwicą jest nazwa trasy i funkcji, nie linia.

---

## Bramki dokumentacyjne

Uruchomione na `bd134dc2e9`:

```
bash scripts/check-ssot-paths.sh
→ check-ssot-paths: OK — wszystkie ścieżki SSOT z CLAUDE.md istnieją.   (exit 0)

node scripts/docs/check-ssot-registry.mjs
→ check-ssot-registry: OK
  - centralna mapa istnieje
  - wszystkie zarejestrowane źródła istnieją
  - 16 pozycji dokumentacji odpowiada menu aplikacji
  - podsystemy techniczne są przypisane do pozycji menu
  - brak numerowanych kopii w rejestrze kanonicznym
  - komplet katalogu SSOT: 10/10
  - komplet centrum dowodzenia: 14/14                                   (exit 0)
```

## Rejestracja w indeksach wspólnych — wymagana, NIE wykonana

Nad `README.md` i `ACCEPTANCE_BOARD.md` pracują równoległe strumienie, więc nie zostały
dotknięte. Do dopisania przez właściciela indeksu:

1. `ACCEPTANCE_BOARD.md`, tabela „Odkrycia stagingowe wymagające naprawy”:

   ```
   | `OPS-SEC-001` | Runbook operatora przed publicznym wystawieniem demo | READY_FOR_DECISION | bramka blokująca O-1: rotacja poświadczenia ujawnionego przez byłe `GET /api/system/health`, unieważnienie rodzin refresh tokenów i weryfikacja W1-W5 przed ekspozycją |
   ```

2. `README.md` — odnośnik
   `[OPS-SEC-001](PACKETS/OPS-SEC-001_RUNBOOK_WYSTAWIENIA_PUBLICZNEGO.md)` obok
   odnośników do `OPS-DEMO-001` i `OPS-DEMO-002`.

## Stan

`READY_FOR_DECISION` — procedura kompletna, bramka O-1 **NIEWYKONANA**. Do czasu
zamknięcia O-1 werdyktem dla publicznej ekspozycji `demo.consultify.ai` jest **NO-GO**.
