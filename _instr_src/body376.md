## Po co ten dyżur istnieje

Cztery małe, niezależne domknięcia zostawione przez dyżury 368/369/373 — każdy
z nich zatrzymał się uczciwie na warunku wejściowym zamiast improwizować.
Ten dyżur nie otwiera nowego śledztwa: dokańcza trzy zamknięte STOP-y i
naprawia jeden mechanizm, który sam stanął w poprzek pracy.

**R1 — zrzut przycisku „Akcje biznesowe” (dyżur 368).** 368 podpiął żywy cel
nawigacji za flagą `chatBusinessActionsNav` (`useFeatureFlags.tsx:111-118`,
`defaultValue:false`) i fallback wewnątrz `UnifiedChatPanel.tsx:816-819`
(`handleNavigateToActions`). Raport 368 zgłosił `BLOCKED_AUTH` — rzekomy brak
możliwości zrzutu bez PIN-u lokalnego produktu. **To jest fałszywy STOP.**
`dev-render/screens/chat-split-teresa-right.tsx` (istnieje na markerze) montuje
DOKŁADNIE ten sam `<UnifiedChatPanel mode="full">`, bez logowania, zaszywając
`useAppStore.setState({currentUser: …})` przed renderem. Ten sam wzorzec plus
lokalny override flagi w `localStorage` wystarczy do zrzutu. Dodatkowo:
zlecenie tego dyżuru każe dopisać ARG/ENV `VITE_*` do obu Dockerfile-ów „bo bez
tego flaga nigdy nie wejdzie na staging” — ale `ODBIOR_368.md` (wiersz 12) już
to zmierzył i rozstrzygnął w drugą stronę: `chatBusinessActionsNav` żyje w
`DEFAULT_FLAGS`, systemie w pełni client-side (stała TS w bundlu) plus
opcjonalny zdalny override przez `GET {API_URL}/feature-flags/runtime` — INNY
mechanizm niż flagi `VITE_*` budowane w Dockerze. Ten dyżur ma tę tezę
zweryfikować PONOWNIE, nie mechanicznie dopisać martwy ARG.

**R2 — dokończenie usunięcia `InputHintStrip.tsx` (dyżur 373).** 373 zmierzył
`test-only` i chciał usunąć, ale KROK 0 znalazł DRUGI, nielicencjonowany mock
w `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85`
(obok już licencjonowanego `EnhancedChatInput.teresaVoice.test.tsx:98`) i
słusznie się zatrzymał, zamiast usuwać komponent na pół. `CODEX_DAY373_…
REPORT.md` sekcja „STOP — InputHintStrip” pyta wprost, czy rozszerzyć
licencję o tę jedną linię. **Ten dyżur odpowiada TAK.**

**R3 — usunięcie martwego duplikatu `CloudDataSettings.tsx` (dyżur 369).**
369 naprawił bramkę `POST /api/cloud/sources` (wymaga realnego, per-user
tokenu OAuth) i uczciwie udokumentował, że jej jedynym wołaczem jest martwy
`CloudDataSettings.tsx` — pytanie 2 do właściciela brzmiało: podłączyć czy
usunąć. **Ten dyżur usuwa** (zgodnie z zamówieniem), i dodatkowo ustala
pisemnie, którą trasę realnie widzi użytkownik pod „Zarządzaj źródłami w
chmurze” w Czacie, i czy ma ona ochronę tokenem równoważną tej z 369.

**R4 — bezpiecznik osiągalności utknął na całościowym mechanizmie.**
`reachability --check-baseline` kończy się dziś kodem `1` z powodu 49
skumulowanych nowych plików `test-only` (dług pięciu dni pracy równoległej,
dyżury 367-375) — żaden pojedynczy dyżur nie mógł ich zaakceptować, bo
`--update-baseline` jest CAŁOŚCIOWY (odmawia zapisu, jeśli JAKIKOLWIEK nowy
plik nie jest już w starym baseline — dokładnie to zablokowało `--update-
baseline` w dyżurach 368 i 369, obaj to udokumentowali). Trzy z tych 49 są
jawnie zlecone do adjudykacji tutaj. Ponieważ skrypt nie ma trybu
selektywnego, ten dyżur mu go dopisuje — wąsko, testowanie, i używa go
DOKŁADNIE na tych trzech plikach.

