---
document_id: TOOL-ARTIFACT-FUNCTION-CATALOG
module: Tools / Artifact Platform
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Tool Artifact — katalog funkcji wzorcowych

## 1. Cel

Katalog definiuje funkcje wspólne dla wszystkich Tool Session Artifacts. Template
może konfigurować funkcję lub wyłączyć opcjonalną, ale nie może zmienić jej
semantyki, authority, statusów ani utworzyć konkurencyjnej implementacji.

Status funkcji:

- `CORE` — obowiązkowa dla każdego opublikowanego Tool Template;
- `CONDITIONAL` — obowiązkowa, gdy metoda lub polityka jej wymaga;
- `LATER` — poza pierwszym golden flow, ale część modelu docelowego.

## 2. Nawigacja, wejście i ciągłość

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-NAV-001 | Create Session from Template | CORE | Tworzy Draft, przypina exact template/method version i dopiero po read-back otwiera session URL. | Teresa może zaproponować setup; nie tworzy bez zgody. Jedno kliknięcie nie może utworzyć duplikatów. |
| TAF-NAV-002 | Stable deep link | CORE | URL zawiera sessionId, opcjonalnie phase/focus; permission-safe. | Teresa może udostępnić link. Reload odtwarza właściwą fazę i obiekt. |
| TAF-NAV-003 | Breadcrumb | CORE | `Tools / Sessions / Tool / Session`; każdy poziom używa safe leave. | Brak ukrytej utraty danych. |
| TAF-NAV-004 | Exit / Back to Sessions | CORE | Stale widoczny opisany przycisk; flush save i powrót z zachowanym widokiem listy. | Teresa nie blokuje wyjścia. Test edit→exit→resume zachowuje dane. |
| TAF-NAV-005 | Resume later | CORE | Save + wyjście do `My active`; zapisuje next action. | Teresa przygotowuje resume summary. |
| TAF-NAV-006 | Previous/Next phase | CORE | Nawigacja, nie approval; pokazuje X/5 i readiness. | Next nigdy nie zatwierdza fazy. |
| TAF-NAV-007 | Direct phase navigation | CORE | Można wracać i oglądać wszystkie dostępne fazy; edycja zależy od lifecycle. | Zmiana wcześniejszej fazy uruchamia impact/stale, nie usuwa danych. |
| TAF-NAV-008 | Restore last context | CORE | Odtwarza fazę, selection/focus, scroll i panel mode, gdy jest to bezpieczne. | Teresa pokazuje `Since last visit`. |
| TAF-NAV-009 | Browser/global navigation guard | CORE | Back, refresh, close tab, logo i global menu używają tego samego leave contract. | Dirty/save-failed nie znika bez ostrzeżenia. |
| TAF-NAV-010 | Presentation/fullscreen mode | CONDITIONAL | Pokazuje Tool visual bez controls z bezpiecznym wyjściem Esc. | Nie zmienia danych; dostępny accessible fallback. |

