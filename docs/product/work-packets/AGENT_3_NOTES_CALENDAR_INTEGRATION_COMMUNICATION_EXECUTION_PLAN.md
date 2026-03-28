# AGENT 3 — Execution Plan

> Status: supporting source, superseded as canonical plan
> Manager note: use only for `Notatki`, `Kalendarz`, and `Integracja` context; `Komunikacja` is parked
> Authority file: `docs/product/work-packets/MANAGER_FALA_1_CANONICAL_EXECUTION_MAP_2026-03-28.md`

## 1. Scope
- `Notatki`
- `Kalendarz`
- `Integracja`
- `Komunikacja dwukierunkowa`
- Interpretacja robocza tego planu: `Agent 3` zostal przypisany do czteromodulowego klastra z `Faza 6` w `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`, poniewaz przekazany prompt zostawial placeholdery zakresu puste.

## 2. Source of truth reviewed
- Zrodla nadrzedne: `docs/product/work-packets/Plan V8.1 Final.md`, `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`, `docs/product/work-packets/V8_EXECUTION_WAVES_NOW_LATER_2026-03-28.md`, `docs/product/work-packets/V8_V81_GAP_ANALYSIS_AND_8_2_CUT_2026-03-28.md`, `docs/product/work-packets/V8_10_PHASE_REVIEW_REPORT_2026-03-28.md`, `docs/product/SYSTEMATYKA_PRZEGLADU_V8.md`, `docs/product/DOCUMENTATION_REGISTRY.md`, `docs/product/V8_V81_FINAL_COMPLETION_PROGRAM.md`, `docs/product/V8_V81_MANAGER_4_AGENT_ORCHESTRATION_PROMPT.md`.
- Notatki: `docs/product/NOTATKA_V8_READINESS_AUDIT.md`, `docs/product/NOTATKA_V8_SSOT.md`, `docs/product/NOTATKA_V8_BENCHMARK.md`, `docs/product/NOTATKA_V8_GAP_MATRIX.md`, `docs/product/NOTATKA_V8_IMPLEMENTATION_PLAN.md`, `docs/product/NOTATKA_V8_PLATFORM_CONTEXT_AND_INTEGRATION.md`, `docs/product/NOTATKA_V8_WORKFLOW_MODEL.md`, `docs/product/NOTEBOOK_V3.md`, `docs/product/work-packets/T3_NOTES_ADJUNCTS_CHARTER.md`, `docs/product/work-packets/evidence/501-v81-broader-notes-object-linked-outputs-breadth-split-brain-map.md`, `docs/product/work-packets/evidence/516-v81-broader-notes-adjunct-object-linked-outputs-breadth-t4-acceptance.md`.
- Kalendarz: `docs/product/MYWORK_CALENDAR_V8_READINESS_AUDIT.md`, `docs/product/MYWORK_CALENDAR_V8_SSOT.md`, `docs/product/MYWORK_CALENDAR_V8_BENCHMARK.md`, `docs/product/MYWORK_CALENDAR_V8_GAP_MATRIX.md`, `docs/product/MYWORK_CALENDAR_V8_IMPLEMENTATION_PLAN.md`, `docs/product/MYWORK_CALENDAR_V8_AS_IS.md`, `docs/product/AI_SYNC_AND_INTEROPERABILITY_STANDARDS_V8.md`, `docs/product/CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`, `docs/product/EXTERNAL_SYNC_READINESS_AUDIT_V8.md`.
- Integracja: `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`, `docs/product/AI_WORKSPACE_PROJECT_RUNTIME_ARCHITECTURE_V8.md`, `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md`, `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`, `docs/product/INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`, `docs/03-engineering/INTEGRATIONS_IMPLEMENTATION_SUMMARY.md`, `docs/flows/integration/EXTERNAL_INTEGRATIONS_FLOW.md`.
- Komunikacja: `docs/product/COMMUNICATION_V8_READINESS_AUDIT.md`, `docs/product/COMMUNICATION_V8_SSOT.md`, `docs/product/INTERNAL_COMMUNICATION_POLICY_AND_COLLABORATION_GOVERNANCE_V8.md`, `docs/product/EXTERNAL_COMMUNICATION_AND_CLIENT_CHANNELS_V8.md`, `docs/product/COMMUNICATION_CHANNEL_SYNC_AND_ROUTING_V8.md`, `docs/product/ASYNC_NOTIFICATIONS_AND_REENGAGEMENT_V8.md`.
- Glowne komponenty / backend paths sprawdzone w repo: `src/components/MyWork/MyWorkHub.tsx`, `src/components/MyWork/NotebookContent.tsx`, `src/components/MyWork/notebook/`, `src/components/MyWork/Calendar/CalendarView.tsx`, `src/components/MyWork/Calendar/useCalendarData.ts`, `src/views/settings/IntegrationsModule.tsx`, `src/components/settings/notifications/NotificationChannelsSettings.tsx`, `src/components/Execution/PeopleChangeWorkspace.tsx`, `src/services/api.ts`, `server/src/routes/v8/my-work.routes.ts`, `server/src/routes/my-work.routes.ts`, `server/src/routes/notebook.routes.ts`, `server/src/routes/integrations/integrations.routes.ts`, `server/src/routes/stakeholder-comm.routes.ts`, `server/src/services/integrations/communicationSyncService.ts`, `server/src/Gateway.ts`.
- Benchmarki konkurencji i liderow kategorii wykorzystane do oceny: `Notion`, `Evernote`, `Guru`, `Google Calendar`, `Outlook / Microsoft 365`, `CalDAV / iTIP / iCalendar`, `Boomi`, `Workato`, `MuleSoft`, `Slack`, `Microsoft Teams`.
- Ryzyko dokumentacyjne: `Plan v8.pdf` nie wystepuje w repo, a lokalne `Softs/` sa traktowane jako zewnetrzny corpus referencyjny poza repo. Oryginalna wizja jest wiec odtwarzana posrednio przez benchmarki i dokumenty `v8`, a nie przez bezposredni odczyt z tych artefaktow.

