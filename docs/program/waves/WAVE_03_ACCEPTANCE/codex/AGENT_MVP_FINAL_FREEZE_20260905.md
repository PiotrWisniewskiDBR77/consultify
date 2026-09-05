# AGENT — mechanizm ZAMROŻENIA „MVP final" (2026-09-05)

Gałąź: `agent/mvp-final-freeze-20260905` (baza: `codex/m03-admin-20260824` @ `d10930ae74`)
Zakres: narzędzie + bezpiecznik + testy + procedura. **Żaden moduł nie został zamrożony** —
zgodnie ze zleceniem pokazany jest tylko `--dry-run` dla `13_CHAT`.

---

## 1. Co powstało

| Plik | Rola |
|---|---|
| `docs/program/MVP_FINAL_ZAMROZONE.json` | rejestr zamrożeń (dziś pusty: `moduly: {}`, `wspolne: null`) |
| `scripts/mvp-final/moduly.mjs` | mapa 16 modułów (korzenie · terytoria · katalogi zrzutów) + resolver importów + reguły przypisania plików |
| `scripts/mvp-final/zamroz.mjs` | `--modul=… --decyzja=…` → lista plików + kopia wzorców + wpis w rejestrze + tag git |
| `scripts/mvp-final/check-freeze.sh` | bezpiecznik: commit w zamrożony plik = odmowa, chyba że `[ODMROZENIE <MODUL> DEC-<nr>]` |
| `scripts/mvp-final/porownaj.mjs` | świeże zrzuty tych samych ekranów vs wzorce → tabela ZGODNY/RÓŻNI SIĘ + `diff.png` |
| `scripts/mvp-final/porownaj-obrazy.mjs` | silnik porównania PNG (wydzielony, testowalny bez przeglądarki) |
| `tests/unit/mvp-final/*.test.mjs` | 35 testów `node:test` (w tym dowód mutacyjny) |
| `docs/program/MVP_FINAL_PROCEDURA.md` | jedna strona po polsku dla właściciela |
| `.husky/commit-msg`, `.husky/pre-commit` | wpięcie bezpiecznika |
| `package.json` | `mvp-final:zamroz` · `mvp-final:porownaj` · `mvp-final:sprawdz` · `mvp-final:test`; 4 pliki dopisane do `test:node-native` |

---

## 2. Ustalenie, które zmieniło projekt bezpiecznika (zmierzone, nie założone)

Zlecenie mówiło „bezpiecznik do hooka **pre-commit**, czyta `.git/COMMIT_EDITMSG` lub `$1`".
Sprawdziłem to na żywym gicie, zanim napisałem kod:

```
$ git commit -m "DRUGI [ODMROZENIE X DEC-1]"
PRE-COMMIT widzi COMMIT_EDITMSG: [PIERWSZY]     ← komunikat POPRZEDNIEGO commita
```

Git zapisuje nowy `COMMIT_EDITMSG` **po** hooku `pre-commit`. Bramka czytająca go tam
przepuszczałaby zmianę na podstawie **cudzego, starego** napisu i blokowała na podstawie
innego — czyli byłaby czystym teatrem zgodności (ta sama klasa co `check-focus-canon.sh`
przed 02.08). Dlatego:

- **`.husky/commit-msg` — BLOKUJE** (dostaje prawdziwy komunikat jako `$1`),
- **`.husky/pre-commit` — TYLKO OSTRZEGA** (`--tylko-ostrzez`, zawsze `exit 0`), żeby autor
  dowiedział się wcześnie, zanim napisze komunikat.

Powód jest zapisany w komentarzu w obu hookach i w samym skrypcie — żeby nikt tego
„nie naprawił" z powrotem.

---

## 3. Jak wyznaczana jest lista plików modułu

Korzenie 16 modułów pochodzą z `canonical-16-module-bindings.json` (pole `component`)
zmapowanego przez lazy-importy w `src/routes/AppRoutes.tsx`. Test pilnuje, żeby mapa nie
rozjechała się z tym SSOT ani z katalogami `WAVE_03_ACCEPTANCE/modules/`.

Resolver: własny, prosty — `import/export … from`, `import()`, `require()`, alias `@/`,
ścieżki względne, `index.*`; pomija pakiety npm i importy zakomentowane; domknięcie
tranzytywne; kanonizacja wielkości liter przez `git ls-files` (macOS ma FS bez rozróżniania,
`admin` == `Admin` — git nie).

**Przypisanie pliku do właściciela — trzy reguły, w tej kolejności:**

- **R1 — terytorium.** Plik leży w zadeklarowanym katalogu modułu (np. `src/components/AIChat/`)
  i jest z niego osiągalny → należy do tego modułu.
- **R2 — wyłączność.** Plik osiągalny dokładnie z jednego modułu → należy do niego.
- **R3 — wspólne.** Reszta (osiągalne z ≥2 modułów spoza terytoriów) oraz ścieżki wymuszone
  (`src/components/standard/`, `shared/`, `ui/`, `store/`, `services/api`, `i18n`) → lista `wspolne`,
  zamrażana osobno `--modul=WSPOLNE`.

