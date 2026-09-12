# SECURITY W05 — zakres projektu przy zatwierdzaniu i zwrocie Interview

Status: READY TO ASSIGN, NIE WDROŻONE. 2026-09-12. Paczka przygotowana niezależnie, bez zmian produktu ani ponownego zajęcia runtime. Wydanie: root przydziela C4 dopiero po zwolnieniu IE00/C6. Nie jest to trzeci równoległy blok implementacji.

## 1. Punkt wyjścia i rzeczywisty problem

Odebrany ograniczony zakres UI: `865c61677762ce19a42e8f412b40d18e69a7fe76` w `/Users/piotrwisniewski/Developer/codex-wt/codex4-dlug-mvp`. Przed kodowaniem sprawdzić aktualny HEAD, czystość i polecenie integratora; nie resetować do tego SHA. Przeczytać pełne `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX4_DLUG_MVP/01_INSTRUKCJA.md`, jego SOURCE_OF_TRUTH i aktualne odstępstwa DEC.

Dowód niezależny: `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/interview-independent-20260912/evidence/project-scope-probe.json`, harness obok `project-scope-probe.mjs`. Raport: `INTERVIEW_MVP_INDEPENDENT_REVIEW.md` w tym katalogu handoff. Pliki private-state zawierają sekret i nie są materiałem publikowanym.

Pomiar rzeczywisty Gateway/JWT/PG: actor USER/MEMBER ma wyłącznie w projekcie A membership INITIATIVE_OWNER i skuteczne scoped review/approve/send_back/create. GET effective access A potwierdza review; B daje TASK_ASSIGNEE bez review. Osiem oddzielnych submitted assignment/session z trwałym project_id: A/B × V8/legacy × approve/send-back.

| Próba | Wynik zastany | Wymagany wynik |
|---|---|---|
| A: cztery legalne operacje | 4 × 403, SQL bez zmian — RED | 4 × 200 i poprawny lifecycle/readback |
| B: cztery operacje bez zakresu | 4 × 403, SQL bez zmian | 403/404, SQL bez zmian |
| ADMIN kontrolnie na tym samym A/V8/approve | 200, approved/completed | zachować |

Nie wykazano cross-project zapisu 200. Wykazano blokadę legalnego zakresu przez legacy MANAGE. Osobna wada źródłowa UI: scoped create jest interpretowane jako org-level możliwość zarządzania/review. Samo utrzymanie B403 nie naprawia problemu. Exit 0 harnessu oznacza zakończenie pomiaru, nie odbiór produktu.

## 2. Wiążący kontrakt i pułapki istniejących helperów

Przeczytane źródła obowiązujące dla tej paczki:
- `docs/modules/03_wywiad/06_PERMISSIONS_AND_SECURITY.md`: tenant AND project boundaries, deny-by-default przy niepewnej autoryzacji, audyt działań wysokiego wpływu; rozdzielenie read/mutation/approval.
- `docs/modules/03_wywiad/functions/WY_PENDING_REVIEW.md`: uprawniony kontekst review i jawne zatwierdzenie, bez domyślnej zgody downstream.
- Cały guard `server/src/middleware/effectiveCapability.middleware.ts`, w tym `resolveInterviewProjectId`, oraz resolver/evaluator i mapping w `server/src/services/effectiveAccessService.ts`.

Reuse `resolveEffectiveAccess` dla rzeczywistego user/org/persisted project oraz `evaluateEffectiveCapability` z właściwym warunkiem zakresu. Nie implementować drugiego RBAC ani katalogu ról. Sam `hasEffectiveCapability` rozpoznaje także suffix own/assigned/delegated; nie dowodzi prawa review tego obiektu. Własność odpowiedzi ani bycie assignee nie jest automatycznym prawem zatwierdzania. Nie wprowadzać także nowego zakazu self-review bez istniejącej polityki.

Istniejący `resolveInterviewProjectId` NIE jest dostateczną ochroną tego zapisu: zapytania nie ograniczają wszystkich lookupów organization_id, błędy są łapane jako null, wybierany jest pierwszy project assignment/session bez kontroli konfliktu, a fallback bierze body/query/params.id. Nie wolno użyć tego fallbacku jako autorytetu projektu. Należy ograniczyć nowy resolver do review, nie zmieniać globalnie pozostałych konsumentów.

Guard bez shadow może wykonać next() przy wyłączonych globalnych flagach. Samo `{ enforceMode: 'enforce' }` w zwykłym wrapperze tego nie naprawia. Wymusić ochronę lokalnie dla tych czterech tras poprzez wspólny jawny review guard korzystający z istniejącego resolvera uprawnień; jeżeli używany będzie wrapper shadow, wymagane są jednocześnie `shadow:true`, `enforceMode:'enforce'` i wcześniejsze ścisłe rozstrzygnięcie obiektu. Testy muszą działać także przy wyłączonych globalnych flagach. Nie włączać flag globalnie.

