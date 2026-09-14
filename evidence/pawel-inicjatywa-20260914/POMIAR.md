# P-P06 — „Manual initiative creation loses project selection and cannot create"

Zgłoszenie pilotażu Pawła Mroczkowskiego `3317aaf2-c20c-4025-97bb-ac01ebf8afe1`
(HIGH, 2026-09-14 04:18 UTC, staging 90833bc94a, UI EN, motyw ciemny).

## Środowisko pomiaru
- gałąź `integracja/kandydat-pawel-inicjatywa-20260914` z `origin/integracja/20260911` (HEAD 1a953d6410)
- kod trzech plików ścieżki tworzenia (`InitiativesHub.tsx`, `RequiredProjectPicker.tsx`,
  `initiativeWriteTruth.ts`) jest IDENTYCZNY z 90833bc94a (`git diff` pusty) — mierzone jest to,
  co widział Paweł
- baza lokalna (docker `pi-pg`, schemat stagingu 2026-09-13) + wiersze organizacji DBR77
  `a3e05d4a-…` skopiowane ze stagingu (SELECT-only): organizacja, użytkownicy, projekty,
  członkostwa, flagi v8, polityki `ie_governance_*` łącznie z bazową `organization_id='*'`
- serwer :4360, vite :5370, Playwright (Chromium), konto Pawła

## Wynik PRZED
`PRZED-10/-11`: tytuł + streszczenie, pole Projekt zostawione puste → „Create" →
okno zostaje otwarte, **zero żądań sieciowych**, toast:
`Canonical initiative creation requires projectId and initiativeOwnerId`.
To DOKŁADNIE komunikat ze zgłoszenia i zgadza się z `api_logs` stagingu: między 04:10 a 04:25 UTC
dla użytkownika Pawła NIE MA ani jednego POST-a inicjatywy (bramka jest po stronie przeglądarki,
w `src/services/initiativeWriteTruth.ts:148`).

## Wynik PO
`PO-10/-11`: to samo wejście → pole Projekt jest wypełnione domyślnym zakresem organizacji
(pierwszy projekt listy), „Create" tworzy inicjatywę w stanie Draft; rekord potwierdzony
odczytem z bazy (`ie_aggregate_state`, agregaty `source_proposal` + `initiative`).

## Czego NIE udało się odtworzyć
Samego „gubienia wyboru projektu". W pomiarze wartość selektora utrzymywała się po wpisaniu
streszczenia i po 30 s bezczynności (`AFTER_PROJECT` = `AFTER_SUMMARY` = `AFTER_30S_IDLE`
= `dbr77-project-main`). Skutek zgłoszenia (nie da się utworzyć) jest natomiast odtwarzalny
w 100 % i to on jest naprawiony: pusty wybór nie jest już ślepym zaułkiem.

## Dane vs kod
Kod. Bazowa polityka produktu (`ie_governance_policies`, `organization_id='*'`,
`consultify-standard` v1, ACTIVE) NA STAGINGU ISTNIEJE — to NIE jest powrót awarii z 09.09.
(Jej brak w pierwszym podejściu do seeda dawał lokalnie 500 `Product baseline is missing`;
po skopiowaniu wiersza `*` ścieżka przechodzi.)
