---
agreement_id: MOD-AGR-04
module: Audits
status: ACCEPTED_DIRECTION_OPEN_DETAILS
owner: piotr
prepared_by: codex
accepted_by: piotr
accepted_at: 2026-07-31
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Audits

## 1. Proponowana definicja

**Audits (Audyty)** to kontrolowany proces sprawdzenia organizacji, procesu,
systemu, inicjatywy albo sposobu działania względem jawnych kryteriów.

Moduł prowadzi cały cykl audytu:

`zakres i kryteria → plan → zbieranie dowodów → testy → ustalenia → odpowiedź
właściciela → działania naprawcze → raport → monitoring zamknięcia`

Audits nie jest jednorazowym raportem ani rozbudowaną ankietą. Jego główną
wartością jest możliwa do obrony relacja między wymaganiem, dowodem, oceną,
ustaleniem i działaniem naprawczym.

Jest to osobny, w dużej mierze dopiero projektowany moduł. Istniejący hub oraz
generator Interview są fragmentem fundamentu, a nie kompletnym Audits.

**Audits nie wchodzi do MVP.** Należy do drugiej fali rozwoju produktu.
W obecnym etapie obowiązuje kompletna dokumentacja kierunku, zabezpieczenie
granic danych i usunięcie fałszywych deklaracji gotowości. Pełna implementacja
generatora blueprintów, evidence chain, planów naprawczych i raportowania
realizacji rozpoczyna się po odbiorze MVP.

## 2. Trzy znaczenia słowa „audit”

W aplikacji występują trzy różne pojęcia, których nie wolno mieszać:

1. **Audyt biznesowy** — produktowy moduł Audits opisany w tej karcie.
2. **Audit trail** — techniczna historia kto, co i kiedy zmienił w dowolnym
   module. Jest usługą platformową, nie elementem katalogu audytów biznesowych.
3. **Kontrola jakości** — automatyczny test dokumentu, prezentacji, arkusza,
   modelu AI albo integracji. Może dostarczyć dowód do audytu, ale sama nie
   staje się programem audytowym.

Nazwa `Audit` bez doprecyzowania nie powinna być używana w nowych kontraktach
technicznych.

## 3. Użytkownicy

### Główni

- właściciel programu audytowego;
- audytor wewnętrzny lub zewnętrzny;
- konsultant prowadzący audyt;
- compliance officer, quality manager lub risk manager;
- osoba odpowiedzialna za audytowany obszar.

### Uczestnicy

- właściciele wymagań i procesów;
- respondenci Interview;
- osoby dostarczające dokumenty i dowody;
- właściciele działań naprawczych;
- management zatwierdzający odpowiedź i ryzyko rezydualne.

## 4. Zakres zastosowań

Audits powinien obsługiwać jeden wspólny silnik dla różnych programów:

- zgodność i gotowość do certyfikacji, np. ISO;
- audyt procesu lub funkcji biznesowej;
- audyt operacyjny i jakościowy;
- audyt technologii, danych lub bezpieczeństwa;
- due diligence;
- audyt dostawcy;
- audyt realizacji inicjatywy;
- przegląd dojrzałości, jeśli wymaga formalnego dowodu i ustaleń;
- cykliczny audyt wewnętrzny.

Różne metodyki korzystają z innych bibliotek wymagań i reguł oceny, ale nie
powinny tworzyć osobnych implementacji całego modułu.

Przykładowe źródła programów to normy z rodzin ISO, VDA 6.3, inne standardy
branżowe, wewnętrzne instrukcje audytowe oraz plan audytów organizacji.

## 5. Twardy podział: Tools, Assessment i Audits

| Moduł | Funkcja | Charakter pracy | Główny wynik |
| --- | --- | --- | --- |
| **Tools** | elastyczne metody konsultingowe, np. SWOT, mind map i analiza procesu | użytkownik wybiera metodę i wspólnie z Teresą opracowuje problem | robocza analiza, rekomendacja lub artefakt |
| **Assessment** | zamknięte, płatne metody oceny rozwoju cyfrowego, m.in. DRD i SIRI | długie, zdefiniowane postępowanie według własnego modelu i scoringu | poziom dojrzałości cyfrowej, luki, raport i kandydaci inicjatyw |
| **Audits** | formalne audyty branżowe, normatywne i wewnętrzne | program budowany z normy, instrukcji lub planu audytów; wymagania są sprawdzane dowodami | findingi, raport poaudytowy, plan naprawczy, inicjatywy i raporty realizacji |

