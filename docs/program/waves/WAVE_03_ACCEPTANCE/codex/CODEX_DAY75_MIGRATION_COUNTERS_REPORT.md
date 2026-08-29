# CODEX DAY 75 — LICZNIKI MIGRACJI — RAPORT

Stan: **PARTIAL** — rdzeń `4 z 4`, K1–K4 i K6 spełnione; K5 pozostaje
`NIEZWERYFIKOWANE`, ponieważ nie zachowałem przebiegu nazw testów sprzed pierwszej zmiany.

## Baza pracy i marker

```text
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/codex/m03-admin-20260824 \
  && echo "MARKER OK" || echo "MARKER BRAK"
MARKER OK

git -C "$WT" rev-parse HEAD
b4c883b9ec488b12733839820304bbba6f8be640

git -C "$WT" status --short | head -3
<brak wyniku>
```

Na `/` było `96 GiB` wolnego. Tip gałęzi bazowej uciekł przed rozpoczęciem o:

```text
d0d08b3e5a docs(instrukcje): dyzur 76 Materialy — macierz 20/20 + rozstrzygniecie 8 znanych defektow
8d254e6bae docs(instrukcje): dyzur 74 (Finanse — dowod merytoryczny) i 75 (naprawa licznikow migracji)
```

Różnica nazw obejmowała wyłącznie trzy instrukcje dyżurów 74–76. Zgodnie z §0.1
pracowałem dokładnie z markera; bez rebase.

## Weryfikacja wejścia W1–W4

W1 odtworzył `4 z 4` przypięte liczniki:

```text
116:      migrations: 831,
   ^^ scripts/dev/seed-wave3-my-work-owner-review-owned.mjs
466:      successful_migrations: 831,
   ^^ server/scripts/seed-wave3-assessment-owner-review.ts
780:      successful_migrations: 858,
   ^^ server/scripts/seed-wave3-initiatives-owner-review.ts
589:    if (Number(rb.successful_migrations) !== 831)
   ^^ server/scripts/seed-wave3-organization-owner-review.ts
```

W2 potwierdził istniejący wzorzec minimum `< 800`. W3 potwierdził wzorzec
Finansów: `< 834` oraz `migrations: Number(readback.migrations)`. W4 zwrócił
`1068` plików SQL (`1068 z 1068` policzonych przez glob).

## K1/K2 — naprawy 4 z 4 i pełne diffy

### B.1 Organizacja — 2 linie źródłowe

Przed: próg dokładny `831`. Po: minimum `831`; rzeczywisty licznik pozostaje w
`rb.successful_migrations` i trafia do manifestu.

```diff
diff --git a/server/scripts/seed-wave3-organization-owner-review.ts b/server/scripts/seed-wave3-organization-owner-review.ts
@@
-    if (Number(rb.successful_migrations) !== 831)
-      fail(`fresh migration ledger expected exactly 831, got ${rb.successful_migrations}`);
+    if (Number(rb.successful_migrations) < 831)
+      fail(`fresh migration ledger expected at least 831, got ${rb.successful_migrations}`);
```

### B.2 Inicjatywy — 2 linie źródłowe

Przed: zwracana/asertowana stała `858`. Po: minimum `858` i rzeczywisty pomiar
`Number(r.successful_migrations)`.

```diff
diff --git a/server/scripts/seed-wave3-initiatives-owner-review.ts b/server/scripts/seed-wave3-initiatives-owner-review.ts
@@
     ).rows[0];
+    if (Number(r.successful_migrations) < 858) fail(`expected at least 858 successful migrations, got ${r.successful_migrations}`);
     const expected = {
@@
-      successful_migrations: 858,
+      successful_migrations: Number(r.successful_migrations),
```

### B.3 Ocena — 2 linie źródłowe

Przed: zwracana/asertowana stała `831`. Po: minimum `831` i rzeczywisty pomiar
`Number(r.successful_migrations)`.

```diff
diff --git a/server/scripts/seed-wave3-assessment-owner-review.ts b/server/scripts/seed-wave3-assessment-owner-review.ts
@@
     ).rows[0];
+    if (Number(r.successful_migrations) < 831) fail(`expected at least 831 successful migrations, got ${r.successful_migrations}`);
     const exp: any = {
@@
-      successful_migrations: 831,
+      successful_migrations: Number(r.successful_migrations),
```

### B.4 Moja Praca — 2 linie źródłowe

Przed: dokładne `831` i zwracane `831`. Po: minimum `831` i zwracany rzeczywisty `n`.

```diff
diff --git a/scripts/dev/seed-wave3-my-work-owner-review-owned.mjs b/scripts/dev/seed-wave3-my-work-owner-review-owned.mjs
@@
-    if (n !== 831) fail(`expected 831 successful migrations, got ${n}`);
+    if (n < 831) fail(`expected at least 831 successful migrations, got ${n}`);
@@
-      migrations: 831,
+      migrations: n,
```

Mianownik licencji: `4 z 4` plików ma najwyżej dwie zmienione linie źródłowe.
Nie zmieniono żadnej innej asercji ani bramki fixture'u.

## Z30 — brak wysyłki

Przed pierwszym zapisem:

```text
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL|SMTP_ENABLED)" || echo "BRAK ZMIENNYCH POCZTY"
BRAK ZMIENNYCH POCZTY

SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)

grep ... server/src/Gateway.ts
<0 trafień>
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane.

## B.5/K4 — realny fixture Organizacji

Kontrakt przeczytany przed wykonaniem: komenda `seed` sama tworzy bazę
`consultify_w3_organization_owner_*`, zapisuje marker własności, uruchamia
`npm run db:migrate:strict`, seeduje i wykonuje dwa readbacki. Osobna komenda
`readback` odczytuje już gotową bazę. Nie uruchamiałem pozostałych trzech fixture'ów.

Kontener: `cx-day75-pg`, wyłącznie `127.0.0.1:5947`, obraz
`pgvector/pgvector:pg16`. Pełny migrator na bazie kontrolnej przeszedł, drugi
przebieg miał `Applying migrations: 0`. Niezależny odczyt:

```text
status  | count
success | 863
```

Końcowy osobny readback:

```text
READBACK_EXIT=0
"fixtureId": "W3-ORGANIZATION-OWNER-v1"
"databaseName": "consultify_w3_organization_owner_day75"
"successful_migrations": 863
```

Pułapki Z33: (a), (b) i (d) nie są bramkami tego skryptu fixture; mimo to komplet
env miał `ENABLE_V8_GLOBAL=true`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` i
`ENABLE_TEST_AUTH_BYPASS=false`. (c) wyłączono przez jawne
`MOCK_DB=false DB_TYPE=postgres` w tej samej linii; log zawiera
`DB_IDENTITY ... 127.0.0.1:5947/consultify_w3_organization_owner_day75`.
(e) wyłączono przez odczyt funkcji `seed`: tworzenie bazy i migracja występują
właśnie pod komendą `seed`, nie pod osobnym `provision`.

## K3 — kompilacja produkcyjna

```text
NODE_OPTIONS="--max-old-space-size=3072" ../node_modules/.bin/tsc --build tsconfig.build.json
COMPILE_EXIT=0
```

## Testy i K5

Końcowy przebieg z `RUN_DB_TESTS=0 MOCK_DB=true`, `--retry=0`, reporterem JSON:
`22 z 22` nazw przypadków ma status `passed`; `0 z 22` jest czerwonych.
Pakiety są tekstowymi/jednostkowymi kontraktami i nie otwierają bazy. Pułapki
Z33 (a)–(e) nie leżą na ich ścieżce; dowodem jest odczyt testów: używają
`readFileSync` lub wywołują wyłącznie lokalne guardy przed połączeniem.

Lista „zielony przed / czerwony po": **PUSTA w dostępnym pomiarze końcowym**.
K5 jako porównanie dwóch zapisanych JSON-ów: **NIEZWERYFIKOWANE** — nie zachowałem
JSON-u sprzed pierwszej zmiany. Nie rekonstruuję go retroaktywnie i nie opisuję
wnioskowania jako pomiaru.

## Artefakty poza repo

```text
34339d7f05fba0b166d29e145314aeb1bd416c552b84cf35e707e3de83a020b4  /private/tmp/cx-day75-artefakty/migrate-first.log
bb39269ea28184bdf8a13b551e3ac802e55cd17507e11274010982701486506b  /private/tmp/cx-day75-artefakty/migrate-second.log
3488ce61a2229c5d5dc8fa49ba3d09ca5f2d9632a0076bfd6be1048ae29a81d2  /private/tmp/cx-day75-artefakty/organization-seed.log
5d1862dc1936b3e5e5f7abe6060649f9bf1a1034911cd7158614991ffadbd72b  /private/tmp/cx-day75-artefakty/organization-readback-final.log
a0c8839adc8d3b2b68c7fdcc465bb61b144d957d36423b6d68f7343d08e630d7  /private/tmp/cx-day75-artefakty/organization-owner-day75.json
6b555b9cac050b4b9099f4c9fb9bcbec3eaec77b47aadc4b756c34fc8bb7974a  /private/tmp/cx-day75-artefakty/relevant-after-final.json
```

## Korekty wobec instrukcji

1. K3 zamawia `rm -rf dist`, lecz warstwa wykonawcza odrzuciła komendę przed
   uruchomieniem. Bezpieczniejsza interpretacja: istniejący `server/dist`
   przeniesiono do `/private/tmp/cx-day75-scratch`, po czym wykonano build od zera.
2. Pierwszy pośredni wariant B.2/B.3 jedynie zwracał pomiar rzeczywisty i przez
   to kontrola migracji była tautologiczna. Czerwony kontrakt Oceny ujawnił błąd.
   Dodano jawne minima, nadal w limicie dwóch linii źródłowych na plik, a końcowy
   przebieg jest `22 z 22` zielony.

## NIEZWERYFIKOWANE

- K5 w ścisłym kształcie porównania dwóch zapisanych list `fullName`: brak JSON-u „przed”.
- Nie uruchomiono fixture'ów Inicjatyw, Oceny ani Mojej Pracy: `0 z 3`, zgodnie z B.5.
- Nie wykonywano dowodu przeglądarkowego, mobilnego, tenantowego ani wydania; nie należą do zakresu.
- Nie weryfikowano Railway, demo, stagingu ani produkcji; kontakt z nimi był zakazany.

## Commity i push

```text
56329a32ca fix(organization): accept current migration ledger
c89ef169cf fix(initiatives): report current migration ledger
d222a05e68 fix(assessment): report current migration ledger
1e73b81a8f fix(my-work): accept current migration ledger
4bad64f3cd fix(initiatives): retain migration floor
cdf73ad82e fix(assessment): retain migration floor
```

Każdy commit został wypchnięty na
`github-backup/codex/day75-migration-counters-20260829`; żadnego pushu na `origin`.