## 3. Executive summary
Najmocniejszym modułem w tym klastrze sa dzis `Notatki`: produkt ma juz realny editor, capture, attachments, AI proposals, conversion i zywy surface w `My Work`, a problemem nie jest brak produktu, tylko split-brain API, granice domenowe i verifyability retrievalu. `Kalendarz` jest uzywalny jako wewnetrzna warstwa agregacji czasu, ale nadal nie jest produktem PMO-grade, bo zewnetrzny sync, authority model i workload-depth sa za slabe, a create flow jest realnie ograniczony do taska. `Integracja` ma mocna warstwe architektoniczna i sporo runtime'u backendowego, ale user-facing prawda jest nierowna: sa prawdziwe trasy, sa prawdziwe podpiete uslugi, ale centralny modul ustawien dalej miesza zywe flow z lokalnym, placeholderowym UI. `Komunikacja` ma dobra definicje produktu i widoczne bounded flows w execution oraz stakeholder comms, ale nie ma jednego domknietego, zaufanego user flow dla komunikacji dwukierunkowej wewnatrz workspace.

Najwieksze ryzyko w tym zakresie nie polega na braku kodu. Polega na falszywym poczuciu gotowosci: dokumentacja jest czesto dojrzalsza niz surface, a surface bywa dojrzalszy niz jego runtime truth. Najbardziej mylace sa trzy zjawiska: `legacy fallback` w `Notes` i `Calendar`, integracje wygladajace na gotowe mimo lokalnego stanu i twardo zakodowanych danych, oraz komunikacja rozproszona miedzy stakeholder plans, webhook delivery i notification settings bez jednego workflow user-facing. Najszybszy efekt produktowy daja dwa ruchy: dopiecie jednej kanonicznej sciezki `Notebook` oraz twarde uporzadkowanie `Calendar` jako internal-first surface bez udawania parity z Google i Outlook, dopoki parity faktycznie nie istnieje.

Minimalny odbior tej fali nie powinien probowac zamieniac tego klastra w wielki program `8.2`. Celem musi byc przywrocenie zaufania do czterech istniejacych surfaces: user ma wiedziec gdzie zapisac wiedze, jak zobaczyc czas i konflikty, gdzie podlaczyc kanały lub konektory i jak wyslac lub przeprowadzic kontrolowana komunikacje bez wychodzenia w chaos.

## 4. Module-by-module analysis

### Notatki

#### 4.1 Intended product behavior
- `Notatka v8` ma byc `knowledge-in-work`, a nie osobnym edytorem ani archiwum. Zgodnie z `docs/product/NOTATKA_V8_SSOT.md` notatka ma szybko lapac sygnal, dojrzewac w semantycznym editorze, wracac do usera jako kontekst i byc zrodlem dla taska, decyzji, inicjatywy lub outputu.
- Benchmark translacyjny jest czytelny: z `Evernote` trzeba wziac frictionless capture i search-first mindset, z `Notion` strukture, templates i cross-context work, a z `Consultify` dolozyc warstwe AI review, traceability i osadzenie w pracy konsultingowej.
- Modul nie mial stac sie osobnym top-level produktem. Mial pozostac w `My Work`, ale pelnic role glownego miejsca dojrzewania wiedzy roboczej.

#### 4.2 Current repo truth
- Surface istnieje i jest duzy: `src/components/MyWork/MyWorkHub.tsx` ma osobny tab `notebook`, a `src/components/MyWork/NotebookContent.tsx` laduje bogaty editor TipTap, attachments, context panel, AI inline responses, converted output summaries i convert menus.
- Governed V8 path istnieje: `server/src/routes/v8/my-work.routes.ts` obsluguje `/notebook/pages`, `capture/upload`, `attachments`, `classify`, `ai-proposals`, `convert`, a testy route-level potwierdzaja CRUD i adjunct flows.
- Legacy nadal istnieje rownolegle: oprocz `/api/v8/my-work/notebook/*` sa jeszcze `/api/notebook/*` oraz historyczne `/api/my-work/*`. To oznacza, ze Notebook nie ma jeszcze jednej bezdyskusyjnej sciezki runtime truth.
- To jest realnie uzywalne dzis: page CRUD, maturity/status, source-aware upload, attachments, AI proposals, convert, context panel i summaries juz dzialaja jako normalny product surface.
- To nadal jest czesciowe: retrieve quality contract, artifact-boundary discipline, jeden runtime contract, pelna konsystencja note-like surfaces oraz skala knowledge retrievalu nie sa jeszcze domkniete.

#### 4.3 Competitive standard
- `Notion` ustawia standard dla structured knowledge, templates, relacji, blokow i pracy cross-context.
- `Evernote` ustawia standard dla capture-first entry, lekkosci zapisu, attachments, inboxu wiedzy i szybkiego odzyskiwania.
- `Guru` jest istotnym benchmarkiem pomocniczym dla delivery-in-context i verified knowledge, bo user oczekuje, ze wiedza nie tylko lezy w bibliotece, ale wraca do workflow tam, gdzie jest potrzebna.
- Rynkowy standard nie jest juz dzis `edytor notatek`. Standardem jest: szybki zapis, semantyczna struktura, odnajdywanie, zaufanie do pochodzenia, sensowna konwersja do pracy i brak zgadywania, czy dana notatka jest tylko prywatnym szkicem czy juz zrodlem dla dzialania.

