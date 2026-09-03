# G06 — naprawa dostępności (axe), moduł 15_SETTINGS — 2026-09-03

Robotnik: agent naprawczy G06, gałąź `agent/fix-a11y-13-16-20260903`,
worktree `/private/tmp/ag-fix-a11y-13-16` (baza: `origin/demo` przez `/private/tmp/m03`).

## 1. Wynik: kadry z realnym naruszeniem (reguły poza `landmark-one-main`,
   `page-has-heading-one`, `region` — te trzy to szum hosta dev-render)

| Faza | Ekranów | Kadrów (theme×lang) | Kadrów z naruszeniem |
|---|---|---|---|
| PRZED (pl, 1440, light+dark) | 9 | 18 | 15/18 |
| PO (pl, 1440, light+dark) | 9 | 18 | **0/18** |
| PO (en, 1024, light+dark) | 9 | 18 | **0/18** |

## 2. Mapa: reguła → komponent → plik

| Reguła axe | Ekrany (PRZED) | Komponent | Plik | Naprawa |
|---|---|---|---|---|
| `heading-order` (6/9) | calendar-sync, ai-automatyzacja, dane-prywatnosc, integracje, powiadomienia, wyglad | **Przyczyna wspólna**: `DomainScreenHeader` (`<h1>` tytułu strony) poprzedza wprost tytuł panelu `SettingsSection` renderowany jako `<h3>` (skok h1→h3, pomijając h2). `CalendarSyncSettings`/`ConnectedAppsSettings` mają WŁASNY inline `<h3>` z tym samym problemem, poza `SettingsSection`. | `src/components/settings/shared/SettingsSection.tsx` (tytuł sekcji: h3→h2), `src/components/settings/CalendarSyncSettings.tsx`, `src/components/settings/ConnectedAppsSettings.tsx` (własne h3→h2). Kaskadowo podniesiono też podtytuły `h4→h3` w `AIBehaviorSettings.tsx`, `DataControlsSettings.tsx`, `NotificationSettings.tsx`, `CalendarSyncSettings.tsx`, `ConnectedAppsSettings.tsx` — inaczej promocja h3→h2 tworzyłaby NOWY skok h2→h4. |
| `color-contrast` (4/9, ale 6 kadrów: 2 ekrany mają naruszenie tylko w jednym motywie) | calendar-sync (light), integracje (light+dark), powiadomienia (light), wyglad (dark) | Odznaki statusu integracji (`text-green-600` na `bg-green-50/100`, 3.7–4.22:1), przycisk „Odłącz" (`text-danger-600` na ciemnym tle, 2.77:1), masowe akcje „Włącz wszystkie"/„Minimalne" (`text-emerald-400`/`text-amber-400` BEZ `dark:`, 1.74–1.98:1 w light), etykieta wybranego motywu (`text-c-accent` = kolor marki WYBRANY PRZEZ UŻYTKOWNIKA, 3.09:1 w tym konkretnym demo-kolorze) | `CalendarSyncSettings.tsx`, `ConnectedAppsSettings.tsx`, `NotificationSettings.tsx`, `ThemeSettings.tsx` | `text-green-600`→`text-green-700` (dark zostaje `-400`, już przechodził); `text-danger-600`→ dodano `dark:text-danger-400`; `text-emerald-400`/`text-amber-400`→`text-emerald-700 dark:text-emerald-400` / `text-amber-800 dark:text-amber-400`; `text-c-accent` (kolor USTAWIALNY przez użytkownika, kontrast niegwarantowalny) → `text-c-text` na etykiecie wyboru motywu/gęstości — stan zaznaczenia nadal czytelny przez ramkę + plakietkę ✓, nie tylko kolor |
| `button-name` (2/9 — **rejestr podawał 4/9, mój pomiar 2/9, wiąże pomiar**) | powiadomienia (8 węzłów), workflow (6 węzłów) | `NotificationToggle` (własny przełącznik lokalny w `NotificationSettings.tsx`, bez `aria-label`); 3 przełączniki w `DashboardPreferencesSettings.tsx` (widgety×4, tryb kompaktowy, powitanie) bez `role`/`aria-checked`/`aria-label` | `src/components/settings/NotificationSettings.tsx`, `src/components/settings/DashboardPreferencesSettings.tsx` | Dodano `aria-label` (kompozytowy „{tytuł wiersza} — {kanał}" dla powiadomień; opisowy dla dashboardu) + `role="switch"`/`aria-checked` gdzie brakowało |
| `select-name` (1/9) | ai-automatyzacja (3 węzły) | `SettingsFormRow`+`SettingsSelect` bez powiązania `htmlFor`/`id` (Tone, Verbosity, Max Context Length) | `src/components/settings/AIBehaviorSettings.tsx` | Dodano jawne pary `id`/`htmlFor` per pole |
| `label` (2/9) | calendar-sync (2 węzły), zaawansowane (1 węzeł) | Przełączniki sync (checkbox `sr-only` w `<label>` bez tekstu — label opakowuje tylko wizualny tor, tekst jest w sąsiednim `<p>`); checkbox „Zaznacz wszystko" bez `<label>`/`aria-label` w eksporcie ustawień | `src/components/settings/CalendarSyncSettings.tsx`, `src/components/settings/advanced/SettingsExportImport.tsx` | `aria-label` na `<input>` z tekstem odpowiadającym sąsiedniemu opisowi |

## 3. Komendy pomiaru (kanoniczne, `scripts/dev/grafika-zrzuty.mjs`)

```
EKRANY="calendar-sync-settings,ustawienia-ai-automatyzacja,ustawienia-dane-prywatnosc,ustawienia-integracje,ustawienia-personalne,ustawienia-powiadomienia,ustawienia-workflow,ustawienia-wyglad,ustawienia-zaawansowane"

# PRZED
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5332 --ekrany=$EKRANY \
  --katalog=15_SETTINGS-przed --faza=PRZED --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/przed-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/przed-pl-1440/wynik.json

# PO (pl, 1440)
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5332 --ekrany=$EKRANY \
  --katalog=15_SETTINGS-po --faza=PO --jezyk=pl --szerokosc=1440 --motywy=light,dark \
  --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/po-pl-1440 \
  --wynik-json=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/po-pl-1440/wynik.json

# PO (en, 1024)
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5332 --ekrany=$EKRANY \
  --katalog=15_SETTINGS-po-en --faza=PO --jezyk=en --szerokosc=1024 --motywy=light,dark \
  --rozwin-sekcje=1 --a11y=1 \
  --wyjscie=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/po-en-1024 \
  --wynik-json=/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/po-en-1024/wynik.json
```

Diagnostyka lokalizacji naruszeń (selektor+html): jednorazowy pomocniczy skrypt
Playwright+axe uruchamiany z tego samego serwera dev, **nie jest częścią oficjalnego
pomiaru PRZED/PO** i nie wszedł do repo.

Surowe dane (poza repo): `/private/tmp/ag-fix-a11y-13-16-artefakty/15_SETTINGS/{przed-pl-1440,po-pl-1440,po-en-1024}/`

## 4. Rozbieżność z podpowiedziami z rejestru (pkt 2 instrukcji)

- `heading-order` 6/9 — zgadza się z rejestrem.
- `button-name` — **rejestr podawał 4/9, zmierzono 2/9** (powiadomienia, workflow).
  Zgodnie z zasadą „mój pomiar rozstrzyga" naprawiono te dwa realnie zmierzone; nie
  szukano sztucznie dwóch dodatkowych ekranów, żeby dopasować liczbę do rejestru.
- `color-contrast` 4/9 — zgadza się (calendar-sync, integracje, powiadomienia, wyglad).
- `label` 2/9 — zgadza się (calendar-sync, zaawansowane).
- `select-name` 1/9 — zgadza się (ai-automatyzacja).

## 5. Co nie zostało naprawione i dlaczego

Wszystkie zmierzone realne naruszenia (poza trzema regułami szumu hosta) są zamknięte.
`ustawienia-personalne` był już czysty w PRZED (0 naruszeń) — nietknięty.

## 6. Pliki produktu zmienione

- `src/components/settings/shared/SettingsSection.tsx` (współdzielony nagłówek sekcji)
- `src/components/settings/CalendarSyncSettings.tsx`
- `src/components/settings/ConnectedAppsSettings.tsx`
- `src/components/settings/AIBehaviorSettings.tsx`
- `src/components/settings/DataControlsSettings.tsx`
- `src/components/settings/NotificationSettings.tsx`
- `src/components/settings/ThemeSettings.tsx`
- `src/components/settings/DashboardPreferencesSettings.tsx`
- `src/components/settings/advanced/SettingsExportImport.tsx`

Uwaga architektoniczna: `SettingsSection.tsx` jest współdzielony przez WIĘCEJ paneli
Ustawień niż 9 zmierzonych w tym dyżurze (cały moduł Settings ma ~40 sekcji). Naprawa
h3→h2 w tym jednym miejscu zamyka regułę na wszystkich konsumentach jednocześnie —
zgodnie z zasadą „napraw w komponencie, nie w ekranie". Nie zmierzono pozostałych
paneli spoza 9 ekranów G06 tego dyżuru; jeśli mają własne h4 bezpośrednio pod tytułem
sekcji (analogicznie do 3 poprawionych tu), również skorzystają automatycznie —
w przeciwnym razie mogłyby (teoretycznie) ujawnić nowy skok h2→h4 przy przyszłym
pomiarze pełnego modułu Ustawień; wart osobnej weryfikacji przy pełnej fali G06.
