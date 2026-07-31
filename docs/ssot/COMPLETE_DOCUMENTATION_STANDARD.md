# Standard kompletnej dokumentacji Consultinity

Status: canonical
Właściciel: Product Owner + Product + Engineering
Punkt wejścia: `docs/SOURCE_OF_TRUTH.md`
Struktura funkcjonalna: `docs/FUNCTIONAL_DOCUMENTATION.md`

## 1. Cel standardu

Dokumentacja Consultinity ma pozwalać:

- zrozumieć cały program bez znajomości rocznej historii repozytorium,
- ustalić, co działa obecnie, a co jest wizją docelową,
- przejść od pozycji menu do funkcji, danych, API i kodu,
- bezpiecznie rozwijać aplikację przez ludzi i agentów AI,
- zweryfikować każdą deklarację dowodem,
- zachować decyzje i historię bez mieszania ich z aktualnym kanonem,
- przygotować materiały dla użytkowników, zespołu, partnerów i inwestorów.

Kompletna dokumentacja nie oznacza największej liczby plików. Oznacza
**najkrótszą możliwą drogę do jednoznacznej odpowiedzi**.

## 2. Zasady nadrzędne

### 2.1. Menu jest szkieletem funkcjonalnym

Dokumentację funkcji budujemy według 16 pozycji z
`docs/FUNCTIONAL_DOCUMENTATION.md`.

Podsystem techniczny nie staje się osobnym modułem głównym tylko dlatego, że
ma własny kod lub dawny dokument SSOT. Przykładowo:

- Documents, Tables, Presentations i Outputs należą do Materials,
- Client Vault i Run Agent należą do My Work.

### 2.2. AS-IS i TO-BE są zawsze rozdzielone

Każdy moduł opisuje:

- **AS-IS** — stan potwierdzony w kodzie i runtime,
- **TO-BE** — zaakceptowany stan docelowy,
- **GAP** — różnicę między nimi,
- **NEXT** — uzgodnioną kolejność domknięcia.

Nie wolno przedstawiać planu jako działającej funkcji ani istniejącego kodu
jako zaakceptowanej wizji produktu.

### 2.3. Każda ważna deklaracja ma ślad

Wymaganie powinno wskazywać decyzję lub właściciela. Deklaracja wdrożenia
powinna wskazywać kod, commit, test lub dowód runtime.

Minimalny łańcuch:

`decyzja → wymaganie → funkcja → kod/API/dane → test → dowód odbioru`

### 2.4. Jeden zakres — jeden kanon

Jeden zakres nie może mieć dwóch aktywnych dokumentów `canonical`.
Dokument zastąpiony otrzymuje `superseded_by`.

Nazwy `FINAL`, `MASTER`, `V8` i `SSOT` nie nadają autorytetu.

### 2.5. Dokumentacja jest częścią produktu

Zmiana zachowania bez aktualizacji dokumentacji jest zmianą nieukończoną.
Dokumentacja podlega przeglądowi, testom ścieżek i changelogowi.

## 3. Architektura całej dokumentacji

### Warstwa A — wejście do programu

Odpowiada na pytanie: „Czym jest Consultinity i jak czytać całość?”.

Obowiązkowe dokumenty:

1. wizja i obietnica produktu,
2. odbiorcy i problemy,
3. model operacyjny platformy,
4. mapa 16 pozycji menu,
5. mapa głównych przepływów między modułami,
6. słownik wspólnych pojęć,
7. mapa źródeł prawdy,
8. aktualny stan programu i roadmapa.

### Warstwa B — dokumentacja funkcjonalna według menu

Jeden komplet dla każdej z 16 pozycji. To podstawowy sposób czytania aplikacji
przez właściciela produktu, użytkownika, analityka i projektanta.

### Warstwa C — standardy przekrojowe

Opisuje zasady obowiązujące w wielu modułach:

- nawigacja i architektura informacji,
- UI/UX i design system,
- Teresa, AI, agenci i automatyzacje,
- role, uprawnienia i governance,
- wspólne obiekty i statusy,
- powiadomienia i My Work,
- wyszukiwanie i wiedza,
- import, eksport, konwersje i materiały,
- współpraca, komentarze i aktywność,
- audytowalność, źródła i provenance,
- lokalizacja, dostępność i responsywność.

### Warstwa D — dokumentacja techniczna

Odpowiada na pytanie: „Jak to jest zbudowane?”.

- architektura systemu,
- frontend i współdzielone komponenty,
- backend i usługi,
- model danych i migracje,
- API i zdarzenia,
- AI runtime i modele,
- integracje,
- bezpieczeństwo,
- feature flags,
- observability,
- testy i jakość,
- decyzje architektoniczne ADR.

### Warstwa E — operacje

- środowiska,
- konfiguracja,
- wdrożenia,
- migracje danych,
- monitoring,
- incydenty,
- backup i disaster recovery,
- bezpieczeństwo operacyjne,
- rollback,
- utrzymanie i odpowiedzialności.

### Warstwa F — dowody i historia

- decyzje właściciela,
- evidence,
- raporty audytowe,
- odbiory,
- plany historyczne,
- handoffy,
- dokumenty zastąpione.

Warstwa F wyjaśnia „dlaczego i jak doszliśmy tutaj”, ale nie konkuruje
automatycznie z aktualnym kanonem.

## 4. Obowiązkowy komplet dla jednej pozycji menu

Każda pozycja menu powinna mieć katalog funkcjonalny z następującymi plikami:

| Plik | Zawartość |
| --- | --- |
| `README.md` | wejście, streszczenie i kolejność czytania |
| `01_PURPOSE.md` | cel, użytkownicy, problemy i obietnica |
| `02_FUNCTION_MAP.md` | zakładki, ekrany, funkcje i obiekty |
| `03_USER_FLOWS.md` | najważniejsze przepływy end-to-end |
| `04_OBJECTS_AND_DATA.md` | encje, pola, statusy, relacje i własność danych |
| `05_AI_AND_AUTOMATION.md` | Teresa, agenci, rekomendacje i automaty |
| `06_ROLES_AND_PERMISSIONS.md` | role, widoczność, akcje i blokady |
| `07_INTEGRATIONS.md` | połączenia z innymi modułami i systemami |
| `08_UX_STANDARD.md` | układ, stany, responsywność i dostępność |
| `09_AS_IS.md` | potwierdzony stan aplikacji |
| `10_TO_BE.md` | zaakceptowany stan docelowy |
| `11_GAPS_AND_ROADMAP.md` | braki, priorytety i zależności |
| `12_TESTS_AND_EVIDENCE.md` | kryteria akceptacji, testy i dowody |
| `CHANGELOG.md` | historia zmian kanonu i decyzji |

Nie trzeba od razu tworzyć pustych plików. Podczas budowania dokumentacji
można zacząć od jednego kompletnego dokumentu i rozdzielać go dopiero, gdy
treść stanie się trudna do używania.

## 5. Standard zawartości rozdziałów

### 5.1. Cel i obietnica

Musi odpowiedzieć:

- kto korzysta,
- jaki problem rozwiązuje,
- jaki rezultat otrzymuje,
- dlaczego funkcja należy do tej pozycji menu,
- czego moduł świadomie nie robi.

### 5.2. Mapa funkcji

Każda funkcja otrzymuje stabilny identyfikator:

`<MODUŁ>-F-###`, np. `MAT-F-012`.

Minimalny wpis:

| Pole | Znaczenie |
| --- | --- |
| ID | stabilny identyfikator |
| Nazwa | język użytkownika |
| Cel | rezultat użytkownika |
| Wejście | skąd użytkownik przychodzi |
| Akcja | co robi |
| Wynik | co powstaje lub się zmienia |
| Status | AS-IS / partial / planned / deprecated |
| Dowód | kod, test, zrzut lub commit |

### 5.3. Przepływy

Przepływ opisujemy od intencji do rezultatu, nie jako listę komponentów.

