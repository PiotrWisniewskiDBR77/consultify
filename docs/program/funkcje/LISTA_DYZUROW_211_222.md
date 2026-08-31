---
doc_id: funkcje-lista-dyzurow-211-222
status: canonical
owner: piotr
truth_type: plan
established: 2026-08-31
---

# Lista dyżurów 211–222 (po zamknięciu 204·205·206·209·210)

Każda pozycja wynika z **pomiaru z 31.08**, nie z planu sprzed tygodnia. Przy
każdej podano, co właściciel z niej ma.

## FALA A — uczciwość pomiaru (najpierw, bo bez niej reszta jest ślepa)

### 211 · Przemiatanie pułapki `clearAllMocks` — 87 plików
FIX-209 odkrył, że globalny `beforeEach(vi.clearAllMocks())` w `tests/setup.ts:809-811`
**kasuje implementacje** mocków ustawionych w `beforeAll`. Objaw jest podstępny:
pierwszy test w pliku przechodzi, każdy następny cicho idzie prawdziwą ścieżką.
**★ KOREKTA NADZORCY (31.08, po pomiarze robotnika):** pierwotnie wpisałem tu
„zmierzony zasięg: 87 plików". **Ta liczba była błędna** — pochodziła z mojego
zgrubnego `awk`, bez sondy i bez walidacji na znanym przypadku, i podałem ją jako
pomiar. Robotnik piszący instrukcję zbudował sondę z dopasowaniem klamer bloku,
**zwalidował ją na potwierdzonym przypadku sprzed FIX-209**, i zmierzył na 5915
plikach testowych:
- **wąska definicja (realne ryzyko): 4 pliki, z czego 2 faktycznie zagrożone** —
  `interviewDeliveryMountedAuth.pg.test.ts` (6 testów) i `tests/unit/backend/ragService.test.js`
  (5 testów, z komentarzem powielającym tę samą fałszywą premisę co `tests/setup.ts:792`);
- **luźne współwystępowanie (górna granica, bez wartości dowodowej): 130 plików.**

Skala dyżuru spada z „przemiatanie 87 plików" do „potwierdź zasięg i napraw
kilka". **Nie zmienia to jego kolejności** — pułapka jest realna, potwierdzona na
żywym przypadku w 209, a bezpiecznik na przyszłość i tak trzeba postawić. Zmienia
za to koszt: to jest dyżur mały, nie duży.

**★★ DRUGA KOREKTA (31.08, po odbiorze adwersaryjnym 211) — liczba końcowa: JEDEN.**
Audytor zbudował własną sondę o innej logice niż wykonawca i zmierzył repozytorium
ponownie. Wynik: **jedno potwierdzone naruszenie w całym repo**
(`day205.decisionWisdom.pg.test.ts:34`). Liczby 87 (moja), 4 i 130 (z pisania
instrukcji) — wszystkie bez wartości dowodowej.

Powód, dla którego skala jest tak mała, został zmierzony sześcioma reprodukcjami
przeciw prawdziwemu `tests/setup.ts`: **pułapka dotyczy WYŁĄCZNIE `vi.spyOn(...)`**.
Goły `vi.fn()` przeżywa `clearAllMocks()` — także gdy `.mockResolvedValue()` woła
się później i gdy atrapa jest przypisana wprost do właściwości obiektu. Trzy z
czterech plików „naprawionych" przez dyżur nie miały żywego defektu (dowód
przed/po: zero różnicy). Wykonawca przyznał to sam w raporcie.

**Wniosek dla programu:** incydent w 209 był prawdziwy (tam był `spyOn`), ale
**nie jest to skaza rozlana po testach**. Moje zdanie do właściciela „część naszej
zieleni mogła nic nie znaczyć" było przesadzone i zostało sprostowane. Wartość
dyżuru 211 leży w BEZPIECZNIKU, nie w naprawach: bezpiecznik zablokował prawdziwy
`git commit` ze świeżym naruszeniem napisanym ręką audytora.
Zysk: przestajemy ufać zieleni, która nic nie znaczy. To jest warunek wstępny
dla wszystkiego, co niżej.

### 212 · Przemiatanie zabezpieczeń bez testu omijającego
Reguła z `WSPOLNA_PRZYCZYNA_ODBIORY_204_210.md`: w 3 z 4 dyżurów testy zostały
zielone po skasowaniu zabezpieczenia. Inwentarz wszystkich zabezpieczeń w
produkcie (zasięg, bramy zatwierdzenia, idempotencja, uprawnienia) + test
**omijający** dla każdego, z obowiązkową czerwienią.
Zysk: zabezpieczenia przestają być deklaracją.

### 213 · Dług zasięgu z karty 210 (pozycje 5–9) — ★ ZNALEZISKO PODNOSZĄCE PRIORYTET

**Pomiar przy pisaniu instrukcji (31.08) wykrył dwie rzeczy, których karta 210 nie
zawierała:**

