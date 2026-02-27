# DoD Inventory (V2 + V3) — extracted from SSOT

> Źródło: dokumenty SSOT:
> - V3: `docs/product/V3_IMPLEMENTATION_PROGRAM.md`
> - V2: `docs/plans/V2_TASK_SPECS.md`

## Summary

- **V3 tasks found**: 54 (with DoD: 54, missing DoD: 0)
- **V2 tasks found**: 122 (with DoD: 122, missing DoD: 0)
- **Conflicts detected (heuristic, V2 vs V3 canon)**: 0

## Conflicts removed / to remove

- Brak wykrytych konfliktów wg heurystyk (preview default off / propose→accept / traceability required / single command row).

---

## V3 DoD (per task)

- **tasks_total**: 54
- **tasks_with_DoD**: 54
- **tasks_missing_DoD**: 0

### V3-A01 — [Platform] Traceability enforcement (MyWork → ToolSession → outputs)
- Nie da się utworzyć inicjatywy z MyWork bez utworzenia `ToolSession(MYWORK)` (albo walidacja, albo auto-materializacja).
- Wszystkie outputy mają `source_type + source_id` i UI je pokazuje.
- API ma guardrails (brak “NULL source”).

### V3-A02 — [Platform] Dynamic menu everywhere (hub → openDocuments → detail)
- Nie istnieją “orphan views” które otwierają artefakty poza dynamic tabs (dla modułów w zakresie).
- Z listy można otworzyć N dokumentów (max widocznych + overflow).
- Detail view działa bez resetowania kontekstu czatu i bez resetu filtrów kolekcji po powrocie.

### V3-A03 — [Platform] UI standards compliance sweep (ModuleHub + tables + preview + D/N/C)
- topbar bez duplikacji breadcrumbs/tytułów, kontrolki `h-9`, spójne CTA i view toggle
- tabelaryczne moduły spełniają `App Table Standard`
- preview pane używa `PreviewPaneShell` i ma anatomię (header/body/footer)
- AI context button jest **ikona-only** i “wpada w oczy” (mocniejszy kontrast/akcent), bez konkurowania z Primary CTA
- view-modes mają stałą kolejność ikon (table→kanban→timeline→calendar→matrix→grid)
- detail views: spójny header + tryby D/N/C tam gdzie to kanon

### V3-A04 — [Platform] Route + menu coherence (Tools/Reports/Presentations naming + entry points)
- menu i breadcrumbs mówią prawdę: gdzie jest “generator”, gdzie “biblioteka”
- brak sytuacji, że user trafia do publicznego showcase myśląc, że to panel pracy
- startowe CTA w modułach prowadzą do kanonicznego flow (wizard)

### V3-A05 — [Platform] Demo → Trial funnel (dataset + limits + telemetry)
- Modal demo: login + wybór języka + start → przełączenie na DEMO org z pełnym datasetem.
- Dataset Atelier ToolToys dostępny w 6 językach (UI + content locale).
- Limity DEMO egzekwowane (AI, write); po przekroczeniu AI — degraded mode + CTA.
- Trial = 7 dni; ostrzeżenia T‑7/T‑3; lockdown + CTA po wygaśnięciu.
- Wszystkie eventy telemetryczne wysyłane; SuperAdmin pokazuje listę starts + conversion.

### V3-A06 — [Platform] SuperAdmin: Model Registry (kind/purpose/fallbacks)
- Katalog modeli w SuperAdmin z polami: name, provider, model_id, kind, is_active, health_status, cost_per_1k.
- Assignments edytowalne dla TEXT_LLM, IMAGE_MODEL, BUSINESS_MODEL.
- Feature calls używają purpose → model z registry; fallback chain działa.
- Każda zmiana konfiguracji jest logowana; brak konfiguracji = jawny błąd.

### V3-A07 — [Platform] Preview pane contract rollout (key hubs)
- Wszystkie 5 hubów (Inbox, Decisions, Initiatives, Results, Interview Insights) używają `PreviewPaneShell`.
- Single click = preview, Enter/double-click = full; J/K, Esc działają.
- Parity akcji: preview ma te same quick actions co full view (gdzie dotyczy).
- i18n PL+EN; locked state respektowany.
- Brak "border-l widget" — preview wygląda jak część composite container (rounded, warstwy).

### V3-A08 — [Platform] Video enablement system (micro‑prompts + rekomendacje + kanon UI)
- Modal micro‑video jest spójny z DBR77 visual language i nie ma "D‑mode vibe".
- Pokazuje rekomendacje w tym samym oknie (bez wychodzenia).
- Zapis dismissals działa per user+module.
- Eventy: `help_video_prompt_shown`, `help_video_view_started`, `help_video_view_completed`, `help_video_skipped`, `help_video_dont_show`.

### V3-B01 — [Chat] Chat jako router pracy (mechaniczne transfery do narzędzi)
- `NAVIGATE` otwiera: Tools, Initiatives, Report Builder, Presentations, Results (minimum R0).
- działa “open specific entity in dynamic tabs” (min: initiative, report builder).
- błędy mają UX fallback.

### V3-B02 — [Chat] Ujednolicenie action model (brak martwych typów)
- 0 “martwych” akcji (prompt/types/handler są zgodne)
- każda akcja ma: render w UI, handler, error state, analytics

### V3-C01 — [MyWork] Inbox jako triage center + preview pane contract
- preview pane ma header/body/footer i korzysta ze wspólnego shell’a
- decyzja hover vs click jest jedna w całej aplikacji i opisana w SSOT

### V3-C02 — [MyWork] Conversions (Idea/Notebook) → consistent “Convert to …”
- Wszystkie konwersje prowadzą przez ToolSession (MYWORK) lub istniejącą sesję.
- Output ma poprawne metadane source i UI je pokazuje.

### V3-C03 — [MyWork] MyWork ToolSession materialization (type=MYWORK)
- Każdy convert z MyWork tworzy lub reuse’uje MYWORK ToolSession.
- Source metadane są kompletne (no nulls).

### V3-C04 — [MyWork] Focus redesign (lightweight execution cockpit)
- Focus jest wizualnie i informacyjnie “lekki” (bez środkowego feedu)
- da się dodać task w 1 klik (quick-add) i przerzucić między lane’ami
- preview/full detail działa zgodnie ze standardami (Outlook style + dynamic tabs)

### V3-C05 — [MyWork] Decisions: timeline + remove queue view + preview parity actions
- brak “queue view” w przełączniku view-modes
- timeline działa dla decyzji i ma minimalny kontrakt jak Tasks timeline (zoom, filtry multi, preview)
- preview dla decyzji ma te same quick actions co full view (i te same uprawnienia)

### V3-C06 — [MyWork] Ideas: canvas tools selector + shared core model (no data loss)
- przełączanie narzędzi nie gubi treści (core data zachowane)
- dane specyficzne narzędzia trafiają do `extensions` (namespaced) i nie są tracone
- preferencja narzędzia zapisywana per user/per workspace

### V3-D01 — [Interview] Sufficiency contract (min) + send-back clarity
- Każdy `send-back` ma reason i jest widoczny w UI respondenta.
- Respondent ma listę braków i może je odhaczać.
- `approve` ma minimalny kontrakt jakości (SSOT) i egzekwuje go backend.

### V3-D02 — [Interview] Runtime mode decision (one-question vs task-list) → SSOT alignment
- brak sprzeczności w `INTERVIEW_FORM_ENGINE_V3.md`
- UI mówi prawdę (default i opcjonalny przełącznik jeśli zostaje)
- dokumentacja wskazuje konsekwencje UX (review/approval, evidence/attachments)

### V3-D03 — [Interview] InterviewHub: App Table Standard compliance + Insights preview
- wszystkie 5 tabów InterviewHub spełniają App Table Standard
- brak dodatkowych rzędów między topbarem a tabelą
- Insights mają preview pane zgodny ze standardem (shell + anatomia + interakcje)

### V3-E01 — [Tools] Jeden mental model Tools (Library → Sessions → Outputs → Initiatives)
- user ma jeden punkt “Tools” i nie czuje, że to 2 moduły
- w Tools widać: library + sessions + outputs + initiatives (nawet jeśli outputs jest linkiem/aliasem na początek)

