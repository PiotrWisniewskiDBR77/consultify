---
INSTRUKCJA: Część 3 z 3: T081–T122. Wklej po Part 2.
---

## T081 — 🟠 education — Education Module – Budgeting and Financial Planning (fundamental budgeting + forecasting assumptions discipline)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Budgeting adoption quality (realistic plans, fewer mistakes) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez edukacji użytkownicy budują nierealistyczne budżety i źle interpretują forecasty:
- mieszają “plan” z “actual”,
- nie rozumieją driverów i zależności,
- nie umieją komunikować niepewności i scenariuszy,
co psuje wiarygodność planowania i decyzji inwestycyjnych.

**Cel (outcome, nie feature):**
Użytkownik rozumie logikę budżetowania w platformie i potrafi:
- zbudować spójny budżet (driver-based),
- opisać assumptions i scenariusze,
- prowadzić dyscyplinę planowania (review/approval, zmiany, audit),
tak, aby output był sponsor‑grade i nie wymagał “ręcznej magii w Excelu”.

**Użytkownicy i scenariusze:**
- CFO/Controller: ocenia budżet, weryfikuje assumptions i spójność.
- PMO: łączy portfolio inicjatyw z budżetem i priorytetyzacją.
- Konsultant: tłumaczy klientowi “co oznaczają scenariusze” i jak ich używać w decyzjach.

**Scope (V2)**
- IN:
  - Budgeting & planning track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - “Budget types”: baseline vs forecast vs plan vs scenario,
      - driver-based planning: jak działa i dlaczego,
      - assumptions: jak je pisać (testowalne, mierzalne),
      - scenario discipline: base/optimistic/conservative + kiedy użyć,
      - governance: DRAFT→REVIEW→APPROVED, versioning i audit (T053),
      - plan vs actual: jak czytać odchylenia i wyciągać wnioski (T042),
      - powiązanie z inicjatywami: koszty/ROI i konsekwencje (T046/T054).
  - Platform walkthroughs (MUST):
    - deep linki do:
      - Budgeting workspace (T053),
      - budżety/limity/plan vs actual (T042),
      - financial model events (T054) jako “skąd się bierze liczba”.
  - “Assumption quality checklist” (MUST):
    - krótka checklista (10–15 punktów) np.:
      - czy assumption ma ownera,
      - czy ma źródło (dane/benchmark/ekspert),
      - czy ma zakres czasu i jednostki,
      - czy widać wpływ na output.
  - Guardrails & disclaimers (MUST):
    - rozdzielenie facts/assumptions,
    - brak “investment advice” i regulowanych rekomendacji.
  - Surface + tracking (MUST):
    - Education/KB + kontekstowe skróty w Finance/Budgeting,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Zaawansowane kursy controllingowe i branżowe standardy rachunkowości.
- Future enhancements (post‑V2):
  - interaktywne ćwiczenia “build a budget” na demo danych,
  - benchmark-driven assumption suggestions (guardrailed).

**Data / integrations (grounded in roadmap):**
- Treści muszą być spójne z:
  - T053 (budgeting artifact + workflow),
  - T042 (plan vs actual control),
  - T054 (model relacje i walidacje),
  - T050/T052 (wejścia: statements/insights).

**Analytics (events/metrics):**
- `education_budgeting_opened`
- `education_budgeting_module_completed`
- KPI: mniej błędów w budżetach, wyższa jakość assumptions (review feedback) (TBD).

**Risks:**
- Złożoność tematu → V2 stawia na fundamentals + checklisty, a nie podręcznik controllingu.

**Open questions:**
- Czy w V2 uczymy tylko “budżet roczny”, czy też rolling forecast? (proponuję: roczny + wzmianka o rolling jako post‑V2)

**Definition of Done (DoD):**
- Materiały “Budgeting & Planning” są dostępne w Education i/lub kontekstowo w Finance/Budgeting.
- Treść jest spójna z T053 i uczy dyscypliny assumptions/scenarios.

**Acceptance / test plan:**
- Test: user w Budgeting ma skrót “Learn” → trafia do właściwej lekcji o assumptions/scenarios.
- Test: checklist “assumption quality” jest dostępna i używalna (do wydruku / jako lista).

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem rozszerzenie o rolling forecast.

---

## T082 — 🟠 education — Education Module – ROI Analysis and Investment Evaluation (ROI literacy + decision discipline, grounded in platform)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: ROI quality & prioritization discipline TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
ROI jest kluczowe dla priorytetyzacji inicjatyw, ale bez edukacji użytkownicy:
- wpisują “ładne liczby” bez założeń,
- mylą ROI z NPV/IRR/payback,
- nie rozumieją ryzyka i niepewności,
co psuje decyzje i wiarygodność programu transformacji.

**Cel (outcome, nie feature):**
Użytkownik rozumie metody oceny inwestycji i potrafi w platformie:
- zdefiniować ROI w sposób audytowalny (assumptions + źródła),
- czytać i interpretować wyniki (z niepewnością),
- używać ROI do decyzji i governance (approve/stop/resequence).

**Użytkownicy i scenariusze:**
- Sponsor: wybiera inicjatywy do finansowania na bazie spójnych kryteriów.
- CFO/Finance: weryfikuje założenia i spójność z finansami.
- PMO: zarządza portfelem i komunikuje “dlaczego to jest priorytet”.

**Scope (V2)**
- IN:
  - ROI & investment evaluation track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - ROI vs NPV vs IRR vs payback: kiedy które,
      - baseline vs incremental impact (co liczymy),
      - CAPEX/OPEX i timing cash flows,
      - uncertainty: scenariusze, zakresy, confidence (bez udawania “prawdy”),
      - “assumption quality”: jak pisać i jak je testować,
      - interpretacja i komunikacja: jak opowiadać sponsorowi bez overclaim,
      - jak zamienić ROI na governance decyzje (approve/stop/iterate).
  - Platform grounding (MUST):
    - materiały odnoszą się do konkretnych flow:
      - ROI tracking & validation (T046),
      - initiative economics / CAPEX/OPEX (inicjatywy),
      - financial modeling events (T054) jako “skąd się bierze liczba”,
      - KPI mapping/attribution (T047/T048) jako “dowód realizacji”.
    - deep linki do tych ekranów.
  - ROI templates & checklists (MUST):
    - checklist “ROI assumptions” (10–15 punktów),
    - minimalny zestaw “ROI methods chooser” (kiedy ROI vs NPV vs payback),
    - przykłady (case) w formie krótkich kart (TBD minimal: 2 case).
  - Guardrails & disclaimers (MUST):
    - brak porad inwestycyjnych regulowanych,
    - komunikacja “assistive, assumptions-based”,
    - rozdzielenie facts vs assumptions.
  - Surface + tracking (MUST):
    - Education/KB + kontekstowe skróty w ROI/Benefits/Initiatives,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Regulowane doradztwo inwestycyjne.
  - Pełne kursy controllingowe/finance academy.
- Future enhancements (post‑V2):
  - interaktywne ćwiczenia “build ROI” na demo danych,
  - AI coaching do poprawy assumptions (guardrailed) + review workflow.

**Data / integrations:**
- Spójność z modułami:
  - T046 (ROI tracking/validation),
  - T047–T049 (KPI mapping → finance mapping),
  - T054 (model events i spójność),
  - T060/T058 (jak pokazać ROI w raporcie/decku).

**Analytics (events/metrics):**
- `education_roi_opened`
- `education_roi_module_completed`
- KPI: lepsza jakość założeń ROI, mniej “magic numbers” (review feedback) (TBD).

**Risks:**
- Metody (NPV/IRR) mogą budzić oczekiwania “investment advice” → jasne disclaimers i framing “internal decision support”.

**Open questions:**
- Czy w V2 uczymy IRR i NPV “praktycznie” czy tylko konceptualnie? (proponuję: konceptualnie + 1 przykład, pełna praktyka post‑V2)

**Definition of Done (DoD):**
- Materiały ROI są dostępne i odnoszą się do realnych ekranów/flow w platformie.
- Użytkownik rozumie assumptions i interpretację wyników oraz różnice ROI/NPV/IRR/payback.

**Acceptance / test plan:**
- Test: user w ROI/Benefits klika “Learn” → trafia do właściwej lekcji (ROI vs NPV).
- Test: checklist assumptions jest dostępna (do wydruku / jako lista) i nie zawiera regulowanych rekomendacji.

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem case studies i więcej metod.

---

## T083 — 🟠 education — Education Module – KPI System Design and Performance Architecture (cause→effect + KPI↔initiatives↔finance)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: KPI discipline (less chaos, better benefits tracking) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
KPI bez architektury prowadzą do chaosu:
- za dużo wskaźników bez priorytetu,
- brak baseline/target i ownerów,
- brak spójnego powiązania z inicjatywami i finansami,
co uniemożliwia rzetelne mierzenie efektów transformacji.

**Cel (outcome, nie feature):**
Użytkownik potrafi zaprojektować sensowny system KPI i wdrożyć go w platformie:
- KPI mają definicje, częstotliwość, baseline/target,
- istnieje logiczny łańcuch cause→effect (KPI drivers),
- inicjatywy są mapowane do KPI (T047),
- KPI są mapowane do finansów (T049) i wspierają ROI (T046).

**Użytkownicy i scenariusze:**
- Management: chce 10–20 KPI “North Star + drivers” zamiast 200 metryk.
- PMO: mapuje inicjatywy do KPI i pilnuje aktualizacji.
- Analityk: buduje definicje KPI i dba o spójność jednostek/danych.

**Scope (V2)**
- IN:
  - KPI architecture track (MUST):
    - 6–10 lekcji (PL+EN), minimum:
      - KPI taxonomy: outcome vs driver vs activity,
      - definicja KPI: unit, cadence, owner, data source,
      - baseline/target i “measurement integrity”,
      - cause→effect (driver tree) i unikanie “proxy madness”,
      - mapping KPI↔initiatives (T047) i jak to robić dobrze,
      - KPI↔finance mapping (T049): kierunek wpływu, formuły, assumptions,
      - attribution vs causality (T048 guardrails): jak mówić uczciwie.
  - Platform grounding (MUST):
    - lekcje odnoszą się do realnych ekranów:
      - KPI create/edit (np. `KPICreateModal`),
      - Benefits/KPI hub (T047),
      - initiative KPI section (T047),
      - finance mapping (T049),
    - deep linki do właściwych miejsc.
  - Checklists & examples (MUST):
    - “KPI definition checklist” (10–15 punktów),
    - 2–3 przykłady KPI driver chains (np. On-time delivery → WIP → changeover time),
    - “anti-patterns” (np. KPI bez ownera, bez jednostki, bez baseline).
  - Surface + tracking (MUST):
    - Education/KB + skróty kontekstowe w Benefits/KPI/Initiatives,
    - progress per user (reuse help events / KB videos).
- OUT:
  - Pełne szkolenia OKR/BI i branżowe biblioteki KPI (post‑V2).
- Future enhancements (post‑V2):
  - KPI templates per industry,
  - KPI data integrations (ERP/BI) i automatyczne aktualizacje.

**Data / integrations:**
- Treści muszą być spójne z:
  - T047 (initiative↔KPI mapping i time series),
  - T048 (attribution guardrails),
  - T049 (KPI↔financial statement mapping),
  - T046 (ROI validation).

**Analytics (events/metrics):**
- `education_kpi_opened`
- `education_kpi_module_completed`
- KPI: więcej inicjatyw z poprawnym KPI mapping; mniej “dead KPIs” bez aktualizacji.

**Risks:**
- Zbyt akademickie treści → V2: krótkie, “do it now”, checklists.

**Open questions:**
- Czy w V2 dołączamy 1 “executive cheat sheet” (1 strona) dla sponsorów? (proponuję: tak, jako PDF/printable)

**Definition of Done (DoD):**
- Materiały wyjaśniają jak budować KPI system i jak to robić w platformie (T047/T049).
- Są przykłady i checklisty, a treści nie obiecują integracji danych jeśli jej nie ma.

**Acceptance / test plan:**
- Test: user w Benefits/KPI klika “Learn” → otwiera lekcję “Outcome vs driver KPI”.
- Test: checklist definicji KPI jest dostępna (printable) i prowadzi do poprawnie zdefiniowanego KPI.

**Rollout plan:**
- Najpierw 6 lekcji core + checklisty, potem templates branżowe (post‑V2).

---

## T084 — 🟠 education — Education Module – Building Presentations in the Platform (T058/T059 walkthroughs, Gamma‑style)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Presentation adoption (less frustration, more deck exports) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Generator prezentacji (T058) i templates (T059) mają wysoki potencjał, ale bez instrukcji użytkownicy:
- nie rozumieją “jak z artefaktów zrobić deck”,
- próbują używać generatora jak WYSIWYG,
- nie potrafią iterować outline i promptować zmian układu,
co kończy się frustracją i ręcznymi poprawkami.

**Cel (outcome, nie feature):**
Użytkownik potrafi krok po kroku:
- wybrać scope i źródła (artefakty w platformie),
- wygenerować outline, poprawić go i iterować,
- wygenerować deck sponsor‑grade,
- wyeksportować PPTX i rozumie “jak minimalizować manual fixes”.

**Użytkownicy i scenariusze:**
- Konsultant: robi deck “Assessment summary” dla klienta z DRD/SIRI/ADMA.
- Sales: robi “Research → pitch” na bazie kontekstu i narzędzi.
- PMO: robi “Steering committee update” z inicjatyw/execution/KPI.

**Scope (V2)**
- IN:
  - Presentation generator training track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “What makes a good deck” (1 key message/slide),
      - selection of sources (approved artifacts),
      - outline-first workflow (jak edytować outline),
      - iterations: “regenerate section/slide”, “split slide”, “change tone/audience”,
      - grounding & citations (jak wymuszać źródła i czego nie obiecywać),
      - export & QA (PPTX hygiene: overflow, fonts, visuals).
  - Platform walkthroughs (MUST):
    - 3 kompletne przykłady end‑to‑end:
      - research → deck,
      - finance → deck,
      - initiatives/execution → deck,
    - każdy przykład:
      - wybór template (T059),
      - outline,
      - 2 iteracje zmian,
      - export PPTX.
  - “Common fixes” playbook (MUST):
    - checklista: “co zrobić gdy deck jest za długi / za szczegółowy / brak wizualizacji / brak closure”.
  - Contextual entrypoints (MUST):
    - w miejscu generatora prezentacji: link “Learn: building decks”,
    - z Report Builder (T060) i z narzędzi/assessment: link “Turn this into a deck”.
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Zaawansowane szkolenia z designu prezentacji (typografia, brand design) — post‑V2.
- Future enhancements (post‑V2):
  - “deck review mode” (AI QA checklist + suggested fixes),
  - branżowe playbooki decków.

**Data / integrations (grounded in roadmap):**
- Treści muszą być spójne z:
  - T058 (Gamma.app‑level workflow: outline → iterate → export),
  - T059 (templates/brand kits),
  - T071 (citations/grounding),
  - export pipeline (`PptxPipelineService`) jako “jak działa jakość layoutu” (na poziomie konceptu).

**Analytics (events/metrics):**
- `education_presentations_opened`
- `education_presentations_module_completed`
- KPI: więcej wygenerowanych decków, mniej frustracji, mniej manualnych poprawek (self-report).

**Risks:**
- UI generatora będzie się zmieniać → treści muszą być modularne i łatwe do aktualizacji.

**Open questions:**
- Czy V2 ma mieć osobną lekcję “Deck types” (strategic review vs steering vs valuation) czy zostawić jako przykłady? (proponuję: jako przykłady)

**Definition of Done (DoD):**
- Materiały prowadzą przez typowy proces generowania decka w platformie.
- Treści są spójne z UI i aktualnymi funkcjami T058/T059.

**Acceptance / test plan:**
- Test: user przechodzi walkthrough “initiatives → deck” i jest w stanie wyeksportować PPTX bez ręcznego poprawiania layoutu (poza branding drobnymi).
- Test: materiały uczą iteracji outline i pracy z grounding/citations.

**Rollout plan:**
- Najpierw 1 walkthrough (initiatives→deck) + core lekcje, potem pozostałe 2 przykłady.

---

## T085 — 🟠 education — Education Module – Report Template Design and Usage (T060/T061: sponsor‑ready reports, step‑by‑step)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Report adoption & quality (premium visuals, less rework) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Żeby raporty były profesjonalne, user musi rozumieć:
- jak dobrać template do odbiorcy,
- jak ustawić scope i sekcje,
- jak iterować treść i układ (agent‑style) bez chaosu,
inaczej kończy się to ręcznym poprawianiem, długim czasem i niespójnymi deliverables.

**Cel (outcome, nie feature):**
Użytkownik potrafi wygenerować raport **sponsor‑ready** w platformie:
- dobiera template (T061),
- konfiguruje strukturę (T060),
- iteruje z agentem (T060 agent mode) i pilnuje grounding,
- eksportuje PDF/DOCX bez “naprawiania layoutu”.

**Użytkownicy i scenariusze:**
- Konsultant: “Assessment Summary” (DRD/SIRI/ADMA) → raport dla klienta.
- PMO: “Steering Committee Brief” → cykliczny status.
- CFO: “Financial Analysis” → raport z ratios/insights + next steps.

**Scope (V2)**
- IN:
  - Report Builder training track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - source selection: co jest “approved source” i dlaczego,
      - template selection (T061): jak wybrać właściwy,
      - structure config: sekcje/bloki i kolejność,
      - agent mode: jak wydawać polecenia do zmiany układu/sekcji i jak czytać diff,
      - grounding/citations: jak unikać halucynacji i jak weryfikować,
      - export QA: PDF/DOCX hygiene (spisy treści, długość, closure).
  - Walkthroughs (MUST):
    - 2–3 przykłady end‑to‑end:
      - initiatives/execution → status report,
      - assessment → summary report,
      - finance → analysis report,
    - każdy przykład: template → configure → generate → 2 iteracje agentem → export.
  - Stakeholder best practices (MUST):
    - “Audience cards” (sponsor/PMO/CFO):
      - co musi być w raporcie,
      - jaki ton i długość,
      - jakie “next steps / closure”.
  - Contextual entrypoints (MUST):
    - w Report Builder UI: link “Learn: sponsor‑ready reports”,
    - z modułów (Assessment/Initiatives/Finance): link “Turn this into a report”.
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Pełny kurs technical writing i edycji redakcyjnej.
- Future enhancements (post‑V2):
  - “Report QA mode” (checklist + AI suggestions),
  - więcej szablonów branżowych.

**Data / integrations (grounded in roadmap/codebase):**
- Spójność z:
  - T060 (Structured Report Generator + agent mode),
  - T061 (Standardized Business Report Templates),
  - T071 (docs grounding/citations),
  - istniejący UI: `src/components/ReportBuilder/*` (wizard, template picker, editor).

**Analytics (events/metrics):**
- `education_reports_opened`
- `education_reports_module_completed`
- KPI: więcej eksportów PDF/DOCX, mniej ręcznych poprawek (self-report), szybszy time-to-export.

**Risks:**
- Zakres “customize” w generatorze będzie ewoluował → treści modularne i łatwe do aktualizacji.

**Open questions:**
- Czy V2 ma uczyć “jak projektować własny template” czy tylko “jak używać”? (proponuję: tylko używać; projektowanie post‑V2)

**Definition of Done (DoD):**
- Materiały są dostępne i powiązane z UI generatora raportów.
- Użytkownik potrafi wygenerować raport “sponsor‑ready” z template’ów i wyeksportować.

**Acceptance / test plan:**
- Test: user przechodzi walkthrough “assessment → report” i eksportuje PDF/DOCX bez ręcznego poprawiania układu.
- Test: lekcje uczą agent‑mode iteracji (dodaj sekcję, zmień kolejność, skróć rozdział) i weryfikacji grounding.

**Rollout plan:**
- Najpierw 1 walkthrough + core lekcje, potem pozostałe przykłady i audience cards.

---

## T086 — 🔵 admin — Build Unified Sync Hub for External Work Systems (integrations command center)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Integrations & synchronization foundation TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Konsultanci i zespoły pracują równolegle w wielu narzędziach (komunikatory, kalendarze, email, storage, task managers). Bez jednego “sync hub”:
- admin nie widzi stanu połączeń i zdrowia synchronizacji,
- użytkownicy nie wiedzą “czy to działa”,
- rośnie chaos integracyjny i ryzyko bezpieczeństwa (tokeny, scope, webhooks).

**Cel (outcome, nie feature):**
Jest jedno, spójne miejsce w aplikacji do:
- konfiguracji i zarządzania integracjami,
- monitorowania health i historii sync runów,
- podstawowych akcji operacyjnych (connect / re‑auth / pause / run now / disconnect),
z jasną kontrolą uprawnień, scope’ów i audytem.

**Użytkownicy i scenariusze:**
- Admin org: łączy Slack + Google Workspace, widzi statusy, robi reauth, patrzy na błędy.
- PMO: chce wiedzieć czy import z Jira działa i kiedy był ostatni sync.
- Security/IT: chce wiedzieć jakie scope’y są nadane i móc odłączyć integrację.

**Scope (V2)**
- IN:
  - Unified “Integrations Hub” UI (MUST):
    - kanoniczny ekran w Admin/Settings (TBD routing) z sekcjami:
      - **Connected apps** (Slack/Teams/Jira/…): status, last sync, actions,
      - **Webhooks**: endpoints + subscriptions, signing secret, test event,
      - **Sync health**: ostatnie runy, błędy, retry,
      - **Permissions & scopes**: co integracja może czytać/pisać.
    - UX (Notion/ClickUp-level) (MUST):
      - lekkość i przejrzystość: **ClickUp-style table** jako domyślny widok (wyszukiwanie, filtry, sort, status chips),
      - akcje “inline” bez przeładowań (Connect / Re-auth / Pause / Run now / Disconnect),
      - czytelne stany: connected / pending / requires reauth / error + “what happened”,
      - szybkie “details drawer” z logami sync runów (jak w dużych SaaS),
      - **zero dummy danych** i “symbolicznych formułek” — wszystko z realnego API.
  - API & data model (grounded in codebase) (MUST):
    - wykorzystać istniejące endpointy i ujednolicić zachowanie:
      - `server/src/routes/integrations/integrations.routes.ts` (list/connect/disconnect/sync),
      - `server/src/routes/integrations/connectors.routes.ts` (connectors registry),
      - `server/src/services/integrationHubService.ts` (connector catalog + status model),
      - integracje webhooks: `server/src/routes/integrations/webhooks.routes.ts` + `webhookSubscriptions.routes.ts` (już są w repo).
    - zapewnić spójny status model:
      - connected / disconnected / error / requires_reauth / pending.
  - Sync runs + health monitoring (MUST):
    - dla każdej integracji:
      - last sync time,
      - ostatni wynik (success/failed + error summary),
      - przycisk “Run now”,
      - pause/resume (dla scheduled pulls/pushes),
    - historia runów min. 20–50 ostatnich (TBD retention).
  - Security & compliance (MUST):
    - least‑privilege: jasno pokazane scope’y,
    - bezpieczne przechowywanie sekretów/tokenów (encrypted at rest),
    - audit log: kto podłączył/odłączył, kto zrobił reauth, kto zmienił settings,
    - webhook security: signing secret + replay protection (TBD minimal).
  - “Minimal, but real” connector set (V2) (MUST):
    - V2 ma dostarczyć **realnie działające** integracje w kluczowych kategoriach (end‑to‑end, widoczne w hubie, bez stubów).
    - **Docelowa lista “Top 4” dostawców per kategoria (MUST target list):**
      - **Komunikatory (Top 4)**:
        - Slack
        - Microsoft Teams
        - WhatsApp
        - Google Chat
      - **Kalendarze (Top 4)**:
        - Google Calendar
        - Microsoft Outlook / Microsoft 365 Calendar
        - Apple Calendar (iCloud)
        - Generic CalDAV (dla pozostałych providerów enterprise)
      - **PMO / task managers (Top 4)**:
        - Jira
        - ClickUp
        - Asana
        - Monday.com
      - **Chmury / storage (Top 4)**:
        - Google Drive
        - Microsoft OneDrive / SharePoint
        - Dropbox
        - Box
      - **Maile (Top 4)**:
        - Gmail / Google Workspace
        - Microsoft Outlook / Microsoft 365
        - Zoho Mail
        - Generic IMAP/SMTP (dla pozostałych providerów)
    - **V2 minimal (twarde minimum jakości):**
      - co najmniej **1 integracja per kluczowa kategoria** powyżej ma działać end‑to‑end i być “demoable”,
      - reszta z listy Top 4 może być “coming soon”, ale tylko jeśli UI jasno to komunikuje (bez udawania działania).
    - V2 minimal (twarde minimum jakości): **co najmniej 1 integracja per kluczowa kategoria** powyżej ma działać end‑to‑end i być “demoable”.
    - pozostałe mogą być oznaczone jako “coming soon”, ale tylko jeśli UI nie sugeruje, że “działa”.
  - Error handling & UX (MUST):
    - czytelne komunikaty błędów (reauth required, invalid scopes, rate limit),
    - retry policy + manual retry.
- OUT:
  - Pełne wsparcie “wszystkich vendorów” i custom connectors w V2.
  - Zaawansowane, dwukierunkowe mapowania danych dla każdego systemu (post‑V2).
- Future enhancements (post‑V2):
  - “Sync policies” per project (co syncujemy i gdzie),
  - event‑driven sync (webhooks) vs polling,
  - data mapping UI (field mapping) dla zaawansowanych integracji.

**UX / UI notes (grounded in codebase):**
- Frontend ma już panel startowy: `src/components/Admin/IntegrationsManagementPanel.tsx` (webhooks + connected apps),
  - V2: podpiąć go do realnych endpointów (zamiast `SAMPLE_WEBHOOKS` i placeholderów).
 - UI ma trzymać standard “duże SaaS”:
   - app-table/module hub patterns z `docs/ui-standards/03-modules/app-table-standard.md`,
   - “Tech Sexy” (invisible borders, monochromatic chrome), bez ciężkich kart i bez przypadkowych kolorów.

**Analytics (events/metrics):**
- `integration_connected` / `disconnected`
- `integration_reauth_required` / `reauth_completed`
- `integration_sync_run_started` / `completed` (success/fail, provider)
- KPI: liczba aktywnych integracji, sync health, spadek “integration confusion”.

**Risks:**
- Złożoność + bezpieczeństwo → twarde scope, audit, encryption, rate limiting.
- Rate limits vendorów → backoff + throttling + caching.

**Open questions:**
- Które integracje z listy “Top 4” są MUST “end‑to‑end” w pierwszym releasie V2:
  - proponuję baseline demo: **Slack + Google Calendar + Jira + Google Drive + Gmail** (po 1 na kategorię), reszta “coming soon”.

**Definition of Done (DoD):**
- Jest jedno miejsce “Integrations Hub” z realnymi danymi: connected apps + webhooks + sync health.
- Admin może: connect, reauth, pause/resume, run now, disconnect.
- System przechowuje i pokazuje statusy + historię runów + audyt.
 - Nie ma żadnych “fake” integracji w UI: jeśli coś nie działa, jest oznaczone jako coming soon/disabled i nie udaje aktywnej funkcji.
 - Co najmniej 1 integracja per kluczowa kategoria (comms/calendar/PMO/cloud/email) działa end‑to‑end w V2 środowisku.

**Acceptance / test plan:**
- Test: admin podłącza Slack → wysyła test message → status “connected” + last action log.
- Test: admin uruchamia “Run now” dla integracji → widać sync run w historii (success/fail).
- Test: reauth required → UI pokazuje przyczynę i prowadzi do reautoryzacji.
 - Test: UI hubu ma tabelę z search/filter/sort i działa płynnie (bez “klocków” i bez dummy data).

**Rollout plan:**
- Najpierw hub + statusy + jedna integracja end‑to‑end, potem kolejne 2 i webhooks panel.

---

## T087 — 🩷 demo — Create Demo Company Story – Archilex (narrative backbone for demo)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo readiness (Archilex) TBD
- Priorytet / V2 scope: V2

**Cel:**
Stworzyć spójną, fikcyjną historię firmy demo “Archilex”, która jest podstawą dla:
- scenariuszy demo,
- datasetu demo (T089),
- strony demo (T088),
tak aby demo było wiarygodne i “prowadziło” przez product flow.

**Zakres (V2):**
- IN (deliverables):
  - 1 dokument “Archilex story” (2–5 stron) zawierający:
    - profil firmy (branża, skala, geografie, kluczowe produkty/usługi),
    - 5–8 głównych problemów (strategia/operacje/digital/change/finanse),
    - cele transformacji (3–6) + KPI (10–20) (high-level),
    - roadmap “journey” (etapy 6–18 mies.) + kluczowe inicjatywy (8–15),
    - sponsor + PMO + change team (role i napięcia),
    - “demo storyline” (kolejność kroków w demie: tools/assessment → initiatives → execution → reports/decks),
  - 3 krótkie scenariusze demo (po 5–10 min):
    - “Executive overview”,
    - “Deep dive: initiatives & execution”,
    - “Deep dive: finance & ROI”.
- OUT:
  - Produkcja filmu.

