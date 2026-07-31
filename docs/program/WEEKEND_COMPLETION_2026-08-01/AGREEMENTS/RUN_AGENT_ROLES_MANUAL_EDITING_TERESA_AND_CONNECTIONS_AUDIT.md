---
document_id: RUN-AGENT-ROLES-MANUAL-TERESA-CONNECTIONS-AUDIT
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — audyt ról, ręcznej pracy, Teresy i połączeń

## 1. Werdykt audytu

Po pierwszej wersji dokumentacji opisane były canvas, Teresa, execution i
connectors, ale brakowało jednego kontraktu zbierającego precyzyjnie:

- role platformowe kontra dostęp do konkretnego agenta;
- dokładny podział czynności człowiek/Teresa;
- ręczne operacje na blokach, krawędziach i fazach;
- porty, typy połączeń i walidację danych;
- publikację, współdzielenie oraz ownership zgodnie z benchmarkiem Harvey.

Niniejszy dokument zamyka tę lukę. Werdykt po uzupełnieniu:
`PASS_DOC / OWNER_DECISIONS_PENDING / RUNTIME_PARTIAL`.

## 2. Role Harvey — potwierdzone oficjalnie

Harvey rozdziela dwa poziomy:

### Workspace roles

| Rola Harvey | Potwierdzone możliwości |
| --- | --- |
| Agent Builder Admin | create, edit, review, approve, publish i administracja wszystkimi agents |
| Agent Builder | create, współpraca nad draftami, test, submit for approval |
| User | uruchamianie opublikowanych agents udostępnionych użytkownikowi |

### Agent-level access

| Dostęp Harvey | Potwierdzone możliwości |
| --- | --- |
| Run | uruchomienie opublikowanego agenta |
| View | oglądanie i uruchamianie draftu, bez edycji |
| Edit | edycja kroków, promptów i struktury oraz run |
| Full | edit, share/distribute i delete |

Harvey wymaga osobnego publish i osobnego nadania run access. Zmiana published
nie aktualizuje użytkowników automatycznie; musi przejść ponowny approval/publish.
Output może być współdzielony, ale odbiorca potrzebuje odpowiedniego dostępu, a
źródła Vault zachowują własne permission rules.

