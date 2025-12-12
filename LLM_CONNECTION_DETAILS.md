# LLM Connection Details
**Date:** 2025-12-12
**Status:** Verified & Working

This file contains the configuration details for all successfully connected LLM providers. Use this as a reference or input for future setup.

## ✅ Working Providers

| Provider | Model ID | Endpoint URL | Auth Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `gpt-4o` | `https://api.openai.com/v1/chat/completions` | Bearer Token | Standard configuration. |
| **Z.ai (Zhipu)** | `glm-4.6` | `https://api.z.ai/api/paas/v4/chat/completions` | Bearer Token | **Critical**: Must use `api.z.ai` endpoint (not `open.bigmodel.cn`) and standard Bearer auth (no manual JWT). |
| **Alibaba Qwen** | `qwen-max` | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions` | Bearer Token | **Critical**: Must use **International** endpoint (`dashscope-intl`) for this API key. |
| **NVIDIA** | `meta/llama3-8b-instruct` | `https://integrate.api.nvidia.com/v1/chat/completions` | Bearer Token | Works with Llama 3 models. |
| **Google Gemini** | `gemini-2.0-flash` | `https://generativelanguage.googleapis.com/v1beta` | Query Param / Bearer | **Critical**: `gemini-1.5-pro` is NOT available. Must use `gemini-2.0-flash` or similar discovered models. (Account currently hit Free Tier limits). |

## ❌ Current Issues (Non-Technical)
*   **DeepSeek**: `Payment Required` (Configuration is correct, but account needs credits).
*   **Anthropic / Cohere**: `Unauthorized` (Keys likely invalid/expired).

## 📄 JSON Configuration (For Scripting)

You can provide this JSON block to an AI agent to quickly restore `update_keys.js` logic.

```json
[
  {
    "name": "OpenAI GPT-4o",
    "provider": "openai",
    "model_id": "gpt-4o",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "api_key": "sk-proj-..."
  },
  {
    "name": "Zhipu AI (GLM-4.6)",
    "provider": "z_ai",
    "model_id": "glm-4.6",
    "endpoint": "https://api.z.ai/api/paas/v4/chat/completions",
    "api_key": "c67c..."
  },
  {
    "name": "Alibaba Qwen Max",
    "provider": "qwen",
    "model_id": "qwen-max",
    "endpoint": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    "api_key": "sk-9d..."
  },
  {
    "name": "Google Gemini 2.0 Flash",
    "provider": "google",
    "model_id": "gemini-2.0-flash",
    "endpoint": "https://generativelanguage.googleapis.com/v1beta",
    "api_key": "AIza..."
  },
  {
    "name": "NVIDIA Llama 3",
    "provider": "nvidia",
    "model_id": "meta/llama3-8b-instruct",
    "endpoint": "https://integrate.api.nvidia.com/v1/chat/completions",
    "api_key": "nvapi..."
  }
]
```
