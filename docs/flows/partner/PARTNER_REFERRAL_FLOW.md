# Partner Referral System - Analiza przepływu biznesowego

> **ID przepływu:** FLOW-PARTNER-001  
> **Data analizy:** 2026-01-11  
> **Autor:** AI Assistant  
> **Status:** 🟢 Approved  
> **Wersja:** 1.0

---

## 📋 Podsumowanie wykonawcze

| Metryka                          | Wartość    |
| -------------------------------- | ---------- |
| **Kompletność przepływu**        | 75%        |
| **Liczba zidentyfikowanych luk** | 8          |
| **Luki krytyczne (🔴)**          | 1          |
| **Luki wysokie (🟠)**            | 3          |
| **Luki średnie (🟡)**            | 3          |
| **Luki niskie (🟢)**             | 1          |
| **Szacowany effort naprawy**     | L (12-16h) |

### Status komponentów

| Komponent                     | Status             | Uwagi                                                    |
| ----------------------------- | ------------------ | -------------------------------------------------------- |
| Frontend Partner Portal       | ✅ Gotowe          | ReferralTools, Earnings podłączone do API                |
| Frontend Admin (kod partnera) | ✅ Gotowe          | PartnerCodeInput w Billing Settings                      |
| Frontend SuperAdmin           | ⚠️ Częściowe       | Partner Settlements działa, brak zaawansowanej analityki |
| Backend API                   | ✅ Gotowe          | Wszystkie endpointy zaimplementowane                     |
| Backend Services              | ✅ Gotowe          | partnerReferralService, partnerCommissionService         |
| Database                      | ✅ Gotowe          | Wszystkie tabele w migracjach 215-217                    |
| Stripe Integration            | ❌ Brak            | Webhook nie tworzy commission automatycznie              |
| Rabat na fakturze             | ⚠️ Nieweryfikowane | Brak połączenia billing → partner discount               |

---

## 1️⃣ Definicja przepływu

### 1.1 Cel biznesowy

> Partner zarabia prowizję za poleconych klientów poprzez system kodów rabatowych. Klient otrzymuje zniżkę, partner otrzymuje prowizję od płatności, SuperAdmin ma pełną kontrolę i widoczność przepływów finansowych.

**Korzyści biznesowe:**

- Motywacja partnerów do aktywnej promocji
- Niższy CAC (Customer Acquisition Cost)
- Śledzenie efektywności kanałów marketingowych
- Kontrola nad wypłatami i prowizjami

### 1.2 Trigger (co rozpoczyna przepływ)

> Partner loguje się do Partner Portal i generuje/udostępnia swój unikalny kod rabatowy lub link kampanii.

### 1.3 Outcome (oczekiwany rezultat)

> 1. Klient rejestruje się z kodem → otrzymuje rabat
> 2. Klient płaci za subskrypcję → prowizja naliczona partnerowi
> 3. Partner widzi earnings → może zażądać wypłaty
> 4. SuperAdmin zatwierdza → partner otrzymuje pieniądze

### 1.4 Success Criteria

- [x] Partner może wygenerować unikalny kod rabatowy
- [x] Partner może śledzić kliknięcia i konwersje
- [x] Admin organizacji może wprowadzić kod partnera
- [ ] Rabat jest automatycznie naliczany na fakturach
- [ ] Prowizja jest automatycznie tworzona przy płatności Stripe
- [x] SuperAdmin może zatwierdzać prowizje
- [x] SuperAdmin może przetwarzać wypłaty
- [ ] SuperAdmin widzi pełną analitykę per kod

---

## 2️⃣ Aktorzy

### 2.1 Mapa aktorów

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PRZEPŁYW: Partner Referral System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   PARTNER  ─────────►  PROSPECT  ─────────►  ADMIN (ORG)                    │
│   (generuje kod)       (klika link)          (wprowadza kod)                │
│        │                    │                      │                         │
│        │                    │                      ▼                         │
│        │                    │               BILLING SYSTEM                   │
│        │                    │               (nalicza rabat)                  │
│        │                    │                      │                         │
│        │                    │                      ▼                         │
│        │                    │               STRIPE WEBHOOK                   │
│        │                    │               (payment received)               │
│        │                    │                      │                         │
│        │                    │                      ▼                         │
│        │◄──────────────────────────────────COMMISSION SYSTEM                │
│   (widzi earnings)                         (tworzy prowizję)                │
│        │                                         │                           │
│        │                                         ▼                           │
│        ▼                                   SUPERADMIN                        │
│   PAYOUT REQUEST  ────────────────────►  (zatwierdza, wypłaca)             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Szczegóły aktorów

