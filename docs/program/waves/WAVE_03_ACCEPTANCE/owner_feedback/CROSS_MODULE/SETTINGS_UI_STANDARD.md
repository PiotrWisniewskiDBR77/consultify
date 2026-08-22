# XMOD-OWN-001 — Settings-derived UI standard for Organization and Admin

Date: `2026-08-21`

Status: `PROPOSED_UNRECONCILED`

Applies to: `Organization`, `Admin`

## Piotr's original wording

> Dobrze, a teraz przerób całe notatki na temat dwóch poprzednich dużych modułów, czyli organizacji i panelu administratora. Ustaw grafiki i cały przepływ tak, jak jest to zrobione w ustawieniach: lewe menu, które moduły otwierają podmoduły, podmoduły mają ekrany – tak jak mamy to tutaj zrobione. To jest dobry standard. Kolorystyka, czcionki i wszystkie elementy we wszystkich zakładkach powinny doprowadzić do tego standardu.
>
> Opisz to bardzo precyzyjnie.

## 1. Canonical hierarchy

Both domains use exactly three levels:

1. application-level navigation selects `Organization`, `Admin` or `Settings`;
2. a fixed left domain menu shows expandable modules;
3. expanding a module reveals its screen-level submodules.

The main content renders exactly one selected screen. A content card, accordion
or horizontal tab must not recreate the left-menu hierarchy.

## 2. Left domain menu

Follow the visible Settings pattern:

- fixed-width column separated from content by a subtle vertical border;
- domain title in the upper-left (`ORGANIZACJA` or `PANEL ADMINISTRATORA`);
- one-line domain description beneath the title;
- uppercase, muted module labels;
- chevron on expandable modules;
- expanded module has a clear outlined container;
- child screens are indented, carry a small icon and use one-row labels;
- active child uses the same filled accent treatment as the selected Settings
  screen;
- disabled or future screens use an explicit badge and remain visually
  distinct from available screens;
- the bottom contains one consistent return action, not duplicate module links.

The menu does not contain administrative functions inside Organization or
Organization functions inside Admin.

## 3. Content header and breadcrumb

Every screen starts with the same shallow top row:

- uppercase domain breadcrumb;
- chevron;
- active screen name;
- no competing second page title in a detached card.

Below it, the content column begins at a consistent horizontal position and
uses the same maximum width, spacing and top offset as Settings.

## 4. Section-card anatomy

Use the Settings card pattern:

- dark surface one elevation above the page background;
- thin neutral border;
- consistent corner radius;
- section icon and title in the first row;
- optional one-sentence description immediately below;
- settings/fields separated by subtle horizontal dividers;
- label and help text aligned left;
- control aligned right on desktop;
- dependent controls indented below their parent;
- no card inside card unless it represents a real nested object or decision.

Business dashboards may use summary cards, but form/configuration screens must
retain the same rhythm and control alignment.

## 5. Typography

Reuse Settings typography tokens, not screen-specific inventions:

- domain title: strongest sidebar heading;
- module labels: small uppercase muted text;
- screen breadcrumb: compact semibold text;
- section title: semibold with icon;
- field label: medium/semibold;
- help text: smaller muted text;
- values and buttons: standard application body/control size.

English and Polish content must not change font scale, weight or spacing.

## 6. Color and state language

Reuse the same semantic tokens shown in Settings:

- page background and card surface;
- neutral border and divider;
- primary/selected navigation accent;
- secondary active-child fill;
- muted text;
- positive, warning, error and informational states.

Do not invent per-module palettes. Accent colors may identify section icons,
but selection, focus, success, warning, destructive action and disabled states
must remain identical across Settings, Organization and Admin. Red is reserved
for errors/destructive states, not ordinary selection.

## 7. Controls

- Toggle: same size, position and on/off language as Settings.
- Select: same height, border, chevron and disabled state.
- Segmented control: only for mutually exclusive choices.
- Checkbox: only for independent multi-selection.
- Text input/textarea: label and help text above; validation below.
- Primary button: one dominant action per screen/section.
- Secondary and destructive actions: visually subordinate and explicitly
  separated.
- Editable screens use the explicit `Save Changes` header action required by
  `XMOD-OWN-005`. Background draft protection is supplementary and must not
  impersonate a committed save. A long page never hides its only save action at
  the bottom.

## 8. Required screen states

Every screen supports:

- `LOADING`: skeleton matching final geometry;
- `EMPTY`: purpose, reason and one starting CTA;
- `PARTIAL`: available information plus named missing subset;
- `READY/FULL`: management summary before detail;
- `CONFLICT`: competing values and decision owner;
- `STALE`: timestamp and refresh action;
- `ERROR`: preserved work, business impact, retry and technical detail on
  demand;
- `UNAUTHORIZED`: required role without revealing protected data.

## 9. Responsive transformation

- Desktop: visible domain menu and aligned right-side controls.
- Tablet: domain menu becomes a drawer; cards remain one/two columns by task.
- Mobile: one column, module/screen selector in header, controls below labels,
  record tables rendered as cards and sticky primary action where necessary.
- Basic work must never require horizontal scrolling.

## 10. Application to Organization

Organization menu modules:

1. `Profil organizacji`
   - Tożsamość i skala
   - Model działania
   - Pozycja i kierunek
   - Technologia, kultura i ograniczenia
2. `Cele i oczekiwania`
   - Intencja strategiczna
   - Mierniki sukcesu
   - Zakres i granice
   - Oczekiwania interesariuszy
3. `Wyzwania`
   - Zadeklarowane wyzwania
   - Przyczyny źródłowe
   - Blockery celów
   - Dowody
4. `Synteza strategiczna`
   - Ryzyka i szanse
   - Scenariusze
   - Rekomendacja
   - Executive brief
5. `Źródła i wiedza`
   - Pliki
   - Twierdzenia i źródła
   - Konflikty źródeł
   - Graf wiedzy
6. `Gotowość i governance`
   - Podsumowanie
   - Braki i aktualność
   - Decyzje i konflikty
   - Wersje i publikacja

`Megatrendy` and `Administracja` do not appear in this menu.

## 11. Application to Admin

Admin retains seven task domains, each expanded into screens:

1. `Zespół i dostęp`
2. `Rozliczenia i plany`
3. `Sterowanie AI`
4. `Bezpieczeństwo i tożsamość`
5. `Dziennik audytu`
6. `Centrum administracyjne`
7. `Stan systemu`

The full screen map is defined in
[`../14_ADMIN/ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md`](../14_ADMIN/ADM-OWN-001_SEVEN_TASK_BLUEPRINT.md).

## Acceptance boundary

The Settings screenshot defines the intended visual/navigation standard. It
does not prove that Organization or Admin functions are connected. Functional
readiness still requires UI action, permission enforcement, API/database or
provider readback, error-state evidence and owner review.
