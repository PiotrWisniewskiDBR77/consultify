---
agreement_id: MOD-AGR-05
module: Materials
status: ACCEPTED_DIRECTION_OPEN_DETAILS
owner: piotr
prepared_by: codex
accepted_by: piotr
accepted_at: 2026-07-31
last_reviewed: 2026-07-31
---

# Karta uzgodnienia — Materials

## 1. Proponowana definicja

**Materials (Materiały)** to wspólna biblioteka i środowisko tworzenia
profesjonalnych rezultatów pracy Consultify:

- dokumentów i raportów;
- prezentacji;
- arkuszy i modeli Excel;
- eksportów oraz bezpiecznych wersji do udostępnienia.

Materiały są miejscem, w którym wiedza, analiza i decyzje z całej aplikacji
przyjmują formę gotową do przeczytania, podjęcia decyzji, przekazania klientowi
albo dalszej pracy. Nie są katalogiem przypadkowych plików ani zbiorem osobnych
„Studio”.

## 2. Obietnica użytkownikowi

Użytkownik powinien móc:

- rozpocząć od pustego materiału, rozmowy z Teresą albo szablonu;
- przejść do Materials z dowolnego modułu z zachowanym kontekstem;
- stworzyć rzeczywisty dokument, prezentację albo workbook;
- pracować ręcznie, z lokalną pomocą AI i globalnie z Teresą;
- wznowić pracę po zamknięciu aplikacji;
- widzieć źródła tez, liczb, tabel i wykresów;
- przeprowadzić review, zatwierdzić wersję i bezpiecznie ją udostępnić;
- wyeksportować natywny DOCX, PPTX albo XLSX oraz PDF;
- utworzyć albo zastosować prawdziwy szablon danego formatu;
- mieć pewność, że regeneracja nie usunie ręcznych poprawek.

## 3. Jeden moduł, trzy równorzędne formaty

| Format | Rola |
| --- | --- |
| **Dokument** | raport, memorandum, rekomendacja, analiza lub dokumentacja |
| **Prezentacja** | narracja do decyzji, spotkania, sprzedaży lub komunikacji |
| **Arkusz** | model, kalkulacja, analiza danych, scenariusz, plan lub dashboard |

PDF jest powierzchnią publikacji/eksportu, nie czwartym edytorem.

Raport jest rodzajem dokumentu albo pakietu danych, a nie osobną aplikacją.
Historyczne Outputs, Documents, Presentations, Tables i Excel pozostają
podsystemami technicznymi jednego Materials.

## 4. Nawigacja

Materials ma jedno wejście w głównym menu i pięć zakładek:

1. Wszystkie;
2. Dokumenty;
3. Prezentacje;
4. Arkusze;
5. Szablony.

Nie tworzymy osobnych pozycji głównego menu dla Excel, Document Studio,
Presentation Studio, Table Studio ani Report Builder. Stare trasy mogą pozostać
przejściowo jako deep linki lub redirecty.

## 5. Trzy sposoby rozpoczęcia

Po wyborze formatu użytkownik wybiera:

1. **Czysto** — prawdziwy pusty dokument, deck albo workbook.
2. **Z AI** — rozmowa z Teresą o celu, odbiorcy i dostępnym kontekście.
3. **Z szablonu** — wybór zatwierdzonego blueprintu odpowiedniego formatu.

Materiały mogą być uruchomione:

- z biblioteki przez „Dodaj”;
- z rozmowy z Teresą;
- kontekstowo z Organization, Interview, Tools, Assessment, Audits,
  Initiatives, Execution, Results, Finance, Meeting, My Work lub Canvas;
- przez import istniejącego pliku.

Pierwszy ekran nie jest technicznym formularzem. Zaawansowane parametry są
ustalane przez rozmowę, rekomendację albo późniejsze właściwości.

## 6. Obowiązkowa faza myślenia przed produkcją

