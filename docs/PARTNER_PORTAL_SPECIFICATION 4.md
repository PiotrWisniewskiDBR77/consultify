# Partner Portal Specification - DBR77 Consultinity

## Overview

Partner Portal dla Consultinity - platformy PMO + AI do transformacji cyfrowej.
**NIE** jest to kopia HubSpot Partner Portal.

## Model biznesowy partnerów

### Typy partnerów

| Typ                        | Opis                                                      | Model rozliczeń                   |
| -------------------------- | --------------------------------------------------------- | --------------------------------- |
| **Consulting Partner**     | Firmy doradcze używające Consultinity do obsługi klientów | Licencje per seat, marża partnera |
| **Implementation Partner** | Integratorzy wdrażający Consultinity                      | Opłaty za certyfikację, projekty  |
| **Technology Partner**     | Dostawcy integracji (ERP, ITSM, BI)                       | Revenue share z integracji        |
| **Training Partner**       | Certyfikowani trenerzy Consultinity                       | Licencja szkoleniowa              |

### Poziomy partnerstwa

| Poziom         | Wymagania                         | Benefity                                    |
| -------------- | --------------------------------- | ------------------------------------------- |
| **Registered** | Rejestracja, podstawowe szkolenie | Dostęp do materiałów, 10% rabat             |
| **Certified**  | Egzamin, 3 projekty               | Logo partnera, 20% rabat, wsparcie          |
| **Premier**    | 10+ projektów, case study         | Dedykowany opiekun, 30% rabat, co-marketing |

---

## Struktura modułu

### Nawigacja (sidebar)

```
Partner Portal
├── 📊 Dashboard
│   └── Przegląd partnera
├── 👥 Clients
│   ├── Organizations
│   ├── Active Projects
│   └── User Management
├── 🎓 Certification
│   ├── Learning Path
│   ├── Exams
│   └── Certificates
├── 📚 Resources
│   ├── Documentation
│   ├── Marketing Materials
│   ├── Case Studies
│   └── PMO Templates
├── 💰 Billing
│   ├── Licenses
│   ├── Invoices
│   └── Discounts
└── ⚙️ Profile
    ├── Company Info
    ├── Specializations
    ├── Regions
    └── Public Listing
```

---

## Widoki szczegółowe

### 1. Dashboard

**Metryki:**

- Liczba klientów (organizacji)
- Aktywne projekty transformacji
- Status certyfikacji
- Wartość licencji (MRR)
- Wynik NPS od klientów

**Quick Actions:**

- Dodaj nowego klienta
- Rozpocznij projekt
- Przeglądaj zasoby

### 2. Clients

**Zakładki:**

- **Organizations** - Lista organizacji pod opieką partnera
- **Projects** - Projekty transformacji z statusem
- **Users** - Użytkownicy w organizacjach klientów

**Funkcje:**

- Tworzenie organizacji dla klienta
- Przypisywanie licencji
- Widok assessment scores (DRD, SIRI, ADMA, CMMI)
- Roadmap transformacji

### 3. Certification

**Ścieżka certyfikacji:**

1. **Consultinity Foundations** - Podstawy platformy
2. **PMO Standards** - ISO 21500, PMBOK 7, PRINCE2
3. **AI Intelligence** - Moduły AI Consultinity
4. **Assessment Specialist** - DRD, SIRI, ADMA certyfikaty

**Elementy:**

- Progress bar ścieżki
- Dostęp do egzaminów
- Pobranie certyfikatów
- Badge do profilu

### 4. Resources

**Kategorie:**

- **Documentation** - Dokumentacja techniczna i funkcjonalna
- **Marketing** - Prezentacje, one-pagers, logo kit
- **Case Studies** - Przykłady wdrożeń z wynikami
- **Templates** - Szablony PMO, assessmentów, raportów

### 5. Billing

**Funkcje:**

- Przegląd zakupionych licencji
- Historia faktur
- Aktualne progi rabatowe
- Zamówienie dodatkowych licencji

### 6. Profile

**Sekcje:**

- **Company Info** - Nazwa, NIP, adres, kontakt
- **Specializations** - Frameworki (DRD, SIRI, ADMA, CMMI, Lean)
- **Industries** - Branże obsługiwane
- **Regions** - Regiony działania
- **Public Listing** - Widoczność w katalogu partnerów

---

## Integracja z Consultinity

### Dostęp partnera do klientów

| Funkcja           | Dostęp partnera   |
| ----------------- | ----------------- |
| Assessment scores | ✅ Read-only      |
| Roadmap           | ✅ Read-only      |
| Projects          | ✅ Full (jako PM) |
| AI Chat           | ❌ Brak           |
| Settings          | ❌ Brak           |

### PMO Standards mapping

Partner Portal jest zgodny z PMO Framework:

- **RESOURCE_RESPONSIBILITY** - Zarządzanie zespołem partnera
- **PERFORMANCE_MONITORING** - Śledzenie projektów klientów
- **BENEFITS_REALIZATION** - Raportowanie wartości dla klientów

---

## Design System

- Layout: Dwukolumnowy (sidebar + content) jak Admin/Settings
- Kolory: Purple (primary), Slate (neutral), Emerald (success)
- Ikony: Lucide React
- Animacje: Framer Motion (fade, slideUp)

---

## API Endpoints (przyszłość)

```
GET    /api/partner/dashboard
GET    /api/partner/clients
POST   /api/partner/clients
GET    /api/partner/clients/:id
GET    /api/partner/clients/:id/projects
GET    /api/partner/certification/progress
POST   /api/partner/certification/exam/:id/start
GET    /api/partner/resources
GET    /api/partner/billing/licenses
GET    /api/partner/billing/invoices
GET    /api/partner/profile
PUT    /api/partner/profile
```

---

## Status implementacji

- [ ] Specyfikacja ✅
- [ ] PartnerLayout
- [ ] PartnerSidebar
- [ ] Dashboard View
- [ ] Clients View
- [ ] Certification View
- [ ] Resources View
- [ ] Billing View
- [ ] Profile View
- [ ] Routing integration
