# AI Infrastructure Module

## Przegląd

Moduł AI Infrastructure jest centralnym punktem zarządzania wszystkimi usługami LLM w aplikacji Consultinity. Umożliwia administratorom:

- Konfigurację dostawców LLM (OpenAI, Google Gemini, Ollama, Zhipu i inne)
- Przypisywanie modeli do tierów wydajnościowych
- Monitorowanie zdrowia i wydajności systemów AI
- Zarządzanie globalnymi ustawieniami AI

## Architektura

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Infrastructure Module                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   LLM       │  │   Model     │  │   Global    │          │
│  │  Providers  │  │   Tiers     │  │  Settings   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│  ┌──────┴──────────────────┴────────────────┴──────┐        │
│  │              Health Monitoring                   │        │
│  └─────────────────────┬───────────────────────────┘        │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   Backend API       │
              │  /api/llm/*         │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │   LLMController     │
              └──────────┬──────────┘
                         │
              ┌──────────┴──────────┐
              │   llmService        │
              │   (Vercel AI SDK)   │
              └─────────────────────┘
```

## Zakładki Modułu

### 1. LLM Providers

Zarządzanie dostawcami usług LLM:

| Funkcja          | Endpoint                        | Opis                              |
| ---------------- | ------------------------------- | --------------------------------- |
| Lista providerów | `GET /api/llm/providers`        | Wszystkie skonfigurowane dostawcy |
| Dodaj provider   | `POST /api/llm/providers`       | Nowy dostawca LLM                 |
| Edytuj provider  | `PUT /api/llm/providers/:id`    | Aktualizacja konfiguracji         |
| Usuń provider    | `DELETE /api/llm/providers/:id` | Usunięcie dostawcy                |
| Test połączenia  | `POST /api/llm/test`            | Weryfikacja API key               |
| Test Ollama      | `POST /api/llm/test-ollama`     | Test lokalnego Ollama             |

**Wspierane providery:**

- **OpenAI** - GPT-4, GPT-4o, GPT-3.5
- **Google** - Gemini Pro, Gemini Flash
- **Anthropic** - Claude 3 Opus, Sonnet, Haiku
- **Ollama** - Lokalne modele (Gemma, Llama, Mistral)
- **Zhipu** - GLM-4 Flash (Z.ai)
- **DeepSeek** - DeepSeek Chat

### 2. Model Tiers

System tierów pozwala na inteligentny routing zapytań do odpowiednich modeli:

| Tier          | Zastosowanie                   | Koszt     |
| ------------- | ------------------------------ | --------- |
| **BUDGET**    | Szybkie, proste zadania        | Najniższy |
| **STANDARD**  | Większość przypadków użycia    | Średni    |
| **PREMIUM**   | Złożone zadania, wysoka jakość | Wysoki    |
| **REASONING** | Zaawansowane rozumowanie       | Najwyższy |

**Endpointy tier assignments:**

- `GET /api/llm/tiers/assignments` - Pobierz przypisania
- `POST /api/llm/tiers/assign` - Przypisz model do tieru
- `DELETE /api/llm/tiers/assign` - Usuń przypisanie
- `PUT /api/llm/tiers/priority` - Zmień priorytet w tierze

### 3. Global Settings

Globalne ustawienia systemu AI:

| Ustawienie             | Opis                      | Domyślna wartość |
| ---------------------- | ------------------------- | ---------------- |
| Default Provider       | Domyślny dostawca         | Auto-select      |
| Requests per Minute    | Limit zapytań/min         | 100              |
| Requests per Hour      | Limit zapytań/godz        | 1000             |
| Global Token Limit     | Miesięczny limit tokenów  | 10,000,000       |
| Max Tokens per Request | Maks. tokeny na zapytanie | 4096             |
| Max Context Window     | Maks. okno kontekstu      | 128,000          |
| PII Detection          | Poziom wykrywania PII     | Low              |
| Circuit Breaker        | Próg błędów               | 5                |
| Cooldown               | Czas po circuit break     | 60s              |

### 4. Health Monitoring

Monitoring zdrowia systemu AI:

**Endpointy:**

- `GET /api/llm/health/status` - Ogólny status systemu
- `GET /api/llm/health/detailed` - Szczegółowy status każdego providera
- `POST /api/llm/health/test/:capabilityId` - Test konkretnej capability
- `POST /api/llm/health/test-provider` - Test konkretnego providera

**Capabilities testowane:**

1. **connection** - Podstawowe połączenie z API
2. **chat_ready** - Gotowość do konwersacji
3. **eyes** - Kontekst wizualny (multimodal)
4. **memory** - System RAG
5. **hands** - MCP Tools
6. **reasoning** - Zaawansowane rozumowanie

## Baza Danych

### Tabela `llm_providers`

```sql
CREATE TABLE llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT,
    provider TEXT,
    api_key TEXT,
    endpoint TEXT,
    model_id TEXT,
    cost_per_1k REAL DEFAULT 0,
    tier TEXT DEFAULT 'standard',
    context_window INTEGER DEFAULT 4096,
    is_active INTEGER DEFAULT 1,
    is_default INTEGER DEFAULT 0,
    visibility TEXT DEFAULT 'admin'
);
```

### Tabela `llm_tier_assignments`

```sql
CREATE TABLE llm_tier_assignments (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    tier TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `ai_usage_logs`

```sql
CREATE TABLE ai_usage_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    organization_id TEXT,
    provider TEXT NOT NULL,
    model TEXT,
    action TEXT,
    tokens_used INTEGER DEFAULT 0,
    latency_ms INTEGER DEFAULT 0,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Konfiguracja

### Zmienne środowiskowe

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Google/Gemini
GEMINI_API_KEY=AIza...
GOOGLE_API_KEY=AIza...

# Ollama (local)
OLLAMA_ENDPOINT=http://localhost:11434

# Zhipu (Z.ai)
ZHIPU_API_KEY=...

# DeepSeek
DEEPSEEK_API_KEY=...

# Anthropic
ANTHROPIC_API_KEY=...
```

### Szybkie podłączenie providerów (auto-upsert z env)

1. Ustaw klucze API w środowisku (patrz sekcja wyżej).
2. Uruchom seed:

```bash
pnpm tsx server/scripts/seed-llm-providers.ts
```

Skrypt:

- tworzy/aktualizuje wpisy w `llm_providers` dla OpenAI, Gemini, Anthropic, DeepSeek, Zhipu, Ollama,
- ustawia `is_active = 1` dla providerów z dostępnym kluczem/endpointem,
- nadaje domyślne modele i koszt `cost_per_1k` (do edycji w UI).

## Troubleshooting

### Problem: "No providers configured"

**Rozwiązanie:**

1. Sprawdź czy są aktywne providery: `GET /api/llm/providers`
2. Dodaj provider przez UI lub API
3. Ustaw `is_active = 1` w bazie danych

### Problem: "Failed to fetch health data"

**Rozwiązanie:**

1. Sprawdź czy backend jest uruchomiony
2. Zweryfikuj token autoryzacji
3. Sprawdź logi serwera: `[LLMController]`

### Problem: "0 models in tier"

**Rozwiązanie:**

1. Przypisz modele do tierów przez zakładkę "Model Tiers"
2. Sprawdź tabelę `llm_tier_assignments`
3. Upewnij się, że providery są aktywne

## API Reference

Pełna dokumentacja API dostępna w:

- `server/src/routes/llm.routes.ts`
- `server/src/controllers/ai/LLMController.ts`

## Changelog

### 2026-01-08

- ✅ Pełna implementacja wszystkich endpointów
- ✅ System tier assignments
- ✅ Detailed health monitoring
- ✅ Usage analytics i costs
- ✅ Diagnostyka systemu
