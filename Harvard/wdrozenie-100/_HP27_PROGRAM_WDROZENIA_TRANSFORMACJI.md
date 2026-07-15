# HP-27 — Program Wdrożenia Transformacji (PWT) jako komponent oferty DBR77

> Blok Harvey G. Dokumentacja wewnętrzna (GTM/framing), ZERO zmian w landing page/pricing w kodzie.
> Autor: robotnik floty, 2026-07-15. Weryfikacja: grep na żywym repo `wire-hp25-hp27` (baza `origin/demo`).
> Zasada tego dokumentu: **każde twierdzenie o zdolności ma cytat ze źródła** (plik/commit). Zero
> overclaim — jeśli czegoś nie znalazłem w kodzie, jest oznaczone jako "brak dziś" albo "proces
> usługowy DBR77, nie funkcja produktu".

## 1. Co to jest PWT (definicja robocza)

**Program Wdrożenia Transformacji** to nazwany, powtarzalny komponent oferty DBR77 obejmujący
uruchomienie klienta w Consultify jako część szerszego doradztwa transformacyjnego — analogicznie
do tego, jak firmy konsultingowe (McKinsey, BCG) sprzedają "implementation support" obok samej
rekomendacji strategicznej. Różnica od czystego SaaS-onboardingu: PWT łączy **zdolność produktu**
(gates, self-service, ingest wiedzy) z **usługą ludzką DBR77** (konsultant prowadzący klienta).

PWT ma 4 fazy. Poniżej każda faza: co produkt REALNIE ma dziś (z cytatem), co jest procesem
usługowym (człowiek, nie kod).

## 2. Faza 1 — Onboarding (uruchomienie)

### Co produkt ma dziś
- **Bramki cyklu życia organizacji**: `DEMO → TRIAL → PAID` — stałe w
  `server/src/services/access/AccessTypes.ts` (linie 6-8), z jawnymi limitami per typ
  (`DEFAULT_DEMO_LIMITS`, `DEFAULT_TRIAL_LIMITS`, `DEFAULT_PAID_LIMITS`) i stanami subskrypcji
  (`DEMO_ORG`, `DEMO_VIEW`, `TRIAL_ACTIVE`, `TRIAL_EXPIRING`, `TRIAL_EXPIRED`, `PAID_ACTIVE`...).
  To jest realny, kodowany "lejek wdrożenia" — nie trzeba go wymyślać, trzeba go NAZWAĆ w ofercie.
- **First-run wizard** (`src/components/Onboarding/FirstRunOnboarding.tsx`, komentarz w pliku:
  "polished first-run flow for new users (X4 / decision D22)") — 3 kroki: (1) powitanie/Teresa,
  (2) wybór roli → drzwi wejściowe (Chat/Tools/Assessment/Interview/Model finansowy),
  (3) próbka danych (Atelier Toys demo) vs "start od zera". Realnie wdrożony, nie koncept.
- **Rola-restrykcje pilotażu**: `isPilotRestrictedRole` (memory: `roleGuards.ts:54`) — USER/GUEST
  widzą `PILOT_LOCKED`, ADMIN/OWNER/PM/MANAGER/CONSULTANT zwolnieni. To daje produktowi wbudowany
  tryb "kontrolowany pilotaż z ograniczoną grupą ról" — dokładnie wzorzec konsultingowy
  "najpierw wąska grupa, potem cała organizacja".
- **Playbooki pomocy kontekstowe**: `server/seed/seedHelpPlaybooks.js` — realne, seedowane treści:
  `demo_mode_explained`, `start_trial_from_demo`, `invite_team`, `upgrade_to_paid`,
  `first_value_checklist` (klucze i18n potwierdzone grepem).

### Proces usługowy DBR77 (nie funkcja produktu)
- Warsztat startowy z konsultantem (definicja zakresu, ról, projektu pilotażowego) — to robi
  człowiek, produkt tylko dostarcza strukturę (projekt/inicjatywa — patrz Initiative Backbone,
  memory `project_initiative_backbone`).

