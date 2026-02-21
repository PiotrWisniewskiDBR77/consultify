---
INSTRUKCJA: Część 2 z 3: T041–T080. Wklej po Part 1.
---

## T041 — 🟡 execution — Delay Detection and Schedule Control (plan vs actual, deviations → alerts)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Execution governance / Schedule control) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez wczesnych sygnałów opóźnienia wychodzą za późno i psują timeline oraz zaufanie sponsora. Potrzebujemy stałej kontroli „plan vs wykonanie” dla inicjatyw i tasków, z progami odchyłek i czytelną odpowiedzią: **gdzie jest slip i dlaczego**.

**Cel (outcome, nie feature):**
System:
- automatycznie wykrywa odchylenia (deviations) w inicjatywach i taskach,
- wyzwala alerty wg progów,
- pokazuje listę opóźnień z kontekstem (zależności, blocked, capacity, RAID),
tak aby PMO mogło reagować wcześniej.

**Użytkownicy i scenariusze:**
- PMO: codziennie widzi „delay list” i najważniejsze przyczyny.
- Lider wykonania: dostaje alert „slip risk” 7 dni przed deadline i może skorygować plan.
- Sponsor (read‑only): widzi odchylenia i plan korekty.

**Scope (V2)**
- IN:
  - Plan vs actual comparison (MUST):
    - inicjatywy:
      - plan: `plannedStartDate`, `plannedEndDate`,
      - wykonanie: `execution_started_at` / `start_date` + `end_date` (jeśli istnieją) + status/progress,
    - taski:
      - plan: `due_date` + SLA (`sla_due_at`) + status,
    - definicja odchyłki (deviation):
      - „late start”: start po plannedStart,
      - „late finish risk”: dziś > plannedEnd i status != DONE,
      - „deadline risk”: N dni do plannedEnd, a progress/tempo wskazuje brak domknięcia (heurystycznie).
  - Deviation thresholds (MUST):
    - progi jako konfiguracja (V2 baseline):
      - warning: np. 3 dni slip risk,
      - critical: np. 7+ dni albo overdue,
    - różne progi dla priority (CRITICAL/HIGH/…).
  - Alerts & anti‑spam (MUST):
    - powiadomienia do: owner/PMO/sponsor (wg typu),
    - throttling (np. max 1/24h per initiative/task per deviation type),
    - link do konkretnego widoku (Execution Timeline / Initiative / My Work).
  - “Why slip” context (MUST):
    - dla każdej pozycji delay pokazujemy top‑reasons (max 3):
      - BLOCKED + czas blokady,
      - zależności (predecessor not done / conflict z T039),
      - overload/capacity (T036),
      - RAID high/critical items (T040),
      - brak ownera / brak planu tasks (T033/T032) (jeśli dotyczy).
  - UI integration (MUST):
    - w Execution module: panel/lista opóźnień + filtry (severity, status, owner),
    - w Timeline (T039): wizualne oznaczenie slip/overdue + tooltip „why”.
  - Ops job (MUST):
    - cron job lub scheduled worker, który liczy deviations i zapisuje „delay signals” (TBD storage) + wysyła alerty.
- OUT:
  - pełna predykcja opóźnień (ML) i integracje z zewn. PPM.
- Future enhancements (post‑V2):
  - Predykcja slip na danych historycznych + scenariusze korekty (sprzężenie z T035/T038).
  - Auto‑propose mitigations i resekwencja (z decyzją PMO).

**UX / UI notes:**
- Musi być “quiet but urgent”: mało alertów, wysokiej jakości sygnały.
- Lista opóźnień skanowalna: severity + days + reason chips.

**Data / integrations:**
- Inicjatywy: planned dates, status, progress, dependencies.
- Taski: due_date, SLA, status, assignee/owner.
- Wykorzystać istniejące joby/serwisy (SLA checks, auto‑start job) jako wzorce architektoniczne.

**Security / compliance:**
- Uprawnienia jak do inicjatyw/tasków; sponsor read‑only.

**Analytics (events/metrics):**
- `delay_signal_detected` (entity=initiative|task, severity, days)
- `delay_alert_sent` / `delay_alert_clicked`
- KPI: wcześniejsze wykrycia, redukcja “late escalations”, spadek overdue.

**Risks:**
- Noise (za dużo alertów) → potrzebne progi + throttling + możliwość dismiss.
- Brak danych (progress/estymaty) → heurystyki muszą być conservative i oznaczać unknowns.

**Open questions:**
- Czy deviation signals zapisujemy jako osobną tabelę (history) czy wyliczamy on‑the‑fly w V2?

**Definition of Done (DoD):**
- System wykrywa odchylenia i generuje alerty zgodnie z progami.
- Użytkownik widzi listę opóźnień + kontekst (inicjatywa/task, zależności).

**Acceptance / test plan:**
- Test: inicjatywa plannedEnd wczoraj + status EXECUTING → critical deviation + widoczna w liście.
- Test: throttling — ten sam alert nie wysyła się częściej niż 1/24h.

**Rollout plan:**
- Najpierw view‑only (lista deviations), potem alerty i automation.

---

## T042 — 🟡 execution — Budget Planning and Financial Control (AI‑supported, assumptions vs actual)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance governance / Execution control) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Transformacja bez dyscypliny finansowej „rozjeżdża się”: budżety są wpisywane ad‑hoc, a overspending wychodzi dopiero po fakcie. Potrzebujemy jednego, spójnego mechanizmu:
- planowania budżetu (assumptions),
- monitoringu wykonania (actual),
- wczesnych sygnałów overspend risk,
- oraz sensownych korekt (nie tylko ostrzeżenie).

**Cel (outcome, nie feature):**
Finanse/PMO widzą na bieżąco:
- **plan vs actual** per inicjatywa / projekt / organizacja,
- forecast (prosty) do końca okresu,
- sygnały ryzyka przekroczenia,
z możliwością uruchomienia działań korygujących (task/decision) i raportowania sponsorowi.

**Użytkownicy i scenariusze:**
- Finanse: ustawia budżety i progi, przegląda wykonanie i forecast.
- PMO: widzi overspend risk powiązany z timeline i proponowane korekty.
- Sponsor (read‑only): widzi status budżetu i plan działań.

**Scope (V2)**
- IN:
  - Budget planning (MUST):
    - per inicjatywa: plan budżetu jako pozycje (CAPEX/OPEX) z walutą (już istnieje w `ResourcesSection` jako `BudgetItem`),
    - per projekt / user / org: limity budżetowe (wykorzystać istniejące endpointy `budgets.routes.ts` + `budgetManagementService.ts` tam, gdzie pasuje).
  - Actual tracking (V2 baseline = “good enough”):
    - AI spend: koszty tokenów (macie `ai_cost_usage` i monitoring),
    - pozostałe koszty: V2 minimum = manualne wprowadzanie „actual” (TBD model: rozszerzenie `BudgetItem` albo osobna tabela),
    - okres rozliczeniowy: miesięczny + (opcjonalnie) kwartalny.
  - Plan vs actual views (MUST):
    - dashboard per inicjatywa:
      - total planned, total actual, variance, burn rate,
      - CAPEX vs OPEX,
    - dashboard per projekt/portfolio: top overspend risks + największe wariancje.
  - Overspend risk detection (MUST):
    - heurystyki:
      - actual/planned > 80/90/100% (per inicjatywa i per okres),
      - burn rate wskazuje przekroczenie do końca okresu (prosty forecast),
      - duże nowe pozycje budżetowe bez uzasadnienia (TBD),
    - integracja z status reports: `budgetConsumedPercent` + `isOverBudget` (macie już sekcję BUDGET w `StatusReportService`).
  - AI‑supported recommendations (MUST, conservative):
    - rekomendacje korekt w 2–3 opcjach:
      - redukcja/etapowanie scope (linked do decyzji),
      - resekwencja inicjatyw (link do T035/T038),
      - renegocjacja vendorów/licencji (task),
      - ograniczenia AI spend (model/tier policy, limity),
    - explainability: skąd wniosek (dane + założenia).
  - Alerts (MUST):
    - powiadomienia przy progach (80/90/100) + throttling,
    - routing do: finanse/PMO/owner (wg typu budżetu).
- OUT:
  - Pełna księgowość/ERP i automatyczne księgowania.
- Future enhancements (post‑V2):
  - Integracje z ERP/PPM, faktury, cost allocation (chargeback).
  - Earned Value / baseline vs actual na timeline.

**UX / UI notes:**
- Jednoznaczne liczby + trend + „co robić” (actionable, nie tylko czerwony kolor).
- Spójne z Execution Hub: obok delay/risk ma być budget signal (ale bez spamu).

**Data / integrations:**
- `ResourcesSection` (`BudgetItem`) jako źródło planu per inicjatywa.
- AI usage: `AICostMonitoringService` / `ai_cost_usage` + istniejące alerty kosztowe.
- Backend: `budgets.routes.ts` / `budgetManagementService.ts` jako baza pod limity i alerting.

**Security / compliance:**
- Edycja budżetów: ADMIN/OWNER/Finance role (TBD mapping w RBAC).
- Sponsor read‑only.
- Audit log zmian planu budżetu i progów alertów.

**Analytics (events/metrics):**
- `budget_plan_updated` / `budget_actual_updated`
- `budget_overspend_signal_detected`
- `budget_recommendation_applied` (type)
- KPI: mniej overruns, szybsza reakcja, większa przewidywalność.

**Risks:**
- Źródła actual są niekompletne (na start manual) → komunikacja w UI: “coverage”.
- Niska wiarygodność AI rekomendacji → w V2 tylko conservative i explainable.

**Open questions:**
- Jak modelujemy „actual” kosztów poza AI: rozszerzenie `BudgetItem` czy osobna tabela historii?
- Czy default waluta jest per org, czy per initiative (dziś `BudgetItem` ma `currency`)?

**Definition of Done (DoD):**
- Budżet jest planowany i porównywalny z wykonaniem (per inicjatywa/projekt/org).
- System sygnalizuje overspending risk i proponuje działania (np. przesunięcia, resekwencja).

**Acceptance / test plan:**
- Test: planned 100k, actual 95k → AMBER + alert wg progów; po przekroczeniu 100k → RED + escalation.
- Test: AI spend rośnie szybciej niż plan → overspend risk + rekomendacja ograniczeń.

**Rollout plan:**
- Najpierw initiative‑level (plan + manual actual + signals), potem portfolio dashboard i AI rekomendacje.

---

## T043 — 🟡 execution — Human Resource Management and Capability Alignment (kompetencje → wymagania → assignment)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (People / Delivery enablement) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Delivery cierpi, gdy:
- role są przypisywane „na oko”,
- brakuje dopasowania kompetencyjnego do zadań,
- a luki kompetencyjne wychodzą dopiero po reworku i opóźnieniach.
Potrzebujemy struktury: **kto umie co** + **czego wymaga praca** + **jak domykamy luki**.

**Cel (outcome, nie feature):**
System pokazuje dopasowanie kompetencji do tasków/inicjatyw, wspiera przypisywanie ról (manual + AI sugestie) oraz ujawnia luki kompetencyjne z planem ich domknięcia (szkolenie, vendor, re‑scope).

**Użytkownicy i scenariusze:**
- Lider/PMO: widzi „capability fit” portfela i ryzyka kompetencyjne.
- HR/People Ops: utrzymuje katalog kompetencji i poziomy, wspiera plan szkoleń.
- Owner inicjatywy: wybiera zasoby z listy rekomendacji i uzasadnieniem.

**Scope (V2)**
- IN:
  - Capability model (MUST):
    - katalog kompetencji (taxonomia) + poziomy (np. 1–5) + tagi (domain/tech/soft),
    - profil użytkownika: kompetencje + poziom + (opcjonalnie) certyfikaty/notes,
    - wymagania:
      - per task: wymagane kompetencje + min level,
      - per initiative: agregacja wymagań (z tasków + manual add).
  - Matching & gap analysis (MUST):
    - match score dla task/initiative ↔ user/team,
    - gap view: braki kompetencji (krytyczne / nice‑to‑have),
    - rekomendacje „how to fill gap”:
      - przypisanie innej osoby,
      - szkolenie/certyfikacja,
      - vendor/consultant,
      - rozbicie taska / zmiana scope (decision).
  - UI integration (MUST):
    - w My Work / Execution / People:
      - widok zespołu + capability matrix (minimalny, skanowalny),
      - widok taska z wymaganiami + sugestie kandydatów,
    - w `ResourcesSection` (FTE):
      - opcjonalny link “capability fit” dla przypisanych osób (V2 baseline może być read‑only badge).
  - Assignment support (MUST, manual approval):
    - AI może proponować przypisania, ale nigdy nie przypisuje automatycznie,
    - zapis decyzji/uzasadnienia (audit trail) przy przypisaniu w krytycznych taskach (TBD).
- OUT:
  - Pełny HRIS / performance management / oceny okresowe.
- Future enhancements (post‑V2):
  - Integracje z HRIS (CV, stanowiska, ścieżki kompetencji).
  - Predictive skill demand i hiring plan (sprzężenie z T036).

**UX / UI notes:**
- Minimal friction: szybkie tagowanie kompetencji (autocomplete) zamiast rozbudowanych formularzy.
- Explainability dla sugestii: “wybrano, bo … (skills match + availability)”.

**Data / integrations:**
- Taski/inicjatywy: wymagania kompetencji (nowe pola / nowe tabele) (TBD).
- Workload/capacity: wykorzystać istniejące dane (T036) jako constraint (availability).

**Security / compliance:**
- Kompetencje użytkownika mogą być wrażliwe → widoczność kontrolowana (org‑only, ograniczenie dla sponsorów).

**Analytics (events/metrics):**
- `capability_profile_updated`
- `capability_match_viewed`
- `capability_assignment_suggestion_generated` / `capability_assignment_applied`
- KPI: mniej reworku, lepsza terminowość, krótszy lead time do assignment.

**Risks:**
- Niekompletne dane kompetencji → V2 musi działać przy częściowych danych (“unknown” zamiast fałszywej pewności).
- Akceptacja w organizacji: obawa przed „ocenianiem” → framing jako „fit do pracy”, nie performance.

**Open questions:**
- Jaka taxonomia kompetencji jest default w V2 (globalna vs per org)? (propozycja: global seed + per‑org custom).

**Definition of Done (DoD):**
- System pokazuje dopasowanie kompetencji do zadań i wspiera assignment.
- Widoczne luki kompetencyjne i rekomendacje ich domknięcia.

**Acceptance / test plan:**
- Test: task z wymaganiami (2 skills) → lista 5 kandydatów posortowana po match score + availability.
- Test: brak danych skills → UI pokazuje “unknown coverage” i nie generuje fałszywych rekomendacji.

**Rollout plan:**
- Najpierw manual capability profiles + requirements na kluczowych taskach; potem AI sugestie i gap automation.

---

## T044 — 🟡 execution — Change Emotion and Sentiment Management (privacy‑first, odporność na bias)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Change management / Early warning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Human side of change jest kluczowy. Bez wczesnych sygnałów spada engagement, rośnie opór i delivery „nagle” się psuje. Jednocześnie temat jest wrażliwy: ryzyko naruszeń prywatności, biasu i błędnej interpretacji.

**Cel (outcome, nie feature):**
W V2 chcemy mieć **bezpieczny (privacy‑first) system sygnałów** o nastroju i oporze w kontekście inicjatyw/projektów:
- zbieramy lekkie, jawne sygnały (pulse / feedback / check‑ins),
- agregujemy trendy i ryzyka (nie “monitorujemy ludzi”),
- proponujemy reakcje change‑management (coach actions).

**Użytkownicy i scenariusze:**
- Change manager/PMO: widzi spadek trendu w 2 tygodnie i odpala plan działań.
- Lider: dostaje alert „resistance risk rising” + 3 propozycje reakcji.
- Sponsor (read‑only): widzi agregaty i plan komunikacji (bez danych jednostkowych).

**Scope (V2)**
- IN:
  - Signal capture (MUST, explicit):
    - pulse check‑ins (1–3 pytania, skala + opcjonalny komentarz),
    - feedback otwarty (anonimowy / jawny — zależnie od polityki org),
    - możliwość przypięcia sygnału do inicjatywy/projektu (metadata),
    - cadence (np. tygodniowo / co 2 tygodnie) (TBD scheduler).
    - Wykorzystać istniejące mechanizmy feedback tam, gdzie możliwe (np. `feedback.routes.ts` + `feedbackAIService.ts`) — ale rozszerzyć o kontekst change (initiativeId/projectId).
  - Privacy & governance (MUST):
    - brak analizy prywatnych komunikatorów bez zgód,
    - agregacja z progami anonimowości (np. nie pokazuj wyników jeśli < N odpowiedzi),
    - możliwość wyłączenia modułu per org + polityki anonimizacji,
    - retention: sygnały nie powinny żyć wiecznie (TBD).
  - Sentiment & resistance analysis (MUST, conservative):
    - trend (improving/stable/declining),
    - top concerns (tematy) + przykłady z komentarzy (tylko gdy spełnione progi anonimizacji),
    - AI wspiera streszczenia i tematykę, ale:
      - oznacza niepewność,
      - nie wyciąga wniosków o konkretnych osobach.
  - Actionable recommendations (MUST):
    - biblioteka reakcji (coaching actions) powiązana z sygnałami:
      - komunikacja (częstotliwość/format),
      - warsztaty, Q&A, training,
      - wzmocnienie sponsor support,
      - usunięcie pain points (task/decision).
    - możliwość utworzenia taska/decision bezpośrednio z rekomendacji.
  - Dashboards & alerts (MUST):
    - widok per initiative/project:
      - wskaźnik nastroju (trend),
      - ryzyka oporu (chips),
      - top themes,
    - alerty z throttlingiem (np. trend spadkowy 2 okresy z rzędu).
- OUT:
  - Zaawansowane psychometry, profilowanie osób, “employee monitoring”.
- Future enhancements (post‑V2):
  - Integracje kanałów (Teams/Slack) wyłącznie jako opt‑in surveys (nie scraping).
  - Modele predykcyjne rotacji/attrition (tylko jeśli organizacja tego chce i prawnie może).

**UX / UI notes:**
- Język UI musi być “change‑friendly”: nie “monitorujemy ludzi”, tylko “zbieramy sygnały”.
- Sponsor view: tylko agregaty i actions, zero danych jednostkowych.

**Data / integrations:**
- Backend: rozszerzenie feedback/pulse o `initiativeId`/`projectId` + summary endpoints.
- AI: reuse `feedbackAIService` patterns (sentiment, trending, summary) z dodatkowymi guardrails.
- Notifications: reuse `NotificationService` (alerty).

**Security / compliance:**
- Zgodność z prywatnością: opt‑in, role‑based access, anonimizacja progowa.
- Audit log zmian polityk (anonimowość, retention, module enabled).

**Analytics (events/metrics):**
- `change_pulse_submitted` (anonymous=true|false, scope=initiative|project)
- `change_sentiment_trend_changed`
- `change_resistance_alert_sent` / `clicked`
- KPI: wcześniejsze wykrycia oporu, lepsza retencja zaangażowania, mniej “surprise delays”.

**Risks:**
- Prywatność/bias → w V2 mocne guardrails i conservative AI.
- Low response rate → potrzebne nudges i prosta forma (1–2 kliknięcia).

**Open questions:**
- Jakie są domyślne progi anonimizacji (N) i retention dla danych pulse?

**Definition of Done (DoD):**
- System pokazuje wskaźniki/alerty sentimentu i sugeruje reakcje.
- Zgodność z prywatnością i zasadami organizacji (anonimizacja + role).

**Acceptance / test plan:**
- Test: 20 pulse odpowiedzi → trend + top themes; przy < N brak szczegółów.
- Test: spadek trendu 2 tygodnie → alert do PMO z rekomendacjami.

**Rollout plan:**
- Najpierw pilot na 1–2 inicjatywach (PMO), potem rollout org‑wide.

---

## T045 — 🟡 execution — Stakeholder Communication and Change Communication Management (cadence + segmenty + log)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Change management / Communication governance) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Zmiana wymaga rytmu i jakości komunikacji. Bez stałej, spójnej komunikacji do stakeholderów rośnie opór, chaos informacyjny i „plotki zamiast faktów”. Potrzebujemy narzędzia, które narzuca prostą dyscyplinę: **kto**, **co**, **kiedy**, **jakim kanałem** + potwierdzenie wykonania.

**Cel (outcome, nie feature):**
Dla inicjatyw można zdefiniować plan komunikacji i go egzekwować:
- segmenty odbiorców,
- cadence i typy komunikatów,
- spójne szablony,
- log wysyłek i follow‑ups,
tak aby sponsor i PMO mieli transparentny „communication runway”.

**Użytkownicy i scenariusze:**
- Change manager: tworzy plan komunikacji i wysyła komunikaty wg kalendarza.
- PMO: widzi zaległe komunikaty i ryzyko „silence gaps”.
- Sponsor: zatwierdza kluczowe komunikaty (opcjonalnie) i widzi historię.

**Scope (V2)**
- IN:
  - Stakeholder model (V2 baseline):
    - segmenty (np. frontline, middle management, union, IT, finance, leadership),
    - członkostwo segmentu:
      - wewnętrzni: org users / project members,
      - zewnętrzni: lista email (opcjonalnie, z opt‑in),
    - przypisanie segmentów do inicjatywy/projektu.
  - Communication plan (MUST):
    - plan per initiative:
      - cadence (weekly/biweekly/monthly) + wyjątki,
      - typy komunikatów (update, decyzja, FAQ, success story, risk notice),
      - owner komunikacji,
    - checklist egzekucji: “scheduled → sent → acknowledged (TBD)”.
  - Content & templates (MUST):
    - szablony (krótkie, skanowalne) z polami:
      - cel komunikatu, co się zmienia, impact, co dalej, gdzie pytać,
    - AI assist (opcjonalnie w V2):
      - dopasowanie tonu do segmentu,
      - skracanie/porządkowanie,
      - “3 bullet summary” dla sponsora,
      - guardrails: brak wrażliwych danych.
  - Sending & log (MUST):
    - kanały V2:
      - in‑app notifications (pewne),
      - email (jeśli macie skonfigurowane; inaczej „export + manual send”),
    - log komunikatów:
      - kiedy wysłano, do jakich segmentów, kto zatwierdził (jeśli włączone),
      - follow‑up tasks (np. Q&A meeting).
  - Alerts (MUST):
    - przypomnienia o zaległych komunikatach wg cadence,
    - throttling + możliwość snooze.
- OUT:
  - Pełny marketing automation (kampanie, A/B, journeys, scoring).
- Future enhancements (post‑V2):
  - Tracking delivery/open/click (po integracji z providerem email).
  - Integracje kanałów (Teams/Slack) jako wysyłka (nie scraping).
  - “Stakeholder map” (power/interest) + dynamiczne plany komunikacji.

**UX / UI notes:**
- Plan musi być ultra‑prosty: 1 ekran “cadence + next comm + backlog”.
- Dla sponsora: widok “what was communicated” + “what’s next”.

**Data / integrations:**
- Notifications: wykorzystać `notificationService` / istniejące eventy.
- Email: wykorzystać `emailService` / `AlertEmailService` jeśli dostępne.
- AI: można wykorzystać istniejące wzorce refine/summarize (jak w feedbackAI / refine-text).

**Security / compliance:**
- RBAC: edycja planu i wysyłki tylko dla ról change/PMO; sponsor zatwierdza (jeśli włączone).
- Audit log: edycje planu + wysyłki.

**Analytics (events/metrics):**
- `change_comm_plan_created` / `updated`
- `change_comm_sent` (channel, segmentsCount)
- `change_comm_overdue_detected`
- KPI: terminowość komunikacji, spadek „silence gaps”, feedback quality.

**Risks:**
- Brak dobrego modelu stakeholderów → V2 musi zacząć od segmentów + prostej listy.
- Integracje kanałów mogą być trudne → V2 zapewnia przynajmniej in‑app + export.

**Open questions:**
- Czy w V2 sponsor approval jest wymagany dla wybranych typów komunikatów, czy opcjonalny toggle per org?

**Definition of Done (DoD):**
- Dla inicjatyw można zdefiniować plan komunikacji i go egzekwować (cadence + log).
- System wspiera spójność treści i terminy (reminders/alerts).

**Acceptance / test plan:**
- Test: plan weekly → system generuje “next comm due” i przypomnienie po przekroczeniu.
- Test: wysyłka do segmentu → wpis w logu + link do treści.

