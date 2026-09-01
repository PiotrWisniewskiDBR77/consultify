---
module_id: MODULE_SETTINGS
truth_type: product-target
status: canonical
owner: product
last_reviewed: 2026-07-30
---

# Settings — aktualny kontrakt funkcjonalny

> ### ★ STAN ZMIERZONY 2026-09-01 (dyżur 238) — pełny pomiar: `docs/functional/POMIAR_2026-09-01_ORGANIZACJA_SPOTKANIA_USTAWIENIA.md`
>
> **Obalone 1.09.** `docs/FUNCTIONAL_DOCUMENTATION.md:57` nosi zapis
> **„CLOSED_FINAL 2026-08-25"**, ale karta modułu
> (`docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md:35-36`)
> ma bramki `G08`/`G09` w stanie `NOT_STARTED` — **pierwszy przegląd wizualny
> nigdy się nie zaczął.** Sprzeczność między dwoma dokumentami tego samego
> stanu — nierozstrzygnięta tutaj, patrz pomiar.
>
> **Zmierzone bezpośrednio na `SettingsSidebar.tsx`: 37 sekcji w 10 grupach**
> (nie 47 — poprzedni pomiar liczył nagłówki grup razem z pozycjami). Dla
> zwykłego użytkownika dozwolone są **4** (`profile`, `auth-access`,
> `language`, `theme` — `src/utils/pilotAccess.ts:15-19`), więc **33 z 37
> (89%) jest niedostępnych — mechanizm USUWA** te pozycje z listy
> (`SettingsSidebar.tsx:491-492`), nie dekoruje kłódką.
>
> **Przekierowanie z niedozwolonej trasy jest całkowicie ciche**
> (`RouterSync.tsx:330-344`): w tym bloku nie ma nawet wpisu do dziennika.
> Gdyby użytkownik zgłosił „klikam i nic się nie dzieje", nie
> znaleźlibyśmy tego w dzienniku.

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
