# ANALIZA — czy górne menu (Menu 1) wygląda wszędzie tak samo (7 kart N)

> **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`)
> **Charakter:** ANALIZA. Zero zmian w kodzie, zero commitów kodu.
> **Odpowiedź na pytanie Piotra wprost:** *nie, nie wygląda tak samo* — ale przyczyna
> jest inna niż się wydaje. Wszystkie 7 kart renderuje **ten sam komponent**
> `NModeHeader.tsx`. Rozjazd nie bierze się z siedmiu implementacji, tylko z tego,
> że ten jeden komponent ma **6 opcjonalnych propów** i każda karta podaje inny
> podzbiór. Menu 1 jest wspólne w kodzie, a niewspólne na ekranie.

---

## 0. Metoda i granice tej analizy — przeczytaj przed tabelą

**Jak mierzyłem.** Harness `http://localhost:3220/?screen=…`, każdy ekran otwarty
osobno, pomiar przez `getComputedStyle` + `getBoundingClientRect` w konsoli strony.
Żadna wartość w tym dokumencie nie jest oceną „na oko" — kolory podaję jako `rgb()`,
wymiary w px.

**Trzy rzeczy, które mogłyby unieważnić wnioski — i co z nimi zrobiłem:**

| Ryzyko | Co się stało | Jak rozbroiłem |
|---|---|---|
| **Selektor łapał obcy nagłówek** | Pierwszy odczyt na `?screen=karta-tool` zwrócił „Zatwierdź decyzję" i kod `DEC-DECISION-PRV` | Każde zapytanie zwraca `location.href` **w tym samym wywołaniu** co odczyt DOM. Wszystkie liczby niżej pochodzą z odczytów z potwierdzonym URL-em |
| **Ktoś inny steruje tą kartą przeglądarki** | Zakładka samoczynnie przechodziła na inne ekrany (`karta-decision`, `karta-task`, `karta-initiative`) między moimi wywołaniami. `dev-render/main.tsx` **nie zawiera** żadnego `location`/`pushState`/`setInterval` (sprawdzone grepem) — więc steruje nią równoległa sesja | j.w. — asercja URL wewnątrz pomiaru. Odczyty pozostają spójne |
| **Mój własny selektor produkował fałszywy defekt** | `div.col-span-full > div.flex.items-center` zwracał 2–3 trafienia na Decision/Task. **To NIE są zduplikowane nagłówki** — to sąsiednie wiersze powłoki (pasek właściwości, pasek akcji), które przypadkiem pasują do selektora. Tylko trafienie `[0]` ma `<input>` tytułu | Zweryfikowane: `karta-task` → 3 trafienia, z czego tylko `[0]` (h=62) ma input tytułu; `[1]` h=34, `[2]` h=30, bez inputu. **Wykreślam to z listy defektów** |

