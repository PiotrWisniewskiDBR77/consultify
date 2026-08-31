---
doc_id: funkcje-odbior-177
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 177 — Partner G08 · STOP CZĘŚCIOWO ZASADNY, wznowienie tanie

0/25 ekranów, 0/50 zrzutów — dyżur stanął na starcie runtime. Odbiór odtworzył
blokadę SAM i poszedł dalej: przyczyną NIE jest port ani seeder, tylko
**niespójność dwóch skryptów** — seeder od 28.08 przyjmuje dowolną bazę
(`--confirm-db`), ale `scripts/dev/start-wave3-owner-runtime.mjs:82` w trybie
adopt-existing nadal wymaga `^consultify_w3_partner_owner_…`. Dyżur użył `cx177`.

**Dowód odbioru:** z bazą `consultify_w3_partner_owner_odbior177` cały łańcuch
(migracje 869 → seed → manifest → runtime 6090/6091) przeszedł end-to-end w 5 minut,
ZERO zmian kodu. Zalecenie raportu („zmienić kontrakt") było cięższe niż potrzeba.

Na plus: zakaz zmian kodu dotrzymany (diff = 2 pliki docs); pierwszy commit błędnie
obwinił port, drugi po 3 minutach **sam się sprostował do przodu** — wzorowo.

## ★ DEFEKT SZKIELETU — dotyczy WSZYSTKICH 16 rodzin
`adoptedFixtureContracts` w `start-wave3-owner-runtime.mjs` ma sztywny prefiks-regex
per moduł, niezsynchronizowany z odpiętymi seederami. **Bezpiecznik od dziś:
generator instrukcji wydaje nazwę bazy Z WBUDOWANYM prefiksem modułu**
(np. `consultify_w3_partner_owner_cx177`), nie gołe `cxNNN`.

## Wznowienie
Ten sam worktree/gałąź, ta sama instrukcja; jedyna zmiana: baza
`consultify_w3_partner_owner_cx177`. Wklejka wydana właścicielowi.
