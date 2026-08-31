---
doc_id: analiza-prawy-panel
status: proposal
truth_type: design-analysis
established: 2026-08-30
autor: nadzorca toru grafiki
dla: Piotr (decyzja przed pracą głęboką)
---

# Prawy panel — co ma w nim być i dlaczego

Zlecenie właściciela: *„praca musi się zacząć od analizy: jakie funkcjonalności
powinniśmy mieć w tym menu, jaki powinien być ich układ i jaki sens ma to wszystko"*.

To nie jest opis stanu zastanego — to **propozycja do rozstrzygnięcia**. Stan zastany
jest zmierzony i podany osobno, żeby dało się jedno od drugiego odróżnić.

---

## 1. Po co w ogóle jest prawy pas

Lewa strona to **przedmiot pracy** — treść notatki, płótno idei, tabela, dokument.
Prawy pas odpowiada na pytania, które człowiek zadaje **o** tym przedmiocie, nie
**w** nim. Siedem pytań, w tej kolejności:

| # | Pytanie | Sekcja |
| --- | --- | --- |
| ① | Co mogę z tym zrobić **teraz**? | Akcje |
| ② | Czym to **jest**? (status, właściciel, termin, wersja) | Właściwości |
| ③ | Z czym to **sąsiaduje**? | Powiązania |
| ④ | Na czym to jest **oparte** — czy mogę temu ufać? | Źródła i założenia |
| ⑤ | Co z tego **powstało**? | Rezultaty |
| ⑥ | Co ludzie o tym **mówią**? | Komentarze |
| ⑦ | Co się z tym **działo**? | Historia |

Kolejność nie jest przypadkowa: **działaj → rozpoznaj → osadź → uzasadnij →
rozlicz → rozmawiaj → sprawdź**. Pierwsze dwie sekcje służą bieżącej pracy i dlatego
są domyślnie rozwinięte. Środkowe trzy osadzają obiekt w łańcuchu doradczym.
Dwie ostatnie to zapis, a nie praca.

---

## 2. Dlaczego trzy sekcje ze środka się rozmywają — i co z tego wynika

**Zmierzone (30.08, 42 powierzchnie stojące na kanonicznym panelu):**

| Sekcja | Ile powierzchni jej używa |
| --- | --- |
| Akcje · Właściwości | 16 |
| Powiązania | 14 |
| Komentarze · Historia | 12 |
| **Źródła i założenia** | **8** |
| **Rezultaty** | **4** |

Łatwo z tego wyciągnąć wniosek „te dwie sekcje są niepotrzebne". **To byłby zły
wniosek.** Powód jest inny i widać go, gdy nazwać te trzy sekcje kierunkiem:

- **Źródła i założenia** patrzą **wstecz** — co było podstawą.
- **Rezultaty** patrzą **naprzód** — co z tego powstało.
- **Powiązania** patrzą **wszerz** — co stoi obok, połączone ręcznie.

Dziś tej różnicy nie widać w nazwach, więc budujący nie wie, gdzie co wstawić — i
wstawia wszystko w „Powiązania", bo to jedyna nazwa, która pasuje do wszystkiego.
Stąd 14 kontra 8 kontra 4. **To nie jest dowód, że sekcje są zbędne — to dowód, że
nazwy nie rozstrzygają.**

**Propozycja:** zachować siedem sekcji, ale w podpisach sekcji **nazwać kierunek**:
- „Źródła i założenia — **na czym to oparto**"
- „Rezultaty — **co z tego powstało**"
- „Powiązania — **z czym to sąsiaduje**"

Jedno zdanie w nagłówku, nie nowa funkcja. Rozstrzyga spór o miejsce zanim powstanie.

---

## 3. Prawdziwa różnica między notatnikiem a ideami: TERESA

To jest sedno zgłoszenia właściciela i **nie jest to różnica kosmetyczna**.

- **Notatnik** — Teresa jest **przyciskiem** w sekcji Historii: „Open Teresa"
  (`NotebookRightRail.tsx:664`). Wyjście na zewnątrz panelu.
