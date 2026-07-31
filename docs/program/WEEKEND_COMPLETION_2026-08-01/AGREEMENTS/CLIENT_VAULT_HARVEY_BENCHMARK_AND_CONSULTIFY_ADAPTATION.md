---
document_id: CLIENT-VAULT-HARVEY-BENCHMARK-ADAPTATION
module: My Work / Client Vault
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Client Vault — pogłębiona analiza Harvey i adaptacja do Consultify

## 1. Cel analizy

Harvey jest inspiracją dlatego, że jego Vault nie jest klasycznym repozytorium
plików. Łączy data room, przetwarzanie dużych zbiorów, wyszukiwanie, analizę
powtarzalną, współpracę ludzi i przekazywanie źródeł do AI. Consultify powinien
przyjąć tę samą filozofię, ale dostosować ją do pracy konsultingowej i naszego
modelu organizacja → projekt → inicjatywa → execution → rezultat.

W dokumencie rozróżniamy:

- `HARVEY CONFIRMED` — funkcja potwierdzona oficjalną dokumentacją;
- `CONSULTIFY ADAPTATION` — świadoma adaptacja do naszego produktu;
- `CONSULTIFY EXTENSION` — funkcja wykraczająca poza potwierdzony benchmark;
- `OPEN` — decyzja, której nie wolno ukrywać jako faktu.

## 2. Co Harvey rzeczywiście robi

### 2.1 Vault jako workspace dużego zbioru — HARVEY CONFIRMED

Vault przechowuje, porządkuje i analizuje duże zbiory dokumentów. Aktualna
dokumentacja podaje do 100 GB i 100 000 plików na Vault. Obsługuje dokumenty,
e-maile, arkusze, prezentacje, HTML, kod, audio i PST, z osobnymi limitami.
Vault pokazuje processing status, organizuje foldery i zachowuje zapytania.

Wniosek dla Consultify: architektura nie może zakładać, że sejf zawiera kilka
PDF-ów. Lista, upload, indeks, kolejki, retry, filtry i analiza muszą być
projektowane dla tysięcy dokumentów. Limity produktu ustalimy osobno — nie
kopiujemy kosztownych limitów Harvey bez decyzji infrastrukturalnej.

### 2.2 Ask i Review to dwa różne jobs — HARVEY CONFIRMED

`Ask` zwraca jedną zagregowaną odpowiedź z całego wybranego zbioru. `Review`
uruchamia te same pytania/kolumny dla każdego dokumentu i zwraca macierz wyników.
To fundamentalne rozróżnienie:

| Tryb | Jednostka wyniku | Przykład Consultify |
| --- | --- | --- |
| Ask | jedna synteza zbioru | „Jakie są główne ryzyka wdrożenia?” |
| Review | wynik per dokument × pytanie | „Dla każdej umowy: termin, owner, ryzyko” |
| Search | lista trafnych źródeł | „Znajdź politykę backupu” |
| Compare | różnice wybranych źródeł | „Co zmieniło się w wersji 2026?” |

CONSULTIFY ADAPTATION: zanim użytkownik uruchomi analizę, Teresa powinna pomóc
wybrać właściwy tryb. Nie wolno próbować realizować review pojedynczym czatem.

### 2.3 Review Tables — HARVEY CONFIRMED

Review Table przyjmuje dokumenty jako wiersze i prompty ekstrakcji jako kolumny.
Oficjalnie potwierdzone elementy:

- do 10 000 plików z Vault w jednej tabeli;
- Column Builder i własne prompty kolumn;
- Table Instructions stosowane do każdej kolumny;
- conditional columns używające wyników wcześniejszych kolumn;
- przypisywanie wierszy członkom zespołu;
- flagowanie komórek i filtry assigned/flagged/verified;
- bulk verify/unverify;
- edycja, komentarze, refresh i historia komórki;
- rozmowa nad wynikami tabeli z cytowaniem komórek;
- duplikowanie tabel i ponowne używanie struktury;
- używanie Review Table jako źródła dalszej pracy.

Ważna granica Harvey: rozmowa wewnątrz Review Table odpowiada na podstawie już
wyekstrahowanych komórek, nie wykonuje nowej ekstrakcji z plików. Nowe pytanie do
plików powinno stać się kolumną albo uruchomić Assistant na wybranych plikach.

CONSULTIFY ADAPTATION: Review Table jest artefaktem współdzielonym z naszym
standardem tabel. Ma przekazywać zatwierdzone wyniki do Finance, Audit,
Assessment, Tools i Materials, ale wyłącznie przez jawny mapping i handoff.

### 2.4 Workflows i drafty — HARVEY CONFIRMED

Z Vault można uruchomić predefiniowany workflow, wybrać jego kolumny i pliki,
zadać pytanie w Assistant albo rozpocząć draft dokumentu. Vault/folder/files
mogą być osadzone w Workflow Builder; cały Vault automatycznie odzwierciedla
dodanie, zmianę i usunięcie źródła przy następnym runie, o ile runner ma dostęp.

CONSULTIFY ADAPTATION: z Sejfu uruchamiamy narzędzie konsultingowe, Assessment,
Audit, Interview preparation, generator Materials albo Run Agent. Każdy run
zapisuje snapshot manifestu, aby późniejsza zmiana źródeł nie zmieniła historii.

### 2.5 Knowledge Bases — HARVEY CONFIRMED