## 3. Faza 2 — Migracja wiedzy klienta

### Co produkt ma dziś
- **Client Documents Vault**: `src/views/vault/ClientDocumentsVault.tsx` + ekstrakcja tekstu
  `server/src/services/documentTextExtractor.ts` (test: `server/tests/harvey-vault/
  documentTextExtractor.test.ts`) — realna zdolność wgrywania i indeksowania dokumentów klienta
  (DOCX/XLSX/PPTX, potwierdzone w handoffie nocnym 07-14/15: "Harvey c0e11ecf7e (agentRuntime+
  Workflow+Evidence+Vault)").
- **RAG na dokumentach współdzielonych/organizacyjnych** — potwierdzone istniejącym fixem
  `032073fb49 fix(rag): globalne (NULL-org) shared-knowledge docs retrievalne w ścieżce
  documentIds` — czyli mechanizm ingestii→retrieval realnie działa i jest utrzymywany.

### Uwaga o stanie
- Vault jest świeży (blok nocny Harvey, jeszcze **za flagą OFF** wg handoffu 07-15) — w ofercie
  PWT można nazwać "migrację wiedzy" jako zdolność **w rozwoju/rollout**, NIE jako w pełni ogólnie
  dostępną na dziś. Weryfikować flagę przed użyciem w materiale sprzedażowym.

## 4. Faza 3 — Szkolenie / adopcja

### Co produkt ma dziś
- First-run wizard (patrz Faza 1) pełni częściowo rolę szkolenia (wprowadzenie ról + Teresy).
- Playbooki pomocy (seedHelpPlaybooks.js) = biblioteka mikro-szkoleń kontekstowych, nie formalny
  kurs — realne, ale ograniczone zakresowo (dziś: demo/trial/invite/upgrade, nie pełny katalog
  narzędzi 12 Harvard).
- **Brak dziś**: brak dedykowanego modułu "Academy"/formalnej ścieżki certyfikacji użytkownika
  w kodzie (sprawdzone grepem — brak trafień na `academy`, `certification`, `training module`
  w `src/` poza help playbookami). Jeśli PWT ma obiecywać "szkolenie zespołu", to jest to DZIŚ
  usługa DBR77 (warsztat na żywo), nie funkcja self-service produktu.

## 5. Faza 4 — Hypercare (wzmożone wsparcie po starcie)

### Co produkt ma dziś (analog wewnętrzny, NIE customer-facing)
- Wzorzec monitoringu z **shadow pilotu wewnętrznego** (`docs/product/work-packets/
  V8_SINGLE_ORG_SHADOW_PILOT.md`): kadencja przeglądów (09:00/15:00/21:00 CET), bramki sukcesu
  z progami (np. "V8 error rate < 5% przez 7 dni"), evidence log dzienny. To jest metodyka
  DBR77 (inżynieryjna), pokazuje że firma UMIE prowadzić fazę intensywnego nadzoru — ale to
  NIE jest funkcja widoczna dla klienta w produkcie, to proces wewnętrzny do adaptacji.
- **Brak dziś**: brak w kodzie dedykowanego "customer hypercare dashboard" (health/adoption per
  organizacja widoczny dla klienta). To, co jest, to superadmin-level health/metrics
  (`/api/v8/admin/health`, `/api/v8/admin/metrics`) — wewnętrzne, nie klienckie.

### Rekomendacja
- Hypercare w PWT pozycjonować jako **usługę DBR77** (konsultant + dedykowany kanał wsparcia przez
  X dni po starcie), inspirowaną wewnętrzną metodyką shadow-pilot, ale NIE obiecywać klientowi
  dashboardu który dziś nie istnieje.

## 6. Pozycjonowanie względem SLA

