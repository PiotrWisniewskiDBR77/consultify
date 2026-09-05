## Po co ten dyżur istnieje

Ekran „Czat AI" (`/chat`) wygląda kompletnie, ale trzy elementy jego nagłówka są
okablowane do propsów, których **żadna trasa `/chat` nie przekazuje**. Kod działa —
gdyby ktoś podał właściwy prop, przycisk by zadziałał — ale nikt go nie podaje.
To jest dokładnie kształt „wołacz istnieje, nie renderuje się": grep znajduje kod,
użytkownik nie widzi funkcji.

**K2 — przycisk „Akcje biznesowe" (Briefcase) nigdy się nie renderuje.**
`UnifiedChatPanel.tsx:6786`: `{onNavigateToActions && (...)}`. Prop
`onNavigateToActions` jest **zdefiniowany, destrukturyzowany i użyty wyłącznie
wewnątrz `UnifiedChatPanel.tsx` samego** (`:745`, `:798`, `:6786`, `:6793`) —
**żadne** z miejsc montowania komponentu w całej aplikacji go nie podaje.
Audyt `C_naglowek_historia.md` (D-1) to zgłosił jako defekt lokalny trasy `/chat`;
weryfikacja `V1_weryfikacja_P1.md` (pkt 3) poszła dalej i sprawdziła WSZYSTKIE
miejsca montowania — wniosek: **przycisk jest martwy w skali całego produktu**,
nie tylko na ekranie czatu.

