# KRYTYK ADWERSARYJNY — Sekcja D · Vegas (56 pozycji)

Zasada złotej reguły: `grep` realnego callera na `origin/demo`, sprawdź czy flaga ma
implementację i domyślną wartość, nie ufaj audytowi/rejestrowi na słowo.

## 0. NAJWAŻNIEJSZE ODKRYCIE: rejestr sam sobie zaprzecza

`_REJESTR_DOKONCZENIA.md` ma DWIE liczby dla D·Vegas, które się nie zgadzają:

- **Linia 41 (tabela zbiorcza):** `| D · Vegas (F0-F6+V7) | 30 | 0 | 0 | 26 | 0 | 56 |` → **30✅**
- **Linia 58 (narracja):** „D·Vegas (30✅): Faza 0 fundamentów WDROŻONA (...) · Faza 1: 7
  artefaktów SPEC-A (...) — crimson→tokeny, stany, a11y, **za flagami**; galeria B-P2
  zaakceptowana”
- **Linie 504-533 (własny itemized ledger tej samej sekcji, kilkanaście linii niżej):**

| Blok | Deklarowane ✅ w nagłówku bloku | Realna treść wierszy |
|---|---|---|
| F0 · Fundament (8) | **3✅** | F0-1✅ F0-2✅ F0-3✅ F0-4🟡(=DEC D18, brama) F0-5🟡 F0-6✅ F0-7⬜(porzucone) F0-8🟡 |
| F1 · Listy A1-A5 (5) | **5✅** | check-list-canon PASS, 85 plików StandardTable — **to TRIADA/tabele, NIE artefakty SPEC-A** |
| F2 · Artefakty (12+6=18) | **0✅** | 9×⬜ (diagnozy stanu MindMap·Flow·Whiteboard·IdeaTable·Insight·Initiative·Decision·Excel·Deck) · Notatnik🔨 · Task🟡 · Word❓ · check-artefakt.sh⬜ · CANON-dublet⬜ · Bramka-0⬜ · 2×🔵 |
| F3 · Huby (6) | **0✅** | wszystko ⬜/🟡 |
| F4 · Hartowanie (5) | **0✅** | wszystko ⬜ |
| F5 · Light mode (2) | **0✅** | wszystko ⬜ |
| F6 · Eksporty (4) | **0✅** | PPTX🟡 XLSX⬜ DOCX🟡 branding⬜ |
| V7 · Przekroje (8) | **0✅** | wszystko ⬜/🟡 |

**Suma realna z własnego itemized ledger: 3+5 = 8✅ z 56.** Nagłówek tabeli zbiorczej mówi **30✅**.
To jest **rozbieżność 3.75×** wewnątrz JEDNEGO dokumentu — 22 pozycje policzone jako ✅ w
podsumowaniu, które we własnym szczegółowym rejestrze tej samej sekcji są ⬜/🟡/🔨/❓.

Kluczowe: **F2 „Artefakty” (18 pozycji, dokładnie te same 7+ narzędzi co „Faza 1: 7 artefaktów
SPEC-A” z narracji 30✅) ma w itemized ledger 0✅.** Czyli ta sama praca jest jednocześnie
„zrobiona” (w narracji zbiorczej) i „0% zrobiona, diagnoza w toku” (w szczegółowym rejestrze),
zależnie od tego, którego zdania w tym samym pliku się użyje.

## 1. Flagi VF1_*_SPECA — POTWIERDZONE default OFF, zero pokrycia w env

`grep` na `origin/demo` (HEAD `8e10f1c5b0`, 2026-07-19):

```
src/components/MyWork/TaskDetailView.tsx:151:      const VF1_TASK_SPECA = import.meta.env.VITE_VF1_TASK_SPECA === 'true';
src/components/MyWork/DecisionDetailView.tsx:194:  const VF1_DECISION_SPECA = import.meta.env.VITE_VF1_DECISION_SPECA === 'true';
src/components/Interview/InsightViewer.tsx:140: const VF1_INSIGHT_SPECA = import.meta.env.VITE_VF1_INSIGHT_SPECA === 'true';
src/components/MyWork/IdeasTableContent.tsx:77: const VF1_IDEATABLE_SPECA_ENABLED = import.meta.env.VITE_VF1_IDEATABLE_SPECA === 'true';
src/components/Presentations/DeckBuilder/DeckBuilder.tsx:78: const VF1_DECK_SPECA = import.meta.env.VITE_VF1_DECK_SPECA === 'true';
src/utils/vf1CanvasSpecAFlag.ts   → ENV_KEY 'VITE_VF1_CANVAS_SPECA' (gates MindMap/ProcessFlow/Whiteboard)
src/utils/vf1InitSpecAFlag.ts     → ENV_KEY 'VITE_VF1_INIT_SPECA' (Initiative/Rekord)
```

