# Dokumentacja funkcjonalna — pakiety modułów

Punktem wejścia pozostaje
[`../FUNCTIONAL_DOCUMENTATION.md`](../FUNCTIONAL_DOCUMENTATION.md).

## Mapowanie istniejących kontraktów na nowy standard

Istniejące katalogi `docs/modules/NN_*` mają wspólny kontrakt:

| Nowy standard | Istniejące źródło |
| --- | --- |
| Cel i obietnica | `01_PURPOSE.md` |
| Zakres i granice | `02_SCOPE.md` |
| Mapa funkcji i przepływy | `03_BEHAVIOR.md` |
| UX i stany | `04_UI_UX.md` |
| Obiekty, dane, API i integracje | `05_DATA_AND_INTEGRATIONS.md` |
| Role, uprawnienia i bezpieczeństwo | `06_PERMISSIONS_AND_SECURITY.md` |
| Testy i dowody | `07_ACCEPTANCE_AND_TESTS.md` |
| Kod i runtime | `CODEMAP.md` + `STATUS.md` |
| TO-BE | `RAW_TARGET_STATE_2_0_PACKET.md` lub źródła z `SSOT.md` |
| GAP/NEXT | `STATUS.md`, audyty i `IMPLEMENTATION_TASK_BOARD.md` |
| Historia | `CHANGELOG.md` |

Nowy standard nie unieważnia tych pakietów. Wymaga natomiast:

- jawnego rozdzielenia AS-IS od TO-BE,
- aktualnego commitu i środowiska dla twierdzeń runtime,
- wskazania pozycji menu,
- przeniesienia podsystemów pod moduł nadrzędny,
- jednej oceny kompletności w `docs/program/DOCUMENTATION_STATUS.md`.

## Nowe kontrakty konsolidujące

- [`05_assessment/README.md`](05_assessment/README.md)
- [`10_materials/README.md`](10_materials/README.md)
- [`11_audits/README.md`](11_audits/README.md)

Te trzy dokumenty wypełniają luki powstałe między historyczną numeracją
techniczną a aktualnym menu.
