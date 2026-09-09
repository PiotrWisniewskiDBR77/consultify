# Dowód wzrokiem — paczka J-DOG-B (2026-09-09)

Stanowisko: `consultify_kopia_d26` (Postgres 18, port 54418), API na porcie 4207,
Vite na porcie 3225. Konto: `admin@dbr77.com` (istniejący SUPERADMIN w kopii;
`audyt@dbr77.local` nie istniał w tej kopii, więc odbiór zrobiono na koncie
superadmina już obecnym w bazie — hasło ustawione na ten sam hash z instrukcji).
Skrypt zrzutów: `scripts/dev/jezyk-jdog-b-zrzuty.mjs` (wzór: J15/J16 — ten sam
detektor co `scripts/i18n/pomiar-jezyka.mjs`).

## Ekrany i wynik

| # | Ekran | Plik(i) naprawione | EN: polskich napisów UI | PL: angielskich napisów UI |
|---|---|---|---|---|
| 02 | AI Platform → Configuration → LLM Providers → **Add Provider** | `LLMManagementView.tsx` | **1** (patrz niżej) | 0 |
| 03 | `/app/pricing` — cała strona | `AppPricingView.tsx` | **1** (patrz niżej) | 0 |

Pliki: `po/02-llm-add-provider-{en,pl}.png`, `po/03-app-pricing-{en,pl}.png`,
liczniki surowe w `po/liczniki-{en,pl}.json`.

**Jedyny polski napis znaleziony na koncie angielskim w OBU ekranach to
„Środowisko LOCAL"** — plakietka środowiska (`src/components/layout/
EnvironmentBadge.tsx`), widoczna w prawym dolnym rogu KAŻDEGO ekranu appki,
niezależnie od modułu. To WYŁĄCZNA własność równoległej paczki J-DOG-A
(zakaz dotykania w instrukcji tej paczki) — nie jest to defekt w plikach,
które naprawiałem, i nie mam do niego dostępu. Poza tym jednym, wspólnym
elementem: **zero** polskiego na koncie angielskim, **zero** angielskiego
na koncie polskim, na obu zrzuconych ekranach.

### 02 — LLM Providers → Add Provider

Naprawiony fragment (pole „Model ID"):
- PRZED (stan `c076e94405`, ustalony przeglądem kodu, nie zrzutem — patrz
  „Brak PRZED" niżej): opcja listy `↳ custom (wpisz poniżej)` i placeholder
  `lub wpisz własne ID modelu` — surowy polski, WIDOCZNY na koncie angielskim,
  bo plik nie miał w ogóle `useTranslation`.
- PO (ten zrzut): `↳ custom (enter below)` / `or enter your own model ID` na
  koncie EN; `↳ custom (wpisz poniżej)` / `lub wpisz własne ID modelu` na
  koncie PL (klucz istnieje w obu plikach tłumaczeń, treść identyczna z
  oryginałem — PL nie zmienił się ani o jeden znak).

### 03 — `/app/pricing` (AppPricingView.tsx)

Cały ekran (hero, 3 karty taryf, sekcja AI Credits, 6 pytań FAQ, CTA końcowe)
był na sztywno po polsku bez `useTranslation` w ogóle. Zrzut PO pokazuje
kompletnie angielski ekran na koncie EN (`03-app-pricing-en.png`) i
kompletnie polski na koncie PL (`03-app-pricing-pl.png`, 14 poprawnych
polskich napisów licznika — dokładnie tyle, ile powinno być, PL nie
uszkodzony).

## Ekran POMINIĘTY w automatycznym zrzucie: Billing Center → Analytics

`SubscriptionAnalytics.tsx` (26 z 33 napraw K1defWID/K1def tej paczki) jest
osiągalny z `Command Center → Commercial → Billing → Analytics` w Super Admin
Console. Trzy próby automatycznego dotarcia tam skryptem Playwright (bezpośredni
`goto` na `/superadmin/revenue`, potem klikanie przez zakładki) za każdym razem
lądowały na INNYM ekranie o tej samej etykiecie „Analytics" (w module Users —
zagnieżdżone drzewo zakładek ma kilka kontrolek o nazwie „Analytics" i
„Commercial"/„Billing", i selektor tekstowy trafiał nie tam, gdzie trzeba).
Zamiast fałszywego zrzutu (dowód pokazujący zły ekran to gorsza sytuacja niż
brak dowodu — „Nie pisz własnego zrzutu obok kanonicznego") — **zweryfikowano
ręcznie w tej samej sesji** (interaktywne narzędzie przeglądarki, nie
Playwright): `Command Center → Commercial → Billing → Analytics` pokazuje
czysto po angielsku „Revenue analytics coming soon / MRR, churn, cohort and
expansion analytics are not available yet. They will appear here once
self-serve billing is enabled." — bez żadnego polskiego napisu.

To jest CAŁA treść tego ekranu widoczna bez flagi: `SubscriptionAnalytics.tsx`
renderuje ten placeholder, gdy `isBillingSelfServeEnabled()` (domyślnie OFF),
i dopiero za tą flagą pokazuje 33 naprawione klucze (`mrrLabel`, `churnRate`,
`arpaLabel`, `revenueByPlan`, ...). **Reguła 7 CLAUDE.md zakazuje włączania
flagi wizualnej jako pierwszego sprawdzenia** — więc te 33 klucze świadomie
NIE mają zrzutu z prawdziwymi danymi w tej paczce. Dowód, że są naprawione:

1. **Pomiar** `node scripts/i18n/pomiar-jezyka.mjs --modul "14 Admin Panel"`:
   K1def 33→0, K1defWID 26→0 (patrz commit `62682dfeeb`).
2. **Bezpiecznik źródłowy** `src/components/billing/__tests__/jezykJdogB.source.test.ts`
   czyta plik źródłowy wprost (nie render) i sprawdza brak polskiego
   `defaultValue` w `t()` — mutacja RED→GREEN udokumentowana w komentarzu
   pliku, potwierdzona w tej sesji.

## Brak zrzutu "PRZED"

Ta sesja nie zrobiła zrzutu stanu SPRZED naprawy (praca zaczęła się od razu
od poprawek kodu, nie od zrzutu bazowego) — uczciwie odnotowane, nie
udawane. Dowód stanu PRZED to: (a) pomiar `pomiar-jezyka.mjs` na
`c076e94405` (tabela w instrukcji nadzorcy, zweryfikowana w KROKU 0 —
zgadzała się co do liczby), (b) treść kodu w commitach (widoczna w `git show
c076e94405:...` dla każdego naprawionego pliku), (c) mutacja bezpiecznika
źródłowego (cofnięcie jednej naprawy → RED, opisane w pliku testu).

## Sprzątanie

Konto `admin@dbr77.com` w kopii `consultify_kopia_d26` zostało z powrotem
ustawione na `language='en'` po zrzutach (patrz koniec skryptu). Hasło
(hash z instrukcji) zostaje w kopii — kopia jest usuwana na końcu paczki
(`dropdb consultify_kopia_d26`), więc nie ma ryzyka trwałego dostępu.
