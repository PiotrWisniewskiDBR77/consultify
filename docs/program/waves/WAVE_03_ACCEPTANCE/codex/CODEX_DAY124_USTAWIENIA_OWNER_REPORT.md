# Dyżur 124 — Ustawienia — pakiet odbioru wizualnego

Data: 2026-08-29  
Marker / HEAD: `a1265154b73f57a43cbe468993e4317bb2e0f02b`  
Gałąź: `codex/day124-ustawienia-odbior-20260829`  
Zakres: wyłącznie pomiar modułu `15_SETTINGS`; zero zmian w `src/**`, `server/**`, seederach, migracjach i lokalizacjach.  
Werdykt: `PARTIAL — 20 z 20 PLIKÓW / 12 z 20 SEMANTYCZNIE POPRAWNYCH / OWNER REVIEW PENDING`.

## 1. Związanie bazy pracy

Wynik §0.1 (2), dosłownie:

```text
63e7c979df merge: dyzur 119 — kontrakt trzech stanow w 3 komponentach; wycofal 2 pozorne integracje w martwym kodzie
aa564ad4f0 docs(day121-124): pierwsza budowa PO akcepcie + trzy rownolegle
13c33a84f9 docs(day119): record three-state acceptance evidence
70c68154f8 fix(interview): render template uncertainty banner
a1265154b7 merge: day120-fixture-insight
9ed715a779 merge: day118-propagacja
4ba5900ca0 docs(ledger): DEC-337..339 — wlasciciel zaakceptowal wzorzec karty Zadania
1736e861e3 fix(interview): surface template load uncertainty
91acd26e6e docs(interview): record day120 fixture evidence
1a31bedb26 docs(day118): record owned cleanup
71f6c5198b docs(day118): record propagation evidence
a2bda5f3de fix(interview): expose team member load failures
0caec88e83 test(finance): expose valuation error propagation boundary
a1215a8fbb fix(interview): seed measurable owner insight
73cb3bf395 fix(superadmin): surface configured AI providers
a2b7106bb3 fix(ui): preserve known partial and unknown counts
9a39cd41d6 fix(superadmin): align health monitor routes
63b5f8e64b docs(day118-120): fala naprawcza 2
86eeb60fb3 merge: dyzur 117 — kontrakt statusu naprawiony, ekran wola nieistniejaca trase
a9579b65d1 merge: dyzur 116 — 500 zastapione kontrolowana odmowa 409, UI jeszcze nie propaguje
289fe87400 docs(day117): record AI provider status evidence
a50202d838 docs(day116): record owned database cleanup
3b2a21f30e docs(day116): add WACC fix report
f6f7ec4ea4 docs(day116): record WACC conflict fix evidence
96d7a24067 merge: dyzur 114 — os czasu mowi prawde i podaje skale (wariant B)
MARKER OK
```

Wynik §0.1 (7), dosłownie:

```text
a1265154b73f57a43cbe468993e4317bb2e0f02b
```

`git status --short | head -3` nie zwrócił żadnej linii: stan wejściowy był czysty. Dostępne miejsce: `57 GiB z 1.8 TiB`, czyli powyżej progu 5 GB. Porty `6007`, `4914`, `4915`: `3 z 3` wolne (`lsof_exit=1`, brak mapowań Dockera).

Tip `github-backup/codex/m03-admin-20260824` był przed markerem o `7` commitów. Zgodnie z instrukcją pracowałem dokładnie z markera, bez rebase. Rozjazd dotyczył `13` plików; pełne komendy wykonano wg §0.1.

## 2. Trasy i stan wejściowy W1–W4

Front, `src/routes/routeConfig.ts`: `/settings`, `/settings/profile`, `/settings/billing`, `/settings/ai`, `/settings/notifications`, `/settings/integrations`, `/settings/organization`, `/settings/tenant-defaults`, `/settings/security` oraz mapowane podtrasy m.in. `/settings/regional`, `/settings/notifications-overview`, `/settings/security-dashboard`, `/settings/data-controls`, `/settings/theme`.

Tył, `server/src/Gateway.ts`: `/api/settings/ai`, `/api/ai-settings`, `/api/settings`, `/api/notification-settings` oraz `/api/user/privacy-settings`.

