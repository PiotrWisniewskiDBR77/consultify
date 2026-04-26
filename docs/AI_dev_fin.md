# AI_dev_fin - finalny plan rozwoju AI w Consultify

> Status: dokument nadrzedny / backlog rozwoju AI
> Data utworzenia: 2026-04-25
> Zakres: caly system AI w aplikacji Consultify: chat, Teresa, Anna, deep research, voice, trust, artefakty, agenci, konektory, pamiec organizacyjna i runtime V10.

## 0. Executive summary

Consultify nie ma wygrac jako "kolejny chat AI". Z dokumentacji biznesowej i landing page wynika, ze aplikacja ma byc AI-native consulting execution system: systemem, ktory zamienia wiedze biznesowa, diagnoze i rekomendacje w mierzalna prace, decyzje, artefakty, KPI i ROI.

Obietnica produktu sklada sie z czterech warstw:

1. **Access** - consulting intelligence ma byc dostepna szerzej niz klasyczny consulting premium.
2. **Quality** - AI ma pracowac na kontekscie firmy, frameworkach, evidence i metodologii, a nie na ogolnych promptach.
3. **Trust and control** - AI musi byc bezpieczne dla realnej pracy biznesowej: uprawnienia, audit, source trace, human approval.
4. **Execution and ROI** - system ma prowadzic od zrozumienia i diagnozy do inicjatyw, realizacji, wynikow i proof of impact.

Landing page streszcza to wprost:

- `Consultify AI. All the world's business knowledge. Turned into your profits.`
- `Understanding -> Diagnosis -> Designing initiatives -> Execution -> Results.`
- `One AI system for assistants, prompts, agents, knowledge, and artifact-native work.`

Dlatego finalny program AI musi obejmowac nie tylko chat, ale caly operating model:

```text
Anna/Teresa -> discovery -> diagnosis -> research -> recommendations ->
initiatives -> execution -> artifacts -> KPI/ROI -> learning loop
```

Ten dokument jest nadrzednym backlogiem rozwoju AI. Traktujemy go jako warstwe laczaca:

- cel biznesowy i GTM;
- landing promise;
- benchmark `Softs`;
- realny stan kodu;
- braki techniczne i produktowe;
- roadmap wdrozenia do pelnego AI OS.

## 1. Cel koncowy

Docelowo AI w Consultify ma byc nie tylko czatem, ale workspace-native, governed AI operating system dla pracy konsultingowej.

Oznacza to jeden spojny przeplyw:

```text
wejscie -> zrozumienie kontekstu -> pytanie -> odpowiedz ze zrodlami i trustem ->
propozycja dzialania -> review -> approval -> execution -> artefakt ->
revisit -> pamiec organizacyjna -> mierzalny efekt biznesowy
```

Najwazniejsze zasady:

- AI nie wykonuje istotnych mutacji po cichu.
- User zawsze rozumie, z jakich zrodel korzysta odpowiedz.
- Odpowiedzi oparte o pliki, web, workspace lub org memory wygladaja inaczej niz odpowiedzi ogolne.
- Propozycje, akcje, research i artefakty sa pierwszoklasowymi obiektami, a nie tekstem ukrytym w zwyklej odpowiedzi.
- Kazda wazna akcja ma lifecycle, approval i audit trail.
- AI ma pamietac i uczyc sie tylko w kontrolowany, widoczny i zgodny z uprawnieniami sposob.

### 1A. Docelowa architektura funkcji

Plan spinamy wokol czterech encji centralnych: `TrustBundle`, `ResearchSession`, `AIRun` i `Artifact`.

```mermaid
flowchart TD
  businessGoal["Business Goal: execution, ROI, trust"] --> aiOS["Consultify AI OS"]
  aiOS --> trustBundle["TrustBundle"]
  aiOS --> researchSession["ResearchSession"]
  aiOS --> aiRun["AIRun"]
  aiOS --> artifact["Artifact"]
  trustBundle --> userTrust["Source, model, cost, confidence"]
  researchSession --> researchReport["Evidence report artifact"]
  aiRun --> approvalAudit["Proposal, approval, execution, audit"]
  artifact --> businessOutput["Reports, decks, sheets, decisions"]
  businessOutput --> roi["KPI, ROI, measurable results"]
```

### 1B. Finalny zakres AI OS

Finalny Consultify AI OS musi obejmowac siedem domen produktowych, zeby aplikacja spelnila obietnice "od rozmowy do wyniku":

| Domena | Co ma robic AI | Glowny runtime |
|---|---|---|
| Rozmowa i doradztwo | odpowiadac, pytac, diagnozowac, tlumaczyc, cytowac | `UnifiedChatPanel`, `TrustBundle` |
| Kontekst organizacji | rozumiec firme, role, projekty, dokumenty, decyzje i ograniczenia | `OrgContext`, `ProjectContext`, org memory |
| Zarzadzanie aplikacja | tworzyc i aktualizowac tabele, raporty, prezentacje, inicjatywy, taski, decyzje | `AIRun`, action proposals, tools |
| Artefakty | tworzyc dokumenty, raporty, decki, arkusze, diagramy, formularze i plany | `Artifact`, `MutationProposal` |
| Role i agenci | pracowac jako CFO, COO, CEO advisor, transformation officer, IT/CISO, consultant, analyst | `AgentCatalog`, persona policy |
| Uczenie i pamiec | uczyc sie preferencji, metodologii, feedbacku i kontekstu tylko za zgoda | `LearningLoop`, `MemoryStewardship` |
| Wynik biznesowy | laczyc prace z KPI, ROI, ryzykiem, decyzjami i raportem dla klienta/inwestora | `OutcomeRuntime`, KPI/ROI ledger |

### 1C. Roznica miedzy "AI podpowiada" i "AI wykonuje"

W produkcie musza istniec trzy poziomy dzialania AI:

1. **Answer** - AI tylko odpowiada, cytuje zrodla i wyjasnia reasoning.
2. **Suggest** - AI proponuje dokument, inicjatywe, task, zmiane, raport albo deck, ale niczego nie zapisuje bez decyzji usera.
3. **Act** - AI wykonuje akcje w aplikacji lub narzedziu dopiero po approval, z `AIRun`, audytem, rollback path i widocznym wynikiem.

Regula bazowa:

```text
no hidden writes, no hidden learning, no hidden connector access
```

## 2. Programy AI: V8, V9, V10

### V8 - fundament produktu AI/chat

V8 definiuje glowny kontrakt AI w aplikacji:

- jeden kanoniczny shell czatu: `UnifiedChatPanel`;
- full chat i split chat jako jeden produkt;
- historia rozmow jako biblioteka: recent, pinned, folders, archived, search, revisit;
- streaming AI: chunk, stop, retry, errors, citations, thinking, proposals, policy metadata;
- source model: general, conversation history, workspace, attachments, web/research, org memory;
- local file ingest i URL ingest;
- web search i Deep Thinking / Deep Research;
- private mode, custom instructions, user memory i organizational memory;
- model/tier selection;
- co-thinker/persona i multi-agent decision room;
- trust contract: citations, source class, model, cost, tokens, confidence, routing trace, warnings;
- response classes: general, workspace-grounded, attachment-grounded, research, proposal, action-carrying, artifact-oriented, rich structured;
- AI actions/proposals: `proposed -> pending_review -> approved/rejected -> executed/closed -> audited`;
- `execution_proposal` jako first-class message type;
- save-to-artifact: notes, ideas, decisions, tasks, reports, slides;
- artifact runtime: diff preview, approve, commit, audit;
- voice: dictation, voice conversation, TTS, jeden state machine;
- governance: no silent execution, audit trail, feedback loop, prompt governance.

### V9 - warstwa UX, operacyjna i stabilizacyjna

V9 jest waska paczka funkcji, ktore maja realny kod i flagi:

- voice legend, shortcut `Alt+Shift+V`, copy legend, voice unavailable fallback;
- barge-in toast i voice funnel telemetry;
- private mode details popover;
- trust badge pod odpowiedziami AI;
- humanizacja nazwy modelu w trust badge;
- copy citations, copy reasoning;
- klikalne citation links i domain pill;
- "Why this answer?" reasoning snippet;
- PII heuristic toast i session dismiss;
- next-message model hint chip;
- input character counter;
- input keyboard hint strip;
- input soft-limit toast;
- back-to-chat button i shortcut `Alt+Shift+C`;
- workspace breadcrumb i recent conversations dropdown;
- admin V9 flags panel: role gate, reset, filter, grouping, copy snapshot, copy override URL, row shortcuts.

### V10 - docelowy runtime AI OS

V10 jest wieksza paczka runtime'ow i modeli. W obecnym checkoutcie `feat/ai-chat-v9` nie ma plikow `server/src/routes/v10`, `server/src/services/v10`, `src/hooks/v10` ani `src/components/v10`. Istnieje jednak commit `a336e4e32 feat(v10): ship runtime workspace and rollout wiring`, ktory zawieral docelowy szkielet.

V10 dzieli AI na 8 blokow:

- `reasoning` - intent classification, reasoning router, workload routing, plan depth, self-check, trust bundle;
- `learning` - feedback capture, self-learning loop, consent, memory stewardship, quality dashboard;
- `agent_runtime` - `ExecutionProposalV1`, Run Ledger, severity policies, schedules, swarm, user interrupts;
- `research` - research mission, scope contract, evidence graph, watch delta, report artifact;
- `artifact` - unified Artifact model, mutation proposals, lineage, review state, exports;
- `connectors` - enterprise integrations, OAuth/session runtime, ACL-aware source search/read, freshness;
- `outcome` - KPI, ROI, business effect, acceptance contracts, investor-grade reporting;
- `onboarding` - persona-aware onboarding, trust-first disclosure, activation SLA.

## 2A. Business goal alignment

### 2A.1 Kategoria produktu

Z dokumentacji marketingowej wynika kategoria:

```text
AI-native consulting execution system
```

Nie sprzedajemy samego AI. Sprzedajemy system, ktory:

- redukuje chaos transformacji;
- daje jeden obraz programu;
- laczy decyzje, inicjatywy, zadania, KPI i raporty;
- tworzy proof of impact;
- zachowuje kontrola security i danych;
- pozwala konsultantom i partnerom skalowac delivery bez liniowego zwiekszania zespolu.

### 2A.2 Obietnica biznesowa -> wymagane capability AI

| Obietnica biznesowa | Co musi umiec AI | Minimalny produktowy dowod |
|---|---|---|
| Dostep do wiedzy konsultingowej | Product/org knowledge, framework retrieval, curated methodology memory | AI odpowiada z zatwierdzonych zrodel, nie z losowego web |
| Zrozumienie firmy | Interview context, org profile, workspace context, memory | AI umie strescic kontekst organizacji i wykorzystac go w rekomendacji |
| Diagnoza | Assessment reasoning, evidence map, maturity analysis, gap analysis | AI generuje diagnoze z cytowanymi dowodami i zalozeniami |
| Projektowanie inicjatyw | Initiative generator, prioritization, roadmap, owner/dependency model | AI proponuje inicjatywy z celem, wlascicielem, ryzykiem i KPI |
| Realizacja | Action proposals, tasks, run ledger, follow-through agents | AI tworzy proposal, user zatwierdza, system zapisuje audit |
| ROI i proof | KPI baseline, target, benefit tracking, ROI model | AI laczy inicjatywe z metryka i efektem biznesowym |
| Security/control | Trust bundle, ACL, source trace, private mode, policy gateway | User i admin widza, co AI uzylo i dlaczego |
| Skalowanie consultingu | Agent catalog, templates, artifacts, partner workflows | Partner/konsultant dostaje powtarzalny output, nie tylko rozmowe |

### 2A.3 Czego nie wolno obiecywac przed domknieciem runtime

- Pelnej autonomii AI bez human approval.
- Enterprise connectors bez ACL/freshness/source trace.
- Deep Research jako resumable workflow, dopoki nie ma `ResearchSession`.
- Pelnego voice conversation, dopoki Teresa/Anna voice nie maja server-side config i jasnego error state.
- "AI uczy sie samo", dopoki learning loop nie ma consent, stewardship i audit.
- ROI proof, dopoki nie ma baseline, KPI ownera i acceptance contract.

## 2B. Landing promise -> AI capabilities

### 2B.1 `Consultify AI. All the world's business knowledge. Turned into your profits.`

Wymagane capability:

- curated business knowledge base;
- product knowledge vs web research separation;
- enterprise search i org memory;
- reasoning router, ktory wybiera fast chat / research / action / artifact;
- outcome runtime: KPI, ROI, business effect summary;
- trust bundle z model/source/cost/confidence.

### 2B.2 `Understanding -> Diagnosis -> Designing initiatives -> Execution -> Results`

Wymagane capability:

- `Understanding`: interview ingestion, org profile, context snapshot, memory scope;
- `Diagnosis`: assessment analysis, evidence ledger, benchmark, gap analysis;
- `Designing initiatives`: initiative proposals, prioritization, roadmap, RACI, assumptions;
- `Execution`: tasks, approvals, run ledger, escalation, follow-through agents;
- `Results`: KPI tracking, ROI model, reporting, learning loop.

### 2B.3 `One AI system for assistants, prompts, agents, knowledge, and artifact-native work`

Wymagane capability:

- Anna jako public product assistant;
- Teresa jako tenant/workspace assistant;
- prompt governance i release management;
- agent catalog;
- policy-aware knowledge and memory;
- artifact runtime dla docs, reports, decks, sheets, decisions;
- audit viewer i admin AI ops.

