# Wybór modelu generacji deliverable (M17–M20) — kuratorowana lista

> **Cel:** produkcja na tanich, szybkich, mocnych modelach (głównie chińskich), bez płacenia za Opus/Sonnet. Mechanizm = 2 zmienne env, bez zmiany kodu. Default = najlepszy stosunek jakość/koszt.
>
> **Mechanizm** (`deliverableModelConfig()` w `server/src/services/deliverableGenerationTier.ts`, wpięty w deck/doc/table/B3):
> ```
> DELIVERABLE_LLM_PROVIDER=openrouter
> DELIVERABLE_LLM_MODEL=qwen/qwen3-235b-a22b-2507
> ```
> Gdy nieustawione → fallback `{id:'premium'}` (Anthropic PREMIUM tier). Klucz providera czytany z env przez `llmService.getProviderSync` (mamy `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `ZAI_API_KEY` na stagingu — OpenRouter odblokowuje wszystkie).

## Bake-off na żywo (2026-06-23, scenariusz Med deck+doc+table, scoring FT-6)

| Model (slug OpenRouter) | Doc | Tabela | Deck | **Śr.** | doc-latency | $ in / out (Mtok) | Werdykt |
|---|---|---|---|---|---|---|---|
| `qwen/qwen3-235b-a22b-2507` | 100 | 100 | 75 | **92%** | 38s | **$0.09 / $0.10** | ✅ **DEFAULT** — najtańszy, najszybszy, top jakość |
| `deepseek/deepseek-v3.2` | 100 | 100 | 75 | **92%** | 79s | $0.23 / $0.34 | ✅ alternatywa premium-tania |
| `z-ai/glm-5.2` | 100 | 100 | 67 | **89%** | 70s | $0.98 / $3.08 | ✅ mocny, droższy (deck słabszy) |
| `deepseek/deepseek-v4-pro` | 83 | 89 | 75 | 82% | 142s | $0.43 / $0.87 | ⚠️ wolny, słabszy na structured niż V3.2 |
| `moonshotai/kimi-k2.6` | 83 | 89 | 75 | 82% | 356s | $0.66 / $3.41 | ⚠️ bardzo wolny |
| `minimax/minimax-m2.5` | 83 | 100 | 58 | 80% | 52s | $0.15 / $0.9 | ⚠️ deck słaby |
| `anthropic/claude-sonnet-4-6` | ~92 | ~86 | ~85 | ~88% | — | $3 / $15 | ❌ drogi — NIE używać w produkcji |
| ❌ `deepseek-chat` (stary), `glm-4.6` | — | — | — | <50% | — | — | structured pada — odrzucone |

**Default produkcyjny: `openrouter / qwen/qwen3-235b-a22b-2507`** — jakość Sonneta za ~1/100 ceny output, najszybszy.

**Uwagi:**
- Deck słaby u wszystkich (58–75%) = surowość kryteriów decka (exact-name layoutów + proxy tytułu), nie wina modelu. Do podszlifowania promptem decka, niezależnie od modelu.
- "Lepszy na kodzie" (V4-Pro, Kimi) ≠ lepszy u nas — nasze zadanie to structured doc-gen.
- Stare aliasy (`deepseek-chat`, `glm-4.6`) odpadły na structured — używać wersji z tabeli.
- Per-format (np. Qwen do doc/table, inny do deck) = możliwe rozszerzenie (dziś jeden model dla wszystkich deliverable).