### V3-E02 — [Tools] Outputs w Tools hub: Reports + Presentations + Initiatives (traceability)
- w Tools → Reports widać realne reporty (nie sesje)
- w Tools → Presentations widać realne decki
- klik otwiera artefakt w dynamic menu

### V3-E03 — [Tools] Tool Wizard Standard (non-licensed tools runtime)
- Wspólny wizard shell działa dla min. 1 narzędzia referencyjnego (np. dynamic-swot lub process-automation).
- Kroki Define → Inputs → Work → Review → Finalize → Outputs są egzekwowane.
- Pętla missing→add→re-process działa (checklist + re-process).
- Output (initiative/report/deck) ma traceability i “Open source”.
- AI propose→accept jest egzekwowany w UI.

### V3-E04 — [Tools] One task per consulting tool (spec+assets+help)
- Każdy z 31 tools ma: pełną spec w CONSULTING_TOOLS_TOOL_SPECS_V3 (lub uzupełnioną), Library content w registry, KB article, graphics assumptions, 60s video script.
- Minimum R0/R1: top tools (P0 z audytu) są kompletne; R2: reszta.
- Task jest “done” gdy spec + assets + help są zatwierdzone i wpięte.

### V3-E05 — [Tools] Process Automation tool (hybrid workspace+table wizard)
- Wizard Process Automation działa end-to-end: flowchart → table → classify → measure → optimize → automation → savings → economics.
- Output (initiative batch + report/deck) ma traceability.
- Narzędzie jest używane jako reference implementation dla V3-E03.

### V3-E06 — [Tools] Licensed methodologies parity (SIRI/ADMA)
- SIRI i ADMA mają question sets zdefiniowane w Methodology Pack (parity z DRD).
- Scoring visualization jest spójna (ten sam standard UI).
- Report/deck z assessment ma traceability i “Open source”.
- Methodology Pack dla SIRI i ADMA istnieje (knowledge + runtime).

### V3-E07 — [Tools] Known Tools content completeness audit + fill plan
- Tabela audytu w KNOWN_TOOLS_CONTENT_COMPLETENESS_AUDIT_V3 jest kompletna dla 31 consulting tools.
- Każdy tool ma: Braki (L/KB/GFX/VID), Priorytet, Owner, ETA.
- Plan uzupełnień ma kolejność (P0→P1→P2) i zasadę “content first”.
- Minimum: 6 tools bez wpisu w Known Tools (ambition-decomposer, focus-tradeoff, narrative-engine, smed-planner, dms-builder, inventory-autopilot) mają wpis w planie z ETA.

### V3-F01 — [Initiatives] Template-driven N-mode per InitiativeLevel (mała vs duża)
- quick_win ma maks. ~3–5 sekcji i nie pokazuje ciężkich governance elementów
- transformation ma pełny zestaw sekcji
- completeness działa i blokuje krytyczne przejścia statusu (gate readiness)

### V3-F02 — [Initiatives] Portfolio Analysis (Resources/Feasibility/Logic/Timeline/Completeness)
- każdy sub‑widok ma: summary + issues list + link do inicjatywy
- issues wynikają z danych i checklist, nie “opinii AI”

### V3-G01 — [Execution] Minimal execution surfaces + spójne statusy
- Execution hub istnieje i pokazuje inicjatywy w realizacji
- user może zmienić status i dodać blocker/risk w inicjatywie
- widoki są zgodne z `view-modes-standard.md`

### V3-H01 — [Results] KPI table jako core (agregacja + add + tracking)
- Jest jedna kanoniczna tabela KPI (Results) + możliwość wejścia w szczegół KPI (history).
- KPI z inicjatyw automatycznie pojawiają się w Results i mają mapping do inicjatywy.

### V3-H02 — [Results] ROI plan vs realized (tracking po wdrożeniu)
- ROI ma assumptions (plan) + realized (actual) + widoczne odchylenie per okres.
- Da się pokazać 1 inicjatywę end‑to‑end bez arkuszy.

### V3-H03 — [Results] Operational analysis + ROI analysis jako 2 surfaces
- Operational: trendy KPI + filtry + drill‑down.
- ROI: plan vs realized + lista inicjatyw z odchyleniami + drill‑down.

### V3-I01 — [Finance] Exportuj z Financial Analysis → Report / Presentation (traceable)
- Export tworzy draft output (report/deck) z poprawnym `source_type/source_id` i linkiem “Open source”.
- Output zapisuje metadane (kto/kiedy, template yes/no).

### V3-J01 — [Reports] Ujednolicenie “report surfaces” (user rozumie co jest czym)
- UI ma jednoznaczne nazwy i entry points; user nie myli “management report” z deliverable.
- Breadcrumbs wszędzie pokazują `Reports > Builder` lub `Reports > Management`.

### V3-J02 — [Presentations] Biblioteka decków (hub: table + cards + dynamic menu)
- Biblioteka decków istnieje w 2 view modes (table+cards), ma filtry i open w dynamic menu.
- Deck ma traceability i akcję “Open source”.

### V3-J03 — [Generators] Upload chaos jako 3 ścieżka report/deck (MVP)
- Wizard: Upload → Context → Generate działa dla report i deck.
- Output ma widoczne źródła (upload bundle) i oznaczenie “draft requires review”.
- Target: R2

### V3-K01 — [N‑mode] Required sections/pola per etap + completeness + AI assist
- Dla danego artefaktu i statusu system pokazuje: required items + missing list + completeness score.
- Gate readiness blokuje krytyczne przejścia statusu, jeśli braki są krytyczne.

### V3-M01 — [Integrations] Foundation: org-level providers + Settings UI (no mocks) + sync logs
- Settings pokazuje providerów z `integration_providers` i realne połączenia z `integrations`.
- Każdy sync zapisuje `integration_sync_log`, a UI potrafi go wyświetlić (min. tabela).
- Brak mockowanych list integracji w Settings dla ścieżek objętych tym taskiem.

### V3-M02 — [Integrations] Communication sync: Slack + Teams notifications + channel mappings (projects/gates)
- Minimum 5 eventów idzie do Slack/Teams, ma link do artefaktu i jest audytowane w sync log.
- UI pozwala przypisać kanał do projektu (min. 1 mapping).

### V3-M03 — [Integrations] PM sync (P0): Jira bi-directional tasks + status mapping + webhook inbound
- Create task w Consultify → powstaje issue w Jira + mapping zapisany.
- Zmiana statusu w Jira → zmiana statusu w Consultify (webhook).
- Sync log zawiera wpisy push/pull, a błędy mają retriable marker.

### V3-M04 — [Integrations] Storage exports: Google Drive + OneDrive/SharePoint publish for reports/decks
- Publish report/deck → plik trafia do zewnętrznej chmury + w Consultify jest link + sync log.

### V3-M05 — [Integrations] Calendar sync: Google Calendar + Outlook (due dates + gate reviews)
- Dla wybranych typów eventów powstaje event w Google/Outlook z linkiem do obiektu.
- Eventy są audytowane w sync log.

### V3-M06 — [Integrations] Automation backbone: Zapier/Make API keys + event catalog + rate limits
- API keys mają prefix + hash + limity (per minute/day) + usage tracking.
- Jest lista zdarzeń (triggers) i akcji (actions) dostępnych dla automatyzacji.

### V3-M07 — [Integrations] MCP providers framework: catalog + allowlist + audit + registry discovery
- CRUD MCP providerów (org-level) + test/health.
- Allowlist tooli (min: READ only) + audyt w `mcp_audit_logs`.
- (Opcjonalnie) import metadanych z MCP Registry jako "discovery mode" (R2).

### V3-M08 — [Integrations] MCP‑IRIS: Streamable HTTP provider (FastMCP) + MES client contract (factory context)
- Provider MCP‑IRIS konfigurowalny: `MES_BASE_URL`, token, factory mode.
- Minimum 3 READ tools (np. KPI/time-series + health) działają end-to-end.
- Błędy 4xx/5xx mapowane na spójny kontrakt (retriable / non‑retriable) i logowane w audycie MCP.