#### Aktor: Partner

| Aspekt           | Opis                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| **Rola**         | Partner biznesowy (firma konsultingowa)                                  |
| **Moduł główny** | Partner Portal (`/partner/*`)                                            |
| **MOŻE**         | Generować kody, tworzyć linki kampanii, śledzić analytics, żądać wypłaty |
| **MUSI**         | Mieć aktywne konto partnera, podać dane do wypłat                        |
| **WIDZI**        | Dashboard, earnings, lista referred klientów, historia wypłat            |
| **Nie może**     | Zatwierdzać własnych prowizji, modyfikować stawek                        |

#### Aktor: Admin (Organization)

| Aspekt           | Opis                                                 |
| ---------------- | ---------------------------------------------------- |
| **Rola**         | Administrator organizacji klienta                    |
| **Moduł główny** | Admin Panel → Billing Settings                       |
| **MOŻE**         | Wprowadzić kod partnera, usunąć atrybucję            |
| **MUSI**         | Być zalogowany jako admin organizacji                |
| **WIDZI**        | Aktywny kod, informacje o rabacie, datę wygaśnięcia  |
| **Nie może**     | Modyfikować stawek rabatu, widzieć prowizji partnera |

#### Aktor: SuperAdmin

| Aspekt           | Opis                                                           |
| ---------------- | -------------------------------------------------------------- |
| **Rola**         | Operator platformy Consultinity                                |
| **Moduł główny** | SuperAdmin → Revenue → Partner Settlements                     |
| **MOŻE**         | Zatwierdzać prowizje, przetwarzać wypłaty, konfigurować stawki |
| **MUSI**         | Weryfikować przed zatwierdzeniem wypłaty                       |
| **WIDZI**        | Wszystkie prowizje, payouts, atrybucje, summary                |
| **Nie może**     | (Brak ograniczeń)                                              |

#### Aktor: System (Stripe Webhook)

| Aspekt           | Opis                                   |
| ---------------- | -------------------------------------- |
| **Rola**         | Automatyczna integracja płatności      |
| **Moduł główny** | Stripe webhook handler                 |
| **MUSI**         | Sprawdzić atrybucję, naliczyć prowizję |
| **Status**       | ❌ **NIE ZAIMPLEMENTOWANE**            |

---

## 3️⃣ Moduły zaangażowane

