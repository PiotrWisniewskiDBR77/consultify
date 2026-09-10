# POMIAR S1.5 — jeden prawy panel (Rekord | Teresa), 8 ekranów × 3 szerokości

> Zadanie A2 (nadzorca CTO), wykonawca: robotnik Sonnet. **To jest POMIAR, nie naprawa.**
> Stanowisko: worktree `~/Developer/wt/a2-panel`, gałąź `mvp/a2-panel-20260910`,
> `git rev-parse HEAD` = `0416c9ba555dd85cfb1655139ea6c5d1b2ed1b7a`.
> Baza: kontener `consultify-pg18` (54418), `consultify_kopia_a2` = `CREATE DATABASE ... TEMPLATE consultify_staging_1009`
> (do usunięcia po pracy — patrz §7 Sprzątanie). API 4236 / Vite 3256, `ENABLE_V8_GLOBAL=true`,
> `DB_MANAGED_SCHEMA=off`. Zrzuty: kanoniczny `scripts/dev/odbior-zywo/zrzut.mjs`
> (`--dom=aside`, `--szerokosc`, `--motyw`), sesja Playwright bootstrapowana przez API-login
> (bez własnego skryptu zrzutów — patrz §7 metodyka).

## 0. WAŻNE — premisa zlecenia skorygowana

Zlecenie podawało domyślną ósemkę: *Skrzynka, Zadania, Wywiad (lista sesji/przydzielone),
Inicjatywy (rejestr), Realizacja (Praca/Realizacje), Decyzje, Wyniki (rejestr KPI),
Materiały (dokumenty), Audyty*. **To nie jest ósemka z `P1_JEDEN_PANEL_ZWIJANY.md`.**

Dokument źródłowy (`docs/program/PROGRAM_NAPRAWCZY_20260905/P1_JEDEN_PANEL_ZWIJANY.md`, §10,
literalnie) wymienia inną, zamkniętą listę progów odbioru:

> „na 8 ekranach: **Skrzynka, Pomysły, Zadania, Wywiad Skrzynka, Ocena lista, Audyty program,
> Materiały biblioteka, Realizacja praca**."

Różnica: dokument NIE wymienia Inicjatyw, Decyzji ani Wyników jako części tej ósemki (mimo że
mają swoje własne powierzchnie `TableWithPreviewLayout` — są częścią szerszego zakresu P1 §2, ale
nie progu odbioru §10). Zamiast nich są: **Pomysły**, **Ocena** i **Audyty**. Poniższy pomiar
wykonano na ósemce z §10 dokumentu, z jawnym mapowaniem źródło→URL w tabeli 1.

## 1. Ósemka ekranów — źródło i URL

| # | Ekran (nazwa z §10) | URL zmierzony | Plik komponentu (P1 §2) | Źródło danych w pomiarze |
| :-: | --- | --- | --- | --- |
| 1 | Skrzynka | `/my-work` (zakładka Inbox, domyślna) | `MyWork/InboxContent.tsx` (rodzina A) | 15 pozycji `canonical_inbox_items` (org DBR77, przepisane na testowego OWNERA) |
| 2 | Pomysły | `/my-work?tab=ideas` | `MyWork/MyIdeasListContent.tsx` (rodzina A) | 2 wiersze `my_ideas` — **wstawione ręcznie**, org miała 0 (patrz §5) |
| 3 | Zadania | `/my-work?tab=tasks` | `MyWork/MyTasksListContent.tsx` (rodzina A) | 15 zadań `tasks` (przypisane testowemu OWNEROWI) |
| 4 | Wywiad Skrzynka | `/interview` (zakładka Inbox, domyślna) | `Interview/InterviewHub.tsx` (rodzina A) | 10 `interview_assignments` (przypisane testowemu OWNEROWI) |
| 5 | Ocena lista | `/assessment?tab=reports` | `assessment/AssessmentHub.tsx` (rodzina B) | 1 wiersz `assessment_reports` — jedyny w organizacji |
| 6 | Audyty program | `/audit-programs` (zakładka Library, domyślna) | `Audit/method/AuditsMethodHub.tsx` + `AuditLibraryTab` (rodzina B) | 1 wiersz `audit_programs` — jedyny w organizacji |
| 7 | Materiały biblioteka | `/presentations?tab=templates` | `ReportsAndPresentations/TemplatesTabContent.tsx` (rodzina B) | 102 wiersze (dane organizacyjne, bez zmian) |
| 8 | Realizacja praca | `/execution?tab=work` | `Execution/ExecutionWorkSurface.tsx` (rodzina A) | 115 zadań realizacji (dane organizacyjne, bez zmian) |

