# Sieroty — ćwiczenie pełnego cyklu na kopii · 2026-09-09

**Baza:** wyłącznie kopia lokalna `consultify_kopia_d28` (kontener `consultify-pg18`,
127.0.0.1:54418), utworzona przez `createdb -T consultify_staging_kopia`.
**Staging (thomas), demo (trolley) i produkcja (centerbeam) nie były dotknięte.**
Robotnik nie uruchamiał niczego poza `127.0.0.1`.

---

## 1. Pomiar PRZED

`--dry-run --sieroty` → [`dry-run-przed.log`](dry-run-przed.log),
rozbicie → [`sieroty-per-tabela-przed.csv`](sieroty-per-tabela-przed.csv).

| Miara | Wartość |
|---|---:|
| Sieroty | **38 715** w **45** tabelach |
| To samo na kopii z 08.09 (D0-RAPORT.md §2.1) | **38 715** — zero rozjazdu |
| Kolumn wskazujących na organizację | 1 285 |
| Suma wierszy CAŁEJ bazy | **164 403** (jak §5 raportu) |

Top 10: `organization_context_claims` 34 210 · `organization_context_items` 1 522 ·
`organization_context_snapshots` 1 434 · `knowledge_doc_versions` 222 ·
`wave6_context_ledger` 143 · `ie_aggregate_state` 123 · `project_role_templates` 120 ·
`my_ideas` 102 · `ie_audit_events` 81 · `ie_command_receipts` 80.

---

## 2. Bramki odmowy

[`guardy.log`](guardy.log) — pięć prób, pięć odmów, wszystkie **przed** nawiązaniem
połączenia z bazą: brak `FORCE_PURGE` · produkcja `centerbeam` (bezwarunkowo) ·
host zdalny bez `ALLOW_REMOTE_PURGE=1` · host zdalny spoza jawnej listy ·
brak `--oczekiwany-host`.

---

## 3. Cykl

| # | Krok | Wynik | Log |
|--:|---|---|---|
| 1 | `--verify --sieroty` przed | **38 715** sierot w 45 tabelach | [01](01-verify-przed.log) |
| 2 | `--sieroty-apply` | manifest **38 862** wiersze (38 715 sierot + 147 dzieci); usunięto **38 841** jawnie; baza 164 403 → 125 537 | [02](02-sieroty-apply.log) |
| 3 | `--verify --sieroty` | **0** sierot w 0 tabelach | [03](03-verify-po-apply.log) |
| 4 | `--rollback=<manifest>` | przywrócono **38 862** wiersze (2 przebiegi) | [04](04-rollback.log) |
| 5 | `--verify --sieroty` | **38 715** sierot w 45 tabelach — jak przed | [05](05-verify-po-rollback.log) |
| 6 | `--sieroty-apply` ponownie | usunięto **38 862**; baza 164 399 → 125 537; poza manifestem **0** | [06](06-sieroty-apply-2.log) |
| 7 | `--verify --sieroty` | **0** | [07](07-verify-po-apply-2.log) |

Różnica 38 841 vs 38 862 w kroku 2: 21 wierszy `my_idea_maps` zdjęła kaskada
`my_idea_maps.idea_id → my_ideas ON DELETE CASCADE`, zanim doszło do ich własnego
`DELETE`. Były w manifeście (snapshot robiony przed transakcją), więc rollback je
przywrócił.

### Granica rollbacku — zmierzona, nie zadeklarowana

Suma wierszy CAŁEJ bazy: **164 403** przed cyklem → **164 399** po `apply` + `rollback`.
**Różnica 4 wiersze**, wskazane z nazwy (diff per tabela wobec świeżej kopii referencyjnej):

| Tabela | Utracone | Rodzic-sierota, FK `ON DELETE CASCADE` |
|---|---:|---|
| `collab_session_events` | 1 | `collab_sessions` |
| `tp_tables` | 1 | `tp_bases` |
| `tp_fields` | 1 | `tp_tables` (wnuk) |
| `tp_views` | 1 | `tp_tables` (wnuk) |

