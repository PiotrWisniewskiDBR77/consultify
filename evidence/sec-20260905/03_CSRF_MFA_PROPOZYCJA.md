# KROK 3 — CSRF i MFA: pomiar + propozycja (BEZ zmian w kodzie)

Zgodnie z instrukcją: wyłącznie pomiar i plan włączenia — montaż CSRF może
wywrócić frontend, blokada MFA już raz zablokowała właściciela (patrz
`granica-ochrony-danych`/`zamkniete-kolo-drugiego-skladnika` w pamięci
sesji). Zero zmian w `server/src`, `src/` w tym kroku.

## A. CSRF — stan dziś

Middleware istnieje i jest kompletny: `server/src/middleware/csrf.middleware.ts`
(double-submit cookie, 336 linii): `csrfTokenMiddleware` (generuje/odświeża
ciasteczko `csrf_token`), `csrfValidationMiddleware` (waliduje nagłówek
`x-csrf-token` przeciw ciasteczku, stała funkcja porównania `safeEqual`,
odrzuca metody niebezpieczne bez zgodnego tokenu kodem 403 `CSRF_MISSING`/
`CSRF_INVALID`), `getCsrfTokenHandler` (endpoint `GET /api/csrf-token`).

**Gdzie jest zamontowany:**
- `getCsrfTokenHandler` → `GET /api/csrf-token` — zawsze zamontowany
  (`server/src/index.ts:1246`).
- `csrfTokenMiddleware` (TYLKO generowanie ciasteczka, bez walidacji) →
  `app.use('/api/', csrfTokenMiddleware)` — **tylko gdy `isProduction`**
  (`server/src/index.ts:1250-1252`). Na demo/staging/dev ciasteczko
  `csrf_token` w ogóle nie jest ustawiane przez ten middleware.

**Gdzie NIE jest zamontowany:**
- `csrfValidationMiddleware` — `grep -rn "csrfValidationMiddleware"
  server/src` daje TYLKO: definicję eksportu i jeden komentarz
  ("Enable per-route using csrfValidationMiddleware for sensitive
  operations"). **Żadna trasa w całym Gateway/index.ts jej nie używa.**
  Innymi słowy: nawet w produkcji walidacja CSRF jest w 100% nieaktywna —
  istnieje wyłącznie generowanie tokenu, nikt nigdy go nie sprawdza.

**Strona frontendu:** `grep -rln "x-csrf-token\|csrf" src/services` → pusto.
Żadne wywołanie API z `src/` nie wysyła nagłówka `x-csrf-token` ani nie
czyta `/api/csrf-token`. **Włączenie `csrfValidationMiddleware` na
którejkolwiek trasie zapisu dziś zablokowałoby KAŻDE żądanie POST/PUT/PATCH/
DELETE z tej trasy dla całej aplikacji** (frontend nie ma tokenu do wysłania).

### Plan włączenia bez przerwy w pracy

1. **Faza 0 — tylko odczyt (już gotowe)**: `GET /api/csrf-token` działa,
   `csrfTokenMiddleware` na produkcji już ustawia ciasteczko. Zero ryzyka.
2. **Faza 1 — frontend zaczyna wysyłać token, serwer jeszcze nie waliduje
   (tryb raportujący)**: dodać do `src/services/api.ts` (lub odpowiednika
   centralnego klienta HTTP) pobranie `csrf_token` z ciasteczka i doklejenie
   nagłówka `x-csrf-token` do każdego żądania zapisu. Równolegle podłączyć
   `csrfValidationMiddleware` w trybie **"log-only"** — potrzebna DROBNA
   zmiana middleware (dodanie flagi np. `CSRF_REPORT_ONLY=true`, która loguje
   `CSRF_MISSING`/`CSRF_INVALID` zamiast zwracać 403). Bez tej flagi Faza 1
   nie jest bezpieczna do wdrożenia na żywym ruchu.
3. **Faza 2 — pomiar**: kilka dni logów w trybie raportującym; potwierdzić
   zero (albo bliskie zeru) rozbieżności dla realnego ruchu (SPA + mobile +
   ewentualne integracje serwer-serwer, które trzeba dodać do listy
   `isExemptPath` — dziś tam są tylko `/api/auth/callback/*` i webhooki
   Stripe).
4. **Faza 3 — enforce**: przełączyć `csrfValidationMiddleware` na tryb
   blokujący, zamontować na `/api/` (analogicznie do `csrfTokenMiddleware`),
   NIE tylko na produkcji — inaczej demo/staging nigdy nie wykryją regresji
   przed produkcją.

Bez Fazy 1-2 (frontend nie wysyła tokenu) montaż walidacji w trybie
blokującym już dziś przerwałby cały zapis w aplikacji — stąd rekomendacja
"tryb raportujący najpierw" wprost z instrukcji.

## B. MFA — stan dziś

`server/src/services/mfaGracePolicy.ts` (czysta funkcja `evaluateMfaGrace`,
100 linii) implementuje okres karencji: kotwica = późniejsza z dat
(`organizations.mfa_required_since`, `users.created_at`), długość =
`organizations.mfa_grace_period_days` (domyślnie 7 dni, `0` = brak
karencji). **Wywoływana realnie** z `server/src/services/MFAService.ts:76`
(nie jest martwym kodem — potwierdzone `grep`).

Komentarz w nagłówku pliku (`mfaGracePolicy.ts:5-16`) dokumentuje, że PRZED
2026-09-02 był to zamknięty krąg: `mfa_required` blokowało KAŻDE logowanie
członka bez włączonego drugiego składnika, a jedyna droga do włączenia
drugiego składnika prowadziła przez logowanie — to jest dokładnie incydent
opisany w pamięci sesji (`zamkniete-kolo-drugiego-skladnika`, właściciel
zablokowany). **Ten konkretny błąd jest już naprawiony** — karencja liczona
i egzekwowana z realną arytmetyką dat, nie stałą liczbą.

Panel administracyjny: `server/src/routes/adminP32.routes.ts:508-526`
(odczyt), `:700-715` (zapis `mfa_required`+`mfa_required_since`),
`server/src/routes/security.routes.ts:59-98` (odczyt/ustawienie
`require2fa` per organizacja).

### Co NIE zostało dziś zweryfikowane (poza zakresem KROK 3 — tylko pomiar)

- Czy jakakolwiek organizacja na demo/staging ma dziś `mfa_required=true`
  (nie odpytywano żywej bazy demo/staging — zakaz z instrukcji: "zero
  Railway, zero demo/stagingu/produkcji nawet do odczytu" dotyczy też mnie
  poza kontekstem testu na izolowanej kopii).
- Ścieżka enrollmentu pierwszego czynnika dla członka, który WCHODZI w
  organizację z już włączonym `mfa_required` i zerową karencją (`grace
  Period Days=0`) — kod na to pozwala (`Math.max(0, ...)` akceptuje 0), ale
  nie prześledzono dziś UX tej ścieżki.

### Rekomendacja

Mechanizm karencji jest już bezpieczny do włączenia (nie jest zamkniętym
kołem). Przed włączeniem `mfa_required=true` dla dowolnej realnej
organizacji zalecane: (a) zmierzyć wprost na żywej bazie demo/staging,
ile kont nie ma dziś żadnego zarejestrowanego czynnika MFA — to determinuje
czy 7-dniowa karencja domyślna wystarczy, czy trzeba ją podnieść na czas
wdrożenia; (b) dodać monitoring/alert na `daysRemaining` bliskie zeru, żeby
nikt nie utknął dokładnie tak, jak w incydencie z pamięci.
