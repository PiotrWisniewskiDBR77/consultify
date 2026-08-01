---
doc_id: weekend-completion-control-center-2026-08-01
truth_type: delivery-status
status: canonical
owner: piotr
process-manager: codex
implementation-lead: claude
window: 2026-08-01/2026-08-02
last_reviewed: 2026-08-01
---

# Weekend odbioru i dokończenia aplikacji

## Cel

W weekend 1–2 sierpnia 2026 doprowadzamy Consultify do stanu, w którym:

- krytyczne przepływy użytkownika są działające i odebrane;
- moduły nie udają funkcji, których nie realizują;
- błędy P0 są zamknięte lub jawnie blokują release;
- każda zaakceptowana zmiana ma test i dowód runtime;
- nierozstrzygnięte problemy koncepcyjne nie trafiają do implementacji przez
  zgadywanie;
- na końcu istnieje jedna decyzja `GO`, `GO_WITH_KNOWN_GAPS` albo `NO_GO`.

„Dokończenie” nie oznacza zamknięcia całego historycznego backlogu. Oznacza
domknięcie uzgodnionego zakresu weekendowego z uczciwą listą odroczeń.

## Zakres MVP

Do MVP wchodzą:

1. Materials;
2. Finance;
3. Results;
4. Execution;
5. Initiatives;
6. Assessment;
7. Tools;
8. Interview;
9. My Work;
10. Chat.

Każdy z tych modułów wymaga stabilnego golden flow na stagingu i nie może być
uznany za gotowy wyłącznie na podstawie istnienia ekranów lub backendu.

Audits i Meeting pozostają poza MVP i należą do kolejnej fali rozwoju.
Settings, Admin i SuperAdmin są warstwą platformową domykaną po ustabilizowaniu
modułów produktowych. Organization pozostaje wspólną pamięcią i kontekstem
organizacji, a nie osobnym golden flow deklarowanym na tej liście MVP.

## Role

| Rola | Osoba/system | Odpowiedzialność |
| --- | --- | --- |
| Product Owner | Piotr | cel produktu, decyzje koncepcyjne, odbiór biznesowy |
| Process Manager | Codex | kolejka, zakres, SSOT, pakiety pracy, dowody, regresje, decyzja bramki |
| Implementation Lead | Claude | analiza techniczna, implementacja, testy lokalne, raport zmian |
| Quality Gate | Codex + testy | niezależna weryfikacja diffu, kontraktu i runtime |

Claude nie zmienia zakresu produktu samodzielnie. Codex nie uznaje zadania za
zakończone na podstawie samej deklaracji implementatora.

## Dokumenty sterujące

0. [`ENVIRONMENT_AND_NAMING_AUTHORITY.md`](ENVIRONMENT_AND_NAMING_AUTHORITY.md)
   — twardy kanon Consultify, Railway `demo`, domeny i PostgreSQL stagingu.
1. [`ACCEPTANCE_BOARD.md`](ACCEPTANCE_BOARD.md) — jedna kolejka i status;
   pakiet operacyjny: [`OPS-DEMO-001`](PACKETS/OPS-DEMO-001_CONTROLLED_DEMO_PROMOTION.md)
   — kontrolowana promocja kandydata i rollback na `demo`; bieżące odkrycia runtime:
   [`MAT-006B`](PACKETS/MAT-006B_PRESENTATION_LIFECYCLE_E2E.md) i
   [`FIN-005`](PACKETS/FIN-005_DEMO_GOLDEN_FLOW_COHERENCE.md), a wejście publiczne
   śledzi [`OPS-DEMO-002`](PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md).
2. [`ROLE_AND_HANDOFF_PROTOCOL.md`](ROLE_AND_HANDOFF_PROTOCOL.md) — sposób
   przekazywania zadań Claude.
3. [`TASK_PACKET_TEMPLATE.md`](TASK_PACKET_TEMPLATE.md) — obowiązkowa karta
   implementacji.
