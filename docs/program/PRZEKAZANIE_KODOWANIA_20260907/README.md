# PRZEKAZANIE KODOWANIA — 07.09.2026

Zmiana agenta kodującego. Ten katalog zawiera **całą pracę w toku** dwóch robotników, przerwaną błędem sieci,
oraz kontekst potrzebny do jej dokończenia. Nadzór (Fable) zostaje bez zmian.

## 1. DLACZEGO TO POWSTAŁO
Właściciel produktu **wycofał odbiór dwóch modułów** (DEC-453):
> „Niestety, ani jedno, ani drugie nie działa. Także cofamy. Inicjatywy i execution, funkcje związane z zarządzaniem nimi nie działają."
> „Nie są podpięte w ogóle funkcjonalności do zarządzania inicjatywami – zarówno na etapie ich zatwierdzania i zarządzania, jak i później, w fazie wykonawstwa."

## 2. PRZYCZYNA — ZMIERZONA, NIE ZAŁOŻONA
**Dwie osobne dziury, obie realne:**

**(A) Zapisy zastane są wycofane, a front nadal ich używa.**
`server/src/middleware/executionSpineLegacyReadOnly.middleware.ts:52-56` (decyzja 26A) zwraca **HTTP 409**
(`Legacy execution writes are retired. Use the canonical Runtime-v1 execution API.`) dla wszystkich zapisów pod:
- `/:id/(start-execution|block|unblock|move)`
- `/:id/(milestones|resources|staffing-plans|budget-items|raid|gate-roles)`
- `/:id/(lifecycle-transition-proposals|lifecycle-transition-executions|lifecycle-gate-decisions)`
- `/:id/(apply-template|apply-blueprint)`

Front woła te trasy w **19 miejscach** (`TasksMilestonesSection`, `RaidSection`, `InitiativeDocumentView`,
`InitiativeGatesWorkflowTable`, `ResourcesSection`). **Część z `.catch(() => {})` — awaria połykana w ciszy:**
użytkownik klika „dodaj ryzyko", nic się nie dzieje, zero komunikatu.

**(B) Łańcuch zmiany statusu nie ma powierzchni w interfejsie.**
Pomiar: w całym `src/` **zero wywołań zmiany statusu inicjatywy** (jedyne trafienie: `ClosureSection.tsx:379`
= wniosek o zamknięcie). Zero przycisków „Zatwierdź / Odrzuć / Prześlij do zatwierdzenia". Z pięciu akcji
w `public/locales/pl/translation.json` istniała **tylko** „Rozpocznij realizację".
Silnik po stronie serwera ISTNIEJE (`server/src/services/initiative/initiativeTransitionService.ts`, role,
bramki, wymagane powody) — brakowało wyłącznie tego, co go uruchamia. To kształt „biblioteka bez wywołania".

## 3. SPECYFIKACJA — TABLICA ZAAKCEPTOWANA PRZEZ WŁAŚCICIELA (DEC-424)
Pełne źródło: `docs/program/PROGRAM_NAPRAWCZY_20260905/1_11_STATUSY_INICJATYW_POMIAR.md` §4.

| Status | przejście | kto zmienia | gdzie widać | co blokuje |
|---|---|---|---|---|
| Propozycja | → Szkic | Konsultant (autor) | Skrzynka kandydatów | tytuł + uzasadnienie |
| | → Odrzucona | Kierownik projektu | Skrzynka | wymagany powód |
| Szkic | → Do zatwierdzenia | Konsultant (autor) | Inicjatywy | komplet karty (opis, właściciel, zakres) |
| Do zatwierdzenia | → Zatwierdzona | Sponsor / Komitet | Inicjatywy | aktualna decyzja GO |
| | → Szkic (zwrot) | Sponsor / Komitet | Inicjatywy | wymagany powód |
| | → Odrzucona | Sponsor / Komitet | Inicjatywy | wymagany powód |
| Zatwierdzona | → W realizacji | PMO | Realizacja | przyjęty handoff + termin startu |
| | → Odrzucona | PMO / Komitet | Inicjatywy | wymagany powód |
| W realizacji | → Zamknięta | Właściciel inicjatywy / PMO | Realizacja | 0 otwartych zadań, 0 blokujących decyzji |
| | → wstrzymana (FLAGA, nie status) | PMO / Komitet | Realizacja | wymagany powód |
| Zamknięta | terminalny | — | Wyniki | — |
| Odrzucona | terminalny | — | Inicjatywy (filtr) | — |

