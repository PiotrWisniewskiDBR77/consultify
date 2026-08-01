---
doc_id: SEC-AUTH-001
truth_type: operations
status: READY_FOR_DECISION
owner: codex
product_owner: piotr
priority: P1
depends_on: OPS-DEMO-002
last_reviewed: 2026-08-01
---

# SEC-AUTH-001 — `revoke-all` nie kończy sesji

## Werdykt

Stan: **FINDING — do triage'u, nie naprawiane w tym pakiecie.**

`POST /api/auth/revoke-all` obiecuje unieważnienie wszystkich tokenów użytkownika.
Nie robi tego. Zapisuje jeden wiersz-znacznik w `revoked_tokens`, który czyta wyłącznie
middleware weryfikujący **token dostępu**. Tabela `refresh_tokens` pozostaje nietknięta,
więc każdy, kto trzyma refresh token, wymienia go na **nowy** token dostępu z `iat`
późniejszym niż znacznik — a taki token przechodzi także kontrolę w middleware.
Sesja trwa dalej. Odpowiedź to `200 { message: 'All tokens revoked successfully' }`.

To jest **cicha awaria mechanizmu bezpieczeństwa**: administrator dostaje potwierdzenie
sukcesu operacji, która nie nastąpiła. Wzorzec identyczny z awarią kanału mailowego
z 2026-07-31 (`send()` zwracało `true` po odrzuceniu przez serwer).

Ten dokument opisuje defekt, wymagania docelowe i testy. Nie zleca implementacji —
kolejność i termin ustala właściciel.

## Ustalenia zweryfikowane

Weryfikacja na `fix/ops-demo-002-public-entry`, HEAD `161c8cc0a8`, worktree czysty.
Każde ustalenie sprawdzalne pod wskazanym `plik:linia` w mniej niż minutę.

| # | Ustalenie | Dowód |
| --- | --- | --- |
| U1 | Trasa odrzuca każdego, kto nie jest `ADMIN`/`SUPERADMIN` — zwykły użytkownik nie unieważni własnych sesji | `server/src/routes/auth.routes.ts:2030-2033` |
| U2 | Handler zapisuje **jeden wiersz-znacznik** do `revoked_tokens` (`reason = 'revoke-all'`, ważność 7 dni) i nie dotyka `refresh_tokens` | `server/src/routes/auth.routes.ts:2038-2056` |
| U3 | Znacznika używa **wyłącznie** `auth.middleware.ts` — zapytanie `buildRevokeAllLookupSql` i porównanie `iat` z `parseRevokeAllTimestamp` | `server/src/middleware/auth.middleware.ts:258-259`, `269-276`, `1021-1064` |
| U4 | `RefreshTokenService` **nigdy** nie czyta `revoked_tokens` — `grep -c revoked_tokens server/src/services/RefreshTokenService.ts` → `0`; rotacja przebiega normalnie i wydaje nowy token dostępu | `server/src/services/RefreshTokenService.ts:283-296`, `431-480` |

### U1 — trasa nie jest self-service

```
if (req.user!.role !== 'ADMIN' && req.user!.role !== 'SUPERADMIN') {
  return res.status(403).json({ error: 'Not authorized' });   // auth.routes.ts:2030-2031
}
```

`targetUserId = userId || req.user!.id` (`auth.routes.ts:2035-2036`) — czyli **administrator**
może wywołać ją na sobie. Zwykły `CONSULTANT`/`MEMBER` nie ma żadnej ścieżki
„wyloguj mnie ze wszystkich urządzeń". Istnieje tylko `DELETE /api/auth/sessions/:id`
dla pojedynczej sesji (`auth.routes.ts:276-291`).

### U2 — zapis to wyłącznie znacznik

```
const marker = `revoke-all-${userIdToRevoke}-${Date.now()}`;                 // :2039
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)...          // :2040
INSERT INTO revoked_tokens (jti, user_id, expires_at, reason) ...            // :2043-2046
return res.json({ message: 'All tokens revoked successfully' });             // :2051
```