### V3-M09 — [Integrations] MCP‑Marketplace (DBR77): catalog search + asset import to Tools/Presentations
- Provider MCP‑Marketplace: connect + search + get asset.
- Import asset → zapis jako template (Tools) lub asset (Presentations).
- Audyt MCP wywołań.

### V3-M10 — [Integrations] Research sources (US/EU): EDGAR + GDELT + registries + patents (ingest+citation)
- Min. 2 "research connectors" działają end-to-end i zapisują evidence z cytowaniem.
- UI (min.) pozwala wywołać "refresh" i zobaczyć ostatni wynik + źródło.

### V3-M11 — [Integrations] Knowledge sources: OpenAlex + Crossref + Semantic Scholar + PubMed + arXiv + DOAJ
- Unified "search" interface w backendzie (adapter pattern) dla min. 2 providerów.
- Każdy wynik ma cytowanie + deduplikację po DOI/arXivId/PMID.

### V3-M12 — [Integrations] Competitive intel APIs: Similarweb + Semrush + BuiltWith + Wappalyzer (enterprise BYOS)
- "Bring your subscription" config w Settings (API keys) + health check.
- Min. 1 provider działa end-to-end i zapisuje time-series evidence.

### V3-M13 — [Integrations] Integrations consolidation: one SSOT layer (org vs user vs sync hub) + deprecations
- W dokumentacji jest jednoznacznie: "gdzie co ustawiamy" (superadmin/admin/user) oraz które endpointy są kanoniczne.
- W UI nie ma miejsc, które sugerują "działające integracje", a są mock/stub.
- Każdy connector ma te same podstawowe przełączniki: connect/disconnect, enabled, test, logs, mappings.

### V3-N01 — [AI] ai_usage_logs v3 contract: cost + error_class + kind + migration (no silent drops)
- Migracja DB: `ai_usage_logs.estimated_cost_usd`, `error_class` (+ indeksy) — bez silent drops.
- Każdy request AI (success/error) logowany z `status`, `purpose`, `kind`, `price_snapshot_id`, `estimated_cost_usd`, `error_class` (gdy błąd).
- Błędne wywołanie AI pojawia się w logach z `status='error'` i `error_class`.
- Sukces ma `kind='TEXT_LLM'` i (jeśli jest snapshot) `estimated_cost_usd` != NULL.

### V3-N02 — [AI] AIPipeline: log error-path to ai_usage_logs (status=error)
- `AIPipeline.logError()` wykonuje insert do `ai_usage_logs` z `status='error'` i `error_message`.
- Error path jest widoczny w telemetrii (brak "cichych" błędów).
- LLMController errorRate liczy prawdziwe błędy (spójność z ai_usage_logs).

### V3-N03 — [AI] Market Inbox: enforce status=approved before apply + audit entry
- `POST /api/llm/market/inbox/:id/apply` zwraca 409 jeśli `status!='approved'` (apply tylko po approve).
- Apply dla `status='applied'` jest idempotentny (success + note).
- Audit entry `MARKET_INBOX_APPLY` jest zapisany (best‑effort minimum).
- Brak możliwości "obejścia" approve — backend egzekwuje status.

### V3-L01 — [V4] MCP IRIS/Marketplace (advanced) w menu jako “Coming soon”
- 2 pozycje w menu + spójny ekran “Coming soon” (bez obietnic v3).

---

## V2 DoD (per task)

- **tasks_total**: 122
- **tasks_with_DoD**: 121
- **tasks_missing_DoD**: 0

### T001 — 🟪 chat — Chat Title Suggestion System
- System generuje tytuł dla nowego czatu i zapisuje go.
- Użytkownik może edytować tytuł w UI.
- Fallback działa, gdy AI niedostępne.

### T002 — 🟪 chat — Project Sidebar Collapse
- Użytkownik może zwinąć/rozwinąć grupy projektów oraz historię chatów.
- Stan jest zapamiętany per user.
- Nie psuje responsywności.

### T003 — 🟪 chat — Cloud Data Integration
- Admin może podłączyć provider.
- User może wybrać dataset i zaimportować do projektu.
- Jest audit log importu + obsługa błędów.

### T004 — 🟪 chat — Deep Thinking Module
- Użytkownik uruchamia Deep Thinking i widzi prawy panel research.
- Generuje się raport w formacie 2–3 stron z sekcją źródeł i ograniczeń.
- Raport da się wyeksportować do Notes/KB.

### T005 — 🟪 chat — Market Research Module
- Użytkownik uruchamia tryb Market Research i widzi prawy panel research.
- Generuje się raport 2–3 strony w standardowym formacie z assumptions/limitations.
- Raport da się wyeksportować do Notes/KB.

### T006 — 🟪 chat — Co‑Thinker Business Mode
- Użytkownik może wybrać jeden z 5 trybów i dostaje odpowiedź w zdefiniowanym formacie.
- Multi‑Consultant pokazuje dialog ról + syntezę + ponumerowane wnioski.
- Każdy tryb kończy się sekcją **Next actions**.

### T007 — 🟡 my work — Individual Tasks (ClickUp-like)
- Użytkownik może tworzyć, edytować i zamykać personal taski.
- Widok listy jest używalny (sort/filter) i wspiera dzienną pracę.
- Taski pojawiają się w kalendarzu/workload (jeśli moduły są włączone).

### T008 — 🟡 my work — External System Synchronization (defer)
- Scope V2 pozostaje jawnie odroczony (defer) i nie blokuje R0/R1.
- Istnieje lista P0 integracji do kolejnego etapu (minimum backlog + minimalny kontrakt integracyjny).
- Dla każdej integracji P0 zdefiniowano: auth model, kierunek sync i ownership danych.

### T009 — 🟡 my work — My Ideas (Private Idea Repository)
- Użytkownik zapisuje ideę z czatu i widzi ją w My Ideas.
- Użytkownik może edytować title/body/tags.
- System potrafi zasugerować ideę w taskach i inicjatywach (2 surface’y).

### T010 — 🟡 my work — Project Calendar
- Użytkownik widzi kalendarz z taskami projektowymi z Consultify.
- Taski bez terminu są dostępne w Backlogu.
- Użytkownik może wejść w task i ustawić/zmienić termin.

### T011 — 🟡 my work — Intelligent Active Notebook (Notion-like)
- Użytkownik może tworzyć i edytować strony w notebooku (Notion-like UX).
- Strony można przypiąć do projektu + wyszukiwać po treści.
- Export z T004/T005 tworzy stronę w notebooku.
- Active Notes pokazuje relewantne strony/idee na tasku i inicjatywie + 1 entrypoint w czacie.

### T012 — 🟡 my work — Contextual Intelligence Feed (Chat-active)
- W czacie istnieje panel/sekcja proaktywnych sygnałów.
- System uczy się preferencji użytkownika (na podstawie interakcji) i dostosowuje częstotliwość.
- Użytkownik ma kontrolę (mute/snooze + settings).
- Da się zapisać sygnał do Notebook lub My Ideas.

### T013 — 🟠 wywiad — Conversational Control Questions (AI interview conductor)
- W sesji wywiadu działa tryb rozmowy z panelem pytań (task-list) i postępem.
- Da się dodać transkrypt (tekst) i zmapować go do odpowiedzi przez `ai-parse`, a następnie zatwierdzić i zapisać do `interview_questions`.
- Da się oznaczać pytania `answered/needs_follow_up` + `confidenceScore`.
- Da się wygenerować `Summary (facts only)` oraz wykonać export kontekstu.

### T014 — 🟠 survey — Modern Survey Experience (N‑mode first, C‑mode later)
- Ankiety/assessment mają spójny, nowoczesny UX (progress + autosave + resume).
- Mobile i a11y nie są „po fakcie” — działają w standardowych scenariuszach.
- 6 języków działa poprawnie (w tym RTL dla `ar`).
- Mierzymy completion + drop-off i widzimy poprawę vs baseline (choćby na kontach demo/seed).

### T015 — 🟢 acquisition — External AI Self‑Assessment Link (public mini‑assessment)
- Istnieje publiczny link do mini‑assessmentu (6 języków, mobile‑ready, RTL dla `ar`).
- Po submit user dostaje AI wynik + CTA.
- Wynik zapisuje się w systemie i da się go zobaczyć w aplikacji jako artefakt N‑mode.

