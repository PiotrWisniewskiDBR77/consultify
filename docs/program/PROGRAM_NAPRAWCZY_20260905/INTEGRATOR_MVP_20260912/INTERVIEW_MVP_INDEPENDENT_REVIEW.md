# Interview W05 — niezależny odbiór 2026-09-12

## Werdykt

**BOUNDED ACCEPT commitu `865c61677762ce19a42e8f412b40d18e69a7fe76`** w zakresie: blokada treści submitted, decyzja uprawnionego managera organizacji w karcie, trwały feedback i poprawa/resubmit, callback list Huba, ścisły fallback do chronionego readera. Nie znaleziono nowej regresji w tym przebiegu. **Nie jest to pełny odbiór uprawnień ani całego modułu Interview. SECURITY-W05-SCOPE pozostaje findingiem do naprawy w MVP**, a nie odroczeniem poza MVP.

Przeczytałem cały `INTERVIEW_MVP_EXECUTION_BRIEF.md`, finalny raport autora `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX4_DLUG_MVP/INTERVIEW_W05_MVP_20260912.md`, aktualny kontrakt/security i źródła. Wstępny diff oglądałem wyłącznie jako WIP; nie oceniałem przejściowej mutacji callbacka. Scope formalnie oddał czysty SHA i zasoby przed moją pierwszą mutacją. Repo pozostało czyste, produktu nie zmieniałem.

## Samodzielnie wykonane dowody

Runtime: istniejący API Gateway4214, PID23683 `e4-api.mts`; Vite5214 PID53977; lokalny kontener **cx-codex4-pg**, loopback6455, PostgreSQL18, **cx4_pilot**. Historyczna nazwa cx-codex4-pg6455 była nieaktualna i została zweryfikowana przez docker ps. Nie restartowałem API/Vite/DB. Health: connected DB; degraded z powodu mocked-unavailable Redis, nie ukrywam tego ograniczenia.

Nowe własne assignment/session/question w syntetycznym tenancie autora, z istniejącymi kontami ADMIN i USER/respondent. **Początkowe rekordy zasiane przez SQL**: ten test nie dowodzi kreatora/publikacji template ani utworzenia assignment przez API. Nie cofałem lifecycle autora; jego rekord approved/completed sprawdzony przed dodaniem danych.

- Assignment `3d21d64e-e862-4bd7-acd7-1b11003bedf9`.
- Session `0cbe49db-3982-4990-8d84-a973813940ca`.
- Question `b7c03224-7bd5-49f4-bd5c-16ce34759d35`.

Pełny `cycle.mjs` wykonany od początku do końca w jednym uruchomieniu, exit0 PASS_ONE_RECORD, bez przerwania ani selektorowego recovery: real login HTTP obu osób, prawdziwe komponenty i API, odpowiedźv1→UI submit→submitted read-only reload→manager karta/send-back→in_progress/active→respondent widzi dokładny powód→edycja v2→UI resubmit→manager approve→obie osoby reload. Loginy nie były formularzem UI: tokeny po realnym /api/auth/login przeniesiono do osobnych kontekstów przeglądarki. Nie mockowano auth/me, lifecycle ani PG.

Dodatkowe własne asercje ponad harness autora: dokładnie3wiersze historii (v1 submission, v1 send_back, v2 submission), obecna v2 z EUR4800, finalny assignment approved/session completed, brak pageerror. Obie końcowe karty są read-only. Po akceptacji i zwrocie powrót do listy bez reload daje właściwe liczniki/status sesji. Osobny rzeczywisty mounted `InterviewHub.assignmentReview.behavior.test.tsx` uruchomiony przeze mnie na finalnym SHA: **1/1PASS**, retry0, dowodzi canonical assignment callback→zmiana wiersza bez refetch i bez wnioskowania po session callback.

