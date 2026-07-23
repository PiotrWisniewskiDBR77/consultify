# Instrukcja dla sesji roboczych — odbiór i standard n-Type (2026-07-23)

> Właściciel testuje dziś wasze obszary. Ta notatka mówi, co się dzieje, czego od was potrzeba
> i czego **nie** robić. Nadzór scalenia: sesja Consultify Master (worktree `.worktrees/odbior-hub`).

---

## 1. Co się zmieniło

**Odbiór idzie przez klikanie, nie przez zrzuty.** Jedna strona lokalna:
`http://localhost:3000/odbior.html` — 18 obiektów w pięciu grupach, każdy otwierany w całości
w jasnym i ciemnym motywie. Zrzuty jako metoda odbioru **odpadły** (decyzja właściciela).

**Uwagi zbiera system, nie czat.** Na każdym ekranie jest przycisk „Uwagi" (prawy dolny róg),
przy każdej pozycji listy przycisk „uwaga". Zapis natychmiastowy do `odbior-uwagi/<ekran>.json`
w worktree hubu. Werdykt per obiekt: **bierzemy / popraw / nie**. Dodatkowo matryca ocen
(6 kart N × 5 osi 0–10) → `odbior-uwagi/_oceny.json`.

**Powstał twardy standard n-Type v1.0** — `Harvard/wdrozenie-100/_STANDARD_N_TYPE_2026-07-23/`.
Siedem plików: standard wspólny + sześć list błędów per artefakt. **Ma pierwszeństwo** nad
wcześniejszymi ustaleniami i nad uwagami z panelu.

**Kart N jest SZEŚĆ, nie siedem:** Decyzja · Zadanie · Powiadomienie · Insight · Narzędzie · Inicjatywa.
Sesja wywiadu **nie jest kartą N** — to narzędzie, a moduł Interview ma własny model artefaktu.

---

## 2. Czego potrzebuję od was

### 2.1. Żeby wasza praca trafiła do odbioru

1. Pracujecie jak dotąd: świeża gałąź z `origin/demo`, commit-per-krok, **bez push**.
2. Ekran do obejrzenia = plik w `dev-render/screens/` + wpis w `dev-render/main.tsx`:
   ```
   'moj-ekran': { label: 'OBSZAR — co widać na ekranie', render: () => <MojEkran /> },
   ```
   Obszary rozpoznawane: `KARTY N`, `IDEE`, `DOKUMENTY`, `AGENT`.
3. Zgłaszacie nadzorcy **nazwę gałęzi**. Scalenie, regenerację strony i weryfikację robi nadzorca.

### 2.2. Zanim powiecie „gotowe"

Uruchomcie audyt środowiska na swoim ekranie — sprawdza to, co realnie blokuje odbiór:
```bash
node scripts/odbior-audyt.mjs
```
Ekran przechodzi, gdy ma: realną treść, powłokę, elementy do kliknięcia, panel uwag,
zero czerwieni `#85182F`, czytelny ciemny motyw, czystą konsolę.

---

## 3. Czego NIE robić

- **Nie promować niczego na demo** bez akceptu właściciela — obowiązuje bez zmian.
- **Nie edytować `dev-render/odbior.html`** — jest generowany przez `scripts/odbior-hub.mjs`.
- **Nie dodawać statycznych importów ekranów** w `main.tsx` — ekrany idą przez `React.lazy`.
  Powód niżej, w pułapkach. To wymóg poprawności, nie styl.
- **Nie zmieniać plików w `odbior-uwagi/`** — to zapis właściciela.

---

## 4. Pułapki, które już nas kosztowały (świeże, z dziś)

- **Kolizja stubów sieciowych.** Każdy screen harnessu podmienia `window.fetch` jako efekt uboczny
  importu. Przy statycznych importach ładowały się wszystkie naraz i stub ekranu ładowanego później
  przechwytywał żądania ekranu otwartego — karta Inicjatywy pokazywała „Nie udało się załadować".
  Naprawione przez `React.lazy`. Nie cofajcie tego.
- **`?theme=dark` dawał jasny ekran.** `AppProviders` mają własny ThemeSync, który czytał motyw
  systemowy przeglądarki i nadpisywał klasę z adresu. Naprawione w `main.tsx` (store + obserwator).
- **`dark:via-*` w Tailwindzie NIE działa** w tym projekcie — 36 reguł `via-*`, zero z wariantem
  ciemnym. Każde `via-white dark:via-<token>` zostawia białą smugę w ciemnym motywie.
  Używajcie jednego tokenu (`via-c-surface`), który sam zmienia wartość.
  **Zostaje 20 takich miejsc w 13 plikach** — nie ruszajcie ich bez uzgodnienia, idą jednym przejściem.
- **Animacja wejścia** (opacity 0.18 → 1): zrzut zaraz po nawigacji łapie mid-fade i wygląda na
  wyblakły ekran. Odczekajcie ~5 s.
- **Nowy worktree nie ma `node_modules`** — potrzebny symlink do głównego repo.

---

## 5. Co robi nadzorca (Consultify Master)

- scala gałęzie do `odbior/hub-2026-07-23`, regeneruje stronę, weryfikuje render **przed** pokazaniem
  właścicielowi (reguła: właściciel nigdy nie jest pierwszym testerem wizualnym),
- czyta uwagi i oceny z dysku, rozdziela je na obszary,
- prowadzi przebudowę wspólnego szkieletu n-Type (patrz `_PLAN_STANDARD_N_TYPE_2026-07-23.md`).

Pytania i zgłoszenia gałęzi — do nadzorcy, nie bezpośrednio do właściciela.
