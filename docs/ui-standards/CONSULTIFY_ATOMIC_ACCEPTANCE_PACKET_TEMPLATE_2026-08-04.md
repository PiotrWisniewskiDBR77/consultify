# Consultify — szablon atomowego pakietu odbiorczego

## 0. Tożsamość

- `module_id`:
- `module_name`:
- `packet_id`:
- `packet_name`:
- `packet_level`: `P0_DISCOVERY | P1_ATOMIC | P2_FAMILY_INTEGRATION | P3_MODULE_INTEGRATION | P4_DEPLOYED_ACCEPTANCE`
- owner agent:
- reviewer: Master Codex
- canonical base SHA:
- branch:
- upstream packet dependencies:
- downstream consumer:
- execution model: `SONNET_EXECUTOR`;
- coordinator: `OPUS_COORDINATOR`;
- context checkpoint path:
- full return path:

## 1. Jednozdaniowy warunek ukończenia

> Pakiet jest kompletny, gdy …

Jeżeli nie można zapisać jednego spójnego zdania, pakiet jest za duży i należy go podzielić.

## 2. Zakres włączony

### Surface IDs

| surface_id | type | route | component | owner object |
|---|---|---|---|---|
| | | | | |

### Contract requirements

| requirement_id | requirement | contract reference |
|---|---|---|
| | | |

### Owner services i rejestry danych

| owner | reader | writer | table/register | migration |
|---|---|---|---|---|
| | | | | |

## 3. Zakres jawnie wyłączony

- funkcje:
- surfaces:
- shared infrastructure:
- cleanup/mutacje danych:
- kontrakty wymagające decyzji:

## 4. CONTRACT

- powiąż requirement → task → commit → code → route → test → evidence;
- sklasyfikuj `IMPLEMENTED/PARTIAL/NOT_IMPLEMENTED/OUT_OF_SCOPE/BLOCKED_*`;
- nie uznawaj dokumentacji ani obecności pliku za dowód runtime.

## 5. RUNTIME i persistence

### Golden flow

1. wejście;
2. load;
3. create/open;
4. edit/action;
5. validation/error;
6. save/execute;
7. owner read-back;
8. hard reload/fresh session;
9. reopen;
10. porównanie trwałego rezultatu.

### Negative controls

- foreign tenant:
- missing role/permission:
- invalid input:
- retry/idempotency:
- concurrency/CAS:
- owner object missing:
- downstream/DB failure:
- false-success prevention:

Jeżeli element nie dotyczy pakietu, wpisz `NOT_APPLICABLE` z uzasadnieniem.

## 6. INFORMATION ARCHITECTURE

- właściwy poziom obiektu domenowego;
- list/preview/full card/tool/wizard boundary;
- wejście i wyjście z powierzchni;
- parent/child/deep-link semantics;
- terminologia przed i po handoffie.

## 7. UI STANDARD

- shell/header/navigation;
- tabela/preview/menu/workspace zależnie od typu;
- empty/loading/error/success/conflict/permission;
- desktop/tablet/mobile;
- light/dark;
- keyboard/focus/ARIA;
- locale i uczciwe komunikaty sukcesu.

## 8. EVIDENCE

Każdy dowód podaje:

- path;
- surface_id;
- route;
- state;
- viewport;
- theme;
- code/runtime SHA;
- data source;
- classification: `DEPLOYED_RUNTIME | LOCAL_REAL_BACKEND | LOCAL_HARNESS | SYNTHETIC | HISTORICAL`;
- wynik albo dokładny blocker.

## 9. Dozwolone zmiany i ownership

- dozwolone pliki/obszary:
- pliki współdzielone wymagające zgody:
- zakazane runtime overrides:
- zasady migracji:
- zakaz push/merge/deploy/demo mutation bez decyzji Master Codex.

## 10. Bramki wykonawcze

- targeted tests:
- real DB tests:
- negative-control mutation/red test:
- typecheck/lint:
- baseline comparison:
- evidence inspection:
- clean tree/fixture teardown:

## 11. Format zwrotu

1. packet/module i SHA;
2. source docs;
3. checked scope;
4. contract verdict;
5. runtime/persistence verdict;
6. IA verdict;
7. UI verdict;
8. evidence completeness;
9. findings P0–P3;
10. changed files;
11. tests i negative controls;
12. unresolved gates;
13. dependencies dla kolejnego pakietu;
14. potwierdzenie braku nieautoryzowanych działań;
15. `AWAITING_CODEX_PACKET_REVIEW`.

Wiadomość zwrotna do koordynatora ma być skrótem (docelowo do około 800 słów). Pełna
metodologia, lista plików, logi i evidence pozostają w `full return path`. Koordynator nie
powinien otrzymywać ich ponownie w treści promptu.

## 12. Bramka review

Pakiet może przejść dalej tylko jako:

- `PACKET_ACCEPTED_LOCAL`;
- `PACKET_ACCEPTED_WITH_BACKLOG`;
- `PACKET_FIX_REQUIRED`;
- `PACKET_BLOCKED_RUNTIME`;
- `PACKET_BLOCKED_DATA`;
- `PACKET_NOT_IMPLEMENTED`.

Żaden status pakietu nie jest statusem końcowym modułu.
