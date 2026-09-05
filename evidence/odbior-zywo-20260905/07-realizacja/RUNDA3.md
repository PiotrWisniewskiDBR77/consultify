# RUNDA 3 — 07-realizacja

| id | werdykt rano | werdykt teraz | jedno zdanie |
|---|---|---|---|
| execution-tab-work | ROZNI_SIE | ROZNI_SIE | NAPRAWIONE — najważniejsze: rejestr Pracy już NIE wisi na 'Wczytuję kanoniczny rejestr pracy. |
| execution-tab-resources | ROZNI_SIE | ROZNI_SIE | NAPRAWIONE — najważniejsze: zakładka Zasoby już NIE jest pustym białym obszarem; ta sama naprawa fanOut (executionCaseFanOut. |
| execution-tab-rollout | ROZNI_SIE | CZEKA_NA_SERWER | Kompozycja w większości zgodna z obrazem (nagłówek 'Śledzenie KPI' z ikoną, przycisk 'Dodaj KPI', tabela Nazwa/Obecna/Bazowa/Cel/Postęp/Trend, tabela zaczyna się bezpośrednio pod M… |
| execution-tab-summary | ROZNI_SIE | NOWY_WZORZEC | Stary 'Summary one-look' (chromeless, za flagą summaryOneLook) został zastąpiony realną zakładką Menu 2 'Kokpit' — deep-link /execution?tab=summary&ff_summaryOneLook=1 renderuje dz… |

## Runda 4

| id | werdykt runda 3 | werdykt runda 4 | jedno zdanie |
|---|---|---|---|
| execution-tab-rollout | CZEKA_NA_SERWER | DANE | Trasa /api/rollout/kpis/:id/history na gitSha 770f9e4991 zwraca 200 (naprawa serwerowa działa), ale zwraca puste history dla wszystkich 28 KPI organizacji — brak realnych pomiarów historycznych w bazie, nie brak kodu. |
| execution-tab-resources | ROZNI_SIE (zastrzeżenie wysokości panelu) | ZGODNY | Pomiar DOM na żywo potwierdza: panel podglądu (klasa h-full) sięga od 247px do 872px z 900px viewportu (97%), zaczynając się na wysokości tabeli — spełnia uwagę właściciela o wysokości od Menu 3 do dołu ekranu. |

## Runda 5

| id | werdykt runda 3 | werdykt runda 5 | jedno zdanie |
|---|---|---|---|
| execution-tab-work | ROZNI_SIE | **ZGODNY** | Oba defekty naprawione: WLASCICIEL/OSOBA DECYZYJNA pokazuje realne imie i nazwisko, a baner degradacji przeniesiono nad Menu 3 (nie miedzy Menu 3 a tabela). |
