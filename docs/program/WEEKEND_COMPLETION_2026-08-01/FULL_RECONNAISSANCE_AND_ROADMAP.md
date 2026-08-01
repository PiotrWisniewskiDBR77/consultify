---
doc_id: full-code-knowledge-reconnaissance-2026-07-30
truth_type: delivery-status
status: canonical
owner: codex
business-owner: piotr
last_reviewed: 2026-07-30
---

# Pełny zwiad kodu i wiedzy — plan dokończenia

## Werdykt wykonawczy

Głównym problemem Consultify nie jest brak kodu. Jest nim **niski poziom
integracji dużej liczby częściowo gotowych fragmentów**.

W wielu obszarach istnieją jednocześnie:

- bogaty backend i model danych;
- kilka generacji API;
- duża liczba komponentów frontendowych;
- stare i nowe Huby;
- flagi i fallbacki;
- dokumentacja opisująca różne momenty rozwoju;
- brak jednego odebranego pionowego przepływu.

Strategią dokończenia jest scalenie, nie przepisywanie.

## Metoda zwiadu

Sprawdzono:

- konfigurację sidebara i mapowanie AppView;
- `routeConfig.ts` i zamontowane elementy `AppRoutes.tsx`;
- importy oraz mounty `server/src/Gateway.ts`;
- komponenty, widoki, usługi, trasy i testy domenowe;
- migracje/schematy według markerów domenowych;
- kontrakty modułów, dokumentację produktu, Harvard, rejestr i wdrożenia;
- markery legacy/fallback/mock/placeholder/V8/V10/TODO.

Liczby oparte o słowa kluczowe są wskaźnikiem skali, nie dokładnym pomiarem
funkcji.

## Skala

- ok. 2 760 plików kodu zawiera marker fragmentacji lub generacji;
- 369 frontendowych kandydatów Hub/View/V8/V10/Legacy;
- tysiące dokumentów wspominają główne domeny;
- Gateway montuje wiele równoległych rodzin endpointów w Assessment,
  Initiatives, Execution, Results, Finance i Materials.

## Kolejność programu

Zgodnie z decyzją Piotra:

1. Partner Portal
2. Organization
3. Meeting
4. Audits
5. Materials
6. Finance
7. Results/KPI
8. Execution
9. Initiatives
10. Assessment
11. Tools
12. Interview
13. My Work
14. Chat
15. Settings
16. Admin
17. SuperAdmin

Control plane jest na końcu, ale krytyczne guardy bezpieczeństwa pozostają
obowiązkową bramką każdego wcześniejszego slice’u.

## Remanent bottom-up

### 1. Partner Portal

Mamy:

- chronione `/partner/*`;
- `PartnerPortalViewNew` i zestaw widoków dashboard/clients/commission/
  directory/resources/pricing;
- backend partners, public partner, applications, outreach i settlements;
- testy i migracje;
- read-back ustawień payout.

Fragmentacja:

- V8 i legacy partner API;
- jawne `shouldFallbackToLegacyPartner`;
- public acquisition, portal i SuperAdmin settlements tworzą trzy płaszczyzny;
- część treści komercyjnej ma TODO do decyzji Piotra.

Pierwszy golden flow:

`connect/approved partner → referral → status client → commission → read-back`

### 2. Organization

Mamy:

- kanoniczne `/organization/*` i `OrganizationView`;
- kontekst, profile, data, limits, ownership, RBAC, teams, branding, domains;
- Context Store i worker;
- rozbudowane testy/migracje.

Fragmentacja:

- stary `ContextBuilderView` nadal istnieje;
- `/context/*` przekierowuje do Organization;
- nie wszystkie moduły mogą korzystać z jednego modelu kontekstu;
- bardzo szeroka domena zaciera granicę Organization vs Admin/Settings.

Golden flow:

`update organization context → audited persistence → Teresa/module consumes new version`

### 3. Meeting

Mamy:

- zamontowany `/meeting`;
- realny `MeetingHub`;
- API list/create/edit/decisions/follow-ups/notes i AI Operator Brief;
- backend `/api/meeting` pod BetaGate;
- smoke testy komponentu i testy tras.

Rozjazd:

- menu i część dokumentacji nadal mówią „Wkrótce/placeholder”;
- runtime jest znacznie bardziej gotowy niż deklarowany produkt;
- brak pełnego odbioru consent/transcript/decision/task/material handoff.

Golden flow:

`create meeting → agenda → complete → AI notes → approve decisions/follow-ups →
My Work/Materials read-back`

### 4. Audits

Mamy:

- publiczne `/audits`;
- funkcjonalne `/audit-programs`;
- `AuditProgramsHub`, wizard i raport DRD;
- backend audit programs, events, logs i starszy audit stub;
- testy huba, wizarda i API.

Fragmentacja:

- public showcase i aplikacja produkcyjna mają różne wejścia;
- `/api/audit` łączy realne routery i `mountStub`;
- raport DRD jest flagowany i wcześniej był orphaned;
- historyczne powiązanie z Assessment.

Golden flow:

`create program → requirement → evidence → finding → corrective action →
initiative/report`

### 5. Materials

Mamy:

- wspólny `ReportsAndPresentationsHub`;
- Document Studio z edytorem, diff, komentarzami, AI, QA i share reader;
- Presentation Studio, enterprise API, builder i export;
- Table Platform z AI editor, relations, sources, forms, QA i conversions;
- artifacts, runs, approvals i conversions;
- szerokie testy backendu.

Fragmentacja:

- hub nadal importuje dane mock;
- archiwizacja/usuwanie sheets jest oznaczone „coming soon backend”;
- kilka historycznych wejść Reports/Outputs/Wordy/Excele/Studios;
- osobne modele artefaktów i approvals;
- przekierowania mogą ukrywać niekompletne przejścia;
- nierówna gotowość DOCX/XLSX/PPTX/PDF.

Golden flow:

`source → create artifact → edit → autosave/version → review/approve → reopen →
export/share`

Decyzja zakresowa: wszystkie formaty są wymagane. Excel/Table jest największym
strumieniem i obejmuje także niedokończone generatory szablonów.

### 6. Finance

Mamy:

- `/finance` oraz stara trasa i nazwa widoku wymagające migracji;
- szczegóły statements/models/analyses;
- rozbudowany `FinanceHub`, panele, modele, wykresy, import i wersje;
- analizy inwestycyjne, finance statements, finance enterprise i liczne V8 API;
- testy IDOR, walidacji, auth i wiring.

Fragmentacja:

- V8-first z legacy fallback;
- Finance i część `Benefits` współdzielą workspaces finansowe;
- wiele modeli/analiz bez jednej udowodnionej ścieżki;
- potencjalnie kilka źródeł ROI i business case.

Golden flow:

`import statement → validate/map → create model → scenario/analysis → review →
versioned result`

### 7. Results/KPI

Mamy:

- `/benefits` montujące `ResultsHub`;
- `/kpi-okr` jako alias;
- foldery `Results` i `Benefits`;
- KPI, OKR, time series, reconciliation, reporting, ROI i value intelligence;
- sześć rodzin Results API plus benefits/benefits-register;
- znaczące testy i migracje.

Fragmentacja:

- równoległe powierzchnie Results/Benefits;
- `shouldFallbackToLegacyResults`;
- KPI creation placeholder w starszym `BenefitsHub`;
- kilka modeli ROI i value;
- niejasny podział ownership Results vs Finance.

Golden flow:

`define KPI → baseline/target → measurement → deviation → action →
approved report/Finance link`

Ownership: Finance posiada modele, założenia i wartości finansowe. Results
posiada KPI, pomiary oraz efekty. Initiative może linkować do obu domen,
tworząc golden thread plan → realizacja → koszt/wartość → rezultat.

### 8. Execution

Mamy:

- `/execution` montujące `FullExecutionView`;
- `/implementation` montujące `ExecutionHub`;
- rollout przekierowany do zakładki;
- PMO execution, execution-control, analytics, modules, rollout i V8;
- bardzo szerokie testy i dane.

Fragmentacja:

- dwa aktywne główne runtime dla jednej domeny;
- V8 unavailable wrapper;
- PMO, execution i execution-control mają nakładające się ownership;
- trasa menu i trasy pomocnicze nie prowadzą do jednego modelu.

Golden flow:

`accepted initiative → plan → task/milestone → risk/change → completion →
Results`

### 9. Initiatives

Mamy:

- InitiativesHub, PortfolioView, ROI i redirect Roadmap;
- PMO initiatives, governance, backbone, candidates, generator, materialize;
- liczne testy i migracje.

Fragmentacja:

- kilka routerów pod `/api/initiatives` z wrażliwą kolejnością mountów;
- osobny generator i osobne `/api/pmo/initiatives`;
- Portfolio/Roadmap/ROI mają historyczne widoki;
- potrzebny jeden lifecycle i write-truth.

Golden flow:

`candidate from source → complete business case → review/approve → portfolio →
Execution transfer`

### 10. Assessment

Mamy:

- AssessmentHub i SessionEditor;
- framework routes i report redirect;
- hub, workflow, workflow-v2, AI, evidence, reports, enterprise, V8;
- liczne testy i migracje.

Fragmentacja:

- historyczny alias Licensed Tools;
- kilka rodzin `/api/assessment` i `/api/assessments`;
- Gateway sam dokumentuje kolizje/stub;
- modele framework/session/report wymagają jednego kanonu.

Golden flow:

`framework → assessment → responses/evidence → deterministic score → review →
report → initiative candidate`

