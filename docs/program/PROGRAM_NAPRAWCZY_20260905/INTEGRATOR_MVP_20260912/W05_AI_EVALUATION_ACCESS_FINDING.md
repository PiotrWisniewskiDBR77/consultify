# W05 — AI evaluation access finding, 2026-09-12

**SOURCE_FINDING, potencjalne P1; realny exploit nie został wykonany.** Niezależny read-only przegląd C4 WT `codex4-dlug-mvp`, baza HEAD `865c61677762ce19a42e8f412b40d18e69a7fe76`, bieżący W05 WIP. Bez requestów ewaluacji, provider call, testów, DB ani edycji source. Odczyt zasadniczego handlera i porównanie zakończono przed kolejną mutation rundą autora; numery WIP są chwilowe, hash poniżej identyfikuje tekst.

## Wniosek i warunki

Uwierzytelniony aktor aktywnej organizacji, bez dostępu do projektu i niebędący respondentem, może według kodu wejść do `evaluateSessionAnswers`, jeżeli zna sessionId przypisanej do tej organizacji sesji. Endpoint nie wywołuje `assertSessionAccessibleOrThrow`, `assertSessionOwnedByUser`, `canUserAccessSession` ani nowego `interviewAssignmentReviewAccess`. Nie znaleziono nadrzędnej bramki, która autoryzuje projekt/obiekt tej konkretnej operacji. Realna odpowiedź zależy od konfiguracji provider/gates i danych; stwierdzenie możliwości w source nie jest runtime dowodem udanego nadużycia.

## Dokładny łańcuch

1. Legacy `server/src/routes/interview.routes.ts:35–39`: apiAuthRateLimiter, verifyToken, validateOrgMembership, requireOrgAccess, demoContext;404 montuje POST `/sessions/:sessionId/evaluate-answers` bez lokalnej permission/ownership bramki. Gateway1396 montuje router pod `/api/interview`.
2. V8 `server/src/routes/v8/interview.routes.ts:423–424`: ten sam POST deleguje do identycznego Controller przez v8Wrap. `v8Wrap:98–110` jedynie opakowuje JSON w data/meta, nie autoryzuje. Nadrzędny `v8/index.ts:61–62,90,150` sprawdza token, org context i org feature gate; `requireV8OrgContext` w v8Auth138+ sprawdza obecność org, nie dostęp do project/session. Gateway1560 montuje v8FeatureGate. Funkcjonalne wyłączenie V8 nie naprawia legacy endpointu.
3. `InterviewController.ts:7374–7405`: requireUser wymaga req.user (helper664+). Sesja SELECT przez id oraz `(p.organization_id=actorOrg OR projectless s.organization_id=actorOrg)`; owner_id jest pobierane, lecz NIE porównywane z aktorem. Brak status guardu lub scoped review. Dla projektowej sesji nie ma nawet równoległego `s.organization_id=actorOrg`; to dodatkowa kwestia integralności przy uszkodzonym linku cross-org, nie potrzebna do głównego same-org findingu.
4. Questions7407+ pobierane po session_id+organization_id; przy zwykłej spójnej sesji projektu B z tej samej organizacji wszystkie odpowiedzi trafiają do ewaluatora, mimo braku membership B. Pusta lista zwraca empty bez provider i bez persist; nie dowodzi odmowy.
5. `persistSnapshot:7433–7455`: szuka assignment po session_id+organization_id, potem UPDATE ai_review_snapshot_json/ai_reviewed_at/updated_at po id. Brak uprawnień aktora, statusu/lifecycle, snapshot revision lub powtórnej kwalifikacji. Wyjątek jest tylko logowany; JSON success nie potwierdza skutecznego write.
6. `7480+`: wywołanie evaluateInterviewSessionAnswers. Zwykłe zakończenie7538 zapisuje snapshot, potem7546 zwraca wynik. Dla nieanonimowej sesji zwraca pełną ewaluację z per-answer feedback/recommendations, które mogą zawierać fragmenty odpowiedzi; to ryzyko ujawnienia pochodnej treści, nie twierdzenie że endpoint zawsze zwraca surowy answer_text. Dla anonymous działa istniejące redaction — nie omijać go w fixie.
7. Timeout7518 również persistuje marker i updated_at; provider error zwraca503 bez substytutu. Zatem brak udanego modelu nie gwarantuje braku write (timeout branch). Nie jest to endpoint czysto odczytowy.

