# K2 v2 — manifest importerów i delty

## Werdykt

Bieżący, odtwarzalny przebieg v2 ma wynik **100/101 GREEN**. Jedyny RED pochodzi z `tests/integration/routes/settings-admin-superadmin.p31-33.test.ts:484` i jest byte-identyczny z bazą zarówno po stronie testu, jak i badanego źródła.

Historyczne `175/176` z pierwszego freeze nie miało zachowanego surowego logu ani listy plików. Nie przedstawiam tego mianownika ponownie jako dowodu. Zastępuje go poniższy, trwały przebieg v2 z dokładną listą siedmiu plików i pełnym logiem.

## Dokładne wejście v2

Lista: `evidence/k2-superadmin-i18n-20260915/importer-delta-files-v2.txt`.

```text
src/views/superadmin/__tests__/superadminI18nDebt.w73.test.ts
src/views/superadmin/__tests__/OrganizationsView.deleteApprovedOut.test.tsx
src/views/superadmin/__tests__/PlatformOperationsView.i18n.day15.test.tsx
src/views/superadmin/__tests__/PlatformOperationsView.day15.test.tsx
src/views/superadmin/__tests__/PlatformOperationsView.test.tsx
src/views/superadmin/__tests__/SystemModule.platformOperations.test.ts
tests/integration/routes/settings-admin-superadmin.p31-33.test.ts
```

Dokładna komenda:

```sh
NODE_OPTIONS=--max-old-space-size=8192 perl -e 'alarm shift; exec @ARGV' 120 \
  npx vitest run $(cat evidence/k2-superadmin-i18n-20260915/importer-delta-files-v2.txt) \
  --retry=0 --reporter=verbose
```

Pełny stdout/stderr: `evidence/k2-superadmin-i18n-20260915/importer-delta-v2.log`.

Wynik: 7 plików testowych, 101 testów, 100 GREEN, 1 RED, RC 1.

## Dowód zastanego RED

| Plik | blob na bazie `f2628a0d36` | blob na K2 v2 |
|---|---|---|
| `tests/integration/routes/settings-admin-superadmin.p31-33.test.ts` | `adb180d1e726ec3f8a53daa8f8c17c54819cb380` | `adb180d1e726ec3f8a53daa8f8c17c54819cb380` |
| `src/components/Admin/adminNavigation.ts` | `fdaced1f365acc0289f9df18188ab1d0de56e590` | `fdaced1f365acc0289f9df18188ab1d0de56e590` |

Asercja oczekuje jednoliniowego fragmentu `c('platform-operations'`, natomiast niezmienione źródło zapisuje to wywołanie wieloliniowo. K2 nie dotyka żadnego z tych plików.
