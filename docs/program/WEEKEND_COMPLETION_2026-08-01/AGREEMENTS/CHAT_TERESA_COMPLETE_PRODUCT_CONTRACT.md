---
document_id: CHAT-TERESA-COMPLETE-PRODUCT-CONTRACT
module: Chat
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Chat / Teresa — kompletny kontrakt produktu

## 1. Rola w Consultify

Chat jest głównym interfejsem współpracy z Teresą. Teresa nie jest chatbotem
odpowiadającym wyłącznie tekstem. Jest konsultantem, przewodnikiem po aplikacji i
kontrolowanym orkiestratorem pracy.

```text
rozmowa -> rozpoznanie celu -> dobór kontekstu i sposobu pracy
         -> odpowiedź / Canvas / narzędzie / proposal
         -> review i approval -> zapis w module właściciela -> read-back
```

Chat nie przejmuje prawdy Notes, Ideas, Tasks, Decisions, Initiatives ani
pozostałych modułów. Przechowuje rozmowę, intencję, użyty kontekst, odpowiedzi,
tool trace oraz odwołania do powstałych obiektów.

## 2. Teresa — jedna tożsamość

W całej aplikacji istnieje jedna Teresa, niezależnie od miejsca otwarcia:

- pełny Chat;
- split Chat + Canvas;
- panel kontekstowy modułu;
- Meeting;
- voice.

Zmienia się jej aktywny scope, dostępne narzędzia i instrukcja domenowa, nie
tożsamość ani historia zasad bezpieczeństwa. Użytkownik zawsze widzi, czy Teresa
pracuje jako konsultant ogólny, na konkretnym projekcie, artefakcie, module,
spotkaniu czy zaznaczeniu.

## 3. Podstawowy przepływ

1. Użytkownik otwiera istniejącą rozmowę albo tworzy nową.
2. Shell pokazuje model/tryb, scope, aktywne źródła i stan prywatności.
3. Użytkownik pisze, mówi, dołącza plik/URL lub wskazuje obiekt przez `@`.
4. Router intencji rozpoznaje rozmowę, research, tworzenie artefaktu albo
   działanie w aplikacji.
5. Teresa odpowiada strumieniowo, pokazując uczciwy status pracy.
6. Odpowiedź może pozostać wiadomością, otworzyć Canvas, utworzyć proposal albo
   uruchomić bezpieczne narzędzie.
7. Użytkownik sprawdza źródła, poprawia rezultat i zatwierdza działania.
8. Historia zachowuje rezultat, narzędzia, approvals, błędy i linki do obiektów.

## 4. Rodziny funkcji

### 4.1 Rozmowa

- nowa rozmowa, wysłanie, streaming i stop;
- retry/regenerate z zachowaniem poprzedniego wariantu;
- edycja wiadomości użytkownika i jawne branchowanie;
- kopiowanie odpowiedzi, feedback i report;
- wybór języka rozmowy niezależnie od języka UI;
- sugestie kolejnych działań zależne od kontekstu.

### 4.2 Historia i organizacja

- lista, wyszukiwanie po tytule i treści;
- grupy czasowe i ostatnio używane;
- rename, star/pin, archive, restore i delete;
- foldery osobiste i zespołowe, podfoldery oraz drag-and-drop;
- przenoszenie i operacje zbiorcze;
- deep link i powrót do ostatniego miejsca;
- wersje/gałęzie rozmowy i artefakty przypisane do rozmowy.

### 4.3 Composer

- tekst wieloliniowy i skróty klawiaturowe;
- pliki lokalne, URL i zatwierdzone źródła chmurowe;
- `@mentions` do osób, plików, projektów i obiektów aplikacji;
- `/commands` jako jawne intencje;
- wybór trybu/narzędzia/modelu;
- dyktowanie oraz voice conversation;
- podgląd, usuwanie i status przetwarzania załączników;
- send/stop/retry i recovery draftu.

### 4.4 Tryby pracy

