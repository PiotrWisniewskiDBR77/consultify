# Business Flow Completeness System (BFCS)

## Metodologia mapowania przepływów biznesowych

**Wersja:** 1.0.0  
**Data utworzenia:** 2026-01-11  
**Status:** Aktywna

---

## 1. Wprowadzenie

### 1.1 Cel metodologii

Business Flow Completeness System (BFCS) to metodologia zapewniająca **logiczną spójność aplikacji** poprzez systematyczne mapowanie i walidację przepływów biznesowych między modułami.

### 1.2 Problem który rozwiązujemy

W dużych aplikacjach SaaS często występuje sytuacja:

- ✅ Wszystkie komponenty są zaimplementowane
- ✅ Testy jednostkowe przechodzą
- ❌ **Brakuje spójności logicznej między modułami**

**Przykład:** Partner generuje kod rabatowy, ale:

- Nie ma gdzie go wprowadzić w panelu Admin
- SuperAdmin nie widzi analityki użycia kodów
- Billing nie uwzględnia rabatu na fakturze

### 1.3 Korzyści

| Korzyść            | Opis                                                |
| ------------------ | --------------------------------------------------- |
| **Kompletność**    | Pewność że każdy przepływ jest kompletny end-to-end |
| **Widoczność luk** | Systematyczna identyfikacja brakujących elementów   |
| **Dokumentacja**   | Jasna mapa zależności między modułami               |
| **Onboarding**     | Nowi deweloperzy rozumieją jak moduły współpracują  |
| **Planowanie**     | Łatwiejsze szacowanie wpływu zmian                  |

---

## 2. Kluczowe pojęcia

### 2.1 Przepływ biznesowy (Business Flow)

**Definicja:** Sekwencja akcji wykonywanych przez jednego lub więcej aktorów, która realizuje konkretny cel biznesowy i przechodzi przez wiele modułów aplikacji.

**Charakterystyka przepływu:**

- Ma jasno zdefiniowany **początek** (trigger) i **koniec** (outcome)
- Angażuje **wielu aktorów** (role użytkowników lub system)
- Przechodzi przez **wiele modułów** aplikacji
- Ma **mierzalny rezultat biznesowy**

### 2.2 Aktor (Actor)

Osoba lub system wykonujący akcje w przepływie:

| Typ aktora     | Przykłady           | Moduły                         |
| -------------- | ------------------- | ------------------------------ |
| **End User**   | Konsultant, PM      | My Work, Projects, Tasks       |
| **Admin**      | Admin organizacji   | Admin Panel (wszystkie sekcje) |
| **Partner**    | Partner biznesowy   | Partner Portal                 |
| **SuperAdmin** | Operator platformy  | SuperAdmin Panel               |
| **System**     | Cron jobs, webhooks | Background jobs, integrations  |

### 2.3 Moduł (Module)

Logicznie wydzielona część aplikacji z własnym UI i/lub API:

| Warstwa                 | Przykłady modułów                           |
| ----------------------- | ------------------------------------------- |
| **Frontend User**       | Dashboard, Projects, Assessment, My Work    |
| **Frontend Admin**      | Admin Overview, Team, Billing, Security     |
| **Frontend Partner**    | Partner Home, Referrals, Earnings           |
| **Frontend SuperAdmin** | Customers, Revenue, AI Infrastructure       |
| **Backend**             | auth.routes, billing.routes, partner.routes |
| **Database**            | Tabele, migracje                            |
| **External**            | Stripe, Email providers, LLM APIs           |

### 2.4 Punkt integracji (Integration Point)

Miejsce gdzie moduły muszą ze sobą współpracować:

| Typ                 | Opis                            | Przykład                                 |
| ------------------- | ------------------------------- | ---------------------------------------- |
| **Data dependency** | Moduł B potrzebuje danych z A   | Billing potrzebuje atrybucji partnera    |
| **Action trigger**  | Akcja w A wywołuje akcję w B    | Płatność Stripe → naliczenie prowizji    |
| **UI reference**    | UI w A odnosi się do danych z B | Settings pokazuje aktywny rabat partnera |
| **Validation**      | A waliduje dane używając B      | Rejestracja waliduje kod partnera        |

### 2.5 Luka (Gap)

Brakujący element w przepływie:

| Typ luki                | Opis                               | Severity  |
| ----------------------- | ---------------------------------- | --------- |
| **Missing UI**          | Brak komponentu w interfejsie      | 🔴 HIGH   |
| **Missing API**         | Brak endpointu lub metody          | 🔴 HIGH   |
| **Missing data**        | Brak pola/tabeli w bazie           | 🔴 HIGH   |
| **Missing integration** | Brak połączenia między modułami    | 🔴 HIGH   |
| **Mock data**           | Hardcoded dane zamiast prawdziwych | 🟡 MEDIUM |
| **Missing validation**  | Brak walidacji na styku modułów    | 🟡 MEDIUM |
| **Missing analytics**   | Brak widoczności/raportowania      | 🟢 LOW    |