**K6 — Pomoc → „Zapytaj AI teraz" gubi wiadomość na `/chat`.**
`HelpSidePanel.tsx:307-341` (`openAiNow`) zapisuje treść w globalnym store
(`setChatKickoffMessage(prompt)`, `:324`) i (na desktopie) liczy na to, że
istniejący, już otwarty panel czatu ją podejmie. Ale `UnifiedChatPanel` czyta
kickoff **wyłącznie z propa** `kickoffMessage` (`:763`, `:804-805`, efekt
`:5006-5025`), nigdy ze store'u. Jedyne miejsce w całym `src/`, które **czyta**
`chatKickoffMessage` ze store'u i przekazuje go dalej jako prop, to
`MainLayout.tsx:82-83,505-506` — **wewnętrzny, split-panelowy montaż Teresy**,
który `MainLayout` **świadomie wyłącza** dla widoku `AppView.AI_CHAT`
(`VIEVS_WITHOUT_CHAT_PANEL` zawiera `AppView.AI_CHAT`, `MainLayout.tsx:102-119`,
`132-134` — „Full-screen chat mode — no split panel"). Na `/chat` i `/chat/:id`
(`AppRoutes.tsx:1770-1782`, `1857-1869`) `UnifiedChatPanel mode="full"` jest
więc wołany **bez żadnego propa poza `mode`** — kickoff nie ma jak dotrzeć.
Audyt `F_rama_ekranu.md` (D-1) to zgłosił; weryfikacja `V2_weryfikacja_P1_i_probka.md`
(pkt 4) potwierdziła niezależnym dowodem dokładnie ten sam łańcuch.

**C D-4 — etykieta przycisku panelu roboczego nigdy nie mówi „zamknij".**
`UnifiedChatPanel.tsx:6845-6856`: `title`/`aria-label` to zawsze
`t('aiChat.workPanel.open', 'Open work panel')`, niezależnie od tego, czy panel
jest już otwarty (`showWorkPanel`, `:6499`). Sąsiedni przycisk wyciszenia
(`:6881-6894`) POPRAWNIE zmienia etykietę na podstawie stanu — to jest wzorzec
do skopiowania, nie do wymyślenia od nowa.

**Wspólny mianownik wszystkich trzech:** propsy, które istnieją w typie
(`UnifiedChatPanelProps`), są poprawnie obsłużone wewnątrz komponentu, ale
konkretna trasa `/chat` ich nie dostarcza. Dlatego `KROK 0` tego dyżuru każe
wypisać **całą rodzinę** takich propsów, nie tylko dwa zgłoszone (`R2`).

## ★ Stan zastany, zmierzony przeze mnie na markerze `9715bab7eabe0a8489b24cf0f0aa3cbf0d97da6c`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| deklaracja/użycie `onNavigateToActions` w całym `src/` | **4 wystąpienia, wszystkie w `UnifiedChatPanel.tsx`** | `:745` (typ), `:798` (destrukturyzacja), `:6786`+`:6793` (render/klik) |
| montaże `<UnifiedChatPanel` (JSX, realne) w całym `src/` | **11**, w **9 plikach** (dwa pliki mają po 2 montaże) | patrz tabela mianowników #1 — **audyt/V1 mówią „10" — mój grep daje 11, zapisz rozbieżność** |
| montaże przekazujące `onNavigateToActions` | **0 z 11** | żaden |
| montaże przekazujące `kickoffMessage` | **1 z 11** (`MainLayout.tsx:505`) — ale ten montaż jest wyłączony na widoku `AI_CHAT` | `MainLayout.tsx:102-134` (`VIEWS_WITHOUT_CHAT_PANEL` zawiera `AppView.AI_CHAT`) |
| jedyny konsument-czytelnik `chatKickoffMessage` ze store'u | `MainLayout.tsx:82-83,505-506` | `useAppStore((s) => s.chatKickoffMessage)` / `clearChatKickoffMessage` jako `onKickoffConsumed` |
| zapis do `chatKickoffMessage` ze store'u | `HelpSidePanel.tsx:268,324` (`openAiNow`) **oraz** `UnifiedChatPanel.tsx` samo (`:3117,3504,3755,3960`, wewnętrzny redirect do innego narzędzia) | `useAppStore.getState().setChatKickoffMessage(...)` |
| trasy `/chat` / `/chat/:id` — propsy przekazane do `UnifiedChatPanel` | **wyłącznie `mode="full"`** | `AppRoutes.tsx:1778`, `:1865` |
| etykieta przycisku panelu roboczego | zawsze `aiChat.workPanel.open` | `UnifiedChatPanel.tsx:6851-6852` |
| klucz `aiChat.workPanel.close` w słownikach | **NIE ISTNIEJE** (pl i en mają wyłącznie `.open`) | `public/locales/pl/translation.json:18843-18845`, `public/locales/en/translation.json:17596-17598` |
| inne propy `UnifiedChatPanelProps`, które `/chat` pomija i które warunkują render elementu przez `{prop && (...)}` | **`quickPrompts`** (`:7419`), **`contextActions`** (`:7399`) — poza już zgłoszonymi `onNavigateToActions`/`kickoffMessage` | grep `{quickPrompts &&`, `{contextActions &&` w `UnifiedChatPanel.tsx` |
| `useAppStore` w globalnej infrastrukturze testowej | **zamockowany globalnie**, statyczny stan **BEZ** `chatKickoffMessage`/`setChatKickoffMessage`/`clearChatKickoffMessage` i **BEZ** `getState()` | `tests/setup.ts:718-777` (dwa bloki `vi.mock`, alias i ścieżka względna) |
| test renderujący realny `<UnifiedChatPanel>` (nie mock, nie `readFileSync`) gdziekolwiek w repo | **0** | `grep` po `__tests__` — każdy istniejący test albo mockuje komponent, albo czyta jego źródło jako tekst |
| `scripts/dev/reachability-from-root.mjs --check-baseline` na tym markerze | **exit 1** — ZASTANE, niezwiązane z czatem | 3 pliki testowe już scommitowane w markerze, nieobecne w `reachability.baseline.json` (`git log` potwierdza commit `e67e7565…`) |
| leaf-count słowników | **pl 34331**, **en 32342** | licznik rekurencyjny z `§0.2`/warunków wspólnych |
| ostatnia użyta litera w `REJESTR_ZNALEZISK_20260903.md` w chwili pisania tej instrukcji | **`AF`** (dyżur 365) | `grep -nE '^## [A-Z]+\.' … \| tail -5` — **sprawdź SAM tuż przed commitem, inni autorzy piszą równolegle** |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **4** wystąpienia `onNavigateToActions` (wszystkie w
`UnifiedChatPanel.tsx`); **11** realnych montaży `<UnifiedChatPanel` w **9**
plikach (audyt mówi „10" — **Twój pomiar rozstrzyga**); **0** montaży
przekazujących `onNavigateToActions` lub działający `kickoffMessage` na `/chat`;
etykieta panelu roboczego niezmienna w **1** miejscu (`:6851-6852`); **2**
dodatkowe propy z rodziny (`quickPrompts`, `contextActions`) poza dwoma
zgłoszonymi; `useAppStore` zamockowany globalnie **bez** trzech pól kickoffu;
**0** istniejących testów renderujących realny `UnifiedChatPanel`; `reachability
--check-baseline` **already RED (exit 1)** na samym markerze, z przyczyną
niezwiązaną z czatem; leaf-count **pl 34331 / en 32342**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ
pomiar — zapisz rozbieżność wprost.** W szczególności: jeżeli Twoje 11 montaży
różni się od mojego — wklej pełną listę `plik:linia` obu przebiegów.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: KOMPONENT · TRASA (TYLKO REFAKTOR TESTOWALNOŚCI) · STORE · POMOC · FLAGI · SŁOWNIKI · TESTY

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast
zmiany brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem
jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Komponent — cel naprawy** | `src/components/AIChat/UnifiedChatPanel.tsx` | **PEŁNA LICENCJA** na: (a) fallback nawigacji „Akcje biznesowe" za nową flagą `R1`; (b) fallback kickoffu ze store'u `R2`; (c) etykieta zmienna panelu roboczego `R3`. **Zakaz** zmiany logiki niezwiązanej z tymi trzema pozycjami (np. V8, sygnałów, TTS) | — |
| **Trasa `/chat` — TYLKO refaktor testowalności** | `src/routes/AppRoutes.tsx`, bloki `ROUTES.AI_CHAT` (`:1770-1782`) i `ROUTES.AI_CHAT_CONVERSATION` (`:1857-1869`) | **★ WĄSKA LICENCJA**: wolno wydzielić te dwa bloki do nazwanych, eksportowanych komponentów (`AiChatRoute`, `AiChatConversationRoute`), **dokładnie wzorem** `AssessmentOutputReportRoute`/`AssessmentOutputPresentationRoute` (`:838-857`) — **identyczna treść JSX**, zero zmiany propsów przekazywanych do `UnifiedChatPanel` czy `MainLayout`. **Zakaz** dodawania jakiegokolwiek nowego propa w tym pliku (fix mieszka wyłącznie w `UnifiedChatPanel.tsx`) | Brief z `plik:linia` + diff **nienałożony**, jeśli refaktor okaże się niewykonalny bez zmiany zachowania |
| **Store kickoffu (odczyt + weryfikacja kompletności)** | `src/store/slices/uiSlice.ts` (`:45-47,176,231-232`) | **TYLKO ODCZYT** — `chatKickoffMessage`/`setChatKickoffMessage`/`clearChatKickoffMessage` już istnieją i są kompletne; fallback w `R2` ma z nich korzystać, nie duplikować | Brief |
| **Pomoc (nadawca kickoffu)** | `src/components/Help/HelpSidePanel.tsx` (`:307-341`) | **TYLKO ODCZYT** — to jest dowód, nie cel naprawy; `R2` naprawia stronę odbiorczą | Brief |
| **`MainLayout` (jedyny istniejący konsument kickoffu)** | `src/layouts/MainLayout.tsx` (`:82-83,102-134,505-506`) | **TYLKO ODCZYT** — pokazuje wzorzec (`kickoffMessage`/`onKickoffConsumed`) i dowodzi, że na widoku `AI_CHAT` jest świadomie wyłączony. **Zakaz** dopisywania tu drugiego montażu czy obchodzenia `VIEWS_WITHOUT_CHAT_PANEL` | Brief |
| **Rejestr flag** | `src/hooks/useFeatureFlags.tsx`, tablica `DEFAULT_FLAGS` | **★ WĄSKA LICENCJA**: wolno dopisać JEDEN nowy wpis (`id` wg `R1`), `defaultValue: false`, `allowLocalOverride: true`. **Zakaz** zmiany wartości domyślnej jakiejkolwiek istniejącej flagi | — |
| **Kandydaci nawigacji „Akcje biznesowe"** | `src/views/ActionProposalView.tsx`, `src/components/AIChat/ActionCenter.tsx`, `src/routes/routeConfig.ts` (stałe `AI_ACTIONS`, `AI_OS.ACTION_CENTER`), `src/utils/internalToolsAccess.ts` | **TYLKO ODCZYT** — służą do WYBORU celu nawigacji w `R1`, nie do zmiany | Brief z uzasadnieniem wyboru |
| **Słowniki** | `public/locales/pl/translation.json:18843-18845`, `public/locales/en/translation.json:17596-17598` | **★ WĄSKA LICENCJA**: wolno dopisać dokładnie JEDEN nowy liść `aiChat.workPanel.close` w KAŻDYM z dwóch plików, wartość PO POLSKU w `pl` i po angielsku w `en` (nie kalka). Reszta pliku **NIETYKALNA**, liście nie mogą zmaleć | — |
| **Testy — obszar czatu (kolokowane, wzorzec istniejący)** | `src/components/AIChat/__tests__/**`, `src/routes/__tests__/**` | **PEŁNA LICENCJA** na nowe pliki (wzorzec kolokacji tego katalogu — **NIE** `tests/` root, bo tu wszystkie istniejące testy `AIChat` mieszkają kolokowane z komponentem). Nowe pliki nie wymagają `git add -f` (nie leżą pod `tests/`), ale sprawdź to SAM przed commitem | — |
| **Infrastruktura testowa — NAJOSTRZEJSZE** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT, `Z18`.** Globalny mock `useAppStore` (`tests/setup.ts:718-777`) **NIE MA** pól kickoffu i **NIE MA** `getState()` — nadpisujesz go **lokalnie**, wewnątrz WŁASNEGO pliku testowego (`vi.mock(...)` na początku tego pliku), nigdy globalnie | Brief, jeśli lokalne nadpisanie okaże się niewystarczające |
| **Baseline osiągalności** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA**: wolno zaktualizować WYŁĄCZNIE przez `node scripts/dev/reachability-from-root.mjs --update-baseline` (mechanizm skryptu, nie ręczna edycja), i tylko żeby zarejestrować pliki testowe, które SAM dodałeś w tym dyżurze. **Zakaz** rejestrowania cudzych 3 plików (ZASTANE, patrz `R4`) jako Twoich, chyba że `R4` każe to zrobić z uzasadnieniem | Brief |
| **Bezpieczniki kanonu i skrypt osiągalności (logika)** | `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`, `scripts/dev/reachability-from-root.mjs` | **NIETYKALNE DO ZAPISU** (`Z12`) — wolno wyłącznie URUCHAMIAĆ | Opis w raporcie |
| **Produkt poza zakresem (V8, sygnały, historia, foldery)** | `src/components/AIChat/**` poza `UnifiedChatPanel.tsx` | **TYLKO ODCZYT** | Opis w raporcie |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy** (`Z13`) | — |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej tuż przed commitem | — |
| **Nowe dowody** | `evidence/przewody-chat/**` (**NIE ISTNIEJE — tworzysz**) | **PEŁNA LICENCJA**; commitujesz normalnie (nie pod `tests/`, `git add -f` niepotrzebny) | — |
| **Macierz odbioru, rejestry bramek G15/G19/G20** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **NIETYKALNE DO ZAPISU** — poza zakresem tego dyżuru | Rekomendacja w raporcie |
| **Cudze tereny** | wszystkie pliki audytu `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**` · pozostałe defekty D-2/D-3/D-5/D-6 z `C_naglowek_historia.md` (i18n bulk, martwy `ChatExportModal`) · V8/`myWorkSignalsV2`/private mode · rodzeństwo 367/369-373 | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff nienałożony |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC (maja WZROSNAC o dokladnie 2: workPanel.close x pl/en)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 34331, en 32342 — PO: dokladnie +1 w kazdym

# (b) trzy bezpieczniki kanonu maja konczyc sie kodem 0 -- NIEZALEZNE od tego dyzuru
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0 na markerze

# (c) ★ osiagalnosc — JUZ NA MARKERZE konczy sie kodem 1, z przyczyny NIEZWIAZANEJ z czatem
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby: reach=1, log wskazuje 3 nowe pliki testowe (Initiatives/assessment/admin),
#   juz scommitowane na markerze, nieobecne w reachability.baseline.json.
#   NIE PRÓBUJESZ TEGO "NAPRAWIAĆ" — to nie jest Twoja regresja. Zmierz ten sam log
#   PO swoich zmianach: dopuszczalny wynik to TEN SAM log plus (opcjonalnie) Twoje wlasne
#   nowe pliki testowe zarejestrowane przez `--update-baseline`. Jakikolwiek INNY plik
#   znikający lub pojawiający się w tym logu jest STOP-em do wyjasnienia w raporcie.
```

**Jeżeli liczba słowników zmaleje, bramka `list-canon`/`focus-canon`/`artefakt` się
zaczerwieni od Twojej zmiany, albo log `reach` urośnie o coś INNEGO niż Twoje własne
nowe testy — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | montaże `<UnifiedChatPanel` (JSX realne, bez definicji i komentarzy) | `11` w `9` plikach | `bash -c "grep -rn '<UnifiedChatPanel' src/ \| grep -v 'export const UnifiedChatPanel' \| grep -v teresaEntityContext.ts"` | TAK — **audyt/V1 mówią „10"; wypisz pełną listę `plik:linia` i porównaj** |
| 2 | wystąpienia `onNavigateToActions` w `src/` | `4`, wszystkie w `UnifiedChatPanel.tsx` | `grep -rn "onNavigateToActions" src/` | TAK |
| 3 | montaże przekazujące `kickoffMessage` | `1` (`MainLayout.tsx:505`), świadomie wyłączony na `/chat` | `grep -rn "kickoffMessage=" src/` + `MainLayout.tsx:102-134` | TAK |
| 4 | dodatkowe propy rodziny `{prop && (...)}` pomijane przez `/chat` | `2` (`quickPrompts`, `contextActions`) poza dwoma zgłoszonymi | KROK 0 z `R2` — grep każdego propa z `UnifiedChatPanelProps` | TAK — **wypisz WSZYSTKIE, nie tylko te dwa; jeśli znajdziesz więcej, dopisz** |
| 5 | testy renderujące realny `UnifiedChatPanel` (nie mock, nie `readFileSync`) | `0` | `grep -rln "UnifiedChatPanel" src/**/__tests__/*.test.tsx` + inspekcja każdego wyniku | TAK — **to jest powód, dla którego `R1`/`R2` opisują dokładnie, jak nadpisać mocki** |
| 6 | pola kickoffu w globalnym mocku `useAppStore` | `0` z `3` (`chatKickoffMessage`, `setChatKickoffMessage`, `clearChatKickoffMessage`), brak `getState()` | `sed -n '718,777p' tests/setup.ts` | TAK |
| 7 | wynik `reachability --check-baseline` na markerze | `exit 1`, 3 pliki niezwiązane z czatem | komenda (c) z „WARUNKÓW WSPÓLNYCH" | TAK — **ZASTANE, nie Twoje** |
| 8 | leaf-count PL/EN | `34331` / `32342` | komenda (a) z „WARUNKÓW WSPÓLNYCH" | TAK |
| 9 | ostatnia litera w rejestrze znalezisk | `AF` w chwili pisania | `grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md \| tail -5` | TAK — **sprawdź PONOWNIE tuż przed commitem** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`src/components/AIChat/UnifiedChatPanel.tsx` (trzy naprawy: `R1`, `R2`, `R3`) ·
`public/locales/pl/translation.json` + `public/locales/en/translation.json` (jeden
nowy liść `aiChat.workPanel.close` w każdym) ·
`src/hooks/useFeatureFlags.tsx` (jeden nowy wpis w `DEFAULT_FLAGS`) ·
nowe pliki testowe w `src/components/AIChat/__tests__/` i/lub `src/routes/__tests__/` ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md` ·
`evidence/przewody-chat/**`.

**Zapisujesz WARUNKOWO:**
`src/routes/AppRoutes.tsx` (WYŁĄCZNIE wydzielenie dwóch nazwanych eksportowanych
komponentów tras, zero zmiany treści JSX — patrz tabela licencji) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE przez
`--update-baseline`, WYŁĄCZNIE dla Twoich własnych nowych plików testowych) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/store/slices/uiSlice.ts`, `src/layouts/MainLayout.tsx`,
`src/components/Help/HelpSidePanel.tsx`, `tests/setup.ts`, `tests/helpers/**`,
`tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`,
`.github/workflows/**`, `server/**` (dyżur nie dotyka backendu wcale),
`scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`,
`scripts/dev/reachability-from-root.mjs` (logika skryptu),
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`,
jakikolwiek plik `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day368-przewody-chat
git diff --name-only --cached | tee /private/tmp/cx-day368-przewody-chat-artefakty/staged.txt
bash -c "grep -iE '^src/store/slices/uiSlice|^src/layouts/MainLayout|^src/components/Help/HelpSidePanel|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/|MODULE_ACCEPTANCE|REJESTR_G15|G19_INWENTARZ|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day368-przewody-chat-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Każdy nowy test wywołuje
komponent/logikę i sprawdza WYNIK (wiadomość wysłana, etykieta zmieniona, nawigacja
wywołana). `readFileSync` + `toContain` na Twoim własnym kodzie naprawy jest
**zakazane** jako jedyny dowód. (Istniejące testy typu `chatHeaderControls…` czytające
źródło dla sprawdzenia KLAS CSS nie są Twoim wzorcem — Ty naprawiasz zachowanie, nie
stylistykę.)

**(2) Dowód idzie przez REALNY montaż, nie przez założenie o propsach.** Zero testów
w tym repo dzisiaj renderuje prawdziwy `UnifiedChatPanel` (wszystkie albo go mockują,
albo czytają jako tekst — zmierzone w tabeli mianowników #5). Twój test ma być
PIERWSZYM, który go naprawdę renderuje, z propsami DOKŁADNIE takimi, jakie realnie
przekazuje trasa `/chat` (czyli same `mode="full"` — nic więcej). Jeśli sięgasz po
refaktor testowalności `AppRoutes.tsx` (tabela licencji), renderuj przez NAZWANY
eksportowany komponent trasy, nie przez odtworzenie jej JSX z pamięci.

**(3) Nowy WIDOCZNY element = flaga `default OFF` do akceptu właściciela.** Przycisk
„Akcje biznesowe" nigdy w produkcji nie był widoczny — wyłączanie defektu, który go
ukrywał, oznacza pokazanie go PIERWSZY RAZ. To jest „nowe wizualium" w rozumieniu
`CLAUDE.md` reguły 7 i `Z11`, nawet jeśli kod istnieje od dawna. Naprawa K6 (kickoff)
i C D-4 (etykieta) NIE tworzą nowego widocznego elementu — to naprawa istniejącej,
już widzianej przez użytkownika funkcji — więc idą BEZ flagi.

**(4) `tests/setup.ts` jest `Z18`-nietykalny, ale jego mock `useAppStore` nie
wystarcza.** Nie zmieniasz globalnego mocka. Nadpisujesz go lokalnie w swoim pliku
testowym (`vi.mock('@/store/useAppStore', ...)` PRZED importem testowanego modułu),
z pełnym stanem zawierającym `chatKickoffMessage`/`setChatKickoffMessage`/
`clearChatKickoffMessage` ORAZ statyczną `getState()` (bo `UnifiedChatPanel.tsx`
w kilku miejscach woła `useAppStore.getState()` bezpośrednio, nie tylko przez hook).

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus
`git show --stat` każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — K2: PRZYCISK „AKCJE BIZNESOWE" DOSTAJE ŻYWY CEL, ZA FLAGĄ (rdzeń)

1. **KROK 0 — rodzina montaży.** `grep -rn "<UnifiedChatPanel" src/` (odfiltruj
   definicję i komentarz w `teresaEntityContext.ts:15`). Wypisz PEŁNĄ listę
   `plik:linia` — moja liczba to `11` w `9` plikach; jeśli Twoja się różni, wklej
   obie listy i napisz dlaczego.
2. **Wybierz cel nawigacji, z dowodem, nie założeniem.** Dwaj kandydaci istnieją
   już dziś w `routeConfig.ts`:
   - `ROUTES.AI_ACTIONS` = `/ai-actions` → `ActionProposalView`
     (`AppRoutes.tsx:2155-2165`), montowany **wprost pod `MainLayout`, BEZ
     `InternalToolsGate`** — więc a priori dostępny zwykłemu userowi;
   - `ROUTES.AI_OS.ACTION_CENTER` = `/ai/action-center` → `ActionCenter`
     (`AppRoutes.tsx:1804-1808`), montowany przez `renderInternalToolsShell`,
     czyli owinięty `InternalToolsGate` / `canUseInternalTools(currentUser)`
     (`internalToolsAccess.ts:41`) — a priori NIE dla zwykłego usera.

   Zweryfikuj to SAM (render/curl, nie tylko czytanie) i zdecyduj. Jeżeli Twój
   pomiar potwierdzi, że `/ai-actions` jest ogólnie dostępny — to jest cel. Jeżeli
   żaden z dwóch nie pasuje semantycznie do „Akcje biznesowe" (np. oba okazują się
   martwe/puste na realnych danych) — napisz to jako pytanie do właściciela w `R5`
   i **usuń przycisk oraz martwy prop** zamiast wiązać go z przypadkowym ekranem
   (druga opcja z briefu zlecenia).
3. **Dodaj JEDNĄ nową flagę** w `DEFAULT_FLAGS` (`useFeatureFlags.tsx`), np.
   `id: 'chatBusinessActionsNav'`, `defaultValue: false`, `category: 'beta'`,
   `allowLocalOverride: true`. To jest **jawnie zamówiony wyjątek od `Z10`** —
   nie potrzebujesz osobnej zgody, ale flaga MUSI być `false` domyślnie.
4. **Wewnątrz `UnifiedChatPanel.tsx`**, obok istniejącego `onNavigateToActions`,
   dodaj fallback: gdy prop nie jest podany ORAZ flaga jest ON, użyj
   `navigateToRoute(ROUTES.<wybrany>)` (import `ROUTES` z `../../routes/routeConfig`,
   styl relatywny jak reszta importów w tym pliku). Warunek renderu przycisku
   (`{onNavigateToActions && (...)}`) zamień na `{handleNavigateToActions && (...)}`,
   gdzie `handleNavigateToActions = onNavigateToActions ?? (flagOn ? () =>
   navigateToRoute(ROUTES.<wybrany>) : undefined)`. **Gdy flaga OFF (domyślnie) —
   zero zmiany widocznego zachowania na żadnym z 11 montaży: przycisk nadal się
   nie renderuje, dokładnie jak dziś.**
5. **Dowód mutacyjny:** z flagą włączoną lokalnie (`allowLocalOverride`), test
   renderujący realny `UnifiedChatPanel` (patrz `R0` pkt 2 i 4) klika przycisk
   i sprawdza, że `navigateToRoute`/`useNavigate` zostało wywołane z właściwą
   ścieżką. Cofnij fallback (`cp` ze `SCRATCH`) → test czerwony; przywróć →
   zielony; `git diff` po cofnięciu pusty.
6. **Dowód wizualny (rule 7):** dev-render zrzut (harness bez logowania, wzorem
   `dev-render/screens/chat-*.tsx`) pokazujący przycisk widoczny PO włączeniu
   flagi lokalnie — do przyszłego akceptu właściciela. Zrzut idzie do
   `evidence/przewody-chat/`, NIE na demo, NIE z flagą domyślną zmienioną.

**Wymagany dowód:** lista `plik:linia` 11 montaży · uzasadnienie wyboru celu
nawigacji z realną weryfikacją dostępności · diff nowej flagi · diff fallbacku ·
test renderujący realny komponent z klikiem i asercją nawigacji · mutacja w obie
strony · zrzut dev-render. **Commit po `R1`.**

## R2 — K6: KICKOFF ZE STORE'U JAKO FALLBACK NA KAŻDYM MONTAŻU (rdzeń)

1. **KROK 0 — cała rodzina propsów, nie tylko dwa zgłoszone.** Dla KAŻDEGO propa
   z `UnifiedChatPanelProps` (`UnifiedChatPanel.tsx:699-778`) sprawdź, czy warunkuje
   render widocznego elementu przez wzorzec `{prop && (...)}` lub podobny, i czy
   `/chat`/`/chat/:id` go przekazują. Moja lista poza `onNavigateToActions`
   (`R1`) i `kickoffMessage` (ten punkt): **`quickPrompts`** (`:7419`,
   `{quickPrompts && quickPrompts.length > 0 && …}`) i **`contextActions`**
   (`:7399`, `{contextActions && contextActions.length > 0 && …}`) — oba
   niepodawane przez `/chat`. Dla każdego z tych dwóch **zapisz w raporcie**
   werdykt: `CELOWE` (ekran pełnoekranowy nie ma kontekstu modułu, więc brak
   chipów/akcji kontekstowych jest zamierzony) albo `DEFEKT` (z uzasadnieniem).
   **Nie zmieniasz ich kodu** w tym dyżurze, chyba że werdykt `DEFEKT` jest
   trywialny do naprawy identycznym wzorcem co `kickoffMessage` — wtedy STOP
   i pytanie do właściciela w `R5`, nie cichy dopisek.
2. **Napraw `kickoffMessage`/`onKickoffConsumed` jednym uogólnieniem.** Wewnątrz
   `UnifiedChatPanel.tsx`, w efekcie kickoffu (`:5006-5025`), gdy prop
   `kickoffMessage` jest `undefined`, użyj `useAppStore((s) =>
   s.chatKickoffMessage)` jako wartości efektywnej; gdy konsumujesz wiadomość
   I `onKickoffConsumed` NIE jest podany (bo prop `kickoffMessage` też nie był
   podany), wywołaj `useAppStore.getState().clearChatKickoffMessage()`
   bezpośrednio zamiast (lub obok) `onKickoffConsumed?.()`. **To ma zadziałać na
   KAŻDYM z 11 montaży, nie tylko na `/chat`** — sprawdź, że montaż
   `AIConsultantPanel.tsx:334` (który PRZEKAZUJE własny, zawsze-zdefiniowany
   `kickoffMessage` lokalny) NIE zaczyna nagle dodatkowo czytać store'u (bo jego
   prop nigdy nie jest `undefined` — potwierdź to w dowodzie, nie załóż).
3. **Test przez REALNY montaż z propsami `/chat`.** Wydziel (tabela licencji)
   `AiChatRoute`/`AiChatConversationRoute` z `AppRoutes.tsx` ALBO — jeśli refaktor
   okaże się zbyt kosztowny w czasie — udokumentuj to jako STOP częściowy i
   zamiast tego renderuj `UnifiedChatPanel` bezpośrednio z DOKŁADNIE `mode="full"`
   i **żadnym innym propem** (co jest dziś realną, zmierzoną treścią wywołania
   `AppRoutes.tsx:1778`/`:1865` — zapisz w raporcie, że to świadomy kompromis, nie
   przeoczenie). W obu wariantach: nadpisz LOKALNIE mock `useAppStore` (`R0` pkt 4)
   tak, by `chatKickoffMessage` zwracał ustawioną wartość i `getState()` zwracał
   ten sam stan z działającym `clearChatKickoffMessage` (`vi.fn()` śledzący
   wywołanie). Ustaw kickoff, wyrenderuj, i sprawdź że wiadomość **faktycznie
   trafia do wysyłki** (np. przez asercję na wywołaniu zmockowanego `Api` użytego
   przez `handleSendMessage`, lub na obecności wiadomości w DOM) — **nie** przez
   sprawdzenie samego istnienia efektu w kodzie źródłowym.
4. **Dowód mutacyjny.** Cofnij fallback (`cp` ze `SCRATCH`) → test czerwony
   (wiadomość nie trafia); przywróć → zielony; `git diff` po cofnięciu pusty.
5. **Para „przed/po".** „Przed": test dowodzi, że z propsami identycznymi jak na
   `/chat` (tylko `mode="full"`) i kickoffem ustawionym w store, wiadomość
   **ginie** (to jest odtworzenie dzisiejszego defektu — możesz to zrobić jako
   pierwszy test, PRZED naprawą, i zapisać jego czerwony wynik). „Po": ten sam
   test, po naprawie, jest zielony.
6. **Nie psujesz `MainLayout`'owego montażu.** `MainLayout.tsx:505-506` nadal
   przekazuje `kickoffMessage`/`onKickoffConsumed` jawnie — Twój fallback tam
   nigdy się nie aktywuje (prop nie jest `undefined`, nawet gdy jego wartość to
   `undefined` z `chatKickoffMessage || undefined` — sprawdź SAM tę literę:
   `undefined` przekazane jawnie jako wartość propa to wciąż „prop podany" w
   Twoim kodzie, jeśli sprawdzasz `'kickoffMessage' in props`, ale NIE jeśli
   sprawdzasz samą wartość `kickoffMessage === undefined`. **Wybierz sprawdzanie
   po WARTOŚCI** — `MainLayout` i tak czyta z tego samego store'u, więc podwójne
   odczytanie tej samej wartości nie zmienia zachowania, ale musisz to
   udowodnić testem, nie założeniem).

**Wymagany dowód:** tabela werdyktów `CELOWE`/`DEFEKT` dla `quickPrompts` i
`contextActions` · diff uogólnienia fallbacku · test „przed" czerwony na
dzisiejszym kodzie · test „po" zielony · mutacja w obie strony · dowód, że
`AIConsultantPanel`/`MainLayout` nie zmieniły zachowania (dodatkowy test albo
jawny brief z `plik:linia`). **Commit po `R2`.**

## R3 — C D-4: ETYKIETA PANELU ROBOCZEGO ZMIENIA SIĘ ZE STANEM (mały)

1. Dodaj klucz `aiChat.workPanel.close` do OBU słowników: `public/locales/pl/…`
   (`"Zamknij panel roboczy"`, obok istniejącego `"open": "Otwórz panel
   roboczy"`, `:18843-18845`) i `public/locales/en/…` (`"Close work panel"`,
   `:17596-17598`).
2. W `UnifiedChatPanel.tsx:6851-6852` zamień statyczne `title`/`aria-label` na
   warunek po `showWorkPanel` (wzorzec **skopiowany** z sąsiedniego przycisku TTS,
   `:6881-6894`, które już poprawnie przełącza etykietę):
   `showWorkPanel ? t('aiChat.workPanel.close', 'Close work panel') :
   t('aiChat.workPanel.open', 'Open work panel')`.
3. **Test zachowania**, nie tekstu źródła: renderuj realny `UnifiedChatPanel`
   (ten sam montaż co `R2`), kliknij przycisk `data-testid="chat-work-panel-button"`,
   sprawdź `title`/`aria-label` PRZED i PO kliknięciu.
4. **Dowód mutacyjny:** cofnij warunek (`cp` ze `SCRATCH`) → test czerwony
   (etykieta nie zmienia się po kliknięciu); przywróć → zielony.

**Wymagany dowód:** diff dwóch słowników (leaf-count +1 w każdym, zmierzone w
„WARUNKACH WSPÓLNYCH") · diff komponentu · test klik+asercja w obie strony ·
mutacja. **Commit po `R3`.**

## R4 — RODZINA, WARUNKI WSPÓLNE, DOWODY

1. **Przemiar „WARUNKÓW WSPÓLNYCH"** PO wszystkich zmianach: leaf-count PL/EN
   (oczekiwane: `34331+1`/`32342+1`), trzy bezpieczniki kanonu (`0`/`0`/`0`),
   `reachability --check-baseline` — porównaj log PRZED/PO **po nazwach plików**,
   nie po samej liczbie; jeśli dodałeś nowe pliki testowe, zarejestruj je przez
   `--update-baseline` i wklej diff `reachability.baseline.json` do raportu.
2. **Domknij tabelę mianowników** #1-#9 z liczbami PO Twoich zmianach tam, gdzie
   się zmieniły (np. #5 „testy renderujące realny UnifiedChatPanel" powinno
   przejść z `0` na liczbę Twoich nowych testów).
3. **Evidence.** Zapisz do `evidence/przewody-chat/`: listę 11 (lub Twoich)
   montaży `plik:linia`, tabelę werdyktów rodziny propsów z `R2` pkt 1, zrzut
   dev-render z `R1` pkt 6, JSON-y `--reporter=json` Twoich nowych testów (przed
   i po naprawie, per pozycja `R1`/`R2`/`R3`).
4. **Rejestr znalezisk.** Sprawdź `bash -c "grep -nE '^## [A-Z]+\.'
   docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"` TUŻ PRZED commitem
   (moja litera przy pisaniu: `AF` → następna `AG`, ale inni autorzy piszą
   równolegle) i dopisz JEDNĄ sekcję zbierającą K2/K6/D-4 jednym akapitem.

**Wymagany dowód:** tabela „przed/po" warunków wspólnych · tabela mianowników
domknięta · pliki w `evidence/przewody-chat/` z realną treścią (nie puste) ·
sekcja w rejestrze znalezisk pod poprawną, świeżo sprawdzoną literą. **Commit
po `R4`.**

## R5 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY368_PRZEWODY_CHAT_REPORT.md`)
zawiera: streszczenie K2/K6/D-4 z dowodem mutacyjnym każdej · listę 11 (lub Twoich)
montaży `<UnifiedChatPanel` z adnotacją które propsy każdy przekazuje · tabelę
werdyktów rodziny (`quickPrompts`/`contextActions` i wszystko, co jeszcze
znalazłeś) · uzasadnienie wyboru celu nawigacji `R1` (lub decyzję o usunięciu
przycisku, jeśli żaden cel nie pasował) · stan flagi `chatBusinessActionsNav`
(nazwa, `defaultValue: false`, gdzie zdefiniowana) · rozbieżności liczb wobec tej
instrukcji (w szczególności `10` vs `11` montaży) · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE"**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA".** Musi zawierać co
najmniej: (1) czy `/ai-actions` (`ActionProposalView`) jest właściwym, docelowym
ekranem dla „Akcje biznesowe", czy właściciel widzi inny cel; (2) czy po zrzucie
dev-render właściciel akceptuje włączenie flagi `chatBusinessActionsNav`
domyślnie; (3) werdykt `quickPrompts`/`contextActions` z `R2` pkt 1, jeśli
wypadł `DEFEKT` i wymaga osobnej decyzji o zakresie naprawy.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest
GENEROWANY: `bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R5`.**

## Próg odbioru

**Trzy defekty domknięte: „Akcje biznesowe" ma żywy cel nawigacji za flagą
domyślnie WYŁĄCZONĄ (zero zmiany widocznego zachowania bez akceptu); kickoff ze
store'u działa jako fallback na KAŻDYM montażu `UnifiedChatPanel`, dowiedzione
testem przez realny komponent z propsami identycznymi jak na `/chat`, z parą
dowodów przed/po i mutacją; etykieta panelu roboczego zmienia się ze stanem, oba
słowniki mają nowy klucz. Rodzina propsów z `KROK 0` jest wypisana w całości
(minimum `quickPrompts`, `contextActions`), każdy z werdyktem.**

Odbiorca odrzuci dyżur, w którym: przycisk „Akcje biznesowe" stał się widoczny
DOMYŚLNIE (bez flagi OFF); nowy test kickoffu mockuje `UnifiedChatPanel` zamiast
go renderować, albo asercja sprawdza tekst źródła zamiast wyniku; fallback
zepsuł montaż `MainLayout`/`AIConsultantPanel` (podwójny kickoff albo cichy
regres); leaf-count słowników spadł albo urósł o więcej niż 2; którakolwiek z
trzech bezpieczników kanonu się zaczerwieniła od tej zmiany; `reachability`
urósł o coś innego niż własne nowe testy autora.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „K2 podpięty za
flagą OFF, K6 naprawiony i udowodniony mutacyjnie, D-4 naprawiony, rodzina
propsów wypisana, `R4`/`R5` niewykonane bo zabrakło czasu" — **jest
pełnowartościowym wynikiem**, jeśli każda zrobiona pozycja ma commit i dowód.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później:
**sprawdzasz warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na
zapamiętanym wyniku.** Wynik ponownego sprawdzenia wklejasz do raportu z datą
i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Napraw K2 (podłącz nawigację)" vs „nie odsłaniaj nowego ekranu bez akceptu" | `R0` (3) i `R1` pkt 3-4: fallback istnieje w kodzie, ale za flagą `default false` — zero zmiany widocznego zachowania bez decyzji właściciela |
| „`tests/setup.ts` jest `Z18`-nietykalny" vs „test musi mieć kickoff w store'ze" | `R0` (4): nadpisanie LOKALNE w pliku testowym, nigdy w `tests/setup.ts` |
| „Dowód ma iść przez trasę `/chat`" vs „renderowanie `MainLayout` nigdy nie było testowane w tym repo" | `R2` pkt 3: preferowana ścieżka to refaktor testowalności `AppRoutes.tsx` (wzorzec `AssessmentOutputReportRoute`); dopuszczalny, jawnie opisany kompromis to render `UnifiedChatPanel` z propsami identycznymi jak `/chat` |
| „Napraw fallback na KAŻDYM montażu" vs „nie zmieniaj zachowania montaży, które już działają" | `R2` pkt 2 i 6: sprawdzanie po WARTOŚCI propa (nie po jego obecności), z dowodem że `AIConsultantPanel`/`MainLayout` się nie zmieniają |
| „Zaktualizuj baseline osiągalności dla nowych testów" vs „bramki są nietykalne" | Tabela licencji: WĄSKA licencja WYŁĄCZNIE przez `--update-baseline`, WYŁĄCZNIE dla własnych plików; cudze 3 pliki zostają jako ZASTANE |
| „`reach` ma kończyć się 0" vs „na markerze już jest 1, z przyczyny obcej" | „WARUNKI WSPÓLNE": próg to „nie pogarsza się o coś INNEGO niż Twoje testy", nie literalne 0 |
| „Dopisz sekcję do rejestru znalezisk" vs „równolegle piszą inni autorzy" | `R4` pkt 4: literę sprawdzasz komendą TUŻ PRZED commitem |
| „11 montaży (mój pomiar)" vs „10 (audyt/V1)" | Tabela mianowników #1: Twój pomiar rozstrzyga, rozbieżność idzie do raportu wprost |
| „Napraw rodzinę propsów w całości" vs „zakres dyżuru to K2/K6/D-4" | `R2` pkt 1: pozostałe propy (`quickPrompts`/`contextActions`) dostają WERDYKT, nie automatyczną naprawę — kod zmieniasz tylko dla trzech zgłoszonych pozycji |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 9 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `UnifiedChatPanel.tsx:745,763,798,804-805,3117,5006-5025,6499,6786-6807,6845-6856,7399,7419`, `AppRoutes.tsx:1770-1782,1857-1869,838-857,2155-2165,1804-1808`, `MainLayout.tsx:82-83,102-134,505-506`, `HelpSidePanel.tsx:307-341`, `uiSlice.ts:45-47,176,231-232`, `tests/setup.ts:718-777`, słowniki `:18843-18845`/`:17596-17598` — wszystkie odczytane przez autora na markerze; `evidence/przewody-chat/` jawnie oznaczone jako nieistniejące |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 9 wierszy, wszystkie zmierzone przy wydaniu na markerze (w tym `reach=1` faktycznie uruchomione) |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP" | TAK — komponent · trasa (refaktor) · store · Pomoc · MainLayout · flagi · kandydaci nawigacji · słowniki · testy kolokowane · infrastruktura testowa · baseline · bezpieczniki · produkt poza zakresem · raport · rejestr · dowody · macierz/rejestry bramek · cudze tereny · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka `UnifiedChatPanel.tsx`+`useFeatureFlags.tsx`, `R2` dotyka wyłącznie `UnifiedChatPanel.tsx` (+ opcjonalnie wąski refaktor `AppRoutes.tsx`), `R3` dotyka `UnifiedChatPanel.tsx`+2 słowniki |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6439/5579 własne, rodzeństwo 367/369-373 na innych portach (lista w `§0.2`), brak kontenera/gałęzi/worktree `day368` na dziś |
| 7 | Komendy paste-ready | TAK — bloki `§0.3`, „WARUNKI WSPÓLNE" i kontrola rozłączności uruchomione w całości na tym markerze |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — pułapki właściwe: globalny mock `useAppStore` bez pól kickoffu, zero precedensu renderowania realnego `UnifiedChatPanel`, `reachability` już czerwony na markerze z przyczyny obcej, rozbieżność 10 vs 11 montaży, „nowe wizualium" wymaga flagi mimo że kod istniał od dawna |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany", zero pól szablonu | TAK — kontrola generatora przy wydaniu |