## 3. Zapis, wersje i lifecycle

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-LC-001 | Autosave | CORE | DIRTY→SAVING→SAVED z debounce, version check, idempotency i read-back. | `Saved` dopiero po backend confirmation. |
| TAF-LC-002 | Save now | CORE | Natychmiastowy zapis niezależny od autosave. | Widoczny rezultat lub error/retry. |
| TAF-LC-003 | Save failure recovery | CORE | Retry/Stay/Local recovery wg policy; wyjście nie gubi danych. | Teresa wyjaśnia błąd, nie twierdzi że zapisano. |
| TAF-LC-004 | Offline queue | CONDITIONAL | Jawny offline badge, lokalna kolejka, conflict check po reconnect; bez finalize. | AI używa tylko jawnie dostępnego lokalnego kontekstu. |
| TAF-LC-005 | Optimistic concurrency | CORE | Konflikt wersji pokazuje diff i merge/reapply/keep both. | Brak last-write-wins bez wiedzy użytkownika. |
| TAF-LC-006 | Version history | CORE | Lista snapshotów z actor/reason/template/method version i restore-as-new. | Teresa może podsumować diff, nie zmienia historii. |
| TAF-LC-007 | Session status | CORE | Draft, Active, Needs Input, Ready for Review, In Review, Finalized, Superseded, Archived oraz Blocked/Failed. | Każde przejście ma authority/event. |
| TAF-LC-008 | Mark phase ready | CORE | Oddzielne od Next i proposal acceptance; sprawdza phase blockers. | Teresa przygotowuje quality review; człowiek zatwierdza. |
| TAF-LC-009 | Request review | CORE | Wskazuje reviewer/decision owner, due/SLA i immutable review input version. | AI przygotowuje review brief, nie wysyła bez akcji. |
| TAF-LC-010 | Approve/send back phase/session | CORE | Decyzja z rationale, conditions i suggested changes. | Self-approval wg governance profile. |
| TAF-LC-011 | Finalize Session | CORE | Zamraża exact version i materializuje dokładnie jeden ToolOutput; idempotentne. | AI nie finalizuje. Failed materialization ma jawny retry. |
| TAF-LC-012 | Revise finalized | CORE | Tworzy nową Session version z lineage; Output pozostaje immutable. | Teresa może wskazać impact. |
| TAF-LC-013 | Archive/restore | CORE | Archive read-only; restore tworzy aktywną wersję wg policy. | Audit pozostaje. |

## 4. Shell i nawigacja faz

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-SHL-001 | Tool Header | CORE | Tool/session, project, owner, status, work mode, save i Exit. | Jeden shell we wszystkich templates. |
| TAF-SHL-002 | Properties Strip | CORE | Stałe metadane, readiness, methodology version, visibility i freshness. | Nie staje się formularzem metody. |
| TAF-SHL-003 | Single Command Row | CORE | Jedna primary action i kontekstowe local AI actions. | Bez duplikowania Menu 3/Canvas/Teresa. |
| TAF-SHL-004 | Five-phase Navigator | CORE | Stałe Mission, Input, Build, Synthesis, Outputs; tool-specific substeps pod spodem. | Każda faza pokazuje state/gaps/proposals/owner. |
| TAF-SHL-005 | Main Method Canvas | CORE | Jedyna powierzchnia merytorycznej edycji bloków. | Zmienny plugin metody, wspólna obsługa selection/history/AI. |
| TAF-SHL-006 | Teresa Panel | CORE | Where/What/Why/Missing/Proposal/Next action. | Rozmowa materializuje proposal, nie ukryty tekst. |
| TAF-SHL-007 | Utilities | CORE | Comments, Activity, History, Relations, Used In; nie są fazami. | Te same komponenty platformowe. |
| TAF-SHL-008 | Responsive shell | CORE | Desktop/tablet/mobile korzystają z jednej prawdy; nav/panel stają się drawerami. | Nie powstaje drugi uproszczony runtime. |
| TAF-SHL-009 | Accessibility | CORE | Keyboard, focus, labels, contrast, text alternatives, reduced motion. | Każdy visual ma tabelaryczny/tekstowy fallback. |

## 5. Wspólne fazy i method runtime

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-PHS-001 | Mission framing | CORE | Decision question, context, scope, horizon, success, participants, assumptions i fit. | Teresa sharpens/challenges; gate wymaga usable brief. |
| TAF-PHS-002 | Method-fit check | CORE | Pokazuje, kiedy użyć/nie użyć i alternatywne metody. | AI może rekomendować „nie używaj narzędzia”. |
| TAF-PHS-003 | Evidence ingestion | CORE | Files, links, interviews, materials, data i manual inputs z permission/provenance. | AI nie czyta źródła bez access. |
| TAF-PHS-004 | Signal extraction | CORE | Normalizuje fact/observation/hypothesis/opinion z source spans. | Każdy signal ma citations/confidence/proposal state. |
| TAF-PHS-005 | Evidence quality workbench | CORE | Freshness, contradiction, accepted/proposed/needs evidence. | Braki stają się research question/Task proposal. |
| TAF-PHS-006 | Method Build plugin | CORE | Template renderuje tool-specific objects i reguły na wspólnym Canvas. | Nie może ominąć evidence/quality/proposal semantics. |
| TAF-PHS-007 | Deduplicate/classify | CORE | Merge/split/move z preview i lineage. | AI proponuje, człowiek zatwierdza. |
| TAF-PHS-008 | Synthesis | CORE | Patterns, tensions, causal interpretation, contradictions i implications. | Musi tworzyć nową wartość, nie summary inputs. |
| TAF-PHS-009 | Options/moves | CORE | Alternatywy, trade-offs, what not to do, conditions i confidence. | AI challenge'uje preferowany wariant. |
| TAF-PHS-010 | Final source summary | CORE | Wersjonowane podsumowanie zaakceptowanej logiki i ograniczeń. | Jedno źródło dla Output adapters. |
| TAF-PHS-011 | Output/action candidates | CORE | Deliverable, Initiative Draft, Decision, Task, further research lub no action. | Brak wymuszonego downstream obiektu. |
| TAF-PHS-012 | Tool-specific calculations | CONDITIONAL | Wersjonowane formuły, units, rounding, assumptions i reproducibility. | AI nie inventuje inputs. |