4. [`CONCEPTUAL_WORK_PROTOCOL.md`](CONCEPTUAL_WORK_PROTOCOL.md) — praca nad
   narzędziami, które nie spełniają celu.
5. [`EVIDENCE_AND_RELEASE_GATE.md`](EVIDENCE_AND_RELEASE_GATE.md) — kryteria
   odbioru i decyzja końcowa.
6. [`DECISION_REGISTER.md`](DECISION_REGISTER.md) — decyzje Piotra i blokady.
7. [`CLAUDE_START_INSTRUCTIONS.md`](CLAUDE_START_INSTRUCTIONS.md) — stała
   instrukcja startowa implementatora.
8. [`INTEGRATION_CONSOLIDATION_PROGRAM.md`](INTEGRATION_CONSOLIDATION_PROGRAM.md)
   — nadrzędna strategia scalania istniejących fragmentów.
9. [`FRAGMENT_INVENTORY.md`](FRAGMENT_INVENTORY.md) — mapa równoległych i
   niedopiętych części.
10. [`INTEGRATION_GATE.md`](INTEGRATION_GATE.md) — bramka kompletnego
    przepływu frontend–backend–dane.
11. [`AGENT_TEAM_OPERATING_MODEL.md`](AGENT_TEAM_OPERATING_MODEL.md) — model
    zarządzania zespołem wyspecjalizowanych agentów Claude.
12. [`FULL_RECONNAISSANCE_AND_ROADMAP.md`](FULL_RECONNAISSANCE_AND_ROADMAP.md)
    — pełny remanent kodu i wiedzy oraz kolejność wszystkich fal.
13. [`MASTER_EXECUTION_PLAN.md`](MASTER_EXECUTION_PLAN.md) — pakiety,
    zależności i pełny plan wykonawczy bottom-up.
14. [`EXCEL_TECHNOLOGY_DECISION.md`](EXCEL_TECHNOLOGY_DECISION.md) — decyzja
    hybrydowa i spike silnika siatki.
15. [`TERESA_CONVERSATION_RECOVERY_PLAN.md`](TERESA_CONVERSATION_RECOVERY_PLAN.md)
    — naprawa dialogu według sprawdzonej architektury Malcolma.
16. [`AGREEMENTS/10_ASSESSMENT_REVIEW.md`](AGREEMENTS/10_ASSESSMENT_REVIEW.md)
    — karta modułu i indeks kompletnego pakietu wspólnego Assessment Workbencha,
    macierzy, wiedzy DRD/SIRI/ADMA, evidence, scoringu oraz Teresy.
17. [`AGREEMENTS/12_INTERVIEW_REVIEW.md`](AGREEMENTS/12_INTERVIEW_REVIEW.md)
    — skonsolidowany kontrakt dojrzałego modułu Interview, jego golden flows,
    prywatności, insights oraz integracji.
18. [`AGREEMENTS/AI_GENERATOR_ARTIFACT_STANDARD.md`](AGREEMENTS/AI_GENERATOR_ARTIFACT_STANDARD.md)
    — wspólny standard UX, danych, provenance, review i bezpieczeństwa dla
    generatorów AI.
19. [`AGREEMENTS/INSIGHT_GENERATOR_CONTRACT.md`](AGREEMENTS/INSIGHT_GENERATOR_CONTRACT.md)
    — kontrakt syntezy źródeł do zatwierdzanych Insight Candidates.
20. [`AGREEMENTS/INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md`](AGREEMENTS/INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md)
    — współdzielony generator Proposal Drafts dla modułów źródłowych.
21. [`AGREEMENTS/QUESTION_ARTIFACT_CONTRACT.md`](AGREEMENTS/QUESTION_ARTIFACT_CONTRACT.md)
    — kanoniczny, wersjonowany model pytania i jego profile metodologiczne.
22. [`AGREEMENTS/QUESTION_GENERATOR_CONTRACT.md`](AGREEMENTS/QUESTION_GENERATOR_CONTRACT.md)
    — generator pełnego instrumentu pytań, coverage, sekwencji i branchingu.
