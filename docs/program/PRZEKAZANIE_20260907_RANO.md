# PRZEKAZANIE — 07.09.2026 rano (sesja Fable #25 → #26)

Nocną zmianę 06/07.09 prowadziła sesja #25 (Szampan 3). Właściciel spał; rano ma JEDNO zbiorcze przejście odbiorcze.
Ten plik = jedyny punkt wejścia. Poprzedni: `PRZEKAZANIE_20260906_NOC.md` (nieaktualny poza §4–§5 procedur).

## 0. Pierwsze 5 minut
1. Przeczytaj do końca, potem rejestr `docs/program/PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`
   (nowe wiersze NAD kotwicą `| 1.5 P8 (wklejka 2) |`; czas z `date '+%H:%M'`; wiersze pisz skryptem Pythona
   z `# -*- coding: utf-8 -*-` uruchamianym przez `PYTHONIOENCODING=utf-8`, heredoc CYTOWANY (`<<'EOF'`),
   **bez odwrotnych apostrofów w treści** — niecytowany heredoc wykonuje je jako polecenia i zjada identyfikatory).
2. **KARTA ODBIORU DLA WŁAŚCICIELA (gotowa, czeka):** https://claude.ai/code/artifact/4aa0efd8-89df-4502-b3cf-0320b170dc37
   — 20 ekranów z odnośnikami do ŻYWEGO stagingu, 4 decyzje z rekomendacją, 5 rzeczy niegotowych.
3. **Arkusz właściciela:** `docs/program/plan-pojemniki/stan.json` → `node scripts/dev/plan-pojemniki/generuj.mjs`
   → kopia `PANEL.html` do scratchpadu → Artifact z `url=https://claude.ai/code/artifact/2a86e4bf-46b5-4056-a472-264dc4a26da6`
   (ZAWSZE ten url; **narzędzie ZAŻĄDA przeczytania żywej wersji w CAŁOŚCI przed publikacją** — 2131 linii, czytaj porcjami po 600).
4. Katalog pracy `/private/tmp/m03` (gałąź `codex/m03-admin-20260824`), bare `/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git`.
   Stanowisko: API 4100, vite 3090 (zrestartowane 23:22 na kodzie nocy), PG 54400, sesja `/private/tmp/stanowisko-noc/auth.json` (tylko odczyt).
5. Dysk: ~90 GB wolne po sprzątnięciu worktree. `df -h /private/tmp` przed każdym `worktree add`. NIE ruszaj `~/Developer/FizzUp*`.
6. Pamięć: `premisa-z-rejestru-czesto-falszywa` (ZACZNIJ TU), `bramka-mierzaca-echo`, `zero-commitow-nie-jest-dowodem-smierci`,
   `zasady-pracy-nadzorcy`, `zasada-minimum-fable`, `zadania-do-akceptacji-zrozumiale`.

## 1. Stan na 00:45
- **Staging: paczka 18 `996a0d265b`** (wdrożenie w toku o 00:43; poprzednie potwierdzone: 14b `7c5f57de48`, 15 `a05a749fcc`, 16 `13f70a2a91`, 17 `e485b08fd4`).
  Dowód = health gitSha, ZAWSZE odczytany, nigdy przyjęty z meldunku.
- **Migracja statusów inicjatyw WYKONANA na danych właściciela i zweryfikowana pomiarem PO:**
  11 wartości zastanych → 6 docelowych, **173 wiersze przed = 173 po, zero strat**
  (DRAFT 88, IN_EXECUTION 36, REJECTED 17, APPROVED 11, PENDING_APPROVAL 11, CLOSED 10).