Każdy przepływ zawiera:

- aktora,
- warunki wejścia,
- ścieżkę podstawową,
- warianty i błędy,
- decyzje/akceptacje,
- tworzone lub zmieniane obiekty,
- przejścia do innych pozycji menu,
- kryterium ukończenia.

Diagram stosujemy tylko wtedy, gdy relacje są trudniejsze niż krótka lista.

### 5.4. Obiekty i dane

Dla każdej encji:

- nazwa biznesowa i techniczna,
- właściciel danych,
- pola kluczowe,
- statusy i przejścia,
- relacje,
- źródło danych,
- retencja i audyt,
- uprawnienia,
- API i tabele,
- znane rozbieżności między dokumentem a schematem.

### 5.5. AI

Należy rozdzielić:

- AI doradcze — wyjaśnia i rekomenduje,
- AI generatywne — tworzy treść lub artefakt,
- AI wykonawcze — zmienia stan lub uruchamia akcję,
- automatyzację deterministyczną,
- operację wymagającą akceptacji człowieka.

Każda funkcja AI określa:

- kontekst wejściowy,
- model/provider lub klasę modelu,
- narzędzia,
- ograniczenia,
- potwierdzenie użytkownika,
- zapis wyniku,
- provenance,
- zachowanie przy błędzie,
- koszty i obserwowalność, jeśli istotne.

### 5.6. UX

Dokumentacja nie powiela całego design systemu. Linkuje do standardu
przekrojowego i opisuje wyłącznie:

- układ specyficzny dla modułu,
- warianty widoków,
- stany empty/loading/error/partial/success/locked,
- zachowanie mobilne,
- dostępność,
- działania destrukcyjne,
- odstępstwa zatwierdzone przez właściciela.

### 5.7. AS-IS

Każda deklaracja AS-IS powinna podawać:

- środowisko,
- datę,
- commit,
- trasę lub ekran,
- kod wykonawczy,
- API i dane,
- test lub dowód wizualny,
- ograniczenia/flagę.

Statusy:

- `verified` — potwierdzone w runtime,
- `code-only` — znalezione w kodzie, niepotwierdzone w runtime,
- `partial` — działa częściowo,
- `stub` — atrapa lub brak pełnego backendu,
- `broken` — istnieje, lecz nie działa,
- `unknown` — niezweryfikowane.

### 5.8. TO-BE

Każde wymaganie docelowe powinno mieć:

- identyfikator,
- źródło decyzji,
- właściciela,
- opis zachowania,
- kryterium akceptacji,
- priorytet,
- zależności,
- status akceptacji.

### 5.9. GAP i roadmapa

Roadmapa nie powtarza całego TO-BE. Łączy:

`wymaganie TO-BE → brak AS-IS → paczka implementacyjna → test → odbiór`

## 6. Metadane dokumentu

Każdy dokument kanoniczny powinien mieć:

```yaml
---
doc_id: materialy-function-map
title: Materials — mapa funkcji
menu_item: materials
truth_type: product-target
scope: funkcje modułu Materials
status: canonical
owner: product
reviewers:
  - engineering
last_reviewed: 2026-07-29
runtime_commit: null
supersedes: []
superseded_by: null
related:
  - docs/FUNCTIONAL_DOCUMENTATION.md
---
```

## 7. Język i forma

- język główny dokumentacji programu: polski,
- nazwy widoczne w produkcie zachowujemy w aktualnym języku UI,
- termin techniczny podajemy po polsku, a nazwę kodową w backtickach,
- piszemy krótkimi zdaniami i językiem rezultatu użytkownika,
- unikamy marketingowych deklaracji bez dowodu,
- tabele stosujemy do mapowań i porównań,
- diagramy do przepływów, relacji i architektury,
- zrzuty tylko jako dowód wyglądu lub zachowania, z datą i środowiskiem,
- nie kopiujemy tych samych reguł do wielu modułów — linkujemy standard.

## 8. Nazewnictwo i lokalizacja