- **Idee** — Teresa jest **własną sekcją** panelu: `IdeaTeresaSection`, z osobnym
  mostem `useIdeasTeresaBridge`. Mieszka w środku.

Do tego obowiązuje doktryna **D17**, cytat właściciela z 12.07:
*„Generalnie wszystko korzysta z panelu Teresy — nigdy nie ma innego i przekładamy
go na PRAWĄ stronę ekranu."*

**Wniosek: prawy pas ma DWÓCH lokatorów — panel artefaktu i Teresę — i nikt nigdy
nie rozstrzygnął, jak mają się dzielić miejscem.** Każdy ekran rozwiązał to sam:
karty artefaktów oddają prawą stronę panelowi, ekrany czatu oddają ją Teresie,
notatnik zrobił przycisk-wyjście, idee wcisnęły czat w akordeon.

**To jest przyczyna, nie objaw.** Wyrównanie samych sekcji tego nie naprawi.

---

## 4. Propozycja układu

**Prawy pas = stała szyna ikon (56 px) + jeden otwarty panel.**

```
┌───────────────────────────┬────┐
│                           │ ▣  │ ← Artefakt (siedem sekcji)
│   PANEL                   │ ✦  │ ← Teresa (pełna wysokość)
│   (jeden z dwóch)         │ ⌸  │ ← Rezultaty pracy, gdy ich dużo
│                           │    │
└───────────────────────────┴────┘
```

**Dlaczego Teresa NIE jest ósmą sekcją akordeonu:** rozmowa potrzebuje **pełnej
wysokości** i własnego pola pisania. Wciśnięta w akordeon obok sześciu innych
zwijanych sekcji przestaje być rozmową, a staje się widżetem — i tak wygląda dziś
w ideach. Teresa jest **trybem** prawego pasa, nie jego sekcją.

**Dlaczego szyna ikon jest STAŁA, a nie chowana:** jeśli Teresa znika razem z panelem,
to doktryna „Teresa zawsze po prawej" przestaje obowiązywać w momencie, w którym
ktoś zwinie panel. Szyna 56 px istnieje już w powłoce modułu wykonawczego
(`ExecutiveModuleShell/RightRail`) — jest gotowym wzorcem, nie nowym wynalazkiem.

---

## 5. Co konkretnie ma być w każdej sekcji — dla notatki i dla idei

Właściciel zdecydował: **notatka i idea dostają pełne siedem sekcji.** Poniżej
propozycja treści. To jest lista do rozstrzygnięcia, nie stan zastany.

| Sekcja | Notatka | Idea (mapa myśli / płótno) |
| --- | --- | --- |
| **① Akcje** | Zamień w zadanie · Zamień w inicjatywę · Dodaj przypomnienie · Udostępnij · Archiwizuj | Zamień gałąź w zadanie · Zbuduj z tego dokument · Uruchom narzędzie · Udostępnij |
| **② Właściwości** | właściciel · utworzono · źródło (z rozmowy / ręcznie) · przypomnienie · widoczność | właściciel · liczba gałęzi · narzędzie źródłowe · widoczność · wersja |
| **③ Powiązania — z czym sąsiaduje** | notatki linkowane `[[…]]` · projekt · osoby wspomniane | idee siostrzane · inicjatywa · projekt |
| **④ Źródła i założenia — na czym oparto** | rozmowa/spotkanie, z którego powstała · dokumenty · **założenia przyjęte przez Teresę, jawnie** | wywiady i dane pod gałęziami · założenia rynkowe · czego NIE wiemy |
| **⑤ Rezultaty — co z tego powstało** | zadania · decyzje · dokumenty utworzone z tej notatki | zadania · inicjatywy · dokumenty · raport |
| **⑥ Komentarze** | wątki osób, nierozstrzygnięte na wierzchu | to samo |
| **⑦ Historia** | kto i kiedy zmienił · wpisy Teresy jako TYP wpisu, nie osobna nazwa sekcji | to samo + historia wersji płótna |

