---
uiux_doc_id: UIUX_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026_05_09
doc_kind: RAW_REFERENCE
version: 1.0
owner: user
status: raw
last_updated: 2026-05-09
---

# Raw input — Conversational Work OS / Teresa Chat Engine (2026-05-09)

Poniżej: surowe założenia autora (produkt + architektura) wklejone **verbatim**.

---

## VERBATIM

Consultify Conversational Work OS
Dokument produktowo-architektoniczny dla modułu AI Chat / Teresa Chat Engine
1. Executive summary
Consultify Conversational Work OS nie powinien być zwykłym czatem AI. To powinien być centralny interfejs operacyjny całego Consultify: miejsce, w którym użytkownik zaczyna od rozmowy, ale kończy na realnym efekcie pracy — dokumencie, tabeli, prezentacji, raporcie, decyzji, tasku, inicjatywie, workflow lub planie wykonania.
Najważniejsza logika produktu:
conversation → context → artifact → decision → task → execution → report
W klasycznych systemach AI użytkownik pisze pytanie i dostaje odpowiedź. W systemie consulting execution to za mało. Konsultant, manager albo lider transformacji musi przejść od myślenia do działania: od pytania do analizy, od analizy do dokumentu, od dokumentu do tasków, od tasków do decyzji, od decyzji do raportowania wykonania.
Dlatego Consultify Chat powinien być zbudowany jako AI-native conversational execution layer, czyli rozmowny system pracy, który łączy:
rozmowę, dane, pliki, modele AI, narzędzia, artifacty, projekty, historię, pamięć, źródła, cytowania, decyzje, taski, research, raporty, głos, multimodalność, workflow, approvale i governance.
To podejście jest spójne z logiką Digital Roadmap: transformacja nie jest jednorazowym projektem, lecz procesem opartym o analizę aktualnego stanu, inicjatywy, plan wykonania i ciągłą korektę kierunku.
2. Benchmark rynku — najważniejsze wnioski
2.1. Syntetyczny benchmark 10 systemów
System	Co realnie ma	Najważniejszy wzorzec dla Consultify	Czego nie kopiować 1:1
ChatGPT	Projekty, pamięć projektową, pliki, historię, modele, narzędzia, zadania, canvas, shared projects. OpenAI opisuje Projects jako przestrzeń, która pamięta rozmowy i pliki w projekcie; przeniesiona rozmowa dziedziczy instrukcje i kontekst plików projektu.	Project memory, historia rozmów, model selector, file context, canvas/artifact flow.	Nie kopiować uniwersalnego, poziomego „assistant UX” bez silnego execution layer.
Claude	Projects i Artifacts. Anthropic opisuje Artifacts jako dedykowane okno obok rozmowy, gdzie użytkownik widzi, edytuje i buduje z Claude kod, dokumenty, grafiki, diagramy i strony.	Side artifact workspace, conversation + workbench, długi kontekst, spokojny UX.	Claude jest świetny do pracy artifactowej, ale nie jest pełnym PMO/execution system.
Gemini / Google Workspace	Gemini w Gmail, Docs, Sheets, Slides, Drive, Chat i Meet; side panel działa w aplikacjach Workspace, a Gemini może pomagać pisać, analizować i podsumowywać w przepływie pracy.	AI w kontekście dokumentów i danych roboczych, side panel, integracje z plikami.	Nie zamykać Consultify w jednym ekosystemie typu Google.
Microsoft 365 Copilot / Teams Copilot	Graph-grounded work context: Copilot korzysta z danych, do których użytkownik ma uprawnienia — maili, chatów i dokumentów — oraz respektuje kontrolę dostępu.	Permission-aware enterprise grounding, meeting recap, task extraction, Graph-like context model.	Nie budować zależności wyłącznie od M365; Consultify musi mieć własny context graph.
Perplexity	Spaces jako dedykowane przestrzenie do organizacji, współpracy i zarządzania researchami oraz zadaniami; źródła są centralnym elementem UX.	Source-first research UX, citation cards, research spaces.	Nie ograniczać się do researchu; Consultify musi przechodzić do wykonania.
Cursor	Agent, Rules, MCP, Skills, CLI, model selection i praca AI wewnątrz środowiska kodu. Oficjalna dokumentacja Cursor obejmuje Agent mode, MCP, modele i konfigurację enterprise.	AI działa w środowisku pracy, nie tylko odpowiada; context selection, diff, approval, apply changes.	Nie kopiować kodowego UX; przenieść wzorzec „apply with approval” na consulting artifacts.
Notion AI	Notion Agent może używać kontekstu workspace i połączonych aplikacji do tworzenia i edycji stron oraz baz danych; obsługuje Enterprise Search, Research Mode, AI Meeting Notes, AI blocks, database creation i Plan Mode z review/approval.	AI embedded in workspace, page/database context, approve-before-run plan mode.	Nie robić tylko dokumentowego workspace; Consultify musi mieć taski, decyzje i execution.
Slack AI	Podsumowania kanałów, DM i threadów, recap, wyszukiwanie odpowiedzi z cytowaniami do wiadomości i plików.	Komunikacja jako źródło trwałego kontekstu; source citations w komunikacji.	Nie traktować komunikacji jako archiwum; trzeba wydobywać decyzje, ryzyka i taski.
Teams Copilot	Podsumowania spotkań, action items i odpowiedzi na pytania podczas lub po spotkaniu; Teams Recap może generować follow-up tasks.	Meeting → transcript → decisions/tasks/follow-up.	Nie robić tylko notatek ze spotkań; rozmowa musi zasilać Execution Hub.
Harvey	Assistant, Vault, Knowledge, Workflow Agents, Mobile, Ecosystem i Harvey Agents. Harvey deklaruje, że agenci wykonują legal work end-to-end, a Vault przechowuje do 100 tys. dokumentów z integracjami DMS i kontrolą uprawnień.	Professional workflow AI: domenowe agenty, vault, matter/project context, source grounding, governance.	Harvey jest domenowo prawny; Consultify musi zbudować analog dla consulting execution.
3. Kluczowy insight rynkowy
Rynek przeszedł drogę:
chatbot → AI assistant → AI copilot → AI workspace → AI agent → AI work operating system
ChatGPT buduje uniwersalne AI workspace z projektami i pamięcią projektową. Claude pokazał, że rozmowa i artifact muszą żyć obok siebie. Gemini i Copilot pokazują, że AI musi być zanurzone w danych organizacyjnych. Perplexity pokazuje, że research bez źródeł traci zaufanie. Cursor pokazuje, że AI powinno działać w środowisku pracy i proponować zmiany. Notion AI pokazuje, że AI może tworzyć i edytować obiekty workspace. Slack i Teams pokazują, że komunikacja jest kopalnią kontekstu. Harvey pokazuje, że profesjonalna praca AI wymaga workflow, źródeł, dokumentów, permissioningu i domenowej logiki.
Najważniejszy wniosek:
Consultify Chat nie powinien być ChatGPT-em wklejonym do aplikacji. Consultify Chat powinien być operacyjnym interfejsem całego Consultify.
4. Rekomendowana nazwa modułu
Rekomendacja: Consultify Conversational Work OS
Alternatywna nazwa produktowa dla użytkownika: Teresa Workspace
Alternatywna nazwa techniczna: Consultify AI Interaction Layer
Dlaczego nie „AI Chat”? Bo to zbyt wąskie. Ten moduł obsługuje nie tylko rozmowę, ale też wybór modelu, wybór danych, załączniki, voice, artifacty, tryby pracy, historię, projekty, pamięć, taski, decyzje, raportowanie, workflow, approvale, integracje i governance.
Teresa powinna być personą interakcyjną, ale architektonicznie moduł powinien nazywać się szerzej: Conversational Work OS.
5. Docelowa definicja produktu
Consultify Conversational Work OS to centralny interfejs pracy z AI w Consultify, który łączy rozmowę, dane, pliki, modele, narzędzia, artifacty, projekty, historię, pamięć i governance. Użytkownik rozmawia z Teresą w trybach Auto, Dokumenty, Tabele, Prezentacje oraz w trybach specjalistycznych, a system prowadzi go od pytania do analizy, od analizy do artifactu, od artifactu do decyzji, od decyzji do tasków i od tasków do wykonania.
System pokazuje, z jakiego modelu i jakich danych korzysta AI, pozwala tworzyć dokumenty, tabele, prezentacje, raporty, taski, decyzje, inicjatywy i plany, zapisuje wyniki do projektów, zarządza historią rozmów operacyjnie, kontroluje pamięć przez scope i retention, wspiera voice, attachments, citations, source governance i approvale.
To nie jest kopia ChatGPT, Claude ani Copilot. To jest consulting-grade conversational execution layer.
6. Docelowy model pojęciowy systemu
Poniżej skrócony model danych. W produkcji każdy obiekt powinien mieć: tenant_id, created_by, updated_by, permissions, audit_metadata, retention_policy.
{
  "Conversation": {
    "conversation_id": "conv_001",
    "title": "Analiza oszczędności w projekcie VTS",
    "user_id": "user_123",
    "organization_id": "org_001",
    "project_id": "proj_456",
    "mode": "Financial Analysis",
    "status": "Active",
    "visibility": "internal",
    "created_at": "2026-05-09T12:10:00+02:00",
    "updated_at": "2026-05-09T12:45:00+02:00",
    "last_message_at": "2026-05-09T12:45:00+02:00",
    "pinned": true,
    "archived": false,
    "tags": ["cost_saving", "client_analysis"],
    "linked_artifacts": ["doc_001", "table_002"],
    "linked_tasks": ["task_001"],
    "linked_decisions": ["dec_001"],
    "linked_initiatives": ["init_001"],
    "memory_scope": "project",
    "data_scope": "current_project",
    "model_used": "reasoning_high",
    "system_prompt_version": "cwos_v1.3",
    "conversation_summary": "Analiza potencjalnych oszczędności...",
    "ai_generated_title": true
  },
  "Message": {
    "message_id": "msg_001",
    "conversation_id": "conv_001",
    "sender_type": "user",
    "sender_id": "user_123",
    "content": "Przeanalizuj plik i znajdź quick wins.",
    "content_type": "text",
    "created_at": "2026-05-09T12:11:00+02:00",
    "edited_at": null,
    "model_used": null,
    "tokens_input": 1200,
    "tokens_output": 0,
    "sources": [],
    "citations": [],
    "attachments": ["att_001"],
    "tool_calls": [],
    "generated_artifacts": [],
    "extracted_tasks": [],
    "extracted_decisions": [],
    "confidence_score": null,
    "user_feedback": null,
    "visibility": "internal",
    "audit_metadata": {"ip": "masked", "risk_level": "low"}
  },
  "ChatSession": {
    "session_id": "sess_001",
    "conversation_id": "conv_001",
    "active_model": "reasoning_high",
    "active_mode": "Auto",
    "active_data_scope": "current_project",
    "active_tools": ["file_search", "artifact_builder", "task_extractor"],
    "active_files": ["att_001"],
    "active_project": "proj_456",
    "active_memory_scope": "project",
    "temporary_mode": false,
    "voice_enabled": false,
    "deep_thinking_enabled": true,
    "started_at": "2026-05-09T12:10:00+02:00",
    "ended_at": null
  },
  "ProjectContext": {
    "project_context_id": "pctx_001",
    "project_id": "proj_456",
    "name": "VTS Operational Improvement",
    "description": "Projekt analizy procesów i oszczędności",
    "active_documents": ["doc_001"],
    "active_tables": ["table_002"],
    "active_presentations": [],
    "active_tasks": ["task_001"],
    "active_decisions": ["dec_001"],
    "active_initiatives": ["init_001"],
    "active_sources": ["crm", "uploaded_files", "project_notes"],
    "project_memory": ["mem_001"],
    "permissions": ["consultant", "manager"],
    "created_at": "2026-05-01T09:00:00+02:00",
    "updated_at": "2026-05-09T12:45:00+02:00"
  },
  "AIModelProfile": {
    "model_profile_id": "model_001",
    "provider": "openai_or_other",
    "model_name": "reasoning_high",
    "display_name": "Deep Reasoning",
    "capability_tags": ["reasoning", "files", "tools", "long_context"],
    "context_window": 200000,
    "cost_level": "high",
    "speed_level": "medium",
    "reasoning_level": "high",
    "multimodal_support": true,
    "tool_support": true,
    "allowed_for_sensitive_data": true,
    "default_use_cases": ["strategy", "legal_review", "financial_analysis"],
    "limitations": ["higher_cost", "slower_latency"]
  },
  "DataScope": {
    "data_scope_id": "ds_001",
    "name": "Current Project",
    "scope_type": "project",
    "allowed_sources": ["project_files", "project_tasks", "project_decisions", "project_memory"],
    "excluded_sources": ["public_web"],
    "permissions_required": ["project_member"],
    "default_for_role": ["consultant", "project_manager"],
    "citations_required": true,
    "retention_policy": "project_default",
    "audit_policy": "full"
  },
  "Attachment": {
    "attachment_id": "att_001",
    "conversation_id": "conv_001",
    "message_id": "msg_001",
    "file_name": "cost_analysis.pdf",
    "file_type": "pdf",
    "file_size": 5242880,
    "storage_location": "tenant_bucket/path/file.pdf",
    "parsed_text": "extracted_text_pointer",
    "metadata": {"pages": 42, "language": "pl"},
    "extraction_status": "parsed",
    "linked_artifacts": [],
    "security_classification": "confidential",
    "uploaded_by": "user_123",
    "created_at": "2026-05-09T12:11:00+02:00"
  },
  "ToolCall": {
    "tool_call_id": "tool_001",
    "conversation_id": "conv_001",
    "message_id": "msg_002",
    "tool_name": "create_task",
    "tool_type": "execution",
    "input_parameters": {"title": "Zweryfikować oszczędności w linii A"},
    "output_summary": "Task candidate created",
    "status": "waiting_for_approval",
    "requires_approval": true,
    "approved_by": null,
    "executed_at": null,
    "error_message": null,
    "audit_log_id": "audit_001"
  },
  "ChatMode": {
    "mode_id": "mode_documents",
    "name": "Dokumenty",
    "description": "Tworzenie i edycja dokumentów",
    "default_model": "reasoning_medium",
    "default_tools": ["document_builder", "file_search"],
    "default_prompt": "Create structured consulting document...",
    "output_type": "document",
    "artifact_type": "docx_pdf",
    "required_confirmation": true,
    "allowed_data_scopes": ["uploaded_files", "current_project", "organization_knowledge"]
  },
  "PromptSuggestion": {
    "suggestion_id": "ps_001",
    "label": "Dzienny brief",
    "prompt_text": "Przygotuj dzienny brief z projektów, tasków, decyzji i ryzyk.",
    "category": "management",
    "mode": "Execution",
    "target_role": "manager",
    "linked_workflow": "daily_brief",
    "priority": 1,
    "visible_on_home": true,
    "created_at": "2026-05-09T08:00:00+02:00"
  },
  "ConversationMemory": {
    "memory_id": "mem_001",
    "scope": "project",
    "subject": "Client preference",
    "content": "Klient preferuje raporty w języku angielskim z executive summary.",
    "source_conversation_id": "conv_001",
    "confidence": 0.91,
    "retention_policy": "project_lifetime",
    "approved_by_user": true,
    "created_at": "2026-05-09T12:40:00+02:00",
    "updated_at": "2026-05-09T12:40:00+02:00"
  },
  "ChatAction": {
    "action_id": "act_001",
    "conversation_id": "conv_001",
    "action_type": "create_decision",
    "label": "Utwórz decyzję o rozpoczęciu analizy oszczędności",
    "target_object_type": "decision",
    "target_object_id": null,
    "proposed_by": "ai",
    "status": "proposed",
    "requires_approval": true,
    "approved_by": null,
    "created_at": "2026-05-09T12:42:00+02:00",
    "executed_at": null
  },
  "VoiceInteraction": {
    "voice_interaction_id": "voice_001",
    "conversation_id": "conv_001",
    "audio_input_id": "audio_001",
    "transcript": "Zapisz, że musimy sprawdzić koszt przestojów.",
    "language": "pl",
    "detected_intent": "create_task_candidate",
    "response_audio_id": "audio_resp_001",
    "extracted_tasks": ["task_candidate_001"],
    "extracted_decisions": [],
    "confidence": 0.88,
    "created_at": "2026-05-09T12:50:00+02:00"
  },
  "ChatAuditLog": {
    "audit_log_id": "audit_001",
    "object_type": "tool_call",
    "object_id": "tool_001",
    "actor_id": "ai_or_user",
    "action": "proposed_create_task",
    "before_state": null,
    "after_state": {"status": "waiting_for_approval"},
    "timestamp": "2026-05-09T12:43:00+02:00",
    "ip_address": "masked",
    "model_used": "reasoning_high",
    "tool_used": "create_task",
    "risk_level": "medium"
  }
}
7. Kluczowe moduły funkcjonalne
A. Chat Home / Empty State
Ekran startowy czata powinien być „cockpitem wejścia do pracy”, a nie pustym polem promptu.
Elementy:
powitanie: „Porozmawiaj z Teresą, Piotr”;
krótka obietnica: „Twoja partnerka AI do decyzji, notatek, projektów i kolejnych kroków”;
główny input;
chips: Auto, Dokumenty, Tabele, Prezentacje;
quick prompts: Dzienny brief, Szybkie oszczędności, Pomysł na produkt, Przegląd planów;
ostatnie rozmowy;
ostatnie projekty;
sugerowane następne akcje;
pending approvals;
ostatnio wygenerowane artifacty;
onboarding tip: „Dodaj plik, wybierz Data Scope albo użyj głosu”.
B. Prompt Input Engine
Powinien obsługiwać:
tekst, multiline prompt, slash commands, mention people, mention projects, mention files, mention tasks, mention decisions, prompt templates, autosave draftu, prompt history, prompt improvement hints, send mode: normal / deep thinking / client-ready / private.
Przykładowe komendy:
/document
/table
/presentation
/research
/task
/decision
/brief
/client-ready
/private
/compare
/summarize
C. Attachment & File Engine
Obsługa:
PDF, DOCX, XLSX, CSV, PPTX, TXT, obrazy, audio, transkrypty, ZIP projektowy.
Funkcje:
upload;
preview;
parsing;
OCR tylko jako fallback;
security classification;
source cards;
file-to-summary;
file-to-artifact;
file-to-task;
file-to-decision;
file-to-risk-register.
D. Data Scope Selector
To jest jeden z najważniejszych elementów.
Data Scope musi odpowiadać na pytanie:
Na jakich danych Teresa właśnie pracuje?
Opcje:
brak danych firmowych;
tylko bieżąca rozmowa;
tylko załączone pliki;
bieżący projekt;
bieżący klient;
wiedza organizacji;
CRM;
dokumenty;
tabele;
prezentacje;
Execution Hub;
research database;
public web;
restricted internal;
private mode.
UI musi pokazywać:
aktywne źródła;
wyłączone źródła;
poziom zaufania;
czy cytowania są wymagane;
czy dane mogą trafić do pamięci;
czy wynik może być client-ready.
E. Model Selector
Model selector nie może być listą technicznych nazw. Musi być decyzyjny:
Fast;
Deep Reasoning;
Low Cost;
File Analyst;
Research;
Document Writer;
Table Builder;
Multimodal;
Private / Local;
Enterprise Approved.
Pokazywać:
koszt, szybkość, jakość reasoning, context window, file support, tool support, privacy policy, allowed data classes.
F. Chat Modes Engine
Tryby podstawowe:
Auto;
Dokumenty;
Tabele;
Prezentacje.
Tryby docelowe:
Research;
Analysis;
Strategy;
Financial;
Classic Consulting;
Digital Transformation;
Execution;
PMO;
Client-ready;
Brainstorming;
Review;
Rewrite;
Summarize;
Extract;
Compare;
Plan;
Decide.
Każdy tryb powinien mieć:
default prompt, default model, default tools, output format, artifact target, approval behavior.
G. Voice Mode Engine
Voice mode nie może być gadżetem. Musi tworzyć outputy.
Funkcje:
voice input;
voice output;
live transcript;
continuous conversation;
voice note;
voice-to-task;
voice-to-decision;
voice-to-summary;
meeting-like capture;
pause/resume;
privacy indicator;
language detection.
H. Message Rendering Engine
Odpowiedź AI powinna składać się z warstw:
główna odpowiedź;
źródła;
założenia;
rekomendacje;
action cards;
task candidates;
decision candidates;
artifact previews;
follow-up suggestions;
message actions.
Akcje przy wiadomości:
regenerate, edit, copy, branch, save to project, create artifact, create task, create decision, mark client-ready, rate answer.
I. Tool Orchestration Engine
Narzędzia:
web search;
file search;
database search;
document generation;
table generation;
presentation generation;
calendar action;
CRM lookup;
task creation;
decision creation;
report generation;
source validation;
translation;
summarization;
export.
Zasada:
AI może proponować akcje, ale akcje zmieniające dane wymagają approvala.
J. Conversation History Engine
Historia rozmów nie jest archiwum. To operacyjna pamięć pracy.
Musi obsługiwać:
search;
semantic search;
filter by project;
filter by client;
filter by artifact;
filter by task;
filter by decision;
pinned;
archived;
deleted/recoverable;
auto-title;
manual title;
conversation summary;
branch;
export;
retention policy.
K. Projects / Workspaces in Chat
Projekt nie jest folderem rozmów.
Projekt to context container.
Zawiera:
rozmowy, pliki, artifacty, taski, decyzje, źródła danych, pamięć, stakeholderów, status, permissions, client/internal boundary.
L. Memory Engine
Rodzaje pamięci:
user memory;
organization memory;
project memory;
client memory;
conversation summary memory;
temporary memory;
no-retention mode.
Każda pamięć musi mieć:
scope, źródło, zgodę, możliwość edycji, możliwość usunięcia, retention.
M. Artifact Creation from Chat
Czat powinien tworzyć:
document, table, presentation, process flow, mindmap, whiteboard, task list, decision log, report, checklist, roadmap, SOP, business case.
Workflow:
conversation → draft → artifact → edit → approve → export → link to project
N. Action Extraction Engine
AI wykrywa:
action items, decisions, risks, blockers, assumptions, questions, data gaps, follow-ups, deadlines, owners, deliverables.
O. AI Governance & Approval Engine
Musi obsługiwać:
approval cards, source traceability, model traceability, prompt traceability, tool call history, rollback, permission checks, client/internal visibility, audit log.
8. Widoki systemu
A. Chat Home
Cel: szybki start pracy z Teresą.
Widoczne od razu:
greeting;
input;
mode chips;
Data Scope;
Model;
quick prompts;
recent conversations;
recent projects;
pending approvals;
suggested next actions.
KPI:
time to first useful prompt;
liczba rozmów zapisanych do projektu;
liczba artifactów utworzonych z czata;
liczba tasków i decyzji zaakceptowanych z rozmowy.
B. Active Conversation View
Elementy:
message thread;
input;
attachments;
source selector;
model selector;
mode selector;
tool status;
artifact preview;
source/citation panel;
action cards;
task/decision candidates;
conversation summary.
C. Conversation History View
Widoki:
all conversations;
pinned;
by project;
by client;
by artifact;
by date;
by person;
by output;
archived;
deleted/recoverable.
D. Project Chat View
Zawiera:
project conversations;
project knowledge;
project files;
project tasks from chat;
project decisions from chat;
project artifacts;
project memory.
E. Data Sources View
Zawiera:
selected sources;
available sources;
restricted sources;
source health;
last indexed;
permissions;
citations required;
source conflicts.
F. Model & Mode Settings View
Zawiera:
available models;
allowed models;
model costs;
model capabilities;
routing rules;
admin restrictions;
mode defaults.
G. Voice Conversation View
Zawiera:
live transcript;
audio controls;
detected tasks;
detected decisions;
meeting notes;
save transcript;
privacy indicator.
H. Action Review View
Zawiera:
suggested tasks;
suggested decisions;
suggested artifacts;
suggested follow-ups;
tool calls requiring approval;
bulk accept/reject/edit.
9. Workflow użytkownika — 25 kluczowych scenariuszy
#	Workflow	Trigger	AI role	Output	Acceptance criteria
1	Zwykłe pytanie do Teresy	Użytkownik wpisuje pytanie	Odpowiada w aktywnym Data Scope	Odpowiedź z kontekstem	AI pokazuje model, dane i założenia
2	Pytanie z PDF	Upload PDF	Analizuje, cytuje, streszcza	Summary + action items	Cytowania wskazują źródła
3	Rozmowa → dokument	Użytkownik prosi o dokument	Tworzy draft	Document Studio artifact	Dokument zapisany do projektu
4	Rozmowa → tabela	Odpowiedź ma strukturę	Tworzy tabelę	Table artifact	Kolumny i typy danych są poprawne
5	Rozmowa → prezentacja	Użytkownik chce deck	Tworzy narrację slajdów	Presentation artifact	Slajdy mają cel i strukturę
6	Rozmowa → taski	AI wykrywa działania	Proponuje task candidates	Task review cards	User accept/edit/reject
7	Rozmowa → decyzje	AI wykrywa decyzję	Tworzy decision request	Decision card	Decyzja ma ownera i deadline
8	Rozmowa → inicjatywa	Temat jest większy niż task	Proponuje initiative	Initiative draft	Ma cel, zakres i KPI
9	Voice note → task	Użytkownik mówi notatkę	Transkrybuje i ekstrahuje	Task/decision candidates	Transcript zapisany
10	Dzienny brief	Quick prompt	Agreguje inbox, taski, kalendarz	Brief	Pokazuje ryzyka i next actions
11	Szybkie oszczędności	Quick prompt	Szuka quick wins	Lista oszczędności	Każdy quick win ma impact/effort
12	Pomysł na produkt	Quick prompt	Prowadzi discovery	Problem/persona/MVP/ryzyka	Tworzy idea artifact
13	Przegląd planów	Quick prompt	Analizuje projekty	Plan review	Wykrywa opóźnienia i blokery
14	Zmiana modelu	User changes model	Kontynuuje kontekst	Response continuation	Brak utraty wątku
15	Zmiana Data Scope	User changes data	Informuje o zakresie	Scope-aware answer	AI nie miesza źródeł bez ostrzeżenia
16	Temporary chat	User włącza private	Nie zapisuje memory	Private conversation	Brak retention poza wymaganym audit
17	Save to project	User zapisuje rozmowę	Linkuje kontekst	Project-linked conversation	Widoczna w projekcie
18	Conversation summary	User lub auto	Streszcza rozmowę	Summary	Summary zawiera decyzje/taski
19	Tool approval	AI chce wykonać akcję	Pokazuje approval card	Approved/rejected action	Bez approvala brak wykonania
20	Client-ready answer	User wybiera tryb	Redaguje bez internal notes	Client-safe output	Brak poufnych treści
21	Research from chat	User prosi o research	Tworzy plan researchu	Research session	Plan zaakceptowany przed run
22	Chat to report	User prosi o raport	Łączy rozmowę + pliki + projekt	Report artifact	Źródła i założenia widoczne
23	History search	User szuka starej rozmowy	Semantic search	Lista rozmów	Wyniki po temacie/kliencie/output
24	Branch conversation	User chce wariant	Tworzy gałąź	Branch	Main thread nienaruszony
25	Missing context	AI wykrywa brak danych	Eskaluje braki	Data request	AI nie halucynuje
10. AI jako operator czata
AI w tym module ma 12 ról:
Odpowiada — generuje odpowiedzi.
Dopytuje — tylko gdy brak danych blokuje sensowną pracę.
Rozpoznaje intencję — odpowiedź, dokument, tabela, prezentacja, research, task, decyzja, plan, raport.
Dobiera tryb — Auto routing do właściwego trybu.
Dobiera model — jakość/koszt/poufność/context window.
Dobiera źródła — projekt, klient, organizacja, pliki, CRM, web.
Buduje kontekst — nie wrzuca wszystkiego; wybiera właściwe dane.
Tworzy artifacty — dokumenty, tabele, prezentacje, raporty.
Tworzy taski i decyzje — ale jako candidates.
Pamięta — tylko zgodnie ze scope i approvalem.
Cytuje — gdy korzysta ze źródeł.
Działa z approvalem — nie wykonuje istotnych akcji bez zgody.
11. Wymagania funkcjonalne — backlog 120 wymagań
Format: [Priorytet] Nazwa — opis — acceptance criterion
A. Conversation lifecycle
[P0] Create new conversation — użytkownik tworzy nowy wątek — nowa rozmowa ma ID, status Active i timestamp.
[P0] Auto-title conversation — AI nadaje tytuł po pierwszych wiadomościach — tytuł można edytować.
[P0] Edit title — użytkownik zmienia tytuł — zmiana widoczna w historii.
[P0] Pin conversation — przypięcie rozmowy — rozmowa widoczna w Pinned.
[P0] Archive conversation — archiwizacja — rozmowa znika z aktywnych, ale jest wyszukiwalna.
[P0] Delete conversation — usunięcie — rozmowa trafia do recoverable trash.
[P1] Restore conversation — przywrócenie — status wraca do Active.
[P0] Search history — wyszukiwanie historii — wyniki po tytule, treści i summary.
[P0] Filter by project — filtr po projekcie — lista zawiera tylko rozmowy projektu.
[P1] Filter by client — filtr po kliencie — lista pokazuje rozmowy klienta.
[P1] Filter by artifact — filtr po artifactach — wynik pokazuje powiązane rozmowy.
[P1] Filter by output type — filtr po typie wyniku — document/table/presentation/task/decision.
[P1] Conversation tags — tagowanie rozmowy — tag widoczny i wyszukiwalny.
[P1] Conversation status — status rozmowy — Active/Waiting/Archived/Approval.
[P0] Conversation summary — AI streszcza rozmowę — summary zawiera ustalenia, taski, decyzje.
B. Projects and context
[P0] Attach conversation to project — użytkownik przypina rozmowę do projektu — widoczna w Project Chat.
[P1] Detach conversation — odłączenie rozmowy — historia zachowana.
[P1] Create project from chat — z rozmowy powstaje projekt — projekt ma nazwę, cel, ownera.
[P0] Project context loading — rozmowa w projekcie ładuje pliki, taski, decyzje — AI widzi tylko permitted data.
[P0] Project memory — pamięć projektu — AI może użyć zatwierdzonych faktów.
[P1] Client/internal boundary — projekt ma granicę widoczności — client-ready nie zawiera internal notes.
[P1] Save answer to project — zapis odpowiedzi — odpowiedź widoczna jako note/output.
[P1] Linked artifacts — rozmowa pokazuje artifacty — link działa.
[P1] Linked tasks — rozmowa pokazuje taski — link do Execution Hub.
[P1] Linked decisions — rozmowa pokazuje decyzje — link do Decision Log.
C. Model selector
[P0] Choose model — użytkownik wybiera model — aktywny model widoczny.
[P1] Compare models — system pokazuje różnice — koszt/szybkość/jakość/context.
[P1] Model routing — Auto dobiera model — routing zapisany w audit.
[P0] Model cost display — koszt pokazany — user widzi cost level.
[P0] Sensitive data model restriction — modele niezatwierdzone nie pracują na danych poufnych — system blokuje wybór.
[P1] Model switch in conversation — zmiana modelu bez utraty kontekstu — kolejna odpowiedź kontynuuje temat.
[P1] Model warning — ostrzeżenie o ograniczeniach — widoczne przed użyciem.
[P2] Admin model controls — admin ustawia modele — user widzi tylko dozwolone.
[P2] Default model per mode — tryb ma domyślny model — wybierany automatycznie.
[P2] Local/private model option — opcja prywatnego modelu — dostępna dla danych restricted.
D. Data scope and sources
[P0] Choose Data Scope — użytkownik wybiera zakres danych — aktywny zakres widoczny.
[P0] Show active sources — system pokazuje źródła — lista źródeł w panelu.
[P0] Exclude source — użytkownik wyłącza źródło — AI nie używa go w odpowiedzi.
[P0] Require citations — wymuszenie cytowań — odpowiedź ma source cards.
[P0] Source trust level — źródło ma poziom zaufania — widoczne w UI.
[P1] Missing data warning — AI wskazuje braki — nie halucynuje.
[P1] Source conflict detection — wykrywa sprzeczne źródła — pokazuje konflikt.
[P1] Public web toggle — osobne włączenie web — web nieaktywny domyślnie dla danych poufnych.
[P1] CRM scope — AI pracuje na CRM — tylko zgodnie z permissions.
[P1] Restricted internal scope — restricted data — wymaga roli i audit.
E. Privacy and memory
[P0] Temporary chat — rozmowa tymczasowa — brak zapisu do memory.
[P0] No-retention mode — brak retencji treści — UI pokazuje status.
[P0] Memory suggestion — AI proponuje zapis pamięci — wymaga akceptacji.
[P0] Save to memory — użytkownik zapisuje fakt — memory ma scope.
[P0] Edit memory — edycja pamięci — zmiana audytowana.
[P0] Delete memory — usunięcie pamięci — memory nie jest używana.
[P1] Memory scope selector — user/project/org/client — widoczne przy zapisie.
[P1] Sensitive memory warning — dane wrażliwe wymagają zgody — system ostrzega.
[P2] Memory review queue — kolejka pamięci — admin/user zatwierdza.
[P2] Retention policy per memory — memory ma TTL — wygasa zgodnie z polityką.
F. Prompt input
[P0] Text prompt — użytkownik wpisuje prompt — wysyłka działa stabilnie.
[P0] Multiline prompt — obsługa długich promptów — enter/shift-enter działa.
[P0] Draft autosave — draft się nie gubi — po refreshu wraca.
[P1] Slash commands — /document, /task itd. — komendy wywołują tryby.
[P1] Mention people — @person — system linkuje osobę.
[P1] Mention project — @project — system ładuje kontekst projektu.
[P1] Mention file — @file — AI używa wskazanego pliku.
[P1] Mention task — @task — AI odnosi się do taska.
[P1] Prompt templates — szablony promptów — user wybiera gotowy prompt.
[P2] Prompt quality hints — AI sugeruje lepszy prompt — user może zaakceptować.
G. Attachments
[P0] Attach file — upload działa — plik widoczny w rozmowie.
[P0] Attach PDF — PDF parsowany — AI może cytować fragmenty.
[P0] Attach document — DOCX/TXT — tekst ekstrahowany.
[P0] Attach spreadsheet — XLSX/CSV — tabela rozpoznana.
[P1] Attach presentation — PPTX — slajdy sparsowane.
[P1] Attach image — obraz analizowany — opis/wnioski.
[P1] Attach audio — audio transkrybowane — transcript zapisany.
[P0] File preview — preview przed analizą — user widzi zawartość.
[P0] File parsing status — status parsing — pending/parsed/failed.
[P0] File security classification — public/internal/confidential/restricted.
H. Voice
[P1] Voice input — nagrywanie głosu — transcript powstaje.
[P1] Voice output — AI odpowiada głosem — user może wyłączyć.
[P1] Live transcript — transkrypt na żywo — edytowalny po nagraniu.
[P1] Pause voice — pauza — recording zatrzymany bez utraty.
[P1] Resume voice — wznowienie — transcript kontynuowany.
[P1] Stop voice — zakończenie — AI proponuje summary.
[P1] Voice-to-task — wykrywa taski — task candidates.
[P1] Voice-to-decision — wykrywa decyzje — decision candidates.
[P1] Language detection — język wykryty — transcript poprawny.
[P0] Privacy indicator — podczas nagrywania widoczny status.
I. Modes and quick actions
[P0] Auto mode — system rozpoznaje intencję — dobiera tryb.
[P0] Documents mode — output dokumentowy — tworzy document draft.
[P0] Tables mode — output tabelaryczny — tworzy table draft.
[P0] Presentations mode — output slajdowy — tworzy deck outline.
[P1] Research mode — tworzy research plan — wymaga approval przed run.
[P1] Execution mode — skupia się na taskach/decyzjach — tworzy action cards.
[P1] Client-ready mode — redakcja zewnętrzna — usuwa internal-only.
[P1] Daily brief — generuje brief — obejmuje projekty/taski/decyzje.
[P1] Quick savings — proponuje oszczędności — impact/effort.
[P1] Product idea — prowadzi pomysł — problem/persona/MVP.
[P1] Plan review — analizuje plany — wykrywa ryzyka.
J. Message actions
[P0] Stream answer — odpowiedź streamuje stabilnie — brak urwanych wiadomości.
[P0] Stop generation — user zatrzymuje generację — partial answer zostaje.
[P0] Regenerate answer — generuje ponownie — poprzednia wersja dostępna.
[P0] Edit user message — user edytuje prompt — branch lub rerun.
[P0] Copy answer — kopia do schowka — format zachowany.
[P1] Rate answer — feedback — zapisany do quality dashboard.
[P1] Branch conversation — alternatywny wątek — main thread nienaruszony.
[P0] Cite sources — cytowania widoczne — linkują do source cards.
[P1] Show tool calls — tool calls widoczne — user widzi status.
[P1] Reasoning summary — krótkie streszczenie rozumowania — bez ujawniania prywatnego chain-of-thought.
K. Artifact and action creation
[P0] Create document from answer — odpowiedź → dokument — zapis w Document Studio.
[P0] Create table from answer — odpowiedź → tabela — zapis w Table Studio.
[P0] Create presentation from answer — odpowiedź → prezentacja — zapis w Presentation Studio.
[P1] Create report from chat — rozmowa → raport — sources preserved.
[P0] Create task from answer — task candidate — wymaga approval.
[P0] Create decision from answer — decision candidate — wymaga approval.
[P1] Create initiative from answer — initiative draft — user zatwierdza.
[P1] Detect risks — AI wykrywa ryzyka — risk cards.
[P1] Detect blockers — AI wykrywa blokery — blocker cards.
[P1] Detect assumptions — AI listuje założenia — oznacza jako assumptions.
[P1] Detect unanswered questions — AI wskazuje braki — lista pytań.
[P1] Suggest next steps — next steps — powiązane z workflow.
[P1] Schedule meeting — propozycja spotkania — approval before calendar action.
[P0] Audit tool call — każda akcja narzędzia w audit log — widoczna w governance.
12. Wymagania niefunkcjonalne
Wymaganie	Dlaczego ważne w enterprise
Szybkie ładowanie Chat Home	Czat jest głównym wejściem do pracy; opóźnienie zabija adopcję.
Stabilny streaming	Użytkownik musi ufać, że odpowiedź nie zniknie.
Brak utraty draftu	Długie prompty są wartością intelektualną.
Autosave inputu	Refresh, błąd sesji albo przypadkowe zamknięcie nie mogą niszczyć pracy.
Skalowanie historii do milionów wiadomości	Enterprise generuje ogromną historię operacyjną.
Semantic search historii	Tradycyjne search po tytule nie wystarczy.
Niska voice latency	Voice działa tylko wtedy, gdy rozmowa jest naturalna.
File parsing latency control	Użytkownik musi widzieć status parsowania i czas oczekiwania.
Model switching latency	Zmiana modelu nie może resetować rozmowy.
Tenant isolation	Dane klientów nie mogą się mieszać.
Role-based permissions	AI może widzieć tylko to, co widzi użytkownik.
Audit trail	Każda akcja AI musi być odtwarzalna.
Tool call safety	AI nie może zmieniać danych bez kontroli.
Hallucination control	Przy danych firmowych brak źródła = ryzyko biznesowe.
Citations reliability	Cytowania muszą prowadzić do realnego źródła.
Source traceability	Manager musi wiedzieć, skąd pochodzi wniosek.
Cost observability	Modele reasoningowe są kosztowne; trzeba kontrolować usage.
Monitoring błędów	Błędy AI/tooli muszą trafiać do quality dashboard.
Recovery po błędach	User musi móc wznowić pracę.
Spójność UX	Czat, Workbench i Execution Hub muszą mieć jednolite wzorce.
WCAG/accessibility	Enterprise wymaga dostępności.
Multilingual support	Consultify musi obsługiwać PL/EN i klientów globalnych.
Client/internal mode	Najważniejszy mechanizm bezpieczeństwa komunikacji.
Data retention	Różne projekty i klienci mają różne polityki retencji.
Compliance readiness	Audit, permissions, retention i source traceability to fundament sprzedaży enterprise.
13. Model trybów czata
Tryb	Cel	Default model	Źródła	Narzędzia	Output	Artifact	Approval
Auto	Rozpoznanie intencji	Router	Dynamiczne	Dynamiczne	Dowolny	Możliwy	Zależnie od akcji
Documents	Dokumenty	Writer/Reasoning	Pliki/projekt	Document Builder	DOC/PDF draft	Tak	Tak
Tables	Struktury danych	Table model	Pliki/projekt	Table Builder	Tabela	Tak	Tak
Presentations	Decki	Storytelling	Projekt/pliki	Slide Builder	Deck outline/slides	Tak	Tak
Research	Research	Research model	Web + selected	Search, citation	Research report	Tak	Tak
Analysis	Analiza	Reasoning	Projekt/pliki	File, table, calc	Wnioski	Opcjonalnie	Nie
Strategy	Strategia	Deep reasoning	Org/project	Frameworks	Memo/plan	Tak	Czasem
Financial	Finanse	Reasoning/calc	Tables/files	Calc/table	Model/wnioski	Tak	Tak
Execution	Wykonanie	Fast + extractor	Execution Hub	Task/decision	Action cards	Nie	Tak
PMO	Zarządzanie projektami	Reasoning	Projekty/taski	Reports	PMO brief	Tak	Czasem
Client-ready	Komunikacja zewnętrzna	Writer	Approved data	Redaction	Clean output	Opcjonalnie	Tak
Brainstorming	Idee	Creative	Conversation	Idea tools	Pomysły	Opcjonalnie	Nie
Review	Ocena	Reasoning	Artifact	Review/diff	Uwagi	Nie	Nie
Rewrite	Przeredagowanie	Writer	Selected text	Editor	Nowa wersja	Nie	Nie
Extract	Ekstrakcja	Extractor	Pliki/chat	Parser	Taski/decyzje/ryzyka	Czasem	Tak
Decide	Decyzja	Reasoning	Sources	Decision builder	Decision request	Tak	Tak
Statusy rozmowy
Status	Znaczenie	Trigger
Active	rozmowa trwa	nowy wątek
Waiting for User	AI potrzebuje decyzji użytkownika	pytanie / approval
Waiting for Tool	trwa tool call	uruchomione narzędzie
Waiting for Approval	akcja wymaga zgody	create/send/update
Artifact Created	powstał artifact	document/table/deck/report
Action Extracted	wykryto taski/decyzje	extractor
Saved to Project	rozmowa zapisana	save action
Archived	rozmowa zamknięta	archive
Deleted	rozmowa usunięta	delete
14. Model źródeł danych i zaufania
Data Scopes
Data Scope	Kiedy używać	Ryzyka	Cytowania	Memory	Client-ready
No company data	ogólne pytania	ogólność odpowiedzi	nie zawsze	nie	tak
Current conversation only	szybkie analizy	brak pełnego kontekstu	nie zawsze	opcjonalnie	tak
Uploaded files only	analiza plików	jakość parsowania	tak	po zgodzie	zależnie
Current project	praca projektowa	permissions	tak	projektowa	zależnie
Current client	praca klientowa	client boundary	tak	client memory	ostrożnie
Organization knowledge	standardy firmy	nadmiar danych	tak	org memory	tylko approved
Selected sources	precyzyjne zadania	pominięcie danych	tak	zależnie	tak
CRM	sales/client context	dane osobowe	tak	ograniczona	ostrożnie
Documents	dokumenty	wersje dokumentów	tak	zależnie	tak
Tables	dane strukturalne	błędne typy danych	tak	nie zawsze	tak
Presentations	narracje/slajdy	stare wersje	tak	nie zawsze	tak
Execution Hub	taski/decyzje	zmiana danych	tak	project	nie bez redakcji
Research database	research	aktualność	tak	tak	tak
Public web	benchmarki/news	wiarygodność	tak	nie domyślnie	tak
Restricted internal	dane poufne	leakage	tak	restricted	nie
Private mode	rozmowy poufne	brak pamięci	opcjonalnie	nie	nie domyślnie
Source Trust Levels
Verified internal source
User-uploaded source
Project source
CRM source
Public official source
Public web source
AI inference
User statement
Unknown/unverified
AI musi jawnie rozdzielać:
fakty / założenia / hipotezy / rekomendacje / wnioski AI / braki danych
15. Reporting i analytics dla czata
A. User Chat Dashboard
Pokazuje:
ostatnie rozmowy;
active projects;
wygenerowane artifacty;
open tasks from chat;
pending decisions;
recommended next actions;
rozmowy wymagające kontynuacji.
B. Manager AI Usage Dashboard
Pokazuje:
liczba rozmów;
liczba artifactów;
taski utworzone z czata;
decyzje utworzone z czata;
aktywni użytkownicy;
koszty modeli;
najczęstsze tryby;
tool call failures;
AI adoption by team.
C. Governance Dashboard
Pokazuje:
sensitive data usage;
source access;
memory changes;
tool calls;
approvals;
exports;
shared conversations;
client-ready outputs;
policy violations.
D. Quality Dashboard
Pokazuje:
user feedback;
answer ratings;
hallucination reports;
citation issues;
failed tasks;
repeated prompts;
unresolved questions;
model performance by mode.
16. Relacje z innymi modułami Consultify
Moduł	Relacja z Chat OS
Workbench	Chat po lewej, artifact po prawej; Teresa steruje edycją artifactu.
Documents	Chat tworzy, analizuje, streszcza i edytuje dokumenty.
Presentations	Chat tworzy strukturę, narrację i treści slajdów.
Tables	Chat tworzy tabele, rejestry, matryce, backlogi.
Ideas	Chat przechwytuje pomysły i promuje je do inicjatyw.
Mindmap	Chat tworzy mapy myśli z rozmów.
Process Flow	Chat tworzy procesy i action plans.
Whiteboard	Chat syntetyzuje warsztaty i tworzy structured outputs.
Execution Hub	Chat tworzy taski, decyzje, follow-upy i action queue.
Calendar	Chat tworzy wydarzenia, follow-up meetings, reminders.
Inbox	Chat generuje inbox items i robi triage.
Manager	Chat przygotowuje briefy, raporty, alerty i interwencje.
Research Sessions	Chat uruchamia research, zatwierdza plan i odbiera wynik.
CRM/Sales	Chat przygotowuje follow-upy, MAP, MEDDPICC, oferty i client notes.
17. Rekomendowana architektura logiczna
User Input / Voice / File / Prompt Suggestion
  ↓