- jeden stabilny katalog na pozycję menu,
- nazwy plików opisowe, bez `FINAL_FINAL`, daty wersji i numerowanych kopii,
- data w nazwie tylko dla raportu, evidence, audytu lub decyzji z konkretnego dnia,
- wersjonowanie kanonu przez Git i `CHANGELOG.md`,
- materiały historyczne w archiwum domeny,
- obrazy w podkatalogu `evidence/` lub wspólnym katalogu dowodów.

## 9. Odpowiedzialności

| Rola | Odpowiedzialność |
| --- | --- |
| Product Owner | wizja, priorytety, decyzje i akceptacja TO-BE |
| Product | spójność funkcjonalna, przepływy i wymagania |
| Design | standard UX, stany i dowody wizualne |
| Engineering | AS-IS, architektura, API, dane i wykonalność |
| QA | kryteria, testy, regresja i evidence |
| Operations/Security | środowiska, bezpieczeństwo, wdrożenia i incydenty |
| Maintainer dokumentacji | rejestr, linki, statusy i przeglądy |

Jedna osoba może pełnić kilka ról, ale odpowiedzialności pozostają rozdzielone.

## 10. Proces aktualizacji

Przy każdej zmianie funkcji:

1. wskaż pozycję menu i ID funkcji,
2. zaktualizuj TO-BE lub decyzję,
3. zaimplementuj zmianę,
4. zaktualizuj AS-IS,
5. dodaj test i dowód,
6. zaktualizuj GAP/roadmapę,
7. wpisz zmianę do changelogu,
8. uruchom `npm run check:ssot`.

## 11. Definicja kompletnej dokumentacji modułu

Moduł jest dokumentacyjnie kompletny, gdy:

- ma cel, zakres i granice,
- wszystkie widoczne zakładki i funkcje są zinwentaryzowane,
- główne przepływy mają początek, koniec i warianty błędów,
- obiekty, dane, statusy i relacje są opisane,
- AI i automatyzacje mają jawne uprawnienia oraz guardraile,
- role i działania są zmapowane,
- integracje z innymi modułami są dwustronnie wskazane,
- AS-IS jest potwierdzony dowodami,
- TO-BE ma źródła decyzji i kryteria akceptacji,
- wszystkie luki są zapisane, nawet jeśli nie są zaplanowane,
- testy pokrywają przepływy krytyczne,
- nie istnieje konkurencyjny aktywny kanon dla tego samego zakresu,
- dokument przeszedł przegląd Product i Engineering.

## 12. Definicja kompletnej dokumentacji całego programu

Całość jest kompletna, gdy:

1. wszystkie 16 pozycji menu spełnia bramkę modułu,
2. wszystkie standardy przekrojowe mają właściciela,
3. główne przepływy między modułami są opisane end-to-end,
4. wspólne obiekty mają jedną definicję,
5. architektura, dane, API i operacje odpowiadają runtime,
6. każda deklaracja gotowości ma bieżący dowód,
7. dokumentacja użytkowa i techniczna wskazują ten sam model produktu,
8. nie ma nierozstrzygniętych konfliktów P0,
9. rejestr SSOT oraz linki przechodzą automatyczną kontrolę,
10. nowa osoba potrafi znaleźć odpowiedź bez czytania historycznych handoffów.

## 13. Kolejność budowania

Rekomendowana fala:

1. szkielet programu i słownik,
2. Chat,
3. My Work,
4. Interview,
5. Tools,
6. Assessment,
7. Initiatives,
8. Execution,
9. Results,
10. Finance,
11. Materials,
12. Audits,
13. Meeting,
14. Organization,
15. Admin Panel,
16. Settings,
17. Partner Portal,
18. standardy przekrojowe i przepływy pełnego programu,
19. dokumentacja użytkowa, operacyjna oraz due diligence.

Kolejność pozycji funkcjonalnych zawsze pozostaje zgodna z menu, nawet jeśli
poszczególne fale realizujemy w innym terminie.
