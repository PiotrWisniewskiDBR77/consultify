# CODEX DAY 237 — SPOTKANIA

Data: 2026-09-01  
Marker: `e014ba0d8b`  
Gałąź: `codex/day237-spotkania-20260901`  
Zakres: pomiar, realny dev-render harness, zrzuty, diagnoza G09; bez naprawy bramek i backendu.

## Wynik

R1, R2, R3, R4 i R5 wykonane. Harness montuje realne `MeetingHub`, `MeetingObjectPage` i `Sidebar`; dane są fixture'em na granicy realnego `Api`, a nie ręcznymi propsami komponentów (`dev-render/screens/day237-spotkania.tsx:10-17`, `:91-124`, `:132-164`).

Najważniejsza korekta: instrukcja trafnie wskazuje brak `MODULE_MEETING` w `PILOT_VISIBLE_MENU_IDS`, ale błędnie przewiduje skutek „pozycja nieobecna”. Realny Sidebar mapuje każdą niedozwoloną pozycję na `isLocked: true`, dlatego MEMBER widzi „Spotkania” z kłódką (`src/components/navigation/Sidebar/Sidebar.tsx:124-150`). Bezpośrednie wejście MEMBER na `/meetings` renderuje realny `MeetingHub`, zgodnie z allowlistą trasy (`src/utils/pilotAccess.ts:22-40`).

Backendowy split G09 potwierdzono żywym przebiegiem: realny `ApiGateway`, prawdziwy `verifyToken`, podpisany JWT, lokalny PostgreSQL po pełnych migracjach. `GET /api/meeting/day237-g09-approved-meeting/notes` zwrócił `200` z zatwierdzoną decyzją, a `GET .../decision-records` zwrócił `200 {"decisions":[]}`; SQL readback: `meeting_notes.status=approved`, `decisions_json=[{"decision":"Uruchomic pilota"}]`, liczba `meeting_decisions=0`. Jednocześnie teza o renderowaniu `0` jest nieaktualna: bieżący `MeetingObjectPage` dodaje `approvedNoteDecisions` do sekcji nawet przy pustym decision-records (`src/components/Meeting/MeetingObjectPage.tsx:563-572`, `:829-846`), a czerwony kontrakt Day105 jest dziś PASS. Log: `/private/tmp/cx-day237-spotkania-artefakty/g09-http-proof.log`, SHA-256 `82b07e63141dbdf63fcd009d6537de7a1fc0451339cc63e2cabb8f085f22cea2`.

## Wejście i marker — wyjścia dosłowne

```text
26bf13a839 236/237/238: marker podniesiony do wlasnego commitu
e014ba0d8b instrukcje 236 Organizacja / 237 Spotkania / 238 Ustawienia
319eb8b48d SPROSTOWANIE nadzorcy: moje zdanie o niewidocznosci OKR/ROI na demo bylo falszywe — VITE_DEMO_ACCEPTANCE omija flagi w SZESCIU rodzinach; flaga OFF w kodzie != wylaczone na demo
820cf9e023 Merge remote-tracking branch 'github-backup/codex/day234-wyniki-20260901' into HEAD
3c743fdc5c style: prettier na nowym bloku ENABLE_PPTX_CANONICAL_GEOMETRY (dyzur 227 zameldowal '0 errors', odbior zmierzyl 2 — usterka formatowania, zero zmiany logiki)
bd1b3ed862 Merge remote-tracking branch 'github-backup/codex/day227-gamma-geometria-20260901' into HEAD
dbb4f54bbb GAMMA: punkt wejscia — marzenie, trzy filary slowami wlasciciela, stan kazdego, twardy sufit biblioteki, LISTA CZEGO NADAL NIE WIEM, trzy drogi i rekomendacja
b94515af72 ksztalt 19: para zrzutow przechodzi bezpiecznik jasnosci tym latwiej, im wiekszy defekt — dwa rozne stany zamiast dwoch motywow
8d13ed9719 Merge remote-tracking branch 'github-backup/codex/day233-finanse-20260901' into HEAD
f5c0c7ebfd Merge remote-tracking branch 'github-backup/codex/day235-materialy-20260901' into HEAD
abfd802902 208: marker podniesiony do e99e81301a, zasoby przeniesione na wolne porty (6187, 5162-5163) — dyzur nigdy nie zostal wykonany
c28889b936 docs(day234): record Results measurements and evidence
b775104e32 docs(day235): report materials evidence duty
de542c4d65 feat(day233): add finance owner-review evidence
11fd0c23f9 docs(day235): correct excele default comments
ea1f453e86 docs(day235): correct materials generator measurements
67fab88756 feat(day235): add materials evidence screens
0b56823c99 feat(day234): add Results evidence switchboards
e99e81301a instrukcje 233 Finanse / 234 Wyniki / 235 Materialy (fala Z2: moduly nigdy nieogladane przez wlasciciela)
cb8150381a odbior FIX-230 i FIX-232: obie oceny podniesione; dowody mutacyjne w obie strony; para dowodowa przy weryfikacji cytowan
795fed6625 merge: FIX-230 (detektor przepelnienia) + FIX-232 (wyscig, weryfikacja cytowan, uczciwosc makiety)
bc07db19c7 Merge remote-tracking branch 'github-backup/codex/day230-gamma-przepelnienie-20260901' into HEAD
288ef86137 fix(day232): evidence screen names what the product actually does (FIX-232 A3)
af24425ad7 fix(day230): show detector confidence + stop preflighting PDF exports (FIX-230 F7+F8)
689881be65 227/229: marker podniesiony do 142686b772 przed wydaniem
MARKER OK
```

