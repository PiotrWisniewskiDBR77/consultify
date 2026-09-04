# R1 — stabilizacja i mutacja sondy

Pełna nazwa przypadku:

`Idea tools — complete DOM control inventory idea-table-timeline-stuck: waits for a stable terminal control inventory`

Mutacja ekranu przez 600 ms renderowała jedną nazwaną kontrolkę, potem realny `IdeaTableTool`. Kopie obu plików trzymano w `/private/tmp/cx-day337-idee-enumeracja-scratch`.

- Stara sonda (`toBeGreaterThanOrEqual(minimumBase)`) przeszła: `DAY337_STABLE_PROBE 1`.
- Nowa sonda na tej samej mutacji poczekała: `DAY337_STABLE_PROBE 86`.
- Po przywróceniu ekranu trzy przebiegi końcowe zwróciły kolejno `86`, `86`, `86`; logi: `/private/tmp/cx-day337-idee-enumeracja-artefakty/r1-probe-final-{1,2,3}.log`.
- Pierwszy wariant samego okna stabilności (5 × 200 ms) został sfalsyfikowany: trzy przebiegi potrafiły zwrócić `1`. Nie został uznany za rozwiązanie. Dodano bezpiecznik odrzucający znaną jednokontrolkową powłokę startową.
- `git diff -- dev-render/screens/idea-table-timeline-stuck.tsx` po przywróceniu: pusty.

Minimum pozostało dodatkowym bezpiecznikiem: zapobiega zaakceptowaniu stabilnego, ale niepełnego DOM-u poniżej znanego minimum danego ekranu. Nie jest jedynym warunkiem zwolnienia.
