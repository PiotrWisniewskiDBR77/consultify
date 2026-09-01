---
doc_id: pomiar-2026-09-01-organizacja-spotkania-ustawienia
status: canonical
owner: piotr
truth_type: runtime
established: 2026-09-01
---

# POMIAR 2026-09-01 — Organizacja · Spotkania · Ustawienia

Ten dokument zbiera to, co **realnie zmierzono** dyżurami 236 (Organizacja),
237 (Spotkania) i 238 (Ustawienia) 2026-09-01, plus domknięcie testowe z tego
samego dnia. Cel: wyrównać dokumentację funkcjonalną tych trzech modułów do
pomiaru — nie odwrotnie. **AS-IS jest oddzielone od TO-BE.** Każde
twierdzenie o runtime ma `plik:linia` albo datę i sposób pomiaru.

Metodyka pomiaru (wszystkie trzy dyżury): dev-render harness montujący
**realne** komponenty produkcyjne (nie ręczne makiety) przez adapter
fixture'ów na granicy `Api`, zrzuty light/dark z bezpiecznikiem jasności
(`mean_luma`, różnica > 150 dla każdej pary), pomiar testów jednostkowych
przed/po pełnymi nazwami (denominator diff). Źródła: `CODEX_DAY236_ORGANIZACJA_REPORT.md`,
`CODEX_DAY237_SPOTKANIA_REPORT.md`, `CODEX_DAY238_USTAWIENIA_REPORT.md`
(katalog `docs/program/waves/WAVE_03_ACCEPTANCE/codex/`), marker `e014ba0d8b`.

---

## 0. Wspólne dla trzech modułów: trzy bramki dostępu, dziś niespójne, dziś już z testem

Trzy niezależne mechanizmy decydują "kto co widzi" w tych modułach, i **zachowują
się różnie** mimo że rozwiązują ten sam problem ("nie masz dostępu"):

| Bramka | Moduł | Co robi | Plik:linia |
| --- | --- | --- | --- |
| Filtr sekcji Ustawień | Ustawienia | **Usuwa** pozycję z listy nawigacji | `src/components/settings/SettingsSidebar.tsx:491-492` (`group.items.filter((item) => allowedSectionSet.has(item.id))`), sterowane `src/utils/pilotAccess.ts:15-19` (`PILOT_ALLOWED_SETTINGS_SECTIONS`) |
| Pozycja menu Spotkań | Spotkania | **Dekoruje kłódką** (`isLocked: true`), nie usuwa | `src/components/navigation/Sidebar/Sidebar.tsx:124-149` (`decoratePilotItem`), sterowane `src/utils/pilotAccess.ts:6-12` (`PILOT_VISIBLE_MENU_IDS` — brak `MODULE_MEETING`) |
| Przekierowanie z niedozwolonej trasy Ustawień | Ustawienia | Przenosi **po cichu**, zero komunikatu | `src/components/RouterSync.tsx:330-344` |

**Ważne rozróżnienie zapisane uczciwie:** blok `RouterSync.tsx:330-344` (przekierowanie
Ustawień) **nie zawiera żadnego wpisu do dziennika** — jest w nim wyłącznie
`navigate(...)`. Wpis do dziennika (`console.log`) i zdarzenie `access:blocked`
(`dispatchPilotAccessBlocked`) ma **sąsiedni, inny blok**: `RouterSync.tsx:316-327`.
**Praktyczny skutek:** gdyby użytkownik zgłosił „klikam w link do ustawień i nic
się nie dzieje (albo przenosi mnie gdzie indziej)", **nie znaleźlibyśmy tego
w dzienniku** — trzeba by odtwarzać z kodu, nie z logów.

### Stan testowy: BYŁO zero, JEST trzy — domknięte 1.09

W dniu pomiaru (236/237/238, 2026-09-01 rano) **żadna z trzech bramek nie miała
testu regresyjnego** — sprawdzono przeszukaniem katalogów testowych, zero trafień.
To odnotował `docs/program/funkcje/ZNALEZISKO_BRAMKI_BEZ_TESTU.md`. **Tego samego
dnia, później, testy powstały i zostały udowodnione mutacyjnie** (nie "test
istnieje" — test, który czerwienieje po usunięciu zabezpieczenia i zostaje
przywrócony):