Źródło: [Harvey — Manage Permissions and Sharing in Agent Builder](https://help.harvey.ai/articles/manage-workflow-permissions-and-sharing).

## 3. Docelowe role Consultify

### Uprawnienia aplikacyjne

- `Owner/Admin`: konfiguruje governance, publish roles, connectors i policy;
- `Agent Admin/Publisher`: review/publish/deprecate agents w dozwolonym scope;
- `Agent Builder`: tworzy, edytuje, testuje i wysyła do review;
- `Member/User`: uruchamia udostępnione agents i pracuje w human steps;
- `Consultant`: jak Member plus dozwolone tworzenie/adaptacja project drafts;
- `Auditor/Viewer`: read trace/audit w dozwolonym zakresie bez uruchamiania.

### Dostęp do konkretnego agenta

`Run`, `View`, `Edit`, `Full` przyjmujemy semantycznie z Harvey. Dodajemy
`Review/Approve` jako capability wynikającą z publish role, a nie automatycznie
z Full. Usunięcie i publish są rozdzielone.

### Role projektowe i run-time

- process owner — odpowiada za business outcome i definition;
- builder — projektuje proces;
- reviewer — ocenia metodykę/ryzyko/testy;
- publisher — aktywuje konkretną wersję;
- run initiator — dostarcza inputs i uruchamia;
- run operator — monitoruje, pause/resume/cancel zgodnie z policy;
- approver/decider — podejmuje określone zgody/decyzje;
- task/input owner — dostarcza human step;
- output reviewer/acceptor — odbiera rezultat;
- informed/watcher — otrzymuje wybrane zdarzenia;
- connection owner — odpowiada za konto i reauth;
- data/knowledge owner — odpowiada za źródła i ich udostępnienie.

Jedna osoba może pełnić kilka ról w małym projekcie. W dużym projekcie separation
of duties może zabronić builderowi publikacji albo akceptacji własnego outputu.

## 4. Macierz człowiek — Teresa

| Czynność | Użytkownik ręcznie | Teresa na polecenie | Teresa autonomicznie |
| --- | --- | --- | --- |
| utworzyć draft | tak | proponuje i tworzy draft | tylko z jawnego triggera/policy |
| dodać/usunąć/przesunąć blok | tak | graph patch + diff | nie w published/run |
| połączyć porty | tak | proponuje typed edge | tylko w draft z akceptem patcha |
| zmienić prompt/instrukcję | tak | proponuje diff | nie publikuje |
| dobrać knowledge | tak | sugeruje źródła z uzasadnieniem | nie rozszerza ACL/scope |
| dobrać connector/tool | tak | sugeruje capability/binding | nie tworzy credentials |
| ustawić retry/error path | tak | rekomenduje na podstawie ryzyka | nie obniża safety policy |
| ustawić approval | tak | wskazuje potrzebę i role | nie usuwa wymaganego gate |
| testować | tak | generuje fixtures/assertions, uruchamia test | w dozwolonym sandboxie |
| publish | uprawniony człowiek | przygotowuje review summary | nigdy |
| uruchomić | użytkownik/policy trigger | przygotowuje run | tylko według published trigger |
| approve/decide | uprawniony człowiek | przygotowuje evidence/diff | nigdy dla human-required |
| naprawić run | operator | proponuje retry/fallback/amendment | tylko pre-approved retry |
| oznaczyć business success | acceptor | przygotowuje ocenę | nigdy |
| zapamiętać wiedzę | knowledge owner | proposal z provenance | nigdy bez governance |

## 5. Dokładne operacje ręczne

### Blok

Add z palette lub insert na edge; select; multi-select; drag; keyboard move;
rename; configure; duplicate; copy/paste; disable; wrap in phase; extract as
sub-process; replace capability; test step; view dependencies; delete z impact
preview. Delete połączonego bloku pokazuje downstream effects i wymaga wyboru:
usuń ścieżkę, połącz sąsiadów lub anuluj.

### Krawędź i port

Drag output port → kompatybilny input port; picker mapping; nazwa edge; condition;
default/error path; delete/reroute. Niedozwolone typy nie łączą się. Konwersja
typu wymaga explicit transform node lub bezpiecznego adaptera.

### Faza i sub-process

Rename; collapse/expand; move wraz z zawartością; add phase input/output;
parallelize eligible steps; extract reusable process; inline sub-process for
draft; replace version; navigate breadcrumb. Zmiana published sub-process nie
zmienia runów pinujących version.

### Canvas

Pan/zoom/fit/minimap; auto-layout; align/distribute; search; outline; undo/redo;
version diff; comments; focus selected; keyboard alternative; run overlay.

## 6. Porty i połączenia

Każdy port deklaruje `name`, direction, data type/schema, required/optional,
cardinality, sensitivity, streaming/batch i allowed source classifications.

Typy edge:

- data — przenosi value/reference;
- control — określa kolejność bez danych;
- condition — ścieżka po deterministycznym warunku;
- error — obsługa klasy błędu;
- compensation — cofnięcie skutku;
- event/wait — wznowienie po correlation event;
- human — request/response;
- artifact — file/dataset reference.

UI odróżnia edge semantycznie kształtem/label, nie tylko kolorem. Teresa może
proponować mapping, ale nie może automatycznie mapować restricted output do
niższego sensitivity ani zgadywać pola, gdy istnieje kilka niejednoznacznych.

## 7. Zewnętrzne przyłącza

Manualnie użytkownik wybiera capability, provider/connection, account label,
execute-as, allowed resources i test connection. Teresa może znaleźć właściwą
capability i przygotować binding proposal, ale:

- nie widzi ani nie wpisuje sekretu;
- nie uruchamia OAuth za użytkownika;
- nie zwiększa scope;
- nie wybiera prywatnego konta, gdy proces jest organizacyjny, bez ostrzeżenia;
- nie publikuje template z credentials;
- nie przełącza produkcji na sandbox lub odwrotnie bez diffu.

Connection status i wymagane scopes są częścią validation/publish/run preflight.

## 8. Tryby użytkownika końcowego

Runner nie musi oglądać canvasu. Guided run pokazuje kolejne inputs i outputs
jak profesjonalny formularz/proces. Power user może otworzyć `View process`.
Viewer widzi draft/run bez edit controls. Builder widzi canvas. Publisher widzi
review diff, tests, policy i impact. Operator widzi run timeline i recovery.

## 9. Pytania do odbioru

1. Czy przyjmujemy nazwy dostępów Harvey `Run/View/Edit/Full` bez zmian?
2. Czy Consultant domyślnie ma Agent Builder w projekcie?
3. Czy separation of duties jest opcjonalne per organizacja czy obowiązkowe dla high impact?
4. Czy runner może oglądać prompty i logikę procesu, czy zależy to od content controls?
5. Czy Teresa może automatycznie stosować low-risk graph patches w draft bez osobnego kliknięcia?
