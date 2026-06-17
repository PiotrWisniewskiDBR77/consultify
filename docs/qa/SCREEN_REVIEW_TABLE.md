# Przegląd screenów — tabela odchyleń od standardów (punkt po punkcie)

> Per-screen analiza light (oś priorytetowa) vs kanon. Kolumny: # · gdzie · poprawki (lub „100% okej").
> Źródła: `docs/qa/screens/` (72 default light+dark) + `docs/qa/screens/preview/` (28 preview-state). Findings krzyżują się z `MASTER_VISUAL_QA_CATALOG.md` (VIS-###).
> Pomiar: część zweryfikowana computed-color; reszta = ogląd (serwer down → bez pomiaru, oznaczone). Sev: P0 broken · P1 czytelność/semantyka · P2 spójność · P3 polish.

## Moduł: Chat + My Work (#01–#08)

| # | Gdzie | Poprawki do zrobienia |
|---|---|---|
| **01** | Chat — ekran powitalny (light) | • `VIS-003` composer „Ask Teresa" zajmuje ~40% wysokości pustką → zredukować/afordancje (P2). • Reasoning/cytaty crimson — zweryfikować źródło (aging vs `text-primary` leak) zanim ruszę (P3). • „Talk to Teresa" crimson = **OK** (1 z 5 dozwolonych miejsc). Reszta OK. |
| **02** | My Work → Ideas (light + preview) | • `VIS-009` selekcja wiersza `bg-primary-50` (rose/crimson) → neutralny/blue (P2, **zmierzone** `rgba(251,221,224)`, locus `MyTasksListContent.tsx:123`). • `VIS-010` preview nad-truncate tytułu „QA OWNER 17…" (P3). • Daty rose = `AGING_STYLES` intencjonalne (NIE bug). Anatomia preview §7.3 OK. |
| **03** | My Work → Notebook (lista) | **100% okej** (lista: navy CTA, daty neutralne szare, czytelna). ⚠️ Edytor notatki: `VIS-012` gigantyczny „CANONICAL NOTEBOOK PATH" (~40% kanwy, duplikuje prawy panel) → wdrożyć SPEC_07 (slim chip) — P1-design, osobna decyzja. |
| **04** | My Work → Inbox (preview) | 🔴 **`VIS-013` P0 — CRASH przy kliknięciu wiersza** (error boundary „Coś poszło nie tak"). Inbox niedostępny po kliknięciu. Przyczyna ≠ PreviewRelations (guarded) → **wymaga żywego stack-trace** do diagnozy. NAJWYŻSZY priorytet. • Tabela (załadowana) zgodna z kanonem. • `VIS-007` gęstość Menu 3 (8+3 chipy + AI Triage) (P3). |
| **05** | My Work → Calendar (light) | • **Wszystkie eventy fioletowe** mimo legendy SOURCES (Tasks=niebieski/Initiatives=czerwony/Decisions=amber) → brak kodowania kolorem źródła; eventy powinny kolorować się wg source (P2). • Today-indicator — zweryfikować czy crimson (powinien blue, jak fix T3) (P3). • Fiolet eventów to nie token palety — ustalić token (P3). |
| **06** | My Work → Tasks (light) | • `VIS-001` badge danger w light (Critical) — tło+border+text-danger §5 (P1, systemowe). • `VIS-009` selekcja (jw.). • Daty overdue rose = aging (intencjonalne). *(render mały — ogląd; pomiar przy serwerze)* |
| **07** | My Work → Decisions (light) | • `VIS-001` badge danger/status w light (§5) (P1, systemowe). • `VIS-009` selekcja (jw.). • Tabela-wzorzec spójna z resztą. *(render mały — ogląd)* |
| **08** | My Work → Manager (dashboard) | • **Zielony „Approve"** (Action Required → Decision) → emerald-token success (jak fix AIActionCard/ChatTableProposalCard) (P2). • Dashboard exec gęsty ale spójny (Portfolio Health donut, KPI-cards, Risk HIGH=red OK). • „Team Capacity 512%" = dane demo, nie UI. |

## Moduł: Interview (#09–#14)

> Tabele Interview = **ten sam komponent** co My Work → findingi systemowe (badge §5, selekcja, progress-token) **uniform**. Inbox (załadowany) w light czytelny (tytuły slate-900, badge z tłem). Preview: zmierzone `open=true` na wszystkich tabach → przycisk „Otwórz" §7.3 obecny ✓.

| # | Gdzie | Poprawki |
|---|---|---|
| **09** | Interview → Inbox (przydzielone) | • `VIS-001` badge „overdue" w light = **tło transparent** (zmierzone) → §5 danger-fill (P1). • `VIS-005` progress „in-progress" indigo → `--c-info` blue (P3). • Tabela poza tym OK. |
| **10** | Interview → Sessions | • `VIS-005` progress indigo→blue (P3). • `VIS-001`/`VIS-009` systemowe (jw.). Status „In Progress" blue OK. *(render mały)* |
| **11** | Interview → Assigned | • Systemowe `VIS-001` badge + `VIS-009` selekcja (wzorzec wspólny). *(render mały — ogląd z wzorca tabeli)* |
| **12** | Interview → Templates | • Tagi Category kolorowe — zweryfikować że to tokeny `--c-tag-*` nie ad-hoc (P3). • Status „Published" zielony — potwierdzić emerald-token (P3). • Systemowe jw. |
| **13** | Interview → Insights | • „Expires in"/daty crimson — zweryfikować aging vs `text-primary` leak (P3). • Systemowe jw. |
| **14** | Interview → Initiatives | • Systemowe `VIS-001`/`VIS-009` (wzorzec). • Preview „Open" obecny ✓. *(render mały)* |

## Moduł: Tools + Initiatives (#15–#20)

| # | Gdzie | Poprawki |
|---|---|---|
| **15** | Tools → Library (light) | • `VIS-006` „Add" CTA crimson → navy-token (P2). • Tabela 36 narzędzi **czysta** (nazwy slate-900, status Active/Inactive różnicowany, tagi pille). Reszta OK. |
| **16** | Tools → Sessions | • Systemowe (badge/selekcja) — wzorzec tabeli. *(render mały — ogląd z wzorca)* |
| **17** | Tools → Reports & Presentations | • Wzorzec tabeli, systemowe. *(render mały)* |
| **18** | Tools → Initiatives | • Wzorzec tabeli, systemowe. *(render mały)* |
| **19** | Initiatives → Portfolio (kanban) | • `VIS-006` „New initiative" crimson → navy (P2). • **UWAGA #15** — brak działającego „Otwórz" z board-preview (klik karty = panel bez Open) → P1, weryfikacja na żywo. • Karty kanban OK. |
| **20** | Initiatives → Analysis | **≈100% okej** — semantyka kolorów **poprawna** (Overloaded=rose-card / Available=green / Workload 1400%=red-bar / badge „Overallocated"=rose **z tłem** ✓). Jedyne: `VIS-006` „New initiative" crimson→navy (P2). |

> **Status:** #01–#20 gotowe. Kontynuacja: Execution (#21–24), Results (#25–29), moduły poniżej-KPI (#30+), + dark-mode pass.
> **Obserwacja systemowa:** badge danger NIE wszędzie gubi fill — `PMOPriorityBadge` (My Work) gubi (`VIS-001`), ale Initiatives „Overallocated" ma fill. Czyli `VIS-001` jest **per-komponent**, nie globalny → fix celowany w `PMOPriorityBadge`, nie w każdy badge.

## Moduł: Execution + Results (#21–#29)

| # | Gdzie | Poprawki |
|---|---|---|
| **21** | Execution → Summary (light) | **≈100% okej** — tabela czysta (Status „Executing" blue, Alerts „OK" green, separatory OK). `VIS-008` (wyblakłe separatory) **ODRZUCONE** = był loading. „New initiative" tu **navy (poprawnie)** → potwierdza `VIS-006` (Initiatives ma crimson — ujednolicić). |
| **22** | Execution → Rollout | • Wzorzec tabeli, systemowe. *(render mały — ogląd z wzorca)* |
| **23** | Execution → Reporting | • Wzorzec tabeli/raport, systemowe. *(render mały)* |
| **24** | Execution → Management | • Wzorzec tabeli, systemowe. *(render mały)* |
| **25** | Results → Initiatives | • Wzorzec tabeli; preview „Open" — zmierzone `open=false`, **zweryfikować na żywo** czy brak-Open czy capture-miss (P2). Systemowe. |
| **26** | Results → KPI (light) | • Kolumna **„Initiative" crimson** — zweryfikować leak vs link intencjonalny (P2). • Status „Below…" **ucięty** (P3). • Trend Up/Down **bez koloru/strzałki** (Down→red, Up→green?) (P3). • Current-values red = „below target" (arguably intencjonalne — nie ruszać bez decyzji). „+ Add KPI" navy OK. |
| **27** | Results → KPI Reports | • Wzorzec, systemowe. *(render mały)* |
| **28** | Results → ROI | • Analityka; „ROI" link zielony — token-check (P3). *(render mały)* |
| **29** | Results → ROI Analysis | • Analityka; wzorzec. *(render mały)* |

## Moduły poniżej-KPI (#30–#36) — poza scope priorytetu („nie gotowe" wg decyzji Piotra)

| # | Gdzie | Poprawki |
|---|---|---|
| **30** | Finance → Statements | • **Mieszane PL/EN** w zakładkach: „Analiza inwestycyjna" wśród angielskich (Statements/Models/Analysis/Prediction) + „Importuj statement" (P2-i18n). • Tabela statement czysta. |
| **31** | Audits | • Ogląd odłożony — moduł „nie gotowy" (poza scope priorytetu); zrzut w archiwum. |
| **32** | Documents / Outputs (hub) | • **Mieszane PL/EN** (taby EN: All/Mine/Documents/Presentations/Sheets; chipy PL: Szkic/Wygenerowana/Edycja/Gotowa) (P2-i18n). • Stan błędu „Real presentations source needs attention" (registry nie załadował) — **UI błędu poprawny/honest** (amber callout, jasny komunikat, „verify DB" — zgodny §4.1). Dane nie ładują (nie gotowy/staging). „New presentation" navy OK. |
| **33** | Document Studio | • Poza scope (nie gotowy); zrzut w archiwum. Wzorzec mixed-lang/empty prawdopodobny (jak #30/#32). |
| **34** | Presentation Studio | • jw. |
| **35** | Table Studio | • jw. |
| **36** | Meeting | • jw. |

> **Wzorzec below-KPI:** mieszane PL/EN (#30 Finance, #32 Documents) + stany empty/error (dane nie ładują na staging) + **honest-error UI** (poprawny). Deep-review odłożony do gotowości modułów (decyzja Piotra). Główny wspólny fix: **i18n zakładek/chipów**.

## Dark mode (przekrojowo) — spot-checked

**PASS-dominant, potwierdzone.** Dark był bazą projektową → systemowe findingi light (`VIS-001` badge-fill, `VIS-009` selekcja-rose) **nie występują w dark** (badge/selekcja mają fill). Spot-check KPI-dark: czysty, spójny strukturalnie z light.
- **Cross-theme (w OBU motywach, NIE light-specyficzne):** KPI „Initiative" crimson + Current-red + „Below…" truncate identyczne dark/light → crimson-Initiative = spójny styling link=primary (nie light-leak); truncate = realny P3 w obu.
- **Niezależne od motywu:** `VIS-003` composer pustka, `VIS-013` Inbox crash, `VIS-006` CTA, `VIS-010` truncate.
- **Dedykowany pełny dark re-sweep** = po fixach light (ratchet) — wtedy mierzony, nie tylko spot.

---

## 🎯 SKONSOLIDOWANA LISTA AKCJI (co realnie naprawić — priorytet)

| Sev | Akcja | Locus | Z których ekranów |
|---|---|---|---|
| 🔴 **P0** | `VIS-013` Inbox CRASH przy kliknięciu wiersza (preview) — diagnoza z żywego stack-trace, fix | ścieżka Inbox-preview (NIE PreviewRelations — guarded) | #04 |
| 🟠 **P1** | `VIS-001` badge danger w light gubi fill | `MyWork/shared/PMOPriorityBadge.tsx` (celowany, nie globalny) | #06, #07, #09 |
| 🟠 **P1-design** | `VIS-012` odchudzić „Canonical Path" notatnika (SPEC_07) | `NotebookCanonicalPathStrip.tsx` | #03 |
| 🟡 **P2** | `VIS-009` selekcja wiersza crimson/rose → neutral/blue | `MyWork/MyTasksListContent.tsx:123` (+ niescentralizowana) | #02, #06, #07 |
| 🟡 **P2** | `VIS-006` primary-CTA ujednolicić na navy (Tools/Initiatives crimson vs Execution/My Work navy) | per-moduł CTA | #15, #19, #20 vs #08, #21, #26 |
| 🟡 **P2** | `VIS-003` composer Chat — zredukować pustkę | composer Chat | #01 |
| 🟡 **P2** | Calendar — eventy kolorować wg source (nie wszystko fiolet) | My Work Calendar | #05 |
| 🟡 **P2** | Finance — ujednolicić język zakładek PL/EN | Finance | #30 |
| 🔵 **P3** | `VIS-005` progress „in-progress" indigo→info-blue | progress-token | #09, #10 |
| 🔵 **P3** | `VIS-010` preview truncate tytułu; KPI status „Below…" truncate; Trend bez koloru | preview/KPI | #02, #26 |
| ⚪ **VERIFY** | crimson na: Reasoning/cytaty (#01), Insights „Expires" (#13), KPI „Initiative" (#26), Calendar today (#05) — **zmierzyć źródło** (aging/link intencjonalny vs leak) zanim ruszę | różne | #01, #05, #13, #26 |

**ODRZUCONE pomiarem/oglądem (NIE bug):** `VIS-008` Execution separatory (=loading); daty-aging (intencjonalny sygnał); Notebook lista (czysta); Initiatives Analysis (semantyka kolorów poprawna); dark głównie PASS.

> **✅ AUDYT KOMPLETNY (2026-06-16).** #01–#36 light + dark spot-checked + skonsolidowana lista akcji.
> - **In-scope (do KPI) #01–29** — gruntownie, część zmierzona.
> - **Below-KPI #30–36** — „nie gotowe" (decyzja Piotra): Finance/Documents konkretnie (mixed-lang+empty), reszta scope-deferred.
> - **Dark** — PASS-dominant, spot-checked; pełny mierzony re-sweep po fixach light.
> - **Wymaga żywego serwera (auth padł):** `VIS-013` crash-diagnoza (stack), pomiar before/after fixów.
>
> **NASTĘPNY ETAP (po audycie, wg decyzji Piotra): całościowe poprawki** wg „Skonsolidowanej listy akcji" — P0 crash → P1 (badge/notebook) → P2 (selekcja/CTA/composer/calendar/i18n) → P3. Loci gotowe. Kontekst zachowany w tym dokumencie + `MASTER_VISUAL_QA_CATALOG.md`.