23. [`AGREEMENTS/INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md`](AGREEMENTS/INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md)
24. [`CLAUDE_PARALLEL_LAUNCH_PROMPTS_2026-08-01.md`](CLAUDE_PARALLEL_LAUNCH_PROMPTS_2026-08-01.md)
    — trzy gotowe, niekolidujące prompty dla równoległych linii Opusa: Materials,
    Finance i publiczne Demo/Auth.
    — pełny system pomocy w odpowiedzi, readiness check i manager review.
24. [`AGREEMENTS/MY_WORK_DOCUMENTATION_MAP.md`](AGREEMENTS/MY_WORK_DOCUMENTATION_MAP.md)
    — podział My Work na siedem osobnych pakietów oraz kolejność ich uzgodnień.
25. [`AGREEMENTS/MY_WORK_IDEAS_REVIEW.md`](AGREEMENTS/MY_WORK_IDEAS_REVIEW.md)
26. [`AGREEMENTS/MY_WORK_NOTES_REVIEW.md`](AGREEMENTS/MY_WORK_NOTES_REVIEW.md)
27. [`AGREEMENTS/MY_WORK_CALENDAR_REVIEW.md`](AGREEMENTS/MY_WORK_CALENDAR_REVIEW.md)
28. [`AGREEMENTS/MY_WORK_INBOX_REVIEW.md`](AGREEMENTS/MY_WORK_INBOX_REVIEW.md)
29. [`AGREEMENTS/UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md`](AGREEMENTS/UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md)
30. [`AGREEMENTS/UNIVERSAL_CONNECTORS_DOCUMENTATION_READINESS_AUDIT.md`](AGREEMENTS/UNIVERSAL_CONNECTORS_DOCUMENTATION_READINESS_AUDIT.md)
31. [`AGREEMENTS/MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md`](AGREEMENTS/MY_WORK_TASKS_AND_DECISIONS_OPERATING_SYSTEM.md)
    — wspólny model operacyjny decyzji, zadań, odpowiedzialności i handoffów.
32. [`AGREEMENTS/TASKS_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/TASKS_COMPLETE_PRODUCT_CONTRACT.md)
    — pełny lifecycle, karty, AI, quality gates i golden flows Tasks.
33. [`AGREEMENTS/DECISIONS_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/DECISIONS_COMPLETE_PRODUCT_CONTRACT.md)
    — pełny model Decisions z rozdzielonym outcome i workflow approval.
34. [`AGREEMENTS/TASKS_AND_DECISIONS_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md`](AGREEMENTS/TASKS_AND_DECISIONS_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md)
    — remanent runtime, priorytety MVP, decyzje właściciela i testy odbiorowe.
35. [`AGREEMENTS/MY_WORK_CLIENT_VAULT_REVIEW.md`](AGREEMENTS/MY_WORK_CLIENT_VAULT_REVIEW.md)
    — nadrzędny kontrakt Sejfu klienta jako warstwy kontekstu aplikacji.