#### 4.4 Main gaps
- `User value` — ocena: `strong-medium`. Wartoscia jest realne miejsce pracy nad wiedza; najwiekszy brak to niejednoznaczna granica miedzy `Notebook note` a innymi note-like surfaces.
- `Flow completeness` — ocena: `medium`. Capture -> edit -> AI propose -> convert istnieje; najwiekszy brak to jeden jawny, bezfallbackowy flow end-to-end.
- `UX quality` — ocena: `medium`. Editor i poboczne panele sa bogate; najwiekszy brak to prostsze, bardziej przewidywalne retrieve/capture behavior przy duzej skali.
- `Data / logic quality` — ocena: `medium-strong`. Model `status` i `maturity` jest dojrzaly; najwiekszy brak to retrieval quality contract i verifyability wynikow AI/search.
- `Integration quality` — ocena: `medium`. Linked artifacts i conversion sa juz realne; najwiekszy brak to jedna kanoniczna integracja z pozostala reszta systemu bez split-brain API.
- `Trust / governance / error handling` — ocena: `medium`. AI review contract istnieje; najwiekszy brak to bardziej widoczna roznica miedzy trusted recall, helper recall i failed retrieval.
- `Market standard fit` — ocena: `medium-strong`. Produkt juz nie wyglada amatorsko; najwiekszy brak to brak premium-quality context delivery i retrieval confidence, ktory user zna z najlepszych knowledge products.
- Bezposrednie luki do domkniecia teraz:
- jedna kanoniczna sciezka `NotebookPage` na frontendzie i backendzie,
- jawny boundary matrix egzekwowany w UI, nie tylko w dokumentacji,
- retrieval/readback z explainability i source confidence,
- stabilny capture workflow bez rozjechania miedzy uploadem, source file i page state,
- ujednolicenie note summaries i related-surface previews.

#### 4.5 Minimal acceptance state now
- User potrafi z poziomu `My Work` utworzyc notatke albo przechwycic ja uploadem, widzi od razu jej `status`, `maturity`, `source` i powiazania.
- User moze edytowac notatke w jednym glownym flow, dodawac attachmenty, zobaczyc linked context i uruchomic AI proposal bez zgadywania, czy jest na sciezce V8 czy legacy.
- User moze zaakceptowac albo odrzucic propozycje AI, a efekt jest trwale widoczny po odswiezeniu.
- User moze skonwertowac notatke do taska, decyzji albo inicjatywy i zobaczyc zachowana traceability do notatki zrodlowej.
- Search/recall na aktywnej notatce pokazuje przynajmniej typ dopasowania i pochodzenie, a bledy sa czytelne zamiast „cichego” braku wyniku.
- To, czego nadal moze nie byc bez blokowania odbioru tej fali: pelny `Notion database equivalent`, realtime collaboration, szeroka object-linked outputs breadth poza ta fala.

#### 4.6 Top missing functions
- Jedna kanoniczna sciezka API dla `Notebook`, bez niejawnego fallbacku jako glownego happy path.
- Jawna identyfikacja typu notatki i granicy wobec `task`, `decision`, `initiative`, `interview note` i innych lightweight notes.
- Retrieval quality contract z confidence, snippetami, citations i typem dopasowania.
- Verification/review layer dla notatki i AI-derived suggestions.
- Spójne `used in` i backlink preview na wszystkich powiazanych surface'ach.
- Lepszy quick-capture flow z dowolnego kontekstu aplikacji.
- Lepsza praca na duzej liczbie notatek: filtrowanie, review cadence, stale state, context surfacing.
- Bardziej widoczne source provenance dla upload/source-file flows.
- Konsekwentne convert intents z gotowymi outcome types.

#### 4.7 Proposed bounded delivery packets
1. `N1. Notebook canonical-path closure` — Cel: usunac niepewnosc, czy user pracuje na V8 czy na legacy. Zakres: frontend client + route usage + error/fallback policy dla Notebook. Co dokladnie dowozimy: jeden preferowany path dla list/detail/create/update/attachments/AI proposal/convert oraz czytelne unsupported states zamiast cichego fallbacku. Czego swiadomie nie ruszamy: nowych typow konwersji, realtime collaboration, outputs breadth. Proof odbioru: user wykonuje create -> edit -> AI propose -> resolve -> refresh -> convert bez zmiany sciezki i bez utraty stanu. Ryzyka: ujawnienie realnych brakow legacy ukrywanych dzis fallbackiem.
2. `N2. Knowledge boundary and trust pass` — Cel: sprawic, by user rozumial czym jest `Notebook note`. Zakres: typ notatki, provenance, retrieval trust, UI labels. Co dokladnie dowozimy: widoczny boundary matrix w UI, source/trust markers, retrieval explanation state. Czego swiadomie nie ruszamy: nowej architektury knowledge graph. Proof odbioru: user odroznia notatke robocza od taska/decyzji i widzi skad pochodzi przywolany kontekst. Ryzyka: potrzeba drobnej koordynacji z innymi note-like surfaces.
3. `N3. Quick capture and review loop pass` — Cel: przyspieszyc wejscie i zamkniecie notatki w jednym flow. Zakres: create/upload/create-from-context, review cadence, stale state, actionability cues. Co dokladnie dowozimy: szybszy entry flow, widoczny next step, review reminders i clearer conversion CTAs. Czego swiadomie nie ruszamy: nowej galerii szablonow jako osobnego produktu. Proof odbioru: user zapisuje sygnal w mniej niz minute i wie co dalej z nim zrobic. Ryzyka: pokusa rozszerzenia scope na caly template system.

