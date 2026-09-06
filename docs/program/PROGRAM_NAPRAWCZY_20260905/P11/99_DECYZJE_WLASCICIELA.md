# P11 — decyzje właściciela

Jedno pytanie na wiersz. Brak odpowiedzi nie unieważnia wykonanej części, ale pozostawia cały P11 w stanie `PARTIAL / NOT PROVEN`.

| obszar | pytanie | rekomendacja | co się stanie po „Tak” |
|---|---|---|---|
| dane stanowiska | Czy wolno dodać minimalny opublikowany scenariusz portfela do bazy NOC, aby utworzyć pierwszy realny plan i przejść pełny przepływ klikowy? | Tak, przez istniejący kontrakt produktu, z jawnym identyfikatorem i bez ręcznego fałszowania stanu agregatu. | Powstanie realny plan; raport dostanie jego ID, dowód wiersza listy i pełny przepływ 5 inicjatyw / 12 tygodni. |
| publikacja z konfliktami | Czy rozszerzyć kontrakt publikacji o wymagane potwierdzenie „Publikuję mimo N konfliktów” oraz trwały zapis tego potwierdzenia w śladzie? | Tak; sama przeglądarkowa `confirm()` nie spełnia wymogu audytowego. | Serwer odrzuci publikację bez potwierdzenia, zapisze decyzję w śladzie i powstanie test RealPG z mutacją RED. |
| nazwa na RealPG | Czy dopuścić utworzenie izolowanych fixture testowych na PG 54400 dla zapisu/odczytu `name` i zgodności agregatu bez `name`? | Tak, z własnym `organization_id` i sprzątaniem wyłącznie fixture testu. | Powstanie `planScenario.name.realdb.test.ts` i dowód GREEN plus kontrolowana mutacja RED. |
| mutacje | Czy P11 ma pozostać nieodebrany do czasu wykonania wszystkich 7 mutacji i zapisania siedmiu wyników RED? | Tak — nie obniżać bramki do samego GREEN. | Każde zabezpieczenie zostanie faktycznie sfalsyfikowane; dopiero 7/7 RED zamknie próg. |
| tabela planów | Czy zaakceptować pustą tabelę jako dowód, że wiersze są planami, a nie inicjatywami? | Nie; rekomenduję powtórzyć pomiar po utworzeniu realnego planu. | Po „Tak” byłby to świadomy wyjątek od bramki behawioralnej; rekomendowany skutek to jednak nowy pomiar z co najmniej jednym planem. |
| dowód kart | Czy zaakceptować dev-render z siedmioma błędami sieci/OrgContext jako końcowy dowód runtime kart i generatora? | Nie; traktować go wyłącznie jako dowód wyglądu zamontowanych komponentów. | Po „Tak” świadomie osłabimy bramkę runtime; rekomendacja pozostaje: powtórzyć zrzuty na realnym rekordzie bez błędów konsoli. |