- W2: seeder istnieje w `scripts/dev/seed-wave3-settings-owner-review.mjs`; nie w `server/scripts/`.
- W3: `successful_migrations < 831`; próg jest typu „co najmniej”.
- W4: wejściowo G00–G07 miały dowody częściowe/techniczne, G08–G10 i G16–G20 były `NOT_STARTED`, G11–G15 częściowe.

## 3. K1 — kontrakt seedera: 4 z 4 przed startem

| Pytanie | Wynik | Dowód |
|---|---:|---|
| Czy host jest lokalny? | `1 z 1` | `127.0.0.1:6007`; seeder dopuszcza wyłącznie `127.0.0.1`, `localhost`, `::1`. |
| Czy nazwa bazy jest licencjonowana? | `1 z 1` | `consultify_w3_settings_owner_day124` spełnia prefiks i regex seedera. |
| Czy destrukcyjny seed ma jawne potwierdzenie? | `1 z 1` | `SETTINGS_OWNER_FIXTURE_CONFIRM=YES`. |
| Czy manifest jest nowy, absolutny i poza repo? | `1 z 1` | `/private/tmp/cx-day124-ustawienia-artefakty/day124-settings-fixture-manifest.json`, tryb `0600`. |

## 4. K2 — migracje, fixture i niezależny readback

Kontener: `cx-day124-pg`, obraz `pgvector/pgvector:pg16`, jedyne mapowanie `127.0.0.1:6007:5432`.

- seeder wykonał pełny łańcuch i readback: `863 z co najmniej 831` migracji;
- jawny przebieg idempotencyjny 1: `0 z 863` nowych migracji, bez błędu;
- jawny przebieg idempotencyjny 2: `0 z 863` nowych migracji, bez błędu;
- persony: `6 z 6`; kontrakty dostępu: `6 z 6`; aktywne członkostwa: `5 z 6`, cofnięte: `1 z 6`;
- preferencje OWNER: `4 z 4`; alternaty GDPR: `2 z 2`;
- język/strefa/waluta/formaty: `pl`, `Europe/Warsaw`, `PLN`, `pl-PL`, `DD/MM/YYYY`, `24h`, metric;
- MFA secrets: `0 z 6`; OAuth integrations: `0`; destrukcyjne wykonanie: `OFF`;
- marker `W3-SETTINGS-OWNER-v1` i nonce 64-hex: `1 z 1`;
- manifest: `0600`, 3685 bajtów, SHA-256 `8bbf3c90fd34ab3221954c6581b2d10c65116fca6b61020c5219cf2e3898d0fb`.

Artefakty: `day124-seed.log`, `day124-migrate-1.log`, `day124-migrate-2.log`, `day124-readback.log` w `/private/tmp/cx-day124-ustawienia-artefakty`.

## 5. Z30 — zero wysyłki

Przed seedem: `BRAK ZMIENNYCH POCZTY`. Po migracjach i seedzie:

```text
 key | left
-----+------
(0 rows)
```

Grep `startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron` w `server/src/Gateway.ts`: `0` trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu na potrzeby testów. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

Runtime: server `4914`, client `4915`; health/ready/frontend `3 z 3` po `200`; server/client SHA `2 z 2` zgodne z markerem; auth/test bypassy `3 z 3` OFF; `DOTENV_DISABLED` i `VITE_DOTENV_DISABLED` `2 z 2` aktywne; zabronione klucze w procesach `0`.

## 6. K3 — macierz 5 × 2 × 2

Powierzchnie zadeklarowane przed pierwszym zrzutem: Profil, Regionalizacja, Powiadomienia, Bezpieczeństwo, Dane i prywatność. Persony/stany: OWNER z fixture oraz MEMBER bez właścicielskiego zakresu. Motywy: emulacja `prefers-color-scheme=light|dark`, bez zapisu preferencji do bazy.

- pliki PNG: `20 z 20`;
- pliki semantycznie odpowiadające deklarowanej powierzchni: `12 z 20`;
- OWNER: `10 z 10` semantycznie poprawnych;
- MEMBER: `2 z 10` semantycznie poprawne (Profil); pozostałe `8 z 10` są bezgłośnym przekierowaniem do Profilu;
- obejrzane ręcznie: `20 z 20`;
- błędy/ostrzeżenia konsoli: `0 z 0` zarejestrowanych.

Polecenie integralności:

```bash
shasum -a 256 /private/tmp/cx-day124-ustawienia-artefakty/*.png
```

Pełna lista 20 hashy pozostaje w logu dyżuru. Powtarzające się hashe potwierdzają duplikaty przekierowanego Profilu; nie są liczone jako deklarowane powierzchnie. Widoczne teksty są w `day124-visible-texts.json`, a konsola w `day124-browser-errors-warnings.json`.

## 7. B3/K4 — ocena pięciu cech

Skala: `1` punkt za każdą spełnioną cechę. „Nie dotyczy” zaliczam tylko wtedy, gdy na powierzchni nie ma licznika/pustego stanu; nie dopisuję brakującego zachowania.

| Powierzchnia | PL nagłówki i wartości | Mianowniki | Puste nazwane | Uprawnienia wprost | Czerwień tylko blokada | Wynik |
|---|---|---|---|---|---|---:|
| Profil | `PARTIAL` — UI po polsku, ale MEMBER pokazuje surowe `USER` | `PASS` — widoczny licznik `0/100` | `FAIL` — puste pola bez wyjaśnienia przyczyny | `FAIL` — brak „możesz/nie możesz i dlaczego” | `PASS` — brak czerwonego statusu treści | `2 z 5` |
| Regionalizacja | `PASS` — nagłówki i wartości po polsku | `PASS` — brak licznika wymagającego mianownika | `PASS` — brak fałszywego zera/pustego statusu w mierzonym stanie | `FAIL` — brak jawnego zakresu uprawnień | `FAIL` — crimson w ikonie daty bez blokady | `3 z 5` |
| Powiadomienia | `PASS` | `PASS` — brak licznika wymagającego mianownika | `PASS` — stany przełączników są jawne | `FAIL` — brak wyjaśnienia uprawnień/ograniczeń | `FAIL` — crimson użyty dekoracyjnie | `3 z 5` |
| Bezpieczeństwo | `PASS` | `FAIL` — `0%` bez mianownika i sprzeczny z widocznymi kartami | `PASS` — „Nie skonfigurowano” i „Odroczone” są nazwane | `FAIL` — brak jawnego „kto może/co może/dlaczego” | `PASS` — czerwień towarzyszy „Wymaga poprawy” | `3 z 5` |
| Dane i prywatność | `PASS` | `PASS` — brak licznika wymagającego mianownika w uchwyconej treści | `PARTIAL` — stany zgód jawne, ale brak przyczyn niedostępności | `FAIL` — brak jawnego zakresu uprawnień | `FAIL` — obrys GDPR crimson mimo komunikatu zgodności, nie blokady | `2 z 5` |

Wynik łączny: `13 z 25` cech. Żadna z `5 z 5` powierzchni nie osiąga `5 z 5`.

### Dodatkowe kontrole każdego zrzutu

- Ucięcia: brak krytycznego ucięcia w `20 z 20`; pełne strony zapisano jako `fullPage`.
- Surowe identyfikatory: `USER` w stanie MEMBER; adresy `@local.test` są jawnymi danymi fixture, nie identyfikatorem technicznym.
- Format dat/liczb: Regionalizacja pokazuje `29/08/2026`, `16:31`, `1234,56 zł`, `1 234 567,89`; `4 z 4` zgodne z fixture.
- Licznik kontra zawartość: Bezpieczeństwo `0%` przeczy co najmniej aktywnej sesji i prezentowanym statusom; `FAIL`.
- Motywy: emulacja systemowa nie zmienia motywu produktu. OWNER pozostaje jasny w `10 z 10`, MEMBER pozostaje ciemny w `10 z 10`. To nie jest dowód dwóch motywów; K3 pozostaje częściowe.

## 8. Korekty wobec instrukcji

### KOR-124-01 — baza docelowa kontra seeder

§0.2c nakazuje `POSTGRES_DB=consultify_w3_settings_owner_day124`. Seeder, linie 181–182, nakazuje: `if (await databaseExists(...)) fail('target database already exists; reset it first')`, po czym sam wykonuje `CREATE DATABASE`. Te dwa warunki wykluczają się. Bezpieczna interpretacja: kontener utworzył wyłącznie administracyjną bazę `postgres`, a licencjonowany seeder utworzył bazę docelową, wykonał migracje i zapisał marker. Nie zmieniono seedera ani produktu.

