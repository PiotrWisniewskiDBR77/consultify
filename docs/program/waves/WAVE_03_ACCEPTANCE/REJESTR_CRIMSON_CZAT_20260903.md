# Rejestr crimson — Czat — 2026-09-03

## R1 — odtwarzalny mianownik

- `git grep -l 'primary-' -- src/components/AIChat | wc -l` → **62 pliki**.
- `git grep -c 'primary-' -- src/components/AIChat | awk -F: '{s+=$2} END {print s}'` → **262 wystąpienia**.
- ten sam wzorzec `primary-` w całym `src` → **2550 wystąpień**.
- `git grep -cE 'focus[^ ]*primary-' -- src` → **289 wystąpień**; pliki Czatu pokrywające się z torem 287: `CloudFilePicker.tsx`, `ConversationSearch.tsx`, `MoveToProjectModal.tsx`, `PrivateModeDetails.tsx`, `ProjectMembersModal.tsx`, `ToolsMenu.tsx`.

Liczby 5325/609/69 z `REJESTR_CRIMSON_20260902.md` używają szerszego mianownika: klasy Tailwind trzech aliasów koloru `primary`, `crimson` i `brand`; R1 dyżuru 311 liczy wyłącznie dosłowny wzorzec `primary-`. Dla AIChat szerszy rejestr podaje 739 wystąpień w 69 plikach, a ścisły wzorzec dyżuru daje 262 w 62 plikach. Oba wyniki są odtwarzalne i odpowiadają różnym pytaniom.

## Stan bramek PRZED

- `check-focus-canon.sh --ci`: OK, baseline 104 pliki / 208 wystąpień.
- `check-artefakt.sh`: OK ratchet, 9 aktualnie / 9 baseline.
- `check-list-canon.sh`: OK ratchet; pełny skan po pustym stagingu, 157 plików, 368 naruszeń / baseline 368.

## Klasyfikacja R2

Do uzupełnienia: plik · linia · klasa · PRZED · PO · commit.

## Semantyka krytyczna — zostaje

Do uzupełnienia w R2.

## Pokrycie z dyżurem 287

Sześć plików wskazanych wyżej jest tylko klasyfikowanych; wpisy pierścienia fokusu nie będą modyfikowane w R3.