- quick answer;
- konsultacja/coach;
- deep thinking;
- deep research;
- work with sources;
- create/edit Canvas artifact;
- agentic process z planem i approval;
- voice.

Tryb jest widoczny. Teresa może zaproponować zmianę trybu, lecz kosztownej lub
wysokiego ryzyka pracy nie uruchamia bez potwierdzenia.

### 4.5 Rezultaty i działania

Z okna Chatu można:

- otworzyć dokument, tabelę, diagram, deck lub aplikację w Canvasie;
- zapisać odpowiedź jako Note albo Idea;
- utworzyć proposal Task lub Decision;
- przygotować Initiative Candidate;
- uruchomić Tools/Assessment/Interview albo wskazać właściwy template;
- zbudować document/sheet/deck i przekazać do Outputs/Materials;
- otworzyć istniejący rekord lub przejść do modułu;
- uruchomić Run Agent w ramach uprawnień;
- przygotować, ale nie wysłać bez zgody, wiadomość lub raport zewnętrzny.

## 5. Model wiadomości

Wiadomość ma stable ID, conversation/branch ID, role, type, content, status,
createdAt, author, model, scope snapshot, attachments, citations, tool calls,
artifacts, proposals i linked entities. Typy obejmują co najmniej:

- user text / voice transcript;
- assistant response;
- system/context notice;
- tool call/result;
- research progress/result;
- artifact card;
- execution proposal/approval/result;
- recoverable error;
- branch marker.

Proposal nie może być schowany jako zwykły przycisk pod odpowiedzią. Jest
obiektem pierwszej klasy z targetem, zmianą, ryzykiem, uprawnieniem i statusem.

## 6. Odpowiedź Teresy

Odpowiedź może zawierać: tekst, listę, tabelę, citation, source panel, artifact
preview, pytanie, choice card, plan, progress, tool trace i proposal. UI nie
renderuje raw payloadów. Każdy element ma stabilny renderer i tekstowy fallback.

Teresa dobiera długość do zadania. Nie zasypuje użytkownika raportem, gdy
wystarczy odpowiedź, ale nie ukrywa przesłanek decyzji. W zadaniach doradczych
pracuje: diagnoza -> hipotezy -> evidence -> rekomendacja -> ryzyka -> następny
krok.

## 7. Granice autonomii

Teresa może bez potwierdzenia czytać dozwolony kontekst, odpowiadać, streszczać,
porównywać i przygotowywać drafty. Preview/diff jest wymagany dla modyfikacji
artefaktu. Jawne zatwierdzenie jest wymagane dla:

- zapisu lub zmiany rekordu domenowego;
- przypisania odpowiedzialności, terminu albo budżetu;
- decyzji, approval lub go/no-go;
- publikacji, share, wysłania i komunikacji zewnętrznej;
- dostępu do nowego źródła lub domeny;
- działania nieodwracalnego albo obejmującego wiele rekordów.

Teresa nigdy nie udaje wykonanego działania. Sukces wymaga target ID, wyniku
owner-module i read-backu.

## 8. Jakość i zaufanie

Odpowiedź rozdziela fakty, wnioski, założenia i rekomendacje. Cytacje prowadzą
do konkretnego źródła lub fragmentu. Brak źródeł jest jawny. System pokazuje
zakres, świeżość, ograniczenia oraz użyte narzędzia na poziomie użytecznym dla
odbiorcy, bez ujawniania ukrytego chain-of-thought.

## 9. Pytania właścicielskie

1. Czy prywatny tryb rozmowy wyłącza pamięć organizacyjną i uczenie preferencji?
2. Kto może tworzyć i udostępniać foldery zespołowe?
3. Czy użytkownik może ręcznie wybierać model, czy wybiera poziom jakości/czasu?
4. Które akcje Chatu trafiają do weekendowego MVP poza Note, Idea, Task,
   Decision, Canvas i Initiative Candidate?
5. Czy delete rozmowy oznacza soft delete z retencją administratora?