Administratorzy mogą tworzyć i publikować zatwierdzone zbiory jako Knowledge
Bases, np. templates, precedents i playbooki. Użytkownicy mogą odpytywać je w
Assistant bez ręcznego wyszukiwania i uploadu. Istniejące Vaulty mogą zostać
przekształcone w Knowledge Base.

CONSULTIFY ADAPTATION: Knowledge Base nie jest kolejnym folderem. To produkt
governance: ma ownera, audience, źródła, wersję, review, datę ważności i status.
Przykłady: „Metodyka DRD”, „Standard ofertowania klienta X”, „Polityki ISO”,
„Zatwierdzone szablony zarządcze”.

### 2.6 DMS i API — HARVEY CONFIRMED

Harvey obsługuje folder upload i one-way sync m.in. z SharePoint, iManage, Box
i Google Drive. Pliki synchronizowane są read-only. API pozwala listować projekty,
uploadować, zachować file paths, pobrać metadata i processing status oraz usuwać
pliki/projekty. To potwierdza potrzebę automatyzacji ingestu i zachowania
struktury folderów.

CONSULTIFY ADAPTATION: wszystkie źródła wchodzą przez wspólny control plane.
Connector manifestuje capabilities, uprawnienia i tryb sync. Sejf nie implementuje
osobnego OAuth. Dla źródła nadrzędnego dokument jest read-only, a lokalne dane
Consultify to metadata, relacje, indeks, review i komentarze.

### 2.7 Sharing, content controls i retencja — HARVEY CONFIRMED

Vault można współdzielić w organizacji. Owner może ograniczyć viewerom pobranie,
duplikowanie i widoczność promptów Review Table. Harvey rozwija Shared Spaces,
view-as-collaborator i retencję per matter. Usunięcie Vault jest według obecnej
dokumentacji nieodwracalne.

CONSULTIFY ADAPTATION: stosujemy granularne capabilities i preview-as-role.
Odróżniamy archive, delete request i purge, ponieważ projekty konsultingowe mają
zależne decyzje, raporty i wymagania audytowe. To celowe odejście od prostego
nieodwracalnego delete Harvey.

## 3. Co przyjmujemy, czego nie kopiujemy

| Element Harvey | Decyzja Consultify | Powód |
| --- | --- | --- |
| Vault jako duży workspace | przyjmujemy | właściwy model skali |
| Ask + Review | przyjmujemy 1:1 semantycznie | dwa różne jobs użytkownika |
| Review Tables | przyjmujemy i integrujemy z Tables 2026 | klucz do analizy dokumentów |
| Knowledge Bases | przyjmujemy | standaryzacja wiedzy organizacji |
| Workflows z osadzonym Vault | przyjmujemy z run manifest | powtarzalność i audyt |
| one-way DMS sync | przyjmujemy jako default | brak konfliktu właściciela pliku |
| permanent delete jako jedyna opcja | nie kopiujemy | potrzebujemy hold/dependency review |
| vault tworzony dowolnie przez każdego | nie kopiujemy wprost | mamy systemowe sejfy scope |
| prawnicze template/workflowy | adaptujemy do konsultingu | inne domeny i rezultaty |
| liczby limitów Harvey | nie kopiujemy automatycznie | ekonomika i infrastruktura |

## 4. Docelowa przewaga Consultify

Harvey skupia się na pracy prawnej nad dokumentami. Consultify powinien połączyć
dokumenty z systemem zarządzania zmianą. Znaleziony fakt może po review stać się
Insightem, ryzykiem, Decision, Task albo Initiative; później można sprawdzić jego
realizację w Execution i Results. Ta ciągłość jest naszą przewagą, pod warunkiem
że każdy krok zachowuje cytat i human approval.

## 5. Oficjalne źródła

- [Vault: Analyze Large Document Sets at Scale](https://help.harvey.ai/articles/vault)
- [Using Review Tables](https://help.harvey.ai/articles/ask-questions-directly-in-review-tables)
- [Assign, Flag, and Filter in Review Tables](https://help.harvey.ai/release-notes/assign-flag-and-filter-in-vault-review-tables)
- [Table Instructions](https://help.harvey.ai/release-notes/table-instructions-for-review-tables)
- [Vault Knowledge Bases](https://help.harvey.ai/release-notes/introducing-vault-knowledge-bases)
- [Embed Vaults in Workflow Builder](https://help.harvey.ai/articles/embed-files-and-knowledge-sources-in-workflow-builder)
- [Folder Uploads and One-Way Sync](https://help.harvey.ai/release-notes/folder-uploads)
- [Vault API Guide](https://developers.harvey.ai/guides/vault)
- [Advanced Vault Controls](https://help.harvey.ai/release-notes/advanced-vault-controls)

## 6. Pytania do wspólnego odbioru

1. Czy Review Tables są częścią MVP Client Vault, czy MVP+1 mimo ich centralnej roli?
2. Czy systemowe trzy sejfy wystarczają, czy użytkownik może tworzyć dodatkowe vault workspaces?
3. Czy każde workflow śledzi `latest`, czy produkcyjne workflow zawsze pinują wersję KB?
4. Które trzy konsultingowe workflowy mają być odpowiednikiem startowych workflowów Harvey?
5. Czy zachowujemy polską nazwę „Sejf”, mimo że funkcja wykracza poza magazyn plików?
