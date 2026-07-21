# ANALIZA UTRZYMANIA STANDARDU — co realnie broni się przed cofnięciem

> **Zlecenie Piotra 2026-07-21:** „zrób całą analizę utrzymania standardu".
> **Metoda:** zmierzone w repo, nie opisane z intencji. Każde twierdzenie ma polecenie,
> którym je sprawdziłem. Pisane przy 93% kontekstu — zwięźle, bez lania wody.

---

## 0. WERDYKT W JEDNYM ZDANIU

Zbudowaliśmy dziś **pięć bramek**. Realnie broni dziś **jedna i pół** — reszta istnieje,
ale **nikt jej nie uruchamia**. Standard trzyma się nadal na tym, że ja pamiętam, żeby
odpalić skrypt.

---

## 1. STAN FAKTYCZNY — co się uruchamia samo

| Bramka | Istnieje | Wpięta | Blokuje | Realna wartość dziś |
|---|:--:|:--:|:--:|---|
| `check-triada.sh` (kanon list) | ✅ | ✅ `.claude/settings.json` | ✅ | **DZIAŁA** — złapał dziś agenta |
| `check-artefakt.sh` (kanon kart N) | ✅ | ✅ `.claude/settings.json` | ⚠️ tryb raportu | **PÓŁ** — 3 nowe reguły tylko ostrzegają |
| `check-gestosc.sh` (gęstość) | ✅ | ❌ **niewpięta** | ❌ | **ZERO** — plik leży, nikt go nie woła |
| `sprawdz-zrodla.mjs` (dokumenty-widma) | ✅ | ❌ | ❌ | **ZERO** — tylko ręcznie |
| `karty-n-smoke.mjs` (rejestr↔harness) | ✅ | ❌ | ❌ | **ZERO** — tylko ręcznie |
| **Typ `StandardArtifactShell`** | ✅ | ❌ **0 kart go używa** | ❌ | **ZERO** — patrz §2 |

**Dowody:**
- `git config core.hooksPath` → `.husky`; `cat .husky/pre-commit` i `pre-push` → **`exit 0`**.
  Hooki gita nie robią **nic**. Commit i push przechodzą zawsze.
- `grep -rl "check-artefakt|karty-n-smoke|sprawdz-zrodla" .github/workflows/` → **zero trafień**.
  Osiem workflowów CI (test-suite, e2e, i18n-check, security-scan…) i **żaden** nie woła naszych bramek.
- `grep -c "check-gestosc" .claude/settings.json` → **0**.

### 1.1 Co to znaczy praktycznie
Bramki działają **wyłącznie wtedy, gdy kod pisze agent Claude Code w tym repo**
(hooki `.claude/`). Nie działają, gdy: ktoś commituje ręcznie · CI buduje deploy ·
ktoś pracuje w innym IDE · agent pracuje w worktree bez tej konfiguracji.

**To nie jest bramka. To jest asystent, który przypomina.**

---

## 2. NAJWIĘKSZA DZIURA — bramka typu nie jest wpięta

`StandardArtifactShell` powstał dziś i wymusza typem 9 rzeczy (panel obowiązkowy, jeden primary,
zarezerwowane id sekcji, `aiContract` na każdej sekcji, martwe `children`/`portalTarget`…).
Zweryfikowany testami `@ts-expect-error` — **działa**.

