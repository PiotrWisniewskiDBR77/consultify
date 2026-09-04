# INSTRUKCJA DYŻURU nr 315 — Codex — „★★★ ZERO SCALENIA BEZ AKCEPTU WLASCICIELA — praca zostaje na galezi. Dyzur 311 zszedl z crimsonem w Czacie prawie do zera, ale ODDAL DOWOD, KTORY NICZEGO NIE DOWODZI: dziesiec z szesnastu par zrzutow jest BAJTOWO IDENTYCZNYCH, a dwa ekrany macierzy to ten sam obraz pod dwiema nazwami; przyczyna nie lezy w kodzie, tylko w KADRZE — komponenty niosace crimson nie maja ani jednego ekranu dev-render. Ten dyzur (1) klasyfikuje KAZDE pozostale trafienie `primary-` w Czacie i rozstrzyga, ktore z nich jest w ogole kolorem (na markerze piec z dziesieciu poza testami to komentarz, `data-testid` albo literal), (2) naprawia realny crimson: PIEC linii, a w nich SIEDEM tokenow klas, w trzech plikach — `group-focus-within:text-primary-500` w ConversationSearch, `hover:bg-primary-100` + `focus:ring-primary-400/50` w PrivateModeDetails, `focus:border-primary-500` x3 w ProjectMembersModal — bo lamia punkt 3 kodeksu UI (czerwien tylko semantyka krytyczna, fokus `c-focus`), (3) ZAMYKA ZMIERZONA DZIURE W BEZPIECZNIKU: wzorzec `check-focus-canon.sh` lapie wylacznie `ring-`/`outline-`/`ring-offset-primary-*`, wiec dwa z tych trzech plikow sa dla bramki NIEWIDZIALNE, (4) buduje EKRANY, ktorych brakuje, wedlug gotowej recepty z `teresa-confirm-chip` (jedyny ekran Czatu montujacy realny `MessageRenderer`), (5) rozstrzyga martwe poddrzewo `src/components/AIChat/AgentAudit/` — usunac czy podlaczyc, (6) oddaje pary PRZED/PO, w ktorych ZADNA para nie jest bajtowo identyczna, z suma kontrolna i srednia jasnoscia, gotowe do pokazania wlascicielowi. ★ Semantyka krytyczna (ramka bledu AI, etykiety „Blokada”/„Krytyczny”) ZOSTAJE — nie ruszasz."

Dokument samodzielny. Zakładam, że dostajesz **TYLKO ten plik** i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
poprzednich dyżurów. Wszystko, czego potrzebujesz, jest poniżej albo pod
wskazanymi ścieżkami w repo.

> ### ★★ ZAKAZ NR 1 — KATALOG WŁAŚCICIELA. CZYTASZ TO, ZANIM URUCHOMISZ COKOLWIEK.
>
> **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani
> do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`,
> ani `git fetch`, ani `git worktree add`.
> To brudny checkout właściciela produktu i jest **NIETYKALNY**.
> Jedyny dozwolony kontakt z tą ścieżką to **symlink `node_modules` (odczyt)**
> wg `DEC-2026-08-26-86`.
>
> **★★ TO JEST NAJCZĘSTSZA PRZYCZYNA STRACONEJ GODZINY W TYM PROGRAMIE.**
> Instrukcja dyżuru 53 kazała wykonać `git fetch --all` i `git worktree add`
> „w root-repo" — wykonawca zrobił to w katalogu właściciela, `Z5` zablokowało
> pracę i dyżur stanął na STOP-ie, który nie miał prawa powstać.
> **Dlatego w `§0.1` masz PEŁNĄ, DOSŁOWNĄ procedurę worktree Z VAULTA.**
> Nie improwizuj jej i nie zastępuj „swoim sposobem". Twoje miejsce pracy to
> **wyłącznie** `/private/tmp/cx-day315-crimson-ekrany`.

> ### ★★ MARKER I STAN WYDANIA
>
> **SHA markera: `bc18bc7acac2ec825ebb3db2f1309738ab034d58`**
> **Gałąź bazowa: `github-backup/grafika/m03-20260902`**
> **Stan dokumentu: WYDANY**
>
> Jeżeli w polu „Stan dokumentu" widzisz `WYDANY` — możesz zaczynać.
> Jeżeli widzisz `PROJEKT` albo jakiekolwiek niewypelnione pole szablonu — **dokument nie
> jest wydany, nie zaczynasz i zgłaszasz to nadzorcy**.
> Ta ramka jest **jedynym** miejscem, w którym rozstrzyga się stan wydania.
> Objaśnienia w innych blokach cytowanych **nie** są powodem do STOP-u.

Data wystawienia: 2026-09-04.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.
Zakres: ****13_CZAT — crimson poza semantyka krytyczna, domkniecie dowodowe dyzuru 311.** Punkt 3 kodeksu UI: w konfiguracji Tailwinda `primary` to crimson `#85182F`, wiec KAZDY numer `primary-*` daje czerwien; czerwien wolno uzyc wylacznie jako semantyke krytyczna, a pierscien fokusu ma byc niebieski (`c-focus`). Dyzur 311 (scalony, `540d15829b`) zszedl z 262 wystapien do resztki i semantyki krytycznej nie ruszyl — to bylo zrobione dobrze. Zle byl DOWOD: szesnascie plikow zrzutow, z czego dziesiec par PRZED=PO co do bajtu, plus dwa wpisy macierzy (`canvas-kebab-restructure`, `canvas-toolbar-md-history`) renderujace ten sam obraz. Wlasciciel nie moze na tym oprzec zadnej decyzji. Ten dyzur domyka trzy rzeczy naraz: resztke crimsona (fokus i hover, ktore lamia kanon), DZIURE W BEZPIECZNIKU, ktora te resztke przepuszcza, i BRAK EKRANOW, ktory uniemozliwia pokazanie czegokolwiek wlascicielowi.**.
Trasy front: `Realny crimson do naprawy (5 linii, 7 tokenow klas, 3 pliki): `src/components/AIChat/ConversationSearch.tsx` (`group-focus-within:text-primary-500`), `src/components/AIChat/PrivateModeDetails.tsx` (`hover:bg-primary-100`, `dark:hover:bg-primary-900/40`, `focus:ring-primary-400/50` — trzy tokeny w jednej linii `className`), `src/components/AIChat/ProjectMembersModal.tsx` (`focus:border-primary-500` w trzech polach formularza). Falszywe trafienia grepa do KLASYFIKACJI, nie do naprawy: `AiProviderErrorNotice.tsx` (komentarz), `InlineResponseFeedback.tsx` (komentarz), `src/components/AIChat/KimiWorkspace/ExceleRightPanel.tsx` (komentarz), `ChatSignalsPanel.tsx` (`data-testid=„chat-signal-primary-action”`), `Wave9OutcomeAIOpsPanel.tsx` (`provider: 'primary-llm'`). Semantyka krytyczna — NIE RUSZASZ: `AiProviderErrorNotice.tsx` (ramka bledu AI, tokeny `c-danger`) i etykiety „Blokada”/„Krytyczny” w `ChatSignalsPanel.tsx`. Baza ekranow: `dev-render/screens/teresa-confirm-chip.tsx` (jedyny ekran Czatu montujacy REALNY `MessageRenderer`), `chat-blad-ai.tsx`, `chat-signals-feed.tsx`, `chat-split-teresa-right.tsx`, `teresa-chipy-sugestii.tsx`, `canvas-new-doc.tsx`, `canvas-kebab-restructure.tsx`, `canvas-toolbar-md-history.tsx`; macierz `scripts/dev/g06-macierz-ekrany.json`, klucz `13_CHAT`. Powierzchnie do odsloniecia w `src/components/AIChat/MessageRenderer.tsx`: `ResearchProgress` (warunek `hasDeepResearchProgress`), `msg.options`, CTA deep-thinking, `abortFeedback`, tresc z `⚠️`. Naglowek czatu: `src/components/AIChat/V8ArtifactRunControl.tsx`, renderowany bezwarunkowo z `src/components/AIChat/UnifiedChatPanel.tsx`. Martwe poddrzewo do rozstrzygniecia: `src/components/AIChat/AgentAudit/` (3 pliki). Bezpiecznik: `scripts/check-focus-canon.sh` + `scripts/check-focus-canon.baseline.txt`. Kanon: `docs/ui-standards/TRIADA_KANON.md`.`. Trasy tył: `Brak zmian po stronie serwera. Jezeli natrafisz na kolor wysylany z serwera (konfiguracja motywu, dane szablonu, kolor w odpowiedzi API), wypisujesz to jako znalezisko z nazwa pliku i trasy oraz gotowa rekomendacja jako diff w bloku kodu — nie naprawiasz tego tutaj.`.

---

### 0.1. ★★ BAZA PRACY, MARKER I GAŁĄŹ — PROCEDURA DOSŁOWNA, Z VAULTA

**Repozytorium, z którego pracujesz, to BARE-vault, a nie checkout właściciela:**

```
/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
```

Vault ma `extensions.worktreeConfig=true`. **To ma konsekwencję operacyjną,
którą MUSISZ obsłużyć — krok (4).**

**PIERWSZE KOMENDY DYŻURU — wklej dokładnie tak, po kolei:**

```bash
VAULT=/Users/piotrwisniewski/Developer/consultify-recovery-vault-20260820.git
WT=/private/tmp/cx-day315-crimson-ekrany
MARKER=bc18bc7acac2ec825ebb3db2f1309738ab034d58

# (0) miejsce na dysku — ponizej 5 GB wolnego to STOP calego dyzuru
df -h /

# (1) fetch WYLACZNIE z github-backup — NIGDY `--all`
git -C "$VAULT" fetch github-backup --prune

# (2) marker
git -C "$VAULT" log --oneline -25 github-backup/grafika/m03-20260902
git -C "$VAULT" merge-base --is-ancestor "$MARKER" github-backup/grafika/m03-20260902 \
  && echo "MARKER OK" || echo "MARKER BRAK"

# (3) worktree — TWORZONY Z VAULTA, nigdy z katalogu wlasciciela
git -C "$VAULT" worktree add "$WT" -b codex/day315-crimson-ekrany-20260904 "$MARKER"

# (4) ★★ BEZ TEGO GIT ODMOWI PRACY W WORKTREE (vault jest BARE)
printf '[core]\n\tbare = false\n' > "$VAULT/worktrees/cx-day315-crimson-ekrany/config.worktree"
cat "$VAULT/worktrees/cx-day315-crimson-ekrany/config.worktree"   # ma wypisac dwie linie

# (5) node_modules przez SYMLINK — jedyny dozwolony kontakt z katalogiem
#     wlasciciela (DEC-2026-08-26-86, odczyt)
ln -s /Users/piotrwisniewski/Developer/Consultify/node_modules "$WT/node_modules"

# (6) katalogi pomocnicze POZA repo (Z13)
mkdir -p /private/tmp/cx-day315-crimson-ekrany-scratch
mkdir -p /private/tmp/cx-day315-crimson-ekrany-artefakty

# (7) sanity
git -C "$WT" rev-parse HEAD
git -C "$WT" status --short | head -3
```

**Wynik komend (2) i (7) wklejasz do raportu dosłownie.**

> **★★ PUŁAPKA — REMOTE `icloud-source` JEST MARTWY.**
> Vault ma trzy remote'y: `github-backup` (żywy, jedyny Twój),
> `origin` (**zakazany do pushu**, `Z1`) i `icloud-source`, wskazujący na
> nieistniejący katalog `/private/tmp/consultify-staging-deploy-e6ca`.
> **Dlatego NIE WOLNO Ci wołać `git fetch --all`.**
> **Błąd `icloud-source` przy jakimkolwiek fetchu NIE JEST negatywnym wynikiem
> markera i NIE JEST powodem do STOP-u.** Jedynym negatywnym wynikiem markera
> jest napis `MARKER BRAK` z komendy `merge-base` powyżej.

**★★ REGUŁA ROZEJŚCIA (`DEC-2026-08-26-95`).**
Jeżeli marker **nie jest** przodkiem tipa albo gałąź nie istnieje — **STOP
całego dyżuru**. Nie improwizujesz bazy: nie startujesz z `origin/demo`,
`main`, `Londyn`, `codex/preserve-*`, `codex/day*-instrukcja-*` ani z żadnej
gałęzi cudzych dyżurów.

