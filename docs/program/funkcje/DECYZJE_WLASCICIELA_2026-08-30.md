---
doc_id: funkcje-decyzje-wlasciciela-20260830
status: canonical
owner: piotr
truth_type: owner-decision
established: 2026-08-30
---

# Decyzje właściciela — 2026-08-30

Zapisane **w godzinie, w której zapadły**. Cztery pytania zostały właścicielowi
**zadane po raz pierwszy 30.08** — wcześniej istniały wyłącznie w planie funkcji
i nigdy do niego nie wyszły. To był błąd nadzorcy, odnotowany jawnie.

---

## `DEC-2026-08-30-01` — wskaźnik jest bytem NIEZALEŻNYM od inicjatywy

**Słowa właściciela:** „Ja bym rozłączył wskaźnik od inicjatywy. Praktycznie możemy
obserwować KPI, które już dawno zostały zrealizowane w ramach inicjatyw, więc chyba
dobrze byłoby, aby przedłużały się dłużej."

**Rozstrzygnięcie.** Wskaźnik **nie umiera** razem z inicjatywą i **nie jest** jej
częścią cyklu życia. Jest obiektem samodzielnym: powstaje najczęściej z rekomendacji,
zachowuje **odnośnik do inicjatywy źródłowej**, ale jego istnienie, pomiar i historia
trwają **po zamknięciu tej inicjatywy**.

**To jest MOCNIEJSZE niż moja rekomendacja.** Rekomendowałem „należy do klienta,
z odnośnikiem do inicjatywy". Właściciel poszedł dalej: **rozłączenie**, z jawnym
uzasadnieniem praktycznym — obserwujemy dziś wskaźniki inicjatyw dawno zamkniętych.

**Co z tego wynika dla fazy 5:**
- zamknięcie inicjatywy **nie może** kasować, archiwizować ani ukrywać wskaźnika;
- wskaźnik musi mieć **własną tożsamość** niezależną od identyfikatora inicjatywy;
- relacja inicjatywa→wskaźnik jest **odnośnikiem historycznym**, nie własnością;
- pomiar wskaźnika musi działać, gdy inicjatywa źródłowa jest zamknięta albo usunięta.

**Konsekwencja kosztowa, przyjęta świadomie:** więcej migracji teraz, bo dziś istnieje
**co najmniej siedem** rozłącznych magazynów wskaźników. W zamian Wyniki przestają być
drugą rzeczywistością.

---

## `DEC-2026-08-30-02` — rozliczenia w pierwszej wersji BEZ realnych płatności

**Słowa właściciela:** „3 zgodnie z rekomendacją."

**Rozstrzygnięcie.** Pierwsza wersja obejmuje **plan, zużycie i faktury**.
**Realnych płatności nie budujemy.** Utrzymana zostaje wcześniej zatwierdzona
decyzja o kafelku z linkiem tylko do odczytu.

**Otwarte, do zmierzenia — nie do zgadywania:** dwa niezależne sprawdzenia dały
sprzeczny wynik co do tego, co użytkownik widzi dziś (jedno: łańcuch przekierowań
kończący się na czacie; drugie: realny panel z planem i saldem). **Prawdopodobnie
zależy od roli.** Rozstrzygnięcie wymaga uruchomienia produktu i jest osobną pozycją
pomiarową, nie podstawą planu.

---

## `DEC-2026-08-30-03` — zakres oferty to TRZY narzędzia, nie pięć

**Słowa właściciela:** „Jeżeli chodzi o same narzędzia, myślę, że gdybyśmy mieli
trzy z nich, byłoby wystarczająco."

**Rozstrzygnięcie.** Docelowy zakres pierwszej wersji to **trzy narzędzia**, nie pięć.
**Które trzy — właściciel wskaże po dostarczeniu listy decyzyjnej ze stanem
zbudowania każdego narzędzia.**

**To jest największe cięcie zakresu w całym programie** i jest **ostrzejsze**, niż
zakładał plan. Plan mówił o wyborze pięciu z trzydziestu jeden.

**★★ SPROSTOWANIE SPROSTOWANIA — błąd nadzorcy, poprawiony w tej samej godzinie.**

Napisałem wyżej, że liczba „trzydzieści jeden" nie ma źródła i że narzędzi jest
dwadzieścia dwa. **Obie te tezy są fałszywe i sam je obaliłem pomiarem.**

**Liczba 31 jest prawdziwa i ma źródło:**
`src/components/DiscoveryTools/dedicatedToolTypes.ts` — stała `DEDICATED_TOOL_TYPES`
zawiera **dokładnie 31 pozycji**, opisanych w komentarzu tego pliku jako typy sesji,
które mają **realną implementację `ToolDocumentView`/`ToolCanvas`**. Przeliczone
komendą, nie przepisane z dokumentu.

**Lista dwudziestu dwóch, którą podałem właścicielowi, była LISTĄ MARTWĄ.**
Pochodziła z `src/config/transformationTools.ts` — katalogu, którego **jedynym
konsumentem w całej aplikacji** jest karta w `RecommendationPanel.tsx` bez obsługi
kliknięcia: czysta etykieta z nazwą i kategorią. Zero ekranu, zero silnika, zero
wyjścia. Nazwy takie jak „BCG Matrix", „5S Methodology" czy „Six Sigma DMAIC"
**nie odpowiadają żadnemu działającemu narzędziu w produkcie**.

**Jak do tego doszło.** Wziąłem pierwszy rejestr, który pasował nazwą, i nie
sprawdziłem, czy ma konsumenta. To jest dokładnie dziewiąty kształt fałszywego
„gotowe" z naszego własnego katalogu: **próbka zamiast zbioru**. Popełniłem go
w miejscu najgorszym z możliwych — w liście, na podstawie której właściciel miał
podjąć największą decyzję zakresową w programie.

**Stan wiążący:** wybór trzech narzędzi następuje z listy **31 pozycji**
`DEDICATED_TOOL_TYPES`, po dostarczeniu pomiaru kosztu dla każdej z nich.

---

## Pozostaje otwarte

**Trzy do pięciu realnych tematów z praktyki właściciela na typ dokumentu.**
Właściciel: „Dam ci, jak wrócę z biegania." Bez tego najostrzejsze kryterium rubryki
odbioru dokumentu — porównanie ślepe z realnym dokumentem — pozostaje martwe.