## 6. Canvas i obiekty pracy

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-CAN-001 | Add/edit/delete draft block | CORE | Manual CRUD z schema validation i undo; delete recoverable w wersji. | Permissions i audit. |
| TAF-CAN-002 | Selection/multi-select | CORE | Jedna wspólna selection truth dla Canvas i AI actions. | AI scope jest widoczny przed run. |
| TAF-CAN-003 | Move/classify/reorder | CORE | Semantyczna transformacja z impact i lineage. | Method rules walidują operację. |
| TAF-CAN-004 | Inline source/evidence | CORE | Badge, hover/preview i deep link zgodnie z access. | Brak evidence jest jawny. |
| TAF-CAN-005 | Comments/mentions | CORE | Anchor do obiektu/selection; resolution i history. | Mention może proponować Task/Notification. |
| TAF-CAN-006 | Proposal states | CORE | Draft Manual, AI Proposed, Needs Evidence, Accepted, Rejected, Rethinking, Stale, Superseded. | Kolor + tekst + icon; jeden canon. |
| TAF-CAN-007 | Accept/edit/reject/rethink | CORE | Indywidualne oraz bezpieczny batch z preview. | Rejected no-write; reason opcjonalny/obowiązkowy wg policy. |
| TAF-CAN-008 | Diff/undo | CORE | Każda AI/manual transformacja ma before/after i reversible draft operation. | Accepted gate snapshot nie jest nadpisywany. |
| TAF-CAN-009 | Native visual blocks | CORE | HTML/SVG components z responsive/presentation/accessibility variants. | Brak screenshot jako prawdy. |
| TAF-CAN-010 | Zoom/focus/presentation | CONDITIONAL | Dla dużych map/macierzy bez utraty nawigacji/exit. | Accessible alternatives. |
| TAF-CAN-011 | Empty/degraded/error states | CORE | Wyjaśnienie stanu i next safe action. | AI nie maskuje braku danych przykładem. |

## 7. Teresa i lokalne funkcje AI

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-AI-001 | Work mode switch | CORE | Guided Manual ↔ Teresa-led na tej samej sesji i obiektach. | Switch nie zmienia accepted data. |
| TAF-AI-002 | Contextual conversation | CORE | Teresa zna session/method/phase/selection/permissions i knowledge version. | Odpowiedzi oddzielają evidence, assumptions i inference. |
| TAF-AI-003 | Local capability action | CORE | Precyzyjna nazwa, selection/source scope, expected schema i preview. | Nie ma ogólnego `Do with AI`. |
| TAF-AI-004 | Shared capability identity | CORE | Chat i button wywołują to samo capability ID/handler/policy. | Jedna proposal truth. |
| TAF-AI-005 | Proposal queue | CORE | Centralna kolejka z phase/object, confidence, sources i bulk review. | Teresa nie zapisuje poza queue. |
| TAF-AI-006 | Take the lead | CORE | Teresa prowadzi małe rundy pytań, materializuje i czeka na review. | Brak monolitycznego full-session generation. |
| TAF-AI-007 | Explain method/example | CORE | Pomoc dopasowana do fazy; przykład jest read-only i oznaczony. | Example nie trafia do danych sesji automatycznie. |
| TAF-AI-008 | Challenge/red-team | CORE | Kontrdowody, bias, alternatywy i weaknesses. | Nie generuje sztucznej pewności. |
| TAF-AI-009 | Quality review | CORE | PASS/WARNING/BLOCKER/N/A, evidence, fixes, owner i next action. | Blocker nie znika w score. |
| TAF-AI-010 | Abort/retry | CORE | Streaming można przerwać; partial result nie materializuje się bez review. | Retry idempotentne. |
| TAF-AI-011 | AI trace | CORE | Model/prompt/policy/knowledge/source scope/output schema/actor/timestamp. | Widoczne dla audytu zgodnie z access. |
| TAF-AI-012 | Unsafe prompt/source defense | CORE | Governed retrieval, prompt-injection flags i fail-closed writes. | Testy cross-tenant i unauthorized action. |