Żadnego `UPDATE refresh_tokens`. Dla porównania — poprawne ścieżki w tym samym pliku
wywołują `refreshTokenService.revokeAllUserTokens(...)`:
zmiana hasła `auth.routes.ts:2130`, reset hasła `auth.routes.ts:2271`.
Implementacja: `RefreshTokenService.ts:500-502` → `558-564`
(`UPDATE refresh_tokens SET revoked_at = ... WHERE user_id = ? AND revoked_at IS NULL`).
Mechanizm, który jest potrzebny, **istnieje i działa** — `revoke-all` po prostu go nie woła.

### U3 — znacznik czyta tylko middleware tokena dostępu

```
"SELECT jti FROM revoked_tokens WHERE user_id = ? AND reason = 'revoke-all'
   AND expires_at > CURRENT_TIMESTAMP"                                      // middleware:258-259
...
if (tokenIssuedAt < revokeTime) { 401 'All sessions have been revoked.' }    // middleware:1057-1060
```

`checkTokenRevocation` (`middleware:969`) jest wołany z `verifyToken`. Trasa
`POST /api/auth/refresh` **nie ma** `verifyToken` — `auth.routes.ts:202-204` to
`router.post('/refresh', validateBody(RefreshTokenRequestSchema), asyncHandler(...))`.
Refresh z definicji nie przechodzi przez jedyny kod, który zna znacznik.

### U4 — pętla obejścia

1. admin wywołuje `revoke-all` na użytkowniku U → wiersz-znacznik, `200 OK`;
2. wiersz U w `refresh_tokens` ma dalej `revoked_at IS NULL` i `expires_at` w przyszłości;
3. U wywołuje `POST /api/auth/refresh`; `SELECT ... WHERE token_hash = ? AND rt.revoked_at IS NULL
   AND rt.expires_at > datetime('now')` (`RefreshTokenService.ts:293-295`) trafia;
4. serwis rotuje token i podpisuje **nowy** access token
   (`RefreshTokenService.ts:431-434`, `448-458`);
5. nowy `iat` jest **późniejszy** niż `revokeTime`, więc warunek `tokenIssuedAt < revokeTime`
   (`middleware:1057`) jest fałszywy — token przechodzi;
6. rotacja przedłuża rodzinę tokenów o kolejne 7/30 dni (`RefreshTokenService.ts:441-443`).

Efekt netto: `revoke-all` nie kończy sesji. Posiadacz refresh tokena zachowuje dostęp
bezterminowo, bo każda rotacja odnawia okno ważności.

## Korekty do zgłoszenia wejściowego

Zgłoszenie było w czterech punktach trafne. Trzy niuanse wymagają doprecyzowania —
inaczej dokument opisywałby defekt węziej albo szerzej niż jest.

1. **„Nie jest self-service" — z zastrzeżeniem.** Dla `ADMIN`/`SUPERADMIN` trasa *jest*
   self-service (`targetUserId = userId || req.user!.id`, `:2036`). Brak self-service
   dotyczy wszystkich pozostałych ról. Formułowanie „nikt nie może unieważnić własnych
   sesji" byłoby zawyżeniem.
2. **Okno 60 s nie „poszerza" luki z U4 — dotyczy innej ścieżki.** Cache
   (`middleware:936-962`) opóźnia wyłącznie skutek znacznika dla **istniejących** tokenów
   dostępu. Obejście przez refresh nie potrzebuje żadnego okna; działa zawsze i bezterminowo.
   Cache to osobny, mniejszy problem (§ Zachowanie cache).
3. **Znacznik ma krótszy czas życia niż refresh token.** Znacznik: 7 dni (`:2040`),
   sprzątany przez cron (`server/src/cron/CleanupRevokedTokens.ts:41-48`).
   Refresh token: 7 dni na stagingu, **30 dni** poza nim
   (`server/src/config/authRuntime.ts:58-61`). Nawet gdyby refresh sprawdzał znacznik,
   po 7 dniach znacznik znika, a refresh token żyje dalej. Sam znacznik nie może być
   podstawą unieważnienia.

## Ustalenia dodatkowe (znalezione przy weryfikacji)

### D1 — przycisk „Wyloguj wszystkie sesje" w UI trafia w trasę, która nie istnieje