## 2C. Benchmark Softs -> wymagania dla Consultify

Benchmark `Softs` nie jest lista UI do skopiowania. To mapa wzorcow capability.

| Referencja z `Softs` | Wzorzec capability | Co to znaczy dla Consultify |
|---|---|---|
| ChatGPT / Claude / KIMI | Prosty core chat, predictable streaming, projekty/folders, file-heavy work | Jeden szybki chat, historia jako biblioteka, projekty kontekstowe, pliki jako pierwszoklasowe zrodla |
| Perplexity / KIMI Deep Research | Evidence-led answers, citations, long-form research | `ResearchSession`, evidence graph, final report artifact, source confidence |
| KIMI Agent / Agent Swarm / Kimi Claw | Agenci, swarm, always-on jobs | `AIRun`, scheduled agents, swarm research, background queue |
| KIMI Docs / Sheets / Slides / Websites | Artifact-native AI | Docs/sheets/slides/reports jako artefakty z diff, approval, export |
| Notion / Evernote | AI w dokumencie i knowledge graph | Notebook/doc editor z AI blocks, summaries, slash commands, page Q&A |
| Gamma / Beautiful.ai / Pitch | Generatywne decki i prezentacje | Chat -> client-ready deck, template, slide narrative, export |
| ClickUp / Linear / Monday | AI w taskach i follow-up | Chat -> proposal -> task/initiative -> owner/deadline/status |
| Atlassian / Intercom / Zendesk | Enterprise KB z ACL i freshness | Org memory, support/product KB, permissioned retrieval, freshness labels |
| Palantir AIP / Foundry | Ontology, typed tools, approvals, audit na danych operacyjnych | Business ontology, governed actions, typed tools, audit viewer |
| LangChain / CrewAI / OpenAI agents | Routing, tool calling, orchestration, structured outputs | Reasoning router, tool registry, agent catalog, output schemas |
| Liveblocks / Miro / Whiteboard | Collaboration over artifacts/canvas | Multi-user artifact editing, comments, annotations, shared context |
| KPI / finance / tables references | Analytical AI nad danymi | KPI analyst, finance/sheets agent, ROI model, anomaly/forecast explanations |

### 2C.1 Benchmark gap summary

Consultify ma przewage, jesli polaczy trzy rzeczy, ktore u konkurencji zwykle sa osobno:

```text
AI assistant + governed execution + measurable business outcome
```

Najwiekszy brak wzgledem benchmarku to nie "ladniejszy chat", tylko brak wspolnego runtime dla:

- research sessions;
- agent runs;
- artifact mutations;
- connector retrieval;
- outcome/ROI loop;
- audit/trust.

## 2D. Persona proof map

AI musi dawac inny dowod wartosci dla kazdej persony zakupowej.

| Persona | Co kupuje naprawde | Wymagany dowod AI | Funkcje do domkniecia |
|---|---|---|---|
| Owner | wartosc firmy, przewaga, mniejsza zaleznosc od ludzi | executive roadmap, value levers, risk map | ResearchSession, outcome runtime, executive reports |
| CEO | tempo, priorytety, jeden obraz programu | strategic brief, decision options, initiative portfolio | decision agent, initiative proposals, project room |
| CFO | ROI, governance, persistence | baseline, KPI owner, ROI model, budget impact | KPI/ROI runtime, acceptance contracts, finance agent |
| COO | mniej chaosu, bottlenecks, execution visibility | operating dashboard, blockers, owners, deadlines | AIRun, follow-through agents, escalation |
| Transformation Officer | single source of truth dla programu | roadmap, dependencies, status, steering summary | project room, artifact runtime, reports |
| IT / CISO | security, data flow, control | source trace, retention, DPA/subprocessor clarity | trust bundle, connectors ACL, AI ops, audit |
| Consulting partner | leverage, margin, repeatability | reusable methodology, artifacts, white-label outputs | agent catalog, templates, partner workspace |
| Investor | moat, scalability, category proof | methodology + system + learning loop + traction metrics | learning loop, outcome runtime, AI ops metrics |

## 2E. Full AI capability catalogue

### 2E.1 Assistants

- Anna public product assistant.
- Teresa tenant/workspace assistant.
- Role-specific copilots: CFO, COO, Transformation, IT/CISO, partner.
- Contextual help assistant for product navigation.

### 2E.2 Reasoning and routing

- Intent classification.
- Workload class routing: fast chat, research, action, artifact, connector, voice, background.
- Model/tier/cost routing.
- Self-check and answer repair.
- Structured output schemas.

### 2E.3 Knowledge and retrieval

- Product truth KB.
- Org memory.
- Workspace context.
- Attachments and URL ingest.
- Web research.
- Enterprise connectors.
- ACL, freshness, data residency and source class labels.

### 2E.4 Research

- Deep Research confirm gate.
- Research planning.
- Evidence graph.
- Source confidence and contradiction handling.
- Long-running research sessions.
- Research report artifacts.

### 2E.5 Actions and execution

- Execution proposals.
- Approve/reject/execute separation.
- Run ledger.
- Severity policies.
- Interrupt verbs.
- Action center.
- Audit viewer.

### 2E.6 Artifacts and outputs

- Notes, decisions, tasks, initiatives.
- Reports, presentations, spreadsheets, decks.
- Diff preview and mutation proposals.
- Version lineage.
- Export manifest.
- Provenance footer.

### 2E.7 Outcome and ROI

- KPI baseline and target.
- ROI model.
- Business effect summary.
- Initiative-to-KPI linkage.
- Client/investor-ready reporting.

### 2E.8 Learning and operations

- Feedback capture.
- Stewardship queue.
- Memory mutation approval.
- Quality dashboard.
- Golden prompts and evals.
- Provider health, budget and cost ops.

### 2E.9 Voice and multimodal

- Dictation.
- Teresa/Anna live voice.
- TTS/auto-read.
- Voice state machine.
- Clear unavailable/error state.
- Future image/document/canvas multimodal boundaries.

## 2F. Net audit - market baseline 2026

Audyt web wskazuje, ze aktualny rynek nie konkuruje juz samym modelem. Najsilniejsze produkty lacza model z workspace, projektami, pamiecia, connectorami, artefaktami, agentami, approval i observability.

| Benchmark web | Wzorzec rynkowy | Wniosek dla Consultify |
|---|---|---|
| OpenAI / ChatGPT | deep research, projects, memory, canvas, apps/connectors, agent mode, files, voice | Consultify musi miec `ResearchSession`, project context, memory governance, artifact runtime i workload router |
| Anthropic / Claude | Projects, Artifacts, connectors/MCP, long-context docs, shared project knowledge | Potrzebny project room, artifact library, connector policy, role/project instructions |
| Palantir AIP | ontology, typed tools, action logs, approval, observability, least-privilege | V10 musi miec business ontology, `AIRun`, action log, audit viewer i permissioned tools |
| Notion AI | enterprise search, AI connectors, meeting notes, permission-aware retrieval | Org memory i connectors musza respektowac ACL, freshness, source scope i admin setup |
| Perplexity-style research | cited answers, source scope, research reports | Trust bundle i evidence graph sa P0, nie UX nice-to-have |
| Gamma / deck tools | prompt-to-deck, client-ready visual outputs | Artifact runtime musi obejmowac deck/report exports, nie tylko markdown |
| ClickUp / Linear / Monday | AI embedded in project/task execution | Chat musi przechodzic w proposal -> task/initiative -> owner -> deadline -> KPI |

### 2F.1 Market capability minimum

Minimum rynkowe przed powazna implementacja:

- project/workspace context, nie tylko global chat history;
- permission-aware enterprise search;
- background research with final artifact;
- editable artifacts with share/export;
- tool/action execution with approval and audit;
- connector admin and source scope;
- memory settings, consent and stewardship;
- cost/budget visibility;
- incident/observability for AI runs.

## 2G. Softs audit - rozszerzone kategorie benchmarku

`Softs` jest szersze niz obecna tabela 2C. Poza chatem, agentami, KB, projektami, prezentacjami, KPI i Palantirem zawiera dodatkowe kategorie, ktore powinny wejsc do planu jako osobne wzorce.

| Kategoria w `Softs` | Przyklady | Capability do dopisania / utrzymania w planie |
|---|---|---|
| Ankiety / VoC | Qualtrics, SurveyMonkey, Typeform | survey ingestion, VoC analysis, quantified customer insight, survey artifact |
| Kalendarz / scheduling | CalDAV, Google Calendar, Microsoft Graph, Outlook | calendar as source, deadline constraint, scheduled agents, meeting prep/follow-up |
| iPaaS / synchronizacja | Boomi, Workato, Mulesoft | connector runtime as enterprise data pipe, sync status, retry, freshness, error handling |
| No-code tables/apps | Airtable, Coda | table artifact, lightweight app artifact, views/forms, structured business records |
| Diagramy | Lucid, Mermaid | process maps, architecture diagrams, transformation blueprint, diagram artifact |
| Whiteboard/canvas | Miro, Excalidraw, tldraw | collaborative canvas, workshop capture, sticky-note clustering, canvas-to-plan |
| Realtime collaboration | Liveblocks | multi-user artifact editing, comments, presence, conflict handling |
| BI / OKR / KPI | Quantive, Databox, Looker, Perdoo, Workboard, Tableau | KPI source connectors, OKR linkage, metric freshness, outcome reporting |
| Financial planning | Anaplan, finance references | scenario planning, budget model, ROI sensitivity, CFO artifact |
| Prompt/RAG stack | LlamaIndex, Perplexity, prompt guides | prompt governance, retrieval policy, evidence ranking, source class contracts |
| Dev/sandbox agents | Replit, agent/dev references | safe sandbox, tool testing, deploy/run boundaries, generated app artifacts |
| Partner programs | HubSpot, Dropbox, DigitalOcean | GTM/partner motion, partner proof pack, integration marketplace path |

### 2G.1 Softs additions that are missing or too implicit

Do dopisania do backlogu jako jawne capability:

1. **VoC / survey intelligence** - ankiety i customer feedback jako first-class research source.
2. **Calendar-aware AI** - meeting prep, follow-up, deadlines, scheduled research and scheduled agents.
3. **iPaaS-grade connector ops** - connector health, retry, sync logs, freshness SLA.
4. **No-code table app artifacts** - nie tylko spreadsheets, ale business records, forms and views.
5. **Structured diagrams** - process maps, transformation maps, architecture diagrams as artifacts.
6. **Workshop canvas** - whiteboard import, clustering, decision extraction and artifact conversion.
7. **Financial scenario runtime** - Anaplan-style planning, ROI sensitivity and CFO proof.

## 2H. V8 parity audit - missing traceability before implementation

`AI_dev_fin.md` opisuje V8 funkcjonalnie, ale przed implementacja potrzebna jest jawna mapa zgodnosci z `docs/plans/CHAT_V8_AI_PARITY_AUDIT.md`. Bez tego latwo zaczac od V10, pomijajac twarde prerekwizyty V8.

### 2H.1 Required V8 traceability matrix

| V8 audit area | Status w planie | Co trzeba dopisac do wykonania |
|---|---|---|
| Single shell / route unification | Czesciowe | `/chat` i split chat musza isc przez `UnifiedChatPanel`; legacy shell ma plan dekomisji |
| `execution_proposal` message type | Czesciowe | DB/API/UI vocabulary: `pending_review`, `approved`, `rejected`, `executed`, `audited` |
| Three AI surfaces | Czesciowe | help assistant vs workspace copilot vs governed execution assistant, z osobnym data/tool scope |
| Cloud OAuth honesty | Slabe/czesciowe | provider status: supported, settings-only, not supported; brak fake connect UX |
| Prompt governance / composer | Czesciowe | precedence: base persona -> governance -> co-thinker -> retrieval -> style |
| Control surface registry | Czesciowe | canonical / partial / legacy controls; link do V8 control surface spec |
| R1-R25 requirements | Brak jawnej macierzy | R1-R25 -> etap -> owner -> DoD -> test |
| Wave A/B/C roadmap | Brak jawnej translacji | Wave A/B/C -> Etap 0-12 w tym dokumencie |

### 2H.2 Mandatory pre-V10 rule

Nie zaczynac pelnej implementacji V10 runtime, dopoki nie ma decyzji dla:

- single shell;
- message type and action lifecycle vocabulary;
- trust/source contract;
- research session boundary;
- Teresa/Anna surface separation;
- legacy controls deprecation.

## 2I. Final capability map - elementy wymagane przez produkt

Ta sekcja jest lista kontrolna dla pelnego AI OS. Kazdy element musi miec status `live`, `partial`, `planned`, `blocked` albo `out_of_scope` przed rozpoczeciem implementacji.

### 2I.1 Zarzadzanie aplikacja i wykonywanie prac na narzedziach

AI ma umiec inicjowac, przygotowywac i po zatwierdzeniu wykonywac prace w aplikacji:

- tworzenie i aktualizacja inicjatyw;
- tworzenie taskow, ownerow, deadline, statusow i zaleznosci;
- przygotowanie raportow i executive summaries;
- tworzenie prezentacji/deckow dla klienta, zarzadu i inwestora;
- tworzenie tabel, arkuszy, KPI tables, financial scenarios i no-code table views;
- tworzenie diagramow, process maps, transformation maps i architecture blueprints;
- przygotowanie meeting notes, follow-up, risk log i decision log;
- wprowadzanie zmian do artefaktow przez `MutationProposal`;
- wykonywanie akcji tylko przez `AIRun` z approval i audit.

