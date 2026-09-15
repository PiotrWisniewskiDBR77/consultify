# Independent review — K1 E2f-bis W73

**Werdykt: HOLD. Przyrząd przechodzi własne testy, ale K4obj łamie wiążącą zasadę „precyzja przed czułością" i zawyża mianownik.**

Kandydat: `309a7f398d58e82eaf4f13d67aea385af006a1bd`  
Baza: `f2628a0d36af85d97bcbe67b820d728c7c2f2f28`

## P1 — K4obj skanuje 42 właściwości zamiast siedmiu wskazanych w W73

W73 definiuje ujścia `label`, `title`, `placeholder`, `header`, `description`, `tooltip`, `emptyText`. Kandydat rozszerza listę m.in. o `text`, `name`, `message`, `summary`, `tab`, `badge`, `caption` i `subtitle`. Pełny raport pokazuje przez to oczywiste fałszywe trafienia:

- `src/components/AIChat/AIActionCard.tsx:96` — `text: text-c-text-secondary dark:text-c-text-secondary`;
- `src/actions/registry/sharedActions.ts:472` — techniczny opis unii `initiative | task_set | decision | report | presentation`;
- `src/actions/registry/tableActions.ts:1702` — techniczny zakres `public|organization|authenticated.`.

Wynik K4obj=5375 nie jest więc uczciwym mianownikiem etykiet obiektowych. Test 30/30 sprawdza detektor języka na przygotowanych frazach, ale nie testuje precyzji ekstraktora na realnych fałszywych ujściach.

**Wymagana poprawka:** ograniczyć K4obj do siedmiu właściwości z W73 albo dodać udowodnioną, precyzyjną klasyfikację kontekstu dla każdej dodatkowej właściwości. Dodać regresję co najmniej dla klas Tailwind w `text:` i technicznych opisów kontraktów. Następnie przeliczyć baseline i raport przed/po.

## Pozostałe bramki

- Dwa commity WIP są przeniesione na właściwą bazę; range-diff zachowany.
- Testy własne: 80/80 PASS; importer: 7/7 PASS według dostawy.
- `K10dPL=0`, K8s obejmuje assessment/actionCard, K11 wykrywa trzy formy.
- `check:jezyk:ci`, build, kanon i artefakt przeszły według dostawy.
- Nie znaleziono zmian produktu ani nowych `as any`.

Po naprawie P1 wymagany nowy freeze i ponowny niezależny review.
