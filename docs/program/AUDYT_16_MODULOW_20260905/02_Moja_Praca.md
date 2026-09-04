# 02. Moja Praca — audyt stanu na 2026-09-05 rano

Staging: `b852ade6` (wdrożony 04.09 23:33, 30 przełączników włączonych). Lokalnie: `http://localhost:3000` (ten sam kod, ten sam backend stagingu).

## Diagnoza w trzech zdaniach

37 ekranów (33 + 4 Agenta), 19 z Twoją uwagą, 5 realnych defektów. Trzy rzeczy, które zgłaszałeś od 28.07 (szczegóły w prawym panelu, dziennik decyzji, przypadek finansowy), były na stagingu WYŁĄCZONE do dziś. Podgląd tabeli Pomysłów zgłaszałeś 3× — dwie naprawy poszły w produkt, defekt był w przyrządzie. Karta decyzji trzyma dane w przeglądarce zamiast na serwerze — otwarte.

## Przełączniki, które decydują o tym, co widzisz

| Co | Zmienna | Stan na stagingu |
|---|---|---|
| Szczegóły elementu w prawym panelu zamiast wielkiego okna (Twoja uwaga 28.07) | `VITE_IDEA_DETAILS_IN_PANEL` | ON od dziś |
| Dziennik decyzji Pomysłu | `VITE_IDEA_DECISION_LOG` | ON od dziś |
| Przypadek finansowy Pomysłu | `VITE_IDEA_FINANCIAL_CASE` | ON od dziś |
| Dwupoziomowe menu Mojej Pracy | `VITE_MYWORK_TWO_LEVEL_NAV` | ON od dziś |
| Powłoka SPEC-A kanw (Process Flow, Whiteboard) | `VITE_VF1_CANVAS_SPECA` | ON od dziś |
| Pochodzenie rekordu w tabeli | `VITE_RECORD_PROVENANCE` | ON od dziś |
| Nowy prawy panel Idei/Notatnika (MW-4) | `VITE_IDEA_NOTEBOOK_RIGHT_PANEL_PROTOTYPE` | OFF — Twoja decyzja DEC-354/384: fala 2 |
| Tabele Mojej Pracy w kanonie StandardTable (zadania, skrzynka) | `—` | ON od 15–16.07, sprawdzone w kodzie dziś |

## A. Zatwierdzone obrazy — 37 ekranów (Twoje decyzje z 30.08–02.09)

Ocena: A = do odbioru, B = do odbioru z wyjątkami, C = nie pokazujemy, D = odłożone. Decyzja: Twoje kliknięcie. Uwaga: Twoje słowa, dosłownie.

