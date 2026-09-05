# Odbiór na żywo — pakiet 14-organizacja (21 ekranów)

Data: 2026-09-05. Środowisko: localhost:3000 (kod m03, backend+dane stagingu), sesja właściciela.

## Liczby
- ZGODNY: 0
- ROZNI_SIE: 21
- NIE_DOTARLEM: 0

## GŁÓWNA PRZYCZYNA (jedna, wspólna dla wszystkich 21 ekranów)

Od **03.09.2026** (decyzja DEC-2026-08-26-78 / A3, domknięta w `src/utils/orgRedesignFlag.ts`)
flaga `orgRedesignV1` jest **domyślnie ON**. Realny użytkownik odwiedzający dziś
`/organization` widzi NOWĄ, skonsolidowaną nawigację: **21 starych ekranów → 11
nowych**, każdy owinięty we wspólną powłokę `OrganizationScreenShell`
(breadcrumb → pigułki zakładek sekcji → chipy liczników Wszystkie/Uzupełnione/
Do uzupełnienia/Konflikty → karty treści → prawy panel „STAN DANYCH" z jednym
wspólnym „Zapisz zmiany"). Żaden z 21 zatwierdzonych obrazów w tym pakiecie
(ani `org-identity-operating__PRZED`, ani 20 miniatur `mini-org-*__PO__light`
z `evidence/grafika/216-poprawione-dzis/`) NIE pokazuje tej powłoki — wszystkie
pokazują STARĄ strukturę: jeden ekran = jedna pozycja w menu, duży pierścień
„Kompletność X%", baner Teresy, przycisk „Zapisz zmiany" per ekran.

Zweryfikowana mapa konsolidacji (klik po kliku, na żywej aplikacji):

| Stary ekran (JSON) | Dzisiejszy adres | Zakładka |
|---|---|---|
| identity-scale | /organization/profile/identity-scale | Tożsamość |
| operating-model | (ta sama strona) | „Model dostawy" — **martwa zakładka, brak treści** |
| position-direction | /organization/profile/position-direction | Pozycja i priorytety |
| technology-culture-constraints | (ta sama strona) | Technologia / Kultura i komunikacja / Ograniczenia i ryzyko |
| strategic-intent | /organization/goals/strategic-intent | Intencja strategiczna |
| success-metrics | (ta sama strona) | Mierniki sukcesu |
| scope-boundaries | /organization/goals/scope-boundaries | Zakres |
| stakeholder-expectations | (ta sama strona) | **brak zakładki — treść nieznaleziona** |
| declared-challenges | /organization/challenges/declared-challenges | Zadeklarowane wyzwania |
| evidence | (ta sama strona) | Dowody |
| root-causes | /organization/challenges/root-causes | Przyczyny źródłowe |
| goal-blockers | (ta sama strona) | Blokery |
| risks-opportunities | /organization/strategy/risks-opportunities | Ryzyka / Szanse |
| scenarios + recommendation | /organization/strategy/executive-brief | Scenariusze transformacji (rekomendacja jako baner na tej samej zakładce) |
| executive-brief | (ta sama strona) | Executive brief |
| files, claims-sources, source-conflicts | /organization/sources/claims-sources | **jedna strona bez zakładek, wszystkie 3 razem** |
| knowledge-graph | /organization/sources/knowledge-graph | (własny ekran) |
| summary | /organization/readiness/summary | (własny ekran) |

## Dodatkowe, konkretne defekty (poza samą zmianą powłoki)
1. **org-operating-model — martwa zakładka.** Kliknięcie „Model dostawy" podświetla
   pigułkę, ale treść strony się nie zmienia ani nie przewija — sprawdziłem cały
   tekst strony, sekcji „Model operacji" (rozliczenia, przychód, systemy ERP/CRM,
   rynek/konkurencja) nie ma NIGDZIE w dzisiejszej aplikacji.
2. **org-stakeholder-expectations — treść niedostępna.** Ekran docelowy
   („Zakres i tryb współpracy") ma tylko 2 zakładki (Zakres, Tryb współpracy);
   trzeciej dla oczekiwań interesariuszy nie ma.
3. **org-technology-culture-constraints — treść uboższa.** Zakładka „Technologia"
   to dziś 4 proste pola tekstowe/select, bez bogatego selektora „Obecne systemy"
   (SAP/Oracle/Salesforce/Jira…) widocznego na zatwierdzonym obrazie.
4. **org-summary — surowy JSON na ekranie.** Sekcja „Co blokuje i kogo zatrzymuje"
   pokazuje karty konfliktów z NIEPRZETWORZONYM obiektem JSON wprost jako tekst
   (`{"section":"goals","primaryObjective":""...}` i dziesiątki rekordów
   `ideaId/title/body/tags`) zamiast czytelnego opisu konfliktu po polsku.
5. **org-knowledge-graph — mieszanka języków w stałym elemencie.** Chip typu
   encji „risk" jest po angielsku obok polskich „Miernik"/„Osoba"/„Technologia".
6. **org-scenarios — nazwy scenariuszy po angielsku** (Digital Foundation,
   Customer Experience Revolution…) — to jednak może być świadomy żargon,
   analogicznie do zaakceptowanego wyjątku w pakiecie Finansów.

## Lista różnic (jedno zdanie każda)
Wszystkie 21 ekranów: inna powłoka (nowe Menu 2/Menu 3 + prawy panel „STAN DANYCH")
niż na zatwierdzonym obrazie — patrz GŁÓWNA PRZYCZYNA. Dodatkowo, per ekran:
org-operating-model (zakładka martwa), org-stakeholder-expectations (treść
zgubiona), org-technology-culture-constraints (treść uboższa), org-summary
(surowy JSON widoczny użytkownikowi), org-knowledge-graph (nieprzetłumaczony
chip „risk"), org-source-conflicts (potwierdzone: to ten sam ekran co
Twierdzenia i źródła).

## Lista „nie dotarłem" z powodem
Brak — do każdego z 21 adresów udało się dotrzeć (choć w 2 przypadkach
docelowa treść okazała się nieobecna/martwa, patrz wyżej — sklasyfikowane
jako ROZNI_SIE, nie NIE_DOTARLEM, bo realny ekran pod tym adresem istnieje).

## Czas i trudności
Ok. 90 minut. Największa trudność: ustalenie, że flaga `orgRedesignV1` zmieniła
domyślną wartość na ON dopiero 2 dni przed tym odbiorem (03.09), więc WSZYSTKIE
zatwierdzone obrazy tego pakietu (zrobione wcześniej, w wariancie OFF) automatycznie
przestały odzwierciedlać to, co widzi dzisiejszy użytkownik — bez przeczytania
`src/utils/orgRedesignFlag.ts` i `OrganizationSidebar.tsx`/`OrganizationView.tsx`
łatwo byłoby błędnie ocenić pojedyncze ekrany jako „lekko przestylowane", zamiast
rozpoznać jedną systemową przyczynę dla całego pakietu. Druga trudność: mapowanie
21 starych adresów na 11 nowych ekranów wymagało klikania i podglądania
nawigacji krok po kroku (nawigacja przez URL nie zawsze trafiała w oczekiwaną
zakładkę za pierwszym razem). Trzecia: krótki, przejściowy blackout backendu
(502 Bad Gateway, ok. 15 sekund) w trakcie pracy — zweryfikowany jako incydent
środowiska, nie defekt produktu (health-check wrócił do 200 chwilę później,
kolejne zrzuty czyste).
