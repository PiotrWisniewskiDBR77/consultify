# J0 — bramka spójności językowej (ratchet)

Paczka J0 programu spójności językowej Consultify (`PLAN.md` §J0, mechanika: `POMIAR.md`).
Cel: od 2026-09-08 liczba obcojęzycznych miejsc w interfejsie **nie może rosnąć** —
ani w sumie, ani w żadnym module — dopóki nie ruszą paczki modułowe (J1–J20), które
dopiero *obniżają* dług. Narzędzie: `scripts/i18n/pomiar-jezyka.mjs`. Wyjątki i
słowniki: `scripts/i18n/pomiar-jezyka.wyjatki.json`. Liczby bazowe (zamrożone):
`baseline.json` obok tego pliku.

## 1. Jak to działa

Bramka to **zapadka (ratchet)**, nie próg absolutny: porównuje AKTUALNY stan repo
z `baseline.json` per **12 kategorii** (K1/K1def/K1defWID/K2/K3a/K3aKLUCZ/K3b/K4pl/
K4en/K5pl/K5en/K7 — znaczenie każdej: `POMIAR.md` §1) **i osobno per 17 modułów**
(16 z menu + „ZZ wspólne”). Blokuje, gdy **którakolwiek** liczba — sumaryczna albo
modułowa — jest wyższa niż w baseline. Spadek nigdy nie blokuje.

Powód sprawdzania per moduł, nie tylko sumy: gdyby liczyła się wyłącznie suma,
regresja w jednym module chowałaby się za niezwiązaną poprawą gdzieś indziej — to
dokładnie klasa błędu **K-41** opisana w `scripts/check-focus-canon.sh` („bezpiecznik
nagradza defekt”, ta sama lekcja co w pamięci programu). Ten sam mechanizm porównania
(`porownajZBaseline()` w `pomiar-jezyka.mjs`) jest współdzielony przez pełny skan i
tryb szybki, więc nie mogą się rozjechać.

Dwa tryby uruchomienia:

```bash
# pełny skan — chodzi po całym repo (src/**, server/src/**, public/locales/**).
# Używany w CI. ~7-8 s na tym repo.
node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json

# tryb szybki — liczy TYLKO pliki dotknięte w indeksie gita (git diff --cached).
# Używany w pre-commit. < 1 s w typowym commicie.
node scripts/i18n/pomiar-jezyka.mjs --baseline docs/program/JEZYK_EN_PL_20260908/baseline.json --staged
```

npm: `check:jezyk:ci` (pełny) / `check:jezyk:staged` (szybki) / `check:jezyk` (raport
bez bramki, tekstowy).

## 2. Tryb szybki (`--staged`) — dlaczego jest dokładny, nie przybliżony

Pełny skan zajmuje ~7-8 s na tym repo (~9 400 plików `.ts`/`.tsx` w `src/`+`server/src`)
— za wolno na commit (budżet < 5 s). Tryb szybki liczy **deltę**: dla każdego pliku
dotkniętego w commicie porównuje wynik tych samych detektorów na starej treści
(`git show HEAD:<plik>`) i nowej (working tree), i dokłada różnicę do `baseline.json`.

To jest **matematycznie dokładne**, nie przybliżenie — dla kategorii K1def/K1defWID/
K4pl/K4en/K5pl/K5en/K7 każde trafienie siedzi w jednym, konkretnym pliku. Jeśli
`baseline.json` trafnie opisuje stan HEAD, a zmienia się tylko treść dotkniętych
plików, to `baseline + Σ(delta dotkniętych plików)` daje dokładnie to, co dałby pełny
skan — bez potrzeby go uruchamiać.

**Wyjątek — kategorie zależne od CAŁEGO pliku tłumaczeń (K1/K2/K3a/K3aKLUCZ/K3b):**
klucz „jest/nie ma” w `public/locales/{en,pl}/*.json` to własność całego pliku, nie
jednej linii. Gdy commit dotyka `public/locales/en/**.json` albo `public/locales/pl/**.json`,
tryb szybki **spada na pełny skan** (wolniejszy, ale poprawny) zamiast zgadywać.

**Znana nieprecyzja (świadomie zaakceptowana, dotyczy tylko K3aKLUCZ):** ta
podkategoria pyta „czy dla tego klucza istnieje GDZIEKOLWIEK w kodzie `t(klucz, default)`”.
Tryb szybki sprawdza to tylko w plikach DOTKNIĘTYCH w commicie, nie w całym repo. Jeśli
`public/locales/pl/*.json` jest nietknięty (warunek fast-path), zbiór „kluczy PL bez
pary w EN” jest z definicji niezmieniony — jedyna luka to commit, który w tym samym
kroku usuwa/dodaje `t(ten_konkretny_klucz, default)` w pliku spoza commitu... czyli
w pliku, którego commit NIE dotyka — sprzeczność. Realne ryzyko: near-zero. K3aKLUCZ
jest też podkategorią (`⊂ K3a`), więc nie wchodzi do sumy RAZEM ani nie bramkuje sam
z siebie nic więcej niż K3a już bramkuje.

## 3. Jak dodać wyjątek

Edytuj **wyłącznie** `scripts/i18n/pomiar-jezyka.wyjatki.json` (nigdy sam skaner):

- `nazwyWlasne` — nazwy produktów/firm/skrótów technicznych, których NIE tłumaczymy
  w żadnej wersji językowej (Consultify, Teresa, KPI, SAP, PDF...). Dopisz tylko, gdy
  trafienie jest realnie nazwą własną — **nie** dopisuj, żeby „poprawić liczby”.
- `pomijaneWartosci` — wzorce regex wartości, które nigdy nie są ludzkim tekstem (URL,
  kod koloru, klucz i18n w stylu `SCREAMING_SNAKE`, placeholder `{{count}}`...).