**Sekcja ④ jest najważniejsza i dziś jej nie ma.** To ona odpowiada na pytanie, które
właściciel stawia produktowi od początku: **czy mogę temu ufać.** Notatka utworzona
przez Teresę z rozmowy bez podanego źródła jest twierdzeniem bez pokrycia.

**Sekcja ⑤ domyka łańcuch, o którym właściciel mówił wprost przy notatniku:**
burza mózgów → zadania → czynności. Bez „Rezultatów" ten łańcuch nie ma gdzie się
pokazać — notatka nie wie, co z niej wyszło.

---

## 6. Skala pracy — zmierzona, nie oszacowana

Prawych szyn w aplikacji jest **jedenaście**.

| Stan | Ile | Które |
| --- | --- | --- |
| **Na kanonie** | 4 | `ArtifactRightPanel` (sam kanon) · `IdeaRightPanel` · `NotebookRightRail` · `ExceleRightPanel` |
| **Własna budowa** | 7 | druga szyna Excela · Prezentacje · Tabele (2 pliki) · Deck Builder · Kreator szablonów · powłoka modułu wykonawczego |

**Dodatkowo:** trzy panele stojące na kanonie trzymają **własne kopie listy sekcji**
(`RAIL_SECTION_ORDER` w notatniku i osobne stałe w ideach oraz w Excelu). Ta sama
piątka przepisana trzy razy. Dziś zgodne — i właśnie dlatego wyglądają podobnie.
**Kopie się rozjeżdżają:** wystarczy, że ktoś doda sekcję w jednym miejscu.

---

## 7. Kolejność pracy (zatwierdzona przez właściciela)

**Krok 1 — jedno źródło kolejności.** Trzy kopie listy sekcji znikają; wszystkie
panele czytają `ARTIFACT_PANEL_SECTION_ORDER`. Zmiana mechaniczna, bez efektu
wizualnego. **Zatrzymuje dalsze rozjeżdżanie się** i dlatego idzie pierwsza.

**Krok 2 — rozstrzygnięcie o Teresie** (§3/§4). Bez tego krok 3 zbuduje sekcje,
które za miesiąc trzeba będzie przestawiać.

**Krok 3 — notatka i idea do pełnych siedmiu sekcji**, z treścią z §5.

**Krok 4 — siedem szyn poza kanonem**, po jednej, każda z osobnym odbiorem.
Kodeks zabrania włączania wielu zmian wizualnych naraz.

---

## 8. Co wymaga decyzji właściciela przed startem

1. **Czy Teresa jest trybem prawego pasa (szyna ikon), czy zostaje osobno per ekran?**
   To rozstrzyga architekturę, nie wygląd.
2. **Czy „Źródła i założenia" mają pokazywać założenia przyjęte przez Teresę jawnie?**
   Jeśli tak, to jest wymaganie do silnika, nie do panelu — Teresa musi je zwracać.
3. **Czy „Rezultaty" liczą tylko obiekty utworzone z tej notatki, czy też te, które
   ktoś ręcznie z nią powiązał?** To rozstrzyga, czy sekcja jest zapisem faktu,
   czy wolnym zbiorem.

---

# Uzupełnienie: dokumenty (Word · Excel · PowerPoint) — zgłoszenie właściciela 2026-08-30

Właściciel: *„tutaj też mamy prawy panel w poszczególnych dokumentach — w Wordzie,
w Excelu i w PowerPoincie. Mamy do przepracowania temat, co ma być w tym menu.
To kiedyś było zgłaszane, ale ewidentnie gdzieś nam to przeleciało."*

## Najważniejsze: układ, który zaproponowałem w §4, JUŻ ISTNIEJE — w Wordzie

Prawy pas Studia Dokumentów (`DocumentStudioDocumentPanel.tsx:2778-2890`) to
**szyna narzędzi z ikonami**, a jednym z narzędzi jest **Teresa**:

```
sources · properties · qa · TERESA · comments · activity
```

To jest dokładnie ta architektura, którą opisałem w §4 jako propozycję: **Teresa
jest TRYBEM prawego pasa, nie sekcją akordeonu.** Nie trzeba jej wymyślać — trzeba
ją rozpoznać jako wzorzec i rozciągnąć na resztę.