`Api.revokeAllSessions()` woła `POST ${API_URL}/auth/sessions/revoke-all`
(`src/services/api.ts:1513-1519`). W `server/src/routes/auth.routes.ts` **nie ma** takiej
trasy — pod `/sessions` są tylko `GET /sessions` (`:256`) i `DELETE /sessions/:id` (`:277`).
Jedyne `sessions/revoke-all` w backendzie to `POST /api/superadmin/admin/sessions/revoke-all`
(`server/src/routes/superadmin.routes.ts:3115-3141`), które operuje na tabeli
`admin_sessions`, a nie na `refresh_tokens`.

Wywołań `Api.revokeAllSessions()` jest pięć, wszystkie w ustawieniach bezpieczeństwa:
`SessionsActivitySettings.tsx:211`, `PasswordSecuritySettings.tsx:268`,
`SecuritySettings.tsx:148`, `ActiveSessionsSettings.tsx:66`,
`security/AuthenticationAccessPage.tsx:257`.

Wniosek: użytkownik dostaje `404` (widoczny jako toast błędu), a nie fałszywy sukces.
To jest **osobny** defekt od SEC-AUTH-001 i pod pewnym względem łagodniejszy —
nie kłamie. Ale oznacza, że w produkcie **nie ma** działającego „wyloguj wszędzie"
dla nikogo: zwykły użytkownik dostaje 404, administrator dostaje 200 bez skutku.

### D2 — `revoke-all` jest nadal na allowliście zapisów demo

Wbrew opisowi w zleceniu, na HEAD `161c8cc0a8` wpis **jest obecny**:

- `server/src/services/demo/demoPrincipalGuard.ts:267` —
  `{ method: 'POST', path: '/api/auth/revoke-all', why: 'end every session (logout-all)' }`;
- `server/src/services/demo/demoPrincipalGuard.ts:316` — również w
  `EXPIRED_DEMO_ALLOWED_PATHS`;
- komentarz `demoPrincipalGuard.ts:255-257` twierdzi, że trasa „revokes the caller's own
  token families only" — to jest **nieprawda** w dwóch warstwach naraz (nie rusza rodzin
  tokenów; nie jest self-service dla roli `CONSULTANT`, którą dostaje publiczne konto demo);
- `docs/.../PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md:180` powtarza to samo twierdzenie
  w tabeli allowlisty;
- testy nadal zakładają obecność wpisu:
  `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts:71`, `652`, `697`, `973`, `1018`.

Usunięcie tego wpisu jest w toku w **równoległym** strumieniu pracy nad OPS-DEMO-002
i nie było widoczne w drzewie w chwili tej weryfikacji. Patrz § Relacja do OPS-DEMO-002.

### D3 — trzy mniejsze defekty tej samej trasy

| Kod | Defekt | Dowód |
| --- | --- | --- |
| D3a | Wyszukanie znacznika nie ma `ORDER BY`. Przy kilku znacznikach dla jednego użytkownika `dbGet` zwraca dowolny wiersz — może **starszy**, co osłabia kontrolę `iat` | `middleware:258-259`, `1032` |
| D3b | Błąd bazy przy sprawdzaniu unieważnień jest **fail-open**: `catch (dbErr) { ...; await attachUser(...) }` — żądanie przechodzi uwierzytelnione | `middleware:1067-1070` |
| D3c | `INSERT` bez `OR IGNORE` przy `jti PRIMARY KEY` — dwa wywołania w tej samej milisekundzie dla tego samego użytkownika kończą się `500`. Pozostałe wstawki do tej tabeli używają `INSERT OR IGNORE` | `auth.routes.ts:2043-2046` vs `907`, `971`; schemat `server/src/database/PostgresDatabase.ts:2258-2265` |

## Ocena wagi

Przyznana waga: **P1** (nie P0).

### Kto jest realnie narażony dziś

- **Nikt anonimowo.** Trasa wymaga ważnego tokena i roli `ADMIN`/`SUPERADMIN`
  (`:2030-2033`). Nie ma tu podniesienia uprawnień ani wektora zdalnego.
- **Administrator, który sądzi, że zakończył sesje.** To jest właściwa ofiara defektu.
  Wymóg `ADMIN` **tnie w obie strony**: wywołujących jest niewielu, ale każdy z nich
  wykonuje operację bezpieczeństwa, dostaje `200 All tokens revoked successfully`
  i odchodzi w przekonaniu, że sesje zamknięte. Nie są.
