---
doc_id: macierz-drd-audyt
status: canonical
truth_type: audit
owner: piotr
established: 2026-08-30
ekran: src/components/assessment/drd/DRDAssessmentEditor.tsx (2333 linie)
wpiety: src/views/AssessmentSessionEditorView.tsx:28 — ŻYWY w produkcie
harness: dev-render/screens/drd-macierz-oceny.tsx (?screen=drd-macierz-oceny&os=1..7)
zrzuty: evidence/106-macierz-audyt/ (20 plików, PRZED, light+dark)
---

# Macierz oceny DRD — audyt stanu zastanego

## ★ Zasada nadrzędna tego dokumentu

**To jest audyt, nie przebudowa. Logika pracy jest nietykalna.**

Właściciel: *„tak ma wyglądać macierz, i ona pokazuje i pozwala się poruszać po niej.
Oczywiście to jest strasznie brzydkie, co tutaj masz (…) Cały ten stary ekran to jest
prehistoryczny ekran, ale ta logika pracy jest najłatwiejsza."*

Zostaje bez zmian, cokolwiek się dalej zdarzy:

- wiersze = poziomy (najwyższy u góry), kolumny = obszary, nagłówki obszarów w DOLNYM pasku;
- klik w komórkę → popover z opisem poziomu i przykładem dowodu;
- dwa znaczniki naraz: AS-IS (stan) i TO-BE (cel), stawiane dwoma przyciskami w popoverze;
- Shift+klik = szybkie postawienie TO-BE;
- chipy `AS n` / `TO n` na nagłówku obszaru;
- przełącznik gęstości, tryb pełnoekranowy, `Esc`, liczby zbiorcze pod macierzą;
- klik w nagłówek obszaru → przejście do widoku „Survey".

Zmienia się **wyłącznie to, jak to wygląda**.

W tym audycie **nie zmieniono nic w `src/`**. Jedyna zmiana w repo poza tym dokumentem
to plik harnessu (`dev-render/`), który pozwala ekran w ogóle wyrenderować i zrzucić.

---

## 1. Jak to zmierzono

### Harness

`dev-render/screens/drd-macierz-oceny.tsx` montuje **REALNY** `DRDAssessmentEditor`
(nie atrapę) z mock-odpowiedziami. Ustalone przez czytanie źródła: komponent wymaga
tylko `assessmentId` / `value` / `onChange` i kontekstu **i18n** — żadnego routera,
store'a ani providerów danych. `getAssessmentGuidanceLive` (sieć) odpala się wyłącznie
z widoku „Survey" na żądanie, więc domyślny widok macierzy nie robi zapytań.

| Oś | Adres |
| --- | --- |
| 1. Procesy Cyfrowe (9×7) | `http://127.0.0.1:3020/?screen=drd-macierz-oceny&os=1&lang=pl&theme=light` |
| 2. Produkty Cyfrowe (5×5) | `…&os=2` |
| 3. Cyfrowe Modele Biznesowe (5×5) | `…&os=3` |
| 4. Zarządzanie Danymi (5×7) | `…&os=4` |
| 5. Kultura Transformacji (5×6) | `…&os=5` |
| 6. Cyberbezpieczeństwo (5×6) | `…&os=6` |
| 7. Dojrzałość AI (5×5) | `…&os=7` |

`&theme=light|dark`, `&lang=pl|en`. Przełącznik osi jest też klikalny w pasku harnessu
oraz w selekcie „Axis" wewnątrz komponentu.

### Zrzuty — `evidence/106-macierz-audyt/`

20 plików, 1600×1000, DPR 2, **zero błędów konsoli na wszystkich**:

- `os1..os7__PRZED__{light,dark}.png` — siedem osi, dwa motywy (14),
- `os1-popover__PRZED__{light,dark}.png` — otwarty popover komórki 1A/poziom 4 (2),
- `os1-popover-zblizenie__PRZED__{light,dark}.png` — kadr samego popovera, DPR 3 (2),
- `os1-spacious__PRZED__{light,dark}.png` — włączony przełącznik „Spacious" (2),
- `os1-fokus__PRZED__{light,dark}.png` — fokus klawiatury na komórce (2).

Każdy obejrzany wzrokiem. Pomiary kolorów, kontrastów i wymiarów robione
`getComputedStyle` w żywej stronie, nie z kodu.

---

## 2. Stan zastany — co widać

Ekran jest **czytelnie zbudowany pod logikę pracy** i ta część działa: siatka czyta się
od razu, dwa znaczniki są rozróżnialne, popover niesie opis + przykład dowodu + dwa
przyciski oceny. Właściciel ma rację, że mechanika jest tu najłatwiejsza w całym produkcie.

Wygląd rozjeżdża się na trzech osiach naraz:

1. **Macierz jest wyspą.** Siatka ma na sztywno wymuszoną klasę `dark` i tło `bg-navy-950`,
   więc w motywie JASNYM jest ciemnogranatowym prostokątem wklejonym w białą kartę.
   Zmierzone: tło siatki to `rgb(10,15,30)` **w obu motywach**.
2. **Etykiety wierszy kłamią.** Podpisy poziomów to wymyślona w komponencie generyczna
   drabina (Basic/Digitized/Integrated/Automated/Optimized/AI-Driven/Autonomous),
   a nie drabina z książki. Komórki pokazują słownictwo książki. W jednym kadrze
   wiersz mówi „6. AI-Driven", a komórki pod nim mówią „ERP".
3. **Popover nie ma tła.** `bg-white/98` i `bg-navy-950/98` **nie generują żadnej reguły CSS**
   (`/98` nie istnieje w skali tego Tailwinda; `/95` istnieje). Zmierzone
   `background-color: rgba(0,0,0,0)`. Panel jest przezroczysty i przez treść przebijają
   komórki macierzy. W motywie jasnym połowa popovera jest nieczytelna.

---

## 3. Lista defektów wizualnych z wagą

Skala: **P0** — blokuje albo psuje pracę / treść nieczytelna · **P1** — poważne, widoczne
gołym okiem · **P2** — złamany kanon albo estetyka · **P3** — drobne.

### P0 — nieczytelne albo mylące

