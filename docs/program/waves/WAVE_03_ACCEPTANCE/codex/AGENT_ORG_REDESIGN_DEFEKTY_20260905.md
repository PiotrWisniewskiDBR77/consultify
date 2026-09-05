# Naprawa 4 defektów powłoki `orgRedesignV1` — 05.09.2026

Robotnik: agent w worktree `/private/tmp/ag-org-redesign`, gałąź
`agent/org-redesign-defekty-20260905`, baza `m03` (tip `2398ebbead`).

Źródło zlecenia: `/private/tmp/m03/evidence/odbior-zywo-20260905/14-organizacja/RAPORT.md`
+ `wyniki.json` (odbiór na żywo, 21 ekranów Organizacji, flaga `orgRedesignV1`
domyślnie ON od 03.09 / DEC A3).

## Podsumowanie werdyktu

| # | Defekt zgłoszony w odbiorze | Werdykt po analizie | Naprawa |
|---|---|---|---|
| 1 | Martwa zakładka „Model dostawy" (org-operating-model) | **Potwierdzony, prawdziwy bug** | Kod |
| 2 | Zgubiona treść „Oczekiwania interesariuszy" (org-stakeholder-expectations) | **Potwierdzony, ale przyczyna inna niż zgłoszona** — dane są, brak widocznego podpisu | Kod |
| 3 | Uboższa treść „Technologia" (org-technology-culture-constraints) | **Odrzucony — audyt porównał z INNYM ekranem** | Tylko test regresyjny |
| 4 | Surowy JSON w org-summary („Co blokuje i kogo zatrzymuje") | **Potwierdzony, prawdziwy bug** (obecny też w legacy panelu pod flagą OFF) | Kod (+ dociągnięta duplikacja tekstu) |

## Defekt 1 — martwa zakładka „Model dostawy"

**Przyczyna.** `OrganizationIdentityOperatingScreen.tsx` renderuje 4 stałe
pigułki (`IDENTITY_OPERATING_SECTIONS`), ale treść sekcji `delivery`
(`delivery_model`, `revenue_model`) jest warunkowa —
`showDeliveryModel(orgType)`/`showRevenueModel(orgType)` z
`organizationProfileTaxonomy.tsx`. Gdy typ organizacji nie jest ustawiony
(dokładnie stan organizacji użytej w odbiorze na żywo: „Uzupełnione 2/13",
`organization_type: ''`) albo jest typu, dla którego oba warunki są
fałszywe, `sectionHasContent('delivery')` jest `false` — `<div ref=.../>`
nigdy się nie renderuje. Efekt: pigułka podświetla się po kliknięciu
(`activeSection` się zmienia), ale nie ma czego przewinąć — wygląda na
martwą. Stary ekran (`OrganizationProfileModule.tsx`) miał ten sam warunek,
ale stosowany do CAŁEJ pozycji nawigacji „Model operacji" — warunkowo znikała
z menu, nigdy nie zostawała jako martwy link.

**Decyzja:** ukryć pigułkę zamiast usuwać zakładkę na stałe — dynamicznie,
zależnie od typu organizacji (tak jak robił to stary ekran), bo to
zachowuje redesign i jest odwracalne w locie (użytkownik zmienia typ
organizacji → pigułka się pojawia). Podłączanie „istniejącego komponentu"
nie miało sensu — komponent (pola `delivery_model`/`revenue_model`) już tam
jest, tylko warunkowo ukryty; usunięcie zakładki na stałe zabrałoby ją też
organizacjom typu SERVICES/TECHNOLOGY/PUBLIC_SECTOR, dla których treść
istnieje i jest poprawna.

**Kod:** `src/components/Organization/redesign/OrganizationIdentityOperatingScreen.tsx`
— nowa `sectionApplicable()` (oparta o `visibleFields`, NIE o
`shownFields`/chip, żeby pigułka nie migała przy filtrowaniu), `sections`
filtruje się przez nią, plus `useEffect` który przełącza `activeSection` na
pierwszą dostępną, gdy aktywna zniknie.

**Test:** `OrganizationIdentityOperatingScreen.test.tsx` — nowy przypadek
z pustym `organization_type` dowodzi, że pigułki „Model dostawy" nie ma
wcale (nie: „jest, ale nic nie robi").

**Zrzut PO:** `evidence/org-redesign-20260905/org-operating-model-PO.png`
(jasny motyw, 1440×900) — 3 pigułki: Tożsamość/Skala/Rynki i systemy.

## Defekt 2 — „zgubiona" treść oczekiwań interesariuszy

**Przyczyna prawdziwa (inna niż w raporcie odbioru).** Stary ekran
„Oczekiwania interesariuszy" (`GoalsExpectationsModule.tsx`, zakładka
`expectations`) to trzy pola: Archetyp transformacji / Rola AI / Rytm
nadzoru (`goals.transformationArchetype`/`aiRole`/`steeringCadence` w
`useContextBuilderStore`). W redesignie ta sama treść, ten sam magazyn i
te same trzy pola żyją w `OrganizationScopeCollaborationScreen.tsx` pod
zakładką „Tryb współpracy" — to ŚWIADOMA, udokumentowana w komentarzu
konsolidacja (`§7 Zakres i granice + §8 Oczekiwania interesariuszy → dwie
pigułki: Zakres · Tryb współpracy`), nie utrata danych.

Realny bug: `OrgChoiceSegment` (współdzielony prymityw pigułek-radiogroup)
przyjmował prop `label`, ale używał go WYŁĄCZNIE jako `aria-label` —
niewidoczny dla widzącego użytkownika. Trzy grupy pigułek („Archetyp
transformacji"/„Rola AI"/„Rytm nadzoru") renderowały się jedna pod drugą
bez ŻADNEGO widocznego tytułu — stąd wrażenie „treść zgubiona", mimo że
dane i pola tam były. Siostrzany prymityw `OrgTagToggleGroup` już pokazywał
etykietę widocznie (`<p className={ORG_L1}>`) — to była niespójność w
implementacji, nie świadomy wybór projektowy.

**Kod:** `src/components/Organization/redesign/OrganizationCardPrimitives.tsx`
— `OrgChoiceSegment` renderuje teraz widoczny podpis (`ORG_L1`) nad grupą
pigułek, identycznie jak `OrgTagToggleGroup`. Naprawa dotyczy 3 miejsc
użycia: „Typ organizacji" (Tożsamość i model działania), „Apetyt na
ryzyko" (Kierunek i ograniczenia), i trzy pola „Tryb współpracy".

**Test:** `OrganizationScopeCollaborationScreen.test.tsx` — nowy przypadek
dowodzi, że tekst „Archetyp transformacji"/„Rola AI"/„Rytm nadzoru" jest
faktycznie w DOM (nie tylko w `aria-label`).

**Zrzut PO:** `evidence/org-redesign-20260905/org-stakeholder-expectations-PO.png`
— trzy widoczne nagłówki nad grupami pigułek.

## Defekt 3 — „uboższa" treść Technologia/Kultura/Ograniczenia

**Werdykt: audyt porównał zakładkę z INNYM ekranem, kod jest poprawny.**

Zweryfikowano wprost w kodzie: stary ekran „Technologia, kultura i
ograniczenia" (`OrganizationProfileModule.tsx`,
`PROFILE_SCREEN_AREAS['technology-culture-constraints'] = ['digital',
'communication', 'constraints']`) ma DOKŁADNIE te same pola co nowa
zakładka „Technologia" w `OrganizationDirectionConstraintsScreen.tsx`:
`digital_maturity_overall`, `cloud_adoption_level`, `technology_stack`,
`digital_budget_percent`. Zweryfikowano też wizualnie na zatwierdzonym
obrazie `evidence/grafika/216-poprawione-dzis/mini-org-technology-culture-constraints__PO__light.png`
— identyczne 4 pola, bez selektora „Obecne systemy".

„Obecne systemy" (`core_systems`, SAP/Oracle/Salesforce/Jira) nigdy nie
należało do tego ekranu — ani na starym, ani na nowym. To pole żyje
w `operating` area starego ekranu „Model działania" (`operating-model`), a
w redesignie poprawnie w `OrganizationIdentityOperatingScreen.tsx` →
sekcja „Rynki i systemy rdzeniowe" (`OrgTagToggleGroup` z
`CORE_SYSTEMS_OPTIONS`). Audytor w odbiorze na żywo porównał zakładkę
„Technologia" z zatwierdzonym obrazem INNEGO ekranu („Model działania") —
sam to zresztą napisał w opisie („…widocznego na zatwierdzonym obrazie
w ekranie 'Model działania'"), tylko nie wyciągnął z tego właściwego
wniosku.

**Decyzja: brak zmiany kodu produkcyjnego.** Dodanie „Obecne systemy" do
zakładki „Technologia" byłoby DUPLIKACJĄ pola w złym miejscu, niezgodną
ani ze starym ekranem, ani z zamierzoną konsolidacją. Zamiast tego dodano
test regresyjny, który broni granicy: 4 pola „Technologia" muszą zostać,
i „Obecne systemy" nie powinno się tam pojawić.

**Test:** `OrganizationDirectionConstraintsScreen.test.tsx` — nowy
przypadek asercji na 4 etykietach pól + asercja `not.toHaveTextContent`
na „Obecne systemy" w karcie.

**Zrzut PO:** `evidence/org-redesign-20260905/org-technology-culture-constraints-PO.png`
— przy okazji widać też skutek naprawy defektu 2: „APETYT NA RYZYKO" ma
teraz widoczny podpis (ten sam `OrgChoiceSegment`).

## Defekt 4 — surowy JSON w org-summary

**Przyczyna.** `OrganizationReadinessScreen.tsx` (redesign) i
`OrganizationDecisionQualityPanel.tsx` (legacy panel pod flagą OFF —
DOKŁADNIE ten sam kod skopiowany) miały funkcję formatującą wartość
twierdzenia z fallbackiem `JSON.stringify(value)` dla każdej wartości
niebędącej stringiem. `GovernedClaim.value` jest typu `unknown` i realnie
bywa całym obiektem/tablicą z ekstrakcji dokumentu (np.
`notes.manualContext` = snapshot formularza, `myWork.idea` = rekord
pomysłu z `ideaId`/`title`/`body`/`tags`).

**Kod:** nowa, współdzielona para funkcji w
`src/services/organizationGovernedContextApi.ts`:
- `summarizeClaimValue(value)` — NIGDY nie zwraca JSON-u: string jak jest,
  liczba/bool jako tekst, tablica jako „N pozycji", obiekt przez pole
  `title`/`name`/`label` (stąd w zrzucie PO widać czytelne tytuły
  pomysłów zamiast `{ideaId: ..., title: ..., ...}`) albo „Złożona
  wartość (N pól)".
- `claimValueKey(value)` — stabilny klucz RÓWNOŚCI (do wykrywania, czy
  dwie wartości źródeł faktycznie się różnią), używany OSOBNO od
  `summarizeClaimValue`, bo dwa różne obiekty bez pola title/name/label
  mogłyby streścić się do identycznego tekstu i ukryć realny konflikt
  (zweryfikowane testem regresyjnym, patrz niżej) albo, odwrotnie,
  powtórzyć identyczny tekst kilkanaście razy w UI (naprawione drugim
  commitem po weryfikacji na żywym ekranie).

**Test:** `OrganizationReadinessScreen.test.tsx` — nowy przypadek z dwoma
konfliktowymi wartościami-obiektami dowodzi braku `{"` na całej stronie.
**Dowód mutacyjny** (wykonany ręcznie przed commitem, nieobecny w repo):
przywrócenie `JSON.stringify` jako fallbacku w `summarizeClaimValue`
powoduje czerwony test z komunikatem `expected '...' not to match /\{"/`
— zweryfikowano i cofnięto.

**Zrzut PO:** `evidence/org-redesign-20260905/org-summary-PO.png` — zero
nawiasów klamrowych/cudzysłowów kluczy na całym ekranie; konflikt
`myWork.idea` pokazuje czytelne tytuły pomysłów rozdzielone „↔".

## Commity (5, każdy przetestowany esbuild + vitest przed commitem)

```
0fa43c4b72 fix(organization-redesign): usuń martwą pigułkę „Model dostawy" bez treści dla typu organizacji
c628c7e403 fix(organization-redesign): pokaż widoczny podpis grupy pigułek w OrgChoiceSegment
6046d2e7f6 test(organization-redesign): udokumentuj parytet zakładki „Technologia" (org-technology-culture-constraints)
97cd77a4e6 fix(organization): nigdy nie renderuj surowego JSON-u wartości twierdzenia w UI
68fb43dcd8 fix(organization): nie duplikuj identycznego opisu konfliktu wiele razy w UI
```

Autor wszystkich: `Piotr <piotr.wisniewski@dbr77.com>`. Gałąź:
`agent/org-redesign-defekty-20260905` (worktree `/private/tmp/ag-org-redesign`,
baza `m03` tip `2398ebbead`). Nic nie zostało wypchnięte (`git push`) ani
scalone — do decyzji nadzorcy.

## Jak zweryfikowano (środowisko)

Własny `vite` (nie backend) na porcie **3009** (port 3000 zajęty przez inny
proces), `.env.local` skopiowany z `/private/tmp/m03/.env.local`
(`VITE_API_TARGET=https://staging.consultify.ai` — realne dane stagingu
przez proxy, bez lokalnego backendu). Kopia
`scripts/dev/odbior-zywo/zrzut.mjs` z dwiema zmianami:
1. port `3000`→`3009` w `page.goto`,
2. sesja z `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json` jest
   zapisana dla originu `http://localhost:3000` — Playwright
   `storageState` wstrzykuje `localStorage` TYLKO dla dokładnie pasującego
   originu, więc port 3009 lądowałby na `/login`. Dopisano ręczne
   wstrzyknięcie tych samych kluczy `localStorage` pod nowym originem
   (PRZED nadpisaniem motywu na jasny, żeby kopiowany
   `consultify-storage` nie nadpisał wymuszonego `light`).

Proces `vite` zatrzymany po PID (`kill $(cat /tmp/org-redesign-vite.pid)`)
po zakończeniu zrzutów — zweryfikowano `lsof -i :3009` puste.

Zrzuty w `evidence/org-redesign-20260905/`:
`org-operating-model-PO.png`, `org-stakeholder-expectations-PO.png`,
`org-technology-culture-constraints-PO.png`, `org-summary-PO.png`
(wszystkie 1440px, jasny motyw, sesja realna ze stagingu).

## Otwarte, poza zakresem tego zlecenia

- `OrganizationRootCausesBlockersScreen.test.tsx` ma 1 nieprzechodzący
  test (`fireEvent.click(screen.getByText('Dodaj blocker'))`) —
  zweryfikowano, że to PRE-ISTNIEJĄCA usterka niezwiązana z tym
  zleceniem (plik nietknięty, test failuje identycznie na czystym
  stanie `m03`). Nie naprawiane w tym zleceniu — do osobnego dyżuru.
- Dwa drobne, wymienione w RAPORT.md ale NIE zlecone do naprawy:
  org-knowledge-graph (chip „risk" nieprzetłumaczony) i org-scenarios
  (angielskie nazwy scenariuszy) — świadomie pominięte, zgodnie z treścią
  zlecenia (4 konkretne defekty).