**Zależności:**
- T088 (demo website) korzysta z tego story.
- T089 (demo dataset) ma być 1:1 spójny z narracją.
- T095 (visuals/screenshots) – jeśli występuje – ma wynikać ze scenariuszy.

**Definition of Done (DoD):**
- Dokument story istnieje i jest spójny (brak sprzeczności między problemami→celami→KPI→inicjatywami).
- Scenariusze demo są wykonalne w produkcie (bez “obietnic” feature’ów, których nie ma).

**Acceptance / test plan:**
- Test: osoba nieznająca produktu jest w stanie przeczytać story i przeprowadzić 10‑min demo według scenariusza.

---

## T088 — 🩷 demo — Develop Demo Website for Archilex Transformation (case context page)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo credibility & narrative TBD
- Priorytet / V2 scope: V2

**Cel:**
Strona demo “Archilex” opisująca journey transformacji (challenge → solution → results) jako “case context” dla demo i VC.

**Zakres (V2):**
- IN (deliverables):
  - 1 strona (publiczna lub dostępna w demo env) z sekcjami:
    - **Challenges** (5–8 punktów),
    - **Solutions / Program** (etapy + inicjatywy high‑level),
    - **Results** (KPI + narracja “what improved”),
    - “See it in platform” CTA (linki do demo login / konkretnych modułów),
  - spójność języka i liczb z T087 (story) i T089 (dataset),
  - assets: 6–12 screenshotów/visuals (T095) (jeśli dostępne) lub placeholdery.
- OUT:
  - Publiczne SEO i pełny marketing site.

**Implementation notes (lightweight):**
- Prefer reuse istniejących public views/layout:
  - `src/views/PublicLandingPage.tsx` (style/sections)
  - `src/views/ToolsShowcasePage.tsx` (karty/CTA/video modal pattern)
- Route: TBD (np. `/demo/archilex`).

**Definition of Done (DoD):**
- Strona jest dostępna i wspiera scenariusze prezentacji (da się na niej “ustawić kontekst” w 2–3 min).
- Nie ma sprzeczności z datasetem demo i zachowaniem aplikacji.

**Acceptance / test plan:**
- Test: prowadzący demo otwiera stronę → w 2 min ustawia kontekst, potem przechodzi do aplikacji po CTA.

---

## T089 — 🩷 demo — Build Comprehensive Demo Dataset – Archilex (realistic, deterministic, 0 dead ends)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Demo environment readiness TBD
- Priorytet / V2 scope: V2

**Cel:**
Kompletny, realistyczny dataset “Archilex” umożliwiający przejście przez kluczowe scenariusze demo bez pustych ekranów i bez “broken flows”.

**Zakres (V2):**
- IN (deliverables):
  - deterministyczny seed datasetu (idempotent):
    - stałe IDs (łatwe deep-linki i testy),
    - opcja `--clean` i `--verify` (jak w istniejącym `seedLegolexDemoOrg.js`),
    - blokada przed produkcją (PRODUCTION GUARD),
  - użytkownicy demo (MUST):
    - 3–4 konta (deterministyczne IDs) z różnymi rolami i “perspektywą”:
      - **Admin/Owner** (pełny dostęp, pokazuje konfigurację, integracje, billing/trial),
      - **PMO / Program Manager** (Initiatives/Execution/Benefits, governance),
      - **CFO/Finance** (Finance/ROI/valuation/reporting; read/write tam gdzie potrzebne),
      - (opcjonalnie) **Consultant** (Tools/workshops, report/deck generator),
    - każde konto ma:
      - przypisanie do tej samej organizacji Archilex,
      - prekonfigurowany “landing context” (np. pinned items / recent artifacts) (TBD minimal).
  - dane pokrywające kluczowe moduły (minimum):
    - Organization profile/context (T063 / context builder) – podstawowe informacje firmy,
    - Projects (2–4) + roles/members,
    - Initiatives (12–18) w różnych statusach (draft/planning/executing/done/cancelled), w tym:
      - 3 “hero initiatives” z pełnym powiązaniem (tasks+decisions+RAID+KPI+ROI),
      - 3 w execution (żeby było co monitorować),
      - 2 zakończone (benefits realized),
      - 2 zablokowane (risk/decision dependency),
      - reszta jako tło portfolio (różne osie: strategic/operational/digital/change/finance),
    - Execution:
      - tasks (45–70) (mix: overdue, blocked, done, w trakcie),
      - decisions (12–20) (mix: pending, approved, escalated),
      - RAID (12–20) (mix: risk/issue, różne severity),
    - Benefits/KPI:
      - KPI (14–22) + mapping do inicjatyw (T047) + kilka history points (jeśli model wspiera),
    - ROI/economics: CAPEX/OPEX/ROI assumptions na części inicjatyw (T046),
    - Reports/decks:
      - min. 3 gotowe artefakty (np. assessment summary report, steering brief, finance snapshot),
      - min. 2 decki (np. executive overview, initiatives update),
      - (mogą być pre-seeded jako “instances”),
    - Tools sessions:
      - 6–10 sesji narzędzi (T019–T021 / Discovery Tools) z wynikami i closure,
      - minimum 2 sesje “completed” z wygenerowanymi inicjatywami,
  - spójność 1:1 z T087 (story) i T088 (demo website):
    - te same nazwy, KPI, inicjatywy, “wyniki” (bez sprzeczności).
- OUT:
  - Import/export datasetów klientów (osobny temat).

**Implementation notes (lightweight but concrete):**
- Reuse wzorce z istniejących seedów:
  - `server/scripts/seedLegolexDemoOrg.js` (determinism, clean/verify, guards),
  - `server/scripts/seed-demo-initiatives.js` (inicjatywy),
  - `server/src/routes/demo.routes.ts` (demo mode / org info).
- Prefer 1 skrypt “seed-archilex-demo-org.(ts/js)” jako single entrypoint, który woła mniejsze seedery (modularnie).

**Definition of Done (DoD):**
- Dataset pozwala przejść przez główne demo ścieżki bez pustych widoków:
  - tools/assessment → initiatives → execution → benefits/ROI → report/deck.
- Seed jest idempotent (można uruchomić wielokrotnie bez dublowania).
- Jest check/verify mode, który raportuje brakujące elementy datasetu.

**Acceptance / test plan:**
- Test: “0 dead ends” checklist:
  - każdy moduł ma realne rekordy (nie tylko placeholder),
  - co najmniej 3 inicjatywy mają pełne powiązania (tasks + decisions + RAID + KPI + ROI),
  - co najmniej 1 report i 1 deck są dostępne do pokazania,
  - demo mode toggle działa i przełącza na Archilex org.
- Test: seed `--verify` zwraca OK (brak braków).

---

## T090 — 🩷 demo — Design Demo-to-Trial Conversion Flow (demo → sign-up → trial activation, measurable)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Growth foundation (demo conversion) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Demo bez ścieżki konwersji nie monetyzuje: użytkownik ogląda, ale nie wie co dalej / nie ma “next step” i odpada.

**Cel (outcome, nie feature):**
Demo user ma jasną, nieagresywną ścieżkę:
- zobacz wartość (value moments),
- zrób 1–2 konkretne akcje,
- zarejestruj się i aktywuj trial,
z minimalnym tarciem i pełną mierzalnością.

**Scope (V2)**
- IN:
  - Conversion journey design (MUST):
    - definicja 3–5 “value moments” w demie (np.):
      - “AI chat understands context”,
      - “tool → closure → initiatives generated”,
      - “initiative → execution signals”,
      - “report/deck generated”,
    - po każdym value moment: jedno CTA “Continue / Next step” (nie paywall).
  - Demo CTA surfaces (MUST):
    - persistent “Start trial” button (subtelny, nie spam),
    - kontekstowe CTA w kluczowych punktach:
      - po wygenerowaniu raportu/decku,
      - po utworzeniu inicjatywy,
      - po ukończeniu tool session,
    - CTA pamięta “gdzie user był” (po trial wraca do tego miejsca) (TBD minimal).
  - Friction control (MUST):
    - sign-up flow skrócony (minimum pól),
    - możliwość kontynuacji od razu po rejestracji (bez “empty org” — prefill z onboarding wizard),
    - jasne komunikaty co jest w trial, a co nie (spójne z T091).
  - Instrumentation / analytics (MUST):
    - eventy end-to-end:
      - `demo_started`, `demo_value_moment_reached` (type),
      - `demo_cta_clicked` (location),
      - `signup_started`, `signup_completed`,
      - `trial_activated`,
    - funnel report (minimum: query/report, post‑V2: UI dashboard).
  - Integration with demo mode (MUST):
    - wykorzystać istniejący demo mode toggle (`/api/demo/*`) jako wejście,
    - po trial activation: wyjście z demo org do trial org, bez utraty “storyline”.
- OUT:
  - Pełny growth experimentation platform (A/B, segmenty).
- Future enhancements (post‑V2):
  - personalizacja CTA per persona (CFO vs PMO),
  - guided tour overlay,
  - “send me report/deck” gated by email (lead capture) (TBD).

**Risks:**
- Zbyt agresywne CTA → spadek zaufania (V2: subtelne, value-first).
- Za duże tarcie w rejestracji → spadek konwersji.

**Open questions:**
- Czy trial activation ma być:
  - (A) self-serve natychmiast,
  - (B) wymaga “request access” (sales-led)?
  (V2: rekomenduję A dla product-led, z opcją kontaktu sales.)

**Definition of Done (DoD):**
- Użytkownik ma jasną ścieżkę demo → trial i może aktywować trial.
- Flow jest mierzalny eventami i da się policzyć demo→trial conversion.

**Acceptance / test plan:**
- Test: demo user przechodzi 2 value moments → klika “Start trial” → rejestracja → trial aktywny → wraca do kontekstu.
- Test: eventy funnel są emitowane dla każdego kroku.

---

## T091 — 🟣 trial — Define Technical Trial Architecture and Access Rules (entitlements + quotas + honest gating)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization foundation (trial rules & enforcement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Trial musi pokazywać wartość, ale nie może oddawać wszystkiego za darmo. Jednocześnie nie może tworzyć “mystery blocks” — user musi rozumieć co jest zablokowane, dlaczego i co zrobić dalej.

**Cel (outcome, nie feature):**
W V2 mamy spójną, technicznie egzekwowaną architekturę trial:
- limity i gating są centralnie zdefiniowane,
- egzekwowane w API (nie tylko w UI),
- komunikaty są jasne i mierzalne,
- trial ma czytelne stany: active → warning → critical → expired → (upgrade).

**Scope (V2)**
- IN:
  - Canonical policy model (MUST):
    - orgType: DEMO / TRIAL / PAID (kanonicznie),
    - trial timing: `trial_started_at`, `trial_expires_at` + warning levels (T-7 / T-3 / expired),
    - limits per org:
      - max projects / users / initiatives,
      - max storage,
      - AI usage: daily calls + total token budget,
      - allowed AI roles (np. “ADVISOR”).
  - Enforcement points (MUST, grounded in codebase):
    - central policy check w backendzie (preferred: `AccessPolicyService.checkAccess` / `AccessTrialService`),
    - quota enforcement dla AI i uploadów (`quota.middleware.ts`) — spójne z trial budget,
    - demo mode = read-only (już istnieje w AccessPolicyService).
  - Trial conversion plumbing (MUST):
    - `/api/trial/:trialId/convert` ma działać (obecnie TrialService jest placeholderem),
    - implementacja `trialService` dla:
      - `convertTrialToOrg`,
      - `sendTrialWarnings` (T-7, T-3),
      - `processExpiredTrials` (lockdown/expiry),
    - cron (`TrialCron`) przestaje być “skip” i realnie wykonuje zadania.
  - Honest UX gates (MUST):
    - gdy akcja zablokowana:
      - zawsze zwracamy `errorCode` + “reason” + recommended next step,
      - UI pokazuje “why” + CTA upgrade (bez frustracji).
    - zakaz “symbolicznych formułek”: jeśli feature jest coming soon lub nie ma integracji, UI nie udaje działania.
  - Trial entitlements matrix (MUST):
    - V2 definiuje jawnie co jest:
      - allowed,
      - limited,
      - blocked,
    - minimum: trial pozwala przejść 3–5 “value moments” (T090), ale limity wymuszają upgrade przy realnym użyciu.
  - Anti‑abuse (MUST):
    - ochrona przed obchodzeniem limitów (np. multi-org spam, resetowanie),
    - rate limiting (już jest) + audyt akcji trial.
- OUT:
  - Pełny pricing experimentation system i dynamiczny paywall (post‑V2).

**Data / integrations (grounded):**
- W repo już istnieją fundamenty:
  - `server/src/services/access/AccessTypes.ts` (DEFAULT_TRIAL_LIMITS, ORG_TYPES, TRIAL_DURATION_DAYS),
  - `AccessLimitService`, `AccessTrialService`, `AccessUsageService`, `AccessPolicyService`,
  - `TrialCron` i `trial.routes.ts`,
  - `quota.middleware.ts` + `usageService.ts`.
- V2: doprowadzić do spójności “trial token budget”:
  - jedna prawda dla “tokens used” i “token limit” (TBD implementacja, ale musi być spójna w API + UI).

**Analytics (events/metrics):**
- `trial_started` / `trial_warning_shown` / `trial_expired`
- `trial_blocked_action` (errorCode, feature)
- `trial_upgrade_cta_clicked`
- KPI: activation, conversion, churn w trial; spadek “mystery blocks”.

**Risks:**
- Zbyt restrykcyjne limity → user nie zobaczy wartości.
- Zbyt luźne limity → brak motywacji do upgrade.

**Open questions:**
- Jakie limity V2 są docelowe (projekty/użytkownicy/inicjatywy/tokens)? (mamy defaulty w kodzie, ale trzeba je zatwierdzić biznesowo)

**Definition of Done (DoD):**
- Trial ma zdefiniowane limity i jest egzekwowany technicznie (API-first).
- Użytkownik rozumie zasady (jasne komunikaty) i nie trafia na “mystery blocks”.
- Trial warnings i expiry processing działają (cron + notifications).

**Acceptance / test plan:**
- Test: TRIAL org przekracza limit (np. initiatives lub tokens) → API blokuje z `errorCode`, UI pokazuje “why” + CTA.
- Test: T-7 i T-3 warning jest wysyłany, a po expiry org przechodzi w lockdown.
- Test: `/api/trial/:trialId/convert` działa i tworzy właściwą org po potwierdzeniu.

---

## T092 — 🟣 trial — Design Trial-to-Paid Conversion Path (upgrade mechanics + messaging + smooth checkout)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & conversion (trial → paid) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownik w trial widzi wartość, ale bez precyzyjnej ścieżki upgrade (kiedy, gdzie, dlaczego, jak) odpada w najgorszym momencie: przy limicie albo po expiry. Drugi problem: “agresywny paywall” psuje zaufanie. Potrzebujemy conversion path, który jest value‑first i jednocześnie skuteczny.

**Cel (outcome, nie feature):**
Trial user rozumie:
- **co zyskuje na paid** (konkretne odblokowania i podniesienie limitów),
- **kiedy powinien upgrade’ować** (trigger-based, nie losowo),
- **jak to zrobić** (checkout/procurement bez tarcia),
a produkt mierzy pełny lejek trial → paid.

**Scope (V2)**
- IN:
  - Upgrade triggers (MUST):
    - Trial expiry (T091) → read-only + banner + CTA upgrade.
    - “Approaching limit” (np. 70–90% usage) → subtelne ostrzeżenia + link do planów.
    - “Blocked action” (AccessPolicy / AccessBlockedModal) → CTA kontekstowe (“Upgrade / Add payment method”).
    - Intent-based: user wchodzi do `/settings/billing` i widzi jasne “next step”.
  - Value messaging & progressive unlocking (MUST):
    - komunikaty w UI muszą mówić “dlaczego” (np. “AI token budget exceeded” → “dodaj payment method dla PAYG/hybrid” albo “upgrade planu”),
    - brak “mystery blocks”: każda blokada ma `errorCode`, copy i CTA (spójne z T091),
    - upgrade copy jest spójne z value moments z T090 (user pamięta co już osiągnął).
  - Plan selection UX (MUST):
    - ekran porównania planów z limitami i benefitami (czytelnie: AI tokens, storage, seats, integracje, eksport),
    - jasna informacja “co się zmieni od razu po upgrade” (odblokowania + nowe limity),
    - obsługa kuponów/discount code (jeśli dostępne) + VAT/Tax settings dla firm.
  - Checkout + subscription lifecycle (MUST, grounded in existing stack):
    - flow: wybierz plan → dodaj metodę płatności → potwierdź → natychmiastowe odblokowanie,
    - obsługa statusów: `trialing` / `active` / `past_due` / `cancelled` (czytelne komunikaty i “co dalej”),
    - “payment failed” (dunning) → komunikat + szybkie naprawienie metody płatności.
  - Product instrumentation (MUST):
    - eventy:
      - `upgrade_viewed` (location),
      - `upgrade_cta_clicked` (reason: expired/limit/intent),
      - `plan_selected` (planId),
      - `checkout_started` / `checkout_completed` / `checkout_failed`,
      - `subscription_activated` / `subscription_cancelled`,
    - metryki: trial→paid conversion, time-to-upgrade, drop-off w checkout, top reasons for upgrade.
  - Comms (MUST):
    - email / in-app dla:
      - T-7, T-3 (warning),
      - expiry,
      - payment failed,
    - wiadomości muszą być krótkie, konkretne, “what next”.
- OUT:
  - Kompleksowe eksperymenty paywall (segmenty, A/B), zaawansowany pricing lab (post‑V2).

**Implementation notes (grounded w repo, bez “z kosmosu”):**
- UI i entrypoints już istnieją i wymagają dopięcia do spójnego conversion path:
  - `src/components/access/AccessBlockedModal.tsx` (CTA m.in. na `/settings/billing`),
  - `src/contexts/AccessPolicyContext.tsx` + `/api/organization/policy-snapshot` (banner + upgradeCtas),
  - `src/components/shared/BillingCore.tsx` i `src/components/settings/modules/BillingSubscriptionModule.tsx`,
  - backend: `server/src/routes/billing/billing.routes.ts` + Stripe webhooks (`server/src/routes/webhooks/stripe.routes.ts`).
- V2: “single narrative”:
  - T090 prowadzi do trial,
  - T091 egzekwuje limity,
  - T092 daje najlepszą możliwą ścieżkę wyjścia (upgrade) dokładnie w momentach, gdy user ma motywację.

**Risks:**
- Zbyt nachalne CTA → spadek zaufania (V2: value-first + trigger-based, bez spamowania).
- Checkout friction (VAT, payment methods) → drop-off.
- Niespójność planów/limitów (UI vs backend) → support load.

**Open questions:**
- Jakie są docelowe plany V2 (nazwy, ceny, limity) i czy dopuszczamy model hybrid/PAYG w trial (w kodzie jest już “payment method unlock beyond free budget” dla tokenów)?

**Definition of Done (DoD):**
- Trial user ma spójną, powtarzalną ścieżkę upgrade (z każdego głównego triggera).
- Checkout jest “smooth” i po sukcesie natychmiast odblokowuje dostęp (policy snapshot + gating się aktualizuje).
- Lejek trial→paid jest mierzalny end‑to‑end.

**Acceptance / test plan:**
- Test: TRIAL user przekracza limit tokenów → widzi jasny komunikat + CTA → dodaje payment method / wybiera plan → po sukcesie AI działa dalej.
- Test: trial expired → org read‑only → “Upgrade Now” prowadzi do planów → aktywacja subskrypcji przywraca write access.
- Test: payment failed → status `past_due` → user widzi “fix payment” i wraca do `active`.

---

## T093 — 🟢 landing — Legal Agreements Update and User Acceptance Flow Optimization (versioning + acceptances + low friction)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Trust & conversion foundation (legal + compliance UX) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez poprawnych, łatwo dostępnych umów i poprawnie zapisanych akceptacji ryzykujemy: compliance (GDPR/ToS), spory w billing/trial oraz drop-off w rejestracji, jeśli flow jest zbyt ciężkie. Dodatkowo w kodzie już istnieją elementy UI pod akceptacje, ale API jest niespójne/niekompletne, co grozi “mystery blocks” i 503.

**Cel (outcome, nie feature):**
W V2 mamy Legal Center + akceptacje “enterprise-grade”:
- legal docs są wersjonowane i publikowane z jednego źródła prawdy,
- wymagane akceptacje są egzekwowane po loginie / przy zmianie wersji,
- user widzi krótkie, jasne summary + może rozwinąć pełny tekst,
- akceptacje są zapisywane z metadanymi (czas, IP, UA) i audytowalne.

**Scope (V2)**
- IN:
  - Canonical document set (MUST):
    - minimum wymagane do użycia platformy: `TOS`, `PRIVACY`,
    - polityki użytkowania: `AUP`, `AI_POLICY` (wymagane jeśli AI jest dostępne),
    - `COOKIES` (informacyjne, acceptance zależne od jurysdykcji / ustawień),
    - `DPA` (org-level, akceptuje admin/owner — jeśli org jest paid lub enterprise),
    - business docs dla billing (informacyjne, ale publikowane): `SUBSCRIPTION`, `SLA`, `REFUNDS`.
  - Versioning & publishing (MUST):
    - superadmin publikuje nową wersję (UI już istnieje: `SuperAdminLegalView`),
    - jedna aktywna wersja per `docType` (+ archiwum),
    - `effectiveFrom`, opcjonalnie `expiresAt`,
    - opcjonalnie “reacceptRequiredFrom” (data, od której trzeba re-zaakceptować).
  - Acceptance tracking (MUST, API-first):
    - API endpoints (spójne z UI w repo):
      - `GET /api/legal/active` → lista aktywnych dokumentów (docType, version, title, effectiveFrom),
      - `GET /api/legal/active/:docType` → pełny dokument (contentMd) + metadata,
      - `GET /api/legal/my-acceptances` → lista akceptacji usera (docType, version, acceptedAt),
      - `GET /api/legal/pending` → required/pending docs dla usera + (opcjonalnie) DPA dla org admin,
      - `POST /api/legal/accept` → zapis akceptacji (scope: USER / ORG_ADMIN).
    - akceptacje zapisują: acceptedAt, IP, userAgent.
  - Acceptance UX (MUST, low friction):
    - modal “Legal updates required” (komponent już istnieje: `LegalAcceptanceModal`),
    - checkbox per dokument + “Accept & continue” aktywne dopiero gdy wszystkie wymagane zaznaczone,
    - quick summary (3–7 bulletów “co się zmieniło / co ważne”), pełny tekst dopiero po expand,
    - user wraca dokładnie tam, gdzie był (brak utraty kontekstu w aplikacji).
  - Registration/onboarding integration (MUST):
    - flow nie dubluje się: onboarding `/api/onboarding/accept-terms` i legal acceptance muszą być spójne.
    - V2: jedno źródło prawdy dla “czy user zaakceptował wymagane dokumenty”.
  - Routing & link integrity (MUST):
    - Legal Center (`/legal`) jest publicznie dostępny i zawiera komplet dokumentów,
    - wszystkie linki w aplikacji prowadzą do poprawnych tras (np. Cookie banner nie może linkować do martwego `/cookies` jeśli canonical jest `/legal/cookies`).
- OUT:
  - Pełny multi‑locale legal docs dla wszystkich 6 języków (V2 minimum: EN+PL, reszta post‑V2),
  - skomplikowane jurysdykcyjne warianty umów (post‑V2).

**Data model (V2, canonical):**
- `legal_documents` (aktywna wersja per docType):
  - `id`, `doc_type`, `version`, `title`, `content_md`,
  - `effective_from`, `expires_at?`, `is_active`,
  - `created_by`, `previous_version_id?`, `change_summary?`,
  - `scope_type` (`global`/`org`), `scope_value?` (np. orgId).
- `legal_document_acceptances`:
  - `id`, `user_id`, `organization_id?`,
  - `document_id`, `doc_type`, `doc_version`,
  - `accepted_at`, `ip_address`, `user_agent`.

**Analytics / metrics:**
- `legal_acceptance_modal_shown` / `legal_doc_expanded` / `legal_accept_submitted`
- `legal_acceptance_completed` (time_to_accept)
- KPI: drop‑off w rejestracji po kroku legal, liczba support ticketów dot. “why blocked”.

**Risks:**
- Niespójność schematu DB (w repo są ślady różnych wariantów kolumn) → V2 musi wymusić jeden kontrakt API.
- Zbyt długie dokumenty w modalu → drop-off (V2: summary-first).

**Definition of Done (DoD):**
- Legal docs są publikowane i pobierane z jednego API, a akceptacje działają end‑to‑end.
- `pending`/`accept`/`my-acceptances` nie zwracają 503 w standardowym środowisku.
- Użytkownik rozumie “co akceptuje” i nie ma “mystery blocks”.

**Acceptance / test plan:**
- Test: nowy user → login → modal akceptacji TOS+PRIVACY → po akceptacji dostęp do aplikacji.
- Test: publikacja nowej wersji TOS → istniejący user dostaje wymaganie re-accept → po akceptacji znika blokada.
- Test: org admin widzi dodatkowo DPA (jeśli wymagane) i może zaakceptować dla org.

---

## T094 — 🟢 landing — Documentation Section – Landing Page Structure & Content (trust, clarity, deep links)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Trust & conversion foundation (website) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Na B2B SaaS landing bez “Docs / Security / API / Changelog” wygląda jak marketing‑only. Dla klientów i VC brak widocznej dokumentacji = niższy trust, trudniejszy sales cycle i gorsza konwersja.

**Cel (outcome, nie feature):**
Landing ma sekcję “Documentation” w standardzie nowoczesnych SaaS:
- pokazuje kluczowe obszary produktu w sposób klarowny,
- prowadzi użytkownika do realnych, działających zasobów (public docs),
- buduje zaufanie (security, legal, changelog),
- jest spójna językowo i wizualnie z produktem.

**Scope (V2)**
- IN:
  - Landing “Docs section” (MUST):
    - sekcja na głównej stronie wejściowej (`src/views/ProductEntryPage.tsx`) i (jeśli używana publicznie) na `src/views/PublicLandingPage.tsx`,
    - blok ma mieć nagłówek, krótki opis “co znajdziesz w docs”, oraz 4–6 kart/shortcutów.
  - Shortcut / deep links (MUST, real routes):
    - `Getting Started` → `/docs` + konkretny start link (np. `/docs/quick-guides/getting-started-consultinity`),
    - `Security` → `/docs/security`,
    - `API Reference` → `/docs/api`,
    - `Changelog` → `/docs/changelog`,
    - `Legal Center` → `/legal`,
    - opcjonalnie: `Integrations` → odpowiednia kategoria w `/docs/:categorySlug` (jeśli jest).
  - Search entrypoint (MUST):
    - mini search box lub “Search docs” CTA, które kieruje do `/docs/search?q=...` (ten route już istnieje),
    - klawiszologia nie jest wymagana na landing (docs portal już ma Cmd/Ctrl+K).
  - Copy & IA (MUST):
    - treść jest “professional SaaS”, bez nadmiernych claimów,
    - spójność messagingu z T070 (Platform Overview) i T095 (Full Website Content Replacement).
  - “Freshness” signals (MUST):
    - wyświetlenie “Last updated” (np. z changelog lub statycznie w V2), żeby nie wyglądało martwo,
    - link “See what’s new” → `/docs/changelog`.
  - i18n (MUST):
    - minimum EN+PL dla tej sekcji (reszta języków zgodnie z globalnym standardem aplikacji, post‑V2 jeśli brak treści),
    - unikać hardcoded brand names niezgodnych z produktem (w repo są ślady “IRIS Docs” — do ujednolicenia w T095).
  - Analytics (MUST):
    - `landing_docs_section_viewed`
    - `landing_docs_cta_clicked` (target: docs/security/api/changelog/legal, location)
    - `landing_docs_search_used` (query length, no raw query storage jeśli PII risk)
- OUT:
  - Pełny “developer portal” (SDK, keys onboarding, try‑it‑out) — to osobny temat, post‑V2.

**UX / UI requirements (V2 quality bar):**
- “Tech sexy” i czytelnie: mało szumu, dobre spacing, typografia hierarchy, subtelne bordery.
- Zero martwych linków: każdy kafel prowadzi do istniejącej trasy.
- Mobile-first: karty składają się w 1 kolumnę, CTA zawsze widoczne.

**Definition of Done (DoD):**
- Sekcja “Documentation” jest na landing i ma działające linki do `/docs/*` i `/legal`.
- Copy jest spójne i zrozumiałe (PL+EN).
- Emitowane są eventy dla kliknięć (minimum).
- Brak “dead ends” (404/route mismatch) dla wszystkich CTA.

**Acceptance / test plan:**
- Test: landing → klik “Security / API / Changelog / Legal” → poprawna strona ładuje się bez błędów.
- Test: wpisanie query w search (jeśli jest) → przejście na `/docs/search?q=...`.
- Test: w mobile (viewport) układ sekcji nie psuje się i CTA są dostępne.

---

