# Etap A — pomiar realnej wysyłki poczty (2026-09-10)

Gałąź `mvp/p1-poczta-20260910`, baza `a624415620`.
Wdrożony kod na obu środowiskach: `gitSha=f53f9fbdf9e977bb6eb8e41525a3cafe40a7126d` (odczyt z `/api/health`).

## Wynik: POCZTA DZIAŁA — staging DZIAŁA, demo DZIAŁA

### Hipoteza zlecenia OBALONA
Teza: „demo ma port 465 bez `SMTP_SECURE` → wysyłka pada".
Pomiar: `server/src/services/emailService.ts:196-201` wylicza `secure` z portu, gdy
`SMTP_SECURE` nie jest ustawione (`smtpPort === 465` → `true`). Ten kod jest w commicie
wdrożonym na demo (`git merge-base --is-ancestor e94fbc4555 f53f9fbdf9` → prawda).
Brak `SMTP_SECURE` na demo NIE jest defektem. Brak `SMTP_FROM` na demo też nie —
jest fallback `SMTP_FROM || EMAIL_FROM || smtpUser` (`emailService.ts:210-217`).

### Teza „poczta martwa w całej aplikacji" (dok. z 06.09) — NIEAKTUALNA
Zmierzone wysyłki zakończone `Sent successfully via SMTP`.

## Dowody z logów Railway

STAGING (`railway logs --environment staging --service consultify`):
```
2026-09-10 05:46:56 --- [EMAIL SERVICE] Sending to james.whitfield@northwind.example ---
2026-09-10 05:46:56 info: Using Host: smtp.hostinger.com
2026-09-10 05:46:57 info: [EMAIL SERVICE] Sent successfully via SMTP
2026-09-10 05:46:57 info: [Auth] Password reset email delivered (userId=08c54d75-...)
```
Wysyłka na REALNĄ domenę (rejestracja `p1-test-074843@dbr77.com`, 05:48:44):
```
2026-09-10 05:48:44 info: [EMAIL SERVICE] Sent successfully via SMTP
2026-09-10 05:48:44 info: [Auth] Email verification sent to p1-test-074843@dbr77.com
2026-09-10 05:48:45 info: [WelcomeEmail] Welcome email sent to p1-test-074843@dbr77.com
```

DEMO (`railway logs --environment demo --service consultify`), port 465, bez `SMTP_SECURE`:
```
2026-09-10 05:47:11 --- [EMAIL SERVICE] Sending to james.whitfield@northwind.example ---
2026-09-10 05:47:11 info: Using Host: smtp.hostinger.com
2026-09-10 05:47:11 info: [EMAIL SERVICE] Sent successfully via SMTP
2026-09-10 05:47:11 info: [Auth] Password reset email delivered (userId=08c54d75-...)
```

## Zmienne (zweryfikowane samodzielnie, `railway variables --kv`)
Pomiar zlecenia POTWIERDZONY co do wartości. `ENABLE_V8_GLOBAL=true` na OBU
środowiskach — pułapka „404 przed autoryzacją" nie występuje.

## Ślad w logu przy porażce — JUŻ ISTNIEJE
`emailService.ts:261-268` loguje `[EMAIL SERVICE] SMTP Failed (host=… port=… secure=… from=… to=…): <błąd>`
i zwraca `false`; `auth.routes.ts:2668-2673` dokłada `[Auth] Password reset email was NOT delivered`.
Wymagane minimum Etapu B jest spełnione bez zmian w kodzie.

## Pułapka pomiarowa napotkana
`POST /api/auth/forgot-password` na adres NIEISTNIEJĄCY w bazie zwraca 200 i NIE
zostawia żadnego logu poczty (ochrona przed enumeracją, `auth.routes.ts:2626-2631`).
Pierwszy pomiar na `piotr.wisniewski@dbr77.com` (konto nie istnieje na stagingu) dał
200 bez logu — to NIE była porażka wysyłki. Mierz na koncie, które istnieje.

## Defekty znalezione przy okazji (naprawa: Etap B)
1. Wyczerpany limit miejsc organizacji wraca do użytkownika jako `"Invitation payload is invalid."`
   Prawdziwy powód jest tylko w logu serwera: `Organization has reached maximum seats.`
2. Mail powitalny i weryfikacyjny są twardo po angielsku (`welcomeEmailService.ts:24`,
   `emailVerificationService.ts:130`) — brak wariantu PL. Reset hasła ma PL/EN poprawnie.
