# Consultify — przewodnik odzysku historycznej pracy

Data bazowa: 2026-08-03
Kanoniczny punkt odniesienia: `codex/integrate-mvp-final-20260803` / `ad41701753`

## Cel

Repozytorium zawiera wiele wartościowej pracy, która nie weszła do bieżącego wydania albo
została później zaimplementowana inną drogą. Ten dokument służy do jej odnajdywania podczas
odbioru 16 kontraktów modułowych. Nie jest kolejką automatycznych merge'y.

Podstawowa zasada: **najpierw porównujemy intencję i zachowanie, dopiero potem kod**. Stara
gałąź może zawierać dobry pomysł, test lub poprawkę bezpieczeństwa, ale jednocześnie opierać
się na nieaktualnym schemacie, kontrakcie API albo modelu tenantów.

## Co istnieje poza finalnym drzewem

Snapshot audytu przed finalną konsolidacją wykazał:

- 765 lokalnych branchy, z czego 316 nie było osiągalnych z finalnego drzewa;
- 154 referencje `origin/*`, z czego 55 nie było osiągalnych;
- 37 zarejestrowanych worktree;
- 11 stashy;
- 5 brudnych worktree.

Te liczby opisują historię około roku pracy. Nie oznaczają 316 brakujących funkcji.

## Klasy zasobów

### A. Materiał do kontrolowanego handoffu

Najwyższy priorytet ma brudny checkout `codex/sync-demo-20260729`. Zawiera korpus standardu
UI/UX, dowody wizualne i robocze poprawki. Nie wolno scalać go hurtowo. Właściciel powinien
przekazać: bazę, listę plików, rozdział dokumentacja/kod/dev-render, testy oraz jawnie wskazać
pliki przeznaczone do adaptacji.

Pozostałe brudne worktree zawierają pojedyncze testy, router PMO, stare migracje i
`dev-render/`. Traktujemy je jako materiał dowodowy do przeglądu, nie jako gotowe paczki.

### B. Dawne branche kanoniczne i rundy odbiorowe

Przykłady: `codex/res10-canonical-goals-scorecards-ownership`,
`codex/results-remaining-mvp-build`, `codex/ini-004-capability-matrix`,
`codex/mw-010-vault-versioning`, `feat/fin-005-statement-ingestion-golden-flow`,
`feat/mat-010-canonical-artifact-receipt-lineage`.

Ich zaakceptowana funkcjonalność została już zrekonstruowana lub zintegrowana w finalnym
drzewie. Przy odbiorze używamy ich jako źródła testów, raportów i kontroli negatywnych. Nie
cherry-pickujemy ponownie całych zakresów.

### C. Zaparkowane funkcje biznesowe poza MVP

Warto sprawdzać szczególnie:

- `feat/wave2-meeting-core-session` — trwała sesja spotkania i pojednanie outputów;
- `feat/wave2-referral-enrollment-foundation` i `feat/wave2-partner-portal` — Referral oraz
  Partner Portal;
- `followup/presentation-template-db-write-honesty` — zapis szablonów bez fałszywego sukcesu;
- `fix/email-sending-smtp-from` — realna wysyłka e-mail;
- `fix/tools-wyjscie-z-sesji`, `fix/TAB-002`, `fix/swot-ai-null-fields` — konkretne luki Tools;
- `fix/mf-assessments-crud`, `fix/mf-assessments-schema`,
  `fix/assessment-collab-endpoints` — Assessment runtime;
- `fix/team-board-endpoints` — team membership PMO.

To kandydaci do fal po MVP, ale każdy musi ponownie przejść tenant/RBAC, aktualny schemat,
aktywny frontend i fresh read-back.

### D. Prototypy i poprawki UX

Najbardziej użyteczne jako biblioteka wzorców:

- `proto/galeria-szablonow` — wizualna galeria szablonów Materials;
- `proto/gamma-start-screen` — start tworzenia materiału „Z AI”;
- `design/whiteboard-sticky-cards2` — menu kart Whiteboard;
- `feat/pf-toolbar-slim` — progresywne ujawnianie toolbara Process Flow;
- branche `fix/n-type-*` — AutoFit, historia i układ kart N;
- `worktree-agent-aab28db457aa7d60b` — menu kontekstowe tabel;
- `worktree-agent-acfd08ac847f8e43e` — operacje bazowe Whiteboard;
- `research/notebook-market-analysis` — analiza rynku Notes.

Agent UI/UX może korzystać z tych branchy jako inspiracji i porównania, ale implementuje
zmiany na aktualnym baseline. Nie przenosi starych komponentów bez sprawdzenia aktywnej
ścieżki renderowania.

### E. Bezpieczeństwo, schema drift i niezawodność

Lipcowe branche `fix/*` zawierają dużą bibliotekę napraw: 500-leak, auth, nieistniejące
kolumny, NOT NULL, migracje, SSO secrets, integracje, budżety i AuditLogger. Część mogła zostać
wdrożona inną drogą, część może nadal być aktualna.