### 3.1 Mapa modułów

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Partner Portal          Admin Panel            SuperAdmin Panel            │
│  └─ ReferralToolsSection └─ BillingSettingsView └─ PartnerSettlementsView  │
│  └─ EarningsSection        └─ PartnerCodeInput  └─ PartnerProgramConfig    │
│  └─ PartnerPortalView                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                              API                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/partners/*           /api/organization/*     /api/superadmin/*        │
│  └─ referral-tools         └─ partner-code         └─ partner-settlements   │
│  └─ campaign-links         └─ partner-attribution  └─ partner-config        │
│  └─ earnings               (partner-code.routes.ts)                         │
│  └─ payouts                                                                 │
│  (partners.routes.ts)                                                       │
│                                                                             │
│  /api/public/partner/*                                                      │
│  └─ validate-code                                                           │
│  └─ track-click                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                            SERVICES                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  partnerReferralService.ts    partnerCommissionService.ts                   │
│  └─ getReferralTools()        └─ getEarningsSummary()                       │
│  └─ createCampaignLink()      └─ getCommissions()                           │
│  └─ validateReferralCode()    └─ approveCommissions()                       │
│  └─ trackClick()              └─ requestPayout()                            │
│  └─ createAttribution()       └─ processPayout()                            │
│                                                                             │
│  partnerConfigService.ts                                                    │
│  └─ getCommissionRates()                                                    │
│  └─ getDiscountConfig()                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                            DATABASE                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  partner_organizations    partner_attributions     partner_commission_trans │
│  partner_payout_accounts  partner_payouts          partner_referral_clicks  │
│  partner_campaign_links   partner_discount_config  organization_discounts   │
│  partner_commission_rates partner_payout_settings                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Szczegóły modułów

| Warstwa      | Moduł                    | Plik/Endpoint                                                  | Rola w przepływie         | Status      |
| ------------ | ------------------------ | -------------------------------------------------------------- | ------------------------- | ----------- |
| **Frontend** |                          |                                                                |                           |             |
|              | Partner ReferralTools    | `src/views/partner/sections/ReferralToolsSection.tsx`          | Generowanie kodów, linków | ✅          |
|              | Partner Earnings         | `src/views/partner/sections/EarningsSection.tsx`               | Widok prowizji, payouts   | ✅          |
|              | Admin PartnerCode        | `src/components/Admin/PartnerCodeInput.tsx`                    | Wprowadzanie kodu         | ✅          |
|              | SA Settlements           | `src/views/superadmin/revenue/PartnerSettlementsView.tsx`      | Zarządzanie prowizjami    | ✅          |
| **API**      |                          |                                                                |                           |             |
|              | Partner API              | `GET /api/partners/referral-tools`                             | Pobieranie kodów          | ✅          |
|              | Partner API              | `POST /api/partners/campaign-links`                            | Tworzenie linków          | ✅          |
|              | Partner API              | `GET /api/partners/earnings`                                   | Pobieranie earnings       | ✅          |
|              | Partner API              | `POST /api/partners/payouts/request`                           | Żądanie wypłaty           | ✅          |
|              | Org API                  | `POST /api/organization/partner-code`                          | Aplikowanie kodu          | ✅          |
|              | Org API                  | `GET /api/organization/partner-attribution`                    | Sprawdzenie atrybucji     | ✅          |
|              | Public API               | `GET /api/public/partner/validate-code/:code`                  | Walidacja kodu            | ✅          |
|              | Public API               | `POST /api/public/partner/track-click`                         | Śledzenie kliknięć        | ✅          |
|              | SA API                   | `GET /api/superadmin/partner-settlements/summary`              | Podsumowanie              | ✅          |
|              | SA API                   | `POST /api/superadmin/partner-settlements/approve-commissions` | Zatwierdzanie             | ✅          |
| **Service**  |                          |                                                                |                           |             |
|              | partnerReferralService   | `server/src/services/partnerReferralService.ts`                | Logika kodów/atrybucji    | ✅          |
|              | partnerCommissionService | `server/src/services/partnerCommissionService.ts`              | Logika prowizji           | ✅          |
| **Database** |                          |                                                                |                           |             |
|              | Tabele partnera          | `215_partner_portal.sql`                                       | Podstawowe dane           | ✅          |
|              | Tabele referrali         | `216_partner_referral_system.sql`                              | Referral tracking         | ✅          |
|              | Tabele rabatów           | `217_partner_discount_system.sql`                              | Konfiguracja rabatów      | ✅          |
| **External** |                          |                                                                |                           |             |
|              | Stripe Webhook           | `server/src/routes/stripe-webhook.routes.ts`                   | Auto-commission           | ❌ **BRAK** |

---

## 4️⃣ Sekwencja przepływu

### 4.1 Diagram sekwencji

```
┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐
│Partner │  │Prospect│  │  Admin │  │Billing │  │ Stripe │  │ System │  │SuperAdm│
└───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘
    │           │           │           │           │           │           │
    │ 1. Generate code      │           │           │           │           │
    │──────────────────────>│           │           │           │           │
    │           │           │           │           │           │           │
    │ 2. Share link         │           │           │           │           │
    │─────────>│           │           │           │           │           │
    │           │           │           │           │           │           │
    │           │ 3. Click  │           │           │           │           │
    │           │──────────>│ (track)   │           │           │           │
    │           │           │           │           │           │           │
    │           │ 4. Signup │           │           │           │           │
    │           │──────────>│           │           │           │           │
    │           │           │           │           │           │           │
    │           │           │ 5. Enter  │           │           │           │
    │           │           │ partner   │           │           │           │
    │           │           │ code      │           │           │           │
    │           │           │──────────>│           │           │           │
    │           │           │           │           │           │           │
    │           │           │ 6. Create attribution  │           │           │
    │           │           │──────────────────────>│           │           │
    │           │           │           │           │           │           │
    │           │           │ 7. Apply discount     │           │           │
    │           │           │───────────>│ ⚠️       │           │           │
    │           │           │           │           │           │           │
    │           │           │ 8. Pay    │           │           │           │
    │           │           │───────────────────────>│           │           │
    │           │           │           │           │           │           │
    │           │           │           │ 9. Webhook│           │           │
    │           │           │           │<──────────│           │           │
    │           │           │           │           │           │           │
    │           │           │           │ 10. Create commission ❌           │
    │           │           │           │─────────────────────>│           │
    │           │           │           │           │           │           │
    │ 11. View earnings     │           │           │           │           │
    │<─────────────────────────────────────────────────────────│           │
    │           │           │           │           │           │           │
    │ 12. Request payout    │           │           │           │           │
    │──────────────────────────────────────────────────────────>│           │
    │           │           │           │           │           │           │
    │           │           │           │           │           │ 13. Approve│
    │           │           │           │           │           │<──────────│
    │           │           │           │           │           │           │
    │ 14. Receive payout    │           │           │           │           │
    │<─────────────────────────────────────────────────────────────────────│
    │           │           │           │           │           │           │
```

### 4.2 Kroki przepływu

#### Krok 1: Partner generuje kod

| Element        | Wartość                                                |
| -------------- | ------------------------------------------------------ |
| **Aktor**      | Partner                                                |
| **Akcja**      | Loguje się, przechodzi do Referrals → My Links & Codes |
| **Moduł**      | Partner Portal → ReferralToolsSection                  |
| **Input**      | Partner auth token                                     |
| **Output**     | Unikalny kod (np. ACME2026), link referralowy          |
| **Zależności** | Konto partnera musi być aktywne                        |
| **Status**     | ✅ Działa                                              |

#### Krok 2: Partner udostępnia link

| Element    | Wartość                                                  |
| ---------- | -------------------------------------------------------- |
| **Aktor**  | Partner                                                  |
| **Akcja**  | Kopiuje link i udostępnia (email, social media, website) |
| **Moduł**  | ReferralToolsSection (copy button)                       |
| **Input**  | Link z kodem                                             |
| **Output** | Link udostępniony prospektom                             |
| **Status** | ✅ Działa                                                |

#### Krok 3: Prospect klika link

| Element    | Wartość                                     |
| ---------- | ------------------------------------------- |
| **Aktor**  | Prospect (potencjalny klient)               |
| **Akcja**  | Klika w link partnerski                     |
| **Moduł**  | Landing page + track-click API              |
| **API**    | `POST /api/public/partner/track-click`      |
| **Input**  | referralCode, UTM params, IP (hashed)       |
| **Output** | Click recorded in `partner_referral_clicks` |
| **Status** | ✅ Działa                                   |

#### Krok 4: Prospect rejestruje się

| Element        | Wartość                                               |
| -------------- | ----------------------------------------------------- |
| **Aktor**      | Prospect                                              |
| **Akcja**      | Zakłada konto w Consultinity                          |
| **Moduł**      | Registration flow                                     |
| **Input**      | Dane rejestracyjne + opcjonalnie kod partnera         |
| **Output**     | Nowe konto + organization                             |
| **Zależności** | Kod może być wprowadzony przy rejestracji lub później |
| **Status**     | ⚠️ Częściowo - kod można dodać później w Admin        |

#### Krok 5: Admin wprowadza kod partnera

| Element    | Wartość                                                 |
| ---------- | ------------------------------------------------------- |
| **Aktor**  | Admin organizacji                                       |
| **Akcja**  | Settings → Billing → Partner & Referral → wprowadza kod |
| **Moduł**  | Admin Panel → BillingSettingsView → PartnerCodeInput    |
| **API**    | `POST /api/organization/partner-code`                   |
| **Input**  | partnerCode                                             |
| **Output** | Attribution created, discount applied                   |
| **Status** | ✅ Działa                                               |

#### Krok 6: System tworzy atrybucję

| Element    | Wartość                                    |
| ---------- | ------------------------------------------ |
| **Aktor**  | System                                     |
| **Akcja**  | Zapisuje powiązanie organizacja ↔ partner  |
| **Moduł**  | partnerReferralService.createAttribution() |
| **Input**  | partnerOrgId, organizationId, referralCode |
| **Output** | Record in `partner_attributions`           |
| **Status** | ✅ Działa                                  |

#### Krok 7: System nalicza rabat

| Element        | Wartość                                                         |
| -------------- | --------------------------------------------------------------- |
| **Aktor**      | System                                                          |
| **Akcja**      | Tworzy rekord rabatu dla organizacji                            |
| **Moduł**      | partner-code.routes.ts → organization_discounts                 |
| **Input**      | organizationId, discountConfig                                  |
| **Output**     | Record in `organization_discounts`                              |
| **Zależności** | Billing musi respektować tabelę `organization_discounts`        |
| **Status**     | ⚠️ **Częściowo** - rekord tworzony, ale billing może nie używać |

#### Krok 8: Admin/Org płaci fakturę

| Element    | Wartość                          |
| ---------- | -------------------------------- |
| **Aktor**  | Admin organizacji                |
| **Akcja**  | Opłaca subskrypcję przez Stripe  |
| **Moduł**  | Billing Module → Stripe Checkout |
| **Input**  | Dane karty, kwota (z rabatem?)   |
| **Output** | Payment successful               |
| **Status** | ✅ Stripe działa                 |

#### Krok 9: Stripe wysyła webhook

| Element    | Wartość                                                      |
| ---------- | ------------------------------------------------------------ |
| **Aktor**  | Stripe (system zewnętrzny)                                   |
| **Akcja**  | Wysyła event `invoice.paid` lub `checkout.session.completed` |
| **Moduł**  | Stripe webhook handler                                       |
| **Input**  | Payment event data                                           |
| **Output** | Webhook received                                             |
| **Status** | ✅ Webhook istnieje                                          |

#### Krok 10: System tworzy prowizję ❌ **BRAK**

| Element            | Wartość                                                 |
| ------------------ | ------------------------------------------------------- |
| **Aktor**          | System                                                  |
| **Akcja**          | Sprawdza atrybucję, tworzy commission                   |
| **Moduł**          | **BRAK IMPLEMENTACJI**                                  |
| **Oczekiwane API** | `PartnerCommissionService.createCommission()` w webhook |
| **Status**         | ❌ **NIE ZAIMPLEMENTOWANE**                             |

#### Krok 11: Partner widzi earnings

| Element    | Wartość                                                   |
| ---------- | --------------------------------------------------------- |
| **Aktor**  | Partner                                                   |
| **Akcja**  | Przechodzi do Earnings → Commission Earnings              |
| **Moduł**  | Partner Portal → EarningsSection                          |
| **API**    | `GET /api/partners/earnings`                              |
| **Status** | ✅ Działa (ale pokazuje dane z ręcznie dodanych prowizji) |

#### Krok 12: Partner żąda wypłaty

| Element    | Wartość                                  |
| ---------- | ---------------------------------------- |
| **Aktor**  | Partner                                  |
| **Akcja**  | Klika "Request Payout"                   |
| **Moduł**  | EarningsSection                          |
| **API**    | `POST /api/partners/payouts/request`     |
| **Input**  | payoutAccountId                          |
| **Output** | Payout request created (status: PENDING) |
| **Status** | ✅ Działa                                |

#### Krok 13: SuperAdmin zatwierdza

| Element    | Wartość                                                        |
| ---------- | -------------------------------------------------------------- |
| **Aktor**  | SuperAdmin                                                     |
| **Akcja**  | Revenue → Partner Settlements → Approve/Process                |
| **Moduł**  | PartnerSettlementsView                                         |
| **API**    | `POST /api/superadmin/partner-settlements/approve-commissions` |
| **Status** | ✅ Działa                                                      |

#### Krok 14: Partner otrzymuje wypłatę

| Element    | Wartość                                  |
| ---------- | ---------------------------------------- |
| **Aktor**  | System / SuperAdmin                      |
| **Akcja**  | Przelew bankowy / PayPal                 |
| **Moduł**  | Manual process (lub przyszła integracja) |
| **Status** | ⚠️ Manualny proces                       |

---

## 5️⃣ Matryca zależności

### 5.1 Zależności między modułami

| Moduł źródłowy         | Moduł docelowy           | Typ | Opis                        | Status  |
| ---------------------- | ------------------------ | --- | --------------------------- | ------- |
| PartnerCodeInput       | validate-code API        | V   | Walidacja kodu przed submit | ✅      |
| partner-code.routes    | partnerReferralService   | A   | Tworzenie atrybucji         | ✅      |
| partner-code.routes    | organization_discounts   | D   | Tworzenie rabatu            | ✅      |
| Billing/Invoice        | organization_discounts   | D   | Pobieranie rabatu           | ⚠️ ?    |
| Stripe Webhook         | partner_attributions     | D   | Sprawdzenie atrybucji       | ❌ BRAK |
| Stripe Webhook         | partnerCommissionService | A   | Tworzenie prowizji          | ❌ BRAK |
| EarningsSection        | earnings API             | D   | Pobieranie earnings         | ✅      |
| PartnerSettlementsView | settlements API          | D   | Pobieranie danych           | ✅      |

### 5.2 Reguły biznesowe

| ID    | Reguła                                      | Moduły              | Status |
| ----- | ------------------------------------------- | ------------------- | ------ |
| BR-01 | Kod partnera musi być aktywny i nieexpired  | validate-code API   | ✅     |
| BR-02 | Organizacja może mieć tylko jedną atrybucję | partner-code.routes | ✅     |
| BR-03 | Rabat jest naliczany przez X miesięcy       | partner-code.routes | ✅     |
| BR-04 | Prowizja = płatność × commission_rate       | **Stripe webhook**  | ❌     |
| BR-05 | Payout możliwy gdy approved ≥ min_threshold | payouts API         | ✅     |
| BR-06 | SuperAdmin musi zatwierdzić przed wypłatą   | approve-commissions | ✅     |

---

## 6️⃣ Analiza luk (Gap Analysis)

### 6.1 Checklist kompletności

#### Frontend

- [x] Partner może generować kody
- [x] Partner może tworzyć campaign links
- [x] Partner widzi earnings i payouts
- [x] Admin może wprowadzić kod w Settings
- [x] Admin widzi aktywny rabat
- [x] SuperAdmin widzi settlements overview
- [ ] SuperAdmin widzi szczegółową analitykę per kod
- [ ] SuperAdmin widzi wygasające kody/atrybucje

#### Backend API

- [x] Walidacja kodu (public)
- [x] Track click (public)
- [x] CRUD dla campaign links
- [x] Tworzenie atrybucji
- [x] Pobieranie earnings
- [x] Request payout
- [x] Approve commissions
- [ ] Auto-create commission on Stripe payment

#### Database

- [x] Wszystkie tabele istnieją
- [x] Relacje są poprawne
- [x] Seed data dla demo

#### Integracje

- [ ] Stripe webhook → create commission
- [ ] Billing → apply discount from organization_discounts
- [ ] Payout → Stripe Connect / PayPal

### 6.2 Zidentyfikowane luki

#### GAP-PARTNER-001: Brak automatycznego tworzenia prowizji przy płatności Stripe

| Atrybut        | Wartość                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing Integration                                                                                                                               |
| **Severity**   | 🔴 Critical                                                                                                                                       |
| **Moduł**      | Stripe webhook handler                                                                                                                            |
| **Opis**       | Gdy klient płaci fakturę, system nie sprawdza czy ma atrybucję partnera i nie tworzy automatycznie prowizji. Prowizje muszą być dodawane ręcznie. |
| **Wpływ**      | Cały przepływ partner earnings jest manualny                                                                                                      |
| **Zależności** | -                                                                                                                                                 |
| **Effort**     | M (4-6h)                                                                                                                                          |

#### GAP-PARTNER-002: Brak weryfikacji czy Billing używa tabeli organization_discounts

| Atrybut        | Wartość                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing Integration                                                                                                                       |
| **Severity**   | 🟠 High                                                                                                                                   |
| **Moduł**      | Billing Module / Invoice generation                                                                                                       |
| **Opis**       | Rekord rabatu jest tworzony w `organization_discounts`, ale nie ma pewności że Billing/Stripe pobiera ten rabat przy generowaniu faktury. |
| **Wpływ**      | Klient może nie otrzymywać rabatu mimo wprowadzonego kodu                                                                                 |
| **Zależności** | -                                                                                                                                         |
| **Effort**     | M (3-4h) - analiza + ewentualna implementacja                                                                                             |

#### GAP-PARTNER-003: Brak szczegółowej analityki kodów w SuperAdmin

| Atrybut        | Wartość                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing UI + API                                                                                                                   |
| **Severity**   | 🟠 High                                                                                                                            |
| **Moduł**      | SuperAdmin Revenue → Partner Settlements                                                                                           |
| **Opis**       | SuperAdmin nie widzi: ile razy dany kod został użyty, ile revenue wygenerował, estymacji przyszłych prowizji, które kody wygasają. |
| **Wpływ**      | Brak widoczności efektywności programu partnerskiego                                                                               |
| **Zależności** | GAP-PARTNER-001                                                                                                                    |
| **Effort**     | L (6-8h)                                                                                                                           |

#### GAP-PARTNER-004: Brak widoku wygasających atrybucji

| Atrybut        | Wartość                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Typ**        | Missing UI                                                                                 |
| **Severity**   | 🟠 High                                                                                    |
| **Moduł**      | SuperAdmin Revenue                                                                         |
| **Opis**       | SuperAdmin nie widzi które atrybucje/rabaty wkrótce wygasną (np. za 30 dni). Brak alertów. |
| **Wpływ**      | Brak proaktywnego zarządzania                                                              |
| **Zależności** | -                                                                                          |
| **Effort**     | S (2-3h)                                                                                   |

#### GAP-PARTNER-005: Dashboard partnera używa mock data

| Atrybut        | Wartość                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| **Typ**        | Mock Data                                                                            |
| **Severity**   | 🟡 Medium                                                                            |
| **Moduł**      | Partner Portal → Dashboard, Metrics                                                  |
| **Opis**       | Sekcje Dashboard i Metrics w PartnerPortalView używają hardcoded danych zamiast API. |
| **Wpływ**      | Partner nie widzi prawdziwych statystyk                                              |
| **Zależności** | -                                                                                    |
| **Effort**     | M (3-4h)                                                                             |

#### GAP-PARTNER-006: Brak integracji płatności wypłat

| Atrybut        | Wartość                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing Integration                                                                                       |
| **Severity**   | 🟡 Medium                                                                                                 |
| **Moduł**      | Payout processing                                                                                         |
| **Opis**       | Wypłaty są zatwierdzane manualnie w UI, ale nie ma automatycznej integracji z PayPal/Stripe Connect/SEPA. |
| **Wpływ**      | Manualny proces wypłat                                                                                    |
| **Zależności** | -                                                                                                         |
| **Effort**     | XL (16h+)                                                                                                 |

#### GAP-PARTNER-007: Brak walidacji kodu przy rejestracji

| Atrybut        | Wartość                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing Integration                                                                                            |
| **Severity**   | 🟡 Medium                                                                                                      |
| **Moduł**      | Registration flow                                                                                              |
| **Opis**       | Kod partnera można wprowadzić tylko po rejestracji w Admin Settings. Brak opcji wprowadzenia przy rejestracji. |
| **Wpływ**      | UX - dodatkowy krok dla użytkownika                                                                            |
| **Zależności** | -                                                                                                              |
| **Effort**     | M (4h)                                                                                                         |

#### GAP-PARTNER-008: Brak email notifications

| Atrybut        | Wartość                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------- |
| **Typ**        | Missing Feature                                                                                     |
| **Severity**   | 🟢 Low                                                                                              |
| **Moduł**      | Email service                                                                                       |
| **Opis**       | Brak powiadomień email: dla partnera (nowy referral, commission earned), dla admina (rabat wygasa). |
| **Wpływ**      | UX - brak proaktywnych powiadomień                                                                  |
| **Zależności** | -                                                                                                   |
| **Effort**     | M (4h)                                                                                              |

---

## 7️⃣ Action Items

### 7.1 Priorytetyzacja

| Priorytet   | Liczba | Effort   |
| ----------- | ------ | -------- |
| 🔴 Critical | 1      | 5h       |
| 🟠 High     | 3      | 13h      |
| 🟡 Medium   | 3      | 11h      |
| 🟢 Low      | 1      | 4h       |
| **TOTAL**   | **8**  | **~33h** |

### 7.2 Lista action items

#### 🔴 Critical

| ID                 | Opis                                                     | Moduł                      | Effort | Status  |
| ------------------ | -------------------------------------------------------- | -------------------------- | ------ | ------- |
| ACTION-PARTNER-001 | Dodać tworzenie prowizji w Stripe webhook (invoice.paid) | `stripe-webhook.routes.ts` | M (5h) | ⬜ Todo |

**Szczegóły ACTION-PARTNER-001:**

```typescript
// W stripe webhook handler dla invoice.paid:
const organizationId = getOrgIdFromStripeCustomer(invoice.customer);
const attribution = await PartnerReferralService.getAttributionByOrganization(organizationId);

if (attribution && attribution.status === 'ACTIVE') {
  await PartnerCommissionService.createCommission({
    partnerOrgId: attribution.partnerOrgId,
    attributionId: attribution.id,
    organizationId,
    transactionType: 'SUBSCRIPTION',
    grossAmount: invoice.amount_paid,
    commissionRate: attribution.commissionRatePercent || 15,
    stripePaymentId: invoice.id,
  });
}
```

#### 🟠 High

| ID                 | Opis                                                            | Moduł                        | Effort | Status  |
| ------------------ | --------------------------------------------------------------- | ---------------------------- | ------ | ------- |
| ACTION-PARTNER-002 | Zweryfikować i połączyć Billing z organization_discounts        | Billing routes / Stripe      | M (4h) | ⬜ Todo |
| ACTION-PARTNER-003 | Dodać analitykę kodów w SuperAdmin (użycia, revenue, estymacja) | PartnerSettlementsView + API | L (6h) | ⬜ Todo |
| ACTION-PARTNER-004 | Dodać widok wygasających atrybucji z alertami                   | PartnerSettlementsView + API | S (3h) | ⬜ Todo |

#### 🟡 Medium

| ID                 | Opis                                                 | Moduł                               | Effort | Status  |
| ------------------ | ---------------------------------------------------- | ----------------------------------- | ------ | ------- |
| ACTION-PARTNER-005 | Podłączyć Partner Dashboard do prawdziwego API       | PartnerPortalView + partners.routes | M (4h) | ⬜ Todo |
| ACTION-PARTNER-006 | Dodać pole kodu partnera przy rejestracji            | Registration flow                   | M (4h) | ⬜ Todo |
| ACTION-PARTNER-007 | Zbadać i zaplanować integrację PayPal/Stripe Connect | Architecture doc                    | S (3h) | ⬜ Todo |

#### 🟢 Low

| ID                 | Opis                                                                | Moduł         | Effort | Status  |
| ------------------ | ------------------------------------------------------------------- | ------------- | ------ | ------- |
| ACTION-PARTNER-008 | Dodać email notifications (nowy referral, commission, rabat wygasa) | Email service | M (4h) | ⬜ Todo |

---

## 8️⃣ Rekomendacje

### 8.1 Quick Wins (do zrobienia od razu)

1. **ACTION-PARTNER-001** - Dodanie prowizji w Stripe webhook to klucz do działania całego systemu
2. **ACTION-PARTNER-004** - Widok wygasających atrybucji to prosta zmiana a daje dużą wartość

### 8.2 Długoterminowe usprawnienia

1. Integracja PayPal/Stripe Connect dla automatycznych wypłat
2. Multi-tier commission rates (różne stawki dla różnych produktów)
3. Affiliate dashboard z zaawansowaną analityką

### 8.3 Technical Debt do adresowania

1. Mock data w PartnerPortalView (Dashboard, Metrics sections)
2. Duplikaty plików serwisów (`partnerReferralService 3.ts` etc.) - do usunięcia

---

## 9️⃣ Appendix

### A. Powiązane dokumenty

| Dokument                    | Link                                     |
| --------------------------- | ---------------------------------------- |
| Dokumentacja systemu        | `docs/PARTNER_REFERRAL_SYSTEM.md`        |
| Audit modułu Partner        | `docs/PARTNER_MODULE_AUDIT.md`           |
| Specyfikacja Partner Portal | `docs/PARTNER_PORTAL_SPECIFICATION.md`   |
| Migracje DB                 | `server/migrations/215-217_partner*.sql` |
| API Routes                  | `server/src/routes/partners.routes.ts`   |

### B. Pliki źródłowe

| Plik                                                      | Rola                 |
| --------------------------------------------------------- | -------------------- |
| `src/views/partner/sections/ReferralToolsSection.tsx`     | UI generowania kodów |
| `src/views/partner/sections/EarningsSection.tsx`          | UI earnings/payouts  |
| `src/components/Admin/PartnerCodeInput.tsx`               | UI wprowadzania kodu |
| `src/views/superadmin/revenue/PartnerSettlementsView.tsx` | UI settlements       |
| `server/src/routes/partners.routes.ts`                    | API partner portal   |
| `server/src/routes/organization/partner-code.routes.ts`   | API kodu partnera    |
| `server/src/services/partnerReferralService.ts`           | Logika referrali     |
| `server/src/services/partnerCommissionService.ts`         | Logika prowizji      |

### C. Historia zmian

| Data       | Autor        | Zmiany                         |
| ---------- | ------------ | ------------------------------ |
| 2026-01-11 | AI Assistant | Initial comprehensive analysis |

---

_Dokument wygenerowany zgodnie z metodologią BFCS (Business Flow Completeness System)_