Jeżeli marker **JEST** przodkiem, ale **tip uciekł do przodu — to NIE jest
STOP**. Startujesz **dokładnie z markera**, a do raportu wpisujesz:

```bash
git -C "$VAULT" log --oneline bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
git -C "$VAULT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..github-backup/grafika/m03-20260902
```

Scalenie z nowszym tipem wykonuje **nadzorca przy odbiorze**.
**Rebase w trakcie dyżuru: ZAKAZANY** (`Z3`).

**★★ PUSH PO PIERWSZYM COMMICIE** (`Z34a`), nie na koniec:

```bash
git -C "$WT" push github-backup codex/day315-crimson-ekrany-20260904
```

Powtarzasz go **po każdej kolejnej pozycji**.

**Komenda bazowa dla listy plików, które dotknąłeś** (do `§0.4a`):

```bash
git -C "$WT" diff --name-only bc18bc7acac2ec825ebb3db2f1309738ab034d58..HEAD
```

**WERYFIKACJA STANU WEJŚCIOWEGO — `9` komend, wszystkie obowiązkowe.**
Każda ma podany **oczekiwany wynik autora instrukcji**; rozbieżność idzie do
„Korekt wobec instrukcji", **nie do improwizacji**.

```bash
cd "$WT"

# (1) TEZA: crimson w Czacie po dyzurze 311 to 15 trafien w 9 plikach,
#     ale WIEKSZOSC to FALSZYWE TRAFIENIA grepa
git grep -c 'primary-' -- src/components/AIChat
git grep -n 'primary-' -- src/components/AIChat | grep -v '__tests__' | wc -l
#   oczekiwane autora: 9 plikow / 15 trafien lacznie; 10 trafien poza testami.
#   ★ Z tych 10 az PIEC to NIE JEST kolor: komentarz w AiProviderErrorNotice.tsx,
#   komentarz w InlineResponseFeedback.tsx, komentarz w ExceleRightPanel.tsx,
#   `data-testid="chat-signal-primary-action"` w ChatSignalsPanel.tsx i literal
#   `provider: 'primary-llm'` w Wave9OutcomeAIOpsPanel.tsx.
#   ★ Zamowienie nadzorcy mowi „22 wystapienia" — ZMIERZ SAM i zapisz roznice.

# (2) TEZA: realny crimson renderowany to PIEC LINII / SIEDEM TOKENOW KLAS w TRZECH plikach
git grep -n 'primary-' -- src/components/AIChat | grep -v '__tests__' | grep -E 'className'
#   oczekiwane autora: PIEC linii, a w nich SIEDEM tokenow klas. ConversationSearch.tsx (`group-focus-within:text-primary-500`),
#   PrivateModeDetails.tsx (`hover:bg-primary-100`, `dark:hover:bg-primary-900/40`,
#   `focus:ring-primary-400/50` — TRZY tokeny w JEDNEJ linii), ProjectMembersModal.tsx
#   (`focus:border-primary-500` x3). ToolsMenu, MoveToProjectModal i CloudFilePicker: ZERO.

# (3) TEZA: bramka fokusu NIE WIDZI dwoch z trzech tych plikow
grep -n 'VIOLATION_RE=' scripts/check-focus-canon.sh
grep -n 'PrivateModeDetails\|ConversationSearch\|ProjectMembersModal' scripts/check-focus-canon.baseline.txt
bash scripts/check-focus-canon.sh --ci 2>&1 | tail -3
#   oczekiwane autora: wzorzec bramki lapie WYLACZNIE `ring-primary-*`, `outline-primary-*`
#   i `ring-offset-primary-*`; w baseline jest TYLKO PrivateModeDetails (1 wystapienie),
#   bo `focus:border-primary-500` i `group-focus-within:text-primary-500` sa POZA wzorcem.
#   Bramka mowi „OK, baseline 41 plikow / 60 wystapien" i ma racje wobec wlasnego wzorca.
#   ★ To jest DZIURA W POMIARZE, nie zielone swiatlo. Zapisz ja.

# (4) TEZA: 10 z 16 par dowodowych dyzuru 311 jest BAJTOWO IDENTYCZNYCH
cd evidence/grafika/crimson-czat-20260903
for f in *__PRZED__*.png; do po="${f/__PRZED__/__PO__}"; \
  [ -f "$po" ] && [ "$(shasum -a 256 "$f" | cut -d' ' -f1)" = "$(shasum -a 256 "$po" | cut -d' ' -f1)" ] \
  && echo "IDENTYCZNE: $f"; done | wc -l
shasum -a 256 canvas-kebab-restructure__PO__pl__1440__light.png canvas-toolbar-md-history__PO__pl__1440__light.png
cd "$WT"
#   oczekiwane autora: liczba 10 (dziesiec par PRZED=PO co do bajtu na szesnascie plikow); dodatkowo `canvas-kebab-restructure`
#   i `canvas-toolbar-md-history` to TEN SAM OBRAZ pod dwiema nazwami (w obu motywach).
#   Roznia sie tylko: chat-blad-ai, chat-split-teresa-right, teresa-chipy-sugestii (po 2 motywy).

# (5) TEZA: komponenty niosace crimson NIE MAJA ekranu dev-render
for k in ConversationSearch PrivateModeDetails ProjectMembersModal ResearchProgress \
         V8ArtifactRunControl MoveToProjectModal CloudFilePicker; do
  printf '%-24s -> %s\n' "$k" "$(grep -rl "$k" dev-render/screens/ 2>/dev/null | tr '\n' ' ')"
done
#   oczekiwane autora: WSZYSTKIE siedem bez ekranu (pusta prawa strona). Dlatego para PRZED/PO
#   nie mogla niczego pokazac — nie dlatego, ze zmiany nie bylo.

# (6) TEZA: `teresa-confirm-chip` montuje REALNY MessageRenderer — to jest Twoja baza
grep -n 'MessageRenderer' dev-render/screens/teresa-confirm-chip.tsx | head -6
grep -n 'hasDeepResearchProgress\|researchProgress' src/components/AIChat/MessageRenderer.tsx | head -6
grep -n 'abortFeedback\|deepThinking\|⚠️' src/components/AIChat/MessageRenderer.tsx | head -12
grep -n 'V8ArtifactRunControl' src/components/AIChat/UnifiedChatPanel.tsx
#   oczekiwane autora: ekran montuje `<MessageRenderer>` dwa razy z gotowym zestawem propsow;
#   warunek `hasDeepResearchProgress(msg.metadata?.researchProgress)` stoi w MessageRenderer.tsx
#   przy ~831, komponent `<ResearchProgress ...>` przy ~838; `abortFeedback` ~1718;
#   `⚠️` w tresci ~1810; CTA deep-thinking ~2363 i ~2401; `V8ArtifactRunControl` renderowany
#   BEZWARUNKOWO w UnifiedChatPanel.tsx ~6825. ★ NUMERY LINII SIE PRZESUWAJA — trafiaj GREPEM.

# (7) TEZA: `AgentAudit/` to martwe poddrzewo (3 pliki), mimo ze funkcja audytu ZYJE
git grep -n 'AgentSuggestionCard\|AgentAuditVerdictPanel' -- src dev-render | grep -v '/AgentAudit/'
ls src/components/AIChat/AgentAudit/
#   oczekiwane autora: ZERO importow spoza katalogu — komponenty sa re-eksportowane wylacznie
#   przez wlasny `index.ts`, ktorego nikt nie importuje. Jednoczesnie funkcja audytu agentow
#   ZYJE w MessageRenderer/UnifiedChatPanel pod innymi nazwami. To jest ksztalt „martwe
#   poddrzewo niewidoczne per-plik": metoda „plik bez importera" liczy import wewnatrz
#   martwego katalogu jako zywy. ROZSTRZYGNIJ: usunac czy podlaczyc.

# (8) TEZA: `wave3-creators-crimson` to swatch, nie produkt
head -30 dev-render/screens/wave3-creators-crimson.tsx
#   oczekiwane autora: wlasny komentarz pliku przyznaje, ze to statyczna probka kolorow.
#   Swatch NIE JEST dowodem na wygladzie produktu.

# (9) TEZA: porty, kontener i dysk sa wolne
lsof -nP -iTCP:5471 -sTCP:LISTEN; lsof -nP -iTCP:6331 -sTCP:LISTEN
docker ps --format '{{.Names}}' | grep -c cx-day315 || true
df -h /
#   oczekiwane: puste lsof, 0 kontenerow, powyzej 5 GB wolnego
```

---

### §0.4a — pomiar zasięgu testów (warunek oddania raportu, patrz `Z24`)

Zanim ogłosisz jakikolwiek wynik testów, zmierz zasięg PEŁNYMI NAZWAMI, nie liczbami:

1. PRZED zmianami produktu: uruchom pakiet(y) testów wskazane w licencji z
   `--reporter=json` (albo zapisz listę `describe/it` z wyjścia) i zapisz do
   artefaktów plik `przed-nazwy.txt` — po jednej PEŁNEJ nazwie testu na wiersz.
2. PO zmianach: to samo do `po-nazwy.txt`.
3. Do raportu wchodzi: `diff przed-nazwy.txt po-nazwy.txt` — nazwy DODANE (twoje
   nowe testy) i nazwy ZNIKNIĘTE (każda zniknięta = wyjaśnienie albo STOP).
   `N passed` bez nazw NIE jest pomiarem. „Ta sama liczba" przy innym składzie
   nazw to fałszywa zieleń (Z37).
4. Przepisanie liczby z instrukcji, cudzego raportu albo rejestru = zawyżenie
   i podstawa odrzucenia raportu. Liczysz sam, u siebie, na swojej bazie.

---

### 0.2. Bezwzględne ZAKAZY — `Z1`–`Z40`

