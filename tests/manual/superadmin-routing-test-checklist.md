# SuperAdmin Routing - Manual Test Checklist

## Przed rozpoczęciem testów
- [ ] Upewnij się, że serwer dev działa (`npm run dev`)
- [ ] Otwórz przeglądarkę z DevTools (F12)
- [ ] Sprawdź konsolę pod kątem błędów przed rozpoczęciem
- [ ] Zaloguj się jako SuperAdmin (lub użyj odpowiednich danych testowych)

## Test 1: Overview Module
**URL**: `http://localhost:3000/superadmin/overview`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Overview się renderuje (brak błędów, widoczna zawartość)
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Overview" (podświetlona)
- [ ] Sprawdź czy URL w pasku adresu to `/superadmin/overview`
- [ ] Kliknij inne moduły w sidebarze i wróć do Overview
- [ ] Odśwież stronę (F5) - sprawdź czy Overview nadal się wyświetla
- [ ] Sprawdź konsolę przeglądarki - brak błędów JavaScript

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 2: Customers Module
**URL**: `http://localhost:3000/superadmin/customers`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Customers się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Customers"
- [ ] Sprawdź czy URL to `/superadmin/customers`
- [ ] Sprawdź podmoduły (jeśli są): Organizations, Users, Feedback, Bulk Ops
- [ ] Odśwież stronę (F5) - sprawdź czy stan się zachowuje
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 3: AI Infrastructure Module
**URL**: `http://localhost:3000/superadmin/ai-infrastructure`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł AI Infrastructure się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "AI Infrastructure"
- [ ] Sprawdź czy URL to `/superadmin/ai-infrastructure`
- [ ] Sprawdź podmoduły: LLM Providers, Tiers, Settings, Health
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 4: AI Development Module
**URL**: `http://localhost:3000/superadmin/ai-development`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł AI Development się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "AI Development"
- [ ] Sprawdź czy URL to `/superadmin/ai-development`
- [ ] Sprawdź podmoduły: Prompts, Intelligence, Experiments, Knowledge
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 5: AI Operations Module
**URL**: `http://localhost:3000/superadmin/ai-operations`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł AI Operations się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "AI Operations"
- [ ] Sprawdź czy URL to `/superadmin/ai-operations`
- [ ] Sprawdź podmoduły: Mission Control, Performance, Costs, SLA, Analytics
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 6: System Module
**URL**: `http://localhost:3000/superadmin/system`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł System się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "System"
- [ ] Sprawdź czy URL to `/superadmin/system`
- [ ] Sprawdź podmoduły: Health, Audit Log, Feature Flags, Integrations
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 7: Content Module
**URL**: `http://localhost:3000/superadmin/content`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Content się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Content"
- [ ] Sprawdź czy URL to `/superadmin/content`
- [ ] Sprawdź podmoduły: Playbooks, Email Templates
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 8: Revenue Module
**URL**: `http://localhost:3000/superadmin/revenue`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Revenue się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Revenue"
- [ ] Sprawdź czy URL to `/superadmin/revenue`
- [ ] Sprawdź podmoduły: Billing, Invoices, Usage
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 9: Security Module
**URL**: `http://localhost:3000/superadmin/security`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Security się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Security"
- [ ] Sprawdź czy URL to `/superadmin/security`
- [ ] Sprawdź podmoduły: SSO, Policies, API Keys, Compliance
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 10: Analytics Module
**URL**: `http://localhost:3000/superadmin/analytics`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Analytics się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Analytics"
- [ ] Sprawdź czy URL to `/superadmin/analytics`
- [ ] Sprawdź podmoduły: Custom Dashboards, Reports, Metrics, Predictive
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 11: Configuration Module
**URL**: `http://localhost:3000/superadmin/configuration`

- [ ] Otwórz URL w przeglądarce
- [ ] Sprawdź czy moduł Configuration się renderuje
- [ ] Sprawdź czy sidebar pokazuje aktywną sekcję "Configuration"
- [ ] Sprawdź czy URL to `/superadmin/configuration`
- [ ] Sprawdź podmoduły: Settings, White-label, Legal
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 12: Legacy Route Redirect
**URL**: `http://localhost:3000/superadmin/ai-platform`

- [ ] Otwórz legacy URL w przeglądarce
- [ ] Sprawdź czy następuje automatyczne przekierowanie do `/superadmin/ai-infrastructure`
- [ ] Sprawdź czy URL w pasku adresu zmienił się na `/superadmin/ai-infrastructure`
- [ ] Sprawdź czy moduł AI Infrastructure się renderuje
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 13: Default Route Redirect
**URL**: `http://localhost:3000/superadmin`

