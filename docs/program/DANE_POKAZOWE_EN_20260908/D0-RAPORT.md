# D0 — raport z dry-run · STOP przed `--apply`

**Data:** 2026-09-08 · **Gałąź:** `mvp/dane-d0-purge` · **Baza:** wyłącznie kopia
lokalna `consultify_kopia_d0` (kontener `consultify-pg18`, 127.0.0.1:54418).
Staging (thomas), demo (trolley) i produkcja (centerbeam) **nie były dotknięte**.

**Nic nie zostało skasowane.** `--apply` na pełnej liście NIE został uruchomiony.
Ten dokument jest wejściem do decyzji właściciela.

---

## 1. Dump „przed" — jest, ma rozmiar

```
-rw-r--r--  27 156 334 bajtów (25,9 MiB)  2026-09-08 08:35
/private/tmp/dane-pokazowe-en/dump-przed-20260908.dump
sha256 26070ddb75dd7c486415aa356c26b2766bc7e3656de64d445f7ad2b10126c186
```

Format `pg_dump -Fc` (custom, do `pg_restore`). **Celowo poza repozytorium** —
zrzut bazy nie wchodzi do gita.

---

## 2. Wynik dry-run — i dlaczego NIE jest to 70 000

Pełne wyjście: [`evidence/dane-pokazowe-en/dry-run-20260908.log`](../../../evidence/dane-pokazowe-en/dry-run-20260908.log).
Rozbicia: [`dry-run-per-tabela`](../../../evidence/dane-pokazowe-en/), `dry-run-per-organizacja`, `sieroty-per-tabela`.

| Miara | Wartość |
|---|---:|
| Organizacji na liście | **325** |
| Znalezionych w bazie | **325** (0 nieistniejących) |
| Kolumn wskazujących na organizację (odczytane z bazy) | 1285 |
| Z tego z FK `NO ACTION`/`RESTRICT` | 100 |
| **Wierszy do usunięcia** | **30 659** w 105 tabelach |

**PLAN.md §D0 stawiał warunek „dry-run raportuje ≥ 70 000 wierszy". Ten warunek
jest niespełnialny i opiera się na błędzie w pomiarze.** Poniżej dowód.

### 2.1 Skąd wzięło się 70 656 w PLAN.md

`POMIAR.sql` Q4/Q7 liczyły *„wiersze, których `organization_id` NIE JEST na liście
6 realnych + `demo-org`"*. Ten warunek prawdziwy jest w trzech różnych sytuacjach,
a plan potraktował je jako jedną:

| Składnik | Wierszy | Czy purge organizacji to usunie? |
|---|---:|---|
| Należą do 325 organizacji z listy | **30 659** | **TAK** |
| **Sieroty** — `organization_id` wskazuje na organizację, której w `organizations` **już nie ma** | **38 715** | **NIE** — nie należą do żadnej organizacji, kaskada ich nie dosięga |
| `organization_id IS NULL` | 1 282 | **NIE** |
| Razem | **70 656** | — |

30 659 + 38 715 + 1 282 = **70 656** — dokładnie liczba z planu. Liczby zgadzają
się co do jednego wiersza, więc to nie jest hipoteza, tylko rozłożenie tej samej
sumy na składniki.

Weryfikacja niezależna (zapytanie SQL uruchomione osobno, nie przez skrypt):

```
wierszy_z_org_id | org_istnieje | sieroty | należy_do_6_zachowanych | należy_do_325
        122 215  |      83 500  | 38 715  |                 52 841  |       30 659
```

`52 841` zgadza się z POMIAR.md §2.1 co do wiersza — ten sam pomiar, ta sama baza.

### 2.2 Top 10 tabel do usunięcia (organizacje z listy)

| # | Tabela | Wierszy |
|---:|---|---:|
| 1 | `collab_sessions` | 4 800 |
| 2 | `v8_consumer_tool_policies` | 3 384 |
| 3 | `v8_tool_catalog` | 3 384 |
| 4 | `tool_session_presence` | 1 743 |
| 5 | `organization_context_claims` | 1 681 |
| 6 | `organization_context_items` | 1 660 |
| 7 | `my_ideas` | 1 631 |
| 8 | `organization_members` | 1 403 |
| 9 | `users` | 1 395 |
| 10 | `v8_output_artifacts` | 1 342 |

### 2.3 Top 5 organizacji

| # | Organizacja | Członków | Wierszy | Tabel |
|---:|---|---:|---:|---:|
| 1 | `demo-org` „Demo Organization" | 1 061 | 14 352 | 34 |
| 2 | `15f69780-…` „PM Test GmbH" | 2 | 1 790 | 40 |
| 3 | `66b9bf21-…` „E2E Tenant (m07-live-2)" | 1 | 650 | 12 |
| 4 | `demo-org-session-d1538cccff-msarpqu3` „Atelier Toys" (klon) | 18 | 344 | 37 |
| 5 | `20e49bc6-…` „E2E Tenant (m06-…)" | 1 | 266 | 24 |

`demo-org` sam odpowiada za 47 % wszystkich kasowanych wierszy.

---

## 3. Trzy sprostowania wobec PLAN.md

Każde zmierzone, nie wywnioskowane.