### T016 — 🟠 interview — Advanced Insight Inference Engine (sponsor‑ready, structured)
- Da się uruchomić inference na danych z wywiadów/assessment i dostać structured insighty z evidence+confidence.
- Insight pack jest renderowany w N‑mode i ma workflow review/approve.
- Insighty da się eksportować (Tools/Assessment) i są gotowe jako input pod T017.

### T017 — 🟣 reporting — Sponsor‑Level Analysis Report (N‑mode first, PPTX export)
- Da się wygenerować sponsor‑level raport z danych + approved insights (T016).
- Raport jest przeglądany w N‑mode, ma workflow approve i wersjonowanie sekcji.
- Export PPTX działa i jest „sponsor‑ready”.
- Raport zasila kontekst AI konsultanta (można go przywołać w czacie/inicjatywach jako źródło).

### T018 — 🟦 tools — Known Tools Module (library + education, N‑mode)
- Jest biblioteka Known Tools (lista + detail) w spójnym UI.
- Każde narzędzie ma instrukcję użycia + CTA do rozpoczęcia pracy w projekcie.
- Treści są dostępne dla AI konsultanta jako kontekst referencyjny.

### T019 — 🟦 tools — Development of First 10 Consulting Tools (action‑driven output)
- Jest 10 narzędzi działających jako `tool_sessions` z uzupełnianiem answers + completion/confidence.
- Z sesji można wygenerować batch inicjatyw i widzieć linki do utworzonych inicjatyw.
- Output narzędzi zasila kontekst AI konsultanta i jest wykorzystywany w inicjatywach/raportach.

### T020 — 🟦 tools — Tool‑Linked Knowledge Base (how‑to + best practices + video)
- Dla top 10 narzędzi istnieją artykuły KB „How to use” i są podpięte w UI tool session.
- Copilot chat w tool session potrafi cytować KB i prowadzić usera przez poprawne wypełnianie i interpretację.
- (Jeśli video dostępne) można je otworzyć w modalu i przejść CTA do narzędzia.

### T021 — 🟦 tools — Visual Tool Library Interface (module hub + education-in-moment)
- Istnieje Tools Hub (Table + Grid) z kategoriami, search i preview tool detail.
- Z preview można uruchomić tool session w projekcie.
- KB/video są dostępne „in the moment” i wspierają start narzędzia.

### T022 — 🟦 tools — Development of 10 Operational Improvement Tools (measurable impact)
- 10 operational tools jest dostępnych w Tools Hub, można je wypełnić, zobaczyć results, wygenerować inicjatywy.
- Każdy tool ma KB (T020) i wspiera report/deck (T017).

### T023 — 🟦 tools — Development of 10 Digital Transformation Tools (execution‑ready)
- 10 digital tools dostępnych w Tools Hub; end‑to‑end flow działa i generuje inicjatywy.

### T024 — 🟦 tools — Speed Tool – Process Automation Framework (canonical automation method)
- Tool `process-automation` działa end‑to‑end i generuje inicjatywy + ekonomika w strukturze.

### T025 — 🟢 licensed tools — Rename Module: Assessment → Licensed Tools (UI + i18n + nav)
- W menu i UI moduł jest konsekwentnie nazwany **Licensed Tools**.
- Deep-linki `/assessment/...` działają jak wcześniej.
- Jeśli dodamy `/licensed-tools`, działa i nie dubluje logiki (redirect).

### T026 — 🟢 licensed tools — Finalize SIRI and ADMA Tools (Content + UI parity z DRD)
- SIRI i ADMA są w Licensed Tools jako `available`.
- ADMA ma pełne, analogiczne do DRD: grafika, sposób odpowiedzi, podsumowania i end‑to‑end output.
- Po `approved` można generować raporty i inicjatywy, a wyniki są użyteczne jako input do dalszej pracy.

### T027 — 🟣 reporting — Report and Presentation Templates for DRD, SIRI, and ADMA (executive‑ready, auto‑populated)
- Dla DRD/SIRI/ADMA: z `APPROVED` assessmentu generuje się raport i deck.
- Output jest executive‑ready (spójny layout, język, sekcje) i ma closure.
- Eksport PPTX działa i jest powtarzalny (bez ręcznego formatowania po eksporcie).

### T028 — 🟢 licensed tools — Lean 4.0 Audit and Implementation Framework (DBR77: Pomierz → Zoptymalizuj → Automatyzuj)
- Narzędzie pozwala pracować jak audytor/trener/ekspert Lean i prowadzi przez audit.
- Generuje roadmapę transformacji.
- Roadmapa materializuje się w inicjatywach/planie wykonania.
- Output jest executive‑ready i domyka pracę (closure + next steps).

### T029 — 🟢 licensed tools — Mobile Application for Lean 4.0 Data Collection (floor-only capture)
- Mobilka pozwala zebrać dane na hali i zsynchronizować do LEAN assessmentu.
- Zebrane evidence (zdjęcia/voice/metryki/wastes) jest widoczne w web/desktop i użyteczne w audycie oraz raporcie/roadmapie.

### T030 — 🟢 licensed tools — External PDF Import and Mapping (third‑party assessments → internal models)
- PDF da się zaimportować i uzyskać ustrukturyzowane dane z confidence.
- System pokazuje mapowanie i pozwala skorygować błędy, a wynik jest zapisany i użyteczny dalej (insighty/raport).

### T031 — 🟢 licensed tools — Integration of Additional Paid Assessments (scalable integration format)
- Istnieje opisany i działający integration format + checklista.
- Można dodać nowy framework z minimalnymi zmianami w core.
- Entitlements działają end‑to‑end (UI + API) i blokują dostęp, jeśli brak licencji.

### T032 — 🟢 initiative — AI Support for Initiative, Task, and Decision Authoring (fields + whole cards)
- Field AI działa dla inicjatyw, tasków i decyzji (Generate/Improve/Shorten/Expand/Formal) z preview + apply + undo.
- Whole‑card generation generuje draft zgodny ze standardem i daje selective apply.
- Output jest spójny z szablonami i standardami platformy.

### T033 — 🟢 initiative — AI Readiness and Stage‑Gate Validation for Initiatives (governance copilot)
- System potrafi wskazać „czego brakuje” i co zrobić, by przejść dalej, dla co najmniej 3 kluczowych gate’ów (review → planning → approval) + faza Tools/Assessment submit.
- Wynik jest czytelny i zintegrowany z UI inicjatywy.

### T034 — 🟢 initiative — AI Correlation and Optimization Across Initiatives (portfolio coherence)
- System wskazuje minimum kilka typów korelacji/redundancji i konfliktów na selekcji inicjatyw.
- Sugestie są wyjaśnialne (dlaczego tak) i użytkownik może je zaakceptować lub odrzucić.

### T035 — 🟢 initiative — Cross‑Initiative Time Optimization Engine (sequence + bottlenecks + scenarios)
- System identyfikuje bottlenecki i proponuje alternatywne sekwencje jako scenariusze.
- Użytkownik widzi „co się zmienia” i może zastosować wybrany scenariusz.

### T036 — 🟢 initiative — AI Workload Forecasting and Intelligent Task Allocation (capacity → assignment suggestions)
- System pokazuje forecast obciążenia i identyfikuje przeciążenia/ryzyka.
- AI rekomenduje alokacje, a użytkownik rozumie podstawę rekomendacji.
- Da się zastosować wybrane sugestie (reassign) z audit log.

### T037 — 🟢 initiative — Non‑Human Resource Allocation for Parallel Initiatives (budget/tools/infra/vendors)
- System potrafi planować zasoby nieludzkie i wykrywa konflikty przy równoległych inicjatywach.
- Proponuje korekty (konsolidacja zakupów / przesunięcie / task/decision) i pokazuje uzasadnienie.

### T038 — 🟢 initiative — Scenario‑Based Timeline and Budget Optimization (trade‑offs: time vs spend)
- System generuje min. 2–3 sensowne scenariusze oparte o constraints (czas/budżet) i pokazuje różnice.
- Użytkownik może wybrać i zastosować scenariusz jako plan (z audit log).

