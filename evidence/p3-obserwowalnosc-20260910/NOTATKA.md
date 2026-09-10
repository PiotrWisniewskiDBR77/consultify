# P3 — dowód alertów (Etap B), 2026-09-10

## Co to jest, a co NIE jest

`dowod-alertow-testy.txt` to zrzut wyniku 4 testów jednostkowych, które wołają
REALNY kod produkcyjny (`server/src/middleware/alertWatchdog.middleware.ts`,
`server/src/cron/HealthCheckJob.ts`) ze sztucznie wywołanym błędem — 10 sztucznych
odpowiedzi 500 w oknie, oraz sztuczny reject `SELECT 1` — i sprawdzają, że kod
POD SPODEM próbuje wysłać alert (Slack/WhatsApp przez `sendSystemAlert`, e-mail
przez `emailService.sendEmail`) z poprawnym adresatem.

**To NIE jest zrzut ekranu z realnej skrzynki pocztowej ani kanału Slack.**
Z tego stanowiska nie mam dostępu do skrzynki Piotra ani do kanału Slacka
`#alerts`/`ai_ops`, więc nie mogę POTWIERDZIĆ fizycznego doręczenia — tylko że
kod wysyła próbę doręczenia z właściwym adresem/treścią. Zgodnie z zasadą
"PASS wyłącznie po pomiarze, niesprawdzone = N/A z powodem" — to jest jawnie
opisane jako częściowy dowód, nie pełne PASS na "alert dotarł".

## Co zostało zmierzone i naprawione

1. **Znalezisko**: `alertWatchdog.middleware.ts` (alert przy spike'u 5xx) czytał
   `ALERT_EMAIL`/`ADMIN_EMAIL`, a NIE `ALERT_EMAIL_RECIPIENTS`, którego używają
   `AlertEmailService.ts` i `HealthCheckJob.ts`. Na stagingu (pomiar
   `railway variables --environment staging`, 10.09) ustawione jest
   WYŁĄCZNIE `ALERT_EMAIL_RECIPIENTS=piotr.wisniewski@dbr77.com` — czyli PRZED
   poprawką spike 5xx na stagingu wysyłał e-mail donikąd (`alertEmail === ''`,
   `if (alertEmail && ...)` = false, cicho, bez logu błędu), mimo że healthcheck-down
   na ten sam adres działał poprawnie. NAPRAWIONE w tym kroku (commit tej gałęzi):
   `notifyAlert()` teraz czyta `ALERT_EMAIL_RECIPIENTS` jako pierwsze źródło.

2. **Test `alertWatchdog.5xxSpikeEmail.test.ts`**: potwierdza PO naprawie — z
   konfiguracją stagingu (`ALERT_EMAIL_RECIPIENTS` ustawione) 10x sztuczny 500
   -> `emailService.sendEmail('piotr.wisniewski@dbr77.com', '[Consultify Alert] ...')`
   faktycznie wołane. Z konfiguracją demo (nic nie ustawione) -> e-mail
   NIE jest wołany w ogóle (bo `alertEmail === ''` i middleware ma `if (alertEmail && ...)`)
   — to jest już bezpieczny "cichy brak", nie błąd, ale i tak brak adresata.

3. **Test `HealthCheckJob.dbDownAlert.test.ts`**: potwierdza, że padnięcie
   `SELECT 1` (symulowany reject) woła RÓWNOCZEŚNIE `sendSystemAlert` (Slack/WhatsApp,
   severity CRITICAL, source Database) i `emailService.sendEmail` z tematem
   "CRITICAL ALERT: System Database Down" na adres z `ALERT_EMAIL_RECIPIENTS`.
   Z konfiguracją demo (bez `ALERT_EMAIL_RECIPIENTS`) e-mail JEST wołany, ale
   `to === ''` — SMTP dostanie pusty adresat (zachowanie zależy od transportu
   e-mail; nie zmierzone tutaj, patrz STOP niżej).

## Adresat nazwany (wymóg kryterium: "alert dociera do nazwanej osoby")

Na stagingu: **Piotr Wiśniewski, piotr.wisniewski@dbr77.com** — pochodzi z
`organizations`/env `ALERT_EMAIL_RECIPIENTS` zmierzonego przez nadzorcę
10.09 rano. Na demo: BRAK — `ALERT_EMAIL_RECIPIENTS` nie jest ustawiona (patrz
sekcja ZMIENNE DLA NADZORCY w meldunku głównym).

## STOP-y (nie sprawdzone, N/A z powodem)

- **Realne doręczenie na stagingu** (skrzynka Piotra / kanał Slack) — brak
  dostępu z tego stanowiska do odczytu tych kanałów. Zamiast zgadywać, dowód
  ograniczony do warstwy kodu (wyżej). Żeby dopiąć: ktoś z dostępem do skrzynki
  `piotr.wisniewski@dbr77.com` powinien wywołać `railway run --environment staging
  -- node -e "require('./server/dist/...")..."` (albo prościej: poczekać na
  faktyczny spike/health-fail na stagingu) i potwierdzić wizualnie.
- **Kanał Slack „alerts"** (`sendSystemAlert` -> `routeToSlack({channel:'alerts'})`)
  wymaga zmiennej `SLACK_WEBHOOK_URL` (RÓŻNEJ od `AI_OPS_SLACK_WEBHOOK_URL`,
  która jest zmierzona jako obecna — ta służy kanałowi `ai_ops`, nie `alerts`).
  Czy `SLACK_WEBHOOK_URL` jest ustawiona na stagingu/demo — NIE zmierzone z tego
  stanowiska (nie mam listy wszystkich zmiennych, tylko te podane w zleceniu).
  Do zweryfikowania: `railway variables --environment staging --service consultify --kv | grep SLACK_WEBHOOK_URL`.
- **Realny 5xx na żywym stagingu** — świadomie NIE wywołany fizycznie (brak
  bezpiecznego, istniejącego endpointu do wymuszenia 500 bez efektów ubocznych;
  wymyślanie jednego "na sztywno" niosłoby ryzyko dnia przed pilotażem). Dowód
  ograniczony do jednostkowego wywołania tego samego middleware'u z tym samym
  progiem (10 w oknie) i tą samą logiką wysyłki.