7 flag = dokładnie 7 artefaktów z narracji „Faza 1” (Task·Initiative·Insight·Decision·Deck·
Canvas·IdeaTable). Wszystkie mają jawny komentarz w kodzie: *„Default OFF: the proven legacy
placeholders stay the default surface until Piotr signs off... (rule #7)"*.

- Żaden z 6 plików env (`.env.example`, `.env.production.example`, `.env.staging.example`,
  `.env.staging.local.example`, `.env.oauth.template`, `server/.env.test`) na `origin/demo` **nie
  ustawia** żadnego z tych kluczy na `true`. Zero nadpisania w Railway build configu widocznego w
  repo.
- Rezolucja override'u: `?ff_vf1TaskSpecA=1` w URL lub `localStorage` — czyli **operator musi
  ręcznie wstrzyknąć parametr**, zwykły użytkownik demo tego nie zrobi.
- **Wniosek: na żywym demo (bez ręcznej ingerencji) użytkownik widzi STARĄ wersję** (stary spinner
  `LoadingState`, stary `HubWorkAreaLoadError` itd.) — dokładnie tak jak przed „Fazą 1”.

Dodatkowo `VITE_ENABLE_STYLEGUIDE` (F0 „style-guide /dev/styleguide”) — też `=== 'true'`, też
default OFF, też brak w żadnym env pliku. Ten jeden akurat jest tylko dev-narzędziem (nie
user-facing), więc mniejsza stawka, ale to samo zjawisko: „zbudowane” ≠ „włączone”.

## 2. Fundamenty F0 — częściowo REALNE, częściowo lokalny-tylko

| Element F0 | Werdykt | Dowód |
|---|---|---|
| Tokeny `--motion-*` / `--elevation-*` / `--state-*` | **POTWIERDZONE-WIDOCZNE** | `src/index.css` na `origin/demo`: 5× `--motion-`, 7× `--elevation-`, 4× `--state-` w `:root` + dark override. Bezwarunkowe (brak flagi) → działają dla każdego usera zawsze. |
| Biblioteka stanów (`shared/states/{Empty,Error,Loading,Skeleton,Streaming}State.tsx`) | **POTWIERDZONE-WIDOCZNE (poza 7 gated)** | Realnie importowana bez flagi w ~29 innych komponentach (Benefits, Execution, Finance, Interview, MyWork huby, Admin...) — to jest szerzej wdrożone niż tylko 7 artefaktów SPEC-A. |
| ESLint gate (F0-1) | **POTWIERDZONE, ale dziurawe** | Rejestr sam przyznaje: „nie łapie primary-*/c-accent” — czyli gate istnieje, ale nie łapie dokładnie tego, co ma łapać (crimson-leak). |
| a11y-gate (`check-a11y-jsx.cjs`, `check-a11y-focus.cjs`) | **POTWIERDZONE-CI** | `scripts/check-a11y-*.cjs` śledzone w git na `origin/demo` + realnie wpięte w `.github/workflows/test-suite.yml` (kroki „a11y jsx ratchet gate (VF0-7)” / „a11y focus-visible gate”). To jedno z niewielu twierdzeń, które przechodzi test „real CI caller”. |
| Hook crimson-leak (`check-triada.sh`) / gęstość (`check-gestosc.sh`) / artefakt (`.claude/hooks/check-artefakt.sh`) | **ZBUDOWANE-LOKALNIE-TYLKO, nie infrastruktura repo** | `.claude/` jest w `.gitignore` linia 253 na `origin/demo`; `git ls-tree origin/demo -- .claude/hooks` = PUSTE. Pliki fizycznie istnieją WYŁĄCZNIE w bieżącym checkout (`ls .claude/hooks/` pokazuje pliki z datą modyfikacji 07-19, dziś) — czyli odtwarzane per-sesja lokalnie, nie ma ich w repo, nie działają w CI, nie działają dla innego developera/agenta bez ręcznego skopiowania. Rejestr linia 94 to przyznaje wprost: „VF0-2 crimson-hook + VF0-12 gęstość-hook: `.claude/` gitignored → skopiowane do checkoutu lokalnie (nie idą przez git)” — ale mimo to liczone jako ✅ w F0. |
| `scripts/check-artefakt.sh` (odrębna kopia w `scripts/`, NIE w `.claude/`) | **ISTNIEJE, ale nie jest wpięty** | Śledzony na `origin/demo` (commit `58d159cdcd`), ratchet crimson dla powłoki SPEC-A — ALE nie ma go w `package.json` scripts ani w żadnym workflow CI. Uruchamialny tylko ręcznie. (Uwaga uboczna: rejestr F2-F1 mówi „nie istnieje!” ⬜ — to jest STARE/nieaktualne, plik już istnieje, więc rejestr tu akurat ZANIŻA, nie zawyża.) |
| Style guide `/dev/styleguide` | **ZBUDOWANE-ZA-FLAGĄ** | `VITE_ENABLE_STYLEGUIDE` default OFF, brak override w env — dev-only, niewidoczne bez ręcznej flagi (niższa stawka, to nie user-facing ekran). |

## 3. Werdykt per blok Vegas (F0-F6+V7)

| Blok | Rejestr nagłówek | Realny stan (itemized + kod) | WERDYKT |
|---|---|---|---|
| F0 Fundament | 3✅/8 | tokeny+states-lib+a11y-CI = realne; hooki=lokalne-tylko; style-guide=za flagą | **MIESZANE — częściowo POTWIERDZONE-WIDOCZNE, część ZBUDOWANE-LOKALNIE (nie repo/CI)** |
| F1 Listy A1-A5 | 5✅/5 | StandardTable rollout, 85 plików, `check-list-canon PASS` — osobny, wcześniej zamknięty temat (TRIADA list), niepowiązany z SPEC-A | **POTWIERDZONE-WIDOCZNE** (ale to nie jest "Vegas wygląd artefaktów" — to inny, dawno gotowy program) |
| F2 Artefakty (7 SPEC-A + 11 innych) | narracja: „30✅ obejmuje Faza 1: 7 artefaktów” | itemized: **0✅**, 9 diagnoz nadal ⬜, Task 🟡, Notatnik w budowie, Word ❓ | **ZBUDOWANE-ZA-FLAGĄ w kodzie (7 flag potwierdzone), ale rejestr sam przyznaje 0✅ w szczegółach — narracyjne „30✅” dla tej pracy jest ZAWYŻONE** |
| F3 Huby | 0✅/6 | wszystko ⬜/🟡 | **ZAWYŻONE gdyby liczone jako ✅ (nie jest — poprawnie w 🔵/⬜)** |
| F4 Hartowanie | 0✅/5 | wszystko ⬜ | jw. |
| F5 Light mode | 0✅/2 | wszystko ⬜ | jw. |
| F6 Eksporty | 0✅/4 | PPTX/DOCX częściowe, XLSX „dramat” | jw. |
| V7 Przekroje | 0✅/8 | wszystko ⬜/🟡, w tym „empty-states(crimson!)” otwarte | jw. |

## 4. Czy 26🔵 to uczciwe odroczenie?

Tak, w większości **uczciwe** — CLAUDE.md ma jawną, wcześniejszą doktrynę „mechanika NAJPIERW,
artefakty PO” i rejestr cytuje konkretną decyzję: „Decyzja: wygląd świadomie OSTATNI (mandat
funkcja>wygląd)”. F3+F4+F5+F6+V7 (25 pozycji) rzeczywiście pasują do tego świadomego odroczenia —
to nie są ukryte porażki, tylko nierozpoczęta praca zgodna z priorytetem produktowym. **ALE**: w
itemized ledger te same pozycje są oznaczone ⬜/🟡, nie 🔵 — czyli podsumowanie PRZEKLASYFIKOWUJE
"nie zaczęte" na "świadomie odroczone" na poziomie zbiorczej tabeli. Semantycznie to może być
uzasadnione (decyzja P-x istnieje), ale czytelnik tabeli zbiorczej (26🔵) nie widzi, że pod spodem
kryje się głównie "0% wykonania", tylko "odłożone z premedytacją" — ładniejsza etykieta na ten sam
fakt: nic nie zrobiono.

## 5. Ile z 30✅ jest realnie WIDOCZNYCH vs ZA-FLAGĄ vs ZAWYŻONE

- **POTWIERDZONE-WIDOCZNE bez flagi:** ~8 (F0 tokeny/states-lib/a11y-CI: 3 + F1 tabele: 5)
- **ZBUDOWANE-ZA-FLAGĄ (kod istnieje, default OFF, niewidoczne na demo bez ręcznej ingerencji):**
  7 artefaktów SPEC-A (Task/Decision/Insight/IdeaTable/Deck/Canvas/Initiative) — to jest "praca
  wykonana", ale **NIE jest "done" z perspektywy użytkownika demo**, i sam rejestr w itemized
  ledger (F2=0✅) się z tym zgadza.
- **ZAWYŻONE / nieuzasadnione w 30✅:** reszta do 30 (≈15 pozycji) nie ma pokrycia ani w kodzie za
  flagą, ani w itemized ledger jako ✅ — to czysta rozbieżność księgowa między narracją a tabelą
  tego samego dokumentu.

## Podsumowanie liczbowe

| Kategoria | Liczba (z 30 deklarowanych ✅) |
|---|---|
| Widoczne na demo bez flagi, realnie zweryfikowane | ~8 |
| Zbudowane, ale za flagą default-OFF (kod potwierdzony grep-em, 0 env override) | ~7 |
| Zawyżone / brak pokrycia nawet w itemized ledger tego samego dokumentu | ~15 |
