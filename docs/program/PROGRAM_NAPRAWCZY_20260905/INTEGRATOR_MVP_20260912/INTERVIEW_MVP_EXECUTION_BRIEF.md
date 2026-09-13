# MVP Interview — manager approve / send-back: paczka wykonawcza

12.09.2026. **READ-ONLY INTAKE, gotowe do różnicowej naprawy i odbioru; nie PASS produktu.** C4: `/Users/piotrwisniewski/Developer/codex-wt/codex4-dlug-mvp`. Bez wykonania testów, runtime, SQL, live i zmian repo w tej analizie. Numery linii są orientacyjne dla odczytanego C4, przed kodowaniem sprawdzić aktualny HEAD/integrację.

## 1. Mandat i minimalny rezultat

W `OWNER_VISION_20260912_ORIGINAL.txt`, punkt Interview, właściciel wprost przenosi **manager w panelu sesji może odesłać do poprawy albo zatwierdzić** do MVP. Nadpisuje to odłożenie samego zatwierdzania z dawnego 3.12 W2. Wariant AI/manager/dwa stopnie pozostaje szerszym doprecyzowaniem; do tej paczki wystarcza istniejąca jawna decyzja uprawnionego człowieka.

Jedno przypisanie, jedna sesja, ten sam respondent i odrębny manager:

`odpowiedź v1 → submit → manager otwiera kartę sesji → zwrot z powodem → respondent widzi powód, poprawia v2 → resubmit → manager porównuje historię, approve → obie osoby reload → approved/completed i poprawna v2 bez możliwości cichej edycji`.

Nie tworzyć nowej zakładki Dopuszczenie, nowego procesu review, nowych statusów ani silnika workflow. Rozmowa Teresy, generator wniosków/inicjatyw, AI onboarding i cała procedura dwustopniowa nie wchodzą do tej dostawy. Zachować dotychczasowe reguły anonimowości i widoczności; testować zwykłe, nazwane przypisanie, nie obchodzić privacy.

Źródła: `docs/modules/03_wywiad/CURRENT_CONTRACT.md`; `functions/WY_PENDING_REVIEW.md` i jego execution card; `docs/program/WEEKEND_COMPLETION_2026-08-01/AGREEMENTS/INTERVIEW_ANSWER_ASSISTANCE_AND_VERIFICATION_CONTRACT.md`. Ostatni ma status DRAFT_FOR_OWNER_REVIEW: nie traktować wszystkich jego rozszerzeń jako już zatwierdzonego zakresu MVP. Historyczny docs-only lock execution card dotyczył tamtego cyklu dokumentacyjnego; nową paczkę kodową wydaje integrator.

## 2. Obecny łańcuch — mechanizm istnieje

| Ogniwo | Dokładne źródło | Co robi |
|---|---|---|
| Hub, panel sesji | `src/components/Interview/InterviewHub.tsx:5978` | `renderDocumentContent` montuje prawdziwy `InterviewWorkspace` dla `interview_session`, przekazuje sessionId i onSessionChange |
| Menu sesji i przydzielone | `InterviewHub.tsx:2738–2805`, `:3016–3100`; `src/components/Interview/interviewActionMatrix.ts` | Istnieją approve/send-back w wierszu/podglądzie, modal powodu i odpowiedniki bulk. Nie budować drugich writerów |
| Deep-link z powiadomienia | `InterviewHub.tsx:592`, `:1713–1737` | Odczytuje assignmentId, odnajduje w my/managed i otwiera właściwą sesję; wymaga odbioru na realnych listach |
| Karta i uprawnienia do review | `src/components/Interview/InterviewWorkspace.tsx:294–318`, `:2062–2080`, `:3386` | Własny isReviewerMode: submitted + ownerId różny od currentUser.id. Sam ten warunek nie jest kontrolą uprawnienia managera |
| Decyzja w karcie | `InterviewWorkspace.tsx:1574–1664` | V8 sendBackAssignment(reason, missingItems) / approveAssignment; aktualizacja lokalnego assignmentInfo/status i sesji; jawny komunikat konfliktu/niepotwierdzonego wyniku |
| Klient API | `src/services/api/v8/interview.ts:615–665` | getManagedAssignments, start/submit/send-back/approve przez v8Get/v8Post; nie odtwarzać nieudanego approve/send-back na legacy |
| Serwerowe bramki | `server/src/routes/v8/interview.routes.ts:383–405`; `server/src/routes/interview.routes.ts:174–192` | Obie rodziny prowadzą do InterviewController; review wymaga INTERVIEW_ASSIGN_MANAGE. `server/src/services/workflow/gatePolicy.ts:64–91`: tylko submitted z sesją |
| Submit | `server/src/controllers/InterviewController.ts:4356–4698` | Walidacja assignment/respondenta, required/AI review, transakcja snapshotu+assignment submitted+session submitted+task, persisted AI review; powiadomienie created_by z linkiem `scope=managed` |
| Zwrot | `InterviewController.ts:4700–4944` | Wymagany niepusty reason, zapis missingItems/history/reviewDecisionMemory; jedna transakcja assignment in_progress + session active + opcjonalny task in_progress |
| Akceptacja | `InterviewController.ts:5006–5177` | submitted i completeness >=50%; jedna transakcja assignment approved + session completed + opcjonalny task done; zachowany ślad decyzji |
| Odbiorca decyzji | `InterviewController.ts:4872–4902`, `:5108–5139` | notificationService.send do assignee i team members, link `/interview?assignmentId=...`; powód zwrotu trwały w assignment niezależnie od powiadomienia |
| Poprawa / historia | `InterviewController.ts:4947–5004`, `:2189–2260`; `InterviewWorkspace.tsx:323–350`, `:501–508`, `:2424` | Historia submission/send_back, w karcie poprzednia odpowiedź i feedback; serwer blokuje submitted/completed przed zapisem pytań |

