---
id: AGT-006
tytul: Backend — generator kroków zamiast sztywnej tabeli (domyślny = klasyczny 5-fazowy konsulting)
typ: zadanie
waga: wysoka
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: [AGT-009]
zablokowane_przez: []
zrodlo: "SPEC _SPEC_AGENT_VAULT_2026-07-22.md §4 + koncept AGT-005 (zaakceptowany) + decyzja Piotra 2026-07-22 (klasyka zastępuje DRD)"
utworzone: 2026-07-22
ekran: agent-plan-canvas
wysokosc: 820
klik: "Sprawdź generator kroków zamiast sztywnej tabeli."
---

## 1. PROBLEM

Agent nie „proponuje procesu" — dostaje sztywno zakodowany playbook per manifest. Nie da się zacząć od gotowego, rozpoznawalnego schematu konsultingowego dostrojonego do projektu.

## 2. PRZYCZYNA

`server/src/services/ai/agentPlan/planBuilderService.ts` — deterministyczna tabela `manifest-id → playbook` (świadomie NIE-LLM). Brak generowania kroków z opisu/kontekstu.

## 3. ROZWIĄZANIE

Wg konceptu AGT-005 + decyzji Piotra 2026-07-22 (**klasyczny konsulting zastępuje DRD jako domyślny**): `planBuilderService` produkuje **domyślny schemat = klasyczny 5-fazowy proces konsultingowy (Kubr/ILO)** i dostraja go pod kontekst:
1. **Wejście / Kontraktowanie** → Chat · My Work → brief, zakres, cel.
2. **Diagnoza** → Interview · Assessment → stan obecny, dane, problem.
3. **Rekomendacje** → Initiatives · Finance → warianty, priorytety, ROI.
4. **Wdrożenie** → Execution → plan, zadania, kamienie.
5. **Zamknięcie** → Results · Materials → efekty, deck, przekazanie.
Zbieżny z McKinsey/BCG (dowód: research 2026-07-22). **DRD (4-krokowy) schodzi do WARIANTU** w bibliotece procesów — generator umie oba, domyślny to klasyczny 5-fazowy. Dostrajanie (LLM-planner albo reguły z kontekstu klienta/Vault) modyfikuje kroki. Zapis do `plan_json`/`ai_agent_plan_steps`. Model liniowy (DEC-002); `toolChainExecutor` (DAG) = rezerwa partii 3.

## 4. KRYTERIUM ODBIORU

Sonda HTTP na demo (nie „testy przeszły"): utworzenie planu dla nowego projektu zwraca **5 faz klasycznego procesu** (Wejście→Diagnoza→Rekomendacje→Wdrożenie→Zamknięcie) we właściwej kolejności z modułami/deliverables jak wyżej (nie generyczny/pusty playbook). Druga sonda z innym kontekstem → schemat dostrojony. Wariant DRD dostępny do wyboru. Dowód: ciała odpowiedzi.

## 5. DOWODY

Gałąź `feat/agt-006-generator` (`33feb0bb2b`, `77909f2fbd`, baza origin/demo). Nie pushowana.
- ZBUDOWANE: `server/src/services/ai/agentPlan/processLibraryService.ts` — biblioteka procesów (id→lista faz), `DEFAULT_PROCESS_ID='classic-5'`. **classic-5** = 5 faz Kubr/ILO (Wejście→Diagnoza→Rekomendacje→Wdrożenie→Zamknięcie) z modułami (My Work·Chat / Interview·Assessment / Initiatives·Finance / Execution / Results·Materials) i deliverables; **drd** = 4 kroki (wariant). Każda faza→1 krok `{toolName,toolInput}` z `toolDefinitions.ts`, metadane fazy (phase/module/deliverable) → `ai_agent_plan_steps.tool_input_json`.
- WIRING: `server/src/routes/ai/agent-plan.routes.ts` — pola `processId`+`processContext`, `buildStepsFromProcess` (precedencja steps>manifestId>processId). Dostrajanie = reguły deterministyczne (`applyContextTuning`); LLM-planner świadomie NIE dodany (ryzyko flaky, hook zostawiony).
- **★ Zweryfikowane przez Mastera (vitest): `processLibraryService.test.ts` 8/8 PASS** (domyślny=5 faz w kolejności z modułami/deliverables; DRD=4; fallback; dostrojenie). Route-level `agentPlan.routes.test.ts` 22/22 wg raportu wykonawcy. esbuild node/esm zielone; eslint 0 errorów.
- NIE ZWERYFIKOWANE (poza rolą): sonda HTTP live — wymaga deployu.

## 6. DZIENNIK

**2026-07-22** — utworzone przez Mastera (partia 2). Odblokowane po akcepcie AGT-005.
**2026-07-22 — decyzja Piotra: klasyczny 5-fazowy konsulting (Kubr) ZASTĘPUJE DRD jako domyślny schemat** („weź klasyczny konsulting jako pierwszy test"). KRYTERIUM zmienione z 4-krokowego DRD na 5-fazowy klasyczny; DRD = wariant w bibliotece. Model uznany (Kubr/ILO, zbieżny z McKinsey/BCG — research 2026-07-22).
**2026-07-23 — wykonane** (wykonawca Opus, gałąź `feat/agt-006-generator`). Generator jako `processLibraryService` (biblioteka procesów), domyślny classic-5 (5 faz), wariant drd. Master zweryfikował testy 8/8. → do-odbioru. **★ Wątpliwości do Piotra:** (1) domyślny proces ma 1 bramkę akceptu na końcu (Zamknięcie=`generate_report_section`) — potwierdzić czy nie chcesz bramki też przy Rekomendacjach; (2) w v1 mapowanie faza→narzędzie jest reprezentatywne (faza „Wdrożenie" woła `get_initiative_status` przegląd, nie tworzy realnych zadań) — realne odpalanie modułów = partia 3 (AGT-008 klocki).