Legacy `INTERVIEW_ASSIGN_MANAGE` mapuje się do `interview.assignment.create`. Nie zmieniać tego mappingu globalnie i nie uznawać create za review. Nie dopisywać scoped capability do ogólnego boolean MANAGE. Nie stosować starego bool AND review (A pozostanie 403), ani niesprawdzonego OR (możliwa eskalacja). Zachować istniejące jawne DENY w org_user_permissions: brak legacy pozytywnego grantu jest innym stanem niż jawny zakaz. Reuse istniejącego źródła i precedencji; ewentualny mały adapter musi zachować tę różnicę i mieć test. Zachować istniejące jawne org-level role/granty dla review, z dodatnią kontrolą ADMIN; nie przedefiniowywać przy okazji PROJECT_MANAGER ani innych ról.

## 3. Kolejność implementacji i własność plików

1. Utrwalić RED ośmiu nazw scenariuszy na świeżych syntetycznych rekordach oraz dodatnią kontrolę ADMIN. Przejrzeć także testy autora 23/23 i niezależny Hub callback. Nie cofać approved do submitted.
2. Dodać mały wspólny guard/resolver review, np. nowy `server/src/services/interviewAssignmentReviewAccess.ts` i odpowiedni adapter middleware. Nazwa jest propozycją nowego pliku, nie twierdzeniem, że istnieje. Używać istniejących helperów DB/transakcji, effective access i mappera błędów.
3. Wpiąć ten sam guard do OBU rodzin: `server/src/routes/v8/interview.routes.ts` oraz `server/src/routes/interview.routes.ts`, wyłącznie POST assignments/:id/approve i assignments/:id/send-back. Zastąpić blokującą bramkę legacy na tych działaniach. Nie zmieniać create/update/delete/list/remind/insight permissions.
4. `server/src/controllers/InterviewController.ts`: dotychczasowe sendBackAssignment i approveAssignment mają org lookup, ale nie project membership. Zweryfikować autorytatywnie stan i zakres przed mutacją, we wspólnym punkcie używanym przez oba stosy; nie dublować polityki w każdej metodzie. Zachować istniejące CAS/lifecycle/history/notification zachowanie. Jeżeli rzeczywista nazwa/ścieżka kontrolera różni się po integracji, rozwiązać import z tras zamiast tworzyć nowy controller.
5. `src/hooks/useInterviewPermissions.ts`: oddzielić review od canAssign/create. Pobierać effective access dla projektu faktycznie otwartego rekordu, nie globalny effective access bez projectId. Nie zmieniać znaczenia canAssign wszystkim konsumentom. Udostępnić osobną ocenę review i loading/error. Nieznany kontekst i nieaktualny user/org/project nie może zachować poprzedniego allow.
6. `src/components/Interview/InterviewWorkspace.tsx`: warunek reviewer mode ma korzystać z review kontekstu tego assignment, a nie canViewManaged wywiedzionego z create. Zachować submitted lock, strict detail fallback, feedback i onAssignmentChange. `InterviewHub.tsx`: tylko niezbędne przekazanie kontekstu/odświeżenia; nie otwierać managed list scoped actorowi poprzez ogólny org bool. Jeśli lista nie ma jeszcze poprawnego scope readera, wykazać legalny detail A bez rozszerzania listy i zapisać granicę odbioru.
7. Dodać skoncentrowane testy serwerowe real PG/JWT obu stosów oraz mounted UI hook/Workspace/Hub. Raport, dowody i commit po GREEN; root dokonuje niezależnego odbioru dokładnego SHA.

Nie zmieniać queryHelpers, globalnego katalogu ról, migracji, flag, lifecycle, modelu assignment/session ani innych modułów. Nie rozszerzać na cały redesign Interview/RBAC. Współdzielone pliki i sloty ustala root, bez równoległego staging/index.

## 4. Ścisłe rozstrzygnięcie obiektu

- organizationId/userId wyłącznie z rzeczywistej uwierzytelnionej sesji. Assignment id wyłącznie parametr trasy.
- Załadować persisted assignment w tej organizacji i jego session; upewnić się, że session i projekt należą do tej samej organizacji. Nie korzystać z caller-supplied projectId jako dowodu.
- Gdy assignment i session mają zgodny non-null project, ocenić prawo do tego projektu. Jeśli jeden ma project, drugi jest rzeczywiście null, użyć istniejącej kanonicznej relacji po walidacji; nie arbitralnego body fallbacku. Dwa różne non-null project: odmowa przed zmianą, jawny bezpieczny błąd konfliktu. Missing/foreign: 404. Awaria lookupu: kontrolowany błąd, nigdy projectless allow.
- Prawdziwy projectless jest osobnym stanem, potwierdzonym odczytem. Zachować dotychczasowy legalny org-level ADMIN review; sam scoped grant nie uprawnia do projectless ani do projektu B.
- Sprawdzić aktualną membership/grant oraz obowiązujące jawne deny podczas każdego POST. Revoke po załadowaniu UI musi zatrzymać POST bez zmiany danych. Nie ufać UI cache lub samej zawartości JWT jako aktualnemu grantowi.
- Nie pozostawić TOCTOU pomiędzy odczytem projektu a zapisem: użyć istniejącej granicy transakcji/CAS i odpowiedniej ponownej walidacji/lock persisted assignment/session. Scenariusz zmiany powiązania przed POST musi odmówić na podstawie nowego projektu. Nie deklarować pełnej serializacji równoczesnych zmian membership bez osobnego dowodu.
- Wymagane jest prawo review, nie create. Action-specific approve/send_back należy zachować tam, gdzie istniejąca polityka rzeczywiście je różnicuje; nie dodawać nowego uniwersalnego AND trzech kluczy, który odetnie legalne template z samym review.