Status zwrotu w DB to **in_progress**, wraz z sent_back_at/reason i decyzją send_back. Nie zmieniać go na nowy obowiązkowy enum tylko dlatego, że tekst UI mówi „odesłane”. Historia zachowuje poprzedni zwrot po resubmit mimo wyczyszczenia bieżącego feedbacku.

## 3. Konkretne luki i ich kwalifikacja

### A. Potwierdzone statycznie: edytowalność submitted jest sprzeczna

`InterviewWorkspace.tsx:294–304` jawnie zakłada „submitted stays editable”; isLocked obejmuje approved/completed assignment lub completed session. Pytania, notatki, evidence, edytowalny tytuł korzystają z tego boola. Backend `LOCKED_SESSION_STATUSES = ['submitted', 'completed']` i istniejący real-PG test oczekują 409 przy zmianie submitted.

**Naprawa:** osobno określić możliwość edycji treści i możliwość decyzji review. Treść submitted read-only dla respondenta i reviewera; aktywne approve/send-back dla prawdziwego managera nie mogą zniknąć po prostym dodaniu submitted do isLocked. Po send-back active/in_progress poprawa odblokowana. Zablokować wywołanie zapisu także w handlerach, nie tylko textarea. Brak stanu assignment w trakcie ładowania nie może otwierać submitted session do edycji.

### B. Potwierdzone statycznie: callback karty nie aktualizuje statusu assignment w Hub

`InterviewHub.tsx:2464–2504` handleSessionChange aktualizuje sesję oraz zagnieżdżone assignment.session, ale zostawia assignment.status i sentBackReason/missingItems bez zmian. Decyzje w modalach Huba odświeżają listy, lecz decyzje w Workspace przekazują wyłącznie sesję. Możliwy stary status/action menu po powrocie z karty.

**Naprawa:** najwęższy callback po udanej decyzji/submit, który odświeża istniejące listy i panel albo przenosi kanoniczną odpowiedź assignment+session do tego samego read model. Nie zgadywać statusu assignment z samego session.status. Test musi wrócić do listy przed reloadem, a następnie po reloadzie.

### C. Potwierdzona luka logiczna w odczycie assignment; skutki per rola do pomiaru

`InterviewWorkspace.tsx:909–927`: najpierw getManagedAssignments().find(id), fallback do GET assignment działa tylko przy rejection. **200 bez poszukiwanego rekordu zwraca null i nie uruchamia fallbacku**. Ponadto fetchOptional zamienia 4xx pojedynczego GET w null, więc kolejny catch do listy my nie zadziała. Powód/receipt/status może zniknąć dla respondenta lub innego dozwolonego czytelnika, mimo poprawnego zapisu.

**Naprawa:** jawny odczyt właściwy dla roli i sprawdzenie wyniku, nie kaskada catch maskująca brak. Reużyć chronionego GET `/interview/assignments/:id` lub listy my w istniejącym kontrakcie uprawnień; nie zdejmować permission middleware. Pojedynczy GET obecnie wymaga INTERVIEW_ASSIGN_VIEW lub MANAGE (`interview.routes.ts:153–157`). Sprawdzić uprawnienie respondenta przed wyborem. Prawdziwy brak/odmowa musi być stanem błędu/ograniczenia, bez danych demo i bez fikcyjnej edytowalności.

### D. Potwierdzony niedostateczny warunek review w karcie

Workspace rozpoznaje reviewera jedynie po cudzym ownerId; nie używa permission hooka. Hub używa `src/hooks/useInterviewPermissions.ts` (canViewManaged/canAssign). To może pokazać czynność nieuprawnionemu czytelnikowi, chociaż serwer ją odrzuci. Odwrotnie manager będący ownerId sesji nie zobaczy review w Workspace mimo dozwolonej akcji w Hub/API.

