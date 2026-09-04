# Dyżur 353 — R1: porównanie liczb punktu wznowienia

Marker pomiaru: `29fcbd4de20ca26d2febc50d9455128cab47ffce`.

| # | Mianownik | Liczba autora instrukcji | Mój pomiar |
| --- | --- | --- | --- |
| 1 | Pliki dryfu G19 | 106 | 106 |
| 2 | Pliki dryfu bez testów | 90 | 90 |
| 3 | Blok 1 z artefaktu `przed` | 131 / 127 / 4 | 131 / 127 / 4 |
| 4 | Blok 2 z artefaktu `przed` | 218 / 218 / 0 | 218 / 218 / 0 |
| 5 | Blok 3 z artefaktu `przed` | 18 / 11 / 7 | 18 / 11 / 7 |
| 6 | Dystans od kotwicy: wszystkie / bez merge / first-parent | 1216 / 1015 / 315 | 1216 / 1015 / 315 |
| 7 | Mianownik wpisany w G19 modułu 01 | 49 | 49 |
| 8 | Kubełki po R2 dyżuru 348 | A=7 / B=0 / C=9 | A=7 / B=0 / C=9 |
| 9 | Moduły A bez dowodu | 5 (`04`, `05`, `06`, `11`, `13`) | 5 (`04`, `05`, `06`, `11`, `13`) |
| 10 | Wiersze podniesione / dowody załączone | do ustalenia w R5 | do ustalenia w R5 |
| 11 | Liście słowników; bramki focus/list/artefakt/reach | 35199 / 33066; 0/0/0/0 | 35199 / 33066; 0/0/0/0 |

## Odtwarzalność liczby 615

Liczba `615` nie jest odtwarzalna z kotwicy wpisanej w macierz (`316bce9dd9`) do markera dyżuru. Kanoniczne warianty `git rev-list --count` dają odpowiednio `1216`, `1015` z `--no-merges` oraz `315` z `--first-parent`. Nie znalazłem flagi zastosowanej do tej kotwicy, która dawałaby `615`; bez zapisanej alternatywnej kotwicy albo komendy tej liczby nie można uznać za dowód.

## Ocena kubełków po dwóch nowych plikach dryfu

Kubełki A=7/B=0/C=9 nadal bronią się jako hipoteza wykonawcza przed R3. `src/components/standard/IdeaRightPanel.tsx` zwiększa brak pokrycia UI, lecz nie zmienia rodzaju brakującego dowodu żadnego modułu: nadal jest to brak kontraktu lub przelotu użytkownika. `server/src/routes/__tests__/day277-decyzje-zapis.pg.test.ts` należy do już wskazanego kandydata modułu `05_INITIATIVES`; dodaje kandydacki test, ale bez dzisiejszego przelotu i mutacji nie zmienia kubełka ani statusu.

## Stan wejściowy i rozejście tipa

- `MARKER OK`.
- `git rev-parse HEAD`: `29fcbd4de20ca26d2febc50d9455128cab47ffce`.
- `git status --short | head -3`: brak wyjścia.
- Tip `github-backup/grafika/m03-20260902` jest przed markerem o siedem commitów. Zgodnie z `DEC-2026-08-26-95` praca pozostaje na markerze; scalenie jest zadaniem nadzorcy.