- `pomijaneSciezki` — katalogi/pliki wyłączone ze skanu (testy, `dev-render/`, dane demo).
- `polskieSilne`/`polskieSlabe`/`angielskieSilne`/`angielskieSlabe` — słowniki. „Silne”
  słowo = 1 trafienie wystarczy; „słabe” = potrzeba 2 różnych, żeby uniknąć fałszywych
  trafień na pojedynczym rzeczowniku (np. „table”/„tabela” same nie flagują).

Po zmianie wyjątków **zawsze** przelicz baseline od zera (krok 4) — same wyjątki
zmieniają liczby (zwykle w dół), więc stary baseline stałby się fałszywie luźny.

## 4. Jak obniżyć baseline po naprawie (paczka modułowa J1–J20)

```bash
node scripts/i18n/pomiar-jezyka.mjs --json > docs/program/JEZYK_EN_PL_20260908/baseline.json
git add docs/program/JEZYK_EN_PL_20260908/baseline.json
git commit -m "..."   # w TYM SAMYM commicie co naprawa — nigdy osobno
```

Baseline wolno obniżać **wyłącznie w tym samym commicie co realna naprawa** (PLAN.md
§2 pkt 10). Commit, który tylko obniża baseline bez odpowiadającej naprawy w
`src/`/`server/src`/`public/locales/`, jest dokładnie tym, przed czym zapadka ma
chronić — nie rób tego.

## 5. Czego ta bramka NIE łapie (dolna granica — patrz POMIAR.md §6)

Ten sam komplet ograniczeń co samo narzędzie pomiaru, plus jedno własne ograniczenie
trybu szybkiego:

1. **Heurystyka słownikowa.** Krótkie etykiety bez diakrytyków i bez słowa ze słownika
   (np. „Portfel”, „Definicja”) nie są wykrywane. Bramka NIE jest dowodem „ekran jest
   po polsku/angielsku” — to miernik długu tekstowego w kodzie, nie wyrok wizualny.
   Odbiór ekranu nadal wymaga oczu (CLAUDE.md UI pkt 4).
2. **Nie widzi danych ani treści z serwera poza `routes/middleware/validators/schemas/controllers`**
   (K5 świadomie zawężone — POMIAR.md §6 pkt 6) i nie widzi treści generowanych przez AI
   w runtime (K9 — poza zakresem tego skanera, patrz POMIAR.md §5).
3. **Fałszywe trafienia w komentarzach kodu** — regex JSX (`>tekst<`) czasem łapie
   fragment komentarza `/* ... */` sąsiadującego z JSX (zmierzone: jeden przykład w
   `ChatHistorySidebar.tsx`). To nie jest błąd baseline — to szum w liczniku, który i
   tak tylko rośnie/maleje razem z resztą kategorii; nie wymaga wpisu do wyjątków
   (nie da się wykluczyć „tekstu w komentarzu” przez listę wartości).
4. **Tryb szybki nie chroni przed ręcznie zepsutym/postarzałym `baseline.json`** —
   jeśli ktoś ręcznie obniży liczbę w pliku bez odpowiadającej naprawy, a commit nie
   dotyka żadnego pliku źródłowego, `--staged` przepuści to bez ostrzeżenia (nic się
   nie zmieniło w skanowanych plikach). Pełny skan w CI złapie to przy najbliższym
   pushu/PR — to jest siatka bezpieczeństwa dla tego przypadku, nie pre-commit.
5. **K6 (dane pokazowe), K8 (maile/PDF/DOCX), K9 (język odpowiedzi AI)** — mierzone
   osobno / w ogóle niemierzone tym narzędziem, patrz POMIAR.md §5. Zero wzrostu w tej
   bramce nie znaczy „zero polskiego w mailu resetu hasła po angielsku”.

## 6. Gdzie jest podpięta

- **Pre-commit:** `.husky/pre-commit`, blok 14 (ostatni). Tryb `--staged` — tani
  nawet gdy commit nie dotyka `src`/`server/src` wcale (< 0,2 s zmierzone; zob. §7).
- **CI:** `.github/workflows/test-suite.yml`, job `lint-typecheck` (ten sam job co
  `check:triada:all`/`check:list-canon`/`check:artefakt`/`verify:canonical-16`), krok
  „Language consistency ratchet gate” — pełny skan (`check:jezyk:ci`).
- **Nie** w `.github/workflows/i18n-check.yml` — ten plik to osobny, starszy mechanizm
  (brakujące klucze `en/translation.json` + auto-tłumaczenie), inny zakres, celowo
  nietknięty.
- **Nie** w `railway-deploy.yml` (zgodnie z instrukcją zlecenia).

## 7. Zmierzony czas

| Scenariusz | Czas |
| --- | --- |
| Pełny skan (`--baseline`, bez `--staged`) | ~7-8 s (user CPU), na tym repo ~9 400 plików `.ts`/`.tsx` |
| Tryb szybki, 0 dotkniętych plików `.ts`/`.tsx` | ~0,1-0,2 s |
| Tryb szybki, 1 dotknięty plik (nowy, ~5 linijek) | ~0,2-0,9 s |

Pre-commit budżetuje < 5 s na krok — tryb szybki mieści się z dużym zapasem w typowym
commicie (0-kilka dotkniętych plików źródłowych). Pełny hook chain (wszystkie ~14
bloków `.husky/pre-commit` razem) bywa znacznie wolniejszy przy obciążonym systemie
(inne procesy `tsc`/`vite` na maszynie) — to nie jest koszt TEGO kroku, zmierzone
osobno przez `time node scripts/i18n/pomiar-jezyka.mjs --baseline ... --staged`.
