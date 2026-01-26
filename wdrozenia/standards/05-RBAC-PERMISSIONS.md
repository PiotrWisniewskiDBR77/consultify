# 🔐 RBAC / Permissions Standard (kanoniczny)

## Cel
Spójne uprawnienia (backend enforcement + frontend visibility), tak żeby workflowy (Task/Decision/Status) były bezpieczne i przewidywalne.

## Zasady
- **Backend jest źródłem egzekucji** (frontend tylko ukrywa/wyświetla).
- Każda akcja workflow ma wymagane permission (np. request-review, approve, generate, change-status).
- Permissions mają nazwy spójne i modułowe.

## Konwencja nazewnictwa permission
`<MODULE>_<ACTION>` lub `<DOMAIN>_<ACTION>` np.:
- `TOOLS_REQUEST_REVIEW`
- `TOOLS_APPROVE`
- `TOOLS_GENERATE_INITIATIVES`
- `DECISIONS_DECIDE`
- `REPORTS_GENERATE`
- `TASKS_CREATE`, `TASKS_UPDATE`, `TASKS_ASSIGN`, `TASKS_CLOSE`

## Minimalny zestaw ról (przykład)
- `SUPERADMIN`
- `ADMIN`
- `PROJECT_MANAGER`
- `CONSULTANT`
- `VIEWER`

## Wymagane w UI
- Brak permission → brak przycisku (nie „disabled ghost action”).
- Komunikat „unauthorized” tylko jeśli user trafi na akcję przez URL / race-condition.

## Historia zmian
- 2026-01-26: utworzono kanoniczny standard RBAC