**Dlaczego R1 musiała powstać:** bez niej samo „osiągalne tylko z jednego modułu" dawało
dla Czatu **1 plik** — bo `MyWorkView` też sięga po `UnifiedChatPanel`, więc wszystkie 94 pliki
`src/components/AIChat/` lądowały jako „wspólne". Zamrożenie chroniące 1 plik to bezpiecznik
dający fałszywy spokój. Z R1 Czat ma 239 plików własnych.

**Poza zamrożeniem świadomie:** `__tests__/`, `*.test.*`, `*.spec.*`, `*.stories.*` —
zamrażamy produkt, nie dowód; testy wolno dopisywać zawsze.

---

## 4. `--dry-run` dla 13_CHAT (wynik na dziś)

```
$ node scripts/mvp-final/zamroz.mjs --modul=13_CHAT --dry-run \
    --zrodlo-zrzutow=/private/tmp/m03/evidence/odbior-zywo-20260905

MODUŁ: 13_CHAT — Czat
  plików własnych (zamrażanych): 239
  plików osiągalnych razem:      643
  z tego POZA zamrożeniem:       404 (w tym wspólnych: 381)
  katalogi zrzutów:              01-czat
  znalezionych zrzutów-wzorców:  12
```

Pierwsze pozycje listy: `src/components/AIChat/AIActionCard.tsx`, `AIOSHub.tsx`,
`ActionCenter.tsx`, `Actions/…`, `AgentPlan*` … (239 pozycji, całe `src/components/AIChat/`
+ `src/views/AIChatView.tsx`).

Poza zamrożeniem modułu zostają m.in. `src/actions/*` (rejestr akcji Idei), `src/components/Chat/*`,
`src/components/standard/*` — to lista `WSPOLNE`; oraz kilkanaście plików `src/components/MyWork/*`
i `src/components/Admin/*`, które należą do swoich modułów. Narzędzie mówi to wprost
przy każdym zamrożeniu — nie udaje, że chroni wszystko.

---

## 5. Stan wszystkich 16 modułów (pomiar `d10930ae74`, dziś)

| MODUŁ | pliki własne | osiągalne | poza (z tego wspólne) | zrzutów dziś |
|---|---|---|---|---|
| 01_ORGANIZATION (Organizacja) | 40 | 152 | 112 (107) | 21 |
| 02_INTERVIEW (Wywiad) | 42 | 640 | 598 (437) | 1 |
| 03_TOOLS (Narzędzia) | 291 | 692 | 401 (302) | 9 |
| 04_ASSESSMENT (Ocena) | 178 | 590 | 412 (301) | 25 |
| 05_INITIATIVES (Inicjatywy) | 98 | 467 | 369 (311) | 15 |
| 06_EXECUTION (Realizacja) | 47 | 448 | 401 (301) | 11 |
| 07_MY_WORK_AGENT (Moja praca / Agent) | 762 | 1368 | 606 (471) | 37 |
| 08_MEETINGS (Spotkania) | 2 | 175 | 173 (170) | **0** |
| 09_RESULTS (Wyniki) | 120 | 307 | 187 (177) | 19 |
| 10_FINANCE (Finanse) | 154 | 352 | 198 (195) | 13 |
| 11_MATERIALS (Materiały) | 51 | 250 | 199 (193) | 31 |
| 12_AUDITS (Audyty) | 34 | 183 | 149 (146) | 4 |
| 13_CHAT (Czat) | 239 | 643 | 404 (381) | 12 |
| 14_ADMIN (Administracja) | 101 | 306 | 205 (200) | 38 |
| 15_SETTINGS (Ustawienia) | 153 | 308 | 155 (153) | 8 |
| 16_PARTNER (Partner) | 28 | 172 | 144 (142) | **0 (brak katalogu)** |
| WSPOLNE (kanon) | 611 | — | — | **0 (brak `16-kanon`)** |
| **RAZEM** | **2951** | | | |

Uwagi do tabeli (stan faktyczny, nie prognoza):

- **08_MEETINGS = 2 pliki własne** to nie błąd narzędzia — moduł Spotkań składa się realnie
  z `MeetingHub.tsx` + `MeetingObjectPage.tsx`; reszta ekranu to komponenty wspólne.
- **Katalogi bez zrzutów na dziś:** `12-spotkania` (0), `19-logowanie` (0), brak katalogu dla
  Partnera i brak `16-kanon`. Zamrożenie tych modułów zapisze `wzorce: []` i **głośno ostrzeże** —
  wtedy `porownaj.mjs` odmawia pracy zamiast meldować fałszywe „ZGODNY".
- **`17-aios` i `19-logowanie`** nie należą do żadnego z 16 modułów (Internal Tools / ekrany przed
  zalogowaniem) — świadomie poza mapą.

---

## 6. Dowody