Żaden większy materiał ani szablon nie powinien przechodzić bezpośrednio od
jednego zdania użytkownika do kosztownej generacji. Najpierw Teresa albo
dedykowane okno przygotowuje **Generation Brief** — czytelne podsumowanie tego,
co system zamierza utworzyć.

Przepływ:

`intencja → analiza kontekstu → Generation Brief → review użytkownika →
zatwierdzenie → produkcja → QA → preview`

Użytkownik może brief:

- zatwierdzić;
- poprawić w rozmowie z Teresą;
- edytować bezpośrednio;
- poprosić o alternatywny wariant;
- wrócić do wyboru formatu lub szablonu;
- zapisać jako podstawę przyszłego template.

### Dokument

Brief pokazuje:

- cel, odbiorcę i oczekiwany rezultat;
- proponowany tytuł, tezę i ton;
- outline sekcji;
- najważniejsze pytania, tezy i rekomendacje;
- źródła oraz braki danych;
- przewidywaną długość;
- plan tabel, wykresów, grafik i załączników;
- template, theme i formatting;
- elementy wymagające review.

### Prezentacja

Brief pokazuje:

- cel spotkania i decyzję, do której ma prowadzić deck;
- odbiorców i kontekst prezentacji;
- główną historię oraz key message;
- outline slajdów z tytułem-wnioskiem każdego slajdu;
- proponowany typ layoutu i wizualizacji per slajd;
- plan grafik, wykresów, tabel i źródeł;
- długość, theme, brand i ton;
- elementy niepewne albo brakujące.

### Arkusz

Brief nie jest outline’em narracji, lecz **kontraktem modelu**:

- cel biznesowy i pytania, na które odpowiada workbook;
- wejścia, założenia, jednostki i źródła;
- lista sheets oraz rola każdego z nich;
- logika obliczeń i kluczowe zależności;
- plan formuł, named ranges, tabel i wykresów;
- scenariusze oraz parametry zmienne;
- oczekiwane outputs i testy poprawności;
- brakujące dane i decyzje użytkownika;
- zakres kompatybilności z Excel.

### Szablon

Przed utworzeniem template Teresa pokazuje:

- typ materiału, cel i odbiorców;
- strukturę blueprintu;
- elementy stałe, opcjonalne i generowane;
- wymagane źródła;
- reguły jakości;
- plan wizualny i formatting;
- przykładowy wynik albo reprezentatywny fragment;
- różnice względem podobnych istniejących szablonów.

Generation Brief jest wersjonowany i zostaje zapisany przy runie. Dzięki temu
można porównać plan z wynikiem i wyjaśnić, dlaczego materiał wygląda w określony
sposób.

## 7. Kanoniczny materiał

Każdy materiał posiada:

- stabilne ID i organizację;
- format oraz podtyp;
- tytuł, opis, właściciela i dostęp;
- status i lifecycle;
- kanoniczny model treści;
- wersje oraz snapshoty;
- ręczne nadpisania;
- źródła i powiązane obiekty;
- użyty template, theme i formatting;
- historię generacji, edycji, review i publikacji;
- listę eksportów i share linków;
- stan jakości i ostrzeżenia;
- informacje o wykorzystaniu danych live.

Materiał jest jeden, a viewer, share link i eksport są projekcjami tej samej
wersji — nie osobnymi kopiami bez wspólnej historii.

## 8. Szablon, theme i formatting

To trzy osobne warstwy:

- **Template** — struktura i logika treści;
- **Theme** — marka: kolory, fonty, logo i styl wizualny;
- **Formatting** — reguły techniczne danego formatu.

Zmiana marki nie tworzy nowej kopii struktury. Zmiana template nie może
bez zgody usunąć treści ani ręcznych poprawek.

## 9. Blueprint szablonu

Szablon nie jest pustym plikiem ani skórką. Definiuje:

- odbiorcę, cel i oczekiwany rezultat;
- strukturę sekcji, slajdów albo sheets;
- semantyczne typy bloków;
- wymagane dane i źródła;
- reguły generacji oraz dozwolone AI;
- reguły spójności narracji i liczb;
- wymagane wykresy, tabele albo formuły;
- bramki jakości i review;
- dozwolone eksporty;
- wersję, scope i lifecycle.

Jednostka blueprintu zależy od formatu:

| Format | Jednostka |
| --- | --- |
| Dokument | sekcja, podsekcja, tabela, wykres, rekomendacja, załącznik |
| Prezentacja | slajd, grupa slajdów, intencja, layout, speaker notes |
| Arkusz | sheet, obszar wejść, model, named range, tabela, wykres, dashboard |

## 10. Wspólna biblioteka szablonów

Jedna zakładka agreguje trzy rejestry przez wspólny kontrakt:

- dokumenty — `document_studio_templates`;
- prezentacje — `presentation_templates`;
- arkusze — workbook template registry.

`report_builder_templates` pozostaje legacy. `tp_base_templates` należy do
Table Studio i nie jest katalogiem finalnych szablonów Excel.

Każdy szablon można rozpocząć:

- czysto;
- z AI;
- przez klonowanie/adaptację istniejącego.

AI może zaproponować szablon lub wydobyć strukturę z materiału, ale nie
publikuje go organizacji bez review.

## 11. Dokument

Dokument powinien obsługiwać:

- outline oraz sekcje;
- semantyczne bloki tekstu, tabel, wykresów, KPI, cytatów i rekomendacji;
- edycję rich text;
- komentarze i review;
- inline AI na zaznaczonym fragmencie;
- globalną rozmowę z Teresą;
- diff propozycji przed zastosowaniem;
- źródła przy krytycznych twierdzeniach;
- QA struktury, treści i fabrication;
- DOCX oraz PDF;
- share reader z kontrolowanymi komentarzami.

## 12. Prezentacja

Prezentacja powinna obsługiwać:

- outline i narrację;
- intencję każdego slajdu;
- różnorodne, kontrolowane layouty;
- edycję tekstu, wykresów, tabel, obrazów i speaker notes;
- pracę AI na slajdzie oraz całym decku;
- źródła przy tezach i liczbach;
- theme/brand;
- VisionQA i content quality gate;
- preview, share link i embed;
- PPTX, PDF i — pomocniczo — render PNG.

Tytuł slajdu komunikuje wniosek, nie tylko temat.

### Poziom wizualny Gamma+

Generowanie prezentacji musi osiągnąć co najmniej poziom użyteczności i
atrakcyjności narzędzi klasy Gamma, a docelowo przewyższać je dzięki lepszemu
wykorzystaniu wiedzy organizacji, źródeł i logiki konsultingowej.

Potrzebny jest kontrolowany system:

- semantycznych typów slajdów i layoutów;
- reguł doboru layoutu do intencji oraz ilości treści;
- wariantów kompozycji zapobiegających monotonii;
- hierarchii wizualnej i rytmu całego decku;
- wykresów, tabel, diagramów, ikon i ilustracji;
- image routera dobierającego stock, generację albo grafikę brandową;
- promptów graficznych wynikających z treści i brandu;
- bezpiecznego tekstu w grafikach;
- źródeł i praw do wykorzystanych obrazów;
- VisionQA sprawdzającego overflow, czytelność, kontrast, spójność i sens;
- fallbacków jawnych oraz jakościowych, nigdy pustych placeholderów.

Layout Director najpierw określa intencję slajdu, następnie wybiera rodzinę
layoutu, a dopiero potem generuje treść i grafikę do dostępnej pojemności.
Nie wolno wciskać gotowego tekstu w przypadkowy layout.

## 13. Arkusz i Excel

Arkusz jest rzeczywistym workbookiem, nie tabelą udającą Excel. Powinien mieć:

- wiele sheets;
- adresy komórek i zakresy;
- formuły oraz graf zależności;
- named ranges;
- typy i formaty liczb;
- walidacje;
- formatowanie warunkowe;
- tabele, wykresy i dashboardy;
- wejścia, założenia i wyniki;
- źródła wartości;
- kontrolę błędów oraz cykli;
- preview i ograniczoną edycję w aplikacji;
- import i eksport XLSX.

Table Studio jest relacyjnym źródłem danych i narzędziem operacyjnym.
Workbook jest finalnym materiałem analitycznym. Mogą się zasilać, ale nie są
tym samym produktem.

Decyzja technologiczna pozostaje hybrydowa:

- Consultify posiada model workbooka, generatory, AI, governance i eksport;
- grid oraz silnik formuł mogą korzystać z gotowych komponentów po spike’u
  technicznym i licencyjnym;
- nie próbujemy ręcznie odtwarzać pełnego Excela;
- nie kupujemy licencji przed potwierdzeniem integracji i realnego zakresu.

## 14. Generatory

Każdy format ma ten sam kontrakt procesu:

`intencja → source pack → Generation Brief → review/approval → produkcja →
QA → preview → review → zapis wersji`

Generator:

- pokazuje, co zamierza utworzyć;
- wskazuje użyte źródła;
- sygnalizuje brak danych;
- raportuje postęp per sekcja/slajd/sheet;
- nie podstawia placeholderów jako gotowej treści;
- nie stosuje cichego fallbacku do uboższego formatu;
- nie nadpisuje ręcznych zmian bez diffu;
- pozwala wznowić przerwany run.

## 15. Rola Teresy

Teresa:

- pomaga dobrać format do celu i odbiorcy;
- buduje source pack z dozwolonego kontekstu;
- proponuje template, outline i sposób prezentacji;
- prowadzi użytkownika przez braki danych;
- pracuje globalnie nad całym materiałem;
- rozumie źródła, strukturę i aktualny status;
- proponuje zmiany jako diff;
- może uruchomić lokalne narzędzia danego Studio;
- po akceptacji materializuje decyzje lub rekomendacje do owner modules.

Teresa nie może:

- wymyślać liczb ani źródeł;
- uznać eksportu za udany bez wygenerowanego pliku;
- zmienić zatwierdzonej wersji;
- po regeneracji usunąć ręcznych nadpisań;
- wysłać albo opublikować materiał bez uprawnienia;
- zamienić brakującego obrazu, wykresu lub formuły na niewidoczny fallback.

## 16. Edycja warstwowa

Treść ma co najmniej dwie warstwy:

1. wynik generowany;
2. ręczne nadpisania użytkownika.

Regeneracja tworzy propozycję scalenia. Użytkownik widzi zachowane, zmienione
i konfliktowe elementy. Akceptuje całość albo fragmenty.

Mechanizm musi działać odpowiednio dla sekcji, slajdu i sheet/range.

## 17. Lifecycle

Rekomendowany lifecycle:

`Draft → In review → Authorized → Sent/Published → Archived`

- **Draft** — swobodna edycja;
- **In review** — komentarze, diff i kontrola zmian;
- **Authorized** — zamrożony snapshot gotowy do użycia;
- **Sent/Published** — dokładna wersja została udostępniona;
- **Archived** — zachowana historycznie.

Zmiana Authorized lub Sent tworzy nowy Draft. Nie nadpisuje wersji wysłanej.

## 18. Źródła i „księga faktów”

Każda istotna teza, liczba, tabela i wykres powinna wskazywać:

- obiekt źródłowy;
- wersję/snapshot;
- datę pobrania;
- transformację;
- autora lub proces generacji;
- stan aktualności;
- ewentualne ręczne nadpisanie.

Ta sama zatwierdzona liczba użyta w dokumencie, decku i workbooku powinna
odwoływać się do jednego faktu, a nie do trzech kopii.

## 19. Static, live i authorized

- **Static** — wynik utrwalony na konkretny moment.
- **Live** — wybrane dane odświeżają się z owner modules.
- **Authorized** — zatwierdzony snapshot, którego live update nie zmienia.