## T095 — 🟢 landing — Full Website Content Replacement & Visual Update (market story + screenshots + brand consistency)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Market-ready website (positioning + trust) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli strona WWW ma niespójny przekaz, nazewnictwo i screeny niezgodne z produktem, to:
- obniża zaufanie (klient/VC widzi “prototype marketing”),
- utrudnia sprzedaż (brak klarownej narracji “co to jest” i “dlaczego teraz”),
- psuje konwersję demo/trial (CTA nie prowadzą do konkretnych value moments).

**Cel (outcome, nie feature):**
W V2 WWW ma być “ready to show the world”:
- jedna spójna narracja: **transformation AI consulting system** (human governance + AI acceleration),
- spójne nazwy i brand (brak miksu “IRIS / TechnoLex / Consultinify”),
- aktualne screeny/visuale zgodne z realnym UI V2,
- spójne CTA prowadzące do demo/trial (T090–T092),
- kompletna warstwa trust (docs, security, legal, changelog).

**Scope (V2)**
- IN:
  - Messaging & copy replacement (MUST):
    - update treści na public entry:
      - `src/views/ProductEntryPage.tsx` + sekcje `HeroSection`, `InfoSections`, `TrustStrip`, `KnowledgePreviewSection`, `EntryFooter`,
      - `src/views/BecomePartnerView.tsx` (partner pitch spójny z produktem),
      - `src/views/AppPricingView.tsx` (język, claimy i definicje: AI credits/BYOK/managed AI spójne z billing),
      - `src/views/ChangelogView.tsx` (subtitle i nazwy produktu),
      - docs portal headline (`DocsLayout`, `DocsHomeView`) — nazwa produktu i ton.
    - copy jest “trust-first”: konkret, bez marketingowego szumu, bez obiecywania funkcji których nie ma.
    - spójność z T070 (Platform Overview Content) i T094 (Docs section).
  - Visual update (MUST):
    - wymiana/uzupełnienie assetów w stylu “cinematic” (już używane na landing) tak, żeby odzwierciedlały realne moduły V2,
    - screeny muszą pokazać N‑style / C‑style tam gdzie to jest ważne (np. organization workspace, initiatives, report/deck builder, integrations hub, billing).
  - Screenshot capture & governance (MUST):
    - playbook do produkcji screenów:
      - demo org/dataset (T089),
      - stałe rozdzielczości (desktop + mobile),
      - stały theme (light/dark) + brand colors,
      - anonimizacja/PII policy (zero realnych danych),
      - “no dead ends” (każdy pokazany ekran jest osiągalny).
    - minimalny zestaw (V2): 8–12 screenów + 2–3 hero visuals.
  - IA / navigation polish (MUST):
    - top-level wejścia: Demo, Trial, Docs, Pricing, Partner program, Security/Legal, Changelog,
    - wszystkie linki działają i prowadzą do istniejących tras (Route integrity).
  - Consistency cleanup (MUST):
    - ujednolicenie brand name w UI publicznych stron (docs i changelog nie mogą używać innych nazw produktu),
    - usunięcie literówek w nazwie produktu (np. “Consultinify”),
    - ujednolicenie “Docs” tytułów (np. “Consultinity Docs”, nie “IRIS Docs”).
  - i18n (MUST):
    - core public pages w 6 językach aplikacji (`en`, `pl`, `de`, `ar`, `jp`, `es`) z poprawną obsługą RTL (`ar`),
    - V2 quality bar:
      - EN+PL: copy dopracowane manualnie,
      - pozostałe języki: poprawne semantycznie (minimum), bez “broken sentences” (polish post‑V2).
  - Minimal SEO & sharing (MUST):
    - meta title/description per główne public route (Landing, Docs, Pricing, Partner, Security, Legal),
    - OpenGraph (share image) spójny z nowymi visualami.
- OUT:
  - pełny redesign brand identity / rebranding (post‑V2),
  - kompleksowy developer portal (SDK, keys onboarding, “try it out” z realnym OpenAPI) — osobny epik (post‑V2).

**Analytics / metrics (V2):**
- `landing_viewed` + `landing_primary_cta_clicked` (trial/demo)
- `landing_docs_cta_clicked` (T094)
- `pricing_viewed` + `pricing_cta_clicked`
- KPI: conversion (landing → demo/trial), scroll depth, time on page, CTR do docs/security/legal/changelog.

**Risks:**
- Rozjazd “what we claim” vs “what product does” → ryzyko zaufania (V2: zero fikcyjnych funkcji).
- Brak świeżych screenów (czas) → WWW wygląda “stare”.
- i18n na 6 języków bez kontroli jakości → wizerunkowy risk (V2: guardrails jak wyżej).

**Definition of Done (DoD):**
- Public pages mają spójny przekaz i brand (jedna nazwa produktu w całym WWW).
- Screeny/visuale są aktualne i pokazują realne moduły V2 (brak “placeholder”).
- Wszystkie public linki działają (brak 404 / dead ends).
- Core content jest dostępny w 6 językach (RTL działa dla `ar`).

**Acceptance / test plan:**
- Test: wejście na `/` + nawigacja do Demo/Trial/Docs/Pricing/Partner/Security/Legal/Changelog bez błędów.
- Test: porównanie nazw: brak “IRIS/TechnoLex” na public stronach (o ile nie jest to świadoma nazwa produktu).
- Test: mobile viewport — hero i CTA są czytelne i nie “skaczą”.

---

## T096 — 🟢 partners — Partner Program Toolkit & Promotional Materials (downloadable pack + always current)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (enablement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Partnerzy bez “gotowców” (deck/one-pager/email scripts/case studies) sprzedają niespójnie, wolniej i z większą liczbą błędów (claimy niezgodne z produktem). To zabija konwersję i zwiększa koszt wsparcia.

**Cel (outcome, nie feature):**
Partner ma w portalu partnera 1 miejsce, gdzie:
- pobiera zawsze aktualne materiały,
- widzi jasne “jak używać” (do jakiej persony / etapu sprzedaży),
- ma skrypty i template’y pod trial → paid (T090–T092),
- ma assety (logo/screens) zgodne z WWW V2 (T095).

**Scope (V2)**
- IN:
  - Partner Toolkit Pack (MUST, minimum deliverables):
    - **Product one‑pager (PDF)**:
      - “co to jest”, 3–5 value props, 3–5 differentiators, security/compliance short block, CTA (demo/trial),
      - wersje: PL + EN.
    - **Sales deck template (PPTX / Google Slides link)**:
      - 10–15 slajdów: problem → approach → platform modules → outcomes → pricing entrypoints → case snippet,
      - wersje: PL + EN,
      - “safe claims” (bez obietnic funkcji nieistniejących).
    - **Discovery call script + objection handling (DOCX/PDF)**:
      - 12–20 pytań (CFO/COO/PMO) + mapowanie na moduły platformy,
      - gotowe odpowiedzi na top 10 obiekcji (pricing, AI, security, data residency, “we already have PMO”).
    - **Email templates pack (TXT/HTML)**:
      - 3 sekwencje: cold outbound, follow‑up, post‑demo/trial nudge,
      - “no spam” compliance note + warianty tematu.
    - **Case study template + 1 przykładowy case (PDF)**:
      - format: context → baseline → interventions → metrics → ROI narrative,
      - jeden “hero” case z demo story (spójny z T087–T089).
    - **Logo/brand kit (ZIP)**:
      - logo w SVG/PNG (light/dark), partner badge, usage rules (“do/don’t”).
    - **Screenshots pack (ZIP)**:
      - 8–12 screenów z produktu V2 (z playbooka T095), opisane gdzie używać.
  - Partner Portal distribution (MUST):
    - materiały dostępne jako “Resources” w Partner Portal (`PartnerPortalView` → ResourcesSection),
    - backend endpoint `GET /api/partners/resources` zwraca realne zasoby (nie tylko hardcoded),
    - “Download” daje realny plik (nie symboliczny URL).
  - Versioning & freshness (MUST):
    - każdy resource ma `version`, `updatedAt`, `language`, `category` (marketing/docs/templates/case studies),
    - deprecated wersje są archiwizowane (nie znikają wstecznie z historii partnera, ale nie są domyślne).
  - Access control (MUST):
    - materiały “public partner” (dla Registered) vs “advanced enablement” (Certified/Premier) — gating po tierze,
    - audyt pobrań (kto, co, kiedy) dla compliance i poprawy programu.
  - i18n (MUST):
    - minimum V2: PL+EN dla całego toolkitu,
    - post‑V2: kolejne języki zgodnie z globalnym i18n (de/ar/jp/es) jeśli program rośnie globalnie.
- OUT:
  - automatyzacja affiliate end‑to‑end (to osobne taski w partners/growth),
  - pełny LMS / academy engine (T097).

**Implementation notes (grounded w repo):**
- UI już ma “Resources” w Partner Portal:
  - `src/views/partner/PartnerPortalView.tsx` ma ResourcesSection z download flow,
  - `src/views/partner/ResourcesView.tsx` istnieje jako placeholder “resource center”.
- Backend ma placeholder resources list:
  - `server/src/routes/partners.routes.ts` → `GET /api/partners/resources` zwraca hardcoded zasoby + `GET /download` zwraca `downloadUrl`,
  - V2: `downloadUrl` musi prowadzić do realnego pliku (np. `/api/partners/resources/:resourceId/file` z autoryzacją i streamem).
- Utrzymanie spójności claimów:
  - wszystkie materiały muszą być spójne z T095 (brand/nazwy) oraz z T090–T092 (conversion narrative).

**Data model (V2, minimal):**
- `partner_resources`:
  - `id`, `category`, `title`, `description`,
  - `language`, `version`, `status` (active/archived),
  - `file_key` (storage key) lub `url` (jeśli hosted), `mime_type`, `size_bytes`,
  - `min_partner_tier` (REGISTERED/BRONZE/SILVER/…),
  - `created_at`, `updated_at`.
- `partner_resource_downloads`:
  - `id`, `partner_org_id`, `user_id`, `resource_id`, `downloaded_at`, `ip_hash?`, `user_agent?`.

**Analytics / metrics:**
- `partner_resource_list_viewed`
- `partner_resource_download_clicked` (resourceId, category, language, tier)
- KPI: downloads per partner, usage by category, correlation z conversion.

**Risks:**
- Materiały szybko się dezaktualizują gdy produkt rośnie → V2 wymaga ownera procesu aktualizacji (release/changelog handshake).
- Niespójny branding/nazwy → spadek trust (V2: single source + review gate).

**Definition of Done (DoD):**
- Partner może wejść w “Resources” i pobrać komplet toolkitu (PL+EN).
- Każdy download jest realny (plik się ściąga), ma wersję i jest zgodny z V2 messagingiem.
- Materiały są podzielone na kategorie i gotowe do użycia w sprzedaży/onboardingu.

**Acceptance / test plan:**
- Test: Partner (Registered) widzi podstawowe materiały i może je pobrać.
- Test: Partner (wyższy tier) widzi dodatkowe “advanced enablement”.
- Test: download link działa (plik jest zwracany), a event download jest zapisany.

---

## T097 — 🟢 partners — Partner Sales Certification & Incentive Training System (academy + exams + commission unlock)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (enablement + quality) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Partner program bez standaryzacji (co mówić, komu, jak prowadzić discovery, jak prowadzić trial → paid) generuje:
- niespójny przekaz i ryzyko “over-claiming”,
- słabe wyniki sprzedażowe i długi time‑to‑first‑deal,
- większy koszt wsparcia po naszej stronie (pytania podstawowe, błędy w onboardingach),
- trudność w skalowaniu programu (nie wiemy “kto jest gotowy”).

**Cel (outcome, nie feature):**
W V2 partner ma **realny, przechodzony w produkcie** program:
- learning path (moduły) + egzaminy,
- certyfikaty do pobrania,
- jasno zdefiniowany mechanizm incentive: **ukończenie certyfikacji odblokowuje wyższe prowizje / tier**,
- mechanizmy anty‑fraud (retake, audit, revocation),
- spójne z PMO/ISO mappingiem w partner module i z messagingiem T095.

**Scope (V2)**
- IN:
  - Academy / Learning path (MUST):
    - zestaw modułów szkoleniowych w kategoriach (z `src/views/partner/types.ts` i UI `AcademyProgress`):
      - METHODOLOGY, SALES, TECHNICAL, COMPLIANCE,
    - moduły mają: opis, czas trwania, required/not required, status i score.
  - Exams (MUST):
    - egzamin na poziomie certyfikacji (min. 20 pytań, próg zaliczenia, limit czasu),
    - retake policy (cooldown + limit podejść / doba),
    - generowanie wyniku i zapis attemptów (audit).
  - Certificates (MUST):
    - po zaliczeniu: certyfikat dostępny do pobrania (PDF) + “share link” (opcjonalnie gated),
    - cert ma metadane: typ, earnedAt, expiresAt (jeśli wygasa), certificateId.
  - Incentive system (MUST):
    - ukończenie certyfikacji sprzedażowej odblokowuje wyższy tier i/lub wyższą stawkę prowizji,
    - incentive jest **egzekwowany** w naliczaniu prowizji (nie tylko “badge” w UI),
    - superadmin ma możliwość revoke/downgrade (compliance / fraud / quality).
  - Partner Portal UX (MUST):
    - widoki istniejące w `PartnerPortalView` (subsections: `learning-path`, `exams`, `certificates`) stają się w pełni funkcjonalne,
    - spójny flow: start → moduły → egzamin → certyfikat → “Unlocked benefits” panel (jak to wpływa na prowizję).
  - Content baseline (MUST, V2 “final and good”):
    - minimum: gotowy zestaw modułów dla Sales Certification (discovery + objection + trial→paid + security & legal),
    - języki: EN + PL.
- OUT:
  - pełny LMS enterprise (SCORM, roleplay grading, proctoring) — post‑V2.

**Open questions (do domknięcia w trakcie implementacji, ale spec wymaga decyzji):**
- Jaka jest **kanoniczna taksonomia tierów partnera**?
  - W repo są niespójności:
    - UI/config używa `REGISTERED/BRONZE/SILVER/GOLD/PLATINUM` (`partner_commission_rates`, `PartnerProgramConfig.tsx`, `usePartnerEcosystem`),
    - DB `partner_organizations.tier` w `215_partner_portal.sql` ma `registered/certified/premier/elite`.
  - V2 wymaga ujednolicenia (jedno źródło prawdy + mapowanie legacy).
- Czy tier jest funkcją (a) revenue, (b) certyfikacji, (c) obu?
  - Proponowane V2: tier = max(RevenueTier, CertificationTier) + admin override.
- Czy incentive dotyczy całej organizacji partnera (partner_org) czy pojedynczego usera?
  - Proponowane V2: **benefit prowizyjny jest na poziomie partner_org**, ale wymaga min. 1 aktywnego usera z ukończoną certyfikacją.

**Implementation notes (grounded w repo):**
- UI:
  - `src/views/partner/PartnerPortalView.tsx` ma gotowe pod‑sekcje “Certification” i pobiera `GET /api/partners/certifications`,
  - komponent `src/components/Partner/AcademyProgress.tsx` jest gotowym UI do progresu modułów i certów (może zostać użyty jako “overview”).
- Backend:
  - `server/src/routes/partners.routes.ts` ma placeholder endpoints:
    - `GET /api/partners/certifications`,
    - `GET /api/partners/certifications/:certId/modules`,
    - `POST /api/partners/certifications/:certId/modules/:moduleId/progress`,
  - migracje istniejące już definiują tabelki do “prawdziwego” LMS:
    - `partner_certifications`, `partner_learning_modules`, `partner_learning_progress` (w `215_partner_portal.sql`).
- Incentive:
  - prowizje są konfigurowane per tier w `partner_commission_rates` (migration `217_partner_discount_system.sql`) i zarządzane w UI `PartnerProgramConfig.tsx` przez `partnerConfigRouter` (w `partners.routes.ts`).

**API contract (V2, minimal):**
- `GET /api/partners/certifications`
  - zwraca listę certification tracks (status/progress, certificate metadata).
- `GET /api/partners/certifications/:certId/modules`
  - zwraca moduły learning path + progress.
- `POST /api/partners/certifications/:certId/modules/:moduleId/progress`
  - zapisuje progress, score, completedAt; waliduje uprawnienia partner usera.
- `POST /api/partners/certifications/:certId/exam/start`
  - tworzy attempt (czas startu, deadline).
- `POST /api/partners/certifications/:certId/exam/submit`
  - zapisuje odpowiedzi, wynik, pass/fail; przy pass: ustawia certification completed + generuje cert.
- `GET /api/partners/certificates/:certificateId/download`
  - zwraca PDF (stream) lub signed URL z krótkim TTL.

**Data model (V2, minimal – bazuje na istniejących migracjach):**
- `partner_certifications`:
  - per `partner_org_id` + `user_id` track certyfikacji (status, progress, started/completed/expires, certificateId/url),
  - V2: dodać (jeśli brak): `passed_exam_at`, `last_attempt_at`, `attempt_count`.
- `partner_learning_modules` + `partner_learning_progress`:
  - moduły i postęp per cert.
- `partner_certification_attempts` (nowa tabela w V2):
  - attemptId, certificationId, userId, startedAt, submittedAt, score, passed, ipHash?, userAgent?.
- `partner_organizations`:
  - `tier` (kanoniczne) + ewentualny `tier_override` + `certification_tier_floor`.

**Incentive logic (V2 – “egzekwowane”):**
- Gdy partner_org spełni warunek certyfikacji (min. 1 user ukończył “Sales Certification”):
  - system ustawia `certification_tier_floor` dla partner_org (np. co najmniej `SILVER`),
  - commission calculation używa `max(current_tier, certification_tier_floor)` do wyboru stawki z `partner_commission_rates`,
  - UI pokazuje “Unlocked benefits” (rate/discount changes) oraz datę przyznania.
- Revocation:
  - superadmin może cofnąć cert (fraud, quality) → zdejmuje floor i loguje event.

**Anti‑fraud / abuse (V2):**
- rate limiting attemptów (per user/per cert),
- losowanie pytań z banku (minimum), timeboxed exam,
- audyt attemptów + możliwość flagowania.

**Analytics / metrics:**
- `partner_academy_module_started` / `partner_academy_module_completed`
- `partner_cert_exam_started` / `partner_cert_exam_passed` / `partner_cert_exam_failed`
- `partner_cert_earned` + `partner_incentive_unlocked`
- KPI: completion rate, time-to-cert, correlation z deals won i conversion.

**Risks:**
- Niespójność tierów w repo → musi być domknięta, inaczej incentive nie będzie wiarygodne.
- “Paper certification” (bez realnej jakości) → w V2 minimum: egzamin + retake policy + audit.

**Definition of Done (DoD):**
- Partner ma pełny flow: learning path → egzamin → certyfikat → benefit (prowizyjny) widoczny i egzekwowany.
- Superadmin może zarządzić tier/rates oraz cofnąć cert w razie potrzeby.
- EN+PL content baseline dostępny i spójny z claimami produktu.

**Acceptance / test plan:**
- Test: partner user przechodzi moduły, zdaje egzamin, dostaje cert i może pobrać PDF.
- Test: partner org po certyfikacji ma wyższy tier floor i komisje naliczają się według nowej stawki.
- Test: revoke przez superadmin cofa benefit i jest audytowane.

---

## T098 — 🟢 partners — Automated Partner Outreach Campaign (compliant sequences + tracking + scaling BD)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Partner growth foundation (acquisition engine) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Pozyskiwanie partnerów “ręcznie” (ad‑hoc maile/LinkedIn) nie skaluje się, nie jest mierzalne i generuje ryzyko compliance (spam, brak opt‑out). Bez automatyzacji BD nie dowozi pipeline’u partnerów w tempie potrzebnym do V2.

**Cel (outcome, nie feature):**
W V2 BD/SuperAdmin może uruchomić i mierzyć kampanie outreach do potencjalnych partnerów, które:
- są zgodne z prawem i deliverability best‑practice (opt‑out, throttling, audit),
- prowadzą do jasnego CTA (Become Partner → onboarding → partner portal),
- mają tracking i raportowanie skuteczności (open/click/apply),
- używają spójnego messagingu i assetów z T095 + T096.

**Scope (V2)**
- IN:
  - Campaign builder (MUST):
    - sekwencje 2–5 kroków email (np. D0/D3/D7),
    - template per krok (subject + html/text) z variable substitution (np. `{{company}}`, `{{firstName}}`, `{{region}}`),
    - preview + test‑send na własny adres,
    - okna wysyłek (dni/godziny) + time‑zone (minimum: “EU business hours”).
  - Lead intake & segmentation (MUST):
    - import CSV (min. pola: email, company, name, country/region, source, “lawful basis”),
    - segmenty: region/industry/source + “exclude duplicates”,
    - suppression list (unsubscribed/bounced/do-not-contact).
  - Compliance (MUST):
    - każdy mail ma stopkę: dane nadawcy + **one‑click unsubscribe**,
    - trwały zapis opt‑out (nie wysyłamy więcej),
    - audyt: kto uruchomił kampanię, do kogo, kiedy, jaka treść (hash wersji template).
  - Deliverability & safety (MUST):
    - throttling / rate limits (per domena / per godzina) + retry/backoff,
    - obsługa bounce/complaint na poziomie minimum (manual import lub webhook post‑V2),
    - guardrails na treść: zakaz “over‑claiming” + szybki review gate.
  - Tracking & analytics (MUST):
    - eventy: sent, delivered(soft), opened(best‑effort), clicked, unsubscribed,
    - tracking linki (redirect) + UTM conventions,
    - dashboard per kampania (CTR, opt‑out rate, apply starts, conversions).
  - CTA + onboarding path (MUST):
    - kampanie kierują na publiczny landing partnera `src/views/BecomePartnerView.tsx`,
    - CTA: “Apply” (np. `/register`), “Book call” (link), “View partner kit” (T096),
    - jeśli używany partner/referral code — linki wspierają atrybucję (integracja z partner code flow).
  - Scheduling engine (MUST):
    - przetwarzanie wysyłek w tle jako job (batch),
    - użycie istniejącego cron framework (`server/src/cron/Scheduler.ts` ma slot “Scheduled Emails”).
  - i18n / content quality (V2):
    - minimum: EN + PL template’y outreach,
    - post‑V2: rozszerzenie na kolejne języki programu.
- OUT:
  - pełny CRM (pipeline stages, inbox, automatyczne reply classification) — post‑V2,
  - multi‑channel (LinkedIn, WhatsApp, SMS) — post‑V2 (email‑first w V2).

**Implementation notes (grounded w repo):**
- Email sending:
  - istnieje `server/src/services/emailService.ts` (SMTP settings z tabeli `settings`, nodemailer).
- Template management:
  - istnieje system `email_templates` (`server/src/routes/content/email-templates.routes.ts`) — można użyć jako “source of templates” lub zrobić dedykowane `partner_outreach_templates` (V2 decision).
- Scheduling:
  - `server/src/cron/Scheduler.ts` ma placeholder “Scheduled Emails” co 15 minut — naturalne miejsce na “process outreach queue”.
- Public CTA:
  - publiczna strona rekrutacji partnerów jest w `src/views/BecomePartnerView.tsx`.
- Consent:
  - GDPR endpointy mają flagę `marketing` dla userów (`/api/gdpr/consents`), ale outreach dotyczy leadów B2B (nie userów) → wymagamy osobnej ewidencji opt‑out (suppression list) i lawful basis per lead.

**Data model (V2, minimal):**
- `partner_outreach_campaigns`:
  - `id`, `name`, `status` (draft/running/paused/completed),
  - `created_by`, `created_at`, `started_at`, `completed_at`,
  - `from_name`, `from_email`, `reply_to`,
  - `sending_window` (json), `throttle_policy` (json),
  - `segment_query` (json) lub `segment_id`.
- `partner_outreach_steps`:
  - `id`, `campaign_id`, `step_order`, `delay_days`,
  - `subject`, `body_html`, `body_text`, `template_version_hash`.
- `partner_outreach_leads`:
  - `id`, `email`, `company`, `first_name`, `last_name`, `country`, `region`,
  - `source`, `lawful_basis`, `status` (active/suppressed/bounced),
  - `created_at`, `updated_at`.
- `partner_outreach_enrollments`:
  - `id`, `campaign_id`, `lead_id`, `enrolled_at`, `status` (active/completed/unsubscribed),
  - `current_step`, `next_send_at`.
- `partner_outreach_events`:
  - `id`, `campaign_id`, `lead_id`, `type` (sent/opened/clicked/unsubscribed/bounced),
  - `meta` (json), `created_at`.
- `partner_outreach_unsubscribes`:
  - `email`, `reason?`, `created_at`.

**API contract (V2, minimal — SuperAdmin/BD):**
- `POST /api/superadmin/partner-outreach/leads/import` (CSV)
- `GET /api/superadmin/partner-outreach/leads` (filters + suppression status)
- `POST /api/superadmin/partner-outreach/campaigns` (create/update)
- `POST /api/superadmin/partner-outreach/campaigns/:id/start|pause|resume`
- `GET /api/superadmin/partner-outreach/campaigns/:id/metrics`
- Public:
  - `GET /public/unsubscribe?token=...` (one‑click, no login)
  - `GET /public/track/click?token=...` (redirect + event)

**Analytics / metrics:**
- `partner_outreach_campaign_created/started/paused/completed`
- `partner_outreach_email_sent/opened/clicked/unsubscribed`
- KPI: opt‑out rate, CTR, apply-start rate, partner signups, “time to first partner portal login”.

**Risks:**
- Deliverability (domain reputation) → V2 musi mieć throttling, templates review, stopkę i opt‑out.
- Compliance (GDPR/anti‑spam) → V2 wymaga lawful basis + suppression list + audyt.

**Definition of Done (DoD):**
- BD/SuperAdmin może: zaimportować leady, stworzyć kampanię 3‑krokową (PL/EN), uruchomić ją i zobaczyć metryki.
- Każdy mail ma unsubscribe i po opt‑out nie ma dalszych wysyłek.
- Kliknięcia są trackowane, a CTA prowadzą do poprawnych publicznych ścieżek (Become Partner → register).

**Acceptance / test plan:**
- Test: kampania testowa do 10 leadów wysyła kroki zgodnie z harmonogramem i throttle.
- Test: unsubscribe działa one‑click i blokuje kolejne kroki.
- Test: kliknięcie CTA zapisuje event click i poprawnie redirectuje do docelowej strony.

---

## T099 — ⚫ ui/ux — Implement Alternative “C‑Type” Table View (ClickUp‑Style Layout) (N‑first system + optional C for speed)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: UI standards adoption (N/C everywhere it makes sense) TBD
- Priorytet / V2 scope: V2

**Kluczowy wymóg od Ciebie (MUST):**
- Cały system ma być konsekwentnie **w standardzie N** (page‑first) oraz mieć **C tam, gdzie da się wybrać rodzaj prezentacji**.
- Całość aplikacji ma mieć **super nowoczesny UI/UX** zgodny z “Tech Sexy” (invisible borders, monochromatic chrome, outline icons, typographic hierarchy) — kanon: `docs/ui-standards/`.

**Business challenge (problem):**
Duże, operacyjne produkty (ClickUp/Notion) wygrywają “speed to action”: tabela jest miejscem pracy, nie tylko listą. W Consultify wiele workflow odbywa się na listach (tasks/decisions/initiatives/tools), ale bez C‑type użytkownik traci czas na nawigację, a UI jest niespójny między modułami.

**Cel (outcome, nie feature):**
W V2 użytkownik może pracować z listami/tabelami w 2 spójnych wariantach:
- **N‑table**: spokojny, page‑first “golden standard” tabel (Decisions‑style) dla czytelności,
- **C‑table**: ClickUp‑like, action‑first “operacyjny” układ dla szybkości (command bar + selection + quick actions),
przy zachowaniu tych samych danych i funkcji (różny render), oraz z trwałą preferencją użytkownika.

**Scope (V2)**
- IN:
  - Global rules (MUST):
    - N/C to **presentation**, nie inne feature sety (te same dane, ta sama praca),
    - brak akordeonów jako “tryb” (D mode jest usunięte; final target: N+C) — kanon: `docs/ui-standards/01-shell-layout/presentation-modes.md`,
    - każdy ekran tabelaryczny i “hub modułu” trzyma **App Table Standard** (top bar `h-9`, search toggle, pełna szerokość, guardy na dane): `docs/ui-standards/03-modules/app-table-standard.md`.
  - N‑table (MUST):
    - utrzymujemy istniejący wzorzec tabel: resizable columns + header filters + toggle search,
    - “quiet luxury UI”: minimal chrome, hover = background change (nie border/tekst),
    - pełna spójność z DBR77 Visual Language (`docs/ui-standards/00-foundation/visual-language.md`).
  - C‑table (MUST):
    - ClickUp‑style “action‑first” dla list:
      - szybkie akcje (bulk + row actions) bez wchodzenia w oddzielne ekrany,
      - ergonomia klawiatury (up/down selection, enter open, cmd/ctrl+k search),
      - command bar / quick actions zgodne z “C-grade productivity” z `presentation-modes.md`,
      - row hover reveals secondary actions (pattern opisany w visual language).
    - zachowuje App Table Standard (te same filtry/kolumny), ale inaczej rozkłada priorytety UI (operacyjnie).
  - View toggle & persistence (MUST):
    - dla list/tabel dodajemy przełącznik **N / C** (analogiczny semantycznie do `PresentationModeSwitcher`),
    - preferencja zapisywana per użytkownik per obszar (np. `module.discovery.tableMode`, `mywork.tasks.tableMode`) — localStorage jako fallback, docelowo server‑side user settings,
    - opcjonalny URL override (np. `?view=n|c`) dla deep‑linków i debug.
  - Rollout scope (V2 minimal, ale “real”):
    - wdrożenie C‑table minimum na:
      - **My Work** (Tasks/Decisions/Notifications listy; bazuje na istniejących tabelach `ResizableTable`),
      - **1 module hub** (np. Discovery Tools/Assessment) w trybie `viewMode='table'`,
    - pozostałe moduły: adoptują mechanizm przełącznika i style w kolejnych taskach, ale architektura jest już wspólna.
  - i18n (MUST):
    - PL + EN dla labeli i tooltipów przełącznika i podstawowych komunikatów C‑table.
