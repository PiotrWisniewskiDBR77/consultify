# Macierz pokrycia pytań Wywiadu (M10) × 7 osi DRD

**Rejestr:** O5.6 (Oxford biblioteka promptów) · **Data:** 2026-07-18 (audyt) / 2026-07-19 (implementacja) ·
**Status:** DEC Piotra 07-19 „dopuść NOWE pytania do macierzy Wywiadu wg gotowego audytu, przyrostowo" —
29 nowych pytań wpięte przyrostowo w `server/migrations/20260719_interview_axis_gap_templates.sql`
(5 nowych szablonów `draft`, istniejące 270 pytań/29 szablonów NIETKNIĘTE). Szczegóły w §7.

## 0. Metoda i źródła

**Osie DRD (SSOT):** `src/services/drdStructure.ts` (kanoniczny model dojrzałości DBR77 — 7 osi × 5 obszarów
każda = 35 obszarów, każdy z 7-poziomową skalą 1–7). Ten sam model zasila `server/src/data/drdStructure.ts`,
`DRDForm.tsx`, `DRDMatrixSession.tsx`, macierze/heatmapy w Reports i Assessment.

**Bank pytań wywiadu (SSOT treści):** kod źródłowy migracji, nie żywa baza — patrz uzasadnienie niżej.
Cztery rodziny, w kolejności ruchu (traffic):

| # | Tabela / źródło | Rola | Szablony | Pytania | Status |
|---|---|---|---|---|---|
| 1 | `interview_question_templates` (`server/migrations/295_interview_context.sql`, treść nadpisana przez `20260703_interview_question_consultant_grade_rewrite.sql`) | **DOMYŚLNY bank** — kopiowany do KAŻDEJ nowej sesji wywiadu przez prostą ścieżkę „start session" (`InterviewController.ts`) | 1 (5 kategorii: strategy/operations/digital/people/finance) | 25 | **live, najwyższy ruch** |
| 2 | `interview_library_templates` — legacy 6 (`297_interview_library_templates.sql`) | Biblioteka szablonów do wyboru (manufacturing-first) | 6 (Operational Excellence, Digital Maturity Discovery, Cost & Efficiency, Data & Metrics, Standard Work, Quick Assessment) | 72 | live, `approved` |
| 3 | `interview_library_templates` — V6 (`669_v6_seed_system_templates.sql` + `665/667/668_v6_*`) | Rozszerzona biblioteka V6 (pulse-check → deep-dive), `area_tags` per szablon | 18 (T01–T18) | 111 | live, `approved` |
| 4 | `interview_library_templates` — draft (`298_interview_draft_templates.sql`) | 4 zaplanowane szablony, jeszcze niewalidowane | 4 (Automation Readiness RPA/AI, Voice of Employee/Change Readiness, CX/Service Blueprint, IT–Business Alignment) | 62 | **`draft` — NIE pokazywane domyślnie** |

**Razem: 29 szablonów, 270 pytań w kodzie** (25 + 72 + 111 + 62). Dodatkowo istnieje bilingwalny wariant
`lib-tpl-*__en` (`server/scripts/rewrite-en-system-templates.ts`, 5 pozycji) — ta sama taksonomia kategorii
co rodzina #2, nie wnosi nowych osi, pominięty w liczeniu żeby nie dublować.

**Dlaczego kod, nie żywa baza:** zgodnie z poleceniem sprawdzono PARITY (`localhost:5443`, kontener
`consultify-parity-pg18`, dump schematu z TROLLEY) — schemat obecny (`interview_library_template_questions`
istnieje), ale **0 wierszy** w obu tabelach (`interview_library_templates`, `interview_library_template_questions`)
i tylko 1 wiersz w `organizations`. PARITY to dump **schematu**, nie danych — seed startowy tych tabel nigdy
tam nie wjechał. Migracje SQL (idempotentne `INSERT OR IGNORE`/`ON CONFLICT`) SĄ więc jedynym realnym SSOT
treści — to one wgrywają się na demo/prod przez `DatabaseInitializer`, więc audyt treści z kodu jest
wiarygodny (w przeciwieństwie do audytu *stanu danych per organizacja*, gdzie kod ≠ żywa baza).