## 8. Współpraca, role i zadania

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-COL-001 | Participants/roles | CORE | Owner, Contributor, Reviewer, Observer; project/app role resolver. | AI nie nadaje dostępu. |
| TAF-COL-002 | Invite/accept/decline | CONDITIONAL | Kontrolowane zaproszenie i membership; scope/expiry. | Widoczny audit. |
| TAF-COL-003 | Presence/locking/conflict | CORE | Safe concurrent work, object locks lub merge semantics. | Brak silent overwrite. |
| TAF-COL-004 | Assign research/review Task | CORE | Canonical Task z owner/due/acceptance/deep link. | Teresa proponuje, człowiek przypisuje. |
| TAF-COL-005 | Decision request | CORE | Decision Case dla metody, exception lub finalizacji. | AI przygotowuje brief, nie decyduje. |
| TAF-COL-006 | Notifications | CORE | Assignment, mention, review, save conflict, blocker, due i finalize. | Actionable, bez noise/dark patterns. |
| TAF-COL-007 | Activity/audit | CORE | Durable events i filterable history. | AI summaries linkują do events. |

## 9. Wizualizacja i prezentacje

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-VIS-001 | Visual Manifest | CORE | Dozwolone blocks/layouts/density/legend/presentation mapping/fallback. | Template nie wpisuje arbitralnych status colors. |
| TAF-VIS-002 | Method primary visual | CORE | Semantyczna, interaktywna reprezentacja logiki metody. | Musi wspierać decyzję, nie dekorację. |
| TAF-VIS-003 | Theme variants | CORE | Light/dark/presentation/export z tym samym znaczeniem. | Contrast i brand kit validation. |
| TAF-VIS-004 | Overflow/density | CORE | Długi content ma truncation/drill-down/rewrite suggestion, nie łamie layoutu. | AI może zaproponować skrót z diff. |
| TAF-VIS-005 | PresentationSourceBlock | CORE | Semantyczny snapshot danych, message, evidence, intent i layouts. | Brak screenshot transferu. |
| TAF-VIS-006 | Send selected to deck | CORE | Preview variants, source/limitations i zapis przez Presentation Studio. | Tylko accepted content domyślnie. |
| TAF-VIS-007 | Create deck outline | CORE | Audience/purpose/selection → outline do approval przed generation. | Teresa wyjaśnia dobór slajdów. |
| TAF-VIS-008 | Source update/diff | CORE | Nowszy Output sygnalizuje update; refresh nie nadpisuje slajdu bez decyzji. | Manual slide edits chronione. |