**★ Ograniczenie, które zmienia interpretację połowy pomiarów.**
Panel przeglądarki miał **894 px szerokości** (`window.innerWidth = 894`), nie 1280.
`resize_window` nie zadziałał (viewport wrócił do 894). Część objawów to skutek
ciasnoty, nie bezwarunkowa wada. Rozdzieliłem to, wymuszając szerokość 1440 px przez
DOM (`root.style.width='1440px'`) i mierząc powtórnie — kolumna „@1440" w tabeli
defektów. **Objawy zależne od szerokości i tak są defektami** (kanon §11.2 zakłada
pracę poniżej 1280: *„<1280 prawy panel→drawer"*), ale mają węższy zakres.

**Czego NIE zweryfikowałem — patrz §6.** Nie zgaduję tam, gdzie nie zmierzyłem.

---

## 1. Kanon, względem którego mierzę

`ARTIFACT_ANATOMY_STANDARD.md:803` (§11.2), kolejność lewa→prawa:

```
←back ikon-20 h-32 · ㊱divider · ikona-typ 16 c.text-secondary · tytuł inline L2
· ④status-lifecycle · „Zapisano •" L5 c.text-muted ‖ (prawa) [indeks] ghost h-32 · ①primary h-36
```

Wysokość paska: **48 px**, padding `px-16`, tło `c.surface` (`ARTIFACT_ANATOMY_STANDARD.md:796`).
SPEC-N §2.3: **dokładnie jeden** primary; poza tym slotem nic nie jest solid/filled.

---

## 2. Co REALNIE jest w Menu 1 — 7 kart × elementy

Wszystkie 7 kart montują `src/components/shared/NModeLayout/NModeHeader.tsx`.
Faktyczna kolejność renderu (`NModeHeader.tsx:130–261`) jest dla wszystkich identyczna:

```
back(36) · [kropka statusu 12] · tytuł<input> · [kod artefaktu] · [permalink]
  ‖ przycisk „Zapisano"(38) · [AI] · divider · przełącznik N/C · divider · [primary h-36]
```

Legenda: ✅ jest · ✗ nie ma · ⚠ jest, ale odbiega od kanonu.

| Element Menu 1 | Tool | Notification | Interview | Decision | Insight | Task | Initiative |
|---|---|---|---|---|---|---|---|
| `←` back h-36 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `㊱` divider po back | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **ikona-typ 16** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| kropka statusu (poza kanonem) | ⚠ `bg-c-success` | ⚠ `bg-amber-400` | ⚠ `bg-blue-500` | ⚠ `bg-amber-500` | ⚠ `bg-emerald-500` | ⚠ `bg-blue-500` | ⚠ `bg-slate-400` |
| tytuł inline | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ |
| **`④` status-lifecycle (etykieta)** | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| kod artefaktu (poza kanonem) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| permalink (poza kanonem) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| wskaźnik „Zapisano" | ⚠ przycisk | ⚠ przycisk | ⚠ przycisk | ⚠ przycisk | ⚠ przycisk | ⚠ przycisk | ⚠ przycisk |
| przycisk AI | ✗ | ✗ | ✅ | ✅ | ✗ | ✅ | ✗ (handler martwy) |
| przełącznik N/C (poza kanonem) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `[indeks]` ghost h-32 | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **`①` primary h-36** | ✅ | ✅ | **✗** | ✅ | ✅ | **✗** | **✗** |
| **wysokość paska** | 62 | **77** | 62 | **77** | **77** | 62 | 62 |

Zmierzone tytuły primary (light, pl): Tool „Startuj sesję" · Notification „Otwórz dokument" ·
Decision „Zatwierdź decyzję" · Insight „Konwertuj na inicjatywę".

---

## 3. Pomiar: ile elementów wygląda na primary (solid/filled)

Kryterium maszynowe: `backgroundColor` z alfą ≥ 0.85, element `<button>`, szer. > 40 px, wys. ≥ 28 px.

| Karta | Elementów „solid" | Wartości `rgb()` |
|---|---|---|
| Tool | **1** | `rgb(15, 23, 42)` — „Startuj sesję", h36 w138 |
| Notification | 1 (+1 chip) | `rgb(15, 23, 42)` — „Otwórz dokument", h36 w174 · chip kodu `rgb(248, 250, 252)` |
| Interview | **0** | (tylko „AI" `rgb(248, 250, 252)` = `c-surface-raised`) |
| Decision | 1 (+2) | `rgb(15, 23, 42)` — „Zatwierdź decyzję", h36 w177 · „AI" + chip `rgb(248, 250, 252)` |
| Insight | 1 (+1 chip) | `rgb(15, 23, 42)` — „Konwertuj na inicjatywę", h36 w211 |
| Task | **0** | (tylko „AI" `rgb(248, 250, 252)`) |
| Initiative | **0** | — |

**Wniosek pozytywny:** tam gdzie primary JEST, jest **identyczny co do piksela i koloru**
na wszystkich czterech kartach — `rgb(15,23,42)` (light) / `rgb(244,247,251)` (dark,
zmierzone na Decision), h=36. Źródło: jedna stała `MENU_1_PRIMARY_CTA`
(`src/components/shared/ModuleMenu3.tsx:14`). **To akurat działa i nie wymaga naprawy.**

**Wniosek negatywny:** 3 karty z 7 mają **zero** primary. Reguła SPEC-N §2.3 („dokładnie
jeden") jest dziś łamana w jedną stronę na 43% kart.

Elementy `rgb(248,250,252)` (`c-surface-raised`: przycisk „AI", chip kodu, aktywny segment
N/C) formalnie mają alfę 1.0, ale to **powierzchnia, nie CTA** — nie konkurują wizualnie
z navy-900. Klasyfikuję jako uzasadnioną różnicę, nie defekt (patrz §5).

---

## 4. DEFEKTY — łamią kanon, z dowodem

### D1. Menu 1 nie ma wysokości 48 px na żadnej z 7 kart — i waha się 62↔77
**Dowód:** zmierzone `barH`: Tool 62 · Interview 62 · Task 62 · Initiative 62 ·
Notification 77 · Decision 77 · Insight 77. Kanon `ARTIFACT_ANATOMY_STANDARD.md:796` = **48**.
**Przyczyna:** `NModeHeader.tsx:130` — `className="flex items-center gap-4 px-5 py-3"`.
`py-3` (12+12) + treść 38 = 62. Kanonowe 48 wymaga `py-1.5` przy treści h-36.
Rozrzut 62↔77 to skutek D2 (przy 1440 px wszystkie wracają do 62 — nadal nie 48).
**@1440:** wada pozostaje (62 ≠ 48), rozrzut znika.

### D2. Chip kodu artefaktu zawija się na 3–4 linie i rozpycha cały pasek
**Dowód (Notification, 894 px):** chip `NOTIF-DBR77-DEMO-1` → w=66, **h=53** przy
foncie 10 px (≈4 linie). Insight: w=78, h=53. Decision: w=84, h=53.
To właśnie te trzy karty mają pasek 77 px zamiast 62.
**Przyczyna:** `NModeHeader.tsx:169` — chip nie ma `whitespace-nowrap` ani `shrink-0`.
**@1440:** h=23 (jedna linia) — **objaw znika**. Wada dotyczy szerokości < ~1200 px.

### D3. Kropka statusu zapada się do szerokości 0 px
**Dowód:** element istnieje w DOM z poprawnym kolorem, ale ma zerową szerokość —
Notification `bg-amber-400` = `rgb(234,155,32)`, **w=0**, h=12; Insight `bg-emerald-500`
= `rgb(82,165,46)`, **w=0**; Decision `bg-amber-500` = `rgb(232,125,30)`, **w=0** (dark).
Tool: w=**9** (ściśnięta z 12). Interview/Task/Initiative: w=12 (nienaruszona).
**Przyczyna:** `NModeHeader.tsx:143` — `<div className={\`w-3 h-3 rounded-full ${statusDotColor} shadow-lg\`} />`
jest dzieckiem flexa `flex-1 min-w-0` i **nie ma `shrink-0`**, więc flexbox ją zjada.
**@1440:** w=12 — objaw znika. Wada dotyczy szerokości < ~1200 px.
**Dlaczego to jest gorsze niż wygląda:** to jedyny nośnik statusu w Menu 1 (patrz D4),
więc na wąskim ekranie karta traci status całkowicie — i to **bez śladu**, bo element
nadal jest w DOM. Kod się nie skarży, test jednostkowy przechodzi, widać dopiero okiem.

### D4. Nie ma `④` status-lifecycle — jest niepodpisana kropka 12 px
**Dowód:** `NModeLayout/types.ts` — jedyne pole statusu w kontrakcie nagłówka to
`statusDotColor?: string` z komentarzem *„Status dot color CSS class (e.g. 'bg-emerald-400')"*.
Brak pola na etykietę. W żadnej z 7 kart nie zmierzyłem tekstu statusu w Menu 1.
**Skutek:** „Draft / Pending / Approved" nie jest w Menu 1 czytelne — użytkownik ma
rozróżnić stan po odcieniu kropki 12 px, bez legendy.

### D5. Kolory kropki statusu to surowa paleta Tailwind, nie tokeny `c-*`
**Dowód:** `bg-amber-400` (Notification) · `bg-blue-500` (Interview, Task) ·
`bg-amber-500` (Decision) · `bg-emerald-500` (Insight) · `bg-slate-400` (Initiative).
Wyjątek: **Tool** używa `bg-c-success` — jedyna karta na tokenie
(`KnownToolDetailView.tsx:1630`, z komentarzem tłumaczącym naprawę).
**Skutek:** brak wariantu `dark:` → ta sama surowa barwa w obu motywach; semantyka
statusu rozjeżdża się między kartami (Interview i Task = niebieski, ale to inne stany).

### D6. Tytuł jest ucinany bez wielokropka — na każdej szerokości
**Dowód (Insight):** `<input>` `scrollWidth=668`, `clientWidth=424` **@1440** →
`clipped: true`. `textOverflow: clip`, `whiteSpace: normal`. Notification: 668 vs 238 @894.
**Przyczyna:** `NModeHeader.tsx:144–162` — tytuł to `<input type="text">`. Input z natury
nie robi `text-overflow: ellipsis`; ucina w połowie znaku.
**Kanon** §11.2 mówi „tytuł inline L2 (klik→`⑤`input)" — czyli w spoczynku **tekst**
(z `truncate`), a input dopiero po kliknięciu. Dziś jest input zawsze.
**@1440:** wada pozostaje. To jedyny objaw zawężenia, który NIE znika na szerokim ekranie.

### D7. Wskaźnik zapisu jest przyciskiem akcji, nie wskaźnikiem — i skleja stan z akcją
**Dowód:** zmierzone na wszystkich 7 kartach — `<button>` h=38, w=120, tekst „Zapisano",
`font-semibold`, tło `rgba(241,245,249,0.7)`, z ikoną `circle-check`.
Kanon §11.2: „Zapisano •" **L5 `c.text-muted`** — tekst, nie kontrolka h-38.
**Przyczyna:** `NModeHeader.tsx:191–201` — jeden `<button>` niesie jednocześnie `saveCopy.label`
(stan: Zapisano/Zapisuję/Zapisz/Błąd) i `onClick={onSave}` (akcja).
**Skutek uboczny:** w stanie `dirty` przycisk zmienia etykietę na „Zapisz" i tło na
niebieskie — czyli **wskaźnik stanu zamienia się w drugi przycisk akcji obok primary**.
Zmierzone na Initiative: tło `rgba(101,120,180,0.1)` (wariant niebieski) przy etykiecie
„Zapisano" — stan i styl już dziś się rozjeżdżają.

### D8. `draftSavedLabel` — prop podawany przez 2 karty, nieistniejący w komponencie
**Dowód:** `NModeLayout/types.ts` deklaruje `draftSavedLabel?: string` z komentarzem
*„Deprecated: lifecycle/governance label. Do not use for persistence state."*
`NModeHeader.tsx:46–68` **nie destrukturyzuje** tego pola i nigdzie go nie renderuje.
Podają je mimo to: `DecisionDetailView.tsx:5288` i `TaskDetailView.tsx:4318`.
**Skutek:** znacznik czasu ostatniego zapisu na Decision i Task **nie renderuje się nigdy**;
`draftSavedLabel` liczone w `DecisionDetailView.tsx:1404` to martwy kod.
**To jest dokładnie przypadek z SPEC-N §2.7:** *„Deprecated propy powłoki muszą być martwe
typem (`never`), nie komentarzem"*. Komentarz nie powstrzymał dwóch kart.

### D9. Crimson w Menu 1 wszystkich 7 kart — poza zasięgiem bezpiecznika
**Dowód:** `src/components/shared/ArtifactPermalinkButton.tsx:40`
```
className={`p-1.5 rounded-md text-slate-600 hover:text-primary-400 hover:bg-primary-500/10 …`}
```
`primary-*` = crimson `#85182F` (CLAUDE.md, pułapka nr 1). Przycisk permalinku renderuje się
w Menu 1 **każdej** z 7 kart (zmierzony: w=26, h=26, obok chipu kodu).
**Dlaczego hook tego nie łapie:** `scripts/check-artefakt.sh` (`list_scope_files`) obejmuje
`NModeLayout/*`, `ExecutiveModuleShell/*`, `ArtifactRightPanel.tsx`, `IdeaMapWorkspace.tsx`.
`ArtifactPermalinkButton.tsx` leży w `src/components/shared/` — **poza zakresem**, mimo że
renderuje się wewnątrz powłoki. Luka w bezpieczniku, nie tylko w kodzie.

### D10. Ikona permalinku ma kontrast ~2.4:1 w ciemnym motywie
**Dowód:** zmierzone na `karta-decision&theme=dark` — `color: rgb(71,85,105)` na tle
`rgba(15,23,42,0.7)`. Kontrast ≈ **2.4:1** (próg dla elementów nietekstowych: 3:1).
**Przyczyna:** `ArtifactPermalinkButton.tsx:40` — `text-slate-600` bez wariantu `dark:`.

### D11. Interview: primary nie istnieje w kontrakcie — nie „znikł"
**Dowód:** `InterviewWorkspace.tsx:3010–3030` — blok `header={{…}}` zawiera `title`,
`onTitleChange`, `titlePlaceholder`, `artifactId`, `artifactType`, `onSave`, `saving`,
`isDirty`, `onChat`, `showChatButton`, `onClose`, `statusDotColor`. **Klucza `primaryAction`
nie ma w ogóle.** Zmierzone: 0 elementów CTA w Menu 1.

### D12. Task: każde otwarcie istniejącego zadania startuje BEZ primary
**Dowód — łańcuch dwóch linii:**
`TaskDetailView.tsx:684` → `const [readMode, setReadMode] = useState<boolean>(() => Boolean(taskId));`
`TaskDetailView.tsx:1536` → `if (readMode) return undefined;` (pierwsza linia `taskPrimaryAction`)
Czyli: `taskId` obecny ⇒ `readMode === true` ⇒ `primaryAction === undefined`.
**To nie jest artefakt mocka.** Mock ma `status: 'in_progress'`
(`dev-render/screens/karta-task.tsx:83`), dla którego `taskPrimaryAction` zwróciłby
„Wyślij do przeglądu" (`TaskDetailView.tsx` gałąź `status === 'in_progress'`) — blokuje
to wyłącznie `readMode`. **Każde** zadanie otwarte z listy wchodzi w ten stan.

### D13. Initiative: przycisk AI podpięty do niczego
**Dowód:** obie gałęzie nagłówka (`InitiativeDocumentView.tsx:9933` tryb `c`
i `:10451` tryb `n`) podają `onChat={handleOpenChat}`, ale **żadna nie podaje
`showChatButton`**. `NModeHeader.tsx:63` ma `showChatButton = false` jako domyślną,
a `:213` renderuje przycisk tylko przy `showChatButton && onChat`.
Zmierzone: w Menu 1 Initiative **nie ma** przycisku AI (jest na Interview/Decision/Task).
**To ten sam błąd, który naprawiono już raz** — komentarz w `InterviewWorkspace.tsx:3018–3025`
opisuje go słowo w słowo („MARTWE WPIECIE AI"). Naprawiono na Interview, przeoczono na Initiative.

---

## 5. UZASADNIONE RÓŻNICE — wyglądają na rozjazd, ale nim nie są

| Rzecz | Dlaczego to nie defekt |
|---|---|
| Różna **treść** primary (Startuj sesję / Otwórz dokument / Zatwierdź decyzję / Konwertuj na inicjatywę) | Kanon wymaga jednego slotu, nie jednej etykiety. §13.1 przypisuje primary per typ. Styl jest identyczny co do piksela — patrz §3 |
| Przycisk „AI" na Interview/Decision/Task, brak na Tool/Notification/Insight | Świadoma decyzja opisana w `types.ts` przy `showChatButton`: klasa S nie ma Menu 3, więc AI ląduje w nagłówku; karty z Menu 3 mają AI tam. **Wyjątek:** Initiative to złamanie, nie wybór — patrz D13 |
| Elementy `rgb(248,250,252)` z alfą 1.0 (chip kodu, AI, segment N/C) | To `c-surface-raised` — powierzchnia, nie CTA. Nie konkurują z navy-900. Formalnie „solid", wizualnie nie |
| Initiative ma **dwie** gałęzie nagłówka (tryb `n` i `c`) | Bloki `:9933` i `:10451` są **identyczne co do propów** (porównane linia po linii). Duplikacja kodu do sprzątnięcia, ale nie źródło rozjazdu wizualnego |

---

## 6. Czego NIE zweryfikowałem — luki w tej analizie

1. **Ciemny motyw zmierzyłem tylko na `karta-decision`.** Pozostałe 6 opieram na tym, że
   montują ten sam `NModeHeader`. Nie sprawdziłem okiem, czy któraś karta nie nakłada
   własnych klas `dark:` wyżej w drzewie.
2. **Wersja `lang=en` — nie sprawdzona wcale.** Wszystkie pomiary na `lang=pl`. Angielskie
   etykiety są krótsze, więc D2/D3 (zapadanie przy ciasnocie) mogą się zachowywać inaczej.
3. **Initiative — czy primary pojawia się w realnym runtime.** `primaryLifecycleAction`
   (`InitiativeDocumentView.tsx:1392`) pochodzi z `stripStatusActions`, karmionych
   `gateReadiness` z API. Harness zwraca `{data:[],items:[]}`, więc slot jest pusty.
   **Nie wiem, czy na żywej bazie jest tam akcja.** W przeciwieństwie do Task (D12), gdzie
   przyczyna jest lokalna i pewna — tu nie mam dowodu i nie zgaduję. Do sprawdzenia na demo.
4. **Szerokość 1440 px symulowałem przez DOM** (`root.style.width`), nie realnym viewportem.
   Reflow jest prawdziwy, ale media queries Tailwinda dalej widzą 894 px — więc kolumna
   „@1440" mówi o zachowaniu flexboxa, nie o pełnym układzie desktopowym.
5. **Nie uruchamiałem `check-artefakt.sh`** — zakres hooka odczytałem ze źródła
   (`list_scope_files`), nie z przebiegu.
6. **Nie sprawdziłem stanów innych niż spoczynkowy** (`saving`, `dirty`, `error`).
   D7 opisuje wariant `dirty` z lektury kodu + jednego pomiaru na Initiative, nie z pełnego przebiegu.

---

## 7. Do decyzji Piotra — wybory produktowe, nie rzemieślnicze

**P1. Czy kod artefaktu i permalink zostają w Menu 1?**
Kanon §11.2 ich nie przewiduje, a to one rozpychają pasek do 77 px (D2) i wnoszą crimson (D9)
oraz problem kontrastu (D10). Są na wszystkich 7 kartach, więc to świadomy dodatek, nie wypadek.
Trzy drogi: (a) zostają, dostają `shrink-0` + `whitespace-nowrap` i kanon dopisuje je jako slot
`[indeks]`; (b) schodzą do kebaba/prawego panelu; (c) zostaje sam permalink, kod znika.
*Moja rekomendacja: (a)* — „skopiuj kod obiektu" to realny nawyk w pracy doradczej, tylko dziś
jest źle zbudowany.

**P2. Czy status w Menu 1 ma być etykietą, czy zostaje kropką?**
Dziś kropka 12 px bez podpisu (D4), na wąskim ekranie zapadająca do zera (D3). Etykieta
(„Do przeglądu", „Zatwierdzona") kosztuje ~80–120 px szerokości paska. Kanon mówi
`④status-lifecycle`, co sugeruje pigułkę z tekstem.
*To wybór produktowy: czytelność stanu kontra ciasnota paska.*

**P3. Czy „Zapisano" ma pozostać klikalnym przyciskiem?**
Kanon chce tekstu L5 `c.text-muted` (D7). Przycisk daje ręczny zapis — ale przy autozapisie
(jest `onBlur` w `NModeHeader.tsx:149`) to głównie źródło hałasu obok primary.
*Pytanie: czy Piotr chce widoczny „Zapisz", czy ufamy autozapisowi i pokazujemy sam stan?*

**P4. Kolejność naprawy.** D3 + D12 + D13 to trzy jednolinijkowe poprawki
(`shrink-0`, warunek `readMode`, `showChatButton`) o największym stosunku efektu do ryzyka.
D6 (tytuł jako tekst z `truncate`, input po kliknięciu) to przebudowa jednego slotu.
D1/D7 zmieniają wygląd wszystkich 7 kart naraz — **wymagają zrzutów przed akceptem** (CLAUDE.md #7).

---

## 8. Jednozdaniowe podsumowanie dla Piotra

Menu 1 jest **jednym komponentem na 7 kart** — i to jest dobra wiadomość, bo naprawa jest
w jednym miejscu; rozjazd bierze się z sześciu opcjonalnych propów, z których każda karta
podaje inny podzbiór, oraz z tego, że pasek nie broni się przed ciasnotą: przy 894 px
kropka statusu ma **zero pikseli szerokości**, a chip kodu rozpycha pasek z 62 do 77 px.