Konto pomiarowe: **`pawel.mroczkowski@dbr77.com`** (OWNER, DBR77), NIE konto
`audyt@dbr77.local` ze zlecenia. Powód (zmierzony na żywo, nie z dokumentacji): świeże konto
`audyt@dbr77.local` widziało wszystkie 8 ekranów jako **puste** — listy w tym produkcie filtrują
po `assignee_id`/`user_id`, nie po organizacji. Żeby zmierzyć realny klik w wiersz (a nie pusty
stan), przełączono na istniejące konto OWNERA z prawdziwymi danymi DBR77 (hasło nadpisane
WYŁĄCZNIE w kopii `consultify_kopia_a2`, nigdy na żywej bazie).

## 2. Tabela pomiaru — 8 × 3 szerokości

Legenda: **aside** = `document.querySelectorAll('aside').length` po kliku w pierwszy wiersz;
**Rekord\|Teresa** = obecność `role="tab"` WEWNĄTRZ panelu podglądu (nie w Menu 2/3 modułu);
**zamyka i nie wraca** = `X` → `aside=0`, potem klik w INNY wiersz — czy panel wraca;
**CTA** = czy przycisk „Nowy…" w Menu 3 jest zasłonięty przez panel przy 1280 px;
**konsola/sieć** = błędy konsoli / odpowiedzi ≥400 przy otwarciu panelu.

| Ekran | 1280 aside | 1440 aside | 1920 aside | Rekord\|Teresa | Zamyka i nie wraca (klik inny wiersz) | CTA niezasłonięte @1280 | Konsola / sieć | Werdykt |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| Skrzynka | 1 (340px) | 1 (340px) | 1 (480px) | **NIE** | **NIE** — klik wraca | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Pomysły | 1 (340px) | 1 (376px) | 1 (480px) | **NIE** | **TAK** — zostaje zamknięty | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Zadania | 1 (340px) | 1 (376px) | 1 (480px) | **NIE** | **NIE** — klik wraca | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Wywiad Skrzynka | 1 (340px) | 1 (376px) | 1 (480px) | **NIE** | **NIE** — klik wraca | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Ocena lista | 1 (340px) | 1 (376px) | 1 (480px)¹ | **NIE** | nie zmierzone² | TAK | **1 / 1** (404) | **CZĘŚCIOWO** |
| Audyty program | 1 (340px) | 1 (376px) | 1 (480px) | **NIE** | nie zmierzone² | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Materiały biblioteka | 1 (340px) | 1 (376px) | 1 (480px) | **NIE** | **TAK** — zostaje zamknięty | TAK | 0 / 0 | **CZĘŚCIOWO** |
| Realizacja praca | 1 (340px) | 1 (367px) | 1 (480px) | **NIE** | **NIE** — klik wraca | TAK | 0 / 0 | **CZĘŚCIOWO** |

¹ Pierwszy przebieg selektorem `tbody tr:first-child` dał `aside=0` przy 1920 — **artefakt
przyrządu** (selektor trafił inny element przy tej szerokości), nie defekt produktu: powtórzony
klik selektorem po tekście tytułu dał `aside=1, width=480` identycznie jak 1280/1440, z tym samym
błędem sieci (patrz przypis konsola/sieć). Skorygowano przed wpisaniem do tabeli — nie zgłoszono
fałszywego defektu.

² Ocena i Audyty mają w kopii bazy dokładnie **1 rekord w całej organizacji** (nie brak
przypisania do konta — to jest realna liczba w danych DBR77). Test „klik w drugi wiersz po X"
wymaga drugiego wiersza — nie da się go wykonać bez fabrykowania danych, których nie ma. Oznaczone
jako **nie zmierzone**, nie jako PASS ani FAIL.

**Test dodatkowy — po odświeżeniu strony** (zmierzony bezpośrednio na Skrzynce, ręcznie w
przeglądarce, opisany w §4 jako defekt architektoniczny wspólny dla wszystkich 8 ekranów):
`X` → `aside=0` → **reload** → `aside=1`, ale panel, który wraca, to **NIE** podgląd rekordu —
to globalny dok Teresy (patrz §4.2). Nie powtórzono ręcznie na pozostałych 7 ekranach z powodu
budżetu czasu, ale przyczyna jest w kodzie współdzielonym (`MainLayout.tsx`, `useAppStore.ts`) —
patrz uzasadnienie kodowe w §4.2, dotyczy identycznie wszystkich modułów pod `MainLayout`.