**Ograniczenie metody:** żadna z 276 pytań nie niesie taga osi DRD (`area_tags`/`category` to swobodna
taksonomia biznesowa: strategy/operations/digital/people/finance/it/data/pmo/procurement/sales/hr/
compliance/risk/customer-service — NIE `1A`…`7E`). Mapowanie pytanie→oś poniżej jest więc **jakościowe
(przez treść pytania)**, nie mechaniczne przez pole w bazie. Pokrycie oceniane na poziomie OSI (7 wierszy);
przy obszarze (5 na oś) tylko tam, gdzie treść pytania jednoznacznie wskazuje obszar — reszta oznaczona
jako nieweryfikowalna na tym poziomie ziarnistości.

## 1. Siedem osi DRD (referencja)

| Oś | Nazwa | Obszary (5) |
|---|---|---|
| 1 | Digital Processes | 1A Sales · 1B Marketing · 1C Process Tech & R&D · 1D Purchasing · 1E Logistics · 1F Production · 1G Quality · 1H Financial Mgmt · 1I HR *(9 obszarów — oś najszersza)* |
| 2 | Digital Products | 2A Digital Products · 2B Community-based Products · 2C ICT-based Products · 2D Product-Customer Alignment · 2E Product Scalability |
| 3 | Digital Business Models | 3A E-commerce · 3B Platform Solutions · 3C As-a-Service · 3D Asset Sharing · 3E Data Monetization |
| 4 | Data Management | 4A Data Collection · 4B Data Storage · 4C Data Communication · 4D Big Data Analysis · 4E Computing |
| 5 | Culture of Transformation | 5A Leadership Attitudes · 5B Readiness for Change · 5C Competency Development · 5D Innovation Culture · 5E Resource Availability |
| 6 | Cybersecurity | 6A Strategy & Risk Mgmt · 6B Network/System Protection · 6C Data Security · 6D Security Education · 6E Contingency Plans |
| 7 | AI Maturity | 7A Data & AI Foundations · 7B AI-Supported Processes · 7C AI in Products/Services · 7D Governance/Security/Ethics · 7E AI Competencies & Culture |

## 2. Macierz pokrycia (poziom osi)

| Oś | Pokrycie | Pytania (przykłady, id) | Ocena |
|---|---|---|---|
| **1. Digital Processes** | **MOCNE** | T05 Operational Excellence Discovery (7), T06 Process Pain Mapping (6), T07 Manufacturing Walkthrough (8), `itpl_operational_excellence_v1` (16), `tpl_operations_*` (domyślny bank, 5) — łącznie >45 pytań dot. procesów end-to-end, bottlenecków, automatyzacji kroków | Dominujący temat całego banku. Ale NIERÓWNE w 9 obszarach — patrz §3.1 |
| **2. Digital Products** | **BRAK** | 0 pytań wprost o cyfrowe produkty/usługi jako ofertę rynkową | Zero — bank pyta o *wewnętrzne* procesy, nigdy o *produkt* organizacji |
| **3. Digital Business Models** | **BRAK** | 1 wzmianka poboczna: `itq_cx_digital_2` „…CRM, helpdesk, **e-commerce**…" jako system, nie model biznesowy | Zero pytań o e-commerce/platformy/as-a-service/data monetization jako model przychodu |
| **4. Data Management** | **CZĘŚCIOWE** | T10 Data & Reporting Maturity (6, dedykowany), `itpl_data_metrics_v1` (11, dedykowany), `tpl_digital_2` (dostępność danych do decyzji), `itq_ar_digital_3` (jakość danych) | Dobrze pokryte 4A/4C (zbieranie, przepływ/integracja); 4B (storage), 4D (big data/analityka zaawansowana), 4E (computing/cloud jako infrastruktura) — słabo lub przez 1 pytanie |
| **5. Culture of Transformation** | **MOCNE** | T02 Leadership Alignment Pulse (6, dedykowany), T17 Change Readiness (6, dedykowany), `itpl_change_readiness_v1` (11, **draft**), `tpl_people_*` (domyślny bank, przepisany 2026-07-14 na consultant-grade) | Dobre pokrycie 5A/5B; 5C (competency dev) i 5E (resource availability) dotknięte pobocznie; **5D Innovation Culture — brak dedykowanego pytania** |
| **6. Cybersecurity** | **PRAKTYCZNIE BRAK** | **1 pytanie w całym banku**: `itq_dm_digital_5` „How do you manage identities/access and **data security** for operational systems?" | Zero pytań o strategię ryzyka cyber, ochronę sieci, edukację bezpieczeństwa, plany ciągłości/DR, zgodność (ISO 27001/NIS2/GDPR) — mimo że Consultify sam certyfikuje się na ISO 27001 |
| **7. AI Maturity** | **PRAKTYCZNIE BRAK** | **1 pytanie w całym banku, w szablonie DRAFT (niepublikowanym)**: `itq_ar_digital_4` „Are there **AI/ML** opportunities (document understanding, decision support, pattern recognition)?" | Zero pytań o fundamenty danych pod AI, governance/etykę AI, kompetencje/kulturę AI, AI w produktach — a to jedna z 7 osi kanonu i temat pozycjonowania Consultify |