Live dotyczy przede wszystkim danych, statusów, dat i KPI. Narracja nie
regeneruje się automatycznie bez jawnego polecenia.

Live binding i harmonogram należą do drugiej fali, chyba że konkretny raport
MVP wymaga minimalnego read-backu.

## 20. Viewer, link, pobieranie i wysyłka

Każdy zatwierdzony materiał ma cztery równorzędne sposoby wykorzystania:

1. viewer w aplikacji;
2. kontrolowany share link;
3. pobranie natywnego pliku lub PDF;
4. wysłanie linku albo pliku jako załącznika.

Viewer jest pełnoprawną powierzchnią odbioru: dokument przewija się jak
dokument, prezentację można uruchomić w trybie prezentowania, a workbook ma
bezpieczny preview sheets, danych i wykresów.

Share link powinien obsługiwać:

- konkretną wersję albo — po jawnej decyzji — wersję live;
- datę wygaśnięcia;
- hasło lub weryfikację odbiorcy;
- uprawnienie view/comment/download;
- odwołanie dostępu;
- branding;
- audit trail otwarć i pobrań zgodny z polityką prywatności.

Wysyłka powinna korzystać ze wspólnego mechanizmu delivery:

- wybór linku albo załącznika;
- wybór dokładnej zatwierdzonej wersji;
- preview odbiorców, tematu i treści wiadomości;
- kontrola rozmiaru oraz typu pliku;
- jawne potwierdzenie użytkownika;
- zapis zdarzenia wysłania i statusu błędu;
- brak automatycznej wysyłki przez AI bez uprawnienia.

Macierz MVP:

| Materiał | Natywny eksport | Dodatkowo |
| --- | --- | --- |
| Dokument | DOCX | PDF |
| Prezentacja | PPTX | PDF |
| Arkusz | XLSX | PDF/print preview, jeśli jakość pozwala |

Eksport przechodzi content, formatting i integrity gate. System zachowuje
hash/identyfikator eksportowanej wersji.

## 21. Jakość

Wspólne bramki:

- brak placeholderów i pustych sekcji udających wynik;
- zgodność z template i theme;
- czytelność oraz dostępność;
- zgodność liczb i jednostek;
- provenance krytycznych twierdzeń;
- poprawność pliku po eksporcie;
- brak obcięć, overflow i uszkodzonych znaków;
- review finansów przy wartościach krytycznych;
- ostrzeżenie o nieaktualnych źródłach;
- wizualny render-and-inspect dla każdego eksportu.

## 22. Integracje i własność

| Moduł | Kontrakt |
| --- | --- |
| Organization | brand, profil, zatwierdzony kontekst i uprawnienia |
| Chat/Teresa | intencja, source pack, generacja i globalna edycja |
| My Work | pomysły/notatki jako źródło; review i zadania związane z materiałem |
| Interview | odpowiedzi, cytaty i insights jako źródła |
| Tools | zaakceptowany wynik sesji jako źródło |
| Assessment | scoring, luki i raport źródłowy |
| Audits | dowody, raport poaudytowy i raporty realizacji |
| Initiatives | dane i decyzje projektu; odbiera zatwierdzone rekomendacje |
| Execution | status wykonania i raportowanie |
| Results | właściciel KPI, pomiarów i efektów |
| Finance | właściciel modeli, założeń i wartości finansowych |
| Meeting | pre-read, materiały robocze i publikowany protokół |

Materials jest właścicielem formy, wersji, publikacji i eksportu. Nie staje się
właścicielem danych biznesowych pochodzących z innych modułów.

## 23. Wspólna formuła pracy i menu

Dokumenty, prezentacje, arkusze oraz ich template używają jednego języka
nawigacji i pracy:

- wspólny Material Header;
- Menu 2 dla głównych trybów/sekcji materiału;
- Menu 3 dla kontekstu, statusu, źródeł i akcji AI;
- wspólne File, Edit, Insert, Review, Share/Export w zakresie adekwatnym do
  formatu;
