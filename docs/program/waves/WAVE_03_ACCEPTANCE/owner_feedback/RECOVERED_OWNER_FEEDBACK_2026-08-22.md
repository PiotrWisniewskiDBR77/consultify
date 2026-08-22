# Wave 3 — recovered owner feedback after the last formal checkpoint

Date recovered: `2026-08-22`

Source task: `Sprawdź stronę Consultify.ai` (`01a02294-96a1-7260-a46f-43531eb2b491`)

Source interval: `2026-08-22 10:26–16:30 Europe/Warsaw`

Last pre-existing formal checkpoint: `aa5918d8fc93a359289bdc89a90411c7d5bda82e`

Recovery status: `CAPTURED_UNRECONCILED / IMPLEMENTATION_NOT_STARTED / OWNER_ACCEPTANCE_NOT_INFERRED`

## Purpose and authority boundary

This file recovers Piotr's owner observations that were acknowledged in the task
after the last committed register checkpoint but were not durably reconciled into
the Wave 3 module registers. It is the source-intake record, not proof that any
finding is fixed, tested or owner-accepted.

The review used a local acceptance runtime backed by the
`consultify-wave2-p4-pg` container and subsequently seeded fixture databases. It
did not use the normal long-lived Demo Consultify development/staging data. Visual
observations remain valid as owner feedback; data completeness, persistence,
authorization and integration claims remain `NOT VERIFIED` unless independently
qualified.

## Recovered consolidated register

