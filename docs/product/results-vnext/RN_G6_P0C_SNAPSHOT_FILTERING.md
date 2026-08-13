# P0-C — filtrowanie migawki przeglądu KPI pod czytelnika (zamknięte)

> Zamyka `docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md` §OQ-UI-B.
> Implementacja: gałąź `rn-g6-p0c`, HEAD bazowy `f373fa66a5`.

## 1. Diagnoza (stan PRZED)

`server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts` ma pięć
funkcji odczytu. Dwie z nich zwracają `snapshot_payload` (fakty pozycji KPI +
`statusCounts`) klientowi:

| Funkcja | Zwraca payload? | Filtrowała pod AKTUALNEGO czytelnika? (PRZED) |
|---|---|---|
| `listScorecards` | nie | — |
| `listScorecardItems` | nie (zwraca tylko wiersze `rvn_kpi_scorecard_items`) | n/d — ale sam JOIN filtruje pod `resourceType:'kpi'`, więc lista pozycji już jest poprawna |
| `getScorecardStatusDistribution` | nie (agregat) | n/d — filtr PRZED agregacją, poprawne |
| `getPublishedSnapshot` | **tak** | **TAK** (decyzja #6b, `visibleKpiIds` liczone na żywo, payload przycinany, `statusCounts` przeliczane) |
| `listReviewSnapshots` | **tak** | **NIE** — zwracała `snapshot_payload` dokładnie taki, jak zapisany w wierszu (payload publikującego z chwili publikacji, decyzja #6a), bez drugiego przebiegu pod bieżącego czytelnika |

`listReviewSnapshots` jest wystawiona pod `GET
/api/vnext/results/kpi/scorecards/:scorecardId/review-snapshots`
(`server/src/routes/resultsVnext/kpiScorecard.routes.ts`) i zwraca każdy
wiersz historii (włącznie z `published`/`superseded`) z pełnym,
niefiltrowanym payloadem w odpowiedzi HTTP. Czytelnik, który:
- nigdy nie miał dostępu do jednego z KPI w migawce, albo
- **utracił dostęp PO publikacji** (odwołanie ACL / zmiana widoczności KPI),

nadal widziałby jego zamrożone wartości w JSON-ie tej trasy — mimo że
`getPublishedSnapshot` (`.../review-snapshots/published`) poprawnie go ukrywa.
Jedyny powód, dla którego to nie wyciekało na ekran: `kpiScorecardPresenters.tsx`
świadomie NIGDY nie renderuje `snapshotPayload` (udokumentowane w jej własnym
nagłówku jako obejście, nie naprawa). To jest ochrona WARSTWY UI, nie API —
każdy inny konsument (network tab, przyszły ekran, Teresa, eksport) dostawał
surowe dane.

## 2. Decyzja architektoniczna (realizowana)

1. Zapisany `snapshot_payload` pozostaje niezmienny — artefakt audytowy,
   `content_hash` nigdy się nie zmienia.
2. Każdy odczyt zwracający payload czytelnikowi jest filtrowany pod jego
   **aktualną** widoczność, liczoną w momencie odczytu.
3. Metadane (liczniki `statusCounts`) są przeliczane WYŁĄCZNIE z
   przefiltrowanego zbioru — licznik nigdy nie zdradza istnienia ukrytych
   pozycji.
4. UI nadal nie renderuje surowego payloadu (defense-in-depth, świadomie
   zachowane) — ale teraz jest to DODATKOWA warstwa nad już bezpieczną
   odpowiedzią API, nie jedyna linia obrony.

## 3. Mechanizm (stan PO)

Jeden, współdzielony mechanizm redakcji w `kpiScorecardRepository.ts`:

- `resolveVisibleKpiIdSet(client, {userId, organizationId})` — liczy zbiór
  `kpi_id` widocznych DLA TEGO czytelnika TERAZ (ten sam
  `buildVisibilityScopedCte`/`resourceType:'kpi'`, którego `getPublishedSnapshot`
  już używał).
- `redactSnapshotPayloadForReader(row, visibleKpiIds)` — przycina
  `snapshot_payload.items` do widocznego zbioru, przelicza `statusCounts` z
  przyciętego zbioru, nigdy nie dotyka `row.content_hash`.

`getPublishedSnapshot` i `listReviewSnapshots` wołają TE SAME dwie funkcje —
nie ma już dwóch rozbieżnych implementacji filtra. `listReviewSnapshots`
liczy `visibleKpiIds` **raz na całe wywołanie** (nie per wiersz) i pomija
całą ścieżkę, gdy żaden zwrócony wiersz nie ma payloadu (wiersze `draft`
zawsze mają `snapshot_payload = NULL`).

## 4. Dowód

- Testy realDB (Postgres 17, ścieżka publiczna — funkcje repozytorium
  wołane identycznie jak przez trasy HTTP):
  `tests/resultsVnext/kpi/kpiScorecardListSnapshotsNonLeak.realdb.test.ts`
  — role: publikujący / menedżer (via `MANAGEMENT_CHAIN`) / zwykły czytelnik
  z częściowym dostępem / czytelnik który utracił dostęp PO publikacji /
  obcy z organizacji (widzi tylko to, co OPEN_ORG) / aktor z innej
  organizacji (fail-closed, 0 wierszy) / scenariusz w pełni prywatnej karty
  (obcy nie dostaje ŻADNEGO wiersza — nie dowiaduje się, że obiekt istnieje).
  `content_hash` zweryfikowany jako bajtowo identyczny przed/po każdym z
  powyższych odczytów.
- Testy siostrzane bez regresji: `scorecardPublishNonLeak.realdb.test.ts`,
  `kpiScorecardRepositoryRoutesRealdb.test.ts`,
  `kpiScorecardD07NonLeak.test.ts`, `kpiScorecard.routes.test.ts`.
- Kontrola negatywna ×3 (zepsuj → czerwień → cofnij → zieleń) — patrz raport
  sesji; **znaleziona warstwowość**: zepsucie WYŁĄCZNIE wywołania redakcji w
  `listReviewSnapshots` (NC2) czerwieni TYLKO nowy test P0-C — pozostałe 6
  testów (w tym non-leak `getPublishedSnapshot`) zostaje zielonych, bo
  testują inną funkcję / inną warstwę (bramka na poziomie karty wyników,
  nie na poziomie pozycji). To dowodzi, że nowy test jest jedynym testem w
  repo, który faktycznie łapał pierwotny błąd OQ-UI-B.
- Dowód UI (harness `dev-render`, komponent produkcyjny
  `ResultsKpiScorecardDetailPage`, `?screen=results-vnext-kpi-scorecards`):
  `docs/qa/screens/rn-g6-p0c/` — zakładka „Pozycje” traci chronioną pozycję
  KPI po `&access=revoked` (zrzut PO przeładowaniu, nie sam render), a
  podgląd migawki „Opublikowana” (zrzut PO kliknięciu wiersza) pokazuje
  wyłącznie metadane — identyczne w obu stanach dostępu, z tym samym
  `content_hash`.

## 5. Czego to NIE dowodzi

- Nie jest to dowód na poprawność samego mechanizmu widoczności
  (`buildVisibilityScopedCte`/`visibilityResolver.ts`) — ten mechanizm był
  już przetestowany gdzie indziej (KPI-E003/E004); P0-C dowodzi wyłącznie,
  że payload migawki go RESPEKTUJE na każdej ścieżce odczytu.
  Ten test nie uruchamia realnej trasy HTTP `kpiScorecard.routes.ts`
  (podobnie jak siostrzane pliki w tym pakiecie) — woła bezpośrednio te same
  funkcje repozytorium, które trasa woła 1:1 (żadnej logiki pośredniej w
  handlerze poza walidacją/rozpakowaniem `req`).
- Nie testuje SCOPE/RESTRICTED_ACL z grantami zespołowymi/rolowymi
  (`grantee_type IN ('team','role')`) — `visibilityScopedQuery.ts` sam
  dokumentuje to jako `NOT_IMPLEMENTED`, poza zakresem P0-C.
- Zrzuty UI nie dowodzą, że ŻADEN przyszły komponent nie zacznie renderować
  `snapshotPayload` — to pilnuje wyłącznie dyscypliny kodu
  (`kpiScorecardPresenters.tsx` header) + review, nie automat.
