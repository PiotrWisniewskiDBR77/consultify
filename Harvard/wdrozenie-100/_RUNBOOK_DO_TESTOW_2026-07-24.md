# RUNBOOK: od teraz do „gotowe do testowania" (2026-07-24)

> ŹRÓDŁO PRAWDY o postępie mandatu końcowego. Czytaj PIERWSZY po wybudzeniu/kompakcji.
> Mandat: jedź autonomicznie aż WSZYSTKO zrobione → wypchnij na demo → posprzątaj gałęzie →
> sygnał „gotowe do testowania". Autoryzacja demo udzielona. Demo=trolley, NIE prod.

## BRAMKA WYJŚCIA (kiedy wolno dać Piotrowi do testowania)
Wszystkie prawdziwe:
- [ ] §4 audytu: 7/7 domknięte (dziś 6/7; zostaje powłoka §4.5/4.6)
- [ ] 6 kart n-Type na JEDNEJ powłoce, jedna szerokość, Menu 1==2==3 w 2 viewportach (szeroki+wąski)
- [ ] Wszystkie gałęzie tej doby scalone na hub (nic wartościowego nie wisi luzem)
- [ ] Trzecia runda 3 sędziów zmierzona; brak pozycji krytycznych
- [ ] Bramki realnie zielone (nie fałszywa zieleń): crimson-check na diff vs demo = 0, check-list-canon zielony
- [ ] Promocja na demo: gitSha na /api/health zgodny, deploy SUCCESS, re-tag demo-safe
- [ ] Migracje bazy (jeśli nowe) puszczone ręcznie na trolley, NIE centerbeam

## FAZY

### FAZA A — domknąć powłokę prerekwizyt + prace Piotra  [W TOKU]
- powłoka Etap 0+1 (`fix/powloka-etap0-etap1`, Opus) — wyrównanie NModeShell:170 + podpięcie Insight/Narzędzie do StandardArtifactShell
- fallbackRefineText — ★ JUŻ SCALONE na hub (fix/atrapa-aifieldenhancer, zweryfikowane przez sędziego IT); druga galaz fix/atrapy-ai-fieldenhancer NIEscalona — sprawdzic co wnosi
- bramki fałszywa zieleń (sesja Piotra) — 4 check-*.sh
CZEKAM na task-notifications. Nie odpalać Etapu 2 przed prerekwizytem.

