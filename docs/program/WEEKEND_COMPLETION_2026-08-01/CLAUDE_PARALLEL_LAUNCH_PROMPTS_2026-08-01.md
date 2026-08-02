---
doc_id: claude-parallel-launch-prompts-2026-08-01
truth_type: operations
status: ready
owner: codex
product_owner: piotr
model: claude-opus
base_revision: c522a861839f54d0f26baa918566589aab3f6f6b
last_reviewed: 2026-08-01
---

# Trzy równoległe prompty startowe dla Claude Opus

Każdy prompt uruchamiamy w oddzielnym tasku Claude Code i oddzielnym worktree.
Claude nie wdraża, nie scala i nie dotyka Railway. Wynik wraca do Codex jako commit
na podanej gałęzi wraz z raportem odbiorowym.

## Linia A — Materials / Presentation canonical seed

```text
Jesteś Implementation Leadem linii A programu odbioru Consultify. Pracujesz modelem
Claude Opus. Twoim właścicielem integracji i Quality Gate jest Codex; Product Ownerem
jest Piotr.

REPO:
/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

BAZA PRACY:
- pobierz aktualny origin/demo;
- utwórz oddzielny worktree i gałąź: fix/mat-006b-canonical-deck-seed;
- dokładny revision bazowy: c522a861839f54d0f26baa918566589aab3f6f6b;
- jeśli revision nie jest przodkiem origin/demo albo worktree nie jest czysty: STOP i raport.

NAJPIERW PRZECZYTAJ W CAŁOŚCI:
1. docs/ssot/README.md
2. docs/program/WEEKEND_COMPLETION_2026-08-01/CLAUDE_START_INSTRUCTIONS.md
3. docs/program/WEEKEND_COMPLETION_2026-08-01/ROLE_AND_HANDOFF_PROTOCOL.md
4. docs/program/WEEKEND_COMPLETION_2026-08-01/ENVIRONMENT_AND_NAMING_AUTHORITY.md
5. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-006A_PRESENTATION_RESTORE_CAS.md
6. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-006B_PRESENTATION_LIFECYCLE_E2E.md
7. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-003A_WORKBOOK_GOLDEN_ROUNDTRIP.md
8. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/MAT-005A_DOCUMENT_CHECKPOINT_RESTORE.md
9. docs/demo/ATELIER_CLIENT_DEMO_RUNSHEET.md

CEL BIZNESOWY:
Materials w kontekście Demo Mode · Atelier Toys musi mieć co najmniej jeden naprawdę
gotowy deck, którego lista, preview, builder, canonical GET, eksport i share widzą tę
samą zawartość. Obecnie lista pokazuje „Line 3 Digital Twin — Steering Committee Deck”
jako Ready/11, a builder ten sam id `atelier--deck--line3-steering` otwiera jako 0 slajdów.

ZADANIE:
1. Ustal precyzyjną przyczynę rozjazdu `slide_count` vs `deck_json/unified_json`.
2. Napraw kanoniczny, idempotentny seed/materializację decków Atelier Toys. Nie doklejaj
   frontowego mocka ani fallbacku udającego slajdy.
3. `slide_count` ma być pochodną kanonicznej zawartości. Deck o statusie Ready i liczniku
   >0 nie może zwrócić pustych cards/slides.
4. Dla `atelier--deck--line3-steering` przygotuj spójną zawartość 11 slajdów na poziomie
   executive steering committee, z traceability do Line 3 Digital Twin. Użyj istniejących
   standardów DeckDocument i istniejącego story Atelier Toys; nie twórz nowego formatu.
5. Jeśli trzy istniejące decki są rekordami historycznymi niepodlegającymi canonical seed,
   zdefiniuj ich jawny los: migrate/upsert/archive. Nie zostawiaj licznika bez treści.
6. Dodaj test idempotencji seeda i test invariant:
   każdy `Ready` deck z `slide_count > 0` po `normalizeDeckDocument()` ma dokładnie tyle
   cards, ile deklaruje licznik.
7. Dodaj route/service round-trip test dla wskazanego decku. Test ma dotykać realnej
   warstwy SQL używanej przez aplikację, nie tylko fixture w pamięci.
8. Sprawdź, czy autosave nie uruchamia niepotrzebnego zapisu natychmiast po read-only
   reopen. Jeśli tak, napraw tylko w zakresie deck buildera i dodaj regresję.
9. Nie wykonuj staging E2E, deployu ani mutacji Railway. Przygotuj zmianę gotową do
   niezależnego review i późniejszej materializacji przez Codex.

DOZWOLONY OBSZAR:
- server/src/services/presentationDeckDocumentService.ts i jego testy;
- prezentacyjny seed/materializer w nowym, wąskim pliku;
- minimalne podłączenie do canonical Atelier seed, jeśli konieczne;
- server/src/routes/presentations.routes.ts tylko jeśli przyczyna leży w normalizacji;
- src/components/Presentations/DeckBuilder/** tylko dla udowodnionego błędu reopen/autosave;
- testy presentation/demo coherence.

ZAKAZY:
- nie zmieniaj Finance, AuthView, landing page, Results ani Execution;
- nie zmieniaj wspólnych tabel UI i design systemu;
- nie dodawaj migracji bez dowodu, że istniejący schemat nie wystarcza;
- nie usuwaj danych i nie uruchamiaj seeda na Railway;
- nie używaj consultinity ani production;
- nie commituj cudzych zmian; nie pushuj bezpośrednio do demo.

BRAMKI:
- targeted tests PASS;
- type-check PASS;
- build backend PASS, jeśli zmieniasz backend;
- git diff --check PASS;
- seed idempotentny;
- invariant count/content fail-closed;
- brak regresji CAS restore, export i share contracts.

NA KONIEC:
- zrób jeden lub kilka logicznych commitów na swojej gałęzi;
- nie scalaj;
- zwróć: przyczyna, pliki, commity, testy z liczbą PASS/FAIL, ryzyka, migracje=tak/nie,
  instrukcja materializacji na demo, rollback i dokładne kroki staging E2E dla Codex;
- jeśli naprawa wymaga decyzji produktowej, oznacz NEEDS_PRODUCT_DECISION i nie zgaduj.
```