**Rollout plan:**
- Najpierw in‑app + log, potem email i AI assist.

---

## T046 — 🟡 execution — Initiative ROI Tracking and Validation (assumptions → tracking → realized vs projected)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits realization / Accountability) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez walidacji wpływu transformacji nie ma accountability. ROI często jest deklaracją na starcie, a potem nikt nie wraca do porównania “projected vs realized”. Dla sponsora to kluczowe: które inicjatywy robią wynik, a które trzeba zatrzymać lub skorygować.

**Cel (outcome, nie feature):**
ROI inicjatyw jest policzalne na bazie założeń i widoczne w czasie, a system pokazuje różnicę między planem a wynikiem (tam gdzie mamy dane realized), z jasnymi założeniami i poziomem niepewności.

**Użytkownicy i scenariusze:**
- Sponsor: widzi ROI i confidence + decyzja “continue/stop/scale”.
- Finanse/PMO: utrzymuje założenia i śledzi realized.
- Owner: aktualizuje postęp i evidence (TBD).

**Scope (V2)**
- IN:
  - ROI assumptions model (MUST):
    - per initiative: CAPEX/OPEX, expected ROI/NPV/payback + horyzont,
    - założenia: jakie KPI/financial drivers, baseline, expected delta, start date efektu,
    - owner założeń + last updated.
    - Wykorzystać istniejące pola/UI tam gdzie już są (np. `FinancialAnalysisSection` pokazuje CAPEX/OPEX/ROI/NPV/payback).
  - Realized tracking (V2 baseline):
    - realized = z KPI tracking (T047) + manual overrides (jeśli brak danych),
    - oś czasu: miesięczna (minimum).
  - Projected vs realized comparison (MUST):
    - variance (wartość i %),
    - explainability: “dlaczego różnica” (manual notes + opcjonalnie AI summary),
    - gating: po statusie DONE/TRACKING inicjatywa przechodzi do “benefits tracking” (TBD).
  - Reporting (MUST):
    - sponsor‑ready widok ROI per initiative + portfolio summary,
    - eksport do raportów/presentacji (T027).
- OUT:
  - Pełna controllingowa księgowość w ERP, automatyczne księgowania.
- Future enhancements (post‑V2):
  - Advanced attribution (T048) i scenariusze “what‑if” na ROI.
  - Integracje danych realized z systemów źródłowych.

**UX / UI notes:**
- ROI musi być “decision‑grade”: liczby + założenia + confidence, bez marketingu.
- Pokazuj coverage danych: co jest policzone z danych, a co manual.

**Data / integrations:**
- Initiative financial fields + KPI mapping (T047).
- Integracja z Budżetami (T042) dla spójności kosztów.

**Security / compliance:**
- Edycja założeń ROI: ograniczona (finance/PMO/owner); sponsor read‑only.
- Audit log zmian założeń (dla zaufania).

**Analytics (events/metrics):**
- `roi_assumptions_updated`
- `roi_realized_value_updated`
- `roi_variance_viewed`
- KPI: % inicjatyw z ROI assumptions + % z realized tracking.

**Risks:**
- Realized data unavailable → V2 musi działać na manual + jasno oznaczać ograniczenia.
- Atrybucja wpływu może być myląca → w V2 “honest uncertainty”.

**Open questions:**
- Jaki jest minimalny zestaw pól ROI, żeby nie przeciążyć użytkownika (przy zachowaniu decision‑grade)?

**Definition of Done (DoD):**
- ROI jest policzalne na bazie założeń i widoczne w czasie.
- System pokazuje różnicę między planem a wynikiem (jeśli dane dostępne).

**Acceptance / test plan:**
- Test: inicjatywa z KPI baseline/target → system liczy projected i pokazuje realized po aktualizacji KPI.
- Test: zmiana założeń → audit log + przeliczenie widoków.

**Rollout plan:**
- Najpierw assumptions + widok, potem realized tracking i variance.

---

## T047 — 🟡 execution — Initiative‑to‑KPI Mapping and Performance Tracking (KPI ↔ initiatives, time series)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits / KPI discipline) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez mapowania inicjatywa → KPI nie ma accountability; trudno powiedzieć co „dowiozło wynik”. KPI bez inicjatyw jest “dashboard vanity”. Potrzebujemy powiązania i trackingu w czasie w kontekście delivery.

**Cel (outcome, nie feature):**
Inicjatywy mają przypisane KPI i widoczny tracking, a UI pozwala przejść:
- od inicjatywy do KPI (baseline/target/latest/trend),
- od KPI do listy inicjatyw, które na niego wpływają.

**Użytkownicy i scenariusze:**
- PMO: podczas przeglądu portfela widzi KPI health i mapę wpływu.
- Sponsor: widzi “KPI at risk” i które inicjatywy są odpowiedzialne.
- Analityk: aktualizuje wartości KPI i źródła.

**Scope (V2)**
- IN:
  - KPI model (MUST):
    - definicja KPI: nazwa, opis, unit, baseline, target, frequency, dataSource, owner (UI już istnieje w `KPICreateModal`),
    - latestValue + historia wartości (time series) (TBD storage),
    - status “on target / below target” z jasną regułą.
  - Initiative ↔ KPI mapping (MUST):
    - wiele KPI na inicjatywę,
    - (opcjonalnie) waga wpływu / typ wpływu (increase/decrease) (TBD),
    - nawigacja w obie strony.
  - Tracking workflow (MUST):
    - update KPI values wg częstotliwości (manual w V2),
    - reminders dla ownera KPI (opcjonalnie),
    - widoki: sparklines/trend + “last updated”.
  - UI (MUST):
    - Benefits module (`BenefitsHub`) jako centralny hub KPI/ROI,
    - widok inicjatywy: sekcja KPI (list + trend) + link do Benefits.
- OUT:
  - Zaawansowane causal inference i automatyczne pobieranie z systemów źródłowych (integracje).
- Future enhancements (post‑V2):
  - Automatyczne zasilanie KPI z integracji danych.
  - Attribution model (T048) i scenariusze (T038) wprost na KPI.

**UX / UI notes:**
- Minimal friction update: 1 pole “latest value” + auto wyliczenie on‑target.
- “Data freshness” badge: ile dni od ostatniej aktualizacji.

**Data / integrations:**
- Backend endpoints już istnieją (np. `POST /initiatives/:id/kpis`, `GET /initiatives/:id/kpis` używane w `BenefitsHub`).
- Dołożyć historyczne wartości KPI (time series) i query dla KPI‑centric view (TBD).

**Security / compliance:**
- Edycja KPI: owner/PMO/analyst role (TBD).
- Sponsor read‑only.

**Analytics (events/metrics):**
- `kpi_created` / `kpi_value_updated`
- `kpi_mapping_updated`
- `kpi_viewed`
- KPI: % inicjatyw z KPI mapping + “freshness” KPI.

**Risks:**
- Definicje KPI i częstotliwość aktualizacji → ryzyko chaosu, potrzebne standardy (naming, ownership).

**Open questions:**
- Czy KPI są globalne (org‑level) i linkowane do inicjatyw, czy KPI są per initiative (dziś wygląda na per initiative)? (propozycja V2: wspieramy oba, z prostą migracją).

**Definition of Done (DoD):**
- Inicjatywy mają przypisane KPI i widoczny tracking.
- UI pozwala przejść od KPI do listy inicjatyw i odwrotnie.

**Acceptance / test plan:**
- Test: KPI utworzone + 3 aktualizacje wartości → sparkline i trend.
- Test: KPI view → lista inicjatyw powiązanych; initiative view → lista KPI.

**Rollout plan:**
- Najpierw KPI per initiative + latest value, potem time series i KPI‑centric dashboards.

---

## T048 — 🟠 benefits — KPI Impact Attribution Analysis (contribution estimate + uncertainty, sponsor‑grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Benefits analytics / “who drives the result”) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Sponsor i PMO muszą umieć odpowiedzieć: **“kto robi wynik”** — nawet jeśli atrybucja nie jest idealna. Bez ustrukturyzowanej estymacji wkładu inicjatyw do KPI:
- decyzje “continue/stop/scale” są polityczne,
- a portfolio nie uczy się na danych.
Jednocześnie musimy być uczciwi: w V2 to ma być **przybliżenie z niepewnością**, nie twardy model kauzalny.

**Cel (outcome, nie feature):**
System generuje sponsor‑ready **estymację wkładu inicjatyw do KPI** (contribution), pokazuje:
- ranking inicjatyw per KPI,
- “unexplained remainder” (czynnik zewnętrzny / brak danych),
- confidence + założenia,
oraz pozwala użyć tego w raportach (T027) i w ROI tracking (T046).

**Użytkownicy i scenariusze:**
- Sponsor: widzi KPI trend + top 5 “contributors” i podejmuje decyzję portfelową.
- PMO/analityk: weryfikuje założenia, poprawia mapping/weights i opisuje kontekst.
- Owner: dodaje evidence/notes, gdy wynik odbiega od projekcji.

**Scope (V2)**
- IN:
  - Attribution model (V2 = heurystyki + explainability) (MUST):
    - wejścia:
      - KPI time series + freshness (T047),
      - KPI ↔ initiative mapping (T047) (+ opcjonalna waga wpływu),
      - initiative timeline/status/progress (T039/T041),
      - ROI/assumptions drivers (T046),
    - wyjścia per KPI i okres (np. miesiąc):
      - lista inicjatyw z `contributionEstimate` (np. % lub wartość w unit KPI),
      - `confidence` (low/med/high) + `confidenceReason`,
      - “unexplained remainder” (część zmiany KPI nieprzypisana),
      - `assumptions` (tekst + parametry: lag window, weights).
    - algorytm (V2 baseline):
      - rozkłada obserwowaną zmianę KPI (\(\Delta KPI\)) na inicjatywy proporcjonalnie do:
        - mapping weight (jeśli jest),
        - expected delta / impact statement (jeśli jest),
        - progress + status (executing/tracking/done),
        - time window / lag (efekt nie zawsze “od razu”),
      - normalizacja + remainder jeśli brak danych/niska jakość.
    - MUST: język i UI nie mogą sugerować “dowodu kauzalności”.
  - Uncertainty & guardrails (MUST):
    - zawsze pokazuj:
      - quality signals: freshness KPI, coverage mapping, “unknowns”,
      - disclaimer: “contribution estimate”,
    - “confidence” spada gdy:
      - brak historii KPI,
      - brak mapping weights / brak assumptions,
      - wiele inicjatyw nakłada się w czasie,
      - duża wariancja danych KPI.
  - Explainability (MUST):
    - dla każdej estymacji: 1–3 zdania “dlaczego system tak uważa” + lista użytych sygnałów.
    - AI może streszczać i układać narrację, ale parametry i liczby muszą być deterministyczne/odtwarzalne.
  - UI (MUST):
    - w Benefits/KPI view:
      - “Attribution” panel: trend KPI + contributors + remainder + confidence,
      - drill‑down: inicjatywa → uzasadnienie wkładu + link do inicjatywy/ROI,
    - w portfolio:
      - KPI “at risk” → contributors i rekomendacje korekt (link do T035/T038).
  - Export / reporting (MUST):
    - sponsor‑ready sekcja do reportów (T027):
      - 1 slajd “KPI drivers” + confidence + assumptions.
- OUT:
  - Twardy causal model z eksperymentami (A/B), pełna statystyka ekonometryczna jako “prawda”.
- Future enhancements (post‑V2):
  - Modele statystyczne (regression / Bayesian) + obsługa seasonality i confounders.
  - Integracje danych zewnętrznych (rynek, ceny, wolumen) jako “external factors”.
  - Scenario simulation: jak zmiana inicjatyw wpływa na KPI (tight loop z T038).

**UX / UI notes:**
- “Decision grade”: pokaż ranking + remainder + confidence, nie wykresy dla wykresów.
- “Unexplained remainder” ma być normalne i akceptowalne (to buduje zaufanie).

**Data / integrations:**
- KPI: potrzebna historia wartości (time series) + metadata o częstotliwości.
- Mapping: preferowane wagi wpływu (opcjonalne w V2, ale zalecane).
- Uwaga naming: istnieje `attributionService.ts` (marketing/acquisition) — KPI attribution musi mieć inne nazewnictwo (np. `kpiAttributionService`).

**Security / compliance:**
- Sponsor read‑only; edycja założeń/weights tylko dla uprawnionych (PMO/finance/analyst).
- Audit trail zmian assumptions/weights (żeby wynik był “reproducible”).

**Analytics (events/metrics):**
- `kpi_attribution_viewed`
- `kpi_attribution_parameters_updated` (lagWindow, weights)
- `kpi_attribution_exported`
- KPI: użycie w raportach sponsor-level, feedback sponsorów.

**Risks:**
- Ryzyko błędnych wniosków → guardrails + remainder + confidence muszą być zawsze widoczne.
- Brak danych → model musi degradować do “low confidence” zamiast wymyślać.

**Open questions:**
- Jaki default lag window przyjmujemy w V2 (np. 0–30 dni) i czy jest per KPI/per initiative?

**Definition of Done (DoD):**
- System potrafi wygenerować estymację atrybucji (contribution) i wyjaśnić założenia.
- Wyniki da się użyć w raportach sponsor-level (T027) i w ROI tracking (T046).

**Acceptance / test plan:**
- Test: KPI ma 6 miesięcy historii + 3 inicjatywy z mapping weights → panel pokazuje contributors + remainder + confidence.
- Test: brak historii KPI → wynik “low confidence” + remainder ~100% + jasne powody.

**Rollout plan:**
- Najpierw proste heurystyki + widok, potem parametryzacja (weights/lag) i eksport do reportów.

---

## T049 — 🟠 benefits — KPI to Financial Statement Mapping (KPI ↔ BS/P&L/CF, transparent & editable)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance grounding for KPI/ROI) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
KPI bez “uziemienia” finansowego często nie przekładają się na decyzje sponsora. Potrzebujemy mechanizmu, który łączy:
- KPI (operacyjne/strategiczne),
- z pozycjami sprawozdań (P&L / Balance Sheet / Cash Flow),
żeby móc mówić: “zmiana KPI → co to znaczy dla wyniku i gotówki”.

**Cel (outcome, nie feature):**
Finanse i sponsor mogą:
- powiązać KPI z liniami BS/P&L/CF,
- zobaczyć wpływ (impact) zmian KPI na wynik finansowy (w granicach założeń),
- utrzymać mapowanie jako **transparentne i edytowalne** (różne branże = różne relacje),
oraz użyć tego w raportach i ROI.

**Użytkownicy i scenariusze:**
- Finanse/Strategy: tworzy mapowanie KPI → statement line i ustala formuły.
- Sponsor: widzi “KPI drivers → financial impact” na 1 ekranie/1 slajdzie.
- PMO: używa mapowania do lepszego ROI (T046) i priorytetyzacji portfela (T038).

**Scope (V2)**
- IN:
  - Canonical statement lines registry (V2 baseline) (MUST):
    - zdefiniować minimalny, standardowy katalog linii:
      - P&L: Revenue, COGS, Gross Margin, SG&A/OPEX, EBITDA (TBD minimal),
      - Balance Sheet: Inventory, AR/AP, Working Capital,
      - Cash Flow: Operating CF, Capex, Free Cash Flow (TBD),
    - możliwość rozszerzenia per org (custom lines) (optional in V2; baseline = system + notes).
  - KPI → statement mapping (MUST):
    - mapowanie:
      - KPI (z T047) → statement line,
      - direction (increase KPI improves/worsens line),
      - transformation / formula (V2 minimal = typ relacji + parametry),
      - assumptions text + owner,
    - przykłady relacji (template‑based, edytowalne):
      - productivity/OEE → COGS / Gross Margin,
      - lead time → Inventory / Working Capital,
      - scrap rate → COGS,
      - NPS → Revenue (lagged, low confidence),
    - MUST: pokazywać “confidence” i ograniczenia, bo relacje są przybliżone.
  - Financial impact view (MUST):
    - na KPI screen:
      - “Financial impact mapping” (line item + direction + params),
      - aktualny wpływ na bazie \(\Delta KPI\) (jeśli jest time series) + assumptions,
    - na sponsor dashboard/report:
      - 1–2 tabele: KPI → line items → estimated impact range.
  - Integration with ROI & reports (MUST):
    - ROI (T046): możliwość użycia mappingu jako “driver” w kalkulacjach/uzasadnieniu,
    - raporty/presentacje (T027): sekcja “KPI → Financial statement impact”.
- OUT:
  - Pełna symulacja finansowa enterprise (wiele lat, pełne zależności, automatyczny forecasting klasy ERP).
- Future enhancements (post‑V2):
  - Mapowanie dynamiczne (industry packs) + benchmarking.
  - Tight integration z T050 (standaryzowane sprawozdania → automatyczne wyliczenia).
  - Sensitivity analysis per KPI → line item (zakresy, scenariusze).

**UX / UI notes:**
- Mapowanie musi być “auditable”: user widzi formułę/parametry i może je edytować.
- Default: pokaż minimalną liczbę linii statement, ale pozwól drill‑down.

**Data / integrations:**
- KPI: definicja + time series (T047).
- Financial model: na start wystarczy registry “line items” + mapping definitions; później T050 zasili realnymi statementami.
- UI: można wykorzystać istniejące “economics” komponenty (cashflow/financial analysis) jako inspirację, ale mapping jest osobną warstwą.

**Security / compliance:**
- Edycja mappingu: finanse/strategy/PMO; sponsor read‑only.
- Audit log zmian mappingu (kto i kiedy zmienił parametry).

**Analytics (events/metrics):**
- `kpi_financial_mapping_created` / `updated`
- `kpi_financial_impact_viewed`
- KPI: użycie w ROI/raportach, adoption w finansach.

**Risks:**
- Różnice branżowe i standardy księgowe → w V2 stawiamy na transparentność i edytowalność, nie “one true model”.
- Ryzyko nadużycia liczb → zawsze pokazuj assumptions + confidence.

**Open questions:**
- Jak minimalny ma być katalog statement lines w V2, żeby był uniwersalny, ale użyteczny?

**Definition of Done (DoD):**
- KPI można powiązać z pozycjami finansowymi i zobaczyć relacje/impact.
- Mapowanie jest transparentne i edytowalne (z audit trail).

**Acceptance / test plan:**
- Test: KPI “scrap rate” mapped → COGS; zmiana KPI w czasie → impact view pokazuje kierunek i estymację.
- Test: mapping edytowany → audit log + re‑calc widoków.

**Rollout plan:**
- Najpierw templates + manual mapping, potem integracja z T050 i bardziej zaawansowane formuły.

---

## T050 — 🟣 finance — Automated Financial Statement Ingestion and Standardization (PDF → BS/P&L/CF model)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance data foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez standaryzacji sprawozdań finansowych praca finansowa jest ręczna i nieporównywalna (różne kraje, języki, formaty). To blokuje:
- analizy finansowe,
- mapowanie KPI → wynik (T049),
- lepsze ROI i controlling.
Potrzebujemy mechanizmu “upload → ustrukturyzuj → zweryfikuj → użyj w analizach”.

**Cel (outcome, nie feature):**
Użytkownik może wgrać sprawozdania finansowe (PDF) i otrzymać ustrukturyzowane dane w kanonicznym modelu:
- Balance Sheet (BS),
- Profit & Loss (P&L),
- Cash Flow (CF),
z możliwością korekty/mapowania i z informacją o confidence/provenance.

**Użytkownicy i scenariusze:**
- Finanse/analityk: importuje PDF roczny/kwartalny, mapuje linie, zapisuje do modelu.
- Konsultant: używa danych do rekomendacji i narracji w raporcie.
- Sponsor (read‑only): widzi wyniki analiz, nie musi dotykać importu.

**Scope (V2)**
- IN:
  - Import wizard (MUST):
    - UI w stylu istniejących wizardów (`PDFImportWizard`, `ExcelImportWizard`):
      - upload PDF (limit, walidacje),
      - auto-detekcja: typ dokumentu (BS/P&L/CF) + okres (rok/kwartał) + waluta + skala (tys./mln),
      - extraction preview: tabela linii z kwotami + confidence,
      - mapping & corrections: użytkownik mapuje wykryte linie do kanonicznych “statement lines”,
      - confirm & save.
  - OCR/parsing pipeline (MUST):
    - ekstrakcja tabel (tekst + liczby) z PDF:
      - prefer: embedded text extraction,
      - fallback: OCR (jeśli skan),
    - normalizacja liczb:
      - separatory (`,`/`.`), minusy w nawiasach, tys./mln,
      - multi-column (np. 2023 vs 2024),
    - wykrywanie waluty i jednostek.
  - Standardized financial model (MUST):
    - kanoniczny model przechowuje:
      - orgId, entity (company/subsidiary) (TBD),
      - statement type (BS/P&L/CF),
      - period (start/end),
      - currency + scaling,
      - lines: { canonicalLineId, originalLabel, value, confidence, sourceRef },
      - metadata: source file, parsedAt, mappingVersion.
    - model jest przygotowany pod porównywalność cross‑country (minimum: currency + period + scaling + mapping transparency).
  - Validation & reconciliation (MUST):
    - walidacje sum (jeśli możliwe):
      - assets = liabilities + equity,
      - subtotals vs totals (best‑effort),
    - flagi “needs review” gdy walidacje nie przechodzą,
    - możliwość ręcznej korekty wartości i mapowania.
  - Downstream usage (MUST):
    - feed do T049: KPI → statement line impact może bazować na realnych liniach,
    - feed do raportów (T027): “financial snapshot” + wskaźniki jakości danych (coverage/confidence),
    - (opcjonalnie) w Company Profile: załączenie dokumentów jako evidence.
- OUT:
  - Pełny audyt księgowy i gwarancja poprawności jak w narzędziach finansowych enterprise.
  - Obsługa “wszystkich formatów świata” od razu.
- Future enhancements (post‑V2):
  - Import wielu formatów: XLS/XBRL, API integracje.
  - Auto‑mapping “industry packs” + uczenie się na korektach użytkownika.
  - Multi‑entity consolidation (grupy kapitałowe).

**UX / UI notes:**
- Najważniejsze: user musi rozumieć *co system wyciągnął* i *dlaczego* (confidence + highlight).
- Mapping ekran: szybki autocomplete + “suggested canonical line” (AI) + ręczne override.

**Data / integrations:**
- Wykorzystać wzorce z importu PDF assessmentów (wizard + mapping) jako architektura UI.
- Nowe endpointy: upload + parse + mapping save + fetch statements (TBD).
- Storage: nowe tabele `financial_statements`, `financial_statement_lines`, `financial_statement_sources` (TBD).

**Security / compliance:**
- Dane finansowe są wrażliwe:
  - RBAC: finanse/analityk edycja; sponsor read‑only,
  - log dostępu (TBD),
  - retention/policies per org (TBD).

**Analytics (events/metrics):**
- `financial_statement_import_started` / `completed` / `failed`
- `financial_statement_mapping_corrected`
- KPI: time-to-import, % importów z “pass validation”, adoption w analizach.

**Risks:**
- Duża wariancja formatów PDF → V2 musi być “best effort” + mocny mapping UI.
- Koszt OCR i błędy → throttling, limity i “confidence” zawsze w UI.

**Open questions:**
- Czy w V2 wspieramy multi‑column (wiele lat) w jednym PDF jako jeden import, czy wymagamy 1 okres/import?
- Jakie języki/regiony są MUST dla V2 (PL/EN/DE na start)?

**Definition of Done (DoD):**
- PDF można zaimportować i uzyskać ustrukturyzowane dane w modelu (BS/P&L/CF).
- Użytkownik może zmapować/naprawić linie i zapisać wynik z walidacją i confidence.

**Acceptance / test plan:**
- Test: PDF z embedded text (P&L) → parse + mapping + zapis; walidacje i flags.
- Test: PDF skan (OCR) → parse + low confidence + wymuszone review; zapis działa.

**Rollout plan:**
- Najpierw 1–2 “known formats” + manual mapping, potem rozszerzanie formatów i auto‑suggest.

---

## T051 — 🟣 finance — Comprehensive Financial Ratio Analysis (liquidity/profitability/leverage/efficiency/growth + benchmarks)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance diagnostics foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Same dane BS/P&L/CF nie są użyteczne bez warstwy interpretacji ilościowej. Potrzebujemy zestawu standardowych wskaźników (ratios), które da się:
- policzyć w sposób powtarzalny,
- porównać w czasie (history),
- oraz odnieść do benchmarków branżowych (na start: manual/uzgodnione źródło).

