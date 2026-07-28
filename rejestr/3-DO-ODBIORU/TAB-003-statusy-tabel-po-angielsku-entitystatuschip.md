---
id: TAB-003
tytul: Statusy w tabelach po angielsku przy polskim UI (EntityStatusChip humanizuje bez i18n)
typ: blad
waga: srednia
obszar: tabele
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Master, 2026-07-26, render-verify Agent Huba (statusy Planning/Executing przy lang=pl)"
utworzone: 2026-07-26
---

# TAB-003 — Statusy tabel po angielsku (EntityStatusChip)

## 1. PROBLEM

W polskim interfejsie kolumna Status w tabelach pokazuje angielskie etykiety
(„Planning", „Awaiting approval", „Failed"), choć reszta ekranu jest po
polsku. Dotyczy potencjalnie WSZYSTKICH tabel, nie jednego ekranu.

## 2. PRZYCZYNA

`src/components/ui/primitives/chips/EntityStatusChip.tsx` — kanoniczny most
status→pigułka (TABLE_AND_PREVIEW_CANON.md §4.1) „humanizuje" surowy status
mechanicznie (underscore→spacja, wielka litera — funkcja `humanize`), bez
tłumaczenia. Komponent MA prop `label` (override), ale wielu callerów go nie
przekazuje. Przykład potwierdzony: `AgentHubShell.tsx` kolumna Status
(`<EntityStatusChip status={plan.status} />`), podczas gdy preview tego samego
ekranu używa przetłumaczonej `planStatusLabel` — stąd mieszany język.

## 3. ROZWIĄZANIE

Wariant rekomendowany: centralny słownik i18n w samym `EntityStatusChip`
(klucze `status.<normalized>` w translation.json, fallback = dzisiejsza
humanizacja) — jedna zmiana naprawia wszystkie tabele i nie wymaga ruszania
callerów. Wariant ostrożny: inwentarz callerów i per-caller `label`.
Decyzja wariantu = pierwsza czynność wykonawcy, z dowodem liczby callerów.

## 4. KRYTERIUM ODBIORU

Piotr przełącza UI na polski i otwiera 3 różne tabele (np. Run agent,
Zadania, Assessment) — wszystkie statusy w pigułkach są po polsku; po
przełączeniu na angielski — po angielsku.

## 5. DOWODY

**Wariant wybrany: A (centralny słownik w komponencie).** Dowód liczbowy:
`git grep -n "EntityStatusChip" -- src/ | wc -l` → **110 wywołań w 37
plikach** (`git grep -l`). Przy takiej skali per-caller `label` (wariant B)
byłby rozproszony i niemożliwy do spójnie zweryfikowania — wariant A
naprawia wszystkie tabele jedną zmianą pliku.

**Commit:** `dec135e749`, gałąź `fix/tab003-statusy-i18n` (worktree
`/private/tmp/wt-tab003`), baza `origin/demo` (`9ad7bbd954`). Nie pushnięte.
Zmienione pliki (`git show --stat` potwierdza zero rozlewu):
- `src/components/ui/primitives/chips/EntityStatusChip.tsx`
- `public/locales/pl/translation.json`
- `public/locales/en/translation.json`
- `tests/components/ui/primitives/chips/EntityStatusChip.test.tsx` (nowy, `git add -f`)

**Klucz i18n: `statusChip.<znormalizowany>`, NIE `status.*`.** Odkryto, że
`status.*` już istnieje w translation.json i jest używany przez
`InitiativeDetailModal.tsx` z odmianami rodzaju żeńskiego zgodnymi z
"Inicjatywa" (`status.APPROVED` = „Zatwierdzona", `status.DONE` =
„Zakończona"). Reużycie tego klucza dla generycznej pigułki tabelowej
(dokumenty, zadania, transakcje partnerskie…) dawałoby gramatycznie błędne
formy przy innych rzeczownikach. Dedykowany `statusChip.*` unika kolizji.

**Inwentarz statusów — 57 kluczy w PL+EN** (`public/locales/{pl,en}/translation.json`,
klucze identyczne w obu plikach — zweryfikowane skryptem):
- 44 klucze = pełne pokrycie istniejącej mapy `TONE_BY_STATUS` (już w kodzie,
  tylko brakowało tłumaczenia): in_progress, draft, open, generating,
  generated, planning, new, scheduled, executing, promoted, proposed,
  submitted, pending, pending_review, pending_approval, awaiting_approval,
  in_review, review, escalated, on_hold, paused, approved, accepted,
  completed, done, published, ready, active, utilized, tracking, sent_back,
  rejected, failed, blocked, cancelled, overdue, archived, trashed, final,
  inactive, assigned, not_started, todo, unknown.
- 13 kluczy DODATKOWYCH, znalezionych realnie u callerów bez `label`
  (nie w oryginalnej mapie): `processing`, `uploaded`, `ocr_required`,
  `unreadable`, `deleted` (DocumentStatus — AdminKnowledgeView.tsx doc.status),
  `editing`, `shared` (Deck.status — DeckBuilder.tsx:1261), `success`, `error`
  (LLM logs — AdminLLMView.tsx log.status), `trial` (OrganizationStatus —
  PartnerPortalView.tsx org.status), `invited`, `removed` (OrganizationMemberStatus
  — AdminMembersRolesPanel.tsx), `suspended` (UserStatus/OrganizationStatus —
  BulkOperationsView.tsx, PartnerPortalView.tsx).

**Domeny sprawdzone, bez kolizji znaczeniowej:** `ready` występuje tylko w
jednej domenie dotkniętej brakiem `label` (DocumentStatus — dokumenty
wiedzy) i w Deck.status — oba znaczą "gotowe/ukończone", nie ma konfliktu
semantycznego wymagającego osobnego `domain` propa. Statusy inicjatyw
(DRAFT/PLANNING/REVIEW/APPROVED/EXECUTING/DONE/ARCHIVED/CANCELLED,
`TaskDetailModal.tsx:145`) pokrywają się 1:1 z istniejącymi kluczami
`TONE_BY_STATUS` po normalizacji do lowercase — bez kolizji z osobnym
gramatycznym słownikiem `status.*` (różne przestrzenie kluczy).

**Fallback:** zachowany bez zmian — `label ?? (translated || humanize(status))`.
Nieznany status nigdy nie pokazuje surowego klucza i18n ani pustego stringa.

**Bramki (wyniki dosłowne):**
- `npx esbuild ... --bundle --outfile=/dev/null --format=esm --external:react --external:react-i18next`
  → `⚡ Done in 45ms` (0 błędów; flaga `--loader:tsx` z instrukcji nie działa
  na pliku z rozszerzeniem `.tsx` — esbuild wykrywa loader z rozszerzenia
  automatycznie, użyto `--bundle` zamiast).
- `npx eslint --fix src/components/ui/primitives/chips/EntityStatusChip.tsx`
  → `1 problem (0 errors, 1 warning)` — ostrzeżenie `react-refresh/only-export-components`
  na eksporcie `statusChipTone`, PRE-ISTNIEJĄCE (ten sam eksport był w pliku
  przed zmianą), nie regresja.
- `bash scripts/check-list-canon.sh` → `✓ check-list-canon: brak NOWYCH
  naruszeń kanonu tabel (staged: 1 plików; naruszeń 0, baseline 0 — dług nie rośnie)`
- `bash scripts/check-triada.sh` → `✓ check-triada: brak nowych naruszeń
  crimson (sprawdzono plików: 1)`
- (dodatkowo z pre-commit) `check-artefakt.sh` → `✓ brak nowych naruszeń
  crimson w powłoce artefaktów (7, baseline 7)`; `check-gestosc.sh` →
  `✓ brak regresji mechanicznych`.
- Test jednostkowy punktowy: `npx vitest run tests/components/ui/primitives/chips/EntityStatusChip.test.tsx`
  → **5 passed (5)**: znany status → tłumaczenie PL; status z podkreśleniem
  (`AWAITING_APPROVAL`) → klucz znormalizowany; nieznany status → fallback
  humanizacji (nie surowy klucz); `label` override wygrywa nad słownikiem;
  `status={null}` nie crashuje.
- Pełny `tsc`/`vitest` NIE uruchamiane (reguła higieny — OOM).

**Weryfikacja wzrokiem (harness `dev-render`, worktree, port 3478) — 2 realne
callery BEZ `label` (a więc faktycznie dotknięte przed fixem) + 1 już
naprawiony wcześniej caller jako kontrola regresji:**

1. `?screen=audyty-drd-report&lang=pl&theme=light` — zakładka "Raporty DRD"
   w `AuditsHub` (`AuditsHub.tsx:674`, `status={row.status}`, bez `label`).
   WIDAĆ: pigułki „Finalne" i „Szkic" w kolumnie Status, po polsku,
   kolory info/neutral zachowane, zero crimson.
   Po `&lang=en`: te same wiersze pokazują „Final" / „Draft".
2. `?screen=deck-artifact&lang=pl&theme=light` — pasek nagłówka `DeckBuilder`
   (`DeckBuilder.tsx:1261`, `status={deck.status || 'draft'}`, bez `label`).
   WIDAĆ: pigułka statusu w prawym górnym rogu pokazuje „Gotowe" (deck.status='ready').
   Po `&lang=en`: ta sama pigułka pokazuje „Ready".
3. `?screen=agent-hub&lang=pl&theme=dark` (kontrola regresji — ten caller
   JUŻ miał `label={planStatusLabel(...)}` z wcześniejszej fali AGT-013,
   poza zakresem centralnego fixu). WIDAĆ: „Planowanie", „Zaplanowany",
   „W toku", „Czeka na akce…", „Zakończony", „Nieudany" — poprawnie po
   polsku w dark mode, bez regresji, kolory pigułek OK.

**Czego NIE zweryfikowałem:**
- Nie znalazłem w `dev-render/screens/` harnessu montującego bezpośrednio
  pozostałe no-label callery: `AdminMembersRolesPanel.tsx`,
  `InitiativeObservabilityPanel.tsx`, `ReportsHub.tsx`, `TaskDetailModal.tsx`,
  `FilterableTable.tsx` (generyczny, wielu odbiorców), `AdminLLMView.tsx`,
  `ClientAccessView.tsx`, `PartnerPortalView.tsx`, `EarningsSection.tsx`,
  `AdminKnowledgeView.tsx`, `BulkOperationsView.tsx`. Fix jest scentralizowany
  w jednym pliku (nie per-caller), więc mechanizm jest identyczny co w
  zweryfikowanych 2 przypadkach — ale te konkretne ekrany nie zostały
  obejrzane wzrokiem. Rekomendacja: jeśli Piotr chce zobaczyć akurat jeden
  z nich, dopisać dev-render harness dla tego ekranu w osobnym kroku.
- Nie przemapowałem KAŻDEGO istniejącego typu `*Status` w `src/types/`
  (dziesiątki unii w całej appce — RAID, Gate, Decision, Invoice, Seat,
  Notebook, Canvas…) — tylko statusy realnie przechodzące przez
  `EntityStatusChip` bez `label`, potwierdzone grepem 37 plików callerów.
  Jeśli jakiś inny ekran zacznie używać `EntityStatusChip` bez `label` z
  nowym surowym statusem spoza tych 57 kluczy — fallback humanizacji go
  pokaże po angielsku (bezpiecznie, ale nieprzetłumaczone) do czasu dopisania
  klucza.
- Nie testowałem RTL (`ar`) ani pozostałych języków (`de`/`es`/`jp`) —
  klucz `statusChip.*` dodany tylko do `pl` i `en` (jedyne dwa języki, które
  Piotr wymaga w kryterium odbioru; pozostałe języki i tak fallbackują do
  `en` w łańcuchu `fallbackLng` z `src/i18n.ts`).
- ★ ZERO crimson: nie zmieniałem żadnego koloru pigułek — `StatusChip.tsx`
  (paleta tonów) nietknięty, bramki `check-triada`/`check-artefakt`
  potwierdzają brak nowych naruszeń.

**Pliki NIE ruszone (zgodnie z zakazem równoległej sesji):**
`AgentHubShell.tsx`, `MyWorkHub.tsx`, `HubBarSlots.tsx`, `VaultDocumentsView.tsx`
— żaden nie wymagał zmiany, bo wariant A naprawia ich callery bez edycji
(potwierdzone wzrokiem w pkt 3 dla AgentHubShell — działa bez dotykania pliku).

## 6. DZIENNIK

- 2026-07-26 — Master: znalezisko z render-verify po scaleniu triady
  (Agent Hub, lang=pl, statusy EN). Doraźnie naprawiony JEDEN caller
  (AgentHubShell, w ramach fali AGT-013). Reszta callerów = to zadanie.
- 2026-07-28, wykonawca — wzięte do pracy w worktree `/private/tmp/wt-tab003`
  (gałąź `fix/tab003-statusy-i18n` z `origin/demo`). Policzono callerów
  (110/37 plików) → wariant A. Zbudowano inwentarz statusów z realnych
  typów (`DocumentStatus`, `Deck.status`, `OrganizationMemberStatus`,
  `OrganizationStatus`, `UserStatus`, LLM log status) + istniejącej mapy
  `TONE_BY_STATUS`. Dodano `statusChip.*` (57 kluczy) do PL+EN, komponent
  tłumaczy z fallbackiem, napisano test jednostkowy (5/5 zielono), bramki
  kanonu przeszły, weryfikacja wzrokiem na 2 realnych no-label callerach +
  1 kontrola regresji. Commit `dec135e749`. `1-OTWARTE` → `3-DO-ODBIORU`.