- OUT:
  - pełny “custom views builder” (jak ClickUp view presets z share, permissions) — post‑V2,
  - time‑tracking/worklog jako core C‑table feature — wyraźnie OUT w standardzie C mode.

**Implementation notes (grounded w repo):**
- Standardy:
  - N/C presentation jest kanoniczne i opisane implementation‑ready w `docs/ui-standards/01-shell-layout/presentation-modes.md`,
  - standard tabel/hubów jest kanoniczny: `docs/ui-standards/03-modules/app-table-standard.md` + `docs/ui-standards/03-modules/module-hub-standard.md`.
- Istniejące komponenty do użycia (nie duplikować):
  - `src/components/ui/ResizableTable/*` (Decisions‑style: resizers, filters, bulk actions),
  - `src/components/shared/ModuleHub/*` (hub: taby, view modes),
  - `src/hooks/usePresentationMode.ts` + `PresentationModeSwitcher` (logika N/C i a11y pattern).

**C‑table UX spec (V2 minimal, ale spójny):**
- Above the fold:
  - 1) top bar (search toggle + filtry + primary action),
  - 2) tabela z selekcją wiersza (clear selection),
  - 3) quick actions (inline / bulk) dostępne bez scrollowania.
- Keyboard:
  - strzałki: zmiana selekcji wiersza,
  - `Enter`: open (w tej samej zakładce),
  - `Esc`: clear selection / close menus,
  - `Cmd/Ctrl+K`: focus search.
- Visual:
  - “invisible borders” + hover background,
  - monochrome chrome; kolor tylko tam gdzie semantyka/status/primary CTA,
  - row actions ujawniane na hover (ClickUp pattern).

**Analytics / metrics:**
- `table_view_mode_changed` (context, from, to)
- `table_row_quick_action_used` (action, entityType)
- KPI: time-to-action (proxy: clicks per completed action), adoption C vs N, retention.

**Risks:**
- Rozjazd funkcjonalny między N‑table i C‑table → V2 wymaga “same data, different render”.
- Performance dla dużych tabel → V2: stabilne renderowanie (virtualization w post‑V2 jeśli potrzebne), brak layout shift.

**Definition of Done (DoD):**
- Użytkownik może przełączyć N/C w tabelach objętych rolloutem (MyWork + 1 module hub) bez utraty funkcji.
- Widoki są spójne z kanonicznym standardem UI (Tech Sexy + App Table Standard + presentation modes).
- Preferencja użytkownika jest zapamiętana i działa po odświeżeniu.

**Acceptance / test plan:**
- Test: przełącz N↔C na MyWork tasks/decisions/notifications; filtry/search/kolumny działają w obu.
- Test: przełącz N↔C w module hub table view; brak regresji layoutu i szerokości (pełna szerokość, brak max‑w).
- Test: a11y — toggle działa klawiaturą i ma tooltipy/aria.

---

## T100 — ⚫ ui/ux — Mobile Application Interface Design (mobile‑ready web + field capture UX, premium)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Mobile readiness (web + future app) TBD
- Priorytet / V2 scope: V2

**Dlaczego to jest MUST (Twoja uwaga):**
To jest oczywiste, że i strona, i aplikacja będą otwierane na telefonie — w V2 musimy być na to gotowi: bez “połamanych” layoutów, z szybkim zbieraniem informacji i premium wrażeniem.

**Business challenge (problem):**
Jeśli mobile experience jest słaby, to:
- onboarding/demo/trial tracą konwersję (pierwszy kontakt często jest na telefonie),
- konsultanci w terenie nie zbiorą danych “w momencie” (wraca ręczne notowanie i chaos),
- UI/UX traci premium feel (co psuje zaufanie do całej platformy).

**Cel (outcome, nie feature):**
W V2 produkt jest **mobile‑ready**:
- web działa świetnie na telefonie (responsywność + touch ergonomia),
- kluczowe flow “field capture” (zbieranie informacji z hali/spotkania) jest zoptymalizowane pod 1 rękę,
- layouty i komponenty trzymają Tech Sexy + standardy N/C (bez nowych ad‑hoc wynalazków),
- przygotowujemy solidną bazę pod **dedykowaną aplikację mobilną** (jeśli zdecydujemy się na nią jako osobny epik).

**Scope (V2)**
- IN:
  - Mobile‑ready Web (MUST):
    - responsywność dla krytycznych ścieżek:
      - landing/docs/legal/pricing (T094–T095),
      - onboarding/register/login,
      - My Work (tasks/decisions/notifications),
      - szybkie wejście do initiatives + podstawowe akcje,
      - chat access (AI) bez zasłaniania pracy.
    - brak poziomego scrolla w content (poza kontrolowanym, wewnętrznym scroll w tabelach jeśli absolutnie konieczne),
    - touch ergonomia:
      - minimalny target 44×44px (`.touch-target`),
      - safe‑area obsłużone (notch) (`.safe-area-pb`),
      - bottom navigation jako primary nav na mobile.
  - Mobile navigation pattern (MUST):
    - bottom nav (5 pozycji) jako domyślna nawigacja w aplikacji na mobile,
    - sidebar otwierany jako drawer (zamiast stałej kolumny),
    - wszystkie krytyczne akcje dostępne bez “pixel hunting”.
  - Mobile “field capture” UX (MUST, kierunek funkcjonalny):
    - mobile ma być zoptymalizowany pod **zbieranie informacji** (teren/hala/rozmowa konsultanta):
      - szybkie notatki,
      - checklisty i krótkie formularze,
      - dodawanie zdjęć/załączników (jeśli wspierane),
      - minimalne “ciężkie tabele” (zastępujemy listą/kanbanem/compact cards).
    - C‑type (action‑first) na mobile:
      - domyślnie **N** (czytelność),
      - C może być dostępne tylko tam gdzie nie psuje ergonomii; jeśli jest, musi mieć touch‑friendly command bar i nie może wymagać “hover”.
  - Drawers / sheets (MUST):
    - używamy jednolitego komponentu drawer/sheet do bocznych paneli (help/docs/sidebar, itp.),
    - zachowanie: focus mgmt, ESC, overlay, drag‑to‑close (tam gdzie sensowne).
  - RTL + i18n (MUST):
    - mobile layout działa w RTL (`ar`) i nie rozjeżdża bottom nav / drawers.
  - Performance & perceived speed (MUST):
    - minimalizacja layout shift,
    - priorytet “fast first interaction” na mobile (zwłaszcza landing i My Work).
- OUT:
  - pełna implementacja natywnej aplikacji (iOS/Android) jako osobny epik — V2 przygotowuje UX i kontrakty, ale budowa może być etapowana.

**Implementation notes (grounded w repo):**
- Device detection:
  - jest `src/hooks/useDeviceType.ts` (mobile/tablet/desktop + orientation + safe area insets).
- Mobile navigation:
  - jest `src/components/navigation/BottomNavigation.tsx` (renderuje się tylko na mobile),
  - `src/layouts/MainLayout.tsx` ma `pb-16 md:pb-0` (miejsce na bottom nav).
- Touch & safe area:
  - utilities są w `index.css`: `.touch-target` i `.safe-area-pb`.
- Drawers:
  - jest `src/components/ui/primitives/Drawer.tsx` (sheet/drawer z overlay + drag + focus mgmt).

**Mobile UI rules (V2, “premium”):**
- Jeden kolorowy akcent na ekran (CTA/status) — reszta monochromatyczna (Tech Sexy).
- Brak “dense tables” na mobile:
  - tabela → compact list/card + drill‑down,
  - filtrowanie i search zawsze dostępne, ale nie dominujące.
- Sticky controls:
  - bottom nav zawsze widoczny,
  - krytyczne CTA (Save / Add / Submit) w zasięgu kciuka (bottom action bar albo floating action, zgodnie ze standardem ekranu).

**Definition of Done (DoD):**
- Kluczowe trasy publiczne i core app views działają poprawnie na mobile (iOS Safari + Chrome Android) bez połamanych layoutów.
- Bottom nav działa i jest spójny (safe area, touch targets, a11y).
- Field capture UX jest zaprojektowany i gotowy do wdrożenia etapami (nie tylko “responsive shrink”).
- RTL (`ar`) nie psuje nawigacji i podstawowych layoutów.

**Acceptance / test plan:**
- Test: viewporty 390×844 (iPhone), 360×800 (Android), tablet 768×1024 — brak overflow/h-scroll w content.
- Test: bottom nav nie zasłania treści i respektuje safe area.
- Test: w mobile da się wykonać 3 typowe akcje “w terenie”: dodać notatkę, zaznaczyć checklist item, dodać załącznik (jeśli włączone) — bez frustracji.
- Test: RTL (`ar`) — bottom nav i drawers działają poprawnie.

---

## T101 — ⚫ ui/ux — Icon System Standardization & Design Library (one icon language across the whole app)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Tech Sexy UI consistency (micro-consistency) TBD
- Priorytet / V2 scope: V2

**Dlaczego to jest oczywiste i krytyczne:**
Spójne ikonki w całym sofcie to “micro‑consistency”, która robi premium feel. Bez tego nawet dobre ekrany wyglądają jak zlepki modułów.

**Business challenge (problem):**
W repo widać dużo ręcznych decyzji per ekran (`size={14|16|18|20}`, czasem kolorowe ikony, różne style). To powoduje:
- brak spójności wizualnej (szczególnie w nav + toolbary),
- większy koszt rozwoju (każdy nowy ekran “wymyśla” ikonki),
- ryzyko łamania standardu Tech Sexy (kolorowe ikony w nawigacji, mieszanie filled/outline).

**Cel (outcome, nie feature):**
W V2 mamy jeden, kanoniczny system ikon:
- jedna biblioteka (outline, mono‑weight),
- tokeny rozmiaru + stroke width,
- jasne reguły: gdzie ikona ma kolor semantyczny, a gdzie zawsze jest “text‑color”,
- biblioteka/mapping ikon do typów danych (statusy, moduły, actions),
- proste egzekwowanie w kodzie (wrapper + zakazane patterny).

**Kanon (SSOT) — już istnieje w standardach:**
- `docs/ui-standards/00-foundation/visual-language.md` → sekcja “Ikony (KANON) — Outline, mono‑weight, text‑color”
  - outline stroke, mono‑weight (1.5–2px),
  - kolor ikony = kolor tekstu obok (wyjątki: semantyka/status/badge),
  - rozmiary: nav 18–20, inline 16, toolbary 14–16,
  - MUST NOT: kolorowe ikony w nawigacji (poza aktywnym itemem), mieszanie filled+outline.

**Scope (V2)**
- IN:
  - Icon tokens (MUST):
    - definiujemy kanoniczne size tokens (np. `icon.xs/sm/md/lg/xl`) mapujące na 14/16/18/20/24/32/48,
    - definiujemy kanoniczny `strokeWidth` dla całej aplikacji (np. 1.75 lub 2) i NIE “pływa” per ekran.
  - Icon wrapper (MUST):
    - wprowadzamy wspólny komponent (np. `AppIcon`) który:
      - przyjmuje `name` lub komponent lucide,
      - ustawia default `size` i `strokeWidth`,
      - nie pozwala “na skróty” kolorować ikon w nawigacji (tylko przez kolor tekstu rodzica),
      - wspiera a11y (`aria-hidden` / `title` tam gdzie potrzebne).
    - integracja z dynamic icons:
      - w repo jest `src/components/shared/DynamicIcon.tsx` oraz kilka lokalnych kopii `DynamicIcon` w widokach — V2: ujednolicamy to do jednego miejsca + tych samych tokenów.
  - Mapping library (MUST):
    - jedna mapa ikon dla:
      - akcji (add/edit/delete/download/search/filter),
      - statusów (success/warn/danger/info),
      - modułów (MyWork, Assessment, Initiatives, Billing, Partner),
    - mapping jest używany w UI zamiast “random icon choice”.
  - Migration (MUST):
    - ograniczamy “manual size/color drift”:
      - stopniowo zamieniamy `size={...}` i `className="text-..."` na tokeny/wrapper,
      - priorytet: sidebar + top bars + module hubs + MyWork + public pages (T095/T100).
  - i18n & a11y (MUST):
    - ikony dekoracyjne zawsze `aria-hidden`,
    - ikony w buttonach mają label przez tekst obok lub `aria-label` na buttonie (nie polegamy na samej ikonie).
- OUT:
  - zmiana biblioteki ikon na inną (jeśli zostajemy na `lucide-react`) — post‑V2 tylko jeśli jest powód.

**Implementation notes (grounded w repo):**
- `lucide-react` jest już szeroko używane.
- `DynamicIcon` istnieje (`src/components/shared/DynamicIcon.tsx`), ale są też lokalne warianty w kilku plikach — V2 ujednolica.

**Definition of Done (DoD):**
- Jest 1 kanoniczny wrapper ikon + 1 kanoniczna mapa ikon.
- Sidebar, top bary, module hubs i główne ekrany używają tokenów ikon (rozmiar/stroke) i trzymają “text‑color”.
- Brak kolorowych ikon w nawigacji (poza aktywnym itemem) i brak mieszania stylów.

**Acceptance / test plan:**
- Test: przegląd kluczowych ekranów (Sidebar, MyWork, ModuleHub, Settings, Landing) — ikony mają spójne rozmiary i stroke, a kolorowanie jest zgodne z kanonem.
- Test: dark/light mode — kontrast i czytelność ikon ok.
- Test: mobile — ikony w bottom nav 18–22px, dotykalne, bez wizualnego chaosu.

---

## T102 — ⚫ ui/ux — Finalize Sidebar Design System (Buttons, Backgrounds & Expand Behavior) (ClickUp/Notion/Outlook-grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: “First impression” UI system (global navigation) TBD
- Priorytet / V2 scope: V2

**Twoje wymaganie (MUST):**
Wypracowujemy wygląd i zachowanie sidebaru, które stawia nas na równi z **ClickUp / Notion / Outlook** (plus “modern AI” feeling jak OpenAI/Google AI Studio), ale w naszej estetyce **Tech Sexy B2B SaaS enterprise**. To ma być **systemowe rozwiązanie**, nie “dopieszczenie jednego ekranu”.

**Business challenge (problem):**
Sidebar jest widoczny wszędzie i buduje “premium feel” w 2 sekundy. Jeśli jest niespójny (kolory, hover, spacing, ikony, expand/collapse), cała aplikacja wygląda jak zbiór modułów. Dodatkowo mobile wymaga innych mechanik (drawer + bottom nav) — bez systemu będzie chaos i regresje.

**Cel (outcome, nie feature):**
W V2 sidebar jest:
- **spójny wizualnie** (monochrome chrome + invisible borders + outline icons),
- **przewidywalny** (jedna logika active/hover/disabled/badges),
- **produktywny** (klawiatura, szybkie przełączanie, brak “pixel hunting”),
- **responsywny** (desktop/tablet: expand/collapse; mobile: drawer + bottom nav),
- **gotowy do skalowania** (kolejne moduły i role nie psują layoutu).

**Kanon / SSOT (już w repo):**
- “Tech Sexy” visual language: `docs/ui-standards/00-foundation/visual-language.md`
- Sidebar faza w planie migracji: `docs/ui-standards/TECH_SEXY_MIGRATION_PLAN.md` → **Faza 4 (Sidebar)**
- Ikony (T101): outline, mono-weight, kolor = kolor tekstu (bez kolorowych ikon w nawigacji poza active)

**Scope (V2)**
- IN:
  - Sidebar layout tokens (MUST):
    - dwa stabilne rozmiary:
      - **expanded**: ~256px (standard app sidebar),
      - **collapsed**: ~64px (icons-only),
    - item height i padding stałe (touch-friendly min 44px na urządzeniach dotykowych),
    - “one-line labels” + ellipsis + tooltip (bez łamania na 2 linie).
  - Background / layering (MUST):
    - sidebar bg = **Layer 0** (`bg-navy-950`),
    - content area bg = **Layer 1** (`bg-navy-900`) — separacja tłem, nie borderem,
    - brak `border-right` jako domyślnej separacji (invisible borders).
  - Nav item system (MUST):
    - stany: default / hover / active / parent-active / disabled(locked) / “badge” (new/beta/soon),
    - hover = zmiana tła (bg-only), bez border shift, zgodnie z Tech Sexy,
    - active indicator (subtelny accent) jest spójny na wszystkich itemach.
  - Expand/Collapse behavior (MUST):
    - expanded: ikona + label + prawa strona (badge/chevron/lock) jak w `NavItem`,
    - collapsed: icons-only + tooltip; jeśli item ma subItems → **floating submenu** (ClickUp-like) działa stabilnie,
    - preferencja collapsed/expanded jest persisted per user (server-side jeśli jest; fallback localStorage).
  - Floating submenu system (MUST):
    - działa tylko gdy ma sens (collapsed lub item ma children),
    - positioning bez wychodzenia poza viewport,
    - keyboard + a11y: focus trap w menu, ESC zamyka, enter wybiera.
  - Grouping / hierarchy (MUST):
    - sekcje/grupy nav (np. “MODULES”, “ADMIN”, “SETTINGS”) używają kanonicznego stylu:
      - `uppercase`, `text-[11px]`, `text-muted`, spacing (ClickUp/Notion pattern),
    - brak “miksu” stylów pomiędzy grupami.
  - Role-based visibility (MUST):
    - Admin / SuperAdmin / Partner / Org są widoczne wg roli,
    - stany “locked” są czytelne, ale nie frustrują (tooltip: “what to do to unlock”).
  - Mobile behavior (MUST, spójne z T100):
    - na mobile: sidebar nie jest stałą kolumną — otwiera się jako drawer,
    - primary nav na mobile: bottom nav (już istnieje),
    - drawer sidebar: szybkie zamknięcie, safe area, touch targets.
  - Icon consistency (MUST, zależność od T101):
    - nav icons: 18–20px, outline mono-weight,
    - kolor ikony = kolor tekstu (poza active).
- OUT:
  - pełna przebudowa architektury nawigacji (routing/rekompozycja modułów) — to osobny epik,
  - “spaces/workspaces builder” jak w Notion/ClickUp (może być post‑V2), ale sidebar ma być gotowy wizualnie na takie rozszerzenia.

**Implementation notes (grounded w repo):**
- Sidebar jest już komponentowo rozbita:
  - `src/components/navigation/Sidebar/Sidebar.tsx`
  - `NavItem.tsx`, `SidebarHeader.tsx`, `SidebarFooter.tsx`, `FloatingSubmenu.tsx`, `menuConfig.ts`
- Jest rozróżnienie mobile/tablet/desktop przez `useDeviceType`.
- W `NavItem` widać realne state’y (active/parent-active/locked/badges) i touch-friendly padding.
- `TECH_SEXY_MIGRATION_PLAN.md` ma konkret: layer0/layer1 + group labels + hover bg-only.

**UX polish requirements (V2 “enterprise-grade”):**
- Zero “debug noise”: brak `console.log` w podstawowych ścieżkach nawigacji (logi tylko za flagą debug).
- Motion: 160–220ms transitions, brak agresywnych animacji, respects reduced-motion.
- Contrast & readability: dark/light oba premium (bez czystej bieli/czerni).

**Analytics / metrics:**
- `sidebar_item_clicked` (itemId, viewId, deviceType, collapsed)
- `sidebar_collapsed_toggled` (from,to)
- `sidebar_flyout_opened` (itemId)
- KPI: time-to-navigation (proxy), misclick rate (proxy: immediate back), adoption collapsed mode.

**Risks:**
- Zbyt dużo “koloru” w nav → łamie Tech Sexy (monochrome chrome).
- Hover-only affordances na touch → musi mieć alternatywy (tap, long-press lub jawne CTA).
- Rozjazd między desktop i mobile — V2 musi mieć 1 system zachowań.

**Definition of Done (DoD):**
- Sidebar jest spójny wizualnie i behawioralnie na desktop/tablet/mobile (drawer + bottom nav).
- Expand/collapse jest przewidywalne, persisted i nie psuje nawigacji ani submenus.
- Ikony i stany hover/active/disabled spełniają Tech Sexy + T101.
- Brak regresji a11y (keyboard nav, focus, tooltips/aria).

**Acceptance / test plan:**
- Test: desktop — przełącz expanded/collapsed, nawiguj po wszystkich top-level modules, sprawdź flyout na itemach z subItems.
- Test: mobile — otwórz sidebar z bottom nav “More”, kliknij 3 różne moduły, sidebar się zamyka, safe-area ok.
- Test: role-based — admin vs user: widoczność itemów i locked tooltips.
- Test: dark/light — czytelność, brak “kolorowych ikon” w nav.

---

## T103 — ⚫ ui/ux — Typography Optimization for Light & Dark Mode (Premium Standard) (readability = enterprise)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Tech Sexy UI consistency (readability polish) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Consultify to aplikacja do długiej pracy (czytanie analiz, decyzji, raportów, list). Jeśli typografia i kontrast nie są “world‑class” w light/dark, użytkownik szybciej się męczy, popełnia błędy i UI traci premium feel (nawet gdy funkcje są świetne).

**Cel (outcome, nie feature):**
W V2 typografia ma być **enterprise‑grade readability** w light i dark:
- stabilna hierarchia (typography as architecture),
- spójne wagi (semibold zamiast bold),
- spójne odstępy (line-height, spacing),
- brak “pływania” kolorów tekstu i kontrastu między modułami.

**Kanon / SSOT (już istnieje):**
- `docs/ui-standards/00-foundation/visual-language.md` → “Typography as architecture” + zasada **no `font-bold` na nagłówkach**
- `docs/ui-standards/TECH_SEXY_MIGRATION_PLAN.md` → Faza 6 (Typography audit: `font-bold` → `font-semibold`, `text-white` → `text-slate-100`)

**Scope (V2)**
- IN:
  - Global hierarchy rules (MUST):
    - nagłówki i sekcje: `font-semibold` (nie bold),
    - uppercase tylko dla małych labeli (np. group labels `text-[11px]`), nigdy dla tytułów,
    - spójne skale: title / section title / label / helper / body / caption.
  - Light/Dark contrast refinement (MUST):
    - usuwamy czyste `text-white` jako domyślną warstwę tekstu w dark (zastępujemy `text-slate-100` / `text-slate-200`),
    - “muted” i “secondary” mają być czytelne (nie zbyt blade),
    - linki i CTA mają mieć spójny kontrast bez krzyku (monochrome chrome).
  - Spacing + line-height (MUST):
    - długie bloki tekstu (chat odpowiedzi, opisy, raporty) mają kontrolowany line-height i max width tam gdzie to poprawia czytelność,
    - listy i tabelki: density spójna, bez “skakania” między ekranami.
  - Targeted rollout (V2):
    - priorytet: Sidebar + Header + MyWork + N/C detail views + Chat (T104) + public pages (T095),
    - admin/superadmin: tylko jeśli są krytyczne regresje; inaczej po “core UX”.
- OUT:
  - zmiana font family (post‑V2) — w V2 tylko tuning hierarchii/kontrastu/spacing.

**Implementation notes (grounded w repo):**
- globalne tokeny typografii istnieją w `index.css` (`--hig-font-*`, `--hig-text-*`),
- w kodzie jest dużo “lokalnych” stylów (`font-bold`, `text-white`) — V2 to normalizuje wg kanonu.

**Definition of Done (DoD):**
- Najważniejsze ekrany mają spójną hierarchię i “quiet luxury” readability w light/dark.
- Nie ma masowych `font-bold` w headingach (poza edge cases: ceny/critical).
- Kontrast spełnia WCAG AA dla podstawowych tekstów.

**Acceptance / test plan:**
- Test: porównanie light vs dark na: Sidebar, MyWork, Detail view (N/C), Chat, Landing — czytelność bez “przepaleń” i bez “bladego” tekstu.
- Test: długie treści (raporty/AI) — czyta się komfortowo (line-height, spacing, brak ciasnoty).

---

## T104 — ⚫ ui/ux — GPT‑Level Chat UI/UX for DBR77 Chat Interface (minimal noise, maximum clarity)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI interface polish (core UX) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Chat jest głównym interfejsem AI. Jeśli jest głośny wizualnie, niespójny albo “gubi” kontekst (split/full, history, artifacts), użytkownik nie ufa odpowiedziom i nie chce pracować długo. Benchmark jest brutalny: ChatGPT desktop.

**Cel (outcome, nie feature):**
W V2 chat ma być “GPT‑level”:
- **czytelny** jak dokument (typografia + spacing),
- **szybki** (perceived performance, brak lag),
- **operacyjny** (jasne akcje: edit/regenerate/copy/feedback; narzędzia i tool calls są zrozumiałe),
- **spójny** w split i full (ten sam język UI),
- **bez rozpraszaczy** (monochrome chrome, 1 akcent koloru).

**Scope (V2)**
- IN:
  - Message readability (MUST):
    - wyraźny podział role (user/ai) bez krzykliwych bąbelków,
    - lepsza typografia dla markdown (nagłówki, listy, code blocks) w light/dark,
    - “long answer ergonomics”: nagłówki sekcji, whitespace, anchors/TOC post‑V2 jeśli potrzebne.
  - Composer / input (MUST):
    - sticky input (na mobile w zasięgu kciuka),
    - attachment/tools/voice są dostępne, ale nie dominują UI,
    - jasny stan “AI typing/streaming” + możliwość Stop.
  - Actions & density (MUST):
    - akcje wiadomości (copy/edit/regenerate/feedback) pojawiają się na hover (desktop) i są dostępne przez menu (touch),
    - redukcja wizualnego szumu: ikony tylko tam gdzie mają funkcję (T101),
    - “tool calls” są czytelne jako karty (status, expand args/results) bez zalewania ekranu.
  - History / navigation (MUST):
    - historia rozmów jako panel boczny (trigger zawsze w znanym miejscu),
    - przełączanie rozmów bez utraty kontekstu split workspace (stabilny displayMode).
  - Artifacts integration (MUST):
    - artifact badges i “save/export artifact” są spójne i nie rozbijają layoutu,
    - citations (jeśli występują) są czytelne i kompaktowe.
  - Split vs Full (MUST):
    - jeden komponent “source of truth” dla obu trybów (unikamy driftu),
    - w split: respektujemy maxHeight i brak overflow bugów,
    - w full: wykorzystujemy przestrzeń i nie wyglądamy jak “rozciągnięty panel”.
  - Mobile (MUST, spójne z T100):
    - duże touch targets,
    - safe area,
    - brak hover-only krytycznych akcji.
- OUT:
  - pełna przebudowa architektury czatu i store — V2 skupia się na UI/UX polish i spójności.

**Implementation notes (grounded w repo):**
- Rdzeń czatu istnieje:
  - `src/components/AIChat/UnifiedChatPanel.tsx` (split/full, history, streaming, voice, artifacts),
  - `src/components/layout/ChatPanel.tsx` (message actions, tool call cards, voice),
  - `ChatSlidingPanel`, `MessageRenderer`, `ResponseActions`, `ConversationList`.
- V2: UI polish ma się oprzeć o Tech Sexy (visual-language) + typografię (T103).

**Analytics / metrics:**
- `chat_message_sent` / `chat_regenerate_clicked` / `chat_message_edited`
- `chat_tool_call_expanded` (czy ludzie rozumieją narzędzia)
- KPI: session length, drop-off, copy rate, regen rate, satisfaction feedback.

**Definition of Done (DoD):**
- Chat wygląda i działa premium w split i full, light i dark, desktop i mobile.
- Akcje są intuicyjne i nie wymagają “szukania”.
- Tool calls, artifacts i streaming nie psują czytelności.

**Acceptance / test plan:**
- Test: split mode — praca w module + chat równolegle (brak overflow/scroll bugów, input zawsze dostępny).
- Test: full mode — długie odpowiedzi, code blocks, citations, tool calls (czytelne, nie “rozjeżdżają” UI).
- Test: mobile — wysyłanie, stop streaming, copy/edit przez menu, safe area.

---

## T105 — ⚫ ui/ux — Chat Navigation & Button Design Refinement (add 3rd “Business” button + clear hierarchy)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI interface polish (navigation + actions) TBD
- Priorytet / V2 scope: V2

**Twoja myśl (MUST):**
Dokładamy **trzeci przycisk specjalistyczny** dla naszej aplikacji — “business functions” czatu. Ma to być szybki, przewidywalny entrypoint do operacyjnych akcji (enterprise B2B SaaS).

