# ODBIÓR — Dyżur 224 (Partner)

Audytor: sesja adwersaryjna, 2026-09-01. Worktree: `/private/tmp/cx-day224-partner`,
gałąź `codex/day224-partner-20260901`, HEAD `e73ce921f9` na markerze `0a35699021`
(podniesionym z `9fb7942a01`).

## Werdykt: **A-**

Praca jest wąska, uczciwa i zweryfikowana samodzielnie (nie z raportu wykonawcy — z
kodu, zrzutów, hashy i mutacji odtworzonej przeze mnie). Żadne z trzech twierdzeń nie
zostało nadmiarowo domknięte: (b) ma jawne, umotywowane `PARTIAL` na mobile zamiast
udawanego `FIXED`.

## Co zweryfikowałem sam (nie z raportu)

1. **Input state / dryf linii (★ z instrukcji nadzorcy).** Wykonawca sam odczytał
   `git log` po podniesieniu markera i zauważył, że tip gałęzi bazowej uciekł o commit
   instrukcyjny `a052ae1f7f` (ramka ostrzegawcza po scaleniu 218/219/226/231). Licencja
   pliku wskazywała `PartnerPortalView.tsx :1264`; realna linia to `:1267` — trzy linie
   dryfu, w granicach normalnego przesunięcia, wykonawca trafił we właściwe miejsce
   (branch `organizations`), nie w cudzy.
2. **(b) Kolumna Organizations — mutacja odtworzona przeze mnie.** Usunąłem
   `minTableWidth="auto"` z `src/views/partner/PartnerPortalView.tsx:1267` i uruchomiłem
   `PartnerPortalView.organizationsColumnWidth.day224.test.tsx` — **czerwony** (1 failed).
   Przywróciłem plik — **zielony** (1 passed), `git status` czysty. Zabezpieczenie jest
   realne, nie tautologia.
3. **Regresja na pozostałych ekranach — sprawdzone wprost.** `git diff --stat
   0a35699021..HEAD` pokazuje wyłącznie: `PartnerPortalView.tsx` (+1 prop),
   `PAKIET_WERDYKT_PARTNER.md`, `MODULE_ACCEPTANCE.md`, dwa nowe pliki testowe, raport.
   `FilterableTable.tsx` **nietknięty**. Policzyłem wszystkie 5 wywołań
   `<FilterableTable>` na Partnerze (`PartnerPortalView.tsx:1264`,
   `ClientAccessView.tsx:422`, `ReferralToolsSection.tsx:863`, `EarningsSection.tsx:846`
   + samo Organizations) — tylko Organizations dostało `minTableWidth`, pozostałe 4
   nadal dziedziczą `DEFAULT_MIN_TABLE_WIDTH=980` bez zmian (zgodnie z zakresem, nie
   regresja, po prostu nie objęte tym dyżurem). Istniejące użycia bezpiecznika w Ocenie
   (`WorkflowStagesTable.tsx:1082`, `TeamManagementPanel.tsx:1155`,
   `AssessmentReportDocument.tsx:434,546`) i Sprawach (`RezultatyView.tsx:1421/1465/1510`,
   `RealizacjaView.tsx:1427/1454/1493`, `PlanView.tsx:749`, `CasesListScreen.tsx:1050`) —
   **żaden z tych plików nie występuje w diffie**. Zero regresji.
4. **Artefakty PNG — realne, nie zmyślone.** `shasum -a 256` czterech plików w
   `/private/tmp/cx-day224-partner-artefakty/true-png/` zgadza się dokładnie z hashami w
   raporcie. Otworzyłem obrazy: `earnings-*-1280.png` pokazuje normalny widok €0,00 (nie
   bursztynowy baner) — potwierdza (b)-jako-`(b)` (baner z dnia 189 nieosiągalny tą
   ścieżką po naprawie 188); `organizations-light-1280.png` pokazuje wszystkie 6 kolumn
   łącznie ze Status; `organizations-light-mobile-375.png` **rzeczywiście** obcina Status
   — STOP mobilny jest prawdziwy, nie wymówka. Policzyłem niezależnie jasność
   dark/light: 29,95 vs 244,38 (formuła luma inna niż w raporcie — 41,7/225,9 — ale obie
   metody potwierdzają tę samą, ogromną, realną różnicę; pary nie są duplikatem pod
   dwiema nazwami).
5. **(c) Users: 0 — para dowodowa spełniona.** Żywe zapytanie SQL na organizacji
   `b1600000-…-000003` zwraca `COUNT=0` (przypadek „nie widzi"); nowy test PG
   (`server/src/services/__tests__/partnerReferralService.userCounts.day224.pg.test.ts`)
   wstawia realnego użytkownika przez `partner_attributions` i dostaje `users:1,
   userCount:1` bez ostrzeżenia w logu (przypadek „widzi"). To jest dokładnie para
   wymagana przez metodykę — nie tylko jedna strona.
6. **Ekonomia partnera nietknięta.** `git diff --stat` nie zawiera żadnego pliku z
   „econom"; `PARTNER_ECONOMICS_POLICY_CODE = 'PARTNER_ECONOMICS_POLICY_DISABLED'`
   (`server/src/services/partnerEconomicsPolicy.ts:47`) i komentarz o nieaplikowaniu
   `410` w `partner.routes.ts:73` obecne bez zmian.
7. **Cleanup.** `docker ps` po mojej stronie nie pokazuje żadnego `cx-day224-pg` — zgodne
   z deklaracją sprzątania w raporcie.

## Odpowiedź wprost: czy poprawka szerokości zepsuła ekrany, które już używały bezpiecznika?

**Nie.** Diff dotyka wyłącznie jednego propa w jednym pliku (`PartnerPortalView.tsx`,
gałąź `organizations`). Współdzielony komponent `FilterableTable.tsx` i wszystkie pliki
Oceny/Spraw używające `minTableWidth="auto"`/`"columns"` nie występują w diffie — zero
ryzyka regresji, bo nic tam nie zmieniono.

## FIX-y (do kolejnego dyżuru, nieblokujące tego odbioru)

1. **PRT-D112-003 mobile pozostaje `PARTIAL`** — `src/views/partner/PartnerPortalView.tsx:1267`.
   Sześć kolumn nie mieści się przy 375px nawet z `minTableWidth="auto"`. Potrzebny
   osobny kontrakt responsywny (ukrywanie/stackowanie/jawne przewijanie ze sticky
   Status), zgodnie z rekomendacją własną wykonawcy w `CODEX_DAY224_PARTNER_REPORT.md`
   §4. Nie blokuje odbioru desktopu.
2. Kosmetyka: metoda liczenia luminancji w raporcie różni się od standardowej
   (ITU-R BT.601 uśrednionej per-kanał) — warto ujednolicić formułę w przyszłych
   raportach, żeby liczby były porównywalne między dyżurami. Nie wpływa na wniosek.

## Twierdzenia niezweryfikowane (uczciwie przyznane przez wykonawcę, potwierdzam)

Pełny przejazd 25 powierzchni Partnera nie wykonany; ekonomia partnera pozostaje
świadomie OFF; PRT-D112-003 nie jest zamknięte na mobile; zastały 401 w pakiecie Day188
nierozstrzygnięty (poza licencją tego dyżuru).
