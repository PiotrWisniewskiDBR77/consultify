# D-03 / QD16 etap 1 — KROK 0: pomiar przed napisaniem migracji

Stanowisko D (Qoder), 2026-09-19 05:00 CDT. Zlecenie: `KOLEJKI-DO-KONCA-20260918.md:105` poz. QD16 + `[D] Wpis 214` (kolejność D) + `[WSZYSCY] Wpis 223` (linia `236320b143`).
Dług: `DLUG-PO-MVP.md:13` — „`created_at` typu `text` w 270 z 1448 tabel stagingu (porównania leksykalne kłamią)", P3/L, DEC-660, przejęte od Codex-2 B12.

Wszystko poniżej zmierzone na **kopii** dumpu `~/Developer/kopie/staging-auto-20260919T0330.dump` (kontener `qoder-d-pg-7`, PostgreSQL 18.6, `127.0.0.1:6636`, baza `consultify_qd16`), NIE na żywym stagingu — Wpis 219: w trakcie wdrożenia 31 staging nie jest źródłem prawdy, a wdrożenie 31 nie zawiera żadnej migracji, więc schemat z dumpu deploymentu 30 jest aktualny.

Skrypty: `krok0-baza.sh` (baza, sekcje A–I) i `krok0-kod.sh` (kod, sekcje J–N); wyniki: `krok0-baza-wyniki.txt`, `krok0-kod-wyniki.txt`. Hasła w skryptach nie ma (REGUŁA 10) — bierze je zmienna środowiska `PGPASSWORD`.

---

## 1. Premisa długu: liczby się zgadzają, ale denominatry są inne

| pomiar | wartość |
|---|---|
| tabel bazowych w `public` | **1903** |
| `created_at` typu `text` | **272** |
| `created_at` typu `timestamp*` | 1183 |
| tabel bez kolumny `created_at` | 450 |

DLUG mówi „270 z 1448" — kierunek ten sam, denominatory z innego pomiaru (1448 ≠ 1903). Do dalszej pracy biorę **własny pomiar**: 272 tabel z `created_at text`.

## 2. Filtr etapu 1 zlecenia: „tabele bez FK i bez triggerów"

| filtr | odrzuconych |
|---|---|
| FK (jako odnosząca się LUB wskazywana) | 119 |
| trigger nie wewnętrzny (`NOT tgisinternal`) | 2 |
| **pula etapu 1** | **152** |

## 3. Wartości niepasujące — 0, z mutacją przyrządu

Zlecenie: „`USING created_at::timestamptz` z jawnym raportem wartości niepasujących (0 albo lista)". Pomiar całej puli 152 per tabela, `pg_input_is_valid(created_at,'timestamptz')`:

| pomiar | wartość |
|---|---|
| tabel zmierzonych | 152 |
| **tabel z wartościami niepasującymi** | **0** |
| **wierszy niepasujących łącznie** | **0** |
| tabel pustych w puli | 94 |