**Business challenge (problem):**
Chat bez jasnej nawigacji i bez “business command” zachowuje się jak zwykłe okno rozmowy. W Consultify chat ma prowadzić do pracy: drafty, decyzje, raporty, akcje do zatwierdzenia. Bez 3-ciego przycisku użytkownik nie ma pewnego “one place” do tych funkcji i gubi się między historią, rozmową i pending actions.

**Cel (outcome, nie feature):**
W V2 chat ma prostą, czytelną nawigację z jasną hierarchią:
- **New** (nowa rozmowa),
- **History** (panel historii),
- **Business / Actions** (specjalistyczny przycisk do funkcji biznesowych czatu),
plus istniejące kontrolki pomocnicze (np. auto-read) po prawej stronie — bez wizualnego szumu.

**Scope (V2)**
- IN:
  - 3rd specialist button: “Business / Actions” (MUST):
    - umieszczony w headerze czatu obok `New` i `History` (po lewej),
    - ikona mono (outline, text-color) zgodna z T101,
    - tooltip + a11y label (PL/EN),
    - opcjonalny badge/licznik (np. liczba pending actions) — bez krzykliwego koloru.
  - Behavior (MUST):
    - klik “Business” otwiera **Action Center** czatu:
      - minimalnie: widok `AI Actions` (`/ai-actions` → `ActionProposalView`),
      - spójne z istniejącym `PendingActionsIndicator` (onViewAll) i z `useAIActionsStore`.
    - zachowanie musi być spójne w split/full:
      - **split**: otwarcie Action Center nie może “gubić” kontekstu pracy (workspaceContext); preferowane jako drawer/panel lub nawigacja z łatwym powrotem,
      - **full**: może być nawigacja do `/ai-actions` w tej samej zakładce z jasnym “Back to chat”.
  - Visual hierarchy & density (MUST):
    - wszystkie przyciski w headerze mają identyczną geometrię (hit-area, radius, hover bg-only),
    - monochrome chrome: kolory tylko dla aktywnego stanu / semantyki; reszta “text-muted”,
    - brak “button soup”: jeśli rośnie liczba kontroli — konsolidujemy do menu, nie dokładamy kolejnych ikon.
  - Touch & mobile (MUST, spójne z T100):
    - brak hover-only affordances dla krytycznych akcji,
    - minimum 44×44px tap target,
    - na mobile “Business” jest dostępny zawsze (nie chowa się).
  - Keyboard (SHOULD):
    - skrót do Action Center (np. `Cmd/Ctrl+Shift+A`), z zachowaniem dostępności i bez konfliktów.
- OUT:
  - przebudowa całego menu aplikacji (to osobne epiki),
  - pełny CRM/pipeline w czacie (post‑V2).

**Implementation notes (grounded w repo):**
- Header czatu już ma 2 przyciski po lewej (New + History) w `src/components/AIChat/UnifiedChatPanel.tsx`.
- “Business functions” już istnieją jako system AI Actions:
  - `PendingActionsIndicator` w UnifiedChatPanel,
  - `ActionProposalView` dostępny pod `/ai-actions` (AppRoutes),
  - store: `useAIActionsStore`.
- V2: 3-ci przycisk ma być spójnym entrypointem do tego systemu (nie nowy byt obok).

**Analytics / metrics:**
- `chat_business_button_clicked` (mode split/full, deviceType, pendingCount)
- `ai_actions_view_opened` (source=chat_button vs indicator)
- KPI: % users who review/approve actions, time-to-approve, reduction w “where do I find pending actions?” friction.

**Definition of Done (DoD):**
- W headerze czatu istnieje 3-ci przycisk “Business/Actions” z poprawną hierarchią i a11y.
- Przycisk otwiera Action Center i działa spójnie w split/full/mobile.
- UI przycisków i nawigacji czatu jest spójne z Tech Sexy + T101.

**Acceptance / test plan:**
- Test: klik “Business” w split → Action Center otwiera się bez utraty workspace context i da się wrócić do czatu.
- Test: badge/pending count (jeśli włączone) zgadza się z pending actions.
- Test: mobile — tap targets i safe area; brak ukrytych akcji.

---

## T106 — 🩷 feedback — Advanced User Feedback System (Full Feedback Flow) (100% traceability, triage, learning)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Product learning loop (enterprise feedback) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez systemowego feedback loop:
- zgłoszenia giną (brak ownera, statusu, SLA),
- nie uczymy produktu z danych (brak kategorii, trendów, duplikatów, root-cause),
- rośnie frustracja użytkowników (“wysłałem i nic się nie dzieje”),
- a zespół ma chaos (brak priorytetyzacji i routing’u).

**Cel (outcome, nie feature):**
W V2 feedback jest “enterprise-grade”:
- **łatwy do wysłania** w 15–60 sekund (bug/idea/pulse/feature request),
- **w pełni śledzalny** (kto/co/gdzie/kiedy/jaki kontekst + status + odpowiedź),
- **triage-ready** (kategoryzacja, severity/impact, duplikaty, priorytet),
- **zamykany** (odpowiedź do użytkownika + statusy + audit),
- **uczący produkt** (trending topics + AI analysis + raporty).

**Scope (V2)**
- IN:
  - Capture UX (MUST):
    - 1 entrypoint w aplikacji (panel feedback) + szybka ścieżka “pulse”,
    - typy:
      - Bug report (z severity),
      - Idea (lekka),
      - Feature request (z impact + category),
      - Quick pulse (1–5 rating + optional comment).
    - potwierdzenie po wysyłce + ID zgłoszenia.
  - Context & metadata (MUST):
    - zapisujemy kontekst:
      - route/path (`window.location.pathname`),
      - device (mobile/tablet/desktop), screen size, user agent,
      - język UI + theme (light/dark),
      - workspace context (jeśli dostępne: viewId, projectId, entityId),
      - timestamp,
      - (opcjonalnie) screenshot / attachment (post‑V2 jeśli storage niegotowe).
  - Status system (MUST):
    - kanoniczne statusy (backend już je ma):
      - `NEW` → `PENDING` → `IN_PROGRESS` → `REVIEWED` → `RESOLVED` → `ARCHIVED`
    - UI admin/superadmin musi być spójny z tymi statusami (koniec legacy `READ`).
  - Admin/SuperAdmin triage (MUST):
    - lista feedbacku z filtrami (status/type/severity/organization) + search,
    - widok szczegółu zgłoszenia:
      - pełny message,
      - kontekst/metadata,
      - historia zmian statusu,
      - odpowiedź admina (i notyfikacja do usera jeśli możliwe),
    - możliwość oznaczenia duplikatu (link do “master”).
  - AI analysis (MUST, jeśli włączone):
    - sentiment + keywords + priority scoring + podobne zgłoszenia,
    - zapis analizy do tabeli `feedback_analysis`,
    - endpointy: insights/trending/ai-analysis są częścią V2 (już istnieją).
  - Feature requests + voting (MUST):
    - zapis do `feature_requests`,
    - możliwość głosowania (`feature_votes`) (minimum: per user unique),
    - admin może ustawić status/target release/notes.
  - Notifications & routing (MUST):
    - dla `CRITICAL`: natychmiastowa notyfikacja wewnętrzna (NotificationService) + (opcjonalnie) WhatsApp alert,
    - dla pozostałych: batch/digest (post‑V2) lub standardowa notyfikacja.
  - Privacy & compliance (MUST):
    - metadata nie może przechowywać PII ponad to co konieczne,
    - user ma możliwość wyłączenia notyfikacji dot. odpowiedzi (prefs).
- OUT:
  - publiczny “roadmap portal” dla użytkowników (post‑V2),
  - pełny, zewnętrzny CRM ticketing (Jira/Linear) jako SSOT (post‑V2; w V2 można dodać `related_ticket_url`).

**Implementation notes (grounded w repo):**
- Backend już ma szeroki zakres:
  - `server/src/routes/feedback.routes.ts`:
    - `POST /api/feedback`, listowanie, status update, admin response,
    - `POST /api/feedback/pulse`, `POST /api/feedback/feature`,
    - trending + pulse summary + AI analysis endpoints.
- Data model już istnieje w migracji:
  - `server/migrations/200_enterprise_feedback_system.sql`:
    - `feedback_pulse`, `feature_requests`, `feature_votes`, `feedback_analysis`, `feedback_trending_topics`,
    - prefs i admin settings.
- Frontend entrypoint istnieje:
  - `src/components/Feedback/FeedbackSidePanel.tsx` (report/pulse/feature),
  - triage view istnieje, ale jest legacy/simplified:
    - `src/views/superadmin/SuperAdminFeedbackView.tsx` (wymaga ujednolicenia statusów i rozszerzenia o detail).

**Data model (V2, canonical):**
- `system_feedback` (bug/idea) + `feedback_analysis` (AI)
- `feedback_pulse` (rating)
- `feature_requests` + `feature_votes`
- `feedback_notification_prefs` (user prefs)
- `feedback_admin_settings` (global toggles)

**API contract (V2, minimal):**
- `POST /api/feedback` (bug/idea)
- `POST /api/feedback/pulse`
- `POST /api/feedback/feature`
- `GET /api/feedback` (admin list)
- `PATCH /api/feedback/:id/status`
- `POST /api/feedback/:id/respond`
- `GET /api/feedback/stats/summary`
- `GET /api/feedback/trending`
- `GET /api/feedback/ai-analysis/:id`

**Analytics / metrics:**
- `feedback_opened` / `feedback_submitted` (type, severity, context)
- `feedback_status_changed` (from,to)
- `feature_request_submitted` / `feature_vote_cast`
- KPI: time-to-first-triage, time-to-resolve, top trending topics, opt-out rate, volume per org/module.

**Risks:**
- Noise (za dużo zgłoszeń) → V2 musi mieć kategorie, severity, duplikaty, i szybki triage.
- Status mismatch między UI i backend → V2 wymaga kanonicznych statusów wszędzie.

**Definition of Done (DoD):**
- Użytkownik może wysłać bug/idea/pulse/feature request z kontekstem i dostać potwierdzenie.
- Admin/SuperAdmin widzi listę + detail i może zmienić status oraz odpisać.
- AI analysis (jeśli włączone) generuje insights/trending i zapisuje do DB.
- Działa routing dla CRITICAL (internal notification).

**Acceptance / test plan:**
- Test: z 3 różnych modułów wysłać feedback (BUG + IDEA + FEATURE) — payload zawiera poprawny context i zapisuje się w DB.
- Test: admin zmienia status i dodaje response — status się aktualizuje, response jest widoczne i audytowalne.
- Test: pulse rating zapisuje się i pojawia w pulse-summary.

---

## T107 — 🩷 feedback — System Stability & Uptime Assurance Framework (SLO, observability, deploy gates, recovery)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Platform reliability / “ready to show the world” operations
- Priorytet / V2 scope: V2 (blocking dla public launch)

**Business challenge (problem):**
Jeśli produkt ma być “ready to show the world”, to nie wystarczy feature set — potrzebujemy przewidywalnej stabilności:
- downtime, błędy 5xx, i degradacje AI/DB niszczą zaufanie,
- bez SLO i alertów nie wiemy, że coś się psuje,
- bez deploy gate’ów możemy wypchnąć regresję do production,
- bez backup/recovery planu ryzykujemy utratę danych.

**Cel (outcome):**
W V2 Consultify ma kompletny “uptime assurance framework”:
- szybkie wykrywanie degradacji + alerty,
- kontrolowane wdrożenia (gates) + rollback readiness,
- mierzalne SLO (API, DB, AI, background jobs),
- backup + recovery playbook + weryfikacja,
- minimalny “ops surface” do triage (SuperAdmin).

**Scope (V2)**
- IN (MUST):
  - **SLO + error budget** (MUST):
    - zdefiniowane SLO dla:
      - API uptime (np. 99.9%/30d),
      - p95 latency kluczowych endpointów,
      - 5xx rate,
      - AI service availability (LLM calls success rate / timeout rate),
      - cron jobs success rate (Backup, Dunning, Scheduler, HealthCheckJob).
    - zmapowane alert thresholds (np. 3x 5xx spike, readiness=503 > X min).
  - **Health endpoints & readiness/liveness** (MUST):
    - jeden “kanoniczny” zestaw endpointów do monitoringu:
      - `/ping`
      - `/api/ready` (gating DB init)
      - `/api/health/*` (DB pool health itp.)
      - `/api/system/*` (system health + encryption)
    - spójny kontrakt odpowiedzi (status, timestamp, komponenty, degraded vs down).
  - **Observability** (MUST):
    - error monitoring (Sentry) w prod/staging,
    - correlation/request id end‑to‑end w logach (RequestStore),
    - metryki Prometheus:
      - `/api/metrics` (stabilne, fail-open, bez PII),
      - kluczowe counters: requests_total, 5xx_total, latency buckets, rate-limit hits, AI timeouts, DB pool utilization.
  - **Alerting & escalation** (MUST):
    - krytyczne alerty (DB down, backup failures, readiness fails) idą co najmniej email + wewnętrzna notyfikacja; opcjonalnie WhatsApp.
    - anti-spam: dedupe, “recovered” event po powrocie (tak jak `HealthCheckJob`).
  - **Deploy gates (automatyczne checki przed/po deploy)** (MUST):
    - Playwright “smoke / deploy-gate” jest traktowany jako gate:
      - krytyczne ścieżki: login, pages render, API appcore/billing/interview/projects/org.
    - gate musi odpalić się na staging i/lub przed promocją do production.
  - **Recovery & backups** (MUST):
    - cron backup + retention działa i raportuje metryki (success/failure),
    - manual backup endpoint/tooling dla SuperAdmin (jeśli istnieje) lub procedura operacyjna,
    - test restore procedure (min. “table-level sanity check”).
  - **Stability hardening** (MUST):
    - produkcja nie wystawia stub routes (już jest mechanizm w `ApiGateway`, trzeba domknąć coverage),
    - timeouty + retry policy dla zewnętrznych zależności (LLM, Stripe, email),
    - graceful shutdown z cleanup (ShutdownManager) i brak utraty inflight requestów.
- OUT (post‑V2):
  - pełna, publiczna status page (external) + incident comms portal,
  - distributed tracing (pełne OTel) jeśli koszt/effort zbyt duży na V2.

**Implementation notes (grounded w repo):**
- Serwer ma już solidne fundamenty:
  - startup gating: `/api/ready` + 503 “SERVER_STARTING” gate w `server/src/index.ts`,
  - health/readiness/liveness: `HealthCheckController` + `server/src/routes/health.routes.ts`,
  - Prometheus endpoint: `server/src/routes/metrics.routes.ts`,
  - Sentry fail-open: `server/src/config/SentryConfig.ts`,
  - cron DB check + email alerts: `server/src/cron/HealthCheckJob.ts`,
  - backup cron + retention + failure thresholds: `server/src/cron/BackupCron.ts`,
  - stabilization endpoints for superadmin: `server/src/routes/stabilization.routes.ts`,
  - system health endpoints: `server/src/routes/systemHealth.routes.ts`.
- T107 w V2 to nie “dodaj endpoint” — to **ujednolicenie kontraktów, alertów, metryk i gate’ów** + minimalny runbook.

**Deliverables (V2):**
- SLO spec (w tym doc w `docs/ops/` lub sekcja w planie) + alert thresholds.
- Spójne health contracts + dashboard (SuperAdmin) agregujący:
  - readiness/health/system-health/backup status,
  - ostatnie 24h: error rate, 5xx, latency, AI timeouts, backup success.
- Deploy gate pipeline: “smoke suite” jako wymóg release.
- Recovery playbook + test restore checklist.

**Analytics / metrics:**
- `uptime_readiness_fail` (duration, component)
- `backup_job_failed` / `backup_job_recovered`
- `deploy_gate_failed` (suite, spec)
- `api_5xx_spike_detected`

**Definition of Done (DoD):**
- Jest zdefiniowane i wdrożone SLO + alerting (przynajmniej dla DB/backup/5xx spikes).
- Health/readiness/liveness mają spójne kontrakty i są wykorzystywane w monitoringu.
- `/api/metrics` działa stabilnie i zasila dashboard.
- Deploy gate (Playwright smoke) blokuje release przy regresji.
- Backup + retention działa; istnieje udokumentowany i zweryfikowany proces restore.

**Acceptance / test plan:**
- Test: symulacja “DB down” → alert idzie raz, potem “RECOVERED” po powrocie.
- Test: backup fail 3 razy → powstaje CRITICAL alert.
- Test: deploy gate wyłapuje break w krytycznej ścieżce (celowa zmiana) i blokuje deploy.
- Test: `/ping`, `/api/ready`, `/api/health/database`, `/api/system/detailed` działają zgodnie z kontraktem.

---

## T108 — 🩷 superadmin — Full Superadmin Control & System Testing Framework (control plane + guardrails + CI confidence)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Operations / Control Plane / Quality Gate
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
W V2 nie da się operować produktem “na czucie”. Potrzebujemy:
- kompletnego, bezpiecznego panelu SuperAdmin (obsługa klientów, billing, legal, AI, system),
- narzędzi do szybkiego triage (health, audit, metrics),
- oraz frameworku testów, który daje pewność deploy’a (gates, bootstrapping e2e, kontrakty).

**Cel (outcome):**
SuperAdmin jest **systemowym control plane** (bez ręcznych SQL / “grzebania na serwerze”), a testy są częścią release’ów:
- 1) wszystko, co krytyczne operacyjnie jest dostępne w SuperAdmin,
- 2) wszystkie akcje administracyjne są bezpieczne (guardrails) i audytowalne,
- 3) CI ma stabilne, powtarzalne testy (unit/integration/e2e) i “deploy gates” blokujące regresje.

**Scope (V2)**
- IN (MUST) — SuperAdmin Control Plane:
  - **AuthZ & security**:
    - superadmin guard jest nie do obejścia (`verifySuperAdmin` sprawdza token + DB),
    - rate limiting na superadmin endpoints,
    - wszystkie “high‑risk actions” wymagają:
      - explicit confirmation,
      - podania “reason”,
      - audytu (kto/kiedy/co/na czym).
  - **Customers / Users**:
    - zarządzanie organizacjami i użytkownikami (CRUD w zakresie V2),
    - access requests / access codes (approval workflow),
    - impersonation (tylko SuperAdmin, logowane, z jasnym UI indicator i “exit impersonation”).
  - **System**:
    - health monitoring (API/DB/AI), metrics, backup status, feature flags, audit log,
    - narzędzia “safely diagnose” (bez wycieku PII/secrets).
  - **Revenue / Billing ops**:
    - podgląd i podstawowe operacje billing (invoices, usage, settlements) zgodnie z istniejącymi route’ami.
  - **Legal / Compliance**:
    - zarządzanie dokumentami prawnymi + publikacja + audit acceptance events (spójne z T093).
  - **AI Platform ops**:
    - configuration/operations/analytics w jednym miejscu (nie “legacy chaos”), z jasnym podziałem na taby.
- IN (MUST) — System Testing Framework:
  - **Deploy gates**:
    - Playwright smoke suite jest gate’em release (patrz istniejące `tests/e2e/smoke/deploy-gate-*`).
  - **Test support API (E2E bootstrap/cleanup)**:
    - endpointy bootstrap/cleanup są dostępne wyłącznie w `NODE_ENV=test` + `ENABLE_TEST_SUPPORT=true` + secret header,
    - generują test tenant + token i czyszczą dane per runId (repeatable runs).
  - **Contract + integration tests (backend)**:
    - kluczowe middleware (auth, rbac/superadmin, validation, rate limiting, sanitization) mają testy kontraktowe (już są w `tests/unit/backend/...` — V2 domyka coverage dla superadmin/test-support).
  - **“No stubs in production”**:
    - produkcja nie wystawia 501 stub routes (wspierane przez gating w `ApiGateway`; V2 musi objąć krytyczne ścieżki).

**Implementation notes (grounded w repo):**
- SuperAdmin UI już istnieje jako modularny panel:
  - `src/views/superadmin/SuperAdminView.tsx` (Overview/Customers/AI Platform/System/Revenue/Security/Configuration/Analytics),
  - system tab ma Enterprise panele (`EnterpriseHealthMonitor`, `EnterpriseBackupPanel`, `EnterpriseAuditLog`, `EnterpriseFeatureFlags` itd.).
- Backend ma superadmin router:
  - `server/src/routes/superadmin.routes.ts` (wiele endpointów, część przez legacy controller wrapper).
- Guard:
  - `server/src/middleware/superAdmin.middleware.ts` (token + DB truth; ustawia `req.user.isSuperAdmin`).
- Test harness:
  - `server/src/routes/testSupport.routes.ts` (bootstrap/cleanup, hard‑gated i “looks like 404” gdy wyłączone),
  - montowane tylko w test (`Gateway.ts`).

**Guardrails (MUST, V2):**
- Każda destrukcyjna operacja w SuperAdmin:
  - wymaga reason + confirmation,
  - jest logowana (audit trail),
  - ma “dry‑run” / preview, gdy to ma sens (np. bulk ops).
- Impersonation:
  - zawsze logowane + wyświetlane w UI + łatwe wyjście.
- Sekrety i tokeny:
  - nigdy nie renderujemy w UI w formie “copy/paste” bez explicit intent + masking,
  - logi/metriki nie zawierają PII/secrets.

**Deliverables (V2):**
- “SuperAdmin completeness map”: lista kluczowych operacji i gdzie są w UI (bez martwych linków).
- Ujednolicone kontrakty API dla SuperAdmin (error codes, statusy, validation).
- Audyt działań administracyjnych (min. high‑risk actions).
- Test harness działa w CI i lokalnie:
  - bootstrap/cleanup,
  - smoke deploy gates,
  - kontrakty middleware.

**Analytics / metrics:**
- `superadmin_action_executed` (actionType, targetType, targetId, reason, success/failure)
- `superadmin_impersonation_started` / `superadmin_impersonation_ended`
- `test_support_bootstrap_called` / `test_support_cleanup_called` (env, runId)
- KPI: time-to-triage, time-to-fix, deploy gate failure rate, mean time to recover (z T107).

**Definition of Done (DoD):**
- SuperAdmin obejmuje krytyczne obszary operacyjne i jest spójny (brak “martwych” modułów).
- High‑risk actions mają guardrails + audyt.
- Test support API jest bezpieczne i działa w CI (nigdy w prod).
- Deploy gate (smoke) blokuje release przy regresji i jest stabilny.

**Acceptance / test plan:**
- Test: superadmin login → dostęp do Customers/System/Revenue/AI Platform bez błędów 403 (dla SUPERADMIN).
- Test: impersonation → widoczny banner + audit event + “exit impersonation”.
- Test: w trybie testowym:
  - `POST /api/test-support/bootstrap` tworzy tenant i token,
  - `POST /api/test-support/cleanup` czyści dane i usuwa tenant.
- Test: smoke deploy gate przechodzi na staging i blokuje deploy przy intencjonalnej regresji.

---

## T109 — 🩷 superadmin — Payment System Integration (Stripe subscriptions + token billing + webhooks + dunning + SuperAdmin ops)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & Trust (trial → paid, billing ops, revenue integrity)
- Priorytet / V2 scope: V2 (monetyzacja, launch‑critical)

**Business challenge (problem):**
Monetyzacja w V2 nie może być “symboliczna”. Musi działać end‑to‑end:
- jasny zakup/upgrade/cancel,
- spójne statusy subskrypcji w aplikacji,
- niezawodne webhooks (bez fałszywych eventów),
- dunning i odzyskiwanie płatności,
- superadmin ops: faktury, metody płatności, plany, zmiany subskrypcji, spory/zwroty (w zakresie V2).

**Cel (outcome):**
W V2 użytkownik może przejść z trial do paid bez tarcia, a system jest audytowalny i “enterprise‑ready”:
- Stripe jest **SSOT dla płatności**, a DB jest **SSOT dla dostępu/stanów w aplikacji** (spójne mapowanie),
- webhooks są podpisane i idempotentne,
- billing w UI i SuperAdmin pokazuje prawdziwe dane (nie placeholdery),
- payment failure ma proces odzysku (dunning) i kontrolowane ograniczanie dostępu (zgodnie z T091–T092).

**Scope (V2)**
- IN (MUST):
  - **Stripe configuration & environments**:
    - spójny zestaw env:
      - `STRIPE_SECRET_KEY` (required w prod),
      - `STRIPE_WEBHOOK_SECRET` (required w prod),
      - `STRIPE_PUBLISHABLE_KEY` (frontend),
      - `FRONTEND_URL` (redirects),
    - tryb test/staging odseparowany (keys + webhook endpoints).
  - **Subscription billing**:
    - tworzenie subskrypcji / checkout flow:
      - start płatnej subskrypcji (trial→paid),
      - upgrade/downgrade z proration policy,
      - cancel (end of period lub natychmiast — zgodnie z polityką),
    - mapowanie planów w DB ↔ Stripe Price/Product:
      - plan ma `stripe_price_id` (lub mapping table),
      - subscription events zapisane w DB (audit).
  - **Payment methods (cards) — PCI‑safe**:
    - dodanie karty przez Stripe SetupIntent,
    - zapis tylko bezpiecznych metadanych (brand/last4/exp), nigdy PAN/CVC,
    - default payment method per organization.
  - **Invoices & credit notes**:
    - lista faktur w UI i SuperAdmin,
    - integracja z Stripe invoice PDF gdy dostępne,
    - obsługa manual invoice gaps (jeśli zostaje “GAP-INVOICE-*” to musi być świadomie OUT lub domknięte).
  - **Webhooks (Stripe) — secure & reliable**:
    - **jeden kanoniczny handler** z `express.raw({ type: 'application/json' })`,
    - w prod: **obowiązkowa weryfikacja podpisu** (`stripe.webhooks.constructEvent`),
    - idempotency:
      - zapis `event.id` i “processed_at” (dedupe),
      - retry queue na błędy (max retries, backoff),
    - obsługiwane eventy minimum:
      - `customer.subscription.created|updated|deleted`,
      - `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`,
      - (opcjonalnie) `checkout.session.completed` dla token billing.
  - **Dunning & recovery**:
    - payment_failed → dunning stages + komunikacja (email),
    - recovered → odblokowanie / exit dunning,
    - final suspension → ograniczenie dostępu zgodnie z AccessPolicy (T091–T092).
  - **SuperAdmin billing operations**:
    - przegląd organizacji z billing status (trial/active/past_due/canceled),
    - podejrzenie subskrypcji, payment methods, invoices,
    - podpięcie/zmiana planu (guardrails + reason + audit),
    - “grace period” visibility (jeśli wspierane przez `BillingCommandService`).
  - **Token billing (AI credits)**:
    - zakup paczek tokenów przez Stripe Checkout (oddzielny produkt/price),
    - webhook potwierdzenia kredytuje saldo (idempotentnie),
    - analytics marży/zużycia w SuperAdmin.
- OUT (post‑V2):
  - pełna “self‑serve customer portal” (Stripe Billing Portal) jeśli nie ma jeszcze endpointów,
  - automatyczne podatki / pełne tax engine (jeśli obecne komponenty UI to doprecyzować w osobnym tasku).

**Implementation notes (grounded w repo):**
- Backend billing:
  - `server/src/routes/billing/billing.routes.ts` ma już:
    - invoices, payment methods, setup intent, analytics endpoints, `BillingCommandService` hooks.
- Token billing:
  - `server/src/routes/tokenBilling.routes.ts` ma checkout purchase + webhook z `express.raw` i signature.
- Webhooks:
  - aktualnie `/api/webhooks/stripe` (w `server/src/routes/webhooks.routes.ts`) przyjmuje eventy **bez signature verification** → V2 MUSI to zastąpić kanonicznym, podpisanym webhookiem.
  - istnieje lepsza implementacja w `server/src/routes/webhooks/stripe.routes.ts` (raw body, signature, retry queue) — to powinno stać się kanonem.
- Dunning:
  - `server/src/services/dunningService.ts` obsługuje payment_failed/succeeded i stages.
- Frontend:
  - istnieją komponenty billing w `src/components/billing/*` i SuperAdmin revenue/billing views.
  - `src/services/api.ts` ma metody: subscribe/change/cancel, invoices, setup intent, add/remove payment methods, token billing flows.

**Data model (V2, canonical):**
- Organizations:
  - przechowujemy `stripe_customer_id`, `stripe_subscription_id` (albo w osobnej tabeli billing),
  - statusy billing: active / past_due / trial / canceled + grace period.
- Billing tables (już istnieją lub są implied przez routes):
  - `subscriptions`, `subscription_events`, `invoices`, `payment_methods`, `payment_attempts`,
  - webhook deliveries / retries (dla idempotency i triage).

**Analytics / metrics:**
- `billing_checkout_started` / `billing_checkout_completed` (planId, source=trial_upgrade/settings)
- `billing_subscription_changed` (fromPlan,toPlan)
- `billing_payment_failed` / `billing_payment_recovered`
- `token_purchase_started` / `token_purchase_completed`
- KPI: trial→paid conversion, churn, recovery rate (dunning), failed payment rate.