- [ ] Otwórz główny URL SuperAdmin
- [ ] Sprawdź czy następuje automatyczne przekierowanie do `/superadmin/overview`
- [ ] Sprawdź czy URL w pasku adresu zmienił się na `/superadmin/overview`
- [ ] Sprawdź czy moduł Overview się renderuje
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 14: Deep Linking
**Kroki**:
- [ ] Otwórz bezpośrednio każdy z następujących URL-i:
  - `http://localhost:3000/superadmin/overview`
  - `http://localhost:3000/superadmin/customers`
  - `http://localhost:3000/superadmin/ai-infrastructure`
  - `http://localhost:3000/superadmin/ai-development`
  - `http://localhost:3000/superadmin/ai-operations`
  - `http://localhost:3000/superadmin/system`
  - `http://localhost:3000/superadmin/content`
  - `http://localhost:3000/superadmin/revenue`
  - `http://localhost:3000/superadmin/security`
  - `http://localhost:3000/superadmin/analytics`
  - `http://localhost:3000/superadmin/configuration`
- [ ] Dla każdego URL sprawdź czy odpowiedni moduł się renderuje
- [ ] Sprawdź czy URL się nie zmienia (nie ma nieoczekiwanych przekierowań)
- [ ] Sprawdź konsolę - brak błędów dla każdego URL

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 15: Browser Navigation (Back/Forward)
**Kroki**:
- [ ] Otwórz `http://localhost:3000/superadmin/overview`
- [ ] Przejdź do `http://localhost:3000/superadmin/customers`
- [ ] Przejdź do `http://localhost:3000/superadmin/ai-infrastructure`
- [ ] Kliknij przycisk "Wstecz" w przeglądarce
- [ ] Sprawdź czy wróciłeś do `/superadmin/customers`
- [ ] Sprawdź czy moduł Customers się renderuje
- [ ] Kliknij przycisk "Do przodu" w przeglądarce
- [ ] Sprawdź czy wróciłeś do `/superadmin/ai-infrastructure`
- [ ] Sprawdź czy moduł AI Infrastructure się renderuje
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 16: Sidebar Navigation
**Kroki**:
- [ ] Otwórz `http://localhost:3000/superadmin/overview`
- [ ] Dla każdego przycisku w sidebarze SuperAdmin:
  - [ ] Kliknij przycisk
  - [ ] Sprawdź czy URL się zmienia na odpowiedni route
  - [ ] Sprawdź czy odpowiedni moduł się renderuje
  - [ ] Sprawdź czy aktywny przycisk w sidebarze jest podświetlony
- [ ] Sprawdź konsolę - brak błędów

**Lista przycisków do przetestowania**:
- [ ] Overview
- [ ] Customers
- [ ] AI Infrastructure
- [ ] AI Development
- [ ] AI Operations
- [ ] System
- [ ] Content
- [ ] Revenue
- [ ] Security
- [ ] Analytics
- [ ] Configuration

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 17: Page Refresh State Preservation
**Kroki**:
- [ ] Otwórz `http://localhost:3000/superadmin/customers`
- [ ] Sprawdź aktualny stan modułu (jeśli są otwarte taby, filtry, etc.)
- [ ] Odśwież stronę (F5)
- [ ] Sprawdź czy URL pozostał `/superadmin/customers`
- [ ] Sprawdź czy moduł Customers się renderuje
- [ ] Powtórz dla kilku innych modułów
- [ ] Sprawdź konsolę - brak błędów

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Test 18: Console Errors Check
**Kroki**:
- [ ] Otwórz DevTools (F12)
- [ ] Przejdź przez wszystkie moduły SuperAdmin:
  - Overview, Customers, AI Infrastructure, AI Development, AI Operations, System, Content, Revenue, Security, Analytics, Configuration
- [ ] Dla każdego modułu sprawdź konsolę:
  - [ ] Brak błędów JavaScript (czerwone komunikaty)
  - [ ] Brak warningów React (żółte komunikaty)
- [ ] Sprawdź Network tab:
  - [ ] Wszystkie requesty API kończą się sukcesem (status 200, 201, 204)
  - [ ] Brak requestów z błędami (status 4xx, 5xx)
- [ ] Sprawdź czy nie ma memory leaks (sprawdź Performance tab)

**Status**: ☐ PASS / ☐ FAIL
**Uwagi**: 

---

## Podsumowanie testów manualnych

**Data testów**: _______________
**Tester**: _______________
**Wersja aplikacji**: _______________

**Wyniki**:
- Testy zakończone sukcesem: ___ / 18
- Testy zakończone niepowodzeniem: ___ / 18
- Testy pominięte: ___ / 18

**Znalezione problemy**:
1. 
2. 
3. 

**Rekomendacje**:
1. 
2. 
3. 

**Ogólna ocena**: ☐ PASS / ☐ FAIL / ☐ NEEDS IMPROVEMENT