36. [`AGREEMENTS/CLIENT_VAULT_INFORMATION_ARCHITECTURE_AND_FUNCTION_CATALOG.md`](AGREEMENTS/CLIENT_VAULT_INFORMATION_ARCHITECTURE_AND_FUNCTION_CATALOG.md)
37. [`AGREEMENTS/CLIENT_VAULT_INGESTION_INDEXING_AND_SYNCHRONIZATION_CONTRACT.md`](AGREEMENTS/CLIENT_VAULT_INGESTION_INDEXING_AND_SYNCHRONIZATION_CONTRACT.md)
38. [`AGREEMENTS/CLIENT_VAULT_AI_RETRIEVAL_CITATION_AND_KNOWLEDGE_CONTRACT.md`](AGREEMENTS/CLIENT_VAULT_AI_RETRIEVAL_CITATION_AND_KNOWLEDGE_CONTRACT.md)
39. [`AGREEMENTS/CLIENT_VAULT_SECURITY_GOVERNANCE_AND_LIFECYCLE_CONTRACT.md`](AGREEMENTS/CLIENT_VAULT_SECURITY_GOVERNANCE_AND_LIFECYCLE_CONTRACT.md)
40. [`AGREEMENTS/CLIENT_VAULT_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](AGREEMENTS/CLIENT_VAULT_AS_IS_MVP_GAPS_AND_QUESTIONS.md)
41. [`AGREEMENTS/CLIENT_VAULT_HARVEY_BENCHMARK_AND_CONSULTIFY_ADAPTATION.md`](AGREEMENTS/CLIENT_VAULT_HARVEY_BENCHMARK_AND_CONSULTIFY_ADAPTATION.md)
42. [`AGREEMENTS/CLIENT_VAULT_UI_UX_AND_AI_INTERACTION_STANDARD.md`](AGREEMENTS/CLIENT_VAULT_UI_UX_AND_AI_INTERACTION_STANDARD.md)
43. [`AGREEMENTS/CLIENT_VAULT_END_TO_END_WORKFLOWS_AND_HANDOFFS.md`](AGREEMENTS/CLIENT_VAULT_END_TO_END_WORKFLOWS_AND_HANDOFFS.md)
44. [`AGREEMENTS/CLIENT_VAULT_DATA_API_EVENTS_AND_OBSERVABILITY_BLUEPRINT.md`](AGREEMENTS/CLIENT_VAULT_DATA_API_EVENTS_AND_OBSERVABILITY_BLUEPRINT.md)
45. [`AGREEMENTS/MY_WORK_RUN_AGENT_REVIEW.md`](AGREEMENTS/MY_WORK_RUN_AGENT_REVIEW.md)
46. [`AGREEMENTS/RUN_AGENT_BENCHMARK_AND_PRODUCT_DOCTRINE.md`](AGREEMENTS/RUN_AGENT_BENCHMARK_AND_PRODUCT_DOCTRINE.md)
47. [`AGREEMENTS/RUN_AGENT_INFORMATION_ARCHITECTURE_AND_UX_STANDARD.md`](AGREEMENTS/RUN_AGENT_INFORMATION_ARCHITECTURE_AND_UX_STANDARD.md)
48. [`AGREEMENTS/RUN_AGENT_PROCESS_MODEL_AND_BLOCK_CATALOG.md`](AGREEMENTS/RUN_AGENT_PROCESS_MODEL_AND_BLOCK_CATALOG.md)
49. [`AGREEMENTS/RUN_AGENT_TERESA_COPILOT_AND_PROCESS_DESIGN_STANDARD.md`](AGREEMENTS/RUN_AGENT_TERESA_COPILOT_AND_PROCESS_DESIGN_STANDARD.md)
50. [`AGREEMENTS/RUN_AGENT_EXECUTION_APPROVALS_RESILIENCE_AND_SECURITY.md`](AGREEMENTS/RUN_AGENT_EXECUTION_APPROVALS_RESILIENCE_AND_SECURITY.md)
51. [`AGREEMENTS/RUN_AGENT_CROSS_MODULE_AND_CONNECTOR_CONTRACT.md`](AGREEMENTS/RUN_AGENT_CROSS_MODULE_AND_CONNECTOR_CONTRACT.md)
52. [`AGREEMENTS/RUN_AGENT_DATA_API_EVENTS_AND_OBSERVABILITY_BLUEPRINT.md`](AGREEMENTS/RUN_AGENT_DATA_API_EVENTS_AND_OBSERVABILITY_BLUEPRINT.md)
53. [`AGREEMENTS/RUN_AGENT_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md`](AGREEMENTS/RUN_AGENT_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md)
54. [`AGREEMENTS/RUN_AGENT_ROLES_MANUAL_EDITING_TERESA_AND_CONNECTIONS_AUDIT.md`](AGREEMENTS/RUN_AGENT_ROLES_MANUAL_EDITING_TERESA_AND_CONNECTIONS_AUDIT.md)
55. [`AGREEMENTS/MY_WORK_MANAGER_REVIEW.md`](AGREEMENTS/MY_WORK_MANAGER_REVIEW.md)
    — pełny draft Managera jako kokpitu zarządzania przez wyjątki.
56. [`AGREEMENTS/MANAGER_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md`](AGREEMENTS/MANAGER_AS_IS_MVP_GAPS_AND_GOLDEN_FLOWS.md)
    — remanent istniejącego dashboardu, luka wiarygodności capacity i bramki MVP.
57. [`AGREEMENTS/CANVAS_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/CANVAS_COMPLETE_PRODUCT_CONTRACT.md)
    — definicja Canvasu, artefakty, lifecycle, ręczna praca i materializacja.