Podobny układ ekranów albo wspólne komponenty techniczne nie oznaczają wspólnej
własności produktu. DRD i SIRI pozostają wyłącznie w Assessment. Audits nie
może przedstawiać ich jako swoich presetów, programów ani raportów.

## 6. Generator programu z dokumentu

Uprawniony użytkownik może dostarczyć normę, instrukcję audytową, procedurę
branżową, checklistę albo własną metodykę organizacji. System:

1. przechowuje dokument i konkretną wersję w Materials;
2. rozpoznaje rozdziały, wymagania, pytania, kryteria, wyjątki i powiązania;
3. tworzy **draft Audit Blueprint**, a nie aktywny audyt;
4. pokazuje mapowanie każdego elementu do fragmentu źródła;
5. proponuje pytania, Evidence Requests, procedury testowe i wymagane role;
6. pozwala ekspertowi poprawić, połączyć, rozdzielić albo wyłączyć elementy;
7. pokazuje pominięte lub niepewnie zinterpretowane fragmenty;
8. publikuje wersjonowany blueprint dopiero po review człowieka;
9. tworzy z blueprintu konkretny Audit Program;
10. zachowuje lineage do wersji źródła.

Zmiana normy nie może po cichu zmienić aktywnego audytu. Tworzy propozycję
nowej wersji blueprintu wraz z różnicami i oceną wpływu na przyszłe programy.

System nie może udostępniać treści normy, do której organizacja nie ma praw.
Import, przetwarzanie i widoczność dokumentów chronionych muszą respektować
licencję oraz uprawnienia klienta.

## 7. Audit Blueprint

Blueprint jest zatwierdzonym, wielokrotnego użytku przepisem na audyt:

- metadane normy lub instrukcji i jej wersji;
- hierarchia obszarów, procesów, wymagań, pytań i kryteriów;
- reguły obowiązkowości, stosowalności i wyłączeń;
- sugerowane pytania, dowody oraz procedury testowe;
- reguły oceny i klasyfikacji findingów;
- wymagane kompetencje audytora i role;
- zasady onsite, remote albo hybrid;
- struktura raportu i planu naprawczego;
- historia wersji i zatwierdzenia.

Blueprint musi umieć zamrozić reguły właściwe konkretnej metodzie. Przykładowo
VDA 6.3 wymaga zachowania pełnego katalogu pytań użytego elementu procesu dla
porównywalności; Teresa nie może dowolnie dodawać ani usuwać pytań.

## 8. Plan audytów organizacji

Organization może posiadać roczny lub wieloletni plan audytów:

- jednostka, lokalizacja, proces lub dostawca;
- blueprint i oczekiwany zakres;
- częstotliwość, termin i priorytet oparty na ryzyku;
- Lead Auditor, zespół i wymagane kompetencje;
- niezależność oraz konflikty interesów;
- tryb onsite/remote/hybrid;
- status wykonania i termin następnego cyklu.

Utworzenie programu z planu zachowuje powiązanie, ale konkretny Audit Program
otrzymuje własny zakres i snapshot blueprintu.

## 9. Kanoniczne obiekty

| Obiekt | Znaczenie |
| --- | --- |
| **Audit Program** | kontener całego audytu: cel, zakres, standard, role i terminy |
| **Audit Blueprint** | wersjonowany przepis utworzony z normy, instrukcji lub ręcznie |
| **Organization Audit Plan** | harmonogram i portfel audytów organizacji |
| **Requirement/Control** | wymaganie lub kryterium, względem którego prowadzona jest ocena |
| **Audit Plan** | kto, co, kiedy i jak sprawdza |
| **Evidence Request** | kontrolowana prośba o konkretny dowód |
| **Evidence** | wersjonowany materiał wraz ze źródłem, datą i właścicielem |
| **Test/Procedure** | sposób sprawdzenia wymagania i wynik wykonania |
| **Finding** | ustalenie wynikające z wymagania, dowodów i testu |
| **Management Response** | stanowisko właściciela obszaru wobec ustalenia |
| **Corrective Action** | zatwierdzone działanie usuwające przyczynę lub ograniczające ryzyko |
| **Corrective Action Plan** | zatwierdzony zestaw korekcji, analiz przyczyn, działań, właścicieli, terminów i weryfikacji |
| **Residual Risk** | ryzyko pozostające po odpowiedzi i działaniu |
| **Audit Report** | zatwierdzona synteza programu, ustaleń i wniosków |
| **Remediation Progress Report** | cykliczny raport wykonania i skuteczności planu naprawczego |