1. **Asymetria fail-closed / fail-open.** Przy braku kolumny `scope`
   `embeddingService` (dziś `:341`) odcina treści prywatne, ale `ragService`
   (`:315-322`, funkcja od `:231`) ma `if (hasScope)` **bez `else`** — czyli
   przepuszcza wszystko. Dwie implementacje tej samej reguły zachowują się
   przeciwnie w tym samym scenariuszu awaryjnym.
2. **`scope='project'` NIE jest martwy.** Karta dopuszczała „udokumentuj jako
   nieużywany". Pomiar to obala: `knowledge.routes.ts:915-934` ma żywą,
   zamontowaną trasę `POST /api/knowledge/documents`, która produkuje
   `scope='project'` z realną kontrolą członkostwa. A żaden filtr retrievalu
   tej wartości nie obsługuje — **sejf projektowy jest widoczny dla całej
   organizacji.**

Dodatkowo: wartość domyślna kolumny pochodzi z **wyścigu dwóch niezależnych
ALTER-ów przy starcie** (`KnowledgeService.ts:174` bez `DEFAULT` vs
`ContextDocumentService.ts:2398` z `DEFAULT 'user'`) — czyli zachowanie zależy od
kolejności startu procesu.


Cztery insertery nie ustawiają zasięgu, a **domyślna wartość kolumny to
„prywatne"** (`ai.routes.ts:599`, `:868`, `knowledgeIndexer.ts:868`,
`insightSignalBridgeService.ts:203`) · `scope='project'` nieobsługiwany przez
żaden filtr (sejf projektowy widoczny dla całej organizacji) · dwie niezależne
implementacje tej samej reguły (`embeddingService.ts:320` vs `ragService.ts:302`)
· `ai_visibility`/`sensitivity` pomijane w retrievalu · migracja dokładająca
`knowledge_docs.scope` (FIX-210 dodał tylko głośny log).
**Do zmierzenia na demo przed promocją** — dyżurom nie wolno się tam łączyć.
Zysk: baza wiedzy przestaje mieć trzy różne pojęcia „kto to widzi".

## FALA B — domknięcie modułu 17 (Agent + Teresa)

### 214 · 208 ponownie — adopt-chat-draft (17-D)
Jedyny dyżur, który **nie wrócił wcale** (brak gałęzi, zero commitów).
Zysk: szkic z rozmowy staje się realnym obiektem w systemie.

### 215 · R3 — indeksacja raportów
Świadomie zostawione poza 209. Ostatni typ artefaktu, który nie zasila bazy wiedzy.
Zysk: domknięcie pętli „system odżywia się pracą" na wszystkich trzech typach.

### 216 · Atomowość i odwracalność migracji (204 pkt 5–6)
Zapis do kanonu i do rejestru w jednej transakcji · ledger zapisuje `FAILED`
zamiast przerywać partię bez śladu · ścieżka cofnięcia partii.
Zysk: migracja 467 zadań przestaje być operacją bez wyjścia awaryjnego.

### 217 · GF-AGT-02 — pierwszy pełny przebieg procesu konsultingowego
E2E: rozmowa → propozycja → zatwierdzenie → zadanie → dokument → indeks → kolejna
rozmowa korzystająca z tego, co powstało. Zawiera **R3 dyżuru 206** (dowód pętli
narzędziowej realnym modelem, 0/2 budżetu).
Zysk: **to jest dyżur, który zamyka moduł 17.** Pierwszy dowód, że produkt działa
jako całość, a nie jako 17 działających części.

## FALA C — to, co właściciel zobaczy

### 218 · Werdykty D-17: Partner · Czat · Admin
Pakiety gotowe w repo od wczoraj, czekają na posiedzenie.
Zysk: trzy moduły dostają status CLOSED_FINAL albo nazwaną listę braków.

### 219 · Pilot migracji na stagingu — jeden rekord
Ręka nadzorcy, oko właściciela. Możliwe od teraz (FIX-204 dowiózł pilot 1 rekordu
i zakres organizacji fail-closed).
Zysk: pierwsze realne zadanie legacy wchodzi do kanonu, pod nadzorem.

### 220–222 · Marzenie: prezentacje jakości Gammy (G-0…G-5)
Ścieżka opisana w `MARZENIE_GAMMA_DECKI.md`. Zgodnie z regułą własną: **prototyp
jako PLIK do akceptu przed budową silnika** — nigdy odwrotnie.
Zysk: to, o co właściciel prosił wprost jako o marzenie.

## Kolejność rekomendowana

**A → B → C.** Uzasadnienie: fala A naprawia przyrząd pomiarowy. Robienie fali B
przed A oznacza mierzenie nowej pracy zepsutym metrem — dokładnie to, co dziś
kosztowało cztery FIX-y. Jedyny wyjątek: **219 (pilot) może iść równolegle**, bo
nie zależy od testów, tylko od nadzoru na żywo.

Jeśli właściciel woli zobaczyć postęp produktowy wcześniej: 214 i 217 dają się
przestawić przed 212, ale 211 musi zostać pierwsze — bez niego nie wiemy, czy
zielony wynik 217 cokolwiek znaczy.