---

## 3. Proces mapowania przepływu

### 3.1 Krok 1: Identyfikacja przepływu

**Pytania do zadania:**

1. Jaki jest **cel biznesowy** tego przepływu?
2. Kto jest **głównym aktorem** (kto inicjuje)?
3. Jacy **inni aktorzy** są zaangażowani?
4. Jaki jest **trigger** (co rozpoczyna przepływ)?
5. Jaki jest **oczekiwany outcome** (rezultat)?

**Przykład - Partner Referral Flow:**

```
Cel: Partner zarabia prowizję za poleconych klientów
Główny aktor: Partner
Inni aktorzy: Admin (klient), System, SuperAdmin
Trigger: Partner generuje kod rabatowy
Outcome: Partner otrzymuje wypłatę prowizji
```

### 3.2 Krok 2: Mapa aktorów i akcji

Dla każdego aktora zdefiniuj:

- Co **może** zrobić w tym przepływie
- Co **musi** zrobić aby przepływ przeszedł dalej
- Co **widzi** (jakie informacje)

**Format:**

```
AKTOR: [Nazwa]
├── MOŻE:
│   ├── [Akcja opcjonalna 1]
│   └── [Akcja opcjonalna 2]
├── MUSI:
│   └── [Akcja wymagana]
└── WIDZI:
    ├── [Informacja 1]
    └── [Informacja 2]
```

### 3.3 Krok 3: Mapa modułów

Zidentyfikuj wszystkie moduły zaangażowane w przepływ:

| Warstwa  | Moduł        | Rola w przepływie  |
| -------- | ------------ | ------------------ |
| Frontend | [nazwa]      | [co robi]          |
| API      | [endpoint]   | [co obsługuje]     |
| Service  | [nazwa]      | [logika biznesowa] |
| Database | [tabele]     | [jakie dane]       |
| External | [integracja] | [co dostarcza]     |

### 3.4 Krok 4: Sekwencja przepływu

Opisz przepływ krok po kroku w formacie:

```
[Numer]. [Aktor] → [Akcja] → [Moduł]
    Input: [co jest potrzebne]
    Output: [co jest rezultatem]
    Zależności: [od czego zależy]
```

### 3.5 Krok 5: Matryca zależności

Dla każdej funkcji w przepływie zdefiniuj:

| Funkcja | Lokalizacja  | Wymaga od innego modułu | Status   |
| ------- | ------------ | ----------------------- | -------- |
| [nazwa] | [moduł/plik] | [zależność]             | ✅/⚠️/❌ |

### 3.6 Krok 6: Identyfikacja luk

Przejdź przez przepływ i dla każdego kroku sprawdź:

- [ ] Czy UI istnieje i jest dostępne?
- [ ] Czy API endpoint istnieje?
- [ ] Czy dane są dostępne (nie mock)?
- [ ] Czy integracja działa?
- [ ] Czy są odpowiednie walidacje?
- [ ] Czy jest obsługa błędów?
- [ ] Czy jest logowanie/audit?

### 3.7 Krok 7: Action Items

Dla każdej luki stwórz action item:

```
GAP-[ID]: [Krótki opis]
  Typ: [Missing UI/API/Data/Integration]
  Severity: [HIGH/MEDIUM/LOW]
  Moduł: [gdzie trzeba naprawić]
  Zależności: [co musi być najpierw]
  Effort: [S/M/L/XL]
  Opis: [szczegóły co trzeba zrobić]
```

---

## 4. Dokumenty wynikowe

### 4.1 Struktura folderów

```
docs/
├── methodology/
│   └── BUSINESS_FLOW_MAPPING.md     # Ten dokument
├── templates/
│   ├── FLOW_ANALYSIS_TEMPLATE.md    # Szablon analizy
│   └── DEPENDENCY_MATRIX_TEMPLATE.md # Szablon matrycy
└── flows/
    ├── MASTER_FLOW_REGISTRY.md      # Rejestr wszystkich przepływów
    ├── GAP_ANALYSIS_SUMMARY.md      # Podsumowanie luk
    ├── partner/
    │   └── PARTNER_REFERRAL_FLOW.md
    ├── billing/
    │   └── SUBSCRIPTION_LIFECYCLE_FLOW.md
    ├── onboarding/
    │   └── USER_ONBOARDING_FLOW.md
    └── ai/
        └── AI_USAGE_LIMITS_FLOW.md
```