- **Sceptyk odbioru:** 51 wytycznych → 25 DONE, 13 PARTIAL, 1 NOT, 4 NIEMIERZALNE, 5 W TOKU, 3 odebrane słowem.
  Jedyne NOT (Realizacja pokazywała 12 wierszy „Zatwierdzona" zamiast inicjatyw w toku) — NAPRAWIONE, 23 wiersze, obejrzane przez CTO.
- **Cztery awarie zatrzymane przed pilotażem** (żadnej nie było w kolejce nocy):
  1. `kpiAttributionService` zawsze trafiał mnożnik domyślny → **atrybucja KPI liczyła się źle dla każdej inicjatywy**, cicho.
  2. Seed demo padał na PIERWSZEJ inicjatywie, zostawiając bazę: 2 org / 19 użytkowników / 7 projektów / **0 inicjatyw**.
  3. Świeża baza demo wstawała **cicho uszkodzona** (CHECK zawężony o `document_template` i `assessment_report`).
  4. Ekran Inicjatyw pokazywał **trzy różne liczby tego samego zbioru naraz** (72 / 63 / 60) → teraz 60/60/60 zgodne z bazą.

## 2. CZTERY DECYZJE CZEKAJĄCE NA WŁAŚCICIELA (w karcie odbioru, rekomendacja = opcja A)
| # | Sprawa | Rekomendacja CTO |
|---|---|---|
| 1 | Spotkanie pokazowe istnieje w bazie, ale moduł Spotkań jest za flagą OFF (DEC-437 × DEC-425) | zostawić — rekord czeka na Falę 2 |
| 2 | Organizacja DBR77: **31 użytkowników, 1 wiersz `organization_members`** (zweryfikowane własnym zapytaniem) | najpierw zmierzyć, co ta luka psuje, potem naprawiać |
| 3 | Poślizg +40 dni, a wskaźnik RAG mówi „na czas" | RAG ma uwzględniać poślizg od planu bazowego |
| 4 | Produkt = trzy rodziny wizualne kart; „Pracuj z AI" na 9 z 31 | ujednolicić TYLKO to, co nie jest decyzją właściciela (DEC-435/436 zostają) |

## 3. Kolejka (w tej kolejności)
1. **Przejście odbiorcze z właścicielem** po karcie z §0.2; po każdym „Tak" → wiersz w rejestrze + `stan.json`.
2. **PILNE przed pilotażem: deduplikacja po tytule ukrywa realne dokumenty** — drugi „Nowy dokument" z poprawnymi wpisami
   w bazie NIE pojawia się na liście (`duplicateCount: 2`). Przy czterech osobach każdy kolejny zniknie pod poprzednim.
3. **Demo: wdrożyć build z migracją `20262105_seed_business_templates_origin_runtime_repair.sql`** przed pilotażem.
   Demo stoi na starszym wydaniu (`f3237e94`) i jako JEDYNE środowisko ma działający runner bootowy (`DB_MANAGED_SCHEMA` bez `off`).
4. **Wklejka dla Codexa: ujednolicenie rodziny „dokument/kreator"** (po decyzji nr 4). Lista kart w `GALERIA_KART_20260907.md`.
5. Skrypt porządków w danych (`server/scripts/napraw-jezyk-i-czlonkostwo.ts`) — **gotowy, przetestowany na sucho na obu bazach, NIEURUCHOMIONY**. Czeka na zgodę właściciela.
6. Kolumny „Poziom" i „Przypisany" puste w każdym wierszu Realizacji — ustalić: dane czy brak podłączenia.
7. STOP z R3: testy realdb bramki zamknięcia nieuruchomione (analiza statyczna, nie pomiar) — dogonić.
8. Poza zakresem: 1.9 re-audyt, S1.11 zamrożenie tagami, S1.12 przekazanie pojemnik 2, Fala 2.

## 4. Procedura odbioru i pushu (ZMIENIONA — dwa nowe kroki)
1. Zrzut z `evidence/` obejrzeć samemu (Read); `.png.json`: `url` ≠ `/login`, brak `dev-render`, `bledyKonsoli`.
   **Metadane to za mało — patrz na ekran jako CAŁOŚĆ, nie na punkt z listy.** Audytor miał 47 zrzutów i przegapił
   trzy defekty widoczne w minutę; robotnik galerii zameldował 20/20 i nie połączył z werdyktem sprzeczności liczników
   widocznej na własnym zrzucie.
2. `git merge --no-ff <gałąź> -m "… [ODMROZENIE <MODUL> DEC-<n>] …"` — nazwy **TYLKO** z `docs/program/MVP_FINAL_ZAMROZONE.json`.
   **Modułu `09_RESULTS` tam NIE MA** (numeracja skacze 08→11) — pomyliłem się w tym dwa razy jednej nocy.
   Sprawdzaj przynależność KAŻDEGO pliku osobno, nie nadawaj jednego znacznika całej paczce.
3. Drzewo: BASE = `git merge-base HEAD^1 <tip>`; `git diff HEAD <tip> -- <pliki gałęzi>` = 0. Szeroki diff (`-- src server docs`) liczy CUDZE zmiany i kłamie.
4. `git worktree remove --force <worktree>` po scaleniu; wiersz w rejestrze.
5. **BRAMKA PRZED PUSHEM — 6 kroków:**
   - **KROK 0 (NOWY): czystość drzewa m03** — `git status --short | grep -cE '^ D|^ M'` = **0**.
     Tej nocy zniknęło stamtąd 38 śledzonych plików konfiguracyjnych (`index.html`, `tsconfig.json`, `CLAUDE.md`…),
     **przyczyny nie ustalono**; odzyskane przez `git checkout -- .`.
   - `git ls-remote origin staging` + `gh run list --workflow=railway-deploy.yml --limit 1` (nic nie buduje?).
   - `cd server && NODE_OPTIONS=--max-old-space-size=3072 ../node_modules/.bin/tsc -p tsconfig.build.json --noEmit > log 2>&1; echo EXIT=$?`
   - **PEŁNY** `NODE_OPTIONS="--max-old-space-size=6144" npm run build > log 2>&1; echo EXIT=$?` + `grep -c "built in" log`.
     **NIGDY przez potok** — `npm run build | tail -3; echo KONIEC` daje status ECHA, nie builda; tej nocy build padł, a bramka pokazała 0.
   - łańcuch migracji na 54400; nazwy nowych migracji datowane **≥ 20262107** (`20262105` i `20262106` zajęte).
6. Push: `git push origin HEAD:staging` + `gh workflow run railway-deploy.yml --ref staging -f environment=staging`;
   dowód = health gitSha. Po scaleniu Codexa: `git push github-backup codex/m03-admin-20260824:codex/m03-admin-20260824`.

## 5. Zlecanie robotników — co zmieniło się tej nocy
Worktree: `git -C <bare> worktree add -b mvp/<id> /private/tmp/wt-<id> <sha>; printf '[core]\n\tbare = false\n' > <bare>/worktrees/wt-<id>/config.worktree; ln -s /private/tmp/m03/node_modules /private/tmp/wt-<id>/node_modules; git -C /private/tmp/wt-<id> config core.hooksPath .husky`

**KROK 0 w KAŻDYM zleceniu: „zmierz premisę sam; jeśli jest fałszywa, napisz to wprost i zatrzymaj się — fałszywa premisa jest cennym wynikiem, nie porażką".**
Tej nocy obaliło to CZTERY tezy z naszych dokumentów, za każdym razem prawda była poważniejsza.

**Zakaz musi mieć POWÓD i ZAMIENNIK**, inaczej robotnik sięga po najwygodniejsze narzędzie:
- `git stash` — ZAKAZ, bo stos jest **wspólny dla wszystkich worktree i sesji**; zamiennik: `git show <ref>:<plik>` albo drugi checkout w katalogu tymczasowym. (Jeden robotnik złamał ten zakaz; stos wrócił pusty, bez szkód.)
- `/private/tmp/m03` — ZAKAZ dotykania czymkolwiek, także odczytem (po incydencie 38 plików).
- `pkill` — ZAKAZ, na maszynie żyją cudze procesy; własne vite z zakresu 3101–3199, zamykać po PID.
- 54400 — odczyt tak, ZAPIS nie (dane właściciela); własna baza w kontenerze, port z przydzielonego zakresu, usunąć po pracy.

**Dowód na realnej bazie wymaga KOMPLETU flag**: `NODE_ENV=test` BEZ `RUN_DB_TESTS=1` i `MOCK_DB=false` podstawia ATRAPĘ — robotnik dostał dwa fałszywe „zielono", zanim to wychwycił.

**Sprawdź rodzeństwo defektu** przed uznaniem pracy za skończoną: naprawa Realizacji miała DWIE przyczyny (sam filtr dałby 0 wierszy zamiast 23); seed demo to nie jeden plik, tylko kopia słownika + 10 plików rodzeństwa.

Meldunek: POMIAR → PRZYCZYNA (plik:linia) → NAPRAWA → DOWÓD → SHA → ZNALEZISKA → STOP-y → CO ZOSTAJE NIEDOMKNIĘTE.

## 6. Komunikacja z właścicielem
Krótko, po polsku; jeden żywy obraz + Tak/Nie + jedno zdanie; decyzje w trybie pytanie–odpowiedź z rekomendacją jako pierwszą opcją.
**Nie pokazuj niczego, czego sam nie obejrzałeś** — w karcie odbioru kolumna ✓ oznacza pozycje obejrzane przez CTO osobiście; rozróżnienie jest jawne.
**Konfrontuj pomiar z rejestrem decyzji**: „trzy niespójne rodziny kart" byłoby krzywdzące bez zastrzeżenia, że część tej niespójności to DEC-435/436 właściciela.
Wklejki dla Codexa w bloku kodu (właściciel = listonosz). Uczciwość ponad optymizm: sesja #25 wpisała do rejestru **cztery własne sprostowania**, w tym dwa błędy nadzorcy.
