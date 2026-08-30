---
doc_id: funkcje-odbior-135
status: evidence
truth_type: work-status
established: 2026-08-30
---

# Odbiór adwersaryjny — dyżur 135 (panele wyceny finansowej)

**Werdykt: `B` — działa z nazwanymi ograniczeniami. SCALONY.**
**Jakość dowodu najwyższa z czterech dyżurów tego dnia** — to jedyny, który
dostarczył realny dowód przez `ApiGateway` z podpisanym tokenem i żywym Postgresem.

## Co potwierdził nadzorca własnymi rękami

| Bramka | Wynik pomiaru nadzorcy |
| --- | --- |
| licencja | **6 plików, wszystkie z tabeli**; zero zmian w trasach, `FeatureFlags.ts`, migracjach, `.env*` |
| `B2` flaga OFF | powłoka zwraca `null` przy OFF; **marker 121/121, HEAD 123/123** — różnica to dokładnie nowy test. **Zero regresji** |
| `B3` mutacja | wymusiłem `return false` w fladze → **1 czerwony / 1 zielony**, przypadek `renders real valuation panels when explicitly enabled`. Zgadza się z raportem co do nazwy |
| `B5`/`R4` | **przeczytałem log**: `DB_IDENTITY … 127.0.0.1:6018/cx135`, potem **19 wierszy** `{"status":200,"hasData":true,"error":null}` — od `/monte-carlo-npv` po `/capital-decision/rank`. To jest realny dowód, nie twierdzenie |
| `B7` flaga | `query ?? localStorage ?? env ?? false`, `catch` → `false`. **Fail-closed, default OFF** |
| tokeny | powłoka używa `border-c-border`, `bg-c-surface`, `text-c-text` — **zero crimsonu** |

## ★ Korekta wykonawcy przyjęta — moja liczba była węższa

Wpisałem do rejestru „19 z 21 paneli nierenderowanych". Wykonawca podał **20**.
Przeliczyłem: 19 paneli ma **zero wystąpień**, jeden (`InvestmentAppraisalPanel`)
występuje **wyłącznie we własnym teście**. Test nie jest renderem, więc liczba
paneli bez renderu w produkcie to **20**. **Wykonawca ma rację, poprawiam u siebie.**

## ★★ Mój piąty błąd autorski — dziewiętnaście tras nie znaczy dziewiętnaście paneli

Instrukcja i plan sugerowały, że 19 tras `finance-valuation.routes.ts` obsługuje
te panele. **Nieprawda.** Inwentarz `R1` pokazuje, że ta rodzina tras obsługuje
**pięć paneli**. Pozostałe szesnaście należy do **innych rodzin backendu**:
`finance/value-tracking/*`, `finance-planning/*`, `finance-intelligence/*`,
`finance/value/*`. Wyprowadziłem odwzorowanie jeden-do-jednego z dwóch liczb,
które przypadkiem stały obok siebie.

**Skutek dla planu:** pozycja „19 paneli + 19 tras" w strumieniu uruchomień jest
myląca. Realny stan: **5 paneli gotowych do podpięcia teraz**, 16 wymaga
osobnego pomiaru per rodzina tras.

## ★★ Co zobaczyłem na zrzutach — reguła 7, patrzę pierwszy

Obejrzałem `monte-carlo.png` i `sensitivity.png`. Ekrany są **czyste**: polskie
nagłówki, neutralna paleta, zero crimsonu, czytelny formularz, jasny motyw.

**Ale zrzuty pokazują wyłącznie formularze wejściowe, nigdy wyniku.**
Monte Carlo kończy się zdaniem „Ustaw drivery i uruchom symulację, aby zobaczyć
rozkład NPV"; wrażliwość — „Dodaj drivery i uruchom tornado" oraz „Ustaw drivery
X/Y … uruchom heatmapę". Harness wypełnia **wejścia** (`state=populated` odnosi
się do nich uczciwie), ale **nie uruchamia obliczenia**.

**Konsekwencja:** ani jednego wykresu, histogramu ani heatmapy nie widać.
To znaczy, że **te zrzuty nie wystarczą właścicielowi do odbioru wizualnego** —
najciekawsza część panelu, czyli wynik, nie została uchwycona.

Drobiazgi językowe do toru grafiki: etykieta `Driver` i przycisk `+ driver`
zostały po angielsku w polskim ekranie; opis używa formy „driverów".

## Ograniczenia nazwane — powód oceny `B`

1. **Zrzuty bez wyników** (wyżej). Dopóki harness nie uruchomi obliczenia,
   odbiór wizualny paneli jest niewykonalny.
2. **Podpięto 5 z 21 paneli.** To nie jest wada wykonania — to uczciwa odpowiedź
   na pytanie „które mają komplet `W1`–`W3` wobec tej rodziny tras".
3. **Globalny `tsc --noEmit` nie przeszedł** — Node skończył się brakiem pamięci.
   Wykonawca **nie zamienił tego na `PASS`**, tylko oznaczył `NOT_PROVEN`. Poprawnie.
4. **Powłoka jest nową powierzchnią wizualną** (pasek zakładek paneli). Wymaga
   odbioru toru grafiki przed włączeniem flagi.

## Warunek włączenia flagi `VITE_FINANCE_VALUE_PANELS`

Nie włączać, dopóki: harness nie pokaże **wyników**, tor grafiki nie odbierze
powłoki i etykiet, a właściciel nie zaakceptuje czystych zrzutów. Reguła 7.

## Uwaga procesowa — kolizja w worktree integracyjnym

Scalenie wykonano w **osobnym, czystym klonie**, bo w `/private/tmp/m03` tor
grafiki miał w tej chwili **86 niezacommitowanych plików** (57 zaindeksowanych
zrzutów). Merge w tym stanie nadpisałby jego pracę. **Zasada na przyszłość:
przy dwóch torach w jednym worktree scalanie robimy z boku, nigdy na cudzym
niezacommitowanym stanie.**
