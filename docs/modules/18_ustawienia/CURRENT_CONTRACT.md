---
module_id: MODULE_SETTINGS
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Settings — aktualny kontrakt funkcjonalny

## Cel i granica

Settings zarządza preferencjami bieżącego użytkownika i jego integracjami.
Nie może zmieniać polityk organizacji zarezerwowanych dla Admin Panel.

## Funkcje

| ID | Funkcja | Stan |
| --- | --- | --- |
| `SET-F-001` | Profil, język i wygląd | AS-IS |
| `SET-F-002` | Powiadomienia i dostępność | AS-IS / partial |
| `SET-F-003` | Preferencje Teresy i AI | AS-IS / partial |
| `SET-F-004` | Integracje i połączenia użytkownika | partial |
| `SET-F-005` | Prywatność, eksport i bezpieczeństwo konta | partial |

## Przepływ, dane i role

Użytkownik otwiera `/settings/*`, zmienia dozwoloną preferencję, zapisuje ją i
otrzymuje potwierdzenie. Zmiana obowiązuje we właściwym zakresie oraz na
kolejnej sesji. Wartość wymuszona polityką organizacji jest widoczna, lecz
nieedytowalna. Sekrety integracji nie są zwracane do UI po zapisaniu.

## AS-IS

Rodzina `/settings/*` jest aktywna i stanowi kanoniczną powierzchnię
preferencji. Istnieją linki do ustawień polityk, lecz szczegółowa inwentaryzacja
sekcji, trwałości i ownership nie została odświeżona względem runtime.

## TO-BE i luki

Spójne ustawienia z jawnym zakresem „użytkownik / organizacja / system”,
natychmiastowym feedbackiem, bezpiecznym zarządzaniem integracjami i eksportem.

- zinwentaryzować wszystkie sekcje, flagi i miejsca zapisu;
- sprawdzić konflikt preferencji z polityką organizacji;
- zweryfikować reset, eksport, usunięcie konta i reconnect integracji;
- dodać testy persystencji, bezpieczeństwa sekretów i dostępności;
- usunąć martwe lub pozorne kontrolki.

Ocena: `B`. Dowody: `STATUS.md`, `CODEMAP.md`, `/settings/*` i API ustawień.
