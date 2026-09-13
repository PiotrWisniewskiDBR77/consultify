# W05 — niezależny odbiór finalnego SHA

SHA `0dedb2345e0278475400e4d97ba3e6225ce51f9e`, C4 WT clean przed i podczas próby. Autor zamroził source/runtime. API4214 PID18429 i Vite5214 PID53977 mają cwd codex4-dlug-mvp; własna lokalna baza cx4_pilot:6455. Bez zmian produktu/restartów/live. Reviewer scope_audit nie jest autorem poprawki scoped review (był autorem wcześniejszej paczki bazowej Interview).

## Wynik

API/JWT/real PostgreSQL: niezależnie wykonane **43/43 PASS**, exit0, 8.80s. Pełny mianownik nazw w `server/src/routes/v8/__tests__/interviewReviewScope.pg.test.ts`. Z 38 zapisanych command probes 26 odmów ma identyczny pełny before/after hash assignment/session/history/notifications. Oba stosy approve/send-back: legalny projekt A, niedozwolony B mimo projectId z request, create-only, REVOKE, revoke membership, projektless, konflikt projektów, obca org/session, stary ADMIN JWT po kanonicznej degradacji, terminal retry. Odczyt detail/history i części sesji tylko w A; anonimowe odpowiedzi i manager PATCH odpowiedzi odmówione. Same-request memo test to rzeczywisty helper pod correlationMiddleware + transakcja PG; nie udaje dwusesyjnego HTTP race aż do COMMIT.

UI negative: **PASS**. Legalny A ma przyciski, po usunięciu własnego syntetycznego project membership approve403, przyciski znikają, pełny hash niezmienny. Pierwotne membership przywrócone przez finally. Nowy kontekst B: detail403, brak approve/send-back. Przed hashem zakończona evaluate200: pending0, finished1, quiet3943ms. Nie ma twierdzenia o braku future/background writes poza zmierzonym oknem. PNG revoke/B obejrzane: poprawny render i jawna odmowa.

Cykl UI: **PASS_ONE_RECORD**, proces exit0. `ui-sequential-robust/cycle-evidence.json`: assignment `87a55053-e242-45dc-9ec3-32c352958158`, session `f68bda55-ebae-4653-983d-9fde932f0050`. Respondent save→submit→submitted readonly; legal scoped manager return z powodem→respondent widoczny feedback i poprawa EUR4800→resubmit→manager approve→reload obu ról. Final SQL approved/completed, trzy immutable history (submission/send_back/submission), final answer EUR4800. Manager nie jest ownerem sesji. 12 PNG1440×900; obejrzane kluczowe feedback/resubmitted light/approved dark/respondent reload, poprawny układ, brak crash/white. JS pageerrors0; występują oczekiwane odmowy insights403 (nie twierdzimy zeroHTTPerrors), brak own-detail403 w pełnym cyklu.

**Bounded verdict: ACCEPT W05 scoped approve/send-back na exact0dedb.** Dopuszczenie tej paczki do integracji nie zamyka długu evaluate ani wszystkich zachowań Interview. Final git status pusty i SHA niezmienione po odbiorze. Backend/Vite pozostawione działające i zwolnione do integratora/autora; testowe procesy zakończone.

## Source review i ograniczenia

Shared helper bierze organization/project/session z utrwalonego assignment, sprawdza zgodność sesji i projektu, ponownie autoryzuje pod lock w obu writerach. Jawny non-GRANT nie jest review grantem; create nie zastępuje review. Drugi check usuwa dokładny request-memo key, zwykłe role legacy pobiera z active organization_members. UI hook wiąże wynik z actor/org/assignment i unieważnia po403/404. Session read fallback obejmuje tylko identified linked session, nie zmienia ownership mutation guard.

Istniejący `evaluate-answers` pozostaje oddzielnym długiem: auto-call na submitted może zapisać AI snapshot; handler nie ma scoped object authorization. Ten handler był identyczny w bazie865c i finalnej poprawce; szczegóły w W05_AI_EVALUATION_ACCESS_FINDING.md. API/renderer PASS scoped approve nie jest pełnym security PASS Interview.

SOURCE_RISK: InterviewHub effect przy linii1708 ma cancellation, ale `openInterviewAssignmentFull`6321–6369 po asynchronicznym getSession sam wywołuje handleOpenDocument bez tokena cancellation. Zmiana assignment/actor/org podczas oczekiwania może otworzyć stary dokument; nowy hook ponownie wiąże review z kontekstem, lecz runtime delayed-response cross-context NOT_PROVEN. Opener odziedziczony, nowy detail fallback go używa. Nie udowodniono nowego exploita ani blokera normalnego cyklu; wymaga osobnego bounded race testu.

## Przyrząd i evidence

Własny katalog `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/w05-independent-final`: api.log/api-result.json, negative/negative-evidence.json i PNG. State pliki SECRET, nie drukować/commitować.

Pierwszy cykl `ui/` niekwalifikowany: reviewer uruchomił negatyw z tym samym aktorem podczas cyklu; timeout manager reopen nie jest produktowym RED/PASS. Zachowany. Druga próba `ui-sequential/` zatrzymała się przed pierwszym submit: jednorazowy check po1s minął późniejszy dialog AI Submit anyway. PNG i brak submit POST dowodzą ograniczenia przyrządu. `ui-cycle-robust.mjs` poza produktem oczekuje modal-or-submitted do75s i używa tej samej istniejącej czynności Submit anyway. Bez wyłączania AI/gates ani resetu lifecycle; kontynuacja tego samego in_progress rekordu, wcześniejsze evidence zachowane.