### 4.2 Nazewnictwo

| Element        | Format                    | Przykład                   |
| -------------- | ------------------------- | -------------------------- |
| Plik przepływu | `[DOMAIN]_[NAME]_FLOW.md` | `PARTNER_REFERRAL_FLOW.md` |
| ID przepływu   | `FLOW-[DOMAIN]-[NUM]`     | `FLOW-PARTNER-001`         |
| ID luki        | `GAP-[FLOW]-[NUM]`        | `GAP-PARTNER-001`          |
| ID action item | `ACTION-[FLOW]-[NUM]`     | `ACTION-PARTNER-001`       |

---

## 5. Priorytety przepływów

### 5.1 Kryteria priorytetyzacji

| Kryterium          | Waga | Opis                    |
| ------------------ | ---- | ----------------------- |
| **Revenue impact** | 40%  | Wpływ na przychody      |
| **User count**     | 25%  | Ile użytkowników dotyka |
| **Frequency**      | 20%  | Jak często jest używany |
| **Complexity**     | 15%  | Ryzyko błędów           |

### 5.2 Poziomy priorytetów

| Priorytet       | Opis                                    | Kiedy                |
| --------------- | --------------------------------------- | -------------------- |
| 🔴 **CRITICAL** | Blokuje revenue lub core funkcjonalność | Natychmiast          |
| 🟠 **HIGH**     | Wpływa na kluczowy przepływ biznesowy   | W tym sprincie       |
| 🟡 **MEDIUM**   | Poprawia jakość/UX                      | W następnym sprincie |
| 🟢 **LOW**      | Nice-to-have, optymalizacje             | Backlog              |

---

## 6. Proces utrzymania

### 6.1 Kiedy aktualizować dokumentację przepływu

- ✅ Dodanie nowej funkcji do przepływu
- ✅ Zmiana w strukturze modułów
- ✅ Zmiana w API/DB schema
- ✅ Naprawa zidentyfikowanej luki
- ✅ Zmiana aktorów lub uprawnień

### 6.2 Review cycle

| Częstotliwość      | Akcja                                 |
| ------------------ | ------------------------------------- |
| Po każdym sprincie | Aktualizacja statusów luk             |
| Miesięcznie        | Review kompletności przepływów        |
| Kwartalnie         | Przegląd całego rejestru              |
| Przy major release | Pełna walidacja wszystkich przepływów |

---

## 7. Narzędzia wspomagające

### 7.1 Szablony

- `docs/templates/FLOW_ANALYSIS_TEMPLATE.md` - Szablon pełnej analizy przepływu
- `docs/templates/DEPENDENCY_MATRIX_TEMPLATE.md` - Szablon matrycy zależności

### 7.2 Checklisty

Każdy szablon zawiera checklisty do odhaczania:

- [ ] Checklist identyfikacji przepływu
- [ ] Checklist mapowania aktorów
- [ ] Checklist mapowania modułów
- [ ] Checklist walidacji kompletności
- [ ] Checklist dokumentacji

---

## 8. Przykład użycia

### 8.1 Quick Start

1. **Wybierz przepływ** do zmapowania
2. **Skopiuj szablon** `FLOW_ANALYSIS_TEMPLATE.md`
3. **Wypełnij sekcje** zgodnie z instrukcjami
4. **Zidentyfikuj luki** używając checklisty
5. **Stwórz action items** dla każdej luki
6. **Dodaj do rejestru** `MASTER_FLOW_REGISTRY.md`

### 8.2 Pierwszy przepływ

Zalecamy rozpoczęcie od przepływu który:

- Dobrze znasz
- Ma jasne granice
- Angażuje 2-4 moduły
- Ma widoczne luki (wiesz że coś nie działa)

---

## Appendix A: Słownik terminów

| Termin                | Definicja                                          |
| --------------------- | -------------------------------------------------- |
| **BFCS**              | Business Flow Completeness System - ta metodologia |
| **Flow**              | Przepływ biznesowy end-to-end                      |
| **Actor**             | Użytkownik lub system wykonujący akcje             |
| **Module**            | Logicznie wydzielona część aplikacji               |
| **Integration Point** | Miejsce współpracy między modułami                 |
| **Gap**               | Brakujący element w przepływie                     |
| **Action Item**       | Zadanie do wykonania aby naprawić lukę             |

---

## Historia dokumentu

| Wersja | Data       | Autor        | Zmiany               |
| ------ | ---------- | ------------ | -------------------- |
| 1.0.0  | 2026-01-11 | AI Assistant | Utworzenie dokumentu |
