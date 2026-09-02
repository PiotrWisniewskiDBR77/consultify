# Odzyskiwanie i zmiana hasła — pomiar i naprawa (2026-09-02)

Zlecenie właściciela: „sprawdź, czy na pewno jest cały system przypominania i wznawiania
hasła odpalony… napraw system”. Powód: brak możliwości zalogowania na
`https://staging.consultify.ai`.

Gałąź: `fix/odzyskiwanie-hasla-20260902` (baza `github-backup/kandydat/staging-20260902b`,
tip bazy `c7915a6a6d`). Staging w chwili pomiaru: `gitSha=56913a0b3b` (5 commitów za bazą;
kod ścieżki resetu w obu SHA identyczny — sprawdzone przez `git show`).

---

## 1. Tabela pięciu ogniw

| # | Ogniwo | Plik:linia | Zamontowane | Działa (przed naprawą) | Dowód |
|---|--------|-----------|-------------|------------------------|-------|
| 1 | Przycisk „Zapomniałeś hasła?” + strona `/forgot-password` | `src/views/AuthView.tsx:1125` → `src/routes/AppRoutes.tsx:1476` → `src/views/auth/ForgotPasswordView.tsx` | TAK (trasa React w `AppRoutes.tsx`, `routeConfig.ts:27`) | TAK, ale **po angielsku** także w PL | konflikt kluczy i18n, p. §2.4 |
| 2 | `POST /api/auth/forgot-password` | `server/src/routes/auth.routes.ts:2515` | TAK — `Gateway.ts:563` `app.use('/api/auth', authRoutes)` | TAK (200) | `curl` na staging → `200 {"success":true,…}` |
| 3 | Wygenerowanie i ZAPIS tokenu | `auth.routes.ts:2539-2546`; tabela `password_resets` w `server/migrations/727_beta_missing_tables.sql:593`, indeksy `:665-666`; TTL `server/src/config/authRuntime.ts:64` (`AUTH_PASSWORD_RESET_TTL_MINUTES`, domyślnie 60 min); unieważnianie: `DELETE … WHERE user_id = ?` przed INSERT i po zużyciu | TAK | TAK — tabela istnieje na stagingu (`to_regclass` = `password_resets`), 1 wiersz z 12.06.2026 | `psql` READ ONLY na `thomas.proxy.rlwy.net:52567` |
| 4 | **Realna wysyłka SMTP** | `server/src/services/emailService.ts:179-215` (jedyny `createTransport` w całym backendzie) | TAK | **NIE — każda wiadomość odrzucana przez dostawcę, błąd połykany** | §2.1, §2.2 — handshake SMTP `553 5.7.1` |
| 5 | `POST /api/auth/reset-password` + strona `/reset-password` | `auth.routes.ts:2574`; `AppRoutes.tsx:1488` → `src/views/auth/ResetPasswordView.tsx`; klient `src/services/modules/AuthService.ts:73` | TAK | TAK (logika poprawna), ale zwracał 200 także przy zapisie 0 wierszy; strona po angielsku w PL | §2.3, §2.4, dowody mutacyjne §4 |

Wniosek: **padło ogniwo 4.** Ogniwa 1, 2, 3, 5 są zamontowane i mają realnych wołaczy.

---

## 2. Co było zepsute i dlaczego

### 2.1 (P0) Nadawca koperty czytany ze złej zmiennej — cała poczta odrzucana

`emailService.ts` czytał wyłącznie `SMTP_FROM`:

```ts
from:
  settings['smtp_from'] ||
  process.env.SMTP_FROM ||
  '"Consultify System" <system@consultify.com>',
```

Na Railway (staging) **`SMTP_FROM` NIE JEST USTAWIONE** — ustawione jest `EMAIL_FROM=hello@consultinity.com`.
Zmierzone: `railway variables --environment staging --service consultify`. W tabeli `settings`
na bazie stagingu nie ma ani jednego wiersza `smtp_%` (`SELECT key, value FROM settings WHERE key LIKE 'smtp%'`
→ 0 wierszy). Kod schodził więc do twardego fallbacku `system@consultify.com`.

Dostawca (`smtp.hostinger.com`, konto `hello@consultinity.com`) odrzuca obcego nadawcę.
Handshake wykonany z zewnątrz, **bez wysyłania wiadomości** (`RCPT TO` bez `DATA`, potem `RSET`):