**Naprawa:** reużyć uprawnienie zgodne z istniejącą trasą i zakresem projektu; stan ładowania fail-closed. Nie wprowadzać nowego zakazu samoooceny ani nowego przywileju tylko na podstawie ownerId. W odbiorze użyć dwóch osób. Sprawdzić różnicę między assignee_user_id a session.owner_id; nie są zastępowalnymi polami.

### E. Długi do bounded próby; nie udawać naprawy bez RED

- **Równoległe decyzje:** warunkowy UPDATE i transakcja chronią stan, ale rzucają zwykły Error `INTERVIEW_*_STATE_CONFLICT`; standardowy errorHandler bez statusCode klasyfikuje jako 500. Wykonać kontrolowany konkurencyjny approve/send-back; jeśli potwierdzi, nadać własnemu konfliktowi bezpieczny 409, bez surowego SQL. Nie przepisywać transakcji, które już działają.
- **Powiadomienia best-effort po COMMIT:** wyjątek jest tylko logowany; trwała decyzja może mieć 200 bez notyfikacji. Odbiór wymaga realnego wpisu i otwarcia linku dla obu stron. Pełny outbox/retry nie jest automatycznie częścią małego fixu; jeśli zwykły przebieg gubi odbiorcę/link, naprawić tę końcówkę i jawnie odnotować brak dowodu awarii kanału.
- **AI submit hard floor:** kod blokuje `empty/insufficient` z AI, podczas gdy starszy draft opisuje subiektywny sygnał jako soft. Nie zmieniać polityki z tej lektury. Aktualny cel managera można odebrać na kompletnych odpowiedziach; AI unavailable musi pozostawić deterministyczną walidację. Szerszy wybór AI/manager/dwa stopnie zostawić w kontrakcie do rozstrzygnięcia. Nie maskować tej różnicy stwierdzeniem „AI nigdy nie blokuje”.
- **Fallback submit:** `InterviewWorkspace.tsx:1397` retry V8→legacy po dowolnym błędzie; approve/send-back już go nie mają. Zmierzyć utratę odpowiedzi po zapisie: nie może podwajać submission/history ani komunikować fikcyjnego sukcesu. Usunąć ślepy retry jeśli RED potwierdzi; odzyskać status odczytem, nie drugą mutacją.

## 4. Minimalny manifest kodowania

Pliki podstawowe:

1. `src/components/Interview/InterviewWorkspace.tsx`: A/C/D, readback i wywołanie callbacka B; zachować istniejące sekcje akcji, reason i receipt.
2. `src/components/Interview/InterviewHub.tsx`: callback B i odświeżenie po decyzji w karcie, bez zmiany list/procedury.
3. `src/components/Interview/__tests__/InterviewWorkspace.managerReview.behavior.test.tsx` — nowy test montowanego komponentu z dwoma rolami i przełączeniem stanów. Jeżeli istniejący harness nie daje pełnego mount, mały współdzielony resolver może być testowany pomocniczo, ale nie zamiast renderu/kliknięcia.
4. `tests/e2e/interview-manager-review-real-pg.spec.ts`: rozszerzyć/zastąpić dowód dwóch oddzielnych rekordów jednym pełnym cyklem dwóch realnie zalogowanych osób; zachować odpowiedni dotychczasowy zakres.
5. `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts` i/lub `server/src/routes/interviewDelivery/__tests__/interviewPublishedAssignmentDelivery.pg.test.ts`: dopisać tylko brakujące readback/odbiorców/konflikt; nie kopiować istniejącego testu całego backendowego cyklu.

Warunkowo po RED: `server/src/controllers/InterviewController.ts` (typowany konflikt lub konkretny błąd odbiorcy/readback), `src/services/api/v8/interview.ts` (typ callbacka/odczytu), PL/EN `public/locales/*/translation.json` (uczciwy tekst submitted-readonly). `useInterviewPermissions.ts`, gatePolicy, oba route files i transakcja są najpierw reuse/read-only; modyfikacja wymaga wskazanego defektu, nie nowej polityki. Nie dotykać generatorów, migracji statusów, zatwierdzania inicjatyw ani globalnych flag.

## 5. Co istniejące testy rzeczywiście udowadniają