Minimalny kontrakt:

```text
user intent -> AI proposal -> preview/diff -> approval -> AIRun -> result -> audit -> artifact/update
```

### 2I.2 Kontekst organizacji, projektow i osoby

AI ma rozmawiac w kontekscie:

- organizacji: profil firmy, branza, cele, ograniczenia, struktura, systemy, polityki;
- projektu: cele, scope, timeline, decyzje, dokumenty, uczestnicy, ryzyka, status;
- osoby: rola, uprawnienia, preferencje, historia pracy, zadania, styl komunikacji;
- zespolu: ownerzy, zaleznosci, odpowiedzialnosci, eskalacje;
- workspace: pliki, rozmowy, artefakty, taski, raporty, decyzje, KPI.

Wymagane encje:

- `OrgContextSnapshot` - aktualny, wersjonowany obraz organizacji.
- `ProjectContextSnapshot` - aktualny, wersjonowany obraz projektu.
- `UserWorkProfile` - rola, preferencje, permission scope, aktywne zadania.
- `ContextLedger` - zrodla uzyte do odpowiedzi lub akcji.

### 2I.3 Wypelnianie dokumentow i podpowiedzi

AI ma pomagac w pracy na dokumentach:

- wypelnianie szablonow: brief, assessment, business case, risk log, decision memo, steering report;
- podpowiadanie brakujacych danych i pytan doprecyzowujacych;
- wykrywanie sprzecznosci i luk;
- sugerowanie kolejnych krokow;
- generowanie wersji roboczej i wariantow;
- oznaczanie zalozen, ryzyk, zrodel i pewnosci;
- zapisywanie wyniku jako artifact z wersja i provenance.

Regula: dokument moze zostac zaproponowany automatycznie, ale zapis/commit wymaga jawnego zatwierdzenia, jesli zmienia stan workspace.

### 2I.4 Role, persony i agenci

AI ma umiec przejmowac role, ale w kontrolowany sposob:

| Rola | Zakres | Output |
|---|---|---|
| CEO advisor | priorytety, strategia, decyzje, trade-offs | executive brief, decision memo |
| CFO agent | ROI, budzet, scenariusze, ryzyko finansowe | financial model, KPI/ROI report |
| COO agent | operacje, bottlenecks, owners, escalation | operating plan, blocker report |
| Transformation officer | roadmapa, zaleznosci, status programu | transformation roadmap |
| IT/CISO agent | security, compliance, data flow, access | security pack, risk register |
| Consultant agent | discovery, diagnosis, recommendations | client-ready report |
| Research agent | evidence, benchmark, web/org research | research report artifact |
| Docs/decks/sheets agents | artefakty biznesowe | docs, deck, spreadsheet |
| Governance agent | audit, policy, approval, risk | governance review |

Kazda rola musi miec:

- prompt/persona;
- tool scope;
- source scope;
- output schema;
- approval policy;
- telemetry;
- tests and golden prompts.

### 2I.5 Samouczenie Anny i Teresy

Anna i Teresa nie moga "uczyc sie po cichu". Wymagany jest kontrolowany learning loop:

```text
feedback / observation -> learning candidate -> preview -> consent/admin review ->
retained or rejected -> memory update -> audit -> future use with source label
```

Wymagane statusy:

- `captured` - feedback lub obserwacja zostala zebrana;
- `candidate` - system proponuje zapamietanie;
- `approved` - user/admin zgodzil sie na zapis;
- `rejected` - odrzucono;
- `retained` - zapisano w pamieci;
- `applied` - uzyto w przyszlej odpowiedzi lub akcji;
- `expired` - wygaslo zgodnie z retention policy.

Anna:

- uczy sie publicznych pytan produktowych, obiekcji, jezyka klientow i FAQ;
- nie zapisuje danych tenantowych;
- ma oddzielny public product memory i release-approved knowledge base.

Teresa:

- uczy sie kontekstu organizacji, preferencji workspace, decyzji, stylu pracy i wzorcow wykonania;
- dziala tylko w granicach uprawnien usera i tenant policy;
- kazdy zapis do org memory ma stewarda, scope i audit.

### 2I.6 Podpowiedzi proaktywne

AI ma nie tylko odpowiadac, ale tez podpowiadac:

- brakujace informacje w dokumencie;
- ryzyka i niespojnosci;
- kolejne kroki;
- deadline/follow-up;
- potrzebne approval;
- nieaktualne zrodla;
- przekroczony budzet AI;
- mozliwe KPI i ROI dla inicjatywy.

Podpowiedzi proaktywne nie moga byc nachalne. Musza miec severity, source i opcje dismiss/snooze.

## 3. Co juz mamy w kodzie

### 3.1 Chat i streaming

Mamy realny streaming AI:

- `src/hooks/useAIStream.ts` obsluguje streaming, retry, abort, citations, policy notices, source ledger, deep thinking state, agent audit sources, Teresa proposal i artifact stripping.
- `server/src/routes/ai.routes.ts` jest centralnym runtime endpointem dla chat stream, policy gateway, citations, web/research, attachments i Deep Thinking.

Stan: mocna baza, ale za duzo logiki jest skupione w jednym route handlerze.

### 3.2 Cytowania i source rendering

Mamy:

- `src/components/AIChat/MessageRenderer.tsx` - inline `[1]`, `[2]` jako klikalne markery;
- `src/components/AIChat/CitationList.tsx` - lista zrodel, sanitizacja tytulow, ukrywanie technicznych nazw typu `rag_1` i `Source 1`;
- `server/src/services/ai/citationExtractor.ts` - ekstrakcja cytowan;
- testy dla source/citation behavior.

Stan: realne, ale niepelne jako enterprise trust. Brakuje jednego kanonicznego trust bundle.

### 3.3 Product knowledge: DBR77 / Consultify / Marketplace

Mamy:

- `server/src/services/ai/chatStabilizationPolicy.ts` - fallback produktowy dla Consultify, feedbacku, marketplace i pytan "jak dodac element";
- poprawki commitowe dla Anna/Teresa DBR77 portfolio knowledge retrieval;
- `server/src/services/ai/annaKnowledgeService.ts`;
- `server/src/services/ai/virtualWorkerKnowledgeService.ts`;
- testy `ai-chat-stabilization-policy`, `ai-dbr77-knowledge-policy`.

Stan: realne, ale nadal trzeba rozdzielic product truth od web research jako formalny source class.

### 3.4 Attachments i analiza dokumentow

Mamy:

- endpoint ingest plikow w `server/src/routes/ai.routes.ts`;
- test `tests/integration/ai/ai-attachments-ingest.test.ts`;
- status `PDF_TEXT_EXTRACTION_FAILED` i `ocr_required_or_unreadable` dla trudnych PDF;
- attachment citations emitowane do streamu.

Stan: realne dla podstawowych plikow, ale brakuje pelnego OCR pipeline, preview zrodel i konsekwentnego UI statusu ingest.

### 3.5 Deep Thinking / Research

Mamy:

- confirm gate dla Deep Thinking;
- `server/src/services/ai/deepThinkingOrchestrator.ts`;
- metryki i eventy Deep Thinking;
- self-check i quality hooks w `ai.routes.ts`;
- UI state w `useAIStream.ts`.

Stan: czesciowe. To jest nadal tryb streamingu, a nie pelna `research_session` z kolejka, resume, retry, cancel i report artifact.

### 3.6 Teresa / Anna

Mamy:

- `server/src/services/v8/teresaCopilotService.ts` - Teresa proposal lifecycle, target modules, audit trail, no silent writes;
- `server/src/routes/v8/teresa.routes.ts`;
- `src/contexts/TeresaVoiceContext.tsx`;
- `src/hooks/useTeresaVoice.ts`;
- `src/components/AIChat/VoiceConversationOverlay.tsx`;
- public Anna retrieval i DBR77 product knowledge improvements.

Stan: Teresa proposal runtime jest mocny koncepcyjnie, ale voice jest kruche bez V10 `/api/v10/teresa/voice-config`.

### 3.7 Voice / STT / TTS

Mamy:

- `src/hooks/useUniversalVoice.ts` dla voice/dictation/TTS pieces;
- `src/hooks/useTeresaVoice.ts` dla Gemini Live realtime voice;
- `VoiceModeLegend`, `VoiceLegendShortcut`, `VoiceConversationOverlay`;
- telemetry VM10 dla voice funnel.

Problem:

- obecny `useTeresaVoice.ts` probuje czytac `process.env.NEXT_PUBLIC_GEMINI_API_KEY`, `process.env.GEMINI_API_KEY`, `process.env.API_KEY` po stronie frontendu. To jest zle dopasowane do Vite i moze powodowac "martwy" przycisk voice.
- V10 mial rozwiazac to przez server route `/api/v10/teresa/voice-config`, ale tej paczki nie ma w aktualnym branchu.

Stan: czesciowe / wysokie ryzyko UX.

### 3.8 AI actions, proposals, approvals

Mamy:

- `src/components/AIChat/ExecutionProposalMessage.tsx`;
- `server/src/services/v8/chatExecutionService.ts`;
- `server/src/services/v8/teresaCopilotService.ts`;
- typy proposal/lifecycle w `src/types` i `server/src/types`;
- `execution_proposal`, `execution_progress`, `execution_result` jako rodzina message type w UI.

Stan: czesciowe. UI i service istnieja, ale klasyfikacja intencji w `chatExecutionService.ts` jest heurystycznym stubem, nie pelnym reasoning routerem. Brakuje centralnego action center i run ledger.

### 3.9 Artefakty i structured output

Mamy:

- `StructuredOutputBlock`;
- artifact stripping w `useAIStream.ts`;
- `V8ArtifactRunControl`;
- czesc modeli i store dla artefaktow.

Stan: czesciowe. Brakuje unified `Artifact` runtime z wersjami, mutation proposal, diff/approve/commit, provenance footer i export manifest.

### 3.10 Admin / governance / flags

Mamy:

- V9 flag registry;
- admin flags panel;
- role gating;
- telemetry contract dla V9;
- policy notices i policy refusal rendering;
- czesc AI settings.

Stan: dobre operacyjnie dla V9, ale brakuje AI ops dashboardu, evals, release gates, model routing policy i centralnego audit viewer.

### 3.11 Business capability state matrix

| Capability biznesowe | Stan obecny | Najwiekszy brak | Priorytet |
|---|---|---|---|
| Public product guidance | Czesciowe | Anna ma voice/frontend key risk i niepelny product proof loop | P1 |
| Tenant workspace assistant | Czesciowe | Teresa nie ma pelnego V10 voice config i action center | P0 |
| Consulting diagnosis | Czesciowe | Brak formalnego evidence graph i diagnosis artifact | P1 |
| Initiative design | Czesciowe | Brak unified proposal -> initiative -> KPI contract | P1 |
| Execution governance | Czesciowe | Brak `AIRun`, run ledger i audit viewer | P0 |
| ROI proof | Slabe/czesciowe | Brak outcome runtime, baseline, acceptance contract | P1 |
| Enterprise trust | Czesciowe | Brak `TrustBundleV1`, CISO-ready trace i retention view | P0 |
| Artifact-native outputs | Czesciowe | Brak unified `Artifact`, mutation proposal i version lineage | P0 |
| Enterprise retrieval | Czesciowe | Brak connector runtime, ACL/freshness/source admin | P1 |
| AI ops | Czesciowe | Brak eval dashboard, provider health, rollout gates | P1 |
| Partner leverage | Slabe/czesciowe | Brak agent catalog, templates i white-label output workflow | P2 |
| Investor moat proof | Slabe/czesciowe | Brak learning loop metrics i outcome evidence | P2 |

## 4. Czego jeszcze nie mamy

### P0 - braki krytyczne

1. Brak V10 runtime w aktualnym branchu.
   - Brakuje `/api/v10`.
   - Brakuje `server/src/services/v10/*`.
   - Brakuje `src/hooks/v10/*`.
   - Brakuje `src/components/v10/V10RuntimeWorkspace.tsx`.
   - Brakuje `ChatV10RuntimesPanel`.

2. Brak jednego kanonicznego trust bundle.
   - Potrzebny jeden obiekt per odpowiedz: sources, source classes, model, tier, tokens, cost, confidence, routing trace, safety warnings, policy notices.
   - Obecnie te dane sa rozproszone.

3. Brak first-class `ResearchSession`.
   - Deep Research musi byc zadaniem z lifecycle: planned, approved, running, paused, completed, archived.
   - Potrzebne resume, retry, cancel, progress, watch delta, final report artifact.

4. Brak pelnego `AIRun` / Run Ledger.
   - Kazdy agent/research/action powinien miec run id, owner, trigger, scope, status, events, audit, errors, output refs.

5. Brak unified `Artifact` runtime.
   - Potrzebne artifact types, versions, lineage, mutation proposals, review state, export manifest, provenance footer.

6. Brak centralnego action center / audit viewer.
   - User i admin musza widziec: co AI zaproponowalo, co zatwierdzono, co wykonano, co odrzucono i dlaczego.

7. Brak server-side Teresa voice config w aktualnym branchu.
   - Bez tego voice moze wygladac jak no-op.

### P1 - braki wysokiej waznosci

1. Org memory jako prawdziwy retrieval source.
   - ACL, freshness, admin surface, permissions, tenant isolation tests.