- **Pracownik odchodzący / zagubione urządzenie.** Jeżeli reakcją na odejście lub
  kradzież laptopa jest wywołanie `revoke-all`, dostęp trwa dalej: do 7 dni (staging)
  lub 30 dni (poza stagingiem) od ostatniej rotacji, a każda rotacja przedłuża okno.
  Praktycznie: bezterminowo, dopóki klient odświeża token.
- **Atakujący z wykradzionym refresh tokenem.** Jeżeli kradzież wykryto i odpowiedzią
  było `revoke-all`, reakcja jest nieskuteczna, a incydent uznany za zamknięty.

### Czego defekt NIE oznacza

- Nie jest to obejście uwierzytelnienia — token nadal musi być ważny i podpisany.
- Nie jest to wyciek danych między organizacjami; kontrola `organization_id`
  (`:2058-2070`) działa poprawnie na tym, co robi (zapis znacznika).
- **Istnieją działające ścieżki awaryjne.** Zmiana hasła (`:2130`) i reset hasła
  (`:2271`) wołają `revokeAllUserTokens` i **faktycznie** unieważniają rodziny tokenów.
  Dezaktywacja konta również: refresh sprawdza `user_status !== 'active'` i wtedy
  unieważnia wszystko (`RefreshTokenService.ts:425-428`). Offboarding wykonany przez
  reset hasła lub dezaktywację konta **jest skuteczny**.

### Uzasadnienie P1

P0 w tym programie oznacza bloker odbioru aplikacji lub demo. SEC-AUTH-001 nie blokuje
demo (§ Relacja do OPS-DEMO-002) i ma sprawne obejście operacyjne (reset hasła /
dezaktywacja). Jednocześnie jest to kontrola bezpieczeństwa, która **cicho kłamie**
o swoim skutku, a produkt nie ma dziś **żadnej** działającej funkcji „wyloguj wszędzie"
(D1). To za dużo na P2. Stąd P1 — do zaplanowania jako osobny, testowany pakiet,
nie do dorzucenia po drodze do innej pracy.

## Wymagane zachowanie docelowe

Każde wymaganie jest osobno testowalne i osobno odbierane.

### R1 — self-service dla własnego konta

Uwierzytelniony użytkownik **dowolnej** roli musi móc unieważnić wszystkie własne sesje.
Dziś nie istnieje: backend odrzuca `403` (`:2030`), a jedyne wywołanie z UI trafia w `404`
(D1). Kontrakt: jedna trasa, żądanie bez `userId` (albo `userId === req.user.id`)
działa dla każdej roli. Trasa musi odpowiadać ścieżce, którą już woła klient
(`/api/auth/sessions/revoke-all`, `src/services/api.ts:1514`) albo klient musi zostać
przestawiony — rozstrzygnięcie należy do implementacji, ale rozjazd nie może zostać.

### R2 — unieważnienie administracyjne cudzego konta z regułą org-scope

Zachować dokładnie regułę, która już jest w handlerze (`:2058-2070`):

- `SUPERADMIN` — dowolny użytkownik, bez ograniczenia organizacji;
- `ADMIN` — wyłącznie użytkownik z **własnej** organizacji; poza nią `403`;
- nieistniejący `userId` → `404`;
- rola niższa niż `ADMIN` z `userId` wskazującym na **kogoś innego** → `403`
  (dziś cały handler jest `403` dla takiej roli, więc reguła jest spełniona przypadkiem —
  po wprowadzeniu R1 musi zostać wyrażona jawnie, bo inaczej R1 ją otworzy).

### R3 — unieważnienie WSZYSTKICH aktywnych refresh tokenów / rodzin

Operacja musi ustawić `revoked_at` na wszystkich niewycofanych wierszach
`refresh_tokens` użytkownika — czyli zrobić to, co robi już
`RefreshTokenService._revokeAllUserTokens` (`:558-564`), z odrębnym `revoked_reason`
(np. `revoke_all`) odróżniającym ją od `logout`, `rotation`, `security`, `user_inactive`.

Znacznik w `revoked_tokens` może zostać jako **dodatkowa** warstwa dla tokenów dostępu,
ale nie może być jedynym skutkiem operacji. Warunek odbioru: po operacji
`SELECT count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL` = `0`.

### R4 — rotacja refresh musi odmówić po unieważnieniu, łącznie z gałęzią grace period