- wspólny sposób otwierania outline/structure, properties, sources, comments,
  versions, QA i Teresa;
- wspólne stany save/saving/saved/error;
- ten sam lifecycle i status chips;
- ten sam model diff, review, approval i publication;
- te same zasady keyboard, accessibility, responsive i dark/light.

Wspólna formuła nie oznacza identycznych przepływów:

- dokument pracuje sekcjami i blokami tekstowymi;
- prezentacja slajdami, narracją i layoutami;
- workbook sheets, komórkami, formułami i wykresami;
- template blueprintem, regułami i preview przykładowego wyniku.

Nie budujemy jednego „uniwersalnego edytora”, który spłaszcza cechy formatów.
Budujemy wspólny shell i kontrakt zachowań oraz wyspecjalizowane edytory.

## 24. Kanon UI/UX

Materials korzysta z istniejących standardów:

- jedna biblioteka jako standardowy hub;
- StandardTable + StandardPreview dla list;
- Menu 3 dla filtrów i działań kontekstowych;
- kanoniczne edytory właściwe formatowi;
- jeden system bloków semantycznych;
- istniejące standardy komentarzy, review, diff i AI proposals;
- wspólne loading/empty/error/degraded;
- light/dark, responsive i accessibility;
- nie dubluje toolbarów ani akcji AI.

Wspólny shell nie oznacza identycznego edytora. Dokument, deck i workbook
zachowują właściwe dla formatu narzędzia.

## 25. Stan obecny zweryfikowany

### Mamy

- jedną pozycję menu Materials pod technicznym `MODULE_PRESENTATIONS`;
- hub `ReportsAndPresentationsHub`;
- zakładki/obszary raportów, prezentacji, sheets, templates i data sources;
- Document Studio z edytorem, blokami, outline, inline AI, diff, komentarzami,
  QA, template architect, share reader i backendem;
- Presentation Studio/Deck Builder z generacją, źródłami, layoutami, QA,
  governance, share/embed i eksportami;
- Table Platform z relacjami, źródłami, formularzami, automatyzacją, AI editor,
  QA i konwersjami;
- osobny workbook/Excel runtime, komórki, formuły, klonowanie i eksport;
- artifact registry, runs, approvals, conversions i część wspólnego lifecycle;
- szeroki zestaw testów per podsystem.

### Fragmentaryczne lub ryzykowne

- hub nadal importuje `mockData`;
- wiele historycznych tras, redirectów i launcherów;
- `MODULE_PRESENTATIONS` nie odpowiada nazwie biznesowej Materials;
- kilka modeli artefaktów, wersji, approvals i template registries;
- report, document, presentation, table i workbook mają różne lifecycle;
- Sheets w hubie miesza Table Studio z finalnym Excel;
- nie wszystkie akcje archiwizacji/usuwania mają backend;
- różna dojrzałość eksportów DOCX/PPTX/XLSX/PDF;
- nie ma jednego potwierdzonego E2E save → reopen → version → export;
- generator „z szablonu” nie wszędzie faktycznie przekazuje blueprint;
- biblioteka szablonów może pokazywać duplikaty i głównie typ Report;
- generatory szablonów workbooka są niedokończone;
- obecny formula engine nie stanowi pełnej zgodności z Excel;
- część zaawansowanych usług prezentacji nie ma jasnego wejścia produktowego;
- istnieją rozbudowane funkcje drugiej fali obok braków w podstawowym zapisie.

## 26. Najważniejsze scalenia

1. Jeden `MaterialArtifact` i adaptery formatów.
2. Jeden launcher dla blank/AI/template.
3. Jedna biblioteka materiałów.
4. Jeden kontrakt template z adapterami rejestrów.
5. Jeden lifecycle i approval envelope.
6. Jeden source/provenance envelope.
7. Jeden kontrakt run/progress/error/resume.
8. Jeden eksport gate i evidence wynikowego pliku.
9. Rozdzielenie Table Studio od finalnego workbooka.
10. Jawna klasyfikacja tras: canonical, redirect, compatibility albo legacy.