```text
e014ba0d8b541a1e9079f595d489dcc0814eaaca
```

`git status --short | head -3` na wejściu nie wypisał żadnego wiersza. Tip bazowej gałęzi uciekł o commit `26bf13a839`; diff względem markera zawiera wyłącznie sześć plików instrukcji dyżurów 236–238. Zgodnie z DEC-2026-08-26-95 nie wykonano rebase.

## Sześć tez wejściowych

| Teza | Wynik |
| --- | --- |
| T1 | Potwierdzona: `MODULE_MEETING: 'open'` w `src/utils/betaMenuStatus.ts:57` i mirrorze `server/src/sharedRuntime/utils/betaMenuStatus.ts:58`. |
| T2 | Potwierdzona: `/meetings` w `PILOT_ALLOWED_ROUTE_PREFIXES`, `src/utils/pilotAccess.ts:22-40`. |
| T3 | Częściowo obalona: ID nie ma w zbiorze (`src/utils/pilotAccess.ts:6-13`), ale pozycja nie znika; staje się locked (`Sidebar.tsx:124-150`). |
| T4 | Potwierdzona i doprecyzowana: konsument jest w `Sidebar.tsx:132`, lecz gałąź negatywna dekoruje `isLocked: true` w `:139-146`. |
| T5 | Częściowo potwierdzona: API/SQL split jest żywy, lecz bieżący konsument nie renderuje `0`, bo składa `approvedNoteDecisions` (`MeetingObjectPage.tsx:563-572`, `:829-846`). |
| T6 | Potwierdzona na wejściu: 10 GiB wolne; po utworzeniu worktree 5,9 GiB, nadal powyżej progu 5 GiB. |

## R1 — zrzuty i jasność

| Widok | Light | Dark | Różnica |
| --- | ---: | ---: | ---: |
| Lista | 247,1 | 20,4 | 226,7 |
| Obiekt pending | 246,7 | 26,2 | 220,5 |
| Obiekt rejected | 246,7 | 26,2 | 220,5 |
| Obiekt approved + receipt 1 | 246,3 | 27,3 | 219,0 |

Każda różnica przekracza wymagane 150. Dziesięć plików leży poza repo w `/private/tmp/cx-day237-spotkania-artefakty`:

- `meeting-list-{light,dark}.png`
- `meeting-object-pending-{light,dark}.png`
- `meeting-object-rejected-{light,dark}.png`
- `meeting-object-approved-{light,dark}.png`
- `member-sidebar-meeting-locked.png`
- `member-direct-meetings-allowed.png`

SHA-256 kolejno: `d2ca26aac4c727e95c41e138dfd1b33d177958c2f057fec70275a311c5fdbb0f`, `d4f0b37b61222d2b6a77d658b6c6c557de8588a43d0095ac283d3df99a05c245`, `ae1a8df36945e16be6f6209e8bd8e9bd40099f2794c8d2d2d68866ea870da694`, `edf1bc326e01328935a6f479ef4b4b91126e0022ca72d1e65f996cf53e166baa`, `86acfe742952f715cfa98c1b52c21db3c9dfabc12e18fa223bd8fad195375326`, `435f91475742f6a5e4648a53cb61137a48b298726b625266d7e1feed1e4cc54f`, `c976330c6409a6a13e76bee6c4a9926b21971aada2b27dddb69dfb97f439faa8`, `f7809bf0d82b92c4b7f1b86822fb5ca99dce6422ccfaf0bfe59cf40d9e8ed28c`, `d547bd1fbe9ca9ea9921be67f03c00ccc5c8faff6898fc87b025fc0054435e46`, `d2ca26aac4c727e95c41e138dfd1b33d177958c2f057fec70275a311c5fdbb0f`.

## R2 — diagnoza G09 bez naprawy

`GET /:id/notes` woła `listMeetingNotesForMeeting` (`server/src/routes/meeting.routes.ts:1039-1055`), którego SQL zaczyna od `meeting_notes` (`server/src/services/meetingBoundary/meetingBoundaryService.ts:321-345`). `GET /:id/decision-records` woła `listMeetingDecisionRecords` (`server/src/routes/meeting.routes.ts:656-668`), a ten czyta wyłącznie `meeting_decisions` (`server/src/services/meetingService.ts:640-650`). UI ma już lokalny read-model łączący zatwierdzone notes (`MeetingObjectPage.tsx:563-572`, `:829-846`), więc nie ma podstaw do twierdzenia, że wyświetla 0. Ewentualna naprawa backendowego SSOT nadal wymaga decyzji: projekcja z idempotencją i lineage albo jawne scalenie źródeł w API. Ryzyko dotyczy duplikacji, kolejności, cofnięcia/supersede oraz zgodności receipts; nie zmieniono backendu.