**Cel (outcome, nie feature):**
System liczy i prezentuje wskaźniki finansowe w pełnym zestawie kategorii, pokazuje trendy i (tam gdzie dostępne) benchmark, z jasnymi definicjami formuł i “coverage” danych.

**Użytkownicy i scenariusze:**
- Finanse: szybka diagnoza kondycji i ryzyk (płynność, zadłużenie).
- Konsultant: wkłada ratio insights do raportu i łączy z inicjatywami.
- Management/sponsor: widzi “red flags” i priorytety działań.

**Scope (V2)**
- IN:
  - Ratio engine (MUST):
    - wejście: ustandaryzowane statementy z T050 (BS/P&L/CF) + okresy,
    - wyjście: wartości wskaźników per okres + trend + status (OK/WARN/CRIT),
    - MUST: przechowywać definicje formuł (dla audytu) i wersjonowanie (TBD).
  - Ratio catalog (MUST):
    - Płynność:
      - Current ratio, Quick ratio, Cash ratio,
    - Rentowność:
      - Gross margin, Operating margin, Net margin, EBITDA margin (TBD jeśli linie są),
      - ROA, ROE (jeśli equity/asset lines są),
    - Zadłużenie / leverage:
      - Debt-to-equity, Debt ratio, Interest coverage (jeśli mamy interest/EBIT),
    - Efektywność:
      - Inventory turnover, AR/AP days, Cash conversion cycle (CCC),
    - Wzrost:
      - YoY revenue growth, YoY margin change (jeśli mamy multi‑period),
    - MUST: każdy wskaźnik ma:
      - wzór (jak liczymy),
      - wymagane linie danych (dependencies),
      - fallback/NA jeśli brak danych.
  - Coverage-aware UX (MUST):
    - jeśli brakuje danych do wskaźnika:
      - pokaż “NA” + powód (missing lines),
      - nie wyciągaj wniosków AI z NA.
  - Benchmarks (V2 baseline = manual source) (MUST):
    - możliwość wprowadzenia benchmarków:
      - per industry/region/company size (TBD minimal),
      - jako zakresy (min/median/max) lub target bands,
    - w UI: overlay benchmark band + “where we stand”.
  - Reporting integration (MUST):
    - 1–2 strony/slajdy “financial health ratios” do T027,
    - linkowanie red flags → rekomendowane inicjatywy (T032/T046) (V2 baseline = manual link).
- OUT:
  - Automatyczne pobieranie benchmarków z płatnych baz jako requirement V2 (może być post‑V2).
- Future enhancements (post‑V2):
  - Benchmark providers (płatne bazy) + auto refresh.
  - Industry packs z definicjami wskaźników (np. retail vs manufacturing).

**UX / UI notes:**
- Widok musi być skanowalny: kategorie → 3–5 top ratios → drill‑down.
- Każdy ratio ma “definition drawer” (wzór + źródła linii) dla zaufania.

**Data / integrations:**
- Źródło: `financial_statements` (T050).
- Benchmark: nowa tabela `financial_ratio_benchmarks` lub manual JSON per org (TBD).

**Security / compliance:**
- Dostęp do danych finansowych ograniczony (jak T050).
- Benchmarki mogą być licencjonowane → metadane o źródle i prawach użycia (TBD).

**Analytics (events/metrics):**
- `financial_ratios_viewed`
- `financial_benchmark_updated`
- `financial_ratio_exported`
- KPI: liczba analiz, eksportów do raportów, użycie w decyzjach.

**Risks:**
- Różnice definicji wskaźników (np. EBITDA) → w V2 muszą być jawne definicje i wersjonowanie.
- Brak linii danych → coverage musi być widoczne.

**Open questions:**
- Jaki minimalny benchmark input przyjmujemy w V2: industry + 3 percentyle czy tylko target band?

**Definition of Done (DoD):**
- Wskaźniki są policzone i prezentowane w czytelny sposób (kategorie + trend + definicje).
- Benchmarking działa na uzgodnionym źródle danych lub ręcznym input.

**Acceptance / test plan:**
- Test: 2 okresy P&L+BS → ratios policzone + YoY growth; missing lines → NA z powodem.
- Test: benchmark band ustawiony → UI pokazuje pozycję firmy i status (OK/WARN/CRIT).

**Rollout plan:**
- Najpierw ratio catalog + engine, potem benchmark inputs i eksporty.

---

## T052 — 🟣 finance — Full Financial Analysis and Interpretation (vertical/horizontal/historical/industry + AI insights)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Sponsor-grade finance narrative) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wskaźniki i statementy to “data”. Sponsor i management potrzebują **interpretacji**: co jest driverem zmian, jakie są ryzyka, gdzie są “quick wins”, co jest strukturalnym problemem. Bez narracji finanse zostają w excelu, a transformacja nie dostaje priorytetów.

**Cel (outcome, nie feature):**
System generuje ustrukturyzowaną interpretację finansową (sponsor-ready) na bazie:
- danych BS/P&L/CF (T050),
- wskaźników (T051),
- (opcjonalnie) benchmarków,
z outputem w formie: drivers, risks, actions, i z możliwością użycia w raportach/presentacjach.

**Użytkownicy i scenariusze:**
- Sponsor: 5–10 minutowy “finance brief” przed komitetem sterującym.
- Finanse/strategy: szybkie drafty narracji + możliwość korekt i zatwierdzenia.
- Konsultant: tworzy rekomendacje i inicjatywy z insightów.

**Scope (V2)**
- IN:
  - Analyses (MUST):
    - vertical analysis (common-size): struktura kosztów/przychodów, udział pozycji,
    - horizontal analysis: zmiany okres-do-okresu (QoQ/YoY),
    - historical trend: 3–8 okresów (jeśli dostępne),
    - benchmark comparison: jeśli benchmark istnieje (T051), inaczej “no benchmark”.
  - Insight framework (MUST):
    - ustrukturyzowany output:
      - Top 5 drivers (co ciągnie wynik),
      - Top 5 risks (płynność, leverage, margin compression, working capital),
      - Top 5 actions (konkretne działania) + link do inicjatyw,
      - “data quality notes” (coverage/confidence).
  - AI-generated narrative (MUST, grounded):
    - AI może generować tekst i podsumowania, ale:
      - musi cytować podstawę (konkretne ratio/linie statement),
      - nie może “wymyślać danych”,
      - musi oznaczać niepewność i braki.
    - guardrails: brak regulowanych rekomendacji inwestycyjnych (“buy/sell”), tylko operacyjno-finansowe wnioski.
  - UI (MUST):
    - “Finance Analysis” workspace:
      - dane (statements) → ratios → insights → actions,
      - approve/publish flow (TBD): DRAFT → APPROVED (żeby raporty brały tylko approved).
  - Actions integration (MUST):
    - z insightów można utworzyć:
      - initiative (T032),
      - task / decision,
    - linkowanie do KPI/ROI (T046/T047/T049).
  - Export (MUST):
    - raport/presentacja (T027): sekcja “Financial interpretation” + “Key ratios” + “Key actions”.
- OUT:
  - Rekomendacje inwestycyjne / doradztwo regulowane (compliance).
- Future enhancements (post‑V2):
  - Industry packs: dedykowane heurystyki i narracje per branża.
  - Integracje danych zewnętrznych (makro, ceny surowców) jako “context”.

**UX / UI notes:**
- “Two-layer” reading:
  - warstwa 1: executive bullets,
  - warstwa 2: drill‑down do liczb i definicji.

**Data / integrations:**
- Statements: T050.
- Ratios + benchmarks: T051.
- AI: pipeline do generowania structured insights (może używać istniejących wzorców AIPipeline), ale z twardym grounding.

**Security / compliance:**
- Uprawnienia jak do danych finansowych.
- Audit: kto zatwierdził interpretację (żeby w raporcie było zaufanie).

**Analytics (events/metrics):**
- `finance_analysis_generated`
- `finance_analysis_approved`
- `finance_insight_converted_to_initiative`
- KPI: wykorzystanie w raportach + feedback sponsora.

**Risks:**
- Jakość insightów AI → wymagane “grounded citations” i human approval.
- Brak benchmarków → insighty muszą działać bez porównań branżowych.

**Open questions:**
- Czy V2 wprowadza formalny workflow APPROVED dla finance insights (rekomendowane), czy tylko “last saved”?

**Definition of Done (DoD):**
- System tworzy interpretację na bazie danych finansowych i porównań.
- Output da się użyć w raportach/presentations (T027) i tworzeniu inicjatyw.

**Acceptance / test plan:**
- Test: 3 okresy statementów + ratios → wygenerowane insights zawierają cytowane liczby i “data quality notes”.
- Test: approve → report generator pobiera tylko APPROVED.

**Rollout plan:**
- Najpierw manual (bez AI) struktura insights + eksport, potem AI drafting z approval.

---

## T053 — 🟣 finance — Fundamental Budgeting (driver‑based projections from statements + KPI, sponsor‑ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance planning foundation) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Budżetowanie jest core dla planowania transformacji i oceny trade‑off. Bez prostego, spójnego budżetu:
- sponsor nie ma “financial runway” dla decyzji,
- PMO nie umie porównać opcji (timeline vs koszt vs efekt),
- a inicjatywy nie mają ekonomicznego kontekstu.
W V2 chcemy budżet “fundamentalny”: wystarczająco dobry, ustrukturyzowany i eksportowalny — bez ciężaru enterprise forecasting.

**Cel (outcome, nie feature):**
Da się stworzyć budżet na bazie modelu finansowego i KPI:
- projekcja przyszłych wyników (P&L + Cash Flow) na uzgodniony horyzont,
- scenariusze (base/optimistic/conservative),
- spójny output do raportu/presentacji,
z jasnymi założeniami i workflow zatwierdzania.

**Użytkownicy i scenariusze:**
- Finanse: buduje budżet bazowy + scenariusze, publikuje do management.
- Management/sponsor: akceptuje budżet i używa go do decyzji portfelowych.
- Konsultant/PMO: wiąże inicjatywy z driverami budżetu i ocenia trade‑offy.

**Scope (V2)**
- IN:
  - Budget artifact & workflow (MUST):
    - budżet jako artefakt z:
      - orgId + (opcjonalnie) projectId/business unit (TBD),
      - period: start/end,
      - currency + assumptions,
      - status: DRAFT → REVIEW → APPROVED (publikowalny),
      - versioning: snapshot wersji przy approve.
  - Baseline & inputs (MUST):
    - baseline: ostatni zaimportowany i zatwierdzony statement z T050 (lub manual start),
    - KPI drivers: z T047,
    - mapping KPI → finance lines: z T049,
    - cost assumptions: CAPEX/OPEX z inicjatyw (T046/T042) jako opcjonalne inputs.
  - Projection model (V2 baseline = driver‑based, transparent) (MUST):
    - projekcja miesięczna (minimum) na 12 miesięcy (TBD default),
    - mechanika:
      - growth rates / deltas per driver (KPI),
      - proste zależności:
        - Revenue = baseline + driver adjustments,
        - COGS/OPEX = baseline + efficiency drivers,
        - Working capital drivers (Inventory/AR/AP) jeśli dane są,
      - Cash Flow: operating CF + capex plan + free cash flow,
    - każda linia ma:
      - source (baseline / manual / driver formula),
      - assumptions.
  - Scenarios (MUST):
    - base + optimistic + conservative,
    - diff view: “co się zmienia” + wpływ na FCF/EBITDA (jeśli liczone),
    - możliwość zablokowania wybranych linii (manual override).
  - UI (MUST):
    - “Budget workspace”:
      - Inputs → Projections → Scenarios → Publish,
      - tabular view + proste wykresy (trend),
      - coverage/quality: które linie są oparte o dane vs manual.
    - integracja z economics UI (jeśli istnieje) przez spójne komponenty (cashflow chart etc.).
  - Export / reporting (MUST):
    - raport/presentation (T027):
      - 1–2 strony/slajdy budżetu (P&L i CF) + scenariusze + assumptions.
  - Governance & audit (MUST):
    - audit log zmian assumptions i manual overrides,
    - only APPROVED budgets mogą być “source of truth” dla dalszych analiz.
- OUT:
  - Rolling forecast, wielowalutowe scenariusze enterprise, advanced budget cards jako osobny moduł.
- Future enhancements (post‑V2):
  - Rolling forecast + driver calibration na danych historycznych.
  - Integracje ERP + automatyczne odchylenia budżet vs actual (full controlling).

**UX / UI notes:**
- Budżet ma być “board‑readable”: proste tabele + 2–3 wykresy, bez chaosu.
- Always show assumptions i możliwość “drill‑down to formula”.

**Data / integrations:**
- Statements: T050.
- KPI & mapping: T047/T049.
- Budżety/limity: T042 (spójność).
- Istniejące economics (routes/services/UI) może być bazą implementacyjną dla obliczeń i cashflow wykresów.

**Security / compliance:**
- Edycja: finance/owner; sponsor read‑only + approve rights (TBD role mapping).
- Audit trail i wersjonowanie approve.

**Analytics (events/metrics):**
- `budget_created` / `budget_scenario_updated`
- `budget_approved`
- `budget_exported`
- KPI: liczba budżetów, czas do approve, użycie w decyzjach.

**Risks:**
- Różnice definicji linii finansowych i driverów → w V2 transparentność i audyt są MUST.
- Brak danych bazowych → V2 musi mieć ścieżkę “manual baseline”.

**Open questions:**
- Domyślny horyzont i granularność: 12 miesięcy monthly czy 24 miesiące z agregacją?

**Definition of Done (DoD):**
- Da się stworzyć budżet na bazie modelu finansowego i KPI.
- Wynik jest spójny i nadaje się do raportu/presentacji (T027) oraz ma workflow approve.

**Acceptance / test plan:**
- Test: baseline z T050 + 3 KPI drivers → budżet generuje projekcję P&L i CF, z widocznymi assumptions.
- Test: approve → tworzy snapshot, export do reportu bierze tylko APPROVED.

**Rollout plan:**
- Najpierw base scenario + manual overrides, potem drivers + scenariusze i diff view.

---

## T054 — 🟣 finance — Financial Modeling of Initiatives (fully-connected P&L + Balance Sheet + Cash Flow, economic events)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Finance engine / Integrated model) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
To jest “hard mode” finansów: forward‑looking model inicjatyw musi być **spójny księgowo**, a nie tylko “P&L z marginesem”. W praktyce oznacza:
- P&L, Balance Sheet i Cash Flow **są połączone relacjami**,
- prognozy wynikają z **economic events** (zdarzeń gospodarczych),
- model przechodzi kontrolę tożsamości rachunkowej (bilans się domyka).
Masz już to wypracowane w Excelu, ale przeniesienie do systemu wymaga silnika relacji i walidacji.

**Cel (outcome, nie feature):**
System pozwala zbudować i uruchomić model finansowy inicjatywy (lub projektu/portfela), który:
- generuje prognozy P&L/BS/CF w czasie,
- jest “audit‑able” (widać założenia, relacje, źródła),
- ma twarde walidacje spójności (balance + cashflow tie‑outs),
oraz zasila ROI/budżety/raporty.

**Użytkownicy i scenariusze:**
- Finanse/strategy: definiuje model i założenia, uruchamia scenariusze.
- PMO/sponsor: widzi prognozy i decyzje (continue/stop/scale) w kontekście cash oraz bilansu.
- Konsultant: buduje uzasadnienie ekonomiczne inicjatyw i zamienia insighty na działania.

**Scope (V2)**
- IN:
  - Integrated financial model (MUST):
    - generacja prognoz dla:
      - P&L (wynik),
      - Balance Sheet (aktywa/pasywa/kapitał),
      - Cash Flow (operating/investing/financing),
    - spójne powiązania:
      - Net income → Equity (retained earnings),
      - Depreciation/Amortization → P&L oraz BS (PPE/Intangibles) oraz add‑back w CF,
      - CAPEX → PPE/Intangibles (BS) oraz Investing CF,
      - Debt schedule → Liabilities (BS) oraz Financing CF oraz interest w P&L,
      - Working capital changes (AR/AP/Inventory) → BS oraz Operating CF.
  - Economic events engine (MUST):
    - model oparty o zdarzenia gospodarcze (lista rozszerzalna):
      - revenue event (sprzedaż),
      - COGS / OPEX events,
      - capex purchase,
      - depreciation run,
      - debt drawdown / repayment,
      - interest accrual / payment,
      - tax accrual / payment,
      - working capital change events,
      - equity injection / dividends (TBD),
    - każde zdarzenie ma:
      - parametry (kwota, waluta, okres, lag),
      - klasyfikację do CF (O/I/F),
      - “posting” do modelu (księgowanie logiczne) + provenance.
    - Uwaga: w V2 nie musimy implementować pełnej podwójnej księgowości jak ERP, ale silnik musi być wystarczająco formalny, by walidacje przechodziły.
  - Consistency checks (MUST, hard gates):
    - bilans: **Assets = Liabilities + Equity** per okres,
    - cash tie‑out: **ΔCash = Operating CF + Investing CF + Financing CF** per okres,
    - retained earnings tie‑out: ΔEquity zgodne z net income + equity events,
    - flagi: jeśli walidacja nie przechodzi → model status “NEEDS_REVIEW” i blokada publikacji/eksportu jako “approved”.
  - Scenario support (MUST):
    - base/optimistic/conservative (jak w economics),
    - diff view (co zmieniło się w relacjach/założeniach i jaki ma to wpływ na CF i bilans).
  - UI/workspace (MUST):
    - “Financial Model workspace”:
      - Inputs/Assumptions,
      - Events timeline (edytowalne, tabelaryczne),
      - Outputs: P&L / BS / CF + charts,
      - Validation panel (balance & tie‑outs) + drill‑down do przyczyn.
    - Workflow: DRAFT → REVIEW → APPROVED (tylko APPROVED idzie do raportów/budżetów jako source of truth).
  - Excel bridge (V2 baseline):
    - możliwość importu/transferu Twojego modelu z Excela w trybie “template”:
      - minimum: upload + przechowanie jako evidence + ręczne mapowanie kluczowych parametrów,
      - preferowane: Excel import wizard (analogiczny do `ExcelImportWizard`) do wciągnięcia parametrów/assumptions do modelu (TBD format template).
  - Integrations (MUST):
    - zasila:
      - ROI i financial impact w inicjatywach (T046 + sekcje `FinancialAnalysisSection` / `FinancialImpactSection`),
      - budżetowanie (T053),
      - raporty/presentacje (T027).
- OUT:
  - Pełny controlling realizacji kosztów per faktura (ERP‑grade).
  - Wielowalutowe enterprise consolidation jako requirement V2 (może być post‑V2).
- Future enhancements (post‑V2):
  - Rolling forecasts, multi‑entity consolidation, advanced tax logic.
  - Automatyczna kalibracja driverów na danych historycznych + integracje ERP.

**UX / UI notes:**
- “Model health” musi być widoczne zawsze: green = balans i tie‑outs OK; amber/red = coś nie domyka się.
- Drill‑down z walidacji do eventów/assumptions (to jest killer feature vs Excel).

**Data / integrations:**
- Można wykorzystać istniejące “economics” patterns (`economics.routes.ts`, `economicsFinancials.ts`, scenariusze) jako inspirację, ale to jest osobny poziom: **zintegrowane statements**, nie tylko cashflow ROI.
- Storage (TBD): `financial_models`, `financial_model_events`, `financial_model_outputs`, `financial_model_validations`, `financial_model_versions`.

**Security / compliance:**
- Dane wrażliwe: role finance/owner edycja; sponsor read‑only.
- Audit trail zmian assumptions i eventów + approve signatures.

**Analytics (events/metrics):**
- `financial_model_created`
- `financial_model_event_added` / `updated`
- `financial_model_validation_failed` (reason)
- `financial_model_approved`

**Risks:**
- Złożoność relacji → bez twardych walidacji będziemy mieć “ładne liczby” bez zaufania.
- Mapping z Excela → ryzyko “garbage in”; potrzebne template + walidacje.

**Open questions:**
- Jaki minimalny zestaw statement lines i event types jest MUST w V2, żeby model był już “realny” (a nie demo)?
- Jak formalizujemy Excel template (named ranges? CSV exports? fixed sheet schema)?

**Definition of Done (DoD):**
- Model generuje prognozy P&L/BS/CF na horyzont.
- Dla każdego okresu przechodzą walidacje:
  - **Assets = Liabilities + Equity**,
  - **ΔCash = OCF + ICF + FCF**,
  - spójne tie‑outs kapitału (retained earnings / equity events).
- Wynik jest eksportowalny do raportu/presentacji i gotowy do użycia w decyzjach.

**Acceptance / test plan:**
- Test: zestaw economic events (revenue, capex, depreciation, debt drawdown/repayment, WC change) → model domyka bilans i cashflow w każdym miesiącu.
- Test: celowo błędny event → walidacja FAIL + drill‑down pokazuje przyczynę i rekomendację korekty.

**Rollout plan:**
- Najpierw minimalny event catalog + walidacje + outputs, potem Excel template import i bardziej złożone relacje.

---

## T055 — 🟣 finance — Enterprise Valuation Module (professional DCF + comps, sponsor/VC‑deck grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Valuation engine / Strategic decisioning) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wycena to centralny artefakt dla decyzji strategicznych, fundraising/VC i M&A. Żeby była wiarygodna, musi być:
- **profesjonalna** (metodologia, spójność, standardy),
- **audit‑able** (jawne założenia, wersje, źródła danych),
- **czytelna** (deck‑ready output),
oraz spójna z całym “finance engine” (T054/T053), a nie niezależną kalką w UI.

**Cel (outcome, nie feature):**
Użytkownik (Founder/Finance/Strategy) przechodzi guided flow i otrzymuje wycenę:
- DCF (baseline V2: unlevered FCFF / WACC) + terminal value,
- comparative valuation (multiples) (manual inputs w V2),
- sensitivity i scenariusze,
z możliwością eksportu do raportu/pitch decka (T027) wraz z disclaimers.

**Użytkownicy i scenariusze:**
- Founder/CEO: przygotowuje rundę — potrzebuje “valuation story” + sensitivity.
- CFO/Finance: buduje i zatwierdza założenia, wersjonuje model.
- Strategy/M&A: porównuje scenariusze i wpływ inicjatyw na wycenę (bridge do T054/T046).

**Scope (V2)**
- IN:
  - Data sources & grounding (MUST):
    - preferowane źródło prognoz:
      - APPROVED model finansowy (T054) albo APPROVED budżet (T053),
    - fallback: manual forecast inputs (jeśli brak modelu),
    - zawsze pokazuj “source of forecast” + coverage.
  - DCF valuation (MUST, professional baseline):
    - model:
      - FCFF (unlevered) na horyzont N lat (default 5),
      - dyskontowanie WACC,
      - terminal value:
        - Gordon growth (g) (z walidacją \(g < WACC\)),
        - oraz alternatywnie exit multiple (EV/EBITDA lub EV/Revenue) (TBD; V2 może wspierać oba),
      - enterprise value → equity value:
        - net debt adjustment (z BS z T054 jeśli dostępne),
        - opcjonalnie minority interest/cash adjustments (TBD baseline).
    - must-have inputs:
      - discount rate / WACC (z breakdown: rf, ERP, beta, cost of debt, tax rate, capital structure),
      - tax rate, reinvestment/capex assumptions (jeśli nie wynikają z T054),
      - terminal growth (g) i/lub exit multiple,
      - shares/outstanding (jeśli liczymy per share) (TBD V2).
    - output:
      - EV, equity value, per share (jeśli dane),
      - PV of explicit period vs terminal split,
      - bridge / reconciliation view (co tworzy wartość).
  - Multiples / comparative valuation (MUST, V2 manual data):
    - trading comps inputs:
      - peer set (manual list) + multiples ranges (min/median/max),
      - wybór metryki (EV/EBITDA, EV/Revenue, P/E) zależnie od dostępnych danych,
    - implied valuation: zastosowanie multiple do metryki firmy (z T054/T053),
    - “why peers” notes + confidence.
  - Sensitivity & scenarios (MUST):
    - 2D sensitivity table (np. WACC vs g; WACC vs exit multiple),
    - tornado chart (top drivers),
    - scenario comparison (base/optimistic/conservative) — źródło: scenariusze T054/T053.
  - Guided flow UX (MUST):
    - kroki:
      - Source & horizon → Assumptions (WACC, g, multiples) → Results → Sensitivity → Export,
    - inline validation:
      - g < WACC,
      - brakujące inputy,
      - “red flags” (np. ujemny FCF bez uzasadnienia),
    - “model quality” badge: coverage + last approved + who approved.
  - Governance (MUST):
    - workflow valuation: DRAFT → REVIEW → APPROVED,
    - versioning snapshot na APPROVED,
    - audit log zmian kluczowych parametrów (WACC, g, peers, multiples).
  - Export (MUST):
    - deck/raport (T027):
      - 1 slajd: valuation summary (range, method weights, assumptions highlights),
      - 1 slajd: DCF details (PV split + key drivers),
      - 1 slajd: comps table + implied range,
      - 1 slajd: sensitivity (heatmap) + disclaimer,
    - watermark / disclaimer block (compliance) zawsze w export.