Każde ustalenie musi wskazywać wymaganie, dowody, wykonany test, autora, datę,
istotność, status oraz historię review.

## 10. Golden flow

1. Ekspert wgrywa legalnie dostępną normę/instrukcję albo wybiera blueprint.
2. Teresa tworzy draft wymagań, pytań, testów, dowodów i struktury raportu.
3. Ekspert sprawdza mapowanie do źródła i publikuje wersję blueprintu.
4. Właściciel tworzy program ręcznie albo z planu audytów organizacji.
5. Określa cel, zakres, lokalizacje/procesy, kryteria, terminy i role.
6. Teresa proponuje plan na podstawie blueprintu i kontekstu Organization.
7. Człowiek zatwierdza wymagania, przypisania i plan zbierania dowodów.
8. System tworzy Evidence Requests, Interview i zadania.
9. Uczestnicy odpowiadają i dostarczają dokumenty lub inne dowody.
10. Audytor prowadzi działania onsite, remote albo hybrid i wykonuje procedury.
11. Teresa porządkuje materiał oraz wskazuje braki, sprzeczności i nieaktualność.
12. Teresa proponuje findingi wraz z uzasadnieniem i źródłami.
13. Audytor poprawia, odrzuca albo zatwierdza każde ustalenie.
14. Powstaje zatwierdzony raport poaudytowy.
15. Właściciel obszaru przygotowuje Management Response i plan naprawczy:
    korekcję, analizę przyczyny, działania, właścicieli i terminy.
16. Zatwierdzone działania trafiają do My Work, a większe zmiany do Initiatives.
17. Audits odczytuje wykonanie i cyklicznie tworzy raporty realizacji planu.
18. Audytor sprawdza dowody wdrożenia oraz skuteczność działań.
19. Finding zostaje zamknięty, ponownie otwarty albo ryzyko zostaje jawnie
    zaakceptowane.
20. Audyt zostaje zamknięty dopiero po rozstrzygnięciu wszystkich ustaleń albo
    jawnym zaakceptowaniu ryzyka rezydualnego.
21. Kolejna edycja audytu porównuje zmiany z poprzednim cyklem.

## 11. Rola Teresy

### Planowanie

- pomaga dobrać blueprint, kryteria, zakres i respondentów;
- przetwarza dostarczoną normę lub instrukcję do draftu blueprintu;
- wskazuje fragment źródła dla każdego proponowanego wymagania;
- oznacza elementy, których nie potrafi wiarygodnie zinterpretować;
- używa profilu Organization do proponowania właścicieli obszarów;
- wskazuje brak kompetencji, konflikt interesów albo niepełny zakres;
- proponuje plan, ale nie zatwierdza go za audytora.

### Zbieranie i analiza

- generuje Evidence Requests i przygotowuje Interview;
- klasyfikuje otrzymane materiały bez zmieniania ich treści;
- wskazuje brakujące, przestarzałe lub sprzeczne dowody;
- łączy dowód z konkretnym wymaganiem;
- proponuje pytania pogłębiające i testy;
- może tworzyć draft ustalenia tylko z widocznym uzasadnieniem.

### Raportowanie i follow-up

- tworzy draft podsumowania i raportu;
- pilnuje spójności ustalenie → działanie → właściciel → termin;
- pokazuje stan zamknięcia i opóźnienia;
- tworzy cykliczne drafty raportów realizacji planu naprawczego;
- porównuje wykonanie działania z oczekiwanym rezultatem i KPI skuteczności;
- przygotowuje porównanie kolejnych cykli;
- proponuje inicjatywy dla problemów wymagających większej zmiany.

### Granice

Teresa nie może:

- samodzielnie wydać formalnej opinii audytowej;
- uznać braku dowodu za automatyczny dowód niezgodności;
- zmienić treści materiału źródłowego;
- ukryć dowodu sprzecznego z proponowanym wnioskiem;
- zawyżyć pewności albo istotności ustalenia;
- zamknąć findingu wyłącznie na podstawie deklaracji wykonawcy;
- zaakceptować ryzyka rezydualnego za uprawnioną osobę.

## 12. Własność danych i integracje

