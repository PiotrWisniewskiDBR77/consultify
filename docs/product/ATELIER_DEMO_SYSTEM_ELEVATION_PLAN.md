# ATELIER TOYS — ELEWACJA DO SYSTEMU DEMONSTRACYJNEGO (spec budowy dla agentów)

> **Autor:** partner-CTO, 2026-07-03 · **Na zlecenie Piotra:** „profesjonalny system demonstracyjny, nie wysypisko danych — pokazywalny dziś klientowi, używalny dalej".
> **Miara jakości (jedyna):** każdy artefakt **podpisywalny nazwiskiem Piotra przed klientem** (konsultant HBS, MBA, 10 lat). ZERO pustych skorup. JEDNA spójna historia.
> **Zasada:** NIE budujemy od zera — **rozbudowujemy** `atelierToysDemoTemplate.ts` i **generujemy deliverables istniejącymi stylerami**.

---

## 1. FUNDAMENT — co JUŻ istnieje (nie ruszać, budować na tym)
- **Dataset (80-85% gotowy):** 18 inicjatyw bogatych · 35 tasków · 18 decyzji · 28 milestones · 5 wywiadów→1 insight→3 findings (spine-linked) · DRD 7 osi (baseline 3.3→target 5.0, raport APPROVED + 3 sekcje) · 7 raportów · 3 KPI z trendami · 1 model finansowy (Line 3, ROI 182%) · 8 Ideas (mindmap/flow/table/whiteboard) · 5 notebooks · 10 knowledge · 9 promptów.
- **Narracja:** Atelier Toys — producent STEM/robotyki, Lyon, ~250 osób; transformacja „Ateliertoy Forward"; 3 bottlenecki (OEE 74→82 · lead-time 6w→2w · digital ARR €6.2M→€8M); 3 flagshipy (Line 3 Digital Twin · Procurement Control Tower · Digital Growth). Spójna przez wszystkie moduły.
- **Silnik:** `seedAtelierToysDemoDataset()` = **upsert-only, idempotentny, bez kasowania** (stabilne ID `makeId(orgId,type,slug)`). Testy: koherencja spine + idempotencja (2×=ten sam stan).
- **Generacja deliverables:** stylery premium **DeckStyler (PPTX)** + **WorkbookStyler (XLSX)** + DOCX; skrypty `scripts/deliverables/_atelier-{report,deck,table}.mts`; próbki 3-pak w `docs/qa/deliverables/runs/ATELIER-*`.
- **Serwis ścieżki N→N+1** (Runda 4) — gotowy, do wpięcia.

## 2. LUKI → PAKIETY PRACY (gap-driven, wg priorytetu)
| WP | Luka | Waga | Zakres |
|----|------|------|--------|
| **WP-1** | Deliverables 2 → ~15 | 🔴 | 6 PPTX + 5 XLSX + 4 DOCX z realnych danych seed, styler premium, rejestr M17 z back-ref (DEC-1) |
| **WP-2** | Głębia finansowa | 🔴 | karta finansowa per top-10 inicjatyw (capex/opex, payback, ROI%, NPV) + 1 analiza wrażliwości |
| **WP-3** | Inicjatywy 18 → ~23 | 🟡 | 5 nowych verticali: People/Capability · Customer Experience · Sustainability/ESG · Innovation pipeline · Data&Analytics foundation. Każda: charter, 2-3 taski, 1-2 decyzje, milestones, ROI |
| **WP-4** | Assessmenty | 🟡 | +SIRI snapshot +ADMA snapshot + **wpięcie ścieżki N→N+1** do raportu DRD (serwis z R4) |
| **WP-5** | Ideas 8 → ~12 | 🟡 | +SWOT canvas +Porter 5F +Stakeholder map +Capability matrix (użyj silników tooli Oxford) |
| **WP-6** | Playbooki rolloutu | 🟡 | per flagship: Go/No-Go, plan komunikacji, protokół eskalacji ryzyka P1/P2/P3 |
| **WP-7** | Bramki+promocja | 🟢 | automat: „no-empty-shell" check + coherence + dry-run→approval→write→readback (prod) |