#### 4.8 Risks and dependencies
- Zaleznosc od `My Work` shell i od tego, czy organizacja ma wlaczony V8 path.
- Zaleznosc od pracy nad `link/backlink` parity i od innych note-like surfaces, zeby boundary matrix nie byl tylko deklaracja.
- Ryzyko dokumentacyjne: benchmarki odwoluje sie do `Softs`, ale corpus nie jest w repo.
- Ryzyko produktowe: latwo ukryc problemy przez fallback, przez co surface wydaje sie gotowy bardziej niz jest.

### Kalendarz

#### 4.1 Intended product behavior
- `MyWork Calendar v8` mial byc jednym panelem czasu dla pracy transformacyjnej: taski, milestones, decisions, assignments, adjustments, approvals, escalations i external events na jednym surface.
- Wedlug `docs/product/MYWORK_CALENDAR_V8_SSOT.md` to nie mial byc ozdobny tab z siatka miesiaca, tylko PMO-grade orchestration surface laczacy plan wewnetrzny z rzeczywistoscia Outlook/Google.
- Istotna zasada produktu brzmi uczciwie: nie wolno udawac full bidirectional sync, jesli runtime go nie ma.

#### 4.2 Current repo truth
- Surface istnieje w `MyWorkHub` i korzysta z `src/components/MyWork/Calendar/CalendarView.tsx` oraz `useCalendarData.ts`.
- Hook `useCalendarData.ts` juz traktuje `task`, `initiative`, `decision`, `google`, `outlook`, `consultify` jako source filters, wiec UI komunikuje szerszy model niz zwykly task calendar.
- V8 backend dostarcza `/api/v8/my-work/calendar/unified`, `/calendar/conflicts`, `/calendar/events` i `/calendar/phases/*`, a testy route-level sa obecne.
- Realny limit jest twardy: `POST /calendar/events` w V8 potrafi utworzyc tylko `task`; `initiative` i `decision` zwracaja `501`.
- Frontend API nadal ma legacy fallback (`Api.shouldFallbackToLegacyMyWorkCalendar`), co znaczy, ze surface nie jest jeszcze czysto kanoniczny.
- To, co jest naprawde uzywalne: unified read, filters, conflict check, internal create scaffolding, FullCalendar-based visual surface.
- To, co jest tylko czesciowe: zewnetrzny sync parity, event identity, bidirectional doctrine, assignments/adjustments/workload, authority model i reschedule semantics.

#### 4.3 Competitive standard
- `Google Calendar` i `Outlook / Microsoft 365` definiuja minimalny standard zewnetrznego syncu: OAuth, stable IDs, durable edit authority, calendar selection, recurrence i merge semantics.
- `CalDAV / iTIP / iCalendar` ustawiaja standard interoperacyjny: scheduling to nie tylko pobieranie eventow, ale stan, odpowiedzi, cancelacje, uprawnienia i conflict-safe writes.
- Uzytkownik B2B oczekuje dzis, ze kalendarz pracy nie klamie: musi wiedziec co jest internal, co jest mirrored, co mozna przesunac i jaki to ma skutek.
- Dla produktu klasy PMO standardem rynkowym jest rowniez overload awareness, review windows i governance timing, nie tylko meetings.

#### 4.4 Main gaps
- `User value` — ocena: `medium`. User widzi jeden surface czasu; najwiekszy brak to brak pewnosci, czy kalendarz jest realnym narzedziem planowania czy tylko widokiem.
- `Flow completeness` — ocena: `medium-low`. Read + conflicts + task create sa; najwiekszy brak to brak end-to-end flow dla external sync i dla PMO item classes poza taskiem.
- `UX quality` — ocena: `medium`. Głowny widok istnieje; najwiekszy brak to zbyt szeroka obietnica source filters wobec realnej dojrzalosci backendu.
- `Data / logic quality` — ocena: `medium-low`. Unified contract istnieje; najwiekszy brak to stable identity, authority and conflict doctrine i realny merge model.
- `Integration quality` — ocena: `low-medium`. Calendar jest powiazany z sync docs i settings; najwiekszy brak to prawdziwa parity Google/Outlook.
- `Trust / governance / error handling` — ocena: `low-medium`. Conflicts endpoint istnieje; najwiekszy brak to jawne zasady kto moze zmieniac date i co dzieje sie przy kolizji z external source.
- `Market standard fit` — ocena: `medium-low`. Produkt nie jest atrapą, ale tez nie spelnia jeszcze standardu leader-grade PMO calendar. Najwiekszy brak to external + workload maturity.
- Bezposrednie luki do domkniecia teraz:
- internal-first calendar needs clearer authority story,
- create flow musi byc uczciwie ograniczony lub rozszerzony do `initiative` i `decision`,
- external provider states i labels musza odpowiadac prawdzie runtime,
- workload/assignments/adjustments musza miec co najmniej minimalna reprezentacje user-facing.

#### 4.5 Minimal acceptance state now
- User moze otworzyc kalendarz i zobaczyc na jednym surface taski, decyzje i milestone-like work bez dublowania lub niespójnych stanów.
- User moze utworzyc zdarzenie typu `task`, sprawdzic konflikt dnia i zobaczyc zmiane po odswiezeniu.
- User widzi wyraznie, czy event lub filtr pochodzi z `consultify`, `google` lub `outlook`, ale UI nie sugeruje full write parity, jesli jej nie ma.
- User rozumie, co jest authoritative i kiedy przesuniecie daty zmienia tylko obiekt wewnetrzny, a kiedy dotyczy systemu zewnetrznego.
- Akceptowalne bledy: brak wsparcia dla niektorych source types jest pokazany wprost jako `not yet supported`, a nie jako cichy failure.
- To, czego nadal moze nie byc bez blokowania odbioru tej fali: pelna bidirectional sync parity, advanced recurrence, pelny workload engine.

