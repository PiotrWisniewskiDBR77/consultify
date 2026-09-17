# SUMY — MTG-1 etap 2: dowody UI i bramka (Wpis 41 + Wpis 54), gałąź `qoder/d-mtg1-20260917`

Harness: `dev-render` (`?screen=mtg1-etap2&lang=en&theme=light|dark&uwagi=0`), motyw przełączany
storem aplikacji (NIE `emulateMedia`), `uwagi=0` zdejmuje pływający panel harnessu
(`dev-render/main.tsx:3072`). Dane: pięć spotkań Northwind z `dev-render/screens/mtg1-etap2.tsx`
(fetch nadpisany w pamięci harnessu — `/agenda`, `/lifecycle` z mutacją i 409) — zero stagingu.
Zrzuty 1440×900 (deviceScaleFactor 2 → oryginały 2880×1800 w `/tmp/mtg1-2x/`, w repo kopia 1×).

## Zrzuty — co widać (zdanie na plik)

| plik | bajty | sha256 | co widać |
|---|---|---|---|
| `01-lista-light.png` | 134901 | `01cf4db8455caceedb7bbc9761be311ebc173ec4ef26decb85282b5820f377fd` | Lista Spotkań w powłoce Huba: Menu 3 z pięcioma stanami cyklu życia + All i licznikami (5/1/1/1/1/1), `StandardTable` z kolumną STATUS pokazującą zwarte pigułki (Closed, Needs actions, In progress, Minutes due, Scheduled) bez ucinania, CTA „New meeting”. |
| `02-lista-dark.png` | 139099 | `f57ba192f2c52771f641e8e548795819a4f6273df2ae7b53b00dd943198564be` | Ta sama lista w motywie ciemnym: te same liczniki i pigułki, ciemna powierzchnia tabeli i chipów. |
| `03-lista-podglad-light.png` | 218293 | `cc8d1de5389a45351e9fa6ffd27e3e76c0a4bf9e6662e30fb8b70a51fe7f1436` | Po kliknięciu wiersza otwarty `StandardPreview` dla „Weekly PMO Review”: pigułka „Minutes to approve”, blok DETAILS (Attendees/Follow-ups/Agenda/Decisions/Location), blok AI, RELATIONS. |
| `04-lista-podglad-dark.png` | 226663 | `fcc6d9e89cb2e1f06564467040ee603d82260b032e6ae15056917047000f0701` | Ten sam podgląd w motywie ciemnym z tymi samymi blokami i pigułką stanu. |
| `05-karta-light.png` | 322623 | `046fd4f6755186ea9d9c3e85fcf9044f9914936ad2da09fec11729598aa7746c` | Karta spotkania wg makiety: ATTENDEES z rolami i RSVP, PRE-READ, oś AGENDY 04:00/04:10/04:30/04:45 z czasami trwania, celami, właścicielami i linkami („4 items · 55 min”), PROPERTIES z Chair/Scribe, ACTIONS z CTA „Needs actions” + „Closed”. |
| `06-karta-dark.png` | 365258 | `b01beae48045fa626d6c6d80ebb83a25562db3270a03e33020de816c1799c558` | Ta sama karta w motywie ciemnym: oś agendy, role, Chair/Scribe i CTA czytelne na ciemnej powłoce. |
| `07-przejscie-przed-light.png` | 283640 | `23e3eac71fc9ed4e2cc2778a6f25e28d4baabb38cfd5460b2b37509a39036a62` | Karta „Steering Committee” PRZED przejściem: pigułka i PROPERTIES „Scheduled”, w ACTIONS jedno dozwolone CTA „In progress”. |
| `08-przejscie-przed-dark.png` | 325938 | `9a5707fc3a8f9bfab4732fb6c3c5c7cdadf3e0f1fc7379dd44fb50` | Ten sam stan „przed” w motywie ciemnym. |
| `09-przejscie-po-light.png` | 293358 | `2715ff4ca482473d2459edc656c3605cf356dc7dbaaae0813064b044db37e53a` | Ta sama karta PO przejściu: pigułka i PROPERTIES „In progress”, CTA zmieniło się na „Minutes to approve”, toast „Status updated” w rogu. |
| `10-przejscie-po-dark.png` | 333664 | `061a36fe44b3a84d7bf43d548c525b4d67c6527ab9adb5c58835f1ddfbc6f1b5` | Ten sam stan „po” w motywie ciemnym z tym samym CTA i toastem. |