| Moduł | Kontrakt |
| --- | --- |
| Organization | kontekst audytowanej firmy; zatwierdzone ustalenia mogą proponować aktualizację |
| Interview | zbieranie odpowiedzi i oświadczeń; Audits zachowuje ich użycie jako evidence |
| Materials | pliki dowodowe, wersje, formalny raport i eksport |
| My Work | Evidence Requests, zadania audytora i działania naprawcze |
| Initiatives | większe programy naprawcze utworzone z zatwierdzonego findingu |
| Execution | realizacja działań i read-back statusu |
| Results | KPI potwierdzające stan i skuteczność naprawy |
| Finance | dane finansowe, materiality i koszt działań/ryzyka |
| Meeting | opening, review ustaleń, management response i closing meeting |
| Assessment | odrębny, zamknięty moduł DRD/SIRI; może przekazać zaakceptowaną lukę, ale nie współdzieli definicji ani raportów |
| Tools | metody analizy mogą wspierać procedurę, ale wynik wymaga review audytora |
| Notebook | robocze notatki audytora, nie formalne dowody ani raport |
| Chat/Teresa | praca konwersacyjna z zawsze widocznym programem, rolą i źródłami |
| Admin | role, dostęp, retencja, niezależność i polityka audytowa |

## 13. Granice względem Assessment

**Assessment** odpowiada: „jaki jest poziom rozwoju cyfrowego organizacji
według zamkniętego modelu DRD albo SIRI?”
**Audits** odpowiada: „czy określone wymaganie jest spełnione i czy możemy to
obronić dowodami?”.

Assessment może używać odpowiedzi deklaratywnych i tworzyć scoring. Audyt wymaga
kontrolowanego evidence chain, procedury, ustalenia oraz review. Wynik Assessment
może otworzyć program audytowy, a zatwierdzony audyt może dostarczyć mocniejszy
dowód do Assessment, ale obiekty, metodyki, scoring i raporty nie są tym samym.

## 14. Granice względem Tools

Tools służy do elastycznej pracy konsultingowej i nie wymaga formalnego
standardu, kompletności wymagań, niezależności audytora ani evidence chain.
Wynik Tool może pomóc zrozumieć problem, lecz nie jest formalnym findingiem.

Audits może uruchomić Tool jako pomocniczą metodę. Zachowuje jego wynik jako
źródło pomocnicze i nadal wymaga procedury oraz review audytora.

## 15. Własność dowodu

Materials jest właścicielem pliku i jego wersji. Audits jest właścicielem
użycia tego materiału jako dowodu:

- do jakiego wymagania został użyty;
- jaką wersję sprawdzono;
- kto go dostarczył i kto zaakceptował;
- jaki był okres obowiązywania;
- czy był wystarczający, wiarygodny i aktualny;
- jakie ustalenie lub test na nim oparto.

Zmiana pliku po wykonaniu testu nie może niejawnie zmienić historycznej podstawy
ustalenia. Audyt wskazuje konkretną wersję albo snapshot.

## 16. Ocena i status findingu

Finding powinien mieć co najmniej:

- typ: zgodność, niezgodność, obserwacja, możliwość doskonalenia;
- istotność: informacyjna, niska, średnia, wysoka, krytyczna;
- status: draft, in review, confirmed, response pending, remediation in
  progress, verification pending, closed, risk accepted;
- wymaganie i obszar;
- opis stanu oczekiwanego i stanu stwierdzonego;
- dowody wspierające i przeczące;
- przyczynę źródłową, jeśli została potwierdzona;
- wpływ i rekomendację;
- autora, reviewera i historię zmian.

„Closed” oznacza, że audytor sprawdził zarówno dowód wykonania, jak i skuteczność
naprawy. W zależności od findingu weryfikacja może wymagać ponownej wizyty,
obserwacji procesu, dokumentów albo KPI z określonego okresu. „Risk accepted”
wymaga jawnej decyzji uprawnionej osoby i nie jest równoważne usunięciu
problemu.

## 17. Plan naprawczy i raportowanie realizacji

Plan naprawczy musi odróżniać:

- natychmiastową korekcję skutku;
- analizę przyczyny źródłowej;
- działanie korygujące zapobiegające ponownemu wystąpieniu;
- właściciela, termin i wymagane zasoby;
- dowód wdrożenia;
- sposób, termin i właściciela weryfikacji skuteczności;
- powiązaną inicjatywę, jeśli zmiana przekracza pojedyncze zadanie.

Audits generuje wersjonowane raporty realizacji planu naprawczego pokazujące:

- postęp i terminowość;
- elementy bez właściciela lub dowodu;
- działania opóźnione, odrzucone i ponownie otwarte;
- wynik weryfikacji skuteczności;
- zmianę ryzyka rezydualnego;
- status inicjatyw wdrożeniowych;
- prognozę zamknięcia.

