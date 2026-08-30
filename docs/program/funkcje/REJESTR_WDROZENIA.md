---
doc_id: funkcje-rejestr-wdrozenia
status: canonical
owner: piotr
truth_type: work-status
established: 2026-08-30
---

# Rejestr wdrożenia — tor FUNKCJE

Jeden wiersz na funkcję. **Zapis w tej samej godzinie, w której powstał pomiar** —
rozmowa nie jest nośnikiem wiedzy (`00_ZASADY_PRACY.md`, reguła nr 5).

## Jak czytać kolumnę „stan"

| Stan | Znaczenie | Co dalej |
| --- | --- | --- |
| `NIEZBADANE` | nikt nie zmierzył czterech warstw | pomiar przed jakąkolwiek decyzją |
| `ISTNIEJE_NIEAKTYWNE` | kod jest, brak wołacza albo brak renderu | **najtańsza robota w programie** — podłączyć |
| `ZA_FLAGA` | kod jest, flaga domyślnie OFF | zmierzyć przy włączonej, potem decyzja o domyślnej |
| `DZIALA` | cztery warstwy zamknięte, łańcuch renderowania podany | odbiór adwersaryjny → ocena A/B |
| `DO_ZBUDOWANIA` | **dowód nieistnienia** pokazany komendami | dopiero teraz wolno budować |
| `ODLOZONE` | martwe albo poza rundą | wpis do `ODLOZONE.md`, kod zostaje |

## Cztery warstwy — bez nich wiersz nie wchodzi

`W1` typ/komponent · `W2` baza/backend · `W3` endpoint **i realny wołacz w `src/`** ·
`W4` **czy to się renderuje / wykonuje**.

**To nie są dowody:** sam `import` · wpis w rejestrze albo karcie odbioru ·
obecność w mapie widoczności · istnienie testu · nazwa katalogu · napis `CLOSED_FINAL`
w dokumentacji. W tym repozytorium `grep` systematycznie kłamie w stronę „działa".

## Ocena A–D (reguła nr 2 zasad pracy)

`A` działa przez interfejs, dowód mutacyjny w obie strony · `B` działa z **nazwanymi**
ograniczeniami · `C` nie działa albo dowód nie trzyma · `D` martwe / za flagą bez decyzji.
**Do właściciela idą wyłącznie `A` i `B`.**

---

## Rejestr