Nie usuwamy starych danych i kodu przed migracją, read-backiem i możliwością
rollbacku.

## 27. Golden flows MVP

### Dokument

`kontekst → Dokument/Z AI → outline → generacja → ręczna edycja → zapis →
zamknięcie → ponowne otwarcie → review → DOCX/PDF`

### Prezentacja

`kontekst → Prezentacja/Z szablonu → outline → deck → edycja → QA → zapis →
ponowne otwarcie → PPTX/PDF`

### Arkusz

`kontekst/założenia → Arkusz/Z szablonu → workbook z formułami → zmiana
wejścia → przeliczenie → zapis → ponowne otwarcie → XLSX`

### Szablon

`format → czysto/AI/klon → blueprint → review → publish → użycie w nowym
materiale → potwierdzenie struktury`

## 28. Zakres MVP i druga fala

### MVP

- jedna biblioteka;
- trzy formaty;
- blank/AI/template;
- zapis i ponowne otwarcie;
- podstawowe wersjonowanie i review;
- rzeczywiste szablony wszystkich formatów;
- natywne eksporty;
- viewer, share link i kontrolowana wysyłka linku/załącznika;
- Generation Brief przed produkcją;
- provenance;
- quality gates;
- jeden golden flow per format.

### Druga fala

- pełne live binding;
- harmonogram i automatyczna dystrybucja;
- konektory do zewnętrznych baz;
- formularze zewnętrzne jako strumień danych;
- zaawansowane brand ingestion;
- tierowany image router;
- wieloosobowa współedycja;
- rozbudowane warianty audytorium;
- automatyczna pętla uczenia z wykorzystania materiałów.

## 29. Kryteria ukończenia

1. Użytkownik widzi jedno Materials i trzy formaty.
2. Każdy format działa jako blank, AI i from template.
3. Zapis przeżywa reload, wylogowanie i ponowne otwarcie.
4. Ręczne zmiany przeżywają regenerację albo są pokazane w konflikcie.
5. Szablon realnie kształtuje wynik.
6. Każdy format ma działający template registry i generator blueprintu.
7. Dokument eksportuje prawidłowy DOCX i PDF.
8. Prezentacja eksportuje prawidłowy PPTX i PDF.
9. Arkusz zawiera formuły, przelicza się i eksportuje prawidłowy XLSX.
10. Eksport odpowiada zatwierdzonej wersji i przechodzi visual QA.
11. Krytyczne tezy oraz liczby zachowują źródła.
12. Cross-org IDOR jest zablokowany dla treści, wersji, template i share.
13. Share link ma zakres, możliwość odwołania i audit trail.
14. Wszystkie formaty mają honest loading/error/degraded.
15. Stare trasy są sklasyfikowane i bezpiecznie przekierowane.
16. Biblioteka nie pokazuje mocków ani duplikatów jako prawdy użytkownika.
17. E2E przechodzi cztery golden flows na stagingu.
18. UI/UX spełnia wspólne kanony aplikacji i standard danego edytora.
19. Każda generacja pokazuje i zapisuje zatwierdzony Generation Brief.
20. Brief workbooka pokazuje założenia, wejścia, formuły i outputs.
21. Wspólne menu i shell zachowują semantykę każdego formatu.
22. Prezentacje mają zróżnicowane layouty i grafikę na poziomie Gamma lub
    lepszym oraz przechodzą VisionQA.
23. Materiał można obejrzeć w aplikacji, pobrać, udostępnić linkiem i wysłać
    jako link albo załącznik.
24. Delivery zawsze wskazuje dokładną wersję, odbiorcę i audit trail.

## 30. Rekomendowana kolejność realizacji

1. Zamrozić tworzenie nowych launcherów i modeli artefaktu.
2. Zmapować route → component → API → service → table → test dla trzech
   formatów oraz templates.