`inspection.mjs` exit0 PASS_PERMISSION_DARK_READBACK: respondent approve403/send-back403; bezpośredni PATCH odpowiedzi z aktualnym CAS expectedUpdatedAt409; poprawna Assigned lista; realny store dark i html.dark dla obu osób. Następnie `foreign-probe.mjs`: osobna nowa syntetyczna organizacja i realny login ADMIN; **4/4PASS** — V8 i legacy approve/send-back dla tego samego naszego assignment zwracają404; SQL finalnego rekordu pozostaje approved/completed i v2. Negatywy wykonano na terminalnym rekordzie: dowodzą odmowy permission/tenant poprzedzającej zapis, nie pełnego zachowania konkurencji dwóch decyzji na submitted.

Notifications SQL readback:3trwałe wpisy powiązane z naszym assignment — interview_submitted do managera, interview_sent_back i interview_approved do respondenta; action_url odpowiednio `/interview?assignmentId=...&scope=managed` i `/interview?assignmentId=...`. Cykl otwierał te same adresy przez goto, **nie kliknął wiersza dropdown powiadomień**. Powód zwrotu przetrwał reload niezależnie od kanału. Nie twierdzę SMTP/provider delivery ani nowego powiadomienia na każde ponowienie submit (znalezionołącznie3wpisy).

Obejrzałem własne PNG feedback light, approved list light i manager approved dark: widoczna treść/powód/v2, brak white screen/crash/nowego nakładania. To ograniczony visual check. Lista Sessions pokazuje Unassigned przy syntetycznie zasianym rekordzie mimo assignee w assignment; nie uznaję tego za pełny odbiór wszystkich kolumn/projekcji. Brak pageerrors; istniejące403 Insights u MEMBER pozostają widoczne w logu, plus celowe403/409 negatywów. Nie deklaruję zero HTTP errors.

## SECURITY-W05-SCOPE — konkretny finding, osobny fix MVP

**Priorytet P1: niespójne egzekwowanie zakresu projektu i prawa review.** To nie zmiana wprowadzona przez ten commit, lecz istniejący kontrakt, którego używa nowa karta.

Kanon: `docs/modules/03_wywiad/06_PERMISSIONS_AND_SECURITY.md` wymaga tenant **i project boundaries**, deny-by-default oraz rozdzielenia read/mutation/approval. `functions/WY_PENDING_REVIEW.md` wymaga authorized review context.

Źródła obecnej niespójności:

1. `src/hooks/useInterviewPermissions.ts:133–160`: hasCapability dopasowuje `.scoped/.own/.assigned/.delegated`; hasOrgLevelAssignPermission i canAssign używają tego samego `interview.assignment.create`. Dalej assignmentScope zwraca organization, a canViewManaged==canAssign. Dla wejścia zawierającego tylko create.scoped logika **rozszerza zakres w modelu UI do organizacji**, nie zachowuje projektu. Ponadto create nie jest równoznaczne z review. Nowy Workspace używa canViewManaged, zgodnie z zastanym Hub.
2. `server/src/routes/v8/interview.routes.ts:395–405` oraz legacy `server/src/routes/interview.routes.ts`: POST assignment/:id/send-back i /approve używają `requirePermission(INTERVIEW_ASSIGN_MANAGE)`. Faktyczny import to `permission.middleware.ts:262`, który przekazuje PermissionService tylko userId/orgId/key/role, nie projectId.
3. `server/src/controllers/InterviewController.ts` sendBack~4750, approve~5013: assignment SELECT id+organization_id; session JOIN potwierdza tenant, nie grant do projektu. `server/src/services/workflow/gatePolicy.ts:64–91` sprawdza submitted/session, nie project capability.
4. `server/src/services/effectiveAccessService.ts` definiuje np. INITIATIVE_OWNER z interview.assignment.review.scoped/send_back.scoped/approve.scoped. Legacy permissionService ma odrębne grants i rolę PROJECT_MANAGER w globalnym fallbacku. Nie wolno utożsamiać globalnego MANAGE z grantem scoped w eksperymencie.