#### 4.6 Top missing functions
- Realny Google/Outlook OAuth and sync lifecycle.
- Stable external event identity i merge semantics.
- `initiative` i `decision` create/reschedule flows albo uczciwe internal-only ograniczenie.
- Authority doctrine dla move/delete/cancel.
- Conflict surfaces z wieksza wartoscia niz prosty daily overload count.
- Minimalny workload/assignment/adjustment layer.
- Spójne propagowanie zmian miedzy Home, Inbox i Calendar.
- Provider connection state widoczny w kalendarzu, nie tylko w ustawieniach.

#### 4.7 Proposed bounded delivery packets
1. `C1. Internal calendar truth hardening` — Cel: dowiezc jeden wiarygodny internal-first kalendarz. Zakres: unified read, task create, conflict, phase truth, state propagation. Co dokladnie dowozimy: brak rozjazdu miedzy Home/Inbox/Calendar, jasne create/reschedule support matrix i unsupported states. Czego swiadomie nie ruszamy: pelny external sync. Proof odbioru: task utworzony z kalendarza jest widoczny rowniez w innych surfaces z tym samym stanem. Ryzyka: ujawnienie niewspieranych item types w aktywnym UI.
2. `C2. Calendar authority and source semantics pass` — Cel: przywrocic zaufanie do dat. Zakres: source badges, provider state, move/delete policy, error states. Co dokladnie dowozimy: jawny model ownership i conflict copy w UI oraz API semantics zgodne z nim. Czego swiadomie nie ruszamy: recurrence i deep external merge. Proof odbioru: user wie, czy ruch dotyczy tylko Consultify czy tez zrodla zewnetrznego. Ryzyka: koniecznosc skoordynowania z sync modulem.
3. `C3. Thin PMO timing layer` — Cel: sprawic, by kalendarz nie byl tylko meeting/task view. Zakres: minimalne assignment/review/escalation markers i workload cues. Co dokladnie dowozimy: widoczne klasy czasu i przynajmniej podstawowy overload signal. Czego swiadomie nie ruszamy: pelny workload planner. Proof odbioru: user potrafi odroznic normalne eventy od governance windows i przeciazenia. Ryzyka: latwo otworzyc za szeroki scope PMO.

#### 4.8 Risks and dependencies
- Twarda zaleznosc od `Integracja`, bo Outlook/Google truth nie powinna byc dokladana lokalnie tylko przez connector layer.
- Twarda zaleznosc od `My Work` cross-surface state propagation.
- Ryzyko UX: filtry `google` i `outlook` juz sugeruja dojrzalosc, ktorej runtime jeszcze nie dowozi.
- Ryzyko scope creep: calendar szybko zamienia sie w osobny program sync + workload.

### Integracja

#### 4.1 Intended product behavior
- `Integracja` miala byc nie zbiorem przypadkowych konektorow, ale lekka i powazna platforma polaczen: katalog konektorow, connection layer, mapping/workflow layer, runtime jobs i monitoring/support.
- `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md` oraz `docs/product/SYNC_PLATFORM_BENCHMARK_V8.md` definiuja ten obszar jako governance-first control plane dla zrodel, syncu, ACL, freshness i operator semantics.
- W warstwie produktu to mial byc most miedzy `Consultify` a PM tools, komunikatorami, kalendarzami i zrodlami wiedzy, bez rozjazdu miedzy tym, co user konfiguruje, a tym, co runtime naprawde umie.

#### 4.2 Current repo truth
- Backend integracyjny jest szeroki: `server/src/routes/integrations/integrations.routes.ts`, `calendarIntegrations.routes.ts`, `automation.routes.ts`, `mcp` routes oraz uslugi PM sync i communication sync wskazuja na realne runtime foundations.
- Problem jest user-facing: `src/views/settings/IntegrationsModule.tsx` nadal miesza prawdziwa powloke na taby z lokalnym stanem i przykładowymi danymi dla API keys, webhooks i calendar sync.
- `NotificationChannelsSettings.tsx` jest blizej prawdy, bo korzysta z realnych endpointow `/api/integrations/${channel}/connect`, ale sama logika UI nadal zaklada onboarding states bardziej niz pelnie domkniety product flow.
- Superadmin i admin surfaces istnieja, ale percepcja usera jest niespójna: sa osobne miejsca dla integracji, sync hubu, channel settings i enterprise integrations.
- To, co jest realne: sporo endpointow, provider-oriented routes, PM sync materialization, Slack/Teams dispatch, stakeholder communication dependencies, V8 docs dla connector policy.
- To, co jest czesciowe lub mylace: brak jednego MyWork-specific integration contract, brak jednej integracyjnej historii produktu, placeholderowy charakter czesci settings UI i mieszanie control plane z mock-like presentation.

#### 4.3 Competitive standard
- `Boomi` ustawia standard jednej platformowej historii: connectors, events, APIs, data, operator plane i governance nie sa osobnymi mini-modulami.
- `Workato` ustawia standard na prostote setupu bez utraty mocy: connection, workflow, job run, mapping preview i debug trace musza byc czytelne dla nie-engineera.
- `MuleSoft` ustawia standard warstw: control plane, runtime plane, policies, RBAC i monitoring sa wyraznie rozdzielone.
- User rynkowo oczekuje, ze integracje nie beda „ukrytym backendem”. Oczekuje onboarding flow, widocznego stanu polaczenia, diagnostyki, retry/failure truth i braku sprzecznych miejsc konfiguracji.

