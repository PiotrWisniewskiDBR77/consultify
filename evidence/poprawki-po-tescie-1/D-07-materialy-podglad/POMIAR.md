# D-07 — Materiały → podgląd: jedno naprawione, jedno obalone

## 1. Blok DETAILS bez separatorów — NAPRAWIONE W KANONIE
„Owner: Daniel Osei Slides: 6 Updated: Sep 8, 2026" — trzy pola sklejone
w jedno zdanie. To NIE był defekt ekranu Materiałów: wołacz buduje treść
poprawnie, jako `['Owner: …', 'Slides: …', 'Updated: …'].join('\n')`.

Przyczyna leżała w kanonie podglądu: `PreviewDetailsSection` renderuje treść
przez `ReactMarkdown`, a w CommonMark POJEDYNCZY znak nowej linii jest
„miękkim złamaniem" i renderuje się jako **spacja**. Każdy ekran, który
podaje treść w ten sposób, dostawał to samo sklejenie — nie tylko Materiały.

Naprawa jest jedna, w miejscu wspólnym: pojedyncze złamania zamieniane na
twarde (markdownowe „dwie spacje przed nową linią"). Puste linie (akapity)
i teksty z blokiem kodu zostają nietknięte. Test + dowód mutacyjny:
`src/components/shared/PreviewPane/__tests__/PreviewDetailsSection.lamanieLinii.test.tsx`.

Pomiar po: podgląd rysuje trzy osobne wiersze („Owner: Daniel Osei" /
„Slides: 6" / „Updated: Sep 8, 2026").

## 2. „Attention Required na czerwono = crimson poza semantyką krytyczną" — PREMISA OBALONA
Zarzut powoływał się na CLAUDE.md §3 („primary = crimson #85182F, czerwień
tylko semantyka krytyczna"). Zmierzone w `tailwind.config.js`:

| token | wartość |
|---|---|
| `primary.DEFAULT` (crimson, zakazany poza semantyką krytyczną) | `#85182F` |
| `danger.DEFAULT` (semantyczna czerwień sygnałowa) | `#E80538` |

Plakietka używa `danger-*`, nie `primary-*` — **to nie jest crimson** i hooki
(`check-triada`, `check-artefakt`) słusznie jej nie blokują.

Dodatkowo wygląd jest SPÓJNY, nie odstający: `attention_required` renderuje
się tym samym tonem `danger` w `TrustStatePreviewSection` (zakładki
All/Documents/Sheets) i w pigułce Prezentacji — a ta spójność była świadomą
naprawą z 27.07.2026 („jedno źródło etykiety = jeden wygląd").

CO ZOSTAJE DO DECYZJI WŁAŚCICIELA (nie naprawiam sam): czy stan „wymaga
uwagi" ma być czerwony (`danger`), czy bursztynowy (`warning`) — jak
`pending` i `in_review` obok. Argument za bursztynem: talia ma status „Ready",
a czerwień mówi „zepsute", nie „przejrzyj". To zmiana wyglądu na CZTERECH
zakładkach naraz, więc zgodnie z CLAUDE.md §7 wymaga akceptu na zrzutach —
nie robię jej przy okazji naprawy językowej.
