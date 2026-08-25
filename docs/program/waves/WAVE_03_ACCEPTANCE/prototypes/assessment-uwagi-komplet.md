# Assessment (moduł 04) — komplet uwag właściciela, weryfikacja w kodzie, materiał pod prototyp DRD

Data odzyskania: 2026-08-25
Tryb: **TYLKO-ODCZYT** (nic nie zmieniano w repo ani w gałęziach)
Baza dokumentów: `/private/tmp/consultify-m03-admin`, gałąź `codex/m03-admin-20260824`, HEAD `dbe5b08755`
Baza kodu: ten sam checkout (aktualny kod)

---

## 0. Streszczenie odzyskania

| Miara | Wartość |
| --- | --- |
| Uwagi właściciela ASM-OWN | **28** (ASM-OWN-001 … ASM-OWN-028) |
| Atomowe kryteria akceptacji (AC) | **~200** w 26 tabelach |
| Cytaty Piotra dosłowne (PL) | **19** bloków `> …` |
| Zrzuty dowodowe ASM-EVD | **14** (zahaszowane SHA-256) |
| Zrzuty gate/photo-gate | **10** ASM-G0x + 4 after-integration + 1 a2b500 |
| Dokumenty źródłowe Assessment | 6 w `owner_feedback/04_ASSESSMENT/` + `MODULE_ACCEPTANCE.md` + 5 recenzji eksperckich |
| Ustalenia recenzji eksperckich | **45 findings + 9 defektów → 17 pakietów pracy `ASM-WP-01..17`** (patrz §1.7) |
| Kolizja ID | **TAK** — patrz §1.4 |
| Utrata treści vs gałęzie zachowane | **Brak w rejestrze uwag; JEST w MODULE_ACCEPTANCE** — patrz §1.5 |
| Wiążąca decyzja właściciela | **`DEC-2026-08-24-02`** = `OWNER_ACCEPT` (patrz §1.8) |

**Werdykt materiałowy:** korpus jest kompletny i wyjątkowo dobrze udokumentowany — to
najbogatszy zbiór uwag właściciela w całej fali. Materiał pod prototyp DRD (§4) jest
**wystarczający do narysowania klikalnego prototypu** bez dopytywania Piotra o kształt
ekranów: powłoka, karta poziomu, Matrix, Report i Settings są opisane na poziomie
kontrolek, etykiet PL, kolejności i zakazów, a dawca kodu jest zmapowany co do linii.

**Braki nie dotyczą wyglądu, tylko metodologii i danych.** Jedenaście sprzeczności (§4.7)
pozostaje otwartych; **dwie blokują rysowanie prototypu** (`Cel`/`Target` w Interview,
reguła kumulacji poziomów), a **trzecia blokuje pokazanie Reportu** (`RUN-REC-002`
zabrania seedowania, więc nie ma czym zapełnić rozdziałów).

**Najważniejsze ostrzeżenie techniczne:** flaga `drdMethodWorkspaceSliceV1` jest
**fantomem** — ma `defaultValue: false` i opis „OFF = legacy editor untouched", ale bramka
ją ignoruje, więc powłoka trzech trybów jest **domyślnym runtime**, a dawca
`DRDAssessmentEditor` jest **martwy dla sesji DRD**. Szczegóły w §2.0.

---

## 1. Pełna lista uwag — cytat → źródło → ID

Źródło główne (SSOT uwag):
`/private/tmp/consultify-m03-admin/docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`
(2002 linie, 28 wpisów, intake `2026-08-23`, produkt SHA `ca9ef20646` → później `bcfb01483a`)

### 1.1 Blok A — hub Assessment (ekrany listowe), ASM-OWN-001…007

| ID | Cytat / istota (PL, dosłownie z rejestru) | Linie | Dowód | Priorytet |
| --- | --- | --- | --- | --- |
| **ASM-OWN-001** | „Dobrze, to ma być biblioteka. Tak jak mamy w toolsach biblioteki, to tutaj ma być tylko biblioteka. […] W tym momencie w ogóle nie ma informacji tego typu, więc jakby ten ekran dzisiaj nie spełnił swojego obowiązku w ogóle." | 10–100 | ASM-EVD-001 | P0 |
| **ASM-OWN-002** | „Byłem dołożył tutaj trochę kolumn […] jakiego obszaru one mają dotyczyć, czy jest ona płatna, czy jest niepłatna. […] wszystko, co jest poniżej Twoje kanoniczne sesje, to się tu nie powinno zdarzyć, bo to będzie w ramach procesów […] Tak samo jak w Toolsach." | 102–206 | ASM-EVD-002 | P0 |
| **ASM-OWN-003** | „Wszedłem w te kanoniczne coś. Nie wiem, po co to zostało stworzone. […] Ta karta do niczego nie jest podobna ani nie ma żadnego sensu. […] W mojej ocenie nie jest w ogóle przydatna do niczego." | 207–286 | ASM-EVD-003 | P0 · ODRZUCONE |
| **ASM-OWN-004** | „Dobrze, teraz tabela i menu tutaj oraz menu rozwijane zatwierdzone." | 287–322 | ASM-EVD-004 | **PRESERVE — jedyny AKCEPT wizualny** |
| **ASM-OWN-005** | „Natomiast niestety nie zatwierdzone. […] preview jest niezgodny swoją wielkością z kartami preview, które mamy ustalone. Karta preview jest od góry do dołu ekranu, to znaczy od menu trzeciego do dołu ekranu. To jest wzór, ta karta nie spełnia wzorca." | 323–389 | ASM-EVD-005 | P1 |
| **ASM-OWN-006** | „Słowo output zmieniamy na insights. Pozostają raporty i inicjatywy. Role tych trzech kart jest identyczna jak mieliśmy w toolsach. […] Na bazie zrealizowanych raportów z asesmentów będziemy budowali inputy przez kreator. […] Dokładnie tak jak w każdym innym toolu." | 391–478 | ASM-EVD-006/007/008 | P0 |
| **ASM-OWN-007** | „Teraz dojeżdżamy do miejsca dramatycznego. Mam taką kartę zamiast wybudowanego narzędzia asesmentu. Ja wiem, że ono jest w backendzie. My nad tą kartą siedzimy od bardzo dawna. Ona miała co najmniej ze trzy wersje, z czego ze dwie były naprawdę dobre. Potrzebuję mieć podłączoną tą kartę backendowo […] Najlepiej jakbyś to zrobił teraz." | 480–546 | ASM-EVD-009 | P0 |

### 1.2 Blok B — powłoka sesji i nawigacja narzędzia, ASM-OWN-008…016, 019…021

| ID | Cytat / istota | Linie | Dowód | Priorytet |
| --- | --- | --- | --- | --- |
| **ASM-OWN-008** | „To jest w ogóle dramat, nie? To, co tutaj mamy, jest jakimś mega ciężkim dramatem. Nikt normalny nie przebije się przez taką tabelę. Chociaż może wygląda bardziej profesjonalnie niż moja." | 548–618 | ASM-EVD-010 | P0 · ODRZUCONE |
| **ASM-OWN-009** | „Potrzebujemy formularz odpowiedzi, potrzebujemy mieć matryks […] Formularz to jest po prostu jedno pytanie i możliwe odpowiedzi w danym poziomie. […] te trzy klocki zmienimy na interview split matrix report w czterech klockach." + doprecyzowanie: „twój układ graficzny, to znaczy Twoje czcionki, ramki. To jest wszystko dużo lepsze niż moje. Moje jest cięższe. Natomiast u Ciebie to Interview jest nie do przejścia." | 620–757 | ASM-EVD-011..014 | P0 · **CZĘŚCIOWO ZASTĄPIONE przez 021** |
| **ASM-OWN-010** | „pamiętajmy, że tu operujemy tylko w menu pierwszym. Nie mamy menu drugiego, trzeciego, staramy się odzyskać trochę ekranu." | 759–792 | — | P0 · **częściowo zastąpione przez 014** |
| **ASM-OWN-011** | „Zbudujemy za to do tego menu drugiego tego konkretnego narzędzia. […] Zostawmy to po prawej stronie […] Zrobimy Interview, Workspace, Matrix, Report. Potem może Settings. Tylko Settings zrób jako oddzielny przycisk." | 794–857 | Screenshot 13.08.45 | P0 · **zastąpione przez 021 (Workspace→out)** |
| **ASM-OWN-012** | „Jest sporo jakichś oznaczeń. Nie wiem szczerze, do czego one służą. Wrzućmy wszystkie je na jedną kartę Settings. Zróbmy po prostu kartę Settings pod tytułem »Informacje o dokumencie«. Niech to będzie pierwsza karta Settings." | 859–908 | Screenshot 13.11.26 / 13.11.47 | P0 |
| **ASM-OWN-013** | „Nie wiem, w ogóle nie widzę potrzeby, żeby ona tu była." (o legendzie `Propozycja AI / Review / Blocker / Evidence luka / Nieoceniony`) | 910–945 | Screenshot 13.12.34 | P1 |
| **ASM-OWN-014** | „Mamy ustawiony drugi poziom menu i teraz ustawimy trzeci poziom menu. Trzeci poziom menu będzie się zmieniać w zależności od tego, którą kartę będziemy mieli otwartą." | 947–996 | — | P0 |
| **ASM-OWN-015** | „Musimy elegancko ustawić odstępy między liniami […] Tutaj zrobimy analizę, która będzie analizować opcje AI. Tutaj zrobimy Zapisz. Tutaj zrobimy Szkic, żeby było widać status, czy tam Draft. To zróbmy po prawej stronie, a po lewej stronie będziemy robić przyciski typowe dla danej karty." | 998–1045 | — | P0 |
| **ASM-OWN-016** | „Obecnie mamy taki pierdolnik. On jest nieodczytywalny. W zasadzie z niego nie zostanie prawie że nic. Po prawej stronie Teresa nie jest nam potrzebna, bo mamy oddzielny czat Teresy. Po lewej stronie ta lista jest za duża, żeby dać sobie z nią radę. […] Możemy mieć z lewej strony zwinięte grupy i otworzyć sobie menu pływające dokładnie tej jednej grupy […] Ono nie musi cały czas straszyć." + doprecyzowanie Teresa 13:24 | 1047–1129 | Screenshot 13.15.12 / 13.14.33 / 13.18.08 / 13.18.14 / 13.24.09 | P0 |
| **ASM-OWN-019** | „Mamy informację, tak jak na tym granatowym, czyli ile uzyskaliśmy, ile mamy odpowiedzi na ile pytań, a w samych arkuszach poszczególnych, jaki mamy score na ile […] Informujemy w tabliczkach elegancko. […] Będąc tutaj, zawsze [możemy] wcisnąć Matrix. To powinno przerzucić do całej karty matryksowej danej osi digitalnej." | 1273–1324 | zrzuty granatowe | P0 |
| **ASM-OWN-020** | pełnoszerokościowy pasek osi (`Procesy Cyfrowe`…`Dojrzałość AI`) **nie może** się pojawiać w Level 3 Interview — dubluje lewy nawigator | 1326–1352 | Screenshot 13.25.43 | P1 |
| **ASM-OWN-021** | „Celem Interview jest zebranie aktualnego wywiadu o stanie faktycznym […] Celem Workspace'u będzie ustalenie, co klient by chciał […] Może się też okazać, że klient przegapił któreś, na przykład miał ocenę 1, 2, 5, a nie miał 3, 4 […] Prawdziwym narzędziem do workspace'owego będzie po prostu Matrix. […] Wywalamy ten Split, wywalamy Workspace, będzie Interview, Matrix, Report." | 1354–1436 | Screenshot 13.27.25 | **P0 · DECYZJA NADRZĘDNA** |

### 1.3 Blok C — treść merytoryczna, dawca, governance, raport, ASM-OWN-017, 018, 022…028

