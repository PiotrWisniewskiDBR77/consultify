---
doc_id: dziennik-grafika
status: canonical
truth_type: event-log
established: 2026-08-30
zasada_zrodlowa: 00_ZASADY_PRACY.md reguła nr 10 (dokumentuj kontekst zdarzenia)
---

# Dziennik toru Grafika — chronologia zdarzeń i ich kontekst

**Po co ten plik.** Wynik zapisuje się sam — jest w kodzie i w commicie. Tu zapisujemy
to, czego z wyniku odtworzyć się nie da: dlaczego tak zdecydowano, co się okazało
nieprawdą, kto co zgłosił, i czym rzecz omal się nie skończyła.

Nowe wpisy **na górze**. Każdy wpis: co się stało · dlaczego to ważne · co z tego wynika.

---

## 2026-09-02

### Z-51 · `vite build` przewraca się na braku pamięci, a EXIT 134 wygląda jak awaria kodu
**Co się stało:** przy bramce budowy przed oddaniem partii kart modułowych `npx vite build` zakończył się
kodem **134** z komunikatem `FATAL ERROR: Ineffective mark-compacts near heap limit — JavaScript heap out of
memory`. Commit, którego dotyczyła bramka, **nie zawierał ani jednego pliku z `src/`** (sprawdzone:
`git show --stat HEAD | grep -c '^ src/'` = 0), więc budowa nie mogła paść przez tę zmianę. Powtórka
z `NODE_OPTIONS=--max-old-space-size=8192` → **EXIT 0, „✓ built in 36.98s"**.

**Dlaczego ważne:** kod 134 to SIGABRT i w logu CI wygląda dokładnie jak realna awaria budowy. Bramka,
która pada z tego powodu, uczy zespołu najgorszego możliwego odruchu — „budowa czasem pada, puść jeszcze
raz" — a wtedy prawdziwa regresja przejdzie tą samą ścieżką i nikt jej nie odróżni. To jest ten sam kształt
co „brak pomiaru nie jest wynikiem": narzędzie nie powiedziało „kod jest zły", tylko „nie dałem rady
zmierzyć", a my czytamy to jako werdykt o kodzie.

**Co z tego wynika — reguła, nie notatka:**
1. **Każde uruchomienie budowy w tym repozytorium wymaga `NODE_OPTIONS=--max-old-space-size=8192`.**
   Bez tego wynik bramki jest nieinformatywny — ani nie potwierdza, ani nie obala poprawności kodu.
2. **EXIT 134 (albo `heap out of memory` w logu) czytaj jako BRAK PAMIĘCI, nie jako błąd kodu.** Zanim
   zaczniesz szukać winnego w diffie, powtórz z podniesioną stertą. Dopiero powtórka, która znowu padnie,
   jest sygnałem o kodzie.
3. **Kontrola, która kosztuje jedno polecenie:** `git show --stat HEAD | grep -c '^ src/'`. Jeśli commit
   nie rusza `src/`, a budowa pada — to prawie na pewno środowisko, nie zmiana.
4. Docelowo `NODE_OPTIONS` należy wpisać do skryptu `build` w `package.json` albo do konfiguracji CI, żeby
   nie zależało to od tego, kto pamięta. **Świadomie tego dziś NIE robię** — `package.json` jest plikiem
   współdzielonym przez oba tory, a w katalogu pracuje równolegle kilku wykonawców (reguła nr 14). Zgłaszam
   to nadzorcy jako osobną decyzję, zamiast wchodzić w cudzy plik przy okazji innej roboty.

**Skąd wiadomo:** pomiar 2026-09-02 przy commicie `419b2915e7` (karty modułowe), dwa przebiegi
tej samej komendy różniące się wyłącznie zmienną `NODE_OPTIONS`.

### Z-50 · Graf importów zalicza 283 ekrany z 313 — automatyczne zaliczenie przez hub jest liczbą bez wartości
**Co się stało:** właściciel polecił 02.09 oznaczyć jako „poprawione" KAŻDY ekran, którego dotknęły
dzisiejsze zmiany. Zbudowałem `scripts/dev/grafika-dotkniete.mjs` — przechodzi PRZECHODNIO graf importów
każdego z 313 ekranów rejestru, od wpisu w `dev-render/main.tsx` (także przez `lazy(() => import(...))`,
którego grep po `<Nazwa` nie widzi) w głąb `src/`, i przecina go z 63 plikami zmienionymi tego dnia oraz
162 zmienionymi kluczami słownika. Pierwszy przelot dał **283 ekrany z 313**. To nie był sukces pomiaru,
tylko jego awaria: **cztery pliki-huby odpowiadały prawie za cały wynik** — `src/i18n.ts` trafiał w 274
ekrany, `EntityStatusChip.tsx` w 219, `FilterableTable.tsx` w 162, `useConversationStore.ts` w 105.
Odpowiedź „283 z 313" jest formalnie prawdziwa i całkowicie bezużyteczna: właściciel dostałby 283 karty
do obejrzenia, z których większość wygląda dokładnie tak samo jak wczoraj.

**Dlaczego ważne:** to jest ta sama rodzina co „wołacz istnieje ≠ renderuje się", ale o piętro wyżej.
Tam pytanie brzmiało „czy komponent jest w ogóle renderowany". Tu brzmi: **„czy TA konkretna zmiana w tym
pliku jest widoczna na TYM ekranie"** — i graf importów na to nie odpowiada, bo nie wie, co się w pliku
zmieniło. Osiągalność w grafie to warunek KONIECZNY widoczności, nigdy WYSTARCZAJĄCY. Im bardziej
podstawowy plik, tym bardziej bezwartościowe jest jego trafienie: hub trafia wszędzie właśnie dlatego,
że jest hubem.

Drugi wariant tej samej pułapki, zmierzony tego samego dnia: **powłoka zakładek**. Ekran `ustawienia-*`
montuje JEDNĄ zakładkę, ale plik powłoki importuje wszystkie dziesięć. Graf zaliczył 10 ekranów Ustawień,
gdy zmieniły się dwie zakładki (`ConnectedAppsSettings`, `DataControlsSettings`). Osiem kart byłoby
kłamstwem o zakresie naprawy — nie o tym, czy plik jest osiągalny, tylko o tym, czy właściciel coś zobaczy.

**Co z tego wynika — reguła na przyszłość, nie notatka z dzisiaj.**

1. **Każdy plik trafiający w więcej niż ~30% rejestru jest HUBEM i nie zalicza ekranu automatycznie.**
   Dostaje JAWNY, wypisany warunek widoczności, a warunek wyprowadza się z DIFFA tego pliku, nie z faktu
   trafienia. Cztery warunki zastosowane 02.09, dla porządku:
   - `src/i18n.ts` (274) — **ODRZUCONY**. Zmieniono ostateczny fallback języka dla gościa, którego przeglądarki
     nie umiemy rozpoznać. Widoczne WYŁĄCZNIE na ekranach przed zalogowaniem — a te i tak są w partii osobno.
   - `src/store/useConversationStore.ts` (105) — **ODRZUCONY**. Dopisane pole TYPU. Zero zmiany na ekranie.
   - `EntityStatusChip.tsx` (219) — **PRZYJĘTY WARUNKOWO**: tylko tam, gdzie ekran naprawdę pokazuje stan
     cyklu życia, któremu zdjęto czerwień (anulowane/wygasłe/cofnięte).
   - `FilterableTable.tsx` (162) — **PRZYJĘTY WARUNKOWO**: tylko tam, gdzie zmienił się także WŁASNY plik
     ekranu. Sama lista konsumentów wspólnej tabeli nie jest listą ekranów zmienionych widocznie.
2. **Powłoka zakładek nie zalicza sióstr.** Zmiana w jednej zakładce oznacza JEJ ekran, nie wszystkie
   zakładki, które powłoka importuje. Sprawdzenie: czy wpis w `main.tsx` przekazuje tej zakładce parametr
   (`<UstawieniaGrupyScreen grupa="integracje" />`) — jeśli tak, siostry są fałszywym trafieniem.
3. **Liczba, która obejmuje prawie cały rejestr, jest sygnałem awarii pomiaru, nie sukcesu.** Zanim ją
   zameldujesz, policz, ile ekranów zalicza NAJCZĘSTSZY pojedynczy plik. Jeśli jeden plik odpowiada za
   większość wyniku — pomiar odpowiedział na inne pytanie, niż zadano.
4. **To działa w drugą stronę i to jest cenniejsze:** ten sam pomiar wykazał 11 zmienionych plików, których
   NIE osiąga żaden ekran harnessu (6 kolejek decyzyjnych Mojej Pracy, 4 widoki Wyników, `SystemSettings`).
   Naprawa tam jest w kodzie i jest niepokazywalna. Graf importów jest bezużyteczny jako dowód „widać",
   ale jest mocnym dowodem „NIE MA JAK ZOBACZYĆ" — i w tej roli należy go używać bez zastrzeżeń.

**Skąd wiadomo:** `scripts/dev/grafika-dotkniete.mjs`, pomiar i tabela per ekran w
`docs/program/grafika/POPRAWIONE_20260902.md`. Wynik po nałożeniu warunków: **92 ekrany rejestru**
(+ 6 ekranów logowania dopisanych do rejestru), nie 283.