| Ekran | Nazwa | Ocena | Decyzja | Twoja uwaga | Obraz |
|---|---|---|---|---|---|
| `agent-plan-canvas` | Warsztat agenta — schemat | A | ok | To jest wielka praca do zrobienia - ten ekran ktory mi pokazujesz niestety nie pokazuje wiele zobac jak jest zrobiony. - tutaj trzeba bardziej wypracować mozliwość pracy jak komponentami klockami które przekładamy i układamy jak flow w N8N - oczywicie to musi być lekko bardziej poważne ale przesuwal | `evidence/grafika/130-noc-czat-agent-spotkania/agent-plan-canvas__PRZED__light.png` |
| `agent-warsztat` | Warsztat agenta — pelny | A | ok | Słuchaj, prokuruję tutaj narzędzia, jak na przykład dodanie, zrównoleglenie procesów. Merytorycznie ten agent jest jeszcze do wypracowania. Na tym poziomie myślę, że graficznie nam to pasuje – naprawdę za małe są te elementy. | `evidence/grafika/130-noc-czat-agent-spotkania/agent-warsztat__PRZED__light.png` |
| `idea-confidentiality-control` | Poufnosc pomyslu | A | ok |  | `evidence/grafika/131-noc-moja-praca/idea-confidentiality-control__PRZED__light.png` |
| `idea-financial-case-persistence` | Case finansowy pomyslu | A | ok | Tak, to nawet nie wiem, co to jest i do czego to przypiąć. | `evidence/grafika/131-noc-moja-praca/idea-financial-case-persistence__PRZED__light.png` |
| `idea-table-timeline-stuck` | Tabela pomyslow — os czasu | A | ok | Tutaj, tak samo jak we wszystkich innych IDEach, wraca kwestia prawego menu. | `evidence/grafika/131-noc-moja-praca/idea-table-timeline-stuck__PRZED__light.png` |
| `idea-table-tool-empty-filter` | Pusty filtr | A | ok | Wiedziałem, że mamy taką tabelę w ogóle. | `evidence/grafika/131-noc-moja-praca/idea-table-tool-empty-filter__PRZED__light.png` |
| `idea-table-tool-grouping` | Grupowanie | A | ok |  | `evidence/grafika/131-noc-moja-praca/idea-table-tool-grouping__PRZED__light.png` |
| `idea-table-tool-kebab` | Kebab wiersza | A | ok |  | `evidence/grafika/131-noc-moja-praca/idea-table-tool-kebab__PRZED__light.png` |
| `idea-table-tool-paste` | Wklejanie | A | ok |  | `evidence/grafika/131-noc-moja-praca/idea-table-tool-paste__PRZED__light.png` |
| `idea-table-tool-sortfilter` | Sortowanie i filtry | A | ok |  | `evidence/grafika/131-noc-moja-praca/idea-table-tool-sortfilter__PRZED__light.png` |
| `idea-templates-catalog` | Katalog szablonow | A | ok | to jest moje marzenie aby to wszytko działało dobrze | `evidence/grafika/131-noc-moja-praca/idea-templates-catalog__PRZED__light.png` |
| `ideas-preview-overlay` | Podgląd pomysłu | A | ok |  | `evidence/grafika/131-noc-moja-praca/ideas-preview-overlay__PRZED__light.png` |
| `ideas-teresa-panel` | Panel Teresy | A | ok | Dobra, przeanalizowałem i teraz tak: cały ten prawy panel jest ewidentnie do przepracowania. Zarówno w ujęciu graficznym, kolejności myśli, jak i merytorsnym, co się tutaj musi wydarzyć. Koniecznie trzeba wrzucić to do backlogu, aby przeanalizować, jak ten panel powinien być zorganizowany, żeby był  | `evidence/grafika/odbior-302-303-20260904/302-flaga-on/ideas-teresa-panel__PO__pl__1440__light.png` |
| `karta-decision` | Karta decyzji | A | ok | Tutaj ważne jest to, że mamy w górnym pasku przycisk „AI”, a później w pasku dalszego arkusza mamy „Analizuj z AI”. Pamiętaj, że to są dwie różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty. | `evidence/grafika/16-dane-demo/karta-decision__PO__light.png` |
| `karta-insight` | Karta wniosku | A | ok | Tutaj problemem jest to. W oknie centralnym mamy trzy kolumny; jest to zaciągnięte. Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu. | `evidence/grafika/131-noc-moja-praca/karta-insight__PRZED__light.png` |
| `karta-notification` | Karta powiadomienia | A | ok |  | `evidence/grafika/131-noc-moja-praca/karta-notification__PRZED__light.png` |
| `mywork-idea-inspector-lekki` | Inspektor pomyslu | A | ok | Nie wiem, nie mam pojęcia, gdzie ten plik, gdzie ten ekran jest, szczerze mówiąc. Domyślam się, że może tak wyglądać, bo jest techniczny, ale nie wiem, do czego służy. | `evidence/grafika/odbior-302-303-20260904/302-flaga-on/mywork-idea-inspector-lekki__PO__pl__1440__light.png` |
| `mywork-notebook-rail-speca` | Panel notatnika | A | ok | Teraz tak: on jest generalnie dużo lepszy niż to, co jest w Idea. Natomiast te dra‑meni, moim zdaniem, powinny wyglądać tak samo, mieć te same elementy albo prawie zbliżone, ale na pewno rządzić się tymi samymi zasadami. Więc jeśli tam zrobiliśmy informację, że idzie to do backlogu i trzeba to konie | `evidence/grafika/odbior-302-303-20260904/302-flaga-on/mywork-notebook-rail-speca__PO__pl__1440__light.png` |
| `notatnik-centrum-mysli` | Centrum mysli | A | ok | To byłoby zajebiste, żeby to tak działało. | `evidence/grafika/odbior-302-303-20260904/302-flaga-on/notatnik-centrum-mysli__PO__pl__1440__light.png` |
| `notatnik-osierocone-graf` | Graf notatek | A | ok | Jak robimy takie nody notatek to moze zrob ja na całym ekranie jedną bo kilka na jedym eraknie nie daje komortu pracy. | `evidence/grafika/131-noc-moja-praca/notatnik-osierocone-graf__PRZED__light.png` |
| `notebook-quick-capture` | Szybkie wrzucanie notatek | A | ok |  | `evidence/grafika/grafika-14-ekranow/notebook-quick-capture__PRZED__light.png` |
| `vault-folder-block-proof` | Blok sejfu w kreatorze | A | ok | I tutaj co do zasady jestem ok z grafiką ale cała funcjonalność agenta powinna być duzo bardziej rozwinieta niz nasz obecny stan tego okna. ale te komponetny nodów są ok | `evidence/grafika/131-noc-moja-praca/vault-folder-block-proof__PRZED__light.png` |
| `vault-safes-table` | Tabela sejfow | A | ok | Ja mam takie wrażenie, że tabela tego SEF‑u jest dziwnie wąska. Nie rozciąga się na całą szerokość tabeli. Pracuj nad tym, żeby wiersze mieściły się w jednej linii, a nie rozkładały się na cztery wiersze – żeby każdy wiersz był jedną linią, jak w tabeli. Układ jest okej, nie?  Tylko mogę uznać to za | `evidence/grafika/20-tabele-szerokosc/vault-safes-table__PRZED__light.png` |
| `vault-sejf-wnetrze` | Wnetrze sejfu | A | ok |  | `evidence/grafika/92-ostatnia-kolumna/vault-sejf-wnetrze__PO__light.png` |
| `zwornik-projects` | Projekty | A | ok | Słuchaj, wiesz co, znowu nie wiem, gdzie to się uruchamia. Natomiast, jeśli mamy przyciski „dodaj i projekt” oraz coś tam drugiego, nie ma pełnej, dobrej nawigacji. | `evidence/grafika/grafika-14-ekranow/zwornik-projects__PRZED__light.png` |
| `agent-hub` | Centrum agentow | B | ok |  | `evidence/grafika/130-noc-czat-agent-spotkania/agent-hub__PRZED__light.png` |
| `decision-record` | Zapis decyzji | B | ok | Tam jest jakiś komentarz – zobacz na tym screenie, że informacje przekazane nie są wysyłane do serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd, nie? Tak, weźmy to pod uwagę, aby oczywiście ta karta była połączona z całym systemem. | `evidence/grafika/131-noc-moja-praca/decision-record__PRZED__light.png` |
| `exec-summary-onelook` | Kokpit menedzera | B | ok |  | `evidence/grafika/15-domkniecie/exec-summary-onelook__PRZED__light.png` |
| `idea-table` | Tabela pomyslow | B | ok | OK - teraz jest ok | `evidence/grafika/131-noc-moja-praca/idea-table__PRZED__light.png` |
| `idea-table-record-templates` | Szablony rekordu | B | ok |  | `evidence/grafika/131-noc-moja-praca/idea-table-record-templates__PRZED__light.png` |
| `karta-task` | Karta zadania | B | ok | ok | `evidence/grafika/16-dane-demo/karta-task__PO__light.png` |
| `mywork-calendar` | Kalendarz (widok bazowy) | B | ok | SUPER | `evidence/grafika/mw-drobiazgi-20260903/mywork-calendar__PRZED__pl__768__light.png` |
| `mywork-idea-topbar` | Pasek gorny | B | ok |  | `evidence/grafika/16-dane-demo/mywork-idea-topbar__PO__light.png` |
| `mywork-inbox` | Skrzynka (Inbox) — zakładka domyślna | B | ok | ok | `evidence/grafika/216-poprawione-dzis/mini-mywork-inbox__PO__light.png` |
| `agent-plan-view` | Uruchom agenta | C | ok |  | `evidence/grafika/130-noc-czat-agent-spotkania/agent-plan-view__PRZED__light.png` |
| `vault-scope-selector` | Skarbiec dokumentow | C | — |  | `evidence/grafika/grafika-14-ekranow/vault-scope-selector__PRZED__light.png` |
| `idea-table-production` | Tabela pomyslow (izolowana) | D | — |  | `evidence/grafika/131-noc-moja-praca/idea-table-production__PRZED__light.png` |

