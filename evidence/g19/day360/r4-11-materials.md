# Dyżur 360 — R4: 11_MATERIALS — kubełek A przypisany błędnie

`11_MATERIALS` był w kubełku `A` błędnie jako pojedynczy, domykalny przelot: brief wymaga dwóch niezależnych rodzin — mutacji komendy workbook oraz pary obcy/właściciel dla decka.

## Zmierzona część workbook

- Trasa `POST /api/workbook/:id/commands` jest osiągalna przez `ApiGateway` (`server/src/Gateway.ts:611-612`).
- Strażnik odczytu komendy: `server/src/services/workbook/workbookCommandService.ts:112`, `WHERE id = ? AND organization_id = ?`.
- Zastane testy day276 workbook+deck: 4/4, `--retry=0`, realny PostgreSQL.
- Mutacja workbook: usunięcie filtra organizacji z odczytu rekordu. RED: 1/2; obcy dostał 409 zamiast dopuszczonego 403/404 (`expected [403,404] to include 409`). Po `cp`: 2/2 GREEN, diff pusty.

## Brakujący dowód

`server/src/routes/__tests__/day276-deck-autosave-persist.pg.test.ts` ma tylko właściciela. Drugi test sprawdza konflikt wersji tego samego właściciela, nie obcą organizację. Nie ma pary obcy/właściciel na tym samym `deckId`, kodów i długości ciał ani mutacji strażnika decka.

Dlatego brief `tests/unit/day353-g19-11-materials.contract.test.ts` pozostaje czerwony, a wiersz G19 modułu 11 pozostaje bez zmiany. Brakujące Y: para deck 404/200 przez ApiGateway oraz mutacja jego filtra `organization_id`; dopiero razem z wykonaną mutacją workbook można rozważać wpis.
