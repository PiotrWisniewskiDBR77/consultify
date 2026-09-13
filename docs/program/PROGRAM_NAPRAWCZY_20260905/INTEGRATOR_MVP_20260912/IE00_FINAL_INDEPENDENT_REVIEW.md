# IE00 — niezależny odbiór pierwszego pionu Definition

**ACCEPT bounded Definition vertical**, source `e14526a711a12832a529e85d60b3b69858c432e9`. HEAD końcowy `d74abe43ca711637726e01d59a3b38bdcf5bd4bd` różni się wyłącznie raportem98; source/test diff względem sourceSHA pusty, WT clean. Autor przekazał runtime i nie zmieniał source podczas odbioru. Nie jest to odbiór całego IE00 ani MVP.

## Niezależnie wykonane

| Scenariusz | Wynik / dowód |
|---|---|
| Real Gateway/JWT/PostgreSQL vertical |5/5 PASS; tenant404, authority403, OFF additive hidden + stary legal request/approve, ON return/edit/resubmit tego samego Decision, stale409 i concurrent201/409, wersje/audit |
| Secondary-org membership |1/1 PASS: active członek innej niż primary org obecny, unrelated nonmember wykluczony |
| A→B identity |2/2 PASS real React components/kontrolowany transport, równeversion5, treśćB i URLB; approvalA nie nadpisujeB |
| Nowa inicjatywa z Hub form |201, własny nowy receipt, bez resetu/kasowania rekordu autora |
| Przygotowanie8kart |8HTTP publikacji +8HTTP niezależnych review; 2GET. To przygotowanie API, nie dowód8edycjiUI |
| Pełny nowy cykl UI |6/6 POST201: request→RETURN→edit summary-scope→card review→resubmit→APPROVE, od początku bez wznowień |
| SQL cold readback |Initiativev23DEFINED; Decisionv4APPROVED, niezmiennyDecisionId; summary-scope v1REQUESTED/v2ACCEPTED/v3REQUESTED/v4ACCEPTED; gateaudit PENDING/RETURNED/PENDING/APPROVED |
| Typed MyWork consumer |PASS checkbox nie zaznacza typed row, doubleclick canonical preview, genericOpens=[], zero generic decision writes |
| ON reload/list/card/legacy |PASS: nowa inicjatywa Defined, canonical preview Approved, legacy bez canonical region |

ID inicjatywy `initiative-ade72586-583c-4d7a-bae4-f2d73055c86b`; ID decyzji `785bfa16-8b72-4ca2-98d3-5ac54517ee2e`. Org-definition, lokalnaPG cx7_ie00:6458. API4217 PID44174 i Vite5598 PID76769 cwdcodex7-zatwierdzanie; procesy pozostawione bez restartu. Testy mają maxWorkers1; wszystkie mutujące scenariusze PG/UI wykonano sekwencyjnie, osobne fixture dla PG i nowegoUI. Identity test nie używaDB.

## Źródła i wcześniejsze findingi

Pre-review w IE00_SCOPE_PRE_REVIEW.md. Poprawiony membership join oraz wewnętrzna keyed identity zweryfikowane niezależnie GREEN. RED autora pozostaje zachowany z identycznym mianownikiem; reviewer nie mutował produktu ponownie. Resubmit wymaga tego samego pointera/DecisionId, RETURNED i requestera, related version rośnie pod lock/CAS material command. Named authority i current policy membership w route, named actor/selfApproval oraz card/policy snapshot w domain. Typed origin omija legacy generic handlers/selection/doubleclick. Brak nowych znalezionych blockerów tej pionowej ścieżki.

## Granice i jawne braki

Realne AppProviders/Hub/InitiativeDocumentView/DecisionsPanelContent + Gateway/JWT/PG w harness5598; JWT lokalnych aktorów, auth/me realne. NIE pełne AppRoutes/login/fresh-org. Defaultflag pozostajeOFF; nie wykonano deploy/enable. OFF writer niezależnie odebrany wPGtest, browser OFF nie był ponawiany (dowód autora zachowany osobno).

Obejrzano PNG coldApproved, typedconsumer, return oraz cardreview. Render działa, bez white/crash; jakość całegoUI nie otrzymujePASS: widoczne starsze surowe kluczei18n, owner `null null`, ciasne completion/quality controls w preview. W UIcycle20HTTPerrors,5typów: legacy/projection404, suggested-changes404, minimal-schema attachments/backlinks503. Nie ukryto ich, nie deklarujemy zeroerrors. Zdjęcia tuż poPOST mogą pokazywać stan sprzed zakończenia refresh; końcowy reload iSQL są autorytatywnym dowodem.

Pozostałe12gate, legacy Case/A05, kworumUI, delegacje, pełna macierz policyrevoke/idempotence/invalidacji poAPPROVE, pełna visual acceptance oraz authshell nadal NOT_PROVEN w tej paczce. Pełny race zmiany polityki aż doCOMMIT nie jest udowodniony przez te testy; nie przenosimy boundedPASS na globalną gwarancję.

Dowody: `/Users/piotrwisniewski/Developer/codex-wt/codex7-artefakty/ie00-independent-final` — pg.json/log, identity.json/log, ui-create-receipt.json, ui-card-api-preparation.json, ui-vertical.json+7PNG, sql-readback.json, typed-consumer.json/png, readback-ON.json+3PNG, source-hashes.json. Zewnętrzne kopie harnessów mają własnyOUT i unikalnytytuł; stare evidence autora nie nadpisane. Tokeny odczytano wyłącznie z istniejącego prywatnego pliku, bez publikacji.
