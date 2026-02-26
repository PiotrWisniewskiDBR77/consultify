# Demo → Trial v3 — Language, Demo Dataset, Limits, Conversion, Telemetry (SSOT)

> **Status:** Draft (v3 SSOT)  
> **Cel:** opisać kanoniczny, “szczelny” system **DEMO** i **TRIAL** dla Consultinity:  
> - demo jako pełne dane + kontrolowane ograniczenia (AI + write),  
> - trial jako 7‑dniowy onboarding do płatnej wersji,  
> - spójny UX zachęcający do konwersji (bez nachalnego blokowania małych organizacji),  
> - telemetryka (SuperAdmin widzi starty demo/trial i conversion).

## 0) Powiązane źródła prawdy (MUST)

- Access policy (org types, trial duration, default limits): `server/src/services/access/AccessTypes.ts`
- Trial lifecycle: `server/src/services/trialService.ts`
- Demo mode API: `server/src/routes/demo.routes.ts` + `server/src/middleware/demoGuard.middleware.js`
- Demo session UX (as‑is): `src/hooks/useDemoSession.ts`, `src/components/demo/DemoSessionManager.tsx`
- Landing entry points (as‑is): `src/components/Landing/HeroSection.tsx`
- AI usage limits flow: `docs/flows/ai/AI_USAGE_LIMITS_FLOW.md`
- Billing UI warnings: `src/components/settings/modules/BillingSubscriptionModule.tsx`

---

## 1) Definicje (kanon)

### 1.1 DEMO

DEMO to **kontrolowana “firma demonstracyjna”** z pełnym zestawem danych przykładowych, uruchamiana w trybie “oglądam i eksperymentuję”:

- user jest zalogowany (co najmniej Google),
- user jest przełączony na organizację DEMO (lub ma overlay demo),
- dane są kompletne (projects/initiatives/tasks/decisions/reports/presentations/results/finance),
- system wprowadza twarde ograniczenia (AI i akcje destrukcyjne), żeby demo było bezpieczne i tanie.

### 1.2 TRIAL

TRIAL to **własna organizacja użytkownika** (jego dane), w której ma pełny onboarding i ograniczenia planowe:

- **czas**: 7 dni (v3 target; as‑is 14 dni w `TRIAL_DURATION_DAYS`)
- po wygaśnięciu: lockdown (read‑only) + CTA do upgrade
- limity funkcji/zasobów są jawne i komunikowane.

---

## 2) Entry points (UX) — co user widzi

### 2.1 Landing topbar: “Demo”

Przycisk “Demo” w landing/topbar otwiera **ładny modal**:

1) jeśli user nie jest zalogowany → logowanie (Google min.)  
2) wybór **języka demo** (bo dataset i przykłady muszą być w jego języku)  
3) “Start demo” → przełączenie na DEMO organization i uruchomienie demo session

**MUST:** copy “demo” nie może kłamać (as‑is w `HeroSection` jest “No signup required”, ale demo API wymaga tokena).

### 2.2 Banner: “Jesteś w DEMO”

W DEMO zawsze widoczny jest subtle banner:

- “Tryb demo • Firma: Atelier ToolToys • [Start trial]”
- licznik ograniczeń AI (np. “AI: 3/10 dziś”) i/lub “Session AI remaining”

### 2.3 Trial UX (7 dni)

W TRIAL:

- topbar/banner pokazuje **ile dni zostało** + CTA “Upgrade”
- w miejscach z limitami pokazujemy **soft warning** zanim odetniemy akcję.

---

## 3) Demo dataset (Atelier ToolToys) + 6 języków

### 3.1 Kanon datasetu

DEMO org = **Atelier ToolToys** (brand demo), z kompletnym zestawem:

- 1–3 projekty
- 8–15 inicjatyw (różne statusy, różne level)
- tasks + decisions + audit trail przykładowy
- Results: KPI + ROI (plan vs realized) z time‑series
- Reports + Presentations (przykładowe deliverables) z traceability “Open source”

### 3.2 Warianty językowe (6 języków)

Wymaganie v3: 6 języków aplikacji = 6 wariantów demonstracyjnych.

Preferowany mechanizm (żeby nie utrzymywać 6 kompletnie osobnych seedów):

- jeden “core dataset” (stabilne ID + liczby),
- warstwa tłumaczeń (title/description/labels) w tabelach `*_translations` lub w seed‑pakietach per locale,
- wybór języka w modalu demo ustawia:
  - language UI
  - “demo content locale” (które tłumaczenia ładować).

---

## 4) Limity i “szczelność” (DEMO vs TRIAL)

### 4.1 Demo — AI i write restrictions

DEMO ma być “pełne danych”, ale ograniczone:

- AI: limit interakcji (np. ~10/day) + token budget (as‑is: `DEFAULT_DEMO_LIMITS`)
- po przekroczeniu: komunikat “Przejdź na trial, aby korzystać z AI”  
  potem degraded mode: demo działa dalej, ale bez czata.

**MUST:** AI w demo ma *zachęcać* do trial, ale nie psuć zwiedzania aplikacji.

### 4.2 Trial — limity planu + 7 dni

TRIAL ma jasne limity (projekty, użytkownicy, storage, AI):

- jawne liczniki,
- ostrzeżenia (T‑7, T‑3) + banner,
- po wygaśnięciu: read‑only + CTA do upgrade.

**MUST:** limity muszą być egzekwowane centralnie (AccessPolicy), nie ad‑hoc w UI.

---

## 5) Konwersja Demo → Trial (MUST)

Konwersja to nie “przejście w menu”, tylko prowadzone UX:

- demo ma strategiczne momenty CTA (po zobaczeniu wartości: report generated, initiative created, etc.)
- w DEMO czat i banery mówią “Start trial” jako następny krok

W trial creation:

- user tworzy swoją organizację (nazwa, język, rola)
- dostaje 7 dni + onboarding

---

## 6) Telemetryka i SuperAdmin (MUST)

Wymagane eventy (minimum):

- `demo_started` (language, scenarioId?)
- `demo_mode_enabled` / `demo_mode_disabled`
- `demo_ai_limit_reached`
- `trial_started` (source=demo|landing|invite)
- `trial_expiry_warning_shown` (daysLeft)
- `trial_converted_to_paid`

SuperAdmin:

- lista uruchomień demo/trial (kto/kiedy/język/source)
- conversion rate i podstawowe statystyki.

---

## 7) Task extraction (do programu)

1) Demo modal: login gate + language selection + “start demo”
2) Demo dataset Atelier ToolToys + i18n warianty (6)
3) Demo AI limits + CTA to trial + degraded mode
4) Trial duration = 7 dni (config + UI copy + backend)
5) Telemetry + SuperAdmin view: demo/trial starts + conversion