| ID | Module / surface | Type | Priority | Recovered owner requirement or decision | Required closure | Status |
|---|---|---|---|---|---|---|
| `MYW-INB-REC-001` | My Work / Inbox | `OWNER_DIRECTION + FUNCTIONAL_AUDIT` | `P1` | Preserve the generally accepted Inbox direction, but turn AI Triage into a real inbox-management workflow: duplicate reduction, criticality analysis, organization/prioritization and explicit preview of proposed bulk changes. | API/action inventory, proposal/apply/dismiss receipts, persistence, deduplication and cold readback. | `CAPTURED_UNRECONCILED` |
| `MYW-IDEA-REC-001` | My Work / Ideas table | `FUNCTIONAL_DEFECT` | `P1` | The ideas table needs a real row context menu instead of the browser menu, aligned with the canonical kebab actions and supporting selection/bulk behavior. | Handler/API/permission matrix and browser replay for single and bulk actions. | `CAPTURED_UNRECONCILED` |
| `MYW-IDEA-REC-002` | My Work / Ideas folders | `FUNCTIONAL_DEFECT` | `P1` | `New folder` currently does nothing. Support private, project and organization folders plus create, assign, move, rename and archive behavior. | Exact API/persistence/tenant contract, visible receipts and cold readback. | `CAPTURED_UNRECONCILED` |
| `MYW-CAL-REC-001` | My Work / Calendar create flow | `PRODUCT_REQUIREMENT` | `P1` | Remove the dominant day-occupancy/implementation explanation blocks and distinguish a real meeting from a task. Meetings require time range, timezone, recurrence, location/link and invitees. | Final IA plus create/update/cancel/reopen integration evidence. | `CAPTURED_UNRECONCILED` |
| `MYW-CAL-REC-002` | Calendar participants | `PRODUCT_REQUIREMENT` | `P1` | Meetings must invite organization/project users and external guests, expose organizer/invitation status and preserve permissions. | Invitation lifecycle, authorization, update/cancel and failure evidence. | `CAPTURED_UNRECONCILED` |
| `MYW-CAL-REC-003` | Calendar artifacts | `PRODUCT_REQUIREMENT` | `P1` | Allow Ideas, Notes and other authorized Consultify artifacts to be attached to a meeting and linked from the invitation without leaking private material. | Artifact selector, permission/share decision, durable links and revoked-access negative path. | `CAPTURED_UNRECONCILED` |
| `SET-INT-REC-001` | Settings / Integrations | `CROSS_MODULE_PRODUCT_REQUIREMENT` | `P1` | Replace `Coming soon` for Google/Outlook with truthful connect CTAs and create a full Integrations center for authorization, account/scope selection, sync direction, health, reauthorization, diagnostics and disconnect. | Provider scope decision, OAuth implementation, sync receipts/conflicts and owner replay. | `CAPTURED_UNRECONCILED` |
| `MYW-TASK-REC-001` | Tasks / Analyze | `COPY + FUNCTIONAL_DEFECT` | `P1` | Rename `Analyze with AI` to `Analyze`; the action currently fails and needs a real provider/error/retry contract. | Provider-backed action test, truthful failure and no false result. | `CAPTURED_UNRECONCILED` |
| `MYW-TASK-REC-002` | Tasks / History | `OWNER_DIRECTION` | `P2` | Replace the heavy history dashboard/cards with a light chronological list showing date, actor and concise transition; reveal technical detail only on demand. | Final shared history pattern and visual/functional replay. | `CAPTURED_UNRECONCILED` |
| `XMOD-CARD-REC-001` | N-Type artifact cards | `CROSS_MODULE_STANDARD` | `P0` | Run a separate inventory and owner flow for all N-Type cards and establish one reusable canon for layout, metadata, actions, history, edit and preview. | Canonical component/variant specification, migration map and representative owner acceptance. | `CAPTURED_UNRECONCILED` |
| `MYW-TASK-REC-003` | Tasks / Edit and Preview | `APPROVED_DIRECTION + FUNCTIONAL_AUDIT` | `P1` | Edit and Preview are visually accepted, but persistence and parity are unverified. `Regenerate / Edit / Accept` must have a clear object, effect and receipt or be removed. | Action semantics, API/readback and exact-SHA retest. | `CAPTURED_UNRECONCILED` |
| `MYW-DEC-REC-001` | Decisions / list | `UI_DEFECT + INTEGRATION_AUDIT` | `P1` | Remove the stack of source-unavailable/retry blocks from the primary view; use at most one dismissible aggregate message while investigating the disconnected sources. | Root-cause report plus usable list with truthful partial-data state. | `CAPTURED_UNRECONCILED` |
| `MYW-DEC-REC-002` | Decision detail | `PERSISTENCE_REQUIREMENT` | `P0` | Remove the browser-only legacy warning only after comments, alternatives, risks and notes have durable server persistence and team visibility. | API/DB persistence, refresh, second-session and permission evidence. | `CAPTURED_UNRECONCILED` |
| `MYW-DEC-REC-003` | Decision cards | `APPROVED_DIRECTION` | `P2` | Decision cards are visually strong; card-structure changes belong to the separate N-Type canon rather than a local redesign. | Preserve direction and route structural changes through `XMOD-CARD-REC-001`. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-001` | Client Vault / list and preview | `P0 PRODUCT REBUILD` | `P0` | Reassess useful table columns and replace the non-standard Preview with the existing canonical table-preview pattern. | Data/column decision, shared preview component, loading/empty/error and selection lifecycle. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-002` | Client Vault / row actions | `FUNCTIONAL_DEFECT` | `P1` | Right-click and kebab must use one canonical action registry, with truthful availability based on vault type and permission. | Action registry, handler/API matrix, keyboard/focus and viewport replay. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-003` | Client Vault / dynamic toolbar | `MISSING_CORE_FUNCTION` | `P0` | Add the third dynamic menu, selection count, bulk actions, progress, partial-error receipts and automatic table/counter refresh. | Single/bulk positive and negative browser/API/DB evidence. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-004` | Client Vault / hierarchy | `OWNER_DECISION` | `P0` | Replace the split `My safe / Organization safe` model with one folder/vault list carrying an explicit private/project/organization owner/scope column and filters. | Final data model, permissions and migration/readback contract. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-005` | Client Vault / folder creation | `MISSING_CORE_FUNCTION` | `P0` | Add a clear `New folder` action at the vault-list level; do not create folders inside an already opened folder. | Create/rename/archive, scope permissions and immediate list readback. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-006` | Client Vault / document ingestion | `MISSING_CORE_FUNCTION` | `P0` | Add a working `Add document` flow contained within the workspace (right drawer or canonical central modal), with upload, progress, error, save and indexing receipt. | File/provider contract, persistence, indexing and cold readback. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-007` | Client Vault / document metadata | `PRODUCT_REQUIREMENT` | `P1` | Generate a short editable brief/description from document content, search it, and show whether the document participates in private/project/organization AI context. | Extraction/provenance, editable metadata, search results and context-scope authorization. | `CAPTURED_UNRECONCILED` |
| `MYW-CV-REC-008` | Client Vault / opened-folder controls | `OWNER_DIRECTION` | `P2` | Remove manual Refresh and folder creation from the opened-folder toolbar; retain status counters only if they perform useful filtering and update automatically. | Final toolbar inventory and automatic refresh/index-status proof. | `CAPTURED_UNRECONCILED` |
| `MYW-AGT-REC-001` | My Work / Run Agent | `SEQUENCING_DECISION` | `P0 PROGRAM` | Defer owner acceptance until the rest of the system is integrated. Treat the current screen as incomplete; design the final module as a smart process builder closer to Process Flow and give it a dedicated end-stage audit. | Existing-capability inventory, product model, process-builder design and final cross-module acceptance. | `CAPTURED_UNRECONCILED` |
| `MYW-MGR-REC-001` | My Work / Manager | `P0 PRODUCT REDESIGN` | `P0` | Treat the ten-month-old dashboard as a prototype. Redesign Manager around real team work, capacity, project progress, blockers, risks, responsibility and drill-down actions backed by truthful data. | Manager operating model, IA, source contracts, action matrix and owner design review. | `CAPTURED_UNRECONCILED` |
| `INT-REC-001` | Interview | `CRASH / ACCEPTANCE BLOCKER` | `P0` | Entering Interview/templates caused the global error boundary. The module was not usable for owner review in that state. | Reproduce with exact route/runtime, capture error, fix, then replay all tabs, direct links and refresh. | `CAPTURED_UNRECONCILED` |
| `INT-REC-002` | Interview fixtures | `DATA_GATE` | `P1` | Owner review requires realistic data across Inbox, Sessions, Assignments, Insights and Initiatives. Fixture presence alone is insufficient; every level must be visible to the active account/organization. | Use the canonical development dataset or a qualified fixture and prove UI visibility/relationships. | `CAPTURED_UNRECONCILED` |

## Runtime and evidence directives recovered separately

These are operational controls, not product requirements:

| ID | Directive | Current disposition |
|---|---|---|
| `RUN-REC-001` | Use the owner's normal Demo Consultify development/staging data rather than inventing competing local fixtures for product review. | `REQUIRED / TARGET_IDENTITY_NOT_YET_REQUALIFIED` |
| `RUN-REC-002` | Requests to seed Tools, Assessment, Initiatives and Execution were superseded by the instruction to use the existing development data. | `SUPERSEDED / DO_NOT_SEED_BY_DEFAULT` |
| `RUN-REC-003` | The request to autonomously click and quickly repair later modules did not authorize unbounded fixes without a stable runtime and register. | `STOPPED / REQUIRES_NEW_CONTROLLED_PACKET` |
| `RUN-REC-004` | Stop the Railway/staging connection attempt after the agent looped; do not infer that the Railway CLI context is the application's database configuration. | `STOPPED / NO STAGING MUTATION VERIFIED` |
| `RUN-REC-005` | Continue owner review only after exact code SHA, runtime, database, persona and organization are recorded. | `MANDATORY_NEXT_REVIEW_GATE` |

## Source coverage ledger

The recovery reviewed every substantive owner message after the last formal
checkpoint. Automatically injected recommended-plugin blocks were excluded because
they were not owner feedback. Concern/status questions to the agent were retained
only where they produced an operational stop or runtime directive.

| Local time | Recovered source cluster | Register mapping |
|---|---|---|
| `10:26–10:28` | Inbox AI Triage; Ideas context menu and folders | `MYW-INB-REC-001`, `MYW-IDEA-REC-001..002` |
| `10:30–10:32` | Calendar meetings, invitees, artifacts and integrations | `MYW-CAL-REC-001..003`, `SET-INT-REC-001` |
| `10:36–11:35` | Tasks, N-Type cards and Decisions | `MYW-TASK-REC-001..003`, `XMOD-CARD-REC-001`, `MYW-DEC-REC-001..003` |
| `11:36–12:02` | Client Vault table, preview, actions, hierarchy, ingestion, metadata and toolbar | `MYW-CV-REC-001..008` |
| `12:04–12:06` | Run Agent sequencing and Manager redesign | `MYW-AGT-REC-001`, `MYW-MGR-REC-001` |
| `12:06–13:31` | Interview crash and data requirements | `INT-REC-001..002` |
| `13:32–16:30` | Existing development data, later-module review request, staging attempt and stop | `RUN-REC-001..005` |

## Owner wording index

The following excerpts preserve the controlling owner wording for each recovered
cluster. Punctuation and transcription errors are retained where they do not make
the intended decision ambiguous.

| Register mapping | Owner wording |
|---|---|
| `MYW-INB-REC-001` | “Wszystko jest super. Jedyna rzecz, którą tutaj myślę, że warto byłoby rozwinąć, to przycisk ‘AI Trash’. Uruchamia on jakąś funkcję, ale ona się nie dzieje. […] Redukcję duplikatów; analizę tego, co jest krytyczne; układanie oraz funkcjonalności związane z zarządzaniem całym inboxem.” |
| `MYW-IDEA-REC-001` | “Na idei, na tabeli nie działa prawy przycisk menu kontekstowego. Dopisz tam, żeby to uzupełnić.” |
| `MYW-IDEA-REC-002` | “Wprowadziliśmy formułę folderów prywatnych, organizacyjnych i projektowych […] wciskam nowy folder, ale nic się nie dzieje.” |
| `MYW-CAL-REC-001..002` | “Ta część spotkań […] jest w ogóle niepotrzebna. Usuńmy ją. Czego nam brakuje? Możliwości zapraszania kogoś do spotkań.” |
| `MYW-CAL-REC-003` | “Do spotkania warto byłoby móc dodawać […] z zestawu idei i z zestawu notatek […] osoba, która dostaje zaproszenie, też powinna mieć link do tego.” |
| `SET-INT-REC-001` | “Nie mamy połączonych kalendarzy […] komentarze nie były ‘coming soon’, tylko zaproszeniem do połączenia, do integracji.” oraz “W ustawieniach potrzebujemy mieć całą kartę integracji […] pełną, dużą kartę integracji.” |
| `MYW-TASK-REC-001` | “Tutaj wystarczy, jak zostawisz samo ‘Analyze’. Nie potrzebujemy ‘With AI’.” |
| `MYW-TASK-REC-002` | “Logi historii dramat — poukładaj to jakoś, aby tylko lista lekka była.” |
| `XMOD-CARD-REC-001` | “Trzeba byłoby tak naprawdę wypracować standard karty […] zaplanować odbiór samych kart […] one trochę się różnią swoim widokiem.” |
| `MYW-TASK-REC-003` | “Graficznie wersja edytowalna i podgląd […] wyglądają dobrze. Nie wiem, czy logika działa […] ‘Edit, Accept and Generate’ — nie wiem, do czego te przyciski służą.” |
| `MYW-DEC-REC-001` | “Cała ta górna część nie jest potrzebna.” |
| `MYW-DEC-REC-002` | “Całą tę linię dolną pod nagłówkiem możemy usunąć.” |
| `MYW-DEC-REC-003` | “Uwagi do karty decyzji są dokładnie takie same, jak do kart wcześniejszych. Generalnie wyglądają mega ok […] wszystkie karty N-Type’u oddzielnie.” |
| `MYW-CV-REC-001` | “Mamy trochę więcej pracy z tą tabelą […] preview jest zupełnie niezgodne ze standardem […] istnieje opisany standard, a tutaj nie został on wprowadzony.” |
| `MYW-CV-REC-002` | “Menu z prawego przycisku myszy do poprawy. To samo z kebaba.” |
| `MYW-CV-REC-003` | “Nie ma trzeciego menu, menu dynamicznego […] nie ma wszystkich funkcjonalności […] bulk, dynamiczne pokazywanie na listwie tego, co jest potwierdzane.” |
| `MYW-CV-REC-004` | “Tutaj mamy mieć po prostu listę folderów. Ten folder się otwiera i może być albo mój, albo organizacyjny […] potrzebujemy kolumny.” |
| `MYW-CV-REC-005` | “Potrzebujemy przycisk dodawania folderów na tym poziomie.” |
| `MYW-CV-REC-006` | “‘Add document’ może być rozwijany z prawej strony […] musi mieścić się w obszarze roboczym okna, a nie zajmować całość.” oraz “Nie mogę włożyć tutaj żadnej informacji, czyli żadnego dokumentu do testu.” |
| `MYW-CV-REC-007` | “Warto byłoby zrobić okno ‘description’ […] i później wyszukiwanie po tym opisie.” oraz “System powinien spróbować go rozpoznać i […] zrobić brief […] umożliwić zaznaczenie, czy dany dokument ma wchodzić do kontekstu.” |
| `MYW-CV-REC-008` | “Nie wiem, czy przycisk ‘Refresh’ jest tutaj potrzebny. I na tym poziomie też już nie tworzymy folderów.” |
| `MYW-AGT-REC-001` | “Zostawiłbym to na koniec […] jest to moduł współpracujący ze wszystkimi innymi modułami […] to jest królewski moduł […] zrobimy [go] na samym końcu.” |
| `MYW-MGR-REC-001` | “Ten moduł jest w całości do wypracowania […] ekran do zarządzania zespołem […] raportujemy pracę ludzi i postępy w projektach […] obecny ekran nie ma żadnej użyteczności.” |
| `INT-REC-001` | “Wywaliłem się w Interview.” |
| `INT-REC-002` | “Potrzebowałbym trochę danych przykładowych w Inboxie, w sesjach, w Assignments, w Insights i w inicjatywach […] do wszystkich poziomów.” |
| `RUN-REC-001..002` | “Nie lepiej byłoby, żebyś po prostu wziął moje dane z bazy lokalnej, której używam? Przecież tam jest mnóstwo danych.” |
| `RUN-REC-004` | “Zatrzymaj to, co teraz robisz […] zapętliłeś się […] baza danych, której szukamy, jest pod adresem demo.consultify.ai.” |

The source task remains the evidence authority for the complete messages and their
attached screenshots. This index does not claim that temporary screenshot paths
have been durably copied or hash-matched; that evidence step remains open.

## Reconciliation rule

1. Copy each recovered item into the authoritative module acceptance register.
2. Reconcile overlaps with already recorded Ideas/Notebook/Chat tasks; do not
   duplicate an existing task merely because it was mentioned again.
3. Freeze priority and acceptance criteria before implementation starts.
4. Bind implementation and retest to a newly recorded exact SHA/runtime/database.
5. Only then update `MASTER_STATUS_REGISTER.md` counts and gates.