#### 4.4 Main gaps
- `User value` — ocena: `medium-low`. Backend ma realna wartosc; najwiekszy brak to brak jednego czytelnego user flow konfiguracji i utrzymania integracji.
- `Flow completeness` — ocena: `low-medium`. Są connect/disconnect i runtime fragments; najwiekszy brak to jeden spójny setup -> validate -> enable -> monitor flow.
- `UX quality` — ocena: `low-medium`. Taby istnieja; najwiekszy brak to placeholder/mocked feel w czesci glownego settings surface.
- `Data / logic quality` — ocena: `medium`. Architektura i runtime są sensowne; najwiekszy brak to ujawnienie mapping/run truth w produkcie, nie tylko w backendzie i dokumentach.
- `Integration quality` — ocena: `medium`. Paradoksalnie to sam modul integracji ma problem z wlasna spójnością; najwiekszy brak to jedno control-plane story.
- `Trust / governance / error handling` — ocena: `medium-low`. Docs sa mocne governance-first; najwiekszy brak to support-visible connection state, failure behavior i operator actions w glownych surfaces.
- `Market standard fit` — ocena: `low-medium`. Produkt nie wyglada jak leader-grade integration platform; najwiekszy brak to brak jednego powaznego, zorganizowanego control plane.
- Bezposrednie luki do domkniecia teraz:
- usunac mock-like settings behavior z glownych integracyjnych views,
- pokazac prawdziwy connection state i onboarding state,
- ujednolicic katalog integracji, kanały i sync hub jako jedna opowiesc,
- wystawic minimalny monitoring/run status dla usera/operatora,
- zredukowac rozproszenie miedzy settings, admin i superadmin.

#### 4.5 Minimal acceptance state now
- User wchodzi do jednego glównego miejsca integracji i widzi realna liste providerow, ich stan, ostatnia walidacje albo wymagany nastepny krok.
- User moze rozpocząć onboarding dla co najmniej najwazniejszych providerow tej fali i widzi, czy jest na etapie auth, config, validation czy ready.
- User/operator potrafi sprawdzic, czy dana integracja jest tylko skonfigurowana, czy aktywnie dziala, i co zrobic przy failure.
- Kalendarz, komunikacja i PM-adjacent integrations nie wygladaja jak oddzielne swiaty.
- Akceptowalne ograniczenia: brak szerokiego mapping buildera i brak pelnego enterprise control plane klasy Boomi/Workato, o ile podstawowy connection truth i diagnostics sa realne.

#### 4.6 Top missing functions
- Jeden katalog integracji z prawdziwym provider state.
- Jedna spójna sciezka onboardingowa `connect -> configure -> validate -> enable`.
- Jasne rozdzielenie connection, mapping, runtime i monitoring.
- Widoczne run/job truth i last-sync truth.
- Konsystencja miedzy user settings, admin i superadmin surfaces.
- Provider-specific parity honesty dla Slack, Teams, calendar, PM tools i email-based connectors.
- Minimalna diagnostyka błędów i retry/support actions w UI.

#### 4.7 Proposed bounded delivery packets
1. `I1. Integration control-plane honesty pass` — Cel: wyciac najbardziej mylace pozory gotowosci. Zakres: glowny Integrations surface, provider cards, auth/config states, placeholder removal. Co dokladnie dowozimy: prawdziwe state labels i wycofanie hardcoded/mock-like UI z happy path. Czego swiadomie nie ruszamy: szerokiego mapping buildera. Proof odbioru: user nie widzi juz integracji, ktore wygladaja na polaczone tylko lokalnym state'em. Ryzyka: kilka providerow ujawni realny stopien niedomkniecia.
2. `I2. One catalog, one status model` — Cel: ujednolicic control plane. Zakres: settings, sync hub, channel bindings, superadmin readback. Co dokladnie dowozimy: wspolny slownik statusow i jedna provider inventory truth. Czego swiadomie nie ruszamy: nowego control plane dla wszystkich enterprise assets. Proof odbioru: ten sam provider ma ten sam status i ten sam nastepny krok na kazdym surface. Ryzyka: koordynacja miedzy wieloma istniejacymi ekranami.
3. `I3. Diagnostics and last-run visibility` — Cel: zamienic integracje z „setup page” w realne narzedzie operacyjne. Zakres: last validation, last sync/run, error summary, recovery CTA. Co dokladnie dowozimy: minimalny monitoring user-facing dla najwazniejszych providerow. Czego swiadomie nie ruszamy: pelnej observability platform. Proof odbioru: operator potrafi stwierdzic, czy integracja dziala i co zrobic, gdy nie dziala. Ryzyka: potrzeba spięcia z backend stats/logging.

#### 4.8 Risks and dependencies
- Twarda zaleznosc od `Sync` i czesciowo od `Admin / Superadmin`, ale bez przejmowania calego programu `8.2`.
- Ryzyko ujawnienia duzej nierownosci provider-by-provider po usunieciu placeholderowego UI.
- Ryzyko architektoniczne: latwo przepalic scope na „zbudujmy Workato”, a nie na bounded product truth.

### Komunikacja dwukierunkowa