Raport postępu jest snapshotem na datę. Aktualny stan działań pozostaje w
My Work, Initiatives i Execution.

## 18. Programy cykliczne

Program może być jednorazowy lub cykliczny. Kolejny cykl:

- zachowuje bibliotekę wymagań, ale tworzy nowy snapshot;
- nie kopiuje automatycznie starej oceny jako aktualnej;
- wskazuje ustalenia powracające;
- porównuje zmianę dowodów, wyników i terminowości;
- pokazuje działania zamknięte, przeterminowane i ponownie otwarte.

## 19. Raport poaudytowy

Raport jest rezultatem audytu, ale nie jego źródłem prawdy. Powstaje z
zatwierdzonych wymagań, testów i findingów.

Powinien oferować:

- executive summary;
- cel, zakres, ograniczenia i zastosowane kryteria;
- metodę oraz wykonane procedury;
- wynik per obszar i wymaganie;
- findingi z dowodami;
- management responses i plan działań;
- lista inicjatyw wdrożeniowych wynikających z zatwierdzonych findingów;
- ryzyko rezydualne;
- porównanie z poprzednim cyklem;
- załączniki i lineage;
- draft, review, final oraz kontrolowaną korektę po publikacji.

PDF jest eksportem wersji raportu, nie kanonicznym miejscem jego edycji.

## 20. Uprawnienia, kompetencje i niezależność

Minimalne role:

- **Program Owner** — zakres, zasoby i odbiór programu;
- **Lead Auditor** — plan, review i formalne ustalenia;
- **Auditor** — procedury, dowody i drafty findingów;
- **Evidence Provider** — dostarcza materiały, ale nie zatwierdza findingu;
- **Finding Owner** — odpowiada i realizuje naprawę;
- **Approver/Risk Owner** — akceptuje odpowiedź lub ryzyko rezydualne;
- **Viewer** — kontrolowany odczyt.

Osoba audytowana nie może sama zatwierdzić własnego findingu jako zamkniętego.
Każda zmiana kryterium, dowodu, oceny, findingu, odpowiedzi, ryzyka i raportu
pozostawia audit trail.

Blueprint może określać wymagane kompetencje i ważność kwalifikacji. Jest to
ważne m.in. dla VDA 6.3, gdzie oficjalne wymagania obejmują kwalifikację,
doświadczenie oraz utrzymywanie kompetencji audytora. System kontroluje
spełnienie wymogu, lecz nie wydaje własnego certyfikatu VDA ani ISO.

## 21. Kanon UI/UX i zasada ponownego użycia

Audits nie tworzy osobnego języka interfejsu. Nowa jest logika audytowa, ale
jej prezentacja i obsługa powstają z istniejących standardów Consultify.
Obowiązuje zasada **reuse before create**.

### Obowiązujące źródła standardu

- `docs/ui-standards/CANON.md`;
- `docs/ui-standards/TRIADA_KANON.md`;
- `docs/ui-standards/UI_UX_CANON_V3.md`;
- `docs/ui-standards/03-modules/module-hub-standard.md`;
- `docs/ui-standards/03-modules/TABLE_AND_PREVIEW_CANON.md`;
- `docs/ui-standards/03-modules/INSIGHT_CANON.md`;
- `docs/ui-standards/03-modules/TABLE_AUDIT_SHEET_TEMPLATE.md`;
- `docs/ui-standards/03-modules/KEBAB_MENU_STANDARD.md`;
- kanoniczne komponenty Interview, Materials, My Work i Initiatives.

### Mapowanie powierzchni Audits na istniejące wzorce

| Potrzeba Audits | Obowiązujący wzorzec |
| --- | --- |
| lista programów, blueprintów, findingów i planów | `StandardModuleBar` + `StandardTable` |
| szybki podgląd zaznaczonego elementu | `StandardPreview` zgodny z Triadą |
| filtry, statusy i działania kontekstowe | Menu 3 / Command Row |
| akcje wiersza | istniejący Kebab Menu Standard |
| utworzenie programu lub import blueprintu | istniejący wizard i `WizardStepper` |
| arkusz pytań i odpowiedzi | istniejący model/shell Interview, rozszerzony metadanymi wymagania i dowodu |
| insight lub propozycja Teresy | istniejący Insight Canon z provenance, confidence i review |
| formalny finding | ten sam język kart/list/preview, ale osobny typ domenowy z requirement/evidence/severity |
| arkusz audytu i checklisty | istniejący Table Audit Sheet oraz Table Platform |
| dokument źródłowy i dowód | Materials z wersją, preview i source link |
| raport poaudytowy i postępu | istniejący Document/Report Studio oraz standard eksportu |
| plan naprawczy | istniejące tabele zadań, Initiative sections i Execution |
| daty audytów | istniejący Timeline/Calendar Canon |
| stany systemowe | wspólne loading/empty/error/degraded oraz dark/light |

