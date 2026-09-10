# PRZEKAZANIE — 10.09.2026, koniec dnia (jedyny punkt wejścia)

Ten plik zastępuje `PRZEKAZANIE_20260909_KONIEC_DNIA.md` i `RAPORT_KONCOWY_20260910.md` jako punkt wejścia.
Przeczytaj w całości, zanim cokolwiek zrobisz. Zasada dnia bez zmian: **PASS tylko po pomiarze;
„nie sprawdziłem" to N/A z powodem, nie PASS.** Zasada dodana dzisiaj: **premisa z rejestru jest hipotezą,
nie faktem** — 10.09 siedem premis nadzorcy padło pod pomiarem (§5).

To jest realizacja **S1.12** (przekazanie do pojemnika 2). **S1.11** (re-tag zamrożenia) ma przygotowany
skrypt `scripts/dev/retag-zamrozenia-20260910.sh` — uruchamia go CTO po zasiewie konta właściciela (S-1),
nie ten dokument.

---

## 0. Stan zmierzony (10.09, 21:10 — odczyt `/api/health`, `git`, tagi; nie z pamięci)

| | staging (thomas) | demo (trolley) | linia integracyjna |
|---|---|---|---|
| kod (`gitSha` z `/api/health`) | **`ff3ae0dbde`** | **`691e2d3b0f`** | — |
| gałąź | `staging` = `ff3ae0dbde` | wdraża się TYLKO z tagu | `mvp/inicjatywy-lancuch-20260907` = **`0416c9ba55`** |
| `database` / `redis` | connected / connected | connected / connected | — |
| tag `staging-deployed` | **`ff3ae0dbde`** (zdalny, przesunięty przez workflow o 22:25) | — | uwaga: **lokalny** `staging-deployed` w tym worktree wskazuje `b85398b174` — przed użyciem `git fetch --tags --force` |
| punkty cofnięcia | `staging-safe-20260910-1400` · `-1745` (=`b85398b174`) · `-1840` (=`ca8fb13269`) · `-2150` (=`71094d987e`) | `demo-safe-20260910` (=`f53f9fbdf9`) | — |
| baza aplikacji | serwis Railway **`pgvector`** (`thomas:52567`, przez `DATABASE_URL`) | osobna baza (`trolley`) | — |
| organizacje | 19 (8 docelowych + 10 klonów sesji demo + `TT22TT 2`) — klony znikną w ~2 h po wdrożeniu partii 3 | 4 docelowe | — |
| produkcja | **centerbeam nietknięta przez cały dzień** | | |

Trzy partie wdrożone dziś przez CTO: `ca8fb13269` (16:20) → `71094d987e` (19:05) → `ff3ae0dbde` (22:25).
Każda potwierdzona odczytem `/api/health`, nie słowem.

**Linia integracyjna wyprzedza staging o 20 commitów** (`ff3ae0dbde..0416c9ba55`): cały blok Codexa nr 1
(E1–E6) z FIX-ami C1-FIX 1–8 i C2-FIX 13/13, flaga `ENABLE_INITIATIVE_UNIFIED_READ` **nieustawiona (OFF)**,
plus rejestr i karty. **NIE wdrożone — czeka na koniec Tokio.**

**STAGING JEST ZAMROŻONY na noc 10/11.09 (DEC-467).** Zespół pokazuje na targach w Tokio
`https://staging.consultify.ai` na koncie `piotr.wisniewski@dbr77.com` (org DBR77). Od zakończenia S-1:
zero wdrożeń, zero zmian zmiennych, zero operacji na danych DBR77 — chyba że właściciel poprosi.

Strażniki zmierzone przeze mnie na `0416c9ba55` (nie przepisane):
`check-list-canon.sh` PASS (357 = baseline 357) · `check-artefakt.sh` PASS (crimson 8 = 8, karty N 0/0,
danger-* 117 = 117) · `vitest tests/unit/i18n/i18nTrescPolska.test.ts` **3/3 PASS** (ratchet i18n, który
o 08:15 był FAIL z +60 naruszeń, zamknięty przez P8 `4ee1226be7`) · `git log --diff-filter=M -- server/migrations`
od 06.09 = **0 zmodyfikowanych migracji**.

---

## 1. Gdzie co jest

- Worktree'y żywe: `~/Developer/wt/` — `fable-inicjatywy` (integracyjny), `s1-tokio` (zasiew konta
  właściciela, w toku), `a1-karty-n`, `a2-panel`, `a3-przekazanie`, `audyt-p1`, `c1-odbior`, `e4-dane`,
  `w1a-sprzatanie` (2 pliki brudu), `w1c-bramka`, `w1e-dziury`, `w1f-codex-instrukcja` (2 commity
  cherry-pickowane), `p11-weryf`, `j9-tmp`. Każdy z `node_modules` jako symlink.
  29 worktree'ów usuniętych 10.09 21:45 (143 GB → wolne 120 GB) po sprawdzeniu „brud = 0" i „poza linią = 0".
- Sekrety poza repo: `~/Developer/consultify-secrets/` — `server.env`, `railway-staging.json`,
  `northwind-konta-STAGING.txt`, `ops/demo-kopia-stagingu.sh`.
- Zrzuty baz i manifesty: `~/Developer/consultify-dumps/` i `.../manifesty/`.
  Zrzut przed operacjami 10.09: `e4-dane-przed-20260910-1447.dump` (235,6 MB, sha256 w logu),
  `staging-thomas-przed-w1a-20260910-1307.dump` (236 MB).
- Rejestr prac (SSOT statusu): `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`,
  sekcja „Dzień inżynierski koszyka 2 — 10.09.2026" i dalej.