## 4. CO JUŻ ZROBIONO — DO ODTWORZENIA Z ŁATEK

### Front A: zapisy (gałąź `mvp/zapisy-inicjatyw`, katalog `zapisy-inicjatyw/`)
**Pięć commitów, gotowe do `git am`:**
1. kanoniczny zapis edycji RAID + adopcja pozycji sprzed 26A
2. RAID przepięty na kanoniczny writer + koniec cichych awarii
3. **zdjęcie bramki 26A ze ścieżek bez kanonicznego następcy** ← DECYZJA ARCHITEKTONICZNA, WYMAGA WERYFIKACJI
4. koniec cichych awarii w zasobach i budżecie
5. (wip) kanban Realizacji — zła metoda HTTP, przerwane w połowie

### Front B: łańcuch statusów (`lancuch-zarzadzania-praca-w-toku.patch`, 1740 linii)
**Niezacommitowane, bo hook gęstości zablokował commit** — patrz §5. Zawiera **1486 nowych linii w 16 plikach**:
- `server/src/services/initiative/initiativeTransitionConditions.ts` (198) — warunki blokujące
- `server/src/services/initiative/initiativeTransitionPreflightService.ts` (186) — sprawdzenie przed zmianą
- `src/components/Initiatives/lifecycle/InitiativeLifecycleActions.tsx` (212) — powierzchnia akcji
- `src/components/Initiatives/lifecycle/InitiativeReasonDialog.tsx` (134) — okno wymaganego powodu
- `src/components/Initiatives/lifecycle/useInitiativeLifecycle.ts` (178)
- `src/components/Initiatives/lifecycle/initiativeLifecycleMessages.ts` (92)
- `src/services/initiatives/lifecycleApi.ts` (105)
- klucze i18n pl/en: `SUBMIT_FOR_REVIEW` „Prześlij do zatwierdzenia", `COMPLETE` „Zamknij inicjatywę", `BLOCK` „Wstrzymaj realizację"
- zmiany w `InitiativeController.ts`, `routes/pmo/initiatives.routes.ts`, `initiativeTransitionService.ts`, `PreviewActionBar.tsx`

Odtworzenie: `git apply docs/program/PRZEKAZANIE_KODOWANIA_20260907/lancuch-zarzadzania-praca-w-toku.patch`

## 5. DWIE RZECZY DO ROZSTRZYGNIĘCIA PRZED DOKOŃCZENIEM
1. **Hook gęstości zablokował commit frontu B**: „regresja mechaniczna doktryny gęstości (plik-duplikat /
   komponent bez callera / zdublowana akcja pasek+kebab)". SSOT: `docs/ui-standards/DOKTRYNA_GESTOSCI.md`.
   Prawdopodobnie akcja statusu została dodana **jednocześnie do paska i do kebaba**. Wybrać jedno miejsce.
   **Nie obchodzić hooka przez `--no-verify`** — to zakazane.
2. **Commit 3 frontu A zdjął bramkę 26A** z części ścieżek. Dla KAŻDEJ takiej ścieżki trzeba potwierdzić,
   że naprawdę nie ma kanonicznego następcy w runtime-v1 (pokazać trasę, nie deklarację). Jeśli następca
   istnieje — cofnąć zdjęcie bramki i przepiąć front na trasę kanoniczną; decyzja 26A obowiązuje.

## 6. STANDARD DOWODU (obowiązkowy — właściciel wycofał odbiór, więc dowodem jest ekran)
- **Przejście całego łańcucha na żywo, zrzut na każdym etapie**: szkic → do zatwierdzenia → zatwierdzona →
  w realizacji → zamknięta. Szerokość 1440, motyw jasny. Po każdym kroku **odświeżyć stronę** i pokazać, że
  status się utrzymał — nie stan lokalny komponentu.
- **Para negatywna**: bez uprawnień przycisk niewidoczny; z niespełnionym warunkiem przycisk nieaktywny z powodem.
- Zrzuty do `evidence/<zadanie>/` z plikiem `.png.json` (`url` ≠ `/login`, `bledyKonsoli`).
- Test na każdą podpiętą ścieżkę + **mutacja**: usuń sprawdzenie roli/warunku → test RED.
- Pełny `tsc` serwera = 0. `tsc` frontu: **zmierzyć bazę samemu** z `NODE_OPTIONS=--max-old-space-size=12288`
  (domyślny limit wywala się OOM-em i wypluwa linie awarii wyglądające jak błędy) i podać `X linii / Y error TS`.