## 10. Output, Deliverables i Initiatives

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-OUT-001 | ToolOutput materialization | CORE | Immutable exact snapshot z quality, evidence, visual blocks i limitations. | Dokładnie jeden na finalized version. |
| TAF-OUT-002 | Output preview/open | CORE | Read-only native result i lineage do Session. | Brak edycji historycznej prawdy. |
| TAF-OUT-003 | Create Deliverable | CORE | Setup/outline approval i handoff do Materials. | Tools przechowuje relation/read-back. |
| TAF-OUT-004 | Create report/deck/sheet variants | CORE | Wiele artefaktów z jednego Outputu i wiele sources w jednym artefakcie. | Claims pozostają source-linked. |
| TAF-OUT-005 | Create Initiative Proposal Draft | CORE | 0..N draftów z accepted moves, direct Output/evidence refs. | Nie tworzy Registered Initiative. |
| TAF-OUT-006 | Create Decision/Task/further research | CORE | Canonical objects w domenach ownerów, relation/read-back. | Nie ma lokalnych kopii. |
| TAF-OUT-007 | Downstream status/read-back | CORE | Tools pokazuje created/reviewed/published/registered/error i deep link. | Failed handoff ma safe retry. |
| TAF-OUT-008 | Share/export | CORE | Przez Materials/policy; confidentiality i access zachowane. | AI nie publikuje/wysyła. |

## 11. Template, wiedza i governance

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-TPL-001 | ToolDefinition versioning | CORE | Draft→Review→Pilot→Published→Deprecated→Retired. | Session pins exact version. |
| TAF-TPL-002 | Method Knowledge Pack | CORE | Method, questions, evidence, patterns, examples, bias, quality, citations/license. | Brak packa blokuje Published. |
| TAF-TPL-003 | Question Bank | CORE | Intencja, prerequisites, follow-ups, skip logic i expected evidence. | Teresa wybiera pytania kontekstowo. |
| TAF-TPL-004 | Quality Rubric | CORE | Wspólna + tool-specific; thresholds/blockers i examples. | Human-reviewed. |
| TAF-TPL-005 | AI Capability Manifest | CORE | Capability bindings, schemas, source scope, approval i target. | Jeden registry. |
| TAF-TPL-006 | Output adapters | CORE | Native Output, Deliverables, Proposal Draft i Presentation mapping. | Traceability test. |
| TAF-TPL-007 | Localization | CORE | Labels, method help, examples i generated-content policy. | Brak technicznych slugów w UI. |
| TAF-TPL-008 | License/source governance | CORE | Owner, citations, permitted use, expiry/deprecation. | Brak proprietary copy bez prawa. |
| TAF-TPL-009 | Migrate session template | CONDITIONAL | Preview/diff/compatibility i new session version; nigdy in-place. | Teresa wyjaśnia impact. |
| TAF-TPL-010 | Adoption gate | CORE | Shell, method, both modes, quality, output, security, E2E i visual QA. | Dopiero wtedy Published. |

## 12. Operator/Admin

| ID | Funkcja | Status | Kontrakt działania | AI i kryterium odbioru |
| --- | --- | --- | --- | --- |
| TAF-ADM-001 | Template registry | CORE | Status, version, owner, usage, readiness, issues i dependent sessions. | Publish/deprecate authority. |
| TAF-ADM-002 | Tool availability/policy | CORE | Org/project/role/license/risk access; tighten hierarchy. | Backend-enforced. |
| TAF-ADM-003 | Knowledge operations | CORE | Pack review/index/freshness/failure i case propose-review-publish. | Niepublikowana wiedza nie trafia do AI. |
| TAF-ADM-004 | AI policy/prompt governance | CORE | Capability, model, prompt policy, risk, approval i audit. | Versioned rollout/rollback. |
| TAF-ADM-005 | Quality analytics | CORE | Blockers, gate returns, AI acceptance/edit/reject, output failures, no activity ranking. | Służy ulepszaniu metody, nie nadzorowi ludzi. |
| TAF-ADM-006 | Access/audit explanation | CORE | Dlaczego użytkownik/AI może albo nie może wykonać akcję. | Fail closed. |

## 13. Standard rozpisania implementacji

Każda funkcja przed `READY_FOR_TASK_BREAKDOWN` otrzymuje kartę A–T:

A purpose; B user/job; C entry/trigger; D data; E UI placement; F behavior;
G states; H roles/capabilities; I Teresa/local AI; J evidence/provenance;
K relationships/events; L notifications; M errors/recovery; N accessibility;
O security/privacy; P telemetry; Q migration; R API/backend; S tests;
T acceptance/Definition of Done.

Katalog opisuje kompletny produkt. Nie oznacza, że wszystkie funkcje muszą wejść
do jednego weekendowego zakresu odbioru.