Dwie ścieżki, obie muszą odmówić:

1. **Ścieżka normalna** — `refreshAccessToken` (`RefreshTokenService.ts:275`).
   Po R3 wystarcza istniejący warunek `rt.revoked_at IS NULL` (`:294`), ale to musi być
   potwierdzone testem, nie założone.
2. **Gałąź grace period** — `RefreshTokenService.ts:307-393`. To jest ścieżka, którą łatwo
   przeoczyć: przy `revoked_reason === 'rotation'` i wieku wycofania poniżej
   `GRACE_PERIOD_SECONDS = 10` (`:128`) szuka **najnowszego żywego tokena w tej samej
   rodzinie** (`:323-338`) i **podpisuje nowy token dostępu przed** normalnymi kontrolami
   (`:370-381`). Ma już własną bramkę dla demo, dodaną świadomie z tego samego powodu —
   komentarz `RefreshTokenService.ts:356-358`: „the grace-period branch mints an access
   token before any of the normal validity checks below, so it needs its own gate".
   Bramka unieważnienia musi zostać dołożona **w tym samym miejscu**.

   Uwaga: po R3 zapytanie `:323-338` filtruje `rt.revoked_at IS NULL` (`:334`), więc nie znajdzie
   żywego tokena i gałąź nie wystrzeli. To jest jednak skutek uboczny, nie kontrakt —
   wymagany jest jawny test (T2), bo zmiana filtra rodziny cicho otworzyłaby lukę z powrotem.

### R5 — zachowanie cache i maksymalne okno

Dwa cache w `auth.middleware.ts:936-962`, oba `REVOKE_CACHE_TTL_MS = 60_000`:

- `_revokeCache` — czy konkretny `jti` jest wycofany; zapisuje także wynik **negatywny**;
- `_revokeAllCache` — znacznik `revoke-all` per użytkownik; zapisuje `{ jti: null }`,
  czyli również wynik negatywny.

Skutek: jeżeli token użytkownika był sprawdzany tuż przed unieważnieniem, negatywny
wpis żyje do 60 s i **istniejący** token dostępu działa w tym oknie.

Wymaganie: pakiet musi **jawnie zadeklarować** maksymalne okno między unieważnieniem
a skutkiem i udokumentować je w kodzie, zamiast zostawiać komentarz
„the window is acceptably short" (`middleware:934-935`). Rekomendacja:

- **refresh:** okno **zero**. `RefreshTokenService` czyta bazę bezpośrednio i nie ma
  cache — po R3 pierwszy refresh po unieważnieniu musi odmówić natychmiast.
- **istniejący token dostępu:** okno = **TTL cache** (dziś 60 s), a nie TTL tokena
  (1 h na stagingu / 8 h poza nim — `authRuntime.ts:49-56`). Warunek: znacznik musi
  faktycznie działać, czyli D3a i D3b muszą zostać naprawione razem z R3, inaczej
  deklarowane okno jest fikcją.
- **wiele instancji serwera:** cache jest **w pamięci procesu**. Przy więcej niż jednej
  instancji okno to 60 s **na instancję**, nie globalnie. Jeżeli demo/prod ma kiedykolwiek
  działać w więcej niż jednej replice, wymagane jest albo unieważnienie cache
  cross-instance, albo obniżenie TTL, albo jawne przyjęcie ryzyka w dokumencie.
  Deklaracja „maksymalne okno = 60 s" bez tego zastrzeżenia byłaby nieprawdziwa.

## Testy bezpieczeństwa i regresji

Minimalny zestaw do przekazania implementatorowi. Każdy test ma **oblać** na dzisiejszym
kodzie — jeżeli przechodzi przed naprawą, jest źle napisany.

