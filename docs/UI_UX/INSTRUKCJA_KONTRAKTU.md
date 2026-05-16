# Instrukcja kontraktu — katalog UI/UX

Cel: z surowych wymagań autora budować **jednoznaczny, audytowalny kontrakt UI/UX** dla całej aplikacji.

Ta instrukcja obowiązuje dla `DRD/consultify/docs/UI_UX/`.

## 1) Zasada pracy

- Ty przekazujesz wymagania i decyzje UX/UI.
- Ja zapisuję je w stałym formacie dokumentów `AUTHOR_CANON`.
- Każda zmiana jest rejestrowana w logu decyzji i ma kryteria akceptacji.

## 2) Klasy informacji UI/UX

Każde wymaganie klasyfikujemy do jednej z klas:

- `SHELL_NAV` (sidebar, topbar, menu, routing UX),
- `LAYOUT` (układ ekranu i stref),
- `COMPONENT` (kontrolki i patterns),
- `STATE_FEEDBACK` (empty/loading/error/toast/banner),
- `AI_UX` (agent, AI actions, trust, approvals),
- `SECURITY_TENANCY_UI` (ACL, visibility, leak prevention),
- `QUALITY_ACCEPTANCE` (checklisty i evidence).

## 3) Obowiązkowy przepływ zmiany

1. Dopisujemy surowy input do `99_RAW_INPUT.md`.
2. Decyzję zapisujemy normatywnie w pliku docelowym (`10-64`).
3. Dodajemy wpis do `04_DECISION_LOG.md`.
4. Uzupełniamy kryteria w `63_UI_UX_ACCEPTANCE_CRITERIA.md` i/lub `64_EVIDENCE_REQUIREMENTS.md`.

### 3.1 Dual-write (żeby był jeden SSOT, bez dryfu)

Jeżeli dana decyzja dotyczy wzorca, który ma swoją szczegółową dokumentację w `DRD/consultify/docs/ui-standards/`, to obowiązuje:

- **MUST**: W tym samym przebiegu uzupełnić/zmienić również właściwy plik w `docs/ui-standards/*`.
- **MUST**: Dodać/utrzymać mapowanie w `05_SOURCES_AUDIT_MAP.md` (źródło → plik AUTHOR_CANON).
- **MUST NOT**: Zostawiać nowych reguł tylko w `docs/ui-standards/*` bez wpisu w AUTHOR_CANON.

## 4) Format redakcyjny (powtarzalny)

Każdy plik UI/UX ma:

- `## Purpose`
- `## Applies To`
- `## Must`
- `## Must Not`
- `## Should`
- `## Acceptance Criteria`
- `## Exceptions`
- `## Related Sources`

Wymagania zapisujemy językiem kontraktowym, bez niejednoznacznych określeń.

## 5) Front-matter każdego pliku

```md
---
uiux_doc_id: UIUX_<AREA>
doc_kind: AUTHOR_CANON
version: 1.0
owner: user
status: canonical
last_updated: YYYY-MM-DD
---
```

## 6) Jak wrzucać wymagania (Twoja część)

W `99_RAW_INPUT.md` wpis:

```md
## 2026-05-09

### Screen / Area
<moduł + ekran lub globalny shell>

### Raw requirement
<opis swobodny>

### Why
<po co biznesowo>

### Priority
<P0/P1/P2/P3>
```

## 7) Jak ja przekształcam wymagania (moja część)

Z każdego surowego wpisu tworzę:

- normatywne `Must/Must Not/Should`,
- konkretny efekt UI (co user widzi, gdzie kliknie, co dostanie),
- kryteria akceptacji i minimalny dowód (screen/test),
- wpis decyzji do logu.

## 8) Definicja jakości dokumentu UI/UX

Dokument jest gotowy, gdy:

- jest jednoznaczny dla designu, frontendu i QA,
- nie przeczy zasadom bezpieczeństwa/tenantów,
- da się go zweryfikować checklistą,
- wskazuje wyjątki i warunki graniczne.

