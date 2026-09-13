# W05 scope pre-review — bieżący WIP, 2026-09-12

**SOURCE_REVIEW / HOLD dwóch kwestii do rozstrzygnięcia, nie final ACCEPT.** Odczyt C4 `codex4-dlug-mvp`, bez edycji produktu, testów, DB ani runtime. Delivery uprzedził, że mutation harness czasowo odtwarza stare trzy pliki Controller/routes; stabilny helper/hook/Workspace oceniono osobno. Podane numery dotyczą odczytanego WIP, nie finalnego SHA. Wyniki runtime zgłaszane przez autora nie są moim niezależnym PASS.

## F1 — request memo może zastąpić świeżą politykę przy write

Źródło: `server/src/services/interviewAssignmentReviewAccess.ts:41` używa `resolveEffectiveAccess`; `effectiveAccessService.ts:848–863` memoizuje po user/org/role/project. `RequestStore.ts` utrzymuje tę pamięć przez jedno HTTP, a produkcyjny `index.ts:1151` montuje correlationMiddleware. Opcja `lock:true` w helperze blokuje assignment/session, lecz w odczytanej wersji nie odświeża memo. Zatem ponowne wywołanie w tej samej POST może otrzymać poprzednie capabilities/rolę/status membership.

**SOURCE_FINDING, exploit runtime NOT_PROVEN przeze mnie.** Istniejące testy `interviewReviewScope.pg.test.ts:83,91` wykonują GET, zmianę DB, POST — nowe requesty. Nie dowodzą świeżości drugiego guardu w jednym request. DELETE project membership również nie wystarczy jako mutation: świeży ownerPredicate w helper57 może odmówić mimo starego cache.

Potrzebny test: real correlationMiddleware + jeden request store, pierwszy allow; z drugiej sesji committed downgrade capabilities/template przy zachowanym project membership lub organization membership ACTIVE→REVOKED; drugi guard przy faktycznej granicy write musi odmówić, a assignment/session/history/notifications pozostać identyczne. Oba stosy approve/send-back. Jawna bariera synchronizacji, nie sam sleep. Dodatkowo sprawdzić zmianę assignment/session project między preflight a lock.

Rekomendacja: ograniczone odświeżenie dokładnego effectiveAccess entry dla tego actor/org/project w kontrolowanej granicy write, bez globalnego czyszczenia pamięci i bez nowej polityki RBAC. Delivery rozważa ten reuse; potrzebne dowody RED→GREEN i test sprzężenia klucza. Samo usunięcie cache nie dowodzi, że kwalifikacja nie może zmienić się później przed write: należy jawnie wskazać granicę gwarancji oraz deterministyczny concurrency test.

## F2 — legacy lane korzysta z dawnej roli aktora zamiast persisted role

Źródło helper48: `isOrgWideInterviewManagerRole(actor.role)` + `hasPermission(... actor.role)`. Helper41 wcześniej uzyskuje canonical `access.applicationRole` z aktywnego organization_members; lane48 jednak jej nie używa. `permissionService.ts:322+` daje OWNER bypass oraz ADMIN fallback MANAGE. `auth.middleware.ts:828` inicjuje rolę z JWT; przy żądaniu bez x-org-context i aktywnym bieżącym org odczyt933 sprawdza status, a nie odświeża roli. Aktualna aktywna membership MEMBER może więc współistnieć z actor.role ADMIN/OWNER.

**SOURCE_FINDING, runtime NOT_PROVEN przeze mnie.** Minimalny test: prawdziwy login ADMIN (osobno OWNER), zmiana persisted organization_members.role na MEMBER przy zachowanym ACTIVE, ten sam stary JWT bez x-org-context; brak review grants/project membership. `/review-access` ma zwrócić false, approve/send-back403 bez write w obu stosach. Kontrola pozytywna nadal uprawnionego canonical ADMIN/OWNER; SUPERADMIN lane zgodnie z istniejącą polityką, bez jej przeprojektowania.

Rekomendacja: decyzja legacy managera oparta na świeżej canonical authority. Nie wystarczy polegać na tym, że UI zwykle wysyła nagłówek organizacji. Root przekazał wymóg fresh canonicalrole/fresh policy przed final acceptance.

## Co wygląda poprawnie w stabilnych źródłach