| # | Zakaz | Dlaczego (incydent) |
| --- | --- | --- |
| `Z1` | **Żadnego `git push` na `origin`** — na żadną gałąź. Jedyny dozwolony push to `github-backup`, wyłącznie gałęzi `codex/day315-crimson-ekrany-20260904` | Push na `origin`/demo wykonuje wyłącznie nadzorca; krach 3/4 wyszedł z pushu wykonawcy |
| `Z2` | **Nie zmieniasz i nie pushujesz** `origin/demo`, `Londyn`, `grafika/m03-20260902` ani żadnej cudzej gałęzi `codex/*`, `fix/*`, `chore/*`, `recovery/*`. **Odczyt (`git show`, `git diff`, `git log`) jest dozwolony i często jawnie zamówiony** | Cudze tory w toku — 28.08 biegło równolegle kilkanaście dyżurów |
| `Z3` | **Żadnego `--force`, `--force-with-lease`, `git reset --hard` na gałęziach współdzielonych**, żadnego `rebase` w trakcie dyżuru | Krach 3/4: regresja demo z force/reset na złej bazie |
| `Z4` | **Nie czytasz i nie kopiujesz wariantów WIP właściciela** (`PRESERVED_PRODUCT_WIP` / `NO_COPY`) ani katalogu `server/src/_backup/**` | Warianty produktowe właściciela; `_backup` to śmietnik kolizji TS/JS |
| `Z5` | **★★ Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify`** — ani do zapisu, ani do odczytu, ani `git`, ani `cat`, ani `grep -r`, ani `ls`. Jedyny dozwolony kontakt: **symlink `node_modules` (odczyt)**, `DEC-2026-08-26-86` | Brudny checkout właściciela. **Naruszony 28.08: STOP dyżuru 53 kosztował godzinę** |
| `Z6` | **Nie dotykasz cudzych worktree** w `/private/tmp/consultify-*`, `/private/tmp/cx-*`, `/private/tmp/fix-*`, `/private/tmp/odbior-*`, `/private/tmp/instr-*`, `/private/tmp/finish-*`. **Wyjątek: katalogi, które SAM zakładasz w tym dyżurze, są Twoje** | Żyje ich ponad 100 |
| `Z7` | **★★ Twój JEDYNY port bazy to `6331`. Twój JEDYNY port harnessu to `5471`.** Nazwa kontenera musi nieść numer dyżuru: **`cx-day315-pg`**. **ZAKAZANE:** `Zakazane na stale: 5000 (macOS Control Center), 5037 (adb), 5060-5061 (SIP — Chromium ERR_UNSAFE_PORT), 6000, 6665-6669 oraz reszta listy restricted ports Chromium. Zajete przez inne prace (nie ruszasz): 3020, 3022, 3025, 3027, 3030 (tor grafiki nadzorcy), 5322, 5410-5441 (agenci nadzorcy), 5442-5449 oraz 6311-6313 (odbiorcy nadzorcy), 5432 i 5433 (Postgres hosta), 6012, 6379 (redis), 7000, 7679, 7768, 11434. Cudze — dyzury 286-313 (bazy 6290-6329, harness 5250-5469). Cudze w TEJ SAMEJ partii: dyzur 314 (runtime 5470, baza 6330, kontener `cx-day314-pg`) i dyzur 316 (runtime 5472, baza 6332, kontener `cx-day316-pg`) — do nich nie zagladasz. Twoje wlasne i JEDYNE: baza 6331, runtime 5471, kontener `cx-day315-pg`. Sprawdzasz sam przed startem: `lsof -nP -iTCP:PORT -sTCP:LISTEN` oraz `docker ps`. Zajety port jest STOP-em calosci, a nie zaproszeniem do wziecia innego numeru`. **Sprawdzasz sam przed startem** (BLOK 0) | Trzy incydenty zapisu do cudzej bazy; `docker ps` 28.08 pokazał żywe `cx-day53-pg:5838`, `cx-day52-pg:5835`, `cx-day50-pg:5830`, `cx-day48-pg:5816` |
| `Z8` | **Zero interakcji z Railway** — brak `railway` CLI, brak produkcyjnych env, brak redeployu, brak zdalnych migracji i seedów | Produkcja `consultify.ai` NIETYKALNA (`DEC-2026-08-25-65`) |
| `Z9` | **Żadnej bazy poza jednorazowym lokalnym kontenerem tego dyżuru** — nigdy demo, staging, produkcja ani cudza retained-DB | **Baza demo i staging to JEDNA baza** (`DEC-2026-08-28-176`) |
| `Z10` | **★★ Zero nowych flag funkcyjnych i zero zmian wartości domyślnej istniejącej flagi** — w kodzie, w `.env*`, w `docker-compose*`, w `railway*`. Wyjątek: flagi jawnie zamówione w `zadnej nowej flagi. Zmiana koloru nie chowa sie za przelacznikiem — jej odpowiednikiem jest WARUNEK ZERO SCALENIA: praca konczy sie na galezi i czeka na akcept wlasciciela na zrzutach`, wszystkie `default OFF` | Krach 07-12: masowe włączenie flag wizualnych na żywo, „tabelki jak dla trzylatka" (`CLAUDE.md` §9) |
| `Z11` | **★★ NIE ODSŁANIASZ NOWEGO EKRANU BEZ AKCEPTU.** Nowe wizualium ma flagę `default OFF` i idzie do właściciela **na zrzutach zrobionych przez Ciebie**. Zmiana domyślnej na `ON` = **odrzucenie pozycji** | `CLAUDE.md` reguła 7: właściciel NIGDY nie jest pierwszym testerem wizualnym (powód: załamanie 07-11) |
| `Z12` | **★★ NIE ZMIENIASZ MODELU UPRAWNIEŃ ANI BRAMEK PLATFORMOWYCH.** Nietykalne do zapisu: ``scripts/check-focus-canon.sh` i `scripts/check-focus-canon.baseline.txt` (baseline 41 plikow / 60 wystapien — wolno go WYLACZNIE ZACISNAC; `--update-baseline --yes` wymaga jawnego potwierdzenia, to celowy bezpiecznik K-40 i NIE WOLNO go uzyc do zerowania dlugu) · `scripts/check-artefakt.sh` · `scripts/check-list-canon.sh` · `scripts/dev/grafika-zrzuty.mjs` (harness kanoniczny — wolno DODAC opcje opt-in, nie wolno zmienic zachowania domyslnego) · `tailwind.config.js` (definicja palety `primary` — zmiana tutaj dotknelaby WSZYSTKICH modulow naraz, czyli dokladnie tego, czego decyzja wlasciciela zabrania) · `src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx` (wzorzec komunikatu bledu AI — nie psujesz)`. **Wyjątek — jeżeli istnieje — jest wymieniony imiennie w tabeli licencji** | Pliki przekrojowe; dyżury 37/43/46/52 rozjechały się właśnie na nich |
| `Z13` | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY315_CRIMSON_EKRANY_REPORT.md`. Nie zmieniasz zadnego `MODULE_ACCEPTANCE.md` — praca konczy sie NIESCALONA i bez akceptu wlasciciela, wiec nie ma czego podnosic do stanu faktycznego. Wpis do `docs/program/waves/WAVE_03_ACCEPTANCE/modules/13_CHAT/MODULE_ACCEPTANCE.md` zrobi nadzorca po akcepcie. **Zrzuty, logi i pliki wynikowe NIE wchodzą do repo** — leżą w `/private/tmp/cx-day315-crimson-ekrany-artefakty`, a raport podaje ścieżki i `shasum -a 256` | Dokumentacja rośnie szybciej niż produkt |
| `Z14` | **Nie zmieniasz `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md`** i nie podważasz decyzji w kodzie. Uważasz, że decyzja się myli → **errata w raporcie** | SSOT decyzji właściciela |
| `Z15` | **Zero modelu językowego w tym dyżurze.** Żaden pomiar, strażnik ani ekran nie woła `llmService`, `/api/ai/**` ani `GoogleGenerativeAI` | `DEC-51` — zakaz atrapy AI; bezpieczeństwo nie ma prawa zależeć od sieci |
| `Z16` | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych, `503 not_configured`, `null`, `UNKNOWN` ani nagrobków `410`** | „Zero placebo i atrap"; uczciwy `503` jest wzorcem POPRAWNYM |
| `Z17` | **Zakaz wszystkiego poza zakresem tego dyżuru** — z imiennymi licencjami z tabeli licencji | Podział front/tył i rozłączność z dyżurami równoległymi |
| `Z18` | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej:** `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts`, każdy `vitest.*.config.ts`, `server/vitest.config*.ts`, `tests/integration/_helpers/assertRealPostgres.ts` | Jedna zmiana globalnego mocka fałszuje wynik całego korpusu |
| `Z19` | **Nie odmontowujesz i nie kasujesz żadnego routera, middleware ani joba CI zamontowanego dziś** | Odmontowanie trasy potrafi zabić ekran, którego nie mierzysz; bramki znikają łatwiej, niż wracają |
| `Z20` | **★★ ZAKAZ uruchamiania testów DB bez jawnego kompletu env wskazującego kontener TEGO dyżuru, W TEJ SAMEJ LINII komendy.** Kolejność BLOKU 0 jest wiążąca: **NAJPIERW kontener + pełne migracje, DOPIERO potem jakikolwiek pomiar** | Trzy incydenty zapisu do cudzej bazy |
| `Z21` | **DoD wymaga DOWODU OSIĄGALNOŚCI, nie istnienia pliku** (`DEC-2026-08-26-104`). Pełna ścieżka: realne wejście HTTP → realny `ApiGateway` → `verifyToken` → trasa → handler → zapytanie → **wiersz w Twojej bazie** → odczyt, który ten wiersz podnosi → konsument w `src/` **albo jawne zdanie „brak konsumenta"** | Istnienie kodu ≠ działanie |
| `Z22` | **★★ Test wstrzykujący zależności albo montujący router w gołym `express()` NIE dowodzi ścieżki produkcyjnej** (`DEC-2026-08-26-107`). Dowodem jest `ApiGateway.getInstance().initializeRoutes(app)` | Replika rozjeżdża się z produkcją i nikt tego nie zauważa |
| `Z23` | **★★ ZERO ATRAP.** `200` z pustą kopertą tam, gdzie zapytanie padło, jest atrapą. `0` tam, gdzie wartość jest nieznana, jest atrapą. Ekran, który zapisuje do magazynu, którego nikt nie czyta, jest atrapą. Przycisk bez trasy jest atrapą | `DEC-2026-08-25-21/22`, `DEC-51` |
| `Z24` | **Pomiar zasięgu testów wg `§0.4a` jest warunkiem oddania raportu.** Zawężony wybór albo **przepisanie cudzej liczby** = zawyżenie i podstawa odrzucenia | Liczby autora instrukcji i nadzorcy krążą po dokumentach i utrwalają się jako „fakt" |
| `Z25` | **★★ Testy realdb WYŁĄCZNIE z jawnym `DATABASE_URL` wskazującym Twój efemeryczny kontener.** `tests/setup.ts` ma bezpiecznik i rzuca błędem zamiast fallbacku | **Port `5432` NASŁUCHUJE i nie jest Twój** — fallback = zapis do cudzych danych |
| `Z26` | **★★ Komplet env w tej samej linii — patrz `§0.2c`.** Bez `MOCK_DB=false` odczyty idą cicho na atrapę bazy; bez `ENABLE_V8_GLOBAL=true` część tras daje `404` **przed uwierzytelnieniem**; bez `ENABLE_TEST_AUTH_BYPASS=false` `verifyToken` **jest omijany** | Tak zginął dzień 23 |
| `Z27` | **★★ ZAKAZ `git stash` w każdej postaci** (`stash`, `stash -u`, `stash pop`, `stash apply`). Stan odkładasz przez `cp` do `/private/tmp/cx-day315-crimson-ekrany-scratch` i wracasz przez `cp` | **Schowek jest współdzielony między wszystkimi worktree** tego repozytorium; dwa incydenty kolizji |
| `Z28` | **★★ ZERO POŁĄCZEŃ DO RAILWAY, DEMO, STAGINGU I PRODUKCJI — w każdą stronę i każdym narzędziem.** Zakaz obejmuje `railway` CLI, `psql`/`docker exec psql` do hosta innego niż `127.0.0.1`, `curl`/`wget`/`fetch` do `*.railway.app`, `demo.consultify.ai`, `consultify.ai`, `staging.*` | Produkcja NIETYKALNA; demo i staging są jedną bazą. **To jedyny zakaz, którego naruszenie zatrzymuje CAŁY dyżur** |
| `Z29` | **★★ Testy o kształcie „atak odrzucony + readback bez zmian" MUSZĄ biec BEZ PONAWIANIA: `--retry=0` w KAŻDEJ komendzie** i `retry: 0` w opcjach `describe`/`it`, jeśli plik je ustawia | `vitest.config.ts` ustawia `retry: CI ? 3 : 1`. Przy otwartej dziurze pierwszy przebieg realnie zmienia stan, asercja pada, Vitest ponawia — i test **raportuje `PASS` mimo otwartej dziury**. Udowodnione na module Partner |
| `Z30` | **★★ ZAKAZ REALNEJ WYSYŁKI E-MAILI, ZAPROSZEŃ KALENDARZOWYCH I POWIADOMIEŃ.** Przed pierwszym przebiegiem zapisującym **udowodnij w raporcie**, że dostawca poczty jest atrapą — protokół `§0.2b` | Wysłany e-mail i zaproszenie kalendarzowe są **nieodwracalne** i trafiają do skrzynek osób trzecich |
| `Z31` | **★★ ZAKAZ PRZYPINANIA STRAŻNIKA TESTU REALDB DO HOSTA, PORTU ALBO NAZWY BAZY.** Wołasz `await assertRealPostgresTestEnvironment()` **BEZ ARGUMENTÓW**, w szczególności bez `expectedDatabase` | Dyżur 43 przypiął strażnik do swojej bazy: po usunięciu kontenera **30 przypadków dowodowych stało się trwałym `SKIP`**, pakiet raportuje `exit 0` i wygląda jak sukces |
| `Z32` | **★★ ZAKAZ WPISU `FIXED` / `VERIFIED` / `ZROBIONE_WG_DoD` BEZ DOWODU MUTACYJNEGO W OBIE STRONY.** Psujesz kod produkcyjny → test **CZERWONY**; cofasz → test **ZIELONY**; `git diff` po cofnięciu **pusty**. Obie komendy i oba wyniki dosłownie w raporcie. Mutację cofasz przez `cp` (`Z27`), nigdy `git stash` | Dyżur 44 wpisał `FIXED` dla podatności, **która nigdy nie istniała** — test przechodził także przed zmianą, bo asercja była tautologią |
| `Z33` | **★★ PRZED KAŻDYM POMIAREM SPRAWDZASZ, CZY STRAŻNIK, KTÓRY MIERZYSZ, NIE WYŁĄCZA SIĘ SAM W TRYBIE TESTOWYM** — ramka `§0.2d` | Na `resultsInternalBetaVisibility.middleware.ts` zmierzono **416 fałszywych twierdzeń** o uprawnieniach jednego modułu |
| `Z34` | **★★ GREP DOWODZI, ŻE ŁAŃCUCH ISTNIEJE, NIE ŻE DZIAŁA.** Zdanie „działa" wolno Ci napisać wyłącznie po realnym żądaniu HTTP przez realny `ApiGateway`, z podpisanym JWT, na realnym Postgresie po pełnych migracjach — **i po zapisaniu KODU ODPOWIEDZI** | 28.08 w module kalendarza zmierzono kompletny łańcuch komponent → `fetch` → trasa → handler → `INSERT`. **Każdy realny `POST` zwracał `500`**, bo `req.db` nigdy nie było ustawiane w tej gałęzi montażu |
| `Z34a` | **★★ PO PIERWSZYM COMMICIE ROBISZ PUSH NA `github-backup`**, a potem po każdej pozycji | 28.08 trzy dyżury pracowały cały dzień bez kopii zapasowej |
| `Z35` | **Zakaz „naprawiania" przez wyciszanie:** `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `.skip`, `.todo`, poszerzanie `exclude`/`testIgnore`, obniżanie progów pokrycia, `--max-warnings`, `continue-on-error: true` na jobie testowym. Uznajesz to za jedyne wyjście → **STOP z uzasadnieniem**, nie cichy commit | To jest choroba, którą program leczy, a nie narzędzie do jej leczenia |
| `Z36` | **Zakaz `eslint --fix` i `prettier --write` na czymkolwiek szerszym niż plik, który i tak zmieniasz z innego powodu.** Zakaz `--fix` na katalogu, na `.`, na globie | Autofix dotknąłby tysięcy plików i skasował pracę **wszystkich** równoległych dyżurów |
| `Z37` | **Porównania testów po NAZWACH przypadków (`fullName`), NIGDY po liczbach.** „Było 300 PASS, jest 300 PASS" nie jest dowodem — jeden test mógł zgasnąć, a drugi się zapalić | Wektor maskowania regresji |
| `Z38` | **Zakaz usuwania i odmontowywania jakiegokolwiek joba CI.** Wolno dodać, wolno poprawić warunek. Usunięcie = STOP z rekomendacją | Bramki znikają łatwiej, niż wracają |
| `Z39` | **Zakaz uruchamiania realnych workflow GitHub Actions** — `gh workflow run`, `gh run rerun`, `act` z realnymi sekretami, push wyzwalający CI na `main`/`develop`/`Londyn`/`demo`. Dowód robisz **statycznie** | Realny przebieg CI dotyka sekretów i środowisk poza Twoją kontrolą |
| `Z40` | ★★ **ZERO SCALENIA I ZERO PUSHU NA GALAZ BAZOWA** — praca zostaje na `codex/day315-crimson-ekrany-20260904`; o wejsciu decyduje wlasciciel, patrzac na Twoje zrzuty (regula 7 kodeksu: wlasciciel nigdy nie jest pierwszym testerem wizualnym). ★★ **ZAKAZ UZYCIA `--update-baseline` DO ZEROWANIA DLUGU FOKUSA** — baseline wolno WYLACZNIE ZACISNAC; poluzowanie albo przepisanie go „zeby przeszlo” jest podstawa odrzucenia calego dyzuru (bezpiecznik K-40 istnieje wlasnie po to). ★★ **ZAKAZ RUSZANIA SEMANTYKI KRYTYCZNEJ** — ramka bledu AI i etykiety „Blokada”/„Krytyczny” zostaja czerwone; zamiana ich na neutralne jest REGRESJA, nie naprawa. ★★ **ZAKAZ ZMIANY PALETY `primary` W `tailwind.config.js`** — to dotknelo by wszystkich modulow naraz. ★★ **ZAKAZ PISANIA WLASNEGO SKRYPTU ZRZUTOW OBOK KANONICZNEGO** — brakujaca zdolnosc dokladasz do `scripts/dev/grafika-zrzuty.mjs` jako opcje OPT-IN. ★★ **ZAKAZ ODDANIA PARY BAJTOWO IDENTYCZNEJ JAKO DOWODU** — para identyczna to defekt kadru albo dowod, ze zmiana nie dotarla do renderowanego elementu; rozstrzygasz KTORE i zapisujesz, nigdy nie przemilczasz | Dyzur 311 oddal dziesiec z szesnastu par bajtowo identycznych i sam wpisal „brak widocznej roznicy” tam, gdzie roznica byla (teresa-chipy-sugestii: 222 do 0 px w light, 115 do 0 w dark). Bezpiecznik jednowymiarowy nagradza defekt tym latwiej, im wiekszy — dlatego para musi miec JEDNOCZESNIE sume kontrolna i srednia jasnosc, a bramka fokusu musi widziec to, co naprawiasz |