58. [`AGREEMENTS/CANVAS_INFORMATION_ARCHITECTURE_MENU_AND_INTERACTION_STANDARD.md`](AGREEMENTS/CANVAS_INFORMATION_ARCHITECTURE_MENU_AND_INTERACTION_STANDARD.md)
    — wspólny shell, menu, selection UX, inspector, recovery i responsive.
59. [`AGREEMENTS/CANVAS_TERESA_COLLABORATION_SOURCES_AND_HANDOFF_CONTRACT.md`](AGREEMENTS/CANVAS_TERESA_COLLABORATION_SOURCES_AND_HANDOFF_CONTRACT.md)
    — granice Teresy, evidence, review, connectory i handoff do modułów.
60. [`AGREEMENTS/CANVAS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md`](AGREEMENTS/CANVAS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md)
    — remanent rzeczywistego runtime, P0/P1 i testy odbiorowe Canvasu.
61. [`AGREEMENTS/CANVAS_CLAUDE_OPENAI_BENCHMARK_AND_PRODUCT_ADAPTATION.md`](AGREEMENTS/CANVAS_CLAUDE_OPENAI_BENCHMARK_AND_PRODUCT_ADAPTATION.md)
    — aktualny benchmark OpenAI Canvas i Claude Artifacts oraz decyzje Consultify.
62. [`AGREEMENTS/CANVAS_FLEXIBLE_ARTIFACT_RUNTIME_TECHNICAL_BLUEPRINT.md`](AGREEMENTS/CANVAS_FLEXIBLE_ARTIFACT_RUNTIME_TECHNICAL_BLUEPRINT.md)
    — Artifact Host, runtime registry, Host SDK, sandbox i Module Gateway.
63. [`AGREEMENTS/CHAT_TERESA_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/CHAT_TERESA_COMPLETE_PRODUCT_CONTRACT.md)
    — misja, funkcje, wiadomości, rezultaty i granice autonomii Teresy.
64. [`AGREEMENTS/CHAT_HISTORY_THREADS_LIBRARY_AND_MEMORY_CONTRACT.md`](AGREEMENTS/CHAT_HISTORY_THREADS_LIBRARY_AND_MEMORY_CONTRACT.md)
    — historia, search, foldery, branchowanie, retencja i pamięć.
65. [`AGREEMENTS/CHAT_COMPOSER_TOOLS_COMMANDS_AND_OUTPUTS_CATALOG.md`](AGREEMENTS/CHAT_COMPOSER_TOOLS_COMMANDS_AND_OUTPUTS_CATALOG.md)
    — composer, attachments, mentions, slash commands, voice i output routing.
66. [`AGREEMENTS/CHAT_TERESA_ORCHESTRATION_MODULE_COMMUNICATION_AND_GOVERNANCE.md`](AGREEMENTS/CHAT_TERESA_ORCHESTRATION_MODULE_COMMUNICATION_AND_GOVERNANCE.md)
    — tool registry, approval, scope, moduły, błędy i obserwowalność.
67. [`AGREEMENTS/CHAT_AS_IS_FUNCTION_INVENTORY_MVP_GAPS_AND_GOLDEN_FLOWS.md`](AGREEMENTS/CHAT_AS_IS_FUNCTION_INVENTORY_MVP_GAPS_AND_GOLDEN_FLOWS.md)
    — remanent runtime, P0/P1 i testy odbiorowe pełnego Chatu.
68. [`AGREEMENTS/SETTINGS_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/SETTINGS_COMPLETE_PRODUCT_CONTRACT.md)
    — pełny katalog ustawień osobistych i granica wobec Admin Panelu.
