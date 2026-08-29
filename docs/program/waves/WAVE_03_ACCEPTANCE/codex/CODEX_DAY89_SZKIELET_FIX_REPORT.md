# CODEX — DYŻUR 89 — NAPRAWA SPRZECZNOŚCI SZKIELETU

Data: 2026-08-29

Gałąź: `codex/day89-szkielet-fix-20260829`

Marker: `800576e969432c583beae0293ad296c39b86d84d`

## Stan wejściowy

`§0.1` (2):

```text
MARKER OK
```

`§0.1` (7):

```text
800576e969432c583beae0293ad296c39b86d84d
```

`git status --short | head -3` nie zwrócił żadnej linii.

Tip gałęzi bazowej uciekł do przodu zgodnie z `DEC-2026-08-26-95`:

```text
bc6411e1df docs(day89): dodaj instrukcje 89 pominieta przez .gitignore *_FIX*.md
f1c2ad5054 docs: dyzury 88 (LLM domyslnie ON) i 89 (naprawa szkieletu) + DEC-317/318
```

Lista plików marker..tip:

```text
docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_88_LLM_DOMYSLNIE_ON.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/INSTRUKCJA_DYZUR_89_SZKIELET_FIX.md
```

Porty `5961` i `4830` były wolne: oba polecenia `lsof -nP -iTCP:<port>
-sTCP:LISTEN` oraz filtr `docker ps` zwróciły zero trafień.

## W1-W4

- W1 potwierdziło bezwarunkowy zakaz pełnego `server/src/index.ts` w
  `docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md:255-300`.
- W2 potwierdziło spawn `server/src/index.ts` przez kanoniczny runtime w
  `scripts/dev/start-wave3-owner-runtime.mjs:681-685`.
- W3 potwierdziło trzy starty w `server/src/index.ts:2040-2066` i zero trafień
  w `server/src/Gateway.ts`.
- W4 zwróciło zero trafień: runtime nie ustawia jawnej zmiennej SMTP/mail/outbox.

## B.1 — faktyczne ryzyko

1. Przy realnej bazie workery trwałe są włączone przez
   `server/src/index.ts:1993-2015` oraz
   `server/src/startup/testModeGates.ts:74-85`. Startują trzy ścieżki:
   `startNotificationOutboxDrainCron` (`index.ts:2034-2045`),
   `startPlatformOutboxDrainCron` (`index.ts:2047-2055`) i
   `startCaseWorkspaceOutboxWorker` (`index.ts:2057-2068`). Żadnej z nich nie
   ma w `Gateway.ts`.
2. Runtime ich nie wyłącza: uruchamia serwer jako `NODE_ENV=development`,
   `MOCK_DB=false` (`start-wave3-owner-runtime.mjs:645-666`) i spawnuje pełny
   entrypoint (`:681-685`). Neutralizuje natomiast konfigurację dostawców:
   `childEnv` przenosi tylko siedem systemowych kluczy i `CI`, po czym dokłada
   jawne wartości (`:398-402`), a serwer dostaje `DOTENV_DISABLED='1'`
   (`:645-651`). Zmienne SMTP/mail nie są dziedziczone.
3. Brak konfiguracji SMTP nie powoduje upadku drenażu na starcie.
   Notification drain jest domyślnie ON poza `NODE_ENV=test`
   (`notificationOutboxService.ts:215-247`) i może wywołać kanał email przez
   `notificationService.ts:1583-1602`. `emailService` czyta ustawienia z DB
   przed env (`emailService.ts:167-190`), lecz tworzy transporter i woła
   `sendMail` tylko gdy jednocześnie istnieją host oraz user (`:201-205`). Bez
   nich, przy domyślnym `requireDelivery=false`, kończy bez realnej wysyłki
   (`:220-224`). Zatem ryzyko realnej wysyłki istnieje przy choćby odziedziczonej
   lub zapisanej konfiguracji SMTP; przy dowiedzionym braku konfiguracji usługa
   pozostaje atrapą konsolową.

