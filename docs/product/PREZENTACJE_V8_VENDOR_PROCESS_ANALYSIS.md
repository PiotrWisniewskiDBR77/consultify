# Prezentacje v8 - Vendor process analysis

> Status: Draft v8
> Cel: Zmapowac caly proces pracy w Gamma, Beautiful.ai i Pitch na jedna praktyczna warstwe wnioskow dla `consultify`.

---

## 1. Po co istnieje ten dokument

`PREZENTACJE_V8_BENCHMARK.md` opisuje wzorce funkcjonalne.
Ten dokument zamyka caly proces pracy vendorow:
- jak user startuje,
- jak planuje deck,
- jak buduje slajdy,
- jak dobierane sa grafiki,
- jak dziala builder,
- jak wyglada delivery.

To nie jest dokument UI.
To dokument procesu produktu.

---

## 2. Wspolny model procesu

Wszystkie trzy aplikacje prowadza usera przez podobny ciag:

`entry -> create setup -> structure plan -> slide draft -> refine -> present/share/export`

Roznice sa w tym, co jest najmocniejsze:
- `Gamma`
  najsilniejsze AI-first create i szybkie przejscie od promptu do decku
- `Beautiful.ai`
  najsilniejsze quality-by-structure i layout guardrails
- `Pitch`
  najsilniejsze builder, present/share i team delivery

Docelowy model `consultify`:
- bierze spine procesu z Gamma,
- bierze discipline slajdu z Beautiful.ai,
- bierze delivery i team semantics z Pitch,
- dodaje traceability, artifacts i governed AI.

---

## 3. Proces Gamma

### 3.1 Entry

Gamma prowadzi usera szybko do tworzenia:
- blank create,
- create from prompt,
- import/paste content,
- template/theme-driven create.

Najwazniejsza cecha:
- user nie ma poczucia, ze najpierw musi zbudowac strukture recznie.

### 3.2 Setup

Gamma daje userowi lekki panel decyzji:
- co budujemy,
- w jakim formacie,
- jaki ma byc ton i gestosc,
- jaki template/theme,
- jak dzielic lub kondensowac content.

Najwazniejsza cecha:
- setup nie jest "konfiguracja systemowa", tylko szybkie ustawienie zamiaru tworzenia.

### 3.3 Planning

Gamma bardzo szybko przechodzi do planu:
- AI proponuje structure,
- outline jest czytelny,
- user moze skorygowac zanim zobaczy finalny deck.

Najwazniejsza cecha:
- planning jest czescia tworzenia, nie osobnym ciezkim etapem.

### 3.4 Draft

Gamma buduje pierwsza wersje decku:
- cards/slides pojawiaja sie szybko,
- AI tworzy copy, strukturze i visuals direction,
- user nie startuje od pustej planszy.

### 3.5 Refine

Po draft:
- user pracuje na cards,
- szybko edytuje tekst,
- dodaje/usuwaza cards,
- korzysta z AI agent actions.

### 3.6 Deliver

Deck pozostaje living artifact:
- share,
- present,
- export,
- sometimes webpage/document variants.

### 3.7 Wniosek dla `consultify`

Must-have parity z Gamma:
- AI-first setup,
- outline-first review,
- szybki create-to-draft,
- builder jako kontynuacja tego samego flow,
- export/share jako koniec tej samej historii, nie osobny modul.

---

## 4. Proces Beautiful.ai

### 4.1 Entry i setup

Beautiful.ai jest mniej AI-first niz Gamma.
Jego sila nie lezy w create speed, tylko w controlled composition.

### 4.2 Planning

Planning jest bardziej podporzadkowany temu, co slajd powinien znaczyc:
- less chaos,
- more expected structure,
- more template-driven outcomes.

### 4.3 Slide building

Najmocniejsza warstwa:
- smart slide discipline,
- constrained layouts,
- reduced freedom,
- better default polish.

Najwazniejsza cecha:
- user nie projektuje slajdu od zera,
- system prowadzi do dobrego rezultatu przez ograniczenia.

### 4.4 Graphics

Grafiki, charts, tables i spacing sa podporzadkowane czytelnosci.
Visuals wspieraja slajd, a nie dominuja go.

### 4.5 Wniosek dla `consultify`

Must-have adaptation:
- layout guardrails,
- intent -> layout discipline,
- block combinations z ograniczeniami,
- quality gates dla density i readability,
- "good slides by default" nawet bez designera.

---

## 5. Proces Pitch

### 5.1 Entry i create

Pitch jest mniej Gamma-like na starcie, ale bardzo mocny po wejscu do buildera.

### 5.2 Builder

Najmocniejsza warstwa:
- block-like editing,
- deck builder workflow,
- szybkie operacje na slajdach i stylach,
- deck jako wspolny artefakt pracy.

### 5.3 Delivery

Pitch najmocniej domyka:
- present mode,
- sharing,
- analytics,
- team review semantics,
- guests / rooms / speaker view mental model.

### 5.4 Wniosek dla `consultify`

Must-have adaptation:
- builder nie moze byc tylko "editor afterthought",
- delivery model musi byc czescia produktu,
- share/present/analytics musza byc widziane jako naturalny koniec flow,
- review baseline musi byc lekki, ale realny.

---

## 6. Cross-vendor process matrix

| Etap procesu | Gamma | Beautiful.ai | Pitch | Wniosek dla `consultify` |
|---|---|---|---|---|
| Entry | bardzo szybki start do create | bardziej template/design oriented | builder/team oriented | library + quick create musza byc bez tarcia |
| Setup | AI-first, intent-first | bardziej strukturalny | umiarkowany | setup ma byc lekki, ale semantyczny |
| Planning | outline bardzo wazny | plan bardziej podporzadkowany layout discipline | mniej centralny niz builder | outline musi byc glownym review gate |
| Draft | bardzo szybki AI draft | bardziej controlled composition | builder-centric | AI ma tworzyc wiekszosc pierwszej wersji |
| Slide quality | dobre defaults | najlepsze guardrails | dobre authoring controls | potrzebny slide component system i layout rules |
| Graphics | szybkie AI + theme | czytelnosc i control | wspiera delivery polish | potrzebny jawny visual planning contract |
| Builder | szybki refine | mniej wolnosci | najmocniejszy | builder musi byc naturalna druga polowa flow |
| Delivery | mocne, ale nie najmocniejsze | wazne, ale poboczne | bardzo mocne | present/share/export/analytics musza byc spiete z tym samym deckiem |

---

## 7. Braki, ktore ten proces ujawnia dla `v8`

Po porownaniu calego procesu nadal brakowalo nam:
- systemu komponentow slajdu,
- planning engine dla formu lowania slajdow,
- visual planning and graphics routing,
- jednej warstwy procesu vendorowego obok benchmarku funkcjonalnego.

Te luki musza byc domkniete, bo inaczej:
- Gamma parity zostanie tylko na poziomie create story,
- Beautiful.ai parity nie wejdzie do slide quality rules,
- Pitch parity nie przejdzie do delivery and builder semantics.

---

## 8. Finalny wniosek

Jesli `consultify` ma byc naprawde analogiczne do Gamma jako proces pracy, to musi miec jednoczesnie:
- `Gamma speed of planning and draft creation`
- `Beautiful.ai discipline of slide composition`
- `Pitch continuity of builder and delivery`
- `Consultify traceability and governed AI`

Bez tej czworki produkt bedzie tylko czesciowo podobny do liderow.
