# FEEDBACK-1 — migracja 20262280 v2

Marker: `[ODMROZENIE 05_INITIATIVES DEC-575]`, `[ODMROZENIE 06_EXECUTION DEC-575]`, `[ODMROZENIE 07_MY_WORK_AGENT DEC-575]`, `[ODMROZENIE 13_CHAT DEC-575]`

Status: **READY FOR INDEPENDENT REVIEW — lokalny dump stagingu przeszedł apply, replay i rollback.**

Base po przeniesieniu paczki: `146e8d2507`.

## Zakres v2 po Wpisie 154

- Manifest dotkniętych kolumn powstaje dynamicznie z `information_schema` i zapisuje tabela.kolumna, typ, PK oraz klasyfikację. Nie ma bramki liczbowej 87. Opcjonalny digest oczekiwanego manifestu daje `WARNING`, nie `STOP`.
- `STOP` pozostaje dla braku PK, dotkniętej kolumny w PK, generated/identity oraz docelowej encji w kluczu obiektu JSON.
- Kolumny tekstowe mają tryb `per_value`: parsowalny JSON jest naprawiany rekursywnie tylko w stringowych wartościach, proza przechodzi dokładny dekoder tekstowy. Mieszane kolumny nie są blokerem.
- Dekoder pracuje do punktu stałego z limitem 64 i dodatkową asercją stabilności. Fixture obejmuje 21 warstw.
- Dokładne `&lt;` / `&gt;` nigdy nie są dekodowane. Zagnieżdżone `&amp;lt;` / `&amp;gt;` są kanonizowane do `&#38;lt;` / `&#38;gt;`, więc nie tworzą nowych dokładnych tokenów ani surowych `<` / `>`.
- `columns_after`, `row_column_pairs_after` i `occurrences_after` pochodzą z pełnego ponownego skanu dynamicznego zbioru kolumn, nie z założenia o wyniku aktualizacji.
- Test RealPG bez `FEEDBACK_20262280_PG_URL` kończy się błędem zamiast `skip`.
- Odczytowy dekoder w `src/services/api.ts` pozostaje kompatybilnym no-opem dla już naprawionych pól idei i inicjatyw; osobny test zachowania obejmuje oba rekordy.

## Dowód RealPG PG18

Kontener: `pgvector/pgvector:pg18`, lokalny port 6455, bez URL stagingu.

- Pełny canonical fresh strict na `pgvector/pgvector:pg18`: **RC=0, 925/925 `success`**, w tym `20262280_feedback1_unescape_entities.sql`; bezpośredni replay runnera: **RC=0, `Applying migrations: 0`**.
- Focused RealPG po poprawkach review: **8/8 PASS**, `--retry=0`.
- Brak `FEEDBACK_20262280_PG_URL`: **RC=1** z jednoznacznym `FEEDBACK_20262280_PG_URL is required; RealPG evidence must never be skipped`; brak wtórnego `TypeError`.
- Fixture: trzy mieszane kolumny JSON/proza, wartość 21-warstwowa, dynamiczny manifest 121 kolumn syntetycznych.
- Test odczytowego no-op: **1/1 PASS**, `--retry=0`.
- Pełny TSC bez limitu po przeniesieniu na bazę `146e8d2507`: front **RC=2 / 169**, serwer **RC=0 / 0**; czysta baza: front **RC=2 / 169**, serwer **RC=0 / 0**; delta regresji **0/0**.
- Fresh i replay: manifest 0, strict no-op.
- Fail-closed: brak PK, PK/generated, encja w kluczu JSON oraz konflikt rollbacku.
- Fixture apply/replay/rollback: backup i changed zgodne, cold readback z innego połączenia, digest po rollbacku równy digestowi przed.

## Dowód na dumpie stagingu 16.09

- Źródło lokalne: `/Users/piotrwisniewski/Developer/kopie/staging-pre-wdrozenie14-20260916T1236.dump`
- Format: `pg_dump -Fc`, 247 MB
- SHA-256: `f3c466ec3fe7889b0a49942fd9487f077c07729388051720c82bc45f5e10647c`

Restore wykonano lokalnie do świeżej bazy PostgreSQL 18 w kontenerze `pgvector/pgvector:pg18`.

- Dynamiczny manifest: **127 kolumn**, digest `2bce84828a1d60e64197f056badc1976`.
- Pary wiersz-kolumna: **4699**; backup **4699**; changed **4699**.
- Docelowe encje: **166049 → 0**.
- Pełny post-scan: `columns_after=0`, `row_column_pairs_after=0`, `occurrences_after=0`.
- Dokładne `&lt;` / `&gt;`: **6421 → 6421**.
- Surowe `<` / `>` w zmienionych wartościach: **621 → 621**.
- Cold readback: pięć rekordów `feedback_items.description` odczytanych z tabeli aplikacyjnej po PK; przykłady `&quot;` → `"` i `&#x27;` → `'` były widoczne w nowym połączeniu.
- Replay: dynamiczny manifest 0, `strict no-op`, backup/changed pozostały **4699/4699**, digest kopii pozostał `4b2cca9ddb0564fa3a3226f06684d65a`.
- Rollback: **4699** przywróconych, `hash_mismatches=0`, digest dowodu rollbacku `85f0cb6045d35aa721a039f53c73d593`; stan runu `ROLLED_BACK`, digest kopii bez zmiany.

## Granice

Nie wykonano żadnego zapisu na staging/demo, deployu ani operacji Railway. Dowód powstał wyłącznie na lokalnym restore autoryzowanego dumpu.