3. Wybrać kanoniczne rejestry i lifecycle.
4. Naprawić bibliotekę, zapis, reopen i wersję.
5. Domknąć Document golden flow.
6. Domknąć Presentation golden flow.
7. Wykonać spike grid/formula engine i domknąć Workbook golden flow.
8. Scalić generatory oraz bibliotekę szablonów.
9. Uruchomić macierz eksportów i visual QA.
10. Dopiero potem rozwijać funkcje drugiej fali.

## 31. Decyzje zatwierdzone

1. Materials obejmuje wszystkie główne formaty.
2. Excel/workbook jest największym strumieniem.
3. Generatory szablonów workbooka należą do wymaganego zakresu.
4. Jedna pozycja menu zastępuje historyczne wejścia.
5. Excel nie jest osobną pozycją sidebara.
6. Table Studio i workbook są różnymi produktami.
7. Szablon, theme i formatting są oddzielne.
8. Pierwszy poziom wybiera format, drugi blank/AI/template.
9. Nie budujemy pełnego klona Excela w przeglądarce.
10. Wszystkie powierzchnie mają używać istniejących standardów UI/UX.
11. Przed produkcją Teresa lub okno pokazuje Generation Brief do zatwierdzenia.
12. Dokumenty, prezentacje, arkusze i template mają wspólne menu oraz formułę
    pracy, bez spłaszczania różnic formatów.
13. Prezentacje wymagają systemu grafik i layoutów na poziomie Gamma lub lepszym.
14. Materiały można oglądać w aplikacji, pobierać, udostępniać linkiem oraz
    wysyłać jako link lub załącznik.
15. Przyjęto wspólny lifecycle dla trzech formatów.
16. Pojedynczy materiał jest jednostką podstawową, a Bundle opcjonalną.
17. PDF pozostaje eksportem/viewerem.
18. Live binding, harmonogram i automatyczna dystrybucja należą do drugiej fali.
19. Odbiór template zaczyna się od jednego wzorca na format.
20. Table Studio pozostaje źródłem danych, a finalny Excel używa workbooka.

## 32. Otwarte decyzje właścicielskie

Do zatwierdzenia lub korekty:

1. Czy w MVP wysyłamy materiały bezpośrednio przez zintegrowany e-mail, czy
   przygotowujemy link/załącznik i przekazujemy go do systemowego klienta poczty?
2. Czy odbiorca share linku bez konta może komentować po podaniu imienia/e-mail,
   czy komentarze wymagają uwierzytelnienia?
3. Jaki pierwszy wzorcowy zestaw wybieramy dla odbioru: raport zarządczy,
   prezentacja steering committee i model business case?
4. Czy benchmark „Gamma lub lepiej” oceniamy przez jawny zestaw referencyjnych
   promptów i ślepą ocenę decków?

## 33. Źródła

- `docs/functional/10_materials/README.md`;
- `docs/product/MATERIALS_MODULE_MASTER_SPEC.md`;
- `docs/product/MATERIALS_TARGET_STATE_AND_TEMPLATE_CANON_2026-07-24.md`;
- `docs/program/WEEKEND_COMPLETION_2026-08-01/EXCEL_TECHNOLOGY_DECISION.md`;
- `docs/modules/09_outputs/`;
- `docs/modules/10_dokumenty/`;
- `docs/modules/11_tabele/`;
- `docs/modules/12_prezentacje/`;
- `src/components/ReportsAndPresentations/`;
- `src/components/DocumentStudio/`;
- `src/components/PresentationStudio/`;
- `src/components/Presentations/DeckBuilder/`;
- `src/components/MyWork/table/`;
- `src/components/AIChat/KimiWorkspace/ExceleView.tsx`;
- `server/src/services/materials/`;
- `server/src/services/documentStudio/`;
- `server/src/services/tablePlatform/`;
- `server/src/services/deliverables/`;
- presentation, workbook, artifact and export routes/services/tests.
