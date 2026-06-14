# ZADANIE #13 (SYSTEMOWE / P1-design) — Wywiad jako jeden przepływ + bramka oceny AI+człowiek

> Głęboka analiza + propozycja na zlecenie właściciela 2026-06-13 (live test). Oparta na pełnym inwentarzu kodu M10 (file:line) + best-practice rynkowym. Cel: moduł Wywiad = jeden, przejrzysty, działający przepływ end-to-end z systemem dopuszczania. Status: PROPOZYCJA do akceptacji.

---

## 1. Cel właściciela (dwie rzeczy)
1. **System zatwierdzania (dopuszczania) odpowiedzi:** AI ocenia i podpowiada, czego brakuje; poniżej progu jakości system NIE wypuszcza użytkownika; po przekroczeniu progu do nadawcy dociera ocena + rekomendacja; nadawca może **zatwierdzić** lub **wysłać do ponownego uzupełnienia**. Dziś brak widocznych przycisków zatwierdzania.
2. **Jeden przepływ:** template → przydział → wypełnienie → bramka dopuszczenia → insighty → inicjatywy. Menu boczne ma pokazywać CAŁE flow; wewnątrz narzędzi też mają być przyciski „następny krok".

## 2. Rewelacja z analizy: ~70% maszynerii JUŻ ISTNIEJE (doradcza, ukryta)
Inwentarz kodu (`src/components/Interview/InterviewHub.tsx`, `InterviewWorkspace.tsx`, `InterviewSingleQuestionRuntime.tsx`, `server/src/controllers/InterviewController.ts`):

**ISTNIEJE i działa:**
- 6 stage'y jako zakładki: Inbox / Sesje / Przydzielone / Szablony / Wnioski / Inicjatywy (`InterviewHub.tsx:1390-1397`).
- **State machine 6-statusowa**, egzekwowana serwerowo: `assigned→in_progress→submitted→sent_back→approved→completed` (`InterviewHub.tsx:637`).
- **AI-ocena na submit:** `evaluateSessionAnswers` → `ai_review_snapshot_json` z `overallScore`, `overallVerdict` (`ready_for_approval|needs_improvement|insufficient|empty`), `weakAnswerMap`, `recommendations` (`InterviewController.ts:3519-3542`).
- **Zatwierdzanie (manager):** `approveAssignment` z twardą bramką completeness ≥50% (409 jeśli mniej) (`:3799,:3850`); status→approved, sesja→completed.
- **Send-back:** `sendBackAssignment` z obowiązkowym powodem + checklistą missing items (z `weakAnswerMap`) → status wraca do in_progress, respondent poprawia (`:3592`).
- **Pre-submit quality gate** (modal słabych odpowiedzi: brak / <20 znaków) — ale **bypassowalny** „Wyślij mimo to" (`InterviewWorkspace.tsx:1326-1374`).
- **Audyt decyzji:** `review_decision_memory_json` z alignment AI↔człowiek (`:373-400`).
- **Insighty:** generowane z approved/completed sesji; handoff „CO DALEJ" → Raport/Deck/Tabela/Notatka/Idea/Inicjatywa (`InsightViewer.tsx`).

**BRAKUJE (vs wizja właściciela):**
1. **Score nietrwały** — AI-ocena liczona, ale nie persystowana/nie pokazywana (placeholder „brak pola" `InterviewHub.tsx:8073`).
2. **Brak twardego progu jakości** — tylko completeness ≥50% blokuje approve; jakość AI jest doradcza, manager może zignorować.
3. **Submit niezablokowany** — respondent może wysłać niekompletne/słabe (gate bypassowalny); pytania wymagane nieegzekwowane przy submit.
4. **Powiadomienie approve bez score/rekomendacji** — generyczne (`:3905`).
5. **Brak wizualizacji przepływu** — 6 płaskich zakładek, zero sekwencji; brak przycisków „następny krok" (approve→„Utwórz insight"; insight→inicjatywa istnieje, ale reszta nie).
6. **Brak prowadzenia stage→stage** — insighty tylko ręcznie; approve nie sugeruje następnego kroku.

