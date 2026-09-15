# K4 v6 — pełne polskie komunikaty realnych ujść serwera

**Werdykt E1: READY FOR INDEPENDENT REVIEW V6.** HOLD `48da1a415b507584ed369fe0718f7aff7bffa152` został naprawiony: marker `__schema_version_at_creation` nie dociera już do odpowiedzi ani do `SchemaProposalCard`; wersja pozostaje dostępna dla kontroli nieaktualnej propozycji, a użytkownik dostaje ludzkie EN/PL.

## Uczciwy mianownik

Pełna klasyfikacja obejmuje `1585` wierszy: `1529` wierszy klasy `(b)` (`1271` unikalnych komunikatów), `48` technicznych kodów, `2` fragmenty parsera, `4` diagnostyki techniczne i `2` komunikaty wewnętrznych workerów. `unknown=0`.

Wszystkie `1529/1529` realne wiersze klasy `(b)` oraz `1271/1271` unikalnych szablonów mają polski wynik. Klasyfikacja nie zalicza kodów maszynowych do pełnego PL. Z 47 wcześniejszych wierszy klasy `(b)` z PL=EN: 46 unikalnych stałych kodów maszynowych przeklasyfikowano literalnie do `(a):technical-code` (47 wierszy źródłowych), a fragment `${alert.message}${alert.checks?.length ? ...` do `(a):parser-fragment`. Drugi częściowy literał parsera `Invalid code. ${remainingAttempts > 0 ? ...` również pozostaje jawnie poza runtime. Realne komunikaty PL=EN: `0`.

## Granica wersji schematu

`ChatToSchemaService` przechowuje wersję w dotychczasowym JSONB `warnings`, więc zmiana nie wymaga migracji. Wspólna funkcja prezentacji używana przez create/get/list wyjmuje marker do `schema_version_at_creation` i zastępuje go komunikatem `Schema version at proposal creation: 17`. Globalna lokalizacja payloadu daje `Wersja schematu podczas tworzenia propozycji: 17`. `executeProposal` po ponownym odczycie otrzymuje liczbę `17` i może wykonać kontrolę stale-version. W payloadzie i renderze karty liczba surowych markerów wynosi `0`.

Test zachowania obejmuje rekord zwrócony przez repozytorium, publiczny wynik serwisu, lokalizację pełnego payloadu dla profilu PL i render `SchemaProposalCard`: EN human, PL human, raw marker `0`, wersja zachowana.

## Dynamiczny błąd DCF

`runDcfFcffValuation: ${claimResult.message}` pozostaje realnym ujściem HTTP. Lokalizator dopasowuje zewnętrzny szablon, rekurencyjnie lokalizuje przechwyconą treść i ponownie składa komunikat bez utraty szczegółów, placeholderów, statusu ani kodu. `batch37` zawiera trzy stabilne wyniki `claimForCompute`: brak zatwierdzonego outputu po sukcesie, konflikt klucza idempotencji oraz przegrany self-claim.

Bezpośrednie testy pełnego payloadu dla wszystkich `3/3` wyników wymagają pełnego PL, zachowania identyfikatora zadania, `status=409`, `code=JOB_NOT_RUNNING` i braku prefiksu `Błąd operacji:` oraz angielskiej treści źródłowej.

## Katalog i regresje

Katalog wykonawczy ma `2119` wierszy i `2119` unikalnych kluczy EN. Usunięto 7 dokładnych duplikatów; właściwe wpisy `runtime:false` pozostają w pomiarze źródłowym. Test katalogu wymusza unikalność. Test całego mianownika wymusza dokładne mapowanie katalogu, zachowanie multizbioru placeholderów oraz brak znanej angielskiej prozy. Placeholder nie jest usuwany z asercji; dynamiczna treść ma oddzielny test zachowania.

Sześć pozycji `(a)` ma dokładne, zakotwiczone wzorce w konfiguracji miernika: dwa fragmenty parsera oraz cztery techniczne formaty kodu/diagnostyki. Nie ma wykluczenia ścieżki ani wzorca wieloznacznego obejmującego inne komunikaty.

Zachowane są wcześniejsze dowody: MeetingExecutor → ActionExecutionAdapter → HTTP 400, Superadmin publish, AIPipeline execute/stream, canonical `users.language`, parser AST dla zagnieżdżonego `runtime:false` i PDF `doc.text`.

## Bramki przed refreeze

- właścicielski miernik K1: `72/72 PASS`, `--retry=0`;
- v6 chain focused: `74/74 PASS`, 3 pliki (service, payload locale, karta UI);
- wcześniejsze K4-owned focused: `49/49 PASS`, 8 plików;
- test lokalizatora: `12/12 PASS`, w tym 3 rzeczywiste payloady DCF;
- e-mail sender: `3/5`; dwa odziedziczone czerwone testy oczekują gołego adresu, a exact base zwraca nazwę nadawcy z adresem;
- katalog: `2118/2118` unikalnych kluczy, duplikaty `0`;
- migracje, deploy i zmiany w plikach zakazanych: `0`.

Wyniki TypeScript, języka, kanonu list, artefaktu i produkcyjnego builda są zapisywane w freeze manifeście po wykonaniu ich na finalnym content SHA.