### Arkusz pytań

Nie powstaje drugi, audytowy silnik formularzy. Audit Blueprint generuje
konfigurację dla istniejącego Interview:

- pytanie zachowuje identyfikator wymagania i fragment źródła;
- odpowiedź może wymagać określonego typu dowodu;
- blueprint określa obowiązkowość, scoring i reguły stosowalności;
- respondent korzysta ze znanego shellu Interview;
- audytor otrzymuje dodatkowy kontekst evidence/test, bez zmiany podstawowego
  sposobu odpowiadania.

### Insights i findingi

Propozycje Teresy wykorzystują istniejący wygląd insightu: źródło, confidence,
status review i działanie następne. Zatwierdzony finding jest jednak osobnym
obiektem biznesowym. Nie wolno zmienić nazwy insightu na finding bez
requirement, evidence, testu i akceptacji audytora.

### Twarde zakazy

- brak nowej równoległej tabeli, preview, modala, menu akcji albo systemu kart;
- brak drugiego edytora dokumentów, arkuszy lub raportów;
- brak osobnego form engine dla pytań audytowych;
- brak lokalnych kolorów i statusów sprzecznych z tokenami aplikacji;
- brak dublowania akcji AI w canvasie i Menu 3;
- brak implementacji na podstawie samego mockupu bez mapy do komponentów
  kanonicznych.

Nowy komponent jest dopuszczalny wyłącznie dla semantyki, której nie potrafi
obsłużyć istniejący system, np. mapowania requirement → evidence → test.
Wymaga wtedy krótkiej decyzji architektonicznej, uzasadnienia braku istniejącego
wzorca oraz włączenia komponentu do wspólnego standardu — nie tylko do Audits.

## 22. Stan obecny zweryfikowany w kodzie

### Mamy

- publiczną powierzchnię pokazową `/audits`;
- uwierzytelniony, funkcjonalny hub `/audit-programs`;
- badge `beta` oraz otwarty `BetaGate`;
- kreator: cel/preset → szablony Interview → przypisani → review;
- dwa statyczne presety nazwane ISO 27001 i „New company discovery”; nie są
  jeszcze pełnymi, ekspercko zweryfikowanymi blueprintami;
- programy `draft/active/completed/archived`;
- CRUD programu, wyszukiwanie, filtrowanie i paginację;
- generowanie rzeczywistych przypisań Interview jako templates × assignees;
- idempotency guard, częściowe błędy i completion rollup;
- izolację organizacji w API;
- testy huba, wizarda, tras i serwisu na SQLite;
- osobną, flagowaną listę raportów DRD i edytor raportu, które merytorycznie
  należą do Assessment i powinny zostać stąd usunięte;
- istniejący most audit finding → draft Initiative;
- tabele `audits` i opcjonalne `audit_findings`.

### Fragmentaryczne lub ryzykowne

- `/audits` i `/audit-programs` sugerują dwie różne wersje produktu;
- Audit Program jest dziś głównie kontenerem nad Interview assignments;
- plan presetów jest statyczną heurystyką, nie pełnym planem audytu;
- brakuje kanonicznego modelu Requirement, Evidence Request, Evidence, Test,
  Management Response i Corrective Action;
- `audit_programs`, starsze `audits` i `audit_findings` nie tworzą jednego
  czytelnego modelu;
- raporty DRD są rekordami Assessment, a nie raportami konkretnego Audit Program;
- edycja programu jest ukryta flagą;
- nie ma potwierdzonego pionu evidence → finding → action → verification;
- stare komentarze backendu mówią, że survey generation jest TODO, mimo że
  obecny kod już je wykonuje;
- techniczne audit logs i audyty biznesowe używają podobnych nazw;
- część wcześniejszej dokumentacji nadal opisuje niezamontowany hub, co jest
  nieaktualne.
- brak importu normy/instrukcji oraz generatora Audit Blueprint;
- brak organizacyjnego planu audytów;
- brak planu naprawczego, weryfikacji skuteczności i raportów jego realizacji.

## 23. Najważniejsza decyzja architektoniczna