### KOR-124-02 — §0.4a nie istnieje

Z24 i §0.1 odsyłają do `§0.4a`, ale wydana instrukcja ma 674 linie i przechodzi z §0.2d bezpośrednio do §0.5. Nie ma treści komendy pomiarowej §0.4a. Nie wymyśliłem zastępczego zakresu testów. Zakres zmian jest wyłącznie dokumentacyjny, a brak sekcji pozostaje `EVIDENCE_MISSING`.

### KOR-124-03 — B.3 „dowód mutacyjny” w tabeli STOP

Tabela STOP nazywa B.3 „dowodem mutacyjnym w obie strony”, podczas gdy faktyczne B.3 nakazuje oględziny zrzutów, a §A i §D zabraniają napraw oraz zmian kodu. Zastosowałem bezpieczniejszą interpretację: B.3 to ręczna ocena 20 z 20 zrzutów; nie mutowałem produktu.

### KOR-124-04 — dwa motywy nie zostały udowodnione

Nie zapisywałem preferencji motywu przez UI, ponieważ runtime wg §0.2b miał służyć wyłącznie do odczytu. Bezstanowa emulacja systemowego motywu nie wpłynęła na produkt. Wynik jest `PARTIAL`, a nie fałszywe `20 z 20` dwóch motywów.

## 9. Pułapki Z33

Pakiet był browserowy, nie testowy. Dotyczyły go: (a) `ENABLE_V8_GLOBAL=true`, co potwierdza runtime manifest; (d) `ENABLE_TEST_AUTH_BYPASS=false`, także w manifeście; (c) RealPG potwierdzony skonfigurowaną i rzeczywistą bazą oraz 863 migracjami. (b) nie leżało na mierzonych trasach Settings; nie wykonywano testów Results. (e) trasy ustalono z realnego `routeConfig.ts` i `Gateway.ts`, bez zgadywania katalogu po nazwie.

## 10. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano tablet/mobile: `0 z 1` wymaganych klas urządzeń poza desktopem.
- Nie zweryfikowano a11y klawiaturą ani czytnikiem ekranu.
- Nie zweryfikowano języka EN; dyżur oceniał PL.
- Nie udowodniono dwóch realnych motywów zapisanych na koncie; emulacja systemowa nie steruje motywem produktu.
- Nie wykonano żadnego zapisu przez UI ani cold readbacku po zapisie; runtime był read-only.
- Nie zweryfikowano wszystkich podtras `/settings/*`; macierz obejmuje dokładnie `5` powierzchni.
- Nie zweryfikowano HTTP statusów każdego wewnętrznego requestu; potwierdzono `3 z 3` endpointów startowych runtime i `0` błędów/ostrzeżeń konsoli.
- Nie wykonano owner guided replay ani decyzji właściciela na tym SHA.
- Nie wykonano pomiaru z nieistniejącego §0.4a.

## 11. K7 i stan oddania

Dozwolone pliki repo: `2 z 2`; kod produktu: `0` plików. Oczekiwany diff względem markera:

1. `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY124_USTAWIENIA_OWNER_REPORT.md`
2. `docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md`

Werdykt: `PARTIAL`. Świeży pakiet wizualny istnieje, ale nie domyka odbioru całej aplikacji: tylko `12 z 20` zrzutów odpowiada deklarowanym powierzchniom, `0 z 5` powierzchni osiąga `5 z 5` cech, dwa realne motywy nie są udowodnione, a owner replay pozostaje otwarty.

## 12. Sprzątanie zasobów

Po commicie raportowym kanoniczny `stop` nie mógł przejść kontroli tożsamości, ponieważ stan runtime był poprawnie związany z markerem `a1265154…`, a bieżący HEAD był już nowym commitem dokumentacyjnym. Nie obchodziłem strażnika. Zweryfikowałem dokładne PID/PGID i komendy własnych procesów (`53135/53135` — `tsx server/src/index.ts`; `53155/53155` — `vite --port 4915`), zatrzymałem wyłącznie te dwie grupy i potwierdziłem brak listenerów. Kontener `cx-day124-pg` usunięto poleceniem `docker rm -fv cx-day124-pg`. Końcowo porty `6007`, `4914`, `4915`: `3 z 3` wolne. Artefakty poza repo pozostawiono do odbioru.