| Bramka | Test | Commit | Dowód „obcy nie widzi" + „właściciel widzi" |
| --- | --- | --- | --- |
| Filtr Ustawień | `src/components/settings/__tests__/SettingsSidebar.pilotSectionFilter.test.tsx` | `93a6092cd6` | pilot: 4 z 37 pozycji; owner: wszystkie 37 |
| Menu Spotkań | `src/components/navigation/Sidebar/__tests__/Sidebar.pilotMeetingLock.test.tsx` | `e63468df76` | pilot: „Meeting" obecne + `aria-disabled="true"`; owner: obecne, bez atrybutu |
| Przekierowanie Ustawień | `src/components/__tests__/RouterSync.pilotSettingsSilentRedirect.test.tsx` | `4c59a77010` | pilot na `/settings/webhooks`: `navigate('/settings/profile')`; admin na tym samym adresie: brak `navigate` |

Dosłowny wynik czerwony po mutacji (z `ZNALEZISKO_BRAMKI_BEZ_TESTU.md`, sekcja
„DOMKNIĘTE 1.09"):

- Filtr Ustawień, usunięto filtrowanie: `expected [...] to have a length of 4 but got 37`.
- Menu Spotkań, dodano `MODULE_MEETING` do widocznych: `Expected the element to have attribute: aria-disabled="true" / Received: null`.
- Przekierowanie, usunięto warunek roli: `expected "vi.fn()" to not be called at all, but actually been called 1 times` — **ta mutacja wywróciła też drugi człon dowodu: administrator zaczął być przekierowywany razem z pilotem.** To dokładnie scenariusz, przed którym bramka ma chronić — funkcja przestaje działać *wszystkim*, i bez sprawdzenia obu ról wyglądałoby to na sukces.

**Zadania pozostałe (z `ZNALEZISKO_BRAMKI_BEZ_TESTU.md`):** ujednolicić zachowanie
przy braku dostępu (decyzja produktowa właściciela: kłódka czy zniknięcie,
zawsze komunikat zamiast ciszy) i zdecydować los trzeciej bramki Spotkań
(patrz §2 niżej).

### Furtka środowiskowa `VITE_DEMO_ACCEPTANCE` — sprawdzone, nie dotyczy tych trzech modułów

Osobne znalezisko 1.09 (`docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`)
opisuje zmienną `VITE_DEMO_ACCEPTANCE`, ustawioną na `demo.consultify.ai`
(`DEC-2026-08-28-216`), która działa jako wczesny `return true` omijający
logikę flag w **sześciu rodzinach**: Wyniki (KPI+ROI+OKR) oraz pięć rodzin
w obszarze pomysłów i studia artefaktów (`resultsVNextFeatureFlags.ts`,
`artifactStudioFlags.ts`, `ideaFinancialCaseFlag.ts`, `ideaDecisionLogFlag.ts`,
`ideaDetailsInPanelFlag.ts`, `ideaBusinessCaseSchemaFlag.ts`). **Żadna z tych
sześciu ścieżek nie obejmuje `orgRedesignFlag.ts`, pilot access (Spotkania)
ani ustawień** — sprawdzone bezpośrednio w kodzie tego pomiaru: żaden z tych
trzech modułów nie importuje `isDemoAcceptanceProfileEnabled`. **Właściciel
nie mógł zobaczyć ekranów Organizacji/Spotkań/Ustawień z pominięciem akceptu
przez tę furtkę** — to inny mechanizm niż ten opisany w tym pomiarze.

---

## 1. Organizacja — dokumentacja mówi „ZAMKNIĘTE OSTATECZNIE 25.08"

**Zapis obalony 1.09.** `docs/FUNCTIONAL_DOCUMENTATION.md:55` (poza zakresem
edycji tego pomiaru — scala nadzorca) mówi: *„Organization | zależna od
dostępu · **CLOSED_FINAL 2026-08-25**, tag `final-01-organization`"*.

**Na jakiej podstawie zamknięto i czego wtedy nie sprawdzono:** zamknięcie
25.08 opierało się na akcepcie **prototypu** HTML (`DEC-2026-08-26-78`,
`1dbaab2573`), nie na odbiorze **realnego builda**. `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md:126`
(`DEC-2026-08-25-74`) nazywa to wprost wzorcem *RUNTIME-IDENTITY-MISMATCH*:
„CLOSED_FINAL warunkowy" opisuje stan **za flagą OFF**, którego właściciel nie
oglądał. Komentarz w kodzie (patrz niżej) potwierdza: odbiór wizualny realnego
builda (`evidence/build-20260826`, 5 z 5 zrzutów) **nigdy nie wrócił do
rejestru jako akcept właściciela** — krok (d) reguły 7 z `CLAUDE.md` nie
został wykonany. **Pierwszy przegląd wizualny realnego ekranu w praktyce
jeszcze się nie odbył**, mimo zapisu „OSTATECZNIE".

### Co jest zmierzone dziś (dyżur 236, 2026-09-01)

- Flaga `orgRedesignV1Enabled()` (`src/utils/orgRedesignFlag.ts:86-93`) ma
  **realny default OFF**, mimo że nagłówek pliku w linii 19 mówi „Od tego
  odbioru flaga jest DEFAULT ON" (odnosząc się do `DEC-2026-08-26-78`,
  linia 35). **To nie jest kłamstwo dokumentu** — obok, w tej samej linii 19
  i w komentarzu przy `readEnvFlag()` (linie 54-58), stoi wyjaśnienie:
  *„DEC-2026-08-26-78 autoryzował flip ON na PROTOTYPIE, a nie na realnym
  ekranie (...) Do czasu jego wykonania domyślną wartością jest OFF
  (2026-08-29, nadzorca)."* Czyli: **świadome cofnięcie 29.08 do czasu
  odbioru wizualnego**, udokumentowane w samym pliku i potwierdzone w historii
  zmian (`src/utils/orgRedesignFlag.ts:19,54-59`).
