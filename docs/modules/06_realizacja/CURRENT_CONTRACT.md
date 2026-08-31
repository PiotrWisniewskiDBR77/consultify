---
module_id: MODULE_EXECUTION
truth_type: product-target
status: canonical
superseded_in_scope_by: INITIATIVES_EXECUTION_FUNCTIONS_CANON.md (spis funkcji Menu 2)
owner: product
last_reviewed: 2026-07-30
---

# Execution — aktualny kontrakt funkcjonalny

> ### ★ ROZSTRZYGNIĘCIE SPORU O KANON — 2026-08-29
>
> Ten kontrakt i [`../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md`](../INITIATIVES_EXECUTION_FUNCTIONS_CANON.md)
> miały jednocześnie status `canonical` i opisywały **różne zestawy funkcji Menu 2**,
> bez `superseded_by` w żadną stronę. Wg [`../../SOURCE_OF_TRUTH.md`](../../SOURCE_OF_TRUTH.md)
> był to stan `disputed`, w którym **nie wolno wdrażać na podstawie zgadywania**.
>
> **Rozstrzygnięcie, wiążące dla wykonawców:**
> - **Spis funkcji i anatomia Menu 2** — rozstrzyga **kanon** (nowszy, `2026-08-09`,
>   z jawnym `supersedes_in_scope` dla dawnych definicji powierzchni). Tabela „Funkcje"
>   w tym pliku jest w tym zakresie **historyczna**.
> - **Cel, granice modułu, własność obiektów, dane, role i integracje** — rozstrzyga
>   **ten kontrakt**. Kanon ich nie zastępuje.
>
> **Ograniczenie, o którym trzeba wiedzieć:** kanon ma `runtime_status: not_implemented`,
> a towarzyszący mu `initiatives-execution-canon/01_PROCESS_GOVERNANCE_AND_GATES.md`
> ma status `draft_for_owner_review` z blokującą decyzją **OD-02** (właściciel musi
> zatwierdzić domyślne terminy bramek). Do czasu tej decyzji kanon jest **wiążącym
> kierunkiem**, nie potwierdzoną specyfikacją do odbioru.


## Cel

Execution prowadzi zatwierdzoną inicjatywę przez planowanie i realizację.
Jest właścicielem planu wykonania, zadań, kamieni milowych, ryzyk, problemów,
zależności i postępu; nie przejmuje prawdy finansowej ani KPI rezultatu.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `EXE-F-001` | Portfolio wykonania i dashboard | AS-IS |
| `EXE-F-002` | Plan, etapy i kamienie milowe | AS-IS |
| `EXE-F-003` | Zadania, właściciele i terminy | AS-IS |
| `EXE-F-004` | Ryzyka, problemy i zależności | AS-IS / partial |
| `EXE-F-005` | Raportowanie, rollout i governance | AS-IS / partial |
| `EXE-F-006` | Aktualizacja Results i Materials | partial |

## Przepływ i dane

Zatwierdzona inicjatywa tworzy kontrolowany rekord wykonania. Manager ustala
plan i odpowiedzialności, zespół aktualizuje zadania, a governance obsługuje
odchylenia i decyzje. Zamknięcie wymaga rozliczenia zakresu, wyniku, ryzyk i
przekazania danych do Results.

## AI, role i integracje

Teresa może proponować plan, identyfikować ryzyka i przygotowywać raport, lecz
nie zmienia właściciela, terminu bazowego ani statusu bramki bez potwierdzenia.
Role obejmują sponsora, managera, wykonawcę i reviewera. My Work agreguje
przypisania; Initiatives, Results, Finance i Materials zachowują własne dane.

## AS-IS

Aktywne są `/execution`, `/implementation` i `/rollout`. Runtime jest
rozdzielony między starszy `FullExecutionView` i nowszy `ExecutionHub`.
Kontrakty V8 oraz execution write-truth są podłączone, ale granica między
powierzchniami i kompletność przepływów wymagają weryfikacji.

## TO-BE i luki

Jedna spójna powierzchnia realizacji z audytowalną bazą planu, zmianami,
zależnościami, health status i automatycznym — lecz zatwierdzanym — reportingiem.

- ustalić kanoniczny hub i rolę tras legacy;
- potwierdzić model statusów, baseline i change control;
- zweryfikować Portfolio/Reports/Manager oraz role;
- udowodnić przepływ zadania do My Work i KPI do Results;
- dodać E2E happy path, opóźnienie, blokadę, eskalację i zamknięcie.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`, write-truth, API V8 i
`INTEGRATION_REPORT.md`.