- Helper18–34 pobiera assignment i session po persisted organization, nie po projectId z body. Dwa różne niepuste project_id →409; projekt spoza organizacji →404; expected session/project chroni przeciw zmianie kontekstu między odczytami. Null project rozliczany osobno, scoped ownerPredicate wymaga rzeczywistego project membership.
- Explicit REVOKE: helper37–45 traktuje każdy non-GRANT dla MANAGE/REVIEW jako odmowę, z zachowanym canonical OWNER/platform wyjątkiem; org membership missing/nonACTIVE zamyka access. Świeży REVOKE odczytywany poza memo; problemF1 dotyczy innych części polityki.
- Create≠review: helper54–59 sprawdza `interview.assignment.review`, usuwa .own/.assigned/.delegated z review authority. Arbitralny create-only grant nie tworzy review. Legacy lane wymaga jeszcze rozstrzygnięciaF2.
- UI `useInterviewPermissions.ts:299–315`: klucz user/org/assignment, synchronizacyjna odmowa po zmianie klucza, ignorowanie spóźnionej odpowiedzi, fail-closed po błędzie. Workspace316–320 uzależnia review mode od endpointu i submitted, nie ownerId/canAssign.
- Fallback read Workspace935–947: błąd own-list lub brak rekordu prowadzi do istniejącego protected detail, którego id musi pasować. Nie wymyślono nowej procedury; backend ma być ostatnią ochroną. Helper69–77 zachowuje legacy reader i dodaje scoped review read; jego bypass wymaga rzeczywistego tenant-filter w Controller (do ponownego odczytu stabilnych plików).

## Minimalny odbiór po stabilnym SHA

1. F1/F2 deterministyczne negatywy i ich mutation RED→GREEN, rzeczywisty write boundary, obie trasy.
2. A scoped reviewer legal; B mimo bodyproject=A denied; foreign assignment/session404; konflikt persistedproject409; projectless scoped403; explicitREVOKE403; create-only403; review-only legal.
3. Detail/historyA200/B403 z fallbacku, brak view-own nie blokuje legalnego reviewera; own respondent feedback nadal działa.
4. Jeden rekord: respondent submit→manager return reason→respondent edit/resubmit→manager approve→reload; status Hub, feedback i persisted readback. Odmowy nie zmieniają assignment/session/history/notifications; terminal retry nie duplikuje skutków.
5. UI A→B/user/org switch oraz błędny/spóźniony review-access nie pokazują uprawnionych akcji; backend i tak ponownie autoryzuje write.

Finalny runtime odbiór dopiero po oddaniu SHA i zasobów. Żadnych source poprawek wykonanych przez recenzenta.


## Aktualizacja po udostępnieniu stabilnych źródeł przez delivery

Delivery zakończył mutation i jawnie pozwolił odczytać Controller/routes/helper. Ponowny odczyt źródła pokazuje naprawy obu zgłoszeń: helper43 usuwa WYŁĄCZNIE dokładny klucz effectiveAccess przy lock:true; legacyManager51–52 oraz read middleware korzystają z `currentInterviewOrganizationRole`, który czyta aktywną organization_members, z zachowanym istniejącym platform SUPERADMIN. **F1/F2: poprawione w SOURCE, odbiór runtime nadal PENDING final SHA**; historyczne findingi powyżej pozostają jako przyczyna zmian, nie twierdzenie że nowy WIP nadal zawiera ten sam błąd.

Wiring potwierdzone ze stabilnego źródła: legacy routes176–197 i v8 routes396–407 kierują review-access, approve, send-back do wspólnego Controller. Controller4702 zwraca record-bound canReview;4711/5018 wykonują preflight,4825/5083 ponownie assert z lock:true i expectedSession/Project wewnątrz `withPgTransaction`, przed snapshot/write. `queryHelpers.ts` kieruje nested queryOne/queryRun do pinned client. Conditional assignment UPDATE wymaga nadal submitted i zmiany dokładnie1wiersza; skutki history/session/task są w transakcji. Reader detail Controller5611+ filtruje assignment po organization; answer-history4960+ także. Legacy route ma verifyToken+validateOrgMembership+requireOrgAccess przed lokalnymi handlerami. Nie stwierdzam nowej zmiany procesu ani UI.

Odczytany nowy test PG78–92 odtwarza dokładnie memo w correlationMiddleware: pierwszy allow, committed downgrade projectrole+permissions z zachowaniem membership, drugi assert w real withPgTransaction oczekuje403 i równych danych. To odpowiedni test mechanizmu F1; nie opisujmy go jako pełną concurrent HTTP trasę z zatrzymaniem Controller między preflight/write, bo woła helper bezpośrednio. Nowy test110 wykonuje stale ADMIN JWT→persistedMEMBER i approve obu endpoint families. W tym odczycie OWNER staleJWT/send-back oraz orgrevoke między preflight/transaction nie mają osobnych nowych przypadków — nie deklarować tych wariantów runtime PASS bez dowodu. Root może rozstrzygnąć sufficiency testów wspólnego helpera wraz z rzeczywistym wiring, zamiast rozszerzać tę paczkę w ogólną przebudowę RBAC.

Granica pozostałej gwarancji: locks obejmują assignment/session, nie wszystkie rekordy polityki. Source dowodzi odświeżenia przy check pod lock; nie dowodzi serializacji dowolnej zmiany ról/templates/grants aż do COMMIT. Nie nazywamy więc paczki pełnym rozwiązaniem wszystkich możliwych RBAC TOCTOU. Żadnego dodatkowego source blockera ponad F1/F2 nie potwierdzono w tym ograniczonym przeglądzie; final decision pozostaje po SHA i niezależnych dowodach.
