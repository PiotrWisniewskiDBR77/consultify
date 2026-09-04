# Dyżur 360 — R5: podniesienie wierszy

| Wiersz | Dowód | Pięć pól |
| --- | --- | --- |
| 01_ORGANIZATION | `r2-01-organization.md` | data, SHA, mianownik 1/49 ze źródłem, pełna nazwa, ścieżka |
| 04_ASSESSMENT | `r4-04-assessment.md` | data, SHA, mianownik 1/30 ze źródłem, pełna nazwa, ścieżka |
| 05_INITIATIVES | `r4-05-initiatives.md` | data, SHA, mianownik 1/30 ze źródłem, pełna nazwa, ścieżka |
| 08_MEETINGS | `r3-08-meetings.md` | data, SHA, mianownik 1/49 ze źródłem, pełna nazwa, ścieżka |
| 13_CHAT | `r4-13-chat.md` | data, SHA, mianownik 1/30 ze źródłem, pełna nazwa, ścieżka |

- Podniesione wiersze: **5**.
- Dowody załączone w tych samych commitach: **5**.
- Wiersze 06 i 11 niepodniesione z imiennymi dowodami luk: `r4-06-execution.md`, `r4-11-materials.md`.
- Bezpiecznik po ostatnim wpisie: zbadanych 16, 5 × `WAZNY`, 11 × `NIE_DOTYCZY`, zero `BRAK_DATY_POMIARU`, exit 0.
- Żaden stan nie zawiera słowa `PASS`; każdy podniesiony wiersz nazywa otwarty mianownik.

## Pytanie rozstrzygalne do właściciela

Czy mianownik G19 ma pozostać historycznym zbiorem per moduł zapisanym w macierzy (`28/30/49` wg `G19_INWENTARZ_OBOWIAZKOW_20260903.md`), czy ma zostać zastąpiony wspólnym bieżącym zbiorem dryfu `106` z `evidence/g19/day348-artefakty/g19-dryf-dzis.txt`? Wariant historyczny pozwala domykać per moduł po pokryciu wskazanej listy, ale nie obejmuje późniejszego dryfu; wariant bieżący wymaga ponownego przypisania 106 plików do modułów i utrzymania tej listy przy każdym markerze. Do decyzji liczby w macierzy pozostają nietknięte, a stany mają `MIANOWNIK_OTWARTY`.