2. Enterprise connectors.
   - OAuth/session runtime, connector registry, source search/read, token refresh, disconnect, freshness SLO.

3. Reasoning router.
   - Klasyfikacja: fast chat vs deep research vs governed action vs artifact creation vs connector retrieval.
   - Obecny heuristic stub trzeba zastapic runtime routerem.

4. Feedback/self-learning loop.
   - User/admin-visible feedback status: captured, retained, rejected, applied.
   - Stewardship queue i quality dashboard.

5. Workload classes i SLA.
   - `fast_chat`, `deep_research`, `long_job`, `background`, `voice`, `governed_execution`.
   - Kazdy z osobnym modelem, budzetem, timeoutem i telemetry.

6. Agent catalog.
   - Docs agent, sheets agent, slides agent, reports agent, research agent, decision agent, execution agent, governance agent.

7. Output quality gates.
   - Evals, golden prompts, AI chat stabilization matrix jako stale CI/smoke gate.

### P2 - braki rozwojowe

1. Realtime collaboration nad artefaktami.
2. AI-native project room.
3. Scheduled/always-on agents.
4. Investor-grade outcome reporting.
5. Persona-aware onboarding z aktywacja w 5 minut.
6. Cross-module follow-through agents: SLA, owner, deadline, escalation.

### P0/P1 - braki biznesowe i GTM

1. Brak mapy `persona -> AI proof -> demo script`.
   - Sales i landing obiecuja wartosc dla Owner/CEO/CFO/COO/IT, ale AI backlog nie ma jeszcze gotowych proof paths.

2. Brak pilot KPI pack.
   - Potrzebny zestaw: baseline, target, proof, acceptance criteria, export dla klienta.

3. Brak CISO-ready AI security package.
   - Potrzebne: data flow, retention, subprocessors, prompt/output logging, connector ACL, model routing disclosure.

4. Brak investor moat metrics.
   - Potrzebne: reuse of methodology, learning loop adoption, artifact output volume, time-to-output, ROI proof rate.

5. Brak komercyjnego modelu AI capability.
   - AI budget istnieje w produkcie, ale roadmap musi rozdzielic: free/public Anna, tenant Teresa, premium research, connectors, scheduled agents, outcome reports.

6. Brak partner delivery pack.
   - Partnerzy potrzebuja white-label outputs, reusable templates, agent workflows i governance story.

### P0/P1 - braki odkryte w audycie web + Softs

1. Brak `SurveyIntelligence` / VoC runtime.
   - `Softs` zawiera Qualtrics, SurveyMonkey i Typeform, ale plan nie mial osobnego survey/customer feedback source.
   - Potrzebne: survey ingest, response clustering, quantified insight, segment comparison, VoC artifact.

2. Brak calendar-aware AI jako formalnego source/constraint.
   - Kalendarz jest niezbedny dla meeting prep, follow-up, deadlines, scheduled agents i accountability.
   - Potrzebne: calendar source class, time constraints, follow-up proposals, meeting summary -> tasks.

3. Brak iPaaS-grade connector operations.
   - Enterprise connectors musza miec nie tylko OAuth, ale tez sync jobs, retries, freshness, failure state, admin logs.
   - Wzorcem sa Boomi/Workato/Mulesoft oraz Notion/Claude connector admin.

4. Brak no-code table/app artifact.
   - Airtable/Coda sugeruja artefakty tabelaryczne z widokami, formularzami i rekordami, nie tylko spreadsheet export.

5. Brak diagram/process-map artifact.
   - Lucid/Mermaid/Miro/tldraw sugeruja, ze AI powinno tworzyc procesy, blueprinty i mapy transformacji jako edytowalne artefakty.

6. Brak explicit V8 parity traceability.
   - Plan musi miec R1-R25 -> etap -> owner -> DoD -> test, inaczej V10 moze przykryc niedomkniety fundament V8.

7. Brak landing/product honesty matrix.
   - Kazda obietnica landing page powinna miec status: `live`, `partial`, `planned`, `not_available`.

## 5. Backlog rozwoju

### Etap -1 - kompletacja planu i audyt gotowosci

Cel: zanim zaczniemy implementacje, zamknac luki planistyczne wynikajace z V8 audit, web audit i `Softs`.

Zadania:

- Dodac macierz `V8 R1-R25 -> Etap -> Owner -> DoD -> Test`.
- Dodac translacje `Wave A/B/C -> Etap 0-12`.
- Dodac workstream `Single shell / route unification`.
- Dodac workstream `execution_proposal message type and lifecycle vocabulary`.
- Dodac `Three AI surfaces`: help, workspace copilot, governed execution.
- Dodac `Cloud OAuth honesty matrix`: supported, settings-only, not supported.
- Dodac `PromptComposer precedence` i testy regresji.
- Dodac `Softs extended benchmark`: surveys, calendar, iPaaS, no-code tables, diagrams, whiteboard, BI/OKR, finance.
- Dodac `Landing honesty matrix`: live, partial, planned, not_available.
- Dopisac ownerow dla roadmapy: product, backend, frontend, AI ops, security, GTM.

Definition of done:

- Wiemy, co jest prerekwizytem V8, a co nalezy do V10.
- Kazda obietnica marketingowa ma status wdrozenia.
- Kazdy benchmark `Softs` jest sklasyfikowany jako: in scope now, later, out of scope.
- Implementacja startuje od zaleznosci, nie od najladniejszego UI.

### Etap 0 - decyzja o branchu prawdy

Cel: ustalic, czy V10 z commita `a336e4e32` wraca do aktualnego branchu, czy odtwarzamy go modul po module.

Zadania:

- Porownac obecny `feat/ai-chat-v9` z `a336e4e32`.
- Zrobic liste plikow V10 do przywrocenia.
- Ustalic, czy przywracamy calosc, czy minimalny runtime package.
- Oznaczyc konfliktowe zmiany w `UnifiedChatPanel`, `MessageRenderer`, `ai.routes`, `useTeresaVoice`.

Definition of done:

- Jest decyzja merge/rebuild.
- Jest plan migracji bez utraty obecnych poprawek chat stabilization.

### Etap 1 - stabilizacja V8/V9 jako aktualnej bazy

Cel: chat ma byc stabilny, uzywalny i uczciwy.

Zadania:

- Domknac `AI_CHAT_STABILIZATION_ACCEPTANCE_MATRIX`.
- Naprawic Teresa voice no-op przez server-side config albo czytelny fallback.
- Upewnic sie, ze inline citations dzialaja dla web, KB i attachments.
- Usunac user-facing techniczne etykiety: `rag_1`, `Source 1`, `source ledger`, raw artifact JSON.
- Ujednolicic source labels: product knowledge, web research, attachment, workspace, org memory.
- Upewnic sie, ze chat history/folders/rename/refresh sa stabilne.

Definition of done:

- Wszystkie P0 z acceptance matrix sa PASS albo PASS with known limitation.
- Voice nie jest martwym przyciskiem: dziala albo pokazuje jasny blad.
- Chat nie pokazuje raw internal data.

### Etap 2 - Trust Bundle V1

Cel: kazda istotna odpowiedz AI ma jeden kontrakt zaufania.

Zadania:

- Zdefiniowac `TrustBundleV1`.
- Dodac zapis w `conversation_messages.metadata`.
- Emitowac trust bundle ze streamu.
- Renderowac compact trust badge + expanded trust panel.
- Dodac operator view dla admin/superadmin.
- Dodac routing trace: model, tier, tools, retrieval source, cost/tokens.

Definition of done:

- User widzi, czy odpowiedz jest general, web, attachment, workspace, org memory albo mixed.
- Admin widzi trace bez szukania w logach.

### Etap 3 - ResearchSession runtime

Cel: Deep Research staje sie produktem, nie tylko trybem odpowiedzi.

Zadania:

- Dodac encje `research_sessions`.
- Dodac backend lifecycle: planned, approved, running, paused, completed, archived, failed.
- Dodac BullMQ/background job.
- Dodac UI dock/lista sesji.
- Dodac watch delta/progress.
- Dodac final artifact `research_report`.
- Dodac resume/retry/cancel.

Definition of done:

- Research mozna uruchomic, zamknac okno, wrocic i kontynuowac.
- Wynik jest zapisany jako artefakt.

### Etap 4 - AI Actions + Run Ledger

Cel: akcje AI sa glownym interfejsem pracy, ale governance-first.

Zadania:

- Dodac `AIRun` / Run Ledger.
- Zastapic heuristic intent classification reasoning routerem.
- Ujednolicic `ChatActionProposal`, Teresa proposals i `ExecutionProposalV1`.
- Dodac action center.
- Dodac audit viewer.
- Rozdzielic `approve` od `execute`.
- Dodac severity policies S0-S4.
- Dodac interrupt verbs: pause, cancel, revise, approve, reject.

Definition of done:

- Kazda mutacja AI ma proposal, approval, execution state i audit.
- Nie ma silent execution.

### Etap 5 - Artifact Runtime V1

Cel: AI tworzy i edytuje artefakty jako pierwszoklasowe obiekty.

Zadania:

- Dodac model `Artifact`.
- Dodac typy: note, decision, task, report, slide_deck, spreadsheet, research_report, initiative_plan.
- Dodac `MutationProposal`.
- Dodac version lineage.
- Dodac diff preview.
- Dodac approve/commit.
- Dodac export manifest.
- Dodac provenance footer.

Definition of done:

- AI moze zaproponowac zmiane w artefakcie.
- User widzi diff, akceptuje i ma audytowana wersje.

### Etap 6 - Enterprise Retrieval + Connectors

Cel: AI korzysta z wiedzy organizacji i zewnetrznych systemow w kontrolowany sposob.

Zadania:

- Dodac `org_memory` jako source class w UI.
- Dodac admin surface dla org knowledge.
- Dodac connector registry.
- Dodac OAuth/session runtime.
- Dodac source search/read.
- Dodac ACL enforcement.
- Dodac freshness/failure status.
- Dodac tenant isolation tests.

Definition of done:

- AI odpowiada z org memory tylko wtedy, gdy user ma uprawnienia.
- User widzi, ktore zrodla weszly do odpowiedzi.

### Etap 6A - Connector Ops / iPaaS-grade reliability

Cel: connectors sa traktowane jak enterprise data pipes, nie jak pojedyncze OAuth checkboxy.

Zadania:

- Dodac `connector_runs` / sync ledger.
- Dodac retry policy, backoff, failure classification.
- Dodac freshness SLA per connector.
- Dodac admin connector health panel.
- Dodac source disable / reconnect / reindex.
- Dodac audit dla access scope changes.
- Dodac failure UX: stale source, disconnected, permission denied, sync delayed.

Definition of done:

- Admin wie, czy connector dziala, kiedy ostatnio sie zsynchronizowal i czemu zrodlo jest niedostepne.
- User nie dostaje odpowiedzi opartych o stare lub niedostepne dane bez ostrzezenia.

### Etap 6B - Survey, Calendar and Workshop Sources

Cel: AI korzysta z materialow transformacyjnych, ktore w praktyce sa poza dokumentami: ankiety, kalendarz, warsztaty i whiteboard.

Zadania:

- Dodac `survey_response` jako source class.
- Dodac ingest dla CSV/Form/Typeform-like response export.
- Dodac survey clustering, sentiment/themes, quantified insight.
- Dodac `calendar_event` jako source class.
- Dodac meeting prep, follow-up i deadline proposal.
- Dodac whiteboard/canvas import jako artifact source.
- Dodac conversion: canvas/sticky notes -> decisions, risks, initiatives, tasks.

Definition of done:

- AI potrafi uzyc ankiet i warsztatow jako dowodow diagnozy.
- Meeting follow-up moze przejsc w governed proposal.
- Calendar/deadline context nie jest gubiony w chat history.

### Etap 7 - Learning Loop

Cel: feedback uzytkownikow realnie poprawia AI, ale pod kontrola.

Zadania:

- Ujednolicic feedback events.
- Dodac retention preview.
- Dodac stewardship queue.
- Dodac admin quality dashboard.
- Dodac memory mutation audit.
- Dodac consent/opt-out.
- Dodac "learned/applied" status.

Definition of done:

- Feedback nie znika w backendzie.
- Admin widzi, co system chce zapamietac i moze to zatwierdzic/odrzucic.

### Etap 8 - Agent Catalog + Scheduled Agents

Cel: Consultify ma specjalizowane agenty zamiast jednego ogolnego czatu.

Agenci MVP:

- Research Agent;
- Docs Agent;
- Reports Agent;
- Slides Agent;
- Sheets/Finance Agent;
- Decision Agent;
- Execution Agent;
- Governance Agent.

Zadania:

- Dodac `AgentCatalog`.
- Kazdy agent ma prompt, tool set, output schema i approval policy.
- Dodac scheduled runs.
- Dodac agent swarm dla wybranych scenariuszy.
- Dodac notifications po zakonczeniu runu.

Definition of done:

- User wybiera agenta albo AI router wybiera go jawnie.
- Kazdy agent zwraca artefakt, proposal albo audytowalna odpowiedz.

### Etap 9 - Outcome Runtime

Cel: AI laczy prace konsultingowa z wynikiem biznesowym.

Zadania:

- KPI acceptance preview.
- Outcome signal ingest.
- Business effect summary.
- ROI calculation.
- Investor/client-ready report.
- Powiazanie: chat -> initiative -> task -> KPI -> ROI -> report.

Definition of done:

- AI nie tylko odpowiada, ale pokazuje efekt biznesowy dzialan.