- OUT:
  - Automatyczne pobieranie danych rynkowych i peer multiples z API jako requirement V2.
  - Doradztwo inwestycyjne regulowane; rekomendacje “kup/sprzedaj”.
- Future enhancements (post‑V2):
  - Market data connectors (multiples, rf rates) + auto refresh.
  - Levered DCF, APV, multi‑stage growth, detailed debt schedule.
  - Monte‑Carlo / probabilistic valuation.

**UX / UI notes:**
- Musi wyglądać jak “professional finance tool”, nie jak formularz:
  - prefilled defaults (ale jawne),
  - zero ukrytej magii: “click to see formula”.
- Wszystkie liczby muszą mieć źródło (T054/T053/manual) i timestamp.

**Data / integrations:**
- Integracja z:
  - T054 (integrated model outputs: FCF, net debt, cash, tax),
  - T053 (budget projections),
  - T052 (financial interpretation) jako narracja “valuation story” (opcjonalnie).
- Storage (TBD): `valuations`, `valuation_assumptions`, `valuation_peers`, `valuation_versions`.

**Security / compliance:**
- Disclaimers MUST:
  - “for informational purposes, not investment advice”,
  - “assumptions-driven; results may vary”,
  - “not audited”.
- RBAC: finance/strategy edycja; founder/management read‑only + approve (TBD).

**Analytics (events/metrics):**
- `valuation_created`
- `valuation_assumption_updated` (wacc|g|multiple|peer_set)
- `valuation_approved`
- `valuation_exported`

**Risks:**
- Odpowiedzialność prawna → mocne disclaimers + brak języka inwestycyjnego.
- Garbage assumptions → potrzebne walidacje + “quality/coverage” i approval.

**Open questions:**
- Czy w V2 liczymy “per share” (wymaga shares/outstanding + cap table baseline) czy tylko EV/Equity value?
- Czy default terminal to Gordon czy exit multiple (czy oba równolegle)?

**Definition of Done (DoD):**
- Użytkownik przechodzi guided flow i dostaje wynik DCF + comps + sensitivity.
- Wycena ma workflow i wersjonowanie (APPROVED snapshot) + audit log.
- Output jest **VC/sponsor‑deck grade** (czytelne slajdy + assumptions + sensitivity + disclaimers).
- Jakość obliczeń:
  - walidacje wejść (np. \(g < WACC\)) działają,
  - na referencyjnym workbooku Excel (Twoim) wynik DCF (EV) jest zgodny w granicy tolerancji (np. ≤ 1% różnicy) dla zestawu testowych założeń (TBD).

**Acceptance / test plan:**
- Test: prognoza z T054 + WACC/g → DCF EV + equity bridge + sensitivity heatmap.
- Test: comps — manual peer multiples → implied range; zmiana peer set aktualizuje wynik.
- Test: export do PPTX/PDF (T027) zawiera slajdy + disclaimers.

**Rollout plan:**
- Najpierw DCF + sensitivity + export, potem comps module i lepsze governance/approval UX.

---

## T056 — 🟣 finance — Valuation Improvement Advisory Module (compliant “how to improve valuation”, action‑to‑initiative)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Value creation playbooks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Wynik wyceny bez “co robić dalej” jest mało użyteczny. Użytkownik chce konkretnych, priorytetyzowanych działań, które poprawiają value drivers (margins, growth, risk, working capital, capital structure). Jednocześnie to obszar wrażliwy pod compliance: nie możemy generować porad prawnych/inwestycyjnych ani “obietnic”.

**Cel (outcome, nie feature):**
System generuje **compliant** listę działań poprawiających wycenę:
- powiązaną z driverami DCF/multiples,
- z uzasadnieniem opartym o liczby (grounded),
- z priorytetem (impact/effort/time‑to‑impact/risk),
oraz z możliwością konwersji w inicjatywy/tasks/decisions w platformie.

**Użytkownicy i scenariusze:**
- Founder/CEO: “Jak podnieść valuation w 6–12 miesięcy?” → plan działań.
- CFO/Strategy: przegląda rekomendacje, wybiera i zatwierdza te, które zamienia w inicjatywy.
- PMO: przekłada rekomendacje na portfolio (T035/T038).

**Scope (V2)**
- IN:
  - Inputs (MUST):
    - APPROVED valuation (T055) + assumptions,
    - APPROVED finance insights (T052) + ratios (T051),
    - integrated model outputs (T054) (jeśli istnieją),
    - KPI mapping/ROI (T046/T047/T049) (opcjonalnie).
  - Driver decomposition (MUST):
    - identyfikacja top driverów wyceny:
      - growth (revenue CAGR),
      - margins (gross/operating),
      - reinvestment intensity (capex/working capital),
      - risk (WACC components),
      - terminal assumptions (g / exit multiple),
    - “which lever matters” ranking (np. tornado from T055).
  - Advisory recommendations (MUST, structured):
    - 10–20 rekomendacji w kategoriach:
      - growth acceleration,
      - margin improvement,
      - working capital optimization,
      - risk reduction (operational + cybersecurity + compliance),
      - capital structure optimization (bez porad regulowanych),
      - governance & reporting quality (zwiększenie zaufania inwestora),
    - każda rekomendacja ma:
      - **hypothesis** (co zmieniamy),
      - **mechanism** (jak to wpływa na valuation driver),
      - **expected direction** (↑EV / ↓risk / ↑multiple) bez obiecywania liczb,
      - **evidence** (cytowane ratio/linia/assumption),
      - **estimated impact tier** (High/Med/Low) + confidence,
      - **effort** (S/M/L) + time‑to‑impact,
      - **risks/side‑effects**,
      - **next steps** (3–5 kroków).
  - Action → initiative conversion (MUST):
    - przycisk “Create initiative” (T032) z:
      - prefilled charter + KPI links + owner suggestions,
      - powiązanie z valuation driver,
    - alternatywnie: create task / decision (jeśli potrzebna zgoda).
  - UI (MUST):
    - panel “Valuation Advisory” przy wycenie (T055):
      - drivers summary → recommendations list → conversion actions,
    - filtry: category, impact tier, confidence, time‑to‑impact.
  - Compliance guardrails (MUST):
    - twarde zasady:
      - brak porad prawnych/podatkowych jako “porada”,
      - brak “kup/sprzedaj” i gwarancji wyników,
      - disclaimers widoczne zawsze,
    - content safety:
      - blokada niektórych kategorii promptów (TBD),
      - “human approval” przed eksportem do decka (REVIEW/APPROVE).
- OUT:
  - Personalizowane porady prawne, generowanie umów, automatyczne wdrożenia zmian w organizacji.
- Future enhancements (post‑V2):
  - “Value creation roadmap” automatycznie optymalizowany (sprzężenie z T035/T038).
  - Industry packs z benchmarkami i rekomendacjami specyficznymi dla branży.

**UX / UI notes:**
- Rekomendacje muszą być “board‑ready”: krótko, jasno, z dowodem i next steps.
- Użytkownik ma czuć, że to plan działania, nie “AI essay”.

**Data / integrations:**
- T055: drivers/sensitivity.
- T054: financial levers i constraints (cash, debt, WC).
- Initiative generator (T032) jako mechanizm konwersji.

**Security / compliance:**
- RBAC jak dla valuation/finance.
- Disclaimers i audit: kto zatwierdził rekomendacje do użycia na zewnątrz.

**Analytics (events/metrics):**
- `valuation_advisory_generated`
- `valuation_advisory_recommendation_converted` (initiative|task|decision)
- `valuation_advisory_exported`

**Risks:**
- Compliance: ryzyko zbyt mocnych stwierdzeń → guardrails + approvals.
- “Generic advice” → wymagane grounding w danych i driver decomposition.

**Open questions:**
- Czy w V2 rekomendacje mają mieć “range estimate” (np. impact band), czy tylko tier + confidence?

**Definition of Done (DoD):**
- System generuje listę działań wraz z uzasadnieniem i priorytetem.
- Rekomendacje są compliant (disclaimers + brak regulowanych porad) i konwertowalne do inicjatyw.

**Acceptance / test plan:**
- Test: valuation z wyraźnym driverem WACC → rekomendacje risk‑reduction + evidence + conversion do initiative.
- Test: próba wygenerowania porady prawnej → system odmawia / przeformułowuje compliant.

**Rollout plan:**
- Najpierw “structured recommendations” + conversion do initiatives, potem approvals i industry packs.

---

## T057 — 🟣 finance — Valuation Negotiation Argument Builder (pro/contra, objections & rebuttals, deck‑ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Fundraising/M&A negotiation prep) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Negocjacje wyceny wymagają struktury, argumentów i kontrargumentów. Founderzy często mają tylko “number”, a nie:
- tezę i logiczny wywód,
- dowody (assumptions/metrics),
- przygotowane odpowiedzi na obiekcje (VC/M&A).

**Cel (outcome, nie feature):**
System buduje zestaw argumentów do negocjacji wyceny:
- **pro‑valuation** (dlaczego taka wycena jest uzasadniona),
- **contra‑valuation** (uczciwie: gdzie są słabe punkty i jak je adresować),
z gotowymi ripostami i “talk track”, który można wkleić do decka/briefu.

**Użytkownicy i scenariusze:**
- Founder: przygotowuje rozmowę z VC → 10 min “talk track” + Q&A.
- CFO: dba o zgodność argumentów z modelami i danymi.
- M&A: przygotowuje “seller narrative” i defensywną listę ryzyk.

**Scope (V2)**
- IN:
  - Inputs (MUST):
    - APPROVED valuation (T055) + sensitivity,
    - finance insights (T052) + ratios (T051),
    - (opcjonalnie) advisory actions (T056) jako “plan to de‑risk / improve”.
  - Argument structure (MUST):
    - teza → dane/założenia → logika → implikacja,
    - dla każdej tezy: “supporting evidence” (cytowane metryki),
    - jawne assumptions (WACC/g/multiples) i “what would change my mind”.
  - Pro/contra set (MUST):
    - pro‑valuation:
      - 5–10 key points + 1‑liners + supporting facts,
    - contra‑valuation:
      - top objections (np. ryzyko, churn, concentration, cash burn, execution risk) + riposty,
      - “concessions” (co można oddać bez utraty strategii) (TBD).
  - Q&A / objections playbook (MUST):
    - lista 15–25 typowych pytań VC/M&A + suggested answer,
    - “don’t say list” (compliance) + disclaimers.
  - Deck-ready export (MUST):
    - generator slajdów/sekcji:
      - valuation narrative,
      - sensitivity highlights,
      - mitigation plan (z T056) jako “risk response”.
- OUT:
  - Automatyczne drafty umów i poradnictwo prawne.
- Future enhancements (post‑V2):
  - Personalizacja pod profil inwestora (growth vs value) + strategia kotwiczenia.
  - Integracje market data do porównań (post‑V2).

**UX / UI notes:**
- Krótkie, “spoken language” + opcja “formal memo”.
- Każdy punkt ma “source” (z modelu), żeby nie było halucynacji.

**Security / compliance:**
- Disclaimers: informational, not legal/investment advice.
- “No hallucinations”: tylko grounded, inaczej oznacz jako TBD.

**Analytics (events/metrics):**
- `valuation_negotiation_pack_generated`
- `valuation_negotiation_pack_exported`

**Risks:**
- Jakość argumentów bez danych → system musi degradować do “missing evidence”.

**Open questions:**
- Czy w V2 wspieramy “two-sided memo” (pro/contra w jednym dokumencie) jako standard?

**Definition of Done (DoD):**
- System generuje argumenty w dwóch kierunkach na bazie założeń i danych.
- Output jest gotowy do użycia w decku/briefie (z disclaimers).

**Acceptance / test plan:**
- Test: valuation z sensitivity → pack zawiera argumenty + obiekcje + riposty + cytowane źródła.
- Test: export → generuje spójny dokument/sekcję do slajdów.

**Rollout plan:**
- Najpierw pro/contra + Q&A, potem lepsze szablony i integracja z presentation generator.

---

## T058 — 🟣 finance — Presentation Generator (Gamma.app‑level quality, BCG‑grade PPTX, platform artifacts → deck)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Outputs → sponsor/VC‑ready decks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy chcą szybko przełożyć pracę w platformie na deck sponsor‑ready **na poziomie Gamma.app** (czyli: “piękne slajdy bez dłubania”), ale:
- treści są rozproszone (research, inicjatywy, finanse, tools, KPI),
- jakość slajdów musi być “consulting‑grade” (layout, story, skanowalność),
- eksport musi być realnie używalny w PowerPoint/Google Slides (PPTX).

**Cel (outcome, nie feature):**
Użytkownik wybiera źródła (artefakty) i generuje **spójny deck** w stylu Consultify:
- z dobrą narracją (outline → story),
- z jasnymi key messages na slajdach,
- w wersji językowej (PL/EN) i z brandingiem/konfidentialnością,
oraz eksportuje do PPTX (i opcjonalnie PDF) bez ręcznego sklejania.

**Użytkownicy i scenariusze:**
- Konsultant: “Steering Committee deck” z portfolio inicjatyw + risks + next steps.
- Founder/CFO: “Valuation deck” (T055/T056/T057) + sensitivity + plan działań.
- PMO: “Program status deck” z execution timeline (T039/T041/T040) + budżet (T042/T053).

**Scope (V2)**
- IN:
  - Source selection (MUST):
    - user wybiera 1..N źródeł do decka:
      - initiatives/portfolio, execution status, RAID, KPI/ROI, valuation outputs, finance insights,
      - narzędzia/tools outputs (tool sessions) (T019–T021),
      - (opcjonalnie) reporty (T027) jako źródło slajdów,
    - możliwość ograniczenia: “only approved artifacts” (zalecane dla enterprise).
  - Guided deck setup (MUST):
    - audience: sponsor / exec / VC / internal,
    - goal: inform / decide / sell / align,
    - language: PL/EN (V2 baseline),
    - template: corporate/minimal/modern (spójne z pipeline),
    - confidentiality: confidential/internal/public,
    - brandColor/logo (TBD: org branding settings).
  - Outline → slides generation (MUST):
    - AI generuje:
      - outline (sekcje + slajdy) + key messages,
      - mapowanie treści do “slide intents”,
    - user może:
      - dodać/usunąć slajd,
      - zmienić kolejność,
      - edytować key message i 1–2 bullet points,
    - bez budowania pełnego edytora slajdów (OUT).
  - Gamma.app‑level quality bar (MUST, non‑negotiable):
    - story-first:
      - każdy slajd ma 1 key message (headline) + supporting evidence (max 3–5 bullets),
      - automatyczne “slide splitting”: jeśli treści za dużo → generator dzieli na 2 slajdy zamiast upychać,
      - automatyczne “sectioning”: cover → section intro → content → next steps/closing.
    - layout polish:
      - zero overflow / uciętych tekstów / nachodzących na siebie elementów,
      - auto-fit font sizing (kontrolowane) + twarde minima (np. body ≥ 14pt) (TBD),
      - stała hierarchia typograficzna (H1/H2/body/captions) i whitespace,
      - spójne gridy i marginesy (design tokens).
    - visuals-by-default:
      - preferować wizualizacje zamiast ścian tekstu:
        - KPI tiles/strips, heatmapy, macierze priorytetów, roadmap band, risk tables,
      - ikony/oznaczenia semantyczne (status/priority) tylko tam gdzie dodają czytelność,
      - chart styling spójny z template (kolory, legendy, źródło).
    - grounding:
      - liczby mają source tags; jeśli brak źródła → oznacz jako TBD, nie generuj “na czuja”.
    - “minimal manual fixes”:
      - deck po eksporcie ma być gotowy do użycia po kosmetycznych korektach (a nie “naprawianiu layoutu”).
  - Unified JSON as canonical format (MUST):
    - deck jest przechowywany jako “Unified Report JSON” (lub analogiczny “Unified Deck JSON”),
    - intents zgodne z istniejącym katalogiem (`cover`, `executive_summary`, `key_messages`, `initiative_portfolio`, `roadmap`, `risk_management`, `next_steps`, …),
    - quality gates: walidacje (RulesEngine) przed renderem.
  - Rendering & export (MUST):
    - render PPTX przez istniejący `PptxPipelineService` (primary),
    - fallback: legacy `PptxExportService` (jeśli potrzebne),
    - eksport:
      - PPTX (MUST),
      - PDF (V2 optional, jeśli macie już pipeline),
    - wynik przechowujemy jako artefakt z metadanymi (kto, kiedy, z czego powstał).
  - Preview & share (MUST):
    - podgląd deck outline + mini‑preview (np. thumbnails) (TBD),
    - “regenerate”:
      - 1‑klik: regeneruj cały deck,
      - 1‑klik: regeneruj pojedynczy slajd (z zachowaniem intentu) (TBD),
    - generowanie public link (jeśli polityka pozwala) (reuse report share patterns),
    - watermark + disclaimers (dla finance/valuation).
  - Content grounding & citations (MUST):
    - każdy slajd ma “source tags” (link do artefaktów i timestamp),
    - AI nie może “wymyślać liczb”: liczby muszą pochodzić ze źródeł (T054/T055/etc.) albo być oznaczone jako TBD.
  - Performance & limits (MUST):
    - limity: np. 5–25 slajdów w V2 (TBD),
    - timeout/async job dla generacji (jeśli dłużej trwa),
    - obsługa błędów: fallback error slide + warnings (pipeline już to robi).
- OUT:
  - Pełny edytor slajdów jak PowerPoint (drag‑resize, custom shapes) w V2.
  - “Design marketplace” z setkami motywów.
- Future enhancements (post‑V2):
  - Inline slide editor (ograniczony) + brand kits per klient.
  - Multi‑language decks (6 języków) + RTL layouts.
  - Auto‑refresh deck “live link” (deck regeneruje się gdy źródła się zmienią).

**UX / UI notes:**
- UX ma być **Gamma‑app‑level**: szybka konfiguracja, outline-first, natychmiastowy preview, a potem render.
- “Consulting‑grade” = “clean & confident”:
  - minimal noise, dużo whitespace,
  - 1 key message / slajd,
  - bullets krótkie, nie eseje,
  - wykresy/tabele zawsze z podpisem i źródłem.

**Data / integrations:**
- Backend: istniejący `server/src/services/report/pptx/*` (Unified JSON + intents + layouts + RulesEngine).
- Routes: można wykorzystać istniejące `/api/reports/*` patterns (generate/export/share) jako bazę, ale dla decków może być osobny `presentations.routes.ts` (TBD).

**Security / compliance:**
- RBAC: generowanie/export zależne od dostępu do źródeł.
- Public share tylko jeśli dozwolone; hasło/expiry.
- Finance/valuation: zawsze disclaimers + confidentiality banner.

**Analytics (events/metrics):**
- `presentation_generator_opened`
- `presentation_outline_generated`
- `presentation_exported` (pptx|pdf, slideCount)
- `presentation_shared`

**Risks:**
- Jakość layoutu/brand consistency → w V2 twarde quality gates + ograniczony katalog intents.
- Hallucination liczb → source tags + blokady na “uncited numbers”.

**Open questions:**
- Czy w V2 deck jest oddzielnym bytem od reportów (osobna tabela), czy reuse `reports` z nowym `sourceType`?
- Jakie są 3–5 “canonical deck types” (steering, valuation, program update, tool workshop) jako gotowe preset outlines?

**Definition of Done (DoD):**
- Użytkownik wybiera źródła i generuje deck w spójnym stylu (outline + key messages).
- Rendering przez pipeline daje poprawny PPTX (otwieralny w PowerPoint) z poprawnym brandingiem i konfidentialnością.
- Eksport jest gotowy do użycia **bez ręcznego “naprawiania” slajdów**:
  - brak overflow / overlapped elements,
  - brak “tiny fonts” poniżej ustalonego minimum,
  - deck ma spójną hierarchię typografii i grid.
- Quality gates:
  - RulesEngine blokuje generację, jeśli slajdy naruszają krytyczne zasady jakości (np. overflow),
  - generator potrafi auto-split treści na dodatkowe slajdy zamiast łamać layout.

**Acceptance / test plan:**
- Test: deck “Steering update” z portfolio+RAID+next steps → pipeline renderuje 12–18 slajdów bez błędów.
- Test: deck “Valuation” z T055 → zawiera summary + sensitivity + disclaimers.
- Test: “Gamma quality” — otwarcie PPTX w PowerPoint:
   - brak nachodzących elementów,
   - brak uciętych tekstów,
   - 0 krytycznych naruszeń jakości w walidacji,
   - tylko kosmetyczne poprawki (opcjonalne), nie naprawa układu.

**Rollout plan:**
- Najpierw 2–3 preset deck types + export PPTX, potem custom outlines i share links.

---

## T059 — 🟣 reports — Business Presentation Templates (brand kits + preset deck types + intent library)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Template system for reports & decks) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli chcemy “Gamma.app‑level” decki (T058) i executive‑ready raporty (T027), to nie możemy generować wszystkiego “od zera” za każdym razem. Potrzebujemy **systemu szablonów**, który:
- zapewnia spójność brandu i jakości,
- daje preset “deck types” (steering / valuation / program update / tool workshop),
- pozwala organizacjom dopasować styl (logo, kolory, disclaimer, stopki),
bez ryzyka rozjechania layoutu.

**Cel (outcome, nie feature):**
Użytkownik wybiera szablon (template) i dostaje:
- spójny styl (brand kit),
- spójny “story spine” (outline preset),
- kompatybilność z PPTX pipeline (intents/layouty/quality gates),
tak aby generacja decków/raportów była szybka, powtarzalna i premium‑quality.

**Użytkownicy i scenariusze:**
- Konsultant: wybiera “Steering Committee Update” → deck powstaje w stylu klienta.
- CFO/Founder: wybiera “Valuation Pack” → deck ma właściwe disclaimers i sekcje.
- Admin org: ustawia brand kit (logo/kolory/stopki) i publikuje template dla zespołu.

**Scope (V2)**
- IN:
  - Template taxonomy (MUST):
    - rozdzielić:
      - **deck templates** (dla T058),
      - **report templates** (dla T027 / report builder),
      - **management report templates** (steering/team cadence) (jeśli używacie `management_report_templates`),
    - każdy template ma:
      - name, description, audience, goal,
      - language default,
      - confidentiality default,
      - “intent coverage” (jakie slide intents/sekcje są używane).
  - Brand Kits (MUST):
    - per org:
      - logo (opcjonalnie),
      - primary/secondary colors (override design tokens),
      - font policy (PowerPoint-safe fonts; V2 baseline = z `designTokens.ts`),
      - footer/header rules, page numbers, confidentiality banner,
    - guardrails: brand kit nie może zepsuć jakości (np. zbyt jasny primary → auto-contrast).
  - Preset deck types (MUST, 3–5 system templates):
    - minimum V2:
      - Steering Committee Update,
      - Program/Execution Update,
      - Valuation Pack (T055/T056/T057),
      - Tool Workshop Summary,
      - (opcjonalnie) Assessment Summary (DRD/SIRI/ADMA).
    - każdy preset definiuje:
      - outline (sekcje + intents),
      - limity slajdów,
      - “must-have slides” (cover, exec summary, key messages, next steps, disclaimer),
      - recommended visuals (KPI strip, roadmap, risk table, heatmap, sensitivity).
  - Intent / layout library alignment (MUST):
    - templates muszą mapować na istniejące `SlideIntent` i layouty (PPTX pipeline),
    - quality gates (RulesEngine) są obowiązkowe — template nie może ich omijać.
  - Customization workflow (MUST):
    - system templates (read‑only) → użytkownik może:
      - **clone** do org template,
      - edytować metadane (audience/goal),
      - w ograniczonym zakresie edytować outline (kolejność, on/off sekcje),
      - podmienić brand kit.
    - bez edycji “pixel‑level” layoutów w V2.
  - Preview & QA (MUST):
    - template preview:
      - mini deck (sample content) renderowany przez pipeline,
      - walidacja: brak overflow / tiny fonts / overlap,
    - “template health” status: OK/WARN/FAIL + wskazówki naprawy.
  - Storage & migration strategy (MUST):
    - reuse istniejących tabel tam gdzie pasują:
      - `report_builder_templates` (wysokiej jakości templates do reportów),
      - `management_report_templates` (cadence reports),
    - dla deck templates: nowa tabela `presentation_templates` (TBD) albo reuse `report_builder_templates` z `source_type='PRESENTATION'` (TBD decyzja),
    - seeding: dostarczyć system templates w migracji/seed script.