**Definition of Done (DoD):**
- Stripe subskrypcje działają end‑to‑end (subscribe/change/cancel) i stan w aplikacji jest spójny.
- Webhook Stripe jest podpisany, idempotentny i ma retry strategy; nie ma niepodpisanych handlerów w prod.
- Dunning działa (payment_failed → stages → recover/suspend) i jest widoczny w SuperAdmin.
- Token billing purchase + webhook kredytuje saldo idempotentnie.
- SuperAdmin pozwala na podstawowe billing ops z guardrails + audytem.

**Acceptance / test plan:**
- Test: trial→paid:
  - start checkout → webhook → org ma `active` + dostęp odblokowany.
- Test: payment_failed:
  - event `invoice.payment_failed` → org wchodzi w dunning + wysyła email; po `invoice.paid` wychodzi.
- Test: webhook security:
  - zły podpis → 400; poprawny → 200; duplikat event.id → no-op.
- Test: token purchase:
  - checkout.session.completed → saldo tokenów rośnie dokładnie raz (idempotency).

---

## T110 — 🩷 superadmin — Google Login Integration (OAuth/OIDC login + account linking + security events)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM / onboarding conversion / enterprise security
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
Hasło jako jedyna ścieżka logowania zwiększa friction (szczególnie trial→paid) i obniża trust. Potrzebujemy “enterprise‑grade” logowania Google:
- szybkie login/signup,
- bezpieczny flow (state/PKCE, anti‑CSRF),
- spójne sesje i audyt bezpieczeństwa,
- możliwość powiązania konta (password ↔ Google) bez duplikatów.

**Cel (outcome):**
Użytkownik może zalogować się / założyć konto przez Google w 1–2 kliknięcia, a system:
- tworzy lub mapuje usera deterministycznie,
- zapisuje powiązanie w DB (`oauth_links`) i loguje security events,
- kończy flow redirectem do aplikacji z ważnym tokenem (jak obecny `OAuthCallback` oczekuje).

**Scope (V2)**
- IN (MUST):
  - **Backend endpoints (kanoniczne):**
    - `GET /api/auth/google` (start auth; redirect do Google),
    - `GET /api/auth/google/callback` (code → tokens → user → redirect do frontend).
  - **Flow i security (MUST):**
    - authorization code flow z **state** (+ PKCE jeśli realizowane w server‑side flow),
    - state przechowywany w httpOnly cookie lub server‑side store (TTL),
    - anti-replay: jednorazowe użycie state, TTL ~10 min,
    - weryfikacja `email_verified` (Google) jako warunek automatycznego provisioningu (jeśli niezweryfikowany → blok + komunikat).
  - **User mapping / provisioning (MUST):**
    - jeśli istnieje `oauth_links(provider='google', provider_user_id)` → logowanie do przypisanego usera,
    - jeśli nie ma linka:
      - jeśli istnieje user o tym samym email → linkujemy konto (z audytem),
      - jeśli nie ma usera → tworzymy usera (jeśli polityka organizacji na to pozwala; w przeciwnym razie “pending/blocked”).
    - zapis do `oauth_links`:
      - `provider='google'`,
      - `provider_user_id` (sub),
      - `provider_email`,
      - tokens (encrypted) opcjonalnie (jeśli potrzebne do późniejszych integracji),
      - `last_login_at`.
  - **Session + audit (MUST):**
    - tworzymy standardowy token jak w pozostałych flow (ten sam format i TTL),
    - zapis security event: `login_success` z `auth_method='sso'` lub `auth_method='oauth'` (kanoniczne nazewnictwo V2),
    - logujemy `login_failed` z reason code (bez leak secretów).
  - **Frontend integration (MUST):**
    - przycisk już istnieje w `src/views/AuthView.tsx` i kieruje na `${API_URL}/auth/google`,
    - potrzebujemy kanonicznego frontend callback route (MUST):
      - `GET /oauth/callback` (mount `src/views/OAuthCallback.tsx`) **albo** inny stabilny endpoint,
      - backend po sukcesie redirectuje do `${FRONTEND_URL}/oauth/callback?token=...&user=...`.
  - **Org security policies (MUST):**
    - respektujemy ustawienia security org (np. “SSO only” vs allow password) jeśli są w `security_settings` / `sso_configurations`.
- OUT (post‑V2):
  - pełna Google Workspace domain enforcement + group mapping (jeśli nie jest potrzebne na V2),
  - pełna obsługa Google jako IdP przez `sso_configurations` (OIDC) jeśli wybierzemy inną ścieżkę w V2.

**Implementation notes (grounded w repo):**
- Frontend:
  - `AuthView.tsx` ma `handleGoogleLogin()` → `${API_URL}/auth/google`.
  - `OAuthCallback.tsx` już obsługuje redirect z `token` + `user` w query string (ale wymaga routingu).
- Backend:
  - `server/src/config/Config.ts` ma `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL`.
  - `server/src/routes/oauthRoutes.routes.ts` ma tylko `/oauth/status` i stuby → V2 wymaga realnych `/api/auth/google*`.
- DB:
  - `server/migrations/055_security_module.sql.sql` ma tabelę `oauth_links` (idealna do linkowania provider to user).

**API contract (V2):**
- `GET /api/auth/google` → 302 do Google
- `GET /api/auth/google/callback` → 302 do frontend callback z `token` i (opcjonalnie) `user`
- `GET /api/auth/oauth/status` → {google.configured, loginUrl}

**Analytics / metrics:**
- `oauth_login_started` (provider=google, source=auth_view)
- `oauth_login_succeeded` / `oauth_login_failed` (provider, reason)
- KPI: login conversion, time-to-login, % users using social login, reduction in password reset.

**Definition of Done (DoD):**
- Google login działa end‑to‑end (start → callback → token → redirect → user zalogowany).
- Powiązanie konta zapisuje się w `oauth_links` i nie tworzy duplikatów userów.
- Security events są logowane dla success/failure.
- Frontend ma stabilny callback route dla OAuth.

**Acceptance / test plan:**
- Test: pierwsze logowanie nowym kontem Google → powstaje user + oauth_link.
- Test: logowanie istniejącym mailem (password user) → linkowanie konta (bez duplikatu).
- Test: zły `state` / timeout → odmowa + redirect z `auth_error`.

---

## T111 — 🩷 superadmin — LinkedIn Login Integration (OAuth login + email retrieval + future-proof for “connect LinkedIn”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM / trust / B2B credibility (LinkedIn identity)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
LinkedIn login podnosi trust (B2B) i skraca wejście do aplikacji, ale jest trudniejszy technicznie (email scope / polityki). W V2 musimy go zrobić “bezpiecznie i prawdziwie”, bo T112 będzie opierać się o LinkedIn identity.

**Cel (outcome):**
Użytkownik może zalogować się przez LinkedIn, a system:
- ma jednoznaczny mapping do usera,
- zapisuje `oauth_links(provider='linkedin')`,
- jest gotowy na kolejny krok: “connect LinkedIn account” (T112) bez przebudowy fundamentów.

**Scope (V2)**
- IN (MUST):
  - **Backend endpoints:**
    - `GET /api/auth/linkedin` (start auth),
    - `GET /api/auth/linkedin/callback` (code → tokens → profile/email → user mapping → redirect).
  - **Email retrieval (MUST):**
    - LinkedIn flow musi dostarczyć email (jeśli provider nie daje email → fallback: poproś usera o email i wykonaj “link by verified email” w osobnym kroku; ale V2 preferuje pełny email z provider).
  - **User mapping / provisioning (MUST):**
    - identyczna polityka jak w Google:
      - match po `oauth_links` (provider_user_id),
      - albo link po email,
      - albo create user (jeśli dozwolone).
    - zapis do `oauth_links`:
      - `provider='linkedin'` (uwaga: tabela komentarzowo nie wspomina, ale pole jest TEXT — V2 dopuszcza nowy provider),
      - `provider_user_id`,
      - `provider_email`,
      - tokens (encrypted) — ważne dla T112 (min. refresh token jeśli dostępny).
  - **Security & anti-CSRF (MUST):**
    - state + TTL + jednorazowość,
    - rate limit,
    - logowanie success/failure do `security_events`.
  - **Frontend integration (MUST):**
    - przycisk jest w `AuthView.tsx` → `${API_URL}/auth/linkedin`,
    - callback jak w T110: redirect do `${FRONTEND_URL}/oauth/callback?...` obsługiwany przez `OAuthCallback`.
  - **Admin visibility (SHOULD):**
    - `/api/auth/oauth/status` pokazuje `linkedin.configured` na bazie env (`LINKEDIN_CLIENT_ID/SECRET/CALLBACK_URL`).
- OUT (post‑V2):
  - pełne scope’y LinkedIn do enrichment profilu (headline, company, network) — to jest T112/T113‑like,
  - “Sign in with LinkedIn” jako jedyny login per org (enforce) — to część większej polityki SSO.

**Implementation notes (grounded w repo):**
- Backend config:
  - `server/src/config/Config.ts` ma `LINKEDIN_CLIENT_ID/SECRET/CALLBACK_URL`.
- Status endpoint:
  - `server/src/routes/oauthRoutes.routes.ts` już zwraca `linkedin.configured` + loginUrl `/api/auth/linkedin`.
- Frontend:
  - `AuthView.tsx` ma `LinkedInIcon` i `handleLinkedInLogin()`.
  - `OAuthCallback.tsx` oczekuje `auth_error=linkedin_failed` w przypadku błędu.

**Analytics / metrics:**
- `oauth_login_started` (provider=linkedin)
- `oauth_login_succeeded` / `oauth_login_failed` (provider, reason)
- KPI: % B2B users choosing LinkedIn, completion rate, support tickets about login.

**Definition of Done (DoD):**
- LinkedIn login działa end‑to‑end i tworzy/linkuje usera bez duplikacji.
- `oauth_links` przechowuje mapping + last_login_at; security events są logowane.
- Flow jest kompatybilny z przyszłym “connect LinkedIn” (T112) — tzn. nie tworzy “shadow identities”.

**Acceptance / test plan:**
- Test: nowe konto LinkedIn → user created + oauth_link.
- Test: istniejący user email → konto linkowane, nie duplikowane.
- Test: provider nie zwraca email → flow wymusza bezpieczny fallback (bez tworzenia kont “unknown@”).

---

## T112 — 🩷 superadmin — LinkedIn Account Connection Encouragement System (connect flow + nudges + adoption tracking)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: IAM + onboarding conversion + B2B trust signals
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Samo “Sign in with LinkedIn” (T111) nie wystarczy, bo:
- większość użytkowników wejdzie hasłem / Google i nie połączy LinkedIn,
- bez zachęty i jasnego benefitu adopcja będzie niska,
- brak spójnego “connect/disconnect/status” tworzy chaos UI (mamy już komponenty, ale placeholdery),
- a LinkedIn identity ma być fundamentem kolejnych funkcji (profil, credibility, rekomendacje, w przyszłości intelligence).

**Cel (outcome):**
W V2 użytkownik jest **inteligentnie i nienachalnie** prowadzony do połączenia LinkedIn:
- ma jasny CTA i wartość (“po co mi to?”),
- widzi status połączenia,
- może bezpiecznie rozłączyć konto,
- a org/admin może zobaczyć adopcję i ewentualnie włączyć/wyłączyć zachęty.

**Scope (V2)**
- IN (MUST) — “Connect LinkedIn” jako feature (dla już zalogowanego usera):
  - **Connect flow (MUST):**
    - osobny flow niż login:
      - `GET /api/auth/linkedin/connect` (start connect dla zalogowanego usera),
      - `GET /api/auth/linkedin/connect/callback` (zapis linka + redirect z powrotem do settings),
    - flow musi być **bezpieczny**:
      - wymaga aktywnej sesji usera (cookie auth preferowane; bez tokenów w URL),
      - state/nonce + TTL, jednorazowe użycie,
      - blokada podpięcia tej samej LinkedIn tożsamości do 2 userów (unikat w `oauth_links(provider, provider_user_id)`).
  - **Disconnect (MUST):**
    - endpoint `DELETE /api/settings/connected-accounts/linkedin` usuwa link (lub oznacza revoked) i loguje security event.
  - **Status API (MUST):**
    - `GET /api/settings/connected-accounts` zwraca listę podłączonych providerów (min. google/linkedin),
    - dane są mapowane z `oauth_links` (kanoniczne źródło) → frontend `LinkedAccounts`.
  - **UI: Settings → Connected Accounts (MUST):**
    - komponent już istnieje: `src/components/settings/ConnectedAccounts.tsx` (obecnie placeholder),
    - V2: przycisk “Connect LinkedIn” odpala realny connect flow,
    - status pokazuje: email/name, data podpięcia, opcja “Disconnect”.
  - **Profile Completeness (MUST):**
    - `ProfileCompleteness.tsx` już uwzględnia “Connected Account” jako item,
    - V2: endpoint “profile completeness” jest obecnie stub (503) — musi zwracać sensowne “suggestions”,
    - jeśli LinkedIn niepodłączony → sugestia HIGH: “Connect LinkedIn” z deep linkiem do zakładki “Connected Accounts”.
- IN (MUST) — “Encouragement” (nudges) bez spamu:
  - **Nudge entrypoints** (MUST):
    - onboarding / pierwsza sesja (1 raz): modal/callout “Connect LinkedIn (2 kliknięcia)”
    - Settings / Profile Completeness card: persistent suggestion
    - (opcjonalnie) SuperAdmin/Org admin: banner “X% zespołu ma podłączony LinkedIn”
  - **Nudge governance** (MUST):
    - user może “Dismiss” (zapis w `user_preferences`, TTL/expiry np. 30 dni),
    - rate limit: nie pokazujemy częściej niż 1x/7 dni jeśli odrzucone,
    - nie pokazujemy w DEMO (albo pokazujemy jako disabled “not in demo”) — spójnie z polityką produktu.
  - **Value proposition (MUST):**
    - komunikaty muszą być konkretne:
      - “Szybsze logowanie”
      - “Uzupełnienie profilu zawodowego”
      - “Wiarygodność B2B / lepsze dopasowanie rekomendacji”
    - bez obiecywania funkcji, których nie ma w V2 (np. “import całej kariery” jeśli nie wdrożone).
- OUT (post‑V2):
  - automatyczny import work history / edukacji (to osobny task),
  - “verification badge” public profile,
  - org-level enforcement “must connect LinkedIn” (może być enterprise policy później).

**Implementation notes (grounded w repo):**
- UI:
  - `ConnectedAccounts.tsx` ma już karty Google/LinkedIn, ale `handleConnect` i `handleDisconnect` są symulowane.
  - `AdvancedSettings.tsx` już woła:
    - `GET /settings/connected-accounts`
    - `DELETE /settings/connected-accounts/:provider`
    - backend obecnie tego nie ma → V2 musi dodać realne endpointy.
  - `ProfileCompleteness.tsx` liczy “connectedAccounts” i woła `/api/user/profile-completeness`, ale backend to stub (503).
- Backend/DB:
  - `oauth_links` (migration `055_security_module.sql.sql`) jest kanoniczną tabelą na “connected accounts”.
  - `security_events` istnieje — nadaje się na audyt connect/disconnect.
  - OAuth status endpoint istnieje: `GET /api/auth/oauth/status`.

**API contract (V2, minimal):**
- `GET /api/settings/connected-accounts` → `{ accounts: Array<{provider,email,connectedAt,status}> }`
- `DELETE /api/settings/connected-accounts/:provider` (min. linkedin) → `{ success: true }`
- `GET /api/auth/linkedin/connect` → 302 do LinkedIn authorize (mode=connect)
- `GET /api/auth/linkedin/connect/callback` → 302 do `${FRONTEND_URL}/settings/security?connected=linkedin`
- `GET /api/user/profile-completeness` → `{ success:true, data:{ percentage, items, suggestions } }`

**Data model:**
- `oauth_links`:
  - `provider='linkedin'`, `provider_user_id`, `provider_email`, `linked_at`, `last_login_at`
- `user_preferences` (już istnieje w `settings.routes.ts`):
  - `nudge:connect_linkedin:dismissed_until` (ISO timestamp)
  - `nudge:connect_linkedin:last_shown_at`
- `security_events`:
  - `event_type`: `oauth_linked`, `oauth_unlinked` (lub spójne nazwy w ramach security events)

**Analytics / metrics:**
- `linkedin_connect_cta_shown` (surface=onboarding|settings|profile_completeness)
- `linkedin_connect_started` / `linkedin_connect_completed` / `linkedin_connect_failed` (reason)
- `linkedin_disconnect_clicked` / `linkedin_disconnect_completed`
- KPI: % users with linkedin connected, connect conversion by surface, drop-off reasons.

**Definition of Done (DoD):**
- User widzi prawdziwy status LinkedIn connection w Settings.
- “Connect LinkedIn” działa (dla zalogowanego usera), zapisuje `oauth_links`, i wraca do aplikacji.
- “Disconnect” działa, loguje security event i aktualizuje UI.
- Nudge system jest kontrolowany (dismiss + rate limit) i ma tracking.
- `profile-completeness` endpoint przestaje być stubem i potrafi sugerować “connect LinkedIn”.

**Acceptance / test plan:**
- Test: user (password login) → Settings → Connect LinkedIn → po callbacku linkedAccounts pokazuje LinkedIn.
- Test: disconnect → wpis znika i nie da się “ghost login” (brak oauth link).
- Test: dismissal: po “Dismiss” nie pokazujemy nudga przez ustalony TTL.
- Test: conflict: próba podpięcia tej samej LinkedIn tożsamości do 2 userów → blok + czytelny błąd.

---

## T113 — 🩷 superadmin — User Behavioral Intelligence Tracking System (event stream + activation/adoption + churn signals)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Growth & Retention Intelligence (trial → paid, churn prevention, product learning)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez systemowego “behavior intelligence” działamy na opinii, nie na danych:
- nie wiemy gdzie ludzie odpadają (onboarding, trial, billing, tool adoption),
- nie umiemy mierzyć TTV (time‑to‑value) i activation,
- nie umiemy wcześnie wykryć churn risk (spadek usage, brak loginów, porzucone flow),
- a SuperAdmin nie ma “prawdy” o aktywności i jakości doświadczenia.

**Cel (outcome):**
W V2 mamy spójny, prywatnościowo bezpieczny system:
- zbieramy zdarzenia (journey/events) i logi (API/AI) do DB,
- przeliczamy metryki (activation/adoption/retention) per user i per org,
- generujemy wczesne sygnały (churn warnings),
- udostępniamy to w SuperAdmin (dashboards + user/org timelines),
- i używamy danych do zwiększania konwersji trial→paid.

**Scope (V2)**
- IN (MUST) — Event collection (kanoniczne):
  - **Journey events (MUST):**
    - endpoint ingest:
      - `POST /api/analytics/journey/track` (single event),
      - (SHOULD) `POST /api/analytics/journey/track/batch` (array) dla wydajności.
    - event schema zgodna z DB (`journey_events`):
      - `event_type`: `phase_entry` | `milestone` | `feature_use` | `tour_event`,
      - `event_name`: string (np. `auth_login_success`, `trial_org_setup_completed`, `tour_completed`),
      - `phase` (opcjonalnie),
      - `metadata` (JSON, bez PII).
    - server uzupełnia: `user_id`, `organization_id`, `created_at`.
  - **Conversion funnel events (MUST):**
    - zapis do `conversion_events` (VISIT/LEAD/DEMO/TRIAL_START/PAID/CHURN),
    - źródła + UTM + referrer + partner_id (jeśli istnieje),
    - wymagamy “source of truth”: który event jest generowany gdzie (landing vs app vs webhook Stripe).
  - **API & performance logs (MUST):**
    - request logging middleware zapisuje do `api_logs`:
      - endpoint/method/status_code/response_time_ms,
      - user_id/organization_id (jeśli dostępne),
      - correlation id,
      - error_message (sanitized).
  - **AI usage logs (MUST):**
    - spójne metryki AI z `ai_usage_logs`/`ai_request_logs` (w zależności od tabel w środowisku),
    - kluczowe pola: provider/model/action/tokens/cost/latency/status.

- IN (MUST) — Behavioral intelligence (processing):
  - **Activation & TTV (MUST):**
    - utrzymujemy `user_activation_status`:
      - `current_phase`, per‑phase flags, `first_event_at`, `last_event_at`, `total_ttv_ms`,
    - reguły activation (V2 minimal):
      - A: konto + pierwszy login,
      - B: ukończony onboarding / “first project” / “first tool started”,
      - C: pierwsza wartość (np. report generated / initiative created / assessment completed) — definicje do doprecyzowania w metrykach.
  - **Adoption metrics (MUST):**
    - per user:
      - WAU/DAU proxy, sessions (z login_history), liczba kluczowych feature_use,
      - usage AI (calls/tokens), engagement score,
    - per organization:
      - aktywni użytkownicy, aktywne moduły, trendy (7/30 dni).
  - **Churn warning signals (MUST):**
    - generujemy `churn_warnings` na podstawie heurystyk:
      - `NO_LOGIN` (np. brak logowania X dni),
      - `USAGE_DROP` (spadek aktywności 7d vs 30d),
      - `PAYMENT_RISK` (past_due/dunning z T109),
      - `FEATURE_ABANDON` (rozpoczęty flow bez domknięcia).
    - status lifecycle: ACTIVE → ACKNOWLEDGED → RESOLVED/DISMISSED.

- IN (MUST) — SuperAdmin visibility:
  - **User timeline**:
    - endpointy pokazujące oś czasu:
      - loginy (login_history),
      - journey_events,
      - AI usage (agregacje),
      - churn warnings.
  - **Org insights**:
    - dashboard: activation funnel, retention snapshot, top adopted features, risk list,
    - integracja z istniejącymi endpointami:
      - `GET /api/superadmin/users/:id/adoption-metrics` (już jest route — V2 musi być realny, nie placeholder),
      - `GET /api/superadmin/organizations/:id/churn-prediction` (V2 minimal: heurystyka + explainability).

- Privacy & compliance (MUST):
  - **No PII in metadata**: email, full names, treści inputów użytkownika nie trafiają do metadata eventów.
  - **Opt-out**:
    - user/org ustawienie: “behavior analytics enabled” (default ON dla V2, ale z wyłączeniem jeśli wymagane),
    - opt-out respektowany w ingest.
  - **Retention**:
    - polityki retencji dla eventów i logów (np. 90 dni raw, 12 miesięcy agregaty),
    - zgodność z istniejącym SuperAdmin “retention policies”.

- OUT (post‑V2):
  - pełny produktowy CDP / segmentacja marketingowa,
  - zaawansowane ML churn (to wchodzi w T114/T115).

**Implementation notes (grounded w repo):**
- Frontend już wysyła journey track:
  - `src/hooks/useJourneyTracking.ts` robi `Api.post('/analytics/journey/track', ...)` i ma batching/queue,
  - obecnie backend **nie ma** `/api/analytics/journey/track` → V2 musi dodać.
- Tabele już istnieją:
  - `journey_events`, `user_activation_status` (`server/migrations/029_journey_analytics.sql.sql`)
  - `conversion_events`, `churn_warnings`, `api_logs`, `login_history`, `ai_usage_logs` (`server/migrations/230_superadmin_overview_production.sql`)
- SuperAdmin ma już punkty integracji:
  - `SuperAdminSignalCenter` pobiera `/api/superadmin/signals`,
  - w `server/src/routes/superadmin.routes.ts` istnieje `GET /users/:id/adoption-metrics`.
- `trackFunnelEvent` istnieje w `src/services/funnelAnalytics.ts` (gtag + journeyAnalytics global).

**API contract (V2, minimal):**
- `POST /api/analytics/journey/track`
- (SHOULD) `POST /api/analytics/journey/track/batch`
- `GET /api/superadmin/users/:id/adoption-metrics`
- `GET /api/superadmin/organizations/:id/churn-prediction`
- (SHOULD) `GET /api/superadmin/organizations/:id/behavior-summary` (funnel + adoption + warnings)

**Analytics / metrics:**
- `journey_event_tracked` (event_type, event_name, module, orgId)
- `activation_phase_changed` (from,to)
- `churn_warning_created` (type,severity)
- KPI: activation rate, TTV median, retention D7/D30 proxy, trial→paid conversion lift.

**Definition of Done (DoD):**
- `POST /api/analytics/journey/track` działa i zapisuje `journey_events`.
- `user_activation_status` aktualizuje się na podstawie eventów.
- Request logging zapisuje `api_logs` (bez PII).
- SuperAdmin widzi realne adoption metrics i churn signals (nie placeholder).
- Jest opt‑out + retention rules.

**Acceptance / test plan:**
- Test: frontend `useJourneyTracking.trackMilestone('auth_login_success')` → w DB powstaje `journey_events` z user_id i org_id.
- Test: batch flush (20 eventów) → endpoint przyjmuje bez timeoutów; brak duplikacji.
- Test: api_logs zapisuje status_code i latency dla wybranych endpointów.
- Test: churn warning “NO_LOGIN” tworzy się po przekroczeniu progu (symulacja dat).

---

## T114 — 🩷 superadmin — Transaction Readiness Scoring Algorithm (explainable score 0–100 + factor breakdown)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization & Sales Intelligence (qualification, upgrade timing, risk reduction)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
W V2 chcemy maksymalizować konwersję (trial→paid) i minimalizować churn, ale bez “przepychania” userów w ciemno:
- potrzebujemy obiektywnego sygnału: *czy ta organizacja jest gotowa na transakcję / upgrade?*
- SuperAdmin/Sales/CS musi widzieć *dlaczego* (explainability), a nie tylko numer,
- scoring musi być audytowalny, stabilny i odporny na “noise”.

**Cel (outcome):**
W V2 istnieje kanoniczny algorytm **Transaction Readiness Score**:
- wynik \(0–100\) + **tier** (np. LOW/MEDIUM/HIGH/READY),
- breakdown na czynniki + evidence (z jakich danych),
- aktualizowany automatycznie (cron + trigger na kluczowe eventy),
- wykorzystywany w:
  - SuperAdmin (qualification + priorytety),
  - in‑app nudge/upgrade UX (tylko gdy READY),
  - integracji T115 (Sellix) jako input do automatyzacji transakcji.

**Scope (V2)**
- IN (MUST):
  - **Score model (MUST):** wynik per organization (+ opcjonalnie per user jako “primary buyer”).
  - **Explainability (MUST):**
    - breakdown: lista faktorów z wagą, wartością, statusem (met/missing), i evidence,
    - decyzja końcowa: tier + “top 3 blockers” + rekomendowane next steps.
  - **Stability (MUST):**
    - smoothing/anti-spike: score nie skacze o > X pkt/dzień bez “major event”,
    - idempotent computation, zapisy snapshotów.
  - **Audit & compliance (MUST):**
    - brak PII w breakdown metadata,
    - retencja: raw evidence max 90 dni (agregaty dłużej),
    - możliwość wyłączenia score per org (compliance).
  - **SuperAdmin view (MUST):**
    - ranking orgów po readiness (top READY + top AT_RISK),
    - drill‑down: org → readiness timeline (snapshots) + breakdown + blockers.
- OUT (post‑V2):
  - pełny ML model (to będzie “predictive readiness” w osobnym story),
  - indywidualny scoring per persona/role (buyer vs champion) jeśli nie potrzebne na V2.

**Algorithm (V2, canonical v1)**
Wynik = suma wag “dimension scores” minus penalties.

- **D1: Identity & Security readiness (max 20)**
  - email verified / verified login (jeśli istnieje),
  - MFA enabled (z `users.mfaEnabled` / security tables),
  - connected account exists (Google/LinkedIn; `oauth_links` + UI `linkedAccounts`),
  - brak wysokich security red flags (np. wiele failed logins z `login_history`).

- **D2: Product activation & adoption (max 25)**
  - `journey_events` milestones (A/B/C z T113),
  - `user_adoption_metrics.engagement_score` (rolling 7d/30d),
  - real “value events”: np. report generated / initiative created / assessment completed (event_name canonical).

- **D3: Governance & execution readiness (max 20)**
  - inicjatywy mają “gate readiness” (backend contract):
    - `GET /api/initiatives/:id/gate-readiness-check` ma blocking checks,
  - decyzje mają readiness (wzorzec scoringu już jest w `DecisionReadinessBar`),
  - obecność owner/sponsor/target date w inicjatywach (z readiness check).

- **D4: Billing readiness (max 20)**
  - payment method added (`billing/setup-intent` + `payment_methods`),
  - brak overdue invoices / brak dunning (T109),
  - org ma sensowny “plan intent” (wybrany plan lub checkout started).

- **D5: Compliance readiness (max 15)**
  - legal acceptance current (T093 system),
  - org security settings sensowne (np. session policy) jeśli wymagane.

- **Penalties (max -20)**
  - aktywne `churn_warnings` HIGH/CRITICAL,
  - “NO_LOGIN” > X dni,
  - payment_failed/past_due (z billing/dunning) dopóki nie recovered.

**Tiers (V2):**
- 0–39: `LOW`
- 40–59: `MEDIUM`
- 60–79: `HIGH`
- 80–100: `READY`
oraz flagi:
- `BLOCKED_BY_BILLING` (past_due/dunning)
- `BLOCKED_BY_COMPLIANCE` (missing legal acceptance)