**Wniosek jednym zdaniem (answer-first):** bank pytań wywiadu dobrze pokrywa 2 z 7 osi (Digital Processes,
Culture of Transformation) i częściowo 1 (Data Management), ale ma **trzy martwe osie — Digital Products,
Digital Business Models, Cybersecurity — oraz jedną niemal martwą — AI Maturity** (jedyne pytanie o AI leży
w szablonie `draft`, niewidocznym dla użytkownika), co oznacza, że żaden dzisiejszy wywiad nie wygeneruje
materiału dowodowego do wypełnienia tych osi w DRD Matrix bez ręcznego doboru pytań przez konsultanta.

## 3. Szczegóły i luki per oś

### 3.1 Oś 1 — Digital Processes (9 obszarów, nierówne pokrycie)

| Obszar | Pokrycie | Dowód |
|---|---|---|
| 1A Sales | częściowe | T15 Commercial Pipeline & Forecast (6) — pipeline, win rate, forecast accuracy, pricing |
| 1B Marketing | **brak** | zero dedykowanych pytań o digitalizację marketingu (kampanie, marketing automation, attribution) |
| 1C Process Tech & R&D | **brak** | zero — najbliżej `itq_ar_*` (automation readiness) ale to proces ogólny, nie R&D |
| 1D Purchasing | częściowe | T13 Working Capital (DPO, warunki płatności z dostawcami) — dotyka, nie dedykowane |
| 1E Logistics | częściowe | T13 (profil zapasów), T07 nie dotyczy logistyki wprost |
| 1F Production | mocne | T07 Manufacturing Walkthrough — OEE, maintenance, scrap, changeover, scheduling, safety |
| 1G Quality | mocne | T18 Quality/Compliance/Risk (6, ISO 9001/IATF, audyty, cost of quality) |
| 1H Financial Mgmt (digitalizacja) | częściowe | T11/T12/T13 pytają o *wyniki* finansowe, nie o *stopień digitalizacji* procesów finansowych (np. automatyzacja zamknięcia miesiąca, e-faktury) |
| 1I HR (digitalizacja) | częściowe | T16 Organization & Roles pyta o strukturę/role, nie o narzędzia HR (ATS, HRIS, digital onboarding) |

### 3.2 Oś 4 — Data Management

- 4A Data Collection — pokryte (T10, itpl_data_metrics_v1: źródła KPI, manualne logi vs. systemy)
- 4B Data Storage — **brak** dedykowanego pytania o architekturę przechowywania (data warehouse/lake, retencja)
- 4C Data Communication — pokryte (integracje systemów, single source of truth — T10, itq_dm2_digital_3)
- 4D Big Data Analysis — **brak** — zero pytań o analitykę zaawansowaną/predykcyjną, data science, modele
- 4E Computing — słabe — jedynie `tpl_digital_5` „Are you using any cloud services?" (ogólne, nie o mocy obliczeniowej/skalowalności)

### 3.3 Oś 5 — Culture of Transformation

- 5A Leadership Attitudes — mocne (T02 dedykowany)
- 5B Readiness for Change — mocne (T17, itpl_change_readiness_v1 draft)
- 5C Competency Development — częściowe (`tpl_people_4`, `itq_sw_people_1` onboarding — dotyka, nie mierzy systematycznie)
- 5D Innovation Culture — **brak** — zero pytań o eksperymentowanie, tolerancję na porażkę, budżet na innowacje, intrapreneurship
- 5E Resource Availability — częściowe (`itq_cr_finance_1` budżet na change management — wąskie, nie o zasobach ogólnie: czas, ludzie, narzędzia)

### 3.4 Osie 2, 3, 6, 7 — brak sensownego podziału na obszary