```
-> MAIL FROM:<system@consultify.com>
<- 250 2.1.0 Ok
-> RCPT TO:<hello@consultinity.com>
<- 553 5.7.1 <system@consultify.com>: Sender address rejected: not owned by user hello@consultinity.com
```

Ten sam handshake z `MAIL FROM:<hello@consultinity.com>` → `250 2.1.5 Ok`.

Skutek: od momentu wpięcia Hostingera **żaden mail nie wychodził** — reset hasła, weryfikacja
e-mail, powitalny, alerty. Wszystkie idą przez ten jeden `createTransport`.

### 2.2 (P0) Błąd wysyłki połykany — bezpiecznik nie mierzył

```ts
} catch (e) {
  logger.error('[EMAIL SERVICE] SMTP Failed:', error.message);
  if (requireDelivery) return false;   // requireDelivery domyślnie false
}
return true;
```

`forgot-password` wołał `send()` bez `requireDelivery`, więc `delivered` było **zawsze `true`**
i ostrzeżenie `[Auth] Password reset email was not delivered` nie mogło się nigdy pojawić.
Trasa odpowiadała `200 {"success":true,"message":"If the email exists, a reset link has been sent."}`
niezależnie od tego, czy cokolwiek poszło. Podręcznikowy „bezpiecznik przechodzi, bo nie mierzy”.

### 2.3 (P1) `reset-password` zwracał 200 przy zapisie 0 wierszy

`if (!updateResult.success)` sprawdzało tylko flagę sterownika, nie liczbę zmienionych wierszy.
UPDATE trafiający w 0 rekordów kończył się komunikatem „Password updated successfully”.
Zmierzone mutacją d (§4).

### 2.4 (P1) Obie strony resetu renderowały się PO ANGIELSKU także w PL

`auth.forgotPassword` jest w `pl/translation.json` **napisem** („Zapomniałeś hasła?” — link na
ekranie logowania), a widoki pytały o `auth.forgotPassword.title`, `.subtitle`, `.sendLink`…
i18next nie może mieć jednocześnie napisu i obiektu pod tym samym kluczem, więc **wszystkie**
te odpytania spadały na angielskie wartości domyślne. `auth.resetPassword` nie istniał w ogóle
w żadnym z dwóch języków. Właściciel odzyskujący hasło po polsku widziałby angielski ekran.

### 2.5 Zmierzone, ale NIE naprawione (poza zakresem, do decyzji)

- `SMTP_SECURE` i `EMAIL_FROM` nie były czytane **nigdzie** w repo (`grep` po `server/src`);
  `secure` było przybite na `false`. Przy porcie 465 połączenie by nie wstało. Naprawione (§3),
  ale warto wiedzieć, że zmienna była martwa.
- **`csrfValidationMiddleware` nie jest zamontowany nigdzie** — `server/src/index.ts:1252`
  montuje tylko `csrfTokenMiddleware` (wydawanie ciasteczka). Walidacja CSRF jest w praktyce
  martwa w całej aplikacji, a lista wyjątków (`csrf.middleware.ts:224-238`, gdzie
  `/api/auth/reset-password` jest, a `/api/auth/forgot-password` nie) nikogo nie chroni ani
  nie blokuje. Potwierdzone empirycznie: POST bez ciasteczka i nagłówka przechodzi na stagingu.
  **To osobne zgłoszenie bezpieczeństwa, nie ruszałem tego w tej gałęzi.**
- `tests/setup.ts:442` mockuje `server/services/emailService.js`, a `vitest.config.ts:25`
  aliasuje tę ścieżkę na `server/src/services/emailService.ts` — czyli **globalny setup podmienia
  prawdziwy serwis poczty pod KAŻDYM testem** na atrapę zwracającą `true`. Każdy dotychczasowy
  „test poczty” mierzył atrapę. Nowy test omija to przez `vi.unmock`.

---

## 3. Co naprawiono