- OUT:
  - Marketplace stylów i pełny edytor layoutów (komponentowy builder) w V2.
- Future enhancements (post‑V2):
  - Template editor dla advanced użytkowników (guardrailed) + custom intents.
  - 6 języków + RTL deck layouts (ar).
  - Auto-learning: które deck types działają najlepiej (adoption + conversion).

**UX / UI notes:**
- Wybór template ma być tak prosty jak w Gamma: karta template + mini preview + “Use”.
- Dla admina: osobny panel “Brand & Templates” (settings).

**Data / integrations:**
- PPTX pipeline: `designTokens.ts`, `SlideIntent`, `layouts/*`, `RulesEngine`, `PptxPipelineService`.
- Report templates: `report_builder_templates` (już seedowane) + T027.

**Security / compliance:**
- Org templates: edycja tylko dla ADMIN/OWNER/Brand role (TBD), reszta read/use.
- Audit log zmian brand kit i template publish.

**Analytics (events/metrics):**
- `template_selected` (templateId, type=deck|report)
- `brand_kit_updated`
- `template_cloned` / `template_published`
- KPI: adoption, eksporty, redukcja czasu “deck production”.

**Risks:**
- Zbyt duża swoboda edycji → ryzyko popsucia jakości (dlatego V2 ogranicza do outline + brand kit).
- Rozjazd między template outline a pipeline intents → potrzebna walidacja i preview.

**Open questions:**
- Czy deck templates trzymamy jako osobny byt (`presentation_templates`) czy reuse `report_builder_templates` z nowym `source_type`?

**Definition of Done (DoD):**
- Istnieje system templates (3–5 preset deck types) + brand kit per org.
- Użytkownik może wybrać template i wygenerować deck/raport w spójnym stylu.
- Template preview + quality gates wykrywają i blokują krytyczne naruszenia jakości.

**Acceptance / test plan:**
- Test: sklonuj system template → zmień brandColor/logo → preview renderuje bez overflow/overlap.
- Test: każdy preset deck type generuje PPTX “Gamma quality” (brak napraw layoutu).

**Rollout plan:**
- Najpierw system templates + brand kit overrides, potem org cloning/publish i template health panel.

---

## T060 — 🟣 reports — Structured Report Generator (block builder, pro formatting, export‑ready, “first on market”)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting deliverables / Report Builder v2) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Na rynku nie ma “sprytnych generatorów raportów” w sensie consulting deliverable — są albo:
- proste eksporty, albo
- pełne WYSIWYG (Word‑like) bez AI i bez struktury, albo
- narzędzia do prezentacji (Gamma‑like) które nie rozwiązują problemu raportu.
U Was raporty już są generowane w systemie jako **strukturalne bloki**: dużo ustawień, dodajemy sekcje po kolei, ustawiamy kolejność, opisujemy “co ma być w środku”. T060 ma to **sfinalizować do standardu premium**.

Dodatkowo (super ważne): generator musi pozwolić, żeby w formie raportów dało się prezentować **wszystko, co tworzymy w aplikacji** — inicjatywy, execution (timeline/delays/RAID), finanse (budżet/model/wycena), KPI/ROI, narzędzia consultingowe, interview insights, rekomendacje i roadmapy — w jednym, spójnym deliverable.

**Cel (outcome, nie feature):**
Konsultant/PMO generuje raport jako deliverable sponsor‑ready:
- wybiera źródło (assessment/tool/interview/initiative),
- wybiera strukturę (sekcje/bloki) i kolejność,
- doprecyzowuje “prompt hints” per sekcja,
- generuje/regenruje sekcje iteracyjnie,
- robi review + wersje + komentarze,
- eksportuje do PDF/DOCX (i opcjonalnie PPTX, jeśli raport ma charakter decka),
bez ręcznego klejenia w Wordzie.

**Użytkownicy i scenariusze:**
- Konsultant: tworzy raport z narzędzia/assessmentu dla klienta (Executive + Appendix).
- PMO: składa status/steering report z inicjatyw + RAID + next steps.
- Sponsor (read‑only): przegląda finalny raport, dostaje public link/PDF.

**Scope (V2)**
- IN:
  - Source selection (MUST):
    - źródła raportu: ASSESSMENT / TOOL / INTERVIEW / INITIATIVE (zgodnie z istniejącym `ReportBuilder`),
    - filtrowanie: prefer “only approved sources” (np. APPROVED assessments) dla jakości.
  - “Everything-in-app → report” coverage (MUST):
    - raport może zawierać bloki z całej platformy, w szczególności:
      - initiatives/portfolio + roadmap + priorytety,
      - execution: timeline, delay signals, RAID risks/issues + mitigacje,
      - KPI/ROI + attribution + financial statement mapping,
      - finanse: budżet, analiza, model finansowy (P&L/BS/CF) i wycena (DCF/comps/sensitivity),
      - tools outputs (T019–T021) + wnioski + closure,
      - interview insights + evidence,
      - decyzje/tasks jako “next steps”.
    - Uwaga implementacyjna: nawet jeśli report ma jeden “primary sourceType”, musi pozwalać dodawać bloki odwołujące się do innych artefaktów (linked blocks), z czytelnym “source tag”.
  - Wizard / flow (MUST, jak w obecnym systemie):
    - kroki (V2 baseline):
      - Source select → Intent → Configure structure → Generate → Review/Edit → Export/Share,
    - invocation profiles (MUST):
      - profile per sourceType (macie `reportInvocationProfiles`),
      - profile steruje defaultami (sekcje, długość, styl, visuals).
  - Block/section builder (MUST):
    - sekcje/bloki:
      - dodawanie z palety (BlockPalette),
      - enable/disable,
      - reorder (drag),
      - chapter grouping (dla długich raportów),
    - per sekcja ustawienia (MUST):
      - title,
      - length (short/medium/long),
      - language style (technical/business/general),
      - customPrompt / “dodatkowe wskazówki dla AI”,
      - renderKind / blockTypeId (jeśli dotyczy),
    - nawigacja kolejnością:
      - “chapter navigation” + szybkie skoki,
      - “what’s missing” checklist (np. brak exec summary, brak next steps).
  - Agent mode (MUST, Gamma‑style “talk to agent → layout changes”):
    - wbudowany “report agent” (chat) potrafi na polecenie użytkownika:
      - zmieniać układ struktury: reorder, split chapters, włączać/wyłączać sekcje,
      - dodawać/usuwać bloki (z palety) i proponować sensowną kolejność,
      - modyfikować ustawienia sekcji: length, language style, customPrompt, visuals,
      - proponować “best practice structure” dla celu (steering/valuation/assessment/roadmap),
      - regenerować pojedynczy blok albo cały rozdział,
      - wskazywać luki jakości (np. brak next steps / brak danych / brak citations) i proponować poprawki.
    - model interakcji:
      - agent pokazuje preview zmian (diff: co się zmieni w strukturze) i dopiero potem stosuje,
      - wszystkie zmiany są audytowalne i wersjonowane (jak inne edycje).
    - guardrails:
      - agent nie może zmienić liczb “z powietrza”; liczby muszą pochodzić ze źródeł lub być oznaczone jako TBD.
  - Generation model (MUST):
    - generacja per blok:
      - generate / regenerate,
      - “needs regeneration” gdy zmieniono ustawienia/prompt,
    - quality gates:
      - blokada “publish/export” jeśli:
        - są enabled sekcje bez contentu,
        - są krytyczne naruszenia (np. brak źródeł liczb przy requireCitations),
      - minimalna struktura: cover + executive summary + key findings + recommendations + next steps (zależnie od preset/profile).
  - Review & collaboration (MUST):
    - komentarze (block‑level) + panel review (macie `ReportBuilderCommentsService` i UI),
    - status raportu (DRAFT/REVIEW/APPROVED) + auto‑versioning na zmianach statusu,
    - wersje:
      - create version (manual),
      - rollback (guardrailed).
  - Export/Share (MUST):
    - eksport:
      - PDF (MUST) — profesjonalne formatowanie, paginacja, cover/headers/footers,
      - DOCX (MUST) — do klienta, który “musi mieć Worda”,
      - PPTX (optional w V2) — tylko dla reportów “slide‑style” (spięcie z T058/T059/T027),
    - share:
      - public link + hasło + expiry (reuse istniejących mechanizmów),
      - branding on/off (enterprise policy).
  - Styling / templates (MUST):
    - spójność z report templates:
      - `report_builder_templates` jako baza sekcji i prompt hints,
    - theme + brand kit:
      - primary/accent colors, logo, footer mode (w UI macie `SettingsPanel`),
      - 6 języków ustawień/report intent (EN/PL/DE/ES/AR/JP) jak w obecnym panelu.
  - Premium graphics bar (MUST):
    - raport ma wyglądać jak consulting deliverable:
      - spójna typografia, nagłówki, whitespace,
      - tabele/wykresy/macierze/heatmapy w standardzie “prezentowalne”,
      - wykresy i liczby zawsze z podpisem i źródłem (source tag),
      - brak “ścian tekstu”: preferować wizualne bloki (KPI tiles, portfolio tables, roadmap bands, risk tables),
    - quality gates dla eksportu:
      - brak pustych enabled sekcji,
      - brak “TBD” w krytycznych miejscach (np. executive summary) jeśli raport ma status APPROVED (TBD policy).
- OUT:
  - Pełny WYSIWYG jak w Word (pixel-perfect edycja) w V2.
  - “Generowanie w ciemno” bez struktury i bez kontroli jakości.
- Future enhancements (post‑V2):
  - Inline WYSIWYG dla wybranych bloków (limited) + track changes.
  - Zaawansowane citations enforcement + evidence bundles (attachments).
  - Smart “consistency checker” (czy rekomendacje mają owners/KPI/ROI).

**UX / UI notes:**
- To ma być “kontrolowany generator”, nie “magic button”:
  - user zawsze widzi strukturę i kolejność,
  - user kontroluje prompt per sekcja,
  - user generuje iteracyjnie, sekcja po sekcji.
- “Premium readability”: czyste nagłówki, whitespace, spójne style tabel i calloutów.
 - Agent mode ma być “jak w Gamma”:
   - user mówi: “przestaw układ / skróć / dodaj rozdział finance / przenieś rekomendacje na górę”
   - agent pokazuje diff i stosuje zmiany.

**Data / integrations:**
- Backend: `report-builder.routes.ts`, `ReportBuilderService`, komentarze, wersje, export.
- Templates: `report_builder_templates` (seedowane, m.in. DRD/SIRI/ADMA/TOOL/INTERVIEW).
- Eksport PPTX: jeśli używamy — pipeline PPTX (T058/T059) lub report export service.

**Security / compliance:**
- RBAC: dostęp do raportu dziedziczy dostęp do źródła (assessment/tool/project).
- Public share tylko jeśli dozwolone; zawsze audyt.
- PII/finanse: redakcja/guardrails w promptach (TBD).

**Analytics (events/metrics):**
- `report_builder_opened`
- `report_section_added` / `report_section_reordered`
- `report_section_generated` / `regenerated`
- `report_exported` (pdf|docx|pptx)
- `report_shared`

**Risks:**
- Formatowanie i paginacja PDF → trzeba trzymać “business-grade” standard.
- Brakujące dane → generator musi oznaczać luki, nie halucynować.
- Długie raporty → performance + chapter navigation.

**Open questions:**
- Czy w V2 default export to PDF+DOCX zawsze, czy zależnie od template?
- Jak mocno egzekwujemy citations w V2 (requireCitations vs “soft guidance”)?

**Definition of Done (DoD):**
- Użytkownik generuje raport z wybranych sekcji/bloków, raport ma spójną strukturę (chapters + kolejność + preset).
- Użytkownik może iteracyjnie generować/regenrować sekcje i zrobić review z komentarzami i wersjami.
- Eksport PDF/DOCX działa i jest **akceptowalny jako deliverable** (bez ręcznego “składania”).
- Raport może prezentować treści z całej aplikacji (linked blocks) w sposób spójny i udokumentowany (source tags).
- Agent mode potrafi zmienić strukturę/ustawienia raportu na podstawie rozmowy i utrzymuje audyt/wersje.

**Acceptance / test plan:**
- Test: raport DRD board pack → wygenerowany, przechodzi review, export PDF ma paginację i spójne style.
- Test: edycja kolejności sekcji + customPrompt → sekcja oznaczona “needs regeneration” i poprawnie regeneruje.
- Test: report agent:
  - komenda: “Przenieś Recommendations przed Analysis, dodaj KPI Dashboard, skróć Executive Summary do short” → agent pokazuje diff i stosuje zmiany; bloki oznaczone “needs regeneration”.
- Test: “everything-in-app report”:
  - raport łączy: initiative portfolio + RAID + budżet + KPI + valuation summary + next steps → export PDF/DOCX działa i source tags prowadzą do artefaktów.

**Rollout plan:**
- Najpierw stabilizacja flow + export PDF/DOCX, potem mocniejsze quality gates i lepsze templates coverage.

---

## T061 — 🟣 reports — Standardized Business Report Templates (business-grade library, use-case presets)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Templates library for T060) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Powtarzalna jakość dokumentów i szybkość generowania wymagają szablonów. Bez template’ów każdy raport jest “projektem”, co psuje skalowanie i premium UX.

**Cel (outcome, nie feature):**
Użytkownik wybiera template, a raport generuje się w spójnej strukturze:
- executive‑ready,
- kompatybilnej z danymi (assessment/tools/finance/roadmap),
- gotowej do eksportu (PDF/DOCX),
z minimalną liczbą ręcznych poprawek.

**Użytkownicy i scenariusze:**
- Konsultant: wybiera “Assessment Summary” → raport w 15 min.
- PMO: wybiera “Steering Committee Brief” → cykliczny deliverable.
- CFO: wybiera “Financial Analysis & Valuation Pack” → pakiet do board/VC.

**Scope (V2)**
- IN:
  - Library of standard templates (MUST):
    - 4–8 kanonicznych template’ów biznesowych, minimum:
      - Strategic Review / Executive Brief,
      - Assessment Summary (DRD/SIRI/ADMA),
      - Transformation Roadmap & Portfolio,
      - Financial Analysis (statements + ratios + insights),
      - Valuation Pack (summary + sensitivity + disclaimers),
      - Steering Committee / Program Update,
      - Tool Workshop Summary (T019–T021 outputs),
    - każdy template definiuje:
      - sekcje/bloki + kolejność + chapters,
      - default length/style per sekcja,
      - prompt hints (“co ma być w środku”),
      - quality rules (required blocks).
  - Template selection UX (MUST):
    - picker modal: karta template + opis + dla kogo + expected length,
    - “preview outline” przed startem,
    - “apply template” do ReportBuilder (T060).
  - Template governance (MUST):
    - system templates (read‑only) + możliwość klonowania do org (jak w T059),
    - template versioning (TBD) i audit zmian.
  - Compatibility & fallbacks (MUST):
    - jeśli brakuje danych do sekcji:
      - sekcja pokazuje “missing data” i sugestię (co dodać),
      - nie halucynuje.
- OUT:
  - Pełny WYSIWYG editor template’ów (pixel-level) w V2.
- Future enhancements (post‑V2):
  - Template editor dla advanced użytkowników (guardrailed) + marketplace.
  - Auto-learning: które template’y mają najlepszy feedback.

**UX / UI notes:**
- Template’y muszą być “business-grade”: czytelne, krótkie, z closure i next steps.

**Data / integrations:**
- Reuse `report_builder_templates` (już seedowane) jako system templates.
- Integracja z T060 (ReportBuilder) i T027 (report/presentation exports).

**Security / compliance:**
- Valuation/finance templates zawsze dodają disclaimers.

**Analytics (events/metrics):**
- `report_template_selected` (templateId)
- `report_template_applied`
- KPI: adoption template’ów, mniej ręcznych poprawek.

**Risks:**
- Zbyt wiele template’ów → chaos; V2 trzyma małą bibliotekę “canonical”.

**Open questions:**
- Które 4 template’y są MUST na start V2 (jeśli chcemy minimalny zestaw)?

**Definition of Done (DoD):**
- Użytkownik wybiera template i raport generuje się w spójnej strukturze.
- Template’y są business-grade i gotowe do eksportu (PDF/DOCX) bez naprawy układu.

**Acceptance / test plan:**
- Test: wybór template “Financial Analysis” → raport ma sekcje statements/ratios/insights/next steps; export PDF/DOCX działa.
- Test: template “Tool Workshop Summary” → raport zawiera closure + inicjatywy wygenerowane z tool outputs.

**Rollout plan:**
- Najpierw 4–5 canonical templates, potem rozbudowa biblioteki.

---

## T062 — 🟣 reports — Automated Recurring and Event‑Triggered Reporting (time‑based + triggers → report/deck + send)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: (Reporting automation / Stakeholder cadence) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Stakeholder communication i governance wymagają rytmu. Jeśli raporty/prezentacje są robione ręcznie:
- powstają za późno,
- są niespójne,
- a kluczowe sygnały (delay/risk/budget) nie trafiają na czas do sponsora.
Potrzebujemy automatu, który **o określonym czasie** albo **po triggerze** tworzy i dystrybuuje deliverable.

**Cel (outcome, nie feature):**
System automatycznie:
- generuje raport (PDF/DOCX) lub prezentację (PPTX) z wybranego template,
- w oparciu o wskazany scope (projekt/portfolio/inicjatywa),
- i wysyła/udostępnia do zdefiniowanych odbiorców,
z historią wykonań, kontrolą uprawnień i anti‑spam.

**Użytkownicy i scenariusze:**
- PMO: weekly steering report dla sponsorów (time‑based).
- Sponsor: dostaje “exception report” gdy:
  - delay signal critical (T041),
  - risk spike high/critical (T040),
  - overspend risk threshold (T042),
  - stage‑gate transition / approval (T033) (TBD).
- Konsultant: po zakończeniu workshopu toolowego (T019–T021) system generuje “Workshop Summary” deck i wysyła do klienta.

**Scope (V2)**
- IN:
  - Schedule definitions (MUST):
    - time‑based:
      - daily/weekly/biweekly/monthly/quarterly + custom cron,
      - timezone,
    - event‑triggered:
      - definicja triggerów + warunków (rules):
        - delay threshold exceeded (np. plannedEnd overdue),
        - risk item created/high severity (RAID),
        - budget consumption threshold (80/90/100),
        - milestone reached / stage‑gate changed (TBD),
        - “new approved artifact” (np. assessment APPROVED → report).
      - throttling per trigger (np. max 1/24h per project per trigger type).
  - Deliverable type (MUST):
    - per schedule wybór:
      - **report**: PDF/DOCX generowany przez Report Builder (T060) + template (T061),
      - **presentation**: PPTX generowany przez Presentation Generator (T058) + template (T059),
    - możliwość generowania obu (np. PDF + PPTX) (TBD; V2 baseline = wybór 1 lub 2).
  - Template + scope binding (MUST):
    - schedule wskazuje:
      - templateId,
      - scope: org/portfolio/project/initiative,
      - source filters: “only approved artifacts” (rekomendowane).
  - Recipients & delivery (MUST):
    - recipients:
      - lista userIds i/lub emails (zależnie od polityki),
      - role-based groups (np. sponsors, PMO) (TBD minimal),
    - delivery channels:
      - in‑app notification (MUST),
      - email (MUST, jeśli skonfigurowany provider),
      - public share link (optional, z hasłem/expiry),
      - webhook/storage (optional; w kodzie jest `DeliveryMethod` — V2 może wspierać jako advanced).
  - Execution history & audit (MUST):
    - lista wykonań:
      - status (pending/running/success/failed),
      - timestamps,
      - link do wygenerowanego reportId/presentationId,
      - delivery results per kanał,
      - error details (bez sekretów).
    - pełny audit:
      - kto stworzył schedule,
      - kto zmienił config,
      - kto dodał recipients.
  - UI (MUST):
    - widok “Reporting Automation”:
      - lista schedule + status + next run + last run,
      - create/edit/pause/resume,
      - execution history,
      - test run (manual “Run now”).
  - Implementation baseline (grounded w istniejącym systemie) (MUST):
    - wykorzystać istniejące:
      - `scheduledReportService` + `scheduled-reports.routes.ts`,
      - Scheduler cron job (V2: realna implementacja `processScheduledReports`, nie no‑op),
    - dodać warstwę trigger evaluation:
      - V2 baseline: periodic evaluation job (np. co 15–60 min) skanujący sygnały i odpalający generację,
      - post‑V2: event bus/stream dla near‑real‑time.
- OUT:
  - Zaawansowane workflow automations i pełna personalizacja treści per odbiorca (V2).
- Future enhancements (post‑V2):
  - Per‑recipient personalization (język, rola, skrót vs szczegóły).
  - Smart batching: łączenie wielu triggerów w jeden “exception digest”.
  - Real‑time triggers (webhook/event bus) zamiast skanowania.

**UX / UI notes:**
- Użytkownik ma czuć kontrolę:
  - jasne “dlaczego raport został wysłany” (trigger reason),
  - łatwo wyciszyć (snooze/pause) i ustawić progi.

**Data / integrations:**
- Triggery wykorzystują sygnały z:
  - T041 (delay signals),
  - T040 (risk signals/RAID),
  - T042 (budget/overspend),
  - T033 (stage-gate) (TBD),
  - status reports / execution metrics (jeśli istnieją).
- Generator:
  - report = T060/T061,
  - deck = T058/T059.

**Security / compliance:**
- Permissions:
  - schedule może generować tylko z artefaktów, do których owner schedule ma dostęp,
  - recipients nie mogą dostać danych, do których nie mają uprawnień (MUST enforcement).
- Email deliverability + opt‑out polityki (TBD).

**Analytics (events/metrics):**
- `report_schedule_created` / `updated` / `paused`
- `report_schedule_trigger_fired` (type, scope)
- `report_schedule_run_completed` (success/fail, deliverableType)
- `report_schedule_delivery_sent` / `failed`

**Risks:**
- Noise (za dużo raportów) → throttling + batching + sensible defaults.
- Błędy eksportu → retry policy + fallback (np. public link zamiast attachment) (TBD).
- Uprawnienia i wycieki → twarde RBAC i audyt.

**Open questions:**
- Jakie triggery są MUST na start V2 (top 3): delay critical, risk high/critical, budget 90%?

**Definition of Done (DoD):**
- Można skonfigurować schedule time‑based oraz trigger‑based.
- System generuje raport lub prezentację z template i dostarcza do odbiorców (in‑app + email) z historią wykonań.
- Throttling działa (brak spamu), a “reason” triggera jest widoczny.

**Acceptance / test plan:**
- Test: weekly steering report (time‑based) → generacja + email + historia execution.
- Test: delay signal critical → trigger fires → exception report/deck → wysyłka tylko raz/24h.
- Test: brak uprawnień u recipient → system nie wysyła (lub wysyła wersję redacted) (TBD policy).

**Rollout plan:**
- Najpierw time‑based + manual “Run now”, potem trigger‑based (delay/risk/budget) z throttlingiem.

---

## T063 — 🔵 organization — Organization Module – UX and Visual Redesign (premium IA + visual consistency + conversion-ready)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Organization experience (Context + Admin surfaces) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Moduł Organization jest dziś rozproszony na kilka miejsc (context vs settings vs admin). Skutek:
- trudno “zrozumieć gdzie co jest” (niska nawigowalność),
- UX jest niespójny względem standardów platformy (spada wiarygodność),
- krytyczne obszary konwersji (billing/limits/domains) są trudniejsze w obsłudze.

