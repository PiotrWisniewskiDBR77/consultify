# 🧱 Standardy globalne (kanoniczne)

## Cel
Standardy w tym katalogu definiują **wspólne zasady** dla wszystkich modułów: UI/UX, błędy, statusy, kontrakty API, RBAC oraz standardy encji (Task/Decision/Report).

## Zasady
- **Jeden kanon**: jeśli istnieje kilka wersji dokumentu, obowiązuje wersja *bez sufiksów typu „ 2”*.
- **Dowody w kodzie**: standard powinien wskazywać przykłady plików/endpointów (gdzie to działa).
- **Bez fantomowych feature’ów**: nie opisujemy rzeczy, których nie ma nawet jako „tymczasowo działa”.

## Spis
- UI/UX: `wdrozenia/standards/01-UI-UX-STANDARD.md`
- Error handling: `wdrozenia/standards/02-ERROR-HANDLING.md`
- Status workflow: `wdrozenia/standards/03-STATUS-WORKFLOW.md`
- API contracts: `wdrozenia/standards/04-API-CONTRACTS.md`
- RBAC / permissions: `wdrozenia/standards/05-RBAC-PERMISSIONS.md`
- Encje (Task/Decision/Report/...): `wdrozenia/standards/entities/`

## Wersjonowanie
Każdy standard ma sekcję „Historia zmian”. Zmiany standardów = zmiany kontraktu → aktualizujemy też tracker.