## Dlaczego nikt tego dotąd nie ujednolicił: JEDNO POJĘCIE, TRZY NAZWY

| Rail | Identyfikatory narzędzi/sekcji |
| --- | --- |
| **Kanon** (akordeon) | actions · properties · relations · **evidence** · results · comments · **history** |
| **Word** (Studio) | **sources** · properties · qa · **teresa** · comments · **activity** |
| **Excel** | **sources** · structure · selected · **history** |
| **Prezentacje** | **activity** |
| **Deck Builder** | blocks · media · **evidence** · relations · comments · **activity** |
| **Notatnik / Idee** | actions · properties · relations · comments · history |

Dwa pojęcia mają po dwie–trzy nazwy:

- **„na czym to oparto"** → `evidence` (kanon, Deck) **albo** `sources` (Word, Excel)
- **„co się z tym działo"** → `history` (kanon, Excel) **albo** `activity` (Word, Prezentacje, Deck)

**To jest przyczyna, dla której temat „przeleciał".** Nie da się zauważyć, że dwie
powierzchnie robią to samo, jeśli nazywają to inaczej — ani greppem, ani okiem.
Każdy kolejny budujący dokładał trzecią nazwę w dobrej wierze.

## Co jest specyficzne dla dokumentów, a czego nie ma w kanonie

Dokumenty mają realne potrzeby, których kanon siedmiu sekcji nie pokrywa:

- **`qa`** (Word) — kontrola jakości dokumentu: fabrykacje, liczby bez pokrycia,
  puste sekcje. To jest **sedno obietnicy produktu** („czy mogę to wysłać klientowi"),
  a występuje w JEDNYM miejscu.
- **`structure` / `blocks` / `media`** (Excel, Deck) — nawigacja po zawartości
  artefaktu. To nie jest „o dokumencie", to jest „po dokumencie" — inna klasa niż
  siedem sekcji kanonu.
- **`selected`** (Excel) — kontekst zaznaczenia. Też nawigacja, nie metadana.

**Wniosek:** prawy pas ma DWA rodzaje zawartości i mieszanie ich to osobny błąd:
1. **O artefakcie** — siedem sekcji kanonu (kim jest, skąd, co z tego, kto mówił).
2. **Po artefakcie** — nawigacja i narzędzia zależne od archetypu (struktura arkusza,
   slajdy, media, zaznaczenie, kontrola jakości).

Szyna ikon obsługuje oba, bo każde narzędzie dostaje pełną wysokość.

## Praca do zgłoszenia — DWIE POŁOWY

### Połowa graficzna (tor grafiki)
1. **Jeden słownik.** `sources`≡`evidence`, `activity`≡`history` — wybrać po jednej
   nazwie i przepisać resztę. Bez tego kroku żadne porównanie nie ma sensu.
2. **Jeden mechanizm.** Szyna ikon 56 px wzorem Worda, dla wszystkich archetypów.
3. **Teresa jako narzędzie szyny**, nie sekcja i nie przycisk-wyjście.
4. **Rozdział „o artefakcie" od „po artefakcie"** — w szynie widoczny, nie zlepiony.

### Połowa funkcjonalna (tor funkcji)
Sekcje kanonu, których dokumenty **nie mogą dziś wypełnić, bo serwer tego nie zwraca**:
- **Źródła i założenia** — dokument nie wie, z czego powstał. Potrzebny zapis
  pochodzenia: która ocena, które wywiady, który model finansowy, jakie założenia
  przyjęła Teresa. **Bez tego „czy mogę temu ufać" nie ma odpowiedzi.**
- **Rezultaty** — dokument nie wie, co z niego wyszło (zadania, decyzje, kolejne
  materiały).
- **Kontrola jakości poza Wordem** — Excel i PowerPoint nie mają odpowiednika `qa`.

To nie jest praca w panelu. To jest **kontrakt danych** i dopiero po nim panel ma co
pokazać — dokładnie tak samo jak przy wskaźnikach, które nie mają nazw, tylko kody.