## 5. Mianownik i dowody odbioru

### Real API/PG — obowiązkowe

Ten sam actor policy i osiem tych samych nazw A/B × stos × operacja jak w RED, fresh run IDs dla konsumowanych rekordów. Dla A wymagane HTTP200 i poprawne assignment/session/history/notification readback. Dla B wymagane 403/404 oraz hash/readback assignment, session, history i notifications bez zmian. Nie wystarcza status HTTP ani sam log. ADMIN200 na poprawnym A i zweryfikowanym projectless ma bronić legalnej ścieżki.

Dodatkowo w obu stosach, z dodatnią kontrolą tam gdzie sensowna:
- revoke membership/grantu A po wcześniejszym effective allow i przed POST → odmowa bez mutacji;
- actor z create bez review → odmowa, actor z rzeczywistym review → legalne A;
- foreign organization assignment/session/project → 404, bez skutków i bez ujawnienia szczegółów;
- scoped actor + rzeczywisty projectless → odmowa; body/query projectA nie naprawia projectB/null;
- assignment/session project mismatch oraz nieistniejąca/błędna relacja → odmowa bez skutków;
- jawny legacy DENY nie znika po wejściu nową ścieżką; odróżnić go od braku globalnego MANAGE;
- global enforce flag OFF nadal egzekwuje ten lokalny guard;
- MEMBER bez review nie uzyskuje uprawnień przez własność/assignee; nadal 403;
- stale status/CAS nadal 409, ponowienie terminalnego approval nie tworzy drugiej historii/powiadomienia zgodnie zastanym kontraktem.

Mutacje: usunięcie project guard musi oblać B; pozostawienie legacy MANAGE jako wyłącznej bramki musi oblać A; create jako review musi oblać create-only. Po każdej przywrócić źródła i pełny ten sam mianownik GREEN. Żadne test.skip/retry ani zmniejszanie liczby przypadków.

### UI i istniejące zachowanie

Real browser 1440 light/dark: actor A widzi review na submitted A i kończy return→edit→resubmit→approve→reload na jednym assignment/session; B nie ma aktywnych review actions i ręczny POST jest chroniony. UI nie jest jedyną ochroną. Revoke przy otwartej karcie: POST odmowa, uczciwy komunikat/odświeżenie, bez optymistycznego approved. Zachować feedback, readonly submitted, aktualizację rzeczywistego wiersza Hub przez callback. PNG + bezpieczny sidecar URL/state/rola, bez tokenów i haseł. Nie wymuszać nowego modelu samodzielnego przypisania tylko po to, aby ominąć politykę.

Uruchomić skoncentrowane testy autora oraz nowe, per plik retry=0; server tsc po finalnym kodzie, front build tylko w przydzielonym ciężkim slocie. Pełny lint/build nie zastępuje A200/Bdenial/SQL/UI. Zachować zastane błędy niezwiązane z tym zakresem w raporcie, nie naprawiać ich mimochodem.

## 6. Zasoby i dostawa

Obecnie żaden runtime nie jest zarezerwowany dla autora tej paczki. Historyczne cx4_pilot/API4214/Vite5214 NIE są automatyczną zgodą na użycie. Root przydzieli właściwy runtime po IE00/C6. Po przydziale zweryfikować tożsamość PG, procesy i SHA przed testami. Nie restartować cudzych procesów, nie dotykać zastanych rekordów i nie seedować ponownie stałych emaili autora. Syntetyczne rekordy tej próby są już terminalne w części: nie resetować lifecycle dla GREEN.

Dostawa: exact SHA, clean index/WT poza jawnie opisanym cudzym WIP, raport wszystkich scenariuszy z denominatorem, RED→GREEN/mutations, real readback, UI evidence, lista nieudowodnionych granic, bezpieczny handoff zasobów. Commit z wymaganymi przez aktualny brief znacznikami ODMROZENIE/DEC dla faktycznie dotkniętych modułów; nie wymyślać nowej decyzji ani pushować. Root odbiera niezależnie. Kryterium końcowe: legalne scoped A działa i B/foreign/revoke nie mutują. Wcześniejszy bounded ACCEPT UI nie oznacza przyjęcia tej naprawy przed wykonaniem dowodów.