## Istniejące vs nowa regresja W05

Porównano wydzielony tekst od `evaluateSessionAnswers:` do `aiParseSessionAnswers:` pomiędzy865c a odczytanym WIP: **identyczny bajtowo**. SHA256 handlera `9437f4dc803473a800edda17213d7ec7c25b117bea1114ac2b77dbba4c1d1169`. W bazie start7349, WIP7374. Bazowe routes legacy401/v8421 już miały tę samą bezpośrednią delegację bez permission.

W05 zmienia approve/send-back oraz scoped protected readers i UI. Nie dodał tego nieautoryzowanego handlera. `InterviewWorkspace.tsx:651–690` wywołuje evaluateSessionAnswers, a loader985 uruchamia go cicho dla submitted. Autor zgłosił rzeczywisty background snapshot write przy legalnym otwarciu; to **dowód autora o auto-write**, nie mój niezależny exploit bez uprawnień. Szersza legalna osiągalność scoped review w W05 może zwiększyć liczbę takich wywołań, ale sama luka dostępu istniała wcześniej.

W05 readonly reader fix nie powinien być nazywany pełnym zabezpieczeniem całego API Interview. Odmowa approve403 i unchanged lifecycle nie dowodzi niezmienności snapshotu, gdy niezależna autoevaluation nadal trwa. Negatywne readbacki muszą rozliczać każde żądanie i stan AI osobno; czekanie na ciszę nie jest rozwiązaniem authorization problemu.

## Rekomendowana następna bounded naprawa

- Oddzielna paczka: autoryzacja evaluate-answers w obu stosach z jednym wspólnym guardem przed odczytem odpowiedzi i kosztem modelu. Reużyć kanoniczne reguły respondent/team oraz jawny scoped reviewer, jeżeli istniejący kontrakt dopuszcza reviewer evaluation. Nie utożsamiać samego read access z prawem mutowania persisted AI snapshotu; ten zakres powinien być jawny.
- Wymagać zgodnego persisted org sesji, projektu i linked assignment; brak zaufania do projectId w body. Zachować ad-hoc/projectless respondent, team oraz anonimowość. Nie naprawiać przez org-wide create permission ani sam owner_id jeśli wycinałoby to legalny team.
- Ponownie sprawdzić odpowiednie uprawnienie i powiązania przy persist po długim model call; rozliczyć revocation i status/version drift. Rozdzielić pobranie już istniejącego snapshotu od jawnego przeliczenia, aby otwarcie submitted nie udawało readonly. Nie dodawać nowej procedury ani UI bez potrzeby.
- Zachować jawny timeout/503, redaction i brak późnego nadpisania timeoutu. Nie luzować lifecycle ani provider policy, nie włączać flag do stworzenia PASS.

## Minimalny plan dowodów

1. Obie rodziny endpointów: respondent legal; właściwy scoped reviewer legal zgodnie kontraktem; same-org user z projektem A wywołuje B —403/404 PRZED provider; foreign org404; projectless outsider denied. Licznik provider=0 na odmowie oraz hash questions/assignment AI fields/history/notifications unchanged.
2. Real JWT: create-only grant bez review, REVOKE, stale ADMIN→MEMBER, active membership revoked; brak uprawnienia nie może zwrócić derived feedback ani zmienić snapshotu.
3. Read-only negative bez żywego provider: fixture questions zawiera rozpoznawalny sentinel; denial przed provider zwraca bez sentinel/feedback. Do allowed path użyć wyraźnie oznaczonej kontrolowanej zależności lokalnej, nie udawać jakości realAI; provider live poza tą autoryzacją.
4. Deterministyczna pauza między authorized start a persist: revoke/move project/change assignment/status, potem completion i timeout. Wynik zapisuje się tylko jeśli nadal spełnia zdefiniowany kontrakt; nie dopisywać sukcesu po odmowie/revoke.
5. Anonymous respondent zachowuje self-review; reviewer/outsider nie uzyskuje cytatów odpowiedzi. Pusta sesja, provider503 i timeout mają odrębne efekty/readback.
6. Browser readonly open/reload submitted: policzyć evaluate POST oraz snapshot timestamps. Naprawa autoryzacji i ewentualna zmiana autoevaluation wymagają osobnych verdictów. Final W05 cycle nadal odbieramy na jego dokładnym SHA, z tym findingiem jawnie zachowanym jako istniejący dług, nie fikcyjnie zamkniętym przez approve/send-back.