#### 4.1 Intended product behavior
- `Communication v8` mialo stac sie governed communication layer powiazanym z realna praca: internal collaboration, external project messaging, routing do kanalow i materializacja komunikacji do taskow, approvals, decisions albo deliverables.
- Dla tego planu interesuje nas waski, user-facing slice `Komunikacja dwukierunkowa`, czyli realny flow wymiany informacji tam, gdzie ta wymiana prowadzi do pracy, a nie osobny wielki produkt typu Slack clone.
- W dokumentach jest bardzo jasna zasada: komunikacja ma redukowac chaos i zamieniac wiadomosci w outcome, nie generowac kolejne message sprawl.

#### 4.2 Current repo truth
- Repo ma realny backend dla stakeholder communication: `server/src/routes/stakeholder-comm.routes.ts` obsluguje segments, plans, items, send log, overdue i steerco packs.
- Execution ma realny user-facing workspace: `src/components/Execution/PeopleChangeWorkspace.tsx` ma subtab `communication`, laduje segments, plans, plan items, overdue, send log i steerco packs, a takze wykonuje `send` i `distribute`.
- Osobno istnieje event-driven outbound communication: `server/src/services/integrations/communicationSyncService.ts` obsluguje Slack/Teams webhooks dla eventow typu `decision_required`, `gate_pending`, `task_due`, `risk_alert`, `blocker_detected`.
- To jednak nie sklada sie jeszcze w jeden modul `dwukierunkowej komunikacji` dla workspace. W `SYSTEMATYKA_PRZEGLADU_V8.md` wiersz `MyWork | Komunikacja dwukierunkowa` wprost mowi: `brak pakietu`.
- To, co jest realnie uzywalne: stakeholder comm plans, send log, steerco pack distribution oraz webhook-driven notifications.
- To, co jest nadal czesciowe: brak jednego internal/external review flow, brak workspace-native thread/outcome flow, brak jednego miejsca gdzie user rozumie kto z kim, jakim kanalem i z jakim skutkiem komunikuje.

#### 4.3 Competitive standard
- `Slack` i `Microsoft Teams` ustawiaja standard dla internal operational communication: szybka wymiana, ale osadzona w kanałach, rolach, wzmiankach i powiadomieniach.
- Produkty typu `Asana`, `ClickUp` i `Linear` ustawiaja inny, dla nas bardzo wazny standard: komentarz, update, reminder i review sa powiazane z obiektem pracy, a outcome komunikacji materializuje sie w zadaniu albo decyzji.
- W komunikacji zewnetrznej standardem rynkowym jest client-safe wording, approval przed wysylka i trwały record tego, co zostalo zakomunikowane.
- User oczekuje dzis, ze komunikacja nie bedzie ani tylko „centrum notyfikacji”, ani tylko „oddzielnym chatem”, lecz kontrolowanym mechanizmem przesuwania pracy dalej.

#### 4.4 Main gaps
- `User value` — ocena: `medium-low`. Sa widoczne bounded use cases; najwiekszy brak to brak jednego prostego flow dwukierunkowej komunikacji z outcome.
- `Flow completeness` — ocena: `low-medium`. Plans i send log istnieja; najwiekszy brak to pelny loop `discuss -> review -> send -> acknowledge -> materialize follow-up`.
- `UX quality` — ocena: `medium-low`. Execution workspace ma realne sekcje; najwiekszy brak to brak jednego canonical surface dla komunikacji jako takiej.
- `Data / logic quality` — ocena: `medium`. Routes i services sa bogate; najwiekszy brak to wspolny object model w widocznym runtime dla thread/message/channel/outcome.
- `Integration quality` — ocena: `medium-low`. Slack/Teams delivery istnieje; najwiekszy brak to prawdziwe channel binding i polityka routingu widoczne w user flow.
- `Trust / governance / error handling` — ocena: `medium`. Docs mocno pilnuja review i safety; najwiekszy brak to client-safe review path i failure states na aktywnych surfaces.
- `Market standard fit` — ocena: `low-medium`. To nie wyglada jeszcze jak produktowa komunikacja klasy B2B; najwiekszy brak to spójne powiazanie komunikacji z obiektami pracy i outcome semantics.
- Bezposrednie luki do domkniecia teraz:
- brak kanonicznego `workspace communication contract`,
- brak jednego flow dla internal + external review and send,
- brak acknowledgement/follow-up loop jako glównego user value,
- rozproszenie miedzy notification settings, stakeholder comms i webhook delivery,
- slabiej widoczne policy/routing truth dla kanalow.

#### 4.5 Minimal acceptance state now
- User potrafi w jednym widocznym flow przygotowac komunikat lub plan komunikacji do grupy interesariuszy, wyslac go kontrolowanym kanalem i zobaczyc trwaly wynik w logu.
- Internal komunikacja i external komunikacja sa rozdzielone semantycznie, a high-risk outbound wymaga review.
- Ważna komunikacja potrafi utworzyc albo zasugerowac follow-up task, approval albo decision candidate.
- User/operator widzi channel, audience, status wysylki i ewentualny failure zamiast zgadywania, czy webhook zadzialal.
- Akceptowalne ograniczenia: brak pelnego team-chat produktu i brak szerokiego cross-tenant communication suite.

#### 4.6 Top missing functions
- Jedno canonical user flow dla `communication plan -> review -> send -> outcome`.
- Workspace-specific contract dla komunikacji dwukierunkowej.
- Widoczny channel binding i routing truth na aktywnym surface.
- Acknowledgement and response-follow-up semantics.
- Materializacja komunikacji do taska/approval/decision jako first-class action.
- Client-safe external review UI.
- Failure and retry visibility dla outbound communication.
- Mniejsze rozproszenie miedzy plans, notifications i channel settings.

