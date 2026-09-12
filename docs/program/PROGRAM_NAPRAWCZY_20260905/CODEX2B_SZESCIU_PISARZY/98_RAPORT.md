# CODEX2B — raport wykonania

Stan: W TOKU. Budget-items: implementacja i dowody lokalne gotowe do niezależnego review; pozostałych pięciu nieodebranych.

## 0. Metryka

Marker `a176d3f906`, gałąź `codex/szesciu-pisarzy-legacy-20260911`.
Kontener `cx-codex2b-pg`, PostgreSQL18/pgvector, port6454.
Bazy `cx_codex2b`, `codex2b_kopia_1009`. Harness5594 nieuruchomiony.
Pełne migracje czystej bazy:914; zakończone; drugi przebieg: `Applying migrations: 0`.
Korekta pg16→pg18: lokalny szablon pochodzi zPG18; żadna baza zdalna nieużyta.

## 1. K-PUNKTY przed/po

Pomiar kodu: K5 0/6 wycofanych;6rodzin ma wołaczy;19tras zapisu.
K7 przed:3metody RAID. K8 przed:4wzorce.
K9 kopia lokalna po pełnym restore:

```
initiative_milestones|17
initiative_resources|0
initiative_budget_items|0
initiative_gate_roles|0
staffing_plans|0
staffing_plan_roles|0
initiative|31
decision|20
plan_scenario_version|15
portfolio_scenario_version|14
execution_task|12
raid_item|10
execution_case|10
gate_quorum|9
gate_signoff|9
source_proposal|7
handoff_package|6
execution_milestone|6
execution_decision|4
capacity_scenario_version|4
ai_analysis_proposal|4
plan_analysis_proposal|3
portfolio_scenario|3
plan_scenario|3
report_run|2
capacity_scenario|2
management_signal|2
capacity_options|2
task|2
results_kpi_observation|2
archive_manifest|1
benefits_handoff_pack|1
delivery_acceptance|1
effectiveness_snapshot|1
results_acceptance|1
operational_allocation|1
closure_snapshot|1
material_change|1
effectiveness_case|1
resource_commitment|1
closure_case|1
```

## 2. Stan wejściowy

Pełne komendy i wyniki: `codex2b-artefakty/e2-0-static.txt`.
32trafienia callerów nie oznaczają32wywołań zapisu: zawierają także komentarze i GET.

## 3. SZEŚĆ ŚCIEŻEK — tabela rdzeniowa

| Rodzina | Trasy zapisu | Trafienia src | Kanoniczny zapis do tabeli UI | Stan |
|---|---:|---:|---|---|
| budget-items |3|5|brak na markerze|W TOKU P|
| milestones |3|6|brak na markerze|NIEZROBIONE|
| resources |4|6|brak na markerze|NIEZROBIONE|
| gate-roles |1|4|brak na markerze|NIEZROBIONE|
| staffing-plans |7|10|brak na markerze|NIEZROBIONE|
| move |1|1|brak na markerze|NIEZROBIONE|

## 4. Kroki E2.0…E2.6, E9

E2.0: pomiar kodu, migracje ×2 i pełny restore lokalnego szablonu wykonane.
E2.1: analiza trwa. E2.2–E2.6 orazE9 nieodebrane.

## 5. Dowody mutacyjne (Z32)

Budget-items: 3mutacje, każda przy7tych samych pełnych nazwach:
- usunięty INSERT do projection:2PASS/5FAIL → cp →7PASS;
- usunięty organization_id w UoW:6PASS/1FAIL (nativeforeign404) → cp →7PASS;
- wymuszony WRITEfalse:4PASS/3FAIL, legalnyOFFPASS → cp →7PASS.
Skrypt exact mutacji: `codex2b-scratch/run-budget-mutations.py`.
Każdy przebieg ma `budget-mutation-<projection|tenant|flag>-<red|green>.command.txt`, JSON i log.
Pliki przywrócone przez kopię; porównanie bajtowe identyczne; diff mutacji pusty.
Backend tsc -p server/tsconfig.json --noEmit:exit0. Pozostałych writerów nie mierzyłem.