## Linia B — Finance / Atelier Toys coherence

```text
Jesteś Implementation Leadem linii B programu odbioru Consultify. Pracujesz modelem
Claude Opus. Codex wykonuje niezależne review, integrację i deploy; Piotr jest Product Ownerem.

REPO:
/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

BAZA PRACY:
- pobierz origin/demo;
- utwórz oddzielny worktree i gałąź: fix/fin-005-atelier-coherence;
- bazuj dokładnie na c522a861839f54d0f26baa918566589aab3f6f6b;
- nie pracuj w głównym, brudnym worktree.

NAJPIERW PRZECZYTAJ W CAŁOŚCI:
1. docs/ssot/README.md
2. docs/program/WEEKEND_COMPLETION_2026-08-01/CLAUDE_START_INSTRUCTIONS.md
3. docs/program/WEEKEND_COMPLETION_2026-08-01/ROLE_AND_HANDOFF_PROTOCOL.md
4. docs/program/WEEKEND_COMPLETION_2026-08-01/ENVIRONMENT_AND_NAMING_AUTHORITY.md
5. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-001_CANONICAL_FINANCE_ROUTE.md
6. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-003A_REAL_STATEMENT_IMPORT_E2E.md
7. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/FIN-005_DEMO_GOLDEN_FLOW_COHERENCE.md
8. docs/product/ATELIER_FULL_DATASET_BUSINESS_ROLLOUT_MAP.md
9. docs/demo/ATELIER_CLIENT_DEMO_RUNSHEET.md
10. docs/program/WEEKEND_COMPLETION_2026-08-01/EXCEL_TECHNOLOGY_DECISION.md

CEL BIZNESOWY:
Finance ma opowiadać jedno wiarygodne golden flow Atelier Toys:
statement → analysis → model → investment case/baseline → plan vs actual → draft inicjatywy.
Nie może pokazywać DBR77, Apator, technicznych kopii ani odrzuconych testowych importów
w podstawowym workspace demo.

STWIERDZONY STAN STAGINGU:
- Demo Mode · Atelier Toys, ale Statements zawiera 5 rejected imports;
- surowa data `Thu Dec 31 2026 00:00:00 GMT+0000...` jest wyświetlana użytkownikowi;
- jedyny approved statement to DBR77 Manufacturing;
- Analysis to DBR77 Staging Financial Analysis;
- Models zawiera DBR77, Apator, M16 seed i cztery duplikaty kopii;
- `Value engine temporarily unavailable`;
- demo read-only guard działa i musi pozostać.

ZADANIE:
1. Zmapuj dokładnie owner tables/services/API dla Statements, Analysis, Models oraz
   value engine. Nie naprawiaj wyłącznie renderowania.
2. Napraw formatowanie okresu tak, aby frontend/API nigdy nie pokazywał surowego Date.
   Dodaj test dla ISO string, roku, null i legacy date string.
3. Przygotuj idempotentny, canonical Finance seed Atelier Toys:
   - jeden kompletny statement z P&L, BS i CF;
   - jedna zatwierdzona analiza;
   - jeden kanoniczny model `Atelier Toys — Transformation 2015 ROI`;
   - spójna waluta, okresy, lineage i owner;
   - liczby zgodne z istniejącym Atelier story i dokumentacją demo.
4. Zidentyfikuj źródło obcych rekordów. Nie usuwaj ich globalnie. Zaproponuj bezpieczną,
   tenant-scoped politykę archive/cleanup dla demo, z dry-run i rollbackiem.
5. Zamknij przyczynę czterech duplikatów: constraint/upsert key/idempotency test, bez
   destrukcyjnej migracji ad hoc.
6. Zdiagnozuj `Value engine temporarily unavailable`. Napraw tylko jeśli przyczyna mieści
   się w Finance owner service/route i nie wymaga nowej koncepcji. W przeciwnym razie
   zwróć osobny, precyzyjny blocker z dowodem.
7. Dodaj test coherence zabraniający nazw DBR77/Apator/technicznych seedów w aktywnym
   kanonicznym Atelier demo set. Test nie może blokować historycznych danych poza demo.
8. Nie wykonuj mutacji bazy Railway, deployu ani cleanupu. Przygotuj kod, dry-run plan,
   zapytania walidacyjne i rollback dla Codex.

DOZWOLONY OBSZAR:
- Finance views/components/services/routes i ich testy;
- istniejąca funkcja `upsertAtelierRoiFinancialModel` oraz nowy wąski Finance demo seeder;
- serializer/mapper okresów Finance;
- tenant-scoped dry-run cleanup script bez automatycznego uruchamiania;
- testy Finance/demo seed.

NIE DOTYKAJ:
- Presentations/Materials, AuthView, landing, Results/Execution;
- globalnego demo orchestration poza minimalnym wywołaniem Finance seeda;
- wspólnego design systemu;
- production i consultify.ai;
- Railway variables, migrations i danych stagingowych.

BRAMKI:
- targeted unit/integration tests PASS;
- real SQL round-trip dla statement→analysis→model;
- seed uruchomiony dwa razy nie zwiększa liczby rekordów;
- brak obcych aktywnych rekordów w canonical demo fixture;
- date serialization tests PASS;
- type-check i build:backend PASS;
- git diff --check PASS;
- demo read-only guard bez regresji.

NA KONIEC:
- commituj wyłącznie swoją gałąź, nie scalaj i nie deployuj;
- raport: root cause per problem, mapa route→service→table, commity, testy, ryzyka,
  dry-run cleanup, rollback, instrukcja materializacji i staging acceptance dla Codex;
- oznacz NEEDS_PRODUCT_DECISION, jeśli liczby biznesowe wymagają wyboru Piotra.
```