### T039 — 🟡 execution — Timeline Management (Execution Module) (operational control layer)
- Timeline pokazuje zależności i postęp; da się aktualizować statusy i planowane daty (z uprawnieniami).
- Widok jest używalny dla portfela (filtry, focus) i nie gubi czytelności.

### T040 — 🟡 execution — Risk Signaling and Mitigation Management (RAID + proactive alerts)
- Ryzyka są wykrywane i prezentowane w kontekście inicjatyw (RAID + execution views).
- System proponuje realistyczne działania mitigujące i pozwala je śledzić.
- Alerty działają i są throttled (brak spamu).

### T041 — 🟡 execution — Delay Detection and Schedule Control (plan vs actual, deviations → alerts)
- System wykrywa odchylenia i generuje alerty zgodnie z progami.
- Użytkownik widzi listę opóźnień + kontekst (inicjatywa/task, zależności).

### T042 — 🟡 execution — Budget Planning and Financial Control (AI‑supported, assumptions vs actual)
- Budżet jest planowany i porównywalny z wykonaniem (per inicjatywa/projekt/org).
- System sygnalizuje overspending risk i proponuje działania (np. przesunięcia, resekwencja).

### T043 — 🟡 execution — Human Resource Management and Capability Alignment (kompetencje → wymagania → assignment)
- System pokazuje dopasowanie kompetencji do zadań i wspiera assignment.
- Widoczne luki kompetencyjne i rekomendacje ich domknięcia.

### T044 — 🟡 execution — Change Emotion and Sentiment Management (privacy‑first, odporność na bias)
- System pokazuje wskaźniki/alerty sentimentu i sugeruje reakcje.
- Zgodność z prywatnością i zasadami organizacji (anonimizacja + role).

### T045 — 🟡 execution — Stakeholder Communication and Change Communication Management (cadence + segmenty + log)
- Dla inicjatyw można zdefiniować plan komunikacji i go egzekwować (cadence + log).
- System wspiera spójność treści i terminy (reminders/alerts).

### T046 — 🟡 execution — Initiative ROI Tracking and Validation (assumptions → tracking → realized vs projected)
- ROI jest policzalne na bazie założeń i widoczne w czasie.
- System pokazuje różnicę między planem a wynikiem (jeśli dane dostępne).

### T047 — 🟡 execution — Initiative‑to‑KPI Mapping and Performance Tracking (KPI ↔ initiatives, time series)
- Inicjatywy mają przypisane KPI i widoczny tracking.
- UI pozwala przejść od KPI do listy inicjatyw i odwrotnie.

### T048 — 🟠 benefits — KPI Impact Attribution Analysis (contribution estimate + uncertainty, sponsor‑grade)
- System potrafi wygenerować estymację atrybucji (contribution) i wyjaśnić założenia.
- Wyniki da się użyć w raportach sponsor-level (T027) i w ROI tracking (T046).

### T049 — 🟠 benefits — KPI to Financial Statement Mapping (KPI ↔ BS/P&L/CF, transparent & editable)
- KPI można powiązać z pozycjami finansowymi i zobaczyć relacje/impact.
- Mapowanie jest transparentne i edytowalne (z audit trail).

### T050 — 🟣 finance — Automated Financial Statement Ingestion and Standardization (PDF → BS/P&L/CF model)
- PDF można zaimportować i uzyskać ustrukturyzowane dane w modelu (BS/P&L/CF).
- Użytkownik może zmapować/naprawić linie i zapisać wynik z walidacją i confidence.

### T051 — 🟣 finance — Comprehensive Financial Ratio Analysis (liquidity/profitability/leverage/efficiency/growth + benchmarks)
- Wskaźniki są policzone i prezentowane w czytelny sposób (kategorie + trend + definicje).
- Benchmarking działa na uzgodnionym źródle danych lub ręcznym input.

### T052 — 🟣 finance — Full Financial Analysis and Interpretation (vertical/horizontal/historical/industry + AI insights)
- System tworzy interpretację na bazie danych finansowych i porównań.
- Output da się użyć w raportach/presentations (T027) i tworzeniu inicjatyw.

### T053 — 🟣 finance — Fundamental Budgeting (driver‑based projections from statements + KPI, sponsor‑ready)
- Da się stworzyć budżet na bazie modelu finansowego i KPI.
- Wynik jest spójny i nadaje się do raportu/presentacji (T027) oraz ma workflow approve.

### T054 — 🟣 finance — Financial Modeling of Initiatives (fully-connected P&L + Balance Sheet + Cash Flow, economic events)
- Model generuje prognozy P&L/BS/CF na horyzont.
- Dla każdego okresu przechodzą walidacje:
- **Assets = Liabilities + Equity**,
- **ΔCash = OCF + ICF + FCF**,
- spójne tie‑outs kapitału (retained earnings / equity events).
- Wynik jest eksportowalny do raportu/presentacji i gotowy do użycia w decyzjach.

### T055 — 🟣 finance — Enterprise Valuation Module (professional DCF + comps, sponsor/VC‑deck grade)
- Użytkownik przechodzi guided flow i dostaje wynik DCF + comps + sensitivity.
- Wycena ma workflow i wersjonowanie (APPROVED snapshot) + audit log.
- Output jest **VC/sponsor‑deck grade** (czytelne slajdy + assumptions + sensitivity + disclaimers).
- Jakość obliczeń:
- walidacje wejść (np. \(g < WACC\)) działają,
- na referencyjnym workbooku Excel (Twoim) wynik DCF (EV) jest zgodny w granicy tolerancji (np. ≤ 1% różnicy) dla zestawu testowych założeń (TBD).

### T056 — 🟣 finance — Valuation Improvement Advisory Module (compliant “how to improve valuation”, action‑to‑initiative)
- System generuje listę działań wraz z uzasadnieniem i priorytetem.
- Rekomendacje są compliant (disclaimers + brak regulowanych porad) i konwertowalne do inicjatyw.

### T057 — 🟣 finance — Valuation Negotiation Argument Builder (pro/contra, objections & rebuttals, deck‑ready)
- System generuje argumenty w dwóch kierunkach na bazie założeń i danych.
- Output jest gotowy do użycia w decku/briefie (z disclaimers).

### T058 — 🟣 finance — Presentation Generator (Gamma.app‑level quality, BCG‑grade PPTX, platform artifacts → deck)
- Użytkownik wybiera źródła i generuje deck w spójnym stylu (outline + key messages).
- Rendering przez pipeline daje poprawny PPTX (otwieralny w PowerPoint) z poprawnym brandingiem i konfidentialnością.
- Eksport jest gotowy do użycia **bez ręcznego “naprawiania” slajdów**:
- brak overflow / overlapped elements,
- brak “tiny fonts” poniżej ustalonego minimum,
- deck ma spójną hierarchię typografii i grid.
- Quality gates:
- RulesEngine blokuje generację, jeśli slajdy naruszają krytyczne zasady jakości (np. overflow),
- generator potrafi auto-split treści na dodatkowe slajdy zamiast łamać layout.

### T059 — 🟣 reports — Business Presentation Templates (brand kits + preset deck types + intent library)
- Istnieje system templates (3–5 preset deck types) + brand kit per org.
- Użytkownik może wybrać template i wygenerować deck/raport w spójnym stylu.
- Template preview + quality gates wykrywają i blokują krytyczne naruszenia jakości.

### T060 — 🟣 reports — Structured Report Generator (block builder, pro formatting, export‑ready, “first on market”)
- Użytkownik generuje raport z wybranych sekcji/bloków, raport ma spójną strukturę (chapters + kolejność + preset).
- Użytkownik może iteracyjnie generować/regenrować sekcje i zrobić review z komentarzami i wersjami.
- Eksport PDF/DOCX działa i jest **akceptowalny jako deliverable** (bez ręcznego “składania”).
- Raport może prezentować treści z całej aplikacji (linked blocks) w sposób spójny i udokumentowany (source tags).
- Agent mode potrafi zmienić strukturę/ustawienia raportu na podstawie rozmowy i utrzymuje audyt/wersje.