Przy zerowym/śladowym pokryciu całej osi, rozbijanie na 5 obszarów nie ma wartości diagnostycznej — patrz
§4 (rekomendacje) zamiast tabeli obszarów.

## 4. Rekomendacje — pytania-kandydaci per luka

Styl zgodny z doktryną repo (`20260703_interview_question_consultant_grade_rewrite.sql`): otwarte,
zakotwiczone w konkretnym przypadku/koszcie, z wbudowanym probe'em („Walk me through…", „Tell me about the
last time…", „What did that cost?"), zero zamkniętych tak/nie, zero gołej skali 1–5 bez kontekstu.
Proponowana kategoria (`category`) w nawiasie — do wpięcia jako nowy szablon lub rozszerzenie istniejącego.

### Oś 2 — Digital Products (proponowany nowy szablon: „Digital Product Portfolio")

1. *(strategy)* "Walk me through your current product or service portfolio — which parts are physical,
   which are digital, and which combine both? What is driving the shift toward more digital, if any?"
2. *(digital)* "Tell me about the last digital feature or product you shipped — what customer problem did
   it solve, and how do you know it solved it (usage data, feedback, revenue)?"
3. *(strategy)* "Which of your products or services could exist as a community/ecosystem play — customers
   interacting with each other, not just with you? What would need to be true to build that?"
4. *(operations)* "How do you validate that a new digital product feature actually fits what customers
   expect before you build it — and what was the last time that validation caught a wrong assumption?"
5. *(operations)* "If demand for your digital product tripled overnight, what would break first — the
   technology, the team, or the process? Walk me through why."

### Oś 3 — Digital Business Models (proponowany nowy szablon: „Digital Business Model Discovery")

1. *(strategy)* "What percentage of revenue today comes through a purely digital channel (e-commerce,
   online booking, app) versus traditional channels? How has that mix moved in the last 2 years?"
2. *(strategy)* "Do you operate — or have you considered — a platform model where you connect two sides of
   a market (buyers/sellers, providers/users) rather than selling directly? What stopped or started that?"
3. *(finance)* "Which of your offerings could be sold as a subscription or usage-based service instead of a
   one-time sale? What would you need to change operationally to do that?"
4. *(strategy)* "Do you share, rent, or pool physical assets with customers or partners instead of selling
   them outright anywhere in the business? Walk me through the closest example."
5. *(finance)* "Is there data you collect today that a customer or partner would pay for directly — even if
   you have never offered it as a product? What is stopping you from testing that?"

### Oś 6 — Cybersecurity (proponowany nowy szablon: „Cybersecurity & Resilience Baseline")

1. *(strategy)* "Walk me through your last formal cybersecurity risk assessment — who ran it, what did it
   flag, and what actually got fixed afterward versus what is still open?"
2. *(digital)* "Tell me about the last time you had a security incident or near-miss — what happened, how
   was it detected, and how long did it take to contain?"
3. *(digital)* "How is access to critical systems and data controlled today — single sign-on with role-based
   access, shared passwords, or something in between? Where are the weakest points?"
4. *(people)* "When did your team last go through security awareness training, and can you recall a
   concrete example of someone catching — or falling for — a phishing attempt since then?"
5. *(operations)* "If your core systems went down for 48 hours right now, what is the actual recovery plan —
   and when was it last tested for real, not just documented?"
6. *(compliance)* "Which security or data-protection standards (ISO 27001, NIS2, GDPR, industry-specific)
   apply to you, and where are you today against each — certified, in progress, or not started?"

### Oś 7 — AI Maturity (promować `itq_ar_digital_4` do live + dedykowany szablon „AI Readiness & Governance")

1. **Promocja:** przenieść pytanie `itq_ar_digital_4` z draftu (`itpl_automation_readiness_v1`) do banku
   domyślnego lub osobnego live-szablonu — dziś jedyne pytanie o AI w systemie jest niewidoczne dla usera.
2. *(digital)* "Walk me through any AI or generative-AI tool your team already uses day to day — what task
   does it actually replace or speed up, and how do you know it is working versus just novel?"
3. *(strategy)* "What decision in your business would most benefit from AI-assisted prediction or
   recommendation today — and what data would you need that you do not yet have in usable form?"
4. *(digital)* "Is the data you would feed into an AI system today clean and structured enough to trust —
   or would someone have to clean it up first? Walk me through the worst offender."