Przy każdym kontrakcie należy przeszukać historię po nazwie tabeli, endpointu i serwisu.
Poprawki bezpieczeństwa nigdy nie są adaptowane na podstawie samego tytułu commita — wymagają
odtworzenia negatywnej kontroli na aktualnym kodzie.

### F. Stashe Word/Excel/deliverables

Stashe z czerwca na `feat/deliverables-w1` obejmują między innymi:

- eksport XLSX i golden workbook;
- walidatory KPI/RAID/scope/deliverables/milestones/owner/ROI;
- business case, banking, variance narration, driver suggestions i statement completeness;
- value intelligence;
- zrekonstruowane usługi oraz testy.

Stashe z lipca obejmują Word visual diff, komentarze frontendowe i realtime table sync.
Stashy nie wolno obecnie usuwać ani aplikować do finalnego worktree. Przed adaptacją tworzymy
patch do osobnego katalogu i izolowany branch od bieżącego SHA.

## Procedura dla każdego z 16 kontraktów

### 1. Zdefiniuj powierzchnię kontraktu

Zapisz nazwy modułu, tabel, endpointów, głównych komponentów, feature flags i oczekiwanych
artefaktów. Bez tej listy wyszukiwanie branchy daje dużo fałszywych trafień.

### 2. Znajdź wszystkie ślady

Przykładowe polecenia tylko do odczytu:

```bash
git log --all --oneline --decorate --grep='FIN-05\|statement ingestion'
git log --all --oneline -- server/src/routes/v8/finance.routes.ts
git branch -a --no-merged HEAD | rg -i 'finance|fin-'
git stash list
git worktree list --porcelain
```

Szukaj również po nazwach endpointów i tabel przez `git log -S`, nie tylko po nazwie taska.

### 3. Klasyfikuj znalezisko

Każdy kandydat otrzymuje jeden status:

- `ALREADY_PRESENT` — zachowanie istnieje w finalnym drzewie;
- `SUPERSEDED` — istnieje nowsza, lepsza implementacja;
- `ADAPT_CODE` — brakuje zachowania i kod nadaje się do rekonstrukcji;
- `ADAPT_TEST` — kod jest stary, ale test lub negatywna kontrola są wartościowe;
- `ADAPT_UX_IDEA` — przenosimy wzorzec, nie komponent;
- `POST_MVP_CANDIDATE` — funkcja wartościowa, lecz poza bieżącym kontraktem;
- `UNSAFE_OR_OBSOLETE` — stary schemat, fail-open, brak tenant/RBAC albo martwy runtime;
- `NEEDS_OWNER_HANDOFF` — brudne lub niejednoznaczne źródło.

### 4. Porównaj deltę względem punktu rozwidlenia

Nie porównuj starego HEAD bezpośrednio z nowym HEAD, bo pokaże setki pozornie usuniętych
plików. Użyj:

```bash
BASE=$(git merge-base HEAD nazwa-brancha)
git diff --stat "$BASE"..nazwa-brancha
git diff --name-status "$BASE"..nazwa-brancha
git log --oneline "$BASE"..nazwa-brancha
```

Następnie sprawdź te same pliki w aktualnym drzewie i ustal, czy intencja już istnieje.

### 5. Adaptuj na osobnym branchu

Nowy branch zawsze powstaje z bieżącego finalnego SHA. Preferowana kolejność:

1. odtworzyć brakujący test lub minimalny reproduktor;
2. potwierdzić czerwony wynik na aktualnym kodzie;
3. zaadaptować najmniejszą potrzebną deltę;
4. wykonać tenant/RBAC, real-PG, fresh read-back i aktywny UI;
5. dopiero wtedy zgłosić controlled handoff.

Cherry-pick całego starego brancha jest wyjątkiem, nie domyślną metodą.

## Karta odzysku do wypełnienia przy odbiorze

| Pole | Wartość |
| --- | --- |
| Kontrakt / moduł | |
| Aktualny SHA | |
| Wyszukane frazy, tabele i endpointy | |
| Znalezione branche / commity / stashe | |
| Klasyfikacja każdego znaleziska | |
| Funkcja już obecna? | |
| Brakująca wartość do adaptacji | |
| Ryzyka schema / tenant / RBAC | |
| Test negatywny na aktualnym kodzie | |
| Decyzja: adaptować / odłożyć / odrzucić | |
| Docelowy commit i dowód runtime | |

## Zakazy operacyjne

- Nie scalać hurtowo brudnego checkoutu ani katalogów `dev-render`.
- Nie aplikować i nie usuwać stashy bez osobnego backupu i identyfikacji właściciela.
- Nie uznawać nazwy brancha ani raportu za dowód, że funkcja działa.
- Nie przenosić lazy DDL, mock success, fallback `[]` ani kodu bez tenant scope.
- Nie zmieniać finalnego licznika 93 z powodu odnalezionego eksperymentu lub funkcji post-MVP.

## Praktyczny rezultat

Przy odbiorze każdego modułu dołączamy wypełnioną kartę odzysku. Dzięki temu stara praca nie
ginie, ale również nie destabilizuje finalnego produktu. Kanoniczne drzewo pozostaje jednym
źródłem wydania, a historia repozytorium staje się biblioteką rozwiązań i dowodów.