| Plik | Zmiana |
|------|--------|
| `server/src/services/emailService.ts` | nadawca: `smtp_from` → `SMTP_FROM` → **`EMAIL_FROM`** → **konto SMTP (`SMTP_USER`)** → dopiero na końcu stały fallback. Nigdy więcej obca domena, gdy znamy uwierzytelnioną skrzynkę. |
| `server/src/services/emailService.ts` | `secure` liczone z `SMTP_SECURE` / `settings.smtp_secure`, a gdy nie podano — z portu (465 → implicit TLS). |
| `server/src/services/emailService.ts` | `send()` zwraca **`false`**, gdy skonfigurowany dostawca odrzucił wiadomość (wcześniej `true`). Log błędu zawiera host, port, secure, from, to i odpowiedź serwera. |
| `server/src/routes/auth.routes.ts` (forgot-password) | `requireDelivery: true`; niedostarczenie loguje się jako `error` z instrukcją, dostarczenie jako `info`. Odpowiedź dla klienta pozostaje neutralna (ochrona przed enumeracją kont). |
| `server/src/routes/auth.routes.ts` (reset-password) | odmowa 500 również wtedy, gdy UPDATE zmienił **0 wierszy**. |
| `src/views/auth/ForgotPasswordView.tsx`, `ResetPasswordView.tsx` | klucze `auth.forgotPassword.*` / `auth.resetPassword.*` → `auth.forgotPasswordPage.*` / `auth.resetPasswordPage.*` (koniec kolizji z napisem). |
| `public/locales/{pl,en}/translation.json` | pełne tłumaczenia obu ekranów + uzupełnione `auth.newPassword`, `auth.confirmPassword`, `auth.emailPlaceholder` (były `null` w PL i EN). |
| `server/src/services/__tests__/emailService.senderAndDelivery.test.ts` | NOWY test regresyjny (4 asercje), z `vi.unmock` omijającym globalną atrapę. |

---

## 4. Dowody

### 4.1 Środowisko dowodowe

- Postgres `pgvector/pgvector:pg17` w kontenerze `cfy-haslo-pg`, port **6317**, sprzątnięty
  `docker rm -f -v` po pomiarze.
- Migracje: `server/scripts/migrate.postgres.ts` na pustej bazie → `✅ Postgres migrations complete`.
- Realny serwer produktu: `npx tsx server/src/index.ts`, port 6331, `DB_TYPE=postgres`.
- Atrapa SMTP: własny serwer SMTP na 127.0.0.1:6325, zapisujący pełną treść wiadomości;
  umiał też odtworzyć politykę Hostingera (`553` dla obcego nadawcy).
- Konta testowe utworzone przeze mnie: `probe-a@sink.local`, `probe-b@sink.local`
  (org `org-probe`). Żadne realne konto nie było dotykane.

### 4.2 Pełny przebieg (10/10 PASS)

```
PASS  1. link resetu przyszedl mailem  :: bd0c144d07f2...
PASS  2. reset-password ustawia haslo
PASS  3. logowanie NOWYM haslem dziala
PASS  4. STARE haslo odrzucone
PASS  b) token uzyty drugi raz -> odmowa  :: 400 PASSWORD_RESET_INVALID
PASS  a) token wygasly -> odmowa          :: 400 PASSWORD_RESET_EXPIRED
PASS  a2) haslo NIE zmienione po wygaslym tokenie
PASS  c0) oba tokeny zyja jednoczesnie
PASS  c) token konta B zmienia WYLACZNIE konto B
PASS  c2) haslo z tokenu B NIE loguje na konto A
```

Przechwycona wiadomość (treść, nie „nie rzuciło wyjątkiem”):

```
From: hello@sink.local
To: probe-a@sink.local
Subject: Consultify — Password Reset
  <h2>Password Reset Request</h2>
  <p>Click the link below to reset your password. This link expires in 60 minutes.</p>
  <p><a href="http://localhost:6330/reset-password?token=047547b5…">…</a></p>
```

### 4.3 Dowody mutacyjne (każdy: usuń zabezpieczenie → czerwono → przywróć)

| Mutacja (w kodzie produktu) | Co się zaczerwieniło | Wynik |
|---|---|---|
| **a)** usunięty blok sprawdzania `expires_at` w `reset-password` | `a) token wygasly -> odmowa` → **200**; `a2) haslo NIE zmienione` → FAIL | ZABEZPIECZENIE REALNE |
| **b)** usunięty `DELETE FROM password_resets` po udanej zmianie | `b) token uzyty drugi raz -> odmowa` → **200** | ZABEZPIECZENIE REALNE |
| **c)** `WHERE pr.token = ?` → `WHERE pr.token = ? OR TRUE ORDER BY created_at ASC` (zerwana więź token↔konto) | `c)` FAIL (konto A zmienione cudzym tokenem), `c2)` → **login 200 cudzym hasłem** | ZABEZPIECZENIE REALNE |
| **d)** `UPDATE users SET password = ? WHERE id = ? AND 1 = 0` | `3. logowanie NOWYM haslem` FAIL, `4. STARE haslo odrzucone` → **200** | ZABEZPIECZENIE REALNE (i to ono ujawniło defekt §2.3 — trasa dalej zwracała „Password updated successfully”, stąd naprawa liczby wierszy) |
| **e)** cofnięcie naprawy nadawcy (kod znów czyta tylko `SMTP_FROM`) | atrapa SMTP: `===REJECTED=== sender system@consultify.com`, skrzynka pusta; log serwera: `SMTP Failed … 553 5.7.1 Sender address rejected` **oraz** `[Auth] Password reset email was NOT delivered (userId=u-probe-a)` | ODTWORZONA AWARIA Z PRODUKCJI + dowód, że nowe logowanie ją widzi |

