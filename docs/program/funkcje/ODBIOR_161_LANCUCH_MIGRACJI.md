---
doc_id: funkcje-odbior-161
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# ODBIÓR 161 — integralność łańcucha migracji

**Klasyfikacja rozdzielona: A na rdzeniu, B na inwentarzu, C na wpięciu bramki.**

Marker `218d020958`, 3 commity, **2 pliki**: bramka `scripts/dev/day161-fresh-migration-check.sh`
+ raport. Żadna migracja nie została ruszona — mimo że dyżur miał do tego prawo.

## ★★ NAJWAŻNIEJSZE: łańcuch od pustej bazy PRZECHODZI

Odtworzone **niezależnie**, na osobnym kontenerze (port 6054), własna migracja od zera:

```text
868/868 success · zero linii ✗ · exit 0
replay: Applying migrations: 0   (idempotentny)
```

Pozycje potwierdzone co do liczby: `day159` na **713**, `gap_closure` na **847**,
**133 pliki między nimi**. To znaczy, że **naprawa z dzisiejszego ranka trzyma**,
a odtworzenie bazy po awarii znowu dochodzi do końca.

## Bramka regresyjna działa — dowód mutacyjny odtworzony

Usunięcie strażnika `ADD COLUMN IF NOT EXISTS metadata` z migracji 159 → bramka
zwróciła **dokładnie** `✗ column k.metadata does not exist`, exit 1. Po przywróceniu
— znów PASS. **To nie jest fasada, bramka realnie wykrywa ten defekt.**

Metodologia inwentarza też jest poprawna: skrypt odtwarza kolejność **z realnego
zapisanego `--dry-run`**, czyli z tego samego porządku, który produkuje migrator —
nie ze zwykłego sortowania nazw. To była moja główna obawa i została rozwiana.

Wszystkie sumy SHA-256 artefaktów zgadzają się z plikami na dysku.

## ★ Co audytor znalazł, a czego wykonawca NIE zgłosił

**Luka w parserze — realna, zmierzona.** Wzorzec wykrywający producenta kolumny
łapie **tylko pierwszą kolumnę** z wieloklauzulowego
`ALTER TABLE x ADD COLUMN a, ADD COLUMN b, ADD COLUMN c`. Skala: **276 z 3278**
wystąpień `ADD COLUMN` (**8,4%**) nie jest w ogóle rejestrowanych jako producent.

Dowód konkretny: `trusted_devices.credential_hash` w `20261039_settings_mfa_challenges.sql`
jest tworzona i czytana w **tym samym pliku**, a mimo to oznaczona jako
`PRODUCER_NOT_PARSED`.

**Audytor napisał poprawiony parser i przeliczył cały korpus:**

| | raport | po korekcie |
|---|---|---|
| `BEFORE_OR_SAME` | 253 | 255 |
| `PRODUCER_NOT_PARSED` | 440 | 438 |
| **`AFTER_CANDIDATE`** | **5** | **5 — te same wiersze** |

**Wniosek wykonawcy się broni** — pięciu kandydatów i werdykt „wszystkie fałszywe
alarmy" przetrwał korektę. Ale błąd był realny i **nieujawniony**.

**Liczba „440" jest myląca.** Rozbicie po nazwie tabeli pokazuje, że **~91%
(około 400)** to odczyty katalogów systemowych Postgresa (`pg_constraint`, `pg_class`,
`pg_attribute`, `information_schema.columns`) albo samoreferencje CTE — **z definicji
zero ryzyka inwersji**. Raport zostawia wrażenie 440 niewiadomych; realnie jest ich
bliżej **zera**. To nie jest kłamstwo, to brak rozbicia — ale czytelnik dostaje
fałszywy obraz skali.

## ★★ C — bramka nie jest wpięta w NIC

```text
$ grep -r day161 package.json .github/workflows/ .husky/
[zero trafien]
```

**To jest dokładnie „biblioteka bez wywołania"** — jedenasty kształt fałszywego
gotowe, nazwany dziś rano. Bramka chroni wyłącznie wtedy, gdy ktoś ją **ręcznie**
uruchomi. Raport **nie wspomina o tym ani słowem** — nawet w sekcji twierdzeń
niezweryfikowanych.

Bezpiecznik, który nie startuje sam, nie jest bezpiecznikiem. **Wpięcie wchodzi
do następnej serii jako pozycja obowiązkowa.**

## Czego NIE zweryfikowano

- Semantyki wszystkich 438 wpisów `PRODUCER_NOT_PARSED` pojedynczo — sprawdzono
  rozkład i próbkę.
- Niezależnych ścieżek `DatabaseInitializer.ts` i `PostgresDatabase.initDb()` —
  **runtime DDL poza plikami migracji**. To jest realna dziura w pokryciu: jeśli
  schemat powstaje też tam, inwentarz go nie widzi.
- Odczytów kolumn **bez aliasu** — poza zasięgiem obu wersji parsera.
- Zachowania trybu `--safe` w migratorze.
- Demo i staging — celowo, zgodnie z zakazem.

## Werdykt

**Do scalenia.** Rdzeń jest mocny i odtworzony niezależnie: łańcuch od zera
przechodzi, bramka wykrywa znany defekt, żadna migracja nie ucierpiała.

Dwie rzeczy do dokończenia, obie nazwane: **wpiąć bramkę** w CI albo hook,
i **poprawić parser** o wieloklauzulowe `ALTER TABLE` przy następnym przebiegu
inwentarza.