- Skutek dla użytkownika: przy realnym (OFF) defaulcie Organizacja renderuje
  **21 pozycji nawigacji w 6 grupach** — stary układ sprzed redesignu. **11
  przeprojektowanych ekranów jest dziś nieosiągalnych** bez ręcznego
  przełączenia flagi (query param / localStorage). Zmierzone bezpośrednim
  porównaniem OFF vs ON w harnessu dyżuru 236 (raport, sekcja R1: „Porównanie
  OFF pokazało 21 ekranów nawigacji w 6 grupach; ON pokazało 11 ekranów w tych
  samych 6 grupach").
- Wszystkie 11 ekranów renderuje się bez błędu pod flagą ON (22 zrzuty
  light/dark, różnica jasności 211.8–228.4, powyżej progu 150). Trzy rodziny
  danych (Cele/Wyzwania/Ryzyka-Strategia) renderują się **uczciwie puste** —
  seeder demo nie ma tych danych (`server/scripts/seed-wave3-organization-owner-review.ts:341-385`
  nie zawiera `goals`/`challenges`/`synthesis`), to jest brak danych fixture,
  nie błąd odczytu.
- **Dwa zastałe testy nadal oczekują starej wartości (ON) i realnie się nie
  powodzą** wobec dzisiejszego realnego OFF: `src/utils/__tests__/orgRedesignFlag.test.ts:36`
  (`it('domyślnie ON (DEC-2026-08-26-78)', ...)` → `expect(isOrgRedesignV1Enabled()).toBe(true)`)
  i drugi test w tym samym pliku budowany na tym samym założeniu. Naprawa
  testów jest poza zakresem dyżuru 236 (brak licencji zapisu do testów) —
  **pozostaje otwartym zadaniem.**
- Stan pozostaje `OWNER_NOT_REVIEWED` — nowe 22 zrzuty z 236 nie mają jeszcze
  werdyktu właściciela.

### AS-IS vs TO-BE

- **AS-IS (runtime dziś):** 21 ekranów, stary shell, flaga OFF, `OWNER_NOT_REVIEWED`.
- **TO-BE (zaakceptowany kierunek, niezbudowany do odbioru):** 11 ekranów
  skonsolidowanych, jeden wspólny szkielet (`OrganizationScreenShell`), flaga
  domyślnie ON **po** odbiorze wizualnym realnego builda przez właściciela.

---

## 2. Spotkania — trzy bramki, otwarte dwie

Moduł jest oznaczony jako otwarty (`MODULE_MEETING: 'open'`,
`src/utils/betaMenuStatus.ts:57` i mirror `server/src/sharedRuntime/utils/betaMenuStatus.ts:58`),
trasa `/meetings` jest na liście dozwolonych tras pilota
(`src/utils/pilotAccess.ts:22-34`, wpis dodany naprawą `FIX-181` 2026-08-30) —
**ale pozycja menu nie jest na liście widocznych pozycji pilota**
(`PILOT_VISIBLE_MENU_IDS`, `src/utils/pilotAccess.ts:6-12`, brak
`MODULE_MEETING`).

**Skutek zmierzony bezpośrednio na realnym `Sidebar`+`RouterSync` (dyżur 237):
menu odmawia (kłódka), a wpisanie adresu wprost przechodzi.** Naprawa z 30.08
(`FIX-181`) otworzyła **dwie z trzech bramek** tej samej funkcji (moduł
`open` + trasa dozwolona), trzecią (widoczność w menu) pominęła.

- Menu: `Sidebar.tsx:124-149` (`decoratePilotItem`) nie usuwa pozycję —
  dekoruje ją `isLocked: true` + komunikat + link (`getPilotLockedAreaDetail`).
  Zmierzone zrzutem `member-sidebar-meeting-locked.png` (dyżur 237, SHA-256
  w raporcie dnia).
- Trasa: wejście bezpośrednie na `/meetings` renderuje realny `MeetingHub`
  (zrzut `member-direct-meetings-allowed.png`), bo `/meetings` jest w
  `PILOT_ALLOWED_ROUTE_PREFIXES`.

### ★ Ograniczenie dowodu zapisane uczciwie

Zrzut mający dowodzić, że zwykły użytkownik wchodzi na Spotkania, jest
**bitowo identyczny** ze zrzutem zwykłej listy — obie ścieżki (pilot i
niepilot) renderują ten sam ekran, bo **zaplecze harnessu jest podstawione i
nie rozróżnia roli na poziomie danych**. **To nie jest oszustwo** — dyżur 237
nazwał to wprost. Ale wniosek trzeba ograniczyć uczciwie: ten zrzut dowodzi
**wyłącznie**, że router front-endu nie blokuje wejścia. **O uprawnieniach po
stronie serwera (czy backend też separuje dane per rola na `/api/meeting/*`)
nie mówi nic** — to osobny, niezmierzony w tym dyżurze wymiar.

### Backendowy split G09 (notatki vs decyzje) — obalona teza „renderuje 0"

Wcześniejsza teza mówiła, że rozdzielenie `meeting_notes` (zatwierdzone
decyzje w notatkach) i `meeting_decisions` (osobna tabela) skutkuje pokazaniem
`0` decyzji użytkownikowi, gdy `decision-records` jest puste. **Zmierzone
żywym przebiegiem (realny `ApiGateway`, JWT, PostgreSQL po migracjach) i
obalone:** `GET /api/meeting/:id/decision-records` rzeczywiście zwraca `200
{"decisions":[]}` (SQL czyta wyłącznie `meeting_decisions`,
`server/src/services/meetingService.ts:640-650`), ale UI ma już lokalny
read-model, który dokłada zatwierdzone decyzje z notatek:
`src/components/Meeting/MeetingObjectPage.tsx:563-572` i `:829-846`
(`approvedNoteDecisions`). Kontrakt regresyjny Day105 „shows an approved note
decision... when decision-records is empty" jest dziś **PASS**. Ewentualna
naprawa backendowego SSOT (żeby `/decision-records` był jedynym źródłem)
nadal wymaga osobnej decyzji projekcji/lineage — nie jest zrobiona, ale
**obecny UI nie jest zepsuty w sposób, który wcześniej opisano.**

### Decyzja właściciela — wymagana

Wariant „dodać `MODULE_MEETING` do `PILOT_VISIBLE_MENU_IDS`": usuwa kłódkę,
ujednolica menu z już dozwoloną trasą; wymaga testu regresyjnego (**już
napisany i zielony dziś dla stanu „locked"** — trzeba go przepisać, jeśli
decyzja zmieni zachowanie).
Wariant „zostawić": Spotkania widoczne z kłódką, trasa działa wprost — jawnie
niespójny affordance (menu odmawia, URL wpuszcza), ale nie „ukryty".
**Rekomendacja audytora (dyżur 237): to decyzja produktowa właściciela, bez
cichej zmiany przy okazji innego dyżuru.**

---

## 3. Ustawienia — dokumentacja mówi „ZAMKNIĘTE OSTATECZNIE 25.08"

**Zapis obalony 1.09.** `docs/FUNCTIONAL_DOCUMENTATION.md:57` (poza zakresem
edycji tego pomiaru): *„Settings | aktywny · **CLOSED_FINAL 2026-08-25**, tag
`final-02-settings`"*.

**Na jakiej podstawie zamknięto i czego wtedy nie sprawdzono:** pierwszy
przegląd wizualny modułu **nigdy się nie zaczął** — karta modułu
(`docs/program/waves/WAVE_03_ACCEPTANCE/modules/15_SETTINGS/MODULE_ACCEPTANCE.md:35-36`)
ma bramki `G08`/`G09` w stanie `NOT_STARTED` w chwili pomiaru dyżuru 238,
mimo że spis funkcjonalny nosi `CLOSED_FINAL 2026-08-25`. Dwa dokumenty tego
samego produktu opisują sprzeczne warstwy tego samego stanu — **sprzeczność
odnotowana, nie rozstrzygana tu.**

### Co jest zmierzone dziś (dyżur 238, 2026-09-01)

- **37 sekcji (liści) w 10 grupach** — nie 47, jak podawał poprzedni pomiar
  (poprzednia liczba liczyła nagłówki grup razem z pozycjami). Zmierzone
  bezpośrednio: `grep -c "id: '" src/components/settings/SettingsSidebar.tsx`
  → 47 łącznie; `grep -n "^                id: '" ... | wc -l` → **37 liści**;
  `grep -n "^            id: '" ... | wc -l` → **10 grup**. Ponowione i
  potwierdzone w tym pomiarze bezpośrednio na `SettingsSidebar.tsx`.
- Dla zwykłego użytkownika (pilot) dozwolone są **4** sekcje: `profile`,
  `auth-access`, `language`, `theme` (`PILOT_ALLOWED_SETTINGS_SECTIONS`,
  `src/utils/pilotAccess.ts:15-19`). **33 z 37 (89%) jest niedostępnych.**
  Mechanizm **usuwa** te pozycje z listy nawigacji (nie dekoruje kłódką, jak
  Spotkania) — `SettingsSidebar.tsx:491-492`:
  `group.items.filter((item) => allowedSectionSet.has(item.id))`.
- **Przekierowanie z niedozwolonej trasy jest całkowicie ciche.**
  `RouterSync.tsx:330-344`: w tym bloku **nie ma nawet wpisu do dziennika** —
  wyłącznie `navigate(getPilotDefaultSettingsRoute(), { replace: true })`.
  Wpis do dziennika i zdarzenie `access:blocked` ma **sąsiedni, inny blok**
  (`RouterSync.tsx:316-327`, dla ogólnej ochrony tras spoza allowlisty).
  **Praktyczny skutek do zapisania: gdyby użytkownik zgłosił „klikam i nic
  się nie dzieje", nie znaleźlibyśmy tego w dzienniku** — trzeba by
  odtwarzać zachowanie z kodu.
- Realny montaż `RouterSync` w harnessie potwierdził działanie mechanizmu na
  żywo: MEMBER wpisujący `/settings/data-controls` trafia na
  `/settings/profile`; MEMBER na `/settings/language` (dozwolone) i OWNER na
  `/settings/data-controls` (bez ograniczeń) **nie zostali przekierowani** —
  zachowanie jest zgodne z regułą, nie zbyt agresywne ani zbyt luźne
  (dyżur 238, artefakty `day238-proof-*.png`).
- 20 zrzutów paneli (10 grup × 2 motywy) + 2 zrzuty sidebaru person + 3 zrzuty
  dowodowe R1a — wszystkie pary light/dark powyżej progu jasności (najmniejsza
  różnica: 210.1, grupa Billing).
- **Martwy kod znaleziony przy okazji:** `SidebarUsage.tsx` (`src/components/SidebarUsage.tsx:7-47`)
  nie ma produkcyjnego importera (pełny `rg` po `src/**/*.{ts,tsx}` bez
  testów potwierdza zero konsumentów); sam importuje realny
  `UsageMeters` z `src/components/billing/UsageMeters.tsx` (nie z
  nieistniejącej ścieżki `src/components/settings/UsageMeters.tsx`, jak
  podawała starsza instrukcja). Nie usunięto — poza zakresem dyżuru.

### AS-IS vs TO-BE

- **AS-IS (runtime dziś):** 37 sekcji / 10 grup w kodzie; zwykły użytkownik
  widzi 4; usuwanie (nie kłódka); przekierowanie ciche bez logu; `G08`/`G09`
  = `NOT_STARTED`.
- **TO-BE:** nierozstrzygnięte w tym pomiarze, czy `CLOSED_FINAL` miało
  oznaczać zamrożenie zakresu, odbiór 21 zrzutów, czy „guided replay” —
  dokumenty nadal opisują różne warstwy tego samego stanu (patrz
  „Sprzeczności nierozstrzygnięte” niżej).

---

## 4. Sprzeczności nierozstrzygnięte — wymagają pomiaru lub decyzji właściciela

1. **Ustawienia: co miało oznaczać `CLOSED_FINAL 2026-08-25`?** Karta modułu
   (`MODULE_ACCEPTANCE.md`) ma `G08`/`G09` `NOT_STARTED` w chwili pomiaru
   238, spis funkcjonalny ma `CLOSED_FINAL`. Nie rozstrzygnięto, który zapis
   miał pierwszeństwo ani co dokładnie zostało wtedy sprawdzone. *Sprzeczność,
   wymaga pomiaru/wyjaśnienia od autora zamknięcia.*
2. **Spotkania: los trzeciej bramki.** Czy dodać `MODULE_MEETING` do
   `PILOT_VISIBLE_MENU_IDS` (spójne z już otwartą trasą), czy świadomie
   zostawić kłódkę mimo przechodzącego URL. Decyzja produktowa właściciela,
   nierozstrzygnięta w tym pomiarze.
3. **Wspólne dla obu bramek Ustawień i bramki Spotkań: komunikat czy cisza
   przy odmowie dostępu.** Dziś trzy różne zachowania (usuwanie / kłódka /
   cichy redirect) rozwiązują ten sam problem. Ujednolicenie wymaga decyzji
   właściciela o języku i kanale komunikatu — nierozstrzygnięte.

---

## 5. Które wiersze `docs/FUNCTIONAL_DOCUMENTATION.md` wymagają poprawki

Ten plik jest poza zakresem edycji tego pomiaru (scala nadzorca). Do jego
wiadomości — poniższe wiersze twierdzą coś, co ten pomiar obalił lub
doprecyzował:

- **Linia 49** (`Meeting`, pozycja #12): opis „realny fundament + zaakceptowana
  wizja docelowa" nie wspomina o niespójności bramek dostępu (menu locked vs
  trasa dozwolona) ani o tym, że moduł jest dziś `open`, ale UI menu wygląda
  na zablokowany dla pilota. Wymaga dopisku odsyłającego do §2 tego pomiaru.
- **Linia 55** (`Organization`, pozycja #13): `CLOSED_FINAL 2026-08-25` —
  **wymaga poprawki lub przynajmniej adnotacji**: zamknięcie opierało się na
  prototypie, nie na odbiorze realnego builda; realny default flagi jest OFF,
  11 ekranów redesignu nieosiągalnych, `OWNER_NOT_REVIEWED` nadal aktualne.
  Patrz §1.
- **Linia 57** (`Settings`, pozycja #15): `CLOSED_FINAL 2026-08-25` —
  **wymaga poprawki lub przynajmniej adnotacji**: pierwszy przegląd wizualny
  nigdy się nie zaczął (`G08`/`G09` `NOT_STARTED`), 33/37 sekcji niedostępne
  dla zwykłego użytkownika, przekierowanie ciche bez logu. Patrz §3.

---

## Źródła tego pomiaru

- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY236_ORGANIZACJA_REPORT.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY237_SPOTKANIA_REPORT.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY238_USTAWIENIA_REPORT.md`
- `docs/program/funkcje/ZNALEZISKO_BRAMKI_BEZ_TESTU.md`
- `docs/program/funkcje/SPROSTOWANIE_WIDOCZNOSC_WYNIKOW.md`
- `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`
  (`DEC-2026-08-24-07`, `DEC-2026-08-24-10`, `DEC-2026-08-24-11`,
  `DEC-2026-08-25-74`, `DEC-2026-08-26-78`, `DEC-2026-08-28-216`,
  `DEC-2026-08-28-227`)
- Bezpośrednia weryfikacja własna (1.09, ta sesja): `src/utils/orgRedesignFlag.ts`,
  `src/utils/__tests__/orgRedesignFlag.test.ts`, `src/utils/pilotAccess.ts`,
  `src/components/navigation/Sidebar/Sidebar.tsx`, `src/components/RouterSync.tsx`,
  `src/components/settings/SettingsSidebar.tsx`, cztery nowe testy regresyjne
  bramek (commity `93a6092cd6`, `e63468df76`, `4c59a77010`), `docs/FUNCTIONAL_DOCUMENTATION.md`.