| Moduł | Funkcja | Trasa / serwis | Stan | Flaga (domyślna) | Dowód (ścieżka:linia) | Ocena | Werdykt właściciela |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Moja praca | Pulpit / Radar (zakładka „Home") | `MyWorkHub.tsx` case `'home'` | `ISTNIEJE_NIEAKTYWNE` | **brak flagi — literał `RADAR_ENABLED = false`** | `src/components/MyWork/MyWorkHub.tsx:240` (gate w 5 miejscach: `:583 :893 :1774 :3934`) | `D` | — |
| Wywiad | Skrzynka „Do dopuszczenia" (etap ④) | `isInterviewPendingReviewTabEnabled()` | `ZA_FLAGA` | `VITE_INTERVIEW_PENDING_REVIEW_TAB` (OFF, decyzja D-04) | `src/utils/interviewPendingReviewTabFlag.ts`; punkty gate `InterviewHub.tsx:2282,2337,6955,8835` | `D` | — |
| Narzędzia | Wyniki narzędzi w zbiorczej liście Outputs/Insights | `GET /api/tool-outputs`, `toolOutputs.routes.ts` | `ZA_FLAGA` | `VITE_TOOLS_INSIGHTS_WIRING` (OFF — cofnięte 28.08, DEC-158) | `src/utils/toolsInsightsWiringFlag.ts:45`; migracja `server/migrations/946_tool_outputs_reports_lineage.sql` | `D` | — |
| Czat | „Napisz raport" — lekka ścieżka `plan→generate→poll` | `POST /api/deliverables/generations` | `ZA_FLAGA` | `VITE_ENABLE_DELIVERABLES_LIGHT` (OFF) + bliźniacza flaga serwera **niezlokalizowana** | `src/utils/…deliverablesLight…`; 3 wołacze w `UnifiedChatPanel.tsx` | `D` | — |
| Czat | Trasa `/internal/v10-runtime` | `AppView.AI_CHAT_V10_RUNTIME` | `ODLOZONE` | — | `src/routes/routeConfig.ts:32,365,747`; **zero `<Route>` w `AppRoutes.tsx`**; `V10RuntimeWorkspaceView.tsx` nie jest nigdzie renderowany | `D` | — |
| Czat · Teresa | Strażnik poufności na drodze załączników (E1) | `ContextRetrievalService.ts:139` | `DO_ZBUDOWANIA` | brak | `DOWOD_2026-08-30_STRAZNIK_POUFNOSCI.md` | `C` | — |
| Czat · Teresa | Strażnik poufności na drodze awaryjnej (E2) | `ai.routes.ts:4368` | `DO_ZBUDOWANIA` | brak | jw. | `C` | — |
| Czat · Teresa | Strażnik poufności na drodze metadanych (E3) | `ai.routes.ts:4458` | `DO_ZBUDOWANIA` | brak | jw. | `C` | — |
| Czat · Teresa | Wołacz strażnika w `aiContextBuilder` | `aiContextBuilder.ts:974` | `ISTNIEJE_NIEAKTYWNE` | brak | `catch` oznaczony `// fail-open`, `aiContextBuilder.ts:1008` — znosi strażnika przy błędzie | `C` | — |
| Czat · Teresa | Korpus wiedzy organizacji | `fetchOrgApprovedContext` | `ZA_FLAGA` | `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` (OFF) — **zastrzeżenie: nie włączać przed osobnym dyżurem** | `ai.routes.ts:4077`; strażnik obecny `ContextRetrievalService.ts:333` | `D` | — |

---

## Pomiary w toku

| Tor | Moduły | Wydany | Stan |
| --- | --- | --- | --- |
| A | Chat · Moja praca · Wywiad · Narzędzia | 2026-08-30 | **wrócił, trzy twierdzenia przeliczone przez nadzorcę — zgadzają się** |
| B | Ocena · Inicjatywy · Realizacja · Wyniki | 2026-08-30 | biegnie |
| C | Finanse · Materiały · Audyty · Spotkania | 2026-08-30 | biegnie |
| D | Organizacja · Panel administratora · Ustawienia · Portal partnerski | 2026-08-30 | biegnie |

Wynik każdego toru wchodzi do rejestru **po przeliczeniu liczb przez nadzorcę**, nie
z raportu wykonawcy (reguła nr 3 — raport wykonawcy nie jest dowodem).

## Dyżury Codexa — tor funkcji

| Nr | Temat | Stan | Zastrzeżenie |
| --- | --- | --- | --- |
| 130 | Utrata danych — miejsca zapisu bez trwałości | biegnie u wykonawcy | klon `/private/tmp/cx-day130-utrata-danych` |
| 131 | Teresa i granice wiedzy | scalony po naprawie i odbiorze | **flagi `ENABLE_ORG_KNOWLEDGE_RETRIEVAL` nie wolno włączyć przed osobnym dyżurem** |


---

## Tor A — co przeliczył nadzorca, a co pozostaje twierdzeniem wykonawcy

**Przeliczone własnymi rękami 2026-08-30, zgadza się co do znaku i miejsca:**
`RADAR_ENABLED = false` jest **literałem**, nie flagą — nie da się go włączyć zmienną
środowiskową ani parametrem adresu; brak `<Route>` dla `/internal/v10-runtime`
w `AppRoutes.tsx`; migracja `946_tool_outputs_reports_lineage.sql` istnieje, a flaga
`toolsInsightsWiringFlag.ts` niesie w komentarzu pełną historię cofnięcia (DEC-158).

**★ Korekta liczby wykonawcy.** Tor A podał „24 pozycje `DZIALA`". Ta liczba **nie
spełnia definicji `DZIALA` z tego rejestru** — wykonawca sam napisał, że zamknął
`W1` i `W4`, a `W3` (realny wołacz API) oznaczał jako „zakładany" dla zakładek-dzieci,
bo cztery huby to ponad 27 000 linii. Do rejestru **nie wchodzi ani jedna z tych 24
pozycji jako `DZIALA`.** Pozostają `NIEZBADANE` na poziomie `W3`. Wpisujemy wyłącznie
to, co ma komplet czterech warstw albo dowód nieaktywności.

**Otwarte po torze A — do domknięcia, nie do zapomnienia:**
stan tabeli `tool_outputs` na bazie demo (pomiar kodu nie odpowiada na pytanie o bazę) ·
lokalizacja serwerowej bliźniaczki `ENABLE_DELIVERABLES_LIGHT` ·
czy `src/components/Discovery/InterviewHub.tsx` (drugi plik o tej nazwie) żyje ·
czy `canViewManager`/`canViewManaged`/`canViewInsights` to realne role, czy zawsze-prawda.
