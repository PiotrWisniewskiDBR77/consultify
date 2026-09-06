# P10 — raport (DEC-411)

## Werdykt

**PARTIAL / NOT PROVEN — progi P10 nie są spełnione.** Stanowisko jako usługa działa (`GET http://127.0.0.1:4100/api/health` → 200, `database=connected`), ale większość hubów/szczegółów na kodzie bazowym `origin/staging` nie materializuje realnego rekordu. Nie uznaję spinnera, listy ani analizy źródła za dowód karty.

## Liczniki

- Inwentarz: 19 pozycji = 8 rejestr + 11 poza rejestrem.
- Karty z pełnym zrzutem otwartego realnego szczegółu: **1/19 (5,26%)** — notification.
- Karty z kontraktem sekcji: 8 (7 kontraktów `KanonicznaKarta` + lokalny kontrakt raportu oceny).
- Karty bez kontraktu sekcji: 11; każda ma propozycję, nie wdrożenie.
- Sekcje widoczne na udanym zrzucie notification bez wiersza tabeli: 0.
- Rozjazdy przed → po Fazie B: `angielski` 1→0; `etykieta inna` 1→0; `sekcja poza kontraktem` 33→33; `sekcja z kontraktu nieobecna` 1→1; `pusta na wyrost` 10→10; `kolejność inna` 0→0.
- Wnioski i inicjatywy: brak `K1_WNIOSKI_INICJATYWY_RAPORT.md` na bazowym refie; wykonano własny, niepełny pomiar i oznaczono brak dowodu runtime.

## MARTWE — brak potwierdzonego writera `server/src`

- tool: Cel, Proces, Rezultat, Przykład — treść statyczna frontendowa, brak serwerowego writera.
- task: RACI i eskalacja — brak jednoznacznego writera zadania w pomiarze.
- notification: Komentarze — komentarze jawnie pozostają atrapą bez tabeli/writera (`NotificationDetailView.tsx:3278-3298`).
- vault-document: Streszczenie — zastany placeholder bez odnalezionego writera.

## Faza B wykonana

- Typ otwartej karty powiadomienia: `Notification` → `Powiadomienie` przez istniejący klucz i18n.
- Etykieta sekcji: `Historia` → `Historia aktywności`; EN `Activity Log`.
- Nie usunięto sekcji spoza kontraktu i nie dodano brakujących sekcji; pytania są w `99_DECYZJE_WLASCICIELA.md`.

## Dowody i testy

- Stanowisko: health 200; własny Vite `VITE_DOTENV_DISABLED=1`, API target `127.0.0.1:4100`, port 4178.
- Notification przed/po: `evidence/p10-karty-n/notification/notification-open.png`, `evidence/p10-karty-n/notification/po/notification-open.png`.
- Oba dowody notification: 1440×1000, jasne, mean luma odpowiednio 247,49 i 247,40 (>150). Nie wszystkie sekcje prawego panelu są rozwinięte, więc komplet wizualny nadal nie spełnia bramki.
- Pozostałe katalogi pod `evidence/p10-karty-n/` zawierają zrzuty list/spinnerów; nie są zaliczone jako komplety kart.
- `registry.kompletnosc.test.ts`: 3/3 GREEN; mutacja usuwająca `action` z oczekiwanego rejestru: RED (`/private/tmp/p10/registry-mutation-red.json`).
- Testy MyWork: 22/22 GREEN, 0 failed, 0 skipped (`/private/tmp/p10/notification.json`).
- `esbuild MyWorkHub.tsx`: exit 0.
- `check-list-canon`, `check-artefakt`, `check-teresa-kontrakty`: exit 0.
- Pełny baseline Vitest uruchomiono przed pierwszą zmianą do `/private/tmp/p10/baza.json`; wynik końcowy należy odczytać po zakończeniu procesu — brak wyniku nie jest PASS.

## Commity

- `4a291201af` — inwentarz i test kompletności rejestru.
- `6a42c01427` — polska etykieta typu powiadomienia + dowód przed/po.
- `e812df7e82` — zgodna etykieta Historia aktywności PL/EN.

## Niezmierzone i dlaczego

- task, decision: realny rekord wybrano, lecz szczegół pozostał na „Ładowanie…”.
- interview: realna lista zwróciła 0 sesji.
- meeting: brak seeda spotkań na stanowisku.
- initiative, assessment-report, presentation, audit-criterion i część powtórnych wejść My Work: hub pozostał na ładowaniu.
- tool/tool-document: `/tools` otworzyło publiczny showcase, a nie listę rekordów zalogowanej aplikacji.
- action, objective, audit-report, insight, vault-document: brak osiągalnego realnego rekordu z listy.
- mean luma można uznać dla udanego szczegółu notification; bramka „wszystkie sekcje rozwinięte” nie jest spełniona także tam. Reszta wymaga powtórzenia po usunięciu blokad runtime/danych.

Każdy niespełniony próg ma odpowiadający mu wiersz w `99_DECYZJE_WLASCICIELA.md`; raport nie zaokrągla ani nie zamienia braku dowodu w zgodność.