69. [`AGREEMENTS/SETTINGS_INFORMATION_ARCHITECTURE_OWNERSHIP_AND_INHERITANCE.md`](AGREEMENTS/SETTINGS_INFORMATION_ARCHITECTURE_OWNERSHIP_AND_INHERITANCE.md)
    — uproszczona IA, ownerzy i effective settings inheritance.
70. [`AGREEMENTS/SETTINGS_DATA_SECURITY_INTEGRATIONS_AND_CHANGE_CONTRACT.md`](AGREEMENTS/SETTINGS_DATA_SECURITY_INTEGRATIONS_AND_CHANGE_CONTRACT.md)
    — save/read-back, sekrety, connectory, powiadomienia i audit.
71. [`AGREEMENTS/SETTINGS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md`](AGREEMENTS/SETTINGS_AS_IS_MVP_GAPS_GOLDEN_FLOWS_AND_AUDIT.md)
    — uczciwy remanent, P0/P1 oraz testy odbiorowe Settings.
72. [`AGREEMENTS/USER_PROFILE_COMPLETE_CONTRACT_BENCHMARK_AND_VISIBILITY.md`](AGREEMENTS/USER_PROFILE_COMPLETE_CONTRACT_BENCHMARK_AND_VISIBILITY.md)
    — kompletny profil, benchmark, role, availability, AI i widoczność per pole.
73. [`AGREEMENTS/USER_PROFILE_AS_IS_GAPS_DATA_CONSOLIDATION_AND_GOLDEN_FLOWS.md`](AGREEMENTS/USER_PROFILE_AS_IS_GAPS_DATA_CONSOLIDATION_AND_GOLDEN_FLOWS.md)
74. [`AGREEMENTS/ADMIN_PANEL_COMPLETE_PRODUCT_CONTRACT.md`](AGREEMENTS/ADMIN_PANEL_COMPLETE_PRODUCT_CONTRACT.md)
    — rola panelu, pełna architektura informacji, wspólny standard ekranów i granice.
75. [`AGREEMENTS/ADMIN_PANEL_ROLES_TEAMS_PROJECTS_AND_WORKFLOWS.md`](AGREEMENTS/ADMIN_PANEL_ROLES_TEAMS_PROJECTS_AND_WORKFLOWS.md)
    — role aplikacyjne i projektowe, zespoły, ManagerScope oraz governance inicjatyw.
76. [`AGREEMENTS/ADMIN_PANEL_AI_TERESA_CONNECTIONS_AND_POLICY_ENGINE.md`](AGREEMENTS/ADMIN_PANEL_AI_TERESA_CONNECTIONS_AND_POLICY_ENGINE.md)
    — polityki AI/Teresy, modele, budżety, autonomia, connectors i lifecycle polityki.
77. [`AGREEMENTS/ADMIN_PANEL_SECURITY_DATA_BILLING_AUDIT_AND_SUPERADMIN_BOUNDARY.md`](AGREEMENTS/ADMIN_PANEL_SECURITY_DATA_BILLING_AUDIT_AND_SUPERADMIN_BOUNDARY.md)
    — bezpieczeństwo, dane, billing, audyt i twarda granica tenant Admin/Superadmin.
78. [`AGREEMENTS/ADMIN_PANEL_MARKET_BENCHMARK_AS_IS_GAPS_AND_GOLDEN_FLOWS.md`](AGREEMENTS/ADMIN_PANEL_MARKET_BENCHMARK_AS_IS_GAPS_AND_GOLDEN_FLOWS.md)
    — benchmark Asana/Slack/Entra, remanent kodu, P0-P2 i komplet przepływów odbiorowych.