Werdykt: sześć wcześniejszych uruchomień łamało literalny zakaz, ale źródła
potwierdzają, że kanoniczny runtime izoluje env. Brak szkody jest zgodny z
mechanizmem kodu pod warunkiem, że wykonano także wymagany readback bazy.

## Protokół Z30 przed pomiarem zapisującym

```text
BRAK ZMIENNYCH POCZTY

 key | left
-----+------
(0 rows)

Gateway.ts: 0 trafień dla startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron
```

Migracje na `postgresql://postgres:***@127.0.0.1:5961/cx_day89` wykonano dwa
razy obrazem `pgvector/pgvector:pg16`; pierwszy przebieg zakończył się
`Postgres migrations complete`, drugi podał `Applying migrations: 0` i również
`Postgres migrations complete`. Logi:

- `/private/tmp/cx-day89-szkielet-artefakty/migrate-1.log`
- `/private/tmp/cx-day89-szkielet-artefakty/migrate-2.log`

**Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.**

## B.2-B.3 i kryteria K1-K6

- K1: spełnione — pomiar B.1 zawiera łańcuchy `plik:linia`.
- K2: spełnione — `§0.2b` osobno zachowuje zakaz dla testów i dopuszcza
  wyłącznie kanoniczny runtime zrzutowy pod imiennymi warunkami fail-closed.
- K3: spełnione — zakaz wysyłki, dowody braku env i wpisów DB, zakaz ręcznych
  drenaży oraz obowiązek deklaracji pozostają; dowody (a)-(b) obowiązują oba
  przypadki.
- K4: spełnione — liczba wierszy tabeli numeracji przed i po wynosi `46`
  (obejmuje powtórzenia szablonowe oraz `Z34a`), a porównanie unikalnego zbioru
  etykiet zakończyło się `Z_LABEL_SET_IDENTICAL`: `Z1`–`Z40` i `Z34a` pozostały
  bez zmian.
- K5: spełnione — ostrzeżenie wskazuje dyżury `70`, `72`, `73`, `76`, `81`,
  `85`, brak szkody i niezależne zabezpieczenie `Z30`.
- K6: spełnione — do commita przygotowano wyłącznie szkielet i niniejszy raport;
  końcowy wynik marker..HEAD zapisano niżej.

## Pułapki Z33

Nie uruchamiano pakietu testowego. Pułapki (a)-(d) dotyczą fałszywych wyników
testów runtime/auth/DB i nie służyły jako dowód. Pułapka (e) dotyczyła rdzenia:
została wyłączona przez statyczne prześledzenie entrypointu, trzech workerów,
izolacji `childEnv`, odczytu konfiguracji SMTP z DB i warunku tworzenia
transportera. Nie uznano samego zielonego przebiegu ani grepu za dowód działania.

## Korekty wobec instrukcji

1. Instrukcja określa W4 jako sprawdzenie, „czy runtime ustawia cokolwiek, co
   blokuje wysyłkę", lecz komenda szuka jedynie nazw SMTP/mail/email/outbox.
   Zwróciła zero trafień. Realnym mechanizmem jest allowlista `childEnv` oraz
   `DOTENV_DISABLED='1'`, ustalone osobnym pomiarem.
2. Instrukcja pyta, czy bez konfiguracji drenaż „pada na starcie". Pomiar
   wykazał trzeci, precyzyjniejszy stan: drenaż startuje, ale `emailService` nie
   tworzy transportera i zwraca sukces atrapy konsolowej.

## Pliki i artefakty

Artefakty poza repo:

```text
775d4b92cb3d20a1aff5e41a1ffcc5cca069ab3874e40b5f1a15fb3a2fdf44b3  /private/tmp/cx-day89-szkielet-artefakty/migrate-1.log
900d850524ac7481de1507e4ba730a8934b593944ab4fc628b6b64141d853f04  /private/tmp/cx-day89-szkielet-artefakty/migrate-2.log
```

Zakres repo po zacommitowaniu ma zawierać wyłącznie:

```text
docs/program/system-pracy/02_SZKIELET_INSTRUKCJI.md
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY89_SZKIELET_FIX_REPORT.md
```