Te tabele nie mają wskaźnika na organizację, więc do manifestu nie wchodzą.
**Dla nich jedynym zabezpieczeniem jest `pg_dump` zrobiony przed operacją.**
Drugi `apply` (krok 6) miał już **0** wierszy poza manifestem — bo rodzice tych
czterech wierszy zostali skasowani za pierwszym razem.

---

## 4. Trzy defekty, które ćwiczenie wywróciło

Każdy trafiłby nadzorcę na stagingu.

1. **Kasowanie utknęło, transakcja wycofana, zero skasowanych.** Sierota potrafi mieć
   własne dzieci przez FK `NO ACTION` w tabeli bez wskaźnika na organizację —
   `ai_chat_runs → ai_chat_run_events` (140), `teresa_proposals → teresa_audit_log` (7).
   Nikt ich nie kasował, więc rodzic odmawiał w każdym przebiegu.
   → dodane domknięcie po dzieciach, z dziećmi w manifeście.
2. **Rollback przewrócił się na `out of shared memory`.** `SAVEPOINT` przed każdym
   z 38 862 wierszy wyczerpał tablicę blokad; przywrócone **zero**.
   → jeden savepoint na paczkę, paczka maleje 500 → 100 → 20 → 5 → 1.
3. **Rollback odmówił 53 wierszy: `invalid input syntax for type json`.** Sterownik `pg`
   zwraca `jsonb` rozparsowany; tablica JS wraca do bazy jako literał tablicy Postgresa,
   nie jako JSON. Trafione: `document_studio_templates` (44), `ie_initiative_card_versions` (9).
   → wartości kolumn `json`/`jsonb` serializowane ręcznie. **Ta sama pułapka siedziała
   w rollbacku organizacji** — próbka 345 wierszy z 08.09 jej nie trafiła.

---

## 5. Komenda dla nadzorcy (host zdalny)

Kolejność obowiązkowa: **dump → dry-run → akcept → apply → verify**.

```bash
# 0) DUMP — jedyne zabezpieczenie wierszy spoza manifestu. Bez niego nie ruszać.
pg_dump -Fc "$URL_STAGING" -f ~/Developer/dumpy/dump-przed-sieroty-<data>.dump

# 1) POMIAR
DATABASE_URL="$URL_STAGING" ALLOW_REMOTE_PURGE=1 \
  npx tsx scripts/dane/usun-organizacje.ts \
    --oczekiwany-host thomas --verify --sieroty

# 2) KASOWANIE (dwa klucze: --sieroty-apply + FORCE_PURGE=true)
DATABASE_URL="$URL_STAGING" ALLOW_REMOTE_PURGE=1 FORCE_PURGE=true \
  npx tsx scripts/dane/usun-organizacje.ts \
    --oczekiwany-host thomas --sieroty-apply \
    --manifest-dir ~/Developer/dowody-sieroty/manifesty

# 3) SPRAWDZENIE
DATABASE_URL="$URL_STAGING" ALLOW_REMOTE_PURGE=1 \
  npx tsx scripts/dane/usun-organizacje.ts \
    --oczekiwany-host thomas --verify --sieroty     # oczekiwane 0

# 4) COFNIĘCIE (ścieżkę manifestu skrypt wypisuje na końcu kroku 2)
DATABASE_URL="$URL_STAGING" ALLOW_REMOTE_PURGE=1 \
  npx tsx scripts/dane/usun-organizacje.ts \
    --oczekiwany-host thomas --rollback=<manifest.json>
```

`--manifest-dir` poza repozytorium jest **zalecane**: manifest 38 715 sierot waży
**29,7 MB** i do gita nie należy. Bez tej flagi ląduje w
`evidence/dane-pokazowe-en/sieroty/manifest-<data>.json`.

Produkcja (`centerbeam`) jest odrzucana zawsze i nie ma zmiennej, która to odblokuje.