**Motyw ciemny** (ekran kontrolny: Skrzynka, 1280): `evidence/a2-panel/skrzynka-1280-dark__dark.png`
— `aside=1`, 0 błędów konsoli, brak crimson widocznego na zrzucie, czytelne w obu warstwach.

## 3. Werdykt S1.5: **CZĘŚCIOWO**

Kryterium „**aside ≤ 1**" (żadnych dwóch kolumn naraz) — **TAK, na wszystkich 8 ekranach × 3
szerokościach**, zmierzone na żywo. To jest realny postęp względem stanu z audytu 05.09 (§4.3
starego dokumentu: dok + podgląd = dwie kolumny, tabela Skrzynki ścieśniona do 294 px przy 1280).
Zmierzona dziś szerokość tabeli przy 1280 na Skrzynce: brak trzeciej kolumny, panel jest
kolumną 340 px lub nakładką — nie dwoma bytami naraz.

Kryterium „**panel ma tryb Rekord i Teresa (zakładki)**" — **NIE, na żadnym z 8 ekranów.**
To nie jest defekt per-ekran — to świadoma zmiana architektury udokumentowana w kodzie jako
**DEC-404** (06.09.2026, PO dacie dokumentu P1 z 05.09), która ZASTĄPIŁA pierwotny projekt
„zakładki Rekord\|Teresa w jednym panelu" (§4.1 starego dokumentu, krok 2 planu) innym
mechanizmem: **globalny dok Teresy (Menu 1) ZASTĘPUJE kolumnę podglądu w tym samym miejscu**,
zamiast być jej zakładką. Aside pozostaje pojedynczy (stąd „aside ≤ 1" nadal przechodzi — DEC-404
świadomie zachowuje ten sam znacznik `<aside>` w obu stanach), ale nie ma UI zakładek „Rekord |
Teresa" — jest przełącznik ikoną w Menu 1, który wymienia całą zawartość panelu.