Bez Twojej decyzji (2): `vault-scope-selector`, `idea-table-production`.

## B. Gdzie układ na stagingu może NIE być tym, co zatwierdziłeś — i dlaczego

### B2. Przyrząd pokazał kompozycję, której w produkcie nie ma (audyt przyrządu 01.09)

| Ekran | Kategoria | Co dokładał / zmieniał przyrząd | Ocena, którą dałeś |
|---|---|---|---|
| `idea-table` | Kategoria 1 | `<TopBar>` z `ExecutiveModuleShell` nad tabelą (breadcrumb + „Wróć do pomysłów" + chipy) | **B** |
| `notatnik-osierocone-graf` | Kategoria 1 | ręcznie narysowana prawa kolumna „soczewka Osierocone" (`w-[360px]`) obok realnego `NotebookGraphPanel` | **A** |
| `mywork-notebook-rail-speca` | Kategoria 1 | odwrotnie — montuje szynę BEZ notatnika; 2/3 kadru puste + podpis harnessu | **A** |
| `agent-plan-canvas` | Kategoria 2 | `grid-cols-2 max-w-5xl` → dwa panele po ~560 px | **A** |
| `notebook-quick-capture` | Kategoria 2 | `max-w-[560px]` | **A** |
| `ideas-preview-overlay` | Kategoria 2 | `max-w-[1240px]` | **A** |
| `vault-folder-block-proof` | Kategoria 2 | `max-w-2xl` (672 px) | **A** |
| `notatnik-osierocone-graf` | Kategoria 3 | graf (realny) + soczewka „Osierocone" (atrapa) — dwie różne dostawy w jednym kadrze | **wysokie** |
| `idea-templates-catalog` | Kategoria 4 | własna siatka kart zbudowana z danych `CONSULTING_TEMPLATES` | **A** |
| `agent-plan-view` | Kategoria 4 | `AgentPlanView` — zero importów w `src/`; nagłówek pliku **twierdzi**, że komponent jest wpięty w `AppRoutes.tsx` — to nieprawda w tej gałęzi | C |

### B3. Znane wyjątki zapisane przy ekranach (status.json)

- `notatnik-osierocone-graf`: Na zrzucie w trybie jasnym (light, fullscreen) etykiety sasiednich wezlow sa przyciete na krawedziach modala (np. „DE (6)”, „ne (3)”, „Ekspa[nsja]”) — w trybie ciemnym te same wezly sa w pelni czytelne, wiec to raczej stan zoomu/pan w danym zrzucie niz twardy defekt, ale warto sprawdzic ponownie.
- `karta-notification`: Kolory ostrzezenia i informacji uzywaja surowych wartosci zamiast tokenow — dlug zastany, do zbiorczego sweepu
- `karta-task`: Przycisk PRIMARY „Wyślij do przeglądu” w NModeHeader używa surowych bg-navy-900 / dark:bg-[#F4F7FB] zamiast tokenów c-* (zweryfikowane w DOM, zob. zgłoszenie #14 do toru funkcji).
- `notebook-quick-capture`: PUSTKA ZAMIERZONA: Jedno pole do wrzucenia mysli.
- `vault-sejf-wnetrze`: Kolumna Kategoria po angielsku — dotyka trzech plikow, zgloszone osobno
- `exec-summary-onelook`: Kolumny POZIOM i TYP ucinane na prawej krawedzi — Przetern, Do decy
- `mywork-idea-topbar`: Domyslny widok pokazuje blad ladowania — ograniczenie atrapy harnessu, nie defekt ekranu
- `idea-table-record-templates`: Podwojny komunikat bledu to artefakt trybu deweloperskiego, nie defekt
- `idea-table`: ★ Bramka parytetu 8 z 9 — BRAK PASKA AKCJI MASOWYCH. Zaznaczenie dwoch wierszy nie wywoluje zadnej reakcji. To zmierzona cena zlamania kanonu tabel w tym pliku.
- `idea-table`: ZGLOSZENIE WLASCICIELA 01.09 (niezaadresowane w tej turze): „dalej jest problem — preview z tej tabeli nie jest zgodny ze standardem preview”. Brak dzisiejszej naprawy/zrzutu — zgloszone, nie zrobione.
- `idea-table`: SPROSTOWANIE zgłoszenia z przeglądu: „Whiteboard"/„Process Flow" w kolumnie Narzędzie NIE są defektem — to udokumentowana decyzja właściciela z 2026-07-24 (komentarz w kodzie). Zgłoszenie oparte na moim błędnym założeniu (2026-09-02)
- `decision-record`: Nie otwieralem zwinietych sekcji Komentarze i Zrodla — moga tam byc jeszcze angielskie teksty
- `vault-scope-selector`: Komponent nie ma ani jednego klucza tlumaczen — obudowa w calosci po angielsku, a tytuly dokumentow wpisane przez uzytkownika po polsku. Efekt: jeden ekran, dwa jezyki. To retrofit architektury, nie poprawka koloru
- `idea-table-production`: Narzedzie pomiarowe
- `mywork-inbox`: Powłoka MyWorkHub ma ~87 surowych klas navy-*/slate-* — dług systemowy całego huba, nie tylko tego ekranu.
- `mywork-inbox`: Stan przeczytane/nieprzeczytane NIE istnieje w danych (InboxContent nie zna isRead).
- `mywork-calendar`: SOURCE_COLORS (src/components/MyWork/Calendar/calendarTypes.ts:91-99) hardkoduje crimson hexy (#A51C30, #D42B3D) jako kolory KATEGORII — Pułapka nr 1 (zob. zgłoszenie #13 do toru funkcji).
- `agent-plan-view`: ★ POMIAR 2026-09-01 (naprawa parytetu, Kategoria 4 audytu przyrządu): grep -rn "AgentPlanView" src/ server/src/ → ZERO trafień poza `src/views/AgentPlanView.tsx`. Nagłówek pliku harnessu TWIERDZI, że komponent jest wpięty w AppRoutes.tsx + menuConfig.ts — to NIEPRAWDA w tej gałęzi: `/agent-plan` (Ap
- `agent-plan-view`: MARTWY, ALE FUNKCJA ŻYJE INNĄ DROGĄ (relokacja AGT-003): warsztat agenta użytkownik widzi przez MyWorkHub → AgentHubShell → AgentPlanWorkspace (AgentHubShell.tsx:1700). `AgentPlanView` to osierocona powierzchnia sprzed relokacji — nie ma czego podłączać, jest czego nie pokazywać.
- `agent-plan-view`: NIE POKAZUJEMY — ekranem produktu jest Agent Hub, nie ten wrapper.
- `agent-warsztat`: Nazwy modulow w srodku schematu zostaja po angielsku — swiadoma decyzja: dane zapisane w schemacie nie sa tlumaczone na zywo
- `agent-plan-canvas`: ZGLOSZENIE WLASCICIELA 01.09 (duza praca, poza zakresem tej fali): oczekuje przesuwalnych/ukladalnych klockow (jak flow w N8N) budowanych rowniez przez AI — obecny schemat tego nie robi. Zgloszone, swiadomie nie zrobione w tej turze.
- `agent-hub`: Pierwszy raz widoczny — wymaga wstepnego OK, nie odbioru koncowego
- `agent-hub`: Wyjątek nazwany PRZED spojrzeniem: trzy nagłówki kolumn („ZAPLANOW…NA", „OSTATNIE URUCHOMI…", „CZAS WYKONANIA") i pięć wartości w kolumnie Status („Planow…", „Zaplan…", „Zakońc…", „Nieuda…", „Czeka …") kończą się wielokropkiem — nie mieszczą się w kolumnach. To osobna sprawa, nie ta naprawa.

## C. Funkcje i przejścia, które nie działają albo nie były sprawdzone

### C1. Twoje uwagi z korpusu 103 — 19 w tym module (5 realnych defektów)

| Ekran | Twoje słowa | Data | Klasa | Co zrobiono (poprawki po Twojej uwadze) |
|---|---|---|---|---|
| `decision-record` | „Tam jest jakiś komentarz – zobacz na tym screenie, że informacje przekazane nie są wysyłane do serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd, nie? Tak, weźmy to pod uwagę, aby oczywiście ta karta była połączona z całym sys | 2026-08-30 | DO_NAPRAWY | — |
| `idea-table` | „Tutaj ciagle zobacz Preview nie jest zgodny z wzorem" | 2026-09-01 | DO_NAPRAWY | Podgląd Idei dostał brakujący blok „Szczegóły" — tabelę Właściwość i Wartość. Wcześniej pod jednym zdaniem opisu zostawała pustka. Idea miał // Podglad dostal brakujacy blok Szczegoly — tabele Wlasciwosc i Wartosc (Utworzono, Zmieniono). Dwie rozjechane wersje podgladu (z tabeli i z  |
| `idea-table-timeline-stuck` | „Tutaj, tak samo jak we wszystkich innych IDEach, wraca kwestia prawego menu." | 2026-08-30 | DO_NAPRAWY | — |
| `ideas-teresa-panel` | „Dobra, przeanalizowałem i teraz tak: cały ten prawy panel jest ewidentnie do przepracowania. Zarówno w ujęciu graficznym, kolejności myśli, jak i merytorsnym, co się tutaj musi wydarzyć. Koniecznie trzeba wrzucić to do backlogu, aby przeanalizować, jak ten pa | 2026-08-30 | DO_NAPRAWY | Teresa WYJĘTA z akordeonu do ikony szyny — to jest ta naprawa, o którą prosiłeś. Za flagą, przy wyłączonej nic się nie zmienia. // Prawy panel Idei ma piec sekcji w kolejnosci kanonu: Akcje, Wlasciwosci, Powiazania, Komentarze, Historia — czytane z JEDNEGO zrodla wspolne |
| `mywork-notebook-rail-speca` | „Teraz tak: on jest generalnie dużo lepszy niż to, co jest w Idea. Natomiast te dra‑meni, moim zdaniem, powinny wyglądać tak samo, mieć te same elementy albo prawie zbliżone, ale na pewno rządzić się tymi samymi zasadami. Więc jeśli tam zrobiliśmy informację,  | 2026-08-30 | DO_NAPRAWY | JEDEN WSPÓLNY SYSTEM prawego pasa gotowy jako realny komponent, za flagą wyłączoną. Przy fladze OFF Twój notatnik wygląda identycznie co do  // Oba panele rzadza sie teraz tymi samymi zasadami — identyczna kolejnosc piecu sekcji z jednego zrodla, identyczne naglowki, uczciwe puste st |
| `idea-financial-case-persistence` | „Tak, to nawet nie wiem, co to jest i do czego to przypiąć." | 2026-08-30 | ZROBIONE | — |
| `karta-insight` | „Tutaj problemem jest to. W oknie centralnym mamy trzy kolumny; jest to zaciągnięte. Zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu." | 2026-08-30 | ZROBIONE | Trzy kolumny zamienione na trzy duże wiersze z trzema kolorami — pierwszy dostał niebieski, bo wcześniej był szary. // Trzy duze wiersze w trzech REALNYCH kolorach: niebieski (Odpowiedzi oficjalne), czerwony (Problemy i ryzyka), zielony (Sygnaly i szanse). Cz |
| `mywork-idea-inspector-lekki` | „Nie wiem, nie mam pojęcia, gdzie ten plik, gdzie ten ekran jest, szczerze mówiąc. Domyślam się, że może tak wyglądać, bo jest techniczny, ale nie wiem, do czego służy." | 2026-08-30 | ZROBIONE | — |
| `notatnik-osierocone-graf` | „Jak robimy takie nody notatek to moze zrob ja na całym ekranie jedną bo kilka na jedym eraknie nie daje komortu pracy." | 2026-09-01 | ZROBIONE | — |
| `vault-safes-table` | „Ja mam takie wrażenie, że tabela tego SEF‑u jest dziwnie wąska. Nie rozciąga się na całą szerokość tabeli. Pracuj nad tym, żeby wiersze mieściły się w jednej linii, a nie rozkładały się na cztery wiersze – żeby każdy wiersz był jedną linią, jak w tabeli. Ukła | 2026-08-30 | ZROBIONE | Tabela sejfow na pelna szerokosc, kazdy wiersz w jednej linii — dokladnie tak, jak prosiles. Waska ramka byla wina stanowiska pomiarowego, n |
| `zwornik-projects` | „Słuchaj, wiesz co, znowu nie wiem, gdzie to się uruchamia. Natomiast, jeśli mamy przyciski „dodaj i projekt” oraz coś tam drugiego, nie ma pełnej, dobrej nawigacji." | 2026-08-30 | ZROBIONE | Zakladka Projekty jest w Mojej Pracy, miedzy Decyzjami a Sejfem klienta — sprawdzone klikiem, otwiera realny ekran. Naprawiona tez akcja w p // Ekran pokazuje to, co widzi klient w aplikacji — zdjęte zostały panele i szerokości, których w produkcie nie ma. |
| `idea-table-tool-empty-filter` | „Wiedziałem, że mamy taką tabelę w ogóle." | 2026-08-30 | BACKLOG | — |
| `idea-templates-catalog` | „to jest moje marzenie aby to wszytko działało dobrze" | 2026-09-01 | BACKLOG | — |
| `karta-decision` | „Tutaj ważne jest to, że mamy w górnym pasku przycisk „AI”, a później w pasku dalszego arkusza mamy „Analizuj z AI”. Pamiętaj, że to są dwie różne funkcjonalności. Górny pasek AI dotyczy wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty." | 2026-08-30 | BACKLOG | Sześć sekcji zamiast jednej w wariancie &dane=pelne. Harness podstawiał dane pod inny adres niż wołał komponent. // Komentarze, alternatywy i ryzyka zapisują się teraz NA SERWER — sprawdzone wylogowaniem i powrotem. Baner mówi, co jeszcze zostaje lokalnie. |
| `karta-task` | „OK" | 2026-09-01 | BACKLOG | Dodany wariant z wypełnionymi danymi (adres z &dane=pelne) — zależności z realnym poprzednikiem i następnikiem. Cztery sekcje nadal puste: t |
| `notatnik-centrum-mysli` | „To byłoby zajebiste, żeby to tak działało." | 2026-08-30 | BACKLOG | — |
| `vault-folder-block-proof` | „I tutaj co do zasady jestem ok z grafiką ale cała funcjonalność agenta powinna być duzo bardziej rozwinieta niz nasz obecny stan tego okna. ale te komponetny nodów są ok" | 2026-09-01 | BACKLOG | — |
| `agent-plan-canvas` | „To jest wielka praca do zrobienia - ten ekran ktory mi pokazujesz niestety nie pokazuje wiele zobac jak jest zrobiony. - tutaj trzeba bardziej wypracować mozliwość pracy jak komponentami klockami które przekładamy i układamy jak flow w N8N - oczywicie to musi | 2026-09-01 | BACKLOG | Wszystkie grupy palety startuja ZWINIETE, kazda z licznikiem (MODULY 11, AUTOMATY 6, INTEGRACJE 8) — zamiast sciany jedenastu tych samych ik |
| `agent-warsztat` | „Słuchaj, prokuruję tutaj narzędzia, jak na przykład dodanie, zrównoleglenie procesów. Merytorycznie ten agent jest jeszcze do wypracowania. Na tym poziomie myślę, że graficznie nam to pasuje – naprawdę za małe są te elementy." | 2026-08-30 | BACKLOG | Elementy powiekszone i ZMIERZONE: bylo 121 miejsc z tekstem 11px i 15 z 10px — teraz masa siedzi na 12px, a ikony na 14-17px zamiast 11-13px |

### C3. Bramki odbioru modułu, które NIE są PASS (MODULE_ACCEPTANCE)

```
G15 |`PARTIAL_PASS / RED_LEGACY_2_PLUS_RED_NEW_1`| Odbiór adwersaryjny 03.09 (`ODBIOR_DYZUROW_286_290_291_20260903.md` §1.5, koryguje raport dyżuru 286 — baza `f65c4ff6a0` miała nierozstrzygnięty marker konfliktu w `PreviewAIHintStrip.tsx:110`, więc pliki testowe dotykaj�
   G16 |`TECHNICAL_PACKET_READY / OWNER_RETEST_PENDING`| 2026-09-03 (nadzorca, marker `117bc9f743`): pakiet przed/po tego modułu = `evidence/grafika/a11y-fix-07_MY_WORK_AGENT-20260903.md`, `evidence/grafika/i18n-pl-en-20260903.md`, `evidence/grafika/przewody-odbioru-20260903.md`, `evi
   G19 |`NOT_PROVEN / OWNER_RETEST_PENDING`| Pomiar na markerze zamrożonym `fee24bddb0` (odbiór dyżuru 290 potwierdził niezależnie na własnej bazie — `ODBIOR_DYZUROW_286_290_291_20260903.md` §2). Kotwica: SHA odbioru modułu z wiersza `G18` = `08775ced65` (02.09 17
   G20 |`ENTRY_GATE_MEASURED / BLOCKED_BY_G19_AND_11_P0P1`| Oceniono 7/7 warunków na bazie `2a7273e087`; 0/7 formalnie odhaczone; G19 = `NOT_PROVEN / OWNER_RETEST_PENDING`; P0/P1 = 11 `BLOKUJE` przy mianowniku 121; dowód `evidence/g20/day359/r4-07_MY_WORK_AGENT.md`.
```

### C4. Odłożone do fali 2 Twoją decyzją 03.09 (nie zobaczysz ich jutro i to nie jest defekt)

- `DEC-2026-09-03-354`: Nowy prawy panel Idei/Notatnika (MW-4) (koszt: DUŻE projektowo)
- `DEC-2026-09-03-372` (część): Kanoniczny status licznika konwersji Idei widoczny wszędzie w aplikacji (koszt: DUŻE (nowy status w modelu))
- `DEC-2026-09-03-372` (część): Zmiana nazwy, zakresu i archiwizacja folderów Idei (koszt: ŚREDNIE + migracja bazy)
- `DEC-2026-09-03-373`: Konwersja Idei do Notatki i do Notatnika (front + serwer + baza) (koszt: ŚREDNIE (2–3 dni), zależne pozycje)
- `DEC-2026-09-03-373`: Zakres przycisku „AI Advice” w panelu Idei (koszt: nie do wyceny przed decyzją zakresu)
- `DEC-2026-09-03-374` (część): Historia i pochodzenie treści w Notatniku, rozstrzyganie konfliktów wersji (koszt: DUŻE (nowy model danych; `NotebookContextPanel.tsx` 867 linii bez tej mechaniki))
- `DEC-2026-09-03-374` (część): Zawężanie wyszukiwania w Notatniku po cechach (koszt: ŚREDNIE)
- `DEC-2026-09-03-376`: Pulpit Menedżera liczony z realnej aktywności zespołu zamiast danych zmyślonych (koszt: DUŻE — `ExecutiveDashboard.tsx` 885 linii + nowe liczenie po stronie serwera + p)

## D. Jutro — kolejność przejścia i czego nie zgłaszać (pakiet przelotu)

**Kroki**: otwórz Skrzynkę → kliknij realne powiadomienie → otwórz Idee → kliknij realną ideę →
otwórz Notatnik → sprawdź czy otwiera się w nowym układzie (dwie kolumny: Praca/Kontekst) →
sprawdź pasek zakładek Menu 2 przy węższym oknie (czy chowające się pozycje mają widoczny cień/
strzałkę zamiast być po prostu ucięte).

**Co się zmieniło od 22–23.08**: błąd dostępu do Skrzynki (401/403) ma teraz osobny, jasny
komunikat „Nie masz dostępu do tej skrzynki” — nie miesza się z pustą skrzynką ani ze zwykłym
błędem sieci; Notatnik domyślnie otwiera zaakceptowany widok Praca/Kontekst zamiast starych
trzech zakładek; status „eskalacja” przy decyzjach zapisuje się trwale do bazy (wcześniej znikał
po odświeżeniu strony); dane pokazowe Skrzynki i Kalendarza pokrywają teraz wszystkie stany
(pusty/pełny/błąd).

Prawy panel Idei/Notatnika został podłączony do ścieżki produkcyjnej w `660482d485`, ale jest
za flagą `ff_idea_notebook_right_panel_prototype`, domyślnie OFF; bez decyzji o włączeniu nadal
zobaczysz stary panel i nie jest to defekt (`src/utils/ideaNotebookRightPanelPrototypeFlag.ts:1,27`;
`src/components/MyWork/prototypes/IdeaNotebookRightPanelPrototype.tsx:97`).

**Czego NIE zgłaszaj**: konwersja Idei na Notatkę, zakres
przycisku „AI Advice”, historia wersji w Notatniku, zawężanie wyszukiwania w Notatniku po
cechach, Pulpit Menedżera liczony z realnej aktywności zespołu, funkcja „Tworzy raport” w
doradcy obciążenia — wszystko odłożone do fali 2.

**Pytania (TAK/NIE)**:
- Komunikat braku dostępu do Skrzynki różni się od pustej skrzynki?
- Notatnik otworzył się w układzie dwukolumnowym, nie w starych trzech zakładkach?

---

## Źródła

`docs/program/grafika/status.json`, `ODBIOR_DECYZJE.json`, `odbior.sqlite` (poprawki), `KORPUS_UWAG_20260902.md`, `AUDYT_PRZYRZADU_20260901.md`, `waves/WAVE_03_ACCEPTANCE/AUDYT_PRZEWODOW_ODBIORU_20260903.md`, `modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md`, `PRZELOT_WLASCICIELA_STAGING_20260904.md`, `FALA_2_PO_STAGINGU.md`, pomiar pakietu stagingu 04.09 23:35.