---

### 0.2b. ★★ PROTOKÓŁ `Z30` — ZERO WYSYŁKI, A MIMO TO PEŁNY DOWÓD

**(1) Czego NIE WOLNO Ci zrobić — nigdy:**
- ★ **UWAGA — SPROSTOWANIE 2026-08-30.** Ten szkielet wymieniał tu wcześniej
  przełącznik `ENABLE_LIVE_EMAIL`. **Taka flaga NIE ISTNIEJE w kodzie** — `grep`
  po całym `server/src` i `src` daje zero trafień. Był to fantom, powielany
  w każdej wydanej instrukcji. **Nie szukaj go i nie raportuj, że jest wyłączony.**
  Realny warunek wysyłki jest inny i opisany w punkcie (2) poniżej: poczta wychodzi
  wyłącznie wtedy, gdy `emailService.ts:202` zobaczy **jednocześnie** `smtpConfig.host`
  i `smtpConfig.auth.user`, sklejone **najpierw z tabeli `settings`**, dopiero potem
  ze zmiennych środowiskowych. Bez tych dwóch wartości serwis pisze na konsolę;
- ustawić `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `SMTP_FROM`
  w środowisku, w `.env*`, w `docker-compose*` ani nigdzie indziej;
- wstawić wiersza konfiguracji SMTP do tabeli ustawień w swojej bazie;
- uruchomić serwera pełnym `server/src/index.ts` **na potrzeby testów** — tam
  startują drenaże outboxów; testy montują `ApiGateway`, nie cały serwer
  (`Z22`);
- uruchomić `server/src/index.ts` na potrzeby zrzutów inaczej niż przez
  kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs` i bez spełnienia
  wszystkich warunków z punktu (4) poniżej;
- wywołać ręcznie żadnej funkcji `drain*` / `startNotificationOutboxDrainCron`
  / `outboxWorker`.

**(2) Trzy dowody, które wklejasz do raportu ZANIM uruchomisz cokolwiek
zapisującego:**

```bash
cd /private/tmp/cx-day315-crimson-ekrany

# (a) srodowisko nie ma ani jednej zmiennej poczty
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo "BRAK ZMIENNYCH POCZTY"

# (b) ★ DRUGIE DNO: emailService czyta SMTP NAJPIERW Z BAZY (emailService.ts:180-185).
#     Dowod „nie mam zmiennych" NIE WYSTARCZA. Po migracjach uruchom:
docker exec cx-day315-pg psql -U postgres -d cx315 \
  -c "SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';"
#   oczekiwane: 0 wierszy. Jezeli tabela `settings` nie istnieje — wklej TEN blad,
#   to tez jest dowod (nie ma skad wziac konfiguracji poczty).

# (c) dla TESTOW: zaden drenaz outboxu nie dziala w procesie testowym
grep -n "startNotificationOutboxDrainCron\|outboxWorker\|platformOutboxDrainCron" server/src/Gateway.ts
#   oczekiwane: 0 trafien — drenaze startuja w server/src/index.ts, ktorego NIE uruchamiasz
```

**(3) Deklaracja obowiązkowa dla TESTÓW w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani
żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało
wysłane."**

**(4) Wyjątek wyłącznie dla ZRZUTÓW ODBIOROWYCH — pełny produkt, nie replika.**
Pełny `server/src/index.ts` wolno uruchomić wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, po wykonaniu dowodów (a) i (b),
oraz tylko gdy wszystkie poniższe warunki są spełnione imiennie:

- runtime pracuje wyłącznie na efemerycznej lokalnej bazie dyżuru pod
  `127.0.0.1`, na zasobach przydzielonych w instrukcji; nie wolno adoptować
  bazy zawierającej jakikolwiek klucz `smtp%`;
- środowisko procesu serwera pochodzi z `childEnv(...)`, ma
  `DOTENV_DISABLED='1'` i nie zawiera `SMTP_*`, `RESEND`, `SENDGRID` ani
  `MAIL*`; trzeba to potwierdzić dla uruchomionego procesu, nie tylko dla
  powłoki wywołującej;
- zapytanie z dowodu (b), wykonane po wszystkich migracjach i seedach, zwraca
  `0` wierszy bezpośrednio przed startem runtime'u;
- nie ustawiasz flag drenaży na `true`, nie wywołujesz żadnego drenażu ręcznie
  i nie wykonujesz żadnej operacji, która tworzy wiadomość, zaproszenie lub
  powiadomienie; runtime służy wyłącznie do odczytu i wykonania zrzutów;
- po starcie ponownie sprawdzasz środowisko należącego do Ciebie procesu oraz
  log serwera. Trafienie konfiguracji poczty, próby realnego transportu albo
  niejednoznaczność dowodu oznacza natychmiastowe zatrzymanie runtime'u i STOP
  całego dyżuru (`Z30`).

Brak konfiguracji nie wyłącza samych drenaży: w runtime z realną bazą startują
one domyślnie. Ochroną jest fail-closed protokół powyżej — `emailService`
tworzy realny transporter dopiero przy jednoczesnej obecności hosta i
użytkownika SMTP; bez nich pozostaje atrapą konsolową. Dowody (a) i (b)
obowiązują zatem zarówno testy, jak i zrzuty odbiorowe.

**Deklaracja obowiązkowa dla ZRZUTÓW ODBIOROWYCH w raporcie, dosłownie:**
**„Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane."**

**Ostrzeżenie wsteczne (`DEC-2026-08-29-314`):** dyżury `70`, `72`, `73`,
`76`, `81` i `85` uruchomiły kanoniczny runtime do zrzutów, przez co
sześciokrotnie naruszyły wcześniejsze bezwarunkowe brzmienie `§0.2b`. Do szkody
nie doszło, ponieważ niezależny protokół `Z30` wymagał wykazania, że dostawca
poczty jest atrapą. To ostrzeżenie nie znosi zakazu ani nie zastępuje dowodów.

---

### 0.2c. ★★ KOMPLET ZMIENNYCH ŚRODOWISKOWYCH — TRZY WARIANTY, ZAWSZE W JEDNEJ LINII

**Zmienna postawiona `export`-em wcześniej NIE LICZY SIĘ.** `vitest.config.ts`
przybija część wartości (`DB_TYPE='sqlite'`), więc komplet musi stać
**w tej samej linii komendy** — i masz **udowodnić, że nadpisał**, a nie założyć.

**(A) MIGRACJE — pełny łańcuch, przed jakimkolwiek pomiarem (`Z20`):**

```bash
cd /private/tmp/cx-day315-crimson-ekrany

docker run -d --name cx-day315-pg \
  -e POSTGRES_PASSWORD=cx -e POSTGRES_DB=cx315 \
  -p 127.0.0.1:6331:5432 pgvector/pgvector:pg16
#   ★ `postgres:15` NIE PRZECHODZI migracji — brak rozszerzenia `vector`

until docker exec cx-day315-pg pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6331/cx315 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20

# DRUGI przebieg — musi byc bezbledny i bez zmian (idempotencja):
NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6331/cx315 \
  npx tsx server/scripts/migrate.postgres.ts 2>&1 | tail -20
```

