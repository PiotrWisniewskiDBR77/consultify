# APWAVE-11 — Lineage Navigator: closing the contract gaps

**Data:** 2026-08-10
**Gałąź:** `codex/finance-v3-apwave-ap11-navigator` (odbita od `d3f708f1e7`)
**Pliki:** `server/src/services/finance/workspace/lineageNavigatorContract.ts`
(712 → 1479 linii), `__tests__/lineageNavigatorContract.test.ts` (385 → 1141 linii)
**Zakres:** rozszerzenie ISTNIEJĄCEGO kontraktu AP-11. Bez zmian w
`workspaceBarContract.ts`, `focusModeContract.ts`, `moduleAdapters.ts`,
migracjach i w bazie.

**Nie robione świadomie:** propagacja staleness po zmianie źródła (punkt 9
wymagań właściciela) — należy do `lineageFreshnessService` z równoległego
strumienia. Kontrakt zakłada jego istnienie i opisuje zależność (patrz §6).

---

## 0. Wyniki pomiarów — przed i po

| Pomiar | Przed (`d3f708f1e7`) | Po (`9dab98df9d`) |
|---|---|---|
| `vitest run lineageNavigatorContract.test.ts` (z `server/`) | 17 passed | **48 passed** |
| `vitest run src/services/finance/workspace/__tests__/` (3 pliki) | — | **111 passed** |
| `npx tsc --noEmit -p server/tsconfig.json` | 0 błędów | **0 błędów** (zero nowych) |
| Baza | niepotrzebna (kontrakt czysty, port wstrzykiwany) | bez zmian |

Commity (kolejność chronologiczna):

| SHA | Zakres |
|---|---|
| `df69ed041b` | ochrona cross-tenant w nawigatorze |
| `050090315d` | test adwersaryjny cross-tenant (8 testów) |
| `875bab0cac` | reprezentacja stanów terminalnych + blokada tworzenia |
| `c012828ba6` | testy stanów terminalnych (6 testów) |
| `d43fa66e50` | raportowanie cykli + testy (4 testy) |
| `24d0926b4b` | symetria `indirectAncestors` + testy (4 testy) |
| `9dab98df9d` | drawer + stos nawigacji / restore point (9 testów) |

Nic nie wypchnięte (`git push` niewykonany, zgodnie z poleceniem).

---

## 1. 🔴 Cross-tenant — luka najpoważniejsza

### Co było

SQL filtrował `organization_id` warstwę niżej
(`canonical/lineageService.ts`), a `LineageEdgeRow` niósł kolumnę — ale **żadna
funkcja nawigatora jej nie czytała**. `loadLineageNavigator` przyjmował
`organizationId` wyłącznie po to, żeby podać go do portu. Skutek: nawigator
renderował dokładnie to, co mu podano.

Trzy realistyczne drogi zanieczyszczenia (żadna nie przechodzi przez SQL):

1. wołający scala dwa zestawy krawędzi albo używa cache'u kluczowanego samym
   `version_id` (UUID nie niesie informacji o tenancie);
2. `LineageMetadataResolver` jest dostarczany przez wołającego i **nie ma
   żadnej typowej relacji do organizacji** — sięgnięcie po cudzą wersję było
   niewidoczne dla warstwy SQL z definicji;
3. przyszła ścieżka batch/preload pobierająca krawędzie bez predykatu.

### Co zrobiłem

- `LineageNodeMetadata` ma teraz **wymagane** pole `organizationId`.
- `organizationId` jest **wymaganym parametrem** `buildLineageTrail`,
  `buildRelatedPanel` i `computeDepths` (ta ostatnia przeszła na parametry
  nazwane i zwraca `{ depths, foreignEdgeIds, cycleVersionIds }`).
- `partitionEdgesByOrganization` odrzuca obce krawędzie **przed** jakimkolwiek
  przejściem; `createTenantScopedResolver` opakowuje resolver wołającego, więc
  obca wersja nie wejdzie ani do szlaku, ani do grupy panelu, ani do
  rodzeństwa, ani do `preselectedSource` w `+ Nowy`.
- Obcy węzeł w ognisku panelu = `null` (odmowa, nie degradacja).
- Odrzucenia są **raportowane** (`LineageTenantAnomalies`), a obce wersje są
  trzymane oddzielnie od nierozwiązanych — wyciek tenanta nie może zostać
  odczytany jako „brak danych".
- To obrona w głąb: predykat SQL pozostaje autorytatywny dla tego, co jest
  pobierane; kontrakt odmawia renderowania tego, co nie należy do organizacji,
  o którą go zapytano.

### Wynik testu adwersaryjnego

8 testów (`cross-tenant defence (adversarial)`), w tym:

- **obca krawędź skonstruowana tak, żeby WYGRAĆ tie-break rodzica** (ten sam
  typ artefaktu → ta sama ranga, ten sam typ krawędzi → ten sam priorytet,
  późniejszy `created_at` → wygrywa „najnowszy pierwszy"). Bez ochrony to ona,
  nie `bm4`, trafiłaby do szlaku;
- **resolver zwracający cudzą wersję przy czystych krawędziach** — przypadek,
  którego warstwa SQL nie widzi w ogóle;
- obce dzieci / potomkowie pośredni / `siblingVersionIds`;
- obce ognisko → panel `null`;
- `computeDepths` nie wchodzi w obcą krawędź;
- **port ignorujący swój argument `organizationId`** (realistyczna przyszła
  regresja: cache/batch, który gubi predykat).

Kontrole negatywne: czyste dane jednego tenanta → zero anomalii; ten sam graf
oglądany JAKO drugi tenant renderuje się poprawnie (reguła brzmi „zgadza się z
organizacją wołającego", nie „zgadza się z ORG").

**Dowód nie-pustości (probe):** wyłączenie filtra krawędzi → 2 testy czerwone
(szlak porwany do 2 węzłów); wyłączenie sprawdzenia w resolverze → 3 testy
czerwone. Po przywróceniu 48/48 zielone.

---

## 2. 🔴 Stany terminalne (ARCHIVED / SUPERSEDED / INVALIDATED)

`ARCHIVED` jest jednym ze statusów `BusinessVersionStatus`
(`lifecycleService.TERMINAL_STATUSES`), a węzeł zarchiwizowany **zostaje w
DAG-u na zawsze** — skasowanie krawędzi sfałszowałoby proweniencję, którą szlak
ma pokazywać. Nawigator nie miał dla niego ani plakietki, ani filtra, ani
wygaszenia.

**Realny defekt:** `allowedDownstreamCreations` patrzył wyłącznie na TYP
artefaktu, więc panel oferował „+ Nowy" z węzła ARCHIVED/INVALIDATED. Zbudowanie
wyceny na unieważnionym modelu to dokładnie ten błąd proweniencji, któremu ten
moduł ma zapobiegać — a odmowa przyszłaby dopiero jako odrzucenie zapisu w
`artifactVersionService`, po wypełnieniu formularza przez użytkownika.

Zrobione:

- plakietki `ARCHIVED` / `SUPERSEDED` / `INVALIDATED`;
  `isTerminalVersionStatus()` czyta `TERMINAL_STATUSES` **w runtime** (moduł
  `lifecycleService` jest czysty, bez DB), więc listy nie mogą się rozjechać;
- `stateBadge` + `isDimmed` na węzłach szlaku i wierszach panelu (ortogonalne do
  freshness — węzeł może być jednocześnie zamknięty i nieaktualny);
- **szlak nigdy nie ukrywa** węzła terminalnego (łańcuch z dziurą kłamie),
  tylko go wygasza; **panel** ma `terminalVisibility: 'show' | 'dim' (domyślnie)
  | 'hide'` i raportuje `hiddenTerminalCount` — filtr, który ukrywa po cichu,
  jest filtrem, który kłamie;
- `allowedDownstreamCreations(type, status)` — `status` **wymagany** (nie
  opcjonalny z domyślnym „wolno"), zwraca `[]` dla stanu terminalnego; panel
  wystawia `createNewBlockedReason` + `createNewBlockedLabel`, żeby UI
  wytłumaczył pustkę zamiast pokazać puste miejsce;
- `DOWNSTREAM_STALE` nie odpala się od potomka terminalnego — nikt nie przeliczy
  zarchiwizowanej wersji, więc to nie jest sygnał do działania.

6 testów (pozytywne i negatywne, w tym rozróżnienie `NO_DOWNSTREAM_TYPE` od
`TERMINAL_SOURCE_STATUS`). Probe: wyłączenie blokady → czerwony test „+ Nowy";
zahardkodowanie `isDimmed:false` → czerwony test dim/hide.

---

## 3. Cykl — wykrywany, ale cicho

Nawigator był cykl-BEZPIECZNY (`visited`, `depths.has`), ale cykl-NIEMY: dane z
pętlą kończyły przejście krótkim szlakiem i skurczonym panelem, bez sygnału —
ten sam wzorzec połykania, którego moduł odmawia przy `unresolvedVersionIds`.

- `detectCycleVersionIds()` — iteracyjny DFS ze zbiorem **ON-STACK**, więc
  liczą się wyłącznie prawdziwe krawędzie wsteczne. „Już widziane" byłoby złym
  testem: rombu w DAG-u (`bm4 → sc2 → val1` obok `bm4 → val1`) odwiedza węzeł
  dwa razy i jest legalny.
- `cycleVersionIds` wystawione na `LineageTrail`, `LineageDepthComputation` i
  `LineageRelatedPanel`, obok `unresolvedVersionIds`.
- **Raportowanie, nie egzekwowanie:** zakaz mieszka w bazie
  (`finance_lineage_prevent_cycle` + reguła rang w `validateEdgeRank`).
  Duplikowanie go tutaj stworzyłoby drugą definicję „legalnej krawędzi", która
  może się rozjechać z triggerem. Ta funkcja odpowiada na słabsze pytanie:
  „czy wiersze, które dostałem, zawierają pętlę?" — zasadne wobec danych, które
  nigdy nie przeszły przez `insertEdge`.

Kontrola negatywna zarobiła na siebie natychmiast: test rombu **wykrył realny
błąd** w pierwszej wersji detekcji na poziomie przejścia — raportowała korzeń
KAŻDEGO zdrowego szlaku jako cykl (wyjście z pętli po dojściu do korzenia też
zostawia bieżący węzeł w `visited`). Sprawdzenie robi się teraz na kroku, nie
na wyjściu.

4 testy (2 pozytywne, 2 negatywne — w tym obca krawędź wsteczna odrzucona przez
strażnika tenanta, żeby cudza pętla nie była raportowana jako nasza).

---

## 4. Symetria ancestors/descendants

Panel miał `indirectDescendants`, a „parents" znaczyło wyłącznie BEZPOŚREDNICH
rodziców. Ponieważ szlak celowo idzie jednym rodzicem na węzeł
(`pickPrimaryParent`), węzeł z alternatywnymi trasami w górę miał je widoczne
**wyłącznie w pełnym grafie**, który jest domyślnie wyłączony —
`hasAlternatePaths` obiecywał „jest więcej do zobaczenia", a panel nie miał
gdzie tego pokazać.

`indirectAncestors` jest lustrem `indirectDescendants`: grupowanie po typie w
kolejności etapów, realne głębokości BFS, brak powtórzeń bezpośrednich
rodziców, ten sam filtr terminalny.

Osiągalność sprawdzana jest **jawnie** wobec mapy głębokości w górę, a nie
zakładana z obecności w zestawie krawędzi: pierwsza wersja przy szerszym
wycinku grafu wylistowała POTOMKA jako pośredniego przodka (złapał to test
„nigdy nie powtarzaj bezpośredniego rodzica").

4 testy (1 negatywny).

---

## 5. Drawer „Powiązane" — model

Dane panelu były kompletne; sam drawer nie miał modelu: brak stanu otwarcia,
brak skrótu (`keyboardCommandId: null` w adapterach) i — kluczowe — brak
odpowiedzi na pytanie, co zamknięcie przywraca.

`LINEAGE_RELATED_DRAWER` deklaruje go jako **NIE-modalny** overlay: siatka
zostaje zamontowana, więc zamknięcie nie jest przemontowaniem, które gubi
filtry/scroll/zaznaczenie. `openRelatedDrawer` / `closeRelatedDrawer` oddają
wołającemu obie rzeczy, które zamknięcie musi rozstrzygnąć: co przywrócić i
który kontrolka odzyskuje fokus DOM (a11y).

**AP-10 nietknięte:** pięć adapterów ma akcję `Powiązane` z
`keyboardCommandId: null`. Proponowany identyfikator `finance.related` jest
zadeklarowany tutaj, żeby adaptery (i `KeyboardCommandRegistry`) miały jedną
uzgodnioną nazwę do przyjęcia — ale niczego im nie narzucam i nie zmieniam
żadnego wymaganego pola w typach, których używają.

---

## 6. Powrót filtrów / scrolla / zaznaczonego wiersza — decyzja projektowa

`FinanceWorkspaceState` (AP-00) jest **per artefakt** (kluczowany
`artifactRef`). Każdy skok nawigatora opuszcza ten artefakt, więc „zachowaj mój
widok, gdy wrócę" **nie może być polem w stanie opuszczanego artefaktu**: to
relacja MIĘDZY dwoma stanami i żaden z nich jej nie posiada.

Rozważone:

- **(a) Retencja per artefakt** — konieczna, ale niewystarczająca: nie ma
  pojęcia „wstecz", nie odróżnia powrotu z trzech skoków od świeżego otwarcia z
  listy, a bez porządku nie ma czego ograniczać (retencja staje się
  nieograniczonym cache'em stanu siatki na użytkownika).
- **(b) STOS NAWIGACJI nad stanami per artefakt — WYBRANE.** Niesie kolejność
  (więc „wstecz" coś znaczy), jest jawnie ograniczony
  (`LINEAGE_NAV_STACK_MAX_DEPTH = 10`, wypada najstarszy, nigdy nie odrzucamy
  najnowszego) i jest tenant-scoped jak wszystko w tym pliku.

Kluczowe ograniczenie: wpis stosu trzyma **restore point** — stan widoku
(zaznaczenie, filtry, scroll) plus tożsamość workspace'u — i **nie kopiuje
`unsavedOperationStack`**. Duplikat niezacommitowanych edycji byłby drugim,
rozjeżdżającym się źródłem prawdy o pracy w toku; ten stos należy do AP-04.
Wpis WSKAZUJE na stan workspace'u, nie przesłania go.

Restore jest fail-closed na tożsamości: `RESTORE_POINT_MISMATCH` (inny
artefakt) i `RESTORE_POINT_FOREIGN_ORG` (inny tenant). Migawki są kopiami, więc
późniejsza praca nie mutuje ich pod stosem.

**Zależność od równoległego strumienia:** restore point celowo NIE niesie
freshness. Propagacja staleness po zmianie źródła należy do
`lineageFreshnessService`; wracający wołający ma odczytać aktualność na nowo,
a nie ufać migawce.

9 testów (drawer, restore point, stos). Probe: wyłączenie obu bramek
tożsamości → czerwony test kontroli pozytywnej.

---

## 7. EVIDENCE_MISSING

Rzeczy, których ta praca **nie dowodzi** — świadomie wypisane zamiast
udawania, że kontrakt je zamyka:

1. **EVIDENCE_MISSING — brak dowodu UI dla drawera i dla powrotu stanu.**
   Nie istnieje żaden komponent Related drawer ani widok siatki finansowej,
   więc „filtry/scroll/zaznaczony wiersz wracają po powrocie" jest udowodnione
   wyłącznie jako czysta transformacja (`captureWorkspaceRestorePoint` →
   `applyWorkspaceRestorePoint`). Pełny dowód wymaga realnego ekranu i zrzutu.
2. **EVIDENCE_MISSING — brak dowodu integracyjnego cross-tenant end-to-end.**
   Udowodniona jest odmowa na poziomie kontraktu (adwersaryjnie) oraz istnienie
   predykatu SQL warstwę niżej. Nie ma testu, który przepuszcza żądanie HTTP
   użytkownika organizacji A przez realny handler i realną bazę z danymi
   organizacji B — bo nie ma jeszcze handlera nawigatora.
3. **EVIDENCE_MISSING — brak dowodu, że jakikolwiek produkcyjny caller woła te
   funkcje.** Kontrakt jest eksportowany wyłącznie przez barrel
   `workspace/index.ts`; `grep` nie pokazuje callerów w `server/src` ani `src`.
   To jest stan oczekiwany dla warstwy kontraktowej AP-09/10/11, ale nie wolno
   go mylić z „działa w produkcie".
4. **EVIDENCE_MISSING — plakietki nie były oglądane oczami.** Ich brzmienie
   (`Zarchiwizowane`, `Unieważnione`, `Ta wersja jest zamknięta…`) i severity
   są zadeklarowane w danych; kontrast, dark/light i miejsce w powłoce
   podlegają odbiorowi wzrokowemu przy pierwszym ekranie.
5. **EVIDENCE_MISSING — zachowanie przy realnym cyklu w bazie nieobserwowane.**
   Testy karmią cykl ręcznie złożonymi wierszami; trigger
   `finance_lineage_prevent_cycle` nie pozwoli takich danych wstawić, więc
   ścieżka „cykl w produkcyjnych danych" jest z definicji hipotetyczna
   (i o to chodzi — to raport anomalii, nie druga walidacja).
6. **EVIDENCE_MISSING — skrót klawiaturowy `finance.related` nie jest wpięty.**
   Zadeklarowany jako propozycja; `moduleAdapters.ts` (AP-10) i
   `KeyboardCommandRegistry` pozostają nietknięte, więc dziś nie istnieje żaden
   sposób otwarcia drawera z klawiatury.

---

## 8. Ograniczenia pracy (przestrzegane)

- Zamrożona gałąź `codex/finance-v3-closeout-fanin` @ `19b4b06934` nietknięta:
  bez merge'a, bez pusha, bez migracji, bez połączenia z żywą bazą.
- Allowlista respektowana: zmienione wyłącznie
  `lineageNavigatorContract.ts`, jego test i ten raport.
  `workspaceTestFixtures.ts` **nie wymagał zmian** (`ORG` i `artifactRef` już
  eksportowane) — nic w nim nie ruszałem, więc równoległy agent nie ma z czym
  kolidować. `workspaceBarContract.ts` / `focusModeContract.ts` /
  `moduleAdapters.ts` bez zmian.
- Runtime import `stageRank` z `canonical/lineageService.js` w pliku testowym
  zachowany (celowa kontrola krzyżowa przeciw rozjazdowi rang).
- Każda nowa reguła ma kontrolę pozytywną i negatywną; dodatkowo dla czterech
  reguł wykonano probe nie-pustości (wyłączenie strażnika → czerwony test).
