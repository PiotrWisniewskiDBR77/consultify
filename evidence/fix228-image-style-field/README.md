# FIX-228 pkt 3 — dowód zrzutowy pola „Styl obrazu"

Pole „Styl obrazu" (`PresentationTemplateArchitectView.tsx`) było bez flagi i bez
akceptu wizualnego (ODBIOR_228.md, FIX-y wymagane, pkt 3). Naprawa: pole za nową
flagą `presentationImageStyleUiV1` (domyślnie OFF, `src/hooks/usePresentationImageStyleUiFlag.ts`),
zrzuty poniżej zrobione przez `dev-render/screens/day228-image-style-field.tsx`
(mock API, bez logowania, bez backendu — CLAUDE.md #7).

Renderer: rzeczywisty `<PresentationTemplateArchitectView>`, szablon szkicowy
`Steering Committee Deck Template` z mockowym `layout_policy_json.imageStylePrompt`
(dev-render/mocks/presentationTemplateArchitectMocks.ts), więc pole widać
wypełnione, nie puste.

## Zrzuty

- `image-style-field-on-light.png` — flaga ON, motyw jasny. `mean_luma = 242.23`
- `image-style-field-on-dark.png` — flaga ON, motyw ciemny. `mean_luma = 35.80`
- `image-style-field-off-light.png` — flaga OFF (wartość domyślna). Pole
  „Styl obrazu" nieobecne w DOM (sprawdzone programowo:
  `querySelectorAll('span,label')` po całym dokumencie nie zwraca dopasowania
  do tekstu „Styl obrazu”, nie tylko poza kadrem przewijania).

## Bezpiecznik duplikatu (CLAUDE.md — „Duplikat zamiast motywu")

`|mean_luma(light) - mean_luma(dark)| = 206.43` (próg bramki: > 15) — para
jasny/ciemny jest realnie różna, nie tym samym obrazem pod dwiema nazwami.

## Jak odtworzyć

```
npx vite --config dev-render/vite.config.ts --port 6700 --strictPort
# potem http://localhost:6700/?screen=day228-image-style-field&scene=on&theme=light
#                                                              &scene=on&theme=dark
#                                                              &scene=off&theme=light
```
`&scene=off` ustawia `presentationImageStyleUiV1=false` w
`localStorage.consultify_feature_flags` (fresh browser context — jak
`ap-client-flag-off-screenshots.mjs`), `&scene=on` ustawia `true`. Kliknij
wiersz „Steering Committee Deck Template" w rejestrze szablonów, żeby otworzyć
edytor konspektu.