| ID | Cytat / istota | Linie | Dowód | Priorytet |
| --- | --- | --- | --- | --- |
| **ASM-OWN-017** | „W repozytorium mamy katalog knowledge, a w nim jest pełna lista pytań dla pełnego audytu DRDF-DBR77. Nie musisz tego wymyślać, więc poszukaj to. […] Każdy jeden z arkuszy pytań musi być bardzo łatwo czytelny. […] Zróbmy tak jak na tym niebieskim ekranie. Czyli po prostu zaznaczamy pole, jaki to jest poziom. Jeśli zaznaczymy dany poziom, to ta karta powinna zmienić kolor […] I później, jak będziemy mieli Matrix, to ten kolor też się tam będzie zmieniał." | 1131–1208 | Screenshot 13.19.36 + QBank v2 (3 pliki, SHA-256 w rejestrze) | P0 |
| **ASM-OWN-018** | karta poziomu progresywna, sterowana dowodem; recenzja 3 sceptyków `9.2/10`; PL CTA `Sprawdź kryteria` → `Kontynuuj ocenę`/`Edytuj ocenę`; **zakaz** angielskich `Tell me more`/`Go deeper`; rozdzielenie werdyktu / wiedzy respondenta / stanu dowodu | 1210–1271 | Screenshot 13.22.05 / 13.23.33 + `ASSESSMENT_LEVEL_CARD_SKEPTICAL_REVIEW_2026-08-23.md` | P0 |
| **ASM-OWN-022** | **DAWCA**: `https://demo.consultify.ai/assessment/drd/1404d2c5-a769-43fd-928d-c487469f36f0?axis=2&area=2A&level=1` (`DEMO @f3237e942304`) → źródło zlokalizowane: `src/components/assessment/drd/DRDAssessmentEditor.tsx`. Decyzje: `Achieved` / `Target` / `Skip`. Donor `Survey`→`Interview`, donor `Preview`→`Matrix`. | 1438–1520 | 5 zrzutów 13.31–13.34 | **P0 · DECYZJA NADRZĘDNA nad 018** |
| **ASM-OWN-023** | Settings: karta **Zespół i dostęp** (kto ma dostęp / kto odpowiada / kto zatwierdza odpowiedzi / kto zatwierdza targety i raport) + karta akceptacji (Piotr powiedział coś brzmiące jak „karta atfekcyjna" — etykieta `TO_CONFIRM`). Bramki: odpowiedzi → targety/Matrix → raport. | 1522–1593 | — | P0 |
| **ASM-OWN-024** | Raport = **ekspercka interpretacja specyficzna dla firmy**, nie zrzut odpowiedzi ani mechaniczne renderowanie Matrixa. „Wyżej" nie znaczy automatycznie „lepiej". Źródło metodyki: `knowledge/DRD/` (8 PDF + `extracted_content.txt`, 2800 linii). | 1595–1671 | — | P0 |
| **ASM-OWN-025** | 7 rozdziałów = 7 osi. Każdy rozdział: wstęp osi (120–180 słów) → macierz osi (wizual eksportowy + podpis 30–60 słów) → komentarz na każdy obszar (110–170 słów, 5-częściowa mikrostruktura) → wnioski osi (180–260 słów) + linia decyzyjna `Rekomendowany kierunek \| Priorytet \| Horyzont \| Warunek powodzenia`. | 1673–1795 | konflikt z `docs/product/DRD_REPORT_SPEC.md` (8 wymiarów) | P0 |
| **ASM-OWN-026** | `Eksportuj PDF` per oś + `Eksportuj wszystko` (7 rozdziałów, spis treści, ciągła paginacja, metadane rewizji, znak wodny `DRAFT`). | 1797–1848 | — | P0 |
| **ASM-OWN-027** | Settings = **5 kart**: `Informacje o dokumencie` · `Subskrypcja i wykorzystanie` · `Zespół i uprawnienia` · `Akceptacje` (etykieta do potwierdzenia) · `Wersje`. Assessment jest narzędziem **płatnym**: miejsca licencyjne, kredyty na generowanie raportu, tryb demo bez trwałego zapisu. | 1850–1926 | — | P0 |
| **ASM-OWN-028** | Komentarze ludzkie zakotwiczone w obiekcie (Matrix: oś/obszar/komórka/AS-IS/TO-BE/luka; Report: rozdział/komentarz obszaru/wizual/wniosek). `AI Analysis` = **sceptyczny recenzent**, zwraca listę propozycji do akceptacji/edycji/odrzucenia, nigdy nie pisze cicho. Powłoka musi być **wielometodyczna** (zakaz hardkodowania 7 osi / `Achieved-Target-Skip` / szablonu raportu DRD). | 1928–2003 | — | P0 |

### 1.4 ⚠ KOLIZJA IDENTYFIKATORÓW — dwa różne zbiory „ASM-OWN-001..003"

To jest **najgroźniejszy defekt rejestracyjny** w tym module.

| Zbiór | Plik | Data przechwycenia | Treść |
| --- | --- | --- | --- |
| **A** (kanoniczny, 28 uwag) | `owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md` | `2026-08-23` | 001=Biblioteka, 002=katalog+Processes, 003=odrzucona karta zamrożona |
| **B** (3 uwagi, inne) | `modules/04_ASSESSMENT/MODULE_ACCEPTANCE.md`, sekcja „Owner UI/UX/CX register", linie 109–111 | `2026-08-22 21:05` | 001=„It's obviously not connected to the back end… absolutely nothing is here" (404 backend), 002=`RECOVERY_DRAFT` full-screen, 003=Outputs `Failed to load Outputs` |

Zbiór **B** to realna, osobna uwaga właściciela z 22.08 (marker `f3237e942304`, checkout `1fce2f0631af`),
**nie jest duplikatem** zbioru A i **nie występuje** w rejestrze uwag. Wymaga renumeracji
(propozycja: `ASM-OWN-B22-001..003` albo `ASM-OWN-029..031`) — inaczej każde odwołanie
„ASM-OWN-002" jest niejednoznaczne.

Dodatkowo `MODULE_ACCEPTANCE.md` G11 (linia 50) twierdzi, że rejestr przechowuje
`ASM-OWN-001–ASM-OWN-009` — **stan przestarzały**, faktycznie 001–028.

### 1.5 Wersje z gałęzi zachowanych vs kandydat

**`OWNER_FEEDBACK_REGISTER.md` — kandydat jest ścisłym nadzbiorem. Nic nie utracono.**

| Gałąź | Linie | Wpisów ASM-OWN | Ocena |
| --- | ---: | ---: | --- |
| HEAD `codex/m03-admin-20260824` | 2002 | **28** | KANON |
| `7c3b559ca8` | 706 | 9 | podzbiór |
| `codex/preserve-chat-to-tools-wip-20260823` | 706 | 9 | identyczny z 7c3b559ca8 |
| `codex/preserve-finaldemo-wip-20260823` | 757 | 9 | czysty podzbiór (0 insercji) |
| `codex/preserve-prod-hotfix-20260824` | 757 | 9 | czysty podzbiór (0 insercji) |

81 „insercji" w gałęziach 706-liniowych to wyłącznie: (a) niesformatowane tabele markdown,
(b) **starsze** statusy `NOT_TESTED` / `CAPTURED_UNRECONCILED` sprzed remediacji.
Kandydat ma statusy nowsze (`PASS_LOCAL_BROWSER`, `PARTIAL_*`). **Zero utraty treści.**

**`MODULE_ACCEPTANCE.md` — TU JEST REALNA UTRATA DOWODÓW.** Kandydat (134 linie) zgubił
fragmenty obecne w gałęziach zachowanych:

| Utracone z | Treść, której nie ma w kandydacie |
| --- | --- |
| `codex/preserve-finance-owner-wip-20260823` | wiersz `ASM-OWNER-01` w innym brzmieniu (`FIXTURE_READY / BROWSER_PENDING`, „two independent HTTP/SQL cold readbacks PASS; UI pending"); G01 z bazą `cfcc606df12dac` i notą „the dirty shared worktree is not a frozen acceptance SHA" |
| `7c3b559ca8` | `Current gate: OWNER_REVIEW_BLOCKED / RUNTIME_BACKEND_CONTRACT_MISMATCH`; G05 z pełnym opisem `ASM-PF-005` i SHA `3d61730fd8ad18d19cf9967cb5513697659003cc`; G11 `CAPTURED_UNRECONCILED` dla uwag z 22.08 |
| `codex/preserve-prod-hotfix-20260824` | G13 `DRAFT_READY_FOR_WORKSHOP` wskazujący na `ASSESSMENT_WORKSHOP_PACKET.md`; **G15 z pełnym pakietem `274/274 PASS` + typecheck + production build + smoke** (kandydat ma tylko `29/29` z węższego zakresu) |

**Rekomendacja:** przy scalaniu przywrócić do `MODULE_ACCEPTANCE.md` sekcję dowodową
`274/274` i historyczny gate `OWNER_REVIEW_BLOCKED`, bo kandydat przedstawia węższy
zakres testów jako aktualny stan.

### 1.6 Duplikaty i supersesje wewnątrz rejestru (jawnie udokumentowane)

| Zależność | Efekt |
| --- | --- |
| `ASM-OWN-021` **zastępuje** 4-trybowy model z `009` i `011` oraz sformułowania w `012`, `013`, `014`, `016`, `019` | `Split` i `Workspace` **nie mogą** być renderowane |
| `ASM-OWN-014` **zastępuje** bezwzględny zakaz trzeciej linii z `010` / `ASM-CHROME-AC-002` / `ASM-LOCALNAV-AC-009` | Level 3 jest dozwolony, ale kontekstowy i kompaktowy |
| `ASM-OWN-022` **zastępuje** projekt nowej karty z `018` | ale **zachowuje** bramki bezpieczeństwa z recenzji 3 sceptyków |
| `ASSESSMENT_WORKSHOP_PACKET.md` — nagłówek supersesji 2026-08-23 13:27 | cały 4-trybowy pakiet = **tylko proweniencja decyzji**, nie kontrakt |
| `ASM-OWN-011` p.4 (`Workspace` zastępuje `Split`) → potem `021` usuwa oba | trzykrotna zmiana nazewnictwa w jednej sesji przeglądu |

### 1.7 Recenzje eksperckie na kandydacie `43730f86f8` — 45 ustaleń poza rejestrem uwag

Katalog: `docs/program/waves/WAVE_03_ACCEPTANCE/evidence/exact-candidate-43730-photo-gate-2026-08-23/assessment/`

| Dokument | Werdykt | Ustalenia |
| --- | --- | ---: |
| `ASSESSMENT_CURRENT_GATE_PACKET_2026-08-23.md` | `NO-GO FOR OWNER ACCEPTANCE` | 9 defektów `ASM-CUR-001..009` |
| `ASSESSMENT_EXPERT_UX_REVIEW_2026-08-23.md` | `NO-GO FOR OWNER ACCEPTANCE` | 13 `ASM-UX-001..013` |
| `ASSESSMENT_EXPERT_METHOD_REVIEW_2026-08-23.md` | `NOT ACCEPTED — NO-GO` | 20 `ASM-METH-001..020` |
| `ASSESSMENT_EXPERT_TECH_REVIEW_2026-08-23.md` | `INCOMPLETE / RELEASE_BLOCKED` | 12 `ASM-TECH-43730-001..012` |
| `ASSESSMENT_EXPERT_REVIEW_CONSOLIDATED_2026-08-23.md` | `NO-GO / RELEASE BLOCKED` | **mianownik: 45 + 9 → 17 `ASM-WP-01..17`** |

⚠ Nagłówek recenzji metodycznej cytuje **inny** hash kandydata
(`43730c271b96bfd45d52af8235aa217b94d2c390`) niż pozostałe cztery
(`43730f86f8a74943c36a58b9ff07aa680a42aa3e`) — prawdopodobna literówka, do sprostowania.

**Ustalenia, których NIE ma w żadnej z 28 uwag właściciela** (do dołożenia do planu):

| ID | Treść | P |
| --- | --- | --- |
| `ASM-METH-006` | **Nieciągłość poziomów**: obszar z poziomami 1, 2, 5 i brakującymi 3, 4 musi oznaczyć lukę i **wymusić rozstrzygnięcie albo świadome odstąpienie z uzasadnieniem przed zatwierdzeniem targetu**. To operacyjne dopełnienie `ASM-OWN-021`. | P0 |
| `ASM-METH-012` | **Preview w Library opisuje PIĘĆ osi, a workspace wystawia SIEDEM** — kupujący dostaje materialnie fałszywy opis produktu. | P1 |
| `ASM-METH-005` | Wartości „current" w Matrixie muszą być **wyprowadzone z zatwierdzonych odpowiedzi Interview**, nigdy drugim źródłem prawdy; edycja targetu nie może mutować current. | P0 |
| `ASM-METH-011` / `ASM-TECH-43730-001` | Powłoka nie może hardkodować 7 osi / 7 poziomów DRD; **druga, strukturalnie różna metodyka syntetyczna musi wyrenderować się przez tę samą powłokę**. | P0 |
| `ASM-METH-010`/`018`, `ASM-TECH-43730-006` | Księga kredytów raportowych: brak licencji = jawnie nietrwałe i bez raportu; kredyt zdejmowany **dokładnie raz** przy sukcesie, nigdy przy błędzie; transakcyjność; zachowanie przy awarii billingu. | P0 |
| `ASM-UX-002` | Lewy nawigator stale rozwinięty ponad gęstość możliwą do skanowania; hierarchia 39 jednostek, ucięte etykiety, powtórzone liczniki. | P0 |
| `ASM-UX-011` + `ASM-METH-015` | Puste stany **przeczą widocznym danym** i oferują konkurencyjne ścieżki tworzenia (`New Report`/`Generate Report`, `New Initiative`/`Initiative Pack`). Wymagana treść: „istnieją 2 assessmenty; 0 kwalifikuje się" + jawna bramka blokująca. | P0 |
| `ASM-UX-013` | **Dostępność i responsywność w ogóle nieudowodnione** — jawny blokr akceptacji; ryzyko: zagnieżdżone wewnętrzne obszary przewijania. | P0 |
| `ASM-UX-008` | Preview pełnej wysokości działa, **ale split nadal ucina kolumnę Progress i dalsze**, wymuszając przewijanie poziome; potrzebne breakpointy i overlay/drawer poniżej progu. Rozszerza `ASM-OWN-005`. | P1 |
| `ASM-UX-009` | **Eksponowanie akcji destrukcyjnej**: `Delete` dostaje duży czerwony przycisk pół-szerokości obok `Duplicate`, podczas gdy `Report`/`Initiative pack` to małe chipy. | P1 |
| `ASM-UX-012` | Semantyka kolorów statusu niespójna między powierzchniami (zielony `Method Core` vs niebieski `Draft` vs bursztynowy pasek Draft vs nieużywane kolory legendy Matrixa). | P1 |
| `ASM-UX-007` | Library pokazuje **filtry cyklu życia procesu** (`Draft/In Review/Awaiting Approval/Approved/Rejected/Archived`) nad katalogiem metodyk. | P1 |
| `ASM-METH-019` | Artefakt zamrożony ma się otwierać jako **czytelne podsumowanie biznesowe z lineage**; `Reopen` tworzy rewizję, a stary snapshot i eksporty pozostają bajtowo identyfikowalne. Rozszerza `ASM-OWN-003`. | P0 |
| `ASM-TECH-43730-002` | Agregat Process nie ma: tytułu dokumentu, zakresu org/site/BU, ocenianej populacji, okresu odniesienia, locale, hasha snapshotu metody, stanu retencji. | P0 |
| `ASM-TECH-43730-004` | **Tożsamość `Output`/`Insight`/`Report` nierozstrzygnięta**: mimo zmiany nazwy nie istnieje agregat `Insight` w Method Core; snapshoty raportu mają `content: unknown`. | P0 |
| `ASM-TECH-43730-007` | `MethodInitiativeDraftService` **nie ma metody rejestracji ani `initiative_id`** — ścieżka wartości kończy się na lokalnym szkicu propozycji. | P0 |
| `ASM-TECH-43730-008` | **Bezpieczeństwo dowodów** (P0): ACL, skan malware, podpisany dostęp, PII/redakcja, rezydencja danych, link rot, retencja/legal hold, wygasanie dowodu; cytat w raporcie musi **fail closed**, gdy dowód niedostępny. | P0 |
| `ASM-TECH-43730-009` | Lineage audytowy **nie jest transakcyjnie kompletny** — awaria może zostawić zamrożenie bez Output albo częściowo zastąpione zbiory downstream; wymaga outbox/saga + wstrzykiwania błędów. | P0 |
| `ASM-TECH-43730-011` | Taksonomia błędów węższa niż cykl życia: brak typowanych kodów dla wygasłego uprawnienia, niezgodności/migracji metody, częściowego raportu, nieaktualnego zatwierdzenia, kolejki offline, awarii billingu/dostawcy, odrzucenia załącznika, wygaśnięcia PDF. | P0 |
| `ASM-TECH-43730-012` | **Ład dowodowy dokładnego kandydata** (P0): checkout HEAD `43730f86` vs cytowany runtime `3d61730`, source `d268800`, fixture `97422d`, baza WIP `ca9ef…`, brudny worktree. **Wcześniejsze zielone testy nie przenoszą się.** | P0 |
| `ASM-UX-006` / `ASM-CUR-001` / `ASM-TECH-43730-010` | Stała kolumna Teresy dubluje asystenta globalnego; obok widoczna jest akcja inline `Zapytaj Teresę`. Korekta: usunąć kolumnę, otwierać globalnego asystenta z kontekstem assessmentu z jednego kontekstowego `Ask AI / Analyze`. Bramka domknięcia wymaga testu interakcji „brak stałego panelu Teresy". | P1 |

### 1.8 Wiążąca decyzja właściciela `DEC-2026-08-24-02`

`docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` — status `OWNER_ACCEPT`
(dzień po oknie przeglądu, ale to **decyzja wiążąca**, cytuje `ASM-OWN-021` i `ASM-OWN-022`):

- tryby `Interview | Matrix | Report`; `Split` usunięty; **`Workspace` nigdy nie wraca**;
- `Settings` osobno;
- mechanika przeniesiona z `DRDAssessmentEditor` / `DRDMatrixSession` **jako dawców**;
- **prototyp wymaga akceptu właściciela PRZED kodowaniem** (`ASM-THREE-AC-008`);
- **test blokujący** przeciw regresji `Split` / `Workspace`.

Powiązane: `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md` (l. ~255–275) odnotowuje
addytywne dopisanie `ASM-OWN-013..028` do rejestru — potwierdza, że kanon to 28 uwag, nie 9.

### 1.9 Konflikt do rozstrzygnięcia: fixture vs zakaz seedowania

`owner_feedback/RECOVERED_OWNER_FEEDBACK_2026-08-22.md:65`, decyzja **`RUN-REC-002`**:

> „Requests to seed Tools, Assessment, Initiatives and Execution were superseded by the
> instruction to use the existing development data." — `SUPERSEDED / DO_NOT_SEED_BY_DEFAULT`

To **stoi w sprzeczności** z `ASM-DOWNSTREAM-AC-008` („populated seeded fixtures cover at
least one full flow"), `ASM-CUR-006`, `ASM-METH-008` i całą Falą 5. Wymaga decyzji Piotra:
czy dowód end-to-end robimy na danych deweloperskich, czy dopuszczamy fixture na czas odbioru.

### 1.10 Sprostowanie: `CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION`

Dokument **nie zawiera** części Assessment. Istnieją dwie wersje:
- 290 linii — blob w `7c3b559ca8d8e8e06566a072b0078d3f9666dfba`;
- 142 linie — bieżąca, `docs/program/waves/WAVE_03_ACCEPTANCE/CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION_2026-08-23.md`.

Obie mają identyczną linię 5: **„Scope is limited to Chat, My Work, Interview and Tools.
Assessment is excluded."** Wyczerpujący grep 290-liniowego blobu po `assessment|ocena|DRD|matryc|ASM-`
zwraca wyłącznie tę linię wykluczającą oraz generyczne użycia słowa „matrix" (macierz uprawnień,
macierz 2×2 w `TOOL-06`). **„290-liniowa część Assessment" nie istnieje** — 290 to liczba linii
całego, jawnie wykluczającego Assessment dokumentu.

### 1.11 Dodatkowe źródła z cytatami PL (poza folderem 04_ASSESSMENT)

| Plik | Zawartość |
| --- | --- |
| `WAVE_03_ACCEPTANCE/NEXT_MODULES_OWNER_REVIEW_READINESS_2026-08-22.md` | Werdykt `NOT_READY / CLIENT_BACKEND_CONTRACT_MISMATCH / OWNER_REVIEW_BLOCKED`. Cytat: „To jest moduł **licencjonowanych Assessmentów** (DRD/DLD, SIRI i kolejne metody), a nie zwykła pusta tabela. Widoczny katalog jest metadanymi renderowanymi po stronie klienta i nie dowodzi połączenia z backendem. […] SIRI i pozostałych metod **nie wolno udawać fixture'em**, jeśli nie mają zatwierdzonej treści licencyjnej." |
| `WAVE_03_ACCEPTANCE/THREE_HOUR_CTO_HANDOFF_2026-08-23.md` | Sekcja „Assessment — stan odbioru". ⚠ **Nosi nieaktualny model 4-trybowy** (`Interview/Split/Matrix/Report`). Pięć otwartych decyzji właściciela: „dokładny kontrakt pojedynczego pytania w `Interview`; zakres edycji w `Split` i `Matrix`; sposób prezentacji targetu i braku dowodu; minimalna zawartość `Report`; czy zatwierdzony układ staje się wspólnym standardem także dla innych assessmentów." Smoke: sesja `8a4eae44-…` (`v1`, `draft`, `0/39`) na `LOCAL @ca9ef2064658`. |
| `WAVE_03_ACCEPTANCE/OWNER_REVIEW_COVERAGE_MATRIX_2026-08-22.md` | Assessment = `ATTEMPT_BLOCKED_TODAY`, „3 owner observations captured at 21:05"; 1/16 modułów zablokowany. |
| `.../exact-candidate-43730-photo-gate-2026-08-23/WAVE_TRI_LOGICAL_CHECKPOINT_2026-08-23.md` | Kanoniczna 7-punktowa lista decyzji właściciela + replay integracyjny 21:23 CEST (`4/4` plików, `29/29` testów) z czterema SHA-256 zrzutów stanu po zmianie. Gate: `TECHNICAL PASS PARTIAL / OWNER ACCEPTANCE REQUIRED / RELEASE NO-GO`. |
| `owner_feedback/CROSS_MODULE/AUTOMATED_BROWSER_SWEEP_2026-08-21.md` | P1: Hub żądał `limit=200`, Method Core odrzuca >100 → poprawione na 100. Testy `AppRoutes.assessment-identity` `1/1`, `AssessmentHub.method-core-cutover` `4/4`. Frozen Output hash `12851515dc5b772a…`. Zrzut: `evidence/2026-08-21_AUTOMATED_SWEEP/05_ASSESSMENT.png`. |
| `modules/03_TOOLS/TOOLS_OWNER_REVIEW_REGISTER.md` | `TLS-OUTPUT-OWN-001`, `TLS-READY-OWN-001` — cytaty PL o zmianie `Outputs`→`Insights` i ekranie „Results & Readiness". **Ta sama decyzja produktowa co `ASM-OWN-006`**, inny moduł. |
| `modules/09_RESULTS/MODULE_ACCEPTANCE.md` | `RES-OWN-001` — runtime Results był **błędnie podpięty do bazy fixture Assessment** `consultify_w3_assessment_owner_finaldemo_bcfb`. Zanieczyszczenie krzyżowe. |
| `CANONICAL_OWNER_FEEDBACK_IMPLEMENTATION_LEDGER_2026-08-24.md` | Cztery wiersze Assessment = `ALREADY_IN_CANDIDATE_SOURCE` (czystość Library, nazwa Insights, wysokość preview, Interview/Matrix/Report + brak belki Teresy); 25 testów Assessment na zamrożonym kandydacie. |

⚠ **`owner_feedback/CROSS_MODULE/` jest praktycznie wolny od Assessment** —
`DECISION_REGISTER.md`, `TRACEABILITY_MATRIX.md`, `ROW_MENU_AUDIT_REGISTER.md`,
`OWNER_CONFIRMATION_SHEET.md`, `FINAL_THREE_MODULE_CONTRACT.md` i oba audyty z 21.08
mają **zero** trafień na `assessment|DRD|ASM-`. W szczególności
**`ROW_MENU_AUDIT_REGISTER.md` nie inwentaryzuje Assessment** („Remaining registered table
surfaces" = `NOT_INVENTORIED`) — to dług pokrycia, a nie brak uwag.

---

## 2. Weryfikacja stanu W KODZIE — per uwaga

Metodyka zgodna ze ZŁOTĄ REGUŁĄ nr 1 z `CLAUDE.md`: sprawdzano **realny kod i realnego
callera**, nie dokumentację ani flagi. Wszystkie ścieżki bezwzględne z
`/private/tmp/consultify-m03-admin/`.

### 2.0 ⚠ FANTOM FLAGI — `drdMethodWorkspaceSliceV1` nie ma żadnego wpływu

To jest ustalenie, które **odwraca wniosek** każdego, kto przeczyta tylko opis flagi.

```
src/hooks/useFeatureFlags.tsx:239,256   → drdMethodWorkspaceSliceV1, defaultValue: FALSE
                                          opis: „OFF = the legacy DRD editor is completely
                                          untouched by this flag's code path"

src/views/AssessmentSessionEditorView.tsx:377-380
    const mountDrdMethodWorkspace = shouldMountDrdMethodWorkspace(
      framework, isEnabled('drdMethodWorkspaceSliceV1')   ← wartość jest OBLICZANA…
    );

src/views/AssessmentSessionEditorView.tsx:115-121
    export function shouldMountDrdMethodWorkspace(
      framework: string | undefined,
      _flagEnabled: boolean                                ← …i NIGDY NIE UŻYWANA
    ): boolean {
      // „The flag is retained in the signature for existing harness compatibility
      //  only; it may no longer select the legacy/local demo writer in production."
      return framework === 'drd';
    }
```

**Skutki:**
1. **Powłoka trzech trybów JEST domyślnym runtime** dla każdej sesji `/assessment/drd/:id`
   z frameworkiem `drd`, mimo `defaultValue: false`. Early-return w `:1751-1759`
   wykonuje się bezwarunkowo.
2. **Dawca `DRDAssessmentEditor` jest MARTWY dla sesji DRD.** Ścieżka legacy
   (`renderEditor()` → `DRDForm` / `DRDAssessmentEditor` / `DRDMatrixSession`, l. 1828–1871)
   jest osiągalna **wyłącznie dla frameworków innych niż DRD**.
3. **Komentarze w kodzie kłamią.** `AssessmentSessionEditorView.tsx:1787-1791` twierdzi:
   „flag-gated DRD vertical slice. OFF (default) leaves every line below completely
   untouched". To było prawdą, gdy komentarz powstawał; dziś nie jest.
4. Opis flagi w `useFeatureFlags.tsx` mówi też, że slice działa na `DrdSessionRuntime`
   (przeglądarkowy mirror), „NOT yet wired over HTTP" — a montaż w `:1753` przekazuje
   **`forceHttpSourceOfTruth`**. Opis flagi jest zdezaktualizowany w drugą stronę.

To dokładnie wzorzec „FANTOM" z `CLAUDE.md` (`ENABLE_TERESA_NOTE_CREATE` = 0 kodu),
tyle że odwrócony: flaga istnieje, ma opis, jest odczytywana — i nic nie robi.
**Do zgłoszenia jako osobna poprawka higieniczna** (usunąć martwy parametr, poprawić
komentarze i opis flagi, albo przywrócić bramkowanie).

`assessmentFiveSurfacesV1` (`:198,221`) ma `defaultValue: true` i **działa** — pięć zakładek
Huba jest żywe; ścieżka OFF nadal zwraca stare 3 zakładki (`AssessmentHub.tsx:761-782`).

### 2.1 Kluczowe pliki runtime (zweryfikowane bezpośrednio)

| Plik | Linie | Rola |
| --- | ---: | --- |
| `src/components/method-workspace/MethodWorkspaceShell.tsx` | 431 | powłoka sesji (nagłówek, Settings, tryby) |
| `src/components/method-workspace/types.ts` | — | `MethodWorkspaceViewMode = 'interview' \| 'matrix' \| 'report'` (l. 52) |
| `src/components/method-workspace/InterviewFocusPanel.tsx` | 363 | ekran wywiadu (pytanie-centryczny) |
| `src/components/method-workspace/MethodNavigator.tsx` | 186 | lewy nawigator (kompaktowy od `a2b500caca`) |
| `src/components/method-workspace/LiveMatrix.tsx` | 297 | macierz |
| `src/components/method-workspace/AnswerStateControl.tsx` | 136 | 6 płaskich stanów odpowiedzi |
| `src/components/method-workspace/TeresaPreviewPanel.tsx` | — | **istnieje, ale NIE jest montowany** |
| `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx` | ~850 | kanoniczny ekran HTTP DRD |
| `src/components/assessment/drd/DRDAssessmentEditor.tsx` | **2333** | **DAWCA** (ASM-OWN-022) — nieosiągalny dla sesji kanonicznych |
| `src/components/assessment/drd/DRDMatrixSession.tsx` | 313 | dawca macierzy |
| `src/components/MaturityMatrix.tsx` | 352 | macierz Piotra |
| `src/components/assessment/drd/drdAnswersAdapter.ts` | 124 | adapter legacy `answers.drd.areas` |
| `src/method-core/methods/drd/compileDrdPack.ts` | — | kompilacja QBank v2 → pack runtime |

### 2.2 Tabela weryfikacji

| ID | Stan | Dowód w kodzie (plik:linia) / uzasadnienie |
| --- | --- | --- |
| **ASM-OWN-001** Biblioteka czysta | **CZĘŚCIOWE** | ✅ „Twoje kanoniczne sesje DRD" — **zero trafień w `src/` i `server/`**; fraza żyje tylko w rejestrze uwag (l. 48, 117, 139) jako opis żądania usunięcia. ✅ Preview zadokowany pełnej wysokości: `src/components/assessment/library/AssessmentLibraryTab.tsx:367` (`flex h-full min-w-0 overflow-hidden`), aside `:407` (`w-[400px] shrink-0`), `StandardPreview` `:413`. ✅ Kanon triady: `StandardTable` + `StandardPreview` (`:30, 391, 413`), `StandardModuleBar` na poziomie huba (`AssessmentHub.tsx:87, 2537`). ❌ Brak pełnego dokumentu wiedzy metodyki (`ASM-LIB-AC-004` = `PARTIAL_BROWSER_PASS`). ⚠ **`ASM-METH-012`: preview opisuje 5 osi, workspace ma 7** — fałszywy opis produktu. ⚠ **`ASM-UX-007`: filtry cyklu życia procesu nad katalogiem metodyk.** |
| **ASM-OWN-002** katalog + start→Processes | **CZĘŚCIOWE** | ✅ Kolumna `Area`: `AssessmentLibraryTab.tsx:283` (`isPolish ? 'Obszar' : 'Area'`). ✅ Start per wiersz: `:300-332` (`Uruchom`/`Start`) + w kebabie `:350-357`. ✅ Pięć zakładek: `AssessmentHub.tsx:760-825` — `library`(:788) · `processes`(:795) · `outputs`(:802) · `reports`(:809) · `initiatives`(:815). ❌ **Kolumna płatna/niepłatna brak** (`ASM-START-AC-001` = `PARTIAL_AREA_ONLY`). Ścieżka wierszowa udowodniona lokalnie (sesja `8a4eae44-…`, `v1`, `draft`, `0/39`). ❌ Globalne CTA „Assessment" nieudowodnione. Cold-login, anulowanie i błąd startu nieprzetestowane. |
| **ASM-OWN-003** odrzucenie karty zamrożonej | **NIEZROBIONE** | Wszystkie 6 AC = `OWNER_DECISION_REQUIRED` / `NOT_TESTED`. Ścieżka zamrożona nadal renderuje powierzchnię techniczną (`ASM-TOOL-AC-002` = `FAILED_AS_OBSERVED`). Brak zdefiniowanego zadania użytkownika dla ekranu zamrożonego. |
| **ASM-OWN-004** tabela Processes | **ZROBIONE (akcept właściciela)** | Jedyny wpis `OWNER_APPROVED_AS_OBSERVED`. Wymaga wyłącznie ochrony przed regresją przy pracach nad Preview. Sortowanie/filtry/kebab **nietestowane** (`ASM-PROCESS-LIST-AC-003`). |
| **ASM-OWN-005** Preview pełnej wysokości | **ZROBIONE (technicznie) / retest właściciela** | Przyczyna: zerwany łańcuch wysokości — `flex-1` w niefleksowym rodzicu wewnątrz hosta `StandardModuleBar`; naprawa `h-full min-h-0 overflow-hidden`. Odczyt `1280×720`: `y=153→720`, aside `567px`, brak luki (przed: `709px`, koniec `y=862`). Potwierdzone w kodzie: `AssessmentHub.tsx:2562` (`h-full min-h-0 overflow-hidden space-y-3`) jako dziecko `StandardModuleBar` (otwarcie `:2537`, zamknięcie `:2592`); host `StandardModuleBar.tsx:518` (`flex-1 min-h-0 overflow-auto`); Processes `AssessmentHub.tsx:2093` + aside `w-[400px]`. ⚠ **Test `tests/components/assessment/AssessmentHub.previewHeight.ownerFeedback.test.tsx` to asercja NA STRINGU ŹRÓDŁA** (`readFileSync`, `:9-12`; porównanie dokładnej klasy `:15`, layout Processes `:23-30`) — **nie mierzy wysokości w DOM**. Chroni przed przypadkowym usunięciem klasy, nie przed regresją wizualną. ⚠ `ASM-UX-008`: split nadal ucina kolumnę `Progress` i wymusza przewijanie poziome. Przewijanie wewnątrz panelu i pełna matryca viewportów **nietestowane**. |
| **ASM-OWN-006** Insights/Reports/Initiatives | **CZĘŚCIOWE + DEFEKT ARCHITEKTURY** | ✅ Rename wykonany w warstwie użytkownika: `AssessmentHub.tsx:804` (`label: 'Insights'`), komentarz `:800-803` (id zostaje `outputs` w kontrakcie API/route), `AssessmentOutputsTab.tsx:307, 342`. Commit `1885ea5cde` usunął zdublowany wewnętrzny pasek. ❌ **`ASM-TECH-43730-004`: agregat `Insight` NIE ISTNIEJE w Method Core** mimo zmiany nazwy — snapshoty raportu mają `content: unknown`. Tożsamość `Output`/`Insight`/`Report` nierozstrzygnięta. ❌ **`ASM-TECH-43730-007`: `MethodInitiativeDraftService` nie ma metody rejestracji ani `initiative_id`** — ścieżka wartości kończy się na lokalnym szkicu. ❌ `ASM-UX-011`: puste stany przeczą danym i mają konkurencyjne CTA. Wszystkie 9 AC poza rename = `NOT_TESTED`. |
| **ASM-OWN-007** narzędzie podłączone backendowo | **ZROBIONE dla sesji aktywnej / NIEZROBIONE dla zamrożonej** | Sesja aktywna `ec7dfcca-…` renderuje 7 osi / 39 jednostek z serwera (`ASM-TOOL-AC-001` = `LIVE_VERIFIED`). Sesja zamrożona nadal podmienia narzędzie na diagnostykę (`ASM-TOOL-AC-002` = `FAILED_AS_OBSERVED`). |
| **ASM-OWN-008** przeciążenie ekranu | **CZĘŚCIOWE** | Poprawione: brak stałej belki Teresy, jedno aktywne pytanie, kompaktowy nawigator. **Nie rozwiązane**: architektura zadania nadal pytanie-centryczna zamiast karta-poziomu-centrycznej; wszystkie 7 AC `ASM-USABILITY-*` poza `-005` = `NOT_TESTED`; brak testu z użytkownikiem pierwszego kontaktu. |
| **ASM-OWN-009** 4 tryby | **NIEAKTUALNE (zastąpione przez 021)** | Zachować jako proweniencję. Aktywne kryteria `ASM-MODES-AC-001..010` **muszą zostać oznaczone jako superseded** — inaczej `ASM-MODES-AC-001` („dokładnie cztery tryby") stoi w sprzeczności z `ASM-THREE-AC-001` („dokładnie trzy"). Wskazane wprost w audycie eksperckim §2 p.7. |
| **ASM-OWN-010** tylko menu pierwsze w sesji | **ZROBIONE** | `MethodWorkspaceShell.tsx:222–228` — powłoka renderuje własny `<header>`, brak `StandardModuleBar` wewnątrz sesji. Route sesji DRD nie montuje paska modułowego. |
| **ASM-OWN-011** kompaktowy pasek narzędzia po prawej | **CZĘŚCIOWE / NIEZGODNE Z UKŁADEM** | Trzy przełączniki `Interview \| Matrix \| Report` istnieją: `MethodWorkspaceShell.tsx:106–110` + `385–402`, `role="tablist"`, `data-testid="view-mode-*"`. **ALE** nie są w nagłówku (Level 2) tylko w **osobnym wierszu poniżej**. Nagłówek zawiera: `Wyjdź` + nazwa sesji (l. 229–243 ✅ `ASM-LOCALNAV-AC-008`), status, save, `Zapisz teraz`, `Settings` (l. 268–277 ✅ oddzielny przycisk), kebab. `Split`/`Workspace` **nie renderowane** ✅ `ASM-LOCALNAV-AC-003`. Ostrzeżenie przed utratą szkicu przy zmianie trybu — **brak** (`ASM-LOCALNAV-AC-006`). |
| **ASM-OWN-012** `Informacje o dokumencie` jako 1. karta | **CZĘŚCIOWE** | `MethodWorkspaceShell.tsx:328–366` — sekcja Settings, pierwsza karta = `Informacje o dokumencie` ✅ (l. 335). Zawiera: pełne ID sesji, metodę+wersję pack, wersję sesji, źródło, stan zapisu, pokrycie dowodowe, do przeglądu, blokery zamrożenia — **wszystkie 8 wymaganych pozycji obecne** ✅ `ASM-DOCINFO-AC-004`. **Ale**: etykiety pozostały surowe (`Zapis: {saveState}` renderuje wartość techniczną gdy ≠ SAVED) → `ASM-DOCINFO-AC-005` niespełnione; brak krótkich objaśnień. Settings to **rozwijany pasek 4-kolumnowy w nagłówku**, nie osobna powierzchnia kart. |
| **ASM-OWN-013** usunięcie globalnej legendy | **CZĘŚCIOWE** | Globalny pasek legendy w chrome powłoki — **usunięty** ✅. **Ale** legenda nadal renderowana wewnątrz macierzy: `LiveMatrix.tsx:180–193` (5 pozycji), z propem `legendCollapsed`. Zgodne z duchem („stan przy obiekcie, który go używa"), niezgodne z literą `ASM-LEGEND-AC-001` („żaden z czterech trybów"). **WYMAGA_DECYZJI** właściciela. |
| **ASM-OWN-014** kontekstowa 3. linia per tryb | **NIEZROBIONE** | `MethodWorkspaceShell.tsx:380–403` — jest jeden wiersz, ale **statyczny**: lewa strona = licznik `X/Y jednostek odpowiedzianych`, prawa = przełącznik trybów. Nie zmienia się per tryb, nie zawiera kontrolek trybu. Wszystkie `ASM-CONTEXT-AC-001..006` = niespełnione. |
| **ASM-OWN-015** architektura lewa/prawa Level 3 | **NIEZROBIONE** | **Brak wejścia `AI Analysis` w całym kodzie Assessment.** `Zapisz teraz` i status `Szkic` (l. 185–196, 245–266) są w nagłówku (Level 2), nie w prawej strefie Level 3. Lewa strefa mode-specific — nie istnieje. `ASM-TOOLBAR-AC-003/006` = niespełnione. |
| **ASM-OWN-016** dwustopniowy nawigator + usunięcie Teresy | **CZĘŚCIOWE** | ✅ **Teresa: `TeresaPreviewPanel` NIE jest montowany** — grep pokazuje wyłącznie import typu (`MethodWorkspaceShell.tsx:45`), martwy prop `teresaProps` (l. 66) i re-eksport w `index.ts:32`. Zero renderu. `ASM-INTNAV-AC-001/009` = spełnione. ✅ Kompaktowy nawigator: `a2b500caca` (`MethodNavigator.tsx`, test `MethodNavigator.ownerBehavior.test.tsx`, `24/24 PASS`), dowód `evidence/exact-candidate-a2b500-assessment-2026-08-23/`. ⚠ **Ale to jeden panel ze zwijanymi grupami, nie dwa panele** — `MethodWorkspaceShell.tsx:408–410` renderuje jedną kolumnę `w-60`, ukrytą poniżej `lg`. `ASM-INTNAV-AC-002/003` (pierwszy panel grup + drugi panel jednostek) = **niespełnione literalnie**. ⚠ `InterviewFocusPanel` nadal ma `onAskTeresa` (l. 36, 64) → punkt wejścia asystenta wewnątrz Assessment. |
| **ASM-OWN-017** karty poziomów z QBank + kolor | **NIEZROBIONE (kształt) / CZĘŚCIOWE (źródło)** | ⚠ **QBank NIE jest ładowany w runtime.** Pliki `.md` istnieją (6: `.pl` i `.en` × 3 osie w `knowledge/tool-kb/drd/qbank/v2/`), ale **żaden kod ich nie parsuje** — brak `fs.readFile`, importu markdown i fetcha tych ścieżek w `src/`, `server/src/`, `scripts/`. `compileDrdPack.ts:309, 316, 323` używa ścieżek **wyłącznie jako `locator` w metadanych proweniencji `MethodSourceRef`**; `:261` emituje `sourceRefs: ['qbank-v2:…:level:n']` jako **tekst**. Nagłówek `:11-12` mówi wprost: treść jest *„already transcribed into runtime TS — we read it, we do NOT re-parse the markdown"*. **Realne źródło treści runtime**: `src/services/drdStructure.ts` (2191 l., 7 osi: `:44, 499, 698, 897, 1156, 1363, 1564`) + `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis1And2.ts` (1105 l.), `…Axis3And4.ts` (1032), `…Axis5To7.ts` (1298) + bliźniaki `.en.ts`, importowane w `compileDrdPack.ts:33-45`. **Wniosek: pliki `.md` są dokumentacją nieaktywną.** `ASM-QBANK-AC-001/002` (7/39/233/699) wymaga **testu parytetu TS↔markdown**, którego nie ma. ❌ **Brak kart poziomów**: `InterviewFocusPanel.tsx` jest pytanie-centryczny (`questions`, `questionIndex`, `questionTotal`, l. 23–26), nie `area × level`. Brak zaznaczania poziomu, brak zmiany koloru karty, brak sprzężenia koloru z Matrixem. |
| **ASM-OWN-018** progresywna karta sterowana dowodem | **NIEZROBIONE** | ❌ **`AnswerStateControl.tsx:31–36` to dokładnie ten płaski 6-opcyjny zestaw, który recenzja odrzuciła** (`Potwierdzone` / `Częściowo` / `Nie` / `Nie wiem` / `Nie mam dowodu` / `Nie dotyczy`). Wymagane rozdzielenie na 3 wymiary (werdykt / wiedza respondenta / stan dowodu) — **nie zaimplementowane**. Brak CTA `Sprawdź kryteria`. Brak inline full-width panelu oceny. `ASM-DEEP-AC-001..010` = niespełnione. |
| **ASM-OWN-019** progres hierarchiczny + deep-link do Matrixa | **CZĘŚCIOWE** | Licznik globalny `readiness.answeredUnits/totalUnits` w wierszu kontekstu (`MethodWorkspaceShell.tsx:382`). Progres per oś/obszar w nawigatorze — dodany w `a2b500caca` (do potwierdzenia zakres). ❌ **Brak deep-linku Interview→Matrix z zachowaniem aktywnej osi**: przełącznik trybu (l. 393) tylko ustawia `viewMode` + `localStorage`, nie przenosi tożsamości osi. `ASM-PROGRESS-AC-004/006` = niespełnione. |
| **ASM-OWN-020** brak dublowania osi w Level 3 | **ZROBIONE** | `MethodWorkspaceShell.tsx:380–403` — Level 3 nie zawiera listy osi; osie wyłącznie w `MethodNavigator`. |
| **ASM-OWN-021** trzy tryby Interview\|Matrix\|Report | **ZROBIONE** | `types.ts:52` — `'interview' \| 'matrix' \| 'report'`. `MethodWorkspaceShell.tsx:106–110` — dokładnie 3 opcje w tej kolejności. `:99` — parser localStorage akceptuje tylko te trzy. `Split`/`Workspace` niereprezentowane nigdzie. `Settings` = osobny przycisk (l. 268–277), nie czwarty tryb ✅ `ASM-THREE-AC-001/007`. ⚠ `ASM-THREE-AC-003/004` **naruszone** — patrz następny wiersz. |
| **ASM-OWN-021** rozdział AS-IS / TO-BE (ASM-THREE-AC-003/004) | **BACKEND ZROBIONY / FRONT DEFEKT** | ✅ **Serwer utrwala TO-BE osobno**: `server/src/method-core/outputs/EventDerivedOutputBridge.ts:103-105` kubełkuje `subject === 'target_level'` do `bucket.targetLevel`, oddzielnie od current; luka liczona `:123`; osobna kolumna DB `target_level` w `MethodOutputService.ts:211, 448, 461, 486`, typ `:47, 104`. ❌ **Front liczy `current` po swojemu**: `LiveMatrix.tsx:67-72` `rowSummary()` → `current = Math.max(...achievedLevels)`, komentarz l. 62–65: „no separate source of truth", „`current` is the top of the confirmed ramp". To **druga prawda kliencka** i **kumulatywna rampa**, której uwaga zabrania (`ASM-THREE-AC-004`, `ASM-METH-005`, `ASM-METH-006`). ❌ Brak utrwalonych „wybranych kroków transformacji" (`ASM-THREE-AC-003/005`). |
| **ASM-OWN-022** dawca DRDAssessmentEditor | **ŹRÓDŁO ZLOKALIZOWANE / MARTWE DLA DRD** | ✅ Dawca istnieje: `DRDAssessmentEditor.tsx`, **2333 linie**, ma wszystko czego wymaga uwaga: decyzje **`Achieved` `:1846-1873`** (→`setAchieved` `:483`) · **`Target` `:1875-1902`** (→`setTargetLevel` `:539`) · **`Skip` `:1904-1931`** (→`levelDecisions[lvl]='skip'`), wzajemnie wykluczające się (handlery czyszczą pozostałe: `:1858-1863`, `:1887-1892`, `:1915-1921`). Karta poziomu: opis `:1511, 1559, 1216-1222` · przykład `:1525, 1228-1234` · **wyjaśnienie trzech decyzji `:1573-1589`** · pytania `:1602-1613`, render `:1663-1674` („Validation questions") · komentarz `:1617-1626`, render `:1742` · załącznik `:1631-1643`, render `:1758` · link `:1647-1658`, render `:1771-1805` · **`Previous`/`Next` `:1937-1955`** · maszyna paneli `:156`. Pełny ekran macierzy: `:150, 331-339, 756-760` (`Maximize2`, Esc). AS-IS/TO-BE: legenda `:734, 738`, klasy komórek `:807-808, 833-835`, tooltip `:1076`, popup `:1203` (`AS-IS (Achieved)`), **`:1322` `Achieved` / `Set AS-IS`**, agregat `Avg. Target Level` `:1005-1008`. ❌ **MARTWY dla sesji DRD** — `AssessmentSessionEditorView.tsx:1751-1759` zwraca `DrdMethodWorkspaceScreen` **bezwarunkowo** dla `framework === 'drd'` (patrz §2.0). Dawca renderuje się wyłącznie dla frameworków innych niż DRD (`:1828-1871`). ⚠ **Dawca ma defekt kumulacji**: `nextAchieved = Math.max(current, lvl)` `:486`, `isAchieved = level <= achieved` `:807`. |
| **ASM-OWN-023** zespół, uprawnienia, 3 bramki | **BACKEND CZĘŚCIOWY / FRONT POZOROWANY** | ✅ **Ścieżka zatwierdzeń ISTNIEJE na serwerze**: `server/src/method-core/MethodSessionService.ts:550-583` `recordApproval()` → tabela **`method_approvals`** (`:569`); `getApprovals()` `:589-603`; typ `MethodApproval` `:150-156` z `decision: 'approved' \| 'sent_back'` i obowiązkowym komentarzem przy odesłaniu. Trasy: `POST /sessions/:id/approvals` (`method-core.routes.ts:995`), `GET` `:1072`, wymuszenie komentarza `:1016-1017`. ⚠ **Ale to JEDNA generyczna bramka sesyjna, nie trzy nazwane etapy.** Rozróżnienie żyje w `DecisionEventPayload.subject`: `'current_level' \| 'target_level' \| 'freeze' \| 'output_approval'` (`contracts/events.ts:177`). Zatwierdzenie odpowiedzi ≈ `current_level`, targetu ≈ `target_level`, **raportu — brak takiego subjectu** (najbliżej `output_approval`). ❌ **Front nic z tego nie czyta**: `MethodWorkspaceShell.tsx:353-358` karta „Zatwierdzenia" **wyprowadza etykiety z `session.state`**, nie z `method_approvals`. `:348-352` „Zespół i uprawnienia" pokazuje tylko `Tryb pracy` i `Tylko odczyt / Edycja dozwolona` — **żadnych ról ani osób**. ⚠ Etykieta w kodzie to **`Zatwierdzenia`, nie `Akceptacje`** — nazwa nadal `TO_CONFIRM` u właściciela. |
| **ASM-OWN-024** raport jako interpretacja ekspercka | **NIEZROBIONE (uczciwie)** | `DrdHttpMethodWorkspaceScreen.tsx:822–834` — karty obszarów renderują wyłącznie „Potwierdzone poziomy: … Wymaga komentarza eksperckiego przed zatwierdzeniem." lub **„Brak potwierdzonej oceny — raport nie może udawać wniosku dla tego obszaru."**. To **prawidłowy placeholder** (nie fabrykuje wniosków), ale zero interpretacji eksperckiej. Brak wiązania z `knowledge/DRD/`. |
| **ASM-OWN-025** 7 rozdziałów osi + szablon tekstowy | **CZĘŚCIOWE (szkielet) / NIEZROBIONE (treść)** | `DrdHttpMethodWorkspaceScreen.tsx:791–836` (i `DrdMethodWorkspaceScreen.tsx:567-590`) — tryb Report renderuje **bespoke JSX**, jeden rozdział dla `activeAxis`, w wymaganej kolejności: wstęp (l. 793–800) → macierz osi (l. 801–821) → karty obszarów (l. 822–834). ❌ **Brak 7 selektorów osi**. ❌ Brak wniosków osi, podpisu macierzy, linii decyzyjnej, limitów słów. ⚠ **Istnieje osobny, NIEPODPIĘTY renderer**: `src/components/assessment/report/AssessmentReportView.tsx` (137 l.) ma **zero importerów produkcyjnych** — jedyne wystąpienia to własna definicja `:45` i test `__tests__/AssessmentReportView.test.tsx`. Martwy kod. Jego dokument (`AssessmentReportDocument.tsx`, 597 l.) ma **7 sekcji TEMATYCZNYCH, nie 7 rozdziałów osi**: `limitations` `:380` · `overall` `:390` · `dimensions` `:425` · `strengths-gaps` `:430` · `unknowns` `:475` · `evidence` `:515` · `recommendations` `:545`; oś to tylko kolumna tabeli `:214` (`Wymiar (oś)`) i lista agregacji `:402-407`. ⚠ `reportApi.ts:14-25` **odnotowuje wprost brak `GET /api/method/outputs/:id/report`** — jest tylko POST tworzący snapshot. ❌ Konflikt 7 osi vs 8 wymiarów w `docs/product/DRD_REPORT_SPEC.md` nierozstrzygnięty (`ASM-CHAPTER-AC-008`). |
| **ASM-OWN-026** eksport PDF | **NIEZROBIONE** | **Zero trafień `pdf`** w `src/components/assessment/report/*`. `Eksportuj wszystko` — **zero trafień w całym repo**. `Eksportuj PDF` występuje raz, w niepowiązanej liście legacy: `src/components/assessment/MyAssessmentsList.tsx:531` (`onExportAssessment(id,'pdf')`, `:54`). Brak PDF po stronie serwera w `method-core.routes.ts` i `outputs/*`. Wszystkie `ASM-PDF-AC-001..008` = niespełnione. |
| **ASM-OWN-027** Settings 5 kart + entitlement | **CZĘŚCIOWE — 4 karty, 3 pozorowane** | `MethodWorkspaceShell.tsx:328–366` renderuje 4 karty w siatce `md:grid-cols-4`: `Informacje o dokumencie` `:335` ✅ (rzeczywiste dane), `Zespół i uprawnienia` `:349` ⚠ stub, `Zatwierdzenia` `:354` ⚠ wyprowadzone, `Licencja i wersje` `:360` ❌ — **hardkodowana proza „Status subskrypcji: do potwierdzenia przez backend"** (`:361`). Wymagane 5 kart osobno; **`Subskrypcja i wykorzystanie` + `Wersje` scalono w jeden stub**. ❌ **Brak jakiejkolwiek powierzchni Settings na poziomie MODUŁU** — żaden plik `*ssessment*ettings*` nie istnieje w `src/`. ❌ **Entitlement kredytowy nie istnieje**: zero trafień `credit`/`seat`/`entitle`/`subscription` w `server/src/method-core/`, `src/method-core/`, `src/components/assessment/`; zero `reportCredit`/`report_credit`/`assessment_credit` w całym repo. Istnieje wyłącznie **binarne bramkowanie frameworka**: `server/src/services/frameworkEntitlementService.ts:11` → `FrameworkAccessLevel = 'locked' \| 'trial' \| 'full' \| 'educational'` (+ `middleware/frameworkEntitlement.middleware.ts:7`, `routes/framework-entitlements.routes.ts:7`). **Bez miejsc licencyjnych i bez metrowania per raport.** ⚠ Kebab `:290–325` — 4 pozycje (`Duplikuj jako nową`, `Historia wersji`, `Udostępnij / kopiuj link`, `Archiwizuj`) **bez `onClick`** = martwe przyciski, fałszywa afordancja. |
| **ASM-OWN-028** komentarze + AI Analysis + wielometodyczność | **BACKEND CZĘŚCIOWY / FRONT NIEZROBIONY** | ✅ **Propozycje AI ISTNIEJĄ na serwerze**: `server/src/method-core/TeresaProposalService.ts:84-195`; kontrakty `contracts/teresa.ts` — zdolności `draft_score_proposal` `:52`, `suggest_target_and_pathway` `:54`, `draft_initiative_proposals` `:57`, `approve_score` `:78`, `approve_target` `:79`; cele `:138`. **Wymuszony cykl preview→commit** (`TeresaProposalEventPayload.previewRef`, `events.ts:190-192`). Trasy: `POST /sessions/:id/teresa/preview` `:1089`, `/commit` `:1161`. ❌ Front nie ma żadnego wejścia `AI Analysis`. ⚠ **Komentarze — tylko latentne**: istnieje zdarzenie `NOTE_ADDED` (`events.ts:50`), a `MethodEvent` niesie opcjonalne `unitId` `:101` i `level` `:103`, więc notatka **może** być zakotwiczona w komórce — ale **brak dedykowanego endpointu** (w 28 trasach nie ma żadnej; tylko generyczne `POST /sessions/:id/events` `:858`), **brak zawężonego typu payloadu notatki** i brak UI wątków w `LiveMatrix.tsx` (side sheet jest wyłącznie render-propem `:31`). ⚠ Powłoka jest generyczna, ale **`ASM-AI-AC-007` (druga metodyka) nieudowodnione**; `ASM-METH-011`/`ASM-TECH-43730-001` żądają renderu strukturalnie różnej metody syntetycznej przez tę samą powłokę. |

### 2.3 Podsumowanie liczbowe weryfikacji

| Werdykt | Liczba | ID |
| --- | ---: | --- |
| **ZROBIONE** | 5 | 004, 005 (technicznie), 010, 020, 021 (część trybów) |
| **CZĘŚCIOWE** | 12 | 001, 002, 006, 007, 008, 011, 012, 013, 016, 019, 025, 027 |
| **NIEZROBIONE (front)** | 7 | 003, 014, 015, 017 (kształt), 018, 024, 026 |
| **BACKEND ZROBIONY / FRONT NIE** | 3 | 021 (TO-BE), 023 (zatwierdzenia), 028 (propozycje AI) |
| **NIEAKTUALNE** | 1 | 009 (zastąpione przez 021) |
| **ŹRÓDŁO ZLOKALIZOWANE, MARTWE DLA DRD** | 1 | 022 |
| **WYMAGA_DECYZJI** | 3 | 013 (legenda w Matrixie), 023 (etykieta + 2 vs 3 bramki), 025 (7 vs 8 rozdziałów) |
| **DEFEKT (pozorowana lub zdezaktualizowana funkcja)** | 5 | patrz §2.4 |

### 2.4 Pięć defektów typu „wygląda na zrobione / wygląda na wyłączone"

1. **FANTOM FLAGI `drdMethodWorkspaceSliceV1`** — `AssessmentSessionEditorView.tsx:115-121`.
   Flaga jest odczytywana (`:379`) i przekazywana jako `_flagEnabled`, po czym **ignorowana**.
   Opis flagi i komentarz `:1787-1791` twierdzą, że OFF zostawia legacy nietknięty — nieprawda.
   Powoduje odwrotny wniosek u każdego audytora, który zatrzyma się na opisie flagi. **Patrz §2.0.**
2. **Kumulatywna rampa w macierzy** — `LiveMatrix.tsx:67-72`, `current = Math.max(osiągnięte)`.
   Właściciel wprost wymaga pokazania wzorca „1, 2, 5 bez 3 i 4" (`ASM-OWN-021`,
   `ASM-THREE-AC-004`, `ASM-METH-006`); recenzja sceptyczna czyni z tego bramkę blokującą
   (gate 4: „Do not invent cumulative scoring"). Backend utrwala `target_level` osobno —
   **defekt jest wyłącznie po stronie frontu**. Dawca ma ten sam defekt
   (`DRDAssessmentEditor.tsx:486, 807`): **przy przepisywaniu dawcy przeniesie się, jeśli
   nie zostanie świadomie usunięty.**
3. **Zatwierdzenia wyprowadzone ze stanu sesji** — `MethodWorkspaceShell.tsx:353-358`.
   Karta pokazuje etykiety wyliczone z `session.state`, choć **serwer ma prawdziwą tabelę
   `method_approvals`** (`MethodSessionService.ts:569`) z aktorem, decyzją i komentarzem.
   Front nie czyta `GET /sessions/:id/approvals` (`method-core.routes.ts:1072`).
   Naruszenie `ASM-GOV-AC-003` mimo istniejącego backendu.
4. **Martwe pozycje kebaba** — `MethodWorkspaceShell.tsx:295-322`. Cztery `<button>` bez
   `onClick`. `Historia wersji` sugeruje funkcję z `ASM-OWN-027`, której nie ma.
5. **Martwy renderer raportu** — `src/components/assessment/report/AssessmentReportView.tsx`
   ma zero importerów produkcyjnych, a jego dokument (597 l.) implementuje **inną**
   architekturę (7 sekcji tematycznych) niż zażądana (7 rozdziałów osi). Ryzyko: ktoś uzna
   go za „gotowy raport" i podepnie zamiast zbudować strukturę z `ASM-OWN-025`.

---

## 3. Uwagi Teresa / Agent → MODULE_17

> ⚠ **Sprostowanie adresu docelowego.** W drzewie `WAVE_03_ACCEPTANCE` **nie istnieje żaden
> `MODULE_17`** — zero trafień. Moduł agenta to `docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/`
> (jedyny dokument z okna 21–23.08 to `NOTEBOOK_OWNER_REVIEW_2026-08-22.md`, bez treści
> Assessment). Zadania poniżej kieruję tam; jeśli „MODULE_17" ma być nowym rejestrem,
> trzeba go najpierw założyć.

> ⚠ **Rozgraniczenie.** Recenzje eksperckie traktują belkę Teresy jako **decyzję własną
> Assessment** (`ASM-UX-006` P1, `ASM-CUR-001` P0, `ASM-TECH-43730-010` P1 — bramka domknięcia
> wymaga testu interakcji „brak stałego panelu Teresy"). Do modułu agenta należy przenieść
> wyłącznie to, czego Assessment nie może rozstrzygnąć sam: **kontrakt ogólnej Teresy** i
> **kontrakt `AI Analysis`**.

**Precedens międzymodułowy:** ten sam wzorzec (lokalna Teresa dublująca globalnego asystenta)
został przez właściciela odrzucony także gdzie indziej — `MYW-IDEAS-008` („duplicate local
Teresa" w powłoce Ideas) i `MYW-NBK-CORE-001/002` (inline Teresa w Notatniku), oba w
`CHAT_TO_TOOLS_IMPLEMENTATION_RECONCILIATION`. Decyzja Piotra jest konsekwentna w całym produkcie.

Korpus Assessment zawiera **cztery zobowiązania dotyczące Teresy/Agenta**, których
Assessment **nie może rozstrzygnąć u siebie**.

| Źródło | Zobowiązanie | Stan w kodzie |
| --- | --- | --- |
| `ASM-OWN-016` p.2 + doprecyzowanie 13:24 (rejestr l. 1104–1114) | „Po prawej stronie Teresa nie jest nam potrzebna, bo mamy oddzielny czat Teresy." Usunięcie dotyczy **całego** prawego arkusza Teresy (podsumowanie pozycji, powtórzenie pytania, `Prowadź Ty`, obszar propozycji, karta następnego kroku). **Zakaz** przeprojektowania, zwinięcia lub zastąpienia innym asystentem należącym do Assessment. | ✅ `TeresaPreviewPanel` niemontowany |
| `ASM-INTNAV-AC-010` (l. 1129) | Otwarcie **ogólnej** Teresy musi zachować jawny kontekst Assessment (sesja, oś, obszar, poziom) i **czytelną ścieżkę powrotu**, bez dublowania i bez cichego wycieku danych sesji. Status: `RUNTIME_PROOF_NEEDED`. | ❌ Nieudowodnione. `InterviewFocusPanel.onAskTeresa(questionId, 'explain'\|'compare_levels'\|'examples')` (l. 36) to **lokalny punkt wejścia Assessment**, nie wywołanie ogólnego czatu. |
| `ASM-INTNAV-AC-009` (l. 1128) | Żaden arkusz Teresy należący do Assessment, wariant zwinięty ani zdublowana tożsamość asystenta nie może być montowany w **żadnym** stanie Interview. | ⚠ Komponent + typ + re-eksport nadal w drzewie (`index.ts:32–33`) — ryzyko przypadkowego ponownego montażu. |
| `ASM-OWN-028` (AI Analysis) | Doradcza analiza AI (osobna od Teresy): lista propozycji ze źródłami, `accept/edit/reject`, zakaz cichego zapisu, zakaz omijania bramek roli i subskrypcji. | ❌ Nie istnieje. Jeśli ma korzystać ze wspólnego silnika agenta — kontrakt należy do MODULE_17. |

**Do przeniesienia do MODULE_17 jako zadania:**
1. `T17-ASM-01` — ogólna Teresa przyjmuje kontekst Assessment (sesja/oś/obszar/poziom) i
   zwraca ścieżkę powrotu; dowód runtime, że nie wycieka danych sesji poza tenant.
2. `T17-ASM-02` — rozstrzygnąć, czy `onAskTeresa` z `InterviewFocusPanel` ma zostać
   przekierowany do ogólnego czatu, czy usunięty; dziś jest to druga tożsamość asystenta.
3. `T17-ASM-03` — kontrakt `AI Analysis` (propozycje, źródła, pewność, accept/edit/reject,
   bramki roli i subskrypcji) jako zdolność współdzielona, nie lokalna dla Assessment.
4. `T17-ASM-04` — martwy `TeresaPreviewPanel` + `teresaProps`: decyzja usunąć czy zachować
   jako zdolność ogólną; obecnie jest to martwy kod z ryzykiem regresji.
5. `T17-ASM-05` — **serwerowy `TeresaProposalService` już istnieje**
   (`server/src/method-core/TeresaProposalService.ts:84-195`, trasy `preview` `:1089` /
   `commit` `:1161`, zdolności `draft_score_proposal` · `suggest_target_and_pathway` ·
   `draft_initiative_proposals` · `approve_score` · `approve_target`). Rozstrzygnąć, czy
   `AI Analysis` z `ASM-OWN-028` konsumuje ten silnik, czy powstaje osobny — **dziś front
   nie konsumuje żadnego**.

**Poza Assessment, do innych rejestrów:**
- `modules/05_INITIATIVES/INITIATIVES_IMPLEMENTATION_READY_CONTRACT_2026-08-23.md:76` —
  „Accepted sources: manual, Chat/Teresa, Interview insight, Tool output, Assessment…".
  To **kontrakt proweniencji Initiatives** i dokładnie ten szew, na którym wykłada się
  `ASM-TECH-43730-007` (brak `initiative_id`, brak metody rejestracji). Należy do rejestru
  Initiatives, z odnośnikiem do ASM.
- `MYW-AGT-REC-001` — „Owner explicitly deferred Run Agent until system integration and a
  dedicated end-stage audit." Czysto `07_MY_WORK_AGENT`, bez powiązania z Assessment.

---

## 4. POD PROTOTYP — precyzyjna lista wymagań właściciela na kształt narzędzia DRD

> Kontekst: DEC-02 (silnik serwerowy, zakładki Interview \| Matrix \| Report, mechanika
> z `DRDAssessmentEditor` / `DRDMatrixSession` jako dawcy, Settings osobno,
> **prototyp PRZED kodowaniem**), `ASM-THREE-AC-008` (Piotr zatwierdza klikalny prototyp
> trzech trybów zanim implementacja zostanie uznana za przyjętą).
> Zgodnie z regułą nr 7 z `CLAUDE.md` — Piotr nigdy nie jest pierwszym testerem wizualnym.

### 4.1 Powłoka narzędzia (3 poziomy)

| Poziom | Zawartość | Źródło |
| --- | --- | --- |
| **Level 1** | wyłącznie główne menu aplikacji Consultify | `ASM-OWN-010` |
| **Level 2** | stały pasek narzędzia. **Lewa**: `Wyjdź` + pełna nazwa Assessment/sesji (bez cichego skracania). **Prawa**: grupa 3 równorzędnych przełączników `Interview` · `Matrix` · `Report` w tej kolejności + **wizualnie oddzielony** przycisk `Settings`. | `ASM-OWN-011` p.1,2,5,7; `ASM-OWN-021`; `ASM-LOCALNAV-AC-008/009` |
| **Level 3** | jedna kompaktowa linia kontekstowa, **zmieniająca się z trybem**. **Lewa strefa**: kontrolki właściwe dla aktywnego trybu. **Prawa strefa**: `AI Analysis` · `Zapisz` · status `Szkic`/`Draft` (status jest prezentacją stanu, nie przyciskiem). Świadomy odstęp między Level 2 a Level 3. | `ASM-OWN-014`, `ASM-OWN-015` |

**Zakazy w powłoce (do sprawdzenia na prototypie):**
- brak menu drugiego i trzeciego **modułu** (generycznego) wewnątrz sesji — `ASM-OWN-010`
- brak pasków metadanych technicznych na kanwie roboczej — `ASM-OWN-012` p.1
- brak globalnej legendy `Propozycja AI / Review / Blocker / Evidence luka / Nieoceniony` — `ASM-OWN-013`
- brak pełnoszerokościowej listy osi w Level 3 Interview — `ASM-OWN-020`
- brak stałej belki Teresy — `ASM-OWN-016` p.2
- **brak `Split` i `Workspace`** jako zakładki, trasy lub powierzchni — `ASM-THREE-AC-001`

### 4.2 Interview — zbieranie AS-IS

**Cel (dosłownie):** „zebranie aktualnego wywiadu o stanie faktycznym, zebranie możliwych
dowodów, uzasadnienie ich" (`ASM-OWN-021`).

**Nawigacja lewa — dwustopniowa** (`ASM-OWN-016` p.3–6):
1. wąski pierwszy panel: grupy/osie w formie **zwiniętej**, z prawdziwym progresem;
2. drugi panel: **tylko** jednostki/obszary wybranej grupy;
3. wybór grupy zmienia panel 2; wybór jednostki zmienia centrum, zachowując sesję i szkic;
4. grupy domyślnie kompaktowe/zwinięte — „ono nie musi cały czas straszyć";
5. pływające menu szybkiego skoku = **warunkowy dodatek**, dopiero gdy testy wykażą, że
   dwustopniowy nawigator nadal jest trudny. **Nie umieszczać w pierwszym prototypie**
   (`ASM-INTNAV-AC-006`).

**Tabliczki progresu** (`ASM-OWN-019` p.1–4):
- wiersz osi: `2/9` = ocenione obszary / wszystkie stosowalne obszary tej osi;
- wiersz obszaru: `Poziom 3/7` względem stosowalnej skali; **gdy brak obronionej oceny —
  uczciwy stan „nieoceniony", nigdy `0` jako sfabrykowany poziom dojrzałości**;
- kompaktowe badge przy wierszu nawigatora, **nie** pełnoszerokościowy pasek techniczny;
- rozróżnić w etykiecie/tooltipie: *odpowiedziane* vs *ocenione* vs *zweryfikowane dowodowo*.

**Karta poziomu — kształt złożony z dawcy + bramek bezpieczeństwa:**

| Element | Wymaganie | Źródło |
| --- | --- | --- |
| jednostka osądu | **jeden `obszar × poziom`**, nie jedno pytanie | recenzja sceptyczna, „Defensible scoring boundary" |
| stan zwinięty | numer i krótka nazwa poziomu · jednozdaniowe kanoniczne kryterium · **badge werdyktu (read-only)** · **osobny badge stanu dowodu** · pewność tylko gdy ma wyprowadzenie · chevron rozwijania | `ASM-OWN-018`, recenzja §„Collapsed card" |
| CTA | **`Sprawdź kryteria`**; po rozpoczęciu pracy `Kontynuuj ocenę` / `Edytuj ocenę`. **ZAKAZ** `Tell me more`, `Go deeper` | `ASM-OWN-018` p.2 |
| rozwinięcie | **inline, pełna szerokość** kolumny Interview; nie modal; **najwyżej jedna karta rozwinięta** w obszarze; klik w kartę **nigdy nie zmienia oceny** | `ASM-DEEP-AC-001/002` |
| treść rozwinięta (kolejność) | 1. pełne kryterium + sygnał/próg QBank + wersja źródła → 2. **kanoniczne pytania QBank sekwencyjnie** (nie 3 jednoczesne oceny) → 3. `Dowód / przykład` → 4. notatka odpowiedzi → 5. dowód: plik / URL / referencja zewnętrzna + opis + źródło/właściciel + data/okres → 6. `Sugerowane technologie` **tylko jako pomoc** → 7. trzy osobne pola stanu → 8. uzasadnienie + oceniający + znacznik czasu + wersja QBank → 9. zapis/błąd + `Zapisz i przejdź dalej` | recenzja §„Expanded card" |
| **trzy niezależne wymiary stanu** | **Werdykt merytoryczny**: `Nieoceniony` · `Osiągnięty` · `Częściowo` · `Nieosiągnięty` · `Nie dotyczy` (wymaga uzasadnienia i akceptacji). **Wiedza respondenta**: `Wiem / mogę odpowiedzieć` · `Nie wiem / potrzebuję pomocy`. **Stan dowodu**: `Brak` · `Zadeklarowany lub dostarczony — niezweryfikowany` · `Zweryfikowany` · `Sprzeczny` · `Odrzucony`. **ZAKAZ jednego płaskiego 6-opcyjnego selecta.** | recenzja §„Three independent state dimensions"; `ASM-DEEP-AC-004` |
| decyzje z dawcy | `Osiągnięte` (AS-IS) · `Cel` (TO-BE, **nigdy nie nadpisuje AS-IS**) · `Pomiń` (jawna decyzja workflow, **nie wolno** reinterpretować jako „nie dotyczy"/„nieosiągnięte"/brak danych) | `ASM-OWN-022` p.3 |
| materiał wspierający | opis · przykład · wyjaśnienie · kanoniczne pytania · **komentarz** · **załącznik** · **link** | `ASM-OWN-022` p.1; dawca `DRDAssessmentEditor.tsx:156` (`'questions'\|'comment'\|'attachments'\|'links'`), `:46` (`levelLinks`) |
| nawigacja karty | zwijanie/rozwijanie; aktywna karta obsługuje `Poprzedni` / `Następny` **bez utraty stanu** | `ASM-OWN-022` p.2; `ASM-DONOR-AC-002` |
| kolor | zaznaczenie poziomu **zmienia kolor karty** na kanoniczny kolor tej dojrzałości; **ten sam kolor pojawia się w Matrixie**; kolor **uzupełnia**, nigdy nie zastępuje numeru/nazwy/tekstu dostępnego | `ASM-OWN-017` p.5–7 |
| dostępność | fokus na nagłówek rozwiniętego regionu (nie do inputa); powrót fokusu na opener przy zwinięciu; `Enter`/`Space` rozwija; `Esc` zwija tylko gdy nic nie ginie; `button` + `aria-expanded` + `aria-controls` + `aria-live` | recenzja §„Interaction and accessibility" |

**Zakazy w Interview:**
- **brak kontrolki wyboru targetu, która mogłaby nadpisać ocenę stanu faktycznego**
  (`ASM-THREE-AC-002`) — to jest **jedyna otwarta sprzeczność z dawcą**, patrz §4.7;
- brak stałej belki Teresy;
- brak jednoczesnych wielu pełnych kart pytań;
- brak wywnioskowanego zaliczenia niższych poziomów bez jawnej reguły metodyki.

### 4.3 Matrix — wizualizacja dojrzałości + warsztat transformacji

**Podwójny cel (`ASM-OWN-021` p.2):** wizualizacja zapisanych decyzji AS-IS **oraz**
ustalenie z klientem, co chce osiągnąć.

| Wymaganie | Szczegół | Źródło |
| --- | --- | --- |
| zakres | pełna wybrana **oś**; nawigacja per-oś i między osiami | `ASM-DONOR-AC-007`; `ASM-OWN-022` Matrix p.1 |
| **pełny ekran** | tryb pełnoekranowy macierzy (dawca: `isMatrixFullscreen` + zamykanie `Esc`, `DRDAssessmentEditor.tsx:150, 331–339, 756`) | `ASM-OWN-022` Matrix p.1; ASM-EVD-012 |
| AS-IS i TO-BE razem | widoczne jednocześnie dla każdego obszaru; osobne kolory i stany komórek | `ASM-EVD-011/012`; pakiet warsztatowy §Matrix |
| szczegóły komórki | otwierają **opis · przykład · technologie** (o ile są w method packu) + **osobne akcje `Ustaw AS-IS` i `Ustaw TO-BE`** | `ASM-OWN-022` Matrix p.2–3 |
| podsumowania | current · target · gap per obszar oraz zbiorczo dla osi; liczniki obszarów | ASM-EVD-011/012; dawca `:922–987` |
| **luki nieciągłe** | **ujawnić** wzorzec „poziomy 1, 2 i 5 z nierozstrzygniętymi 3 i 4"; **nigdy cicho nie wypełniać sekwencji**; umożliwić włączenie naprawy pominiętych niższych luk do zakresu | `ASM-OWN-021` p.2; `ASM-THREE-AC-004` |
| kroki transformacji | zapisać **które konkretnie** kolejne poziomy i **ile** wchodzi w zakres transformacji — jako osobna wartość z lineage | `ASM-OWN-021` p.2; `ASM-THREE-AC-003/005` |
| jedna prawda | Matrix i Interview to **projekcje tego samego rekordu backendowego**; brak drugiej klienckiej prawdy | recenzja §„Shared Interview–Matrix state"; pakiet §4 |
| komentarze | zakotwiczone: oś / obszar-komórka / decyzja AS-IS / decyzja TO-BE / luka | `ASM-OWN-028` |
| deep-link | wciśnięcie `Matrix` z Interview otwiera **pełną kartę macierzową aktywnej osi**, bez resetu wyboru, bez generycznej strony docelowej, bez cichej zmiany ocen; powrót przywraca poprzednią oś i obszar | `ASM-OWN-019` p.5–7 |

### 4.4 Report — tryb, nie osobny obiekt

| Wymaganie | Szczegół | Źródło |
| --- | --- | --- |
| charakter | **ekspercka interpretacja specyficzna dla firmy**: co zebrano → jak to działa w kontekście tego przedsiębiorstwa → obronione wnioski → sensowne możliwości rozwoju w podanym horyzoncie → **dlaczego akurat ten target**. „Wyżej" ≠ automatycznie „lepiej" | `ASM-OWN-024` |
| struktura | **7 selektorów osi → 7 rozdziałów**. Każdy rozdział: **wstęp osi** (120–180 sł., werdykt ≤25 sł., sekwencja `co ustalono → co to znaczy dla firmy → gdzie napięcie/możliwość`) → **macierz osi** (komponent/SVG jakości eksportowej, tytuł = wniosek nie „Matrix osi X", podpis 30–60 sł.) → **komentarz per obszar** (110–170 sł.) → **wnioski osi** (180–260 sł.) | `ASM-OWN-025` |
| mikrostruktura komentarza obszaru | 1. `Stan faktyczny` · 2. `Ocena i wiarygodność` (evidenced / declared / incomplete / conflicting / not assessed) · 3. `Znaczenie dla przedsiębiorstwa` · 4. `Luka i sens targetu` (jawnie powiedzieć, gdy wyższy poziom **nie** jest uzasadniony) · 5. `Najbliższy krok` (konkret + rola + horyzont, albo luka dowodowa do zamknięcia) | `ASM-OWN-025` §C |
| linia decyzyjna | `Rekomendowany kierunek \| Priorytet \| Horyzont \| Warunek powodzenia` | `ASM-OWN-025` §D |
| eksport | `Eksportuj PDF` na rozdział + `Eksportuj wszystko` (7 rozdziałów w kanonicznej kolejności, spis treści, ciągła paginacja, granice rozdziałów, metadane: organizacja/dokument/rewizja/czas/wersja metody/stan zatwierdzenia). Draft **zawsze** ze znakiem wodnym | `ASM-OWN-026` |
| granica | liczby pochodzą z deterministycznego silnika — model **nie liczy i nie fabrykuje**; inferencja jest oznaczona; brak dowodu → **krótszy uczciwy blok**, nie wypełniacz | `ASM-OWN-025` §„Writing and evidence rules"; `ASM-REPORT-AC-006` |

### 4.5 Settings — osobna akcja, 5 kart

| # | Karta | Zawartość | Źródło |
| ---: | --- | --- | --- |
| 1 | **`Informacje o dokumencie`** (musi być pierwsza) | tożsamość sesji + pełne ID · metoda + przypięta wersja method-packa · rewizja · źródło runtime (dziś `SERVER`) · stan zapisu · pokrycie dowodowe · pozycje do przeglądu · blokery zamrożenia. **Każdą pozycję przetłumaczyć na język produktu + krótkie wyjaśnienie**; surowe etykiety inżynierskie nie mogą być przeniesione bez zmiany | `ASM-OWN-012` |
| 2 | **`Subskrypcja i wykorzystanie`** | nazwa i status produktu · płatny/trial/demo/zaległy/zawieszony/wygasły · miejsca licencjonowane vs przypisane vs pozostałe · **kredyty na generowanie raportu**: przyznane / zużyte / pozostałe · okres odnowienia · jasna akcja kontaktu z handlowcem. **Bez ważnego uprawnienia**: tryb demo jawnie tymczasowy — **nie utrwala odpowiedzi i nie generuje raportu**, informacja **przed** rozpoczęciem pracy, nie po kliknięciu Zapisz | `ASM-OWN-027` |
| 3 | **`Zespół i uprawnienia`** | kto ma dostęp do dokumentu · kto może odpowiadać · kto może zatwierdzać odpowiedzi · kto może zatwierdzać targety/Matrix i raport końcowy. **Uprawnienia to jawne role/zdolności, nie pochodna samego dostępu** | `ASM-OWN-023` |
| 4 | **`Akceptacje`** (etykieta `TO_CONFIRM` — Piotr powiedział coś brzmiące jak „karta atfekcyjna") | etapy zatwierdzania, przypisani zatwierdzający, stan bramki. Bramki: `odpowiedzi/dowody zatwierdzone` → `targety i Matrix zatwierdzone` → `raport wygenerowany, przejrzany i zatwierdzony`. Każda decyzja: aktor + czas + rewizja. Edycja zatwierdzonego stanu wyżej **unieważnia lub jawnie zastępuje** zatwierdzenia niżej — **nigdy nie zostawia nieaktualnego raportu wyglądającego na aktualny** | `ASM-OWN-023` |
| 5 | **`Wersje`** | chronologiczne wersje z autorem, czasem, statusem i powodem · która rewizja Interview/Matrix/Report jest bieżąca, a która zatwierdzona · porównanie **tylko do odczytu** · przywrócenie **tworzy nową rewizję**, nie przepisuje historii | `ASM-OWN-027` |

`Settings` **nie jest czwartym trybem** (`ASM-THREE-AC-007`, `ASM-SET-AC-001`).

### 4.6 Warstwa wspólna dla wszystkich trybów

- **`AI Analysis`** (`ASM-OWN-028`): rola **sceptycznego recenzenta**, nie akceptanta.
  Wykrywa: brakujące odpowiedzi/dowody/uzasadnienia/zatwierdzenia · sprzeczne odpowiedzi
  i nieciągłe deklaracje dojrzałości · targety nieuzasadnione kontekstem, warunkami
  wstępnymi lub horyzontem · luki i zależności pominięte w zakresie transformacji ·
  wnioski raportu nieosadzone w zatwierdzonych wejściach · słabe/generyczne rekomendacje ·
  nieaktualną treść po zmianach powyżej · alternatywne targety warte rozważenia.
  Każda propozycja: **obiekt · obserwacja · źródła · proponowana zmiana · uzasadnienie ·
  pewność · oczekiwany skutek**. Propozycje są **szkicami** — accept/edit/reject
  pojedynczo; **żadna akcja AI nie zmienia cicho** AS-IS, TO-BE, dowodów, komentarzy,
  zatwierdzeń ani treści raportu.
- **Komentarze ludzkie** zakotwiczone w konkretnym obiekcie (nie globalnie w dokumencie),
  z autorem, czasem, kotwicą obiektu/rewizji, stanem rozwiązania i historią wątku.
  Rozwiązany komentarz pozostaje audytowalny. **Komentarz sam z siebie nie zmienia**
  oceny, targetu, tekstu raportu ani zatwierdzenia.
- **Wielometodyczność** (`ASM-AI-AC-006`): powłoka (Library/Processes, nawigacja,
  uprawnienia, akceptacje, komentarze, wersje, AI, eksporty) **nie może hardkodować**
  `7 osi`, liczby poziomów DRD, kumulatywnego scoringu, `Osiągnięte/Cel/Pomiń` ani
  szablonu raportu DRD. To wchodzi przez **wersjonowany adapter metody**.

### 4.7 Sprzeczności do rozstrzygnięcia PRZED rysowaniem prototypu

| # | Sprzeczność | Rekomendacja recenzentów | Status |
| ---: | --- | --- | --- |
| 1 | **`Cel`/`Target` w Interview vs TO-BE tylko w Matrixie.** Dawca `DRDAssessmentEditor` wystawia `Target` w karcie poziomu (`:539–542`); model końcowy umieszcza TO-BE wyłącznie w Matrixie (`ASM-THREE-AC-002`) | **Wszyscy trzej recenzenci: reużyć mechanikę dawcy, ale usunąć `Target` z Interview.** `Osiągnięte` = roszczenie AS-IS do czasu walidacji; `Pomiń` = stan workflow z kodem powodu | **BLOKUJE PROTOTYP** |
| 2 | **7 rozdziałów osi vs 8 wymiarów** w `docs/product/DRD_REPORT_SPEC.md` (S7) | rozstrzygnąć wersjonowaną zmianą kanonu **przed** implementacją Report/PDF; **nie kasować cicho** mapowania 8D | **BLOKUJE Report** |
| 3 | **2 poziomy vs 3 bramki akceptacji** — Piotr najpierw powiedział „dwa poziomy", potem wyliczył trzy | do czasu wyjaśnienia kontraktem są **trzy** bramki, nie sfabrykowane uproszczenie do dwóch | `OWNER_CLARIFICATION` |
| 4 | **Reguła kumulacji poziomów** — czy zaznaczenie poziomu N oznacza tylko N, czy też niższe jako osiągnięte | **nie wnioskować ze zrzutu**; do formalnej zgody właściciela metody utrwalać każdy poziom niezależnie i pokazywać najwyższy udowodniony **wraz z lukami poniżej**. QBank zawiera jakościowo różne, czasem negatywne stany niższych poziomów kultury → naiwna kumulacja bywa **fałszywa** | `ASM-QBANK-AC-008` = `OWNER_DECISION_REQUIRED` |
| 5 | **Jedna tożsamość Reportu** — tryb Report w sesji vs wspólny rejestr `Reports` vs stary frozen `Output` | jeden obiekt/rewizja Report; tryb Report nie tworzy drugiej domeny | `ASM-MODES-AC-008` = `OWNER_DECISION_REQUIRED` |
| 6 | **Zapis globalny vs autozapis** — model dirty/persist/conflict/exit/recovery niezdefiniowany | zdefiniować przed implementacją | audyt §2 p.8 |
| 7 | **Nieaktualne kryteria 4-trybowe** (`ASM-MODES-AC-001..010`) współistnieją z 3-trybowymi | oznaczyć jako superseded, żeby nie były aktywnymi testami | audyt §2 p.7 |
| 8 | **Legenda w Matrixie** (`LiveMatrix.tsx:179-196`) vs `ASM-LEGEND-AC-001` | zapytać Piotra: legenda przy obiekcie, który jej używa, jest zgodna z duchem `ASM-OWN-013`, ale nie z literą | otwarte |
| 9 | **Library opisuje 5 osi, workspace ma 7** (`ASM-METH-012`) | ujednolicić **przed** pokazaniem prototypu — inaczej prototyp powiela fałszywy opis produktu | P1, prosta poprawka |
| 10 | **Fixture vs `RUN-REC-002`** (`DO_NOT_SEED_BY_DEFAULT`) | rozstrzygnąć, czy prototyp i dowód end-to-end stoją na danych deweloperskich, czy dopuszczamy fixture na czas odbioru | blokuje Falę 5 |
| 11 | **Etykieta w kodzie to `Zatwierdzenia`, spec mówi `Akceptacje`** | ujednolicić przy okazji decyzji #3 | drobne |

### 4.8 Materiał referencyjny do prototypu

**Zrzuty właściciela (funkcjonalna referencja, NIE styl docelowy):**
| Zrzut | Co pokazuje | Uwaga |
| --- | --- | --- |
| `ASM-EVD-011_PRIOR_MATRIX_WORKSPACE.png` | warsztat macierzowy: mapa poziom-po-obszarze, kontrolki AS-IS/TO-BE, akcja pełnego ekranu, lista osi/obszarów, metryki | `DEMO @f3237e942304` |
| `ASM-EVD-012_PRIOR_MATRIX_FULLSCREEN.png` | pełnoekranowa `Digital Development Map`, legenda current/target, metryki | — |
| `ASM-EVD-013_PRIOR_MATRIX_SCROLLED.png` | przewinięcie poziome, dodatkowe obszary, stała struktura poziomów/podsumowań | — |
| `ASM-EVD-014_PRIOR_MATRIX_EDITING.png` | **edytor oceny na poziomie Matrixa** z nawigacją oś/obszar i wybieralnymi opisami poziomów | 982 KB, najbogatszy |
| `ASM-EVD-010_ACTIVE_WORKSPACE_OVERLOAD.png` | **czego NIE robić** — odrzucone przeciążenie | anty-wzorzec |
| `ASM-EVD-004_PROCESSES_TABLE_APPROVED.png` | **jedyny zatwierdzony wzorzec wizualny** w module | chronić |

> **Granica dowodowa (rejestr l. 713–728):** te obrazy to dostarczona przez Piotra
> **referencja funkcjonalna**, nie docelowy styl graficzny. Ich ciemny motyw, cięższe
> ramki i całe widoczne chrome **nie są automatycznie wymaganiami**.

**Zrzuty stanu bieżącego (do porównania „przed/po"):**
`docs/program/waves/WAVE_03_ACCEPTANCE/evidence/exact-candidate-43730-photo-gate-2026-08-23/`
— `assessment-{interview,matrix,report,settings}-after-integration.png` + `assessment/ASM-G0*.png`
(`ASM-G09-split-current.png` dokumentuje jeszcze **stary** tryb Split).
`.../exact-candidate-a2b500-assessment-2026-08-23/assessment-interview-compact-navigator.png`
— kompaktowy nawigator, jedna rozwinięta oś, brak belki Teresy (SHA-256
`a10f300ac4190c1599c29cfe395590ac783be2daa381ab791b36bba6c562de98`).

**Dawcy kodu (mechanika do przepisania, NIE styl):**
- `src/components/assessment/drd/DRDAssessmentEditor.tsx` (2333 l.) — karta poziomu,
  `Achieved/Target/Skip` (`:1846-1873` / `:1875-1902` / `:1904-1931`, wzajemnie wykluczające
  się), panele `questions/comment/attachments/links` (`:156`, `:1602-1658`, render
  `:1663-1805`), `Previous`/`Next` (`:1937-1955`), pełny ekran macierzy (`:150, 331-339,
  756-760`), popup komórki z opisem (`:1216-1222`) + przykładem (`:1228-1234`) +
  technologiami (`:1239-1243`), akcja `Set AS-IS` (`:1322`)
  ⚠ **Dawca jest dziś MARTWY dla sesji DRD** (§2.0) — to znaczy, że przepisanie go jest
  **jedyną** drogą; nie da się „włączyć flagi i zobaczyć"
- `src/components/assessment/drd/DRDMatrixSession.tsx` (313 l.) — opakowanie `MaturityMatrix`
- `src/components/MaturityMatrix.tsx` (352 l.) — macierz Piotra, 7 osi + obszary, achieved/target
- `src/components/assessment/drd/drdAnswersAdapter.ts` (124 l.) — adapter legacy
  ⚠ **`answers.drd.areas` NIE MOŻE stać się drugim zapisywalnym źródłem prawdy**
  (pakiet warsztatowy §4, „Forbidden implementation shortcut")

**Treść kanoniczna (uwaga na dwa źródła!):**
- **Dokumentacja (nieaktywna w runtime)**: `knowledge/tool-kb/drd/qbank/v2/drd-qbank-axis{1-2,3-4,5-7}.{pl,en}.md`
  — **7 osi · 39 obszarów · 233 definicje poziomów · 699 pytań dowodowych**;
  każdy poziom ma `Pytania (dowodowe)`, `Dowód / przykład`, `Sugerowane technologie`;
  pack deklaruje wprost, że pytań **nie wolno używać do scoringu bez dowodu, o który proszą**
- **Realne źródło runtime**: `src/services/drdStructure.ts` (2191 l.) +
  `src/services/assessmentKnowledge/drdKnowledgeOverridesAxis{1And2,3And4,5To7}.ts`
  (+ bliźniaki `.en.ts`) — treść **przepisana ręcznie do TS**
- Kompilator: `src/method-core/methods/drd/compileDrdPack.ts` (`:33-45` importy,
  `:261` emisja `sourceRefs` jako tekst proweniencji)
- ⚠ **Prototyp musi czerpać treść z warstwy TS**, a nie z `.md`. Osobne zadanie:
  **test parytetu TS ↔ markdown** na 7/39/233/699, bo dziś nic nie pilnuje, żeby
  przepisana treść nie rozjechała się z kanonem QBank.
- Książka metodyczna: `knowledge/DRD/` — 8 PDF + `extracted_content.txt` (2800 linii)

### 4.9 Czy materiał pod prototyp jest kompletny?

**TAK dla warstwy wizualno-interakcyjnej.** Można narysować klikalny prototyp trzech trybów
+ Settings bez dopytywania Piotra o kształt: powłoka (§4.1), Interview z kartą poziomu
(§4.2), Matrix (§4.3), Report (§4.4), Settings 5 kart (§4.5) są opisane na poziomie
kontrolek, etykiet PL, kolejności i zakazów, z 14 zahaszowanymi zrzutami i zlokalizowanym
dawcą kodu.

**NIE dla warstwy metodycznej.** Jedenaście sprzeczności z §4.7 pozostaje otwartych; dwie
(**#1 `Cel`/`Target` w Interview** i **#4 reguła kumulacji poziomów**) zmieniają kształt
karty poziomu i muszą zostać rozstrzygnięte **zanim** prototyp zostanie narysowany —
inaczej prototyp zakoduje niewłaściwą decyzję i cały cykl trzeba będzie powtórzyć.

**Trzy okoliczności ułatwiające, ustalone w kodzie:**
1. **Backend jest dalej niż front.** `target_level` jest już utrwalany osobno od current
   (`EventDerivedOutputBridge.ts:103-105`, `MethodOutputService.ts:211`), tabela
   `method_approvals` istnieje (`MethodSessionService.ts:569`), a silnik propozycji AI
   z cyklem preview→commit działa (`TeresaProposalService.ts:84-195`). Prototyp **nie
   projektuje tych mechanizmów od zera** — projektuje ich powierzchnię.
2. **Dawca jest kompletny i dokładnie zmapowany** (§4.8) — każdy element karty poziomu ma
   numer linii. Przepisanie jest mechaniczne, poza dwoma świadomymi zmianami: usunięcie
   `Target` z Interview i usunięcie kumulatywnej rampy.
3. **Powłoka trzech trybów już żyje** i jest domyślnym runtime (§2.0), więc prototyp
   dokłada zawartość do istniejącego szkieletu, a nie buduje nowy.

**Jedna okoliczność utrudniająca:** `RUN-REC-002` (`DO_NOT_SEED_BY_DEFAULT`) koliduje z
potrzebą danych zaludnionych do pokazania Report i Matrixa z prawdziwymi ocenami. Bez
rozstrzygnięcia #10 z §4.7 prototyp Report pokaże wyłącznie puste stany — czyli nic,
czego Piotr mógłby ocenić.

---

## 5. Plan domknięcia falami

Kolejność wynika z zależności, nie z priorytetu deklarowanego w rejestrze. Każda fala
kończy się bramką; nic nie idzie dalej bez zamknięcia poprzedniej.

### Fala 0 — higiena rejestru (bez kodu, ~0,5 dnia)

| # | Zadanie | Zamyka |
| ---: | --- | --- |
| 0.1 | Renumerować kolizyjne `ASM-OWN-001..003` z `MODULE_ACCEPTANCE.md:109–111` (propozycja `ASM-OWN-029..031`) | §1.4 |
| 0.2 | Poprawić `MODULE_ACCEPTANCE.md` G11: `ASM-OWN-001–009` → `001–028` | stan przestarzały |
| 0.3 | Oznaczyć `ASM-MODES-AC-001..010` jako `SUPERSEDED_BY_ASM-THREE-AC-*`; to samo dla 4-trybowych sformułowań w `ASM-OWN-009/011` | audyt §2 p.7 |
| 0.4 | Przywrócić do `MODULE_ACCEPTANCE.md` dowody utracone vs gałęzie zachowane (`274/274`, `ASM-PF-005` z SHA `3d61730fd8ad`, historyczny gate `OWNER_REVIEW_BLOCKED`) | §1.5 |
| 0.5 | Przenieść 5 zadań Teresa/Agent do `modules/07_MY_WORK_AGENT/` (lub założyć MODULE_17) | §3 |
| 0.6 | **Naprawić fantom flagi** `drdMethodWorkspaceSliceV1`: usunąć martwy parametr `_flagEnabled`, poprawić komentarz `AssessmentSessionEditorView.tsx:1787-1791` i opis flagi w `useFeatureFlags.tsx:239-256` (zdezaktualizowany też co do `DrdSessionRuntime` vs `forceHttpSourceOfTruth`) | §2.0 |
| 0.7 | Wciągnąć 45 ustaleń eksperckich + 9 defektów (`ASM-WP-01..17`) do jednego planu z 28 uwagami — dziś to dwa rozłączne mianowniki | §1.7 |
| 0.8 | Sprostować hash kandydata w nagłówku `ASSESSMENT_EXPERT_METHOD_REVIEW_2026-08-23.md` (`43730c271b96…` vs `43730f86f8a7…`) | §1.7 |
| 0.9 | Zainwentaryzować Assessment w `CROSS_MODULE/ROW_MENU_AUDIT_REGISTER.md` (dziś `NOT_INVENTORIED`) | §1.11 |

**Bramka F0:** jedno odwołanie „ASM-OWN-00X" = jedna uwaga; zero aktywnych kryteriów
sprzecznych; zero flag bez efektu.

### Fala 1 — decyzje właściciela (spotkanie z Piotrem, ~1 h)

Jedenaście pytań z §4.7 w jednej sesji, w kolejności blokowania:
1. **`Cel`/`Target` w Interview — zostaje czy wypada?** (blokuje kartę poziomu)
2. **Reguła kumulacji poziomów** — N tylko N, czy N i niższe? (blokuje kartę i Matrix)
3. **Dane do prototypu** — fixture czy dane deweloperskie? (`RUN-REC-002`, blokuje Report)
4. Etykieta karty 4 Settings („karta atfekcyjna" → `Akceptacje` czy `Zatwierdzenia`?)
   i 2 vs 3 bramki akceptacji
5. 7 rozdziałów vs 8 wymiarów `DRD_REPORT_SPEC.md`
6. Jedna tożsamość Reportu (tryb vs rejestr vs frozen Output)
7. Legenda w Matrixie — zostaje czy znika?
8. Zapis globalny vs autozapis
9. Finalne kolumny Library + słownictwo komercyjne (płatna/niepłatna)
10. Library „5 osi" vs workspace „7 osi" — potwierdzić, że to zwykły błąd treści
11. Model kredytów raportowych (`ASM-SET-AC-006` = `COMMERCIAL_DECISION_NEEDED`)

**Bramka F1:** decyzje zapisane w `OWNER_DECISION_LEDGER` z datą i SHA, w formacie
`DEC-2026-…` jak `DEC-2026-08-24-02`.

### Fala 2 — PROTOTYP (bez kodu produkcyjnego, przed implementacją)

Zgodnie z `ASM-THREE-AC-008`, `ASM-DEEP-AC-010`, `ASM-DONOR-AC-009` i regułą nr 7 z `CLAUDE.md`.

| # | Artefakt prototypu | Odwołanie |
| ---: | --- | --- |
| 2.1 | Powłoka: Level 1/2/3 z `Wyjdź`+nazwa \| `Interview·Matrix·Report` \| `Settings` | §4.1 |
| 2.2 | Interview: dwustopniowy nawigator z tabliczkami `2/9` i `Poziom 3/7` | §4.2 |
| 2.3 | **Karta poziomu zwinięta i rozwinięta** — najważniejszy artefakt; 3 wymiary stanu, CTA `Sprawdź kryteria`, panele komentarz/załącznik/link, kolor po zaznaczeniu | §4.2 |
| 2.4 | Matrix: pełna oś + pełny ekran + szczegóły komórki z `Ustaw AS-IS`/`Ustaw TO-BE` + **jawne luki nieciągłe (1,2,5 bez 3,4)** | §4.3 |
| 2.5 | Report: 7 selektorów osi + jeden rozdział w pełnej strukturze na danych zaludnionych | §4.4 |
| 2.6 | Settings: 5 kart | §4.5 |
| 2.7 | Level 3 kontekstowy per tryb + `AI Analysis`/`Zapisz`/`Szkic` po prawej | §4.1 |

**Bramka F2:** ja renderuję i robię **własne zrzuty** (harness z danymi mock, bez logowania
Piotra), zrzuty czyste (tokeny `c-*`, zero czerwieni `primary`), dopiero potem Piotr patrzy
— **do akceptu, nie do odkrywania zepsucia**. Wygląd za flagą, default OFF.

### Fala 3 — kontrakty backendowe (C1–C15 z audytu eksperckiego)

Kolejność wg blokowania prototypu:
| Priorytet | Kontrakty | Dlaczego teraz |
| --- | --- | --- |
| **najpierw** | **C3** (roszczenie → dowód → osąd → zatwierdzone AS-IS), **C1** (wersjonowana definicja metody), **C5** (rewizje/zapis/współbieżność) | bez nich karta poziomu nie ma gdzie zapisywać trzech wymiarów stanu |
| potem | **C6** (graf zatwierdzeń), **C4** (cykl życia sesji), **C2** (zakres i mianowniki) | Settings karty 3–4 |
| dalej | **C7** (kanoniczny Report i lineage), **C8** (cykl zadania PDF) | Report i eksport |
| równolegle | **C10** (bezpieczeństwo dowodów), **C11** (komentarze), **C12** (cykl AI), **C13** (macierz błędów), **C14** (responsywność/a11y) | — |
| na końcu | **C9** (entitlement, miejsca, kredyty), **C15** (druga metodyka, porównywalność) | komercja i reużywalność |

**Bramka F3:** każdy kontrakt ma testowalne kryterium i mapowanie na „minimum proof pack"
(12 pozycji z audytu §4).

### Fala 4 — implementacja, jeden ekran po drugim

Zgodnie z zakazem masowego włączania (reguła nr 9 z `CLAUDE.md`) — **każdy ekran za flagą
OFF idzie na demo osobno, po akcepcie Piotra na czystym zrzucie**.

| Krok | Zakres | Zamyka uwagi |
| --- | --- | --- |
| 4.1 | Level 3 kontekstowy + `AI Analysis`/`Zapisz`/`Szkic`; usunąć martwe pozycje kebaba | 014, 015, defekt 3 |
| 4.2 | Dwustopniowy nawigator + tabliczki progresu + deep-link Interview→Matrix z osią | 016, 019 |
| 4.3 | **Karta poziomu** z QBank + 3 wymiary stanu + `Osiągnięte/Pomiń` + kolor; test pokrycia 7/39/233/699 | 017, 018, 022 (Interview) |
| 4.4 | Matrix: pełny ekran, szczegóły komórki, `Ustaw AS-IS`/`Ustaw TO-BE`, **usunięcie kumulatywnej rampy**, luki nieciągłe, kroki transformacji | 021 (AS-IS/TO-BE), 022 (Matrix), defekt 1 |
| 4.5 | Settings 5 kart: podpiąć `GET /sessions/:id/approvals` zamiast wyprowadzania z `session.state`; dodać role/osoby; rozdzielić `Subskrypcja` i `Wersje`; zbudować księgę kredytów | 012, 023, 027, defekt 3 |
| 4.6 | Report: 7 rozdziałów + szablon tekstowy + osadzenie `knowledge/DRD/` | 024, 025 |
| 4.7 | Eksport PDF per oś + `Eksportuj wszystko` | 026 |
| 4.8 | Komentarze zakotwiczone + `AI Analysis` | 028 |
| 4.9 | Ekran sesji zamrożonej: użyteczny workspace read-only zamiast diagnostyki | 003, 007 (`ASM-TOOL-AC-002`) |
| 4.10 | Downstream: kreatory Insight/Report/Initiative + lineage na danych zaludnionych | 006 |
| 4.11 | Library: dokument wiedzy metodyki + kolumna komercyjna + globalne CTA + **poprawka „5 osi"→7** + usunięcie filtrów cyklu życia procesu | 001, 002, `ASM-METH-012`, `ASM-UX-007` |
| 4.12 | Ustalenia eksperckie bez odpowiednika w uwagach: `ASM-TECH-43730-002` (pola agregatu Process), `-004` (agregat Insight), `-007` (`initiative_id`), `-008` (bezpieczeństwo dowodów), `-009` (transakcyjny lineage), `-011` (taksonomia błędów), `ASM-UX-009/011/012/013` | §1.7 |

**Bramka F4:** przed każdym pushem UI — `scripts/check-list-canon.sh`; zero własnych tabel;
`StandardTable`/`StandardModuleBar` w ekranach listowych.

### Fala 5 — dowód i odbiór

1. Pakiet dowodowy: 12 pozycji „minimum proof pack" z audytu §4
2. Druga metodyka strukturalnie różna → dowód braku hardkodu DRD (`ASM-AI-AC-007`)
3. Pełna ścieżka na danych zaludnionych: Library → Process → Interview → Matrix →
   zatwierdzenia → Report → PDF → Insight/Initiative, po odświeżeniu i **zimnym logowaniu**
4. Retest właściciela dla **każdej** uwagi z §1 (dziś: 26 z 28 ma otwartą bramkę właściciela)
5. Akcept na dokładnym SHA + re-tag `demo-safe-<data>`

**Bramka F5 = G17/G18/G20:** wszystkie uwagi mają decyzję retestową Piotra; moduł
zaakceptowany na dokładnym SHA; replay 16/16.

---

## 6. Ostrzeżenia dla następnej sesji

1. **Nie ufać `MODULE_ACCEPTANCE.md` jako obrazowi stanu.** Sekcja „Current controlled
   browser replay" (l. 96–103) raportuje `CURRENT_BROWSER_PASS` dla Settings
   („zespół/uprawnienia, akceptacje, subskrypcja, historia wersji"), podczas gdy kod
   (`MethodWorkspaceShell.tsx:348–363`) renderuje w tych miejscach **stuby i wartości
   wyprowadzone**. Zrzut potwierdza, że *coś* się wyświetla — nie że funkcja istnieje.
2. **Bieżący gate modułu to `EXPERT_NO_GO`** (l. 5), związany z kandydatem
   `43730f86f8a74943c36a58b9ff07aa680a42aa3e`; dwie niezależne recenzje dały
   `NO-GO FOR IMPLEMENTATION ACCEPTANCE` i `NO-GO FOR OWNER ACCEPTANCE`. Nowszy kod
   **nie unieważnił** tych werdyktów.
3. **Audyt dwurundowy: wszyscy trzej recenzenci `INCOMPLETE`**, pokrycie 7,9–8,1/10.
   `CONDITIONALLY_COMPLETE` dopiero po zamknięciu C1–C15.
4. **Dawca ma defekt kumulacji** — przepisując `DRDAssessmentEditor`, nie przenosić
   `Math.max(current, lvl)` (`:486`) ani `level <= achieved` (`:807`).
5. **`answers.drd.areas` nie może stać się drugą prawdą** — Method Core jest jedynym
   źródłem zapisu.
6. **Nie ufać opisom flag.** `drdMethodWorkspaceSliceV1` ma `defaultValue: false`, opis
   „OFF = legacy editor completely untouched" i komentarz w widoku mówiący to samo —
   a mimo to powłoka trzech trybów jest **domyślnym runtime** dla DRD, bo bramka ignoruje
   flagę (`AssessmentSessionEditorView.tsx:115-121`). Kompetentny audytor czytający samą
   flagę wyciągnie **odwrotny wniosek**. Zawsze czytać ciało funkcji bramkującej.
7. **Nie ufać testowi wysokości preview** — `AssessmentHub.previewHeight.ownerFeedback.test.tsx`
   porównuje **string w pliku źródłowym**, nie zmierzoną wysokość w DOM.
8. **Dwa rozłączne mianowniki.** 28 uwag właściciela i 45 ustaleń eksperckich
   (`ASM-WP-01..17`) żyją w osobnych dokumentach i **nie są ze sobą zmapowane**. Plan, który
   zamyka tylko jeden zbiór, przepuści drugi.
9. **`ASM-TECH-43730-012`: wcześniejsze zielone testy się nie przenoszą.** Checkout HEAD
   `43730f86`, cytowany runtime `3d61730`, source `d268800`, fixture `97422d`, baza WIP
   `ca9ef…`, brudny worktree — pięć różnych stanów w jednym pakiecie dowodowym.
10. **Assessment nie ma powierzchni Settings na poziomie modułu** — istnieje tylko
    rozwijany pasek w nagłówku sesji. Kto szuka `AssessmentSettings*`, nie znajdzie nic.