**Data model (V2):**
- `transaction_readiness_scores` (snapshots)
  - `id`, `organization_id`, `score` (0–100), `tier`,
  - `dimensions_json` (breakdown per D1–D5),
  - `penalties_json`,
  - `blockers_json` (top blockers),
  - `computed_at`, `computed_by` (`system`/`superadmin`), `algorithm_version` (v1),
  - `source_evidence_hash` (hash do dedupe).
- (SHOULD) `transaction_readiness_events` (optional lightweight event log)
  - “score changed”, “blocker resolved”, “tier changed”.

**API contract (V2, minimal):**
- `GET /api/superadmin/organizations/:id/transaction-readiness` → `{ score, tier, breakdown, blockers, updatedAt }`
- `GET /api/superadmin/transaction-readiness/ranking?days=30` → list orgs sorted
- `POST /api/superadmin/organizations/:id/transaction-readiness/recompute` (guardrails + reason) → forces recompute

**Computation strategy (V2):**
- Cron job (daily + optional hourly for paid/trial orgs):
  - recompute dla orgów aktywnych + trial,
  - recompute natychmiast po eventach:
    - `billing_payment_method_added`,
    - `trial_org_setup_completed`,
    - `oauth_linked` (LinkedIn connect),
    - `invoice.paid` / `invoice.payment_failed`,
    - “value event” (first report/initiative).

**Implementation notes (grounded w repo):**
- Dane wejściowe są już w DB/migracjach:
  - `conversion_events` (`server/migrations/230_superadmin_overview_production.sql`)
  - `churn_warnings`, `login_history`, `api_logs`, `ai_usage_logs` (tamże)
  - `journey_events` + `user_activation_status` (`server/migrations/029_journey_analytics.sql.sql`)
  - `user_adoption_metrics` (`server/migrations/015_enterprise_customers_module.sql`) + `server/src/services/userAdoptionService.ts`
- Readiness check inicjatyw już istnieje w backend:
  - `GET /api/initiatives/:id/gate-readiness-check` (`InitiativeController.getGateReadinessCheck`)
- Wzorzec scoring UI istnieje (do explainability):
  - `src/components/MyWork/shared/DecisionReadinessBar.tsx`.

**Analytics / metrics:**
- `transaction_readiness_computed` (orgId, score, tier, version)
- `transaction_readiness_tier_changed` (from,to, blockersResolvedCount)
- KPI: trial→paid conversion lift, % upgrades at READY, reduction w refunds/churn po upgrade.

**Definition of Done (DoD):**
- System liczy score dla orgów i zapisuje snapshoty z breakdown i blockers.
- SuperAdmin ma ranking + drill‑down.
- Algorytm jest explainable i stabilny (bez losowych skoków).
- Jest gotowy jako input do T115 (Sellix) — czyli ma API i eventy.

**Acceptance / test plan:**
- Test: org z payment method + ukończone milestone + brak warnings → tier `READY`.
- Test: org z `invoice.payment_failed` / dunning → penalty i flag `BLOCKED_BY_BILLING`.
- Test: brak legal acceptance (T093) → `BLOCKED_BY_COMPLIANCE`.
- Test: recompute endpoint zmienia score deterministycznie (idempotent) i zapisuje snapshot.

---

## T115 — 🩷 superadmin — Transaction Readiness Integration with Sellix (automated conversion activation)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Monetization automation (trial→paid conversion) + Sales/CS control plane
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nawet idealny readiness score (T114) nie zwiększy konwersji, jeśli nie zamienimy sygnału na działanie:
- brak automatycznej aktywacji ścieżek upgrade (CTA/komunikacja/offering),
- brak spójnego “handoff” do systemu sprzedaży (Sellix) → chaos i ręczne działania,
- brak pętli zwrotnej (czy komunikacja zadziałała?) → nie uczymy się konwersji.

**Cel (outcome):**
W V2 system po osiągnięciu progu readiness **automatycznie** uruchamia działania sprzedażowe w Sellix (nasz system sprzedaży automatycznej), a następnie zbiera feedback:
- outbound: “org is READY → start conversion pathway”,
- inbound: “pathway started / CTA clicked / checkout started / paid” → zapis w analytics (T113) i billing funnel.

**Zakres (V2)**
- IN (MUST):
  - **Outbound readiness signals → Sellix (MUST):**
    - kiedy org przekracza próg (np. tier `READY` lub score ≥ threshold) i nie ma flag BLOCKED:
      - emitujemy event do Sellix,
      - dokładnie raz per crossing (idempotency + cooldown).
    - payload musi zawierać:
      - `organizationId`,
      - `readinessScore`, `readinessTier`, `algorithmVersion`,
      - `topBlockers` (jeśli nie READY),
      - `recommendedNextSteps` (krótkie, bez PII),
      - kontekst billing: `organizationType` (TRIAL/PAID), `billingStatus` (ok/past_due) — bez sekretów.
  - **Inbound events z Sellix (MUST):**
    - Sellix odsyła eventy konwersji, które zapisujemy do:
      - `conversion_events` (VISIT/LEAD/TRIAL_START/PAID/CHURN) tam gdzie ma sens,
      - `journey_events` (np. `upgrade_cta_clicked`, `sellix_pathway_started`),
      - (opcjonalnie) `transaction_readiness_events` jako audit pętli.
  - **Config & governance (MUST):**
    - SuperAdmin może:
      - włączyć/wyłączyć Sellix integration,
      - ustawić threshold + cooldown,
      - wybrać “pathway” (np. `TRIAL_UPGRADE_EMAIL_1`, `IN_APP_UPGRADE_PROMPT`, `SCHEDULE_CALL`),
      - uruchomić test event “dry-run”.
    - DEMO org: brak realnych outbound actions (albo “disabled with reason”).
  - **Security (MUST):**
    - outbound podpisany HMAC (shared secret) + timestamp + replay protection,
    - inbound webhook weryfikuje podpis i jest idempotentny (dedupe po `eventId`),
    - rate limiting + audit (SuperAdmin).
  - **Reliability (MUST):**
    - delivery log + retry policy (max attempts + backoff),
    - obserwowalność: success/fail counters, last_error.

- OUT (post‑V2):
  - pełna orkiestracja kampanii w aplikacji (visual builder),
  - personalizacja per persona (buyer/champion) jeśli okaże się potrzebne.

**Canonical event taxonomy (V2):**
- Outbound (Consultify → Sellix):
  - `transaction_readiness.ready` (tier becomes READY)
  - `transaction_readiness.tier_changed` (HIGH→READY etc.)
  - `transaction_readiness.blocked` (np. BLOCKED_BY_BILLING / COMPLIANCE)
- Inbound (Sellix → Consultify):
  - `sellix.pathway_started`
  - `sellix.cta_clicked`
  - `sellix.checkout_started`
  - `sellix.purchase_completed` (jeśli Sellix jest po stronie checkout)
  - `sellix.pathway_failed`

**Data model (V2, minimal):**
- (MUST) idempotency registry:
  - `transaction_readiness_events` (jeśli z T114) albo dedupe w `webhook_deliveries`:
    - `event_type`, `organization_id`, `dedupe_key`, `created_at`
- (SHOULD) `sellix_events`:
  - przechowuje surowe inbound eventy (bez PII payloadów poza tym co konieczne) + processing_status.

**API contract (V2):**
- `POST /api/webhooks/sellix` (inbound)
  - wymagane: `X-Sellix-Signature`, `X-Sellix-Event`, `X-Sellix-Timestamp`, `eventId`
  - odpowiedź: 200 na sukces; 400/401 na invalid signature; idempotent 200 na duplikat.
- `POST /api/superadmin/sellix/test-event` (guardrails + reason) → wymusza outbound test
- (opcjonalnie) `GET /api/superadmin/sellix/status` → last deliveries/health

**Integration strategy (grounded w repo):**
- W repo istnieje “system webhook” infrastruktura:
  - tabela `webhooks` + `webhook_deliveries` (`server/migrations/000_initdb_core_tables.sql`, `160_configuration_enhancements.sql` / legacy),
  - `server/src/services/WebhookService.ts`:
    - HMAC signature (`X-Consultinity-Signature`) + `X-Consultinity-Event`,
    - delivery listing (`getDeliveries`) i retry (`retryDelivery`) — V2 domyka użycie delivery log przy trigger.
  - SuperAdmin ma endpoints do webhooks/integrations:
    - `server/src/routes/superadmin.routes.ts` → `/integrations` + `/webhooks`.
- W repo istnieje też nowy integrations system (FLOW-INTEGRATION-001):
  - `server/migrations/256_integrations_system.sql` (`integration_providers`, `integrations`, `integration_webhooks`…)
  - `server/src/routes/integrations/integrations.routes.ts` automatycznie dopasowuje się do schematu tabel.
- V2 wybiera **jedno kanoniczne źródło konfiguracji** dla Sellix:
  - preferowane: `integration_providers + integration_webhooks` (outbound),
  - fallback: legacy `webhooks` (system orgId=`system`) jeśli środowisko nie ma 256.

**How it works (V2, end-to-end):**
1. T114 wylicza snapshot readiness (cron/trigger).
2. Jeśli tier crossing spełnia warunki (READY, not blocked, cooldown ok) → emit outbound event.
3. Outbound delivery zapisuje się do `webhook_deliveries` i jest wysyłana do Sellix.
4. Sellix startuje pathway (email/CTA/offer) i odsyła eventy do `/api/webhooks/sellix`.
5. Inbound eventy aktualizują `conversion_events` / `journey_events` (T113) i umożliwiają optymalizację progów.

**Anti-spam / governance (MUST):**
- cooldown per org: minimum 7 dni między “READY activation” jeśli brak success,
- idempotency:
  - klucz: `orgId:tier:YYYY-MM-DD` lub `orgId:tierChange:from-to`,
  - duplikaty → no-op.
- “Stop rules”:
  - jeśli org jest `PAID` lub ma aktywne dunning/past_due → nie uruchamiamy upgrade pathway, tylko `blocked`.

**Analytics / metrics:**
- `sellix_signal_sent` / `sellix_signal_failed` (eventType, orgId, statusCode)
- `sellix_pathway_started` / `sellix_cta_clicked` / `sellix_checkout_started`
- KPI: conversion lift READY→PAID, time-to-upgrade po READY, false positives rate (READY bez konwersji).

**Definition of Done (DoD):**
- Po przekroczeniu progu READY system wysyła event do Sellix dokładnie raz (idempotent + cooldown).
- Inbound webhook odbiera eventy z Sellix bezpiecznie (signature + dedupe) i zapisuje je do analytics.
- SuperAdmin ma konfigurację + test event + podgląd delivery success/fail.
- Integracja nie działa “na niby” w prod (brak placeholderów), a w DEMO jest jawnie wyłączona.

**Acceptance / test plan:**
- Test: org zmienia tier HIGH→READY → outbound `transaction_readiness.ready` wysłany, delivery logged.
- Test: ponowny recompute tego samego dnia → brak duplikatu (idempotency).
- Test: Sellix inbound `sellix.cta_clicked` → powstaje `journey_event` + (opcjonalnie) `conversion_event`.
- Test: zły podpis inbound → 401; duplikat `eventId` → 200 no-op.

---

## T116 — 🟣 ai — Centralized AI Prompt Management & Learning System (SSOT prompts + versioning + A/B + learning loop)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform (quality, governance, maintainability, enterprise control)
- Priorytet / V2 scope: V2 (launch‑critical dla “AI quality + trust”)

**Business challenge (problem):**
Obecnie “prompty” i nauka AI są rozproszone i częściowo niespójne:
- istnieje kilka równoległych systemów promptów/versioning/AB (różne tabele i endpointy),
- runtime prompt composition ma luki (np. `promptAssembler` jest jawnie “unavailable”),
- learning loop istnieje (feedback → patterns → instruction suggestions), ale jest zdublowany (min. 2 implementacje) i nie jest kanonicznie spięty z promptami,
- bez SSOT promptów i kontroli wersji nie da się bezpiecznie podnosić jakości w V2 (“ready to show the world”).

**Cel (outcome):**
W V2 mamy **jeden kanoniczny system**:
- **SSOT promptów** (klucze, kategorie, i18n policy, variables),
- **versioning + rollback + publish/activate** (auditowalne),
- **A/B testing** (kontrolowany i mierzalny),
- **learning loop** (feedback → wzorce → sugestie instrukcji → zatwierdzenie → stosowanie w runtime),
- i **prompt compilation pipeline** (assembler), który faktycznie jest używany przez AI endpoints.

**Scope (V2)**
- IN (MUST) — Prompt SSOT:
  - kanoniczna tabela + kontrakt:
    - `ai_system_prompts` jako SSOT (SQLite-first; istnieje w `server/migrations/210_ai_system_prompts.sql`)
    - klucz (`key`) jest *jedynym* stabilnym identyfikatorem w kodzie (np. `chat.default`, `initiative.raid`, `report.exec_summary`).
  - kanoniczne API (SuperAdmin/Admin):
    - list/filter/search/categories,
    - create/update/deactivate,
    - version history + rollback.
  - kanoniczne UI:
    - SuperAdmin “AI Intelligence” (`src/views/superadmin/AIIntelligenceView.tsx`) używa jednego zestawu endpointów (koniec duplikatów).

- IN (MUST) — Versioning & audit:
  - każda zmiana promptu tworzy rekord w historii (`ai_prompt_versions`),
  - statusy: `draft` → `active` / `inactive` + rollback,
  - audit: kto/kiedy/why (`change_reason`) + powiązanie z ticketem (opcjonalne pole).

- IN (MUST) — Prompt blocks & assembly:
  - utrzymujemy `ai_prompt_blocks` jako bibliotekę “klocków” (persona, behavior, output constraints, context injection).
  - Implementujemy **Prompt Assembler** jako realny komponent runtime:
    - kompiluje `ai_system_prompts` + opcjonalne blocks + org learning instructions,
    - wykonuje variable interpolation (bez eval; bezpiecznie),
    - respektuje language policy (6 języków) i output constraints (JSON-only gdy wymagane).
  - “Block Builder” i “Preview” w `prompt-assistant.routes.ts` są spójne z assemblerem (ten sam wynik).

- IN (MUST) — Learning system (closed loop):
  - zbieramy feedback do `ai_feedback` (już istnieje, m.in. `server/migrations/052_ab_testing.sql`),
  - generujemy wzorce:
    - `ai_learning_patterns` (używane przez `server/src/services/ai/learningSystem.ts` i `aiLearningService.ts`),
  - generujemy sugestie instrukcji:
    - `ai_instruction_suggestions` (schema istnieje w `server/migrations/520_ai_enterprise_tables.sql`),
  - workflow zarządczy:
    - `pending` → `approved` → `applied` / `rejected`,
    - stosowanie w runtime: assembler dopina “Learned Instructions” dla organizationId (bez PII).
  - usuwamy duplikację implementacji:
    - jedna kanoniczna implementacja jobów (scheduler) i jedna kanoniczna implementacja usług (API).

- IN (MUST) — A/B testing:
  - A/B testy działają na wersjach promptów:
    - `ai_ab_experiments`, `ai_ab_assignments`, `ai_ab_outcomes` (istnieją w `server/migrations/052_ab_testing.sql`)
  - AB jest w pełni kontrolowane przez SuperAdmin i ma guardrails:
    - min sample size, czas trwania, auto-stop, “winner promote”.

- IN (MUST) — Metrics (quality + cost + regression):
  - dla każdego requestu AI logujemy:
    - prompt key + version (który wygenerował odpowiedź),
    - podstawowe metryki jakości i kosztu (wykorzystując istniejące tabele `ai_quality_metrics`, `ai_cost_usage` / `ai_cost_log` zależnie od środowiska),
    - korelacja po request_id / conversation_id.
  - “prompt regression guard”:
    - jeśli nowa wersja powoduje spadek quality score / wzrost hallucination flags → alert + możliwość rollback.

- OUT (post‑V2):
  - pełny, Postgres-native “semantic template system” (`ai_prompt_templates` / `ai_prompt_blocks` JSONB z `080_prompt_templates.sql.sql`) jako nowa generacja,
  - pełny “prompt linting” i automatyczne eval sety per feature w CI.

**Canonical model (V2)**
- **Prompt key naming (MUST):**
  - `domain.capability.intent[.variant]` (np. `initiative.section.raid.v1`, `chat.cothinker.default`)
  - zakaz “magic strings” w kodzie bez `key` (wszystko odnosi się do promptów po key).

- **Prompt payload (MUST):**
  - `content` (główna instrukcja),
  - opcjonalnie: `system_prompt` + `user_prompt_template`,
  - `variables[]` (schema) + `context_config` (jakie konteksty wolno wstrzyknąć).

**Repo grounding (obecny stan / długi ogon)**
- Istnieje realne UI i API dla promptów, ale są zduplikowane:
  - `/api/prompt-assistant/*` (`server/src/routes/prompt-assistant.routes.ts`) obsługuje Templates/Blocks/Test bench.
  - `/api/ai-prompts/*` (`server/src/routes/ai-prompts.routes.ts`) robi CRUD na `ai_system_prompts`.
  - `/api/ai/ai-prompts/*` (`server/src/routes/ai/ai-prompts.routes.ts`) używa legacy `AIPromptsController`.
  - `/api/ai-development/prompts/*` (`server/src/routes/ai-development.routes.ts`) ma kolejne CRUD.
  - V2 wymaga **jednego kanonicznego API** + deprecacji reszty (bez breaking changes — aliasy i redirects w warstwie routing).
- Prompt assembler jest brakujący:
  - `server/src/services/ai/promptAssembler.ts` oznaczony jako `__unavailable__`.
- Learning loop istnieje w dwóch implementacjach:
  - `server/src/services/ai/learningSystem.ts` (jobs w `server/src/cron/Scheduler.ts`)
  - `server/src/services/ai/aiLearningService.ts` + `server/src/jobs/aiLearningJob.ts`
  - V2 musi to skonsolidować.
- Inicjatywy mają własne prompt templates w DB:
  - `initiative_section_types.ai_prompt_template` wypełniane przez `server/migrations/530_initiative_section_ai_prompts.sql` — V2 mapuje to do centralnego registry (przez key/ref) albo utrzymuje jako “legacy source”, ale w jednym UI i z versioning.

**Deliverables (V2):**
- Kanoniczny “Prompt Registry”:
  - stable key space + schema + admin UI.
- Prompt Assembler (runtime) + wspólny engine do:
  - prompt-assistant preview,
  - test bench,
  - produkcyjne generowanie odpowiedzi.
- Learning loop:
  - feedback capture + patterns + instruction suggestions + approval + apply.
- AB testing:
  - eksperymenty na prompt versions + metryki i winner promotion.
- Observability:
  - metryki per prompt key/version (quality/cost/latency) + alerting regresji.

**API contract (V2, minimal):**
- `GET /api/ai-prompts` + filters (canonical)
- `GET /api/ai-prompts/categories`
- `GET /api/ai-prompts/:id` (incl. versions)
- `POST /api/ai-prompts` (superadmin)
- `PUT /api/ai-prompts/:id` (superadmin; creates version)
- `POST /api/ai-prompts/:id/rollback` (superadmin; explicit reason)
- `POST /api/prompt-assistant/blocks/preview` (uses assembler)
- `POST /api/prompt-assistant/test` (uses assembler + records metrics)
- `POST /api/ai-feedback` (feedback capture; already exists, V2 aligns schema)
- `GET /api/superadmin/ai-learning/report` + `POST /api/superadmin/ai-learning/suggestions/:id/(approve|reject|apply)`

**Analytics / metrics:**
- `prompt_version_published` / `prompt_version_rolled_back`
- `prompt_ab_experiment_started` / `prompt_ab_experiment_winner_promoted`
- `ai_feedback_submitted` (type, category, promptKey)
- `ai_learning_instruction_applied` (orgId, suggestionId)
- KPI: quality score trend per key, % regressions caught, time-to-rollback, reduction w negative feedback.

**Risks (V2):**
- Schema drift (`ai_system_prompts` ma różne kolumny w różnych migracjach/endpointach) → V2 musi ujednolicić i dodać “compat layer” (np. `getTableColumns`) zanim zrobimy twarde migracje.
- Nadmierna automatyzacja learningu → V2 wymaga approval workflow (SuperAdmin), a auto-apply tylko dla wysokiego confidence i bezpiecznych kategorii.

**Definition of Done (DoD):**
- Jest **jeden kanoniczny** registry promptów (key/version/history) i jest używany przez UI + produkcyjne endpointy AI.
- Prompt assembler działa (nie `__unavailable__`) i jest używany w test bench + runtime.
- Learning loop działa end-to-end (feedback → pattern → suggestion → approval → applied in runtime).
- A/B testing działa i ma metryki/winner promotion.
- Mamy metryki jakości/kosztu per prompt version oraz szybki rollback.

**Acceptance / test plan:**
- Test: edycja promptu w SuperAdmin → powstaje nowy version + można rollback.
- Test: prompt-assistant preview i produkcyjny endpoint używają tego samego assemblera (ten sam compiled prompt).
- Test: feedback “correction” tworzy pattern → suggestion → po apply assembler dopina instrukcję tylko dla tej organizacji.
- Test: AB experiment rozdziela ruch i zapisuje outcomes; można wybrać winner.

---

## T117 — 🟣 ai — System-Level AI Context Governance (Core Documentation Layer) (canonical “system brain” + citations + drift control)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (trust, groundedness, deterministic behavior across modules)
- Priorytet / V2 scope: V2 (launch‑critical)

**Business challenge (problem):**
AI w Consultify ma być “Harvard-level” i *enterprise-trustworthy*, ale bez kanonicznej warstwy dokumentacji systemowej:
- AI będzie odpowiadać niespójnie (różne moduły → różne zasady),
- rośnie ryzyko halucynacji w obszarach governance (role, gates, economics, artefacts),
- nie mamy jednego źródła prawdy, które AI może cytować i które jest kontrolowane wersjami,
- zmiany w produkcie nie propagują się do AI (drift między kodem a “wiedzą”).

**Cel (outcome):**
W V2 istnieje **Core Documentation Layer** jako kanoniczny “system brain”:
- spójna, wersjonowana biblioteka dokumentów systemowych (policy, architecture, flows),
- deterministyczne wstrzykiwanie tej warstwy do kontekstu AI (z budżetem tokenów),
- odpowiedzi governance‑level są **grounded** i **cytowane** (z weryfikacją),
- kontrola driftu: gdy canonical docs się zmieniają → reindex + audyt wpływu.

**Scope (V2)**
- IN (MUST) — Canonical document set:
  - Core docs pochodzą z repo (kanoniczne) i są określone przez:
    - `docs/product/DOCUMENTATION_REGISTRY.md` (source-of-truth: co jest canonical),
    - dokumenty north‑star jak `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`.
  - Minimalny zestaw (MUST) jako warstwa systemowa:
    - governance: roles model, initiative governance, gate DoD, change/unblock policy,
    - artefacts list + traceability (no initiative without source),
    - reporting canonical templates (jak AI ma raportować),
    - economics policy (kiedy finanse blokują gates).

- IN (MUST) — Storage & indexing (SSOT):
  - Kanoniczne przechowywanie w DB jako “system scope” docs:
    - `knowledge_documents` + `knowledge_chunks` (schema `server/migrations/266_knowledge_rag.sql`),
    - `organization_id = NULL`, `scope='system'`, `source_type='generated'|'upload'` (dla core docs: `generated`),
    - dedupe po `file_hash` + version.
  - Compatibility layer (MUST):
    - repo ma legacy RAG (`knowledge_docs` + `knowledge_chunks` z `doc_id`) używany przez `ragService.ts` i `KnowledgeIndexer`.
    - V2 ustala kanon: **`knowledge_documents`** (266) i dopina adapter (read/write) dla legacy tylko jako fallback.

- IN (MUST) — Context injection policy:
  - Kanoniczny builder kontekstu już istnieje:
    - `server/src/services/aiContextBuilder.ts` buduje wielowarstwowy kontekst (platform/org/project/execution/knowledge/external + enrichments) z `focusMode`.
  - V2 dodaje governance rules:
    - “System docs layer” jest wstrzykiwana zawsze w minimalnej formie (np. top 3–7 snippetów zależnie od query i screenContext),
    - “focusMode” nie może wyłączyć system layer dla pytań o governance/policy (fail-safe).
  - Token budgeting (MUST):
    - ustalone budżety per warstwa (system/org/project/execution/external) + trimming,
    - logowanie `contextHash` i `contextSizeEstimate` (już istnieje) + dodatkowo: “what got trimmed”.

- IN (MUST) — Citations & verification (trust layer):
  - AI może cytować core docs jako `[DOC1]`, `[DOC2]` (id/slug + title).
  - Weryfikacja cytowań jest wspierana przez:
    - `server/src/services/ai/citationVerifier.ts` + tabela `citation_verification_logs` (`server/migrations/520_ai_enterprise_tables.sql`).
  - Policy:
    - odpowiedzi typu “policy/governance/permissions/why UI behaves this way” wymagają cytowań (min. 1),
    - brak cytowań → AI musi powiedzieć “nie mam źródła w core docs” i zaproponować dopisanie dokumentu / doprecyzowanie.

- IN (MUST) — SuperAdmin control plane:
  - Widok “Core Docs” (w module AI Platform/System):
    - lista core docs: status (indexed/needs_reindex), version, last indexed at, hash,
    - przycisk “Reindex now” + “Preview snippets”,
    - drift alerts: “canonical doc changed but index is stale”.

- OUT (post‑V2):
  - pełna integracja z Internet context (T118),
  - pełna organizacyjna i indywidualna warstwa governance (T119–T121) — w V2 tylko “system core”.

**Implementation notes (grounded w repo):**
- Canonical docs registry istnieje i ma reguły autorytetu:
  - `docs/product/DOCUMENTATION_REGISTRY.md`.
- System architecture north-star jest canonical:
  - `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`.
- AI context pipeline jest już wielowarstwowy i ma focus modes + trimming:
  - `server/src/services/aiContextBuilder.ts`.
- RAG i metryki RAG istnieją:
  - schema `knowledge_documents`/`knowledge_chunks` (`server/migrations/266_knowledge_rag.sql`)
  - metryki: `server/src/services/ai/ragMetricsService.ts` + tabela `rag_metrics` (`server/migrations/520_ai_enterprise_tables.sql`)
  - legacy indexer i legacy schema: `server/src/services/ai/knowledgeIndexer.ts`, `server/src/services/ragService.ts`.
- Weryfikacja cytowań istnieje (DB fail‑open):
  - `server/src/services/ai/citationVerifier.ts`.

**Deliverables (V2):**
- Core docs ingestion + indexing:
  - job/command, który importuje canonical docs (md) do `knowledge_documents` (scope=system) i tworzy chunks/embeddings,
  - dedupe po hash + version bump gdy treść się zmienia,
  - reindex automation (daily) + manual reindex (SuperAdmin).
- Governance policy w AI runtime:
  - system docs są zawsze dostępne i preferowane jako źródło,
  - enforce citations dla governance answers.
- Observability:
  - dashboard: groundedness (RAG metrics), citation verification score, top missing docs.

**API contract (V2, minimal):**
- `GET /api/superadmin/ai/core-docs` → list (status, version, hash, indexedAt)
- `POST /api/superadmin/ai/core-docs/reindex` (guardrails + reason)
- `GET /api/superadmin/ai/core-docs/:id/snippets` → preview chunks
- (opcjonalnie) `GET /api/superadmin/ai/core-docs/drift` → stale vs canonical

**Analytics / metrics:**
- `core_docs_reindexed` (count, duration)
- `core_docs_drift_detected` (docId, oldHash, newHash)
- `ai_citation_verification_score` (overall_score)
- KPI: spadek “unverified/broken citations”, wzrost groundedness, mniej konfliktów w policy answers.

**Definition of Done (DoD):**
- Canonical docs (system layer) są zasilone do DB i indeksowane do RAG.
- AIContextBuilder zawsze może dostarczyć core doc snippets (token budgeted).
- Governance odpowiedzi mają cytowania i przechodzą weryfikację (logi w DB).
- SuperAdmin może sprawdzić status core docs i uruchomić reindex / zobaczyć drift.

**Acceptance / test plan:**
- Test: zmiana treści w core doc → drift wykryty → reindex → nowy hash/version.
- Test: pytanie o role/gates/economics → AI odpowiada z min. 1 cytowaniem `[DOCx]` i weryfikacja loguje score.
- Test: brak core doc dla pytania → AI komunikuje brak źródła i proponuje aktualizację dokumentacji.

---

## T118 — 🟣 ai — External Knowledge & Internet Context Management for AI (safe web research + governance + audit)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform (groundedness, current info, enterprise safety)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
AI musi umieć korzystać z internetu (trendy, benchmarki, konkurencja, standardy), ale:
- bez governance ryzykujemy halucynacje, nieaktualne dane i brak audytu,
- bez bezpieczeństwa ryzykujemy SSRF/niechciane domeny/treści oraz wyciek danych,
- bez retencji i idempotency nie umiemy odtworzyć “skąd była odpowiedź” (trust/regulatory),
- bez spójnych cytowań odpowiedzi są nie weryfikowalne (T117 wymaga citations).