### T061 — 🟣 reports — Standardized Business Report Templates (business-grade library, use-case presets)
- Użytkownik wybiera template i raport generuje się w spójnej strukturze.
- Template’y są business-grade i gotowe do eksportu (PDF/DOCX) bez naprawy układu.

### T062 — 🟣 reports — Automated Recurring and Event‑Triggered Reporting (time‑based + triggers → report/deck + send)
- Można skonfigurować schedule time‑based oraz trigger‑based.
- System generuje raport lub prezentację z template i dostarcza do odbiorców (in‑app + email) z historią wykonań.
- Throttling działa (brak spamu), a “reason” triggera jest widoczny.

### T063 — 🔵 organization — Organization Module – UX and Visual Redesign (premium IA + visual consistency + conversion-ready)
- Użytkownik ma jedno spójne miejsce “Organization”, z klarowną nawigacją i spójnym wyglądem.
- Najważniejsze ścieżki (Members, Billing/Tokens, Limits, Domains, Branding/Regional + Context) są premium, czytelne i zgodne z UI standards.
- PL+EN pokryte w tych ekranach (bez hardcoded copy).

### T064 — 🔵 organization — Relocation of Megatrend Analysis (canonical: Tools → Strategy, zero feature loss)
- Megatrends są dostępne w Tools → Strategy (kanonicznie) bez utraty funkcji.
- Stare linki działają (redirect lub moved banner) i nie ma dead-endów.
- Nie ma duplikacji logiki: jeden workspace/component.

### T065 — 🟢 team — Change Team Management – Competency Identification (taxonomy + requirements → initiatives)
- Da się zdefiniować katalog kompetencji (kategorie + kompetencje + poziomy) w org.
- Da się powiązać kompetencje jako requirements na inicjatywach.
- Te same dane są gotowe do wykorzystania w T043/T066/T067 (jeden model).

### T066 — 🟢 team — Skills Gap Analysis Module (requirements → availability → gaps → actions)
- System pokazuje gaps w kontekście inicjatyw i umożliwia przejście do działań (task/initiative).
- Wyniki są transparentne (skąd supply/demand) i pokazują “unknown coverage”.

### T067 — 🟢 team — CV‑Based Role and Task Matching Engine (privacy‑safe CV ingestion → competency mapping → explainable ranking)
- Można wgrać CV, system wyciąga treść i mapuje kompetencje do T065.
- Można zobaczyć ranking dopasowania do initiative requirements z uzasadnieniem i zastosować (po zatwierdzeniu).
- Privacy/guardrails działają: brak automatycznych decyzji, brak inferencji cech chronionych, audit dostępów.

### T068 — 🟢 onboarding — Onboarding and Platform Introduction System (Help Module) (“first 30 minutes” path)
- Help ma sekcję onboarding, łatwo dostępną.
- Użytkownik ma ścieżkę “First 30 minutes” z checklistą i zapisem postępu.

### T069 — 🟢 onboarding — Automated Feature News and Update Communication System (release notes → in‑app + email)
- Można opublikować update i dotrze do użytkowników in‑app i/lub email.
- Historia update’ów jest dostępna i można oznaczać jako przeczytane.

### T070 — 🟡 help — Rewrite Platform Overview Content (Help + Website + Landing Page) (“AI transformation system” narrative)
- Treść jest spójna, premium i opisuje realne capability platformy.
- Da się ją wkleić w 3 kanały bez zmiany sensu i bez sprzeczności.

### T071 — 🟡 help — Connect Help Documentation to AI Context Engine (docs‑grounded answers + citations + update workflow)
- AI odpowiadając o produkcie potrafi odwołać się do KB i cytować.
- Jeśli docs nie pokrywają pytania, AI komunikuje brak coverage zamiast zgadywać.
- Mamy proces aktualizacji docs (kto, jak, kiedy).

### T072 — 🟡 help — Context‑Sensitive Help Navigation (module → docs mapping + deep links)
- Będąc w module X, Help otwiera rekomendowaną dokumentację X.
- Jeśli mapowania brak, user dostaje sensowny fallback (search/getting started).

### T073 — 🟡 help — Contextual Micro‑Video Help System (30–45s micro-learning on first entry)
- System potrafi pokazać micro-video przy pierwszym wejściu do modułu i zapamiętać stan “seen”.

### T074 — 🟠 education — Education Module – Platform Fundamentals Series (short, contextual learning library)
- Fundamentals series jest dostępna w aplikacji (Education entrypoint) i w KB, z kontekstowymi linkami.
- Co najmniej 5 materiałów (PL+EN) ma tracking progress.

### T075 — 🟠 education — Education Module – Change Management Foundations (methodology + best practices embedded in platform flow)
- Track Change Foundations jest dostępny w Education/KB, ma 6–10 modułów PL+EN, z deep linkami do platformy.
- Użytkownik widzi progress i może kontynuować.

### T076 — 🟠 education — Education Module – Prompt Engineering and Advanced AI Usage (recipes for better outputs in Consultify)
- Materiały Prompt Engineering są dostępne (PL+EN) i zawierają platform-specific recipes.
- Użytkownik potrafi znaleźć “jak lepiej pracować z AI” bez supportu, a treści są spójne z realnymi modułami.

### T077 — 🟠 education — Knowledge Module – Core Consulting Tools Library (single source: purpose → how to use → outcomes → start)
- Biblioteka narzędzi jest przeszukiwalna, spójna i dostępna w platformie.
- Każde core narzędzie ma kartę “purpose/how/outcomes” + CTA “Start tool”.

### T078 — 🟠 education — Knowledge Module – Licensed Assessment Tools Library (DRD/SIRI/ADMA: methodology + trust + integration)
- Każdy framework licencjonowany ma komplet “why/how/what you get” + interpretację scoringu + evidence standards.
- Treści są dostępne kontekstowo w assessment flow i zgodne z realnym UI.
- Gating licencyjny działa (brak ekspozycji nieuprawnionej).

### T079 — 🟠 education — Education Module – Managing Initiatives in Transformation (lifecycle + governance + execution discipline)
- Track “Managing Initiatives” jest dostępny (PL+EN), spójny z realnym flow i ma kontekstowe linki z Initiatives/Execution.
- Użytkownik rozumie statusy, gates i best practices oraz potrafi zastosować je w platformie.

### T080 — 🟠 education — Education Module – Financial Analysis and Modeling (read outputs + assumptions correctly, sponsor‑grade)
- Materiały Finance są dostępne w Education i kontekstowo w Finance.
- Użytkownik rozumie jak czytać outputs i assumptions, a treści mają disclaimers.

### T081 — 🟠 education — Education Module – Budgeting and Financial Planning (fundamental budgeting + forecasting assumptions discipline)
- Materiały “Budgeting & Planning” są dostępne w Education i/lub kontekstowo w Finance/Budgeting.
- Treść jest spójna z T053 i uczy dyscypliny assumptions/scenarios.

### T082 — 🟠 education — Education Module – ROI Analysis and Investment Evaluation (ROI literacy + decision discipline, grounded in platform)
- Materiały ROI są dostępne i odnoszą się do realnych ekranów/flow w platformie.
- Użytkownik rozumie assumptions i interpretację wyników oraz różnice ROI/NPV/IRR/payback.

### T083 — 🟠 education — Education Module – KPI System Design and Performance Architecture (cause→effect + KPI↔initiatives↔finance)
- Materiały wyjaśniają jak budować KPI system i jak to robić w platformie (T047/T049).
- Są przykłady i checklisty, a treści nie obiecują integracji danych jeśli jej nie ma.

### T084 — 🟠 education — Education Module – Building Presentations in the Platform (T058/T059 walkthroughs, Gamma‑style)
- Materiały prowadzą przez typowy proces generowania decka w platformie.
- Treści są spójne z UI i aktualnymi funkcjami T058/T059.

### T085 — 🟠 education — Education Module – Report Template Design and Usage (T060/T061: sponsor‑ready reports, step‑by‑step)
- Materiały są dostępne i powiązane z UI generatora raportów.
- Użytkownik potrafi wygenerować raport “sponsor‑ready” z template’ów i wyeksportować.

