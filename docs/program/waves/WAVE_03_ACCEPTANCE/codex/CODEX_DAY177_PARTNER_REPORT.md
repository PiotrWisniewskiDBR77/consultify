# CODEX DAY177 — PARTNER — RAPORT

Data: 2026-08-30. Marker `d3d36cd5f5`. Gałąź `codex/day177-partner-20260830`.

Werdykt: `BLOCKED / EVIDENCE_MISSING`. Fixture i readback przeszły, lecz kanoniczny runtime odrzucił wydaną nazwę DB przed startem serwera. G08–G20 bez podniesienia.

## Wejście i korekta równoległego wpisu

Instrukcję przeczytano w całości z vaulta (714 linii). Dysk: 22 GiB wolnego. Porty 6077/5024/5025 były wolne. `MARKER OK`; worktree był czysty na `d3d36cd5f51ed9db796bb350c1109ebc2e4b705c`; tip wyprzedza marker o 7 commitów, bez rebase.

Równoległy commit `abc9517689` błędnie opisał kontener `46a6d5…` jako cudzy. Został on utworzony przez niniejszy przebieg o 18:57 i jest zasobem Day177. Ten raport koryguje wyścig dokumentacyjny bez przepisywania historii.

T1–T4: seeder ma kontrakt `Any database name is accepted`, zgodny `--confirm-db` i dynamiczny ledger; oba commity `19b75cd708` i `0eab8a3dad` istnieją; historyczny G08 ma `AUTH_BARRIER_CAPTURED / 0_OF_25_RUNTIME_SCREENS`; typ/sidebar i switch w `PartnerPortalView.tsx:3199-3251` potwierdzają 25 pozycji (`3+3+4+4+3+4+4`). Korekty: BSD `cat` nie obsługuje instrukcyjnego `cat -A`; `git log -1 A B` pokazuje tylko jeden commit, więc oba sprawdzono osobno.

## Realny PG, fixture i Z30

Lokalny `cx-day177-pg`: `pgvector/pgvector:pg16`, `127.0.0.1:6077`, DB `cx177`. Pierwszy pełny przebieg migracji: sukces, ledger `869 success`; drugi: `Applying migrations: 0`, sukces.

Przed zapisem: `BRAK ZMIENNYCH POCZTY`, 0 kluczy `smtp%` w `settings`, 0 trafień drenaży w `server/src/Gateway.ts`. Po seedzie nadal 0 kluczy `smtp%`.

Seeder uruchomiono z jawnym loopback `DATABASE_URL`, `SEED_WAVE3_PARTNER_OWNER_REVIEW=YES`, `--confirm-db=cx177`, manifestem poza repo i hasłem z env. Exit 0. Readback: `bound_partner=1`, `certifications=2`, `participant_facts=1`, `commissions=0`, `payouts=0`. Manifest `/private/tmp/cx-day177-partner-artefakty/partner-owner-manifest.json`, SHA-256 `5b35183a1414ecf384815b32bd039045e7d39b015691de88a2229d7c0eae848f`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Blokada

§0.2c wiąże DB `cx177`, którą naprawiony seeder przyjmuje. `scripts/dev/start-wave3-owner-runtime.mjs:151-165` w `adopt-existing` nadal wymaga jednak `^consultify_w3_partner_owner_[a-z0-9_]+$`. Kanoniczna próba z manifestem 0600, fingerprintem, portami 5024/5025 i `ENABLE_TEST_AUTH_BYPASS=false` zatrzymała się przed serwerem:

```text
Error: [W3 runtime] BLOCKED: adopted DB must be local and match the closed Wave3 owner prefix allowlist
    at parseDb (.../scripts/dev/start-wave3-owner-runtime.mjs:163:5)
```

Dowód: `/private/tmp/cx-day177-partner-artefakty/runtime-start.log`. Nie zmieniono skryptu, nie utworzono drugiej DB i nie przepisano receipt. Brief: ujednolicić wydany kontrakt nazwy DB z allowlistą runtime i ponowić dyżur na świeżej DB.

## Pełny mianownik 25

Runtime nie wystartował, więc `NIE ZMIERZONO` celowo nie udaje `renderuje się / błąd / pusty`.

| # | Sekcja | Wynik | Uwaga |
|---:|---|---|---|
|1|partner-home|NIE ZMIERZONO|brak zrzutu|
|2|dashboard|NIE ZMIERZONO|005 niezmierzone|
|3|metrics|NIE ZMIERZONO|brak zrzutu|
|4|referral-tools|NIE ZMIERZONO|brak zrzutu|
|5|referral-analytics|NIE ZMIERZONO|brak zrzutu|
|6|referred-organizations|NIE ZMIERZONO|brak zrzutu|
|7|earnings|NIE ZMIERZONO|005 niezmierzone|
|8|statements|NIE ZMIERZONO|brak zrzutu|
|9|payouts|NIE ZMIERZONO|fixture celowo 0 payouts|
|10|payout-settings|NIE ZMIERZONO|brak zrzutu|
|11|client-access|NIE ZMIERZONO|brak zrzutu|
|12|organizations|NIE ZMIERZONO|006 niezmierzone|
|13|projects|NIE ZMIERZONO|006 niezmierzone|
|14|users|NIE ZMIERZONO|brak zrzutu|
|15|learning-path|NIE ZMIERZONO|brak zrzutu|
|16|exams|NIE ZMIERZONO|brak zrzutu|
|17|certificates|NIE ZMIERZONO|fixture ma 2 certyfikacje|
|18|documentation|NIE ZMIERZONO|brak zrzutu|
|19|marketing|NIE ZMIERZONO|brak zrzutu|
|20|case-studies|NIE ZMIERZONO|brak zrzutu|
|21|templates|NIE ZMIERZONO|brak zrzutu|
|22|company-info|NIE ZMIERZONO|brak zrzutu|
|23|specializations|NIE ZMIERZONO|brak zrzutu|
|24|regions|NIE ZMIERZONO|brak zrzutu|
|25|public-listing|NIE ZMIERZONO|brak zrzutu|

Zrzuty Light/Dark: `0/50`. Nie otwierano przeglądarki na martwych portach, bo nie byłby to realny przejazd.

## TWIERDZENIA NIEZWERYFIKOWANE

- Realne logowanie przez `verifyToken`; wszystkie 25 sekcji w obu motywach.
- PRT-D62-005, 006 i 007; brak uczciwego licznika i18n.
- Brak błędów konsoli/logu per sekcja; owner acceptance.

Nie uruchomiono Vitest jako dowodu. Próba runtime miała realny PG i bypass false, ale zatrzymała się przed ApiGateway/auth/UI. Pomiar §0.4a: zmieniono wyłącznie raport i dopisek Day177; nowe/zmienione testy 0/0, co nie jest przedstawiane jako PASS.

Artefakty poza repo: `migrate-1.log`, `migrate-2.log`, `seeder.log`, `partner-owner-manifest.json`, `runtime-start.log` w `/private/tmp/cx-day177-partner-artefakty`.