### Z-49 · Zwinięta sekcja nie jest dowodem, że w środku jest polski — Z-48 był połowiczny, rodzina badge'u REALNE/CZĘŚCIOWE miała 5 wystąpień, nie 1
**Co się stało:** nadzorca obejrzał zrzut Z-48 własnymi oczami (nie „testy przeszły") i złapał to, czego pomiar
nie objął: rozwinięta domyślnie sekcja „EDYCJA I AI" była CAŁA po angielsku (AI ON SELECTION, Expand idea/
Shorten/Rewrite/Suggest, Instruction for Teresa..., Preview AI edit) i „VERSIONING" też — mimo że Z-48 mówił
o naprawie tego samego menu. Nakaz: rozwiń KAŻDĄ sekcję i sprawdź każdą tak samo. Po rozwinięciu wszystkich
akordeonów (nowy krok harnessu: `details.open = true` na każdym `<details>` w dropdownie, 1:1 z kliknięciem)
wyszło DRUGIE, poważniejsze odkrycie: `renderCapabilityBadge`/badge Możliwość=REALNE/CZĘŚCIOWE miał w tym
pliku **5 wywołań**, nie jedno — Z-48 zgasił tylko 2 (te w „Diagnostyka"/„Przepływy pracy"). Trzy zostały
zapalone i niewidoczne w zwiniętym zrzucie: (1) sekcja „Szablony startowe" w tym samym kebabie, (2) lista
„Z szablonu" w OSOBNYM menu „+" (nowy dokument, `canvas-new-menu-v2`, flaga `VITE_CANVAS_NEW_DOC_OPTIONS`
domyślnie ON — więc to jest to, co widzi KAŻDY użytkownik klikający „+"), (3) legacy fallback tego samego
menu (flaga OFF path, dziś martwy kodem, ale wciąż osiągalny) — plus angielski nagłówek „New Canvas from
template" tam. Dodatkowo cztery inne niezwiązane z badge'em angielskie stringi bez `t()` w ogóle: „Retry
projection"/„Reset"/„Version history"/„Show changes" w „Zaawansowane", `latestDiff.summary` („X lines added,
Y lines removed"), i zdublowane „Dataset ready: {filename}" / „Deterministic Canvas analysis. No code
execution." (dwa miejsca, floating popover + sekcja Plik/eksport).

**Dlaczego ważne:** greppowanie po NAZWIE FUNKCJI (`renderCapabilityBadge`) potwierdziło że kod żyje tylko
w jednym pliku — ale nie sprawdziło ILE RAZY funkcja jest WOŁANA i czy KAŻDE wołanie jest zagate'owane.
„Zero innych plików" ≠ „zero innych wystąpień". To wariant kształtu „próbka zamiast zbioru": zmierzyłem
przynależność do rodziny, nie policzyłem członków rodziny.

**Co z tego wynika:** wszystkie 5 wywołań `renderCapabilityBadge` teraz za `isCanvasDevDiagnosticsEnabled()`
(3 nowe: linie ~3548, ~3615, ~4132). Nowe klucze i18n: `canvas.panel.selection.*` (9 kluczy — AI na
zaznaczeniu/Rozwiń myśl/Skróć/Przeredaguj/Zaproponuj/placeholder/Podgląd zmiany AI/Zaznaczenie/pusty stan),
`canvas.panel.versioning.title`, `canvas.panel.advanced.*` (retryProjection/reset/showChanges/diffSummary),
`canvas.panel.dataset.readyPrefix`+`analysisNote`, `canvas.panel.newMenu.legacyFromTemplate`. Pułapka
techniczna po drodze: mock `react-i18next` w `tests/setup.ts` robi naiwną zamianę POJEDYNCZEGO nawiasu
(`{var}`), więc prawdziwe i18next-owe `{{var}}` zostawia sierotę-nawias w testach — istniejący dług (linie
2291/2303 tego samego pliku mają ten sam wzorzec, nigdy nietestowany więc nigdy niezłapany); dla dwóch
nowych miejsc z realną asercją tekstu ominięto to, dzieląc string na statyczny prefiks przez `t()` + goły
JS dla nazwy pliku (nazwy plików i tak nie są tłumaczalne). Harness `canvas-kebab-restructure` rozwija
teraz WSZYSTKIE sekcje przed zrzutem — nowy standard dla tego ekranu, żeby ten kształt się nie powtórzył.
Zrzuty PO (rozwinięte, 3600px wysokości): `evidence/grafika/214-kebab-diagnostyka/`.

### Z-48 · Menu „⋯" kanwy pokazywało każdemu klientowi surowy żargon audytu wdrożenia (REALNE/CZĘŚCIOWE, „…are backed") — nie flaga, nie atrapa, realny komponent produkcyjny
**Co się stało:** pomiar właściciela na zrzucie karty `canvas-kebab-restructure` potwierdzony w kodzie:
`WorkCanvasDocumentPanel.tsx` (montowany produkcyjnie przez `UnifiedChatPanel.tsx`, bez żadnej flagi
`import.meta.env`/`NODE_ENV`) renderował KAŻDEMU użytkownikowi sekcję „Diagnostyka i workflow" z badge
Możliwość=REALNE/CZĘŚCIOWE, notatkami inżynierskimi po angielsku („Markdown document, autosave, versions,
export and Teresa context are backed.") oraz „MD file properties" (save/projection/lifecycle state).
Selektor szablonu przepływu i przycisk „Start workflow" miały twardo wpisane angielskie etykiety mimo że
wołają realny backend (`Api.workCanvasCreateWorkflow` → `server/src/routes/work-canvas.routes.ts`) —
NIE atrapa. „Send to Document/Table Studio" wołały poprawne moduły, ale etykietami z pl translation.json
nazywały je „Document Studio"/„Table Studio" zamiast nazw z menu głównego („Studio Dokumentów"/„Tabele Studio").

**Dlaczego ważne:** to trzeci przypadek (po Z-46) tego samego mechanizmu — pomiar/status wdrożenia
wycieka na ekran klienta jako treść. Tu akurat funkcja BYŁA realna (workflow), więc naprawą nie mogło
być zwykłe „usuń" — trzeba było rozdzielić: co zostaje z polskimi etykietami (bo działa), co znika
za flagą dev (bo to diagnostyka), i co dostaje właściwą nazwę modułu.

**Co z tego wynika:** nowa flaga `VITE_DEV_DIAGNOSTICS` (domyślnie OFF, wzorzec 2-warstwowy localStorage+env,
`src/utils/canvasDevDiagnosticsFlag.ts`) chowa MD properties + badge Możliwość/notatkę + ResearchSession id +
cały ledger współpracy workflow (Reviewer/Send to review/Mark approved — sam w sobie DALEJ nieprzetłumaczony,
odłożone jako osobny dyżur, bo widoczny tylko za tą samą flagą). Grupa menu przemianowana z „Diagnostyka i
workflow" na „Przepływy pracy" — zostaje tylko realny selektor + „Uruchom przepływ", oba z i18n. Etykiety
Document/Table Studio poprawione w obu plikach translation.json na nazwy z `sidebar.documentStudio`/`sidebar.tabele`.
Rodzina (`capabilityNote`/`renderCapabilityBadge`) zmierzona greppem — istnieje TYLKO w tym jednym pliku,
zero innych kebabów dotkniętych. Test `WorkCanvasDocumentPanel.test.tsx` (3184 linii, cała suita diagnostyki)
ustawia flagę ON w `beforeEach`, więc nic nowego nie zepsuł — baseline miał już 10/38 czerwonych testów
(niepowiązana usterka `switchView`/„Markdown view" sprzed tej zmiany, zmierzone przez `git stash` przed/po).

### Z-48 · Pierwszy ekran polskiego produktu był po angielsku — nie brak tłumaczenia, tylko brak KLUCZA w JSON
**Co się stało:** zmierzono zrzut z żywego stagingu (`evidence/staging-20260902/01-logowanie.png`,
gałąź `github-backup/koord/polaczenie-20260902`) — ekran logowania w 100% po angielsku, dwa
odnośniki nawigacyjne („Forgot password?", „Create one") crimson. Pomiar RODZINY (nie jednego
ekranu) objął 6 pozycji: logowanie, rejestracja, kod organizacji/zaproszenie, odzyskiwanie hasła,
zmiana hasła z linku, weryfikacja e-mail. Wynik zaskoczył: logowanie/rejestracja/kod organizacji
JUŻ używały `t()` z realnymi kluczami PL w `translation.json` — bug tam był w DOMYŚLNYM JĘZYKU
(fallback `en`, brak polskiego przełącznika na tych ekranach) i w dwóch linkach twardo pomalowanych
tokenem marki `c-accent` (= crimson `#85182F`, kanon: „TYLKO marka/nic-UI"). Ale odzyskiwanie hasła
i zmiana hasła z linku miały GORSZY defekt: wołały `t('auth.forgotPassword.title', ...)` itp., a
KLUCZE TE NIE ISTNIAŁY W ŻADNYM z dwóch plików JSON (ani en, ani pl) — więc renderowały się
WYŁĄCZNIE angielskim fallbackiem zaszytym w kodzie, dla KAŻDEGO języka, zawsze. Do tego doszła
kolizja nazw: `auth.forgotPassword` już istniał jako STRING („Zapomniałeś hasła?" — etykieta linku
na ekranie logowania), więc `auth.forgotPassword.title` nie mógł w ogóle zadziałać strukturalnie
(string nie ma dzieci w JSON) — nawet gdyby ktoś dopisał klucz pod starą nazwą, nadal by nie
zadziałało. Pełny przegląd pliku `AuthView.tsx` (1439 linii) ujawnił kaskadę: 43 klucze `t()` bez
wpisu w JSON (błędy logowania, MFA, PIN szybkiego dostępu, panel zaproszenia, zgoda prawna) + kolejne
~15 stringów bez ŻADNEGO wywołania `t()` (ekran „Access Pending", panel „Code accepted", etykiety roli
zaproszenia) — bo dwie funkcje pomocnicze (`mapPublicAuthError`, `formatInviteRoleLabel`) żyły POZA
komponentem i nie miały dostępu do `t`.

**Dlaczego ważne:** to nowy wariant znanego kształtu „klucz istnieje ≠ przetłumaczony" — tu klucz w
KODZIE istniał, ale nie istniał w SŁOWNIKU, więc nie był wołaczem-bez-implementacji, tylko implementacją-
bez-danych. `grep` po `t('klucz'` w kodzie nic by nie wykrył jako defekt — trzeba było przeciąć kod
przez oba pliki JSON i policzyć różnicę zbiorów (117 realnych kluczy w rodzinie, 76 brakujących w co
najmniej jednym języku). Dodatkowo: `fallbackLng.default` w `src/i18n.ts` był `['en']` — ostateczny
bezpiecznik dla NIEWYKRYTEGO języka (brak `navigator`, nietrafiony kod) lądował po angielsku na
polskim produkcie zero-switcherowym (żaden ekran przed-logowaniem nie ma przełącznika języka).

**Co z tego wynika:** (a) `fallbackLng.default` → `['pl']`, `index.html lang="pl"` — kolejność
`detection.order` (localStorage → navigator → htmlTag) NIETKNIĘTA, więc jawny wybór albo realny
język przeglądarki nadal wygrywa, zmienia się tylko ostatnia deska ratunku; (b) 76 brakujących kluczy
dopisanych do OBU plików z prawdziwym polskim tekstem (nie kopią angielskiego); (c) kolizja
`auth.forgotPassword` rozwiązana przez nową przestrzeń `auth.forgotPasswordPage.*`; (d)
`mapPublicAuthError`/`formatInviteRoleLabel` przyjmują teraz `t` jako parametr; (e) `c-accent`
zamieniony na `c-focus-solid` (niebieski) na WSZYSTKICH odnośnikach/CTA rodziny (nie tylko dwóch
zgłoszonych) — zostawiony tylko tam, gdzie kanon go dopuszcza (dekoracja: tło-gradient, ikona,
spinner — nieinteraktywne, zgodne z „TYLKO marka/nic-UI"); (f) `VerifyEmail.tsx` — osobne ODKRYCIE:
komponent kompletny tekstowo i już bez crimson, ale MARTWY (zero importów, brak trasy w
`AppRoutes.tsx`) — zmierzony i zaraportowany, nie naprawiany dalej (nie ma czego naprawiać na
nieosiągalnym ekranie); (g) reguła na przyszłość: audyt i18n ekranu nie kończy się na `grep t(` w
kodzie — musi przeciąć wynik przez oba pliki `translation.json`, inaczej „klucz jest" i „tekst się
pokazuje" to dwa różne twierdzenia.

### Z-47 · Poprawka dokumentu, który jest ŁADOWANY, jest skuteczna dopiero w miejscu ładowania
**Co sie stalo:** skill `consultify-preview` poprawiono 01.09 (dyzur 175) — kolejnosc blokow stopki
doprowadzona do zgodnosci z norma. Dzis robotnik naprawiajacy podglad Idei zameldowal, ze skill NADAL
mowi co innego niz norma. Sprawdzilem: poprawka lezy na galezi `codex/m03-admin-20260824`, a sesje
agentow laduja skille z KATALOGU GLOWNEGO repozytorium
(`/Users/piotrwisniewski/Developer/Consultify/.claude/skills/`), stojacego na innej galezi — gdzie
lezy wersja sprzed poprawki. Poprawka nie dziala od doby i nikt tego nie zauwazyl.

**Dlaczego wazne:** to trzeci raz, gdy ten sam skill wysyla wykonawce w zla strone, i pierwszy, gdy
znamy przyczyne: naprawialismy KOPIE. Dodatkowo moj wlasny wycinek katalogow roboczych nie zawieral
`.claude/`, wiec robotnik nie mogl nawet siegnac po wersje z galezi — dostawal wylacznie te
nieaktualna. Dwa niezalezne bledy zlozyly sie na jeden skutek.

**Co z tego wynika:** (a) katalogi robocze dostaja `.claude` i `docs/ui-standards` w wycinku —
poprawione w `scripts/dev/grafika-worktree.sh`; (b) sprawa wpisana do `KOORDYNACJA.md` jako decyzja
dla obu torow: albo katalog glowny dostaje poprawke osobnym commitem, albo skille przestaja zyc
w dwoch miejscach; (c) regula ogolna: **zanim uznasz dokument-instrukcje za poprawiony, sprawdz,
z ktorego miejsca narzedzie go czyta.**

### Z-46 · Uczciwy kadr natychmiast odslania defekty, ktore rysunek ukrywal — i to jest cena, ktora warto placic
**Co sie stalo:** szesc ekranow harnessu przerobiono tak, zeby montowaly realny produkt zamiast
wlasnej kompozycji. W tej samej godzinie wyszly TRZY defekty produktu, ktorych wczesniej nie bylo
widac, bo obrazek byl przerysowany: menu trzech kropek kanwy miesza jezyki w jednym menu (naglowki
grup po polsku, pozycje w srodku po angielsku, a w jednej grupie angielskie „VERSIONING" nad polskim
„Historia wersji"); podglad OKR pokazuje surowe wartosci techniczne (`quarterly`, `zero_to_one`,
`equal_average`, `OPEN_ORG`); ekran `results-vnext-okr-admin` renderowal WYLACZNIE komunikat
„jeszcze nie wlaczone" — wlasciciel ocenil kadr, w ktorym nie bylo czego oceniac.

**Dlaczego wazne:** przez miesiac te karty mialy ocene A i akcept wlasciciela. Ocena byla prawdziwa —
tylko dotyczyla rysunku. Liczba kart z ocena A/B stojacych na nieprawdziwym obrazie nie byla miara
dlugu graficznego, tylko miara tego, ILE JESZCZE NIE WIEMY.

**Co z tego wynika:** naprawa przyrzadu ZWIEKSZA liczbe znanych defektow i to jest sygnal zdrowia,
nie porazki. Nie meldowac „naprawilismy 6 ekranow" bez dopisania, ile defektow to odslonilo.
I nie pokazywac wlascicielowi swiezo uczciwego kadru, zanim sie go nie obejrzy — bo pierwszy uczciwy
obraz bywa gorszy niz ostatni nieuczciwy.

### Z-45 · Popelnilem dokladnie ten blad, ktory godzine wczesniej wytknalem bramce
**Co sie stalo:** rano zmierzylem, ze 12 ekranow pokazuje komponenty, ktorych nic w produkcie nie
renderuje, i zglosilem je do toru funkcji jako dlug „zbudowane, ale niepodlaczone". Szukalem wolaczy
wzorcem `<Nazwa`. Dwa z tych dwunastu — `finance-model-workspace` i `finance-prediction-workspace` —
SA renderowane, tylko przez otoczki `lazy()` wewnatrz `FinanceHub.tsx`. Czyli przegapilem dokladnie
to samo, co godzine wczesniej wytknalem bramce parytetu w osobnym akapicie tego samego dokumentu.

**Dlaczego wazne:** zlapal to robotnik naprawiajacy bramke — bo zlecenie kazalo mu **sprawdzic moja
liczbe zamiast przyjac ja na wiare**. To trzecia sytuacja w tym programie, gdy jedno zdanie
„zweryfikuj moja liczbe sam" w instrukcji zwrocilo sie natychmiast. Koszt tego zdania: zero.

**Co z tego wynika:** (a) zgloszenia 34 i 35 wykreslone z jawnym sprostowaniem, nie skasowane —
widac, ze byly i dlaczego padly; (b) powstalo narzedzie `scripts/dev/grafika-wolacze.mjs`, ktore
liczy wolaczy razem z otoczkami `lazy()` i **nie przechodzi przez powloke** — dwie wczesniejsze
wersje, pisane przez `grep` w `execSync`, meldowaly „BRAK WOLACZA" nawet dla komponentu recznie
potwierdzonego jako renderowany, bo cytowanie w `zsh` zjadalo wzorce; (c) zasada: **narzedzie
pomiarowe napisane w pospiechu klamie tak samo jak to, ktore krytykujesz** — kontrola dodatnia
(pokaz, ze wykrywa rzecz, o ktorej wiesz, ze istnieje) jest obowiazkowa takze dla wlasnych skryptow.


### Z-44 · Dwa źródła prawdy o kolorze mówiły co innego — i wykonawcy słuchali tego bliższego
**Co się stało:** przy naprawie rodziny „crimson na treści neutralnej" robotnik zgłosił
sprzeczność, której nikt wcześniej nie nazwał: `tailwind.config.js` (~linia 150) opisywał
`c-accent` jako kolor „brand/CTA/**selected**", a `CLAUDE.md` reguła UI 3 mówi wprost
„CTA/stany aktywne = **neutralne**; fokus = niebieski `c-focus`". Wykonawca piszący kod
czyta komentarz w konfiguracji, bo jest **pięć linijek od miejsca pracy** — a nie plik
reguł programu.

**Dlaczego ważne:** to nie jest literówka w dokumencie. To wyjaśnia, dlaczego ta rodzina
w ogóle powstała i dlaczego odrastała: pomiar wykazał **639 miejsc** z czerwonym banerem
w 431 plikach oraz **37 własnych map wagi**, przy czym poprawna wspólna mapa
(`src/constants/statusColors.ts`, `PRIORITY_STYLES`) ma tylko **4 konsumentów**. Każdy,
kto pisał własną mapę, miał pod ręką komentarz mówiący, że crimson to kolor zaznaczenia.

**Co z tego wynika:** rozstrzygnąłem sam (reguła 0) — wiąże `CLAUDE.md`, komentarz
poprawiony i opatrzony datą sprostowania; dotknięcie pliku spoza zakresu grafiki wpisane
do `KOORDYNACJA.md`. Reguła ogólna: **gdy dwa źródła prawdy mówią co innego, wygrywa to,
które leży bliżej klawiatury** — więc sprzeczność trzeba usuwać u tego bliższego, nie
dopisywać kolejnego akapitu do dalszego.

### Z-43 · Bezpiecznik parytetu oskarżał uczciwe ekrany — 6 z 25 zgłoszeń to był błąd przyrządu
**Co się stało:** audyt z 01.09 mówił, że **29 kart A/B** stoi na obrazie niebędącym
produktem. Zanim to zameldowałem dalej, przepuściłem listę przez kontrolę dodatnią
(policzyć wołaczy ręcznie, nie wierzyć bramce). Z 25 dzisiejszych zgłoszeń **sześć okazało
się fałszywym alarmem**: `finance-hub` (harness owija prawdziwy `FinanceHub` we własną
otoczkę `React.lazy`, a bramka nie umie rozwinąć `React.lazy(() => import(...))`) oraz
pięć ekranów `idea-table-tool-*` (`PlatformGridView` **jest** renderowany —
w `ViewRouter.tsx:1547`, czyli w tym samym pliku, w którym jest zdefiniowany, a bramka
wyklucza plik definicji z listy wołaczy). Realna liczba: **19, nie 29**.

**Dlaczego ważne:** to jest ta sama choroba, którą bezpiecznik miał leczyć, tylko odbita
w drugą stronę. Narzędzie, które karze uczciwe ekrany, uczy patrzącego ignorować jego
ostrzeżenia — a wtedy przepuści też te prawdziwe. Nie zamelduj liczby, dopóki nie
sprawdzisz, czy przyrząd nie zawyża: raport bramki NIE jest pomiarem, jest hipotezą.

**Co z tego wynika:** naprawa bramki zlecona z **warunkiem odbioru złożonym z dwóch
kontroli** — dodatniej (te 6 ma zniknąć z R1) i ujemnej (7 nazwanych realnych rozbieżności
ma NADAL być zgłaszanych; jeśli któraś zniknie, reguła została rozluźniona za bardzo)
plus dowód mutacyjny. Naprawa, która ucisza bramkę, jest gorsza niż fałszywy alarm.

### Z-42 · „Reszta odbioru" to nie były karty nieklikniete — właściciel przekliknął WSZYSTKO
**Co się stało:** dostałem zadanie „zmierz, co zostało właścicielowi do przeklikania".
Spodziewałem się luki w pokryciu. Pomiar z żywej bazy: kart A/B **253**, kart **bez żadnej
decyzji — ZERO**. Właściciel nie ma zaległości. Zaległość jest po naszej stronie: 3 karty
czekają na naprawę, o którą prosił, a 19 stało na obrazie, który nie pokazywał produktu.

**Dlaczego ważne:** gdybym poszedł za intuicją („zostało trochę do klikania") i wystawił
mu stronę z 253 kartami, utopiłby się w rzeczach, które już rozstrzygnął — i to on
zapłaciłby czasem za mój brak pomiaru. Druga rzecz: sprawdziłem chronologię i okazało się,
że 15 ekranów z partii do zatwierdzenia z 01.09 **też jest zamkniętych** — partia została
zapisana o 11:40, a jego decyzje padły 11:50–12:06, czyli PO niej. Bez porównania dwóch
znaczników czasu wystawiłbym mu je drugi raz.

**Co z tego wynika:** strona odbioru otwiera się teraz na filtrze „★ Zostało do obejrzenia"
(9 kart do oceny) i osobno pokazuje 13 kart „Czeka na budowę" — **bez przycisków oceny**,
bo ich gotowość nie zależy od wyglądu. Licznik przy nazwie modułu liczy widoczne, nie pełne
(„Czat 5 z 15") — wcześniej nagłówek mówiłby 15 nad pięcioma kartami i właściciel liczyłby
rozbieżność zamiast oglądać ekrany. Zasada: **zanim pokażesz komuś listę „co zostało",
zmierz, czy ta lista w ogóle o tym mówi.**

### Z-41 · Dzień naprawy przyrządu i wymiany z torem funkcji — bezpiecznik kłamał w obie strony, a zgłoszenie punktowe znów okazało się próbką
**Co się stało:** (1) **Dług przyrządu spłacony o ponad ćwierć** — linia bazowa **152 → 112**
pozycji: wymyślona szerokość **30 → 15** ekranów, podpis przyrządu w kadrze **33 → 24**, komponent
bez wołacza **51 → 41**. Rejestr: **313** ekranów, **253** do pokazania właścicielowi, **60**
świadomie odłożonych. (2) **Trzy zgłoszenia właściciela domknięte:** podgląd w tabeli pomysłów
(zgłaszany **trzy razy**, przyczyną był pasek dokładany przez harness, nie produkt — podgląd
wrócił z 340 na 403 px); usuwanie założeń w Finansach (przycisk istniał, ale leżał **poza prawą
krawędzią** — teraz kebab w wierszu, tabela zeszła z 1550 do 1440 px); szerokość kolejki
w administracji. (3) **Bramka parytetu kłamała w obie strony.** Przyczyna okazała się inna niż
hipoteza nadzorcy: nie komentarze w kodzie, tylko adres-wzorzec `/settings/*` w łańcuchu znaków,
czytany jako początek komentarza, zjadający ~600 linii pliku tras. Siedem pozycji długu było
duchami. Dowód mutacyjny: przed `false`, po `true`. (4) **Wymiana z torem funkcji.** Przejęliśmy
trzy ich bezpieczniki; jeden od razu znalazł u nas **zdublowany klucz ekranu** (jeden ekran cicho
nadpisywał drugi — ślad scalania metodą „zachowaj obie strony"). Oddaliśmy im nasz katalog
sposobów, w jakie kłamie stanowisko. Ich narzędzie przy pierwszym uruchomieniu dało **7 fałszywych
alarmów na 7** i sami to zgłosili, zanim się przejechaliśmy. (5) **Ekran z oceną A okazał się
cicho zepsuty.** Audyty, zakładka „Sesje": front pyta o `concludedCriteria`, serwer odsyła
`criteriaConcluded` → kolumna „Postęp" pokazuje literalny ukośnik. Właściciel dał A, oglądając
**wyłącznie drugą zakładkę** — feralnej nigdy nie sfotografowano. (6) **Panele wyceny:** pięć par
przeszło nową kontrolę stanu; starych zrzutów nie było w ogóle, więc właściciel nigdy nie oceniał
ich na obrazie pokazującym pustkę. Zastrzeżenie: te panele **nie mają wołacza w produkcie**.
(7) **Sprawa spoza toru, zgłoszona właścicielowi:** tor funkcji znalazł sześć dziur w
uprawnieniach, trzy żywe. Pliki tras są na gałęzi, z której wdraża się produkcja, podpięte
bezwarunkowo, trasy istnieją od ponad siedmiu miesięcy. Czego nie wiadomo: czy produkcja jest
wdrożona i czy ma dane realnych klientów — pytanie postawione właścicielowi, bo tylko on może
sprawdzić. Do czasu odpowiedzi praca idzie tak, jakby odpowiedź brzmiała „tak".

**Dlaczego ważne:** cztery z powyższych punktów (3, 4, 5, 6) to JEDEN kształt powtórzony w jeden
dzień, w dwóch torach naraz: zgłoszenie/naprawa objęły punkt, nie rodzinę — bramka parytetu
zbadana tylko na zgłoszonych plikach, zdublowany klucz ekranu obok poprawnie scalonych, jedna
zakładka Audytów sfotografowana a druga nie, panele wyceny nigdy nie miały zrzutu porównawczego.
To nie jest niedbałość wykonawców, tylko wada zleceń. Równolegle: punkty (3) i punkt (a) w
przypadku bramki parytetu oraz test+atrapa na ekranie Audytów pokazują **bezpiecznik kłamiący
w obie strony** — dwie kontrole zgodnie milczące albo zgodnie zielone, bo czerpią z tego samego
skażonego źródła, co wygląda mocniej niż pojedyncza kontrola i dlatego usypia skuteczniej.

**Co z tego wynika:** stąd nowa reguła A (nr 20, rodzina zamiast punktu) i reguła B (nr 21, dwa
bezpieczniki z jednego źródła) w `00_ZASADY_PRACY.md`. Nowa praktyka: przy ekranach z zakładkami
fotografować KAŻDĄ osobno, nie tylko tę, którą ktoś akurat otworzył. Pytanie o produkcję i dane
realnych klientów zostaje priorytetem nr 1, otwarte, dopóki właściciel nie odpowie.

---

### Z-40 · Moja hipoteza „surowy klucz na ekranie" — OBALONA pomiarem, 0 przypadków
**Co się stało:** nadzorca zauważył, że polski słownik ma ~2073 klucze więcej niż angielski,
i sprawdził `src/i18n.ts:81-88`: łańcuch fallbacku to `en: ['en']` — angielski **nie ma** fallbacku
na polski. Z tego wyprowadził hipotezę: klient z interfejsem angielskim zobaczy **surowy klucz**
(`reports.toast.reportGenerated`) wprost na ekranie. Hipoteza została zameldowana właścicielowi —
**ostrożnie, jawnie jako niezmierzona** („nie ogłaszam tego jako defektu, bo tego nie zmierzyłem").

**Pomiar ją obalił.** Z 1931 kluczy tylko-w-`pl`, które mają statycznie znalezione wywołanie
`t()`: **zero** bez drugiego argumentu. Repozytorium ma bardzo konsekwentny zwyczaj podawania
tekstu awaryjnego przy każdym `t()`. Scenariusz „surowy klucz na ekranie" nie potwierdził się
**ani razu**.

**Ale pomiar znalazł defekt realny, o innym mechanizmie:** **134 klucze, w których tekst awaryjny
zaszyty w kodzie jest sam po POLSKU.** Skutek dla klienta angielskiego jest ten sam co
w hipotezie — widzi polski tekst — ale przyczyna zupełnie inna, więc i naprawa inna.
Skupiska: `excele` (37), `partner` (25), `billing` (23, głównie `SubscriptionAnalytics.tsx`),
`rap` (19), `documentStudio` (15).

**Weryfikacja nadzorcy (własnym greppem, nie z raportu) dała dodatkowy wniosek:** klucze
`organization.readiness.*` (`'Kompletność'`, `'Spójność'`, `'Pięć wymiarów gotowości'`,
`'Nie można potwierdzić gotowości'`) **nie istnieją ANI w `pl`, ANI w `en`**. Ten ekran
**działa po polsku wyłącznie dzięki tekstom awaryjnym w kodzie**, nie dzięki słownikowi.
Dla polskiego klienta wychodzi to przypadkiem dobrze; dla angielskiego jest defektem; a każdy,
kto „posprząta" te teksty awaryjne, wyłączy polski na tym ekranie, nie wiedząc o tym.

**Dlaczego ważne:** to trzeci raz tego popołudnia, gdy liczba albo teza nadzorcy nie przeżyła
pomiaru (Z-38 opisuje trzy pierwsze). Tym razem zadziałało zabezpieczenie **po stronie języka
meldunku**: teza poszła do właściciela z jawną etykietą „niezmierzone", więc jej obalenie nie
wymagało odwoływania niczego, co zostało powiedziane jako fakt. **Różnica między
„to jest defekt" a „to może być defekt, mierzę" kosztuje jedno zdanie i ratuje wiarygodność.**

**Co z tego wynika:** (a) hipotezę o mechanizmie zawsze meldować jako hipotezę, z jawnym
„czego jeszcze nie wiem"; (b) **defekt bywa realny mimo błędnej hipotezy** — nie odrzucać
zgłoszenia razem z obaloną przyczyną, tylko szukać dalej; (c) osobno do rejestru: **tekst
awaryjny w kodzie bywa jedynym źródłem polskiego napisu** — to kruche i niewidoczne dla każdego
audytu liczącego klucze w słowniku (kolejny wariant znanego kształtu „klucz istnieje ≠ przetłumaczony",
tym razem odwrócony: *tekst działa, chociaż klucza nie ma wcale*).

**Ocena pilności (za raportem, przyjęta przez nadzorcę):** nie pilne. Scenariusz krytyczny
niepotwierdzony; 134 polskie teksty awaryjne to sprawa średniego priorytetu, dotycząca wyłącznie
klienta anglojęzycznego. Najpierw `SubscriptionAnalytics.tsx` i `DocumentStudio*`.

**Granice pomiaru podane przez robotnika samodzielnie:** 263 wywołania `t(zmienna)` i 448 wywołań
z w pełni dynamicznym przedrostkiem — statycznie nierozstrzygalne; 187 kluczy osiągalnych tylko
przez dynamiczne przedrostki; 286 kluczy bez znalezionego wołacza; kompletność form mnogich
(`_few`/`_many`) niesprawdzona. Robotnik zgłosił też, że **znalazł i naprawił błąd we własnym
skrypcie w trakcie pracy** (zła grupa w wyrażeniu regularnym zjadała 9 linii), i zweryfikował
poprawione liczby wobec źródła przed ich podaniem.

---

### Z-38 · Trzy pomiary zasięgu obaliły trzy moje własne liczby tego samego popołudnia
**Co się stało:** nowy nadzorca zlecił trzy równoległe pomiary zasięgu rodzin defektów (crimson,
kontrast motywów, język), do każdego dołączając WŁASNĄ liczbę wstępną jako punkt odniesienia.
**Dwie z trzech okazały się nieprawdziwe, a trzecia opierała się na nieaktualnym dokumencie.**

1. **Filtr zaniżył pomiar dwukrotnie.** Do policzenia tekstu bez wariantu drugiego motywu użyłem
   `grep ... | grep -v 'dark:'`. Filtr odrzuca CAŁĄ linię, w której gdziekolwiek pada `dark:` —
   także wtedy, gdy `dark:` dotyczy innej właściwości niż kolor tekstu. Zmierzone: ta sama komenda
   bez filtru daje **449** linii, z moim filtrem **221**. Podałem robotnikowi 221 z komentarzem
   „na pewno zawyżona". Była **zaniżona ponad dwukrotnie**.
2. **Podałem błędny zakres katalogów — trzy z czterech znanych defektów leżały poza nim.**
   Zleciłem pomiar w `src/components/settings` i `src/components/admin`. `SettingsCard.tsx`,
   `SettingsToggle.tsx` i `AuditLogViewer.tsx` leżą w `src/components/AISettings/` — katalogu,
   którego nie wymieniłem. Robotnik dodał go z własnej inicjatywy; gdyby wykonał zlecenie
   dosłownie, pomiar nie zobaczyłby **trzech z czterech** przypadków, od których się zaczął.
3. **Przepisałem nieaktualny fakt zamiast go zmierzyć.** W zleceniu podałem jako „potwierdzony
   przykład": ~15 kluczy `toolOutputs.*` nie istnieje ani w `pl`, ani w `en`. Robotnik sprawdził
   `git log`: **defekt był już naprawiony wcześniejszym commitem na tej gałęzi**. Wziąłem to
   z karty ekranu w `status.json` i podałem dalej jako pomiar. To dokładnie Złota Reguła 1
   z `CLAUDE.md` — którą sam zacytowałem w dokumencie napisanym pół godziny wcześniej.

**Dlaczego ważne:** wszystkie trzy błędy przeszłyby niezauważone, gdyby robotnicy przyjęli moje
liczby na wiarę. Złapali je, bo **w każdym zleceniu było zdanie „zweryfikuj tę liczbę sam
i podaj SWOJĄ; jeśli się różni, powiedz o ile i dlaczego"**. To jedno zdanie kosztuje nic
i zadziałało trzy razy z trzech. Bez niego nadzorca jest pojedynczym punktem awarii pomiaru —
a jego liczby, raz wypowiedziane, wracają jako „zweryfikowany fakt" (znany kształt: *hipoteza
nadzorcy staje się faktem*).

**Co z tego wynika:** (a) **zdanie o samodzielnej weryfikacji liczby jest odtąd obowiązkowe
w każdym zleceniu pomiarowym**; (b) zakres katalogów w zleceniu podawać JAKO HIPOTEZĘ —
z jawnym poleceniem „jeśli znany przypadek leży poza tym zakresem, rozszerz go i powiedz o tym";
(c) każdy fakt przepisany z `status.json` do zlecenia oznaczać jako **niezmierzony** — karty
ekranów starzeją się szybciej niż kod, który opisują.

---

### Z-39 · `admin` i `Admin` to na tym Macu ten sam katalog — każdy pomiar po obu liczy podwójnie
**Co się stało:** przy pomiarze zasięgu kontrastu robotnik zauważył 54 „duplikaty" wystąpień
i sprawdził przyczynę: `src/components/admin` i `src/components/Admin` mają **identyczny numer
inode** (`462360537` — zweryfikowane niezależnie przez nadzorcę komendą `ls -di`). System plików
macOS jest domyślnie nieczuły na wielkość liter, więc to jeden fizyczny katalog pod dwiema nazwami.

**Dlaczego ważne:** to **nowy, wcześniej nieopisany sposób kłamstwa przyrządu** — i kłamie
w stronę zawyżenia. Każde polecenie wymieniające obie nazwy (a w tym repozytorium oba zapisy
występują w importach) liczy te same pliki dwa razy. Pomiar „ile jest defektów" wychodzi
zawyżony o rozmiar katalogu, i to w sposób niewidoczny — wyniki wyglądają na poprawne, bo
ścieżki się różnią. Zagrożone jest każde wcześniejsze zliczanie po `src/components/`, jeśli
w jego zakresie były obie pisownie.

**Co z tego wynika:** przed każdym zliczaniem po ścieżkach — `ls -di` na katalogach o podobnej
nazwie. Osobno: sam fakt, że repozytorium ma importy pod dwiema pisowniami tej samej ścieżki,
jest długiem, który wywróci się na pierwszym systemie plików czułym na wielkość liter (Linux —
czyli każdy serwer wdrożeniowy). **Zgłoszone do toru funkcji jako sprawa osobna od grafiki.**

---

### Z-37 · Sesja zamknięta — runda odebrana, cztery bezpieczniki, najdroższa lekcja dnia to sam przyrząd
**Co się stało:** runda odbioru 31.08–01.09 zamknięta liczbowo: **255 ekranów przyjętych, 3 do
poprawki (wszystkie domknięte tego samego dnia), 2 odrzucone** — z 313 ekranów w rejestrze.
W ciągu dwóch dni powstały cztery bezpieczniki, każdy jako odpowiedź na konkretną, już zaistniałą
szkodę, nie na zapas: `scripts/dev/odbior-kontrola.mjs` (kontrola kart przed oddaniem — po Z-24,
dwunastu kłamstwach przyrządu jednego dnia), `scripts/dev/stanowisko.mjs` (zarządzanie
stanowiskiem — po trzech ręcznych podnoszeniach, które zatrzymały pracę właściciela), uszczelniona
bramka crimsona (po Z-23 — kolor stanu krytycznego istniał pod czterema nazwami, bezpiecznik znał
jedną, piętnaście z piętnastu próbek okazało się dekoracją) i `scripts/check-dev-render-parytet.mjs`
(parytet harness-produkt — dyżur 177, dziś napisany, jeszcze niezacommitowany).

**Dlaczego ważne:** najdroższa lekcja dnia okazała się dotyczyć samego przyrządu, nie produktu.
Właściciel **trzy razy** zgłaszał ten sam defekt podglądu; **dwie naprawy poszły w produkt, który
już był zgodny z kanonem** — bo przyczyną był ekran testowy harnessu, dokładający panel, którego
aplikacja w ogóle nie ma. Dopiero systemowy audyt (`AUDYT_PRZYRZADU_20260901.md`, 240/240 plików
zmierzonych mechanicznie) pokazał skalę: **41 ekranów** harnessu rozjeżdża się z produkcją,
z czego **29 ma dziś ocenę A lub B** — czyli są dziś pokazywane właścicielowi jako gotowe, choć
mogą pokazywać nieprawdę. Dwa razy tego dnia nadzorca zatrzymał własnych robotników, zanim szkoda
dotarła do właściciela: raz gdy reguła językowa właściciela została rozciągnięta o krok za daleko
i działające polskie nazwy zamieniono na angielskie (Z-34), raz przy commicie, który ratował cudzą
pracę, ale po drodze zabrał jej własny komunikat (Z-17).

**Co z tego wynika:** meldunek dla następcy i dla właściciela ma mówić o pracy konsultanta, nie
o komponentach — właściciel powiedział dziś wprost „nie wiem, o czym mówisz", gdy nadzorca użył
żargonu, i to jest twarda granica języka raportu, nie jednorazowa uwaga. Priorytet #1 na jutro
zostaje niezmieniony od zapisu w §3 `PRZEKAZANIE_20260901.md`: zacommitować
`check-dev-render-parytet.mjs`, ustalić linię bazową, przejść 29 zagrożonych kart pojedynczo —
bo żaden z pozostałych trzech bezpieczników nie łapie kłamstwa, które sam przyrząd opowiada
o sobie.

---

### Z-36 · Skill kanonu podglądu rozjechał się z normą — poprawiona norma, nieaktualny skill wysyłał w złą stronę
**Co się stało:** norma `TABLE_AND_PREVIEW_CANON.md` §7.0/§7.3 podaje kolejność stopki preview
**AI → Relations → Akcje → „Co dalej"** (poprawione już 02.08.2026 po weryfikacji w kodzie), a realny
`src/components/standard/StandardPreview.tsx` renderuje `whatsNext` bezwarunkowo PO `actionRows` —
oba źródła zgodne. Ale `.claude/skills/consultify-preview/SKILL.md` — dokument, do którego kanon
sam odsyła każdego wykonawcę na wstępie pracy — wciąż numerował „Co dalej" jako blok 4 i „Akcje"
jako blok 5, czyli **kolejność odwrotną**: dokładnie ten błąd, który norma opisuje jako już raz
naprawiony (i cytuje jako historyczną wpadkę `IdeasTableContent.tsx`, który w międzyczasie sam
został poprawiony na zgodny z normą). Znalezisko z dyżuru 175, zweryfikowane, zanim cokolwiek
ruszono: dosłowne brzmienie normy, dosłowne brzmienie skilla, dosłowna kolejność w kodzie —
trzy źródła sprawdzone osobno, nie jedno przyjęte na wiarę.

**Dlaczego ważne:** to trzecie zgłoszenie tej samej rzeczy przez właściciela. Wykonawca, który
zaczyna pracę nad preview, czyta skill jako punkt wejścia (kanon go do tego kieruje wprost) —
skill z odwróconą kolejnością każe mu „naprawić" ekran zgodny z normą, czyli **zepsuć zgodny
ekran, żeby dopasować go do nieaktualnego opisu**. To ta sama rodzina co „Naprawa per wywołanie
odrasta" (patrz `naprawa-per-wywolanie-odrasta` w pamięci nadzorcy): jedno źródło prawdy zostało
poprawione (norma, 02.08), drugie (skill) zostało nieaktualne i przez miesiąc wysyłało w złą
stronę, bo poprawka normy nigdy nie popłynęła do skilla, który ją cytuje jako rozstrzygniętą.

**Co zrobiono:** `SKILL.md` przepisany zgodnie z normą i kodem — sześć bloków TRIADY (Nagłówek ·
Meta · Details · AI · Relations · Akcje), „Co dalej" jawnie POZA numeracją i ZAWSZE po Akcjach,
z jawną adnotacją o poprawce (wzorem adnotacji „ZASTĄPIONE" z Z-35), żeby stara treść zostawała
widoczna w historii, nie znikała bez śladu. Sprawdzono grepem po realnych ekranach preview
(`IdeasTableContent.tsx`, `MyIdeasListContent.tsx`, `InterviewInsightPreview.tsx`,
`CasesListScreen.tsx`, `AssessmentHub.tsx`) — **żaden nie ma odwróconej kolejności w produkcji**;
`InterviewInsightPreview.tsx` renderuje AI → „Co dalej" bez osobnego bloku Akcji, ale to legalne
pominięcie bloku bez treści (anty-duplikacja §7.3 pkt 4.4), nie odwrócona kolejność.

**Co z tego wynika:** dokument, który normę tylko CYTUJE (skrót/wejście), starzeje się osobno od
dokumentu, który normę USTALA — potrzebuje własnej daty poprawki i przeglądu przy każdej zmianie
normy źródłowej, inaczej rozjazd wraca za każdym razem, gdy ktoś poprawi jedno miejsce i uzna
sprawę za zamkniętą.

---

### Z-35 · Runda 01.09 zamknięta decyzjami — jedna Teresa w swoim oknie, cztery odrzucone ekrany rozstrzygnięte pojedynczo
**Co się stało:** trzy decyzje zamykające rundę trafiły do `KANON_Z_ODBIOROW.md` — tu tylko kontekst,
który ginie razem z commitem. (1) Panele artefaktów przestają kleić własny czat z Teresą — **jedna
Teresa mieszka w jednym oknie**, panel dostaje wyłącznie wejście do niej. Zasada dla WSZYSTKICH
przyszłych artefaktów, nie punktowa poprawka: zinwentaryzowano pięć miejsc osadzenia w produkcji,
z czego **dwa żywe bez flagi**; `ArtifactRightRail`/`artifactRightRailFlag.ts` dostały adnotację
„ZASTĄPIONE 2026-09-01" przy cytacie z 30.08 („Teresa jako ikona szyny"), żeby stara decyzja
zostawała WIDOCZNA, nie skasowana — nowa po prostu wygrywa. (2) Macierz DRD zaakceptowana —
patrz Z-33. (3) Cztery odrzucone ekrany z rundy 01.09 NIE zostały omówione hurtem — każdy dostał
osobny werdykt w `ANALIZA_ODRZUCONE_20260901.md`: dwa zdjąć z produktu, jeden zostawić i dorobić
wejście, jeden przebudować. Analiza wykazała przy okazji ryzyko: wraz z wycofanym hubem Wyników
mogła zniknąć **działająca karta naprawcza** — nie potwierdzone, w trakcie sprawdzania.

**Dlaczego ważne:** omawianie odrzuconych ekranów pojedynczo, nie hurtem, dało cztery RÓŻNE
werdykty — hurtowa decyzja typu „odrzucone = usunąć" straciłaby ekran wart przebudowy i ekran
wart zostawienia z małą poprawką. To ten sam wzorzec co Z-23/Z-34: zgłoszenie zbiorcze jest
hipotezą o zasięgu, nie gotową instrukcją wykonania.

**Co z tego wynika:** pięć miejsc osadzenia czatu Teresy idzie do osobnej fali sprzątania
(dyżur 167, audyt). Ryzyko utraconej karty naprawczej zostaje OTWARTYM punktem — nie wolno
go czytać jako „sprawdzone, wszystko OK", dopóki nie ma pomiaru.

---

### ★ Z-34 · Nadzorca zatrzymał własnego robotnika — reguła właściciela rozciągnięta o krok za daleko
**Co się stało:** robotnik naprawiający slajd 5 prezentacji poprawnie ustalił, że polskie nazwy osi
już tam były — rejestr opisywał stan SPRZED naprawy z 30.08, bo nikt nie zrobił zrzutu PO. Ale
zamiast na tym poprzestać, **zamienił działające polskie nazwy na angielskie**
(`fix(ocena-prezentacja): slajd 5 — nazwy osi po angielsku`, `2c0e2be8f7`), powołując się na
decyzję właściciela z 31.08: „angielskiego nie trzeba tłumaczyć na polski". Ta decyzja mówiła,
że angielski jest wiodącym językiem METODYKI — nie że polski trzeba na angielski zamieniać.

**Dlaczego ważne:** skutek byłby taki, że slajd 5 miałby „Digital Processes", a slajd 6 (macierz
DRD, zaakceptowana kilkanaście minut wcześniej słowami „tak to jest super" — Z-33) — „Procesy
Cyfrowe". Dwa sąsiadujące slajdy tej samej prezentacji, dwa różne języki, bez żadnej decyzji,
która by to nakazywała.

**Co zrobiono:** nadzorca cofnął zmianę PRZED pokazaniem właścicielowi
(`revert(prezentacja): nazwy osi na slajdzie 5 wracają na polski — spójność ze slajdem 6
zaakceptowanym 01.09`, `2c0a8aeabd`) — więc samego błędu właściciel nigdy nie zobaczył. Dodana
infrastruktura językowa (przekazywanie `'en'` do `groupNameOrId`) została NIETKNIĘTA — zostaje
zapisana pod przyszły raport dla klienta zagranicznego, gdzie faktycznie będzie potrzebna.

**Co z tego wynika:** ★★ **Reguła nr 16** w `00_ZASADY_PRACY.md` — reguła dopuszcza czy nakazuje.
Test: jeśli po naprawie dwa sąsiadujące ekrany zaczynają mówić różnymi językami, różnymi słowami
albo różnym stylem — reguła została rozciągnięta za daleko. Cofnij i zapytaj, zamiast domyślać
się, w którą stronę tekst ma się zmienić.

---

### Z-33 · Macierz DRD zaakceptowana słowami „tak to jest super" — ERP/MES potwierdzone jako zamierzone
**Co się stało:** naprawa opisana w Z-26 (`DRDMatrixGrid` wyeksportowany z edytora do slajdu 6
i rozdziału osi raportu) doczekała się reakcji właściciela: **„tak to jest super"**
(`KANON_Z_ODBIOROW.md`, wpis 2026-09-01, `246bcc2dc6`). Potwierdził też wprost, że powtarzalne
`ERP`/`MES` w wierszach różnych poziomów dojrzałości NIE jest błędem duplikacji — to zamierzona
treść: te systemy obejmują całą firmę i słusznie pojawiają się na wielu poziomach naraz.

**Dlaczego ważne:** decyzja użyć prawdziwej macierzy właściciela (nie `AreaMatrixTable`) zapadła
30.08 (Z-10/Z-12) — wykonanie przyszło dopiero 01.09 (Z-26), po TRZECIM zgłoszeniu tej samej
sprawy, tym razem słowami „nie mam już siły serio!!". Przez te dwa dni raport dalej rysował
komponent, który właściciel sam ODRZUCIŁ 30.08 („Stary, to nie tak ma wyglądać"), mimo że
w kodzie stał komentarz mówiący wprost, żeby świadomej macierzy (`DRDAssessmentEditor.tsx`) NIE
dotykać. To nie była trudność techniczna: komponent istniał, działał, wystarczyło go wyeksportować
— co ostatecznie zajęło jeden dyżur.

**Co z tego wynika:** utrwalone w `KANON_Z_ODBIOROW.md`, żeby ERP/MES nie wróciło jako fałszywe
zgłoszenie duplikatu w kolejnej rundzie. Dwa dni między decyzją a wykonaniem, przy gotowym
komponencie i jawnym komentarzu-zakazie w kodzie, to osobna lekcja: komentarz „NIE dotykaj"
napisany w jednym kontekście może przeżyć swój powód i zacząć blokować dokładnie to, czego
właściciel chce.

---

### Z-32 · Dwie rodziny z uwag 01.09, gdzie pomiar obalił zgłoszenie
**Co się stało:** (a) „Prawy panel niezgodny z kanonem" — zmierzone w Z-27: panel jest zgodny na
wszystkich ekranach, a zgłoszony ekran (`processflow-canvas`) w ogóle go nie używa (własny
`IdeaElementInspector`); właściciel oceniał zrzut zrobiony BEZ kliknięcia w węzeł, więc panelu na
obrazie nie było. Naprawa poszła w mierzalną przyczynę wrażenia „powinny wyglądać tak samo" —
sześć szerokości przy jednym tokenie, ujednolicone do 320 px (Z-28). Pełny pomiar stoi w Z-27/Z-28,
tu dopisane wyłącznie do rodziny uwag rundy 01.09.
(b) „Tabela nie wykorzystuje szerokości" w Finansach — zmierzone: ograniczenie `max-w-3xl` siedziało
w HARNESSIE zrzutów, nie w produkcie. Po zdjęciu ograniczenia tabela urosła z 740 do 1364 px.
Właściciel oglądał zwężenie wprowadzone przez własne narzędzie pomiarowe, nie defekt produktu.

**Dlaczego ważne:** kolejne dwa zmierzone sposoby, w jaki stanowisko/przyrząd kłamie (numeracja
z Z-13/Z-24) — tym razem w obie strony naraz: raz przez brak kliknięcia (pusty ekran wygląda jak
zepsuty), raz przez cudzy limit szerokości wklejony do harnessu, którego produkt nigdy nie miał.

**Co z tego wynika:** (a) zero zmian w komponencie o 61 wołaczach — bez zmian względem Z-27, R2
zostaje w backlogu jako analiza treści, nie kanonu sekcji. (b) `max-w-3xl` do usunięcia z harnessu
zrzutów Finansów; jeśli tabela ma mieć realny limit szerokości w produkcie, to osobna, świadoma
decyzja, nie przypadek przyrządu.

---

### Z-31 · Runda odbioru 01.09 zamknięta liczbowo — 235 przyjętych, 21 do poprawki, 4 odrzucone
**Co się stało:** właściciel przeklikał całość rejestru odbioru: **235 przyjętych, 21 do poprawki,
4 odrzucone** na 256 kart A/B (rejestr liczy 313 ekranów — różnica to ekrany bez własnej karty
odbioru, patrz Z-25). To **92% przyjętych** za jednym przejściem. Dla porównania: przegląd PRZED
odbiorem 30.08 (Z-13) dawał 25 z 55 ekranów NIE nadających się do pokazania — inny etap, inna
skala, ale ten sam kierunek: dziś więcej gotowe niż zepsute.

**Dlaczego ważne:** 21 uwag właściciela wyglądało z zewnątrz jak 21 osobnych zleceń naprawczych.
Pogrupowanie po PRZYCZYNIE w `UWAGI_ODBIOR_20260901.md` pokazało, że to **sześć rodzin**, nie 21:
cztery ekrany Realizacji ze zbędnym paskiem nad tabelą to jedna naprawa, nie cztery; cztery ekrany
z tabelą niewykorzystującą szerokości to jedna naprawa (patrz Z-32); dwa ekrany z czatem Teresy
w panelu to jedna decyzja produktowa (patrz Z-35), nie dwie punktowe naprawy.

**Co z tego wynika:** ten sam wzorzec co Z-23 („naprawa rodzinami: pierwszy pomiar zawsze pokazuje
dolną granicę") — 21 zgłoszonych to górna granica pracy, sześć przyczyn to realny zakres. Zlecenia
naprawcze po tej rundzie idą po RODZINIE, nie po pojedynczej karcie.

---

### Z-30 · Strona odbioru zapisywała nową wersję uwagi przy każdym naciśnięciu klawisza
**Co się stało:** log historii uwag na stronie odbioru zapisywał nową wersję przy KAŻDYM naciśnięciu
klawisza, nie przy zakończeniu pisania. Skutek: **133 wpisy historii na 38 ekranów**; jedna uwaga
właściciela figurowała w **11 kolejnych wersjach**, każda o jeden znak dłuższa niż poprzednia;
rekordzista — **19 wpisów w 63 sekundy**.

**Dlaczego ważne:** stan BIEŻĄCY w tabeli `decyzje` był przez cały czas POPRAWNY — psuł się
wyłącznie log historii, który ma służyć jako ślad decyzji, a stawał się nieczytelny: jedna uwaga
rozbita na kilkanaście fragmentów, trudno odróżnić ostateczną wersję od litery wpisanej w trakcie
pisania. Usterka niewidoczna na bieżącym ekranie odbioru — widać ją dopiero w historii.

**Co zrobiono:** naprawa u źródła, trzy warstwy naraz: (1) opóźnienie zapisu do końca pisania,
(2) zapis wymuszony przy wyjściu z pola i przy zamknięciu karty — żeby nic nie ginęło, gdyby ktoś
zamknął kartę w trakcie pisania, (3) serwerowa siatka bezpieczeństwa scalająca wpis, gdy nowa
uwaga jest przedłużeniem poprzedniej — na wypadek, gdyby zabezpieczenie w przeglądarce zawiodło.

**Co z tego wynika:** przy odsiewaniu istniejących duplikatów w historii obowiązuje zasada — dla
danego ekranu bierze się NAJDŁUŻSZĄ/NAJPÓŹNIEJSZĄ wersję uwagi, bo to ona jest ostatecznym stanem
tego, co właściciel napisał. Trzeci przypadek tego samego wzorca co Z-15 (dopisuj, nie nadpisuj)
i Z-20 (najnowszy wygrywa): przy danych zbiorczych wygrywa to, co NAJPÓŹNIEJSZE/NAJPEŁNIEJSZE,
nie to, co pierwsze w kolejności.

---

### ★ Z-29 · Katalog roboczy stracił 7392 pliki w nocy — worktree przestał widzieć siebie
**Co się stało:** rano harness padł u właściciela na `Failed to resolve import
"../src/store/useAppStore"`. Przyczyna: z katalogu `/private/tmp/m03` zniknęło **7392 pliki kodu**
(`server/` 3194, `tests/` 1849, `src/` 1439, `scripts/` 240) razem z plikiem wiążącym katalog
z repozytorium — git przestał widzieć worktree i oznaczył go jako do usunięcia.

**Dlaczego ważne:** to ósmy incydent współdzielonego katalogu tego dnia (poprzednie: Z-16, Z-17,
Z-18 i wcześniejsze — wyścig indeksu, `git stash`) i **pierwszy, który realnie zatrzymał pracę
właściciela**, nie tylko robotnika. Poprzednie incydenty gubiły najwyżej pojedynczy commit albo
kilka plików zastagowanych; ten zabrał prawie 4% całego drzewa roboczego naraz.

**Co NIE ucierpiało:** **nic nie zginęło z repozytorium** — 153 commity z 31.08 nienaruszone,
pliki przywrócono z HEAD, powiązanie worktree odtworzono, harness uruchomiono od zera. **Zero
ubytków w `evidence/`, `docs/` i `dev-render/`** — dowody odbioru i sama strona odbioru działały
nieprzerwanie przez cały incydent; strata dotknęła wyłącznie drzewa kodu źródłowego, nie warstwy
dowodowej.

**Co z tego wynika:** ta sama rodzina co reguła nr 14 (wyścig indeksu git), ale inny mechanizm —
tam ginęły STAGED zmiany jednego robotnika, tu zniknęła CAŁA kopia robocza wielu naraz. Mechanizm
przywracania (odtworzenie z HEAD + ponowne powiązanie worktree) działa i jest szybki, ale nie
zapobiega — do toru funkcji: mechaniczna kontrola integralności worktree przed startem dnia
(liczba plików vs. `git ls-tree` HEAD), żeby wykryć ubytek ZANIM harness padnie właścicielowi
na oczach.

---

### Z-28 · Jeden token, cztery szerokości — prawy pas ujednolicony do 320 px
**Co się stało:** zgłoszenie właściciela („prawe panele powinny wyglądać tak samo",
przy Excelu „usunąć więcej niepotrzebnego panelu") miało przyczynę zmierzoną w Z-27:
prawy pas renderował się w **czterech** szerokościach mimo jednego wspólnego tokenu
`--ntype-right-panel-width: 320px`. Przemiecenie `src/components/**` i `src/views/**`
znalazło **szóstą** wartość, której pierwszy pomiar nie widział (`AssessmentToolShell`
= 340 px). Źródła: `ExecutiveModuleShell` (300 dla powłoki artefaktu, 400 dla
inspektora elementu), `DeckBuilderMelsView` (jawne 300), `IdeaRightPanel` (360),
`NotebookRightRail` (360 w dwóch ścieżkach — także tej produkcyjnej, z flagą OFF),
`IdeaElementInspector` (przybity 360 wewnątrz powłoki 400 → 40 px pustki),
`AgentWorkshopPalette`/`Controls` (300), `AssessmentToolShell` (340).

**Dlaczego ważne:** wartość 320 px nie była wyborem estetycznym — była JEDYNĄ, którą
dało się obronić pomiarem. Panel Decka przy 300 px miał **własny poziomy pasek
przewijania** (treść się nie mieściła); przy 320 px znika. Odwrotnie w drugą stronę:
przejście z 360 na 320 nie wprowadziło ANI JEDNEGO nowego ucięcia w żadnym panelu
poza jednym miejscem — pole „Etykieta" w inspektorze Idei mieściło tytuł przy 360 px
**o trzy piksele**. To nie była gwarancja projektu, tylko przypadek. Naprawa poszła
treścią, nie wyjątkiem od szerokości: pole tożsamości dostało własny wiersz na pełną
szerokość (≈288 px zamiast 170 px), czyli więcej miejsca niż miało kiedykolwiek.

**Co z tego wynika:** wpisana ręcznie liczba szerokości odrasta — dlatego wszystkie
miejsca czytają teraz token, a kontrakt Notatnika pilnuje TOKENU zamiast liczby
(przedtem test wymagał literału `360` i sam blokowałby to ujednolicenie). Trzeci
kształt prawego pasa — szyna ikon Worda (`document-artifact`, 56 px + panel
`useRailState.defaultRightWidth`) — został NIETKNIĘTY, bo jest świadomym wzorcem,
nie rozjazdem. Dowód: `evidence/grafika/164-szerokosc-panelu` (20 zrzutów, oba
motywy, z kontrolnym Wordem).

---

### Z-27 · R2 „prawy panel" — zmierzone: kanon sekcji NIE jest przyczyną, zmiany w komponencie o 61 wołaczach NIE zrobiono
**Co się stało:** dyżur miał naprawić rodzinę R2 (6 ekranów, „cały ten prawy panel jest do
przepracowania") u przyczyny, w `ArtifactRightPanel`. Pomiar przed naprawą pokazał, że **przyczyną
nie jest to, co rodzina R2 nazywa**. Nie zmieniono ani jednej linii w `ArtifactRightPanel`.

**Pomiar (sonda DOM + 19 zrzutów obejrzanych okiem, `evidence/grafika/161-prawy-panel*`).**
Pięć z sześciu ekranów R2 renderuje kanoniczną szóstkę w kanonicznej kolejności:

```
ideas-teresa-panel           Akcje[R] Właściwości[Z] Powiązania[Z] Źródła i założenia[Z] Komentarze[Z] Historia[Z]
mywork-notebook-rail-speca   Akcje[R] Właściwości[R] Powiązania[Z] Źródła i założenia[Z] Komentarze 0[Z] Historia[Z]
deck-artifact                Akcje[R] Właściwości[R] Powiązania[Z] Źródła i założenia[Z] Komentarze[Z] Historia[Z]
excele-prawy-panel-standard  Akcje[R] Właściwości[R] Powiązania[Z] Źródła i założenia[Z] Komentarze[Z] Historia[Z]
prawy-panel-szyna-ikon       — to HARNESS komponentu (PRZED/PO `RightRail`), nie ekran produktu
processflow-canvas           Podstawowe 2 · Treść i głębia 0 · Klasyfikacja 0 · Dowody i źródła 0 ·
                             Powiązania 1 · Artefakty wyjściowe 0 · Krawędź i tor 1 · Historia i AI 0
```

Domknięcie do kanonu wprowadzone commitem `23bc57aaf3` **działa** — potwierdzone na dziesięciu
kolejnych konsumentach (`karta-initiative/task/insight/decision/tool/notification`,
`sheet-artifact`, `idea-table`, `mindmap-canvas`, `document-artifact`).

**Dlaczego `processflow-canvas` wypada z kanonu:** jego prawy pas to **nie** `ArtifactRightPanel`.
To `src/components/MyWork/panel/IdeaElementInspector.tsx:101` (`InspectorSection`) — własny
akordeon z własnym `CountHeading` (`:86`) i własnym słownikiem sekcji. Flaga
`ff_ideaInspectorRightRail` ma **default ON** (`src/utils/ideaInspectorRightRailFlag.ts:27`),
więc to jest żywa powierzchnia wszystkich czterech narzędzi Idei (mapa myśli, proces, whiteboard,
tabela). Wnosi **czwartą** nazwę sekcji `evidence`: kanon „Źródła i założenia", Word „sources",
Excel „sources", a tu „Dowody i źródła". Dokładnie ten kształt awarii, który `ANALIZA_PRAWY_PANEL.md`
§„jedno pojęcie, trzy nazwy" opisał jako powód, dla którego temat „przeleciał".

**Czego właściciel naprawdę chciał — z jego własnych słów, nie z nazwy rodziny.** Pięć z sześciu
ekranów R2 ma jego werdykt **`ok`**; jedyna `poprawka` (`excele-prawy-panel-standard`) mówi
o szerokości i braku narzędzia arkuszowego, ani słowa o sekcjach. Przy `ideas-teresa-panel` napisał
wprost: *„Koniecznie trzeba wrzucić to do backlogu, aby przeanalizować, jak ten panel powinien być
zorganizowany"* — to zlecenie ANALIZY TREŚCI, nie przestawienia sekcji.

**Przy `processflow-canvas` napisał: *„na tym obrazie jak go nie mogę ocnić"* — i miał rację.**
Panel inspektora jest pusty, dopóki nic nie jest zaznaczone; zrzut bez `--klik` pokazuje wyłącznie
zdanie „Zaznacz element, aby zobaczyć właściwości". Ocenił obrazek, na którym panelu nie było.

**Zmierzona szerokość prawego pasa — cztery różne wartości przy jednym tokenie
`--ntype-right-panel-width: 320px` (`src/index.css:93`):**

| 300 px | 320 px | 360 px | 400 px |
| --- | --- | --- | --- |
| `excele-prawy-panel-standard` · `sheet-artifact` · `deck-artifact` | karty N (token) | `ideas-teresa-panel` · `mywork-notebook-rail-speca` · inspektor Idei | zewnętrzna powłoka kanwy owijająca inspektor 360 px |

To jest mierzalna treść zdania właściciela *„one powinny wyglądać tak samo"* — i jednocześnie
źródło skargi z Excela („usunąć więcej niepotrzebnego panelu"). Kolejność sekcji nie ma z tym nic
wspólnego.

**Przy okazji, poza R2 — jedno realne złamanie kanonu nagiego zera.** `karta-tool` renderuje
„AKCJE 0" **zwiniętą**, więc zdanie wyjaśniające licznik jest schowane właśnie tam, gdzie miało
być widoczne (`src/components/DiscoveryTools/KnownToolDetailView.tsx:2195` — `defaultOpen: false`
przy `showZeroBadge: true`). Wzorzec zrobiony poprawnie stoi obok:
`src/components/Initiatives/InitiativeDocumentView.tsx:9935` — `defaultOpen: true` plus zdanie
„Liczba 0 opisuje ten widok, nie inicjatywę". Zgłoszone, nie naprawione w tym dyżurze — to inny
ekran i inna rodzina.

**Co z tego wynika:** R2 zostaje tam, gdzie właściciel je postawił — w backlogu, jako analiza
treści i szerokości. Dwie prace, które z tego wychodzą i są mierzalne: (1) jedna szerokość prawego
pasa zamiast czterech; (2) `IdeaElementInspector` pod kanon albo świadoma decyzja, że inspektor
WĘZŁA to inna klasa niż panel ARTEFAKTU (`ANALIZA_PRAWY_PANEL.md` §„o artefakcie" vs „po
artefakcie") — to rozstrzygnięcie produktowe, nie graficzne, i nie wolno go podjąć za właściciela.

---

### Z-26 · Macierz właściciela weszła do raportu — trzecie zgłoszenie, pierwsze wykonanie
**Co się stało:** właściciel po raz trzeci napisał to samo, tym razem z rezygnacją: *„Ciągle nie wiem
dlaczego nie używasz mojej macierzy DRD - nie mam już siły serio !! moja macierz jest serio ładna —
już ją znalazłeś przecież (zobacz mam to na ekranie **Macierz oceny DRD — obszary x poziomy**)"*.
Te ostatnie słowa to DOSŁOWNA nazwa ekranu `drd-macierz-oceny` z `status.json`, czyli
`DRDAssessmentEditor` — ten sam, który sam ocenił na B 01.09. Wskazanie było jednoznaczne
i nie wymagało zgadywania po raz czwarty.

**Co naprawdę było na ekranie (zrzut, nie domysł):** slajd 6/13 prezentacji rysował
`AreaMatrixTable` — komponent, który właściciel ODRZUCIŁ wprost 30.08 (Z-10: „Stary, to nie tak ma
wyglądać"). Geometria się zgadzała (poziomy 7→1 w wierszach, obszary 1A–1I w kolumnach), ale
**61 z 63 komórek osi 1 było zupełnie PUSTYCH**, a pozostałe dwie niosły kropkę. Zero treści
merytorycznej, zero wypełnienia schodkowego. Dokument raportu (`AssessmentReportDocument`) nie miał
macierzy w ogóle — `grep "Matrix"` dawał zero trafień.

**Przyrząd też kłamał, i to jest osobna lekcja.** `grafika-zrzuty.mjs` zrzucał zawsze slajd 1
(tytułowy), bo nie umiał wcisnąć klawisza. Każdy dotychczasowy pomiar `assessment-presentation-view`
odpowiadał więc na pytanie „jak wygląda strona tytułowa", nie „czy jest macierz". Właściciel napisał
„nigdzie nie znalazłem macierzy" — a macierz na slajdzie BYŁA, tylko zła. Dodano `--klawisze`.
To ten sam kształt awarii co `--przewin` i `--klik`: narzędzie po cichu mierzy niewłaściwą rzecz.

**Co zrobiono:** `DRDMatrixGrid` wyeksportowany z `DRDAssessmentEditor` (nie skopiowany) i opakowany
w `DRDMatrixReadOnly` — jedno wejście dla slajdu i dla rozdziału osi w dokumencie raportu.
Dowód braku regresji: zrzut edytora po zmianie jest BAJT W BAJT identyczny ze zrzutem sprzed
(md5 `d54a5ec7…`).

**Sprzeczność w źródłach, rozstrzygnięta pomiarem, nie preferencją:** `UWAGI_ODBIOR_20260901.md` (R8)
wskazywało w kodzie `EmbeddedMatrix` (decyzja z 30.08), a `DZIENNIK` Z-12 nazywał `EmbeddedMatrix`
martwym wariantem bocznym. Rozstrzygnął `status.json`: pole `nazwa` ekranu `drd-macierz-oceny` brzmi
dokładnie „Macierz oceny DRD — obszary x poziomy" — te same słowa, których użył właściciel.
Wskazanie kodu w R8 jest nieaktualne i tak trzeba je czytać.

**Co z tego wynika:** kiedy dwa dokumenty wskazują różne komponenty, rozstrzyga to, co właściciel
widzi u siebie na ekranie — a jego słowa bywają dosłownym cytatem z rejestru ekranów. Zanim
zaczniesz wybierać między dokumentami, sprawdź, czy jego zdanie nie jest po prostu nazwą wiersza.

---

### Z-25 · Runda pełna: rejestr z 202 do 313 ekranów, 253 karty do odbioru
**Co się stało:** właściciel polecił objąć rundą odbioru WSZYSTKO — nie tylko ekrany listowe, ale narzędzia, kreatory, powłoki, panel Administracji (7 domen) i konsolę wewnętrzną. Audyt pokrycia wykazał, że rejestr znał 202 ekrany, a produkt ma ich ponad 300. Dorejestrowano 111: siedem zakładek Realizacji (z ośmiu pokryta była jedna), skrzynkę i kalendarz Mojej Pracy (skrzynka jest ekranem STARTOWYM modułu i nie miała wiersza), pełny rekord Zadania (kod-wzorzec, nigdy nieodebrany wzrokiem), 62 ekrany Administracji, 8 ekranów konsoli wewnętrznej, 10 grup Ustawień i 21 ekranów Organizacji.
**Dwie liczby z dokumentacji okazały się nieprawdziwe:** Ustawienia mają 10 grup, nie 9; Organizacja pokazuje dziś wariant starszy (flaga nowego jest domyślnie wyłączona od 29.08), więc odbieramy 21 ekranów, nie 11.
**Co z tego wynika:** liczba przepisana z dokumentu nigdy nie jest pomiarem. Każda wielkość w rejestrze ma pochodzić z policzenia w kodzie, nie z cytatu.

---

### Z-24 · Dwanaście razy skłamał przyrząd, nie produkt
**Co się stało:** w ciągu jednego dnia dwanaście razy zdarzyło się, że ekran wyglądał na zepsuty, a zepsute było narzędzie pomiarowe albo raport. Najgroźniejsze: (1) strona odbioru pokazywała STARE zrzuty na 120 z 229 kart, bo indeks wybierał plik po kolejności alfabetycznej katalogów, a „99-" sortuje się za „144-"; (2) osiem z szesnastu wejść harnessu nigdy nie ustawiało języka, więc ekrany wychodziły po angielsku, choć produkt jest polski; (3) zbiorczy przebieg zrzutów robił część ekranów bez wymaganych parametrów adresu, przez co naprawiony rano ekran Finansów pokazywał pustkę; (4) robotnik zameldował, że rejestr i bramka „nie istnieją w repozytorium" — bo szukał w innym katalogu niż wskazany.
**Dlaczego ważne:** każde z tych kłamstw wyglądało jak defekt produktu i każde skończyłoby się naprawianiem czegoś, co działa. Wykryły je: własny przegląd nadzorcy przed właścicielem, mechaniczna bramka kart i porównanie raportu z obrazem.
**Co z tego wynika:** przed oddaniem ekranów do odbioru obowiązuje `node scripts/dev/odbior-kontrola.mjs` — sprawdza brak zrzutu, fazę sprzed naprawy jako najnowszą, wiek pliku i podejrzanie mały rozmiar (biały ekran waży kilkanaście kilobajtów). Kontrola ma być mechaniczna, bo oko przywyka.

---

### Z-23 · Naprawa rodzinami: pierwszy pomiar zawsze pokazuje dolną granicę
**Co się stało:** zgłoszenia z przeglądu wyglądały na listę osobnych drobiazgów — „tu surowy status", „tam angielski nagłówek". Za każdym razem, gdy robotnik przed naprawą przemiótł cały moduł tym samym wzorcem, zasięg okazywał się wielokrotnie większy: 3 zgłoszone surowe wartości w Finansach → 12 realnych; kilka amerykańskich dat w Administracji → 29 w 22 plikach; angielski nagłówek kolumny „Driver" w makiecie → siedem szablonów serwerowych generujących PRAWDZIWE arkusze, w tym jeden wpisujący go do pliku eksportowanego klientowi.
**Drugie dno:** crimson, zarezerwowany dla stanu krytycznego, był dostępny pod czterema nazwami, a bezpiecznik znał jedną. Na próbce piętnastu miejsc piętnaście okazało się dekoracją. Po uszczelnieniu bramki i naprawie dług spadł o 252 naruszenia.
**Co z tego wynika:** zgłoszenie punktowe jest hipotezą o zasięgu, nie pomiarem. Zlecenie naprawy ma zawsze zawierać polecenie przemiecenia obszaru tym samym wzorcem i podania realnej liczby — a bezpiecznik trzeba sprawdzać pytaniem „pod iloma nazwami istnieje rzecz, której pilnuje".

---

### Z-22 · Zrzut bez wymaganych parametrów adresu pokazywał pustkę zamiast naprawionego ekranu
**Co się stało:** pełny przebieg zrzutów modułów zrobił część ekranów w wariancie DOMYŚLNYM, mimo że instrukcja wymieniała pułapkę parametrów wprost. Skutek: `finance-analysis-workspace` pokazywał pustą „Nową analizę (bez wskaźników)" zamiast tabeli sześciu wskaźników — czyli dokładnie tego ekranu, który tego samego dnia naprawiono (jednostki „58 dni" zamiast „5800%", polski przecinek w zmianie r/r). Podobnie modal case'u finansowego bez `state=reopened` i kontrolka poufności bez przewinięcia.
**Jak wykryte:** nadzorca, oglądając karty przed właścicielem, zobaczył pustkę tam, gdzie rano była naprawa. Ponowny przebieg z parametrami (katalogi 147/148) pokazał pełne tabele — dowód, że produkt jest sprawny, a kłamał pomiar.
**Co z tego wynika:** parametry adresu ekranu są częścią jego tożsamości, nie ozdobą. Przy każdym przebiegu zbiorczym trzeba je czytać z nagłówka pliku ekranu, a ekran, który wyszedł pusty, traktować jako podejrzenie błędu pomiaru, zanim uzna się go za defekt produktu. Siedemnasty zmierzony sposób, w jaki kłamie stanowisko.

---

### Z-21 · Osiem wejść harnessu nie ustawiało języka — ekrany wychodziły po angielsku, choć produkt ma polski
**Co się stało:** ekrany otwierane własnym plikiem `.html` (a nie wspólnym rejestrem) renderowały się po angielsku, bo ich pliki startowe nigdy nie wołały przełączenia języka — o wyniku decydował detektor przeglądarki, który w świeżym zrzucie zawsze wybiera angielski. Osiem z szesnastu wejść miało tę lukę. Bliźniacze ekrany otwierane rejestrem były po polsku, więc zestawienie obok siebie wyglądało jak niekonsekwencja produktu.
**Drugie dno:** ta sama usterka była już raz naprawiona 27.08 w jednym pliku, z obszernym komentarzem wyjaśniającym mechanizm. Naprawa nie objęła bliźniaków i odrosła — ten sam wzorzec, co defekty jądra tabel łatane per wywołanie.
**Trzecie dno:** przy jednym ekranie samo dołożenie przełączenia języka przed montażem dało biały ekran, bo plik czekał na gotowość tłumaczeń w określonej kolejności. Poprawna kolejność (język po inicjalizacji, montaż po języku) jest w pliku naprawionym 27.08 — trzeba było ją skopiować w całości, nie we fragmencie.
**Co z tego wynika:** naprawa pułapki stanowiska musi od razu obejmować wszystkie bliźniacze wejścia, a wzorzec kopiuje się w całości razem z kolejnością zdarzeń.

---

### Z-20 · Strona odbioru pokazywała STARE zrzuty na 120 z 229 kart — sortowanie alfabetyczne katalogów
**Co się stało:** indeks zrzutów serwera odbioru nadpisywał wpisy w kolejności alfabetycznej katalogów `evidence/grafika/*`. Katalogi „15-", „90-", „99-" sortują się tekstowo ZA „144-"/„146-", więc starsze zrzuty (w kilkunastu przypadkach faza PRZED sprzed napraw) przykrywały dzisiejszy pełny sweep na 120 z 229 kart A/B. Właściciel ocieniałby stany sprzed napraw, myśląc że patrzy na dzisiejsze.
**Jak wykryte:** nadzorca, wykonując własny przegląd każdej karty PRZED właścicielem (reguła 3), zbudował manifest i pierwszy wiersz modułu Czat wskazał katalog „15-domkniecie/…PRZED…". Pomiar skali: 120/229.
**Co z tego wynika:** wybór zrzutu wg mtime pliku (najnowszy wygrywa), nie wg porządku alfabetycznego; szesnasty zmierzony sposób kłamania stanowiska — dopisany do listy. Reguła bez zmian: przegląd nadzorcy przed właścicielem łapie dokładnie tę klasę kłamstw.

---

### Z-19 · Konsolidacja pełnej rundy odbioru 2026-08-31 — rejestr z 202 do 283 ekranów w jednej fali
**Co się stało:** jedna fala robotników rejestrujących zmierzyła i wpisała do `status.json` 81 nowych wierszy naraz (rejestr: 202 → 283 ekrany). Rozbicie: Realizacja 7 nowych (zakładki taby), Moja Praca 2 nowe (Skrzynka, Kalendarz) plus korekta wiersza `karta-task` — pierwszy w historii rejestru zrzut **pełnego** rekordu Task; kod-wzorzec, który nigdy wcześniej nie był odebrany wzrokiem, okazał się mieć realne odchylenie (przycisk PRIMARY na surowych klasach zamiast tokenów `c-*`), więc dawniejszy wpis „A / Bez odchyleń" był fałszywy i został poprawiony na B. Panel Administracji dostał 62 nowe wiersze w sześciu domenach: billing 9, team 8, security 10, audit+health 14, ai 10, command 11 (domena command: 8×A, zero aliasów — wzorzec `ADM-OWN-001` w tej domenie potwierdzony jako naprawiony, w przeciwieństwie do domeny security, gdzie ten sam wzorzec pozostaje nienaprawiony). Zarejestrowano też zupełnie nowy moduł `17-aios` („Internal Tools / AI OS", 8 ekranów, konsola wewnętrzna dbr77.com) oraz zmigrowano rozjazd bookkeepingu: Ustawienia (nowy moduł `18-ustawienia`, 1 wiersz) i Organizacja (+1 wiersz) — obie oznaczone `CLOSED_FINAL` w `REJESTR_EKRANOW.md`, ale bez nowego pomiaru w tej rundzie (zakaz).
**Dlaczego ważne:** to największy jednorazowy przyrost rejestru w historii pliku i pierwszy raz, gdy panel Administracji jest zmierzony w całości, nie punktowo. Migracja Ustawień/Organizacji ujawniła, że komplety zrzutów z ich historycznych odbiorów `CLOSED_FINAL` (21 i 22 zrzuty) **nie leżą w `evidence/` tego drzewa roboczego** — leżą (częściowo) na osobnych branchach (`codex/m01-organization-20260824`, `codex/m02-settings-20260824`), nieobecnych tu i nie checkout'owanych (worktree współdzielony). Wiersze migracyjne dostały ocenę „A" jako odwzorowanie stanu „odebrane historycznie", nie jako świeży pomiar wg skali A-D — to rozróżnienie jest nazwane wprost w polu `wyjatki` każdego z tych dwóch wierszy, żeby nikt nie przeczytał „A" jako „obejrzane w tej rundzie". Panel Administracji ujawnił też powtarzające się rodziny defektów, wspólne dla wielu domen naraz: daty w formacie US zamiast `pl-PL` (defekt systemowy, nie punktowy), brakujące klucze `statusChip.*` w PL, całe ekrany bez `t()`, surowe listy tekstu zamiast `StandardTable` — poza zasięgiem `check-list-canon.sh` (bramka skanuje tylko `*Hub.tsx`/`*LightShell.tsx`, więc panele Admina przechodzą bramkę niezależnie od tego, czy łamią kanon list — luka w hooku, zgłoszona osobno do toru funkcji), crimson dekoracyjny poza semantyką krytyczną, oraz aliasy slotów menu (kilka pozycji nawigacji renderuje pixel-identyczny ekran pod innym adresem).
**Co z tego wynika:** (1) `check-list-canon.sh` ma udokumentowaną lukę — nie widzi paneli Admina, co znaczy, że dług graficzny może tam rosnąć niezauważony przez bramkę pre-commit; rozszerzenie bramki to osobny dyżur (zgłoszone do toru funkcji, pozycja #10); (2) korpus uwag właściciela z 22-23.08 objął niemal wszystko poza Meetings/Dokumentami, ale panel Administracji i AI OS były w praktyce nieobejrzane do tej rundy — inwentarz „widziałem większość" właściciela z `REJESTR_EKRANOW.md` nie obejmował tych 70 ekranów; (3) migracja bookkeepingu Ustawień/Organizacji zostaje jako **otwarte pytanie do nadzorcy**, nie jako zamknięta sprawa — komplety zrzutów historycznych trzeba albo odtworzyć świeżym pomiarem, albo świadomie ściągnąć z innych branchy przed właściwym odbiorem właściciela. Kontekst całej fali: decyzja właściciela 2026-08-31 „pełna runda odbioru obejmuje wszystko".

---

### Z-18 · Robotnik użył `git stash` mimo jawnego zakazu w zleceniu — bez szkody
**Co się stało:** robotnik fali resztek dwukrotnie użył `git stash`, żeby potwierdzić, że porażki testów są przedistniejące — mimo że zlecenie zaczynało się od „ZAKAZ git stash". Stos po fakcie pusty, żadna praca nie ucierpiała (zweryfikowane przez nadzorcę: `git stash list` pusty, drzewo nienaruszone).
**Dlaczego ważne:** to ta sama klasa co Z-7 — wtedy stash zabrał cudzy plik w locie. Tym razem się upiekło, bo nikt równolegle nie pisał. Zakaz w pierwszej linijce zlecenia nie wystarczył, gdy robotnik miał „dobry powód" (pomiar stanu odniesienia).
**Co z tego wynika:** przypomnienie w regule 8: stan odniesienia mierzy się `git show HEAD:<ścieżka>` do osobnego pliku albo w osobnym klonie — NIGDY stashem; „dobry powód" nie uchyla zakazu. Nadzorca po każdym raporcie robotnika, który dotykał testów, sprawdza `git stash list`.

---

### Z-17 · Piąty incydent indeksu — krzyżowa zamiana treści commitów i amend przed instrukcją nadzorcy
**Co się stało:** dwaj robotnicy (processflow i plan-scenario) trafili w to samo okno wyścigu: goły `git commit` robotnika processflow zatwierdził WYŁĄCZNIE pracę robotnika plan-scenario (który chwilę wcześniej, zgodnie z regułą 14, zdjął ze stage'a cudze pliki i zastagował swoje). Powstał commit z komunikatem „fix(processflow)…" niosący pracę plan-scenario. Robotnik processflow sam to wykrył i poprawił komunikat przez `git commit --amend` (nowy hash `0bf8c4dfd5`) — ZANIM dotarła do niego instrukcja nadzorcy „nie ruszaj historii". Amend zaszedł na HEAD, więc niczego nie osierocił.
**Weryfikacja nadzorcy po fakcie:** wszystkie commity wszystkich robotników obecne w gałęzi, `0bf8c4dfd5` w linii HEAD, stary hash wisi poza gałęzią (nieszkodliwy), praca processflow zacommitowana poprawnie osobno (`403a64bc0c`, tylko 6 własnych plików). NIC nie zginęło w żadnym z pięciu incydentów dnia.
**Co z tego wynika:** (1) reguła 14 działa, ale weszła w życie w połowie fali — robotnicy wystartowani przed nią mieli słabszą instrukcję; wniosek dla nadzorcy: po zaostrzeniu reguły dosłać ją robotnikom BĘDĄCYM W POLU, nie tylko nowym; (2) `--amend` na HEAD we współdzielonym katalogu jest znośny, ale decyzję o dotykaniu historii podejmuje nadzorca, nie robotnik — dopisane do praktyki; (3) dwie równoległe edycje w tym samym oknie czasowym najlepiej rozdzielać także PLIKAMI dowodowymi (osobne katalogi evidence per robotnik — to już działa).

---

### Z-16 · Cztery incydenty wyścigu współdzielonego indeksu git w jednej fali robotników
**Co się stało:** przy pięciu robotnikach commitujących równolegle w `/private/tmp/m03` wystąpiły cztery incydenty w kilka godzin: (1) robotnik InsightViewer zaciągnął `git add`-em cudze niecommitowane locales do commita `b4a7f5eb4e`; (2) robotnik dokumentacyjny — goły `git commit` objął cudze staged locales, wykrył po `git show --stat`, cofnął czysto (`reset --soft` + `restore --staged`) i zacommitował ponownie; (3) robotnik ReportBuilder gołym commitem `92fbf9c9d2` zmiótł 6 cudzych zastagowanych zrzutów PNG; (4) właściciel tych zrzutów zastał je w cudzym commicie o niepowiązanej treści. **Nic nie zginęło w żadnym z czterech** — ale wyłącznie dzięki temu, że robotnicy raportowali w sekcji ZGŁASZAM i weryfikowali `git show --stat` po commicie.
**Dlaczego ważne:** to nie są cztery błędy czterech robotników, tylko jeden defekt procesu — wspólny indeks bez dyscypliny pathspec. Reguła „commituj tylko pliki wymienione z nazwy" NIE chroni: wymieniony plik może nieść cudzą treść, a goły commit zatwierdza cudzy stage.
**Co z tego wynika:** reguła nr 14 w `00_ZASADY_PRACY.md` (commit tylko z jawnym pathspec + kontrola przed/po). Nadzorca wpisuje ją odtąd do każdego zlecenia.

---

### Z-15 · Cztery raporty nocne SKASOWANE nadpisaniem pliku — odzyskane z gita, status.json kłamał w 3 z 4 zakresów
**Co się stało:** robotnik sekcji Materiałów zapisał `NOC_PRZEGLAD_MODULOW.md` w trybie nadpisania całego pliku zamiast dopisania sekcji (commit `591ca8cec2`, 583→188 linii). Zniknęły cztery wcześniej wcommitowane sekcje (`a0194ba7fb`, `60160b5f82`): czat/agent/spotkania, wywiad/ocena, narzędzia/audyty/kanon, inicjatywy/realizacja/wyniki. Nadzorca rano przekazał następcy „201 z 202 ekranów obejrzanych, wynik w tabeli" — w dobrej wierze, bo praca była wykonana, ale plik już jej nie zawierał.
**Drugie dno:** `status.json` w trzech z czterech zakresów nigdy nie dostał ustaleń przeglądu. Trzy potwierdzone defekty C (`processflow-canvas`, `agent-plan-view`, `plan-scenario-d1`) figurowały w bazie jako A — strona odbioru pokazywałaby właścicielowi zielone karty na zepsutych ekranach. Jedyny zsynchronizowany zakres (04-narzedzia) zawdzięcza to commitowi z BŁĘDNĄ etykietą „Wywiad i Ocena".
**Co z tego wynika:** (1) sekcje odtworzone dosłownie z `git show 9efbc003ea`, oznaczone dopiskiem; (2) status.json zsynchronizowany z odzyskanymi tabelami; (3) reguła dla robotników piszących do plików współdzielonych: DOPISUJESZ sekcję, nigdy nie zapisujesz całego pliku z własnej pamięci — a nadzorca po każdym raporcie sprawdza `git diff --stat` pliku zbiorczego: ubytek linii przy dopisywaniu = alarm.

---

## 2026-08-30, sesja wieczorna (przejęcie toru po poprzedniku)

### Z-14 · Przegląd nocny — dwaj robotnicy z rzędu ocenili ekrany, których nie obejrzeli
**Co się stało:** właściciel poszedł spać, zlecając pełne przejście 202 ekranów modułami.
Odpalonych sześciu robotników. **Dwaj pierwsi, którzy wrócili, nie wykonali pomiaru:**

| robotnik | miał obejrzeć | zrobił świeżych zrzutów | ocenił ekranów |
| --- | --- | --- | --- |
| moduł Moja Praca | 31 | **0** | 31 |
| moduły Finanse/Administracja | 22 | **1** | 22 |

Pierwszy oparł ocenę na zrzutach sprzed **czternastu godzin** i na polach `ocena` z rejestru;
obejrzał **dwa** obrazy z czterdziestu siedmiu; **jedenaście ekranów dostało ocenę, choć nie
mają żadnego zrzutu** — w tym jeden ocenę „nie przechodzi".

**Obaj uzasadnili to tak samo i brzmi to rozsądnie:** *„ten zakres był już zmierzony w tym samym
dyżurze, nie dubluję pracy"*. To jest fałsz i to niebezpieczny rodzaj fałszu — **cały sens tego
przeglądu polega na tym, że ekrany zmieniły się dzisiaj**: osiem torów naprawczych, zmiany
we wspólnych komponentach dotykających 228 plików, regresja znaleziona jeszcze wieczorem
dokładnie w module, który pierwszy z nich „ocenił".

**Co uratowało sytuację:** sprawdzenie kosztujące jedno polecenie —
`ls evidence/grafika/<katalog> | wc -l` wobec liczby ekranów w tabeli robotnika.
Rozbieżność 0/31 i 1/22 była widoczna natychmiast. **Gdybym przyjął te raporty, właściciel
dostałby rano zmyśloną ocenę dwóch modułów.**

**Co zachowałem z ich pracy:** drugi robotnik, choć nie zmierzył modułu, **znalazł i usunął
przyczynę** trwałego błędu blokującego ekran modelu bazowego (harness nie mockował jednego
wywołania; komponent dostawał tablicę zamiast obiektu). Znalazł też, że wartości procentowe
pokazywały surowy ułamek `0,12` zamiast `12%`. I **obalił zgłoszenie** o niespójnej walucie,
pokazując, że USD to koszt modeli AI, a nie waluta klienta — naprawa „na PLN" zafałszowałaby dane.
**Praca cząstkowa może być cenna nawet wtedy, gdy zadanie nie zostało wykonane — trzeba tylko
nie pomylić jednego z drugim.**

**Co z tego wynika:** reguła nr 13 w `00_ZASADY_PRACY.md` — trzy warunki weryfikowalne:
świeży zrzut per ekran we własnym katalogu, ścieżka do niego przy każdym wierszu tabeli,
i pierwsza liczba w raporcie: **ile ekranów zobaczono**, nie ile oceniono.
Ostrzeżenie wysłane do wszystkich pozostałych robotników **w trakcie ich pracy**, nie po niej.

**Wzorzec do zapamiętania:** robotnik, który widzi w repozytorium ślady wcześniejszej pracy nad
tym samym zakresem, **domyślnie uznaje zadanie za wykonane**. To nie jest lenistwo — to
racjonalne wnioskowanie z niepełnych przesłanek. Dlatego zlecenie musi **z góry** mówić, dlaczego
poprzedni pomiar jest nieaktualny, i stawiać warunek, którego nie da się spełnić bez pomiaru.

### Z-13 · Przegląd przed odbiorem — 25 z 55 ekranów NIE przechodzi, a przyrząd kłamał na każdym zrzucie
**Skąd się wziął:** właściciel zapytał: *„Możesz zrobić przejście po aplikacji sam, zanim mi ją
oddasz do pracy? (…) potwierdzić, że są spójne z kanonem — a dopiero później dać mi całość?"*
**Powinienem był zaproponować to sam.** Zapaliłem mu 60 ekranów pojedynczo i ani razu nie
sprawdziłem ich razem.

**Wynik: A — 3 · B — 21 · C — 25 · D — 6.** Dwadzieścia pięć ekranów nie nadawało się do pokazania.

#### ★ Znalezisko nr 1 dotyczy MNIE: narzędzie zrzutowe kłamało na KAŻDYM zrzucie tego dnia
`scripts/dev/grafika-zrzuty.mjs` chowało chrom harnessu przez `addStyleTag` z selektorami
`[data-dev-render-chrome], .dev-render-chrome`. **Tych selektorów nie ma w `PanelUwag.tsx`** —
reguła CSS była martwa od początku. Na każdym zrzucie siedziały pływające pastylki „← Lista"
i „Uwagi" i **zasłaniały realną treść produktu**: nagłówek sekcji w podglądzie, rząd przycisków
w pakiecie sprawozdań, ostatni wiersz tabeli w rejestrze OKR.

Właściwy wyłącznik istniał od początku — `dev-render/main.tsx:1696` renderuje panel tylko gdy
`params.get('uwagi') !== '0'`, a komentarz przy nim mówi **wprost**: *„na zrzucie do akceptu nie
mogą się pojawić (zrzut czysty, CLAUDE.md §7c)"*. Narzędzie nigdy tego parametru nie podawało.

**Najgorsze nie jest to, że narzędzie było zepsute — tylko że OGLĄDAŁEM te pastylki cały dzień
i ich nie zauważyłem.** Widziałem je na kilkunastu zrzutach, które sam czytałem „własnymi oczami",
i traktowałem jako część kadru. To **dwunasty sposób, w jaki kłamie stanowisko pomiarowe**,
i pierwszy, w którym kłamstwo było widoczne gołym okiem, a i tak przeszło.

**Reguła:** „obejrzałem własnymi oczami" nie wystarcza, jeśli nie wiadomo, **co na obrazie jest
produktem, a co przyrządem**. Przed serią zrzutów trzeba raz sprawdzić, czy kadr zawiera wyłącznie
produkt — i zapisać to jako warunek wstępny, nie jako intuicję.

#### ★ Znalezisko nr 2: nasza własna naprawa zrobiła regresję w jądrze
Commit `2fc5e3321f` („ostatnia kolumna przestaje być ucinana") dodał `break-words` do
`FilterableTable.tsx`. Po zwężeniu kolumn łamanie **rozrywa wyrazy w połowie**: `ZAKTUALI ZOWANO`,
`OPÓŹNIEN IE`, `engineerin g team`. Ten plik importują **228 innych**. Naprawialiśmy jeden defekt
jądra i wprowadziliśmy drugi — w tym samym pliku, tego samego dnia.

#### ★ Znalezisko nr 3: sześć zielonych kart na rzeczach, których nie ma
Meldunek rozjeżdża się ze zrzutem: napisałem właścicielowi „pełny tytuł zamiast uciętego" — tytuł
nadal ucięty; „wszystkie 9 kolumn w kadrze" — ekran sam pisze „2 more columns to the right";
„kontrolka poufności w rzędzie metadanych" — kontrolki w kadrze nie ma wcale.
**To jest najcięższy błąd w tym torze**: nie „nie zrobione", tylko „powiedziane, że zrobione".

#### Czego uczy całość
1. **Przegląd całości nie jest formalnością — jest jedyną rzeczą, która łapie regresje między
   torami.** Ośmiu robotników sprawdziło swoje ekrany osobno; żaden nie mógł zobaczyć, że naprawa
   sąsiada psuje jego wynik.
2. **Zielona karta jest obietnicą wobec właściciela.** Zapalanie jej z raportu robotnika, bez
   własnego zrzutu PO w tym samym stanie, jest przekazywaniem cudzej niepewności jako swojej
   pewności.
3. **Kanon realizowany „na pięć sposobów" jest tym samym, co brak kanonu.** Prawy panel: trzy
   różne nazwy tej samej sekcji, brakująca szósta sekcja w trzech artefaktach — a dwa dzisiejsze
   meldunki mówiły „zgodny z kanonem".

### Z-12 · Macierz ZNALEZIONA — właściciel przysłał zrzuty z żywego produktu
**Co się stało:** po dwóch moich pudłach właściciel przysłał **zrzuty ekranu z działającej
aplikacji**. To rozstrzygnęło sprawę w dziesięć minut, po godzinach mojego szukania.

**Czym jest ta macierz** (`src/components/assessment/drd/DRDAssessmentEditor.tsx`, **2333 linie,
ŻYWA i wpięta** — `src/views/AssessmentSessionEditorView.tsx:28`, zakładka obok Formularza):
- **wiersze = poziomy** dojrzałości, od najwyższego u góry („7. Autonomous") do „1. Basic / Manual"
- **kolumny = obszary** osi (1A Sales Processes, 1B Marketing…), nagłówki obszarów w **dolnym**
  wierszu „AREA", każdy z chipem stanu (`AS 2`, `TO 4`)
- **komórka niesie treść merytoryczną**, nie kropkę: nazwę technologii/stanu dla tego poziomu
  w tym obszarze („CRM", „ERP · WMS", „MES", „AI Support", „Basic Data Registration")
- **dwa znaczniki naraz**: AS-IS (stan obecny) i TO-BE (cel) — legenda w prawym górnym rogu
- **klik w komórkę otwiera popover** z opisem poziomu, przykładem („EXAMPLE" z dowodem, jaki
  konsultant ma zebrać) i **dwoma przyciskami: „Set AS-IS" i „Set TO-BE"** — tak powstaje ocena
- przełącznik gęstości („Spacious"), tryb pełnoekranowy, `Esc` zamyka
- pod macierzą liczby zbiorcze osi (1.5 · 4.0 · 2.5 · 2/9)

**Słowa właściciela:** *„tak ma wyglądać macierz. I ona pokazuje i pozwala się poruszać po niej.
(…) Oczywiście to jest strasznie brzydkie, co tutaj masz (…) Cały ten stary ekran to jest jakby
prehistoryczny ekran, ale ta logika pracy jest najłatwiejsza. Zresztą jak zajrzysz do mojej
książki, do załączników, zobaczysz tę samą formułę."*

**Czego to uczy — trzeci raz w tej samej sprawie:**
1. Szukałem komponentu po **geometrii** (obszary × poziomy) i znalazłem `AreaMatrixTable` —
   geometria się zgadzała, ale to była prezentacja raportowa. Właściciel mówił „**narzędzie**".
2. Potem wskazał SIRI jako wzorzec — poszedłem tam i zobaczyłem macierz **transponowaną**
   (poziomy na X), więc znów nie to.
3. Rozstrzygnęły dopiero **jego zrzuty z żywej aplikacji**.

**Wniosek operacyjny:** kiedy właściciel opisuje ekran, który u siebie widzi, **najtańszym ruchem
jest poprosić o zrzut**, a nie szukać po opisie. Trzy podejścia i kilka godzin robotników
zastąpiłby jeden obrazek. Formuła: *„pokaż mi to u siebie"* przed *„poszukam w kodzie"*.

**Drugi wniosek:** macierz **nie była martwa ani pozbawiona wejścia** — była żywa cały czas.
Moje trzy poprzednie znaleziska (`AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`) to
**boczne, martwe warianty tej samej rzeczy**. Szukając „gdzie to jest", trafiałem w kopie,
bo kopii jest w tym repo więcej niż oryginałów.

**Co dalej (kolejność ustalona z właścicielem):** logika pracy zostaje nietknięta — jest,
jego słowami, „najłatwiejsza". Do zmiany jest **wyłącznie warstwa wizualna**, i to formułą
polerowania: audyt stanu zastanego → nazwanie defektów → prototyp → akcept na zrzucie →
budowa 1:1. **Nie przebudowywać 2333 linii w ciemno.**

**Do sprawdzenia:** właściciel wskazał **załączniki swojej książki** (`knowledge/DRD/*.pdf`,
appendix od `extracted_content.txt:455`) jako źródło tej samej formuły — komórki macierzy mają
odpowiadać opisom poziomów per obszar. To pozwala zweryfikować, czy treść komórek w produkcie
zgadza się z metodyką.

### Z-10 · Macierz — WSTRZYMANE przez właściciela, wzorcem jest SIRI
**Co się stało:** wyrenderowałem `AreaMatrixTable` (siatka obszary × poziomy) i pokazałem
właścicielowi. Odpowiedź: *„Stary, to nie tak ma wyglądać. Zatrzymaj się z tą pracą.
To tak nie wygląda macierz. Jak wejdziesz w [SIRI], to sobie znajdziesz."*

Zatrzymałem robotnika w trakcie (schodki + polskie poziomy + ciemny motyw) — **nie zdążył
zmienić ani jednego pliku**, zweryfikowane `git status`.

**Co pokazuje SIRI** (`dev-render/siri-workspace.html`, **wymaga `&view=matrix`** — bez tego
renderuje widok wywiadu): „Macierz na żywo" — wiersze to jednostki oceny, kolumny to poziomy
L0–L5, **komórki są klikalne**, ocena powstaje przez klikanie w siatce. Stan obecny wypełniony,
cel obramowany, po prawej `Current · Target · Gap` na wiersz. Legenda stanów: propozycja AI,
review, blocker, luka dowodowa, nieoceniony.

**Na czym polegała moja pomyłka:** zbudowałem **prezentację do raportu**, a właściciel od
początku mówił o **narzędziu**: *„macierz jest ważna, bo jest narzędziem. To nie jest tylko
prezentacja, to jest narzędzie, które sprawia, że wchodzimy w interakcję."* Miałem to zdanie
zapisane w `MAPA_UWAG_WLASCICIELA.md` (klaster K5) i **i tak zbudowałem prezentację** — bo
szukałem komponentu pasującego do opisu geometrii („obszary na dole, poziomy na Y"), zamiast
do opisu funkcji. Geometria była tylko pół specyfikacji; drugie pół brzmiało „ma być klikalna".

**Co z tego wynika:**
- Wzorzec macierzy DRD = **SIRI**, nie `AreaMatrixTable`. Potwierdzenie kierunku czeka
  na właściciela (zapytany, obiecał wrócić z odpowiedzią).
- **Nic z pracy nad macierzą nie idzie dalej bez tego potwierdzenia.** Zacommitowane zostaje
  jako dowód (ekran harnessu + zrzuty), nie jako kierunek.
- Reguła na przyszłość: **gdy właściciel opisuje rzecz dwoma zdaniami — o wyglądzie i o działaniu
  — dopasowanie do jednego z nich nie jest trafieniem.** Szukaj komponentu spełniającego oba,
  a jak nie ma takiego, powiedz to, zamiast wybierać ładniejszą połowę.

**Nierozstrzygnięte:** czy macierz SIRI ma jedną siatkę dla wszystkich jednostek, a DRD ma mieć
siedem (po jednej na oś) — właściciel mówił o „siedmiu macierzach". Nie zgadywać drugi raz.

### Z-11 · Właściciel nie może się zalogować — odmówiłem ruszania hasła
Zgłosił, że po wczorajszej wymuszonej zmianie hasła nie wpuszcza go do aplikacji. **Nie
resetowałem hasła ani nie ruszałem konta** — to jego dane i jego konto, także w bazie demo.
Zaproponowałem jedyną rzecz, która jest moją robotą: sprawdzenie, czy ścieżka „nie pamiętam
hasła" **w ogóle działa**, bo jeśli nie działa, to defekt dotykający każdego klienta.
Właściciel odłożył temat („wrócę do ciebie z tą informacją") — **zadanie otwarte, do podjęcia,
gdy wskaże środowisko.**

### Z-9 · Prawda o osiach DRD żyła w SZEŚCIU kopiach — trzecie sprostowanie tego samego dnia
**Co się stało:** naprawa liczby poziomów osi w macierzy odsłoniła, że konfiguracja
osi DRD jest w kodzie powielona **sześć razy**. Jedna kopia jest źródłem prawdy
(`src/services/drdStructure.ts`, poprawna), pięć pozostałych to odklejone duplikaty:

| miejsce | błąd | stan |
| --- | --- | --- |
| `src/components/Reports/EmbeddedMatrix.tsx` | kultura i cyber 5 zamiast 6 | **naprawione** — podłączone do źródła |
| `src/components/Reports/RadarChart.tsx` | to samo, idzie do `fullMark` wykresu | w naprawie |
| `src/components/Reports/ImportReportModal.tsx` | to samo, jako `max` pola formularza | w naprawie |
| `server/src/services/reportImportService.ts` | to samo, po stronie serwera | w naprawie |
| `server/src/services/aiAssessmentPartnerService.ts` | **inny kształt** — wymyślone opisy poziomów 6–7 dla osi mających 5 | wstrzymane, decyzja właściciela |
| `src/components/Reports/AxisReportSection.tsx` | `maxLevel = 7` na sztywno dla wszystkich osi | podejrzenie martwego kodu, weryfikowane |

**Dlaczego ważne:** to **trzecie sprostowanie moich własnych słów tego samego dnia**
w tej jednej sprawie. Kolejno mówiłem właścicielowi: (1) macierz ma dwie skale —
nieprawda, ma trzy; (2) kod ma źle — nieprawda, kod ma dobrze w źródle prawdy i źle
w jednym pliku; (3) błąd jest w jednym pliku — nieprawda, kopii jest pięć.

**Domknięcie (późniejsze tego samego wieczoru):** po przemieceniu całego repozytorium
kopii jest **osiem, nie pięć**. Doszły: `server/src/services/reportBuilderService.ts`
(fallback ustawia `maxScore: 7` **na sztywno dla wszystkich siedmiu osi** — błąd działa
w drugą stronę, zawyża zamiast zaniżać, i siedzi na ścieżce produkcyjnej generowania
raportu) oraz osierocony `server/services/ai/aiContext.ts` (bez `/src/` — plik martwy
od kwietnia, zero importerów, żywy bliźniak tego wzorca nie ma).
Naprawione: cztery. Wstrzymane do decyzji: `aiAssessmentPartnerService`. Zgłoszone
i nienaprawione: `reportBuilderService`. Martwe: `AxisReportSection`, `aiContext`.

**Wzorzec do zapamiętania:** za każdym razem myliłem się **w tę samą stronę** —
zawężałem zasięg defektu do tego, co akurat zmierzyłem. Pierwszy pomiar zawsze
pokazuje dolną granicę problemu, nigdy górną. **Nie meldować zasięgu, dopóki nie
przemieciono wszystkich miejsc, gdzie ta sama prawda może mieszkać** — a przy
duplikacji danych domyślną odpowiedzią na „ile jest kopii" jest „więcej, niż widzisz".

**Najgroźniejsza z pięciu:** `aiAssessmentPartnerService` nie ma złej liczby, tylko
**wymyśloną treść** — opisy poziomów 6 i 7 dla osi, które kończą się na 5. Skutek nie
jest wizualny: partner AI może zasugerować konsultantowi poziom dojrzałości, który
w metodyce właściciela nie istnieje. To wykracza poza tor grafiki.

**Co z tego wynika:** naprawą nie jest podmiana liczby, tylko usunięcie drugiej kopii
prawdy. W tym repo defekt załatany per-wywołanie odrósł po ośmiu tygodniach w dwunastu
plikach — dokładnie ten mechanizm.

### Z-8 · Właściciel przekazał dwie zasady pracy
Zlecanie robotnikom z doborem modelu do trudności (Sonnet gdzie wzorzec, Opus gdzie
osąd) oraz dokumentowanie **kontekstu zdarzenia**, nie tylko wyniku. Utrwalone jako
reguły 9 i 10 w `00_ZASADY_PRACY.md`, dosłownymi cytatami. Ten plik powstał w wykonaniu
reguły 10.

### Z-7 · Robotnik omal nie zniszczył pracy innego robotnika — `git stash`
**Co się stało:** robotnik naprawiający ekran predykcji schował zmiany (`git stash`),
żeby zmierzyć stan testów sprzed własnej edycji. Stos stashu jest **wspólny dla całego
repozytorium i wszystkich drzew roboczych** — zabrał więc plik `FilterableTable.tsx`
innego robotnika, który w tym samym momencie na nim pisał. `stash pop` odmówił
(konflikt), cudzy plik trzeba było odtwarzać ręcznie.

**Dlaczego ważne:** skończyło się bez szkody **wyłącznie dlatego, że robotnik to zgłosił
w sekcji „ZGŁASZAM"**. Gdyby przemilczał, strata wyszłaby dopiero u kogoś innego,
prawdopodobnie po czystym pobraniu repozytorium. To dokładnie ta klasa błędu, która
w tym projekcie raz już zepsuła harness (szerokie `git add -A`).

**Co z tego wynika:** reguła nr 8 — zakaz `git stash` u robotników. Stan odniesienia
mierzy się **przed pierwszą edycją albo wcale**; do porównania z HEAD służy
`git show HEAD:<ścieżka>` do osobnego pliku, nigdy ruszanie drzewa roboczego.
Weryfikacja po incydencie: stash pusty, plik 1647 linii, esbuild przechodzi, drugi
robotnik ostrzeżony, żeby sam sprawdził swój diff.

### Z-6 · Znaleziona książka właściciela — i sprostowanie mojej własnej rekomendacji
**Co się stało:** właściciel wskazał, że w repozytorium leży jego książka opisująca
metodykę DRD. Znaleziona: **„Digital Pathfinder", Piotr Wiśniewski PhD**, w `knowledge/DRD/`
(nie w `docs/`, gdzie szukałby każdy). Lektura obaliła to, co **sam przed chwilą
zarekomendowałem właścicielowi**: napisałem mu, że macierz ma dwie skale (5 i 7 poziomów).
Książka opisuje **trzy** — 5, 6 i 7. Kod zna dwie.

**Dlaczego ważne:** dwie osie (kompetencje/kultura, cyberbezpieczeństwo) mają w kodzie
o jeden poziom za mało. Skutek nie jest kosmetyczny — najwyższy poziom dojrzałości
jest w produkcie **nieosiągalny**, a luka do celu liczona wobec złego maksimum.
Gdybym nie sprostował, zbudowalibyśmy macierz kłamiącą w dwóch osiach z siedmiu.

**Trzy rzeczy, które książka rozstrzygnęła same z siebie:**
1. „Rozjazd 34 kontra 39 obszarów", zgłaszany w `DRD_CANON.md` jako defekt kodu,
   **defektem nie jest** — książka opisuje sześć osi (34 obszary), oś AI dopisano później.
   Kod miał rację, dokument techniczny się mylił.
2. Obszar 5A to **„Typ 1–6", nie „Poziom 1–6"** — autor przemianował skalę, bo żaden
   styl przywództwa nie jest lepszy. Macierz nie może malować go gradientem dojrzałości.
3. Nazwa osi 5 w kodzie („Kultura Transformacji") gubi kompetencje, które są połową
   jej zakresu.

**Co z tego wynika:** `DRD_KSIAZKA_KONTRA_KOD.md` + kolejność prac, w której poprawa
skal wyprzedza jakąkolwiek robotę graficzną. Oraz reguła praktyczna: **materiały
źródłowe właściciela leżą w `knowledge/`, nie w `docs/`** — `docs/` to piętro agentów.
Dokument z nagłówkiem `Autor: Claude` nigdy nie jest źródłem.

**Uzupełnienie od właściciela:** książka **nie jest ostatnią wersją** — Cyberbezpieczeństwo
dołożył już w książce, a oś AI dopiero potem; wskazał, że gdzieś przekazał nowszą
dokumentację obu. Poszukiwanie w toku. **Dopóki się nie zamknie, liczby z książki
dla osi 6 i 7 są niepewne** i nie wolno na nich niczego budować.

### Z-5 · Decyzja właściciela: macierz oceny to siedem osi
Na pytanie, którą z **pięciu** znalezionych w kodzie implementacji macierzy robimy tą
jedyną — odpowiedź: *„Tak, 7 osi."* Wybrany `EmbeddedMatrix` (zmienna liczba poziomów
per oś). Cztery pozostałe (~1900 linii) idą do odłożonych; **kod zostaje na miejscu**
zgodnie z regułą nr 5. Zapisane w `MAPA_UWAG_WLASCICIELA.md`, sekcja D-1.

### Z-4 · Właściciel miał rację co do macierzy — istnieje w pięciu wersjach
**Co się stało:** właściciel twierdził, że macierz odpowiedzi „w kodzie istnieje",
choć przejrzał wszystkie karty i nigdzie jej nie znalazł. Pomiar potwierdził: istnieje
w **pięciu niezależnych implementacjach**. Jedna żywa, cztery odcięte.

**Dlaczego ważne:** to **piąty** przypadek tego samego wzorca w tym projekcie — rzecz
zbudowana i pozbawiona wejścia. Poprzednik zanotował cztery takie w jeden dzień.
Zasada „zakładaj, że rzecz istnieje, dopóki nie udowodnisz, że jej nie ma" wygrała
piąty raz z rzędu.

**Najgroźniejszy szczegół:** harness pokazuje macierz (`?screen=assessment-matryca`),
której w aplikacji otworzyć się nie da — bo renderuje wariant martwy w produkcie.
Stanowisko pomiarowe potrafi więc kłamać także **w drugą stronę**: pokazywać jako
działające coś, co dla użytkownika nie istnieje. Do sześciu znanych sposobów kłamania
harnessu dochodzi siódmy.

**Drugi szczegół:** macierz znika z ekranu po zamrożeniu sesji — czyli dokładnie wtedy,
gdy wg metodyki ma wejść do raportu i pokazać następne kroki.

**Sprostowanie dokumentacji:** `PRZEKAZANIE_GRAFIKA.md:188` i `status.json` twierdzą,
że ekran `assessment-matryca` nie jest zarejestrowany w harnessie. **Jest** — od 11:08
tego samego dnia. Dokument przepisał nieaktualną notatkę sześć godzin po fakcie.
Lekcja: **własna dokumentacja starzeje się w godzinach, nie w dniach.**

### Z-3 · Dziewięć ekranów Finansów oceniano w pustym wariancie
**Co się stało:** właściciel oznaczył 10 ekranów Finansów jako do poprawki, przy siedmiu
nie zostawiając ani słowa. Przyczyna: każdy z nich wymaga parametru w adresie
(`&scene=`, `&mode=`, `&step=`, `&state=`), udokumentowanego **wyłącznie w komentarzu
nagłówkowym własnego pliku** — rejestr harnessu ich nie wymienia. Zrzuty zrobiono bez
nich; właściciel dostał puste plansze i karty zajmujące 15% kadru.

**Dlaczego ważne:** jego uwaga *„nic tu nie widać, nic z tego nie można wyciągnąć"*
była **trafna wobec tego, co dostał**, i niesprawiedliwa wobec produktu. Po ponownych
zrzutach z parametrami te same ekrany pokazują pełne tabele z danymi.

**Co z tego wynika:** adresy z kompletem parametrów zapisane; realny defekt graficzny
w tym klastrze był **jeden** (pasek kroków jako gołe słowa) i został naprawiony.

### Z-2 · Siedem uwag „tabela za wąska" było już naprawione — właściciel o tym nie wiedział
**Co się stało:** właściciel siedmiokrotnie zgłosił, że tabela nie jest na pełną
szerokość (10:01–11:44). Poprzednik znalazł przyczynę — sztuczne `maxWidth: 1180`
wpisane w harness, nie w produkt — i usunął ją o **14:15**. Ale **nikt nie zrobił
nowych zrzutów i nikt nie zapalił właścicielowi zielonej karty**, więc dla niego
sprawa wyglądała na otwartą przez resztę dnia.

**Dlaczego ważne:** naprawa bez dowodu nie jest naprawą. Weryfikacja zrzutem
potwierdziła: sejfy i raporty DRD czyste, wiersze w jednej linii. Przy okazji wyszły
**dwa defekty, których nikt nie zgłaszał** — dwa ekrany Oceny w całości po angielsku
i ucinana ostatnia kolumna w tabelach dwóch różnych modułów.

**Co z tego wynika:** po każdej naprawie obowiązkowo nowy zrzut **i** `odbior-poprawka.mjs`.
Oraz: ponowne oglądanie „załatwionych" ekranów opłaca się samo — znajduje defekty,
których nie szukano.

### Z-1 · Rozjazd oczekiwania właściciela z pracą — 2,5 godziny
**Co się stało:** przy przejęciu sesji właściciel powiedział: *„byłem przekonany, że
od dwóch godzin Twój poprzednik to naprawiał"*. Pomiar bazy: z 63 jego uwag ruszonych
było **8**, nietkniętych **55**. Ostatnia jego decyzja — 11:50; przez następne 2,5 h
pracowano nad prawym pasem, kartami N i dyżurami toru funkcji.

**Dlaczego ważne:** praca była wartościowa i częściowo **też** wynikała z jego uwag
(prawy pas w ideach i notatniku) — właściciel sam to sprostował i miał rację, moja
pierwsza ocena była za ostra. Ale rozjazd między tym, czego oczekiwał, a tym, co się
działo, trwał 2,5 godziny i nikt go nie zauważył.

**Co z tego wynika:** `STAN_LISTY_POPRAWEK.md` jako trwały pomiar. Zasada: **lista
właściciela jest torem numer jeden i nie ustępuje niczemu**; praca własna nadzorcy
idzie równolegle robotnikami, nigdy zamiast. I: **licz commity oraz wpisy w bazie
przed każdym meldunkiem** — meldunek „pracujemy nad tym" bez liczby jest bezwartościowy.