### T086 — 🔵 admin — Build Unified Sync Hub for External Work Systems (integrations command center)
- Jest jedno miejsce “Integrations Hub” z realnymi danymi: connected apps + webhooks + sync health.
- Admin może: connect, reauth, pause/resume, run now, disconnect.
- System przechowuje i pokazuje statusy + historię runów + audyt.
- Nie ma żadnych “fake” integracji w UI: jeśli coś nie działa, jest oznaczone jako coming soon/disabled i nie udaje aktywnej funkcji.
- Co najmniej 1 integracja per kluczowa kategoria (comms/calendar/PMO/cloud/email) działa end‑to‑end w V2 środowisku.

### T087 — 🩷 demo — Create Demo Company Story – Archilex (narrative backbone for demo)
- Dokument story istnieje i jest spójny (brak sprzeczności między problemami→celami→KPI→inicjatywami).
- Scenariusze demo są wykonalne w produkcie (bez “obietnic” feature’ów, których nie ma).

### T088 — 🩷 demo — Develop Demo Website for Archilex Transformation (case context page)
- Strona jest dostępna i wspiera scenariusze prezentacji (da się na niej “ustawić kontekst” w 2–3 min).
- Nie ma sprzeczności z datasetem demo i zachowaniem aplikacji.

### T089 — 🩷 demo — Build Comprehensive Demo Dataset – Archilex (realistic, deterministic, 0 dead ends)
- Dataset pozwala przejść przez główne demo ścieżki bez pustych widoków:
- tools/assessment → initiatives → execution → benefits/ROI → report/deck.
- Seed jest idempotent (można uruchomić wielokrotnie bez dublowania).
- Jest check/verify mode, który raportuje brakujące elementy datasetu.

### T090 — 🩷 demo — Design Demo-to-Trial Conversion Flow (demo → sign-up → trial activation, measurable)
- Użytkownik ma jasną ścieżkę demo → trial i może aktywować trial.
- Flow jest mierzalny eventami i da się policzyć demo→trial conversion.

### T091 — 🟣 trial — Define Technical Trial Architecture and Access Rules (entitlements + quotas + honest gating)
- Trial ma zdefiniowane limity i jest egzekwowany technicznie (API-first).
- Użytkownik rozumie zasady (jasne komunikaty) i nie trafia na “mystery blocks”.
- Trial warnings i expiry processing działają (cron + notifications).

### T092 — 🟣 trial — Design Trial-to-Paid Conversion Path (upgrade mechanics + messaging + smooth checkout)
- Trial user ma spójną, powtarzalną ścieżkę upgrade (z każdego głównego triggera).
- Checkout jest “smooth” i po sukcesie natychmiast odblokowuje dostęp (policy snapshot + gating się aktualizuje).
- Lejek trial→paid jest mierzalny end‑to‑end.

### T093 — 🟢 landing — Legal Agreements Update and User Acceptance Flow Optimization (versioning + acceptances + low friction)
- Legal docs są publikowane i pobierane z jednego API, a akceptacje działają end‑to‑end.
- `pending`/`accept`/`my-acceptances` nie zwracają 503 w standardowym środowisku.
- Użytkownik rozumie “co akceptuje” i nie ma “mystery blocks”.

### T094 — 🟢 landing — Documentation Section – Landing Page Structure & Content (trust, clarity, deep links)
- Sekcja “Documentation” jest na landing i ma działające linki do `/docs/*` i `/legal`.
- Copy jest spójne i zrozumiałe (PL+EN).
- Emitowane są eventy dla kliknięć (minimum).
- Brak “dead ends” (404/route mismatch) dla wszystkich CTA.

### T095 — 🟢 landing — Full Website Content Replacement & Visual Update (market story + screenshots + brand consistency)
- Public pages mają spójny przekaz i brand (jedna nazwa produktu w całym WWW).
- Screeny/visuale są aktualne i pokazują realne moduły V2 (brak “placeholder”).
- Wszystkie public linki działają (brak 404 / dead ends).
- Core content jest dostępny w 6 językach (RTL działa dla `ar`).

### T096 — 🟢 partners — Partner Program Toolkit & Promotional Materials (downloadable pack + always current)
- Partner może wejść w “Resources” i pobrać komplet toolkitu (PL+EN).
- Każdy download jest realny (plik się ściąga), ma wersję i jest zgodny z V2 messagingiem.
- Materiały są podzielone na kategorie i gotowe do użycia w sprzedaży/onboardingu.

### T097 — 🟢 partners — Partner Sales Certification & Incentive Training System (academy + exams + commission unlock)
- Partner ma pełny flow: learning path → egzamin → certyfikat → benefit (prowizyjny) widoczny i egzekwowany.
- Superadmin może zarządzić tier/rates oraz cofnąć cert w razie potrzeby.
- EN+PL content baseline dostępny i spójny z claimami produktu.

### T098 — 🟢 partners — Automated Partner Outreach Campaign (compliant sequences + tracking + scaling BD)
- BD/SuperAdmin może: zaimportować leady, stworzyć kampanię 3‑krokową (PL/EN), uruchomić ją i zobaczyć metryki.
- Każdy mail ma unsubscribe i po opt‑out nie ma dalszych wysyłek.
- Kliknięcia są trackowane, a CTA prowadzą do poprawnych publicznych ścieżek (Become Partner → register).

### T099 — ⚫ ui/ux — Implement Alternative “C‑Type” Table View (ClickUp‑Style Layout) (N‑first system + optional C for speed)
- Użytkownik może przełączyć N/C w tabelach objętych rolloutem (MyWork + 1 module hub) bez utraty funkcji.
- Widoki są spójne z kanonicznym standardem UI (Tech Sexy + App Table Standard + presentation modes).
- Preferencja użytkownika jest zapamiętana i działa po odświeżeniu.

### T100 — ⚫ ui/ux — Mobile Application Interface Design (mobile‑ready web + field capture UX, premium)
- Kluczowe trasy publiczne i core app views działają poprawnie na mobile (iOS Safari + Chrome Android) bez połamanych layoutów.
- Bottom nav działa i jest spójny (safe area, touch targets, a11y).
- Field capture UX jest zaprojektowany i gotowy do wdrożenia etapami (nie tylko “responsive shrink”).
- RTL (`ar`) nie psuje nawigacji i podstawowych layoutów.

### T101 — ⚫ ui/ux — Icon System Standardization & Design Library (one icon language across the whole app)
- Jest 1 kanoniczny wrapper ikon + 1 kanoniczna mapa ikon.
- Sidebar, top bary, module hubs i główne ekrany używają tokenów ikon (rozmiar/stroke) i trzymają “text‑color”.
- Brak kolorowych ikon w nawigacji (poza aktywnym itemem) i brak mieszania stylów.

### T102 — ⚫ ui/ux — Finalize Sidebar Design System (Buttons, Backgrounds & Expand Behavior) (ClickUp/Notion/Outlook-grade)
- Sidebar jest spójny wizualnie i behawioralnie na desktop/tablet/mobile (drawer + bottom nav).
- Expand/collapse jest przewidywalne, persisted i nie psuje nawigacji ani submenus.
- Ikony i stany hover/active/disabled spełniają Tech Sexy + T101.
- Brak regresji a11y (keyboard nav, focus, tooltips/aria).

### T103 — ⚫ ui/ux — Typography Optimization for Light & Dark Mode (Premium Standard) (readability = enterprise)
- Najważniejsze ekrany mają spójną hierarchię i “quiet luxury” readability w light/dark.
- Nie ma masowych `font-bold` w headingach (poza edge cases: ceny/critical).
- Kontrast spełnia WCAG AA dla podstawowych tekstów.

### T104 — ⚫ ui/ux — GPT‑Level Chat UI/UX for DBR77 Chat Interface (minimal noise, maximum clarity)
- Chat wygląda i działa premium w split i full, light i dark, desktop i mobile.
- Akcje są intuicyjne i nie wymagają “szukania”.
- Tool calls, artifacts i streaming nie psują czytelności.