79. [`../../ui-standards/02-components/COMPONENT_CATALOG_AND_OWNERSHIP_REGISTRY.md`](../../ui-standards/02-components/COMPONENT_CATALOG_AND_OWNERSHIP_REGISTRY.md)
    — wspólny rejestr rodzin komponentów UI/UX, implementacji i odpowiedzialności.
80. [`../../ui-standards/02-components/COMPONENT_DOCUMENTATION_CARD_STANDARD.md`](../../ui-standards/02-components/COMPONENT_DOCUMENTATION_CARD_STANDARD.md)
    — format pełnej dokumentacji komponentu i jego Definition of Done.
81. [`../../ui-standards/02-components/COMPONENT_UI_UX_AUDIT_AND_ACCEPTANCE_MATRIX.md`](../../ui-standards/02-components/COMPONENT_UI_UX_AUDIT_AND_ACCEPTANCE_MATRIX.md)
    — macierz odbioru komponentów, fale audytu i wymogi dla zadań agentów.
82. [`AGREEMENTS/UI_COMPONENT_STANDARD_ADOPTION_AUDIT_2026-07-31.md`](AGREEMENTS/UI_COMPONENT_STANDARD_ADOPTION_AUDIT_2026-07-31.md)
    — zweryfikowana adopcja komponentów, 409 zastanych naruszeń, ocena modułów MVP i plan bezpiecznej migracji.
83. [`UI_UX_GATE_0.md`](UI_UX_GATE_0.md)
    — stała bramka UI/UX każdej paczki: component IDs, malejący baseline, visual/behavioral DoD i brak big-bang refaktoru.
84. [`MASTER_PRODUCT_DECISIONS_FOR_APPROVAL.md`](MASTER_PRODUCT_DECISIONS_FOR_APPROVAL.md)
    — skonsolidowane decyzje A1–A24, bezpieczne defaulty D1–D20, elementy odłożone i POC wymagające decyzji biznesowej.
85. [`CROSS_MODULE_FINAL_CONSISTENCY_AUDIT.md`](CROSS_MODULE_FINAL_CONSISTENCY_AUDIT.md)
    — końcowy audyt nazw, ownership, statusów, artefaktów, Teresy, Canvasu i golden thread.
86. [`MVP_GOLDEN_FLOW_MASTER_MAP.md`](MVP_GOLDEN_FLOW_MASTER_MAP.md)
    — dziesięć golden flows MVP w kolejności bottom-up oraz jeden przepływ przekrojowy.
87. [`MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md`](MVP_FUNCTION_IMPLEMENTATION_STATUS_LEDGER.md)
    — statusy działa/częściowa/atrapa/niepodłączona/brak i pierwsza klasyfikacja funkcji.
88. [`CLAUDE_EXECUTION_BACKLOG_V1.md`](CLAUDE_EXECUTION_BACKLOG_V1.md)
    — małe paczki wykonawcze w falach od kontraktów przez Materials do Chat.
89. [`PACKETS/CORE-ART-001_ARTIFACT_ENVELOPE_AUDIT.md`](PACKETS/CORE-ART-001_ARTIFACT_ENVELOPE_AUDIT.md)
    — pierwsza uruchomiona paczka Fali 0: read-only audyt wspólnego Artifact envelope i lifecycle.
90. [`PACKETS/CORE-ART-002_CONTRACT_PARITY.md`](PACKETS/CORE-ART-002_CONTRACT_PARITY.md)
    — pierwsza mała naprawa: parity DTO/enums klient–serwer oraz kompatybilne `isDraft` schema.
91. [`MORNING_MVP_ACCEPTANCE_HANDOFF_2026-08-01.md`](MORNING_MVP_ACCEPTANCE_HANDOFF_2026-08-01.md)
    — aktualny stan przyjętych paczek, jawne blokady, recovery i kolejność porannego odbioru.