Konsola/sieć: `shot.mjs` drukuje `KONSOLA-BLEDY`/`SIEC-4XX5XX`/`KLIK-BLAD` tylko gdy niepuste —
przy żadnym z 10 zrzutów nic nie wydrukował, czyli **bledyKonsoli=0**.

## CTA: wypełnienie i kontrast glifu (pikselowo, prostokąt przycisku)

| plik | CTA | wypełnienie (px modalnych) | glif | kontrast | crimson w CTA |
|---|---|---|---|---|---|
| 01/03 light | New meeting | `#0f172a` (12843) | `#ffffff` | 17.85:1 | 0 |
| 02/04 dark | New meeting | `#f4f7fb` (12843) | `#0a0f1e` | 17.77:1 | 0 |
| 05 light | Needs actions | `#0f172a` (15301) | `#ffffff` | 17.85:1 | 0 |
| 06 dark | Needs actions | `#f4f7fb` (15297) | `#090e1d` | 17.89:1 | 0 |
| 07 light | In progress | `#0f172a` (34470) | `#ffffff` | 17.85:1 | 0 |
| 08 dark | In progress | `#f4f7fb` (34467) | `#090e1d` | 17.89:1 | 0 |
| 09 light | Minutes to approve | `#151e32` (33655) | `#ffffff` | 16.62:1 | 0 |
| 10 dark | Minutes to approve | `#dde5ef` (33652) | `#090e1d` | 15.13:1 | 0 |

Zero pikseli crimsonu (`#85182F` ±20) w obrębie każdego CTA.

## Crimson poza CTA — inwentaryzacja (tylko 01–04, semantyka danger)

| plik | piksele | gdzie |
|---|---|---|
| 01 light | `#85182F±20`=93 | tekst pigułki „Needs actions” (`#741428`, `#791c30`, `#822a3d` @CSS ~1107–1152,296–299) + kropka Menu-3 `#e80538` @CSS(513,72) |
| 02 dark | 2 | antyaliasing tej samej kropki i pigułki |
| 03 light | 77 | jak 01, przesunięte przez otwarty podgląd (@CSS ~704–749,296–298) |
| 04 dark | 0 | — |
| 05–10 | 0 | — |

To zatwierdzona semantyka krytyczna (tone `danger` stanu `needs_actions` w
`MEETING_LIFECYCLE_CHIP_TONE`), nie dekoracja CTA — CTA pozostaje bez crimsonu.

## Kontrast tekstu pikselowo (rdzeń glifu vs tło modalne)

| plik | miejsce | tło | rdzeń glifu | kontrast |
|---|---|---|---|---|
| 05 light | nagłówek tabeli agendy „Property” | `#f8fafc` (9653 px) | `#64748b` | **4.55:1** |
| 03 light | etykieta bloku „Details” w podglądzie | `#fdfefe` (2569 px) | `#64748b` | 4.71:1 |
| 06 dark | nagłówek tabeli agendy „Property” | `#15213b` (9652 px) | `#8a99b0` | **5.53:1** |
| 04 dark | etykieta bloku „Property” w podglądzie | `#15213b` (10303 px) | `#8a99b0` | 5.53:1 |

Najsłabsze dwa miejsca: 4.55:1 i 4.71:1 (light) — oba ≥ 4.5:1 (WCAG AA dla tekstu).