### 11. Tools

Mamy:

- DiscoveryToolsHub i kategorie;
- KnownTool, Wizard, Document i Assets;
- tools, known-tools, tool-assets i enterprise API;
- sesje oraz testy bezpieczeństwa.

Fragmentacja:

- nazewnictwo Discovery/Tools;
- mało jawnych migracji domenowych względem szerokości UI;
- nie każda metoda ma pełny lifecycle;
- niejasny wspólny engine wyniku.

Golden flow:

SWOT:
`choose → input/evidence → guided analysis → strengths/weaknesses/
opportunities/threats → synthesis → save/reopen → Initiative/Material`

### 12. Interview

Mamy:

- `/interview` i redirect `/discovery`;
- InterviewHub, starsze views i enterprise/V8 API;
- authoring pozostaje na `/api/interview`;
- insight baskets i znaczące testy.

Fragmentacja:

- authoring, V8 runtime, enterprise i insights;
- stare nazewnictwo Discovery;
- brak jednego dowodu publish/assignment/respond/approve/handoff.

Golden flow:

`author → publish → assign → respond → approve insight → Assessment/Initiative`

### 13. My Work

Mamy:

- hub z wieloma zakładkami;
- Vault i Agent jako przeniesione zakładki;
- My Work routes, Notebook v4/V8 i rozbudowane agregaty;
- bardzo dużo testów i modeli.

Fragmentacja:

- kilka generacji Notebook;
- agregacja może dublować dane właścicieli;
- wiele narzędzi Ideas;
- historyczne deep linki i flagi.

Golden flow:

`receive assigned work → understand source → act → owner-lane read-back →
personal state updates`

### 14. Chat

Mamy:

- kanoniczny UnifiedChatPanel;
- conversations, chat projects, sharing, AI, Canvas i artifacts;
- testy tras/policy/UI.

Fragmentacja:

- Canvas/V10 i legacy redirect;
- bogate proposal/action/artifact primitives bez pełnego owner-lane E2E;
- cztery znane regresje testów celowanych.

Golden flow:

`conversation → sourced answer → selected proposal → approval → owner object →
read-back`

Canvas jest docelowo elastyczną powierzchnią współpracy podobną do Canvas
Anthropic, a nie wyłącznie edytorem dokumentu. Może obsługiwać duże wyniki i
iteracje; zatwierdzony rezultat jest materializowany w module właścicielskim.

### 15–17. Settings, Admin, SuperAdmin

Ostatnia fala:

- scalić preferencje użytkownika, policy organizacji i control plane;
- potwierdzić capabilities oraz guardy po ustabilizowaniu obiektów domenowych;
- usunąć niespójne kontrolki i konfiguracje;
- wykonać globalny audit, observability i release gate.

## Fale wykonawcze

### Fala 0 — baseline i mapa

- `WK-P0-001`;
- `WK-P0-015`;
- freeze nowych równoległych implementacji;
- revision, test baseline i macierz ownerów.

### Fala 1 — dolne wejścia

Partner Portal, Organization, Meeting, Audits.

Cel: domknąć po jednym golden flow i ustalić realny status menu.

### Fala 2 — leżący rdzeń wartości

Materials, Finance, Results/KPI.

To jest najważniejsza fala produktowa. Najpierw ustalamy kanoniczne obiekty i
ownership, potem łączymy UI z istniejącym backendem.

### Fala 3 — wykonanie transformacji

Execution, Initiatives.

Cel: jeden nieprzerwany przepływ initiative → execution → result.

### Fala 4 — diagnoza i narzędzia

Assessment, Tools, Interview.

Cel: jeden wiarygodny przepływ evidence → insight/score → initiative.

### Fala 5 — osobisty system pracy

My Work, Chat.

Cel: wszystkie wcześniejsze obiekty są poprawnie agregowane i sterowane.

### Fala 6 — control plane

Settings, Admin, SuperAdmin, bezpieczeństwo, operacje i release.

## Reguła planowania agentów

Każdy moduł otrzymuje kolejno:

1. Discovery Agent — mapa fragmentów;
2. Product decision, jeśli wynik jest niejasny;
3. Backend/Data Agent — zamrożenie kontraktu;
4. Frontend/Integration Agent — pionowy slice;
5. Test Agent — niezależny E2E;
6. Security/Ops Agent — guardy i rollback;
7. Codex — integracja i verdict;
8. Piotr — odbiór biznesowy.

Nie uruchamiamy agentów frontend/backend równolegle, dopóki kontrakt nie jest
zamrożony.

## Kryterium zakończenia programu

Nie mierzymy liczby zamkniętych plików. Program kończy się, gdy priorytetowe
golden flows przechodzą pełną bramkę integracji i aplikacja ma jeden kanoniczny
runtime dla każdej pozycji menu.
