# Rejestr ResultsHub — co żywe, co martwe (pomiar 2026-09-02)

**Gałąź pomiaru:** `agent/resultshub-inwentarz-20260902` · **marker bazowy:** `6fe16e2bd4`
**Charakter dokumentu:** POMIAR. Nie usunięto ani jednej linii kodu. Decyzję o cięciu podejmuje właściciel.

---

## K1 — Teza o nieosiągalności: POTWIERDZONA

Teza brzmiała: `src/components/Results/ResultsHub.tsx` jest nieosiągalny z żadnej trasy od
commita `8df1cd413d` (2026-08-24). Zweryfikowano cztery niezależne dowody.

### D1. Commit istnieje i ma podaną datę
```
8df1cd413da8edd56f0e2deec8b3c3a5395372df  2026-08-24 05:19:02 +0200
fix(results): retire legacy root fallback
```
Data i treść zgadzają się z tezą.

### D2. Trasa `/results` przekierowuje BEZWARUNKOWO
`src/components/Results/ResultsOwnerReviewEntry.tsx` w całości (13 linii) sprowadza się do:
```tsx
export function ResultsOwnerReviewEntry() {
  return <Navigate to={ROUTES.RESULTS_KPI.ROOT} replace />;
}
```
Zero warunków, zero flag, zero odczytu `localStorage` czy query-param — mimo nazwy
sugerującej „owner review switch". Cel: `/results/kpi` → `AppRoutes.tsx:2968`
montuje `<ResultsKpiRegistryPage />` z `@/components/ResultsVNext/`.

### D3. Zero wołaczy JSX w kodzie produkcyjnym
`grep -rn "<ResultsHub" src/` zwraca **wyłącznie 5 trafień w pliku testowym**
`src/components/Results/__tests__/ResultsHub.smoke.test.tsx`. Ani jednego w `src/routes/`,
ani jednego w żadnym komponencie.

Jedyny nie-testowy odnośnik to reeksport w barrelu
`src/components/Results/index.ts:2` — a tego barrelu **nikt nie importuje**
(`grep` po `from '@/components/Results'` = zero trafień). Barrel jest ślepy.

### D4. Istnieje bezpiecznik CI, który MONTOWANIE ResultsHub uznaje za defekt
`scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs` ma test o nazwie
*„rejects ResultsHub inside the canonical Results route block"* — czyli produkt ma już
mechaniczną bramkę pilnującą, żeby ResultsHub **nie wrócił** na trasę kanoniczną.
Dodatkowo `tests/resultsVnext/flagGateEnumeration.test.ts:95` asertuje
`expect(routes).not.toContain('<ResultsHub')`.

**Wniosek K1:** teza prawdziwa i mocniejsza, niż ją sformułowano. To nie jest przeoczenie —
to świadome, zabezpieczone testami wygaszenie. Rejestr można budować dalej.

### Sprostowanie do treści zlecenia
Zlecenie wymieniało `RecoveryCardPanel` (83 KB) wśród komponentów montowanych przez
`ResultsHub`. **To nieprawda.** `ResultsHub.tsx` nie importuje `RecoveryCardPanel`.
Jedynym jego wołaczem jest `KPITimeSeriesDrawer.tsx:35` (render w linii 1534).
RecoveryCardPanel jest więc **wnukiem**, nie dzieckiem — co ma znaczenie dla cięcia:
zniknie razem z KPITimeSeriesDrawer albo wcale.

### Zweryfikowane liczby z nagłówka zlecenia
| Twierdzenie zlecenia | Pomiar | Werdykt |
|---|---|---|
| `ResultsHub` montuje kilka tysięcy linii | 2228 linii samego huba (84 233 B) + drzewo dzieci | zaniżone, patrz K3 |
| `KPITimeSeriesDrawer` 104 KB | 104 463 B | zgadza się |
| `RecoveryCardPanel` 83 KB | 82 750 B | rozmiar zgadza się, ale to nie dziecko ResultsHub |
| commit `8df1cd413d` z 2026-08-24 | 2026-08-24 05:19:02 | zgadza się |