**Cel (outcome, nie feature):**
Organization to jedno, spójne, premium doświadczenie:
- klarowna architektura informacji (IA) i nawigacja,
- spójny visual language zgodny z `docs/ui-standards/`,
- szybkie dojście do: profilu firmy, członków/rol, limitów, domen, billing/tokenów.

**Użytkownicy i scenariusze:**
- Owner/Admin: konfiguruje org (branding, domeny, limity, ownership), zaprasza ludzi, przechodzi trial → paid.
- Konsultant: uzupełnia “Company context” (profile/goals/challenges/strategy) jako podstawa pracy AI i deliverables.
- Member/Viewer: przegląda podstawowe informacje, bez dostępu do admin‑sekcji.

**Scope (V2)**
- IN:
  - Information architecture (MUST):
    - jeden logiczny “Organization workspace” z dwoma grupami:
      - **Context (business)**: profile/goals/challenges/megatrends/strategy (obecne `/organization/*`),
      - **Administration (operational)**: members/roles/invitations, billing & tokens, limits, approved domains, ownership, branding/regional (obecne `/settings/organization` i `/admin/organization`),
    - role-gated sekcje: admin widzi całość, member widzi tylko Context + ograniczone “Members (read-only)” (TBD).
  - Navigation redesign (MUST):
    - spójny left nav z grupami (Context / Admin),
    - stabilne deep linki (URL per sekcja),
    - mobile: drawer + sticky header, zgodnie z “Tech Sexy” (monochromatic chrome).
  - Presentation style: N‑style first (MUST):
    - **N‑style = page‑first, czytelny canvas, sekcje jako “blocks”, bez legacy accordion UX**,
    - organizacja treści ma prowadzić użytkownika “od sensu do detalu”:
      - summary/next steps above-the-fold,
      - dalej logiczne bloki (nie lista zwijanych nagłówków),
    - zakaz używania “starego D‑mode” wzorca w Organization (collapsible sections jako domyślny pattern) — V2 ma być czytelny i spokojny wizualnie.
  - Visual redesign (MUST):
    - pełna zgodność z `docs/ui-standards/README.md` (v2.0 Tech Sexy):
      - invisible borders, monochromatic chrome, outline icons,
      - typografia jako hierarchia (semibold, nie “border heavy”),
    - ujednolicenie kart/sekcji/empty states pod wspólne building blocks:
      - `Callout`, `ToggleBlock`, `EmptyStateInline`, `InlineTable`, `ChecklistBlock`, `EmbeddedView`.
  - “Conversion-ready” organization admin (MUST):
    - Billing/Trial/Tokens: czytelny status, limit/usage, klarowne CTA,
    - Limits: jasne powody ograniczeń + ścieżka upgrade,
    - Domains/Ownership: zrozumiałe flow, walidacje, komunikaty błędów.
  - i18n & content cleanup (MUST):
    - brak “hardcoded English” w UI; minimum PL+EN via `useTranslation` (V2),
    - przygotowanie pod 6 języków (postępowe uzupełnianie kluczy).
  - UX quality gates (MUST):
    - above-the-fold: zawsze 1–2 linie “co tu jest” + “next action” (jeśli admin),
    - brak “scroll jail”: logiczne sekcje, sticky tylko tam gdzie sensowne.
- OUT:
  - Rework modelu danych organizacji (V2).
  - Pełna przebudowa permissions/RBAC (tylko jeśli blokuje UX).
- Future enhancements (post‑V2):
  - “Org health” dashboard (adoption, security posture, spend insights).
  - Self-serve org setup checklist + guided tour.

**UX / UI notes (grounded w codebase):**
- Obecne powierzchnie do ujednolicenia:
  - `/organization/*` (`src/views/OrganizationView.tsx` + `OrganizationSidebar.tsx`) — Context,
  - `/settings/organization` (`src/components/settings/OrganizationSettings.tsx`) — Members/Billing/Tokens,
  - `/admin/organization` (m.in. `src/views/admin/OrganizationProfileView.tsx`) — Branding/Domain/Regional,
- V2 kończy z poczuciem “3 różnych ekranów o firmie”.
- Wymóg nadrzędny UX: **czytelność i przejrzystość** → N‑style layout + N blocks kit (spójne z UI standards), bez “D‑mode accordion feel”.

**Security / compliance:**
- Admin-only sekcje muszą mieć twarde bramki (UI + API).
- Wrażliwe akcje (ownership transfer, domains, billing) → dodatkowe potwierdzenia i audit (tam gdzie istnieje).

**Analytics (events/metrics):**
- `org_workspace_opened` (section)
- `org_admin_cta_clicked` (billing_activate/upgrade/limits_view)
- `org_member_invite_sent`
- KPI: time-to-find (self reported), spadek ticketów “where is X”, wzrost conversion trial→paid.

**Risks:**
- Rozsypanie routingu / linków → potrzebny redirect/compat layer (TBD).
- Zbyt szeroki zakres UI refactor → w V2 fokus na IA + top 5 ekrany.

**Open questions:**
- Które “Admin” sekcje są MUST w nowej nawigacji V2:
  - Billing/Tokens, Members, Limits, Domains, Branding? (proponuję te 5)

**Definition of Done (DoD):**
- Użytkownik ma jedno spójne miejsce “Organization”, z klarowną nawigacją i spójnym wyglądem.
- Najważniejsze ścieżki (Members, Billing/Tokens, Limits, Domains, Branding/Regional + Context) są premium, czytelne i zgodne z UI standards.
- PL+EN pokryte w tych ekranach (bez hardcoded copy).

**Acceptance / test plan:**
- Test: Owner wchodzi w Organization → w 10–20 sekund znajduje: Members, Billing/Tokens, Limits, Domains, Branding oraz Context.
- Test: Member nie widzi sekcji admin; link direct → Access blocked / read-only zgodnie z polityką.
- Test: Trial org → wyraźny status/usage + CTA upgrade; bez niespójnych komunikatów.

**Rollout plan:**
- Najpierw IA + nav + “top 5 admin screens”, potem dopieszczanie pozostałych sekcji i copy/i18n.

---

## T064 — 🔵 organization — Relocation of Megatrend Analysis (canonical: Tools → Strategy, zero feature loss)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Strategy tools IA & navigation coherence TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Megatrendy są analizą strategiczną, ale gdy są “ukryte” w kontekście/organization, użytkownik nie znajduje ich tam, gdzie szuka narzędzi strategicznych. Dodatkowo istnieje ryzyko duplikacji (ContextBuilder vs Organization).

**Cel (outcome, nie feature):**
Megatrend Analysis ma **jedno kanoniczne miejsce** w aplikacji: **Tools → Strategy**, a:
- dotychczasowe wejścia (ContextBuilder/Organization) nadal działają (redirect/alias),
- funkcja nie traci możliwości ani danych,
- architektura produktu jest spójna i przewidywalna.

**Użytkownicy i scenariusze:**
- Strateg/consultant: “robię analizę megatrendów” → idzie do Tools → Strategy i widzi Megatrends.
- Owner: ma linki historyczne / zakładki → nadal działają.
- PMO: korzysta z wyników w reportach/presentations (T060/T058).

**Scope (V2)**
- IN:
  - Canonical placement (MUST):
    - dodać “Megatrends” jako element w **Discovery Tools → Strategic**:
      - jako osobny “workspace/tool card” albo osobny route wewnątrz strategic tools,
      - entry widoczny i opisany (dla czego, jaki output).
  - One implementation, many entrypoints (MUST):
    - wyodrębnić wspólny komponent “Megatrends workspace” (refactor-only),
    - reużywać go w:
      - Tools → Strategy (canonical),
      - Organization → Context (opcjonalnie jako embed lub link do canonical).
  - Routing & redirects (MUST):
    - nowy canonical URL (TBD w implementacji) np.:
      - `/discovery-tools/strategic/megatrends` **lub**
      - `/discovery-tools/strategic?tool=megatrends`,
    - stare URL-e:
      - `/context/megatrends`
      - `/organization/megatrends`
      obsłużone poprzez:
      - redirect (preferowane) albo wyraźny “moved” banner + przycisk “Open in Strategy Tools”.
  - Navigation updates (MUST):
    - aktualizacja sidebar/menu, żeby “Megatrends” było spójnie w Tools/Strategy,
    - usunięcie “dublowania” w miejscach, gdzie powoduje chaos (TBD: w Organization zostaje jako link/short-cut, nie drugi pełny moduł).
  - Documentation & references (MUST):
    - update docs i wszelkich linków wewnętrznych w aplikacji (help/tooltips) pod nową lokalizację.
  - UX standard (MUST):
    - wejście w megatrendy w Tools ma wyglądać jak reszta Tools (ModuleHub / N-style, zgodnie z `docs/ui-standards/`),
    - nie wprowadzać nowego “starego D” patternu.
- OUT:
  - Rozbudowa samej analizy megatrendów (feature expansion) — post‑V2.
- Future enhancements (post‑V2):
  - Megatrends → auto-linkowanie do inicjatyw/risks (semi‑auto suggestions).
  - Megatrends → eksport bezpośrednio do deck/report (one click).

**UX / UI notes (grounded w codebase):**
- Obecnie Megatrends używa `MegatrendScannerModule` i jest renderowane w:
  - `src/views/ContextBuilder/ContextBuilderView.tsx` (section `megatrends`)
  - `src/views/OrganizationView.tsx` (section `megatrends`)
- V2: “source of truth” w Tools/Strategy, bez kopiowania logiki i store.

**Analytics (events/metrics):**
- `megatrends_opened` (source: tools|organization|context_redirect)
- `megatrends_redirect_used` (fromRoute)
- KPI: wzrost użycia po relokacji + spadek “where is megatrends” feedback.

**Risks:**
- Broken links (bookmarki, raporty) → redirect + testy e2e.
- Rozjazd nawigacji → jasne “canonical location” + jeden entrypoint w menu.

**Open questions:**
- W Organization: megatrends ma być:
  - (A) embedded (ten sam workspace w ramce),
  - (B) link do Tools/Strategy (preferred dla spójności),
  - (C) oba (raczej nie, bo dubluje)?

**Definition of Done (DoD):**
- Megatrends są dostępne w Tools → Strategy (kanonicznie) bez utraty funkcji.
- Stare linki działają (redirect lub moved banner) i nie ma dead-endów.
- Nie ma duplikacji logiki: jeden workspace/component.

**Acceptance / test plan:**
- Test: user wchodzi na `/context/megatrends` → trafia do canonical megatrends w Tools (redirect) i widzi te same dane.
- Test: menu Tools → Strategy zawiera Megatrends i otwiera workspace.
- Test: brak regresji w Organization/Context (jeśli pozostaje shortcut).

**Rollout plan:**
- Najpierw canonical route + redirects, potem cleanup linków i docs.

---

## T065 — 🟢 team — Change Team Management – Competency Identification (taxonomy + requirements → initiatives)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Capability model foundation (for T043/T066/T067) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nie da się realnie planować składu “change team” i dowożenia inicjatyw bez:
- zdefiniowania **jakie kompetencje** są potrzebne,
- powiązania ich z pracą (initiative/task),
- oraz późniejszej analizy luk (T066).

**Cel (outcome, nie feature):**
Organization ma spójną, edytowalną taksonomię kompetencji (skills/capabilities) oraz możliwość oznaczania inicjatyw wymaganiami kompetencyjnymi — jako fundament do dopasowania zasobów (T043) i gap analysis (T066/67).

**Użytkownicy i scenariusze:**
- PMO/HR/Admin: definiuje katalog kompetencji (kategorie, poziomy) i standardy.
- Initiative Owner/PMO: przypisuje wymagane kompetencje do inicjatywy (requirements).
- Konsultant: widzi “co jest potrzebne” i buduje realistyczny plan obsady.

**Scope (V2)**
- IN:
  - One canonical competency model (MUST):
    - jeden model danych używany przez:
      - T043 (capability alignment / matching),
      - T066 (skills gap),
      - T067 (matching/allocations),
    - brak “drugiego równoległego słownika” w innych modułach.
  - Competency taxonomy (MUST):
    - kategorie (np. Strategy, Operations, Digital, Change, Finance),
    - kompetencje w kategoriach,
    - poziomy/skalowanie (np. 1–5 lub novice→expert) + opis poziomów.
    - org‑specific extensions (dodawanie własnych kompetencji) + soft governance (kto może edytować).
  - Initiative requirements mapping (MUST):
    - możliwość dodania do inicjatywy listy wymaganych kompetencji:
      - kompetencja,
      - minimalny poziom,
      - liczba osób/FTE (opcjonalnie),
      - krytyczność (must‑have / nice‑to‑have),
      - uzasadnienie (krótko).
    - minimalny UX: “Add requirement” + tabela requirements (InlineTable).
  - Admin UX (N‑style, readability-first) (MUST):
    - ekran “Competency Catalog” w Admin/Team (lub analogicznym miejscu):
      - lista kategorii,
      - wyszukiwanie,
      - CRUD kompetencji,
      - definicja poziomów,
      - “usage” (w ilu inicjatywach kompetencja występuje) — jeśli proste.
    - UX bez legacy “D‑mode accordion”.
  - Permissions (MUST):
    - edycja katalogu tylko dla admin/HR/PMO (TBD role policy),
    - edycja requirements na inicjatywie zgodnie z permissions inicjatywy.
  - i18n (MUST):
    - nazwy systemowe kategorii/poziomów mają PL/EN,
    - org custom competencies: w V2 mogą być single-language (owner input) z opcją “EN label” (TBD).
- OUT:
  - Pełny “HR competency framework dla całej firmy” (performance review, learning paths, budżety szkoleń).
  - Automatyczne wnioskowanie kompetencji z CV (to T067).
- Future enhancements (post‑V2):
  - AI suggestions: proponuj kompetencje do inicjatywy na bazie opisu i historii.
  - Skill evidence (certyfikaty, projekty) i walidacja.

**Data / integrations (implementation-ready):**
- Nowe encje (nazwy robocze):
  - `competency_categories`
  - `competencies`
  - `competency_levels` (lub levels per org)
  - `initiative_competency_requirements`
  - (konsumowane dalej) `user_competencies` (T043/T067)
- Integracja:
  - Initiative UI: sekcja “Requirements / Competencies” (w Initiative detail, N‑style),
  - Admin UI: katalog i governance.

**UX / UI notes:**
- “Readability-first”:
  - above-the-fold: krótki opis + CTA “Add competency” / “Add requirement”
  - wymagania inicjatywy jako tabela + szybkie “missing” callout, gdy brak requirements.

**Analytics (events/metrics):**
- `competency_created` / `updated` / `deleted`
- `initiative_requirement_added` / `removed`
- KPI: % inicjatyw z wymaganiami kompetencji; spadek “missing skill surprises”.

**Risks:**
- Taksonomia: zbyt szczegółowa → chaos. V2: mały, kanoniczny katalog + org extensions.
- Spójność z CV/gap: musi używać tych samych kluczy kompetencji (ID-based, nie free-text).

**Open questions:**
- Skala poziomów: 1–5 vs novice/expert — w V2 proponuję 1–5 + opis.
- Minimalny zestaw kategorii systemowych (5–7) — do ustalenia.

**Definition of Done (DoD):**
- Da się zdefiniować katalog kompetencji (kategorie + kompetencje + poziomy) w org.
- Da się powiązać kompetencje jako requirements na inicjatywach.
- Te same dane są gotowe do wykorzystania w T043/T066/T067 (jeden model).

**Acceptance / test plan:**
- Test: Admin tworzy kategorię i 3 kompetencje + skala 1–5.
- Test: Initiative Owner dodaje 2 requirements do inicjatywy (must-have vs nice-to-have).
- Test: lista kompetencji pokazuje “usage count” (jeśli wdrożone) i nie ma duplikatów.

**Rollout plan:**
- Najpierw katalog + requirements na inicjatywach, potem integracja z matching/gap (T043/T066/67).

---

## T066 — 🟢 team — Skills Gap Analysis Module (requirements → availability → gaps → actions)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Capability alignment (T043) + change team readiness TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Plan transformacji bez gap analizy kompetencji jest nierealistyczny: inicjatywy startują bez krytycznych kompetencji, a braki wychodzą dopiero w execution (koszt, opóźnienia, frustracja).

**Cel (outcome, nie feature):**
System pokazuje luki kompetencyjne dla:
- pojedynczej inicjatywy,
- projektu/portfolio,
i prowadzi użytkownika od “brak” → “co z tym zrobić” (rekrutacja, szkolenie, vendor, resekwencjonowanie).

**Wymagane powiązania (must be consistent):**
- Requirements pochodzą z T065 (initiative competency requirements).
- Availability bazuje na:
  - manualnie zdefiniowanych kompetencjach użytkowników (T043/T067),
  - roli/funkcji w projekcie (pomocniczo),
  - oraz “unknown coverage” (system musi uczciwie pokazać brak danych).

**Użytkownicy i scenariusze:**
- PMO: sprawdza readiness projektu → widzi top 10 gaps i ryzyko delivery.
- HR: dostaje listę kompetencji do pozyskania (rekrutacja/szkolenie) z priorytetem.
- Initiative Owner: widzi “must-have gaps” i może:
  - poprosić o alokację,
  - przesunąć start,
  - stworzyć initiative “Enablement/Training”.

**Scope (V2)**
- IN:
  - Gap computation (MUST):
    - dla każdej inicjatywy:
      - required competency + level (+ opcjonalnie headcount/FTE),
      - available supply w zespole (przypisani członkowie projektu + pool org) (TBD),
      - wynik: status (covered / partial / missing / unknown).
    - agregacja na projekt/portfolio: heatmap i ranking braków.
  - UX (N‑style, readability-first) (MUST):
    - widok “Skills Gap” z trzema perspektywami:
      - by initiative,
      - by competency,
      - by person (co mamy / czego brakuje),
    - “unknown coverage” jako 1. klasa (Callout): “Nie mamy danych o kompetencjach X osób”.
  - Actionability (MUST):
    - z luki można utworzyć:
      - task (np. “Find SME for X”),
      - initiative “Enablement/Training”,
      - request do HR (ticket) (TBD minimal = task + label).
    - rekomendacje (heurystyczne, nie halucynacje):
      - hire / train / outsource / resequence.
  - Permissions (MUST):
    - tylko uprawnieni widzą kompetencje osób (wrażliwe),
    - wyniki agregowane mogą być widoczne szerzej (TBD polityka).
  - i18n (MUST): PL+EN dla UI.
- OUT:
  - Pełne planowanie szkoleń (budżety, ścieżki, certyfikacje).
  - Automatyczne skanowanie prywatnych komunikacji w celu oceny skills (zakazane).
- Future enhancements (post‑V2):
  - AI co-pilot do zamykania luk (plan działania, timeline, koszty).
  - Integracja z zewnętrznym HRIS/ATS.

**Data / integrations:**
- Reads:
  - `initiative_competency_requirements` (T065),
  - `user_competencies` (T043/T067),
  - membership (kto jest w projekcie/initiative) (istniejące project roles).
- Writes:
  - (opcjonalnie) `skills_gap_snapshots` dla historii i trendu (TBD).

**Analytics (events/metrics):**
- `skills_gap_viewed` (scope)
- `skills_gap_action_created` (type: task|initiative)
- KPI: % inicjatyw z covered must-have; spadek opóźnień “z zaskoczenia”.

**Risks:**
- Jakość danych: jeśli user competencies puste → dużo “unknown”. V2 musi to pokazać i prowadzić do uzupełnienia profili.
- Prywatność: skills mogą być wrażliwe → minimalizacja i role gating.

**Open questions:**
- Co jest “pool” availability w V2:
  - tylko zespół projektu, czy cała org? (proponuję: oba, z przełącznikiem)

**Definition of Done (DoD):**
- System pokazuje gaps w kontekście inicjatyw i umożliwia przejście do działań (task/initiative).
- Wyniki są transparentne (skąd supply/demand) i pokazują “unknown coverage”.

**Acceptance / test plan:**
- Test: inicjatywa ma requirement “Lean SME level 4” i nikt w projekcie nie ma → status “missing”, CTA tworzy task “find SME”.
- Test: 30% osób bez profilu kompetencji → system pokazuje Callout “unknown coverage” i link do uzupełnienia.

**Rollout plan:**
- Najpierw gap by initiative + ranking, potem heatmapy i agregacje portfolio.

---

## T067 — 🟢 team — CV‑Based Role and Task Matching Engine (privacy‑safe CV ingestion → competency mapping → explainable ranking)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Talent signals for capability model (T065/T066/T043) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Dobór ludzi do ról i zadań w transformacji jest dziś ręczny i podatny na “gut feeling”. CV i opisy doświadczeń to cenne dane, ale bez standaryzacji nie da się ich używać do dopasowania kompetencji do wymagań inicjatyw.

**Cel (outcome, nie feature):**
Użytkownik może:
- wgrać CV (lub profil doświadczeń) kandydata/członka zespołu,
- automatycznie zamapować sygnały z CV na **taksonomię kompetencji** (T065),
- otrzymać **ranking dopasowania** do ról/tasków/initiative requirements z jasnym uzasadnieniem,
z pełną kontrolą prywatności i brakiem automatycznych decyzji (human approval).

**Użytkownicy i scenariusze:**
- HR: wgrywa CV 5 kandydatów → widzi ranking do roli “Workstream Owner – Digital”.
- PMO: ma lukę “Lean SME level 4” → engine proponuje 2 osoby z org + 1 vendor (jeśli dodany) (TBD).
- Initiative Owner: przypina kandydata do roli/tasków po review uzasadnienia.

**Scope (V2)**
- IN:
  - CV ingestion (MUST):
    - upload CV (PDF/DOCX/TXT) + metadane (candidate name/email optional),
    - przechowywanie w systemie z polityką retencji i możliwością usunięcia,
    - status pipeline: uploaded → extracted → mapped → ready.
  - Extraction & normalization (MUST):
    - ekstrakcja tekstu + podstawowa normalizacja (sekcje: experience, skills, education),
    - PII handling:
      - redakcja/ochrona wrażliwych danych w logach i promptach,
      - minimalizacja danych przekazywanych do AI (tylko potrzebne fragmenty).
  - Competency mapping (MUST):
    - mapowanie na `competencies` z T065:
      - competencyId,
      - inferredLevel (1–5) + confidence,
      - evidence snippets (cytaty z CV),
    - zawsze możliwość ręcznej korekty i zatwierdzenia.
  - Matching engine (MUST):
    - wejścia:
      - initiative requirements (T065),
      - role/task requirements (TBD; V2 baseline = initiative requirements),
    - wyjście:
      - ranking kandydatów + score,
      - explainability (dlaczego, na czym oparte),
      - “missing evidence” (co trzeba doprecyzować).
  - UX (N‑style, admin‑grade) (MUST):
    - “Candidates / CV Library” (upload, lista, statusy),
    - “Candidate detail”:
      - extracted summary,
      - mapped competencies table (InlineTable) + edit,
      - matches (top initiatives/roles) + reasoning,
    - akcje:
      - “Apply competencies to user profile” (jeśli to pracownik),
      - “Shortlist” / “Invite”.
  - Guardrails (MUST):
    - brak automatycznego przypisania do roli/tasku bez zatwierdzenia,
    - zakaz inferowania cech chronionych (wiek, płeć, etniczność, zdrowie, religia itp.),
    - jawne disclaimers: “assistive ranking, not a hiring decision”.
- OUT:
  - Pełny ATS i proces rekrutacyjny end‑to‑end.
  - Background checks / scoring behawioralny.
- Future enhancements (post‑V2):
  - Integracja z ATS/HRIS.
  - Interview notes → competency evidence (za zgodą).

**Data / integrations:**
- Nowe encje (nazwy robocze):
  - `candidate_profiles` (lub `talent_profiles`)
  - `candidate_documents` (CV files metadata)
  - `candidate_competency_signals` (mapped results + evidence)
  - `candidate_match_results` (optional cache)
- Integracja z:
  - T065 (competencies registry),
  - T066 (skills gap → suggested candidates),
  - T043 (capability alignment: user profiles).

**Security / compliance (MUST):**
- Consent & governance:
  - jasna informacja o przetwarzaniu CV,
  - możliwość usunięcia (right to be forgotten),
  - audit log dostępu do CV profili.
- Storage:
  - szyfrowanie at-rest, ograniczenie dostępu (RBAC),
  - CV nie może “wyciec” do prompt logs.