92. [`PACKETS/EXE-002_MANAGEMENT_SPINE_AUDIT.md`](PACKETS/EXE-002_MANAGEMENT_SPINE_AUDIT.md)
    — audyt rozproszonych pionów Execution i minimalny kontrakt wspólnego management snapshotu.
93. [`PACKETS/INI-001_INITIATIVES_MVP_AUDIT.md`](PACKETS/INI-001_INITIATIVES_MVP_AUDIT.md)
    — remanent Initiatives od Candidate przez approval i Roadmap do same-ID handoffu Execution.
94. [`PACKETS/ASM-001_ASSESSMENT_MVP_AUDIT.md`](PACKETS/ASM-001_ASSESSMENT_MVP_AUDIT.md)
    — audyt pięciu powierzchni Assessment oraz minimalny DRD Form–Matrix round-trip.
95. [`ARTIFACT_STABILIZATION_COMPLETION_AUDIT_2026-08-01.md`](ARTIFACT_STABILIZATION_COMPLETION_AUDIT_2026-08-01.md)
    — wymaganie-po-wymaganiu dowód zamknięcia Artifact Read-back, Wave5, Canvas i quorum.
91. [`PACKETS/CORE-ART-003A_RETRY_GUARD_AND_PARENT_IMMUTABILITY.md`](PACKETS/CORE-ART-003A_RETRY_GUARD_AND_PARENT_IMMUTABILITY.md)
    — bezpieczna macierz retry, niemutowalny rodzic, lineage i idempotency/concurrency gate.
    — remanent profilu, zdegradowane endpointy, konsolidacja danych i testy.
    — wspólny kontrakt Ideas i indeks czterech współpracujących narzędzi.
26. [`AGREEMENTS/IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md`](AGREEMENTS/IDEAS_ARTIFACT_SHARED_SHELL_AND_MENU_STANDARD.md)
    — wspólna anatomia ekranu, menu i mechanika czterech artefaktów Ideas.
27. [`AGREEMENTS/IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md`](AGREEMENTS/IDEAS_MIND_MAP_INTERACTION_AND_VISUAL_STANDARD.md)
    — pełna specyfikacja sterowania, menu, grafiki, template i AI dla Mind Map.
28. [`AGREEMENTS/IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md`](AGREEMENTS/IDEAS_FOUR_TOOLS_AS_IS_MVP_GAPS_AND_QUESTIONS.md)
    — remanent kodu, różnice do MVP, wejścia/wyjścia i jawny rejestr pytań.
29. [`AGREEMENTS/IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md`](AGREEMENTS/IDEAS_TABLE_INTERACTION_AND_VISUAL_STANDARD.md)
    — kompletna specyfikacja Table po benchmarku Airtable/Miro.
30. [`AGREEMENTS/IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md`](AGREEMENTS/IDEAS_PROCESS_FLOW_INTERACTION_AND_VISUAL_STANDARD.md)
    — kompletna specyfikacja Process Flow po benchmarku Miro/Lucidchart.
31. [`AGREEMENTS/IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md`](AGREEMENTS/IDEAS_WHITEBOARD_INTERACTION_AND_VISUAL_STANDARD.md)
    — kompletna specyfikacja Whiteboard po benchmarku FigJam/Miro.

## Rytm pracy

1. Codex wybiera najwyższy gotowy element z boardu.
2. Jeśli zakres jest niejasny, przechodzi przez proces koncepcyjny.
3. Codex przygotowuje zamknięty pakiet zadania.
4. Claude implementuje i zwraca raport oraz dowody.
5. Codex przegląda diff, uruchamia niezależną bramkę i aktualizuje SSOT.
6. Piotr odbiera rezultat biznesowo, gdy wymaga oceny produktu.
7. Dopiero wtedy zadanie otrzymuje `ACCEPTED`.

WIP: maksymalnie jedno zadanie P0 lub dwa niezależne zadania P1 jednocześnie.