- `tests/acceptance/interview-submit-review-lifecycle.e2e.test.ts`: kod realnego routera+JWT+PG, submit/history, locked409, foreign404, respondent approve403, zwrot/poprawa/resubmit/akcept/history. **Nie przeglądarka, nie realny login, nie pełny ApiGateway**; AI mock failed fast. Nie uruchomiono w tym intake.
- `server/src/routes/interviewDelivery/__tests__/interviewPublishedAssignmentDelivery.pg.test.ts:289`: ten sam lifecycle po published delivery, pytanie patchowane przez HTTP i finalny SQL readback. Reużyć do prawdziwego stworzenia assignment/session, zamiast seedować już submitted.
- `tests/e2e/interview-manager-review-real-pg.spec.ts`: prawdziwe kliknięcia zwrotu jednego seeded submitted i akceptacji drugiego. Seed przypisuje zalogowaną osobę jako owner i respondent; UI przebieg jest z Przydzielone, nie pełna karta dwóch person. **Nie zamyka obecnego kryterium.** Guard URL testu jest regexem i interpoluje DATABASE_URL do błędu; przed użyciem przygotować ścisły lokalny preflight i bezpieczny komunikat bez URL/sekretów.
- `src/components/Interview/__tests__/InterviewApprovalLifecycle.ownerContract.test.ts`: czyta source tekst; pomocniczy strażnik transakcji i braku retry approve/send-back, nie dowód zachowania.
- `tests/unit/backend/controllers/InterviewAssignmentsController.test.ts`: submit/idempotency/required/AI scenariusze na mockach; zachować.
- `server/src/routes/v8/__tests__/interview.routes.test.ts`: obudowa V8; oraz `interviewActionMatrix.contract.test.tsx`, preview ownerBehavior: menu/kontrakt jako regresja, nie zamiennik E2E.

## 6. Odbiór krok po kroku na własnym runtime

Integrator przydziela izolowane zasoby przed wykonaniem; nie używać zajętej bazy/API innego wykonawcy. Pełny brief paczki, marker/freeze i aktualny status WIP przed pierwszą zmianą. Na tym etapie nie przydzielono nowych portów i nic nie uruchomiono.

1. Zmierzyć RED A–D montowanym UI. Fixture: organizacja A, manager z realnym uprawnieniem, osobny respondent MEMBER, nieuprawniony czytelnik i obcy tenant; manager tworzy/przypisuje przez istniejącą ścieżkę. Jeden stabilny assignment/session, pytanie required, bez fixture `/auth/me` w końcowym odbiorze.
2. Respondent real login, odpowiedź v1 i submit w UI. SQL: history submission v1, assignment/session submitted. Edytor read-only, brak PATCH po próbie wpisywania; bezpośredni PATCH nadal409. Lista managera oraz notification wskazują dokładnie ten rekord.
3. Manager otwiera **kartę sesji**, widzi pytanie/odpowiedź, approve/send-back i read-only treść. Pusty powód nie wysyła; powód z konkretnym wymaganiem → zwrot. SQL: history send_back v1, decyzja z aktorem/czasem, assignment in_progress, session active. Powrót do Huba bez reload: status i czynności już aktualne.
4. Respondent otwiera notyfikację/link, następnie pełny reload. Powód i wskazane braki widoczne; tylko własny zakres. Zapisuje v2 z expectedUpdatedAt, ponownie submit; poprzedni snapshot niezmienny.
5. Manager reload: submitted i v2, historia v1 przed poprawą oraz trwały zwrot. Approve → approved/completed, opcjonalne task done. Obie osoby wracają do listy i reload; ten sam ID, poprawne statusy, receipt z aktorem/czasem, brak edycji. Nie twierdzić, że approve stworzyło inicjatywę/insight — to odrębny handoff.
6. Negatywy: respondent i obcy tenant review odmowa; nieuprawniony czytelnik bez przycisków; brak rekordu i API403 nie tworzą demo stanu; 200 managed-list bez tego ID nie gubi dozwolonego odczytu respondenta. Niezmienione historie i rekordy tenant-sentinel.
7. Retry/konkurencja: submit powtórzony nie dubluje history; dwa równoległe manager decisions dają jedno zatwierdzenie lub jeden zwrot i jeden bezpieczny konflikt; brak częściowego assignment/session/task/history. Nie obniżać progu odbioru przez „tylko jedna karta”.
8. Dowody: screenshots karty manager/respondent i list po przejściach, jasny/ciemny, PL/EN przy zmienionej kopii, 1440; sieć realnych API, brak nowych console/product errors; SQL readback bez sekretów, testy RED→GREEN + mutacja submitted-edit guard lub autoryzacji → RED → restored GREEN. Esbuild per zmieniony frontend, celowane regresje; ciężkie build/tsc wyłącznie w przydzielonym slocie i zgodnie z briefem.

**PASS tej paczki** = pełny powyższy cykl z rzeczywistą kartą i loginem obu osób, trwałym feedbackiem/historią, odbiorcami i bramkami. Sama obecność approve/send-back lub zielony source-test nie wystarcza. Jeśli naprawa ograniczy się do frontu, jawnie wykazać zachowany realny backend; jeśli wszystko poza A–D już działa, nie przebudowywać go. Commit bez push, raport z dokładnym SHA i niezależny review integratora przed przyjęciem. SMTP, pełny AI review oraz szersze generatory nadal osobne bramki.