**`NODE_ENV=test` jest OBOWIĄZKOWE przy bazie lokalnej** — bez niego strażnik
localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
(`server/scripts/migrate.postgres.ts:640-650` opisuje ten mechanizm wprost).
**Liczbę zastosowanych migracji i wynik obu przebiegów mierzysz sam** (`Z24`).

**(B) PAKIETY DOTYKAJĄCE BAZY — komplet obowiązkowy, gotowy do wklejenia:**

```bash
cd /private/tmp/cx-day315-crimson-ekrany && \
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6331/cx315 \
JWT_SECRET=cx315-test-secret-do-not-reuse \
npx vitest run src/components/AIChat/__tests__/ tests/unit/ui/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day315-crimson-ekrany-artefakty/day315-crimson-ekrany.json
```

Dla testów **serwerowych** dodajesz `--config server/vitest.config.ts`.
**Uruchomienie `vitest` z roota bez właściwego configu daje
`No test files found` — a to NIE jest `PASS`.** Sprawdź, którego configu
wymaga dana ścieżka, i **wpisz to do raportu**.

**(C) PAKIETY CZYSTO JEDNOSTKOWE** (mockują `dbGet`, nigdy nie otwierają
połączenia — m.in. pomiar zasięgu `§0.4a`):

```bash
cd /private/tmp/cx-day315-crimson-ekrany && \
RUN_DB_TESTS=0 MOCK_DB=true \
npx vitest run src/components/AIChat/__tests__/ tests/unit/ui/ --retry=0 \
  --reporter=json --outputFile=/private/tmp/cx-day315-crimson-ekrany-artefakty/day315-crimson-ekrany.json
```

**To NIE jest naruszenie `Z26`, tylko warunek `Z25`:** bez `DATABASE_URL`
`tests/setup.ts` rzuciłby błędem przy `RUN_DB_TESTS=1`.
**Nigdy nie mieszasz: pakiet jednostkowy NIE jest dowodem egzekucji.**

**Znaczenie każdej zmiennej — musisz je znać, zanim ją wpiszesz:**

| Zmienna | Co się stanie, gdy jej zabraknie |
| --- | --- |
| `RUN_DB_TESTS=1` | `tests/setup.ts` pomija testy bazodanowe; pakiet raportuje `exit 0` |
| `MOCK_DB=false` | odczyty idą **cicho** na atrapę bazy, zapisy nigdzie nie lądują |
| `DB_TYPE=postgres` | `vitest.config.ts` przybija `sqlite` — mierzysz inny silnik, niż myślisz |
| `NODE_ENV=test` | runner migracji odmawia albo zwraca MOCK przy bazie lokalnej |
| `ENABLE_V8_GLOBAL=true` | część tras daje **fałszywe `404` PRZED uwierzytelnieniem** |
| `ENABLE_TEST_AUTH_BYPASS=false` | **`verifyToken` JEST OMIJANY** — każdy test uwierzytelniania przechodzi z fałszywego powodu |
| `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce` | strażnik przepuszcza wszystko przy `NODE_ENV=test` (416 fałszywych twierdzeń) |
| `DATABASE_URL` | fallback na `localhost:5432`, który **nasłuchuje i nie jest Twój** |
| `JWT_SECRET` | podpisany JWT nie przejdzie przez `verifyToken`; dostaniesz `401` z niewłaściwego powodu |
| `--retry=0` | test „atak odrzucony" **leczy się skutkiem własnego ataku** i raportuje `PASS` |

---

### 0.2d. ★★ ZNANE PUŁAPKI ŚRODOWISKA — OSIEMNAŚCIE, KAŻDA KOSZTOWAŁA GODZINY

**Czytaj to, ZANIM uznasz cokolwiek za zepsute.**

1. **Vault jest BARE + `extensions.worktreeConfig=true`.** Po `git worktree add`
   **musisz** utworzyć `<vault>/worktrees/cx-day315-crimson-ekrany/config.worktree`
   z treścią `[core]` / `bare = false`, inaczej `git` w worktree odmawia pracy.
   Komenda dosłowna: `§0.1` krok (4).
2. **Remote `icloud-source` w vaulcie jest MARTWY** (wskazuje na nieistniejący
   `/private/tmp/consultify-staging-deploy-e6ca`). **Nie wołaj `git fetch --all`.**
   Jego błąd **NIE jest** negatywnym wynikiem markera i nie jest powodem STOP-u.
3. **Host NIE MA binarki `psql`** (`which psql` → `psql not found`).
   Każde zapytanie: `docker exec cx-day315-pg psql -U postgres -d cx315 -c '…'`.
4. **Runner migracji wymaga `NODE_ENV=test` przy bazie lokalnej.** Bez tego
   strażnik localhost odmawia albo `getDatabaseAsync()` zwraca MOCK
   (`server/scripts/migrate.postgres.ts:640-650`).
5. **`vitest.config.ts` (ok. `:209-210`) twardo ustawia `test.env.DB_TYPE='sqlite'`.**
   Zmienna z powłoki bywa nadpisywana — `DB_TYPE=postgres` musi stać
   **w tej samej linii komendy**, a Ty **udowadniasz w raporcie, że nadpisało**
   (asercja `expect(process.env.DB_TYPE).toBe('postgres')` w pierwszym `it`
   każdego nowego pakietu). Pliku **nie zmieniasz** (`Z18`).
6. **`JSON.parse` na kolumnie typu `json` działa na SQLite i wywala `500` na
   PostgreSQL** — sterownik `pg` zwraca już zdeserializowany obiekt. Jeżeli
   kolumny są `TEXT`, kształt `500` nie występuje, ale występuje kształt
   **cichej utraty danych**. Każdy `500` widoczny na PG a nie na SQLite sprawdź
   najpierw pod tym kątem (`DEC-2026-08-28-245`).
7. **CI NIE URUCHAMIA TESTÓW dla naszych gałęzi.** Joby `test-suite.yml` są
   warunkowane na `main`/`develop`, a my jesteśmy na `Londyn`/`demo`;
   `lint-typecheck` pada na zastanych błędach `tsc`, a `pr-gate` czyta wynik
   pominiętego joba jako sukces (`DEC-2026-08-28-246`). **„CI zielone" nie jest
   w tym repo żadnym dowodem.** Dowodem jest wyłącznie Twój przebieg z `--retry=0`.
8. **`docker rm -f` bez `-v` NIE kasuje wolumenu.** Sprzątanie: `docker rm -fv cx-day315-pg`.
9. **Reporter `basic` NIE ISTNIEJE w tej wersji vitest** (`--reporter=basic` →
   `Failed to load custom Reporter from basic`). Do porównania nazw używasz
   `--reporter=json --outputFile=<plik poza repo>`.
10. **`npx vitest run` bywa kończy się `exit 0` mimo czerwonych testów** przy
    przekierowaniu wyjścia. **Nie ufaj kodowi wyjścia** — liczby i nazwy czytasz
    z JSON-a.
11. **Nowe pliki w `tests/` wymagają `git add -f`** (katalog bywa ignorowany
    częściowo). Sprawdzasz `git status --short` po każdym commicie.
12. **`| head` na grepie sierot produkuje FAŁSZYWE SIEROTY.** Werdykt „martwy
    komponent" wymaga grepu **bez obcięcia**, z wykluczeniem `__tests__`
    i komentarzy.
13. **ESM nie honoruje `NODE_PATH`.** Skrypt `.mjs` uruchamiany spoza repo nie
    znajdzie pakietów — rozwiązuj je przez `createRequire(REPO + '/package.json')`.
14. **Na remote `github-backup` NIE MA gałęzi `main`, `develop`, `Londyn` ani
    `demo`** — są na `origin` (`origin/develop` **stoi od 2026-06-02**).
    Pracujemy na linii `Londyn`/`demo`.
15. **`postgres:15` NIE PRZECHODZI migracji** — brak rozszerzenia `vector`.
    Obraz obowiązkowy: `pgvector/pgvector:pg16`.
16. **`prettier` na wielkich plikach potrafi przepisać cały plik.** W repo
    **nie ma** skryptu `format` — wołasz `npx prettier --write <pliki>` wprost.
    Jeżeli wynik reformatu przekracza ~3× liczbę Twoich linii merytorycznych —
    **cofasz reformat** (`cp` z kopii wg `Z27`, nigdy `git stash`), zostawiasz
    styl zastany i wpisujesz to do raportu.
17. **Istnieją testy tekstowe przez `readFileSync` + `toContain`,** które
    asertują **dosłowne linie kodu**. Reformat takiej linii wywala test.
    Jeżeli test zapali się od Twojego reformatu — **to jest regresja Twojego
    reformatu, nie „test do poprawienia"**: cofasz reformat.
18. **`npx vitest` z roota bez właściwego configu daje `No test files found`.**
    To **nie jest `PASS`** — to jest brak pomiaru.

---

> **★★ RAMKA DO `Z33` — PUŁAPKI, KTÓRE FAŁSZUJĄ ZIELONY PRZEBIEG.**
> **Zielona suita w tym repozytorium NIE JEST DOWODEM, dopóki nie wiesz, którą
> pułapkę omija.**
>
> **(a) `ENABLE_V8_GLOBAL` nieustawione → fałszywe `404` PRZED uwierzytelnieniem.**
> `server/src/middleware/v8FeatureGate.middleware.ts:15` czyta
> `process.env.ENABLE_V8_GLOBAL === 'true'`; przy braku zmiennej bramka odcina
> trasę **zanim** cokolwiek sprawdzi tożsamość. Twój test „obcy tenant dostaje
> `404`" przechodzi wtedy z całkiem innego powodu, niż myślisz.
>
> **(b) `resultsInternalBetaVisibility.middleware.ts` przepuszcza wszystko przy
> `NODE_ENV=test`,** dopóki nie ustawisz
> `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`. **Na tym strażniku
> zmierzono 416 fałszywych twierdzeń o uprawnieniach.**
>
> **(c) `vitest.config.ts` twardo ustawia `test.env.DB_TYPE='sqlite'`.** Część
> „testów bazodanowych" idzie na atrapę. `MOCK_DB=false DB_TYPE=postgres`
> w tej samej linii to jedyne wyjście; pliku nie zmieniasz (`Z18`).
>
> **(d) `ENABLE_TEST_AUTH_BYPASS`.** `server/src/middleware/auth.middleware.ts`
> zawiera gałąź: `if (NODE_ENV === 'test' && ENABLE_TEST_AUTH_BYPASS === 'true')`
> — czyli **`verifyToken` potrafi wyłączyć się sam w trybie testowym**.
>
> **(e) (e) ★★ ZRZUT, KTORY NICZEGO NIE POKAZUJE, TO NAJCZESTSZY WYNIK TEGO MODULU.
> Dyzur 311 oddal szesnascie plikow i DZIESIEC par bajtowo identycznych. Przyczyna
> nie byla po stronie kodu — byla po stronie KADRU: komponenty, ktore zmienil,
> nie maja ekranu dev-render, wiec zaden zrzut nie mogl ich pokazac. Zanim
> ogloszisz „brak widocznej roznicy”, sprawdz, czy zmieniony element w ogole
> jest w kadrze. Kadr bez elementu to defekt przyrzadu, nie wynik pomiaru.
>
> (f) ★★ PARA LIGHT/DARK BYWA TYM SAMYM OBRAZEM POD DWIEMA NAZWAMI.
> Udokumentowany ksztalt „duplikat zamiast motywu”. Bezpiecznik jednowymiarowy
> (sama srednia jasnosc) NAGRADZA defekt tym latwiej, im wiekszy — dlatego
> sprawdzasz JEDNOCZESNIE sume kontrolna i srednia jasnosc, a nie jedno z dwojga.
> W tym module masz gorszy wariant tego samego: `canvas-kebab-restructure`
> i `canvas-toolbar-md-history` to TEN SAM obraz pod dwiema nazwami EKRANOW,
> w obu motywach. To nie jest kwestia kadru — to dwa wpisy macierzy renderujace
> to samo.
>
> (g) ★★ ROZWIJANIE SEKCJI POTRAFI ZAMKNAC PODGLAD (ksztalt „przyrzad zamyka
> podglad przed skanem”). Dla kazdego ekranu robisz przelot Z `--rozwin-sekcje=1`
> i BEZ niego i porownujesz DLUGOSC wydobytego tekstu. Jesli wersja rozwinieta ma
> tekstu mniej — wlaczasz `--cofnij-jesli-skraca=1` i zapisujesz ten fakt.
> Zwinieta sekcja NIE JEST dowodem.
>
> (h) ★★ GREP PO `primary-` LAPIE KOMENTARZE, `data-testid` I LITERALY.
> Na markerze piec z dziesieciu trafien poza testami to NIE JEST kolor. Mianownik
> liczony bez tej klasyfikacji jest zawyzony, a „naprawa” komentarza jest
> naprawa pozorna. Klasyfikuj KAZDE trafienie zanim cokolwiek zmienisz.
>
> (★) ★★ `npx vitest run` W TYM REPO ZAPISUJE `junit.xml` DO KORZENIA WORKTREE.
> To jest zachowanie konfiguracji, nie Twoj blad — nie commituj tego pliku i nie
> „naprawiaj” go zmiana konfiguracji testow. Do artefaktow uzywasz
> `--reporter=json --outputFile=<plik POZA repo>`, jak w `§0.2c`.**
>
> **Obowiązek dowodowy.** Dla **każdego** pakietu uruchomionego jako dowód
> czegokolwiek raport zawiera akapit: *która z pułapek (a)–(e) dotyczy tego
> pakietu, jak ją wyłączyłem, i co konkretnie dowodzi, że wyłączyłem*.
> Akapit „nie dotyczy" jest dopuszczalny **tylko** z komendą pokazującą, że dany
> strażnik nie leży na ścieżce. **Pomiar bez tego akapitu nie liczy się jako dowód.**