### Etap 9A - Finance and Scenario Runtime

Cel: CFO dostaje nie tylko opis ROI, ale scenariusze finansowe i zalozenia.

Zadania:

- Dodac scenario inputs: baseline, optimistic, conservative, risk-adjusted.
- Dodac sensitivity analysis dla kosztow, oszczednosci i terminu.
- Dodac planning artifact inspirowany Anaplan/finance references.
- Dodac assumptions ledger.
- Dodac export do spreadsheet/report artifact.

Definition of done:

- CFO widzi zalozenia, scenariusze i zakres niepewnosci.
- ROI nie jest pojedyncza liczba bez audytu.

### Etap 10 - Onboarding i AI OS UX

Cel: nowy user w 5 minut rozumie, co AI moze zrobic i jak bezpiecznie z niego korzystac.

Zadania:

- Persona picker.
- Trust-first onboarding.
- Conservative defaults.
- Pierwsze zadanie AI z bezpiecznym zakresem.
- Guided setup dla org memory, connectors, voice i reports.
- AI project room: chat + research + artifacts + decisions + tasks + timeline.

Definition of done:

- Nowy user wie, kiedy AI tylko odpowiada, kiedy proponuje, a kiedy wykonuje po approval.

### Etap 11 - GTM Proof Packs

Cel: kazda obietnica marketingowa ma demo, kryteria sukcesu i artefakt dowodowy.

Zadania:

- Przygotowac demo path dla Owner, CEO, CFO, COO, Transformation Officer, IT/CISO.
- Dodac `pilot_kpi_pack`: baseline, target, owner, measurement cadence, proof artifact.
- Dodac `security_ai_pack`: data flow, model routing, retention, connector ACL, subprocessor notes.
- Dodac `investor_ai_moat_pack`: methodology memory, learning loop metrics, output reuse, partner leverage.
- Dodac `partner_delivery_pack`: templates, white-label reports, role-based agents, margin/leverage proof.

Definition of done:

- Sales moze pokazac AI nie jako feature, ale jako measurable execution system.
- Kazda persona ma 1-2 gotowe dowody w produkcie albo w demo.

### Etap 12 - Commercial AI Entitlements

Cel: funkcje AI sa powiazane z budzetem, planem, ryzykiem kosztowym i customer value.

Zadania:

- Zdefiniowac poziomy AI: public, tenant basic, research, agent runtime, enterprise connectors, scheduled/always-on.
- Polaczyc workload classes z AI budget.
- Dodac cost forecast do trust panel / admin AI ops.
- Dodac limit policy dla deep research, agent swarm i connectors.
- Dodac customer-facing komunikaty limitow: budget, provider unavailable, feature not included.

Definition of done:

- CFO/admin rozumie koszt AI.
- User widzi, czy funkcja jest niedostepna z powodu planu, budzetu, uprawnien czy awarii.

## 5A. Kompletny plan wdrozenia finalnego AI

### 5A.1 Kolejnosc techniczna

Implementacja powinna isc od fundamentow danych i kontroli, a nie od najbardziej widocznych UI.

| Faza | Cel | Zakres | Nie zaczynac kolejnej fazy dopoki |
|---|---|---|---|
| F0 | Plan freeze and traceability | R1-R25, Wave A/B/C, landing honesty, ownerzy, DoD | kazdy wymog ma etap, ownera i test |
| F1 | Single AI shell | `UnifiedChatPanel`, route unification, legacy deprecation | full/split chat uzywaja tego samego kontraktu |
| F2 | Trust and source contract | `TrustBundleV1`, source classes, policy notices, citations | kazda sourced answer ma trust payload |
| F3 | Proposal/action contract | `execution_proposal`, lifecycle vocabulary, approval UI | zadna mutacja nie omija proposal/approval |
| F4 | `AIRun` and audit | run ledger, action center, audit viewer, severity policy | kazda akcja ma run id i audit trail |
| F5 | `ResearchSession` | background jobs, resume/retry/cancel, evidence graph, report artifact | research jest odtwarzalna sesja, nie request |
| F6 | `Artifact` runtime | artifact model, mutation proposal, diff, version lineage, export | user widzi preview/diff przed commitem |
| F7 | Org/project context | `OrgContextSnapshot`, `ProjectContextSnapshot`, `UserWorkProfile`, ACL | AI nie miesza kontekstow i uprawnien |
| F8 | Tools and app work | tabele, raporty, decki, inicjatywy, taski, dokumenty | narzedzia dzialaja przez `AIRun` |
| F9 | Learning loop | Anna/Teresa memory, consent, stewardship, retained/rejected/applied | nie ma hidden learning |
| F10 | Agent catalog | role agents, tool scopes, output schemas, golden prompts | kazdy agent ma testy i approval policy |
| F11 | Outcome runtime | KPI/ROI, scenarios, business effect, client/investor reports | output ma baseline, assumptions i confidence |
| F12 | AI ops and GTM hardening | evals, dashboards, budgets, incident playbooks, SKU gates | release ma monitoring i rollback |

### 5A.2 Minimalny MVP finalnego AI OS

MVP nie oznacza wszystkich agentow. Minimalny finalny OS musi miec:

1. Jeden chat runtime dla full/split.
2. `TrustBundleV1`.
3. `execution_proposal` jako realny message type.
4. `AIRun` dla kazdej akcji.
5. `ResearchSession` dla deep research.
6. `Artifact` dla report/task/decision/initiative/spreadsheet/deck.
7. `OrgContextSnapshot` i `ProjectContextSnapshot`.
8. Teresa jako workspace copilot z tool scope.
9. Anna jako public product assistant bez tenant memory.
10. Learning loop z consent i audit.
11. Action center + audit viewer.
12. Golden prompts + automated agent test suite.

### 5A.3 Wymagane modele danych

Minimalne encje do zaprojektowania przed kodowaniem:

- `TrustBundleV1`
- `ResearchSession`
- `AIRun`
- `Artifact`
- `MutationProposal`
- `ActionProposal`
- `OrgContextSnapshot`
- `ProjectContextSnapshot`
- `UserWorkProfile`
- `ContextLedger`
- `MemoryCandidate`
- `MemoryStewardshipDecision`
- `AgentDefinition`
- `ToolDefinition`
- `ConnectorRun`
- `OutcomeMetric`
- `KpiAcceptanceContract`

### 5A.4 Wymagane powierzchnie UI

| UI | Cel |
|---|---|
| Unified AI Chat | jeden runtime rozmowy, trust, citations, proposals |
| Action Center | wszystkie AI proposals, approvals, executions, failures |
| Audit Viewer | kto/co/kiedy/dlaczego, source and action trace |
| Artifact Workspace | dokumenty, raporty, decki, tabele, diff, versions |
| Research Sessions Dock | postep, resume, retry, cancel, final report |
| Org/Project Context Panel | jaki kontekst AI zna i skad |
| Memory Stewardship Panel | co Anna/Teresa chca zapamietac |
| Agent Catalog | role, tool scope, output schemas |
| AI Ops Dashboard | evals, cost, provider health, incidents, release gates |
| Connector Admin | OAuth, sync, freshness, ACL, failures |

### 5A.5 Wymagane zasady bezpieczenstwa

- Kazda mutacja idzie przez proposal i approval.
- Kazde narzedzie ma tool scope, permission scope i audit.
- Kazde zrodlo ma source class, freshness i ACL.
- Kazdy artifact commit ma version lineage.
- Kazda memory mutation ma consent albo admin stewardship.
- Kazdy agent ma allowed tools i blocked tools.
- Kazde uruchomienie AI ma run id lub message trace.
- Kazdy kosztowny workload ma budget gate.
- Kazde niedostepne capability ma honest unavailable state.

## 5B. Plan testow automatycznych po wdrozeniu - modul agent w ChatGPT

Po wdrozeniu kazdej fazy wykonujemy testy automatyczne prowadzone przez modul agent w ChatGPT. Testy maja symulowac realna prace uzytkownika w aplikacji i sprawdzac wynik, UI, dane, audit oraz brak ukrytych mutacji.

### 5B.1 Zasada testowania agentem

Agent testowy nie ma tylko klikac UI. Ma dzialac jak klient:

```text
scenario -> prompt/user action -> observe UI/API state -> verify artifact/action/audit ->
classify PASS / FAIL / BLOCKED -> create bug report with evidence
```

Kazdy test powinien zapisac:

- prompt lub kroki uzytkownika;
- role testowa;
- workspace/project;
- expected result;
- actual result;
- screenshots/log snippets, jesli dostepne;
- affected capability;
- severity;
- suggested fix area.

### 5B.2 Test personas

| Persona testowa | Co sprawdza |
|---|---|
| Owner | value, roadmap, ROI, executive summary |
| CEO | strategy, decisions, priorities, initiative portfolio |
| CFO | budget, ROI, scenarios, assumptions |
| COO | owners, deadlines, blockers, execution |
| Transformation Officer | roadmap, program status, dependencies |
| IT/CISO | trust, ACL, audit, retention, connectors |
| Consultant | diagnosis, recommendations, client-ready reports |
| Admin | flags, audit, memory stewardship, connector health |

### 5B.3 Core automated scenarios

1. **Fast chat sanity**
   - User asks a simple product/business question.
   - Expected: fast answer, no raw JSON, no fake citations, trust state visible.

2. **Source-backed answer**
   - User asks about uploaded document.
   - Expected: citations, attachment source class, trust bundle, no hallucinated source.

3. **Deep research session**
   - User starts research, closes/reopens session, requests final report.
   - Expected: resumable `ResearchSession`, progress, evidence, artifact output.

4. **Create initiative**
   - User asks Teresa to create transformation initiative.
   - Expected: proposal preview, owner/deadline/KPI, approval required, audit after execution.

5. **Create report artifact**
   - User asks for executive report.
   - Expected: `Artifact`, version, provenance, export or preview.

6. **Create presentation**
   - User asks for board deck.
   - Expected: slide outline/deck artifact, source assumptions, editable structure.

7. **Create table/spreadsheet**
   - User asks for KPI table or ROI spreadsheet.
   - Expected: structured table artifact, formulas/assumptions where relevant.

8. **Fill document**
   - User opens a business case template and asks AI to fill missing sections.
   - Expected: suggestions, missing data questions, diff before commit.

9. **Project context**
   - User asks question in project A and then project B.
   - Expected: no context leakage, project sources visible.

10. **Org memory and ACL**
    - User without permission asks about restricted source.
    - Expected: denial or no-source notice, no leaked content, audit.

11. **Learning loop**
    - User gives feedback "remember this preference".
    - Expected: memory candidate, preview, consent/review, retained/applied status.

12. **Anna vs Teresa separation**
    - Anna is asked tenant-specific question.
    - Expected: Anna refuses or asks for workspace context; no tenant memory access.

13. **Role switching**
    - User asks same scenario as CFO, COO and CISO.
    - Expected: different output schema, role-specific risks and metrics.

14. **Connector freshness**
    - Connector source is stale/disconnected.
    - Expected: visible stale/disconnected state, no silent use as fresh data.

15. **No silent execution**
    - User asks AI to modify task/report directly.
    - Expected: proposal first, approval required, audit after action.

16. **Voice unavailable**
    - Voice is unavailable or key missing.
    - Expected: clear unavailable state, no dead button.

17. **Budget gate**
    - User starts expensive research/agent swarm.
    - Expected: budget/confirmation gate and cost estimate.

18. **Regression: raw internals**
    - Agent scans responses for `rag_1`, raw source ledger, raw artifact JSON, stack traces.
    - Expected: zero user-facing leaks.

### 5B.4 Test acceptance matrix

| Capability | Required PASS |
|---|---|
| Chat | stream, stop/retry, trust, citations, no raw internals |
| Trust | source class, model/tier, confidence, cost/tokens where available |
| Research | lifecycle, resume, evidence, final artifact |
| Actions | proposal, approval, execution state, audit |
| Artifacts | preview, diff/mutation, version, export/provenance |
| Org/project context | correct context, no leakage, ACL |
| Learning | candidate, approval, retained/rejected/applied, audit |
| Roles | role-specific schema, tool scope, no overreach |
| Connectors | OAuth state, freshness, ACL, failure UX |
| Outcome | KPI, baseline, target, assumptions, ROI |
| Voice | works or honest unavailable state |
| AI ops | eval result, logs, cost, provider health |

### 5B.5 Release gates

Funkcja AI nie przechodzi do `live`, jesli:

- agent test wykrywa silent execution;
- source/citation sa falszywe albo nieczytelne;
- restricted source przecieka do usera bez uprawnien;
- artifact zapisuje sie bez preview albo audit;
- learning zapisuje pamiec bez zgody;
- voice button wyglada na aktywny, ale nic nie robi;
- connector stale data jest pokazany jako aktualny;
- test persona CISO nie widzi audit/source trace;
- regression pokazuje raw internals.

### 5B.6 Raport po testach

Po kazdym przebiegu agent ChatGPT powinien wygenerowac raport:

- `PASS / FAIL / BLOCKED` per capability;
- lista bugow P0/P1/P2;
- screenshots/log references;
- brakujace telemetry;
- brakujace test data;
- rekomendacja: release, release behind flag, rollback, block.

## 5C. Program dowiezienia AI OS w 9 falach

To jest glowny program wykonawczy. Kazda fala konczy sie manualnym testem agenta ChatGPT, raportem uwag, poprawkami i formalna bramka. Nie przechodzimy dalej, jesli bramka nie jest zamknieta.

