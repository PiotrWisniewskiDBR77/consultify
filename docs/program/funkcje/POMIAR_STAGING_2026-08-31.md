---
doc_id: funkcje-pomiar-staging-20260831
status: canonical
owner: piotr
truth_type: runtime
established: 2026-08-31
---

# Pomiar stagingu 31.08.2026 — nadzorca, sesja TYLKO-DO-ODCZYTU

Za zgodą właściciela (31.08). Sesja `SET default_transaction_read_only=on`,
zero zapisów, produkcja `consultify.ai` nietknięta.

## ★ BŁĄD AUTORSKI NADZORCY — pierwsza próba trafiła w NIEWŁAŚCIWĄ BAZĘ

Projekt `consultify` ma w środowisku `staging` **dwie** usługi Postgresa
(`Postgres` i `pgvector`) plus `Postgres-Rehearsal-*`. Nadzorca odpytał `Postgres`
i zobaczył: brak `ie_aggregate_state`, `tasks` = 0 wierszy, 478 migracji, ostatnia
z **5 lipca**. Prawie zameldował to właścicielowi jako „staging jest dwa miesiące
za kodem".

**Zatrzymała to niezgodność z pomiarem M3** (467 zadań), zrobionym kilka godzin
wcześniej. Sprawdzenie, której bazy używa aplikacja — odczyt `DATABASE_URL`
usługi `consultify`, nie zgadywanie po nazwie — wskazało **`pgvector`**.

Usługa `Postgres` jest martwym, nieużywanym obiektem o mylącej nazwie.
**Reguła: nie identyfikuj bazy po nazwie usługi. Odczytaj, czego używa aplikacja.**

## Wynik na WŁAŚCIWEJ bazie (`pgvector`, staging)

| pomiar | wartość |
| --- | --- |
| migracje zastosowane | **964**, ostatnia 31.08 o 12:59 |
| `tasks` (legacy) | **467** — zgodne z M3, potwierdza właściwą bazę |
| `ie_aggregate_state` | **240** |
| `legacy_task_cutover_ledger` | **nie istnieje** (migracja z 204 jeszcze niewdrożona) |
| `ai_knowledge_embeddings` | **0** |

## Odpowiedź na pytanie, po które szedł ten pomiar

**Czy brak kolumn zgasi bazę wiedzy na stagingu? NIE.** Wszystkie siedem kolumn
istnieje: `scope`, `ai_visibility`, `sensitivity`, `owner_id`, `project_id`,
`metadata`, `indexed_at`. Ryzyko zamknięte.

## ★ Znalezisko, po które ten pomiar NIE szedł — i ważniejsze

Rozkład zasięgu w `knowledge_docs` na stagingu:

| zasięg | dokumentów |
| --- | --- |
| `user` (prywatne) | **285** |
| `project` | **6** |
| `organization` | **0** |

**Ani jeden dokument nie jest wiedzą wspólną organizacji.** To jest dokładnie
skutek defektu opisanego w karcie 213: insertery nie ustawiały zasięgu jawnie,
więc kolumna brała wartość domyślną `'user'`. Konsekwencja produktowa: **Teresa na
stagingu nie widzi z bazy wiedzy praktycznie nic** — 285 z 291 dokumentów jest
zamkniętych jako czyjeś prywatne, a indeks embeddingów jest pusty (0 wierszy).

To nie jest hipoteza — to zmierzony stan powierzchni, na której odbieramy pracę.
FIX-213 naprawia przyczynę na przyszłość; **istniejące 285 dokumentów wymaga
osobnej decyzji właściciela**: przypisać im zasięg organizacji wstecz czy zostawić.

## Wpływ na pilot migracji (D-13)

`legacy_task_cutover_ledger` nie istnieje na stagingu — pilot wymaga wdrożenia
migracji z dyżuru 204. To jest krok wdrożeniowy, nie odczyt, i wymaga osobnej
zgody właściciela.
