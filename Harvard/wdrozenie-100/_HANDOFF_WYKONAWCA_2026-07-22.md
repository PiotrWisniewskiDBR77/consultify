# HANDOFF — sesja Wykonawcy, 2026-07-22

Rola: **Wykonawca** rejestru (`.claude/agents/consultify-wykonawca.md`). Bierze zadania
`wlasciciel: wykonawca` z `rejestr/1-OTWARTE`, wykonuje, weryfikuje w żywym runtime, oddaje na 🧪.
NIE pushuje, NIE odbiera, NIE tworzy zadań, NIE rusza SWOT bez polecenia.

---

## CO ZROBIONE W TEJ SESJI

### TAB-002 — ZROBIONE, czeka na odbiór Piotra (🧪)
- **Plik:** `rejestr/3-DO-ODBIORU/TAB-002-lista-sesji-ukrywa-wszystko-co-zatwierdzone.md` (pełne DOWODY + DZIENNIK).
- **Commit:** `273583ca91`, gałąź `fix/TAB-002`, worktree `.worktrees/tab-002`, baza `origin/demo` (`79cb925bdb`). **NIE pushnięte.**
- **Co naprawione:** zakładka Tools → Sessions ukrywała zatwierdzone sesje. Dwa odcięcia naraz:
  (1) klient trzymał tylko DRAFT/PENDING_REVIEW (`DiscoveryToolsHub.tsx:1020`);
  (2) serwer domyślnie ucinał do 50 wierszy (klient nie podawał `limit`). Naprawione oba + dodana pigułka Approved.
- **Dowód:** sonda HTTP (50/99 → 99/99), zapytanie do żywej bazy, zrzuty ekranu (All 22 → All 108 · Approved 59, filtr zawęża do 59). esbuild czysty, eslint 0 errorów.
- **UWAGA dla Piotra — kryterium odbioru „licznik 105" JEST NIEWYKONALNE:** 105 = suma DWÓCH organizacji (DBR77 99 + Atelier Toys 6). Serwer filtruje po jednej org, więc nikt nie zobaczy 105. Poprawna wartość dla DBR77 = 99 sesji (na ekranie 108, bo +9 Assessment). Sesja „Atelier Forward" jest w Atelier Toys, nie DBR77. Master musi poprawić tę część kryterium.
- **Znalezisko poza zakresem (do decyzji Mastera, NIE naprawione):** zakładka Library nie wstaje na backendzie read-only — jej bootstrap ZAPISUJE do bazy przy zwykłym otwarciu ekranu. Wygląda na osobny błąd.

### PRV-001 — ZWRÓCONE do 1-OTWARTE, NIE wykonane
- **Plik:** `rejestr/1-OTWARTE/PRV-001-kebab-w-podgladzie-ma-jedna-pozycje.md` (powód w DZIENNIKU).
- Przyczyna i rozwiązanie w zadaniu są **obalone kodem z origin/demo**: zła ścieżka pliku (jest `src/components/shared/PreviewPane/`, nie `src/components/preview/`); `defaultActions` to lista warunkowa, dla ekranów fasady zawsze PUSTA; scalanie z pustą listą = operacja pusta. „Żelazny zestaw 5 pozycji" NIE istnieje w kodzie jako standard — jest ręcznie powtórzony tylko w `DecisionPreviewPanel`.
- **Blokada:** brak decyzji, gdzie fasada `StandardPreview` ma wytwarzać brakujące pozycje (dziś `StandardPreviewDetails` nie ma pól `onExpand`/`onSummarize`). To sekcje 2-3 do przepisania przez Mastera. Wykonawca nie zgaduje zakresu.

### SWOT-001 / SWOT-003 — NIE brać
- Priorytet NISKI (decyzja Piotra 21.07 zapisana w DZIENNIKU obu). Gałąź `fix/swot-ai-null-fields` (commity `c9780fda8e` + `649f9b2e65`) jest CAŁA mimo skasowanego worktree `.worktrees/swot-fix` — sprawdzone reflogiem (3 wpisy, zero dangling). Nie odtwarzać od nowa. SWOT-003 i tak wymaga zrzutu od Mastera (kryterium: „Master pokaże zrzut wymuszonej awarii").

---

## ⚠️ LIMIT KOLEJKI — WYCZERPANY
W `rejestr/3-DO-ODBIORU/` leży **16 zadań**, Piotr nic nie odebrał. Instrukcja Wykonawcy:
przy 15+ niezweryfikowanych — STOP po trzecim swoim zadaniu i raport. **Nie brać nowych zadań,
dopóki Piotr nie odbierze części kolejki.** Ja wziąłem jedno (TAB-002) + zwróciłem jedno (PRV-001).

---

## STAN TECHNICZNY / JAK POWTÓRZYĆ WERYFIKACJĘ EKRANU (bez hasła Piotra)
- Baza kodu ZAWSZE `origin/demo` — czytaj przez `git show origin/demo:<ścieżka>`. Główny checkout stoi na `oxford/oc2-merge` (~2000 commitów za demo, dokumentacyjna).
- Weryfikacja ekranu: wpis `tab-002-verify` w `.claude/launch.json` (plik POZA gitem) uruchamia backend read-only (`DB_READONLY=1`, zapisy zablokowane) + front z worktree. `preview_start` name=`tab-002-verify`.
- Token OWNER mintowany sekretem z `.env` (`JWT_SECRET`), payload `{id,email,role,organizationId,jti}`, wstrzykiwany do `localStorage.token`. Hub narzędzi pod **`/discovery-tools`** (nie `/tools` — to marketing). W read-only zakładka Library nie wstaje (zapisuje przy starcie) — używaj Sessions.
- Worktree `.worktrees/tab-002` ma dowiązane `node_modules` z głównego checkoutu i skopiowane pliki `.env*`.
- Bramki przed 🧪: `esbuild <plik> --bundle --platform=browser "--external:*" --outfile=/dev/null`, `eslint <plik>` (0 errorów; warningi `any`/hex pre-istniejące OK). Bez pełnego tsc/vitest.

## NASTĘPNY RUCH
Jeśli Piotr odblokuje kolejkę (odbierze część 🧪) → następne krytyczne moje zadanie: **TER-001**
(„Teresa nie widzi ekranu użytkownika — odpowiada o innym module"). Potem wg wagi z `rejestr/INDEKS.md`,
tylko `wlasciciel: wykonawca` (sprawdzać w pliku, indeks nie filtruje). Zostaje ~19 moich zadań.