Mutacja przyrządu (żeby „0" było pomiarem, nie ciszą): `safe_tstz('to-nie-data')` → NULL, `safe_tstz('')` → NULL, `safe_tstz('1726000000')` → NULL (epoch jako tekst odrzucony), `safe_tstz('2026-09-19T04:00:00.000Z')` → wartość, `pg_input_is_valid('to-nie-data','timestamptz')` → false. Przyrząd odrzuca śmieci, więc `0` znaczy `0`.

## 4. Co mogłoby zablokować `ALTER COLUMN … TYPE` (pula 152)

| pomiar | wartość |
|---|---|
| PRIMARY KEY / UNIQUE na `created_at` | 0 |
| CHECK odwołujący się do `created_at` | 0 |
| tabele partycjonowane | 0 |
| kolumny generowane | 0 |
| widoki zależne od tych tabel | 0 |
| indeksów na `created_at` | 30 (przebudowywane przez `ALTER TYPE` automatycznie) |
| `created_at NOT NULL` | 112 |

## 5. Ryzyko po stronie kodu — prawdziwe ryzyko D-03

Po konwersji `node-pg` zwraca `Date`, nie `string`. Zmierzone:

| pomiar | wartość |
|---|---|
| operacji łańcuchowych JS na `created_at` (`slice/substring/split/startsWith/replace/trim/toLocale*`) w `server/src` | **0** |
| …w `src` (front) | **0** |
| jedyny tekstowy odczyt w serwerze | `server/src/services/ai/engagementSummaryService.ts:250` — `created_at?.slice(0, 10)`, tabela `deep_thinking_decisions` (poza etapem 1) |
| tekstowych operacji SQL na `created_at` (`substr/length/date/datetime/strftime/||/LIKE/::text`) | **119 trafień w 54 plikach** |
| tabel z puli 152 występujących w którymś z tych 54 plików | **37 → odrzucone z etapu 1** |
| **pula bezpieczna** | **115** |

Uzupełnienie: 3 tabele z puli bezpiecznej mają odwołania w `src` wyłącznie w **komentarzach** (`MeetingObjectPage.tsx:253,1989`, `api.ts:127` dla `meeting_participants`; `LinkInitiativeModal.tsx:5` dla `v8_initiative_economics_linkages`) — brak kodu, brak ryzyka.

## 6. `DEFAULT` — sześć odmian, pięć z nich wymaga decyzji

| `column_default` na `created_at` (pula 152) | tabel |
|---|---|
| `now()` | 71 |
| `CURRENT_TIMESTAMP` | 41 |
| (brak) | 34 |
| `to_char((now() AT TIME ZONE 'UTC'), 'YYYY-MM-DD HH24:MI:SS')` | 3 |
| `(now())::text` | 2 |
| `'2026-03-03 18:30:11.358808+00'::timestamptz` | 1 |

Dwie ostatnie odmiany produkują **tekst**, więc `ALTER COLUMN … TYPE timestamptz` nie przepuści ich domyślnie („default … cannot be cast automatically") — migracja musi je zdjąć i zastąpić `now()`. Etap 1 obejmuje po jednym przykładzie każdej odmiany, żeby wzorzec był sprawdzony przed etapem 2+.

## 7. Kształt przechowywanych wartości i wierność `.down.sql`

Dwie odmiany tekstu w danych (oba castują się poprawnie):

| kształt | przykład |
|---|---|
| `ISO-Z` (`YYYY-MM-DDTHH:MI:SS.mmmZ`, 3 cyfry ułamka) | `2026-07-05T12:14:57.993Z` |
| `KANON` (kanoniczny tekst PG `YYYY-MM-DD HH:MI:SS.uuuuuu+00`) | `2026-04-25 17:59:50.953169+00` |

Round-trip mierzony dla wszystkich wierszy kandydatów etapu 1 (przy `TIME ZONE 'UTC'`):

| kształt | tabel | wierszy | diff dla `created_at::text` | diff dla `to_char(… AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` |
|---|---|---|---|---|
| ISO-Z | 5 | 619 | 619 (nie ta forma) | **0** |
| KANON | 16 | 5256 | **0** | 5256 (nie ta forma) |
| PUSTA | 4 | 0 | 0 | 0 |

Wniosek do projektu rollbacku: `.down.sql` musi oddawać tekst **formą dobraną per tabela** (KANON → `created_at::text` przy `SET TIME ZONE 'UTC'`, ISO-Z → `to_char`), wtedy powrót jest bajt w bajt. Jedna wspólna forma zniszczyłaby 619 albo 5256 wartości tekstowych.

## 8. `plan_baselines` wypada z etapu 1 — mieszane kształty w jednej tabeli

| id | `created_at` | długość |
|---|---|---|
| `5c80c706356e4a129b7cdd98b6f60ded` | `2026-06-24 16:23:55.950954+00` | 29 |
| `a8f7f74f-950e-5d51-a9ad-e39b334cbfc0` | `2026-09-08T00:00:00Z` | 20 |
| `92707eec-3a29-5d8e-a2bf-7d28e37ce72e` | `2026-09-08T00:00:00Z` | 20 |

Wartości **castują się bez błędu** (0 niepasujących), ale żadna pojedyncza forma `USING` w rollbacku nie odda obu kształtów bajt w bajt (drugi i trzeci wiersz mają ISO-Z **bez** ułamka sekundy). Żeby etap 1 nie niósł rollbacku zmieniającego dane, tabela idzie do późniejszego etapu z jawną decyzją, a nie „przy okazji".

## 9. Etap 1 = 25 tabel (zlecenie: 20–30)

`tabele-etap1.txt` — kolumny: tabela | wiersze | niepasujące | kształt | `DEFAULT` | round-trip diff.
Skład: 21 tabel z danymi (5875 wierszy łącznie: 5256 KANON + 619 ISO-Z) i 4 puste; po jednym przedstawicielu każdej z sześciu odmian `DEFAULT`; 0 wierszy niepasujących w każdej z nich.

## 10. Dwa ustalenia, które zmieniają projekt migracji (nie zlecenie)

1. **Migracja musi być idempotentna, bo zostanie zastosowana dwa razy.** `MIGRATION_PATTERN = /^(7\d{2}|\d{8})_.*\.sql$/` (`server/src/services/tablePlatform/migrationIdentity.ts:56`) łapie także pliki ośmiocyfrowe, więc `20262305_*.sql` trafi i do łańcucha `migrate.postgres.ts`, i do łańcucha Table Platform stosowanego przy starcie przez `DatabaseInitializer` (pomiar z PREFLIGHT-32: `tp_chain_no_pending` 154 → 155 po wejściu `20262304` na linię, w `tp_migration_history` 0 wierszy `20262304%`). Każdy krok `ALTER` dostaje więc warunek `data_type = 'text'`, żeby drugi przebieg był pustym obiegiem.
2. **SQLite tej migracji nie czyta**: `discoverTablePlatformMigrationFiles` + `runTablePlatformMigrations` są oznaczone „PostgreSQL only — SQLite does not support the table platform" (`server/src/database/DatabaseInitializer.ts:3179-3200`), a `migrate.postgres.ts` jest torem PG. Składnia PG (`::timestamptz`, `DO $$`) jest bezpieczna — tak samo jak w `20262304`.

## 11. Czego KROK 0 NIE rozstrzyga

- numeru z puli: `20262304` jest zajęty przez D-136 (na linii `236320b143`), więc etap 1 bierze **`20262305`**;
- zachowania 119 tekstowych operacji SQL w 54 plikach — one dotyczą tabel z **późniejszych** etapów (37 odrzuconych + 119 z FK); każda z nich będzie wymagała osobnego przeglądu przy swoim etapie, nie teraz (DEC-607: poza zleceniem = jedno zdanie, zero naprawy).
