---
id: AGT-005
tytul: Koncept generatora procesu (domyślny schemat + klocki + mechanika dwóch ścieżek)
typ: spec
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: master
blokuje: [AGT-006, AGT-007, AGT-008]
zablokowane_przez: []
zrodlo: "Piotr 2026-07-22 (agent=generator procesu) + SPEC _SPEC_AGENT_VAULT_2026-07-22.md + DEC-002 + AGT-002"
utworzone: 2026-07-22
---

## 1. PROBLEM

Dzisiejszy „Run agent" to katalog 31 gotowych analiz. Piotr chce **generatora procesu konsultingowego**: nowy projekt → agent kładzie **gotowy schemat**, który user przestawia (ścieżka ①), albo user składa proces **z klocków** sam (ścieżka ②). Zanim ktokolwiek napisze kod, trzeba domknąć: jak wygląda domyślny schemat, jakie są typy klocków w v1 i jak działają obie ścieżki.

## 2. PRZYCZYNA

Nie dotyczy — to zadanie koncepcyjne (krok KONCEPT metody `consultify-fable-sesja`). Fundament techniczny znany z audytu (SPEC §3A): model `ai_agent_plans`/`steps` istnieje (potwierdzony na demo — 19/15 kolumn, dane obecne), silnik liniowy + approval gate działają, generator kroków to dziś sztywna tabela `planBuilderService`, jest martwy silnik DAG `toolChainExecutor` (rezerwa).

## 3. ROZWIĄZANIE

Koncept domknięty (przyjęty przez Piotra 2026-07-22):
1. **Domyślny schemat = SKRÓCONY 4-krokowy DRD** (decyzja Piotra): Discovery (Interview) → Ocena dojrzałości (Assessment, 7 osi 1–10) → Inicjatywy + roadmapa + ROI (Initiatives + Finance) → Efekty (Results + deck/Materials). Literalne odwzorowanie „Digital Roadmap" z książki + walidacja efektów. Wariant pełny 6-krokowy = rozwinięcie na później, nie domyślny.
2. **Klocek = etap przez realny moduł** (przewaga nad Harveyem, u niego klocek = czynność na dokumentach).
3. **Typy klocków v1:** Etap-moduł · AI/Teresa · Vault-kontekst (3 poziomy z VLT-001) · Bramka akceptu.
4. **① AI proponuje:** agent kładzie domyślny 4-krokowy schemat i dostraja pod kontekst (słabe osie z Assessment, dokumenty z Vault). **② ręcznie:** user dodaje/usuwa/przestawia klocki (v1 liniowy, DEC-002).
5. **Wykonanie:** liniowo w tle, bramka zatrzymaj→popraw→wznów. Mapowanie na `plan_json`/`ai_agent_plan_steps`.
6. **Na partię 3:** klocek realnie odpala moduł (w v1 generuje deliverable etapu); ożywienie martwego paska journey A–F (`useJourneyProgress` = dziś mock); rozgałęzienia (DAG `toolChainExecutor`).

## 4. KRYTERIUM ODBIORU

Piotr akceptuje koncept jako podstawę do rozpisania AGT-006/007/008 na twardo. **Spełnione 2026-07-22.**

## 5. DOWODY

**Koncept przedstawiony Piotrowi (obrazek + opis) 2026-07-22.** Oparty na dowodach z repo `origin/demo` (research metodyki):
- Proces DRD 5 etapów: `docs/videos/scripts/08_help_ai_journey/INDEX.md`, `01-system-overview.md:15-17`.
- 3 kroki „Digital Roadmap" z książki: `knowledge/tool-kb/drd/methodology/v1/drd-methodology-axis0-intro.en.md`.
- 7 osi DRD: `server/src/data/drdStructure.ts:8-14`.
- Fazy journey A–F (mock): `src/hooks/useJourneyProgress.ts:24-34`, `src/components/Journey/JourneyProgressBar.tsx:16`.
- Kolejność modułów: `src/components/navigation/Sidebar/menuConfig.ts`.
**Decyzja Piotra:** koncept „gra — domykaj". Domyślny schemat: **klasyczny 5-fazowy konsulting (Kubr/ILO)** — patrz dziennik (korekta 2026-07-22).

## 6. DZIENNIK

**2026-07-22** — utworzone jako brama koncepcyjna partii 2, wykonane przez Mastera (Fable). Koncept oparty na metodyce z repo (nie zgadywany). Piotr zaakceptował werbalnie koncept OK. Przeniesione do do-odbioru; odblokowuje AGT-006/007 (zależność [AGT-005] usunięta z nich), AGT-008 zostaje zależne od VLT-001. Formalny odbiór (→ odebrane) należy do Piotra.
**2026-07-22 — KOREKTA domyślnego schematu.** Piotr: „weź klasyczny konsulting jako pierwszy test" → domyślny = **klasyczny 5-fazowy proces (Kubr/ILO)**: Wejście→Diagnoza→Rekomendacje→Wdrożenie→Zamknięcie (zbieżny z McKinsey/BCG, research 2026-07-22). **DRD (4-krokowy) schodzi do WARIANTU** w bibliotece. Zmiana propagowana do AGT-006 (KRYTERIUM) i AGT-007. Reszta konceptu (klocki, dwie ścieżki, wykonanie) bez zmian.
