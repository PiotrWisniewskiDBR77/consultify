# 06: Macierz Odpowiedzialności (RACI) — DBR77 Marketplace

Tabela ról: kto odpowiada za dostarczenie danych, walidację, interpretację wyników. Podział: Klient vs. System DBR77 vs. Integratorzy vs. Zespół DBR77.

---

## Legenda RACI

| Litera | Znaczenie |
|--------|-----------|
| **R** | Responsible — wykonuje pracę |
| **A** | Accountable — ostatecznie odpowiedzialny, zatwierdza |
| **C** | Consulted — konsultowany przed decyzją |
| **I** | Informed — informowany o wyniku |

---

## 1. Publikacja i weryfikacja Challenge

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Zdefiniowanie wymagań technicznych | **R** | I | — | — |
| Uzupełnienie opisu (AI-assisted) | **R** | **R** (AI) | — | — |
| Konfiguracja NDA | **R/A** | **R** (infra) | — | — |
| Wysłanie Challenge do weryfikacji | **R** | **R** | — | — |
| Weryfikacja kompletności i jakości | — | **R** | — | **A** |
| Publikacja Challenge | — | **R** | — | **A** |
| Tłumaczenie treści | — | **R** (DeepL) | — | I |

---

## 2. Dopasowanie i składanie Solution

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Dopasowanie AI (matching) | — | **R** | I | — |
| Powiadomienie integratorów | — | **R** | I | — |
| Podpis NDA (jeśli wymagane) | **A** (udostępnia) | **R** (DocuSign) | **R** (podpisuje) | — |
| Dostarczenie Solution | — | — | **R** | — |
| Walidacja formatu Solution | — | **R** | — | — |
| Ocena techniczna Solution | **R/A** | I | I | — |

---

## 3. Oferta i negocjacja

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Utworzenie Offer | — | — | **R** | — |
| Kalkulacja prowizji | — | **R** | I | — |
| Przejrzenie i akceptacja Offer | **R/A** | I | I | — |
| Negocjacja (counter-offer) | **R** | **R** (workflow) | **R** | — |
| Interpretacja warunków | **R** | — | **R** | C (KAM) |

---

## 4. Kontrakt i realizacja

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Generacja dokumentu umowy | — | **R** | — | — |
| Podpis umowy (DocuSign) | **R** (pierwszy) | **R** (infra) | **R** (drugi) | — |
| Definicja milestones | **C** | — | **R** | — |
| Dostarczenie deliverabli | — | — | **R** | — |
| Zatwierdzenie milestone | **R/A** | I | I | — |
| Eskalacja overdue (>24h) | I | **R** | I | **R** (Operations Hub) |

---

## 5. Komunikacja i spotkania

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Planowanie Zoom | **R** lub **R** | **R** (integracja) | **R** | — |
| Q&A przy Challenge | **R** | **R** (moderacja) | **R** | — |
| Leak detection (PII) | — | **R** | — | **R** (review flagged) |

---

## 6. Płatności i prowizja

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Płatność za projekt (do integratora) | **R** | I | **A** (odbiorca) | — |
| Prowizja DBR77 | — | — | **R** (płaci) | **A** (windykacja) |
| Fakturowanie prowizji | — | **R** | I | — |

---

## 7. Ocena i reputacja

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Wystawienie Rating po projekcie | **R** | **R** (workflow) | **R** | — |
| Mutual release ratings | — | **R** | — | — |
| Aktualizacja Whitelist | — | **R** | — | — |
| Interpretacja reputacji | **R** | I | **R** | — |

---

## 8. Support i administracja

| Działanie | Klient (Producent) | System DBR77 | Integratorzy | Zespół DBR77 |
|-----------|-------------------|--------------|--------------|--------------|
| Zgłoszenie problemu | **R** | I | **R** | **A** |
| Weryfikacja Tax ID | — | **R** | — | **R** (fallback) |
| Zarządzanie użytkownikami / firmami | **R** (własne) | **R** | **R** (własne) | **R** (admin panel) |
| KAM (Key Account Manager) | C | — | — | **R** |

---

## Podsumowanie ról

| Strona | Główna odpowiedzialność |
|--------|--------------------------|
| **Klient (Producent)** | Definicja wymagań, NDA, wybór Solution/Offer, zatwierdzanie milestones |
| **System DBR77** | Matching, workflow, NDA/Contract, prowizja, audit, tłumaczenia |
| **Integratorzy** | Solution, Offer, realizacja projektu, płatność prowizji |
| **Zespół DBR77** | Weryfikacja Challenge, support, KAM, Operations Hub, administracja |
