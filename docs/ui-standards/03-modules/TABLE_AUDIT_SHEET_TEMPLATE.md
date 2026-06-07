---
doc_kind: AUDIT_TEMPLATE
version: 1.1
owner: user
status: canonical
last_updated: 2026-06-07
---

# SZABLON AUDYTU TABELI — gotowy do skopiowania przed każdą tabelą

> **Jak używać:** skopiuj ten plik → wypełnij META → przejdź fazy 0→6 po kolei.
> Karta jest NIEZGODNA dopóki jakikolwiek punkt 🔴 ma FAIL.
> Nie skracaj kroków. Nie skakaj do detali zanim Faza 0 jest 100% PASS.

---

## META

| Pole | Wartość |
|---|---|
| Moduł / zakładka | `[np. interview.sessions]` |
| Plik główny | `src/components/...` |
| Branch | `[np. Londyn]` |
| Dane testowe | `[ile wierszy, rola: OWNER/ADMIN/USER]` |
| Data audytu | `[YYYY-MM-DD]` |
| Audytor | `[Claude / Piotr]` |

---

## FAZA 0 — EXISTENCE CHECK (ZRÓB ZANIM COKOLWIEK INNEGO)

> Otwórz zakładkę w przeglądarce. Odpowiedz TAK/NIE.
> **Jakiekolwiek NIE = blokujące = napraw ZANIM przejdziesz do Fazy 1.**

