# Protokół wspólnego odbioru — jedna strona na porcie 3000

> Decyzja właściciela (2026-07-23): **odbiór przez klikanie, nie przez zrzuty.** Wszystkie obszary
> lądują w jednym miejscu — `http://localhost:3000/odbior.html` — i właściciel przechodzi je po kolei.
> Nadzór scalenia: sesja Consultify Master (ta, która utrzymuje worktree `.worktrees/odbior-hub`).

## Gdzie to żyje

| | |
|---|---|
| Worktree integracyjny | `.worktrees/odbior-hub`, gałąź `odbior/hub-2026-07-23` (baza `origin/demo`) |
| Strona odbioru | `http://localhost:3000/odbior.html` (generowana, **nie edytuj ręcznie**) |
| Generator strony | `scripts/odbior-hub.mjs` — czyta rejestr `dev-render/main.tsx` |
| Odświeżenie po dokładce | `./scripts/odbior-hub-odswiez.sh <gałąź> [...]` |
| Serwer | wpis `odbior-3000` w `.claude/launch.json` (główne repo) |

## Co robi sesja robocza, żeby jej praca trafiła do odbioru

1. Pracujesz jak dotąd: świeża gałąź z `origin/demo`, commit-per-krok, **bez push**.
2. Ekran do obejrzenia dodajesz do harnessu: plik w `dev-render/screens/` + wpis w `dev-render/main.tsx`.
3. **Etykieta wpisu decyduje o sekcji na stronie odbioru.** Konwencja:
   ```
   'moj-ekran': { label: 'OBSZAR — co widać na ekranie', render: () => <MojEkran /> },
   ```
   Rozpoznawane obszary: `KARTY N`, `IDEE`, `DOKUMENTY`, `AGENT`. Inny prefiks = ekran wyląduje
   w „pozostałe" na dole strony (nadal klikalny, ale poza partią).
4. Zgłaszasz nadzorcy **nazwę gałęzi**. Nic więcej — scalenie, regenerację i weryfikację robi nadzorca.

## Co robi nadzorca

1. `./scripts/odbior-hub-odswiez.sh <gałąź>` — świeże demo, merge gałęzi, regeneracja strony, smoke HTTP.
2. **Przeklikanie po jednym ekranie z każdego obszaru** — HTTP 200 to nie dowód renderu.
   Reguła nienaruszalna: właściciel nigdy nie jest pierwszym testerem wizualnym.
3. Ludzka nazwa ekranu w `OPISY` w generatorze (bez nazw komponentów, flag, numerów zadań).
4. Dopiero wtedy „gotowe do klikania" do właściciela.

## Jak wygląda decyzja właściciela

Per **obszar**, nie per plik: **bierzemy** / **popraw &lt;co&gt;** / **nie**.
Obszary są niezależne — odrzucenie jednego nie blokuje pozostałych. Po „bierzemy" nadzorca
promuje ten obszar na demo (skill `consultify-promocja-demo`, merge nie force) i re-taguje `demo-safe`.

## Znane pułapki tej konstrukcji

- **`dev-render/main.tsx` to jedyne miejsce kolizji** między sesjami (wszyscy dopisują importy).
  Rozwiązanie konfliktu = zawsze OBA wpisy; import ekranu VLT-003 **musi zostać ostatni**
  (instaluje stub `window.fetch` owijający pozostałe — patrz komentarz w pliku).
- **Nowy worktree nie ma `node_modules`** — potrzebny symlink do głównego repo, inaczej vite nie wstanie.
- **Ekrany mają animację wejścia** (opacity 0.18 → 1). Zrzut zaraz po nawigacji łapie mid-fade i wygląda
  na „wyblakły ekran". Odczekaj ~5 s albo sprawdź `document.getAnimations()`.
- **Dane w harnessie są przykładowe** — odbieramy wygląd i zachowanie, nie treść. Treść AI to osobna partia.