Prompt Input Engine
  ↓
Intent Classifier
  ↓
Mode Selector / Auto Mode Router
  ↓
Data Scope Resolver
  ↓
Permission & Policy Checker
  ↓
Model Router
  ↓
Context Builder
  ↓
Tool Planner
  ↓
AI Response Generator
  ↓
Source & Citation Engine
  ↓
Action Extraction Engine
  ↓
Artifact Builder
  ↓
Task / Decision / Initiative Builder
  ↓
Approval Engine
  ↓
Conversation Memory Engine
  ↓
History & Project Linker
  ↓
Audit Trail
  ↓
Governance Dashboard
Core Consultify — budować własne
Prompt Input Engine
Conversation History
Project Context
Data Scope
Memory Governance
Artifact Builder
Action Extraction
Task/Decision Builder
Approval Engine
Audit Trail
Client/Internal Mode
Source Trust Model
Consulting Workflow Router
Integracje zewnętrzne — integrować
LLM providers
web search
file storage
calendar
email
CRM
Teams/Slack
document repositories
vector databases
speech-to-text
text-to-speech
OCR
BI/reporting engine
18. MVP i roadmapa
MVP 1 — Solid Chat Foundation
Cel: stabilny, enterprise-ready chat.
Zakres:
chat home;
prompt input;
streaming;
conversation history;
basic model selector;
basic data selector;
file upload basic;
message actions;
quick prompts;
conversation summary.
Nie wchodzi:
pełny voice;
pełne approvale;
zaawansowany source governance;
pełny agent orchestration.
Definition of Done:
rozmowy nie giną;
streaming stabilny;
pliki można dodać i streścić;
historia działa;
model i data scope są widoczne.
MVP 2 — Project Context & History
Zakres:
project chat;
przypisywanie rozmów do projektów;
project files;
project conversations;
project memory;
search history;
pinned/archived conversations.
DoD:
projekt działa jako context container, nie folder.
MVP 3 — Artifact Creation
Zakres:
chat to document;
chat to table;
chat to presentation;
chat to report;
artifact preview;
save to project;
edit artifact from chat.
DoD:
z rozmowy powstaje trwały artifact.
MVP 4 — Action Extraction
Zakres:
task candidates;
decision candidates;
risks/blockers;
follow-ups;
action review panel;
accept/edit/reject.
DoD:
AI nie tworzy tasków automatycznie bez zgody.
MVP 5 — Data, Sources & Citations
Zakres:
advanced Data Scope;
source cards;
citations;
source trust levels;
missing data warnings;
source conflict detection.
DoD:
user wie, na jakich danych Teresa odpowiada.
MVP 6 — Voice & Multimodal
Zakres:
voice input;
voice output;
live transcript;
voice notes;
image/file analysis;
voice-to-task;
voice-to-decision.
DoD:
voice tworzy użyteczne outputy.
MVP 7 — Tool Orchestration & Approval
Zakres:
tool calls;
approval cards;
audit trail;
rollback;
calendar actions;
project actions;
report actions.
DoD:
każda akcja zmieniająca dane wymaga approval.
MVP 8 — Enterprise Governance
Zakres:
permissions;
audit trail;
retention;
memory approvals;
client/internal mode;
admin model controls;
admin data controls;
compliance dashboard.
DoD:
system gotowy do wdrożeń enterprise.
19. Ryzyka produktowe i decyzje architektoniczne
Ryzyko	Wpływ	Prawdopodobieństwo	Ograniczenie	Decyzja
Zbudowanie zwykłego czata	wysokie	wysokie	roadmapa artifact/action/project	Chat = Work OS
Skopiowanie ChatGPT bez workflow	wysokie	średnie	własny execution layer	Nie kopiować 1:1
Brak historii projektowej	wysokie	wysokie	Project Context	Projekt = context container
Brak Data Scope	krytyczne	średnie	Data selector jako P0	Scope zawsze widoczny
Brak model selector	średnie	średnie	Model profile	Model + koszt + policy
Brak memory governance	krytyczne	wysokie	memory approval	Pamięć jawna i edytowalna
Brak źródeł i cytowań	wysokie	średnie	Source cards	Citation-first dla danych
Brak artifactów	wysokie	średnie	chat-to-artifact	Każda odpowiedź może być artifactem
Brak action extraction	wysokie	wysokie	task/decision candidates	Conversation → execution
Brak approvali	krytyczne	średnie	approval engine	Suggested vs executed
AI wykonuje akcje bez zgody	krytyczne	średnie	permission + approval	Zero silent write actions
Chat nie łączy się z taskami	wysokie	średnie	Execution Hub integration	Task cards
Chat nie łączy się z decyzjami	wysokie	średnie	Decision Log integration	Decision cards
Historia jest archiwalna	średnie	wysokie	semantic search + summaries	Historia operacyjna
User nie wie, z jakich danych korzysta AI	krytyczne	wysokie	Data Scope panel	Źródła zawsze widoczne
Niejasny model routing	średnie	średnie	routing explanation	Krótkie uzasadnienie routingu
Koszty AI niekontrolowane	wysokie	średnie	cost dashboard	Cost-aware routing
Voice jako gadżet	średnie	wysokie	voice-to-output	Voice ma tworzyć task/decyzję
Słabe parsowanie plików	wysokie	średnie	parsing status + preview	File pipeline jako core
Halucynacje na danych firmowych	krytyczne	średnie	source-required answers	Brak źródła = ostrzeżenie
Brak client/internal split	krytyczne	średnie	visibility model	Client-ready mode
User gubi outputy	wysokie	wysokie	save-to-project	Każdy output linkowany
Za dużo przycisków	średnie	wysokie	progressive disclosure	Prosty input + advanced menu
UX zbyt skomplikowany	wysokie	średnie	Auto mode	AI prowadzi, UI nie przytłacza
Brak audit trail	krytyczne	średnie	ChatAuditLog	Audyt jako P0 dla tool calls
20. Decyzja strategiczna: kopiować czy budować własny Chat OS?
Rekomendacja
Consultify nie powinien kopiować ChatGPT, Claude ani Copilot 1:1. Powinien zbudować własny Conversational Work OS inspirowany najlepszymi wzorcami, ale podporządkowany consulting execution, artifactom, taskom, decyzjom, projektom, źródłom i governance.
Dlaczego:
ChatGPT jest świetny jako uniwersalny assistant, ale nie jest consulting execution system.
Claude jest świetny w artifactach, ale nie zarządza pełnym PMO execution.
Copilot jest świetny w M365, ale jest zamknięty w Microsoft ecosystem.
Perplexity jest świetny w researchu, ale nie prowadzi execution.
Cursor jest świetny w środowisku kodu, ale nie w konsultingu.
Notion AI jest mocny w workspace i dokumentach, ale słabszy w consulting governance.
Harvey jest świetny w profesjonalnym workflow, ale domenowo prawny.
Consultify musi mieć własny model:
conversation → context → artifact → decision → task → execution → report
21. Najważniejsze zasady projektowe dla Consultify Conversational Work OS
Czat nie jest dodatkiem — czat jest głównym interfejsem pracy.
Każda rozmowa powinna mieć kontekst.
Użytkownik musi widzieć, z jakich danych korzysta AI.
Użytkownik musi widzieć, jaki model odpowiada.
Tryb Auto powinien rozpoznawać intencję użytkownika.
Każda ważna odpowiedź może stać się artifactem.
Każda rozmowa może wygenerować taski, decyzje albo inicjatywy.
AI nie wykonuje istotnych akcji bez approvala.
Historia rozmów musi być operacyjnie użyteczna, nie tylko archiwalna.
Projekt jest kontenerem kontekstu, nie folderem rozmów.
Pamięć musi być jawna, edytowalna i kontrolowana.
Private/temporary chat musi naprawdę nie zapisywać kontekstu.
Czat musi rozdzielać internal i client-ready output.
Źródła muszą być widoczne i cytowane.
AI musi odróżniać fakty od założeń i rekomendacji.
Załączniki muszą być parsowane, klasyfikowane i linkowane.
Voice mode musi tworzyć użyteczne outputy, nie tylko transkrypcję.
Prompt suggestions muszą prowadzić do realnej pracy.
Quick actions powinny być powiązane z workflow.
Tool calls muszą mieć audit trail.
Model routing musi optymalizować jakość, koszt i bezpieczeństwo.
Czat musi płynnie przechodzić do Workbench.
Czat musi zasilać Execution Hub.
Nie kopiujemy ChatGPT 1:1 — budujemy consulting conversation engine.
Teresa ma być partnerką pracy, nie tylko odpowiadaczem.
22. Najważniejszy produktowy wniosek
Jeżeli Consultify zbuduje tylko ładne okno rozmowy, przegra z ChatGPT, Claude i Copilotem.
Jeżeli Consultify zbuduje Conversational Work OS, czyli czat, który rozumie projekt, wybiera źródła, tworzy artifacty, wyciąga taski, zapisuje decyzje, pilnuje approvali, zasila Execution Hub i zachowuje governance — wtedy nie konkuruje z chatbotami.
Wtedy Consultify staje się systemem pracy konsultingowej, w którym rozmowa jest tylko początkiem wykonania.