| Kod | Test | Oczekiwanie |
| --- | --- | --- |
| T1 | `revoke-all` → `POST /api/auth/refresh` starym refresh tokenem | odmowa (`401`), brak nowego access tokena |
| T2 | `revoke-all` → refresh tokenem wycofanym `rotation` **mniej niż 10 s** wcześniej (gałąź grace, `RefreshTokenService.ts:307-393`) | odmowa; **żaden** token dostępu nie zostaje podpisany |
| T3 | `revoke-all` → wywołanie chronionej trasy **istniejącym** tokenem dostępu, po upływie zadeklarowanego okna z R5 | `401 'All sessions have been revoked'` |
| T4 | jak T3, ale z wyczyszczonym cache (`__private__.resetRevocationCachesForTests`, `middleware:1679-1684`) | `401` natychmiast — dowód, że opóźnienie bierze się z cache, nie z braku kontroli |
| T5 | użytkownik roli `CONSULTANT`/`MEMBER` wywołuje unieważnienie z `userId` **innego** użytkownika | `403`; sesje celu **nienaruszone** (asercja na `refresh_tokens`, nie tylko na kodzie odpowiedzi) |
| T6 | `ADMIN` z org A wywołuje unieważnienie dla użytkownika z org B | `403`; `refresh_tokens` celu nienaruszone |
| T7 | `SUPERADMIN` wywołuje dla użytkownika z dowolnej organizacji | `200`; `count(*) FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL` = `0` |
| T8 | self-service (R1): użytkownik dowolnej roli unieważnia **własne** sesje | `200`; własne rodziny wycofane; sesje **innych** użytkowników nienaruszone |
| T9 | `revoke-all` → `POST /api/auth/login` poprawnym hasłem | `200` — unieważnienie kończy sesje, nie blokuje konta (regresja: nie zamienić wylogowania w lockout) |
| T10 | dwa wywołania `revoke-all` dla tego samego użytkownika pod rząd (D3c) | oba `200`, brak `500` z naruszenia klucza głównego |
| T11 | błąd bazy w trakcie sprawdzania unieważnienia (D3b) | żądanie **odrzucone**, nie przepuszczone — kontrola fail-closed |

Uwaga wykonawcza: asercje T5–T8 muszą sprawdzać **stan `refresh_tokens`**, nie tylko kod
HTTP. Cały ten defekt polega na tym, że kod odpowiedzi `200` nie miał pokrycia w danych.

Nowe pliki testów w `tests/` wymagają `git add -f` (reguła repo).

## Migracja i kompatybilność

### Kto zależy od dzisiejszej odpowiedzi `200`

- **Frontend: nikt.** Żaden plik w `src/` nie woła `/api/auth/revoke-all`. Jedyne wołanie
  o tej nazwie (`Api.revokeAllSessions`, `src/services/api.ts:1513-1519`) idzie pod
  `/auth/sessions/revoke-all` — trasę, która nie istnieje (D1). Zaostrzenie kontraktu
  `/api/auth/revoke-all` **nie zepsuje** żadnego ekranu.
- **Testy:** `tests/unit/backend/demo/publicDemoWriteAllowlist.test.ts:71`, `652`, `697`,
  `973`, `1018` odwołują się do ścieżki jako do wpisu allowlisty demo. Zmienią się razem
  z D2, niezależnie od tego pakietu.
- **`AdminSessionsView.tsx:286`** woła `Api.revokeAllAdminSessions` →
  `/api/superadmin/admin/sessions/revoke-all` (`superadmin.routes.ts:3116`), operujące na
  `admin_sessions`. To **inna** trasa i **inny** magazyn — poza zakresem SEC-AUTH-001.
- **Klienci zewnętrzni / skrypty:** nie stwierdzono. Jeżeli istnieją poza repo, po naprawie
  otrzymają `200` z faktycznym skutkiem — zmiana zachowania, nie kontraktu odpowiedzi.

### Czy wiersze `revoked_tokens` wymagają czyszczenia

Nie wymagają migracji i nie należy ich hurtowo kasować.

- Istniejące znaczniki `reason = 'revoke-all'` mają `expires_at` maks. 7 dni od zapisu
  i są usuwane przez cron (`server/src/cron/CleanupRevokedTokens.ts:41-48`,
  `DELETE FROM revoked_tokens WHERE expires_at < datetime('now')`). Wygasną same.
- Tabela trzyma także wpisy `logout` (`auth.routes.ts:907`, `971`) i SSO
  (`server/src/routes/integrations/sso.routes.ts:521`) — **czyszczenie po `jti` bez filtra
  `reason` skasowałoby działające wylogowania.** Jeżeli sprzątanie miałoby nastąpić, to
  wyłącznie `WHERE reason = 'revoke-all'`.