5. *(compliance)* "Who in the organization is accountable if an AI tool gives a wrong or biased
   recommendation that a person acts on — and has that scenario ever actually happened?"
6. *(people)* "How would you describe your team's comfort with AI tools — actively experimenting, curious
   but cautious, or resistant? What is one concrete example that shows it?"
7. *(strategy)* "Where could AI change what you sell, not just how you operate — i.e. an AI-powered feature
   or service customers would pay for? Has anyone explored that seriously?"

### Oś 1 (uzupełnienia — obszary słabe, nie cała oś)

- **1B Marketing:** "Walk me through how a marketing campaign gets planned, launched, and measured today —
  which parts are manual, and where do you lose visibility into what is actually working?"
- **1C Process Tech/R&D:** "Tell me about your last product/process improvement that came out of formal R&D
  versus one that came from someone's ad-hoc idea. What does that tell you about how R&D actually works here?"
- **1H Financial Mgmt (digitalizacja):** "Walk me through what happens between the last day of the month and
  closed books — which steps are automated, and which still depend on someone manually reconciling in Excel?"
- **1I HR (digitalizacja):** "Tell me about the last time you hired someone — which parts of onboarding were
  digital/self-service, and where did HR or the new hire have to chase paper or email?"

### Oś 4 (uzupełnienia)

- **4B Data Storage:** "Where does your operational data actually live today — one system of record, a
  patchwork of systems, or mostly spreadsheets? What is the plan, if any, to consolidate it?"
- **4D Big Data Analysis:** "Beyond standard reports, has anyone tried to find a pattern or predict an
  outcome from your data (e.g. predicting demand, churn, failure)? What happened when they tried?"

### Oś 5 (uzupełnienie)

- **5D Innovation Culture:** "Tell me about the last idea an employee — not a manager — proposed that
  actually got tried. What happened to it, and what does that outcome signal to the rest of the team about
  whether it is safe to suggest something new?"

## 5. Podsumowanie liczbowe

| Oś | Pytania dziś (jakościowo dopasowane) | Ocena |
|---|---|---|
| 1 Digital Processes | ~45+ (nierówno w 9 obszarach) | Mocne, do wyrównania w 1B/1C/1H/1I |
| 2 Digital Products | 0 | Krytyczna luka |
| 3 Digital Business Models | 0 (1 wzmianka poboczna) | Krytyczna luka |
| 4 Data Management | ~20 (nierówno w 5 obszarach) | Częściowe, luka w 4B/4D |
| 5 Culture of Transformation | ~25 (nierówno w 5 obszarach) | Mocne, luka w 5D |
| 6 Cybersecurity | 1 | Krytyczna luka |
| 7 AI Maturity | 1 (w draft, niepublikowany) | Krytyczna luka |

**Rekomendacja priorytetu:** jeśli budżet na nowe pytania jest ograniczony, kolejność wpięcia = 7 (AI —
rdzeń pozycjonowania produktu) → 6 (Cybersecurity — Consultify sam certyfikuje ISO 27001, niespójne nie
pytać o to klientów) → 2+3 (Digital Products/Business Models — razem, bo pytania się przenikają) → uzupełnienia
1B/1C/1H/1I i 4B/4D/5D.

## 6. Otwarte pytania dla Piotra

1. Czy nowe szablony osi 2/3/6/7 mają być osobnymi szablonami do wyboru (jak T01–T18), czy dopięte jako
   6. kategoria do istniejących szablonów (np. dodać `category: 'security'`/`'ai'` do T08 Digital Landscape)?
2. Czy promować `itq_ar_digital_4` (jedyne pytanie o AI) z `draft` do `approved` od razu, niezależnie od
   decyzji o nowym szablonie AI Maturity — szybka łatka na czas oczekiwania na pełny szablon?
3. Czy pytania powinny od razu nieść PL tłumaczenie (jak `lib-tpl-*__en`/`rewrite-pl-system-templates.cjs`),
   czy najpierw EN + walidacja treści, tłumaczenie w kolejnym kroku?

## 7. Implementacja 07-19 — decyzje robotnika + co wpięte

