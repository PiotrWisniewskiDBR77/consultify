# CONSULTINITY - System Specification

> **Version:** 1.0 | **Last Updated:** 2026-01-11 | **Status:** Source of Truth

---

## Table of Contents

1. [Vision & Philosophy](#1-vision--philosophy)
2. [User Model](#2-user-model)
3. [System Hierarchy](#3-system-hierarchy)
4. [Core Workflow](#4-core-workflow)
5. [AI System](#5-ai-system)
6. [Decision System](#6-decision-system)
7. [Tools Module](#7-tools-module)
8. [Reports System](#8-reports-system)
9. [MyWork - Personal Dashboard](#9-mywork---personal-dashboard)
10. [Integrations](#10-integrations)
11. [Enterprise & Compliance](#11-enterprise--compliance)
12. [Mobile & Languages](#12-mobile--languages)
13. [Onboarding](#13-onboarding)
14. [Help & Education](#14-help--education)
15. [Notifications](#15-notifications)
16. [Data Retention & GDPR](#16-data-retention--gdpr)
17. [White-label & Enterprise Tier](#17-white-label--enterprise-tier)
18. [Pricing & Licensing](#18-pricing--licensing)

---

## 1. Vision & Philosophy

### Mission Statement

> **"Kompletne pomysły biznesowe i transformacyjne powstają i są realizowane w jednym miejscu. STRATEGIA spotyka się z OPERACJĄ."**

### Core Concept

Consultinity to AI-powered platform dla **zespołów zmiany** (change teams), która:

- Zastępuje **zewnętrznego konsultanta** wiedzą ekspercką AI
- Wspiera **tworzenie dokumentacji** i realizację działań
- Pomaga w **podejmowaniu decyzji** z pełnym audit trail
- Łączy **perspektywę strategiczną z operacyjną**

### Target Market

| Segment              | Opis                                                              |
| -------------------- | ----------------------------------------------------------------- |
| **Primary**          | SMB & Mid-Market                                                  |
| **Team Size**        | 5-15 osób                                                         |
| **Project Duration** | 6-24 miesięcy + monitoring trwałości                              |
| **Use Case**         | Transformacja cyfrowa, optymalizacja procesów, zarządzanie zmianą |

### Two Modes of Operation

```
┌─────────────────────────────────────────────────────────────┐
│  TRYB PROJEKTOWY          │  TRYB NARZĘDZIOWY (Piaskownica) │
│  ─────────────────        │  ─────────────────────────────  │
│  Pełny workflow:          │  Standalone tools:              │
│  Context → Assessment →   │  • Bez pełnego workflow         │
│  Initiatives → Execution  │  • Projekt "Sandbox"            │
│  → Benefits               │  • Wyniki można przenieść       │
│                           │    do prawdziwego projektu      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. User Model

### 2.1 Application Roles

| Rola      | Widzi                          | Może                            | Ograniczenia                                        |
| --------- | ------------------------------ | ------------------------------- | --------------------------------------------------- |
| **Owner** | Wszystko + Organization module | Wszystko + billing              | Ma przypiętą kartę płatniczą                        |
| **Admin** | Dane o pracy w projektach      | Zarządza pracą, tworzy projekty | Opcjonalnie nie widzi Organization (Owner decyduje) |
| **User**  | Projekty do których należy     | Pracuje w projektach            | Nie widzi ustawień admina                           |

### 2.2 Project Roles

Role projektowe są **zgodne z wybranym standardem PMO** (konfigurowalne per organizacja/projekt).

**Wspierane standardy:**

| Standard        | Role                                                  |
| --------------- | ----------------------------------------------------- |
| **PRINCE2**     | Executive, Senior User, Project Manager, Team Manager |
| **PMBOK (PMI)** | Sponsor, PM, Team Lead, Team Member                   |
| **Agile/Scrum** | Product Owner, Scrum Master, Dev Team                 |
| **SAFe**        | RTE, Product Manager, System Architect                |
| **Custom**      | Definiowane przez organizację                         |

**Zasady:**

- Wybór standardu w Settings (per org lub per projekt)
- System abstrakcyjny - role mapowane na wybrany standard
- Możliwość elastycznej zmiany
- Role aplikacji i projektu są niezależne

### 2.3 Special Roles

#### Consultant

```
W APLIKACJI: Rola USER
W PROJEKCIE: Rola CONSULTANT

Zasady:
- Tylko Admin może wpuścić do projektu
- Nie płaci za seat
- Klient płaci za tokeny AI i storage consultanta
- Nie widzi danych innych klientów
```

#### Partner

```
Rola afiliacyjna - poleca klientów, dostaje prowizję

Zasady:
- Nie ma dostępu do danych klientów
- Widzi tylko przepływy związane z nim
- Rozliczenia zgodnie z Partner Portal
```

#### SuperAdmin (DBR77)

```
Maksymalne uprawnienia platformy

Zasady:
- Zarządza wszystkimi organizacjami
- Widzi metryki platformy
- Request Access flow do wejścia na konto klienta
- NIE ma emergency access bez zgody (GDPR)
- Pełny audit trail wszystkich działań
```

### 2.4 Request Access Flow (SuperAdmin)

```
1. SuperAdmin klika "Request Access" na organizacji
2. Owner/Admin dostaje notification
3. Owner/Admin akceptuje/odrzuca
4. Po akceptacji - SuperAdmin widzi dane jako Consultant
5. Pełny audit log
6. Opcjonalnie: automatyczne wygaśnięcie po X dniach
```

---

## 3. System Hierarchy

```
ORGANIZACJA
    │
    ├── LOKALIZACJE (0..n, opcjonalne)
    │       │
    │       └── PROJEKTY (1..n)
    │               │
    │               └── INICJATYWY (1..n)
    │                       │
    │                       └── TASKI (1..n)
    │                               │
    │                               └── DECYZJE (0..n, blokujące)
    │
    └── * Decyzje mogą być też na poziomie Projektu lub Inicjatywy
```

### Lokalizacje

| Typ               | Przykład                          |
| ----------------- | --------------------------------- |
| **Geograficzne**  | Warszawa, Kraków, Berlin          |
| **LUB Biznesowe** | Dział HR, Dział IT, Dział Finance |

**Nie można mieszać typów!**

**Wpływ lokalizacji:**

- ✅ Widoczność projektów i danych
- ✅ Filtrowanie raportów
- ❌ Billing (jeden na Ownerze)

### Przenoszenie elementów

```
✅ Inicjatywy można przenosić między projektami
✅ Taski można przenosić między inicjatywami
✅ Zmiana zespołu w trakcie projektu
✅ Pełny audit trail (kto, kiedy, co)
```

---

## 4. Core Workflow

### 4.1 Main Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GŁÓWNY PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. CONTEXT             2. ASSESSMENT          3. INITIATIVE GEN        │
│  ───────────────        ───────────────        ───────────────          │
│  │ Organization   │ →   │ Narzędzia      │ →   │ Drafty z      │        │
│  │ module         │     │ oceny          │     │ raportu       │        │
│  │ (kontekst)     │     │ dojrzałości    │     │ audytu        │        │
│  └────────────────┘     │                │     └───────────────┘        │
│                         │ → RAPORT       │            │                 │
│                         │   (produkt!)   │            ▼                 │
│                         │                │                              │
│                         │ LUB            │                              │
│                         │ PDF UPLOAD →   │                              │
│                         │ AI PARSUJE     │                              │
│                         └────────────────┘                              │
│                                                                          │
│  4. INITIATIVE PLANNING    5. EXECUTION         6. BENEFITS             │
│  ─────────────────────     ───────────────      ───────────────         │
│  │ Moduł Inicjatywy  │ →   │ Moduł        │ →   │ Moduł         │       │
│  │ - szczegóły       │     │ Executive    │     │ Benefits      │       │
│  │ - plan tasków     │     │ - harmonogram│     │ - KPI tracking│       │
│  │ - budżet          │     │ - realizacja │     │ - trwałość    │       │
│  │ - analiza zespołu │     │ - decyzje    │     │   wyników     │       │
│  └───────────────────┘     │ - PMO        │     │               │       │
│                            └──────────────┘     └───────────────┘       │
│                                                        │                │
│                                                        ▼                │
│                                                  7. ARCHIWUM            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Kluczowa funkcja: PDF → Roadmap

```
ZEWNĘTRZNY AUDYT (PDF)
        │
        ▼
┌───────────────┐
│ UPLOAD PDF    │
└───────┬───────┘
        │
        ▼
┌───────────────┐     ┌─────────────────┐
│ AI PARSUJE    │ ──► │ MAPA DROGOWA    │
│ DOKUMENT      │     │ (inicjatywy)    │
└───────────────┘     └─────────────────┘

⭐ SUPER WAŻNA FUNKCJA - audyt nie musi być robiony w aplikacji
```

### 4.3 Initiative Status Machine

```
STATUS            →    WIDOCZNY W                    AKCJE
──────────────────────────────────────────────────────────────────────────

DRAFT             →    Strategic Initiatives Board   Edycja, → PLANNING
                       (Generator) - karty inicjatyw

PLANNING          →    Strategic Initiatives Board   Completion checker,
                       - praca nad szczegółami       → REVIEW

REVIEW            →    Initiatives Module            Approval workflow,
                       - lista do przeglądu          → APPROVED

APPROVED          →    Initiatives + Roadmap         Timeline Q1-Q8,
                       - pojawia się na timeline     → EXECUTING

EXECUTING         →    Roadmap + Implementation      Kanban,
                       - nadal widoczna na timeline  → DONE/BLOCKED

BLOCKED           →    Implementation (alert 🔴)     → EXECUTING
                       - czerwony znacznik

DONE              →    Implementation → Benefits     KPI tracking
                       - ZNIKA z Roadmap

CANCELLED         →    Wszędzie z flagą             -

ARCHIVED          →    Tylko archiwum/raporty       -
```

### 4.4 Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INICJATYWA w statusie REVIEW                                   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────┐                    │
│  │  LEVEL 1: PM Review                      │                    │
│  │  - Sprawdza kompletność                  │                    │
│  │  - Może: Approve / Request Changes       │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │ (jeśli Approved)                           │
│                    ▼                                             │
│  ┌─────────────────────────────────────────┐                    │
│  │  LEVEL 2: Sponsor/Owner Approval         │                    │
│  │  - Strategiczna decyzja                  │                    │
│  │  - Może: Approve / Reject / Defer        │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │ (opcjonalnie, dla dużych)                  │
│                    ▼                                             │
│  ┌─────────────────────────────────────────┐                    │
│  │  LEVEL 3: Committee Vote (opcjonalne)    │                    │
│  │  - Dla inicjatyw > X budżetu            │                    │
│  │  - Voting: majority / unanimous          │                    │
│  │  - Deadline na głosowanie                │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │                                             │
│                    ▼                                             │
│            STATUS → APPROVED                                     │
│                                                                  │
│  REJECTION FLOW:                                                 │
│  - Request Changes → wraca do PLANNING                          │
│  - Reject → status CANCELLED z powodem                          │
│  - Defer → status DRAFT z datą ponownego review                 │
│                                                                  │
│  KONFIGURACJA (per Organization):                               │
│  - Ile poziomów approval (1-3)                                  │
│  - Próg budżetowy dla Committee                                 │
│  - Typ głosowania (majority/unanimous)                          │
│  - Timeout dla głosowania                                       │
│  - Auto-escalation po X dniach                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. AI System

### 5.1 AI Evolution Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI MATURITY JOURNEY                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FAZA 1: "SCEPTYK"         FAZA 2: "PARTNER"        FAZA 3: "AUTONOMIA" │
│  ─────────────────         ─────────────────        ─────────────────   │
│  • Firma nie wierzy        • Firma zaczyna ufać    • Pełne zaufanie    │
│  • AI nie zna firmy        • AI rozumie kontekst   • AI zna wszystko   │
│                                                                          │
│  AI ROBI:                  AI ROBI:                AI ROBI:             │
│  ✓ Doradza                 ✓ Sugeruje działania    ✓ Tworzy            │
│  ✓ Zachęca                 ✓ Przygotowuje          ✓ Wykonuje          │
│  ✓ Uczy się                ✓ Drafty dokumentów     ✓ Autonomicznie     │
│  ✓ Proponuje               ✓ Alerty                ✓ Pod kontrolą      │
│  ✓ Jasne alerty/zagrożenia                                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Zasada nadrzędna

> **UŻYTKOWNIK MA FAKTYCZNĄ I EMOCJONALNĄ KONTROLĘ**

- AI zawsze pyta/informuje przed działaniem
- Jasne alerty i zagrożenia
- User może "cofnąć" AI do wcześniejszej fazy
- Undo dla wszystkich akcji AI

### 5.3 Gdzie AI działa

| Miejsce         | Jak działa                             |
| --------------- | -------------------------------------- |
| **Narzędzia**   | Kontekstowo - pomaga w danym narzędziu |
| **Czat**        | Interaktywnie - pełna rozmowa z AI     |
| **Alerty**      | Proaktywnie - ostrzeżenia i sugestie   |
| **Podpowiedzi** | Inline - hints w UI                    |

### 5.4 AI zastępuje role

| Rola                      | Co AI przejmuje                            | Faza |
| ------------------------- | ------------------------------------------ | ---- |
| **Zewnętrzny Konsultant** | Wiedza ekspercka, best practices           | 1-3  |
| **User/Analityk**         | Tworzenie dokumentacji, realizacja działań | 2-3  |
| **Manager**               | Podejmowanie decyzji, delegowanie          | 3    |

### 5.5 AI Instruction & Learning System

```
BAZY INSTRUKCJI AI:
───────────────────

┌─────────────────────────┐    ┌─────────────────────────┐
│  SYSTEM-LEVEL           │    │  ORG-LEVEL              │
│  (Globalne)             │    │  (Per organizacja)      │
├─────────────────────────┤    ├─────────────────────────┤
│ • Best practices        │    │ • Kontekst firmy        │
│ • Industry knowledge    │    │ • Preferencje           │
│ • Framework templates   │    │ • Historyczne decyzje   │
│ • Common patterns       │    │ • Feedback użytkowników │
│ • Operator instructions │    │ • Custom instructions   │
└─────────────────────────┘    └─────────────────────────┘
```

### 5.6 Feedback Loops

```
USER          ADMIN          SUPERADMIN        SYSTEM
feedback  →   feedback   →   instructions  →   auto-learn

• Like/Dislike  • Override     • Global rules    • Patterns
• Corrections   • Adjustments  • New templates   • Success
• Suggestions   • Org rules    • Feedback review   metrics
```

### 5.7 AI Actions Configuration (Admin Settings)

```
AI AUTONOMY LEVEL:
───────────────────

[ ] AI może tylko sugerować (readonly)
[ ] AI może tworzyć drafty (do zatwierdzenia)
[ ] AI może wykonywać proste akcje (create task)
[ ] AI może wykonywać wszystkie akcje (full auto)

PER ACTION TYPE:
├── Create task:        [OFF / SUGGEST / DRAFT / AUTO]
├── Assign person:      [OFF / SUGGEST / DRAFT / AUTO]
├── Change status:      [OFF / SUGGEST / DRAFT / AUTO]
├── Send reminder:      [OFF / SUGGEST / DRAFT / AUTO]
├── Escalate decision:  [OFF / SUGGEST / DRAFT / AUTO]
├── Create document:    [OFF / SUGGEST / DRAFT / AUTO]
└── ...

AI PROPONUJE poziom na podstawie:
• Historii akceptacji
• Czasu reakcji użytkownika
• Feedback score

UNDO: ✅ Wszystkie akcje AI można cofnąć

REMINDERS (nie budżety):
• User ustawia własne limity
• System wysyła reminders przy zbliżaniu się
```

---

## 6. Decision System

> **"Serce systemu Consultinity"**

### 6.1 Struktura Decyzji

| Pole             | Wymagane | Opis                                    |
| ---------------- | -------- | --------------------------------------- |
| Tytuł            | ✅       | Krótki opis decyzji                     |
| Opis/Kontekst    | ✅       | Pełne wyjaśnienie                       |
| Typ              | ✅       | Go/NoGo, Approval, Resource Allocation  |
| Deadline         | ✅       | Kiedy potrzebna                         |
| Decision Maker   | ✅       | Kto decyduje                            |
| Stakeholders     | ○        | Kto jest informowany                    |
| Opcje do wyboru  | ○        | Tak/Nie lub Opcja A/B/C                 |
| Kryteria decyzji | ○        | Na podstawie czego                      |
| Attachments      | ○        | Dokumenty wspierające                   |
| Powiązanie       | ✅       | Task/Initiative/Project (gdzie blokada) |

### 6.2 Workflow Decyzji

```
1. UTWORZENIE
   • Każdy user może utworzyć request for decision
   • PM może utworzyć
   • AI automatycznie gdy wykryje blokadę

2. POWIADOMIENIE decision maker
   • Email
   • In-app notification
   • Push mobile
   • Slack/Teams

3. BRAK DECYZJI w deadline
   • Auto-escalation do wyższego levelu
   • Reminder do decision maker
   • Alert do PM/Admin
   • AI proponuje decyzję

4. PO PODJĘCIU DECYZJI
   • Task/Initiative odblokowane
   • Historia zapisana
   • Powiadomienie do requestera
   • AI uczy się z decyzji
```

### 6.3 AI i Decyzje

| Funkcja          | Opis                                                             |
| ---------------- | ---------------------------------------------------------------- |
| **Wykrywanie**   | AI wykrywa że coś stoi i sugeruje utworzenie Decision Request    |
| **Analiza**      | AI analizuje kontekst i sugeruje opcje                           |
| **Rekomendacja** | AI rekomenduje decyzję z uzasadnieniem                           |
| **Learning**     | AI uczy się trendów: "Ten decision maker zwykle wybiera X gdy Y" |
| **Predykcja**    | AI przewiduje ile zajmie decyzja                                 |

### 6.4 Widoczność Decyzji

| Widok                        | Co pokazuje                              |
| ---------------------------- | ---------------------------------------- |
| **MyWork**                   | Decyzje do podjęcia przez usera          |
| **Zarządzanie inicjatywami** | Decyzje blokujące inicjatywy             |
| **Dashboard PM**             | Wszystkie pending decisions w projekcie  |
| **Raporty**                  | Kto przeciąga prace (decision analytics) |

---

## 7. Tools Module

### 7.1 Assessment Tools (Ocena dojrzałości)

| #   | Narzędzie    | Źródło          | Opis                                  | Licencja     |
| --- | ------------ | --------------- | ------------------------------------- | ------------ |
| 1   | **SIRI**     | Złoty standard  | Smart Industry Readiness Index        | W negocjacji |
| 2   | **ADMA**     | Złoty standard  | Assessment Digital Maturity           | W negocjacji |
| 3   | **CMMI**     | Złoty standard  | Capability Maturity Model Integration | -            |
| 4   | **DRD**      | DBR77           | Własne narzędzie                      | DBR77        |
| 5   | **Lean 4.0** | DBR77 adaptacja | Lean + Industry 4.0                   | DBR77        |

### 7.2 Tools w rozwoju

| #   | Narzędzie                      | Opis                                |
| --- | ------------------------------ | ----------------------------------- |
| 6   | **Ocena ekonomiczna projektu** | Analiza finansowa projektu          |
| 7   | **Doradca AI**                 | Burza mózgów, rekomendacje narzędzi |
| 8   | **Schemat automatyzacji**      | Process flow → ROI → Inicjatywa     |
| 9   | **Studio**                     | Schematy blokowe, wykresy           |
| 10  | **A3 + PDCA**                  | Lean problem solving                |

### 7.3 Schemat automatyzacji - szczegóły

```
KROK 1: MALOWANIE PROCESU
• Drag & drop flowchart
• Kroki procesu

KROK 2: OZNACZANIE
• Co jest DECYZJĄ (romby)
• Co jest DZIAŁANIEM (prostokąty)

KROK 3: OPOMIAROWANIE
• Czas każdego kroku
• Koszt
• Quality metrics

KROK 4: OPTYMALIZACJA
• Identyfikacja nieefektywności
• Propozycje usprawnień
⚠️ NIE automatyzujemy nieefektywności!

KROK 5: SZUKANIE NARZĘDZI
• AI sugeruje narzędzia do wdrożenia
• Może być proste i tanie (kilka $)
• Może być własna prosta aplikacja
• Może być enterprise tool

KROK 6: ROI + TRANSFER DO PROJEKTU
• Kalkulacja ROI wdrożenia
• Generowanie planu działania
• → TRANSFER jako INICJATYWA do projektu
```

### 7.4 Projekt Piaskownica (Sandbox)

```
Dla pracy z narzędziami standalone:
• Bez pełnego workflow projektowego
• Wyniki można przenieść do prawdziwego projektu
• Idealny do eksperymentowania
```

### 7.5 Powiązanie Tools ↔ Tasks

```
✅ Prace z Tools można przypisywać do Tasków
✅ Task może mieć załączone wyniki z narzędzia
✅ Traceability: Tool output → Task → Initiative
```

---

## 8. Reports System

### 8.1 Typy raportów

| Raport                   | Kto generuje | Dla kogo            | Częstotliwość    |
| ------------------------ | ------------ | ------------------- | ---------------- |
| **Assessment Report**    | AI + User    | Owner, Stakeholders | Na żądanie       |
| **Initiative Status**    | System/AI    | PM, Sponsor         | Weekly           |
| **Project Status**       | System/AI    | PM, Owner           | Weekly/Bi-weekly |
| **Portfolio Overview**   | System       | Owner, Executive    | Monthly          |
| **Executive Summary**    | AI           | C-level             | On demand        |
| **Decision Log**         | System       | PM, Auditors        | On demand        |
| **Benefits Realization** | System/AI    | Owner, Sponsor      | Quarterly        |
| **Resource Utilization** | System       | PM, Admin           | Monthly          |
| **AI Activity Report**   | System       | Admin, SuperAdmin   | Monthly          |

### 8.2 Generator raportów

```
✅ Wzorce (templates) - gotowe do użycia
✅ Edycja wzorców - dostosowanie do potrzeb
✅ Tworzenie nowych - od zera
✅ AI pomaga przy każdym etapie
```

### 8.3 Format eksportu

| Format      | Status  | Priority |
| ----------- | ------- | -------- |
| In-app view | ✅      | P0       |
| PDF export  | ✅      | P0       |
| Public link | ✅      | P0       |
| PowerPoint  | 🔜 Soon | P1       |
| Word/DOCX   | 🔜 Soon | P1       |
| Excel       | 🔜 Soon | P1       |

### 8.4 Udostępnianie raportów

```
LINK Z HASŁEM + CZASOWY
├── Logo klienta
├── Logo Consultinity
├── Link do Consultinity z kodem promo
└── Expiry date

⭐ Element marketingowy!
```

---

## 9. MyWork - Personal Dashboard

### Co widzi user w MyWork

| Sekcja                  | Zawartość                         | Priorytet wyświetlania |
| ----------------------- | --------------------------------- | ---------------------- |
| **Moje taski**          | Assigned tasks, deadlines         | 1                      |
| **Decyzje do podjęcia** | Pending decisions gdzie jestem DM | 2                      |
| **Decyzje czekające**   | Moje requests czekające na innych | 3                      |
| **Moje inicjatywy**     | Gdzie jestem owner/contributor    | 4                      |
| **Kalendarz/Timeline**  | Upcoming deadlines                | 5                      |
| **AI Inbox**            | Sugestie od AI                    | 6                      |
| **Notifications**       | Activity stream                   | 7                      |

### Mobile-ready

```
⭐ MyWork MUSI działać dobrze na telefonie
⭐ Lean Audit - kluczowy (robiony w zakładzie!)
```

---

## 10. Integrations

### Priority Matrix

| Priority | Integracja                     | Po co                   |
| -------- | ------------------------------ | ----------------------- |
| **P0**   | Slack / Microsoft Teams        | Notifications + AI chat |
| **P0**   | Jira / Asana / Monday          | Task sync               |
| **P1**   | Google Workspace               | Docs, Calendar          |
| **P1**   | Microsoft 365                  | Docs, Calendar          |
| **P1**   | Cloud Storage (S3, Azure, GCS) | Dane do wykorzystania   |
| **P2**   | Salesforce / HubSpot           | CRM                     |
| **P2**   | ERP (SAP, Oracle)              | Dane finansowe          |
| **P2**   | Power BI / Tableau             | Dashboards              |
| **P2**   | Zapier / Make                  | Custom integracje       |

### Self-service import

```
✅ Drag & drop files
✅ CSV/Excel upload
✅ API bulk import
```

---

## 11. Enterprise & Compliance

### Status

| Wymaganie                 | Status    | Priority   |
| ------------------------- | --------- | ---------- |
| **SSO (SAML/OIDC)**       | Partial ✓ | P1         |
| **SCIM Provisioning**     | Partial ✓ | P1         |
| **Audit Log**             | ✓         | P1         |
| **Data Residency (EU)**   | ✓         | P1         |
| **GDPR compliance**       | ✓         | P1         |
| **Custom data retention** | ✓         | P1         |
| **SOC 2**                 | Planned   | P2         |
| **ISO 27001**             | Planned   | P2         |
| **IP whitelisting**       | Planned   | P2         |
| **Custom contracts/SLA**  | Available | Enterprise |

---

## 12. Mobile & Languages

### Mobile

| Status      | Opis                                         |
| ----------- | -------------------------------------------- |
| **Teraz**   | Mobile-ready (responsive web)                |
|             | MyWork musi działać dobrze na telefonie      |
|             | Lean Audit - kluczowy (robiony w zakładzie!) |
| **Później** | PWA                                          |
|             | Offline mode                                 |

### Multi-language

```
Gdy wprowadzamy język X:
✅ UI w języku X
✅ AI odpowiada w X
✅ Opisy w X
✅ Demo data w X
✅ Raporty w X
```

---

## 13. Onboarding

### Flow (Best Practice 2026)

```
STEP 1: SIGNUP (30 sec)
───────────────────────
• Email + Password (lub Google/Microsoft SSO)
• Imię
• Nazwa firmy
• Skąd o nas wiesz? (opcjonalne)

STEP 2: QUICK PROFILE (60 sec)
─────────────────────────────
• Wielkość firmy (1-10, 11-50, 51-200, 200+)
• Branża (dropdown)
• Główny cel (Assessment / Transformation / Both)
• Język preferowany

STEP 3: AI GREETING
───────────────────
• AI wita się osobiście
• Krótkie wyjaśnienie co potrafi
• "Jestem tu żeby Ci pomóc..."

STEP 4: CHOOSE YOUR PATH
────────────────────────
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  🎯 START       │  │  📊 EXPLORE     │  │  🔧 SANDBOX     │
│  ASSESSMENT     │  │  DEMO PROJECT   │  │  PLAY WITH      │
│  (recommended)  │  │  (see example)  │  │  TOOLS          │
└─────────────────┘  └─────────────────┘  └─────────────────┘

STEP 5: GUIDED FIRST ACTION
───────────────────────────
• Assessment → Mini-wizard do pierwszego pytania
• Demo → Tour po przykładowym projekcie
• Sandbox → Intro do narzędzi

STEP 6: CHECKLIST (persistent sidebar)
──────────────────────────────────────
□ Uzupełnij profil organizacji
□ Zaproś pierwszego członka zespołu
□ Ukończ pierwszy assessment
□ Wygeneruj pierwszą inicjatywę
□ Połącz Slack/Teams (opcjonalne)

GAMIFICATION:
• Progress bar (0% → 100%)
• "Unlock" kolejnych funkcji
• Celebration animation przy milestone
```

---

## 14. Help & Education

### System pomocy

| Element               | Status | Opis                                    |
| --------------------- | ------ | --------------------------------------- |
| **Help Center**       | ✅     | Artykuły z bazy wiedzy                  |
| **Tooltips**          | ✅     | Kontekstowe, można ukryć (15/30/60 dni) |
| **AI Help Chat**      | ✅     | AI odpowiada na pytania o aplikację     |
| **Video tutorials**   | ✅     | Nagranie dla każdego modułu             |
| **Ticket system**     | ✅     | Zgłoszenia do supportu                  |
| **Live chat support** | ❌     | Nie na start                            |

### Edukacja w trakcie pracy

```
⭐ Użytkownik ma być edukowany podczas pracy
⭐ Przed launch: nagranie dla każdego modułu
⭐ Baza wiedzy o narzędziach (SIRI, ADMA, Lean, etc.)
⭐ Podpowiedzi z przyciskiem "Ukryj na X dni"
```

---

## 15. Notifications

### Konfiguracja przez użytkownika

```
W Settings user sam wybiera dla każdego typu eventu:
├── In-app notification: ON/OFF
├── Email: ON/OFF
├── Push mobile: ON/OFF
└── Slack/Teams: ON/OFF
```

### Typy eventów

| Event                | Default: In-app | Default: Email |
| -------------------- | --------------- | -------------- |
| Nowy task assigned   | ✅              | ○              |
| Decision request     | ✅              | ✅             |
| Decision made        | ✅              | ○              |
| Deadline approaching | ✅              | ✅             |
| AI suggestion        | ✅              | ○              |
| Status change        | ✅              | ○              |
| Comment/mention      | ✅              | ✅             |
| Weekly digest        | ○               | ✅             |

---

## 16. Data Retention & GDPR

### Aktywny klient

```
• Dane przechowywane bezterminowo
• Wersjonowanie dokumentów (historia zmian)
• Backup: daily incremental + weekly full
```

### Po anulowaniu

```
• 30 dni grace period (można reaktywować)
• Po 30 dniach: dane zarchiwizowane
• Po 90 dniach: dane usunięte
• Klient może zażądać wcześniejszego usunięcia
```

### GDPR

```
✅ Export danych na żądanie
✅ Delete na żądanie
✅ Audit log retencja: 7 lat (compliance)
✅ Consent management
```

---

## 17. White-label & Enterprise Tier

### Standard (included)

```
✅ Logo klienta na raportach
```

### Enterprise (za dopłatą)

```
💰 Custom kolory UI
💰 Custom domena (CNAME + SSL)
💰 Custom email sender
💰 Pełne white-label raportów
```

---

## 18. Pricing & Licensing

### Model

```
RAPORT ASSESSMENT = wymaga zakupu:
├── Dostęp do platformy (subscription)
├── Seats
├── Tokeny AI
└── Licencje narzędzi

Można kupić TYLKO raport (bez projektu) - ale wymaga subscription
```

### Licencje narzędzi

| Narzędzie    | Status                            |
| ------------ | --------------------------------- |
| **SIRI**     | W negocjacji z właścicielami praw |
| **ADMA**     | W negocjacji z właścicielami praw |
| **DRD**      | Licencja DBR77                    |
| **Lean 4.0** | DBR77                             |

---

## Changelog

| Version | Date       | Changes                                      |
| ------- | ---------- | -------------------------------------------- |
| 1.0     | 2026-01-11 | Initial version - Discovery Session complete |

---

_This document is the Source of Truth for Consultinity system design._