Przyjąć `AuditProgram` jako korzeń agregatu i scalić wokół niego:

`Source Document → Audit Blueprint → Organization Audit Plan → Audit Program →
Scope → Requirement → Evidence Request → Evidence Snapshot → Test → Finding →
Audit Report → Corrective Action Plan → Initiative/Task → Effectiveness
Verification → Remediation Progress Report → Closure`

Interview assignments pozostają sposobem zbierania informacji, a nie modelem
samego audytu. Stare `audits` i `audit_findings` należy zmapować lub migrować do
tego modelu; nie rozwijać trzeciej równoległej ścieżki.

## 24. Pierwszy golden flow do odbioru

Nie zaczynać od wszystkich standardów ani zaawansowanego generatora raportów.
Pierwszy pion:

**wgranie krótkiej, legalnie dostępnej instrukcji → draft blueprintu z lineage
→ review eksperta → program → jedno wymaganie → Evidence Request → Interview
lub dokument → finding Teresy → review audytora → raport poaudytowy → plan
naprawczy → zadanie/inicjatywa → raport postępu → dowód naprawy → weryfikacja
skuteczności → zamknięcie**.

Ten pion sprawdzi prawdziwą wartość Audits i wszystkie najważniejsze handoffy.
Jest to golden flow **drugiej fali**, a nie bramka obecnego MVP.

## 25. Kryteria ukończenia

1. Audit Program jest jedynym korzeniem biznesowego audytu.
2. Każdy finding ma wymaganie, dowody i wykonaną procedurę.
3. Dowód wskazuje konkretną wersję materiału i zachowuje provenance.
4. Teresa tworzy propozycje, a audytor zatwierdza formalne ustalenia.
5. Brak dowodu nie jest automatycznie niezgodnością.
6. Management Response i ryzyko rezydualne mają uprawnionych właścicieli.
7. Działanie naprawcze istnieje w My Work lub Initiatives z read-backiem.
8. Zamknięcie findingu wymaga niezależnej weryfikacji.
9. Raport wynika z zatwierdzonych danych i jest wersjonowany.
10. Program może zostać wznowiony jako nowy cykl bez fałszywego kopiowania ocen.
11. Uprawnienia i izolacja organizacji mają testy deny-path.
12. Wszystkie ważne zmiany pozostawiają techniczny audit trail.
13. Publiczny `/audits` nie konkuruje z kanonicznym modułem aplikacji.
14. E2E przechodzi cały pierwszy golden flow na stagingu.
15. UI spełnia kanon 2026: standardowy hub, czytelna hierarchia, stany,
    responsive, dark/light i dostępność.
16. Import dokumentu tworzy draft blueprintu z mapowaniem do źródła.
17. Ekspert może poprawić i zatwierdzić blueprint przed użyciem.
18. Zmiana źródła tworzy nową wersję i nie zmienia trwającego programu.
19. Audits nie pokazuje DRD ani SIRI jako własnych metod lub raportów.
20. Raport poaudytowy prowadzi do planu naprawczego i inicjatyw.
21. System tworzy cykliczny raport realizacji planu naprawczego.
22. Zamknięcie findingu wymaga dowodu skuteczności, nie tylko statusu zadania.
23. Blueprint egzekwuje reguły konkretnej metodyki, np. komplet pytań VDA.
24. Każda powierzchnia ma wskazany istniejący wzorzec i komponent bazowy.
25. Arkusze pytań używają Interview, a raporty i arkusze używają Materials.
26. Tabela, preview, Menu 3, kebab, wizard, insight i stany są zgodne z
    kanonami aplikacji.
27. Odstępstwo UI wymaga jawnej decyzji i aktualizacji standardu wspólnego.

## 26. Rekomendacja Codex

Audits ma potencjał stać się **warstwą zaufania Consultify**: miejscem, które
odróżnia opinię od dowodu, propozycję AI od zatwierdzonego ustalenia oraz
deklarację naprawy od zweryfikowanego zamknięcia.

Najpierw należy scalić model danych i wykonać jeden mały, formalny pion.
Rozbudowa katalogu norm i pięknego raportowania ma sens dopiero po potwierdzeniu
evidence chain.

## 27. Decyzje zatwierdzone

1. Tools, Assessment i Audits są trzema osobnymi produktami.
2. Assessment zawiera zamknięte, płatne postępowania rozwoju cyfrowego,
   w szczególności DRD i SIRI.
