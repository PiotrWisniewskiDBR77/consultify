# CODEX DAY 249 — SYGNATURA BEZ OCHRONY

## Status

Dyżur pomiarowy zakończony na markerze `df7f13056f`. `MARKER OK`; HEAD wejściowy `df7f13056fa24995be07f64b0e8c877b3faeab45`; status wejściowy pusty. Tip był 9 commitów i 58 ścieżek przed markerem. Produktu nie zmieniono. Modelu językowego nie użyto.

## Zasoby i migracje

- przed worktree: 10 GiB wolnego; po worktree i migracjach: 8.2 GiB;
- porty 6238, 5218 i 5219 były wolne;
- lokalny `cx-day249-pg`, wyłącznie `127.0.0.1:6238`, baza `cx249`;
- pierwszy przebieg zastosował 880 migracji; drugi: `Applying migrations: 0`; oba zakończone `Postgres migrations complete`.

## R0

| Przypadek | Werdykt | Dowód |
|---|---|---|
| `proactiveNudges.generateNudges(userId, orgId?)` | BEZPIECZNY mimo nieużytego `orgId` | trzy zapytania są zawężone przez `userId`; `users.organization_id` jest pojedynczą kolumną użytkownika (`000_z_core_baseline.sql:91`) |
| `abTesting.startExperiment(id, userId)` | DZIURAWY | `userId` ma zero użyć; UPDATE ma tylko `WHERE id = ? AND status = 'draft'` i `[id]` |
| `FieldPermissionService.canReadField/canWriteField` | NIEJEDNOZNACZNY / MARTWE API | `userId` ma zero użyć, ale pełne wyszukanie znalazło zero wywołań dokładnie tych metod; aktywni konsumenci używają innych metod rodzeństwa |
| `StudioService.getDocument` | REFERENCJA NAPRAWIONA | `StudioService.ts:125` porównuje `organization_id` oraz `userId` |

T1-T6 potwierdzone. T7: instrukcje 246/247 nie istnieją na markerze. T8 potwierdzone.

Warunek licencji wąskiej naprawy nie został spełniony: dokładne metody `canReadField/canWriteField` nie mają callerów, więc nie istnieje źródło argumentu `userRole` do sklasyfikowania. Nie zmieniono kodu i nie utworzono warunkowego testu.

## R1 i R2

Literalna regeneracja AST według opisu instrukcji dała **22 kandydatów**, nie 82 (`kandydaci.json`). Jawna lista osadzona w instrukcji ma faktycznie **74 wiersze**, nie 82. Wszystkie 74/74 zlokalizowano przez AST, przeczytano od początku do końca funkcji i sprawdzono wywołania SQL/delegacje (`lista-analiza.json`).

Klasyfikacja jawnej listy: **74 BEZPIECZNE, 0 DZIURAWYCH, 0 NIEJEDNOZNACZNYCH**. Każdy docelowy parametr trafia bezpośrednio do parametrów SQL albo do funkcji delegowanej, która go egzekwuje. Wyjątki wymagające szerszego osądu również są bezpieczne: `behaviorIntelligenceService.getAdoptionMetrics` scope'uje przez `userId`; `TaskService.deleteTask` przekazuje `userId` do `verifyProjectAccess` przed DELETE; `BillingWebhookService.dunningFailed` przekazuje `orgId` do `triggerEvent`; `ListProjectsQuery.organizationId` jest użyty przez handler w `WHERE organization_id = ?`.

Pełna tabela 74 pozycji wraz z zakresem linii, liczbą referencji i argumentami wszystkich wywołań DB znajduje się w trwałym artefakcie `lista-analiza.json`; tekst wejściowej listy w `instrukcja-kandydaci.txt`.

## Testy i Z24

Nie ogłaszam wyniku testów. Plik testowy z licencji wolno utworzyć i uruchomić wyłącznie przy podjęciu wąskiej naprawy; naprawy nie podjęto. Nie istnieje więc pakiet przed/po ani zbiór nazw do porównania. Uruchomienie nieistniejącego pliku byłoby fałszywym pomiarem.

## Z30

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `BRAK ZMIENNYCH POCZTY`; zapytanie tabeli `settings` zwróciło 0 wierszy `smtp%`; grep drenaży w `Gateway.ts` dał 0 trafień.

## Artefakty poza repo

Katalog `/private/tmp/cx-day249-sygnatura-bez-ochrony-artefakty`:

- `r0.txt` — `6d7f517897f93be99087ea7d4f19016feac407bb301bae8c84504cd9ac44cc50`;
- `kandydaci.json` — `a71c1a1c8133bbcc3c0fffd29e2fbd09cc25c39e2086f2e7f4a8f2ea2c1db84d`;
- `instrukcja-kandydaci.txt` — `a392d0b29079478c492f8f060aecd8d8fe6a0f4d0ac2717ca0af476dbf8db94a`;
- `lista-analiza.json` — `765f70c9d15afecea40ca704792d976b0fdd8152afeabe028656a676f3471b32`;
- `migracje-1.log` — `f7d619df2a9cd6bb30bb7472f590bac7bae134249433632e6f743d01eb8dfbf4`;
- `migracje-2.log` — `76ece9ef34f5ef9993e306448a15b65e4311c116e2aaa434f56bddeb02a78bdb`.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano osiągalności `abTesting.startExperiment` przez realny ApiGateway/JWT/PostgreSQL; licencja obejmuje pomiar serwisu, nie test tej funkcji.
- Nie rozstrzygnięto pochodzenia `userRole` dla aktywnych metod rodzeństwa `filterRecordFields` i `validateWritePermissions`; nie są objęte warunkową licencją naprawy.

## Korekty wobec instrukcji

- Instrukcja mówi o 82 kandydatach; jej blok ma 74 wiersze, a literalna regeneracja AST daje 22. Oba własne pomiary zachowano.
- Pliki instrukcji 246/247 nie istnieją na markerze.
- Sugestia możliwych niebezpiecznych wywołań `canReadField/canWriteField` została obalona: wywołań dokładnych metod jest zero.

## Zakres zmian

Wyłącznie ten raport i dopisana sekcja rejestru kształtu 23. Produkt, testy i infrastruktura testowa bez zmian.
