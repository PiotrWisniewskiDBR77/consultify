# Dyżur 360 — R4: 06_EXECUTION — kubełek A przypisany błędnie

`06_EXECUTION` był w kubełku `A` błędnie w rozumieniu wymaganego dowodu: brakuje osiągalnej trasy runtime execution przez realny `ApiGateway`.

- `rg -n "initiativesExecutionRuntime|runtime-v1" server/src/Gateway.ts` zwrócił zero trafień.
- Istniejący `tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts` montuje `createInitiativesExecutionRuntimeRouter(...)` samodzielnie pod `/runtime-v1` i wstrzykuje własne `authorize`; instrukcja Z22 mówi, że taki test nie dowodzi ścieżki produkcyjnej.
- Plik `server/src/routes/pmo/initiativesExecutionRuntime.routes.ts` zawiera odczyty organizacyjne, ale istnienie pliku nie jest osiągalnością.

Nie da się uczciwie złożyć wymaganej pary ApiGateway/JWT/PG ani mutacji produkcyjnego strażnika bez dodania mountu w `Gateway.ts`, który jest plikiem przekrojowym i ma w tym dyżurze licencję tylko do odczytu. Brief `tests/unit/day353-g19-06-execution.contract.test.ts` pozostaje czerwony, a wiersz G19 modułu 06 pozostaje bez zmian.

Brakujące Y: zaakceptowany mount routera w `ApiGateway`, następnie para obcy/właściciel na tym samym istniejącym execution case i mutacja filtra `organization_id` w produkcyjnej ścieżce.