- Uwaga do R3: po naprawie stare znaczniki zaczną działać „mocniej" niż dotąd tylko o tyle,
  o ile naprawione zostaną D3a/D3b. Nie stanowi to ryzyka wylogowania kohorty użytkowników,
  bo kontrola `iat` odrzuca wyłącznie tokeny **starsze** od znacznika, a te i tak wygasły
  (1 h / 8 h).
- Schemat `revoked_tokens` nie zmienia się (`server/src/database/PostgresDatabase.ts:2258-2265`).
  Zmiana `revoked_reason` w `refresh_tokens` to wartość tekstowa, nie zmiana schematu.
  **Pakiet nie wymaga migracji bazy.**

## Relacja do OPS-DEMO-002

**Nic w ścieżce demo nie zależy od naprawy tego defektu.**

OPS-DEMO-002 usuwa `POST /api/auth/revoke-all` z allowlisty zapisów publicznego demo
dokładnie dlatego, że deklarowana przez tę trasę zdolność nie istnieje. Publiczne konto
demo dostaje rolę `CONSULTANT`
(`docs/.../PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md`, § „Kanoniczna ścieżka publiczna"),
więc i tak otrzymałoby `403` z `auth.routes.ts:2030`. Sesję demo kończy
`POST /api/auth/logout`, który zostaje na allowliście.

Po usunięciu wpisu SEC-AUTH-001 przestaje mieć jakikolwiek kontakt z powierzchnią demo
i pozostaje wyłącznie defektem panelu administracyjnego.

**Stan faktyczny w chwili weryfikacji (uczciwie):** na HEAD `161c8cc0a8` wpis **nadal jest**
w `demoPrincipalGuard.ts:267` i `:316`, a `OPS-DEMO-002_DEMO_ENTRY_AUTH.md:180` nadal opisuje
trasę jako unieważniającą własne rodziny tokenów (D2). Usunięcie jest w toku w równoległym
strumieniu pracy. Zdanie „nic w demo nie zależy od tej naprawy" jest prawdziwe **po**
wejściu tej zmiany; przed nią jest prawdziwe tylko dzięki bramce roli `CONSULTANT` →
`403`, czyli z przypadku, nie z projektu. Przy odbiorze OPS-DEMO-002 należy sprawdzić
`demoPrincipalGuard.ts` wzrokiem, nie na podstawie tego akapitu.

## Czego ten pakiet NIE robi

- nie zmienia żadnego pliku w `server/`, `src/` ani `tests/`;
- nie usuwa wpisu z allowlisty demo — to należy do OPS-DEMO-002;
- nie rozstrzyga, czy kanoniczną trasą self-service ma być
  `/api/auth/sessions/revoke-all` czy `/api/auth/revoke-all` — to decyzja implementacyjna;
- nie wpisuje się do `ACCEPTANCE_BOARD.md` (plik współdzielony z innymi strumieniami;
  wymagana rejestracja opisana niżej).

## Bramki dokumentacyjne

Uruchomione z korzenia worktree `/private/tmp/ops-demo-002` po utworzeniu dokumentu:

| Bramka | Wynik |
| --- | --- |
| `bash scripts/check-ssot-paths.sh` | `OK` |
| `node scripts/docs/check-ssot-registry.mjs` | `OK` |

Żadna z bramek nie wymaga rejestrowania pojedynczych pakietów z
`docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/`:

- `check-ssot-paths.sh` sprawdza wyłącznie ścieżki w backtickach wewnątrz `CLAUDE.md`;
- `check-ssot-registry.mjs` waliduje `docs/ssot/registry.json` (authorities, 16 pozycji
  menu, podsystemy) oraz stałą listę plików sterujących weekendu — katalog `PACKETS/`
  nie jest przez nią enumerowany.

**Rejestracja wymagana konwencją (nie bramką), do wykonania przez nadzorcę:**
wiersz `SEC-AUTH-001` w `docs/program/WEEKEND_COMPLETION_2026-08-01/ACCEPTANCE_BOARD.md`
(tabela P0 ok. linii `:39-40` oraz tabela bramek ok. linii `:58`), analogicznie do
`OPS-DEMO-001` i `OPS-DEMO-002`. Plik nie został zmieniony przez ten pakiet, bo jest
współdzielony z równoległymi strumieniami pracy w tym samym worktree.
