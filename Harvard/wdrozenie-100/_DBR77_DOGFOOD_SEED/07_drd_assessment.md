# DRD Assessment — DBR77 (profil dojrzałości cyfrowej, 7 osi)

**Werdykt (answer-first):** DBR77 jest „szewcem bez butów" — dostarcza diagnostykę Industry 4.0 klientom, a własna dojrzałość jest **asymetryczna**: bardzo wysoka w AI/Danych (rdzeń produktu), niska–średnia w Cyfrowych Modelach Biznesowych i Kulturze/Skali (co jest DOKŁADNIE tym, co ma naprawić scale-up). Średnia ważona current ≈ **2.9/max**, target 24-mies ≈ **4.2/max**. Największe luki = osie 3 (Modele Biznesowe) i 5 (Kultura Transformacji) — spójne z tezą programu: firma umie robić technologię, musi nauczyć się ją SKALOWAĆ jako produkt.

> Skale mieszane per oś (levelCount 5/6/7). Poniżej: current→target w skali osi + normalizacja %.

## Oś 1 — Digital Processes (levelCount 7)
- current **3/7** (43%) → target **5/7** (71%). Gap: 2.
- Procesy delivery częściowo ad-hoc, zależne od kluczowych ludzi; brak ustandaryzowanych playbooków (to buduje INI-3). Obszary mocne: wewnętrzne narzędzia diagnostyczne. Słabe: powtarzalność wdrożeń, onboarding.
- [ZAŁOŻENIE] wdrożenia dziś „rzemieślnicze" — produktyzacja = cel.

## Oś 2 — Digital Products (levelCount 5)
- current **3/5** (60%) → target **5/5** (100%). Gap: 2.
- Ma działające moduły diagnostyczne (rdzeń), ale przed GA jako SaaS (INI-2, GA +15mies). Brak: self-serve, time-to-value <14 dni, multi-tenant.

## Oś 3 — Digital Business Models (levelCount 5) — LUKA #1
- current **2/5** (40%) → target **4/5** (80%). Gap: 2.
- Model wciąż project/delivery-centryczny (one-off), ARR ~0.5M. Cel: recurring 3M ARR, retencja NRR≥100%. To rdzeń transformacji modelu — najtrudniejsze, bo wymaga zmiany DNA sprzedaży i CS.

## Oś 4 — Data Management (levelCount 7)
- current **4/7** (57%) → target **6/7** (86%). Gap: 2.
- Silna strona: dane z wdrożeń = element moatu. Ale: brak sformalizowanego data governance/lineage dla skali multi-klient (BDSG/ISO potrzebne przed DACH — INI-5 bramka).

## Oś 5 — Culture of Transformation (levelCount 6) — LUKA #2
- current **2/6** (33%) → target **4/6** (67%). Gap: 2.
- Kultura inżynierska (mocna technicznie), ale nie „scale-up/product-led"; brak ról produktowych, CS, DACH. Bottleneck talentowy (<50 senior/rok) wzmacnia lukę. INI-1 Talent to adresuje.

## Oś 6 — Cybersecurity (levelCount 6)
- current **3/6** (50%) → target **5/6** (83%). Gap: 2.
- Wystarczające dla PL SME, ale niedomknięte pod DACH/Mittelstand (BDSG, ISO 27001) — bramka przed INI-5.

## Oś 7 — AI Maturity (levelCount 5)
- current **4/5** (80%) → target **5/5** (100%). Gap: 1.
- Najmocniejsza oś — modele diagnostyki przemysłowej to core IP. Domknięcie: MLOps/monitoring modeli na skali produkcyjnej multi-klient.

## Synteza gapów → inicjatywy (spójność z programem)
1. Oś 3 (Modele Biznesowe) + Oś 2 (Produkt) → **INI-2 Produkt+Moat** (GA, ARR, retencja).
2. Oś 5 (Kultura) → **INI-1 Talent** (role produktowe/CS/DACH).
3. Oś 4+6 (Data governance + Cyber) → bramka **INI-5 DACH** (zgodność).
4. Oś 1 (Procesy) → **INI-3 Delivery** (playbooki, powtarzalność).

**Anti-cross-record:** te same liczby (ARR 0.5→3M, GA +15mies, retencja NRR≥100%, talent <50/rok) jak w plikach 01-06 i planie v2 — jedna wartość per metryka.