**Analytics (events/metrics):**
- `cv_uploaded`
- `cv_extracted`
- `cv_competencies_approved`
- `cv_match_viewed` / `cv_match_applied`
- KPI: skrócenie czasu alokacji; trafność (feedback loop) (TBD).

**Risks:**
- Bias / compliance → twarde guardrails + explainability + human approval.
- Jakość ekstrakcji (różne formaty CV) → fallback do ręcznej edycji.

**Open questions:**
- Czy V2 ma obsłużyć tylko CV osób “z organizacji”, czy też zewnętrznych kandydatów/vendorów? (proponuję: oba, ale z wyraźnym tagiem external)

**Definition of Done (DoD):**
- Można wgrać CV, system wyciąga treść i mapuje kompetencje do T065.
- Można zobaczyć ranking dopasowania do initiative requirements z uzasadnieniem i zastosować (po zatwierdzeniu).
- Privacy/guardrails działają: brak automatycznych decyzji, brak inferencji cech chronionych, audit dostępów.

**Acceptance / test plan:**
- Test: upload 1 CV (PDF) → extracted → mapped (min 5 kompetencji) → manual approve → pojawia się w rekomendacjach do inicjatywy z requirementem.
- Test: CV zawiera dane wrażliwe → nie są one pokazywane w “reasoning” ani logach; system używa tylko fragmentów dot. doświadczenia/skills.

**Rollout plan:**
- Najpierw ingestion + competency mapping, potem matching do initiative requirements, potem integracja z gap view (T066).

---

## T068 — 🟢 onboarding — Onboarding and Platform Introduction System (Help Module) (“first 30 minutes” path)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Activation & retention foundation TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Platforma jest szeroka. Bez prowadzenia “pierwsze 30 minut” rośnie churn, support i poczucie chaosu (“nie wiem od czego zacząć”).

**Cel (outcome, nie feature):**
Nowy użytkownik ma jasno wytyczoną ścieżkę do pierwszej wartości (time‑to‑first‑value) i może wrócić do onboardingu w dowolnym momencie z poziomu Help.

**Użytkownicy i scenariusze:**
- Owner (trial): chce szybko zrozumieć “co to jest” i “jak to użyć” → przechodzi guided path.
- Konsultant: dostaje skrót “jak prowadzić pierwsze warsztaty / discovery tools”.
- PMO: widzi checklistę “jak uruchomić program transformacji”.

**Scope (V2)**
- IN:
  - Onboarding playbooks in Help (MUST):
    - 3–5 ścieżek (minimum):
      - “First 30 minutes (Owner/Trial)”,
      - “Consultant quickstart”,
      - “PMO quickstart”,
    - każda ścieżka ma:
      - kroki (checklist),
      - linki deep‑link do modułów,
      - krótkie “what you’ll get” + expected time per krok.
  - In‑app entrypoints (MUST):
    - stały entrypoint do Help/onboardingu (floating widget lub side panel),
    - CTA po pierwszym logowaniu: “Start onboarding” (dismissible).
  - Progress tracking (MUST):
    - status kroków per user (not started / in progress / done),
    - “resume where you left off”,
    - event logging (korzysta z istniejących `help_events`).
  - Content standard (MUST):
    - copy premium, krótko, bez “manuala”,
    - N‑style readability: małe bloki, jasne CTA, zero ścian tekstu.
  - i18n (MUST): PL + EN dla “First 30 minutes”; kolejne ścieżki mogą być stopniowo.
- OUT:
  - Pełne kursy/certyfikacje, academy portal.
- Future enhancements (post‑V2):
  - Personalizacja ścieżki na bazie roli i zachowań.
  - Micro‑video per krok (powiązane z T073).

**Data / integrations:**
- Reuse:
  - `help_playbooks` (treści onboardingowe),
  - `help_events` (tracking progress),
  - UI: `FloatingHelpWidget`, `HelpSidePanel`, `GlobalHelpSearch`.

**Analytics (events/metrics):**
- `onboarding_started` / `step_completed` / `onboarding_completed`
- KPI: activation rate, time‑to‑first‑value, spadek pytań support w 1. tygodniu.

**Risks:**
- Utrzymanie aktualności contentu → proces aktualizacji i owners.

**Open questions:**
- Czy “First 30 minutes” ma prowadzić użytkownika do:
  - (A) Tools (szybkie wow),
  - (B) Initiative + Report (wartość biznesowa),
  - (C) Billing upgrade path (konwersja)?
  (V2: rekomenduję A→B, z eleganckim CTA do upgrade, bez agresji.)

**Definition of Done (DoD):**
- Help ma sekcję onboarding, łatwo dostępną.
- Użytkownik ma ścieżkę “First 30 minutes” z checklistą i zapisem postępu.

**Acceptance / test plan:**
- Test: nowy user widzi CTA onboarding, kończy min. 5 kroków, progress zapisany, może wrócić.
- Test: help events logują start i ukończenie kroków.

**Rollout plan:**
- Najpierw 1 ścieżka (Owner/Trial), potem kolejne role.

---

## T069 — 🟢 onboarding — Automated Feature News and Update Communication System (release notes → in‑app + email)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Product comms & adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy nie wiedzą “co nowe”, więc nie adoptują funkcji. Potrzebujemy lekkiego systemu release notes/news z dystrybucją.

**Cel (outcome, nie feature):**
Admin może opublikować update (news/release note), a użytkownicy dostają go:
- in‑app (notifications + feed),
- opcjonalnie email,
z historią i statusem “seen”.

**Scope (V2)**
- IN:
  - Update publishing (MUST):
    - wpis: title, body (rich text lub markdown), tags (module), importance (low/normal/high),
    - status: draft → published,
    - scheduling (TBD minimal: publish now; post‑V2: scheduled).
  - Distribution (MUST):
    - in‑app notification + “Updates feed” (lista),
    - email (jeśli skonfigurowany provider),
    - throttling/noise: max N / tydzień (TBD).
  - Seen tracking (MUST):
    - “mark as read” per user,
    - analytics open/click.
  - UX (MUST):
    - jedno miejsce “What’s new” (Help/Knowledge/Settings) (TBD, ale jedno),
    - kontekstowe linki do funkcji (“Try it now”).
- OUT:
  - Zaawansowana segmentacja, A/B testing, personalizacja.
- Future enhancements (post‑V2):
  - segmentacja per rola/org plan,
  - “learning nudges” (łączenie z AI nudges).

**Data / integrations:**
- Reuse jeśli możliwe:
  - `help_articles` jako “updates” category lub dedykowana tabela (TBD w implementacji),
  - `notificationService` + email service.

**Analytics (events/metrics):**
- `update_published`
- `update_opened` / `update_clicked`
- KPI: open rate, adoption feature usage po publikacji.

**Definition of Done (DoD):**
- Można opublikować update i dotrze do użytkowników in‑app i/lub email.
- Historia update’ów jest dostępna i można oznaczać jako przeczytane.

**Acceptance / test plan:**
- Test: admin publikuje update → user widzi notification + wpis w “What’s new” i może mark as read.

---

## T070 — 🟡 help — Rewrite Platform Overview Content (Help + Website + Landing Page) (“AI transformation system” narrative)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Positioning & conversion narrative TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Narracja produktu musi odzwierciedlać to, czym platforma jest naprawdę (system transformacji wspierany AI), a nie być odbierana jako “kolejne PMO narzędzie”. Bez tego spada konwersja na trial i rośnie rozjazd oczekiwań w onboardingu.

**Cel (outcome, nie feature):**
Jedna spójna, premium treść overview, gotowa do użycia w:
- Help,
- website,
- landing page,
bez rozjazdu przekazu i bez obiecywania rzeczy, których nie ma.

**Zakres (V2)**
- IN:
  - Message architecture (MUST):
    - one‑liner + 3 value props,
    - “how it works” (3–5 kroków),
    - “who it’s for” (3 persony),
    - “what you get” (deliverables: reports/decks/initiatives),
    - “why now” (AI + governance + execution),
    - proof points (tylko prawdziwe; jeśli brak → TBD).
  - Channelized variants (MUST):
    - Help version (bardziej instruktażowa),
    - Website/Landing version (bardziej sprzedażowa, ale nadal prawdziwa),
    - spójne słownictwo i claimy.
  - Review & governance (MUST):
    - checklist “no overpromise”,
    - wersjonowanie treści (TBD minimal: doc history w repo).
- OUT:
  - Pełny rebranding strony i design system marketingowy.
- Future enhancements (post‑V2):
  - Video overview (60–90s),
  - case studies library.

**Definition of Done (DoD):**
- Treść jest spójna, premium i opisuje realne capability platformy.
- Da się ją wkleić w 3 kanały bez zmiany sensu i bez sprzeczności.

**Acceptance / test plan:**
- Test: 3 kanały mają tę samą architekturę przekazu i nie zawierają funkcji, których brak w V2.

**Rollout plan:**
- Najpierw Help (onboarding), potem website/landing.

---

## T071 — 🟡 help — Connect Help Documentation to AI Context Engine (docs‑grounded answers + citations + update workflow)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI reliability & product truthfulness TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jeśli AI odpowiada “z głowy” o produkcie, rośnie chaos, brak zaufania i support load. AI musi odpowiadać konsekwentnie **zgodnie z dokumentacją** i w razie braku coverage uczciwie to komunikować.

**Cel (outcome, nie feature):**
AI w Consultify:
- korzysta z Help/Knowledge Base jako źródła prawdy dla pytań “jak działa produkt”,
- cytuje odpowiednie artykuły,
- a gdy docs są niepełne/stare — sygnalizuje brak i proponuje next steps.

**Scope (V2)**
- IN:
  - Retrieval → AI context injection (MUST):
    - dla zapytań “product/how‑to” AI pobiera kontekst z KB i dołącza do promptu,
    - kontekst obejmuje:
      - snippets/excerpts (limitowane znakami),
      - listę citations (KB1/KB2/KB3),
      - “systemInstructionAddon” z regułami korzystania z docs.
    - (grounded w codebase) wykorzystać istniejące `buildHelpDocsContext` (`server/src/services/ai/helpDocsContext.ts`).
  - Citation policy (MUST):
    - jeśli AI odpowiada o workflow/UI zachowaniu:
      - powinno dołączyć cytowanie KB itemów (gdzie to możliwe),
    - jeśli brak dopasowania w docs:
      - AI mówi “docs do not cover this yet” + proponuje “where to look / what to confirm”.
  - Contextual routing (SHOULD, V2 minimal):
    - wsparcie `moduleId` w retrieval (contextual articles),
    - mapowanie aktualnego modułu UI → `moduleId` (foundation pod T072).
  - Quality & safety (MUST):
    - guardrails przeciw halucynacjom product claims,
    - ograniczenia długości snippets (token control),
    - caching (krótki TTL) żeby nie obciążać KB.
  - Docs update workflow (MUST):
    - jasny proces “update docs”:
      - owner doc/sekcji,
      - review (human),
      - publikacja,
    - AI może sugerować “doc gap”, ale nie publikuje automatycznie bez review.
- OUT:
  - Automatyczne pisanie docs przez AI bez review.
- Future enhancements (post‑V2):
  - Doc freshness monitoring + “stale docs” alerts.
  - Doc coverage dashboard (które moduły mają braki).

**Data / integrations:**
- Knowledge base jest źródłem:
  - `KnowledgeBaseService.searchArticles`, `getContextualArticles`, `getArticleBySlug`,
  - linkowanie do `/docs/:category/:slug`.
- AI pipeline:
  - injection do system prompt / tool context,
  - zwrot citations do UI (żeby user mógł kliknąć).

**Analytics (events/metrics):**
- `ai_help_docs_retrieved` (count, moduleId, lang)
- `ai_help_docs_cited` (kbIds)
- KPI: spadek “AI gave wrong product answer”, spadek ticketów support.

**Risks:**
- Stale docs → AI będzie powielać stare info (potrzebny workflow i monitoring).
- Retrieval quality → złe dopasowania; V2 ogranicza scope do top 3–5 artykułów i daje fallback.

**Open questions:**
- Czy citations mają być widoczne w UI jako “Sources” panel zawsze, czy tylko gdy user kliknie? (proponuję: kompaktowy “Sources” chip)

**Definition of Done (DoD):**
- AI odpowiadając o produkcie potrafi odwołać się do KB i cytować.
- Jeśli docs nie pokrywają pytania, AI komunikuje brak coverage zamiast zgadywać.
- Mamy proces aktualizacji docs (kto, jak, kiedy).

**Acceptance / test plan:**
- Test: pytanie “jak wygenerować raport w Report Builder?” → AI zwraca kroki + citations [KB1..KB3].
- Test: pytanie o nieudokumentowaną funkcję → AI mówi, że docs nie pokrywają i wskazuje gdzie sprawdzić / jak doprecyzować.

**Rollout plan:**
- Najpierw AI Chat + Help citations, potem rozszerzenie na inne entrypointy (np. onboarding).

---

## T072 — 🟡 help — Context‑Sensitive Help Navigation (module → docs mapping + deep links)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Help UX + reduction of friction TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Nawet dobra dokumentacja nie pomaga, jeśli user nie trafia w odpowiednie miejsce. Potrzebujemy kontekstowego Help: “jestem w module X → pokazujesz docs X”.

**Cel (outcome, nie feature):**
Help otwiera się “na właściwej stronie” zależnie od aktualnego modułu, bez gubienia kontekstu pracy użytkownika.

**Scope (V2)**
- IN:
  - Module → docs mapping (MUST):
    - definicja mapowania:
      - route/moduleId → recommended category/article/playbook,
    - fallback: global search / getting started.
  - Entry points (MUST):
    - z każdego modułu szybki entrypoint “Help” (np. widget/panel),
    - “open help” przekazuje `moduleId`.
  - Deep links (MUST):
    - link do konkretnego artykułu/playbooka,
    - możliwość otwarcia w side panel bez zmiany route (preferowane).
  - Maintainability (MUST):
    - mapowanie jako config w repo (łatwo aktualizować),
    - testy (co najmniej sanity) na najważniejsze moduły.
- OUT:
  - Pełna personalizacja per rola i zachowania (post‑V2).

**Data / integrations:**
- Reuse:
  - istniejące komponenty Help (`FloatingHelpWidget`, `HelpSidePanel`, search),
  - `KnowledgeBaseService.getContextualArticles(moduleId, lang, ...)`,
  - T071: `moduleId` w retrieval.

**Analytics (events/metrics):**
- `help_opened` (moduleId)
- `help_contextual_article_opened`
- KPI: spadek global search, szybsze znalezienie odpowiedzi.

**Definition of Done (DoD):**
- Będąc w module X, Help otwiera rekomendowaną dokumentację X.
- Jeśli mapowania brak, user dostaje sensowny fallback (search/getting started).

**Acceptance / test plan:**
- Test: user wchodzi w Assessment/Initiatives/Reports → klik Help → otwiera się właściwa sekcja docs.

---

## T073 — 🟡 help — Contextual Micro‑Video Help System (30–45s micro-learning on first entry)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Activation & adoption via micro-learning TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy uczą się szybciej z micro materiałów (30–45s) osadzonych w workflow niż z długich instrukcji. Bez tego onboarding jest ciężki.

**Cel (outcome, nie feature):**
Przy pierwszym wejściu do kluczowego modułu user dostaje krótkie wideo “co tu robisz i jakie są 2–3 kluczowe akcje” z opcją pominięcia, a stan “obejrzane” jest pamiętany.

**Scope (V2)**
- IN:
  - Trigger (MUST):
    - “first time in module” (per user),
    - możliwość wyłączenia w settings (TBD minimal: “don’t show again”).
  - Playback UX (MUST):
    - nienachalny modal/popover,
    - autoplay = OFF (żeby nie irytować),
    - CTA: “Watch”, “Skip”, “Don’t show again”.
  - Video registry (MUST):
    - mapowanie moduleId → video URL + title + duration,
    - hosting: zewnętrzny link (np. unlisted) lub internal storage (TBD).
  - Tracking (MUST):
    - view started/completed/skipped,
    - stan per user zapisany (reuse help events lub user prefs).
- OUT:
  - Pełne kursy wideo i learning portal.
- Future enhancements (post‑V2):
  - micro-videos per feature, per role.

**Security / compliance:**
- wideo nie może ujawniać danych klientów; tylko demo content.

**Analytics (events/metrics):**
- `microvideo_prompt_shown` / `started` / `completed` / `skipped`
- KPI: completion rate, activation module usage.

**Definition of Done (DoD):**
- System potrafi pokazać micro-video przy pierwszym wejściu do modułu i zapamiętać stan “seen”.

**Acceptance / test plan:**
- Test: pierwsze wejście do Initiatives → prompt wideo; user skip → nie pokazuje ponownie.

---

## T074 — 🟠 education — Education Module – Platform Fundamentals Series (short, contextual learning library)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Education & self-serve adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Onboarding (T068) pomaga wejść, ale użytkownicy potrzebują też stałej, łatwej do odkrycia biblioteki “fundamentals” — krótkich materiałów, które budują pewność i samodzielność w użyciu platformy.

**Cel (outcome, nie feature):**
Użytkownik może w każdej chwili:
- wejść do Education → Fundamentals,
- znaleźć 5–12 krótkich materiałów (wideo + “what to do next”),
- odpalić je kontekstowo z modułów (Help/Education entrypoints),
bez szukania po supportach.

**Użytkownicy i scenariusze:**
- Nowy user: “jak działa platforma i gdzie kliknąć” → Fundamentals playlist.
- Użytkownik wracający: “jak wygenerować raport/presentation” → szybki materiał + deep link do funkcji.
- Konsultant: “jak poprowadzić pracę: tools → initiative → report/deck” → struktura ścieżki.

**Scope (V2)**
- IN:
  - Fundamentals series content (MUST):
    - minimum 5 materiałów “platform fundamentals” (PL+EN), np.:
      - Navigation & modules map,
      - Tools → outputs → initiatives,
      - Initiatives & execution basics,
      - Reports (T060) + Presentations (T058) basics,
      - Organization/Admin basics (team/billing),
    - każdy materiał ma:
      - tytuł + opis + duration,
      - “what you will learn” (3 bullet),
      - “do it now” CTA (deep link),
      - tagi (module).
  - Delivery surface (MUST):
    - dostępne w jednym, kanonicznym miejscu:
      - **Knowledge Base / Docs portal** (istnieje `KnowledgeBaseView` / `/docs`),
      - oraz jako wejście “Education” w aplikacji (może otwierać KB na właściwej sekcji).
  - Contextual entrypoints (MUST):
    - integracja z Help widget/panel:
      - “Education: Fundamentals” jako szybki skrót,
    - w modułach: przycisk “Learn” kieruje do właściwego materiału (mapowanie moduleId → video/article).
  - Tracking (MUST):
    - started/completed per user,
    - “resume / continue”,
    - reuse `help_events` (lub analogiczny event store) żeby nie budować drugiego systemu.
  - UX (N‑style, readability-first) (MUST):
    - playlist jako czytelne karty + progress,
    - zero długich ścian tekstu.
  - Content governance (MUST):
    - owner materiałów,
    - zasada aktualizacji: “video must match current product”.
- OUT:
  - Certyfikacja, testy, odznaki.
- Future enhancements (post‑V2):
  - role-based learning paths (PMO/Consultant/CFO),
  - “recommended next video” na bazie zachowań,
  - powiązanie z T069 (news → “learn what changed”).

**Data / integrations (grounded in codebase):**
- Wykorzystać istniejące struktury:
  - `KnowledgeBaseView` ma sekcję “Videos” (`VIDEO_TUTORIALS` w `src/config/videoTutorialsContent.ts`),
  - Help komponenty: `FloatingHelpWidget`, `HelpSidePanel`,
  - T072 (module → docs mapping) do kontekstowych skrótów.
- V2 minimal: zapełnić `VIDEO_TUTORIALS` o Fundamentals oraz przypisać `moduleId` dla routingu.

**Analytics (events/metrics):**
- `education_fundamentals_opened`
- `education_video_started` / `completed`
- KPI: completion rate, spadek pytań onboardingowych, wzrost aktywacji kluczowych modułów.

**Risks:**
- Produkcja i aktualizacja wideo (time sink) → V2: krótka seria + prosty proces update.

**Open questions:**
- Czy Fundamentals w V2 hostujemy:
  - (A) zewnętrznie (unlisted) i embed,
  - (B) wewnętrznie w storage?
  (Proponuję A na V2 dla szybkości i stabilności.)

**Definition of Done (DoD):**
- Fundamentals series jest dostępna w aplikacji (Education entrypoint) i w KB, z kontekstowymi linkami.
- Co najmniej 5 materiałów (PL+EN) ma tracking progress.

**Acceptance / test plan:**
- Test: user otwiera Education → Fundamentals → startuje wideo → status “started” zapisany.
- Test: po ukończeniu 2 materiałów progress jest widoczny; “resume” działa.
- Test: z modułu Reports klik “Learn” → otwiera właściwy Fundamentals materiał.

**Rollout plan:**
- Najpierw 5 materiałów fundamentals + entrypointy, potem rozbudowa biblioteki.

---

## T075 — 🟠 education — Education Module – Change Management Foundations (methodology + best practices embedded in platform flow)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Adoption quality & change discipline TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Sama platforma nie wystarczy — żeby transformacja dowiozła, użytkownicy muszą rozumieć change management: governance, komunikację, pracę ze stakeholderami, opór, rytm informacji. Bez tego rośnie chaos w execution i spada ROI.

**Cel (outcome, nie feature):**
Użytkownik przechodzi przez “Change Foundations” i:
- rozumie minimalny standard prowadzenia zmiany,
- potrafi przełożyć wiedzę na konkretne działania w platformie (inicjatywy/tasks/komunikacja/RAID),
- podnosi jakość realizacji inicjatyw (mniej niespodzianek i reworku).

**Użytkownicy i scenariusze:**
- PMO: “jak ustawić governance i rytm komunikacji” → lekcje + gotowe checklisty.
- Change manager: “jak pracować z oporem i sentymentem” → lekcje + powiązanie z T044/T045.
- Sponsor: “co jest moją rolą w zmianie” → executive mini-track (TBD).

**Scope (V2)**
- IN:
  - Change Foundations track (MUST):
    - 6–10 krótkich modułów (wideo + tekst), minimum tematy:
      - Change basics: roles, governance, cadence,
      - Stakeholders & comms plan,
      - Resistance & sentiment (privacy-first),
      - RAID discipline,
      - Execution rhythms (status, gates, escalation),
      - “Closure”: jak kończyć inicjatywy i utrwalać zmianę,
    - każdy moduł:
      - “what you learn” (3 bullets),
      - “do it now” (deep link do funkcji),
      - checklist / template (np. comms plan checklist).
  - Embedded learning in workflow (MUST):
    - kontekstowe entrypointy z modułów:
      - T044/T045 (sentiment/communications) → link do odpowiednich lekcji,
      - Initiatives/Execution → lekcje o governance/cadence,
    - po lekcji: “apply in platform” (np. utwórz comms plan, dodaj stakeholderów) (V2 minimal = deep link + checklist).
  - Surface (MUST):
    - kanonicznie w Education/KB (jak T074),
    - wspólna nawigacja i tracking progress.
  - Tracking (MUST):
    - started/completed,
    - resume,
    - reuse `help_events` / `VIDEO_TUTORIALS` (bez budowy osobnego systemu).
  - i18n (MUST):
    - minimum PL+EN dla całego tracka (bo to core).
- OUT:
  - Szkolenia na żywo, certyfikacja, egzamin.
- Future enhancements (post‑V2):
  - role-based variants (Sponsor track, HR track),
  - “practice mode”: mini-assignments z automatycznym sprawdzeniem artefaktów.

**Data / integrations (grounded in codebase):**
- Zasila `KnowledgeBaseView` → Videos/Docs:
  - wpisy w `src/config/videoTutorialsContent.ts` (Change Foundations),
  - mapowanie moduleId (T072) dla kontekstowych skrótów,
  - citations/AI grounding (T071): AI może odwołać się do tych materiałów przy pytaniach o change.

**Analytics (events/metrics):**
- `education_change_opened`
- `education_change_module_completed`
- KPI: completion rate + korelacja z jakością execution (mniej opóźnień/eskalacji) (TBD).

**Risks:**
- Jakość merytoryczna (musi być consulting-grade) + aktualizacja.

