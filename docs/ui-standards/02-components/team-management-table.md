# Team Management Table (N‑mode) — Standard

> **Status:** PROPOSED (do adopcji jako standard)  
> **Ostatnia aktualizacja:** 2026-02-15  
> **Referencyjna implementacja (source of truth):**
>
> - `src/components/assessment/manage/TeamManagementPanel.tsx` (komponent)
> - `src/components/Initiatives/sections/InitiativeTeamSection.tsx` (użycie w Initiative → Team)

## Cel

Standaryzujemy tabelę do prezentacji i edycji zespołu pracującego nad artefaktem (w tym przypadku: **inicjatywą**).

Tabela ma odpowiadać na pytania:

- kto pracuje nad inicjatywą,
- jaka jest rola i uprawnienia,
- czy osoba jest **z organizacji** czy **zewnętrzna** (partner/konsultant).

## Zasady DBR77 (MUST)

- **Quiet container**: tabela jest osadzona w spokojnym cardzie (navy + subtle dividers).
- **Monochromatic chrome**: kolor w tabeli jest semantyczny (badge roli / statusu), reszta neutralna.
- **Hover = tło**: wiersz hoveruje zmianą `bg`, nie borderem.
- **No heavy frames**: cienkie dividers zamiast ciężkich ramek.

## Kiedy używać

- Sekcje typu **Team / Zarządzanie zespołem** w N‑mode (np. Initiative → Team).
- Ekrany „management” (Assessment → Team) — ten sam komponent, inny tryb.

## API / Dane

### Minimalny model danych (dla Initiative)

W trybie inicjatywy tabela operuje na liście członków:

- `userName`, `userEmail`
- `role` (panelowa: `admin|manager|editor|viewer` — do czasu podłączenia docelowego modelu)
- `permissions` (wyliczane z roli)
- `isExternal` + opcjonalnie `externalType`, `externalOrgName` do rozróżnienia **in‑org** vs **external**

### Kolumna „Organization” (INITIATIVE)

W trybie inicjatywy (`assessmentType="INITIATIVE"`) kolumna 4. w tabeli jest:

- **Organization** zamiast **Areas**
- wartości:
  - **In org** — osoba należy do organizacji
  - **Outside org** — osoba z zewnętrznej firmy (opcjonalnie tag Partner/Consultant + nazwa)

## i18n (MUST)

Docelowo copy w nagłówkach i badge’ach powinien być PL/EN. Jeśli komponent jest używany poza obszarem Assessment — należy zapewnić tłumaczenia w kontekście miejsca użycia.

## Checklist

- [ ] Tabela użyta jako standard w Initiative → Team
- [ ] Kolumna 4: Organization (In org / Outside org)
- [ ] Zewnętrzni: opcjonalny typ (Partner/Consultant) + nazwa firmy
- [ ] Hover / spacing zgodne z DBR77