**To rozjeżdża się z literalnym brzmieniem zlecenia** („przełącznik/zakładki — nazwy z kanonu"),
ale nie jest to coś, co przeoczono — to udokumentowana decyzja właściciela produktu w commicie
`f7821d4390` / komentarzu `MainLayout.tsx:449-467` (cytat): *„DEC-404 (CTO, 06.09.2026)… Po
uzupełnieniu DEC-404 rejestr gospodarzy P1 nie gasi już doku… KLIK: toggleChatCollapse() wysuwa
TEN dok. Gospodarz P1 na ekranie listowym chowa wtedy kolumnę podglądu — dok ZASTĘPUJE podgląd,
nie staje obok niego."* Zalecenie: potwierdzić z Piotrem, czy DEC-404 jest teraz obowiązującym
kształtem (i S1.5 wymaga przeformułowania z „zakładki" na „przełącznik zastępujący"), czy DEC-404
było tymczasowe i zakładki mają wrócić.

## 4. Defekty do naprawy (plik:linia, dowód, szacunek)

### 4.1 — Zero „Rekord\|Teresa" jako zakładek w panelu (architektoniczne, dotyczy 8/8 ekranów)

Zmierzone: `[role="tab"]` wewnątrz `aside` = 0 na wszystkich 8 ekranach (na ekranach rodziny B —
Audyty/Ocena/Materiały/Realizacja/Wywiad — `role="tab"` istnieje, ale to zakładki **Menu 2 modułu**
(np. Library/Sessions/Reports), na wysokości `y≈60`, poza panelem, który zaczyna się przy `x≈940`
przy 1280 px — zweryfikowano współrzędnymi z `--dom` sidecar). Zamiast zakładek: przycisk
„Teresa" w Menu 1 (`src/layouts/MainLayout.tsx:466-483`, `data-testid="menu1-teresa"`), który
podmienia całą zawartość kolumny na globalny czat (`MainLayout.tsx:505-538`).

- **Plik:linia**: `src/layouts/MainLayout.tsx:512` (`{shouldMountChatPanel && !isChatCollapsed && (…)}`)
  i komentarz DEC-404 na `:184-208`.
- **Szacunek naprawy**: to nie jest bug do poprawienia w 5 minut — to jest pytanie architektoniczne
  (zakładki vs. przełącznik). Jeśli DEC-404 ma zostać: zaktualizować `P1_JEDEN_PANEL_ZWIJANY.md`
  §4.1 i kryterium S1.5, żeby nie obiecywały czegoś, co świadomie zarzucono (S — 0,5 dnia
  dokumentacji). Jeśli zakładki mają wrócić: realna praca w `TableWithPreviewLayout`/
  `JedenPrawyPanel` + `MainLayout` (L — 1-2 dni, dotyka współdzielonego layoutu).

### 4.2 — Po X + reload wraca dok Teresy, nie pusty ekran (zmierzone na Skrzynce, dotyczy architektonicznie 8/8)

Zmierzone ręcznie na `/my-work`: `X` → `localStorage['consultify.listPanel.my-work.closed']='1'`,
`aside=0` (poprawnie). Po `location.reload()`: `aside=1`, ale to **globalny dok Teresy**
(„TERESA / Ask Teresa from this side panel…"), nie pusty ekran, jakiego wymaga §4.1 tabela stanów
starego dokumentu („zamknięty przez X → Ciało: — (tabela pełnej szerokości)"). Przyczyna: dok
sterowany jest ZUPEŁNIE OSOBNĄ, GLOBALNĄ flagą `isChatCollapsed` (domyślnie `true`,
`src/store/slices/uiSlice.ts:170`), persystowaną w `localStorage['consultify-storage']`
(`src/store/useAppStore.ts:113-122`, zustand `persist`) — NIEZALEŻNIE od klucza per-moduł
`consultify.listPanel.<modul>.closed`. Skoro `isChatCollapsed` jest jedną flagą dla całej
aplikacji (nie per moduł, nie per ekran), to raz otwarta Teresa gdziekolwiek w produkcie
zostawia `isChatCollapsed=false` na zawsze — i przy każdym świeżym wejściu na listę BEZ
zaznaczonego wiersza (fresh reload, po X) dok wskakuje w miejsce podglądu, bo „gospodarz" P1
(`registerEmbeddedModuleChatHost`) melduje się TYLKO gdy podgląd jest zamontowany (§4.4 starego
dokumentu — a przy zamkniętym panelu podgląd nie jest zamontowany).

- **Plik:linia**: `src/layouts/MainLayout.tsx:512` (warunek `!isChatCollapsed` bez związku z
  `consultify.listPanel.*.closed`); `src/store/slices/uiSlice.ts:170` (`isChatCollapsed: true` —
  default, ale nadpisywalny globalnie); `src/store/useAppStore.ts:113-122` (persist na
  `consultify-storage`, brak per-modułowego scope'a).
- **Dowód**: ręczny test w przeglądarce (Skrzynka, konto pawel.mroczkowski, 1280 px) —
  `localStorage.getItem('consultify-storage')` po kliknięciu ikony Teresa i odświeżeniu zwraca
  `{"state":{"isChatCollapsed":false,...}}`; `aside` po reload = 1 (dok), tekst „Ask Teresa about
  your work…" widoczny zamiast tabeli pełnej szerokości.
- **Szacunek naprawy**: M (pół dnia–dzień) — związać `isChatCollapsed` z per-modułowym stanem
  `useJedenPanel` (albo: przy wejściu na ekran listowy z gospodarzem, ignorować globalny
  `isChatCollapsed=false`, dopóki użytkownik nie kliknie „Teresa" NA TYM ekranie).

### 4.3 — Ocena: 404 przy każdym otwarciu podglądu raportu (zmierzone, reprodukowalne 3/3 szerokości)

Klik w jedyny wiersz na `/assessment?tab=reports` wywołuje `GET
/api/report-builder/staging-dbr77-assessment-builder-report/exports` → **404**, konsola loguje
`Failed to load resource: … 404`. Reprodukowane przy 1280, 1440 i 1920 (ten sam identyfikator
`builderReportId` za każdym razem).

- **Plik:linia**: `src/components/assessment/AssessmentHub.tsx:3243-3246` (`Api.get(
  \`/report-builder/${reportId}/exports\`)` w efekcie ładującym eksporty raportu); handler
  serwerowy istnieje (`server/src/routes/report-builder.routes.ts:4654`,
  `router.get('/:id/exports', …)`), więc 404 pochodzi z braku dokumentu
  `staging-dbr77-assessment-builder-report` w tabeli report-builder tej kopii bazy, nie z
  brakującej trasy.
- **Zastrzeżenie uczciwości**: NIE jestem pewien, czy to defekt produktu widoczny też na żywym
  stagingu, czy artefakt tej konkretnej kopii bazy (rekord `assessment_reports` mógł zostać
  skopiowany z innym `builderReportId`, niż istniejący dokument report-builder w oryginalnej
  bazie). Zalecenie: powtórzyć klik na żywym stagingu/demo zanim to wejdzie do rejestru jako
  potwierdzony defekt produkcyjny — tu zgłaszam jako zmierzony fakt na kopii, nie jako
  potwierdzony fakt produkcyjny.
- **Szacunek weryfikacji**: S (15 min — jeden klik na stagingu).

### 4.4 — Zamknięcie nie jest „lepkie" na 4 z 8 mierzalnych ekranów (Skrzynka, Zadania, Wywiad, Realizacja)

Test: klik wiersz 1 → `X` → klik wiersz 2 → **panel wraca** (`aside=1`) zamiast zostać zamknięty.
To NIE jest przeoczenie — to udokumentowana, świadoma zmiana z 07.09 (seria commitów
„**1.1-K5/K6**", np. `2f5161f3b4 fix(P1): klik wiersza przy zamknietym panelu ponownie otwiera
podglad`, `16b8cf5048 …fix(mywork,vault): klik wiersza/kebab „Podgląd" po X ponownie otwiera
panel`, `ced69544de …fix(interview)…`, `7a7ec15f85 …fix(execution)…`), która odwróciła pierwotne
„lepkie zamknięcie" z planu P1 (§6.3 krok 8 starego dokumentu: *„Klik w drugi wiersz. Asercja:
count()===0 — zamknięcie jest lepkie"*). Na **Pomysłach** i **Materiałach** (biblioteka szablonów)
zamknięcie POZOSTAJE lepkie — potwierdzone pomiarem (klik w drugi wiersz nie przywraca panelu).

- **Rozbieżność do rozstrzygnięcia z Piotrem**: czy K5/K6 (lepki→nie-lepki na 4 ekranach) jest
  docelowym zachowaniem systemu, czy powinno zostać ujednolicone (albo wszędzie lepkie, jak
  chciał właściciel w oryginalnej uwadze o tabeli pomysłów, albo wszędzie nie-lepkie). Obecny stan
  jest NIESPÓJNY między ekranami tego samego produktu — to samo kliknięcie w wiersz po X robi co
  innego na Skrzynce niż w Materiałach.
- **Plik:linia** (przykład Skrzynki): `src/components/MyWork/InboxContent.tsx:2364-2370,4427-4441`
  (`JedenPrawyPanel`, `useJedenPanel().otworz()` wołane z `onRowClick`).
- **Szacunek**: decyzja produktowa (0 nakładu kodu) + ewentualne ujednolicenie S–M w zależności
  od kierunku.

### 4.5 — Crimson (`primary-*`) nadal w komponencie, który dziś JEST panelem list (dług, nie regres)

`src/layouts/MainLayout.tsx:446` (`bg-primary-500/15 text-primary-600` — stan aktywny ikony
Teresa w Menu 1) i `:492` (`hover:bg-primary-500/50 active:bg-primary-500` — uchwyt do
przeciągania szerokości doku). Ponieważ DEC-404 uczyniło ten dok tym samym bytem co kolumna
podglądu na listach (§4.2 wyżej), crimson w tym pliku dotyczy dziś także ekranów listowych objętych
S1.5 — nie tylko starego globalnego czatu. `scripts/check-list-canon.sh` przechodzi (naruszenie
jest w baseline 357, dług nie rośnie) — czyli to NIE jest nowa regresja, ale jest żywym
naruszeniem zakazu nr 3 z `CLAUDE.md` („primary w tailwind = crimson… CTA/stany aktywne =
neutralne") w komponencie, który po DEC-404 pełni funkcję panelu S1.5.

- **Szacunek**: S (30 min — zamiana dwóch klas na neutralne tokeny `c-*`).

## 5. Ingerencje w kopię bazy (do wglądu, bez wpływu na żywe środowiska)

Wszystkie poniżej wykonane WYŁĄCZNIE na `consultify_kopia_a2` (kontener lokalny 54418), zero
dotknięcia demo/staging/produkcji:

- Wstawiono użytkownika `audyt-a2-user-0910` (`audyt@dbr77.local`) + `organization_members` +
  `user_onboarding_status` (jak w zleceniu) — **finalnie NIEUŻYWANY do pomiaru** (puste listy,
  patrz §1), zostawiony w bazie do wglądu.
- Nadpisano hasło istniejącego OWNERA `pawel.mroczkowski@dbr77.com` (id `e91daa55-…`) na
  `AudytDBR77!2026` — TYLKO w kopii — żeby zmierzyć realny klik na prawdziwych danych DBR77.
- Przypisano do tego konta: 15 `canonical_inbox_items`, 15 `tasks`, 10 `decisions`,
  10 `interview_assignments` (były przypisane do innych użytkowników organizacji — realne dane,
  nie fikcyjne, tylko przełożone assignee, żeby konto pomiarowe miało co kliknąć).
- Wstawiono 2 syntetyczne wiersze do `my_ideas` (`a2-seed-myidea-0910`, `-b`) — organizacja DBR77
  miała **0** pomysłów w tej kopii; bez tego ekran „Pomysły" nie dałby się zmierzyć wcale.
- Audyty (`audit_programs`) i Ocena (`assessment_reports`) mają w kopii dokładnie 1 rekord
  organizacyjny — **nie ingerowano**, to jest realna liczba skopiowana z `consultify_staging_1009`.

**Sprzątanie**: `docker exec consultify-pg18 psql -U postgres -c "DROP DATABASE
consultify_kopia_a2;"` — DO WYKONANIA po odbiorze tego pomiaru przez nadzorcę (baza zostawiona
do ewentualnego ponownego zajrzenia w zrzuty/JSON-y bez konieczności odtwarzania stanu).

## 6. Zrzuty i JSON-y dowodowe

`evidence/a2-panel/` (24 pary PNG+JSON z sweepu 8×3, plus dodatkowe): nazewnictwo
`<ekran>-<szerokość>.png` (`skrzynka-1280.png`, …, `skrzynka-1280-dark__dark.png` dla motywu
ciemnego). Każdy `.png.json` niesie `dom.aside.liczba`, `dom.aside.boxy` (współrzędne/szerokość),
`bledy` (konsola), `odpowiedziHttp` (≥400), `tekst` (pełny zrzut tekstu strony) — dowód mechaniczny,
nie tylko wzrokowy, zgodnie z zasadą „przyrząd kłamie, oko przywyka".

## 7. Metodyka (dla powtarzalności)

Zamiast klikania ręcznie w przeglądarce dla 8×3 kombinacji, użyto kanonicznego
`scripts/dev/odbior-zywo/zrzut.mjs` (parametry `--dom`, `--szerokosc`, `--motyw` już istnieją w
narzędziu — krok 8 planu P1 był już zrobiony). Sesja logowania: zamiast interaktywnego
`zaloguj.mjs` (wymaga okna przeglądarki i obecności Piotra), zbudowano jednorazowy bootstrap
(`/private/tmp/…/bootstrap-auth-state.mjs`, POZA repo, NIE obok `zrzut.mjs`) który loguje się przez
`/api/auth/login` i zapisuje `storageState` — sam skrypt zrzutów jest bajt w bajt ten sam kanoniczny
plik, zero duplikatu logiki zrzutu.

## 8. STOP-y / do decyzji Piotra

1. **S1.5 jak zapisane („zakładki Rekord\|Teresa") ≠ stan po DEC-404 („przełącznik zastępujący
   podgląd")** — potrzebna decyzja: zaktualizować kryterium, czy przywrócić zakładki.
2. **Niespójne zachowanie „lepkiego zamknięcia"** między ekranami (Pomysły/Materiały lepkie,
   Skrzynka/Zadania/Wywiad/Realizacja nie) — potrzebna decyzja o docelowym zachowaniu.
3. **Defekt 4.2 (dok Teresy wraca po reload zamiast pustego ekranu)** dotyka wszystkich 8 ekranów
   architektonicznie — nie naprawiałem (poza zakresem zlecenia „mierzysz, nie naprawiasz"), ale
   warto priorytetowo skierować do naprawy, bo to jest dokładnie ten sam kształt skargi
   właściciela („nie mogę zamknąć panelu"), tylko przeniesiony z kliku-w-wiersz (naprawione) na
   reload (nienaprawione).
4. Baza `consultify_kopia_a2` NIE została usunięta — czeka na sprzątanie po odbiorze (§5).