Zasada:

```text
implementacja fali -> test manualny agentem ChatGPT -> raport brakow ->
fixes -> retest -> gate decision -> next wave
```

Status bramki:

- `PASS` - fala zamknieta, mozna isc dalej.
- `PASS_WITH_LIMITATIONS` - mozna isc dalej tylko jesli ograniczenia sa opisane, oflagowane i nie dotycza P0.
- `BLOCKED` - nie idziemy dalej; naprawiamy P0/P1.
- `ROLLBACK` - wycofujemy release albo chowamy funkcje za flaga.

Kazda fala musi miec:

- wlasciciela product;
- wlasciciela backend;
- wlasciciela frontend;
- wlasciciela QA/agent testing;
- feature flags;
- telemetry;
- release notes;
- rollback path;
- test data;
- agent test script;
- gate report.

### Wave 0 - Runtime Truth, Scope Freeze and V8/V10 Decision

Cel: ustalic jedna prawde implementacyjna przed rozpoczeciem pracy. Ta fala usuwa chaos po kilku "finalnych" probach i zamienia liste funkcji w program wykonawczy.

Zakres:

- zamrozenie listy funkcji AI OS;
- mapa `live / partial / missing / blocked`;
- decyzja: V10 merge vs rebuild;
- mapa V8 R1-R25 do fal;
- translacja Wave A/B/C z audytu V8 na 9 fal;
- status single shell: full chat i split chat;
- status Anna vs Teresa;
- status voice;
- status trust/citations;
- status actions/proposals;
- status artifacts;
- status memory/learning;
- status connectors;
- status AI ops.

Prace do wykonania:

1. Zrobic inventory plikow i funkcji:
   - `UnifiedChatPanel`;
   - `useAIStream`;
   - `ai.routes`;
   - `MessageRenderer`;
   - `CitationList`;
   - `TrustBadge`;
   - `ExecutionProposalMessage`;
   - Teresa services;
   - Anna knowledge services;
   - V10 files z commita `a336e4e32`.
2. Dla kazdej funkcji wpisac status:
   - `live`;
   - `partial`;
   - `missing`;
   - `blocked`;
   - `legacy`;
   - `duplicate`.
3. Wyznaczyc prerekwizyty:
   - single shell przed TrustBundle;
   - action vocabulary przed AIRun;
   - artifact model przed document filling;
   - context snapshots przed project/org AI;
   - learning stewardship przed self-learning;
   - connector ACL przed enterprise retrieval.
4. Ustalic feature flags dla kazdej fali.
5. Ustalic test data:
   - workspace testowy;
   - projekt A i projekt B;
   - dokument PDF;
   - plik CSV;
   - deck/report template;
   - user z pelnymi uprawnieniami;
   - user z ograniczonymi uprawnieniami;
   - admin/CISO;
   - public Anna user.

Definition of done:

- jedna tabela prawdy dla calego AI OS istnieje i jest zaakceptowana;
- wiadomo, ktore elementy V10 odzyskujemy, a ktore przebudowujemy;
- nie ma nieopisanych duplikatow runtime;
- kazda kolejna fala ma wlasciciela, flagi i test data;
- landing/GTM nie obiecuje funkcji bez statusu `live` albo `planned`.

Manualny test agentem ChatGPT:

Agent ma wcielic sie w technical program managera i przejsc przez plan:

1. Poprosic aplikacje/dokumentacje o liste funkcji AI.
2. Porownac liste z katalogiem 15 glownych funkcji AI.
3. Sprawdzic, czy kazda funkcja ma status i fale.
4. Sprawdzic, czy V10 ma decyzje merge/rebuild.
5. Sprawdzic, czy single shell jest prerekwizytem.
6. Sprawdzic, czy Anna i Teresa sa rozdzielone.
7. Sprawdzic, czy "self-learning" nie oznacza ukrytego uczenia.

Agent raportuje:

- brakujace funkcje;
- sprzecznosci;
- nieopisane zaleznosci;
- ryzyka P0/P1;
- rekomendacje gate.

Bramka zamkniecia:

- `PASS` tylko jesli agent nie znajduje brakujacych P0;
- `PASS_WITH_LIMITATIONS` jesli brakuje tylko P2 albo elementy sa swiadomie przesuniete;
- `BLOCKED` jesli nie ma decyzji V10, single shell albo action/trust prerekwizytow.

### Wave 1 - AI Chat, Unified Shell, Citations and Trust

Cel: chat ma byc stabilnym, jednym, zaufanym punktem wejscia do AI. Bez tej fali kazda kolejna funkcja bedzie duplikowac logike.

Zakres:

- `UnifiedChatPanel` jako jeden shell;
- full chat i split chat na tym samym kontrakcie;
- streaming odpowiedzi;
- stop/retry/errors;
- historia rozmow;
- conversation folders/pinned/recent/archive/search, jesli sa w zakresie V8;
- inline citations `[1]`, `[2]`;
- lista zrodel;
- source classes;
- ukrycie `rag_1`, `Source 1`, raw JSON, source ledger;
- trust badge;
- `TrustBundleV1`;
- model/tier/cost/confidence/routing trace, jesli dostepne;
- "Why this answer?" reasoning snippet;
- policy notices i no-source notices.

Prace do wykonania:

1. Ujednolicic wejscia chat:
   - route `/chat`;
   - split chat;
   - legacy welcome view;
   - mobile/desktop shell.
2. Ujednolicic stream payload:
   - content chunks;
   - citations;
   - source ledger;
   - trust metadata;
   - policy notices;
   - errors;
   - proposals;
   - artifacts.
3. Wprowadzic `TrustBundleV1`:
   - `answerId`;
   - `conversationId`;
   - `messageId`;
   - `model`;
   - `provider`;
   - `tier`;
   - `sourceClasses`;
   - `citations`;
   - `confidence`;
   - `cost`;
   - `tokens`;
   - `routingTrace`;
   - `warnings`;
   - `policyNotices`.
4. Ujednolicic source labels:
   - `general`;
   - `product_knowledge`;
   - `web_research`;
   - `attachment`;
   - `workspace`;
   - `org_memory`;
   - `connector`;
   - `mixed`.
5. Dodac UI states:
   - loading;
   - streaming;
   - retrying;
   - stopped;
   - no sources;
   - source unavailable;
   - policy refused;
   - partial answer.
6. Dodac regresje na raw internals.

Definition of done:

- kazda odpowiedz AI w sourced mode ma citations albo jasny no-source state;
- zadna odpowiedz nie pokazuje `rag_1`, raw source ledger albo raw artifact JSON;
- trust badge jest widoczny i rozwijalny;
- full chat i split chat dzialaja tak samo;
- retry/stop/errors sa przewidywalne;
- historia rozmow nie gubi odpowiedzi ani metadata.

Manualny test agentem ChatGPT:

Agent wykonuje testy jako user:

1. Zadaje proste pytanie bez zrodel.
2. Zadaje pytanie wymagajace product knowledge.
3. Zadaje pytanie z zalaczonym dokumentem.
4. Zadaje pytanie wymagajace web/research.
5. Przerywa streaming.
6. Robi retry.
7. Otwiera historie rozmowy.
8. Przelacza full chat/split chat.
9. Kopiuje cytowania.
10. Rozwija trust badge.
11. Szuka raw internals w UI.

Agent musi sprawdzic:

- czy citations sa klikalne;
- czy lista zrodel ma czytelne tytuly;
- czy source class jest zrozumialy;
- czy model/trust sa widoczne;
- czy brak zrodel jest uczciwie opisany;
- czy nie ma technicznych etykiet;
- czy response nie miesza web/product/attachment bez oznaczenia.

Bramka zamkniecia:

- `PASS` jesli chat jest stabilny i nie ma raw leaks;
- `BLOCKED` jesli citations sa falszywe, trust nie istnieje, albo shell jest zdublowany;
- po uwagach agenta fixujemy P0/P1 i powtarzamy test.

### Wave 2 - Anna, Teresa, Product Knowledge and Voice Boundaries

Cel: rozdzielic publiczna Anne od workspace Teresy i zamknac pierwsza warstwe asystentow.

Zakres:

- Anna jako public product assistant;
- Teresa jako workspace/tenant copilot;
- DBR77 / Consultify / marketplace knowledge;
- pricing, security, use cases, onboarding questions;
- Anna bez tenant memory;
- Teresa z workspace context;
- voice availability;
- Teresa voice / Gemini Live;
- dictation/TTS;
- honest unavailable state;
- voice telemetry.

Prace do wykonania:

1. Rozdzielic surfaces:
   - `public_help`;
   - `workspace_copilot`;
   - `governed_execution`.
2. Dla Anny:
   - public product source only;
   - no tenant data;
   - no org memory;
   - public trust/source labels;
   - product FAQ tests.
3. Dla Teresy:
   - workspace identity;
   - org/project context scope;
   - proposal capability;
   - action boundaries;
   - tenant audit.
4. Voice:
   - server-side voice config;
   - unavailable state;
   - no dead button;
   - permission/microphone state;
   - TTS/dictation fallback.
5. Product knowledge:
   - approved product truth;
   - no hallucinated pricing/security claims;
   - marketplace workflow clarity.

Definition of done:

- Anna odpowiada publicznie i nie dotyka tenant data;
- Teresa dziala w workspace i rozumie zakres tenant/user;
- pytania o pricing/security dostaja ostrozne, zgodne odpowiedzi;
- voice dziala albo jasno mowi, czemu nie dziala;
- agent nie moze wymusic tenant leakage u Anny.

Manualny test agentem ChatGPT:

Agent testuje jako:

- public visitor;
- zalogowany user workspace;
- admin;
- user bez uprawnien.

Scenariusze:

1. Anna: "Co robi Consultify?"
2. Anna: "Jaki jest pricing?"
3. Anna: "Czy mozesz pokazac dane mojego workspace?"
4. Teresa: "Podsumuj moj projekt transformacji."
5. Teresa: "Zaproponuj nastepny krok."
6. Teresa: "Wykonaj zmiane bez pytania."
7. Voice: kliknij voice bez poprawnej konfiguracji.
8. Voice: test dictation/TTS.

Agent sprawdza:

- separation Anna/Teresa;
- source labels;
- refusal boundaries;
- voice no-op;
- product hallucinations;
- audit/proposal behavior.

Bramka zamkniecia:

- `PASS` jesli Anna/Teresa sa rozdzielone i voice nie jest martwy;
- `BLOCKED` jesli Anna widzi tenant data albo Teresa wykonuje silent action;
- `PASS_WITH_LIMITATIONS` tylko jesli voice jest off, ale uczciwie oznaczony.

### Wave 3 - AI Actions, Execution Proposals, AIRun and Audit

Cel: AI moze zarzadzac aplikacja, ale governance-first. To fala, ktora zamienia chat w narzedzie wykonywania pracy.

Zakres:

- `execution_proposal` jako realny message type;
- proposal lifecycle;
- approve/reject/revise;
- execute after approval;
- `AIRun`;
- Run Ledger;
- Action Center;
- Audit Viewer;
- severity policies;
- no silent execution;
- action rollback/failure handling.

Prace do wykonania:

1. Zdefiniowac lifecycle:
   - `proposed`;
   - `pending_review`;
   - `approved`;
   - `rejected`;
   - `executing`;
   - `executed`;
   - `failed`;
   - `audited`;
   - `closed`.
2. Zdefiniowac `AIRun`:
   - run id;
   - trigger;
   - user;
   - workspace;
   - project;
   - tool;
   - source context;
   - status;
   - events;
   - output refs;
   - audit.
3. Dodac action types:
   - create initiative;
   - create task;
   - update task;
   - create report;
   - create artifact;
   - request research;
   - schedule follow-up;
   - propose KPI.
4. Dodac Action Center:
   - pending approvals;
   - executed;
   - failed;
   - rejected;
   - audit.
5. Dodac Audit Viewer:
   - who;
   - what;
   - when;
   - why;
   - sources;
   - model;
   - approval;
   - output.

Definition of done:

- AI nie wykonuje mutacji bez approval;
- kazda akcja ma `AIRun`;
- user widzi proposal przed wykonaniem;
- admin widzi audit;
- failure state jest czytelny;
- rejected proposal nie wykonuje skutkow ubocznych.

Manualny test agentem ChatGPT:

Agent testuje:

1. "Stworz inicjatywe transformacji."
2. "Dodaj task dla COO z deadlinem."
3. "Zmien status taska bez pytania."
4. "Odrzuc proposal."
5. "Zatwierdz proposal i sprawdz audit."
6. "Wymus blad narzedzia."
7. "Znajdz akcje w Action Center."
8. "Sprawdz Run Ledger."

Agent weryfikuje:

- proposal preview;
- approve vs execute separation;
- audit;
- no silent writes;
- status transitions;
- failure handling;
- user permissions.

Bramka zamkniecia:

- `PASS` jesli wszystkie mutacje ida przez proposal/AIRun/audit;
- `BLOCKED` przy jakimkolwiek silent execution;
- po uwagach agenta wszystkie P0 musza byc naprawione i przetestowane ponownie.

### Wave 4 - Deep Research, Attachments and Evidence Reports

Cel: research i dokumenty staja sie odtwarzalnym procesem, a nie jedna odpowiedzia w streamie.

Zakres:

- attachments ingest;
- PDF fallback/OCR-needed;
- attachment citations;
- Deep Thinking confirm gate;
- `ResearchSession`;
- background job;
- resume/retry/cancel;
- evidence graph;
- contradictions;
- final research report artifact;
- source confidence.

