---
doc_id: funkcje-odbior-182
status: canonical
truth_type: acceptance
established: 2026-08-31
---

# ODBIÓR 182 — producent sygnałów ON · SCALONO (A)

Zero zmian kodu produktu (test+docs); reprodukcja niezależna: realny zapis do PG
(`work_signal_runs`: PARTIAL, 8 reguł, 2 sygnały), mutacja w obie strony (3/4
czerwone → 4/4), sha256 artefaktów bit-w-bit, inwentarz 8/8 reguł zgodny z kodem.
Oceny: dowód A · zakres A · uczciwość A · inwentarz A · oko na zrzut C.

## Znaleziska odbioru (nie wprowadzone przez 182)
1. ★ **5/8 reguł renderuje surowy `{{value}}`** w treści sygnału — żadna reguła
   nie wypełnia `titleParams`/`bodyParams` (grep: zero trafień w rules/**), więc
   klient dostaje literalny placeholder zamiast liczby dni. **→ dyżur 192.**
2. Legacy adapter `v8_execution_signals` odrzuca organizacje z nie-UUID id —
   deterministyczny zapis i feed działają mimo to; zaakceptowane jako znany brak.

## Zadanie nadzorcy po scaleniu
`ENABLE_SIGNAL_PRODUCER=true` na backendzie STAGING — ale dopiero PRZY DEPLOYU
kandydata (K5): staging biegnie dziś na innym kodzie, wcześniejsze ustawienie env
nic nie da albo obudzi starą wersję joba. Zapisane, nie zapomniane.