**Cel (outcome):**
W V2 internet context jest:
- **bezpieczny** (policy gating + allowlist/denylist + sanitization),
- **deterministyczny** (ten sam query → podobny wynik, cache),
- **audytowalny** (log źródeł + eventy),
- **cytowany** (źródła jako [1], [2] + zapis w logach),
- oraz działa w 2 trybach:
  - **Web Search (light)**: szybkie wsparcie odpowiedzi w czacie,
  - **Deep Research (heavy)**: iteracyjne research rounds z syntezą.

**Scope (V2)**
- IN (MUST) — Policy gating (“internetEnabled”):
  - internet może być użyty tylko gdy:
    - `AIPolicyEngine.getEffectivePolicy(...).internetEnabled = true` (org policy),
    - i nie ma override typu Regulatory Mode (wtedy `internetEnabled=false` i ADVISORY only).
  - Web search / deep research muszą to respektować:
    - UI pokazuje “Web Search disabled by policy” zamiast silent failure.

- IN (MUST) — Web Search (light mode) governance:
  - Kanoniczna implementacja już istnieje w stream chat:
    - `server/src/routes/ai.routes.ts` robi auto-intent (`webSearchIntentDetector`) i wyszukiwanie (Tavily).
  - V2 domyka:
    - **domain policy**:
      - allowlist/denylist per org (default: allow all public domains, deny: adult/malware/link shorteners),
      - block private network / localhost style URLs (SSRF safety).
    - **content policy**:
      - never include user secrets/PII in query,
      - truncate raw content, strip scripts/HTML, enforce max chars,
      - label: “facts vs assumptions”.
    - **cooldown + caching**:
      - cache per (orgId, normalizedQuery, language, depth) min. 10 min,
      - cap sources to prevent token explosion (np. max 8 citations).

- IN (MUST) — Deep Research (heavy mode) governance:
  - W repo już istnieje:
    - `server/src/services/ai/deepResearchService.ts` + `tavilyWebSearchService.ts`,
    - `server/src/services/ai/deepThinkingOrchestrator.ts` buduje “WEB RESEARCH” addon i source list.
  - V2 domyka:
    - “deep research” ma własny budget + guardrails (max queries, max sources, max content chars),
    - zawsze cytuje [n] i nigdy nie “udaje” dodatkowego researchu poza dostarczonym source blockiem,
    - zapisuje audit: researchType, queries, domains, timestamps.

- IN (MUST) — Unified citations (external sources):
  - Dla web sources cytowania są canonical:
    - marker `[1]`, `[2]` w treści,
    - `citations[]` jako meta (już jest emit w SSE oraz `context.external.citations` w `ai.routes.ts`).
  - V2 ujednolica weryfikację:
    - `citationVerifier.ts` traktuje external URL jako “partial” tylko po regex — V2 dodaje lepszy “verification tier”:
      - URL valid + domain allowed + retrievedBySystem = “verified_external”,
      - URL valid but not retrieved = “partial”.

- IN (MUST) — Persistence & audit (trust & reproducibility):
  - zapisujemy “external context snapshot” per chat run / message:
    - queries, results metadata (url/title/domain/score/date), *bez pełnych raw_content jeśli nie trzeba*,
    - link do `chatRunId` (jest już `chatTraceService.addEvent(... 'web_search' ...)`).
  - retencja:
    - raw snippets max 30–90 dni (config), agregaty dłużej,
    - możliwość wyłączenia persistence per org (compliance).

- IN (MUST) — Tooling (function calling):
  - AI tool `search_web` istnieje (`server/src/services/ai/toolDefinitions.ts`) i używa Tavily.
  - V2 wymaga:
    - gating tool availability przez policy (`internetEnabled`) + env (`TAVILY_API_KEY`),
    - ten sam domain policy i cache co “light web search”,
    - spójny output format (title/url/snippet + answer).

- OUT (post‑V2):
  - pełny “browser-based retrieval” (rendering JS pages) — tylko jeśli potrzebne,
  - rozszerzony “internet governance per project” (np. allowlist per industry/regulatory).

**Implementation notes (grounded w repo):**
- Light web search już działa w chat stream:
  - `server/src/routes/ai.routes.ts`:
    - heurystyka `webSearchIntentDetector.ts`,
    - Tavily adapter `tavilyWebSearchService.ts`,
    - inject do `pipelineRequest.options.systemInstruction` + `context.external.webSearch`.
- Deep Research istnieje:
  - `deepResearchService.ts` (iterative deepening, orgContext injection),
  - `deepThinkingOrchestrator.ts` (format + sources block).
- Policy model istnieje:
  - `server/src/services/aiPolicyEngine.ts` (ma `internetEnabled`, Regulatory Mode → internet off).
- External context layer w `AIContextBuilder` jest stub:
  - `server/src/services/aiContextBuilder.ts` `_buildExternalContext` zwraca tylko `internetEnabled` + empty sources → V2 to domyka.

**Data model (V2, minimal):**
- (SHOULD) `ai_web_sources_log`:
  - `id`, `chat_run_id`, `organization_id`, `user_id`,
  - `mode` (`web_search` | `deep_research`),
  - `queries_json`, `sources_json` (url/title/domain/score/publishedDate),
  - `created_at`, `policy_snapshot` (internetEnabled, allowlist hash),
  - `dedupe_key`.

**API contract (V2, minimal):**
- `GET /api/ai/policy` (już istnieją podobne; V2 zapewnia `internetEnabled` w payload)
- `POST /api/ai/web-search/test` (superadmin/admin) — dry-run i pokaz sources + policy reason
- (opcjonalnie) `GET /api/superadmin/ai/web-sources?orgId=...` — audit list + filters

**Analytics / metrics:**
- `ai_web_search_used` (mode, queriesCount, citationsCount, domainsCount)
- `ai_web_search_blocked` (reason=policy|no_key|domain_blocked)
- KPI: citation verification score, groundedness ↑, time‑to‑answer ↓, spadek “unverified claims”.

**Definition of Done (DoD):**
- Web Search i Deep Research respektują `internetEnabled` i Regulatory Mode.
- Jest domain policy + SSRF safety + cache.
- Każde użycie internetu ma citations i audit trail (min. w chat trace; preferowane w DB log).
- AIContextBuilder pokazuje w `externalSourcesUsed` realne źródła, gdy użyte.

**Acceptance / test plan:**
- Test: org z `internetEnabled=0` → web search nie odpala; UI dostaje jasny reason.
- Test: org z internet ON → auto-intent odpala search, a odpowiedź ma cytowania [1], [2].
- Test: deepResearch ON → research addon zawiera sources block + citations; brak “udawania” dodatkowych źródeł.
- Test: domena na denylist → wynik odfiltrowany; audit event `domain_blocked`.

---

## T119 — 🟣 ai — Organizational Context Governance for AI (what AI may know + data controls + audit)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (enterprise trust, privacy, predictable behavior)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
AI w Consultify ma działać jak “enterprise consultant”, więc musi korzystać z kontekstu organizacji (industry, dojrzałość PMO, strategie, patterny), ale:
- organizacje różnią się tolerancją na “AI seeing data” (privacy, compliance),
- bez jasnych kontroli i audytu nie ma enterprise trust (a w regulated — to blocker),
- bez klasyfikacji danych AI może “przypadkiem” użyć rzeczy zbyt wrażliwych,
- bez polityki retencji i redakcji PII ryzykujemy naruszenia.

**Cel (outcome):**
W V2 organizacja ma kanoniczny “AI Context Governance”:
- jasno zdefiniowane **kategorie danych** dostępne dla AI,
- konfigurowalne **polityki dostępu** (org + project override),
- wbudowaną **redakcję PII** i politykę retencji,
- pełny **audit trail**: co zostało wstrzyknięte do kontekstu i dlaczego.

**Scope (V2)**
- IN (MUST) — Canonical context categories (organization scope):
  - `ORG_PROFILE` (nazwa, branża, region, high-level settings),
  - `ORG_TERMINOLOGY` (glossary / słownik pojęć organizacji),
  - `ORG_PATTERNS` (best practices / lessons learned z `organization_memory`),
  - `ORG_STRATEGY` (strategic directions z KnowledgeService),
  - `ORG_SECURITY_POSTURE` (tylko agregaty/metryki, bez logów wrażliwych),
  - `ORG_FINANCIAL_SUMMARY` (tylko high-level, jeśli włączone; bez danych wrażliwych),
  - `ORG_DOCUMENTS` (RAG: dokumenty organizacji, wg statusu/zgód).

- IN (MUST) — Policy model (SSOT + merging):
  - V2 definiuje merge kolejności:
    1) SuperAdmin global (guardrails),
    2) Organization policy (admin),
    3) Project governance override (jeśli dozwolone),
    4) User preferences (tylko w dół — nie eskalują dostępu).
  - W repo istnieją już klocki:
    - `ai_policies` + `AIPolicyEngine` (policyLevel, `internetEnabled`, auditRequired),
    - `AISettingsService` (`organization_ai_settings`: m.in. `web_search_enabled`, `audit_all_requests`, `pii_detection_sensitivity` w global).
  - V2 konsoliduje: “context governance” musi mieć jedno kanoniczne miejsce konfiguracji (preferowane: `organization_ai_settings` + dodatkowe kolumny JSON “context_policy_json”).

- IN (MUST) — Enforcement w runtime (AIContextBuilder):
  - Kanoniczny builder kontekstu już istnieje:
    - `server/src/services/aiContextBuilder.ts` buduje warstwy: platform / organization / project / execution / knowledge / external.
  - V2 dopina filtrowanie per category:
    - `_buildOrganizationContext` respektuje `context_policy_json`,
    - `_buildKnowledgeContext` respektuje politykę “documents allowed” (np. tylko `status='approved'|published'`).
  - “Fail-safe”:
    - jeśli nie da się odczytać polityki → default jest **bardziej restrykcyjny** (np. brak orgPatterns / brak docs), ale chat nadal działa (fail-soft).

- IN (MUST) — PII & sensitive data handling:
  - istnieje `enterpriseSecurity.scanAndSanitize` (PII redaction + injection defense) i audit do `ai_security_audit_log`.
  - V2 wymaga:
    - redakcja PII w kontekście organizacji (terminology/patterns/docs excerpts) wg sensitivity ustawionej globalnie + user opt-in,
    - zakaz wstrzykiwania surowych identyfikatorów osób (email/phone/PESEL/etc.) do promptu,
    - jasne zasady: AI może referować role (“CFO”, “sponsor”), ale nie personal data, chyba że user jawnie poda w rozmowie.

- IN (MUST) — Auditability (“why AI knew this”):
  - jeżeli `audit_all_requests` jest włączone:
    - logujemy “context manifest”: które kategorie były użyte, ile elementów, hash kontekstu (`contextHash` już jest).
  - minimalnie:
    - `chatTraceService` eventy: `org_context_injected` + counts + policy snapshot hash.

- IN (MUST) — Admin UX (Org settings):
  - w panelu Admin/SuperAdmin istnieje “AI settings” → V2 dodaje sekcję “Context Governance”:
    - toggles per category (ORG_PROFILE, ORG_TERMINOLOGY, ORG_PATTERNS, ORG_STRATEGY, ORG_DOCUMENTS),
    - retention (standard/strict) + “no persistence”,
    - “preview what AI sees” (read-only).

- OUT (post‑V2):
  - granular per-document ACL i labelowanie (DLP) na poziomie chunków,
  - automatyczne wykrywanie wrażliwych treści w dokumentach i auto-classification.

**Implementation notes (grounded w repo):**
- Organization context już jest wstrzykiwany:
  - `AIContextBuilder._buildOrganizationContext` używa:
    - `organizations` (name/industry),
    - `ai_organization_memory` (pmo_maturity),
    - `organization_memory` (top patterns),
    - `ai_organization_memory` (`terminology_*`).
- Knowledge/strategy już istnieje jako warstwa:
  - `AIContextBuilder._buildKnowledgeContext` przez `KnowledgeService.getActiveStrategies(...)`.
- AI Settings istnieją i mają audit:
  - `server/src/services/aiSettingsService.ts` (organization_ai_settings + audit log).
- PII redaction + injection defense istnieje:
  - `server/src/services/ai/enterpriseSecurity.ts`.

**Data model (V2, minimal):**
- (MUST) `organization_ai_settings.context_policy_json` (JSON):
  - `{ categories: { ORG_PROFILE: true, ORG_TERMINOLOGY: true, ORG_PATTERNS: false, ORG_STRATEGY: true, ORG_DOCUMENTS: true }, piiRedaction: 'inherit'|'off'|'on', retention: 'standard'|'strict' }`
- (SHOULD) `ai_context_audit_log`:
  - `id`, `chat_run_id`, `organization_id`, `user_id`,
  - `context_hash`, `categories_used_json`, `sizes_json`, `policy_hash`, `created_at`.

**API contract (V2, minimal):**
- `GET /api/admin/ai/context-policy` → current org policy + effective merge preview
- `PUT /api/admin/ai/context-policy` (guardrails + audit) → update
- `GET /api/admin/ai/context-policy/preview` → “what AI sees” snapshot (redacted)

**Analytics / metrics:**
- `ai_context_category_used` (category, count)
- `ai_context_blocked` (category, reason=policy|compliance)
- KPI: fewer “AI used wrong data”, improved trust score, reduced compliance escalations.

**Definition of Done (DoD):**
- Organizacja może skonfigurować dostęp AI do kategorii kontekstu.
- Runtime enforcement działa (AIContextBuilder respektuje policy).
- PII jest redagowane wg polityki.
- Jest audit trail (min. contextHash + categories_used).

**Acceptance / test plan:**
- Test: ORG_PATTERNS disabled → AIContextBuilder nie zwraca `orgPatterns`.
- Test: ORG_DOCUMENTS disabled → RAG nie dodaje org docs do promptu.
- Test: PII w org memory → redacted w kontekście + audit log event.
- Test: audit_all_requests ON → powstaje rekord context manifest dla chat run.

---

## T120 — 🟣 ai — Individual Context Governance for AI (user privacy + personalization controls + “private mode”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (privacy-by-design, user trust)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Żeby AI było naprawdę pomocne, musi personalizować styl i pamiętać preferencje usera. Ale:
- część userów chce “AI bez pamięci” (privacy, zaufanie),
- musimy wspierać GDPR: eksport/usuń dane, retencja, purpose limitation,
- bez jasnych przełączników user nie wie “co AI pamięta” i skąd to ma.

**Cel (outcome):**
W V2 każdy user ma czytelne, egzekwowane ustawienia:
- co może być zapisywane jako **user memory**,
- czy AI może używać **personalizacji**,
- jaki jest **czas retencji** kontekstu i logów,
- tryb **Private Chat** (no persistence, no memory updates),
- oraz narzędzia: **preview / export / delete**.

**Scope (V2)**
- IN (MUST) — Canonical user context categories:
  - `USER_PREFERENCES` (język, styl, “detail level”),
  - `USER_EXPERTISE` (lista obszarów kompetencji),
  - `USER_RECENT_TOPICS` (rolling topics),
  - `USER_ACTIVITY_SIGNALS` (agregaty: interactionCount, lastInteractionAt),
  - `USER_CUSTOM_INSTRUCTIONS` (tekst użytkownika, ograniczony długością).

- IN (MUST) — Existing foundation (grounded in repo):
  - user memory istnieje:
    - `server/src/services/ai/aiMemoryService.ts` (`ai_user_memory`),
    - `AIPipeline` wstrzykuje `userMemory` do kontekstu gdy dostępne.
  - user settings istnieją:
    - `server/src/services/aiSettingsService.ts` ma defaulty: `enable_pii_redaction`, `share_usage_analytics`, `context_retention`.
  - prompt security istnieje:
    - `enterpriseSecurity.scanAndSanitize` zapisuje `ai_security_audit_log`.

- IN (MUST) — Private mode (per conversation/session):
  - UI toggle “Private chat” (session-scoped):
    - nie zapisuje user memory (`aiMemoryService.updateUserMemoryAfterInteraction` nie wywołuje się),
    - nie zapisuje web sources snapshotów (T118),
    - ogranicza audit trail do minimum technicznego (np. error logs bez payload).
  - Private mode nie może wyłączać legal/compliance wymaganych logów bezpieczeństwa (np. injection_blocked).

- IN (MUST) — User-controlled personalization:
  - user może wyłączyć:
    - zapisywanie user memory,
    - użycie user memory w kontekście,
    - share usage analytics (jeśli nie wymagane do billing/abuse prevention).
  - “Fail-safe”: gdy user wyłączy pamięć → AI nadal działa, ale z neutralnym stylem i bez odwołań do historii poza conversation history.

- IN (MUST) — Retention & GDPR controls:
  - `context_retention` (już istnieje jako ustawienie user) ma znaczenie egzekwowane:
    - `session` (default): pamięć długoterminowa tylko preferencje; brak historii tematów jeśli user wyłączy,
    - `extended`: pozwala na recentTopics/expertise,
    - `none`: brak memory persistence.
  - user może:
    - podejrzeć co AI pamięta (“preview”),
    - wyeksportować memory (JSON),
    - usunąć memory (soft delete + audit).

- IN (MUST) — Guardrails for personal data:
  - zakaz zapisu do `ai_user_memory` danych typu PII/sekrety:
    - przy update memory przechodzimy przez PII redaction (sensitivity z global settings).
  - UI copy jasno mówi: “Nie zapisujemy danych wrażliwych; jeśli podasz je w czacie, mogą zostać użyte w tej sesji.”

- OUT (post‑V2):
  - per-feature consent (np. osobne zgody na “behavioral intelligence” T113),
  - “on-device memory” (jeśli będzie mobile-native).

**Data model (V2, minimal):**
- (MUST) `ai_user_preferences` / `ai_user_memory` jako SSOT dla user-level (bez dublowania):
  - V2 wybiera jeden kanon i zapewnia compat-layer, bo repo używa obu ścieżek (policy engine vs memory service).
- (SHOULD) `ai_user_privacy_settings` (jeśli nie da się dołożyć do existing settings):
  - `user_id`, `memory_enabled`, `memory_write_enabled`, `private_mode_default`, `retention_mode`, `updated_at`.

**API contract (V2, minimal):**
- `GET /api/settings/ai/privacy` → effective user privacy config
- `PUT /api/settings/ai/privacy` → update (audit)
- `GET /api/settings/ai/memory/preview`
- `GET /api/settings/ai/memory/export`
- `DELETE /api/settings/ai/memory` (requires confirmation)

**Analytics / metrics:**
- `ai_private_mode_enabled` / `ai_private_mode_disabled`
- `ai_memory_write_blocked` (reason=user_setting|policy)
- KPI: wzrost opt-in rate, spadek “privacy concerns” feedback.

**Definition of Done (DoD):**
- Private mode działa i realnie wyłącza persistence/memory updates.
- User może preview/export/delete pamięć.
- Retention jest egzekwowane w kodzie (nie tylko UI).
- Memory writes są PII-safe (redaction + blocklist).

**Acceptance / test plan:**
- Test: private mode ON → `ai_user_memory.interaction_count` nie rośnie, recentTopics nie aktualizuje się.
- Test: retention `none` → brak zapisów memory w DB.
- Test: export → zwraca tylko dozwolone kategorie (bez sekretów/PII).
- Test: delete → usuwa/zeruje memory i jest event w audit.

---

## T121 — 🟣 ai — Organizational Context Governance for AI (Extended Controls: per-project, per-document, DLP-lite)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI Platform Governance (enterprise / regulated readiness)
- Priorytet / V2 scope: V2

**Business challenge (problem):**
T119 daje bazowe kontrolki “czy AI może widzieć X”, ale enterprise oczekuje precyzji:
- różne projekty mogą mieć różne restrykcje (np. M&A, bezpieczeństwo),
- dokumenty muszą mieć “AI visibility” oraz poziom wrażliwości,
- potrzebujemy kontrolowanego wyjątku (allowlist) bez rozszczelniania całej organizacji,
- potrzebujemy dowodu dla audytu: “AI nie używało wrażliwych dokumentów”.

**Cel (outcome):**
W V2 mamy rozszerzone, ale nadal lekkie (DLP-lite) kontrole:
- per-project override (bardziej restrykcyjny niż org),
- per-document visibility + sensitivity,
- narzędzie do weryfikacji i audytu użycia dokumentów przez AI (manifest + query logs),
- spójne działanie na obu schematach RAG (nowy `knowledge_documents` i legacy `knowledge_docs`).

**Scope (V2)**
- IN (MUST) — Per-project overrides:
  - Project może “zaostrzyć” politykę z T119 (nigdy poluzować):
    - wyłączyć `ORG_DOCUMENTS` dla projektu,
    - wyłączyć web search w projekcie (nawet jeśli org ma internetEnabled),
    - ograniczyć do allowlist kategorii dokumentów (np. tylko `procedure`, `policy`).
  - Grounding:
    - `projects.governance_settings` już istnieje i jest parsowane w `AIContextBuilder._buildProjectContext`.

- IN (MUST) — Per-document “AI visibility”:
  - Kanoniczne atrybuty dokumentu (dla `knowledge_documents`):
    - `ai_visibility`: `allowed` | `blocked` | `requires_approval`,
    - `sensitivity`: `public` | `internal` | `confidential`,
    - `retention_class`: `standard` | `strict`.
  - Dla legacy `knowledge_docs`:
    - compat-layer przez `tags`/`category` lub side-table mapping (bez przebudowy całego legacy).

- IN (MUST) — Enforcement in retrieval:
  - `KnowledgeService.getDocuments(...)` i RAG retrieval muszą filtrować:
    - tylko `ai_visibility='allowed'` (oraz zgodne z project override),
    - `confidential` nigdy nie idzie do AI bez jawnego user approval (HITL).
  - “No surprises”: UI pokazuje, że dany dokument nie będzie użyty przez AI (badge).

- IN (MUST) — HITL approval (minimal):
  - jeśli dokument ma `requires_approval`:
    - AI może poprosić usera o zgodę na użycie tej klasy dokumentów w rozmowie,
    - zgoda jest zapisywana (scope: conversation / project / org; domyślnie conversation).

- IN (MUST) — Audit & verification:
  - dla każdej odpowiedzi opartej o dokumenty:
    - logujemy listę docIds użytych w retrieval (top N),
    - logujemy “blocked docs attempted” (jeśli query próbowało, ale policy odcięła).
  - SuperAdmin ma widok: “AI document usage audit” (org/project filter).

- OUT (post‑V2):
  - pełne DLP (automatyczne klasyfikowanie chunków, regex PII na chunkach, watermarking),
  - integracja z zewnętrznym DLP/Key Management.

**Implementation notes (grounded w repo):**
- Repo ma już dual-schema knowledge:
  - `KnowledgeService.getDocuments` próbuje `knowledge_documents`, fallback `knowledge_docs`.
- AIContextBuilder buduje knowledge layer przez KnowledgeService.
- Posiadamy mechanizmy HITL w AI (pending approvals context) — można je wykorzystać jako “approval record” dla `requires_approval`.

**Data model (V2, minimal):**
- (SHOULD) kolumny w `knowledge_documents` (migration V2):
  - `ai_visibility TEXT DEFAULT 'allowed'`,
  - `sensitivity TEXT DEFAULT 'internal'`,
  - `retention_class TEXT DEFAULT 'standard'`.
- (SHOULD) `ai_doc_access_approvals`:
  - `id`, `organization_id`, `project_id`, `user_id`, `document_id`, `scope`, `approved_at`, `expires_at`.
- (SHOULD) `ai_doc_usage_log`:
  - `id`, `chat_run_id`, `organization_id`, `project_id`, `user_id`,
  - `used_document_ids_json`, `blocked_document_ids_json`, `created_at`.

**API contract (V2, minimal):**
- `PUT /api/admin/knowledge-documents/:id/ai-visibility` (allowed/blocked/requires_approval)
- `PUT /api/admin/knowledge-documents/:id/sensitivity` (public/internal/confidential)
- `GET /api/superadmin/ai/doc-usage-audit?orgId=&projectId=&days=30`

**Analytics / metrics:**
- `ai_doc_used` (docId, sensitivity)
- `ai_doc_blocked` (docId, reason)
- KPI: fewer compliance escalations, faster approvals, higher trust.

**Definition of Done (DoD):**
- Dokumenty mają AI visibility i sensitivity (dla nowego schema; legacy ma compat).
- Retrieval filtruje dokumenty zgodnie z org/project policy.
- Jest minimalny HITL dla `requires_approval`.
- Jest audit trail doc usage per chat run.

**Acceptance / test plan:**
- Test: doc `blocked` → nigdy nie jest użyty w RAG, nawet jeśli jest najbardziej podobny.
- Test: project override wyłącza ORG_DOCUMENTS → brak docs w kontekście.
- Test: doc `requires_approval` → bez zgody nie użyty; po zgodzie użyty tylko w scope conversation.

---

## T122 — 🟣 ai — System Architecture Consolidation & Dependency Review (remove duplicates, unify SSOT, reduce risk)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Platform Architecture (stability, maintainability, deterministic behavior)
- Priorytet / V2 scope: V2 (launch-hardening)

**Business challenge (problem):**
Po wielu iteracjach system urósł i ma oznaki “multi‑route / multi‑service drift”:
- duplikaty routerów i endpointów (szczególnie AI: prompts/learning/settings/analytics),
- mieszanina legacy schematów DB (knowledge docs, prompts) + nowe schematy (RAG 266, ai_system_prompts),
- importy `.js` vs `.ts` oraz lazy-load obejścia circular deps zwiększają ryzyko 503 “feature unavailable”,
- brak jednej mapy zależności → ciężko przewidzieć skutki zmian (V2 wymaga stabilności i trust).

**Cel (outcome):**
W V2 architektura jest “clean enough”:
- jeden kanoniczny router / SSOT per capability (prompts, learning, context, web research),
- zredukowane duplikaty w `Gateway.ts`,
- udokumentowane granice modułów + dependency review (cykle, hot paths),
- automatyczne guardrails w CI (wykrywanie import drift / duplicate mounts / missing modules).

**Scope (V2)**
- IN (MUST) — Route consolidation (API gateway hygiene):
  - przegląd `server/src/Gateway.ts` i:
    - identyfikacja zduplikowanych importów i mountów (np. podobne AI analytics/routes),
    - wybór kanonicznego path + aliasy dla legacy (bez breaking changes),
    - zakaz montowania “stub routers” w prod (spójne z T107/T108).

- IN (MUST) — SSOT consolidation for AI platform:
  - Prompts/learning/context:
    - zgodnie z T116/T117: jeden kanon prompt registry + jeden kanon context builder,
    - usunięcie/oznaczenie deprecated ścieżek (np. legacy `server/src/ai/*` jeśli dubluje `server/src/services/*`).
  - Knowledge/RAG:
    - kanon: `knowledge_documents` (266), legacy tylko jako fallback przez compat-layer.

- IN (MUST) — Dependency review (circular deps + lazy-load discipline):
  - katalog “AI platform” ma jasne zasady:
    - gdzie wolno lazy-load, a gdzie nie (tylko w “integration boundaries”),
    - zakaz silent swallowing dla krytycznych braków (np. jeśli guardy policy missing → musi być metryka + health check).
  - dodajemy raport:
    - największe cykle importów,
    - “hot path” dla `/api/ai/chat/stream`,
    - lista modułów o najwyższym ryzyku (db access, network calls, embeddings).

- IN (MUST) — Health checks for critical AI deps:
  - endpoint / check agregujący:
    - DB schema availability (ai tables, knowledge tables),
    - web search key presence (jeśli feature ON),
    - promptAssembler availability (T116),
    - citation verifier availability (T117).
  - fail-open tylko tam gdzie to świadoma decyzja i jest log/metryka.

- IN (MUST) — CI guardrails (minimal):
  - skrypt “arch sanity”:
    - wykrywa duplikaty mountów na ten sam base path,
    - wykrywa importy do nieistniejących modułów / złą końcówkę `.js`,
    - wykrywa “new schema used without fallback” tam gdzie wymagany compat.

- OUT (post‑V2):
  - pełna refaktoryzacja modułowa (monorepo packages / clean architecture),
  - automatyczne “architecture tests” (enforced boundaries).

**Implementation notes (grounded w repo):**
- `server/src/Gateway.ts` montuje bardzo wiele routerów; jest też mechanika “enableStubRoutes”.
- Repo ma jawne duplikacje w AI warstwie (T116) i legacy vs services (T117).
- W wielu miejscach stosowane jest lazy-load `import('./x.js')` jako workaround na cykle.

**Deliverables (V2):**
- “Canonical API map” (krótka tabela: capability → canonical route → legacy aliases).
- Zredukowany gateway + jasno określone deprecations.
- Dependency report + lista cykli + rekomendacje.
- CI sanity check + health checks.

**Definition of Done (DoD):**
- Nie ma duplikatów kanonicznych endpointów dla tych samych capability (prompts/learning/context/web search).
- Gateway jest uporządkowany: stub routes nie wychodzą w prod.
- Jest raport zależności + sanity checks w CI.
- AI krytyczne zależności mają health checks i obserwowalność.

**Acceptance / test plan:**
- Test: uruchomienie sanity check wykrywa duplicate mount i failuje build.
- Test: prod config bez `ENABLE_STUB_ROUTES` nie wystawia stub endpoints.
- Test: AI health check raportuje brakujące tabele/keys jako “degraded” (nie silent).

---