- Baza odniesienia na 07.09: **877 linii = 200 `error TS`**. To ta sama prawda w dwóch jednostkach.

## 7. WYMAGANIA JAKOŚCIOWE
- **Rola decyduje o widoczności akcji** — użytkownik bez uprawnień nie widzi przycisku, a nie dostaje 403 po kliknięciu.
- **Warunek blokujący widoczny ZANIM użytkownik kliknie** — przycisk nieaktywny z czytelnym powodem po polsku.
- **Wymagany powód** = okno z polem tekstowym, bez możliwości pominięcia.
- **Zero cichych awarii** — żadnych `.catch(() => {})` na ścieżkach zapisu.
- Ekrany budować komponentami z `src/components/standard/`. `primary-*` w tailwind = crimson, **wyłącznie**
  dla semantyki krytycznej (odrzucenie tak, zatwierdzenie nie). Fokus = token `c-focus`.
- Teksty dodawać do `pl` **i** `en`.

## 8. ŚRODOWISKO
- Katalog pracy nadzorcy: `/private/tmp/m03`, gałąź `codex/m03-admin-20260824`.
- Stanowisko: API **4100**, frontend **3090** — żyją, NIE restartować, NIE `pkill`.
- Sesja przeglądarki: `/private/tmp/stanowisko-noc/auth.json` — **storageState Playwright (cookies), nie token Bearer**.
- Własne API na **41xx** wymaga `DB_MANAGED_SCHEMA=off` (bez tego serwer NIE wstanie na tej bazie —
  migracja `20260412_seed_business_templates.sql` łamie się o istniejące dane). Wzór: `scripts/dev/stanowisko-lokalne/start.sh:43`.
- Własny vite z zakresu **3140–3199** (port 3101 bywa zajęty przez cudzy proces na `[::1]`, co daje **puste zrzuty i 404** mimo działającej aplikacji).
- Baza 54400: odczyt tak, zapis tylko na własnej kopii.
- Staging: `https://staging.consultify.ai`, dowód wdrożenia = `gitSha` z `/api/health`.

## 9. BRAMKA PRZED PUSHEM (6 kroków, obowiązkowa)
0. **Czystość drzewa m03**: `git status --short | grep -cE '^ D|^ M'` = 0.
1. `git ls-remote origin staging` + `gh run list --workflow=railway-deploy.yml --limit 1` (nic nie buduje?).
2. `cd server && NODE_OPTIONS=--max-old-space-size=3072 ../node_modules/.bin/tsc -p tsconfig.build.json --noEmit > log 2>&1; echo EXIT=$?`
3. **PEŁNY** `NODE_OPTIONS="--max-old-space-size=6144" npm run build > log 2>&1; echo EXIT=$?` + `grep -c "built in" log`.
   **NIGDY przez potok** — `npm run build | tail -3; echo KONIEC` daje status ECHA, nie builda.
4. Łańcuch migracji na 54400; nazwy nowych migracji datowane **≥ 20262107**.
5. Push + `gh workflow run railway-deploy.yml --ref staging -f environment=staging`; dowód = `gitSha` z health.
   **`workflow failed` NIE znaczy `wdrożenie nie weszło`** — Railway potrafi dokończyć budowę po tym, jak workflow
   przekroczy własny limit czasu. Zawsze sprawdzić `railway deployment list` i health, zanim uzna się deploy za nieudany.

## 10. ZAKAZY (bezwzględne, dla każdego wykonawcy)
sparse-checkout, `git stash` (**stos jest WSPÓLNY dla wszystkich katalogów roboczych i sesji** — do porównań
`git show <ref>:<plik>` albo drugi checkout), `git worktree remove/prune`, `--no-verify`, `pkill`,
`git push` bez zgody nadzorcy, `rm -rf` poza własnym worktree, zapis na 54400 poza uzgodnionym zakresem,
kontakt z produkcją, sub-agenci, dotykanie `/private/tmp/m03` przez wykonawcę.
Znaczniki odmrożenia **wyłącznie** z `docs/program/MVP_FINAL_ZAMROZONE.json` — modułu `09_RESULTS` tam NIE MA,
numeracja skacze 08 → 11.