**Co potwierdzono:** konkretny błędny transfer scoped→organization w funkcji hooka oraz brak projektu w opisanej ścieżce legacy permission check. **Czego NIE potwierdzono:** że realny użytkownik mający wyłącznie scoped capability uzyskuje backend200 w obcym projekcie. Może on dostać403 również w swoim projekcie, ponieważ backend czyta inny rejestr uprawnień. Nie opisuję tego jako zmierzonego cross-project write exploitu.

Minimalny reproducer do następnego securityfixu (poniżej specyfikacja; rzeczywista próba A/B opisana w następnym podrozdziale):

- jedna własna testowa organizacja, projektyA/B; użytkownik nie-ADMIN/OWNER/SUPERADMIN, rzeczywisty project membership/grant INITIATIVE_OWNER lub zarządzający tylkoA, bez org-wide MANAGE. Wykazać `/api/access/effective?projectId=A` i dlaB oraz grants wPG. Osobny respondent; po jednym realnie submitted assignment/session naA iB, z właściwym project_id i kompletną odpowiedzią.
- aktor może czytać wybrany kontekstB jedynie jeśli ma osobny jawny read (nie przyznawać mu manageB). Interfejs nie pokazuje reviewB; pokazuje reviewA według rzeczywistej polityki. Test hooka na response `create.scoped` oddzielnie wykrywa organization scope, test samego create bez review wykrywa błędne utożsamienie.
- POST V8 i legacy approve/send-backB:403/404, zero zmian assignment/session/history/task/notifications. LegalneA:200 i właściwa transakcja. Jeżeli A403/B403, zarejestrować **brak realizacji legalnego scoped grant**, nie uznać testu za PASS tylko dlatego, że foreign odmówiony.
- osobny kontrolny ADMIN/OWNER z globalnym grantem może działać w obu projektach. Nie używać PROJECT_MANAGER globalnego fallbacku jako dowodu prawa ograniczonego doA. Osobne sentinele obcego tenantu.
- minimalna naprawa: wspólny scoped resolver review dla obu endpointów i odpowiadający capability/record scope w UI; nie redesign całego RBAC i nie usuwanie tenant guard. Tenant/project z persisted assignment/session, nie z body. Test odmowy po cofnięciu roli, brak rekordu i role update bez review; mutation usuwająca project check musi byćRED.

### Własny realny A/B repro po dodatkowym przydziale root — RED legalnego scoped review

Na tym samym exact SHA i przydzielonym cx4_pilot dodałem nowego nieuprzywilejowanego USER/MEMBER oraz projektyA/B. Tylko wA ma project_members INITIATIVE_OWNER z jawnymi create/review/approve/send_back.scoped; brak org_user_permissions grants. Osiem nowych submitted/complete assignment/session/question (po jednym na każdą kombinację2projektów×2rodzin API×2akcji), bez mutacji rekordów autora ani głównego cyklu.

Real login i `GET /api/access/effective?projectId=A`:200, applicationRole USER, projectRole INITIATIVE_OWNER, review/approve/send_back.scoped obecne, warnings=[]. DlaB:200, fallback TASK_ASSIGNEE, brak review/approve/send_back; osobne ostrzeżenie PROJECT_ROLE_FALLBACK_FROM_APPLICATION_ROLE zachowane w evidence.

| Aktor ten sam USER, grant tylkoA | V8 approve | V8 send-back | Legacy approve | Legacy send-back | SQL skutki po każdej próbie |
|---|---|---|---|---|---|
| Własny projektA — wymagane200 |403 **FAIL** |403 **FAIL** |403 **FAIL** |403 **FAIL** |assignment/session/history/notifications hash bez zmiany |
| ProjektB — wymagana odmowa |403 PASS |403 PASS |403 PASS |403 PASS |ten sam hash przed/po, wszystkie8prób |