Budget-items: GREEN7/7 po rozszerzeniu o native runtime CRUD/replay/CAS/tenant
oraz legacyON update/delete/expectedCanonicalVersion409. Ten sam UI GET zawiera
id+opis przy READfalse iREADtrue. LegalnyOFFCRUDPASS przed i po zmianie.
Nowe error keys errors.VERSION_CONFLICT, NOT_FOUND, VALIDATION_FAILED,
INITIATIVE_ARCHIVED_READ_ONLY dopisano w PL i EN. Wyświetlenie tłumaczenia
w przeglądarce NOT_PROVEN (Z11 — blok nie ma warstwy browser).

## 6. Zasięg testów (§0.4a)

Pierwszy RED budget5nazw:1PASS legalnego OFF CRUD,4FAIL:
2brak kanonu;2naruszenie izolacji tenanta. Lista nazw w budget-before.json.
Nie jest to regresja dostarczonego kodu: pomiar uruchomiono na niezmienionym markerze.

## 7. Deklaracja Z30

SMTP env:0nazw; settings SMTP0;ie_outbox_delivery_receipts0 przed pierwszym zapisem.
ApiGateway montowany bez index.ts, żaden drenaż nieuruchomiony.
Finalna deklaracja z liczbą outbox — po ostatnim przebiegu.

## 8. Migracje i manifesty

Brak nowych migracji. Pełny dump lokalnego szablonu leży poza repo.

## 9. Korekty wobec instrukcji

Z30 sprawdzony bez drukowania wartości zmiennych środowiska.
Vitest wymaga --root server i absolutnego --config; względny po zmianie root
wskazuje błędnie server/server/vitest.config.ts. Pierwszy startup nie był pomiarem.
Pierwsze uruchomienie migratora trafiło na rozruch PG; po pg_isready pełny przebieg
powtórzono z powodzeniem. Drugie wykonanie jest idempotentne.

## 10. STOP-y

Brak STOP całego bloku. Lokalna ochrona tenantów budget została autoryzowana przez
integratora jako poprawka bezpieczeństwa w trzech handlerach, bez zmian istniejących
bramek E3 lub globalnego middleware.

## 11. TWIERDZENIA NIEZWERYFIKOWANE

Nie zmierzono staging/demo/produkcji. Nie potwierdzono jeszcze kompletności żadnego
z sześciu pisarzy, mutacji ani braku regresji pełnego serwera.

## 12. DO DECYZJI WŁAŚCICIELA

- move: czy zmiana project_id ma zostać osobną komendą kanoniczną; brakuje decyzji
  kontraktu tożsamości i skutków dla istniejących relacji.
- Autoryzacja: budget legacy ma shadow capability; kanoniczny runtime ogranicza
  dostęp przez authorizeProjects. Nie zmieniono modelu uprawnień.
- expectedVersion: starszy klient nie podaje wersji kanonicznej. Adapter zachowuje
  ostatni zapis wygrywa; nowy endpoint wymaga jawnej wersji. Pełna ochrona klienta
  wymaga osobnej zmiany frontu poza tym blokiem.

## 13. ZNALEZISKA POBOCZNE

SECURITY: budżetowy POST zJWT drugiej organizacji potwierdzony201 na markerze
przy OFF iON. Tworzy wiersz z cudzym initiative_id. Dowód budget-before.json.
Update/delete również wymagają lokalnej walidacji rodzica; nie zmieniamy shadow capability.

## 14. Artefakty

Katalog absolutny: `/Users/piotrwisniewski/Developer/codex-wt/codex2b-artefakty`.
Manifest SHA256 zostanie uzupełniony na zamknięciu bloku.
