# 🏷️ Naming Conventions (kanoniczne)

## Cel
Uniknąć chaosu importów/plików (w szczególności różnic w casing na Linux/CI) oraz mieć przewidywalne nazewnictwo encji, endpointów i permissionów.

## Pliki i eksporty
- **Bez duplikatów typu „* 2”** w kodzie i dokumentacji.
- **Spójny casing** w importach (TS/ESM): plik i import muszą mieć identyczną wielkość liter.
- Preferuj jeden publiczny punkt eksportu (np. `index.ts`) per folder komponentów shared.

## Encje
- Encje: `PascalCase` w typach/interfejsach (`Decision`, `Task`, `Report`)
- Pola: `camelCase` (`dueDate`, `decisionOwnerId`)
- Enum values: `UPPER_SNAKE_CASE` (np. `PENDING`, `APPROVED`)

## API
- Zasoby w URL: `kebab-case` i liczba mnoga: `/api/my-work`, `/api/decisions`, `/api/reports`
- Akcje workflow jako pod-ścieżki: `/api/<resource>/:id/status`, `/api/<resource>/:id/approve`

## Permissions
`<DOMAIN>_<ACTION>` (UPPER_SNAKE_CASE), np. `TASKS_CREATE`, `DECISIONS_DECIDE`, `REPORTS_GENERATE`.

## Historia zmian
- 2026-01-26: utworzono kanon naming conventions