---

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości MERYTORYCZNEJ: STOP tej POZYCJI i wpis
w raporcie — nigdy improwizacja. W tym programie zasadny STOP jest NAGRADZANY,
a zgadywanie karane** (dzień 23 dostał `SUPERVISOR_ACCEPT` za STOP,
`DEC-2026-08-26-130`).

**Rozróżnij dwa rodzaje:**

- **STOP MERYTORYCZNY** (mile widziany): zmierzyłeś i wyszło inaczej, niż mówi
  ta instrukcja; brakuje informacji, której nikt poza właścicielem nie
  dostarczy; naprawa wymaga decyzji produktowej. **Wpisujesz do raportu
  i IDZIESZ DALEJ do następnej pozycji.**
- **STOP PROCEDURALNY** (zakazany): „instrukcja jest sprzeczna", „ścieżka nie
  istnieje", „nie mam licencji na plik". **Ten rodzaj NIE zatrzymuje niczego** —
  patrz tabela niżej i sekcja końcowa.

### ★★ TABELA: STOP PROCEDURALNY ZAKAZANY — DZIAŁANIE ZASTĘPCZE

| Powód, dla którego chciałbyś stanąć | Co robisz ZAMIAST STOP-u |
| --- | --- |
| „Musiałbym zmienić plik przekrojowy (`auth.middleware.ts` / `Gateway.ts` / bramkę platformową)" | **Czerwony kontrakt testowy + brief wynikowy** (tabela licencji, wiersz 1). Pozycja jest wtedy **ZROBIONA**, nie STOP |
| „Plik, którego potrzebuję, nie jest w tabeli licencji" | Traktujesz go jako **tylko do odczytu** i dajesz czerwony kontrakt + brief. Pozycja **ZROBIONA** |
| „Instrukcja jest wewnętrznie sprzeczna" | Sekcja **„JEŚLI COŚ JEST SPRZECZNE"** na końcu dokumentu. Wybierasz interpretację **bezpieczniejszą**, opisujesz w „Korektach", **kontynuujesz pozostałe pozycje** |
| „Ścieżka podana w instrukcji nie istnieje" | Sprawdzasz `ls`, wpisujesz **swój wynik** do „Korekt", szukasz realnego odpowiednika i **idziesz dalej**. Rozbieżność pomiaru z instrukcją **nie jest sprzecznością — jest WYNIKIEM** |
| „Instrukcja podaje dwie różne liczby" | Mierzysz sam, podajesz **swoją** liczbę z komendą (`Z24`). To **nie jest** powód do STOP-u |
| „`git fetch` zwrócił błąd `icloud-source`" | To **nie jest** błąd. `§0.2d` pkt 2. Idziesz dalej |
| „`psql` nie istnieje na hoście" | `docker exec cx-day315-pg psql …`. `§0.2d` pkt 3 |
| „Hook pre-commit blokuje commit" | **Naprawiasz kodem, nie omijasz.** `--no-verify` jest zakazem, nie STOP-em |
| „Musiałbym odłożyć stan roboczy" | `cp` do `/private/tmp/cx-day315-crimson-ekrany-scratch`. `git stash` jest zakazem (`Z27`), nie STOP-em |
| „Test przeszkadza" | **Nie osłabiasz asercji.** Opisujesz, co blokuje. Osłabienie = odrzucenie pozycji, nie STOP |
| „Nie zdążę zrobić wszystkich pozycji" | Robisz **rdzeń** (`R1 — klasyfikacja KAZDEGO trafienia `primary-` w Czacie (kolor / komentarz / literal / testid) i stan trzech bramek PRZED; R2 — naprawa realnego crimsona: piec linii, siedem tokenow klas, trzy pliki; R3 — zamkniecie zmierzonej dziury we wzorcu `check-focus-canon.sh`; R4 — EKRANY wedlug recepty z `teresa-confirm-chip`; R5 — pary PRZED/PO, w ktorych zadna para nie jest bajtowo identyczna`) i **uczciwie opisujesz resztę jako niezrobioną**. Odwrotna kolejność (inwentarze zrobione, rdzeń „częściowo") jest podstawą odrzucenia |
| „Port `6331` albo `5471` jest zajęty" | **To JEST powód do STOP-u całości** — nie bierzesz innego portu (`Z7`) |

**Zatrzymanie CAŁEGO dyżuru jest dopuszczalne WYŁĄCZNIE przy:**
1. **`MARKER BRAK`** (`§0.1`);
2. **faktycznym połączeniu do bazy zdalnej, demo, stagingu albo produkcji**
   (`Z28`) — „przecież to był tylko `SELECT`" nie jest okolicznością łagodzącą;
3. **ryzyku utraty danych** albo realnej wysyłki e-maila (`Z30`);
4. **mniej niż 5 GB wolnego dysku** (`§0.1` krok 0);
5. **zajętym porcie `6331` albo `5471`** (`Z7`).

Format wpisu STOP:

```
### STOP — <pozycja>
Rodzaj: MERYTORYCZNY / PROCEDURALNY
Powód: <jedno zdanie>
Licencja, którą sprawdziłem: <cytat wiersza z tabeli licencji + wynik>
Dowód: <plik:linia albo komenda + wynik>
Co dostarczyłem ZAMIAST zmiany: <czerwony kontrakt / pomiar / gotowy diff / brief>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Rekomendacja dla nadzorcy: <co zmienić, gdzie, jaki promień rażenia>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
Czy kontynuowałem pozostałe pozycje: TAK / NIE + dlaczego
```

**★★ STOP bez wypełnionego pola „Licencja, którą sprawdziłem" jest NIEZASADNY
z definicji. STOP bez wypełnionego pola „Co dostarczyłem ZAMIAST zmiany" jest
NIEZASADNY z definicji.**

---

## ★★ JEŚLI COŚ W TEJ INSTRUKCJI JEST SPRZECZNE LUB NIEWYKONALNE

**Ta instrukcja była pisana i sprawdzana przez człowieka i model. Może mieć
błędy. Nie zatrzymuj przez nie dyżuru.**

**Procedura, dosłownie:**

1. **Opisz sprzeczność w raporcie**, w sekcji „Korekty wobec instrukcji":
   **cytat obu wykluczających się zdań z numerami paragrafów**, na czym polega
   konflikt, jaki masz dowód i co zrobiłeś.
2. **Wybierz interpretację BEZPIECZNIEJSZĄ.** Reguły rozstrzygające,
   w tej kolejności:
   - **nie ruszaj cudzego pliku** — gdy nie wiesz, czy masz licencję, **nie
     masz**; traktuj plik jako tylko do odczytu i dostarcz czerwony kontrakt
     + brief;
   - **nie osłabiaj asercji** — gdy test przeszkadza, opisujesz go, nie
     zmieniasz;
   - **nie kasuj** — gdy werdykt jest niepewny, wpisz `DO DECYZJI WŁAŚCICIELA`
     ze zdaniem **„czego konkretnie mi zabrakło, żeby rozstrzygnąć
     samodzielnie"** (wiersz bez tego zdania liczy się jako nierozstrzygnięty);
   - **nie włączaj** — gdy nie wiesz, czy flaga ma być `ON`, zostaje `OFF`
     (`Z10`/`Z11`);
   - **nie wysyłaj niczego na zewnątrz** — gdy nie masz pewności co do `Z30`,
     nie klikasz;
   - **nie poszerzaj dostępu** — gdy bramka jest niejednoznaczna, **odmawiasz
     zamiast przepuszczać**;
   - **mierz zamiast zgadywać** — gdy instrukcja podaje liczbę, a Twój pomiar
     daje inną, **wiążący jest Twój pomiar z komendą** (`Z24`).
3. **KONTYNUUJESZ POZOSTAŁE POZYCJE.** Sprzeczność w jednym paragrafie nie
   zwalnia z pozostałych ani z raportu.
4. **Zatrzymanie CAŁEGO dyżuru** — wyłącznie z pięciu powodów wymienionych
   w `§0.5`.
5. **Nigdy nie „naprawiaj" instrukcji przez improwizację w kodzie.**
   Sprzeczność w dokumencie rozwiązuje się **wpisem w raporcie**, nie zmianą
   w produkcie.
6. **★ Rozbieżność między pomiarem a tą instrukcją NIE JEST sprzecznością —
   jest WYNIKIEM.** Każda liczba, linia i teza w tym dokumencie to **rozkaz
   pomiarowy**, nie prawda objawiona.

**★ Trzy najcenniejsze rzeczy, jakie możesz oddać:** dowód, że coś, co uchodziło
za działające, nie działa; dowód, że coś, co uchodziło za zepsute, jest sprawne;
i uczciwe zdanie „tego nie zmierzyłem, bo…".

**★ Ostatnie zdanie tej instrukcji i najważniejsze: obalenie którejkolwiek tezy
z sekcji „TEZY ZLECENIA…" jest SUKCESEM dyżuru, a nie porażką. Zapisz to
w „Korektach wobec instrukcji" z dowodem i idź dalej.**

---

## Po co ten dyżur istnieje

Dyżur 311 zrobił dobrą robotę **w kodzie**: zszedł z 262 wystąpień `primary-` w Czacie do resztki
i nie ruszył semantyki krytycznej. Oddał natomiast **dowód, który niczego nie dowodzi**.

Zmierzone przeze mnie na markerze, w `evidence/grafika/crimson-czat-20260903/`:

| Co zmierzone | Wynik |
|---|---|
| plików zrzutów | 16 (8 ekranów × light/dark) |
| par `PRZED` = `PO` **bajtowo identycznych** | **10 z 16** |
| ekrany różniące się w obu motywach | `chat-blad-ai`, `chat-split-teresa-right`, `teresa-chipy-sugestii` |
| `canvas-kebab-restructure` vs `canvas-toolbar-md-history` | **ten sam obraz pod dwiema nazwami**, w obu motywach |

Właściciel nie może na tym oprzeć żadnej decyzji, a reguła 7 kodeksu mówi, że **nie zobaczy ekranu,
zanim ja nie wyrenderuję go sam i nie sprawdzę, że zrzut jest czysty**. Dziś nie ma czego pokazać.

**Przyczyna nie leży w kodzie — leży w kadrze.** Zmierzyłem to komendą (5) z weryfikacji wejściowej:
**żaden** z komponentów niosących crimson albo istotnych dla pokazania zmiany nie ma ekranu
dev-render: `ConversationSearch`, `PrivateModeDetails`, `ProjectMembersModal`, `ResearchProgress`,
`V8ArtifactRunControl`, `MoveToProjectModal`, `CloudFilePicker` — **siedem na siedem bez ekranu**.
A `dev-render/screens/wave3-creators-crimson.tsx` to **statyczny swatch kolorów**, nie produkt —
własny komentarz pliku to przyznaje. Swatch nie jest dowodem na wyglądzie produktu.

