# Dyżur 335 — trzy mianowniki i kubełki G19

Pomiar wykonano na `HEAD=1c4b5a5635bafd38ef375227824ada9b62be186e`, nie przepisano liczb historycznych.

## Trzy zbiory zmian

| Grupa kotwic G18 | Moduły | Pliki do HEAD | SHA-256 posortowanej listy | Relacja |
| --- | --- | ---: | --- | --- |
| `316bce9dd9` | 01, 08 | 141 | `e1a3d8243dbedd61c7e4f69c8dbac7aecb361ed712be5b4bf8efa45d07be04e9` | zbiór największy |
| `08775ced65` | 02, 03, 04, 05, 07, 12, 13, 14, 15 | 125 | `f1f3c0d9bf1e86014c8072b2c9d5fca5ac68a4599c5cef5630427a85f1ad66a4` | zbiór pośredni |
| `85dfe6c3e2`, `4d402fcfc8`, `97c8293786`, `075735c395` | 06, 09, 10, 11, 16 | 123 | `3c73f9b730d4eb3b9113947e6b8e3597b9c0611f4fbb8e280d5dde19afffd89a` | cztery listy identyczne; podzbiór 141 |

`comm -23 set-<późna>.txt set-316bce9dd9.txt` zwróciło 0 dla każdej z czterech późnych kotwic. Cztery późne listy są bajtowo identyczne (`cmp` exit 0). Teza o trzech mianownikach i podzbiorowości potwierdzona, ale bieżące mianowniki wynoszą **141 / 125 / 123**, nie historyczne 49 / 30 / 28.

Surowe listy: `/private/tmp/cx-day335-g19-regresja-artefakty/set-<SHA>.txt`.

## Klasyfikacja 16 wierszy

Kubełek B ma liczność 0: przeszkoda „brak realnego łańcucha” nie jest tu autonomicznym blokerem, ponieważ instrukcja przydziela lokalny RealPG i wymaga realnego ApiGateway/JWT. Moduły A mają konkretną, maszynowo wykonywalną lukę; moduły C pozostają zależne od odbioru języka i renderowania przez właściciela na realnym rekordzie.

| Moduł | Kotwica G18 | Mianownik | Kubełek | Imienne uzasadnienie |
| --- | --- | ---: | --- | --- |
| 01_ORGANIZATION | `316bce9dd9` | 141 | A | zmienione middleware i trasy; istniejący test day307 może domknąć parę cross-org po podpięciu i mutacji |
| 02_INTERVIEW | `08775ced65` | 125 | C | otwarte PL/EN i renderowanie NModeLeftNav/form na realnym rekordzie rozmowy |
| 03_TOOLS | `08775ced65` | 125 | C | otwarte PL/EN oraz renderowanie współdzielonych formularzy i ErrorState na realnym narzędziu |
| 04_ASSESSMENT | `08775ced65` | 125 | A | kontrakty day274/day275 wymagają ponownego realnego przebiegu PG na HEAD |
| 05_INITIATIVES | `08775ced65` | 125 | A | trasy zapisu i day277 wymagają realnego PG oraz naprawy przestarzałego payloadu |
| 06_EXECUTION | `85dfe6c3e2` | 123 | A | initiativesExecutionRuntime ma maszynowy test dropdown i dowód mutacyjny do odtworzenia |
| 07_MY_WORK_AGENT | `08775ced65` | 125 | C | otwarte PL/EN i warunkowe renderowanie współdzielonej powłoki na realnym rekordzie |
| 08_MEETINGS | `316bce9dd9` | 141 | A | ten sam największy zbiór middleware/tras co 01; para izolacyjna i bloki są maszynowe |
| 09_RESULTS | `4d402fcfc8` | 123 | C | otwarte PL/EN, HelpButton/ErrorState i zachowanie na realnym raporcie |
| 10_FINANCE | `97c8293786` | 123 | C | odbiór treści i warunków na realnym rekordzie finansowym wymaga właściciela |
| 11_MATERIALS | `4d402fcfc8` | 123 | A | kontrakty zapisu day276 są wykonywalne maszynowo na RealPG |
| 12_AUDITS | `08775ced65` | 125 | C | otwarte PL/EN i renderowanie formularzy/stanów na realnym audycie |
| 13_CHAT | `08775ced65` | 125 | A | zmienione ai/chat/teresa oraz agent-hub wymagają maszynowego przebiegu tras na HEAD |
| 14_ADMIN | `08775ced65` | 125 | C | otwarte PL/EN, HelpButton/ErrorState i warunkowe dane administracyjne |
| 15_SETTINGS | `08775ced65` | 125 | C | otwarte PL/EN i formularze współdzielone na realnych ustawieniach |
| 16_PARTNER | `075735c395` | 123 | C | otwarte PL/EN i przelot realnego rekordu partnera; fikstura nie wystarcza |

Suma: **A=7, B=0, C=9**. Kubełek nie oznacza zmiany statusu G19; wszystkie wiersze pozostają `NOT_PROVEN / OWNER_RETEST_PENDING`.
