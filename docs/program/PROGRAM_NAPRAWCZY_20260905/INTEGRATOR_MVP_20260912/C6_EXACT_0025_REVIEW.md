# C6 — niezależny odbiór exact 0025c1c4484254ca29435ca0cc30638ba2bd889d

Werdykt integratora: **HOLD dla pełnej paczki i integracji**. Odbiór źródeł i istniejących logów, bez mutacji C6 i bez połączeń do baz/live. WT C6 czysty w chwili odczytu. Nie deklaruję własnego runtime PASS.

## Sprawdzone poprawki i dowody autora

Diff eb1b87ba31→0025c1c448 obejrzany. Eksport wyklucza integration_secrets, rekurencyjnie oczyszcza poprawny JSON-as-TEXT i zachowuje typ string; dynamiczne kolumny FK organizacji zastępują literalne organization_id w BFS. Test sprawdza sentinele sekretów, potomków staffing_plan_roles, dane drugiego tenantu oraz20001 wierszy JSON/CSV. Log e4-export-hold-followup-green.log ma4/4PASS w2plikach. Mutacja shared-user ma1FAIL/1skipped, odtworzenie1PASS/1skipped; to wybrany test mutacji, nie pełne2/2. Osobny pełny log4/4 uzupełnia wykonanie obu eksportów.

Nowy GET export wywołuje guard legal hold w transakcji i mapuje OrgPoliciesError. Test concurrent deletion jest teraz rzeczywiście uruchamiany przez .then przed COMMIT blockera. Odczyt testu potwierdza jednak scenariusz DELETE na istniejącym policy row, nie concurrent EXPORT ani pierwszy insert policy.

Budget UI reader/writer kieruje monthly_budget_usd do ai_budgets, oba istotne endpointy mają requireActiveMembership. Reset UPDATE ma predykat miesiąca i ponowny SELECT, co ogranicza podwójne zerowanie. E3 log ma1/1PASS UI→SQL→reload→gate. To potwierdza według autora zapis limitu; bez providera nie dowodzi naliczenia realnego kosztu. Współbieżne rezerwacje, revoke membership i reset interleaving nie otrzymują nowego PASS od tego review.

## Otwarte warunki odbioru

1. **R4 realnie nie działa:** populated delete rollback500 na immutable receipts. Raport autora poprawnie utrzymuje HOLD. Nie wolno zamknąć E4 pustym tenantem ani usunięciem FK/triggerów. Następny krok to zgodny z istniejącym kanonem projekt zachowania/anonimizacji references i retencji; jawna odmowa chroni historię, ale nie spełnia pełnej ścieżki usuwania.
2. **SOURCE FINDING — export/first-policy serialization:** ownership.routes GETexport zaczyna REPEATABLE READ, nie bierze lockOrganizationPolicy używanego przez upsertOrgPolicy i DELETE. Guard FOR SHARE blokuje istniejący row, ale nie blokuje nieistniejącego policy row. Nie ma testu startującego pierwszy legal hold przed eksportem. Potrzebny deterministyczny dwusesyjny test absent-row oraz existing-row dla eksportu. Samo dodanie advisory lock po utworzeniu snapshotu REPEATABLE READ może nadal widzieć stary stan; wzorzec rozwiązania musi jasno ustalać kolejność snapshot/lock. To nie ogłoszony runtime exploit.
3. **Kompletność/tenant policy:** discovery public-only oraz OR po wielu FK organizacji nie dowodzą praw do wszystkich pól relacji między organizacjami. Wymagana inwentaryzacja v8 i jawna polityka wieloorganizacyjnych rekordów. complete:true jest mocniejsze niż obecnie dowiedziona kompletność. Nie usuwamy tego warunku dlatego, że sztuczna tabela org_id przeszła test.
4. **Budget:** brak udanego provider→cost ledger→UI i brak ścisłego limitu współbieżnego pozostają wymaganiami MVP, a nie opcjonalną poprawą. Reset/source membership guard nie zastępują negatywnego realnego testu z cofniętym członkostwem.
5. **E1/E2/E5:** raport uczciwie zachowuje NOT_PROVEN dla pełnego klikanego createflow, KPIregistryUI i adminfeedback/appVersion/browser. Całość nie może dostać READY_FOR_PILOT.

## Zlecenie kolejnego kroku

C6 source pozostaje zamrożone do przydziału slotu. Dwie bieżące implementacje: IE00 i SECURITY-W05. Zespół może przygotować read-only kontrakt R4 i deterministyczny plan dwóch brakujących prób hold, bez nowej implementacji ani zmiany immutable zabezpieczeń. Root nie scala C6 pod etykietą gotowości pilotażu.