| # | Pytanie | Wynik | Blokujące |
|---|---|---|---|
| **0-1** | **Preview pane:** Klik wiersza → panel BOCZNY otwiera się z prawej (tabela się zwęża). URL się NIE zmienia. Nie ma przejścia do innego modułu. | TAK/NIE | 🔴 |
| **0-2** | **Filtry kolumn:** W nagłówkach (np. Status, Typ, Priorytet) widoczna ikona lejka. Klik ikony → otwiera się dropdown z listą wartości do zaznaczenia. | TAK/NIE | 🔴 |
| **0-3** | **Sort:** Klik nagłówek kolumny (np. „Tytuł") → wiersze zmieniają kolejność. Pojawia się ChevronUp lub ChevronDown przy nagłówku. | TAK/NIE | 🔴 |
| **0-4** | **Resize:** Przeciągnij uchwyt na granicy dwóch kolumn → kolumna zmienia szerokość, sąsiednia reaguje (zero-sum). | TAK/NIE | 🔴 |
| **0-5** | **Sticky header:** Zescrolluj tabelę w dół (jeśli jest co scrollować) → nagłówek kolumn trzyma na górze. | TAK/NIE | 🔴 |
| **0-6** | **Popover kolumn:** Ikona Settings2 w nagłówku → otwiera się panel „Visible columns" który NIE jest ucinany przez overflow; widać ostatnie pozycje i toggle „Pokaż opis". | TAK/NIE | 🔴 |
| **0-7** | **Kebab ⋮:** Ikona ⋮ w wierszu → menu z co najmniej: „Otwórz podgląd/Open" ORAZ „Archiwizuj" w sekcji stałej. Menu pojawia się przy przycisku (nie 100px dalej). | TAK/NIE | 🔴 |
| **0-8** | **Pasek bulk:** Zaznacz checkbox 1 wiersza → pasek u góry tabeli pokazuje „1 selected · Clear · [przynajmniej 1 inna akcja]". Przyciski mają ramki (outline). Przyciski są po LEWEJ. | TAK/NIE | 🔴 |
| **0-9** | **Stany:** Przy pustej liście widać empty state z ikoną (NIE blank). Wymuś błąd sieciowy → karta błędu z przyciskiem Retry (NIE biały ekran). | TAK/NIE | 🔴 |

**Status Fazy 0:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 1 — PREVIEW PANE (szczegółowo)

> Kliknij kilka wierszy, sprawdź każdy punkt. Dla tabel cross-module: sprawdź wiersz
> w każdym statusie (draft / promoted / archived).

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **I-1** 🔴 | Single-click = boczny panel | Klik wiersz → panel z prawej, URL bez zmian | URL się zmienia LUB nawiguje do innego ekranu | PASS/FAIL |
| **I-2** 🔴 | Cross-module draft zostaje w źródle | (tylko jeśli tabela ma cross-module np. Initiatives) Klik draft → NIE idzie do modułu docelowego; panel preview z notką „pozostaje w X do czasu przekazania dalej" | Draft otwiera /initiatives lub inny moduł od razu | PASS/FAIL/N-A |
| **I-3** 🔴 | Double-click / Enter = pełna karta | Dblclick wiersz → pełna karta LUB nawigacja do modułu (dla promoted) | Dblclick nic nie robi | PASS/FAIL |
| **I-4** | Esc zamyka | Otwórz preview → naciśnij Esc → panel znika | Esc ignorowany | PASS/FAIL |
| **I-5** | Szerokość clamp | DevTools → zmierz szerokość panelu preview przy wąskim i szerokim oknie → mieści się w `clamp(340px, 28%, 480px)` | <340px lub >480px | PASS/FAIL |
| **I-6** | Separacja gap-1.5, brak border-l | DevTools inspect → brak `border-left` między tabelą a preview; widoczny gap ~6px | `border-left` widoczny | PASS/FAIL |
| **I-7** 🔴 | Header preview: „Open" TYLKO tam | W nagłówku preview jest przycisk Open/Otwórz. W STOPCE NIE ma przycisku Open (szukaj w całym preview — ma być dokładnie 1) | 0 lub 2+ przycisków Open w preview | PASS/FAIL |
| **I-8** 🔴 | Details wypełnione (bogaty szablon) | Sekcja Details pokazuje treść encji: opis/cel/kontekst/właściciel/daty. NIE jednolinijkowy label. Przy pustej encji → empty state w sekcji | Blank lub jednolinijkowy tekst; Details wypychane w dół przez przyciski | PASS/FAIL |
| **I-9** 🔴 | ⋮ przy Details ma Export + Download | Klik ⋮ obok nagłówka „Details" → lista zawiera: Kopiuj, Kopiuj prompt, **Export do Tools**, **Pobierz (.md)** | Export/Pobierz brak w ⋮ (lub są gdzieś indziej — dolny pasek) | PASS/FAIL |
| **I-10** 🔴 | Żelazna kolejność stopki: AI → Relations → Co dalej → Actions | Scrolluj stopkę: pierwsza karta = AI (chipy), druga = Relations (jeśli są), trzecia = „Co dalej" (create-strip), czwarta = Actions (jeśli w ogóle) | Inna kolejność; Actions nad AI | PASS/FAIL |
| **I-11** 🔴 | „Co dalej" = COMPACT STRIP, nie wielkie karty | Karta „Co dalej" zawiera małe pille `h-8 rounded-full` z ikoną+labelką. NIE ma dużych kart `min-h-[...]` z opisem. Dwie grupy: Dokumenty / W aplikacji | Wielkie karty z opisem modułu w treści preview | PASS/FAIL |
| **I-12** 🔴 | Ikony+kolory „Co dalej" zgodne z §7.3a | Raport=slate/FileText, Deck=fuchsia/Presentation, Tabela=emerald/Table, Idea=amber/Lightbulb, Notatka=sky/StickyNote, Inicjatywa=indigo/Rocket | Błędne ikony lub kolory | PASS/FAIL/N-A |
| **I-13** 🔴 | Stopka: space-y-2.5, BEZ dividerów między kartami | Inspect gap między kartą AI a „Co dalej" — ~10px, brak `<hr>` / `border-t` między kartami z ramką | Duże odstępy lub twarde linie między każdą kartą | PASS/FAIL |
| **I-14** 🔴 | Actions na dole: brak redundancji | Sekcja Actions (jeśli istnieje): NIE zawiera „Open" (jest w headerze), NIE zawiera Export/Pobierz (są w ⋮ Details). Jeśli po odjęciu duplikatów nic nie zostaje → sekcja Actions w ogóle nie istnieje | Duplikat „Open" w dolnym pasku | PASS/FAIL |

**Status Fazy 1:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 2 — KEBAB ⋮ (3-strefowy, każda zakładka, każdy status)

> ⚠️ Otwórz kebab dla wiersza w KAŻDYM statusie (draft / in-progress / submitted / approved / sent-back).
> ⚠️ Sprawdź w KAŻDEJ zakładce modułu osobno.

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **H-1** 🔴 | Kebab wyrównany do ⋮ przycisku | Klik ⋮ → menu pojawia się PRZY przycisku (prawa krawędź menu = prawa krawędź przycisku). Mierz wizualnie lub `getBoundingClientRect()` | Menu oddalone od przycisku o >20px | PASS/FAIL |
| **H-2** 🔴 | Strefa DÓŁ zawsze obecna i kompletna | Otwórz kebab → w dolnej strefie (stałej) są: `Open/Otwórz podgląd` + `Edytuj` + `Archiwizuj` (lub `Przywróć`) + (`Delay ▸` jeśli encja ma termin). Te 3–4 pozycje są ZAWSZE, niezależnie od statusu | Któraś z tych pozycji brakuje w dowolnym statusie | PASS/FAIL |
| **H-3** 🔴 | Strefa GÓRA kontekstowa wg statusu | Otwórz kebab dla wiersza w każdym statusie → GÓRA zmienia się (np. draft→„Wyślij do przeglądu"; submitted→„Zatwierdź" + „Wyślij z powrotem"; approved→brak górnej strefy). Pusta strefa = ukryta (bez pustego separator-only) | Góra identyczna dla wszystkich statusów LUB zawsze pusta LUB separator bez pozycji | PASS/FAIL |
| **H-4** 🔴 | Strefa DANGER: Usuń | Kebab → ostatnia sekcja = „Usuń" w kolorze danger (czerwony), oddzielona separatorem. Klik → pojawia się confirm. Jeśli brak backendowego endpointu → przycisk `disabled` z opisem „Wkrótce (backend)" | Brak strefy danger LUB Usuń bez confirm | PASS/FAIL |
| **H-5** | Delay ▸ submenu | (jeśli encja ma termin) Klik „Delay ▸" → rozwijają się 3 pod-pozycje: +1 dzień, +3 dni, +7 dni. Klik pod-pozycji zamyka menu i ustawia termin. | Klik Delay wykonuje akcję od razu (bez submenu) | PASS/FAIL/N-A |
| **H-6** | Ikona przy każdej pozycji | Każda pozycja kebaba = ikona + label (bez pozycji z samym tekstem) | Pozycja bez ikony | PASS/FAIL |
| **H-7** | Menu portalowe, nieclipowane | Otwórz kebab gdy tabela jest blisko dolnej krawędzi viewport → menu auto-flip w górę. Menu NIE jest ucięte przez scroll-container tabeli. | Menu ucięte przez overflow | PASS/FAIL |
| **H-8** 🔴 | Parytet z preview | Akcje w kebab = te same co w preview footer (te same labele, te same uprawnienia) | Kebab ma „Archiwizuj" ale preview nie ma, lub odwrotnie | PASS/FAIL |
| **H-9** 🔴 | Sprawdzono w KAŻDEJ zakładce | Lista zakładek sprawdzonych: `[___]` | Fix w jednej zakładce ≠ fix wszędzie | PASS/FAIL |

**Status Fazy 2:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 3 — PASEK BULK (Menu 3 formuła 2)

> ⚠️ Sprawdź zaznaczając 1 wiersz, 2+ wiersze, i „select all".
> ⚠️ Sprawdź w KAŻDEJ zakładce osobno.

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **D-1** 🔴 | Pasek pojawia się natychmiast przy zaznaczeniu | Klik checkbox 1 wiersza → Menu 3 natychmiast zmienia się w pasek bulk (nie ma zwłoki / odświeżenia) | Pasek nie pojawia się LUB opóźnienie | PASS/FAIL |
| **D-2** 🔴 | Licznik + Clear + ≥1 inna akcja | Pasek pokazuje: „N selected" · [Clear z ikoną X] · [≥1 przycisk akcji]. Jeśli jest tylko „Clear" i nic więcej → FAIL | Tylko „N selected · Clear" bez akcji | PASS/FAIL |
| **D-3** 🔴 | Clear to PRZYCISK Z RAMKĄ (nie gołe słowo) | DevTools inspect na „Clear" → ma `border`, `h-8`, `rounded-full`, ikona X. Wygląda identycznie jak inne przyciski bulk. | Clear to `<button>` bez ramki / ghost / sam tekst | PASS/FAIL |
| **D-4** 🔴 | Wszystkie przyciski bulk IDENTYCZNE | Inspect każdy przycisk bulk → ta sama klasa `MENU_3_ACTION_NEUTRAL` (lub ekwiwalent): outline border, h-8, rounded-full, ikona+label. Żaden nie jest „ghost" ani „solid fill". | Mieszane style przycisków | PASS/FAIL |
| **D-5** 🔴 | Przyciski po LEWEJ stronie paska | Zrób screenshot paska → przyciski grupują się po LEWEJ (tuż przy liczniku), nie są wypychane na prawą krawędź | Przyciski po prawej stronie | PASS/FAIL |
| **D-6** 🔴 | Przyciski kontekstowe (per status) | Zaznacz tylko wiersze w statusie „draft" → pasek pokazuje akcje dla draftu (np. „Wyślij do przeglądu"). Zaznacz tylko „submitted" → inne akcje. Zaznacz mix statusów → wspólny podzbiór lub brak kontekstowych. | Te same przyciski niezależnie od zaznaczonych statusów | PASS/FAIL/N-A |
| **D-7** | Danger (Delete/Archive) na końcu z confirm | Przycisk „Archiwizuj" lub „Usuń" w pasku → klik → confirm dialog (nie od razu wykonuje). Danger ton dla „Usuń". | Wykonuje od razu bez confirm | PASS/FAIL |
| **D-8** | Clear → wraca formuła 1 | Klik Clear → odznacza wszystkie wiersze → pasek wraca do counter-chipów (formuła 1) | Po Clear pasek nie wraca do chipów | PASS/FAIL |
| **D-9** 🔴 | Sprawdzono w KAŻDEJ zakładce | Lista zakładek sprawdzonych: `[___]` | Fix w jednej zakładce ≠ fix wszędzie | PASS/FAIL |

**Status Fazy 3:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 4 — NAGŁÓWEK, KOLUMNY, CHIPY

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **E-1** 🔴 | Typografia nagłówka | DevTools inspect nagłówek kolumny → `font-size: 11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: >0`. Kolor `text-slate-500 dark:text-slate-400`. | Inny font-size, brak uppercase, inny kolor | PASS/FAIL |
| **E-2** 🔴 | Sticky header | Inspect → `position: sticky`, `top: 0`, `z-index: 10`. Rodzic: inspect → NIE ma `overflow: hidden`. | sticky nie działa (nagłówek scrolluje razem z treścią) | PASS/FAIL |
| **E-3** 🔴 | Wyrównanie kolumn wg roli | Sprawdź KAŻDĄ kolumnę: tytuł/nazwa = left; chipy (status/typ/kategoria/źródło) = left+kropka; liczby (progress%/liczniki) = right; assignee/due = left; akcje = right. ŻADNA kolumna chipów NIE jest center. | Centrum na chipach/statusach | PASS/FAIL |
| **E-4** 🔴 | Wiodąca kropka przy chipach tożsamości | Kolumna Typ/Kategoria/Źródło: chip ma neutralny shell + kolorową kropkę h-1.5 w-1.5 (lewostronną). NIE ma kolorowego tła chipa. NIE ma bocznego paska. | Kolorowe tło chipa; brak kropki; kropka po prawej | PASS/FAIL |
| **E-5** 🔴 | Ta sama kategoria = ten sam kolor wszędzie | Kategoria „Observation" → zawsze ten sam hue (np. tag-3). Ta sama kategoria w innej zakładce → ten sam kolor. | Różne kolory dla tej samej kategorii w różnych wierszach/zakładkach | PASS/FAIL |
| **F-1** 🔴 | Status = EntityStatusChip z c.* tokenami | Inspect komórkę Status → kropka ma `background-color` z palety `c.*` (not `#` hardcoded blue/green). Brak `<StatusPill>` w drzewie DOM. | `bg-blue-900`, `bg-green-100`, stary StatusPill | PASS/FAIL |
| **F-2** 🔴 | Progress NIE jest czerwony | (jeśli kolumna Progress) Inspect fill paska progresu → kolor = info (niebieski) lub success (zielony) przy 100%. NIGDY czerwony przy <100%. | Czerwony pasek progresu | PASS/FAIL/N-A |
| **F-3** 🔴 | Jedna kolumna DueChip (nie dwie) | Policz nagłówki kolumn związane z terminem → dokładnie 1 (np. „Due" lub „Termin"). NIE ma osobnej kolumny „Overdue". | Dwie kolumny: „Due" + „Overdue" | PASS/FAIL/N-A |
| **F-4** | Puste komórki = em-dash | Wiersz z brakiem danych w kolumnie → pokazuje `—` (wyciszony), nie blank | Pusta komórka (nic) | PASS/FAIL |
| **G-1** | Tło wiersza NIE barwione statusem | Wiersz „approved" → tło białe/szare (nie zielone). Wiersz „danger" → tło białe (nie czerwone). Status TYLKO w chippie. | Kolorowe tło wiersza wg statusu | PASS/FAIL |
| **G-2** | Selected row = primary-500/8 + lewy akcent | Zaznacz wiersz → lewa krawędź wiersza = 4px niebieski akcent + subtelne tło. | Brak wizualnego wyróżnienia selekcji | PASS/FAIL |

**Status Fazy 4:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 5 — MENU 2 / MENU 3 (formuła 1 + scope)

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **C-1** 🔴 | Taby modułu bez liczników | Menu 2 lewa strona → taby (np. Inbox/Sessions/Assigned) bez cyfr w labelach | Taby mają liczniki w nawiasach | PASS/FAIL |
| **C-2** 🔴 | Prawy klaster: Area → CTA → Tool → Views → Filters (od prawej) | Policz i zwizualizuj kolejność kontrolek od prawej krawędzi | Odwrócona kolejność; CTA po lewej | PASS/FAIL |
| **D-10** 🔴 | Counter-chipy Menu 3 (formuła 1) | Pod Menu 2 widać pasek chipów: „All N · Status1 M · …". Liczniki są aktualne (zgodne z liczbą wierszy w tabeli). | Brak chipów; liczniki 0 gdy są dane | PASS/FAIL |
| **D-11** 🔴 | Ten sam zestaw chipów na każdej zakładce | Porównaj chipy na Inbox vs Sessions vs Assigned → te same kategorie. | Inbox ma „All/Answered", Sessions ma „All/In progress" — różne zestawy dla tej samej roli | PASS/FAIL |
| **D-12** 🔴 | Scope chip Aktywne/Zarchiwizowane | Menu 3 ma chip z ikoną Archive (Aktywne/Zarchiwizowane). Klik → przeładowuje listę z `?scope=archived`. Kebab w archived → pokazuje „Przywróć" zamiast „Archiwizuj". | Brak scope chipa (chyba że świadomie odłożone = B-1 backlog) | PASS/FAIL/BACKLOG |

**Status Fazy 5:** `PASS` / `FAIL (punkty: ___)`

---

## FAZA 6 — KOLORY, DARK/LIGHT, STANY, RUNTIME

| # | Check | Jak sprawdzić | FAIL gdy | Wynik |
|---|---|---|---|---|
| **K-1** 🔴 | „Test ekranu" — brak biało-czerwieni | Zrób screenshot tabeli → policz ile czerwonych elementów. Czerwień tylko dla realnego alarmu (overdue/error/blocked). | Progres, neutralne statusy, „w toku" są czerwone | PASS/FAIL |
| **T-1** | Light/Dark parytet | Przełącz między dark i light → tabela czytelna w obu; separatory wierszy widoczne w dark; light nie „wyprany". | W dark separatory niewidoczne; w light przetłuszczone kolory | PASS/FAIL |
| **L-1** | Stany empty/loading/error | Empty: ikona + opis + CTA (NIE blank). Loading: spinner/skeleton (NIE blank). Error: karta + Retry (NIE biały ekran). | Którykolwiek stan = blank lub brak Retry | PASS/FAIL |
| **U-1** | Console bez errorów | DevTools Console → filtry do „Errors" → zero czerwonych błędów po otwarciu zakładki. | Błędy JS/React w konsoli | PASS/FAIL |
| **U-2** | Akcje mają realne handlery | Klik akcji kebab/bulk (np. Archiwizuj) → request do backend → toast sukcesu → lista się odświeża. NIE jest atrapą (klik = nic). | Klik akcji = nic się nie dzieje | PASS/FAIL |
| **P-1** | RC-1/3/4 — scroll, sticky, overflow | Jeden kontener scrolla (brak podwójnego); nagłówek sticky nie znika; brak overflow:hidden na rodzicu sticky. | Podwójny scroll; nagłówek znika przy scrollu | PASS/FAIL |

**Status Fazy 6:** `PASS` / `FAIL (punkty: ___)`

---

## BRAMKI INŻYNIERSKIE (ZAWSZE na końcu)

```bash
# FE TypeScript
rm -f tsconfig.tsbuildinfo && npx tsc --noEmit 2>&1 | tail -5

# Backend
cd server && npx esbuild src/index.ts --bundle --platform=node 2>&1 | grep error

# ESLint
npx eslint src/components/[PLIK].tsx --max-warnings=0 2>&1 | tail -10
```

| Bramka | Wynik |
|---|---|
| FE tsc = 0 błędów | PASS/FAIL |
| BE esbuild = 0 błędów | PASS/FAIL |
| ESLint 0 błędów (warnings OK) | PASS/FAIL |
| Kod świeży: `curl -s localhost:3000/src/.../Plik.tsx` → 200 + nowy kod | PASS/FAIL |

---

## RAPORT KOŃCOWY

| Faza | Status | Punkty FAIL |
|---|---|---|
| Faza 0 — Existence | | |
| Faza 1 — Preview pane | | |
| Faza 2 — Kebab ⋮ | | |
| Faza 3 — Pasek bulk | | |
| Faza 4 — Nagłówek/Kolumny | | |
| Faza 5 — Menu 2/3 | | |
| Faza 6 — Kolory/Runtime | | |
| Bramki | | |

**Łączny wynik:** `ZGODNA Z KANONEM` / `NIEZGODNA (lista punktów: ___)`

**Co naprawiono:**
- [ ] ...

**Co świadomie odłożono (z uzasadnieniem):**
- [ ] ...

**Dowód wizualny:**
- Screenshot przed: `[ścieżka lub opis]`
- Screenshot po: `[ścieżka lub opis]`
- Computed-style weryfikacja: `[co sprawdzono]`

---

## ANEKS — NAJCZĘSTSZE WPADKI (by nie powtarzać)

| Wpadka | Jak nie przegapić |
|---|---|
| Preview nie istnieje (nawiguje od razu do modułu) | Faza 0-1: sprawdź URL po kliku |
| Filtry nie istnieją (brak lejka w nagłówku) | Faza 0-2: wizualnie sprawdź nagłówki przed wejściem w kod |
| Kebab pusty lub tylko „Open record" | Faza 2: policz pozycje PER STATUS, nie tylko „czy kebab otwiera się" |
| Bulk tylko „Clear" — brak akcji | Faza 3-D2: policz przyciski; 1 = FAIL |
| „Co dalej" jako wielkie karty w body preview | Faza 1-I11: sprawdź czy to strip `h-8` czy karta `min-h-[...]` |
| Drugi „Open" w stopce preview | Faza 1-I14: grep za „Open" w stopce — ma być 0 |
| Export/Pobierz w dolnym pasku zamiast w ⋮ Details | Faza 1-I9: klik ⋮ przy Details, sprawdź listę |
| Przyciski bulk po prawej stronie | Faza 3-D5: screenshot → sprawdź `left` przycisków |
| Draft inicjatywy otwiera /initiatives | Faza 1-I2: dla cross-module sprawdź czy URL pozostaje bez zmian |
| HMR stale cache Vite | Bramki: curl plik aby sprawdzić świeżość kodu |