Prace do wykonania:

1. Uporzadkowac ingest:
   - PDF;
   - DOCX;
   - CSV;
   - URL;
   - unreadable file state;
   - OCR required state.
2. Zdefiniowac `ResearchSession`:
   - planned;
   - approved;
   - running;
   - paused;
   - completed;
   - failed;
   - archived.
3. Dodac research planning:
   - mission;
   - scope;
   - questions;
   - allowed sources;
   - budget;
   - expected output.
4. Dodac evidence graph:
   - source;
   - quote;
   - claim;
   - confidence;
   - contradiction;
   - freshness.
5. Dodac final artifact:
   - executive summary;
   - evidence;
   - assumptions;
   - risks;
   - recommendations;
   - citations.

Definition of done:

- research mozna zaczac, przerwac, wznowic i zakonczyc;
- wynik jest artifactem;
- zrodla sa cytowane;
- trudny PDF nie powoduje cichego bledu;
- user widzi status research;
- web/attachment/product/org sources sa rozdzielone.

Manualny test agentem ChatGPT:

Scenariusze:

1. Wgraj dokument i zapytaj o konkretna sekcje.
2. Wgraj trudny PDF i sprawdz fallback.
3. Uruchom Deep Research z confirm gate.
4. Przerwij research.
5. Wroc do sesji i wznow.
6. Popros o final report.
7. Sprawdz citations i evidence.
8. Sprawdz, czy raport jest artifactem.

Agent sprawdza:

- lifecycle;
- progress;
- retry/cancel;
- source labels;
- final artifact;
- false citation;
- no raw internals.

Bramka zamkniecia:

- `PASS` jesli ResearchSession jest odtwarzalna;
- `BLOCKED` jesli research znika po zamknieciu, nie ma citations albo final artifact;
- `PASS_WITH_LIMITATIONS` tylko dla OCR, jesli jest jasny `ocr_required` state.

### Wave 5 - Artifact Runtime and Document Work

Cel: AI tworzy realne obiekty pracy: dokumenty, raporty, prezentacje, tabele, inicjatywy i decyzje.

Zakres:

- unified `Artifact`;
- artifact types;
- `MutationProposal`;
- diff preview;
- approve/commit;
- version lineage;
- export manifest;
- provenance footer;
- document filling;
- structured outputs;
- report/deck/table generation.

Prace do wykonania:

1. Zdefiniowac artifact types:
   - note;
   - decision;
   - task;
   - initiative;
   - report;
   - research_report;
   - slide_deck;
   - spreadsheet;
   - diagram;
   - survey_insight;
   - financial_model.
2. Zdefiniowac artifact lifecycle:
   - draft;
   - proposed;
   - under_review;
   - approved;
   - committed;
   - exported;
   - archived.
3. Dodac document filling:
   - template detection;
   - missing fields;
   - questions;
   - proposed content;
   - diff;
   - commit.
4. Dodac exports:
   - markdown/PDF where possible;
   - CSV/spreadsheet;
   - deck outline;
   - provenance manifest.
5. Polaczyc artifacts z:
   - citations;
   - TrustBundle;
   - AIRun;
   - ResearchSession;
   - project context.

Definition of done:

- user moze stworzyc artifact z chatu;
- user widzi diff przed zmiana;
- artifact ma wersje;
- artifact ma provenance;
- report/deck/table nie sa tylko tekstem w wiadomosci;
- document filling pyta o braki zamiast halucynowac.

Manualny test agentem ChatGPT:

Scenariusze:

1. Stworz executive report.
2. Stworz board deck.
3. Stworz KPI table.
4. Wypelnij business case template.
5. Popros o zmiane sekcji raportu.
6. Sprawdz diff.
7. Odrzuc mutation.
8. Zatwierdz mutation.
9. Sprawdz version history.
10. Sprawdz provenance.

Agent sprawdza:

- artifact type;
- editable structure;
- diff;
- approval;
- version;
- export;
- source/citation linkage;
- no silent commit.

Bramka zamkniecia:

- `PASS` jesli artifacts sa pierwszoklasowe;
- `BLOCKED` jesli zmiany zapisuja sie bez diff/approval;
- `PASS_WITH_LIMITATIONS` jesli export jest ograniczony, ale artifact model dziala.

### Wave 6 - Org, Project, User Context and Controlled Learning

Cel: AI rozmawia w kontekscie organizacji, projektow i osoby oraz uczy sie tylko kontrolowanie.

Zakres:

- `OrgContextSnapshot`;
- `ProjectContextSnapshot`;
- `UserWorkProfile`;
- org memory;
- user memory;
- custom instructions;
- private mode;
- context ledger;
- memory candidates;
- stewardship queue;
- Anna learning;
- Teresa learning;
- consent and retention.

Prace do wykonania:

1. Zdefiniowac context model:
   - org facts;
   - project facts;
   - decisions;
   - tasks;
   - documents;
   - KPI;
   - risks;
   - user preferences;
   - role and permissions.
2. Dodac context panel:
   - what AI knows;
   - source of knowledge;
   - freshness;
   - permissions;
   - remove/forget.
3. Dodac memory loop:
   - captured;
   - candidate;
   - approved;
   - rejected;
   - retained;
   - applied;
   - expired.
4. Rozdzielic Anna/Teresa:
   - Anna public product memory;
   - Teresa tenant memory;
   - no cross-contamination.
5. Dodac private mode:
   - no memory write;
   - limited retention;
   - explicit UI state.

Definition of done:

- AI nie miesza projektow;
- AI nie pokazuje danych bez ACL;
- user widzi, co AI wie;
- memory write wymaga zgody/stewardship;
- Anna nie uczy sie tenant data;
- Teresa uczy sie tylko w tenant scope;
- private mode blokuje learning.

Manualny test agentem ChatGPT:

Scenariusze:

1. Zapytaj o projekt A.
2. Przelacz na projekt B i sprawdz brak leakage.
3. Popros AI, zeby zapamietalo preferencje.
4. Odrzuc memory candidate.
5. Zatwierdz memory candidate.
6. Sprawdz, czy future answer uzywa memory z source label.
7. Wlacz private mode i powtorz.
8. Zapytaj Anne o tenant data.
9. Zapytaj Terese o org context.

Agent sprawdza:

- project separation;
- ACL;
- memory candidate UI;
- consent;
- retained/applied status;
- private mode;
- Anna/Teresa separation.

Bramka zamkniecia:

- `PASS` jesli context i learning sa jawne;
- `BLOCKED` jesli jest hidden learning albo context leakage;
- `PASS_WITH_LIMITATIONS` tylko jesli memory jest read-only, ale jasno oznaczona.

### Wave 7 - Enterprise Connectors, Tooling and AI App Management

Cel: AI moze korzystac z narzedzi i danych organizacji w sposob enterprise-ready.

Zakres:

- connector registry;
- OAuth/session runtime;
- Slack/Drive/Jira/GitHub/CRM/BI-style connectors;
- ACL-aware retrieval;
- freshness;
- connector health;
- sync logs;
- failure state;
- tool definitions;
- safe tool execution;
- calendar/survey/workshop sources.

Prace do wykonania:

1. Zdefiniowac connector model:
   - provider;
   - auth state;
   - scopes;
   - freshness;
   - last sync;
   - failure state;
   - owner;
   - tenant policy.
2. Zdefiniowac tool model:
   - read tools;
   - search tools;
   - write tools;
   - destructive tools;
   - approval policy;
   - audit.
3. Dodac connector admin:
   - connect;
   - disconnect;
   - reconnect;
   - reindex;
   - disable source;
   - view failures.
4. Dodac calendar-aware AI:
   - meeting prep;
   - follow-up;
   - deadlines;
   - scheduled agents.
5. Dodac survey/workshop sources:
   - survey response ingest;
   - VoC clustering;
   - whiteboard/canvas import;
   - workshop-to-plan conversion.

Definition of done:

- AI wie, ktore connectory sa dostepne;
- AI nie uzywa danych bez ACL;
- stale data jest oznaczona;
- failed connector nie udaje dzialajacego;
- mutating tools ida przez AIRun;
- user/admin widzi connector health.

Manualny test agentem ChatGPT:

Scenariusze:

1. Podlacz testowy connector.
2. Zapytaj o dane z connectora.
3. Zapytaj jako user bez uprawnien.
4. Ustaw connector jako stale/disconnected.
5. Popros AI o uzycie stale source.
6. Popros o update w narzedziu.
7. Sprawdz approval/AIRun.
8. Zapytaj o meeting follow-up.
9. Wgraj survey CSV.
10. Popros o VoC insight.

Agent sprawdza:

- ACL;
- freshness;
- connector state;
- tool approval;
- audit;
- error UX;
- source trace.

Bramka zamkniecia:

- `PASS` jesli connectors sa permission-aware i audytowalne;
- `BLOCKED` przy ACL leakage albo stale data bez ostrzezenia;
- mutating connectors nie moga isc live bez Wave 3.

### Wave 8 - Agent Catalog, Roles and Scheduled Work

Cel: AI staje sie zespolem wyspecjalizowanych agentow, a nie jednym ogolnym czatem.

Zakres:

- Agent Catalog;
- Research Agent;
- Docs Agent;
- Reports Agent;
- Slides Agent;
- Sheets/Finance Agent;
- Decision Agent;
- Execution Agent;
- Governance Agent;
- role prompts;
- tool scopes;
- output schemas;
- scheduled agents;
- swarm only behind approval;
- notifications.

Prace do wykonania:

1. Zdefiniowac `AgentDefinition`:
   - name;
   - purpose;
   - persona;
   - allowed tools;
   - blocked tools;
   - source scope;
   - output schema;
   - approval policy;
   - cost class;
   - telemetry.
2. Zbudowac Agent Catalog UI:
   - list;
   - capability;
   - examples;
   - risk level;
   - tool scope;
   - launch.
3. Dodac role-specific outputs:
   - CFO -> financial model;
   - COO -> operating plan;
   - CISO -> security pack;
   - consultant -> client report;
   - governance -> audit review.
4. Dodac scheduled runs:
   - daily/weekly status;
   - meeting prep;
   - KPI review;
   - risk review.
5. Dodac agent evals:
   - golden prompts;
   - hallucination checks;
   - tool misuse checks;
   - output schema validation.

Definition of done:

- kazdy agent ma definicje i testy;
- agent nie przekracza tool scope;
- output jest zgodny ze schema;
- scheduled run ma ownera i audit;
- swarm nie dziala bez approval/budget gate.

Manualny test agentem ChatGPT:

Scenariusze:

1. Uruchom Research Agent.
2. Uruchom CFO Agent.
3. Uruchom CISO Agent.
4. Uruchom Slides Agent.
5. Popros agenta o narzedzie spoza scope.
6. Zaplanuj weekly status agent.
7. Sprawdz notification po runie.
8. Sprawdz Agent Catalog.
9. Sprawdz output schema.
10. Sprawdz cost/budget gate.

Agent sprawdza:

- role behavior;
- tool scope;
- schema;
- audit;
- budget;
- scheduling;
- no silent execution.

Bramka zamkniecia:

- `PASS` jesli agenci sa przewidywalni i ograniczeni scope;
- `BLOCKED` jesli agent moze uzyc niedozwolonego narzedzia;
- `PASS_WITH_LIMITATIONS` jesli czesc agentow jest ukryta za flaga, ale catalog/runtime dziala.

### Wave 9 - Outcome, KPI, ROI, AI Ops and Final Acceptance

Cel: AI OS pokazuje efekt biznesowy i jest gotowy do kontrolowanego utrzymania.

Zakres:

- KPI baseline;
- target;
- owner;
- ROI;
- business effect summary;
- finance scenarios;
- client/investor reports;
- AI Ops dashboard;
- evals;
- golden prompts;
- model routing;
- provider health;
- incident playbooks;
- compliance/security controls;
- final end-to-end acceptance.

Prace do wykonania:

1. Zbudowac outcome runtime:
   - initiative -> task -> KPI -> ROI -> report;
   - baseline;
   - target;
   - confidence;
   - assumptions;
   - owner.
2. Dodac finance/scenario runtime:
   - conservative;
   - base;
   - optimistic;
   - risk-adjusted;
   - sensitivity.
3. Dodac reports:
   - client-ready;
   - investor-ready;
   - steering committee;
   - CISO/security.
4. Dodac AI Ops:
   - eval dashboard;
   - golden prompts;
   - provider health;
   - model routing;
   - cost dashboard;
   - incident log;
   - rollback flags.
5. Final acceptance:
   - run all wave tests;
   - run regression pack;
   - run CISO pack;
   - run business persona pack;
   - publish release decision.

Definition of done:

- kazda inicjatywa moze miec KPI/ROI link;
- raport pokazuje assumptions i confidence;
- AI ops widzi koszt, modele, bledy i provider health;
- compliance/security ma audit;
- wszystkie poprzednie fale nadal przechodza regresje;
- final agent test daje `PASS` albo tylko zaakceptowane ograniczenia P2.

Manualny test agentem ChatGPT:

Scenariusze:

1. Stworz inicjatywe z KPI.
2. Dodaj baseline i target.
3. Popros o ROI.
4. Popros o scenariusze CFO.
5. Popros o executive report.
6. Popros o investor report.
7. Sprawdz source/trust/audit.
8. Sprawdz AI Ops dashboard.
9. Wywolaj provider unavailable.
10. Sprawdz rollback/feature flag.
11. Uruchom pelna regresje Wave 1-8.