## 3. STANDARDY JAKOŚCI (obowiązują każdy artefakt)
- **Inicjatywy:** `INITIATIVE_FORMULA.md` (charter/KPIs mierzalne/RAID/owner/budget/ROI).
- **Wnioski i outputy:** `CONCLUSION_LAYER_STANDARD.md` (co jest→co znaczy→co robić najpierw→jaki efekt; liczby tylko z silnika).
- **Karty:** `CARD_CONTENT_FORMULA.md`.
- **Deliverables:** stylery premium; treść WYŁĄCZNIE z realnych danych Atelier; zero placeholderów/„Executive draft".
- **Bramka nadrzędna:** „konsultant HBS pokazałby to klientowi?" + „widać sens bez szukania?".

## 4. WP-1 DELIVERABLES — dokładna lista (15)
**PPTX (6):** (1) 3-letnia narracja strategiczna „Ateliertoy Forward" · (2) Board QBR deck · (3-5) charter-deck 3 flagshipów (Line 3 Twin / Procurement Tower / Digital Growth) · (6) Capability roadmap.
**XLSX (5):** (1) Prognoza P&L 3-letnia · (2) Tracker budżetu capex/opex · (3) Skonsolidowany dashboard KPI · (4) Risk heat map · (5) Partner pipeline scorecard.
**DOCX (4):** (1) Program charter · (2) Roadmapa transformacji · (3) Lessons-learned pack · (4) Playbook (rollout+quality).
Każdy: generowany stylerem z seedu → zarejestrowany w M17 z back-ref do inicjatywy/źródła → PDF-ready.

## 5. SEKWENCJA BUDOWY (łańcuch danych — kolejność krytyczna)
1. **Rozszerz template** (WP-3 inicjatywy + WP-2 finansowe + WP-4 assessmenty + WP-5 ideas) — bo deliverables karmią się z danych.
2. **Seed additive** (upsert, bez delete) na demo org `atelier`.
3. **Generuj deliverables** (WP-1) z zseedowanych danych → rejestr M17 z back-ref.
4. **WP-6 playbooki** → knowledge/deliverables.
5. **WP-7 bramki** + weryfikacja.
6. **Publikacja:** demo → (po zielonym odbiorze Piotra) prod org `ateliertoys-demo` (additive upsert, już promowana/V8-on).

## 6. BEZPIECZNA PUBLIKACJA demo + prod
- **Demo:** additive upsert na `atelier` (NIE full-rebuild `db:seed:atelier` jeśli chcemy zachować żywe sesje — użyj ścieżki `seedAtelierToysDemoDataset` bez delete).
- **PROD (za jawną zgodą Piotra — granica nieodwracalna):** org `ateliertoys-demo` **już istnieje** (promowana 2026-03-28, V8-on, user `anna.zielinska@ateliertoys-demo.com`). Reconcile org-id (`align-atelier-data-to-demo-org.ts`). **NIGDY delete. Sekwencja: dry-run→readback→zgoda→write→readback→48h monitoring (CP-10).** Zero dotknięcia `dbr77` i innych orgów.

## 7. DEFINITION OF DONE (bramki weryfikacji)
- ✅ test koherencji spine zielony · ✅ test idempotencji zielony.
- ✅ **„no-empty-shell":** każda inicjatywa ma owner+budget+ROI+≥1 task+≥1 decyzję; każdy deliverable ma treść+back-ref; każdy assessment ma raport.
- ✅ golden-path round-trip probe na demo (utwórz→zapisz→reload→to samo wraca).
- ✅ wizualny sample każdego typu deliverable jako PDF (dowód „podpisywalne").

## 8. PODZIAŁ NA AGENTÓW (dispatch — propozycja)
Fala ~7 agentów Opus w worktree, rozłączne WP · Fable projektuje spójność narracji 5 nowych verticali (żeby nie rozjechać historii) · Sonnet = treść deliverables/playbooków · orkiestrator = merge zbiorczy + seed + weryfikacja. Kolejność wg §5 (template przed deliverables).

## 9. HORYZONT: DZIŚ (16:00) vs PEŁNY SYSTEM
- **DZIŚ pod klienta:** seed OBECNEGO (już dobrego) datasetu na demo + wygeneruj 3 priorytetowe deliverables (strategy deck · dashboard KPI · program charter) + golden-path verify + 1 ukończony DRD. To wystarcza na „wygląda jak HBS case".
- **PEŁNY (95%+):** cała fala WP-1..7 — noc/kolejny dzień. Prod dopiero po odbiorze Piotra na demo.