**Bezpiecznik, próba na żywym hooku (nie na atrapie):** dopisałem tymczasowy wpis
`13_CHAT` do rejestru, zmieniłem `src/components/AIChat/AIRoleBadge.tsx` i próbowałem
zapisać:

- bez znacznika → `⛔ COMMIT ZABLOKOWANY`, HEAD bez zmian;
- `[ODMROZENIE 13_CHAT DEC-999]` → commit przeszedł, `✅ … świadomy znacznik odmrożenia`.

Po próbie: `git reset --hard HEAD~1`, rejestr przywrócony, `git status` czysty — w `src/`
nie zostało nic.

**Testy:** `npm run mvp-final:test` → **35/35 PASS**.
Pokrycie: resolver na fixture (alias, index, dynamiczny import, re-export, zakomentowany
import, pakiet npm), kształt rejestru, zgodność mapy z `bindings.json` i katalogami WAVE_03,
istnienie każdego korzenia i terytorium, `--dry-run` nie dotyka rejestru, silnik porównania
PNG (zgodny / 1 piksel / próg / inne wymiary / powstanie `diff.png`), oraz bezpiecznik:
bez znacznika = 1, ze znacznikiem = 0, znacznik cudzego modułu = 1, znacznik bez `DEC-` = 1,
dwa moduły = dwa znaczniki, `WSPOLNE` też blokuje.

**Dowód mutacyjny** (`checkFreeze.test.mjs`, ostatni test): w kopii skryptu w osobnym worktree
wycinam (1) porównanie staged×rejestr i (2) warunek znacznika — po każdej mutacji guard
**przepuszcza** (test to sprawdza), po przywróceniu **znowu blokuje**. Test celuje w samo
zabezpieczenie, nie w mechanizm dookoła.

**`npm run test:node-native`: 128/134 PASS, 6 FAIL.** Te 6 to dług **ZASTANY** — zmierzone,
nie założone: te same 6 testów pada tak samo na czystym `d10930ae74` w osobnym worktree
(`report-worktree-inventory`, 3× `wave3/verify-acceptance-packages*`, `report-acceptance-gates`,
`checkActionsStagedScope`). Moje 4 pliki testowe przechodzą w tym przebiegu w całości.

---

## 7. Jak tego użyć 05.09 (dla nadzorcy)

```
# po „tak" właściciela na module:
node scripts/mvp-final/zamroz.mjs --modul=13_CHAT --decyzja="<słowa właściciela>" \
  [--zrodlo-zrzutow=<katalog ze zrzutami odbioru, jeśli w innym worktree>]

# gdy odebrane są WSZYSTKIE moduły (nie wcześniej — inaczej blokuje pracę nad nieodebranymi):
node scripts/mvp-final/zamroz.mjs --modul=WSPOLNE --decyzja="..."

# przed pokazem / po zmianie w komponentach wspólnych:
ODBIOR_AUTH_STATE=<plik> node scripts/mvp-final/porownaj.mjs --modul=13_CHAT
```

`zamroz.mjs` zakłada tag `mvp-final-<MODUL>-<data>` lokalnie i **nie robi push** — wypycha
nadzorca sesji głównej.

---

## 8. Czego to narzędzie NIE robi (uczciwie)

1. **Nie chroni przed zmianą w komponentach wspólnych**, dopóki nie zamrozisz `WSPOLNE`.
   Dlatego `zamroz.mjs` przy każdym module drukuje, ile plików zostaje poza ochroną.
2. **Nie broni przed `--no-verify`.** Hook to hamulec dla uczciwego wykonawcy i dla agenta,
   nie zapora przed kimś, kto świadomie ją omija. Twardą zaporą byłaby dopiero bramka CI
   na tym samym skrypcie (`check-freeze.sh` przyjmuje listę plików i komunikat, więc da się
   ją wpiąć w CI bez zmian) — poza zakresem tego zlecenia.
3. **`porownaj.mjs` nie został uruchomiony end-to-end** — wymaga działającej aplikacji na
   `localhost:3000` i `ODBIOR_AUTH_STATE`. Przetestowany jest jego silnik porównania
   (7 testów na wygenerowanych PNG) i ścieżki odmowy (brak wzorców / brak `ODBIOR_AUTH_STATE`
   → wyjście 2 z komunikatem, nigdy ciche „ZGODNY").
4. **Kliki opisowe w `wyniki.json`.** Część wpisów odbioru na żywo ma `kliki` w postaci opisu
   (`"wiersz pomysłu"`), nie selektora Playwrighta. `porownaj.mjs` zamienia je na `text=…`
   i **oznacza taki ekran ostrzeżeniem** „odtworzenie ekranu niepewne" — zamiast udawać pomiar.
5. **Ekran bez `trasa` w `wyniki.json`** dostaje werdykt `BRAK_TRASY`, a ekran, którego zrzut się
   nie udał — `BLAD_ZRZUTU`. Podsumowanie liczy je jako **„NIE ZMIERZONO"** i mówi wprost,
   że to nie jest „zgodny".