## R3

Do `modules/08_MEETINGS/MODULE_ACCEPTANCE.md` dopisano wyłącznie nową sekcję dnia 237. Nie zmieniono istniejących tabel ani werdyktów.

## R4 — decyzja właściciela

Wariant „dodać”: `MODULE_MEETING` w `PILOT_VISIBLE_MENU_IDS` usunie dekorację locked i ujednolici menu z już dozwoloną trasą; potrzebny test regresyjny realnego Sidebar dla roli MEMBER.

Wariant „zostawić”: Spotkania pozostają widoczne z kłódką, a bezpośrednia trasa działa. To nie jest „ukryte”, lecz jawnie niespójny affordance: menu odmawia, URL wpuszcza. Rekomendacja: decyzja produktowa właściciela, bez cichej zmiany w tym dyżurze.

## Bezpieczeństwo poczty

`env` zwrócił `BRAK ZMIENNYCH POCZTY`; zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło 0 wierszy; `Gateway.ts` nie zawiera startu drenaży. Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Mianownik testów

Pakiet literalnie wskazany w instrukcji (`RUN_DB_TESTS=0 MOCK_DB=true ... --retry=0 --reporter=json`) przed zmianami dał: 465 suit, 1382 testy; 871 PASS, 277 FAIL, 234 pominięte. Nie ogłaszam go zielonym; szeroki glob `server/src/routes/__tests__` obejmuje zastany dług poza dyżurem. Pełne nazwy są w `/private/tmp/cx-day237-spotkania-artefakty/przed-nazwy.txt`.

Pakiet „po” objął te same 465 suit i te same 1382 pełne nazwy: 872 PASS, 276 FAIL, 234 pominięte. `diff przed-nazwy.txt po-nazwy.txt` ma 0 linii: nic nie dodano i nic nie zniknęło. Jedna zastana suita M17 zmieniła status FAIL→PASS między przebiegami bez zmiany nazwy ani pliku w tym dyżurze; nie przypisuję tego wynikowi Spotkań. Skupiony pakiet Spotkań/RouterSync: 12 suit, 34 testy, 33 PASS i 1 zastany FAIL (`MeetingObjectPage ... shows meeting decisions and follow-ups`); kontrakt Day105 „shows an approved note decision ... when decision-records is empty” jest PASS.

## Korekty wobec instrukcji

1. `§1.2`: „pozycja Meeting nieobecna w menu” koliduje z realnym `Sidebar.tsx:139-146`, który ustawia `isLocked: true` zamiast filtrować element. Zrobiono zrzut prawdziwego Sidebara i zapisano wynik „widoczna z kłódką”.
2. `R1a`: oczekiwane „pozycja nieobecna” zastąpiono bezpieczniejszym, zmierzonym stanem „pozycja obecna i locked”; nie zmieniono bramki.
3. T5/G09: API split i pusty `/decision-records` są żywe, lecz `MeetingObjectPage.tsx:563-572` oraz `:829-846` konsumują zatwierdzone decyzje z notes, więc „renderuje 0” zostało obalone; kontrakt Day105 jest PASS.
4. `R5` odsyła do nieistniejącego `§R.2`; instrukcja nie zawiera sekcji o tym numerze. Zachowano wszystkie jawnie wymagane sekcje i dodano obowiązkowe „TWIERDZENIA NIEZWERYFIKOWANE”.
5. Prettier początkowo przepisał 88 linii `dev-render/main.tsx`; zgodnie z `§0.2d` pkt 16 cofnięto reformat przez kopię scratch i ponownie nałożono minimalne 6 linii.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie udowodniono, że owner-fixture `W3-MEETINGS-OWNER-v1` z wcześniejszych dyżurów ma identyczne teksty jak nowy fixture ekranowy; harness zachowuje wymagany kształt stanów i receiptów, ale nie adoptuje cudzej retained-DB.
- Nie wykonano mutacji RED→GREEN, ponieważ dyżur nie naprawia mechanizmu i nie wpisuje `FIXED`/`VERIFIED`.

## Pliki i commity

Dotknięte pliki: `dev-render/screens/day237-spotkania.tsx`, `dev-render/main.tsx`, `docs/program/waves/WAVE_03_ACCEPTANCE/modules/08_MEETINGS/MODULE_ACCEPTANCE.md`, `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY237_SPOTKANIA_REPORT.md`.

Pierwszy commit harnessu `e3f2f5c29c` został wypchnięty natychmiast na `github-backup` zgodnie z Z34a.