**Wynik4PASS/4FAIL kontraktu, nie permissions PASS.** Harness exit0 oznacza ukończony pomiar, nie zielony produkt. Dodatkowa kontrola tego samego A/V8/approve rekordu przez rzeczywistego globalnego ADMIN:200, SQL approved/completed. Potwierdza, że odmowa scoped aktora nie wynikała z niekompletnej fixture lub złego statusu. Nie traktować kontroli ADMIN jako zastępstwa wymaganego legalnego200 scoped aktora.

Zidentyfikowana realna przyczyna: effective scoped grants nie są honorowane przez legacy INTERVIEW_ASSIGN_MANAGE check. Po prostu dodanie scoped grant do globalnego boolean MANAGE byłoby niebezpieczne, ponieważ kontroler nadal nie sprawdza projektu docelowego. Naprawa musi równocześnie przepuścićA i zachować odmowęB. Nie potwierdzono cross-project write200; statyczny scope collapse UI nadal osobnym ogniwem findingu.

Dowody: `codex4-scratch/interview-independent-20260912/project-scope-probe.mjs` i `evidence/project-scope-probe.json` z IDs, effectiveAccess obu projektów, brakiem globalnych grants,8statusami i hashami readback oraz positive fixture control. Fixture jest SQL read/write-authorization probe, nie dowodem creator flow. Probe zakończony, brak aktywnych procesów. Root może teraz ponownie przejąć zasoby.

## Pozostałe ograniczenia wobec pełnego briefu

Nie wykonano niezależnie dwóch równoległych decyzji ani utraty odpowiedzi po commit/retry submit; serwer nie był częścią tej naprawy. Nie odebrano pełnego AI/dwustopniowego workflow, wielopytaniowej karty/voice, PL nowej kopii, built production frontend ani staging. Vite jest runtime deweloperskim. Autorskie23/23 i RED/mutacje przeczytane jako dowody autora, nie powtórzone jako własny pełny zestaw. Własny mountedHub1/1 nie zastępuje pełnego renderu wszystkich odmian karty.

## Artefakty i przekazanie

Własny katalog `/Users/piotrwisniewski/Developer/codex-wt/codex4-scratch/interview-independent-20260912`:

- `setup-evidence.json`, `evidence/independent-summary.json`, `evidence/cycle-evidence.json`, `evidence/foreign-permissions.json`, `evidence/notification-readback.json` — bezpieczny readback;
- `evidence/cycle-*.png/.txt` — realny przebieg; `hub-independent.log` —1/1;
- `setup.mjs`, `cycle.mjs`, `inspection.mjs`, `foreign-probe.mjs` — przyrządy; **private-state.json zawiera hasło, nie publikować ani wypisywać**.

Zasoby API/Vite/PG niezmienione. Przeglądarki i Pool zamknięte, test zakończony, brak aktywnych własnych procesów. Nowy rekord pozostał approved/completed; autorowy lifecycle nietknięty. Syntetyczny foreign tenant pozostawiony jako dowód, nie kasowano cudzych danych. Root może przejąć środowisko. Produktowy WT nadal czysty.

## Dodatkowe source sanity na zlecenie root

`e2e744f555d1c4745419f6c95e8ec06d8f70f60d`: jedyna zmiana `contexts: ReturnType<typeof vi.fn>`→`ReturnType<typeof vi.fn<() => void>>`. Brak zmian wykonania/asercji/produktu; nie osłabia regresji voice. Root zgłosił4PASS oraz diagnostics193→192 (baseline192); nie powtarzałem ich.

Nowy `executionCasesBulk.populated.pg.test.ts` w integratorze: source ACCEPT read-path. Dokładne dzieci/task/decision/allocation+hours7/version, real Gateway/JWT, foreign denial i usunięty lineage, retry0/sequential, run-scoped cleanup. Root3/3PASS uzupełnia poprzednią lukę niepustego bulk readera; SQLfixture jawnie nie dowodzi creation/handoff. Nie uruchamiałem PG6454.