Test jednostkowy też przeszedł mutację: po cofnięciu trzech napraw w `emailService.ts`
**4/4 czerwone**, po przywróceniu **4/4 zielone**.

### 4.4 Brak regresji

- `npx tsc -p server/tsconfig.json --noEmit`: **1 błąd, ten sam co na czystej bazie**
  (`deckImageSafetyGates.ts(9,34)`, `tesseract.recognize`) — zero nowych.
- `meetingInvitationService.test.ts` 2/2 PASS.
- `tests/unit/angielskieResztkiPL.test.ts` + `helpTranslations.test.ts` 4/4 PASS.

---

## 5. Stan na stagingu

- Serwer i baza żyją, `/api/health` = ok, `gitSha=56913a0b3b`.
- `POST /api/auth/forgot-password` odpowiada 200 dla adresu nieistniejącego (neutralnie, poprawnie).
- Tabela `password_resets` istnieje, ma **1 wiersz z 12.06.2026** (wygasły) — czyli od czerwca
  nikt skutecznie nie przeszedł tej ścieżki.
- W logach Railway z okna pomiaru widać `Pre-Gateway: POST /api/auth/forgot-password`
  i **ani jednej linii `[EMAIL SERVICE]`** — bo żądanie dotyczyło adresu nieistniejącego,
  a wtedy trasa wraca przed wysyłką (celowa ochrona przed enumeracją).
- **Nie wysłałem żadnej wiadomości na adres właściciela ani na żaden realny adres z bazy.**
  Handshake SMTP kończył się na `RCPT TO` + `RSET`, bez `DATA`.
- Bazy demo i produkcji nietknięte. Na bazie stagingu wyłącznie `SELECT`.

---

## 6. Co wymaga zmiany w konfiguracji Railway (NIE zmieniałem sam)

**Natychmiastowe odblokowanie bez deployu** — obecny kod na stagingu czyta `SMTP_FROM`,
więc wystarczy dodać zmienną:

| Projekt | Środowisko | Serwis | Zmienna | Wartość |
|---|---|---|---|---|
| `a6d59e88-263d-45f3-96bc-861f66bf467b` | `staging` | `consultify` | **`SMTP_FROM`** | **`hello@consultinity.com`** |

(dokładnie ta sama wartość, którą trzyma już `EMAIL_FROM`; potwierdzone handshakiem `250 2.1.5 Ok`)

Po wdrożeniu tej gałęzi zmienna `SMTP_FROM` przestaje być potrzebna — kod czyta `EMAIL_FROM`,
a w ostateczności `SMTP_USER`. Zostawienie jej nie szkodzi.

**To samo dotyczy środowiska demo i produkcji** — jeśli tam również jest `EMAIL_FROM` bez
`SMTP_FROM`, poczta jest tak samo martwa. Nie sprawdzałem (zakaz dotykania).

---

## 7. Czego NIE zmierzyłem

- Czy właściciel dostanie wiadomość na swoją realną skrzynkę — nie wolno mi było wysyłać.
  Dowiedziona jest akceptacja koperty przez dostawcę (`250` dla `RCPT TO`), nie dostarczenie
  do skrzynki odbiorczej (SPF/DKIM/DMARC domeny `consultinity.com` niesprawdzone).
- **Dlaczego właściciel nie może się zalogować znanym hasłem** — to osobna sprawa niż
  odzyskiwanie. Ścieżka odzyskiwania była zepsuta i jest naprawiona, ale nie wyklucza to
  drugiej przyczyny po stronie logowania.
- Stan poczty na demo i produkcji.
- Czy `password_resets` ma sprzątanie wygasłych wierszy (nie znalazłem schedulera; wiersz
  z czerwca leży do dziś).