- Istniejący dokument `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` (asystentka na landing page)
  ma explicit regułę: *"Never invent: numbers, customer logos, availability dates, contractual
  terms, pricing/SLA"* i *"Visitor asks for pricing/SLA/contract terms: refuse specifics; offer
  contact CTA"*. To potwierdza: SLA/pricing DZIŚ świadomie NIE jest publikowane wprost na stronie —
  jest kierowane do rozmowy sprzedażowej. **PWT powinien być pozycjonowany tak samo**: nazwany
  jako komponent oferty w materiałach sprzedażowych/ofertowych (nie automatyczny tekst na
  landing page), z konkretami (zakres, czas trwania, cena) ustalanymi w rozmowie/ofercie pisemnej,
  nie w kodzie produktu.
- SLA techniczne (workload classes, latency/budget) opisane w `docs/product/
  AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md` dotyczą SLA **wykonania AI** (per zapytanie),
  nie SLA **wdrożeniowego** (czas do produktywności klienta) — to różne warstwy, nie mylić w
  materiale sprzedażowym.

## 7. DRAFT sekcji do materiałów sprzedażowych (do redakcji Piotra — NIE wdrażać bez akceptu)

> **Program Wdrożenia Transformacji (PWT)**
> Konsultify nie jest zostawiany klientowi "z instrukcją". DBR77 prowadzi zespół przez
> ustrukturyzowany proces uruchomienia:
> 1. **Start kontrolowany** — pilotaż z ograniczoną grupą ról, pełne środowisko demo/trial przed
>    przejściem na produkcję.
> 2. **Migracja wiedzy** — istniejące dokumenty i materiały klienta trafiają do platformy
>    (indeksacja, wyszukiwanie kontekstowe) zamiast zaczynać od zera.
> 3. **Adopcja zespołu** — konsultant DBR77 prowadzi wdrożenie ról i pierwszych projektów;
>    platforma prowadzi użytkownika przez pierwsze kroki (kreator startowy, biblioteka pomocy).
> 4. **Wzmożone wsparcie po starcie** — dedykowany kanał kontaktu z DBR77 przez pierwsze tygodnie
>    produktywnej pracy.
>
> *(Uwaga redakcyjna: nie podawać liczby dni/tygodni ani ceny w materiale publicznym — to ustala
> się w ofercie per klient, zgodnie z istniejącą zasadą Anny na landing page.)*

## 8. Co NIE zostało zrobione (celowo, poza mandatem tego zadania)

- Nie zmieniano `PublicLandingPage.tsx`, `PricingLandingPage.tsx`, `AppPricingView.tsx` ani
  żadnego pliku landing/pricing — framing zewnętrzny to decyzja Piotra (zgodnie z poleceniem).
- Nie tworzono nowego kodu produktowego — to zadanie było czysto dokumentacyjne.

## 9. Źródła (do weryfikacji przy aktualizacji)

| Twierdzenie | Plik |
|---|---|
| Bramki DEMO/TRIAL/PAID | `server/src/services/access/AccessTypes.ts` |
| First-run wizard | `src/components/Onboarding/FirstRunOnboarding.tsx`, `useFirstRunOnboarding.ts` |
| Pilot-restricted role | memory `finding_m09_live_test_gates.md` → `roleGuards.ts:54` (zweryfikować ponownie, memory ma 24 dni) |
| Help playbooks | `server/seed/seedHelpPlaybooks.js` |
| Client Documents Vault | `src/views/vault/ClientDocumentsVault.tsx`, `server/src/services/documentTextExtractor.ts` |
| RAG shared-knowledge fix | commit `032073fb49` |
| Shadow-pilot metodyka (wewnętrzna) | `docs/product/work-packets/V8_SINGLE_ORG_SHADOW_PILOT.md` |
| Zasada braku SLA/pricing na landing | `docs/product/ANNA_LP_ASSISTANT_CONTRACT_V8.md` (linie ~91,118,132,162) |
| SLA AI (workload classes, inna warstwa) | `docs/product/AI_WORKLOAD_CLASSES_AND_SLA_ARCHITECTURE_V8.md` |