## Linia C — publiczne Try demo / auth / isolation

```text
Jesteś Implementation Leadem linii C programu odbioru Consultify. Pracujesz modelem
Claude Opus. Codex jest właścicielem integracji i stagingu; Piotr zatwierdza produkt.

REPO:
/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify

BAZA PRACY:
- pobierz origin/demo;
- oddzielny worktree, gałąź: fix/ops-demo-002-public-entry;
- revision bazowy: c522a861839f54d0f26baa918566589aab3f6f6b;
- zmiana allowlisty `demo.consultify.ai` i host guard jest już w tym revision — zachowaj ją.

NAJPIERW PRZECZYTAJ W CAŁOŚCI:
1. docs/ssot/README.md
2. docs/program/WEEKEND_COMPLETION_2026-08-01/CLAUDE_START_INSTRUCTIONS.md
3. docs/program/WEEKEND_COMPLETION_2026-08-01/ROLE_AND_HANDOFF_PROTOCOL.md
4. docs/program/WEEKEND_COMPLETION_2026-08-01/ENVIRONMENT_AND_NAMING_AUTHORITY.md
5. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/OPS-DEMO-001_CONTROLLED_DEMO_PROMOTION.md
6. docs/program/WEEKEND_COMPLETION_2026-08-01/PACKETS/OPS-DEMO-002_DEMO_ENTRY_AUTH.md
7. docs/DEMO_MODE.md
8. docs/qa/demo-trial-test-plan.md
9. server/src/routes/auth.routes.ts — szczególnie register-demo, login i deprecated demo-login
10. src/components/Landing/DemoModeModal.tsx oraz src/views/AuthView.tsx

CEL BIZNESOWY:
Prospekt naciska `Try demo`, tworzy konto albo loguje się, trafia do izolowanego,
seedowanego i read-only workspace Atelier Toys, a potem może przejść demo bez dostępu
do danych innej organizacji. Ścieżka musi być bezpieczna i odtwarzalna.

STWIERDZONY STAN STAGINGU:
- modal `Experience Consultify Demo` działa;
- `piotr.wisniewski@demo.com` istnieje, ale zapisane hasło nie odpowiada historycznemu;
- `anna.zielinska@ateliertoys-demo.com` nie istnieje;
- administratorskie konto DBR77 wchodzi i może technicznie przełączyć się do Demo Mode;
- nie wolno opierać publicznego Try demo na tym koncie;
- host allowlist i fail-closed resolver zostały już naprawione, testy 3/3 PASS.

ZADANIE:
1. Ustal i opisz jedną kanoniczną ścieżkę publiczną: preferowane `register-demo` tworzące
   izolowaną organizację sesyjną na bazie Atelier template. Stałe hasło administratora
   nie jest rozwiązaniem publicznym.
2. Prześledź landing modal → API → token/cookies → demo/enter/toggle → organization context.
3. Napraw flow tak, aby nowy, unikalny namespaced email mógł:
   register → enter Atelier Toys → `/chat` → odczytać moduły → logout.
4. Zapewnij tenant isolation: dwa konta demo nie mogą widzieć swoich wzajemnych zmian,
   tokenów ani organizacji. Dodaj test pozytywny i negatywny.
5. Ustal lifecycle konta/org demo: TTL, cleanup, retry/idempotency i recovery. Wykorzystaj
   istniejący `cleanup-orphan-demo-orgs.ts`; nie twórz drugiego konkurencyjnego mechanizmu.
6. UI błędu ma rozróżniać invalid credentials, brak konta i niedostępny seed bez ujawniania,
   czy dowolny realny email istnieje. Publiczny komunikat ma być bezpieczny.
7. Nie przywracaj deprecated anonymous `/demo-login` na środowisku nietestowym.
8. Nie zapisuj haseł w dokumentacji, logach ani nowym seedzie. Usuń z nowych testów
   realne adresy osób, używaj namespaced fixture.
9. Dodaj pełny integration test landing-contract/API (bez browser mocka) i przygotuj
   Playwright staging spec, ale nie uruchamiaj go na Railway i nie deployuj.
10. Sprawdź, czy demo rejestracja nie może nadać SUPERADMIN/OWNER ani wejść do Admin Panel.

DOZWOLONY OBSZAR:
- src/components/Landing/DemoModeModal.tsx i testy;
- src/views/AuthView.tsx tylko bez regresji istniejącego host guard;
- server/src/routes/auth.routes.ts, demo enter/toggle routes i ich testy;
- demo session/seed isolation services;
- cleanup-orphan-demo-orgs.ts;
- auth/demo E2E specs i dokumentacja packetu OPS-DEMO-002.

NIE DOTYKAJ:
- Materials/Presentations, Finance, Results/Execution;
- produkcji, Railway variables i prawdziwych kont;
- deployu, seeda lub cleanupu na demo;
- szerokiego refaktoru całego auth systemu poza publicznym demo flow.

BRAMKI:
- register-demo success + duplicate/retry behavior;
- tenant A nie widzi tenant B;
- demo role/capability jest najmniejsza wystarczająca i nie ma Admin Panel;
- cookies/token rotation/logout działają;
- cleanup jest tenant-scoped, dry-run i odtwarzalny;
- host allowlist tests nadal PASS;
- type-check, build:backend, targeted auth tests i git diff --check PASS;
- brak sekretów w diffie i logach.

NA KONIEC:
- logiczne commity na swojej gałęzi; bez merge/push do demo/deployu;
- raport do Codex: root cause, kontrakt, role, tenancy, commity, testy, ryzyka,
  cleanup/recovery, rollback oraz exact staging steps z namespaced fixture;
- NEEDS_PRODUCT_DECISION tylko jeśli nie da się bezpiecznie wybrać między izolowanym
  register-demo a wspólnym read-only tenantem na podstawie istniejącego SSOT.
```

## Kolejność odbioru przez Codex

1. Linia C — security i poprawny fixture wejściowy.
2. Linia A — Materials canonical seed i Presentation E2E.
3. Linia B — Finance coherence oraz statement→model→actuals.

Kolejność odbioru nie blokuje równoległej implementacji. Blokuje jedynie merge i
promocję na staging, które wykonuje sekwencyjnie Codex.