3. Audits służy formalnym audytom branżowym i organizacyjnym, np. ISO i VDA.
4. Audits generuje draft postępowania z dostarczonej normy lub instrukcji.
5. Wynik obejmuje raport poaudytowy, plan naprawczy, inicjatywy wdrożeniowe
   oraz raporty realizacji planu.
6. Organizacja może budować i realizować własny plan audytów.
7. Audits nie wchodzi do MVP i będzie implementowany w drugiej fali produktu.
8. Audits używa istniejących standardów tabel, preview, Menu 3, wizardów,
   insightów, arkuszy pytań i Materials; nie tworzy równoległego systemu UI.

## 28. Otwarte decyzje właścicielskie

Do zatwierdzenia lub korekty:

1. Czy zewnętrzny audytor może otrzymać ograniczony dostęp bez pełnego konta
   członka organizacji?
2. Czy formalne zamknięcie findingu zawsze wymaga innej osoby niż Finding Owner?
3. Czy akceptacja ryzyka rezydualnego ma wymagać Owner/Admin albo wskazanej roli
   Risk Owner?
4. Czy każdy program może być cykliczny i tworzyć porównywalne edycje?
5. Czy publiczne `/audits` pozostaje stroną marketingową/showcase, czy powinno
   otrzymać inną nazwę i adres, aby nie konkurowało z produktem?
6. Który legalnie dostępny dokument wybieramy jako pierwszy wzorcowy import:
   własną instrukcję, wybrany fragment ISO czy checklistę VDA?

## 29. Źródła i benchmark

- `src/components/Audit/AuditsHub.tsx`;
- `src/components/Audit/AuditOrchestratorWizard.tsx`;
- `src/components/Audit/auditApi.ts`;
- `src/components/Audit/auditPresets.ts`;
- `src/views/AuditsShowcasePage.tsx`;
- `src/views/DRDAuditReportView.tsx`;
- `server/src/routes/audit-programs.routes.ts`;
- `server/src/services/auditProgramService.ts`;
- `server/src/services/initiative/auditInitiativeService.ts`;
- `server/migrations/20260627_audits.sql`;
- `server/src/routes/__tests__/audit-programs.test.ts`;
- `server/src/services/__tests__/auditProgramService.e2e-sqlite.test.ts`.

Oficjalne źródła benchmarku:

- ISO 19011:2026 — zasady audytowania, program audytów, prowadzenie audytu,
  kompetencje, podejście evidence-based i risk-based:
  `https://committee.iso.org/standard/19011`;
- ISO/IAF Auditing Practices Group — przegląd niezgodności, przyczyny,
  działań korygujących i skuteczności przed zamknięciem:
  `https://www.iso.org/files/live/sites/tc176sc2/files/documents/ISO%209001%20Auditing%20Practices%20Group%20docs/Auditing%20General/APG-ReviewNonconformity2015.pdf`;
- VDA QMC VDA 6.3 FAQ — aktualna edycja, kwalifikacje audytora, zasady pytań
  i ograniczenia audytów remote:
  `https://vda-qmc.de/en/aus-und-weiterbildung/vda-6-3-faq/`.

## 30. Granica przekazania do Initiatives

Końcowa zakładka `Initiatives` tworzy lokalne `Initiative Proposal Drafts` z
findingów, nie pełne Initiative. Draft pozostaje w Audit i jest widoczny zespołowi
audytowemu do czasu Source Validation. Dopiero jawne `Register as Initiative`
tworzy obiekt w rejestrze Initiatives. Dalszą ścieżkę określa
[`INITIATIVE_END_TO_END_LIFECYCLE.md`](INITIATIVE_END_TO_END_LIFECYCLE.md).

## 31. Library First

Pierwszą i domyślną zakładką Audits jest **Library**, a drugą **Processes** zgodnie
z [`METHOD_LIBRARY_FIRST_STANDARD.md`](METHOD_LIBRARY_FIRST_STANDARD.md).

Library zawiera wersjonowane Audit Standard/Program Templates: zakres i typ
audytu, źródło standardu, kwalifikacje i niezależność, wymagane evidence,
sampling, scoring/findings, corrective process, cykliczność, expected reports,
licencję oraz readiness. Start tworzy Audit Plan/Engagement; aktywne procesy
pojawiają się dopiero w drugiej zakładce.

Pełny wspólny układ to
[`Library → Processes → Outputs → Deliverables → Initiatives`](METHOD_MODULE_FIVE_SURFACES_STANDARD.md).
Assignments, evidence requests i corrective review znajdują się w
Processes/Workspace oraz My Work, a nie w osobnej głównej zakładce.