## mean luma: light > dark (5 par)

| para | light | dark | delta |
|---|---|---|---|
| 01/02 | 249.57 | 20.87 | 228.70 |
| 03/04 | 247.42 | 25.82 | 221.60 |
| 05/06 | 247.11 | 27.46 | 219.65 |
| 07/08 | 246.76 | 26.08 | 220.68 |
| 09/10 | 246.58 | 26.09 | 220.48 |

## Testy (per plik, `--retry=0`)

Front (`src/components/Meeting/__tests__/`, 13 plików): **63 passed / 2 failed (65)**.
- `MeetingHub.statusColumn.test.tsx` 3/3 — NOWY plik (kolumna Status mówi stanem cyklu życia).
- `MeetingHub.lifecycleMenu3.test.tsx` 3/3; `MeetingHub.deriveMeetingLifecycle.test.ts` 5/5;
  `MeetingObjectPage.lifecycle.test.tsx` 4/4; `MeetingObjectPage.agendaAxis.test.tsx` zielony;
  pozostałe zielone.
- `MeetingHub.smoke.test.tsx` 2 RED („operator brief 500/404”) — **ZASTANE**: identyczna czerwień
  w bazowym worktree `mtg1-base-check` (detached `d6618995ae`).

Serwer:
- `meetingAgendaLifecycle.pg.test.ts` **9/9** na realnym PG (kontener `qoder-d-pg-1`, port 6630,
  `RUN_DB_TESTS=1`): migracja 20262301 backfill + idempotentność + CHECK, CRUD agendy, izolacja org,
  przejścia dozwolone/niedozwolone, renumeracja position.
- `meetingService.test.ts` + `meeting.routes.test.ts` 31 RED — **ZASTANE**: błąd kolekcji
  „Could not locate the bindings file … sqlite3” (brak binariów sqlite3 pod symlinkowanym
  `node_modules`); identycznie 31 RED w bazowym worktree. `meetingInvitationService` 2/2 i
  `meetingNoteTaskFunnelService.race23505` 1/1 zielone.

## Dowód mutacyjny (reguła: kolumna Status = słownik DEC-596)

M1: render kolumny cofnięty do legacy (`deriveMeetingLifecycle` → „Completed”/„Past — needs update”/
„Scheduled”) → `MeetingHub.statusColumn.test.tsx` **3 RED** → przywrócono (`resolveMeetingLifecycleState`
+ `MEETING_LIFECYCLE_CHIP_TONE` + `MEETING_LIFECYCLE_SHORT_LABEL_KEY`) → **3 GREEN**.

## Bramka

| pomiar | wynik | próg |
|---|---|---|
| `server && npx tsc --noEmit -p tsconfig.json` | 0 błędów | 0 |
| front `tsc --noEmit` (8 GB) | **169** | = baza 169, zero błędów w `Meeting` |
| `scripts/check-list-canon.sh` | 346 | ≤ 346 |
| `scripts/check-artefakt.sh` | 8 | ≤ 8 |
| `npm run check:jezyk:ci` | „OK (nic nie wzrosło)” | exit 0 |
| `npm run build` (8 GB) | RC=0 | 0 |

## Flagi (dług współdzielony, poza GO)

- Chip „Powiązany rekord” (PL) w bloku RELATIONS podglądu — literał PL w pliku współdzielonym
  `src/components/shared/PreviewPane/businessDisplayLabel.ts:87`; poza listą dozwolonych plików
  Wpisu 54, więc NIE dotknięty. Do decyzji CTO jako osobny wpis.
- Zrzuty 05–10 ważą 283–366 KB (konwencja „≤200 KB” z wcześniejszego zlecenia): na stanowisku D nie
  ma optymalizatora PNG (`pngquant`/`optipng`/`zopflipng` nieobecne), a Wpis 54 wymaga PNG 1440×900 —
  zostawiam bez stratnej konwersji i melduję wprost.