- Plan dnia: `docs/program/PLAN_CTO_20260910.md` (zastępuje `ZLECENIE_NASTEPCY_20260910_KOSZYK2.md`).
- Kryteria pojemników: `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md`.
- Audyt pojemnika 1 z pomiarem per S1.1–S1.13: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/AUDYT_POJEMNIK_1_20260910.md`
  — **UWAGA: leży wyłącznie na gałęzi `audyt/pojemnik1-20260910` (`8d6445a523`), NIE na linii integracyjnej.**
  Odczyt: `git show 8d6445a523:docs/program/PRZEKAZANIE_KODOWANIA_20260907/AUDYT_POJEMNIK_1_20260910.md`.
- Odbiory 10.09: `ODBIOR_W1B_INICJATYWY_REALIZACJA_20260910.md` (PRZED, w `417a108628`),
  `ODBIOR_W2B_INICJATYWY_REALIZACJA_20260910.md` (PO), `KARTA_PRZEJSCIA_WLASCICIELA_20260910.md`,
  `KARTA_DECYZJI_20260910_WIECZOR.md`.
- Blok Codexa nr 1: `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX1_INICJATYWY/` —
  `01_INSTRUKCJA.md` (1616 linii), `98_RAPORT.md` (Codex), `97_ODBIOR_W1_W2.md` i `96_ODBIOR_C2_E3_E5.md`
  (odbiory CTO). Worktree Codexa: `~/Developer/codex-wt/codex1-inicjatywy`.
- Zrzuty dowodowe 10.09: `evidence/w1b-odbior/` (30), `evidence/w2b-odbior/` (62), `evidence/e1a/`,
  `evidence/e1b/`, `evidence/e1c/`, `evidence/e3/` (24), `evidence/e3b/`, `evidence/c1-odbior/` (85),
  `evidence/e4-dane/manifesty/`, `evidence/d-a-zespol/manifesty/`, `evidence/d-b-megatrendy/`,
  `evidence/d-c-projekty/`.

---

## 2. Jak się wdraża (dwie komendy — i pięć pułapek, każda kosztowała nas dzień)

**Staging:**
```
git push origin HEAD:staging            # musi być fast-forward
gh workflow run railway-deploy.yml --ref staging -f environment=staging
curl -s https://staging.consultify.ai/api/health   # odczytaj gitSha, nie zakładaj
```

**Demo:**
```
gh workflow run railway-deploy.yml --ref staging -f environment=demo -f confirm_demo=yes
```

1. **Push na `staging` SAM buduje Railway** (serwis podpięty do gałęzi GitHub). Workflow to druga,
   równoległa droga. Push = wdrożenie, nawet jeśli workflow nie ruszy.
2. **Timeout workflow nie znaczy „nie wdrożone" — ale NIE przesuwa tagu `staging-deployed`.**
   10.09 13:35 run 34470281144 skończył się `failure` na „Timed out waiting" (120 prób), a wdrożenie
   doszło (`railway deployment list` = SUCCESS). Tag trzeba było przesunąć ręcznie. **Zawsze po wdrożeniu:
   `railway deployment list` + `/api/health` + `git ls-remote --tags origin staging-deployed`.**
3. **Demo wdraża się WYŁĄCZNIE z tagu `staging-deployed`** (`.github/workflows/railway-deploy.yml:246,286`),
   nigdy z gałęzi `demo`. Bez `-f confirm_demo=yes` job jest `skipped`. **Domyślne środowisko w workflow
   to produkcja — zawsze podawaj `-f environment=`.**
4. **Zmienne Railway ZAWSZE z `--skip-deploys`.** Bez tego redeploy bierze commit z GitHuba i wdraża obcy
   kod: 10.09 rano demo pojechało 2 h na `f3a45b0c90` (Londyn, 6 lipca) po `railway variables --set`
   bez tej flagi. Po każdej zmiennej: odczyt `/api/health` i porównanie SHA — nie „ok".
5. **Health podaje SHA z `APP_BUILD_SHA`**, którą workflow ustawia sam
   (`railway-deploy.yml:114` dla stagingu, `:301` dla demo, obie z `--skip-deploys`).
   Kolejność w `server/src/config/buildSha.ts`: `APP_BUILD_SHA || RAILWAY_GIT_COMMIT_SHA || GITHUB_SHA || GIT_SHA`.
   Skutek: **jeśli ktoś ustawi `APP_BUILD_SHA` ręcznie, health będzie kłamał o tym, co naprawdę biegnie.**
   10.09 13:35 health pokazywał `4630b1ee4c`, a wdrożony był `b85398b174` (różnica = tylko docs).

**Znalezisko do naprawy osobno:** workflow `test-suite.yml` nie startuje dla gałęzi `staging`
(filtr: main/develop/Londyn/demo) i od 02.09 kończy się porażką wszędzie. Czyli „testy pustych stanów
wpięte w CI" (P17) to bezpiecznik, który na stagingu **nigdy nie zadziała**.

---

## 3. Jak się scala paczkę robotnika (bramka 4-krokowa + reguła trójstronna)

```
git merge --no-ff --no-commit <gałąź>
# konflikty prawie zawsze wyłącznie w baseline.json i public/locales/{pl,en}/translation.json
python3 <helper> public/locales/pl/translation.json     # patrz reguła niżej
git commit -m "probe"        # wypisze, których znaczników odmrożenia żąda check-freeze
git commit -m "merge(...): ... [ODMROZENIE <MODUL> DEC-<nr>]"
# kontrola, że scalenie nie zmieniło plików gałęzi:
git diff --stat HEAD^2 HEAD -- $(git diff --name-only $(git merge-base HEAD^1 HEAD^2) HEAD^2)   # tylko JSON
git worktree remove <ścieżka>      # dopiero PO commicie scalającym; gałęzi nie kasuj przed commitem
```

**Bramka 4-krokowa (progi na 10.09):**
```
node_modules/.bin/tsc -p server/tsconfig.json --noEmit                              # = 0
NODE_OPTIONS=--max-old-space-size=8192 node_modules/.bin/tsc -p tsconfig.json --noEmit   # ≤ 192
node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json  # bez wzrostu
NODE_OPTIONS=--max-old-space-size=6144 node_modules/.bin/vite build                 # OK + drzewo czyste
```
plus `check-list-canon.sh` (357), `check-artefakt.sh` (8/0/117) i 18 bezpieczników językowych.
**Bramkę mierz BEZ potoku** (`build | tail; echo` daje status echa, nie builda) i sprawdź marker sukcesu.

### Reguła trójstronna scalania słowników (helper `scal-json3.py`)

Helper żyje w scratchpadzie CTO (`/private/tmp/.../scratchpad/scal-json3.py`) — a **`/private/tmp` znika
po restarcie maszyny**. Dlatego reguła jest zapisana tutaj, w repo, i można ją odtworzyć w 20 wierszach:

- czyta trzy wersje pliku: `base` = `git merge-base HEAD MERGE_HEAD`, `ours` = `HEAD`, `theirs` = `MERGE_HEAD`;
- klucz **jest u obu** → schodzi rekurencyjnie;
- klucz **jest u nas, nie ma u nich**: jeśli `base[k] == ours[k]` → **oni go skasowali, respektuj kasowanie**;
  inaczej → nasz nowy klucz, zostaje;
- klucz **jest u nich, nie ma u nas**: jeśli `base[k] == theirs[k]` → **my go skasowaliśmy, zostaje skasowany**;
  inaczej → ich nowy klucz, dodaj;
- liście: `ours == theirs` → bez zmian; `base == ours` → bierz `theirs`; `base == theirs` → bierz `ours`;
  realny konflikt → **wygrywa `ours`** i licznik `konflikt_ours_wins` rośnie (przejrzyj te miejsca ręcznie);
- na końcu drukuje statystyki `{dodane_theirs, dodane_ours, usuniete_ours, usuniete_theirs, konflikt_ours_wins}`.

**Czwarty przypadek („brak u nas + `theirs == base`") to ten, który wcześniejsza wersja helpera myliła
i przywracała skasowane klucze.** Złapał to ratchet, nie oko — dlatego bramkę językową puszczaj po KAŻDYM
scaleniu słownika, nie na końcu partii. Dla `baseline.json` reguła jest inna: **minimum per klucz.**

---

## 4. Pułapki stanowiska (każda kosztowała czas w ostatnich dwóch dniach)

1. `~/Developer/consultify-secrets/server.env` wskazuje `DB_*` na Railway → lokalne API kończy się po cichu.
   Przed uruchomieniem lokalnym:
   `unset DB_HOST DB_NAME DB_USER DB_PASSWORD DB_PORT DB_SSL DB_SSLMODE DISABLE_RATE_LIMIT NODE_ENV`.
2. **Ten sam plik niesie `SMTP_HOST/SMTP_PASS/SMTP_FROM/EMAIL_FROM/ALERT_EMAIL_RECIPIENTS`.**
   Dorzuć `unset SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM EMAIL_FROM ADMIN_EMAIL ALERT_EMAIL_RECIPIENTS`
   — inaczej lokalny przebieg próbuje wysłać pocztę przez konto Hostinger, które **jest wyłączone**
   („554 5.7.1 Outbound sending is disabled for this account"), i test „wysyłka działa" da fałszywy wynik
   w obie strony.
3. `NODE_ENV=development` w tym samym pliku → build po `source` fałszywie potwierdza defekty widoczne
   wyłącznie w trybie deweloperskim.
4. Bez `ENABLE_V8_GLOBAL=true` część tras oddaje 404 **przed** autoryzacją (kiedyś wzięte za 22 defekty produktu).
5. **Staging ma DWA serwisy Postgres.** `Postgres` (`thomas:28864`) jest prawie pusty (1 user, 1 org) i
   **nieużywany** — zmienna `DB_HOST=postgres.railway.internal` jest MARTWA. Baza aplikacji to serwis
   **`pgvector`** (`thomas:52567`, przez `DATABASE_URL`). Każdy pomiar „na bazie stagingu" zrobiony przez
   `DB_HOST` mierzy pustą atrapę i zamelduje „0 rekordów" jako fakt. Do sprzątania: martwy serwis i zmienne `DB_*`.
6. **Szablon lokalny: `consultify_staging_1009`** (kontener `consultify-pg18`, port 54418) — odświeżony ze
   zrzutu z 10.09. Starszy `consultify_staging_czysta` jest sprzed przywrócenia konfiguracji produktu 09.09:
   brakuje w nim wiersza bazowego `ie_governance_policies` (`'*'`) → **każdy zapis runtime-v1 kończy się 500**,
   a brama portfolio oddaje „Product baseline is missing". Kopie rób z `1009` i kasuj po pracy.
7. **Kreator powitalny „Krok 1 z 3" ISTNIEJE i zasłania zrzuty** (wbrew meldunkowi P1 „kreator nie istnieje").
   Konto do zrzutów musi mieć `user_preferences.onboarding_completed = true`, inaczej pół zrzutów jest
   o kreatorze, nie o produkcie („przyrząd kłamie, a oko przywyka").
8. **Klik w geometryczny środek wiersza tabeli Praca połyka podgląd.** Wiersz ma 1270 px, środek wypada na
   komórce OSOBA, która ma własny element interaktywny. Wyglądało to na regresję („po zmianie statusu wiersz
   przestaje otwierać podgląd") — **fałszywy alarm**. Klikaj w pierwszą kolumnę; weryfikuj `elementFromPoint`.
9. **Motyw bierze się z zustand, nie z `prefers-color-scheme`.** `page.emulateMedia` nie zmienia nic.
   Klucz: `consultify-storage` (`useAppStore.ts:44`), pole `state.theme`, **wymaga przeładowania strony**.
   Bez tego para „jasny/ciemny" to dwa ciemne zrzuty pod dwiema nazwami.
10. `body.innerText()` kłamie w drugą stronę — dwa razy oddał „nie ma" tam, gdzie zrzut z tej samej sekundy
    pokazywał treść. Każde „nie widać" opieraj na ZRZUCIE.
11. Połączenia do baz zdalnych przez proxy Railway zrywają się przy długich skanach — powtarzaj przy
    `EADDRNOTAVAIL`/`ETIMEDOUT`.
12. Polskie cudzysłowy i apostrofy rozwalają literały Pythona w heredoc — pisz skrypt do pliku.
13. **`/private/tmp` znika po restarcie.** Worktree, sekrety, zrzuty i helpery trzymaj w `~/Developer/`.
    Dowód, którego nie ma w repo, wyparuje — 10.09 potwierdzone po raz kolejny (`higiena-staging-dryrun.txt`).

---

## 5. Lekcje dnia, które muszą przetrwać

### 5.1 Konto właściciela żyło w organizacji pokazowej — i zginęło razem z nią

Właściciel od marca logował się kontem założonym w organizacji pokazowej **Atelier Toys**. Czystka 09.09 09:49
(poprzednia sesja, ogólna zgoda na kasowanie Atelier/Nordwind/VTS) skasowała organizację **razem z jego kontem**.
Skutek zobaczyliśmy dopiero 10.09 17:53: „User not found" ×3 w logu, właściciel nie mógł wejść w dniu przed
targami. Konto odtworzone o 21:10 w DBR77 (`users 1bd98637-14ad-45d5-a120-b92ff0d4dfcd`, ADMIN + OWNER/ACTIVE)
z **oryginalnym skrótem hasła z manifestu** `usun-organizacje-2026-09-09T07-49-40-225Z-manifest.json`.

**Reguła:** przed czystką organizacji sprawdź, czy nie zawiera kont ludzi — adres w domenie klienta,
`last_login`, `partner_connection_receipts`. Lista „zachowaj" z 09.09 miała tylko DBR77/Northwind/system.

Drugi wniosek, zmierzony o 21:58: samo konto to za mało. Nowe konto właściciela **nie miało ani jednego
wiersza biznesowego** (tylko logi, preferencje, tokeny), a organizacja DBR77 ma 106 inicjatyw, 248 zadań,
80 decyzji, 573 pozycje skrzynki, 15 spotkań, 38 pomysłów. Widoki per użytkownik (Moja Praca, skrzynka,
decyzje do akceptacji) były **puste**. Stąd zadanie **S-1** (zasiew per użytkownik, po angielsku wg DEC-461)
i warunek DEC-466.

### 5.2 Premisa nadzorcy była fałszywa siedem razy jednego dnia

Za każdym razem prawda była **poważniejsza** niż premisa, a robotnik z pomiarem miał rację przeciw zleceniu:

| # | Premisa nadzorcy | Pomiar |
|---|---|---|
| 1 | „Poczta martwa w całej aplikacji" (P1) | **Kod DZIAŁA** — szyfrowanie liczone z portu, `SMTP_FROM` ma zapasowe źródło. Martwe jest konto Hostinger („Outbound sending is disabled"), nie aplikacja |
| 2 | „Na stagingu jest bazowa organizacja demo Atelier Toys" (1-A) | **Nie istnieje.** Były wyłącznie klony `ateliertoys-demo-session-*` |
| 3 | „Tworzenie inicjatywy działa, bo działa na Northwindzie" (P14) | Działa **tylko dlatego, że seed jawnie wstawia członków**. 23 z 25 projektów nie miało właściciela wśród członków → blokada pierwszej minuty dla każdego klienta |
| 4 | „Trzy `.catch(() => {})` gaszą błędy" (1-B) | **Obalona** — to komentarze; 2 ciche catch na odczycie = kosmetyka |
| 5 | „`pmoValidation.middleware.ts:206` to jedyna z 50 bramek bez `organization_id`" (E1a N4) | `validateTask` **nie jest wpięty NIGDZIE** — to martwy kod. Bramka istniała tylko w grepie |
| 6 | „Zaległość zespołu DBR77 = 0" (D-A) | **492 h u 6 osób**, niewidoczne w kokpicie. Zerem był popyt, nie zaległość |
| 7 | „Kebab inicjatywy ma zły układ, popraw" (E3b) | Układ **ZGODNY z kanonem** (`TRIADA_KANON` §A6, `TABLE_AND_PREVIEW_CANON` §9.2). Polecenie CTO było błędne, robotnik go nie wykonał i miał rację |

Dodatkowo: zlecenie „włącz CSRF enforce" (P4) **mogło położyć staging** — zwolnienia porównywały adres
względny z absolutnym, więc wszystkie były martwe; enforce bez naprawy wywaliłby logowanie, rejestrację,
reset hasła i webhooki Stripe.

**Reguła operacyjna:** każde zlecenie zaczyna się KROKIEM 0 „zmierz premisę i zamelduj, jeśli jest fałszywa".
Zdanie „zweryfikuj moją liczbę sam" w zleceniu zwraca się dziesięciokrotnie.

### 5.3 Robotnicy odmawiają logowania hasłem — dowody zapisu robi CTO

Sonnet i Opus konsekwentnie odmawiają wpisania hasła nawet do konta testowego. Skutek: **każdy dowód
„zapis na żywej bazie działa" wykonuje CTO osobiście** (`scripts/dane/dowod-zapisu-northwind.mjs`).
Planuj to jako swoje 10 minut po każdym wdrożeniu, nie jako pozycję dla robotnika. Wzór dowodu
(3× wykonany dziś, każdy PASS): login 200 · `GET /api/initiatives` 200 · `POST source-proposals` 201 ·
`POST registrations` 201 · `PATCH metadata` 200 · `POST /api/tasks` 201 → `DELETE` 200 · `POST cancel` 200 ·
**0×5xx** · sonda usunięta tym samym skryptem (`D6_INITIATIVE_ID`).

### 5.4 Trzy mniejsze, ale kosztowne

- **Ślad audytowy jest nie do podrobienia i to jest cecha, nie usterka.** Lineage inicjatywy powstaje
  wyłącznie po akceptacji kandydata przez człowieka (`transformationCaseService.ts:4317`, „no synthetic
  approved decision"). Doklejenie go w komendzie sfałszowałoby dowód — stąd trzy warianty A/B/C i decyzja
  właściciela o przesunięciu całego procesu do fali 2 (DEC-465).
- **Migracja, która nic nie zmienia, to nie jest udana migracja.** Migracja Codexa E3 przeniosła 2 rekordy
  ze 107 (98,1 % pominiętych), obie kwalifikowalne to śmieci testowe TT22TT, a DBR77 dostało **0 ze 106**.
  Widoczne przez API zero różnicy, bo czytnik E2 i tak robi UNION. Próg STOP (30 %) nie był nazwany
  w instrukcji — dopisz próg do każdej następnej instrukcji migracyjnej.
- **Skrypt danych musi mieć host-guard.** `megatrendy-automotive-20260910.mjs` przepuszcza tylko `thomas`;
  `migruj-inicjatywy-do-kanonu.ts` miał nazwę bazy przybitą w kodzie (FIX-E3-1: `--baza=` + `FORBIDDEN_DB_HOSTS`).

---

## 6. Stan pojemnika 1 — per S1.1…S1.13 (10.09, 22:40)

| # | Kryterium (skrót) | Werdykt | Dowód / co zostało |
|---|---|---|---|
| **S1.1** | 16 modułów, każdy z „Tak" właściciela | **WARUNKOWE TAK** | DEC-452 (07.09 07:29) zbiorczo: „jestem OK ze wszystkimi modułami"; DEC-453 cofnął Inicjatywy i Realizację; **DEC-466 (10.09 21:55 + 22:35) przywraca je warunkowo**: „przepuszczamy warunkowo… narzędzia są, ale nie są jeszcze dobre, poprawimy je w fali 2". Warunek: konto właściciela zasiane we wszystkich modułach (**S-1 w toku**). Forma niezgodna z literą kryterium — nie ma 16 osobnych kart „jeden obraz, Tak" (`AUDYT_POJEMNIK_1_20260910.md`) |
| **S1.2** | Zero otwartych BLOKER/WAŻNY | **NIE** | Zamknięte dziś: dedup dokumentów po tytule (`e03c437821` — 283 realne artefakty były niewidoczne, 0 z nich prawdziwymi duplikatami; na stagingu od `ff3ae0dbde`), 3 blokery Inicjatyw/Realizacji (W2B: pętla PUT 404 → 0, „Otwórz zadanie" 404 3/3 → 0, status zadania → pełny łańcuch). **Otwarte:** D-6 BLOKER (MEMBER, kebab „Zaktualizuj zadanie" → 4×404, trzecia gałąź rodziny R1/F1; ADMIN niesprawdzony), D-5 `column "assigned_to" does not exist` ×4 (powiadomienia zadań cicho nie powstają), D-3 karta nowej inicjatywy nieosiągalna z URL i po odświeżeniu, D-4b dwa tytuły tego samego rekordu (lista PL / karta EN), `relation "task_history" does not exist` (11× w logu), E2 STOP-2/3/4 (decyzje chronione ręcznym `if`, `DELETE task` inna normalizacja roli, `assign/reassign` niezmierzone) |
| **S1.3** | KPI poza limitem → Skrzynka → karta → zadanie, żywo | **TAK** (lokalnie) | e2e 2/2 + PG 3/3 z 3 mutacjami, merge `0bfeed97bb`; `evidence/p7k-b/00..03*.png` + sidecar `.json` z `"bledyKonsoli": []`. Zastrzeżenie: `127.0.0.1:3105`, nie staging |
| **S1.4** | Dokument i prezentacja z szablonu JAKO PLIK | **TAK** | `evidence/dokument-plik-20260906/`: DOCX 258 KB, PPTX 563 KB, PDF 57 KB / 14 stron — magic bytes zweryfikowane. Akcept 06.09 10:20: „raporty powiedzmy 3,5 w skali do 6, ale na MVP wystarcza" |
| **S1.5** | Jeden prawy panel na 8 listach, 1280/1440/1920 | **CZĘŚCIOWO** | Mechanika wdrożona (1.1-K6: 23 ekrany, 13 plików, 85 testów), akcept per karta. Brak kompletu **8×3 zrzutów na żywo** — miał go domknąć re-audyt 1.9, który nie ruszył |
| **S1.6** | Teresa PL + źródła w każdym module MVP | **CZĘŚCIOWO** | `evidence/teresa-16/` — 16 par PNG+JSON, 13/13 modułów z wejściem PASS, ale mierzone **lokalnie** (`consultify_noc:54400`), nie na stagingu. 10.09 dwa razy STOP „brak kredytów LLM na stanowisku" → kreator inicjatywy AI i generacja **niezmierzone** (jedyna rzecz, której karta przejścia nie potwierdza) |
| **S1.7** | Dane właściciela czyste | **CZĘŚCIOWO — stan nawracający** | Zrobione 10.09: E4 (brud §6 — ACCEPTANCE, `zdfsf`, 14 wierszy HTML-escape w 6 kolumnach, 2 inicjatywy z czatu, 14 zadań, 3 RAID, 3 sondy), D-C/D-C2 (duplikaty projektów: 2 puste zarchiwizowane, 7 przemianowanych „(copy 2..6)"), D-A/D-A2 (15 profili, 10 `required_capacity_fte`, 34 zadania z terminami → popyt 0 → 420,8 h), D-B/D-B2 (megatrendy 0 → 34). **Nawrót tego samego dnia:** organizacje 8 → 19 (10 klonów sesji demo + `TT22TT 2`); zmienne `DEMO_CLEANUP_ENABLED=true`, `DEMO_SESSION_TTL_HOURS=2` ustawione, sprzątacz godzinowy działa dopiero od `ff3ae0dbde`. **DEC-461 zmienia cel: dane mają być ANGIELSKIE** — polski skrypt nazw NIE uruchamiamy |
| **S1.8** | Strażniki zielone, dług nie rośnie, tsc, 0 migracji | **TAK** (zmierzone przeze mnie na `0416c9ba55`) | `check-list-canon` 357 = 357 · `check-artefakt` 8/0/117 = baseline · **`i18nTrescPolska` 3/3 PASS** (o 08:15 był FAIL +60 ponad baseline 261; zamknięty przez P8 `4ee1226be7` — strażnik był czerwony 4 dni, bo hook odpalał inny przyrząd) · 0 zmodyfikowanych migracji od 06.09 · tsc serwera 0 i front 192 = baza w bramce partii 3. Dług nienazwany: **263 klucze tylko w `pl`** (billing, v8.artifactRun, vector, rap, mels, security, pricing) są poza zasięgiem `pomiar-jezyka.mjs` |
| **S1.9** | Demo: własna baza, dane pokazowe, promocja z cofnięciem | **CZĘŚCIOWO** | Osobne bazy potwierdzone odczytem Railway (`pgvector` vs `postgres`, osobne środowiska). Tag `demo-safe-20260910` = `f53f9fbdf9` założony dziś (poprzedni był przestarzały o 1577 commitów). **Ale:** demo jedzie `691e2d3b0f`, czyli **trzy partie za stagingiem**; danych pokazowych na demo nikt nie zweryfikował (CTO nie ma kont demo); promocja przećwiczona, cofnięcie na demo — nie |
| **S1.10** | Trzy decyzje podjęte i zapisane | **TAK** | DEC-399 (Finanse MINIMUM → pojemnik 2), DEC-402 pkt 3 (płaska lista + obszar/oś) i pkt 4 (kropka „Model" neutralna), wdrożone w `8c2aa63d9c`. Dziś dołożone: DEC-461…467 |
| **S1.11** | 16 modułów + Wyniki + Finanse zamrożone tagiem | **NIE** | 14 tagów `mvp-final-*-20260905` (1764–1844 commitów za `ff3ae0dbde`) + `modul-09-wyniki-final-20260902` i `modul-10-finanse-final-20260902` (3322 / 3312 commitów za). Rejestr `MVP_FINAL_ZAMROZONE.json` ma **14 z 16** modułów (brak `09_RESULTS` i `10_FINANCE`), `wspolne` = `null`. **Skrypt gotowy: `scripts/dev/retag-zamrozenia-20260910.sh` — `--apply` po S-1, uruchamia CTO** |
| **S1.12** | Przekazanie dla pojemnika 2 napisane | **TAK** | ten plik |
| **S1.13** | Analiza kart N: kontrakt/ekran/rozjazd per karta | **CZĘŚCIOWO** | Jest: `docs/ssot/KARTA_N_KONTRAKT.md` (251 linii, 6 kryteriów × 22 karty), `K1_WNIOSKI_INICJATYWY_RAPORT.md`, `evidence/p10-matryca/` (80 plików), 19 decyzji CTO. Nie: Codex P10 r2 = PARTIAL/NOT PROVEN (9/22, nie 22/22); Faza B (DEC-432 — kontrakt jedynym źródłem sekcji) nie ma wpisu zamykającego; **odbiór Codexa P13-A (18 commitów, `codex/p13a-karty-n` = `6acbf68cfb`) nie odbył się** — pozycja 1-D planu CTO nie ruszyła po awarii stanowiska. Robotnik A1 pracuje dziś na `mvp/a1-karty-n-20260910` |

**Podsumowanie:** TAK — 5 (S1.3, S1.4, S1.8, S1.10, S1.12). WARUNKOWE — 1 (S1.1).
CZĘŚCIOWO — 5 (S1.5, S1.6, S1.7, S1.9, S1.13). NIE — 2 (S1.2, S1.11).
**Pojemnik 1 nie jest zamknięty. Wąskie gardło = S1.2 (cztery otwarte pozycje z W2B) i S1.11 (jedno uruchomienie skryptu).**

---

## 7. Kolejka pojemnika 2 — co z niej już zrobiono 10.09

Mapowanie na 15 kryteriów `TRZY_POJEMNIKI_PRACY_20260906.md` i listę S2.1–S2.14.
„ZROBIONE" znaczy: kod na stagingu i zmierzony. **Nic z tego nie było oglądane przez właściciela** —
to materiał na jego przejście, nie na odbiór.

| Kryt. | Treść | Stan | Co konkretnie |
|---|---|---|---|
| 1 | Świeża organizacja przechodzi „pusty stan → pierwsza wartość" | **CZĘŚCIOWO** | P9 `6aa853adc2` — **defekt blokujący pilotaż**: ścieżka rejestracji nigdy nie zapisywała flag, każda normalnie założona organizacja była martwa (404 na CAŁYM `/api/v8`); działały tylko Northwind i DBR77, na których robiliśmy wszystkie pomiary. P14 `513d4d5fff` — druga blokada pierwszej minuty (23 z 25 projektów bez właściciela wśród członków). P2A `f52dcdf6a4` (26 ekranów, 1 realny brak), P2B `f66eb1a3fc`/`dbe6325fb6` (3 puste stany Wyników, 4 Materiałów). **Brak: pełny przepływ Playwright per moduł na świeżej organizacji** |
| 2 | Bezpieczeństwo: cross-org, CSRF enforce, MFA, 0×500 przez 7 dni | **CZĘŚCIOWO** | P4 `b6783a9172` — realny wyciek `GET /api/projects/:id/notification-settings` bez filtra org zamknięty, zwolnienia CSRF naprawione; CSRF `enforce` na stagingu zmierzony w przeglądarce (bez tokenu 403 `CSRF_MISSING`, z tokenem zapis). E2 `0e8090e592` + E2b `ed68b918c4` — własność obiektu dla zadań i inicjatyw (PRZED: MEMBER nadpisywał cudze; PO: 403 `CAPABILITY_OBJECT_OWNERSHIP_REQUIRED`; 7/7 i 10/10 na realnym PG, mutacje RED→GREEN). P18 `4eab795efd` — MFA działa, karencja 7 dni. **Brak: macierz 2725 tras (dyżur 307), 7 dni bez 5xx, E2 STOP-2/3/4** |
| 3 | Onboarding, TRIAL, poczta żywa | **CZĘŚCIOWO** | P1 `b8dc60f6f8` — trzy maile pierwszego kontaktu po polsku (do przepisania na EN wg DEC-461); kod poczty DZIAŁA. **Blokada zewnętrzna: konto SMTP Hostinger wyłączone** — zaproszenia i reset hasła nie dochodzą. Kreator „Krok 1 z 3" istnieje (P1 zameldował, że nie). **Brak: dwie ścieżki zaproszeń mają różne reguły limitu miejsc** |
| 4 | Każdy ekran flagowy < 3 s, Megatrendy 200 | **CZĘŚCIOWO** | D-B/D-B2 — `megatrends` była **pusta dla wszystkich branż** (migracja `20260608_megatrends_seed.sql` nie zadziałała); dosiane 34 pozycje EN, `GET /api/megatrends/baseline?industry=automotive` **503 → 200**. Dług: `MegatrendsWorkspace.tsx:44` i `megatrendStore.ts:21` mają `'automotive'` na sztywno — panel NIE czyta `organizations.industry`. **Brak: pomiar 3 s na ekranach flagowych** |
| 5 | Dwa magazyny → jedna projekcja (inicjatywy, oceny, finanse, artefakty) | **CZĘŚCIOWO, za flagą OFF** | Blok Codexa nr 1 E1–E6 na linii integracyjnej z C1-FIX 1–8 i C2-FIX 13/13, flaga `ENABLE_INITIATIVE_UNIFIED_READ` nieustawiona. Zmierzone: ON 3/7 powierzchni, OFF 0/7; filtry i paginacja przy ON = OFF; słownik 8 → 19 wpisów; kolizja id → status z tabeli klasycznej; 0 wycieków na 17 obcych id. **Nie ruszone: część ZAPISOWA (FIX-9, `InitiativeController.ts:823`), oceny, analizy finansowe, aliasy artefaktów.** 7. pisarz legacy odkryty: `demoSeedService.ts:2295` — każda sesja demo zasiewa 22 inicjatywy w `initiatives`, 0 w kanonie |
| 6 | Finanse: MINIMUM albo jawne „wkrótce" | **BRAK** | DEC-399: MINIMUM (F-M2/M3/M4/M6/M7) → pozycja 2-B, Codex #3, niewydane. Dziś Finanse zdjęte z przewodnika jako „poza MVP" (P6) |
| 7 | Przewodnik „jak zacząć" w aplikacji, po polsku | **CZĘŚCIOWO** | P6 `7fc9a3c688` — ekran istniał, ale łamał kanon crimson, miał 5 etapów zamiast 6 i **7 angielskich napisów w polskim interfejsie**. Naprawione. **Konflikt: DEC-461 mówi „budujemy po angielsku" — kryterium mówi „po polsku". Do rozstrzygnięcia (§8, pyt. 6)** |
| 8 | Pilotaż: 2 tygodnie DBR77, 0 BLOKER | **BRAK** | — |
| 9 | Produkcja: promocja staging → demo → produkcja przećwiczona z cofnięciem | **BRAK** | Pozycja 2-D/2.0 planu CTO. Produkcja nietknięta. Cofnięcie na demo nieprzećwiczone |
| 10 | Obserwowalność: alert na 5xx i health | **ZROBIONE** | P3 `bc65e504b7` — **alarm szedł donikąd**: czytał `ALERT_EMAIL`/`ADMIN_EMAIL` zamiast `ALERT_EMAIL_RECIPIENTS`. Zmienna ustawiona na demo. **Ale poczta wyłączona po stronie Hostingera → alert i tak nie dojdzie.** S2.5 („był sprawdzony sztucznym błędem") niespełnione |
| 11 | Limiter AI z budżetem per organizacja | **CZĘŚCIOWO** | P3 — `DISABLE_RATE_LIMIT` nie jest fantomem (250/250 z flagą, 200/210 bez); na stagingu ustawione `false`. **Brak: budżet per organizacja i komunikat po wyczerpaniu** |
| 12 | Eksport i usunięcie organizacji z UI | **ZROBIONE** | P5 `7080207b0f` — usuwanie organizacji było **MARTWE W 100 %** (interfejs nie wysyłał wymaganego potwierdzenia → każde kliknięcie 428), a stary mechanizm kasował 5 tabel z kilkuset. P13 `1d5983179b` — przycisk eksportu, dowodem przechwycone realne pobranie pliku. **Brak: retencja opisana, szablon umowy powierzenia** |
| 13 | Playbook wdrożenia klienta | **BRAK** | Pozycja 2-F |
| 14 | Definicja pilotażu (4 osoby, dziennik) | **CZĘŚCIOWO** | Decyzja 06.09: Tomek, Kasia, Irina, Justyna na demo. Zmierzone 10.09: **Justyna i Paweł mają konta** (login 26.08), **Tomek ma konto od 19.02 bez ani jednego logowania**, 3 linki resetu wydane właścicielowi ręcznie, bo poczta nie działa. Iriny w pomiarze nie było |
| 15 | System reakcji właściciela | **BRAK** | Do decyzji właściciela po starcie pilotażu |

**S2.1–S2.14:** wszystkie **NIE**. Najbliżej domknięcia: S2.7 (eksport/usunięcie — brakuje szablonu umowy),
S2.9 (dwa magazyny — kod jest, flaga OFF, część zapisowa nie ruszona), S2.5/S2.6 (mechanika jest, dowód nie).

**Paczki Szampana P1–P18 (15 scaleń 10.09), numery bez wiersza w rejestrze: P7, P11, P15, P16, P19** — te
numery należą do wcześniejszej serii (05–08.09). Jeśli w serii z 10.09 istniały paczki o tych numerach,
nie mają wpisu i nie znam ich losu (§10, STOP-2).

---

## 8. Decyzje właściciela w kolejce (7 — pierwsze cztery blokują pracę)

1. **Czy inicjatywa może istnieć bez projektu?** (blok Codexa, `96_ODBIOR_C2_E3_E5.md` §opcje).
   105 ze 107 rekordów zastanych nie da się zmigrować do kanonu, bo nie mają `project_id` (77) ani
   `owner_business_id` (98), a 70 nie ma obu. Opcje: **0** zostawić tak, jak jest (rekomendacja CTO na MVP —
   czytnik i tak robi UNION) · **A** dokleić właściciela z `created_by` (tylko 5 z 40 wskazuje istniejącego
   użytkownika — NIE) · **B** odgadnąć projekt z danych (0 tropów — niemożliwe) · **C** rozluźnić kanon
   i dopuścić `projectId = null` · **D** ręczna mapa. **Wariant C jest jedynym trwałym — i jest decyzją
   produktową, nie techniczną: „projekt-skrzynka" albo brak projektu jako stan legalny.**
2. **Poczta: konto SMTP Hostinger wyłączone** („554 5.7.1 Outbound sending is disabled for this account",
   padło między 07:49 a 17:59 dnia 10.09). Bez tego nie działają zaproszenia, reset hasła **ani alert o 5xx**
   (kryteria 3, 10 i S2.5, S2.8). Do sprawdzenia w panelu Hostinger albo decyzja o zmianie dostawcy.
3. **Dwa serwisy Postgres na stagingu.** `Postgres` (`thomas:28864`) jest martwy i nieużywany, a zmienne
   `DB_*` do niego prowadzą. Zgoda na usunięcie serwisu i zmiennych? (Ryzyko zostawienia: kolejny pomiar
   trafi w pustą atrapę i zamelduje zera jako fakt.)
4. **Branże `financial` i `edtech manufacturing` bez megatrendów.** Organizacje z tymi branżami są na
   stagingu; seed nie istnieje. Dosiać po angielsku czy zostawić jako znane ograniczenie? Osobno dług
   produktowy: panel zawsze pyta o `automotive`, niezależnie od branży organizacji.
5. **Pilotaż po Tokio: demo czy staging?** DEC-467 przeniósł pokaz na staging. Pilotaż był zaplanowany
   na demo (kryterium 14), ale demo jedzie `691e2d3b0f` — trzy partie za stagingiem — i nikt nie zweryfikował
   na nim danych pokazowych. Jeśli pilotaż ma być na demo, potrzebna promocja + odbiór demo (S1.9).
6. **DEC-461 kontra kryteria pojemnika 2.** „Budujemy wszystko po angielsku, tłumaczymy później" jest
   sprzeczne z kryterium 1 („puste stany **po polsku**"), 3 i 7 („jedna strona »jak zacząć« **po polsku**")
   oraz S2.11. Zgodnie z regułą programu kryteria zmienia właściciel słowem — DEC-461 takim słowem jest,
   ale **nikt nie przepisał kryteriów**. Do jednoznacznego rozstrzygnięcia, żeby pilotaż nie został odebrany
   według nieaktualnej listy.
7. **Karencja i konta pilotażu.** Tomek ma konto od 19.02 bez ani jednego logowania, Iriny nie znalazłem
   w pomiarze. Kto zakłada brakujące konta i kiedy — przy niedziałającej poczcie linki resetu trzeba
   wydawać ręcznie.

---

## 9. Czego nie wolno

- **Staging jest zamrożony do końca pokazu w Tokio (DEC-467)**: zero wdrożeń, zero `railway variables`,
  zero operacji na danych DBR77 — chyba że właściciel poprosi.
- Produkcja (centerbeam) bez jawnej zgody właściciela — **nigdy**.
- `railway variables --set` **bez `--skip-deploys`** (wdraża obcy kod ze starego commita GitHuba).
- `git push --force` na `staging` i `demo`. `--no-verify`. Bare `git stash` (stos jest wspólny).
- Kasowanie czegokolwiek bez zrzutu i manifestu. **Kasowanie organizacji bez sprawdzenia, czy nie zawiera
  kont ludzi** (adres w domenie klienta, `last_login`, `partner_connection_receipts`).
- Kasowanie cudzego worktree. Uznawanie robotnika za martwego po ciszy — żywotność mierz commitami etapów,
  `mtime` plików i obecnością procesu.
- `pkill` / `killall` — zabijaj wyłącznie własne numery procesów.
- Wypisywanie haseł w logach, meldunkach i repo. Robotnicy nie logują się hasłem — dowody zapisu robi CTO.
- Włączanie `ENABLE_INITIATIVE_UNIFIED_READ` na stagingu przed dowodem zapisu i przed decyzją z §8 pkt 1.
- Zamykanie kryterium na podstawie dokumentu. **Rejestr jest hipotezą; PASS wymaga komendy albo zrzutu z dziś.**