**Open questions:**
- Czy V2 traktuje Change Foundations jako:
  - (A) obowiązkowy “recommended first” dla PMO,
  - (B) opcjonalny?
  (Proponuję: recommended, nie blokujący.)

**Definition of Done (DoD):**
- Track Change Foundations jest dostępny w Education/KB, ma 6–10 modułów PL+EN, z deep linkami do platformy.
- Użytkownik widzi progress i może kontynuować.

**Acceptance / test plan:**
- Test: user kończy 3 moduły → progress zapisany; przy wejściu w T045 widzi link do “Stakeholders & comms” lekcji.
- Test: AI odpowiadając o comms plan (T045) potrafi zacytować właściwy materiał (T071 citations).

**Rollout plan:**
- Najpierw 6 modułów core, potem rozbudowa.

---

## T076 — 🟠 education — Education Module – Prompt Engineering and Advanced AI Usage (recipes for better outputs in Consultify)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: AI adoption quality (less frustration, better deliverables) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Jakość outputów AI zależy od umiejętności użytkownika: jak zada pytanie, jak poda kontekst, jak iteruje. Bez edukacji rośnie rozczarowanie (“AI słabe”), koszty (więcej promptów) i chaos w pracy z artefaktami.

**Cel (outcome, nie feature):**
Użytkownik potrafi skutecznie pracować z AI w platformie:
- używa kontekstu i referencji,
- prowadzi iteracje,
- robi “quality gates” (sprawdza grounding, nie halucynuje),
co skutkuje krótszym czasem do premium deliverable (inicjatywy/raporty/decki).

**Użytkownicy i scenariusze:**
- Konsultant: chce uzyskać sponsor-grade rekomendacje bez “przepychania” — używa gotowych recipes.
- CFO/PMO: chce analizy finansowej/ROI bez halucynacji — uczy się promptowania z citations i walidacją.
- Owner: ustawia “custom instructions” dla organizacji (ton, styl, język) i rozumie konsekwencje.

**Scope (V2)**
- IN:
  - Prompt Engineering track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “Context first”: jak wkleić/odwołać się do artefaktów z platformy,
      - “Ask for structure”: JSON/listy/tabele vs narracja,
      - “Iterate”: jak robić 2–3 kroki doprecyzowania bez kosztu chaosu,
      - “Grounding & citations”: jak wymuszać źródła (T071) i jak reagować na brak coverage,
      - “DoD prompting”: jak prosić o output, który spełnia DoD (inicjatywa/report/deck),
      - “Safety”: czego nie robić (PII, tajemnice, dane klientów).
  - Platform‑specific recipes (MUST):
    - gotowe przykłady promptów dopasowane do realnych modułów:
      - Tools (T019–T021): closure + inicjatywy,
      - Initiatives: charter + KPI/ROI (T046–T049),
      - Reports/Presentations (T060/T058): “outline → regenerate section”,
      - Help grounded Q&A (T071),
    - każdy recipe:
      - “goal”,
      - “best prompt”,
      - “what to include (context checklist)”,
      - “expected output shape”.
  - Where to use (grounded in product) (MUST):
    - odwołania do istniejących ustawień AI:
      - `AIInstructionsSettings` (custom instructions),
      - behavior/personality/response style,
    - instrukcja “jak ustawić org/user instructions bez psucia quality”.
  - Surface (MUST):
    - kanonicznie w Education/KB (jak T074/T075),
    - kontekstowo: link “Learn prompting for this module” z AI paneli (TBD minimal: link z Help).
  - Tracking (MUST):
    - started/completed + resume (reuse help events / KB videos).
- OUT:
  - Zaawansowany multi-week kurs i certyfikacja.
  - Budowa nowego edytora promptów jako feature (to osobne inicjatywy, jeśli kiedyś).
- Future enhancements (post‑V2):
  - “Prompt library” z kopiuj-wklej w UI (guardrailed),
  - org-level curated recipes per industry.

**Security / compliance (MUST):**
- “Do not paste secrets/PII” jako twardy fragment edukacji.
- Recipes nie mogą instruować obchodzenia RBAC ani eksportu wrażliwych danych.

**Data / integrations (grounded in codebase):**
- Edukacja hostowana przez:
  - `KnowledgeBaseView` → Videos (zasilane z `src/config/videoTutorialsContent.ts`),
  - powiązania moduleId (T072),
  - citations/grounding (T071) jako przykład i standard.
- Odwołania do istniejących komponentów settings AI (UI nie musi się zmieniać w T076).

**Analytics (events/metrics):**
- `education_prompting_opened`
- `education_prompting_completed`
- KPI: wzrost pozytywnego feedbacku na AI, spadek retry loops, spadek kosztu na deliverable (TBD).

**Risks:**
- Szybko zmieniające się AI funkcje → treści muszą być modularne i łatwe do aktualizacji.

**Open questions:**
- Czy recipes mają być w V2 tylko do kopiowania (text), czy też jako “one-click apply” do instrukcji AI? (proponuję: text + link do settings; apply post‑V2)

**Definition of Done (DoD):**
- Materiały Prompt Engineering są dostępne (PL+EN) i zawierają platform-specific recipes.
- Użytkownik potrafi znaleźć “jak lepiej pracować z AI” bez supportu, a treści są spójne z realnymi modułami.

**Acceptance / test plan:**
- Test: user wchodzi w Education → Prompt Engineering → widzi 6+ lekcji, kończy 2 → progress zapisany.
- Test: recipe “Report Builder” prowadzi do lepszego outputu (struktura, grounding) i odwołuje się do citations z T071.

**Rollout plan:**
- Najpierw 6 lekcji core + 10 recipes, potem iteracyjne uzupełnianie.

---

## T077 — 🟠 education — Knowledge Module – Core Consulting Tools Library (single source: purpose → how to use → outcomes → start)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Knowledge & credibility layer for Tools adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy (i potencjalni klienci) potrzebują “single source of truth” o narzędziach konsultingowych: po co to jest, kiedy użyć, co dostanę, jak wygląda wynik. Bez tego spada adopcja, a platforma wygląda jak zbiór przypadkowych funkcji.

**Cel (outcome, nie feature):**
Dla każdego core narzędzia konsultingowego użytkownik może szybko zrozumieć:
- **purpose** (po co),
- **when** (kiedy użyć),
- **how** (jak przejść przez narzędzie),
- **what you get** (outcomes),
i ma jedno kliknięcie do uruchomienia narzędzia w platformie.

**Użytkownicy i scenariusze:**
- Użytkownik w Tools: widzi listę narzędzi → klika “Learn” → karta narzędzia + wideo + CTA “Start”.
- Partner/sales: pokazuje bibliotekę jako dowód metodologii.
- Nowy user: trafia z onboardingu do “tool card” zamiast długiej instrukcji.

**Scope (V2)**
- IN:
  - Tool cards (MUST):
    - dla każdej pozycji w “core tools” (min. 10 strategic / 10 operational / 10 digital / 1 automation — zgodnie z katalogiem Tools):
      - krótki opis (1–3 akapity),
      - kiedy użyć + typowe pytania,
      - expected outputs (3–6 bullet),
      - przykładowy “definition of done” wyniku (krótko),
      - linki: “Start tool” + “See example output” (TBD minimal).
  - Video integration (MUST):
    - teaser/walkthrough video per tool (może być placeholder w V2, ale struktura musi wspierać),
    - spójny odtwarzacz (reuse `ToolVideoModal` / video surface w KB).
  - Navigation & discoverability (MUST):
    - kanoniczne miejsce w produkcie: Knowledge Base / Docs (narzędzia jako kategoria),
    - entrypointy:
      - z Tools hub/Tool picker: przycisk “Learn”,
      - z Help: link do biblioteki narzędzi,
      - opcjonalnie publicznie: `/tools` showcase jako marketingowa wersja (już istnieje).
  - Search (MUST):
    - narzędzia są przeszukiwalne (po nazwie, tagach, use-case).
  - i18n (MUST):
    - PL + EN dla kart narzędzi (minimum dla core listy).
- OUT:
  - Paywall / kursy / marketplace treści.
- Future enhancements (post‑V2):
  - “example outputs” generowane z demo data,
  - “recommended tools” per kontekst firmy.

**Data / integrations (grounded in codebase):**
- Reuse / starting point:
  - public showcase: `src/views/ToolsShowcasePage.tsx` + `src/data/toolEducationData.ts`,
  - video modal: `src/components/Education/ToolVideoModal.tsx`,
  - docs portal: `src/views/KnowledgeBaseView.tsx` + “Videos”/cards/overview surfaces.
- V2 decision: utrzymać **jedno źródło treści** (preferowane: KB/docs), a showcase publiczny korzysta z tych samych ID i odnośników (bez duplikacji opisów).

**UX / UI notes:**
- N‑style, readability-first: karta narzędzia ma mieć “what you get” above-the-fold + CTA “Start”.
- Bez legacy “D-mode accordion”.

**Analytics (events/metrics):**
- `tool_knowledge_opened` (toolId, source)
- `tool_knowledge_video_started` / `completed`
- `tool_knowledge_start_clicked`
- KPI: wzrost adoption narzędzi, spadek pytań “co to robi”.

**Risks:**
- Utrzymanie spójności między platformą i publiczną stroną `/tools` → jedno źródło treści + linkowanie.

**Open questions:**
- Czy w V2 wszystkie tool cards mają mieć wideo, czy część może mieć “coming soon”? (proponuję: top 10 ma wideo, reszta placeholder)

**Definition of Done (DoD):**
- Biblioteka narzędzi jest przeszukiwalna, spójna i dostępna w platformie.
- Każde core narzędzie ma kartę “purpose/how/outcomes” + CTA “Start tool”.

**Acceptance / test plan:**
- Test: z Tools hub user otwiera “Learn” dla 3 narzędzi → widzi kartę + CTA start → przechodzi do właściwego narzędzia.
- Test: wyszukiwarka KB znajduje narzędzie po nazwie i tagach.

**Rollout plan:**
- Najpierw core strategic tools + najczęściej używane, potem reszta katalogu.

---

## T078 — 🟠 education — Knowledge Module – Licensed Assessment Tools Library (DRD/SIRI/ADMA: methodology + trust + integration)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Licensed frameworks credibility & adoption TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Narzędzia licencjonowane (DRD/SIRI/ADMA) muszą być zrozumiałe metodologicznie, inaczej:
- użytkownik nie ufa wynikom (“skąd to się wzięło?”),
- źle interpretuje poziomy i scoring,
- nie umie przełożyć wyników na roadmapę/inicjatywy i raporty.
Potrzebujemy biblioteki wiedzy “why/how/what you get” dostępnej w kontekście pracy.

**Cel (outcome, nie feature):**
Użytkownik (enterprise/konsultant) ma komplet materiałów dla DRD/SIRI/ADMA:
- metodologia i interpretacja,
- wymagania dowodowe (evidence),
- typowe działania per poziom/luka,
- oraz integrację z flow platformy (assessment → report/deck → initiatives).

**Użytkownicy i scenariusze:**
- Konsultant: przed warsztatem otwiera “SIRI methodology” + “how to score” → prowadzi assessment spójnie.
- Klient enterprise: ogląda “what the result means” + “how to use in roadmap”.
- Reviewer: sprawdza czy evidence jest wystarczające dla danego poziomu.

**Scope (V2)**
- IN:
  - Licensed knowledge cards per framework (MUST):
    - DRD / SIRI / ADMA — każdy ma:
      - overview: cel frameworku, struktura (obszary/wymiary, skala),
      - scoring logic i interpretacja,
      - evidence standards (co jest dowodem, co nie),
      - common pitfalls (jak nie “przestrzelić” poziomu),
      - “what you get”: raporty, mapy, rekomendacje, inicjatywy.
  - Level/dimension guidance (MUST):
    - dla każdego poziomu/wymiaru:
      - pytania kontrolne,
      - przykłady,
      - sugerowane technologie/typowe praktyki,
    - (grounded in codebase) wykorzystać istniejące `src/services/assessmentKnowledge/*` jako bazę treści i zapewnić spójność z UI.
  - Contextual availability (MUST):
    - entrypointy z assessment UI:
      - “What does this level mean?” przy ocenie poziomu,
      - “Evidence examples” przy polu dowodów,
    - entrypointy z report builder / presentation generator:
      - “Methodology appendix” block dla raportu (T060) / deck (T058) (TBD minimal: linki, post‑V2: automatyczne wstawki).
  - Access control / licensing (MUST):
    - treści licencjonowane dostępne tylko dla uprawnionych planów/orgów,
    - jasne oznaczenia “Licensed content” + compliance note,
    - brak publicznej ekspozycji tych treści w `/docs` jeśli nie powinno być publiczne (policy: TBD, ale domyślnie “private in-app”).
  - i18n (MUST):
    - PL + EN dla overview i kluczowych fragmentów,
    - (jeśli treści licencjonowane mają ograniczenia językowe) — jawne w UI.
- OUT:
  - Akredytacje/certyfikacje, pełne szkolenia (academy).
- Future enhancements (post‑V2):
  - “Trainer mode” z prowadzeniem warsztatu krok-po-kroku,
  - więcej przykładów branżowych per sector.

**Data / integrations (grounded in codebase):**
- Reuse:
  - framework knowledge: `src/services/assessmentKnowledge/drdKnowledge.ts`, `siriKnowledge.ts`, `admaKnowledge.ts`,
  - framework structures: `src/services/drdStructure.ts`, `siriStructure.ts`, `admaStructure.ts`,
  - assessment forms: `src/components/assessment/tools/DRDForm.tsx`, `SIRIForm.tsx`, `ADMAForm.tsx`.
- Knowledge surfaces:
  - preferowane: in-app KnowledgeBaseView/Help panel w trybie “private KB” dla licensed content,
  - mapping moduleId (T072) dla kontekstowych linków.

**Security / compliance:**
- Licencje: twardy gating + audit dostępu.
- Disclaimers: “methodology guidance, not investment/legal advice”.

**Analytics (events/metrics):**
- `licensed_kb_opened` (framework, section)
- `licensed_kb_level_help_opened` (framework, dimension, level)
- KPI: completion materiałów, spadek pytań o metodologię, wyższa spójność scoringu (TBD).

**Risks:**
- Zależność od licencji/treści: co można publikować gdzie (public vs private) → wymaga decyzji policy.
- Aktualizacja treści przy zmianach w narzędziach → owner + proces.

**Open questions:**
- Czy licensed library ma być:
  - (A) wyłącznie in-app (private),
  - (B) częściowo public (overview) + gated detale?

**Definition of Done (DoD):**
- Każdy framework licencjonowany ma komplet “why/how/what you get” + interpretację scoringu + evidence standards.
- Treści są dostępne kontekstowo w assessment flow i zgodne z realnym UI.
- Gating licencyjny działa (brak ekspozycji nieuprawnionej).

**Acceptance / test plan:**
- Test: w SIRI assessment user klika “What does level 3 mean?” → widzi guidance + przykłady + suggested technologies.
- Test: user bez uprawnień → widzi informację o licencjonowaniu, brak dostępu do treści szczegółowych.
- Test: konsultant dodaje do raportu sekcję metodologii (min: link; target: block) i eksport działa.

**Rollout plan:**
- Najpierw DRD (najbardziej “kanoniczne”), potem SIRI, potem ADMA.

---

## T079 — 🟠 education — Education Module – Managing Initiatives in Transformation (lifecycle + governance + execution discipline)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Initiative lifecycle clarity & execution quality TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Bez zrozumienia lifecycle’u inicjatyw i governance ludzie używają platformy chaotycznie:
- statusy są “klikane” bez znaczenia,
- brakuje właścicieli, decyzji, rytmu,
- raporty nie są sponsor‑grade,
co obniża skuteczność transformacji (opóźnienia, rework, brak closure).

**Cel (outcome, nie feature):**
Użytkownik rozumie i stosuje w praktyce:
- lifecycle inicjatywy (od pomysłu do closure),
- stage‑gates i readiness (T033),
- dyscyplinę wykonania (T041/T040/T042),
oraz umie pracować “jak PMO/consultant” w module Initiatives/Execution.

**Użytkownicy i scenariusze:**
- PMO: wdraża standard “jak prowadzimy inicjatywy” w organizacji i egzekwuje rytm.
- Initiative Owner: wie co musi mieć, żeby przejść gate i wystartować execution.
- Zespół: wie jak pracować w taskach/decisions i jak zamykać pracę z evidence.

**Scope (V2)**
- IN:
  - Initiative lifecycle track (MUST):
    - 6–10 krótkich lekcji (PL+EN), minimum:
      - “What is an initiative (in this platform)” + definicja sukcesu,
      - statuses & lifecycle (draft → review → approved → executing → done),
      - stage‑gates: jak przechodzić i co to znaczy (T033),
      - ownership & stakeholders (RACI lite),
      - plan vs execution: jak czytać timeline/delay signals (T041),
      - RAID discipline: ryzyka, issues, actions (T040),
      - budget & resources: plan vs actual + alerty (T042),
      - closure: jak zamknąć inicjatywę (lessons learned, outcomes, next steps).
  - “Do it now” integration (MUST):
    - każda lekcja ma deep link do:
      - Initiatives/Execution/Benefits,
      - oraz checklistę “apply in platform”.
    - V2 minimal: deep link + checklist; post‑V2: guided wizard.
  - Best practices pack (MUST):
    - “golden rules” 10–15 zasad (krótko) np.:
      - 1 owner, 1 next action,
      - evidence for claims,
      - decisions logged, not “in chat only”,
      - closure required,
    - “anti-patterns” (co psuje program).
  - Contextual entrypoints (MUST):
    - w Initiatives/Execution widoczny skrót “Learn: lifecycle & governance”,
    - z Help (T072) automatycznie podpowiada ten track, gdy user jest w Initiatives/Execution.
  - Tracking (MUST):
    - progress per user,
    - reuse `help_events` / KB videos.
- OUT:
  - Pełne szkolenie warsztatowe i certyfikacja.
- Future enhancements (post‑V2):
  - “PMO playbook mode” — checklisty compliance per initiative + auto‑flags.
  - Org policy: wymagane pola/gates per typ inicjatywy.

**Data / integrations (grounded in product):**
- Materiały hostowane jak T074/T075/T076:
  - `KnowledgeBaseView` + `VIDEO_TUTORIALS`,
  - mapowanie moduleId (T072),
  - citations/grounding (T071) dla pytań “jak przejść gate?”.
- Treści muszą być spójne z realnymi modułami:
  - Initiatives lifecycle, stage‑gate (T033),
  - execution timeline (T041),
  - RAID (T040),
  - budgets/resources (T042),
  - KPI/ROI mapping (T046–T049) jako “where to connect benefits”.

**Analytics (events/metrics):**
- `education_initiatives_opened`
- `education_initiatives_module_completed`
- KPI: mniej błędów w governance, wyższy completion inicjatyw, mniej “stuck in draft”.

**Risks:**
- Zmiany w workflow → wymagana aktualizacja contentu (owner + proces).

**Open questions:**
- Czy track ma mieć osobny wariant “Sponsor (10 min)” (executive brief)? (proponuję: post‑V2)

**Definition of Done (DoD):**
- Track “Managing Initiatives” jest dostępny (PL+EN), spójny z realnym flow i ma kontekstowe linki z Initiatives/Execution.
- Użytkownik rozumie statusy, gates i best practices oraz potrafi zastosować je w platformie.

**Acceptance / test plan:**
- Test: user wchodzi w Initiatives → klik “Learn” → otwiera track; kończy 2 lekcje → progress zapisany.
- Test: lekcja o stage‑gates linkuje do realnego widoku/obszaru i nie obiecuje feature’ów których nie ma.

**Rollout plan:**
- Najpierw 6 lekcji core, potem rozszerzenie best practices i warianty roli.

---

## T080 — 🟠 education — Education Module – Financial Analysis and Modeling (read outputs + assumptions correctly, sponsor‑grade)
- Status spec: draft
- Link / ID (ClickUp): TBD
- Epic: Finance adoption quality (interpretation + governance) TBD
- Priorytet / V2 scope: V2

**Business challenge (problem):**
Użytkownicy muszą rozumieć wyniki finansowe i założenia, inaczej moduły Finance nie dowiozą wartości:
- błędna interpretacja wskaźników,
- mylenie projekcji z faktami,
- brak rozumienia powiązań (P&L/BS/CF),
- ryzyko “regulowanych” claimów (investment advice).

**Cel (outcome, nie feature):**
Użytkownik potrafi:
- czytać i interpretować outputs Finance (statements/ratios/insights/models),
- rozumieć assumptions i ich wpływ,
- tworzyć sponsor‑grade narrację (grounded) bez nadinterpretacji,
bezpiecznie i zgodnie z guardrails.

**Użytkownicy i scenariusze:**
- CFO/management: przegląda analizy i wie “co to znaczy” + “jakie są ryzyka danych”.
- Konsultant: prowadzi klienta przez wyniki i zamienia je na inicjatywy (T056/T046).
- PMO: korzysta z finansów do priorytetyzacji i governance.

**Scope (V2)**
- IN:
  - Finance fundamentals track (MUST):
    - 8–12 krótkich lekcji (PL+EN), minimum:
      - P&L vs Balance Sheet vs Cash Flow: co mierzą i jak się łączą,
      - data quality: okresy, waluta, normalizacja, mapping (T050/T049),
      - ratio families: liquidity/profitability/leverage/efficiency/growth (T051),
      - vertical/horizontal/trend analysis (T052),
      - assumptions & scenarios (T053/T054),
      - model consistency checks (Assets=Liabilities+Equity, ΔCash tie‑out) (T054),
      - valuation basics (DCF, comps) i ograniczenia interpretacji (T055),
      - “from insight to action”: jak przejść do initiative/ROI/KPI (T046–T049/T056),
      - reporting: jak pokazać to w raporcie/decku (T060/T058).
  - Platform‑specific walkthroughs (MUST):
    - “how to” pod UI:
      - import statements (T050) + mapping,
      - gdzie zobaczyć ratios/insights,
      - jak używać scenariuszy,
      - jak czytać walidacje,
    - deep linki do właściwych ekranów.
  - Guardrails & disclaimers (MUST):
    - jasne zasady:
      - brak rekomendacji inwestycyjnych / doradztwa regulowanego,
      - rozdzielenie “facts” vs “assumptions” vs “interpretation”,
      - jak komunikować niepewność i braki danych.
  - Surface (MUST):
    - kanonicznie w Education/KB,
    - kontekstowo w Finance/Economics (skrót “Learn: how to interpret this”).
  - Tracking (MUST):
    - progress per user (reuse help events / KB videos).
- OUT:
  - Doradztwo inwestycyjne, “buy/sell” recommendations, regulatory opinions.
- Future enhancements (post‑V2):
  - branżowe benchmark playbooks,
  - interaktywne ćwiczenia “spot the mistake” na modelu.

**Data / integrations (grounded in product):**
- Treści muszą być spójne z inicjatywami Finance:
  - T050–T057 (ingestion, ratios, analysis, budgeting, modeling, valuation, advisory),
  - UI istniejące: `src/components/Economics/FinancialAnalysisPanel.tsx`, `ExcelImportWizard.tsx` jako referencje UX.
- Knowledge surfaces:
  - `KnowledgeBaseView` + `VIDEO_TUTORIALS`,
  - mapowanie moduleId (T072) + citations (T071) dla pytań “co oznacza ten wskaźnik?”.

**Analytics (events/metrics):**
- `education_finance_opened`
- `education_finance_module_completed`
- KPI: mniej błędnych interpretacji (feedback), większa adopcja Finance.

**Risks:**
- Odpowiedzialność / compliance → mocne disclaimers i język “assistive, grounded”.
- Zmiany w module Finance → update treści.

**Open questions:**
- Czy w V2 robimy 8 lekcji “core” + 2 walkthrough (import + valuation), czy pełne 12? (proponuję: 8 core + 2 walkthrough)

**Definition of Done (DoD):**
- Materiały Finance są dostępne w Education i kontekstowo w Finance.
- Użytkownik rozumie jak czytać outputs i assumptions, a treści mają disclaimers.

**Acceptance / test plan:**
- Test: user w Finance widzi skrót “Learn” → otwiera właściwą lekcję o danym obszarze (ratios/scenarios/valuation).
- Test: materiały wyraźnie rozdzielają facts/assumptions/interpretation i nie zawierają regulowanych rekomendacji.

**Rollout plan:**
- Najpierw 8 core lekcji + walkthrough import, potem rozszerzenie o valuation pack.

---