**DEC Piotra (07-19):** „dopuść NOWE pytania do macierzy Wywiadu wg gotowego audytu, przyrostowo" — zielone
światło na treść z §4, bez dalszych wytycznych co do 3 pytań z §6. Poniżej rozstrzygnięcie tych trzech pytań
przyjęte przez robotnika (bezpieczny/konserwatywny wariant, zgodny z „przyrostowo, zachowując istniejące"),
wraz z uzasadnieniem — jeśli któreś rozstrzygnięcie nie odpowiada intencji Piotra, jest odwracalne (nowa,
addytywna migracja `draft`→`approved` lub scalenie do istniejącego szablonu, bez dotykania tej migracji).

| # (z §6) | Rozstrzygnięcie robotnika | Uzasadnienie |
|---|---|---|
| 1. Osobne szablony vs. dopięte do istniejących | **Osobne, NOWE szablony** (5 sztuk, wszystkie `status='draft'`) | Zero ryzyka dla istniejących 29 szablonów/270 pytań i bieżących sesji Wywiadu; zgodne z konwencją rodziny #4 (`298_interview_draft_templates.sql`) — nowa, niewalidowana treść zawsze wchodzi jako `draft`, promocja do `approved` to osobna decyzja treściowa |
| 2. Promocja `itq_ar_digital_4` draft→approved | **NIE promowane w tej migracji** | Promocja całego `itpl_automation_readiness_v1` (żeby wypłynęło 1 pytanie o AI) opublikowałaby też 15 niepowiązanych pytań o automatyzację — to większa decyzja niż „dodaj nowe pytania", zostaje otwarta dla Piotra. Zamiast tego: nowe, równoważne pytanie o użycie AI dodane wprost w `itpl_ai_readiness_governance_v1` (`itq_aim_digital_1`) — oś 7 ma realne pokrycie bez ruszania istniejącego draftu |
| 3. PL od razu vs. EN najpierw | **EN only w tej partii** | Zgodne z tym, jak wystartowała rodzina #4 (`298`) — EN + walidacja treści przez konsultantów/Piotra najpierw, tłumaczenie PL (`rewrite-pl-system-templates.cjs`-owy wzorzec) jako osobny, następny krok po akcepcie treści |

**Co faktycznie wpięte:** `server/migrations/20260719_interview_axis_gap_templates.sql` — 5 nowych szablonów
(wszystkie `draft`, `visibility='global'`), **29 nowych pytań** w bibliotece Wywiadu, jeden-do-jednego z
kandydatami z §4 tego audytu (treść pytań nieedytowana względem propozycji audytu — tylko przypisanie do
konkretnych szablonów/kategorii/kolejności):

| Szablon | id | Oś DRD | Pytania |
|---|---|---|---|
| Digital Product Portfolio | `itpl_digital_product_portfolio_v1` | 2 | 5 (`itq_dp_*`) |
| Digital Business Model Discovery | `itpl_digital_business_model_v1` | 3 | 5 (`itq_bm_*`) |
| Cybersecurity & Resilience Baseline | `itpl_cybersecurity_baseline_v1` | 6 | 6 (`itq_cyb_*`) |
| AI Readiness & Governance | `itpl_ai_readiness_governance_v1` | 7 | 6 (`itq_aim_*`) |
| DRD Coverage Supplement (Axis 1/4/5) | `itpl_drd_axis_supplement_v1` | 1 (1B/1C/1H/1I) + 4 (4B/4D) + 5 (5D) | 7 (`itq_sup_*`) |

**Pokrycie po zmianie (jakościowo):** wszystkie 7 osi DRD mają dziś ≥1 dedykowany szablon/pytanie w banku
(dawniej: 3 osie zero, 1 oś prawie zero). Osie 2/3/6/7 pozostają `draft` (niepublikowane w domyślnym banku
sesji) do czasu redakcji/akceptu Piotra — to zamierzone, nie luka: nowa, niewalidowana treść konsultancka nie
wchodzi automatycznie do każdej nowej sesji Wywiadu.

**Dowód działania:** migracja pasuje do wzorca 297/298/669 (te same dwie tabele, `INSERT OR IGNORE`, pierwsza
kolumna `id` = PRIMARY KEY → poprawny fallback w `conflictTargets.ts` bez rejestracji), uruchomiona i
zweryfikowana end-to-end w izolowanym SQLite (zob. `server/src/__tests__/interviewAxisGapTemplates.e2e.test.ts`):
5/5 szablonów + 29/29 pytań się ładują, pogrupowane po osi DRD, wszystkie 7 osi mają ≥1 pytanie po migracji.