#### 4.7 Proposed bounded delivery packets
1. `M1. Stakeholder communication main-flow pass` — Cel: zamienic istniejące fragments w jeden czytelny flow. Zakres: plans, items, send, log, overdue, steerco packs na glownym workspace. Co dokladnie dowozimy: spójny `prepare -> review -> send -> confirm/log` flow z czytelnym outcome. Czego swiadomie nie ruszamy: full team-chat product. Proof odbioru: user przygotowuje i wysyla plan item albo steerco pack, a stan i log sa wiarygodne po refreshu. Ryzyka: potrzeba doprecyzowania modeli recipientow i ack.
2. `M2. Channel routing truth pass` — Cel: pokazac userowi i operatorowi, jak naprawde dziala kanał. Zakres: channel policy, bindings, allowed classes, external review requirement, failure visibility. Co dokladnie dowozimy: routing state i policy badges na aktywnych surfaces. Czego swiadomie nie ruszamy: szerokiego omnichannel orchestration. Proof odbioru: user wie, czy komunikat pojdzie mailem, Slackiem, Teamsem czy tylko do in-app review. Ryzyka: silna zaleznosc od `Integracja`.
3. `M3. Communication-to-work closure` — Cel: dowiezc glowna obietnice produktu. Zakres: follow-up task, approval, decision candidate, delivery record. Co dokladnie dowozimy: minimum jednej realnej sciezki materializacji outcome po komunikacji. Czego swiadomie nie ruszamy: pelnej automatyzacji NLP nad kazda wiadomoscia. Proof odbioru: wyslana lub przejrzana komunikacja tworzy widoczny kolejny krok w systemie. Ryzyka: latwo wejsc w scope `Execution` i `Inbox`.

#### 4.8 Risks and dependencies
- Twarda zaleznosc od `Integracja`, bo bez prawdziwych channel bindings routing pozostanie teoretyczny.
- Zaleznosc od `Execution`, bo najdojrzalszy dzis surface komunikacyjny siedzi w execution workspace.
- Ryzyko scope creep w strone pelnego produktu komunikacyjnego, ktory ten plan swiadomie odkłada.
- Ryzyko mylacej semantyki, jesli `Notifications`, `Chat` i `Communication` nie zostana ostro rozdzielone w UI copy i nav.

## 5. Cross-module dependencies
- `Notatki -> Integracja`: capture, provenance i context delivery sensownie rosna tylko wtedy, gdy integration layer potrafi wiarygodnie obslugiwac source state, source metadata i connector truth.
- `Kalendarz -> Integracja`: zewnetrzny sync i provider state nie powinny byc lokalna logika kalendarza; musza byc czytane z jednego connector/control-plane story.
- `Komunikacja dwukierunkowa -> Integracja`: Slack, Teams, email i inne kanaly wymagaja jednego modelu bindings, statusow i auth/onboarding state.
- `Komunikacja dwukierunkowa -> Notatki`: follow-up i knowledge capture po komunikacji powinny naturalnie umiec zapisac wynik do `Notebook`, ale bez rozszerzania scope na szeroki program outputs.
- `Kalendarz -> Komunikacja dwukierunkowa`: governance windows, reminders i review timings maja wartosc dopiero wtedy, gdy komunikat i follow-up sa widoczne jako outcome czasu, a nie osobna tabela.

## 6. Recommended execution order
- `1. N1 Notebook canonical-path closure`
- `2. N2 Knowledge boundary and trust pass`
- `3. C1 Internal calendar truth hardening`
- `4. C2 Calendar authority and source semantics pass`
- `5. I1 Integration control-plane honesty pass`
- `6. I2 One catalog, one status model`
- `7. M1 Stakeholder communication main-flow pass`
- `8. M2 Channel routing truth pass`
- `9. C3 Thin PMO timing layer`
- `10. N3 Quick capture and review loop pass`
- `11. I3 Diagnostics and last-run visibility`
- `12. M3 Communication-to-work closure`
- Uzasadnienie: najpierw trzeba ustabilizowac dwa najbardziej widoczne i juz realnie uzywalne surfaces (`Notatki`, `Kalendarz`), potem odciac najbardziej mylace falsze poczucie gotowosci w `Integracja`, a dopiero po tym skladac `Komunikacja dwukierunkowa` na prawdziwym modelu kanalow i statusow. Kolejnosc odwrotna grozi budowaniem komunikacji na nieuczciwej warstwie routing/connectors.

## 7. Final recommendation
Ten zakres da sie dowiezc do poziomu dobrego produktu bez otwierania `8.2`, ale tylko pod jednym warunkiem: trzeba przestac nagradzac pozorna kompletność. W `Notatkach` oznacza to porzucenie ukrytego split-brain jako mechanizmu „dziala przeciez”, w `Kalendarzu` oznacza uczciwe internal-first hardening bez udawania parity z Google i Outlook, w `Integracji` oznacza usuniecie settings UI, ktore wyglada na gotowe bardziej niz jest, a w `Komunikacji dwukierunkowej` oznacza rezygnacje z marzenia o pelnym komunikatorze na rzecz jednego kontrolowanego workflow powiazanego z praca.

Nie wolno uproscic ani zignorowac czterech rzeczy:
- jednej kanonicznej sciezki runtime dla `Notebook` i `Calendar`,
- uczciwosci provider/channel state w `Integracja`,
- review i client-safe granicy w `Komunikacja`,
- twardego rozdzielenia tego, co jest `minimal acceptance now`, od tego, co jest juz ewidentnym `8.2`.

Jesli te cztery zasady zostana utrzymane, ten klaster moze bardzo szybko przestac wygladac jak zbior nierownych eksperymentow i zaczac wygladac jak wiarygodny zestaw surfaces do codziennej pracy.
