# K4 v5 — pełne polskie komunikaty realnych ujść serwera

**Werdykt E1: READY FOR INDEPENDENT REVIEW V5.** HOLD `4c658f01fe448e882d72e7cc4d8705c186ef368c` został naprawiony: dynamiczny błąd DCF lokalizuje rekurencyjnie treść z `claimResult.message`, katalog nie ma duplikatów, a 47 wcześniejszych wyników PL=EN zostało rozliczonych jako techniczne literały albo fragmenty parsera poza mianownikiem polskiej prozy.

## Uczciwy mianownik

Pełna klasyfikacja obejmuje `1584` wiersze: `1528` wierszy klasy `(b)` (`1270` unikalnych komunikatów), `48` technicznych kodów, `2` fragmenty parsera, `4` diagnostyki techniczne i `2` komunikaty wewnętrznych workerów. `unknown=0`.

Wszystkie `1528/1528` realne wiersze klasy `(b)` oraz `1270/1270` unikalnych szablonów mają polski wynik. Klasyfikacja nie zalicza kodów maszynowych do pełnego PL. Z 47 wcześniejszych wierszy klasy `(b)` z PL=EN: 46 unikalnych stałych kodów maszynowych przeklasyfikowano literalnie do `(a):technical-code` (47 wierszy źródłowych), a fragment `${alert.message}${alert.checks?.length ? ...` do `(a):parser-fragment`. Drugi częściowy literał parsera `Invalid code. ${remainingAttempts > 0 ? ...` również pozostaje jawnie poza runtime. Realne komunikaty PL=EN: `0`.

## Dynamiczny błąd DCF

`runDcfFcffValuation: ${claimResult.message}` pozostaje realnym ujściem HTTP. Lokalizator dopasowuje zewnętrzny szablon, rekurencyjnie lokalizuje przechwyconą treść i ponownie składa komunikat bez utraty szczegółów, placeholderów, statusu ani kodu. `batch37` zawiera trzy stabilne wyniki `claimForCompute`: brak zatwierdzonego outputu po sukcesie, konflikt klucza idempotencji oraz przegrany self-claim.

Bezpośrednie testy pełnego payloadu dla wszystkich `3/3` wyników wymagają pełnego PL, zachowania identyfikatora zadania, `status=409`, `code=JOB_NOT_RUNNING` i braku prefiksu `Błąd operacji:` oraz angielskiej treści źródłowej.

## Katalog i regresje

Katalog wykonawczy ma `2118` wierszy i `2118` unikalnych kluczy EN. Usunięto 7 dokładnych duplikatów; właściwe wpisy `runtime:false` pozostają w pomiarze źródłowym. Test katalogu wymusza unikalność. Test całego mianownika wymusza dokładne mapowanie katalogu, zachowanie multizbioru placeholderów oraz brak znanej angielskiej prozy. Placeholder nie jest usuwany z asercji; dynamiczna treść ma oddzielny test zachowania.

Zachowane są wcześniejsze dowody: MeetingExecutor → ActionExecutionAdapter → HTTP 400, Superadmin publish, AIPipeline execute/stream, canonical `users.language`, parser AST dla zagnieżdżonego `runtime:false` i PDF `doc.text`.

## Bramki przed refreeze

- właścicielski miernik K1: `72/72 PASS`, `--retry=0`;
- K4-owned focused: `49/49 PASS`, 8 plików;
- test lokalizatora: `12/12 PASS`, w tym 3 rzeczywiste payloady DCF;
- e-mail sender: `3/5`; dwa odziedziczone czerwone testy oczekują gołego adresu, a exact base zwraca nazwę nadawcy z adresem;
- katalog: `2118/2118` unikalnych kluczy, duplikaty `0`;
- migracje, deploy i zmiany w plikach zakazanych: `0`.

Wyniki TypeScript, języka, kanonu list, artefaktu i produkcyjnego builda są zapisywane w freeze manifeście po wykonaniu ich na finalnym content SHA.