## ★ Zmierz moje liczby sam — i uwaga, jedna z nich obala zamówienie nadzorcy

Twierdzę, na markerze `bc18bc7acac2ec825ebb3db2f1309738ab034d58`:

| # | Twierdzenie | Moja liczba | Jak sprawdzić |
|---|---|---|---|
| 1 | trafień `primary-` w `src/components/AIChat` | **15 w 9 plikach** (w tym 5 w pliku testowym) | komenda (1) |
| 2 | trafień poza testami | **10** | komenda (1) |
| 3 | z tego **realnych tokenów koloru** | **5 linii / 7 tokenów klas, w 3 plikach** | komenda (2) |
| 4 | fałszywych trafień grepa (komentarz / `data-testid` / literal) | **5** | komenda (1) |
| 5 | crimsonowych fokusów w `ToolsMenu`, `MoveToProjectModal`, `CloudFilePicker` | **0** | komenda (2) |
| 6 | par dowodowych 311 bajtowo identycznych | **10 z 16** | komenda (4) |
| 7 | baseline bramki fokusu | **41 plików / 60 wystąpień**, `--ci` zielone | komenda (3) |
| 8 | plików z realnym crimsonem widocznych dla bramki | **1 z 3** (tylko `PrivateModeDetails`) | komenda (3) |

★★ **ROZBIEŻNOŚĆ, KTÓRĄ MASZ ROZSTRZYGNĄĆ I ZAPISAĆ.** Zamówienie nadzorcy mówi o **„22
wystąpieniach”** w Czacie i o **„12 crimsonowych fokusach `focus:ring-primary-500` w
`ConversationSearch`, `ToolsMenu`, `MoveToProjectModal`, `ProjectMembersModal`, `CloudFilePicker`”**.
Mój pomiar na markerze daje **15 wystąpień** i **zero** trafień `focus:ring-primary-500` w całym
katalogu Czatu; `ToolsMenu`, `MoveToProjectModal` i `CloudFilePicker` mają **po zero** wystąpień
`primary-`. Najprawdopodobniejsze wyjaśnienie: liczby nadzorcy pochodzą **sprzed** commitów
`993814c08b` („domknij fokus neutralizowanych stanów”) i `748ff95b67` (naprawa długu fokusa 287),
które są już na markerze. **Zmierz sam, rozstrzygnij i zapisz — nie przepisuj żadnej z tych liczb
bez własnego pomiaru.**

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz
rozbieżność wprost.**

## ★ Warunek twardy: ZERO SCALENIA

Praca zostaje na gałęzi `codex/day315-crimson-ekrany-20260904`. O wejściu decyduje właściciel,
patrząc na Twoje zrzuty. To jest odpowiednik flagi domyślnie OFF dla zmiany, której nie da się
sensownie schować za przełącznikiem.

## ★ Czego NIE ruszasz: czerwień, która jest poprawna

Dwa miejsca mają czerwień **semantycznie słuszną** i mają ją zachować:

- `chat-blad-ai` → `AiProviderErrorNotice.tsx` — ramka błędu AI (tokeny `c-danger`; komentarz w pliku
  wprost zakazuje `primary-*` i to jest **poprawny** stan, nie dług),
- `chat-signals-feed` → `ChatSignalsPanel.tsx` — etykiety „Blokada” i „Krytyczny”.

Zamiana ich na neutralne jest **regresją**, nie naprawą, i jest podstawą odrzucenia dyżuru.

# TABELA LICENCJI PLIKOWYCH

Kolumna „Produkt zastępczy” mówi, co robisz, gdy pliku nie wolno Ci zmienić — **żaden wiersz nie
brzmi samo „STOP”**.