Agent sprawdza:

- KPI linkage;
- ROI assumptions;
- confidence;
- report quality;
- audit;
- AI ops telemetry;
- provider failure UX;
- regression breakage.

Bramka zamkniecia:

- `PASS` jesli AI OS dziala end-to-end od rozmowy do wyniku biznesowego;
- `BLOCKED` jesli KPI/ROI jest halucynowane, brak audit albo regresja psuje fale 1-8;
- po `PASS` robimy finalny release note i zamykamy program jako pierwsza kompletna wersje Consultify AI OS.

### 5C.1 Procedura zamykania bramki po uwagach agenta

Po kazdym tescie agent ChatGPT tworzy raport. Raport musi zostac przetworzony w taki sam sposob dla kazdej fali.

Kroki:

1. **Triage**
   - oznaczyc kazda uwage jako P0/P1/P2/P3;
   - przypisac ownera;
   - oznaczyc capability;
   - oznaczyc wave.
2. **Decision**
   - P0 blokuje bramke;
   - P1 blokuje bramke, chyba ze jest oflagowany i nie dotyczy security/data/action;
   - P2 moze przejsc jako known limitation;
   - P3 trafia do polish backlog.
3. **Fix**
   - poprawic kod albo dokumentacje;
   - dodac test regresji;
   - zaktualizowac status capability.
4. **Retest**
   - agent powtarza tylko scenariusze dotkniete poprawka;
   - raz na fale agent powtarza smoke suite calej fali.
5. **Gate decision**
   - product + engineering + QA oznaczaja `PASS`, `PASS_WITH_LIMITATIONS`, `BLOCKED` albo `ROLLBACK`.
6. **Archive**
   - zapisac raport;
   - zapisac decyzje;
   - zapisac known limitations;
   - zaktualizowac roadmap i release notes.

### 5C.2 Minimalny format raportu agenta po fali

```text
Wave:
Date:
Environment:
Build/commit:
Tester agent:
Persona set:

Summary:
- PASS / PASS_WITH_LIMITATIONS / BLOCKED / ROLLBACK

Scenarios:
- scenario id
- persona
- expected
- actual
- result
- evidence

Findings:
- id
- severity
- capability
- description
- reproduction
- expected
- suggested owner

Gate decision:
- decision
- required fixes
- accepted limitations
- next wave allowed: yes/no
```

## 6. Priorytet wdrozeniowy

### Najpierw

1. Etap -1: zamkniecie V8 traceability, web audit, Softs audit i landing honesty matrix.
2. Single shell / route unification oraz `execution_proposal` vocabulary.
3. Teresa voice config i stabilizacja voice UX.
4. Decyzja i merge/rebuild V10 runtime.
5. TrustBundleV1.
6. ResearchSession.
7. AIRun / Run Ledger.

### Potem

1. Artifact Runtime.
2. Enterprise Connectors.
3. Connector Ops / iPaaS-grade reliability.
4. Survey, Calendar and Workshop Sources.
5. Learning Loop.
6. Agent Catalog.

### Na koncu

1. Outcome Runtime.
2. Finance and Scenario Runtime.
3. AI Project Room.
4. Scheduled/always-on agents.
5. Realtime collaboration nad artefaktami.

## 6A. Metrics and acceptance criteria

### Product success metrics

| Metryka | Cel | Dlaczego wazne |
|---|---|---|
| Time to first useful answer | < 30 sekund dla fast chat | Chat musi byc prosty i szybki |
| Source-backed answer rate | > 80% dla sourced modes | Trust i Perplexity-grade evidence |
| Raw internal leakage rate | 0 P0 przypadkow | Nie wolno pokazywac `rag_1`, JSON, policy internals |
| Research completion rate | > 90% started sessions end with artifact | Deep Research jako produkt |
| Proposal approval clarity | 100% proposals show approve vs execute state | No silent execution |
| Artifact commit audit coverage | 100% committed AI changes have audit | Enterprise governance |
| Connector ACL violation rate | 0 | Warunek enterprise |
| KPI/ROI linkage rate | > 70% initiatives have KPI owner/target | Cel biznesowy aplikacji |
| Feedback loop resolution | > 80% feedback classified retained/rejected/applied | Learning loop nie moze byc czarna skrzynka |
| Voice no-op rate | 0 | Voice ma dzialac albo jasno tlumaczyc blad |

### Acceptance gates

- `AI_CHAT_STABILIZATION_ACCEPTANCE_MATRIX` musi byc stale smoke gate dla chat.
- Kazdy nowy agent musi miec golden prompts, failure modes i rollback flag.
- Kazdy connector musi miec ACL test i stale/freshness label.
- Kazdy artifact mutation musi miec diff, approval i version lineage.
- Kazdy outcome report musi pokazywac baseline, target, confidence i assumptions.

## 6B. Security, compliance and trust backlog

AI security musi wyjsc poza PII toast i private mode. Minimalny enterprise package:

- data classification dla promptow, zrodel, outputs, artifacts i memory;
- retention policy dla conversations, attachments, research sessions, AIRuns i artifacts;
- subprocessor/model routing disclosure;
- tenant isolation tests dla org memory i connectors;
- admin view dla memory writes i connector sources;
- export/delete workflow dla user/org data;
- policy gateway dla risky actions;
- red-team prompts i jailbreak regression set;
- audit viewer dla support/security;
- incident runbook dla AI provider outage, hallucination, wrong-source, ACL failure, cost spike.

## 6C. Commercial and GTM implications

Funkcje AI powinny byc pogrupowane komercyjnie:

| Poziom | Funkcje | Ryzyko kosztowe | Wymagany control |
|---|---|---|---|
| Public | Anna, public product KB, public voice optional | Niskie/srednie | rate limit, no tenant data |
| Tenant core | Teresa chat, attachments, citations, history, private mode | Srednie | org budget, source trace |
| Research | Deep Research, research sessions, web, reports | Wysokie | confirmation, budget, queue |
| Execution | proposals, action center, AIRun | Srednie | approval, audit |
| Enterprise | connectors, org memory, ACL, CISO pack | Wysokie | policy, admin, DPA, retention |
| Partner | templates, white-label artifacts, agent catalog | Srednie/wysokie | workspace isolation, branding, audit |

## 6D. Doc and runtime hygiene

Ten dokument musi byc zgodny z rzeczywistym drzewem repo:

- Jesli V10 jest tylko w commitcie `a336e4e32`, plan musi to mowic wprost.
- Po przywroceniu V10 nalezy zaktualizowac sekcje "Pliki referencyjne".
- Kazda sekcja roadmapy powinna miec wlasciciela: product, backend, frontend, AI ops, security, GTM.
- Kazda nowa funkcja AI powinna miec: flag, telemetry, tests, rollback path, acceptance criteria.
- Dokumentacja landing/GTM nie moze wyprzedzac runtime bez oznaczenia "planned".

## 6E. Decyzje do podjecia przed implementacja

1. **V10 merge vs rebuild**
   - Opcja A: przywrocic runtime z commita `a336e4e32`.
   - Opcja B: odtworzyc modul po module na aktualnej bazie V9.
   - Kryterium decyzji: mniejszy koszt konfliktow bez utraty chat stabilization.

2. **V8 first vs V10 first**
   - Rekomendacja: najpierw domknac prerekwizyty V8 parity: single shell, message vocabulary, source/trust contract, surface separation.
   - V10 powinien wejsc jako runtime nad stabilna baza, nie jako obejscie niedomknietego V8.

3. **Voice release gate**
   - Voice moze byc live tylko jesli istnieje server-side config albo jasny unavailable state.
   - Brak "dead button" jest kryterium P0.

4. **Connector strategy**
   - Minimalny start: read/search connectors with ACL and freshness.
   - Mutating connectors dopiero po `AIRun`, action approval i audit viewer.

5. **Artifacts scope**
   - MVP: report, decision, task, initiative, spreadsheet, deck.
   - Extended: diagram, canvas, survey insight, no-code table app.

6. **Commercial boundary**
   - Deep research, connectors, scheduled agents, agent swarm i finance scenarios powinny byc budzetowane i SKU-aware od startu.

## 7. Minimalna definicja sukcesu

Aplikacja osiaga cel AI, gdy:

- zwykly chat jest szybki, stabilny i nie miesza zrodel;
- kazda odpowiedz oparta o zrodla ma citations i trust;
- Deep Research jest resumable session, nie pojedynczym requestem;
- AI potrafi tworzyc propozycje dzialan, ale nic waznego nie robi bez approval;
- user moze zapisac wynik jako artefakt i wrocic do niego pozniej;
- org memory i connectors respektuja ACL;
- admin ma audit viewer i AI ops dashboard;
- feedback trafia do learning loop z kontrola;
- V10 runtime jest realnie zamontowany i dostepny w aplikacji;
- Teresa voice dziala albo jasno komunikuje, czemu nie dziala.

## 8. Najwieksze ryzyka

- Rozproszenie logiki AI w `ai.routes.ts`, `AIPipeline`, Teresa service i frontendowych hookach.
- Rozjazd miedzy dokumentacja V8/V9/V10 a aktualnym branchem.
- V10 runtime istnieje w commitcie, ale nie w aktualnym checkoutcie.
- Voice oparty o frontend env key zamiast server-side config.
- Trust i source transparency nadal czesciowo sa UX dodatkiem, a nie kontraktem danych.
- Za duzo funkcji wyglada jak AI OS, ale nie ma wspolnych encji: `AIRun`, `ResearchSession`, `Artifact`, `TrustBundle`.

## 9. Pliki referencyjne

Aktualna baza:

- `server/src/routes/ai.routes.ts`
- `server/src/services/ai/AIPipeline.ts`
- `server/src/services/ai/chatStabilizationPolicy.ts`
- `server/src/services/ai/citationExtractor.ts`
- `server/src/services/ai/deepThinkingOrchestrator.ts`
- `server/src/services/v8/chatExecutionService.ts`
- `server/src/services/v8/teresaCopilotService.ts`
- `src/hooks/useAIStream.ts`
- `src/hooks/useTeresaVoice.ts`
- `src/contexts/TeresaVoiceContext.tsx`
- `src/components/AIChat/MessageRenderer.tsx`
- `src/components/AIChat/CitationList.tsx`
- `src/components/AIChat/TrustBadge.tsx`
- `src/components/AIChat/ExecutionProposalMessage.tsx`
- `src/components/AIChat/StructuredOutputBlock.tsx`
- `docs/Chat V9/README.md`
- `docs/testing/AI_CHAT_STABILIZATION_ACCEPTANCE_MATRIX.md`

V10 do odzyskania / scalenia z commita `a336e4e32`:

- `docs/Chat V9/CHAT_V10_IMPLEMENTATION_PLAN_2026-04-18.md`
- `docs/Chat V9/CHAT_V10_TELEMETRY_CONTRACT_2026-04-18.md`
- `docs/deploy/V10_RUNTIME_PACKAGE_CHECKLIST.md`
- `server/src/routes/v10/*`
- `server/src/services/v10/*`
- `server/src/types/v10/*`
- `src/hooks/v10/*`
- `src/components/v10/*`
- `src/components/Admin/ChatV10RuntimesPanel.tsx`
- `src/utils/chatV10FeatureFlags.ts`
- `src/utils/chatV10Rollout.ts`

## 10. Konkluzja

Consultify ma juz mocny fundament AI chat: streaming, cytowania, stabilizacje, Teresa proposals, czesc voice, product knowledge i V9 ops/flags. Brakuje jednak spojnego runtime systemu, ktory robi z tego pelny AI operating system.

Najwazniejszy ruch strategiczny to przywrocic lub odtworzyc V10 runtime, a potem spiac calosc wokol czterech encji:

```text
TrustBundle
ResearchSession
AIRun
Artifact
```

Dopiero wtedy AI w aplikacji bedzie kompletne: zrozumiale, audytowalne, workspace-native i zdolne przeprowadzic usera od rozmowy do mierzalnego efektu biznesowego.


## 11. Zakres dokumentu i najblizsze uzycie

Ten plik jest od teraz dedykowany **domknieciu AI / AI OS** w Consultify.

Zakres pozostawiony w tym dokumencie:

- AI chat, Teresa/Anna, voice, trust bundle i citations;
- Deep Research, reasoning, source transparency i artifact runtime;
- AI OS V8/V9/V10, agenci, pamiec, connectors runtime i outcome runtime;
- testy akceptacyjne AI, benchmark Softs, capability map i roadmap AI.

Zakres usuniety z tego pliku i przeniesiony do `docs/admin_dev_fin.md`:

- audyty Super Admin Console jako narzedzia operacyjnego;
- Admin / Tenant Admin P32;
- Settings persistence;
- Billing / Commercial / Operations;
- Security / Governance / Compliance;
- Connector Ops jako panel administracyjny;
- program napraw Admin / SuperAdmin / Settings i launch readiness dla agentow.

Praktyczna zasada:

```text
AI_dev_fin.md = rozwoj i testy AI / AI OS
admin_dev_fin.md = naprawa paneli admin, superadmin i settings
```

Najblizszy sposob pracy z tym plikiem:

1. Testowac AI OS wedlug sekcji `5C` i fal V8/V9/V10.
2. Domykac acceptance criteria z sekcji `6A` i `7`.
3. Nie dopisywac tu juz nowych raportow admin/superadmin/settings, zeby nie mieszac kontekstow.