## 3. Best-practice rynkowy (human-in-the-loop)
- **AI proponuje, człowiek decyduje** (HITL): model sugeruje ocenę/kody, analityk akceptuje/poprawia/odrzuca; rozbieżności wracają do modelu. Nie auto-blokować w pełni na AI — jakość ostatecznie waliduje człowiek.
- **Próg kalibracji**: jeśli AI myli się >30%, najpierw popraw prompty — czyli twardy auto-block tylko dla obiektywnej niedostateczności (puste/za krótkie/wymagane-brak), a ocenę jakościową ESKALUJ do człowieka ze score+rekomendacją.
- **AI bywa nadgorliwe** (over-granular) → krok konsolidacji/przeglądu człowieka.
Źródła: [Displayr — AI coding open-ends 2026](https://www.displayr.com/9-ai-methods-to-code-open-ended-survey-responses-in-2026/), [Thematic](https://getthematic.com/insights/analyze-open-ended-survey-responses), [Approveit — AI approval thresholds 2025](https://approveit.today/blog/purchase-order-approval-workflow-with-ai-rules-thresholds-templates-(2025)).

## 4. PROPOZYCJA

### 4a. Bramka dopuszczenia — dwustopniowa (egzekwuj to, co już liczymy)
**Stopień 1 — respondent (przy „Wyślij"):** twardy auto-block TYLKO dla obiektywnej niedostateczności: pytania wymagane bez odpowiedzi + `overallVerdict === 'empty'/'insufficient'`. Modal pokazuje „czego brakuje" (z `weakAnswerMap`) i **NIE pozwala wysłać** dopóki nie uzupełni minimum (usuń „Wyślij mimo to" dla twardego floora; zostaw dla `needs_improvement`). → realizuje „do jakiegoś poziomu nie wypuszcza użytkownika".
**Stopień 2 — nadawca (po submit):** persystuj `overallScore`+verdict (nowa kolumna/use `ai_review_snapshot_json`), w powiadomieniu approve/submit przekaż **score + rekomendację** (`:3905`). Nadawca w panelu reviewera: **Zatwierdź** / **Wyślij do ponownego uzupełnienia** (oba już istnieją — uwidocznić jako wyraźne przyciski; dziś ukryte w reviewer-mode). HITL: AI doradza, nadawca decyduje.

### 4b. Jeden przepływ — wizualizacja + przyciski „następny krok"
- **Menu boczne / topbar modułu jako PIPELINE** (numerowany, ze stanem): `① Szablony → ② Przydział → ③ Wypełnienie → ④ Dopuszczenie → ⑤ Wnioski → ⑥ Inicjatywy`. Każdy etap z badge'em „ile czeka" (np. ④ „3 do oceny"). Zastępuje 6 płaskich zakładek.
- **Przyciski stage→stage WEWNĄTRZ narzędzi** (afordancja „co dalej”, której brak): po `approved` → CTA „Utwórz wniosek z tej sesji"; we wniosku → „Zaproponuj inicjatywę" (istnieje); szablon opublikowany → „Przydziel"; submit → nadawcy „Oceń". Auto-sugestia, nie auto-wykonanie (HITL).
- **Stan „gotowe do następnego etapu"** jako sygnał (badge/inbox nadawcy), zamiast ręcznego odkrywania zakładki Wnioski.

### 4c. Co REUŻYĆ (nie budować od zera)
`evaluateSessionAnswers` + `ai_review_snapshot_json` (score/verdict/weakAnswerMap/recommendations); `approveAssignment`/`sendBackAssignment` + reviewer-mode UI; `review_decision_memory_json`; handoffy „CO DALEJ". Praca to głównie: **persystencja score, egzekucja progu, ujawnienie przycisków, powiadomienie ze score, warstwa wizualizacji pipeline + CTA następnego kroku.**

## 5. Decyzje produktowe — ZATWIERDZONE 2026-06-13 (właściciel: „zgadzam się, zróbmy jak piszesz")
1. **Próg twardego blocku** = TYLKO obiektywna niedostateczność (puste / wymagane-brak / verdict `insufficient`/`empty`). Ocena jakościowa = ESKALACJA do nadawcy ze score+rekomendacją, NIE auto-block (HITL). ✅
2. **„Nie wypuszcza użytkownika"** = blokuje SUBMIT (wysłanie), nie wyjście. Draft zapisywalny, można wrócić. ✅
3. **Zatwierdzający** = NADAWCA (ten, który przydzielił) + posiadacze `INTERVIEW_ASSIGN_MANAGE`. (Wierne pierwotnej intencji właściciela „zatwierdza ten, który nadawał".) ✅
4. **Pipeline** = przeramować 6 zakładek w numerowany przepływ ①–⑥ z badge'ami stanu (nie osobny pasek nad zakładkami; same zakładki stają się sekwencją). ✅

## 6. Ryzyka / uwagi
- Duża powierzchnia (`InterviewHub.tsx` ~12k linii) — falami; egzekucja progu to zmiana zachowania produkcyjnego (VTS wave 2 live!) → ostrożnie, bo zbyt twardy block frustruje respondentów; HITL łagodzi.
- Nie kolidować z Uwagą #12 (voice STT) — ta sama ścieżka wypełniania.
- Łączy się z klastrem „trzeci panel/flow" (#1/#6/#7/#10): „następny krok" i otwieranie encji in-context to ten sam wzorzec.

## 7. Szacunek (falami)
- F1 (egzekucja+score+powiadomienie): średni, backend+FE, reużycie istniejącego.
- F2 (przyciski następnego kroku stage→stage): mały/średni, FE.
- F3 (pipeline w menu): średni, FE + model stanu „ready for next".