| Warstwa | Ścieżka | Prawo | Produkt zastępczy / uwaga |
|---|---|---|---|
| **komponent** | `src/components/AIChat/ConversationSearch.tsx` | **★ WĄSKA LICENCJA:** wyłącznie token `group-focus-within:text-primary-500`, w zakresie `R2` | Zakaz przebudowy wyszukiwarki |
| **komponent** | `src/components/AIChat/PrivateModeDetails.tsx` | **★ WĄSKA LICENCJA:** wyłącznie linia `className` plakietki (`hover:bg-primary-100`, `dark:hover:bg-primary-900/40`, `focus:ring-primary-400/50`), w zakresie `R2` | Ten plik **jest** w baseline bramki (1 wystąpienie) — po naprawie baseline **zaciskasz**, nigdy nie luzujesz |
| **komponent** | `src/components/AIChat/ProjectMembersModal.tsx` | **★ WĄSKA LICENCJA:** wyłącznie trzy tokeny `focus:border-primary-500`, w zakresie `R2` | Zakaz zmiany logiki modala i uprawnień |
| **komponent (semantyka)** | `src/components/AIChat/AiProviderErrorNotice.tsx` | **TYLKO ODCZYT** | Czerwień poprawna. Wpisujesz do raportu jako „sprawdzone, zostaje” — to jest wynik, nie pominięcie |
| **komponent (semantyka)** | `src/components/AIChat/ChatSignalsPanel.tsx` | **TYLKO ODCZYT** | jak wyżej. Trafienie `data-testid="chat-signal-primary-action"` to **nie kolor** |
| **komponent** | `src/components/AIChat/InlineResponseFeedback.tsx`, `src/components/AIChat/KimiWorkspace/ExceleRightPanel.tsx`, `src/components/AIChat/Wave9OutcomeAIOpsPanel.tsx` | **TYLKO ODCZYT** | Trafienia to komentarze i literal `'primary-llm'`. Klasyfikujesz w `R1`, nie „naprawiasz” |
| **martwe poddrzewo** | `src/components/AIChat/AgentAudit/` (`AgentSuggestionCard.tsx`, `AgentAuditVerdictPanel.tsx`, `index.ts`) | **★ PEŁNA LICENCJA** w zakresie `R6` — usunięcie albo podłączenie | Rozstrzygnięcie musi być **udowodnione**, nie zadeklarowane: patrz opis `R6` |
| **powłoka** | `src/components/AIChat/MessageRenderer.tsx` | **TYLKO ODCZYT** | Odsłaniasz jego gałęzie **danymi w harnessie**, nie zmianą komponentu. Jeśli gałęzi nie da się odsłonić danymi — **czerwony kontrakt testowy** `it('KONTRAKT DLA DYŻURU 315 — …')` + brief w raporcie. Pozycja **ZROBIONA** |
| **powłoka** | `src/components/AIChat/UnifiedChatPanel.tsx` | **TYLKO ODCZYT** | jak wyżej. `V8ArtifactRunControl` jest tam renderowany **bezwarunkowo** — kadr ma objąć rozwiniętą kontrolkę |
| **kontrakt (bezpiecznik)** | `scripts/check-focus-canon.sh` | **★ WĄSKA LICENCJA:** wyłącznie **rozszerzenie** `VIOLATION_RE` w zakresie `R3` | Rozszerzenie **musi** być udowodnione mutacyjnie (patrz `R3`) i **musi** przejść z zaciśniętym baseline. Zakaz zawężania wzorca |
| **kontrakt (bezpiecznik)** | `scripts/check-focus-canon.baseline.txt` | **★ WĄSKA LICENCJA:** wyłącznie **ZACIŚNIĘCIE** (liczby maleją albo pliki znikają) | **ZAKAZ `--update-baseline --yes` do wyzerowania długu.** Każdą zmianę wiersza uzasadniasz w raporcie |
| **harness** | `scripts/dev/grafika-zrzuty.mjs` | **★ WĄSKA LICENCJA:** wyłącznie **NOWE opcje opt-in** | Domyślne zachowanie bit w bit bez zmian. **Zakaz pisania własnego skryptu zrzutów obok.** ★ Kolizja: dyżur 314 też może chcieć tu dołożyć opcję — sprawdź `git log` gałęzi bazowej i zgłoś kolizję ZANIM napiszesz |
| **harness** | `dev-render/screens/teresa-confirm-chip.tsx` | **★ PEŁNA LICENCJA** | Twoja baza — jedyny ekran Czatu montujący realny `MessageRenderer` |
| **harness (NOWE pliki)** | `dev-render/screens/*.tsx` (nowe ekrany dyżuru) | **★ PEŁNA LICENCJA** | Ekran ma **montować realny komponent**, nigdy replikę JSX. Replika jest przyrządem pokazującym nie-produkt |
| **harness** | `dev-render/main.tsx`, `scripts/dev/g06-macierz-ekrany.json` | **★ WĄSKA LICENCJA:** rejestracja nowych ekranów w kluczu `13_CHAT` oraz rozstrzygnięcie duplikatu `canvas-kebab-restructure` / `canvas-toolbar-md-history` | Zakaz kasowania cudzych wpisów macierzy z innych modułów |
| **harness** | `dev-render/screens/wave3-creators-crimson.tsx` | **TYLKO ODCZYT** | Statyczny swatch. Nie rozbudowujesz go — swatch nie jest dowodem |
| **test (NOWE pliki)** | `src/components/AIChat/__tests__/**`, `tests/unit/ui/**` | **★ PEŁNA LICENCJA**, z zastrzeżeniem `Z18` i `Z31` | `git add -f` — nowe pliki w `tests/` bywają ignorowane |
| **konfiguracja (przekrojowa)** | `tailwind.config.js` | **TYLKO ODCZYT — BEZWZGLĘDNIE** | Zmiana palety `primary` dotknęłaby wszystkich modułów naraz. Produkt zastępczy: opis w raporcie + rekomendacja jako diff, nienałożony |
| **raport** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY315_CRIMSON_EKRANY_REPORT.md` (**NOWY PLIK**) | **JEDYNY nowy dokument, jaki wolno Ci utworzyć** (`Z13`) | — |
| **dowody** | `evidence/grafika/crimson-czat-315/**` (NOWY katalog) | **★ PEŁNA LICENCJA** | — |
| **dowody** | `evidence/grafika/crimson-czat-20260903/**` | **TYLKO ODCZYT** | Materiał dowodowy dyżuru 311. Nie nadpisujesz go — to Twój punkt odniesienia dla `--porownaj-z` |
| **cudzy teren** | `src/components/Initiatives/**`, `src/components/MyWork/**`, `src/components/Interview/**`, `src/components/DiscoveryTools/**`, `src/components/shared/NModeLayout/**` | **TYLKO ODCZYT — teren dyżuru 314** | Wpis do raportu: plik, linia, problem, **gotowa rekomendacja jako diff w bloku kodu, nienałożony**. Pozycja idzie dalej |
| **cudzy teren** | `src/services/api.ts`, `src/services/errors/**` | **TYLKO ODCZYT — teren dyżuru 316** | jak wyżej |
| **cudzy teren** | `server/src/**`, `server/migrations/**` | **TYLKO ODCZYT** | Ten dyżur nie ma pozycji serwerowej ani migracyjnej |

**Nietykalne imiennie:** `tailwind.config.js` (paleta `primary`); semantyka krytyczna w
`AiProviderErrorNotice.tsx` i `ChatSignalsPanel.tsx`; domyślne zachowanie
`scripts/dev/grafika-zrzuty.mjs`; katalog `evidence/grafika/crimson-czat-20260903/`;
`src/components/AIChat/__tests__/aiProviderErrorCopy.chatOwn016.test.tsx`.

# POZYCJE

## R1 — KLASYFIKACJA I STAN BRAMEK (rdzeń)

Tabela `plik · linia · treść trafienia · KLASA`, gdzie klasa jest jedną z pięciu:

| Klasa | Co z tym robisz |
|---|---|
| `KOLOR — CTA albo stan aktywny` | na neutralne tokeny `c-*` (`R2`) |
| `KOLOR — pierścień/obramowanie fokusu` | na `c-focus` (`R2`) |
| `KOLOR — semantyka krytyczna` | **zostaje**, wpis „sprawdzone, zostaje” |
| `NIE-KOLOR — komentarz` | **nie ruszasz**, wpis do tabeli |
| `NIE-KOLOR — literal / `data-testid`` | **nie ruszasz**, wpis do tabeli |

Plus stan **trzech** bramek kanonu **nazwa po nazwie** przed jakąkolwiek zmianą — inaczej nie
odróżnisz swojego długu od zastanego, a porażka spowodowana schowa się w wiadrze zastanych.

**Commit po `R1`.**

## R2 — NAPRAWA REALNEGO CRIMSONA (rdzeń)

Trzy pliki, pięć linii, siedem tokenów klas, `esbuild` każdego pliku, commit per plik. Docelowe tokeny: neutralne
`c-*` dla hover, `c-focus` dla fokusu — zgodnie z `docs/ui-standards/TRIADA_KANON.md`.

★ `PrivateModeDetails` ma **hover** i **fokus** w jednej linii `className` — to dwie różne
klasy naprawy w jednym miejscu. Nie scalaj ich w jedną zmianę bez opisu.

**Commit per plik.**

## R3 — ZAMKNIĘCIE DZIURY W BEZPIECZNIKU (rdzeń)

To jest pozycja, której nikt dotąd nie zrobił, i najważniejsza trwała wartość tego dyżuru.

Zmierzone: wzorzec bramki to
`ring-(primary|crimson)-|outline-(primary|crimson)-|ring-offset-(primary|crimson)-`.
Skutek: z trzech plików, które naprawiasz w `R2`, bramka widzi **jeden**
(`PrivateModeDetails`, bo ma `ring-primary-400/50`). `focus:border-primary-500`
i `group-focus-within:text-primary-500` są dla niej **niewidzialne** — bramka mówi „OK” i **ma
rację wobec własnego wzorca**, tylko ten wzorzec nie pokrywa rodziny.

Zadanie: **rozszerz `VIOLATION_RE` tak, żeby obejmował fokus-owy `border-` i `text-`**, i udowodnij
to mutacyjnie:

1. Mutacja celuje w **ZABEZPIECZENIE**: wstawiasz do dowolnego pliku pojedynczy
   `focus:border-primary-500` i bramka `--ci` **musi** dać kod wyjścia 1.
2. Cofasz mutację, bramka **musi** wrócić na zielono.
3. Mutacja psująca skrypt (literówka, zła składnia) **nie jest dowodem** — w trzech na cztery
   dyżury jednego dnia testy przechodziły po skasowaniu zabezpieczenia, bo mutacja celowała obok.

★ **Warunek brzegowy, który musisz zmierzyć, a nie założyć:** rozszerzenie wzorca **podniesie
liczbę wykrytych naruszeń w całym `src/`**, nie tylko w Czacie. Zmierz, o ile, **zanim** cokolwiek
zmienisz w baseline. Jeżeli okaże się, że rozszerzenie odsłania dziesiątki naruszeń w cudzych
modułach, to **nie jest powód do zawężenia wzorca z powrotem** — to jest powód do:
(a) rozszerzenia wzorca, (b) **jednorazowego, jawnie opisanego** wpisania odsłoniętego długu do
baseline z komentarzem, że to dług **odsłonięty, nie nowy**, (c) zapisania liczby w raporcie jako
zamówienia na kolejny dyżur. Zaciskanie baseline dotyczy **Twoich trzech plików**; reszta wchodzi
jako jawnie nazwany dług zastany. Napisz to w raporcie jednym cytowalnym zdaniem.

**Commit po `R3`.**

## R4 — EKRANY, KTÓRYCH BRAKUJE (rdzeń)

Gotowa recepta, sprawdzona przez odbiorcę — **wykorzystaj ją, nie wymyślaj własnej.**

`dev-render/screens/teresa-confirm-chip.tsx` **już montuje realny `<MessageRenderer>`** z pełnym,
działającym zestawem propsów (dwie wiadomości, komplet handlerów). To znaczy, że kolejne
powierzchnie Czatu odsłaniasz **jednym polem danych**, bez dotykania produktu:

| Powierzchnia | Jak ją odsłonić | Gdzie stoi warunek |
|---|---|---|
| `ResearchProgress` (postęp badania) | `msg.metadata.researchProgress = { stage, topic, queries, sources }` | `hasDeepResearchProgress(...)` w `MessageRenderer.tsx`, komponent renderowany tuż pod warunkiem |
| blok opcji | `msg.options` | gałąź `msg.options` w `MessageRenderer.tsx` |
| CTA deep-thinking | `msg.metadata.deepThinking = { kind: 'report' }` oraz `deepThinkingHint` | dwie osobne gałęzie `deepThinking` |
| komunikat przerwania | `abortFeedback: 'partial' \| 'cancelled'` + `isLastMessage` | gałąź `abortFeedback` |
| treść ostrzegawcza | `msg.content` zawierające `⚠️` | gałąź `content?.includes('⚠️')` |
| nagłówek czatu | osobny ekran montujący `V8ArtifactRunControl` (w `UnifiedChatPanel` renderowany **bezwarunkowo**) | — |

★★ **NUMERY LINII SIĘ PRZESUWAJĄ. Trafiaj `grep`-em po nazwie, nie po numerze.** Numery, które
zmierzyłem przy pisaniu tej instrukcji, są w komendzie (6) weryfikacji wejściowej wyłącznie jako
punkt startu — jeżeli Twój `grep` da inne, obowiązuje Twój.

★★ **Ekran ma montować REALNY komponent.** Replika JSX „wyglądająca tak samo” jest przyrządem
pokazującym nie-produkt — w jednym z przeglądów właściciel dał piątkę ekranowi, który pokazywał
kompozycję nieistniejącą w aplikacji. Jeżeli komponentu nie da się zamontować bez zmiany produktu,
to jest **czerwony kontrakt testowy + brief**, a nie replika.

★ Osobno rozstrzygnij **duplikat macierzy**: `canvas-kebab-restructure` i
`canvas-toolbar-md-history` renderują ten sam obraz w obu motywach. Albo je różnicujesz (i wtedy
udowadniasz różnicę sumą kontrolną), albo usuwasz jeden wpis z `13_CHAT` w
`scripts/dev/g06-macierz-ekrany.json` z uzasadnieniem. **Dwa wpisy dające ten sam obraz zawyżają
pokrycie i to jest defekt macierzy, nie kosmetyka.**

**Commit po `R4`.**

## R5 — PARY PRZED/PO, ŻADNA NIE IDENTYCZNA (rdzeń)

Kanoniczny harness, sekcje **rozwinięte**, oba motywy, katalog `evidence/grafika/crimson-czat-315/`.

Szkic (port `5471` jest Twój):

```bash
cd "$WT"
npx vite --config dev-render/vite.config.ts --port 5471 --strictPort &

node scripts/dev/grafika-zrzuty.mjs \
  --base=http://127.0.0.1:5471 \
  --ekrany=<Twoja lista ekranów, w tym nowe z R4> \
  --katalog=evidence/grafika/crimson-czat-315/PRZED \
  --faza=PRZED --motywy=light,dark --szerokosc=1440 --wysokosc=900 \
  --rozwin-sekcje=1 --cofnij-jesli-skraca=1 \
  --wynik-json=/private/tmp/cx-day315-crimson-ekrany-artefakty/przed.json

# … R2/R3 …

node scripts/dev/grafika-zrzuty.mjs \
  --base=http://127.0.0.1:5471 \
  --ekrany=<ta sama lista> \
  --katalog=evidence/grafika/crimson-czat-315/PO \
  --faza=PO --motywy=light,dark --szerokosc=1440 --wysokosc=900 \
  --rozwin-sekcje=1 --cofnij-jesli-skraca=1 \
  --porownaj-z=evidence/grafika/crimson-czat-315/PRZED \
  --wynik-json=/private/tmp/cx-day315-crimson-ekrany-artefakty/po.json
```

**Próg odbioru tej pozycji, dosłownie:** zestaw par `PRZED`/`PO`, w którym **żadna para nie jest
bajtowo identyczna**, każda ma **sumę kontrolną obu plików** i **średnią jasność**, a para
`light`/`dark` tego samego ekranu **też nie jest tym samym obrazem** (kształt „duplikat zamiast
motywu”: sprawdzasz lumę, nie tylko nazwę pliku).

Obowiązkowa kontrola przyrządu, jak w każdym dyżurze zrzutowym: przelot **z** `--rozwin-sekcje=1`
i **bez** niego, porównanie **długości wydobytego tekstu**; wersja rozwinięta z mniejszą ilością
tekstu oznacza, że rozwijanie **zamyka** podgląd — wtedy `--cofnij-jesli-skraca=1` jest obowiązkowe,
a fakt idzie do raportu.

Każdy kadr `PO` obejrzany przez `Read` i opisany **z nazwy**. Kadr `PO` bez widocznej różnicy wobec
`PRZED` jest **albo defektem kadru, albo dowodem, że zmiana nie dotarła do renderowanego elementu**
— rozstrzygasz które, nie przemilczasz.

**Commit po `R5`.**

## R6 — MARTWE PODDRZEWO `AgentAudit/`

Zmierzone: `AgentSuggestionCard` i `AgentAuditVerdictPanel` są re-eksportowane **wyłącznie przez
własny `index.ts`**, którego **nikt nie importuje**. Jednocześnie funkcja audytu agentów **żyje**
w `MessageRenderer` i `UnifiedChatPanel` pod innymi nazwami (`handleAgentAuditAccept`,
`refreshAgentAuditSuggestionsOnly`, `setAgentAuditActiveTabByMessageId`).

★ To jest podręcznikowy kształt **„martwe poddrzewo niewidoczne per-plik”**: metoda „plik bez
importera” liczy import **wewnątrz** martwego katalogu jako żywy, więc trzy pliki przechodzą przez
każdy audyt osierocenia. **Mierzysz osiągalność od korzenia**, nie obecność importera.

Rozstrzygnij i **udowodnij**:

- **usunąć** — dowód: po usunięciu katalogu build przechodzi, żaden test nie pada, a funkcja audytu
  w Czacie działa dalej (pokaż to kadrem albo testem);
- **podłączyć** — dowód: wskazujesz miejsce w produkcie, w którym komponent ma być renderowany, i to
  miejsce realnie go renderuje.

„Zostawiam, bo może się przydać” **nie jest rozstrzygnięciem** i jest podstawą odrzucenia pozycji.

**Commit po `R6`.**

## R7 — RAPORT

1. Tabela klasyfikacji `R1` (każde trafienie, z klasą).
2. Rozstrzygnięcie rozbieżności wobec liczb nadzorcy (22 / 12) — z komendą i wynikiem.
3. Tabela `R3`: wzorzec przed i po, dowód mutacyjny (obie strony), liczba naruszeń odsłoniętych
   w całym `src/`, jedno cytowalne zdanie o tym, co weszło do baseline jako dług **odsłonięty**.
4. Lista ekranów `R4`: nowe, zmienione, rozstrzygnięcie duplikatu macierzy.
5. Tabela par `R5`: `ekran · motyw · suma PRZED · suma PO · % różnych pikseli · średnia jasność`.
   **Żadna para identyczna.**
6. Rozstrzygnięcie `R6` z dowodem.
7. Stan trzech bramek **nazwa po nazwie**, przed i po. `§0.4a` — pełne nazwy testów, `diff`.
8. Zdanie wprost: **gałąź NIE jest scalona i czeka na akcept właściciela na zrzutach.**
9. Sekcję **TWIERDZENIA NIEZWERYFIKOWANE** — niepustą.

## Prawo zatrzymania

„Sklasyfikowałem 15 trafień, 5 linii było kolorem (7 tokenów klas) i naprawiłem je, rozszerzyłem wzorzec bramki i mam
dowód mutacyjny w obie strony, zbudowałem cztery ekrany, oddaję czternaście par i żadna nie jest
identyczna” **jest wynikiem** — i jest wart więcej niż dwadzieścia par, z których połowa to ten sam
obraz.

Scalenie tej gałęzi bez akceptu właściciela nie jest przyspieszeniem — jest złamaniem decyzji,
która powstała po krachu 07-12.

---

**★ Ostatnie zdanie tej instrukcji i najważniejsze: Jeśli Twój pomiar przeczy liczbie podanej
w tej instrukcji, obowiązuje TWÓJ pomiar — zapisz rozbieżność wprost.** Obalenie którejkolwiek
mojej tezy jest **SUKCESEM** dyżuru, a nie porażką.