| # | PLAN.md mówi | Pomiar 2026-09-08 |
|---|---|---|
| 1 | „318 organizacji śmieciowych" | **325**. 331 − 6 zachowanych. Rozbicie z §1 (286 + 32 + 4 = 322) nie sumowało się ani do 318, ani do 325 |
| 2 | „164 FK na `organizations.id`: 129 CASCADE, 8 SET NULL, 27 NO ACTION" (pomiar z 07-19) | **294 FK: 183 CASCADE, 94 NO ACTION, 11 SET NULL, 6 RESTRICT.** Do ręcznego czyszczenia jest **100 kolumn**, nie 27. Skrypt czyta to z `information_schema`, nie ma zaszytej liczby |
| 3 | „70 656 wierszy do usunięcia (57 %)" | **30 659.** Reszta to 38 715 sierot i 1 282 wierszy z `organization_id IS NULL` — purge organizacji ich nie dotyka (§2.1) |

---

## 4. Znalezisko, którego plan nie przewidział: purge zostawia 38 % tenanta

Pierwsza wersja skryptu robiła to, co `cleanup-orphan-demo-orgs.ts`: czyściła
tabele z FK `NO ACTION` i zostawiała resztę kaskadzie. **Próba na jednej
organizacji pokazała, że to za mało.**

Klon „Atelier Toys" (`demo-org-session-d1538cccff-msarpqu3`), 344 wiersze w 37 tabelach:

```
--apply (wersja „kaskada zrobi resztę")  → usunięto organizację
--verify                                  → ZOSTAŁO 131 wierszy w 22 tabelach (38 %)
```

Te 131 wierszy leży w tabelach, które **mają kolumnę `organization_id`, ale nie
mają na niej klucza obcego** (`organization_context_claims`, `v8_tool_catalog`,
`knowledge_docs`, `my_ideas`, `interview_sessions`, `tool_sessions` …). Kaskada
ich nie widzi.

**To jest mechanizm, który wyprodukował 38 715 sierot leżących dziś w bazie.**
Każde wcześniejsze sprzątanie zostawiało po sobie taki osad. Gdybyśmy uruchomili
purge w wersji „kaskada zrobi resztę", dołożylibyśmy do bazy kolejne ~11 tysięcy
sierot zamiast ją posprzątać.

**Naprawione:** skrypt kasuje jawnie z KAŻDEJ tabeli mającej wskaźnik na
organizację (pętla zbieżna, savepoint per tabela), a dopiero na końcu usuwa
wiersz z `organizations`. Po naprawie ta sama próba:

```
--apply  → usunięto 1 organizację i 332 wiersze jawnie
--verify → 0 wierszy w 0 tabelach.  CZYSTO.
```

---

## 5. Rollback — przećwiczony, z podaną granicą

Cykl na jednej organizacji, na kopii:

| Krok | Wynik |
|---|---|
| `--verify` przed | 1 organizacja · **344 wiersze w 37 tabelach** |
| `--apply` | manifest 345 wierszy; usunięto 1 organizację i 332 wiersze jawnie |
| `--verify` po | **0 organizacji · 0 wierszy** |
| `--rollback=<manifest>` | „przywrócono **345** wierszy" (3 przebiegi pętli zbieżnej) |
| `--verify` po rollbacku | 1 organizacja · **344 wiersze w 37 tabelach** — **identycznie jak przed** |

**Granica rollbacku, mierzona, nie deklarowana.** Suma wierszy CAŁEJ bazy przed
próbą: 164 403. Po pełnym cyklu apply→rollback: 164 157. **Różnica 246 wierszy**
to rekordy w tabelach **bez** wskaźnika na organizację, zdjęte kaskadą przez
rodzica (np. komentarz zadania ginie razem z zadaniem). Manifest ich nie obejmuje
i `--rollback` ich nie przywróci — **jedynym zabezpieczeniem dla nich jest
`pg_dump` z §1**. Skrypt wypisuje to ostrzeżenie przy każdym `--apply`.

Po drodze rollback znalazł jeszcze jeden defekt: kolumna generowana
(`assessments.type`, `GENERATED ALWAYS AS`) wraca z `SELECT *`, ale `INSERT` jej
nie przyjmuje — jeden taki wiersz wywracał **całą** transakcję rollbacku.
Naprawione: przed wstawianiem skrypt pyta `information_schema` o kolumny
zapisywalne (`is_generated='NEVER'`).

---

## 6. STOP-y — czego nie wolno bez decyzji właściciela

1. **`--apply` na pełnej liście 325 organizacji.** Nigdzie: ani na kopii, ani na
   stagingu, ani na demo. Warunek: akcept tego raportu.
2. **Los `atelier`, `nordwind`, `vts`, `dbr77`** (pytania P3/P4 z PLAN.md §5).
   Są na liście ZACHOWANEJ i skrypt odmówi ich skasowania. Zmiana tego stanu
   wymaga świadomej edycji `scripts/dane/lista-zachowana.txt` ręką właściciela.
3. **38 715 sierot.** Ich usunięcie to **osobna operacja**, nie purge organizacji.
   Wymaga własnej decyzji, własnego dry-runu i własnego dumpu. `--dry-run --sieroty`
   je policzy i rozpisze na tabele; **skrypt nie ma trybu, który by je kasował.**
4. **Kasowanie martwych tabel** (15 sztuk, 152 wiersze —
   [`martwe-tabele.md`](martwe-tabele.md)). Poza zakresem PLAN.md: usunięcie
   tabeli to migracja destrukcyjna.
5. **Kryterium odbioru „≥ 70 000 wierszy" z PLAN.md §D0 wymaga poprawienia
   na 30 659** — albo świadomego rozszerzenia zakresu D0 o sieroty. Nie da się
   spełnić tego progu uczciwym usuwaniem organizacji.