**Ale `grep -rl "StandardArtifactShell" src/` pokazuje, że żadna karta go nie używa.**
Task i Decision mają go tylko w **komentarzach** („po przepięciu karty na StandardArtifactShell…").

Typ, którego nikt nie importuje, nie sprawdza niczego. To jest najmocniejsza bramka z całej
piątki (zero kosztu utrzymania, błąd kompilacji zamiast uwagi w review) i **jest wyłączona**.

**To jest fala Z i to jest najwyższy priorytet utrzymaniowy.** Dopóki nie zostanie zrobiona,
ósma karta powstanie niezgodna dokładnie tak samo, jak powstało siedem poprzednich.

---

## 3. CZEGO ŻADNA BRAMKA NIE ŁAPIE — i co z tego wynika

Dzisiejszy dzień dał twarde dane, czego automat nie widzi:

| Wada | Kto ją znalazł | Czy bramka by ją złapała |
|---|---|---|
| 13× `useMemo` bez `t` w deps → surowy klucz i18n na ekranie | **ja, wzrokiem w harnessie** | ❌ żadna. esbuild zielony, tsc zielony, klucz ISTNIAŁ w JSON |
| 2 z 8 ekranów w error-boundary mimo zielonego esbuilda | **ja, otwierając je** | ❌ smoke jest strukturalny, nie renderuje |
| „Zrobione" neutralne w Inbox, zielone w Task | **Piotr, na zrzucie** | ❌ obie wartości legalne osobno |
| Wartości w panelu Initiative jako ciemne prostokąty | **Piotr, na zrzucie** | ❌ poprawny HTML, poprawne tokeny |
| Dublet „Submit for Review" (nagłówek + blok) | **Piotr, na zrzucie** | ⚠️ dev-warn w powłoce — ale powłoka nieużywana |

**Wniosek, który trzeba przyjąć, a nie obejść:** klasa wad „technicznie poprawne, wizualnie
złe" jest **niewykrywalna maszynowo**. Bramki chronią przed regresją **struktury**.
Przed regresją **wyglądu** chroni wyłącznie obejrzenie ekranu.

Stąd harness nie jest wygodą — jest **jedynym** narzędziem na tę klasę wad.

---

## 4. TRZY POZIOMY OBRONY — model docelowy

```
POZIOM 1  TYP          błąd kompilacji      koszt utrzymania: ZERO      dziś: ❌ wyłączony
POZIOM 2  BRAMKA       blokada commita      koszt: niski                dziś: ⚠️ pół
POZIOM 3  OKO          zrzut przed odbiorem koszt: wysoki, nieusuwalny  dziś: ✅ działa
```

**Reguła projektowania bramek:** każdą regułę pchaj tak wysoko, jak się da.
Jeśli da się wyrazić typem — nie rób z niej hooka. Jeśli da się hookiem — nie zostawiaj jej
liście czekowania. Na poziom 3 zostawiaj **tylko** to, czego naprawdę nie da się zmierzyć.

Dziś mamy odwrotnie: prawie wszystko wisi na poziomie 3, czyli na mnie.

---

## 5. PLAN UTRZYMANIA — 6 kroków, w kolejności zwrotu

| # | Krok | Efekt | Koszt |
|---|---|---|---|
| **U1** | **Przepiąć 7 kart na `StandardArtifactShell`** (fala Z) | poziom 1 zaczyna działać; 9 reguł staje się błędami kompilacji | dzień+ |
| **U2** | `KARTY_N_STRICT=1` na stałe po U1 | 3 reguły kart N przechodzą z ostrzeżenia w blokadę | godzina |
| **U3** | **Wpiąć bramki w `.husky/pre-commit`** (dziś `exit 0`) | działa dla KAŻDEGO, nie tylko dla agenta Claude | godzina |
| **U4** | **Dodać bramki do CI** (nowy workflow albo `test-suite.yml`) | działa też, gdy ktoś ominie hooka lokalnie | godzina |
| **U5** | Wpiąć `check-gestosc.sh` do `.claude/settings.json` | trzecia bramka przestaje leżeć bezużytecznie | 15 min |
| **U6** | **Smoke renderujący** — otwiera 7 ekranów harnessu i sprawdza brak error-boundary | jedyna automatyzacja klasy „runtime"; złapałaby dzisiejsze 2 z 8 | dzień |

**U3 i U4 są najtańsze i dają najwięcej** — bez nich każda inna bramka działa tylko dla mnie.

---

## 6. RYZYKA UTRZYMANIOWE — co zabije standard mimo bramek

1. **Dokumenty-widma.** Rano: 5 skilli kazało czytać dokumenty, których nie ma. Wieczorem
   sam kazałem 7 agentom czytać `_ANALIZA_A1` nieobecną w gałęzi. `sprawdz-zrodla.mjs`
   to wykrywa — **ale nikt jej nie uruchamia** (U3/U4).
2. **Rozjazd gałęzi.** Główny checkout stoi na `oxford/oc2-merge`, ~2000 commitów za demo.
   Numery linii z A1 nie zgadzają się z `origin/demo`. Kosztowało mnie to dziś jedną błędną
   diagnozę. **Reguła: kod czytaj przez `git show origin/demo:<ścieżka>`.**
3. **Bramka w trybie raportu zostaje w trybie raportu.** `check-artefakt.sh` ma dziś 3 reguły
   nieblokujące, bo karty ich nie spełniały. Spełniają (10→0). **Jeśli U2 się nie wydarzy,
   dług wróci cicho.**
4. **Agent raportuje sukces, którego nie ma.** 7/7 zgłosiło „zrobione"; wzrokiem znalazłem
   13 wad. Reguła: **raport agenta = deklaracja, nie dowód.**
5. **Martwy kod maskuje stan.** ~2500 linii nieosiągalnych bloków (Task D-mode, Notification
   C-mode). Bramki je liczą, ludzie je czytają, nikt ich nie wykonuje.

---

## 7. CO ROBIĆ PRZY KAŻDEJ NOWEJ KARCIE — lista, nie proza

1. Wpis w `registry.ts` (bez wpisu smoke nie widzi karty)
2. Ekran w `dev-render/screens/karta-*.tsx`
3. Karta importuje `StandardArtifactShell` (po U1 — inaczej brak bramki typu)
4. `node scripts/karty-n-smoke.mjs` → 8/8
5. `bash scripts/check-artefakt.sh` → zero blokujących
6. **Otwarcie w harnessie, jasny i ciemny** — zrzut do odbioru Piotra
7. Odbiór Piotra na zrzucie **przed** demo

---

## 8. UCZCIWE PODSUMOWANIE

**Co się poprawiło dziś naprawdę:** z „standard opisany prozą, którą wszyscy łamią"
przeszliśmy do „standard wyrażony typem, z bramkami i mierzalnym wynikiem" (10→0 naruszeń).
To jest realny skok, nie kosmetyka.

**Czego nie wolno sobie wmówić:** bramki **nie są jeszcze wpięte**. Dziś standardu pilnuje
ten sam mechanizm, co wczoraj — czyjaś uwaga. Różnica jest taka, że teraz istnieje narzędzie,
które tę uwagę może zastąpić. **Wpięcie go to U1–U4 i to jest cała robota utrzymaniowa,
jaka została.**

Dopóki U1 nie zostanie zrobione, zdanie „standard się broni" jest nieprawdziwe.

---

*Wszystkie liczby zmierzone poleceniami w tej sesji. Gdzie czegoś nie sprawdziłem —
napisane wprost.*