| # | Defekt | Plik:linia | Dowód |
| --- | --- | --- | --- |
| **A1** | **Popover nie ma tła.** `bg-white/98` / `dark:bg-navy-950/98` nie generują reguły CSS — zmierzone `background-color: rgba(0,0,0,0)`. Panel jest przezroczysty, przebijają przez niego komórki siatki. W motywie JASNYM górne ⅔ popovera (tytuł, „Description", cały opis poziomu) to ciemny tekst na ciemnej macierzy — nieczytelne. To samo dotyczy czterech strzałek popovera. | `DRDAssessmentEditor.tsx:1101` oraz strzałki `:1107, :1113, :1119, :1125` | `os1-popover-zblizenie__PRZED__light.png` |
| **A2** | **Przycisk „Set TO-BE" jest niewidoczny w motywie jasnym.** `text-blue-300` na `bg-blue-500/20` bez wariantu `dark:` — zmierzone `rgb(170,200,235)` na `rgba(101,120,180,0.2)`. **Kontrast 1,31 : 1** przy progu AA 4,5 : 1. W motywie ciemnym ten sam przycisk ma ~8,9 : 1 i wygląda dobrze — klasyczny objaw ekranu projektowanego wyłącznie pod ciemny. | `:1353` | `os1-popover-zblizenie__PRZED__light.png` |
| **A3** | **Treść komórek nieocenionych jest poniżej progu dostępności.** `text-slate-600` (`#475569`) 11 px na tle `#0A0F1E`. **Kontrast 2,42 : 1** przy progu AA 4,5 : 1 dla tekstu normalnego — nie przechodzi nawet progu 3 : 1 dla elementów nietekstowych. Dotyczy CAŁYCH kolumn: w mocku 1I, 2E, 3E, 4E, 5E, 6E, 7E (obszary jeszcze nieocenione) są praktycznie niewidoczne. | `:898` (klasa `text-slate-600` w gałęzi „nieoceniony") | wszystkie `os*__PRZED__*.png` |
| **A4** | **Trzy z dziewięciu kolumn osi 1 są niewidoczne bez przewijania i nie ma o tym żadnej informacji.** Zmierzone: kontener `clientWidth = 1182`, treść `scrollWidth = 1670` przy oknie 1600 px. `min-w-[1100px]` + `240px + 9 × minmax(150px…)` daje 1590 px minimum. Obszary **1G Quality, 1H Financial, 1I HR** wypadają poza kadr; brak cienia krawędziowego, strzałki ani paska. Kolumna 1F ma dodatkowo ucięty chip „TO 7". | `:769` (`min-w-[1100px]`), `:771` (`gridTemplateColumns`) | `os1__PRZED__light.png` — prawa krawędź |

### P1 — poważne

| # | Defekt | Plik:linia | Dowód |
| --- | --- | --- | --- |
| **B1** | **Macierz ma wymuszony motyw ciemny.** Kontener siatki ma dosłownie `className="dark … bg-navy-950"`. W jasnym motywie ciemny prostokąt siedzi w białej karcie: nagłówek biały, siatka granatowa, kafle liczb znowu białe. Dwa razy w pliku (widok zwykły i pełnoekranowy). | `:767` i `:2042` | `os1__PRZED__light.png` |
| **B2** | **Legenda kłamie i znika.** Kropka „AS-IS" to `bg-navy-900` (`#0F172A`) na karcie `dark:bg-navy-950` (`#0A0F1E`) — **kontrast 1,07 : 1, kropka jest w motywie ciemnym niewidoczna**. Dodatkowo żaden z dwóch kolorów legendy nie odpowiada kolorom faktycznie użytym w komórkach (osiągnięte = `bg-slate-500/25`, docelowe = `bg-blue-500/15`), więc legenda nie tłumaczy obrazu. | `:733` (AS-IS), `:737` (TO-BE); komórki `:834-841` | `os1__PRZED__dark.png` — prawy górny róg |
| **B3** | **Przełącznik „Spacious" nic nie robi.** Jedyna różnica to `p-2` → `p-2.5`, a komórka ma `min-h-[40px]` i jest rozciągana przez wiersz siatki. Zmierzone: wysokość komórki **70,5 px w obu stanach**, wysokość siatki **616,5 px w obu stanach**. Kontrolka obiecuje zmianę gęstości i nie dostarcza jej. | `:825` i `:2091` | `os1__PRZED__light.png` vs `os1-spacious__PRZED__light.png` |
| **B4** | **Treść komórki ucinana na trzech słowach bez wielokropka.** `title.split(' ').slice(0,3).join(' ')` produkuje urwańce kończące się na spójniku albo przecinku: „Ethical, Transparent &", „Centralized Data &", „AI as a", „Fragmented Data, No", „No AI Governance,", „Data from Physical", „Dispersed Local Digital". Czytelnik nie wie, że tekst jest ucięty. | `:884` i `:2142` | `os7__PRZED__light.png`, `os4__PRZED__light.png` |
| **B5** | **Cały ekran po angielsku przy `lang=pl`** — mimo że polskie nazwy SĄ w źródle prawdy (`DRDArea.namePL`, `DRDAxis.namePL`) i komponent ich po prostu nie używa. Pełna lista w §3.1. | m.in. `:718, :721, :724, :734, :738, :749, :761, :776-784, :797, :917, :938, :1000-1024, :1219, :1231, :1243, :1322, :1357` | wszystkie zrzuty |
| **B6** | **Popover miesza języki w jednym panelu.** „Description" ciągnie `DRDLevel.description` (angielski, z książki), „Example" ciągnie `getDRDKnowledge().example` (polski, z nakładek). W jednym oknie: *„We use various tools to automate sales…"* nad *„Dowód: raport zamówień z oznaczeniem kanału…"*. | `:1218-1236` | `os1-popover-zblizenie__PRZED__dark.png` |
| **B7** | **Podpis „Hover for preview · Click for details" jest nieczytelny** — `text-slate-600` 11 px na tle gradientu granatowego, kontrast ~2,4 : 1. Powtarza się w KAŻDYM wierszu (7 razy na osi 1), więc jest to jednocześnie największy szum wizualny ekranu i najmniej czytelny tekst. To samo dotyczy etykiety „AREA" (`text-slate-600`, 10 px). | `:796` (podpis), `:916` (AREA) | `os1__PRZED__dark.png` |
| **B8** | **Paski postępu w prawym panelu są niewidoczne w motywie ciemnym** — wypełnienie `bg-navy-900` (`#0F172A`) na torze `dark:bg-navy-800` (`#151E32`). Konsultant nie widzi postępu obszarów. | `:655` | `os1__PRZED__dark.png` — prawa kolumna |

### P2 — kanon i estetyka

| # | Defekt | Plik:linia | Dowód |
| --- | --- | --- | --- |
| **C1** | **Zero tokenów `c-*` poza fokusem.** Cały plik używa 4 wystąpień `c-focus` i ~450 surowych klas palety (`text-slate-*`, `bg-navy-*`, `bg-white/*`, `blue-*`, `amber-*`). Ekran nie uczestniczy w systemie tokenów, więc każda zmiana motywu go omija. | cały plik; `c-focus` w `:592, :747, :1753, :2033` | `grep` |
| **C2** | Dwie surowe wartości hex zamiast tokenu: `dark:bg-[#F4F7FB]`, `dark:hover:bg-[#DDE5EF]`. | `:1317`, `:1790` | `grep` |
| **C3** | **Przyciski popovera nie idą kanonem pigułek** `MENU_2_TAB_*` (`h-9`, `rounded-full`, `focus-visible:ring-c-focus`, aktywny = neutralny). Tu: `h-9 rounded-lg`, brak `focus-visible`, aktywny AS-IS = pełna czerń/biel, aktywny TO-BE = pełny `bg-blue-500`. | `:1315-1320`, `:1350-1354`; kanon `src/components/shared/ModuleMenu3.tsx:23-39` | `os1-popover-zblizenie__PRZED__dark.png` |
| **C4** | **Odwrócona waga przycisków.** Stan już osiągnięty („Achieved") krzyczy najgłośniej (pełne wypełnienie), a dostępna akcja („Set TO-BE") jest wyszarzona. Wzrok idzie do informacji, nie do działania. | `:1315-1360` | jw. |
| **C5** | **Ozdoby bez funkcji:** dwie poświaty `blur-3xl` (`bg-navy-500/15`, `bg-blue-500/10`) tylko w motywie ciemnym, `backdrop-blur` na pasku obszarów, trzy różne cienie kierunkowe `shadow-[10px_0_30px…]` / `shadow-[0_-10px_30px…]`. Nic nie komunikują, dodają szumu. | `:712-713`, `:790`, `:915`, `:2038-2039` | `os1__PRZED__dark.png` |
| **C6** | **Trzy różne promienie na jednym ekranie:** karta `rounded-2xl`, siatka `rounded-xl`, etykieta wiersza `rounded-xl`, komórka `rounded-lg`, chip `rounded`, pigułka `rounded-full`. Brak rytmu. | `:709, :767, :790, :823, :941` | zrzuty |
| **C7** | **Podtytuł „Process Digitalization Assessment Matrix" jest nieprawdziwy na sześciu osiach z siedmiu** — wisi nad „7. AI Maturity", „5. Culture of Transformation", „6. Cybersecurity". | `:724`, `:2011` | `os5,6,7__PRZED__*.png` |
| **C8** | **`opacity-40` gasi wszystkie komórki przy otwartym popoverze** — łącznie z tymi, które już były na granicy czytelności (A3). Efekt: przy otwartym popoverze kolumny nieocenione znikają zupełnie. | `:830` | `os1-popover__PRZED__dark.png` |
| **C9** | Checkbox „Spacious" ma klasy `text-navy-900 dark:text-white`, które **nie stylują natywnego checkboxa** — renderuje się domyślnym systemowym błękitem, obcym palecie. | `:744-751`, `:2029-2036` | `os1-spacious__PRZED__light.png` |
| **C10** | **Cała macierz zduplikowana w pliku** — widok zwykły (`:767-960`) i pełnoekranowy (`:2042-2225`) to dwie niezależne kopie tego samego JSX, z drobnymi rozjazdami (`minmax(150px)` vs `minmax(180px)`, „Hover for preview · Click for details" vs „Click for details", `text-2xl` vs `text-3xl`, `text-3xl` vs `text-4xl` w kaflach). Każda przyszła poprawka wizualna musi być zrobiona dwa razy albo powstanie rozjazd. | `:767` / `:2042` | `diff` obu bloków |

### P3 — drobne

| # | Defekt | Plik:linia |
| --- | --- | --- |
| **D1** | Fokus klawiatury na komórce działa (widoczny pierścień), ale to **domyślny pierścień przeglądarki**, nie token `c-focus`. W kanonie ma być `focus-visible:ring-2 ring-c-focus`. | `:820-824` |
| **D2** | `aria-label` komórki podaje surowy angielski (`"Sales Processes, level 4"`) niezależnie od `lang`; nie zawiera stanu AS-IS/TO-BE ani treści komórki. | `:857` |
| **D3** | Komórka jest `<button>` w `<div>`-owej siatce — brak ról `grid`/`row`/`gridcell`, więc czytnik ekranu nie wie, że to macierz, i nie poda współrzędnych. | `:769-960` |
| **D4** | Nawigacja strzałkami po siatce nie istnieje — Tab przechodzi liniowo przez wszystkie 63 komórki osi 1. | — |
| **D5** | Shift+klik stawia TO-BE, ale nigdzie na ekranie nie jest to napisane. | `:842-853` |
| **D6** | Komórka bez treści renderuje `'—'`; myślnik w `text-slate-600` na ciemnym tle jest praktycznie niewidoczny. | `:889` |
| **D7** | Nazwa obszaru w pasku dolnym ma `line-clamp-2`; „Process Technology and R&D" i „Continuous Competency Development" łamią się na dwie linie i rozciągają cały pasek, psując wyrównanie chipów `AS`/`TO`. | `:954` |

**Czego NIE znaleziono (sprawdzone, wynik czysty):** ani jednego `primary-*`. Crimson
`#85182F` nie występuje w tym pliku w żadnej postaci — ani jako ozdoba, ani jako akcent.
Pułapka nr 1 z CLAUDE.md jest tu **niezłamana**.

### 3.1. Angielszczyzna w kadrze — pełna lista

Wszystko poniżej renderuje się przy `lang=pl`:

**Nagłówek macierzy:** `Digital Development Map` · nazwa osi (`Digital Processes`,
`Digital Products`, `Digital Business Models`, `Data Management`, `Culture of Transformation`,
`Cybersecurity`, `AI Maturity`) · `Process Digitalization Assessment Matrix` · `AS-IS` ·
`TO-BE` · `Spacious` · `Full screen`.

**Siatka:** etykiety wierszy `Basic / Manual`, `Digitized`, `Integrated`, `Automated`,
`Optimized`, `AI-Driven`, `Autonomous` (+ fallback `Level N`) · `Hover for preview · Click for details` ·
`AREA` · nazwy obszarów (`Sales Processes`, `Marketing Processes`, `Process Technology and R&D`,
`Purchasing Processes`, `Logistics Processes`, `Production Processes`, `Quality Processes`,
`Financial Management`, `HR Processes` i odpowiedniki na osiach 2–7) · chipy `AS n` / `TO n`.

**Liczby zbiorcze:** `Avg. Current Level` · `Avg. Target Level` · `Avg. Gap` · `Areas Assessed`.

**Dymek najazdowy:** tytuł poziomu · `AS-IS` / `TO-BE` / `Not assessed` · `Click for details`.

**Popover:** tytuł poziomu · `Open` · `AS-IS (Achieved)` / `Not achieved` · `TO-BE (Target)` ·
`DESCRIPTION` · `EXAMPLE` · `TECHNOLOGIES` · `Achieved` / `Set AS-IS` · `Target` / `Set TO-BE`.

**Pełny ekran:** `Back` · `Press Esc to close`.

**Panel nawigacji:** `DRD` · `Survey` / `Preview` · `Axis` · `No results.` · `Assigned to you` ·
`me` · `Collapse panel` · `Expand navigation` · `Navigation`.

Polskie odpowiedniki nazw osi i obszarów **są już w `src/services/drdStructure.ts`**
(pola `namePL`), komponent ich nie czyta. Nazwy poziomów po polsku nie istnieją nigdzie —
trzeba je wziąć z książki (patrz §4).

---

## 4. Treść komórek kontra książka właściciela

Źródło: `knowledge/DRD/extracted_content.txt`, appendix od linii ~452
(„Axis 1: Digital processes"), oraz `knowledge/DRD/1. Digitlne processy.pdf`.

### Werdykt

**Drabina poziomów w źródle prawdy jest wierna książce. Macierz jej nie pokazuje —
podmienia ją na wymyśloną, a treść komórek redukuje przez 16-elementową listę skrótów.**

Rozbito to na trzy osobne ustalenia, bo mają trzy różne przyczyny i trzy różne koszty naprawy.

### 4.1. Drabina w SSOT — ZGODNA ✔

Książka, oś 1, siedem poziomów:

| Poziom | Książka | `drdStructure.ts` (`1A.levels[].title`) |
| --- | --- | --- |
| 1 | Basic Data Registration | `Basic Data Registration` ✔ |
| 2 | Workstation Control | `Workstation Control` ✔ |
| 3 | Process Control | `Process Control` ✔ |
| 4 | Automation | `Automation` ✔ |
| 5 | Manufacturing Execution Systems (MES) | `MES` ✔ |
| 6 | Enterprise Resource Planning (ERP) | `ERP` ✔ |
| 7 | AI Support Algorithms | `AI Support` ✔ |

Opisy poziomów w `drdStructure.ts` są przepisane z książki niemal dosłownie —
1A poziom 1 w kodzie: *„Sales employees use dedicated systems to electronically register
agreements and orders…"*, w książce identycznie. **Źródło prawdy jest w porządku.**

### 4.2. Etykiety wierszy w macierzy — NIEZGODNE ✘ (P1, przyczyna: `:776`)

Komponent **ignoruje** drabinę z SSOT i wypisuje własną, zaszytą na sztywno:

```
1: 'Basic / Manual', 2: 'Digitized', 3: 'Integrated', 4: 'Automated',
5: 'Optimized', 6: 'AI-Driven', 7: 'Autonomous'
```

To generyczna drabina dojrzałości z branżowego folkloru, nie metodyka DRD. Skutki
widoczne na zrzutach:

- **oś 1:** wiersz „6. AI-Driven" stoi nad komórkami mówiącymi „ERP"; wiersz „2. Digitized"
  nad „Workstation Control"; wiersz „5. Optimized" nad „MES". Etykieta i komórka mówią
  co innego w tym samym wierszu.
- **oś 7 (Dojrzałość AI, 5 poziomów):** najwyższy wiersz nazywa się „5. Optimized",
  a komórki pod nim mówią „Autonomous Data Intelligence" i „AI-Native Business Offerings".
  Etykiety „AI-Driven" i „Autonomous" — jedyne, które by tu pasowały — są ucinane,
  bo oś ma tylko 5 poziomów.
- **oś 5 (Kultura, 6 poziomów):** wiersz „6. AI-Driven" stoi nad komórką „Transformacyjny"
  (styl przywództwa). Etykieta nie ma nic wspólnego z osią.

Ta sama zaszyta lista jest w kopii pełnoekranowej (`:2051`).

### 4.3. Treść komórek — CZĘŚCIOWO NIEZGODNA ✘ (P1, przyczyna: `:862`)

Komórka pokazuje: **najpierw** do dwóch skrótów z listy `keyTechs`, **a dopiero gdy żaden
nie pasuje** — pierwsze trzy słowa tytułu poziomu z SSOT.

```
keyTechs = ['AI','ML','RPA','IoT','AGV','WMS','MES','ERP','CRM','BI','API','EDI','PLM','APS','TMS','YMS']
```

Baza wiedzy (`drdKnowledgeOverridesAxis1And2.ts`) jest **bogata i wierna książce** —
np. `1F#2` (Produkcja, poziom 2) ma `['PLC','Sensors','Industrial Detectors','SCADA','MES']`,
`1F#3` ma `['CMMS','OEE Dashboard','Value Stream Mapping (VSM)','MES','SCADA']`, dokładnie
tak jak książka. Ale **żaden z tych terminów poza `MES` nie jest na białej liście**, więc
filtr wyrzuca wszystko oprócz `MES`.

**Efekt na zrzucie (`os1__PRZED__light.png`, kolumna 1F Production Processes):**

| Poziom | Książka (Area 1F) | Macierz pokazuje | |
| --- | --- | --- | --- |
| 1 | monitoring danych z maszyn | `MES` | ✘ |
| 2 | PLC, sensory, detektory | `MES` | ✘ |
| 3 | CMMS, OEE, VSM | `MES` | ✘ |
| 4 | roboty przemysłowe, automatyzacja | `MES` | ✘ |
| 5 | MES | `MES` | ✔ |
| 6 | ERP | `MES` | ✘ |
| 7 | algorytmy AI, cyfrowy bliźniak | `MES` | ✘ |

**Cała kolumna to siedem razy to samo słowo. Sześć z siedmiu komórek jest fałszywych.**

Drugi przykład, kolumna **1A Sales Processes**:

| Poziom | Książka | Macierz | |
| --- | --- | --- | --- |
| 1 | rejestracja umów i zamówień | `CRM` | ✘ (CRM pojawia się w książce dopiero przy 1B/marketingu) |
| 3 | kontrola budżetu sprzedaży | `CRM` | ✘ |
| 4 | sklepy online, marketplace, DIY | `Automation` | ~ (ogólnik, ale nie kłamstwo) |
| 5 | MES do raportowania dostaw | `MES · WMS` | ✔ |
| 6 | zintegrowany ERP | `ERP · CRM` | ✔ |
| **7** | **algorytmy AI, personalizacja oferty, NLP, boty** | **`CRM`** | **✘ — szczyt drabiny pokazuje najniższą technologię** |

**Zgodne przykłady istnieją** i pokazują, że mechanizm potrafi działać:

- **1B Marketing, poziom 1** — książka: *„a CRM (Customer Relationship Management) system
  to register and manage basic customer data"*; macierz: `CRM`. ✔ Trafienie w dziesiątkę.
- **1B Marketing, poziom 7** — `AI Support`. ✔
- **cała oś 4 (Zarządzanie Danymi)** — każda komórka niesie osobną, sensowną treść
  („Manual Data Collection", „Graphic Symbols", „Ethernet-based Architecture",
  „Public Cloud Storage", „Quantum Computing"). To jest dowód, że **kiedy filtr skrótów
  nie trafia, fallback na tytuł z SSOT daje dobry wynik** — czyli filtr jest szkodliwy,
  a nie pomocny.

### 4.4. Osobno: osie 2 i 3 są w SSOT puste znaczeniowo

Nie wina komponentu, ale widać to na zrzucie i trzeba to zapisać. `drdStructure.ts` daje
osiom 2 i 3 tytuły poziomów `Basic / Intermediate / Advanced / Interactive / Expert`
**identyczne dla każdego obszaru**. Efekt: macierz osi 3 to 25 komórek zawierających
pięć różnych słów, gdzie każda kolumna jest identyczna, plus jedno przypadkowe `CRM`
w 3E poziom 1 (szum z regexa nad opisem). **Macierz osi 2 i 3 nie niesie żadnej informacji
różnicującej obszary.** To dziura w danych, do rozstrzygnięcia z książką (rozdziały
„2. Digitalne produkty" i „3. digitlane modele"), nie w wyglądzie.

### 4.5. Podsumowanie części 3

**Czy komórki niosą to, co metodyka?** — **Nie w całości, i to nie z winy metodyki.**
Metodyka jest poprawnie zapisana w `drdStructure.ts` (drabina) i w nakładkach wiedzy
(technologie, przykłady dowodów). Macierz psuje ją **dwoma pojedynczymi miejscami w kodzie**:
zaszytą listą etykiet wierszy (`:776`) i białą listą 16 skrótów (`:862`). To dobra
wiadomość — obie naprawy są małe i nie dotykają logiki pracy.

---

## 5. Propozycja polerowania — od najtańszego do najdroższego

Kolejność jest kolejnością **wykonania**: każdy krok da się zrobić, zrzucić i pokazać
właścicielowi osobno. Nic z tego nie zmienia sposobu pracy z macierzą.

### Krok 0 — usuń duplikat macierzy *(warunek wstępny, nie kosmetyka)*

**Bezpieczne. Ryzyko: średnie (refaktor, zero zmian wizualnych).**

Wyciągnąć siatkę z `:767-960` i `:2042-2225` do jednego komponentu wewnątrz pliku,
parametryzowanego szerokością kolumny i wariantem podpisu. **Bez tego każdy kolejny krok
trzeba robić dwa razy** i po miesiącu widok pełnoekranowy znowu się rozjedzie (już jest
rozjechany: C10). Zrzut przed/po musi być identyczny piksel w piksel — to jest kryterium
odbioru tego kroku.

### Krok 1 — cztery poprawki jednolinijkowe, największy zwrot *(BEZPIECZNE)*

Każda to zmiana jednej klasy albo jednej tablicy. Zero dotknięcia logiki.

| | Zmiana | Naprawia |
| --- | --- | --- |
| 1.1 | `bg-white/98` → `bg-white/95`, `dark:bg-navy-950/98` → `dark:bg-navy-950/95` (5 miejsc: `:1101, 1107, 1113, 1119, 1125`) | **A1** — popover dostaje tło i przestaje być przezroczysty |
| 1.2 | `text-blue-300` → `text-blue-700 dark:text-blue-200` (`:1353`) | **A2** — „Set TO-BE" z 1,31 : 1 na >4,5 : 1 |
| 1.3 | `text-slate-600` → `text-slate-400` w komórce nieocenionej (`:898`), w podpisie wiersza (`:796`) i w „AREA" (`:916`) | **A3, B7** — z 2,42 : 1 na ~5,9 : 1 |
| 1.4 | pasek postępu `bg-navy-900` → `bg-navy-900 dark:bg-slate-300` (`:655`) | **B8** — postęp widoczny w ciemnym |

**To są trzy najtańsze zmiany, które dadzą największą różnicę** (1.1, 1.2, 1.3).
Popover przestaje być rozbity, przycisk oceny staje się widoczny, a nieocenione obszary
przestają znikać. Razem: pięć plików-linii, zero ryzyka dla mechaniki.

### Krok 2 — etykiety wierszy i treść komórek z metodyki *(BEZPIECZNE dla logiki, zmienia TREŚĆ — wymaga akceptu)*

| | Zmiana | Naprawia |
| --- | --- | --- |
| 2.1 | Usunąć zaszytą tablicę `levelLabels` (`:776`, `:2051`). Etykietę wiersza brać z `axis.areas[0].levels.find(l => l.level === n).title` — tak jak już robi popover. Fallback zostaje. | **4.2** — wiersze zaczynają mówić językiem książki (`1. Basic Data Registration` … `7. AI Support`), a na osi 7 przestaje wisieć „Optimized" nad „AI-Native” |
| 2.2 | Usunąć filtr `keyTechs` (`:862`, `:2120`). Komórka pokazuje tytuł poziomu z SSOT; skrót technologiczny — jeśli w ogóle — jako drugi wiersz mniejszą czcionką, nie zamiast. | **4.3** — kolumna 1F przestaje mówić siedem razy „MES”, 1A poziom 7 przestaje mówić „CRM” |
| 2.3 | Zamiast `slice(0,3)` — pełny tytuł z `line-clamp-2` i `title=` z pełną treścią. | **B4** — koniec urwańców na „&” |

**Uwaga o ryzyku:** to jedyny krok, który zmienia **co widać w komórce**. Nie zmienia
tego, co komórka **robi**. Wymaga zrzutu wszystkich siedmiu osi i akceptu właściciela
przed wejściem, bo dotyka jego własności intelektualnej.

### Krok 3 — przewijalność i pasek obszarów *(BEZPIECZNE)*

| | Zmiana | Naprawia |
| --- | --- | --- |
| 3.1 | Usunąć `min-w-[1100px]`; kolumna `minmax(120px, 1fr)` przy ≥7 obszarach, `minmax(150px, 1fr)` przy ≤6. Oś 1 mieści się wtedy w kadrze. | **A4** |
| 3.2 | Jeśli mimo to trzeba przewijać — cień krawędziowy po prawej + widoczny pasek przewijania. | **A4** |
| 3.3 | Pasek obszarów: stała wysokość, nazwa `line-clamp-2` z wyrównaniem chipów do góry. | **D7** |

### Krok 4 — polszczyzna *(BEZPIECZNE mechanicznie, ale wymaga decyzji treściowej)*

| | Zmiana | Naprawia |
| --- | --- | --- |
| 4.1 | Nazwy osi i obszarów: `isPl ? (axis.namePL ?? axis.name) : axis.name`. Dane już są. | B5 częściowo |
| 4.2 | Napisy własne ekranu (`Digital Development Map`, `AS-IS`, `TO-BE`, `Spacious`, `Full screen`, `AREA`, `Avg. …`, `Description`, `Example`, `Technologies`, `Set AS-IS`, `Set TO-BE`, `Back`, `Press Esc to close`, `Survey`, `Axis`, …) — do `t()` z polskimi domyślnymi. | B5 |
| 4.3 | Podtytuł `Process Digitalization Assessment Matrix` → z `axis.description` albo usunąć. | C7 |
| 4.4 | **Nazwy poziomów po polsku nie istnieją w repo.** Trzeba je wziąć z książki i dopisać `titlePL` do `DRDLevel`. To praca na danych, nie na wyglądzie — osobne zadanie. | B5, 4.2 |
| 4.5 | Opis poziomu w popoverze po polsku (dziś angielski obok polskiego przykładu). Wymaga `descriptionPL` — jak 4.4. | B6 |

**Ryzyko:** 4.4 i 4.5 to tłumaczenie metodyki właściciela. **Nie robić bez niego.**

### Krok 5 — kanon kolorów i pigułek *(BEZPIECZNE, ale duże)*

| | Zmiana | Naprawia |
| --- | --- | --- |
| 5.1 | Zdjąć wymuszone `dark` i `bg-navy-950` z kontenera siatki (`:767`, `:2042`); tło `bg-c-surface-subtle`, komórki na tokenach. Macierz przestaje być ciemną wyspą w jasnym motywie. | **B1** |
| 5.2 | Legenda: kropki dokładnie w kolorach komórek (AS-IS = wypełnienie osiągniętej, TO-BE = wypełnienie docelowej). | **B2** |
| 5.3 | Przełożyć ~450 klas palety na `c-*` (`c-bg`, `c-surface`, `c-surface-raised`, `c-text`, `c-text-secondary`, `c-text-muted`, `c-border`, `c-border-strong`, `c-focus`). | **C1, C2** |
| 5.4 | Przyciski popovera na `MENU_2_TAB_ACTIVE` / `MENU_2_TAB_INACTIVE`; odwrócić wagę — akcja mocniejsza od stanu. | **C3, C4** |
| 5.5 | Fokus komórki: `focus-visible:ring-2 focus-visible:ring-c-focus`. | **D1** |
| 5.6 | Zdjąć poświaty `blur-3xl` i cienie kierunkowe; ujednolicić promienie do dwóch (karta `2xl`, element `lg`). | **C5, C6** |

**Ryzyko: średnie.** 5.1 zmienia wygląd całego ekranu naraz — to jest ten krok, który
wymaga zrzutów siedmiu osi × dwa motywy **przed** i **po**, i akceptu na zrzutach.
Nie łączyć go z żadnym innym krokiem (CLAUDE.md #9: zakaz masowego włączania).

### Krok 6 — gęstość i dostępność *(RYZYKOWNE — dotyka odczucia pracy)*

| | Zmiana | Uwaga |
| --- | --- | --- |
| 6.1 | „Spacious" ma faktycznie zmieniać gęstość: `min-h` komórki 40 → 56 px, `gap-2` → `gap-3`, podpis wiersza pełny vs skrócony. **Albo** — jeśli właściciel nie chce dwóch gęstości — usunąć przełącznik. Dziś obiecuje i nie dowozi. | **B3.** Wymaga decyzji właściciela: naprawić czy usunąć. |
| 6.2 | Podpis „Hover for preview · Click for details" w każdym wierszu → raz, nad macierzą. | **B7.** Zmienia kompozycję, wymaga zrzutu. |
| 6.3 | Role `grid`/`row`/`gridcell`, nawigacja strzałkami, `aria-label` ze stanem. | **D2–D4.** Dotyka zachowania klawiatury — testować, że klik myszą działa identycznie. |
| 6.4 | Podpowiedź o Shift+klik. | **D5** |

### Czego NIE robić

- Nie zmieniać kierunku wierszy (najwyższy poziom u góry).
- Nie przenosić nagłówków obszarów z dolnego paska na górę.
- Nie zamieniać popovera na panel boczny ani modal.
- Nie łączyć „Set AS-IS" i „Set TO-BE" w jeden przełącznik.
- Nie usuwać chipów `AS n` / `TO n` z nagłówka obszaru.
- Nie usuwać Shift+klik.
- Nie ruszać `EmbeddedMatrix` przy okazji — to inny komponent, inny audyt
  (`docs/program/grafika/DRD_KSIAZKA_KONTRA_KOD.md`).

---

## 6. Co zostało dotknięte w repo przy tym audycie

| Plik | Zmiana |
| --- | --- |
| `dev-render/screens/drd-macierz-oceny.tsx` | **nowy** — harness montujący realny `DRDAssessmentEditor` |
| `dev-render/main.tsx` | **+8 linii** — rejestracja ekranu w `SCREENS` (`:357`, `:1594`) |
| `evidence/106-macierz-audyt/` | **nowy** — 20 zrzutów PRZED |
| `docs/program/grafika/MACIERZ_DRD_AUDYT.md` | **nowy** — ten dokument |

**`src/` nie został dotknięty w ogóle.**