### T105 — ⚫ ui/ux — Chat Navigation & Button Design Refinement (add 3rd “Business” button + clear hierarchy)
- W headerze czatu istnieje 3-ci przycisk “Business/Actions” z poprawną hierarchią i a11y.
- Przycisk otwiera Action Center i działa spójnie w split/full/mobile.
- UI przycisków i nawigacji czatu jest spójne z Tech Sexy + T101.

### T106 — 🩷 feedback — Advanced User Feedback System (Full Feedback Flow) (100% traceability, triage, learning)
- Użytkownik może wysłać bug/idea/pulse/feature request z kontekstem i dostać potwierdzenie.
- Admin/SuperAdmin widzi listę + detail i może zmienić status oraz odpisać.
- AI analysis (jeśli włączone) generuje insights/trending i zapisuje do DB.
- Działa routing dla CRITICAL (internal notification).

### T107 — 🩷 feedback — System Stability & Uptime Assurance Framework (SLO, observability, deploy gates, recovery)
- Jest zdefiniowane i wdrożone SLO + alerting (przynajmniej dla DB/backup/5xx spikes).
- Health/readiness/liveness mają spójne kontrakty i są wykorzystywane w monitoringu.
- `/api/metrics` działa stabilnie i zasila dashboard.
- Deploy gate (Playwright smoke) blokuje release przy regresji.
- Backup + retention działa; istnieje udokumentowany i zweryfikowany proces restore.

### T108 — 🩷 superadmin — Full Superadmin Control & System Testing Framework (control plane + guardrails + CI confidence)
- SuperAdmin obejmuje krytyczne obszary operacyjne i jest spójny (brak “martwych” modułów).
- High‑risk actions mają guardrails + audyt.
- Test support API jest bezpieczne i działa w CI (nigdy w prod).
- Deploy gate (smoke) blokuje release przy regresji i jest stabilny.

### T109 — 🩷 superadmin — Payment System Integration (Stripe subscriptions + token billing + webhooks + dunning + SuperAdmin ops)
- Stripe subskrypcje działają end‑to‑end (subscribe/change/cancel) i stan w aplikacji jest spójny.
- Webhook Stripe jest podpisany, idempotentny i ma retry strategy; nie ma niepodpisanych handlerów w prod.
- Dunning działa (payment_failed → stages → recover/suspend) i jest widoczny w SuperAdmin.
- Token billing purchase + webhook kredytuje saldo idempotentnie.
- SuperAdmin pozwala na podstawowe billing ops z guardrails + audytem.

### T110 — 🩷 superadmin — Google Login Integration (OAuth/OIDC login + account linking + security events)
- Google login działa end‑to‑end (start → callback → token → redirect → user zalogowany).
- Powiązanie konta zapisuje się w `oauth_links` i nie tworzy duplikatów userów.
- Security events są logowane dla success/failure.
- Frontend ma stabilny callback route dla OAuth.

### T111 — 🩷 superadmin — LinkedIn Login Integration (OAuth login + email retrieval + future-proof for “connect LinkedIn”)
- LinkedIn login działa end‑to‑end i tworzy/linkuje usera bez duplikacji.
- `oauth_links` przechowuje mapping + last_login_at; security events są logowane.
- Flow jest kompatybilny z przyszłym “connect LinkedIn” (T112) — tzn. nie tworzy “shadow identities”.

### T112 — 🩷 superadmin — LinkedIn Account Connection Encouragement System (connect flow + nudges + adoption tracking)
- User widzi prawdziwy status LinkedIn connection w Settings.
- “Connect LinkedIn” działa (dla zalogowanego usera), zapisuje `oauth_links`, i wraca do aplikacji.
- “Disconnect” działa, loguje security event i aktualizuje UI.
- Nudge system jest kontrolowany (dismiss + rate limit) i ma tracking.
- `profile-completeness` endpoint przestaje być stubem i potrafi sugerować “connect LinkedIn”.

### T113 — 🩷 superadmin — User Behavioral Intelligence Tracking System (event stream + activation/adoption + churn signals)
- `POST /api/analytics/journey/track` działa i zapisuje `journey_events`.
- `user_activation_status` aktualizuje się na podstawie eventów.
- Request logging zapisuje `api_logs` (bez PII).
- SuperAdmin widzi realne adoption metrics i churn signals (nie placeholder).
- Jest opt‑out + retention rules.

### T114 — 🩷 superadmin — Transaction Readiness Scoring Algorithm (explainable score 0–100 + factor breakdown)
- System liczy score dla orgów i zapisuje snapshoty z breakdown i blockers.
- SuperAdmin ma ranking + drill‑down.
- Algorytm jest explainable i stabilny (bez losowych skoków).
- Jest gotowy jako input do T115 (Sellix) — czyli ma API i eventy.

### T115 — 🩷 superadmin — Transaction Readiness Integration with Sellix (automated conversion activation)
- Po przekroczeniu progu READY system wysyła event do Sellix dokładnie raz (idempotent + cooldown).
- Inbound webhook odbiera eventy z Sellix bezpiecznie (signature + dedupe) i zapisuje je do analytics.
- SuperAdmin ma konfigurację + test event + podgląd delivery success/fail.
- Integracja nie działa “na niby” w prod (brak placeholderów), a w DEMO jest jawnie wyłączona.

### T116 — 🟣 ai — Centralized AI Prompt Management & Learning System (SSOT prompts + versioning + A/B + learning loop)
- Jest **jeden kanoniczny** registry promptów (key/version/history) i jest używany przez UI + produkcyjne endpointy AI.
- Prompt assembler działa (nie `__unavailable__`) i jest używany w test bench + runtime.
- Learning loop działa end-to-end (feedback → pattern → suggestion → approval → applied in runtime).
- A/B testing działa i ma metryki/winner promotion.
- Mamy metryki jakości/kosztu per prompt version oraz szybki rollback.

### T117 — 🟣 ai — System-Level AI Context Governance (Core Documentation Layer) (canonical “system brain” + citations + drift control)
- Canonical docs (system layer) są zasilone do DB i indeksowane do RAG.
- AIContextBuilder zawsze może dostarczyć core doc snippets (token budgeted).
- Governance odpowiedzi mają cytowania i przechodzą weryfikację (logi w DB).
- SuperAdmin może sprawdzić status core docs i uruchomić reindex / zobaczyć drift.

### T118 — 🟣 ai — External Knowledge & Internet Context Management for AI (safe web research + governance + audit)
- Web Search i Deep Research respektują `internetEnabled` i Regulatory Mode.
- Jest domain policy + SSRF safety + cache.
- Każde użycie internetu ma citations i audit trail (min. w chat trace; preferowane w DB log).
- AIContextBuilder pokazuje w `externalSourcesUsed` realne źródła, gdy użyte.

### T119 — 🟣 ai — Organizational Context Governance for AI (what AI may know + data controls + audit)
- Organizacja może skonfigurować dostęp AI do kategorii kontekstu.
- Runtime enforcement działa (AIContextBuilder respektuje policy).
- PII jest redagowane wg polityki.
- Jest audit trail (min. contextHash + categories_used).

### T120 — 🟣 ai — Individual Context Governance for AI (user privacy + personalization controls + “private mode”)
- Private mode działa i realnie wyłącza persistence/memory updates.
- User może preview/export/delete pamięć.
- Retention jest egzekwowane w kodzie (nie tylko UI).
- Memory writes są PII-safe (redaction + blocklist).

### T121 — 🟣 ai — Organizational Context Governance for AI (Extended Controls: per-project, per-document, DLP-lite)
- Dokumenty mają AI visibility i sensitivity (dla nowego schema; legacy ma compat).
- Retrieval filtruje dokumenty zgodnie z org/project policy.
- Jest minimalny HITL dla `requires_approval`.
- Jest audit trail doc usage per chat run.

### T122 — 🟣 ai — System Architecture Consolidation & Dependency Review (remove duplicates, unify SSOT, reduce risk)
- Nie ma duplikatów kanonicznych endpointów dla tych samych capability (prompts/learning/context/web search).
- Gateway jest uporządkowany: stub routes nie wychodzą w prod.
- Jest raport zależności + sanity checks w CI.
- AI krytyczne zależności mają health checks i obserwowalność.