## ★ Stan zastany, zmierzony przeze mnie na markerze `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| `chatBusinessActionsNav` — definicja i fallback | istnieje, `defaultValue:false`, fallback do `ROUTES.AI_ACTIONS` | `useFeatureFlags.tsx:111-118`, `UnifiedChatPanel.tsx:816-819,6805-6820` |
| ARG/ENV `VITE_*` dla `chatBusinessActionsNav`/`myWorkNotebookV2`/`assessmentFiveSurfacesV1` w obu Dockerfile | **0** wystąpień, dla wszystkich trzech, w obu plikach | `Dockerfile.api`, `Dockerfile.frontend` |
| `import.meta.env` w `useFeatureFlags.tsx` | **0** wystąpień — cały `DEFAULT_FLAGS` rozstrzyga się przez local override/remote DB/rollout/default, nigdy przez `VITE_*` | `src/hooks/useFeatureFlags.tsx` (`flags` `useMemo`, linie ~530-570) |
| precedens dev-render montujący realny `UnifiedChatPanel` bez logowania | **istnieje**, 142 linii, `useAppStore.setState` zamiast realnego auth | `dev-render/screens/chat-split-teresa-right.tsx` |
| rodzina `InputHintStrip` (KROK 0) | komponent + dedykowany test + **2** mocki w cudzych testach | `InputHintStrip.tsx`, `__tests__/InputHintStrip.test.tsx`, `EnhancedChatInput.teresaVoice.test.tsx:98`, `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx:85` |
| klasyfikacja `InputHintStrip.tsx` (osiągalność od korzenia) | `test-only` | `node scripts/dev/reachability-from-root.mjs` |
| rodzina `CloudDataSettings` (KROK 0) | komponent + dedykowany test + **2** testy źródło-czytające w cudzym pliku (nieopisane przez zlecenie) | `CloudDataSettings.tsx`, `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx`, `tests/integration/services/cloud-sync.p01ext.test.ts:274-291` |
| klasyfikacja `CloudDataSettings.tsx` / `ConnectedAppsSettings.tsx` / `ActionCenter.tsx` | `test-only` / `app` / `app` | `reachability-from-root.mjs` |
| jedyny wołacz `POST /api/cloud/sources` (tworzenie źródła) w `src/` | `CloudDataSettings.tsx:142` | `grep -rn "cloud/sources" src/` |
| trasa realnie wywoływana przez `AddFilesMenu`/`CloudFilePicker` w Czacie | `GET /api/cloud/sources` (odczyt, `Api.listCloudFiles`) do listowania; link „Zarządzaj” nawiguje do `/settings/integrations` → `ConnectedAppsSettings.tsx` (INNY system, tabela `integrations`) | `CloudFilePicker.tsx:106`, `AddFilesMenu.tsx:258`, `services/api.ts:18148-18164` |
| stan trasy governed connectors (`/api/settings/integrations/:provider/connect`) | `500 {}` na `google_drive`, zmierzone niezależnie w dyżurze 369 (R5), poza zakresem tego dyżuru | `CODEX_DAY369_CHMURA_OAUTH_REPORT.md` §R5 |
| `reachability --check-baseline` na markerze | `exit 1`, **49** nowych plików `test-only` (dług 367-375) | komenda (10) `§0.3` |
| klasyfikacja trzech plików docelowych `R4` | wszystkie **`test-only`**, żaden jeszcze nie w baseline | `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.test.ts`, `.../zaiTeresaFlag.envStaticRead.test.ts`, `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts` |
| co importują/czytają te trzy pliki | dwa importują żywy (`app:true`) moduł flagi; jeden czyta realne `public/locales/{pl,en}/translation.json`, zero mocków | patrz `R4` pkt 1 |
| leaf-count słowników | **pl 35294**, **en 33154** | `public/locales/{pl,en}/translation.json` |
| trzy bezpieczniki kanonu | focus=0, list=0, artefakt=0 | komenda (11) `§0.3` |
| ostatnia użyta litera w `REJESTR_ZNALEZISK_20260903.md` w chwili pisania | `AM` (dyżur 373) | `grep -nE '^## [A-Z]+\.' … \| tail -3` — **sprawdź SAM tuż przed commitem** |
| tip gałęzi bazowej vs marker | marker jest przodkiem, tip uciekł o **1** commit (`d8d03863da`, drobna poprawka typu w `UnifiedChatPanel.tsx`, niezwiązana z żadną pozycją tego dyżuru) | `git log --oneline <MARKER>..github-backup/grafika/m03-20260902` |

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **0** wystąpień ARG/ENV `VITE_*` dla jakiejkolwiek
flagi `DEFAULT_FLAGS` w obu Dockerfile (nie tylko `chatBusinessActionsNav`);
**0** odczytów `import.meta.env` w całym `useFeatureFlags.tsx`; precedens
dev-render (`chat-split-teresa-right.tsx`) montuje realny komponent bez
logowania; rodzina `InputHintStrip` = komponent + test + **2** mocki (nie 1);
rodzina `CloudDataSettings` = komponent + **2** pliki testowe (jeden
dedykowany do usunięcia w całości, jeden do usunięcia częściowego — **2**
konkretne `it()`, nie cały plik); jedyny wołacz `POST /api/cloud/sources` to
`CloudDataSettings.tsx`; Czat naprawdę woła `GET /api/cloud/sources` do
odczytu i nawiguje do CAŁKIEM INNEJ trasy (`/settings/integrations`) do
zarządzania; `reachability --check-baseline` daje `exit 1` z **49** nowymi
plikami `test-only`, z których dokładnie **3** są w zakresie tego dyżuru.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ
pomiar — zapisz rozbieżność wprost.** W szczególności: jeżeli grep w Dockerfile
znajdzie COKOLWIEK dla którejkolwiek nazwy flagi `DEFAULT_FLAGS` — to obala
tezę `ODBIOR_368` i zmienia `R1` z „pomiń ARG” na „zbadaj dlaczego jest
wyjątek”; jeżeli rodzina `InputHintStrip`/`CloudDataSettings` ma więcej
członków niż tu wypisano — wklej pełną listę i rozszerz `R2`/`R3` o nie.

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz
zamiast zmiany brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim
produktem jest **ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Dev-render — nowy ekran (R1)** | `dev-render/screens/chat-business-actions-nav.tsx` (**NOWY**) | **PEŁNA LICENCJA** — wzorzec dosłowny `chat-split-teresa-right.tsx`: realny `<UnifiedChatPanel mode="full">`, `useAppStore.setState`, `<FeatureFlagsProvider config={{enableLocalOverrides:true}}>`, `localStorage` override flagi PRZED renderem. Zero zmian w `UnifiedChatPanel.tsx` | — |
| **Dev-render — rejestr ekranów** | `dev-render/main.tsx` | **★ WĄSKA LICENCJA**: dopisanie JEDNEGO wpisu `React.lazy` + wpisu w rejestrze `SCREENS` dla nowego ekranu, wzorem sąsiednich wpisów. **Zakaz** zmiany istniejących wpisów | — |
| **Komponent czatu — cel R1 (TYLKO ODCZYT)** | `src/components/AIChat/UnifiedChatPanel.tsx`, `src/hooks/useFeatureFlags.tsx` | **TYLKO ODCZYT** w tym dyżurze — R1 dostarcza zrzut, nie zmienia zachowania flagi. Jeśli pomiar (2) w `§0.3` obali tezę `ODBIOR_368` i pokaże, że flaga jednak potrzebuje ARG-a Dockera — patrz wiersz „Dockerfile” niżej, WCIĄŻ zero zmian w tych dwóch plikach | Brief, jeśli pomiar każe inaczej |
| **Dockerfile — WARUNKOWO (R1)** | `Dockerfile.api`, `Dockerfile.frontend` | **★ WARUNKOWA LICENCJA**: wolno dopisać `ARG VITE_CHAT_BUSINESS_ACTIONS_NAV` + `ENV VITE_CHAT_BUSINESS_ACTIONS_NAV=${VITE_CHAT_BUSINESS_ACTIONS_NAV}` **WYŁĄCZNIE** jeśli Twój pomiar (2) `§0.3` obali tezę `ODBIOR_368` (czyli znajdziesz JAKIKOLWIEK odczyt `import.meta.env.VITE_*` w ścieżce `chatBusinessActionsNav`, dziś go tam nie ma) I dopiszesz odpowiadający, wąski odczyt w kodzie w TYM SAMYM commicie. Jeśli pomiar POTWIERDZI tezę (oczekiwane) — **NIE dotykasz tych plików**, piszesz uzasadnienie w raporcie | Brief z uzasadnieniem „ARG pominięty celowo” |
| **`InputHintStrip` (R2, usuwany)** | `src/components/AIChat/InputHintStrip.tsx`, `src/components/AIChat/__tests__/InputHintStrip.test.tsx` | **LICENCJA NA USUNIĘCIE**, warunkowa TYLKO na potwierdzenie `test-only` przez Twój pomiar (oczekiwane, patrz stan zastany) | Jeśli pomiar pokaże `app`: zatrzymujesz się, brief |
| **Dwa mocki `InputHintStrip` (R2)** | `src/components/AIChat/__tests__/EnhancedChatInput.teresaVoice.test.tsx` (linia `:98`), `tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx` (linia `:85`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE JEDNEJ LINII W KAŻDYM** — `vi.mock(...)` wskazujący usuwany komponent. **Zakaz** jakiejkolwiek innej zmiany w tych dwóch plikach | — |
| **`CloudDataSettings` (R3, usuwany)** | `src/components/settings/CloudDataSettings.tsx`, `tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` | **LICENCJA NA USUNIĘCIE W CAŁOŚCI**, warunkowa na potwierdzenie `test-only`/zero importera poza tym testem (oczekiwane) | Jeśli `app`: STOP, brief |
| **Dwa testy w cudzym pliku (R3)** | `tests/integration/services/cloud-sync.p01ext.test.ts`, WYŁĄCZNIE `it('CloudDataSettings has sync button', …)` i `it('CloudDataSettings supports all providers', …)` (linie `:274-291`) | **★ WĄSKA LICENCJA NA USUNIĘCIE DOKŁADNIE TYCH DWÓCH `it()`**. **Zakaz** dotykania `describe('Cloud Storage — Frontend')`'s pozostałych dwóch testów (`CloudFilePicker exists…`, `Api service has cloud file methods…`) i całej reszty pliku (backend `CONNECTORS`, sync) | — |
| **Ustalenie trasy „Zarządzaj źródłami” (R3, TYLKO ODCZYT)** | `src/components/settings/ConnectedAppsSettings.tsx`, `src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`, `src/services/api.ts` (fragmenty `listCloudFiles`), `server/src/routes/cloud.routes.ts`, `server/src/routes/settings.routes.ts` | **TYLKO ODCZYT** — dowód do raportu (`plik:linia`), zero zmian. Governed connectors `500 {}` (dyżur 369 R5) POZA ZAKRESEM — cytujesz, nie naprawiasz | Wpis do raportu + pytanie do właściciela jeśli ochrona nierównoważna |
| **Skrypt bezpiecznika osiągalności (R4)** | `scripts/dev/reachability-from-root.mjs` | **★ WĄSKA LICENCJA NA DOPISANIE JEDNEGO NOWEGO TRYBU CLI** (`--update-baseline-add=<ścieżka1>,<ścieżka2>,…`) — patrz `R4` pkt 2 dla dokładnej specyfikacji. **Zakaz** zmiany istniejącego zachowania `--update-baseline`, `--check-baseline`, `--unreachable-only` czy trybu bezargumentowego (dump JSON) | Brief, jeśli zmiana okaże się niewykonalna bez ryzyka dla istniejących trybów |
| **Test nowego trybu (R4)** | nowy plik testowy dla `reachability-from-root.mjs --update-baseline-add` (lokalizacja do ustalenia przez Ciebie — patrz `§0.2` SCIEZKI) | **PEŁNA LICENCJA** — dowód zachowania: (a) dodaje wskazany plik, jeśli jest dziś `unreachable`/`test-only` i nie jest jeszcze w baseline; (b) ODRZUCA (kod ≠0, zero zapisu) jeśli wskazany plik jest `app`/`harness-only`; (c) NIE usuwa/nie zmienia żadnego istniejącego wpisu baseline; (d) idempotentny — drugie uruchomienie z tym samym plikiem nie zmienia niczego | — |
| **Baseline osiągalności (R4)** | `docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` | **★ WĄSKA LICENCJA: WYŁĄCZNIE przez nowy tryb `--update-baseline-add`**, WYŁĄCZNIE dla trzech imiennie wskazanych plików. **Zakaz** edycji ręcznej, **zakaz** użycia zwykłego `--update-baseline` (całościowy, przejąłby pozostałe 46 nowych plików) | — |
| **Pozostałe 46 nowych plików `test-only`/`unreachable` (R4, poza zakresem)** | dowolne pliki z listy „New test-only files” poza trzema wskazanymi | **TYLKO ODCZYT — POZA ZAKRESEM.** Zostają czerwone w `--check-baseline` po tym dyżurze — to oczekiwane, opisz w raporcie | Wpis do raportu, lista plików |
| **Bezpieczniki kanonu (logika)** | `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | **NIETYKALNE DO ZAPISU** — wolno wyłącznie URUCHAMIAĆ | Opis w raporcie |
| **Infrastruktura testowa** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`** | Opis w raporcie |
| **`server/src/**` — cały serwer** | — | **TYLKO ODCZYT.** Żadna trasa serwerowa nie jest dotykana w tym dyżurze | Brief, jeśli coś znajdziesz przypadkiem |
| **Macierz odbioru, rejestry bramek** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md`, `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **NIETYKALNE DO ZAPISU** — poza zakresem tego dyżuru | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o pierwszej wolnej literze, sprawdzonej TUŻ PRZED commitem | — |
| **Nowe dowody** | `evidence/akcje-zrzut-porzadki-20260905/**` (**NIE ISTNIEJE — tworzysz**) | **PEŁNA LICENCJA** | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_ZRZUT_PORZADKI_REPORT.md` (**NOWY**) | `R5` — JEDYNY nowy dokument rejestrowy (`Z13`) | — |
| **Cudze tereny** | `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`, rodzeństwo 367-375/377, governed connectors 500 (dyżur 369 R5), pozostałe defekty D-2/D-3/D-5/D-6 nieopisane tu | **TYLKO ODCZYT** | Wpis do raportu |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow — TEN DYZUR NIE DODAJE ANI NIE USUWA ZADNEGO KLUCZA I18N,
#     wiec liczby maja byc IDENTYCZNE przed i po (zero pozycji dotyka public/locales/**)
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby PRZED: pl 35294, en 33154 — PO: identyczne. Jesli sie zmienily, to jest
#   NARUSZENIE ROZLACZNOSCI (zaden R nie ma licencji na public/locales/**), nie osiagniecie.

# (b) trzy bezpieczniki kanonu maja konczyc sie kodem 0 -- NIEZALEZNE od tego dyzuru
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
#   moje liczby: wszystkie 0 na markerze, maja zostac 0.

# (c) reachability — PRZED: exit 1 z 49 nowymi plikami. PO R2/R3: 47 (dwa pliki produkcyjne
#     usuniete znikaja z listy kandydatow, NIE z listy "New" bo nigdy tam nie byly jako
#     unreachable nowe — sprawdz sam, czy usuniecie zmienia totals.unreachable/test-only).
#     PO R4: dokladnie 3 mniej w logu "New test-only files" (46 zostaje, to oczekiwane).
node scripts/dev/reachability-from-root.mjs --check-baseline; echo "reach=$?"
#   moje liczby PRZED: reach=1, 49 nowych plikow test-only. PO: reach=1 WCIAZ (46 zostaje —
#   to NIE jest regresja tego dyzuru), log ma zawierac DOKLADNIE 46 nazw, zaden z trzech
#   plikow R4 nie moze juz tam byc, InputHintStrip.tsx/CloudDataSettings.tsx znikaja z totals
#   (usuniete pliki nie istnieja, wiec nie sa juz nigdzie klasyfikowane).
```

**Jeżeli liczba słowników się zmieni, bramka `list-canon`/`focus-canon`/`artefakt`
się zaczerwieni od Twojej zmiany, albo log `reach` po `R4` pokaże inną liczbę niż
46 pozostałych — naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | ARG/ENV `VITE_*` dla dowolnej flagi `DEFAULT_FLAGS` w obu Dockerfile | `0` | komenda (2) `§0.3` | TAK — **jeśli >0, teza `ODBIOR_368` upada, `R1` pkt 2 zmienia się na „napraw” zamiast „pomiń”** |
| 2 | odczyty `import.meta.env` w `useFeatureFlags.tsx` | `0` | `grep -n "import.meta.env" src/hooks/useFeatureFlags.tsx` | TAK |
| 3 | rodzina `InputHintStrip` (komponent + testy + mocki) | `4` plików (komponent, dedykowany test, 2 mocki) | komenda (4) `§0.3` | TAK — **KROK 0, wypisz pełną listę, nie tylko liczbę** |
| 4 | rodzina `CloudDataSettings` (komponent + testy) | `3` plików (komponent, dedykowany test, 1 cudzy plik z 2 `it()`) | komenda (6) `§0.3` | TAK — **KROK 0, ten trzeci plik NIE jest w zleceniu, to Twoje własne znalezisko** |
| 5 | wołacze `POST /api/cloud/sources` (tworzenie) w `src/` | `1` (`CloudDataSettings.tsx:142`) | komenda (8) `§0.3` | TAK |
| 6 | trasa realnie obsługująca link „Zarządzaj” z Czatu | `/settings/integrations` → `ConnectedAppsSettings.tsx`, INNY system niż `cloud_sources` | komenda (9) `§0.3` | TAK |
| 7 | nowe pliki `test-only` blokujące `reachability --check-baseline` na markerze | `49` | komenda (10) `§0.3` | TAK |
| 8 | z nich, w zakresie tego dyżuru (`R4`) | `3`, wszystkie klasyfikowane `test-only`, wszystkie importują/czytają żywy zasób | komenda (10) `§0.3` | TAK |
| 9 | leaf-count PL/EN | `35294` / `33154` | komenda (11) `§0.3` | TAK — **ma zostać identyczne po całym dyżurze** |
| 10 | ostatnia litera w rejestrze znalezisk | `AM` w chwili pisania | komenda (12) `§0.3` | TAK — **sprawdź PONOWNIE tuż przed commitem** |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`dev-render/screens/chat-business-actions-nav.tsx` (nowy) ·
`dev-render/main.tsx` (jeden wpis rejestru) ·
`scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (nowy, poza licencją formalną —
narzędzie jednorazowe, jak `scripts/dev/idbridge-screenshots.mjs`, commituj normalnie) ·
USUNIĘCIE `src/components/AIChat/InputHintStrip.tsx` +
`src/components/AIChat/__tests__/InputHintStrip.test.tsx` ·
jedna linia w `EnhancedChatInput.teresaVoice.test.tsx` (`:98`) i jedna w
`tests/components/AIChat/EnhancedChatInput.teresa-error-toast.test.tsx` (`:85`) ·
USUNIĘCIE `src/components/settings/CloudDataSettings.tsx` +
`tests/unit/components/settings/CloudDataSettings.honesty.test.tsx` ·
dwa `it()` w `tests/integration/services/cloud-sync.p01ext.test.ts` (`:274-291`) ·
`scripts/dev/reachability-from-root.mjs` (jeden nowy tryb CLI) ·
nowy test tego trybu ·
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_ZRZUT_PORZADKI_REPORT.md` ·
`evidence/akcje-zrzut-porzadki-20260905/**`.

**Zapisujesz WARUNKOWO:**
`Dockerfile.api`/`Dockerfile.frontend` (WYŁĄCZNIE jeśli mianownik #1 obali tezę
`ODBIOR_368` — patrz tabela licencji) ·
`docs/program/waves/WAVE_03_ACCEPTANCE/reachability.baseline.json` (WYŁĄCZNIE
przez nowy tryb `--update-baseline-add`, WYŁĄCZNIE dla trzech plików z `R4`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `src/components/AIChat/UnifiedChatPanel.tsx`,
`src/hooks/useFeatureFlags.tsx`, `public/locales/**` (żadnego klucza),
`src/components/settings/ConnectedAppsSettings.tsx`,
`src/components/AIChat/AddFilesMenu.tsx`, `src/components/AIChat/CloudFilePicker.tsx`,
`src/services/api.ts`, `server/src/**` (cały), reszta
`tests/integration/services/cloud-sync.p01ext.test.ts` poza dwoma wskazanymi `it()`,
`tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`,
`server/vitest.config*.ts`, `.github/workflows/**`, `scripts/check-list-canon.sh`,
`scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (wszystkie),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md`,
jakikolwiek plik `docs/program/AUDYT_CZAT_PRZYCISKI_20260905/**`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day376-akcje-zrzut-porzadki
git diff --name-only --cached | tee /private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/staged.txt
bash -c "grep -iE '^src/components/AIChat/UnifiedChatPanel\.tsx$|^src/hooks/useFeatureFlags\.tsx$|^public/locales/|^src/components/settings/ConnectedAppsSettings|^src/components/AIChat/(AddFilesMenu|CloudFilePicker)\.tsx$|^src/services/api\.ts$|^server/src/|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|MODULE_ACCEPTANCE|REJESTR_G15|G19_INWENTARZ|AUDYT_CZAT_PRZYCISKI' /private/tmp/cx-day376-akcje-zrzut-porzadki-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Dowód idzie przez realny montaż, bez logowania, wzorem istniejącego
precedensu.** `dev-render/screens/chat-split-teresa-right.tsx` już dowodzi, że
`UnifiedChatPanel` montuje się bez ekranu logowania, jeśli zaszyjesz
`useAppStore` PRZED renderem. Jeśli napotkasz cokolwiek przypominające ekran
logowania albo PIN w Twoim nowym ekranie — to znaczy, że nie skopiowałeś wzorca
poprawnie, nie że zrzut jest niemożliwy. Nie zgłaszaj `BLOCKED_AUTH` bez
pokazania, czym różni się Twoja sytuacja od tego precedensu.

**(2) KROK 0 — cała rodzina, przed KAŻDYM usunięciem.** Dla `InputHintStrip` i
dla `CloudDataSettings` wypisujesz WSZYSTKIE miejsca, które o nich wspominają
(`grep -rn <Nazwa> src/ tests/ dev-render/`), i rozstrzygasz KAŻDE trafienie:
realny import (blokuje usunięcie), `vi.mock`/`vi.doMock` (usuń w tym samym
commicie), test-czytający-źródło (usuń dokładnie wskazany fragment), komentarz
(nie blokuje). Ta instrukcja wypisuje rodzinę, jaką zmierzył autor — Twój
pomiar może znaleźć więcej; jeśli tak, rozszerzasz `R2`/`R3` o znalezione
pozycje, nie milczysz o nich.

**(3) Nie dopisujesz martwego kodu do bezpieczników.** `R1` ma warunkową
licencję na Dockerfile — używasz jej TYLKO jeśli pomiar rzeczywiście obali
tezę `ODBIOR_368`. `R4` dodaje skryptowi nowy tryb, ale ten tryb ma mieć TEST,
który dowodzi, że ODRZUCA plik nieklasyfikowany jako `unreachable`/`test-only`
— nowy mechanizm bezpiecznika, który sam nie ma dowodu na to, że odmawia w
złym przypadku, jest gorszy niż brak mechanizmu.

**(4) Governed connectors (`/api/settings/integrations/*`, `500 {}` na
`google_drive`) są POZA ZAKRESEM.** `R3` ma je zmierzyć i zacytować jako dowód
w pytaniu do właściciela — nie naprawiać. Rozmiar tej naprawy (dyżur 369 R5:
„20-30 linii na dostawcę plus testy”) jest nieproporcjonalny do reszty tego
dyżuru.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus
`git show --stat` każdego commita. **Bez commita — to jest warunek, nie
pozycja.**

## R1 — ZRZUT „AKCJE BIZNESOWE” + PONOWNA WERYFIKACJA TEZY DOCKERA (rdzeń)

1. **Zweryfikuj tezę `ODBIOR_368`.** Uruchom komendy (1)-(2) z `§0.3`. Jeśli
   potwierdzają (oczekiwane: `0` ARG-ów, `0` odczytów `import.meta.env` w
   `useFeatureFlags.tsx`, ten sam wzorzec braku ARG-a dla WSZYSTKICH 25
   wpisów `DEFAULT_FLAGS`, nie tylko `chatBusinessActionsNav`) — **pomijasz
   Dockerfile w ogóle**, piszesz w raporcie „zweryfikowano ponownie na
   markerze `8f60ab998734…`, teza się potwierdza, ARG pominięty celowo” z
   cytatem swojej komendy. Jeśli pomiar obali tezę (znajdziesz odczyt
   `VITE_*` na tej ścieżce) — korzystasz z warunkowej licencji na Dockerfile
   (tabela licencji), dopisujesz ARG/ENV **i** odpowiadający kod w jednym
   commicie, z dowodem testowym.
2. **Zbuduj nowy ekran dev-render**, `dev-render/screens/chat-business-
   actions-nav.tsx`, kopiując strukturę `chat-split-teresa-right.tsx`
   niemal 1:1: `MemoryRouter`, ten sam stos providerów, `useAppStore.setState`
   z fikcyjnym, w pełni wypełnionym `currentUser`/`currentOrganization`,
   stuby na `Api` (te same wywołania co w montażu `/chat`: `getConversations`,
   `getConversationMessages`/`getMessages`, `workCanvasListDrafts`). RÓŻNICA
   od wzorca: (a) **PRZED** renderem, `localStorage.setItem('consultify_
   feature_flags', JSON.stringify({ chatBusinessActionsNav: true }))`
   (`STORAGE_KEY` z `useFeatureFlags.tsx`); (b) `<FeatureFlagsProvider
   config={{ enableLocalOverrides: true }}>` (BEZ tego override w
   `localStorage` jest po cichu ignorowany — `Pułapka` 2 tej instrukcji);
   (c) NIE musisz otwierać panelu roboczego (`?workPanel=1`) — cel zrzutu to
   nagłówek z widocznym przyciskiem „Akcje biznesowe” i target `/ai-actions`
   po kliku, nie split kanwy.
3. **Dodaj wpis do `dev-render/main.tsx`** (`React.lazy` + rejestr `SCREENS`),
   wzorem sąsiednich wpisów, `?screen=chat-business-actions-nav`.
4. **Uruchom harness na porcie 5587** (`npx vite --config dev-render/
   vite.config.ts --port 5587 &`, zapisz `$!`) i **napisz jednorazowy skrypt
   Playwright** `scripts/dev/akcje-zrzut-porzadki-screenshots.mjs` (wzorzec:
   `scripts/dev/idbridge-screenshots.mjs` — fresh `browser.newContext` per
   zrzut, `colorScheme` zgodny z `theme`, `waitUntil:'networkidle'`),
   robiący **cztery** zrzuty: `?lang=pl&theme=light`, `?lang=pl&theme=dark`,
   `?lang=en&theme=light`, `?lang=en&theme=dark` — każdy pokazujący
   widoczny przycisk „Akcje biznesowe” (ikona `Briefcase`, `data-testid=
   "chat-business-button"`) w nagłówku czatu.
5. **Dowód klikalności.** Osobno od zrzutów: test renderujący ten sam
   ekran/komponent z flagą włączoną lokalnie, klika przycisk, sprawdza że
   nawigacja trafia do `/ai-actions` (ten dowód mógł już istnieć z dyżuru
   368 — sprawdź `src/components/AIChat/__tests__/UnifiedChatPanel.
   przewodyChat.test.tsx`; jeśli test tam już to sprawdza i jest zielony na
   Twoim markerze, NIE duplikujesz go, cytujesz w raporcie zamiast pisać
   nowy).
6. **Zamknij harness** (`kill $PID`, NIGDY `pkill`), zapisz cztery PNG do
   `evidence/akcje-zrzut-porzadki-20260905/chat-business-actions-nav/`.

**Wymagany dowód:** wynik weryfikacji tezy `ODBIOR_368` (komendy (1)-(2)
`§0.3`) · cztery zrzuty PL/EN × light/dark z widocznym przyciskiem · dowód
klikalności (nowy albo zacytowany istniejący) · (WARUNKOWO) diff Dockerfile +
kod + test, jeśli teza upadła. **Commit po `R1`.**

## R2 — DOKOŃCZENIE USUNIĘCIA `InputHintStrip.tsx` (rdzeń)

1. **KROK 0 — potwierdź rodzinę.** Uruchom komendę (4) `§0.3`. Moja lista:
   komponent, jego dedykowany test, oraz DWA mocki w `EnhancedChatInput.
   teresaVoice.test.tsx:98` i `tests/components/AIChat/EnhancedChatInput.
   teresa-error-toast.test.tsx:85`. Jeśli znajdziesz więcej — dopisz do listy
   i usuń wszystkie w tym samym commicie.
2. **Zmierz reachability od korzenia** (komenda (5) `§0.3`) — oczekiwane
   `test-only`. Jeśli wyjdzie `app`/`harness-only` — **STOP na tej pozycji**,
   nie usuwasz, piszesz dlaczego (to dokładnie scenariusz `ActionCenter.tsx`
   z dyżuru 373).
3. **Dowód `vitest` przed/po dla OBU plików z mockiem.** Uruchom
   `npx vitest run src/components/AIChat/__tests__/EnhancedChatInput.
   teresaVoice.test.tsx --retry=0 --reporter=json --outputFile=…` i
   `npx vitest run tests/components/AIChat/EnhancedChatInput.teresa-error-
   toast.test.tsx --retry=0 --reporter=json --outputFile=…` — zapisz pełne
   nazwy testów PRZED usunięciem (mock obecny, komponent obecny).
4. **Usuń w JEDNYM commicie**: `InputHintStrip.tsx`, jego dedykowany test,
   linię `:98` w `teresaVoice.test.tsx`, linię `:85` w `teresa-error-toast.
   test.tsx`.
5. **Powtórz oba pakiety `vitest`** — ta sama lista pełnych nazw (poza
   usuniętą linią mocka, która nie jest testem), oba zielone, ten sam
   mianownik.
6. **Dowód „zero importerów pozostałych”**: `grep -rn "InputHintStrip" src/
   tests/ dev-render/` ma dać **zero** wyników.
7. **`esbuild` per plik** na obu dotkniętych plikach testowych, żeby
   potwierdzić brak błędu importu.

**Wymagany dowód:** lista rodziny (KROK 0) · klasyfikacja reachability ·
`vitest` przed/po dla obu plików z mockiem, te same pełne nazwy · dowód „zero
importerów” · `esbuild` obu plików. **Commit po `R2`.**

## R3 — USUNIĘCIE `CloudDataSettings.tsx` + USTALENIE ŻYWEJ TRASY (rdzeń)

1. **KROK 0 — potwierdź rodzinę** (komenda (6) `§0.3`). Moja lista: komponent,
   jego dedykowany test (`tests/unit/components/settings/CloudDataSettings.
   honesty.test.tsx`, usuwasz w całości), oraz DWA `it()` w `tests/
   integration/services/cloud-sync.p01ext.test.ts:274-291` (usuwasz TYLKO te
   dwa, reszta pliku zostaje — `CloudFilePicker`/`Api service`/backend
   `CONNECTORS` są POZA licencją tej pozycji).
2. **Zmierz reachability od korzenia** (komenda (7) `§0.3`) — oczekiwane
   `test-only` dla `CloudDataSettings.tsx`, `app` dla `ConnectedAppsSettings.
   tsx` i `ActionCenter.tsx` (kontrola, nie cel usunięcia). Jeśli
   `CloudDataSettings.tsx` wyjdzie `app` — STOP, nie usuwasz.
3. **Potwierdź, że jest jedynym wołaczem `POST /api/cloud/sources`**
   (komenda (8) `§0.3`) — jeśli znajdziesz DRUGIEGO wołacza gdziekolwiek w
   `src/`, zatrzymujesz się i piszesz o tym w raporcie zamiast usuwać.
4. **Ustal, która trasa realnie obsługuje „Zarządzaj źródłami w chmurze” w
   Czacie** (komenda (9) `§0.3`). Moje pomiar: `CloudFilePicker.tsx` woła
   WYŁĄCZNIE `GET /api/cloud/sources` (odczyt istniejących źródeł —
   `cloud_sources`, tabela naprawiona w dyżurze 369); `AddFilesMenu.tsx:258`
   nawiguje do `/settings/integrations`, które montuje `ConnectedAppsSettings.
   tsx` (`SettingsView.tsx:460`), korzystający z INNEGO systemu (tabela
   `integrations`, trasy `/api/settings/integrations/*`, `settings.routes.
   ts:1883-2032`). Sprawdź to SAM — jeśli Twój pomiar potwierdza (oczekiwane):
   napisz w raporcie WPROST, że są to DWA ROZŁĄCZNE systemy bez wspólnej
   tabeli ani trasy, że usunięcie `CloudDataSettings.tsx` NIE zamyka żadnej
   luki bezpieczeństwa na żywej trasie (bo żywa trasa nigdy nie korzystała z
   naprawionej bramki), i że sam fakt usunięcia martwego kodu nie czyni
   `ConnectedAppsSettings`/governed connectors bezpieczniejszym ani gorszym.
5. **Oceń ochronę tokenem na żywej trasie, TYLKO CZYTAJĄC.** Sprawdź, czy
   `/integrations/:provider/connect` (`settings.routes.ts:1883-2032`) wymaga
   `verifyToken` (tak, jak reszta `settings.routes.ts`) i czy przyjmuje token
   dostawcy z ciała żądania (`req.body`) zamiast wymagać realnego OAuth —
   jeśli tak, to jest analogiczna (ale NIE identyczna, bo inna tabela) luka
   do tej, którą 369 naprawił w `cloud_sources`. NIE naprawiasz jej —
   piszesz dokładny `plik:linia` + ocenę w raporcie i w sekcji „PYTANIA DO
   WŁAŚCICIELA” z rekomendacją, czy zasługuje na własny dyżur (podobnym
   rozmiarem do 369 R5's `500 {}`, czy mniejszym).
6. **Dowód `vitest` przed/po** dla `tests/integration/services/cloud-sync.
   p01ext.test.ts` — pełne nazwy testów PRZED (4 w opisywanym `describe`)
   i PO (2, tylko `CloudFilePicker`/`Api service`) — potwierdź że TE DWA
   pozostałe nie zmieniły treści ani statusu.
7. **Usuń w JEDNYM commicie**: `CloudDataSettings.tsx`, jego dedykowany test
   w całości, dwa `it()` w cudzym pliku.
8. **Dowód „zero importerów pozostałych”**: `grep -rn "CloudDataSettings"
   src/ tests/ dev-render/` ma dać **zero** wyników.
9. **`esbuild` per plik** na pozostałym po edycji `cloud-sync.p01ext.test.ts`.

**Wymagany dowód:** lista rodziny (KROK 0) · klasyfikacja reachability trzech
komponentów · dowód jedynego wołacza · pisemne ustalenie żywej trasy +
sprawdzenie ochrony tokenem (TYLKO ODCZYT) · `vitest` przed/po dla cudzego
pliku testowego, pełne nazwy · dowód „zero importerów” · `esbuild`.
**Commit po `R3`.**

## R4 — TRYB SELEKTYWNY `reachability-from-root.mjs` + TRZY PLIKI (rdzeń)

1. **Zmierz od zera na SWOIM worktree** (komenda (10) `§0.3`) — potwierdź:
   `exit 1`, `N` nowych plików `test-only`/`unreachable` (moja liczba: `49`,
   Twoja może się różnić o pliki, które inni autorzy scalili między
   napisaniem tej instrukcji a Twoim startem — jeśli tak, zapisz to jako
   korektę, nie jako powód do rozszerzenia zakresu). Potwierdź, że dokładnie
   TRZY z nich to `src/utils/__tests__/initiativeBridgeFlag.envStaticRead.
   test.ts`, `src/utils/__tests__/zaiTeresaFlag.envStaticRead.test.ts`,
   `src/views/admin/__tests__/AdminSettingsModule.healthSectionI18n.test.ts`.
2. **Dopisz nowy tryb CLI do `scripts/dev/reachability-from-root.mjs`**:
   `--update-baseline-add=<ścieżka1>,<ścieżka2>,…` (ścieżki względne repo,
   dokładnie w formacie kolumny `file` z dumpu JSON tego skryptu). Logika:
   (a) oblicz bieżącą klasyfikację jak dziś; (b) dla KAŻDEJ podanej ścieżki:
   jeśli klasyfikacja to `unreachable` — dodaj do `unreachable`-owej listy
   baseline (jeśli jeszcze jej tam nie ma); jeśli `test-only` — analogicznie
   do `testOnlyFiles`; jeśli `app`/`harness-only` albo ścieżka nie istnieje w
   ogóle w bieżącym pomiarze — **rzuć błąd i zakończ kodem ≠0, ZERO zapisu do
   pliku**; (c) wczytaj istniejący baseline, ZSUMUJ (nie zastępuj) nowe
   wpisy z istniejącymi (zachowaj WSZYSTKIE stare wpisy nietknięte, nawet
   jeśli któryś z nich stał się dziś czymś innym niż `unreachable`/`test-
   only` — ten tryb NIGDY nic nie usuwa, tylko dodaje); (d) zapisz
   `schemaVersion: 2` (bez zmiany schematu), wypisz dokładnie co dodałeś.
   Istniejące tryby (`--update-baseline`, `--check-baseline`,
   `--unreachable-only`, dump bezargumentowy) mają zachować się IDENTYCZNIE
   jak dziś — dowiedź tego testem regresyjnym (uruchom każdy z nich przed i
   po Twojej zmianie skryptu, porównaj wyjście bajt-w-bajt na tym samym
   stanie repo).
3. **Napisz test nowego trybu** (lokalizacja wg `§0.2` SCIEZKI), który
   dowodzi: (a) dodanie realnego, dziś-`test-only` pliku fixture kończy się
   sukcesem i baseline zawiera nową ścieżkę; (b) próba dodania pliku, który
   jest `app` (np. plik fixture importowany przez fikcyjny root testu, albo
   jeden z realnych plików `app:true` tego repo) kończy się odmową, kodem
   ≠0, i baseline NIE ZMIENIA SIĘ (porównaj hash pliku przed/po); (c) drugie
   uruchomienie z tym samym argumentem jest no-opem (idempotencja); (d)
   żaden istniejący wpis baseline nie zniknął (porównaj zbiór PRZED ⊆ zbiór
   PO).
4. **Uruchom `--update-baseline-add`** DOKŁADNIE z trzema plikami z punktu 1,
   w jednym wywołaniu. Zapisz diff `reachability.baseline.json` (dokładnie
   trzy nowe linie w odpowiednich tablicach, zero innych zmian).
5. **Zmierz `--check-baseline` PO**: oczekiwane WCIĄŻ `exit 1` (46
   pozostałych plików to NIE Twoja regresja), ale log „New test-only files”
   ma być krótszy o dokładnie 3, i żaden z trzech plików `R4` nie może się
   tam już pojawić.
6. **Cztery bezpieczniki** (`check-list-canon.sh`, `check-focus-canon.sh
   --ci`, `check-artefakt.sh` — kod `0`; `--check-baseline` — `exit 1`,
   OPISANY jako oczekiwany, nie regresja).

**Wymagany dowód:** diff skryptu (nowy tryb) · test regresyjny istniejących
trybów (wyjście identyczne przed/po) · test nowego trybu (4 przypadki z
punktu 3) · diff baseline (dokładnie 3 nowe wpisy) · `--check-baseline`
PRZED/PO z pełnym logiem (49 → 46 nazw, dokładnie te trzy zniknęły).
**Commit po `R4`.**

## R5 — RAPORT I PYTANIA DO WŁAŚCICIELA

Raport (`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY376_AKCJE_
ZRZUT_PORZADKI_REPORT.md`) zawiera: wynik weryfikacji tezy `ODBIOR_368`
(potwierdzona/obalona, z dowodem) · cztery zrzuty R1 (ścieżki w
`evidence/`) i dowód klikalności · potwierdzenie usunięcia `InputHintStrip.
tsx` z pełną rodziną (w tym oba mocki) · potwierdzenie usunięcia
`CloudDataSettings.tsx` z pełną rodziną (w tym trzeci, nieopisany w zleceniu
plik) · pisemne ustalenie, która trasa obsługuje „Zarządzaj źródłami w
chmurze” w Czacie i ocenę jej ochrony tokenem (TYLKO ODCZYT, nie naprawa) ·
opis nowego trybu `reachability-from-root.mjs --update-baseline-add` z
dowodem czterech przypadków testowych · stan `reachability --check-baseline`
PRZED/PO (49 → 46, lista pozostałych 46 do wiadomości, nie do naprawy) ·
rozbieżności liczb wobec tej instrukcji · **niepustą sekcję „TWIERDZENIA
NIEZWERYFIKOWANE”**.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Musi zawierać co
najmniej: (1) czy zrzut R1 jest akceptowany — jeśli tak, kiedy flaga
`chatBusinessActionsNav` ma dostać `defaultValue: true` i redeploy (osobna
decyzja, poza tym dyżurem); (2) czy `/api/settings/integrations/:provider/
connect` (governed connectors, `500 {}` na `google_drive`, dyżur 369 R5)
zasługuje na własny dyżur naprawczy TERAZ, i czy ma dostać ochronę tokenem
równoważną tej z `cloud_sources` — z Twoją oceną rozmiaru z `R3` pkt 5; (3)
czy pozostałe 46 plików `test-only`/`unreachable` blokujących
`reachability --check-baseline` mają dostać własny dyżur porządkowy, czy
zostają jako znany, tolerowany dług do czasu, aż każdy z nich trafi na wokandę
osobno.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest
GENEROWANY: `bash -c "grep -rl '<nazwa-pliku>' scripts/"`.

**Commit po `R5`.**

## Próg odbioru

**Cztery pozycje domknięte: zrzut PL/EN × light/dark istnieje i pokazuje
przycisk „Akcje biznesowe” za lokalnie włączoną flagą (flaga domyślna
pozostaje OFF w kodzie); teza o ARG/ENV Dockera zweryfikowana ponownie z
jawnym wynikiem (potwierdzona = pominięta, obalona = naprawiona w tym samym
commicie); `InputHintStrip.tsx` usunięty razem z obydwoma mockami, zero
importerów pozostałych; `CloudDataSettings.tsx` usunięty razem z pełną
rodziną (w tym plikiem znalezionym samodzielnie), z pisemnym ustaleniem, która
trasa jest żywa i czy ma równoważną ochronę tokenem; `reachability-from-root.
mjs` ma nowy, przetestowany tryb selektywny, użyty DOKŁADNIE na trzech
wskazanych plikach, `--check-baseline` przechodzi z 49 na 46 pozostałych
nowych plików.**

Odbiorca odrzuci dyżur, w którym: dopisano martwy ARG do Dockerfile bez
odpowiadającego kodu; usunięto plik, który okazał się żywy; pozostał dziurawy
mock albo import po usunięciu; nowy tryb `--update-baseline-add` przyjął plik
`app`/`harness-only` bez odmowy; baseline zyskał więcej niż trzy nowe wpisy
albo stracił którykolwiek istniejący; naprawiono (zamiast opisano) governed
connectors; leaf-count słowników się zmienił; którykolwiek z trzech
bezpieczników kanonu się zaczerwienił.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „R1 i R2
zrobione i udowodnione, R3 zatrzymany po ustaleniu żywej trasy — token na
`/integrations/:provider/connect` wygląda na słabszy, ale naprawa wykracza
poza ten dyżur, R4 niewykonane bo zabrakło czasu” — **jest pełnowartościowym
wynikiem**, jeśli każda zrobiona pozycja ma commit i dowód.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później:
**sprawdzasz warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie
na zapamiętanym wyniku.** Wynik ponownego sprawdzenia wklejasz do raportu z
datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Dodaj ARG/ENV do Dockera, bo bez tego flaga nigdy nie wejdzie na staging” vs „`ODBIOR_368` już zmierzył, że ten mechanizm nie używa ARG-ów” | `R1` pkt 1: pomiar rozstrzyga — jeśli teza się potwierdza, ARG pomijasz celowo i piszesz dlaczego; martwy ARG nigdy nie jest poprawną odpowiedzią |
| „Zrzut jest wymagany” vs „368 zgłosił `BLOCKED_AUTH`” | `R0` (1) i `R1` pkt 2: precedens `chat-split-teresa-right.tsx` obala STOP, kopiujesz wzorzec zamiast wynajdywać własny |
| „Usuń `InputHintStrip.tsx`” vs „373 zatrzymał się na drugim mocku” | `R2`: ta instrukcja rozszerza licencję o dokładnie tę jedną linię, którą 373 opisał jako brakującą |
| „Usuń martwy duplikat” vs „nie napraw architektury cloud” | `R3` pkt 4-5: usuwasz plik, ustalasz i opisujesz rozjazd systemów, NIE scalasz ich w tym dyżurze |
| „Zaktualizuj baseline dla trzech plików” vs „`--update-baseline` jest całościowy i odmówi” | `R4`: nowy, wąski tryb CLI zamiast istniejącego całościowego — rozwiązuje sprzeczność kodem, nie ręczną edycją |
| „Bezpiecznik ma zostać zielony” vs „46 innych plików wciąż go czerwieni” | „Warunki wspólne”: próg to „46 pozostałych, nie 49”, nie literalne `exit 0` |
| „KROK 0 wypisuje całą rodzinę” vs „zlecenie wymienia tylko dwa pliki na pozycję” | `R2`/`R3`: Twój pomiar może znaleźć więcej (jak trzeci plik `CloudDataSettings` w `cloud-sync.p01ext.test.ts`) — rozszerzasz licencję o znalezione pozycje, nie ignorujesz ich |
| „Nowy tryb ma dodawać wpisy” vs „baseline nietykalny ręcznie” | `R4` pkt 2: dodawanie WYŁĄCZNIE przez nowy, przetestowany kod skryptu, zero edycji JSON-a edytorem |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 8 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — wszystkie ścieżki R1-R4 odczytane przez autora na markerze `8f60ab998734…`; `dev-render/screens/chat-business-actions-nav.tsx` i `evidence/akcje-zrzut-porzadki-20260905/` jawnie oznaczone jako nieistniejące |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 10 wierszy, wszystkie zmierzone na markerze, w tym ponowne zmierzenie tezy `ODBIOR_368` |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — dev-render (2 pozycje) · Dockerfile warunkowo · InputHintStrip + 2 mocki · CloudDataSettings + 2 testy w cudzym pliku · ustalenie trasy (odczyt) · skrypt bezpiecznika + jego test · baseline · pozostałe 46 poza zakresem · bezpieczniki logiki · infrastruktura testowa · serwer · macierz · rejestr · dowody · raport · cudze tereny · reszta |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — R1 dotyka wyłącznie `dev-render/**` (+ warunkowo 2 Dockerfile), R2 dwa pliki + dwie linie, R3 dwa pliki + jeden cudzy z dwoma `it()`, R4 jeden skrypt + jego test |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — porty 6447/5587 własne, rodzeństwo 374/375/377 na innych portach, 367-373 już scalone do markera |
| 7 | Komendy paste-ready | TAK — bloki `§0.3`, „WARUNKI WSPÓLNE” i kontrola rozłączności uruchomione w całości na tym markerze |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — pięć pułapek własnych (fałszywy BLOCKED_AUTH, `enableLocalOverrides` wymagany jawnie, dwa rozłączne systemy cloud, całościowość `--update-baseline`, test-only ≠ osierocony) |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