### FAZA B — Ujednolicenie SZEROKOŚCI (nie pełna powłoka) [ZMIENIONE 2026-07-24]
★ ODKRYCIE: `StandardArtifactShell` jest PRZESTARZAŁY wobec kart — powstał przeciw staremu
`NModeToolbar`, zanim n-Type przeniósł karty na `NModeMenu2`. Podpięcie = przepisanie kontraktu
wspólnej powłoki (Menu2 zablokowane typem, panel gubi `className`/`statusBar`, nagłówek/aiContract).
To zmiana wszystkich 6 kart naraz = ryzyko regresji hurtem tuż przed testami (łamie regułę #9).
**DECYZJA CTO: rozdzielić cel wizualny (jedna szerokość) od architektonicznego (jedna powłoka).**
- Etap 0 (NModeShell Menu2) — ✅ SCALONY, wyrównał Insight/Narzędzie.
- Cel wizualny TERAZ: ujednolicić `max-w-*` 3 kart ręcznych do kanonicznej `max-w-6xl` (1152, jak
  NModeShell): Decyzja `[1500px]`→`6xl`, Zadanie `[1500px]`→`6xl`, Inicjatywa `7xl`→`6xl`.
  Powiadomienie już `6xl`. Render-verify Decyzji/Zadania (zwężenie −348 px — czy treść nie cierpi).
  Jeśli treść wygląda źle przy 1152 → eskalacja do Piotra (docelowa szerokość = decyzja wizualna).
- Pełna powłoka `StandardArtifactShell` (aktualizacja kontraktu + migracja 6 kart) = OSOBNY PROJEKT
  architektoniczny, NIE blokuje testów. Zgłoszony chipem.

### FAZA C — scalać partiami z twardą weryfikacją
Po każdej partii: merge --no-ff, grep fizycznej obecności kluczowych zmian (lekcja 2 delecji),
esbuild parse-only, crimson-check na diff vs demo = 0, check-list-canon zielony. Aktualizuj §9 audytu.

### FAZA D — trzecia runda 3 sędziów (Grafika/Merytoryka/IT)
Na SCALONYM kompletnym stanie. Skala 0-10. Pierwszy uczciwy pomiar od 7,1. Prompt sędziego:
patrz `_PETLA_NOCNA_9_5_2026-07-23.md` §1. Weryfikacja w realnym runtime (render+DOM+kod), nie docy.

### FAZA E — pętla napraw (jeśli sędziowie znajdą krytyczne)
Fale robotnicze na TOP brakach, rozłączne pliki. Wróć do C. Wyjście gdy brak krytycznych + spójne.

### FAZA F — PROMOCJA NA DEMO (procedura consultify-promocja-demo)
1. git fetch, pre-flight merge-tree. 2. Bramki + esbuild. 3. Merge do demo w izolowanym worktree.
4. Twarda weryfikacja plików. 5. Migracje ręcznie na trolley (host-guard!). 6. Push. 7. Railway monitor.
8. gitSha na /api/health == wypchnięty SHA. 9. Re-tag demo-safe-2026-07-24 (lub nowy dzień).

### FAZA G — SPRZĄTANIE GAŁĘZI (żeby nic nie utracić)
Cel: każda gałąź TEJ DOBY albo scalona na demo, albo świadomie zarchiwizowana z notatką.
- Wypisz gałęzie sesji (n-type/powloka/regresje/pasek/eksport/podglad/atrapy/grafika/rubryka).
- Potwierdź, że ich commity są osiągalne z demo po promocji (git merge-base --is-ancestor).
- Gałęzie NIEscalone a wartościowe → dołącz albo otaguj `zachowane/<nazwa>-2026-07-24`.
- NIE force-push, NIE kasować cudzych gałęzi spoza sesji. „Nie utracić" > „posprzątać ładnie".

### FAZA H — SYGNAŁ „GOTOWE DO TESTOWANIA"
Jasny komunikat: co testować (6 kart + tryby + light/dark), co zmienione od nocy, link/URL demo,
punkt cofania, znane ograniczenia. Piotr klika, nie odkrywa zepsucia.

## LOG POSTĘPU (dopisuj po każdej fazie)
- 2026-07-24: partia 1 scalona (17 ponad demo). §4 6/7. Runbook założony. Faza A w toku.

## LOG (ciąg dalszy)
- 2026-07-24: Etap 0 powłoki scalony (Menu2 wyrównane). Szerokość 3 kart → 6xl scalona (partia).
  §4.5 DOMKNIĘTE (jedna szerokość 1152, 2 viewporty, treść OK — caveat: gęste tabele Decyzji/Zadania
  na analogii Inicjatywy, nie na bezpośrednim mocku). §4.6 odłożone (chip StandardArtifactShell).
  §4: 6/7 domknięte + 1 świadomie odłożone. Hub 23 ponad demo. → Faza D: trzecia runda sędziów.

## LOG — faza E (naprawy po rundzie 3)
- Scalone na hub: martwy kod Inicjatywy (3 pliki, 1503 l. — ★ `InitiativeFullView` ZOSTAŁ, sędzia IT
  się mylił: żywy lazy-import w `MyWorkHub:166/3447`, ścieżka My Work→Kalendarz→inicjatywa);
  logi zamiast 21 cichych `catch`; crimson Callout→`c-ai` (BLOKER zdjęty); 190 polskich wartości.
- ★★ **ZŁAPANA REGRESJA NA HUBIE:** `SidebarHeader` miał STARSZĄ wersję (`text-primary-500`, stały
  crimson ~2,5:1 w ciemnym, axe color-contrast) — demo ma naprawę `text-c-accent`. Nocne scalenie
  `origin/demo→hub` (9b143bc913) rozstrzygnęło na korzyść starszej strony. Demo nietknięte, ale
  poszłoby przy NASTĘPNEJ promocji. Przywrócone z origin/demo.
  ★ LEKCJA: crimson-check tylko na WŁASNYCH plikach nie wystarcza — sprawdzaj CAŁY diff vs demo.
- ★★ **DEMO POSZŁO DO PRZODU O 57 COMMITÓW** (sesja IDEE: P0-P3, menu/panel/rail, fantom
  `tablePlatformRecordsApi`). demo `97f466bd98`→`5e35d8a76c`. Scalone do huba BEZ konfliktów.
  Wszystkie 9 napraw doby zweryfikowane fizycznie PO merge — przetrwały. Demo = przodek huba ✓.
  ★ Potwierdza regułę: demo żyje pod wieloma sesjami — ZAWSZE fetch przed pracą i przed promocją.
- Stan: hub 33 ponad demo. Zostaje: front enumów (w toku), geometria kart (D), potem promocja.
- Geometria scalona. Werdykt o sprzeczności: sędzia miał rację co do Inicjatywy (Menu1 1088 vs
  Menu2 712 = 376 px, potwierdzone), mylił się co do skoku pionowego (podział szedł po RODZINIE
  powłok 24 vs 16, nie po jednej karcie); mój agent mierzył kontener limitu, nie realne pasy.
  Marginesy 24 px w Insight/Narzędziu = NIE defekt (panel `_DOCKED` zwęża kolumnę poniżej limitu).
  Naprawione: Inicjatywa, Powiadomienie, skok pionowy→16, rytm Menu1→Menu2→16. Zweryfikowane
  12 renderów (1280+1440) + dodatkowo 1024/1152.
  ★ DŁUG: identyczna szerokość WSZYSTKICH 6 wymaga przepisania powłoki (dotknęłoby też
  InterviewWorkspace/ToolDocumentView) — zgłoszone, nie forsowane. Tryb C Inicjatywy
  (`InitiativeDocumentView:10666`) zachowuje stary padding — kanoniczny tryb N naprawiony.

## FAZA F — PROMOCJA WYKONANA ✅
demo = **`12826509a2`**, potwierdzone SAMODZIELNIE na `https://demo.consultify.ai/api/health`
(gitSha zgodny, branch demo, database+redis connected, strona HTTP 200). Railway SUCCESS.
Tag **`demo-do-testow-2026-07-24`** = stan do testów Piotra (świadomie NIE „safe" — akceptacji jeszcze nie ma).
`demo-safe-2026-07-24` (`97f466bd98`) NIETKNIĘTY.
★ Demo uciekło w trakcie promocji jeszcze raz (5. raz w dobie, +17 commitów IDEE) — scalone,
render-verify 6 kart POWTÓRZONY (12/12 czysto), dopiero potem push.
★ Migracje: BRAK w tej partii. Nic nie uruchamiano na żadnym hoście. PROD/centerbeam nietknięty.
★ Incydent: `/private/tmp/promote-demo` należał do INNEJ sesji (niewypchnięte cherry-picki IDEE);
`git worktree add` odmówił, ale `cd` przeszedł i pierwszy merge wylądował na cudzym WIP. Wykryte przy
sprawdzaniu rodziców commita, cudzy worktree cofnięty do stanu zastanego, merge powtórzony w czystej
ścieżce. **Do demo nie poszedł ani jeden cudzy commit.** LEKCJA: `worktree add` nie zabezpiecza, bo `cd` przechodzi.

## FAZA G — SPRZĄTANIE GAŁĘZI ✅
Wszystkie gałęzie doby (2026-07-23/24) sprawdzone `merge-base --is-ancestor` wobec demo.
**Bezpieczne (osiągalne z demo): 37.** Wiszące poza demo: 8, z czego 1 pusta (`test/idee-preferred-tool`, 0 commitów).
**7 pozostałych ZABEZPIECZONE tagami `zachowane/*-2026-07-24` i WYPCHNIĘTE na origin** — commity nie zginą
nawet po skasowaniu gałęzi:
`odbior/lokalny-2026-07-23` (73 commity IDEE — ★ NIEPOWIĄZANA historia, tylko cherry-pick, NIGDY merge),
`materialy/r11-doc-slice` (12), `fix/atrapy-ai-fieldenhancer` (1), `fix/panel-akcji-kolor` (1),
`fix/n-type-domkniecie-{inicjatywa-decyzja,zadanie-powiadomienie,insight-narzedzie}` (5+1+1).
Świadomie NIE scalane: niezweryfikowane w tej sesji + jedna z niepowiązaną historią. „Nie utracić" > „scalić szybko".

## FAZA H — GOTOWE DO TESTOWANIA ✅ (2026-07-24)
||||||| ec587c8e70

## DoD migracji powłoki (6 kart n-Type) — dopisane 2026-07-24, sesja aparatu pomiarowego

> Migracja dotyka 6 kart naraz, więc „wygląda dobrze" nie wystarcza. Dowodem jest pomiar
> `scripts/karty-n-geometria.mjs` przeciwko baseline'owi zdjętemu z `origin/demo 12826509a2`:
> `Harvard/wdrozenie-100/_BASELINE_GEOMETRIA_KART_2026-07-24.md` (+ JSON i 12 zrzutów obok).

### Bramka 0 — najpierw sprawdź PRZYRZĄD, potem ekran
- [ ] `node scripts/karty-n-geometria.mjs --self-test` = **12/12**. Kontrolki wstrzykują sztuczny
      błąd konsoli, crimson, enum, komunikat błędu i usuwają kotwicę Menu 2. Czerwony self-test →
      pomiar bez wartości dowodowej, nie wolno nim niczego odbierać.
      (Powód reguły: `check-triada` była trwale ślepa przez `grep` w BRE na macOS — narzędzie
      pomiarowe cicho unieważniło pomiar.)

### Bramka 1 — geometria (6 kart × viewporty 1280 i 1440, light)
- [ ] W KAŻDEJ karcie i KAŻDYM viewporcie: `Menu1.left == Menu2.left == Sekcje.left` (co do piksela).
- [ ] W KAŻDEJ karcie i KAŻDYM viewporcie: `Menu1.width == Menu2.width` (co do piksela).
- [ ] Żaden z 5 pasów nie ma flagi `podejrzanyKontener` (= nie zmierzono kontenera `max-w-*`
      zamiast realnego pasa — tak powstał fałszywy „zgodny" pomiar 24.07).
- [ ] Komplet 5 pasów zmierzony w każdej karcie (Menu 1, Menu 2, pas sekcji, lewa nawigacja,
      prawy panel). Zniknięcie pasa = regresja, nawet jeśli ekran „wygląda".
- [ ] **Jedna szerokość MIĘDZY kartami** (cel migracji): przy 1440 wszystkie 6 kart mają tę samą
      `Menu1.width` i tę samą `Menu1.left`; to samo przy 1280.
      ★ Baseline ma tu DWIE RODZINY (768 stałe vs 840/1000 płynne) — kryterium wewnątrzkartowe
      tego NIE wykryje, dlatego to osobny punkt.
- [ ] `prawyPanel.width` niezmieniony vs baseline (dziś 360 px w każdej karcie).
- [ ] `prawyPanel.left >= Sekcje.right` — panel nie nachodzi na centrum w żadnym viewporcie.

### Bramka 2 — brak regresji vs baseline (automat: `--porownaj=<baseline.json>`, exit 1 = stop)
- [ ] **Zero nowych błędów konsoli** — liczba po odfiltrowaniu szumu nie większa niż w baseline
      (baseline = 0 w każdej z 12 kombinacji).
- [ ] **Zero error-boundary** — brak „Coś poszło nie tak"/`Cannot read propert…`/`ChunkLoadError`
      na którymkolwiek ekranie.
- [ ] **Crimson nie wzrósł** (baseline = 0). Wzrost = naruszenie prawa nadrzędnego UI #3.
- [ ] **Zero surowych enumów** (`SCREAMING_SNAKE`, slugi `a-z-a-z`) — baseline = 0.
      Wyjątki są w skrypcie i są zamknięte: `trade-off`, daty ISO, nazwy plików/URL,
      utrwalone złożenia, `shadow-board` (Lean/5S). Nowy wyjątek dopisuje się z komentarzem
      i wskazaniem pliku źródłowego, NIE po to, żeby wyciszyć realny wyciek.
- [ ] **Komplet sekcji prawego panelu nie zmalał** w żadnej karcie i żadna nazwana sekcja
      nie zniknęła (baseline: Decyzja 6, Zadanie 6, Powiadomienie 6, Insight 7, Narzędzie 4,
      Inicjatywa 7). Wzrost jest dozwolony (np. dorobienie AKCJI w Narzędziu).
- [ ] Kolejność sekcji panelu bez przetasowań niezamierzonych (WŁAŚCIWOŚCI zawsze przed
      POWIĄZANIA, HISTORIA na końcu tam, gdzie jest).
- [ ] `aria-label` prawego panelu nadal polski i per karta — nie zdegradowany do domyślnego
      `Artifact details` z `ArtifactRightPanel`.

### Bramka 3 — oczy, nie liczby (reguła #7: Piotr nie jest pierwszym testerem wizualnym)
- [ ] 12 zrzutów po migracji (6 kart × 1280/1440) obejrzanych przeze mnie i porównanych ze
      zrzutami baseline `_BASELINE_GEOMETRIA_KART_2026-07-24/zrzuty/`.
- [ ] Treść nie zniknęła: `znaki` i `klikalne` w JSON nie spadły istotnie (>20%) vs baseline.
- [ ] Dark mode sprawdzony wzrokiem na min. 2 kartach (aparat mierzy light — to jego znany limit).
- [ ] Dopiero po tym Piotr patrzy — do AKCEPTU, nie do odkrywania zepsucia.

### ★ Pułapki tej doby, których migrator ma unikać
1. **Mierzenie kontenera `max-w-*` zamiast realnego pasa.** Tak powstał fałszywy dowód zgodności,
   podczas gdy Menu 2 było węższe od Menu 1 o 2×24 px. Zawsze rect elementu z tłem/ramką.
2. **`innerText` nie pokazuje `.value` pól formularza.** Enumy potrafią siedzieć w inputach
   i „nie istnieć" w pomiarze. Aparat czyta też `.value`, `selectedOptions` i `placeholder`.
3. **Harness, który nie montuje badanego komponentu.** Zielony wynik z ekranu, na którym
   badanej rzeczy nie ma, to nie wynik. Stąd kontrolka „komplet 5 pasów zmierzony".
4. **Bramka ślepa z powodu narzędzia, nie kodu** (`grep` BRE na macOS w `check-triada`;
   `check-triada` skanuje tylko NOWE linie — na czystym drzewie nie bada NIC).
   Przed użyciem jakiejkolwiek bramki: udowodnij, że łapie wstrzyknięty defekt.
5. **`primary-*` (każdy numer) = crimson.** W powłoce zabroniony; hook `check-artefakt.sh` blokuje.
   Czerwień tylko dla semantyki krytycznej.
6. **Diff liczony tylko na własnych plikach.** Regresja `SidebarHeader` przyszła ze scalenia,
   nie z edycji. Crimson-check rób na CAŁYM diffie vs `origin/demo`.
7. **Demo żyje pod wieloma sesjami.** `git fetch` przed pracą i przed promocją; baseline zdjęty
   z `12826509a2` — jeśli demo poszło dalej, zdejmij baseline ponownie zanim orzekniesz regresję.
8. **Sprawdź hipotezę próbą, zanim ją ogłosisz.** 324 „błędy" okazały się jednym.
9. **Nie „poprawiaj przy okazji" sekcji panelu ani etykiet** — DoD karze ubytek, a niezamierzone
   przetasowanie kolejności trudno potem odróżnić od zamierzonego.
